# Runtime secrets for the ECS task (spec §41: secrets never live in source
# or in plain task-definition `environment` — only in Secrets Manager,
# fetched by the execution role at container start via the task
# definition's `secrets` block in ecs.tf).
#
# DATABASE_URL/REDIS_URL are derived from the actual RDS/ElastiCache
# endpoints this same apply creates, so they're always correct. The JWT and
# payment-webhook secrets are generated once via `random_password` so a
# fresh `terraform apply` produces a working, non-default-credential
# deployment with zero manual steps — Terraform state then becomes the
# source of truth for them (rotate by tainting the resource and re-applying,
# which issues a new value and forces a new ECS deployment to pick it up).
#
# SMS_PROVIDER_API_KEY has no value to generate (it comes from a real
# telco/SMS vendor account, which doesn't exist yet — see root README's
# "What's still genuinely open"), so it's created empty and the app keeps
# using SMS_PROVIDER=console (logs OTPs instead of sending them) until a
# real value is written into this secret.

resource "random_password" "jwt_access_secret" {
  length  = 48
  special = false # some secret-consuming shells mangle special characters in env-like contexts; hex-ish alnum avoids that class of bug entirely
}

resource "random_password" "jwt_refresh_secret" {
  length  = 48
  special = false
}

resource "random_password" "payment_webhook_secret" {
  length  = 48
  special = false
}

# PII_ENCRYPTION_KEY must be exactly 64 hex characters (a 32-byte AES-256
# key) — src/config/env.ts validates this at boot and refuses to start
# otherwise. `random_id` (not `random_password`) produces that shape
# directly: its `.hex` output is exactly `byte_length * 2` lowercase hex
# characters, with no risk of a non-hex character sneaking in the way a
# generic random-password generator's default charset would.
resource "random_id" "pii_encryption_key" {
  byte_length = 32
}

resource "random_password" "pii_hash_key" {
  length  = 48
  special = false
}

locals {
  # sslmode=require: the client asking for TLS. rds.force_ssl=1 on the DB
  # parameter group (rds.tf) is the server refusing anything that doesn't.
  database_url = "postgresql://${var.db_username}:${urlencode(var.db_password)}@${aws_db_instance.main.address}:5432/${var.db_name}?sslmode=require"
  # rediss:// (double-s) is TLS-enabled Redis — ioredis (the client used
  # in src/database/redis.ts) recognizes this scheme and enables TLS
  # automatically, no code change needed. Only works because
  # transit_encryption_enabled is set on the replication group (redis.tf);
  # this URL would simply fail to connect against a non-TLS Redis.
  redis_url = "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
}

resource "aws_secretsmanager_secret" "database_url" {
  name = "ghsa-${var.environment}-database-url"
}
resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

resource "aws_secretsmanager_secret" "redis_url" {
  name = "ghsa-${var.environment}-redis-url"
}
resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id     = aws_secretsmanager_secret.redis_url.id
  secret_string = local.redis_url
}

resource "aws_secretsmanager_secret" "jwt_access_secret" {
  name = "ghsa-${var.environment}-jwt-access-secret"
}
resource "aws_secretsmanager_secret_version" "jwt_access_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_access_secret.id
  secret_string = random_password.jwt_access_secret.result
}

resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name = "ghsa-${var.environment}-jwt-refresh-secret"
}
resource "aws_secretsmanager_secret_version" "jwt_refresh_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = random_password.jwt_refresh_secret.result
}

resource "aws_secretsmanager_secret" "payment_webhook_secret" {
  name = "ghsa-${var.environment}-payment-webhook-secret"
}
resource "aws_secretsmanager_secret_version" "payment_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.payment_webhook_secret.id
  secret_string = random_password.payment_webhook_secret.result
}

resource "aws_secretsmanager_secret" "pii_encryption_key" {
  name = "ghsa-${var.environment}-pii-encryption-key"
}
resource "aws_secretsmanager_secret_version" "pii_encryption_key" {
  secret_id     = aws_secretsmanager_secret.pii_encryption_key.id
  secret_string = random_id.pii_encryption_key.hex
}

resource "aws_secretsmanager_secret" "pii_hash_key" {
  name = "ghsa-${var.environment}-pii-hash-key"
}
resource "aws_secretsmanager_secret_version" "pii_hash_key" {
  secret_id     = aws_secretsmanager_secret.pii_hash_key.id
  secret_string = random_password.pii_hash_key.result
}

# Placeholder — fill in via `aws secretsmanager put-secret-value` once
# you have a real SMS provider account. It still needs SOME value now,
# not none: ECS's task definition (ecs.tf) references this ARN in its
# `secrets` list, and the execution role's GetSecretValue call fails
# outright (ResourceInitializationError, task never starts) if the
# secret has no version at all — an empty string is fine here since
# SMS_PROVIDER=console means this value is never actually read yet.
# `lifecycle.ignore_changes` means a real key set later via the AWS CLI
# won't get silently overwritten back to "" by a future `terraform apply`.
resource "aws_secretsmanager_secret" "sms_provider_api_key" {
  name = "ghsa-${var.environment}-sms-provider-api-key"
}
resource "aws_secretsmanager_secret_version" "sms_provider_api_key" {
  secret_id     = aws_secretsmanager_secret.sms_provider_api_key.id
  secret_string = "not-configured"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Lets the ECS execution role fetch these specific secrets at task start —
# broader `secretsmanager:GetSecretValue` on `*` would let this role read
# every secret in the account, not just this app's.
data "aws_iam_policy_document" "ecs_execution_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.database_url.arn,
      aws_secretsmanager_secret.redis_url.arn,
      aws_secretsmanager_secret.jwt_access_secret.arn,
      aws_secretsmanager_secret.jwt_refresh_secret.arn,
      aws_secretsmanager_secret.payment_webhook_secret.arn,
      aws_secretsmanager_secret.pii_encryption_key.arn,
      aws_secretsmanager_secret.pii_hash_key.arn,
      aws_secretsmanager_secret.sms_provider_api_key.arn,
    ]
  }
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name   = "ghsa-${var.environment}-ecs-execution-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_secrets.json
}
