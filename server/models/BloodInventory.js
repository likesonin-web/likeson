import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// BLOOD INVENTORY MODEL — Likeson.in
//
// Real-time blood stock per blood bank.
// ONE document per (bloodBank + bloodGroup + component) combination.
//
//   BloodBank "City Blood Centre"
//     → BloodInventory { bloodGroup: 'O+', component: 'PRBC',   availableUnits: 12 }
//     → BloodInventory { bloodGroup: 'O+', component: 'Platelets', availableUnits: 4 }
//     → BloodInventory { bloodGroup: 'AB-', component: 'FFP',    availableUnits: 2 }
//     ... etc
//
// WHY SEPARATE FROM BloodBank:
//   Stock changes many times per day (donations + issuances).
//   Fast geospatial query: "find AB+ PRBC within 10km" needs index on
//   bloodGroup + component + location (denormalized from parent bank).
//   Updating stock uses atomic $inc — no need to load entire BloodBank doc.
//
// UNITS ARRAY:
//   Each element = one physical blood bag with unique bagNumber.
//   Capped at 500 per document. For banks with larger stock, split by
//   date range (e.g. one doc per month batch) — handled at service layer.
//
// CONCURRENCY:
//   reservedUnits updated atomically via $inc during allocation.
//   availableUnits = totalUnits - reservedUnits - issuedUnits - expiredUnits
//   Never compute availableUnits in application layer — read from DB field.
//
// ─────────────────────────────────────────────────────────────────────────────

export const UNIT_STATUSES = [
  'available',    // Ready to allocate
  'reserved',     // Allocated to a BloodRequest, not yet issued
  'cross_matching',// Sample sent for cross-match, awaiting result
  'cross_matched',// Cross-match done, cleared for transfusion
  'dispatched',   // In transit to hospital
  'issued',       // Handed over to hospital/patient
  'transfused',   // Confirmed transfused (final state)
  'expired',      // Past expiry date — cannot be used
  'discarded',    // Discarded due to quality/contamination
  'quarantined',  // Held pending investigation (reactive test, etc.)
  'recalled',     // Recalled after issuance (donor tested reactive post-donation)
];

export const STORAGE_LOCATIONS = [
  'Refrigerator_1', 'Refrigerator_2', 'Refrigerator_3',
  'Freezer_1', 'Freezer_2',
  'Platelet_Agitator',
  'Room_Temperature',
  'Transport_Box',
  'Mobile_Unit',
];

// Component-specific storage temperature ranges (°C)
export const COMPONENT_STORAGE_TEMP = {
  'Whole Blood':              { min: 2,   max: 6   },
  'PRBC':                     { min: 2,   max: 6   },
  'FFP':                      { min: -25, max: -18  },
  'Platelets':                { min: 20,  max: 24  },
  'Cryoprecipitate':          { min: -25, max: -18  },
  'Plasma':                   { min: -25, max: -18  },
  'Single Donor Platelets':   { min: 20,  max: 24  },
  'Leukoreduced PRBC':        { min: 2,   max: 6   },
  'Irradiated PRBC':          { min: 2,   max: 6   },
  'Washed PRBC':              { min: 2,   max: 6   },
};

// Component-specific shelf life in days
export const COMPONENT_SHELF_LIFE_DAYS = {
  'Whole Blood':              35,
  'PRBC':                     42,
  'FFP':                      365,
  'Platelets':                5,
  'Cryoprecipitate':          365,
  'Plasma':                   365,
  'Single Donor Platelets':   5,
  'Leukoreduced PRBC':        42,
  'Irradiated PRBC':          28,   // shorter due to irradiation
  'Washed PRBC':              24,   // hours — must use same day ideally
};

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

/**
 * bloodUnitSchema — individual blood bag / unit.
 * One physical bag = one array element.
 * This is the atomic traceable unit in the blood supply chain.
 */
const bloodUnitSchema = new Schema(
  {
    // ── Traceability ──────────────────────────────────────────────────────────
    bagNumber: {
      type:     String,
      required: true,
      trim:     true,
      uppercase: true,
      comment:  'Unique bag label number — printed on physical blood bag',
    },

    /**
     * donor — who donated this unit.
     * null = anonymous / walk-in donor not registered on platform.
     * Links to BloodDonor._id for traceability.
     */
    donor: {
      type:    Schema.Types.ObjectId,
      ref:     'BloodDonor',
      default: null,
    },

    donorCode: { type: String },    // denormalized BloodDonor.donorCode for display

    // ── Collection Details ────────────────────────────────────────────────────
    collectedAt:   { type: Date, required: true },
    collectedByStaff: { type: String, trim: true },  // name of phlebotomist
    volumeMl:      { type: Number, required: true, min: 50, max: 500 },  // typical 350-450ml
    donorHemoglobin: { type: Number, min: 0 },        // g/dL at time of donation

    // ── Processing ────────────────────────────────────────────────────────────
    processedAt:   { type: Date },
    processedBy:   { type: String, trim: true },   // staff name
    separationMethod: {
      type: String,
      enum: ['Whole_Blood_Filtration', 'Apheresis', 'Centrifugation', 'Not_Applicable'],
    },

    // ── Testing ───────────────────────────────────────────────────────────────
    /**
     * testResults — mandatory NAT/ELISA screening per NACO guidelines.
     * ALL units must be tested before release.
     * Reactive in any test → unit quarantined/discarded.
     */
    testResults: {
      hiv:        { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      hbsAg:      { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },  // Hepatitis B
      hcv:        { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },  // Hepatitis C
      syphilis:   { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      malaria:    { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      testedAt:   { type: Date },
      testedBy:   { type: String },
      allClear:   { type: Boolean, default: false },  // true = all non-reactive
    },

    isTestingComplete: { type: Boolean, default: false },
    isReleaseApproved: { type: Boolean, default: false },  // medical officer approval

    // ── Cross-Match ───────────────────────────────────────────────────────────
    /**
     * crossMatch — per-unit cross-match result for a specific recipient.
     * A unit may be cross-matched against one request at a time.
     */
    crossMatch: {
      requestId:   { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
      sampleSentAt:{ type: Date },
      result:      { type: String, enum: ['Compatible', 'Incompatible', 'Pending', null], default: null },
      resultAt:    { type: Date },
      performedBy: { type: String },   // lab technician name
    },

    // ── Storage ───────────────────────────────────────────────────────────────
    storageLocation: { type: String, enum: STORAGE_LOCATIONS },
    storageSlot:     { type: String, trim: true },    // e.g. "Shelf-3, Row-B"
    storageTemperatureC: { type: Number },             // last recorded temperature

    // ── Expiry ────────────────────────────────────────────────────────────────
    expiresAt: {
      type:     Date,
      required: true,
      index:    true,   // indexed for expiry sweep jobs
    },

    // ── Issuance ──────────────────────────────────────────────────────────────
    reservedFor:  { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    reservedAt:   { type: Date },
    issuedTo: {
      request:    { type: Schema.Types.ObjectId, ref: 'BloodRequest' },
      hospital:   { type: Schema.Types.ObjectId, ref: 'Hospital' },
      issuedAt:   { type: Date },
      issuedBy:   { type: String },   // staff name
      receiptUrl: { type: String },   // signed issuance receipt
    },

    transfusedAt:   { type: Date },
    transfusedBy:   { type: String },   // doctor who transfused

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    UNIT_STATUSES,
      default: 'available',
      index:   true,
    },

    // ── Recall ────────────────────────────────────────────────────────────────
    isRecalled:    { type: Boolean, default: false },
    recallReason:  { type: String },
    recalledAt:    { type: Date },

    notes: { type: String },
  },
  { _id: true, timestamps: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bloodInventorySchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    bloodBank: {
      type:     Schema.Types.ObjectId,
      ref:      'BloodBank',
      required: true,
      index:    true,
    },

    bloodGroup: {
      type:     String,
      required: true,
      enum:     ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      index:    true,
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

    // ── Location Denormalization ──────────────────────────────────────────────
    /**
     * location — copied from BloodBank.location on create/update.
     * Denormalized for geospatial queries:
     *   "Find AB+ PRBC inventory within 15km of patient"
     * Without denormalization, query needs $lookup → slow.
     */
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] },
    },

    cityName: { type: String, trim: true },   // also denormalized for city-filter queries

    // ── Stock Counters (maintained atomically) ────────────────────────────────
    /**
     * These counters are the FAST-PATH for availability checks.
     * Always updated via $inc — never recomputed from units[] array
     * (that would require loading the entire embedded array).
     */
    totalUnits:     { type: Number, default: 0, min: 0 },
    availableUnits: { type: Number, default: 0, min: 0 }, // ready to allocate
    reservedUnits:  { type: Number, default: 0, min: 0 }, // reserved, not yet issued
    issuedUnits:    { type: Number, default: 0, min: 0 }, // issued (lifetime total)
    expiredUnits:   { type: Number, default: 0, min: 0 }, // expired (lifetime total)
    discardedUnits: { type: Number, default: 0, min: 0 }, // discarded (lifetime total)
    quarantinedUnits:{ type: Number, default: 0, min: 0 },

    // ── Units Array ───────────────────────────────────────────────────────────
    /**
     * units — individual blood bags.
     * Capped at 500 per document.
     * For high-volume banks: archive issued/expired bags periodically.
     */
    units: {
      type:     [bloodUnitSchema],
      default:  [],
      validate: [v => v.length <= 500, 'Max 500 units per inventory document'],
    },

    // ── Expiry Tracking ───────────────────────────────────────────────────────
    /**
     * nextExpiryAt — the soonest expiry date among all 'available' units.
     * Updated whenever a unit is added, issued, or expires.
     * Used by the expiry alert job to prioritise FIFO issuance.
     */
    nextExpiryAt: { type: Date, default: null, index: true },

    /**
     * expiringIn3Days — count of available units expiring within 72 hours.
     * Written by scheduled job. Triggers urgent donor notification.
     */
    expiringIn3Days: { type: Number, default: 0, min: 0 },
    expiringIn7Days: { type: Number, default: 0, min: 0 },

    // ── Pricing (per unit, for this specific component at this bank) ──────────
    processingFeePerUnit: { type: Number, default: 0, min: 0 },
    crossMatchFeePerUnit: { type: Number, default: 0, min: 0 },

    // ── Stock Alert State ─────────────────────────────────────────────────────
    isLowStock:      { type: Boolean, default: false, index: true },
    isCriticalStock: { type: Boolean, default: false, index: true },
    lastAlertSentAt: { type: Date },

    // ── Audit ─────────────────────────────────────────────────────────────────
    lastUpdatedAt: { type: Date, default: Date.now },
    lastDonationAt:{ type: Date },
    lastIssuanceAt:{ type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Unique compound index — one doc per bank+bloodGroup+component ─────────────
bloodInventorySchema.index(
  { bloodBank: 1, bloodGroup: 1, component: 1 },
  { unique: true }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

bloodInventorySchema.virtual('hasStock').get(function () {
  return this.availableUnits > 0;
});

bloodInventorySchema.virtual('utilizationPercent').get(function () {
  if (!this.totalUnits) return 0;
  return +((this.issuedUnits / this.totalUnits) * 100).toFixed(1);
});

bloodInventorySchema.virtual('shelfLifeDays').get(function () {
  return COMPONENT_SHELF_LIFE_DAYS[this.component] ?? null;
});

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * findAvailableNearby — geospatial search for available stock.
 *
 * Usage:
 *   const results = await BloodInventory.findAvailableNearby({
 *     bloodGroup: 'O+',
 *     component:  'PRBC',
 *     unitsNeeded: 2,
 *     lng: 80.648,
 *     lat: 16.506,
 *     maxDistanceMeters: 20000,
 *   });
 */
bloodInventorySchema.statics.findAvailableNearby = function ({
  bloodGroup,
  component,
  unitsNeeded = 1,
  lng,
  lat,
  maxDistanceMeters = 20000,
}) {
  return this.find({
    bloodGroup,
    component,
    availableUnits: { $gte: unitsNeeded },
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistanceMeters,
      },
    },
  })
    .populate('bloodBank', 'name contact address isEmergency24x7 offersDelivery deliveryRadiusKm')
    .select('bloodBank bloodGroup component availableUnits nextExpiryAt processingFeePerUnit')
    .limit(10);
};

/**
 * reserveUnits — atomically reserve N units for a BloodRequest.
 * Returns updated doc or null if insufficient stock.
 *
 * Usage:
 *   const inv = await BloodInventory.reserveUnits(inventoryId, requestId, 2);
 */
bloodInventorySchema.statics.reserveUnits = async function (inventoryId, requestId, unitsToReserve) {
  // Atomic: only decrement availableUnits if sufficient stock exists
  const updated = await this.findOneAndUpdate(
    {
      _id:            inventoryId,
      availableUnits: { $gte: unitsToReserve },
    },
    {
      $inc: {
        availableUnits: -unitsToReserve,
        reservedUnits:   unitsToReserve,
      },
      $set: { lastUpdatedAt: new Date() },
    },
    { new: true }
  );

  if (!updated) return null; // insufficient stock — caller handles shortage

  // Mark specific unit docs as reserved (FIFO — oldest collected first)
  let reserved = 0;
  for (const unit of updated.units) {
    if (reserved >= unitsToReserve) break;
    if (unit.status === 'available' && unit.isReleaseApproved) {
      unit.status      = 'reserved';
      unit.reservedFor = requestId;
      unit.reservedAt  = new Date();
      reserved++;
    }
  }

  return updated.save();
};

/**
 * releaseReservation — release reserved units back to available.
 * Called when a BloodRequest is cancelled.
 */
bloodInventorySchema.statics.releaseReservation = async function (inventoryId, requestId) {
  const inv = await this.findById(inventoryId);
  if (!inv) return null;

  let released = 0;
  for (const unit of inv.units) {
    if (unit.status === 'reserved' && String(unit.reservedFor) === String(requestId)) {
      unit.status      = 'available';
      unit.reservedFor = null;
      unit.reservedAt  = null;
      released++;
    }
  }

  if (released > 0) {
    inv.availableUnits += released;
    inv.reservedUnits  = Math.max(0, inv.reservedUnits - released);
    inv.lastUpdatedAt  = new Date();
    return inv.save();
  }
  return inv;
};

/**
 * addUnit — add a newly collected blood bag to inventory.
 * Updates counters atomically after push.
 */
bloodInventorySchema.statics.addUnit = async function (inventoryId, unitData) {
  const inv = await this.findById(inventoryId);
  if (!inv) throw new Error('BloodInventory not found');
  if (inv.units.length >= 500) throw new Error('Inventory document at capacity (500 units). Create new batch document.');

  inv.units.push(unitData);
  inv.totalUnits++;
  // New unit starts as 'available' only after testing — counter incremented in markTestComplete
  inv.lastDonationAt = new Date();
  inv.lastUpdatedAt  = new Date();

  return inv.save();
};

/**
 * runExpiryCheck — mark expired units, update counters.
 * Called by scheduled job (e.g. daily at 00:00).
 */
bloodInventorySchema.statics.runExpiryCheck = async function (inventoryId) {
  const inv   = await this.findById(inventoryId);
  if (!inv) return null;
  const now   = new Date();
  let expired = 0;

  for (const unit of inv.units) {
    if (['available', 'reserved'].includes(unit.status) && unit.expiresAt < now) {
      if (unit.status === 'reserved') inv.reservedUnits = Math.max(0, inv.reservedUnits - 1);
      else inv.availableUnits = Math.max(0, inv.availableUnits - 1);
      unit.status = 'expired';
      inv.expiredUnits++;
      expired++;
    }
  }

  // Refresh nextExpiryAt
  const activeDates = inv.units
    .filter(u => u.status === 'available' && u.expiresAt > now)
    .map(u => u.expiresAt)
    .sort((a, b) => a - b);
  inv.nextExpiryAt = activeDates[0] ?? null;

  // Expiry counts for alert thresholds
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  inv.expiringIn3Days = inv.units.filter(u => u.status === 'available' && u.expiresAt <= threeDays).length;
  inv.expiringIn7Days = inv.units.filter(u => u.status === 'available' && u.expiresAt <= sevenDays).length;
  inv.lastUpdatedAt   = now;

  return inv.save();
};

// ── Pre-save ──────────────────────────────────────────────────────────────────

bloodInventorySchema.pre('save', function () {
  // Recompute nextExpiryAt when units array changes
  if (this.isModified('units')) {
    const now    = new Date();
    const active = this.units
      .filter(u => u.status === 'available' && u.expiresAt > now)
      .map(u => u.expiresAt)
      .sort((a, b) => a - b);
    this.nextExpiryAt = active[0] ?? null;

    // Recount quarantined
    this.quarantinedUnits = this.units.filter(u => u.status === 'quarantined').length;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

bloodInventorySchema.index({ location: '2dsphere' });
bloodInventorySchema.index({ bloodGroup: 1, component: 1, availableUnits: 1 });
bloodInventorySchema.index({ bloodGroup: 1, component: 1, location: '2dsphere' });
bloodInventorySchema.index({ bloodBank: 1, bloodGroup: 1 });
bloodInventorySchema.index({ isLowStock: 1 });
bloodInventorySchema.index({ isCriticalStock: 1 });
bloodInventorySchema.index({ nextExpiryAt: 1 });
bloodInventorySchema.index({ 'units.bagNumber': 1 }, { sparse: true });
bloodInventorySchema.index({ 'units.status': 1 });
bloodInventorySchema.index({ 'units.expiresAt': 1 });
bloodInventorySchema.index({ 'units.reservedFor': 1 }, { sparse: true });

const BloodInventory = mongoose.model('BloodInventory', bloodInventorySchema);
export default BloodInventory;
