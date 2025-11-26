import { getRedisClient } from "../config/redis.js";

export async function verifyCSRFToken(req, res, next) {
  try {
    // Allow read-only operations without CSRF
    const redisClient = getRedisClient();
    if (req.method === "GET") return next();

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // CSRF token can come from multiple header names
    const clientToken =
      req.headers["x-csrf-token"] ||
      req.headers["csrf-token"] ||
      req.headers["x-xsrf-token"];

    if (!clientToken) {
      return res.status(403).json({
        message: "CSRF token missing",
        code: "CSRF_TOKEN_MISSING",
      });
    }

    const csrfKey = `csrf_token:${userId}`;
    const storedToken = await redisClient.get(csrfKey);

    if (!storedToken) {
      return res.status(403).json({
        message: "CSRF token expired",
        code: "CSRF_TOKEN_EXPIRED",
      });
    }

    if (storedToken !== clientToken) {
      return res.status(403).json({
        message: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    next();
  } catch (err) {
    console.error("CSRF verification error:", err);
    return res.status(500).json({
      message: "CSRF verification failed",
      code: "CSRF_VERIFICATION_ERROR",
    });
  }
}
