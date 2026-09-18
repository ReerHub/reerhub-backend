const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token (bot protection on signup +
 * forgot-password). Bypassed in tests and when no secret is configured
 * (local dev without Cloudflare) — production fail-fasts on a missing
 * TURNSTILE_SECRET_KEY in config/env.js, so this path never runs there.
 */
export const verifyTurnstileToken = async (token, remoteIp) => {
  if (process.env.NODE_ENV === 'test' || !process.env.TURNSTILE_SECRET_KEY) {
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json().catch(() => ({}));
    return json.success === true;
  } catch {
    return false;
  }
};
