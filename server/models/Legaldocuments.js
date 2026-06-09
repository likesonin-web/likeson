import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Constants ──────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'terms_and_conditions',
  'privacy_policy',
  'refund_policy',
  'cookie_policy',
  'disclaimer',
];

export const DOCUMENT_STATUS = ['draft', 'active', 'archived', 'superseded'];

export const PLATFORMS = ['web', 'android', 'ios', 'all'];

export const AUDIENCE_TYPES = [
  'customer',
  'doctor',
  'hospital',
  'driver',
  'solodriverpartner',
  'transportpartner',
  'pharmacy',
  'care_assistant',
  'lab_partner',
  'blood_bank',
  'all',
];

export const CONSENT_METHODS = ['checkbox', 'click', 'scroll', 'api'];

// ── Sub-Schemas ────────────────────────────────────────────────────────────────

/** One section / clause inside the document */
const sectionSchema = new Schema(
  {
    sectionId: { type: String, required: true },   // e.g. "data-collection", "refund-timeline"
    title:     { type: String, required: true },
    body:      { type: String, required: true },   // HTML or Markdown
    order:     { type: Number, default: 0 },
    isKey:     { type: Boolean, default: false },  // highlight important clause (GDPR, DPDP etc.)
  },
  { _id: true }
);

/** Snapshot kept every time a new version goes live */
const versionHistorySchema = new Schema(
  {
    version:      { type: String, required: true },   // "1.0", "1.1"
    effectiveDate:{ type: Date,   required: true },
    archivedBy:   { type: Schema.Types.ObjectId, ref: 'User' },
    changeSummary:{ type: String },                   // "Added DPDP 2023 data rights clause"
    snapshotText: { type: String },                   // full plain text at that version
  },
  { _id: true, timestamps: true }
);

/** Per-user consent record — stored inside document (capped at 10k, else use separate collection) */
const consentSchema = new Schema(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    version:     { type: String, required: true },
    consentedAt: { type: Date, default: Date.now },
    ipAddress:   { type: String },
    userAgent:   { type: String },
    platform:    { type: String, enum: PLATFORMS, default: 'web' },
    method:      { type: String, enum: CONSENT_METHODS, default: 'checkbox' },
    isWithdrawn: { type: Boolean, default: false },
    withdrawnAt: { type: Date },
    // Geo — India-first (state + city enough)
    state:       { type: String },
    city:        { type: String },
  },
  { _id: true, timestamps: true }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const legalDocumentSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    documentType: {
      type:     String,
      required: true,
      enum:     DOCUMENT_TYPES,
      index:    true,
    },
    slug: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
      lowercase:true,
    },                                                  // "privacy-policy", "terms-and-conditions"
    title:    { type: String, required: true, trim: true },
    subtitle: { type: String },

    // ── Version ───────────────────────────────────────────────────────────────
    currentVersion: { type: String, required: true, default: '1.0' },
    effectiveDate:  { type: Date,   required: true },
    lastReviewedAt: { type: Date },
    nextReviewDue:  { type: Date },                     // set 12 months ahead on publish
    versionHistory: { type: [versionHistorySchema], default: [] },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    DOCUMENT_STATUS,
      default: 'draft',
      index:   true,
    },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },

    // ── Content ───────────────────────────────────────────────────────────────
    sections:  { type: [sectionSchema], default: [] },
    fullText:  { type: String },                        // plain text — full-text search
    fullHtml:  { type: String },                        // rendered HTML for frontend
    summary:   { type: String },                        // 2-3 sentence plain-language summary
    keyPoints: [{ type: String }],                      // bullet highlights shown on onboarding

    // ── Audience & Platform ───────────────────────────────────────────────────
    platform:     { type: String, enum: PLATFORMS,      default: 'all' },
    audienceType: { type: String, enum: AUDIENCE_TYPES, default: 'all' },

    // ── Jurisdiction (India-first, Likeson based in AP) ───────────────────────
    governingLaw:  { type: String, default: 'India' },
    jurisdiction:  { type: String, default: 'Andhra Pradesh, India' },
    complianceStandards: [{ type: String }],            // ["DPDP", "IT_ACT_2000", "HIPAA_LIKE"]
    dataProtectionOfficer: {
      name:  { type: String },
      email: { type: String },
      phone: { type: String },
    },

    // ── Privacy-specific fields (used when documentType = 'privacy_policy') ──
    dataCollected: {
      personalData:  [{ type: String }],                // ["name","email","phone","dob"]
      sensitiveData: [{ type: String }],                // ["health_records","prescriptions","diagnostics"]
      financialData: [{ type: String }],                // ["upi_id","card_last4"]
      locationData:  { type: Boolean, default: false }, // GPS for transport tracking
      deviceData:    { type: Boolean, default: false },
      biometricData: { type: Boolean, default: false },
      cookies:       { type: Boolean, default: true },
    },
    dataPurpose:   [{ type: String }],                  // ["service_delivery","analytics","reminders"]
    dataRetention: { type: String },                    // "3 years after account deletion"
    dataSharing: {
      thirdParties:         [{ type: String }],         // ["hospitals","labs","payment_gateways","transport_partners"]
      crossBorderTransfer:  { type: Boolean, default: false },
      soldToThirdParties:   { type: Boolean, default: false },
    },
    userRights: [{ type: String }],                     // ["access","rectify","delete","portability","grievance"]

    // ── Refund-specific fields (used when documentType = 'refund_policy') ─────
    refundRules: {
      fullRefundWindowHours:    { type: Number, default: 24 },    // cancel > 24h → 100% refund
      partialRefundPercent:     { type: Number, default: 50 },    // cancel within window → 50%
      noRefundOnceDriverStarts: { type: Boolean, default: true },
      doubleChargeFullRefund:   { type: Boolean, default: true },
      processingDaysMin:        { type: Number, default: 5 },
      processingDaysMax:        { type: Number, default: 12 },
      refundMethods:            [{ type: String }],               // ["upi","credit_card","debit_card"]
    },

    // ── T&C-specific fields (used when documentType = 'terms_and_conditions') ─
    minAge:                  { type: Number, default: 18 },
    requiresParentalConsent: { type: Boolean, default: false },
    disputeResolution:       { type: String, default: 'Arbitration, Andhra Pradesh courts' },

    // ── Consent Tracking ──────────────────────────────────────────────────────
    requiresExplicitConsent: { type: Boolean, default: true },
    consentMethod:           { type: String, enum: CONSENT_METHODS, default: 'checkbox' },
    totalConsents:           { type: Number, default: 0, min: 0 },
    consents:                { type: [consentSchema], default: [] },

    // ── Notifications on update ───────────────────────────────────────────────
    notifyUsersOnUpdate:   { type: Boolean, default: true },
    notificationChannels:  [{ type: String }],          // ["sms","email","push","whatsapp"]
    notificationSentAt:    { type: Date },

    // ── Display / SEO ─────────────────────────────────────────────────────────
    metaTitle:       { type: String },
    metaDescription: { type: String },
    pdfUrl:          { type: String },                  // S3/CDN downloadable PDF
    showInFooter:    { type: Boolean, default: true },
    showInOnboarding:{ type: Boolean, default: false }, // shown during signup flow
    displayOrder:    { type: Number,  default: 0 },

    // ── Authoring & Approval ──────────────────────────────────────────────────
    createdBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:       { type: Date },
    legalReviewedBy:  { type: String },                 // external counsel / CA name
    legalReviewedAt:  { type: Date },

    // ── Integrity ─────────────────────────────────────────────────────────────
    checksumSha256: { type: String },                   // SHA-256 of fullText — tamper detection

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps:  true,
    toJSON:      { virtuals: true },
    toObject:    { virtuals: true },
    collection:  'legal_documents',
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────────

legalDocumentSchema.index({ documentType: 1, status: 1, isPublished: 1 });
legalDocumentSchema.index({ documentType: 1, effectiveDate: -1 });
legalDocumentSchema.index({ 'consents.userId': 1 });
legalDocumentSchema.index({ isDeleted: 1, status: 1 });
legalDocumentSchema.index({ fullText: 'text', title: 'text' });  // full-text search

// ── Virtuals ───────────────────────────────────────────────────────────────────

/** True if doc is live and not deleted */
legalDocumentSchema.virtual('isActive').get(function () {
  return this.isPublished && this.status === 'active' && !this.isDeleted;
});

/** Count of active (non-withdrawn) consents */
legalDocumentSchema.virtual('activeConsentCount').get(function () {
  return this.consents.filter((c) => !c.isWithdrawn).length;
});

// ── Statics ────────────────────────────────────────────────────────────────────

/**
 * Get the current live document by type.
 * Usage: LegalDocument.getActive('privacy_policy')
 */
legalDocumentSchema.statics.getActive = function (documentType) {
  return this.findOne({
    documentType,
    isPublished: true,
    status:      'active',
    isDeleted:   false,
  }).sort({ effectiveDate: -1 });
};

/**
 * Check if a specific user has consented to latest version.
 * Usage: LegalDocument.hasUserConsented(docId, userId, '2.0')
 */
legalDocumentSchema.statics.hasUserConsented = async function (docId, userId, version) {
  const doc = await this.findById(docId).select('consents');
  if (!doc) return false;
  return doc.consents.some(
    (c) => c.userId.equals(userId) && c.version === version && !c.isWithdrawn
  );
};

// ── Methods ────────────────────────────────────────────────────────────────────

/**
 * Archive current version before pushing a new one.
 * Call before updating currentVersion + sections.
 */
legalDocumentSchema.methods.archiveCurrentVersion = function (adminUserId) {
  this.versionHistory.push({
    version:       this.currentVersion,
    effectiveDate: this.effectiveDate,
    archivedBy:    adminUserId,
    snapshotText:  this.fullText,
    changeSummary: `Archived before version update`,
  });
};

/**
 * Record user consent.
 * @param {Object} data - { userId, version, ipAddress, userAgent, platform, method, state, city }
 */
legalDocumentSchema.methods.recordConsent = async function (data) {
  // Remove previous consent record for same user+version if exists (re-accept case)
  this.consents = this.consents.filter(
    (c) => !(c.userId.equals(data.userId) && c.version === data.version)
  );
  this.consents.push(data);
  this.totalConsents += 1;
  return this.save();
};

/**
 * Withdraw user consent (DPDP / GDPR right to withdraw).
 * @param {ObjectId} userId
 * @param {String} version
 */
legalDocumentSchema.methods.withdrawConsent = async function (userId, version) {
  const consent = this.consents.find(
    (c) => c.userId.equals(userId) && c.version === version && !c.isWithdrawn
  );
  if (!consent) throw new Error('Active consent not found');
  consent.isWithdrawn = true;
  consent.withdrawnAt = new Date();
  return this.save();
};

// ── Pre-save ──────────────────────────────────────────────────────────────────

legalDocumentSchema.pre('save', function (next) {
  // Auto-set publishedAt when first published
  if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Auto-set nextReviewDue = effectiveDate + 12 months (if not manually set)
  if (this.isModified('effectiveDate') && !this.nextReviewDue) {
    const d = new Date(this.effectiveDate);
    d.setFullYear(d.getFullYear() + 1);
    this.nextReviewDue = d;
  }

  // Auto-order sections by their order field
  if (this.isModified('sections')) {
    this.sections.sort((a, b) => a.order - b.order);
  }

  next();
});

// ── Model ─────────────────────────────────────────────────────────────────────

const LegalDocument = mongoose.model('LegalDocument', legalDocumentSchema);
export default LegalDocument;