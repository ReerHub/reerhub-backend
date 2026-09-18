import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Company from '../src/models/company.model.js';
import Job from '../src/models/job.model.js';
import JobSource from '../src/models/jobSource.model.js';
import SavedJob from '../src/models/savedJob.model.js';
import {
  loginSchema,
  registerSchema,
  updateMeSchema,
} from '../src/validators/auth.schema.js';
import { comparePassword, hashPassword } from '../src/utils/password.js';

const startServer = () =>
  new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });

const cookiesFrom = (res) => {
  const raw =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return raw.map((c) => c.split(';')[0]).join('; ');
};

const json = (res) => res.json().catch(() => ({}));

// Cookie jar client: tracks Set-Cookie (session + csrf) and echoes the
// CSRF token header on mutations, like lib/auth.ts does in the frontend.

test('auth validators accept and reject', () => {
  assert.ok(
    registerSchema.safeParse({
      name: 'Asha',
      email: 'asha@example.com',
      password: 'password123',
    }).success
  );
  assert.ok(
    !registerSchema.safeParse({ name: 'A', email: 'bad', password: 'short' }).success
  );
  assert.ok(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success);
  assert.ok(
    updateMeSchema.safeParse({
      currentRole: 'Backend Engineer',
      techTrack: 'software',
      skills: ['Node.js'],
      experienceYears: 3,
    }).success
  );
  assert.ok(
    !updateMeSchema.safeParse({
      skills: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
    }).success
  );
  assert.ok(!updateMeSchema.safeParse({ hacker: true }).success);
});

test('password hashing verifies', async () => {
  const hash = await hashPassword('supersecret1');
  assert.ok(await comparePassword('supersecret1', hash));
  assert.ok(!(await comparePassword('wrongpass1', hash)));
});

test('signup/login/me/patch/logout + verify/reset/saved flows', async () => {
  process.env.NODE_ENV = 'test';
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = `auth-${Date.now()}@example.com`;
  const jar = {};
  const store = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const kv = c.split(';')[0];
      const i = kv.indexOf('=');
      jar[kv.slice(0, i).trim()] = kv.slice(i + 1);
    }
  };
  const api = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET' && !jar.csrfToken) {
      store(await fetch(`${base}/api/v1/auth/csrf`));
    }
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const ck = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (ck) headers.Cookie = [headers.Cookie, ck].filter(Boolean).join('; ');
    if (method !== 'GET' && jar.csrfToken) headers['x-csrf-token'] = jar.csrfToken;
    const res = await fetch(url, { ...opts, headers });
    store(res);
    return res;
  };

  try {
    // Unauthenticated /me is rejected (no cookies yet).
    let res = await api(`${base}/api/v1/users/me`);
    assert.equal(res.status, 401);

    // Signup creates session cookies.
    res = await api(`${base}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email,
        password: 'password123',
      }),
    });
    assert.equal(res.status, 201);
    let cookies = cookiesFrom(res);
    assert.ok(cookies.includes('accessToken'));
    const created = await json(res);
    assert.equal(created.data.emailVerified, false);

    // Duplicate signup conflicts.
    res = await api(`${base}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dup', email, password: 'password123' }),
    });
    assert.equal(res.status, 409);

    // Authenticated /me works and exposes profile defaults.
    res = await api(`${base}/api/v1/users/me`, { headers: { Cookie: cookies } });
    assert.equal(res.status, 200);

    // Patch profile with role/track/skills.
    res = await api(`${base}/api/v1/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookies },
      body: JSON.stringify({
        currentRole: 'Backend Engineer',
        techTrack: 'software',
        skills: ['Node.js', 'MongoDB'],
        city: 'Bengaluru',
        experienceYears: 3,
        remoteType: 'hybrid',
      }),
    });
    assert.equal(res.status, 200);
    const patched = await json(res);
    assert.equal(patched.data.profile.currentRole, 'Backend Engineer');
    assert.equal(patched.data.profile.techTrack, 'software');

    // Wrong password rejected with generic message.
    res = await api(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrongpassword1' }),
    });
    assert.equal(res.status, 401);

    // Login re-issues cookies.
    res = await api(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    assert.equal(res.status, 200);
    cookies = cookiesFrom(res);
    assert.ok(cookies.includes('refreshToken'));

    // Google without idToken is a validation error; invalid token is 401.
    res = await api(`${base}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    res = await api(`${base}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'invalid' }),
    });
    assert.equal(res.status, 401);

    // Verify/reset with bogus tokens fail safely; forgot is always 200.
    res = await api(`${base}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus' }),
    });
    assert.equal(res.status, 400);
    res = await api(`${base}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    assert.equal(res.status, 200);
    res = await api(`${base}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    assert.equal(res.status, 200);
    res = await api(`${base}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus', password: 'newpassword1' }),
    });
    assert.equal(res.status, 400);

    // Saved jobs: seed a job, save idempotently, list, unsave.
    const company = await Company.create({
      name: `Auth Co ${Date.now()}`,
      slug: `auth-co-${Date.now()}`,
      website: 'https://example.com',
      careersUrl: 'https://example.com/careers',
    });
    const source = await JobSource.create({
      companyId: company._id,
      type: 'custom',
      name: 'Auth source',
      careersUrl: `https://example.com/c-${Date.now()}`,
    });
    const now = new Date();
    const job = await Job.create({
      companyId: company._id,
      sourceId: source._id,
      externalJobId: `auth-${Date.now()}`,
      title: 'Backend Engineer',
      applicationUrl: 'https://example.com/apply/9',
      sourceUrl: 'https://example.com/jobs/9',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'active',
      contentHash: 'auth-test',
    });

    res = await api(`${base}/api/v1/users/me/saved/${job._id}`, {
      method: 'POST',
      headers: { Cookie: cookies },
    });
    assert.equal(res.status, 200);
    // Idempotent second save.
    res = await api(`${base}/api/v1/users/me/saved/${job._id}`, {
      method: 'POST',
      headers: { Cookie: cookies },
    });
    assert.equal(res.status, 200);

    res = await api(`${base}/api/v1/users/me/saved/ids`, {
      headers: { Cookie: cookies },
    });
    assert.equal(res.status, 200);
    const ids = await json(res);
    assert.ok(ids.data.includes(String(job._id)));

    res = await api(`${base}/api/v1/users/me/saved?page=1&limit=10`, {
      headers: { Cookie: cookies },
    });
    assert.equal(res.status, 200);
    const listed = await json(res);
    assert.equal(listed.meta.total, 1);

    res = await api(`${base}/api/v1/users/me/saved/not-an-id`, {
      method: 'POST',
      headers: { Cookie: cookies },
    });
    assert.equal(res.status, 400);

    res = await api(`${base}/api/v1/users/me/saved/${job._id}`, {
      method: 'DELETE',
      headers: { Cookie: cookies },
    });
    assert.equal(res.status, 200);

    // Logout clears session.
    res = await api(`${base}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookies },
    });
    assert.equal(res.status, 200);

    await SavedJob.deleteMany({ jobId: job._id });
    await Job.findByIdAndDelete(job._id);
    await JobSource.findByIdAndDelete(source._id);
    await Company.findByIdAndDelete(company._id);
    await User.deleteOne({ email });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
