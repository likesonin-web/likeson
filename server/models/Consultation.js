/**
 * consultation.model.js
 *
 * ENTERPRISE TELEMEDICINE CONSULTATION MODEL
 * Production-grade | HIPAA-conscious | VideoSDK-ready | WebRTC-scalable
 * Designed for Apollo 24/7 / Practo / Teladoc tier healthcare platforms
 *
 * Architecture: Standalone Consultation document, linked from Booking via
 *   consultationSessionId ref. All telemedicine logic lives HERE, not in Booking.
 */

import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateConsultationId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

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
  'chat',
  'in_person',
  'home_visit',
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
  'nurse',
  'care_assistant',
  'family_member',
  'translator',
  'admin',
];

export const VIDEOSDK_PROVIDERS = [
  'VideoSDK',
  'Twilio',
  'Agora',
  'Daily',
  'Jitsi',
  'WebRTC_Custom',
];

export const CONSENT_TYPES = [
  'telemedicine',
  'recording',
  'ai_analysis',
  'prescription',
  'data_sharing',
];

export const MESSAGE_TYPES = [
  'text',
  'image',
  'file',
  'prescription',
  'diagnosis',
  'system',
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

export const EVENT_TYPES = [
  'join',
  'leave',
  'mute',
  'unmute',
  'reconnect',
  'network_issue',
  'recording_start',
  'recording_stop',
  'screen_share_start',
  'screen_share_stop',
  'waiting_room_enter',
  'waiting_room_approved',
  'waiting_room_rejected',
  'consultation_start',
  'consultation_end',
  'consultation_paused',
  'consultation_resumed',
  'participant_kicked',
  'chat_message_sent',
  'file_uploaded',
  'prescription_issued',
  'system_auto_end',
];

export const STORAGE_PROVIDERS = [
  'AWS_S3',
  'GCP_Storage',
  'Azure_Blob',
  'ImageKit',
  'Cloudinary',
];

export const ACTOR_TYPES = [
  'doctor',
  'patient',
  'nurse',
  'care_assistant',
  'admin',
  'system',
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

export const SEVERITY_LEVELS = [
  'info',
  'warning',
  'error',
  'critical',
];

// ══════════════════════════════════════════════════════════════════════════════
// 1. SUB-SCHEMAS
// ══════════════════════════════════════════════════════════════════════════════

// ── SDK Configuration ─────────────────────────────────────────────────────────
const sdkConfigurationSchema = new Schema(
  {
    version:              { type: String, trim: true },
    mode:                 { type: String, enum: ['CONFERENCE', 'VIEWER', 'SEND_AND_RECV'], default: 'CONFERENCE' },
    quality:              { type: String, enum: ['low', 'medium', 'high', 'hd', 'auto'], default: 'auto' },
    codec:                { type: String, enum: ['VP8', 'VP9', 'H264', 'AV1'], default: 'VP8' },
    micEnabled:           { type: Boolean, default: true },
    cameraEnabled:        { type: Boolean, default: true },
    screenShareEnabled:   { type: Boolean, default: false },
    chatEnabled:          { type: Boolean, default: true },
    whiteBoardEnabled:    { type: Boolean, default: false },
    virtualBackgroundEnabled: { type: Boolean, default: false },
    noiseSuppressionEnabled:  { type: Boolean, default: true },
    echoCancellationEnabled:  { type: Boolean, default: true },
    autoGainControlEnabled:   { type: Boolean, default: true },
    maxVideoResolution:   { type: String, default: '720p' },
    maxFrameRate:         { type: Number, default: 30 },
    multiStream:          { type: Boolean, default: true },
    customVideoStream:    { type: Boolean, default: false },
  },
  { _id: false }
);

// ── Participant Sub-Schema ────────────────────────────────────────────────────
const participantSchema = new Schema(
  {
    participantId:    { type: String, trim: true, required: true },
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:             { type: String, enum: PARTICIPANT_ROLES, required: true },
    displayName:      { type: String, trim: true },
    joinedAt:         { type: Date },
    leftAt:           { type: Date },
    totalDurationMinutes: { type: Number, default: 0, min: 0 },

    // Connection
    connectionStatus: { type: String, enum: ['connected', 'reconnecting', 'disconnected', 'never_joined'], default: 'never_joined' },
    deviceType:       { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
    browser:          { type: String, trim: true },
    operatingSystem:  { type: String, trim: true },
    ipAddress:        { type: String, select: false },

    // A/V State
    cameraEnabled:    { type: Boolean, default: true },
    microphoneEnabled:{ type: Boolean, default: true },
    screenSharing:    { type: Boolean, default: false },
    handRaised:       { type: Boolean, default: false },
    isMutedByHost:    { type: Boolean, default: false },
    speakingDuration: { type: Number, default: 0 },  // seconds
    reconnectCount:   { type: Number, default: 0, min: 0 },
    lastActiveAt:     { type: Date },

    // Quality
    networkQuality:   { type: String, enum: NETWORK_QUALITY_LEVELS, default: 'excellent' },
    audioQuality:     { type: String, enum: NETWORK_QUALITY_LEVELS, default: 'excellent' },
    videoQuality:     { type: String, enum: NETWORK_QUALITY_LEVELS, default: 'excellent' },

    // Waiting room
    waitingRoomStatus: { type: String, enum: WAITING_ROOM_STATUSES, default: 'waiting' },

    // Permissions
    permissions: {
      canMute:          { type: Boolean, default: false },
      canKick:          { type: Boolean, default: false },
      canRecord:        { type: Boolean, default: false },
      canShareScreen:   { type: Boolean, default: true },
      canChat:          { type: Boolean, default: true },
      canPrescribe:     { type: Boolean, default: false },
    },
  },
  { _id: true, timestamps: false }
);

// ── Waiting Room Entry ────────────────────────────────────────────────────────
const waitingRoomEntrySchema = new Schema(
  {
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:             { type: String, enum: PARTICIPANT_ROLES },
    displayName:      { type: String, trim: true },
    enteredAt:        { type: Date, default: Date.now },
    approvedAt:       { type: Date },
    approvedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:       { type: Date },
    rejectionReason:  { type: String, trim: true },
    queuePosition:    { type: Number, min: 1 },
    waitingRoomStatus:{ type: String, enum: WAITING_ROOM_STATUSES, default: 'waiting' },
  },
  { _id: true }
);

// ── Chat Message Sub-Schema ───────────────────────────────────────────────────
const chatAttachmentSchema = new Schema(
  {
    fileName:    { type: String, trim: true },
    mimeType:    { type: String, trim: true },
    fileSize:    { type: Number, min: 0 },
    storageUrl:  { type: String, trim: true, select: false },
    thumbnailUrl:{ type: String, trim: true },
  },
  { _id: true }
);

const chatMessageSchema = new Schema(
  {
    sender:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole:  { type: String, enum: PARTICIPANT_ROLES, required: true },
    messageType: { type: String, enum: MESSAGE_TYPES, default: 'text' },
    message:     { type: String, trim: true, maxlength: 5000 },
    attachments: { type: [chatAttachmentSchema], default: [] },

    reactions: [
      {
        userId:    { type: Schema.Types.ObjectId, ref: 'User' },
        emoji:     { type: String, trim: true },
        reactedAt: { type: Date, default: Date.now },
      },
    ],

    deliveredAt: { type: Date },
    readAt:      { type: Date },
    editedAt:    { type: Date },
    deletedAt:   { type: Date },
    isDeleted:   { type: Boolean, default: false },

    metadata: { type: Schema.Types.Mixed },
  },
  { _id: true, timestamps: true }
);

// ── Prescription Summary (embedded; full doc lives in EPrescription) ──────────
const embeddedPrescriptionSchema = new Schema(
  {
    ePrescriptionId:  { type: Schema.Types.ObjectId, ref: 'EPrescription' },
    rxNumber:         { type: String, trim: true },
    diagnosis:        { type: String, trim: true, maxlength: 500 },
    medications: [
      {
        medicineName: { type: String, trim: true, required: true },
        dosage:       { type: String, trim: true },
        frequency:    { type: String, trim: true },
        duration:     { type: String, trim: true },
        instructions: { type: String, trim: true },
      },
    ],
    labTests: [
      {
        testName:     { type: String, trim: true },
        urgency:      { type: String, enum: ['routine', 'urgent', 'stat'], default: 'routine' },
        instructions: { type: String, trim: true },
      },
    ],
    followUpDate:         { type: Date },
    prescriptionPdfUrl:   { type: String, trim: true, select: false },
    digitallySigned:      { type: Boolean, default: false },
    signatureHash:        { type: String, trim: true, select: false },
    issuedAt:             { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Recording System ──────────────────────────────────────────────────────────
const recordingSchema = new Schema(
  {
    recordingEnabled:      { type: Boolean, default: false },
    recordingStarted:      { type: Boolean, default: false },
    recordingStatus:       { type: String, enum: ['idle', 'recording', 'processing', 'ready', 'failed'], default: 'idle' },
    recordingStartedAt:    { type: Date },
    recordingEndedAt:      { type: Date },
    recordingUrl:          { type: String, trim: true, select: false },
    recordingDurationMinutes: { type: Number, default: 0, min: 0 },
    recordingSizeMB:       { type: Number, default: 0, min: 0 },
    storageProvider:       { type: String, enum: STORAGE_PROVIDERS },
    storageBucket:         { type: String, trim: true, select: false },
    storageKey:            { type: String, trim: true, select: false },
    encrypted:             { type: Boolean, default: true },
    encryptionKeyId:       { type: String, trim: true, select: false },
    retentionExpiryDate:   { type: Date },
    downloadCount:         { type: Number, default: 0, min: 0 },
    downloadedBy: [
      {
        userId:       { type: Schema.Types.ObjectId, ref: 'User' },
        downloadedAt: { type: Date, default: Date.now },
        ipAddress:    { type: String, select: false },
      },
    ],
  },
  { _id: false }
);

// ── File Attachment System ────────────────────────────────────────────────────
const fileAttachmentSchema = new Schema(
  {
    uploadedBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploaderRole:  { type: String, enum: PARTICIPANT_ROLES },
    attachmentType:{ type: String, enum: ATTACHMENT_TYPES, required: true },
    fileName:      { type: String, trim: true, required: true },
    mimeType:      { type: String, trim: true },
    fileSize:      { type: Number, min: 0 },
    storageUrl:    { type: String, trim: true, select: false },
    thumbnailUrl:  { type: String, trim: true },
    encrypted:     { type: Boolean, default: true },
    uploadedAt:    { type: Date, default: Date.now },
    accessLevel:   { type: String, enum: ['private', 'doctor_only', 'patient_only', 'shared', 'admin'], default: 'shared' },
    description:   { type: String, trim: true, maxlength: 500 },
    isDeleted:     { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Consent System ────────────────────────────────────────────────────────────
const consentSchema = new Schema(
  {
    consentType:       { type: String, enum: CONSENT_TYPES, required: true },
    accepted:          { type: Boolean, required: true },
    acceptedAt:        { type: Date },
    ipAddress:         { type: String, select: false },
    userAgent:         { type: String, select: false },
    consentVersion:    { type: String, trim: true, default: '1.0' },
    digitalSignature:  { type: String, trim: true, select: false },
    geoLocation: {
      lat:  { type: Number },
      long: { type: Number },
    },
    revokedAt:         { type: Date },
    isRevoked:         { type: Boolean, default: false },
  },
  { _id: true }
);

// ── AI Features ───────────────────────────────────────────────────────────────
const aiAnalysisSchema = new Schema(
  {
    // Transcript
    aiTranscript: {
      enabled:         { type: Boolean, default: false },
      transcriptText:  { type: String, select: false },
      transcriptUrl:   { type: String, trim: true, select: false },
      language:        { type: String, trim: true },
      confidence:      { type: Number, min: 0, max: 1 },
      processedAt:     { type: Date },
    },

    // Summary
    aiSummary: {
      enabled:         { type: Boolean, default: false },
      summaryText:     { type: String, trim: true, maxlength: 5000, select: false },
      model:           { type: String, trim: true },
      generatedAt:     { type: Date },
    },

    // Diagnosis Suggestions
   aiDiagnosisSuggestions: {
  enabled:     { type: Boolean, default: false },
  suggestions: [{ type: String, trim: true }],
  icdCodes:    [{ type: String, trim: true }],
  confidence:  { type: Number, min: 0, max: 1 },
  generatedAt: { type: Date },
},

    // Risk Prediction
    aiRiskPrediction: {
      enabled:         { type: Boolean, default: false },
      riskLevel:       { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      riskFactors:     [{ type: String }],
      recommendations: [{ type: String }],
      generatedAt:     { type: Date },
       
    },

    // Drug Interaction Warnings
    aiDrugInteractionWarnings: {
      enabled:         { type: Boolean, default: false },
      warnings:        [{ type: String }],
      severity:        { type: String, enum: ['none', 'mild', 'moderate', 'severe'] },
      checkedAt:       { type: Date },
    },

    // Symptoms Extracted
    aiSymptomsExtracted: {
      enabled:         { type: Boolean, default: false },
      symptoms:        [{ type: String }],
      extractedAt:     { type: Date },
    },

    // Follow-up Recommendation
    aiFollowUpRecommendation: {
      enabled:         { type: Boolean, default: false },
      recommendation:  { type: String, trim: true, maxlength: 2000 },
      urgencyLevel:    { type: String, enum: ['routine', 'soon', 'urgent'] },
      generatedAt:     { type: Date },
    },

    // Language Translation
    aiLanguageTranslation: {
      enabled:         { type: Boolean, default: false },
      sourceLanguage:  { type: String, trim: true },
      targetLanguage:  { type: String, trim: true },
      translatedText:  { type: String, select: false },
      translatedAt:    { type: Date },
    },

    // Sentiment Analysis
    aiSentimentAnalysis: {
      enabled:         { type: Boolean, default: false },
      patientSentiment:{ type: String, enum: ['positive', 'neutral', 'negative', 'anxious', 'satisfied'] },
      sentimentScore:  { type: Number, min: -1, max: 1 },
      analyzedAt:      { type: Date },
    },

    // SOAP Notes
    aiGeneratedSoapNotes: {
      enabled:         { type: Boolean, default: false },
      subjective:      { type: String, trim: true, maxlength: 3000, select: false },
      objective:       { type: String, trim: true, maxlength: 3000, select: false },
      assessment:      { type: String, trim: true, maxlength: 3000, select: false },
      plan:            { type: String, trim: true, maxlength: 3000, select: false },
      generatedAt:     { type: Date },
    },
  },
  { _id: false }
);

// ── Network & Device Analytics ────────────────────────────────────────────────
const networkAnalyticsSchema = new Schema(
  {
    participantId: { type: Schema.Types.ObjectId, ref: 'User' },
    role:          { type: String, enum: PARTICIPANT_ROLES },
    timestamp:     { type: Date, default: Date.now },
    bandwidth:     { type: Number, min: 0 },           // kbps
    latency:       { type: Number, min: 0 },            // ms
    jitter:        { type: Number, min: 0 },            // ms
    packetLoss:    { type: Number, min: 0, max: 100 },  // %
    cpuUsage:      { type: Number, min: 0, max: 100 },  // %
    memoryUsage:   { type: Number, min: 0, max: 100 },  // %
    batteryLevel:  { type: Number, min: 0, max: 100 },  // %
    networkType:   { type: String, enum: ['wifi', '4g', '5g', '3g', '2g', 'ethernet', 'unknown'], default: 'unknown' },
  },
  { _id: true }
);

const sdkErrorSchema = new Schema(
  {
    code:        { type: String, trim: true },
    message:     { type: String, trim: true },
    participantId:{ type: String, trim: true },
    timestamp:   { type: Date, default: Date.now },
    severity:    { type: String, enum: SEVERITY_LEVELS, default: 'error' },
    resolved:    { type: Boolean, default: false },
  },
  { _id: true }
);

const reconnectLogSchema = new Schema(
  {
    participantId: { type: Schema.Types.ObjectId, ref: 'User' },
    role:          { type: String, enum: PARTICIPANT_ROLES },
    attemptAt:     { type: Date, default: Date.now },
    reconnectedAt: { type: Date },
    reason:        { type: String, trim: true },
    success:       { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Event Log Sub-Schema ──────────────────────────────────────────────────────
const eventLogSchema = new Schema(
  {
    eventType:  { type: String, enum: EVENT_TYPES, required: true },
    actorType:  { type: String, enum: ACTOR_TYPES, required: true },
    actorId:    { type: Schema.Types.ObjectId, ref: 'User' },
    severity:   { type: String, enum: SEVERITY_LEVELS, default: 'info' },
    source:     { type: String, enum: ['client', 'server', 'sdk', 'system', 'webhook'], default: 'system' },
    timestamp:  { type: Date, default: Date.now },
    payload:    { type: Schema.Types.Mixed },
    deviceInfo: {
      deviceType: { type: String },
      browser:    { type: String },
      os:         { type: String },
    },
    ipAddress:  { type: String, select: false },
  },
  { _id: true }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. MAIN CONSULTATION SCHEMA
// ══════════════════════════════════════════════════════════════════════════════

const consultationSchema = new Schema(
  {

    // ── SECTION 1: CORE CONSULTATION DETAILS ─────────────────────────────────

    consultationId: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
    },

    bookingId: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },

    patient: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    doctor: {
      type:     Schema.Types.ObjectId,
      ref:      'DoctorProfile',
      required: true,
      index:    true,
    },

    hospital: {
      type:    Schema.Types.ObjectId,
      ref:     'Hospital',
      default: null,
      index:   true,
    },

    careAssistant: {
      type:    Schema.Types.ObjectId,
      ref:     'CareAssistantProfile',
      default: null,
    },

    consultationType: {
      type:     String,
      enum:     CONSULTATION_TYPES,
      required: true,
      index:    true,
    },

    consultationMode: {
      type:    String,
      enum:    CONSULTATION_MODES,
      default: 'scheduled',
    },

    specialty: {
      type:  String,
      trim:  true,
      index: true,
    },

    language: {
      type:    String,
      trim:    true,
      default: 'English',
    },

    symptoms:           [{ type: String, trim: true }],
    chiefComplaint:     { type: String, trim: true, maxlength: 2000 },
    consultationReason: { type: String, trim: true, maxlength: 2000 },
    diagnosisSummary:   { type: String, trim: true, maxlength: 5000 },
    treatmentPlan:      { type: String, trim: true, maxlength: 5000 },
    followUpAdvice:     { type: String, trim: true, maxlength: 2000 },
    tags:               [{ type: String, trim: true, lowercase: true }],

    // Internal doctor notes — never expose
    doctorInternalNotes: { type: String, trim: true, maxlength: 10000, select: false },

    metadata: { type: Schema.Types.Mixed },


    // ── SECTION 2: CONSULTATION STATUS SYSTEM ────────────────────────────────

    status: {
      type:    String,
      enum:    CONSULTATION_STATUSES,
      default: 'created',
      index:   true,
    },

    priority: {
      type:    String,
      enum:    PRIORITY_LEVELS,
      default: 'routine',
      index:   true,
    },

    consultationStage: {
      type:    String,
      enum:    CONSULTATION_STAGES,
      default: 'pre_consultation',
    },

    completionStatus: {
      type:    String,
      enum:    COMPLETION_STATUSES,
      default: 'not_started',
    },

    cancelledBy:       { type: String, enum: CANCELLATION_ACTORS },
    cancelledByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason:{ type: String, trim: true, maxlength: 1000 },
    cancelledAt:       { type: Date },

    endedBy:           { type: String, enum: END_ACTORS },
    endedByUserId:     { type: Schema.Types.ObjectId, ref: 'User' },
    endedReason:       { type: String, trim: true, maxlength: 1000 },
    autoEndedBySystem: { type: Boolean, default: false },

    failedReason:      { type: String, trim: true, maxlength: 1000 },
    failureCode:       { type: String, trim: true },

    // Status history
    statusLog: [
      {
        fromStatus: { type: String },
        toStatus:   { type: String, required: true },
        changedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
        reason:     { type: String, trim: true },
        changedAt:  { type: Date, default: Date.now },
      },
    ],


    // ── SECTION 3: TIMING SYSTEM ──────────────────────────────────────────────

    scheduledStartTime:      { type: Date, required: true, index: true },
    scheduledEndTime:        { type: Date },
    actualStartTime:         { type: Date },
    actualEndTime:           { type: Date },
    estimatedDurationMinutes:{ type: Number, default: 30, min: 1 },
    actualDurationMinutes:   { type: Number, default: 0, min: 0 },
    waitingDurationMinutes:  { type: Number, default: 0, min: 0 },
    timezone:                { type: String, trim: true, default: 'Asia/Kolkata' },

    doctorJoinedAt:          { type: Date },
    patientJoinedAt:         { type: Date },
    doctorLeftAt:            { type: Date },
    patientLeftAt:           { type: Date },

    expiresAt:               { type: Date, index: true }, // TTL-ready


    // ── SECTION 4: VIDEOSDK / RTC MEETING SYSTEM ─────────────────────────────

    provider: {
      type:    String,
      enum:    VIDEOSDK_PROVIDERS,
      default: 'VideoSDK',
    },

    providerMeetingId: { type: String, trim: true, index: true },
    providerRoomId:    { type: String, trim: true },
    roomId:            { type: String, trim: true, index: true },
    meetingId:         { type: String, trim: true, index: true },
    meetingLink:       { type: String, trim: true },

    // Secure tokens — NEVER include in API responses
    hostToken:         { type: String, trim: true, select: false },
    participantToken:  { type: String, trim: true, select: false },
    webhookSecret:     { type: String, trim: true, select: false },

    sdkConfiguration: { type: sdkConfigurationSchema, default: () => ({}) },

    region:            { type: String, trim: true, default: 'ap-south-1' },
    encryptionMode:    { type: String, enum: ['none', 'E2EE', 'transport'], default: 'transport' },
    maxParticipants:   { type: Number, default: 5, min: 2 },

    // Features flags
    waitingRoomEnabled:   { type: Boolean, default: true },
    screenShareEnabled:   { type: Boolean, default: true },
    recordingSupported:   { type: Boolean, default: true },
    transcriptionEnabled: { type: Boolean, default: false },
    e2eeEnabled:          { type: Boolean, default: false },

    roomStarted:  { type: Boolean, default: false },
    roomEnded:    { type: Boolean, default: false },


    // ── SECTION 5: PARTICIPANTS SYSTEM ───────────────────────────────────────

    participants: { type: [participantSchema], default: [] },


    // ── SECTION 6: WAITING ROOM SYSTEM ───────────────────────────────────────

    waitingRoomQueue: { type: [waitingRoomEntrySchema], default: [] },


    // ── SECTION 7: CHAT & MESSAGE SYSTEM ─────────────────────────────────────

    chatMessages: { type: [chatMessageSchema], default: [] },
    chatEnabled:  { type: Boolean, default: true },
    totalMessages:{ type: Number, default: 0, min: 0 },


    // ── SECTION 8: PRESCRIPTION SYSTEM ───────────────────────────────────────

    prescription:          { type: embeddedPrescriptionSchema, default: null },
    prescriptionUploaded:  { type: Boolean, default: false },
    prescriptionUploadedAt:{ type: Date },


    // ── SECTION 9: RECORDING SYSTEM ──────────────────────────────────────────

    recording: { type: recordingSchema, default: () => ({}) },


    // ── SECTION 10: FILE ATTACHMENTS SYSTEM ──────────────────────────────────

    attachments: { type: [fileAttachmentSchema], default: [] },


    // ── SECTION 11: TELEMEDICINE CONSENT SYSTEM ──────────────────────────────

    consents: { type: [consentSchema], default: [] },

    // Quick-access flags
    telemedicineConsentAccepted: { type: Boolean, default: false },
    recordingConsentAccepted:    { type: Boolean, default: false },


    // ── SECTION 12: AI FEATURES SYSTEM ───────────────────────────────────────

    aiAnalysis: { type: aiAnalysisSchema, default: null },


    // ── SECTION 13: NETWORK & DEVICE ANALYTICS ───────────────────────────────

    networkAnalytics: { type: [networkAnalyticsSchema], default: [] },
    sdkErrors:        { type: [sdkErrorSchema],        default: [] },
    reconnectLogs:    { type: [reconnectLogSchema],    default: [] },

    // Aggregate network stats (updated periodically)
    networkStats: {
      avgBandwidth:     { type: Number, default: 0 },
      avgLatency:       { type: Number, default: 0 },
      avgJitter:        { type: Number, default: 0 },
      avgPacketLoss:    { type: Number, default: 0 },
      totalReconnects:  { type: Number, default: 0 },
      networkType:      { type: String, trim: true },
    },


    // ── SECTION 14: EVENT LOGGING SYSTEM ─────────────────────────────────────

    eventLogs: { type: [eventLogSchema], default: [] },


    // ── SECTION 15: CONSULTATION ANALYTICS ───────────────────────────────────

    analytics: {
      averageLatency:          { type: Number, default: 0 },
      averageReconnects:       { type: Number, default: 0 },
      totalParticipants:       { type: Number, default: 0 },
      peakParticipants:        { type: Number, default: 0 },
      callDropCount:           { type: Number, default: 0 },
      consultationScore:       { type: Number, min: 0, max: 100 },
      patientSatisfactionScore:{ type: Number, min: 0, max: 5 },
      waitingRoomTime:         { type: Number, default: 0 },   // minutes
      doctorResponseTime:      { type: Number, default: 0 },   // minutes
      callQualityScore:        { type: Number, min: 0, max: 5 },
    },


    // ── SECTION 16: REVIEW & FEEDBACK SYSTEM ─────────────────────────────────

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

    isRated: { type: Boolean, default: false, index: true },


    // ── SECTION 17: SECURITY & AUDIT ─────────────────────────────────────────

    // Audit trail
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Internal admin notes — never expose
    internalAdminNotes: { type: String, trim: true, maxlength: 5000, select: false },

    // Test flag
    isTestConsultation: { type: Boolean, default: false, index: true },

  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
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

consultationSchema.virtual('unreadMessageCount').get(function () {
  return this.chatMessages?.filter(m => !m.readAt && !m.isDeleted).length ?? 0;
});

// ══════════════════════════════════════════════════════════════════════════════
// PRE-VALIDATE HOOKS
// ══════════════════════════════════════════════════════════════════════════════

consultationSchema.pre('validate', function () {
  // Telemedicine consent required before active
  if (this.status === 'active' && !this.telemedicineConsentAccepted) {
    throw new Error('Telemedicine consent required before consultation can be active');
  }

  // expiresAt must be after scheduledStartTime
  if (this.expiresAt && this.scheduledStartTime && this.expiresAt <= this.scheduledStartTime) {
    throw new Error('expiresAt must be after scheduledStartTime');
  }

  // actualEndTime after actualStartTime
  if (this.actualEndTime && this.actualStartTime && this.actualEndTime < this.actualStartTime) {
    throw new Error('actualEndTime cannot be before actualStartTime');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PRE-SAVE HOOKS
// ══════════════════════════════════════════════════════════════════════════════

consultationSchema.pre('save', async function () {

  // 1. Auto-generate consultationId
  if (this.isNew && !this.consultationId) {
    let id, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error('consultationId generation failed after 10 attempts');
      id     = `CS-${generateConsultationId()}`;
      exists = await mongoose.model('Consultation').exists({ consultationId: id });
    } while (exists);
    this.consultationId = id;
  }

  // 2. Auto-set expiresAt if not set (scheduled start + 2h buffer)
  if (this.isNew && !this.expiresAt && this.scheduledStartTime) {
    const exp = new Date(this.scheduledStartTime);
    exp.setHours(exp.getHours() + 2);
    this.expiresAt = exp;
  }

  // 3. Status transition log
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

  // 4. Auto-compute actualDurationMinutes
  if (this.actualStartTime && this.actualEndTime) {
    const diffMs    = this.actualEndTime - this.actualStartTime;
    this.actualDurationMinutes = Math.round(diffMs / 60000);
  }

  // 5. Auto-set completionStatus on complete
  if (this.isModified('status') && this.status === 'completed') {
    this.completionStatus = this.prescriptionUploaded
      ? 'completed_with_prescription'
      : 'completed_without_prescription';
    this.consultationStage = 'post_consultation';
  }

  // 6. Auto-set consultationStage when active
  if (this.isModified('status') && this.status === 'active') {
    this.consultationStage = 'in_progress';
  }

  // 7. Auto-set consultationStage when waiting
  if (this.isModified('status') && this.status === 'waiting') {
    this.consultationStage = 'waiting_room';
  }

  // 8. Sync isRated flag
  if (this.isModified('feedback') && this.feedback?.patientRating) {
    this.isRated = true;
    if (!this.feedback.submittedAt) {
      this.feedback.submittedAt = new Date();
    }
  }

  // 9. Update analytics.totalParticipants
  if (this.isModified('participants')) {
    this.analytics.totalParticipants = this.participants?.length ?? 0;
  }

  // 10. Sync totalMessages count
  if (this.isModified('chatMessages')) {
    this.totalMessages = this.chatMessages?.filter(m => !m.isDeleted).length ?? 0;
  }

  // 11. cancelled cleanup
  if (this.isModified('status') && this.status === 'cancelled') {
    if (!this.cancelledAt) this.cancelledAt = new Date();
    this.consultationStage = 'closed';
  }

  // 12. Update analytics.patientSatisfactionScore from feedback
  if (this.isModified('feedback.patientRating') && this.feedback?.patientRating) {
    this.analytics.patientSatisfactionScore = this.feedback.patientRating;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INDEXES — Production-grade for millions of documents
// ══════════════════════════════════════════════════════════════════════════════

// Core lookup
consultationSchema.index({ bookingId: 1 });
consultationSchema.index({ patient: 1, status: 1 });
consultationSchema.index({ patient: 1, scheduledStartTime: -1 });
consultationSchema.index({ doctor: 1, status: 1 });
consultationSchema.index({ doctor: 1, scheduledStartTime: -1 });
consultationSchema.index({ hospital: 1, scheduledStartTime: -1 });
consultationSchema.index({ hospital: 1, status: 1 });

// Status + time (dashboard queries)
consultationSchema.index({ status: 1, scheduledStartTime: 1 });
consultationSchema.index({ status: 1, createdAt: -1 });
consultationSchema.index({ priority: 1, status: 1 });

// Meeting room lookups (real-time join)
consultationSchema.index({ roomId: 1 });
consultationSchema.index({ meetingId: 1 });
consultationSchema.index({ providerMeetingId: 1 });

// TTL-ready expiry
consultationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: 'expired' } });

// Doctor calendar
consultationSchema.index({ doctor: 1, scheduledStartTime: 1, status: 1 });

// Patient history
consultationSchema.index({ patient: 1, consultationType: 1, createdAt: -1 });

// Admin analytics
consultationSchema.index({ consultationType: 1, status: 1, createdAt: -1 });
consultationSchema.index({ specialty: 1, status: 1 });
consultationSchema.index({ isRated: 1 });
consultationSchema.index({ 'feedback.patientRating': 1 });

// Compound performance index
consultationSchema.index({ doctor: 1, hospital: 1, status: 1, scheduledStartTime: -1 });

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════════

const Consultation = mongoose.model('Consultation', consultationSchema);
export default Consultation;