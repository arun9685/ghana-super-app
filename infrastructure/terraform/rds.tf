# Managed PostgreSQL — spec §47 "Stage 2: Managed PostgreSQL".

resource "aws_db_subnet_group" "main" {
  name       = "ghsa-${var.environment}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

# Forces TLS at the server: `rds.force_ssl=1` makes Postgres reject any
# connection that didn't negotiate SSL, regardless of what the client asks
# for. Belt-and-suspenders with the `?sslmode=require` on DATABASE_URL in
# secrets.tf — that's the client asking for TLS, this is the server
# refusing to accept a connection without it even if a client didn't ask.
resource "aws_db_parameter_group" "postgres_force_ssl" {
  name   = "ghsa-${var.environment}-postgres-force-ssl"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "ghsa-${var.environment}"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100 # autoscale storage rather than paging someone at 2am
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.postgres_force_ssl.name
  publicly_accessible    = false

  # spec §52 Disaster Recovery: automated backups + point-in-time recovery.
  backup_retention_period = var.environment == "production" ? 14 : 3
  backup_window           = "03:00-04:00" # low-traffic window, Ghana time is UTC — adjust if that changes
  maintenance_window      = "mon:04:00-mon:05:00"

  multi_az            = var.environment == "production"
  deletion_protection = var.environment == "production"
  skip_final_snapshot  = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "ghsa-${var.environment}-final" : null

  performance_insights_enabled = true

  # Backup-runbook follow-up: automated backups + PITR were already
  # configured above; this was the one easy Terraform-level gap in that
  # story — without it, a manual snapshot taken for the drill in
  # docs/runbooks/backup-restore.md loses this instance's tags, making it
  # harder to tell which snapshot belongs to which environment months later.
  copy_tags_to_snapshot = true

  tags = { Name = "ghsa-${var.environment}-postgres" }
}
