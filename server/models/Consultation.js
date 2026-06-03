// models/Consultation.model.js
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateConsultId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

// ── Constants ─────────────────────────────────────────────────────────────────

export const CONSULTATION_TYPES = [
  'video',        // Agora RTC — primary
  'audio',        // Agora voice-only
  'chat',         // text chat (Agora RTM or internal)
  'in_person',    // walk-in / clinic visit
  'home_visit',   // doctor visits patient
];

export const CONSULTATION_STATUSES = [
  'scheduled',      // booked, not started
  'waiting',        // patient in waiting room
  'doctor_joined',  // doctor entered, patient not yet
  'patient_joined', // patient entered, doctor not yet
  'in_progress',    // both in session
  'paused',         // reconnecting / temp break
  'completed',      // session ended normally
  'missed',         // neither joined in grace period
  'cancelled',      // cancelled before start
  'no_show_patient',
  'no_show_doctor',
  'technical_failure', // Agora/network failure
];

export const URGENCY_LEVELS = ['routine', 'urgent', 'emergency'];

export const PARTICIPANT_ROLES = ['doctor', 'patient', 'interpreter', 'observer', 'caregiver'];

// ── Sub-schemas ───────────────────────────────────────────────────────────────

// Agora RTC / RTM token + channel info (server-generated, short-lived)
const agoraSessionSchema = new Schema(
  {
    channelName:     { type: String, required: true },  // unique per consultation
    appId:           { type: String },                  // Agora App ID (env-safe to store)

    // Doctor tokens
    doctorUid:       { type: Number },                  // Agora UID (uint32)
    doctorRtcToken:  { type: String, select: false },   // RTC — expires
    doctorRtmToken:  { type: String, select: false },   // RTM (chat/signalling) — expires

    // Patient tokens
    patientUid:      { type: Number },
    patientRtcToken: { type: String, select: false },
    patientRtmToken: { type: String, select: false },

    // Additional participant tokens (interpreter, observer)
    extraParticipants: [
      {
        uid:       { type: Number },
        role:      { type: String, enum: PARTICIPANT_ROLES },
        rtcToken:  { type: String, select: false },
        rtmToken:  { type: String, select: false },
      },
    ],

    tokenExpiresAt:  { type: Date },                    // when to refresh tokens
    tokenRefreshCount: { type: Number, default: 0 },

    // Recording (Agora Cloud Recording)
    cloudRecordingResourceId: { type: String },
    cloudRecordingSid:        { type: String },
    cloudRecordingMode:       { type: String, enum: ['mix', 'individual', 'web'], default: 'mix' },
    recordingStartedAt:       { type: Date },
    recordingStoppedAt:       { type: Date },
    recordingFileUrls:        [{ type: String }],       // S3 / OSS URLs after upload
    isRecordingEnabled:       { type: Boolean, default: false },
    recordingConsentDoctor:   { type: Boolean, default: false },
    recordingConsentPatient:  { type: Boolean, default: false },

    // RTM (in-session chat)
    rtmChannelName:  { type: String },
  },
  { _id: false }
);

// Who joined when — full audit trail
const participantEventSchema = new Schema(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:       { type: String, enum: PARTICIPANT_ROLES, required: true },
    agoraUid:   { type: Number },
    joinedAt:   { type: Date },
    leftAt:     { type: Date },
    durationSec:{ type: Number },   // auto-computed on leave
    deviceInfo: {
      platform:   { type: String },   // 'web' | 'android' | 'ios'
      browser:    { type: String },
      os:         { type: String },
      sdkVersion: { type: String },
    },
    networkQuality: { type: Number, min: 0, max: 6 }, // Agora quality probe (0=unknown,6=excellent)
    rejoinCount:    { type: Number, default: 0 },
  },
  { _id: true, timestamps: false }
);

// In-session chat messages (Agora RTM peer/channel messages mirrored server-side)
const chatMessageSchema = new Schema(
  {
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole:   { type: String, enum: PARTICIPANT_ROLES },
    content:      { type: String, trim: true, maxlength: 2000 },
    messageType:  {
      type: String,
      enum: ['text', 'image', 'file', 'prescription_preview', 'lab_order', 'system'],
      default: 'text',
    },
    attachmentUrl:  { type: String },
    attachmentName: { type: String },
    sentAt:         { type: Date, default: Date.now },
    isDeleted:      { type: Boolean, default: false },
  },
  { _id: true }
);

// Vitals captured during / before session
const vitalsSchema = new Schema(
  {
    bloodPressureSystolic:  { type: Number },
    bloodPressureDiastolic: { type: Number },
    pulseRate:              { type: Number },
    temperatureC:           { type: Number },
    spO2:                   { type: Number, min: 0, max: 100 },
    respiratoryRate:        { type: Number },
    weightKg:               { type: Number },
    heightCm:               { type: Number },
    bloodGlucose:           { type: Number },
    recordedAt:             { type: Date, default: Date.now },
    recordedBy:             { type: String, enum: ['patient', 'doctor', 'care_assistant', 'device'] },
    deviceSource:           { type: String },   // e.g. "Omron BP Monitor"
  },
  { _id: false }
);

// Doctor's clinical notes (SOAP format)
const clinicalNotesSchema = new Schema(
  {
    chiefComplaint:   { type: String, trim: true, maxlength: 500 },
    // SOAP
    subjective:       { type: String, trim: true, maxlength: 2000 },  // patient history, symptoms
    objective:        { type: String, trim: true, maxlength: 2000 },  // exam findings, vitals
    assessment:       { type: String, trim: true, maxlength: 2000 },  // diagnosis, differential
    plan:             { type: String, trim: true, maxlength: 2000 },  // treatment, referral, f/u
    // ICD-10
    diagnosisCodes:   [{ code: String, description: String }],
    // Free advice
    lifestyleAdvice:  { type: String, trim: true, maxlength: 1000 },
    dietAdvice:       { type: String, trim: true, maxlength: 500 },
    // Referral
    referralTo:       { type: String, trim: true },
    referralNote:     { type: String, trim: true, maxlength: 500 },
    // Follow-up
    followUpInDays:   { type: Number, min: 1 },
    followUpNote:     { type: String, trim: true, maxlength: 300 },
    // Internal
    privateNotes:     { type: String, trim: true, maxlength: 1000, select: false }, // doctor-only
    lastEditedAt:     { type: Date },
  },
  { _id: false }
);

// Waiting room events (Lybrate/Amwell style queue)
const waitingRoomSchema = new Schema(
  {
    patientEnteredAt:  { type: Date },
    doctorNotifiedAt:  { type: Date },
    estimatedWaitMin:  { type: Number },
    queuePosition:     { type: Number },
    patientReadyAt:    { type: Date },     // patient clicked "I'm ready"
    doctorReadyAt:     { type: Date },
    patientLeft:       { type: Boolean, default: false },
    patientLeftAt:     { type: Date },
  },
  { _id: false }
);

// Payment/fee at consultation level (may differ from booking-level fareBreakdown)
const consultationFeeSchema = new Schema(
  {
    consultationFee:   { type: Number, default: 0, min: 0 },
    platformFee:       { type: Number, default: 0, min: 0 },
    taxes:             { type: Number, default: 0, min: 0 },
    discount:          { type: Number, default: 0, min: 0 },
    totalAmount:       { type: Number, default: 0, min: 0 },
    currency:          { type: String, default: 'INR' },
    isPaid:            { type: Boolean, default: false },
    paidAt:            { type: Date },
    paymentRef:        { type: String },   // link to booking payment
  },
  { _id: false }
);

// Cancellation
const cancellationSchema = new Schema(
  {
    cancelledBy:   { type: String, enum: ['doctor', 'patient', 'admin', 'system'] },
    cancelledById: { type: Schema.Types.ObjectId, ref: 'User' },
    reason:        { type: String, trim: true },
    cancelledAt:   { type: Date, default: Date.now },
    refundable:    { type: Boolean, default: false },
  },
  { _id: false }
);

// Rating (both sides rate each other — Lybrate / HealthTap pattern)
const ratingSchema = new Schema(
  {
    // Patient rates doctor
    doctorRating:   { type: Number, min: 1, max: 5 },
    doctorFeedback: { type: String, trim: true, maxlength: 500 },
    // Doctor rates patient (for internal quality)
    patientRating:   { type: Number, min: 1, max: 5 },
    patientFeedback: { type: String, trim: true, maxlength: 200, select: false },
    // Overall experience
    overallRating:  { type: Number, min: 1, max: 5 },
    tags:           [{ type: String, trim: true }], // "knowledgeable", "punctual", etc.
    ratedAt:        { type: Date },
    isPublic:       { type: Boolean, default: true },
  },
  { _id: false }
);

// Quality / session metrics (for analytics — Push Doctor / Doxy.me style)
const sessionMetricsSchema = new Schema(
  {
    totalDurationSec:     { type: Number },
    doctorTalkTimeSec:    { type: Number },
    patientTalkTimeSec:   { type: Number },
    avgNetworkQuality:    { type: Number },  // 1–6
    reconnectCount:       { type: Number, default: 0 },
    videoEnabled:         { type: Boolean },
    audioEnabled:         { type: Boolean },
    chatMessagesCount:    { type: Number, default: 0 },
    prescriptionIssued:   { type: Boolean, default: false },
    labOrderIssued:       { type: Boolean, default: false },
    referralIssued:       { type: Boolean, default: false },
    // Agora Quality of Service (QoS)
    doctorAvgFrameRate:   { type: Number },
    patientAvgFrameRate:  { type: Number },
    doctorPacketLoss:     { type: Number },
    patientPacketLoss:    { type: Number },
  },
  { _id: false }
);

// Status history log
const statusLogSchema = new Schema(
  {
    fromStatus: { type: String },
    toStatus:   { type: String, required: true },
    changedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    reason:     { type: String },
    changedAt:  { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const consultationSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    consultationCode: {
      type:    String,
      unique:  true,
      sparse:  true,
      index:   true,
      uppercase: true,
      trim:    true,
    },   // e.g. CS-XXXXXXXX

    consultationType: {
      type:     String,
      required: true,
      enum:     CONSULTATION_TYPES,
      index:    true,
    },

    // ── Linkage ───────────────────────────────────────────────────────────────
    booking: {
      type:  Schema.Types.ObjectId,
      ref:   'Booking',
      index: true,
    },

    outPatientRecord: {
      type:  Schema.Types.ObjectId,
      ref:   'OutPatientRecord',
      index: true,
    },

    // ── Parties ───────────────────────────────────────────────────────────────
    doctor: {
      type:     Schema.Types.ObjectId,
      ref:      'DoctorProfile',
      required: true,
      index:    true,
    },

    doctorUser: {
      type:  Schema.Types.ObjectId,
      ref:   'User',
      index: true,
    },

    patient: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    hospital: {
      type:  Schema.Types.ObjectId,
      ref:   'Hospital',
      index: true,
    },

    // Snapshots (immutable at session start — Lybrate pattern)
    doctorSnapshot: {
      name:               { type: String },
      specialization:     { type: String },
      registrationNumber: { type: String },
      profilePhotoUrl:    { type: String },
      qualifications:     { type: String },
      phone:              { type: String },
    },

    patientSnapshot: {
      name:       { type: String },
      age:        { type: Number },
      gender:     { type: String },
      phone:      { type: String },
      bloodGroup: { type: String },
      allergies:  [{ type: String }],
    },

    // ── Scheduling ────────────────────────────────────────────────────────────
    scheduledAt:  { type: Date, required: true, index: true },
    slotId:       { type: Schema.Types.ObjectId, default: null },
    slotDurationMin: { type: Number, default: 15 },   // booked slot length

    urgency: {
      type:    String,
      enum:    URGENCY_LEVELS,
      default: 'routine',
      index:   true,
    },

    // ── Session Lifecycle ─────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    CONSULTATION_STATUSES,
      default: 'scheduled',
      index:   true,
    },

    statusLog: { type: [statusLogSchema], default: [] },

    waitingRoom: { type: waitingRoomSchema, default: () => ({}) },

    // Grace period — if neither join within X min → auto-missed
    gracePeriodMin:      { type: Number, default: 10 },
    autoMissedAt:        { type: Date },   // scheduledAt + gracePeriodMin

    sessionStartedAt:    { type: Date },
    sessionEndedAt:      { type: Date },
    actualDurationSec:   { type: Number },

    // ── Agora ──────────────────────────────────────────────────────────────────
    agora: { type: agoraSessionSchema, default: null },

    // ── Participants ──────────────────────────────────────────────────────────
    // Full join/leave audit (Doxy.me / Amwell pattern)
    participantEvents: { type: [participantEventSchema], default: [] },

    // Extra participants (caregiver, interpreter)
    additionalParticipants: [
      {
        userId:   { type: Schema.Types.ObjectId, ref: 'User' },
        role:     { type: String, enum: PARTICIPANT_ROLES },
        addedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
        addedAt:  { type: Date, default: Date.now },
      },
    ],

    // ── In-Session Chat (RTM mirror) ──────────────────────────────────────────
    chatMessages: { type: [chatMessageSchema], default: [] },

    // ── Vitals ────────────────────────────────────────────────────────────────
    vitals: { type: vitalsSchema, default: null },

    // ── Clinical ──────────────────────────────────────────────────────────────
    clinicalNotes: { type: clinicalNotesSchema, default: () => ({}) },

    // ── Prescriptions (1:many — doctor may issue multiple Rx) ────────
    prescriptions: [{ type: Schema.Types.ObjectId, ref: 'EPrescription' }],

    // ── Fee ───────────────────────────────────────────────────────────────────
    fee: { type: consultationFeeSchema, default: () => ({}) },

    // ── Cancellation ──────────────────────────────────────────────────────────
    cancellation: { type: cancellationSchema, default: null },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating:  { type: ratingSchema, default: null },
    isRated: { type: Boolean, default: false, index: true },

    // ── Session Metrics ───────────────────────────────────────────────────────
    sessionMetrics: { type: sessionMetricsSchema, default: null },

    // ── Notifications ─────────────────────────────────────────────────────────
    notificationsSent: {
      scheduledConfirmation: { type: Boolean, default: false },
      reminderPatient15min:  { type: Boolean, default: false },
      reminderDoctor15min:   { type: Boolean, default: false },
      sessionStarted:        { type: Boolean, default: false },
      sessionEnded:          { type: Boolean, default: false },
      prescriptionReady:     { type: Boolean, default: false },
      ratingRequest:         { type: Boolean, default: false },
    },

    // ── Consent & Compliance ──────────────────────────────────────────────────
    // Recording consent (Amwell / Push Doctor legal requirement)
    recordingConsent: {
      doctorConsented:   { type: Boolean, default: false },
      patientConsented:  { type: Boolean, default: false },
      consentTimestamp:  { type: Date },
    },

    hipaaAcknowledged:    { type: Boolean, default: false },   // for US-mode
    consentFormSignedUrl: { type: String },

    // ── Flags ──────────────────────────────────────────────────────────────────
    isEmergency:   { type: Boolean, default: false, index: true },
    isFollowUp:    { type: Boolean, default: false },
    parentConsultation: {
      type:  Schema.Types.ObjectId,
      ref:   'Consultation',
      default: null,
      index: true,
    },
    isTestSession: { type: Boolean, default: false },

    // ── Admin ──────────────────────────────────────────────────────────────────
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    internalNotes:   { type: String, trim: true, select: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

consultationSchema.virtual('isActive').get(function () {
  return ['waiting', 'doctor_joined', 'patient_joined', 'in_progress', 'paused'].includes(this.status);
});

consultationSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

consultationSchema.virtual('isCancelled').get(function () {
  return ['cancelled', 'missed', 'no_show_patient', 'no_show_doctor', 'technical_failure'].includes(this.status);
});

consultationSchema.virtual('isLive').get(function () {
  return this.status === 'in_progress';
});

consultationSchema.virtual('prescriptionCount').get(function () {
  return this.prescriptions?.length ?? 0;
});

consultationSchema.virtual('needsTokenRefresh').get(function () {
  if (!this.agora?.tokenExpiresAt) return false;
  return new Date() > new Date(this.agora.tokenExpiresAt.getTime() - 5 * 60 * 1000); // refresh 5min early
});

consultationSchema.virtual('isVideoType').get(function () {
  return ['video'].includes(this.consultationType);
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

consultationSchema.pre('validate', function () {
  if (this.consultationType === 'video' || this.consultationType === 'audio') {
    if (!this.agora?.channelName) {
      // Channel name auto-generated in pre-save — skip throw here
    }
  }

  if (this.isFollowUp && !this.parentConsultation) {
    throw new Error('follow_up consultation requires parentConsultation');
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

consultationSchema.pre('save', async function () {
  // 1. Auto-generate consultationCode
  if (this.isNew && !this.consultationCode) {
    let code, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error('consultationCode generation failed');
      code   = `CS-${generateConsultId()}`;
      exists = await mongoose.model('Consultation').exists({ consultationCode: code });
    } while (exists);
    this.consultationCode = code;
  }

  // 2. Auto-generate Agora channel name
  if (this.isNew && (this.consultationType === 'video' || this.consultationType === 'audio')) {
    if (!this.agora) this.agora = {};
    if (!this.agora.channelName) {
      this.agora.channelName = `consult_${this._id.toString()}`;
      this.agora.rtmChannelName = `rtm_${this._id.toString()}`;
    }
  }

  // 3. Auto-compute autoMissedAt
  if (this.isNew && this.scheduledAt && !this.autoMissedAt) {
    const missed = new Date(this.scheduledAt);
    missed.setMinutes(missed.getMinutes() + (this.gracePeriodMin || 10));
    this.autoMissedAt = missed;
  }

  // 4. statusLog
  if (this.isModified('status') && !this.isNew) {
    const last       = this.statusLog?.[this.statusLog.length - 1];
    const fromStatus = last?.toStatus ?? null;
    this.statusLog.push({
      fromStatus,
      toStatus:  this.status,
      changedBy: this.updatedBy || null,
      changedAt: new Date(),
    });
  }

  // 5. Auto-set sessionStartedAt / sessionEndedAt
  if (this.isModified('status')) {
    if (this.status === 'in_progress' && !this.sessionStartedAt) {
      this.sessionStartedAt = new Date();
    }
    if (this.status === 'completed' && !this.sessionEndedAt) {
      this.sessionEndedAt = new Date();
      if (this.sessionStartedAt) {
        this.actualDurationSec = Math.round(
          (this.sessionEndedAt - this.sessionStartedAt) / 1000
        );
      }
    }
  }

  // 6. Sync isRated
  if (this.isModified('rating') && this.rating?.doctorRating) {
    this.isRated = true;
    this.rating.ratedAt = this.rating.ratedAt ?? new Date();
  }

  // 7. Doctor snapshot on first assignment
  if (this.isModified('doctor') && this.doctor && !this.doctorSnapshot?.name) {
    const DoctorProfile = mongoose.model('DoctorProfile');
    const doc = await DoctorProfile.findById(this.doctor)
      .populate('user', 'name phone')
      .select('specialization registrationNumber profilePhotoUrl qualifications')
      .lean();
    if (doc) {
      this.doctorSnapshot = {
        name:               doc.user?.name,
        specialization:     doc.specialization,
        registrationNumber: doc.registrationNumber,
        profilePhotoUrl:    doc.profilePhotoUrl,
        qualifications:     doc.qualifications,
        phone:              doc.user?.phone,
      };
      this.doctorUser = doc.user?._id;
    }
  }

  // 8. Patient snapshot on first assignment
  if (this.isModified('patient') && this.patient && !this.patientSnapshot?.name) {
    const User = mongoose.model('User');
    const u = await User.findById(this.patient)
      .select('name phone')
      .lean();
    if (u) {
      this.patientSnapshot = {
        name:  u.name,
        phone: u.phone,
      };
    }
  }

  // 9. Sync sessionMetrics chatMessagesCount
  if (this.isModified('chatMessages')) {
    if (!this.sessionMetrics) this.sessionMetrics = {};
    this.sessionMetrics.chatMessagesCount = this.chatMessages.length;
  }

  // 10. Sync sessionMetrics flags on completion
  if (this.isModified('status') && this.status === 'completed') {
    if (!this.sessionMetrics) this.sessionMetrics = {};
    this.sessionMetrics.prescriptionIssued = (this.prescriptions?.length ?? 0) > 0;
    this.sessionMetrics.labOrderIssued     = (this.labOrders?.length ?? 0) > 0;
    this.sessionMetrics.referralIssued     = !!this.clinicalNotes?.referralTo;
    this.sessionMetrics.videoEnabled       = this.consultationType === 'video';
    this.sessionMetrics.audioEnabled       = ['video', 'audio'].includes(this.consultationType);
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

consultationSchema.index({ doctor: 1, scheduledAt: 1 });
consultationSchema.index({ doctor: 1, status: 1 });
consultationSchema.index({ patient: 1, scheduledAt: -1 });
consultationSchema.index({ patient: 1, status: 1 });
consultationSchema.index({ booking: 1 });
consultationSchema.index({ hospital: 1, scheduledAt: 1 });
consultationSchema.index({ status: 1, scheduledAt: 1 });
consultationSchema.index({ status: 1, autoMissedAt: 1 });   // cron: auto-miss job
consultationSchema.index({ urgency: 1, status: 1 });
consultationSchema.index({ isEmergency: 1, status: 1 });
consultationSchema.index({ parentConsultation: 1 });
consultationSchema.index({ createdAt: -1 });
consultationSchema.index({ 'agora.channelName': 1 });        // Agora webhook lookup
consultationSchema.index({ 'agora.cloudRecordingSid': 1 });  // recording callback lookup
consultationSchema.index({ consultationType: 1, status: 1, scheduledAt: 1 });

const Consultation = mongoose.model('Consultation', consultationSchema);
export default Consultation;