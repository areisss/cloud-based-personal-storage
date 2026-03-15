import base64
import json
import os

import boto3
from boto3.dynamodb.conditions import Attr, Key

# boto3 clients outside the handler = reused across warm invocations.
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

BUCKET = os.environ["BUCKET_NAME"]
TABLE  = os.environ["TABLE_NAME"]

# Presigned URL expiry times.
THUMBNAIL_TTL = 3600    # 1 hour  — thumbnails load immediately on page open
ORIGINAL_TTL  = 86400   # 24 hours — originals are for download, may be clicked later

DEFAULT_LIMIT = 50
MAX_LIMIT     = 200


def get_caller_info(event):
    """Decode the Cognito JWT from the Authorization header to get sub and groups."""
    token = (event.get("headers") or {}).get("Authorization", "")
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.b64decode(payload))
        return {
            "sub":    claims.get("sub", ""),
            "groups": claims.get("cognito:groups", []),
        }
    except Exception:
        return {"sub": "", "groups": []}


def fetch_all_photos(caller):
    """Return all photos visible to this caller (no presigned URLs yet)."""
    table = dynamodb.Table(TABLE)

    if "demo" in caller["groups"]:
        items = []
        response = table.scan(FilterExpression=Attr("visibility").eq("public"))
        items.extend(response["Items"])
        while "LastEvaluatedKey" in response:
            response = table.scan(
                FilterExpression=Attr("visibility").eq("public"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response["Items"])
        return items

    items = []
    response = table.query(
        IndexName="owner_sub-index",
        KeyConditionExpression=Key("owner_sub").eq(caller["sub"]),
    )
    items.extend(response["Items"])
    while "LastEvaluatedKey" in response:
        response = table.query(
            IndexName="owner_sub-index",
            KeyConditionExpression=Key("owner_sub").eq(caller["sub"]),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response["Items"])
    return items


def dedup_by_filename(items):
    """Keep one entry per filename — the one with the earliest uploaded_at.

    photo_processor uses uuid4() as PK so re-processing the same file creates
    duplicate rows.  Keeping the earliest preserves the original upload record.
    """
    seen = {}
    for item in items:
        fn = item.get("filename", "")
        if fn not in seen or item.get("uploaded_at", "") < seen[fn].get("uploaded_at", ""):
            seen[fn] = item
    return list(seen.values())


def enrich_with_urls(items):
    """Generate presigned URLs for a (small) page of items only."""
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
    params = event.get("queryStringParameters") or {}
    page  = max(int(params.get("page",  "0")),  0)
    limit = min(int(params.get("limit", str(DEFAULT_LIMIT))), MAX_LIMIT)

    caller = get_caller_info(event)
    if not caller["sub"] and "demo" not in caller["groups"]:
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Unauthorized"}),
        }

    items  = fetch_all_photos(caller)
    items  = dedup_by_filename(items)
    items.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)

    total    = len(items)
    start    = page * limit
    end      = start + limit
    has_more = end < total

    page_items = enrich_with_urls(items[start:end])

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(
            {
                "items":    page_items,
                "total":    total,
                "page":     page,
                "limit":    limit,
                "has_more": has_more,
            },
            default=str,
        ),
    }
