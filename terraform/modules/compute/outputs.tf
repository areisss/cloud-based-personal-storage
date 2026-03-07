# The full URL of the GET /photos endpoint.
# Format: https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/photos
output "photos_api_url" {
  value = "${aws_api_gateway_stage.dev.invoke_url}/photos"
}

output "chats_api_url" {
  value = "${aws_api_gateway_stage.chats.invoke_url}/chats"
}
