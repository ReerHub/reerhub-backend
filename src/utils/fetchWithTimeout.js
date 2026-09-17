const FETCH_TIMEOUT_MS = Number(process.env.ADAPTER_FETCH_TIMEOUT_MS) || 30000;

/**
 * Shared ATS fetch: hard timeout + identifying user-agent.
 * Why: a hung board must never hold a BullMQ worker slot forever, and
 * public APIs deserve a contactable caller. Still calls globalThis.fetch
 * so tests can stub it.
 */
export const fetchWithTimeout = async (url, options = {}) => {
  const response = await globalThis.fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'WareersBot/1.0 (+https://wareers.com)',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return response;
};
