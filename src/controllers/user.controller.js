import { getRedisClient } from "../config/redis.js";
import TryCatch from "../middlewares/async.middleware.js";
import ApiError from "../utils/ApiError.js";

export const myProfile = TryCatch(async (req, res) => {
  const redisClient = getRedisClient();
  if (!req.user || !req.sessionId) {
    throw new ApiError(401, "Unauthorized");
  }

  const sessionKey = `session:${req.sessionId}`;
  const sessionData = await redisClient.get(sessionKey);

  const sessionInfo = sessionData
    ? { sessionId: req.sessionId, ...JSON.parse(sessionData) }
    : null;

  res.json({ user: req.user, sessionInfo });
});

export const adminController = TryCatch(async (req, res) => {
  res.json({ message: "Welcome Admin. You are authorized." });
});
