import mongoose from "mongoose";
const { Schema } = mongoose;

const promotionCouponSchema = new Schema({
  code: { type: String, unique: true, required: true, uppercase: true },
  
  // Targeting Logic
  eligibility: {
    type: { 
      type: String, 
      enum: ['New_User_Only', 'First_Booking', 'Subscription_Renewal', 'General'],
      required: true 
    },
    minOrderValue: Number
  },

  // Discount Math
  benefit: {
    type: { type: String, enum: ['Percentage', 'Flat_Amount', 'Free_Ride', 'Free_Consultation'] },
    value: { type: Number, required: true },
    maxCap: Number // Max discount for percentage coupons
  },

  // Limits
  usage: {
    limitPerUser: { type: Number, default: 1 },
    totalPlatformLimit: Number,
    currentUses: { type: Number, default: 0 }
  },

  validity: {
    from: Date,
    to: Date
  },
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const PromotionCoupon = mongoose.model('PromotionCoupon', promotionCouponSchema);
export default PromotionCoupon;