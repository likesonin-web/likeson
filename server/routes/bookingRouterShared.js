/**
 * bookingRouterShared.js — Likeson.in
 *
 * Single source of truth for all shared helpers, constants, and utilities
 * used across bookingRouter1.js, bookingRouter2.js, and bookingSocketService.js
 *
 * FIXES vs previous version:
 *  - calculateCanonicalRoute moved to top (ES module parse-order fix)
 *  - resolveCareRideKmRate no longer double-calls resolveKmRate
 *  - All exports at top-level (no dynamic import cycles for hot paths)
 *  - computeRefundAmount signature consistent
 *  - buildRidePayload returns status:'requested' always (callers override)
 */

import crypto   from 'crypto';
import axios    from 'axios';
import Razorpay from 'razorpay';

// ── Model Exports ─────────────────────────────────────────────────────────────
export { default as Booking }               from '../models/Booking.js';
export { default as Ride }                  from '../models/Ride.js';
export { default as RideTracking }          from '../models/RideTracking.js';
export { default as User }                  from '../models/User.js';
export { default as Driver }                from '../models/Driver.js';
export { default as SoloDriverPartner }     from '../models/SoloDriverPartner.js';
export { default as TransportPartner }      from '../models/TransportPartner.js';
export { default as CareAssistantProfile }  from '../models/CareAssistantProfile.js';
export { default as DoctorProfile }         from '../models/DoctorProfile.js';
export { default as Hospital }              from '../models/Hospital.js';
export { default as LabPartnerProfile }     from '../models/LabPartnerProfile.js';
export { default as Notification }          from '../models/Notification.js';
export { default as SystemLog }             from '../models/SystemLog.js';
export { default as OutPatientRecord }      from '../models/OutPatientRecord.js';
export { default as UserSubscription }      from '../models/UserSubscription.js';
export { default as SubscriptionPlan }      from '../models/SubscriptionPlan.js';
export { default as Wallet }                from '../models/Wallet.js';
export { default as PlatformPricingConfig } from '../models/PlatformPricingConfig.js';

// ── Util / Service Exports ────────────────────────────────────────────────────
export { default as sendEmail }             from '../utils/sendEmail.js';
export { default as sendSms }              from '../services/Sendsms.js';
export { generateBookingInvoicePdf }        from '../utils/bookingInvoiceGenerator.js';
export { getBookingSocketService }         from '../services/bookingSocketService.js';
export { transactionalTemplate, otpTemplate } from '../utils/emailTemplates.js';
export {
  rideBookedSms, driverAssignedSms, rideStartedSms, rideCompletedSms,
  rideCancelledSms, careAssistantAssignedSms, appointmentConfirmedSms,
  otpSms, paymentSuccessfulSms, newCareRequestToAssistantSms,
} from '../utils/Smstemplates.js';
export { protect, authorize } from '../middleware/authMiddleware.js';

// ── Razorpay ──────────────────────────────────────────────────────────────────
export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_KM_RATE = 21; // ₹21/km fallback

export const RIDE_STATUSES_ACTIVE = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived',  'otp_verified',    'in_progress', 'at_stop',
];

export const RADIUS_METERS      = 100_000; // 100 km hospital/general search
export const CARE_RIDE_RADIUS_M =  30_000; // 30 km care-ride driver search
export const TRANSPORT_RADIUS_M = 100_000; // 100 km dispatch

export const CUSTOMER_BOOKING_TYPES = [
  'full_care_ride',
  'doctor_consultation',
  'doctor_online',
  'physiotherapist',
  'care_assistant',
  'diagnostic_center',
  'diagnostic_home',
  'patient_transport',
  'follow_up',
];

// ─────────────────────────────────────────────────────────────────────────────
// BASIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** 6-digit numeric OTP */
export const genOtp = () => crypto.randomInt(100_000, 999_999).toString();

export const hashOtp = (otp) =>
  crypto
    .createHmac('sha256', process.env.OTP_SECRET || 'likeson-otp-secret')
    .update(String(otp).trim())
    .digest('hex');

/** Haversine km — [lng, lat] pairs */
export const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** In-app + push notification — fire-and-forget */
// In createNotification — add actionUrl + deepLink to Notification.create():
export const createNotification = async ({
  recipient, title, body, type, bookingId,
  priority = 'Medium', otp = undefined,
  actionUrl = undefined,          // ADD
  deepLink  = undefined,          // ADD
}) => {
  const { default: Notification } = await import('../models/Notification.js');
  try {
    await Notification.create({
      recipient, title, body, type, priority,
      ...(otp       ? { otp }       : {}),
      ...(actionUrl ? { actionUrl } : {}),   // ADD
      ...(deepLink  ? { deepLink }  : {}),   // ADD
      relatedEntityType: 'Booking',
      relatedEntityId:   bookingId,
      channels: [{ channel: 'InApp' }, { channel: 'Push' }],
    });
  } catch (e) { console.error('[createNotification]', e.message); }
};

/**
 * syncBookingStatusFromRide
 * Single source of truth: ride status → booking status.
 * Call after ANY Ride.status mutation (HTTP or socket).
 */
export const syncBookingStatusFromRide = async (bookingId, rideStatus, updatedBy) => {
  const { default: BookingModel } = await import('../models/Booking.js');

  const MAP = {
    driver_assigned: 'confirmed',
    driver_accepted: 'confirmed',
    driver_en_route: 'confirmed',
    driver_arrived:  'confirmed',
    otp_verified:    'in_progress',
    in_progress:     'in_progress',
    at_stop:         'in_progress',
    completed:       'completed',
    // cancelled: intentionally omitted — single ride cancel ≠ booking cancel
  };

  const newStatus = MAP[rideStatus];
  if (!newStatus) return null;

  return BookingModel.findByIdAndUpdate(
    bookingId,
    { $set: { status: newStatus, updatedBy } },
    { new: true }
  ).select('_id status bookingCode').lean();
};
// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL ROUTE CALCULATOR
// Must be defined before any function that calls it (ES module parse order).
// ─────────────────────────────────────────────────────────────────────────────

const GMAPS_KEY = process.env.GOOGLE_MAPS_KEY;

/**
 * calculateCanonicalRoute
 *
 * Call ONCE at ride creation. Result stored on:
 *   RideTracking.expectedRoutePolyline  (locked, never recalculated)
 *   Ride.estimatedDistanceKm            (locked)
 *   Ride.estimatedDurationMin           (locked)
 *
 * ALL roles read from DB — no party recalculates — everyone sees same map route.
 *
 * @param {number[]} pickupCoords  [lng, lat]
 * @param {number[]} dropoffCoords [lng, lat]
 * @returns {Promise<{ distanceKm: number, durationMin: number, polyline: string|null }>}
 */
export const calculateCanonicalRoute = async (pickupCoords, dropoffCoords) => {
  const safePickup  = pickupCoords  || [80.648, 16.506];
  const safeDropoff = dropoffCoords || [80.648, 16.506];

  if (!GMAPS_KEY) {
    const dist = haversineKm(safePickup, safeDropoff);
    return { distanceKm: +dist.toFixed(2), durationMin: Math.round(dist * 3), polyline: null };
  }

  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin:      `${safePickup[1]},${safePickup[0]}`,
        destination: `${safeDropoff[1]},${safeDropoff[0]}`,
        mode:        'driving',
        key:         GMAPS_KEY,
      },
      timeout: 8000,
    });

    const route = res.data?.routes?.[0];
    if (!route) throw new Error('No route returned');

    const leg = route.legs[0];
    return {
      distanceKm:  +(leg.distance.value / 1000).toFixed(2),
      durationMin: Math.round(leg.duration.value / 60),
      polyline:    route.overview_polyline.points, // encoded polyline — locked forever
    };
  } catch (err) {
    console.error('[calculateCanonicalRoute] GMaps fail → haversine fallback:', err.message);
    const dist = haversineKm(safePickup, safeDropoff);
    return { distanceKm: +dist.toFixed(2), durationMin: Math.round(dist * 3), polyline: null };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RIDE PAYLOAD BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export const buildRidePayload = ({
  bookingId,
  rideType,
  vehicleClass,
  pickupCoords,
  pickupAddress  = '',
  pickupCity     = '',
  dropoffCoords,
  dropoffAddress = '',
  dropoffCity    = '',
  scheduledPickupAt,
  isReturnRide   = false,
  createdBy,
}) => ({
  booking:   bookingId,
  rideType,
  vehicleClass,
  isReturnRide,
  pickup:  { type: 'Point', coordinates: pickupCoords,  address: pickupAddress,  city: pickupCity  },
  dropoff: { type: 'Point', coordinates: dropoffCoords, address: dropoffAddress, city: dropoffCity },
  scheduledPickupAt,
  status:    'requested',   // callers override (e.g. 'driver_assigned', 'searching')
  createdBy,
});

// ─────────────────────────────────────────────────────────────────────────────
// createAndLinkRide — SHARED helper (single definition, used by both routers)
//
// Creates Ride + RideTracking with LOCKED canonical route in one atomic sequence.
// Returns { ride, otp, distanceKm, durationMin, polyline }
// ─────────────────────────────────────────────────────────────────────────────

export const createAndLinkRide = async (booking, overrides = {}) => {
  const { default: Ride }         = await import('../models/Ride.js');
  const { default: RideTracking } = await import('../models/RideTracking.js');
  const { default: Booking }      = await import('../models/Booking.js');

  const coords = {
    pickupCoords:   booking.patientLocation?.coordinates     || [80.648, 16.506],
    pickupAddress:  booking.patientLocation?.address         || '',
    pickupCity:     booking.patientLocation?.city            || '',
    dropoffCoords:  booking.destinationLocation?.coordinates || [80.648, 16.506],
    dropoffAddress: booking.destinationLocation?.address     || '',
    dropoffCity:    booking.destinationLocation?.city        || '',
  };

  const otp = genOtp();

  const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
    coords.pickupCoords,
    coords.dropoffCoords,
  );

  const ride = await Ride.create({
    ...buildRidePayload({
      bookingId:         booking._id,
      rideType:          'patient',
      vehicleClass:      'four_wheeler',
      scheduledPickupAt: booking.scheduledAt,
      ...coords,
    }),
    estimatedDistanceKm:  distanceKm,
    estimatedDurationMin: durationMin,
   pickupOtp: hashOtp(otp),
    ...overrides,
  });

  const tracking = await RideTracking.create({
    ride:                  ride._id,
    booking:               booking._id,
    expectedRoutePolyline: polyline,    // LOCKED — never overwritten after this
  });

  await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

  await Booking.findByIdAndUpdate(booking._id, {
    $push: { rides: ride._id },
    $set:  { primaryRide: ride._id, status: 'confirmed' },
  });

  return { ride, otp, distanceKm, durationMin, polyline };
};

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getHospitals = async (filters = {}) => {
  const { default: Hospital } = await import('../models/Hospital.js');
  const query = { isActive: true, isVerified: true };
  if (filters.city)            query['address.city']   = { $regex: filters.city, $options: 'i' };
  if (filters.hospitalType)    query.hospitalType       = filters.hospitalType;
  if (filters.managementModel) query.managementModel    = filters.managementModel;
  return Hospital.find(query)
    .select(
      'name slug hospitalType managementModel address location contact ' +
      'specialties facilities accreditations operatingHours rating ' +
      'isEmergencyReady hasICU hasBloodBank hasPharmacy hasDiagnostics ' +
      'hasAmbulance hasWheelchairAccess is24x7 bedCount linkedDoctors'
    )
    .lean();
};

export const getDoctorsByHospital = async (hospitalId) => {
  const { default: Hospital }      = await import('../models/Hospital.js');
  const { default: DoctorProfile } = await import('../models/DoctorProfile.js');

  const hospital = await Hospital.findById(hospitalId)
    .select('managementModel consultationPricing linkedDoctors isActive isVerified')
    .lean();
  if (!hospital)                                    throw new Error('Hospital not found');
  if (!hospital.isActive || !hospital.isVerified)   throw new Error('Hospital not operational');

  const doctors = await DoctorProfile.find({
    _id:               { $in: hospital.linkedDoctors },
    partnershipStatus: 'Active',
    isActive:          true,
  })
    .populate('user', 'name avatar')
    .select(
      'user specialization qualifications experienceYears ' +
      'consultationTypes fees profilePhotoUrl biography languagesSpoken ' +
      'weeklyAvailability rating isOnline'
    )
    .lean();

  const isHospitalManaged = hospital.managementModel === 'hospital-manager';

  return doctors.map((doc) => {
    const cp = hospital.consultationPricing || {};
    const effectiveFees = isHospitalManaged
      ? {
          inPersonFee:             cp.inPersonFee  ?? 0,
          videoFee:                cp.videoFee     ?? 0,
          homeVisitFee:            cp.homeVisitFee ?? 0,
          followUpFee:             cp.followUpFee  ?? 0,
          followUpDiscountPercent: cp.followUpDiscountPercent ?? 0,
          followUpValidDays:       cp.followUpValidDays       ?? 7,
          source: 'hospital',
        }
      : {
          inPersonFee:             doc.fees?.inPersonFee             ?? 0,
          videoFee:                doc.fees?.videoFee                ?? 0,
          homeVisitFee:            doc.fees?.homeVisitFee            ?? 0,
          followUpFee:             doc.fees?.followUpFee             ?? 0,
          followUpDiscountPercent: doc.fees?.followUpDiscountPercent ?? 0,
          followUpValidDays:       doc.fees?.followUpValidDays       ?? 7,
          source: 'doctor',
        };
    return { ...doc, effectiveFees, hospitalManaged: isHospitalManaged };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const checkHospitalHours = (hospital, scheduledAt) => {
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduled = new Date(scheduledAt);
  const dayName   = dayNames[scheduled.getDay()];
  const reqMins   = scheduled.getHours() * 60 + scheduled.getMinutes();

  if (hospital.is24x7) return { available: true };
  const opDay = hospital.operatingHours?.find(h => h.day === dayName);
  if (!opDay)           return { available: false, reason: `No schedule for ${dayName}` };
  if (opDay.isClosed)   return { available: false, reason: `Closed on ${dayName}` };
  if (opDay.is24Hours)  return { available: true };

  const [oh, om] = (opDay.openTime  || '00:00').split(':').map(Number);
  const [ch, cm] = (opDay.closeTime || '23:59').split(':').map(Number);
  if (reqMins < oh * 60 + om || reqMins >= ch * 60 + cm) {
    return { available: false, reason: `Open ${opDay.openTime}–${opDay.closeTime} on ${dayName}` };
  }
  return { available: true };
};

export const checkDoctorAvailability = async (doctorProfileId, scheduledAt) => {
  const { default: DoctorProfile }    = await import('../models/DoctorProfile.js');
  const { default: Hospital }         = await import('../models/Hospital.js');
  const { default: OutPatientRecord } = await import('../models/OutPatientRecord.js');

  const doctor = await DoctorProfile.findById(doctorProfileId)
    .select('weeklyAvailability primaryHospital partnershipStatus isActive')
    .lean();
  if (!doctor) return { available: false, reason: 'Doctor not found' };
  if (doctor.partnershipStatus !== 'Active' || !doctor.isActive)
    return { available: false, reason: 'Doctor not active' };

  const dayNames  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduled = new Date(scheduledAt);
  const dayName   = dayNames[scheduled.getDay()];
  const reqMins   = scheduled.getHours() * 60 + scheduled.getMinutes();

  const dayEntry = doctor.weeklyAvailability?.find(d => d.day === dayName);
  if (!dayEntry?.isAvailable) return { available: false, reason: `Unavailable on ${dayName}` };

  const matchedSlot = dayEntry.slots?.find(s => {
    if (!s.isActive) return false;
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    return reqMins >= sh * 60 + sm && reqMins < eh * 60 + em;
  });
  if (!matchedSlot) return { available: false, reason: `No slot at that time on ${dayName}` };

  const CONSULT_DURATION_MIN = 20;
  const slotDate = new Date(scheduled);
  const [slotSh, slotSm] = matchedSlot.startTime.split(':').map(Number);
  const [slotEh, slotEm] = matchedSlot.endTime.split(':').map(Number);
  const slotStart = new Date(new Date(slotDate).setHours(slotSh, slotSm, 0, 0));
  const slotEnd   = new Date(new Date(slotDate).setHours(slotEh, slotEm, 0, 0));

  const existingInSlot = await OutPatientRecord.find({
    doctor:      doctorProfileId,
    status:      { $in: ['scheduled', 'in_progress'] },
    scheduledAt: { $gte: slotStart, $lt: slotEnd },
  }).select('scheduledAt').lean();

  if (existingInSlot.length >= matchedSlot.maxPatients) {
    const times = existingInSlot.map(r => new Date(r.scheduledAt).getTime()).sort((a,b) => b - a);
    const next  = new Date(times[0] + CONSULT_DURATION_MIN * 60 * 1000);
    const fmt   = next.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { available: false, reason: `Slot full. Next available: ${fmt}` };
  }

  const overlap = existingInSlot.find(r =>
    Math.abs(new Date(r.scheduledAt).getTime() - scheduled.getTime()) < CONSULT_DURATION_MIN * 60 * 1000
  );
  if (overlap) {
    const next = new Date(new Date(overlap.scheduledAt).getTime() + CONSULT_DURATION_MIN * 60 * 1000);
    const fmt  = next.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { available: false, reason: `Already booked. Next slot: ${fmt}` };
  }

  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select('managementModel operatingHours is24x7 isActive isVerified').lean();
    if (hospital?.managementModel === 'hospital-manager') {
      if (!hospital.isActive || !hospital.isVerified)
        return { available: false, reason: 'Hospital not operational' };
      const hospCheck = checkHospitalHours(hospital, scheduledAt);
      if (!hospCheck.available) return hospCheck;
    }
  }

  return { available: true };
};

export const checkHospitalOrDoctorAvailability = async ({ hospitalId, doctorId, scheduledAt }) => {
  const { default: Hospital } = await import('../models/Hospital.js');
  if (hospitalId) {
    const hospital = await Hospital.findById(hospitalId)
      .select('isActive isVerified operatingHours is24x7 managementModel').lean();
    if (!hospital)                                  return { available: false, reason: 'Hospital not found' };
    if (!hospital.isActive || !hospital.isVerified) return { available: false, reason: 'Hospital not operational' };
    const check = checkHospitalHours(hospital, scheduledAt);
    if (!check.available) return check;
  }
  if (doctorId) return checkDoctorAvailability(doctorId, scheduledAt);
  return { available: true };
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT / FARE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const resolveKmRate = async (userId) => {
  const { default: UserSubscription }      = await import('../models/UserSubscription.js');
  const { default: SubscriptionPlan }      = await import('../models/SubscriptionPlan.js');
  const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');

  const config     = await PlatformPricingConfig.getGlobal();
  const configRate = config?.transport?.defaultRatePerKm ?? DEFAULT_KM_RATE;

  const sub = await UserSubscription.findOne({
    user:       userId,
    status:     { $in: ['Active', 'Trial'] },
    expiryDate: { $gt: new Date() },
  }).lean();

  if (!sub) return { ratePerKm: configRate, source: 'default' };

  const planRate = sub.limits?.transportRatePerKm;
  if (planRate != null && planRate > 0) return { ratePerKm: planRate, source: 'subscription' };

  if (sub.plan) {
    const plan = await SubscriptionPlan.findById(sub.plan).select('transport').lean();
    if (plan?.transport?.ratePerKm > 0) return { ratePerKm: plan.transport.ratePerKm, source: 'subscription' };
  }

  return { ratePerKm: configRate, source: 'default' };
};

/**
 * resolveCareRideKmRate
 * FIX: was calling resolveKmRate then ignoring result, fetching config again.
 * Now: check subscription first, fallback to config care rate.
 */
export const resolveCareRideKmRate = async (userId) => {
  const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');

  // Check subscription rate first
  const { ratePerKm, source } = await resolveKmRate(userId);
  if (source === 'subscription') return { ratePerKm, source };

  // Fall back to config care-ride rate
  const config   = await PlatformPricingConfig.getGlobal();
  const careRate = config?.transport?.careRideRatePerKm ?? 21;
  return { ratePerKm: careRate, source: 'care_ride_config' };
};

export const computeLegFare = ({
  distanceKm,
  ratePerKm,
  waitingMinutes            = 0,
  freeWaitingMinutes        = 5,
  waitingRatePerMin         = 2,
  baseFare                  = 0,
  isNight                   = false,
  nightSurchargeMultiplier  = 1.2,
  isWheelchair              = false,
  wheelchairSurchargeAmount = 0,
}) => {
  const distanceFare   = +(distanceKm * ratePerKm).toFixed(2);
  const billableWait   = Math.max(0, waitingMinutes - freeWaitingMinutes);
  const waitingCharge  = +(billableWait * waitingRatePerMin).toFixed(2);
  const subtotal       = baseFare + distanceFare + waitingCharge;
  const nightSurcharge = isNight ? +(subtotal * (nightSurchargeMultiplier - 1)).toFixed(2) : 0;
  const wheelchairFee  = isWheelchair ? wheelchairSurchargeAmount : 0;
  const totalFare      = +(subtotal + nightSurcharge + wheelchairFee).toFixed(2);
  return { distanceFare, waitingCharge, nightSurcharge, wheelchairSurcharge: wheelchairFee, totalFare };
};

export const resolveTransportFare = ({
  bookingType,
  pickupCoords,
  dropoffCoords,
  ratePerKm,
  includeReturn             = false,
  waitingMinutes            = 0,
  freeWaitingMinutes        = 5,
  waitingRatePerMin         = 2,
  isNight                   = false,
  isWheelchair              = false,
  wheelchairSurchargeAmount = 0,
}) => {
  const distanceKm = haversineKm(pickupCoords, dropoffCoords);
  const legParams  = { distanceKm, ratePerKm, isNight, isWheelchair, wheelchairSurchargeAmount, freeWaitingMinutes, waitingRatePerMin };
  const outbound   = computeLegFare({ ...legParams, waitingMinutes: bookingType === 'patient_transport' ? waitingMinutes : 0 });
  const returnLeg  = includeReturn ? computeLegFare({ ...legParams, waitingMinutes: 0 }) : null;
  return { distanceKm: +distanceKm.toFixed(2), ratePerKm, outbound, returnLeg, includeReturn, totalTransportFee: +(outbound.totalFare + (returnLeg?.totalFare ?? 0)).toFixed(2) };
};

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const autoAssignCareAssistant = async ({ patientCoords, maxRadiusKm = 20 }) => {
  const { default: CareAssistantProfile } = await import('../models/CareAssistantProfile.js');
  const [lng, lat] = patientCoords;
  const candidates = await CareAssistantProfile.find({
    isActive:                   true,
    isBlocked:                  false,
    status:                     'Available',
    'kyc.verificationStatus':   'Verified',
    'verification.isVerified':  true,
    'availability.isOnline':    true,
    location: {
      $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: maxRadiusKm * 1000 },
    },
  })
    .select('user fullName photoUrl phone performance.averageRating location specializations')
    .limit(5)
    .lean();

  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.performance?.averageRating ?? 0) - (a.performance?.averageRating ?? 0));
  return candidates[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const checkFollowUpEligibility = async ({ customerId, doctorId, hospitalId }) => {
  const { default: OutPatientRecord } = await import('../models/OutPatientRecord.js');
  const { default: DoctorProfile }    = await import('../models/DoctorProfile.js');
  const { default: Hospital }         = await import('../models/Hospital.js');

  const doctor = await DoctorProfile.findById(doctorId)
    .select('primaryHospital partnershipStatus isActive').lean();
  if (!doctor || doctor.partnershipStatus !== 'Active' || !doctor.isActive)
    return { isEligible: false, reason: 'Doctor not active' };

  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select('managementModel isActive isVerified').lean();
    if (hospital?.managementModel === 'hospital-manager') {
      if (!hospitalId) return { isEligible: false, reason: 'Hospital ID required for this doctor' };
      if (hospitalId.toString() !== doctor.primaryHospital.toString())
        return { isEligible: false, reason: 'Follow-up must be at same hospital' };
    }
  }

  const query = {
    patient:        customerId,
    doctor:         doctorId,
    isFollowUp:     false,
    status:         { $in: ['scheduled', 'in_progress', 'completed'] },
    followUpExpiry: { $gt: new Date() },
  };
  if (hospitalId) query.hospital = hospitalId;

  const recentOp = await OutPatientRecord.findOne(query).sort({ createdAt: -1 }).lean();
  if (!recentOp) return { isEligible: false, reason: 'No valid original consultation found for follow-up' };

  return {
    isEligible:     true,
    parentOp:       recentOp._id,
    followUpFee:    recentOp.followUpFee || 0,
    parentOpNumber: recentOp.opNumber,
    followUpExpiry: recentOp.followUpExpiry,
    daysRemaining:  Math.ceil((new Date(recentOp.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24)),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const checkSubscriptionConsultation = async (userId) => {
  const { default: UserSubscription } = await import('../models/UserSubscription.js');
  const sub = await UserSubscription.findOne({
    user: userId, status: { $in: ['Active', 'Trial'] }, expiryDate: { $gt: new Date() },
  }).lean();

  if (!sub) return { allowed: false, sub: null, remaining: 0, isFree: false, reason: 'No active subscription' };

  const limit = sub.limits?.consultationsPerMonth ?? 0;
  if (limit === 0) return { allowed: false, sub, remaining: 0, isFree: false, reason: 'No consultation quota' };

  const now = new Date();
  const usage = sub.usageHistory?.find(u => u.month === now.getMonth() + 1 && u.year === now.getFullYear());
  const used  = usage?.consultationsUsed ?? 0;

  if (limit === -1) return { allowed: true, sub, remaining: Infinity, isFree: true, reason: 'Unlimited' };
  if (used >= limit) return { allowed: false, sub, remaining: 0, isFree: false, reason: `Monthly quota exhausted (${used}/${limit})` };
  return { allowed: true, sub, remaining: limit - used, isFree: true, reason: `${limit - used} remaining` };
};

export const incrementSubscriptionUsage = async (subId, field) => {
  const { default: UserSubscription } = await import('../models/UserSubscription.js');
  const now = new Date();
  const updated = await UserSubscription.findOneAndUpdate(
    { _id: subId, 'usageHistory.month': now.getMonth() + 1, 'usageHistory.year': now.getFullYear() },
    { $inc: { [`usageHistory.$.${field}`]: 1 } }
  );
  if (!updated) {
    await UserSubscription.findByIdAndUpdate(subId, {
      $push: { usageHistory: { month: now.getMonth() + 1, year: now.getFullYear(), [field]: 1 } },
    });
  }
};

export const decrementSubscriptionUsage = async (subId, field) => {
  const { default: UserSubscription } = await import('../models/UserSubscription.js');
  const now = new Date();
  await UserSubscription.findOneAndUpdate(
    { _id: subId, 'usageHistory.month': now.getMonth() + 1, 'usageHistory.year': now.getFullYear() },
    { $inc: { [`usageHistory.$.${field}`]: -1 } }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LAB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getLabs = async (filters = {}) => {
  const { default: LabPartnerProfile } = await import('../models/LabPartnerProfile.js');
  const query = { status: 'approved', isActive: true };
  if (filters.city)           query['registeredAddress.city'] = { $regex: filters.city, $options: 'i' };
  if (filters.labType)        query.labType                   = filters.labType;
  if (filters.homeCollection) query.sampleCollectionMode      = { $in: ['Home Collection', 'Both'] };
  return LabPartnerProfile.find(query)
    .select(
      'labName labCode labType ownershipType registeredAddress timing ' +
      'sampleCollectionMode homeCollectionRadius homeCollectionFee ' +
      'reportDeliveryModes avgTurnaroundHours averageRating totalReviews ' +
      'accreditations isFeatured logoUrl'
    )
    .lean();
};

export const getLabWithTests = async (labId) => {
  const { default: LabPartnerProfile } = await import('../models/LabPartnerProfile.js');
  const lab = await LabPartnerProfile.findOne({ _id: labId, status: 'approved', isActive: true })
    .select(
      'labName labCode labType registeredAddress timing branches ' +
      'sampleCollectionMode homeCollectionRadius homeCollectionFee ' +
      'reportDeliveryModes avgTurnaroundHours averageRating accreditations ' +
      'labTests labPackages contactPersons logoUrl'
    )
    .lean();
  if (!lab) throw new Error('Lab not found or not operational');
  lab.labTests    = (lab.labTests    || []).filter(t => t.isActive);
  lab.labPackages = (lab.labPackages || []).filter(p => p.isActive);
  return lab;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION FEE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export const resolveConsultationFee = async ({
  isFollowUp, followUpFee, isCoveredBySubscription,
  doctorId, hospitalId, consultationType,
}) => {
  if (isFollowUp)              return { fee: followUpFee || 0, source: 'follow_up' };
  if (isCoveredBySubscription) return { fee: 0,               source: 'subscription' };

  const { default: Hospital }      = await import('../models/Hospital.js');
  const { default: DoctorProfile } = await import('../models/DoctorProfile.js');

  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId).select('managementModel consultationPricing').lean();
    if (hosp?.managementModel === 'hospital-manager' && hosp.consultationPricing) {
      const cp     = hosp.consultationPricing;
      const feeMap = { inPerson: cp.inPersonFee, video: cp.videoFee, homeVisit: cp.homeVisitFee };
      return { fee: feeMap[consultationType] ?? cp.inPersonFee ?? 0, source: 'hospital' };
    }
  }

  if (doctorId) {
    const doc = await DoctorProfile.findById(doctorId).select('fees').lean();
    if (doc?.fees) {
      const feeMap = { inPerson: doc.fees.inPersonFee, video: doc.fees.videoFee, homeVisit: doc.fees.homeVisitFee };
      if (feeMap[consultationType] != null) return { fee: feeMap[consultationType], source: 'doctor' };
    }
  }

  return { fee: 600, source: 'default' };
};

// ─────────────────────────────────────────────────────────────────────────────
// FARE BREAKDOWN BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export const buildFareBreakdown = ({
  consultationFee   = 0,
  careAssistantFee  = 0,
  transportFee      = 0,
  diagnosticFee     = 0,
  pharmacyFee       = 0,
  bloodBankFee      = 0,
  homeCollectionFee = 0,
  platformFee       = 0,
  taxPercent        = 0,
  discount          = 0,
  couponDiscount    = 0,
  walletApplied     = 0,
} = {}) => {
  const subtotal    = consultationFee + careAssistantFee + transportFee + diagnosticFee +
                      pharmacyFee + bloodBankFee + homeCollectionFee + platformFee;
  const taxable     = Math.max(0, subtotal - discount - couponDiscount);
  const taxes       = taxPercent ? +(taxable * (taxPercent / 100)).toFixed(2) : 0;
  const totalAmount = +(taxable + taxes).toFixed(2);
  const amountPaid  = Math.max(0, +(totalAmount - walletApplied).toFixed(2));
  return {
    consultationFee, careAssistantFee, transportFee, diagnosticFee,
    pharmacyFee, bloodBankFee, homeCollectionFee, platformFee,
    taxes, discount, couponDiscount, walletApplied,
    totalAmount, amountPaid, refundAmount: 0, currency: 'INR',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OP NUMBER GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export const generateOpNumber = async (hospitalId) => {
  const { default: OutPatientRecord } = await import('../models/OutPatientRecord.js');
  const { default: Hospital }         = await import('../models/Hospital.js');
  const now  = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  let hospCode = 'GEN';
  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId).select('slug name').lean();
    if (hosp) hospCode = (hosp.slug || hosp.name || 'GEN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
  }
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const count = await OutPatientRecord.countDocuments({ createdAt: { $gte: startOfDay }, ...(hospitalId ? { hospital: hospitalId } : {}) });
  return `OP-${date}-${hospCode}-${String(count + 1).padStart(4, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const createRazorpayOrder = async (amountInRupees, bookingCode, notes = {}) => {
  if (amountInRupees <= 0) return null;
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100), currency: 'INR',
    receipt: bookingCode, notes: { bookingCode, ...notes },
  });
  return { orderId: order.id, amount: amountInRupees, currency: 'INR' };
};

export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const digest = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return digest === signature;
};

// ─────────────────────────────────────────────────────────────────────────────
// WALLET PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

export const processWalletPayment = async ({ userId, amount, bookingId, bookingCode }) => {
  const { default: Wallet } = await import('../models/Wallet.js');
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet)                          throw new Error('Wallet not found');
  if (wallet.availableBalance < amount) throw new Error(`Insufficient wallet balance. Available: ₹${wallet.availableBalance}`);
  await wallet.debit(amount, 'Booking_Payment', {
    referenceId: bookingId, onModel: 'Booking',
    description: `Payment for booking ${bookingCode}`, initiatedBy: userId,
  });
  return {
    gateway: 'Wallet', transactionId: `WALLET-${Date.now()}`,
    paymentMode: 'Wallet', amount, status: 'success', paidAt: new Date(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// REFUND COMPUTER
// ─────────────────────────────────────────────────────────────────────────────

export const computeRefundAmount = async (booking) => {
  const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
  const config         = await PlatformPricingConfig.getGlobal();
  const policy         = config?.refundPolicy || {};
  const thresholdHours = policy.rideFullRefundHoursThreshold ?? 24;
  const partialPercent = policy.ridePartialRefundPercent     ?? 50;
  const hoursUntil     = (new Date(booking.scheduledAt) - new Date()) / (1000 * 60 * 60);
  const refundPercent  = hoursUntil >= thresholdHours ? 100 : partialPercent;
  const refundAmount   = +((booking.fareBreakdown?.totalAmount ?? 0) * refundPercent / 100).toFixed(2);
  return { refundPercent, refundAmount };
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE COMPONENT RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export const resolveServiceComponents = (bookingType) => ({
  needsTransport:     ['full_care_ride', 'patient_transport', 'diagnostic_home'].includes(bookingType),
  needsCareAssistant: ['full_care_ride', 'care_assistant'].includes(bookingType),
  needsDoctor:        ['full_care_ride', 'doctor_consultation', 'doctor_online', 'physiotherapist', 'follow_up'].includes(bookingType),
  needsDiagnostic:    ['diagnostic_center', 'diagnostic_home'].includes(bookingType),
  needsPharmacy:      false,
  needsBloodBank:     false,
  isOnline:           bookingType === 'doctor_online',
  isFollowUpType:     bookingType === 'follow_up',
  needsReturnOption:  ['full_care_ride', 'patient_transport'].includes(bookingType),
  needsWaitingOption: bookingType === 'patient_transport',
  canAddDoctor:       bookingType === 'patient_transport',
});