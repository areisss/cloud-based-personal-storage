import io
import os
import uuid
from datetime import datetime, timezone

import boto3
from PIL import Image

# boto3 clients are created outside the handler so they are reused
# across warm Lambda invocations — saves ~100ms per call.
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET = os.environ["BUCKET_NAME"]
TABLE = os.environ["TABLE_NAME"]
THUMBNAIL_MAX_PX = 300


def handler(event, context):
    # S3 can batch multiple records in one event, but for ObjectCreated
    # triggers on a single prefix it's almost always one record.
    for record in event["Records"]:
        source_key = record["s3"]["object"]["key"]
        filename = source_key.split("/")[-1]
        process_photo(source_key, filename)


def process_photo(source_key, filename):
    # get_object returns a dict; the file bytes are a streaming body under "Body".
    # read() pulls all bytes into memory — acceptable for photos at personal scale.
    response = s3.get_object(Bucket=BUCKET, Key=source_key)
    image_bytes = response["Body"].read()
    content_type = response["ContentType"]

    # io.BytesIO wraps raw bytes as a file-like object so Pillow can open it
    # without writing anything to disk (Lambda has limited /tmp storage).
    image = Image.open(io.BytesIO(image_bytes))
    original_width, original_height = image.size

    # Copy the original bytes as-is to photos/originals/ — no re-encoding,
    # so the full-quality file is preserved exactly as uploaded.
    original_key = f"photos/originals/{filename}"
    s3.put_object(Bucket=BUCKET, Key=original_key, Body=image_bytes, ContentType=content_type)

    # thumbnail_image is a separate copy so we don't mutate the original.
    thumbnail_image = image.copy()

    # JPEG doesn't support transparency (alpha channel). If the image is RGBA
    # (e.g. a PNG with transparency), convert to RGB before saving as JPEG.
    if thumbnail_image.mode == "RGBA":
        thumbnail_image = thumbnail_image.convert("RGB")

    # thumbnail() resizes in-place to fit within a 300x300 box,
    # preserving aspect ratio. LANCZOS is the highest-quality resampling filter.
    thumbnail_image.thumbnail((THUMBNAIL_MAX_PX, THUMBNAIL_MAX_PX), Image.LANCZOS)
    thumbnail_width, thumbnail_height = thumbnail_image.size

    # Save the thumbnail into a BytesIO buffer so we can upload it to S3
    # without writing to disk.
    thumbnail_buffer = io.BytesIO()
    fmt = "JPEG" if content_type == "image/jpeg" else "PNG"
    thumbnail_image.save(thumbnail_buffer, format=fmt)
    thumbnail_buffer.seek(0)  # rewind to the start so S3 reads from the beginning

    thumbnail_key = f"photos/thumbnails/{filename}"
    s3.put_object(Bucket=BUCKET, Key=thumbnail_key, Body=thumbnail_buffer, ContentType=content_type)

    # Write one record per photo. photo_id is a UUID so it's globally unique
    # even if the same filename is uploaded twice.
    table = dynamodb.Table(TABLE)
    table.put_item(Item={
        "photo_id":      str(uuid.uuid4()),
        "filename":      filename,
        "original_key":  original_key,
        "thumbnail_key": thumbnail_key,
        "source_key":    source_key,
        "width":         original_width,
        "height":        original_height,
        "size_bytes":    len(image_bytes),
        "content_type":  content_type,
        # Store as ISO 8601 string — DynamoDB has no native datetime type.
        "uploaded_at":   datetime.now(timezone.utc).isoformat(),
    })
