/**
 * consultation.model.js
 *
 * TELEMEDICINE CONSULTATION MODEL
 * Video / Audio consultations via Agora
 * Optimized for MongoDB (Unbounded arrays extracted)
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ══════════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

export const CONSULTATION_STATUSES = [
  'created',
  'scheduled',
  'waiting',
  'active',
  'paused',
  'reconnecting',
  'completed',
  'cancelled',
  'failed',
  'expired',
];

export const CONSULTATION_TYPES = [
  'video',
  'audio',
];

export const CONSULTATION_MODES = [
  'scheduled',
  'instant',
  'follow_up',
  'emergency',
];

export const CONSULTATION_STAGES = [
  'pre_consultation',
  'waiting_room',
  'in_progress',
  'prescription_phase',
  'post_consultation',
  'closed',
];

export const PRIORITY_LEVELS = [
  'routine',
  'urgent',
  'emergency',
  'critical',
];

export const PARTICIPANT_ROLES = [
  'doctor',
  'patient',
  'care_assistant',
  'family_member',
  'admin',
];

export const CONSENT_TYPES = [
  'telemedicine',
  'prescription',
];

export const ATTACHMENT_TYPES = [
  'prescription',
  'lab_report',
  'xray',
  'scan',
  'insurance',
  'medical_document',
  'image',
  'video',
];

export const CANCELLATION_ACTORS = [
  'patient',
  'doctor',
  'hospital',
  'care_assistant',
  'admin',
  'system',
];

export const END_ACTORS = [
  'doctor',
  'patient',
  'admin',
  'system',
];

export const COMPLETION_STATUSES = [
  'not_started',
  'in_progress',
  'completed_with_prescription',
  'completed_without_prescription',
  'incomplete',
  'abandoned',
];

export const NETWORK_QUALITY_LEVELS = [
  'excellent',
  'good',
  'fair',
  'poor',
  'disconnected',
];

export const WAITING_ROOM_STATUSES = [
  'waiting',
  'approved',
  'rejected',
  'admitted',
  'timed_out',
];

// ══════════════════════════════════════════════════════════════════════════════
// SUB-SCHEMAS (Safe to Embed - Strictly Bounded)
// ══════════════════════════════════════════════════════════════════════════════

// ── Agora SDK Configuration ───────────────────────────────────────────────────
const sdkConfigurationSchema = new Schema(
  {
    quality:                  { type: String, enum: ['low', 'medium', 'high', 'hd', 'auto'], default: 'auto' },
    codec:                    { type: String, enum: ['VP8', 'VP9', 'H264'], default: 'H264' },
    micEnabled:               { type: Boolean, default: true },
    cameraEnabled:            { type: Boolean, default: true },
    screenShareEnabled:       { type: Boolean, default: false },
    noiseSuppressionEnabled:  { type: Boolean, default: true },
    echoCancellationEnabled:  { type: Boolean, default: true },
    autoGainControlEnabled:   { type: Boolean, default: true },
    maxVideoResolution:       { type: String, default: '720p' },
    maxFrameRate:             { type: Number, default: 30 },
  },
  { _id: false }
);

// ── Participant ───────────────────────────────────────────────────────────────
const participantSchema = new Schema(
  {
    participantId:    { type: String, trim: true, required: true },
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:             { type: String, enum: PARTICIPANT_ROLES, required: true },
    displayName:      { type: String, trim: true },
    joinedAt:         { type: Date },
    leftAt:           { type: Date },
    totalDurationMinutes: { type: Number, default: 0, min: 0 },

    connectionStatus: { type: String, enum: ['connected', 'reconnecting', 'disconnected', 'never_joined'], default: 'never_joined' },
    deviceType:       { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
    browser:          { type: String, trim: true },
    operatingSystem:  { type: String, trim: true },
    ipAddress:        { type: String, select: false },

    cameraEnabled:     { type: Boolean, default: true },
    microphoneEnabled: { type: Boolean, default: true },
    screenSharing:     { type: Boolean, default: false },
    handRaised:        { type: Boolean, default: false },
    isMutedByHost:     { type: Boolean, default: false },
    speakingDuration:  { type: Number, default: 0 }, 
    reconnectCount:    { type: Number, default: 0, min: 0 },
    lastActiveAt:      { type: Date },

    networkQuality: { type: String, enum: NETWORK_QUALITY_LEVELS, default: 'excellent' },
    audioQuality:   { type: String, enum: NETWORK_QUALITY_LEVELS, default: 'excellent' },
    videoQuality:   { type: String, enum: NETWORK_QUALITY_LEVELS, default: 'excellent' },

    waitingRoomStatus: { type: String, enum: WAITING_ROOM_STATUSES, default: 'waiting' },

    permissions: {
      canMute:        { type: Boolean, default: false },
      canKick:        { type: Boolean, default: false },
      canShareScreen: { type: Boolean, default: true },
      canPrescribe:   { type: Boolean, default: false },
    },
  },
  { _id: true, timestamps: false }
);

// ── Waiting Room ──────────────────────────────────────────────────────────────
const waitingRoomEntrySchema = new Schema(
  {
    userId:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:              { type: String, enum: PARTICIPANT_ROLES },
    displayName:       { type: String, trim: true },
    enteredAt:         { type: Date, default: Date.now },
    approvedAt:        { type: Date },
    approvedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:        { type: Date },
    rejectionReason:   { type: String, trim: true },
    queuePosition:     { type: Number, min: 1 },
    waitingRoomStatus: { type: String, enum: WAITING_ROOM_STATUSES, default: 'waiting' },
  },
  { _id: true }
);

// ── File Attachments ──────────────────────────────────────────────────────────
const fileAttachmentSchema = new Schema(
  {
    uploadedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploaderRole:   { type: String, enum: PARTICIPANT_ROLES },
    attachmentType: { type: String, enum: ATTACHMENT_TYPES, required: true },
    fileName:       { type: String, trim: true, required: true },
    mimeType:       { type: String, trim: true },
    fileSize:       { type: Number, min: 0 },
    storageUrl:     { type: String, trim: true, select: false },
    thumbnailUrl:   { type: String, trim: true },
    encrypted:      { type: Boolean, default: true },
    uploadedAt:     { type: Date, default: Date.now },
    accessLevel:    { type: String, enum: ['private', 'doctor_only', 'patient_only', 'shared', 'admin'], default: 'shared' },
    description:    { type: String, trim: true, maxlength: 500 },
    isDeleted:      { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Consent ───────────────────────────────────────────────────────────────────
const consentSchema = new Schema(
  {
    consentType:      { type: String, enum: CONSENT_TYPES, required: true },
    accepted:         { type: Boolean, required: true },
    acceptedAt:       { type: Date },
    ipAddress:        { type: String, select: false },
    userAgent:        { type: String, select: false },
    consentVersion:   { type: String, trim: true, default: '1.0' },
    digitalSignature: { type: String, trim: true, select: false },
    geoLocation: {
      lat:  { type: Number },
      long: { type: Number },
    },
    revokedAt: { type: Date },
    isRevoked: { type: Boolean, default: false },
  },
  { _id: true }
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN CONSULTATION SCHEMA
// ══════════════════════════════════════════════════════════════════════════════

const consultationSchema = new Schema(
  {
    // ── SECTION 1: CORE DETAILS ───────────────────────────────────────────────
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    patient:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor:    { type: Schema.Types.ObjectId, ref: 'DoctorProfile', required: true, index: true },
    hospital:  { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    careAssistant: { type: Schema.Types.ObjectId, ref: 'CareAssistantProfile', default: null },

    consultationType: { type: String, enum: CONSULTATION_TYPES, required: true, index: true },
    consultationMode: { type: String, enum: CONSULTATION_MODES, default: 'scheduled' },
    specialty:        { type: String, trim: true, index: true },
    language:         { type: String, trim: true, default: 'English' },

    symptoms:           [{ type: String, trim: true }],
    chiefComplaint:     { type: String, trim: true, maxlength: 2000 },
    consultationReason: { type: String, trim: true, maxlength: 2000 },
    diagnosisSummary:   { type: String, trim: true, maxlength: 5000 },
    treatmentPlan:      { type: String, trim: true, maxlength: 5000 },
    followUpAdvice:     { type: String, trim: true, maxlength: 2000 },
    tags:               [{ type: String, trim: true, lowercase: true }],

    doctorInternalNotes: { type: String, trim: true, maxlength: 10000, select: false },
    metadata: { type: Schema.Types.Mixed },

    // ── SECTION 2: STATUS SYSTEM ──────────────────────────────────────────────
    status:            { type: String, enum: CONSULTATION_STATUSES, default: 'created', index: true },
    priority:          { type: String, enum: PRIORITY_LEVELS, default: 'routine', index: true },
    consultationStage: { type: String, enum: CONSULTATION_STAGES, default: 'pre_consultation' },
    completionStatus:  { type: String, enum: COMPLETION_STATUSES, default: 'not_started' },

    cancelledBy:        { type: String, enum: CANCELLATION_ACTORS },
    cancelledByUserId:  { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    cancelledAt:        { type: Date },

    endedBy:           { type: String, enum: END_ACTORS },
    endedByUserId:     { type: Schema.Types.ObjectId, ref: 'User' },
    endedReason:       { type: String, trim: true, maxlength: 1000 },
    autoEndedBySystem: { type: Boolean, default: false },

    failedReason: { type: String, trim: true, maxlength: 1000 },
    failureCode:  { type: String, trim: true },

    statusLog: [
      {
        fromStatus: { type: String },
        toStatus:   { type: String, required: true },
        changedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
        reason:     { type: String, trim: true },
        changedAt:  { type: Date, default: Date.now },
      },
    ],

    // ── SECTION 3: TIMING ─────────────────────────────────────────────────────
    scheduledStartTime:       { type: Date, required: true, index: true },
    scheduledEndTime:         { type: Date },
    actualStartTime:          { type: Date },
    actualEndTime:            { type: Date },
    estimatedDurationMinutes: { type: Number, default: 30, min: 1 },
    actualDurationMinutes:    { type: Number, default: 0, min: 0 },
    waitingDurationMinutes:   { type: Number, default: 0, min: 0 },
    timezone:                 { type: String, trim: true, default: 'Asia/Kolkata' },

    doctorJoinedAt:  { type: Date },
    patientJoinedAt: { type: Date },
    doctorLeftAt:    { type: Date },
    patientLeftAt:   { type: Date },
    expiresAt:       { type: Date, index: true },

    // ── SECTION 4: AGORA RTC MEETING ──────────────────────────────────────────
    provider: { type: String, enum: ['Agora'], default: 'Agora' },

    agoraAppId:       { type: String, trim: true, select: false },
    agoraChannelId:   { type: String, trim: true, index: true },
    hostToken:        { type: String, trim: true, select: false },
    participantToken: { type: String, trim: true, select: false },
    webhookSecret:    { type: String, trim: true, select: false },

    sdkConfiguration: { type: sdkConfigurationSchema, default: () => ({}) },

    region:         { type: String, trim: true, default: 'ap-southeast-1' }, 
    encryptionMode: { type: String, enum: ['none', 'E2EE', 'transport'], default: 'transport' },
    maxParticipants:{ type: Number, default: 5, min: 2 },

    waitingRoomEnabled:   { type: Boolean, default: true },
    screenShareEnabled:   { type: Boolean, default: true },
    transcriptionEnabled: { type: Boolean, default: false },
    e2eeEnabled:          { type: Boolean, default: false },

    roomStarted: { type: Boolean, default: false },
    roomEnded:   { type: Boolean, default: false },

    // ── SECTION 5: PARTICIPANTS & WAITING ROOM ───────────────────────────────
    participants:     { type: [participantSchema], default: [] },
    waitingRoomQueue: { type: [waitingRoomEntrySchema], default: [] },

    // ── SECTION 6: PRESCRIPTION & ATTACHMENTS ────────────────────────────────
    prescription: {
      type:    Schema.Types.ObjectId,
      ref:     'EPrescription',
      default: null,
      index:   true,
    },
    prescriptions: [
      {
        type: Schema.Types.ObjectId,
        ref:  'EPrescription',
      },
    ],
    prescriptionUploaded:   { type: Boolean, default: false },
    prescriptionUploadedAt: { type: Date },
    prescriptionCount:      { type: Number, default: 0, min: 0 }, 
    attachments:            { type: [fileAttachmentSchema], default: [] },

    // ── SECTION 7: CONSENT ───────────────────────────────────────────────────
    consents: { type: [consentSchema], default: [] },
    telemedicineConsentAccepted: { type: Boolean, default: false },

    // ── SECTION 8: AGGREGATED ANALYTICS (Raw logs in separate Collection) ────
    networkStats: {
      avgBandwidth:    { type: Number, default: 0 },
      avgLatency:      { type: Number, default: 0 },
      avgJitter:       { type: Number, default: 0 },
      avgPacketLoss:   { type: Number, default: 0 },
      totalReconnects: { type: Number, default: 0 },
      networkType:     { type: String, trim: true },
    },

    analytics: {
      averageLatency:          { type: Number, default: 0 },
      averageReconnects:       { type: Number, default: 0 },
      totalParticipants:       { type: Number, default: 0 },
      peakParticipants:        { type: Number, default: 0 },
      callDropCount:           { type: Number, default: 0 },
      consultationScore:       { type: Number, min: 0, max: 100 },
      patientSatisfactionScore:{ type: Number, min: 0, max: 5 },
      waitingRoomTime:         { type: Number, default: 0 },  
      doctorResponseTime:      { type: Number, default: 0 }, 
      callQualityScore:        { type: Number, min: 0, max: 5 },
    },

    // ── SECTION 9: FEEDBACK & AUDIT ─────────────────────────────────────────
    feedback: {
      patientRating:           { type: Number, min: 1, max: 5 },
      doctorRating:            { type: Number, min: 1, max: 5 },
      audioQualityRating:      { type: Number, min: 1, max: 5 },
      videoQualityRating:      { type: Number, min: 1, max: 5 },
      waitingExperienceRating: { type: Number, min: 1, max: 5 },
      appExperienceRating:     { type: Number, min: 1, max: 5 },
      review:                  { type: String, trim: true, maxlength: 2000 },
      wouldRecommend:          { type: Boolean },
      isPublic:                { type: Boolean, default: true },
      submittedAt:             { type: Date },
    },

    isRated:            { type: Boolean, default: false, index: true },
    createdBy:          { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:          { type: Schema.Types.ObjectId, ref: 'User' },
    internalAdminNotes: { type: String, trim: true, maxlength: 5000, select: false },
    isTestConsultation: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// VIRTUALS
// ══════════════════════════════════════════════════════════════════════════════

consultationSchema.virtual('isActive').get(function () {
  return ['waiting', 'active', 'paused', 'reconnecting'].includes(this.status);
});

consultationSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

consultationSchema.virtual('isCancelled').get(function () {
  return this.status === 'cancelled';
});

consultationSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

consultationSchema.virtual('durationDisplay').get(function () {
  const d = this.actualDurationMinutes || 0;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
});

consultationSchema.virtual('participantCount').get(function () {
  return this.participants?.length ?? 0;
});

consultationSchema.virtual('hasConsent').get(function () {
  return this.telemedicineConsentAccepted;
});

consultationSchema.virtual('doctorParticipant').get(function () {
  return this.participants?.find(p => p.role === 'doctor') ?? null;
});

consultationSchema.virtual('patientParticipant').get(function () {
  return this.participants?.find(p => p.role === 'patient') ?? null;
});

// Populate-friendly virtual for prescriptions
consultationSchema.virtual('prescriptionDetails', {
  ref:          'EPrescription',
  localField:   'prescription',
  foreignField: '_id',
  justOne:      true,
});

// ══════════════════════════════════════════════════════════════════════════════
// PRE-VALIDATE
// ══════════════════════════════════════════════════════════════════════════════

consultationSchema.pre('validate', function () {
  if (this.status === 'active' && !this.telemedicineConsentAccepted) {
    throw new Error('Telemedicine consent required before consultation can be active');
  }

  if (this.expiresAt && this.scheduledStartTime && this.expiresAt <= this.scheduledStartTime) {
    throw new Error('expiresAt must be after scheduledStartTime');
  }

  if (this.actualEndTime && this.actualStartTime && this.actualEndTime < this.actualStartTime) {
    throw new Error('actualEndTime cannot be before actualStartTime');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PRE-SAVE
// ══════════════════════════════════════════════════════════════════════════════

consultationSchema.pre('save', async function () {
  if (this.isNew && !this.expiresAt && this.scheduledStartTime) {
    const exp = new Date(this.scheduledStartTime);
    exp.setHours(exp.getHours() + 2);
    this.expiresAt = exp;
  }

  if (this.isModified('status') && !this.isNew) {
    const lastLog    = this.statusLog?.[this.statusLog.length - 1];
    const fromStatus = lastLog?.toStatus ?? null;
    this.statusLog.push({
      fromStatus,
      toStatus:  this.status,
      changedBy: this.updatedBy || null,
      changedAt: new Date(),
    });
  }

  if (this.actualStartTime && this.actualEndTime) {
    const diffMs = this.actualEndTime - this.actualStartTime;
    this.actualDurationMinutes = Math.round(diffMs / 60000);
  }

  if (this.isModified('status') && this.status === 'completed') {
    this.completionStatus  = this.prescriptionUploaded
      ? 'completed_with_prescription'
      : 'completed_without_prescription';
    this.consultationStage = 'post_consultation';
  }

  if (this.isModified('status') && this.status === 'active') {
    this.consultationStage = 'in_progress';
  }

  if (this.isModified('status') && this.status === 'waiting') {
    this.consultationStage = 'waiting_room';
  }

  if (this.isModified('feedback') && this.feedback?.patientRating) {
    this.isRated = true;
    if (!this.feedback.submittedAt) this.feedback.submittedAt = new Date();
    this.analytics.patientSatisfactionScore = this.feedback.patientRating;
  }

  if (this.isModified('participants')) {
    this.analytics.totalParticipants = this.participants?.length ?? 0;
  }

  if (this.isModified('status') && this.status === 'cancelled') {
    if (!this.cancelledAt) this.cancelledAt = new Date();
    this.consultationStage = 'closed';
  }

  if (this.isModified('prescriptions')) {
    this.prescriptionCount = this.prescriptions?.length ?? 0;
    if (!this.prescription && this.prescriptions?.length > 0) {
      this.prescription = this.prescriptions[0];
    }
    if (this.prescriptions?.length > 0 && !this.prescriptionUploaded) {
      this.prescriptionUploaded   = true;
      this.prescriptionUploadedAt = this.prescriptionUploadedAt || new Date();
    }
  }

  if (this.isModified('prescription') && this.prescription) {
    const alreadyInArray = this.prescriptions?.some(
      id => id.toString() === this.prescription.toString()
    );
    if (!alreadyInArray) {
      this.prescriptions.push(this.prescription);
      this.prescriptionCount = this.prescriptions.length;
    }
    if (!this.prescriptionUploaded) {
      this.prescriptionUploaded   = true;
      this.prescriptionUploadedAt = this.prescriptionUploadedAt || new Date();
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INDEXES
// ══════════════════════════════════════════════════════════════════════════════

consultationSchema.index({ bookingId: 1 });
consultationSchema.index({ patient: 1, status: 1 });
consultationSchema.index({ patient: 1, scheduledStartTime: -1 });
consultationSchema.index({ doctor: 1, status: 1 });
consultationSchema.index({ doctor: 1, scheduledStartTime: -1 });
consultationSchema.index({ hospital: 1, scheduledStartTime: -1 });
consultationSchema.index({ hospital: 1, status: 1 });

consultationSchema.index({ status: 1, scheduledStartTime: 1 });
consultationSchema.index({ status: 1, createdAt: -1 });
consultationSchema.index({ priority: 1, status: 1 });

consultationSchema.index({ agoraChannelId: 1 });

consultationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: 'expired' } });

consultationSchema.index({ doctor: 1, scheduledStartTime: 1, status: 1 });
consultationSchema.index({ patient: 1, consultationType: 1, createdAt: -1 });
consultationSchema.index({ consultationType: 1, status: 1, createdAt: -1 });
consultationSchema.index({ specialty: 1, status: 1 });
consultationSchema.index({ isRated: 1 });
consultationSchema.index({ 'feedback.patientRating': 1 });
consultationSchema.index({ doctor: 1, hospital: 1, status: 1, scheduledStartTime: -1 });

consultationSchema.index({ prescription: 1 });
consultationSchema.index({ prescriptions: 1 });

const Consultation = mongoose.model('Consultation', consultationSchema);
export default Consultation;