import re
import os

import boto3

s3 = boto3.client("s3")

BUCKET = os.environ["BUCKET_NAME"]

# WhatsApp exports start each message with a timestamp in this format:
# "12/31/2024, 10:30 AM - Sender: message"
# This regex matches that pattern to validate the file is a real WhatsApp export.
WHATSAPP_LINE_RE = re.compile(
    r"^\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2}\s[AP]M\s-"
)
MIN_MATCHING_LINES = 2


def is_valid_whatsapp_export(content):
    # Count how many lines match the WhatsApp timestamp pattern.
    # We stop counting once we reach the minimum — no need to scan the whole file.
    matches = 0
    for line in content.splitlines():
        if WHATSAPP_LINE_RE.match(line):
            matches += 1
            if matches >= MIN_MATCHING_LINES:
                return True
    return False


def handler(event, context):
    for record in event["Records"]:
        source_key = record["s3"]["object"]["key"]
        filename = source_key.split("/")[-1]
        process_file(source_key, filename)


def process_file(source_key, filename):
    response = s3.get_object(Bucket=BUCKET, Key=source_key)
    # WhatsApp exports are plain text — decode bytes to string for line parsing.
    content = response["Body"].read().decode("utf-8")

    if not is_valid_whatsapp_export(content):
        # Log and skip — the file stays in raw-whatsapp-uploads/ but is never
        # referenced again. No exception raised so Lambda reports success.
        print(f"Skipping {filename}: not a valid WhatsApp export")
        return

    # Extract year and month from the first matching timestamp line
    # to build the Hive-style partition path: year=YYYY/month=MM/
    first_match = next(
        line for line in content.splitlines()
        if WHATSAPP_LINE_RE.match(line)
    )
    # Date is the first token before the comma e.g. "12/31/2024"
    date_part = first_match.split(",")[0]
    month, day, year = date_part.strip().split("/")
    # Zero-pad month for consistent sorting: "1" → "01"
    month = month.zfill(2)

    bronze_key = f"bronze/whatsapp/year={year}/month={month}/{filename}"
    s3.copy_object(
        Bucket=BUCKET,
        CopySource={"Bucket": BUCKET, "Key": source_key},
        Key=bronze_key,
    )
    print(f"Copied {source_key} → {bronze_key}")
