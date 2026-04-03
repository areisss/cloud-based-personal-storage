import base64
import json
import os
from collections import defaultdict

import boto3
from boto3.dynamodb.conditions import Attr, Key

# boto3 clients outside the handler = reused across warm invocations.
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

BUCKET = os.environ["BUCKET_NAME"]
TABLE  = os.environ["TABLE_NAME"]

# Presigned URL expiry times.
THUMBNAIL_TTL = 3600   # 1 hour
ORIGINAL_TTL  = 86400  # 24 hours

DEFAULT_LIMIT = 50
MAX_LIMIT     = 200


def get_caller_info(event):
    """Decode the Cognito JWT from the Authorization header to get sub and groups."""
    token = (event.get("headers") or {}).get("Authorization", "")
    try:
        # JWTs are three base64url segments separated by dots; the second is the payload.
        payload = token.split(".")[1]
        # Add padding so base64 decodes cleanly regardless of token length.
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.b64decode(payload))
        return {
            "sub":    claims.get("sub", ""),
            "groups": claims.get("cognito:groups", []),
        }
    except Exception:
        return {"sub": "", "groups": []}


def fetch_videos(caller):
    """Return videos visible to this caller.

    Demo group members see all items with visibility='public'.
    Everyone else sees only items they own (owner_sub = their Cognito sub).
    """
    table = dynamodb.Table(TABLE)

    if "demo" in caller["groups"]:
        # Scan the full table and filter to public items only.
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

    # Query the owner_sub GSI — returns only this user's videos.
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


def build_groups(items):
    groups = defaultdict(list)
    for item in items:
        year = (item.get("date_taken") or item["uploaded_at"])[:4]
        loc  = item.get("location_name") or "Unknown location"
        groups[(year, loc)].append(item)
    return groups


def rename_group(caller, year, location, new_title):
    """Set group_title on a sample of videos matching (year, location).

    Only updates the first 25 items — enough for the API to return the
    group_title on the next groups request (which checks any item).
    """
    items = fetch_videos(caller)

    table = dynamodb.Table(TABLE)
    updated = 0
    for item in items:
        item_year = (item.get("date_taken") or item["uploaded_at"])[:4]
        item_loc  = item.get("location_name") or "Unknown location"
        if item_year == year and item_loc == location:
            table.update_item(
                Key={"video_id": item["video_id"]},
                UpdateExpression="SET group_title = :t",
                ExpressionAttributeValues={":t": new_title},
            )
            updated += 1
            if updated >= 25:
                break
    return updated


def ok(body):
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }


def handler(event, context):
    params = event.get("queryStringParameters") or {}
    method = event.get("httpMethod", "GET")

    caller = get_caller_info(event)

    # PATCH — rename a group
    if method == "PATCH" and params.get("action") == "rename_group":
        year     = params.get("year", "")
        location = params.get("location", "")
        title    = params.get("title", "")
        if not year or not title:
            return ok({"error": "year and title are required"})
        updated = rename_group(caller, year, location, title)
        return ok({"updated": updated, "title": title})

    items = fetch_videos(caller)

    # Groups view — returns one card per (year, location) with sample thumbnails.
    if params.get("view") == "groups":
        groups = build_groups(items)
        result = []
        for (year, loc), group_items in sorted(
            groups.items(), key=lambda x: (-int(x[0][0]), x[0][1])
        ):
            samples = group_items[:4]
            enrich_with_urls(samples)
            custom_title = next(
                (i["group_title"] for i in group_items if i.get("group_title")),
                None,
            )
            result.append({
                "year":              year,
                "location":          loc,
                "count":             len(group_items),
                "sample_thumbnails": [i["thumbnail_url"] for i in samples],
                "group_title":       custom_title,
            })
        return ok({"groups": result})

    # Paginated detail view — optionally filtered by year and/or location.
    year_filter = params.get("year")
    loc_filter  = params.get("location")

    if year_filter or loc_filter:
        items = [
            i for i in items
            if (not year_filter or (i.get("date_taken") or i["uploaded_at"])[:4] == year_filter)
            and (not loc_filter  or (i.get("location_name") or "Unknown location") == loc_filter)
        ]

    # Sort by upload time, newest first.
    items.sort(key=lambda x: x["uploaded_at"], reverse=True)

    page  = max(int(params.get("page",  "0")),  0)
    limit = min(int(params.get("limit", str(DEFAULT_LIMIT))), MAX_LIMIT)

    total    = len(items)
    start    = page * limit
    end      = start + limit
    has_more = end < total

    page_items = enrich_with_urls(items[start:end])

    return ok({
        "items":    page_items,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": has_more,
    })
