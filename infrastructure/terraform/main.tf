# Ghana Super App — AWS target architecture (spec §47):
# WAF → Load Balancer → Application Servers → PostgreSQL / Redis / S3
#
# I cannot run `terraform apply` from this session — there's no AWS account
# connected here. This is a genuine, reviewable starting point for whoever
# has AWS credentials to run it against, not a placeholder.

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.64"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Uncomment once you have an S3 bucket + DynamoDB lock table for state.
  # Running Terraform with local state is fine solo, but breaks the moment
  # a second person or CI needs to run it too.
  # backend "s3" {
  #   bucket         = "ghana-super-app-terraform-state"
  #   key            = "env/terraform.tfstate"
  #   region         = "eu-west-1"
  #   dynamodb_table = "ghana-super-app-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ghana-super-app"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
