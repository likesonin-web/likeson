/**
 * bookingRouterCustomer.js — Likeson.in
 *
 * Customer-facing routes: discovery, booking creation, management.
 *
 * FIXES vs previous version:
 *  - Removed `import { auth } from 'google-auth-library'` — unused, causes crash
 *  - `router.use(protect)` removed — individual routes apply protect + authorize
 *    (mixed public/protected routes need per-route middleware)
 *  - calculateCanonicalRoute imported correctly from shared
 *  - UserSubscription imported from shared (not inline re-import)
 *  - RideTracking imported from shared (was missing, caused runtime error)
 *  - GET /my-bookings/:bookingId returns mapRoute from RideTracking
 *  - POST /full-care-ride: outbound + return canonical routes locked at creation
 *  - POST /patient-transport: same canonical route locking + return ride
 *  - POST /diagnostic-home: lab→patient canonical route locked in RideTracking
 *  - POST /follow-up: followUpParentBooking set correctly (was null)
 *  - POST /diagnostic-home: uses UserSubscription from shared exports
 *  - POST /diagnostic-center: uses UserSubscription from shared exports
 *  - processWalletPayment imported from shared (was missing in original)
 *  - All Ride.create calls: driver field NOT set here (assigned later by admin/TP)
 *  - bookingRouterShared re-exports used consistently — no inline dynamic imports
 *    for hot paths (PlatformPricingConfig still dynamic — lazy OK there)
 */

import express from 'express';

import {
  // Models
  Booking,
  Ride,
  RideTracking,
  OutPatientRecord,
  UserSubscription,

  // Auth
  protect,
  authorize,

  // Discovery
  getHospitals,
  getDoctorsByHospital,
  checkHospitalOrDoctorAvailability,
  getLabs,
  getLabWithTests,

  // Transport
  resolveKmRate,
  resolveTransportFare,
  autoAssignCareAssistant,

  // Consultation + follow-up
  checkFollowUpEligibility,
  checkSubscriptionConsultation,
  resolveConsultationFee,
  incrementSubscriptionUsage,

  // Fare
  buildFareBreakdown,
  buildRidePayload,

  // OP
  generateOpNumber,

  // Payment
  createRazorpayOrder,
  processWalletPayment,

  // Refund + misc
  computeRefundAmount,
  resolveServiceComponents,
  hashOtp,
  genOtp,
  haversineKm,
  createNotification,
  CUSTOMER_BOOKING_TYPES,
verifyRazorpaySignature,
  // Canonical route — locked at ride creation
  calculateCanonicalRoute,
} from './bookingRouterShared.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ROUTES — public (protect applied per-route below)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/hospitals', protect, async (req, res) => {
  try {
    const { city, hospitalType } = req.query;
    const hospitals = await getHospitals({ city, hospitalType });
    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hospitals/:hospitalId/doctors', protect, async (req, res) => {
  try {
    const doctors = await getDoctorsByHospital(req.params.hospitalId);
    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

router.get('/hospitals/:hospitalId/availability', protect, async (req, res) => {
  try {
    const { scheduledAt } = req.query;
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt required' });
    const result = await checkHospitalOrDoctorAvailability({
      hospitalId:  req.params.hospitalId,
      scheduledAt: new Date(scheduledAt),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/doctors/:doctorId/availability', protect, async (req, res) => {
  try {
    const { scheduledAt, hospitalId } = req.query;
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt required' });
    const result = await checkHospitalOrDoctorAvailability({
      hospitalId,
      doctorId:    req.params.doctorId,
      scheduledAt: new Date(scheduledAt),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/labs', protect, async (req, res) => {
  try {
    const { city, labType, homeCollection } = req.query;
    const labs = await getLabs({ city, labType, homeCollection: homeCollection === 'true' });
    res.json({ success: true, count: labs.length, data: labs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/labs/:labId', protect, async (req, res) => {
  try {
    const lab = await getLabWithTests(req.params.labId);
    res.json({ success: true, data: lab });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

router.get('/booking-options/:type', protect, (req, res) => {
  const { type } = req.params;
  if (!CUSTOMER_BOOKING_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid booking type. Allowed: ${CUSTOMER_BOOKING_TYPES.join(', ')}`,
    });
  }

  const components = resolveServiceComponents(type);

  const featureDescriptions = {
    full_care_ride: {
      description: 'Doctor consultation + care assistant + transport to hospital and back.',
      steps: [
        'Select hospital',
        'Select doctor and slot',
        'Transport calculated: your location → hospital (canonical Google Maps route, locked at booking)',
        'Care assistant auto-assigned (nearest available)',
        'Choose: return home transport or drop at hospital only',
      ],
      notes: [
        'Transport cost: subscription rate or ₹12/km default',
        'Care assistant assigned automatically',
        'Consultation fee charged separately (subscription may cover it)',
        'Map route is same for driver, customer, admin, TP — locked at booking time',
      ],
    },
    doctor_consultation: {
      description: 'In-person doctor visit at hospital or clinic.',
      steps: [
        'Select hospital (optional for doctor-owned clinics)',
        'Select doctor and specialization',
        'Check slot availability',
        'Consultation fee resolved (subscription → hospital → doctor → default)',
      ],
      notes: ['No transport included', 'Subscription consultation quota checked before charging'],
    },
    doctor_online: {
      description: 'Video or audio consultation from home.',
      steps: ['Select doctor', 'Check availability', 'Meeting link generated on confirmation'],
      notes: ['No transport needed', 'Subscription consultation quota applies'],
    },
    physiotherapist: {
      description: 'Physiotherapy at clinic or home visit.',
      steps: ['Select physiotherapist', 'Choose in-person or home visit', 'Book slot'],
      notes: ['Home visit fee differs from clinic fee'],
    },
    care_assistant: {
      description: 'Care assistant support only (no doctor).',
      steps: ['Specify duration and date', 'Care assistant auto-assigned (nearest available)'],
      notes: ['Pricing by duration tier', 'No manual selection of care assistant'],
    },
    diagnostic_center: {
      description: 'Lab tests at diagnostic center (patient travels to lab).',
      steps: ['Select lab', 'Select tests or packages', 'Book slot'],
      notes: ['Subscription diagnostic discount applies', 'Report delivery mode selectable'],
    },
    diagnostic_home: {
      description: 'Lab technician visits patient at home for sample collection.',
      steps: [
        'Select lab (must support home collection)',
        'Select tests or packages',
        'Home address confirmed',
        'Canonical route locked: lab → patient address',
      ],
      notes: ['Home collection fee added', 'Subscription diagnostic discount applies'],
    },
    patient_transport: {
      description: 'Standalone transport: pickup to drop-off.',
      steps: [
        'Enter pickup location',
        'Enter drop-off location',
        'Canonical route calculated via Google Maps and locked',
        'Fare = canonicalDistKm × rate (subscription or ₹12 default)',
        'Waiting charges recorded in RideTracking milestones (not pre-estimated)',
        'Choose return home (reversed route, same lock logic)',
        'Optionally add hospital + doctor visit (consultation fee separate)',
      ],
      notes: [
        'Return: separate ride, reversed route, same driver',
        'Waiting: ₹2/min after 5 free minutes — recorded in RideTracking',
        'Adding doctor = consultation charged separately',
        'All map routes (driver/customer/admin/TP) use same canonical polyline',
      ],
    },
    follow_up: {
      description: 'Follow-up to a prior consultation.',
      steps: [
        'System checks your last consultation (same doctor, same hospital)',
        'Must be within follow-up validity window',
        'Discounted or free follow-up fee applied automatically',
      ],
      notes: [
        'Strict: same doctor + same hospital as original consultation',
        'Window checked automatically — no manual overrides',
      ],
    },
  };

  res.json({
    success: true,
    data: { bookingType: type, components, features: featureDescriptions[type] || {} },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /transport/estimate
// Pre-booking estimate only. Actual fare locked when ride is created.
// Uses haversine straight-line — Google Maps route locked at ride creation.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/transport/estimate', protect, async (req, res) => {
  try {
    const {
      pickupLng, pickupLat, dropoffLng, dropoffLat,
      includeReturn  = 'false',
      waitingMinutes = '0',
      bookingType    = 'patient_transport',
    } = req.query;

    if (!pickupLng || !pickupLat || !dropoffLng || !dropoffLat) {
      return res.status(400).json({
        success: false,
        message: 'pickupLng, pickupLat, dropoffLng, dropoffLat required',
      });
    }

    const allowedTransportTypes = ['patient_transport', 'full_care_ride', 'diagnostic_home'];
    if (!allowedTransportTypes.includes(bookingType)) {
      return res.status(400).json({
        success: false,
        message: `bookingType must be one of: ${allowedTransportTypes.join(', ')}`,
      });
    }

    const pickupCoords  = [parseFloat(pickupLng),  parseFloat(pickupLat)];
    const dropoffCoords = [parseFloat(dropoffLng), parseFloat(dropoffLat)];

    const { ratePerKm, source } = await resolveKmRate(req.user._id);

    const fareResult = resolveTransportFare({
      bookingType,
      pickupCoords,
      dropoffCoords,
      ratePerKm,
      includeReturn:  includeReturn === 'true',
      waitingMinutes: parseInt(waitingMinutes, 10),
    });

    res.json({
      success: true,
      data: {
        ...fareResult,
        kmRateSource: source,
        ratePerKm,
        note: 'Estimate uses straight-line (haversine) distance. Actual fare uses Google Maps canonical route locked at booking.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/follow-up/check', protect, async (req, res) => {
  try {
    const { doctorId, hospitalId } = req.query;
    if (!doctorId)
      return res.status(400).json({ success: false, message: 'doctorId required' });
    const result = await checkFollowUpEligibility({
      customerId: req.user._id, doctorId, hospitalId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — FULL CARE RIDE
//
// FIX: canonical outbound + return routes locked at ride creation.
// Both rides get their own RideTracking with expectedRoutePolyline.
// Return ride route = reversed direction, calculated separately.
// driver field NOT set here — admin/TP assigns driver later.
// ═════════════════════════════════════════════════════════════════════════════

router.post('/full-care-ride', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      hospitalId, doctorId, scheduledAt,
      consultationType  = 'inPerson',
      patientInfo, patientLocation, destinationLocation,
      includeReturnHome = false,
      slotId, documents = [],
      paymentMethod = 'Razorpay',
      couponCode, coinsToRedeem = 0,
    } = req.body;

    if (!hospitalId || !doctorId || !scheduledAt || !patientInfo || !patientLocation) {
      return res.status(400).json({
        success: false,
        message: 'hospitalId, doctorId, scheduledAt, patientInfo, patientLocation required',
      });
    }
    if (!patientLocation?.coordinates?.length) {
      return res.status(400).json({ success: false, message: 'patientLocation.coordinates [lng, lat] required' });
    }

    const scheduledDate = new Date(scheduledAt);

    const avail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
    if (!avail.available)
      return res.status(400).json({ success: false, message: avail.reason });

    const { default: Hospital } = await import('../models/Hospital.js');
    const hospital = await Hospital.findById(hospitalId)
      .select('location address name managementModel consultationPricing')
      .lean();
    if (!hospital)
      return res.status(404).json({ success: false, message: 'Hospital not found' });

    const hospCoords = destinationLocation?.coordinates || hospital.location?.coordinates;
    if (!hospCoords?.length) {
      return res.status(400).json({ success: false, message: 'Hospital location unavailable. Provide destinationLocation.' });
    }

    const subCheck            = await checkSubscriptionConsultation(req.user._id);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId, consultationType,
    });

    const { ratePerKm, source: kmRateSource } = await resolveKmRate(req.user._id);
    const pickupCoords  = patientLocation.coordinates;
    const dropoffCoords = hospCoords;

    const transportCalc = resolveTransportFare({
      bookingType:   'full_care_ride',
      pickupCoords, dropoffCoords, ratePerKm,
      includeReturn: includeReturnHome,
    });

    const careAssistant = await autoAssignCareAssistant({
      patientCoords: pickupCoords,
      city: patientLocation.city || hospital.address?.city || 'Vijayawada',
    });
    if (!careAssistant) {
      return res.status(503).json({ success: false, message: 'No care assistant available at this time. Please try again shortly.' });
    }

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config = await PlatformPricingConfig.getGlobal();
    const caTier = config?.careAssistant?.pricingTiers?.find(t => t.isActive) || null;

    const fareBreakdown = buildFareBreakdown({
      consultationFee,
      careAssistantFee:  caTier?.chargeToUser ?? 0,
      transportFee:      transportCalc.totalTransportFee,
      taxPercent:        config?.tax?.consultationGstPercent ?? 0,
    });

    // Create booking first (wallet payment needs real bookingId)
    const booking = await Booking.create({
      bookingType:     'full_care_ride',
      customer:        req.user._id,
      patientInfo,
      doctor:          doctorId,
      hospital:        hospitalId,
      careAssistant:   careAssistant._id,
      consultationType,
      scheduledAt:     scheduledDate,
      slotId:          slotId || null,
      patientLocation: {
        type: 'Point', coordinates: pickupCoords,
        address: patientLocation.address, city: patientLocation.city, pincode: patientLocation.pincode,
      },
      destinationLocation: {
        type: 'Point', coordinates: dropoffCoords,
        address: destinationLocation?.address || hospital.address?.line1,
        city:    destinationLocation?.city    || hospital.address?.city,
      },
      documents,
      fareBreakdown,
      pricingSource: pricingSource === 'hospital' ? 'hospital' : pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus:  'unpaid',
      payments:       [],
      couponCode:     couponCode || undefined,
      coinsRedeemed:  coinsToRedeem,
      status:         'pending',
      createdBy:      req.user._id,
      careAssistantSnapshot: {
        name:     careAssistant.fullName,
        photoUrl: careAssistant.photoUrl,
        phone:    careAssistant.phone,
      },
    });

    if (paymentMethod === 'Wallet') {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus                = 'paid';
      booking.payments                     = [walletPaymentRecord];
      booking.fareBreakdown.walletApplied  = fareBreakdown.totalAmount;
      booking.fareBreakdown.amountPaid     = 0;
      await booking.save();
    }

    // Lock canonical outbound route at creation
    const { distanceKm: outDistKm, durationMin: outDurMin, polyline: outPolyline } =
      await calculateCanonicalRoute(pickupCoords, dropoffCoords);

    const outboundRide = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        pickupCoords,
        pickupAddress:     patientLocation.address,
        pickupCity:        patientLocation.city,
        dropoffCoords,
        dropoffAddress:    destinationLocation?.address || hospital.address?.line1,
        dropoffCity:       destinationLocation?.city    || hospital.address?.city,
        scheduledPickupAt: scheduledDate,
        isReturnRide:      false,
        createdBy:         req.user._id,
      }),
      estimatedDistanceKm:  outDistKm,
      estimatedDurationMin: outDurMin,
      // driver NOT set — assigned later by admin/TP
    });

    const outTracking = await RideTracking.create({
      ride:                  outboundRide._id,
      booking:               booking._id,
      expectedRoutePolyline: outPolyline, // LOCKED
    });
    await Ride.findByIdAndUpdate(outboundRide._id, { $set: { trackingId: outTracking._id } });

    let returnRide = null, retDistKm = null, retDurMin = null, retPolyline = null;

    if (includeReturnHome) {
      // Return leg = reversed direction, separate canonical route
      const retRoute = await calculateCanonicalRoute(dropoffCoords, pickupCoords);
      retDistKm = retRoute.distanceKm;
      retDurMin = retRoute.durationMin;
      retPolyline = retRoute.polyline;

      returnRide = await Ride.create({
        ...buildRidePayload({
          bookingId:         booking._id,
          rideType:          'patient',
          vehicleClass:      'four_wheeler',
          pickupCoords:      dropoffCoords,
          pickupAddress:     destinationLocation?.address || hospital.address?.line1,
          pickupCity:        destinationLocation?.city    || hospital.address?.city,
          dropoffCoords:     pickupCoords,
          dropoffAddress:    patientLocation.address,
          dropoffCity:       patientLocation.city,
          scheduledPickupAt: scheduledDate,
          isReturnRide:      true,
          createdBy:         req.user._id,
        }),
        estimatedDistanceKm:  retDistKm,
        estimatedDurationMin: retDurMin,
      });

      const retTracking = await RideTracking.create({
        ride:                  returnRide._id,
        booking:               booking._id,
        expectedRoutePolyline: retPolyline, // LOCKED
      });
      await Ride.findByIdAndUpdate(returnRide._id, { $set: { trackingId: retTracking._id } });
    }

    booking.primaryRide = outboundRide._id;
    booking.rides       = [outboundRide._id];
    if (returnRide) { booking.returnRide = returnRide._id; booking.rides.push(returnRide._id); }
    await booking.save();

    const followUpValidDays = hospital.managementModel === 'hospital-manager'
      ? (hospital.consultationPricing?.followUpValidDays ?? 7) : 7;
    const opNumber = await generateOpNumber(hospitalId);

    await OutPatientRecord.create({
      opNumber,
      booking:       booking._id,
      bookingNumber: booking.bookingCode,
      patient:       req.user._id,
      patientName:   patientInfo.name,
      doctor:        doctorId,
      hospital:      hospitalId,
      consultationType:        'in_person',
      scheduledAt:             scheduledDate,
      status:                  'scheduled',
      consultationFee,
      feeSource:               pricingSource,
      isCoveredBySubscription,
      isFollowUp:              false,
      followUpExpiry:          new Date(Date.now() + followUpValidDays * 24 * 60 * 60 * 1000),
      followUpFee: hospital.managementModel === 'hospital-manager'
        ? (hospital.consultationPricing?.followUpFee ?? 0) : 0,
      createdBy: req.user._id,
    });

    if (isCoveredBySubscription && subCheck.sub) {
      await incrementSubscriptionUsage(subCheck.sub._id, 'consultationsUsed');
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(
        fareBreakdown.totalAmount, booking.bookingCode,
        { customerId: req.user._id.toString() }
      );
    }

    await createNotification({
      recipient: req.user._id, title: 'Booking Confirmed',
      body:      `Your full care ride (${booking.bookingCode}) is confirmed for ${scheduledDate.toLocaleString('en-IN')}.`,
      type:      'BOOKING', bookingId: booking._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Full care ride booked successfully',
      data: {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        status:      booking.status,
        scheduledAt: booking.scheduledAt,
        fareBreakdown,
        transportSummary: {
          distanceKm:     outDistKm,
          ratePerKm, kmRateSource,
          outboundFare:   transportCalc.outbound.totalFare,
          returnFare:     transportCalc.returnLeg?.totalFare ?? null,
          includeReturn:  includeReturnHome,
          totalTransport: transportCalc.totalTransportFee,
        },
        // Canonical polylines — client renders map immediately, no recalculation
        mapRoutes: {
          outbound: {
            polyline:      outPolyline,
            distanceKm:    outDistKm,
            durationMin:   outDurMin,
            pickupCoords,
            dropoffCoords,
            currentTarget: 'pickup',
          },
          return: includeReturnHome ? {
            polyline:      retPolyline,
            distanceKm:    retDistKm,
            durationMin:   retDurMin,
            pickupCoords:  dropoffCoords,
            dropoffCoords: pickupCoords,
          } : null,
        },
        careAssistantAssigned: {
          id: careAssistant._id, name: careAssistant.fullName,
          phone: careAssistant.phone, photoUrl: careAssistant.photoUrl,
        },
        rides:  { outbound: outboundRide._id, return: returnRide?._id ?? null },
        opNumber,
        consultationCoveredBySubscription: isCoveredBySubscription,
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /full-care-ride]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DOCTOR CONSULTATION (in-person)
// No ride created. OP record created. No polyline needed.
// ═════════════════════════════════════════════════════════════════════════════

router.post('/doctor-consultation', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      hospitalId, doctorId, scheduledAt,
      consultationType = 'inPerson',
      patientInfo, slotId, documents = [],
      paymentMethod = 'Razorpay', couponCode, coinsToRedeem = 0,
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const scheduledDate = new Date(scheduledAt);

    const avail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const subCheck            = await checkSubscriptionConsultation(req.user._id);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId, consultationType,
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType:      'doctor_consultation',
      customer:         req.user._id,
      patientInfo,
      doctor:           doctorId,
      hospital:         hospitalId || null,
      consultationType,
      scheduledAt:      scheduledDate,
      slotId:           slotId || null,
      documents,
      fareBreakdown,
      pricingSource: pricingSource === 'hospital' ? 'hospital' : pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus:    'unpaid',
      payments:         [],
      couponCode:       couponCode || undefined,
      coinsRedeemed:    coinsToRedeem,
      status:           'pending',
      createdBy:        req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    const opNumber = await generateOpNumber(hospitalId);
    await OutPatientRecord.create({
      opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
      patient: req.user._id, patientName: patientInfo.name,
      doctor: doctorId, hospital: hospitalId || null,
      consultationType: 'in_person', scheduledAt: scheduledDate,
      status: 'scheduled', consultationFee, feeSource: pricingSource,
      isCoveredBySubscription, isFollowUp: false,
      followUpExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: req.user._id,
    });

    if (isCoveredBySubscription && subCheck.sub) {
      await incrementSubscriptionUsage(subCheck.sub._id, 'consultationsUsed');
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    await createNotification({
      recipient: req.user._id, title: 'Appointment Confirmed',
      body: `Your appointment (${booking.bookingCode}) is confirmed.`,
      type: 'BOOKING', bookingId: booking._id,
    });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        opNumber, fareBreakdown,
        consultationCoveredBySubscription: isCoveredBySubscription,
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /doctor-consultation]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DOCTOR ONLINE (video)
// ═════════════════════════════════════════════════════════════════════════════

router.post('/doctor-online', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      doctorId, scheduledAt, patientInfo,
      documents = [], paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const subCheck            = await checkSubscriptionConsultation(req.user._id);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId: null, consultationType: 'video',
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType:        'doctor_online',
      customer:           req.user._id,
      patientInfo,
      doctor:             doctorId,
      consultationType:   'video',
      scheduledAt:        scheduledDate,
      onlineConsultation: { platform: 'Likeson Chat' },
      documents,
      fareBreakdown,
      pricingSource: pricingSource === 'hospital' ? 'hospital' : pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus:  'unpaid',
      payments:       [],
      status:         'pending',
      createdBy:      req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    if (isCoveredBySubscription && subCheck.sub && consultationFee === 0) {
      await incrementSubscriptionUsage(subCheck.sub._id, 'consultationsUsed');
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    return res.status(201).json({
      success: true,
      data: {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        fareBreakdown,
        consultationCoveredBySubscription: isCoveredBySubscription,
        razorpayOrder,
        note: 'Meeting link will be sent on booking confirmation.',
      },
    });
  } catch (err) {
    console.error('[POST /doctor-online]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — PATIENT TRANSPORT
//
// FIX: outbound + return canonical routes locked at ride creation.
// Waiting charges are ESTIMATED in fare (for upfront display) but the
// actual waiting time is recorded in RideTracking milestones during the ride.
// driver NOT set at creation — admin/TP assigns later.
// ═════════════════════════════════════════════════════════════════════════════

router.post('/patient-transport', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      patientInfo, patientLocation, destinationLocation, scheduledAt,
      includeReturn    = false,
      waitingMinutes   = 0,
      vehicleClass     = 'four_wheeler',
      addConsultation  = false,
      hospitalId, doctorId,
      consultationType = 'inPerson',
      slotId,
      paymentMethod = 'Razorpay', couponCode, coinsToRedeem = 0,
    } = req.body;

    if (!patientInfo || !patientLocation?.coordinates || !destinationLocation?.coordinates || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'patientInfo, patientLocation.coordinates, destinationLocation.coordinates, scheduledAt required',
      });
    }

    const scheduledDate        = new Date(scheduledAt);
    const pickupCoords         = patientLocation.coordinates;
    const dropoffCoords        = destinationLocation.coordinates;
    const parsedWaitingMinutes = parseInt(waitingMinutes, 10) || 0;

    const { ratePerKm, source: kmRateSource } = await resolveKmRate(req.user._id);

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config             = await PlatformPricingConfig.getGlobal();
    const freeWaitingMinutes = config?.transport?.waitingFreeMinutes     ?? 5;
    const waitingRatePerMin  = config?.transport?.waitingChargePerMinute ?? 2;

    const transportCalc = resolveTransportFare({
      bookingType: 'patient_transport',
      pickupCoords, dropoffCoords, ratePerKm,
      includeReturn, waitingMinutes: parsedWaitingMinutes,
      freeWaitingMinutes, waitingRatePerMin,
    });

    let consultationFee = 0, consultationSource = null, opNumber = null;
    let isCoveredBySub  = false, subRef = null;

    if (addConsultation) {
      if (!doctorId)
        return res.status(400).json({ success: false, message: 'doctorId required when addConsultation=true' });

      const consultationAvail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
      if (!consultationAvail.available)
        return res.status(400).json({ success: false, message: consultationAvail.reason });

      const subCheck = await checkSubscriptionConsultation(req.user._id);
      isCoveredBySub = subCheck.allowed && subCheck.isFree;
      subRef         = subCheck.sub;

      const feeResult    = await resolveConsultationFee({
        isFollowUp: false, followUpFee: 0,
        isCoveredBySubscription: isCoveredBySub, doctorId, hospitalId, consultationType,
      });
      consultationFee    = feeResult.fee;
      consultationSource = feeResult.source;
    }

    const fareBreakdown = buildFareBreakdown({
      consultationFee,
      transportFee: transportCalc.totalTransportFee,
      taxPercent:   config?.tax?.transportGstPercent ?? 5,
    });

    const booking = await Booking.create({
      bookingType:     'patient_transport',
      customer:        req.user._id,
      patientInfo,
      doctor:          addConsultation ? doctorId   : null,
      hospital:        addConsultation ? hospitalId : null,
      consultationType: addConsultation ? consultationType : null,
      scheduledAt:     scheduledDate,
      slotId:          slotId || null,
      patientLocation: {
        type: 'Point', coordinates: pickupCoords,
        address: patientLocation.address, city: patientLocation.city, pincode: patientLocation.pincode,
      },
      destinationLocation: {
        type: 'Point', coordinates: dropoffCoords,
        address: destinationLocation.address, city: destinationLocation.city,
      },
      fareBreakdown,
      pricingSource: addConsultation ? (consultationSource === 'hospital' ? 'hospital' : 'doctor') : 'platform',
      paymentStatus: 'unpaid',
      payments:      [],
      couponCode:    couponCode || undefined,
      coinsRedeemed: coinsToRedeem,
      status:        'pending',
      createdBy:     req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    // Lock canonical outbound route
    const { distanceKm: outDistKm, durationMin: outDurMin, polyline: outPolyline } =
      await calculateCanonicalRoute(pickupCoords, dropoffCoords);

    const outboundRide = await Ride.create({
      ...buildRidePayload({
        bookingId: booking._id, rideType: 'patient', vehicleClass,
        pickupCoords, pickupAddress: patientLocation.address, pickupCity: patientLocation.city,
        dropoffCoords, dropoffAddress: destinationLocation.address, dropoffCity: destinationLocation.city,
        scheduledPickupAt: scheduledDate, isReturnRide: false, createdBy: req.user._id,
      }),
      estimatedDistanceKm:  outDistKm,
      estimatedDurationMin: outDurMin,
    });

    const outTracking = await RideTracking.create({
      ride: outboundRide._id, booking: booking._id, expectedRoutePolyline: outPolyline,
    });
    await Ride.findByIdAndUpdate(outboundRide._id, { $set: { trackingId: outTracking._id } });

    let returnRide = null, retDistKm = null, retDurMin = null, retPolyline = null;

    if (includeReturn) {
      // Return leg = reversed direction, own canonical route
      const retRoute = await calculateCanonicalRoute(dropoffCoords, pickupCoords);
      retDistKm   = retRoute.distanceKm;
      retDurMin   = retRoute.durationMin;
      retPolyline = retRoute.polyline;

      returnRide = await Ride.create({
        ...buildRidePayload({
          bookingId: booking._id, rideType: 'patient', vehicleClass,
          pickupCoords: dropoffCoords, pickupAddress: destinationLocation.address, pickupCity: destinationLocation.city,
          dropoffCoords: pickupCoords, dropoffAddress: patientLocation.address, dropoffCity: patientLocation.city,
          scheduledPickupAt: scheduledDate, isReturnRide: true, createdBy: req.user._id,
        }),
        estimatedDistanceKm:  retDistKm,
        estimatedDurationMin: retDurMin,
      });

      const retTracking = await RideTracking.create({
        ride: returnRide._id, booking: booking._id, expectedRoutePolyline: retPolyline,
      });
      await Ride.findByIdAndUpdate(returnRide._id, { $set: { trackingId: retTracking._id } });
    }

    booking.primaryRide = outboundRide._id;
    booking.rides       = [outboundRide._id];
    if (returnRide) { booking.returnRide = returnRide._id; booking.rides.push(returnRide._id); }
    await booking.save();

    if (addConsultation) {
      opNumber = await generateOpNumber(hospitalId);
      await OutPatientRecord.create({
        opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
        patient: req.user._id, patientName: patientInfo.name,
        doctor: doctorId, hospital: hospitalId || null,
        consultationType: 'in_person', scheduledAt: scheduledDate,
        status: 'scheduled', consultationFee, feeSource: consultationSource,
        isCoveredBySubscription: consultationFee === 0 && isCoveredBySub,
        isFollowUp: false,
        followUpExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: req.user._id,
      });
      if (isCoveredBySub && subRef && consultationFee === 0) {
        await incrementSubscriptionUsage(subRef._id, 'consultationsUsed');
      }
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode, fareBreakdown,
        transportSummary: {
          distanceKm:    outDistKm,
          ratePerKm, kmRateSource,
          outboundFare:  transportCalc.outbound.totalFare,
          // Estimated waiting — actual waiting logged in RideTracking milestones
          waitingChargeEstimated: transportCalc.outbound.waitingCharge,
          waitingNote: 'Actual waiting charge recorded in ride tracking. Final charge may differ.',
          returnFare:    transportCalc.returnLeg?.totalFare ?? null,
          includeReturn,
          waitingMinutes: parsedWaitingMinutes,
          totalTransport: transportCalc.totalTransportFee,
        },
        mapRoutes: {
          outbound: {
            polyline:      outPolyline,
            distanceKm:    outDistKm,
            durationMin:   outDurMin,
            pickupCoords,  dropoffCoords,
            currentTarget: 'pickup',
          },
          return: includeReturn ? {
            polyline:      retPolyline,
            distanceKm:    retDistKm,
            durationMin:   retDurMin,
            pickupCoords:  dropoffCoords,
            dropoffCoords: pickupCoords,
          } : null,
        },
        consultationAdded: addConsultation,
        opNumber:          opNumber || null,
        rides: { outbound: outboundRide._id, return: returnRide?._id ?? null },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /patient-transport]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — PHYSIOTHERAPIST
// ═════════════════════════════════════════════════════════════════════════════

router.post('/physiotherapist', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      doctorId, scheduledAt, patientInfo,
      visitType = 'inPerson', slotId, documents = [],
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0, isCoveredBySubscription: false,
      doctorId, hospitalId: null,
      consultationType: visitType === 'homeVisit' ? 'homeVisit' : 'inPerson',
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType:      'physiotherapist',
      customer:         req.user._id,
      patientInfo,
      doctor:           doctorId,
      consultationType: visitType,
      scheduledAt:      scheduledDate,
      slotId:           slotId || null,
      documents,
      fareBreakdown,
      pricingSource:    pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus:    'unpaid',
      payments:         [],
      status:           'pending',
      createdBy:        req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    await createNotification({
      recipient: req.user._id, title: 'Physiotherapy Appointment Confirmed',
      body: `Your physiotherapy appointment (${booking.bookingCode}) is confirmed.`,
      type: 'BOOKING', bookingId: booking._id,
    });

    return res.status(201).json({
      success: true,
      data: { bookingId: booking._id, bookingCode: booking.bookingCode, visitType, fareBreakdown, razorpayOrder },
    });
  } catch (err) {
    console.error('[POST /physiotherapist]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — FOLLOW-UP
// FIX: followUpParentBooking set to followUpCheck.parentOp (was null before)
// ═════════════════════════════════════════════════════════════════════════════

router.post('/follow-up', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      doctorId, hospitalId, scheduledAt, patientInfo,
      consultationType = 'inPerson', slotId,
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const followUpCheck = await checkFollowUpEligibility({ customerId: req.user._id, doctorId, hospitalId });
    if (!followUpCheck.isEligible)
      return res.status(400).json({ success: false, message: followUpCheck.reason });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const { fee: consultationFee } = await resolveConsultationFee({
      isFollowUp: true, followUpFee: followUpCheck.followUpFee,
      isCoveredBySubscription: false, doctorId, hospitalId, consultationType,
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType:             'follow_up',
      customer:                req.user._id,
      patientInfo,
      doctor:                  doctorId,
      hospital:                hospitalId || null,
      consultationType,
      scheduledAt:             scheduledDate,
      slotId:                  slotId || null,
      followUpParentBooking:   followUpCheck.parentOp,  // FIX: was null
      followUpDiscountPercent: 0,
      fareBreakdown,
      pricingSource:           'doctor',
      paymentStatus:           'unpaid',
      payments:                [],
      status:                  'pending',
      createdBy:               req.user._id,
    });

    if (paymentMethod === 'Wallet' && fareBreakdown.totalAmount > 0) {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    const opNumber = await generateOpNumber(hospitalId);
    await OutPatientRecord.create({
      opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
      patient: req.user._id, patientName: patientInfo.name,
      doctor: doctorId, hospital: hospitalId || null,
      consultationType: 'follow_up', scheduledAt: scheduledDate,
      status: 'scheduled', consultationFee, feeSource: 'follow_up',
      isCoveredBySubscription: false, isFollowUp: true,
      parentOp: followUpCheck.parentOp,
      followUpExpiry: null, followUpFee: 0,
      createdBy: req.user._id,
    });

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    return res.status(201).json({
      success: true,
      data: {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        opNumber,
        fareBreakdown,
        followUpDetails: {
          parentOpNumber: followUpCheck.parentOpNumber,
          expiryWas:      followUpCheck.followUpExpiry,
          daysWereLeft:   followUpCheck.daysRemaining,
        },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /follow-up]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DIAGNOSTIC CENTER
// FIX: UserSubscription from shared exports (not inline re-import)
// ═════════════════════════════════════════════════════════════════════════════

router.post('/diagnostic-center', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      labId, tests = [], packages = [], scheduledAt,
      patientInfo, reportDeliveryMode = 'Digital (App)',
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!labId || !scheduledAt || !patientInfo || (!tests.length && !packages.length)) {
      return res.status(400).json({
        success: false,
        message: 'labId, scheduledAt, patientInfo, and tests or packages required',
      });
    }

    const lab = await getLabWithTests(labId);

    let diagnosticFee = 0;
    const testNames = [], packageNames = [];

    for (const testId of tests) {
      const t = lab.labTests.find(lt => lt._id.toString() === testId.toString());
      if (t) { diagnosticFee += t.discountedPrice ?? t.mrpPrice; testNames.push(t.testName); }
    }
    for (const pkgId of packages) {
      const p = lab.labPackages.find(lp => lp._id.toString() === pkgId.toString());
      if (p) { diagnosticFee += p.mrpPrice; packageNames.push(p.packageName); }
    }

    // Use UserSubscription from shared exports — no inline re-import
    const sub = await UserSubscription.findOne({
      user: req.user._id, status: { $in: ['Active', 'Trial'] }, expiryDate: { $gt: new Date() },
    }).lean();

    const discountPercent = sub?.limits?.diagnosticsDiscountPercent ?? 0;
    const discount        = discountPercent ? +(diagnosticFee * discountPercent / 100).toFixed(2) : 0;

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      diagnosticFee, discount, taxPercent: config?.tax?.diagnosticsGstPercent ?? 5,
    });

    const booking = await Booking.create({
      bookingType:  'diagnostic_center',
      customer:     req.user._id,
      patientInfo,
      scheduledAt:  new Date(scheduledAt),
      diagnosticDetails: { labPartner: labId, tests, testNames, packages, packageNames, reportDeliveryMode },
      fareBreakdown,
      pricingSource: 'platform',
      paymentStatus: 'unpaid',
      payments:      [],
      status:        'pending',
      createdBy:     req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        fareBreakdown, testNames, packageNames,
        diagnosticDiscount: { percent: discountPercent, amount: discount },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /diagnostic-center]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DIAGNOSTIC HOME
// FIX: lab→patient canonical route locked in RideTracking at creation.
// UserSubscription from shared exports.
// ═════════════════════════════════════════════════════════════════════════════

router.post('/diagnostic-home', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      labId, tests = [], packages = [], scheduledAt,
      patientInfo, patientLocation, reportDeliveryMode = 'Digital (App)',
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!labId || !scheduledAt || !patientInfo || !patientLocation?.coordinates) {
      return res.status(400).json({
        success: false,
        message: 'labId, scheduledAt, patientInfo, patientLocation.coordinates required',
      });
    }

    const lab = await getLabWithTests(labId);
    if (!['Home Collection', 'Both'].includes(lab.sampleCollectionMode)) {
      return res.status(400).json({ success: false, message: 'This lab does not offer home collection' });
    }

    let diagnosticFee = 0;
    const testNames = [], packageNames = [];

    for (const testId of tests) {
      const t = lab.labTests.find(lt => lt._id.toString() === testId.toString());
      if (t && t.homeCollectionAvailable) { diagnosticFee += t.discountedPrice ?? t.mrpPrice; testNames.push(t.testName); }
    }
    for (const pkgId of packages) {
      const p = lab.labPackages.find(lp => lp._id.toString() === pkgId.toString());
      if (p) { diagnosticFee += p.mrpPrice; packageNames.push(p.packageName); }
    }

    const homeCollectionFee = lab.homeCollectionFee ?? 0;

    const sub = await UserSubscription.findOne({
      user: req.user._id, status: { $in: ['Active', 'Trial'] }, expiryDate: { $gt: new Date() },
    }).lean();

    const discountPercent               = sub?.limits?.diagnosticsDiscountPercent ?? 0;
    const discount                      = discountPercent ? +(diagnosticFee * discountPercent / 100).toFixed(2) : 0;
    const hasHomeSampleCollectionInPlan = sub?.limits?.homeSampleCollection ?? false;
    const effectiveHomeCollectionFee    = hasHomeSampleCollectionInPlan ? 0 : homeCollectionFee;

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      diagnosticFee, homeCollectionFee: effectiveHomeCollectionFee,
      discount, taxPercent: config?.tax?.diagnosticsGstPercent ?? 5,
    });

    const scheduledDate = new Date(scheduledAt);

    const booking = await Booking.create({
      bookingType:  'diagnostic_home',
      customer:     req.user._id,
      patientInfo,
      scheduledAt:  scheduledDate,
      patientLocation: {
        type: 'Point', coordinates: patientLocation.coordinates,
        address: patientLocation.address, city: patientLocation.city, pincode: patientLocation.pincode,
      },
      diagnosticDetails: { labPartner: labId, tests, testNames, packages, packageNames, reportDeliveryMode },
      fareBreakdown,
      pricingSource: 'platform',
      paymentStatus: 'unpaid',
      payments:      [],
      status:        'pending',
      createdBy:     req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    // Lock canonical route: lab → patient address
    const labCoords = lab.registeredAddress?.location?.coordinates || [80.648, 16.506];
    const { distanceKm: techDistKm, durationMin: techDurMin, polyline: techPolyline } =
      await calculateCanonicalRoute(labCoords, patientLocation.coordinates);

    const techRide = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'diagnostic_tech',
        vehicleClass:      'two_wheeler',
        pickupCoords:      labCoords,
        pickupAddress:     lab.registeredAddress?.line1,
        pickupCity:        lab.registeredAddress?.city,
        dropoffCoords:     patientLocation.coordinates,
        dropoffAddress:    patientLocation.address,
        dropoffCity:       patientLocation.city,
        scheduledPickupAt: scheduledDate,
        createdBy:         req.user._id,
      }),
      estimatedDistanceKm:  techDistKm,
      estimatedDurationMin: techDurMin,
      // driver NOT set — assigned later
    });

    const techTracking = await RideTracking.create({
      ride:                  techRide._id,
      booking:               booking._id,
      expectedRoutePolyline: techPolyline, // LOCKED
    });
    await Ride.findByIdAndUpdate(techRide._id, { $set: { trackingId: techTracking._id } });

    booking.primaryRide = techRide._id;
    booking.rides       = [techRide._id];
    await booking.save();

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        fareBreakdown, testNames, packageNames,
        homeCollectionFeeWaived: hasHomeSampleCollectionInPlan,
        mapRoute: {
          polyline:      techPolyline,
          distanceKm:    techDistKm,
          durationMin:   techDurMin,
          pickupCoords:  labCoords,
          dropoffCoords: patientLocation.coordinates,
          currentTarget: 'pickup',
        },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /diagnostic-home]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — CARE ASSISTANT ONLY
// ═════════════════════════════════════════════════════════════════════════════

router.post('/care-assistant', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      patientInfo, patientLocation, scheduledAt,
      durationHours = 4, paymentMethod = 'Razorpay',
    } = req.body;

    if (!patientInfo || !patientLocation?.coordinates || !scheduledAt)
      return res.status(400).json({ success: false, message: 'patientInfo, patientLocation.coordinates, scheduledAt required' });

    const careAssistant = await autoAssignCareAssistant({
      patientCoords: patientLocation.coordinates,
      city:          patientLocation.city || 'Vijayawada',
    });
    if (!careAssistant)
      return res.status(503).json({ success: false, message: 'No care assistant available. Please try again shortly.' });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config        = await PlatformPricingConfig.getGlobal();
    const parsedDuration = parseInt(durationHours, 10) || 4;
    const tier           = PlatformPricingConfig.resolveCareAssistantTier?.(config, parsedDuration) ?? null;

    const fareBreakdown = buildFareBreakdown({
      careAssistantFee: tier?.chargeToUser ?? 0,
      taxPercent:       config?.tax?.careAssistantGstPercent ?? 18,
    });

    const booking = await Booking.create({
      bookingType:   'care_assistant',
      customer:      req.user._id,
      patientInfo,
      careAssistant: careAssistant._id,
      scheduledAt:   new Date(scheduledAt),
      patientLocation: {
        type: 'Point', coordinates: patientLocation.coordinates,
        address: patientLocation.address, city: patientLocation.city,
      },
      fareBreakdown,
      pricingSource: 'platform',
      paymentStatus: 'unpaid',
      payments:      [],
      status:        'pending',
      createdBy:     req.user._id,
      careAssistantSnapshot: {
        name:     careAssistant.fullName,
        photoUrl: careAssistant.photoUrl,
        phone:    careAssistant.phone,
      },
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    return res.status(201).json({
      success: true,
      data: {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        fareBreakdown,
        careAssistantAssigned: {
          id: careAssistant._id, name: careAssistant.fullName,
          phone: careAssistant.phone, photoUrl: careAssistant.photoUrl,
        },
        durationHours:  parsedDuration,
        pricingTier:    tier?.label ?? 'Standard',
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /care-assistant]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});


// POST /verify-payment  — call after Razorpay frontend success callback
router.post('/verify-payment', protect, async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid)
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });

    const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.paymentStatus = 'paid';
    booking.payments.push({
      gateway:       'Razorpay',
      transactionId: razorpay_payment_id,
      orderId:       razorpay_order_id,
      paymentMode:   'Other',
      amount:        booking.fareBreakdown.totalAmount,
      status:        'success',
      paidAt:        new Date(),
    });
    booking.fareBreakdown.amountPaid = booking.fareBreakdown.totalAmount;
    booking.updatedBy = req.user._id;
    await booking.save();

    res.json({ success: true, message: 'Payment verified', data: { bookingId, paymentStatus: 'paid' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

router.get('/my-bookings', protect, authorize('customer'), async (req, res) => {
  try {
    const { status, bookingType, page = '1', limit = '10' } = req.query;
    const filter = { customer: req.user._id };
    if (status)      filter.status      = status;
    if (bookingType) filter.bookingType = bookingType;

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Booking.countDocuments(filter);

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('doctor',        'user specialization profilePhotoUrl')
      .populate('hospital',      'name address')
      .populate('careAssistant', 'fullName photoUrl phone')
      .populate('primaryRide',   'status rideCode scheduledPickupAt driverSnapshot vehicleSnapshot')
      .select('-internalNotes -__v')
      .lean();

    res.json({
      success: true,
      total, page: parseInt(page, 10), limit: parseInt(limit, 10),
      data: bookings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/my-bookings/:bookingId', protect, authorize('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id })
      .populate('doctor',        'user specialization profilePhotoUrl registrationNumber')
      .populate('hospital',      'name address contact location')
      .populate('careAssistant', 'fullName photoUrl phone specializations')
      .populate('rides',         'status rideCode driverSnapshot scheduledPickupAt liveLocation estimatedDistanceKm estimatedDurationMin trackingId pickup dropoff')
      .populate('diagnosticDetails.labPartner', 'labName registeredAddress')
      .select('-internalNotes -__v')
      .lean();

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Return canonical polyline from RideTracking for customer map display
    let mapRoute = null;
    if (booking.primaryRide?.trackingId) {
      const trackingDoc = await RideTracking.findById(booking.primaryRide.trackingId)
        .select('expectedRoutePolyline currentEtaMinutes totalDistanceKm')
        .lean();
      if (trackingDoc) {
        mapRoute = {
          polyline:          trackingDoc.expectedRoutePolyline,
          currentEtaMinutes: trackingDoc.currentEtaMinutes,
          totalDistanceKm:   trackingDoc.totalDistanceKm,
          pickupCoords:      booking.primaryRide.pickup?.coordinates,
          dropoffCoords:     booking.primaryRide.dropoff?.coordinates,
        };
      }
    }

    res.json({ success: true, data: { ...booking, mapRoute } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/my-bookings/:bookingId/cancel', protect, authorize('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel booking in status: ${booking.status}` });
    }

    let refundPercent = 0, refundAmount = 0;
    if (['paid', 'partially_paid'].includes(booking.paymentStatus)) {
      ({ refundPercent, refundAmount } = await computeRefundAmount(booking));
    }

    booking.status       = 'cancelled';
    booking.cancellation = {
      cancelledBy:       'customer',
      cancelledByUserId: req.user._id,
      reason:            req.body.reason || 'Customer cancelled',
      refundEligible:    refundAmount > 0,
      refundPercent,
      cancelledAt:       new Date(),
    };
    booking.fareBreakdown.refundAmount = refundAmount;
    booking.updatedBy = req.user._id;
    await booking.save();

    if (booking.rides?.length) {
      await Ride.updateMany(
        { _id: { $in: booking.rides }, status: { $in: ['requested', 'searching', 'driver_assigned'] } },
        {
          $set: {
            status: 'cancelled',
            cancellation: {
              cancelledBy: 'customer', cancelledByUserId: req.user._id, cancelledAt: new Date(),
            },
          },
        }
      );
    }

    await createNotification({
      recipient: req.user._id, title: 'Booking Cancelled',
      body:      `Booking ${booking.bookingCode} cancelled. Refund: ₹${refundAmount} (${refundPercent}%)`,
      type:      'BOOKING', bookingId: booking._id,
    });

    res.json({
      success: true,
      message: 'Booking cancelled',
      data: { refundPercent, refundAmount, status: 'cancelled' },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/my-bookings/:bookingId/rate', protect, authorize('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id });
    if (!booking)                       return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'completed') return res.status(400).json({ success: false, message: 'Can only rate completed bookings' });
    if (booking.isRated)                return res.status(400).json({ success: false, message: 'Already rated' });

    const {
      overallRating, overallComment,
      doctorRating, doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating, driverComment,
      labRating, labComment,
    } = req.body;

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ success: false, message: 'overallRating (1-5) required' });
    }

    booking.rating = {
      overallRating, overallComment,
      doctorRating,  doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating,  driverComment,
      labRating,     labComment,
      ratedAt:  new Date(),
      isPublic: true,
    };
    booking.isRated   = true;
    booking.updatedBy = req.user._id;
    await booking.save();

    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// GET /my-bookings/:bookingId/op-download
// Customer downloads OP zip by bookingId (no need to know opNumber)
router.get('/my-bookings/:bookingId/op-download',
  protect, authorize('customer'),
  async (req, res) => {
    try {
      const booking = await Booking.findOne({
        _id:      req.params.bookingId,
        customer: req.user._id,
      }).select('bookingCode customer').lean();
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const op = await OutPatientRecord.findOne({ booking: req.params.bookingId }).lean();
      if (!op)
        return res.status(404).json({ success: false, message: 'No OP record for booking' });

      const { generateOpHtml, buildOpZipBuffer } = await import('../utils/opDocumentGenerator.js');
      const { default: DoctorProfile }            = await import('../models/DoctorProfile.js');
      const { default: Hospital }                 = await import('../models/Hospital.js');
      const { default: User }                     = await import('../models/User.js');

      const [patient, doctor, hospital, followUps] = await Promise.all([
        User.findById(op.patient).select('name email phone').lean(),
        op.doctor   ? DoctorProfile.findById(op.doctor).populate('user', 'name').lean() : null,
        op.hospital ? Hospital.findById(op.hospital).lean() : null,
        OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean(),
      ]);

      const html  = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
      const zip   = await buildOpZipBuffer(html, op.opNumber);
      const fname = `${op.opNumber.replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      return res.send(zip);
    } catch (err) {
      console.error('[GET /my-bookings/:bookingId/op-download]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);


router.get('/platform-pricing', async (req, res) => {
  try {
    // 1. Fetch the global config
    // We use .select to only pull the specific field from MongoDB for better performance
    const config = await PlatformPricingConfig.findOne({ 
      configName: 'global', 
      isActive: true 
    }).select('careAssistant.pricingTiers');

    // 2. Handle case where config might not exist yet
    if (!config) {
      return res.status(404).json({ 
        success: false, 
        message: "Platform pricing configuration not found." 
      });
    }

    // 3. Return only the array of pricing tiers
    res.json({ 
      success: true, 
      data: config.careAssistant.pricingTiers 
    });
    
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;