# 01 — Product (backend lens)

ReerHub (Real Effective Engineering Roles Hub, reerhub.com) is an India-first job discovery engine purely for tech roles. This repo indexes openings from official company career pages and ATS platforms, classifies them into 9 tracks (`software ai-ml data cloud-infra mobile security qa systems eng-management`), and serves them over `/api/v1` to the Next.js frontend. It also owns accounts: email+password and Google login (cookie sessions), profiles, saved jobs, and verify/reset emails.

## Status (2026-09-18, `main`)

- 5 companies live (Razorpay, CRED, Meesho, Freshworks, Enterpret), ~70 pure-tech jobs, daily BullMQ syncs + manual triggers.
- Auth platform live in code: signup/login/Google/refresh/logout, verify-email + forgot/reset via Resend, `GET/PATCH /users/me`, change-password, export, account delete, saved-jobs CRUD, login lockout, double-submit CSRF.
- 31/31 tests green; eslint clean; `npm audit` 0 vulns; smoke 8/8.
- Production: Render `https://api.reerhub.com` (auto-deploy on `main` push). Scheduler self-prunes stale repeat jobs; worker skips deleted sources quietly.

## Non-negotiable ingestion rules

Deterministic adapters (no AI crawling); multiple sources per company; raw + normalized stored; jobs never deleted (status → `closed`); failed syncs never close jobs; `postedAt`/`firstSeenAt`/`lastSeenAt` tracked; Apply links the official `applicationUrl`; non-tech dropped at ingestion.
