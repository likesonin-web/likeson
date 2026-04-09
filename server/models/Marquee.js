import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  MARQUEE MODEL  —  Likeson.in Healthcare Platform
//
//  Marquees are scrolling announcement banners shown across the app.
//  Each marquee can be:
//    • Targeted to specific roles or "all" users
//    • Scheduled with start/end dates
//    • Styled with a type (info / warning / success / error / promo)
//    • Prioritised so urgent notices bubble to the top
//    • Linked to an action URL (deep link or external)
//    • Tracked for impressions & dismissals
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = [
  'superadmin', 'admin', 'doctor', 'transportpartner',
  'driver', 'lab partner', 'finance', 'pharmacy', 'care assistant', 'customer',
];

const MARQUEE_TYPES  = ['info', 'warning', 'success', 'error', 'promo'];
const MARQUEE_SPEEDS = ['slow', 'normal', 'fast'];

// ─── Sub-schema: per-user dismissal log ──────────────────────────────────────

const dismissalSchema = new Schema({
  user:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  dismissedAt: { type: Date, default: Date.now },
}, { _id: false });

// ─── Sub-schema: click/impression analytics ──────────────────────────────────

const analyticsSchema = new Schema({
  impressions: { type: Number, default: 0 },   // total views
  clicks:      { type: Number, default: 0 },   // CTA clicks
  dismissals:  { type: Number, default: 0 },   // total dismiss count
}, { _id: false });

// ─── Main schema ─────────────────────────────────────────────────────────────

const marqueeSchema = new Schema({

  // ── Content ──────────────────────────────────────────────────────────────
  message: {
    type:     String,
    required: true,
    trim:     true,
    maxlength: 500,
  },

  // Optional rich sub-text (shown on hover / expanded view)
  subText: {
    type:      String,
    trim:      true,
    maxlength: 1000,
    default:   '',
  },

  // Optional icon name (lucide icon string, e.g. "AlertTriangle")
  icon: {
    type:    String,
    default: '',
  },

  // ── Display Settings ─────────────────────────────────────────────────────
  type: {
    type:    String,
    enum:    MARQUEE_TYPES,
    default: 'info',
  },

  speed: {
    type:    String,
    enum:    MARQUEE_SPEEDS,
    default: 'normal',
  },

  // Priority: higher number = rendered first
  priority: {
    type:    Number,
    default: 0,
    min:     0,
    max:     100,
  },

  // Whether users can dismiss this marquee
  isDismissible: {
    type:    Boolean,
    default: true,
  },

  // Show a CTA button alongside the text
  cta: {
    label:  { type: String, default: '' },
    url:    { type: String, default: '' },   // absolute URL or relative path
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
  },

  // ── Targeting ────────────────────────────────────────────────────────────
  // Empty array = shown to ALL roles
  targetRoles: [{
    type: String,
    enum: ROLES,
  }],

  // Specific users (e.g. announce to one doctor)
  targetUsers: [{
    type: Schema.Types.ObjectId,
    ref:  'User',
  }],

  // Pages / screens where this marquee is visible
  // Empty = show on all pages
  targetPages: [{
    type: String,
    trim: true,
  }],

  // ── Scheduling ───────────────────────────────────────────────────────────
  startsAt: {
    type:    Date,
    default: Date.now,
  },

  endsAt: {
    type:    Date,
    default: null,   // null = no expiry
  },

  // ── Status ───────────────────────────────────────────────────────────────
  isActive: {
    type:    Boolean,
    default: true,
    index:   true,
  },

  isArchived: {
    type:    Boolean,
    default: false,
  },

  // ── Per-user dismissal log ────────────────────────────────────────────────
  dismissedBy: {
    type:    [dismissalSchema],
    default: [],
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  analytics: {
    type:    analyticsSchema,
    default: () => ({ impressions: 0, clicks: 0, dismissals: 0 }),
  },

  // ── Metadata ─────────────────────────────────────────────────────────────
  createdBy: {
    type: Schema.Types.ObjectId,
    ref:  'User',
    required: true,
  },

  updatedBy: {
    type: Schema.Types.ObjectId,
    ref:  'User',
  },

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ─── Virtual: isLive (active + within schedule) ───────────────────────────────

marqueeSchema.virtual('isLive').get(function () {
  const now = new Date();
  if (!this.isActive || this.isArchived) return false;
  if (this.startsAt && now < this.startsAt) return false;
  if (this.endsAt   && now > this.endsAt)  return false;
  return true;
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

marqueeSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });
marqueeSchema.index({ priority: -1, createdAt: -1 });
marqueeSchema.index({ targetRoles: 1, isActive: 1 });

// ─── Model ───────────────────────────────────────────────────────────────────

const Marquee = mongoose.model('Marquee', marqueeSchema);
export default Marquee;