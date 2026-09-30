# 06 — Deployment (Render)

- Service auto-deploys `main` at `https://api.reerhub.com`. No staging (ADR-005). Build: `npm ci` (+ `npm audit --audit-level=high` in CI) → lint → tests; start `node src/server.js`; liveness `GET /` + `GET /api/v1/health` (Render health-check path may be either).
- **Environment** (dashboard → Environment; save auto-redeploys):
  ```dotenv
  NODE_ENV=production
  MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority
  MONGO_DB_NAME=reerhub-prod
  API_KEY=<openssl rand -hex 32>
  CORS_FRONTEND_URL=https://www.reerhub.com,https://reerhub.com
  SCHEDULER_ENABLED=true
  SYNC_CONCURRENCY=3
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
- The in-process scheduler requires one always-running backend instance. It persists source due times and claims in MongoDB, so short restarts resume due work after recovery.
- Rollback: Render → Deploys → Redeploy last good; or `git revert` on `main`.

## Staging (`develop` → `staging-api.reerhub.com`)

- Second Render service tracking the `develop` branch. Same env as prod, except:
  ```dotenv
  MONGO_DB_NAME=reerhub-dev
  CORS_FRONTEND_URL=https://staging.reerhub.com
  FRONTEND_URL=https://staging.reerhub.com
  ```
- Uses its own MongoDB database and in-process scheduler. JWT/SMTP/Google secrets mirror prod.
- Verify: `SMOKE_API_BASE=https://staging-api.reerhub.com/api/v1 node src/scripts/smoke.js` + throwaway-account auth flow (signup → verify → save → delete).
