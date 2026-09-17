# Roadmap (spec Section 62) — status

Sprints 1–8's backend scope (per spec §62) are implemented in this repo as
one delivery, not sequenced sprint by sprint — see `README.md` for what
that means in practice and which simplifications were made along the way.

| Sprint | Scope (from spec §62) | Status |
|---|---|---|
| 1 | Repo, backend, Postgres, Auth, Users, Roles, Docker, CI | ✅ Implemented |
| 2 | Driver profile, vehicle, documents, verification | ✅ Implemented (`drivers`, `vehicles`) |
| 3 | GPS, driver online/offline, Redis, location streaming | ✅ Implemented (`locations`, Redis GEO) |
| 4 | Ride creation, fare estimation, ride state machine, matching | ✅ Implemented (`rides`, `matching`, `pricing`) — see README's "Simplifications" for the matching/routing caveats |
| 5 | WebSockets, driver/customer tracking, ride events | ✅ Implemented (Socket.IO layer in `realtime/socket.ts`) |
| 6 | Payment abstraction, provider integration, webhooks, ledger, driver earnings | 🟡 Abstraction + cash + mock gateway implemented (`payments`); real MoMo/card credentials not available in this environment |
| 7 | Ratings, reviews, support tickets, notifications | ✅ Implemented (`ratings`, `notifications`, `support`) |
| 8 | Admin dashboard, driver management, ride monitoring, payments, reports | ✅ Implemented (`admin`) |
| 9 | Integration tests, E2E tests, load tests, security testing | 🟡 The original auth integration test suite is here; the newer modules don't have their own test files yet |
| 10 | Controlled Ghana pilot, selected drivers/customers, production monitoring | ⬜ Not started — needs the AWS deployment (Terraform is ready, not applied) and real SMS/payment credentials first |

## Beyond Sprint 1–10: the other service tiles

The spec's broader super-app scope (Eat, Fix, Utilities, Liquidity, Fleet,
Property, Travel) is implemented as real schema + real backend modules +
real, live frontend pages — not stubs, not "Soon" placeholders. Each
domain's external third-party integration (restaurant POS, telco top-up,
credit scoring, GDS/bus booking, etc.) is abstracted behind its own
provider interface, ready to wire up with real credentials without
touching the calling code. See README.md's module list and each module's
`*.provider.ts` for where that plug-in point is.

## Frontend & mobile

A single responsive React web app (`frontend/`) covers the customer,
driver, and admin experiences by role, wired to the real backend, with
every service tile live — see README.md's "What's actually working" and
"Simplifications" sections.

A native Flutter mobile app (`mobile/`) now exists for the Move flow
(login, book a ride, live tracking, the driver online/accept/complete
flow), calling the same backend contract the web app does. No Flutter SDK
is available in this environment, so it's written but not compiled here —
see `mobile/README.md` for the scaffolding steps. It covers Move only;
extending it to the other tiles is the same `ApiClient` pattern already
built, applied screen-by-screen.

## What's next, in priority order

1. Run this locally (`SETUP.md`) and confirm the full loop end to end on
   your machine, since this environment couldn't compile-check it.
2. Scaffold and run the Flutter app (`mobile/README.md`) and confirm the
   Move flow end to end on a device/emulator, since this environment
   couldn't compile-check it either.
3. Real SMS provider credentials (Twilio/Hubtel/Africa's Talking) — swap
   into `backend/src/modules/auth/otp.provider.ts`.
4. Real payment gateway credentials (MoMo/card) — swap into
   `backend/src/modules/payments/payment.provider.ts`.
5. Real integrations for the other tiles' provider interfaces (restaurant
   POS, telco/utility aggregator, credit scoring, GDS/bus operator) as each
   one comes online commercially.
6. A real routing/maps provider, to replace the straight-line fare estimate
   and the curated-location picker (`backend/src/common/geo.ts`,
   `frontend/src/lib/locations.ts`, `mobile/lib/config/locations.dart`).
7. Test coverage for the newer modules, then load/security testing (Sprint 9).
8. Deploy the Terraform, point DNS/CDN at it, then a controlled pilot (Sprint 10).
