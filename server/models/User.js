import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateReferralCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export const REFERRAL_INVITER_COINS = 1000;
export const REFERRAL_INVITEE_COINS = 500;
export const COINS_PER_RUPEE        = 100;

// ── Role → default avatar map ─────────────────────────────────────────────────
const roleAvatarLinks = {
  superadmin:        'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_48%20AM.png?updatedAt=1770615250119',
  admin:             'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_51%20AM.png?updatedAt=1770615250338',
  doctor:            'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_53%20AM.png?updatedAt=1770615250237',
  /**
   * hospital — ONLY for MANAGED hospital types:
   *   Multi-Specialty | Super-Specialty | Trust | Government
   *
   * NEVER assigned for Clinic / Nursing Home.
   * Those owners use role: 'doctor' instead.
   */
  hospital:          'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_51%20AM.png?updatedAt=1770615250338',
  transportpartner:  'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_57%20AM.png?updatedAt=1770615250197',
  driver:            'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_59%20AM.png?updatedAt=1770615249818',
  solodriverpartner: 'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_59%20AM.png?updatedAt=1770615249818',
  'lab partner':     'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_03_01%20AM.png?updatedAt=1770615250180',
  customer:          'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_42_20%20AM.png',
  finance:           'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_42_24%20AM.png',
  pharmacy:          'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_42_26%20AM.png',
  'care assistant':  'https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_42_52%20AM.png',
};

// ── Role → profile model map ──────────────────────────────────────────────────
/**
 * hospital → 'HospitalProfile'
 *   Manager of a MANAGED hospital type (Multi-Specialty / Super-Specialty /
 *   Trust / Government). Hospital.managedBy → this User._id.
 *
 * doctor → 'DoctorProfile'
 *   Practising doctor. Also the sole owner-manager for Clinic / Nursing Home.
 *   Hospital.managedBy → this User._id  (managementModel: 'doctor-owner').
 *   To find all owned hospitals: Hospital.find({ managedBy: this._id, managementModel: 'doctor-owner' })
 */
const roleModelMap = {
  customer:          'CustomerProfile',
  doctor:            'DoctorProfile',
  hospital:          'Hospital',
  driver:            'Driver',
  solodriverpartner: 'SoloDriverPartner',
  pharmacy:          'PharmacyProfile',
  transportpartner:  'TransportPartner',
  'care assistant':  'CareAssistantProfile',
};

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const auditSessionSchema = new Schema(
  {
    userAgent:    { type: String, default: 'Unknown' },
    ipAddress:    { type: String, default: 'Unknown' },
    deviceName:   { type: String, default: 'Unknown Device' },
    platform:     { type: String, enum: ['android', 'ios', 'web', 'desktop'], default: 'web' },
    createdAt:    { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const deviceTokenSchema = new Schema(
  {
    platform:   { type: String, enum: ['android', 'ios', 'web'], required: true },
    token:      { type: String, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    deviceName: { type: String, default: 'Unknown' },
    ipAddress:  { type: String },
  },
  { _id: true }
);

const referralHistorySchema = new Schema(
  {
    referredUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coinsAwarded: { type: Number, required: true },
    createdAt:    { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Main schema ────────────────────────────────────────────────────────────────

const userSchema = new Schema(
  {
    name:  { type: String, required: true, trim: true },
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
      index:     true,
    },
    password: {
      type:      String,
      select:    false,
      minlength: [8, 'Password must be at least 8 characters'],
    },

    phone:       { type: String, unique: true, sparse: true, index: true },
    phoneSuffix: { type: String },

    avatar: { type: String },

    role: {
      type:     String,
      required: true,
      enum: [
        'superadmin',
        'admin',

        /**
         * doctor
         *   Practising doctor linked to one or more hospitals.
         *   Also the sole owner-manager for Clinic / Nursing Home hospitals.
         *   (Hospital.managedBy → this._id, managementModel: 'doctor-owner')
         */
        'doctor',

        /**
         * hospital
         *   Dedicated manager/handler for MANAGED hospital types ONLY:
         *     Multi-Specialty | Super-Specialty | Trust | Government
         *   MUST NOT be assigned for Clinic / Nursing Home — use 'doctor'.
         *   (Hospital.managedBy → this._id, managementModel: 'hospital-manager')
         */
        'hospital',

        'transportpartner',
        'driver',
        'solodriverpartner',
        'customer',
        'pharmacy',
        'care assistant',
        'finance',
        'lab partner',
      ],
      default: 'customer',
    },

    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    otp:        { type: String, select: false },
    otpExpires: { type: Date,   select: false },

    googleAuth: {
      googleId:   { type: String, unique: true, sparse: true },
      isVerified: { type: Boolean, default: false },
    },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    lastKnownAddress: { type: String },

    isOnline:     { type: Boolean, default: false },
    lastseen:     { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },

    isBlocked:   { type: Boolean, default: false },
    blockReason: { type: String },
    unblockAt:   { type: Date },

    lastLoginAt:       { type: Date },
    lastLoginIp:       { type: String },
    loginCount:        { type: Number, default: 0 },
    passwordChangedAt: { type: Date },

    auditSessions: { type: [auditSessionSchema], default: [] },
    deviceTokens:  { type: [deviceTokenSchema],  default: [] },

    termsAcceptedAt:         { type: Date },
    privacyPolicyAcceptedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // ── Referral system ───────────────────────────────────────────────────────
    referralCode:    { type: String, unique: true, sparse: true, index: true },
    referredBy:      { type: Schema.Types.ObjectId, ref: 'User', default: null },
    referralHistory: { type: [referralHistorySchema], default: [] },

    coins:         { type: Number, default: 0, min: 0 },
    coinsEarned:   { type: Number, default: 0 },
    coinsRedeemed: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * profile virtual — resolves to the role-specific profile document.
 *
 *   role: 'hospital'  → HospitalProfile  (manager of MANAGED hospital types)
 *   role: 'doctor'    → DoctorProfile    (practising doctor; also Clinic/Nursing Home owner)
 */
userSchema.virtual('profile', {
  ref: function () {
    return roleModelMap[this.role] || 'CustomerProfile';
  },
  localField:   '_id',
  foreignField: 'user',
  justOne:      true,
});

/**
 * managedHospitals virtual — all Hospital docs where Hospital.managedBy === this._id
 *
 *   role: 'hospital'  → returns MANAGED-type hospitals this user handles
 *   role: 'doctor'    → returns OWNER-OPERATED hospitals (Clinic/Nursing Home) this doctor owns
 *
 * Usage:
 *   await User.findById(id).populate('managedHospitals')
 *
 * Note: This is a virtual populate — no array is stored on User.
 *       The source of truth is Hospital.managedBy.
 */
userSchema.virtual('managedHospitals', {
  ref:          'Hospital',
  localField:   '_id',
  foreignField: 'managedBy',
  justOne:      false,
});

userSchema.virtual('isCurrentlyBlocked').get(function () {
  if (!this.isBlocked) return false;
  if (this.unblockAt && this.unblockAt < new Date()) return false;
  return true;
});

userSchema.virtual('coinsInRupees').get(function () {
  return +(this.coins / COINS_PER_RUPEE).toFixed(2);
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

userSchema.pre('save', async function () {
  // 1. Auto-assign role avatar
  if (this.isModified('role') || this.isNew) {
    this.avatar = roleAvatarLinks[this.role] || roleAvatarLinks.customer;
  }

  // 2. Auto-unblock expired suspensions
  if (this.isBlocked && this.unblockAt && this.unblockAt < new Date()) {
    this.isBlocked   = false;
    this.unblockAt   = undefined;
    this.blockReason = undefined;
  }

  // 3. Normalise phone to E.164 (+91XXXXXXXXXX)
  if (this.isModified('phone') && this.phone) {
    const raw    = this.phone.trim();
    const digits = raw.replace(/\D/g, '');

    if (digits.length === 10) {
      this.phone       = `+91${digits}`;
      this.phoneSuffix = digits.slice(-4);
    } else if (digits.length === 12 && digits.startsWith('91')) {
      this.phone       = `+${digits}`;
      this.phoneSuffix = digits.slice(-4);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      this.phone       = `+91${digits.slice(1)}`;
      this.phoneSuffix = digits.slice(-4);
    } else if (raw.startsWith('+') && digits.length >= 10) {
      this.phone       = `+${digits}`;
      this.phoneSuffix = digits.slice(-4);
    }
  }

  // 4. Generate unique referral code on first save
  if (this.isNew && !this.referralCode) {
    let code, exists;
    do {
      code   = generateReferralCode();
      exists = await mongoose.model('User').exists({ referralCode: code });
    } while (exists);
    this.referralCode = code;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

userSchema.index({ email: 1, role: 1 });
userSchema.index({ unblockAt: 1 });
userSchema.index({ location: '2dsphere' });
userSchema.index({ referralCode: 1 });

const User = mongoose.model('User', userSchema);
export default User;