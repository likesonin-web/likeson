// models/Consultation.model.js
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

const { Schema } = mongoose;

const generateConsultId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

// ── Constants ─────────────────────────────────────────────────────────────────

export const CONSULTATION_TYPES = [
  'video',
  'audio',
  'chat',
  'in_person',
  'home_visit',
];

export const CONSULTATION_STATUSES = [
  'scheduled',
  'waiting',
  'doctor_joined',
  'patient_joined',
  'in_progress',
  'paused',
  'completed',
  'missed',
  'cancelled',
  'no_show_patient',
  'no_show_doctor',
  'technical_failure',
];

export const URGENCY_LEVELS = ['routine', 'urgent', 'emergency'];
export const PARTICIPANT_ROLES = ['doctor', 'patient', 'interpreter', 'observer', 'caregiver'];

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const agoraSessionSchema = new Schema(
  {
    channelName:     { type: String, required: true },
    appId:           { type: String },

    doctorUid:       { type: Number },
    doctorRtcToken:  { type: String, select: false },
    doctorRtmToken:  { type: String, select: false },

    patientUid:      { type: Number },
    patientRtcToken: { type: String, select: false },
    patientRtmToken: { type: String, select: false },

    extraParticipants: [
      {
        uid:       { type: Number },
        role:      { type: String, enum: PARTICIPANT_ROLES },
        rtcToken:  { type: String, select: false },
        rtmToken:  { type: String, select: false },
      },
    ],

    tokenExpiresAt:    { type: Date },
    tokenRefreshCount: { type: Number, default: 0 },

    cloudRecordingResourceId: { type: String },
    cloudRecordingSid:        { type: String },
    cloudRecordingMode:       { type: String, enum: ['mix', 'individual', 'web'], default: 'mix' },
    recordingStartedAt:       { type: Date },
    recordingStoppedAt:       { type: Date },
    recordingFileUrls:        [{ type: String }],
    isRecordingEnabled:       { type: Boolean, default: false },
    recordingConsentDoctor:   { type: Boolean, default: false },
    recordingConsentPatient:  { type: Boolean, default: false },

    rtmChannelName:  { type: String },
  },
  { _id: false }
);

// ── NEW: Timer segment — one entry per in_progress segment ────────────────────
const timerSegmentSchema = new Schema(
  {
    startedAt:   { type: Date, required: true },
    pausedAt:    { type: Date },          // null = segment still running
    durationSec: { type: Number },        // filled when paused / ended
    reason:      { type: String },        // 'disconnect' | 'explicit_pause' | 'resume' | 'ended'
  },
  { _id: true }
);

// ── NEW: timerState — tracks net elapsed time across reconnects/pauses ─────────
const timerStateSchema = new Schema(
  {
    // Each continuous in_progress stretch gets one segment
    segments:                { type: [timerSegmentSchema], default: [] },
    // Net seconds in in_progress state (updated on pause/end)
    totalElapsedSec:         { type: Number, default: 0 },
    // When current segment started (fast-read without scanning segments)
    currentSegmentStartedAt: { type: Date },
    // Absolute wall-clock deadline = first sessionStartedAt + maxTimeMin * 60
    hardDeadlineAt:          { type: Date },
    // Whether the 15-min-remaining reminder was already sent
    reminderSent:            { type: Boolean, default: false },
    // Whether auto-end has already fired
    autoEnded:               { type: Boolean, default: false },
  },
  { _id: false }
);

// ── participantEventSchema — UPDATED with mute / kick fields ──────────────────
const participantEventSchema = new Schema(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:       { type: String, enum: PARTICIPANT_ROLES, required: true },
    agoraUid:   { type: Number },
    joinedAt:   { type: Date },
    leftAt:     { type: Date },
    durationSec:{ type: Number },
    deviceInfo: {
      platform:   { type: String },
      browser:    { type: String },
      os:         { type: String },
      sdkVersion: { type: String },
    },
    networkQuality:    { type: Number, min: 0, max: 6 },
    rejoinCount:       { type: Number, default: 0 },
    // Doctor-imposed audio mute
    isMutedByDoctor:   { type: Boolean, default: false },
    mutedByDoctorAt:   { type: Date },
    unmutedByDoctorAt: { type: Date },
    // Kick tracking
    isKicked:          { type: Boolean, default: false },
    kickedAt:          { type: Date },
    kickReason:        { type: String, trim: true },
  },
  { _id: true, timestamps: false }
);

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
    deviceSource:           { type: String },
  },
  { _id: false }
);

const clinicalNotesSchema = new Schema(
  {
    chiefComplaint:  { type: String, trim: true, maxlength: 500 },
    subjective:      { type: String, trim: true, maxlength: 2000 },
    objective:       { type: String, trim: true, maxlength: 2000 },
    assessment:      { type: String, trim: true, maxlength: 2000 },
    plan:            { type: String, trim: true, maxlength: 2000 },
    diagnosisCodes:  [{ code: String, description: String }],
    lifestyleAdvice: { type: String, trim: true, maxlength: 1000 },
    dietAdvice:      { type: String, trim: true, maxlength: 500 },
    referralTo:      { type: String, trim: true },
    referralNote:    { type: String, trim: true, maxlength: 500 },
    followUpInDays:  { type: Number, min: 1 },
    followUpNote:    { type: String, trim: true, maxlength: 300 },
    privateNotes:    { type: String, trim: true, maxlength: 1000, select: false },
    lastEditedAt:    { type: Date },
  },
  { _id: false }
);

const waitingRoomSchema = new Schema(
  {
    patientEnteredAt: { type: Date },
    doctorNotifiedAt: { type: Date },
    estimatedWaitMin: { type: Number },
    queuePosition:    { type: Number },
    patientReadyAt:   { type: Date },
    doctorReadyAt:    { type: Date },
    patientLeft:      { type: Boolean, default: false },
    patientLeftAt:    { type: Date },
  },
  { _id: false }
);

const consultationFeeSchema = new Schema(
  {
    consultationFee: { type: Number, default: 0, min: 0 },
    platformFee:     { type: Number, default: 0, min: 0 },
    taxes:           { type: Number, default: 0, min: 0 },
    discount:        { type: Number, default: 0, min: 0 },
    totalAmount:     { type: Number, default: 0, min: 0 },
    currency:        { type: String, default: 'INR' },
    isPaid:          { type: Boolean, default: false },
    paidAt:          { type: Date },
    paymentRef:      { type: String },
  },
  { _id: false }
);

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

const ratingSchema = new Schema(
  {
    doctorRating:    { type: Number, min: 1, max: 5 },
    doctorFeedback:  { type: String, trim: true, maxlength: 500 },
    patientRating:   { type: Number, min: 1, max: 5 },
    patientFeedback: { type: String, trim: true, maxlength: 200, select: false },
    overallRating:   { type: Number, min: 1, max: 5 },
    tags:            [{ type: String, trim: true }],
    ratedAt:         { type: Date },
    isPublic:        { type: Boolean, default: true },
  },
  { _id: false }
);

const sessionMetricsSchema = new Schema(
  {
    totalDurationSec:   { type: Number },
    doctorTalkTimeSec:  { type: Number },
    patientTalkTimeSec: { type: Number },
    avgNetworkQuality:  { type: Number },
    reconnectCount:     { type: Number, default: 0 },
    videoEnabled:       { type: Boolean },
    audioEnabled:       { type: Boolean },
    chatMessagesCount:  { type: Number, default: 0 },
    prescriptionIssued: { type: Boolean, default: false },
    labOrderIssued:     { type: Boolean, default: false },
    referralIssued:     { type: Boolean, default: false },
    doctorAvgFrameRate: { type: Number },
    patientAvgFrameRate:{ type: Number },
    doctorPacketLoss:   { type: Number },
    patientPacketLoss:  { type: Number },
  },
  { _id: false }
);

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
      type:      String,
      unique:    true,
      sparse:    true,
      index:     true,
      uppercase: true,
      trim:      true,
    },

    consultationType: {
      type:     String,
      required: true,
      enum:     CONSULTATION_TYPES,
      index:    true,
    },

    // ── Linkage ───────────────────────────────────────────────────────────────
    booking:       { type: Schema.Types.ObjectId, ref: 'Booking',         index: true },
    outPatientRecord: { type: Schema.Types.ObjectId, ref: 'OutPatientRecord', index: true },

    // ── Parties ───────────────────────────────────────────────────────────────
    doctor:     { type: Schema.Types.ObjectId, ref: 'DoctorProfile', required: true, index: true },
    doctorUser: { type: Schema.Types.ObjectId, ref: 'User',          index: true },
    patient:    { type: Schema.Types.ObjectId, ref: 'User',          required: true, index: true },
    hospital:   { type: Schema.Types.ObjectId, ref: 'Hospital',      index: true },

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
    scheduledAt:     { type: Date, required: true, index: true },
    slotId:          { type: Schema.Types.ObjectId, default: null },
    slotDurationMin: { type: Number, default: 15 },

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

    statusLog:  { type: [statusLogSchema], default: [] },
    waitingRoom:{ type: waitingRoomSchema, default: () => ({}) },

    gracePeriodMin: { type: Number, default: 10 },
    autoMissedAt:   { type: Date },

    sessionStartedAt:  { type: Date },
    sessionEndedAt:    { type: Date },
    actualDurationSec: { type: Number },

    // ── NEW: Auto-end timestamp (set when cron fires due to max time) ──────────
    autoEndedAt: { type: Date, default: null },

    // ── Agora ─────────────────────────────────────────────────────────────────
    agora: { type: agoraSessionSchema, default: null },

    // ── NEW: Consultation Timer ───────────────────────────────────────────────
    // Tracks net active (in_progress) time, surviving reconnects and pauses.
    // hardDeadlineAt = first sessionStartedAt + CONSULTATION_MAX_TIME_MIN * 60
    timerState: { type: timerStateSchema, default: () => ({}) },

    // ── Participants ──────────────────────────────────────────────────────────
    participantEvents: { type: [participantEventSchema], default: [] },

    additionalParticipants: [
      {
        userId:  { type: Schema.Types.ObjectId, ref: 'User' },
        role:    { type: String, enum: PARTICIPANT_ROLES },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // ── In-Session Chat ───────────────────────────────────────────────────────
    chatMessages: { type: [chatMessageSchema], default: [] },

    // ── Vitals ────────────────────────────────────────────────────────────────
    vitals: { type: vitalsSchema, default: null },

    // ── Clinical ──────────────────────────────────────────────────────────────
    clinicalNotes: { type: clinicalNotesSchema, default: () => ({}) },

    // ── Prescriptions ─────────────────────────────────────────────────────────
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
      scheduledConfirmation:  { type: Boolean, default: false },
      reminderPatient15min:   { type: Boolean, default: false },
      reminderDoctor15min:    { type: Boolean, default: false },
      sessionStarted:         { type: Boolean, default: false },
      sessionEnded:           { type: Boolean, default: false },
      prescriptionReady:      { type: Boolean, default: false },
      ratingRequest:          { type: Boolean, default: false },
      // NEW: fires when ≤15 min of consultation time remains (max-time countdown)
      maxTimeReminder15min:   { type: Boolean, default: false },
    },

    // ── Consent & Compliance ──────────────────────────────────────────────────
    recordingConsent: {
      doctorConsented:  { type: Boolean, default: false },
      patientConsented: { type: Boolean, default: false },
      consentTimestamp: { type: Date },
    },

    hipaaAcknowledged:    { type: Boolean, default: false },
    consentFormSignedUrl: { type: String },

    // ── Flags ──────────────────────────────────────────────────────────────────
    isEmergency:        { type: Boolean, default: false, index: true },
    isFollowUp:         { type: Boolean, default: false },
    parentConsultation: { type: Schema.Types.ObjectId, ref: 'Consultation', default: null, index: true },
    isTestSession:      { type: Boolean, default: false },

    // ── Admin ─────────────────────────────────────────────────────────────────
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
  return new Date() > new Date(this.agora.tokenExpiresAt.getTime() - 5 * 60 * 1000);
});

consultationSchema.virtual('isVideoType').get(function () {
  return ['video'].includes(this.consultationType);
});

// NEW: Remaining seconds = hardDeadlineAt - now, clamped to 0
consultationSchema.virtual('remainingTimeSec').get(function () {
  if (!this.timerState?.hardDeadlineAt) return null;
  const remaining = Math.floor((this.timerState.hardDeadlineAt - Date.now()) / 1000);
  return Math.max(0, remaining);
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

consultationSchema.pre('validate', function () {
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
      this.agora.channelName    = `consult_${this._id.toString()}`;
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

  // 5. Auto-set sessionStartedAt / sessionEndedAt + timer management
  if (this.isModified('status')) {
    const maxTimeMin = parseInt(process.env.CONSULTATION_MAX_TIME_MIN || '30', 10);

   if (this.status === 'in_progress') {
  if (!this.sessionStartedAt) {
    this.sessionStartedAt = new Date();
  }

  // Start new segment (every in_progress entry = new segment)
  if (!this.timerState) this.timerState = {};
  if (!this.timerState.segments) this.timerState.segments = [];
  const now = new Date();
  this.timerState.segments.push({ startedAt: now, reason: 'resumed' });
  this.timerState.currentSegmentStartedAt = now;

  // hardDeadlineAt = dynamically computed = now + remainingSeconds
  // Only set on very first start (no elapsed yet)
  if (!this.timerState.hardDeadlineAt) {
    this.timerState.hardDeadlineAt = new Date(
      now.getTime() + maxTimeMin * 60 * 1000
    );
  } else {
    // Recompute deadline = now + remaining (elapsed already subtracted)
    const elapsed = this.timerState.totalElapsedSec || 0;
    const remaining = Math.max(0, maxTimeMin * 60 - elapsed);
    this.timerState.hardDeadlineAt = new Date(now.getTime() + remaining * 1000);
  }
}

   if (this.status === 'paused') {
  if (this.timerState?.currentSegmentStartedAt) {
    const now = new Date();
    const lastSeg = this.timerState.segments?.[this.timerState.segments.length - 1];
    if (lastSeg && !lastSeg.pausedAt) {
      lastSeg.pausedAt    = now;
      lastSeg.durationSec = Math.round((now - new Date(lastSeg.startedAt).getTime()) / 1000);
      lastSeg.reason      = 'paused';
    }
    this.timerState.totalElapsedSec = (this.timerState.segments || []).reduce(
      (sum, s) => sum + (s.durationSec || 0), 0
    );
    this.timerState.currentSegmentStartedAt = undefined;
    // Clear deadline — meaningless while paused
    this.timerState.hardDeadlineAt = undefined;
  }
}

    // Completing — close segment + compute totals
    if (this.status === 'completed') {
      if (!this.sessionEndedAt) this.sessionEndedAt = new Date();
      if (this.sessionStartedAt) {
        this.actualDurationSec = Math.round(
          (this.sessionEndedAt - this.sessionStartedAt) / 1000
        );
      }
      // Close open timer segment
      if (this.timerState?.currentSegmentStartedAt) {
        const now = new Date();
        const lastSeg = this.timerState.segments?.[this.timerState.segments.length - 1];
        if (lastSeg && !lastSeg.pausedAt) {
          lastSeg.pausedAt    = now;
          lastSeg.durationSec = Math.round((now - lastSeg.startedAt) / 1000);
          lastSeg.reason      = 'ended';
        }
        this.timerState.totalElapsedSec = (this.timerState.segments || []).reduce(
          (sum, s) => sum + (s.durationSec || 0), 0
        );
        this.timerState.currentSegmentStartedAt = undefined;
      }
    }
  }

  // 6. Sync isRated
  if (this.isModified('rating') && this.rating?.doctorRating) {
    this.isRated        = true;
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
    const u = await User.findById(this.patient).select('name phone').lean();
    if (u) {
      this.patientSnapshot = { name: u.name, phone: u.phone };
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
consultationSchema.index({ status: 1, autoMissedAt: 1 });
consultationSchema.index({ urgency: 1, status: 1 });
consultationSchema.index({ isEmergency: 1, status: 1 });
consultationSchema.index({ parentConsultation: 1 });
consultationSchema.index({ createdAt: -1 });
consultationSchema.index({ 'agora.channelName': 1 });
consultationSchema.index({ 'agora.cloudRecordingSid': 1 });
consultationSchema.index({ consultationType: 1, status: 1, scheduledAt: 1 });
// NEW: cron indexes for timer jobs
consultationSchema.index({ 'timerState.hardDeadlineAt': 1, status: 1 });
consultationSchema.index({ 'timerState.reminderSent': 1, status: 1 });

const Consultation = mongoose.model('Consultation', consultationSchema);
export default Consultation;