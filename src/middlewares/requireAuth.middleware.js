import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/token.service.js';
import User from '../models/user.model.js';

const requireAuth = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);
    if (!token) return next(new ApiError(401, 'Authentication required'));

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(new ApiError(401, 'Session expired. Please log in again.'));
    }

    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user) return next(new ApiError(401, 'Authentication required'));

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default requireAuth;
