import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// BLOOD BANK MODEL — Likeson.in
//
// Represents a blood bank facility. Three types:
//
//  standalone        → Independent blood bank
//                      managedBy → User{ role: 'blood_bank' }
//
//  hospital_embedded → Blood bank inside a hospital
//                      hospital → Hospital ref (required)
//                      managedBy → User{ role: 'blood_bank' } OR hospital manager
//
//  mobile_unit       → Mobile blood collection van
//                      parentBank → BloodBank ref (required)
//
// RELATIONSHIPS:
//   Hospital.bloodBanks → array of BloodBank refs (hospital side)
//   BloodBank.hospital  → Hospital ref (embedded type only)
//   Customer accesses blood bank via BloodBank model directly (search/find nearby)
//
// INVENTORY:
//   BloodInventory docs stored separately (one per bloodGroup+component).
//   BloodBank.inventory virtual populates them.
//
// COMPLIANCE (India):
//   Licensed under Drugs & Cosmetics Act, 1940.
//   NACO registration required. State Drug Controller license mandatory.
// ─────────────────────────────────────────────────────────────────────────────

export const BANK_TYPES = ['standalone', 'hospital_embedded', 'mobile_unit'];

export const BLOOD_BANK_STATUSES = [
  'pending',
  'under_review',
  'active',
  'suspended',
  'revoked',
  'deactivated',
];

export const ACCREDITATION_BODIES = ['NABH', 'NABL', 'NACO', 'State_Drug_Controller', 'ISO', 'Other'];

export const BLOOD_COMPONENTS = [
  'Whole Blood',
  'PRBC',
  'FFP',
  'Platelets',
  'Cryoprecipitate',
  'Plasma',
  'Single Donor Platelets',
  'Leukoreduced PRBC',
  'Irradiated PRBC',
  'Washed PRBC',
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const operatingHoursSchema = new Schema(
  {
    day:       { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
    openTime:  { type: String },
    closeTime: { type: String },
    is24Hours: { type: Boolean, default: false },
    isClosed:  { type: Boolean, default: false },
  },
  { _id: false }
);

const licenseSchema = new Schema(
  {
    licenseType: {
      type: String,
      enum: [
        'Drugs_Cosmetics_Act',
        'State_Drug_Controller',
        'NACO_Registration',
        'FSSAI',
        'Other',
      ],
      required: true,
    },
    licenseNumber:  { type: String, trim: true, required: true },
    issuedBy:       { type: String, trim: true },
    issuedOn:       { type: Date },
    validUntil:     { type: Date },
    documentUrl:    { type: String },
    isVerified:     { type: Boolean, default: false },
    verifiedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:     { type: Date },
  },
  { _id: true }
);

const accreditationSchema = new Schema(
  {
    body:          { type: String, enum: ACCREDITATION_BODIES, required: true },
    certificateNo: { type: String, trim: true },
    issuedOn:      { type: Date },
    validUntil:    { type: Date },
    documentUrl:   { type: String },
    isVerified:    { type: Boolean, default: false },
  },
  { _id: true }
);

const contactPersonSchema = new Schema(
  {
    name:            { type: String, trim: true, required: true },
    designation:     { type: String, trim: true },
    phone:           { type: String, trim: true },
    email:           { type: String, lowercase: true, trim: true },
    isPrimary:       { type: Boolean, default: false },
    isAvailable24x7: { type: Boolean, default: false },
  },
  { _id: true }
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalReviews:  { type: Number, default: 0 },
  },
  { _id: false }
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

const bankDetailsSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },
    accountLast4:      { type: String, maxlength: 4 },
    ifscCode: {
      type: String, uppercase: true, trim: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'],
    },
    bankName:   { type: String, trim: true },
    upiId:      { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
  },
  { _id: false }
);

const stockAlertSchema = new Schema(
  {
    bloodGroup:        { type: String, enum: BLOOD_GROUPS, required: true },
    component:         { type: String, enum: BLOOD_COMPONENTS, required: true },
    minThreshold:      { type: Number, required: true, min: 0 },
    criticalThreshold: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bloodBankSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type:     String,
      required: true,
      trim:     true,
      index:    true,
    },
    bankCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
    },
    slug: {
      type:      String,
      unique:    true,
      lowercase: true,
      trim:      true,
      index:     true,
    },

    bankType: {
      type:     String,
      required: true,
      enum:     BANK_TYPES,
      index:    true,
    },

    // ── Ownership ─────────────────────────────────────────────────────────────
    /**
     * managedBy → User{ role: 'blood_bank' } for standalone/mobile_unit.
     *             OR User{ role: 'hospital' } for hospital_embedded.
     * NOTE: Only users with role 'blood_bank' can manage standalone/mobile banks.
     *       hospital_embedded banks are managed by the parent hospital's manager.
     */
    managedBy: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    /**
     * hospital → required when bankType === 'hospital_embedded'.
     * The parent Hospital document. Hospital.bloodBanks array mirrors this.
     */
    hospital: {
      type:    Schema.Types.ObjectId,
      ref:     'Hospital',
      default: null,
      index:   true,
    },

    /**
     * parentBank → required when bankType === 'mobile_unit'.
     * The base blood bank operating this mobile unit.
     */
    parentBank: {
      type:    Schema.Types.ObjectId,
      ref:     'BloodBank',
      default: null,
    },

    description: { type: String, maxlength: 1000 },
    logoUrl:     { type: String },

    // ── Services ──────────────────────────────────────────────────────────────
    componentsHandled: {
      type:    [{ type: String, enum: BLOOD_COMPONENTS }],
      default: ['Whole Blood', 'PRBC'],
    },

    bloodGroupsAvailable: {
      type:    [{ type: String, enum: BLOOD_GROUPS }],
      default: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },

    acceptsDonations:          { type: Boolean, default: true },
    offersDelivery:            { type: Boolean, default: false },
    offersCrossMatch:          { type: Boolean, default: true },
    offersComponentSeparation: { type: Boolean, default: false },
    offersEmergencySupply:     { type: Boolean, default: true },
    isEmergency24x7:           { type: Boolean, default: false },
    hasApheresisFacility:      { type: Boolean, default: false },
    hasMobileUnit:             { type: Boolean, default: false },

    // ── Contact ───────────────────────────────────────────────────────────────
    contact: {
      phone:          { type: String, required: true },
      emergencyPhone: { type: String },
      alternatePhone: { type: String },
      email:          { type: String, lowercase: true, trim: true },
      whatsapp:       { type: String },
      website:        { type: String },
    },

    contactPersons: { type: [contactPersonSchema], default: [] },

    // ── Address & Location ────────────────────────────────────────────────────
    address: {
      line1:    { type: String, required: true, trim: true },
      line2:    { type: String, trim: true },
      landmark: { type: String, trim: true },
      city:     { type: String, default: 'Vijayawada', trim: true },
      state:    { type: String, default: 'Andhra Pradesh', trim: true },
      pincode: {
        type:     String,
        required: true,
        match:    [/^[1-9][0-9]{5}$/, 'Invalid PIN code'],
      },
    },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] },
    },

    googleMapsUrl: { type: String },

    // ── Operating Hours ───────────────────────────────────────────────────────
    operatingHours: { type: [operatingHoursSchema], default: [] },

    // ── Delivery ──────────────────────────────────────────────────────────────
    deliveryRadiusKm: { type: Number, default: 0, min: 0 },
    deliveryFeePerKm: { type: Number, default: 0, min: 0 },
    freeDeliveryKm:   { type: Number, default: 0, min: 0 },

    // ── Linked Hospitals ──────────────────────────────────────────────────────
    /**
     * linkedHospitals — hospitals with supply agreements with this bank.
     * Priority allocation during shortage events.
     * MIRROR: Hospital.bloodBanks also references this bank.
     */
    linkedHospitals: [{ type: Schema.Types.ObjectId, ref: 'Hospital' }],

    // ── Compliance ────────────────────────────────────────────────────────────
    licenses:       { type: [licenseSchema],       default: [] },
    accreditations: { type: [accreditationSchema], default: [] },

    // ── Stock Alert Thresholds ────────────────────────────────────────────────
    stockAlerts: { type: [stockAlertSchema], default: [] },

    // ── Pricing ───────────────────────────────────────────────────────────────
    // Blood itself cannot be sold (illegal in India). Only processing fees.
    pricing: [
      {
        component:     { type: String, enum: BLOOD_COMPONENTS },
        processingFee: { type: Number, default: 0, min: 0 },
        crossMatchFee: { type: Number, default: 0, min: 0 },
        storageFee:    { type: Number, default: 0, min: 0 },
      },
    ],

    platformFeePercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── Settlement ────────────────────────────────────────────────────────────
    settlementCycle: {
      type:    String,
      enum:    ['weekly', 'biweekly', 'monthly'],
      default: 'monthly',
    },
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },

    // ── Stats ─────────────────────────────────────────────────────────────────
    stats: {
      totalUnitsCollected:     { type: Number, default: 0 },
      totalUnitsIssued:        { type: Number, default: 0 },
      totalDonors:             { type: Number, default: 0 },
      totalDonations:          { type: Number, default: 0 },
      totalRequestsFulfilled:  { type: Number, default: 0 },
      totalRequestsPartial:    { type: Number, default: 0 },
      totalRequestsFailed:     { type: Number, default: 0 },
      totalEarnings:           { type: Number, default: 0 },
      lastDonationAt:          { type: Date },
      lastIssuanceAt:          { type: Date },
    },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    BLOOD_BANK_STATUSES,
      default: 'pending',
      index:   true,
    },
    statusLog:        { type: [statusLogSchema], default: [] },
    isVerified:       { type: Boolean, default: false, index: true },
    isActive:         { type: Boolean, default: false, index: true },
    isFeatured:       { type: Boolean, default: false },
    verifiedAt:       { type: Date },
    verifiedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason:  { type: String },
    suspensionReason: { type: String },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboarding: {
      step:        { type: Number,  default: 1 },
      isComplete:  { type: Boolean, default: false },
      completedAt: { type: Date },
    },

    // ── Internal ──────────────────────────────────────────────────────────────
    internalNotes: { type: String, select: false },
    tags:          [{ type: String, trim: true, lowercase: true }],
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

bloodBankSchema.virtual('isOperational').get(function () {
  return this.status === 'active' && this.isActive && this.isVerified;
});

bloodBankSchema.virtual('isHospitalEmbedded').get(function () {
  return this.bankType === 'hospital_embedded';
});

bloodBankSchema.virtual('isMobileUnit').get(function () {
  return this.bankType === 'mobile_unit';
});

/**
 * inventory virtual — all BloodInventory docs for this bank.
 */
bloodBankSchema.virtual('inventory', {
  ref:          'BloodInventory',
  localField:   '_id',
  foreignField: 'bloodBank',
  justOne:      false,
});


// ── Pre-validate ──────────────────────────────────────────────────────────────

bloodBankSchema.pre('validate', function () {
  if (this.bankType === 'hospital_embedded' && !this.hospital) {
    throw new Error('hospital_embedded banks require a hospital reference');
  }
  if (this.bankType === 'mobile_unit' && !this.parentBank) {
    throw new Error('mobile_unit banks require a parentBank reference');
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

bloodBankSchema.pre('save', async function () {
  // Auto-generate bankCode
  if (this.isNew && !this.bankCode) {
    const { customAlphabet } = await import('nanoid');
    const gen = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);
    let code, exists;
    do {
      code   = `BB-${gen()}`;
      exists = await mongoose.model('BloodBank').exists({ bankCode: code });
    } while (exists);
    this.bankCode = code;
  }

  // Auto-generate slug
  if (this.isNew || this.isModified('name')) {
  this.slug = this.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

  // Mask bank account number
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  // Append status log
  if (this.isModified('status') && !this.isNew) {
    this.statusLog.push({
      fromStatus: this._previousStatus || null,
      toStatus:   this.status,
      changedBy:  this.updatedBy || null,
    });
  }
  this._previousStatus = this.status;

  // Sync isActive + isVerified from status
  if (this.isModified('status')) {
    this.isActive   = this.status === 'active';
    this.isVerified = ['active', 'suspended'].includes(this.status);
    if (this.status === 'active' && !this.verifiedAt) this.verifiedAt = new Date();
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

bloodBankSchema.index({ location: '2dsphere' });
bloodBankSchema.index({ 'address.city': 1, isActive: 1 });
bloodBankSchema.index({ bankType: 1, isActive: 1 });
bloodBankSchema.index({ managedBy: 1 });
bloodBankSchema.index({ hospital: 1 });
bloodBankSchema.index({ linkedHospitals: 1 });
bloodBankSchema.index({ status: 1, isActive: 1 });
bloodBankSchema.index({ 'rating.averageRating': -1 });
bloodBankSchema.index({ componentsHandled: 1 });
bloodBankSchema.index({ isEmergency24x7: 1, isActive: 1 });

const BloodBank = mongoose.model('BloodBank', bloodBankSchema);
export default BloodBank;