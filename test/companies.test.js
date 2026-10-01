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

const json = (res) => res.json().catch(() => ({}));

// Company-grid indiaOnly audit: US/foreign roles must never leak onto
// company pages or their counts unless the caller explicitly opts out
// (?indiaOnly=false). Frontend relies on these defaults (no explicit param).
test('company counts and job lists exclude non-India roles by default', async () => {
  process.env.NODE_ENV = 'test';
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  const company = await Company.create({
    name: `Audit Co ${stamp}`,
    slug: `audit-co-${stamp}`,
    website: 'https://example.com',
    careersUrl: 'https://example.com/careers',
  });
  const source = await JobSource.create({
    companyId: company._id,
    type: 'custom',
    name: 'Audit source',
    careersUrl: `https://example.com/a-${stamp}`,
  });
  const now = new Date();
  const seedJob = (suffix, isIndiaRole, city) =>
    Job.create({
      companyId: company._id,
      sourceId: source._id,
      externalJobId: `audit-${stamp}-${suffix}`,
      title: 'Backend Engineer',
      locations: [{ city, country: isIndiaRole ? 'India' : 'United States' }],
      isIndiaRole,
      applicationUrl: `https://example.com/apply/${stamp}-${suffix}`,
      sourceUrl: `https://example.com/jobs/${stamp}-${suffix}`,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'active',
      contentHash: `audit-${stamp}-${suffix}`,
    });
  const indiaJob = await seedJob('in', true, 'Bengaluru');
  const usJob = await seedJob('us', false, 'New York');

  try {
    // Grid counts: default excludes the US role.
    let res = await fetch(`${base}/api/v1/companies`);
    assert.equal(res.status, 200);
    let body = await json(res);
    let row = body.data.find((c) => String(c._id) === String(company._id));
    assert.equal(row.activeJobs, 1);
    res = await fetch(`${base}/api/v1/companies?indiaOnly=false`);
    body = await json(res);
    row = body.data.find((c) => String(c._id) === String(company._id));
    assert.equal(row.activeJobs, 2);

    // Detail header numbers match the jobs list.
    res = await fetch(`${base}/api/v1/companies/${company.slug}`);
    assert.equal(res.status, 200);
    body = await json(res);
    assert.equal(body.data.activeJobs, 1);
    assert.equal(body.data.totalJobs, 1);
    res = await fetch(`${base}/api/v1/companies/${company.slug}?indiaOnly=false`);
    body = await json(res);
    assert.equal(body.data.activeJobs, 2);

    // Company job list (what the grid/detail pages render): no US leak.
    // Anonymous here → teaser shape, but IDs prove the filtering.
    res = await fetch(`${base}/api/v1/jobs?companyId=${company._id}&limit=50`);
    assert.equal(res.status, 200);
    body = await json(res);
    const ids = body.data.map((j) => String(j._id));
    assert.ok(ids.includes(String(indiaJob._id)));
    assert.ok(!ids.includes(String(usJob._id)));
    res = await fetch(
      `${base}/api/v1/jobs?companyId=${company._id}&limit=50&indiaOnly=false`
    );
    body = await json(res);
    assert.equal(body.data.length, 2);
  } finally {
    await Job.deleteMany({ companyId: company._id });
    await JobSource.findByIdAndDelete(source._id);
    await Company.findByIdAndDelete(company._id);
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
