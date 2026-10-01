import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import User from '../src/models/user.model.js';
import Company from '../src/models/company.model.js';
import Job from '../src/models/job.model.js';
import JobSource from '../src/models/jobSource.model.js';
import JobRecommendation from '../src/models/jobRecommendation.model.js';
import Subscription from '../src/models/subscription.model.js';
import { sendDailyDigests } from '../src/services/digest.service.js';

// Trial converts on digests: pro members get 5 matches, free users get 1,
// paused users get nothing, and `not_relevant` feedback excludes jobs.
test('daily digests honor pro limits, paused preference, and ignored jobs', async () => {
  process.env.NODE_ENV = 'test';
  // Never send real mail from tests: force sendMail down its dev-log path.
  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const savedSmtp = Object.fromEntries(smtpKeys.map((key) => [key, process.env[key]]));
  for (const key of smtpKeys) delete process.env[key];
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }
  const stamp = Date.now();
  const profile = {
    currentRole: 'Backend Engineer',
    techTrack: 'software',
    skills: ['nodejs'],
  };

  const company = await Company.create({
    name: `Digest Co ${stamp}`,
    slug: `digest-co-${stamp}`,
    website: 'https://example.com',
    careersUrl: 'https://example.com/careers',
  });
  const source = await JobSource.create({
    companyId: company._id,
    type: 'custom',
    name: 'Digest source',
    careersUrl: `https://example.com/digest-${stamp}`,
  });
  const now = new Date();
  const jobs = [];
  for (let i = 0; i < 6; i += 1) {
    jobs.push(
      await Job.create({
        companyId: company._id,
        sourceId: source._id,
        externalJobId: `digest-${stamp}-${i}`,
        title: 'Backend Engineer (Node.js)',
        description: 'Build APIs for millions of users across India.',
        skills: ['nodejs', 'mongodb'],
        techTrack: 'software',
        applicationUrl: `https://example.com/apply/digest-${stamp}-${i}`,
        sourceUrl: `https://example.com/jobs/digest-${stamp}-${i}`,
        isIndiaRole: true,
        firstSeenAt: now,
        lastSeenAt: now,
        status: 'active',
        contentHash: `digest-${stamp}-${i}`,
      })
    );
  }
  const makeUser = (email, digest) =>
    User.create({
      name: `Digest ${digest} ${stamp}`,
      email: `${email}-${stamp}@example.com`,
      authProvider: 'email',
      emailVerified: true,
      profile,
      notificationPreferences: { digest },
    });
  const proUser = await makeUser('pro', 'daily');
  const freeUser = await makeUser('free', 'daily');
  const pausedUser = await makeUser('paused', 'paused');
  await Subscription.create({
    userId: proUser._id,
    providerSubscriptionId: `sub_digest_${stamp}`,
    plan: 'pro-monthly',
    status: 'trialing',
  });
  // Pro already dismissed one job — it must never come back.
  await JobRecommendation.create({
    userId: proUser._id,
    jobId: jobs[0]._id,
    score: 10,
    reasons: ['seed'],
    feedback: 'not_relevant',
  });

  try {
    const result = await sendDailyDigests();
    assert.ok(result.sent >= 2, `expected pro + free digests, got ${result.sent}`);

    const delivered = (userId) =>
      JobRecommendation.find({ userId, deliveredAt: { $exists: true } }).lean();
    const proDelivered = await delivered(proUser._id);
    assert.equal(proDelivered.length, 5);
    assert.ok(
      proDelivered.every((row) => String(row.jobId) !== String(jobs[0]._id)),
      'ignored job is never re-delivered'
    );
    const freeDelivered = await delivered(freeUser._id);
    assert.equal(freeDelivered.length, 1);
    assert.equal((await delivered(pausedUser._id)).length, 0);

    const fresh = (id) => User.findById(id).select('notificationPreferences').lean();
    assert.ok((await fresh(proUser._id)).notificationPreferences.lastDigestAt);
    assert.ok((await fresh(freeUser._id)).notificationPreferences.lastDigestAt);
    assert.equal(
      (await fresh(pausedUser._id)).notificationPreferences.lastDigestAt,
      undefined
    );
  } finally {
    const userIds = [proUser._id, freeUser._id, pausedUser._id];
    await JobRecommendation.deleteMany({ userId: { $in: userIds } });
    await Subscription.deleteOne({ providerSubscriptionId: `sub_digest_${stamp}` });
    await Job.deleteMany({ sourceId: source._id });
    await JobSource.findByIdAndDelete(source._id);
    await Company.findByIdAndDelete(company._id);
    await User.deleteMany({ _id: { $in: userIds } });
    Object.assign(
      process.env,
      Object.fromEntries(
        Object.entries(savedSmtp).filter(([, value]) => value !== undefined)
      )
    );
    await mongoose.disconnect();
  }
});
