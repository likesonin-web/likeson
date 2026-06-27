/**
 * PurchaseOrder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * B2B orders placed by the pharmacy to suppliers.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import mongoose from 'mongoose';
const { Schema } = mongoose;

const purchaseOrderItemSchema = new Schema({
  medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
  requestedQuantity: { type: Number, required: true, min: 1 },
  receivedQuantity: { type: Number, default: 0, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 }, // Expected PTR
  taxAmount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
});

const purchaseOrderSchema = new Schema(
  {
    poNumber: { type: String, unique: true, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'PharmacyStore', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Partially_Received', 'Received', 'Cancelled', 'Returned'],
      default: 'Draft',
    },
    
    items: [purchaseOrderItemSchema],
    
    financials: {
      subTotal: { type: Number, required: true },
      taxTotal: { type: Number, default: 0 },
      discountTotal: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
    },
    
    expectedDeliveryDate: { type: Date },
    receivedAt: { type: Date },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    
    supplierInvoiceNumber: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ supplierId: 1 });

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;