terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "areis-cloud-based-personal-storage-tf-state"
    key          = "terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = "us-east-1"
}

# Reference the existing Amplify S3 bucket — we don't own it (Amplify does),
# so we use a data source instead of a resource to just read its attributes.
data "aws_s3_bucket" "main" {
  bucket = "areis-amplify-frontend-storaged4873-dev"
}

# Creates the DynamoDB PhotoMetadata table
module "storage" {
  source       = "./modules/storage"
  project_name = "cloud-personal-storage"
  environment  = "dev"
}

# Look up the Cognito User Pool created by Amplify — we need its ARN
# to configure the API Gateway authorizer.
data "aws_cognito_user_pools" "main" {
  name = "cloudpstorage1e0ddc785_userpool_e0ddc785-dev"
}

# Creates the IAM role, Pillow build step, photo_processor Lambda, S3 trigger,
# photos_api Lambda, and API Gateway
module "compute" {
  source                = "./modules/compute"
  project_name          = "cloud-personal-storage"
  environment           = "dev"
  bucket_arn            = data.aws_s3_bucket.main.arn
  bucket_id             = data.aws_s3_bucket.main.id
  dynamodb_arn          = module.storage.photo_metadata_table_arn
  dynamodb_table_name   = module.storage.photo_metadata_table_name
  cognito_user_pool_arn = tolist(data.aws_cognito_user_pools.main.arns)[0]
  glue_database_name    = module.analytics.glue_database_name
  athena_workgroup      = module.analytics.athena_workgroup
}

# Creates Glue catalog DB, Glue job, and Athena workgroup
module "analytics" {
  source       = "./modules/analytics"
  project_name = "cloud-personal-storage"
  environment  = "dev"
  bucket_name  = data.aws_s3_bucket.main.id
  bucket_arn   = data.aws_s3_bucket.main.arn
}

# Print the API URL after apply so you can set it as REACT_APP_PHOTOS_API_URL
output "website_bucket_name" {
  value = module.storage.website_bucket_name
}

output "website_url" {
  value = module.storage.website_url
}

output "photos_api_url" {
  value = module.compute.photos_api_url
}

output "chats_api_url" {
  value = module.compute.chats_api_url
}
