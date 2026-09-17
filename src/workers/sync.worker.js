import { Worker } from 'bullmq';

import '../config/env.js';
import { getAdapter } from '../adapters/index.js';
import JobSource from '../models/jobSource.model.js';
import { syncJobSource } from '../services/sync.service.js';

let worker;

const getRedisConnection = () => ({
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null,
});

// One queue, many sources. BullMQ distributes jobs across workers,
// so scaling from 3 -> 300 companies needs no code change.
export const startSyncWorker = () => {
  if (worker) return worker;

  worker = new Worker(
    'reerhub-sync',
    async (job) => {
      const source = await JobSource.findById(job.data.sourceId);
      if (!source) throw new Error(`JobSource not found: ${job.data.sourceId}`);
      if (!source.isActive) {
        console.log(`Skipping inactive source ${source._id}`);
        return { skipped: true };
      }

      const fetchJobs = getAdapter(source.type);
      const result = await syncJobSource({ source, fetchJobs });
      console.log(
        `Sync ${source.name}: ${result.status} (new=${result.stats.newJobs} updated=${result.stats.updatedJobs} closed=${result.stats.closedJobs})`
      );
      return { syncLogId: result.syncLogId, status: result.status };
    },
    {
      connection: getRedisConnection(),
      concurrency: Number(process.env.SYNC_CONCURRENCY) || 5,
    }
  );

  worker.on('failed', (job, error) => {
    console.error(`Sync job ${job?.id} failed:`, error.message);
  });

  console.log('✅ Sync worker started (reerhub-sync)');
  return worker;
};

export const stopSyncWorker = async () => {
  if (worker) {
    await worker.close();
    worker = null;
  }
};
