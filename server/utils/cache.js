import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => console.error('❌ Redis Client Error:', err));

export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log('✅ Redis Connected Successfully');
        }
    } catch (error) {
        console.error('❌ Redis Connection Failed:', error);
        // In production, you might not want to kill the app if Redis fails, 
        // just log it and move to DB-only mode.
    }
};

export default redisClient;