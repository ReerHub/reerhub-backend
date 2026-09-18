# AGENTS.md — reerhub-backend guide (for AI agents)

Read this first, then `docs/01-product.md`, then `docs/DECISIONS.md`.

## What this repo is

Express 5 (ESM) API + BullMQ ingestion worker for **ReerHub** (Real Effective Engineering Roles Hub, reerhub.com) — an India-first tech-job discovery engine. Indexes engineering/AI openings from official company career pages and ATS platforms, classifies them into a 9-track tech taxonomy, and serves them to the Next.js frontend. Live at `https://api.reerhub.com` (Render, auto-deploy on push to `main`).

This repo is **self-contained**: product context, architecture, decisions, changelog, and skills all live here under `docs/` and `.agents/skills/`. The sibling `reerhub-frontend` repo is a separate checkout — never assume shared files. The parent folder is only a workspace; store nothing project-related outside this repo.

## Runtime (non-negotiable)

- **Node 22** (`.nvmrc` + `engines`; `nvm use 22`).
- `npm run dev` → `:8000`. `npm test` (node:test, `NODE_ENV=test`, isolated `reerhub-test` DB; each file boots its own app). `npx eslint src/ test/`, `npm audit --audit-level=high`.
- Local `.env` points at a **shared Atlas dev DB** (`reerhub-dev`). Reads are safe; writes/seeds affect the whole team — say so before running them.

## Conventions

- Handlers: `TryCatch(async (req, res) => …)` + `throw new ApiError(status, msg)`; body validation via `validate(zodSchema)` → `req.validated`.
- Auth = httpOnly cookies (`accessToken` 15m + rotating `refreshToken` 7d bound in Redis); `requireAuth` (cookie → `Bearer` fallback); all mutations need double-submit CSRF (`GET /auth/csrf` → `x-csrf-token` header); auth routes rate-limited 20/15m under a 200/15m global limiter; login locks 5 fails → 15 min.
- Write endpoints (companies/sources/sync) additionally need `x-api-key`.
- Models are Mongoose with `timestamps`; indexes live in the schemas — never query without checking them.
- Scheduler: BullMQ queue (`QUEUE_NAME`, default `reerhub-sync`; staging overrides to isolate one shared Redis plan), `daily-<sourceId>` schedulers staggered 02:00–05:00; `ensureDailySchedules` upserts **and prunes** stale schedulers; worker skips (never throws on) deleted sources.
- Product invariants: deterministic ATS adapters only; multiple sources per company; store raw + normalized; never delete jobs (mark `closed`); failed syncs never close jobs; track `postedAt`/`firstSeenAt`/`lastSeenAt`; Apply always uses the official `applicationUrl`; tech-only 9-track taxonomy (`software ai-ml data cloud-infra mobile security qa systems eng-management`); India-first (`indiaOnly` default true).
- Commits: `feat:`/`fix:`/`chore:`/`ci:`/`docs:`, short imperative. Only commit/push/PR when asked. Never commit `.env`/secrets/`node_modules`.
- **Branching: feature branches → PR into `develop` (auto-deploys staging) → tested → PR `develop` → `main` (auto-deploys prod). Never touch `main` directly.**

## Gotchas

- `src/config/env.js` fail-fasts in production (`MONGO_URI`, `REDIS_URL`, `API_KEY`, `JWT_*`, `GOOGLE_CLIENT_ID`, `SMTP_*`; `MONGO_DB_NAME` must be prod-like). Do **not** set `PORT` on Render.
- The global rate limiter is per server process — `npm test` instances have their own; don't "verify" against a dev server right after running the suite (15-min window).
- Company logos are seeded favicon URLs in `companies.logoUrl` — never hotlink Clearbit.
- `role: admin` exists on User but has no endpoints yet — don't treat it as functional.

## Skills (`.agents/skills/`)

`find-skills` (meta), `mongodb-query-optimizer` (official MongoDB — index/aggregation guidance), `code-review` (two-axis branch review). Load via the skill tool when the task matches. `skills.json` pins the set for IDE teammates.

## Docs discipline (minimal by design)

`docs/` holds exactly three files: `DECISIONS.md`, `CHANGELOG.md`, `06-deployment.md` (env matrix mirrors `src/config/env.js`). README covers setup/product/roadmap. Do NOT create new doc files, TODO lists, or issue logs without a triggering incident or user-visible requirement — backlog lives in README Roadmap or GitHub Issues.
