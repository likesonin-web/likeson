import redisClient from "../config/redis.js";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Cache Invalidation Helpers
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Three strategies are supported:
 *
 *  1. invalidateKey(key)          – delete one exact key
 *  2. invalidateKeys(keys[])      – delete multiple exact keys at once
 *  3. invalidatePattern(pattern)  – delete all keys matching a glob pattern
 *                                   (uses SCAN so it's safe on large datasets)
 *
 * Common patterns used across the project
 * ────────────────────────────────────────
 *  "GET:/api/hospitals"           – list cache set by the cache() middleware
 *  "hospital:<id>"                – detail cache set with a custom keyFn
 *  "user:<id>:*"                  – all cached data for one user
 *  "GET:/api/medicines*"          – all medicine list/search pages
 */

// ── 1. Delete a single exact key ─────────────────────────────────────────────
export const invalidateKey = async (key) => {
  try {
    const deleted = await redisClient.del(key);
    if (deleted) {
      console.log(`🗑️  Cache invalidated: "${key}"`);
    } else {
      console.log(`ℹ️  Cache key not found (already expired?): "${key}"`);
    }
    return deleted;
  } catch (err) {
    console.error(`Cache invalidation error for key "${key}":`, err.message);
    return 0;
  }
};

// ── 2. Delete multiple exact keys in one round-trip ──────────────────────────
export const invalidateKeys = async (keys = []) => {
  if (!keys.length) return 0;

  try {
    const deleted = await redisClient.del(keys);
    console.log(`🗑️  Cache invalidated ${deleted}/${keys.length} keys`);
    return deleted;
  } catch (err) {
    console.error("Cache bulk-invalidation error:", err.message);
    return 0;
  }
};

// ── 3. Delete all keys matching a glob pattern (SCAN-safe) ───────────────────
export const invalidatePattern = async (pattern) => {
  try {
    let cursor = 0;
    let totalDeleted = 0;

    do {
      const reply = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      cursor = reply.cursor;
      const keys = reply.keys;

      if (keys.length) {
        const deleted = await redisClient.del(keys);
        totalDeleted += deleted;
      }
    } while (cursor !== 0);

    console.log(`🗑️  Cache pattern "${pattern}" → ${totalDeleted} key(s) removed`);
    return totalDeleted;
  } catch (err) {
    console.error(`Cache pattern-invalidation error for "${pattern}":`, err.message);
    return 0;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built domain helpers (import and call in your controllers)
// ─────────────────────────────────────────────────────────────────────────────

/** Call after creating / updating / deleting a hospital */
export const invalidateHospitalCache = async (hospitalId) => {
  await invalidateKeys([
    `hospital:${hospitalId}`,
    "GET:/api/hospitals",
  ]);
  // Also wipe any paginated list pages
  await invalidatePattern("GET:/api/hospitals?*");
};

/** Call after updating a user's profile / role / status */
export const invalidateUserCache = async (userId) => {
  await invalidatePattern(`user:${userId}:*`);
  await invalidateKey(`GET:/api/users/${userId}`);
};

/** Call after any pharmacy CRUD operation */
export const invalidatePharmacyCache = async (pharmacyId) => {
  await invalidateKeys([
    `pharmacy:${pharmacyId}`,
    "GET:/api/pharmacy",
    "GET:/api/pharmacy-store",
  ]);
  await invalidatePattern(`GET:/api/pharmacy?*`);
};

/** Call after medicine stock / detail changes */
export const invalidateMedicineCache = async (medicineId) => {
  await invalidateKeys([`medicine:${medicineId}`]);
  await invalidatePattern("GET:/api/medicines*");
};

/** Call after order status changes */
export const invalidateOrderCache = async (orderId, userId) => {
  await invalidateKeys([
    `order:${orderId}`,
    `GET:/api/user/pharmacy/orders/${orderId}`,
  ]);
  if (userId) await invalidatePattern(`user:${userId}:orders*`);
};

/** Call after plan / subscription changes */
export const invalidateSubscriptionCache = async () => {
  await invalidatePattern("GET:/api/plans*");
  await invalidatePattern("GET:/api/subscriptions*");
};

/** Nuke everything – use sparingly (e.g. major data migrations) */
export const flushAllCache = async () => {
  try {
    await redisClient.flushDb();
    console.warn("⚠️  Entire Redis DB flushed");
  } catch (err) {
    console.error("flushAllCache error:", err.message);
  }
};

export const invalidatePatternBatch = async (patterns = []) => {
  let total = 0;
  for (const pattern of patterns) {
    total += await invalidatePattern(pattern);
  }
  return total;
};