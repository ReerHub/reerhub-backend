import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Company from '../src/models/company.model.js';
import Job from '../src/models/job.model.js';
import JobSource from '../src/models/jobSource.model.js';
import { signAccessToken } from '../src/services/token.service.js';

const startServer = () =>
  new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });

const json = (res) => res.json().catch(() => ({}));

// Anonymous readers get teasers (excerpt only); members get full jobs.
// Invalid/expired sessions degrade to teaser — never 401 on public reads.
test('jobs list + detail teaser-gate anonymous traffic only', async () => {
  process.env.NODE_ENV = 'test';
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const stamp = Date.now();

  const company = await Company.create({
    name: `Teaser Co ${stamp}`,
    slug: `teaser-co-${stamp}`,
    website: 'https://example.com',
    careersUrl: 'https://example.com/careers',
  });
  const source = await JobSource.create({
    companyId: company._id,
    type: 'custom',
    name: 'Teaser source',
    careersUrl: `https://example.com/t-${stamp}`,
  });
  const now = new Date();
  const job = await Job.create({
    companyId: company._id,
    sourceId: source._id,
    externalJobId: `teaser-${stamp}`,
    title: 'Backend Engineer',
    description:
      '<p>Build APIs and scale systems for millions of users across India.</p>',
    skills: ['nodejs', 'mongodb'],
    applicationUrl: 'https://example.com/apply/teaser',
    sourceUrl: 'https://example.com/jobs/teaser',
    firstSeenAt: now,
    lastSeenAt: now,
    status: 'active',
    contentHash: 'teaser-test',
  });
  const user = await User.create({
    name: 'Teaser User',
    email: `teaser-${stamp}@example.com`,
    authProvider: 'email',
  });
  const memberCookie = `accessToken=${signAccessToken(user._id)}`;

  try {
    // Anonymous list: teasers with excerpt, no gated fields.
    let res = await fetch(`${base}/api/v1/jobs?limit=100`);
    assert.equal(res.status, 200);
    let body = await json(res);
    const anon = body.data.find((j) => String(j._id) === String(job._id));
    assert.ok(anon, 'seeded job is listed');
    assert.ok(anon.excerpt);
    assert.ok(anon.excerpt.length <= 160);
    assert.ok(!('description' in anon));
    assert.ok(!('skills' in anon));
    assert.ok(!('applicationUrl' in anon));
    assert.equal(anon.title, 'Backend Engineer');

    // Anonymous detail: same teaser shape.
    res = await fetch(`${base}/api/v1/jobs/${job._id}`);
    assert.equal(res.status, 200);
    body = await json(res);
    assert.ok(body.data.excerpt);
    assert.ok(!('description' in body.data));
    assert.ok(!('skills' in body.data));
    assert.ok(!('applicationUrl' in body.data));

    // Bogus session degrades to teaser (still 200, never 401).
    res = await fetch(`${base}/api/v1/jobs/${job._id}`, {
      headers: { Cookie: 'accessToken=bogus' },
    });
    assert.equal(res.status, 200);
    body = await json(res);
    assert.ok(body.data.excerpt);
    assert.ok(!('description' in body.data));

    // Member list + detail: full fields, no excerpt.
    res = await fetch(`${base}/api/v1/jobs?limit=100`, {
      headers: { Cookie: memberCookie },
    });
    assert.equal(res.status, 200);
    body = await json(res);
    const full = body.data.find((j) => String(j._id) === String(job._id));
    assert.ok(full.description.includes('Build APIs'));
    assert.ok(full.skills.includes('nodejs'));
    assert.equal(full.applicationUrl, 'https://example.com/apply/teaser');
    assert.ok(!('excerpt' in full));

    res = await fetch(`${base}/api/v1/jobs/${job._id}`, {
      headers: { Cookie: memberCookie },
    });
    assert.equal(res.status, 200);
    body = await json(res);
    assert.ok(body.data.description.includes('Build APIs'));
    assert.equal(body.data.applicationUrl, 'https://example.com/apply/teaser');
    assert.ok(!('excerpt' in body.data));
  } finally {
    await Job.findByIdAndDelete(job._id);
    await JobSource.findByIdAndDelete(source._id);
    await Company.findByIdAndDelete(company._id);
    await User.findByIdAndDelete(user._id);
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
