# --- Static website hosting bucket ---

# This bucket serves the compiled React app publicly.
# It is separate from the Amplify data bucket — one bucket for app code,
# one for data. This keeps IAM policies and access patterns clean.
resource "aws_s3_bucket" "website" {
  bucket = "${var.project_name}-website-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Static website hosting turns the bucket into an HTTP server.
# index_document is served for / and any path without a file extension.
# error_document is served for 404s — pointing to index.html lets
# React Router handle unknown paths client-side.
resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  index_document { suffix = "index.html" }
  error_document { key    = "index.html" }
}

# Static websites must allow public reads — disable the block.
resource "aws_s3_bucket_public_access_block" "website" {
  bucket                  = aws_s3_bucket.website.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Bucket policy: allow anyone to GET objects (read the app files).
# Without this, the browser would get a 403 when loading index.html.
resource "aws_s3_bucket_policy" "website" {
  bucket     = aws_s3_bucket.website.id
  depends_on = [aws_s3_bucket_public_access_block.website]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.website.arn}/*"
    }]
  })
}

# --- DynamoDB ---

resource "aws_dynamodb_table" "photo_metadata" {
  name         = "${var.project_name}-photo-metadata-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "photo_id"

  attribute {
    name = "photo_id"
    type = "S"
  }

  attribute {
    name = "owner_sub"
    type = "S"
  }

  global_secondary_index {
    name            = "owner_sub-index"
    hash_key        = "owner_sub"
    projection_type = "ALL"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_dynamodb_table" "video_metadata" {
  name         = "${var.project_name}-video-metadata-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "video_id"

  attribute {
    name = "video_id"
    type = "S"
  }

  attribute {
    name = "owner_sub"
    type = "S"
  }

  global_secondary_index {
    name            = "owner_sub-index"
    hash_key        = "owner_sub"
    projection_type = "ALL"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
