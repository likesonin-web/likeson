import express from 'express';

import Booking              from '../models/Booking.js';
import Ride                 from '../models/Ride.js';
import RideTracking         from '../models/RideTracking.js';
import User                 from '../models/User.js';
import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import TransportPartner     from '../models/TransportPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import Hospital             from '../models/Hospital.js';
import OutPatientRecord     from '../models/OutPatientRecord.js';
import DoctorProfile        from '../models/DoctorProfile.js';
import SystemLog            from '../models/SystemLog.js';

import sendSms                       from '../services/Sendsms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }   from '../services/bookingSocketService.js';
import {
  transactionalTemplate,
  otpTemplate,
  buildDeliveryOtpEmail,
} from '../utils/emailTemplates.js';
import { rideCompletedSms, driverAssignedSms, otpSms } from '../utils/Smstemplates.js';
import { generateOpHtml, buildOpZipBuffer } from '../utils/opDocumentGenerator.js';
import { opConfirmationEmailTemplate }       from '../utils/opEmailTemplates.js';

import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  genOtp,
  hashOtp,
  haversineKm,
  createNotification,
  buildRidePayload,
  createAndLinkRide,
  calculateCanonicalRoute,
  resolveCareRideKmRate,
  syncBookingStatusFromRide,
  RIDE_STATUSES_ACTIVE,
  CARE_RIDE_RADIUS_M,
} from './bookingRouterShared.js';

import { sendOtpEmail } from '../services/emailQueueService.js';
import sendEmail        from '../utils/sendEmail.js';

import cache       from '../middleware/cache.js';
import redisClient from '../config/redis.js';

const router = express.Router();

const CACHE_TTL = { nearby: 30, ops: 45 };

const invalidateBookingCache = async () => {
  try {
    const patterns = ['GET:/admin/bookings*', 'GET:/op/*'];
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

const joinBookingRoom = (userId, bookingId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `booking:${bookingId}`); }
  catch (e) { console.error('[joinBookingRoom]', e.message); }
};

const sendOpZipEmail = async ({ op, booking, doctor, hospital, patient, followUps = [] }) => {
  try {
    const html = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zip  = await buildOpZipBuffer(html, op.opNumber);
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
        content:     zip.toString('base64'),
        filename:    `${op.opNumber.replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`,
        type:        'application/zip',
        disposition: 'attachment',
      }],
    });
  } catch (e) { console.error('[OP ZIP Email] failed:', e.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPERS — fire-and-forget wrappers used throughout this router
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a driver-assigned notification email to the customer.
 */
const emailDriverAssigned = (customer, booking, driverDoc, driverUser) => {
  if (!customer?.email) return;
  sendEmail({
    email:   customer.email,
    subject: `Driver Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
    html: transactionalTemplate({
      header:     'DRIVER ASSIGNED',
      title:      `Your driver is on the way, ${customer.name}!`,
      body: `
        <strong>Booking:</strong> #${booking.bookingCode}<br/>
        <strong>Driver:</strong> ${driverDoc.legalName || driverUser.name}<br/>
        <strong>Vehicle:</strong> ${driverDoc.assignedVehicleSnapshot?.registrationNumber || 'N/A'}
          ${driverDoc.assignedVehicleSnapshot?.make || ''}
          ${driverDoc.assignedVehicleSnapshot?.model || ''}<br/>
        <strong>Driver Phone:</strong> ${driverDoc.phone || driverUser.phone || 'N/A'}
      `,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      buttonText: 'Track Your Ride',
    }),
  }).catch(e => console.error('[emailDriverAssigned]', e.message));
};

/**
 * Notify customer their ride was rejected and is being reassigned.
 */
const emailRideRejected = (customer, booking, reason) => {
  if (!customer?.email) return;
  sendEmail({
    email:   customer.email,
    subject: `Ride Update — Booking #${booking.bookingCode} | Likeson Healthcare`,
    html: transactionalTemplate({
      header:     'RIDE UPDATE',
      title:      'Driver unavailable — finding another driver',
      body: `
        Your booking <strong>#${booking.bookingCode}</strong> driver was unable to accept the ride
        ${reason ? `(${reason})` : ''}. We are automatically reassigning a new driver — no action needed.
      `,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      buttonText: 'View Booking',
    }),
  }).catch(e => console.error('[emailRideRejected]', e.message));
};

/**
 * Send ride-request confirmation email to customer.
 */
const emailRideRequested = (customer, booking, data) => {
  if (!customer?.email) return;
  sendEmail({
    email:   customer.email,
    subject: `Ride Requested — Booking #${booking.bookingCode} | Likeson Healthcare`,
    html: transactionalTemplate({
      header:     'RIDE REQUESTED',
      title:      `Ride booked! We're finding your driver`,
      body: `
        <strong>Booking:</strong> #${booking.bookingCode}<br/>
        <strong>Pickup:</strong> ${data.pickup?.address || data.pickup?.label || 'As provided'}<br/>
        <strong>Drop:</strong> ${data.destination?.address || data.destination?.label || 'As provided'}<br/>
        <strong>Distance:</strong> ${data.distKm} km<br/>
        <strong>Est. Fare:</strong> ₹${data.transportFee}<br/>
        <strong>Rate:</strong> ₹${data.ratePerKm}/km (${data.rateSource})
      `,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      buttonText: 'Track Booking',
    }),
  }).catch(e => console.error('[emailRideRequested]', e.message));
};

/**
 * Notify admin / fallback that no driver was found near patient.
 * Sends to support inbox so ops team acts quickly.
 */
const emailNoDriverNearby = (booking, data) => {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@likeson.in';
  sendEmail({
    email:   supportEmail,
    subject: `⚠️ No Driver Nearby — Booking #${booking.bookingCode} | Action Required`,
    html: transactionalTemplate({
      header:     'OPS ALERT',
      title:      `No driver within ${data.searchRadiusKm}km — manual assignment needed`,
      body: `
        <strong>Booking:</strong> #${booking.bookingCode}<br/>
        <strong>Ride ID:</strong> ${data.rideId}<br/>
        <strong>Requester:</strong> ${data.requesterType || 'customer'}<br/>
        <strong>Pickup:</strong> ${data.pickup?.address || JSON.stringify(data.pickup?.coordinates)}<br/>
        <strong>Drop:</strong> ${data.destination?.address || JSON.stringify(data.destination?.coordinates)}<br/>
        <strong>Distance:</strong> ${data.distKm} km &nbsp;|&nbsp; ₹${data.transportFee}<br/>
        <strong>Search Radius:</strong> ${data.searchRadiusKm} km
      `,
      buttonLink: `${process.env.FRONTEND_URL}/admin/bookings/${booking._id}`,
      buttonText: 'Assign Driver Now',
    }),
  }).catch(e => console.error('[emailNoDriverNearby]', e.message));
};

/**
 * Notify care assistant that a ride was requested for their patient.
 */
const emailCareAssistantRideRequested = (caUser, booking, data) => {
  if (!caUser?.email) return;
  sendEmail({
    email:   caUser.email,
    subject: `Ride Requested for Patient — Booking #${booking.bookingCode} | Likeson Healthcare`,
    html: transactionalTemplate({
      header:     'CARE RIDE REQUESTED',
      title:      `Ride booked for your patient`,
      body: `
        <strong>Booking:</strong> #${booking.bookingCode}<br/>
        <strong>Pickup:</strong> ${data.pickup?.address || data.pickup?.label || 'As provided'}<br/>
        <strong>Drop:</strong> ${data.destination?.address || data.destination?.label || 'As provided'}<br/>
        <strong>Distance:</strong> ${data.distKm} km<br/>
        <strong>Est. Fare:</strong> ₹${data.transportFee}<br/>
        We are assigning a driver. You will be notified when driver accepts.
      `,
      buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      buttonText: 'View Booking',
    }),
  }).catch(e => console.error('[emailCareAssistantRideRequested]', e.message));
};

/**
 * Notify doctor that their patient's ride is completed and OP card was sent.
 */
const emailDoctorRideCompleted = async (booking) => {
  try {
    if (!booking.doctor) return;
    const doctorProfile = await DoctorProfile.findById(booking.doctor)
      .populate('user', 'name email').lean();
    const doctorEmail = doctorProfile?.user?.email;
    if (!doctorEmail) return;

    sendEmail({
      email:   doctorEmail,
      subject: `Patient Ride Completed — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header:     'PATIENT UPDATE',
        title:      `Patient ride completed`,
        body: `
          Booking <strong>#${booking.bookingCode}</strong> has been completed.
          Patient: <strong>${booking.patientInfo?.name || 'N/A'}</strong><br/>
          The OP card and invoice have been dispatched to the patient.
        `,
        buttonLink: `${process.env.FRONTEND_URL}/doctor/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    }).catch(e => console.error('[emailDoctorRideCompleted]', e.message));
  } catch (e) { console.error('[emailDoctorRideCompleted] lookup failed:', e.message); }
};

/**
 * Notify hospital that a booking tied to them is completed.
 */
const emailHospitalRideCompleted = async (booking) => {
  try {
    if (!booking.hospital) return;
    const hospital = await Hospital.findById(booking.hospital)
      .select('name contactEmail').lean();
    const hospitalEmail = hospital?.contactEmail;
    if (!hospitalEmail) return;

    sendEmail({
      email:   hospitalEmail,
      subject: `Patient Booking Completed — #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header:     'HOSPITAL NOTIFICATION',
        title:      `Patient booking completed`,
        body: `
          Booking <strong>#${booking.bookingCode}</strong> is now completed.<br/>
          Patient: <strong>${booking.patientInfo?.name || 'N/A'}</strong><br/>
          Hospital: <strong>${hospital.name}</strong><br/>
          All documents have been dispatched.
        `,
        buttonLink: `${process.env.FRONTEND_URL}/hospital/bookings/${booking._id}`,
        buttonText: 'View Records',
      }),
    }).catch(e => console.error('[emailHospitalRideCompleted]', e.message));
  } catch (e) { console.error('[emailHospitalRideCompleted] lookup failed:', e.message); }
};

// ═════════════════════════════════════════════════════════════════════════════
// DRIVER ROUTES
// CRITICAL: Ride.driver = Driver._id (NOT User._id)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/assigned
 * FIX: Ride.driver = Driver._id. Resolve Driver._id from User._id first.
 */
router.get('/driver/assigned',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const driverDoc = await Driver.findOne({ user: req.user._id })
        .select('_id legalName driverCode status assignedVehicleSnapshot ownerAgency soloPartner')
        .lean();

      if (!driverDoc) {
        return res.status(404).json({ success: false, message: 'Driver profile not found. Contact admin.' });
      }

      const rides = await Ride.find({
        driver: driverDoc._id, // ← Driver._id, NOT User._id
        status: { $in: RIDE_STATUSES_ACTIVE },
      })
        .populate({
          path:   'booking',
          select: 'bookingCode bookingType scheduledAt patientInfo fareBreakdown status patientLocation destinationLocation consultationType notificationsSent',
          populate: { path: 'customer', select: 'name phone avatar' },
        })
        .populate('trackingId', 'expectedRoutePolyline currentEtaMinutes hasActiveSos')
        .select('rideCode rideType vehicleClass status pickup dropoff stops liveLocation scheduledPickupAt estimatedDistanceKm estimatedDurationMin driverAssignedAt driverAcceptedAt driverArrivedAt rideStartedAt fare trackingId booking transportPartner soloPartner vehicleSnapshot driverSnapshot isReturnRide')
        .sort({ scheduledPickupAt: 1, createdAt: -1 })
        .lean();

      return res.json({
        success: true,
        data: {
          driver: {
            driverCode:              driverDoc.driverCode,
            legalName:               driverDoc.legalName,
            status:                  driverDoc.status,
            assignedVehicleSnapshot: driverDoc.assignedVehicleSnapshot,
            type: driverDoc.ownerAgency ? 'agency' : 'solo',
          },
          rides,
          total: rides.length,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /:id/ride/accept
 * FIX: queries ride by Driver._id (driverObjectId resolved from User._id)
 * EMAIL: customer gets driver-assigned email
 */
router.patch('/:id/ride/accept',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const driverDoc = await Driver.findOne({ user: req.user._id })
        .select('_id assignedVehicleSnapshot phone legalName').lean();
      if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver profile not found' });

      const ride = await Ride.findOne({ booking: req.params.id, driver: driverDoc._id }); // ← Driver._id
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (ride.status !== 'driver_assigned')
        return res.status(400).json({ success: false, message: `Ride status is ${ride.status}, expected driver_assigned` });

      ride.status = 'driver_accepted';

ride.driverAcceptedAt =
  new Date();

ride.activeTarget =
  'patient_pickup';

ride.currentLeg =
  'driver_to_patient';
      await ride.save();

      const booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      await syncBookingStatusFromRide(booking._id, 'driver_accepted', req.user._id);

      const customer   = await User.findById(booking.customer).select('email phone name').lean();
      const driverUser = await User.findById(req.user._id).select('name phone').lean();

      await createNotification({
        recipient: booking.customer,
        title:     'Driver Accepted',
        body:      `Driver ${driverDoc.legalName || driverUser.name} accepted your ride.`,
        type:      'Driver_Assigned',
        bookingId: booking._id,
      });

      // SMS
      sendSms({
        to:      customer.phone,
        message: driverAssignedSms({
          userName:      customer.name,
          rideId:        booking.bookingCode,
          driverName:    driverDoc.legalName || driverUser.name,
          vehicleNumber: driverDoc.assignedVehicleSnapshot?.registrationNumber || 'N/A',
          driverPhone:   driverDoc.phone || driverUser.phone,
        }),
      }).catch(e => console.error('[Accept] SMS:', e.message));

      // EMAIL → customer
      emailDriverAssigned(customer, booking, driverDoc, driverUser);

      const trackingDoc = ride.trackingId
        ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
        : null;

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
        bookingId:  booking._id,
        status:     'confirmed',
        timestamp:  new Date(),
        driverInfo: {
          name:          driverDoc.legalName || driverUser.name,
          phone:         driverDoc.phone     || driverUser.phone,
          vehicleNumber: driverDoc.assignedVehicleSnapshot?.registrationNumber || 'N/A',
          vehicleMake:   driverDoc.assignedVehicleSnapshot?.make,
          vehicleModel:  driverDoc.assignedVehicleSnapshot?.model,
          vehicleColor:  driverDoc.assignedVehicleSnapshot?.color,
        },
        mapRoute: {
          polyline:         trackingDoc?.expectedRoutePolyline || null,
          pickupCoords:     ride.pickup?.coordinates,
          pickupAddress:    ride.pickup?.address,
          dropoffCoords:    ride.dropoff?.coordinates,
          dropoffAddress:   ride.dropoff?.address,
          estimatedDistKm:  ride.estimatedDistanceKm,
          estimatedMinutes: ride.estimatedDurationMin,
          currentTarget:    'pickup',
        },
      });

      await invalidateBookingCache();
      return res.json({
        success: true,
        message: 'Ride accepted',
        data: {
          ride,
          driverInfo:   { name: driverDoc.legalName || driverUser.name, phone: driverDoc.phone || driverUser.phone, vehicleNumber: driverDoc.assignedVehicleSnapshot?.registrationNumber || 'N/A' },
          customerInfo: { name: customer.name, phone: customer.phone },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /:id/ride/reject
 * EMAIL: customer notified of rejection + reassignment
 */
router.patch('/:id/ride/reject',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { reason } = req.body;
      const driverDoc  = await Driver.findOne({ user: req.user._id }).select('_id').lean();
      if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver profile not found' });

      const ride = await Ride.findOne({ booking: req.params.id, driver: driverDoc._id }); // ← Driver._id
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      ride.status       = 'cancelled';
      ride.cancellation = {
        cancelledBy:       'driver',
        cancelledByUserId: req.user._id,
        reason:            reason || 'Driver rejected',
        cancelledAt:       new Date(),
      };
      await ride.save();

      await Ride.findByIdAndUpdate(ride._id, { $addToSet: { declinedDrivers: driverDoc._id } });

      const booking  = await Booking.findById(req.params.id).select('bookingCode transportPartner customer').lean();
      const customer = await User.findById(booking?.customer).select('email phone name').lean();

      // EMAIL → customer
      if (booking) emailRideRejected(customer, booking, reason);

      if (booking?.transportPartner) {
        getBookingSocketService()?.emitToRoom(`tp:${booking.transportPartner}`, 'driver_rejected', {
          bookingId:   req.params.id,
          bookingCode: booking.bookingCode,
          reason:      reason || 'Driver rejected',
        });
      }
      getBookingSocketService()?.emitToRoom('admin:ops', 'driver_rejected', {
        bookingId: req.params.id, driverObjectId: driverDoc._id,
      });

      return res.json({ success: true, message: 'Ride rejected. Will be reassigned.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /:id/ride/arrived
 *
 * FIX: OTP stored RAW (no hash) — socket verify_otp uses hashOtp to compare.
 * FIX: OTP email sent via emailQueueService (not raw sendEmail — idempotent).
 * FIX: emitOtpToAdmin called correctly.
 * EMAIL: delivery OTP email to customer via buildDeliveryOtpEmail
 */
router.patch('/:id/ride/arrived',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
      if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver profile not found' });

      const ride = await Ride.findOne({ booking: req.params.id, driver: driverDoc._id });
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['driver_accepted', 'driver_en_route'].includes(ride.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot mark arrived from status: ${ride.status}`,
        });
      }

      const otp      = genOtp();
      ride.status    = 'driver_arrived';
      ride.pickupOtp = hashOtp(otp);;  
      await ride.save();

      if (ride.trackingId) {
        RideTracking.addMilestone(ride._id, 'driver_arrived', {
          recordedBy: 'driver', recordedByUserId: req.user._id,
        }).catch(e => console.error('[Arrived] milestone:', e.message));
      }

      const booking  = await Booking.findById(req.params.id);
      const customer = await User.findById(booking.customer).select('email phone name').lean();

      sendSms({
        to:      customer.phone,
        message: otpSms({ otpCode: otp, purpose: `ride start #${booking.bookingCode}` }),
      }).catch(e => console.error('[Arrived] OTP SMS:', e.message));

      if (customer?.email) {
        sendEmail({
          email:   customer.email,
          subject: `Your Driver Has Arrived — OTP ${otp} | Booking #${booking.bookingCode}`,
          html:    buildDeliveryOtpEmail({
            userName: customer.name,
            order:    { orderId: booking.bookingCode },
            otpCode:  otp,
          }),
        }).catch(e => console.error('[Arrived] OTP email:', e.message));
      }

      await createNotification({
        recipient: booking.customer,
        title:     'Driver Arrived',
        body:      `Your driver arrived. Share OTP ${otp} to start your ride.`,
        type:      'Driver_Arrived',
        bookingId: booking._id,
        priority:  'High',
        otp,
      });

      const ss = getBookingSocketService();

      ss?.emitToRoom(`booking:${booking._id}`, 'driver_arrived', {
        bookingId:     booking._id,
        currentTarget: 'pickup',
        otp,
      });
      ss?.emitToRoom(`booking:${booking._id}`, 'otp_required', { bookingId: booking._id, otp });

      ss?.emitOtpToAdmin({
        bookingId:     booking._id,
        bookingCode:   booking.bookingCode,
        rideId:        ride._id,
        otp,
        customerName:  customer.name,
        customerPhone: customer.phone,
      });

      return res.json({ success: true, message: 'Arrival marked. OTP sent to customer.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// NOTE: POST /:id/ride/start INTENTIONALLY REMOVED
// OTP verification is handled exclusively by socket event verify_otp.
// Having both HTTP + socket paths caused race conditions + duplicate milestones.

/**
 * POST /:id/ride/end
 * FIX: queries ride by Driver._id.
 * FIX: syncBookingStatusFromRide used for booking status.
 * FIX: return ride tracking created with canonical polyline.
 * EMAIL: invoice to customer, OP card if consultation, doctor + hospital notified on completion
 */
router.post('/:id/ride/end',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { dropPhotoUrl, actualDistanceKm } = req.body;

      const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
      if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver profile not found' });

      const ride = await Ride.findOne({ booking: req.params.id, driver: driverDoc._id }); // ← Driver._id
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['in_progress', 'at_stop'].includes(ride.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot end ride from status: ${ride.status}`,
        });
      }

      ride.status           = 'completed';
      ride.actualDistanceKm = actualDistanceKm || ride.estimatedDistanceKm || 0;
      if (dropPhotoUrl) ride.internalNotes = `dropPhoto:${dropPhotoUrl}`;
      await ride.save();

      RideTracking.computeSummary(ride._id).catch(() => {});
      if (ride.trackingId) {
        RideTracking.addMilestone(ride._id, 'ride_completed', {
          recordedBy: 'driver', recordedByUserId: req.user._id,
        }).catch(() => {});
      }

      const booking = await Booking.findById(req.params.id).populate('returnRide').lean();

      // ── Return ride activation ─────────────────────────────────────────────
      if (booking.returnRide && !['completed', 'cancelled'].includes(booking.returnRide?.status)) {
        const returnRide = await Ride.findById(booking.returnRide._id);
        if (returnRide && returnRide.status === 'requested') {
          returnRide.driver = driverDoc._id; // ← Driver._id
          returnRide.status = 'driver_assigned';

          const { distanceKm: retKm, durationMin: retMin, polyline: retPolyline } =
            await calculateCanonicalRoute(
              returnRide.pickup?.coordinates,
              returnRide.dropoff?.coordinates,
            );

          returnRide.estimatedDistanceKm  = retKm;
          returnRide.estimatedDurationMin = retMin;
          await returnRide.save();

          const retTracking = await RideTracking.create({
            ride:                  returnRide._id,
            booking:               booking._id,
            driver:                driverDoc._id,
            expectedRoutePolyline: retPolyline,
          });
          await Ride.findByIdAndUpdate(returnRide._id, { $set: { trackingId: retTracking._id } });

          // EMAIL → customer: return ride activated
          const retCustomer = await User.findById(booking.customer).select('email name phone').lean();
          if (retCustomer?.email) {
            sendEmail({
              email:   retCustomer.email,
              subject: `Return Ride Activated — Booking #${booking.bookingCode} | Likeson Healthcare`,
              html: transactionalTemplate({
                header:     'RETURN RIDE ACTIVATED',
                title:      'Your return ride is now active!',
                body: `
                  Outbound ride for booking <strong>#${booking.bookingCode}</strong> is complete.<br/>
                  Same driver will take you back.<br/>
                  <strong>From:</strong> ${returnRide.pickup?.address || 'As scheduled'}<br/>
                  <strong>To:</strong> ${returnRide.dropoff?.address || 'As scheduled'}<br/>
                  <strong>Est. Distance:</strong> ${retKm} km
                `,
                buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
                buttonText: 'Track Return Ride',
              }),
            }).catch(e => console.error('[ReturnRide] email:', e.message));
          }

          getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'return_ride_activated', {
            bookingId:        booking._id,
            returnRideId:     returnRide._id,
            currentTarget:    'return_dropoff',
            pickupCoords:     returnRide.pickup?.coordinates,
            pickupAddress:    returnRide.pickup?.address,
            dropoffCoords:    returnRide.dropoff?.coordinates,
            dropoffAddress:   returnRide.dropoff?.address,
            polyline:         retPolyline,
            estimatedDistKm:  retKm,
            estimatedMinutes: retMin,
            driverInfo: { name: req.user.name, phone: req.user.phone },
          });

          await Booking.findByIdAndUpdate(booking._id, {
            $set: { primaryRide: returnRide._id, updatedBy: req.user._id },
          });

          return res.json({
            success: true,
            message: 'Outbound ride completed. Return ride activated — same driver.',
            data: {
              completedRideId: ride._id,
              returnRideId:    returnRide._id,
              returnRoute:     { distKm: retKm, durationMin: retMin, polyline: retPolyline },
            },
          });
        }
      }

      // ── No return ride — complete booking ─────────────────────────────────
      const bookingDoc = await Booking.findById(req.params.id);
      await syncBookingStatusFromRide(bookingDoc._id, 'completed', req.user._id);

      const customer = await User.findById(bookingDoc.customer).select('email phone name').lean();

      const opForLink = await OutPatientRecord.findOne({ booking: bookingDoc._id })
        .select('opNumber').lean();

      await createNotification({
        recipient: bookingDoc.customer,
        title:     'Ride Completed',
        body:      `Booking #${bookingDoc.bookingCode} completed. Tap to download your OP card.`,
        type:      'Booking_Completed',
        bookingId: bookingDoc._id,
        actionUrl: opForLink
          ? `${process.env.BACKEND_URL}/api/bookings/op/${opForLink.opNumber}/download`
          : `${process.env.FRONTEND_URL}/bookings/${bookingDoc._id}`,
        deepLink: {
          screen:      opForLink ? 'OpDownload' : 'BookingDetail',
          referenceId: bookingDoc._id,
        },
      });

      sendSms({
        to:      customer.phone,
        message: rideCompletedSms({
          userName:  customer.name,
          rideId:    bookingDoc.bookingCode,
          totalFare: bookingDoc.fareBreakdown?.totalAmount,
        }),
      }).catch(e => console.error('[End] SMS:', e.message));

      // EMAIL → customer: invoice
      try {
        const pdfBuffer = await generateBookingInvoicePdf(bookingDoc);
        await sendEmail({
          email:   customer.email,
          subject: `Invoice — #${bookingDoc.bookingCode} | Likeson Healthcare`,
          html:    transactionalTemplate({
            header:     'BOOKING COMPLETED',
            title:      `Booking #${bookingDoc.bookingCode} complete!`,
            body:       `Total: ₹${bookingDoc.fareBreakdown?.totalAmount}. Invoice attached.`,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${bookingDoc._id}/rate`,
            buttonText: 'Rate Your Experience',
          }),
          attachments: [{
            content:     pdfBuffer.toString('base64'),
            filename:    `invoice-${bookingDoc.bookingCode}.pdf`,
            type:        'application/pdf',
            disposition: 'attachment',
          }],
        });
      } catch (e) { console.error('[End] Invoice email:', e.message); }

      // EMAIL → doctor & hospital: ride complete notification
      await emailDoctorRideCompleted(bookingDoc);
      await emailHospitalRideCompleted(bookingDoc);

      // EMAIL → customer: OP card for consultation bookings
      if (['doctor_consultation', 'full_care_ride', 'follow_up', 'physiotherapist'].includes(bookingDoc.bookingType)) {
        const op       = await OutPatientRecord.findOne({ booking: bookingDoc._id }).lean();
        const doctor   = await DoctorProfile.findById(bookingDoc.doctor).populate('user', 'name').lean();
        const hospital = await Hospital.findById(bookingDoc.hospital).lean();
        const followUps = op
          ? await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean()
          : [];
        if (op) sendOpZipEmail({ op, booking: bookingDoc, doctor, hospital, patient: customer, followUps });
      }

      const ss = getBookingSocketService();
      ss?.emitToRoom(`booking:${bookingDoc._id}`, 'ride_completed', {
        bookingId: bookingDoc._id, completedAt: ride.rideCompletedAt,
      });
      ss?.emitToRoom(`booking:${bookingDoc._id}`, 'booking_status_change', {
        bookingId: bookingDoc._id, status: 'completed', timestamp: new Date(),
      });

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Ride completed', data: { booking: bookingDoc } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /driver/location — HTTP GPS fallback
 * FIX: queries ride by Driver._id.
 * FIX: emits remainingKm + ETA to booking room.
 */
router.patch('/driver/location',
  protect, authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { lat, lng, heading, speed, bookingId } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });

      await Driver.findOneAndUpdate({ user: req.user._id }, {
        'location.coordinates': [lng, lat],
        'location.heading':     heading || 0,
        'location.speedKmh':    speed   || 0,
        'location.updatedAt':   new Date(),
      });

      if (bookingId) {
        const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
        if (driverDoc) {
          const ride = await Ride.findOne({
            booking: bookingId,
            driver:  driverDoc._id, // ← Driver._id
            status:  { $in: RIDE_STATUSES_ACTIVE },
          }).select('_id trackingId dropoff pickup estimatedDistanceKm status');

          if (ride) {
            ride.liveLocation = {
              type: 'Point', coordinates: [lng, lat],
              heading: heading || 0, speedKmh: speed || 0, updatedAt: new Date(),
            };
            await ride.save();

            if (ride.trackingId) {
              RideTracking.addBreadcrumb(ride._id, {
                coordinates: [lng, lat], heading: heading || 0,
                speedKmh: speed || 0, source: 'gps',
              }).catch(e => console.error('[Location HTTP] breadcrumb:', e.message));
            }

            const isAfterOtp   = ['otp_verified', 'in_progress', 'at_stop'].includes(ride.status);
            const targetCoords = isAfterOtp ? ride.dropoff?.coordinates : ride.pickup?.coordinates;
            let remainingKm    = null;
            let etaMin         = null;

            if (targetCoords) {
              remainingKm = +haversineKm([lng, lat], targetCoords).toFixed(2);
              const speedKmh = (speed && speed > 2) ? speed : 30;
              etaMin = Math.round((remainingKm / speedKmh) * 60);
            }

            getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'location_update', {
              lat, lng, heading, speed,
              rideId:        String(ride._id),
              bookingId,
              role:          'driver',
              updatedAt:     new Date(),
              remainingKm,
              etaMinutes:    etaMin,
              currentTarget: isAfterOtp ? 'dropoff' : 'pickup',
              rideStatus:    ride.status,
            });
          }
        }
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOMER: self-request ride on existing booking
// EMAIL: confirmation to customer; ops alert if no driver nearby
// ═════════════════════════════════════════════════════════════════════════════

router.post('/:id/request-ride',
  protect, authorize('customer'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const booking = await Booking.findOne({
        _id:      req.params.id,
        customer: req.user._id,
        status:   { $in: ['pending', 'confirmed'] },
      });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not yours' });

      const activeRide = await Ride.findOne({
        booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE },
      });
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists for this booking' });

      const [pLng, pLat] = pickupLocation.coordinates;
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(req.user._id);

      const { distanceKm: canonicalKm, durationMin, polyline } = await calculateCanonicalRoute(
        pickupLocation.coordinates, destinationLocation.coordinates,
      );
      const transportFee  = +(canonicalKm * ratePerKm).toFixed(2);
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;
      const nearbyCount   = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false, status: 'Available',
        location: { $geoWithin: { $centerSphere: [[pLng, pLat], careRadiusRad] } },
      });

      const pickupGeo  = { type: 'Point', coordinates: pickupLocation.coordinates,  label: pickupLocation.label   || '', address: pickupLocation.address   || '', city: pickupLocation.city   || '' };
      const dropoffGeo = { type: 'Point', coordinates: destinationLocation.coordinates, label: destinationLocation.label || '', address: destinationLocation.address || '', city: destinationLocation.city || '' };

      const otp  = genOtp();
      const ride = await Ride.create({
        booking: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler',
        pickup: pickupGeo, dropoff: dropoffGeo,
        scheduledPickupAt:    booking.scheduledAt || new Date(),
        status:               'searching',
        pickupOtp:            hashOtp(otp),
        estimatedDistanceKm:  canonicalKm,
        estimatedDurationMin: durationMin,
        createdBy:            req.user._id,
      });

      const tracking = await RideTracking.create({
        ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set:  {
          primaryRide:                  ride._id,
          patientLocation:              pickupGeo,
          destinationLocation:          dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
          updatedBy:                    req.user._id,
        },
      });

      // EMAIL → customer: ride confirmed
      const customer = await User.findById(req.user._id).select('email name phone').lean();
      emailRideRequested(customer, booking, {
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), transportFee, ratePerKm, rateSource,
      });

      const rideData = {
        bookingId:      booking._id,
        bookingCode:    booking.bookingCode,
        rideId:         ride._id,
        customerId:     req.user._id,
        pickup:         pickupGeo,
        destination:    dropoffGeo,
        distKm:         +canonicalKm.toFixed(2),
        ratePerKm, rateSource, transportFee,
        noDriverNearby: nearbyCount === 0,
        searchRadiusKm: 30,
        timestamp:      new Date(),
      };

      // EMAIL → ops support if no driver nearby
      if (nearbyCount === 0) emailNoDriverNearby(booking, rideData);

      getBookingSocketService()?.emitToAdminOps('ride_requested_by_customer', rideData);

      return res.json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign.'
          : 'Ride requested. Admin assigning driver.',
        data: {
          rideId:         ride._id,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +canonicalKm.toFixed(2),
          durationMin, ratePerKm, rateSource, transportFee, searchRadiusKm: 30,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT: request ride for patient
// FIX: authorize('care_assistant') underscore
// EMAIL: care assistant + customer + ops if no driver
// ═════════════════════════════════════════════════════════════════════════════

router.post('/:id/care/request-ride',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({
        _id:           req.params.id,
        careAssistant: profile._id,
        status:        { $in: ['confirmed', 'in_progress'] },
      });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      const activeRide = await Ride.findOne({
        booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE },
      });
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists' });

      const [pLng, pLat] = pickupLocation.coordinates;
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);

      const { distanceKm: canonicalKm, durationMin, polyline } = await calculateCanonicalRoute(
        pickupLocation.coordinates, destinationLocation.coordinates,
      );
      const transportFee  = +(canonicalKm * ratePerKm).toFixed(2);
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;
      const nearbyCount   = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false, status: 'Available',
        location: { $geoWithin: { $centerSphere: [[pLng, pLat], careRadiusRad] } },
      });

      const pickupGeo  = { type: 'Point', coordinates: pickupLocation.coordinates,  label: pickupLocation.label   || '', address: pickupLocation.address   || '', city: pickupLocation.city   || '' };
      const dropoffGeo = { type: 'Point', coordinates: destinationLocation.coordinates, label: destinationLocation.label || '', address: destinationLocation.address || '', city: destinationLocation.city || '' };

      const otp  = genOtp();
      const ride = await Ride.create({
        booking: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler',
        pickup: pickupGeo, dropoff: dropoffGeo,
        scheduledPickupAt:    booking.scheduledAt || new Date(),
        status:               'searching',
        pickupOtp:            hashOtp(otp),
        estimatedDistanceKm:  canonicalKm,
        estimatedDurationMin: durationMin,
        createdBy:            req.user._id,
      });

      const tracking = await RideTracking.create({
        ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set:  {
          primaryRide:                  ride._id,
          patientLocation:              pickupGeo,
          destinationLocation:          dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
          updatedBy:                    req.user._id,
        },
      });

      const rideData = {
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), transportFee, ratePerKm, rateSource,
      };

      // EMAIL → care assistant
      const caUser = await User.findById(req.user._id).select('email name phone').lean();
      emailCareAssistantRideRequested(caUser, booking, rideData);

      // EMAIL → customer (patient)
      const customer = await User.findById(booking.customer).select('email name phone').lean();
      if (customer?.email) {
        sendEmail({
          email:   customer.email,
          subject: `Ride Requested for You — Booking #${booking.bookingCode} | Likeson Healthcare`,
          html: transactionalTemplate({
            header:     'RIDE REQUESTED',
            title:      'Your care assistant has requested a ride for you',
            body: `
              Your care assistant arranged a ride for booking <strong>#${booking.bookingCode}</strong>.<br/>
              <strong>Pickup:</strong> ${pickupGeo.address || pickupGeo.label || 'As provided'}<br/>
              <strong>Drop:</strong> ${dropoffGeo.address || dropoffGeo.label || 'As provided'}<br/>
              <strong>Distance:</strong> ${rideData.distKm} km<br/>
              <strong>Est. Fare:</strong> ₹${transportFee}
            `,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
            buttonText: 'Track Booking',
          }),
        }).catch(e => console.error('[CareRide] customer email:', e.message));
      }

      // EMAIL → ops if no driver nearby
      if (nearbyCount === 0) {
        emailNoDriverNearby(booking, {
          ...rideData, rideId: ride._id, requesterType: 'care_assistant', searchRadiusKm: 30,
        });
      }

      getBookingSocketService()?.emitToAdminOps('ride_requested_by_care_assistant', {
        bookingId:       booking._id,
        bookingCode:     booking.bookingCode,
        rideId:          ride._id,
        careAssistantId: profile._id,
        careAssistantUser: req.user._id,
        pickup:          pickupGeo,
        destination:     dropoffGeo,
        distKm:          +canonicalKm.toFixed(2),
        ratePerKm, rateSource, transportFee,
        noDriverNearby:  nearbyCount === 0,
        searchRadiusKm:  30,
        timestamp:       new Date(),
      });

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_requested', {
        bookingId:   booking._id,
        requestedBy: 'care_assistant',
        pickup:      pickupGeo,
        destination: dropoffGeo,
        distKm:      +canonicalKm.toFixed(2),
        transportFee,
        timestamp:   new Date(),
      });

      return res.json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign.'
          : 'Ride requested. Admin assigning driver.',
        data: {
          rideId:         ride._id,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +canonicalKm.toFixed(2),
          durationMin, ratePerKm, rateSource, transportFee, searchRadiusKm: 30,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN: care-ride request (on behalf of customer or care assistant)
// EMAIL: customer + care assistant notified; ops alert if no driver
// ═════════════════════════════════════════════════════════════════════════════

router.post('/admin/care-ride/request',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId, customerId, requesterType, careAssistantId, pickupLocation, destinationLocation } = req.body;

      if (!['customer', 'care_assistant'].includes(requesterType))
        return res.status(400).json({ success: false, message: 'requesterType must be customer or care_assistant' });
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const [pLng, pLat] = pickupLocation.coordinates;

      let booking            = bookingId ? await Booking.findById(bookingId) : null;
      let resolvedCustomerId = customerId;

      if (requesterType === 'care_assistant') {
        if (!careAssistantId)
          return res.status(400).json({ success: false, message: 'careAssistantId required for care_assistant requester' });

        const ca = await CareAssistantProfile.findById(careAssistantId)
          .select('user fullName isActive verification').lean();
        if (!ca) return res.status(404).json({ success: false, message: 'Care assistant not found' });
        if (!ca.isActive || !ca.verification?.isVerified)
          return res.status(400).json({ success: false, message: 'Care assistant not active or verified' });
        if (!booking)
          return res.status(400).json({ success: false, message: 'bookingId required when care_assistant requests ride' });
        resolvedCustomerId = booking.customer;
      }

      if (!resolvedCustomerId)
        return res.status(400).json({ success: false, message: 'customerId required' });

      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(resolvedCustomerId);
      const { distanceKm: canonicalKm, durationMin, polyline } = await calculateCanonicalRoute(
        pickupLocation.coordinates, destinationLocation.coordinates,
      );
      const transportFee  = +(canonicalKm * ratePerKm).toFixed(2);
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;

      const [nearbyDrivers, nearbyTPs] = await Promise.all([
        Driver.find({
          isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[pLng, pLat], careRadiusRad] } },
        }).select('driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency soloPartner').limit(10).lean(),
        TransportPartner.find({
          partnershipStatus: 'active', isAvailable: true,
          'serviceZones.city': { $regex: pickupLocation.city || '', $options: 'i' },
        }).select('businessName ownerPhone fleetInfo serviceZones').limit(10).lean(),
      ]);

      const noDriverNearby = nearbyDrivers.length === 0 && nearbyTPs.length === 0;

      const pickupGeo  = { type: 'Point', coordinates: pickupLocation.coordinates,  label: pickupLocation.label   || '', address: pickupLocation.address   || '', city: pickupLocation.city   || '' };
      const dropoffGeo = { type: 'Point', coordinates: destinationLocation.coordinates, label: destinationLocation.label || '', address: destinationLocation.address || '', city: destinationLocation.city || '' };

      const otp  = genOtp();
      const ride = await Ride.create({
        booking: booking?._id || null, rideType: 'patient', vehicleClass: 'four_wheeler',
        pickup: pickupGeo, dropoff: dropoffGeo,
        scheduledPickupAt:    booking?.scheduledAt || new Date(),
        status:               'searching',
        pickupOtp:            hashOtp(otp),
        estimatedDistanceKm:  canonicalKm,
        estimatedDurationMin: durationMin,
        createdBy:            req.user._id,
      });

      const tracking = await RideTracking.create({
        ride: ride._id, booking: booking?._id || null, expectedRoutePolyline: polyline,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      if (booking) {
        await Booking.findByIdAndUpdate(booking._id, {
          $push: { rides: ride._id },
          $set:  {
            primaryRide:                  ride._id,
            patientLocation:              pickupGeo,
            destinationLocation:          dropoffGeo,
            status:                       'confirmed',
            'fareBreakdown.transportFee': transportFee,
            updatedBy:                    req.user._id,
          },
        });

        // EMAIL → customer
        const customer = await User.findById(resolvedCustomerId).select('email name phone').lean();
        if (customer?.email) {
          sendEmail({
            email:   customer.email,
            subject: `Ride Arranged for You — Booking #${booking.bookingCode} | Likeson Healthcare`,
            html: transactionalTemplate({
              header:     'RIDE ARRANGED',
              title:      'Admin has arranged a ride for your booking',
              body: `
                A ride has been arranged for booking <strong>#${booking.bookingCode}</strong>.<br/>
                <strong>Pickup:</strong> ${pickupGeo.address || pickupGeo.label || 'As provided'}<br/>
                <strong>Drop:</strong> ${dropoffGeo.address || dropoffGeo.label || 'As provided'}<br/>
                <strong>Distance:</strong> ${+canonicalKm.toFixed(2)} km &nbsp;|&nbsp; ₹${transportFee}<br/>
                A driver will be assigned shortly.
              `,
              buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
              buttonText: 'Track Booking',
            }),
          }).catch(e => console.error('[AdminCareRide] customer email:', e.message));
        }

        // EMAIL → care assistant if applicable
        if (requesterType === 'care_assistant' && careAssistantId) {
          const ca     = await CareAssistantProfile.findById(careAssistantId).select('user').lean();
          const caUser = ca ? await User.findById(ca.user).select('email name').lean() : null;
          if (caUser?.email) {
            sendEmail({
              email:   caUser.email,
              subject: `Care Ride Confirmed — Booking #${booking.bookingCode} | Likeson Healthcare`,
              html: transactionalTemplate({
                header:     'CARE RIDE CONFIRMED',
                title:      'Admin confirmed your care ride request',
                body: `
                  The ride for your patient (booking <strong>#${booking.bookingCode}</strong>) has been confirmed by admin.<br/>
                  <strong>Pickup:</strong> ${pickupGeo.address || pickupGeo.label || 'As provided'}<br/>
                  <strong>Drop:</strong> ${dropoffGeo.address || dropoffGeo.label || 'As provided'}<br/>
                  <strong>Distance:</strong> ${+canonicalKm.toFixed(2)} km
                `,
                buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
                buttonText: 'View Booking',
              }),
            }).catch(e => console.error('[AdminCareRide] CA email:', e.message));
          }

          joinBookingRoom(ca.user, booking._id);
        }
        joinBookingRoom(booking.customer, booking._id);
      }

      // EMAIL → ops if no driver nearby
      if (noDriverNearby && booking) {
        emailNoDriverNearby(booking, {
          rideId: ride._id, requesterType, pickup: pickupGeo, destination: dropoffGeo,
          distKm: +canonicalKm.toFixed(2), transportFee, searchRadiusKm: 30,
        });
      }

      getBookingSocketService()?.emitToAdminOps('care_ride_requested', {
        bookingId: booking?._id, bookingCode: booking?.bookingCode, rideId: ride._id,
        requesterType, careAssistantId: careAssistantId || null,
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), ratePerKm, rateSource, transportFee,
        noDriverNearby, nearbyDriverCount: nearbyDrivers.length, nearbyTPCount: nearbyTPs.length,
        searchRadiusKm: 30, timestamp: new Date(),
      });

      await invalidateBookingCache();

      return res.json({
        success: true,
        message: noDriverNearby
          ? 'Care-ride created. No driver within 30km — assign manually.'
          : `Care-ride created. ${nearbyDrivers.length} driver(s) and ${nearbyTPs.length} TP(s) found nearby.`,
        data: {
          rideId: ride._id, requesterType, pickup: pickupGeo, destination: dropoffGeo,
          distKm: +canonicalKm.toFixed(2), durationMin, ratePerKm, rateSource, transportFee,
          noDriverNearby, searchRadiusKm: 30,
          nearbyDrivers: nearbyDrivers.map(d => ({
            driverId:   d._id,
            name:       d.legalName,
            phone:      d.phone,
            vehicle:    d.assignedVehicleSnapshot,
            rating:     d.performance?.rating,
            distanceKm: +haversineKm(pickupLocation.coordinates, d.location?.coordinates || [0, 0]).toFixed(1),
            type:       d.soloPartner ? 'solo' : 'agency',
          })),
          nearbyTPs: nearbyTPs.map(tp => ({
            tpId: tp._id, businessName: tp.businessName, ownerPhone: tp.ownerPhone,
            totalDrivers: tp.fleetInfo?.totalDrivers || 0,
          })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/care-ride/:bookingId/nearby',
  protect, authorize('admin', 'superadmin'),
  cache(30, req => `GET:/admin/care-ride/${req.params.bookingId}/nearby`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId).select('patientLocation customer').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;

      const [soloDrivers, agencyDrivers, tps] = await Promise.all([
        Driver.find({
          soloPartner: { $ne: null }, isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], careRadiusRad] } },
        })
          .populate('soloPartner', 'legalName phone vehicle partnershipStatus')
          .select('driverCode location performance assignedVehicleSnapshot').limit(15).lean(),

        Driver.find({
          ownerAgency: { $ne: null }, isActive: true, isVerified: true, isBlocked: false, status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], careRadiusRad] } },
        })
          .select('driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency').limit(15).lean(),

        TransportPartner.find({
          partnershipStatus: 'active', isAvailable: true,
          'serviceZones.city': { $regex: booking.patientLocation?.city || '', $options: 'i' },
        })
          .select('businessName ownerPhone fleetInfo serviceZones').limit(10).lean(),
      ]);

      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);

      return res.json({
        success: true,
        data: {
          searchRadiusKm: 30, ratePerKm, rateSource,
          soloDrivers: soloDrivers
            .filter(d => d.soloPartner?.partnershipStatus === 'active')
            .map(d => ({
              driverId:   d._id,
              name:       d.soloPartner?.legalName,
              phone:      d.soloPartner?.phone,
              vehicle:    d.assignedVehicleSnapshot,
              rating:     d.performance?.rating,
              distanceKm: +haversineKm(coords, d.location?.coordinates || [0, 0]).toFixed(1),
            })),
          agencyDrivers: agencyDrivers.map(d => ({
            driverId:   d._id,
            agencyId:   d.ownerAgency,
            name:       d.legalName,
            phone:      d.phone,
            vehicle:    d.assignedVehicleSnapshot,
            rating:     d.performance?.rating,
            distanceKm: +haversineKm(coords, d.location?.coordinates || [0, 0]).toFixed(1),
          })),
          transportPartners: tps.map(tp => ({
            tpId: tp._id, businessName: tp.businessName, ownerPhone: tp.ownerPhone,
            totalDrivers: tp.fleetInfo?.totalDrivers || 0, activeDrivers: tp.fleetInfo?.activeDrivers || 0,
          })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/:id/care/join-ride',

  protect,
  authorize(
    'careassistant'
  ),

  async (
    req,
    res
  ) => {

    try {

      const booking =
        await Booking
          .findById(
            req.params.id
          );

      if (!booking) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              'Booking not found',
          });
      }

      const ride =
        await Ride.findOne({

          booking:
            booking._id,

          status: {
            $in:
              RIDE_STATUSES_ACTIVE,
          },
        });

      if (!ride) {

        return res
          .status(404)
          .json({

            success: false,

            message:
              'Ride not active',
          });
      }

      ride.activeTarget =
        'hospital_drop';

      ride.currentLeg =
        'to_hospital';

      await ride.save();

      await RideTracking
        .findOneAndUpdate(

          {
            ride:
              ride._id,
          },

          {
            $set: {

              'liveRouteContext.activeTarget':
                'hospital_drop',

              careAssistantJoinedAt:
                new Date(),
            },
          }
        );

      getBookingSocketService()
        ?.emitToRoom(

          `care:${booking._id}`,

          'care_assistant_joined',

          {

            bookingId:
              booking._id,

            rideId:
              ride._id,

            activeTarget:
              'hospital_drop',
          }
        );

      return res.json({

        success: true,

        data: {
          ride,
        },
      });

    } catch (err) {

      return res
        .status(500)
        .json({

          success: false,

          message:
            err.message,
        });
    }
  }
);

export default router;