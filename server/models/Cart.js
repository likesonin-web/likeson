import mongoose from 'mongoose';
const { Schema } = mongoose;

const cartSchema = new Schema({

  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,   // one cart document per user, always
  },

  store: {
    type: Schema.Types.ObjectId,
    ref: 'PharmacyStore',
    required: false,
  },

  items: [{
    medicine: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity cannot be less than 1'],
      default: 1,
    },
    pricePerUnit:           { type: Number, required: true },
    gstPercentage:          { type: Number, default: 12 },
    prescription:{
       isRequired: { type: Boolean, default: false },

      imageUrl:   { type: String },
      uploadedAt: { type: Date },
    },
    isPrescriptionRequired: { type: Boolean, default: false },
  }],

  billSummary: {
    itemsTotal:   { type: Number, default: 0 },
    estimatedTax: { type: Number, default: 0 },
    totalAmount:  { type: Number, default: 0 },
  },

}, { timestamps: true });

// ─── Pre-save: recompute bill summary ────────────────────────────────────────
cartSchema.pre('save', function () {
  let itemsTotal   = 0;
  let estimatedTax = 0;

  this.items.forEach(item => {
    const lineTotal = item.pricePerUnit * item.quantity;
    const lineTax   = lineTotal * ((item.gstPercentage ?? 12) / 100);
    itemsTotal   += lineTotal;
    estimatedTax += lineTax;
  });

  this.billSummary.itemsTotal   = Math.round(itemsTotal   * 100) / 100;
  this.billSummary.estimatedTax = Math.round(estimatedTax * 100) / 100;
  this.billSummary.totalAmount  = Math.round((itemsTotal + estimatedTax) * 100) / 100;
});

// ─── Index ────────────────────────────────────────────────────────────────────
// unique: true on `user` above already creates the index.
// Additional compound index for fast store-aware lookups.
cartSchema.index({ user: 1, store: 1 });

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;