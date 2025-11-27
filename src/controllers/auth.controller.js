import bcrypt from 'bcrypt';
import crypto from 'crypto';
import sanitize from 'mongo-sanitize';

import { getRedisClient } from '../config/redis.js';
import { sendMail } from '../config/mail.js';

import { getOtpHtml, getVerifyEmailHtml } from '../utils/emailTemplates/index.js';

import {
  generateToken,
  verifyRefreshToken,
  generateAccessToken,
  revokeRefreshToken,
} from '../config/token.js';

import { generateCSRFToken } from '../config/csrf.js';

import User from '../models/user.model.js';
import TryCatch from '../middlewares/async.middleware.js';
import ApiError from '../utils/ApiError.js';

export const registerUser = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  const { name, email, password } = req.validated;

  const rateKey = `register_attempts:${req.ip}:${email}`;
  if (await redisClient.get(rateKey)) {
    throw new ApiError(429, 'Too many requests. Try again later.');
  }

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(400, 'Email already in use');

  const hashed = await bcrypt.hash(password, 10);

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const redisKey = `verify:${verifyToken}`;

  await redisClient.set(redisKey, JSON.stringify({ name, email, password: hashed }), {
    EX: 300,
  });

  await sendMail({
    to: email,
    subject: 'Verify your email',
    html: getVerifyEmailHtml({ email, token: verifyToken }),
  });

  await redisClient.set(rateKey, 'true', { EX: 60 });

  res.json({
    message: 'Verification link sent. It expires in 5 minutes.',
  });
});

export const verifyUser = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  const { token } = req.params;
  const redisKey = `verify:${token}`;

  const data = await redisClient.get(redisKey);
  if (!data) throw new ApiError(400, 'Verification link expired');

  await redisClient.del(redisKey);

  const userData = JSON.parse(data);

  const exists = await User.findOne({ email: userData.email });
  if (exists) throw new ApiError(400, 'Email already registered');

  const newUser = await User.create(userData);

  res.status(201).json({
    message: 'Email verified! Account created.',
    user: {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
    },
  });
});

export const loginUser = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  const { email, password } = req.validated;

  const limitKey = `login-limit:${req.ip}:${email}`;
  if (await redisClient.get(limitKey)) {
    throw new ApiError(429, 'Too many attempts. Try again later.');
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) throw new ApiError(400, 'Invalid credentials');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new ApiError(400, 'Invalid credentials');

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await redisClient.set(`otp:${email}`, otp, { EX: 300 });

  await sendMail({
    to: email,
    subject: 'Your OTP',
    html: getOtpHtml({ email, otp }),
  });

  await redisClient.set(limitKey, 'true', { EX: 60 });

  res.json({ message: 'OTP sent. Valid for 5 minutes.' });
});

export const verifyOtp = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  const { email, otp } = sanitize(req.body);

  if (!email || !otp) throw new ApiError(400, 'Email and OTP required');

  const storedOtp = await redisClient.get(`otp:${email}`);
  if (!storedOtp) throw new ApiError(400, 'OTP expired');
  if (storedOtp !== otp) throw new ApiError(400, 'Invalid OTP');

  await redisClient.del(`otp:${email}`);

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'User not found');

  const tokenData = await generateToken(user._id, res);

  res.json({
    message: `Welcome ${user.name}`,
    user,
    sessionInfo: {
      sessionId: tokenData.sessionId,
      loginTime: new Date().toISOString(),
      csrfToken: tokenData.csrfToken,
    },
  });
});

export const refreshToken = TryCatch(async (req, res) => {
  const rt = req.cookies.refreshToken;
  if (!rt) throw new ApiError(401, 'Refresh token missing');

  const decode = await verifyRefreshToken(rt);

  if (!decode) {
    throw new ApiError(401, 'Session expired. Login again.');
  }

  generateAccessToken(decode.id, decode.sessionId, res);

  res.json({ message: 'Token refreshed' });
});

export const logoutUser = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  const userId = req.user._id;

  await revokeRefreshToken(userId);

  const clearOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
  res.clearCookie('csrfToken', clearOptions);

  await redisClient.del(`user:${userId}`);

  res.json({ message: 'Logged out successfully' });
});

export const refreshCSRF = TryCatch(async (req, res) => {
  const userId = req.user._id;
  const newToken = await generateCSRFToken(userId, res);

  res.json({
    message: 'CSRF refreshed',
    csrfToken: newToken,
  });
});
