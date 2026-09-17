# Infrastructure — AWS (spec §47)

Builds: VPC (public + private subnets across 2 AZs) → WAF → ALB → ECS
Fargate (backend, auto-scaling on CPU) → RDS PostgreSQL (Multi-AZ in
production) → ElastiCache Redis → S3 (documents) → ECR (images).

## Before you run this

1. **AWS account + credentials.** `aws configure` locally, or set up OIDC
   federation for GitHub Actions (preferred over long-lived access keys).
2. **Remote state.** Local state works for one person experimenting; the
   moment a second person or CI touches this, uncomment the `backend "s3"`
   block in `main.tf` and create that bucket + DynamoDB lock table first.
3. **A domain + ACM certificate**, if you want HTTPS (you do). The HTTPS
   listener in `alb.tf` is commented out until you have a validated
   certificate ARN to give it.
4. **Real secrets.** `db_password` is a required, non-defaulted variable —
   pass it via `-var`, `TF_VAR_db_password`, or better, wire up AWS Secrets
   Manager and reference it from `ecs.tf` (there's a commented block
   showing where).

## Running it

```bash
terraform init
terraform plan  -var="db_password=<a real secret>" -var="environment=staging"
terraform apply -var="db_password=<a real secret>" -var="environment=staging"
```

I have not run this — there's no AWS account connected to the session that
wrote it. Review it the way you'd review any infrastructure change from a
new team member: `terraform plan` first, read the diff, then apply.

## What's deliberately not here yet

- HTTPS listener (needs a certificate)
- Secrets Manager wiring for DB/JWT/SMS credentials
- A `production` tfvars file with production-sized instances
- Multi-region / DR beyond RDS Multi-AZ
- Bastion host or SSM Session Manager access to the private subnets for
  debugging — add this before you need it at 2am, not after
