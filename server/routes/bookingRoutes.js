import express from 'express';
import Booking              from '../models/Booking.js';
import Consultation         from '../models/Consultation.js';  // ← added
import Ride                 from '../models/Ride.js';
import RideTracking         from '../models/RideTracking.js';
import User                 from '../models/User.js';
import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import TransportPartner     from '../models/TransportPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import DoctorProfile        from '../models/DoctorProfile.js';
import Hospital             from '../models/Hospital.js';
import OutPatientRecord     from '../models/OutPatientRecord.js';
import SystemLog            from '../models/SystemLog.js';
import Wallet               from '../models/Wallet.js';

import sendEmail                     from '../utils/sendEmail.js';
import sendSms                       from '../services/Sendsms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }   from '../services/bookingSocketService.js';
import {
  transactionalTemplate,
  buildStatusUpdateEmail,
  buildRefundEmail,
} from '../utils/emailTemplates.js';
import {
  driverAssignedSms, careAssistantAssignedSms,
  appointmentConfirmedSms, newCareRequestToAssistantSms,
} from '../utils/Smstemplates.js';
import { generateOpHtml, buildOpZipBuffer } from '../utils/opDocumentGenerator.js';
import { opConfirmationEmailTemplate }       from '../utils/opEmailTemplates.js';

import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  genOtp,
  hashOtp,
  razorpay,
  haversineKm,
  createNotification,
  buildRidePayload,
  calculateCanonicalRoute,
  RADIUS_METERS,
  CARE_RIDE_RADIUS_M,
  TRANSPORT_RADIUS_M,
} from './bookingRouterShared.js';
import {
  resolveCaJoinPoint,
  buildCaJoinWaypoint,
} from '../utils/careJoinPointUtils.js';

import cache       from '../middleware/cache.js';
import redisClient from '../config/redis.js';

const router = express.Router();

// ── Derived constants ─────────────────────────────────────────────────────────
const transportRadiusRad = TRANSPORT_RADIUS_M / 1000 / 6378.1;
const careRideRadiusRad  = CARE_RIDE_RADIUS_M  / 1000 / 6378.1;

// ─────────────────────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL = {
  adminBookings:    30,
  adminStats:       60,
  nearby:           30,
  ops:              45,
  opRecord:         60,
  consultations:    30,
};

const invalidateBookingCache = async () => {
  try {
    const patterns = [
      'GET:/admin/bookings*',
      'GET:/op/*',
      'GET:/hospital/*',
      'GET:/doctor/ops*',
      'GET:/consultations*',
    ];
    for (const pattern of patterns) {
      let cursor = 0;
      do {
        const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        if (reply.keys.length) await redisClient.del(reply.keys);
      } while (cursor !== 0);
    }
  } catch (e) { console.error('[Cache] invalidation error:', e.message); }
};



// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getBookingCoords = (booking) => ({
  pickupCoords:   booking.patientLocation?.coordinates     || [80.648, 16.506],
  pickupAddress:  booking.patientLocation?.address         || '',
  pickupCity:     booking.patientLocation?.city            || '',
  dropoffCoords:  booking.destinationLocation?.coordinates || [80.648, 16.506],
  dropoffAddress: booking.destinationLocation?.address     || '',
  dropoffCity:    booking.destinationLocation?.city        || '',
});

/**
 * Send OP zip email to patient.
 * Used after consultation is confirmed/completed.
 */
const sendOpZipEmail = async ({ op, booking, patient, followUps = [] }) => {
  try {
    const doctor = op.doctor
      ? await DoctorProfile.findById(op.doctor).populate('user', 'name').lean()
      : null;
    const hospital = op.hospital
      ? await Hospital.findById(op.hospital).lean()
      : null;

    const htmlContent = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zipBuffer   = await buildOpZipBuffer(htmlContent, op.opNumber);

    await sendEmail({
      email:   patient.email,
      subject: `Your OP Card — ${op.opNumber} | Likeson Healthcare`,
      html:    opConfirmationEmailTemplate({
        patientName:      patient.name,
        doctorName:       doctor?.user?.name || booking?.doctorSnapshot?.name || 'Your Doctor',
        hospitalName:     hospital?.name || null,
        opNumber:         op.opNumber,
        bookingCode:      booking.bookingCode,
        scheduledAt:      op.scheduledAt || booking.scheduledAt,
        consultationType: op.consultationType,
        isFollowUp:       op.isFollowUp,
        followUpExpiry:   op.followUpExpiry,
        followUpFee:      op.followUpFee,
      }),
      attachments: [{
        content:     zipBuffer.toString('base64'),
        filename:    `${(op.opNumber || 'OP-RECORD').replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`,
        type:        'application/zip',
        disposition: 'attachment',
      }],
    });
  } catch (e) { console.error('[OP ZIP Email] failed:', e.message); }
};

/**
 * Create or fetch an OutPatientRecord for a booking, then send OP zip to patient.
 * Called when a booking/consultation is confirmed or a doctor accepts it.
 */
const createOrSendOpOnConfirmation = async ({ booking, triggeredBy = 'system' }) => {
  try {
    if (!booking.doctor) return;   // only for doctor-involved bookings

    let op = await OutPatientRecord.findOne({ booking: booking._id }).lean();
    if (!op) {
      // Create a minimal OP record so the patient gets their card
      const opDoc = await OutPatientRecord.create({
        booking:          booking._id,
        doctor:           booking.doctor,
        hospital:         booking.hospital || null,
        patient:          booking.customer,
        consultationType: booking.consultationType || 'inPerson',
        scheduledAt:      booking.scheduledAt,
        status:           'scheduled',
        isFollowUp:       !!booking.followUpParentBooking,
        createdBy:        null,
      });
      op = opDoc.toObject();
    }

    const patient   = await User.findById(booking.customer).select('email name phone').lean();
    const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();

    if (patient?.email) {
      await sendOpZipEmail({ op, booking, patient, followUps });
    }

    await createNotification({
      recipient: booking.customer,
      title:     'Booking Confirmed',
      body:      `Your appointment OP ${op.opNumber} is ready. Check your email.`,
      type:      'Booking_Confirmed',
      bookingId: booking._id,
    });
  } catch (e) {
    console.error('[createOrSendOpOnConfirmation] failed:', e.message);
  }
};

const joinBookingRoom = (userId, bookingId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `booking:${bookingId}`); }
  catch (e) { console.error('[joinBookingRoom]', e.message); }
};

const joinTpRoom = (userId, tpId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `tp:${tpId}`); }
  catch (e) { console.error('[joinTpRoom]', e.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPERS  (fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

const emailCustomerStatusUpdate = async ({ booking, newStatus, customer }) => {
  try {
    if (!customer?.email) return;
    const orderItems = (booking.items || []).map(i => ({
      name:          i.name,
      quantity:      i.quantity,
      pricePerUnit:  i.pricePerUnit || 0,
      medicineImage: i.medicineImage || null,
    }));
    await sendEmail({
      email:   customer.email,
      subject: `Booking #${booking.bookingCode} — Status Update: ${newStatus} | Likeson Healthcare`,
      html:    buildStatusUpdateEmail({
        userName:   customer.name,
        order:      { orderId: booking.bookingCode },
        orderItems,
        billing:    booking.fareBreakdown
          ? {
              subTotal:       booking.fareBreakdown.totalAmount || 0,
              gstAmount:      booking.fareBreakdown.taxes       || 0,   // fixed: was taxAmount
              totalPayable:   booking.fareBreakdown.totalAmount || 0,
              discountAmount: booking.fareBreakdown.discount    || 0,   // fixed: was discountAmount
            }
          : null,
        actionLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        newStatus,
      }),
    });
  } catch (e) { console.error('[emailCustomerStatusUpdate]', e.message); }
};

const emailDriverAssigned = async ({ driverUser, booking, verb = 'assigned' }) => {
  try {
    if (!driverUser?.email) return;
    await sendEmail({
      email:   driverUser.email,
      subject: `Ride ${verb} — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'RIDE ASSIGNMENT',
        title:      `Booking #${booking.bookingCode} has been ${verb} to you`,
        body:       `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                     <b>Pickup:</b> ${booking.patientLocation?.address || 'N/A'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/driver/rides`,
        buttonText: 'View Ride',
      }),
    });
  } catch (e) { console.error('[emailDriverAssigned]', e.message); }
};

const emailCareAssistantAssigned = async ({ caUser, caName, booking, verb = 'assigned' }) => {
  try {
    if (!caUser?.email) return;
    await sendEmail({
      email:   caUser.email,
      subject: `Care Request ${verb} — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'CARE ASSIGNMENT',
        title:      `Booking #${booking.bookingCode} has been ${verb} to you`,
        body:       `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                     <b>Location:</b> ${booking.patientLocation?.address || 'N/A'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/care/bookings`,
        buttonText: 'View Booking',
      }),
    });
  } catch (e) { console.error('[emailCareAssistantAssigned]', e.message); }
};

const emailHospitalBookingUpdate = async ({ hospitalUser, booking, subject, body }) => {
  try {
    if (!hospitalUser?.email) return;
    await sendEmail({
      email:   hospitalUser.email,
      subject: subject || `Booking #${booking.bookingCode} Update | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'HOSPITAL NOTIFICATION',
        title:      subject || `Booking #${booking.bookingCode} Update`,
        body,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/hospital/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    });
  } catch (e) { console.error('[emailHospitalBookingUpdate]', e.message); }
};

const emailDoctorBookingUpdate = async ({ doctorUser, booking, subject, body }) => {
  try {
    if (!doctorUser?.email) return;
    await sendEmail({
      email:   doctorUser.email,
      subject: subject || `Booking #${booking.bookingCode} Update | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'DOCTOR NOTIFICATION',
        title:      subject || `Booking #${booking.bookingCode} Update`,
        body,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/doctor/ops`,
        buttonText: 'View OP Records',
      }),
    });
  } catch (e) { console.error('[emailDoctorBookingUpdate]', e.message); }
};

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTATION ROUTES
// These use the Consultation model (linked via booking.consultationSessionId)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /consultations/:bookingId
 * Fetch the Consultation document for a booking.
 * Accessible by customer (own), doctor (assigned), hospital, admin.
 */
router.get('/consultations/:bookingId',
  protect,
  cache(CACHE_TTL.consultations, req => `GET:/consultations/${req.params.bookingId}:${req.user._id}`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .select('customer doctor consultationSessionId bookingCode')
        .lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      // Access control
      const role = req.user.role;
      if (role === 'customer' && String(booking.customer) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(booking.doctor) !== String(dp._id)) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      if (!booking.consultationSessionId) {
        return res.status(404).json({ success: false, message: 'No consultation session linked to this booking' });
      }

      const consultation = await Consultation.findById(booking.consultationSessionId)
        .populate('patient', 'name phone email')
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name phone' } })
        .populate('hospital', 'name address')
        .lean();

      if (!consultation) {
        return res.status(404).json({ success: false, message: 'Consultation not found' });
      }

      return res.json({ success: true, data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /consultations/:consultationId/confirm
 * Doctor or admin confirms/starts the consultation.
 * Sets status → 'scheduled', grants telemedicine consent if provided, and
 * sends OP zip to the patient.
 *
 * Body: { consentAccepted?: boolean }
 */
router.patch('/consultations/:consultationId/confirm',
  protect, authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { consentAccepted = false } = req.body;

      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

      // Doctor access check
      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(consultation.doctor) !== String(dp._id)) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      if (['completed', 'cancelled', 'failed'].includes(consultation.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot confirm a consultation in status: ${consultation.status}`,
        });
      }

      // Update consent if provided
      if (consentAccepted) {
        const existingConsent = consultation.consents?.find(c => c.consentType === 'telemedicine');
        if (!existingConsent) {
          consultation.consents.push({
            consentType:    'telemedicine',
            accepted:       true,
            acceptedAt:     new Date(),
            consentVersion: '1.0',
          });
        }
        consultation.telemedicineConsentAccepted = true;
      }

      consultation.status            = 'scheduled';
      consultation.consultationStage = 'pre_consultation';
      consultation.updatedBy         = req.user._id;
      await consultation.save();

      // Fetch linked booking
      const booking = await Booking.findById(consultation.bookingId).lean();

      // Confirm booking too if still pending
      if (booking && booking.status === 'pending') {
        await Booking.findByIdAndUpdate(booking._id, {
          $set: { status: 'confirmed', updatedBy: req.user._id },
        });
      }

      // Send OP card to patient
      if (booking) {
        createOrSendOpOnConfirmation({ booking: { ...booking, status: 'confirmed' }, triggeredBy: req.user.role })
          .catch(() => {});
      }

      // Notify patient
      await createNotification({
        recipient: consultation.patient,
        title:     'Consultation Confirmed',
        body:      `Your consultation has been confirmed. Please check your email for your OP card.`,
        type:      'Booking_Confirmed',
        bookingId: consultation.bookingId,
      });

      // Email: patient
      const patient = await User.findById(consultation.patient).select('email name phone').lean();
      if (patient?.email) {
        sendEmail({
          email:   patient.email,
          subject: `Consultation Confirmed | Likeson Healthcare`,
          html:    transactionalTemplate({
            header:     'CONSULTATION CONFIRMED',
            title:      'Your consultation has been confirmed',
            body:       `<b>Booking:</b> #${booking?.bookingCode || 'N/A'}<br/>
                         <b>Doctor:</b> ${booking?.doctorSnapshot?.name || 'Your Doctor'}<br/>
                         <b>Scheduled:</b> ${new Date(consultation.scheduledStartTime).toLocaleString('en-IN')}<br/>
                         <b>Type:</b> ${consultation.consultationType}<br/>
                         Your OP card is attached to a separate email.`,
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${consultation.bookingId}`,
            buttonText: 'View Booking',
          }),
        }).catch(e => console.error('[consultation/confirm] patient email:', e.message));
      }

      // Email: doctor confirmation back
      const doctorProfile = await DoctorProfile.findById(consultation.doctor)
        .populate('user', 'name email').lean();
      if (doctorProfile?.user?.email) {
        emailDoctorBookingUpdate({
          doctorUser: doctorProfile.user,
          booking:    booking || { bookingCode: 'N/A', _id: consultation.bookingId, scheduledAt: consultation.scheduledStartTime, patientInfo: {} },
          subject:    `Consultation Confirmed | Likeson Healthcare`,
          body:       `<b>Patient:</b> ${patient?.name || 'N/A'}<br/>
                       <b>Scheduled:</b> ${new Date(consultation.scheduledStartTime).toLocaleString('en-IN')}<br/>
                       <b>Type:</b> ${consultation.consultationType}`,
        }).catch(() => {});
      }

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_confirmed', {
        consultationId: consultation._id,
        status:         'scheduled',
        timestamp:      new Date(),
      });

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation confirmed and OP sent to patient', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /consultations/:consultationId/accept
 * Doctor explicitly accepts an incoming consultation request.
 * Transitions: created/scheduled → waiting (entering waiting room phase).
 * Sends OP card to patient on acceptance.
 */
router.patch('/consultations/:consultationId/accept',
  protect, authorize('doctor'),
  async (req, res) => {
    try {
      const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      const consultation = await Consultation.findOne({
        _id:    req.params.consultationId,
        doctor: dp._id,
      });
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found or not assigned to you' });

      if (!['created', 'scheduled'].includes(consultation.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot accept consultation in status: ${consultation.status}`,
        });
      }

      consultation.status            = 'waiting';
      consultation.consultationStage = 'waiting_room';
      consultation.updatedBy         = req.user._id;
      await consultation.save();

      // Confirm linked booking
      const booking = await Booking.findById(consultation.bookingId);
      if (booking && booking.status === 'pending') {
        booking.status    = 'confirmed';
        booking.updatedBy = req.user._id;
        await booking.save();
      }

      // Send OP card to patient
      if (booking) {
        createOrSendOpOnConfirmation({
          booking: booking.toObject ? booking.toObject() : booking,
          triggeredBy: 'doctor',
        }).catch(() => {});
      }

      const patient = await User.findById(consultation.patient).select('email name phone').lean();

      await createNotification({
        recipient: consultation.patient,
        title:     'Doctor Accepted Your Consultation',
        body:      `Your doctor has accepted. Your OP card has been sent to your email.`,
        type:      'Booking_Confirmed',
        bookingId: consultation.bookingId,
      });

      if (patient?.email) {
        sendEmail({
          email:   patient.email,
          subject: `Doctor Accepted Your Consultation | Likeson Healthcare`,
          html:    transactionalTemplate({
            header:     'DOCTOR ACCEPTED',
            title:      'Your doctor has accepted your consultation request',
            body:       `<b>Booking:</b> #${booking?.bookingCode || 'N/A'}<br/>
                         <b>Doctor:</b> ${booking?.doctorSnapshot?.name || 'Your Doctor'}<br/>
                         <b>Scheduled:</b> ${new Date(consultation.scheduledStartTime).toLocaleString('en-IN')}<br/>
                         Please join the waiting room. Your OP card is attached in a separate email.`,
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${consultation.bookingId}`,
            buttonText: 'Join Waiting Room',
          }),
        }).catch(e => console.error('[consultation/accept] patient email:', e.message));
      }

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_accepted', {
        consultationId: consultation._id,
        status:         'waiting',
        timestamp:      new Date(),
      });

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation accepted. Patient notified and OP sent.', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /consultations/:consultationId/start
 * Doctor starts the active session (waiting → active).
 * Requires telemedicine consent to be accepted (model pre-validate enforces this).
 */
router.patch('/consultations/:consultationId/start',
  protect, authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(consultation.doctor) !== String(dp._id)) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      if (consultation.status !== 'waiting') {
        return res.status(400).json({
          success: false,
          message: `Consultation must be in 'waiting' status to start. Current: ${consultation.status}`,
        });
      }

      if (!consultation.telemedicineConsentAccepted) {
        return res.status(400).json({
          success: false,
          message: 'Telemedicine consent must be accepted before starting the consultation',
        });
      }

      consultation.status            = 'active';
      consultation.consultationStage = 'in_progress';
      consultation.actualStartTime   = new Date();
      consultation.roomStarted       = true;
      consultation.doctorJoinedAt    = new Date();
      consultation.updatedBy         = req.user._id;
      await consultation.save();

      // Move booking to in_progress
      await Booking.findByIdAndUpdate(consultation.bookingId, {
        $set: { status: 'in_progress', updatedBy: req.user._id },
      });

      await createNotification({
        recipient: consultation.patient,
        title:     'Consultation Started',
        body:      'Your consultation has started. Please join now.',
        type:      'Care_Task_Started',
        bookingId: consultation.bookingId,
      });

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_started', {
        consultationId: consultation._id,
        meetingId:      consultation.meetingId,
        roomId:         consultation.roomId,
        consultationType: consultation.consultationType,
        timestamp:      new Date(),
      });

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation started', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /consultations/:consultationId/end
 * End an active/paused consultation.
 * Body: { reason?: string, prescriptionUploaded?: boolean }
 */
router.patch('/consultations/:consultationId/end',
  protect, authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { reason, prescriptionUploaded = false } = req.body;

      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(consultation.doctor) !== String(dp._id)) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      if (!['active', 'paused'].includes(consultation.status)) {
        return res.status(400).json({
          success: false,
          message: `Can only end an active or paused consultation. Current: ${consultation.status}`,
        });
      }

      consultation.status               = 'completed';
      consultation.actualEndTime        = new Date();
      consultation.roomEnded            = true;
      consultation.patientLeftAt        = new Date();
      consultation.doctorLeftAt         = new Date();
      consultation.prescriptionUploaded = prescriptionUploaded;
      consultation.endedBy              = req.user.role === 'doctor' ? 'doctor' : 'admin';
      consultation.endedByUserId        = req.user._id;
      consultation.endedReason          = reason || null;
      consultation.updatedBy            = req.user._id;

      if (consultation.actualStartTime) {
        const diffMs = consultation.actualEndTime - consultation.actualStartTime;
        consultation.actualDurationMinutes = Math.round(diffMs / 60000);
      }

      await consultation.save();

      // Complete the booking
      await Booking.findByIdAndUpdate(consultation.bookingId, {
        $set: { status: 'completed', updatedBy: req.user._id },
      });

      // Send final OP zip with any follow-up info
      const booking   = await Booking.findById(consultation.bookingId).lean();
      const patient   = await User.findById(consultation.patient).select('email name phone').lean();
      if (booking) {
        const op      = await OutPatientRecord.findOne({ booking: booking._id }).lean();
        const followUps = op ? await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean() : [];
        if (op && patient?.email) sendOpZipEmail({ op, booking, patient, followUps });
      }

      await createNotification({
        recipient: consultation.patient,
        title:     'Consultation Completed',
        body:      'Your consultation has ended. Please check your email for your prescription and OP card.',
        type:      'Care_Task_Completed',
        bookingId: consultation.bookingId,
      });

      if (patient?.email) {
        sendEmail({
          email:   patient.email,
          subject: `Consultation Completed | Likeson Healthcare`,
          html:    transactionalTemplate({
            header:     'CONSULTATION COMPLETE',
            title:      'Your consultation has ended',
            body:       `<b>Duration:</b> ${consultation.actualDurationMinutes || 0} minutes<br/>
                         <b>Prescription:</b> ${prescriptionUploaded ? 'Uploaded — check your email' : 'Pending'}<br/>
                         Please rate your experience.`,
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${consultation.bookingId}/rate`,
            buttonText: 'Rate Your Experience',
          }),
        }).catch(e => console.error('[consultation/end] patient email:', e.message));
      }

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_ended', {
        consultationId:        consultation._id,
        status:                'completed',
        actualDurationMinutes: consultation.actualDurationMinutes,
        timestamp:             new Date(),
      });

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation ended', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /consultations/:consultationId/consent
 * Patient submits telemedicine consent before the session.
 * Body: { consentType: 'telemedicine'|'recording'|'ai_analysis'|..., accepted: boolean }
 */
router.patch('/consultations/:consultationId/consent',
  protect,
  async (req, res) => {
    try {
      const { consentType = 'telemedicine', accepted = true } = req.body;

      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

      // Only patient or admin may submit consent
      if (req.user.role === 'customer' && String(consultation.patient) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Upsert the consent entry
      const existing = consultation.consents?.findIndex(c => c.consentType === consentType);
      const entry = {
        consentType,
        accepted,
        acceptedAt:     accepted ? new Date() : undefined,
        consentVersion: '1.0',
      };
      if (existing >= 0) {
        consultation.consents[existing] = { ...consultation.consents[existing], ...entry };
      } else {
        consultation.consents.push(entry);
      }

      // Sync quick-access flags
      if (consentType === 'telemedicine') consultation.telemedicineConsentAccepted = accepted;
      if (consentType === 'recording')    consultation.recordingConsentAccepted    = accepted;

      consultation.updatedBy = req.user._id;
      await consultation.save();

      return res.json({ success: true, message: `Consent for '${consentType}' recorded`, data: { consentType, accepted } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /consultations/:consultationId/chat
 * Send a chat message inside a consultation.
 * Body: { message: string, messageType?: string }
 */
router.post('/consultations/:consultationId/chat',
  protect,
  async (req, res) => {
    try {
      const { message, messageType = 'text' } = req.body;
      if (!message?.trim()) return res.status(400).json({ success: false, message: 'message is required' });

      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });
      if (!consultation.chatEnabled) return res.status(400).json({ success: false, message: 'Chat is disabled for this consultation' });

      // Determine sender role
      let senderRole = 'patient';
      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (dp && String(consultation.doctor) === String(dp._id)) senderRole = 'doctor';
      } else if (['admin', 'superadmin'].includes(req.user.role)) {
        senderRole = 'admin';
      } else if (req.user.role === 'care_assistant') {
        senderRole = 'care_assistant';
      }

      const chatEntry = {
        sender:      req.user._id,
        senderRole,
        messageType,
        message:     message.trim(),
        attachments: [],
      };
      consultation.chatMessages.push(chatEntry);
      consultation.updatedBy = req.user._id;
      await consultation.save();

      const saved = consultation.chatMessages[consultation.chatMessages.length - 1];

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'chat_message', {
        consultationId: consultation._id,
        message:        saved,
      });

      return res.json({ success: true, data: { message: saved } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /consultations/:consultationId/join-token
 * Returns the meeting join info for a participant.
 * Doctor gets hostToken, patient gets participantToken (both stored select: false — fetch explicitly).
 */
router.get('/consultations/:consultationId/join-token',
  protect,
  async (req, res) => {
    try {
      const consultation = await Consultation.findById(req.params.consultationId)
        .select('roomId meetingId  provider status patient doctor')
        .lean();
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

      if (!['scheduled', 'waiting', 'active'].includes(consultation.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot join a consultation in status: ${consultation.status}`,
        });
      }

      if (!consultation.roomId) {
        return res.status(400).json({
          success: false,
          message: 'Consultation room not configured yet',
        });
      }

      const { generateAgoraToken } = await import('../services/agoraService.js');

      let role = 'patient';
      let uid  = 0;

      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (dp && String(consultation.doctor) === String(dp._id)) {
          role = 'doctor';
        }
      }

      // Fresh short-lived token (2 hours) — never cache tokens
      const token = generateAgoraToken(consultation.roomId, role === 'doctor' ? 'host' : 'participant', uid, 7200);

      return res.json({
        success: true,
        data: {
          token,
          role,
          uid,
          channelName: consultation.roomId,
          roomId:      consultation.roomId,
          meetingId:   consultation.meetingId,
          consultationType: consultation.consultationType,
          provider:    consultation.provider ?? 'Agora',
          appId:       process.env.AGORAIO_APP_ID,
          expiresInSeconds: 7200,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// TRANSPORT PARTNER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/tp/assigned',
  protect, authorize('transportpartner'),
  cache(CACHE_TTL.ops, req => `GET:/tp/assigned:${req.user._id}`),
  async (req, res) => {
    try {
      const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });

      const bookings = await Booking.find({ transportPartner: tp._id })
        .select('bookingCode bookingType scheduledAt patientInfo status fareBreakdown primaryRide patientLocation destinationLocation')
        .populate('customer', 'name phone')
        .sort({ scheduledAt: -1 })
        .lean();

      return res.json({ success: true, data: { bookings } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/tp/drivers/available', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const drivers = await Driver.find({
      ownerAgency: tp._id,
      status:      'Available',
      isActive:    true,
      isVerified:  true,
      isBlocked:   false,
    })
      .select('legalName phone driverCode assignedVehicleSnapshot performance.rating status location')
      .sort({ 'performance.rating': -1, legalName: 1 })
      .lean();

    return res.json({ success: true, data: { drivers } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /:id/tp/assign-driver
 * TP assigns one of their own drivers.
 */
router.patch('/:id/tp/assign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ success: false, message: 'driverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const driver = await Driver.findOne({ _id: driverId, ownerAgency: tp._id }).lean();
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    await Ride.updateMany(
      { booking: booking._id, status: { $in: ['requested', 'searching'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'system', 'cancellation.cancelledAt': new Date() }
    );

    const coords = getBookingCoords(booking);
    const otp    = genOtp();
    const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
      coords.pickupCoords, coords.dropoffCoords,
    );

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy:         req.user._id,
      }),
      driver:               driverId,
      transportPartner:     tp._id,
      status:               'driver_assigned',
      estimatedDistanceKm:  distanceKm,
      estimatedDurationMin: durationMin,
      pickupOtp:            hashOtp(otp),
    });

    const tracking = await RideTracking.create({
      ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
    });
    await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

    await Booking.findByIdAndUpdate(booking._id, {
      $push: { rides: ride._id },
      $set:  {
        primaryRide:      ride._id,
        transportPartner: tp._id,
        status:           'confirmed',
        updatedBy:        req.user._id,
      },
    });

    const driverUser = await User.findById(driver.user).select('email phone name').lean();
    const customer   = await User.findById(booking.customer).select('email phone name').lean();

    await createNotification({
      recipient: driver.user,
      title:     'New Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

    emailDriverAssigned({ driverUser, booking }).catch(() => {});

    sendEmail({
      email:   customer?.email,
      subject: `Driver Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'DRIVER ASSIGNED',
        title:      `Your driver is confirmed for Booking #${booking.bookingCode}`,
        body:       `<b>Driver:</b> ${driverUser?.name || 'N/A'}<br/>
                     <b>Phone:</b> ${driverUser?.phone || 'N/A'}<br/>
                     <b>Vehicle:</b> ${driver.assignedVehicleSnapshot?.registrationNumber || 'N/A'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
                     <b>Est. Distance:</b> ${distanceKm} km`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'Track Booking',
      }),
    }).catch(e => console.error('[TP assign-driver] customer email:', e.message));

    sendSms({
      to:      driverUser.phone,
      message: `Hi ${driverUser.name}, new ride: Booking #${booking.bookingCode}. Check Likeson Driver app.`,
    }).catch(e => console.error('[TP assign] SMS:', e.message));

    joinBookingRoom(driver.user, booking._id);

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_assigned', {
      bookingId:   booking._id,
      driverName:  driverUser.name,
      driverPhone: driverUser.phone,
      vehicle:     driver.assignedVehicleSnapshot,
      mapRoute: {
        polyline,
        pickupCoords:     coords.pickupCoords,
        pickupAddress:    coords.pickupAddress,
        dropoffCoords:    coords.dropoffCoords,
        dropoffAddress:   coords.dropoffAddress,
        estimatedDistKm:  distanceKm,
        estimatedMinutes: durationMin,
        currentTarget:    'pickup',
      },
    });

    await invalidateBookingCache();
    return res.json({
      success: true,
      message: 'Driver assigned',
      data: {
        ride,
        driverInfo: {
          name:          driverUser.name,
          phone:         driverUser.phone,
          vehicleNumber: driver.assignedVehicleSnapshot?.registrationNumber,
        },
        mapRoute: { estimatedDistKm: distanceKm, estimatedMinutes: durationMin },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /:id/tp/reassign-driver
 */
router.patch('/:id/tp/reassign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { newDriverId } = req.body;
    if (!newDriverId) return res.status(400).json({ success: false, message: 'newDriverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const driver = await Driver.findOne({ _id: newDriverId, ownerAgency: tp._id }).lean();
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    await Ride.updateMany(
      { booking: req.params.id, status: { $in: ['driver_assigned', 'driver_accepted'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'system', 'cancellation.cancelledAt': new Date() }
    );

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const coords = getBookingCoords(booking);
    const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
      coords.pickupCoords, coords.dropoffCoords,
    );

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy:         req.user._id,
      }),
      driver:               newDriverId,
      transportPartner:     tp._id,
      status:               'driver_assigned',
      estimatedDistanceKm:  distanceKm,
      estimatedDurationMin: durationMin,
      pickupOtp:            hashOtp(genOtp()),
    });

    const tracking = await RideTracking.create({
      ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
    });
    await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
    await Booking.findByIdAndUpdate(booking._id, {
      $push: { rides: ride._id },
      $set:  { primaryRide: ride._id, updatedBy: req.user._id },
    });

    const driverUser = await User.findById(driver.user).select('email phone name').lean();
    const customer   = await User.findById(booking.customer).select('email phone name').lean();

    await createNotification({
      recipient: driver.user,
      title:     'Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
    });

    emailDriverAssigned({ driverUser, booking, verb: 'reassigned' }).catch(() => {});

    sendEmail({
      email:   customer?.email,
      subject: `Driver Updated — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'DRIVER UPDATED',
        title:      `Your driver has been updated for Booking #${booking.bookingCode}`,
        body:       `<b>New Driver:</b> ${driverUser?.name || 'N/A'}<br/>
                     <b>Phone:</b> ${driverUser?.phone || 'N/A'}<br/>
                     <b>Vehicle:</b> ${driver.assignedVehicleSnapshot?.registrationNumber || 'N/A'}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'Track Booking',
      }),
    }).catch(e => console.error('[TP reassign-driver] customer email:', e.message));

    joinBookingRoom(driver.user, booking._id);
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver reassigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/care/assigned',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const bookings = await Booking.find({ careAssistant: profile._id })
        .select('bookingCode bookingType scheduledAt patientInfo status patientLocation careAssistantSnapshot fareBreakdown')
        .populate('customer', 'name phone')
        .sort({ scheduledAt: -1 })
        .lean();

      return res.json({ success: true, data: { bookings } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/arrived',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      booking.statusLog.push({
        fromStatus: booking.status,
        toStatus:   booking.status,
        changedBy:  req.user._id,
        reason:     'Care assistant arrived at pickup',
      });
      booking.updatedBy = req.user._id;
      await booking.save();

      const customer = await User.findById(booking.customer).select('email phone name').lean();

      await createNotification({
        recipient: booking.customer,
        title:     'Care Assistant Arrived',
        body:      'Your care assistant has arrived at pickup.',
        type:      'Care_Assistant_Arriving',
        bookingId: booking._id,
      });

      sendEmail({
        email:   customer?.email,
        subject: `Care Assistant Arrived — Booking #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header:     'CARE ASSISTANT UPDATE',
          title:      'Your care assistant has arrived',
          body:       `Your care assistant is at your pickup location for Booking <b>#${booking.bookingCode}</b>.<br/>
                       Please be ready to receive them.`,
          buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
          buttonText: 'View Booking',
        }),
      }).catch(e => console.error('[care/arrived] email:', e.message));

      getBookingSocketService()?.emitToRoom(
        `booking:${booking._id}`, 'care_arrived', { bookingId: booking._id }
      );

      return res.json({ success: true, message: 'Arrival marked' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/start',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      if (booking.status !== 'confirmed') {
        return res.status(400).json({ success: false, message: `Cannot start a booking in status: ${booking.status}` });
      }

      booking.status = 'in_progress';
      booking.statusLog.push({
        fromStatus: 'confirmed',
        toStatus:   'in_progress',
        changedBy:  req.user._id,
        reason:     'Care assistant started task',
      });
      booking.updatedBy = req.user._id;
      await booking.save();

      const customer = await User.findById(booking.customer).select('email phone name').lean();

      await createNotification({
        recipient: booking.customer,
        title:     'Care Task Started',
        body:      'Your care assistant has started the task.',
        type:      'Care_Task_Started',
        bookingId: booking._id,
      });

      sendEmail({
        email:   customer?.email,
        subject: `Care Task Started — Booking #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header:     'CARE UPDATE',
          title:      'Your care task has started',
          body:       `Your care assistant has begun the task for Booking <b>#${booking.bookingCode}</b>.<br/>
                       They will update you upon completion.`,
          buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
          buttonText: 'View Booking',
        }),
      }).catch(e => console.error('[care/start] email:', e.message));

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
        bookingId: booking._id, status: 'in_progress', timestamp: new Date(),
      });

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Task started' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/complete',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      if (booking.status !== 'in_progress') {
        return res.status(400).json({ success: false, message: `Cannot complete a booking in status: ${booking.status}` });
      }

      booking.status = 'completed';
      booking.statusLog.push({
        fromStatus: 'in_progress',
        toStatus:   'completed',
        changedBy:  req.user._id,
        reason:     'Care assistant completed task',
      });
      booking.updatedBy = req.user._id;
      await booking.save();

      const customer = await User.findById(booking.customer).select('email phone name').lean();

      await createNotification({
        recipient: booking.customer,
        title:     'Care Task Completed',
        body:      'Your care assistant has completed the task.',
        type:      'Care_Task_Completed',
        bookingId: booking._id,
      });

      sendEmail({
        email:   customer?.email,
        subject: `Care Task Completed — Booking #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header:     'CARE COMPLETED',
          title:      'Your care task is complete',
          body:       `Your care assistant has successfully completed the task for Booking <b>#${booking.bookingCode}</b>.<br/>
                       Please rate your experience.`,
          buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}/rate`,
          buttonText: 'Rate Your Experience',
        }),
      }).catch(e => console.error('[care/complete] email:', e.message));

      getBookingSocketService()?.emitToRoom(
        `booking:${booking._id}`, 'care_completed', { bookingId: booking._id }
      );

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Task completed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/care/location',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { lat, lng, heading, speed, bookingId, status } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });

      const profile = await CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        { 'location.coordinates': [lng, lat], 'location.updatedAt': new Date() },
        { new: true }
      ).select('_id').lean();

      if (bookingId) {
        // Find active ride for this booking
        const activeRide = await Ride.findOne({
          booking: bookingId,
          status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route',
                          'driver_arrived', 'otp_verified', 'in_progress', 'at_stop'] },
        }).select('_id').lean();

        if (activeRide) {
          // Push CA breadcrumb + update live location in RideTracking
          await RideTracking.updateCareAssistantLocation(activeRide._id, {
            coordinates: [lng, lat], heading, speedKmh: speed,
          }).catch(e => console.error('[CA location] tracking update:', e.message));

          // Update CA status in tracking if provided
          if (status) {
            await RideTracking.updateCareAssistantStatus(activeRide._id, status)
              .catch(e => console.error('[CA location] status update:', e.message));
          }
        }

        // Broadcast to booking room — driver + customer both see CA position
        getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'care_assistant_location_update', {
          lat, lng, heading,
          speed:          speed ?? 0,
          role:           'care_assistant',
          careAssistantId: profile?._id,
          status:         status ?? null,
          updatedAt:      new Date(),
          rideId:         activeRide?._id ?? null,
        });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);


// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT — RIDE SESSION PARTICIPATION
// CA joins/updates status in an active ride tracking session
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /:id/care/join-ride
 * CA joins ride session at any stage (before pickup, during, or midway).
 * Links CA profile to RideTracking. Broadcasts to booking room.
 * Body: { currentLat, currentLng }
 */
router.post('/:id/care/join-ride',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { currentLat, currentLng } = req.body;

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id fullName').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id })
        .select('_id bookingCode customer primaryRide status').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      if (!booking.primaryRide)
        return res.status(400).json({ success: false, message: 'No active ride on this booking yet' });

      const ride = await Ride.findById(booking.primaryRide)
        .select('_id status trackingId').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      const activeMidwayStatuses = [
        'driver_assigned', 'driver_accepted', 'driver_en_route',
        'driver_arrived', 'otp_verified', 'in_progress', 'at_stop',
      ];
      if (!activeMidwayStatuses.includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot join ride in status: ${ride.status}` });

      // Attach CA to RideTracking
      const tracking = await RideTracking.attachCareAssistant(ride._id, profile._id);
      if (!tracking) return res.status(404).json({ success: false, message: 'Ride tracking not found' });

      // If CA provides current location, record first breadcrumb immediately
      if (currentLat && currentLng) {
        await RideTracking.updateCareAssistantLocation(ride._id, {
          coordinates: [currentLng, currentLat], source: 'gps',
        }).catch(() => {});

        // Update CA profile location too
        await CareAssistantProfile.findByIdAndUpdate(profile._id, {
          'location.coordinates': [currentLng, currentLat],
          'location.updatedAt':   new Date(),
        });
      }

      // Join booking socket room
      getBookingSocketService()?.emitJoinRoom(String(req.user._id), `booking:${booking._id}`);

      // Broadcast CA joined to all participants in booking room
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_joined_ride', {
        bookingId:         booking._id,
        rideId:            ride._id,
        careAssistantId:   profile._id,
        careAssistantName: profile.fullName,
        joinedAt:          new Date(),
        currentLocation:   (currentLat && currentLng) ? { lat: currentLat, lng: currentLng } : null,
        rideStatus:        ride.status,
      });

      await createNotification({
        recipient: booking.customer,
        title:     'Care Assistant Joined',
        body:      `${profile.fullName} has joined your ride session.`,
        type:      'Care_Assistant_Assigned',
        bookingId: booking._id,
      });

      return res.json({
        success: true,
        message: 'Joined ride session successfully',
        data: {
          rideId:            ride._id,
          bookingId:         booking._id,
          careAssistantStatus: 'en_route_to_pickup',
          socketRoom:        `booking:${booking._id}`,
          socketEvents:      ['care_assistant_location_update', 'care_assistant_status_change'],
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /:id/care/ride-status
 * CA updates their status within ride session.
 * Statuses: en_route_to_pickup | at_pickup | in_ride | departed
 * Body: { status, lat?, lng? }
 */
router.patch('/:id/care/ride-status',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { status, lat, lng } = req.body;
      const validStatuses = ['en_route_to_pickup', 'at_pickup', 'in_ride', 'departed'];
      if (!status || !validStatuses.includes(status))
        return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id fullName').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id })
        .select('_id customer primaryRide').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      if (!booking.primaryRide)
        return res.status(400).json({ success: false, message: 'No active ride on this booking' });

      // Update status in tracking
      await RideTracking.updateCareAssistantStatus(booking.primaryRide, status);

      // If location provided, update too
      if (lat && lng) {
        await RideTracking.updateCareAssistantLocation(booking.primaryRide, {
          coordinates: [lng, lat], source: 'gps',
        }).catch(() => {});
      }

      // Add milestone to ride tracking for key transitions
      const milestoneMap = {
        at_pickup: 'care_assistant_joined',
        in_ride:   'care_assistant_joined',
      };
      if (milestoneMap[status]) {
        RideTracking.addMilestone(booking.primaryRide, milestoneMap[status], {
          coordinates:      lat && lng ? [lng, lat] : null,
          meta:             { careAssistantId: profile._id, status },
          recordedBy:       'driver',
          recordedByUserId: req.user._id,
        }).catch(() => {});
      }

      // Broadcast status change to booking room
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_status_change', {
        bookingId:           booking._id,
        rideId:              booking.primaryRide,
        careAssistantId:     profile._id,
        careAssistantName:   profile.fullName,
        careAssistantStatus: status,
        location:            (lat && lng) ? { lat, lng } : null,
        timestamp:           new Date(),
      });

      if (status === 'at_pickup') {
        await createNotification({
          recipient: booking.customer,
          title:     'Care Assistant Arrived',
          body:      `${profile.fullName} has arrived at pickup and is ready.`,
          type:      'Care_Assistant_Arriving',
          bookingId: booking._id,
        });
      }

      return res.json({ success: true, message: `Status updated to ${status}`, data: { status } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /:id/care/tracking-snapshot
 * Customer/admin gets full tracking snapshot including CA position.
 * Returns driver live location + CA live location + both route contexts.
 */
router.get('/:id/care/tracking-snapshot',
  protect, authorize('customer', 'admin', 'superadmin', 'care_assistant'),
  async (req, res) => {
   try {
    const booking = await Booking.findById(req.params.id)
      .select('customer primaryRide careAssistant status bookingType')
      .lean();
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });
 
    // Access control for customer
    if (req.user.role === 'customer' && String(booking.customer) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Access denied' });
 
    const isCareAssistantOnly = booking.bookingType === 'care_assistant';
    const isFullCareRide      = booking.bookingType === 'full_care_ride';
 
    if (!booking.primaryRide)
      return res.status(200).json({
        success: true,
        data: { message: 'No active ride yet', hasRide: false },
      });
 
    // ── Fetch ride + tracking in parallel ────────────────────────────────────
    const [ride, tracking] = await Promise.all([
      Ride.findById(booking.primaryRide)
        .select([
          'status liveLocation driverSnapshot vehicleSnapshot',
          'pickup dropoff estimatedDistanceKm estimatedDurationMin',
          'rideStartedAt scheduledPickupAt waypoints rideStage',
          'activeNavigationTarget',
        ].join(' '))
        .lean(),
      RideTracking.findOne({ ride: booking.primaryRide })
        .select([
          'currentEtaMinutes currentEtaTarget hasActiveSos expectedRoutePolyline',
          'careAssistant careAssistantLiveLocation careAssistantStatus',
          'careAssistantJoinedAt careAssistantBreadcrumbCount milestones',
          'liveRouteContext activeTarget',
        ].join(' '))
        .lean(),
    ]);
 
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
 
    // ── CA profile snapshot ───────────────────────────────────────────────────
    let caSnapshot = null;
    if (booking.careAssistant) {
      const ca = await CareAssistantProfile.findById(booking.careAssistant)
        .select('fullName phone photoUrl specializations performance.averageRating location')
        .lean();
      if (ca) {
        caSnapshot = {
          profileId:       ca._id,
          name:            ca.fullName,
          phone:           ca.phone,
          photoUrl:        ca.photoUrl,
          specializations: ca.specializations,
          rating:          ca.performance?.averageRating,
          isLinkedToRide:  !!tracking?.careAssistant,
          status:          tracking?.careAssistantStatus ?? 'not_joined',
          joinedAt:        tracking?.careAssistantJoinedAt ?? null,
        };
      }
    }
 
    // ── Helper: format live location ──────────────────────────────────────────
    const fmtLoc = (loc) => {
      if (!loc?.coordinates || loc.coordinates.length !== 2) return null;
      return {
        lat:       loc.coordinates[1],
        lng:       loc.coordinates[0],
        heading:   loc.heading  ?? 0,
        speedKmh:  loc.speedKmh ?? 0,
        updatedAt: loc.updatedAt,
      };
    };
 
    // ════════════════════════════════════════════════════════════════════════
    // CASE A: care_assistant booking — CA is PRIMARY tracked entity, no driver
    // ════════════════════════════════════════════════════════════════════════
    if (isCareAssistantOnly) {
      const caLiveLocation = fmtLoc(tracking?.careAssistantLiveLocation);
 
      return res.json({
        success: true,
        data: {
          bookingId:   booking._id,
          rideId:      ride._id,
          rideStatus:  ride.status,
          bookingType: 'care_assistant',
 
          // PRIMARY: CA live tracking (no driver)
          careAssistant: caSnapshot
            ? {
                ...caSnapshot,
                liveLocation:    caLiveLocation,
                breadcrumbCount: tracking?.careAssistantBreadcrumbCount ?? 0,
                // CA route: from CA location to patient (pickup = patient)
                destination: {
                  coordinates: ride.dropoff?.coordinates,
                  address:     ride.dropoff?.address,
                },
              }
            : null,
 
          // Route: CA start → patient location
          route: {
            // pickup = CA start, dropoff = patient
            caStart:              ride.pickup,
            patientLocation:      ride.dropoff,
            expectedPolyline:     tracking?.expectedRoutePolyline ?? null,
            estimatedDistanceKm:  ride.estimatedDistanceKm,
            estimatedDurationMin: ride.estimatedDurationMin,
            currentEtaMinutes:    tracking?.currentEtaMinutes ?? null,
            currentEtaTarget:     tracking?.currentEtaTarget  ?? null,
          },
 
          // No driver info for care_assistant booking
          driver: null,
 
          hasActiveSos: tracking?.hasActiveSos ?? false,
          milestones:   tracking?.milestones   ?? [],
 
          socketHint: {
            room:   `booking:${booking._id}`,
            events: [
              'care_assistant_location_update',  // PRIMARY GPS for this booking type
              'care_assistant_status_change',
              'care_assistant_joined_ride',
              'booking_status_change',
            ],
            note: 'care_assistant booking: CA location is primary. No driver tracking.',
          },
 
          _serverTime: new Date().toISOString(),
        },
      });
    }
 
    // ════════════════════════════════════════════════════════════════════════
    // CASE B: full_care_ride — driver primary + CA secondary
    // ════════════════════════════════════════════════════════════════════════
    if (isFullCareRide) {
      const driverLiveLocation = fmtLoc(ride.liveLocation);
      const caLiveLocation     = fmtLoc(tracking?.careAssistantLiveLocation);
 
      // Find CA join waypoint from ride.waypoints if present
      const caJoinWaypoint = ride.waypoints?.find(w => w.type === 'care_assistant_join') ?? null;
 
      return res.json({
        success: true,
        data: {
          bookingId:   booking._id,
          rideId:      ride._id,
          rideStatus:  ride.status,
          rideStage:   ride.rideStage,
          bookingType: 'full_care_ride',
 
          // PRIMARY: driver tracking
          driver: {
            liveLocation:    driverLiveLocation,
            snapshot:        ride.driverSnapshot,
            vehicleSnapshot: ride.vehicleSnapshot,
          },
 
          // Route: driver full route with CA join waypoint
          route: {
            pickup:               ride.pickup,
            dropoff:              ride.dropoff,
            expectedPolyline:     tracking?.expectedRoutePolyline ?? null,
            estimatedDistanceKm:  ride.estimatedDistanceKm,
            estimatedDurationMin: ride.estimatedDurationMin,
            currentEtaMinutes:    tracking?.currentEtaMinutes     ?? null,
            currentEtaTarget:     tracking?.currentEtaTarget      ?? null,
            activeNavigationTarget: ride.activeNavigationTarget,
            // CA join waypoint on driver route
            caJoinWaypoint: caJoinWaypoint
              ? {
                  coordinates: caJoinWaypoint.location?.coordinates,
                  address:     caJoinWaypoint.location?.address,
                  label:       caJoinWaypoint.location?.label,
                  isCompleted: caJoinWaypoint.isCompleted,
                  completedAt: caJoinWaypoint.completedAt,
                  zone:        caJoinWaypoint.meta?.zone,
                  distCaToJoinKm: caJoinWaypoint.meta?.distCaToJoinKm,
                  // CA travels from their location to this join point
                  caRouteFrom: caJoinWaypoint.meta?.caFrom,
                }
              : null,
          },
 
          // SECONDARY: CA tracking
          careAssistant: caSnapshot
            ? {
                ...caSnapshot,
                liveLocation:    caLiveLocation,
                breadcrumbCount: tracking?.careAssistantBreadcrumbCount ?? 0,
                // CA own route to join point (CA navigates independently)
                joinPointRoute: caJoinWaypoint && caJoinWaypoint.meta?.caFrom
                  ? {
                      from:        caJoinWaypoint.meta.caFrom,
                      to:          caJoinWaypoint.location?.coordinates,
                      distKm:      caJoinWaypoint.meta?.distCaToJoinKm,
                      isCompleted: caJoinWaypoint.isCompleted,
                      note:        'CA travels to join point independently, then boards ride',
                    }
                  : null,
              }
            : null,
 
          hasActiveSos: tracking?.hasActiveSos ?? false,
          milestones:   tracking?.milestones   ?? [],
 
          socketHint: {
            room:   `booking:${booking._id}`,
            events: [
              'location_update',                 // driver GPS (primary)
              'care_assistant_location_update',  // CA GPS (secondary)
              'care_assistant_status_change',
              'care_assistant_joined_ride',
              'eta_update',
              'ride_status_changed',
            ],
          },
 
          _serverTime: new Date().toISOString(),
        },
      });
    }
 
    // ════════════════════════════════════════════════════════════════════════
    // CASE C: other booking types (patient_transport etc.) — driver only
    // ════════════════════════════════════════════════════════════════════════
    return res.json({
      success: true,
      data: {
        bookingId:  booking._id,
        rideId:     ride._id,
        rideStatus: ride.status,
 
        driver: {
          liveLocation:    fmtLoc(ride.liveLocation),
          snapshot:        ride.driverSnapshot,
          vehicleSnapshot: ride.vehicleSnapshot,
        },
 
        route: {
          pickup:               ride.pickup,
          dropoff:              ride.dropoff,
          expectedPolyline:     tracking?.expectedRoutePolyline ?? null,
          estimatedDistanceKm:  ride.estimatedDistanceKm,
          estimatedDurationMin: ride.estimatedDurationMin,
          currentEtaMinutes:    tracking?.currentEtaMinutes ?? null,
          currentEtaTarget:     tracking?.currentEtaTarget  ?? null,
        },
 
        careAssistant: null,
        hasActiveSos:  tracking?.hasActiveSos ?? false,
        milestones:    tracking?.milestones   ?? [],
 
        socketHint: {
          room:   `booking:${booking._id}`,
          events: ['location_update', 'eta_update', 'ride_status_changed'],
        },
 
        _serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// HOSPITAL ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/hospital/upcoming', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const bookings = await Booking.find({
      hospital:    hospital._id,
      status:      { $in: ['pending', 'confirmed', 'in_progress'] },
      scheduledAt: { $gte: new Date() },
      bookingType: { $in: ['full_care_ride', 'doctor_consultation', 'doctor_online', 'physiotherapist', 'follow_up'] },
    })
      .select('bookingCode patientInfo scheduledAt bookingType status consultationType doctorSnapshot careAssistantSnapshot fareBreakdown primaryRide consultationSessionId')
      .populate({
        path:     'doctor',
        select:   'specialization registrationNumber',
        populate: { path: 'user', select: 'name phone' },
      })
      .populate('careAssistant', 'fullName phone photoUrl experience')
      .populate('customer', 'name phone')
      .sort({ scheduledAt: 1 })
      .lean();

    return res.json({ success: true, data: { bookings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /:id/hospital/confirm
 * Hospital confirms appointment. Sends OP card to patient.
 */
router.patch('/:id/hospital/confirm', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const booking = await Booking.findOne({ _id: req.params.id, hospital: hospital._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not your hospital' });

    booking.statusLog.push({
      fromStatus: booking.status,
      toStatus:   booking.status,
      changedBy:  req.user._id,
      reason:     'Hospital confirmed appointment slot',
    });
    booking.notificationsSent.bookingConfirmation = true;
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('phone name email').lean();

    sendSms({
      to:      customer.phone,
      message: appointmentConfirmedSms({
        userName:      customer.name,
        appointmentId: booking.bookingCode,
        doctorName:    booking.doctorSnapshot?.name || 'Your Doctor',
        scheduledAt:   new Date(booking.scheduledAt).toLocaleString('en-IN'),
        mode:          booking.consultationType || 'inPerson',
      }),
    }).catch(e => console.error('[Hospital confirm] SMS:', e.message));

    // Send OP card
    createOrSendOpOnConfirmation({ booking: booking.toObject(), triggeredBy: 'hospital' }).catch(() => {});

    // Email: customer — appointment confirmed
    sendEmail({
      email:   customer?.email,
      subject: `Appointment Confirmed — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'APPOINTMENT CONFIRMED',
        title:      'Your appointment has been confirmed',
        body:       `<b>Booking:</b> #${booking.bookingCode}<br/>
                     <b>Doctor:</b> ${booking.doctorSnapshot?.name || 'Your Doctor'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
                     <b>Mode:</b> ${booking.consultationType || 'In-Person'}<br/>
                     Your OP card has been sent in a separate email.`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'View Appointment',
      }),
    }).catch(e => console.error('[hospital/confirm] customer email:', e.message));

    // Email: doctor
    if (booking.doctor) {
      const doctorProfile = await DoctorProfile.findById(booking.doctor)
        .populate('user', 'name email').lean();
      if (doctorProfile?.user?.email) {
        emailDoctorBookingUpdate({
          doctorUser: doctorProfile.user,
          booking,
          subject:    `Appointment Confirmed — Patient: ${booking.patientInfo?.name} | Likeson`,
          body:       `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                       <b>Booking:</b> #${booking.bookingCode}<br/>
                       <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
                       <b>Mode:</b> ${booking.consultationType || 'In-Person'}`,
        }).catch(() => {});
      }
    }

    return res.json({ success: true, message: 'Appointment confirmed and OP sent to patient' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hospital/:hospitalId/ops',
  protect, authorize('hospital', 'admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { hospitalId } = req.params;

      if (!['admin', 'superadmin'].includes(req.user.role)) {
        const hospital = await Hospital.findOne({ _id: hospitalId, managedBy: req.user._id }).lean();
        if (!hospital)
          return res.status(403).json({ success: false, message: 'Access denied: not your hospital' });
      }

      const { status, doctorId, date, page = 1, limit = 20 } = req.query;
      const filter = { hospital: hospitalId };
      if (status)   filter.status  = status;
      if (doctorId) filter.doctor  = doctorId;
      if (date) {
        const d = new Date(date), nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.scheduledAt = { $gte: d, $lt: nextDay };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter)
          .populate('doctor',   'user specialization registrationNumber')
          .populate('patient',  'name phone email')
          .populate('booking',  'bookingCode bookingType fareBreakdown paymentStatus')
          .sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        OutPatientRecord.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: { ops, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/hospital/:hospitalId/valid-ops',
  protect, authorize('hospital', 'doctor', 'admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/valid-ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { hospitalId } = req.params;

      if (!hospitalId || hospitalId === 'undefined' || hospitalId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'A valid 24-character hexadecimal Hospital ID path parameter is required.',
        });
      }

      const { doctorId, patientId, page = 1, limit = 20 } = req.query;
      const filter = {
        hospital:       hospitalId,
        isFollowUp:     false,
        followUpExpiry: { $gt: new Date() },
        status:         { $in: ['scheduled', 'completed'] },
      };
      if (doctorId)  filter.doctor  = doctorId;
      if (patientId) filter.patient = patientId;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter)
          .populate('doctor',  'user specialization')
          .populate('patient', 'name phone')
          .populate('booking', 'bookingCode bookingType fareBreakdown paymentStatus')
          .sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        OutPatientRecord.countDocuments(filter),
      ]);

      const now      = new Date();
      const enriched = ops.map(op => ({
        ...op,
        daysRemaining: Math.ceil((new Date(op.followUpExpiry) - now) / (1000 * 60 * 60 * 24)),
      }));

      return res.json({
        success: true,
        data: { ops: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// DOCTOR ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/doctor/ops',
  protect, authorize('doctor'),
  cache(CACHE_TTL.ops, req => `GET:/doctor/ops:${req.user._id}:${req.originalUrl}`),
  async (req, res) => {
    try {
      const doctorProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!doctorProfile)
        return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      const { status, hospitalId, patientId, date, page = 1, limit = 20 } = req.query;
      const filter = { doctor: doctorProfile._id };
      if (status)     filter.status   = status;
      if (hospitalId) filter.hospital = hospitalId;
      if (patientId)  filter.patient  = patientId;
      if (date) {
        const d = new Date(date), nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.scheduledAt = { $gte: d, $lt: nextDay };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter)
          .populate('patient',  'name phone email')
          .populate('hospital', 'name address contact')
          .populate('booking',  'bookingCode bookingType fareBreakdown patientInfo consultationSessionId')
          .populate('parentOp', 'opNumber consultationType scheduledAt status')
          .sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        OutPatientRecord.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: { ops, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/doctor/ops/:opNumber',
  protect, authorize('doctor'),
  cache(CACHE_TTL.opRecord, req => `GET:/doctor/ops/${req.params.opNumber}`),
  async (req, res) => {
    try {
      const doctorProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!doctorProfile)
        return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      const op = await OutPatientRecord.findOne({
        opNumber: req.params.opNumber,
        doctor:   doctorProfile._id,
      })
        .populate('patient',  'name phone email avatar')
        .populate('hospital', 'name address contact consultationPricing')
        .populate('booking',  'bookingCode bookingType fareBreakdown patientInfo status documents consultationSessionId')
        .populate('parentOp', 'opNumber consultationType scheduledAt status')
        .lean();
      if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

      const followUps          = await OutPatientRecord.find({ parentOp: op._id })
        .sort({ scheduledAt: -1 }).populate('patient', 'name phone').lean();
      const isFollowUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
      const daysRemaining      = isFollowUpEligible
        ? Math.ceil((new Date(op.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;

      return res.json({ success: true, data: { op, followUps, isFollowUpEligible, daysRemaining } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /:id/op/complete
 * Doctor marks OP as completed. Sends OP zip to patient. Notifies hospital.
 * Also ends the linked Consultation if still active.
 */
router.patch('/:id/op/complete', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!doctorProfile)
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const { doctorNotes, prescriptionUrl, diagnosisCode, reasonForVisit } = req.body;
    const op = await OutPatientRecord.findOne({ booking: req.params.id, doctor: doctorProfile._id });
    if (!op)                       return res.status(404).json({ success: false, message: 'OP record not found for this booking' });
    if (op.status === 'completed') return res.status(400).json({ success: false, message: 'OP already completed' });

    op.status      = 'completed';
    op.completedAt = new Date();
    if (doctorNotes)     op.doctorNotes     = doctorNotes;
    if (prescriptionUrl) op.prescriptionUrl = prescriptionUrl;
    if (diagnosisCode)   op.diagnosisCode   = diagnosisCode;
    if (reasonForVisit)  op.reasonForVisit  = reasonForVisit;
    op.updatedBy = req.user._id;
    await op.save();

    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // End linked consultation if active
    if (booking.consultationSessionId) {
      const activeConsultation = await Consultation.findOne({
        _id:    booking.consultationSessionId,
        status: { $in: ['active', 'paused', 'waiting'] },
      });
      if (activeConsultation) {
        activeConsultation.status               = 'completed';
        activeConsultation.actualEndTime        = new Date();
        activeConsultation.roomEnded            = true;
        activeConsultation.prescriptionUploaded = !!prescriptionUrl;
        activeConsultation.endedBy              = 'doctor';
        activeConsultation.endedByUserId        = req.user._id;
        activeConsultation.updatedBy            = req.user._id;
        if (activeConsultation.actualStartTime) {
          const diffMs = activeConsultation.actualEndTime - activeConsultation.actualStartTime;
          activeConsultation.actualDurationMinutes = Math.round(diffMs / 60000);
        }
        await activeConsultation.save();
      }
    }

    const customer  = await User.findById(booking.customer).select('email phone name').lean();
    const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Consultation Complete',
      body:      `Your consultation OP ${op.opNumber} has been completed.`,
      type:      'Ride_Update',
      bookingId: booking._id,
    });

    // Send OP zip to patient
    sendOpZipEmail({ op: op.toObject ? op.toObject() : op, booking, patient: customer, followUps });

    // Notify hospital
    if (op.hospital) {
      const hospital = await Hospital.findById(op.hospital)
        .populate('managedBy', 'name email').lean();
      if (hospital?.managedBy?.email) {
        emailHospitalBookingUpdate({
          hospitalUser: hospital.managedBy,
          booking,
          subject: `Consultation Completed — OP ${op.opNumber} | Likeson Healthcare`,
          body:    `Dr. ${booking.doctorSnapshot?.name || 'Doctor'} has completed consultation for:<br/>
                    <b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                    <b>OP Number:</b> ${op.opNumber}<br/>
                    <b>Completed:</b> ${new Date().toLocaleString('en-IN')}`,
        }).catch(() => {});
      }
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'OP completed and sent to patient', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// OP CARD PUBLIC ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/op/:opNumber',
  protect,
  cache(CACHE_TTL.opRecord, req => `GET:/op/${req.params.opNumber}:${req.user._id}`),
  async (req, res) => {
    try {
      const filter = { opNumber: req.params.opNumber };
      if (req.user.role === 'customer') {
        filter.patient = req.user._id;
      } else if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
        filter.doctor = dp._id;
      }

      const op = await OutPatientRecord.findOne(filter)
        .populate('doctor',   'user specialization registrationNumber profilePhotoUrl')
        .populate('hospital', 'name address contact operatingHours is24x7')
        .populate('patient',  'name phone email')
        .populate('booking',  'bookingCode bookingType fareBreakdown status patientInfo consultationType documents consultationSessionId')
        .populate('parentOp', 'opNumber scheduledAt consultationType status')
        .lean();
      if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

      const followUps          = await OutPatientRecord.find({ parentOp: op._id })
        .sort({ scheduledAt: -1 }).populate('doctor', 'user specialization').lean();
      const isFollowUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
      const daysRemaining      = isFollowUpEligible
        ? Math.ceil((new Date(op.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;

      return res.json({ success: true, data: { op, followUps, isFollowUpEligible, daysRemaining } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/op/:opNumber/follow-ups', protect, async (req, res) => {
  try {
    const baseFilter = { opNumber: req.params.opNumber };
    if (req.user.role === 'customer') baseFilter.patient = req.user._id;

    const parentOp = await OutPatientRecord.findOne(baseFilter).select('_id').lean();
    if (!parentOp) return res.status(404).json({ success: false, message: 'OP not found' });

    const followUps = await OutPatientRecord.find({ parentOp: parentOp._id })
      .sort({ scheduledAt: -1 })
      .populate('doctor',   'user specialization')
      .populate('hospital', 'name address')
      .populate('booking',  'bookingCode status')
      .lean();

    return res.json({ success: true, data: { followUps, total: followUps.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/op/:opNumber/download', protect, async (req, res) => {
  try {
    const filter = { opNumber: req.params.opNumber };
    if (req.user.role === 'customer') filter.patient = req.user._id;

    const op = await OutPatientRecord.findOne(filter).lean();
    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    const booking   = await Booking.findById(op.booking).lean();
    const patient   = await User.findById(op.patient).select('name email phone').lean();
    const doctor    = op.doctor   ? await DoctorProfile.findById(op.doctor).populate('user', 'name').lean()   : null;
    const hospital  = op.hospital ? await Hospital.findById(op.hospital).lean() : null;
    const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();

    const htmlContent = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zipBuffer   = await buildOpZipBuffer(htmlContent, op.opNumber);

    const safeFilename = `${(op.opNumber || 'OP').replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.send(zipBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/admin/bookings',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.adminBookings, req => `GET:/admin/bookings:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { status, bookingType, city, date, page = 1, limit = 20, search, from, to } = req.query;
      const filter = {};
      if (status)      filter.status                  = status;
      if (bookingType) filter.bookingType              = bookingType;
      if (city)        filter['patientLocation.city']  = { $regex: city, $options: 'i' };
      if (from || to) {
        filter.scheduledAt = {};
        if (from) filter.scheduledAt.$gte = new Date(from);
        if (to)   filter.scheduledAt.$lte = new Date(to);
      }
      if (date) {
        const d = new Date(date), nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.scheduledAt = { $gte: d, $lt: nextDay };
      }
      if (search) {
        filter.$or = [
          { bookingCode:        { $regex: search, $options: 'i' } },
          { 'patientInfo.name': { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [bookings, total] = await Promise.all([
        Booking.find(filter)
          .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
          .populate('customer', 'name phone email').lean(),
        Booking.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: { bookings, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/stats',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.adminStats, req => `GET:/admin/bookings/stats:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { from, to } = req.query;
      const dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to)   dateFilter.$lte = new Date(to);
      const matchStage = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

      const [statusStats, typeStats, revenueAgg] = await Promise.all([
        Booking.aggregate([{ $match: matchStage }, { $group: { _id: '$status',      count: { $sum: 1 } } }]),
        Booking.aggregate([{ $match: matchStage }, { $group: { _id: '$bookingType', count: { $sum: 1 } } }]),
        Booking.aggregate([
          { $match: { ...matchStage, status: 'completed' } },
          { $group: { _id: null, totalRevenue: { $sum: '$fareBreakdown.totalAmount' }, count: { $sum: 1 } } },
        ]),
      ]);

      return res.json({
        success: true,
        data: {
          byStatus:      Object.fromEntries(statusStats.map(s => [s._id, s.count])),
          byBookingType: Object.fromEntries(typeStats.map(s => [s._id, s.count])),
          revenue:       revenueAgg[0] || { totalRevenue: 0, count: 0 },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/export', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { from, to, status, bookingType } = req.query;
    const filter = {};
    if (status)      filter.status      = status;
    if (bookingType) filter.bookingType  = bookingType;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }

    const bookings = await Booking.find(filter)
      .select('bookingCode bookingType status scheduledAt patientInfo fareBreakdown paymentStatus createdAt consultationSessionId')
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 }).limit(5000).lean();

    const csvHeader = 'BookingCode,Type,Status,Scheduled,Patient,Customer,Phone,Total(INR),AmountPaid(INR),PaymentStatus,HasConsultation,CreatedAt\n';
    const csvRows   = bookings.map(b =>
      [
        b.bookingCode, b.bookingType, b.status,
        new Date(b.scheduledAt).toLocaleString('en-IN'),
        b.patientInfo?.name, b.customer?.name, b.customer?.phone,
        b.fareBreakdown?.totalAmount, b.fareBreakdown?.amountPaid,
        b.paymentStatus,
        b.consultationSessionId ? 'Yes' : 'No',   // extra useful column
        new Date(b.createdAt).toLocaleString('en-IN'),
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')  // proper CSV quoting
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings-${Date.now()}.csv`);
    return res.send(csvHeader + csvRows.join('\n'));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/bookings/:id',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.adminBookings, req => `GET:/admin/bookings/${req.params.id}`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .populate('customer',      'name phone email')
        .populate('doctor',        'user specialization profilePhotoUrl registrationNumber')
        .populate('hospital',      'name address contact consultationPricing')
        .populate('careAssistant', 'fullName phone photoUrl')
        .populate('primaryRide',   'status liveLocation driverSnapshot vehicleSnapshot scheduledPickupAt pickup dropoff estimatedDistanceKm estimatedDurationMin trackingId')
        .populate('rides',         'status rideType driverSnapshot vehicleSnapshot estimatedDistanceKm')
        .populate('diagnosticDetails.labPartner', 'labName contact')
        .lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      let mapRoute = null;
      if (booking.primaryRide?.trackingId) {
        const trackingDoc = await RideTracking.findById(booking.primaryRide.trackingId)
          .select('expectedRoutePolyline currentEtaMinutes totalDistanceKm hasActiveSos').lean();
        if (trackingDoc) {
          mapRoute = {
            polyline:          trackingDoc.expectedRoutePolyline,
            currentEtaMinutes: trackingDoc.currentEtaMinutes,
            totalDistanceKm:   trackingDoc.totalDistanceKm,
            hasActiveSos:      trackingDoc.hasActiveSos,
            pickupCoords:      booking.primaryRide.pickup?.coordinates,
            pickupAddress:     booking.primaryRide.pickup?.address,
            dropoffCoords:     booking.primaryRide.dropoff?.coordinates,
            dropoffAddress:    booking.primaryRide.dropoff?.address,
          };
        }
      }

      const opRecord = booking.doctor
        ? await OutPatientRecord.findOne({ booking: booking._id })
            .populate('doctor', 'user specialization').populate('hospital', 'name address').lean()
        : null;
      const followUps = opRecord
        ? await OutPatientRecord.find({ parentOp: opRecord._id }).sort({ scheduledAt: -1 }).lean()
        : [];

      // Fetch consultation session if linked
      let consultation = null;
      if (booking.consultationSessionId) {
        consultation = await Consultation.findById(booking.consultationSessionId)
          .select('-hostToken -participantToken -webhookSecret -doctorInternalNotes -internalAdminNotes')
          .lean();
      }

      return res.json({ success: true, data: { booking, opRecord, followUps, mapRoute, consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /admin/bookings/:id/status
 * Admin changes booking status. Sends OP on 'confirmed'. Notifies all parties.
 */
router.patch('/admin/bookings/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, note } = req.body;

    const BOOKING_STATUSES = [
      'draft', 'pending', 'confirmed', 'in_progress', 'completed',
      'cancelled', 'no_show', 'refund_pending', 'refunded',
    ];
    if (!BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid: ${BOOKING_STATUSES.join(', ')}`,
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const prevStatus  = booking.status;
    booking.status    = status;
    booking.statusLog.push({
      fromStatus: prevStatus, toStatus: status,
      changedBy: req.user._id, reason: note || 'Admin status update',
    });
    booking.updatedBy = req.user._id;
    await booking.save();

    if (status === 'cancelled') {
  await recoverSubscriptionUsageOnCancel(booking).catch(e =>
    console.error('[admin/status] recovery failed:', e.message)
  );
}

    // ── AUTO-CREATE CONSULTATION on confirm for online booking types ──────────
    if (
      status === 'confirmed' &&
      ['doctor_online'].includes(booking.bookingType) &&
      booking.doctor &&
      !booking.consultationSessionId
    ) {
    try {
        const { createAgoraRoom, generateAgoraToken } = await import('../services/agoraService.js');

        const scheduledStartTime              = booking.scheduledAt;
        const { roomId, meetingId,  } = createAgoraRoom(
          booking.bookingCode,
          booking._id.toString()
        );

        const hostToken        = generateAgoraToken(roomId, 'host',        0);
        const participantToken = generateAgoraToken(roomId, 'participant', 0);

        const consultation = new Consultation({
          bookingId:                booking._id,
          patient:                  booking.customer,
          doctor:                   booking.doctor,
          hospital:                 booking.hospital || null,
          consultationType:         booking.consultationType || 'video',
          consultationMode:         'scheduled',
          language:                 'English',
          priority:                 'routine',
          scheduledStartTime,
          estimatedDurationMinutes: 30,
          waitingRoomEnabled:       true,
          recordingSupported:       false,
          provider:                 'Agora',
          roomId,
          meetingId,
          hostToken,
          participantToken,
          status:    'scheduled',
          createdBy: req.user._id,
        });

        await consultation.save();

        await Booking.findByIdAndUpdate(booking._id, {
          $set: { consultationSessionId: consultation._id },
        });

        booking.consultationSessionId = consultation._id;
      } catch (consultErr) {
        console.error('[admin/status] Agora room creation failed:', consultErr.message);
        
      }
    }

    const customer = await User.findById(booking.customer).select('email phone name').lean();

    // Send OP when admin confirms booking with a doctor
    if (status === 'confirmed' && booking.doctor) {
      createOrSendOpOnConfirmation({ booking: booking.toObject(), triggeredBy: 'admin' }).catch(() => {});
    }

    emailCustomerStatusUpdate({ booking, newStatus: status, customer }).catch(() => {});

    if (booking.doctor && ['confirmed', 'cancelled', 'completed'].includes(status)) {
      const doctorProfile = await DoctorProfile.findById(booking.doctor)
        .populate('user', 'name email').lean();
      if (doctorProfile?.user?.email) {
        emailDoctorBookingUpdate({
          doctorUser: doctorProfile.user,
          booking,
          subject: `Booking #${booking.bookingCode} — Status: ${status} | Likeson Healthcare`,
          body:    `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                    <b>Status:</b> ${status}<br/>
                    <b>Note:</b> ${note || 'Admin update'}<br/>
                    <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        }).catch(() => {});
      }
    }

    if (booking.hospital && ['confirmed', 'cancelled', 'completed'].includes(status)) {
      const hospital = await Hospital.findById(booking.hospital)
        .populate('managedBy', 'name email').lean();
      if (hospital?.managedBy?.email) {
        emailHospitalBookingUpdate({
          hospitalUser: hospital.managedBy,
          booking,
          subject: `Booking #${booking.bookingCode} — Status: ${status} | Likeson Healthcare`,
          body:    `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                    <b>Status changed to:</b> ${status}<br/>
                    <b>Note:</b> ${note || 'Admin update'}`,
        }).catch(() => {});
      }
    }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status, timestamp: new Date(),
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Status updated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin nearby lookup routes ─────────────────────────────────────────────

router.get('/admin/bookings/:id/nearby/care-assistants',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/care-assistants`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation scheduledAt').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      const careAssistants = await CareAssistantProfile.find({
        isActive:                  true,
        isBlocked:                 false,
        status:                    'Available',
        'kyc.verificationStatus':  'Verified',
        'verification.isVerified': true,
        location: { $geoWithin: { $centerSphere: [[lng, lat], careRideRadiusRad] } },
      })
        .select('fullName phone specializations performance maxServiceRadiusKm availability location workType user')
        .limit(20).lean();

      const results = careAssistants
        .map(ca => {
          const distKm = haversineKm(coords, ca.location?.coordinates || [0, 0]);
          if (distKm > (ca.maxServiceRadiusKm || 10)) return null;
          return {
            careAssistantId: ca._id, userId: ca.user, name: ca.fullName, phone: ca.phone,
            specializations: ca.specializations, rating: ca.performance?.averageRating,
            distanceKm: +distKm.toFixed(1), maxServiceRadiusKm: ca.maxServiceRadiusKm,
            workType: ca.workType, currentCity: ca.availability?.currentCity, isDispatchable: true,
          };
        })
        .filter(Boolean);

      return res.json({ success: true, data: { results, total: results.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/:id/nearby/solo-drivers',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/solo-drivers`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords  = booking.patientLocation?.coordinates;
      const city    = booking.patientLocation?.city?.trim();
      const pincode = booking.patientLocation?.pincode?.trim();
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      const zoneOrClauses = [];
      if (city)    zoneOrClauses.push({ 'serviceZones.city':     { $regex: `^${city}$`, $options: 'i' } });
      if (pincode) zoneOrClauses.push({ 'serviceZones.pinCodes': pincode });
      if (!zoneOrClauses.length)
        return res.status(400).json({ success: false, message: 'No city or pincode for zone matching' });

      const soloPartners = await SoloDriverPartner.find({
        partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true,
        driverProfile: { $ne: null }, $or: zoneOrClauses,
      })
        .select('legalName phone vehicle serviceZones rating driverProfile isOnboardingComplete partnershipStatus platformFeeOverride')
        .limit(30).lean();

      const results = await Promise.all(soloPartners.map(async sp => {
        const matchedZone = sp.serviceZones?.find(z =>
          (city && z.city?.match(new RegExp(`^${city}$`, 'i'))) ||
          (pincode && z.pinCodes?.includes(pincode))
        );
        const radiusKm  = matchedZone?.radiusKm ?? 15;
        const radiusRad = radiusKm / 6378.1;

        const driver = await Driver.findOne({
          _id: sp.driverProfile, isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], radiusRad] } },
        }).select('driverCode location performance legalName').lean();

        if (!driver) return null;
        const vehicle          = sp.vehicle ?? null;
        const hasActiveVehicle = vehicle?.verificationStatus === 'verified' && vehicle?.isActive === true;
        if (!hasActiveVehicle) return null;

        return {
          driverId: driver._id, soloPartnerId: sp._id, name: sp.legalName,
          driverCode: driver.driverCode, phone: sp.phone,
          vehicle: vehicle ? {
            vehicleCode: vehicle.vehicleCode, registrationNumber: vehicle.registrationNumber,
            make: vehicle.make, model: vehicle.model, color: vehicle.color,
            vehicleType: vehicle.vehicleType, seatingCapacity: vehicle.seatingCapacity,
            isWheelchairAccessible: vehicle.isWheelchairAccessible,
            hasStretcherSupport: vehicle.hasStretcherSupport,
            hasOxygenSupport: vehicle.hasOxygenSupport, hasAC: vehicle.hasAC,
          } : null,
          rating: sp.rating?.averageRating ?? 0, totalRides: sp.rating?.totalRides ?? 0,
          distanceKm: +haversineKm(coords, driver.location?.coordinates || [0, 0]).toFixed(1),
          matchedZone: matchedZone ? { city: matchedZone.city, state: matchedZone.state, radiusKm } : null,
          serviceZones: sp.serviceZones?.filter(z => z.isActive).map(z => ({ city: z.city, state: z.state, radiusKm: z.radiusKm })),
          isDispatchReady: true,
        };
      }));

      const ready = results.filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);
      return res.json({
        success: true,
        data: { pickupCity: city ?? null, pickupPincode: pincode ?? null, total: ready.length, results: ready },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/:id/nearby/transport-partners',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/transport-partners`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords  = booking.patientLocation?.coordinates;
      const city    = booking.patientLocation?.city?.trim();
      const pincode = booking.patientLocation?.pincode?.trim();
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      const zoneOrClauses = [];
      if (city)    zoneOrClauses.push({ 'serviceZones.city':     { $regex: `^${city}$`, $options: 'i' } });
      if (pincode) zoneOrClauses.push({ 'serviceZones.pinCodes': pincode });
      if (!zoneOrClauses.length)
        return res.status(400).json({ success: false, message: 'No city or pincode for zone matching' });

      const tps = await TransportPartner.find({
        partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, $or: zoneOrClauses,
      })
        .select('businessName ownerName ownerPhone fleetInfo rating serviceZones isOnboardingComplete vehicles')
        .limit(30).lean();

      const results = await Promise.all(tps.map(async tp => {
        const matchedZone = tp.serviceZones?.find(z =>
          (city && z.city?.match(new RegExp(`^${city}$`, 'i'))) || (pincode && z.pinCodes?.includes(pincode))
        );
        const radiusKm  = matchedZone?.radiusKm ?? 15;
        const radiusRad = radiusKm / 6378.1;

        const availDriverCount = await Driver.countDocuments({
          ownerAgency: tp._id, isActive: true, isVerified: true, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], radiusRad] } },
        });

        const activeVehicles  = (tp.vehicles ?? []).filter(v => v.isActive && v.verificationStatus === 'verified').length;
        const isDispatchReady = tp.isOnboardingComplete && availDriverCount > 0 && activeVehicles > 0;

        return {
          tpId: tp._id, businessName: tp.businessName, ownerName: tp.ownerName, ownerPhone: tp.ownerPhone,
          totalVehicles: tp.fleetInfo?.totalVehicles ?? 0, activeVehicles,
          totalDrivers: tp.fleetInfo?.totalDrivers ?? 0, availableDriversNearby: availDriverCount,
          averageRating: tp.rating?.averageRating ?? 0,
          serviceZones: tp.serviceZones?.filter(z => z.isActive).map(z => ({ city: z.city, state: z.state, radiusKm: z.radiusKm })),
          matchedZone: matchedZone ? { city: matchedZone.city, state: matchedZone.state, radiusKm } : null,
          isDispatchReady,
        };
      }));

      const ready    = results.filter(r => r.isDispatchReady);
      const notReady = results.filter(r => !r.isDispatchReady);
      return res.json({
        success: true,
        data: {
          pickupCity: city ?? null, pickupPincode: pincode ?? null,
          total: results.length, dispatchReady: ready.length,
          results: [...ready, ...notReady],
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/:id/nearby/hospitals',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/hospitals`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      const hospitals = await Hospital.find({
        isActive:   true,
        isVerified: true,
        location: {
          $near: {
            $geometry:    { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: RADIUS_METERS,
          },
        },
      })
        .select('name hospitalType managementModel address contact specialties is24x7 rating operatingHours isEmergencyReady location linkedDoctors')
        .limit(20).lean();

      const results = hospitals.map(h => ({
        hospitalId: h._id, name: h.name, hospitalType: h.hospitalType,
        managementModel: h.managementModel,
        address: `${h.address?.line1 || ''}, ${h.address?.city || ''}`,
        phone: h.contact?.phone, specialties: h.specialties,
        is24x7: h.is24x7, isEmergencyReady: h.isEmergencyReady,
        linkedDoctors: h.linkedDoctors?.length || 0,
        distanceKm: +haversineKm(coords, h.location?.coordinates || [0, 0]).toFixed(1),
        averageRating: h.rating?.averageRating, isOperational: true,
      }));

      return res.json({ success: true, data: { results, total: results.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── Admin assignment routes ────────────────────────────────────────────────

/**
 * POST /admin/bookings/:id/assign/solo-driver
 */
router.post('/admin/bookings/:id/assign/solo-driver', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { soloDriverPartnerId } = req.body;
    if (!soloDriverPartnerId)
      return res.status(400).json({ success: false, message: 'soloDriverPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['pending', 'confirmed'].includes(booking.status))
      return res.status(400).json({ success: false, message: `Cannot assign in status: ${booking.status}` });

    const soloPartner = await SoloDriverPartner.findById(soloDriverPartnerId)
      .populate('user', 'name phone email').lean();
    if (!soloPartner) return res.status(404).json({ success: false, message: 'SoloDriverPartner not found' });
    if (soloPartner.partnershipStatus !== 'active')
      return res.status(400).json({ success: false, message: 'Solo partner not active' });
    if (!soloPartner.driverProfile)
      return res.status(400).json({ success: false, message: 'Solo partner has no linked Driver profile' });

   await Ride.updateMany(
      { booking: booking._id, status: { $in: ['requested', 'searching'] } },
      { 
        $set: { 
          status: 'cancelled',
          cancellation: {
            cancelledBy: 'admin',
            cancelledAt: new Date(),
            reason: 'Admin reassignment' // Add a reason if necessary
          }
        } 
      }
    );

    const coords = getBookingCoords(booking);
    const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
      coords.pickupCoords, coords.dropoffCoords,
    );

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy:         req.user._id,
      }),
      driver:               soloPartner.driverProfile,
      soloPartner:          soloPartner._id,
      status:               'driver_assigned',
      estimatedDistanceKm:  distanceKm,
      estimatedDurationMin: durationMin,
      pickupOtp:            hashOtp(genOtp()),
    });

    const tracking = await RideTracking.create({
      ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
    });
    await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
    await Booking.findByIdAndUpdate(booking._id, {
      $push: { rides: ride._id },
      $set:  { primaryRide: ride._id, status: 'confirmed', updatedBy: req.user._id },
    });

    await createNotification({
      recipient: soloPartner.user._id,
      title:     'New Booking Assigned',
      body:      `Admin assigned booking #${booking.bookingCode} to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

    emailDriverAssigned({ driverUser: soloPartner.user, booking }).catch(() => {});

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    sendEmail({
      email:   customer?.email,
      subject: `Driver Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'DRIVER ASSIGNED',
        title:      `Your driver has been assigned for Booking #${booking.bookingCode}`,
        body:       `<b>Driver:</b> ${soloPartner.user?.name || 'N/A'}<br/>
                     <b>Phone:</b> ${soloPartner.user?.phone || 'N/A'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
                     <b>Est. Distance:</b> ${distanceKm} km`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'Track Booking',
      }),
    }).catch(e => console.error('[admin assign solo] customer email:', e.message));

    sendSms({
      to:      soloPartner.user.phone,
      message: `Hi ${soloPartner.user.name}, booking #${booking.bookingCode} assigned by admin. Check Likeson app.`,
    }).catch(e => console.error('[Admin assign solo] SMS:', e.message));

    joinBookingRoom(soloPartner.user._id, booking._id);

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId:  booking._id,
      status:     'confirmed',
      timestamp:  new Date(),
      driverInfo: { name: soloPartner.user.name, phone: soloPartner.user.phone },
      mapRoute: {
        polyline,
        pickupCoords:     coords.pickupCoords,
        pickupAddress:    coords.pickupAddress,
        dropoffCoords:    coords.dropoffCoords,
        dropoffAddress:   coords.dropoffAddress,
        estimatedDistKm:  distanceKm,
        estimatedMinutes: durationMin,
        currentTarget:    'pickup',
      },
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message: `Admin assigned solo driver to #${booking.bookingCode}`,
      actor: { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { soloDriverPartnerId },
    });
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Solo driver assigned', data: { booking, ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /admin/bookings/:id/assign/transport-partner
 */
router.post('/admin/bookings/:id/assign/transport-partner', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { transportPartnerId } = req.body;
    if (!transportPartnerId)
      return res.status(400).json({ success: false, message: 'transportPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const tp = await TransportPartner.findById(transportPartnerId)
      .populate('user', 'name email phone').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'TransportPartner not found' });
    if (tp.partnershipStatus !== 'active')
      return res.status(400).json({ success: false, message: 'TP not active' });

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { transportPartner: transportPartnerId, status: 'confirmed', updatedBy: req.user._id },
    });

    await createNotification({
      recipient: tp.user._id,
      title:     'New Booking Assigned to Fleet',
      body:      `Booking #${booking.bookingCode} assigned. Please assign a driver.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

    sendEmail({
      email:   tp.user.email,
      subject: `New Booking #${booking.bookingCode} — Assign Driver | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'BOOKING ASSIGNED TO YOUR FLEET',
        title:      `Booking #${booking.bookingCode} needs a driver`,
        body:       `<b>Type:</b> ${booking.bookingType}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
                     <b>Patient:</b> ${booking.patientInfo?.name}`,
        buttonLink: `${process.env.FRONTEND_URL}/tp/bookings/${booking._id}`,
        buttonText: 'Assign Driver Now',
      }),
    }).catch(e => console.error('[Admin assign TP] Email:', e.message));

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    sendEmail({
      email:   customer?.email,
      subject: `Transport Arranged — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'TRANSPORT UPDATE',
        title:      `Transport has been arranged for Booking #${booking.bookingCode}`,
        body:       `Your transport partner <b>${tp.businessName || tp.ownerName}</b> has been assigned.<br/>
                     A driver will be assigned shortly.`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    }).catch(e => console.error('[Admin assign TP] customer email:', e.message));

    sendSms({
      to:      tp.user.phone,
      message: `Hi ${tp.user.name}, booking #${booking.bookingCode} assigned. Assign driver in Likeson dashboard.`,
    }).catch(e => console.error('[Admin assign TP] SMS:', e.message));

    joinTpRoom(tp.user._id, tp._id);
    joinBookingRoom(tp.user._id, booking._id);

    getBookingSocketService()?.emitToRoom(`tp:${tp._id}`, 'booking_assigned', {
      bookingId:   booking._id,
      bookingCode: booking.bookingCode,
      bookingType: booking.bookingType,
      scheduledAt: booking.scheduledAt,
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message: `Admin assigned TP to #${booking.bookingCode}`,
      actor: { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { transportPartnerId },
    });
    await invalidateBookingCache();
    return res.json({
      success: true,
      message: 'Transport partner assigned. Awaiting driver assignment.',
      data: { booking },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /admin/bookings/:id/assign/care-assistant
 */
router.post('/admin/bookings/:id/assign/care-assistant', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try { // ⬅️ ADDED: Missing opening try block
    const { careAssistantId } = req.body;
    if (!careAssistantId)
      return res.status(400).json({ success: false, message: 'careAssistantId required' });
 
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });
 
    const ca = await CareAssistantProfile.findById(careAssistantId)
      .populate('user', 'name phone email')
      .lean();
    if (!ca)
      return res.status(404).json({ success: false, message: 'Care assistant not found' });
    if (!ca.isActive || !ca.verification?.isVerified)
      return res.status(400).json({
        success: false,
        message: 'Care assistant not available or not verified',
      });
 
    // ── full_care_ride: compute CA join point on existing ride route ──────────
    let caJoinResult  = null;
    let caJoinWaypoint = null;
 
    if (booking.bookingType === 'full_care_ride' && booking.primaryRide) {
      const existingRide = await Ride.findById(booking.primaryRide)
        .select('pickup dropoff liveLocation trackingId waypoints status')
        .lean();
 
      const tracking = existingRide?.trackingId
        ? await RideTracking.findById(existingRide.trackingId)
            .select('expectedRoutePolyline')
            .lean()
        : null;
 
      const caCoords = ca.location?.coordinates;
      const driverCurrentCoords = existingRide?.liveLocation?.coordinates
        || existingRide?.pickup?.coordinates
        || [80.648, 16.506];
      const pickupCoords  = existingRide?.pickup?.coordinates;
      const dropoffCoords = existingRide?.dropoff?.coordinates;
 
      if (caCoords && pickupCoords && dropoffCoords) {
        caJoinResult = resolveCaJoinPoint({
          caCoords,
          driverCoords:    driverCurrentCoords,
          pickupCoords,
          dropoffCoords,
          encodedPolyline: tracking?.expectedRoutePolyline ?? null,
        });
 
        caJoinWaypoint = buildCaJoinWaypoint(caJoinResult);
 
        // Insert join waypoint into ride.waypoints (remove old CA join if exists)
        const filteredWaypoints = (existingRide.waypoints || [])
          .filter(w => w.type !== 'care_assistant_join');
 
        await Ride.findByIdAndUpdate(booking.primaryRide, {
          $set: {
            waypoints: [...filteredWaypoints, caJoinWaypoint],
          },
        });
 
        console.log(
          `[assignCA] ✅ CA join point set. Zone: ${caJoinResult.zone}, ` +
          `distCA→join: ${caJoinResult.distCaToJoinKm}km`
        );
      }
    }
 
    // ── Attach CA to RideTracking if ride already exists ─────────────────────
    if (booking.primaryRide) {
      RideTracking.attachCareAssistant(booking.primaryRide, careAssistantId)
        .then(() => {
          // Seed CA live location from their profile location
          if (ca.location?.coordinates) {
            RideTracking.updateCareAssistantLocation(booking.primaryRide, {
              coordinates: ca.location.coordinates,
              source:      'gps',
            }).catch(e => console.error('[assignCA] seed CA location:', e.message));
          }
        })
        .catch(e => console.error('[assignCA] tracking attach:', e.message));
 
      // Notify booking room: CA attached + join point info
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_attached_to_ride', {
        bookingId:         booking._id,
        rideId:            booking.primaryRide,
        careAssistantId,
        careAssistantName: ca.fullName,
        timestamp:         new Date(),
        // Send join point so customer/driver map can render it
        caJoinPoint: caJoinResult
          ? {
              coordinates:    caJoinResult.joinPoint,
              zone:           caJoinResult.zone,
              distCaToJoinKm: caJoinResult.distCaToJoinKm,
              caRoute: {
                from:   caJoinResult.caRoute.from,
                to:     caJoinResult.caRoute.to,
                distKm: caJoinResult.caRoute.distKm,
                note:   'CA travels independently to join point',
              },
            }
          : null,
      });
    }
 
    // ── Update booking ────────────────────────────────────────────────────────
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { careAssistant: careAssistantId, updatedBy: req.user._id },
    });
 
    // ── Notify CA ─────────────────────────────────────────────────────────────
    await createNotification({
      recipient: ca.user._id,
      title:     'New Care Request',
      body:      `Assigned to booking #${booking.bookingCode}`,
      type:      'Care_Assistant_Assigned',
      bookingId: booking._id,
      priority:  'High',
    });
 
    const customer = await User.findById(booking.customer)
      .select('phone name email')
      .lean();
 
    // ── SMS ───────────────────────────────────────────────────────────────────
    sendSms({
      to:      ca.user.phone,
      message: newCareRequestToAssistantSms({
        assistantName: ca.fullName,
        requestId:     booking.bookingCode,
        patientName:   booking.patientInfo?.name,
        location:      booking.patientLocation?.address || '',
        scheduledAt:   new Date(booking.scheduledAt).toLocaleString('en-IN'),
      }),
    }).catch(e => console.error('[assignCA] CA SMS:', e.message));
 
    sendSms({
      to:      customer?.phone,
      message: careAssistantAssignedSms({
        userName:       customer?.name,
        requestId:      booking.bookingCode,
        assistantName:  ca.fullName,
        assistantPhone: ca.user.phone,
      }),
    }).catch(e => console.error('[assignCA] customer SMS:', e.message));
 
    // ── Email: CA ─────────────────────────────────────────────────────────────
    sendEmail({
      email:   ca.user.email,
      subject: `Care Request Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header:     'CARE ASSIGNMENT',
        title:      `Booking #${booking.bookingCode} assigned to you`,
        body: booking.bookingType === 'full_care_ride' && caJoinResult
          ? `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
             <b>Location:</b> ${booking.patientLocation?.address || 'N/A'}<br/>
             <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/><br/>
             <b>Your Join Point:</b> ${caJoinResult.zone.replace(/_/g, ' ')} of driver route<br/>
             <b>Distance to join point:</b> ${caJoinResult.distCaToJoinKm} km from your location<br/>
             <b>Action:</b> Travel to the join point and wait for the driver to pick you up.`
          : `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
             <b>Location:</b> ${booking.patientLocation?.address || 'N/A'}<br/>
             <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/care/bookings`,
        buttonText: 'View Booking',
      }),
    }).catch(e => console.error('[assignCA] CA email:', e.message));
 
    // ── Email: customer ───────────────────────────────────────────────────────
    sendEmail({
      email:   customer?.email,
      subject: `Care Assistant Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header:     'CARE ASSISTANT ASSIGNED',
        title:      `Your care assistant for Booking #${booking.bookingCode}`,
        body:       `<b>Care Assistant:</b> ${ca.fullName}<br/>
                     <b>Phone:</b> ${ca.user.phone}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    }).catch(e => console.error('[assignCA] customer email:', e.message));
 
    // ── Join socket room ──────────────────────────────────────────────────────
    try {
      getBookingSocketService()?.emitJoinRoom(String(ca.user._id), `booking:${booking._id}`);
    } catch (e) { /* non-fatal */ }
 
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_assigned', {
      bookingId:         booking._id,
      careAssistantName: ca.fullName,
    });
 
    await SystemLog.createLog({
      level:    'success',
      category: 'api',
      message:  `Admin assigned care assistant to #${booking.bookingCode}`,
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: {
        careAssistantId,
        caJoinZone:      caJoinResult?.zone           ?? null,
        distCaToJoinKm:  caJoinResult?.distCaToJoinKm ?? null,
      },
    });
 
    return res.json({
      success: true,
      message: 'Care assistant assigned',
      data: {
        booking,
        caJoinPoint: caJoinResult
          ? {
              coordinates:    caJoinResult.joinPoint,
              zone:           caJoinResult.zone,
              distCaToJoinKm: caJoinResult.distCaToJoinKm,
              caRoute: {
                from:   caJoinResult.caRoute.from,
                to:     caJoinResult.caRoute.to,
                distKm: caJoinResult.caRoute.distKm,
                note:   'CA navigates to this point independently before boarding',
              },
            }
          : null,
      },
    });
  } catch (err) { // ⬅️ Matches the added try block
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /admin/bookings/:id/assign/hospital
 */
router.post('/admin/bookings/:id/assign/hospital', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { hospitalId } = req.body;
    if (!hospitalId) return res.status(400).json({ success: false, message: 'hospitalId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const hospital = await Hospital.findById(hospitalId)
      .populate('managedBy', 'name email phone')
      .select('name isActive isVerified managedBy').lean();
    if (!hospital?.isActive || !hospital?.isVerified)
      return res.status(400).json({ success: false, message: 'Hospital not operational' });

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { hospital: hospitalId, updatedBy: req.user._id },
    });

    if (hospital.managedBy?.email) {
      emailHospitalBookingUpdate({
        hospitalUser: hospital.managedBy,
        booking,
        subject: `New Booking Assigned — #${booking.bookingCode} | Likeson Healthcare`,
        body:    `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                  <b>Type:</b> ${booking.bookingType}<br/>
                  <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
                  Please confirm the appointment slot in your dashboard.`,
      }).catch(() => {});
    }

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    sendEmail({
      email:   customer?.email,
      subject: `Hospital Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'HOSPITAL ASSIGNED',
        title:      `${hospital.name} has been assigned for Booking #${booking.bookingCode}`,
        body:       `Your appointment will be at <b>${hospital.name}</b>.<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    }).catch(e => console.error('[Admin assign hospital] customer email:', e.message));

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Hospital linked', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /admin/bookings/:id/reassign/driver
 */
router.patch('/admin/bookings/:id/reassign/driver', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newDriverId, reason } = req.body;
    if (!newDriverId)
      return res.status(400).json({ success: false, message: 'newDriverId (Driver._id) required' });

    await Ride.updateMany(
      { booking: req.params.id, status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'admin', 'cancellation.cancelledAt': new Date() }
    );

    const booking   = await Booking.findById(req.params.id);
    if (!booking)   return res.status(404).json({ success: false, message: 'Booking not found' });
    const driverDoc = await Driver.findById(newDriverId).lean();
    if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver not found' });

    const coords = getBookingCoords(booking);
    const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
      coords.pickupCoords, coords.dropoffCoords,
    );

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy:         req.user._id,
      }),
      driver:           newDriverId,
      transportPartner: driverDoc.ownerAgency || undefined,
      soloPartner:      driverDoc.soloPartner  || undefined,
      status:               'driver_assigned',
      estimatedDistanceKm:  distanceKm,
      estimatedDurationMin: durationMin,
      pickupOtp:            hashOtp(genOtp()),
    });

    const tracking = await RideTracking.create({
      ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
    });
    await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
    await Booking.findByIdAndUpdate(booking._id, {
      $push: { rides: ride._id },
      $set:  { primaryRide: ride._id, updatedBy: req.user._id },
    });

    booking.statusLog.push({
      fromStatus: booking.status, toStatus: booking.status,
      changedBy: req.user._id,
      reason: `Driver reassigned by admin. Reason: ${reason || 'N/A'}`,
    });
    await booking.save();

    const driverUser = await User.findById(driverDoc.user).select('email phone name').lean();
    const customer   = await User.findById(booking.customer).select('email phone name').lean();

    await createNotification({
      recipient: driverDoc.user,
      title:     'Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned by admin.`,
      type:      'Ride_Request',
      bookingId: booking._id,
    });

    emailDriverAssigned({ driverUser, booking, verb: 'reassigned' }).catch(() => {});

    sendEmail({
      email:   customer?.email,
      subject: `Driver Updated — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'DRIVER UPDATED',
        title:      `Your driver has been updated for Booking #${booking.bookingCode}`,
        body:       `<b>New Driver:</b> ${driverUser?.name || 'N/A'}<br/>
                     <b>Phone:</b> ${driverUser?.phone || 'N/A'}<br/>
                     <b>Reason:</b> ${reason || 'Driver reassigned by operations team'}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'Track Booking',
      }),
    }).catch(e => console.error('[Admin reassign driver] customer email:', e.message));

    joinBookingRoom(driverDoc.user, booking._id);
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_assigned', {
      bookingId: booking._id,
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver reassigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /admin/bookings/:id/reassign/care
 */
router.patch('/admin/bookings/:id/reassign/care', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newCareAssistantId } = req.body;
    if (!newCareAssistantId)
      return res.status(400).json({ success: false, message: 'newCareAssistantId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { careAssistant: newCareAssistantId, updatedBy: req.user._id },
    });

    const ca = await CareAssistantProfile.findById(newCareAssistantId)
      .populate('user', 'phone name email').lean();

    const customer = await User.findById(booking.customer).select('email phone name').lean();

    if (ca) {
      await createNotification({
        recipient: ca.user._id,
        title:     'Care Booking Reassigned',
        body:      `Booking #${booking.bookingCode} reassigned to you by admin.`,
        type:      'Care_Assistant_Assigned',
        bookingId: booking._id,
      });

      emailCareAssistantAssigned({ caUser: ca.user, caName: ca.fullName, booking, verb: 'reassigned' }).catch(() => {});
      joinBookingRoom(ca.user._id, booking._id);
    }

    sendEmail({
      email:   customer?.email,
      subject: `Care Assistant Updated — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'CARE ASSISTANT UPDATED',
        title:      `Your care assistant has been updated for Booking #${booking.bookingCode}`,
        body:       `<b>New Care Assistant:</b> ${ca?.fullName || 'N/A'}<br/>
                     <b>Phone:</b> ${ca?.user?.phone || 'N/A'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    }).catch(e => console.error('[Admin reassign care] customer email:', e.message));

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Care assistant reassigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /admin/bookings/:id/refund
 */
router.post('/admin/bookings/:id/refund', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { refundAmount, reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const amount     = refundAmount ?? booking.fareBreakdown?.amountPaid ?? 0;
    const prevStatus = booking.status;

    const rzpPayment = booking.payments?.find(p => p.gateway === 'Razorpay' && p.status === 'success');
    if (rzpPayment?.transactionId && amount > 0) {
      try {
        await razorpay.payments.refund(rzpPayment.transactionId, {
          amount: Math.round(amount * 100),
          notes:  { reason: reason || 'Admin initiated refund', bookingCode: booking.bookingCode },
        });
        rzpPayment.status     = 'refunded';
        rzpPayment.refundedAt = new Date();
      } catch (rzpErr) { console.error('[Refund] Razorpay refund failed:', rzpErr.message); }
    }

    const walletPayment = booking.payments?.find(p => p.gateway === 'Wallet' && p.status === 'success');
    if (walletPayment && amount > 0) {
      try {
        const wallet = await Wallet.findOne({ user: booking.customer });
        if (wallet) {
          await wallet.credit(amount, 'Refund', {
            referenceId:  booking._id,
            onModel:      'Booking',
            description:  `Refund for booking ${booking.bookingCode}`,
            initiatedBy:  req.user._id,
          });
        }
      } catch (wErr) { console.error('[Refund] Wallet refund failed:', wErr.message); }
    }

    booking.fareBreakdown.refundAmount = amount;
    booking.paymentStatus              = 'refunded';
    booking.status                     = 'refunded';
    await recoverSubscriptionUsageOnCancel(booking).catch(e =>
  console.error('[admin/refund] recovery failed:', e.message)
);
    booking.statusLog.push({
      fromStatus: prevStatus, toStatus: 'refunded',
      changedBy: req.user._id, reason: reason || 'Admin initiated refund',
    });
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('email phone name').lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Refund Processed',
      body:      `Refund of ₹${amount} for booking #${booking.bookingCode} has been processed.`,
      type:      'Refund_Processed',
      bookingId: booking._id,
    });

    const refundMethod = rzpPayment ? 'Original_Source' : walletPayment ? 'Wallet' : 'Original_Source';
    sendEmail({
      email:   customer?.email,
      subject: `Refund Processed — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    buildRefundEmail({
        userName:     customer?.name || 'Valued Customer',
        order:        { orderId: booking.bookingCode },
        refundAmount: amount,
        refundMethod,
        actionLink:   `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
      }),
    }).catch(e => console.error('[Admin refund] email:', e.message));

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Refund initiated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin OP management ────────────────────────────────────────────────────

router.get('/admin/ops',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/admin/ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { doctorId, hospitalId, date, page = 1, limit = 20, status, patientId } = req.query;
      const filter = {};
      if (doctorId)   filter.doctor   = doctorId;
      if (hospitalId) filter.hospital = hospitalId;
      if (patientId)  filter.patient  = patientId;
      if (status)     filter.status   = status;
      if (date) {
        const d = new Date(date), nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.scheduledAt = { $gte: d, $lt: nextDay };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter)
          .sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit))
          .populate('doctor',   'user specialization')
          .populate('hospital', 'name address')
          .populate('patient',  'name phone email').lean(),
        OutPatientRecord.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: { ops, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /admin/ops/:id/status
 * Admin updates OP status. On completion sends OP zip to patient.
 * Also notifies doctor and hospital.
 */
router.patch('/admin/ops/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, doctorNotes } = req.body;
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status))
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid: ${validStatuses.join(', ')}`,
      });

    const op = await OutPatientRecord.findByIdAndUpdate(req.params.id, {
      status,
      ...(doctorNotes ? { doctorNotes } : {}),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
    }, { new: true })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } })
      .populate('hospital', 'name managedBy')
      .populate('patient',  'name email phone');

    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

    if (status === 'completed') {
      const booking   = await Booking.findById(op.booking).lean();
      const patient   = await User.findById(op.patient._id || op.patient).select('email name phone').lean();
      const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();
      const opPlain   = op.toObject ? op.toObject() : op;
      if (patient?.email) sendOpZipEmail({ op: opPlain, booking, patient, followUps });

      // End consultation if linked and still active
      if (booking?.consultationSessionId) {
        Consultation.findOneAndUpdate(
          { _id: booking.consultationSessionId, status: { $in: ['active', 'paused', 'waiting'] } },
          { status: 'completed', actualEndTime: new Date(), roomEnded: true, endedBy: 'admin', updatedBy: req.user._id },
          { new: true }
        ).catch(e => console.error('[admin ops complete] close consultation:', e.message));
      }
    }

    // Email: doctor
    if (op.doctor?.user) {
      const doctorUser = await User.findById(op.doctor.user._id || op.doctor.user).select('email name').lean();
      if (doctorUser?.email) {
        emailDoctorBookingUpdate({
          doctorUser,
          booking: { bookingCode: op.bookingNumber || 'N/A', _id: op.booking, patientInfo: { name: op.patientName }, scheduledAt: op.scheduledAt },
          subject: `OP Record Updated — ${op.opNumber} | Likeson Healthcare`,
          body:    `<b>OP Number:</b> ${op.opNumber}<br/>
                    <b>Patient:</b> ${op.patientName || 'N/A'}<br/>
                    <b>New Status:</b> ${status}<br/>
                    ${doctorNotes ? `<b>Notes Added:</b> ${doctorNotes}` : ''}`,
        }).catch(() => {});
      }
    }

    // Email: hospital
    if (op.hospital?.managedBy) {
      const hospitalUser = await User.findById(op.hospital.managedBy).select('email name').lean();
      if (hospitalUser?.email) {
        emailHospitalBookingUpdate({
          hospitalUser,
          booking: { bookingCode: op.bookingNumber || 'N/A', _id: op.booking, patientInfo: { name: op.patientName }, scheduledAt: op.scheduledAt },
          subject: `OP Record Updated — ${op.opNumber} | Likeson Healthcare`,
          body:    `<b>OP Number:</b> ${op.opNumber}<br/>
                    <b>Patient:</b> ${op.patientName || 'N/A'}<br/>
                    <b>New Status:</b> ${status}`,
        }).catch(() => {});
      }
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'OP status updated', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;