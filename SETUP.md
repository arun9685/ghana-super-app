# Setup & Run Guide

This gets the complete app — backend API, real-time layer, and the Sankofa
web frontend — running on your machine. Everything below needs to happen on
a computer with internet access — none of it can run inside the sandbox
that generated this repo.

## 1. Prerequisites

Install these first:

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20 or newer | `node -v` |
| Docker Desktop | latest | `docker -v` (must include Compose v2) |
| npm | comes with Node | `npm -v` |

Windows: run everything below inside **WSL2** or **Git Bash**, not raw
PowerShell — the commands assume a POSIX shell.

Docker Desktop must be **running** (the whale icon in your system tray/menu
bar) before any `docker` command will work.

## 2. Get the code

Unzip the project zip wherever you keep projects, then:

```bash
cd ghana-super-app
```

## 3. Create your environment files

The backend env file must live inside `backend/` — that's where both the
app and the Prisma CLI actually look for it, since that's the folder you
run them from.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Open `backend/.env` and change `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to your
own random strings (anything 16+ characters — `openssl rand -hex 32` is an
easy way to generate one). Leave everything else as-is for local dev.
`frontend/.env` needs no changes for local Docker use — it only matters if
you run the frontend with `npm run dev` instead of Docker (step 6, Option B).

## 4. Install dependencies

The Docker images install their own dependencies at build time, but you
also need them installed on your host machine so you can run Prisma
commands (step 5), run the frontend in dev mode, and get editor
autocomplete:

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

This is the step that needs internet access and will take a few minutes —
the frontend pulls in React, Vite, and Socket.IO's client on top of what
the backend already needed.

## 5. Start the database and create the schema

**If you already ran this repo's Sprint-1-only version before and have a
`ghana-super-app_pgdata` Docker volume from that**: the schema grew a lot in
this version (rides, drivers, vehicles, payments, and more), and it's local
dev data with nothing worth keeping, so the simplest path is to wipe it and
start clean rather than reconcile migration history:
```bash
docker compose down -v
```
(`-v` removes the named volume too, not just the containers — this deletes
local dev data, which is exactly the point here.) Skip this if you're
starting fresh anyway.

Start just Postgres and Redis first (not the backend yet):

```bash
docker compose up -d postgres redis
```

Wait about 10 seconds for them to become healthy, then create and apply the
first migration. This is a normal one-time step for any fresh Prisma
project — no migration files exist yet because they get generated from
`schema.prisma` the first time you run this:

```bash
cd backend
npx prisma migrate dev --name init
```

If that fails with `Environment variable not found: DATABASE_URL` even
though `backend/.env` exists and looks correct, it's a known quirk in how
the Prisma CLI (not the app itself) auto-detects `.env` files — run this
instead, which loads it explicitly and sidesteps the detection entirely:

```bash
npm run prisma:migrate -- --name init
cd ..
```

You should see it create `backend/prisma/migrations/<timestamp>_init/` and
report `Your database is now in sync with your schema.` If it fails with a
connection error, Postgres probably isn't ready yet — wait a few seconds
and retry.

Now seed the pricing rules (every vehicle type needs a fare rule before a
ride can be estimated) and a platform admin account:

```bash
npm run prisma:seed
cd ..
```

This prints the seeded admin phone number (`0200000000`) — use it to log
into the admin panel once the frontend is running.

## 6. Run everything

Pick one:

**Option A — everything in Docker (matches production shape):**
```bash
docker compose up --build
```
This builds and starts Postgres, Redis, the backend, and the frontend
together. Code changes won't show up until you stop this (Ctrl+C) and run
it again — it's running compiled snapshots, not your live files. That's
intentional: this path exists to match what production actually runs. Use
Option B below while actively writing code.

**Option B — backend and frontend on your host with hot reload (faster
while coding):**
```bash
docker compose up -d postgres redis
cd backend && npm run dev    # in one terminal
cd frontend && npm run dev   # in another terminal
```

Either way, the API ends up at `http://localhost:3000` and the web app at
`http://localhost:5173`.

## 7. Verify it works

Open `http://localhost:5173` in a browser. Enter any Ghana-format phone
number (e.g. `0244123456`), and check the backend's terminal/log output for
the 6-digit OTP (`SMS_PROVIDER=console` prints it there instead of sending a
real SMS). You should land on the dashboard, be able to book a ride between
two Accra locations, and see a fare estimate. To see the other side of the
same ride, open a second browser (or an incognito window) and register a
second phone number, apply to drive at `/drive/apply`, then approve that
driver from the admin account (`0200000000`) at `/admin` — after approving,
that second account can go online at `/drive` and will be matched to the
first account's ride request in real time.

If you'd rather verify with curl first, that still works exactly as before:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}

curl -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"0244123456"}'
# → {"success":true,"data":{"message":"OTP sent"}}
```

The OTP itself is printed in the backend's terminal/log output (that's what
`SMS_PROVIDER=console` does — no real SMS account needed yet). Copy the
6-digit code from there, then:

```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"0244123456","otp":"<paste the code here>"}'
# → { "success": true, "data": { "accessToken": "...", "refreshToken": "...", "user": {...} } }
```

Copy the `accessToken` from that response and try:

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <paste accessToken here>"
```

If that returns your user record, the full auth flow — the thing Sprint 1
exists to prove — is working end to end.

## 8. Run the automated tests

```bash
cd backend
npm test
```

This runs both the unit tests (no database needed) and the integration
tests (needs Postgres + Redis running, same as step 5).

## Troubleshooting

**`docker compose up` fails immediately** — Docker Desktop isn't running.
Start it and wait for the whale icon to say "running", then retry.

**`Error: P1001: Can't reach database server`** — Postgres isn't up yet, or
isn't healthy. Run `docker compose ps` to check; `docker compose logs
postgres` if it's not healthy after 30 seconds.

**Port already in use (3000, 5173, 5432, or 6379)** — something else on your
machine is using that port. Either stop it, or change the port mapping in
`docker-compose.yml` (left side of the `"host:container"` pair).

**Frontend loads but every request fails / shows a network error** — the
frontend was built with `VITE_API_URL` pointing somewhere it can't reach the
backend. For Docker (`docker compose up --build`), this is set automatically
to `http://localhost:3000/api/v1` and should just work. If you changed the
backend's port mapping in `docker-compose.yml`, update `frontend/.env` (or
the `VITE_API_URL`/`VITE_SOCKET_URL` build args in `docker-compose.yml`) to
match, then rebuild the frontend image — Vite bakes these in at build time,
so a plain restart won't pick up a change.

**Backend container starts then immediately exits** — run `docker compose
logs backend`; it's almost always a missing/invalid `.env` value. Check
that `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are both set and at least
16 characters.

**Changed `schema.prisma` and now types look wrong** — run
`npx prisma generate` inside `backend/` to regenerate the Prisma client,
then restart your dev server / editor's TS server.

## What's next

- `README.md` — what's implemented vs. stubbed, and how to deploy to AWS
  once you're ready (needs your own AWS account and credentials — not
  something that happens from this guide).
- `ROADMAP.md` — Sprint 2 onward, mapped to the original spec.
