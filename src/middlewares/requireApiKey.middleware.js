import ApiError from '../utils/ApiError.js';

/**
 * Guards write endpoints (company/source onboarding, manual sync triggers).
 * Reads stay public. When API_KEY is unset (local dev), writes stay open
 * with a one-time warning so onboarding scripts keep working.
 */
let warned = false;

const requireApiKey = (req, _res, next) => {
  const expected = process.env.API_KEY;
  if (!expected) {
    // Production must never run with open writes. Fail closed so a missing
    // secret is loud instead of silently unprotected.
    if (process.env.NODE_ENV === 'production') {
      return next(new ApiError(500, 'Server misconfigured: API_KEY is not set'));
    }
    if (!warned) {
      warned = true;
      console.warn('⚠️  API_KEY is not set — write endpoints are unprotected.');
    }
    return next();
  }

  const provided = req.headers['x-api-key'];
  if (
    !provided ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return next(new ApiError(401, 'A valid API key is required'));
  }
  return next();
};

export default requireApiKey;
