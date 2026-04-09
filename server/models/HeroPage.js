import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Sub-schemas ────────────────────────────────────────────────────────────────

/**
 * @desc A single CTA (Call-To-Action) button on the hero section
 */
const ctaButtonSchema = new Schema(
  {
    label:    { type: String, required: true, trim: true },
    href:     { type: String, required: true, trim: true },
    variant:  { type: String, enum: ['primary', 'secondary', 'outline', 'ghost'], default: 'primary' },
    isExternal: { type: Boolean, default: false },
    order:    { type: Number, default: 0 }, // display order (ascending)
  },
  { _id: true }
);

/**
 * @desc A media asset (image / video) used in the hero section
 */
const heroMediaSchema = new Schema(
  {
    type:    { type: String, enum: ['image', 'video', 'lottie'], default: 'image' },
    url:     { type: String, required: true, trim: true },
    altText: { type: String, trim: true, default: '' },
    /** For video: optional poster/thumbnail */
    poster:  { type: String, trim: true },
    /** Width × Height in px — used for aspect-ratio hints in the front-end */
    width:   { type: Number },
    height:  { type: Number },
  },
  { _id: true }
);

/**
 * @desc Optional badge / pill shown above the headline (e.g. "🎉 New Feature")
 */
const heroBadgeSchema = new Schema(
  {
    text:  { type: String, required: true, trim: true },
    icon:  { type: String, trim: true },   // emoji or icon class / URL
    color: { type: String, default: '#ffffff' },
    bgColor: { type: String, default: '#3B82F6' },
  },
  { _id: false }
);

// ── Main schema ────────────────────────────────────────────────────────────────

const heroPageSchema = new Schema(
  {
     

   
    internalName: { type: String, required: true, trim: true },

    // ── Content ────────────────────────────────────────────────────────────────
    badge:    { type: heroBadgeSchema, default: null },

    headline:    { type: String, required: true, trim: true },
    /** Optional highlighted / coloured part of the headline */
    highlightedText: { type: String, trim: true },

    subheadline: { type: String, trim: true },
    description: { type: String, trim: true },

    ctaButtons: { type: [ctaButtonSchema], default: [] },

    media: { type: heroMediaSchema, default: null },

    isActive:   { type: Boolean, default: true, index: true },
    /** Schedule: only show between these dates (null = no restriction) */
    activeFrom: { type: Date, default: null },
    activeTo:   { type: Date, default: null },

    /** Display priority when multiple active heroes share a slug prefix */
    priority: { type: Number, default: 0 },

    // ── SEO / analytics ────────────────────────────────────────────────────────
    seo: {
      metaTitle:       { type: String, trim: true },
      metaDescription: { type: String, trim: true },
      ogImage:         { type: String, trim: true },
    },

    analyticsTag: { type: String, trim: true }, // e.g. GA event label

    // ── Audit ──────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the hero section is currently visible based on
 * isActive, activeFrom, and activeTo — no DB query needed.
 */
heroPageSchema.virtual('isCurrentlyVisible').get(function () {
  if (!this.isActive) return false;
  const now = new Date();
  if (this.activeFrom && this.activeFrom > now) return false;
  if (this.activeTo   && this.activeTo   < now) return false;
  return true;
});

// ── Pre-save middleware ───────────────────────────────────────────────────────

heroPageSchema.pre('save', async function () {
  // Auto-deactivate if the schedule has already expired
  if (this.activeTo && this.activeTo < new Date()) {
    this.isActive = false;
  }
 
});

// ── Indexes ───────────────────────────────────────────────────────────────────

heroPageSchema.index({ isActive: 1 });
heroPageSchema.index({ targetRoles: 1, isActive: 1 });
heroPageSchema.index({ activeFrom: 1, activeTo: 1 });
heroPageSchema.index({ priority: -1 });

const HeroPage = mongoose.model('HeroPage', heroPageSchema);
export default HeroPage;