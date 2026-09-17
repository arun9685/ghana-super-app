# ADR 0003: Transparent field-level encryption for User PII via a Prisma client extension

## Status
Accepted

## Context
`User.phone`, `.name`, and `.email` are read directly (and via relations —
`ride.customer.phone`, `driverProfile.user.name`, `artisan.user.phone`, and
similarly across eat/fix/fleet/property/travel) from roughly 30 call sites
across the codebase. Encrypting these columns at rest needed to happen
without rewriting all 30 call sites, and without leaving some of them
accidentally reading raw ciphertext.

## Decision
Use a Prisma Client Extension (`src/database/prisma.ts`) with:
- a `result.user` component that transparently decrypts `phone`/`name`/
  `email` on every `User` read — including nested reads via `include`/
  `select` from other models, which is what makes it apply everywhere
  without touching those ~30 call sites;
- a `query.user` component that encrypts those same fields (and computes
  `phoneHash`, a deterministic HMAC-SHA256 blind index) on `create`/
  `update`/`updateMany`/`upsert`.

AES-256-GCM (authenticated, random IV per write) for the value itself;
`phoneHash` (HMAC-SHA256, keyed, deterministic) as a separate indexed column
because AES-GCM's random IV means the same phone number encrypts differently
every time, so the encrypted column itself can never be used for `WHERE
phone = ?` or a uniqueness constraint.

## Consequences
**Gained:**
- Every existing read call site continues to work unmodified and sees plain
  strings, not ciphertext, including through relations.
- `User.phone` is no longer plaintext at rest in Postgres, nor in a
  `pg_dump`, nor visible to anyone with read-only database access.

**Given up / accepted risk:**
- Any call site that looked up a user **by** phone number had to change
  regardless (`auth.service.ts`, `prisma/seed.ts`, test fixtures) — from
  `where: { phone }` to `where: { phoneHash: hashLookupValue(phone) }`.
  This was unavoidable, not an oversight the extension could paper over.
- `admin.service.ts`'s `listUsers` substring search (partial phone number or
  name) can no longer run as a SQL `ILIKE`/`contains` — there is no way to
  index a substring search over ciphertext. It now exact-matches via
  `phoneHash` for a full phone number, or falls back to decrypting a bounded
  page (`MAX_SCAN = 2000` rows) and filtering in application code. This is
  an explicit MVP-scale trade-off, documented in that file and in the
  technical-readiness checklist; it will not scale past low hundreds of
  thousands of users without a real searchable-token column or an external
  search index.
- Losing `PII_ENCRYPTION_KEY` makes every encrypted row permanently
  unrecoverable — there is no recovery path other than restoring from a
  backup taken before the key was lost. `scripts/rotate-pii-keys.ts` exists
  so the key CAN be rotated deliberately, but there is no way to recover
  from losing it outright.

## Revisit when
The admin user-search fallback's `MAX_SCAN` bound starts being hit in
practice (the user table is approaching the low hundreds of thousands), or
a real requirement emerges for searching by partial phone/name at a scale
this approach can't serve.
