# reerhub-backend

Express 5 API + BullMQ ingestion worker for **ReerHub** (Real Effective Engineering Roles Hub, reerhub.com) — an India-first tech-job discovery engine. Indexes official company career pages/ATS boards, classifies roles into a 9-track taxonomy, and serves them to the frontend. Also owns accounts (login, profiles, saved jobs) and transactional email.

Live: `https://api.reerhub.com` (Render, auto-deploy on `main` push — no staging).

## Setup (new developer)

```bash
nvm use 22            # Node 22 required (.nvmrc)
npm install
cp .env.example .env  # then fill MONGO_URI + REDIS_URL (ask the team for dev values)
npm run dev           # → http://localhost:8000
npm test              # 35 tests, isolated reerhub-test DB
```

Local `.env` points at the shared Atlas dev DB (`reerhub-dev`): reads are safe, writes/seeds affect everyone — say so before running them.

## What it does

- **Ingestion:** Greenhouse/Lever/Ashby/SmartRecruiters adapters → normalize → 9-track classify (non-tech dropped) → bulkWrite → change detection → sync logs. 5 companies, ~40 open India roles. Daily BullMQ crons (staggered 02:00–05:00, self-pruning) + `POST /job-sources/:id/sync` (API key) + `npm run sync:source <pattern>`.
- **Reads:** `/health` (db/redis checks), `/jobs` (q/city/remoteType/employmentType/seniority/techTrack/techRole/skills/indiaOnly — multi-value aware; `sort=updated|az`), `/jobs/:id`, `/companies[/:slug]` (live counts), `/job-sources`, `/sync-logs`.
- **Auth (cookies):** signup/login/Google/refresh/logout, verify + forgot/reset email (public logged-out resend included), `GET/PATCH /users/me`, change-password, export, account delete, saved-jobs CRUD. Lockout + CSRF + Turnstile enforced; sessions shared across subdomains in prod.
- **Writes** (companies/sources/sync) need `x-api-key` header.

## Docs

`docs/DECISIONS.md` (ADRs) · `docs/CHANGELOG.md` · `docs/06-deployment.md` (Render env matrix). Start with `AGENTS.md`. Deliberately small — no new doc files without a triggering incident or requirement.

## Roadmap

1. Company #6+ (DB rows for known ATS types; live-probe tokens first).
2. Replace zero-yield CRED Lever (or add Ashby embed); evaluate Zoho custom adapter.
3. Paid Render (or accept external scheduler); Atlas restore drill.
4. Deferred until users demand: 2FA, admin endpoints, OpenAPI, coverage gate.

## Commands

```bash
npm run dev | npm start | npm test | npx eslint src/ test/
npm run seed / seed:dev / seed:prod   # idempotent company/source seed (+logoUrl)
npm run sync:source freshworks        # inline sync without Redis
node src/scripts/smoke.js             # 8 end-to-end checks (SMOKE_API_BASE=… for prod)
```

## Skills (`.agents/skills/`)

`find-skills` · `mongodb-query-optimizer` (official MongoDB) · `code-review`. Pinned in `skills.json` for IDE teammates.

## Deploy

Render auto-deploys `main`. Full env matrix + cutover + rollback: `docs/06-deployment.md`. Keep `main` green; feature branches + PRs (branch protection on).
