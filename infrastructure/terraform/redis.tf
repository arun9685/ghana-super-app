# Managed Redis — used for OTP cooldowns now, driver location + matching in
# Sprint 3+ (spec §18: "Do not write every GPS update directly to Postgres").
#
# A replication group (not the older single-node `aws_elasticache_cluster`
# resource) specifically because only replication groups support
# transit_encryption_enabled/at_rest_encryption_enabled — TLS to Redis and
# encryption of what ElastiCache writes to disk aren't available on the
# plain cluster resource at all, regardless of node count. num_cache_clusters
# = 1 keeps this at the same single-node cost/shape as before; bump it (and
# add `automatic_failover_enabled = true`) before the matching engine
# (Sprint 4+) needs Redis to survive a node failure without downtime.

resource "aws_elasticache_subnet_group" "main" {
  name       = "ghsa-${var.environment}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "ghsa-${var.environment}"
  description = "Sankofa ${var.environment} Redis - OTP cooldowns, driver geo, matching"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_clusters   = 1
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  # No AUTH token configured (that's a separate, optional layer on top of
  # transit encryption — Redis AUTH — worth adding alongside a real secret
  # in Secrets Manager if this ever holds anything more sensitive than
  # short-lived OTP cooldown counters and driver GPS pings). TLS alone
  # already stops a network-level eavesdropper from reading traffic;
  # AUTH stops anyone with mere network *reachability* to the endpoint.

  tags = { Name = "ghsa-${var.environment}-redis" }
}
