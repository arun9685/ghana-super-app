output "alb_dns_name" {
  description = "Public DNS name of the load balancer — point your domain's CNAME here"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "Push backend Docker images here"
  value       = aws_ecr_repository.backend.repository_url
}

output "rds_endpoint" {
  description = "PostgreSQL connection endpoint (private — only reachable from inside the VPC)"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis connection endpoint, TLS-enabled (private — only reachable from inside the VPC)"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "documents_bucket" {
  description = "S3 bucket for driver documents and other uploaded assets"
  value       = aws_s3_bucket.documents.bucket
}

output "frontend_bucket" {
  description = "S3 bucket the frontend deploy step (ci-cd.yml) syncs the built Vite app into"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_cloudfront_domain" {
  description = "Public URL for the frontend — point your domain's CNAME here, or use directly until a custom domain is configured"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_cloudfront_distribution_id" {
  description = "Used by the CI deploy step to invalidate the cache after each frontend deploy"
  value       = aws_cloudfront_distribution.frontend.id
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.backend.name
}

output "ecs_task_family" {
  description = "Task definition family — used by the deploy workflow to fetch the current task def before rendering a new revision"
  value       = aws_ecs_task_definition.backend.family
}

output "github_actions_deploy_role_arn" {
  description = "Paste this into the GitHub Environment (staging/production) as the AWS_ROLE_ARN secret — see .github/workflows/ci-cd.yml"
  value       = aws_iam_role.github_actions_deploy.arn
}
