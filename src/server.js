import './config/env.js';
import http from 'http';

import app from './app.js';
import connectDB, { disconnectDB } from './config/db.js';
import { startScheduler, stopScheduler } from './services/scheduler.service.js';

const PORT = process.env.PORT || 8000;

(async () => {
  try {
    await connectDB();
    await startScheduler();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`✅ ReerHub API running on port ${PORT}`);
    });

    const shutdown = (signal) => {
      console.log(`📴 ${signal} received, closing server gracefully...`);
      server.close(() => {
        (async () => {
          try {
            stopScheduler();
            await disconnectDB();
          } catch (error) {
            console.error('❌ Shutdown error:', error);
          }
          // Force-exit guard in case a keep-alive connection blocks close().
          setTimeout(() => process.exit(0), 1500).unref();
        })();
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Crash loudly on programmer errors so the host (Render) restarts
    // cleanly instead of limping on with corrupted state.
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled rejection, exiting:', reason);
      process.exit(1);
    });
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception, exiting:', error);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
})();
