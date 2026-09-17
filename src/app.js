import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import securityMiddlewares from './config/security.js';
import ApiError from './utils/ApiError.js';
import errorMiddleware from './middlewares/error.middleware.js';
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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  })
);

// 4. LOGGER
app.use(morgan('dev'));

// 5. HEALTH CHECK
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'reerhub-backend',
    status: 'ok',
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
