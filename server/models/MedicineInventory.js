/**
 * MedicineInventory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One document = ONE store + ONE medicine.
 * Stores stock levels, pricing, rack location, reservation state.
 * Never embeds medicine metadata. Never embeds inside Medicine.
 *
 * Relationship:
 *   MedicineInventory.medicineId → Medicine._id
 *   MedicineInventory.storeId    → PharmacyStore._id
 *   MedicineInventory.batchId    → MedicineBatch._id (active/primary batch)
 *   MedicineInventory.supplierId → Supplier._id
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

const medicineInventorySchema = new Schema(
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
    /**
     * Active/primary batch currently being sold (FIFO).
     * Points to the MedicineBatch doc with earliest expiry that still has stock.
     * Updated automatically by batch management logic or background job.
     */
    batchId: {
      type: Schema.Types.ObjectId,
      ref:  'MedicineBatch',
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref:  'Supplier',
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    mrp: {
      type:     Number,
      required: true,
      min:      0,
      comment:  'Maximum Retail Price as printed on packaging.',
    },
    purchasePrice: {
      type:    Number,
      min:     0,
      select:  false, // hidden from customer-facing APIs
    },
    sellingPrice: {
      type:     Number,
      required: true,
      min:      0,
      comment:  'Store selling price before discount.',
    },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountAmount:  { type: Number, default: 0, min: 0 },
    finalPrice: {
      type:    Number,
      min:     0,
      comment: 'sellingPrice - discountAmount. Computed in pre-save.',
    },
    profitMargin: {
      type:   Number,
      select: false,
      comment:'(finalPrice - purchasePrice) / finalPrice * 100',
    },
    platformCommission: {
      type:    Number,
      default: 0,
      min:     0,
      select:  false,
      comment: 'Platform % on this inventory item (may override store-level commission).',
    },

    // ── Stock Levels ──────────────────────────────────────────────────────────
    stockQuantity: {
      type:    Number,
      default: 0,
      min:     0,
      comment: 'Physical total units in store.',
    },
    reservedStock: {
      type:    Number,
      default: 0,
      min:     0,
      comment: 'Units reserved for pending/confirmed orders not yet picked.',
    },
    availableStock: {
      type:    Number,
      default: 0,
      min:     0,
      comment: 'stockQuantity - reservedStock. Computed in pre-save.',
    },
    damagedStock: {
      type:    Number,
      default: 0,
      min:     0,
    },
    returnedStock: {
      type:    Number,
      default: 0,
      min:     0,
      comment: 'Customer returns pending inspection.',
    },

    // ── Thresholds ────────────────────────────────────────────────────────────
    reorderLevel: {
      type:    Number,
      default: 10,
      min:     0,
      comment: 'Trigger reorder alert when availableStock falls to/below this.',
    },
    minimumStock: {
      type:    Number,
      default: 0,
      min:     0,
    },
    maximumStock: {
      type:    Number,
      default: 10000,
      min:     1,
    },

    // ── Flags ─────────────────────────────────────────────────────────────────
    isLowStock: { type: Boolean, default: false },
    isOutOfStock:{ type: Boolean, default: false },

    // ── Physical Location in Store ────────────────────────────────────────────
    rackLocation: {
      type:    String,
      trim:    true,
      comment: 'e.g. "Aisle-3 / Rack-B / Shelf-2"',
    },

    // ── Barcodes ──────────────────────────────────────────────────────────────
    barcode: { type: String, trim: true },
    qrCode:  { type: String, trim: true },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
      comment: 'false = soft-deactivated, excluded from search results.',
    },

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

// ── Unique constraint: one inventory record per store-medicine pair ────────────

medicineInventorySchema.index(
  { medicineId: 1, storeId: 1 },
  { unique: true, name: 'unique_store_medicine' }
);

// ── Pre-save: compute derived fields ─────────────────────────────────────────

medicineInventorySchema.pre('save', function () {
  // Compute discountAmount from percent if not set
  if (this.isModified('discountPercent') || this.isModified('sellingPrice')) {
    this.discountAmount = parseFloat(
      ((this.sellingPrice * this.discountPercent) / 100).toFixed(2)
    );
  }

  // Compute finalPrice
  this.finalPrice = parseFloat(
    Math.max(0, this.sellingPrice - this.discountAmount).toFixed(2)
  );

  // Compute availableStock
  this.availableStock = Math.max(0, this.stockQuantity - this.reservedStock);

  // Compute profitMargin
  if (this.purchasePrice && this.finalPrice > 0) {
    this.profitMargin = parseFloat(
      (((this.finalPrice - this.purchasePrice) / this.finalPrice) * 100).toFixed(2)
    );
  }

  // Auto-flag stock status
  this.isOutOfStock = this.availableStock <= 0;
  this.isLowStock   = !this.isOutOfStock && this.availableStock <= this.reorderLevel;
});

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Reserve stock atomically for an order.
 * Returns updated doc or null if insufficient stock.
 */
medicineInventorySchema.statics.reserveStock = async function (
  medicineId,
  storeId,
  quantity
) {
  return this.findOneAndUpdate(
    {
      medicineId,
      storeId,
      isActive:     true,
      isDeleted:    false,
      availableStock: { $gte: quantity },
    },
    {
      $inc: { reservedStock: quantity, availableStock: -quantity },
      $set: {
        isOutOfStock: false, // will be recomputed on next save; findOneAndUpdate bypasses hooks
      },
    },
    { new: true }
  );
};

/**
 * Release reserved stock (order cancelled / rejected).
 */
medicineInventorySchema.statics.releaseStock = async function (
  medicineId,
  storeId,
  quantity
) {
  return this.findOneAndUpdate(
    { medicineId, storeId, isDeleted: false },
    {
      $inc: {
        reservedStock:  -quantity,
        availableStock:  quantity,
      },
    },
    { new: true }
  );
};

/**
 * Deduct stock after order confirmed (move from reserved → actual deduct).
 */
medicineInventorySchema.statics.deductStock = async function (
  medicineId,
  storeId,
  quantity
) {
  return this.findOneAndUpdate(
    { medicineId, storeId, isDeleted: false, reservedStock: { $gte: quantity } },
    {
      $inc: {
        stockQuantity: -quantity,
        reservedStock: -quantity,
      },
    },
    { new: true }
  );
};

// ── Indexes ───────────────────────────────────────────────────────────────────

// Core lookup: medicine search returns inventories per store
medicineInventorySchema.index({ medicineId: 1, isActive: 1, isDeleted: 1 });

// Store dashboard: all items for a store
medicineInventorySchema.index({ storeId: 1, isActive: 1, isDeleted: 1 });

// Low-stock alerts
medicineInventorySchema.index({ storeId: 1, isLowStock: 1 });
medicineInventorySchema.index({ storeId: 1, isOutOfStock: 1 });

// Active batch reference
medicineInventorySchema.index({ batchId: 1 });

// Supplier reference
medicineInventorySchema.index({ supplierId: 1 });

// Price queries / sorting
medicineInventorySchema.index({ medicineId: 1, finalPrice: 1 });

// Reorder management
medicineInventorySchema.index({ storeId: 1, availableStock: 1, reorderLevel: 1 });

// Barcode / QR lookup
medicineInventorySchema.index({ barcode: 1 }, { sparse: true });
medicineInventorySchema.index({ qrCode: 1 },  { sparse: true });

// ── Export ────────────────────────────────────────────────────────────────────

const MedicineInventory = mongoose.model('MedicineInventory', medicineInventorySchema);
export default MedicineInventory;