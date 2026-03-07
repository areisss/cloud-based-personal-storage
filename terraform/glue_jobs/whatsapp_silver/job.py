import re
import sys

import awswrangler as wr
import boto3
import pandas as pd

# Glue Python Shell jobs receive arguments via sys.argv.
# --BUCKET_NAME and --DATABASE_NAME are injected by Terraform
# through the job's default_arguments block.
args = dict(arg.split("=", 1) for arg in sys.argv[1:] if "=" in arg)
BUCKET   = args["--BUCKET_NAME"]
DATABASE = args["--DATABASE_NAME"]

BRONZE_PREFIX = f"s3://{BUCKET}/bronze/whatsapp/"
SILVER_PREFIX = f"s3://{BUCKET}/silver/whatsapp/"

# WhatsApp message line format:
# "12/31/2024, 10:30 AM - Sender Name: message text"
MESSAGE_RE = re.compile(
    r"^(\d{1,2}/\d{1,2}/\d{2,4}),\s(\d{1,2}:\d{2}\s[AP]M)\s-\s([^:]+):\s(.+)$"
)


def parse_file(s3_key, content):
    rows = []
    for line in content.splitlines():
        match = MESSAGE_RE.match(line)
        if not match:
            # Skip system messages like "Messages and calls are end-to-end encrypted"
            # and multi-line message continuations.
            continue
        date, time, sender, message = match.groups()
        rows.append({
            "date":        date,
            "time":        time,
            "sender":      sender.strip(),
            "message":     message.strip(),
            # word_count is a useful derived metric for analytics queries
            "word_count":  len(message.split()),
            "source_file": s3_key,
        })
    return pd.DataFrame(rows)


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
            content = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read().decode("utf-8")
            df = parse_file(key, content)
            if not df.empty:
                frames.append(df)

    if not frames:
        print("No messages found — exiting.")
        return

    # Combine all files into one DataFrame
    all_messages = pd.concat(frames, ignore_index=True)

    # Parquet partition column must be a clean date string (YYYY-MM-DD).
    # The raw date from WhatsApp is M/D/YYYY — convert it.
    all_messages["date"] = pd.to_datetime(
        all_messages["date"], format="%m/%d/%Y"
    ).dt.strftime("%Y-%m-%d")

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
