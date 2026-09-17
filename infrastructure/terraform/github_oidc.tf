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

locals {
  # GitHub Actions OIDC tokens now embed hidden, immutable numeric IDs
  # after the org/user name and the repo name — e.g. the "sub" claim
  # looks like "repo:someorg@70888620/somerepo@1374296058:environment:x"
  # instead of the old plain "repo:someorg/somerepo:environment:x". This
  # is a GitHub-side change (protects against claim reuse if a repo is
  # renamed/transferred) and applies account-wide, not something this
  # project's history did. Confirmed via AWS CloudTrail's Event history:
  # the denied AssumeRoleWithWebIdentity call's userName showed exactly
  # this "name@id" shape. The StringLike condition below has to match
  # THAT shape — a plain "repo:org/repo:*" pattern never matches it,
  # which is what caused every deploy to fail with the misleading
  # "Not authorized to perform sts:AssumeRoleWithWebIdentity" error even
  # after sts:TagSession (also genuinely required, see below) was added.
  gh_owner = split("/", var.github_repository)[0]
  gh_repo  = split("/", var.github_repository)[1]
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    # sts:TagSession is required alongside AssumeRoleWithWebIdentity
    # because aws-actions/configure-aws-credentials@v4 attaches role
    # session tags (repo/branch/actor info) by default. Without this,
    # AWS denies the whole request with the misleading top-level message
    # "Not authorized to perform sts:AssumeRoleWithWebIdentity" — the
    # real cause is the missing TagSession grant, not the assume-role
    # action itself (confirmed via the action's debug log showing
    # "7 role session tags are being used" right before the denial).
    actions = ["sts:AssumeRoleWithWebIdentity", "sts:TagSession"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Restricts which repo (and, within it, which ref/environment) can
    # assume this role — without this condition, ANY GitHub Actions
    # workflow anywhere that knows this role's ARN could assume it.
    # The "@*" after both the owner and repo names matches GitHub's
    # current token format, which inserts a hidden numeric ID there
    # (see the local.gh_owner/gh_repo comment above) — a plain
    # "repo:owner/repo:*" pattern silently never matches real tokens.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${local.gh_owner}@*/${local.gh_repo}@*:*"]
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
    # Needed by the pipeline's "Wait for ECR image scan to complete" /
    # "Fail build on CRITICAL/HIGH vulnerabilities" steps (ci-cd.yml),
    # which poll the scan AWS already runs automatically on every push
    # (ecr.tf's scan_on_push) — pushing the image alone doesn't grant
    # permission to read the scan results back.
    sid       = "ReadECRScanResults"
    actions   = ["ecr:DescribeImages", "ecr:DescribeImageScanFindings"]
    resources = [aws_ecr_repository.backend.arn]
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