# Decisions (backend)

Durable choices. One entry each: date, decision, reason, consequences. Don't relitigate silently.

## ADR-001 — Modular monolith (2026-09-16)

Express API + BullMQ worker in one process (`server.js`), not microservices. Reason: 5 companies don't justify distributed ops. Consequence: keep module boundaries clean for a later split.

## ADR-002 — Deterministic adapters before AI (2026-09-16)

Greenhouse/Lever/Ashby/SmartRecruiters/custom adapters keyed by `source.type`; AI never crawls. Reason: reliability, cost, debuggability.

## ADR-003 — Retain closed jobs (2026-09-16)

Disappearance → status `closed`, never deleted. Reason: hiring analytics later.

## ADR-004 — Failed syncs never close jobs (2026-09-16)

Only successful fetches contribute to close-detection. Reason: outages must not cause false closures.

## ADR-005 — Direct-to-production, no staging (2026-09-17, shared with frontend)

Render auto-deploys `main`; no staging env. Reason: small team, double cost otherwise; CI + `smoke.js` is the safety net. Consequence: keep `main` green, feature branches + PRs (branch protection on).

## ADR-006 — Cookie sessions (2026-09-18)

httpOnly `accessToken` 15m + rotating Redis-bound `refreshToken` 7d; `Secure; SameSite=None` in prod; silent refresh-once-and-retry client-side. Reason: XSS-safe with instant revocation. Consequence: CORS `credentials:true`; JWT secrets fail-fast.

## ADR-007 — Google via GIS idToken verify (2026-09-18)

No NextAuth/session lib; backend verifies with `google-auth-library`, links by `googleId` → email. Reason: least surface. Consequence: `GOOGLE_CLIENT_ID` fail-fast; only the public client ID ships to the browser.

## ADR-008 — Resend SMTP, single-use token links (2026-09-18)

`nodemailer` + `SMTP_*`, Redis `verify|reset:<sha256>` (24h/1h), forgot always 200, dev log-only. Reason: provider-agnostic, no SDK, no enumeration.
