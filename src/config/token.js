import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getRedisClient } from './redis.js';

import { generateCSRFToken, revokeCSRFToken } from './csrf.js';

const ACCESS_TOKEN_EXPIRE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRE = 7 * 24 * 60 * 60; // 7 days
const SESSION_EXPIRE = 7 * 24 * 60 * 60; // 7 days

// Create a new session and store session + refresh token in redis
async function createSession(userId) {
  const redisClient = getRedisClient();
  const sessionId = crypto.randomBytes(16).toString('hex');

  const sessionKey = `session:${sessionId}`;
  const activeSessionKey = `active_session:${userId}`;
  const refreshTokenKey = `refresh_token:${userId}`;

  // Delete previous session if exists
  const oldSessionId = await redisClient.get(activeSessionKey);
  if (oldSessionId) {
    await redisClient.del(`session:${oldSessionId}`);
    await redisClient.del(refreshTokenKey);
  }

  const sessionData = {
    userId,
    sessionId,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  await redisClient.setEx(sessionKey, SESSION_EXPIRE, JSON.stringify(sessionData));
  await redisClient.setEx(activeSessionKey, SESSION_EXPIRE, sessionId);

  return sessionId;
}

// Issue access + refresh tokens
function issueTokens(userId, sessionId) {
  const accessToken = jwt.sign(
    { id: userId, sessionId },
    process.env.JWT_ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRE,
      algorithm: 'HS256',
    }
  );

  const refreshToken = jwt.sign(
    { id: userId, sessionId },
    process.env.JWT_REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRE,
      algorithm: 'HS256',
    }
  );

  return { accessToken, refreshToken };
}

// Set cookies for tokens
function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };

  // Add domain only in production for cross-subdomain access
  if (isProd) {
    cookieOptions.domain = '.amanox.in';
  }

  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_EXPIRE * 1000,
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_EXPIRE * 1000,
  });
}

// Main function to generate tokens & session
export async function generateToken(userId, res) {
  const redisClient = getRedisClient();
  const sessionId = await createSession(userId);
  const { accessToken, refreshToken } = issueTokens(userId, sessionId);

  // Store refresh token in redis
  await redisClient.setEx(`refresh_token:${userId}`, REFRESH_TOKEN_EXPIRE, refreshToken);

  setAuthCookies(res, accessToken, refreshToken);

  // Also generate CSRF token
  const csrfToken = await generateCSRFToken(userId, res);

  return { accessToken, refreshToken, sessionId, csrfToken };
}

// Verify refresh token logic
export async function verifyRefreshToken(refreshToken) {
  const redisClient = getRedisClient();
  try {
    const decode = jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN_SECRET);

    const storedRefreshToken = await redisClient.get(`refresh_token:${decode.id}`);

    if (storedRefreshToken !== refreshToken) return null;

    const activeSessionId = await redisClient.get(`active_session:${decode.id}`);

    if (activeSessionId !== decode.sessionId) return null;

    // Update session last activity
    const sessionKey = `session:${decode.sessionId}`;
    const sessionData = await redisClient.get(sessionKey);
    if (!sessionData) return null;

    const parsed = JSON.parse(sessionData);
    parsed.lastActivity = new Date().toISOString();

    await redisClient.setEx(sessionKey, SESSION_EXPIRE, JSON.stringify(parsed));

    return decode;
  } catch {
    return null;
  }
}

// Generate new access token
export function generateAccessToken(userId, sessionId, res) {
  const accessToken = jwt.sign(
    { id: userId, sessionId },
    process.env.JWT_ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRE,
      algorithm: 'HS256',
    }
  );

  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: ACCESS_TOKEN_EXPIRE * 1000,
    path: '/',
  };

  // Add domain only in production for cross-subdomain access
  if (isProd) {
    cookieOptions.domain = '.amanox.in';
  }

  res.cookie('accessToken', accessToken, cookieOptions);
}

// Revoke user session completely
export async function revokeRefreshToken(userId) {
  const redisClient = getRedisClient();
  const activeSessionId = await redisClient.get(`active_session:${userId}`);

  await redisClient.del(`refresh_token:${userId}`);
  await redisClient.del(`active_session:${userId}`);

  if (activeSessionId) {
    await redisClient.del(`session:${activeSessionId}`);
  }

  await revokeCSRFToken(userId);
}

// Check if a session is active
export async function isSessionActive(userId, sessionId) {
  const redisClient = getRedisClient();
  const stored = await redisClient.get(`active_session:${userId}`);
  return stored === sessionId;
}
