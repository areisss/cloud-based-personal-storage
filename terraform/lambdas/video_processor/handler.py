import json
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

import boto3

# boto3 clients outside the handler = reused across warm invocations.
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET = os.environ["BUCKET_NAME"]
TABLE  = os.environ["TABLE_NAME"]

# FFmpeg and ffprobe are bundled in the Lambda package under bin/.
# /var/task is where Lambda extracts the zip at runtime.
FFMPEG  = "/var/task/bin/ffmpeg"
FFPROBE = "/var/task/bin/ffprobe"

THUMBNAIL_MAX_PX = 480

# Storage classes the user may explicitly request.
VALID_STORAGE_CLASSES = {"STANDARD", "STANDARD_IA", "GLACIER_IR"}

CONTENT_TYPES = {
    "mp4":  "video/mp4",
    "mov":  "video/quicktime",
    "avi":  "video/x-msvideo",
    "mkv":  "video/x-matroska",
    "webm": "video/webm",
}


def handler(event, context):
    for record in event["Records"]:
        source_key = record["s3"]["object"]["key"]
        filename   = source_key.split("/")[-1]
        process_video(source_key, filename)


def probe_video(path):
    """Return (duration_seconds, width, height, date_taken) for the video."""
    result = subprocess.run(
        [
            FFPROBE, "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-show_format", "-select_streams", "v:0",
            path,
        ],
        capture_output=True, text=True, check=True,
    )
    data   = json.loads(result.stdout)
    stream = data["streams"][0] if data.get("streams") else {}
    duration = float(stream.get("duration") or 0)
    width    = int(stream.get("width",  0))
    height   = int(stream.get("height", 0))

    # Extract creation_time from format-level tags (set by camera apps).
    tags = data.get("format", {}).get("tags", {})
    raw_ct = tags.get("creation_time")  # e.g. "2024-01-15T14:30:00.000000Z"
    date_taken = None
    if raw_ct:
        try:
            date_taken = datetime.fromisoformat(raw_ct.replace("Z", "+00:00")).isoformat()
        except Exception:
            pass

    return duration, width, height, date_taken


def extract_thumbnail(video_path, out_path, duration):
    """Extract one frame as a JPEG thumbnail via FFmpeg."""
    # Seek to 1 second in; fall back to 0:00 for very short clips.
    seek = "00:00:01" if duration >= 2 else "00:00:00"
    subprocess.run(
        [
            FFMPEG, "-y",
            "-ss", seek,
            "-i", video_path,
            "-frames:v", "1",
            # Scale down to THUMBNAIL_MAX_PX wide, keep aspect ratio.
            # -2 ensures the output height is divisible by 2 (required by some codecs).
            "-vf", f"scale='min({THUMBNAIL_MAX_PX},iw)':-2",
            "-q:v", "4",  # JPEG quality: 1 (best) – 31 (worst)
            out_path,
        ],
        capture_output=True, check=True,
    )


def process_video(source_key, filename):
    stem      = Path(filename).stem
    tmp_video = f"/tmp/{filename}"
    tmp_thumb = f"/tmp/{stem}.jpg"

    try:
        # Read the storage tier and owner chosen by the user at upload time before downloading.
        head      = s3.head_object(Bucket=BUCKET, Key=source_key)
        metadata  = head.get("Metadata", {})
        raw_tier = metadata.get("storage-tier", "AUTO").upper()
        if raw_tier in ("STANDARD_IA", "GLACIER_IR"):
            storage_class = raw_tier
            auto_tier = False
        elif raw_tier == "STANDARD":
            storage_class = "STANDARD"
            auto_tier = False
        else:  # AUTO or unknown → default behaviour
            storage_class = "STANDARD"
            auto_tier = True
        owner_sub  = metadata.get("owner-sub", "unknown")
        source_zip = metadata.get("source-zip")

        # Download the video to Lambda's ephemeral /tmp storage.
        s3.download_file(BUCKET, source_key, tmp_video)
        size_bytes = os.path.getsize(tmp_video)

        duration, width, height, date_taken = probe_video(tmp_video)
        extract_thumbnail(tmp_video, tmp_thumb, duration)

        # Copy the original within S3 — avoids re-uploading a potentially large file.
        # StorageClass is applied to the original only; the thumbnail stays STANDARD
        # because it is loaded on every gallery page open.
        original_key = f"videos/originals/{filename}"
        copy_kwargs = {
            "Bucket": BUCKET,
            "CopySource": {"Bucket": BUCKET, "Key": source_key},
            "Key": original_key,
            "StorageClass": storage_class,
        }
        if auto_tier:
            copy_kwargs["Tagging"] = "auto-tier=true"
            copy_kwargs["TaggingDirective"] = "REPLACE"
        s3.copy_object(**copy_kwargs)

        # Upload thumbnail.
        thumbnail_key = f"videos/thumbnails/{stem}.jpg"
        with open(tmp_thumb, "rb") as fh:
            s3.put_object(
                Bucket=BUCKET, Key=thumbnail_key,
                Body=fh, ContentType="image/jpeg",
            )

        ext = filename.rsplit(".", 1)[-1].lower()
        item = {
            "video_id":         str(uuid.uuid4()),
            "filename":         filename,
            "original_key":     original_key,
            "thumbnail_key":    thumbnail_key,
            "source_key":       source_key,
            "width":            width,
            "height":           height,
            # Store as string — boto3 resource requires Decimal for non-integer numbers.
            "duration_seconds": str(round(duration, 1)),
            "size_bytes":       size_bytes,
            "content_type":     CONTENT_TYPES.get(ext, "video/mp4"),
            "storage_class":    storage_class,
            "owner_sub":        owner_sub,
            "visibility":       "private",
            "uploaded_at":      datetime.now(timezone.utc).isoformat(),
        }
        if date_taken:
            item["date_taken"] = date_taken
        if source_zip:
            item["source_zip"] = source_zip
        dynamodb.Table(TABLE).put_item(Item=item)

    finally:
        # Always clean up /tmp regardless of success or failure.
        for p in (tmp_video, tmp_thumb):
            try:
                os.remove(p)
            except FileNotFoundError:
                pass
