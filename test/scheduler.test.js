import assert from 'node:assert/strict';
import test from 'node:test';
import { staggeredTime } from '../src/services/scheduler.service.js';

test('source schedules fall in the daily 02:00–05:00 UTC window', () => {
  const after = new Date('2026-09-30T00:00:00.000Z');
  const scheduled = staggeredTime('0123456789abcdef01234567', after);
  assert.ok(scheduled > after);
  assert.ok(scheduled.getUTCHours() >= 2 && scheduled.getUTCHours() <= 4);
});

test('source schedules move to the next day after today’s slot passes', () => {
  const scheduled = staggeredTime(
    '0123456789abcdef01234567',
    new Date('2026-09-30T23:59:00.000Z')
  );
  assert.equal(scheduled.getUTCDate(), 1);
  assert.ok(scheduled.getUTCHours() >= 2 && scheduled.getUTCHours() <= 4);
});
