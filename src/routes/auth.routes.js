import express from 'express';

import {
  registerUser,
  verifyUser,
  loginUser,
  verifyOtp,
  refreshToken,
  logoutUser,
  refreshCSRF,
} from '../controllers/auth.controller.js';

import { validate } from '../middlewares/validate.middleware.js';
import { registerSchema, loginUserSchema } from '../validators/auth.schema.js';

import { isAuth } from '../middlewares/auth.middleware.js';
import { verifyCSRFToken } from '../middlewares/csrf.middleware.js';

const router = express.Router();

router.post('/register', validate(registerSchema), registerUser);
router.post('/verify/:token', verifyUser);
router.post('/login', validate(loginUserSchema), loginUser);
router.post('/verify', verifyOtp);
router.post('/refresh', verifyCSRFToken, refreshToken);
router.post('/logout', isAuth, verifyCSRFToken, logoutUser);
router.post('/refresh-csrf', isAuth, verifyCSRFToken, refreshCSRF);

export default router;
