# Wareers Backend

Express API and data-ingestion foundation for Wareers, an India-first job discovery engine for engineering and AI roles that indexes official company career pages and ATS sources.

## Current scope

10 companies, 95 pure-tech jobs. The backend provides:

- Companies, job sources, jobs, job changes, sync logs (Mongoose models + indexes)
- Adapters: Greenhouse, Lever, Ashby, Custom with registry keyed by `source.type`
- Sync pipeline: parser -> normalizer -> 9-track classifier -> identity -> batched bulkWrite -> change detection -> sync logging, with sync safety (failed fetches never close jobs)
- Deterministic tech taxonomy (`TAXONOMY` data object: 9 tracks, canonical roles, seniority ladder, `taxonomyVersion`); non-tech drops at ingestion, never stored
- BullMQ `wareers-sync` queue + worker (`SYNC_CONCURRENCY`), staggered daily crons per source, `POST /job-sources/:id/sync` manual trigger (API key)
- API-key write auth (`x-api-key`); reads stay public
- Idempotent seed for the first 3 companies; companies 4-10 onboarded via API (probe token -> POST rows -> manual sync)

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

## Environment

```dotenv
PORT=8000
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=wareers
REDIS_URL=redis://localhost:6379
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
