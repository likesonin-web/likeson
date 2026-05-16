/**
 * bookingRouter2.js — Likeson.in
 *
 * Routes: Driver (agency + solo), Customer ride request,
 *         Care assistant ride request, Admin care-ride management
 *
 * FIXES vs previous version:
 *  - 'care assistant' (space) → 'care_assistant' (underscore) everywhere
 *  - Ride.driver = Driver._id consistently (NOT User._id)
 *    - GET /driver/assigned: queries Ride by Driver._id (driverObjectId)
 *    - POST /:id/ride/end:   queries Ride by Driver._id
 *    - All ride creates set driver = Driver._id
 *  - POST /:id/ride/start REMOVED — OTP verify is socket-only (verify_otp event)
 *    HTTP /ride/start was a duplicate path causing race conditions
 *  - PATCH /:id/ride/arrived: OTP generated + sent to customer + admin notified
 *    via socket emitOtpToAdmin (raw OTP visible to admin:ops for support)
 *  - createAndLinkRide imported from shared (no duplication)
 *  - calculateCanonicalRoute imported from shared
 *  - GET /driver/assigned populates trackingId for canonical polyline
 *  - POST /:id/ride/end handles return ride with canonical route locked
 *  - PATCH /driver/location HTTP fallback: emits remainingKm to booking room
 *  - All authorize() calls use correct role strings (snake_case)
 */

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

import sendEmail                     from '../utils/sendEmail.js';
import sendSms                       from '../services/Sendsms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }   from '../services/bookingSocketService.js';
import { transactionalTemplate, otpTemplate } from '../utils/emailTemplates.js';
import {
  driverAssignedSms, rideStartedSms, rideCompletedSms,
  careAssistantAssignedSms, otpSms, newCareRequestToAssistantSms,
} from '../utils/Smstemplates.js';
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
  RIDE_STATUSES_ACTIVE,
  CARE_RIDE_RADIUS_M,
  syncBookingStatusFromRide,
} from './bookingRouterShared.js';

import cache       from '../middleware/cache.js';
import redisClient from '../config/redis.js';

const router = express.Router();

const CACHE_TTL = { nearby: 30, ops: 45 };

const invalidateBookingCache = async () => {
  try {
    const patterns = ['GET:/admin/bookings*', 'GET:/op/*'];
    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys.length) await redisClient.del(keys);
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

/**
 * sendOpZipEmail — fire-and-forget OP card email to patient.
 */
const sendOpZipEmail = async ({ op, booking, doctor, hospital, patient, followUps = [] }) => {
  try {
    const html = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zip  = await buildOpZipBuffer(html, op.opNumber);
    await sendEmail({
      email:   patient.email,
      subject: `Your OP Card — ${op.opNumber} | Likeson Healthcare`,
      html: opConfirmationEmailTemplate({
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

// ═════════════════════════════════════════════════════════════════════════════
// DRIVER ROUTES
//
// CRITICAL: Ride.driver = Driver._id (NOT User._id).
// GET /driver/assigned must query rides by Driver._id (driverObjectId).
// All ride creations in this file set driver = Driver._id.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/assigned
 * Returns active rides for the authenticated driver.
 *
 * FIX: Ride.driver = Driver._id. Must resolve Driver._id from User._id first,
 * then query Ride.driver = driverDoc._id (not req.user._id).
 */
router.get('/driver/assigned',
  protect,
  authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      // 1. Resolve Driver doc
      const driverDoc = await Driver.findOne({ user: req.user._id })
        .select('_id legalName driverCode status assignedVehicleSnapshot ownerAgency soloPartner')
        .lean();

      if (!driverDoc) {
        return res.status(404).json({ success: false, message: 'Driver profile not found. Contact admin.' });
      }

      // 2. Fetch active rides by Driver._id (driverDoc._id)
      const rides = await Ride.find({
        driver: driverDoc._id,          // ← Driver._id, NOT User._id
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
      console.error('[GET /driver/assigned]', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/ride/accept
// Driver accepts assigned ride.
// Ride.driver already = Driver._id (set at assignment time).
// Query uses Driver._id resolved from User._id.
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/:id/ride/accept',
  protect,
  authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      // Resolve Driver._id from User._id
      const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id assignedVehicleSnapshot phone legalName').lean();
      if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver profile not found' });

      const ride = await Ride.findOne({ booking: req.params.id, driver: driverDoc._id }); // ← Driver._id
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (ride.status !== 'driver_assigned') return res.status(400).json({ success: false, message: `Ride status is ${ride.status}, expected driver_assigned` });

      ride.status = 'driver_accepted';
      await ride.save();

      const booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      booking.status    = 'confirmed';
      booking.updatedBy = req.user._id;
      await booking.save();

      const customer   = await User.findById(booking.customer).select('email phone name').lean();
      const driverUser = await User.findById(req.user._id).select('name phone').lean();

      await createNotification({ recipient: booking.customer, title: 'Driver Accepted', body: `Driver ${driverDoc.legalName || driverUser.name} accepted your ride.`, type: 'Driver_Assigned', bookingId: booking._id });

      try {
        await sendSms({ to: customer.phone, message: driverAssignedSms({ userName: customer.name, rideId: booking.bookingCode, driverName: driverDoc.legalName || driverUser.name, vehicleNumber: driverDoc.assignedVehicleSnapshot?.registrationNumber || 'N/A', driverPhone: driverDoc.phone || driverUser.phone }) });
      } catch (e) { console.error('[Accept] SMS:', e.message); }

      // Fetch locked canonical polyline for map initialization
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
        // Canonical polyline same for all roles — locked at ride creation
        mapRoute: {
          polyline:         trackingDoc?.expectedRoutePolyline || null,
          pickupCoords:     ride.pickup?.coordinates,
          pickupAddress:    ride.pickup?.address,
          dropoffCoords:    ride.dropoff?.coordinates,
          dropoffAddress:   ride.dropoff?.address,
          estimatedDistKm:  ride.estimatedDistanceKm,
          estimatedMinutes: ride.estimatedDurationMin,
          currentTarget:    'pickup', // initially driver heads to pickup
        },
      });

      await invalidateBookingCache();
      return res.json({
        success: true, message: 'Ride accepted',
        data: {
          ride,
          driverInfo: { name: driverDoc.legalName || driverUser.name, phone: driverDoc.phone || driverUser.phone, vehicleNumber: driverDoc.assignedVehicleSnapshot?.registrationNumber || 'N/A' },
          customerInfo: { name: customer.name, phone: customer.phone },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/ride/reject
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/:id/ride/reject',
  protect,
  authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { reason } = req.body;

      const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
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

      // Track declined — capped at model level ($slice 50)
      await Ride.findByIdAndUpdate(ride._id, { $addToSet: { declinedDrivers: driverDoc._id } });

      const booking = await Booking.findById(req.params.id).select('bookingCode transportPartner').lean();
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/ride/arrived
// Driver arrived at pickup.
//
// FIX: OTP generated here, sent to customer via SMS/email/push.
//      Raw OTP also sent to admin:ops via socket emitOtpToAdmin for support.
//      OTP verify happens via socket verify_otp event (sole path).
//      HTTP /ride/start removed — it was a duplicate OTP verify path.
// ─────────────────────────────────────────────────────────────────────────────

 
router.patch('/:id/ride/arrived',
  protect,
  authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
      if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver profile not found' });

      const ride = await Ride.findOne({ booking: req.params.id, driver: driverDoc._id });
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['driver_accepted', 'driver_en_route'].includes(ride.status)) {
        return res.status(400).json({ success: false, message: `Cannot mark arrived from status: ${ride.status}` });
      }

      const otp      = genOtp(); // plain 4-digit string e.g. "4821"
      ride.status    = 'driver_arrived';
      ride.pickupOtp = otp;      // ← store RAW, no hash
      await ride.save();

      if (ride.trackingId) {
        RideTracking.addMilestone(ride._id, 'driver_arrived', {
          recordedBy: 'driver', recordedByUserId: req.user._id,
        }).catch(e => console.error('[Arrived] milestone:', e.message));
      }

      const booking  = await Booking.findById(req.params.id);
      const customer = await User.findById(booking.customer).select('email phone name').lean();

      // SMS to customer
      if (customer?.phone) {
        sendSms({
          to:      customer.phone,
          message: otpSms({ otpCode: otp, purpose: `ride start #${booking.bookingCode}` }),
        }).catch(e => console.error('[Arrived] OTP SMS:', e.message));
      }

      // Email to customer
     if (custUser?.email) {
  const { sendOtpEmail } = await import('../services/emailQueueService.js');
  sendOtpEmail(custUser.email, {
    rideId:  String(ride._id),
    otpCode,
    title:   'Your driver has arrived!',
    body:    'Share this OTP with your driver to start the ride.',
  }).catch(e => console.error('[arrived] queue OTP email:', e.message));
}

      // Push notification with OTP visible in-app
      await createNotification({
        recipient: booking.customer,
        title:     'Driver Arrived',
        body:      `Your driver arrived. Share OTP ${otp} to start your ride.`,
        type:      'Driver_Arrived',
        bookingId: booking._id,
        priority:  'High',
        otp,        // ← customer sees OTP in notification + live tracking
      });

      const ss = getBookingSocketService();

      ss?.emitToRoom(`booking:${booking._id}`, 'driver_arrived', {
        bookingId:     booking._id,
        currentTarget: 'pickup',
        otp,           // ← send OTP to booking room so live tracking screen shows it
      });
      ss?.emitToRoom(`booking:${booking._id}`, 'otp_required', { bookingId: booking._id, otp });

      // Admin:ops raw OTP for support
      ss?.emitOtpToAdmin({
        bookingId:     booking._id,
        bookingCode:   booking.bookingCode,
        rideId:        ride._id,
        otp,
        customerName:  customer.name,
        customerPhone: customer.phone,
      });

      console.log('[Arrived] OTP sent to customer:', otp);
      return res.json({ success: true, message: 'Arrival marked. OTP sent to customer via SMS, email and push.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: POST /:id/ride/start REMOVED
//
// OTP verification is now handled EXCLUSIVELY by the socket event verify_otp.
// That event:
//   1. Validates OTP hash
//   2. Sets Ride.status = 'otp_verified'
//   3. Updates Booking.status = 'in_progress'
//   4. Adds milestones (otp_verified, ride_started)
//   5. Emits navigation_target_changed → dropoff to ALL roles in booking room
//   6. Emits booking_status_change
//
// Having two paths (socket + HTTP) caused race conditions and duplicate
// RideTracking docs. Single-path socket is the correct Uber-pattern.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// POST /:id/ride/end
// Complete ride. If return ride exists and is pending, activate it with same driver.
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:id/ride/end',
  protect,
  authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { dropPhotoUrl, actualDistanceKm } = req.body;

      const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
      if (!driverDoc) return res.status(404).json({ success: false, message: 'Driver profile not found' });

      const ride = await Ride.findOne({ booking: req.params.id, driver: driverDoc._id }); // ← Driver._id
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['in_progress', 'at_stop'].includes(ride.status)) {
        return res.status(400).json({ success: false, message: `Cannot end ride from status: ${ride.status}` });
      }

      ride.status           = 'completed';
      ride.actualDistanceKm = actualDistanceKm || ride.estimatedDistanceKm || 0;
      if (dropPhotoUrl) ride.internalNotes = `dropPhoto:${dropPhotoUrl}`;
      await ride.save(); // pre-save sets rideCompletedAt

      // Compute final summary (distance, speed, stops, wait times)
      await RideTracking.computeSummary(ride._id).catch(() => {});
      if (ride.trackingId) {
        RideTracking.addMilestone(ride._id, 'ride_completed', {
          recordedBy: 'driver', recordedByUserId: req.user._id,
        }).catch(() => {});
      }

      const booking = await Booking.findById(req.params.id).populate('returnRide').lean();

      // ── Return ride activation ─────────────────────────────────────────────
      // If return ride exists and is not yet completed/cancelled,
      // assign same driver and lock canonical route for return leg.
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

          // Lock canonical polyline for return leg
          const retTracking = await RideTracking.create({
            ride:                  returnRide._id,
            booking:               booking._id,
            driver:                driverDoc._id,
            expectedRoutePolyline: retPolyline,
          });
          await Ride.findByIdAndUpdate(returnRide._id, { $set: { trackingId: retTracking._id } });

          // Tell all room parties: return ride activated, switch map to return route
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
            driverInfo: {
              name:  req.user.name,
              phone: req.user.phone,
            },
          });

          await Booking.findByIdAndUpdate(booking._id, {
            $set: { primaryRide: returnRide._id, updatedBy: req.user._id },
          });

          return res.json({
            success:  true,
            message:  'Outbound ride completed. Return ride activated — same driver.',
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
      bookingDoc.status    = 'completed';
      bookingDoc.updatedBy = req.user._id;
      await bookingDoc.save();
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
  // direct download URL — works regardless of whether patient knows opNumber
  actionUrl: opForLink
    ? `${process.env.BACKEND_URL}/api/bookings/op/${opForLink.opNumber}/download`
    : `${process.env.FRONTEND_URL}/bookings/${bookingDoc._id}`,
  deepLink: {
    screen:      opForLink ? 'OpDownload' : 'BookingDetail',
    referenceId: bookingDoc._id,
  },
});

      try { await sendSms({ to: customer.phone, message: rideCompletedSms({ userName: customer.name, rideId: bookingDoc.bookingCode, totalFare: bookingDoc.fareBreakdown?.totalAmount }) }); }
      catch (e) { console.error('[End] SMS:', e.message); }

      try {
        const pdfBuffer = await generateBookingInvoicePdf(bookingDoc);
        await sendEmail({
          email:   customer.email,
          subject: `Invoice — #${bookingDoc.bookingCode}`,
          html: transactionalTemplate({
            header: 'BOOKING COMPLETED', title: `Booking #${bookingDoc.bookingCode} complete!`,
            body: `Total: ₹${bookingDoc.fareBreakdown?.totalAmount}. Invoice attached.`,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${bookingDoc._id}/rate`,
            buttonText: 'Rate Your Experience',
          }),
          attachments: [{ content: pdfBuffer.toString('base64'), filename: `invoice-${bookingDoc.bookingCode}.pdf`, type: 'application/pdf', disposition: 'attachment' }],
        });
      } catch (e) { console.error('[End] Invoice email:', e.message); }

      // Send OP card if consultation booking
      if (['doctor_consultation', 'full_care_ride', 'follow_up', 'physiotherapist'].includes(bookingDoc.bookingType)) {
        const op       = await OutPatientRecord.findOne({ booking: bookingDoc._id }).lean();
        const doctor   = await DoctorProfile.findById(bookingDoc.doctor).populate('user', 'name').lean();
        const hospital = await Hospital.findById(bookingDoc.hospital).lean();
        const followUps = op ? await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean() : [];
        if (op) await sendOpZipEmail({ op, booking: bookingDoc, doctor, hospital, patient: customer, followUps });
      }

      const ss = getBookingSocketService();
      
      ss?.emitToRoom(`booking:${bookingDoc._id}`, 'ride_completed', { bookingId: bookingDoc._id, completedAt: ride.rideCompletedAt });
      ss?.emitToRoom(`booking:${bookingDoc._id}`, 'booking_status_change', { bookingId: bookingDoc._id, status: 'completed', timestamp: new Date() });

      await invalidateBookingCache();
      return res.json({ success: true, message: 'Ride completed', data: { booking: bookingDoc } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /driver/location — HTTP GPS fallback
// Use when socket connection unavailable. Primary GPS path is socket driver_location.
// FIX: also emits remainingKm + ETA estimate to booking room.
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/driver/location',
  protect,
  authorize('driver', 'solodriverpartner'),
  async (req, res) => {
    try {
      const { lat, lng, heading, speed, bookingId } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });

      // Update Driver geospatial location
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

            // Calculate remaining distance to current map target
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
// ═════════════════════════════════════════════════════════════════════════════

router.post('/:id/request-ride',
  protect,
  authorize('customer'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id, status: { $in: ['pending', 'confirmed'] } });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not yours' });

      const activeRide = await Ride.findOne({ booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE } });
      if (activeRide) return res.status(400).json({ success: false, message: 'Active ride already exists for this booking' });

      const [pLng, pLat] = pickupLocation.coordinates;
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(req.user._id);

      const { distanceKm: canonicalKm, durationMin, polyline } = await calculateCanonicalRoute(
        pickupLocation.coordinates, destinationLocation.coordinates,
      );
      const transportFee    = +(canonicalKm * ratePerKm).toFixed(2);
      const careRadiusRad   = CARE_RIDE_RADIUS_M / 1000 / 6378.1;
      const nearbyCount     = await Driver.countDocuments({
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

      const tracking = await RideTracking.create({ ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set:  { primaryRide: ride._id, patientLocation: pickupGeo, destinationLocation: dropoffGeo, 'fareBreakdown.transportFee': transportFee, updatedBy: req.user._id },
      });

      getBookingSocketService()?.emitToAdminOps('ride_requested_by_customer', {
        bookingId:       booking._id,
        bookingCode:     booking.bookingCode,
        rideId:          ride._id,
        customerId:      req.user._id,
        pickup:          pickupGeo,
        destination:     dropoffGeo,
        distKm:          +canonicalKm.toFixed(2),
        ratePerKm, rateSource, transportFee,
        noDriverNearby:  nearbyCount === 0,
        searchRadiusKm:  30,
        timestamp:       new Date(),
      });

      return res.json({
        success: true,
        message: nearbyCount === 0 ? 'Ride requested. No driver nearby — admin will assign.' : 'Ride requested. Admin assigning driver.',
        data: { rideId: ride._id, pickup: pickupGeo, destination: dropoffGeo, distKm: +canonicalKm.toFixed(2), durationMin, ratePerKm, rateSource, transportFee, searchRadiusKm: 30 },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT: request ride for patient
// FIX: authorize('care_assistant') — underscore
// ═════════════════════════════════════════════════════════════════════════════

router.post('/:id/care/request-ride',
  protect,
  authorize('care_assistant'), // FIX: was 'care assistant'
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id, status: { $in: ['confirmed', 'in_progress'] } });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      const activeRide = await Ride.findOne({ booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE } });
      if (activeRide) return res.status(400).json({ success: false, message: 'Active ride already exists' });

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

      const tracking = await RideTracking.create({ ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set:  { primaryRide: ride._id, patientLocation: pickupGeo, destinationLocation: dropoffGeo, 'fareBreakdown.transportFee': transportFee, updatedBy: req.user._id },
      });

      getBookingSocketService()?.emitToAdminOps('ride_requested_by_care_assistant', {
        bookingId: booking._id, bookingCode: booking.bookingCode, rideId: ride._id,
        careAssistantId: profile._id, careAssistantUser: req.user._id,
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), ratePerKm, rateSource, transportFee,
        noDriverNearby: nearbyCount === 0, searchRadiusKm: 30, timestamp: new Date(),
      });

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_requested', {
        bookingId: booking._id, requestedBy: 'care_assistant',
        pickup: pickupGeo, destination: dropoffGeo,
        distKm: +canonicalKm.toFixed(2), transportFee, timestamp: new Date(),
      });

      return res.json({
        success: true,
        message: nearbyCount === 0 ? 'Ride requested. No driver nearby — admin will assign.' : 'Ride requested. Admin assigning driver.',
        data: { rideId: ride._id, pickup: pickupGeo, destination: dropoffGeo, distKm: +canonicalKm.toFixed(2), durationMin, ratePerKm, rateSource, transportFee, searchRadiusKm: 30 },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN: care-ride request (on behalf of customer or care assistant)
// ═════════════════════════════════════════════════════════════════════════════

router.post('/admin/care-ride/request',
  protect,
  authorize('admin', 'superadmin'),
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

      let booking = bookingId ? await Booking.findById(bookingId) : null;
      let resolvedCustomerId = customerId;

      if (requesterType === 'care_assistant') {
        if (!careAssistantId)
          return res.status(400).json({ success: false, message: 'careAssistantId required for care_assistant requester' });

        const ca = await CareAssistantProfile.findById(careAssistantId).select('user fullName isActive verification').lean();
        if (!ca) return res.status(404).json({ success: false, message: 'Care assistant not found' });
        if (!ca.isActive || !ca.verification?.isVerified) return res.status(400).json({ success: false, message: 'Care assistant not active or verified' });
        if (!booking) return res.status(400).json({ success: false, message: 'bookingId required when care_assistant requests ride' });
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

      const tracking = await RideTracking.create({ ride: ride._id, booking: booking?._id || null, expectedRoutePolyline: polyline });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

      if (booking) {
        await Booking.findByIdAndUpdate(booking._id, {
          $push: { rides: ride._id },
          $set:  { primaryRide: ride._id, patientLocation: pickupGeo, destinationLocation: dropoffGeo, status: 'confirmed', 'fareBreakdown.transportFee': transportFee, updatedBy: req.user._id },
        });
        // Join relevant parties to booking room
        if (requesterType === 'care_assistant' && careAssistantId) {
          const ca = await CareAssistantProfile.findById(careAssistantId).select('user').lean();
          if (ca) joinBookingRoom(ca.user, booking._id);
        }
        joinBookingRoom(booking.customer, booking._id);
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
          nearbyTPs: nearbyTPs.map(tp => ({ tpId: tp._id, businessName: tp.businessName, ownerPhone: tp.ownerPhone, totalDrivers: tp.fleetInfo?.totalDrivers || 0 })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/care-ride/:bookingId/nearby
// Returns nearby drivers and TPs for admin to assign to a care-ride.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/care-ride/:bookingId/nearby',
  protect,
  authorize('admin', 'superadmin'),
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

export default router;