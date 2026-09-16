import express from 'express';

import { createJobSource, listJobSources } from '../controllers/jobSource.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createJobSourceSchema } from '../validators/jobSource.schema.js';

const router = express.Router();

router
  .route('/')
  .get(listJobSources)
  .post(validate(createJobSourceSchema), createJobSource);

export default router;
