/**
 * BOOKING ROUTER — SHARED IMPORTS, HELPERS & MIDDLEWARE — Likeson.in
 *
 * FIXES:
 *  1. resolveServiceComponents() maps all BOOKING_TYPES (pharmacy/blood_bank REMOVED from customer-facing)
 *  2. hashOtp() for Ride.pickupOtp
 *  3. buildFareBreakdown() correct schema fields
 *  4. buildRidePayload() GeoJSON pickup/dropoff
 *  5. computeRefundAmount() uses PlatformPricingConfig.refundPolicy
 *  6. processWalletPayment() debits Wallet correctly
 *  7. decrementSubscriptionUsage() for cancellation reversal
 *  8. getHospitals() — list all active verified hospitals
 *  9. getDoctorsByHospital() — doctors with specialization for a hospital
 * 10. checkHospitalOrDoctorAvailability() — combined availability check
 * 11. resolveTransportFare() — km-based fare with subscription override (12₹ default)
 * 12. resolveKmRate() — subscription plan km rate OR 12₹/km
 * 13. checkFollowUpEligibility() — same hospital + same doctor strict check
 * 14. checkSubscriptionConsultation() — valid count check
 * 15. getLabsWithTests() — list labs + tests
 * 16. autoAssignCareAssistant() — nearest available care assistant (no customer pick)
 * 17. computeReturnFare() — optional return home charge
 */

import crypto   from 'crypto';
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
export { default as sendEmail }              from '../utils/sendEmail.js';
export { default as sendSms }               from '../services/Sendsms.js';
export { generateBookingInvoicePdf }        from '../utils/bookingInvoiceGenerator.js';
export { getBookingSocketService }          from '../services/bookingSocketService.js';
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

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default per-km rate when no subscription plan active */
export const DEFAULT_KM_RATE = 12; // ₹12/km

/** Ride status groups (match Ride model RIDE_STATUSES exactly) */
export const RIDE_STATUSES_ACTIVE = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived',  'otp_verified',    'in_progress', 'at_stop',
];

export const RADIUS_METERS = 100_000;

/**
 * CUSTOMER-FACING BOOKING TYPES
 * pharmacy + blood_bank removed — not available to customers directly.
 */
// ✅ AFTER
export const CUSTOMER_BOOKING_TYPES = [
  'full_care_ride',
  'doctor_consultation',
  'doctor_online',
  'physiotherapist', // TODO: add route before re-enabling
  'care_assistant',
  'diagnostic_center',
  'diagnostic_home',
  'patient_transport',
  'follow_up',
];

// ── Basic Helpers ─────────────────────────────────────────────────────────────

/** 6-digit numeric OTP */
export const genOtp = () => crypto.randomInt(100_000, 999_999).toString();

/**
 * Hash OTP for storage in Ride.pickupOtp (stored hashed, select:false).
 * Compare: hashOtp(submittedOtp) === ride.pickupOtp
 */
export const hashOtp = (otp) =>
  crypto
    .createHmac('sha256', process.env.OTP_SECRET || 'likeson-otp-secret')
    .update(String(otp))
    .digest('hex');

/** Haversine km between two [lng, lat] pairs */
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

/** Create in-app + push notification */
export const createNotification = async ({
  recipient, title, body, type, bookingId, priority = 'Medium',
}) => {
  const { default: Notification } = await import('../models/Notification.js');
  try {
    await Notification.create({
      recipient, title, body, type, priority,
      relatedEntityType: 'Booking',
      relatedEntityId:   bookingId,
      channels: [{ channel: 'InApp' }, { channel: 'Push' }],
    });
  } catch (e) { console.error('[createNotification]', e.message); }
};

// ── Hospital Helpers ──────────────────────────────────────────────────────────

/**
 * Get all active verified hospitals.
 * Returns id, name, type, managementModel, address, location, contact,
 * specialties, facilities, operatingHours, rating, flags.
 *
 * @param {object} [filters] - Optional: { city, hospitalType, managementModel }
 */
export const getHospitals = async (filters = {}) => {
  const { default: Hospital } = await import('../models/Hospital.js');

  const query = { isActive: true, isVerified: true };
  if (filters.city)             query['address.city']    = { $regex: filters.city, $options: 'i' };
  if (filters.hospitalType)     query.hospitalType        = filters.hospitalType;
  if (filters.managementModel)  query.managementModel     = filters.managementModel;

  return Hospital.find(query)
    .select(
      'name slug hospitalType managementModel address location contact ' +
      'specialties facilities accreditations operatingHours rating ' +
      'isEmergencyReady hasICU hasBloodBank hasPharmacy hasDiagnostics ' +
      'hasAmbulance hasWheelchairAccess is24x7 bedCount linkedDoctors'
    )
    .lean();
};

/**
 * Get doctors linked to a specific hospital with their specialization,
 * fees (resolved by management model), availability, and rating.
 *
 * For hospital-manager hospitals → fees from hospital.consultationPricing
 * For doctor-owner hospitals     → fees from DoctorProfile.fees
 *
 * @param {string} hospitalId - Hospital._id
 */
export const getDoctorsByHospital = async (hospitalId) => {
  const { default: Hospital }      = await import('../models/Hospital.js');
  const { default: DoctorProfile } = await import('../models/DoctorProfile.js');

  const hospital = await Hospital.findById(hospitalId)
    .select('managementModel consultationPricing linkedDoctors isActive isVerified')
    .lean();

  if (!hospital) throw new Error('Hospital not found');
  if (!hospital.isActive || !hospital.isVerified) throw new Error('Hospital not operational');

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

  // Resolve effective fees per doctor
  const isHospitalManaged = hospital.managementModel === 'hospital-manager';

  return doctors.map((doc) => {
    const effectiveFees = isHospitalManaged
      ? {
          inPersonFee:             hospital.consultationPricing?.inPersonFee  ?? 0,
          videoFee:                hospital.consultationPricing?.videoFee     ?? 0,
          homeVisitFee:            hospital.consultationPricing?.homeVisitFee ?? 0,
          followUpFee:             hospital.consultationPricing?.followUpFee  ?? 0,
          followUpDiscountPercent: hospital.consultationPricing?.followUpDiscountPercent ?? 0,
          followUpValidDays:       hospital.consultationPricing?.followUpValidDays       ?? 7,
          source: 'hospital',
        }
      : {
          inPersonFee:             doc.fees?.inPersonFee              ?? 0,
          videoFee:                doc.fees?.videoFee                 ?? 0,
          homeVisitFee:            doc.fees?.homeVisitFee             ?? 0,
          followUpFee:             doc.fees?.followUpFee              ?? 0,
          followUpDiscountPercent: doc.fees?.followUpDiscountPercent  ?? 0,
          followUpValidDays:       doc.fees?.followUpValidDays        ?? 7,
          source: 'doctor',
        };

    return {
      ...doc,
      effectiveFees,
      hospitalManaged: isHospitalManaged,
    };
  });
};

// ── Availability Helpers ──────────────────────────────────────────────────────

/**
 * Check hospital operating hours for a given scheduledAt datetime.
 *
 * @param {object} hospital - Lean hospital doc with operatingHours
 * @param {Date}   scheduledAt
 */
const checkHospitalHours = (hospital, scheduledAt) => {
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduled = new Date(scheduledAt);
  const dayName   = dayNames[scheduled.getDay()];
  const reqMins   = scheduled.getHours() * 60 + scheduled.getMinutes();

  if (hospital.is24x7) return { available: true };

  const opDay = hospital.operatingHours?.find(h => h.day === dayName);
  if (!opDay)        return { available: false, reason: `No schedule found for ${dayName}` };
  if (opDay.isClosed) return { available: false, reason: `Hospital closed on ${dayName}` };
  if (opDay.is24Hours) return { available: true };

  const [oh, om] = (opDay.openTime  || '00:00').split(':').map(Number);
  const [ch, cm] = (opDay.closeTime || '23:59').split(':').map(Number);
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;

  if (reqMins < openMins || reqMins >= closeMins) {
    return { available: false, reason: `Hospital open ${opDay.openTime}–${opDay.closeTime} on ${dayName}` };
  }
  return { available: true };
};

/**
 * Check doctor slot availability for a scheduledAt datetime.
 *
 * @param {string} doctorProfileId
 * @param {Date}   scheduledAt
 */
export const checkDoctorAvailability = async (doctorProfileId, scheduledAt) => {
  const { default: DoctorProfile } = await import('../models/DoctorProfile.js');
  const { default: Hospital }      = await import('../models/Hospital.js');

  const doctor = await DoctorProfile.findById(doctorProfileId)
    .select('weeklyAvailability primaryHospital partnershipStatus isActive')
    .lean();

  if (!doctor) return { available: false, reason: 'Doctor not found' };
  if (doctor.partnershipStatus !== 'Active' || !doctor.isActive)
    return { available: false, reason: 'Doctor not currently active' };

  const dayNames  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduled = new Date(scheduledAt);
  const dayName   = dayNames[scheduled.getDay()];
  const reqMins   = scheduled.getHours() * 60 + scheduled.getMinutes();

  const dayEntry = doctor.weeklyAvailability?.find(d => d.day === dayName);
  if (!dayEntry?.isAvailable) return { available: false, reason: `Doctor unavailable on ${dayName}` };

  const hasSlot = dayEntry.slots?.some(s => {
    if (!s.isActive) return false;
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    return reqMins >= sh * 60 + sm && reqMins < eh * 60 + em;
  });
  if (!hasSlot) return { available: false, reason: `No slot at that time on ${dayName}` };

  // If doctor belongs to a hospital-managed hospital, also check hospital hours
  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select('managementModel operatingHours is24x7 isActive isVerified')
      .lean();
    if (hospital?.managementModel === 'hospital-manager') {
      if (!hospital.isActive || !hospital.isVerified)
        return { available: false, reason: 'Hospital not operational' };
      const hospCheck = checkHospitalHours(hospital, scheduledAt);
      if (!hospCheck.available) return hospCheck;
    }
  }

  return { available: true };
};

/**
 * Combined availability check: hospital hours + doctor slot.
 * If hospitalId provided: validate hospital hours first.
 * If doctorId provided: validate doctor slot.
 *
 * @param {object} params
 * @param {string} [params.hospitalId]
 * @param {string} [params.doctorId]
 * @param {Date}   params.scheduledAt
 */
export const checkHospitalOrDoctorAvailability = async ({ hospitalId, doctorId, scheduledAt }) => {
  const { default: Hospital } = await import('../models/Hospital.js');

  // Step 1: hospital hours
  if (hospitalId) {
    const hospital = await Hospital.findById(hospitalId)
      .select('isActive isVerified operatingHours is24x7 managementModel')
      .lean();
    if (!hospital)                          return { available: false, reason: 'Hospital not found' };
    if (!hospital.isActive || !hospital.isVerified) return { available: false, reason: 'Hospital not operational' };
    const hospCheck = checkHospitalHours(hospital, scheduledAt);
    if (!hospCheck.available) return hospCheck;
  }

  // Step 2: doctor slot
  if (doctorId) {
    return checkDoctorAvailability(doctorId, scheduledAt);
  }

  return { available: true };
};

// ── Transport / Distance Helpers ──────────────────────────────────────────────

/**
 * Resolve per-km rate for this customer.
 * Priority: active subscription plan transport rate → 12₹ default.
 *
 * @param {string} userId
 * @returns {Promise<{ ratePerKm: number, source: 'subscription'|'default' }>}
 */
 
export const resolveKmRate = async (userId) => {
  const { default: UserSubscription } = await import('../models/UserSubscription.js');
  const { default: SubscriptionPlan } = await import('../models/SubscriptionPlan.js');
  const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');

  // Get platform default rate from config (not hardcoded constant)
  const config = await PlatformPricingConfig.getGlobal();
  const configRate = config?.transport?.defaultRatePerKm ?? DEFAULT_KM_RATE;

  const sub = await UserSubscription.findOne({
    user:       userId,
    status:     { $in: ['Active', 'Trial'] },
    expiryDate: { $gt: new Date() },
  }).lean();

  if (!sub) return { ratePerKm: configRate, source: 'default' };

  const planRate = sub.limits?.transportRatePerKm;
  if (planRate != null && planRate > 0) {
    return { ratePerKm: planRate, source: 'subscription' };
  }

  if (sub.plan) {
    const plan = await SubscriptionPlan.findById(sub.plan)
      .select('transport planType')
      .lean();
    if (plan?.transport?.ratePerKm != null && plan.transport.ratePerKm > 0) {
      return { ratePerKm: plan.transport.ratePerKm, source: 'subscription' };
    }
  }

  return { ratePerKm: configRate, source: 'default' };
};

/**
 * Compute transport fare for a single leg.
 *
 * @param {object} params
 * @param {number} params.distanceKm
 * @param {number} params.ratePerKm
 * @param {number} [params.waitingMinutes=0]    - billable waiting time
 * @param {number} [params.freeWaitingMinutes=5]
 * @param {number} [params.waitingRatePerMin=2]
 * @param {number} [params.baseFare=0]
 * @param {boolean}[params.isNight=false]
 * @param {number} [params.nightSurchargeMultiplier=1.2]
 * @param {boolean}[params.isWheelchair=false]
 * @param {number} [params.wheelchairSurcharge=0]
 * @returns {{ distanceFare, waitingCharge, nightSurcharge, wheelchairSurcharge, totalFare }}
 */
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

/**
 * Resolve full transport fare breakdown for a booking.
 *
 * full_care_ride:
 *   - Outbound leg: patientLocation → hospital  (always)
 *   - Return  leg:  hospital → patientLocation   (optional, customer chooses)
 *
 * patient_transport:
 *   - Outbound leg: pickup → dropoff             (always)
 *   - Return  leg:  dropoff → pickup             (optional)
 *   - Waiting charge applies if customer requests waiting
 *
 * @param {object} params
 * @param {string} params.bookingType
 * @param {number[]} params.pickupCoords     - [lng, lat]
 * @param {number[]} params.dropoffCoords    - [lng, lat]
 * @param {number}   params.ratePerKm
 * @param {boolean}  [params.includeReturn=false]
 * @param {number}   [params.waitingMinutes=0]    - patient_transport: waiting at destination
 * @param {number}   [params.freeWaitingMinutes=5]
 * @param {number}   [params.waitingRatePerMin=2]
 * @param {boolean}  [params.isNight=false]
 * @param {boolean}  [params.isWheelchair=false]
 * @param {number}   [params.wheelchairSurchargeAmount=0]
 */
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

  const legParams = {
    distanceKm,
    ratePerKm,
    isNight,
    isWheelchair,
    wheelchairSurchargeAmount,
    freeWaitingMinutes,
    waitingRatePerMin,
  };

  // Outbound leg — waiting only applies to patient_transport
  const outbound = computeLegFare({
    ...legParams,
    waitingMinutes: bookingType === 'patient_transport' ? waitingMinutes : 0,
  });

  let returnLeg = null;
  if (includeReturn) {
    // Return: same distance, no waiting
    returnLeg = computeLegFare({ ...legParams, waitingMinutes: 0 });
  }

  const totalTransportFee = +(
    outbound.totalFare + (returnLeg?.totalFare ?? 0)
  ).toFixed(2);

  return {
    distanceKm:         +distanceKm.toFixed(2),
    ratePerKm,
    outbound,
    returnLeg,
    includeReturn,
    totalTransportFee,
  };
};

// ── Care Assistant Helpers ────────────────────────────────────────────────────

/**
 * Auto-assign nearest available, verified care assistant.
 * Customer does NOT select — system assigns automatically.
 *
 * @param {object} params
 * @param {number[]} params.patientCoords  - [lng, lat]
 * @param {string}   params.city
 * @param {number}   [params.maxRadiusKm=20]
 * @returns {Promise<object|null>} CareAssistantProfile lean doc or null
 */
export const autoAssignCareAssistant = async ({ patientCoords, city, maxRadiusKm = 20 }) => {
  const { default: CareAssistantProfile } = await import('../models/CareAssistantProfile.js');

  const [lng, lat] = patientCoords;

  const candidates = await CareAssistantProfile.find({
    isActive:               true,
    isBlocked:              false,
    status:                 'Available',
    'kyc.verificationStatus': 'Verified',
    'verification.isVerified': true,
    'availability.isOnline': true,
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxRadiusKm * 1000,
      },
    },
  })
    .select('user fullName photoUrl phone performance.averageRating location specializations')
    .limit(5)
    .lean();

  if (!candidates.length) return null;

  // Pick highest rated among nearest
  candidates.sort((a, b) => (b.performance?.averageRating ?? 0) - (a.performance?.averageRating ?? 0));
  return candidates[0];
};

// ── Follow-Up Helpers ─────────────────────────────────────────────────────────

/**
 * Check follow-up eligibility.
 *
 * STRICT RULE:
 *   - Must be same patient + same doctor + same hospital
 *   - If doctor is hospital-managed: consultation must have been at THAT hospital
 *   - If doctor-owner: hospital check optional but doctor must match
 *   - followUpExpiry must be in future
 *   - isFollowUp must be false (original consultation, not another follow-up)
 *
 * @param {object} params
 * @param {string} params.customerId
 * @param {string} params.doctorId        - DoctorProfile._id
 * @param {string} [params.hospitalId]    - Hospital._id (required if hospital-managed doctor)
 */
export const checkFollowUpEligibility = async ({ customerId, doctorId, hospitalId }) => {
  const { default: OutPatientRecord } = await import('../models/OutPatientRecord.js');
  const { default: DoctorProfile }    = await import('../models/DoctorProfile.js');
  const { default: Hospital }         = await import('../models/Hospital.js');

  // Determine if doctor is hospital-managed
  const doctor = await DoctorProfile.findById(doctorId)
    .select('primaryHospital partnershipStatus isActive')
    .lean();

  if (!doctor || doctor.partnershipStatus !== 'Active' || !doctor.isActive) {
    return { isEligible: false, reason: 'Doctor not active' };
  }

  // For hospital-managed doctors: hospitalId is REQUIRED and must match primaryHospital
  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select('managementModel isActive isVerified')
      .lean();

    if (hospital?.managementModel === 'hospital-manager') {
      if (!hospitalId) {
        return { isEligible: false, reason: 'Hospital ID required for this doctor' };
      }
      if (hospitalId.toString() !== doctor.primaryHospital.toString()) {
        return {
          isEligible: false,
          reason: 'Follow-up must be at the same hospital as original consultation',
        };
      }
    }
  }

  // Find a valid parent OP
  const query = {
    patient:        customerId,
    doctor:         doctorId,
    isFollowUp:     false,
    status:         { $in: ['scheduled', 'completed'] },
    followUpExpiry: { $gt: new Date() },
  };

  // Strict hospital match if provided
  if (hospitalId) query.hospital = hospitalId;

  const recentOp = await OutPatientRecord.findOne(query)
    .sort({ createdAt: -1 })
    .lean();

  if (!recentOp) {
    return {
      isEligible: false,
      reason: 'No valid original consultation found for follow-up at this doctor/hospital within the valid window',
    };
  }

  return {
    isEligible:     true,
    parentOp:       recentOp._id,
    followUpFee:    recentOp.followUpFee || 0,
    parentOpNumber: recentOp.opNumber,
    followUpExpiry: recentOp.followUpExpiry,
    daysRemaining: Math.ceil((new Date(recentOp.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24)),
  };
};

// ── Subscription Helpers ──────────────────────────────────────────────────────

/**
 * Check active subscription consultation allowance.
 * Returns remaining count and whether it covers next consultation.
 *
 * @param {string} userId
 */
export const checkSubscriptionConsultation = async (userId) => {
  const { default: UserSubscription } = await import('../models/UserSubscription.js');

  const sub = await UserSubscription.findOne({
    user:       userId,
    status:     { $in: ['Active', 'Trial'] },
    expiryDate: { $gt: new Date() },
  }).lean();

  if (!sub) return { allowed: false, sub: null, remaining: 0, isFree: false, reason: 'No active subscription' };

  const limit = sub.limits?.consultationsPerMonth ?? 0;
  if (limit === 0) return { allowed: false, sub, remaining: 0, isFree: false, reason: 'No consultation quota in plan' };

  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();
  const usage    = sub.usageHistory?.find(u => u.month === curMonth && u.year === curYear);
  const used     = usage?.consultationsUsed ?? 0;

  if (limit === -1) return { allowed: true, sub, remaining: Infinity, isFree: true, reason: 'Unlimited' };
  if (used >= limit) return { allowed: false, sub, remaining: 0, isFree: false, reason: `Monthly quota exhausted (${used}/${limit})` };

  return { allowed: true, sub, remaining: limit - used, isFree: true, reason: `${limit - used} consultations remaining` };
};

/** Increment subscription usage field (e.g. 'consultationsUsed') */
export const incrementSubscriptionUsage = async (subId, field) => {
  const { default: UserSubscription } = await import('../models/UserSubscription.js');
  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();
  const updated  = await UserSubscription.findOneAndUpdate(
    { _id: subId, 'usageHistory.month': curMonth, 'usageHistory.year': curYear },
    { $inc: { [`usageHistory.$.${field}`]: 1 } }
  );
  if (!updated) {
    await UserSubscription.findByIdAndUpdate(subId, {
      $push: { usageHistory: { month: curMonth, year: curYear, [field]: 1 } },
    });
  }
};

/** Decrement subscription usage field on booking cancellation */
export const decrementSubscriptionUsage = async (subId, field) => {
  const { default: UserSubscription } = await import('../models/UserSubscription.js');
  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();
  await UserSubscription.findOneAndUpdate(
    { _id: subId, 'usageHistory.month': curMonth, 'usageHistory.year': curYear },
    { $inc: { [`usageHistory.$.${field}`]: -1 } }
  );
};

// ── Lab Helpers ───────────────────────────────────────────────────────────────

/**
 * Get all approved + active labs with basic info.
 *
 * @param {object} [filters] - Optional: { city, labType, homeCollection }
 */
export const getLabs = async (filters = {}) => {
  const { default: LabPartnerProfile } = await import('../models/LabPartnerProfile.js');

  const query = { status: 'approved', isActive: true };
  if (filters.city)           query['registeredAddress.city'] = { $regex: filters.city, $options: 'i' };
  if (filters.labType)        query.labType = filters.labType;
  if (filters.homeCollection) query.sampleCollectionMode = { $in: ['Home Collection', 'Both'] };

  return LabPartnerProfile.find(query)
    .select(
      'labName labCode labType ownershipType registeredAddress timing ' +
      'sampleCollectionMode homeCollectionRadius homeCollectionFee ' +
      'reportDeliveryModes avgTurnaroundHours averageRating totalReviews ' +
      'accreditations isFeatured logoUrl'
    )
    .lean();
};

/**
 * Get a specific lab with full test + package list.
 *
 * @param {string} labId - LabPartnerProfile._id
 */
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

  // Filter to active tests + packages only
  lab.labTests    = (lab.labTests    || []).filter(t => t.isActive);
  lab.labPackages = (lab.labPackages || []).filter(p => p.isActive);

  return lab;
};

// ── Consultation Fee Resolver ─────────────────────────────────────────────────

/**
 * Resolve consultation fee.
 * Priority: follow_up → subscription → hospital → doctor → default(600)
 *
 * IMPORTANT: For follow-up, fee is only valid if same hospital + same doctor
 * (enforced separately via checkFollowUpEligibility before calling this).
 */
export const resolveConsultationFee = async ({
  isFollowUp,
  followUpFee,
  isCoveredBySubscription,
  doctorId,
  hospitalId,
  consultationType, // 'inPerson' | 'video' | 'homeVisit'
}) => {
  const { default: Hospital }      = await import('../models/Hospital.js');
  const { default: DoctorProfile } = await import('../models/DoctorProfile.js');

  if (isFollowUp)              return { fee: followUpFee || 0, source: 'follow_up' };
  if (isCoveredBySubscription) return { fee: 0,               source: 'subscription' };

  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId)
      .select('managementModel consultationPricing')
      .lean();
    if (hosp?.managementModel === 'hospital-manager' && hosp.consultationPricing) {
      const cp = hosp.consultationPricing;
      const feeMap = { inPerson: cp.inPersonFee, video: cp.videoFee, homeVisit: cp.homeVisitFee };
      return { fee: feeMap[consultationType] ?? cp.inPersonFee, source: 'hospital' };
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

// ── Fare Breakdown Builder ────────────────────────────────────────────────────

/**
 * Build fareBreakdown object matching Booking.fareBreakdown schema exactly.
 */
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

// ── Ride Payload Builder ──────────────────────────────────────────────────────

/**
 * Build Ride document payload matching Ride schema exactly.
 * pickup/dropoff → GeoJSON Points with coordinates: [lng, lat].
 */
export const buildRidePayload = ({
  bookingId,
  rideType,         // 'patient'|'care_assistant'|'diagnostic_tech'|'pharmacy_delivery'|'blood_bank'
  vehicleClass,     // 'two_wheeler'|'four_wheeler'|'ambulance'
  pickupCoords,     // [lng, lat]
  pickupAddress = '',
  pickupCity    = '',
  dropoffCoords,    // [lng, lat]
  dropoffAddress= '',
  dropoffCity   = '',
  scheduledPickupAt,
  isReturnRide  = false,
  createdBy,
}) => ({
  booking:   bookingId,
  rideType,
  vehicleClass,
  isReturnRide,
  pickup:  { type: 'Point', coordinates: pickupCoords,  address: pickupAddress,  city: pickupCity  },
  dropoff: { type: 'Point', coordinates: dropoffCoords, address: dropoffAddress, city: dropoffCity },
  scheduledPickupAt,
  status:    'requested',
  createdBy,
});

// ── OP Number Generator ───────────────────────────────────────────────────────

/** Generate OP number: OP-YYYYMMDD-HOSPCODE-0001 */
export const generateOpNumber = async (hospitalId) => {
  const { default: OutPatientRecord } = await import('../models/OutPatientRecord.js');
  const { default: Hospital }         = await import('../models/Hospital.js');
  const now  = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  let hospCode = 'GEN';
  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId).select('slug name').lean();
    if (hosp)
      hospCode = (hosp.slug || hosp.name || 'GEN')
        .replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
  }
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const count = await OutPatientRecord.countDocuments({
    createdAt: { $gte: startOfDay },
    ...(hospitalId ? { hospital: hospitalId } : {}),
  });
  return `OP-${date}-${hospCode}-${String(count + 1).padStart(4, '0')}`;
};

// ── Razorpay Helpers ──────────────────────────────────────────────────────────

/** Create Razorpay order */
export const createRazorpayOrder = async (amountInRupees, bookingCode, notes = {}) => {
  if (amountInRupees <= 0) return null;
  const order = await razorpay.orders.create({
    amount:   Math.round(amountInRupees * 100),
    currency: 'INR',
    receipt:  bookingCode,
    notes:    { bookingCode, ...notes },
  });
  return { orderId: order.id, amount: amountInRupees, currency: 'INR' };
};

/** Verify Razorpay webhook/payment signature */
export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const digest = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return digest === signature;
};

// ── Wallet Payment ────────────────────────────────────────────────────────────

/**
 * Debit Wallet model for a booking payment.
 * Returns payment record to push into Booking.payments[].
 */
export const processWalletPayment = async ({ userId, amount, bookingId, bookingCode }) => {
  const { default: Wallet } = await import('../models/Wallet.js');
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet)                          throw new Error('Wallet not found');
  if (wallet.availableBalance < amount) throw new Error(`Insufficient wallet balance. Available: ₹${wallet.availableBalance}`);
  await wallet.debit(amount, 'Booking_Payment', {
    referenceId: bookingId, onModel: 'Booking',
    description: `Payment for booking ${bookingCode}`,
    initiatedBy: userId,
  });
  return {
    gateway:       'Wallet',
    transactionId: `WALLET-${Date.now()}`,
    paymentMode:   'Wallet',
    amount,
    status:        'success',
    paidAt:        new Date(),
  };
};

// ── Refund Computer ───────────────────────────────────────────────────────────

/**
 * Compute refund amount using PlatformPricingConfig.refundPolicy.
 */
export const computeRefundAmount = async (booking) => {
  const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
  const config = await PlatformPricingConfig.getGlobal();
  const policy = config?.refundPolicy || {};
  const thresholdHours = policy.rideFullRefundHoursThreshold ?? 24;
  const partialPercent = policy.ridePartialRefundPercent     ?? 50;
  const hoursUntil     = (new Date(booking.scheduledAt) - new Date()) / (1000 * 60 * 60);
  const refundPercent  = hoursUntil >= thresholdHours ? 100 : partialPercent;
  const totalAmount    = booking.fareBreakdown?.totalAmount ?? 0;
  const refundAmount   = +((totalAmount * refundPercent) / 100).toFixed(2);
  return { refundPercent, refundAmount };
};

// ── Service Component Resolver ────────────────────────────────────────────────

/**
 * Resolve which service components a bookingType needs.
 * Maps to Booking model BOOKING_TYPES.
 * pharmacy + blood_bank excluded from customer-facing flow (handled internally).
 */
export const resolveServiceComponents = (bookingType) => ({
  needsTransport:     ['full_care_ride', 'patient_transport', 'diagnostic_home'].includes(bookingType),
  needsCareAssistant: ['full_care_ride', 'care_assistant'].includes(bookingType),
  needsDoctor:        ['full_care_ride', 'doctor_consultation', 'doctor_online', 'physiotherapist', 'follow_up'].includes(bookingType),
  needsDiagnostic:    ['diagnostic_center', 'diagnostic_home'].includes(bookingType),
  needsPharmacy:      false,  // pharmacy booking not customer-facing
  needsBloodBank:     false,  // blood_bank not customer-facing
  isOnline:           bookingType === 'doctor_online',
  isFollowUpType:     bookingType === 'follow_up',
  needsReturnOption:  ['full_care_ride', 'patient_transport'].includes(bookingType), // show return home prompt
  needsWaitingOption: bookingType === 'patient_transport', // show waiting charge option
  canAddDoctor:       bookingType === 'patient_transport', // transport can optionally add doctor + OP
});