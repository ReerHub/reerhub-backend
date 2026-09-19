# 06 — Deployment (Render)

- Service auto-deploys `main` at `https://api.reerhub.com`. No staging (ADR-005). Build: `npm ci` (+ `npm audit --audit-level=high` in CI) → lint → tests; start `node src/server.js`; liveness `GET /` + `GET /api/v1/health` (Render health-check path may be either).
- **Environment** (dashboard → Environment; save auto-redeploys):
  ```dotenv
  NODE_ENV=production
  MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority
  MONGO_DB_NAME=reerhub-prod
  REDIS_URL=rediss://default:<token>@<region>.upstash.io:6379
  API_KEY=<openssl rand -hex 32>
  CORS_FRONTEND_URL=https://www.reerhub.com,https://reerhub.com
  WORKER_ENABLED=true
  SYNC_CONCURRENCY=5
  ADAPTER_FETCH_TIMEOUT_MS=30000
  JWT_ACCESS_SECRET=<openssl rand -hex 32>
  JWT_REFRESH_SECRET=<openssl rand -hex 32>
  GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
  SMTP_HOST=smtp.resend.com
  SMTP_PORT=587
  SMTP_USER=resend
  SMTP_PASS=<resend key>
  SMTP_FROM=ReerHub <noreply@reerhub.com>
  FRONTEND_URL=https://www.reerhub.com
  ```
- Atlas Network Access must allow Render egress (`0.0.0.0/0` pragmatic default); confirm continuous backups/PITR on the prod cluster.
- First-time data: `MONGO_URI=<atlas> MONGO_DB_NAME=reerhub-prod npm run seed`, then per-source `POST /job-sources/:id/sync` with `x-api-key`, then `SMOKE_API_BASE=https://api.reerhub.com/api/v1 node src/scripts/smoke.js` (8 checks).
- Free tier sleeps → in-app cron unreliable; `.github/workflows/sync.yml` (daily 02:00 UTC + manual) wakes the API and syncs every source (needs `API_KEY` Actions secret; GitHub pauses schedules after 60 idle days).
- Rollback: Render → Deploys → Redeploy last good; or `git revert` on `main`.

## Staging (`develop` → `staging-api.reerhub.com`)

- Second Render service tracking the `develop` branch. Same env as prod, except:
  ```dotenv
  MONGO_DB_NAME=reerhub-dev
  QUEUE_NAME=reerhub-sync-staging
  CORS_FRONTEND_URL=https://staging.reerhub.com
  FRONTEND_URL=https://staging.reerhub.com
  ```
- Shares one free Redis plan with prod (isolated by `QUEUE_NAME`) and the dev MongoDB. JWT/SMTP/Google secrets mirror prod.
- Verify: `SMOKE_API_BASE=https://staging-api.reerhub.com/api/v1 node src/scripts/smoke.js` + throwaway-account auth flow (signup → verify → save → delete).
