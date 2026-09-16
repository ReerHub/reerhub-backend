import './config/env.js';
import http from 'http';

import app from './app.js';
import connectDB, { disconnectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';

const PORT = process.env.PORT || 8000;

(async () => {
  try {
    await connectDB();
    await connectRedis();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`✅ CareerHub API running on port ${PORT}`);
    });

    const shutdown = (signal) => {
      console.log(`📴 ${signal} received, closing server gracefully...`);
      server.close(() => {
        Promise.all([disconnectRedis(), disconnectDB()])
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
