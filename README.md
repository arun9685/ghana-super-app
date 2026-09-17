# Ghana Super App — Sankofa

**New to this repo?**
- Never used a terminal or written code before? Start with
  [`BEGINNER_SETUP.md`](./BEGINNER_SETUP.md) — every click explained.
- Comfortable with a terminal already? Use [`SETUP.md`](./SETUP.md) for the
  quicker version.

This file covers what's built and why.

This repo follows the module layout in `Technical_Specification.pdf`
Section 8–9. Unlike the first commit (which shipped only Sprint 1 —
authentication), **this is the complete core loop**, built as one delivery
rather than split across sprints, per a direct request to stop sequencing it
that way: a customer can register, book a ride, get matched to a real nearby
driver, track it live, pay, and rate the trip; a driver can apply, get
verified, go online, and run that same trip end to end; an admin can approve
drivers, watch platform stats, and manage support tickets and pricing — all
through a real backend and a real web app, not a mock.

## What's actually working

**Backend** (Node.js + TypeScript + Express + Prisma + PostgreSQL + Redis +
Socket.IO), one module per domain under `backend/src/modules/`:

- **auth** — phone + OTP, JWT access/refresh tokens with rotation (spec §11, §41).
- **users** — profile read/update.
- **drivers** — apply-to-drive, document/vehicle submission, verification status (spec §28).
- **vehicles** — vehicle registration, one active vehicle per driver (spec §29).
- **locations** — live driver location on Redis GEO, online/offline, nearby-driver count (spec §18).
- **rides** — fare estimate, ride request, full state machine (REQUESTED → SEARCHING → ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED, plus CANCELLED / NO_DRIVERS_FOUND), cancellation (spec §15-16).
- **matching** — nearest-idle-driver search over Redis GEO with a widening radius (spec §17) — see the "simplifications" note below.
- **pricing** — per-vehicle-type flat-rate fare engine, admin-editable (spec §21-22).
- **payments** — payment record per completed ride, a provider abstraction (cash confirms immediately; MoMo/card is a mock async gateway with a `/confirm` endpoint standing in for a real webhook) (spec §23-25).
- **ratings** — post-trip rating with server-side incremental average (spec §30).
- **notifications** — in-app inbox delivered live over Socket.IO, with PUSH/SMS/EMAIL logged as would-be dispatches until a real provider is wired in (spec §31).
- **support** — tickets with a message thread, customer + admin sides (spec §32).
- **admin** — dashboard stats, driver verification queue, artisan verification queue, property listing moderation, pricing editor, user/ride directory, support queue (spec §32-33).

Plus the other seven service tiles from the spec's broader super-app scope
(real schema + real endpoints for each; the external third-party
integration each one would eventually call is abstracted behind a small
provider interface — same pattern as `SmsProvider`/`PaymentProvider` — so a
real integration is a drop-in swap, not a rewrite):

- **eat** — restaurant/menu browsing, order placement, status lifecycle
  (PLACED → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED). Real
  integration point: `restaurant.provider.ts` (POS/kitchen-display push).
- **fix** — artisan applications + admin verification, service requests,
  accept/quote, status lifecycle. Matching here is browse-and-request
  rather than automated dispatch (see the module's own comment for why).
- **utilities** — airtime/data/bill top-ups. Real integration point:
  `utility.provider.ts` (a telco/utility aggregator like Hubtel/Reloadly).
- **liquidity** — an in-app wallet (top-up + transaction ledger) and
  microloan applications, admin-decisioned (disburses straight to the
  wallet on approval). Real integration point: `loan.provider.ts`
  (credit-scoring/underwriting).
- **fleet** — multi-vehicle fleet owners: register a fleet (self-service
  role upgrade, same pattern as artisans), add vehicles, assign/unassign
  approved drivers.
- **property** — rental/sale/short-stay listings with admin moderation
  (new listings start `PENDING_REVIEW`) and buyer enquiries.
- **travel** — flight/bus booking. Real integration point:
  `travel.provider.ts` (a GDS/airline API or bus-operator aggregator).

Cutting across all of them: role-based guard middleware, rate limiting,
structured error handling + request logging, zod input validation on every
route, and a Socket.IO layer for real-time ride status, driver location
during a trip, and notifications.

**Frontend** (`frontend/` — React + TypeScript + Vite): one web app,
role-aware, with every dashboard tile live —

- Phone + OTP login (same real backend flow, no shortcuts).
- Customer: service dashboard with all eight tiles enabled — Move (ride
  booking with a real fare estimate, live trip tracking over the socket
  connection, ride history, ratings), Eat (browse/order/track), Fix
  (request a service, browse/become an artisan), Utilities (airtime/data/
  bill pay), Liquidity (wallet + microloans), Fleet (multi-vehicle
  management), Property (browse/list/enquire), Travel (flight/bus booking).
- Driver: apply-to-drive form, verification-pending screen, go online/offline
  (real Redis-backed presence + geolocation ping), incoming-assignment
  handling, arrived → start → complete flow.
- Admin: stats dashboard, driver verification queue, artisan verification
  queue, property listing moderation, support queue.
- Shared: in-app notifications (live), support tickets, profile.

Branded as "Sankofa" — colors, the logo mark, and iconography are ported
directly from the approved POC's actual design tokens and inline SVG icon
set (green `#0A7A4B` primary, gold `#F0B429` accent, ink/slate neutrals,
the hooked-arrow logo mark — see `frontend/src/components/Icons.tsx` and
`frontend/src/styles/theme.css`), not an invented palette, now wired to
the real backend instead of local mock state.

**Mobile** (`mobile/` — Flutter): a native mobile client covering all eight
service tiles — Move (login, book-a-ride, live tracking, driver
online/accept/complete flow), Eat, Fix, Utilities, Liquidity, Fleet,
Property, and Travel — calling the exact same backend endpoints and
Socket.IO events as the web app, using the same POC-derived color tokens
and logo mark (`mobile/lib/config/theme.dart`). One honest gap here: the POC's custom
hand-drawn SVG icons are ported pixel-for-pixel on web, but this app uses
Flutter's closest built-in Material icons instead of redrawing each one as
a `CustomPainter` — see `mobile/README.md`'s "Design system" section for
exactly which gap that is and how to close it. This sandbox has no Flutter
SDK, so the Dart source was written and reviewed carefully but never
compiled here — see `mobile/README.md` for the (short) scaffolding steps
to make it runnable on your machine, and what's real vs. simplified in it
(same curated-landmarks/schematic-map simplification as the web app, for
the same no-maps-API-key reason).

**Infrastructure**: Docker Compose (Postgres + Redis + backend + frontend,
`docker compose up --build` and you have the whole thing running locally),
Terraform for the Section 47 AWS target (VPC, RDS, ElastiCache, ECS Fargate,
ALB, ECR, S3) — not applied, see the caveat below — and a GitHub Actions CI
pipeline (spec §49).

## Simplifications made on purpose (and why)

Being upfront about these rather than quietly shipping something that looks
more finished than it is:

- **Matching is direct-assign, not a timed offer/accept race.** The nearest
  idle driver is assigned atomically instead of being sent a time-boxed
  offer they can accept/decline while the next-nearest driver waits. A real
  offer/accept race needs a job scheduler and per-offer timeouts — genuinely
  more infrastructure than this scope warrants. A driver can still decline
  an assignment in a future iteration; that would just re-run the same
  matching function. See `backend/src/modules/matching/matching.service.ts`.
- **Distance/duration are estimated, not routed.** There's no Google
  Directions / Mapbox / OSRM API key available in this environment, so trip
  distance is straight-line times a fixed road-network fudge factor, and
  duration uses a fixed average speed per vehicle type. Swapping in a real
  routing provider is a one-function change — see `backend/src/common/geo.ts`.
- **Pickup/drop-off selection is a curated list of real Accra landmarks**,
  not a map picker — same reason (no mapping API key). The coordinates are
  real; the picker UI is a search list instead of tap-on-map. See
  `frontend/src/lib/locations.ts`.
- **Payments are cash (real, synchronous) or a mock gateway** that creates a
  PENDING payment and exposes a `/payments/:id/confirm` endpoint standing in
  for a real MoMo/card webhook. No merchant credentials exist in this
  environment; the provider interface (`payment.provider.ts`) is written so
  plugging in a real MTN MoMo/Paystack/Flutterwave integration touches one
  file.
- **Artisan/property/loan "verification" is a human-in-the-loop admin
  queue, not automated underwriting or KYC.** Same spirit as driver
  verification: a real credit-scoring or document-verification service is
  a provider-interface swap away (`liquidity/loan.provider.ts`), not a
  structural change.

## Running it locally

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env   # only needed for `npm run dev`; Docker has its own defaults
docker compose up --build
```

This starts Postgres, Redis, the backend (`http://localhost:3000`), and the
web app (`http://localhost:5173`). First time only, apply the database schema
and seed pricing + an admin account:

```bash
cd backend
npm install
npm run prisma:migrate -- --name init
npm run prisma:seed
```

Then open `http://localhost:5173`, log in with any Ghana-format phone number
(e.g. `0244123456`), and check the backend container logs for the OTP
(`SMS_PROVIDER=console` prints it there instead of sending a real SMS). The
seeded admin account is `0200000000`. The seed also adds a handful of
sample restaurants/menu items (for Eat) and property listings (for
Property) so those tiles have something to show immediately.

If you're updating an existing local database rather than starting fresh,
re-run `npm run prisma:migrate -- --name add_service_tiles` to pick up the
new Eat/Fix/Utilities/Liquidity/Fleet/Property/Travel tables, then
`npm run prisma:migrate -- --name add_audit_log` for the audit-log table,
then `npm run prisma:migrate -- --name encrypt_user_pii` for the
`User.phoneHash` column (see "Security" below for both), then
`npm run prisma:seed` again. If you already have real users in that
database, adding `phoneHash` via migration only adds the column — it
doesn't back-fill it for existing rows, and those rows' `phone` isn't
encrypted yet either. On a fresh dev database (the normal case here)
this doesn't come up; treat any pre-existing production-like data as
needing an explicit backfill script before this migration runs against it.

Also add to `backend/.env` (`.env.example` has placeholders/generation
commands for each): `PAYMENT_WEBHOOK_SECRET`, `PII_ENCRYPTION_KEY`, and
`PII_HASH_KEY` — the backend refuses to boot without all three, same as
the JWT secrets.

## Security

A few things worth knowing before you rely on this beyond a demo:

- **Payment confirmation is webhook-only, not customer-triggered.** Earlier
  in this project's history, `POST /payments/:id/confirm` let the paying
  customer's own JWT mark their own payment PAID — a real fraud path (pay
  nothing, confirm anyway). That endpoint is gone. Payments now resolve
  through `POST /payments/webhook`, authenticated by an HMAC-SHA256
  signature over the raw request body (`PAYMENT_WEBHOOK_SECRET`), the same
  scheme MoMo/Paystack/Flutterwave use for real webhooks — see
  `backend/src/modules/payments/webhookSignature.ts`. Locally, simulate a
  gateway callback with `npm run simulate:webhook -- <paymentId> PAID`
  (`backend/scripts/simulate-gateway-webhook.ts`) instead of calling a
  customer-facing confirm route. The handler is idempotent, so a retried
  webhook delivery (gateways do this) doesn't double-process.
- **Audit trail.** Payment webhook outcomes (confirmed/failed) are recorded
  in an append-only `AuditLog` table (`actorType`, `action`, `entityType`/
  `entityId`, `metadata`, `ipAddress`) — see `backend/src/common/auditLog.ts`.
  This is a starting point, not full coverage: admin actions like driver/
  artisan verification aren't logged there yet.
- **TLS in transit to Postgres and Redis.** `infrastructure/terraform`:
  RDS's parameter group sets `rds.force_ssl=1` (the server refuses a
  non-TLS connection outright) and `DATABASE_URL` carries
  `?sslmode=require` (the client asks for TLS too — belt and suspenders).
  Redis moved from a plain `aws_elasticache_cluster` to an
  `aws_elasticache_replication_group` with `transit_encryption_enabled`
  and `at_rest_encryption_enabled` on, and `REDIS_URL` uses `rediss://`,
  which `ioredis` (the client in `backend/src/database/redis.ts`)
  recognizes automatically — no application code changed. Local Docker
  Compose dev deliberately stays plain (no certs on the local containers,
  nothing to protect on your own machine) — see `.env.example`.
- **Field-level encryption for PII at rest.** `User.phone`, `.name`, and
  `.email` are AES-256-GCM ciphertext in Postgres, not plaintext — applied
  transparently by a Prisma client extension
  (`backend/src/database/prisma.ts`) so the ~30 other places in the
  codebase that read `user.phone`/`.name` through relations (a ride's
  customer, an artisan's user record, a fleet vehicle's assigned driver,
  and so on) needed zero changes. Because encrypted output differs per
  write, `phone` can no longer be looked up directly — `User.phoneHash`,
  a deterministic HMAC-SHA256 "blind index," is the actual unique/lookup
  key now (`auth.service.ts`, `prisma/seed.ts`). See
  `backend/src/common/crypto/piiEncryption.ts` for both primitives.
  **Before this runs against real data**: generate real
  `PII_ENCRYPTION_KEY`/`PII_HASH_KEY` values (`.env.example` has the exact
  `openssl` commands) — losing or rotating either key without a proper
  re-encryption migration makes existing rows permanently undecryptable
  or unlookupable, there's no recovery path around that, it's how
  authenticated encryption is supposed to behave. One real trade-off this
  introduces: the admin user directory's search (`admin.service.ts`'s
  `listUsers`) can no longer run a `LIKE`/`ILIKE` query against encrypted
  phone/name in SQL, so a full phone number still resolves instantly (via
  `phoneHash`) but a partial number or a name now falls back to decrypting
  and scanning up to 2,000 rows in application code — correct and fine at
  MVP scale, worth revisiting (a searchable-token column, or an external
  search index) before the user table gets large.
- **Backup/restore runbook.** `docs/runbooks/backup-restore.md` now
  documents the actual restore procedures (point-in-time restore, restore
  from a specific snapshot, and the honest gap that there's no cross-region
  replica for a full-region disaster) against what `rds.tf` really
  provisions, plus a rehearsal drill to run against staging. It has **not**
  been rehearsed against a live AWS account from here — do that before
  trusting it in a real incident.
- **PII key rotation.** `backend/scripts/rotate-pii-keys.ts` decrypts every
  `User` row with an old `PII_ENCRYPTION_KEY`/`PII_HASH_KEY` pair and
  re-encrypts with a new one, batched, with a `--dry-run` mode. Previously
  there was no way to rotate either key without losing every encrypted row.
  Like the runbook above, this has not been run against a live database
  from this sandbox — dry-run it against staging before production.
- **Per-endpoint rate limiting.** `verify-otp` used to rely only on the
  general API limiter (far too loose for a short numeric code); it, the
  token-refresh endpoint, and the payment webhook now each have their own
  tuned limiter — see `backend/src/middleware/rateLimiter.ts`.
- **Admin routes now validate through zod.** The three admin PATCH routes
  that used inline `req.body?.status as string` checks (support ticket
  status, artisan verification, property listing status) now go through
  `admin.validation.ts` schemas like every other write route.
- **CI now gates on the ECR vulnerability scan.** `scan_on_push` was always
  on; nothing looked at the result. `docker-build-push` now waits for the
  scan and fails the build on any CRITICAL/HIGH finding.
- **Test coverage has a floor in CI**, via `vitest.config.ts`'s
  `coverage.thresholds` — deliberately set low (20% lines/statements/
  functions, 15% branches) since real coverage is uneven and this sandbox
  can't run the suite against a live database to know the true number; it's
  a floor against further erosion, not a target.
- **Still open**: `npm audit` in CI blocks on critical but only warns on
  high; no real penetration testing has been done. See the technical
  readiness checklist doc for the full, prioritized list.

**Note on this sandbox**: I wrote and reviewed this code carefully, but this
environment has no network access to `registry.npmjs.org`, so I could not run
`npm install`, `tsc`, or `docker compose up` here to compile-check it myself.
Run the commands above on your machine (which is how this repo has been
built and debugged throughout) before treating any of it as verified — see
`SETUP.md` for the full walkthrough and known first-run gotchas.

## Deploying to AWS

The Terraform in `infrastructure/terraform/` builds the Section 47 target:
WAF → ALB → ECS Fargate → RDS Postgres + ElastiCache Redis + S3, in a VPC —
plus (added alongside the CI/CD pipeline below) the Secrets Manager entries
the backend reads its config from at boot, and an IAM role GitHub Actions
assumes over OIDC to push images and deploy, with no long-lived AWS keys
stored anywhere. I cannot run this from here — there's no AWS account
connected to this session. To actually stand it up:

```bash
cd infrastructure/terraform
terraform init
terraform plan -var="db_password=<secret>" -var="environment=staging" -var="github_repository=<your-org>/<your-repo>"
terraform apply
```

You'll need an AWS account and credentials configured (`aws configure`) to
run `terraform apply` itself — that's a one-time, human-run step; the
pipeline below never needs your local AWS credentials. I'd strongly
recommend running this against a `staging` environment first, per spec
Section 48. `infrastructure/terraform/frontend_hosting.tf` now provisions
the frontend's own home too: a private S3 bucket behind a CloudFront
distribution (Origin Access Control, not a public bucket), with a new
`ci-cd.yml` job (`frontend-deploy`) that builds the Vite app and syncs it
there, invalidating the CloudFront cache afterwards — no custom domain/ACM
certificate wired up yet, so it's reachable at its `*.cloudfront.net`
address until one is added.

After `terraform apply` succeeds, wire up the pipeline once, per
environment ("staging" and "production" under your GitHub repo's Settings →
Environments — see `.github/workflows/ci-cd.yml`'s header comment for the
exact list): the `terraform output` values become that environment's
`AWS_ROLE_ARN` secret and `AWS_REGION`/`ECR_REPOSITORY_URL`/`ECS_CLUSTER`/
`ECS_SERVICE`/`ECS_TASK_FAMILY` variables, plus (new)
`FRONTEND_S3_BUCKET` (`terraform output frontend_bucket`),
`FRONTEND_CLOUDFRONT_DIST_ID` (`terraform output
frontend_cloudfront_distribution_id`), and `VITE_API_URL`/`VITE_SOCKET_URL`
pointing at the backend (`terraform output alb_dns_name` until a real
domain/HTTPS listener exists). Give "production" a required-reviewers
protection rule if you want a human to approve before anything reaches it
— the workflow doesn't gate that itself, GitHub's environment protection
does.

## CI/CD

**Before this pipeline will pass**: run `cd backend && npm run prisma:migrate -- --name init`
against your own local Postgres once and commit the `backend/prisma/migrations/`
folder it creates. This repo has never had a live database connected to
generate that folder from here (same limitation as everywhere else in this
README) — the pipeline's `prisma migrate deploy` step needs real migration
files to apply, and running it against an empty `migrations/` folder is a
silent no-op that leaves the test database schema-less, so tests fail
against missing tables. Every future `schema.prisma` change (including the
`AuditLog` model added alongside the payment-webhook fix below) needs the
same `prisma:migrate` + commit step.

`.github/workflows/ci-cd.yml` — pushes to `develop` build, test, and deploy
to **staging**; pushes to `main` do the same to **production**; pull
requests build/lint/test/scan but never deploy. Every push also gets its
backend image pushed to GitHub Container Registry (`ghcr.io`) with zero
setup, independent of whether the AWS side is wired up yet, so "does this
commit build?" always has a real answer. Once the Terraform above is
applied and this environment's secrets/variables are set (see above), the
same image also goes to ECR and gets deployed to ECS — a new task
definition revision is registered with the new image, the service is
updated to it, and the job waits for the deployment to stabilize before
reporting success.

Security scanning is part of the pipeline (`npm audit`): informational at
`high` severity (reported, doesn't block), blocking at `critical`. See the
"Security" section above for the payment-webhook and audit-log pieces of
this that aren't CI-shaped.

## What's still genuinely open

- Real SMS provider credentials (Twilio/Hubtel/Africa's Talking) — the
  interface is ready, the account isn't.
- Real payment gateway credentials (MoMo/card) — the webhook contract is
  real (see "Security" above); the actual gateway account isn't.
- Real map/routing provider (Google/Mapbox/OSRM) for actual road distances
  and a tap-on-map picker instead of the curated location list.
- Real penetration testing, and a documented major-version upgrade playbook
  for Prisma/Express/React.
- Docker base images are pinned by tag, not by digest —
  `infrastructure/docker/pin-base-images.sh` exists to resolve and pin real
  digests, but needs a machine with real Docker + registry access to run
  (this sandbox has neither); `.github/dependabot.yml`'s `docker` entry
  then keeps a pinned digest current automatically.
- E.164 phone formatting, a real i18n money library (currency handling is
  GHS-only today), a WCAG accessibility audit, and formal certification
  (ISO 27001/SOC 2/PCI-DSS, an organizational process, not a code change) —
  all lower priority unless this expands beyond Ghana or an enterprise/
  payment partner requires them.
- Everything under "Simplifications made on purpose" above, if the
  simplified version stops being good enough at real scale.

See the "Sankofa — Technical Readiness Checklist" doc for the complete,
priority-ranked version of this list (P0/P1/P2), including everything
addressed in this pass: per-endpoint rate limiting, admin routes now
zod-validated, a rehearsed-on-paper (not yet on AWS) backup/restore runbook,
a PII key-rotation script, ECS readiness/liveness health-check separation,
a CI gate on the ECR vulnerability scan, a vitest coverage floor, an OpenAPI
spec, three ADRs, a Dependabot config, and S3+CloudFront frontend hosting
wired into CI.
