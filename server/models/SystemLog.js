import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * SystemLog Model — Likeson.in
 *
 * Stores platform-wide administrative and operational event logs.
 *
 * DESIGN DECISIONS:
 *  - Immutable after creation (no update routes). Logs are append-only.
 *  - TTL index: logs older than 90 days auto-expire (configurable via SYSTEM_LOG_TTL_DAYS env).
 *  - actor is denormalised (name + role stored inline) so logs remain readable
 *    even after a User is soft-deleted.
 *  - relatedEntity is polymorphic (stores model name + ObjectId).
 *  - metadata is a flexible Map for arbitrary key-value pairs per event.
 *  - select: false on sensitivePayload — never returned in list queries.
 *
 * CATEGORIES:
 *  auth | user | security | payment | notification | kyc | system | api
 *
 * LEVELS:
 *  info | success | warning | error | debug
 */

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const actorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name:   { type: String, default: 'system', trim: true },
    email:  { type: String, default: null,     trim: true, lowercase: true },
    role:   {
      type:    String,
      enum:    [
        'superadmin', 'admin', 'doctor', 'transportpartner', 'driver',
        'lab partner', 'customer', 'pharmacy', 'care assistant', 'finance',
        'system', 'anonymous',
      ],
      default: 'system',
    },
    ip:         { type: String, default: 'unknown' },
    userAgent:  { type: String, default: null },
    platform:   { type: String, enum: ['android', 'ios', 'web', 'desktop', 'server', 'unknown'], default: 'unknown' },
  },
  { _id: false }
);

const relatedEntitySchema = new Schema(
  {
    model:    {
      type: String,
      enum: [
        'User', 'Hospital', 'PharmacyStore', 'PharmacyOrder',
        'TransportPartner', 'DoctorProfile', 'PharmacyProfile',
        'CareAssistantProfile', 'Notification', 'Booking',
        'UserSubscription', null,
      ],
      default: null,
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    label:    { type: String, trim: true, default: null }, // human-readable label for quick display
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const systemLogSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────

    /** Short unique reference code, e.g. "LOG-20250321-0001" */
    logCode: {
      type:   String,
      unique: true,
      index:  true,
      trim:   true,
    },

    // ── Classification ────────────────────────────────────────────────────────

    level: {
      type:     String,
      required: true,
      enum:     ['info', 'success', 'warning', 'error', 'debug'],
      default:  'info',
      index:    true,
    },

    category: {
      type:     String,
      required: true,
      enum:     ['auth', 'user', 'security', 'payment', 'notification', 'kyc', 'system', 'api'],
      default:  'system',
      index:    true,
    },

    // ── Content ───────────────────────────────────────────────────────────────

    /** Short human-readable summary (shown in table rows) */
    message: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 500,
    },

    /** Full verbose description or stack trace */
    details: {
      type:    String,
      default: null,
    },

    // ── Actor (who triggered this event) ──────────────────────────────────────
    actor: { type: actorSchema, default: () => ({}) },

    // ── Related Entity (optional link to what was affected) ───────────────────
    relatedEntity: { type: relatedEntitySchema, default: () => ({}) },

    // ── Request / Response context ────────────────────────────────────────────
    request: {
      method:   { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', null], default: null },
      path:     { type: String, default: null },
      statusCode:{ type: Number, default: null },
      durationMs:{ type: Number, default: null },   // response time in milliseconds
    },

    // ── Flexible metadata (e.g. old value → new value for audits) ─────────────
    /**
     * Use for diff / before-after pairs or additional structured data.
     * Example: { "previousRole": "customer", "newRole": "admin" }
     */
    metadata: {
      type:    Schema.Types.Mixed,
      default: null,
    },

    /**
     * Sensitive payloads (raw request body, tokens) — NEVER returned by API.
     * Only accessible via direct DB queries with explicit projection.
     */
    sensitivePayload: {
      type:   Schema.Types.Mixed,
      select: false,
    },

    // ── Environment context ───────────────────────────────────────────────────
    environment: {
      type:    String,
      enum:    ['development', 'staging', 'production'],
      default: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    },

    /** Server or pod identifier (useful in multi-instance deployments) */
    serverId: {
      type:    String,
      default: process.env.SERVER_ID || 'primary',
    },

    // ── Expiry (TTL) ──────────────────────────────────────────────────────────
    /**
     * TTL index below expires documents automatically.
     * Default: 90 days. Override via SYSTEM_LOG_TTL_DAYS env.
     * Set expiresAt explicitly in createLog() if you want per-document control.
     */
    expiresAt: {
      type: Date,
      default: () => {
        const days = parseInt(process.env.SYSTEM_LOG_TTL_DAYS || '90', 10);
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      },
    },
  },
  {
    timestamps: true,         // createdAt (= event time), updatedAt (not used)
    versionKey: false,        // __v not needed for append-only collection
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// TTL — MongoDB auto-deletes documents when expiresAt is reached
systemLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast list/filter queries
systemLogSchema.index({ level: 1,    createdAt: -1 });
systemLogSchema.index({ category: 1, createdAt: -1 });
systemLogSchema.index({ 'actor.userId':  1, createdAt: -1 });
systemLogSchema.index({ 'actor.role':    1, createdAt: -1 });
systemLogSchema.index({ 'actor.ip':      1, createdAt: -1 });
systemLogSchema.index({ 'relatedEntity.model':    1, 'relatedEntity.entityId': 1 });
systemLogSchema.index({ 'request.statusCode': 1 });
systemLogSchema.index({ 'request.path':      1, createdAt: -1 });
systemLogSchema.index({ environment: 1 });

// Text index for full-text search on message + details
systemLogSchema.index(
  { message: 'text', details: 'text', logCode: 'text' },
  { name: 'system_log_text_idx', weights: { message: 10, logCode: 5, details: 1 } }
);

// ── Pre-save: auto-generate logCode ──────────────────────────────────────────
systemLogSchema.pre('save', function () {
  if (!this.logCode) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand    = Math.random().toString(36).slice(-5).toUpperCase();
    this.logCode  = `LOG-${dateStr}-${rand}`;
  }
});

// ── Static: createLog (convenience factory) ───────────────────────────────────
/**
 * Usage:
 *   await SystemLog.createLog({
 *     level:    'success',
 *     category: 'user',
 *     message:  'Doctor account created',
 *     actor:    { userId: req.user._id, name: req.user.name, role: req.user.role, ip },
 *     relatedEntity: { model: 'User', entityId: newUser._id, label: newUser.email },
 *     request:  { method: 'POST', path: '/api/admin/users/create/doctor', statusCode: 201, durationMs: 142 },
 *     metadata: { hospitalName: hospital.name },
 *   });
 */
systemLogSchema.statics.createLog = async function (payload) {
  try {
    return await this.create(payload);
  } catch (err) {
    // Log creation must NEVER crash the parent request
    console.error('[SystemLog.createLog] Failed to persist log:', err.message);
    return null;
  }
};

// ── Virtual: ageHuman ─────────────────────────────────────────────────────────
systemLogSchema.virtual('ageHuman').get(function () {
  const diffMs  = Date.now() - new Date(this.createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
});

const SystemLog = mongoose.model('SystemLog', systemLogSchema);
export default SystemLog;