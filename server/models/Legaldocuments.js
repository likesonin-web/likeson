import mongoose from 'mongoose';

const { Schema } = mongoose;

// ─────────────────────────────────────────────
// SHARED SUB-SCHEMAS
// ─────────────────────────────────────────────

const ROLES = [
  'superadmin', 'admin', 'doctor', 'transportpartner',
  'driver', 'lab partner', 'customer', 'finance',
  'pharmacy', 'care assistant'
];

const roleOverrideSchema = new Schema(
  {
    role: { type: String, enum: ROLES, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const versionHistorySchema = new Schema(
  {
    version: { type: String, required: true },
    content: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changeLog: { type: String },
  },
  { _id: false }
);


// ─────────────────────────────────────────────
// 1. TERMS & CONDITIONS
// ─────────────────────────────────────────────

const termsAndConditionsSchema = new Schema(
  {
    version: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: 'Terms and Conditions', trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    content: { type: String, required: [true, 'Terms content is required'] },
    summary: { type: String },
    roleSpecificClauses: [roleOverrideSchema],

    isActive: { type: Boolean, default: false, index: true },
    effectiveDate: { type: Date, required: true, index: true },
    expiresAt: { type: Date },
    requiresReAcceptance: { type: Boolean, default: false },
    applicableRoles: { type: [String], default: [], enum: ROLES },

    previousVersions: [versionHistorySchema],
    changeLog: { type: String },

    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Enforce only one active document at a time
termsAndConditionsSchema.pre('save', async function () {
  if (this.isModified('isActive') && this.isActive) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { $set: { isActive: false } }
    );
    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  }
});

termsAndConditionsSchema.index({ isActive: 1, effectiveDate: -1 });

const TermsAndConditions = mongoose.model('TermsAndConditions', termsAndConditionsSchema);


// ─────────────────────────────────────────────
// 2. PRIVACY POLICY
// ─────────────────────────────────────────────

const privacyPolicySchema = new Schema(
  {
    version: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: 'Privacy Policy', trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    content: { type: String, required: [true, 'Privacy policy content is required'] },
    summary: { type: String },
    roleSpecificClauses: [roleOverrideSchema],

    dataCollected: [
      {
        category: { type: String },           // e.g. "Location", "Health", "Financial"
        description: { type: String },
        purpose: { type: String },
        retentionPeriod: { type: String },    // e.g. "2 years"
        sharedWith: [{ type: String }],       // e.g. ["Payment Gateway"]
        appliesTo: [{ type: String }],        // Roles this applies to
      }
    ],

    complianceFrameworks: {
      type: [String],
      default: [],
      enum: ['GDPR', 'HIPAA', 'PDPA', 'CCPA', 'PIPEDA', 'Other'],
    },
    dataRetentionPolicy: { type: String },
    cookiePolicy: { type: String },
    thirdPartySharing: { type: Boolean, default: false },
    geolocationTracking: { type: Boolean, default: false },

    isActive: { type: Boolean, default: false, index: true },
    effectiveDate: { type: Date, required: true, index: true },
    expiresAt: { type: Date },
    requiresReAcceptance: { type: Boolean, default: false },
    applicableRoles: { type: [String], default: [], enum: ROLES },

    previousVersions: [versionHistorySchema],
    changeLog: { type: String },

    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Enforce only one active document at a time
privacyPolicySchema.pre('save', async function () {
  if (this.isModified('isActive') && this.isActive) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { $set: { isActive: false } }
    );
    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  }
});

privacyPolicySchema.index({ isActive: 1, effectiveDate: -1 });

const PrivacyPolicy = mongoose.model('PrivacyPolicy', privacyPolicySchema);


// ─────────────────────────────────────────────
// 3. USER CONSENT (Audit Log)
// ─────────────────────────────────────────────

/**
 * @desc Immutable legal proof of user acceptance.
 *       Never delete records — only mark withdrawals.
 */
const userConsentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userRole: { type: String }, // Snapshot of role at time of consent

    termsVersion: { type: Schema.Types.ObjectId, ref: 'TermsAndConditions', index: true },
    termsVersionNumber: { type: String },

    privacyPolicyVersion: { type: Schema.Types.ObjectId, ref: 'PrivacyPolicy', index: true },
    privacyPolicyVersionNumber: { type: String },

    method: {
      type: String,
      required: true,
      enum: ['explicit_checkbox', 'registration', 'forced_update', 'api', 'google_oauth'],
    },
    platform: { type: String, required: true, enum: ['web', 'android', 'ios'] },

    ipAddress: { type: String },
    userAgent: { type: String },
    deviceName: { type: String },

    acceptedAt: { type: Date, default: Date.now, required: true, index: true },

    // GDPR: Right to Withdraw
    isWithdrawn: { type: Boolean, default: false },
    withdrawnAt: { type: Date },
    withdrawalReason: { type: String },
  },
  { timestamps: true }
);

userConsentSchema.index({ user: 1, termsVersion: 1 });
userConsentSchema.index({ user: 1, privacyPolicyVersion: 1 });
userConsentSchema.index({ user: 1, acceptedAt: -1 });

const UserConsent = mongoose.model('UserConsent', userConsentSchema);


export { TermsAndConditions, PrivacyPolicy, UserConsent };