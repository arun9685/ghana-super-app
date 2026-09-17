# Containerization follow-up: the frontend Docker image
# (infrastructure/docker/frontend.Dockerfile) was built and validated in CI
# on every push, with nowhere to actually deploy it — this gives it a real
# destination. Static hosting (S3 + CloudFront), not another ECS service:
# the frontend is a Vite-built bundle of static files, and running a whole
# extra Fargate task (plus its own ALB target group, health checks,
# auto-scaling) just to serve files nginx would otherwise hand out is real
# operational cost for zero benefit over an S3 origin + CDN.
#
# The frontend Docker image built in ci-cd.yml's frontend-build job still
# exists (useful for local `docker-compose up` parity with production
# nginx config), but production traffic is served from this path instead.

resource "aws_s3_bucket" "frontend" {
  bucket = "ghana-super-app-frontend-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  # Fully private — nothing is reachable directly from S3. All public
  # traffic goes through CloudFront, which reaches this bucket via Origin
  # Access Control (below), not a public bucket policy.
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "ghsa-${var.environment}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "frontend_bucket_policy" {
  statement {
    sid       = "AllowCloudFrontOAC"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket_policy.json
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # North America + Europe — Ghana traffic still benefits from CloudFront's edge network and shared backbone; narrow this if cost matters more than latency to other regions

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"
    compress                = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  # SPA client-side routing: a deep link like /rides/abc123 has no matching
  # object in the S3 bucket (only index.html + the built assets exist), so
  # S3 returns 403 (private bucket) — CloudFront rewrites that to
  # index.html with a 200 instead of surfacing the 403/404 to the browser,
  # letting React Router take over from there.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # No custom domain/ACM certificate wired up yet (same gap as alb.tf's
    # HTTPS listener) — the default *.cloudfront.net certificate works
    # immediately with no DNS/validation steps, and still serves over
    # HTTPS. Swap in an ACM cert + `aliases` once a domain is pointed here.
    cloudfront_default_certificate = true
  }

  tags = { Name = "ghsa-${var.environment}-frontend" }
}

# Lets the CI deploy step (added to ci-cd.yml) sync the built frontend to
# this bucket and invalidate the CloudFront cache afterwards — without
# this, a new deploy would upload new files but visitors would keep seeing
# the cached old ones until the cache naturally expired.
data "aws_iam_policy_document" "github_actions_frontend_deploy" {
  statement {
    sid       = "SyncFrontendBucket"
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.frontend.arn, "${aws_s3_bucket.frontend.arn}/*"]
  }
  statement {
    sid       = "InvalidateCloudFront"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.frontend.arn]
  }
}

resource "aws_iam_role_policy" "github_actions_frontend_deploy" {
  name   = "ghsa-${var.environment}-github-actions-frontend-deploy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_frontend_deploy.json
}
