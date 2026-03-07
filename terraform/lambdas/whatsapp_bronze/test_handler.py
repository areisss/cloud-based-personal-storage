import os
import unittest
from unittest.mock import patch, MagicMock

# Set env vars before importing handler — they're read at module level.
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["BUCKET_NAME"] = "test-bucket"

from handler import is_valid_whatsapp_export, process_file, handler

# ------------------------------------------------------------------
# Fixtures — realistic WhatsApp export content for tests
# ------------------------------------------------------------------
VALID_EXPORT = """\
1/5/2024, 10:30 AM - Alice: Hello!
1/5/2024, 10:31 AM - Bob: Hi there!
1/5/2024, 10:32 AM - Alice: How are you?
"""

INVALID_EXPORT = """\
This is not a WhatsApp export.
Just some random text without timestamps.
"""

# Only one line matches — below the MIN_MATCHING_LINES threshold of 2.
ONE_MATCH = """\
1/5/2024, 10:30 AM - Alice: Hello!
This line does not match the pattern.
"""


# ------------------------------------------------------------------
# is_valid_whatsapp_export — pure function, no mocks needed
# ------------------------------------------------------------------
class TestIsValidWhatsappExport(unittest.TestCase):
    def test_valid_export_returns_true(self):
        self.assertTrue(is_valid_whatsapp_export(VALID_EXPORT))

    def test_invalid_export_returns_false(self):
        self.assertFalse(is_valid_whatsapp_export(INVALID_EXPORT))

    def test_one_matching_line_returns_false(self):
        # Requires at least 2 matching lines to guard against false positives.
        self.assertFalse(is_valid_whatsapp_export(ONE_MATCH))

    def test_empty_string_returns_false(self):
        self.assertFalse(is_valid_whatsapp_export(""))

    def test_two_digit_year_matches(self):
        content = "1/5/24, 10:30 AM - Alice: Hi\n1/6/24, 11:00 AM - Bob: Hey"
        self.assertTrue(is_valid_whatsapp_export(content))


# ------------------------------------------------------------------
# process_file — mocks S3 so we don't hit real AWS
# ------------------------------------------------------------------
class TestProcessFile(unittest.TestCase):
    @patch("handler.s3")
    def test_valid_file_is_copied_to_bronze(self, mock_s3):
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: VALID_EXPORT.encode("utf-8"))
        }

        process_file("raw-whatsapp-uploads/chat.txt", "chat.txt")

        mock_s3.copy_object.assert_called_once()
        call_kwargs = mock_s3.copy_object.call_args.kwargs
        # The destination key must contain the Hive-style partition path
        self.assertIn("bronze/whatsapp/year=2024/month=01/chat.txt", call_kwargs["Key"])

    @patch("handler.s3")
    def test_invalid_file_is_skipped(self, mock_s3):
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: INVALID_EXPORT.encode("utf-8"))
        }

        process_file("raw-whatsapp-uploads/random.txt", "random.txt")

        # Invalid exports must not be copied — no bronze record created.
        mock_s3.copy_object.assert_not_called()

    @patch("handler.s3")
    def test_month_is_zero_padded(self, mock_s3):
        # Month "1" should become "01" in the partition path.
        content = "1/5/2024, 10:30 AM - Alice: Hi\n1/6/2024, 11:00 AM - Bob: Hey"
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: content.encode("utf-8"))
        }

        process_file("raw-whatsapp-uploads/chat.txt", "chat.txt")

        key = mock_s3.copy_object.call_args.kwargs["Key"]
        self.assertIn("month=01", key)


# ------------------------------------------------------------------
# handler — tests the event loop over Records
# ------------------------------------------------------------------
class TestHandler(unittest.TestCase):
    @patch("handler.s3")
    def test_processes_all_records_in_event(self, mock_s3):
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=lambda: VALID_EXPORT.encode("utf-8"))
        }
        event = {
            "Records": [
                {"s3": {"object": {"key": "raw-whatsapp-uploads/chat1.txt"}}},
                {"s3": {"object": {"key": "raw-whatsapp-uploads/chat2.txt"}}},
            ]
        }

        handler(event, None)

        # One copy_object call per record
        self.assertEqual(mock_s3.copy_object.call_count, 2)


if __name__ == "__main__":
    unittest.main()
