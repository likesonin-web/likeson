 
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
import { transactionalTemplate }     from '../utils/emailTemplates.js';
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
  adminBookings: 30,
  adminStats:    60,
  nearby:        30,
  ops:           45,
  opRecord:      60,
};

const invalidateBookingCache = async () => {
  try {
    const patterns = [
      'GET:/admin/bookings*',
      'GET:/op/*',
      'GET:/hospital/*',
      'GET:/doctor/ops*',
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

const joinBookingRoom = (userId, bookingId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `booking:${bookingId}`); }
  catch (e) { console.error('[joinBookingRoom]', e.message); }
};

const joinTpRoom = (userId, tpId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `tp:${tpId}`); }
  catch (e) { console.error('[joinTpRoom]', e.message); }
};

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
 * Ride.driver = Driver._id (driverId body param is Driver._id).
 */
router.patch('/:id/tp/assign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { driverId } = req.body; // ← Driver._id
    if (!driverId) return res.status(400).json({ success: false, message: 'driverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const driver = await Driver.findOne({ _id: driverId, ownerAgency: tp._id }).lean();
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Cancel any pending rides
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
      driver:               driverId,  // ← Driver._id
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

    await createNotification({
      recipient: driver.user,
      title:     'New Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

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
        pickupCoords:    coords.pickupCoords,
        pickupAddress:   coords.pickupAddress,
        dropoffCoords:   coords.dropoffCoords,
        dropoffAddress:  coords.dropoffAddress,
        estimatedDistKm: distanceKm,
        estimatedMinutes: durationMin,
        currentTarget:   'pickup',
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

router.patch('/:id/tp/reassign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { newDriverId } = req.body; // ← Driver._id
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
      driver:               newDriverId, // ← Driver._id
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
      $set:  { primaryRide: ride._id, updatedBy: req.user._id },
    });

    await createNotification({
      recipient: driver.user,
      title:     'Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
    });

    joinBookingRoom(driver.user, booking._id);
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver reassigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT ROUTES — authorize('care_assistant') underscore always
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

      await createNotification({
        recipient: booking.customer,
        title:     'Care Assistant Arrived',
        body:      'Your care assistant has arrived at pickup.',
        type:      'Care_Assistant_Arriving',
        bookingId: booking._id,
      });

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
      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

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
  }
);

router.patch('/:id/care/complete',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

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
      const { lat, lng, bookingId } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });

      await CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        { 'location.coordinates': [lng, lat], 'location.updatedAt': new Date() }
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
      .select('bookingCode patientInfo scheduledAt bookingType status consultationType doctorSnapshot careAssistantSnapshot fareBreakdown primaryRide')
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

router.patch('/:id/hospital/confirm', protect, authorize('hospital'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

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

    return res.json({ success: true, message: 'Appointment confirmed' });
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
          .populate('booking',  'bookingCode bookingType fareBreakdown patientInfo')
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
        .populate('booking',  'bookingCode bookingType fareBreakdown patientInfo status documents')
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

    const booking   = await Booking.findById(req.params.id).lean();
    const customer  = await User.findById(booking.customer).select('email phone name').lean();
    const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Consultation Complete',
      body:      `Your consultation OP ${op.opNumber} has been completed.`,
      type:      'Ride_Update',
      bookingId: booking._id,
    });

    sendOpZipEmail({ op: op.toObject ? op.toObject() : op, booking, patient: customer, followUps });

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
        .populate('booking',  'bookingCode bookingType fareBreakdown status patientInfo consultationType documents')
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
      .select('bookingCode bookingType status scheduledAt patientInfo fareBreakdown paymentStatus createdAt')
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 }).limit(5000).lean();

    const csvHeader = 'BookingCode,Type,Status,Scheduled,Patient,Customer,Phone,Total(INR),AmountPaid(INR),PaymentStatus,CreatedAt\n';
    const csvRows   = bookings.map(b =>
      [
        b.bookingCode, b.bookingType, b.status,
        new Date(b.scheduledAt).toLocaleString('en-IN'),
        b.patientInfo?.name, b.customer?.name, b.customer?.phone,
        b.fareBreakdown?.totalAmount, b.fareBreakdown?.amountPaid,
        b.paymentStatus, new Date(b.createdAt).toLocaleString('en-IN'),
      ].join(',')
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

      return res.json({ success: true, data: { booking, opRecord, followUps, mapRoute } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/admin/bookings/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, note } = req.body;
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
      { status: 'cancelled', 'cancellation.cancelledBy': 'admin', 'cancellation.cancelledAt': new Date() }
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
      driver:               soloPartner.driverProfile, // ← Driver._id
      soloPartner:          soloPartner._id,
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
        pickupCoords:    coords.pickupCoords,
        pickupAddress:   coords.pickupAddress,
        dropoffCoords:   coords.dropoffCoords,
        dropoffAddress:  coords.dropoffAddress,
        estimatedDistKm: distanceKm,
        estimatedMinutes: durationMin,
        currentTarget:   'pickup',
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
      subject: `New Booking #${booking.bookingCode} — Assign Driver`,
      html:    transactionalTemplate({
        header:     'BOOKING ASSIGNED TO YOUR FLEET',
        title:      `Booking #${booking.bookingCode} needs a driver`,
        body:       `<b>Type:</b> ${booking.bookingType}<br/><b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/><b>Patient:</b> ${booking.patientInfo?.name}`,
        buttonLink: `${process.env.FRONTEND_URL}/tp/bookings/${booking._id}`,
        buttonText: 'Assign Driver Now',
      }),
    }).catch(e => console.error('[Admin assign TP] Email:', e.message));

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

router.post('/admin/bookings/:id/assign/care-assistant', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { careAssistantId } = req.body;
    if (!careAssistantId)
      return res.status(400).json({ success: false, message: 'careAssistantId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const ca = await CareAssistantProfile.findById(careAssistantId)
      .populate('user', 'name phone email').lean();
    if (!ca) return res.status(404).json({ success: false, message: 'Care assistant not found' });
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

    const customer = await User.findById(booking.customer).select('phone name').lean();

    sendSms({
      to:      ca.user.phone,
      message: newCareRequestToAssistantSms({
        assistantName: ca.fullName,
        requestId:     booking.bookingCode,
        patientName:   booking.patientInfo?.name,
        location:      booking.patientLocation?.address || '',
        scheduledAt:   new Date(booking.scheduledAt).toLocaleString('en-IN'),
      }),
    }).catch(e => console.error('[Admin assign CA] SMS:', e.message));

    sendSms({
      to:      customer.phone,
      message: careAssistantAssignedSms({
        userName:       customer.name,
        requestId:      booking.bookingCode,
        assistantName:  ca.fullName,
        assistantPhone: ca.phone,
      }),
    }).catch(e => console.error('[Admin assign CA] Customer SMS:', e.message));

    joinBookingRoom(ca.user._id, booking._id);
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_assigned', {
      bookingId:        booking._id,
      careAssistantName: ca.fullName,
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message: `Admin assigned care assistant to #${booking.bookingCode}`,
      actor: { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { careAssistantId },
    });
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Care assistant assigned', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/bookings/:id/assign/hospital', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { hospitalId } = req.body;
    if (!hospitalId) return res.status(400).json({ success: false, message: 'hospitalId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

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

router.patch('/admin/bookings/:id/reassign/driver', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newDriverId, reason } = req.body; // newDriverId = Driver._id
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
      driver:               newDriverId,                        // ← Driver._id
      transportPartner:     driverDoc.ownerAgency  || undefined,
      soloPartner:          driverDoc.soloPartner  || undefined,
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
      $set:  { primaryRide: ride._id, updatedBy: req.user._id },
    });

    booking.statusLog.push({
      fromStatus: booking.status, toStatus: booking.status,
      changedBy: req.user._id,
      reason: `Driver reassigned by admin. Reason: ${reason || 'N/A'}`,
    });
    await booking.save();

    await createNotification({
      recipient: driverDoc.user,
      title:     'Ride Assigned',
      body:      `Booking #${booking.bookingCode} assigned by admin.`,
      type:      'Ride_Request',
      bookingId: booking._id,
    });

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
      .populate('user', 'phone name').lean();
    if (ca) {
      await createNotification({
        recipient: ca.user._id,
        title:     'Care Booking Reassigned',
        body:      `Booking #${booking.bookingCode} reassigned to you by admin.`,
        type:      'Care_Assistant_Assigned',
        bookingId: booking._id,
      });
      joinBookingRoom(ca.user._id, booking._id);
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Care assistant reassigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

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
        rzpPayment.status    = 'refunded';
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
    booking.statusLog.push({
      fromStatus: prevStatus, toStatus: 'refunded',
      changedBy: req.user._id, reason: reason || 'Admin initiated refund',
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
    }, { new: true });
    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

    if (status === 'completed') {
      const booking   = await Booking.findById(op.booking).lean();
      const patient   = await User.findById(op.patient).select('email name phone').lean();
      const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();
      if (patient?.email) sendOpZipEmail({ op, booking, patient, followUps });
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'OP status updated', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;