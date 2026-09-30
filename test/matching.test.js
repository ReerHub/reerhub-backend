import assert from 'node:assert/strict';
import test from 'node:test';
import {
  profileCompleteness,
  scoreJobForProfile,
} from '../src/services/matching.service.js';

test('scores a fresh role with transparent profile-match reasons', () => {
  const result = scoreJobForProfile(
    {
      skills: ['Node.js', 'React'],
      techTrack: 'software',
      city: 'Bengaluru',
      experienceYears: 3,
    },
    {
      title: 'Backend Engineer',
      techTrack: 'software',
      skills: ['Node.js', 'MongoDB'],
      locations: [{ city: 'Bengaluru' }],
      firstSeenAt: new Date(),
      experience: { min: 2, max: 5 },
    }
  );
  assert.ok(result.score >= 60);
  assert.ok(result.reasons.some((reason) => reason.includes('Node.js')));
  assert.ok(result.reasons.includes('Matches your tech track'));
});

test('profile completeness gives candidates a concrete next-step signal', () => {
  assert.equal(profileCompleteness({}), 0);
  assert.equal(
    profileCompleteness({
      headline: 'Engineer',
      currentRole: 'SDE',
      techTrack: 'software',
      city: 'Pune',
      experienceYears: 2,
      skills: ['React'],
    }),
    100
  );
});
