import express from 'express';

import { listSyncLogs } from '../controllers/syncLog.controller.js';

const router = express.Router();

router.get('/', listSyncLogs);

export default router;
