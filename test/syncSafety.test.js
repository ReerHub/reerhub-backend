import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import Company from '../src/models/company.model.js';
import Job from '../src/models/job.model.js';
import JobSource from '../src/models/jobSource.model.js';
import SyncLog from '../src/models/syncLog.model.js';
import { syncJobSource } from '../src/services/sync.service.js';

// Non-negotiable #5: a failed source sync must never close existing jobs.
// Uses the real Mongo (same MONGO_URI as dev) with temp docs, cleaned up after.
test('failed sync never closes existing jobs', async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });

  const company = await Company.create({
    name: `Test Co ${Date.now()}`,
    slug: `test-co-${Date.now()}`,
    website: 'https://example.com',
    careersUrl: 'https://example.com/careers',
  });
  const source = await JobSource.create({
    companyId: company._id,
    type: 'custom',
    name: 'Test source',
    careersUrl: `https://example.com/careers-${Date.now()}`,
  });
  const now = new Date();
  await Job.create({
    companyId: company._id,
    sourceId: source._id,
    externalJobId: `test-${Date.now()}`,
    title: 'Existing Engineer',
    applicationUrl: 'https://example.com/apply/1',
    sourceUrl: 'https://example.com/jobs/1',
    firstSeenAt: now,
    lastSeenAt: now,
    status: 'active',
    contentHash: 'abc',
  });

  try {
    await assert.rejects(
      syncJobSource({
        source,
        fetchJobs: async () => {
          throw new Error('ATS is down');
        },
      }),
      /ATS is down/
    );

    const job = await Job.findOne({ sourceId: source._id });
    assert.equal(job.status, 'active');

    const log = await SyncLog.findOne({ sourceId: source._id }).sort({ startedAt: -1 });
    assert.equal(log.status, 'failed');
  } finally {
    await Job.deleteMany({ sourceId: source._id });
    await SyncLog.deleteMany({ sourceId: source._id });
    await JobSource.findByIdAndDelete(source._id);
    await Company.findByIdAndDelete(company._id);
    await mongoose.disconnect();
  }
});
