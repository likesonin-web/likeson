/**
 * ═══════════════════════════════════════════════════════
 * RIDE REQUEST ROUTER — Likeson.in
 * routes/rideRequestRouter.js
 *
 * Standalone ride request (NOT tied to booking creation).
 * Customer or care assistant requests transport only.
 *
 * FLOW:
 *   Customer/CA → POST /            → creates RideRequest
 *   Admin sees  → GET  /admin/all   → lists pending requests
 *   Admin       → GET  /admin/:id/nearby → 30km search
 *   Admin       → POST /admin/:id/assign → assigns TP or SoloDriver
 *   TP          → PATCH /admin/:id/assign-driver → TP assigns driver
 *   Driver      → existing ride routes (accept/arrive/start/end)
 *
 * MOUNT: /api/ride-requests
 * ═══════════════════════════════════════════════════════
 */

import express from 'express';
import mongoose from 'mongoose';

import Ride                 from '../models/Ride.js';
import Driver               from '../models/Driver.js';
import TransportPartner     from '../models/TransportPartner.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import User                 from '../models/User.js';
import Booking              from '../models/Booking.js';

import { protect, authorize }       from '../middleware/authMiddleware.js';
import { getBookingSocketService }  from '../services/bookingSocketService.js';
import {
  genOtp,
  hashOtp,
  haversineKm,
  createNotification,
  buildRidePayload,
  resolveCareRideKmRate,
  CARE_RIDE_RADIUS_M,
  RIDE_STATUSES_ACTIVE,
} from './bookingRouterShared.js';

const router = express.Router();

const careRideRadiusRad = CARE_RIDE_RADIUS_M / 1000 / 6378.1; // 30km in radians

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

const validateLocations = (pickup, destination) => {
  if (!pickup?.coordinates?.length)
    return 'pickupLocation.coordinates required';
  if (!destination?.coordinates?.length)
    return 'destinationLocation.coordinates required';
  const [pLng, pLat] = pickup.coordinates;
  const [dLng, dLat] = destination.coordinates;
  if (pLng === dLng && pLat === dLat)
    return 'Pickup and destination cannot be same';
  return null;
};

const buildGeo = (loc) => ({
  type:        'Point',
  coordinates: loc.coordinates,
  label:       loc.label   || '',
  address:     loc.address || '',
  city:        loc.city    || '',
});

const createRideRequest = async ({
  pickupGeo,
  dropoffGeo,
  scheduledAt,
  customerId,
  bookingId,
  createdBy,
}) => {
  const otp = genOtp();
  const ride = await Ride.create({
    booking:           bookingId || null,
    rideType:          'patient',
    vehicleClass:      'four_wheeler',
    pickup:            pickupGeo,
    dropoff:           dropoffGeo,
    scheduledPickupAt: scheduledAt || new Date(),
    status:            'searching',
    pickupOtp:         hashOtp(otp),
    createdBy,
  });
  return { ride, otp };
};

// ═════════════════════════════════════════════════════
// CUSTOMER — request new ride
// POST /api/ride-requests/customer
// ═════════════════════════════════════════════════════

router.post('/customer',
  protect, authorize('customer'),
  async (req, res) => {
    try {
      const {
        pickupLocation,
        destinationLocation,
        scheduledAt,
        bookingId,     // optional — link to existing booking
        notes,
      } = req.body;

      // Validate
      const locErr = validateLocations(pickupLocation, destinationLocation);
      if (locErr) return res.status(400).json({ success: false, message: locErr });

      // If bookingId given — must belong to this customer
      if (bookingId) {
        const booking = await Booking.findOne({
          _id:      bookingId,
          customer: req.user._id,
        }).select('_id').lean();
        if (!booking)
          return res.status(404).json({ success: false, message: 'Booking not found or not yours' });

        // Block if active ride already on that booking
        const activeRide = await Ride.findOne({
          booking: bookingId,
          status:  { $in: RIDE_STATUSES_ACTIVE },
        }).select('_id').lean();
        if (activeRide)
          return res.status(400).json({ success: false, message: 'Active ride already exists on this booking' });
      }

      const pickupGeo  = buildGeo(pickupLocation);
      const dropoffGeo = buildGeo(destinationLocation);
      const [pLng, pLat] = pickupLocation.coordinates;

      // Resolve rate
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(req.user._id);
      const distKm       = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
      const transportFee = +(distKm * ratePerKm).toFixed(2);

      // Count nearby drivers (30km) — info only, don't block
      const nearbyCount = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false,
        status: 'Available',
        location: {
          $geoWithin: {
            $centerSphere: [[pLng, pLat], careRideRadiusRad],
          },
        },
      });

      // Create ride
      const { ride } = await createRideRequest({
        pickupGeo,
        dropoffGeo,
        scheduledAt,
        customerId: req.user._id,
        bookingId:  bookingId || null,
        createdBy:  req.user._id,
      });

      // If linked to booking — update booking
      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, {
          $push: { rides: ride._id },
          $set: {
            primaryRide:         ride._id,
            patientLocation:     pickupGeo,
            destinationLocation: dropoffGeo,
            'fareBreakdown.transportFee': transportFee,
          },
        });
      }

      // Notify admin
      getBookingSocketService()?.emitToAdminOps('ride_requested', {
        rideId:         ride._id,
        bookingId:      bookingId || null,
        requesterType:  'customer',
        customerId:     req.user._id,
        pickup:         pickupGeo,
        destination:    dropoffGeo,
        distKm:         +distKm.toFixed(2),
        ratePerKm,
        rateSource,
        transportFee,
        noDriverNearby: nearbyCount === 0,
        searchRadiusKm: 30,
        notes:          notes || null,
        timestamp:      new Date(),
      });

      return res.status(201).json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign.'
          : 'Ride requested. Waiting for admin to assign driver.',
        data: {
          rideId:         ride._id,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +distKm.toFixed(2),
          ratePerKm,
          rateSource,
          transportFee,
          searchRadiusKm: 30,
          status:         'searching',
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════
// CARE ASSISTANT — request ride for patient
// POST /api/ride-requests/care-assistant
// ═════════════════════════════════════════════════════

router.post('/care-assistant',
  protect, authorize('care assistant'),
  async (req, res) => {
    try {
      const {
        pickupLocation,
        destinationLocation,
        scheduledAt,
        bookingId,    // required — must be their assigned booking
        notes,
      } = req.body;

      // Validate locations
      const locErr = validateLocations(pickupLocation, destinationLocation);
      if (locErr) return res.status(400).json({ success: false, message: locErr });

      // bookingId required for care assistant
      if (!bookingId)
        return res.status(400).json({ success: false, message: 'bookingId required for care assistant ride request' });

      // Must be their assigned booking
      const profile = await CareAssistantProfile.findOne({ user: req.user._id })
        .select('_id fullName').lean();
      if (!profile)
        return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({
        _id:           bookingId,
        careAssistant: profile._id,
        status:        { $in: ['confirmed', 'in_progress'] },
      }).select('_id customer scheduledAt bookingCode').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      // Block duplicate active ride
      const activeRide = await Ride.findOne({
        booking: booking._id,
        status:  { $in: RIDE_STATUSES_ACTIVE },
      }).select('_id').lean();
      if (activeRide)
        return res.status(400).json({ success: false, message: 'Active ride already exists on this booking' });

      const pickupGeo  = buildGeo(pickupLocation);
      const dropoffGeo = buildGeo(destinationLocation);
      const [pLng, pLat] = pickupLocation.coordinates;

      // Rate from customer's subscription (CA doesn't pay)
      const { ratePerKm, source: rateSource } = await resolveCareRideKmRate(booking.customer);
      const distKm       = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
      const transportFee = +(distKm * ratePerKm).toFixed(2);

      // 30km nearby count — info only
      const nearbyCount = await Driver.countDocuments({
        isActive: true, isVerified: true, isBlocked: false,
        status: 'Available',
        location: {
          $geoWithin: {
            $centerSphere: [[pLng, pLat], careRideRadiusRad],
          },
        },
      });

      // Create ride
      const { ride } = await createRideRequest({
        pickupGeo,
        dropoffGeo,
        scheduledAt:  scheduledAt || booking.scheduledAt,
        customerId:   booking.customer,
        bookingId:    booking._id,
        createdBy:    req.user._id,
      });

      // Update booking
      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: ride._id },
        $set: {
          primaryRide:         ride._id,
          patientLocation:     pickupGeo,
          destinationLocation: dropoffGeo,
          'fareBreakdown.transportFee': transportFee,
        },
      });

      // Notify admin:ops
      getBookingSocketService()?.emitToAdminOps('ride_requested', {
        rideId:            ride._id,
        bookingId:         booking._id,
        bookingCode:       booking.bookingCode,
        requesterType:     'care_assistant',
        careAssistantId:   profile._id,
        careAssistantName: profile.fullName,
        customerId:        booking.customer,
        pickup:            pickupGeo,
        destination:       dropoffGeo,
        distKm:            +distKm.toFixed(2),
        ratePerKm,
        rateSource,
        transportFee,
        noDriverNearby:    nearbyCount === 0,
        searchRadiusKm:    30,
        notes:             notes || null,
        timestamp:         new Date(),
      });

      // Notify customer via booking room
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_requested', {
        rideId:        ride._id,
        requestedBy:   'care_assistant',
        pickup:        pickupGeo,
        destination:   dropoffGeo,
        distKm:        +distKm.toFixed(2),
        transportFee,
        timestamp:     new Date(),
      });

      await createNotification({
        recipient: booking.customer,
        title:     'Ride Requested',
        body:      `Your care assistant requested a ride for your appointment.`,
        type:      'Ride_Update',
        bookingId: booking._id,
      });

      return res.status(201).json({
        success: true,
        message: nearbyCount === 0
          ? 'Ride requested. No driver nearby — admin will assign.'
          : 'Ride requested. Waiting for admin to assign driver.',
        data: {
          rideId:         ride._id,
          bookingId:      booking._id,
          pickup:         pickupGeo,
          destination:    dropoffGeo,
          distKm:         +distKm.toFixed(2),
          ratePerKm,
          rateSource,
          transportFee,
          searchRadiusKm: 30,
          status:         'searching',
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════
// CUSTOMER/CA — get their own ride request status
// GET /api/ride-requests/:rideId
// ═════════════════════════════════════════════════════

router.get('/:rideId',
  protect, authorize('customer', 'care assistant'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(req.params.rideId)
        .select('-pickupOtp')
        .populate('booking', 'bookingCode bookingType status')
        .lean();

      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      return res.json({ success: true, data: { ride } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════
// ADMIN — list all pending ride requests
// GET /api/ride-requests/admin/all
// ═════════════════════════════════════════════════════

router.get('/admin/all',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { status = 'searching', page = 1, limit = 20 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [rides, total] = await Promise.all([
        Ride.find({ status })
          .select('-pickupOtp')
          .populate('booking',  'bookingCode bookingType customer patientInfo status')
          .populate('driver',   'legalName phone driverCode')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Ride.countDocuments({ status }),
      ]);

      return res.json({
        success: true,
        data: {
          rides,
          total,
          page:  parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════
// ADMIN — nearby drivers/TPs for a ride request (30km)
// GET /api/ride-requests/admin/:rideId/nearby
// ═════════════════════════════════════════════════════

router.get('/admin/:rideId/nearby',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const ride = await Ride.findById(req.params.rideId)
        .select('pickup booking').lean();
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });

      const coords = ride.pickup?.coordinates;
      if (!coords?.length)
        return res.status(400).json({ success: false, message: 'Ride has no pickup coordinates' });
      const [lng, lat] = coords;

      const [soloDrivers, agencyDrivers, tps] = await Promise.all([
        // Solo drivers within 30km
        Driver.find({
          soloPartner: { $ne: null },
          isActive: true, isVerified: true, isBlocked: false,
          status: 'Available',
          location: {
            $geoWithin: {
              $centerSphere: [[lng, lat], careRideRadiusRad],
            },
          },
        })
          .populate('soloPartner', 'legalName phone vehicle partnershipStatus isOnboardingComplete')
          .select('driverCode location performance assignedVehicleSnapshot')
          .limit(15).lean(),

        // Agency drivers within 30km
        Driver.find({
          ownerAgency: { $ne: null },
          isActive: true, isVerified: true, isBlocked: false,
          status: 'Available',
          location: {
            $geoWithin: {
              $centerSphere: [[lng, lat], careRideRadiusRad],
            },
          },
        })
          .populate('ownerAgency', 'businessName partnershipStatus')
          .select('driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency')
          .limit(15).lean(),

        // TPs with city match
        TransportPartner.find({
          partnershipStatus: 'active',
          isAvailable:       true,
        })
          .select('businessName ownerPhone fleetInfo serviceZones isOnboardingComplete')
          .limit(10).lean(),
      ]);

      // Resolve rate from booking's customer
      const booking = ride.booking
        ? await Booking.findById(ride.booking).select('customer').lean()
        : null;
      const { ratePerKm, source: rateSource } = booking
        ? await resolveCareRideKmRate(booking.customer)
        : { ratePerKm: 21, source: 'care_ride_default' };

      const distKm = ride.dropoff?.coordinates
        ? haversineKm(coords, ride.dropoff.coordinates)
        : 0;

      return res.json({
        success: true,
        data: {
          rideId:         ride._id,
          searchRadiusKm: 30,
          ratePerKm,
          rateSource,
          distKm:         +distKm.toFixed(2),
          estimatedFare:  +(distKm * ratePerKm).toFixed(2),
          soloDrivers: soloDrivers
            .filter(d => d.soloPartner?.partnershipStatus === 'active' && d.soloPartner?.isOnboardingComplete)
            .map(d => ({
              driverId:    d._id,
              soloId:      d.soloPartner?._id,
              name:        d.soloPartner?.legalName,
              phone:       d.soloPartner?.phone,
              vehicle:     d.assignedVehicleSnapshot,
              rating:      d.performance?.rating,
              distanceKm:  +haversineKm(coords, d.location?.coordinates || [0,0]).toFixed(1),
            })),
          agencyDrivers: agencyDrivers
            .filter(d => d.ownerAgency?.partnershipStatus === 'active')
            .map(d => ({
              driverId:     d._id,
              agencyId:     d.ownerAgency?._id,
              agencyName:   d.ownerAgency?.businessName,
              name:         d.legalName,
              phone:        d.phone,
              vehicle:      d.assignedVehicleSnapshot,
              rating:       d.performance?.rating,
              distanceKm:   +haversineKm(coords, d.location?.coordinates || [0,0]).toFixed(1),
            })),
          transportPartners: tps
            .filter(tp => tp.isOnboardingComplete)
            .map(tp => ({
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

// ═════════════════════════════════════════════════════
// ADMIN — assign TP or SoloDriver to ride request
// POST /api/ride-requests/admin/:rideId/assign
// Body: { assignType: 'tp'|'solo', assignId }
// ═════════════════════════════════════════════════════

router.post('/admin/:rideId/assign',
  protect, authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { assignType, assignId } = req.body;

      if (!['tp', 'solo'].includes(assignType))
        return res.status(400).json({ success: false, message: 'assignType must be tp or solo' });
      if (!assignId)
        return res.status(400).json({ success: false, message: 'assignId required' });

      const ride = await Ride.findById(req.params.rideId);
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found' });
      if (!['searching', 'requested'].includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot assign from status: ${ride.status}` });

      if (assignType === 'tp') {
        // Assign transport partner — TP must then assign driver
        const tp = await TransportPartner.findOne({
          _id:               assignId,
          partnershipStatus: 'active',
          isAvailable:       true,
        }).populate('user', 'name phone email').lean();
        if (!tp)
          return res.status(404).json({ success: false, message: 'Transport partner not found or not active' });

        ride.transportPartner = tp._id;
        ride.status           = 'searching'; // stays searching until TP assigns driver
        await ride.save();

        // Notify TP
        await createNotification({
          recipient: tp.user._id,
          title:     'New Ride Request',
          body:      `New ride request assigned to your fleet. Please assign a driver.`,
          type:      'Ride_Request',
          bookingId: ride.booking,
        });

        getBookingSocketService()?.emitToRoom(`tp:${tp._id}`, 'ride_request_assigned', {
          rideId:      ride._id,
          pickup:      ride.pickup,
          destination: ride.dropoff,
          scheduledAt: ride.scheduledPickupAt,
          timestamp:   new Date(),
        });

        return res.json({
          success: true,
          message: 'Transport partner assigned. Waiting for driver assignment.',
          data: { rideId: ride._id, assignedTo: 'tp', tpId: tp._id },
        });

      } else {
        // Assign solo driver directly
        const soloPartner = await SoloDriverPartner.findOne({
          _id:               assignId,
          partnershipStatus: 'active',
          isOnboardingComplete: true,
        }).populate('user', 'name phone').lean();
        if (!soloPartner)
          return res.status(404).json({ success: false, message: 'Solo driver partner not found or not active' });
        if (!soloPartner.driverProfile)
          return res.status(400).json({ success: false, message: 'Solo partner has no linked Driver profile' });

        ride.driver      = soloPartner.user._id;
        ride.soloPartner = soloPartner._id;
        ride.status      = 'driver_assigned';
        await ride.save();

        // Notify driver
        await createNotification({
          recipient: soloPartner.user._id,
          title:     'New Ride Assigned',
          body:      `New ride request assigned to you.`,
          type:      'Ride_Request',
          bookingId: ride.booking,
        });

        // Join driver to booking room if booking exists
        if (ride.booking) {
          getBookingSocketService()?.emitJoinRoom?.(
            String(soloPartner.user._id),
            `booking:${ride.booking}`
          );
        }

        getBookingSocketService()?.emitToAdminOps('ride_driver_assigned', {
          rideId:    ride._id,
          driverName: soloPartner.user.name,
          type:      'solo',
          timestamp: new Date(),
        });

        return res.json({
          success: true,
          message: 'Solo driver assigned.',
          data: { rideId: ride._id, assignedTo: 'solo', soloPartnerId: soloPartner._id },
        });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════
// TP — assign driver to a ride request
// PATCH /api/ride-requests/tp/:rideId/assign-driver
// Body: { driverId }
// ═════════════════════════════════════════════════════

router.patch('/tp/:rideId/assign-driver',
  protect, authorize('transportpartner'),
  async (req, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId)
        return res.status(400).json({ success: false, message: 'driverId required' });

      const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!tp)
        return res.status(404).json({ success: false, message: 'Transport partner not found' });

      const ride = await Ride.findOne({
        _id:              req.params.rideId,
        transportPartner: tp._id,
        status:           'searching',
      });
      if (!ride)
        return res.status(404).json({ success: false, message: 'Ride not found or not assigned to your fleet' });

      // Driver must belong to this TP
      const driver = await Driver.findOne({
        _id:         driverId,
        ownerAgency: tp._id,
        isActive:    true,
        isVerified:  true,
        isBlocked:   false,
        status:      'Available',
      }).populate('user', 'name phone').lean();
      if (!driver)
        return res.status(404).json({ success: false, message: 'Driver not found or not available in your fleet' });

      ride.driver = driver.user._id;
      ride.status = 'driver_assigned';
      await ride.save();

      // Notify driver
      await createNotification({
        recipient: driver.user._id,
        title:     'Ride Assigned',
        body:      `New ride assigned by your transport partner.`,
        type:      'Ride_Request',
        bookingId: ride.booking,
      });

      // Join driver to booking room
      if (ride.booking) {
        getBookingSocketService()?.emitJoinRoom?.(
          String(driver.user._id),
          `booking:${ride.booking}`
        );
      }

      getBookingSocketService()?.emitToAdminOps('ride_driver_assigned', {
        rideId:     ride._id,
        driverName: driver.user.name,
        type:       'agency',
        tpId:       tp._id,
        timestamp:  new Date(),
      });

      return res.json({
        success: true,
        message: 'Driver assigned to ride.',
        data: {
          rideId:   ride._id,
          driverId: driver._id,
          status:   ride.status,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;