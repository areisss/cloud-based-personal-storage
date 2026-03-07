output "glue_database_name" {
  value = aws_glue_catalog_database.main.name
}

output "glue_job_name" {
  value = aws_glue_job.whatsapp_silver.name
}

output "athena_workgroup" {
  value = aws_athena_workgroup.main.name
}
