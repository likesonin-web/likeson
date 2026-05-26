import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
//  ENTERPRISE MARQUEE MODEL 
//  Optimized for scale, guest users, scheduling, and strict validation.
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = [
  'superadmin', 'admin', 'doctor', 'transportpartner',
  'driver', 'lab partner', 'finance', 'pharmacy', 'care assistant', 'customer',
];

const MARQUEE_TYPES  = ['info', 'warning', 'success', 'error', 'promo'];
const MARQUEE_SPEEDS = ['slow', 'normal', 'fast'];
const AUDIENCE_TYPES = ['public', 'guests_only', 'authenticated', 'targeted'];
const STATUS_TYPES   = ['draft', 'published', 'archived']; // Replaces isActive/isArchived

// ─── Sub-schema: click/impression analytics ──────────────────────────────────
const analyticsSchema = new Schema({
  impressions: { type: Number, default: 0 },
  clicks:      { type: Number, default: 0 },
  dismissals:  { type: Number, default: 0 },
}, { _id: false });

// ─── Main schema ─────────────────────────────────────────────────────────────
const marqueeSchema = new Schema({

  // ── Content ──────────────────────────────────────────────────────────────
  message: {
    type:     String,
    required: [true, 'A marquee message is required'],
    trim:     true,
    maxlength: 500,
  },
  subText: { type: String, trim: true, maxlength: 1000, default: '' },
  icon:    { type: String, default: '' },

  // ── Display Settings ─────────────────────────────────────────────────────
  type:     { type: String, enum: MARQUEE_TYPES, default: 'info' },
  speed:    { type: String, enum: MARQUEE_SPEEDS, default: 'normal' },
  priority: { type: Number, default: 0, min: 0, max: 100 },
  
  // Unique identifier for frontend localStorage/cookie dismissal tracking
  clientKey: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `mq_${new mongoose.Types.ObjectId().toString()}` 
  },
  
  isDismissible: { type: Boolean, default: true },

  cta: {
    label:  { type: String, default: '' },
    url:    { type: String, default: '' },
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
  },

  // ── Audience & Targeting ─────────────────────────────────────────────────
  audience: {
    type: String,
    enum: AUDIENCE_TYPES,
    default: 'public',
  },

  targetRoles: [{ type: String, enum: ROLES }],
  targetUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  targetPages: [{ type: String, trim: true }],

  // ── Scheduling & Status ──────────────────────────────────────────────────
  startsAt: { type: Date, default: Date.now },
  endsAt:   { type: Date, default: null }, // null = runs indefinitely
  
  status: { 
    type: String, 
    enum: STATUS_TYPES, 
    default: 'draft' 
  },

  // ── Analytics & Metadata ─────────────────────────────────────────────────
  analytics: {
    type: analyticsSchema,
    default: () => ({ impressions: 0, clicks: 0, dismissals: 0 }),
  },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ─── Custom Validation ───────────────────────────────────────────────────────

// Ensure that if audience is 'targeted', they actually provided targets
marqueeSchema.pre('save', async function () {
  if (this.audience === 'targeted') {
    const hasRoles = this.targetRoles && this.targetRoles.length > 0;
    const hasUsers = this.targetUsers && this.targetUsers.length > 0;
    
    if (!hasRoles && !hasUsers) {
      return next(new Error('A "targeted" marquee must have at least one targetRole or targetUser.'));
    }
  }
   
});

// ─── Virtual: isLive ─────────────────────────────────────────────────────────

// Dynamically checks if the marquee should currently be visible
marqueeSchema.virtual('isLive').get(function () {
  const now = new Date();
  if (this.status !== 'published') return false;
  if (this.startsAt && now < this.startsAt) return false;
  if (this.endsAt && now > this.endsAt) return false;
  return true;
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

// Optimized index for the frontend fetching active marquees.
// Queries will usually filter by status, audience, and dates, then sort by priority.
marqueeSchema.index({ status: 1, audience: 1, startsAt: 1, endsAt: 1, priority: -1 });

const Marquee = mongoose.model('Marquee', marqueeSchema);
export default Marquee;