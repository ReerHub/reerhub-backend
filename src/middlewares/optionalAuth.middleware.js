import { verifyAccessToken } from '../services/token.service.js';
import User from '../models/user.model.js';

// Best-effort session attach for public reads: sets req.user when a valid
// session is present, otherwise continues anonymously (never throws 401).
// Lets list/detail endpoints serve full jobs to members, teasers to guests.
const optionalAuth = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);
    if (!token) return next();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next();
    }

    const user = await User.findById(payload.sub).select('-passwordHash');
    if (user) req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default optionalAuth;
