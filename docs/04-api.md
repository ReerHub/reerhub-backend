# 04 — API (`src/routes/`, base `/api/v1`)

```text
GET  /health                                     # { checks.db/redis, ok|degraded }, always 200
GET  /jobs?q=&companyId=&city=&remoteType=&employmentType=&department=&seniority=&techTrack=&techRole=&skills=&indiaOnly=true&status=active&page=&limit=
GET  /jobs/:jobId
GET  /companies | GET /companies/:slug           # live activeJobs counts, indiaOnly-aware
POST /companies | POST /job-sources              # x-api-key
POST /job-sources/:sourceId/sync                 # x-api-key
GET  /sync-logs
GET  /auth/csrf                                  # readable csrfToken cookie (+body token)
POST /auth/signup {name,email,password} | POST /auth/login | POST /auth/google {idToken}
POST /auth/refresh | POST /auth/logout
POST /auth/verify-email/request (auth) | POST /auth/verify-email {token}
POST /auth/forgot-password {email}               # always 200
POST /auth/reset-password {token,password}
GET|PATCH /users/me | POST /users/me/password | GET /users/me/export | DELETE /users/me
POST|DELETE /users/me/saved/:jobId | GET /users/me/saved | GET /users/me/saved/ids
```

## Notes

- Reads public; company/source/sync writes need `x-api-key` (header-only, timing-safe; fail-closed in prod).
- `remoteType/employmentType/seniority/techTrack` accept comma-separated multi-values (`$in`, validated; singles unchanged). `skills=` comma list ≤10, case-insensitive exact. Sort is `postedAt/firstSeenAt` desc; text index with regex fallback.
- Auth: httpOnly cookies (`accessToken` 15m + rotating `refreshToken` 7d in Redis); `requireAuth` (cookie → Bearer fallback); all mutations need double-submit CSRF (`x-csrf-token`); auth limiter 20/15m; login lockout 5 fails → 15 min (generic messages); refresh verifies the account still exists.
- Errors: `ApiError` + global middleware, `X-Request-Id` correlation (`req.id`).
