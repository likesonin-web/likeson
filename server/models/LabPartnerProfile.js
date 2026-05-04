import mongoose from 'mongoose';

const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_TYPES = [
  'Diagnostic Lab',
  'Pathology Lab',
  'Radiology Center',
  'Microbiology Lab',
  'Biochemistry Lab',
  'Genetic Testing Lab',
  'Molecular Lab',
  'Immunology Lab',
  'Multi-Specialty Lab',
];

export const OWNERSHIP_TYPES = [
  'Private',
  'Corporate Chain',
  'Franchise',
  'Government',
  'Trust / NGO',
];

export const ACCREDITATION_BODIES = [
  'NABL',   // National Accreditation Board for Testing and Calibration Laboratories
  'CAP',    // College of American Pathologists
  'ISO',
  'NABH',
  'JCI',
  'Other',
];

export const REPORT_DELIVERY_MODES = [
  'Digital (App)',
  'Email',
  'WhatsApp',
  'Physical Copy',
  'All',
];

export const SAMPLE_COLLECTION_MODES = [
  'Walk-in',
  'Home Collection',
  'Both',
];

export const PAYOUT_FREQUENCIES = [
  'Weekly',
  'Bi-weekly',
  'Monthly',
];

export const LAB_STATUS = [
  'pending',       // Submitted, awaiting review
  'under_review',  // Admin reviewing documents
  'approved',      // Active & operational
  'suspended',     // Temporarily suspended
  'rejected',      // Application rejected
  'deactivated',   // Voluntarily deactivated
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Address sub-schema
 * Reused for registered address and branch addresses.
 */
const addressSchema = new Schema(
  {
    line1:    { type: String, required: true, trim: true },
    line2:    { type: String, trim: true },
    city:     { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    state:    { type: String, required: true, trim: true },
    pincode:  { type: String, required: true, trim: true },
    country:  { type: String, default: 'India', trim: true },
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },  // [lng, lat]
    },
  },
  { _id: false }
);

/**
 * Accreditation certificate
 */
const accreditationSchema = new Schema(
  {
    body:           { type: String, enum: ACCREDITATION_BODIES, required: true },
    certificateNo:  { type: String, trim: true },
    issuedOn:       { type: Date },
    validUntil:     { type: Date },
    documentUrl:    { type: String },   // ImageKit / S3 URL
    isVerified:     { type: Boolean, default: false },
    verifiedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:     { type: Date },
  },
  { _id: true }
);

/**
 * Regulatory / Compliance document
 */
const complianceDocSchema = new Schema(
  {
    docType: {
      type: String,
      enum: [
        'Lab_Registration_Certificate',
        'PCB_NOC',                   // Pollution Control Board
        'Bio_Medical_Waste_License',
        'Drug_License',
        'GSTIN_Certificate',
        'PAN_Card',
        'Trade_License',
        'MSME_Certificate',
        'Other',
      ],
      required: true,
    },
    docNumber:   { type: String, trim: true },
    issuedOn:    { type: Date },
    validUntil:  { type: Date },
    documentUrl: { type: String },
    isVerified:  { type: Boolean, default: false },
    verifiedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:  { type: Date },
    remarks:     { type: String },
  },
  { _id: true }
);

/**
 * Test / Service offered by the lab
 */
const labTestSchema = new Schema(
  {
    testCode:        { type: String, trim: true },
    testName:        { type: String, required: true, trim: true },
    category:        { type: String, trim: true },
    sampleType:      { type: String, trim: true },
    turnaroundHours: { type: Number },

    mrpPrice:        { type: Number, required: true, min: 0 },  // patient pays this
    partnerPrice:    { type: Number, required: true, min: 0 },  // you pay lab this
    discountedPrice: { type: Number, min: 0 },                  // optional: you charge patient less than MRP

    homeCollectionAvailable: { type: Boolean, default: false },
    isActive:        { type: Boolean, default: true },
    reportTemplateUrl: { type: String },
  },
  {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Your earning per test
labTestSchema.virtual('platformMargin').get(function () {
  const chargedToPatient = this.discountedPrice ?? this.mrpPrice;
  return +(chargedToPatient - this.partnerPrice).toFixed(2);
});

/**
 * Package / Panel offered by the lab
 */
const labPackageSchema = new Schema(
  {
    packageCode: { type: String, trim: true },
    packageName: { type: String, required: true, trim: true },
    description: { type: String },
    tests:       [{ type: Schema.Types.ObjectId }],  // refs into labTests array _ids
    mrpPrice:    { type: Number, required: true, min: 0 },
    partnerPrice:{ type: Number, min: 0 },
    isActive:    { type: Boolean, default: true },
    validUntil:  { type: Date },
  },
  { _id: true }
);

/**
 * Operational timing slot
 */
const timingSlotSchema = new Schema(
  {
    day: {
      type: String,
      enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      required: true,
    },
    openTime:  { type: String, required: true },   // "08:00"
    closeTime: { type: String, required: true },   // "20:00"
    isClosed:  { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Bank / payout details
 */
const bankDetailsSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },  // sensitive
    ifscCode:          { type: String, trim: true, uppercase: true },
    bankName:          { type: String, trim: true },
    branchName:        { type: String, trim: true },
    accountType:       { type: String, enum: ['Savings', 'Current'], default: 'Current' },
    upiId:             { type: String, trim: true },
    isVerified:        { type: Boolean, default: false },
    verifiedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:        { type: Date },
  },
  { _id: false }
);

/**
 * Primary contact person (e.g. Lab Director, Operations Head)
 */
const contactPersonSchema = new Schema(
  {
    name:        { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    phone:       { type: String, trim: true },
    email:       { type: String, lowercase: true, trim: true },
    isPrimary:   { type: Boolean, default: false },
  },
  { _id: true }
);

/**
 * Status change audit log entry
 */
const statusLogSchema = new Schema(
  {
    fromStatus: { type: String },
    toStatus:   { type: String, required: true },
    changedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    reason:     { type: String },
    changedAt:  { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * Review / Rating entry (from customers after test completion)
 */
const reviewSchema = new Schema(
  {
    user:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating:     { type: Number, min: 1, max: 5, required: true },
    comment:    { type: String, trim: true },
    createdAt:  { type: Date, default: Date.now },
    isVisible:  { type: Boolean, default: true },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const labPartnerProfileSchema = new Schema(
  {
    // ── Link to User account ─────────────────────────────────────────────────
    /**
     * user → User._id where User.role === 'lab partner'
     * This is the ONLY link to the User collection.
     * No hospital or doctor reference exists here — this is a standalone
     * external collaboration partner.
     */
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Lab Identity ─────────────────────────────────────────────────────────
    labName:       { type: String, required: true, trim: true },
    labCode:       { type: String, unique: true, sparse: true, index: true, trim: true },
    labType:       { type: String, enum: LAB_TYPES, required: true },
    ownershipType: { type: String, enum: OWNERSHIP_TYPES, required: true },
    description:   { type: String, trim: true },
    logoUrl:       { type: String },                      // ImageKit URL
    coverImageUrl: { type: String },
    websiteUrl:    { type: String, trim: true },

    // ── Legal / Registration ─────────────────────────────────────────────────
    registrationNumber: { type: String, trim: true },     // State lab registration
    gstin:              { type: String, trim: true, uppercase: true },
    panNumber:          { type: String, trim: true, uppercase: true },
    establishedYear:    { type: Number },

    // ── Address & Geo ─────────────────────────────────────────────────────────
    registeredAddress: { type: addressSchema, required: true },

    /**
     * branches — additional collection points / sample centres.
     * Each branch has its own address + geo + timing.
     * The main lab is NOT repeated here.
     */
    branches: [
      {
        branchName: { type: String, trim: true },
        address:    { type: addressSchema },
        timing:     [timingSlotSchema],
        contactPersons: [contactPersonSchema],
        isActive:   { type: Boolean, default: true },
      },
    ],

    // ── Operations ───────────────────────────────────────────────────────────
    timing:               [timingSlotSchema],
    sampleCollectionMode: { type: String, enum: SAMPLE_COLLECTION_MODES, default: 'Both' },
    homeCollectionRadius: { type: Number, default: 0 },   // km; 0 = not offered
    homeCollectionFee:    { type: Number, default: 0 },   // ₹
    reportDeliveryModes:  [{ type: String, enum: REPORT_DELIVERY_MODES }],
    avgTurnaroundHours:   { type: Number },               // overall average TAT

    // ── Tests & Packages ─────────────────────────────────────────────────────
    labTests:    [labTestSchema],
    labPackages: [labPackageSchema],

    // ── Accreditation & Compliance ───────────────────────────────────────────
    accreditations:   [accreditationSchema],
    complianceDocs:   [complianceDocSchema],

    // ── Contact Persons ──────────────────────────────────────────────────────
    /**
     * contactPersons — human POCs (Lab Director, Ops Head, etc.)
     * Not linked to any User account; purely informational.
     */
    contactPersons: [contactPersonSchema],

    // ── Banking & Payouts ────────────────────────────────────────────────────
    bankDetails:      { type: bankDetailsSchema },
    payoutFrequency:  { type: String, enum: PAYOUT_FREQUENCIES, default: 'Monthly' },
    commissionRate:   { type: Number, min: 0, max: 100, default: 0 },  // % platform commission

    // ── Status & Workflow ────────────────────────────────────────────────────
    status:     { type: String, enum: LAB_STATUS, default: 'pending', index: true },
    statusLog:  [statusLogSchema],
    rejectionReason:  { type: String },
    suspensionReason: { type: String },
    approvedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:  { type: Date },

    // ── Ratings & Reviews ─────────────────────────────────────────────────────
    reviews:       [reviewSchema],
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews:  { type: Number, default: 0 },

    // ── Metadata ─────────────────────────────────────────────────────────────
    tags:       [{ type: String, trim: true, lowercase: true }],  // searchable tags
    isVerified: { type: Boolean, default: false },  // admin-verified badge
    isFeatured: { type: Boolean, default: false },  // show in featured list
    isActive:   { type: Boolean, default: false },  // operational flag

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * totalTests — number of active tests offered
 */
labPartnerProfileSchema.virtual('totalTests').get(function () {
  return this.labTests?.filter(t => t.isActive).length ?? 0;
});

/**
 * totalPackages — number of active packages offered
 */
labPartnerProfileSchema.virtual('totalPackages').get(function () {
  return this.labPackages?.filter(p => p.isActive).length ?? 0;
});

/**
 * totalBranches
 */
labPartnerProfileSchema.virtual('totalBranches').get(function () {
  return this.branches?.filter(b => b.isActive).length ?? 0;
});

/**
 * isOperational — true only when approved + active
 */
labPartnerProfileSchema.virtual('isOperational').get(function () {
  return this.status === 'approved' && this.isActive;
});

/**
 * bookings virtual — all BookingLab docs for this lab.
 *
 * Usage:
 *   await LabPartnerProfile.findById(id).populate('bookings')
 */
labPartnerProfileSchema.virtual('bookings', {
  ref:          'BookingLab',       // your lab booking model
  localField:   '_id',
  foreignField: 'labPartner',
  justOne:      false,
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-save: recalculate averageRating whenever reviews change.
 */
labPartnerProfileSchema.pre('save', async function () {
  if (this.isModified('reviews')) {
    const visible = this.reviews.filter(r => r.isVisible);
    this.totalReviews = visible.length;
    this.averageRating =
      visible.length > 0
        ? +(visible.reduce((sum, r) => sum + r.rating, 0) / visible.length).toFixed(2)
        : 0;
  }
 
});

/**
 * Pre-save: auto-generate a unique labCode if not set.
 * Format: LAB-XXXXXXXX (8 uppercase alphanumeric chars)
 */
labPartnerProfileSchema.pre('save', async function () {
  if (this.isNew && !this.labCode) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const generate = (len) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    let code, exists;
    do {
      code   = `LAB-${generate(8)}`;
      exists = await mongoose.model('LabPartnerProfile').exists({ labCode: code });
    } while (exists);

    this.labCode = code;
  }
 
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

labPartnerProfileSchema.index({ 'registeredAddress.location': '2dsphere' });
labPartnerProfileSchema.index({ 'branches.address.location': '2dsphere' });
labPartnerProfileSchema.index({ status: 1, isActive: 1 });
labPartnerProfileSchema.index({ labType: 1 });
labPartnerProfileSchema.index({ averageRating: -1 });
labPartnerProfileSchema.index({ tags: 1 });
labPartnerProfileSchema.index({ isFeatured: 1, isActive: 1 });
labPartnerProfileSchema.index({ 'labTests.testName': 'text', labName: 'text', tags: 'text' });  // full-text

// ─────────────────────────────────────────────────────────────────────────────

const LabPartnerProfile = mongoose.model('LabPartnerProfile', labPartnerProfileSchema);
export default LabPartnerProfile;