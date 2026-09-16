import { createClient } from 'redis';

let redisClient;

export const connectRedis = async () => {
  if (redisClient?.isOpen) return redisClient;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL is not defined');
  }

  redisClient = createClient({ url: redisUrl });

  redisClient.on('error', (error) => {
    console.error('❌ Redis client error:', error);
  });

  await redisClient.connect();
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
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }
};
