import mongoose from 'mongoose';

import TryCatch from '../middlewares/async.middleware.js';
import ApiError from '../utils/ApiError.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import {
  authCookies,
  clearAuthCookies,
  revokeRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/token.service.js';
import User from '../models/user.model.js';
import Job from '../models/job.model.js';
import SavedJob from '../models/savedJob.model.js';

const toPublicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  authProvider: user.authProvider,
  role: user.role,
  emailVerified: user.emailVerified,
  profile: user.profile || {},
  createdAt: user.createdAt,
});

export const getMe = TryCatch(async (req, res) => {
  res.status(200).json({ success: true, data: toPublicUser(req.user) });
});

export const updateMe = TryCatch(async (req, res) => {
  const allowed = [
    'name',
    'avatarUrl',
    'headline',
    'currentRole',
    'techTrack',
    'techRoles',
    'skills',
    'city',
    'experienceYears',
    'remoteType',
  ];
  const { name, avatarUrl, ...profilePatch } = req.validated;

  const update = {};
  if (name !== undefined) update.name = name;
  if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;
  Object.entries(profilePatch).forEach(([key, value]) => {
    if (allowed.includes(key) && value !== undefined) {
      update[`profile.${key}`] = value;
    }
  });

  const user = await User.findByIdAndUpdate(req.user._id, update, {
    new: true,
  }).select('-passwordHash');
  res.status(200).json({ success: true, data: toPublicUser(user) });
});

const parseJobId = (raw) => {
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw new ApiError(400, 'Invalid job id');
  }
  return raw;
};

export const saveJob = TryCatch(async (req, res) => {
  const jobId = parseJobId(req.params.jobId);
  const job = await Job.findById(jobId).select('_id');
  if (!job) throw new ApiError(404, 'Job not found');

  await SavedJob.updateOne(
    { userId: req.user._id, jobId: job._id },
    { $setOnInsert: { userId: req.user._id, jobId: job._id } },
    { upsert: true }
  );
  res.status(200).json({ success: true, data: { saved: true } });
});

export const unsaveJob = TryCatch(async (req, res) => {
  const jobId = parseJobId(req.params.jobId);
  await SavedJob.deleteOne({ userId: req.user._id, jobId });
  res.status(200).json({ success: true, data: { saved: false } });
});

export const listSavedIds = TryCatch(async (req, res) => {
  const saved = await SavedJob.find({ userId: req.user._id }).select('jobId').lean();
  res.status(200).json({
    success: true,
    data: saved.map((s) => String(s.jobId)),
  });
});

export const listSavedJobs = TryCatch(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 21));
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    SavedJob.countDocuments({ userId: req.user._id }),
    SavedJob.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'jobId',
        select:
          'title companyId techTrack techRole seniority locations remoteType skills applicationUrl status',
        populate: { path: 'companyId', select: 'name slug logoUrl' },
      })
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: rows
      .filter((row) => row.jobId)
      .map((row) => ({ ...row.jobId, savedAt: row.createdAt })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

export const changePassword = TryCatch(async (req, res) => {
  const { currentPassword, newPassword } = req.validated;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user?.passwordHash) {
    throw new ApiError(400, 'Password login is not enabled for this account');
  }
  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Current password is incorrect');

  await User.updateOne(
    { _id: user._id },
    { passwordHash: await hashPassword(newPassword) }
  );
  // Rotate the session so a compromised refresh token dies with the change.
  const presented = req.cookies?.refreshToken;
  if (presented) {
    try {
      const payload = await verifyRefreshToken(presented);
      await revokeRefreshToken(payload.jti);
    } catch {
      // Continue — new session is issued below regardless.
    }
  }
  const accessToken = signAccessToken(user._id);
  const { token: refreshToken } = await signRefreshToken(user._id);
  authCookies(res, { accessToken, refreshToken });
  res.status(200).json({ success: true, data: { changed: true } });
});

export const exportData = TryCatch(async (req, res) => {
  const [user, saved] = await Promise.all([
    User.findById(req.user._id).select('-passwordHash').lean(),
    SavedJob.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'jobId',
        select: 'title companyId techTrack techRole applicationUrl status',
        populate: { path: 'companyId', select: 'name slug' },
      })
      .lean(),
  ]);
  res.status(200).json({
    success: true,
    data: {
      user,
      savedJobs: saved.filter((row) => row.jobId),
      counts: { savedJobs: saved.length },
      exportedAt: new Date().toISOString(),
    },
  });
});

export const deleteAccount = TryCatch(async (req, res) => {
  await SavedJob.deleteMany({ userId: req.user._id });
  await User.deleteOne({ _id: req.user._id });
  clearAuthCookies(res);
  res.status(200).json({ success: true, data: { deleted: true } });
});
