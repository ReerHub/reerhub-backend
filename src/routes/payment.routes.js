// src/routes/payment.routes.js
import express from 'express';
import { isAuth } from '../middlewares/auth.middleware.js';
import { verifyCSRFToken } from '../middlewares/csrf.middleware.js';
import {
  createOrder,
  verifyPayment,
  getPaymentHistory,
  getCoinHistory,
} from '../controllers/payment.controller.js';

const router = express.Router();

// Create Razorpay order for buying coins
router.post('/create-order', isAuth, verifyCSRFToken, createOrder);

// Verify payment & credit coins
router.post('/verify', isAuth, verifyCSRFToken, verifyPayment);

// Get payment history
router.get('/history', isAuth, getPaymentHistory);

// Get coin history (deduct / credit)
router.get('/coins/history', isAuth, getCoinHistory);

export default router;
