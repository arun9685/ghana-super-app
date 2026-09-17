variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-1" # No AWS region is physically in Ghana; eu-west-1
  # (Ireland) is a common low-latency choice for West Africa. Reassess
  # against af-south-1 (Cape Town) based on measured latency once real
  # users are testing — this default is a starting point, not a settled
  # decision.
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be \"staging\" or \"production\"."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread across"
  type        = number
  default     = 2
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "ghana_super_app"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "ghsa_admin"
}

variable "db_password" {
  description = "PostgreSQL master password — pass via -var, TF_VAR_db_password, or a secrets manager. Never commit this."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro" # right-size up before real load testing (spec §50)
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "backend_image_tag" {
  description = <<-EOT
    Docker image tag to deploy for the backend service. Bootstrapping order
    matters here: the ECR repo is empty on a first `terraform apply`, so a
    task definition pointing at a tag that doesn't exist yet will fail to
    pull. Either push one image manually first (`docker push
    <ecr_repository_url>:bootstrap` and set this to "bootstrap"), or apply
    once, then let the CI/CD pipeline's first run push a real tag and
    `terraform apply` again with `-var="backend_image_tag=<that sha>"` —
    after that, ECS deploys move through the pipeline (which registers new
    task definition revisions directly), not through re-running Terraform.
  EOT
  type        = string
  default     = "latest"
}

variable "backend_container_port" {
  description = "Port the backend container listens on"
  type        = number
  default     = 3000
}

variable "backend_desired_count" {
  description = "Number of backend tasks to run"
  type        = number
  default     = 2 # 2, not 1, so a single AZ or task failure doesn't take the API down
}

variable "frontend_origin" {
  description = "The deployed frontend's origin (e.g. https://app.example.com), set as the backend's CORS_ORIGIN. \"*\" is fine for early staging only — lock this down before production traffic exists."
  type        = string
  default     = "*"
}

variable "github_repository" {
  description = "GitHub \"org/repo\" allowed to assume the CI/CD deploy role via OIDC (github_oidc.tf). Must match the repo running .github/workflows/ci-cd.yml."
  type        = string
  default     = "your-org/ghana-super-app" # override with -var or terraform.tfvars
}
