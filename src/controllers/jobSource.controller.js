import mongoose from 'mongoose';

import Company from '../models/company.model.js';
import JobSource from '../models/jobSource.model.js';
import ApiError from '../utils/ApiError.js';
import TryCatch from '../middlewares/async.middleware.js';
import { enqueueSourceSync } from '../workers/scheduler.js';

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

export const triggerSourceSync = TryCatch(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sourceId)) {
    throw new ApiError(400, 'A valid source ID is required');
  }

  const source = await JobSource.findById(req.params.sourceId).lean();
  if (!source) throw new ApiError(404, 'Job source not found');

  const job = await enqueueSourceSync(source._id.toString());
  res
    .status(202)
    .json({ success: true, data: { queueJobId: job.id, sourceId: source._id } });
});
