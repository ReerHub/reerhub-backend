import './config/env.js';
import http from 'http'; // ✅ Add this import

import app from './app.js';
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';

const PORT = process.env.PORT || 8000;

(async () => {
  try {
    await connectDB();
    await connectRedis();

    // ✅ Create HTTP server instead of using app.listen directly
    const server = http.createServer(app);

    // ✅ Set timeouts for long-running AI requests
    server.timeout = 180000; // 3 minutes (180 seconds)
    server.keepAliveTimeout = 185000; // 185 seconds (slightly longer)
    server.headersTimeout = 186000; // 186 seconds (slightly longer)

    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`⏱️  Request timeout: 3 minutes`);
    });

    // ✅ Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📴 SIGTERM received, closing server gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
})();
