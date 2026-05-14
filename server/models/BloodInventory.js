import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// BLOOD INVENTORY MODEL — Likeson.in  (fixed)
// ─────────────────────────────────────────────────────────────────────────────

export const UNIT_STATUSES = [
  'available', 'reserved', 'cross_matching', 'cross_matched',
  'dispatched', 'issued', 'transfused', 'expired', 'discarded',
  'quarantined', 'recalled',
];

export const STORAGE_LOCATIONS = [
  'Refrigerator_1', 'Refrigerator_2', 'Refrigerator_3',
  'Freezer_1', 'Freezer_2',
  'Platelet_Agitator', 'Room_Temperature', 'Transport_Box', 'Mobile_Unit',
];

export const COMPONENT_STORAGE_TEMP = {
  'Whole Blood':            { min: 2,   max: 6   },
  'PRBC':                   { min: 2,   max: 6   },
  'FFP':                    { min: -25, max: -18  },
  'Platelets':              { min: 20,  max: 24  },
  'Cryoprecipitate':        { min: -25, max: -18  },
  'Plasma':                 { min: -25, max: -18  },
  'Single Donor Platelets': { min: 20,  max: 24  },
  'Leukoreduced PRBC':      { min: 2,   max: 6   },
  'Irradiated PRBC':        { min: 2,   max: 6   },
  'Washed PRBC':            { min: 2,   max: 6   },
};

export const COMPONENT_SHELF_LIFE_DAYS = {
  'Whole Blood':            35,
  'PRBC':                   42,
  'FFP':                    365,
  'Platelets':              5,
  'Cryoprecipitate':        365,
  'Plasma':                 365,
  'Single Donor Platelets': 5,
  'Leukoreduced PRBC':      42,
  'Irradiated PRBC':        28,
  'Washed PRBC':            24,
};

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const bloodUnitSchema = new Schema(
  {
    bagNumber:    { type: String, required: true, trim: true, uppercase: true },
    donorCode:    { type: String, trim: true, uppercase: true, default: null },
    donorName:    { type: String, trim: true },

    collectedAt:      { type: Date, required: true },
    collectedByStaff: { type: String, trim: true },
    volumeMl:         { type: Number, required: true, min: 50, max: 500 },
    donorHemoglobin:  { type: Number, min: 0 },

    processedAt:      { type: Date },
    processedBy:      { type: String, trim: true },
    separationMethod: {
      type: String,
      enum: ['Whole_Blood_Filtration', 'Apheresis', 'Centrifugation', 'Not_Applicable'],
    },

    testResults: {
      hiv:      { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      hbsAg:    { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      hcv:      { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      syphilis: { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      malaria:  { type: String, enum: ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'], default: 'Pending' },
      testedAt: { type: Date },
      testedBy: { type: String },
      allClear: { type: Boolean, default: false },
    },

    isTestingComplete: { type: Boolean, default: false },
    isReleaseApproved: { type: Boolean, default: false },

    crossMatch: {
      requestId:    { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
      sampleSentAt: { type: Date },
      result:       { type: String, enum: ['Compatible', 'Incompatible', 'Pending', null], default: null },
      resultAt:     { type: Date },
      performedBy:  { type: String },
    },

    storageLocation:     { type: String, enum: STORAGE_LOCATIONS },
    storageSlot:         { type: String, trim: true },
    storageTemperatureC: { type: Number },

    // FIX: expiresAt index on sub-doc handled at parent level
    expiresAt: { type: Date, required: true },

    reservedFor: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    reservedAt:  { type: Date },
    issuedTo: {
      request:    { type: Schema.Types.ObjectId, ref: 'BloodRequest' },
      hospital:   { type: Schema.Types.ObjectId, ref: 'Hospital' },
      issuedAt:   { type: Date },
      issuedBy:   { type: String },
      receiptUrl: { type: String },
    },

    transfusedAt: { type: Date },
    transfusedBy: { type: String },

    status: { type: String, enum: UNIT_STATUSES, default: 'available' },

    isRecalled:   { type: Boolean, default: false },
    recallReason: { type: String },
    recalledAt:   { type: Date },

    notes: { type: String },
  },
  { _id: true, timestamps: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bloodInventorySchema = new Schema(
  {
    bloodBank: {
      type: Schema.Types.ObjectId, ref: 'BloodBank', required: true, index: true,
    },
    bloodGroup: {
      type: String, required: true,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      index: true,
    },
    component: {
      type: String, required: true,
      enum: [
        'Whole Blood', 'PRBC', 'FFP', 'Platelets', 'Cryoprecipitate',
        'Plasma', 'Single Donor Platelets', 'Leukoreduced PRBC',
        'Irradiated PRBC', 'Washed PRBC',
      ],
      index: true,
    },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] },
    },
    cityName: { type: String, trim: true },

    // Counters — atomic $inc only. DO NOT recompute in app layer.
    totalUnits:       { type: Number, default: 0, min: 0 },
    availableUnits:   { type: Number, default: 0, min: 0 },
    reservedUnits:    { type: Number, default: 0, min: 0 },
    issuedUnits:      { type: Number, default: 0, min: 0 },
    expiredUnits:     { type: Number, default: 0, min: 0 },
    discardedUnits:   { type: Number, default: 0, min: 0 },
    quarantinedUnits: { type: Number, default: 0, min: 0 },

    units: {
      type:     [bloodUnitSchema],
      default:  [],
      validate: [v => v.length <= 500, 'Max 500 units per inventory document'],
    },

    nextExpiryAt:    { type: Date, default: null, index: true },
    expiringIn3Days: { type: Number, default: 0, min: 0 },
    expiringIn7Days: { type: Number, default: 0, min: 0 },

    processingFeePerUnit: { type: Number, default: 0, min: 0 },
    crossMatchFeePerUnit: { type: Number, default: 0, min: 0 },

    isLowStock:      { type: Boolean, default: false, index: true },
    isCriticalStock: { type: Boolean, default: false, index: true },
    lastAlertSentAt: { type: Date },

    lastUpdatedAt:  { type: Date, default: Date.now },
    lastDonationAt: { type: Date },
    lastIssuanceAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Unique index ──────────────────────────────────────────────────────────────
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

// ── Statics ───────────────────────────────────────────────────────────────────

bloodInventorySchema.statics.findAvailableNearby = function ({
  bloodGroup, component, unitsNeeded = 1, lng, lat, maxDistanceMeters = 20000,
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

bloodInventorySchema.statics.reserveUnits = async function (inventoryId, requestId, unitsToReserve) {
  const updated = await this.findOneAndUpdate(
    { _id: inventoryId, availableUnits: { $gte: unitsToReserve } },
    {
      $inc: { availableUnits: -unitsToReserve, reservedUnits: unitsToReserve },
      $set: { lastUpdatedAt: new Date() },
    },
    { new: true }
  );
  if (!updated) return null;

  const now = new Date();
  let reserved = 0;
  for (const unit of updated.units) {
    if (reserved >= unitsToReserve) break;
    // FIX: also check unit not expired before reserving
    if (
      unit.status === 'available' &&
      unit.isReleaseApproved &&
      unit.expiresAt > now
    ) {
      unit.status      = 'reserved';
      unit.reservedFor = requestId;
      unit.reservedAt  = now;
      reserved++;
    }
  }

  return updated.save();
};

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
    inv.reservedUnits   = Math.max(0, inv.reservedUnits - released);
    inv.lastUpdatedAt   = new Date();
    return inv.save();
  }
  return inv;
};

bloodInventorySchema.statics.addUnit = async function (inventoryId, unitData) {
  const inv = await this.findById(inventoryId);
  if (!inv) throw new Error('BloodInventory not found');
  if (inv.units.length >= 500) throw new Error('Inventory at capacity (500 units). Create new batch document.');

  inv.units.push(unitData);
  inv.totalUnits++;
  // FIX: only increment availableUnits when unit is released/approved
  if (unitData.isReleaseApproved && unitData.status === 'available') {
    inv.availableUnits++;
  }
  inv.lastDonationAt = new Date();
  inv.lastUpdatedAt  = new Date();

  return inv.save();
};

/**
 * runExpiryCheck — called by daily cron at 00:00.
 * FIX: expiringIn3Days/7Days now correctly exclude already-expired units.
 */
bloodInventorySchema.statics.runExpiryCheck = async function (inventoryId) {
  const inv = await this.findById(inventoryId);
  if (!inv) return null;
  const now = new Date();
  let expired = 0;

  for (const unit of inv.units) {
    if (['available', 'reserved'].includes(unit.status) && unit.expiresAt < now) {
      if (unit.status === 'reserved') inv.reservedUnits  = Math.max(0, inv.reservedUnits - 1);
      else                            inv.availableUnits = Math.max(0, inv.availableUnits - 1);
      unit.status = 'expired';
      inv.expiredUnits++;
      expired++;
    }
  }

  const activeDates = inv.units
    .filter(u => u.status === 'available' && u.expiresAt > now)
    .map(u => u.expiresAt)
    .sort((a, b) => a - b);
  inv.nextExpiryAt = activeDates[0] ?? null;

  // FIX: filter out already-expired — use u.expiresAt > now as lower bound
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  inv.expiringIn3Days = inv.units.filter(
    u => u.status === 'available' && u.expiresAt > now && u.expiresAt <= threeDays
  ).length;
  inv.expiringIn7Days = inv.units.filter(
    u => u.status === 'available' && u.expiresAt > now && u.expiresAt <= sevenDays
  ).length;
  inv.lastUpdatedAt = now;

  return inv.save();
};

// ── Pre-save ──────────────────────────────────────────────────────────────────
// NOTE: pre-save only fires on .save() — NOT on $inc/$set atomic updates.
// Counter integrity maintained via statics above.
bloodInventorySchema.pre('save', function () {
  if (this.isModified('units')) {
    const now    = new Date();
    const active = this.units
      .filter(u => u.status === 'available' && u.expiresAt > now)
      .map(u => u.expiresAt)
      .sort((a, b) => a - b);
    this.nextExpiryAt     = active[0] ?? null;
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