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
    """Return (duration_seconds, width, height) for the first video stream."""
    result = subprocess.run(
        [
            FFPROBE, "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-select_streams", "v:0",
            path,
        ],
        capture_output=True, text=True, check=True,
    )
    data   = json.loads(result.stdout)
    stream = data["streams"][0] if data.get("streams") else {}
    duration = float(stream.get("duration") or 0)
    width    = int(stream.get("width",  0))
    height   = int(stream.get("height", 0))
    return duration, width, height


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
        # Download the video to Lambda's ephemeral /tmp storage.
        s3.download_file(BUCKET, source_key, tmp_video)
        size_bytes = os.path.getsize(tmp_video)

        duration, width, height = probe_video(tmp_video)
        extract_thumbnail(tmp_video, tmp_thumb, duration)

        # Copy the original within S3 — avoids re-uploading a potentially large file.
        original_key = f"videos/originals/{filename}"
        s3.copy_object(
            Bucket=BUCKET,
            CopySource={"Bucket": BUCKET, "Key": source_key},
            Key=original_key,
        )

        # Upload thumbnail.
        thumbnail_key = f"videos/thumbnails/{stem}.jpg"
        with open(tmp_thumb, "rb") as fh:
            s3.put_object(
                Bucket=BUCKET, Key=thumbnail_key,
                Body=fh, ContentType="image/jpeg",
            )

        ext = filename.rsplit(".", 1)[-1].lower()
        dynamodb.Table(TABLE).put_item(Item={
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
            "uploaded_at":      datetime.now(timezone.utc).isoformat(),
        })

    finally:
        # Always clean up /tmp regardless of success or failure.
        for p in (tmp_video, tmp_thumb):
            try:
                os.remove(p)
            except FileNotFoundError:
                pass
