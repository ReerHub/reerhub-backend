import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import app from '../src/app.js';
import Subscription from '../src/models/subscription.model.js';
import { verifyRazorpayWebhook } from '../src/services/razorpay.service.js';

const startServer = () =>
  new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });

const sign = (rawBody) =>
  crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

const webhookBody = (overrides = {}) =>
  Buffer.from(
    JSON.stringify({
      event: 'subscription.authenticated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_123',
            status: 'authenticated',
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
            ...overrides,
          },
        },
      },
    })
  );

test('webhook signature verification accepts, rejects, and requires a Buffer', () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec-test-example';
  const raw = Buffer.from('{"event":"ping"}');
  try {
    assert.equal(verifyRazorpayWebhook(raw, sign(raw)), true);
    assert.equal(verifyRazorpayWebhook(raw, 'deadbeef'), false);
    assert.equal(verifyRazorpayWebhook('{"event":"ping"}', sign(raw)), false);
    assert.equal(verifyRazorpayWebhook(raw, undefined), false);
  } finally {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  }
});

test('webhook rejects bad signatures and maps lifecycle events to subscription state', async () => {
  process.env.NODE_ENV = 'test';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec-test-e2e-example';
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();
  const userId = new mongoose.Types.ObjectId();

  await Subscription.create({
    userId,
    providerSubscriptionId: `sub_test_${stamp}`,
    plan: 'pro-monthly',
    status: 'trialing',
  });

  const post = (raw, signature, event = 'subscription.authenticated') =>
    fetch(`${base}/api/v1/webhooks/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event': event,
      },
      body: raw,
    });
  const current = () =>
    Subscription.findOne({ providerSubscriptionId: `sub_test_${stamp}` }).lean();

  try {
    // Bad signature → 400, state untouched.
    let res = await post(webhookBody({ id: `sub_test_${stamp}` }), 'bad-signature');
    assert.equal(res.status, 400);
    assert.equal((await current()).status, 'trialing');

    // Authenticated → trialing with period end recorded.
    const activeAt = Math.floor(Date.now() / 1000) + 30 * 86400;
    let raw = webhookBody({ id: `sub_test_${stamp}`, current_end: activeAt });
    res = await post(raw, sign(raw), 'subscription.authenticated');
    assert.equal(res.status, 200);
    let sub = await current();
    assert.equal(sub.status, 'trialing');
    assert.equal(new Date(sub.currentPeriodEndsAt).getTime(), activeAt * 1000);

    // Halted (failed payment) → past_due.
    raw = webhookBody({ id: `sub_test_${stamp}`, status: 'halted' });
    res = await post(raw, sign(raw), 'subscription.halted');
    assert.equal(res.status, 200);
    assert.equal((await current()).status, 'past_due');

    // Cancelled → cancelled with cancelledAt stamped.
    raw = webhookBody({ id: `sub_test_${stamp}`, status: 'cancelled' });
    res = await post(raw, sign(raw), 'subscription.cancelled');
    assert.equal(res.status, 200);
    sub = await current();
    assert.equal(sub.status, 'cancelled');
    assert.ok(sub.cancelledAt);

    // Unknown subscription id → 200 no-op (idempotent retries stay green).
    raw = webhookBody({ id: `sub_unknown_${stamp}` });
    res = await post(raw, sign(raw), 'subscription.activated');
    assert.equal(res.status, 200);

    // Malformed JSON with a valid signature → 400, not 500.
    const broken = Buffer.from('{"event":');
    res = await post(broken, sign(broken), 'subscription.authenticated');
    assert.equal(res.status, 400);
  } finally {
    await Subscription.deleteOne({ providerSubscriptionId: `sub_test_${stamp}` });
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
