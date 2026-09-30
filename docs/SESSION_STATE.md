# Session state — backend (handoff)

_Last updated: 2026-09-30. Branch: `feat/node24-billing-plans` (cut from `develop`; pushed, PR to `develop` pending). Next session: verify PR/staging, then continue on new feature branches — never commit to `develop` directly._

## Where we are

`develop` deploys to staging (`staging-api.reerhub.com`); `main` to prod (`api.reerhub.com`). Flow: feature branch → PR to `develop` → verify on staging → PR to `main`.

## Completed (this cycle, on branch)

- **Pro billing plans**: `BILLING_PLANS` catalog (weekly ₹49 / monthly ₹150 / quarterly ₹299), `{ planId }` checkout validation, 7-day trial (`TRIAL_DAYS`), 5 billing tests. Needs 3 Razorpay plan IDs in env (dashboard step, still pending).
- **Node 24 baseline**: `.nvmrc`/`engines`/CI/shell default all 24; dotenv 18 + latest minor/patch; frontend holds TS@6/eslint@9 (upstream gaps, see frontend AGENTS.md).
- **Test isolation fix**: `NODE_ENV=test` forces `reerhub-test` (was silently testing dev data via `.env`).
- **Mongoose 9**: `new: true` → `returnDocument: 'after'` (killed 7 boot warnings).
- **Earlier (already in tree)**: Redis/BullMQ removed (MongoDB scheduler + TTL tokens); passwordless-only auth (passwords 410); recommendations engine + digests; teaser gating; source health endpoint.

## Current verification

- `npm test`: 46/46 green. `npx eslint src/ test/`: clean. `npm audit`: 0 vulns. Boot: zero warnings, `/health` ok.
- 5 seeded companies sync green (Enterpret 5, Razorpay 5, CRED 1, Meesho 12, Freshworks 44 new jobs on last run).

## Pending user actions

- Create 3 Razorpay plans (weekly/monthly/quarterly) + set `RAZORPAY_PRO_*_PLAN_ID` in `.env` and prod/staging envs; until then checkout 503s by design.
- Pin Node 24 in the Render dashboard (`NODE_VERSION=24`).
- Prod DB was found EMPTY earlier; after PR merge: seed prod + sync all 5 sources + `smoke.js` 8/8.

## Resume checklist

```bash
git checkout feat/node24-billing-plans && git pull --rebase origin feat/node24-billing-plans
nvm use 24 && npm test && npx eslint src/ test/
```

Docs rule: `docs/` stays at DECISIONS + CHANGELOG + deployment (+ this handoff). No new doc files without a triggering requirement.
