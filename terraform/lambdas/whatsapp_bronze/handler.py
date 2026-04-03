import re
import os
from urllib.parse import unquote_plus

import boto3

s3 = boto3.client("s3")

BUCKET = os.environ["BUCKET_NAME"]

# US WhatsApp format: "12/31/2024, 10:30 AM - Sender: message"
WHATSAPP_LINE_RE_US = re.compile(
    r"^\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2}\s[AP]M\s-"
)

# Brazilian WhatsApp format: "[01/07/2016 07:45:39] ~ Sender: message"
# The separator may be ~ or -; spaces around it may be regular or non-breaking (U+00A0).
WHATSAPP_LINE_RE_BR = re.compile(
    r"^\[\d{1,2}/\d{1,2}/\d{2,4}\s\d{2}:\d{2}:\d{2}\]"
)

MIN_MATCHING_LINES = 2


def detect_format(lines):
    """Scan lines and return 'us', 'br', or None if not a valid export."""
    us_count = br_count = 0
    for line in lines:
        if WHATSAPP_LINE_RE_US.match(line):
            us_count += 1
        elif WHATSAPP_LINE_RE_BR.match(line):
            br_count += 1
        if us_count >= MIN_MATCHING_LINES:
            return "us"
        if br_count >= MIN_MATCHING_LINES:
            return "br"
    return None


def extract_date(first_line, fmt):
    """Return (year, zero-padded month) from the first matching line."""
    if fmt == "us":
        # "12/31/2024, 10:30 AM - ..." — date is the token before the comma
        date_part = first_line.split(",")[0].strip()
        month, _day, year = date_part.split("/")
    else:  # br
        # "[01/07/2016 07:45:39] ..." — date is between "[" and the first space
        date_part = first_line[1:].split(" ")[0]   # strips "[", yields "01/07/2016"
        _day, month, year = date_part.split("/")
    return year, month.zfill(2)


def handler(event, context):
    for record in event["Records"]:
        # S3 object keys in event notifications are URL-encoded.
        source_key = unquote_plus(record["s3"]["object"]["key"])
        filename = source_key.split("/")[-1]
        process_file(source_key, filename)


def process_file(source_key, filename):
    response = s3.get_object(Bucket=BUCKET, Key=source_key)
    raw = response["Body"].read()
    # Decode with errors="replace" to tolerate occasional encoding oddities.
    content = raw.decode("utf-8", errors="replace")
    # Normalise Windows line endings so splitlines() works uniformly.
    content = content.replace("\r\n", "\n").replace("\r", "\n")

    # Read the uploader's Cognito sub from S3 object metadata.
    owner_sub = response.get("Metadata", {}).get("owner-sub", "unknown")

    lines = content.splitlines()
    fmt = detect_format(lines)

    if fmt is None:
        print(f"Skipping {filename}: not a valid WhatsApp export")
        return

    re_pattern = WHATSAPP_LINE_RE_US if fmt == "us" else WHATSAPP_LINE_RE_BR
    first_match = next(line for line in lines if re_pattern.match(line))
    year, month = extract_date(first_match, fmt)

    bronze_key = (
        f"bronze/whatsapp/owner_sub={owner_sub}"
        f"/year={year}/month={month}/{filename}"
    )
    s3.copy_object(
        Bucket=BUCKET,
        CopySource={"Bucket": BUCKET, "Key": source_key},
        Key=bronze_key,
    )
    print(f"Copied {source_key} → {bronze_key} (format={fmt})")
