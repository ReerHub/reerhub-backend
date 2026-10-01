import express from 'express';
import requireAuth from '../middlewares/requireAuth.middleware.js';
import requireCsrf from '../middlewares/requireCsrf.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { checkoutSchema } from '../validators/billing.schema.js';
import {
  cancelSubscription,
  getBilling,
  startCheckout,
} from '../controllers/billing.controller.js';
const router = express.Router();
router.use(requireAuth);
router.get('/', getBilling);
router.post('/checkout', requireCsrf, validate(checkoutSchema), startCheckout);
router.post('/cancel', requireCsrf, cancelSubscription);
export default router;
