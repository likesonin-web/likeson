import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Rating Summary Sub-Schema ─────────────────────────────────────────────────

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalReviews:  { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Emergency Contact Sub-Schema ──────────────────────────────────────────────

const emergencyContactSchema = new Schema(
  {
    name:         { type: String, trim: true },
    phone:        { type: String },
    relationship: { type: String, trim: true },
  },
  { _id: false }
);

// ── Main TransportPartnerProfile Schema ───────────────────────────────────────

/**
 * @desc Personal / KYC profile for the transport partner's User account.
 *
 * Separation of concerns:
 *  - User                   → auth, role, contact, login sessions
 *  - TransportPartner       → business entity, fleet (vehicles), service zones, pricing
 *  - TransportPartnerProfile (this file) → personal KYC, documents, profile details
 *
 * Linked to User via `user` field (foreignField used by User.js virtual 'profile').
 */
const transportPartnerProfileSchema = new Schema(
  {
    // ── Link to User account ──────────────────────────────────────────────────
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // ── Link to business entity ───────────────────────────────────────────────
    /**
     * The TransportPartner (company/business) this profile belongs to.
     * One owner User ↔ one TransportPartner business entity.
     */
    transportPartner: {
      type: Schema.Types.ObjectId,
      ref: 'TransportPartner',
      default: null,
    },

    // ── Personal Details ──────────────────────────────────────────────────────
    fullName:    { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    },
    profilePhoto: { type: String },  // URL

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },

    // ── KYC Documents ─────────────────────────────────────────────────────────
    aadhaarNumber:   { type: String, select: false },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl:  { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    panNumber:   { type: String, uppercase: true, select: false },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },

    // Owner may also be a driver — store license here if applicable
    drivingLicenseNumber: { type: String, sparse: true },
    drivingLicenseUrl:    { type: String },
    drivingLicenseExpiry: { type: Date },

    // ── KYC Verification Status ───────────────────────────────────────────────
    kycStatus: {
      type: String,
      enum: ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'],
      default: 'not-submitted',
      index: true,
    },
    kycVerifiedAt:      { type: Date },
    kycVerifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' }, // admin
    kycRejectionReason: { type: String },

    // ── Emergency Contact ─────────────────────────────────────────────────────
    emergencyContact: { type: emergencyContactSchema },

    // ── Bio / Professional Info ───────────────────────────────────────────────
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    yearsOfExperience: { type: Number, default: 0 },
    languagesSpoken:   [{ type: String, trim: true }],

    // ── Rating (shown on public profile) ─────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    // ── Notification Preferences ──────────────────────────────────────────────
    notifications: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Account Status ────────────────────────────────────────────────────────
    isProfileComplete: { type: Boolean, default: false },
    isActive:          { type: Boolean, default: true },

    // ── Internal Notes (admin-only) ───────────────────────────────────────────
    internalNotes: { type: String, select: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

/** True when KYC is fully approved by admin. */
transportPartnerProfileSchema.virtual('isKycComplete').get(function () {
  return this.kycStatus === 'verified';
});

/** Age computed from dateOfBirth. */
transportPartnerProfileSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

// ── Pre-save Middleware ───────────────────────────────────────────────────────

transportPartnerProfileSchema.pre('save', async function () {
  // Auto-mark profile complete when personal + KYC essentials are in place
  if (
    this.fullName &&
    this.dateOfBirth &&
    this.address?.city &&
    this.aadhaarVerified &&
    this.panVerified
  ) {
    this.isProfileComplete = true;
  }
  
});

// ── Indexes ───────────────────────────────────────────────────────────────────

transportPartnerProfileSchema.index({ kycStatus: 1 });
transportPartnerProfileSchema.index({ transportPartner: 1 });

const TransportPartnerProfile = mongoose.model(
  'TransportPartnerProfile',
  transportPartnerProfileSchema
);

export default TransportPartnerProfile;