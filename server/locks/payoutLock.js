// locks/payoutLock.js
import mongoose from 'mongoose';

const LockSchema = new mongoose.Schema({
  key:       { type: String, unique: true, required: true },
  lockedAt:  { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  holder:    { type: String },
});
const Lock = mongoose.model('PayoutLock', LockSchema);

export async function acquireLock(key, ttlMs = 30000) {
  const expiresAt = new Date(Date.now() + ttlMs);
  try {
    await Lock.create({ key, expiresAt, holder: process.env.INSTANCE_ID || 'server' });
    return true;
  } catch (e) {
    if (e.code === 11000) return false; // already locked
    throw e;
  }
}

export async function releaseLock(key) {
  await Lock.deleteOne({ key });
}

// Usage in transfer route:
const lockKey = `payout:transfer:${payoutId}`;
const locked = await acquireLock(lockKey, 60000);
if (!locked) return res.status(409).json({ success: false, message: 'Transfer already in progress' });
try {
  // ... do transfer
} finally {
  await releaseLock(lockKey);
}