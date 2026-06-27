/**
 * InventoryMovement.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Append-only ledger for every single stock change.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import mongoose from 'mongoose';
const { Schema } = mongoose;

const inventoryMovementSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'PharmacyStore', required: true },
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'MedicineBatch', required: true },
    
    movementType: {
      type: String,
      enum: [
        'Purchase',          // Stock received from supplier
        'Sale',              // Order fulfilled and delivered
        'Reservation',       // Stock held for pending order
        'Release',           // Order cancelled, stock released
        'Adjustment_Add',    // Manual reconciliation (found stock)
        'Adjustment_Sub',    // Manual reconciliation (lost/pilfered)
        'Damage',            // Stock marked as damaged
        'Expiry',            // Stock expired
        'Return',            // Customer return
        'Transfer_In',       // Received from another warehouse/store
        'Transfer_Out'       // Sent to another warehouse/store
      ],
      required: true,
    },
    
    quantityChanged: { 
      type: Number, 
      required: true,
      comment: 'Absolute value of the change. Use movementType to determine direction.' 
    },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    
    // The catalyst for this movement (Order, PO, or Manual)
    referenceModel: { type: String, enum: ['PharmacyOrder', 'PurchaseOrder', 'Manual', 'Transfer'] },
    referenceId: { type: Schema.Types.ObjectId },
    
    reason: { type: String, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Append-only constraint: Movements should never be updated or deleted.
inventoryMovementSchema.pre('findOneAndUpdate', function() {
  throw new Error('Inventory movements are immutable ledgers and cannot be updated.');
});

inventoryMovementSchema.index({ storeId: 1, medicineId: 1, createdAt: -1 });
inventoryMovementSchema.index({ referenceId: 1 });
inventoryMovementSchema.index({ movementType: 1, createdAt: -1 });

const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);
export default InventoryMovement;