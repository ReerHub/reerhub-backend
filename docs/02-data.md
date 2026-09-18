# 02 — Data architecture (`src/models/`)

## Collections

- `companies` — registry (`name`, `slug`, `website`, `careersUrl`, `logoUrl` seeded favicon, `industry`, `headquarters`, `isActive`).
- `job_sources` — ATS configs per company (`companyId`, `type` greenhouse|lever|ashby|smartrecruiters|custom, `careersUrl`, `config`, `isActive`, sync timestamps).
- `jobs` — raw + normalized (`companyId`, `sourceId`, `externalJobId`/`jobFingerprint`, `title`, `normalizedTitle`, `description`, `locations[]`, `remoteType`, `employmentType`, `skills[]`, `techTrack` 9-enum, `techRole`, `seniority`, `isIndiaRole`, `applicationUrl` required, `postedAt`/`firstSeenAt`/`lastSeenAt`, `status`, `contentHash`).
- `job_changes` — created/updated/closed/reopened events.
- `sync_logs` — one record per ingestion run (`errors[]` capped at 50).
- `users` — (`name`, `email` unique/lowercase, `passwordHash` select:false, `googleId` sparse unique, `avatarUrl`, `authProvider` email|google, `role` user|admin (no endpoints yet), `emailVerified`, `failedLoginAttempts`/`lockUntil`, `profile{headline, currentRole, techTrack, techRoles, skills≤10, city, experienceYears, remoteType}`).
- `saved_jobs` — (`userId`, `jobId`) unique compound + `(userId, createdAt)` index.

## Rules & taxonomy

- Identity: `sourceId + externalJobId` preferred, else stable fingerprint; partial unique indexes on both.
- Classifier v2 (`taxonomyVersion: 2`): 9-track `TAXONOMY` + canonical roles + title-parsed seniority; non-tech dropped before fingerprinting.
- Key indexes: `(companyId, status[, techTrack])`, `(locations.city, status)`, `(postedAt: -1)`, `(status, techTrack|techRole|isIndiaRole, postedAt)`, text index on `title + normalizedTitle + department + skills` with regex fallback; city dual-spelling aliases (Bengaluru/Bangalore, Mumbai/Bombay, …).
