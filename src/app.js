import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import securityMiddlewares from './config/security.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';

const app = express();

// 1. SECURITY MIDDLEWARE
securityMiddlewares(app);

// 2. PARSERS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

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

// 7. GLOBAL ERROR HANDLER (must be last)
app.use(errorMiddleware);

export default app;
