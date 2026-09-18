import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import securityMiddlewares from './config/security.js';
import { getRedisClient } from './config/redis.js';
import ApiError from './utils/ApiError.js';
import errorMiddleware from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import companyRoutes from './routes/company.routes.js';
import jobSourceRoutes from './routes/jobSource.routes.js';
import jobRoutes from './routes/job.routes.js';
import syncLogRoutes from './routes/syncLog.routes.js';

const app = express();

// 1. SECURITY MIDDLEWARE
securityMiddlewares(app);

// 2. PARSERS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. CORS
const allowedOrigins = (process.env.CORS_FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(`❌ CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-csrf-token'],
    credentials: true,
  })
);

// 4. LOGGER + REQUEST ID
// Correlate logs across API/worker/DB layers with X-Request-Id.
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
morgan.token('req-id', (req) => req.id || '-');
app.use(
  morgan(
    process.env.NODE_ENV === 'production'
      ? ':date[iso] :method :url :status :response-time ms req=:req-id'
      : 'dev'
  )
);

// 5. HEALTH CHECK
app.get('/api/v1/health', async (_req, res) => {
  // Deep-ish readiness: ping Mongo + Redis with short timeouts.
  // Always 200 (Render liveness) — `status` degrades to 'degraded'.
  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  let db = 'down';
  let redis = 'down';
  try {
    await withTimeout(mongoose.connection.db.admin().ping(), 2000);
    db = 'up';
  } catch {
    // stays down
  }
  try {
    await withTimeout(getRedisClient().ping(), 2000);
    redis = 'up';
  } catch {
    // stays down (Redis may be intentionally disconnected in some envs)
  }
  res.status(200).json({
    success: true,
    service: 'reerhub-backend',
    status: db === 'up' && redis === 'up' ? 'ok' : 'degraded',
    checks: { db, redis },
  });
});

// Root probe for platform health checks (Render defaults to HEAD /).
// Keeps default probes green without changing the API contract.
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'reerhub-backend',
    status: 'ok',
  });
});

// 6. REERHUB ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/job-sources', jobSourceRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/sync-logs', syncLogRoutes);

app.use((_req, _res, next) => {
  next(new ApiError(404, 'Route not found'));
});

// 7. GLOBAL ERROR HANDLER (must be last)
app.use(errorMiddleware);

export default app;
