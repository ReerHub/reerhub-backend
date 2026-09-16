import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createContentHash,
  createJobFingerprint,
} from '../src/services/jobIdentity.service.js';
import { normalizeRawJob } from '../src/services/jobNormalizer.service.js';

test('normalizes an adapter job into the shared data shape', () => {
  const job = normalizeRawJob({
    externalJobId: ' GH-123 ',
    title: ' Senior Backend Engineer ',
    locations: 'Pune, Maharashtra',
    remoteType: 'hybrid',
    skills: 'Node.js, MongoDB, Node.js',
    applicationUrl: 'https://jobs.example.com/123',
    sourceUrl: 'https://boards.example.com/jobs/123',
  });

  assert.equal(job.externalJobId, 'GH-123');
  assert.equal(job.title, 'Senior Backend Engineer');
  assert.deepEqual(job.locations, [
    { city: 'Pune', state: 'Maharashtra', country: 'India' },
  ]);
  assert.deepEqual(job.skills, ['Node.js', 'MongoDB']);
  assert.equal(job.remoteType, 'hybrid');
});

test('uses stable identity and content hashes for equivalent data', () => {
  const first = {
    companyId: 'company-id',
    title: 'Senior Backend Engineer',
    locations: [{ city: 'Pune', state: 'Maharashtra', country: 'India' }],
    applicationUrl: 'https://jobs.example.com/123',
    description: 'Build APIs',
    skills: ['Node.js', 'MongoDB'],
  };
  const equivalent = {
    ...first,
    title: '  senior   backend engineer ',
    skills: ['MongoDB', 'Node.js'],
  };

  assert.equal(createJobFingerprint(first), createJobFingerprint(equivalent));
  assert.equal(createContentHash(first), createContentHash(equivalent));
});
