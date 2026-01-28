import bcrypt from 'bcrypt';
import crypto from 'crypto';
import sanitize from 'mongo-sanitize';
import { OAuth2Client } from 'google-auth-library';

import { getRedisClient } from '../config/redis.js';
import { sendMail } from '../config/mail.js';

import {
  getOtpHtml,
  getVerifyEmailHtml,
  getResetPasswordHtml,
} from '../utils/emailTemplates/index.js';

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

  // FIXED: Get data from req.validated OR req.body (in case validator strips role)
  // We explicitly extract role and companyName
  const { name, email, password } = req.validated || req.body;
  const { role, companyName } = req.body;

  const rateKey = `register_attempts:${req.ip}:${email}`;
  if (await redisClient.get(rateKey)) {
    throw new ApiError(429, 'Too many requests. Try again later.');
  }

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(400, 'Email already in use');

  // FIXED: Role Security Check
  let userRole = 'candidate'; // Default
  if (role === 'recruiter') {
    userRole = 'recruiter';
  }

  const hashed = await bcrypt.hash(password, 10);

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const redisKey = `verify:${verifyToken}`;

  // FIXED: Save ROLE and COMPANY to Redis
  const tempUserData = {
    name,
    email,
    password: hashed,
    role: userRole,
    companyName: userRole === 'recruiter' ? companyName : undefined,
  };

  await redisClient.set(redisKey, JSON.stringify(tempUserData), {
    EX: 300,
  });

  await sendMail({
    to: email,
    subject: 'Verify your email',
    html: getVerifyEmailHtml({ email, token: verifyToken }),
  });

  await redisClient.set(rateKey, 'true', { EX: 60 });

  res.json({
    message: 'Verification link sent. It expires in 5 minutes',
  });
});

export const verifyUser = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  const { token } = req.params;
  const redisKey = `verify:${token}`;

  const data = await redisClient.get(redisKey);
  if (!data) throw new ApiError(400, 'Verification link expired');

  await redisClient.del(redisKey);

  // FIXED: Parse the full object (which now includes role)
  const userData = JSON.parse(data);

  const exists = await User.findOne({ email: userData.email });
  if (exists) throw new ApiError(400, 'Email already registered');

  // FIXED: Create user with the preserved Role
  const newUser = await User.create({
    name: userData.name,
    email: userData.email,
    password: userData.password,
    role: userData.role || 'candidate', // Fallback just in case
    companyName: userData.companyName,
    coins: 20,
  });

  res.status(201).json({
    message: 'Email verified! Account created.',
    user: {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  });
});

export const loginUser = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  // FIXED: Support req.validated OR req.body
  const { email, password } = req.validated || req.body;

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

// ... The rest of your functions (verifyOtp, googleLogin, etc.) are fine as-is.
// Just make sure verifyOtp returns the user object (which now has the correct role).

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
    user, // This will now contain the correct role
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

  // Safety check
  if (!req.user?._id) return res.json({ message: 'Logged out successfully' });
  const userId = req.user._id;

  await revokeRefreshToken(userId);

  const isProd = process.env.NODE_ENV === 'production';

  const clearOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };

  // Add domain only in production (MUST match the domain used when setting cookies)
  if (isProd) {
    clearOptions.domain = '.amanox.in';
  }

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);

  // CSRF cookie has httpOnly: false, so separate options
  const csrfClearOptions = {
    ...clearOptions,
    httpOnly: false, // CSRF token is not httpOnly
  };

  res.clearCookie('csrfToken', csrfClearOptions);

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

export const googleLogin = TryCatch(async (req, res) => {
  const { idToken } = sanitize(req.body);

  if (!idToken) throw new ApiError(400, 'idToken is required');

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new ApiError(500, 'Google client ID not configured');
  }

  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(400, 'Invalid Google ID token');
  }

  const email = (payload.email || '').toLowerCase();
  const googleId = payload.sub;
  const name = payload.name || email.split('@')[0];

  if (!email) throw new ApiError(400, 'Google account has no email');

  // Find existing user
  let user = await User.findOne({ email }).select(
    '+password +resetPasswordToken +resetPasswordExpires'
  );

  if (user) {
    // If this account previously was not linked to Google, link it now
    if (!user.isGoogleUser) {
      user.googleId = googleId;
      user.isGoogleUser = true;
      // Do NOT overwrite password (we keep existing password)
      await user.save();
    }
  } else {
    // Create a new user for Google sign-in
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashed = await bcrypt.hash(randomPassword, 10);

    user = await User.create({
      name,
      email,
      password: hashed,
      isGoogleUser: true,
      googleId,
      role: 'candidate', // Google Login defaults to Candidate
      coins: 20,
    });
  }

  // Generate tokens (skip OTP)
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

export const forgotPassword = TryCatch(async (req, res) => {
  const { email: raw } = sanitize(req.body);
  const email = (raw || '').toLowerCase();

  if (!email) throw new ApiError(400, 'Email required');

  const user = await User.findOne({ email }).select(
    '+resetPasswordToken +resetPasswordExpires +isGoogleUser'
  );

  // Security: always respond with success message to avoid user enumeration.
  const successResponse = {
    message: 'If an account exists for this email, a password reset link has been sent.',
  };

  if (!user) {
    return res.json(successResponse);
  }

  // If user is a Google-only account, instruct to use Google login instead
  if (user.isGoogleUser) {
    // Do not send reset mail for Google-only accounts to avoid confusing users
    return res.json({
      message: 'Account registered via Google. Use "Continue with Google" to login.',
    });
  }

  // create token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour

  user.resetPasswordToken = hashed;
  user.resetPasswordExpires = new Date(expires);

  await user.save();

  // Send email with plain resetToken
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your password',
      html: getResetPasswordHtml({ name: user.name, resetLink }),
    });
  } catch {
    // cleanup token on failure
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    throw new ApiError(500, 'Failed to send reset email');
  }

  return res.json(successResponse);
});

// ---------- NEW: resetPassword ----------
export const resetPassword = TryCatch(async (req, res) => {
  const { token, password } = sanitize(req.body);

  if (!token || !password) throw new ApiError(400, 'Token and new password are required');

  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password +resetPasswordToken +resetPasswordExpires +isGoogleUser');

  if (!user) throw new ApiError(400, 'Invalid or expired token');

  if (user.isGoogleUser) {
    // If account is Google-linked, do not allow password reset (prefer Google flow)
    throw new ApiError(
      400,
      'This account uses Google Sign-In. Use "Continue with Google" to login.'
    );
  }

  const newHashedPassword = await bcrypt.hash(password, 10);
  user.password = newHashedPassword;

  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;

  await user.save();

  // Based on your preference selected: we will NOT auto-login (you chose redirect to login)
  // Respond success so client redirects to login page.
  res.json({ message: 'Password updated. Please login with your new password.' });
});

export const resendOtp = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  const { email } = sanitize(req.body);

  if (!email) throw new ApiError(400, 'Email is required');

  // Check if user exists
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'User not found');

  // Prevent spam — cooldown of 60 seconds per email
  const cooldownKey = `otp-cooldown:${email}`;
  const cooldown = await redisClient.get(cooldownKey);

  if (cooldown) {
    throw new ApiError(429, 'Please wait a minute before requesting another OTP');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await redisClient.set(`otp:${email}`, otp, { EX: 300 });
  await redisClient.set(cooldownKey, 'true', { EX: 60 });

  await sendMail({
    to: email,
    subject: 'Your OTP',
    html: getOtpHtml({ email, otp }),
  });

  res.json({
    message: 'A new OTP has been sent. Valid for 5 minutes.',
  });
});
