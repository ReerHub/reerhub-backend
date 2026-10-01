import mongoose from 'mongoose';

import Company from '../models/company.model.js';
import JobSource from '../models/jobSource.model.js';
import SyncLog from '../models/syncLog.model.js';
import ApiError from '../utils/ApiError.js';
import TryCatch from '../middlewares/async.middleware.js';
import { getAdapter } from '../adapters/index.js';
import { syncJobSource } from '../services/sync.service.js';

export const createJobSource = TryCatch(async (req, res) => {
  const company = await Company.findById(req.validated.companyId).lean();
  if (!company) throw new ApiError(404, 'Company not found');

  const source = await JobSource.create(req.validated);
  res.status(201).json({ success: true, data: source });
});

export const listJobSources = TryCatch(async (req, res) => {
  const filter = {};
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.includeInactive !== 'true') filter.isActive = true;

  const sources = await JobSource.find(filter)
    .populate('companyId', 'name slug')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: sources });
});

export const sourceHealth = TryCatch(async (_req, res) => {
  const sources = await JobSource.find()
    .populate('companyId', 'name slug')
    .sort({ lastSuccessfulSyncAt: 1 })
    .lean();
  const latest = await SyncLog.aggregate([
    { $sort: { startedAt: -1 } },
    {
      $group: {
        _id: '$sourceId',
        status: { $first: '$status' },
        startedAt: { $first: '$startedAt' },
        errors: { $first: '$errors' },
      },
    },
  ]);
  const bySource = new Map(latest.map((row) => [String(row._id), row]));
  const staleBefore = Date.now() - 30 * 60 * 60 * 1000;
  res.status(200).json({
    success: true,
    data: sources.map((source) => ({
      ...source,
      latestRun: bySource.get(String(source._id)) || null,
      isStale:
        !source.lastSuccessfulSyncAt ||
        new Date(source.lastSuccessfulSyncAt).getTime() < staleBefore,
    })),
  });
});

export const triggerSourceSync = TryCatch(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sourceId)) {
    throw new ApiError(400, 'A valid source ID is required');
  }

  const source = await JobSource.findById(req.params.sourceId);
  if (!source) throw new ApiError(404, 'Job source not found');

  const result = await syncJobSource({ source, fetchJobs: getAdapter(source.type) });
  res.status(200).json({ success: true, data: { sourceId: source._id, ...result } });
});
