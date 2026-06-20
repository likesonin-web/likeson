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
  'NABL',
  'CAP',
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
  'pending',
  'under_review',
  'approved',
  'suspended',
  'rejected',
  'deactivated',
];

export const SPECIMEN_TYPES = [
  'Serum',
  'Plasma',
  'Whole Blood',
  'Urine',
  'Stool',
  'Swab',
  'Saliva',
  'CSF',
  'Tissue',
  'Other',
];

export const PANEL_TYPES = [
  'Wellness',
  'Preventive',
  'Disease Management',
  'Pre-operative',
  'Organ Function',
  'Hormonal',
  'Cardiac',
  'Diabetic',
  'Pediatric',
  'Senior',
  'Women Health',
  'Men Health',
  'Custom',
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

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

const accreditationSchema = new Schema(
  {
    body:          { type: String, enum: ACCREDITATION_BODIES, required: true },
    certificateNo: { type: String, trim: true },
    issuedOn:      { type: Date },
    validUntil:    { type: Date },
    documentUrl:   { type: String },
    isVerified:    { type: Boolean, default: false },
    verifiedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:    { type: Date },
  },
  { _id: true }
);

const complianceDocSchema = new Schema(
  {
    docType: {
      type: String,
      enum: [
        'Lab_Registration_Certificate',
        'PCB_NOC',
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
 * labTestSchema — modeled after SRL / Metropolis / Apollo Diagnostics catalog.
 *
 * Key industry fields:
 *   loincCode  — LOINC identifier (global interoperability standard; used by Quest, LabCorp)
 *   cptCode    — CPT billing code (standard in insurance claims)
 *   slug       — URL-safe unique identifier for API/frontend routing
 *   specimenRequirements — fasting, container type, volume, handling notes
 *   reportFormat — PDF | HL7 | FHIR (enterprise EHR integration)
 */
const labTestSchema = new Schema(
  {
    slug: {
      type:      String,
      trim:      true,
      lowercase: true,
      // e.g. "complete-blood-count", "thyroid-stimulating-hormone"
      // set in pre-save hook below; used in URLs + deduplication
    },

    // ── Clinical Identity ────────────────────────────────────────────────────
    testName:    { type: String, required: true, trim: true },
    shortName:   { type: String, trim: true },        // e.g. "CBC", "TSH", "HbA1c"
    loincCode:   { type: String, trim: true },        // e.g. "58410-2" (CBC panel)
    cptCode:     { type: String, trim: true },        // e.g. "85025" (CBC with diff)
    category:    { type: String, trim: true },        // e.g. "Hematology", "Endocrinology"
    subCategory: { type: String, trim: true },        // e.g. "Thyroid Function", "Lipid Panel"
    description: { type: String, trim: true },

    // ── Specimen / Pre-Analytics ─────────────────────────────────────────────
    specimenRequirements: {
      specimenType:    { type: String, enum: SPECIMEN_TYPES, default: 'Serum' },
      volume:          { type: String, trim: true },  // e.g. "3 mL", "Mid-stream"
      containerType:   { type: String, trim: true },  // e.g. "SST (Gold top)", "EDTA"
      fastingRequired: { type: Boolean, default: false },
      fastingHours:    { type: Number },              // 0 if not required
      specialHandling: { type: String, trim: true },  // e.g. "Keep on ice", "Protect from light"
      stabilityCriteria: { type: String, trim: true },
    },

    turnaroundHours: { type: Number },                // TAT in hours
    reportFormat: {
      type:    String,
      enum:    ['PDF', 'HL7', 'FHIR', 'PDF+HL7'],
      default: 'PDF',
    },
    reportTemplateUrl: { type: String },

    // ── Pricing ──────────────────────────────────────────────────────────────
    mrpPrice:        { type: Number, required: true, min: 0 },
    partnerPrice:    { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, min: 0 },

    homeCollectionAvailable: { type: Boolean, default: false },
    isActive:                { type: Boolean, default: true },
  },
  {
    _id: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Platform earning per test
labTestSchema.virtual('platformMargin').get(function () {
  const charged = this.discountedPrice ?? this.mrpPrice;
  return +(charged - this.partnerPrice).toFixed(2);
});

/**
 * labPackageSchema — modeled after Thyrocare Aarogyam / Apollo Fit India panels.
 *
 * Key design choices vs raw test list:
 *   slug       — URL-safe unique ID (e.g. "full-body-checkup-advanced")
 *   panelType  — classification for discovery/filtering
 *   highlights — marketing bullets shown on listing cards
 *   tests[]    — refs to labTests subdoc _ids within same LabPartnerProfile
 *   parameters — total reportable analytes (e.g. Aarogyam C = 72 parameters)
 */
const labPackageSchema = new Schema(
  {
    slug: {
      type:      String,
      trim:      true,
      lowercase: true,
      // e.g. "full-body-checkup-basic", "womens-hormone-panel"
    },

    packageName:  { type: String, required: true, trim: true },
    panelType:    { type: String, enum: PANEL_TYPES, required: true },
    description:  { type: String, trim: true },
    highlights:   [{ type: String, trim: true }],   // e.g. ["72 parameters", "Fasting required"]
    forAgeGroup:  { type: String, trim: true },     // e.g. "18–60 years", "60+ years"
    forGender:    { type: String, enum: ['Male', 'Female', 'All'], default: 'All' },

    /**
     * tests — ObjectId refs pointing to _id fields within this lab's labTests array.
     * Mongoose does not support cross-subdocument populate natively;
     * resolve manually or via aggregation $lookup on labTests._id.
     */
    tests: [{ type: Schema.Types.ObjectId }],
    totalParameters: { type: Number, default: 0 },   // set on save; cached analyte count

    // ── Pricing ──────────────────────────────────────────────────────────────
    mrpPrice:    { type: Number, required: true, min: 0 },
    partnerPrice:{ type: Number, min: 0 },

    isActive:   { type: Boolean, default: true },
    validUntil: { type: Date },
    imageUrl:   { type: String },  // package banner/card image
  },
  { _id: true }
);

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

const bankDetailsSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },
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

const reviewSchema = new Schema(
  {
    user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating:    { type: Number, min: 1, max: 5, required: true },
    comment:   { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    isVisible: { type: Boolean, default: true },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const labPartnerProfileSchema = new Schema(
  {
    // ── Link to User account ─────────────────────────────────────────────────
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
    logoUrl:       { type: String },
    coverImageUrl: { type: String },
    websiteUrl:    { type: String, trim: true },

    // ── Legal / Registration ─────────────────────────────────────────────────
    registrationNumber: { type: String, trim: true },
    gstin:              { type: String, trim: true, uppercase: true },
    panNumber:          { type: String, trim: true, uppercase: true },
    establishedYear:    { type: Number },

    // ── Address & Geo ─────────────────────────────────────────────────────────
    registeredAddress: { type: addressSchema, required: true },

    branches: [
      {
        branchName:     { type: String, trim: true },
        address:        { type: addressSchema },
        timing:         [timingSlotSchema],
        contactPersons: [contactPersonSchema],
        isActive:       { type: Boolean, default: true },
      },
    ],

    // ── Operations ───────────────────────────────────────────────────────────
    timing:               [timingSlotSchema],
    sampleCollectionMode: { type: String, enum: SAMPLE_COLLECTION_MODES, default: 'Both' },
    homeCollectionRadius: { type: Number, default: 0 },
    homeCollectionFee:    { type: Number, default: 0 },
    reportDeliveryModes:  [{ type: String, enum: REPORT_DELIVERY_MODES }],
    avgTurnaroundHours:   { type: Number },

    // ── Tests & Packages ─────────────────────────────────────────────────────
    labTests:    [labTestSchema],
    labPackages: [labPackageSchema],

    // ── Accreditation & Compliance ───────────────────────────────────────────
    accreditations: [accreditationSchema],
    complianceDocs: [complianceDocSchema],

    // ── Contact Persons ──────────────────────────────────────────────────────
    contactPersons: [contactPersonSchema],

    // ── Banking & Payouts ────────────────────────────────────────────────────
    bankDetails:     { type: bankDetailsSchema },
    payoutFrequency: { type: String, enum: PAYOUT_FREQUENCIES, default: 'Monthly' },
    commissionRate:  { type: Number, min: 0, max: 100, default: 0 },
earnings: {
  pendingPayoutPaise: { type: Number, default: 0, min: 0 }, // Unsettled balance
  totalPaidPaise: { type: Number, default: 0, min: 0 },     // Lifetime successfully transferred
  lifetimeEarningsPaise: { type: Number, default: 0, min: 0 }, // pending + total
  lastPayoutAt: { type: Date }
},
    // ── Status & Workflow ────────────────────────────────────────────────────
    status:           { type: String, enum: LAB_STATUS, default: 'pending', index: true },
    statusLog:        [statusLogSchema],
    rejectionReason:  { type: String },
    suspensionReason: { type: String },
    approvedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:       { type: Date },

    // ── Ratings & Reviews ─────────────────────────────────────────────────────
    reviews:       [reviewSchema],
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews:  { type: Number, default: 0 },

    // ── Metadata ─────────────────────────────────────────────────────────────
    tags:       [{ type: String, trim: true, lowercase: true }],
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: false },

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

labPartnerProfileSchema.virtual('totalTests').get(function () {
  return this.labTests?.filter(t => t.isActive).length ?? 0;
});

labPartnerProfileSchema.virtual('totalPackages').get(function () {
  return this.labPackages?.filter(p => p.isActive).length ?? 0;
});

labPartnerProfileSchema.virtual('totalBranches').get(function () {
  return this.branches?.filter(b => b.isActive).length ?? 0;
});

labPartnerProfileSchema.virtual('isOperational').get(function () {
  return this.status === 'approved' && this.isActive;
});

labPartnerProfileSchema.virtual('bookings', {
  ref:          'BookingLab',
  localField:   '_id',
  foreignField: 'labPartner',
  justOne:      false,
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/** Recalculate averageRating on review change */
labPartnerProfileSchema.pre('save', async function () {
  if (this.isModified('reviews')) {
    const visible = this.reviews.filter(r => r.isVisible);
    this.totalReviews  = visible.length;
    this.averageRating = visible.length > 0
      ? +(visible.reduce((s, r) => s + r.rating, 0) / visible.length).toFixed(2)
      : 0;
  }
});

/** Auto-generate labCode (LAB-XXXXXXXX) on first save */
labPartnerProfileSchema.pre('save', async function () {
  if (this.isNew && !this.labCode) {
    const chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
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

/**
 * Auto-generate slugs for tests + packages that lack one.
 * Slug = kebab-case of name, e.g. "CBC" → "cbc", "Full Body Checkup" → "full-body-checkup"
 */
labPartnerProfileSchema.pre('save', function () {
  const toSlug = (str) =>
    str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (this.isModified('labTests')) {
    this.labTests.forEach((t) => {
      if (!t.slug) t.slug = toSlug(t.testName);
    });
  }

  if (this.isModified('labPackages')) {
    this.labPackages.forEach((p) => {
      if (!p.slug) p.slug = toSlug(p.packageName);
      // cache total parameters count from linked tests array length
      if (!p.totalParameters) p.totalParameters = p.tests?.length ?? 0;
    });
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
labPartnerProfileSchema.index({ 'labTests.loincCode': 1 });
labPartnerProfileSchema.index({ 'labTests.slug': 1 });
labPartnerProfileSchema.index({ 'labPackages.slug': 1 });
labPartnerProfileSchema.index({ 'labPackages.panelType': 1 });
labPartnerProfileSchema.index(
  { 'labTests.testName': 'text', labName: 'text', tags: 'text', 'labPackages.packageName': 'text' }
);

// ─────────────────────────────────────────────────────────────────────────────

const LabPartnerProfile = mongoose.model('LabPartnerProfile', labPartnerProfileSchema);
export default LabPartnerProfile;