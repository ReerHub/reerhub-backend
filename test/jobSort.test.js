import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import app from '../src/app.js';
import Company from '../src/models/company.model.js';
import Job from '../src/models/job.model.js';
import JobSource from '../src/models/jobSource.model.js';

const startServer = () =>
  new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });

test('GET /jobs sort=az orders globally, invalid sort 400s', async () => {
  process.env.NODE_ENV = 'test';
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  const company = await Company.create({
    name: `Sort Co ${stamp}`,
    slug: `sort-co-${stamp}`,
    website: 'https://example.com',
    careersUrl: 'https://example.com/careers',
  });
  const source = await JobSource.create({
    companyId: company._id,
    type: 'custom',
    name: 'Sort source',
    careersUrl: `https://example.com/sort-${stamp}`,
  });
  const now = new Date();
  const seed = ['Zebra Engineer', 'Apple Engineer', 'Mango Engineer'];
  for (const [i, title] of seed.entries()) {
    await Job.create({
      companyId: company._id,
      sourceId: source._id,
      externalJobId: `sort-${stamp}-${i}`,
      title,
      applicationUrl: `https://example.com/apply/sort-${stamp}-${i}`,
      sourceUrl: `https://example.com/jobs/sort-${stamp}-${i}`,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'active',
      contentHash: `sort-${stamp}-${i}`,
    });
  }

  try {
    let res = await fetch(
      `${base}/api/v1/jobs?companyId=${company._id}&sort=az&limit=10`
    );
    assert.equal(res.status, 200);
    const titles = (await res.json()).data.map((j) => j.title);
    assert.deepEqual(titles, ['Apple Engineer', 'Mango Engineer', 'Zebra Engineer']);

    res = await fetch(`${base}/api/v1/jobs?companyId=${company._id}&sort=bogus&limit=10`);
    assert.equal(res.status, 400);

    res = await fetch(`${base}/api/v1/jobs?companyId=${company._id}&limit=10`);
    assert.equal(res.status, 200);
  } finally {
    await Job.deleteMany({ sourceId: source._id });
    await JobSource.findByIdAndDelete(source._id);
    await Company.findByIdAndDelete(company._id);
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
