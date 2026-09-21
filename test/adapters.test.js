import assert from 'node:assert/strict';
import test from 'node:test';

import { getAdapter } from '../src/adapters/index.js';
import { fetchGreenhouseJobs } from '../src/adapters/greenhouse.adapter.js';
import { fetchLeverJobs } from '../src/adapters/lever.adapter.js';
import { fetchSmartRecruitersJobs } from '../src/adapters/smartrecruiters.adapter.js';

test('registry resolves greenhouse, lever, ashby, smartrecruiters, custom', () => {
  assert.equal(typeof getAdapter('greenhouse'), 'function');
  assert.equal(typeof getAdapter('lever'), 'function');
  assert.equal(typeof getAdapter('ashby'), 'function');
  assert.equal(typeof getAdapter('smartrecruiters'), 'function');
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

test('greenhouse adapter decodes pre-escaped HTML entities', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      jobs: [
        {
          id: 1001,
          title: 'Backend Engineer',
          content: '&lt;div&gt;&lt;p&gt;Build APIs&lt;/p&gt;&lt;/div&gt;',
          location: { name: 'Bengaluru' },
          departments: [{ name: 'Engineering' }],
          absolute_url: 'https://job-boards.greenhouse.io/x/jobs/1001',
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
    assert.ok(!jobs[0].description.includes('&lt;'));
    assert.ok(jobs[0].description.includes('<div>'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('smartrecruiters adapter requires company', async () => {
  await assert.rejects(
    fetchSmartRecruitersJobs({ name: 'x', config: {} }),
    /missing config\.company/
  );
});

const srListItem = {
  id: '744000150064279',
  name: 'Staff Engineer - Full Stack',
  releasedDate: '2026-09-17T10:05:41.971Z',
  location: { city: 'Chennai', region: '', country: 'in', remote: false, hybrid: false },
  typeOfEmployment: { id: 'permanent', label: 'Full-time' },
  department: {},
  function: { id: 'other', label: 'Other' },
};

const srDetail = {
  postingUrl: 'https://jobs.smartrecruiters.com/Freshworks/744000150064279-staff',
  jobAd: {
    sections: {
      jobDescription: { text: '<p>Build SaaS</p>' },
      qualifications: { text: '<p>10+ years</p>' },
    },
  },
};

const mockSrFetch = (detail) => async (url) => {
  if (String(url).includes('/postings?')) {
    return { ok: true, json: async () => ({ content: [srListItem] }) };
  }
  return { ok: true, json: async () => detail };
};

test('smartrecruiters adapter maps list + detail to common shape', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockSrFetch(srDetail);

  try {
    const jobs = await fetchSmartRecruitersJobs({
      name: 'Freshworks',
      config: { company: 'Freshworks' },
    });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].externalJobId, '744000150064279');
    assert.equal(jobs[0].title, 'Staff Engineer - Full Stack');
    assert.ok(jobs[0].description.includes('Build SaaS'));
    assert.ok(jobs[0].description.includes('10+ years'));
    assert.deepEqual(jobs[0].locations, {
      city: 'Chennai',
      state: undefined,
      country: 'India',
    });
    assert.equal(jobs[0].employmentType, 'Full-time');
    assert.equal(
      jobs[0].applicationUrl,
      'https://jobs.smartrecruiters.com/Freshworks/744000150064279-staff'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('smartrecruiters adapter falls back when detail fetch fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/postings?')) {
      return { ok: true, json: async () => ({ content: [srListItem] }) };
    }
    return { ok: false, status: 500 };
  };

  try {
    const jobs = await fetchSmartRecruitersJobs({
      name: 'Freshworks',
      config: { company: 'Freshworks' },
    });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].description, '');
    assert.equal(
      jobs[0].applicationUrl,
      'https://jobs.smartrecruiters.com/Freshworks/744000150064279'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('smartrecruiters adapter paginates until a short page', async () => {
  const originalFetch = globalThis.fetch;
  const seenOffsets = [];
  globalThis.fetch = async (url) => {
    const text = String(url);
    if (text.includes('/postings?')) {
      seenOffsets.push(text);
      const offset = Number(new URL(text).searchParams.get('offset'));
      // Full first page forces a second fetch; empty second page stops it.
      const items = offset === 0 ? Array.from({ length: 100 }, () => srListItem) : [];
      return { ok: true, json: async () => ({ content: items }) };
    }
    return { ok: true, json: async () => srDetail };
  };

  try {
    const jobs = await fetchSmartRecruitersJobs({
      name: 'Freshworks',
      config: { company: 'Freshworks' },
    });
    assert.equal(jobs.length, 100);
    assert.deepEqual(
      seenOffsets.map((u) => new URL(u).searchParams.get('offset')),
      ['0', '100']
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
