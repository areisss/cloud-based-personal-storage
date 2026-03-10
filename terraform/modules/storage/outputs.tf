output "website_bucket_name" {
  value = aws_s3_bucket.website.bucket
}

# The S3 website endpoint — the URL where the React app is accessible.
# Format: <bucket>.s3-website-<region>.amazonaws.com
output "website_url" {
  value = aws_s3_bucket_website_configuration.website.website_endpoint
}

output "photo_metadata_table_name" {
  value = aws_dynamodb_table.photo_metadata.name
}

output "photo_metadata_table_arn" {
  value = aws_dynamodb_table.photo_metadata.arn
}

output "video_metadata_table_name" {
  value = aws_dynamodb_table.video_metadata.name
}

output "video_metadata_table_arn" {
  value = aws_dynamodb_table.video_metadata.arn
}
