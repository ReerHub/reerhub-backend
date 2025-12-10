// src/controllers/payment.controller.js
import TryCatch from '../middlewares/async.middleware.js';
import ApiError from '../utils/ApiError.js';
import {
  createOrderForCoins,
  verifyPaymentAndCreditCoins,
} from '../services/payment.service.js';
import User from '../models/user.model.js';

export const createOrder = TryCatch(async (req, res) => {
  const { coins } = req.body;

  if (!coins) {
    throw new ApiError(400, 'Coins amount is required.');
  }

  const result = await createOrderForCoins(req.user._id, coins);

  res.status(200).json({
    success: true,
    message: 'Order created successfully.',
    orderId: result.order.id,
    amount: result.amount,
    currency: result.order.currency,
    keyId: result.keyId,
    coins: result.coins,
  });
});

export const verifyPayment = TryCatch(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const { user, coinsAdded, message } = await verifyPaymentAndCreditCoins(req.user._id, {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  res.status(200).json({
    success: true,
    message,
    coinsAdded,
    coinsBalance: user.coins,
  });
});

export const getPaymentHistory = TryCatch(async (req, res) => {
  const user = await User.findById(req.user._id).select('paymentHistory');
  if (!user) throw new ApiError(404, 'User not found.');

  res.status(200).json({
    success: true,
    paymentHistory: user.paymentHistory || [],
  });
});

export const getCoinHistory = TryCatch(async (req, res) => {
  const user = await User.findById(req.user._id).select('coinHistory coins');
  if (!user) throw new ApiError(404, 'User not found.');

  res.status(200).json({
    success: true,
    coins: user.coins || 100,
    coinHistory: user.coinHistory || [],
  });
});
