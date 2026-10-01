import User from '../models/user.model.js';
import Job from '../models/job.model.js';
import JobRecommendation from '../models/jobRecommendation.model.js';
import Subscription from '../models/subscription.model.js';
import { scoreJobForProfile } from './matching.service.js';
import { sendMatchDigest } from './mail.service.js';

const shouldSendToday = (preference, now) => {
  if (preference === 'paused') return false;
  if (preference === 'weekdays' && [0, 6].includes(now.getUTCDay())) return false;
  if (preference === 'weekly' && now.getUTCDay() !== 1) return false;
  return true;
};

export const sendDailyDigests = async () => {
  const now = new Date();
  const users = await User.find({
    emailVerified: true,
    'notificationPreferences.digest': { $ne: 'paused' },
  }).select('name email profile notificationPreferences');
  let sent = 0;
  for (const user of users) {
    if (!shouldSendToday(user.notificationPreferences?.digest || 'daily', now)) continue;
    const pro = await Subscription.exists({
      userId: user._id,
      status: { $in: ['active', 'trialing'] },
    });
    const limit = pro ? 5 : 1;
    const ignored = new Set(
      (
        await JobRecommendation.find({ userId: user._id, feedback: 'not_relevant' })
          .select('jobId')
          .lean()
      ).map((row) => String(row.jobId))
    );
    const jobs = await Job.find({
      status: 'active',
      isIndiaRole: true,
      firstSeenAt: { $gte: new Date(Date.now() - 14 * 86400000) },
    })
      .populate('companyId', 'name slug')
      .sort({ firstSeenAt: -1 })
      .limit(250)
      .lean();
    const recommendations = jobs
      .filter((job) => !ignored.has(String(job._id)))
      .map((job) => ({ job, fit: scoreJobForProfile(user.profile, job) }))
      .filter((row) => row.fit.score > 0)
      .sort((a, b) => b.fit.score - a.fit.score)
      .slice(0, limit);
    if (!recommendations.length) continue;
    await sendMatchDigest({ to: user.email, name: user.name, recommendations });
    await Promise.all(
      recommendations.map(({ job, fit }) =>
        JobRecommendation.updateOne(
          { userId: user._id, jobId: job._id },
          { $set: { score: fit.score, reasons: fit.reasons, deliveredAt: now } },
          { upsert: true }
        )
      )
    );
    user.notificationPreferences.lastDigestAt = now;
    await user.save();
    sent += 1;
  }
  return { sent };
};
