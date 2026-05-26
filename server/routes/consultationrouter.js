/**
 * consultationRoutes.js
 *
 * ENTERPRISE TELEMEDICINE CONSULTATION ROUTER
 * Fully standalone — zero Booking.onlineConsultation usage.
 * All logic operates on Consultation model directly.
 *
 * Mount: app.use('/api/consultations', consultationRouter)
 */

import express        from 'express';
import mongoose       from 'mongoose';

import Consultation   from '../models/Consultation.js';
import Booking        from '../models/Booking.js';
import DoctorProfile  from '../models/DoctorProfile.js';
import Hospital       from '../models/Hospital.js';
 
import EPrescription  from '../models/EPrescription.js';
import Notification   from '../models/Notification.js';

import { protect, authorize }                    from '../middleware/authMiddleware.js';
import { generateAgoraToken, createAgoraRoom }   from '../services/agoraService.js';
import { getConsultationSocketService, rooms }   from '../services/consultationSocketService.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const isAdmin   = (req) => ['admin', 'superadmin'].includes(req.user.role);

/** Resolve DoctorProfile._id from User._id */
const resolveDoctorProfile = async (userId) => {
  return DoctorProfile.findOne({ user: userId }).select('_id user primaryHospital specialty').lean();
};

/**
 * assertConsultationAccess
 * Returns consultation doc or sends 403/404.
 * Returns null if response already sent.
 */
const assertConsultationAccess = async (req, res, options = {}) => {
  const { consultationId } = req.params;
  const { requireStatus, select = '' } = options;

  const query = isValidId(consultationId)
    ? { $or: [{ _id: consultationId }, { consultationId }] }
    : { consultationId };

  const consultation = await Consultation.findOne(query)
    .select(`patient doctor hospital status consultationId bookingId ${select}`)
    .lean();

  if (!consultation) {
    res.status(404).json({ success: false, message: 'Consultation not found' });
    return null;
  }

  if (requireStatus && !requireStatus.includes(consultation.status)) {
    res.status(400).json({
      success: false,
      message: `Operation not allowed — consultation is '${consultation.status}'`,
    });
    return null;
  }

  const { _id: userId, role } = req.user;

  if (isAdmin(req)) return consultation;

  // Patient check
  if (consultation.patient?.toString() === userId.toString()) return consultation;

  // Doctor check
  if (role === 'doctor') {
    const dp = await resolveDoctorProfile(userId);
    if (dp && consultation.doctor?.toString() === dp._id.toString()) return consultation;
  }

  // Hospital check
  if (role === 'hospital') {
    const h = await Hospital.findOne({ managedBy: userId }).select('_id').lean();
    if (h && consultation.hospital?.toString() === h._id.toString()) return consultation;
  }

  res.status(403).json({ success: false, message: 'Forbidden' });
  return null;
};

/** Emit consultation socket event via service */
const emitConsultationEvent = (consultationId, event, payload = {}) => {
  const svc = getConsultationSocketService();
  if (!svc) return;
  svc.emitToConsultation(consultationId, event, payload);
  svc.emitToAdmins(event, { ...payload, _internal: true });
};

// ─────────────────────────────────────────────────────────────────────────────
// ── 1. POST /consultations — CREATE
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const {
        bookingId,
        consultationType = 'video',
        consultationMode = 'scheduled',
        scheduledStartTime,
        estimatedDurationMinutes = 30,
        chiefComplaint,
        symptoms = [],
        language = 'English',
        priority = 'routine',
        waitingRoomEnabled = true,
        recordingSupported = false,
      } = req.body;

      if (!bookingId || !isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Valid bookingId required' });
      if (!scheduledStartTime)
        return res.status(400).json({ success: false, message: 'scheduledStartTime required' });

      // Load booking — verify it exists and is confirmed
      const booking = await Booking.findById(bookingId)
        .select('customer doctor hospital status bookingType paymentStatus consultationSessionId bookingCode')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      if (!['confirmed', 'in_progress'].includes(booking.status))
        return res.status(400).json({ success: false, message: 'Booking must be confirmed' });

      if (booking.paymentStatus !== 'paid')
        return res.status(402).json({ success: false, message: 'Payment required' });

      // Prevent duplicate consultation creation
      if (booking.consultationSessionId) {
        const existing = await Consultation.findById(booking.consultationSessionId).lean();
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Consultation already exists for this booking',
            data: { consultationId: existing.consultationId },
          });
        }
      }

      // Resolve doctor profile
      const doctorProfileId = booking.doctor;
      if (!doctorProfileId)
        return res.status(400).json({ success: false, message: 'No doctor assigned to booking' });

      const dp = await DoctorProfile.findById(doctorProfileId).select('_id specialty').lean();

      // Create Agora room (channel)
      const { roomId, meetingId, meetingLink } = await createAgoraRoom(
        booking.bookingCode || bookingId,
        bookingId
      );

      // Build consultation document
      const consultation = new Consultation({
        bookingId:               booking._id,
        patient:                 booking.customer,
        doctor:                  doctorProfileId,
        hospital:                booking.hospital || null,
        consultationType,
        consultationMode,
        specialty:               dp?.specialty || '',
        language,
        priority,
        symptoms,
        chiefComplaint,
        scheduledStartTime:      new Date(scheduledStartTime),
        estimatedDurationMinutes,
        waitingRoomEnabled,
        recordingSupported,
        provider:                'Agora',
        roomId,
        meetingId,
        meetingLink,
        status:                  'scheduled',
        createdBy:               req.user._id,
      });

      await consultation.save();

      // Back-link in Booking
      await Booking.findByIdAndUpdate(bookingId, {
        $set: { consultationSessionId: consultation._id },
      });

      return res.status(201).json({
        success: true,
        message: 'Consultation created',
        data: {
          consultationId:     consultation.consultationId,
          _id:                consultation._id,
          status:             consultation.status,
          roomId,
          meetingId,
          meetingLink,
          scheduledStartTime: consultation.scheduledStartTime,
        },
      });
    } catch (err) {
      console.error('[POST /consultations]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 2. POST /consultations/:consultationId/join
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:consultationId/join',
  protect,
  authorize('customer', 'doctor', 'care_assistant', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { consultationId } = req.params;
      const { _id: userId, role } = req.user;

      // uid for Agora token — convert ObjectId to numeric uid (Agora requires uint)
      // Use last 8 hex chars of userId → parse as int, masked to 32-bit uint
      const agoraUid = parseInt(userId.toString().slice(-8), 16) >>> 0;

      const consultation = await Consultation.findOne({ consultationId })
        // In the join route, you select these fields:
       .select('+hostToken +participantToken patient doctor status telemedicineConsentAccepted waitingRoomEnabled roomId meetingId meetingLink estimatedDurationMinutes consents participants')
        .lean();

      if (!consultation)
        return res.status(404).json({ success: false, message: 'Consultation not found' });

      if (['cancelled', 'failed', 'expired', 'completed'].includes(consultation.status))
        return res.status(400).json({ success: false, message: `Consultation is ${consultation.status}` });

      // Determine participantRole
      let participantRole = null;
      let isHost = false;

      if (isAdmin(req)) {
        participantRole = 'admin';
        isHost = true;
      } else if (role === 'doctor') {
        const dp = await resolveDoctorProfile(userId);
        if (!dp || dp._id.toString() !== consultation.doctor?.toString())
          return res.status(403).json({ success: false, message: 'Not your consultation' });
        participantRole = 'doctor';
        isHost = true;
      } else if (role === 'customer') {
        if (consultation.patient?.toString() !== userId.toString())
          return res.status(403).json({ success: false, message: 'Not your consultation' });
        participantRole = 'patient';
      } else if (role === 'care_assistant') {
        const inList = consultation.participants?.some(
          (p) => p.userId?.toString() === userId.toString()
        );
        if (!inList)
          return res.status(403).json({ success: false, message: 'Not authorized' });
        participantRole = 'care_assistant';
      }

      if (!participantRole)
        return res.status(403).json({ success: false, message: 'Forbidden' });

      // Patient must have telemedicine consent
      if (participantRole === 'patient' && !consultation.telemedicineConsentAccepted) {
        return res.status(400).json({
          success: false,
          message: 'Telemedicine consent required. POST /consultations/:id/consents first.',
        });
      }

      // Ensure room exists (idempotent)
      let { roomId, meetingId, meetingLink } = consultation;
      if (!roomId) {
        const room = await createAgoraRoom(consultationId, consultation._id.toString());
        roomId      = room.roomId;
        meetingId   = room.meetingId;
        meetingLink = room.meetingLink;
        await Consultation.findByIdAndUpdate(consultation._id, {
          $set: { roomId, meetingId, meetingLink },
        });
      }

      // Ensure meetingLink points to frontend (not SDK endpoint)
      if (!meetingLink || !meetingLink.startsWith(process.env.FRONTEND_URL || 'http://localhost:3000')) {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        meetingLink = `${baseUrl}/consultations/${consultationId}/room`;
      }

      // Generate Agora RTC token (2h = 7200s)
      const token = generateAgoraToken(
        roomId,
        isHost ? 'host' : 'participant',
        agoraUid,
        7200
      );

      // Waiting room determination
      const inWaitingRoom = participantRole === 'patient' &&
        consultation.waitingRoomEnabled &&
        consultation.status !== 'active';

      // Update status → waiting if first join
      if (consultation.status === 'scheduled') {
        await Consultation.findByIdAndUpdate(consultation._id, {
          $set: { status: 'waiting', consultationStage: 'waiting_room' },
        });
      }

      return res.json({
        success: true,
        data: {
          consultationId,
          roomId,          // Agora channelName
          meetingId,       // same as roomId for Agora
          meetingLink,
          token,           // Agora RTC token
          uid: agoraUid,   // must pass this uid when joining Agora channel
          participantRole,
          isHost,
          permissions: {
            canMute:        isHost,
            canKick:        isHost,
            canRecord:      isHost,
            canShareScreen: true,
            canChat:        true,
            canPrescribe:   participantRole === 'doctor',
          },
          rtcConfig: {
            provider:    'Agora',
            appId:       process.env.AGORAIO_APP_ID,
            channelName: roomId,
            uid:         agoraUid,
            codec:       'vp8',
            mode:        'rtc',
          },
          waitingRoomStatus:        inWaitingRoom ? 'in_waiting_room' : 'admitted',
          estimatedDurationMinutes: consultation.estimatedDurationMinutes,
          tokenExpiresIn:           '2h',
        },
      });
    } catch (err) {
      console.error('[POST /consultations/:id/join]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 3. GET /consultations/:consultationId
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/:consultationId',
  protect,
  authorize('customer', 'doctor', 'hospital', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const consultation = await assertConsultationAccess(req, res, {
        select: 'consultationType consultationMode specialty language symptoms chiefComplaint diagnosisSummary treatmentPlan followUpAdvice scheduledStartTime actualStartTime actualEndTime actualDurationMinutes estimatedDurationMinutes roomId meetingId meetingLink status consultationStage priority participants waitingRoomQueue chatMessages prescription recording attachments consents feedback isRated analytics createdAt',
      });
      if (!consultation) return;

      // Strip sensitive fields for non-admins
      if (!isAdmin(req)) {
        delete consultation.hostToken;
        delete consultation.participantToken;
        delete consultation.webhookSecret;
        delete consultation.internalAdminNotes;
        delete consultation.doctorInternalNotes;
        if (consultation.recording) {
          delete consultation.recording.recordingUrl;
          delete consultation.recording.storageKey;
          delete consultation.recording.storageBucket;
        }
      }

      return res.json({ success: true, data: consultation });
    } catch (err) {
      console.error('[GET /consultations/:id]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 4. GET /consultations/:consultationId/details
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/:consultationId/details',
  protect,
  authorize('customer', 'doctor', 'hospital', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const consultation = await Consultation.findById(base._id)
        .populate('patient', 'name email phone avatar')
        .populate('doctor',  'user specialization registrationNumber profilePhotoUrl fees')
        .populate('hospital','name contact address')
        .populate('bookingId', 'bookingCode bookingType scheduledAt paymentStatus fareBreakdown')
        .lean();

      if (!isAdmin(req)) {
        delete consultation.hostToken;
        delete consultation.participantToken;
        delete consultation.internalAdminNotes;
        delete consultation.doctorInternalNotes;
      }

      return res.json({ success: true, data: consultation });
    } catch (err) {
      console.error('[GET /consultations/:id/details]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 5. GET /consultations/:consultationId/participants
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/:consultationId/participants',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res, { select: 'participants' });
      if (!base) return;

      const consultation = await Consultation.findById(base._id)
        .select('participants consultationId')
        .lean();

      return res.json({ success: true, data: { participants: consultation.participants } });
    } catch (err) {
      console.error('[GET /consultations/:id/participants]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 6. GET /consultations/:consultationId/events
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/:consultationId/events',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const { page = 1, limit = 50, eventType } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const consultation = await Consultation.findById(base._id)
        .select('eventLogs consultationId')
        .lean();

      let logs = consultation.eventLogs || [];
      if (eventType) logs = logs.filter(e => e.eventType === eventType);

      const total  = logs.length;
      const paged  = logs.slice(skip, skip + Number(limit));

      return res.json({
        success: true,
        data: {
          events: paged,
          pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
        },
      });
    } catch (err) {
      console.error('[GET /consultations/:id/events]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 7. GET /consultations/:consultationId/analytics
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/:consultationId/analytics',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const consultation = await Consultation.findById(base._id)
        .select('analytics networkStats reconnectLogs sdkErrors actualDurationMinutes waitingDurationMinutes participants consultationId')
        .lean();

      return res.json({ success: true, data: consultation });
    } catch (err) {
      console.error('[GET /consultations/:id/analytics]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 8. WAITING ROOM — GET, ADMIT, REJECT
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/:consultationId/waiting-room',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const consultation = await Consultation.findById(base._id)
        .select('waitingRoomQueue consultationId')
        .lean();

      const queue = consultation.waitingRoomQueue?.filter(w => w.waitingRoomStatus === 'waiting') ?? [];
      return res.json({ success: true, data: { waitingRoomQueue: queue, count: queue.length } });
    } catch (err) {
      console.error('[GET /consultations/:id/waiting-room]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:consultationId/waiting-room/admit',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { patientUserId } = req.body;
      if (!patientUserId) return res.status(400).json({ success: false, message: 'patientUserId required' });

      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          'waitingRoomQueue.$[el].waitingRoomStatus': 'admitted',
          'waitingRoomQueue.$[el].approvedAt':        new Date(),
          'waitingRoomQueue.$[el].approvedBy':        req.user._id,
        },
      }, {
        arrayFilters: [{ 'el.userId': new mongoose.Types.ObjectId(patientUserId) }],
      });

      // Socket: move patient from waiting → main room
      const svc = getConsultationSocketService();
      if (svc) {
        const { consultationId } = req.params;
        svc.forceJoinRoom(patientUserId, rooms.consultation(consultationId));
        svc.emitToUser(patientUserId, 'consultation:waiting_room_approved', {
          consultationId, admittedBy: req.user._id,
        });
        svc.emitToConsultation(consultationId, 'consultation:waiting_room_updated', {
          consultationId, patientUserId, action: 'admitted',
        });
      }

      return res.json({ success: true, message: 'Patient admitted' });
    } catch (err) {
      console.error('[POST /consultations/:id/waiting-room/admit]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:consultationId/waiting-room/reject',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { patientUserId, reason } = req.body;
      if (!patientUserId) return res.status(400).json({ success: false, message: 'patientUserId required' });

      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          'waitingRoomQueue.$[el].waitingRoomStatus': 'rejected',
          'waitingRoomQueue.$[el].rejectedAt':        new Date(),
          'waitingRoomQueue.$[el].rejectionReason':   reason || '',
        },
      }, {
        arrayFilters: [{ 'el.userId': new mongoose.Types.ObjectId(patientUserId) }],
      });

      const svc = getConsultationSocketService();
      if (svc) {
        svc.emitToUser(patientUserId, 'consultation:waiting_room_rejected', {
          consultationId: req.params.consultationId, reason,
        });
      }

      return res.json({ success: true, message: 'Patient rejected' });
    } catch (err) {
      console.error('[POST /consultations/:id/waiting-room/reject]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 9. CHAT
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:consultationId/chat',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { message, messageType = 'text' } = req.body;
      if (!message?.trim()) return res.status(400).json({ success: false, message: 'message required' });

      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const { _id: userId, role, name } = req.user;

      const updated = await Consultation.findByIdAndUpdate(base._id, {
        $push: {
          chatMessages: {
            sender:      userId,
            senderRole:  role,
            messageType,
            message:     message.trim(),
            deliveredAt: new Date(),
          },
        },
        $inc: { totalMessages: 1 },
      }, { new: true, select: 'chatMessages' });

      const saved = updated?.chatMessages?.slice(-1)[0];

      emitConsultationEvent(base.consultationId, 'consultation:chat_message', {
        consultationId: base.consultationId,
        messageId:      saved?._id,
        senderId:       userId,
        senderName:     name,
        senderRole:     role,
        messageType,
        message:        message.trim(),
      });

      return res.status(201).json({ success: true, data: saved });
    } catch (err) {
      console.error('[POST /consultations/:id/chat]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/:consultationId/chat/messages',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const { page = 1, limit = 50 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const consultation = await Consultation.findById(base._id)
        .select('chatMessages totalMessages consultationId')
        .lean();

      const messages = (consultation.chatMessages || [])
        .filter(m => !m.isDeleted)
        .slice(skip, skip + Number(limit));

      return res.json({
        success: true,
        data: {
          messages,
          pagination: {
            total:      consultation.totalMessages,
            page:       Number(page),
            limit:      Number(limit),
            totalPages: Math.ceil(consultation.totalMessages / Number(limit)),
          },
        },
      });
    } catch (err) {
      console.error('[GET /consultations/:id/chat/messages]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  '/:consultationId/chat/messages/:messageId/read',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      await Consultation.findByIdAndUpdate(base._id, {
        $set: { 'chatMessages.$[el].readAt': new Date() },
      }, {
        arrayFilters: [{ 'el._id': new mongoose.Types.ObjectId(req.params.messageId) }],
      });

      return res.json({ success: true });
    } catch (err) {
      console.error('[PATCH /chat/messages/:id/read]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 10. PARTICIPANT CONTROL
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  '/:consultationId/participants/:participantId/mute',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { participantId } = req.params;
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          'participants.$[el].isMutedByHost':       true,
          'participants.$[el].microphoneEnabled':    false,
        },
      }, { arrayFilters: [{ 'el._id': new mongoose.Types.ObjectId(participantId) }] });

      emitConsultationEvent(base.consultationId, 'consultation:participant_muted', {
        consultationId: base.consultationId, participantId, mutedBy: req.user._id,
      });

      return res.json({ success: true, message: 'Participant muted' });
    } catch (err) {
      console.error('[PATCH participants/:id/mute]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  '/:consultationId/participants/:participantId/remove',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { participantId } = req.params;
      const { reason } = req.body;
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      // Find userId of target participant
      const consultation = await Consultation.findById(base._id).select('participants').lean();
      const target = consultation?.participants?.find(p => p._id.toString() === participantId);

      await Consultation.findByIdAndUpdate(base._id, {
        $set: { 'participants.$[el].connectionStatus': 'disconnected', 'participants.$[el].leftAt': new Date() },
      }, { arrayFilters: [{ 'el._id': new mongoose.Types.ObjectId(participantId) }] });

      const svc = getConsultationSocketService();
      if (svc && target?.userId) {
        svc.emitToUser(target.userId.toString(), 'consultation:removed', {
          consultationId: base.consultationId, reason,
        });
      }

      emitConsultationEvent(base.consultationId, 'consultation:participant_removed', {
        consultationId: base.consultationId, participantId, reason,
      });

      return res.json({ success: true, message: 'Participant removed' });
    } catch (err) {
      console.error('[PATCH participants/:id/remove]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 11. LIFECYCLE — START, PAUSE, RESUME, END, CANCEL
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  '/:consultationId/start',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res, {
        requireStatus: ['created', 'scheduled', 'waiting'],
      });
      if (!base) return;

      const now = new Date();
      const updated = await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          status:            'active',
          actualStartTime:   now,
          consultationStage: 'in_progress',
          roomStarted:       true,
        },
      }, { new: true });

      emitConsultationEvent(base.consultationId, 'consultation:consultation_started', {
        consultationId: base.consultationId,
        startedBy:      req.user._id,
        startedAt:      now.toISOString(),
      });

      await Notification.create({
        recipient:         base.patient,
        title:             'Consultation Started',
        body:              'Your doctor has started the consultation. Join now.',
        type:              'Consultation_Started',
        priority:          'Critical',
        relatedEntityType: 'Consultation',
        relatedEntityId:   base._id,
      }).catch(() => {});

      return res.json({ success: true, message: 'Consultation started', data: { status: updated.status } });
    } catch (err) {
      console.error('[PATCH /:id/start]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  '/:consultationId/pause',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res, { requireStatus: ['active'] });
      if (!base) return;

      await Consultation.findByIdAndUpdate(base._id, { $set: { status: 'paused' } });

      emitConsultationEvent(base.consultationId, 'consultation:paused', {
        consultationId: base.consultationId, pausedBy: req.user._id,
      });

      return res.json({ success: true, message: 'Consultation paused' });
    } catch (err) {
      console.error('[PATCH /:id/pause]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  '/:consultationId/resume',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res, { requireStatus: ['paused'] });
      if (!base) return;

      await Consultation.findByIdAndUpdate(base._id, { $set: { status: 'active', consultationStage: 'in_progress' } });

      emitConsultationEvent(base.consultationId, 'consultation:resumed', {
        consultationId: base.consultationId, resumedBy: req.user._id,
      });

      return res.json({ success: true, message: 'Consultation resumed' });
    } catch (err) {
      console.error('[PATCH /:id/resume]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  '/:consultationId/end',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { reason, summary, followUpAdvice } = req.body;

      const base = await assertConsultationAccess(req, res, {
        requireStatus: ['active', 'paused', 'waiting'],
      });
      if (!base) return;

      const now = new Date();

      const updated = await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          status:            'completed',
          actualEndTime:     now,
          consultationStage: 'post_consultation',
          roomEnded:         true,
          endedBy:           isAdmin(req) ? 'admin' : 'doctor',
          endedByUserId:     req.user._id,
          endedReason:       reason || '',
          diagnosisSummary:  summary || '',
          followUpAdvice:    followUpAdvice || '',
          doctorLeftAt:      now,
        },
      }, { new: true });

      emitConsultationEvent(base.consultationId, 'consultation:consultation_ended', {
        consultationId:  base.consultationId,
        endedBy:         req.user._id,
        endedAt:         now.toISOString(),
        reason,
        durationMinutes: updated.actualDurationMinutes,
      });

      await Notification.create({
        recipient:         base.patient,
        title:             'Consultation Completed',
        body:              'Your consultation is complete. Please rate your experience.',
        type:              'Booking_Completed',
        priority:          'Medium',
        relatedEntityType: 'Consultation',
        relatedEntityId:   base._id,
      }).catch(() => {});

      return res.json({
        success: true,
        message: 'Consultation ended',
        data: {
          status:          'completed',
          completedAt:     now,
          durationMinutes: updated.actualDurationMinutes,
        },
      });
    } catch (err) {
      console.error('[PATCH /:id/end]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  '/:consultationId/cancel',
  protect,
  authorize('customer', 'doctor', 'hospital', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { reason } = req.body;

      const base = await assertConsultationAccess(req, res, {
        requireStatus: ['created', 'scheduled', 'waiting'],
      });
      if (!base) return;

      const actorMap = {
        customer: 'patient', doctor: 'doctor', hospital: 'hospital',
        admin: 'admin', superadmin: 'admin',
      };

      await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          status:             'cancelled',
          consultationStage:  'closed',
          cancelledBy:        actorMap[req.user.role],
          cancelledByUserId:  req.user._id,
          cancellationReason: reason || '',
          cancelledAt:        new Date(),
        },
      });

      emitConsultationEvent(base.consultationId, 'consultation:cancelled', {
        consultationId: base.consultationId,
        cancelledBy:    actorMap[req.user.role],
        reason,
      });

      return res.json({ success: true, message: 'Consultation cancelled' });
    } catch (err) {
      console.error('[PATCH /:id/cancel]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 12. RECORDING
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  '/:consultationId/recording/start',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res, { requireStatus: ['active'] });
      if (!base) return;

      const now = new Date();
      await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          'recording.recordingEnabled':   true,
          'recording.recordingStarted':   true,
          'recording.recordingStatus':    'recording',
          'recording.recordingStartedAt': now,
        },
      });

      emitConsultationEvent(base.consultationId, 'consultation:recording_started', {
        consultationId: base.consultationId, startedBy: req.user._id, startedAt: now.toISOString(),
      });

      return res.json({ success: true, message: 'Recording started' });
    } catch (err) {
      console.error('[PATCH recording/start]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch(
  '/:consultationId/recording/stop',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const now = new Date();
      await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          'recording.recordingStatus':  'processing',
          'recording.recordingEndedAt': now,
        },
      });

      emitConsultationEvent(base.consultationId, 'consultation:recording_stopped', {
        consultationId: base.consultationId, stoppedBy: req.user._id,
      });

      return res.json({ success: true, message: 'Recording stopped — processing' });
    } catch (err) {
      console.error('[PATCH recording/stop]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/:consultationId/recordings',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const consultation = await Consultation.findById(base._id)
        .select('+recording.recordingUrl recording.recordingStatus recording.recordingStartedAt recording.recordingEndedAt recording.recordingDurationMinutes recording.encrypted')
        .lean();

      return res.json({ success: true, data: { recording: consultation.recording } });
    } catch (err) {
      console.error('[GET recordings]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 13. PRESCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:consultationId/prescriptions',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const {
        diagnosis, medicines = [], labTests = [],
        followUpDate, followUpInstructions,
        chiefComplaints = [], clinicalFindings, advice, vitals,
      } = req.body;

      if (!medicines.length)
        return res.status(400).json({ success: false, message: 'At least one medicine required' });

      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      // Resolve doctor snapshot
      const dp = await DoctorProfile.findById(base.doctor)
        .select('user registrationNumber registrationCouncil specialization profilePhotoUrl')
        .populate('user', 'name email phone')
        .lean();

      const consultationDoc = await Consultation.findById(base._id)
        .select('patient')
        .populate('patient', 'name email phone')
        .lean();

      const rxData = {
        bookingId:        base.bookingId,
        doctor: {
          userId:              dp?.user?._id,
          doctorProfileId:     dp?._id,
          name:                dp?.user?.name || 'Doctor',
          registrationNumber:  dp?.registrationNumber || '',
          specialization:      dp?.specialization || '',
        },
        patient: {
          userId: consultationDoc?.patient?._id,
          name:   consultationDoc?.patient?.name || 'Patient',
          phone:  consultationDoc?.patient?.phone || '',
        },
        diagnosis,
        chiefComplaints,
        clinicalFindings,
        advice,
        vitals,
        medicines,
        labTests,
        followUpDate,
        followUpInstructions,
        createdBy: req.user._id,
      };

      const rx = await EPrescription.create(rxData);

      // Embed summary in Consultation
      await Consultation.findByIdAndUpdate(base._id, {
        $set: {
          prescription: {
            ePrescriptionId:    rx._id,
            rxNumber:           rx.rxNumber,
            diagnosis,
            medications:        medicines.map(m => ({
              medicineName: m.medicineName,
              dosage:       m.dosage,
              frequency:    m.frequency,
              duration:     m.durationDays ? `${m.durationDays} days` : '',
              instructions: m.instructions || '',
            })),
            labTests,
            followUpDate,
            issuedAt: new Date(),
          },
          prescriptionUploaded:   true,
          prescriptionUploadedAt: new Date(),
        },
      });

      emitConsultationEvent(base.consultationId, 'consultation:prescription_issued', {
        consultationId: base.consultationId,
        rxNumber:       rx.rxNumber,
        issuedBy:       req.user._id,
      });

      await Notification.create({
        recipient:         base.patient,
        title:             'Prescription Ready',
        body:              `Your prescription (${rx.rxNumber}) has been issued.`,
        type:              'Prescription_Added',
        priority:          'High',
        relatedEntityType: 'Consultation',
        relatedEntityId:   base._id,
      }).catch(() => {});

      return res.status(201).json({
        success: true,
        message: 'Prescription issued',
        data: { rxNumber: rx.rxNumber, ePrescriptionId: rx._id },
      });
    } catch (err) {
      console.error('[POST prescriptions]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/:consultationId/prescriptions',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const rxList = await EPrescription.find({ bookingId: base.bookingId })
        .select('-doctor.signatureUrl')
        .lean();

      return res.json({ success: true, data: { prescriptions: rxList } });
    } catch (err) {
      console.error('[GET prescriptions]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 14. CONSENTS
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:consultationId/consents',
  protect,
  authorize('customer'),
  async (req, res) => {
    try {
      const { consentType = 'telemedicine', accepted, ipAddress } = req.body;

      if (!accepted)
        return res.status(400).json({ success: false, message: 'Consent must be accepted=true' });

      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const consentEntry = {
        consentType,
        accepted:       true,
        acceptedAt:     new Date(),
        ipAddress:      ipAddress || req.ip,
        userAgent:      req.headers['user-agent'] || '',
        consentVersion: '1.0',
      };

      const updates = {
        $push: { consents: consentEntry },
      };

      if (consentType === 'telemedicine') {
        updates.$set = { telemedicineConsentAccepted: true };
      }
      if (consentType === 'recording') {
        updates.$set = { ...(updates.$set || {}), recordingConsentAccepted: true };
      }

      await Consultation.findByIdAndUpdate(base._id, updates);

      return res.json({ success: true, message: `${consentType} consent recorded` });
    } catch (err) {
      console.error('[POST consents]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/:consultationId/consents',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const consultation = await Consultation.findById(base._id)
        .select('consents telemedicineConsentAccepted recordingConsentAccepted')
        .lean();

      return res.json({ success: true, data: consultation });
    } catch (err) {
      console.error('[GET consents]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 15. ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:consultationId/attachments',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { attachmentType, fileName, mimeType, fileSize, storageUrl, description, accessLevel = 'shared' } = req.body;

      if (!fileName || !attachmentType)
        return res.status(400).json({ success: false, message: 'fileName and attachmentType required' });

      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const entry = {
        uploadedBy:     req.user._id,
        uploaderRole:   req.user.role,
        attachmentType,
        fileName,
        mimeType,
        fileSize,
        storageUrl,
        description,
        accessLevel,
        uploadedAt:     new Date(),
        encrypted:      true,
      };

      const updated = await Consultation.findByIdAndUpdate(base._id, {
        $push: { attachments: entry },
      }, { new: true, select: 'attachments' });

      const saved = updated?.attachments?.slice(-1)[0];

      emitConsultationEvent(base.consultationId, 'consultation:file_uploaded', {
        consultationId: base.consultationId,
        attachmentId:   saved?._id,
        fileName,
        attachmentType,
        uploadedBy:     req.user._id,
      });

      return res.status(201).json({ success: true, data: saved });
    } catch (err) {
      console.error('[POST attachments]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/:consultationId/attachments',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      const consultation = await Consultation.findById(base._id)
        .select('attachments')
        .lean();

      const visible = (consultation.attachments || []).filter(a => {
        if (a.isDeleted) return false;
        if (isAdmin(req)) return true;
        if (a.accessLevel === 'shared') return true;
        if (a.accessLevel === 'doctor_only' && req.user.role === 'doctor') return true;
        if (a.accessLevel === 'patient_only' && req.user.role === 'customer') return true;
        if (a.uploadedBy?.toString() === req.user._id.toString()) return true;
        return false;
      });

      return res.json({ success: true, data: { attachments: visible } });
    } catch (err) {
      console.error('[GET attachments]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/:consultationId/attachments/:attachmentId',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const base = await assertConsultationAccess(req, res);
      if (!base) return;

      await Consultation.findByIdAndUpdate(base._id, {
        $set: { 'attachments.$[el].isDeleted': true },
      }, { arrayFilters: [{ 'el._id': new mongoose.Types.ObjectId(req.params.attachmentId) }] });

      return res.json({ success: true, message: 'Attachment deleted' });
    } catch (err) {
      console.error('[DELETE attachments/:id]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 16. ADMIN ANALYTICS OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/admin/analytics/overview',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { from, to } = req.query;

      const dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to)   dateFilter.$lte = new Date(to);

      const filter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

      const [
        total,
        byStatus,
        byType,
        avgDuration,
        ratedCount,
      ] = await Promise.all([
        Consultation.countDocuments(filter),
        Consultation.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Consultation.aggregate([
          { $match: filter },
          { $group: { _id: '$consultationType', count: { $sum: 1 } } },
        ]),
        Consultation.aggregate([
          { $match: { ...filter, status: 'completed' } },
          { $group: { _id: null, avg: { $avg: '$actualDurationMinutes' } } },
        ]),
        Consultation.countDocuments({ ...filter, isRated: true }),
      ]);

      const svc   = getConsultationSocketService();
      const stats = svc?.getStats() ?? {};

      return res.json({
        success: true,
        data: {
          total,
          byStatus:           byStatus.reduce((a, b) => { a[b._id] = b.count; return a; }, {}),
          byType:             byType.reduce((a, b) => { a[b._id] = b.count; return a; }, {}),
          avgDurationMinutes: avgDuration[0]?.avg?.toFixed(1) ?? 0,
          ratedCount,
          live: stats,
        },
      });
    } catch (err) {
      console.error('[GET admin/analytics/overview]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 17. LIST /consultations
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/',
  protect,
  authorize('customer', 'doctor', 'hospital', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { status, consultationType, from, to, page = 1, limit = 20 } = req.query;
      const { _id: userId, role } = req.user;

      const filter = {};
      if (status)           filter.status           = status;
      if (consultationType) filter.consultationType = consultationType;
      if (from || to) {
        filter.scheduledStartTime = {};
        if (from) filter.scheduledStartTime.$gte = new Date(from);
        if (to)   filter.scheduledStartTime.$lte = new Date(to);
      }

      if (role === 'customer') {
        filter.patient = userId;
      } else if (role === 'doctor') {
        const dp = await resolveDoctorProfile(userId);
        if (!dp) return res.status(403).json({ success: false, message: 'Doctor profile not found' });
        filter.doctor = dp._id;
      } else if (role === 'hospital') {
        const h = await Hospital.findOne({ managedBy: userId }).select('_id').lean();
        if (!h) return res.status(403).json({ success: false, message: 'Hospital not found' });
        filter.hospital = h._id;
      }

      const skip  = (Number(page) - 1) * Number(limit);
      const total = await Consultation.countDocuments(filter);

      const consultations = await Consultation.find(filter)
        .select('-hostToken -participantToken -webhookSecret -internalAdminNotes -doctorInternalNotes -chatMessages -eventLogs -networkAnalytics -sdkErrors -reconnectLogs')
        .populate('patient', 'name phone avatar')
        .populate('doctor',  'user specialization profilePhotoUrl')
        .populate('hospital','name')
        .sort({ scheduledStartTime: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      return res.json({
        success: true,
        data: {
          consultations,
          pagination: {
            total,
            page:       Number(page),
            limit:      Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (err) {
      console.error('[GET /consultations]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── 18. AGORA WEBHOOK
// Agora Cloud Recording / NCS (Notification Center Service) callbacks
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/webhooks/agora',
  async (req, res) => {
    try {
      // Validate Agora NCS secret
      const secret = req.headers['x-agora-signature'] || req.headers['authorization'];
      if (!secret || secret !== process.env.AGORA_WEBHOOK_SECRET) {
        return res.status(401).json({ success: false, message: 'Unauthorized webhook' });
      }

      const { eventType, payload } = req.body;

      // Agora NCS sends channelName as the room identifier
      const channelName = payload?.channelName || payload?.cname;
      if (!channelName) return res.status(200).json({ received: true });

      const consultation = await Consultation.findOne({ roomId: channelName })
        .select('consultationId status _id')
        .lean();

      if (!consultation) return res.status(200).json({ received: true });

      const { consultationId } = consultation;

      switch (eventType) {
        // NCS event 103: host/audience joins channel
        case 103:
          emitConsultationEvent(consultationId, 'consultation:participant_joined', {
            consultationId,
            uid:    payload?.uid,
            source: 'agora_webhook',
          });
          break;

        // NCS event 104: host/audience leaves channel
        case 104:
          emitConsultationEvent(consultationId, 'consultation:participant_left', {
            consultationId,
            uid:    payload?.uid,
            source: 'agora_webhook',
          });
          break;

        // Cloud Recording: recording started
        case 'cloud_recording_started':
          await Consultation.findByIdAndUpdate(consultation._id, {
            $set: { 'recording.recordingStatus': 'recording' },
          });
          emitConsultationEvent(consultationId, 'consultation:recording_started', { consultationId });
          break;

        // Cloud Recording: recording stopped / file uploaded
        case 'cloud_recording_uploaded': {
          const fileUrl = payload?.fileList?.[0]?.fileName
            ? `https://${process.env.AGORA_RECORDING_BUCKET}.s3.amazonaws.com/${payload.fileList[0].fileName}`
            : '';
          await Consultation.findByIdAndUpdate(consultation._id, {
            $set: {
              'recording.recordingStatus': 'ready',
              'recording.recordingUrl':    fileUrl,
            },
          });
          emitConsultationEvent(consultationId, 'consultation:recording_stopped', { consultationId, fileUrl });
          break;
        }

        // NCS event 105: channel destroyed (all users left)
        case 105:
          await Consultation.findOneAndUpdate(
            { consultationId, status: { $in: ['active', 'paused', 'waiting'] } },
            {
              $set: {
                status:            'completed',
                actualEndTime:     new Date(),
                roomEnded:         true,
                endedBy:           'system',
                autoEndedBySystem: true,
              },
            }
          );
          emitConsultationEvent(consultationId, 'consultation:consultation_ended', {
            consultationId, endedBy: 'system', source: 'agora_webhook',
          });
          break;

        default:
          break;
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[POST /webhooks/agora]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;