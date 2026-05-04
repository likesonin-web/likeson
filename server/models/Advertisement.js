import mongoose from "mongoose";
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// FIX 7: displayHours validator — enforce 0–23 bounds
// ─────────────────────────────────────────────────────────────────────────────
const hourValidator = {
  validator: (v) => Number.isInteger(v) && v >= 0 && v <= 23,
  message: (props) => `${props.value} is not a valid hour (must be 0–23)`,
};

const advertisementSchema = new Schema(
  {
    advertiser: {
      name:       { type: String, trim: true, required: true },
      type:       { type: String, enum: ["Internal", "External_Partner"], required: true },
      campaignId: { type: Schema.Types.ObjectId, index: true },
    },

    adContent: {
      headline:      { type: String, required: true },
      subHeadline:   { type: String },
      mediaUrl:      { type: String, required: true },
      mediaType:     { type: String, enum: ["Image", "Video", "Gif"], default: "Image" },
      ctaText:       { type: String, default: "Learn More" },
      landingPageUrl:{ type: String, required: true },
    },

    placement: {
      page: {
        type:     String,
        enum:     ["Global", "Search_Results", "Medicine_Store", "Ride_Tracking_Screen"],
        index:    true,
        required: true,
      },
      slot: {
        type:     String,
        enum:     ["Popup", "Native_Feed", "Sticky_Bottom", "Hero_Banner"],
        required: true,
      },
      priority: { type: Number, default: 1, min: 1, max: 10 },
    },

    targeting: {
      deviceType:   [{ type: String, enum: ["iOS", "Android", "Web"] }],
      userSegments: [{ type: String }],

      // FIX 1: Restored location + radiusInKm — backend & frontend both depend on these.
      //        Using legacy GeoJSON Point (2dsphere index declared below).
      location: {
        type:        { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
      radiusInKm: { type: Number, default: 5 },
    },

    schedule: {
      startDate: { type: Date, default: Date.now },
      endDate:   { type: Date },
      // FIX 7: each hour validated 0–23
      displayHours: [{ type: Number, validate: hourValidator }],
      frequencyCap: {
        limit:       { type: Number, default: 3 },
        windowHours: { type: Number, default: 24 },
      },
    },

    // FIX 4: Added default so API callers without pricingModel don't get raw 500
    pricingModel: {
      type:     String,
      enum:     ["CPC", "CPM", "CPA", "Fixed_Weekly"],
      required: true,
      default:  "CPC",
    },

    budget: {
      totalMax:     { type: Number, required: true },
      dailyMax:     { type: Number },
      currentSpend: { type: Number, default: 0 },
    },

    analytics: {
      views:       { type: Number, default: 0 },
      clicks:      { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      lastEventAt: Date,
    },

    // FIX 6: Added index on status — primary filter in /serve hot path
    status: {
      type:    String,
      enum:    ["Draft", "Active", "Paused", "Archived", "Depleted"],
      default: "Active",
      index:   true,
    },

    // FIX 2: createdBy not required at schema level — route injects it server-side.
    //        Keeps validation safe regardless of middleware order.
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 (cont): 2dsphere index for geo queries on targeting.location
// ─────────────────────────────────────────────────────────────────────────────
advertisementSchema.index({ "targeting.location": "2dsphere" });

// Compound index for the /serve hot path
advertisementSchema.index({ status: 1, "placement.page": 1, "placement.slot": 1 });

// ─────────────────────────────────────────────────────────────────────────────
// FIX 8: Virtual CTR — null-safe guard on analytics subdoc
// ─────────────────────────────────────────────────────────────────────────────
advertisementSchema.virtual("ctr").get(function () {
  const views = this.analytics?.views ?? 0;
  const clicks = this.analytics?.clicks ?? 0;
  if (views === 0) return 0;
  return (clicks / views) * 100;
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5: Validate `type` param before it reaches $inc in the route.
//        Exported for use in ads.routes.js → router.patch('/:id/track')
// ─────────────────────────────────────────────────────────────────────────────
export const VALID_TRACK_TYPES = ["click", "view"];

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: pre('save') depletion check — skip auto-deplete when admin is
//        intentionally raising totalMax or manually changing status away from
//        Depleted. Only auto-deplete when spend actually hits the cap AND the
//        status is currently Active (not a manual override).
// ─────────────────────────────────────────────────────────────────────────────
advertisementSchema.pre("save", function (next) {
  const spendHitCap =
    this.budget.currentSpend != null &&
    this.budget.totalMax != null &&
    this.budget.currentSpend >= this.budget.totalMax;

  const isCurrentlyActive = this.status === "Active";

  // Only auto-deplete when:
  //   1. spend genuinely hit cap, AND
  //   2. ad is Active (admin manually setting status to Active/Paused/etc. is respected)
  //   3. The totalMax field itself wasn't just modified upward (reactivation path)
  const totalMaxRaised =
    this.isModified("budget.totalMax") &&
    this.budget.totalMax > (this._previousTotalMax ?? 0);

  if (spendHitCap && isCurrentlyActive && !totalMaxRaised) {
    this.status = "Depleted";
  }

  next();
});

// Track previous totalMax so pre-save can detect a raise
advertisementSchema.post("init", function () {
  this._previousTotalMax = this.budget?.totalMax ?? 0;
});

const Advertisement = mongoose.model("Advertisement", advertisementSchema);
export default Advertisement;