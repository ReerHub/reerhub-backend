import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { getRedisClient } from '../config/redis.js';
import { isSessionActive } from '../config/token.js';

function clearAuthCookies(res) {
  const isProd = process.env.NODE_ENV === 'production';

  const baseOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  };

  res.clearCookie('accessToken', baseOptions);
  res.clearCookie('refreshToken', baseOptions);

  // CSRF token is NOT httpOnly
  res.clearCookie('csrfToken', {
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
}

/**
 * Authentication middleware
 */
export const isAuth = async (req, res, next) => {
  try {
    const redisClient = getRedisClient();
    const token = req.cookies.accessToken;

    // No access token present → user not logged in
    if (!token) {
      return next(new ApiError(403, 'Not authenticated'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    } catch {
      // Access token expired or invalid → allow frontend to auto-refresh
      return next(new ApiError(403, 'ACCESS_TOKEN_EXPIRED'));
    }

    // Check active session in Redis
    const validSession = await isSessionActive(decoded.id, decoded.sessionId);

    if (!validSession) {
      clearAuthCookies(res);
      return next(new ApiError(403, 'ACCESS_TOKEN_EXPIRED'));
    }

    const cachedUser = await redisClient.get(`user:${decoded.id}`);

    if (cachedUser) {
      req.user = JSON.parse(cachedUser);
      req.sessionId = decoded.sessionId;

      // Always fetch dynamic fields fresh
      const fresh = await User.findById(req.user._id).select(
        'coins coinHistory paymentHistory'
      );

      if (fresh) {
        req.user.coins = fresh.coins;
        req.user.coinHistory = fresh.coinHistory;
        req.user.paymentHistory = fresh.paymentHistory;
      }

      return next();
    }

    // Fetch from DB
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new ApiError(404, 'User not found'));

    await redisClient.setEx(`user:${user._id}`, 3600, JSON.stringify(user));

    req.user = user;
    req.sessionId = decoded.sessionId;

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Admin-only middleware
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');

  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }

  next();
};
