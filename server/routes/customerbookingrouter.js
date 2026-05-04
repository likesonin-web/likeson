 

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

  // Helpers — discovery
  getHospitals,
  getDoctorsByHospital,
  checkHospitalOrDoctorAvailability,
  getLabs,
  getLabWithTests,

  // Helpers — transport
  resolveKmRate,
  resolveTransportFare,
  autoAssignCareAssistant,

  // Helpers — consultation + follow-up
  checkFollowUpEligibility,
  checkSubscriptionConsultation,
  resolveConsultationFee,
  incrementSubscriptionUsage,
  decrementSubscriptionUsage,

  // Helpers — fare
  buildFareBreakdown,
  buildRidePayload,

  // Helpers — OP
  generateOpNumber,

  // Helpers — payment
  createRazorpayOrder,
  verifyRazorpaySignature,
  processWalletPayment,

  // Helpers — refund + misc
  computeRefundAmount,
  resolveServiceComponents,
  hashOtp,
  genOtp,
  haversineKm,
  createNotification,
  CUSTOMER_BOOKING_TYPES,
  DEFAULT_KM_RATE,
} from './bookingRouterShared.js';

const router = express.Router();

router.use(protect);
router.use(authorize('customer'));

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/hospitals', async (req, res) => {
  try {
    const { city, hospitalType } = req.query;
    const hospitals = await getHospitals({ city, hospitalType });
    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hospitals/:hospitalId/doctors', async (req, res) => {
  try {
    const doctors = await getDoctorsByHospital(req.params.hospitalId);
    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

router.get('/hospitals/:hospitalId/availability', async (req, res) => {
  try {
    const { scheduledAt } = req.query;
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt required' });

    const result = await checkHospitalOrDoctorAvailability({
      hospitalId: req.params.hospitalId,
      scheduledAt: new Date(scheduledAt),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/doctors/:doctorId/availability', async (req, res) => {
  try {
    const { scheduledAt, hospitalId } = req.query;
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt required' });

    const result = await checkHospitalOrDoctorAvailability({
      hospitalId,
      doctorId:   req.params.doctorId,
      scheduledAt: new Date(scheduledAt),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/labs', async (req, res) => {
  try {
    const { city, labType, homeCollection } = req.query;
    const labs = await getLabs({
      city,
      labType,
      homeCollection: homeCollection === 'true',
    });
    res.json({ success: true, count: labs.length, data: labs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/labs/:labId', async (req, res) => {
  try {
    const lab = await getLabWithTests(req.params.labId);
    res.json({ success: true, data: lab });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

router.get('/booking-options/:type', (req, res) => {
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
      description: 'Doctor consultation + care assistant attendance + transport to hospital and back.',
      steps: [
        'Select hospital',
        'Select doctor and slot',
        'Transport calculated: your location → hospital',
        'Care assistant auto-assigned (nearest available)',
        'Choose: return home transport or drop at hospital only',
      ],
      notes: [
        'Transport cost: subscription rate or ₹12/km default',
        'Care assistant assigned automatically — no manual selection',
        'Consultation fee charged separately (subscription may cover it)',
      ],
    },
    doctor_consultation: {
      description: 'In-person doctor visit at hospital or clinic.',
      steps: [
        'Select hospital (optional for doctor-owner clinics)',
        'Select doctor and specialization',
        'Check slot availability',
        'Consultation fee resolved (subscription → hospital → doctor → default)',
      ],
      notes: [
        'No transport included — patient commutes independently',
        'Subscription consultation quota checked before charging',
      ],
    },
    doctor_online: {
      description: 'Video or audio consultation from home.',
      steps: [
        'Select doctor',
        'Check availability',
        'Meeting link generated on confirmation',
      ],
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
      notes: ['Pricing by duration tier (see platform pricing)', 'No manual selection of care assistant'],
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
        'Transport for technician calculated',
      ],
      notes: ['Home collection fee added', 'Subscription diagnostic discount applies'],
    },
    patient_transport: {
      description: 'Standalone transport: pickup to drop-off.',
      steps: [
        'Enter pickup location',
        'Enter drop-off location',
        'Fare estimated: km × rate (subscription or ₹12 default)',
        'Choose: return home (drop → pickup) optional',
        'Choose: waiting at destination (waiting charges apply)',
        'Optionally add hospital + doctor visit (OP consultation fee charged separately)',
      ],
      notes: [
        'Return home: separate ride, same km rate',
        'Waiting: ₹2/min after 5 free minutes',
        'Adding a doctor = you PAY for the consultation separately',
        'No care assistant in standalone transport',
      ],
    },
    follow_up: {
      description: 'Follow-up to a prior consultation.',
      steps: [
        'System checks your last consultation (same doctor, same hospital)',
        'Must be within follow-up validity window',
        'Discounted or free follow-up fee applied',
      ],
      notes: [
        'Strict rule: same doctor + same hospital as original consultation',
        'Window checked automatically — no manual overrides',
      ],
    },
  };

  res.json({
    success: true,
    data: {
      bookingType: type,
      components,
      features: featureDescriptions[type] || {},
    },
  });
});

/**
 * GET /transport/estimate
 * FIX #6: validate bookingType whitelist
 */
router.get('/transport/estimate', async (req, res) => {
  try {
    const {
      pickupLng, pickupLat,
      dropoffLng, dropoffLat,
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

    // FIX #6 — validate bookingType so resolveTransportFare gets a known value
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
        note: includeReturn === 'false'
          ? 'Return home not included. Add ?includeReturn=true to see return fare.'
          : 'Return home fare included.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/follow-up/check', async (req, res) => {
  try {
    const { doctorId, hospitalId } = req.query;
    if (!doctorId)
      return res.status(400).json({ success: false, message: 'doctorId required' });

    const result = await checkFollowUpEligibility({
      customerId: req.user._id,
      doctorId,
      hospitalId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — FULL CARE RIDE
// FIX #3 (wallet bookingId) applied here
// ─────────────────────────────────────────────────────────────────────────────

router.post('/full-care-ride', async (req, res) => {
  try {
    const {
      hospitalId,
      doctorId,
      scheduledAt,
      consultationType  = 'inPerson',
      patientInfo,
      patientLocation,
      destinationLocation,
      includeReturnHome = false,
      slotId,
      documents         = [],
      paymentMethod     = 'Razorpay',
      couponCode,
      coinsToRedeem     = 0,
    } = req.body;

    if (!hospitalId || !doctorId || !scheduledAt || !patientInfo || !patientLocation) {
      return res.status(400).json({
        success: false,
        message: 'hospitalId, doctorId, scheduledAt, patientInfo, patientLocation required',
      });
    }
    if (!patientLocation?.coordinates?.length) {
      return res.status(400).json({
        success: false,
        message: 'patientLocation.coordinates [lng, lat] required',
      });
    }

    const scheduledDate = new Date(scheduledAt);

    const avail = await checkHospitalOrDoctorAvailability({
      hospitalId, doctorId, scheduledAt: scheduledDate,
    });
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
      return res.status(400).json({
        success: false,
        message: 'Hospital location not available. Provide destinationLocation.',
      });
    }

    const subCheck = await checkSubscriptionConsultation(req.user._id);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId, consultationType,
    });

    const { ratePerKm, source: kmRateSource } = await resolveKmRate(req.user._id);
    const pickupCoords  = patientLocation.coordinates;
    const dropoffCoords = hospCoords;

    const transportCalc = resolveTransportFare({
      bookingType:  'full_care_ride',
      pickupCoords, dropoffCoords, ratePerKm,
      includeReturn: includeReturnHome,
    });

    const careAssistant = await autoAssignCareAssistant({
      patientCoords: pickupCoords,
      city: patientLocation.city || hospital.address?.city || 'Vijayawada',
    });
    if (!careAssistant) {
      return res.status(503).json({
        success: false,
        message: 'No care assistant available at this time. Please try again shortly.',
      });
    }

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config = await PlatformPricingConfig.getGlobal();
    const caTier = config?.careAssistant?.pricingTiers?.find(t => t.isActive) || null;
    const careAssistantFee = caTier?.chargeToUser ?? 0;

    const taxPercent = config?.tax?.consultationGstPercent ?? 0;
    const fareBreakdown = buildFareBreakdown({
      consultationFee,
      careAssistantFee,
      transportFee: transportCalc.totalTransportFee,
      taxPercent,
      couponDiscount: 0,
      walletApplied:  0,
    });

    // ── Create booking first (wallet needs real bookingId) ──────────────────
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

    // FIX #3 — wallet processed AFTER booking created, with real bookingId
    let walletPaymentRecord = null;
    if (paymentMethod === 'Wallet') {
      walletPaymentRecord = await processWalletPayment({
        userId:      req.user._id,
        amount:      fareBreakdown.totalAmount,
        bookingId:   booking._id,       // real ID now
        bookingCode: booking.bookingCode,
      });
      fareBreakdown.walletApplied = fareBreakdown.totalAmount;
      fareBreakdown.amountPaid    = 0;

      booking.paymentStatus            = 'paid';
      booking.payments                 = [walletPaymentRecord];
      booking.fareBreakdown.walletApplied = fareBreakdown.totalAmount;
      booking.fareBreakdown.amountPaid    = 0;
      await booking.save();
    }

    // ── Rides ───────────────────────────────────────────────────────────────
    const outboundRide = await Ride.create(buildRidePayload({
      bookingId: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler',
      pickupCoords, pickupAddress: patientLocation.address, pickupCity: patientLocation.city,
      dropoffCoords,
      dropoffAddress: destinationLocation?.address || hospital.address?.line1,
      dropoffCity:    destinationLocation?.city    || hospital.address?.city,
      scheduledPickupAt: scheduledDate, isReturnRide: false, createdBy: req.user._id,
    }));

    let returnRide = null;
    if (includeReturnHome) {
      returnRide = await Ride.create(buildRidePayload({
        bookingId: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler',
        pickupCoords: dropoffCoords,
        pickupAddress: destinationLocation?.address || hospital.address?.line1,
        pickupCity:    destinationLocation?.city    || hospital.address?.city,
        dropoffCoords: pickupCoords,
        dropoffAddress: patientLocation.address, dropoffCity: patientLocation.city,
        scheduledPickupAt: scheduledDate, isReturnRide: true, createdBy: req.user._id,
      }));
    }

    booking.primaryRide = outboundRide._id;
    booking.rides       = [outboundRide._id];
    if (returnRide) { booking.returnRide = returnRide._id; booking.rides.push(returnRide._id); }
    await booking.save();

    // ── OP Record ───────────────────────────────────────────────────────────
    const opNumber = await generateOpNumber(hospitalId);
    const followUpValidDays = hospital.managementModel === 'hospital-manager'
      ? (hospital.consultationPricing?.followUpValidDays ?? 7) : 7;

    await OutPatientRecord.create({
      opNumber,
      booking: booking._id, bookingNumber: booking.bookingCode,
      patient: req.user._id, patientName: patientInfo.name,
      doctor: doctorId, hospital: hospitalId,
      consultationType: 'in_person', scheduledAt: scheduledDate,
      status: 'scheduled', consultationFee, feeSource: pricingSource,
      isCoveredBySubscription, isFollowUp: false,
      followUpExpiry: new Date(Date.now() + followUpValidDays * 24 * 60 * 60 * 1000),
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
        fareBreakdown.totalAmount,
        booking.bookingCode,
        { customerId: req.user._id.toString() }
      );
    }

    await createNotification({
      recipient: req.user._id, title: 'Booking Confirmed',
      body: `Your full care ride (${booking.bookingCode}) is confirmed for ${scheduledDate.toLocaleString('en-IN')}.`,
      type: 'BOOKING', bookingId: booking._id,
    });

    res.status(201).json({
      success: true,
      message: 'Full care ride booked successfully',
      data: {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        status:      booking.status,
        scheduledAt: booking.scheduledAt,
        fareBreakdown,
        transportSummary: {
          distanceKm:     transportCalc.distanceKm,
          ratePerKm, kmRateSource,
          outboundFare:   transportCalc.outbound.totalFare,
          returnFare:     transportCalc.returnLeg?.totalFare ?? null,
          includeReturn:  includeReturnHome,
          totalTransport: transportCalc.totalTransportFee,
        },
        careAssistantAssigned: {
          id: careAssistant._id, name: careAssistant.fullName,
          phone: careAssistant.phone, photoUrl: careAssistant.photoUrl,
        },
        rides: { outbound: outboundRide._id, return: returnRide?._id ?? null },
        opNumber,
        consultationCoveredBySubscription: isCoveredBySubscription,
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /full-care-ride]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — DOCTOR CONSULTATION (in-person)
// FIX #3 applied
// ─────────────────────────────────────────────────────────────────────────────

router.post('/doctor-consultation', async (req, res) => {
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

    const subCheck = await checkSubscriptionConsultation(req.user._id);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId, consultationType,
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config     = await PlatformPricingConfig.getGlobal();
    const taxPercent = config?.tax?.consultationGstPercent ?? 0;
    const fareBreakdown = buildFareBreakdown({ consultationFee, taxPercent });

    // FIX #3 — create booking first
    const booking = await Booking.create({
      bookingType:     'doctor_consultation',
      customer:        req.user._id,
      patientInfo,
      doctor:          doctorId,
      hospital:        hospitalId || null,
      consultationType,
      scheduledAt:     scheduledDate,
      slotId:          slotId || null,
      documents,
      fareBreakdown,
      pricingSource: pricingSource === 'hospital' ? 'hospital' : pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus:  'unpaid',
      payments:       [],
      couponCode:     couponCode || undefined,
      coinsRedeemed:  coinsToRedeem,
      status:         'pending',
      createdBy:      req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
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

    res.status(201).json({
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — DOCTOR ONLINE
// FIX #3 applied; FIX #9: usage only incremented when actually free
// ─────────────────────────────────────────────────────────────────────────────

router.post('/doctor-online', async (req, res) => {
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

    const subCheck = await checkSubscriptionConsultation(req.user._id);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId: null, consultationType: 'video',
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config     = await PlatformPricingConfig.getGlobal();
    const taxPercent = config?.tax?.consultationGstPercent ?? 0;
    const fareBreakdown = buildFareBreakdown({ consultationFee, taxPercent });

    // FIX #3 — booking first
    const booking = await Booking.create({
      bookingType:     'doctor_online',
      customer:        req.user._id,
      patientInfo,
      doctor:          doctorId,
      consultationType:'video',
      scheduledAt:     scheduledDate,
      onlineConsultation: { platform: 'Likeson Chat' },
      documents,
      fareBreakdown,
      pricingSource: pricingSource === 'hospital' ? 'hospital' : pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus: 'unpaid',
      payments:      [],
      status:        'pending',
      createdBy:     req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
      await booking.save();
    }

    // FIX #9 — only increment when consultation fee is actually 0 (free via subscription)
    if (isCoveredBySubscription && subCheck.sub && consultationFee === 0) {
      await incrementSubscriptionUsage(subCheck.sub._id, 'consultationsUsed');
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        fareBreakdown,
        consultationCoveredBySubscription: isCoveredBySubscription,
        razorpayOrder,
        note: 'Meeting link will be sent on booking confirmation.',
      },
    });
  } catch (err) {
    console.error('[POST /doctor-online]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — PATIENT TRANSPORT
// FIX #3, #7 applied
// ─────────────────────────────────────────────────────────────────────────────

router.post('/patient-transport', async (req, res) => {
  try {
    const {
      patientInfo, patientLocation, destinationLocation, scheduledAt,
      includeReturn   = false,
      waitingMinutes  = 0,
      vehicleClass    = 'four_wheeler',
      addConsultation = false,
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

    const scheduledDate = new Date(scheduledAt);
    const pickupCoords  = patientLocation.coordinates;
    const dropoffCoords = destinationLocation.coordinates;
    // FIX #7 — always parse to int before use in calculations AND response
    const parsedWaitingMinutes = parseInt(waitingMinutes, 10) || 0;

    const { ratePerKm, source: kmRateSource } = await resolveKmRate(req.user._id);

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config = await PlatformPricingConfig.getGlobal();

    const freeWaitingMinutes = config?.transport?.waitingFreeMinutes     ?? 5;
    const waitingRatePerMin  = config?.transport?.waitingChargePerMinute ?? 2;

    const transportCalc = resolveTransportFare({
      bookingType:  'patient_transport',
      pickupCoords, dropoffCoords, ratePerKm,
      includeReturn,
      waitingMinutes:   parsedWaitingMinutes,   // FIX #7
      freeWaitingMinutes,
      waitingRatePerMin,
    });

    let consultationFee    = 0;
    let consultationSource = null;
    let opNumber           = null;
    let isCoveredBySub     = false;
    let subRef             = null;

    if (addConsultation) {
      if (!doctorId || !scheduledAt)
        return res.status(400).json({ success: false, message: 'doctorId and scheduledAt required when addConsultation=true' });

      const consultationAvail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
      if (!consultationAvail.available)
        return res.status(400).json({ success: false, message: consultationAvail.reason });

      const subCheck = await checkSubscriptionConsultation(req.user._id);
      isCoveredBySub = subCheck.allowed && subCheck.isFree;
      subRef         = subCheck.sub;

        const feeResult = await resolveConsultationFee({
        isFollowUp: false, followUpFee: 0,
        isCoveredBySubscription: isCoveredBySub, doctorId, hospitalId, consultationType,
      });
      consultationFee    = feeResult.fee;
      consultationSource = feeResult.source;
      // ✅ INCREMENT MOVED — do NOT increment here
    }

    const taxPercent = config?.tax?.transportGstPercent ?? 5;
    const fareBreakdown = buildFareBreakdown({
      consultationFee,
      transportFee: transportCalc.totalTransportFee,
      taxPercent,
    });

    // FIX #3 — booking first
    const booking = await Booking.create({
      bookingType:     'patient_transport',
      customer:        req.user._id,
      patientInfo,
      doctor:          addConsultation ? doctorId : null,
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
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
      await booking.save();
    }

    const outboundRide = await Ride.create(buildRidePayload({
      bookingId: booking._id, rideType: 'patient', vehicleClass,
      pickupCoords, pickupAddress: patientLocation.address, pickupCity: patientLocation.city,
      dropoffCoords, dropoffAddress: destinationLocation.address, dropoffCity: destinationLocation.city,
      scheduledPickupAt: scheduledDate, isReturnRide: false, createdBy: req.user._id,
    }));

    let returnRide = null;
    if (includeReturn) {
      returnRide = await Ride.create(buildRidePayload({
        bookingId: booking._id, rideType: 'patient', vehicleClass,
        pickupCoords: dropoffCoords, pickupAddress: destinationLocation.address, pickupCity: destinationLocation.city,
        dropoffCoords: pickupCoords, dropoffAddress: patientLocation.address, dropoffCity: patientLocation.city,
        scheduledPickupAt: scheduledDate, isReturnRide: true, createdBy: req.user._id,
      }));
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

      // ✅ FIX — increment AFTER booking confirmed + OP created
      if (isCoveredBySub && subRef && consultationFee === 0) {
        await incrementSubscriptionUsage(subRef._id, 'consultationsUsed');
      }
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode, fareBreakdown,
        transportSummary: {
          distanceKm:    transportCalc.distanceKm,
          ratePerKm, kmRateSource,
          outboundFare:  transportCalc.outbound.totalFare,
          waitingCharge: transportCalc.outbound.waitingCharge,
          returnFare:    transportCalc.returnLeg?.totalFare ?? null,
          includeReturn,
          waitingMinutes: parsedWaitingMinutes,   // FIX #7 — always int
          totalTransport: transportCalc.totalTransportFee,
        },
        consultationAdded: addConsultation,
        opNumber: opNumber || null,
        rides: { outbound: outboundRide._id, return: returnRide?._id ?? null },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /patient-transport]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// ✅ ADD NEW ROUTE — physiotherapist booking
router.post('/physiotherapist', async (req, res) => {
  try {
    const {
      doctorId, scheduledAt, patientInfo,
      visitType = 'inPerson', // 'inPerson' | 'homeVisit'
      slotId, documents = [],
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription: false,
      doctorId, hospitalId: null,
      consultationType: visitType === 'homeVisit' ? 'homeVisit' : 'inPerson',
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config     = await PlatformPricingConfig.getGlobal();
    const taxPercent = config?.tax?.consultationGstPercent ?? 0;
    const fareBreakdown = buildFareBreakdown({ consultationFee, taxPercent });

    const booking = await Booking.create({
      bookingType:     'physiotherapist',
      customer:        req.user._id,
      patientInfo,
      doctor:          doctorId,
      consultationType: visitType,
      scheduledAt:     scheduledDate,
      slotId:          slotId || null,
      documents,
      fareBreakdown,
      pricingSource:   pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus:   'unpaid',
      payments:        [],
      status:          'pending',
      createdBy:       req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
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

    res.status(201).json({
      success: true,
      data: {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        visitType,
        fareBreakdown,
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /physiotherapist]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — FOLLOW-UP
// FIX #1: followUpParentBooking set to followUpCheck.parentOp (not null)
// FIX #3: wallet uses real bookingId
// ─────────────────────────────────────────────────────────────────────────────

router.post('/follow-up', async (req, res) => {
  try {
    const {
      doctorId, hospitalId, scheduledAt, patientInfo,
      consultationType = 'inPerson', slotId, paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const followUpCheck = await checkFollowUpEligibility({
      customerId: req.user._id, doctorId, hospitalId,
    });
    if (!followUpCheck.isEligible)
      return res.status(400).json({ success: false, message: followUpCheck.reason });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: true, followUpFee: followUpCheck.followUpFee,
      isCoveredBySubscription: false, doctorId, hospitalId, consultationType,
    });

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config     = await PlatformPricingConfig.getGlobal();
    const taxPercent = config?.tax?.consultationGstPercent ?? 0;
    const fareBreakdown = buildFareBreakdown({ consultationFee, taxPercent });

    // FIX #1 + FIX #3 — create booking first with correct parentOp ref
    const booking = await Booking.create({
      bookingType:             'follow_up',
      customer:                req.user._id,
      patientInfo,
      doctor:                  doctorId,
      hospital:                hospitalId || null,
      consultationType,
      scheduledAt:             scheduledDate,
      slotId:                  slotId || null,
      followUpParentBooking:   followUpCheck.parentOp,   // FIX #1 — was null
      followUpDiscountPercent: 0,
      fareBreakdown,
      pricingSource:           'doctor',
      paymentStatus:           'unpaid',
      payments:                [],
      status:                  'pending',
      createdBy:               req.user._id,
    });

    if (paymentMethod === 'Wallet' && fareBreakdown.totalAmount > 0) {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,  // FIX #3
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
      await booking.save();
    }

    const opNumber = await generateOpNumber(hospitalId);
    await OutPatientRecord.create({
      opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
      patient: req.user._id, patientName: patientInfo.name,
      doctor: doctorId, hospital: hospitalId || null,
      consultationType: 'follow_up', scheduledAt: scheduledDate,
      status: 'scheduled', consultationFee,
      feeSource: 'follow_up', isCoveredBySubscription: false,
      isFollowUp: true, parentOp: followUpCheck.parentOp,
      followUpExpiry: null, followUpFee: 0,
      createdBy: req.user._id,
    });

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    res.status(201).json({
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — DIAGNOSTIC CENTER
// FIX #5 (removed redundant UserSubscription inline import — use shared export)
// FIX #3 applied
// ─────────────────────────────────────────────────────────────────────────────

router.post('/diagnostic-center', async (req, res) => {
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

    // FIX #5 — use shared UserSubscription export, no inline import
    const sub = await UserSubscription.findOne({
      user: req.user._id, status: { $in: ['Active', 'Trial'] }, expiryDate: { $gt: new Date() },
    }).lean();

    const discountPercent = sub?.limits?.diagnosticsDiscountPercent ?? 0;
    const discount        = discountPercent ? +(diagnosticFee * discountPercent / 100).toFixed(2) : 0;

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config     = await PlatformPricingConfig.getGlobal();
    const taxPercent = config?.tax?.diagnosticsGstPercent ?? 5;

    const fareBreakdown = buildFareBreakdown({ diagnosticFee, discount, taxPercent });

    // FIX #3 — booking first
    const booking = await Booking.create({
      bookingType:  'diagnostic_center',
      customer:     req.user._id,
      patientInfo,
      scheduledAt:  new Date(scheduledAt),
      diagnosticDetails: {
        labPartner: labId, tests, testNames, packages, packageNames, reportDeliveryMode,
      },
      fareBreakdown,
      pricingSource: 'platform',
      paymentStatus: 'unpaid',
      payments:      [],
      status:        'pending',
      createdBy:     req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    res.status(201).json({
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — DIAGNOSTIC HOME
// FIX #5 + FIX #3 applied
// ─────────────────────────────────────────────────────────────────────────────

router.post('/diagnostic-home', async (req, res) => {
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

    // FIX #5 — use shared UserSubscription export
    const sub = await UserSubscription.findOne({
      user: req.user._id, status: { $in: ['Active', 'Trial'] }, expiryDate: { $gt: new Date() },
    }).lean();

    const discountPercent = sub?.limits?.diagnosticsDiscountPercent ?? 0;
    const discount        = discountPercent ? +(diagnosticFee * discountPercent / 100).toFixed(2) : 0;
    const hasHomeSampleCollectionInPlan = sub?.limits?.homeSampleCollection ?? false;
    const effectiveHomeCollectionFee    = hasHomeSampleCollectionInPlan ? 0 : homeCollectionFee;

    const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
    const config     = await PlatformPricingConfig.getGlobal();
    const taxPercent = config?.tax?.diagnosticsGstPercent ?? 5;

    const fareBreakdown = buildFareBreakdown({
      diagnosticFee, homeCollectionFee: effectiveHomeCollectionFee, discount, taxPercent,
    });

    const scheduledDate = new Date(scheduledAt);

    // FIX #3 — booking first
    const booking = await Booking.create({
      bookingType:  'diagnostic_home',
      customer:     req.user._id,
      patientInfo,
      scheduledAt:  scheduledDate,
      patientLocation: {
        type: 'Point', coordinates: patientLocation.coordinates,
        address: patientLocation.address, city: patientLocation.city, pincode: patientLocation.pincode,
      },
      diagnosticDetails: {
        labPartner: labId, tests, testNames, packages, packageNames, reportDeliveryMode,
      },
      fareBreakdown,
      pricingSource: 'platform',
      paymentStatus: 'unpaid',
      payments:      [],
      status:        'pending',
      createdBy:     req.user._id,
    });

    if (paymentMethod === 'Wallet') {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
      await booking.save();
    }

    const labCoords = lab.registeredAddress?.location?.coordinates || [80.648, 16.506];
    const techRide  = await Ride.create(buildRidePayload({
      bookingId: booking._id, rideType: 'diagnostic_tech', vehicleClass: 'two_wheeler',
      pickupCoords: labCoords, pickupAddress: lab.registeredAddress?.line1, pickupCity: lab.registeredAddress?.city,
      dropoffCoords: patientLocation.coordinates, dropoffAddress: patientLocation.address, dropoffCity: patientLocation.city,
      scheduledPickupAt: scheduledDate, createdBy: req.user._id,
    }));

    booking.primaryRide = techRide._id;
    booking.rides       = [techRide._id];
    await booking.save();

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        fareBreakdown, testNames, packageNames,
        homeCollectionFeeWaived: hasHomeSampleCollectionInPlan,
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /diagnostic-home]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING — CARE ASSISTANT ONLY
// FIX #2: parseInt(durationHours) before tier resolve
// FIX #3: wallet uses real bookingId
// ─────────────────────────────────────────────────────────────────────────────

router.post('/care-assistant', async (req, res) => {
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
    const config = await PlatformPricingConfig.getGlobal();

    // FIX #2 — parseInt so numeric comparison in resolveCareAssistantTier works
    const parsedDuration   = parseInt(durationHours, 10) || 4;
    const tier             = PlatformPricingConfig.resolveCareAssistantTier(config, parsedDuration);
    const careAssistantFee = tier?.chargeToUser ?? 0;

    const taxPercent    = config?.tax?.careAssistantGstPercent ?? 18;
    const fareBreakdown = buildFareBreakdown({ careAssistantFee, taxPercent });

    // FIX #3 — booking first
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
        name: careAssistant.fullName, photoUrl: careAssistant.photoUrl, phone: careAssistant.phone,
      },
    });

    if (paymentMethod === 'Wallet') {
      const walletPaymentRecord = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid';
      booking.payments      = [walletPaymentRecord];
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        fareBreakdown,
        careAssistantAssigned: {
          id: careAssistant._id, name: careAssistant.fullName,
          phone: careAssistant.phone, photoUrl: careAssistant.photoUrl,
        },
        durationHours: parsedDuration,
        pricingTier: tier?.label ?? 'Standard',
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /care-assistant]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

router.get('/my-bookings', async (req, res) => {
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
      .populate('doctor',       'user specialization profilePhotoUrl')
      .populate('hospital',     'name address')
      .populate('careAssistant','fullName photoUrl phone')
      .populate('primaryRide',  'status rideCode scheduledPickupAt')
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

/**
 * FIX #8 — removed broken '-payments.notes' nested exclusion from select().
 * Mongoose does not support excluding sub-array fields this way; the field
 * was still being returned anyway. Removed to avoid confusion.
 */
router.get('/my-bookings/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id })
      .populate('doctor',        'user specialization profilePhotoUrl registrationNumber')
      .populate('hospital',      'name address contact location')
      .populate('careAssistant', 'fullName photoUrl phone specializations')
      .populate('rides',         'status rideCode driverSnapshot scheduledPickupAt liveLocation')
      .populate('diagnosticDetails.labPartner', 'labName registeredAddress')
      .select('-internalNotes -__v')   // FIX #8: removed invalid '-payments.notes'
      .lean();

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * FIX #4 — guard against computing refund when booking was never paid.
 * If paymentStatus is 'unpaid' or 'failed', refundAmount = 0 always.
 */
router.post('/my-bookings/:bookingId/cancel', async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking in status: ${booking.status}`,
      });
    }

    // FIX #4 — only compute real refund if customer actually paid
    const paidStatuses = ['paid', 'partially_paid'];
    let refundPercent  = 0;
    let refundAmount   = 0;

    if (paidStatuses.includes(booking.paymentStatus)) {
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
              cancelledBy: 'customer',
              cancelledByUserId: req.user._id,
              cancelledAt: new Date(),
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

router.post('/my-bookings/:bookingId/rate', async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id });
    if (!booking)                       return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'completed') return res.status(400).json({ success: false, message: 'Can only rate completed bookings' });
    if (booking.isRated)               return res.status(400).json({ success: false, message: 'Already rated' });

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
      doctorRating, doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating, driverComment,
      labRating, labComment,
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

 
 

export default router;