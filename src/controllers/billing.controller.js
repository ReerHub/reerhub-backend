import Subscription from '../models/subscription.model.js';
import TryCatch from '../middlewares/async.middleware.js';
import ApiError from '../utils/ApiError.js';
import {
  cancelRazorpaySubscription,
  createRazorpaySubscription,
  TRIAL_DAYS,
  verifyRazorpayWebhook,
} from '../services/razorpay.service.js';

const present = (subscription) =>
  subscription && {
    plan: subscription.plan,
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt,
    cancelledAt: subscription.cancelledAt,
    payments: subscription.payments || [],
  };
export const getBilling = TryCatch(async (req, res) => {
  const subscription = await Subscription.findOne({ userId: req.user._id }).lean();
  res.status(200).json({ success: true, data: { subscription: present(subscription) } });
});
export const startCheckout = TryCatch(async (req, res) => {
  const existing = await Subscription.findOne({ userId: req.user._id });
  if (['active', 'trialing'].includes(existing?.status))
    return res.status(200).json({
      success: true,
      data: { subscription: present(existing), checkoutUrl: null },
    });
  const planId = req.validated?.planId || 'pro-monthly';
  let remote;
  try {
    remote = await createRazorpaySubscription(
      { id: req.user._id, email: req.user.email },
      planId
    );
  } catch (error) {
    throw new ApiError(503, error.message);
  }
  const subscription = await Subscription.findOneAndUpdate(
    { userId: req.user._id },
    {
      providerSubscriptionId: remote.id,
      plan: planId,
      status: remote.status === 'active' ? 'trialing' : 'pending',
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000),
    },
    { upsert: true, returnDocument: 'after' }
  );
  res.status(201).json({
    success: true,
    data: {
      subscription: present(subscription),
      checkoutUrl: remote.short_url || null,
    },
  });
});
export const cancelSubscription = TryCatch(async (req, res) => {
  const subscription = await Subscription.findOne({ userId: req.user._id });
  if (!subscription?.providerSubscriptionId)
    throw new ApiError(404, 'No subscription to cancel');
  try {
    await cancelRazorpaySubscription(subscription.providerSubscriptionId);
  } catch (error) {
    throw new ApiError(503, error.message);
  }
  subscription.cancelledAt = new Date();
  await subscription.save();
  res.status(200).json({ success: true, data: { subscription: present(subscription) } });
});
export const razorpayWebhook = async (req, res, next) => {
  try {
    if (!verifyRazorpayWebhook(req.body, req.headers['x-razorpay-signature']))
      throw new ApiError(400, 'Invalid webhook signature');
    const event = req.headers['x-razorpay-event'];
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      throw new ApiError(400, 'Invalid webhook payload');
    }
    const entity = payload?.payload?.subscription?.entity;
    if (!entity?.id) return res.status(200).json({ success: true });
    const statuses = {
      authenticated: 'trialing',
      active: 'active',
      pending: 'pending',
      halted: 'past_due',
      cancelled: 'cancelled',
      completed: 'expired',
      expired: 'expired',
    };
    const update = { status: statuses[entity.status] || 'pending' };
    if (entity.current_end)
      update.currentPeriodEndsAt = new Date(entity.current_end * 1000);
    if (event === 'subscription.cancelled') update.cancelledAt = new Date();
    await Subscription.findOneAndUpdate({ providerSubscriptionId: entity.id }, update);
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};
