/**
 * MedicineBatch.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One document = one physical batch of a medicine at a store.
 * Supports FIFO dispensing, expiry alerts, supplier linkage, purchase invoices.
 *
 * Relationship:
 *   MedicineBatch.medicineId → Medicine._id
 *   MedicineBatch.storeId    → PharmacyStore._id
 *   MedicineBatch.supplierId → Supplier._id
 *   MedicineBatch.purchaseOrderId → PurchaseOrder._id
 *
 * MedicineInventory.batchId points to the FIFO-active batch from this collection.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

const medicineBatchSchema = new Schema(
  {
    // ── Core References ───────────────────────────────────────────────────────
    medicineId: {
      type:     Schema.Types.ObjectId,
      ref:      'Medicine',
      required: true,
    },
    storeId: {
      type:     Schema.Types.ObjectId,
      ref:      'PharmacyStore',
      required: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref:  'Supplier',
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref:  'PurchaseOrder',
    },

    // ── Batch Identity ────────────────────────────────────────────────────────
    batchNumber: {
      type:     String,
      required: true,
      trim:     true,
      comment:  'Manufacturer batch number as printed on packaging.',
    },

    // ── Dates ─────────────────────────────────────────────────────────────────
    manufacturingDate: { type: Date },
    expiryDate: {
      type:     Date,
      required: true,
    },

    // ── Purchase Information ──────────────────────────────────────────────────
    purchaseInvoiceNo:   { type: String, trim: true },
    purchaseInvoiceDate: { type: Date },
    purchasePrice: {
      type:   Number,
      min:    0,
      select: false,
    },

    // ── Quantities ────────────────────────────────────────────────────────────
    quantityPurchased: {
      type:     Number,
      required: true,
      min:      1,
      comment:  'Total units received in this batch.',
    },
    remainingQuantity: {
      type:    Number,
      min:     0,
      comment: 'Units still available (not sold/damaged/returned).',
    },
    soldQuantity:      { type: Number, default: 0, min: 0 },
    damagedQuantity:   { type: Number, default: 0, min: 0 },
    returnedQuantity:  { type: Number, default: 0, min: 0 },
    expiredQuantity:   { type: Number, default: 0, min: 0 },

    // ── FIFO & Expiry ─────────────────────────────────────────────────────────
    fifoPriority: {
      type:    Number,
      default: 0,
      comment: 'Lower = sell first. Set to expiryDate.getTime() for pure FEFO (First Expire First Out).',
    },
    isNearExpiry: {
      type:    Boolean,
      default: false,
      comment: 'true if expiryDate within nearExpiryThresholdDays from today.',
    },
    nearExpiryThresholdDays: {
      type:    Number,
      default: 90,
      comment: 'Days before expiry to flag as near-expiry.',
    },
    isExpired: { type: Boolean, default: false },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['Active', 'Exhausted', 'Expired', 'Recalled', 'Quarantine', 'Damaged'],
      default: 'Active',
    },

    // ── Barcodes ──────────────────────────────────────────────────────────────
    barcode: { type: String, trim: true },
    qrCode:  { type: String, trim: true },

    // ── Alerts Log ────────────────────────────────────────────────────────────
    expiryAlerts: [
      {
        alertedAt:   { type: Date, default: Date.now },
        alertType:   { type: String, enum: ['30Days', '60Days', '90Days', 'Expired'] },
        notifiedTo:  [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },

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

medicineBatchSchema.pre('save', function () {
  const now = new Date();

  // Set remainingQuantity on creation
  if (this.isNew && this.remainingQuantity == null) {
    this.remainingQuantity = this.quantityPurchased;
  }

  // Set FIFO priority = expiry timestamp (FEFO strategy)
  if (this.isModified('expiryDate') || this.isNew) {
    this.fifoPriority = this.expiryDate ? this.expiryDate.getTime() : Date.now();
  }

  // Check expiry
  this.isExpired = this.expiryDate ? this.expiryDate < now : false;

  // Check near-expiry
  if (!this.isExpired && this.expiryDate) {
    const diffDays = (this.expiryDate - now) / (1000 * 60 * 60 * 24);
    this.isNearExpiry = diffDays <= this.nearExpiryThresholdDays;
  } else {
    this.isNearExpiry = false;
  }

  // Auto-update status
  if (this.isExpired && this.status === 'Active') {
    this.status = 'Expired';
  } else if (this.remainingQuantity === 0 && this.status === 'Active') {
    this.status = 'Exhausted';
  }
});

// ── Virtuals ──────────────────────────────────────────────────────────────────

medicineBatchSchema.virtual('daysUntilExpiry').get(function () {
  if (!this.expiryDate) return null;
  return Math.ceil((this.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
});

medicineBatchSchema.virtual('utilizationPercent').get(function () {
  if (!this.quantityPurchased) return 0;
  return parseFloat(
    (((this.quantityPurchased - this.remainingQuantity) / this.quantityPurchased) * 100).toFixed(2)
  );
});

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Get active batches for a medicine at a store, ordered FEFO.
 */
medicineBatchSchema.statics.getActiveBatches = function (medicineId, storeId) {
  return this.find({
    medicineId,
    storeId,
    status:    'Active',
    isDeleted: false,
    remainingQuantity: { $gt: 0 },
  }).sort({ fifoPriority: 1 }); // earliest expiry first
};

/**
 * Get near-expiry batches across a store for dashboard alerts.
 */
medicineBatchSchema.statics.getNearExpiryByStore = function (storeId, thresholdDays = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + thresholdDays);
  return this.find({
    storeId,
    expiryDate: { $lte: cutoff },
    status:     'Active',
    isDeleted:  false,
    remainingQuantity: { $gt: 0 },
  })
    .populate('medicineId', 'name brandName')
    .sort({ expiryDate: 1 });
};

// ── Indexes ───────────────────────────────────────────────────────────────────

// FIFO batch lookup per medicine per store
medicineBatchSchema.index({ medicineId: 1, storeId: 1, fifoPriority: 1 });

// Expiry management (cron jobs / alerts)
medicineBatchSchema.index({ storeId: 1, expiryDate: 1, status: 1 });
medicineBatchSchema.index({ isNearExpiry: 1, status: 1 });
medicineBatchSchema.index({ isExpired: 1, status: 1 });

// Active stock queries
medicineBatchSchema.index({ storeId: 1, status: 1, remainingQuantity: 1 });

// Supplier & purchase order references
medicineBatchSchema.index({ supplierId: 1 });
medicineBatchSchema.index({ purchaseOrderId: 1 });

// Barcode / QR lookup
medicineBatchSchema.index({ barcode: 1 }, { sparse: true });
medicineBatchSchema.index({ qrCode: 1 },  { sparse: true });

// Batch number lookup (store-level uniqueness enforced in app layer)
medicineBatchSchema.index({ storeId: 1, batchNumber: 1 });

// TTL: auto-flag expired (background cron preferred, but useful for low-traffic)
// Note: TTL indexes delete docs; use a background job to mark as Expired instead.
// medicineBatchSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 }); // DO NOT use — would delete batch records

// ── Export ────────────────────────────────────────────────────────────────────

const MedicineBatch = mongoose.model('MedicineBatch', medicineBatchSchema);
export default MedicineBatch;