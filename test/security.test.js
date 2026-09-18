import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import '../src/config/env.js';
import app from '../src/app.js';
import User from '../src/models/user.model.js';

const startServer = () =>
  new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });

const json = (res) => res.json().catch(() => ({}));

test('csrf enforced, lockout, change-password, export, delete', async () => {
  process.env.NODE_ENV = 'test';
  const dbName = process.env.MONGO_DB_NAME || 'reerhub-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, { dbName });
  }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = `sec-${Date.now()}@example.com`;
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
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });

  try {
    // CSRF issuer sets a readable cookie + body token.
    let res = await fetch(`${base}/api/v1/auth/csrf`);
    assert.equal(res.status, 200);
    const issued = await json(res);
    assert.ok(issued.data?.csrfToken);

    // Mutations without CSRF are rejected even with valid body.
    res = await fetch(`${base}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Csrf', email, password: 'password123' }),
    });
    assert.equal(res.status, 403);

    // Signup with CSRF succeeds.
    res = await post(`${base}/api/v1/auth/signup`, {
      name: 'Sec User',
      email,
      password: 'password123',
    });
    assert.equal(res.status, 201);

    // Four wrong passwords → 401; fifth arms the lock; sixth → 429.
    for (let i = 0; i < 4; i++) {
      res = await post(`${base}/api/v1/auth/login`, {
        email,
        password: 'wrongpassword1',
      });
      assert.equal(res.status, 401);
    }
    res = await post(`${base}/api/v1/auth/login`, {
      email,
      password: 'wrongpassword1',
    });
    assert.equal(res.status, 401);
    res = await post(`${base}/api/v1/auth/login`, {
      email,
      password: 'wrongpassword1',
    });
    assert.equal(res.status, 429);
    // Correct password is also rejected while locked (generic message).
    res = await post(`${base}/api/v1/auth/login`, {
      email,
      password: 'password123',
    });
    assert.equal(res.status, 429);

    // Unlock manually (simulates TTL expiry) → login works again.
    await User.updateOne({ email }, { lockUntil: null, failedLoginAttempts: 0 });
    res = await post(`${base}/api/v1/auth/login`, {
      email,
      password: 'password123',
    });
    assert.equal(res.status, 200);

    // Change password: wrong current → 401; right → 200 + rotates session.
    res = await post(`${base}/api/v1/users/me/password`, {
      currentPassword: 'nope-nope-1',
      newPassword: 'newpassword1',
    });
    assert.equal(res.status, 401);
    res = await post(`${base}/api/v1/users/me/password`, {
      currentPassword: 'password123',
      newPassword: 'newpassword1',
    });
    assert.equal(res.status, 200);
    res = await post(`${base}/api/v1/auth/login`, {
      email,
      password: 'password123',
    });
    assert.equal(res.status, 401);
    res = await post(`${base}/api/v1/auth/login`, {
      email,
      password: 'newpassword1',
    });
    assert.equal(res.status, 200);

    // Export contains user + savedJobs shape.
    res = await api(`${base}/api/v1/users/me/export`);
    assert.equal(res.status, 200);
    const exported = await json(res);
    assert.equal(exported.data.user.email, email);
    assert.ok(Array.isArray(exported.data.savedJobs));
    assert.ok(exported.data.exportedAt);

    // Delete removes user + saved jobs; session dies with it.
    res = await api(`${base}/api/v1/users/me`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    res = await api(`${base}/api/v1/users/me`);
    assert.equal(res.status, 401);
    res = await post(`${base}/api/v1/auth/login`, {
      email,
      password: 'newpassword1',
    });
    assert.equal(res.status, 401);
    assert.equal(await User.countDocuments({ email }), 0);
  } finally {
    await User.deleteOne({ email });
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
