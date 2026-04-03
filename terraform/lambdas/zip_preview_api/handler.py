import base64
import io
import json
import os
import zipfile

import boto3

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]

ALLOWED_PREFIXES = ("raw-zips/", "misc/", "uploads-landing/")
PRESIGNED_TTL = 3600  # 1 hour


def get_caller_info(event):
    token = (event.get("headers") or {}).get("Authorization", "")
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.b64decode(payload))
        return {
            "sub":    claims.get("sub", ""),
            "groups": claims.get("cognito:groups", []),
        }
    except Exception:
        return {"sub": "", "groups": []}


def ok(body):
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }


def error(status, msg):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({"error": msg}),
    }


def get_extension(name):
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def classify_file(name):
    ext = get_extension(name)
    if ext in ("jpg", "jpeg", "png", "webp", "gif", "heic", "heif"):
        return "photo"
    if ext in ("mp4", "mov", "avi", "mkv", "webm", "m4v"):
        return "video"
    if ext in ("opus", "mp3", "m4a", "aac", "ogg", "wav", "wma", "flac"):
        return "audio"
    if ext in ("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"):
        return "document"
    return "other"


def is_junk(name):
    name = name.replace("\\", "/")
    if name.startswith("__MACOSX/"):
        return True
    basename = name.rsplit("/", 1)[-1]
    return basename.startswith("._") or basename == ".DS_Store"


def format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    if size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


import re

_DATE_PATTERNS = [
    re.compile(r"(\d{4})-(\d{2})-(\d{2})"),       # 2016-07-01
    re.compile(r"(\d{4})(\d{2})(\d{2})"),           # 20160701 (8 consecutive digits)
    re.compile(r"(\d{2})-(\d{2})-(\d{4})"),         # 01-07-2016
]

_MONTH_NAMES = {
    "01": "January", "02": "February", "03": "March", "04": "April",
    "05": "May", "06": "June", "07": "July", "08": "August",
    "09": "September", "10": "October", "11": "November", "12": "December",
}


def _extract_month(name):
    """Try to extract a YYYY-MM month string from a filename."""
    for pattern in _DATE_PATTERNS:
        m = pattern.search(name)
        if m:
            groups = m.groups()
            if len(groups[0]) == 4:  # YYYY-MM-DD or YYYYMMDD
                year, month = groups[0], groups[1]
            else:  # DD-MM-YYYY
                year, month = groups[2], groups[1]
            if 1 <= int(month) <= 12 and 2000 <= int(year) <= 2099:
                return f"{year}-{month}"
    return None


def _group_entries(entries):
    """Group entries by month first, then by type within each month."""
    type_labels = {"photo": "Photos", "video": "Videos", "document": "Documents", "audio": "Audio", "other": "Other"}
    type_order = {"photo": 0, "video": 1, "audio": 2, "document": 3, "other": 4}

    # Group by month first
    by_month = {}
    for entry in entries:
        month = _extract_month(entry["name"]) or _extract_month(entry.get("full_path", ""))
        month_key = month or "Unknown date"
        by_month.setdefault(month_key, []).append(entry)

    result = []
    for month_key in sorted(by_month.keys(), reverse=True):
        month_entries = by_month[month_key]
        if month_key != "Unknown date":
            year, mm = month_key.split("-")
            label = f"{_MONTH_NAMES.get(mm, mm)} {year}"
        else:
            label = "Unknown date"

        # Group by type within this month
        by_type = {}
        for entry in month_entries:
            t = entry["type"]
            by_type.setdefault(t, []).append(entry)

        types = []
        for t in sorted(by_type.keys(), key=lambda x: type_order.get(x, 9)):
            type_entries = by_type[t]
            types.append({
                "type":       t,
                "type_label": type_labels.get(t, t),
                "count":      len(type_entries),
                "total_size_human": format_size(sum(e["size_bytes"] for e in type_entries)),
                "entries":    type_entries,
            })

        result.append({
            "month":      month_key,
            "label":      label,
            "count":      len(month_entries),
            "total_size": sum(e["size_bytes"] for e in month_entries),
            "total_size_human": format_size(sum(e["size_bytes"] for e in month_entries)),
            "types":      types,
        })

    return result


def _group_by_source(entries):
    """Group entries by source ZIP first, then by month -> type within each source."""
    by_source = {}
    for entry in entries:
        source = entry.get("source_zip") or None
        by_source.setdefault(source, []).append(entry)

    result = []
    # Sources with a name first (sorted alphabetically), then "Direct uploads" last
    for source in sorted(by_source.keys(), key=lambda s: (s is None, s or "")):
        source_entries = by_source[source]
        months = _group_entries(source_entries)
        result.append({
            "source":     source or "Direct uploads",
            "has_source": source is not None,
            "count":      len(source_entries),
            "total_size_human": format_size(sum(e.get("size_bytes", 0) for e in source_entries)),
            "months":     months,
        })

    return result


def handler(event, context):
    params = event.get("queryStringParameters") or {}

    caller = get_caller_info(event)
    if not caller["sub"] and "demo" not in caller["groups"]:
        return error(401, "Unauthorized")

    view = params.get("view")

    # ── List files in a prefix ──────────────────────────────────────────
    if view == "list":
        return handle_list(params, caller)

    # ── ZIP contents preview ────────────────────────────────────────────
    key = params.get("key", "")
    if key:
        return handle_zip_preview(key, caller)

    return error(400, "Provide view=list&prefix=... or key=...")


def handle_list(params, caller):
    """List S3 objects under a prefix, returning presigned download URLs + grouped view."""
    prefix = params.get("prefix", "")
    if not any(prefix.startswith(p) for p in ALLOWED_PREFIXES):
        return error(400, f"prefix must start with one of: {', '.join(ALLOWED_PREFIXES)}")

    owner_sub = caller["sub"]
    is_demo = "demo" in caller["groups"]

    # List all objects under the prefix.
    items = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            items.append({
                "key":           obj["Key"],
                "size":          obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            })

    # Filter by owner — check metadata for each file.
    # For efficiency, only check the newest 200 files.
    items.sort(key=lambda x: x["last_modified"], reverse=True)
    items = items[:200]

    visible = []
    for item in items:
        try:
            head = s3.head_object(Bucket=BUCKET, Key=item["key"])
            metadata = head.get("Metadata", {})
            file_owner = metadata.get("owner-sub", "")
            if is_demo or file_owner == owner_sub:
                name = item["key"].split("/")[-1]
                item["url"] = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": BUCKET, "Key": item["key"]},
                    ExpiresIn=PRESIGNED_TTL,
                )
                item["size_human"] = format_size(item["size"])
                item["size_bytes"] = item["size"]
                item["name"] = name
                item["type"] = classify_file(name)
                item["extension"] = get_extension(name)
                item["source_zip"] = metadata.get("source-zip")
                visible.append(item)
        except Exception:
            continue
        if len(visible) >= 100:
            break

    # Group: source -> month -> type -> files
    grouped = _group_by_source(visible)

    return ok({"items": visible, "grouped": grouped, "total": len(visible)})


def handle_zip_preview(key, caller):
    """Read ZIP central directory and return file listing."""
    if not any(key.startswith(p) for p in ALLOWED_PREFIXES):
        return error(400, f"key must start with one of: {', '.join(ALLOWED_PREFIXES)}")

    try:
        head = s3.head_object(Bucket=BUCKET, Key=key)
    except Exception:
        return error(404, "File not found")

    file_owner = head.get("Metadata", {}).get("owner-sub", "")
    if "demo" not in caller["groups"] and file_owner != caller["sub"]:
        return error(403, "Access denied")

    file_size = head["ContentLength"]
    if file_size > 500 * 1024 * 1024:
        return error(400, "File too large to preview")

    try:
        response = s3.get_object(Bucket=BUCKET, Key=key)
        zip_bytes = response["Body"].read()
        zip_buffer = io.BytesIO(zip_bytes)

        with zipfile.ZipFile(zip_buffer, "r") as zf:
            entries = []
            total_size = 0
            for info in zf.infolist():
                if info.filename.endswith("/"):
                    continue
                if is_junk(info.filename):
                    continue
                basename = info.filename.rsplit("/", 1)[-1]
                entries.append({
                    "name":       basename,
                    "full_path":  info.filename,
                    "size_bytes": info.file_size,
                    "size_human": format_size(info.file_size),
                    "type":       classify_file(basename),
                    "extension":  get_extension(basename),
                })
                total_size += info.file_size

        type_order = {"photo": 0, "video": 1, "document": 2, "other": 3}
        entries.sort(key=lambda e: (type_order.get(e["type"], 9), e["name"]))

        # Group by type, then by month (extracted from filename date patterns)
        grouped = _group_entries(entries)

        return ok({
            "entries":          entries,
            "grouped":          grouped,
            "total_entries":    len(entries),
            "total_size":       total_size,
            "total_size_human": format_size(total_size),
            "zip_filename":     key.split("/")[-1],
        })

    except zipfile.BadZipFile:
        return error(400, "Not a valid ZIP file")
    except Exception as exc:
        return error(500, f"Failed to read ZIP: {str(exc)}")
