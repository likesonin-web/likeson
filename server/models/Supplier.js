/**
 * Supplier.js
 * ─────────────────────────────────────────────────────────────────────────────
 * B2B entities that supply batches of medicine to stores/warehouses.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import mongoose from 'mongoose';
const { Schema } = mongoose;

const supplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, unique: true, uppercase: true },
    
    contact: {
      personName: { type: String },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    
    address: {
      line1: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
    },
    
    legal: {
      gstNumber: { type: String, required: true },
      dlNumber: { type: String, required: true }, // Drug License
      panNumber: { type: String },
    },
    
    paymentTerms: {
      creditPeriodDays: { type: Number, default: 30 },
      preferredMethod: { type: String, enum: ['Bank Transfer', 'Cheque', 'UPI'] },
    },
    
    bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
    },
    
    metrics: {
      averageFulfillmentTimeDays: { type: Number, default: 0 },
      returnRatePercent: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 },
    },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ 'legal.gstNumber': 1 });
supplierSchema.index({ name: 'text', code: 'text' });

const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;