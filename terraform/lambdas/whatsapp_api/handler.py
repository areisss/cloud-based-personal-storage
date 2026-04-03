import base64
import json
import os
import time

import boto3

athena = boto3.client("athena")

BUCKET     = os.environ["BUCKET_NAME"]
DATABASE   = os.environ["DATABASE_NAME"]
WORKGROUP  = os.environ["WORKGROUP"]

# Athena is async — you submit a query, then poll until it finishes.
# This controls how long to wait between polls and the maximum wait time.
POLL_INTERVAL_SECONDS = 1
MAX_WAIT_SECONDS      = 30


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


def build_query(params, caller):
    # Base query — always returns these columns sorted by date and time
    query = """
        SELECT date, time, sender, message, word_count
        FROM whatsapp_messages
        WHERE 1=1
    """

    # Scope results to the caller's identity:
    # - demo users see only the curated demo rows
    # - real users see only their own messages (matched by Cognito sub)
    if "demo" in caller["groups"]:
        query += " AND owner_sub = 'demo'"
    else:
        query += f" AND owner_sub = '{caller['sub']}'"

    # Each filter is appended only if the param was provided.
    if params.get("date"):
        query += f" AND date = '{params['date']}'"

    if params.get("sender"):
        # LIKE with % allows partial matches e.g. "Jo" matches "John"
        query += f" AND LOWER(sender) LIKE LOWER('%{params['sender']}%')"

    if params.get("search"):
        query += f" AND LOWER(message) LIKE LOWER('%{params['search']}%')"

    query += " ORDER BY date, time"

    if params.get("limit"):
        query += f" LIMIT {int(params['limit'])}"

    return query


def run_query(sql):
    # start_query_execution submits the query and returns immediately
    # with a query execution ID — the query runs asynchronously in Athena.
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": DATABASE},
        ResultConfiguration={
            "OutputLocation": f"s3://{BUCKET}/athena-results/"
        },
        WorkGroup=WORKGROUP,
    )
    query_id = response["QueryExecutionId"]

    # Poll until the query succeeds, fails, or we hit the timeout.
    elapsed = 0
    while elapsed < MAX_WAIT_SECONDS:
        status = athena.get_query_execution(QueryExecutionId=query_id)
        state = status["QueryExecution"]["Status"]["State"]

        if state == "SUCCEEDED":
            return query_id
        if state in ("FAILED", "CANCELLED"):
            reason = status["QueryExecution"]["Status"].get("StateChangeReason", "unknown")
            raise RuntimeError(f"Athena query {state}: {reason}")

        time.sleep(POLL_INTERVAL_SECONDS)
        elapsed += POLL_INTERVAL_SECONDS

    raise RuntimeError("Athena query timed out")


def fetch_results(query_id):
    # get_query_results returns paginated results.
    # The first row is always the column headers — we use it to build dicts.
    rows = []
    paginator = athena.get_paginator("get_query_results")

    headers = None
    for page in paginator.paginate(QueryExecutionId=query_id):
        for i, row in enumerate(page["ResultSet"]["Rows"]):
            values = [col.get("VarCharValue", "") for col in row["Data"]]
            if headers is None:
                # First row across all pages is the header
                headers = values
            else:
                rows.append(dict(zip(headers, values)))

    return rows


def handler(event, context):
    # API Gateway passes query string params under queryStringParameters.
    # It's None if no params were provided — default to empty dict.
    params = event.get("queryStringParameters") or {}
    caller = get_caller_info(event)

    sql = build_query(params, caller)

    try:
        query_id = run_query(sql)
        messages = fetch_results(query_id)
    except RuntimeError as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(messages),
    }
