import redisClient from '../config/redis.js';

const CACHE_VERSION = 'v1'; // bump on deploy to bust all cache

const NON_CACHEABLE_PATTERNS = [
  '/tracking', '/otp', '/payment', '/notification',
  '/driver/location', '/live', '/verify', '/auth',
];

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB max — skip large payloads

const cache = (ttlSeconds = 60, keyFn = null) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    // skip non-cacheable routes
    const url = req.originalUrl;
    if (NON_CACHEABLE_PATTERNS.some(p => url.includes(p))) return next();

    const rawKey = keyFn ? keyFn(req) : `${req.method}:${url}`;
    const cacheKey = `${CACHE_VERSION}:${rawKey}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (err) {
      console.error('[Cache READ]', err.message);
    }

    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const serialized = JSON.stringify(body);
          if (Buffer.byteLength(serialized) <= MAX_PAYLOAD_BYTES) {
            await redisClient.setEx(cacheKey, ttlSeconds, serialized);
          }
        } catch (err) {
          console.error('[Cache WRITE]', err.message);
        }
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};

export default cache;