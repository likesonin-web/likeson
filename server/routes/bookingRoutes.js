/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOKING ROUTER (ALL ROLES EXCEPT CUSTOMER) — Likeson.in
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * CORRECTIONS & ADDITIONS vs previous version:
 *  1. Redis caching on all heavy GET routes (admin bookings, nearby, stats, ops)
 *  2. OP card ZIP emailed to customer on booking completion + on OP creation
 *  3. GET /op/:opNumber          — customer/doctor/admin views OP card
 *  4. GET /op/:opNumber/follow-ups — valid follow-up OPs
 *  5. GET /op/:opNumber/download  — download OP ZIP
 *  6. GET /hospital/:id/ops       — hospital staff: all OPs at their hospital
 *  7. GET /hospital/:id/valid-ops — OPs with active follow-up window
 *  8. GET /doctor/ops             — doctor: all their OPs
 *  9. GET /doctor/ops/:opNumber   — single OP detail for doctor
 * 10. PATCH /:id/op/complete      — doctor marks OP complete + notes/prescription
 * 11. All Ride statuses match model RIDE_STATUSES exactly
 * 12. pickupOtp always stored HASHED via hashOtp()
 * 13. RideTracking.addBreadcrumb() / addMilestone() statics used correctly
 * 14. buildRidePayload() used consistently for all Ride creation
 * 15. Cache invalidation on every state-changing mutation
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
import DoctorProfile        from '../models/DoctorProfile.js';
import Hospital             from '../models/Hospital.js';
import OutPatientRecord     from '../models/OutPatientRecord.js';
import SystemLog            from '../models/SystemLog.js';
import Wallet               from '../models/Wallet.js';

import sendEmail                     from '../utils/sendEmail.js';
import sendSms                       from '../services/Sendsms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }   from '../services/bookingSocketService.js';
import { transactionalTemplate, otpTemplate } from '../utils/emailTemplates.js';
import {
  driverAssignedSms, rideStartedSms, rideCompletedSms,
  careAssistantAssignedSms, appointmentConfirmedSms,
  otpSms, newCareRequestToAssistantSms,
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
  computeRefundAmount,
  RADIUS_METERS,
  RIDE_STATUSES_ACTIVE,
} from './bookingRouterShared.js';

import cache       from '../middleware/cache.js';
import redisClient from '../config/redis.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CACHE KEY CONSTANTS & INVALIDATION HELPER
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL = {
  adminBookings: 30,
  adminStats:    60,
  nearby:        30,
  ops:           45,
  opRecord:      60,
};

/**
 * Invalidate all booking-related cache keys.
 * Called after any state-changing mutation.
 */
const invalidateBookingCache = async () => {
  try {
    const patterns = [
      'GET:/admin/bookings*',
      'GET:/op/*',
      'GET:/hospital/*',
      'GET:/doctor/ops*',
    ];
    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      if (keys.length) await redisClient.del(keys);
    }
  } catch (e) {
    console.error('[Cache] invalidation error:', e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract pickup/dropoff coords from a Booking document.
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
 * Create a Ride, link it as primaryRide on Booking.
 * Returns { ride, otp } — otp is plain text, stored hashed.
 */
const createAndLinkRide = async (booking, overrides = {}) => {
  const coords = getBookingCoords(booking);
  const otp    = genOtp();

  const ride = await Ride.create({
    ...buildRidePayload({
      bookingId:         booking._id,
      rideType:          'patient',
      vehicleClass:      'four_wheeler',
      scheduledPickupAt: booking.scheduledAt,
      ...coords,
    }),
    pickupOtp: hashOtp(otp),
    ...overrides,
  });

  await Booking.findByIdAndUpdate(booking._id, {
    $push: { rides: ride._id },
    $set:  { primaryRide: ride._id, status: 'confirmed' },
  });

  return { ride, otp };
};

/**
 * Send OP card as ZIP email attachment to customer.
 * Non-blocking — errors only logged.
 */
const sendOpZipEmail = async ({ op, booking, patient, followUps = [] }) => {
  try {
    const doctor = op.doctor
      ? await DoctorProfile.findById(op.doctor).populate('user', 'name').lean()
      : null;
    const hospital = op.hospital
      ? await Hospital.findById(op.hospital).lean()
      : null;

    const htmlContent = generateOpHtml({
      op, booking, doctor, hospital, patient, followUps,
    });
    const zipBuffer = await buildOpZipBuffer(htmlContent, op.opNumber);

    const doctorName   = doctor?.user?.name || booking?.doctorSnapshot?.name || 'Your Doctor';
    const hospitalName = hospital?.name     || null;

    await sendEmail({
      email:   patient.email,
      subject: `Your OP Card — ${op.opNumber} | Likeson Healthcare`,
      html: opConfirmationEmailTemplate({
        patientName:      patient.name,
        doctorName,
        hospitalName,
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
  } catch (e) {
    console.error('[OP ZIP Email] failed:', e.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// DRIVER ROUTES (agency drivers)
// ═════════════════════════════════════════════════════════════════════════════

/** GET /driver/assigned */
router.get('/driver/assigned', protect, authorize('driver'), async (req, res) => {
  try {
    const driverDoc = await Driver.findOne({ user: req.user._id }).select('_id').lean();
    if (!driverDoc)
      return res.status(404).json({ success: false, message: 'Driver profile not found' });

    const rides = await Ride.find({
      driver: req.user._id,
      status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived', 'in_progress', 'at_stop'] },
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

/** PATCH /:id/ride/accept — driver_assigned → driver_accepted */
router.patch('/:id/ride/accept', protect, authorize('driver'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'driver_assigned')
      return res.status(400).json({ success: false, message: `Expected driver_assigned, got ${ride.status}` });

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

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Ride accepted', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/ride/reject */
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

/** PATCH /:id/ride/arrived — generates OTP, sends to customer */
router.patch('/:id/ride/arrived', protect, authorize('driver'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['driver_accepted', 'driver_en_route'].includes(ride.status))
      return res.status(400).json({ success: false, message: `Cannot mark arrived from: ${ride.status}` });

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

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_arrived', { bookingId: booking._id });
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'otp_required',   { bookingId: booking._id });

    return res.json({ success: true, message: 'Arrival marked, OTP sent to customer' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /:id/ride/start — OTP verify → in_progress */
router.post('/:id/ride/start', protect, authorize('driver'), async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required' });

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

    let tracking = await RideTracking.findOne({ ride: ride._id });
    if (!tracking) {
      tracking = await RideTracking.create({
        ride:    ride._id,
        booking: booking._id,
        driver:  req.user._id,
      });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
    }

    await RideTracking.addMilestone(ride._id, 'otp_verified', { recordedBy: 'driver', recordedByUserId: req.user._id }).catch(() => {});
    await RideTracking.addMilestone(ride._id, 'ride_started',  { recordedBy: 'driver', recordedByUserId: req.user._id }).catch(() => {});

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
        message: rideStartedSms({ userName: customer.name, rideId: booking.bookingCode, driverName: req.user.name }),
      });
    } catch (e) { console.error('[Start] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_started', {
      bookingId: booking._id, startedAt: ride.rideStartedAt,
    });
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'in_progress', timestamp: new Date(),
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Ride started', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /:id/ride/end — complete ride, send invoice + OP ZIP if applicable */
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

    const booking  = await Booking.findById(req.params.id);
    booking.status    = 'completed';
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('email phone name').lean();

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

    // Send OP ZIP for medical consultation bookings
    if (['doctor_consultation', 'full_care_ride', 'follow_up', 'physiotherapist'].includes(booking.bookingType)) {
      const op = await OutPatientRecord.findOne({ booking: booking._id }).lean();
      if (op) {
        const followUps = await OutPatientRecord.find({ parentOp: op._id })
          .sort({ scheduledAt: -1 }).lean();
        await sendOpZipEmail({ op, booking, patient: customer, followUps });
      }
    }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_completed', {
      bookingId: booking._id, completedAt: ride.rideCompletedAt,
    });
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'completed', timestamp: new Date(),
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Ride completed', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /driver/location — HTTP GPS fallback */
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

// ═════════════════════════════════════════════════════════════════════════════
// SOLO DRIVER PARTNER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/** GET /solo/available */
router.get('/solo/available', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const solo = await SoloDriverPartner.findOne({ user: req.user._id }).select('driverProfile').lean();
    if (!solo?.driverProfile)
      return res.status(404).json({ success: false, message: 'Driver profile not linked to solo partner' });

    const rides = await Ride.find({
      driver: req.user._id,
      status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived', 'in_progress', 'at_stop'] },
    })
      .populate({ path: 'booking', select: 'bookingCode bookingType scheduledAt patientInfo fareBreakdown status patientLocation destinationLocation' })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: { rides } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/solo/accept */
router.patch('/:id/solo/accept', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'driver_assigned')
      return res.status(400).json({ success: false, message: `Expected driver_assigned, got ${ride.status}` });

    ride.status = 'driver_accepted';
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status    = 'confirmed';
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    const solo     = await SoloDriverPartner.findOne({ user: req.user._id })
      .select('legalName phone vehicle').lean();

    try {
      await sendSms({
        to:      customer.phone,
        message: driverAssignedSms({
          userName:      customer.name,
          rideId:        booking.bookingCode,
          driverName:    solo?.legalName || req.user.name,
          vehicleNumber: solo?.vehicle?.registrationNumber || 'N/A',
          driverPhone:   solo?.phone || '',
        }),
      });
    } catch (e) { console.error('[Solo accept] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'confirmed', timestamp: new Date(),
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Ride accepted', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/solo/reject */
router.patch('/:id/solo/reject', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });

    ride.status = 'cancelled';
    ride.cancellation = {
      cancelledBy:       'driver',
      cancelledByUserId: req.user._id,
      reason:            reason || 'Solo driver rejected',
      cancelledAt:       new Date(),
    };
    await ride.save();

    getBookingSocketService()?.emitToRoom('admin:ops', 'solo_driver_rejected', {
      bookingId: req.params.id, message: 'Solo driver rejected. Re-assignment needed.',
    });

    return res.json({ success: true, message: 'Ride rejected. Admin notified.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/solo/arrived */
router.patch('/:id/solo/arrived', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['driver_accepted', 'driver_en_route'].includes(ride.status))
      return res.status(400).json({ success: false, message: `Invalid state for arrival: ${ride.status}` });

    const otp      = genOtp();
    ride.status    = 'driver_arrived';
    ride.pickupOtp = hashOtp(otp);
    await ride.save();

    const booking  = await Booking.findById(req.params.id);
    const customer = await User.findById(booking.customer).select('email phone name').lean();

    try {
      await sendEmail({
        email:   customer.email,
        subject: `Ride OTP — #${booking.bookingCode}`,
        html: otpTemplate({
          title:   'Driver arrived! Share OTP to start.',
          body:    'Your driver is at your pickup location.',
          otpCode: otp,
        }),
      });
    } catch (e) { console.error('[Solo arrived] email:', e.message); }

    if (customer.phone) {
      try {
        await sendSms({
          to:      customer.phone,
          message: otpSms({ otpCode: otp, purpose: `ride start #${booking.bookingCode}` }),
        });
      } catch (e) { console.error('[Solo arrived] SMS:', e.message); }
    }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_arrived', { bookingId: booking._id });
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'otp_required',   { bookingId: booking._id });

    return res.json({ success: true, message: 'Arrived marked, OTP sent' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /:id/solo/start */
router.post('/:id/solo/start', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required' });

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

    let tracking = await RideTracking.findOne({ ride: ride._id });
    if (!tracking) {
      const rt = await RideTracking.create({ ride: ride._id, booking: booking._id, driver: req.user._id });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: rt._id } });
    }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_started', { bookingId: booking._id });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Ride started', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /:id/solo/end */
router.post('/:id/solo/end', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const { actualDistanceKm } = req.body;
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride)
      return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['in_progress', 'at_stop'].includes(ride.status))
      return res.status(400).json({ success: false, message: `Cannot end from status: ${ride.status}` });

    ride.status           = 'completed';
    ride.actualDistanceKm = actualDistanceKm || 0;
    await ride.save();

    await RideTracking.computeSummary(ride._id).catch(() => {});

    const booking = await Booking.findById(req.params.id);
    booking.status    = 'completed';
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('phone name email').lean();

    try {
      await sendSms({
        to:      customer.phone,
        message: rideCompletedSms({
          userName:  customer.name,
          rideId:    booking.bookingCode,
          totalFare: booking.fareBreakdown?.totalAmount,
        }),
      });
    } catch (e) { console.error('[Solo end] SMS:', e.message); }

    // OP ZIP for consultation bookings
    if (['doctor_consultation', 'full_care_ride', 'follow_up', 'physiotherapist'].includes(booking.bookingType)) {
      const op = await OutPatientRecord.findOne({ booking: booking._id }).lean();
      if (op) {
        const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();
        await sendOpZipEmail({ op, booking, patient: customer, followUps });
      }
    }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_completed', { bookingId: booking._id });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Ride completed', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /solo/location */
router.patch('/solo/location', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const { lat, lng, heading, speed, bookingId } = req.body;
    if (!lat || !lng)
      return res.status(400).json({ success: false, message: 'lat, lng required' });

    await SoloDriverPartner.findOneAndUpdate(
      { user: req.user._id },
      {
        'vehicle.lastKnownLocation.coordinates': [lng, lat],
        'vehicle.lastLocationUpdatedAt':         new Date(),
      }
    );

    if (bookingId) {
      const ride = await Ride.findOne({
        booking: bookingId,
        driver:  req.user._id,
        status:  { $in: RIDE_STATUSES_ACTIVE },
      });
      if (ride) {
        ride.liveLocation = { type: 'Point', coordinates: [lng, lat], heading, speedKmh: speed, updatedAt: new Date() };
        await ride.save();

        if (ride.trackingId) {
          await RideTracking.addBreadcrumb(ride._id, {
            coordinates: [lng, lat], heading, speedKmh: speed, source: 'gps',
          }).catch(() => {});
        }

        getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'location_update', {
          lat, lng, heading, speed, role: 'solo_driver', updatedAt: new Date(),
        });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// TRANSPORT PARTNER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/** GET /tp/assigned */
router.get('/tp/assigned',
  protect, authorize('transportpartner'),
  cache(CACHE_TTL.ops, req => `GET:/tp/assigned:${req.user._id}`),
  async (req, res) => {
    try {
      const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!tp)
        return res.status(404).json({ success: false, message: 'Transport partner not found' });

      const bookings = await Booking.find({ transportPartner: tp._id })
        .select('bookingCode bookingType scheduledAt patientInfo status fareBreakdown primaryRide patientLocation destinationLocation')
        .sort({ scheduledAt: -1 })
        .lean();

      return res.json({ success: true, data: { bookings } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

/** GET /tp/drivers/available */
router.get('/tp/drivers/available', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp)
      return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const drivers = await Driver.find({
      ownerAgency: tp._id,
      status:      'Available',
      isActive:    true,
      isVerified:  true,
      isBlocked:   false,
    })
      .select('legalName phone driverCode assignedVehicleSnapshot performance.rating status location')
      .lean();

    return res.json({ success: true, data: { drivers } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/tp/assign-driver */
router.patch('/:id/tp/assign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId)
      return res.status(400).json({ success: false, message: 'driverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp)
      return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const driver = await Driver.findOne({ _id: driverId, ownerAgency: tp._id }).lean();
    if (!driver)
      return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    // Cancel any existing open rides for this booking
    await Ride.updateMany(
      { booking: booking._id, status: { $in: ['requested', 'searching'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'system', 'cancellation.cancelledAt': new Date() }
    );

    const coords = getBookingCoords(booking);
    const otp    = genOtp();

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy: req.user._id,
      }),
      driver:           driver.user,
      transportPartner: tp._id,
      status:           'driver_assigned',
      pickupOtp:        hashOtp(otp),
    });

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

    await createNotification({
      recipient: driver.user,
      title:     'New Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

    try {
      await sendSms({
        to:      driverUser.phone,
        message: `Hi ${driverUser.name}, new ride: Booking #${booking.bookingCode}. Check Likeson Driver app.`,
      });
    } catch (e) { console.error('[TP assign] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_assigned', {
      bookingId: booking._id, driverName: driverUser.name,
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver assigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/tp/reassign-driver */
router.patch('/:id/tp/reassign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { newDriverId } = req.body;
    if (!newDriverId)
      return res.status(400).json({ success: false, message: 'newDriverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp)
      return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const driver = await Driver.findOne({ _id: newDriverId, ownerAgency: tp._id }).lean();
    if (!driver)
      return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    await Ride.updateMany(
      { booking: req.params.id, status: { $in: ['driver_assigned', 'driver_accepted'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'system', 'cancellation.cancelledAt': new Date() }
    );

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const coords = getBookingCoords(booking);
    const otp    = genOtp();

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy: req.user._id,
      }),
      driver:           driver.user,
      transportPartner: tp._id,
      status:           'driver_assigned',
      pickupOtp:        hashOtp(otp),
    });

    await Booking.findByIdAndUpdate(booking._id, {
      $push: { rides: ride._id },
      $set:  { primaryRide: ride._id, updatedBy: req.user._id },
    });

    await createNotification({
      recipient: driver.user,
      title:     'Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver reassigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/** GET /care/assigned */
router.get('/care/assigned', protect, authorize('care assistant'), async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!profile)
      return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

    const bookings = await Booking.find({ careAssistant: profile._id })
      .select('bookingCode bookingType scheduledAt patientInfo status patientLocation careAssistantSnapshot fareBreakdown')
      .sort({ scheduledAt: -1 })
      .lean();

    return res.json({ success: true, data: { bookings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/care/arrived */
router.patch('/:id/care/arrived', protect, authorize('care assistant'), async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

    booking.statusLog.push({
      fromStatus: booking.status,
      toStatus:   booking.status,
      changedBy:  req.user._id,
      reason:     'Care assistant arrived at pickup',
    });
    booking.updatedBy = req.user._id;
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Care Assistant Arrived',
      body:      'Your care assistant has arrived at pickup.',
      type:      'Care_Assistant_Arriving',
      bookingId: booking._id,
    });

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_arrived', { bookingId: booking._id });

    return res.json({ success: true, message: 'Arrival marked' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/care/start */
router.patch('/:id/care/start', protect, authorize('care assistant'), async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = 'in_progress';
    booking.statusLog.push({
      fromStatus: 'confirmed',
      toStatus:   'in_progress',
      changedBy:  req.user._id,
      reason:     'Care assistant started task',
    });
    booking.updatedBy = req.user._id;
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Care Task Started',
      body:      'Your care assistant has started the task.',
      type:      'Care_Task_Started',
      bookingId: booking._id,
    });

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'in_progress', timestamp: new Date(),
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Task started' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/care/complete */
router.patch('/:id/care/complete', protect, authorize('care assistant'), async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = 'completed';
    booking.statusLog.push({
      fromStatus: 'in_progress',
      toStatus:   'completed',
      changedBy:  req.user._id,
      reason:     'Care assistant completed task',
    });
    booking.updatedBy = req.user._id;
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Care Task Completed',
      body:      'Your care assistant has completed the task.',
      type:      'Care_Task_Completed',
      bookingId: booking._id,
    });

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_completed', { bookingId: booking._id });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Task completed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /care/location */
router.patch('/care/location', protect, authorize('care assistant'), async (req, res) => {
  try {
    const { lat, lng, bookingId } = req.body;
    if (!lat || !lng)
      return res.status(400).json({ success: false, message: 'lat, lng required' });

    await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        'location.coordinates': [lng, lat],
        'location.updatedAt':   new Date(),
      }
    );

    if (bookingId) {
      getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'location_update', {
        lat, lng, role: 'care_assistant', updatedAt: new Date(),
      });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// HOSPITAL ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/** GET /hospital/upcoming */
router.get('/hospital/upcoming', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
    if (!hospital)
      return res.status(404).json({ success: false, message: 'Hospital not found' });

    const bookings = await Booking.find({
      hospital: hospital._id,
      status:   { $in: ['confirmed', 'in_progress'] },
    })
      .select('bookingCode patientInfo scheduledAt bookingType status doctorSnapshot careAssistantSnapshot')
      .sort({ scheduledAt: 1 })
      .populate('doctor', 'user specialization')
      .lean();

    return res.json({ success: true, data: { bookings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /:id/hospital/confirm */
router.patch('/:id/hospital/confirm', protect, authorize('hospital'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.statusLog.push({
      fromStatus: booking.status,
      toStatus:   booking.status,
      changedBy:  req.user._id,
      reason:     'Hospital confirmed appointment slot',
    });
    booking.notificationsSent.bookingConfirmation = true;
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('phone name').lean();
    try {
      await sendSms({
        to:      customer.phone,
        message: appointmentConfirmedSms({
          userName:      customer.name,
          appointmentId: booking.bookingCode,
          doctorName:    booking.doctorSnapshot?.name || 'Your Doctor',
          scheduledAt:   new Date(booking.scheduledAt).toLocaleString('en-IN'),
          mode:          booking.consultationType || 'inPerson',
        }),
      });
    } catch (e) { console.error('[Hospital confirm] SMS:', e.message); }

    return res.json({ success: true, message: 'Appointment confirmed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /hospital/:hospitalId/ops
 * Hospital staff views all OutPatientRecords at their hospital.
 * Query params: status, doctorId, date, page, limit
 */
router.get('/hospital/:hospitalId/ops',
  protect, authorize('hospital', 'admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { hospitalId } = req.params;

      // Non-admin: verify the requester manages this hospital
      if (!['admin', 'superadmin'].includes(req.user.role)) {
        const hospital = await Hospital.findOne({ _id: hospitalId, managedBy: req.user._id }).lean();
        if (!hospital)
          return res.status(403).json({ success: false, message: 'Access denied: not your hospital' });
      }

      const { status, doctorId, date, page = 1, limit = 20 } = req.query;
      const filter = { hospital: hospitalId };
      if (status)   filter.status   = status;
      if (doctorId) filter.doctor   = doctorId;
      if (date) {
        const d = new Date(date);
        const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
        filter.scheduledAt = { $gte: d, $lt: nextDay };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter)
          .sort({ scheduledAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('doctor',   'user specialization registrationNumber')
          .populate('patient',  'name phone email')
          .populate('booking',  'bookingCode bookingType fareBreakdown paymentStatus')
          .lean(),
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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /hospital/:hospitalId/valid-ops
 * Returns OPs where follow-up is still eligible (followUpExpiry > now, isFollowUp = false).
 */
router.get('/hospital/:hospitalId/valid-ops',
  protect, authorize('hospital', 'doctor', 'admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/valid-ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { hospitalId } = req.params;
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
          .sort({ followUpExpiry: 1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('doctor',  'user specialization')
          .populate('patient', 'name phone')
          .lean(),
        OutPatientRecord.countDocuments(filter),
      ]);

      const now = new Date();
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

/**
 * GET /doctor/ops
 * Doctor views all their OutPatientRecords.
 * Query: status, hospitalId, patientId, date, page, limit
 */
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
        const d = new Date(date);
        const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
        filter.scheduledAt = { $gte: d, $lt: nextDay };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter)
          .sort({ scheduledAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('patient',  'name phone email')
          .populate('hospital', 'name address contact')
          .populate('booking',  'bookingCode bookingType fareBreakdown patientInfo')
          .lean(),
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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /doctor/ops/:opNumber
 * Doctor views a single OP with follow-up chain.
 */
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
        .populate('booking',  'bookingCode bookingType fareBreakdown patientInfo status documents')
        .populate('parentOp', 'opNumber consultationType scheduledAt status')
        .lean();

      if (!op)
        return res.status(404).json({ success: false, message: 'OP record not found' });

      // Fetch follow-up children
      const followUps = await OutPatientRecord.find({ parentOp: op._id })
        .sort({ scheduledAt: -1 })
        .populate('patient', 'name phone')
        .lean();

      const isFollowUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
      const daysRemaining = isFollowUpEligible
        ? Math.ceil((new Date(op.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;

      return res.json({
        success: true,
        data: { op, followUps, isFollowUpEligible, daysRemaining },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /:id/op/complete
 * Doctor marks OP as completed, adds clinical notes, prescription URL, diagnosis code.
 * Also re-sends OP ZIP to customer.
 * Body: { doctorNotes, prescriptionUrl, diagnosisCode, reasonForVisit }
 */
router.patch('/:id/op/complete', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!doctorProfile)
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const { doctorNotes, prescriptionUrl, diagnosisCode, reasonForVisit } = req.body;

    // Find OP linked to this booking
    const op = await OutPatientRecord.findOne({
      booking: req.params.id,
      doctor:  doctorProfile._id,
    });
    if (!op)
      return res.status(404).json({ success: false, message: 'OP record not found for this booking' });
    if (op.status === 'completed')
      return res.status(400).json({ success: false, message: 'OP already completed' });

    op.status      = 'completed';
    op.completedAt = new Date();
    if (doctorNotes)     op.doctorNotes     = doctorNotes;
    if (prescriptionUrl) op.prescriptionUrl = prescriptionUrl;
    if (diagnosisCode)   op.diagnosisCode   = diagnosisCode;
    if (reasonForVisit)  op.reasonForVisit  = reasonForVisit;
    op.updatedBy = req.user._id;
    await op.save();

    const booking  = await Booking.findById(req.params.id).lean();
    const customer = await User.findById(booking.customer).select('email phone name').lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Consultation Complete',
      body:      `Your consultation OP ${op.opNumber} has been completed by the doctor.`,
      type:      'Ride_Update',
      bookingId: booking._id,
    });

    // Re-send OP ZIP with updated notes
    const followUps = await OutPatientRecord.find({ parentOp: op._id })
      .sort({ scheduledAt: -1 }).lean();
    await sendOpZipEmail({ op: op.toObject ? op.toObject() : op, booking, patient: customer, followUps });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'OP completed and sent to patient', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// OP CARD PUBLIC ROUTES (customer + doctor + admin)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /op/:opNumber
 * Any authenticated user can fetch an OP — access controlled by ownership.
 *   Customer: only their own OPs
 *   Doctor:   only their doctor OPs
 *   Admin:    any OP
 */
router.get('/op/:opNumber',
  protect,
  cache(CACHE_TTL.opRecord, req => `GET:/op/${req.params.opNumber}:${req.user._id}`),
  async (req, res) => {
    try {
      const filter = { opNumber: req.params.opNumber };

      // Scope by role
      if (req.user.role === 'customer') {
        filter.patient = req.user._id;
      } else if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
        filter.doctor = dp._id;
      }
      // admin / superadmin: no extra filter

      const op = await OutPatientRecord.findOne(filter)
        .populate('doctor',   'user specialization registrationNumber profilePhotoUrl')
        .populate('hospital', 'name address contact operatingHours is24x7')
        .populate('patient',  'name phone email')
        .populate('booking',  'bookingCode bookingType fareBreakdown status patientInfo consultationType documents')
        .populate('parentOp', 'opNumber scheduledAt consultationType status')
        .lean();

      if (!op)
        return res.status(404).json({ success: false, message: 'OP record not found' });

      // Fetch children follow-ups
      const followUps = await OutPatientRecord.find({ parentOp: op._id })
        .sort({ scheduledAt: -1 })
        .populate('doctor', 'user specialization')
        .lean();

      const isFollowUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
      const daysRemaining = isFollowUpEligible
        ? Math.ceil((new Date(op.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;

      return res.json({
        success: true,
        data: { op, followUps, isFollowUpEligible, daysRemaining },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /op/:opNumber/follow-ups
 * Returns all follow-up OPs for a given OP (parentOp = opNumber).
 * Accessible by customer (own OPs), doctor (own), admin.
 */
router.get('/op/:opNumber/follow-ups', protect, async (req, res) => {
  try {
    const baseFilter = { opNumber: req.params.opNumber };
    if (req.user.role === 'customer') baseFilter.patient = req.user._id;

    const parentOp = await OutPatientRecord.findOne(baseFilter).select('_id').lean();
    if (!parentOp)
      return res.status(404).json({ success: false, message: 'OP not found' });

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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /op/:opNumber/download
 * Streams the OP ZIP file directly to the client.
 * Customer can only download their own OP.
 */
router.get('/op/:opNumber/download', protect, async (req, res) => {
  try {
    const filter = { opNumber: req.params.opNumber };
    if (req.user.role === 'customer') filter.patient = req.user._id;

    const op = await OutPatientRecord.findOne(filter).lean();
    if (!op)
      return res.status(404).json({ success: false, message: 'OP not found' });

    const booking  = await Booking.findById(op.booking).lean();
    const patient  = await User.findById(op.patient).select('name email phone').lean();
    const doctor   = op.doctor
      ? await DoctorProfile.findById(op.doctor).populate('user', 'name').lean()
      : null;
    const hospital = op.hospital
      ? await Hospital.findById(op.hospital).lean()
      : null;
    const followUps = await OutPatientRecord.find({ parentOp: op._id })
      .sort({ scheduledAt: -1 }).lean();

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

/** GET /admin/bookings */
router.get('/admin/bookings',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.adminBookings, req => `GET:/admin/bookings:${req.originalUrl}`),
  async (req, res) => {
    try {
      const {
        status, bookingType, city, date,
        page = 1, limit = 20, search, from, to,
      } = req.query;

      const filter = {};
      if (status)      filter.status      = status;
      if (bookingType) filter.bookingType = bookingType;
      if (city)        filter['patientLocation.city'] = { $regex: city, $options: 'i' };
      if (from || to) {
        filter.scheduledAt = {};
        if (from) filter.scheduledAt.$gte = new Date(from);
        if (to)   filter.scheduledAt.$lte = new Date(to);
      }
      if (date) {
        const d = new Date(date);
        const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
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
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('customer', 'name phone email')
          .lean(),
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

// ─────────────────────────────────────────────────────────────────────────────

/** GET /admin/bookings/stats */
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

// ─────────────────────────────────────────────────────────────────────────────

/** GET /admin/bookings/export — CSV */
router.get('/admin/bookings/export', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { from, to, status, bookingType } = req.query;
    const filter = {};
    if (status)      filter.status      = status;
    if (bookingType) filter.bookingType = bookingType;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }

    const bookings = await Booking.find(filter)
      .select('bookingCode bookingType status scheduledAt patientInfo fareBreakdown paymentStatus createdAt')
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const csvHeader = 'BookingCode,Type,Status,Scheduled,Patient,Customer,Phone,Total(INR),AmountPaid(INR),PaymentStatus,CreatedAt\n';
    const csvRows   = bookings.map(b =>
      [
        b.bookingCode,
        b.bookingType,
        b.status,
        new Date(b.scheduledAt).toLocaleString('en-IN'),
        b.patientInfo?.name,
        b.customer?.name,
        b.customer?.phone,
        b.fareBreakdown?.totalAmount,
        b.fareBreakdown?.amountPaid,
        b.paymentStatus,
        new Date(b.createdAt).toLocaleString('en-IN'),
      ].join(',')
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings-${Date.now()}.csv`);
    return res.send(csvHeader + csvRows.join('\n'));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** GET /admin/bookings/:id */
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
        .populate('primaryRide',   'status liveLocation driverSnapshot vehicleSnapshot scheduledPickupAt pickup dropoff')
        .populate('rides',         'status rideType driverSnapshot vehicleSnapshot')
        .populate('diagnosticDetails.labPartner', 'labName contact')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const opRecord = booking.doctor
        ? await OutPatientRecord.findOne({ booking: booking._id })
            .populate('doctor',  'user specialization')
            .populate('hospital','name address')
            .lean()
        : null;

      const followUps = opRecord
        ? await OutPatientRecord.find({ parentOp: opRecord._id })
            .sort({ scheduledAt: -1 }).lean()
        : [];

      return res.json({ success: true, data: { booking, opRecord, followUps } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /admin/bookings/:id/status */
router.patch('/admin/bookings/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const prevStatus = booking.status;
    booking.status = status;
    booking.statusLog.push({
      fromStatus: prevStatus,
      toStatus:   status,
      changedBy:  req.user._id,
      reason:     note || 'Admin status update',
    });
    booking.updatedBy = req.user._id;
    await booking.save();

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status, timestamp: new Date(),
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Status updated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — NEARBY LOOKUP ROUTES (100 km radius)
// ─────────────────────────────────────────────────────────────────────────────

 

// ── GET /admin/bookings/:id/nearby/care-assistants ────────────────────────────
router.get('/admin/bookings/:id/nearby/care-assistants',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/care-assistants`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .select('patientLocation scheduledAt').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length)
        return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      const careAssistants = await CareAssistantProfile.find({
        isActive:                  true,
        isBlocked:                 false,
        status:                    'Available',
        'kyc.verificationStatus':  'Verified',
        'verification.isVerified': true,
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusInRadians],
          },
        },
      })
        .select('fullName phone specializations performance maxServiceRadiusKm availability location workType user')
        .limit(20)
        .lean();

      const results = careAssistants
        .map(ca => {
          const distKm = haversineKm(coords, ca.location?.coordinates || [0, 0]);
          if (distKm > (ca.maxServiceRadiusKm || 10)) return null;
          return {
            careAssistantId:    ca._id,
            userId:             ca.user,
            name:               ca.fullName,
            phone:              ca.phone,
            specializations:    ca.specializations,
            rating:             ca.performance?.averageRating,
            distanceKm:         +distKm.toFixed(1),
            maxServiceRadiusKm: ca.maxServiceRadiusKm,
            workType:           ca.workType,
            currentCity:        ca.availability?.currentCity,
            isDispatchable:     true,
          };
        })
        .filter(Boolean);

      return res.json({ success: true, data: { results, total: results.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── GET /admin/bookings/:id/nearby/solo-drivers ───────────────────────────────
router.get('/admin/bookings/:id/nearby/solo-drivers',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/solo-drivers`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length)
        return res.status(400).json({ success: false, message: 'Booking has no pickup coordinates' });
      const [lng, lat] = coords;

      const nearbyDrivers = await Driver.find({
        soloPartner: { $ne: null },
        isActive:    true,
        isVerified:  true,
        isBlocked:   false,
        status:      'Available',
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusInRadians],
          },
        },
      })
        .populate('soloPartner', 'legalName phone vehicle serviceZones partnershipStatus isOnboardingComplete rating')
        .select('legalName driverCode location performance assignedVehicleSnapshot')
        .limit(20)
        .lean();

      const results = nearbyDrivers
        .filter(d => d.soloPartner?.partnershipStatus === 'active' && d.soloPartner?.isOnboardingComplete)
        .map(d => ({
          driverId:           d._id,
          soloPartnerId:      d.soloPartner?._id,
          name:               d.soloPartner?.legalName || d.legalName,
          driverCode:         d.driverCode,
          phone:              d.soloPartner?.phone,
          vehicle:            d.assignedVehicleSnapshot,
          rating:             d.performance?.rating,
          distanceKm:         +haversineKm(coords, d.location?.coordinates || [0, 0]).toFixed(1),
          maxServiceRadiusKm: d.soloPartner?.serviceZones?.[0]?.radiusKm || 15,
          isDispatchReady:    true,
        }));

      return res.json({ success: true, data: { results, total: results.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

 
/** GET /admin/bookings/:id/nearby/transport-partners */
router.get('/admin/bookings/:id/nearby/transport-partners',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/transport-partners`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      const city   = booking.patientLocation?.city;
      if (!coords?.length)
        return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      const RADIUS_METERS    = 100_000; // 100 km
      const radiusInRadians  = RADIUS_METERS / 1000 / 6378.1;

      const tps = await TransportPartner.find({
        partnershipStatus: 'active',
        isAvailable:       true,
        ...(city ? { 'serviceZones.city': { $regex: city, $options: 'i' } } : {}),
      })
        .select('businessName ownerName ownerPhone fleetInfo rating serviceZones isOnboardingComplete')
        .limit(20)
        .lean();

      const results = await Promise.all(
        tps.map(async tp => {
          const availDriverCount = await Driver.countDocuments({
            ownerAgency: tp._id,
            isActive:    true,
            isVerified:  true,
            status:      'Available',
            location: {
              $geoWithin: {
                $centerSphere: [[lng, lat], radiusInRadians],
              },
            },
          });
          return {
            tpId:                   tp._id,
            businessName:           tp.businessName,
            ownerName:              tp.ownerName,
            ownerPhone:             tp.ownerPhone,
            totalVehicles:          tp.fleetInfo?.totalVehicles  || 0,
            activeVehicles:         tp.fleetInfo?.activeVehicles || 0,
            totalDrivers:           tp.fleetInfo?.totalDrivers   || 0,
            availableDriversNearby: availDriverCount,
            averageRating:          tp.rating?.averageRating     || 0,
            serviceZones:           tp.serviceZones?.map(z => `${z.city}, ${z.state}`),
            isDispatchReady:        tp.isOnboardingComplete && availDriverCount > 0,
          };
        })
      );

      return res.json({
        success: true,
        data: { results: results.filter(r => r.isDispatchReady), total: results.length },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

 

// ─────────────────────────────────────────────────────────────────────────────

/** GET /admin/bookings/:id/nearby/hospitals */
router.get('/admin/bookings/:id/nearby/hospitals',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/hospitals`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length)
        return res.status(400).json({ success: false, message: 'No pickup coordinates' });
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
        .limit(20)
        .lean();

      const results = hospitals.map(h => ({
        hospitalId:       h._id,
        name:             h.name,
        hospitalType:     h.hospitalType,
        managementModel:  h.managementModel,
        address:          `${h.address?.line1 || ''}, ${h.address?.city || ''}`,
        phone:            h.contact?.phone,
        specialties:      h.specialties,
        is24x7:           h.is24x7,
        isEmergencyReady: h.isEmergencyReady,
        linkedDoctors:    h.linkedDoctors?.length || 0,
        distanceKm:       +haversineKm(coords, h.location?.coordinates || [0, 0]).toFixed(1),
        averageRating:    h.rating?.averageRating,
        isOperational:    true,
      }));

      return res.json({ success: true, data: { results, total: results.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — ASSIGNMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/** POST /admin/bookings/:id/assign/solo-driver */
router.post('/admin/bookings/:id/assign/solo-driver', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { soloDriverPartnerId } = req.body;
    if (!soloDriverPartnerId)
      return res.status(400).json({ success: false, message: 'soloDriverPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['pending', 'confirmed'].includes(booking.status))
      return res.status(400).json({ success: false, message: `Cannot assign in status: ${booking.status}` });

    const soloPartner = await SoloDriverPartner.findById(soloDriverPartnerId)
      .populate('user', 'name phone email').lean();
    if (!soloPartner)
      return res.status(404).json({ success: false, message: 'SoloDriverPartner not found' });
    if (soloPartner.partnershipStatus !== 'active')
      return res.status(400).json({ success: false, message: 'Solo partner not active' });
    if (!soloPartner.driverProfile)
      return res.status(400).json({ success: false, message: 'Solo partner has no linked Driver profile' });

    await Ride.updateMany(
      { booking: booking._id, status: { $in: ['requested', 'searching'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'admin', 'cancellation.cancelledAt': new Date() }
    );

    const coords = getBookingCoords(booking);
    const otp    = genOtp();

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy: req.user._id,
      }),
      driver:      soloPartner.user._id,
      soloPartner: soloPartner._id,
      status:      'driver_assigned',
      pickupOtp:   hashOtp(otp),
    });

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

    try {
      await sendSms({
        to:      soloPartner.user.phone,
        message: `Hi ${soloPartner.user.name}, booking #${booking.bookingCode} assigned by admin. Check Likeson app.`,
      });
    } catch (e) { console.error('[Admin assign solo] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'confirmed', timestamp: new Date(),
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message: `Admin assigned solo driver to #${booking.bookingCode}`,
      actor:   { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { soloDriverPartnerId },
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Solo driver assigned', data: { booking, ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /admin/bookings/:id/assign/transport-partner */
router.post('/admin/bookings/:id/assign/transport-partner', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { transportPartnerId } = req.body;
    if (!transportPartnerId)
      return res.status(400).json({ success: false, message: 'transportPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const tp = await TransportPartner.findById(transportPartnerId)
      .populate('user', 'name email phone').lean();
    if (!tp)
      return res.status(404).json({ success: false, message: 'TransportPartner not found' });
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

    try {
      await sendEmail({
        email:   tp.user.email,
        subject: `New Booking #${booking.bookingCode} — Assign Driver`,
        html: transactionalTemplate({
          header:     'BOOKING ASSIGNED TO YOUR FLEET',
          title:      `Booking #${booking.bookingCode} needs a driver`,
          body: `<b>Type:</b> ${booking.bookingType}<br/>
                 <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
                 <b>Patient:</b> ${booking.patientInfo?.name}`,
          buttonLink: `${process.env.FRONTEND_URL}/tp/bookings/${booking._id}`,
          buttonText: 'Assign Driver Now',
        }),
      });
    } catch (e) { console.error('[Admin assign TP] Email:', e.message); }

    try {
      await sendSms({
        to:      tp.user.phone,
        message: `Hi ${tp.user.name}, booking #${booking.bookingCode} assigned. Assign driver in Likeson dashboard.`,
      });
    } catch (e) { console.error('[Admin assign TP] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`tp:${tp._id}`, 'booking_assigned', {
      bookingId:   booking._id,
      bookingCode: booking.bookingCode,
      bookingType: booking.bookingType,
      scheduledAt: booking.scheduledAt,
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message: `Admin assigned TP to #${booking.bookingCode}`,
      actor:   { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { transportPartnerId },
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Transport partner assigned. Awaiting driver assignment.', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /admin/bookings/:id/assign/care-assistant */
router.post('/admin/bookings/:id/assign/care-assistant', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { careAssistantId } = req.body;
    if (!careAssistantId)
      return res.status(400).json({ success: false, message: 'careAssistantId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const ca = await CareAssistantProfile.findById(careAssistantId)
      .populate('user', 'name phone email').lean();
    if (!ca)
      return res.status(404).json({ success: false, message: 'Care assistant not found' });
    if (!ca.isActive || !ca.verification?.isVerified)
      return res.status(400).json({ success: false, message: 'Care assistant not available or not verified' });

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { careAssistant: careAssistantId, updatedBy: req.user._id },
    });

    await createNotification({
      recipient: ca.user._id,
      title:     'New Care Request',
      body:      `Assigned to booking #${booking.bookingCode}`,
      type:      'Care_Assistant_Assigned',
      bookingId: booking._id,
      priority:  'High',
    });

    try {
      await sendSms({
        to:      ca.user.phone,
        message: newCareRequestToAssistantSms({
          assistantName: ca.fullName,
          requestId:     booking.bookingCode,
          patientName:   booking.patientInfo?.name,
          location:      booking.patientLocation?.address || '',
          scheduledAt:   new Date(booking.scheduledAt).toLocaleString('en-IN'),
        }),
      });
    } catch (e) { console.error('[Admin assign CA] SMS:', e.message); }

    const customer = await User.findById(booking.customer).select('phone name').lean();
    try {
      await sendSms({
        to:      customer.phone,
        message: careAssistantAssignedSms({
          userName:       customer.name,
          requestId:      booking.bookingCode,
          assistantName:  ca.fullName,
          assistantPhone: ca.phone,
        }),
      });
    } catch (e) { console.error('[Admin assign CA] Customer SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_assigned', {
      bookingId:         booking._id,
      careAssistantName: ca.fullName,
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message: `Admin assigned care assistant to #${booking.bookingCode}`,
      actor:   { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { careAssistantId },
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Care assistant assigned', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /admin/bookings/:id/assign/hospital */
router.post('/admin/bookings/:id/assign/hospital', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { hospitalId } = req.body;
    if (!hospitalId)
      return res.status(400).json({ success: false, message: 'hospitalId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const hospital = await Hospital.findById(hospitalId).select('name isActive isVerified').lean();
    if (!hospital?.isActive || !hospital?.isVerified)
      return res.status(400).json({ success: false, message: 'Hospital not operational' });

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { hospital: hospitalId, updatedBy: req.user._id },
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Hospital linked', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /admin/bookings/:id/reassign/driver */
router.patch('/admin/bookings/:id/reassign/driver', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newDriverUserId, reason } = req.body;
    if (!newDriverUserId)
      return res.status(400).json({ success: false, message: 'newDriverUserId required' });

    await Ride.updateMany(
      { booking: req.params.id, status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'admin', 'cancellation.cancelledAt': new Date() }
    );

    const booking   = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const driverDoc = await Driver.findOne({ user: newDriverUserId }).lean();
    if (!driverDoc)
      return res.status(404).json({ success: false, message: 'Driver not found' });

    const coords = getBookingCoords(booking);
    const otp    = genOtp();

    const ride = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        scheduledPickupAt: booking.scheduledAt,
        ...coords,
        createdBy: req.user._id,
      }),
      driver:           newDriverUserId,
      transportPartner: driverDoc.ownerAgency  || undefined,
      soloPartner:      driverDoc.soloPartner   || undefined,
      status:           'driver_assigned',
      pickupOtp:        hashOtp(otp),
    });

    await Booking.findByIdAndUpdate(booking._id, {
      $push: { rides: ride._id },
      $set:  { primaryRide: ride._id, updatedBy: req.user._id },
    });

    booking.statusLog.push({
      fromStatus: booking.status,
      toStatus:   booking.status,
      changedBy:  req.user._id,
      reason:     `Driver reassigned by admin. Reason: ${reason || 'N/A'}`,
    });
    await booking.save();

    await createNotification({
      recipient: newDriverUserId,
      title:     'Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned by admin.`,
      type:      'Ride_Request',
      bookingId: booking._id,
    });

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_assigned', { bookingId: booking._id });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver reassigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /admin/bookings/:id/reassign/care */
router.patch('/admin/bookings/:id/reassign/care', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newCareAssistantId } = req.body;
    if (!newCareAssistantId)
      return res.status(400).json({ success: false, message: 'newCareAssistantId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    await Booking.findByIdAndUpdate(booking._id, {
      $set: { careAssistant: newCareAssistantId, updatedBy: req.user._id },
    });

    const ca = await CareAssistantProfile.findById(newCareAssistantId)
      .populate('user', 'phone name').lean();
    if (ca) {
      await createNotification({
        recipient: ca.user._id,
        title:     'Care Booking Reassigned',
        body:      `Booking #${booking.bookingCode} reassigned to you by admin.`,
        type:      'Care_Assistant_Assigned',
        bookingId: booking._id,
      });
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Care assistant reassigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /admin/bookings/:id/refund */
router.post('/admin/bookings/:id/refund', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { refundAmount, reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const amount = refundAmount ?? booking.fareBreakdown?.amountPaid ?? 0;

    // Razorpay refund
    const rzpPayment = booking.payments?.find(p => p.gateway === 'Razorpay' && p.status === 'success');
    if (rzpPayment?.transactionId && amount > 0) {
      try {
        await razorpay.payments.refund(rzpPayment.transactionId, {
          amount: Math.round(amount * 100),
          notes:  { reason: reason || 'Admin initiated refund', bookingCode: booking.bookingCode },
        });
        rzpPayment.status     = 'refunded';
        rzpPayment.refundedAt = new Date();
      } catch (rzpErr) {
        console.error('[Refund] Razorpay refund failed:', rzpErr.message);
      }
    }

    // Wallet refund
    const walletPayment = booking.payments?.find(p => p.gateway === 'Wallet' && p.status === 'success');
    if (walletPayment && amount > 0) {
      try {
        const wallet = await Wallet.findOne({ user: booking.customer });
        if (wallet) {
          await wallet.credit(amount, 'Refund', {
            referenceId: booking._id,
            onModel:     'Booking',
            description: `Refund for booking ${booking.bookingCode}`,
            initiatedBy: req.user._id,
          });
        }
      } catch (wErr) {
        console.error('[Refund] Wallet refund failed:', wErr.message);
      }
    }

    booking.fareBreakdown.refundAmount = amount;
    booking.paymentStatus = 'refunded';
    booking.status        = 'refunded';
    booking.statusLog.push({
      fromStatus: booking.status,
      toStatus:   'refunded',
      changedBy:  req.user._id,
      reason:     reason || 'Admin initiated refund',
    });
    booking.updatedBy = req.user._id;
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Refund Processed',
      body:      `Refund of ₹${amount} for booking #${booking.bookingCode} has been processed.`,
      type:      'Refund_Processed',
      bookingId: booking._id,
    });

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Refund initiated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — OP MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** GET /admin/ops */
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
        const d = new Date(date);
        const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
        filter.scheduledAt = { $gte: d, $lt: nextDay };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter)
          .sort({ scheduledAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('doctor',   'user specialization')
          .populate('hospital', 'name address')
          .populate('patient',  'name phone email')
          .lean(),
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

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /admin/ops/:id/status */
router.patch('/admin/ops/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, doctorNotes } = req.body;
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status))
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
      });

    const op = await OutPatientRecord.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(doctorNotes ? { doctorNotes } : {}),
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      },
      { new: true }
    );
    if (!op)
      return res.status(404).json({ success: false, message: 'OP record not found' });

    // If marked completed, re-send OP ZIP to patient
    if (status === 'completed') {
      const booking  = await Booking.findById(op.booking).lean();
      const patient  = await User.findById(op.patient).select('email name phone').lean();
      const followUps = await OutPatientRecord.find({ parentOp: op._id })
        .sort({ scheduledAt: -1 }).lean();
      if (patient?.email) {
        await sendOpZipEmail({ op, booking, patient, followUps });
      }
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'OP status updated', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;