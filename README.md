# reerhub-backend

Express 5 API with a MongoDB-backed in-process scheduler for **ReerHub** (Real Effective Engineering Roles Hub, reerhub.com) — an India-first tech-job discovery engine. Indexes official company career pages/ATS boards, classifies roles into a 9-track taxonomy, and serves them to the frontend. Also owns accounts (login, profiles, saved jobs) and transactional email.

Live: `https://api.reerhub.com` (Render, auto-deploy on `main` push — no staging).

## Setup (new developer)

```bash
nvm use 24            # Node 24 required (.nvmrc)
npm install
cp .env.example .env  # then fill MONGO_URI (ask the team for dev values)
npm run dev           # → http://localhost:8000
npm test              # 46 tests, forced reerhub-test DB (never touches dev data)
```

Local `.env` points at the shared Atlas dev DB (`reerhub-dev`): reads are safe, writes/seeds affect everyone — say so before running them.

## What it does

- **Ingestion:** Greenhouse/Lever/Ashby/SmartRecruiters/custom adapters → normalize → 9-track classify (non-tech dropped) → bulkWrite → change detection → sync logs. MongoDB-claimed daily syncs are staggered 02:00–05:00 UTC + `POST /job-sources/:id/sync` (API key) + `npm run sync:source <pattern>`. No Redis/BullMQ — the queue was removed (ADR-010).
- **Reads:** `/health` (Mongo check), `/jobs` (teaser-gated for anonymous: excerpt only, 10-preview cap; q/city/remoteType/employmentType/seniority/techTrack/techRole/skills/indiaOnly — multi-value aware; `sort=updated|az`), `/jobs/:id`, `/companies[/:slug]` (live counts), `/job-sources` (+ `/health` per-source staleness), `/sync-logs`.
- **Auth (passwordless):** magic-link request/verify + Google login; legacy password routes are 410 Gone. Sessions are httpOnly cookies (15m access + 7d rotating refresh in MongoDB). `GET/PATCH /users/me` (profile + notification preferences), saved-jobs CRUD, export, account delete. Lockout + CSRF + Turnstile enforced; sessions shared across subdomains in prod.
- **Pro + matching:** `GET/PATCH /recommendations[/:jobId/feedback]` (profile-scored matches with fit reasons); `/billing` (get), `/billing/checkout { planId }` (weekly ₹49 / monthly ₹150 / quarterly ₹299, 7-day trial), `/billing/cancel`; Razorpay webhook (`/api/v1/webhooks/razorpay`, raw-body signature verify).
- **Writes** (companies/sources/sync) need `x-api-key` header.

## Docs

`docs/DECISIONS.md` (ADRs) · `docs/06-deployment.md` (Render env matrix). Start with `AGENTS.md`. Deliberately small — no new doc files without a triggering incident or requirement.

## Roadmap

1. Company #6+ (DB rows for known ATS types; live-probe tokens first).
2. Evaluate Zoho custom adapter; CRED Lever yields thin (1 role) — watch or replace.
3. Paid Render (single always-on instance for the scheduler); Atlas restore drill.
4. Deferred until users demand: 2FA, admin endpoints, OpenAPI, coverage gate.

## Commands

```bash
npm run dev | npm start | npm test | npx eslint src/ test/
npm run seed / seed:dev / seed:prod   # idempotent company/source seed (+logoUrl)
npm run sync:source freshworks        # inline source sync
node src/scripts/smoke.js             # 9 end-to-end checks (SMOKE_API_BASE=… for prod)
```

## Skills (`.agents/skills/`)

`find-skills` · `mongodb-query-optimizer` (official MongoDB) · `code-review`. Pinned in `skills.json` for IDE teammates.

## Deploy

Render auto-deploys `main`. Full env matrix + cutover + rollback: `docs/06-deployment.md`. Keep `main` green; feature branches + PRs (branch protection on).
