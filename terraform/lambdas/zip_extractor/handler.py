import os
import zipfile
from pathlib import Path
from urllib.parse import unquote_plus

import boto3
from botocore.exceptions import ClientError

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]


def key_exists(key):
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def get_dest_prefix(filename):
    """Mirror the frontend getPrefix() logic."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("jpg", "jpeg", "png", "webp"):
        return "raw-photos/"
    if ext in ("mp4", "mov", "avi", "mkv", "webm"):
        return "raw-videos/"
    if ext == "txt":
        return "raw-whatsapp-uploads/"
    return "misc/"  # zip-in-zip, unknown → no recursive extraction


def is_macos_junk(name):
    """Skip __MACOSX/ directory entries and ._filename resource forks."""
    name = name.replace("\\", "/")
    if name.startswith("__MACOSX/"):
        return True
    return name.rsplit("/", 1)[-1].startswith("._")


def handler(event, context):
    for record in event["Records"]:
        # S3 event keys are URL-encoded (spaces → +, special chars → %XX)
        process_zip(unquote_plus(record["s3"]["object"]["key"]))


def process_zip(source_key):
    filename = source_key.split("/")[-1]
    tmp_zip = f"/tmp/{filename}"

    head = s3.head_object(Bucket=BUCKET, Key=source_key)
    inherited_metadata = {
        "owner-sub":    head.get("Metadata", {}).get("owner-sub", "unknown"),
        "storage-tier": head.get("Metadata", {}).get("storage-tier", "AUTO"),
        "source-zip":   filename,
    }

    try:
        s3.download_file(BUCKET, source_key, tmp_zip)
        with zipfile.ZipFile(tmp_zip, "r") as zf:
            for entry in zf.infolist():
                if entry.filename.endswith("/"):
                    continue
                if is_macos_junk(entry.filename):
                    print(f"Skipping macOS artifact: {entry.filename}")
                    continue
                try:
                    process_entry(zf, entry, inherited_metadata)
                except Exception as exc:
                    # Log per-file failure; continue with remaining entries.
                    print(f"ERROR processing {entry.filename}: {exc}")
    finally:
        try:
            os.remove(tmp_zip)
        except FileNotFoundError:
            pass


def process_entry(zf, entry, inherited_metadata):
    # Flatten internal zip path — keep only the basename.
    basename = entry.filename.rsplit("/", 1)[-1]
    if not basename:
        return

    tmp_path = f"/tmp/{basename}"
    dest_key = f"{get_dest_prefix(basename)}{basename}"

    if key_exists(dest_key):
        print(f"Skipping {entry.filename} — already exists at {dest_key}")
        return

    try:
        # extract() preserves internal dir structure; move to flat /tmp path.
        zf.extract(entry, "/tmp")
        extracted_at = os.path.join("/tmp", entry.filename)
        if extracted_at != tmp_path:
            os.replace(extracted_at, tmp_path)

        # upload_file handles multipart automatically for large videos.
        s3.upload_file(
            tmp_path, BUCKET, dest_key,
            ExtraArgs={"Metadata": inherited_metadata},
        )
        print(f"Extracted {entry.filename} → s3://{BUCKET}/{dest_key}")
    finally:
        # Delete before next entry to keep /tmp usage at zip_size + 1 file.
        try:
            os.remove(tmp_path)
        except FileNotFoundError:
            pass
