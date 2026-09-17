# spec §47: "For initial deployment, containerized workloads can run on a
# managed container platform" — Fargate specifically, so there's no EC2
# fleet to patch before there's a single real user.

resource "aws_ecs_cluster" "main" {
  name = "ghsa-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  depends_on = [aws_lb_listener.http]
  name              = "/ecs/ghsa-${var.environment}-backend"
  retention_in_days = var.environment == "production" ? 90 : 14
}

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "ghsa-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task role: what the running application itself is allowed to do (S3
# access for documents, etc.) — kept separate from the execution role,
# which is what ECS uses to pull the image and write logs. Least privilege
# (spec §41) means these two roles should never be merged into one.
resource "aws_iam_role" "ecs_task" {
  name               = "ghsa-${var.environment}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

data "aws_iam_policy_document" "ecs_task_s3" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.documents.arn}/*"]
  }
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name   = "ghsa-${var.environment}-ecs-task-s3"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task_s3.json
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "ghsa-${var.environment}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
      essential = true
      portMappings = [{
        containerPort = var.backend_container_port
        protocol      = "tcp"
      }]
      environment = [
        { name = "NODE_ENV", value = var.environment == "production" ? "production" : "staging" },
        { name = "PORT", value = tostring(var.backend_container_port) },
        # SMS_PROVIDER stays "console" (logs OTPs instead of sending them)
        # until sms_provider_api_key below actually holds a real vendor
        # key — see root README's "What's still genuinely open".
        { name = "SMS_PROVIDER", value = "console" },
        { name = "CORS_ORIGIN", value = var.frontend_origin },
      ]
      # Real secrets (DB URL, JWT secrets, payment webhook secret, SMS API
      # key) live in AWS Secrets Manager (secrets.tf) and are fetched by
      # the execution role at container start — never baked into the task
      # definition as plain `environment` values.
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn },
        { name = "JWT_ACCESS_SECRET", valueFrom = aws_secretsmanager_secret.jwt_access_secret.arn },
        { name = "JWT_REFRESH_SECRET", valueFrom = aws_secretsmanager_secret.jwt_refresh_secret.arn },
        { name = "PAYMENT_WEBHOOK_SECRET", valueFrom = aws_secretsmanager_secret.payment_webhook_secret.arn },
        { name = "PII_ENCRYPTION_KEY", valueFrom = aws_secretsmanager_secret.pii_encryption_key.arn },
        { name = "PII_HASH_KEY", valueFrom = aws_secretsmanager_secret.pii_hash_key.arn },
        { name = "SMS_PROVIDER_API_KEY", valueFrom = aws_secretsmanager_secret.sms_provider_api_key.arn },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
      healthCheck = {
        # Liveness, not readiness: this decides whether ECS kills and
        # replaces the task, so it should only fail when the Node
        # process itself is wedged — not when Postgres/Redis have a
        # transient blip, which is the ALB target group's job to notice
        # (alb.tf, checking /health/ready) by pulling the task from
        # rotation without restarting it. See main.ts.
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${var.backend_container_port}/health/live || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])
}

resource "aws_ecs_service" "backend" {
  name            = "ghsa-${var.environment}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.backend.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name    = "backend"
    container_port    = var.backend_container_port
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200 # rolling deploy: spin up new tasks before killing old ones

  depends_on = [aws_lb_listener.http]
}

# spec §47 "Stage 2/3: Load Balancer → Auto Scaling → Multiple Backend
# Instances" — scale on CPU as a sane default; revisit against real traffic
# shape once the matching engine (Sprint 4) is live, since that workload is
# likely to be request-latency-bound rather than CPU-bound.
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.environment == "production" ? 10 : 4
  min_capacity       = var.backend_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "ghsa-${var.environment}-backend-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 65
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}
