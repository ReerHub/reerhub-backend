// src/services/payment.service.js
import crypto from 'crypto';
import razorpay from '../config/razorpay.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { getRedisClient } from '../config/redis.js';

// Allowed coin packages (coins = ₹ amount)
const VALID_COINS = [10, 20, 50, 100, 200, 500];

export const createOrderForCoins = async (userId, coins) => {
  if (!VALID_COINS.includes(Number(coins))) {
    throw new ApiError(400, 'Invalid coin package selected.');
  }

  const amountInRupees = Number(coins);
  const amountInPaise = amountInRupees * 100;

  const receiptId = 'rcpt_' + crypto.randomBytes(8).toString('hex');

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: receiptId,
    notes: {
      userId: String(userId),
      coins: String(coins),
    },
  });

  return {
    order,
    amount: amountInPaise,
    coins: Number(coins),
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

export const verifyPaymentAndCreditCoins = async (
  currentUserId,
  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, 'Missing Razorpay payment details.');
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, 'Payment verification failed.');
  }

  // Fetch order to get notes (userId, coins)
  const order = await razorpay.orders.fetch(razorpay_order_id);
  if (!order || !order.notes) {
    throw new ApiError(400, 'Unable to fetch order details from Razorpay.');
  }

  const userIdFromNotes = order.notes.userId;
  const coinsFromNotes = Number(order.notes.coins || 0);

  if (!userIdFromNotes || !coinsFromNotes) {
    throw new ApiError(400, 'Invalid order notes.');
  }

  // Security check: user making request must match user in order notes
  if (String(currentUserId) !== String(userIdFromNotes)) {
    throw new ApiError(403, 'Payment does not belong to this user.');
  }

  const user = await User.findById(userIdFromNotes);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  // Idempotency: check if payment was already processed
  const alreadyProcessed = user.paymentHistory?.some(
    (p) => p.paymentId === razorpay_payment_id && p.status === 'success'
  );

  if (alreadyProcessed) {
    return {
      user,
      coinsAdded: 0,
      message: 'Payment already processed. No additional coins added.',
    };
  }

  // Credit coins
  user.coins = (user.coins || 0) + coinsFromNotes;

  await getRedisClient().del(`user:${userIdFromNotes}`);

  // Log payment
  user.paymentHistory.push({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    amount: order.amount / 100, // convert paise to rupees
    coins: coinsFromNotes,
    status: 'success',
    createdAt: new Date(),
  });

  // Also log coin credit in coinHistory
  user.coinHistory.push({
    type: 'credit',
    coins: coinsFromNotes,
    description: `Coins purchased via Razorpay payment ${razorpay_payment_id}`,
    createdAt: new Date(),
  });

  await user.save();

  return {
    user,
    coinsAdded: coinsFromNotes,
    message: 'Payment verified and coins added.',
  };
};
