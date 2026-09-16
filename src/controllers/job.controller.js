import mongoose from 'mongoose';

import Job from '../models/job.model.js';
import ApiError from '../utils/ApiError.js';
import TryCatch from '../middlewares/async.middleware.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

export const listJobs = TryCatch(async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePositiveInteger(req.query.limit, 20, 100);
  const filter = { status: req.query.status || 'active' };

  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.city)
    filter['locations.city'] = new RegExp(`^${escapeRegex(req.query.city)}$`, 'i');
  if (req.query.remoteType) filter.remoteType = req.query.remoteType;
  if (req.query.employmentType) filter.employmentType = req.query.employmentType;
  if (req.query.department) filter.department = req.query.department;
  if (req.query.seniority) filter.seniority = req.query.seniority;

  if (req.query.q) {
    const query = String(req.query.q).trim().slice(0, 100);
    if (query) {
      const search = new RegExp(escapeRegex(query), 'i');
      filter.$or = [
        { title: search },
        { normalizedTitle: search },
        { department: search },
        { skills: search },
      ];
    }
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .select('-raw')
      .populate('companyId', 'name slug logoUrl')
      .sort({ postedAt: -1, firstSeenAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: jobs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getJobById = TryCatch(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.jobId)) {
    throw new ApiError(400, 'A valid job ID is required');
  }

  const job = await Job.findById(req.params.jobId)
    .select('-raw')
    .populate('companyId', 'name slug logoUrl website careersUrl')
    .populate('sourceId', 'name type careersUrl')
    .lean();

  if (!job) throw new ApiError(404, 'Job not found');

  res.status(200).json({ success: true, data: job });
});
