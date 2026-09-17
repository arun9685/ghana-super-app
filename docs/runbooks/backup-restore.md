# Backup & restore runbook — Postgres (RDS)

Status: written, **not yet rehearsed against a real AWS account**. Everything
below follows directly from what `infrastructure/terraform/rds.tf` actually
provisions — it hasn't been walked through end-to-end on a live instance
because this repository has never had one deployed from this environment.
Before trusting this runbook in a real incident, run the drill in
[Rehearsing this runbook](#rehearsing-this-runbook) once against staging.

## What's already in place

- **Automated backups + point-in-time recovery (PITR)**: `backup_retention_period`
  is 14 days in production, 3 days in staging (`rds.tf`). RDS takes a daily
  snapshot during `backup_window` (03:00–04:00) and streams transaction logs
  continuously, so you can restore to any point within the retention window,
  not just to a daily snapshot boundary.
- **Multi-AZ** in production: a synchronous standby in a second AZ, promoted
  automatically by RDS if the primary fails. This protects against an AZ
  outage; it is not a substitute for the backup/restore process below (it
  does not protect against a bad migration, a `DELETE` without a `WHERE`, or
  a corrupted row — all of those replicate to the standby immediately).
- **Deletion protection** in production, plus a final snapshot on deletion —
  so `terraform destroy` can't silently take production data with it.
- **`copy_tags_to_snapshot`**: any snapshot (automated or manual) inherits the
  instance's tags, so a snapshot can be traced back to its environment.

## What this runbook adds

Terraform gives you the mechanism. This is the **procedure** — the part that
was missing: what to actually type, in what order, to get from "the database
is gone or wrong" to "the application is serving correct data again."

## Restore scenarios

### 1. Point-in-time restore (accidental data change, bad migration, etc.)

Restoring to a point in time always creates a **new** RDS instance — it never
overwrites the running one. That's deliberate: it lets you compare old vs.
new data before cutting the application over.

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier ghsa-production \
  --target-db-instance-identifier ghsa-production-restore-$(date +%Y%m%d%H%M) \
  --restore-time 2026-09-17T02:00:00Z \
  --db-subnet-group-name ghsa-production-db-subnets \
  --vpc-security-group-ids <security-group-id-from-terraform-output>
```

Then:
1. Wait for the restored instance to reach `available`
   (`aws rds describe-db-instances --db-instance-identifier <target>`).
2. Connect to the restored instance directly (it is NOT behind the app's
   security group by default — you attached the same SG above, so it is
   reachable the same way the primary is, from inside the VPC) and verify
   the data is what you expect — spot-check the specific rows/tables the
   incident was about.
3. Once verified, point the application at it: this means either (a)
   updating `DATABASE_URL` in Secrets Manager (`secrets.tf`) to the restored
   instance's endpoint and redeploying the ECS service, or (b) exporting the
   corrected data/rows from the restored instance and importing them back
   into the live one with `pg_dump --table=... | psql`, whichever is a
   smaller blast radius for the specific incident.
4. Once the live database is confirmed correct, delete the restore instance
   — it costs money and is not meant to run long-term.

### 2. Restore from a specific snapshot (manual or automated)

```bash
aws rds describe-db-snapshots --db-instance-identifier ghsa-production
# pick a --db-snapshot-identifier from the output, then:
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ghsa-production-restore-$(date +%Y%m%d%H%M) \
  --db-snapshot-identifier <snapshot-id> \
  --db-subnet-group-name ghsa-production-db-subnets \
  --vpc-security-group-ids <security-group-id-from-terraform-output>
```
Same verify → cut over → clean up steps as above.

### 3. Full region/account disaster (RDS itself is unreachable)

There is no cross-region replica configured today — this is a real gap, not
covered by anything above. If the whole region is down, the only recovery
path is: wait for AWS to restore the region, then follow scenario 1 or 2
above once RDS is reachable again. Adding a cross-region read replica (and
promoting it during a regional outage) is a reasonable next step once this
runs at a scale where region-level downtime is unacceptable — it isn't in
`rds.tf` yet.

## Rehearsing this runbook

Do this against **staging**, not production, and do it before you need it
for real:
1. Note the current row count of a few key tables (`SELECT count(*) FROM
   "User";` etc.) as your "before" baseline.
2. Take a manual snapshot: `aws rds create-db-snapshot --db-instance-identifier
   ghsa-staging --db-snapshot-identifier ghsa-staging-drill-test`.
3. Change some data (update a row, or `DELETE` a few test rows) to simulate
   an incident.
4. Follow scenario 2 above to restore that snapshot into a new instance.
5. Confirm the restored instance's row counts match your "before" baseline,
   not the "after the simulated incident" state.
6. Delete the restore instance and the drill snapshot when done.
7. Time how long steps 2–5 actually took — that's your real RTO (recovery
   time objective), not a guess. Write it at the bottom of this file once
   you've done it.

**Recovery time observed in last drill:** _not yet run — fill this in after
the first rehearsal._

## Related

- Key rotation for encrypted PII columns (`User.phone/name/email`) is a
  separate procedure — see `backend/scripts/rotate-pii-keys.ts`'s header
  comment, not this file.
- Redis (ElastiCache) holds no data this app can't reconstruct (OTP codes,
  rate-limit counters, socket presence) — it deliberately has no backup/
  restore procedure of its own.
