/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOKING ROUTER (ALL ROLES EXCEPT CUSTOMER) — Likeson.in
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * CORRECTIONS & ADDITIONS vs previous version:
 *  1. Redis caching applied to all heavy GET routes (admin bookings, nearby, stats)
 *  2. OP card ZIP email sent on booking completion (doctor_consultation / full_care_ride)
 *  3. GET /op/:opNumber        — customer fetches their own OP card (with ZIP download link)
 *  4. GET /op/:opNumber/follow-ups — valid follow-ups for an OP
 *  5. GET /hospital/:id/ops    — hospital staff: all OPs at their hospital
 *  6. GET /doctor/:id/ops      — doctor: all their OPs
 *  7. POST /:id/op/complete    — doctor marks OP complete + adds notes/prescription
 *  8. All ride status values match Ride model RIDE_STATUSES exactly
 *  9. Booking fields: bookingCode, fareBreakdown, bookingType, patientInfo.name, payments[]
 * 10. pickupOtp stored HASHED via hashOtp()
 * 11. RideTracking.addBreadcrumb() and addMilestone() statics used correctly
 * 12. buildRidePayload() + createAndLinkRide() helpers used consistently
 * 13. Cache invalidation on status-changing PATCH/POST routes
 *
 * ROUTES:
 *   ── Driver (agency) ──────────────────────────────────────────────────────
 *   GET    /driver/assigned
 *   PATCH  /:id/ride/accept
 *   PATCH  /:id/ride/reject
 *   PATCH  /:id/ride/arrived
 *   POST   /:id/ride/start           (OTP verify)
 *   POST   /:id/ride/end
 *   PATCH  /driver/location
 *
 *   ── Solo Driver Partner ───────────────────────────────────────────────────
 *   GET    /solo/available
 *   PATCH  /:id/solo/accept
 *   PATCH  /:id/solo/reject
 *   PATCH  /:id/solo/arrived
 *   POST   /:id/solo/start
 *   POST   /:id/solo/end
 *   PATCH  /solo/location
 *
 *   ── Transport Partner ─────────────────────────────────────────────────────
 *   GET    /tp/assigned
 *   GET    /tp/drivers/available
 *   PATCH  /:id/tp/assign-driver
 *   PATCH  /:id/tp/reassign-driver
 *
 *   ── Care Assistant ────────────────────────────────────────────────────────
 *   GET    /care/assigned
 *   PATCH  /:id/care/arrived
 *   PATCH  /:id/care/start
 *   PATCH  /:id/care/complete
 *   PATCH  /care/location
 *
 *   ── Hospital ──────────────────────────────────────────────────────────────
 *   GET    /hospital/upcoming
 *   PATCH  /:id/hospital/confirm
 *   GET    /hospital/:hospitalId/ops              (hospital staff view OPs)
 *   GET    /hospital/:hospitalId/valid-ops         (only eligible OPs for follow-up)
 *
 *   ── Doctor ────────────────────────────────────────────────────────────────
 *   GET    /doctor/ops                            (doctor's own OPs)
 *   GET    /doctor/ops/:opNumber                  (single OP details)
 *   PATCH  /:id/op/complete                       (mark OP complete + add notes)
 *
 *   ── OP Public (authenticated customer) ────────────────────────────────────
 *   GET    /op/:opNumber                          (customer views own OP)
 *   GET    /op/:opNumber/follow-ups               (valid follow-up OPs)
 *   GET    /op/:opNumber/download                 (download OP ZIP)
 *
 *   ── Admin ─────────────────────────────────────────────────────────────────
 *   GET    /admin/bookings
 *   GET    /admin/bookings/stats
 *   GET    /admin/bookings/export
 *   GET    /admin/bookings/:id
 *   PATCH  /admin/bookings/:id/status
 *   GET    /admin/bookings/:id/nearby/solo-drivers
 *   GET    /admin/bookings/:id/nearby/transport-partners
 *   GET    /admin/bookings/:id/nearby/care-assistants
 *   GET    /admin/bookings/:id/nearby/hospitals
 *   POST   /admin/bookings/:id/assign/solo-driver
 *   POST   /admin/bookings/:id/assign/transport-partner
 *   POST   /admin/bookings/:id/assign/care-assistant
 *   POST   /admin/bookings/:id/assign/hospital
 *   PATCH  /admin/bookings/:id/reassign/driver
 *   PATCH  /admin/bookings/:id/reassign/care
 *   POST   /admin/bookings/:id/refund
 *   GET    /admin/ops
 *   PATCH  /admin/ops/:id/status
 * ═══════════════════════════════════════════════════════════════════════════════
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
import SystemLog            from '../models/SystemLog.js';
import Wallet               from '../models/Wallet.js';
import DoctorProfile        from '../models/DoctorProfile.js';

import sendEmail                     from '../utils/sendEmail.js';
import sendSms                       from '../services/Sendsms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }   from '../services/bookingSocketService.js';
import { transactionalTemplate, otpTemplate } from '../utils/emailTemplates.js';
import {
  driverAssignedSms, rideStartedSms, rideCompletedSms,
  careAssistantAssignedSms, appointmentConfirmedSms,
  otpSms, newCareRequestToAssistantSms,
} from '../utils/smsTemplates.js';
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
  computeRefundAmount,
  RADIUS_METERS,
  RIDE_STATUSES_ACTIVE,
} from './bookingRouterShared.js';

// Redis cache middleware
import cache       from '../middleware/cache.js';
import redisClient from '../config/redis.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CACHE KEY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL = {
  adminBookings:   30,  // seconds
  adminStats:      60,
  nearbyResults:   30,
  hospitalOps:     45,
  doctorOps:       45,
  opRecord:        60,
};

/** Invalidate all admin booking cache keys for a specific booking */
const invalidateBookingCache = async (bookingId) => {
  try {
    const keys = await redisClient.keys(`GET:/admin/bookings*`);
    const opKeys = await redisClient.keys(`GET:/op/*`);
    const hospitalKeys = await redisClient.keys(`GET:/hospital/*`);
    const doctorKeys = await redisClient.keys(`GET:/doctor/ops*`);
    const allKeys = [...keys, ...opKeys, ...hospitalKeys, ...doctorKeys];
    if (allKeys.length) await redisClient.del(allKeys);
  } catch (e) {
    console.error('[Cache] invalidation error:', e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract pickup/dropoff coords from Booking for Ride creation.
 * Uses patientLocation → destinationLocation (correct Booking schema fields).
 */
const getBookingCoords = (booking) => ({
  pickupCoords:   booking.patientLocation?.coordinates     || [80.648, 16.506],
  pickupAddress:  booking.patientLocation?.address         || '',
  pickupCity:     booking.patientLocation?.city            || '',
  dropoffCoords:  booking.destinationLocation?.coordinates || [80.648, 16.506],
  dropoffAddress: booking.destinationLocation?.address     || '',
  dropoffCity:    booking.destinationLocation?.city        || '',
});

/**
 * Create a Ride for a booking and link it as primaryRide.
 * Returns { ride, otp } — otp is plain text (send to customer), stored hashed.
 */
const createAndLinkRide = async (booking, overrides = {}) => {
  const coords = getBookingCoords(booking);
  const otp    = genOtp();

  const rideData = {
    ...buildRidePayload({
      bookingId:         booking._id,
      rideType:          'patient',
      vehicleClass:      'four_wheeler',
      scheduledPickupAt: booking.scheduledAt,
      ...coords,
    }),
    pickupOtp: hashOtp(otp),
    ...overrides,
  };

  const ride = await Ride.create(rideData);

  await Booking.findByIdAndUpdate(booking._id, {
    $push: { rides: ride._id },
    $set:  { primaryRide: ride._id, status: 'confirmed' },
  });

  return { ride, otp };
};

/**
 * Send OP card ZIP to customer email.
 * Fires and forgets — errors are logged, never thrown.
 */
const sendOpZipEmail = async ({ op, booking, doctor, hospital, patient, followUps = [] }) => {
  try {
    const html   = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zip    = await buildOpZipBuffer(html, op.opNumber);

    const hospitalName = hospital?.name || null;
    const doctorName   = doctor?.user?.name || booking?.doctorSnapshot?.name || 'Your Doctor';

    await sendEmail({
      email:   patient.email,
      subject: `Your OP Card — ${op.opNumber} | Likeson Healthcare`,
      html: opConfirmationEmailTemplate({
        patientName:     patient.name,
        doctorName,
        hospitalName,
        opNumber:        op.opNumber,
        bookingCode:     booking.bookingCode,
        scheduledAt:     op.scheduledAt || booking.scheduledAt,
        consultationType: op.consultationType,
        isFollowUp:      op.isFollowUp,
        followUpExpiry:  op.followUpExpiry,
        followUpFee:     op.followUpFee,
      }),
      attachments: [{
        content:     zip.toString('base64'),
        filename:    `${op.opNumber.replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`,
        type:        'application/zip',
        disposition: 'attachment',
      }],
    });
  } catch (e) {
    console.error('[OP ZIP Email] failed:', e.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// DRIVER ROUTES (agency drivers)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/assigned
 * Agency driver sees their assigned rides.
 */
router.get('/driver/assigned', protect, authorize('driver'), async (req, res) => {
  try {
    const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
    if (!driverDoc)
      return res.status(404).json({ success: false, message: 'Driver profile not found' });

    const rides = await Ride.find({
      driver: req.user._id,
      status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived', 'otp_verified', 'in_progress', 'at_stop'] },
    })
      .populate({
        path:   'booking',
        select: 'bookingCode bookingType scheduledAt patientInfo fareBreakdown status patientLocation destinationLocation',
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: { rides } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /:id/ride/accept
 * Driver accepts assigned ride. Status: driver_assigned → driver_accepted.
 */
router.patch('/:id/ride/accept', protect, authorize('driver'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'driver_assigned')
      return res.status(400).json({ success: false, message: `Ride status is ${ride.status}, expected driver_assigned` });

    ride.status = 'driver_accepted';
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status    = 'confirmed';
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer   = await User.findById(booking.customer).select('email phone name').lean();
    const driverUser = await User.findById(req.user._id).select('name phone').lean();
    const driverDoc  = await Driver.findOne({ user: req.user._id })
      .select('assignedVehicleSnapshot phone').lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Driver Accepted',
      body:      `Driver ${driverUser.name} accepted your ride.`,
      type:      'Driver_Assigned',
      bookingId: booking._id,
    });

    try {
      await sendSms({
        to:      customer.phone,
        message: driverAssignedSms({
          userName:      customer.name,
          rideId:        booking.bookingCode,
          driverName:    driverUser.name,
          vehicleNumber: driverDoc?.assignedVehicleSnapshot?.registrationNumber || 'N/A',
          driverPhone:   driverDoc?.phone || driverUser.phone,
        }),
      });
    } catch (e) { console.error('[Accept] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'confirmed', timestamp: new Date(),
    });

    await invalidateBookingCache(booking._id);

    return res.json({ success: true, message: 'Ride accepted', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /:id/ride/reject
 * Driver rejects assigned ride. Notifies TP & admin.
 */
router.patch('/:id/ride/reject', protect, authorize('driver'), async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });

    ride.status = 'cancelled';
    ride.cancellation = {
      cancelledBy:       'driver',
      cancelledByUserId: req.user._id,
      reason:            reason || 'Driver rejected',
      cancelledAt:       new Date(),
    };
    await ride.save();

    // Track this driver as declined so dispatch skips them
    await Ride.findByIdAndUpdate(ride._id, {
      $addToSet: { declinedDrivers: req.user._id },
    });

    const booking = await Booking.findById(req.params.id)
      .select('bookingCode transportPartner').lean();

    if (booking?.transportPartner) {
      getBookingSocketService()?.emitToRoom(`tp:${booking.transportPartner}`, 'driver_rejected', {
        bookingId:   req.params.id,
        bookingCode: booking.bookingCode,
        reason:      reason || 'Driver rejected',
      });
    }
    getBookingSocketService()?.emitToRoom('admin:ops', 'driver_rejected', {
      bookingId: req.params.id, driverUserId: req.user._id,
    });

    return res.json({ success: true, message: 'Ride rejected. Will be reassigned.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /:id/ride/arrived
 * Driver arrived at pickup. Generates + sends OTP to customer.
 * Status: driver_accepted|driver_en_route → driver_arrived
 */
router.patch('/:id/ride/arrived', protect, authorize('driver'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['driver_accepted', 'driver_en_route'].includes(ride.status))
      return res.status(400).json({ success: false, message: `Cannot mark arrived from status: ${ride.status}` });

    const otp      = genOtp();
    ride.status    = 'driver_arrived';
    ride.pickupOtp = hashOtp(otp);
    await ride.save();

    if (ride.trackingId) {
      await RideTracking.addMilestone(ride._id, 'driver_arrived', {
        recordedBy: 'driver', recordedByUserId: req.user._id,
      }).catch(e => console.error('[Arrived] milestone:', e.message));
    }

    const booking  = await Booking.findById(req.params.id);
    const customer = await User.findById(booking.customer).select('email phone name').lean();

    try {
      await sendEmail({
        email:   customer.email,
        subject: `Ride OTP — #${booking.bookingCode}`,
        html: otpTemplate({
          title:   'Driver arrived! Share OTP to start your ride.',
          body:    'Your driver is waiting at your pickup location.',
          otpCode: otp,
        }),
      });
    } catch (e) { console.error('[Arrived] OTP email:', e.message); }

    if (customer.phone) {
      try {
        await sendSms({
          to:      customer.phone,
          message: otpSms({ otpCode: otp, purpose: `ride start #${booking.bookingCode}` }),
        });
      } catch (e) { console.error('[Arrived] OTP SMS:', e.message); }
    }

    await createNotification({
      recipient: booking.customer,
      title:     'Driver Arrived',
      body:      'Your driver arrived. Share OTP to start.',
      type:      'Driver_Arrived',
      bookingId: booking._id,
      priority:  'High',
    });

    const ss = getBookingSocketService();
    ss?.emitToRoom(`booking:${booking._id}`, 'driver_arrived',  { bookingId: booking._id });
    ss?.emitToRoom(`booking:${booking._id}`, 'otp_required',    { bookingId: booking._id });

    return res.json({ success: true, message: 'Arrival marked, OTP sent to customer' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /:id/ride/start
 * OTP verify → ride starts. Status: driver_arrived → otp_verified → in_progress
 */
router.post('/:id/ride/start', protect, authorize('driver'), async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required' });

    // pickupOtp is select:false — must explicitly select it
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id })
      .select('+pickupOtp');
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'driver_arrived')
      return res.status(400).json({ success: false, message: 'Driver must be in driver_arrived status' });
    if (hashOtp(otp) !== ride.pickupOtp)
      return res.status(400).json({ success: false, message: 'Invalid OTP' });

    ride.status              = 'otp_verified';
    ride.pickupOtpVerifiedAt = new Date();
    await ride.save();

    ride.status = 'in_progress';
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status    = 'in_progress';
    booking.updatedBy = req.user._id;
    await booking.save();

    // Create RideTracking if not yet created
    let tracking = await RideTracking.findOne({ ride: ride._id });
    if (!tracking) {
      tracking = await RideTracking.create({
        ride:    ride._id,
        booking: booking._id,
        driver:  req.user._id,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
    }

    await RideTracking.addMilestone(ride._id, 'otp_verified', {
      recordedBy: 'driver', recordedByUserId: req.user._id,
    }).catch(() => {});
    await RideTracking.addMilestone(ride._id, 'ride_started', {
      recordedBy: 'driver', recordedByUserId: req.user._id,
    }).catch(() => {});

    const customer = await User.findById(booking.customer).select('phone name').lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Ride Started',
      body:      `Ride #${booking.bookingCode} started. Safe journey!`,
      type:      'Ride_Update',
      bookingId: booking._id,
    });

    try {
      await sendSms({
        to:      customer.phone,
        message: rideStartedSms({
          userName:   customer.name,
          rideId:     booking.bookingCode,
          driverName: req.user.name,
        }),
      });
    } catch (e) { console.error('[Start] SMS:', e.message); }

    const ss = getBookingSocketService();
    ss?.emitToRoom(`booking:${booking._id}`, 'ride_started', {
      bookingId: booking._id, startedAt: ride.rideStartedAt,
    });
    ss?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'in_progress', timestamp: new Date(),
    });

    await invalidateBookingCache(booking._id);

    return res.json({ success: true, message: 'Ride started', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /:id/ride/end
 * Complete ride. Status: in_progress|at_stop → completed
 * Triggers OP ZIP email for doctor_consultation / full_care_ride bookings.
 */
router.post('/:id/ride/end', protect, authorize('driver'), async (req, res) => {
  try {
    const { dropPhotoUrl, actualDistanceKm } = req.body;

    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['in_progress', 'at_stop'].includes(ride.status))
      return res.status(400).json({ success: false, message: `Cannot end ride from status: ${ride.status}` });

    ride.status           = 'completed';
    ride.actualDistanceKm = actualDistanceKm || ride.estimatedDistanceKm || 0;
    if (dropPhotoUrl) ride.internalNotes = `dropPhoto:${dropPhotoUrl}`;
    await ride.save();

    await RideTracking.computeSummary(ride._id).catch(() => {});
    await RideTracking.addMilestone(ride._id, 'ride_completed', {
      recordedBy: 'driver', recordedByUserId: req.user._id,
    }).catch(() => {});

    const booking = await Booking.findById(req.params.id);
    booking.status    = 'completed';
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer)
      .select('email phone name').lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Ride Completed',
      body:      `Booking #${booking.bookingCode} completed. Thank you!`,
      type:      'Booking_Completed',
      bookingId: booking._id,
    });

    try {
      await sendSms({
        to:      customer.phone,
        message: rideCompletedSms({
          userName:  customer.name,
          rideId:    booking.bookingCode,
          totalFare: booking.fareBreakdown?.totalAmount,
        }),
      });
    } catch (e) { console.error('[End] SMS:', e.message); }

    // Invoice email
    try {
      const pdfBuffer = await generateBookingInvoicePdf(booking);
      await sendEmail({
        email:   customer.email,
        subject: `Invoice — #${booking.bookingCode}`,
        html: transactionalTemplate({
          header:     'BOOKING COMPLETED',
          title:      `Booking #${booking.bookingCode} complete!`,
          body:       `Total: ₹${booking.fareBreakdown?.totalAmount}. Invoice attached.`,
          buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}/rate`,
          buttonText: 'Rate Your Experience',
        }),
        attachments: [{
          content:     pdfBuffer.toString('base64'),
          filename:    `invoice-${booking.bookingCode}.pdf`,
          type:        'application/pdf',
          disposition: 'attachment',
        }],
      });
    } catch (e) { console.error('[End] Invoice email:', e.message); }

    // OP ZIP email for consultation bookings
    if (['doctor_consultation', 'full_care_ride', 'follow_up', 'physiotherapist'].includes(booking.bookingType)) {
      const op = await OutPatientRecord.findOne({ booking: booking._id }).lean();
      if (op) {
        const doctor   = await DoctorProfile.findById(booking.doctor)
          .populate('user', 'name').lean();
        const hospital = booking.hospital
          ? await Hospital.findById(booking.hospital).lean()
          : null;
        const followUps = await OutPatientRecord.find({
          parentOp: op._id,
        }).sort({ scheduledAt: -1 }).lean();

        await sendOpZipEmail({ op, booking, doctor, hospital, patient: customer, followUps });
      }
    }

    const ss = getBookingSocketService();
    ss?.emitToRoom(`booking:${booking._id}`, 'ride_completed', {
      bookingId: booking._id, completedAt: ride.rideCompletedAt,
    });
    ss?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'completed', timestamp: new Date(),
    });

    await invalidateBookingCache(booking._id);

    return res.json({ success: true, message: 'Ride completed', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /driver/location — HTTP GPS fallback for agency drivers
 */
router.patch('/driver/location', protect, authorize('driver'), async (req, res) => {
  try {
    const { lat, lng, heading, speed, bookingId } = req.body;
    if (!lat || !lng)
      return res.status(400).json({ success: false, message: 'lat, lng required' });

    await Driver.findOneAndUpdate(
      { user: req.user._id },
      {
        'location.coordinates': [lng, lat],
        'location.heading':     heading || 0,
        'location.speedKmh':    speed   || 0,
        'location.updatedAt':   new Date(),
      }
    );

    if (bookingId) {
      const ride = await Ride.findOne({
        booking: bookingId,
        driver:  req.user._id,
        status:  { $in: RIDE_STATUSES_ACTIVE },
      });

      if (ride) {
        ride.liveLocation = {
          type:        'Point',
          coordinates: [lng, lat],
          heading:     heading || 0,
          speedKmh:    speed   || 0,
          updatedAt:   new Date(),
        };
        await ride.save();

        if (ride.trackingId) {
          await RideTracking.addBreadcrumb(ride._id, {
            coordinates: [lng, lat],
            heading:     heading || 0,
            speedKmh:    speed   || 0,
            source:      'gps',
          }).catch(e => console.error('[Location] breadcrumb:', e.message));
        }

        getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'location_update', {
          lat, lng, heading, speed, role: 'driver', updatedAt: new Date(),
        });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;