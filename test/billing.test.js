import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BILLING_PLANS,
  createRazorpaySubscription,
  PLAN_IDS,
  TRIAL_DAYS,
} from '../src/services/razorpay.service.js';
import { checkoutSchema } from '../src/validators/billing.schema.js';

test('trial is 7 days on every plan', () => {
  assert.equal(TRIAL_DAYS, 7);
});

test('plan catalog covers weekly, monthly, quarterly with ~2-year horizons', () => {
  assert.deepEqual([...PLAN_IDS].sort(), ['pro-monthly', 'pro-quarterly', 'pro-weekly']);
  assert.equal(BILLING_PLANS['pro-weekly'].totalCount, 104);
  assert.equal(BILLING_PLANS['pro-monthly'].totalCount, 24);
  assert.equal(BILLING_PLANS['pro-quarterly'].totalCount, 8);
});

test('unknown plan id is rejected before any network call', () => {
  assert.throws(
    () => createRazorpaySubscription({ id: 'u1', email: 'a@b.c' }, 'pro-yearly'),
    /Unknown billing plan/
  );
});

test('checkout starts billing after the 7-day trial with the chosen Razorpay plan', async () => {
  process.env.RAZORPAY_KEY_ID = 'test-key';
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  process.env.RAZORPAY_PRO_QUARTERLY_PLAN_ID = 'plan_quarterly_299';
  const seen = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ id: 'sub_123', status: 'created' }) };
  };
  try {
    const before = Date.now();
    await createRazorpaySubscription({ id: 'u1', email: 'a@b.c' }, 'pro-quarterly');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].body.plan_id, 'plan_quarterly_299');
    assert.equal(seen[0].body.total_count, 8);
    const startAtMs = seen[0].body.start_at * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    assert.ok(
      startAtMs - before >= sevenDaysMs - 5000 && startAtMs - before <= sevenDaysMs + 5000
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_PRO_QUARTERLY_PLAN_ID;
  }
});

test('checkout schema defaults to monthly and rejects unknown plans', () => {
  assert.equal(checkoutSchema.safeParse({}).data.planId, 'pro-monthly');
  assert.equal(
    checkoutSchema.safeParse({ planId: 'pro-weekly' }).data.planId,
    'pro-weekly'
  );
  assert.equal(checkoutSchema.safeParse({ planId: 'pro-yearly' }).success, false);
});
