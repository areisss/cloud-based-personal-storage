import json
import os
import unittest
from unittest.mock import patch, MagicMock, call

# Set env vars before importing handler — they're read at module level.
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["BUCKET_NAME"]   = "test-bucket"
os.environ["DATABASE_NAME"] = "test-database"
os.environ["WORKGROUP"]     = "test-workgroup"

from handler import build_query, fetch_results, handler


# ------------------------------------------------------------------
# build_query — pure function, no mocks needed
# ------------------------------------------------------------------
class TestBuildQuery(unittest.TestCase):
    def test_base_query_selects_required_columns(self):
        sql = build_query({})
        self.assertIn("SELECT", sql)
        self.assertIn("date", sql)
        self.assertIn("sender", sql)
        self.assertIn("message", sql)

    def test_no_extra_and_clauses_without_filters(self):
        sql = build_query({})
        # The base query has "WHERE 1=1" — no user-driven AND conditions.
        self.assertEqual(sql.count("AND"), 0)

    def test_date_filter_adds_equality_clause(self):
        sql = build_query({"date": "2024-01-05"})
        self.assertIn("date = '2024-01-05'", sql)

    def test_sender_filter_uses_like_for_partial_match(self):
        sql = build_query({"sender": "Alice"})
        self.assertIn("LIKE", sql)
        self.assertIn("Alice", sql)

    def test_search_filter_applies_to_message_column(self):
        sql = build_query({"search": "hello"})
        self.assertIn("message", sql)
        self.assertIn("hello", sql)

    def test_limit_appended_as_integer(self):
        sql = build_query({"limit": "10"})
        self.assertIn("LIMIT 10", sql)

    def test_multiple_filters_all_present(self):
        sql = build_query({"date": "2024-01-05", "sender": "Bob", "limit": "5"})
        self.assertIn("2024-01-05", sql)
        self.assertIn("Bob", sql)
        self.assertIn("LIMIT 5", sql)

    def test_results_ordered_by_date_and_time(self):
        sql = build_query({})
        self.assertIn("ORDER BY date, time", sql)


# ------------------------------------------------------------------
# fetch_results — maps Athena row data to dicts
# ------------------------------------------------------------------
class TestFetchResults(unittest.TestCase):
    @patch("handler.athena")
    def test_maps_rows_to_dicts_using_header_row(self, mock_athena):
        # Athena result format: first row is headers, subsequent rows are data.
        mock_paginator = MagicMock()
        mock_athena.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [{
            "ResultSet": {
                "Rows": [
                    {"Data": [{"VarCharValue": "date"}, {"VarCharValue": "sender"}, {"VarCharValue": "message"}]},
                    {"Data": [{"VarCharValue": "2024-01-05"}, {"VarCharValue": "Alice"}, {"VarCharValue": "Hello!"}]},
                    {"Data": [{"VarCharValue": "2024-01-05"}, {"VarCharValue": "Bob"}, {"VarCharValue": "Hi!"}]},
                ]
            }
        }]

        rows = fetch_results("query-id-123")

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0], {"date": "2024-01-05", "sender": "Alice", "message": "Hello!"})
        self.assertEqual(rows[1], {"date": "2024-01-05", "sender": "Bob",   "message": "Hi!"})

    @patch("handler.athena")
    def test_returns_empty_list_when_only_header_row(self, mock_athena):
        mock_paginator = MagicMock()
        mock_athena.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [{
            "ResultSet": {
                "Rows": [
                    {"Data": [{"VarCharValue": "date"}, {"VarCharValue": "sender"}]}
                ]
            }
        }]

        rows = fetch_results("query-id-empty")

        self.assertEqual(rows, [])


# ------------------------------------------------------------------
# handler — end-to-end response and error handling
# ------------------------------------------------------------------
class TestHandler(unittest.TestCase):
    def _mock_athena_success(self, mock_athena, messages):
        """Configure mock_athena to simulate a successful Athena query."""
        mock_athena.start_query_execution.return_value = {"QueryExecutionId": "qid-1"}
        mock_athena.get_query_execution.return_value = {
            "QueryExecution": {"Status": {"State": "SUCCEEDED"}}
        }
        # Build Athena row format from message dicts
        if messages:
            headers = list(messages[0].keys())
            header_row = {"Data": [{"VarCharValue": h} for h in headers]}
            data_rows  = [
                {"Data": [{"VarCharValue": str(m[h])} for h in headers]}
                for m in messages
            ]
            rows = [header_row] + data_rows
        else:
            rows = [{"Data": [{"VarCharValue": "date"}, {"VarCharValue": "sender"}]}]

        mock_paginator = MagicMock()
        mock_athena.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [{"ResultSet": {"Rows": rows}}]

    @patch("handler.time")
    @patch("handler.athena")
    def test_returns_200_with_messages(self, mock_athena, mock_time):
        self._mock_athena_success(mock_athena, [
            {"date": "2024-01-05", "sender": "Alice", "message": "Hello!"}
        ])

        response = handler({"queryStringParameters": None}, None)

        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["sender"], "Alice")

    @patch("handler.time")
    @patch("handler.athena")
    def test_cors_header_present(self, mock_athena, mock_time):
        self._mock_athena_success(mock_athena, [])

        response = handler({"queryStringParameters": None}, None)

        self.assertEqual(response["headers"]["Access-Control-Allow-Origin"], "*")

    @patch("handler.time")
    @patch("handler.athena")
    def test_returns_500_when_query_fails(self, mock_athena, mock_time):
        mock_athena.start_query_execution.return_value = {"QueryExecutionId": "qid-fail"}
        mock_athena.get_query_execution.return_value = {
            "QueryExecution": {
                "Status": {"State": "FAILED", "StateChangeReason": "syntax error"}
            }
        }

        response = handler({"queryStringParameters": None}, None)

        self.assertEqual(response["statusCode"], 500)
        body = json.loads(response["body"])
        self.assertIn("error", body)

    @patch("handler.time")
    @patch("handler.athena")
    def test_passes_query_params_to_build_query(self, mock_athena, mock_time):
        self._mock_athena_success(mock_athena, [])
        event = {"queryStringParameters": {"sender": "Bob", "date": "2024-01-05"}}

        handler(event, None)

        sql = mock_athena.start_query_execution.call_args.kwargs["QueryString"]
        self.assertIn("Bob", sql)
        self.assertIn("2024-01-05", sql)


if __name__ == "__main__":
    unittest.main()
