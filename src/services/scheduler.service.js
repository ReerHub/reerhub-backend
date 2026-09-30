import JobSource from '../models/jobSource.model.js';
import SchedulerState from '../models/schedulerState.model.js';
import { getAdapter } from '../adapters/index.js';
import { syncJobSource } from './sync.service.js';
import { sendDailyDigests } from './digest.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLAIM_MS = 20 * 60 * 1000;
const DIGEST_HOUR_UTC = 5;
let timer;
let running = false;

export const staggeredTime = (sourceId, after = new Date()) => {
  const hash = Number.parseInt(String(sourceId).slice(-8), 16) || 0;
  const target = new Date(after);
  target.setUTCHours(2 + (Math.floor(hash / 60) % 3), hash % 60, 0, 0);
  if (target <= after) target.setTime(target.getTime() + DAY_MS);
  return target;
};

const initializeSources = async () => {
  const sources = await JobSource.find({
    isActive: true,
    nextScheduledSyncAt: { $exists: false },
  }).select('_id');
  await Promise.all(
    sources.map((source) =>
      JobSource.updateOne(
        { _id: source._id },
        { $set: { nextScheduledSyncAt: staggeredTime(source._id) } }
      )
    )
  );
};

const runOneSource = async () => {
  const now = new Date();
  const source = await JobSource.findOneAndUpdate(
    {
      isActive: true,
      nextScheduledSyncAt: { $lte: now },
      $or: [
        { syncClaimedUntil: { $exists: false } },
        { syncClaimedUntil: { $lte: now } },
      ],
    },
    { $set: { syncClaimedUntil: new Date(now.getTime() + CLAIM_MS) } },
    { sort: { nextScheduledSyncAt: 1 }, returnDocument: 'after' }
  );
  if (!source) return false;
  try {
    await syncJobSource({ source, fetchJobs: getAdapter(source.type) });
  } catch (error) {
    console.error(`Scheduled sync failed for ${source.name}:`, error.message);
  } finally {
    await JobSource.updateOne(
      { _id: source._id },
      {
        $set: {
          nextScheduledSyncAt: staggeredTime(source._id, new Date()),
          syncClaimedUntil: null,
        },
      }
    );
  }
  return true;
};

const runDueSyncs = async () => {
  const concurrency = Math.max(
    1,
    Math.min(Number(process.env.SYNC_CONCURRENCY) || 3, 10)
  );
  while (true) {
    const results = await Promise.all(
      Array.from({ length: concurrency }, () => runOneSource())
    );
    if (!results.some(Boolean)) return;
  }
};

const runDailyDigest = async () => {
  const now = new Date();
  if (now.getUTCHours() < DIGEST_HOUR_UTC) return;
  const state = await SchedulerState.findOneAndUpdate(
    {
      key: 'daily-match-digest',
      dueAt: { $lte: now },
      $or: [{ claimedUntil: { $exists: false } }, { claimedUntil: { $lte: now } }],
    },
    { $set: { claimedUntil: new Date(now.getTime() + CLAIM_MS) } },
    { returnDocument: 'after' }
  );
  if (!state) return;
  try {
    await sendDailyDigests();
    await SchedulerState.updateOne(
      { _id: state._id },
      {
        $set: {
          dueAt: new Date(now.getTime() + DAY_MS),
          lastCompletedAt: new Date(),
          claimedUntil: null,
        },
      }
    );
  } catch (error) {
    await SchedulerState.updateOne({ _id: state._id }, { $set: { claimedUntil: null } });
    console.error('Daily digest failed:', error.message);
  }
};

export const runSchedulerTick = async () => {
  if (running) return;
  running = true;
  try {
    await initializeSources();
    await runDueSyncs();
    await runDailyDigest();
  } finally {
    running = false;
  }
};

export const startScheduler = async () => {
  if (process.env.SCHEDULER_ENABLED === 'false') return;
  const now = new Date();
  await SchedulerState.updateOne(
    { key: 'daily-match-digest' },
    {
      $setOnInsert: {
        dueAt: new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            DIGEST_HOUR_UTC
          )
        ),
      },
    },
    { upsert: true }
  );
  runSchedulerTick().catch((error) =>
    console.error('Scheduler startup tick failed:', error.message)
  );
  timer = setInterval(() => {
    runSchedulerTick().catch((error) =>
      console.error('Scheduler tick failed:', error.message)
    );
  }, 60 * 1000);
  timer.unref();
  console.log('✅ MongoDB-backed scheduler started');
};

export const stopScheduler = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
