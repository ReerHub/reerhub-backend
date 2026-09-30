import crypto from 'node:crypto';

const apiBase = 'https://api.razorpay.com/v1';

// Free trial before the first charge. Trial = ~7 daily digests, then billing starts.
export const TRIAL_DAYS = 7;

// Plan catalog: id → Razorpay plan env var + billing horizon (~2 years each).
// `pro-monthly` keeps its id so existing subscribers keep working untouched;
// its env var falls back to the legacy RAZORPAY_PRO_PLAN_ID during transition.
export const BILLING_PLANS = {
  'pro-weekly': { envKey: 'RAZORPAY_PRO_WEEKLY_PLAN_ID', totalCount: 104 },
  'pro-monthly': {
    envKey: 'RAZORPAY_PRO_MONTHLY_PLAN_ID',
    fallbackEnvKey: 'RAZORPAY_PRO_PLAN_ID',
    totalCount: 24,
  },
  'pro-quarterly': { envKey: 'RAZORPAY_PRO_QUARTERLY_PLAN_ID', totalCount: 8 },
};

export const PLAN_IDS = Object.keys(BILLING_PLANS);

const credentials = () => {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = process.env;
  return keyId && keySecret
    ? `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
    : null;
};
const request = async (path, method, body) => {
  const authorization = credentials();
  if (!authorization) throw new Error('Razorpay is not configured');
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error?.description || 'Razorpay request failed');
  return payload;
};
export const createRazorpaySubscription = (customer, planId = 'pro-monthly') => {
  const plan = BILLING_PLANS[planId];
  if (!plan) throw new Error(`Unknown billing plan: ${planId}`);
  const razorpayPlanId =
    process.env[plan.envKey] || (plan.fallbackEnvKey && process.env[plan.fallbackEnvKey]);
  if (!razorpayPlanId) throw new Error('Razorpay plan is not configured');
  return request('/subscriptions', 'POST', {
    plan_id: razorpayPlanId,
    total_count: plan.totalCount,
    quantity: 1,
    customer_notify: 1,
    start_at: Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60,
    notes: { reerhubUserId: String(customer.id), email: customer.email, planId },
  });
};
export const cancelRazorpaySubscription = (id) =>
  request(`/subscriptions/${encodeURIComponent(id)}/cancel`, 'POST', {
    cancel_at_cycle_end: 1,
  });
export const verifyRazorpayWebhook = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
