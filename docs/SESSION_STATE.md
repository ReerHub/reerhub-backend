# Session state — backend (handoff)

_Last updated: 2026-09-19. Branch: `develop` (clean, matches `origin/develop`).
Remote has only `develop` + `main`. Next session: start here, then branch off `develop`._

## Where we are

All work below is merged into `develop` (up to #16). `main` deploys to Render prod (`api.reerhub.com`); `develop` deploys to staging (`staging-api.reerhub.com`). Flow: feature branch → PR to `develop` → verify on staging → PR to `main`.

## Completed (this cycle)

- **Deploy fix + root probe**: `MONGO_DB_NAME` prod guard, `GET /` health probe for Render.
- **Phase-2 auth**: email+password + Google GIS login, httpOnly cookies (15m access + 7d rotating refresh in Redis), Resend verify/reset, profiles, saved jobs, 9-track classifier intact.
- **Hardening**: data rights (delete/export/change-password), login lockout (5→15min), double-submit CSRF (+ `x-csrf-token` in CORS preflight), deep `/health` (db/redis), request IDs, prod log format, crash handlers, ISC license, Dependabot (minors grouped, majors ignored), audit gates, SECURITY.md, local pre-commit secret scan.
- **Cross-domain sessions**: `Domain=.reerhub.com` cookies in prod (middleware-visible), logout clears legacy host-only too; `trust proxy: 1` for per-user rate limits.
- **Scheduler self-heal**: prunes stale `daily-*` repeats; worker skips deleted sources quietly.
- **Infra for free tier**: `QUEUE_NAME` override (prod `reerhub-sync`, staging `reerhub-sync-staging`) so one Upstash DB is safely shared; staging uses dev MongoDB.
- **Search**: multi-value filters, global `sort=updated|az`, Turnstile on signup/login/forgot, public verify-email resend, 5/hr forgot cap.
- **Tests**: 9 files, 36 tests green (`npm test`); eslint clean; `npm audit` 0 vulns.
- **Skills**: `.agents/skills/` = find-skills, mongodb-query-optimizer, code-review (+ `skills.json` manifest).

## Prod status / pending user actions

- Prod DB was found EMPTY; user will **delete the prod database entirely and redeploy fresh** (no data worth keeping). After that: `MONGO_DB_NAME=reerhub-prod npm run seed` + trigger all 5 source syncs + verify (`smoke.js` 8/8, incl. the Malaysia probe).
- Do NOT write the backfill below to prod — it runs on **dev only**.

## Planned next (approved, not started)

1. **Malaysia/India bug** (`src/services/roleClassifier.service.js`): add `malaysia`, `kuala lumpur` to `NON_INDIA_MARKERS` + regression tests. Root cause: ATS sends city-only "Malaysia", normalizer defaults country to India, marker list lacks Malaysia.
2. **Escaped-HTML bug** (`src/adapters/greenhouse.adapter.js`): Greenhouse returns pre-escaped HTML (`&lt;div…`); decode entities (via `he`) + test. Affects Razorpay + Enterpret descriptions.
3. **Backfill script** (new `src/scripts/backfillGeo.js`, dry-run default): decode `&lt;`-prefixed descriptions, re-tag `isIndiaRole`, repair `country: India` on known-foreign cities. Run on dev, verify counts.
4. **Passwordless login**: new `POST /auth/magic-link` + `GET /auth/verify-magic?token=` (15-min single-use Redis tokens, Turnstile + 5/hr cap, auto-verifies email); deprecate signup/login/forgot/reset-password routes (410, remove next release); keep `passwordHash` dormant. Anon teaser stripping: `GET /jobs` + `/jobs/:id` return `excerpt` (~160 chars) and omit `description`/`skills`/`applicationUrl` without session.
5. Company-grid `indiaOnly` audit (ensure US roles can't leak onto company pages).

## Resume checklist

```bash
git checkout develop && git pull --rebase origin develop
git checkout -b be/<topic>
npm test && npx eslint src/ test/
```

Docs rule: `docs/` stays at DECISIONS + CHANGELOG + deployment. No new doc files without a triggering requirement.
