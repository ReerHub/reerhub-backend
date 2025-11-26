import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { getRedisClient } from "../config/redis.js";
import { isSessionActive } from "../config/token.js";

const USER_CACHE_TTL = 60 * 60; // 1 hour

/**
 * Clear cookies with correct security flags
 */
function clearAuthCookies(res) {
  const isProd = process.env.NODE_ENV === "production";

  const baseOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  };

  res.clearCookie("accessToken", baseOptions);
  res.clearCookie("refreshToken", baseOptions);

  // CSRF token is NOT httpOnly
  res.clearCookie("csrfToken", {
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
}

/**
 * Authentication middleware
 */
export const isAuth = async (req, res, next) => {
  try {
    const redisClient = getRedisClient();
    const token = req.cookies.accessToken;

    if (!token) {
      throw new ApiError(401, "Please login first");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    } catch (err) {
      throw new ApiError(401, "Invalid or expired token");
    }

    // Validate session via Redis
    const validSession = await isSessionActive(decoded.id, decoded.sessionId);
    if (!validSession) {
      clearAuthCookies(res);
      throw new ApiError(
        401,
        "Session expired or logged in from another device"
      );
    }

    // Check user cache
    const cachedUser = await redisClient.get(`user:${decoded.id}`);
    if (cachedUser) {
      req.user = JSON.parse(cachedUser);
      req.sessionId = decoded.sessionId;
      return next();
    }

    // Fetch from DB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) throw new ApiError(404, "User not found");

    // Cache for next time
    await redisClient.setEx(
      `user:${user._id}`,
      USER_CACHE_TTL,
      JSON.stringify(user)
    );

    req.user = user;
    req.sessionId = decoded.sessionId;

    next();
  } catch (err) {
    next(err); // Pass to global error handler
  }
};

/**
 * Admin-only middleware
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  if (req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  next();
};
