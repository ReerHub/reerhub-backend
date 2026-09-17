import assert from 'node:assert/strict';
import test from 'node:test';

import { getAdapter } from '../src/adapters/index.js';
import { fetchGreenhouseJobs } from '../src/adapters/greenhouse.adapter.js';
import { fetchLeverJobs } from '../src/adapters/lever.adapter.js';

test('registry resolves greenhouse, lever, ashby, custom', () => {
  assert.equal(typeof getAdapter('greenhouse'), 'function');
  assert.equal(typeof getAdapter('lever'), 'function');
  assert.equal(typeof getAdapter('ashby'), 'function');
  assert.equal(typeof getAdapter('custom'), 'function');
  assert.throws(() => getAdapter('naukri'), /Unknown job source type/);
});

test('greenhouse adapter requires boardToken', async () => {
  await assert.rejects(
    fetchGreenhouseJobs({ name: 'x', config: {} }),
    /missing config\.boardToken/
  );
});

test('lever adapter requires leverOrg', async () => {
  await assert.rejects(
    fetchLeverJobs({ name: 'x', config: {} }),
    /missing config\.leverOrg/
  );
});

test('lever adapter maps posting to common job shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        id: 'abc-123',
        text: 'Backend Engineer',
        description: 'Build APIs',
        categories: {
          location: 'Bengaluru, Karnataka',
          commitment: 'Full-time',
          department: 'Engineering',
        },
        hostedUrl: 'https://jobs.lever.co/cred/abc-123',
        createdAt: 1726400000000,
      },
    ],
  });

  try {
    const jobs = await fetchLeverJobs({ name: 'CRED', config: { leverOrg: 'cred' } });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].externalJobId, 'abc-123');
    assert.equal(jobs[0].title, 'Backend Engineer');
    assert.equal(jobs[0].applicationUrl, 'https://jobs.lever.co/cred/abc-123');
    assert.equal(jobs[0].department, 'Engineering');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('greenhouse adapter maps job to common shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      jobs: [
        {
          id: 999,
          title: 'Frontend Engineer',
          content: '<p>UI work</p>',
          location: { name: 'Bengaluru' },
          departments: [{ name: 'Engineering' }],
          absolute_url: 'https://job-boards.greenhouse.io/x/jobs/999',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
    }),
  });

  try {
    const jobs = await fetchGreenhouseJobs({
      name: 'Razorpay',
      config: { boardToken: 'x' },
    });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].externalJobId, '999');
    assert.equal(jobs[0].applicationUrl, 'https://job-boards.greenhouse.io/x/jobs/999');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
