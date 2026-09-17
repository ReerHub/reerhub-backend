import Redis from 'ioredis';

let redisClient;

export const connectRedis = async () => {
  if (redisClient?.status === 'ready') return redisClient;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL is not defined');
  }

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
  });

  redisClient.on('error', (error) => {
    console.error('❌ Redis client error:', error);
  });

  await redisClient.ping();
  console.log('✅ Redis connected');

  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
};
