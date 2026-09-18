# Known issues (backend)

## Current

- CRED Lever yields zero tech roles — replacement candidate; Ashby embed is a possible second source.
- `mongo-sanitize` covers top-level keys only; nested payloads bypass it.
- `role: admin` has no endpoints (dead field until admin tooling is built).
- Redis-down degrades refresh revocation to stateless (transient; logged).
- Free Render sleeps → in-app cron unreliable (mitigated by `sync.yml`; needs `API_KEY` secret; GitHub pauses schedules after 60 idle days).

## Resolved

- Stale BullMQ repeats spammed `JobSource not found` on every boot → scheduler prunes + worker skips quietly.
- Render default `HEAD /` probe 404 → `GET /` root probe added.
- `requireApiKey` WebCrypto bug (every write 500'd) → `node:crypto` + length-safe compare.
- N+1 sync lookups → batched indexed lookup; skills 30/41 → 40/41; Ashby remote-marking; API-key-in-query removed.
