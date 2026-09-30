# Decisions (backend)

Durable choices. One entry each: date, decision, reason, consequences. Don't relitigate silently.

## ADR-001 — Modular monolith (2026-09-16)

Express API with a MongoDB-backed in-process scheduler (`server.js`), not microservices. Reason: early-stage scale does not justify a separate queue service. Consequence: run one API instance and keep module boundaries clean for a later split.

## ADR-002 — Deterministic adapters before AI (2026-09-16)

Greenhouse/Lever/Ashby/SmartRecruiters/custom adapters keyed by `source.type`; AI never crawls. Reason: reliability, cost, debuggability.

## ADR-003 — Retain closed jobs (2026-09-16)

Disappearance → status `closed`, never deleted. Reason: hiring analytics later.

## ADR-004 — Failed syncs never close jobs (2026-09-16)

Only successful fetches contribute to close-detection. Reason: outages must not cause false closures.

## ADR-005 — Direct-to-production, no staging (2026-09-17, shared with frontend)

Render auto-deploys `main`; no staging env. Reason: small team, double cost otherwise; CI + `smoke.js` is the safety net. Consequence: keep `main` green, feature branches + PRs (branch protection on).

## ADR-006 — Cookie sessions (2026-09-18)

httpOnly `accessToken` 15m + rotating MongoDB-backed `refreshToken` 7d; `Secure; SameSite=None` in prod; silent refresh-once-and-retry client-side. Reason: XSS-safe with instant revocation and no cache service. Consequence: CORS `credentials:true`; JWT secrets fail-fast.

## ADR-007 — Google via GIS idToken verify (2026-09-18)

No NextAuth/session lib; backend verifies with `google-auth-library`, links by `googleId` → email. Reason: least surface. Consequence: `GOOGLE_CLIENT_ID` fail-fast; only the public client ID ships to the browser.

## ADR-008 — Resend SMTP, single-use token links (2026-09-18)

`nodemailer` + `SMTP_*`, MongoDB TTL-backed `verify|reset:<sha256>` (24h/1h), forgot always 200, dev log-only. Reason: provider-agnostic, no SDK, no enumeration.

## ADR-009 — Staging promotion flow (2026-09-19, supersedes ADR-005)

Branches merge to `develop` (auto-deploys staging: `staging-api.reerhub.com`); after verification, `develop` merges to `main` (auto-deploys prod). Reason: PRs need a live proving ground before reaching users; free tier can't offer more. Consequence: staging uses its own MongoDB database and scheduler; staging env mirrors prod secrets; cookie `Domain=.reerhub.com` roams across staging (accepted).

## ADR-010 — No Redis: MongoDB-claimed in-process scheduler (2026-09-24)

Removed BullMQ + ioredis (`src/config/queue.js`, `src/config/redis.js`, workers). Sync claiming is `findOneAndUpdate` on `nextScheduledSyncAt`/`syncClaimedUntil`; refresh + verify/reset/magic tokens moved to a MongoDB TTL collection. Reason: one fewer paid service on the free tier, zero queue-ops surface, tokens already needed Mongo anyway. Consequence: exactly one API instance may run the scheduler; `sync.yml` stays as the external wake-up trigger.

## ADR-011 — Passwordless-only auth (2026-09-24)

Magic-link request/verify is the only email entry point; Google login stays. Legacy password routes (`signup`, `login`, `forgot/reset-password`) return 410 Gone; schemas/handlers removed next release. Reason: no password storage, no reset flows, fewer attack surfaces; magic links convert better for job seekers. Consequence: `SMTP_*` deliverability is now login-critical (fail-fast in prod).

## ADR-012 — Pro billing: 3 plans, 7-day trial (2026-09-30)

Razorpay subscriptions via a `BILLING_PLANS` catalog: weekly ₹49 / monthly ₹150 / quarterly ₹299, each with a 7-day free trial (`TRIAL_DAYS`). Reason: weekly is the low-commitment bridge, monthly the default, quarterly the retention engine (~33% off); 7 days proves value in ~7 digests with half the free-ride cost of 14. Consequence: three Razorpay plan IDs in env; webhook stays plan-agnostic; `pro-monthly` id grandfathered.

## ADR-013 — Tests force the test database (2026-09-30)

`NODE_ENV=test` overwrites `MONGO_DB_NAME` with `reerhub-test` instead of defaulting-if-unset. Reason: `.env` sets a dev DB name, which silently routed the whole suite at dev data (caught when 67 synced jobs buried a seeded teaser job past the anonymous cap). Consequence: tests can never touch dev/prod data, by construction rather than convention.

## ADR-014 — Node 24 LTS baseline (2026-09-30, shared with frontend)

`.nvmrc` + `engines >= 24` + CI `node-version: 24` + shell default; dependencies at latest (dotenv 18). Reason: latest LTS; Node 20 crashes on jsdom and lagged the frontend. Consequence: Render/Vercel dashboards must also pin 24; frontend holds `typescript@6`/`eslint@9` until upstream supports TS 7 (tracked, retry at >=7.1).
