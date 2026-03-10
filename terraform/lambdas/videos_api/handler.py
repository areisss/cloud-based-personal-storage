import json
import os

import boto3

# boto3 clients outside the handler = reused across warm invocations.
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

BUCKET = os.environ["BUCKET_NAME"]
TABLE  = os.environ["TABLE_NAME"]

# Presigned URL expiry times.
# Thumbnails are loaded immediately on page open — 1 hour is enough.
# Originals are for download — 24 hours gives the user time to click later.
THUMBNAIL_TTL = 3600   # 1 hour
ORIGINAL_TTL  = 86400  # 24 hours


def scan_all_videos():
    table = dynamodb.Table(TABLE)
    items = []

    # DynamoDB scan returns at most 1 MB per call; paginate until done.
    response = table.scan()
    items.extend(response["Items"])

    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response["Items"])

    return items


def enrich_with_urls(items):
    for item in items:
        item["thumbnail_url"] = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": item["thumbnail_key"]},
            ExpiresIn=THUMBNAIL_TTL,
        )
        item["original_url"] = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": item["original_key"]},
            ExpiresIn=ORIGINAL_TTL,
        )
    return items


def handler(event, context):
    items = scan_all_videos()

    # Sort by upload time, newest first.
    items.sort(key=lambda x: x["uploaded_at"], reverse=True)

    items = enrich_with_urls(items)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(items, default=str),
    }
