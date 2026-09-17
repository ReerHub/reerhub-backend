import express from 'express';

import {
  getMe,
  listSavedIds,
  listSavedJobs,
  saveJob,
  unsaveJob,
  updateMe,
} from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import requireAuth from '../middlewares/requireAuth.middleware.js';
import { updateMeSchema } from '../validators/auth.schema.js';

const router = express.Router();

router.use(requireAuth);

router.route('/me').get(getMe).patch(validate(updateMeSchema), updateMe);
router.get('/me/saved', listSavedJobs);
router.get('/me/saved/ids', listSavedIds);
router.post('/me/saved/:jobId', saveJob);
router.delete('/me/saved/:jobId', unsaveJob);

export default router;
