import mongoose from 'mongoose';

const { Schema } = mongoose;

/* ──────────────────────────────────────────────
 * CONSTANTS
 * ────────────────────────────────────────────── */

const AUDIENCE_TYPES = [
  'all',
  'guest',
  'authenticated',
  'role',
  'user',
  'region',
  'hospital',
  'subscription',
  'device',
];

const ALERT_TYPES = [
  'info',
  'success',
  'warning',
  'error',
  'critical',
  'promo',
  'system',
  'emergency',
];

const DISPLAY_MODES = [
  'topbar',
  'ticker',
  'toast',
  'modal',
  'inline',
  'floating',
  'notification',
];

const PLATFORMS = [
  'web',
  'android',
  'ios',
  'admin',
  'kiosk',
];

const STATUS = [
  'draft',
  'scheduled',
  'live',
  'paused',
  'expired',
  'archived',
];

/* ──────────────────────────────────────────────
 * CTA SCHEMA
 * ────────────────────────────────────────────── */

const ctaSchema = new Schema({
  label: {
    type: String,
    trim: true,
    maxlength: 80,
  },

  url: {
    type: String,
    trim: true,
  },

  target: {
    type: String,
    enum: ['_self', '_blank'],
    default: '_self',
  },

  variant: {
    type: String,
    enum: ['primary', 'secondary', 'danger'],
    default: 'primary',
  },
}, { _id: false });

/* ──────────────────────────────────────────────
 * AUDIENCE SCHEMA
 * ────────────────────────────────────────────── */

const audienceSchema = new Schema({

  type: {
    type: String,
    enum: AUDIENCE_TYPES,
    required: true,
  },

  values: [{
    type: String,
    trim: true,
  }],

}, { _id: false });

/* ──────────────────────────────────────────────
 * DISPLAY CONFIG
 * ────────────────────────────────────────────── */

const displayConfigSchema = new Schema({

  mode: {
    type: String,
    enum: DISPLAY_MODES,
    default: 'topbar',
  },

  sticky: {
    type: Boolean,
    default: false,
  },

  dismissible: {
    type: Boolean,
    default: true,
  },

  autoClose: {
    type: Boolean,
    default: false,
  },

  autoCloseDelayMs: {
    type: Number,
    default: 5000,
  },

  showIcon: {
    type: Boolean,
    default: true,
  },

  animation: {
    type: String,
    enum: [
      'slide',
      'fade',
      'ticker',
      'pulse',
      'none',
    ],
    default: 'slide',
  },

  priority: {
    type: Number,
    min: 0,
    max: 100,
    default: 1,
  },

}, { _id: false });

/* ──────────────────────────────────────────────
 * MAIN ANNOUNCEMENT SCHEMA
 * ────────────────────────────────────────────── */

const announcementSchema = new Schema({

  /* ───────────────── CONTENT ───────────────── */

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },

  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },

  description: {
    type: String,
    trim: true,
    maxlength: 3000,
    default: '',
  },

  icon: {
    type: String,
    default: '',
  },

  type: {
    type: String,
    enum: ALERT_TYPES,
    default: 'info',
  },

  /* ───────────────── CTA ───────────────── */

  cta: ctaSchema,

  /* ───────────────── TARGETING ───────────────── */

  audiences: {
    type: [audienceSchema],
    default: [
      { type: 'all', values: [] }
    ],
  },

  targetPages: [{
    type: String,
    trim: true,
  }],

  platforms: [{
    type: String,
    enum: PLATFORMS,
  }],

  /* ───────────────── DISPLAY ───────────────── */

  display: {
    type: displayConfigSchema,
    default: () => ({}),
  },

  /* ───────────────── REALTIME ───────────────── */

  realtime: {
    type: Boolean,
    default: false,
  },

  websocketEvent: {
    type: String,
    default: '',
  },

  /* ───────────────── SCHEDULING ───────────────── */

  startsAt: {
    type: Date,
    default: Date.now,
  },

  endsAt: {
    type: Date,
    default: null,
  },

  timezone: {
    type: String,
    default: 'Asia/Kolkata',
  },

  /* ───────────────── STATUS ───────────────── */

  status: {
    type: String,
    enum: STATUS,
    default: 'draft',
    index: true,
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },

  archivedAt: {
    type: Date,
    default: null,
  },

  /* ───────────────── ANALYTICS ───────────────── */

  analytics: {

    impressions: {
      type: Number,
      default: 0,
    },

    clicks: {
      type: Number,
      default: 0,
    },

    dismissals: {
      type: Number,
      default: 0,
    },

    conversions: {
      type: Number,
      default: 0,
    },

  },

  /* ───────────────── METADATA ───────────────── */

  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],

  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {},
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

}, {
  timestamps: true,
  minimize: false,
});

/* ──────────────────────────────────────────────
 * VIRTUALS
 * ────────────────────────────────────────────── */

announcementSchema.virtual('isLive').get(function () {

  const now = new Date();

  if (!this.isActive) return false;

  if (this.status !== 'live') return false;

  if (this.startsAt && now < this.startsAt) {
    return false;
  }

  if (this.endsAt && now > this.endsAt) {
    return false;
  }

  return true;
});

/* ──────────────────────────────────────────────
 * INDEXES
 * ────────────────────────────────────────────── */

announcementSchema.index({
  status: 1,
  isActive: 1,
  startsAt: 1,
  endsAt: 1,
});

announcementSchema.index({
  'display.priority': -1,
  createdAt: -1,
});

announcementSchema.index({
  targetPages: 1,
});

announcementSchema.index({
  platforms: 1,
});

announcementSchema.index({
  type: 1,
  status: 1,
});

/* ──────────────────────────────────────────────
 * MODEL
 * ────────────────────────────────────────────── */

const Announcement = mongoose.model(
  'Announcement',
  announcementSchema
);

export default Announcement;