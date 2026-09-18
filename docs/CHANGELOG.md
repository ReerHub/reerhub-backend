# Changelog (backend)

## 2026-09-18 — Production hardening + scheduler self-heal (on `main`)

- Account delete/export/change-password; refresh rejects deleted accounts.
- Login lockout (5 → 15 min); double-submit CSRF on all mutations.
- Deep `/health` (`checks.db/redis`), `X-Request-Id`, prod log format, crash handlers.
- Scheduler prunes stale `daily-*` repeats; worker skips deleted sources quietly (killed the prod `JobSource not found` spam).
- ISC `LICENSE`, Dependabot, `npm audit` gate. 31/31 tests (`auth`, `security`, `scheduler` suites).

## 2026-09-17 — Auth platform + company logos (merged via `phase-2-auth`)

- Email+password + Google login, cookie sessions, Resend verify/reset, profiles, saved jobs (`bcryptjs, jsonwebtoken, google-auth-library, cookie-parser, nodemailer`).
- `logoUrl` seeded/backfilled (favicon URLs); multi-value job filters.

## 2026-09-17 — Production live + dependency upgrade

- Render auto-deploy `main` → `api.reerhub.com`; BullMQ 6 / Mongoose 9 / Express 5 / Zod 4; fixed `requireApiKey` crypto bug; `sync.yml` external scheduler; smoke 8/8.

## 2026-09-16/17 — Ingestion MVP

- 5 companies, ~70 pure-tech jobs, 9-track classifier, bulkWrite syncs, sync-safety guarantees, 26→29 tests.
