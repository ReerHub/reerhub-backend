import './config/env.js';

import app from './app.js'; // ✔ express app with routes + middleware
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB(); // ✔ ensures Mongo is ready
    await connectRedis(); // ✔ ensures Redis is ready

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1); // ✔ exit on error
  }
})();
