import express from 'express';
import requireAuth from '../middlewares/requireAuth.middleware.js';
import requireCsrf from '../middlewares/requireCsrf.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listRecommendations,
  setRecommendationFeedback,
} from '../controllers/recommendation.controller.js';
import { recommendationFeedbackSchema } from '../validators/recommendation.schema.js';

const router = express.Router();
router.use(requireAuth);
router.get('/', listRecommendations);
router.patch(
  '/:jobId/feedback',
  requireCsrf,
  validate(recommendationFeedbackSchema),
  setRecommendationFeedback
);
export default router;
