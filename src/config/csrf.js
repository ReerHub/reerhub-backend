import crypto from "crypto";
import { getRedisClient } from "./redis.js";

const CSRF_EXPIRE = 3600; // 1 hour

// Create new CSRF token & store in Redis
export async function generateCSRFToken(userId, res) {
  const redis = getRedisClient(); // ✔ get redis ONLY inside function

  const csrfToken = crypto.randomBytes(32).toString("hex");
  const csrfKey = `csrf_token:${userId}`;

  await redis.setEx(csrfKey, CSRF_EXPIRE, csrfToken);

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("csrfToken", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: CSRF_EXPIRE * 1000,
  });

  return csrfToken;
}

export async function revokeCSRFToken(userId) {
  const redis = getRedisClient(); // ✔ fetch redis client inside function

  const csrfKey = `csrf_token:${userId}`;
  await redis.del(csrfKey);
}

export async function refreshCSRFToken(userId, res) {
  const redis = getRedisClient(); // ✔ fetch redis client inside function

  await revokeCSRFToken(userId);
  return await generateCSRFToken(userId, res);
}
