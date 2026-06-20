import mongoose from 'mongoose';
const { Schema } = mongoose;

export const LEDGER_TRANSACTION_TYPES = [
  'earning',
  'payout',
  'adjustment',
  'refund',
  'reversal',
  'bonus',
  'penalty'
];

const partnerLedgerSchema = new Schema(
  {
    partnerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    partnerType: { 
      type: String, 
      enum: ['doctor', 'driver', 'solodriverpartner', 'lab_partner', 'care_assistant', 'physiotherapist', 'pharmacy'], 
      required: true 
    },
    
    // References to related entities
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    payoutId: { type: Schema.Types.ObjectId, ref: 'Payout', index: true },
    settlementBatchId: { type: Schema.Types.ObjectId, ref: 'SettlementBatch', index: true },
    
    // Financial Data (Strictly in Paise)
    amountPaise: { type: Number, required: true }, // Positive for credits (earnings), Negative for debits (payouts)
    balanceAfterPaise: { type: Number, required: true }, // Snapshot of balance after this transaction
    currency: { type: String, default: 'INR' },
    
    // Categorization
    type: { type: String, enum: LEDGER_TRANSACTION_TYPES, required: true, index: true },
    description: { type: String, required: true, trim: true },
    
    // Contextual Data
    metadata: { type: Schema.Types.Mixed },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false }, // Append-only, no updates allowed
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for fast reconciliation and statement generation
partnerLedgerSchema.index({ partnerUserId: 1, createdAt: -1 });
partnerLedgerSchema.index({ partnerUserId: 1, type: 1 });
partnerLedgerSchema.index({ settlementBatchId: 1, type: 1 });

// Prevent modifications after creation (Immutability Enforcer)
partnerLedgerSchema.pre('updateOne', function() {
  throw new Error('PartnerLedger records are immutable and cannot be updated.');
});
partnerLedgerSchema.pre('findOneAndUpdate', function() {
  throw new Error('PartnerLedger records are immutable and cannot be updated.');
});

const PartnerLedger = mongoose.model('PartnerLedger', partnerLedgerSchema);
export default PartnerLedger;