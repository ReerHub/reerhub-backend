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
    const values = String(req.query.remoteType)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const allowed = ['onsite', 'hybrid', 'remote', 'unknown'];
    if (values.length === 0 || values.some((v) => !allowed.includes(v))) {
      throw new ApiError(400, 'Invalid remoteType filter');
    }
    filter.remoteType = values.length === 1 ? values[0] : { $in: values };
  }
  // Multi-value aware: comma-separated exact matches (e.g. seniority=Senior,Staff).
  const multiValueFilter = (param, field) => {
    if (!req.query[param]) return;
    const values = String(req.query[param])
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (values.length === 0) return;
    filter[field] = values.length === 1 ? values[0] : { $in: values };
  };
  multiValueFilter('employmentType', 'employmentType');
  multiValueFilter('department', 'department');
  multiValueFilter('seniority', 'seniority');

  // Pure tech platform: only tech tracks are stored, so no techOnly
  // escape hatch is needed. techTrack narrows to one of the 9 tracks,
  // techRole to a canonical role (e.g. "Backend Engineer", "SDET").
  if (req.query.techTrack) {
    const tracks = String(req.query.techTrack)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (tracks.length === 0 || tracks.some((t) => !TECH_TRACKS.includes(t))) {
      throw new ApiError(400, 'Invalid techTrack filter');
    }
    filter.techTrack = tracks.length === 1 ? tracks[0] : { $in: tracks };
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

  // Global sort: updated (default, newest first) or az (title A–Z).
  // Text search keeps relevance order and ignores sort.
  if (req.query.sort && !['updated', 'az'].includes(req.query.sort)) {
    throw new ApiError(400, 'Invalid sort (updated|az)');
  }
  if (req.query.sort === 'az') sort = { title: 1, _id: 1 };

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
