import express from 'express';

import { getJobById, listJobs } from '../controllers/job.controller.js';
import optionalAuth from '../middlewares/optionalAuth.middleware.js';

const router = express.Router();

router.get('/', optionalAuth, listJobs);
router.get('/:jobId', optionalAuth, getJobById);

export default router;
