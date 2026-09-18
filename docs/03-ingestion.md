# 03 — Ingestion (`src/adapters/`, `src/services/sync.service.js`, `src/workers/`, `src/config/queue.js`)

## Sources (seeded, `npm run seed:dev` / `seed:prod` idempotent)

- Razorpay → Greenhouse (`razorpaysoftwareprivatelimited`)
- CRED → Lever (`cred`) — zero tech yield (all postings non-tech); replacement candidate
- Meesho → Lever (`meesho`)
- Freshworks → SmartRecruiters (`Freshworks`, paginated list + per-posting detail)
- Enterpret → Greenhouse (`enterpret`)
- Dead boards removed (PhonePe, Dream Sports 404s; Postman disabled JSON API). Lesson: always live-probe a token before onboarding (`docs` in README). Zoho deferred (custom HTML effort).

## Pipeline per job

Adapter → `normalizeRawJob` → `classifyRole` (9-track + seniority; non-tech dropped here, counted as `nonTechSkipped`) → fingerprint/identity → batched `bulkWrite` + `JobChange.insertMany` → `SyncLog`. Failed fetches never close jobs. Adapters share `fetchWithTimeout` (30s, `ADAPTER_FETCH_TIMEOUT_MS`).

## Scheduling

- BullMQ `reerhub-sync` queue + worker (`SYNC_CONCURRENCY=5`, attempts 3, exponential backoff).
- `ensureDailySchedules`: `daily-<sourceId>` schedulers staggered 02:00–05:00 by source-ID hash (`SYNC_CRON` overrides); **upserts active and prunes schedulers for deleted/deactivated sources** (stale repeats previously spammed `JobSource not found` — fixed, tested in `test/scheduler.test.js`).
- Worker skips inactive/deleted sources quietly (`{ skipped: true }`), never throws on them.
- Manual: `POST /job-sources/:id/sync` (API key) or `npm run sync:source <pattern>` (inline, no Redis). Free Render sleeps → `.github/workflows/sync.yml` triggers daily 02:00 UTC via API (needs `API_KEY` Actions secret).
