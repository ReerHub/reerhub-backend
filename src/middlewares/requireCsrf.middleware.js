import crypto from 'node:crypto';

import ApiError from '../utils/ApiError.js';

/**
 * Double-submit CSRF guard for cookie-authenticated mutations.
 * The frontend reads the `csrfToken` cookie and echoes it in the
 * `x-csrf-token` header. Safe methods always pass through.
 */
const requireCsrf = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookie = req.cookies?.csrfToken;
  const header = req.headers['x-csrf-token'];
  if (typeof cookie !== 'string' || typeof header !== 'string' || !cookie) {
    return next(new ApiError(403, 'Invalid CSRF token'));
  }
  const cookieBuf = Buffer.from(cookie);
  const headerBuf = Buffer.from(header);
  const valid =
    cookieBuf.length === headerBuf.length &&
    cookieBuf.length > 0 &&
    crypto.timingSafeEqual(cookieBuf, headerBuf);
  if (!valid) return next(new ApiError(403, 'Invalid CSRF token'));
  return next();
};

export default requireCsrf;
