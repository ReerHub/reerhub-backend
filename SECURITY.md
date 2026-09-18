# Security Policy

## Supported versions

Only the latest `main` is supported. Security fixes ship as direct commits/PRs to `main` and deploy automatically (Render).

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private vulnerability reporting
(Security tab → Report a vulnerability) on this repo, or email
security@reerhub.com. Please include:

- What you found and where (endpoint, commit, or log excerpt)
- Steps to reproduce (redact any secrets — rotate anything you paste)
- Impact assessment if known

We aim to acknowledge within 72 hours and will keep you updated until a fix
is deployed.

## Scope notes

- Public read APIs (`/jobs`, `/companies`, …) are intentionally open.
- Write endpoints require `x-api-key`; account endpoints require cookie
  sessions + CSRF. Reports must demonstrate impact beyond normal public use.
- Out of scope: spam/phishing content reports (use the app's contact),
  theoretical findings without reproduction, third-party (Render/Vercel/
  Atlas/Upstash) infrastructure issues — report those upstream.
