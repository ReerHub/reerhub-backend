import Job from '../models/job.model.js';
import JobRecommendation from '../models/jobRecommendation.model.js';
import TryCatch from '../middlewares/async.middleware.js';
import ApiError from '../utils/ApiError.js';
import { profileCompleteness, scoreJobForProfile } from '../services/matching.service.js';

export const listRecommendations = TryCatch(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 20);
  const jobs = await Job.find({ status: 'active', isIndiaRole: true })
    .select('-raw')
    .populate('companyId', 'name slug logoUrl')
    .sort({ firstSeenAt: -1 })
    .limit(250)
    .lean();
  const ignored = new Set(
    (
      await JobRecommendation.find({ userId: req.user._id, feedback: 'not_relevant' })
        .select('jobId')
        .lean()
    ).map((item) => String(item.jobId))
  );
  const ranked = jobs
    .filter((job) => !ignored.has(String(job._id)))
    .map((job) => ({ ...job, fit: scoreJobForProfile(req.user.profile, job) }))
    .filter((job) => job.fit.score > 0)
    .sort(
      (a, b) =>
        b.fit.score - a.fit.score || new Date(b.firstSeenAt) - new Date(a.firstSeenAt)
    )
    .slice(0, limit);
  await Promise.all(
    ranked.map((job) =>
      JobRecommendation.updateOne(
        { userId: req.user._id, jobId: job._id },
        { $set: { score: job.fit.score, reasons: job.fit.reasons } },
        { upsert: true }
      )
    )
  );
  res
    .status(200)
    .json({
      success: true,
      data: { profileCompletion: profileCompleteness(req.user.profile), jobs: ranked },
    });
});

export const setRecommendationFeedback = TryCatch(async (req, res) => {
  const { jobId } = req.params;
  if (!req.validated?.feedback) throw new ApiError(400, 'Feedback is required');
  await JobRecommendation.updateOne(
    { userId: req.user._id, jobId },
    { $set: { feedback: req.validated.feedback } },
    { upsert: true }
  );
  res.status(200).json({ success: true, data: { feedback: req.validated.feedback } });
});
