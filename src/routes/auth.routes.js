import express from 'express';

import {
  forgotPassword,
  googleLogin,
  login,
  logout,
  refresh,
  requestVerifyEmail,
  resetPassword,
  signup,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import requireAuth from '../middlewares/requireAuth.middleware.js';
import { authLimiter } from '../config/security.js';
import {
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.schema.js';

const router = express.Router();

router.post('/signup', authLimiter, validate(registerSchema), signup);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/google', authLimiter, validate(googleSchema), googleLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/verify-email/request', authLimiter, requireAuth, requestVerifyEmail);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyEmail);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
