# Changelog (backend)

## Unreleased — Pro billing plans + 7-day trial

- `BILLING_PLANS` catalog (`pro-weekly/monthly/quarterly`, ~2yr horizons); `POST /billing/checkout { planId }` (zod-validated, monthly default); trial 14d → 7d (`TRIAL_DAYS`); webhook plan-agnostic; `pro-monthly` id grandfathered with legacy plan-ID fallback. 5 new `billing` tests.

## Unreleased — Node 24 + latest deps

- `.nvmrc`/`engines`/CI/shell default all Node 24 (latest LTS); dotenv 18, mongoose 9.10.3, nodemailer 10.0.13, eslint 10.11, prettier 3.9.9. 46/46 tests green.

## Unreleased — Test database forced

- `NODE_ENV=test` now overwrites `MONGO_DB_NAME` with `reerhub-test` (was default-if-unset, which silently tested against dev data from `.env`).

## Unreleased — Passwordless-only auth

- Magic-link request/verify (15-min single-use MongoDB tokens) + Google login; legacy password routes return 410 Gone. Teaser gating: anonymous `/jobs` gets excerpts + 10-preview cap; members get full roles.

## Unreleased — Recommendations engine

- Profile-scored matches with fit reasons (`GET /recommendations`), feedback loop (`PATCH /:jobId/feedback`), daily digest service honoring notification preferences.

## Unreleased — Redis/BullMQ removed

- Queue, Redis client, and workers deleted; MongoDB-claimed in-process scheduler (`scheduler.service.js`) + MongoDB TTL auth tokens. Health check is Mongo-only; `sync.yml` remains the external trigger.

## Unreleased — Docs gaps + CI notes

- CORS preflight now allows `x-csrf-token` (was blocking every browser mutation with zero backend logs).
- Gitleaks Action removed (license-walled for orgs); leak prevention is native push protection + secret scanning + the local pre-commit hook.

## Unreleased — Queue isolation for shared Redis

- `QUEUE_NAME` override (default `reerhub-sync`; staging uses `reerhub-sync-staging`) so prod + staging share one free Redis plan safely. ADR-009 adopts the staging promotion flow.

## Unreleased — Login Turnstile + public verify resend

- Turnstile enforced on login (was signup/forgot only); `POST /auth/verify-email/resend` (public, always-200, rate-capped) unblocks logged-out users with expired links.

## Unreleased — Global job sort

- `GET /jobs?sort=updated|az` (title A–Z, global across pages; text search keeps relevance order). Invalid values 400.

## Unreleased — Docs trim

- Collapsed `docs/` to DECISIONS + CHANGELOG + deployment; roadmap folded into README; deleted TODO/KNOWN_ISSUES/specs (history preserved in git). New rule: no new doc files without a triggering requirement.

## Unreleased — Cross-domain session fix (on `fix/cookie-domain`)

- Session cookies shared across subdomains in prod (`Domain=.reerhub.com`) so Next.js middleware sees `accessToken`; logout clears legacy host-only cookies too.
- `trust proxy: 1` so rate limits key per real user IP behind Render (was one shared bucket + boot warning).

## Unreleased — Security hardening (`sec/hardening`, in review)

- Turnstile bot check on signup + forgot-password (server verify, test/dev bypass, prod fail-fast) + 5/hour forgot cap.
- Least-privilege Actions, Gitleaks leak scan, `SECURITY.md`, `.env*` gitignore hardening.

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
