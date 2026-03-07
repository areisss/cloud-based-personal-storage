import json
import os
import unittest
from decimal import Decimal
from unittest.mock import patch, MagicMock

# Set env vars before importing handler — they're read at module level.
# AWS_DEFAULT_REGION is needed because boto3.resource("dynamodb") requires a region.
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["BUCKET_NAME"] = "test-bucket"
os.environ["TABLE_NAME"] = "test-table"

from handler import scan_all_photos, enrich_with_urls, handler


# ------------------------------------------------------------------
# scan_all_photos — DynamoDB scan with pagination
# ------------------------------------------------------------------
class TestScanAllPhotos(unittest.TestCase):
    @patch("handler.dynamodb")
    def test_returns_all_items_single_page(self, mock_dynamodb):
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.scan.return_value = {
            "Items": [{"photo_id": "abc", "uploaded_at": "2024-01-01T00:00:00+00:00"}]
        }

        items = scan_all_photos()

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["photo_id"], "abc")

    @patch("handler.dynamodb")
    def test_paginates_when_last_evaluated_key_present(self, mock_dynamodb):
        # DynamoDB returns at most 1 MB per scan call. When there's more data,
        # it includes LastEvaluatedKey and we must pass it as ExclusiveStartKey.
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.scan.side_effect = [
            {"Items": [{"photo_id": "a"}], "LastEvaluatedKey": {"photo_id": "a"}},
            {"Items": [{"photo_id": "b"}]},
        ]

        items = scan_all_photos()

        self.assertEqual(len(items), 2)
        self.assertEqual(mock_table.scan.call_count, 2)
        # Second call must pass ExclusiveStartKey to continue from page 1
        second_call_kwargs = mock_table.scan.call_args_list[1].kwargs
        self.assertEqual(second_call_kwargs["ExclusiveStartKey"], {"photo_id": "a"})

    @patch("handler.dynamodb")
    def test_returns_empty_list_for_empty_table(self, mock_dynamodb):
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.scan.return_value = {"Items": []}

        items = scan_all_photos()

        self.assertEqual(items, [])


# ------------------------------------------------------------------
# enrich_with_urls — presigned URL generation
# ------------------------------------------------------------------
class TestEnrichWithUrls(unittest.TestCase):
    @patch("handler.s3")
    def test_adds_thumbnail_and_original_urls(self, mock_s3):
        # Return a URL that contains the S3 key so we can assert correctness.
        mock_s3.generate_presigned_url.side_effect = (
            lambda op, Params, ExpiresIn: f"https://s3.example.com/{Params['Key']}"
        )
        items = [{
            "thumbnail_key": "photos/thumbnails/a.jpg",
            "original_key":  "photos/originals/a.jpg",
        }]

        enriched = enrich_with_urls(items)

        self.assertIn("thumbnail_url", enriched[0])
        self.assertIn("original_url", enriched[0])
        self.assertIn("thumbnails/a.jpg", enriched[0]["thumbnail_url"])
        self.assertIn("originals/a.jpg",  enriched[0]["original_url"])

    @patch("handler.s3")
    def test_thumbnail_ttl_shorter_than_original_ttl(self, mock_s3):
        # Thumbnails are loaded immediately (short TTL).
        # Originals are downloaded later (long TTL). Verify the difference.
        captured = []
        mock_s3.generate_presigned_url.side_effect = (
            lambda op, Params, ExpiresIn: captured.append(ExpiresIn) or "https://s3.example.com/x"
        )
        enrich_with_urls([{
            "thumbnail_key": "photos/thumbnails/a.jpg",
            "original_key":  "photos/originals/a.jpg",
        }])

        thumbnail_ttl, original_ttl = captured
        self.assertLess(thumbnail_ttl, original_ttl)


# ------------------------------------------------------------------
# handler — end-to-end Lambda response shape
# ------------------------------------------------------------------
class TestHandler(unittest.TestCase):
    def _make_item(self, photo_id, uploaded_at):
        return {
            "photo_id":      photo_id,
            "uploaded_at":   uploaded_at,
            "thumbnail_key": f"photos/thumbnails/{photo_id}.jpg",
            "original_key":  f"photos/originals/{photo_id}.jpg",
        }

    @patch("handler.s3")
    @patch("handler.dynamodb")
    def test_returns_200_with_cors_header(self, mock_dynamodb, mock_s3):
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.scan.return_value = {"Items": [self._make_item("1", "2024-01-01T00:00:00+00:00")]}
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/x"

        response = handler({}, None)

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["headers"]["Access-Control-Allow-Origin"], "*")

    @patch("handler.s3")
    @patch("handler.dynamodb")
    def test_items_sorted_newest_first(self, mock_dynamodb, mock_s3):
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        # Older item first in the table — handler should reverse the order.
        mock_table.scan.return_value = {
            "Items": [
                self._make_item("old", "2024-01-01T00:00:00+00:00"),
                self._make_item("new", "2024-06-01T00:00:00+00:00"),
            ]
        }
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/x"

        response = handler({}, None)
        body = json.loads(response["body"])

        self.assertEqual(body[0]["photo_id"], "new")
        self.assertEqual(body[1]["photo_id"], "old")

    @patch("handler.s3")
    @patch("handler.dynamodb")
    def test_decimal_values_serialized_without_error(self, mock_dynamodb, mock_s3):
        # DynamoDB returns numeric values as Python Decimal. json.dumps can't
        # handle Decimal by default — the handler uses default=str to fix this.
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        item = self._make_item("1", "2024-01-01T00:00:00+00:00")
        item["size_bytes"] = Decimal("204800")
        mock_table.scan.return_value = {"Items": [item]}
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/x"

        response = handler({}, None)

        # Should not raise — if Decimal is not handled, json.dumps throws TypeError
        body = json.loads(response["body"])
        self.assertIsInstance(body, list)
        self.assertEqual(body[0]["size_bytes"], "204800")


if __name__ == "__main__":
    unittest.main()
