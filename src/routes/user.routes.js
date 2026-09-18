import express from 'express';

import {
  changePassword,
  deleteAccount,
  exportData,
  getMe,
  listSavedIds,
  listSavedJobs,
  saveJob,
  unsaveJob,
  updateMe,
} from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import requireAuth from '../middlewares/requireAuth.middleware.js';
import requireCsrf from '../middlewares/requireCsrf.middleware.js';
import { changePasswordSchema, updateMeSchema } from '../validators/auth.schema.js';

const router = express.Router();

router.use(requireAuth);

router.route('/me').get(getMe).patch(validate(updateMeSchema), requireCsrf, updateMe);
router.post('/me/password', validate(changePasswordSchema), requireCsrf, changePassword);
router.get('/me/export', exportData);
router.delete('/me', requireCsrf, deleteAccount);
router.get('/me/saved', listSavedJobs);
router.get('/me/saved/ids', listSavedIds);
router.post('/me/saved/:jobId', requireCsrf, saveJob);
router.delete('/me/saved/:jobId', requireCsrf, unsaveJob);

export default router;
