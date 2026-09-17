import './config/env.js';
import http from 'http';

import app from './app.js';
import connectDB, { disconnectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { closeSyncQueue } from './config/queue.js';
import { ensureDailySchedules } from './workers/scheduler.js';
import { startSyncWorker, stopSyncWorker } from './workers/sync.worker.js';

const PORT = process.env.PORT || 8000;

(async () => {
  try {
    await connectDB();
    await connectRedis();

    // Modular monolith (ADR-001): API + worker run in one process for MVP.
    // Scale later by running the worker in its own process/container.
    if (process.env.WORKER_ENABLED !== 'false') {
      startSyncWorker();
      await ensureDailySchedules();
    }

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`✅ Wareers API running on port ${PORT}`);
    });

    const shutdown = (signal) => {
      console.log(`📴 ${signal} received, closing server gracefully...`);
      server.close(() => {
        Promise.all([
          stopSyncWorker(),
          closeSyncQueue(),
          disconnectRedis(),
          disconnectDB(),
        ])
          .catch((error) => console.error('❌ Shutdown error:', error))
          .finally(() => process.exit(0));
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
})();
