import mongoose from "mongoose";
const { Schema } = mongoose;

const bannerSchema = new Schema({
  // --- Content & Visuals ---
  title: { type: String, required: true, trim: true },
  subTitle: { type: String, trim: true },

  // CHANGED: per-device images
  images: {
    mobile: { type: String, required: true },  // < 768px
    tablet: { type: String },                   // 768–1023px (fallback: mobile)
    desktop: { type: String },                  // >= 1024px (fallback: mobile)
  },

  // --- Navigation Logic ---
  targetType: {
    type: String,
    enum: ['ExternalLink', 'InternalRoute', 'Product', 'Hospital', 'Category', 'Promotion'],
    required: true
  },
  targetId: { type:String},  
  externalUrl: {
    type: String,
    validate: {
      validator: function(v) {
        // FIX: enforce externalUrl when targetType is ExternalLink
        if (this.targetType === 'ExternalLink') return !!v;
        return true;
      },
      message: 'externalUrl required when targetType is ExternalLink'
    }
  },

  // --- Placement & Sorting ---
  position: {
    type: String,
    enum: ['Home_Top', 'Home_Middle', 'Medicine_Page', 'Lab_Page', 'Checkout_Bottom'],
    required: true  // FIX: added required — position is critical for placement
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

  // --- Audit Trail ---
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true } // FIX: added required

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// --- Indexes ---
// FIX: compound index for fast active-banner queries per position
bannerSchema.index({ position: 1, isActive: 1, startDate: 1, endDate: 1 });
bannerSchema.index({ priority: -1 });

// --- Virtual: CTR ---
bannerSchema.virtual('ctr').get(function() {
  if (this.analytics.views === 0) return 0;
  return ((this.analytics.clicks / this.analytics.views) * 100).toFixed(2);
});

// --- Virtual: resolved image per device ---
// Usage: banner.imageFor('mobile') | banner.imageFor('desktop')
bannerSchema.methods.imageFor = function(screen = 'mobile') {
  const { mobile, tablet, desktop } = this.images;
  if (screen === 'desktop') return desktop || mobile;
  if (screen === 'tablet') return tablet || mobile;
  return mobile;
};

// FIX: use next() — old middleware pattern needs it
bannerSchema.pre('save', async function(next) {
  if (this.endDate && this.endDate < new Date()) {
    this.isActive = false;
  }
  next();
});

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;