data "aws_eip" "main" {
  tags = {
    Name = "${var.app_name}-eip"
  }
}

output "frontend_ecr_repository_url" {
  description = "URL of the frontend ECR repository - push the image built from this repo's Dockerfile here"
  value       = aws_ecr_repository.frontend.repository_url
}

output "frontend_service_name" {
  description = "Name of the frontend ECS service"
  value       = aws_ecs_service.frontend.name
}

output "ecs_cluster_name" {
  description = "Name of the shared ECS cluster (owned by ../gtfs-realtime/deployment)"
  value       = data.aws_ecs_cluster.main.cluster_name
}

output "aws_region" {
  description = "AWS region resources were deployed into"
  value       = var.aws_region
}

output "app_url" {
  description = "Dashboard URL (proxies /api/ to the backend) - direct IP; if Cloudflare fronts this with a real domain, that's the canonical URL, not this one"
  value       = "http://${data.aws_eip.main.public_ip}"
}
