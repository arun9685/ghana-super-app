# ADR 0001: Modular monolith, not microservices

## Status
Accepted

## Context
The spec covers a wide surface (ride-hailing plus seven other service tiles:
Eat, Fix, Utilities, Liquidity, Fleet, Property, Travel) but is being built
by a small team standing up an MVP, with no existing operational experience
running distributed systems for this product.

## Decision
Build one backend application (`backend/`), organized as a modular monolith:
each domain (`auth`, `rides`, `payments`, `fix`, `utilities`, ...) is its own
folder under `src/modules/`, following the same internal shape (`*.service.ts`,
`*.controller.ts` or route handlers, `*.routes.ts`, `*.validation.ts`,
`*.test.ts`), but all modules deploy as one process, one Docker image, one
ECS service.

## Consequences
**Gained:**
- One deployment pipeline, one set of infra to operate (`infrastructure/terraform`),
  one place to look for a bug — far less operational overhead than N services
  each needing their own CI, health checks, service discovery, and inter-service
  auth.
- Cross-domain queries (e.g., the admin dashboard aggregating rides + payments
  + users) are ordinary function calls and Prisma queries, not network calls
  with their own retry/timeout/circuit-breaker concerns.
- A consistent per-module folder structure means a new service tile (the
  eighth, ninth, ...) is close to a copy-paste of an existing module — see
  the checklist's "Extensibility" section.

**Given up / accepted risk:**
- No independent scaling per domain — Fix's traffic can't scale separately
  from Rides'. Fine at MVP scale; would need re-examining if one domain's
  load profile diverges sharply from the rest.
- No independent deployability — a bug fix to Travel redeploys the entire
  backend. Mitigated by the modular folder structure making the blast radius
  of a single-module change easy to reason about, and by the CI pipeline's
  test/lint/scan gates catching regressions before they ship.
- One shared database (Postgres) means one schema migration affects every
  domain's tables at once. Acceptable while migrations are additive
  (see the "Upgradability" section of the technical checklist).

## Revisit when
Any one domain's traffic, team size, or release cadence diverges enough from
the rest that shared deploys become the actual bottleneck — not before.
