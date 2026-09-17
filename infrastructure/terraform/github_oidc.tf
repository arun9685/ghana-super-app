# Lets .github/workflows/ci-cd.yml authenticate to AWS without any long-
# lived access keys stored as GitHub secrets — GitHub issues a short-lived
# OIDC token for each workflow run, this role trusts that token (scoped to
# one specific repo below), and the workflow exchanges it for temporary AWS
# credentials via `aws-actions/configure-aws-credentials`. This is the
# approach the root README's CI/CD section and .github/workflows/ci-cd.yml
# both assume.
#
# NOTE: the OIDC provider for token.actions.githubusercontent.com is
# account-wide — most AWS accounts that use GitHub Actions already have one
# from some other project. If `terraform apply` fails here with "provider
# already exists", delete the `aws_iam_openid_connect_provider` resource
# below and replace every `aws_iam_openid_connect_provider.github.arn`
# reference with a `data "aws_iam_openid_connect_provider"` lookup instead.

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Restricts which repo (and, within it, which ref) can assume this
    # role — without this condition, ANY GitHub Actions workflow anywhere
    # that knows this role's ARN could assume it.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "ghsa-${var.environment}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

# Scoped to exactly what the pipeline needs: push images to this app's own
# ECR repo, register a new task definition revision, and update the ECS
# service to use it — nothing account-wide, no IAM/secrets access (the ECS
# execution role handles reading secrets; this role never touches them).
data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid       = "PushToECR"
    actions   = ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage", "ecr:BatchCheckLayerAvailability", "ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload"]
    resources = [aws_ecr_repository.backend.arn]
  }
  statement {
    sid       = "ECRAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # this specific action is not resource-scopable in IAM
  }
  statement {
    sid       = "RegisterTaskDefinitions"
    actions   = ["ecs:RegisterTaskDefinition", "ecs:DescribeTaskDefinition"]
    resources = ["*"] # RegisterTaskDefinition does not support resource-level restriction
  }
  statement {
    sid       = "UpdateService"
    actions   = ["ecs:UpdateService", "ecs:DescribeServices"]
    resources = [aws_ecs_service.backend.id]
  }
  statement {
    sid       = "PassRolesToECS"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "ghsa-${var.environment}-github-actions-deploy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}
