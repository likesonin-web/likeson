import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  socket: {
    reconnectStrategy(retries) {
      return Math.min(retries * 50, 5000);
    },
  },
  disableOfflineQueue: false,
});

redisClient.on('error', (err) => console.error('❌ Redis Error:', err.message));
redisClient.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));
redisClient.on('ready', () => console.log('✅ Redis ready'));

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) await redisClient.connect();
  } catch (err) {
    console.error('❌ Redis connect failed:', err.message);
  }
};

export const disconnectRedis = async () => {
  try {
    if (redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.error('❌ Redis quit failed:', err.message);
  }
};

export const redisHealthCheck = async () => {
  try {
    await redisClient.ping();
    return true;
  } catch { return false; }
};

export default redisClient;