# 05 — Auth & security

## Sessions (`src/services/token.service.js`)

- `accessToken` JWT 15m + `refreshToken` JWT 7d with `jti` bound in Redis (`refresh:<jti>`, TTL 7d). Rotation on every refresh; logout revokes one `jti`. Redis-down falls back to stateless verify (revocation weakened — logged, acceptable transiently).
- Cookies: `HttpOnly`, `Secure` + `SameSite=None` in production (`Lax` dev), `Path=/`.
- Double-submit CSRF (`src/middlewares/requireCsrf.middleware.js`): readable `csrfToken` cookie (24h) echoed as `x-csrf-token`, timing-safe compare; all POST/PATCH/DELETE under `/auth` and `/users` enforce it, including login/signup/refresh (login CSRF matters).
- Login throttle: 5 failures → `lockUntil` +15 min, generic 401/429 messages (no enumeration). Passwords: Zod min-8, `bcryptjs` cost 10. No 2FA yet.
- Google: GIS button → backend verifies `idToken` via `google-auth-library` (`GOOGLE_CLIENT_ID`); links by `googleId`, falls back to email match; Google-verified emails auto-verify.

## Email (`src/services/mail.service.js`, Resend SMTP via nodemailer)

- Verify (24h) / reset (1h) single-use Redis tokens (`verify|reset:<sha256>`); forgot always 200; dev without SMTP is log-only. Links built from `FRONTEND_URL`.

## Data rights (`src/controllers/user.controller.js`)

- `GET /me/export` (user + saved jobs + counts + timestamp), `POST /me/password` (verifies current, rotates session), `DELETE /me` (user + saved jobs, clears cookies; orphaned refresh entries die on TTL and refresh re-checks account existence).

## Transport hardening

- `helmet()` defaults, global 200/15m limiter + `authLimiter` 20/15m, `hpp()`, top-level `mongo-sanitize` (nested objects not covered — see TODO), allowlisted CORS + `credentials:true`, Zod everywhere, `ApiError` central handler.
- Prod fail-fast (`src/config/env.js`): `MONGO_URI`, `REDIS_URL`, `API_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `SMTP_HOST/USER/PASS`; `MONGO_DB_NAME` must be prod-like. Never set `PORT` on Render.
- Logging: single-line prod format via morgan + `X-Request-Id`; crash on `unhandledRejection`/`uncaughtException` so Render restarts clean. Graceful shutdown stops worker → queue → Redis → DB.
