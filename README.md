# CareerHub Backend

Express API and data-ingestion foundation for CareerHub, an India-first job discovery engine that indexes official company career pages and ATS sources.

## Current scope

The backend foundation provides MongoDB, Redis, security middleware, validation, centralized errors, and a health check. CareerHub domain modules will be added in Phase 1:

- Companies
- Job sources
- Jobs
- Job changes
- Sync logs

The old authentication, resume analysis, payment, coin, email, and AI-recruiting modules have intentionally been removed.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment

```dotenv
PORT=8000
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=crhub
REDIS_URL=redis://localhost:6379
CORS_FRONTEND_URL=http://localhost:3000
```

## Current API

```text
GET /api/v1/health
```

## Commands

```bash
npm run dev
npm start
npm run lint
```
