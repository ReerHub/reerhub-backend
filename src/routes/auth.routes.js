import express from 'express';

import {
  csrf,
  forgotPassword,
  googleLogin,
  login,
  logout,
  refresh,
  requestVerifyEmail,
  resendVerifyPublic,
  resetPassword,
  signup,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import requireAuth from '../middlewares/requireAuth.middleware.js';
import requireCsrf from '../middlewares/requireCsrf.middleware.js';
import { authLimiter, forgotLimiter } from '../config/security.js';
import {
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resendVerifySchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.schema.js';

const router = express.Router();

router.get('/csrf', csrf);
router.post('/signup', authLimiter, validate(registerSchema), requireCsrf, signup);
router.post('/login', authLimiter, validate(loginSchema), requireCsrf, login);
router.post('/google', authLimiter, validate(googleSchema), requireCsrf, googleLogin);
router.post('/refresh', requireCsrf, refresh);
router.post('/logout', requireCsrf, logout);
router.post(
  '/verify-email/request',
  authLimiter,
  requireAuth,
  requireCsrf,
  requestVerifyEmail
);
router.post(
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  requireCsrf,
  verifyEmail
);
router.post(
  '/verify-email/resend',
  forgotLimiter,
  authLimiter,
  validate(resendVerifySchema),
  requireCsrf,
  resendVerifyPublic
);
router.post(
  '/forgot-password',
  forgotLimiter,
  authLimiter,
  validate(forgotPasswordSchema),
  requireCsrf,
  forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  requireCsrf,
  resetPassword
);

export default router;
