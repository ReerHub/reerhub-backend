import mongoose from 'mongoose';

import Job from '../models/job.model.js';
import { TECH_TRACKS } from '../services/roleClassifier.service.js';
import ApiError from '../utils/ApiError.js';
import escapeRegex from '../utils/escapeRegex.js';
import TryCatch from '../middlewares/async.middleware.js';

// Indian cities with dual names (ATS boards use either spelling).
// Why: exact-match filters silently drop half the jobs otherwise.
const CITY_ALIASES = {
  bengaluru: ['bengaluru', 'bangalore'],
  bangalore: ['bengaluru', 'bangalore'],
  mumbai: ['mumbai', 'bombay'],
  bombay: ['mumbai', 'bombay'],
  chennai: ['chennai', 'madras'],
  madras: ['chennai', 'madras'],
  kolkata: ['kolkata', 'calcutta'],
  calcutta: ['kolkata', 'calcutta'],
  pune: ['pune', 'poona'],
  gurgaon: ['gurgaon', 'gurugram'],
  gurugram: ['gurgaon', 'gurugram'],
};

const parsePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

export const listJobs = TryCatch(async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1, 1000);
  const limit = parsePositiveInteger(req.query.limit, 20, 100);
  const status = ['active', 'closed'].includes(req.query.status)
    ? req.query.status
    : 'active';
  const filter = { status };

  if (req.query.companyId) {
    if (!mongoose.isValidObjectId(req.query.companyId)) {
      throw new ApiError(400, 'A valid company ID is required');
    }
    filter.companyId = req.query.companyId;
  }
  if (req.query.city) {
    const cityKey = String(req.query.city).trim().toLowerCase();
    const variants = CITY_ALIASES[cityKey] || [req.query.city.trim()];
    filter['locations.city'] = new RegExp(variants.map(escapeRegex).join('|'), 'i');
  }
  if (req.query.remoteType) {
    if (!['onsite', 'hybrid', 'remote', 'unknown'].includes(req.query.remoteType)) {
      throw new ApiError(400, 'Invalid remoteType filter');
    }
    filter.remoteType = req.query.remoteType;
  }
  if (req.query.employmentType) filter.employmentType = req.query.employmentType;
  if (req.query.department) filter.department = req.query.department;
  if (req.query.seniority) filter.seniority = req.query.seniority;

  // Pure tech platform: only tech tracks are stored, so no techOnly
  // escape hatch is needed. techTrack narrows to one of the 9 tracks,
  // techRole to a canonical role (e.g. "Backend Engineer", "SDET").
  if (req.query.techTrack) {
    if (!TECH_TRACKS.includes(req.query.techTrack)) {
      throw new ApiError(400, 'Invalid techTrack filter');
    }
    filter.techTrack = req.query.techTrack;
  }
  if (req.query.techRole) filter.techRole = req.query.techRole;

  // India-first: hide non-India roles unless the caller opts out.
  if (req.query.indiaOnly !== 'false') filter.isIndiaRole = true;

  if (req.query.skills) {
    const skills = String(req.query.skills)
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (skills.length > 0)
      filter.skills = { $in: skills.map((s) => new RegExp(`^${escapeRegex(s)}$`, 'i')) };
  }

  let sort = { postedAt: -1, firstSeenAt: -1 };
  let projection = '-raw';

  if (req.query.q) {
    const query = String(req.query.q).trim().slice(0, 100);
    if (query) {
      // Text index (title/normalizedTitle/department/skills) for indexed search.
      // Falls back to regex when text search yields nothing (e.g. partial words).
      const textMatches = await Job.find({ ...filter, $text: { $search: query } })
        .select('-raw')
        .populate('companyId', 'name slug logoUrl')
        .sort({ score: { $meta: 'textScore' }, postedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      if (textMatches.length > 0) {
        const total = await Job.countDocuments({ ...filter, $text: { $search: query } });
        return res.status(200).json({
          success: true,
          data: textMatches,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }
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
      .select(projection)
      .populate('companyId', 'name slug logoUrl')
      .sort(sort)
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
