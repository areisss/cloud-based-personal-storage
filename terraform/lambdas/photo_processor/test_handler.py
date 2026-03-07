import io
import os
import unittest
from unittest.mock import patch, MagicMock

# Set env vars before importing handler — they're read at module level.
# AWS_DEFAULT_REGION is required by boto3.resource("dynamodb") at import time.
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["BUCKET_NAME"] = "test-bucket"
os.environ["TABLE_NAME"] = "test-table"

# PIL is installed locally (pip install Pillow), so we import handler directly
# without mocking PIL. The manylinux-compiled package/ copy is only needed on Lambda.
from handler import process_photo, handler as lambda_handler
from PIL import Image as PILImage


# ------------------------------------------------------------------
# Image fixtures — real Pillow images, no mocks needed for PIL
# ------------------------------------------------------------------

def make_jpeg_bytes(width=800, height=600):
    """Create a minimal JPEG image as bytes for use as fake S3 content."""
    img = PILImage.new("RGB", (width, height), color=(200, 150, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def make_rgba_png_bytes(width=400, height=300):
    """Create a minimal RGBA PNG image as bytes."""
    img = PILImage.new("RGBA", (width, height), color=(200, 150, 100, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ------------------------------------------------------------------
# process_photo — core logic: S3 upload + DynamoDB write
# ------------------------------------------------------------------

class TestProcessPhoto(unittest.TestCase):

    @patch("handler.dynamodb")
    @patch("handler.s3")
    def test_jpeg_writes_original_and_thumbnail_to_s3(self, mock_s3, mock_dynamodb):
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: make_jpeg_bytes()),
            "ContentType": "image/jpeg",
        }
        mock_dynamodb.Table.return_value = MagicMock()

        process_photo("raw-photos/photo.jpg", "photo.jpg")

        # Exactly two put_object calls: one for original, one for thumbnail.
        self.assertEqual(mock_s3.put_object.call_count, 2)
        keys = [c.kwargs["Key"] for c in mock_s3.put_object.call_args_list]
        self.assertIn("photos/originals/photo.jpg",  keys)
        self.assertIn("photos/thumbnails/photo.jpg", keys)

    @patch("handler.dynamodb")
    @patch("handler.s3")
    def test_writes_metadata_to_dynamodb(self, mock_s3, mock_dynamodb):
        jpeg = make_jpeg_bytes(1920, 1080)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: jpeg),
            "ContentType": "image/jpeg",
        }
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        process_photo("raw-photos/vacation.jpg", "vacation.jpg")

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs["Item"]

        self.assertEqual(item["filename"],     "vacation.jpg")
        self.assertEqual(item["width"],        1920)
        self.assertEqual(item["height"],       1080)
        self.assertEqual(item["size_bytes"],   len(jpeg))
        self.assertEqual(item["content_type"], "image/jpeg")
        # photo_id must be a UUID string (non-empty)
        self.assertIn("photo_id", item)
        self.assertTrue(len(item["photo_id"]) > 0)
        # uploaded_at must be an ISO 8601 string
        self.assertIn("T", item["uploaded_at"])

    @patch("handler.dynamodb")
    @patch("handler.s3")
    def test_rgba_png_is_handled_without_error(self, mock_s3, mock_dynamodb):
        # PNGs with transparency are RGBA. The handler converts to RGB before
        # saving the thumbnail so Pillow doesn't raise an error.
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: make_rgba_png_bytes()),
            "ContentType": "image/png",
        }
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        # Should not raise a PIL error about saving RGBA as JPEG
        process_photo("raw-photos/transparent.png", "transparent.png")

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs["Item"]
        self.assertEqual(item["content_type"], "image/png")

    @patch("handler.dynamodb")
    @patch("handler.s3")
    def test_thumbnail_is_at_most_300px(self, mock_s3, mock_dynamodb):
        # A large image should produce a thumbnail ≤ 300px on both sides.
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: make_jpeg_bytes(2000, 1500)),
            "ContentType": "image/jpeg",
        }
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        process_photo("raw-photos/large.jpg", "large.jpg")

        # Find the thumbnail put_object call and decode the body to verify size.
        thumbnail_call = next(
            c for c in mock_s3.put_object.call_args_list
            if "thumbnails" in c.kwargs["Key"]
        )
        thumbnail_bytes = thumbnail_call.kwargs["Body"].getvalue()
        thumb_img = PILImage.open(io.BytesIO(thumbnail_bytes))
        self.assertLessEqual(thumb_img.width,  300)
        self.assertLessEqual(thumb_img.height, 300)


# ------------------------------------------------------------------
# handler — event routing
# ------------------------------------------------------------------

class TestHandler(unittest.TestCase):

    @patch("handler.process_photo")
    def test_calls_process_photo_for_each_record(self, mock_process):
        event = {
            "Records": [
                {"s3": {"object": {"key": "raw-photos/a.jpg"}}},
                {"s3": {"object": {"key": "raw-photos/b.jpg"}}},
            ]
        }

        lambda_handler(event, None)

        self.assertEqual(mock_process.call_count, 2)
        mock_process.assert_any_call("raw-photos/a.jpg", "a.jpg")
        mock_process.assert_any_call("raw-photos/b.jpg", "b.jpg")

    @patch("handler.process_photo")
    def test_extracts_filename_from_s3_key(self, mock_process):
        # The filename is the last segment of the S3 key (after the last /).
        event = {
            "Records": [{"s3": {"object": {"key": "raw-photos/2024/summer/beach.jpg"}}}]
        }

        lambda_handler(event, None)

        mock_process.assert_called_once_with(
            "raw-photos/2024/summer/beach.jpg", "beach.jpg"
        )


if __name__ == "__main__":
    unittest.main()
