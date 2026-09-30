import { z } from 'zod';

// Keep in sync with PLAN_IDS in src/services/razorpay.service.js.
export const checkoutSchema = z.object({
  planId: z
    .enum(['pro-weekly', 'pro-monthly', 'pro-quarterly'])
    .optional()
    .default('pro-monthly'),
});
