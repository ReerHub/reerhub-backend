# reerhub-backend

Express API and data-ingestion foundation for ReerHub, an India-first job discovery engine for engineering and AI roles that indexes official company career pages and ATS sources.

## Current scope

5 companies, ~70 pure-tech jobs. The backend provides:

- Companies, job sources, jobs, job changes, sync logs (Mongoose models + indexes)
- Adapters: Greenhouse, Lever, Ashby, SmartRecruiters, Custom with registry keyed by `source.type`
- Sync pipeline: parser -> normalizer -> 9-track classifier -> identity -> batched bulkWrite -> change detection -> sync logging, with sync safety (failed fetches never close jobs)
- Deterministic tech taxonomy (`TAXONOMY` data object: 9 tracks, canonical roles, seniority ladder, `taxonomyVersion`); non-tech drops at ingestion, never stored
- BullMQ `reerhub-sync` queue + worker (`SYNC_CONCURRENCY`), staggered daily crons per source, `POST /job-sources/:id/sync` manual trigger (API key) + `npm run sync:source <pattern>` inline operator tool
- API-key write auth (`x-api-key`); reads stay public
- Idempotent seed for the 5 base companies (`npm run seed`, `seed:dev`, `seed:prod`); company 6+ onboarded via API (probe token -> POST rows -> manual sync)

## Adding a company (no code change for Greenhouse/Lever/Ashby)

```bash
# 1. Live-probe the board token (must return jobs JSON, not 404)
curl "https://boards-api.greenhouse.io/v1/boards/<token>/jobs?content=false"
curl "https://api.lever.co/v0/postings/<org>?mode=json"

# 2. Create rows (needs x-api-key), then trigger + check the sync
# POST /api/v1/companies -> POST /api/v1/job-sources -> POST /api/v1/job-sources/:id/sync
# GET /api/v1/sync-logs
```

The old authentication, resume analysis, payment, coin, email, and AI-recruiting modules have intentionally been removed.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Production deploy (Render)

- Render runs this service directly from `main` (auto-deploy on push) at **`https://api.reerhub.com`** — no staging environment.
- Build `npm ci && npm run lint && npm test`; start `node src/server.js`; health `GET /api/v1/health`.
- Render env (service → Environment): `NODE_ENV=production`, `MONGO_URI`, `MONGO_DB_NAME=reerhub-prod`, `REDIS_URL`, `API_KEY`, `CORS_FRONTEND_URL=https://www.reerhub.com,https://reerhub.com`, `WORKER_ENABLED=true`, `SYNC_CONCURRENCY=5`, `ADAPTER_FETCH_TIMEOUT_MS=30000`. Do **not** set `PORT` — Render injects it and `server.js` reads `process.env.PORT`.
- `env.js` fails fast in production when `MONGO_URI`/`REDIS_URL`/`API_KEY` are missing or `MONGO_DB_NAME` looks like dev/test/localhost.
- CI (`.github/workflows/ci.yml`): lint + tests (Mongo service). Deploys are handled by Render, not GitHub Actions.
- Free-tier caveat: Render free instances sleep, so the in-app BullMQ scheduler is unreliable. `.github/workflows/sync.yml` triggers syncs daily through the API instead — add repository secret `API_KEY`. A paid instance removes the need for the workflow.
- `CORS_FRONTEND_URL` is the list of allowed browser origins; add the frontend origin there to connect. Full guide: workspace `docs/DEPLOYMENT.md`.

## Environment

```dotenv
PORT=8000
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=reerhub-dev
# Production: use a DIFFERENT database, e.g. MONGO_DB_NAME=reerhub-prod
# with your Atlas MONGO_URI. Never point prod at reerhub-dev.
REDIS_URL=redis://localhost:6379
# Production CORS: https://www.reerhub.com,https://reerhub.com
CORS_FRONTEND_URL=http://localhost:3000
SYNC_CONCURRENCY=5
ADAPTER_FETCH_TIMEOUT_MS=30000
API_KEY=change-me
# SYNC_CRON=0 2 * * *  # optional override; default staggers 02:00-05:00
WORKER_ENABLED=true
```

## Current API

```text
GET /api/v1/health
GET /api/v1/jobs?q=&companyId=&city=&remoteType=&techTrack=software|ai-ml|data|cloud-infra|mobile|security|qa|systems|eng-management&techRole=&skills=&indiaOnly=true&status=active&page=&limit=
GET /api/v1/jobs/:jobId
GET /api/v1/companies
GET /api/v1/companies/:slug
POST /api/v1/companies                                     # x-api-key
GET /api/v1/job-sources
POST /api/v1/job-sources                                  # x-api-key
POST /api/v1/job-sources/:sourceId/sync                   # x-api-key
GET /api/v1/sync-logs
```

## Commands

```bash
npm run dev
npm start
npm run seed
npm run backfill   # purge non-tech + re-tag techTrack/techRole/seniority (DRY_RUN=false to apply)
npm test
npm run lint
```
