import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    razorpayPaymentId: { type: String, trim: true },
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, trim: true },
    paidAt: { type: Date },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
    providerSubscriptionId: { type: String, unique: true, sparse: true, index: true },
    plan: {
      type: String,
      enum: ['pro-weekly', 'pro-monthly', 'pro-quarterly'],
      default: 'pro-monthly',
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'pending', 'past_due', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    trialEndsAt: { type: Date },
    currentPeriodEndsAt: { type: Date },
    cancelledAt: { type: Date },
    payments: { type: [paymentSchema], default: [] },
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, currentPeriodEndsAt: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
