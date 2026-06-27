/**
 * PharmacyStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-grade pharmacy store model.
 * Supports partner + owned stores, geo, delivery, analytics, warehouse,
 * branch hierarchy, operational KPIs, and financial settlement.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const storeBankAccountSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true, required: true },
    accountNumber:     { type: String, trim: true, required: true }, // encrypt at rest
    ifscCode: {
      type:      String,
      trim:      true,
      uppercase: true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'],
    },
    bankName:           { type: String, trim: true },
    branchName:         { type: String, trim: true },
    accountType:        { type: String, enum: ['Savings', 'Current', 'OD'], default: 'Current' },
    isPrimary:          { type: Boolean, default: false },
    isVerified:         { type: Boolean, default: false },
    cancelledChequeUrl: { type: String },
    verifiedAt:         { type: Date },
    verifiedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const storeUpiSchema = new Schema(
  {
    upiId:      { type: String, trim: true },
    upiName:    { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
    isPrimary:  { type: Boolean, default: false },
  },
  { _id: true }
);

const gatewayAccountSchema = new Schema(
  {
    provider:      { type: String, enum: ['Razorpay', 'Cashfree', 'PayU', 'Stripe', 'PhonePe Business'], required: true },
    accountId:     { type: String, trim: true },
    isActive:      { type: Boolean, default: true },
    linkedAt:      { type: Date, default: Date.now },
    webhookSecret: { type: String, select: false },
  },
  { _id: true }
);

const timingSchema = new Schema(
  {
    day:    { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    open:   { type: String },  // "09:00"
    close:  { type: String },  // "21:00"
    is24x7: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false }, // weekly off
  },
  { _id: false }
);

const holidaySchema = new Schema(
  {
    date:        { type: Date, required: true },
    description: { type: String, trim: true },  // "Diwali", "Independence Day"
    isFullDay:   { type: Boolean, default: true },
    openTime:    { type: String },  // if partial closure
    closeTime:   { type: String },
  },
  { _id: true }
);

const deliveryZoneSchema = new Schema(
  {
    zoneLabel:       { type: String, trim: true },  // "Zone A", "Zone B"
    radiusKm:        { type: Number, min: 0 },
    deliveryCharges: { type: Number, default: 0, min: 0 },
    freeAboveAmount: { type: Number, default: 0 },
    etaMinutes:      { type: Number, min: 0 },
  },
  { _id: true }
);

const performanceMetricsSchema = new Schema(
  {
    totalOrdersServed:      { type: Number, default: 0, min: 0 },
    totalOrdersCancelled:   { type: Number, default: 0, min: 0 },
    totalOrdersRejected:    { type: Number, default: 0, min: 0 },
    acceptanceRate:         { type: Number, default: 100, min: 0, max: 100 }, // %
    successRate:            { type: Number, default: 100, min: 0, max: 100 }, // %
    avgPreparationTimeMin:  { type: Number, default: 15, min: 0 },
    avgDeliveryTimeMin:     { type: Number, default: 60, min: 0 },
    avgRating:              { type: Number, default: 0, min: 0, max: 5 },
    totalReviews:           { type: Number, default: 0, min: 0 },
    lastComputedAt:         { type: Date },
  },
  { _id: false }
);

const operationalCapacitySchema = new Schema(
  {
    dailyOrderLimit:        { type: Number, default: 500, min: 1 },
    maxConcurrentOrders:    { type: Number, default: 50,  min: 1 },
    currentActiveOrders:    { type: Number, default: 0,   min: 0 },
    autoAcceptOrders:       { type: Boolean, default: false },
    autoRejectTimeoutMin:   { type: Number, default: 10,  min: 1 }, // auto-reject if no action
    isAcceptingOrders:      { type: Boolean, default: true },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const pharmacyStoreSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    storeCode: {
      type:   String,
      unique: true,
      trim:   true,
      // e.g. "SWA-VJA-001", "PRT-HYD-042"
      comment: 'Human-readable unique store code. Auto-generated if not provided.',
    },
    storeName: { type: String, required: true, trim: true },
    slug:      { type: String, unique: true, lowercase: true, trim: true },

    storeType: {
      type:     String,
      enum:     ['Owned', 'Partnered'],
      required: true,
    },

    // ── Branch / Warehouse Hierarchy ──────────────────────────────────────────
    parentBranch: {
      type:    Schema.Types.ObjectId,
      ref:     'PharmacyStore',
      default: null,
      comment: 'Points to parent store if this is a sub-branch.',
    },
    isWarehouse: { type: Boolean, default: false },
    warehouseId: {
      type:    Schema.Types.ObjectId,
      ref:     'PharmacyStore',
      default: null,
      comment: 'Source warehouse for inventory replenishment.',
    },

    // ── Location ──────────────────────────────────────────────────────────────
    address: {
      line1:    { type: String, required: true },
      line2:    { type: String },
      landmark: { type: String },
      city:     { type: String, default: 'Vijayawada' },
      state:    { type: String, default: 'Andhra Pradesh' },
      pincode:  { type: String, required: true },
    },

    // GeoJSON for $geoNear / $geoWithin queries
    location: {
      type: {
        type:    String,
        enum:    ['Point'],
        default: 'Point',
      },
      coordinates: {
        type:    [Number], // [lng, lat]
        default: [0, 0],
      },
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    contact: {
      email:          { type: String, required: true },
      phone:          { type: String, required: true },
      alternatePhone: { type: String },
      whatsapp:       { type: String },
    },

    // ── Legal / Compliance ────────────────────────────────────────────────────
    legal: {
      dlNumber: { type: String, required: true },
      gstNumber:{ type: String },
      panNumber: {
        type:      String,
        trim:      true,
        uppercase: true,
        match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
      },
      licenseExpiry: { type: Date },
      documentUrl:   { type: String },
    },

    // ── Specializations ───────────────────────────────────────────────────────
    specializations: [
      {
        type: String,
        enum: ['Generic', 'Ayurvedic', 'Critical Care', 'Homeopathy', 'Surgical Supplies', 'Veterinary', 'Cosmetics'],
      },
    ],

    // ── Timings & Holidays ────────────────────────────────────────────────────
    timings:         [timingSchema],
    holidayCalendar: [holidaySchema],

    // ── Operational Status ────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['Open', 'Closed', 'Under-Maintenance', 'Inactive', 'Suspended'],
      default: 'Open',
    },
    isOnline:              { type: Boolean, default: true },
    emergencyAvailability: { type: Boolean, default: false }, // 24×7 emergency mode
    operationalCapacity:   { type: operationalCapacitySchema, default: () => ({}) },

    // ── Delivery Configuration ────────────────────────────────────────────────
    deliverySettings: {
      canDeliver:          { type: Boolean, default: true },
      deliveryRadiusKm:    { type: Number, default: 5, min: 0 },
      deliveryZones:       [deliveryZoneSchema],
      expressDelivery:     { type: Boolean, default: false },
      expressEtaMinutes:   { type: Number, default: 30 },
      standardEtaMinutes:  { type: Number, default: 120 },
      codAvailable:        { type: Boolean, default: true },
    },

    // ── Verification & Trust ──────────────────────────────────────────────────
    isVerified:         { type: Boolean, default: false },
    verifiedAt:         { type: Date },
    verifiedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
    verificationStatus: {
      type:    String,
      enum:    ['Pending', 'Approved', 'Rejected', 'Under-Review'],
      default: 'Pending',
    },

    // ── Ranking & Priority ────────────────────────────────────────────────────
    priority: {
      type:    String,
      enum:    ['High', 'Medium', 'Low'],
      default: 'Medium',
    },
    priorityScore: {
      type:    Number,
      default: 50,
      min:     0,
      max:     100,
      comment: 'Computed score for store selection algorithm.',
    },

    // ── Performance Metrics ───────────────────────────────────────────────────
    performanceMetrics: { type: performanceMetricsSchema, default: () => ({}) },

    // ── Inventory Sync ────────────────────────────────────────────────────────
    inventorySyncStatus: {
      type:    String,
      enum:    ['Synced', 'Syncing', 'Failed', 'Pending'],
      default: 'Pending',
    },
    lastInventorySyncAt: { type: Date },
    inventorySyncError:  { type: String },

    // ── Management ────────────────────────────────────────────────────────────
    managedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    storeManagers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // ── Financial / Payout ────────────────────────────────────────────────────
    bankDetails: {
      bankAccounts:    { type: [storeBankAccountSchema], default: [] },
      upiHandles:      { type: [storeUpiSchema], default: [] },
      gatewayAccounts: { type: [gatewayAccountSchema], default: [] },
      preferredSettlementMethod: {
        type:    String,
        enum:    ['Bank Transfer', 'UPI', 'Cheque'],
        default: 'Bank Transfer',
      },
      settlementCycle: {
        type:    String,
        enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
        default: 'Weekly',
      },
      commissionPercent: {
        type:    Number,
        min:     0,
        max:     100,
        default: 0,
        comment: 'Platform commission % for Partnered stores.',
      },
      pendingSettlementAmount: { type: Number, default: 0, min: 0 },
      totalSettledAmount:      { type: Number, default: 0, min: 0 },
      lastSettledAt:           { type: Date },
    },

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted:  { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: Schema.Types.ObjectId, ref: 'User' },

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Pre-save hooks ────────────────────────────────────────────────────────────

pharmacyStoreSchema.pre('save', function () {
  // Auto-generate storeCode
  if (!this.storeCode) {
    const prefix = this.storeType === 'Owned' ? 'SWA' : 'PRT';
    const rand   = Math.random().toString(36).toUpperCase().slice(2, 7);
    this.storeCode = `${prefix}-${rand}-${Date.now().toString().slice(-5)}`;
  }

  // Auto-generate slug
  if (!this.slug && this.storeName) {
    const base = this.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    this.slug = `${base}-${Date.now()}`;
  }
});

// ── Virtuals ──────────────────────────────────────────────────────────────────
pharmacyStoreSchema.virtual('isAtCapacity').get(function () {
  const cap = this.operationalCapacity;
  if (!cap) return false; // Fail gracefully if the field wasn't selected in a query
  return (cap.currentActiveOrders || 0) >= (cap.maxConcurrentOrders || 50);
});

pharmacyStoreSchema.virtual('isOpenNow').get(function () {
  if (this.status !== 'Open' || !this.isOnline) return false;
  const now  = new Date();
  const day  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const slot = this.timings?.find(t => t.day === day);
  if (!slot || slot.isClosed) return false;
  if (slot.is24x7) return true;
  const [oh, om] = slot.open.split(':').map(Number);
  const [ch, cm] = slot.close.split(':').map(Number);
  const openMin  = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  return nowMin >= openMin && nowMin <= closeMin;
});

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Find active stores within radius of coordinates.
 * Returns stores sorted by distance for store selection algorithm.
 */
pharmacyStoreSchema.statics.findNearby = function (lng, lat, radiusKm = 10) {
  return this.find({
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusKm * 1000,
      },
    },
    status:     'Open',
    isOnline:   true,
    isVerified: true,
    isDeleted:  false,
    'operationalCapacity.isAcceptingOrders': true,
  });
};



// ── Indexes ───────────────────────────────────────────────────────────────────

pharmacyStoreSchema.index({ location: '2dsphere' });
pharmacyStoreSchema.index({ status: 1, isOnline: 1, isVerified: 1, isDeleted: 1 });
pharmacyStoreSchema.index({ storeType: 1, status: 1 });
pharmacyStoreSchema.index({ 'legal.gstNumber': 1 });
pharmacyStoreSchema.index({ parentBranch: 1 });
pharmacyStoreSchema.index({ warehouseId: 1 });
pharmacyStoreSchema.index({ managedBy: 1 });
pharmacyStoreSchema.index({ priorityScore: -1 });
pharmacyStoreSchema.index({ storeCode: 1 });
pharmacyStoreSchema.index({ 'address.city': 1, 'address.state': 1, status: 1 });
pharmacyStoreSchema.index({ 'address.pincode': 1, status: 1 });
pharmacyStoreSchema.index({ inventorySyncStatus: 1, lastInventorySyncAt: 1 });

// ── Export ────────────────────────────────────────────────────────────────────

const PharmacyStore = mongoose.model('PharmacyStore', pharmacyStoreSchema);
export default PharmacyStore;