# TODO (backend)

## Done

- [x] 5-company ingestion (Greenhouse/Lever/SmartRecruiters) + daily sync + manual trigger
- [x] Models, indexes (text search), API contracts, sync-log visibility
- [x] Auth platform (sessions, Google, verify/reset, profile, saved jobs, lockout, CSRF, data rights)
- [x] Scheduler self-prune + quiet deleted-source skips; deep health; request IDs; audit gates
- [x] `logoUrl` seed + backfill; multi-value filters

## Next

1. Company #6+ (DB rows only for known ATS types; live-probe tokens first).
2. Replace zero-yield CRED Lever (or add its Ashby embed as second source); evaluate Zoho custom adapter.
3. Paid Render (or accept external scheduler permanently); Atlas restore drill.
4. Nice-to-haves: 2FA, admin endpoints for `role: admin` (currently dead field), nested `mongo-sanitize`, OpenAPI doc, coverage gate.
