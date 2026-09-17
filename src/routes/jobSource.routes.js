import express from 'express';

import {
  createJobSource,
  listJobSources,
  triggerSourceSync,
} from '../controllers/jobSource.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import requireApiKey from '../middlewares/requireApiKey.middleware.js';
import { createJobSourceSchema } from '../validators/jobSource.schema.js';

const router = express.Router();

router
  .route('/')
  .get(listJobSources)
  .post(requireApiKey, validate(createJobSourceSchema), createJobSource);

router.post('/:sourceId/sync', requireApiKey, triggerSourceSync);

export default router;
