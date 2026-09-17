import { Queue } from 'bullmq';

let syncQueue;

const getRedisConnection = () => {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not defined');
  }
  // BullMQ needs its own connection object (it blocks the client).
  // maxRetriesPerRequest must be null for blocking connections.
  return { url: process.env.REDIS_URL, maxRetriesPerRequest: null };
};

export const getSyncQueue = () => {
  if (!syncQueue) {
    syncQueue = new Queue('wareers-sync', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return syncQueue;
};

export const closeSyncQueue = async () => {
  if (syncQueue) {
    await syncQueue.close();
    syncQueue = null;
  }
};
