import express from 'express';
import mongoose from 'mongoose';

import Booking               from '../models/Booking.js';
import DoctorProfile         from '../models/DoctorProfile.js';
import Hospital              from '../models/Hospital.js';
import OutPatientRecord      from '../models/OutPatientRecord.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import Notification          from '../models/Notification.js';
import User                  from '../models/User.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { generateVideoSdkToken, createVideoSdkRoom } from '../utils/videoSdk.js';
import sendEmail             from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SERVICE HELPER (Fixed: Resolves User._id for doctor room)
// ─────────────────────────────────────────────────────────────────────────────

const emitConsultationEvent = async (req, booking, event, payload = {}) => {
  const io = req.app.get('io');
  if (!io) return;

  const base = {
    bookingId:   booking._id?.toString(),
    bookingCode: booking.bookingCode,
    bookingType: booking.bookingType,
    status:      booking.status,
    ...payload,
  };

  // Booking-level room
  io.to(`booking:${booking._id}`).emit(event, base);

  // Customer personal room
  if (booking.customer) {
    const customerId = booking.customer._id || booking.customer;
    io.to(`user:${customerId}`).emit(event, base);
  }

  // Doctor personal room (requires User._id, not DoctorProfile._id)
  if (booking.doctor) {
    let doctorUserId = null;

    if (req.user && req.user.role === 'doctor') {
      doctorUserId = req.user._id;
    } else {
      const doctorProfileId = booking.doctor._id || booking.doctor;
      const dp = await DoctorProfile.findById(doctorProfileId).select('user').lean();
      if (dp) doctorUserId = dp.user;
    }

    if (doctorUserId) {
      io.to(`doctor:${doctorUserId}`).emit(event, base);
    }
  }

  // Admin global room
  io.to('admin:global').emit(event, { ...base, _internal: true });
};

const isAdmin = (req) => ['admin', 'superadmin'].includes(req.user.role);

// ─────────────────────────────────────────────────────────────────────────────
// PRICING HELPER
// ─────────────────────────────────────────────────────────────────────────────

const resolveConsultationPricing = async (doctorProfile, consultationType) => {
  const globalConfig = await PlatformPricingConfig.getGlobal();

  // hospital-manager path
  if (doctorProfile.primaryHospital) {
    const hospital = await Hospital.findById(doctorProfile.primaryHospital)
      .select('managementModel consultationPricing platformFee')
      .lean();

    if (hospital?.managementModel === 'hospital-manager' && hospital.consultationPricing) {
      const cp = hospital.consultationPricing;

      const feeMap = {
        inPerson:  cp.inPersonFee,
        video:     cp.videoFee,
        homeVisit: cp.homeVisitFee,
      };

      const platformFee =
        cp.platformFee ??
        hospital.platformFee ??
        PlatformPricingConfig.resolveHospitalPlatformFee(globalConfig, hospital) ??
        globalConfig.doctor.platformFee;

      return {
        source:           'hospital',
        consultationFee:  feeMap[consultationType] ?? cp.inPersonFee,
        platformFee,
        followUpFee:      cp.followUpFee,
        followUpDiscountPercent: cp.followUpDiscountPercent,
        followUpValidDays: cp.followUpValidDays,
        hospitalId:       hospital._id,
      };
    }
  }

  // doctor-owner / no hospital path
  const fees = doctorProfile.fees ?? {};

  const feeMap = {
    inPerson:  fees.inPersonFee,
    video:     fees.videoFee,
    homeVisit: fees.homeVisitFee,
  };

  const platformFee =
    doctorProfile.platformFee ??
    globalConfig.doctor.platformFee;

  return {
    source:           'doctor',
    consultationFee:  feeMap[consultationType] ?? fees.inPersonFee ?? 0,
    platformFee,
    followUpFee:      fees.followUpFee,
    followUpDiscountPercent: fees.followUpDiscountPercent,
    followUpValidDays: fees.followUpValidDays,
  };
};

const computeFareBreakdown = (consultationFee, platformFee, discount = 0, couponDiscount = 0) => {
  let platformFeeAmount = 0;

  if (platformFee?.type === 'fixed') {
    platformFeeAmount = platformFee.value;
  } else if (platformFee?.type === 'percentage') {
    platformFeeAmount = Math.round((consultationFee * platformFee.value) / 100);
  }

  const subtotal    = consultationFee + platformFeeAmount;
  const totalAmount = Math.max(0, subtotal - discount - couponDiscount);

  return {
    consultationFee,
    platformFee:    platformFeeAmount,
    discount,
    couponDiscount,
    totalAmount,
    amountPaid:     0,
    refundAmount:   0,
    currency:       'INR',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OP NUMBER GENERATOR (Fixed: Modern Mongoose syntax)
// ─────────────────────────────────────────────────────────────────────────────

const generateOpNumber = async (hospitalCode = 'LKSN') => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const prefix = `OP-${dateStr}-${hospitalCode.toUpperCase().slice(0, 6)}`;

  const last = await OutPatientRecord.findOne({ opNumber: new RegExp(`^${prefix}`) })
    .select('opNumber')
    .sort({ opNumber: -1 })
    .lean();

  let seq = 1;
  if (last) {
    const parts = last.opNumber.split('-');
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
  }

  return `${prefix}-${String(seq).padStart(4, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── ROUTES ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GET /consultations/pricing
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/pricing',
  protect,
  authorize('customer', 'doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { doctorProfileId, consultationType = 'inPerson' } = req.query;

      if (!doctorProfileId)
        return res.status(400).json({ success: false, message: 'doctorProfileId is required' });

      const doctorProfile = await DoctorProfile.findById(doctorProfileId)
        .select('fees platformFee primaryHospital consultationTypes isVerified isActive')
        .lean();

      if (!doctorProfile)
        return res.status(404).json({ success: false, message: 'Doctor not found' });

      if (!doctorProfile.isVerified || !doctorProfile.isActive)
        return res.status(400).json({ success: false, message: 'Doctor not available' });

      const pricing = await resolveConsultationPricing(doctorProfile, consultationType);
      const fare    = computeFareBreakdown(pricing.consultationFee, pricing.platformFee);

      return res.json({
        success: true,
        data: {
          source:             pricing.source,
          consultationType,
          consultationFee:    fare.consultationFee,
          platformFeeAmount:  fare.platformFee,
          totalAmount:        fare.totalAmount,
          platformFeePolicy:  pricing.platformFee,
          followUpFee:        pricing.followUpFee,
          followUpDiscountPercent: pricing.followUpDiscountPercent,
          followUpValidDays:  pricing.followUpValidDays,
          currency:           'INR',
        },
      });
    } catch (err) {
      console.error('[GET /consultations/pricing]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GET /consultations/:bookingId/join
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/:bookingId/join',
  protect,
  authorize('customer', 'doctor'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .select('+onlineConsultation.hostToken +onlineConsultation.patientToken')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      if (booking.bookingType !== 'doctor_online')
        return res.status(400).json({ success: false, message: 'Not an online consultation' });

      if (!['confirmed', 'in_progress'].includes(booking.status))
        return res.status(400).json({
          success: false,
          message: 'Booking not yet confirmed or already completed',
        });

      if (booking.paymentStatus !== 'paid')
        return res.status(402).json({
          success: false,
          message: 'Payment required to join consultation',
        });

      const isDoctor   = req.user.role === 'doctor';
      const isCustomer = req.user.role === 'customer';

      if (isCustomer && booking.customer.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Forbidden' });

      if (isDoctor) {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || dp._id.toString() !== booking.doctor.toString())
          return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      if (isCustomer && !booking.onlineConsultation?.isTelemedicineConsentAccepted)
        return res.status(400).json({
          success: false,
          message: 'Telemedicine consent not accepted. Call PATCH /consultations/:id/consent first.',
        });

      // ── Ensure room exists — create lazily if missing ──────────────────────
     let roomId      = booking.onlineConsultation?.roomId;
      let meetingId   = booking.onlineConsultation?.meetingId;
      let meetingLink = booking.onlineConsultation?.meetingLink

      if (!roomId) {
        // FIX: Removed the dynamic import here, passing booking._id
        const room = await createVideoSdkRoom(booking.bookingCode, booking._id);

        roomId      = room.roomId;
        meetingId   = room.meetingId;
        meetingLink = room.meetingLink;

        await Booking.findByIdAndUpdate(booking._id, {
          $set: {
            'onlineConsultation.roomId':      roomId,
            'onlineConsultation.meetingId':   meetingId,
            'onlineConsultation.meetingLink': meetingLink,
          },
        });
      }

      // FIX: Override legacy fake links dynamically for older database records
      if (!meetingLink || meetingLink.includes('meet.videosdk.live')) {
        meetingLink = `${process.env.CLIENT_URL||process.env.FRONTEND_URL || 'http://localhost:3000'}/consultations/${booking._id}/room`;
      }

      // ── Send meeting link emails ───────────────────────────────────────────
      const scheduledAtStr = new Date(booking.scheduledAt).toLocaleString('en-IN');
      const durationMins   = booking.onlineConsultation?.allowedDurationMinutes ?? 30;

      // Customer email
      const customerUser = await User.findById(booking.customer).select('name email').lean();
      if (customerUser?.email) {
        await sendEmail({
          email:   customerUser.email,
          subject: `Your Consultation is Ready — ${booking.bookingCode}`,
          html:    transactionalTemplate({
            header:     'CONSULTATION READY',
            title:      'Join Your Online Consultation',
            body: `
              <p>Dear <strong>${customerUser.name}</strong>,</p>
              <p>Your consultation <strong>${booking.bookingCode}</strong> is scheduled for <strong>${scheduledAtStr}</strong>.</p>
              <p>Click the button below to join. Session allows up to <strong>${durationMins} minutes</strong>.</p>
              <p><strong>Meeting Room ID:</strong> ${roomId}</p>
            `,
            buttonText: 'Join Consultation',
            buttonLink: meetingLink,
          }),
        }).catch((e) => console.warn('[join email customer]', e.message));
      }

      // Doctor email
      const doctorProfileId  = booking.doctor._id || booking.doctor;
      const doctorProfileDoc = await DoctorProfile.findById(doctorProfileId).select('user').lean();
      if (doctorProfileDoc?.user) {
        const doctorUser = await User.findById(doctorProfileDoc.user).select('name email').lean();
        if (doctorUser?.email) {
          await sendEmail({
            email:   doctorUser.email,
            subject: `Patient Ready — Consultation ${booking.bookingCode}`,
            html:    transactionalTemplate({
              header:     'CONSULTATION READY',
              title:      'Your Patient is Waiting',
              body: `
                <p>Dear Dr. <strong>${doctorUser.name}</strong>,</p>
                <p>Consultation <strong>${booking.bookingCode}</strong> is active. Your patient is ready.</p>
                <p><strong>Scheduled:</strong> ${scheduledAtStr}</p>
                <p><strong>Duration allowed:</strong> ${durationMins} minutes</p>
                <p><strong>Meeting Room ID:</strong> ${roomId}</p>
              `,
              buttonText: 'Start Consultation',
              buttonLink: meetingLink,
            }),
          }).catch((e) => console.warn('[join email doctor]', e.message));
        }
      }

      // ── Generate scoped role-aware token ──────────────────────────────────
      const token = generateVideoSdkToken(
        roomId,
        isDoctor ? 'host' : 'participant',
        '2h'
      );

      return res.json({
        success: true,
        data: {
          roomId,
          meetingId,
          meetingLink,
          token,
          role:        isDoctor ? 'host' : 'participant',
          bookingCode: booking.bookingCode,
          scheduledAt: booking.scheduledAt,
          allowedDurationMinutes: durationMins,
        },
      });
    } catch (err) {
      console.error('[GET /consultations/:bookingId/join]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PATCH /consultations/:bookingId/consent
// ═══════════════════════════════════════════════════════════════════════════════

router.patch(
  '/:bookingId/consent',
  protect,
  authorize('customer'),
  async (req, res) => {
    try {
      const { accepted, ipAddress } = req.body;

      if (!accepted)
        return res.status(400).json({ success: false, message: 'Consent must be accepted' });

      const booking = await Booking.findOne({
        _id:      req.params.bookingId,
        customer: req.user._id,
      });

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

     if (booking.bookingType !== 'doctor_online')
        return res.status(400).json({ success: false, message: 'Not an online consultation' });

      // FIX: Initialize subdocument if null
      if (!booking.onlineConsultation) booking.onlineConsultation = {};
      if (!booking.onlineConsultation.eventLogs) booking.onlineConsultation.eventLogs = [];

      booking.onlineConsultation.isTelemedicineConsentAccepted  = true;
      booking.onlineConsultation.telemedicineConsentAcceptedAt  = new Date();
      booking.onlineConsultation.consentIpAddress               = ipAddress ?? req.ip;

      booking.onlineConsultation.eventLogs.push({
        event:       'consent_accepted',
        participant: 'patient',
        timestamp:   new Date(),
        metadata:    { ipAddress: ipAddress ?? req.ip },
      });

      await booking.save();

      return res.json({ success: true, message: 'Telemedicine consent recorded' });
    } catch (err) {
      console.error('[PATCH /consultations/:bookingId/consent]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 6. POST /consultations/:bookingId/start
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/:bookingId/start',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!dp) return res.status(403).json({ success: false, message: 'Doctor profile not found' });

      const booking = await Booking.findOne({
        _id:    req.params.bookingId,
        doctor: dp._id,
        status: 'confirmed',
      });

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not confirmed' });

      const now = new Date();

   if (booking.bookingType === 'doctor_online') {
        // FIX: Initialize subdocument if null
        if (!booking.onlineConsultation) booking.onlineConsultation = {};
        if (!booking.onlineConsultation.eventLogs) booking.onlineConsultation.eventLogs = [];

        booking.onlineConsultation.consultationStatus = 'live';
        booking.onlineConsultation.roomStarted        = true;
        booking.onlineConsultation.startedAt          = now;
        booking.onlineConsultation.doctorJoined       = true;
        booking.onlineConsultation.doctorJoinedAt     = now;
        booking.onlineConsultation.eventLogs.push({
          event:       'consultation_started',
          participant: 'doctor',
          timestamp:   now,
        });
      }

      booking.status    = 'in_progress';
      booking.updatedBy = req.user._id;
      await booking.save();

      await OutPatientRecord.findOneAndUpdate(
        { booking: booking._id },
        { $set: { status: 'in_progress', startedAt: now } }
      );

      // Trigger socket event
      await emitConsultationEvent(req, booking, 'consultation:started', {
        startedAt:    now,
        roomId:       booking.onlineConsultation?.roomId,
        doctorJoined: true,
      });

      await Notification.create({
        recipient:         booking.customer,
        title:             'Consultation Started',
        body:              `Dr. has started your consultation. Join now.`,
        type:              'Consultation_Started',
        priority:          'Critical',
        relatedEntityType: 'Booking',
        relatedEntityId:   booking._id,
      });

      return res.json({ success: true, message: 'Consultation started', data: { status: booking.status } });
    } catch (err) {
      console.error('[POST /consultations/:bookingId/start]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 7. POST /consultations/:bookingId/end
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/:bookingId/end',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { reason, consultationSummary, followUpInstructions } = req.body;

      const dp = req.user.role === 'doctor'
        ? await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean()
        : null;

      const query = {
        _id:    req.params.bookingId,
        status: 'in_progress',
      };
      if (dp) query.doctor = dp._id;

      const booking = await Booking.findOne(query);
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not in progress' });

      const now = new Date();

    if (booking.bookingType === 'doctor_online') {
        // FIX: Initialize subdocument if null
        if (!booking.onlineConsultation) booking.onlineConsultation = {};
        if (!booking.onlineConsultation.eventLogs) booking.onlineConsultation.eventLogs = [];

        const startedAt    = booking.onlineConsultation.startedAt ?? now;
        const durationMins = Math.round((now - startedAt) / 60000);

        booking.onlineConsultation.consultationStatus     = 'completed';
        booking.onlineConsultation.roomEnded              = true;
        booking.onlineConsultation.endedAt                = now;
        booking.onlineConsultation.durationMinutes        = durationMins;
        booking.onlineConsultation.doctorLeftAt           = now;
        booking.onlineConsultation.consultationEndedBy    = isAdmin(req) ? 'admin' : 'doctor';
        booking.onlineConsultation.consultationSummary    = consultationSummary ?? '';
        booking.onlineConsultation.followUpInstructions   = followUpInstructions ?? '';
        booking.onlineConsultation.endedReason            = reason ?? '';
        booking.onlineConsultation.eventLogs.push({
          event:       'consultation_ended',
          participant: isAdmin(req) ? 'admin' : 'doctor',
          timestamp:   now,
          metadata:    { reason, durationMins },
        });
      }

      booking.status      = 'completed';
      booking.completedAt = now;
      booking.updatedBy   = req.user._id;
      await booking.save();

      await OutPatientRecord.findOneAndUpdate(
        { booking: booking._id },
        { $set: { status: 'completed', completedAt: now } }
      );

      // Trigger socket event
      await emitConsultationEvent(req, booking, 'consultation:ended', {
        endedAt:  now,
        endedBy:  isAdmin(req) ? 'admin' : 'doctor',
        reason,
        durationMinutes: booking.onlineConsultation?.durationMinutes,
      });

      await Notification.create([
        {
          recipient:         booking.customer,
          title:             'Consultation Completed',
          body:              `Your consultation (${booking.bookingCode}) is complete. Please rate your experience.`,
          type:              'Booking_Completed',
          priority:          'Medium',
          relatedEntityType: 'Booking',
          relatedEntityId:   booking._id,
        },
      ]);

      return res.json({
        success: true,
        message: 'Consultation ended',
        data: {
          status:          booking.status,
          completedAt:     now,
          durationMinutes: booking.onlineConsultation?.durationMinutes,
        },
      });
    } catch (err) {
      console.error('[POST /consultations/:bookingId/end]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 8. POST /consultations/:bookingId/cancel
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/:bookingId/cancel',
  protect,
  authorize('customer', 'doctor', 'hospital', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { reason, refundEligible = false, refundPercent = 0 } = req.body;

      const booking = await Booking.findById(req.params.bookingId);
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      if (['completed', 'cancelled', 'no_show'].includes(booking.status))
        return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.status} booking` });

      if (req.user.role === 'customer' && booking.customer.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Forbidden' });

      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || dp._id.toString() !== booking.doctor?.toString())
          return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      if (req.user.role === 'hospital') {
        const h = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
        if (!h || h._id.toString() !== booking.hospital?.toString())
          return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const actorMap = {
        customer:   'customer',
        doctor:     'doctor',
        hospital:   'hospital',
        admin:      'admin',
        superadmin: 'admin',
      };

      booking.status = 'cancelled';
      booking.cancellation = {
        cancelledBy:       actorMap[req.user.role],
        cancelledByUserId: req.user._id,
        reason,
        refundEligible,
        refundPercent,
        cancelledAt: new Date(),
      };
      booking.updatedBy = req.user._id;

      // Fixed: Prevent NaN if amountPaid is undefined
      if (refundEligible && Number(refundPercent) > 0) {
        const paid = booking.fareBreakdown?.amountPaid || 0;
        booking.fareBreakdown.refundAmount = Math.round((paid * Number(refundPercent)) / 100);
        booking.paymentStatus = 'refund_pending';
      }

      if (booking.bookingType === 'doctor_online' && booking.onlineConsultation) {
        booking.onlineConsultation.consultationStatus = 'cancelled';
      }

      await booking.save();

      await OutPatientRecord.findOneAndUpdate(
        { booking: booking._id },
        { $set: { status: 'cancelled' } }
      );

      // Trigger socket event
      await emitConsultationEvent(req, booking, 'consultation:cancelled', {
        cancelledBy:    actorMap[req.user.role],
        reason,
        refundEligible,
        refundAmount:   booking.fareBreakdown?.refundAmount || 0,
      });

      await Notification.create({
        recipient:         booking.customer,
        title:             'Booking Cancelled',
        body:              `Booking ${booking.bookingCode} has been cancelled. ${refundEligible ? `Refund of ₹${booking.fareBreakdown.refundAmount} will be processed.` : ''}`,
        type:              'Booking_Cancelled',
        priority:          'High',
        relatedEntityType: 'Booking',
        relatedEntityId:   booking._id,
      });

      return res.json({ success: true, message: 'Booking cancelled', data: { status: booking.status, refundAmount: booking.fareBreakdown?.refundAmount || 0 } });
    } catch (err) {
      console.error('[POST /consultations/:bookingId/cancel]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 9. POST /consultations/:bookingId/prescription
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/:bookingId/prescription',
  protect,
  authorize('doctor'),
  async (req, res) => {
    try {
      const { prescriptionUrl } = req.body;
      if (!prescriptionUrl)
        return res.status(400).json({ success: false, message: 'prescriptionUrl is required' });

      const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();

      const booking = await Booking.findOne({ _id: req.params.bookingId, doctor: dp._id });
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      booking.documents.push({
        docType:      'prescription',
        url:          prescriptionUrl,
        originalName: 'prescription.pdf',
        uploadedAt:   new Date(),
      });

if (booking.bookingType === 'doctor_online') {
        // FIX: Initialize subdocument if null
        if (!booking.onlineConsultation) booking.onlineConsultation = {};
        if (!booking.onlineConsultation.eventLogs) booking.onlineConsultation.eventLogs = [];

        booking.onlineConsultation.prescriptionUploaded   = true;
        booking.onlineConsultation.prescriptionUrl        = prescriptionUrl;
        booking.onlineConsultation.prescriptionUploadedAt = new Date();
        booking.onlineConsultation.eventLogs.push({
          event:       'prescription_uploaded',
          participant: 'doctor',
          timestamp:   new Date(),
        });
      }

      await booking.save();

      await OutPatientRecord.findOneAndUpdate(
        { booking: booking._id },
        { $set: { prescriptionUrl } }
      );

      await Notification.create({
        recipient:         booking.customer,
        title:             'Prescription Ready',
        body:              `Your prescription for booking ${booking.bookingCode} has been uploaded.`,
        type:              'Prescription_Added',
        priority:          'High',
        relatedEntityType: 'Booking',
        relatedEntityId:   booking._id,
      });

      return res.json({ success: true, message: 'Prescription uploaded', data: { prescriptionUrl } });
    } catch (err) {
      console.error('[POST /consultations/:bookingId/prescription]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 10. POST /consultations/:bookingId/rate
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/:bookingId/rate',
  protect,
  authorize('customer'),
  async (req, res) => {
    try {
      const {
        doctorRating,
        doctorComment,
        overallRating,
        overallComment,
      } = req.body;

      if (!overallRating || !doctorRating)
        return res.status(400).json({ success: false, message: 'doctorRating and overallRating are required' });

      const booking = await Booking.findOne({
        _id:      req.params.bookingId,
        customer: req.user._id,
        status:   'completed',
      });

      if (!booking)
        return res.status(404).json({ success: false, message: 'Completed booking not found' });

      if (booking.isRated)
        return res.status(400).json({ success: false, message: 'Already rated' });

      booking.rating = {
        doctorRating,
        doctorComment,
        overallRating,
        overallComment,
        isPublic: true,
      };
      booking.isRated   = true;
      booking.updatedBy = req.user._id;
      await booking.save();

      return res.json({ success: true, message: 'Rating submitted' });
    } catch (err) {
      console.error('[POST /consultations/:bookingId/rate]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 11. POST /consultations/:bookingId/admin-notes
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/:bookingId/admin-notes',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { note, sendEmail: doSendEmail = false, transactionId } = req.body;

      if (!note?.trim())
        return res.status(400).json({ success: false, message: 'Note content is required' });

      const booking = await Booking.findById(req.params.bookingId)
        .populate('doctor', 'user primaryHospital')
        .populate('hospital', 'contact.email managementModel name managedBy')
        .select('+internalNotes');

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      // Append to internalNotes
      const timestamp = new Date().toISOString();
      const adminName = req.user.name;
      const noteEntry = `[${timestamp}] [${req.user.role.toUpperCase()}] ${adminName}${transactionId ? ` | TxnID: ${transactionId}` : ''}: ${note}`;

      const newNotes = booking.internalNotes
        ? `${booking.internalNotes}\n${noteEntry}`
        : noteEntry;

      // Fixed: Safe update without saving the populated document
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { internalNotes: newNotes, updatedBy: req.user._id } }
      );
      booking.internalNotes = newNotes;

      let targetEmail = null;
      let targetName  = null;
      let recipientType = null;

      const hospital = booking.hospital;

      if (hospital?.managementModel === 'hospital-manager' && hospital?.managedBy) {
        const hospitalUser = await User.findById(hospital.managedBy)
          .select('email name')
          .lean();
        targetEmail   = hospitalUser?.email ?? hospital.contact?.email;
        targetName    = hospitalUser?.name  ?? hospital.name;
        recipientType = 'hospital';
      } else if (booking.doctor?.user) {
        const doctorUser = await User.findById(booking.doctor.user)
          .select('email name')
          .lean();
        targetEmail   = doctorUser?.email;
        targetName    = doctorUser?.name;
        recipientType = 'doctor';
      }

      if (doSendEmail && targetEmail) {
        const emailBody = `
          <p>Dear <strong>${targetName}</strong>,</p>
          <p>An internal note has been added to booking <strong>${booking.bookingCode}</strong> by Likeson admin.</p>
          <hr/>
          <p><strong>Note:</strong> ${note}</p>
          ${transactionId ? `<p><strong>Transaction Reference:</strong> ${transactionId}</p>` : ''}
          <p><em>Booking Date:</em> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}</p>
          <p>Please log in to the Likeson portal for full details.</p>
        `;

        await sendEmail({
          email:   targetEmail,
          subject: `Admin Note — Booking ${booking.bookingCode}`,
          html:    transactionalTemplate({
            header:     'ADMIN NOTE',
            title:      `Update on Booking ${booking.bookingCode}`,
            body:       emailBody,
            buttonText: 'View Booking',
            buttonLink: `${process.env.CLIENT_URL || 'https://likeson.in'}/dashboard/bookings/${booking._id}`,
          }),
        }).catch((e) => console.warn('[admin-notes email]', e.message));
      }

      const io = req.app.get('io');
      if (io) {
        io.to('admin:global').emit('admin:note_added', {
          bookingId:     booking._id,
          bookingCode:   booking.bookingCode,
          addedBy:       req.user.name,
          addedByRole:   req.user.role,
          transactionId,
          recipientType,
          note,
          timestamp,
        });
      }

      return res.json({
        success: true,
        message: 'Admin note added',
        data: {
          bookingCode:   booking.bookingCode,
          noteEntry,
          recipientType,
          emailSent:     doSendEmail && !!targetEmail,
          emailTarget:   targetEmail,
        },
      });
    } catch (err) {
      console.error('[POST /consultations/:bookingId/admin-notes]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 12. GET /consultations/:bookingId/admin-notes
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/:bookingId/admin-notes',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .select('+internalNotes bookingCode status bookingType scheduledAt doctor hospital pricingSource fareBreakdown paymentStatus payments')
        .populate('doctor', 'user specialization')
        .populate('hospital', 'name managementModel')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const noteLines = (booking.internalNotes ?? '').split('\n').filter(Boolean);

      const parsedNotes = noteLines.map((line) => {
        const match = line.match(/^\[(.+?)\] \[(.+?)\] (.+?)(?:\s\| TxnID: (.+?))?: (.+)$/);
        if (match) {
          return {
            timestamp:     match[1],
            role:          match[2],
            author:        match[3],
            transactionId: match[4] ?? null,
            note:          match[5],
          };
        }
        return { raw: line };
      });

      return res.json({
        success: true,
        data: {
          bookingId:     booking._id,
          bookingCode:   booking.bookingCode,
          status:        booking.status,
          bookingType:   booking.bookingType,
          scheduledAt:   booking.scheduledAt,
          pricingSource: booking.pricingSource,
          fareBreakdown: booking.fareBreakdown,
          paymentStatus: booking.paymentStatus,
          payments:      booking.payments,
          managementModel: booking.hospital?.managementModel ?? 'doctor-owner',
          notes:         parsedNotes,
          rawNotes:      booking.internalNotes,
        },
      });
    } catch (err) {
      console.error('[GET /consultations/:bookingId/admin-notes]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 13. GET /consultations/:bookingId
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/:bookingId',
  protect,
  authorize('customer', 'doctor', 'hospital', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .populate('doctor', 'user specialization registrationNumber profilePhotoUrl fees consultationTypes')
        .populate('hospital', 'name contact address managementModel consultationPricing')
        .populate('customer', 'name email phone')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      if (req.user.role === 'customer' && booking.customer._id.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Forbidden' });

      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || dp._id.toString() !== booking.doctor._id.toString())
          return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      if (req.user.role === 'hospital') {
        const h = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
        if (!h || h._id.toString() !== booking.hospital?._id?.toString())
          return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      if (booking.onlineConsultation && !isAdmin(req)) {
        delete booking.onlineConsultation.hostToken;
        delete booking.onlineConsultation.patientToken;
        delete booking.onlineConsultation.recordingUrl;
        delete booking.onlineConsultation.doctorNotes;
      }

      if (!isAdmin(req)) {
        delete booking.internalNotes;
      }

      const opRecord = await OutPatientRecord.findOne({ booking: booking._id }).lean();

      return res.json({
        success: true,
        data: { ...booking, outPatientRecord: opRecord ?? null },
      });
    } catch (err) {
      console.error('[GET /consultations/:bookingId]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 14. GET /consultations
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/',
  protect,
  authorize('customer', 'doctor', 'hospital', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const {
        status,
        bookingType,
        from,
        to,
        page  = 1,
        limit = 20,
      } = req.query;

      const filter = {
        bookingType: { $in: ['doctor_consultation', 'doctor_online', 'follow_up', 'physiotherapist'] },
      };

      if (status)      filter.status      = status;
      if (bookingType) filter.bookingType = bookingType;

      if (from || to) {
        filter.scheduledAt = {};
        if (from) filter.scheduledAt.$gte = new Date(from);
        if (to)   filter.scheduledAt.$lte = new Date(to);
      }

      if (req.user.role === 'customer') {
        filter.customer = req.user._id;
      } else if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp) return res.status(403).json({ success: false, message: 'Doctor profile not found' });
        filter.doctor = dp._id;
      } else if (req.user.role === 'hospital') {
        const h = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
        if (!h) return res.status(403).json({ success: false, message: 'Hospital not found' });
        filter.hospital = h._id;
      }

      const skip  = (Number(page) - 1) * Number(limit);
      const total = await Booking.countDocuments(filter);

      const bookings = await Booking.find(filter)
        .select('-internalNotes -onlineConsultation.hostToken -onlineConsultation.patientToken -onlineConsultation.recordingUrl')
        .populate('doctor',   'user specialization profilePhotoUrl')
        .populate('hospital', 'name')
        .populate('customer', 'name phone')
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      return res.json({
        success: true,
        data: {
          bookings,
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

// ═══════════════════════════════════════════════════════════════════════════════
// 15. POST /consultations/:bookingId/network-quality
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/:bookingId/network-quality',
  protect,
  authorize('customer', 'doctor'),
  async (req, res) => {
    try {
      const { participant, quality } = req.body;

      const booking = await Booking.findById(req.params.bookingId);
      if (!booking || booking.bookingType !== 'doctor_online')
        return res.status(404).json({ success: false, message: 'Online consultation not found' });

      if (!booking.onlineConsultation)
        return res.status(400).json({ success: false, message: 'No online consultation data' });

      booking.onlineConsultation.networkQualityLogs.push({
        participant,
        quality,
        timestamp: new Date(),
      });

      if (quality === 'disconnected') {
        booking.onlineConsultation.networkIssueDetected = true;
        booking.onlineConsultation.reconnectCount       = (booking.onlineConsultation.reconnectCount ?? 0) + 1;
        booking.onlineConsultation.lastReconnectAt      = new Date();
      }

      await booking.save();

      // Trigger socket event
      await emitConsultationEvent(req, booking, 'consultation:network_quality', {
        participant,
        quality,
        reconnectCount: booking.onlineConsultation.reconnectCount,
      });

      return res.json({ success: true, message: 'Network quality logged' });
    } catch (err) {
      console.error('[POST /consultations/:bookingId/network-quality]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 16. GET /consultations/:bookingId/follow-up-eligibility
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/:bookingId/follow-up-eligibility',
  protect,
  authorize('customer', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .select('customer doctor status bookingCode')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      if (req.user.role === 'customer' && booking.customer.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Forbidden' });

      if (booking.status !== 'completed')
        return res.json({ success: true, data: { eligible: false, reason: 'Booking not completed' } });

      const opRecord = await OutPatientRecord.findOne({ booking: booking._id }).lean();

      if (!opRecord?.followUpExpiry)
        return res.json({ success: true, data: { eligible: false, reason: 'No follow-up window set' } });

      const now      = new Date();
      const eligible = now < opRecord.followUpExpiry;
      const daysLeft = eligible
        ? Math.ceil((opRecord.followUpExpiry - now) / (1000 * 60 * 60 * 24))
        : 0;

      return res.json({
        success: true,
        data: {
          eligible,
          followUpExpiry: opRecord.followUpExpiry,
          followUpFee:    opRecord.followUpFee,
          daysLeft,
          parentBookingId:   booking._id,
          parentBookingCode: booking.bookingCode,
        },
      });
    } catch (err) {
      console.error('[GET /consultations/:bookingId/follow-up-eligibility]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;