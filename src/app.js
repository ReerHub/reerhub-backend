import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import securityMiddlewares from './config/security.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';

const app = express();

// 1. SECURITY MIDDLEWARE
securityMiddlewares(app);

// 2. PARSERS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const defaultOrigins = [
  'https://amanox.in',
  'https://www.amanox.in',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const allowedOrigins = (process.env.CORS_FRONTEND_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const finalAllowedOrigins = [...new Set([...defaultOrigins, ...allowedOrigins])];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow postman/no-origin tools
      if (!origin) return callback(null, true);

      if (finalAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error('❌ CORS blocked:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  return res.sendStatus(200);
});

// 4. LOGGER
app.use(morgan('dev'));

// 5. HEALTH CHECK
app.get('/', (req, res) => {
  res.send('Server is running...');
});

// 6. ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/resume', resumeRoutes);
app.use('/api/v1/payment', paymentRoutes);

// 7. GLOBAL ERROR HANDLER (must be last)
app.use(errorMiddleware);

export default app;
