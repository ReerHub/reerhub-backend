import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import mongoSanitize from 'mongo-sanitize';

// Apply all global security middleware

const securityMiddlewares = (app) => {
  // 1) HTTP headers
  app.use(helmet());

  // 2) Rate limiter
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many requests, try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // 3) Prevent HTTP Param Pollution
  app.use(hpp());

  // 4) Basic sanitization for incoming inputs
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      Object.keys(req.body).forEach((k) => {
        req.body[k] = mongoSanitize(req.body[k]);
      });
    }
    if (req.query && typeof req.query === 'object') {
      Object.keys(req.query).forEach((k) => {
        req.query[k] = mongoSanitize(req.query[k]);
      });
    }
    if (req.params && typeof req.params === 'object') {
      Object.keys(req.params).forEach((k) => {
        req.params[k] = mongoSanitize(req.params[k]);
      });
    }
    next();
  });
};

export default securityMiddlewares;
