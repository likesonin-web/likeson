import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// BLOOD REQUEST MODEL — Likeson.in  (fixed)
//
// FIX 1: prescriptionUrl enforced for non-emergency patient_direct requests
// FIX 2: searchAndAllocate uses populated (non-lean) bloodBank correctly
// FIX 3: fareBreakdown spread safe on new doc
// FIX 4: voluntary_camp hospital validation message corrected
// FIX 5: booking field removed entirely
// ─────────────────────────────────────────────────────────────────────────────

export const REQUEST_TYPES = [
  'patient_direct',
  'hospital_internal',
  'emergency',
  'voluntary_camp',
];

export const REQUEST_STATUSES = [
  'raised',
  'searching',
  'partially_matched',
  'fully_matched',
  'cross_matching',
  'cross_match_done',
  'approved',
  'dispatched',
  'partially_delivered',
  'delivered',
  'transfused',
  'cancelled',
  'expired',
  'rejected',
];

export const URGENCY_LEVELS = [
  'routine',
  'urgent',
  'emergency',
  'mass_casualty',
];

export const CLINICAL_INDICATIONS = [
  'Elective Surgery', 'Emergency Surgery', 'Trauma', 'Obstetric Hemorrhage',
  'Gastrointestinal Bleed', 'Anemia (Chronic)', 'Anemia (Acute)',
  'Thalassemia', 'Sickle Cell Disease', 'Hemophilia', 'Thrombocytopenia',
  'Oncology / Chemotherapy', 'Organ Transplant', 'Neonatal Jaundice',
  'Dengue', 'Malaria', 'Liver Disease', 'Renal Disease', 'Cardiac Surgery',
  'Bone Marrow Transplant', 'Other',
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const allocationSchema = new Schema(
  {
    bloodBank:     { type: Schema.Types.ObjectId, ref: 'BloodBank',     required: true },
    bloodBankName: { type: String },
    inventory:     { type: Schema.Types.ObjectId, ref: 'BloodInventory', required: true },

    unitsAllocated: { type: Number, required: true, min: 1 },
    bagNumbers:     [{ type: String, uppercase: true, trim: true }],

    crossMatchRequired:     { type: Boolean, default: true },
    crossMatchSampleSentAt: { type: Date },
    crossMatchResult: {
      type:    String,
      enum:    ['Compatible', 'Incompatible', 'Pending', 'Waived', null],
      default: null,
    },
    crossMatchResultAt:    { type: Date },
    crossMatchPerformedBy: { type: String },

    approvedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:    { type: Date },
    approvalNotes: { type: String },

    processingFeePerUnit: { type: Number, default: 0, min: 0 },
    crossMatchFee:        { type: Number, default: 0, min: 0 },
    deliveryFee:          { type: Number, default: 0, min: 0 },
    totalFee:             { type: Number, default: 0, min: 0 },

    ride: { type: Schema.Types.ObjectId, ref: 'Ride', default: null },

    dispatchedAt:  { type: Date },
    dispatchedBy:  { type: String },
    deliveryMethod: {
      type:    String,
      enum:    ['platform_ride', 'bank_vehicle', 'hospital_pickup', 'ambulance', 'courier'],
      default: 'platform_ride',
    },
    deliveredAt:        { type: Date },
    deliveredTo:        { type: String },
    deliveryReceiptUrl: { type: String },

    status: {
      type:    String,
      enum:    ['reserved', 'cross_matching', 'approved', 'dispatched', 'delivered', 'transfused', 'cancelled', 'rejected'],
      default: 'reserved',
    },
    rejectionReason:    { type: String },
    cancellationReason: { type: String },
  },
  { _id: true, timestamps: true }
);

const requestPatientSchema = new Schema(
  {
    name:          { type: String, required: true, trim: true },
    age:           { type: Number, min: 0, max: 150 },
    gender:        { type: String, enum: ['Male', 'Female', 'Other'] },
    bloodGroup:    { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    rhType:        { type: String, enum: ['Positive', 'Negative'] },
    wardBed:       { type: String, trim: true },
    uhid:          { type: String, trim: true },
    ipNumber:      { type: String, trim: true },
    diagnosisNotes:{ type: String, trim: true },
  },
  { _id: false }
);

const searchAttemptSchema = new Schema(
  {
    searchedAt:       { type: Date, default: Date.now },
    banksSearched:    { type: Number },
    banksWithStock:   { type: Number },
    maxRadiusKm:      { type: Number },
    unitsFoundTotal:  { type: Number },
    searchDurationMs: { type: Number },
    notes:            { type: String },
  },
  { _id: false }
);

const statusLogSchema = new Schema(
  {
    fromStatus: { type: String },
    toStatus:   { type: String, required: true },
    changedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    actor:      { type: String, enum: ['customer', 'hospital', 'blood_bank', 'admin', 'system'] },
    reason:     { type: String },
    changedAt:  { type: Date, default: Date.now },
  },
  { _id: true }
);

const requestCancellationSchema = new Schema(
  {
    cancelledBy:       { type: String, enum: ['customer', 'hospital', 'admin', 'system'] },
    cancelledByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason:            { type: String, trim: true },
    refundEligible:    { type: Boolean, default: false },
    cancelledAt:       { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bloodRequestSchema = new Schema(
  {
    requestCode: {
      type: String, unique: true, uppercase: true, trim: true, index: true,
    },
    requestType: {
      type: String, required: true, enum: REQUEST_TYPES, index: true,
    },

    requestedBy: {
      type: Schema.Types.ObjectId, ref: 'User', required: true, index: true,
    },
    hospital: {
      type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true,
    },
    hospitalName: { type: String },

    patient: { type: requestPatientSchema, required: true },

    prescribingDoctor:     { type: Schema.Types.ObjectId, ref: 'DoctorProfile', default: null },
    prescribingDoctorName: { type: String },

    // ── Prescription Upload ───────────────────────────────────────────────────
    // Required for: patient_direct (non-emergency) and hospital_internal requests.
    // Waived for: urgency === 'emergency' | 'mass_casualty', or requestType === 'emergency'.
    // Verified at: pre-validate hook below.
    prescriptionUrl: {
      type:    String,
      trim:    true,
      default: null,
    },
    prescriptionVerified:   { type: Boolean, default: false },
    prescriptionVerifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    prescriptionVerifiedAt: { type: Date, default: null },
    prescriptionWaived:     { type: Boolean, default: false },
    prescriptionWaivedReason: { type: String, default: null },

    bloodGroup: {
      type: String, required: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      index: true,
    },
    rhType:    { type: String, enum: ['Positive', 'Negative'] },
    component: {
      type: String, required: true,
      enum: [
        'Whole Blood', 'PRBC', 'FFP', 'Platelets', 'Cryoprecipitate',
        'Plasma', 'Single Donor Platelets', 'Leukoreduced PRBC',
        'Irradiated PRBC', 'Washed PRBC',
      ],
      index: true,
    },

    unitsRequired:  { type: Number, required: true, min: 1 },
    fulfilledUnits: { type: Number, default: 0, min: 0 },

    crossMatchRequired:     { type: Boolean, default: true },
    crossMatchSampleSentAt: { type: Date },

    clinicalIndication: { type: String, enum: CLINICAL_INDICATIONS },
    clinicalNotes:      { type: String, trim: true },

    urgency: {
      type: String, enum: URGENCY_LEVELS, required: true, default: 'routine', index: true,
    },
    requiredBy: { type: Date, index: true },

    deliveryAddress: {
      line1:   { type: String, trim: true },
      city:    { type: String, trim: true },
      state:   { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    deliveryLocation: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },

    allocations:    { type: [allocationSchema],    default: [] },
    searchAttempts: { type: [searchAttemptSchema], default: [] },

    searchRadiusKm: { type: Number, default: 5 },
    lastSearchAt:   { type: Date },

    fareBreakdown: {
      processingFees: { type: Number, default: 0, min: 0 },
      crossMatchFees: { type: Number, default: 0, min: 0 },
      deliveryFees:   { type: Number, default: 0, min: 0 },
      platformFee:    { type: Number, default: 0, min: 0 },
      taxes:          { type: Number, default: 0, min: 0 },
      discount:       { type: Number, default: 0, min: 0 },
      totalAmount:    { type: Number, default: 0, min: 0 },
      currency:       { type: String, default: 'INR' },
    },

    paymentStatus: {
      type: String, enum: ['unpaid', 'pending', 'paid', 'waived', 'refunded'], default: 'unpaid',
    },
    isWaived:     { type: Boolean, default: false },
    waivedReason: { type: String },

    status: {
      type: String, enum: REQUEST_STATUSES, default: 'raised', index: true,
    },
    statusLog:    { type: [statusLogSchema], default: [] },
    cancellation: { type: requestCancellationSchema, default: null },

    rejectionReason: { type: String },
    rejectedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:      { type: Date },

    raisedAt:         { type: Date, default: Date.now },
    firstMatchAt:     { type: Date },
    fullyMatchedAt:   { type: Date },
    approvedAt:       { type: Date },
    firstDispatchAt:  { type: Date },
    fullyDeliveredAt: { type: Date },
    transfusedAt:     { type: Date },
    completedAt:      { type: Date },

    slaBreached:     { type: Boolean, default: false, index: true },
    slaBreachedAt:   { type: Date },
    escalationLevel: { type: Number, default: 0, min: 0, max: 3 },

    transfusionOutcome: {
      type:    String,
      enum:    ['Successful', 'Adverse_Reaction', 'Patient_Expired', 'Not_Required', null],
      default: null,
    },
    transfusionNotes:      { type: String },
    transfusedBy:          { type: Schema.Types.ObjectId, ref: 'DoctorProfile' },
    adverseReactionReport: { type: String },

    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    internalNotes:   { type: String, select: false },
    isTestRequest:   { type: Boolean, default: false },
    createdBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

bloodRequestSchema.virtual('isFullyFulfilled').get(function () {
  return this.fulfilledUnits >= this.unitsRequired;
});

bloodRequestSchema.virtual('unitsStillNeeded').get(function () {
  return Math.max(0, this.unitsRequired - this.fulfilledUnits);
});

bloodRequestSchema.virtual('fulfillmentPercent').get(function () {
  if (!this.unitsRequired) return 0;
  return +((this.fulfilledUnits / this.unitsRequired) * 100).toFixed(1);
});

bloodRequestSchema.virtual('isActive').get(function () {
  return ['raised', 'searching', 'partially_matched', 'fully_matched',
          'cross_matching', 'cross_match_done', 'approved',
          'dispatched', 'partially_delivered'].includes(this.status);
});

bloodRequestSchema.virtual('isEmergency').get(function () {
  return this.urgency === 'emergency' || this.urgency === 'mass_casualty'
    || this.requestType === 'emergency';
});

bloodRequestSchema.virtual('minutesUntilDeadline').get(function () {
  if (!this.requiredBy) return null;
  return Math.round((new Date(this.requiredBy) - new Date()) / 60000);
});

bloodRequestSchema.virtual('isOverdue').get(function () {
  if (!this.requiredBy) return false;
  return new Date() > new Date(this.requiredBy) && this.isActive;
});

bloodRequestSchema.virtual('totalAllocatedBags').get(function () {
  return this.allocations?.reduce((sum, a) => sum + (a.bagNumbers?.length ?? 0), 0) ?? 0;
});

// ── Helper: is prescription required? ────────────────────────────────────────
function prescriptionRequired(doc) {
  if (doc.urgency === 'emergency' || doc.urgency === 'mass_casualty') return false;
  if (doc.requestType === 'emergency') return false;
  if (doc.requestType === 'voluntary_camp') return false;
  return ['patient_direct', 'hospital_internal'].includes(doc.requestType);
}

// ── Pre-validate ──────────────────────────────────────────────────────────────

bloodRequestSchema.pre('validate', function () {
  if (this.requestType === 'hospital_internal' && !this.hospital) {
    throw new Error('hospital_internal requests require a hospital reference');
  }

  if (this.fulfilledUnits > this.unitsRequired) {
    throw new Error('fulfilledUnits cannot exceed unitsRequired');
  }

  if (this.isNew && this.urgency === 'emergency' && !this.requiredBy) {
    this.requiredBy = new Date(Date.now() + 2 * 60 * 60 * 1000);
  }
  if (this.isNew && this.urgency === 'urgent' && !this.requiredBy) {
    this.requiredBy = new Date(Date.now() + 6 * 60 * 60 * 1000);
  }

  if (this.isNew && prescriptionRequired(this)) {
    if (!this.prescriptionUrl || !this.prescriptionUrl.trim()) {
      throw new Error(
        'prescriptionUrl is required for patient_direct and hospital_internal requests. ' +
        'Upload a valid prescription document before submitting.'
      );
    }
  }

  if (this.prescriptionWaived && !this.prescriptionWaivedReason) {
    throw new Error('prescriptionWaivedReason is required when prescriptionWaived is true');
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

bloodRequestSchema.pre('save', async function () {
  if (this.isNew && !this.requestCode) {
    const { customAlphabet } = await import('nanoid');
    const gen = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);
    let code, exists;
    do {
      code   = `BR-${gen()}`;
      exists = await mongoose.model('BloodRequest').exists({ requestCode: code });
    } while (exists);
    this.requestCode = code;
  }

  if (this.isModified('status') && !this.isNew) {
    this.statusLog.push({
      fromStatus: this._previousStatus || null,
      toStatus:   this.status,
      changedBy:  this.updatedBy || null,
    });
  }
  this._previousStatus = this.status;

  const now = new Date();
  if (this.isModified('status')) {
    switch (this.status) {
      case 'partially_matched':
        if (!this.firstMatchAt)  this.firstMatchAt = now;
        break;
      case 'fully_matched':
        if (!this.firstMatchAt)   this.firstMatchAt   = now;
        if (!this.fullyMatchedAt) this.fullyMatchedAt = now;
        break;
      case 'approved':
        if (!this.approvedAt) this.approvedAt = now;
        break;
      case 'dispatched':
        if (!this.firstDispatchAt) this.firstDispatchAt = now;
        break;
      case 'delivered':
        if (!this.fullyDeliveredAt) this.fullyDeliveredAt = now;
        break;
      case 'transfused':
        if (!this.transfusedAt) this.transfusedAt = now;
        break;
      case 'cancelled':
      case 'expired':
      case 'rejected':
        if (!this.completedAt) this.completedAt = now;
        break;
    }
  }

  if (this.isModified('fulfilledUnits') && this.isActive) {
    if (this.fulfilledUnits >= this.unitsRequired && this.status === 'partially_matched') {
      this.status = 'fully_matched';
      if (!this.fullyMatchedAt) this.fullyMatchedAt = new Date();
    } else if (this.fulfilledUnits > 0 && this.status === 'searching') {
      this.status = 'partially_matched';
      if (!this.firstMatchAt) this.firstMatchAt = new Date();
    }
  }

  if (this.isModified('allocations')) {
    let processingFees = 0, crossMatchFees = 0, deliveryFees = 0;
    for (const alloc of this.allocations) {
      processingFees += (alloc.processingFeePerUnit ?? 0) * (alloc.unitsAllocated ?? 0);
      crossMatchFees += alloc.crossMatchFee ?? 0;
      deliveryFees   += alloc.deliveryFee   ?? 0;
    }
    const existing   = this.fareBreakdown?.toObject?.() ?? this.fareBreakdown ?? {};
    const platformFee = existing.platformFee ?? 0;
    const discount    = existing.discount    ?? 0;
    const taxes       = +((processingFees + crossMatchFees + deliveryFees) * 0.05).toFixed(2);

    this.fareBreakdown = {
      processingFees,
      crossMatchFees,
      deliveryFees,
      platformFee,
      taxes,
      discount,
      totalAmount: Math.max(0, processingFees + crossMatchFees + deliveryFees + platformFee + taxes - discount),
      currency:    'INR',
    };
  }
});

// ── Statics ───────────────────────────────────────────────────────────────────

bloodRequestSchema.statics.searchAndAllocate = async function (requestId) {
  const BloodInventory = mongoose.model('BloodInventory');

  const request = await this.findById(requestId)
    .populate('hospital', 'location address');

  if (!request) throw new Error('BloodRequest not found');
  if (!['raised', 'searching', 'partially_matched'].includes(request.status)) {
    throw new Error(`Cannot search for status: ${request.status}`);
  }

  const stillNeeded = request.unitsRequired - request.fulfilledUnits;
  if (stillNeeded <= 0) return { fulfilledUnits: request.unitsRequired, stillNeeded: 0 };

  const [lng, lat] = request.hospital?.location?.coordinates
    ?? request.deliveryLocation?.coordinates
    ?? [80.648, 16.506];

  const candidates = await BloodInventory.findAvailableNearby({
    bloodGroup:        request.bloodGroup,
    component:         request.component,
    unitsNeeded:       1,
    lng, lat,
    maxDistanceMeters: request.searchRadiusKm * 1000,
  });

  let totalAllocated = 0;
  const newAllocations = [];

  for (const inv of candidates) {
    if (totalAllocated >= stillNeeded) break;

    const unitsToReserve = Math.min(inv.availableUnits, stillNeeded - totalAllocated);
    const reserved = await BloodInventory.reserveUnits(inv._id, requestId, unitsToReserve);
    if (!reserved) continue;

    const bankRef  = inv.bloodBank?._id ?? inv.bloodBank;
    const bankName = inv.bloodBank?.name ?? '';

    const bagNums = reserved.units
      .filter(u => u.status === 'reserved' && String(u.reservedFor) === String(requestId))
      .map(u => u.bagNumber);

    newAllocations.push({
      bloodBank:            bankRef,
      bloodBankName:        bankName,
      inventory:            inv._id,
      unitsAllocated:       unitsToReserve,
      bagNumbers:           bagNums,
      processingFeePerUnit: inv.processingFeePerUnit ?? 0,
      crossMatchRequired:   request.crossMatchRequired,
      status:               'reserved',
    });

    totalAllocated += unitsToReserve;
  }

  const updated = await this.findByIdAndUpdate(
    requestId,
    {
      $push: { allocations: { $each: newAllocations } },
      $inc:  { fulfilledUnits: totalAllocated },
      $set:  { lastSearchAt: new Date() },
    },
    { new: true }
  );

  return {
    fulfilledUnits: updated.fulfilledUnits,
    stillNeeded:    Math.max(0, request.unitsRequired - updated.fulfilledUnits),
    allocations:    newAllocations,
  };
};

// ── Indexes ───────────────────────────────────────────────────────────────────

bloodRequestSchema.index({ bloodGroup: 1, component: 1, status: 1 });
bloodRequestSchema.index({ hospital: 1, status: 1 });
bloodRequestSchema.index({ hospital: 1, createdAt: -1 });
bloodRequestSchema.index({ requestedBy: 1, status: 1 });
bloodRequestSchema.index({ urgency: 1, status: 1 });
bloodRequestSchema.index({ requiredBy: 1, status: 1 });
bloodRequestSchema.index({ slaBreached: 1 });
bloodRequestSchema.index({ status: 1, createdAt: -1 });
bloodRequestSchema.index({ 'allocations.bloodBank': 1 });
bloodRequestSchema.index({ 'allocations.ride': 1 }, { sparse: true });
bloodRequestSchema.index({ raisedAt: -1 });
bloodRequestSchema.index({ deliveryLocation: '2dsphere' }, { sparse: true });
bloodRequestSchema.index({ prescriptionVerified: 1 }, { sparse: true });

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);
export default BloodRequest;