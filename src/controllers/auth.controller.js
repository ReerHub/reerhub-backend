import crypto from 'node:crypto';

import TryCatch from '../middlewares/async.middleware.js';
import ApiError from '../utils/ApiError.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import User from '../models/user.model.js';
import {
  authCookies,
  clearAuthCookies,
  revokeRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/token.service.js';
import { verifyGoogleIdToken } from '../services/google.service.js';
import {
  consumeResetToken,
  consumeVerifyToken,
  issueResetToken,
  issueVerifyToken,
  sendResetEmail,
  sendVerifyEmail,
} from '../services/mail.service.js';

const toPublicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  authProvider: user.authProvider,
  role: user.role,
  emailVerified: user.emailVerified,
  profile: user.profile || {},
  createdAt: user.createdAt,
});

const issueSession = async (res, userId) => {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken } = await signRefreshToken(userId);
  authCookies(res, { accessToken, refreshToken });
};

export const signup = TryCatch(async (req, res) => {
  const { name, email, password } = req.validated;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email exists');

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    authProvider: 'email',
  });

  await issueSession(res, user._id);
  try {
    const token = await issueVerifyToken(user._id);
    await sendVerifyEmail({ to: user.email, token });
  } catch {
    // Email is best-effort; signup still succeeds.
  }

  res.status(201).json({ success: true, data: toPublicUser(user) });
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const login = TryCatch(async (req, res) => {
  const { email, password } = req.validated;
  // Generic messages throughout to avoid user enumeration.
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash +failedLoginAttempts +lockUntil'
  );
  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(429, 'Too many attempts. Try again later.');
  }
  const valid =
    user?.passwordHash && (await comparePassword(password, user.passwordHash));
  if (!user || !valid) {
    // Per-account throttle: lock after repeated failures (generic message).
    if (user) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      await User.updateOne(
        { _id: user._id },
        attempts >= MAX_LOGIN_ATTEMPTS
          ? {
              failedLoginAttempts: 0,
              lockUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000),
            }
          : { failedLoginAttempts: attempts }
      );
    }
    throw new ApiError(401, 'Invalid email or password');
  }

  await User.updateOne({ _id: user._id }, { failedLoginAttempts: 0, lockUntil: null });
  await issueSession(res, user._id);
  const fresh = await User.findById(user._id).select('-passwordHash');
  res.status(200).json({ success: true, data: toPublicUser(fresh) });
});

export const googleLogin = TryCatch(async (req, res) => {
  const { idToken } = req.validated;
  let profile;
  try {
    profile = await verifyGoogleIdToken(idToken);
  } catch {
    throw new ApiError(401, 'Google sign-in failed. Please try again.');
  }

  let user =
    (await User.findOne({ googleId: profile.googleId })) ||
    (await User.findOne({ email: profile.email }));

  if (!user) {
    user = await User.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      authProvider: 'google',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });
  } else {
    let changed = false;
    if (!user.googleId) {
      user.googleId = profile.googleId;
      changed = true;
    }
    if (profile.avatarUrl && !user.avatarUrl) {
      user.avatarUrl = profile.avatarUrl;
      changed = true;
    }
    if (profile.emailVerified && !user.emailVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      changed = true;
    }
    if (changed) await user.save();
  }

  await issueSession(res, user._id);
  const fresh = await User.findById(user._id).select('-passwordHash');
  res.status(200).json({ success: true, data: toPublicUser(fresh) });
});

export const refresh = TryCatch(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'Session expired. Please log in again.');

  let payload;
  try {
    payload = await verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  // Rotate: revoke the used refresh token, issue a fresh pair.
  // Deleted accounts cannot refresh (orphaned Redis entries die on TTL).
  const owner = await User.findById(payload.sub).select('_id');
  if (!owner) {
    await revokeRefreshToken(payload.jti);
    throw new ApiError(401, 'Session expired. Please log in again.');
  }
  await revokeRefreshToken(payload.jti);
  await issueSession(res, payload.sub);
  res.status(200).json({ success: true, data: { id: String(payload.sub) } });
});

export const logout = TryCatch(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = await verifyRefreshToken(token);
      await revokeRefreshToken(payload.jti);
    } catch {
      // Already invalid — still clear cookies.
    }
  }
  clearAuthCookies(res);
  res.status(200).json({ success: true, data: { loggedOut: true } });
});

export const requestVerifyEmail = TryCatch(async (req, res) => {
  const token = await issueVerifyToken(req.user._id);
  await sendVerifyEmail({ to: req.user.email, token });
  res.status(200).json({ success: true, data: { sent: true } });
});

export const verifyEmail = TryCatch(async (req, res) => {
  const userId = await consumeVerifyToken(req.validated.token);
  if (!userId) throw new ApiError(400, 'Invalid or expired verification link');

  await User.findByIdAndUpdate(userId, {
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });
  res.status(200).json({ success: true, data: { verified: true } });
});

export const forgotPassword = TryCatch(async (req, res) => {
  const user = await User.findOne({ email: req.validated.email });
  // Always 200 to avoid email enumeration.
  if (user && user.authProvider === 'email') {
    const token = await issueResetToken(user._id);
    try {
      await sendResetEmail({ to: user.email, token });
    } catch {
      // Best effort.
    }
  }
  res.status(200).json({
    success: true,
    data: { sent: true },
  });
});

export const resetPassword = TryCatch(async (req, res) => {
  const userId = await consumeResetToken(req.validated.token);
  if (!userId) throw new ApiError(400, 'Invalid or expired reset link');

  const passwordHash = await hashPassword(req.validated.password);
  await User.findByIdAndUpdate(userId, { passwordHash });
  res.status(200).json({ success: true, data: { reset: true } });
});

export const csrf = TryCatch(async (req, res) => {
  const token = req.cookies?.csrfToken || crypto.randomBytes(32).toString('hex');
  const prod = process.env.NODE_ENV === 'production';
  res.cookie('csrfToken', token, {
    httpOnly: false,
    secure: prod,
    sameSite: prod ? 'none' : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.status(200).json({ success: true, data: { csrfToken: token } });
});
