import express from 'express';

import { getJobById, listJobs } from '../controllers/job.controller.js';

const router = express.Router();

router.get('/', listJobs);
router.get('/:jobId', getJobById);

export default router;
