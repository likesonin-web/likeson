import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// BLOOD REQUEST MODEL — Likeson.in
//
// Core operational model. A BloodRequest is raised whenever blood components
// are needed for a patient. It drives the entire fulfillment workflow:
//
//   RAISED → SEARCHING → MATCHED → CROSS_MATCHING → APPROVED
//          → DISPATCHED → DELIVERED → TRANSFUSED
//
// REQUEST TYPES:
//   patient_direct     → Patient/family requests via app (links to Booking)
//   hospital_internal  → Hospital raises internally (no patient Booking)
//   emergency          → Emergency request — bypasses normal approval flow
//   voluntary_camp     → Blood donation camp request (bank collecting stock)
//
// MULTI-BANK FULFILLMENT:
//   A single request may be fulfilled by MULTIPLE blood banks if one bank
//   has insufficient stock (shortage scenario).
//   allocations[] array supports partial + multi-source fulfillment.
//
// PARTIAL FULFILLMENT:
//   fulfilledUnits may be < requiredUnits.
//   Status 'partially_matched' allows requesting hospital to proceed with
//   available units while system continues searching for remainder.
//
// LINKS:
//   BloodRequest → Booking (nullable — only when originated from app)
//   BloodRequest → BloodBank (via allocations[])
//   BloodRequest → BloodInventory (specific bags reserved)
//   BloodRequest → Ride (delivery transport per allocation)
//   BloodRequest → Hospital (where transfusion happens)
// ─────────────────────────────────────────────────────────────────────────────

export const REQUEST_TYPES = [
  'patient_direct',
  'hospital_internal',
  'emergency',
  'voluntary_camp',
];

export const REQUEST_STATUSES = [
  'raised',              // Request submitted
  'searching',           // System searching inventory for matching stock
  'partially_matched',   // Some units found, still searching for remainder
  'fully_matched',       // All required units located across banks
  'cross_matching',      // Cross-match samples sent to lab
  'cross_match_done',    // Cross-match completed — all units cleared
  'approved',            // Medical officer approved — ready to dispatch
  'dispatched',          // Blood bags in transit
  'partially_delivered', // Some bags delivered (multi-bank scenario)
  'delivered',           // All bags delivered to hospital
  'transfused',          // Confirmed transfused into patient (final success)
  'cancelled',           // Cancelled before dispatch
  'expired',             // Required-by deadline passed unfulfilled
  'rejected',            // Rejected by blood bank (insufficient justification)
];

export const URGENCY_LEVELS = [
  'routine',       // Elective surgery — 24-72 hours acceptable
  'urgent',        // Needed within 6-12 hours
  'emergency',     // Needed within 1-2 hours
  'mass_casualty', // Disaster scenario — multiple patients simultaneously
];

export const CLINICAL_INDICATIONS = [
  'Elective Surgery',
  'Emergency Surgery',
  'Trauma',
  'Obstetric Hemorrhage',
  'Gastrointestinal Bleed',
  'Anemia (Chronic)',
  'Anemia (Acute)',
  'Thalassemia',
  'Sickle Cell Disease',
  'Hemophilia',
  'Thrombocytopenia',
  'Oncology / Chemotherapy',
  'Organ Transplant',
  'Neonatal Jaundice',
  'Dengue',
  'Malaria',
  'Liver Disease',
  'Renal Disease',
  'Cardiac Surgery',
  'Bone Marrow Transplant',
  'Other',
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

/**
 * allocationSchema — one blood bank's contribution to fulfilling this request.
 * A request may have multiple allocations (multi-bank fulfillment).
 */
const allocationSchema = new Schema(
  {
    // ── Bank & Inventory ──────────────────────────────────────────────────────
    bloodBank: {
      type:     Schema.Types.ObjectId,
      ref:      'BloodBank',
      required: true,
    },
    bloodBankName: { type: String },   // denormalized for display

    inventory: {
      type:     Schema.Types.ObjectId,
      ref:      'BloodInventory',
      required: true,
    },

    // ── Units ─────────────────────────────────────────────────────────────────
    unitsAllocated:  { type: Number, required: true, min: 1 },
    bagNumbers:      [{ type: String, uppercase: true, trim: true }],  // specific bags

    // ── Cross-Match ───────────────────────────────────────────────────────────
    crossMatchRequired:  { type: Boolean, default: true },
    crossMatchSampleSentAt: { type: Date },
    crossMatchResult: {
      type:    String,
      enum:    ['Compatible', 'Incompatible', 'Pending', 'Waived', null],
      default: null,
    },
    crossMatchResultAt:  { type: Date },
    crossMatchPerformedBy: { type: String },

    // ── Approval ──────────────────────────────────────────────────────────────
    approvedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:    { type: Date },
    approvalNotes: { type: String },

    // ── Pricing ───────────────────────────────────────────────────────────────
    processingFeePerUnit: { type: Number, default: 0, min: 0 },
    crossMatchFee:        { type: Number, default: 0, min: 0 },
    deliveryFee:          { type: Number, default: 0, min: 0 },
    totalFee:             { type: Number, default: 0, min: 0 },

    // ── Dispatch & Delivery ───────────────────────────────────────────────────
    /**
     * ride — Ride document for transporting this allocation.
     * Pickup: blood bank address → Dropoff: hospital address.
     * null if hospital self-collects.
     */
    ride: {
      type:    Schema.Types.ObjectId,
      ref:     'Ride',
      default: null,
    },

    dispatchedAt:   { type: Date },
    dispatchedBy:   { type: String },   // staff name at blood bank

    deliveryMethod: {
      type: String,
      enum: ['platform_ride', 'bank_vehicle', 'hospital_pickup', 'ambulance', 'courier'],
      default: 'platform_ride',
    },

    deliveredAt:     { type: Date },
    deliveredTo:     { type: String },    // name of person who received at hospital
    deliveryReceiptUrl: { type: String }, // signed receipt

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['reserved', 'cross_matching', 'approved', 'dispatched', 'delivered', 'transfused', 'cancelled', 'rejected'],
      default: 'reserved',
    },

    rejectionReason: { type: String },
    cancellationReason: { type: String },
  },
  { _id: true, timestamps: true }
);

/**
 * patientInfoSchema — recipient details at request time.
 */
const requestPatientSchema = new Schema(
  {
    name:          { type: String, required: true, trim: true },
    age:           { type: Number, min: 0, max: 150 },
    gender:        { type: String, enum: ['Male', 'Female', 'Other'] },
    bloodGroup:    { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    rhType:        { type: String, enum: ['Positive', 'Negative'] },
    wardBed:       { type: String, trim: true },   // Ward/Bed number at hospital
    uhid:          { type: String, trim: true },   // Universal Hospital ID
    ipNumber:      { type: String, trim: true },   // In-patient number
    diagnosisNotes:{ type: String, trim: true },
  },
  { _id: false }
);

/**
 * searchAttemptSchema — log of each inventory search attempt.
 * Used for analytics and debugging shortage scenarios.
 */
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

/**
 * statusLogSchema — full audit trail of every status change.
 */
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

/**
 * cancellationSchema
 */
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
    // ── Identity ──────────────────────────────────────────────────────────────
    requestCode: {
      type:      String,
      unique:    true,
      uppercase: true,
      trim:      true,
      index:     true,
      comment:   'Format: BR-XXXXXXXX — auto-generated',
    },

    requestType: {
      type:     String,
      required: true,
      enum:     REQUEST_TYPES,
      index:    true,
    },

    // ── Parties ───────────────────────────────────────────────────────────────
    /**
     * requestedBy → User who raised this request.
     * For patient_direct: customer User.
     * For hospital_internal: hospital manager User.
     * For emergency: doctor or hospital manager User.
     */
    requestedBy: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    /**
     * hospital — where the blood will be transfused.
     * Required for all types except voluntary_camp.
     */
    hospital: {
      type:    Schema.Types.ObjectId,
      ref:     'Hospital',
      default: null,
      index:   true,
    },

    hospitalName: { type: String },   // denormalized

    /**
     * booking → Booking._id (bookingType: 'blood_bank').
     * null for hospital_internal and emergency requests.
     */
    booking: {
      type:    Schema.Types.ObjectId,
      ref:     'Booking',
      default: null,
      index:   true,
    },

    // ── Patient Info ──────────────────────────────────────────────────────────
    patient: {
      type:     requestPatientSchema,
      required: true,
    },

    /**
     * prescribingDoctor — doctor who prescribed the transfusion.
     * Required for non-emergency requests.
     */
    prescribingDoctor: {
      type:    Schema.Types.ObjectId,
      ref:     'DoctorProfile',
      default: null,
    },

    prescribingDoctorName: { type: String },  // denormalized
    prescriptionUrl:       { type: String },   // uploaded prescription PDF/image

    // ── Blood Requirement ─────────────────────────────────────────────────────
    bloodGroup: {
      type:     String,
      required: true,
      enum:     ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      index:    true,
    },

    rhType: {
      type:    String,
      enum:    ['Positive', 'Negative'],
    },

    component: {
      type:     String,
      required: true,
      enum:     [
        'Whole Blood', 'PRBC', 'FFP', 'Platelets', 'Cryoprecipitate',
        'Plasma', 'Single Donor Platelets', 'Leukoreduced PRBC',
        'Irradiated PRBC', 'Washed PRBC',
      ],
      index:    true,
    },

    unitsRequired:  { type: Number, required: true, min: 1 },
    fulfilledUnits: { type: Number, default: 0, min: 0 },  // units confirmed allocated

    /**
     * crossMatchRequired — whether cross-match is mandatory for this request.
     * Emergency requests may waive cross-match (type-specific / O- emergency).
     */
    crossMatchRequired:     { type: Boolean, default: true },
    crossMatchSampleSentAt: { type: Date },

    // ── Clinical Details ──────────────────────────────────────────────────────
    clinicalIndication: {
      type: String,
      enum: CLINICAL_INDICATIONS,
    },

    clinicalNotes:   { type: String, trim: true },

    urgency: {
      type:     String,
      enum:     URGENCY_LEVELS,
      required: true,
      default:  'routine',
      index:    true,
    },

    /**
     * requiredBy — deadline. System escalates if not fulfilled before this time.
     * For emergency: typically 1-2 hours from raised time.
     */
    requiredBy: {
      type:  Date,
      index: true,
    },

    // ── Delivery Address ──────────────────────────────────────────────────────
    /**
     * deliveryAddress — where blood should be delivered.
     * Defaults to hospital address if not specified.
     */
    deliveryAddress: {
      line1:    { type: String, trim: true },
      city:     { type: String, trim: true },
      state:    { type: String, trim: true },
      pincode:  { type: String, trim: true },
    },

    deliveryLocation: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },

    // ── Allocations (Multi-Bank Fulfillment) ──────────────────────────────────
    /**
     * allocations — one entry per blood bank contributing units.
     * A request with unitsRequired: 4 may have:
     *   allocation[0]: BloodBank A → 2 units
     *   allocation[1]: BloodBank B → 2 units
     */
    allocations: {
      type:    [allocationSchema],
      default: [],
    },

    // ── Search History ────────────────────────────────────────────────────────
    searchAttempts: {
      type:    [searchAttemptSchema],
      default: [],
    },

    /**
     * searchRadiusKm — current search radius. Expanded incrementally
     * if initial search finds insufficient stock.
     * Start: 5km → 10km → 20km → 50km → citywide.
     */
    searchRadiusKm: { type: Number, default: 5 },

    lastSearchAt: { type: Date },

    // ── Pricing & Payment ─────────────────────────────────────────────────────
    fareBreakdown: {
      processingFees:  { type: Number, default: 0, min: 0 },
      crossMatchFees:  { type: Number, default: 0, min: 0 },
      deliveryFees:    { type: Number, default: 0, min: 0 },
      platformFee:     { type: Number, default: 0, min: 0 },
      taxes:           { type: Number, default: 0, min: 0 },
      discount:        { type: Number, default: 0, min: 0 },
      totalAmount:     { type: Number, default: 0, min: 0 },
      currency:        { type: String, default: 'INR' },
    },

    paymentStatus: {
      type:    String,
      enum:    ['unpaid', 'pending', 'paid', 'waived', 'refunded'],
      default: 'unpaid',
    },

    /**
     * isWaived — for government hospital patients, BPL card holders, emergencies.
     * Processing fees waived but still logged.
     */
    isWaived:      { type: Boolean, default: false },
    waivedReason:  { type: String },

    // ── Status & Lifecycle ────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    REQUEST_STATUSES,
      default: 'raised',
      index:   true,
    },

    statusLog: {
      type:    [statusLogSchema],
      default: [],
    },

    cancellation: {
      type:    requestCancellationSchema,
      default: null,
    },

    rejectionReason:   { type: String },
    rejectedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:        { type: Date },

    // ── Key Timestamps ────────────────────────────────────────────────────────
    raisedAt:          { type: Date, default: Date.now },
    firstMatchAt:      { type: Date },   // when first unit was reserved
    fullyMatchedAt:    { type: Date },   // when all units were reserved
    approvedAt:        { type: Date },   // medical officer approval
    firstDispatchAt:   { type: Date },   // first allocation dispatched
    fullyDeliveredAt:  { type: Date },   // all allocations delivered
    transfusedAt:      { type: Date },   // confirmed transfusion
    completedAt:       { type: Date },

    // ── SLA Tracking ─────────────────────────────────────────────────────────
    /**
     * slaBreached — true if request was not fulfilled before requiredBy deadline.
     * Written by scheduled job. Triggers admin escalation.
     */
    slaBreached:      { type: Boolean, default: false, index: true },
    slaBreachedAt:    { type: Date },
    escalationLevel:  { type: Number, default: 0, min: 0, max: 3 },

    // ── Post-Transfusion ──────────────────────────────────────────────────────
    transfusionOutcome: {
      type: String,
      enum: ['Successful', 'Adverse_Reaction', 'Patient_Expired', 'Not_Required', null],
      default: null,
    },
    transfusionNotes: { type: String },
    transfusedBy:     { type: Schema.Types.ObjectId, ref: 'DoctorProfile' },
    adverseReactionReport: { type: String },   // URL to haemovigilance report

    // ── Internal ──────────────────────────────────────────────────────────────
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
  const diff = new Date(this.requiredBy) - new Date();
  return Math.round(diff / 60000);
});

bloodRequestSchema.virtual('isOverdue').get(function () {
  if (!this.requiredBy) return false;
  return new Date() > new Date(this.requiredBy) && this.isActive;
});

bloodRequestSchema.virtual('totalAllocatedBags').get(function () {
  return this.allocations?.reduce((sum, a) => sum + (a.bagNumbers?.length ?? 0), 0) ?? 0;
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

bloodRequestSchema.pre('validate', function () {
  // hospital required for all non-camp types
  if (this.requestType !== 'voluntary_camp' && !this.hospital) {
    throw new Error(`${this.requestType} requests require a hospital reference`);
  }

  // fulfilledUnits cannot exceed required
  if (this.fulfilledUnits > this.unitsRequired) {
    throw new Error('fulfilledUnits cannot exceed unitsRequired');
  }

  // Emergency requests auto-set requiredBy if not set
  if (this.isNew && this.urgency === 'emergency' && !this.requiredBy) {
    const twoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
    this.requiredBy = twoHours;
  }

  if (this.isNew && this.urgency === 'urgent' && !this.requiredBy) {
    const sixHours = new Date(Date.now() + 6 * 60 * 60 * 1000);
    this.requiredBy = sixHours;
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

bloodRequestSchema.pre('save', async function () {
  // Auto-generate requestCode
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

  // Append status to log on change
  if (this.isModified('status') && !this.isNew) {
    this.statusLog.push({
      fromStatus: this._previousStatus || null,
      toStatus:   this.status,
      changedBy:  this.updatedBy || null,
    });
  }
  this._previousStatus = this.status;

  // Auto-set key timestamps on status transitions
  const now = new Date();
  if (this.isModified('status')) {
    switch (this.status) {
      case 'partially_matched':
        if (!this.firstMatchAt) this.firstMatchAt = now;
        break;
      case 'fully_matched':
        if (!this.firstMatchAt)  this.firstMatchAt  = now;
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

  // Auto-calculate status from fulfilledUnits
  if (this.isModified('fulfilledUnits') && this.isActive) {
    if (this.fulfilledUnits >= this.unitsRequired && this.status === 'partially_matched') {
      this.status = 'fully_matched';
      if (!this.fullyMatchedAt) this.fullyMatchedAt = new Date();
    } else if (this.fulfilledUnits > 0 && this.status === 'searching') {
      this.status = 'partially_matched';
      if (!this.firstMatchAt) this.firstMatchAt = new Date();
    }
  }

  // Recalculate total fare from allocations
  if (this.isModified('allocations')) {
    let processingFees = 0, crossMatchFees = 0, deliveryFees = 0;
    for (const alloc of this.allocations) {
      processingFees += alloc.processingFeePerUnit * alloc.unitsAllocated;
      crossMatchFees += alloc.crossMatchFee ?? 0;
      deliveryFees   += alloc.deliveryFee   ?? 0;
    }
    const platformFee = this.fareBreakdown?.platformFee ?? 0;
    const taxes       = +((processingFees + crossMatchFees + deliveryFees) * 0.05).toFixed(2);
    const discount    = this.fareBreakdown?.discount ?? 0;

    this.fareBreakdown = {
      ...this.fareBreakdown,
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

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * searchAndAllocate — core fulfillment logic.
 * Finds nearest banks with matching stock, reserves units atomically.
 *
 * Usage:
 *   const result = await BloodRequest.searchAndAllocate(requestId);
 *   // Returns { fulfilledUnits, stillNeeded, allocations }
 */
bloodRequestSchema.statics.searchAndAllocate = async function (requestId) {
  const BloodInventory = mongoose.model('BloodInventory');
  const request = await this.findById(requestId)
    .populate('hospital', 'location address')
    .lean();

  if (!request) throw new Error('BloodRequest not found');
  if (!['raised', 'searching', 'partially_matched'].includes(request.status)) {
    throw new Error(`Cannot search for status: ${request.status}`);
  }

  const stillNeeded = request.unitsRequired - request.fulfilledUnits;
  if (stillNeeded <= 0) return { fulfilledUnits: request.unitsRequired, stillNeeded: 0 };

  const [lng, lat] = request.hospital?.location?.coordinates
    ?? request.deliveryLocation?.coordinates
    ?? [80.648, 16.506];

  // Find nearest banks with available stock
  const candidates = await BloodInventory.findAvailableNearby({
    bloodGroup:          request.bloodGroup,
    component:           request.component,
    unitsNeeded:         1,  // find any with at least 1 unit
    lng, lat,
    maxDistanceMeters:   request.searchRadiusKm * 1000,
  });

  let totalAllocated = 0;
  const newAllocations = [];

  for (const inv of candidates) {
    if (totalAllocated >= stillNeeded) break;

    const unitsToReserve = Math.min(inv.availableUnits, stillNeeded - totalAllocated);
    const reserved = await BloodInventory.reserveUnits(inv._id, requestId, unitsToReserve);
    if (!reserved) continue;

    // Collect actual bag numbers that were reserved
    const bagNums = reserved.units
      .filter(u => u.status === 'reserved' && String(u.reservedFor) === String(requestId))
      .map(u => u.bagNumber);

    newAllocations.push({
      bloodBank:    inv.bloodBank._id,
      bloodBankName: inv.bloodBank.name,
      inventory:    inv._id,
      unitsAllocated: unitsToReserve,
      bagNumbers:   bagNums,
      processingFeePerUnit: inv.processingFeePerUnit,
      crossMatchRequired: request.crossMatchRequired,
      status: 'reserved',
    });

    totalAllocated += unitsToReserve;
  }

  // Update request
  const updated = await this.findByIdAndUpdate(
    requestId,
    {
      $push:  { allocations: { $each: newAllocations } },
      $inc:   { fulfilledUnits: totalAllocated },
      $set:   { lastSearchAt: new Date() },
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
bloodRequestSchema.index({ booking: 1 }, { sparse: true });
bloodRequestSchema.index({ urgency: 1, status: 1 });
bloodRequestSchema.index({ requiredBy: 1, status: 1 });
bloodRequestSchema.index({ slaBreached: 1 });
bloodRequestSchema.index({ status: 1, createdAt: -1 });
bloodRequestSchema.index({ 'allocations.bloodBank': 1 });
bloodRequestSchema.index({ 'allocations.ride': 1 }, { sparse: true });
bloodRequestSchema.index({ raisedAt: -1 });
bloodRequestSchema.index({ deliveryLocation: '2dsphere' }, { sparse: true });

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);
export default BloodRequest;
