/**
 * Opaque cursor pagination based on (createdAt, _id) — stable under inserts,
 * unlike skip/limit. Cursor encodes the last seen doc's createdAt+_id.
 */

export const encodeCursor = (doc) => {
  if (!doc) return null;
  return Buffer.from(`${doc.createdAt.toISOString()}_${doc._id}`).toString('base64');
};

export const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const [iso, id] = raw.split('_');
    if (!iso || !id) return null;
    return { createdAt: new Date(iso), _id: id };
  } catch {
    return null;
  }
};

/**
 * Build a mongo filter fragment for "older than cursor" pagination on a
 * descending-sorted field (default createdAt, newest first).
 */
export const olderThanCursor = (cursor, field = 'createdAt') => {
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};
  return {
    $or: [
      { [field]: { $lt: decoded.createdAt } },
      { [field]: decoded.createdAt, _id: { $lt: decoded._id } },
    ],
  };
};

export const clampLimit = (limit, { max = 100, def = 30 } = {}) => {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
};