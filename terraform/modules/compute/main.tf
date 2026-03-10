data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.project_name}-lambda-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_s3_dynamodb" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = [
      var.bucket_arn,
      "${var.bucket_arn}/*",
    ]
  }

  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [var.dynamodb_arn, var.video_dynamodb_arn]
  }

  # Athena permissions for whatsapp_api Lambda.
  # glue:GetTable/GetPartitions are needed because Athena reads the Glue catalog
  # to understand the table schema and partition layout before running the query.
  statement {
    actions = [
      "athena:StartQueryExecution",
      "athena:GetQueryExecution",
      "athena:GetQueryResults",
      "athena:StopQueryExecution",
      "glue:GetDatabase",
      "glue:GetTable",
      "glue:GetPartitions",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "lambda_s3_dynamodb" {
  name   = "${var.project_name}-lambda-s3-dynamodb-${var.environment}"
  policy = data.aws_iam_policy_document.lambda_s3_dynamodb.json
}

resource "aws_iam_role_policy_attachment" "lambda_s3_dynamodb" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda_s3_dynamodb.arn
}

# terraform_data is built into Terraform 1.4+ — no external provider needed.
# triggers_replace re-runs the provisioner whenever handler.py changes.
resource "terraform_data" "build_photo_processor" {
  triggers_replace = filemd5("${path.root}/lambdas/photo_processor/handler.py")

  provisioner "local-exec" {
    command = <<-EOT
      python3 -m pip install pillow \
        --index-url https://pypi.org/simple/ \
        --platform manylinux_2_28_x86_64 \
        --implementation cp \
        --python-version 312 \
        --abi cp312 \
        --only-binary=:all: \
        --target ${path.root}/lambdas/photo_processor/package \
        --upgrade --quiet && \
      cp ${path.root}/lambdas/photo_processor/handler.py \
         ${path.root}/lambdas/photo_processor/package/handler.py
    EOT
  }
}

data "archive_file" "photo_processor" {
  depends_on  = [terraform_data.build_photo_processor]
  type        = "zip"
  source_dir  = "${path.root}/lambdas/photo_processor/package"
  output_path = "${path.root}/lambdas/photo_processor/handler.zip"
}

resource "aws_lambda_function" "photo_processor" {
  filename         = data.archive_file.photo_processor.output_path
  function_name    = "${var.project_name}-photo-processor-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  architectures    = ["x86_64"]
  source_code_hash = data.archive_file.photo_processor.output_base64sha256
  timeout          = 60
  memory_size      = 512

  environment {
    variables = {
      BUCKET_NAME = var.bucket_id
      TABLE_NAME  = var.dynamodb_table_name
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "s3_invoke_photo_processor" {
  statement_id  = "AllowS3InvokePhotoProcessor"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.photo_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.bucket_arn
}

# archive_file zips the handler directly — no build step needed since photos_api
# has no external dependencies beyond boto3, which is already available in Lambda.
data "archive_file" "photos_api" {
  type        = "zip"
  source_file = "${path.root}/lambdas/photos_api/handler.py"
  output_path = "${path.root}/lambdas/photos_api/handler.zip"
}

resource "aws_lambda_function" "photos_api" {
  filename         = data.archive_file.photos_api.output_path
  function_name    = "${var.project_name}-photos-api-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.photos_api.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      BUCKET_NAME = var.bucket_id
      TABLE_NAME  = var.dynamodb_table_name
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# --- Video Processor Lambda ---

# Download a static FFmpeg + ffprobe binary for Linux x86_64 and bundle them
# inside the Lambda package. Same pattern as the Pillow build for photo_processor.
# triggers_replace re-runs the build whenever handler.py changes.
resource "terraform_data" "build_video_processor" {
  triggers_replace = filemd5("${path.root}/lambdas/video_processor/handler.py")

  provisioner "local-exec" {
    command = <<-EOT
      mkdir -p ${path.root}/lambdas/video_processor/package/bin /tmp/ffmpeg-extract && \
      curl -L -o /tmp/ffmpeg-amd64.tar.xz \
        "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" && \
      tar -xJf /tmp/ffmpeg-amd64.tar.xz -C /tmp/ffmpeg-extract --strip-components=1 && \
      cp /tmp/ffmpeg-extract/ffmpeg  ${path.root}/lambdas/video_processor/package/bin/ffmpeg && \
      cp /tmp/ffmpeg-extract/ffprobe ${path.root}/lambdas/video_processor/package/bin/ffprobe && \
      chmod +x \
        ${path.root}/lambdas/video_processor/package/bin/ffmpeg \
        ${path.root}/lambdas/video_processor/package/bin/ffprobe && \
      cp ${path.root}/lambdas/video_processor/handler.py \
         ${path.root}/lambdas/video_processor/package/handler.py
    EOT
  }
}

data "archive_file" "video_processor" {
  depends_on  = [terraform_data.build_video_processor]
  type        = "zip"
  source_dir  = "${path.root}/lambdas/video_processor/package"
  output_path = "${path.root}/lambdas/video_processor/handler.zip"
}

resource "aws_lambda_function" "video_processor" {
  filename         = data.archive_file.video_processor.output_path
  function_name    = "${var.project_name}-video-processor-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  architectures    = ["x86_64"]
  source_code_hash = data.archive_file.video_processor.output_base64sha256
  timeout          = 120
  memory_size      = 512

  # Extra /tmp space for large video files (default is 512 MB).
  ephemeral_storage {
    size = 2048
  }

  environment {
    variables = {
      BUCKET_NAME = var.bucket_id
      TABLE_NAME  = var.video_dynamodb_table_name
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "s3_invoke_video_processor" {
  statement_id  = "AllowS3InvokeVideoProcessor"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.video_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.bucket_arn
}

# archive_file zips the handler directly — no build step needed since videos_api
# has no external dependencies beyond boto3, which is already available in Lambda.
data "archive_file" "videos_api" {
  type        = "zip"
  source_file = "${path.root}/lambdas/videos_api/handler.py"
  output_path = "${path.root}/lambdas/videos_api/handler.zip"
}

resource "aws_lambda_function" "videos_api" {
  filename         = data.archive_file.videos_api.output_path
  function_name    = "${var.project_name}-videos-api-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.videos_api.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      BUCKET_NAME = var.bucket_id
      TABLE_NAME  = var.video_dynamodb_table_name
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "apigw_invoke_videos_api" {
  statement_id  = "AllowAPIGatewayInvokeVideosApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.videos_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# /videos resource on the same API Gateway
resource "aws_api_gateway_resource" "videos" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "videos"
}

resource "aws_api_gateway_method" "videos_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.videos.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "videos_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.videos.id
  http_method             = aws_api_gateway_method.videos_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.videos_api.invoke_arn
}

resource "aws_api_gateway_method" "videos_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.videos.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "videos_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.videos.id
  http_method = aws_api_gateway_method.videos_options.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "videos_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.videos.id
  http_method = aws_api_gateway_method.videos_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "videos_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.videos.id
  http_method = aws_api_gateway_method.videos_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.videos_options]
}

# Separate deployment and stage for /videos, following the same pattern as /chats.
resource "aws_api_gateway_deployment" "videos" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  depends_on = [
    aws_api_gateway_integration.videos_get,
    aws_api_gateway_integration_response.videos_options,
  ]
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "videos" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  deployment_id = aws_api_gateway_deployment.videos.id
  stage_name    = "${var.environment}-videos"
}

# --- WhatsApp API Lambda ---

data "archive_file" "whatsapp_api" {
  type        = "zip"
  source_file = "${path.root}/lambdas/whatsapp_api/handler.py"
  output_path = "${path.root}/lambdas/whatsapp_api/handler.zip"
}

resource "aws_lambda_function" "whatsapp_api" {
  filename         = data.archive_file.whatsapp_api.output_path
  function_name    = "${var.project_name}-whatsapp-api-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.whatsapp_api.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      BUCKET_NAME   = var.bucket_id
      DATABASE_NAME = var.glue_database_name
      WORKGROUP     = var.athena_workgroup
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "apigw_invoke_whatsapp_api" {
  statement_id  = "AllowAPIGatewayInvokeWhatsappApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.whatsapp_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# /chats resource on the same API Gateway
resource "aws_api_gateway_resource" "chats" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "chats"
}

resource "aws_api_gateway_method" "chats_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.chats.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "chats_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.chats.id
  http_method             = aws_api_gateway_method.chats_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.whatsapp_api.invoke_arn
}

resource "aws_api_gateway_method" "chats_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.chats.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "chats_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.chats.id
  http_method = aws_api_gateway_method.chats_options.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "chats_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.chats.id
  http_method = aws_api_gateway_method.chats_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "chats_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.chats.id
  http_method = aws_api_gateway_method.chats_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.chats_options]
}

# Redeploy API Gateway to pick up the new /chats resource.
# create_before_destroy ensures there's no downtime during redeployment.
resource "aws_api_gateway_deployment" "chats" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  depends_on = [
    aws_api_gateway_integration.chats_get,
    aws_api_gateway_integration_response.chats_options,
  ]
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "chats" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  deployment_id = aws_api_gateway_deployment.chats.id
  stage_name    = "${var.environment}-chats"
}

# --- WhatsApp Bronze Lambda ---

data "archive_file" "whatsapp_bronze" {
  type        = "zip"
  source_file = "${path.root}/lambdas/whatsapp_bronze/handler.py"
  output_path = "${path.root}/lambdas/whatsapp_bronze/handler.zip"
}

resource "aws_lambda_function" "whatsapp_bronze" {
  filename         = data.archive_file.whatsapp_bronze.output_path
  function_name    = "${var.project_name}-whatsapp-bronze-${var.environment}"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.whatsapp_bronze.output_base64sha256
  timeout          = 60

  environment {
    variables = {
      BUCKET_NAME = var.bucket_id
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "s3_invoke_whatsapp_bronze" {
  statement_id  = "AllowS3InvokeWhatsappBronze"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.whatsapp_bronze.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.bucket_arn
}

# --- API Gateway ---

# The REST API is just a container — resources and methods are attached below.
resource "aws_api_gateway_rest_api" "main" {
  name = "${var.project_name}-api-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Cognito authorizer — API Gateway validates the idToken from the request
# Authorization header against the User Pool before invoking the Lambda.
resource "aws_api_gateway_authorizer" "cognito" {
  name            = "cognito"
  rest_api_id     = aws_api_gateway_rest_api.main.id
  type            = "COGNITO_USER_POOLS"
  identity_source = "method.request.header.Authorization"
  provider_arns   = [var.cognito_user_pool_arn]
}

# /photos resource
resource "aws_api_gateway_resource" "photos" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "photos"
}

# GET /photos — protected by Cognito, proxied to the photos_api Lambda
resource "aws_api_gateway_method" "photos_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.photos.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "photos_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.photos.id
  http_method             = aws_api_gateway_method.photos_get.http_method
  integration_http_method = "POST"  # Lambda integrations always use POST internally
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.photos_api.invoke_arn
}

# OPTIONS /photos — MOCK integration that returns CORS headers without hitting Lambda.
# Browsers send a preflight OPTIONS request before the real GET to check CORS policy.
resource "aws_api_gateway_method" "photos_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.photos.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "photos_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.photos.id
  http_method = aws_api_gateway_method.photos_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "photos_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.photos.id
  http_method = aws_api_gateway_method.photos_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "photos_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.photos.id
  http_method = aws_api_gateway_method.photos_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.photos_options]
}

# Allow API Gateway to invoke the photos_api Lambda
resource "aws_lambda_permission" "apigw_invoke_photos_api" {
  statement_id  = "AllowAPIGatewayInvokePhotosApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.photos_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Deployment locks in the current API config and makes it callable.
# Any change to methods/integrations requires a new deployment.
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  depends_on = [
    aws_api_gateway_integration.photos_get,
    aws_api_gateway_integration_response.photos_options,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "dev" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  deployment_id = aws_api_gateway_deployment.main.id
  stage_name    = var.environment
}

# Tells S3 to fire an event to the Lambda whenever a file is created under raw-photos/.
# depends_on is required: the permission above must exist before S3 will accept the notification config.
# Both S3 triggers must live in a single aws_s3_bucket_notification resource —
# S3 only allows one notification configuration per bucket.
resource "aws_s3_bucket_notification" "uploads" {
  bucket = var.bucket_id
  depends_on = [
    aws_lambda_permission.s3_invoke_photo_processor,
    aws_lambda_permission.s3_invoke_video_processor,
    aws_lambda_permission.s3_invoke_whatsapp_bronze,
  ]

  lambda_function {
    lambda_function_arn = aws_lambda_function.photo_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw-photos/"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.video_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw-videos/"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.whatsapp_bronze.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw-whatsapp-uploads/"
    filter_suffix       = ".txt"
  }
}
