import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL is not defined in environment variables");
}

// RedisLabs URLs come without the protocol prefix — normalise here.
const redisUrl = REDIS_URL.startsWith("redis://") || REDIS_URL.startsWith("rediss://")
  ? REDIS_URL
  : `redis://${REDIS_URL}`;

const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Redis: Too many reconnect attempts. Giving up.");
        return new Error("Redis reconnect limit reached");
      }
      // Exponential back-off capped at 3 s
      return Math.min(retries * 100, 3000);
    },
    connectTimeout: 10_000,
  },
});

redisClient.on("connect",   () => console.log("🔴 Redis client connecting…"));
redisClient.on("ready",     () => console.log("✅ Redis client ready"));
redisClient.on("error",  (err) => console.error("❌ Redis error:", err.message));
redisClient.on("end",       () => console.warn("⚠️  Redis connection closed"));
redisClient.on("reconnecting", () => console.log("🔁 Redis reconnecting…"));

// Connect once at module load; subsequent imports reuse the same instance.
await redisClient.connect();

export default redisClient;