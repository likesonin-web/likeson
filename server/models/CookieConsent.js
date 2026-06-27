import mongoose from 'mongoose';
const { Schema } = mongoose;

const cookieConsentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    // Top-company pattern: granular categories
    preferences: {
      necessary:   { type: Boolean, default: true },   // always true, can't reject
      analytics:   { type: Boolean, default: false },
      marketing:   { type: Boolean, default: false },
      functional:  { type: Boolean, default: false },
    },

    // Audit trail (GDPR needs this)
    consentGiven:  { type: Boolean, default: false },
    consentAt:     { type: Date },
    updatedAt:     { type: Date },
    ipAddress:     { type: String },
    userAgent:     { type: String },
    version:       { type: String, default: '1.0' }, // bump when policy changes → forces re-consent
  },
  { timestamps: true }
);

export default mongoose.model('CookieConsent', cookieConsentSchema);