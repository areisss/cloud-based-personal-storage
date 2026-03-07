variable "project_name" {
  description = "Project name prefix"
}

variable "environment" {
  description = "Deployment environment"
}

variable "bucket_name" {
  description = "S3 bucket name for data and Glue job script"
}

variable "bucket_arn" {
  description = "ARN of the S3 bucket"
}
