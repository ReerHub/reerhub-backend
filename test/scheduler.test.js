import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import Company from '../src/models/company.model.js';
import JobSource from '../src/models/jobSource.model.js';
import { ensureDailySchedules } from '../src/workers/scheduler.js';

// Stale BullMQ repeat jobs for deleted sources must be pruned on boot.
// Uses a fake queue (no Redis needed) + isolated test database.
test('ensureDailySchedules upserts active and prunes stale schedulers', async () => {
  process.env.NODE_ENV = 'test';
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }

  const stamp = Date.now();
  const company = await Company.create({
    name: `Sched Co ${stamp}`,
    slug: `sched-co-${stamp}`,
    website: 'https://example.com',
    careersUrl: 'https://example.com/careers',
  });
  const active = await JobSource.create({
    companyId: company._id,
    type: 'custom',
    name: 'Active source',
    careersUrl: `https://example.com/sched-${stamp}`,
  });
  const ghostId = new mongoose.Types.ObjectId();

  const upserted = [];
  const removed = [];
  const fakeQueue = {
    upserted,
    removed,
    async upsertJobScheduler(name, opts) {
      upserted.push([name, opts]);
    },
    async getJobSchedulers() {
      return [
        { name: `daily-${active._id}` },
        { name: `daily-${ghostId}` },
        { name: 'something-else' },
        { id: `daily-${ghostId}` },
        null,
      ];
    },
    async removeJobScheduler(name) {
      removed.push(name);
    },
  };

  try {
    await ensureDailySchedules(fakeQueue);

    assert.ok(
      upserted.some(([name]) => name === `daily-${active._id}`),
      'active source is (re)scheduled'
    );
    assert.deepEqual(
      removed.filter((n) => n === `daily-${ghostId}`).length,
      2,
      'both stale scheduler shapes are removed'
    );
    assert.ok(!removed.includes('something-else'), 'non-daily schedulers are untouched');
    assert.ok(
      !removed.includes(`daily-${active._id}`),
      'active scheduler is not removed'
    );
  } finally {
    await JobSource.findByIdAndDelete(active._id);
    await Company.findByIdAndDelete(company._id);
    await mongoose.disconnect();
  }
});
