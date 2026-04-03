import argparse
import re
import sys

import awswrangler as wr
import boto3
import pandas as pd

# Glue Python Shell jobs receive arguments via sys.argv.
# --BUCKET_NAME and --DATABASE_NAME are injected by Terraform
# through the job's default_arguments block.
# argparse handles both --key=value and --key value formats across Glue versions.
parser = argparse.ArgumentParser()
parser.add_argument("--BUCKET_NAME",   required=True)
parser.add_argument("--DATABASE_NAME", required=True)
known, _ = parser.parse_known_args()
BUCKET   = known.BUCKET_NAME
DATABASE = known.DATABASE_NAME

BRONZE_PREFIX = f"s3://{BUCKET}/bronze/whatsapp/"
SILVER_PREFIX = f"s3://{BUCKET}/silver/whatsapp/"

# US WhatsApp format: "12/31/2024, 10:30 AM - Sender Name: message text"
MESSAGE_RE_US = re.compile(
    r"^(\d{1,2}/\d{1,2}/\d{2,4}),\s(\d{1,2}:\d{2}\s[AP]M)\s-\s([^:]+):\s(.+)$"
)

# Brazilian WhatsApp format: "[01/07/2016 07:45:39] ~ Sender Name: message text"
# The separator after ] is ~ or -, optionally surrounded by regular/non-breaking spaces (U+00A0).
MESSAGE_RE_BR = re.compile(
    r"^\[(\d{1,2}/\d{1,2}/\d{2,4})\s(\d{2}:\d{2}:\d{2})\][\s\u00a0]+[~\-][\s\u00a0]+([^:]+):\s(.+)$"
)

# Matches the owner_sub Hive partition in the S3 key.
# Handles both new paths (owner_sub=.../year=.../month=.../file)
# and legacy paths (year=.../month=.../file) — legacy files get owner_sub='demo'.
OWNER_SUB_RE = re.compile(r"owner_sub=([^/]+)/")


def detect_format(lines):
    """Scan the first 50 lines; return 'us' or 'br' based on which pattern matches first."""
    for line in lines[:50]:
        if MESSAGE_RE_US.match(line):
            return "us"
        if MESSAGE_RE_BR.match(line):
            return "br"
    return "us"  # default — US exports are the historical baseline


def parse_file(s3_key, content, owner_sub):
    # Normalise Windows line endings (Brazilian exports use \r\n).
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    lines = content.splitlines()

    fmt = detect_format(lines)
    re_pattern  = MESSAGE_RE_US if fmt == "us" else MESSAGE_RE_BR
    # Parquet partition column must be YYYY-MM-DD;
    # US dates are M/D/Y, Brazilian dates are D/M/Y.
    date_format = "%m/%d/%Y" if fmt == "us" else "%d/%m/%Y"

    rows = []
    for line in lines:
        match = re_pattern.match(line)
        if not match:
            # Skip system messages like "Messages and calls are end-to-end encrypted"
            # and multi-line message continuations.
            continue
        date, time_val, sender, message = match.groups()
        rows.append({
            "date":        date,
            "time":        time_val,
            "sender":      sender.strip(),
            "message":     message.strip(),
            # word_count is a useful derived metric for analytics queries
            "word_count":  len(message.split()),
            "source_file": s3_key,
            "owner_sub":   owner_sub,
        })

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    # Convert raw date string to YYYY-MM-DD using the format detected for this file.
    df["date"] = pd.to_datetime(df["date"], format=date_format).dt.strftime("%Y-%m-%d")
    return df


def main():
    s3 = boto3.client("s3")

    # List all .txt files under bronze/whatsapp/ across all partitions
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=BUCKET, Prefix="bronze/whatsapp/")

    frames = []
    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".txt"):
                continue

            # Extract owner_sub from the Hive partition in the S3 key.
            # Legacy files at bronze/whatsapp/year=.../month=.../ have no owner_sub
            # partition — fall back to 'demo' so they remain visible to the demo account.
            match = OWNER_SUB_RE.search(key)
            owner_sub = match.group(1) if match else "demo"

            content = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read().decode("utf-8", errors="replace")
            df = parse_file(key, content, owner_sub)
            if not df.empty:
                frames.append(df)

    if not frames:
        print("No messages found — exiting.")
        return

    # Combine all files into one DataFrame
    all_messages = pd.concat(frames, ignore_index=True)

    # date is already YYYY-MM-DD — converted per-format in parse_file().

    # Write Parquet to silver/, partitioned by date.
    # mode="overwrite_partitions" re-writes only affected date partitions
    # on re-run — safe for append-only data.
    # dataset=True + database/table registers the table in the Glue catalog
    # so Athena can query it immediately.
    wr.s3.to_parquet(
        df=all_messages,
        path=SILVER_PREFIX,
        dataset=True,
        partition_cols=["date"],
        database=DATABASE,
        table="whatsapp_messages",
        mode="overwrite_partitions",
        compression="snappy",
    )
    print(f"Wrote {len(all_messages)} messages to {SILVER_PREFIX}")


if __name__ == "__main__":
    main()
