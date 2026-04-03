import io
import json
import os
import urllib.request
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from PIL import Image

# boto3 clients are created outside the handler so they are reused
# across warm Lambda invocations — saves ~100ms per call.
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET = os.environ["BUCKET_NAME"]
TABLE = os.environ["TABLE_NAME"]
THUMBNAIL_MAX_PX = 300

# Storage classes the user may explicitly request.
VALID_STORAGE_CLASSES = {"STANDARD", "STANDARD_IA", "GLACIER_IR"}

TAG_DATE_ORIGINAL = 36867   # EXIF DateTimeOriginal
TAG_GPS_INFO      = 34853   # EXIF GPSInfo


def _dms_to_decimal(dms, ref):
    d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
    v = d + m / 60 + s / 3600
    return round(-v if ref in ('S', 'W') else v, 6)


def extract_date_taken(image):
    try:
        exif = image.getexif()
        raw = exif.get(TAG_DATE_ORIGINAL) or exif.get(306)  # 306 = DateTime
        if raw:
            return datetime.strptime(raw, '%Y:%m:%d %H:%M:%S').isoformat()
    except Exception:
        pass
    return None


def extract_gps(image):
    try:
        gps = image.getexif().get_ifd(TAG_GPS_INFO)
        if not gps:
            return None, None
        lat = _dms_to_decimal(gps[2], gps[1])   # GPSLatitude / Ref
        lon = _dms_to_decimal(gps[4], gps[3])   # GPSLongitude / Ref
        return lat, lon
    except Exception:
        return None, None


def reverse_geocode(lat, lon):
    url = (f"https://nominatim.openstreetmap.org/reverse"
           f"?lat={lat}&lon={lon}&format=json&zoom=10")
    req = urllib.request.Request(url,
          headers={"User-Agent": "cloud-personal-storage/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            addr = json.loads(r.read()).get("address", {})
        city = (addr.get("city") or addr.get("town")
                or addr.get("village") or addr.get("county"))
        country = addr.get("country")
        return f"{city}, {country}" if city and country else country
    except Exception:
        return None


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

    # Read the storage tier and owner chosen by the user at upload time.
    # Amplify sets metadata keys without the x-amz-meta- prefix in boto3 responses.
    metadata = response.get("Metadata", {})
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

    # io.BytesIO wraps raw bytes as a file-like object so Pillow can open it
    # without writing anything to disk (Lambda has limited /tmp storage).
    image = Image.open(io.BytesIO(image_bytes))
    original_width, original_height = image.size

    date_taken    = extract_date_taken(image)
    lat, lon      = extract_gps(image)
    location_name = reverse_geocode(lat, lon) if lat is not None else None

    # Copy the original bytes as-is to photos/originals/ — no re-encoding,
    # so the full-quality file is preserved exactly as uploaded.
    # StorageClass is applied to the original only; the thumbnail stays STANDARD
    # because it is loaded on every gallery page open.
    original_key = f"photos/originals/{filename}"
    original_kwargs = {
        "Bucket": BUCKET, "Key": original_key,
        "Body": image_bytes, "ContentType": content_type,
        "StorageClass": storage_class,
    }
    if auto_tier:
        original_kwargs["Tagging"] = "auto-tier=true"
    s3.put_object(**original_kwargs)

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
    item = {
        "photo_id":      str(uuid.uuid4()),
        "filename":      filename,
        "original_key":  original_key,
        "thumbnail_key": thumbnail_key,
        "source_key":    source_key,
        "width":         original_width,
        "height":        original_height,
        "size_bytes":    len(image_bytes),
        "content_type":  content_type,
        "storage_class": storage_class,
        "owner_sub":     owner_sub,
        "visibility":    "private",
        # Store as ISO 8601 string — DynamoDB has no native datetime type.
        "uploaded_at":   datetime.now(timezone.utc).isoformat(),
    }
    if date_taken:
        item["date_taken"] = date_taken
    if lat is not None:
        item["latitude"]  = Decimal(str(lat))
        item["longitude"] = Decimal(str(lon))
    if location_name:
        item["location_name"] = location_name
    if source_zip:
        item["source_zip"] = source_zip
    table.put_item(Item=item)
