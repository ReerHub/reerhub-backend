# Changelog (backend)

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
