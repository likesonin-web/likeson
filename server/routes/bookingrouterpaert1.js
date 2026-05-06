 

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
  resolveCareRideKmRate,
  CARE_RIDE_RADIUS_M,
  
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

// ── CUSTOMER: self-request ride on booking ────────────────────────────────
router.post('/:id/request-ride',
  protect, authorize('customer'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;

      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      // Must be their own booking
      const booking = await Booking.findOne({
        _id:      req.params.id,
        customer: req.user._id,
        status:   { $in: ['pending', 'confirmed'] },
      });
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not yours' });

      // Block duplicate active ride
      const activeRide = await Ride.findOne({
        booking: booking._id,
        status:  { $in: RIDE_STATUSES_ACTIVE },
      });
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists for this booking' });

      const [pLng, pLat] = pickupLocation.coordinates;

      // Resolve rate: subscription → 21₹ default
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(req.user._id);

      // Fare
      const distKm       = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
      const transportFee = +(distKm * ratePerKm).toFixed(2);

      // Search 30km
      const careRideRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;
      const nearbyCount = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false,
        status: 'Available',
        location: {
          $geoWithin: {
            $centerSphere: [[pLng, pLat], careRideRadiusRad],
          },
        },
      });

      const pickupGeo = {
        type: 'Point', coordinates: pickupLocation.coordinates,
        label: pickupLocation.label || '', address: pickupLocation.address || '',
        city:  pickupLocation.city  || '',
      };
      const dropoffGeo = {
        type: 'Point', coordinates: destinationLocation.coordinates,
        label: destinationLocation.label || '', address: destinationLocation.address || '',
        city:  destinationLocation.city  || '',
      };

      const otp  = genOtp();
      const ride = await Ride.create({
        booking:           booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        pickup:            pickupGeo,
        dropoff:           dropoffGeo,
        scheduledPickupAt: booking.scheduledAt || new Date(),
        status:            'searching',
        pickupOtp:         hashOtp(otp),
        createdBy:         req.user._id,
      });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set: {
          primaryRide:         ride._id,
          patientLocation:     pickupGeo,
          destinationLocation: dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
          updatedBy: req.user._id,
        },
      });

      // Notify admin to assign driver
      getBookingSocketService()?.emitToAdminOps('ride_requested_by_customer', {
        bookingId:    booking._id,
        bookingCode:  booking.bookingCode,
        rideId:       ride._id,
        customerId:   req.user._id,
        pickup:       pickupGeo,
        destination:  dropoffGeo,
        distKm:       +distKm.toFixed(2),
        ratePerKm,
        rateSource,
        transportFee,
        noDriverNearby: nearbyCount === 0,
        searchRadiusKm: 30,
        timestamp:    new Date(),
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
          distKm:         +distKm.toFixed(2),
          ratePerKm,
          rateSource,
          transportFee,
          searchRadiusKm: 30,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── CARE ASSISTANT: requests ride for patient ─────────────────────────────
router.post('/:id/care/request-ride',
  protect, authorize('care assistant'),
  async (req, res) => {
    try {
      const { pickupLocation, destinationLocation } = req.body;

      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      // Must be their assigned booking
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile)
        return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({
        _id:           req.params.id,
        careAssistant: profile._id,
        status:        { $in: ['confirmed', 'in_progress'] },
      });
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      // Block duplicate active ride
      const activeRide = await Ride.findOne({
        booking: booking._id,
        status:  { $in: RIDE_STATUSES_ACTIVE },
      });
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists' });

      const [pLng, pLat] = pickupLocation.coordinates;

      // Rate from customer's subscription (care assistant doesn't pay)
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);

      const distKm       = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
      const transportFee = +(distKm * ratePerKm).toFixed(2);

      // 30km search
      const careRideRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;
      const nearbyCount = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false,
        status: 'Available',
        location: {
          $geoWithin: {
            $centerSphere: [[pLng, pLat], careRideRadiusRad],
          },
        },
      });

      const pickupGeo = {
        type: 'Point', coordinates: pickupLocation.coordinates,
        label: pickupLocation.label || '', address: pickupLocation.address || '',
        city:  pickupLocation.city  || '',
      };
      const dropoffGeo = {
        type: 'Point', coordinates: destinationLocation.coordinates,
        label: destinationLocation.label || '', address: destinationLocation.address || '',
        city:  destinationLocation.city  || '',
      };

      const otp  = genOtp();
      const ride = await Ride.create({
        booking:           booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        pickup:            pickupGeo,
        dropoff:           dropoffGeo,
        scheduledPickupAt: booking.scheduledAt || new Date(),
        status:            'searching',
        pickupOtp:         hashOtp(otp),
        createdBy:         req.user._id,
      });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set: {
          primaryRide:         ride._id,
          patientLocation:     pickupGeo,
          destinationLocation: dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
          updatedBy: req.user._id,
        },
      });

      // Notify admin
      getBookingSocketService()?.emitToAdminOps('ride_requested_by_care_assistant', {
        bookingId:        booking._id,
        bookingCode:      booking.bookingCode,
        rideId:           ride._id,
        careAssistantId:  profile._id,
        careAssistantUser: req.user._id,
        pickup:           pickupGeo,
        destination:      dropoffGeo,
        distKm:           +distKm.toFixed(2),
        ratePerKm,
        rateSource,
        transportFee,
        noDriverNearby:   nearbyCount === 0,
        searchRadiusKm:   30,
        timestamp:        new Date(),
      });

      // Emit to booking room so customer sees request
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_requested', {
        bookingId:     booking._id,
        requestedBy:   'care_assistant',
        pickup:        pickupGeo,
        destination:   dropoffGeo,
        distKm:        +distKm.toFixed(2),
        transportFee,
        timestamp:     new Date(),
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
          distKm:         +distKm.toFixed(2),
          ratePerKm,
          rateSource,
          transportFee,
          searchRadiusKm: 30,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════
// CARE-RIDE REQUEST ROUTES (Admin / Superadmin only)
// Customer or care assistant requests a ride.
// Search radius: CARE_RIDE_RADIUS_M (30 km) only.
// If no TP/driver in 30km → still process but flag it.
// Rate: subscription plan → config care_ride rate → 21₹/km default.
// ═══════════════════════════════════════════════════════

/**
 * POST /admin/care-ride/request
 * Admin creates a care-ride request: finds nearby TP/driver within 30km.
 * Body: { bookingId, pickupCoords, dropoffCoords, customerId, careAssistantId? }
 */
/**
 * POST /admin/care-ride/request
 * Admin creates a care-ride request: finds nearby TP/driver within 30km.
 * Body: { bookingId, customerId, requesterType, careAssistantId?, pickupLocation, destinationLocation }
 */
router.post('/admin/care-ride/request',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const {
        bookingId,
        customerId,
        requesterType,       // 'customer' | 'care_assistant'
        careAssistantId,
        pickupLocation,
        destinationLocation,
      } = req.body;

      // ── Validate requester type ──────────────────────────────────
      if (!['customer', 'care_assistant'].includes(requesterType))
        return res.status(400).json({ success: false, message: 'requesterType must be customer or care_assistant' });

      // ── Validate locations ───────────────────────────────────────
      if (!pickupLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'pickupLocation.coordinates required' });
      if (!destinationLocation?.coordinates?.length)
        return res.status(400).json({ success: false, message: 'destinationLocation.coordinates required' });

      const [pLng, pLat] = pickupLocation.coordinates;
      const [dLng, dLat] = destinationLocation.coordinates;

      if (pLng === dLng && pLat === dLat)
        return res.status(400).json({ success: false, message: 'Pickup and destination cannot be same' });

      // ── Resolve booking ──────────────────────────────────────────
      let booking = bookingId ? await Booking.findById(bookingId) : null;
      let resolvedCustomerId = customerId;

      // If care_assistant requested — find linked customer from booking
      if (requesterType === 'care_assistant') {
        if (!careAssistantId)
          return res.status(400).json({ success: false, message: 'careAssistantId required for care_assistant requester' });

        // FIX 1: removed duplicate chained .lean() — only one .select().lean() allowed
        const ca = await CareAssistantProfile.findById(careAssistantId)
          .select('user fullName isActive verification')
          .lean();
        if (!ca)
          return res.status(404).json({ success: false, message: 'Care assistant not found' });
        if (!ca.isActive || !ca.verification?.isVerified)
          return res.status(400).json({ success: false, message: 'Care assistant not active or verified' });

        // Must have booking to know the customer
        if (!booking)
          return res.status(400).json({ success: false, message: 'bookingId required when care_assistant requests ride' });

        resolvedCustomerId = booking.customer;
      }

      if (!resolvedCustomerId)
        return res.status(400).json({ success: false, message: 'customerId required' });

      // ── Resolve km rate ──────────────────────────────────────────
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(resolvedCustomerId);

      // ── Compute distance + fare ──────────────────────────────────
      const distKm       = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
      const transportFee = +(distKm * ratePerKm).toFixed(2);

      // ── Search within 30km from PICKUP ───────────────────────────
      const careRideRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;

      // FIX 2: was semicolon between Promise.all array items — replaced with comma.
      //        Driver query was missing .limit().lean().
      //        Closing ]) was missing.
      const [nearbyDrivers, nearbyTPs] = await Promise.all([
        Driver.find({
          isActive:   true,
          isVerified: true,
          isBlocked:  false,
          status:     'Available',
          location: {
            $geoWithin: {
              $centerSphere: [[pLng, pLat], careRideRadiusRad],
            },
          },
        })
          .select('driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency soloPartner')
          .limit(10)
          .lean(),                          // ← was missing

        TransportPartner.find({
          partnershipStatus:   'active',
          isAvailable:         true,
          'serviceZones.city': { $regex: pickupLocation.city || '', $options: 'i' },
        })
          .select('businessName ownerPhone fleetInfo serviceZones')
          .limit(10)
          .lean(),
      ]);                                   // ← closing ]) was missing

      const noDriverNearby = nearbyDrivers.length === 0 && nearbyTPs.length === 0;

      // ── Build geo sub-docs ───────────────────────────────────────
      const pickupGeo = {
        type:        'Point',
        coordinates: pickupLocation.coordinates,
        label:       pickupLocation.label   || '',
        address:     pickupLocation.address || '',
        city:        pickupLocation.city    || '',
      };
      const dropoffGeo = {
        type:        'Point',
        coordinates: destinationLocation.coordinates,
        label:       destinationLocation.label   || '',
        address:     destinationLocation.address || '',
        city:        destinationLocation.city    || '',
      };

      // ── Create ride ──────────────────────────────────────────────
      const otp  = genOtp();
      const ride = await Ride.create({
        booking:           booking?._id || null,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        pickup:            pickupGeo,
        dropoff:           dropoffGeo,
        scheduledPickupAt: booking?.scheduledAt || new Date(),
        status:            'searching',
        pickupOtp:         hashOtp(otp),
        createdBy:         req.user._id,
        // FIX 3: removed pointless `...(booking ? {} : {})` spread — did nothing
      });

      // ── Update booking if exists ─────────────────────────────────
      if (booking) {
        await Booking.findByIdAndUpdate(booking._id, {
          $push: { rides: ride._id },
          $set: {
            primaryRide:                  ride._id,
            patientLocation:              pickupGeo,
            destinationLocation:          dropoffGeo,
            status:                       'confirmed',
            'fareBreakdown.transportFee': transportFee,
            updatedBy:                    req.user._id,
          },
        });
      }

      // ── Join sockets ─────────────────────────────────────────────
      if (booking) {
        if (requesterType === 'care_assistant' && careAssistantId) {
          const ca = await CareAssistantProfile.findById(careAssistantId).select('user').lean();
          if (ca) joinBookingRoom(ca.user, booking._id);
        }
        joinBookingRoom(booking.customer, booking._id);
      }

      // ── Notify admin ops ─────────────────────────────────────────
      getBookingSocketService()?.emitToAdminOps('care_ride_requested', {
        bookingId:         booking?._id,
        bookingCode:       booking?.bookingCode,
        rideId:            ride._id,
        requesterType,
        careAssistantId:   careAssistantId || null,
        pickup: {
          address:     pickupLocation.address,
          city:        pickupLocation.city,
          label:       pickupLocation.label,
          coordinates: pickupLocation.coordinates,
        },
        destination: {
          address:     destinationLocation.address,
          city:        destinationLocation.city,
          label:       destinationLocation.label,
          coordinates: destinationLocation.coordinates,
        },
        distKm:            +distKm.toFixed(2),
        ratePerKm,
        rateSource,
        transportFee,
        noDriverNearby,
        nearbyDriverCount: nearbyDrivers.length,
        nearbyTPCount:     nearbyTPs.length,
        searchRadiusKm:    30,
        timestamp:         new Date(),
      });

      await invalidateBookingCache();

      return res.json({
        success: true,
        message: noDriverNearby
          ? 'Care-ride created. No driver within 30km — assign manually.'
          : `Care-ride created. ${nearbyDrivers.length} driver(s) and ${nearbyTPs.length} TP(s) found nearby.`,
        data: {
          rideId:         ride._id,
          requesterType,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +distKm.toFixed(2),
          ratePerKm,
          rateSource,
          transportFee,
          noDriverNearby,
          searchRadiusKm: 30,
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
            tpId:         tp._id,
            businessName: tp.businessName,
            ownerPhone:   tp.ownerPhone,
            totalDrivers: tp.fleetInfo?.totalDrivers || 0,
          })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /admin/care-ride/:bookingId/nearby
 * Search drivers/TPs within 30km for a care-ride booking.
 * Different from /nearby/transport-partners (that uses 100km for dispatch).
 */
router.get('/admin/care-ride/:bookingId/nearby',
  protect, authorize('admin', 'superadmin'),
  cache(30, req => `GET:/admin/care-ride/${req.params.bookingId}/nearby`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .select('patientLocation customer').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length)
        return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      // 30km only — care-ride rule
      const careRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1;

      const [soloDrivers, agencyDrivers, tps] = await Promise.all([
        Driver.find({
          soloPartner: { $ne: null },
          isActive: true, isVerified: true, isBlocked: false,
          status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], careRadiusRad] } },
        })
          .populate('soloPartner', 'legalName phone vehicle partnershipStatus')
          .select('driverCode location performance assignedVehicleSnapshot')
          .limit(15).lean(),

        Driver.find({
          ownerAgency: { $ne: null },
          isActive: true, isVerified: true, isBlocked: false,
          status: 'Available',
          location: { $geoWithin: { $centerSphere: [[lng, lat], careRadiusRad] } },
        })
          .select('driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency')
          .limit(15).lean(),

        TransportPartner.find({
          partnershipStatus: 'active',
          isAvailable: true,
          'serviceZones.city': { $regex: booking.patientLocation?.city || '', $options: 'i' },
        })
          .select('businessName ownerPhone fleetInfo serviceZones')
          .limit(10).lean(),
      ]);

      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);

      return res.json({
        success: true,
        data: {
          searchRadiusKm: 30,
          ratePerKm,
          rateSource,
          soloDrivers: soloDrivers
            .filter(d => d.soloPartner?.partnershipStatus === 'active')
            .map(d => ({
              driverId:    d._id,
              name:        d.soloPartner?.legalName,
              phone:       d.soloPartner?.phone,
              vehicle:     d.assignedVehicleSnapshot,
              rating:      d.performance?.rating,
              distanceKm: +haversineKm(coords, d.location?.coordinates || [0,0]).toFixed(1),
            })),
          agencyDrivers: agencyDrivers.map(d => ({
            driverId:    d._id,
            agencyId:    d.ownerAgency,
            name:        d.legalName,
            phone:       d.phone,
            vehicle:     d.assignedVehicleSnapshot,
            rating:      d.performance?.rating,
            distanceKm: +haversineKm(coords, d.location?.coordinates || [0,0]).toFixed(1),
          })),
          transportPartners: tps.map(tp => ({
            tpId:          tp._id,
            businessName:  tp.businessName,
            ownerPhone:    tp.ownerPhone,
            totalDrivers:  tp.fleetInfo?.totalDrivers  || 0,
            activeDrivers: tp.fleetInfo?.activeDrivers || 0,
          })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
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

// PATCH /:id/ride/en-route
// After OTP verified, driver taps "Start Journey"
// Switches tracking context: pickup coords → dropoff coords
router.patch('/:id/ride/en-route', protect, authorize('driver', 'solodriverpartner'), async (req, res) => {
  const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
  if (!ride || ride.status !== 'in_progress')
    return res.status(400).json({ success: false, message: 'Ride must be in_progress' });

  // No status change — just milestone + socket so frontend switches map target
  await RideTracking.addMilestone(ride._id, 'ride_started', {
    recordedBy: 'driver', recordedByUserId: req.user._id
  }).catch(() => {});

  getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'navigation_target_changed', {
    bookingId: ride.booking,
    target: 'dropoff',
    coords: ride.dropoff?.coordinates,
    address: ride.dropoff?.address,
  });

  return res.json({ success: true });
});


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

   

    ride.status = 'in_progress';
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status    = 'in_progress';
    booking.updatedBy = req.user._id;
    await booking.save();

    // Create RideTracking if not yet created
   let tracking = await RideTracking.findOne({ ride: ride._id });
if (!tracking) {
  // Only create if createAndLinkRide didn't already create it
  tracking = await RideTracking.create({
    ride:    ride._id,
    booking: booking._id,
    driver:  req.user._id,
    // polyline already set at ride creation — don't overwrite
  });
  await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
}else{
   await RideTracking.findByIdAndUpdate(tracking._id, { $set: { driver: req.user._id } });
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
      const op       = await OutPatientRecord.findOne({ booking: booking._id }).lean();
const doctor   = await DoctorProfile.findById(booking.doctor).populate('user', 'name').lean();
const hospital = await Hospital.findById(booking.hospital).lean();
const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();

        await sendOpZipEmail({ op, booking, doctor, hospital, patient: customer, followUps });
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