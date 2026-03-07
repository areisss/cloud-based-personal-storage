# Upload the Glue job script to S3 — Glue reads it from there at runtime.
# The script lives in source control but runs in AWS.
resource "aws_s3_object" "glue_job_script" {
  bucket = var.bucket_name
  key    = "glue-scripts/whatsapp_silver.py"
  source = "${path.root}/glue_jobs/whatsapp_silver/job.py"
  etag   = filemd5("${path.root}/glue_jobs/whatsapp_silver/job.py")
}

# IAM role for Glue — separate from the Lambda role.
# Glue needs its own role because it requires different permissions
# (Glue catalog read/write) and a different trust policy (glue.amazonaws.com).
data "aws_iam_policy_document" "glue_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["glue.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "glue" {
  name               = "${var.project_name}-glue-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.glue_assume_role.json
}

# AWSGlueServiceRole gives Glue access to CloudWatch logs and basic Glue API calls.
resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

# Custom policy: Glue needs S3 read/write for the data bucket and Athena result bucket.
data "aws_iam_policy_document" "glue_s3" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [var.bucket_arn, "${var.bucket_arn}/*"]
  }
}

resource "aws_iam_policy" "glue_s3" {
  name   = "${var.project_name}-glue-s3-${var.environment}"
  policy = data.aws_iam_policy_document.glue_s3.json
}

resource "aws_iam_role_policy_attachment" "glue_s3" {
  role       = aws_iam_role.glue.name
  policy_arn = aws_iam_policy.glue_s3.arn
}

# Glue catalog database — a namespace for all tables in this project.
resource "aws_glue_catalog_database" "main" {
  name = "${var.project_name}-${var.environment}"
}

# The Glue Python Shell job — runs on a single small DPU (0.0625 is the minimum).
# Python Shell is simpler than Spark for single-node data tasks like this one.
resource "aws_glue_job" "whatsapp_silver" {
  name         = "${var.project_name}-whatsapp-silver-${var.environment}"
  role_arn     = aws_iam_role.glue.arn
  glue_version = "3.0"

  command {
    name            = "pythonshell"
    python_version  = "3"
    script_location = "s3://${var.bucket_name}/glue-scripts/whatsapp_silver.py"
  }

  default_arguments = {
    "--BUCKET_NAME"   = var.bucket_name
    "--DATABASE_NAME" = aws_glue_catalog_database.main.name
    # awswrangler is available as a built-in library in Glue Python Shell
    "--additional-python-modules" = "awswrangler"
  }

  max_capacity = 0.0625  # minimum DPU — cheapest option for small jobs

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Athena workgroup — isolates query results and costs for this project.
# Results are written to S3 so you can retrieve them after the query completes.
resource "aws_athena_workgroup" "main" {
  name = "${var.project_name}-${var.environment}"

  configuration {
    result_configuration {
      output_location = "s3://${var.bucket_name}/athena-results/"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
