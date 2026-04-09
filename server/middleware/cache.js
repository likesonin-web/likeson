import redisClient from "../config/redis.js";

/**
 * cache(ttlSeconds, keyFn?)
 *
 * Express middleware factory that caches JSON responses in Redis.
 *
 * @param {number}   ttlSeconds  – How long to keep the cached value (default 60 s).
 * @param {Function} keyFn       – Optional fn(req) → string to build a custom cache key.
 *                                 Defaults to `<METHOD>:<originalUrl>`.
 *
 * Usage:
 *   router.get("/hospitals",        cache(120), getAllHospitals);
 *   router.get("/hospitals/:id",    cache(60, req => `hospital:${req.params.id}`), getOne);
 *   router.get("/me",               cache(30, req => `user:${req.user._id}:profile`), getProfile);
 */
const cache = (ttlSeconds = 60, keyFn = null) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== "GET") return next();

    // Build cache key
    const cacheKey = keyFn ? keyFn(req) : `${req.method}:${req.originalUrl}`;

    try {
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(parsed);
      }
    } catch (err) {
      // Redis failure must never break the actual request
      console.error("Cache READ error:", err.message);
    }

    // Intercept res.json so we can cache the outgoing payload
    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(body));
        } catch (err) {
          console.error("Cache WRITE error:", err.message);
        }
      }

      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };

    next();
  };
};

export default cache;