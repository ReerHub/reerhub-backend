import SyncLog from '../models/syncLog.model.js';
import TryCatch from '../middlewares/async.middleware.js';

export const listSyncLogs = TryCatch(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
  const filter = {};
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.sourceId) filter.sourceId = req.query.sourceId;
  if (req.query.status) filter.status = req.query.status;

  const logs = await SyncLog.find(filter)
    .populate('companyId', 'name slug')
    .populate('sourceId', 'name type')
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();

  res.status(200).json({ success: true, data: logs });
});
