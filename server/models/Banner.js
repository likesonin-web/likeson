import mongoose from "mongoose";
const { Schema } = mongoose;

const bannerSchema = new Schema({
  // --- Content & Visuals ---
  title: { type: String, required: true, trim: true },
  subTitle: { type: String, trim: true }, // Added for better UI layouts
  imageUrl: { type: String, required: true },
  
  // --- Navigation Logic ---
  targetType: { 
    type: String, 
    enum: ['ExternalLink', 'InternalRoute', 'Product', 'Hospital', 'Category', 'Promotion'],
    required: true 
  },
  targetId: { type: String }, // e.g., Hospital ID or Category Name
  externalUrl: { type: String }, // Used if targetType is ExternalLink
  
  // --- Placement & Sorting ---
  position: { 
    type: String, 
    enum: ['Home_Top', 'Home_Middle', 'Medicine_Page', 'Lab_Page', 'Checkout_Bottom'],
    index: true 
  },
  priority: { type: Number, default: 0 }, 
  
  // --- Scheduling & Status ---
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  
  // --- Performance Tracking ---
  analytics: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 }
  },

  // --- Audit Trail (Prevents population errors) ---
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for Click-Through Rate
bannerSchema.virtual('ctr').get(function() {
  if (this.analytics.views === 0) return 0;
  return (this.analytics.clicks / this.analytics.views) * 100;
});

// Middleware to auto-archive if endDate has passed
bannerSchema.pre('save', async function() {
  if (this.endDate && this.endDate < new Date()) {
    this.isActive = false;
  }
 
});

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;