import mongoose from 'mongoose';
const { Schema } = mongoose;

export const BATCH_STATUSES = [
  'draft',              // Accumulating entries
  'pending_approval',   // Locked, awaiting finance approval
  'approved',           // Approved, queueing payouts
  'processing',         // Payouts dispatched to RazorpayX
  'completed',          // All payouts resolved (success or explicitly failed)
  'failed',             // Batch level failure
  'cancelled'           // Cancelled by finance
];

const settlementBatchSchema = new Schema(
  {
    batchCode: { type: String, unique: true, required: true, index: true },
    cycle: { type: String, enum: ['daily', 'weekly', 'monthly', 'manual'], required: true },
    
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    
    partnerCount: { type: Number, default: 0 },
    payoutCount: { type: Number, default: 0 },
    totalAmountPaise: { type: Number, default: 0, min: 0 },
    
    status: { type: String, enum: BATCH_STATUSES, default: 'draft', index: true },
    
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // System or Admin
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

// Generate readable batch codes (e.g., BATCH-20260613-W1)
settlementBatchSchema.pre('validate', function(next) {
  if (this.isNew && !this.batchCode) {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.batchCode = `STL-${dateStr}-${rand}`;
  }
  next();
});

const SettlementBatch = mongoose.model('SettlementBatch', settlementBatchSchema);
export default SettlementBatch;