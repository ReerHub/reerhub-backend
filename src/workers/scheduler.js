import JobSource from '../models/jobSource.model.js';
import { getSyncQueue } from '../config/queue.js';

// Deterministic stagger: hash each source into the 02:00-05:00 window so
// 100 sources don't fire in the same second (thundering herd). An explicit
// SYNC_CRON still overrides everything for operator control.
export const staggeredCronFor = (sourceId) => {
  const hex = String(sourceId).slice(-8);
  const hash = parseInt(hex, 16) || 0;
  const minute = hash % 60;
  const hour = 2 + (Math.floor(hash / 60) % 3);
  return `${minute} ${hour} * * *`;
};

// Daily repeat per source. jobId `daily-<sourceId>` makes scheduling idempotent:
// restarts / redeploys never create duplicate cron entries.
export const ensureDailySchedules = async () => {
  const queue = getSyncQueue();
  const override = process.env.SYNC_CRON;
  const sources = await JobSource.find({ isActive: true }).select('_id name');

  for (const source of sources) {
    const cron = override || staggeredCronFor(source._id);
    await queue.upsertJobScheduler(`daily-${source._id}`, {
      pattern: cron,
      immediately: false,
    });
    console.log(`Scheduled daily sync for ${source.name} (${cron})`);
  }
};

export const enqueueSourceSync = async (sourceId) =>
  getSyncQueue().add('sync-source', { sourceId }, { attempts: 3 });
