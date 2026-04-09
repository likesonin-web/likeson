import mongoose from "mongoose";
const { Schema } = mongoose;

const advertisementSchema = new Schema({
  advertiser: {
    name: { type: String, trim: true, required: true },
    type: { type: String, enum: ['Internal', 'External_Partner'], required: true },
    campaignId: { type: Schema.Types.ObjectId, index: true } 
  },
  
  adContent: {
    headline: { type: String, required: true },
    subHeadline: { type: String },
    mediaUrl: { type: String, required: true }, 
    mediaType: { type: String, enum: ['Image', 'Video', 'Gif'], default: 'Image' },
    ctaText: { type: String, default: 'Learn More' },
    landingPageUrl: { type: String, required: true }
  },

  placement: {
    page: { 
      type: String, 
      enum: ['Global', 'Search_Results', 'Medicine_Store', 'Ride_Tracking_Screen'],
      index: true,
      required: true
    },
    slot: { 
      type: String, 
      enum: ['Popup', 'Native_Feed', 'Sticky_Bottom', 'Hero_Banner'],
      required: true 
    },
    priority: { type: Number, default: 1, min: 1, max: 10 }
  },

  targeting: {
    deviceType: [{ type: String, enum: ['iOS', 'Android', 'Web'] }],
    userSegments: [{ type: String }],
    // Removed geo-index to fix the "unable to find index" error
    locationName: { type: String } 
  },

  schedule: {
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date }, 
    displayHours: [Number],
    frequencyCap: {
      limit: { type: Number, default: 3 },
      windowHours: { type: Number, default: 24 }
    }
  },

  pricingModel: { type: String, enum: ['CPC', 'CPM', 'CPA', 'Fixed_Weekly'], required: true },
  budget: {
    totalMax: { type: Number, required: true },
    dailyMax: { type: Number },
    currentSpend: { type: Number, default: 0 }
  },
  
  analytics: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    lastEventAt: Date
  },

  status: { 
    type: String, 
    enum: ['Draft', 'Active', 'Paused', 'Archived', 'Depleted'], 
    default: 'Active' 
  },

  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" }

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for Click-Through Rate
advertisementSchema.virtual('ctr').get(function() {
  if (this.analytics.views === 0) return 0;
  return (this.analytics.clicks / this.analytics.views) * 100;
});

// Auto-check budget on save
advertisementSchema.pre('save', function(next) {
  if (this.budget.currentSpend >= this.budget.totalMax) {
    this.status = 'Depleted';
  }
  next();
});

const Advertisement = mongoose.model('Advertisement', advertisementSchema);
export default Advertisement;