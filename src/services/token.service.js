import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { getRedisClient } from '../config/redis.js';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

const accessSecret = () => process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

export const signAccessToken = (userId) => {
  return jwt.sign({ sub: String(userId), type: 'access' }, accessSecret(), {
    expiresIn: ACCESS_TTL,
  });
};

export const signRefreshToken = async (userId) => {
  const jti = crypto.randomBytes(24).toString('hex');
  const token = jwt.sign({ sub: String(userId), type: 'refresh', jti }, refreshSecret(), {
    expiresIn: `${REFRESH_TTL_SECONDS}s`,
  });
  try {
    const redis = getRedisClient();
    await redis.set(`refresh:${jti}`, String(userId), 'EX', REFRESH_TTL_SECONDS);
  } catch {
    // Redis unavailable in some dev/test flows — token still usable until restart.
  }
  return { token, jti };
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, accessSecret());
};

export const verifyRefreshToken = async (token) => {
  const payload = jwt.verify(token, refreshSecret());
  if (payload?.type !== 'refresh' || !payload?.jti) {
    throw new Error('Invalid refresh token');
  }
  try {
    const redis = getRedisClient();
    const stored = await redis.get(`refresh:${payload.jti}`);
    if (!stored || stored !== String(payload.sub)) {
      throw new Error('Refresh token revoked');
    }
  } catch (error) {
    if (error?.message === 'Refresh token revoked') throw error;
    // If Redis is down, fall back to stateless verification.
  }
  return payload;
};

export const revokeRefreshToken = async (jti) => {
  try {
    const redis = getRedisClient();
    await redis.del(`refresh:${jti}`);
  } catch {
    // Best effort.
  }
};

const isProduction = () => process.env.NODE_ENV === 'production';

export const authCookies = (res, { accessToken, refreshToken }) => {
  const base = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: '/',
  };
  res.cookie('accessToken', accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, {
    ...base,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
};

export const clearAuthCookies = (res) => {
  const base = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: '/',
  };
  res.clearCookie('accessToken', base);
  res.clearCookie('refreshToken', base);
};
