import express from 'express';

import {
  csrf,
  gone,
  googleLogin,
  logout,
  refresh,
  requestMagicLink,
  requestVerifyEmail,
  resendVerifyPublic,
  verifyEmail,
  verifyMagic,
} from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import requireAuth from '../middlewares/requireAuth.middleware.js';
import requireCsrf from '../middlewares/requireCsrf.middleware.js';
import { authLimiter, forgotLimiter } from '../config/security.js';
import {
  googleSchema,
  magicLinkSchema,
  resendVerifySchema,
  verifyEmailSchema,
} from '../validators/auth.schema.js';

const router = express.Router();

router.get('/csrf', csrf);
// Passwordless (magic link is the only email entry point now).
router.post(
  '/magic-link',
  forgotLimiter,
  authLimiter,
  validate(magicLinkSchema),
  requireCsrf,
  requestMagicLink
);
router.get('/verify-magic', authLimiter, verifyMagic);
// Deprecated password surface: 410 Gone (handlers + schemas removed next
// release; they stay exported from their modules until then).
router.post('/signup', gone);
router.post('/login', gone);
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
router.post('/forgot-password', gone);
router.post('/reset-password', gone);

export default router;
