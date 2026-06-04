// routes/consultation.routes.js
 

import express from 'express';
import Consultation from '../models/Consultation.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import upload from '../middleware/upload.js'; // Ensure this maps to your Multer S3/Local config
import DoctorProfile from '../models/DoctorProfile.js';
import { emitToConsultation, emitToDoctor } from '../sockets/consultationSocket.js';
import {
  createConsultation,
  getConsultationById,
  listConsultations,
  updateConsultation,
  transitionStatus,
  enterWaitingRoom,
  leaveWaitingRoom,
  getWaitingRoomStatus,
  participantJoin,
  participantLeave,
  provisionTokens,
  getTokensForParticipant,
  forceRefreshTokens,
  addExtraParticipant,
  handleRecordingConsent,
  handleAgoraWebhook,
  startRecording,
  stopRecording,
  getRecordingUrls,
  getParticipants,
  removeExtraParticipant,
  getParticipantEvents,
  updateParticipantNetworkQuality,
  saveVitals,
  saveNotes,
  getNotes,
  issuePrescription,
  getPrescriptions,
  saveReferral,
  getReferral,
  sendChatMessage,
  getChatHistory,
  deleteChatMessage,
  submitRating,
  getRating,
  editRating,
  saveMetrics,
  getMetrics,
  createFollowUp,
  getFollowUpHistory,
  getDoctorSchedule,
  getDoctorStats,
  getActiveSessions,
  getPlatformStats,
  assignAdmin,
  overrideStatus,
  runAutoMiss,
  runTokenRefresh,
  runReminders,
  runExpirePrescriptions,
  getScreenShareToken,
} from '../services/consultationService.js';

const router = express.Router();

// ── Shared role sets ──────────────────────────────────────────────────────────
const ADMIN_ROLES   = ['admin', 'superadmin'];
const DOCTOR_ROLES  = ['doctor'];
const PATIENT_ROLES = ['customer'];
const CRON_KEY      = process.env.CRON_SECRET || 'cron-secret-key';

// ── Cron auth middleware (header-based, not JWT) ──────────────────────────────
const cronAuth = (req, res, next) => {
  const key = req.headers['x-cron-key'];
  if (key !== CRON_KEY) return res.status(401).json({ message: 'Unauthorized cron key' });
  next();
};

// ── Response helpers ──────────────────────────────────────────────────────────
const ok   = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const fail = (res, message, status = 400) => res.status(status).json({ success: false, message });

// ═══════════════════════════════════════════════════════════════════════════════
// ── AGORA WEBHOOK (no auth — Agora sends raw POST) ────────────────────────────
// Must be FIRST before any protect middleware to get rawBody
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/agora/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['agora-signature'];
    const timestamp = req.headers['agora-timestamp'];
    const rawBody   = req.body;

    const result = await handleAgoraWebhook(rawBody.toString(), signature, timestamp);
    ok(res, result);
  })
);

// ── All routes below require JWT auth ─────────────────────────────────────────
router.use(protect);

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOBS (x-cron-key header, no JWT role check)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/cron/auto-miss',           cronAuth, asyncHandler(async (req, res) => {
  const result = await runAutoMiss();
  ok(res, result);
}));

router.post('/cron/token-refresh',       cronAuth, asyncHandler(async (req, res) => {
  const result = await runTokenRefresh();
  ok(res, result);
}));

router.post('/cron/reminders',           cronAuth, asyncHandler(async (req, res) => {
  const result = await runReminders();
  ok(res, result);
}));

router.post('/cron/expire-prescriptions',cronAuth, asyncHandler(async (req, res) => {
  const result = await runExpirePrescriptions();
  ok(res, result);
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/admin/all', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type, doctorId, patientId, from, to } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.consultationType = type;
  if (doctorId) filter.doctor = doctorId;
  if (patientId) filter.patient = patientId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to) filter.scheduledAt.$lte = new Date(to);
  }
  const result = await listConsultations({
    filter, page: +page, limit: +limit,
    cacheKeyPrefix: `consultations:admin`,
  });
  ok(res, result);
}));

router.get('/admin/upcoming', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const result = await listConsultations({
    filter: { status: 'scheduled', scheduledAt: { $lte: in24h, $gte: new Date() } },
    sort: { scheduledAt: 1 },
    limit: 100,
  });
  ok(res, result);
}));

router.get('/admin/active', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const sessions = await getActiveSessions();
  ok(res, { sessions });
}));

router.get('/admin/stats', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const stats = await getPlatformStats();
  ok(res, { stats });
}));

router.post('/admin/:id/assign', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { adminId } = req.body;
  if (!adminId) return fail(res, 'adminId required');
  const c = await assignAdmin(req.params.id, adminId, req.user._id.toString());
  ok(res, { consultation: c });
}));

router.patch('/admin/:id/override-status', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!status) return fail(res, 'status required');
  const c = await overrideStatus(req.params.id, status, reason, req.user._id.toString());
  ok(res, { consultation: c });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/doctor/schedule', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const schedule = await getDoctorSchedule(req.user._id.toString());
  ok(res, { schedule });
}));

router.get('/doctor/history', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await listConsultations({
    filter: {
      doctorUser: req.user._id,
      status: { $in: ['completed', 'cancelled', 'missed', 'no_show_patient', 'no_show_doctor'] },
    },
    page: +page, limit: +limit,
    sort: { scheduledAt: -1 },
    cacheKeyPrefix: `consultations:doctor:${req.user._id}:history`,
  });
  ok(res, result);
}));

router.get('/doctor/stats', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!dp) return fail(res, 'DoctorProfile not found', 404);
  const stats = await getDoctorStats(dp._id.toString());
  ok(res, { stats });
}));

router.get('/doctor/active', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const sessions = await getActiveSessions({ doctorUser: req.user._id });
  ok(res, { sessions });
}));

router.get('/doctor/my', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { doctorUser: req.user._id };
  if (status) filter.status = status;
  const result = await listConsultations({
    filter, page: +page, limit: +limit,
    cacheKeyPrefix: `consultations:doctor:${req.user._id}`,
  });
  ok(res, result);
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/patient/history', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await listConsultations({
    filter: {
      patient: req.user._id,
      status: { $in: ['completed', 'cancelled', 'missed', 'no_show_patient', 'no_show_doctor'] },
    },
    page: +page, limit: +limit,
    sort: { scheduledAt: -1 },
    cacheKeyPrefix: `consultations:patient:${req.user._id}:history`,
  });
  ok(res, result);
}));

router.get('/patient/upcoming', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const result = await listConsultations({
    filter: {
      patient: req.user._id,
      status: { $in: ['scheduled', 'waiting', 'doctor_joined', 'patient_joined'] },
      scheduledAt: { $gte: new Date() },
    },
    sort: { scheduledAt: 1 },
    limit: 20,
    cacheKeyPrefix: `consultations:patient:${req.user._id}:upcoming`,
  });
  ok(res, result);
}));

router.get('/patient/active', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const sessions = await getActiveSessions({ patient: req.user._id });
  ok(res, { sessions });
}));

router.get('/my', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { patient: req.user._id };
  if (status) filter.status = status;
  const result = await listConsultations({
    filter, page: +page, limit: +limit,
    cacheKeyPrefix: `consultations:patient:${req.user._id}`,
  });
  ok(res, result);
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTATION CRUD
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/create', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const { consultation, agoraTokens } = await createConsultation(req.body, req.user._id.toString());
  ok(res, { consultation, agoraTokens }, 201);
}));

router.get('/booking/:bookingId', asyncHandler(async (req, res) => {
  const c = await Consultation.findOne({ booking: req.params.bookingId })
    .populate('doctor', 'user specialization profilePhotoUrl')
    .populate('patient', 'name phone avatar')
    .populate('prescriptions', 'rxNumber status')
    .lean({ virtuals: true });
  if (!c) return fail(res, 'Consultation not found for this booking', 404);
  ok(res, { consultation: c });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const c = await getConsultationById(req.params.id);
  ok(res, { consultation: c });
}));

router.patch('/:id', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const c = await updateConsultation(req.params.id, req.body, req.user._id.toString());
  ok(res, { consultation: c });
}));

router.delete('/:id', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const c = await transitionStatus(req.params.id, 'cancelled', {
    actor: req.user._id.toString(),
    reason: reason || 'Deleted by admin',
    metadata: { cancelledBy: 'admin' },
  });
  ok(res, { cancelled: true, consultation: c });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AGORA SESSION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/agora/provision', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const tokens = await provisionTokens(req.params.id, req.user._id.toString());
  ok(res, tokens);
}));

router.get('/:id/agora/tokens', asyncHandler(async (req, res) => {
  const tokens = await getTokensForParticipant(req.params.id, req.user._id.toString(), req.user.role);
  ok(res, { tokens });
}));

// NEW: Endpoint to fetch dedicated screen-share token
router.post('/:id/agora/screen-token', asyncHandler(async (req, res) => {
  const { uid } = req.body;
  if (!uid) return fail(res, 'Screen UID is required', 400);

  const role = req.user.role === 'doctor' ? 'doctor' : 'patient';
  
  const tokenData = await getScreenShareToken(
    req.params.id, 
    uid, 
    req.user._id.toString(), 
    role
  );
  
  ok(res, tokenData);
}));

router.post('/:id/agora/refresh', asyncHandler(async (req, res) => {
  const result = await forceRefreshTokens(req.params.id, req.user._id.toString());
  ok(res, result);
}));

router.post('/:id/agora/recording-consent', asyncHandler(async (req, res) => {
  const { consented } = req.body;
  const who = req.user.role === 'doctor' ? 'doctor' : 'patient';
  const result = await handleRecordingConsent(req.params.id, who, consented, req.user._id.toString());
  ok(res, result);
}));

router.post('/:id/agora/recording/start', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const result = await startRecording(req.params.id, req.user._id.toString());
  ok(res, result);
}));

router.post('/:id/agora/recording/stop', authorize(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const result = await stopRecording(req.params.id, req.user._id.toString());
  ok(res, result);
}));

router.get('/:id/agora/recording', asyncHandler(async (req, res) => {
  const result = await getRecordingUrls(req.params.id);
  ok(res, result);
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/waiting-room/enter', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const c = await enterWaitingRoom(req.params.id, req.user._id.toString());
  emitToDoctor(c.doctorUser?.toString(), 'consultation:patient-waiting', {
    consultationId: req.params.id,
    patientId: req.user._id,
    patientName: req.user.name,
  });
  ok(res, { status: c.status, waitingRoom: c.waitingRoom });
}));

router.post('/:id/waiting-room/leave', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const c = await leaveWaitingRoom(req.params.id, req.user._id.toString());
  ok(res, { waitingRoom: c.waitingRoom });
}));

router.post('/:id/waiting-room/status', asyncHandler(async (req, res) => {
  const status = await getWaitingRoomStatus(req.params.id);
  ok(res, status);
}));

router.post('/:id/join', asyncHandler(async (req, res) => {
  const { deviceInfo } = req.body;
  const role = ['doctor', 'admin'].includes(req.user.role) ? 'doctor' : 'patient';
  const { consultation, tokens } = await participantJoin(
    req.params.id,
    req.user._id.toString(),
    role,
    deviceInfo || {},
  );
  emitToConsultation(req.params.id, 'consultation:participant-joined', {
    userId: req.user._id,
    role,
    status: consultation.status,
  });
  ok(res, { status: consultation.status, tokens });
}));

router.post('/:id/leave', asyncHandler(async (req, res) => {
  const role = req.user.role === 'doctor' ? 'doctor' : 'patient';
  const c = await participantLeave(req.params.id, req.user._id.toString(), role, req.body?.metrics || {});
  ok(res, { status: c.status });
}));

router.post('/:id/start', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'in_progress', { actor: req.user._id.toString() });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status });
}));

router.post('/:id/end', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'completed', { actor: req.user._id.toString() });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status, actualDurationSec: c.actualDurationSec });
}));

router.post('/:id/pause', asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'paused', { actor: req.user._id.toString() });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status });
}));

router.post('/:id/resume', asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'in_progress', { actor: req.user._id.toString() });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status });
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const cancelledBy = req.user.role === 'customer' ? 'patient' : req.user.role;
  const c = await transitionStatus(req.params.id, 'cancelled', {
    actor: req.user._id.toString(),
    reason,
    metadata: { cancelledBy, refundable: req.body.refundable ?? false },
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status, reason });
  ok(res, { status: c.status });
}));

router.post('/:id/no-show', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const { who = 'patient' } = req.body;
  const toStatus = who === 'doctor' ? 'no_show_doctor' : 'no_show_patient';
  const c = await transitionStatus(req.params.id, toStatus, {
    actor: req.user._id.toString(),
    reason: req.body.reason,
  });
  ok(res, { status: c.status });
}));

router.post('/:id/technical-failure', asyncHandler(async (req, res) => {
  const { errorDetails } = req.body;
  const c = await transitionStatus(req.params.id, 'technical_failure', {
    actor: req.user._id.toString(),
    reason: errorDetails || 'Technical failure reported',
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status, errorDetails });
  ok(res, { status: c.status });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/participants', asyncHandler(async (req, res) => {
  const participants = await getParticipants(req.params.id);
  ok(res, participants);
}));

router.post('/:id/participants', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) return fail(res, 'userId and role required');
  const tokens = await addExtraParticipant(req.params.id, userId, role, req.user._id.toString());
  emitToConsultation(req.params.id, 'consultation:participant-added', { userId, role });
  ok(res, { tokens }, 201);
}));

router.delete('/:id/participants/:userId', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const result = await removeExtraParticipant(req.params.id, req.params.userId, req.user._id.toString());
  emitToConsultation(req.params.id, 'consultation:participant-removed', { userId: req.params.userId });
  ok(res, result);
}));

router.get('/:id/participants/events', asyncHandler(async (req, res) => {
  const events = await getParticipantEvents(req.params.id);
  ok(res, { events });
}));

router.patch('/:id/participants/:userId/network-quality', asyncHandler(async (req, res) => {
  const { quality } = req.body;
  if (quality === undefined) return fail(res, 'quality required');
  const result = await updateParticipantNetworkQuality(req.params.id, req.params.userId, quality);
  ok(res, result);
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CLINICAL
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/vitals', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES, 'care_assistant'), asyncHandler(async (req, res) => {
  const vitals = await saveVitals(req.params.id, req.body, req.user._id.toString());
  emitToConsultation(req.params.id, 'consultation:vitals:update', { vitals });
  ok(res, { vitals });
}));

router.put('/:id/notes', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const notes = await saveNotes(req.params.id, req.body, req.user._id.toString());
  ok(res, { notes });
}));

router.get('/:id/notes', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const notes = await getNotes(req.params.id);
  ok(res, { notes });
}));

router.post('/:id/prescriptions', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const rx = await issuePrescription(req.params.id, req.body, req.user._id.toString());
  emitToConsultation(req.params.id, 'consultation:prescription:ready', {
    rxNumber: rx.rxNumber,
    rxId: rx._id,
  });
  ok(res, { prescription: rx }, 201);
}));

router.get('/:id/prescriptions', asyncHandler(async (req, res) => {
  const prescriptions = await getPrescriptions(req.params.id);
  ok(res, { prescriptions });
}));

router.post('/:id/referral', authorize(...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const referral = await saveReferral(req.params.id, req.body, req.user._id.toString());
  ok(res, { referral }, 201);
}));

router.get('/:id/referral', asyncHandler(async (req, res) => {
  const referral = await getReferral(req.params.id);
  ok(res, { referral });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// IN-SESSION CHAT & DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Uses upload.single('attachment') to handle files via multipart/form-data.
router.post('/:id/chat', upload.single('attachment'), asyncHandler(async (req, res) => {
  const role = req.user.role === 'doctor' ? 'doctor' : 'patient';
  
  let messageType = req.body.messageType || 'text';
  let attachmentUrl = null;
  let attachmentName = null;

  if (req.file) {
    attachmentUrl = req.file.path || req.file.location;
    attachmentName = req.file.originalname;
    messageType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
  }

  const messageData = {
    content: req.body.content,
    messageType,
    attachmentUrl,
    attachmentName,
  };

  const msg = await sendChatMessage(req.params.id, req.user._id.toString(), role, messageData);
  emitToConsultation(req.params.id, 'consultation:chat:message', msg);
  ok(res, { message: msg }, 201);
}));

router.get('/:id/chat', asyncHandler(async (req, res) => {
  const messages = await getChatHistory(req.params.id);
  ok(res, { messages });
}));

router.delete('/:id/chat/:messageId', asyncHandler(async (req, res) => {
  const result = await deleteChatMessage(req.params.id, req.params.messageId, req.user._id.toString());
  ok(res, result);
}));

// Generic Document Upload (e.g. previous lab reports)
router.post('/:id/documents', authorize(...DOCTOR_ROLES, ...PATIENT_ROLES), upload.array('documents', 5), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return fail(res, 'No files uploaded', 400);
  }
  
  const uploadedDocs = req.files.map(file => ({
    url: file.path || file.location,
    originalName: file.originalname,
    docType: req.body.docType || 'other',
  }));

  // Append to clinicalNotes.attachments (assuming schema allows mixed data or specific paths)
  await Consultation.findByIdAndUpdate(req.params.id, {
    $push: { 'clinicalNotes.attachments': { $each: uploadedDocs } }
  });

  ok(res, { documents: uploadedDocs });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// RATING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/rating', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const rating = await submitRating(req.params.id, req.user._id.toString(), req.body);
  ok(res, { rating }, 201);
}));

router.get('/:id/rating', asyncHandler(async (req, res) => {
  const result = await getRating(req.params.id);
  ok(res, result);
}));

router.patch('/:id/rating', authorize(...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const rating = await editRating(req.params.id, req.user._id.toString(), req.body);
  ok(res, { rating });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/metrics', asyncHandler(async (req, res) => {
  const metrics = await saveMetrics(req.params.id, req.body, req.user._id.toString());
  ok(res, { metrics });
}));

router.get('/:id/metrics', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), asyncHandler(async (req, res) => {
  const metrics = await getMetrics(req.params.id);
  ok(res, { metrics });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/follow-up', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES, ...PATIENT_ROLES), asyncHandler(async (req, res) => {
  const { consultation, agoraTokens } = await createFollowUp(req.params.id, req.body, req.user._id.toString());
  ok(res, { consultation, agoraTokens }, 201);
}));

router.get('/:id/follow-up/history', asyncHandler(async (req, res) => {
  const history = await getFollowUpHistory(req.params.id);
  ok(res, history);
}));

export default router;