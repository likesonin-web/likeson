/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOKING ROUTER — Likeson.in
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * SERVICE TYPES:
 *   full_care_ride       → transport + care_assistant + doctor_consultation (bundled)
 *   transport_only       → just ride
 *   care_assistant_only  → just care escort
 *   doctor_consultation  → in-person / video / home-visit
 *   diagnostic           → lab test / home sample
 *   pharmacy_order       → links to PharmacyOrder (handled separately)
 *   blood_bank           → blood unit request
 *
 * OP SLIP:
 *   Every doctor_consultation booking generates an OP (Outpatient) number.
 *   Format: OP-<YYYYMMDD>-<HospCode>-<SEQ>
 *   OPs are stored in OutPatientRecord model.
 *   Within followUpValidDays window → no consultation fee charged.
 *
 * PAYMENTS:
 *   Razorpay order created for pay-per-use.
 *   Subscriptions: consultation deducted from monthly limit.
 *   If followUp within valid window → free, no Razorpay order.
 *
 * BUGS FIXED FROM ORIGINAL:
 *   1. assignedTP stored on booking root, not booking.transport — fixed
 *   2. Ride.vehicle was required but solo driver has no Vehicle ref — made optional
 *   3. Care assistant check used wrong isDispatchable logic — fixed
 *   4. Admin reassign care didn't null taskStartedAt — fixed
 *   5. TP assign-driver didn't update booking.status before save — fixed
 *   6. Missing await on booking.save() in hospital confirm — fixed
 *   7. Solo/end didn't check ride.status — fixed
 *   8. Invoice access check used wrong populate path — fixed
 *   9. Consultation free-followup window not implemented — ADDED
 *  10. Subscription consultation limit not checked on booking — ADDED
 *  11. OP number not generated — ADDED
 *  12. Razorpay payment order not created — ADDED
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express        from 'express';
import mongoose       from 'mongoose';
import crypto         from 'crypto';
import Razorpay       from 'razorpay';

// ── Models ────────────────────────────────────────────────────────────────────
import Booking             from '../models/Booking.js';
import Ride                from '../models/Ride.js';
import RideTracking        from '../models/RideTracking.js';
import User                from '../models/User.js';
import Driver              from '../models/Driver.js';
import SoloDriverPartner   from '../models/SoloDriverPartner.js';
import TransportPartner    from '../models/TransportPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import DoctorProfile       from '../models/DoctorProfile.js';
import Hospital            from '../models/Hospital.js';
import LabPartnerProfile   from '../models/LabPartnerProfile.js';
import Notification        from '../models/Notification.js';
import SystemLog           from '../models/SystemLog.js';
import OutPatientRecord    from '../models/OutPatientRecord.js';
import UserSubscription    from '../models/UserSubscription.js';
import SubscriptionPlan    from '../models/SubscriptionPlan.js';

// ── Utils ─────────────────────────────────────────────────────────────────────
import sendEmail                    from '../utils/sendEmail.js';
import sendSms                      from '../utils/sendSms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }  from '../services/bookingSocketService.js';

// ── Templates ─────────────────────────────────────────────────────────────────
import { transactionalTemplate, otpTemplate } from '../templates/emailTemplates.js';
import {
  rideBookedSms,
  driverAssignedSms,
  rideStartedSms,
  rideCompletedSms,
  rideCancelledSms,
  careAssistantAssignedSms,
  appointmentConfirmedSms,
  otpSms,
  paymentSuccessfulSms,
  newCareRequestToAssistantSms,
} from '../templates/smsTemplates.js';

// ── Auth ──────────────────────────────────────────────────────────────────────
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY INIT
// ─────────────────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** 6-digit numeric OTP */
const genOtp = () => crypto.randomInt(100_000, 999_999).toString();

/** Haversine distance in km */
const haversineKm = (coord1, coord2) => {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** In-app + push notification */
const createNotification = async ({ recipient, title, body, type, bookingId, priority = 'Medium' }) => {
  try {
    await Notification.create({
      recipient,
      title,
      body,
      type,
      priority,
      relatedEntityType: 'Booking',
      relatedEntityId:   bookingId,
      channels: [{ channel: 'InApp' }, { channel: 'Push' }],
    });
  } catch (e) {
    console.error('[createNotification]', e.message);
  }
};

/**
 * Generate OP number.
 * Format: OP-<YYYYMMDD>-<HOSPCODE>-<4-digit-seq>
 * Seq = count of OPs for that hospital today + 1
 */
const generateOpNumber = async (hospitalId) => {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // "20260427"

  // Hospital short code
  let hospCode = 'GEN';
  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId).select('slug name').lean();
    if (hosp) {
      hospCode = (hosp.slug || hosp.name || 'GEN')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 5);
    }
  }

  // Daily sequence
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const count = await OutPatientRecord.countDocuments({
    createdAt: { $gte: startOfDay },
    ...(hospitalId ? { hospital: hospitalId } : {}),
  });

  const seq = String(count + 1).padStart(4, '0');
  return `OP-${date}-${hospCode}-${seq}`;
};

/**
 * Create OP record when consultation booking confirmed.
 * @param {object} opts
 */
const createOpRecord = async ({
  booking,
  doctorId,
  hospitalId,
  consultationType,
  patientId,
  patientName,
  scheduledAt,
  isFollowUp     = false,
  parentOpId     = null,
  followUpExpiry = null,
  followUpFee    = 0,
}) => {
  const opNumber = await generateOpNumber(hospitalId);

  const op = await OutPatientRecord.create({
    opNumber,
    booking:         booking._id,
    bookingNumber:   booking.bookingNumber,
    patient:         patientId,
    patientName,
    doctor:          doctorId,
    hospital:        hospitalId || null,
    consultationType,
    scheduledAt:     new Date(scheduledAt),
    isFollowUp,
    parentOp:        parentOpId || null,
    followUpExpiry:  followUpExpiry || null,
    followUpFee,
    status:          'scheduled',
  });

  return op;
};

/**
 * Check if customer has valid active follow-up window.
 * Returns { isFollowUp, parentOp, followUpFee } or null.
 */
const checkFollowUpEligibility = async ({ customerId, doctorId, hospitalId }) => {
  const now = new Date();

  const recentOp = await OutPatientRecord.findOne({
    patient:     customerId,
    doctor:      doctorId,
    ...(hospitalId ? { hospital: hospitalId } : {}),
    isFollowUp:  false,
    status:      { $in: ['scheduled', 'completed'] },
    followUpExpiry: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!recentOp) return null;

  return {
    isFollowUp:    true,
    parentOp:      recentOp._id,
    followUpFee:   recentOp.followUpFee || 0,
    parentOpNumber: recentOp.opNumber,
  };
};

/**
 * Check subscription consultation limit.
 * Returns { allowed, sub, remaining, isFree }
 */
const checkSubscriptionConsultation = async (userId) => {
  const now = new Date();
  const sub = await UserSubscription.findOne({
    user:   userId,
    status: { $in: ['Active', 'Trial'] },
    expiryDate: { $gt: now },
  }).lean();

  if (!sub) return { allowed: false, sub: null, remaining: 0, isFree: false };

  const limit = sub.limits?.consultationsPerMonth ?? 0;
  if (limit === 0) return { allowed: false, sub, remaining: 0, isFree: false };

  // Current month usage
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();
  const usage = sub.usageHistory?.find(u => u.month === curMonth && u.year === curYear);
  const used  = usage?.consultationsUsed ?? 0;

  if (limit === -1) return { allowed: true, sub, remaining: Infinity, isFree: true };
  if (used >= limit) return { allowed: false, sub, remaining: 0, isFree: false };

  return { allowed: true, sub, remaining: limit - used, isFree: true };
};

/**
 * Increment subscription usage counter.
 */
const incrementSubscriptionUsage = async (subId, field) => {
  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();

  await UserSubscription.findOneAndUpdate(
    {
      _id: subId,
      'usageHistory.month': curMonth,
      'usageHistory.year':  curYear,
    },
    { $inc: { [`usageHistory.$.${field}`]: 1 } }
  ).then(async (res) => {
    if (!res) {
      // No entry for this month yet — push one
      await UserSubscription.findByIdAndUpdate(subId, {
        $push: {
          usageHistory: {
            month:              curMonth,
            year:               curYear,
            [field]:            1,
          },
        },
      });
    }
  });
};

/**
 * Create Razorpay order.
 * Returns { orderId, amount, currency } or null if amount = 0.
 */
const createRazorpayOrder = async (amountInRupees, bookingNumber, notes = {}) => {
  if (amountInRupees <= 0) return null;

  const order = await razorpay.orders.create({
    amount:   Math.round(amountInRupees * 100), // paise
    currency: 'INR',
    receipt:  bookingNumber,
    notes:    { bookingNumber, ...notes },
  });

  return { orderId: order.id, amount: amountInRupees, currency: 'INR' };
};

/**
 * Verify Razorpay payment signature.
 */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body   = `${orderId}|${paymentId}`;
  const digest = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return digest === signature;
};

/**
 * Check doctor availability for scheduledAt.
 * Returns { available, reason? }
 */
const checkDoctorAvailability = async (doctorProfileId, scheduledAt) => {
  const doctor = await DoctorProfile.findById(doctorProfileId)
    .select('weeklyAvailability primaryHospital partnershipStatus isActive')
    .lean();

  if (!doctor)
    return { available: false, reason: 'Doctor not found' };
  if (doctor.partnershipStatus !== 'Active' || !doctor.isActive)
    return { available: false, reason: 'Doctor not currently active' };

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduled = new Date(scheduledAt);
  const dayName   = dayNames[scheduled.getDay()];
  const hhmm      = `${String(scheduled.getHours()).padStart(2,'0')}:${String(scheduled.getMinutes()).padStart(2,'0')}`;

  const dayEntry = doctor.weeklyAvailability?.find(d => d.day === dayName);
  if (!dayEntry?.isAvailable)
    return { available: false, reason: `Doctor unavailable on ${dayName}` };

  const reqMins = parseInt(hhmm.replace(':',''));
  const hasSlot = dayEntry.slots?.some(s => {
    if (!s.isActive) return false;
    const start = parseInt(s.startTime.replace(':',''));
    const end   = parseInt(s.endTime.replace(':',''));
    return reqMins >= start && reqMins < end;
  });

  if (!hasSlot)
    return { available: false, reason: `No slot at ${hhmm} on ${dayName}` };

  // Check hospital hours if managed hospital
  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select('managementModel operatingHours isActive isVerified')
      .lean();

    if (hospital?.managementModel === 'hospital-manager') {
      if (!hospital.isActive || !hospital.isVerified)
        return { available: false, reason: 'Hospital not operational' };

      const opDay = hospital.operatingHours?.find(h => h.day === dayName);
      if (opDay?.isClosed)
        return { available: false, reason: `Hospital closed on ${dayName}` };
    }
  }

  return { available: true };
};

/**
 * Resolve which components needed from serviceTypes array.
 */
const resolveServiceComponents = (serviceTypes) => {
  const all = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
  return {
    needsTransport:    all.some(s => ['full_care_ride','transport_only'].includes(s)),
    needsCare:         all.some(s => ['full_care_ride','care_assistant_only'].includes(s)),
    needsConsultation: all.some(s => ['full_care_ride','doctor_consultation'].includes(s)),
    needsDiagnostic:   all.some(s => s === 'diagnostic'),
    needsBloodBank:    all.some(s => s === 'blood_bank'),
  };
};

/**
 * Resolve consultation fee based on:
 *  1. Follow-up window → followUpFee
 *  2. Subscription active → 0 (deduct from limit)
 *  3. Hospital pricing (managed) or doctor pricing (owner)
 *  4. PlatformPricingConfig fallback
 */
const resolveConsultationFee = async ({
  isFollowUp,
  followUpFee,
  isCoveredBySubscription,
  doctorId,
  hospitalId,
  consultationType,
}) => {
  if (isFollowUp)            return { fee: followUpFee || 0,  source: 'follow_up' };
  if (isCoveredBySubscription) return { fee: 0,               source: 'subscription' };

  // Attempt hospital pricing first
  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId)
      .select('managementModel consultationPricing')
      .lean();

    if (hosp?.managementModel === 'hospital-manager' && hosp.consultationPricing) {
      const cp = hosp.consultationPricing;
      const feeMap = {
        in_person:  cp.inPersonFee,
        video:      cp.videoFee,
        home_visit: cp.homeVisitFee,
        follow_up:  cp.followUpFee,
      };
      return { fee: feeMap[consultationType] ?? cp.inPersonFee, source: 'hospital' };
    }
  }

  // Doctor's own fees
  const doc = await DoctorProfile.findById(doctorId)
    .select('fees')
    .lean();

  if (doc?.fees) {
    const feeMap = {
      in_person:  doc.fees.inPersonFee,
      video:      doc.fees.videoFee,
      home_visit: doc.fees.homeVisitFee,
      follow_up:  doc.fees.followUpFee,
    };
    const fee = feeMap[consultationType];
    if (fee != null) return { fee, source: 'doctor' };
  }

  return { fee: 600, source: 'default' }; // PlatformPricingConfig default
};

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMER ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /bookings
 * Create booking. Handles:
 *  - Doctor consultation: follow-up check → sub check → fee resolution → OP gen
 *  - Razorpay order created if amount > 0
 *  - Subscription consultation deducted if used
 */
router.post('/', protect, authorize('customer'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      serviceTypes,
      serviceType,
      scheduledAt,
      pickupAddress,
      dropAddress,
      patientId,
      patientName,
      doctorId,
      hospitalId,
      consultationType,
      diagnosticTests,
      labPartnerId,
      isHomeSampleCollection,
      bloodGroup,
      componentRequired,
      bloodUnitsRequired,
      bloodHospitalId,
      billing,
      paymentMethod,
      bookingSource,
      customerNotes,
      subscriptionPlanId,
      // OP / followup
      parentOpId,          // if customer explicitly books follow-up
    } = req.body;

    if (!scheduledAt || !pickupAddress) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'scheduledAt and pickupAddress required' });
    }

    const resolvedServiceTypes = serviceTypes || (serviceType ? [serviceType] : null);
    if (!resolvedServiceTypes?.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'serviceType(s) required' });
    }

    const primaryServiceType =
      resolvedServiceTypes.length === 1
        ? resolvedServiceTypes[0]
        : resolvedServiceTypes.includes('full_care_ride')
        ? 'full_care_ride'
        : resolvedServiceTypes[0];

    const components = resolveServiceComponents(resolvedServiceTypes);

    // ── Doctor availability ────────────────────────────────────────────────
    if (components.needsConsultation) {
      if (!doctorId) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'doctorId required for consultation' });
      }

      const avail = await checkDoctorAvailability(doctorId, scheduledAt);
      if (!avail.available) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: `Doctor unavailable: ${avail.reason}`,
          code:    'DOCTOR_UNAVAILABLE',
        });
      }
    }

    // ── Hospital operational check ─────────────────────────────────────────
    if (hospitalId) {
      const hospital = await Hospital.findById(hospitalId).select('isActive isVerified name').lean();
      if (!hospital?.isActive || !hospital?.isVerified) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: 'Hospital not operational',
          code:    'HOSPITAL_UNAVAILABLE',
        });
      }
    }

    // ── Consultation: follow-up + subscription + fee resolution ───────────
    let consultationFee            = 0;
    let feeSource                  = 'default';
    let isFollowUp                 = false;
    let resolvedParentOpId         = parentOpId || null;
    let isCoveredBySubscription    = false;
    let subDoc                     = null;
    let followUpFeeForOp           = 0;
    let followUpExpiryForOp        = null;

    if (components.needsConsultation) {
      const effectivePatientId = patientId || req.user._id;

      // 1. Check follow-up eligibility
      const fuCheck = await checkFollowUpEligibility({
        customerId: effectivePatientId,
        doctorId,
        hospitalId,
      });

      if (fuCheck && !parentOpId) {
        // Auto-detect follow-up
        isFollowUp          = true;
        resolvedParentOpId  = fuCheck.parentOp;
      } else if (parentOpId) {
        // Explicit follow-up
        const parentOp = await OutPatientRecord.findById(parentOpId).lean();
        if (parentOp && parentOp.followUpExpiry > new Date()) {
          isFollowUp         = true;
          resolvedParentOpId = parentOpId;
        }
      }

      // 2. Check subscription if NOT follow-up (follow-up is always free/low fee)
      if (!isFollowUp) {
        const subCheck = await checkSubscriptionConsultation(req.user._id);
        if (subCheck.allowed && subCheck.isFree) {
          isCoveredBySubscription = true;
          subDoc                  = subCheck.sub;
        }
      }

      // 3. Resolve fee
      const resolved = await resolveConsultationFee({
        isFollowUp,
        followUpFee: fuCheck?.followUpFee || 0,
        isCoveredBySubscription,
        doctorId,
        hospitalId,
        consultationType: consultationType || 'in_person',
      });

      consultationFee = resolved.fee;
      feeSource       = resolved.source;

      // 4. Compute follow-up expiry for NEW op (from doctor/hospital followUpValidDays)
      if (!isFollowUp) {
        let followUpValidDays = 7; // default
        let followUpFee       = 0;

        if (hospitalId) {
          const hosp = await Hospital.findById(hospitalId)
            .select('consultationPricing managementModel')
            .lean();
          if (hosp?.managementModel === 'hospital-manager' && hosp.consultationPricing) {
            followUpValidDays = hosp.consultationPricing.followUpValidDays || 7;
            followUpFee       = hosp.consultationPricing.followUpFee || 0;
          }
        } else {
          const doc = await DoctorProfile.findById(doctorId)
            .select('fees followUpValidDays')
            .lean();
          if (doc?.followUpValidDays) followUpValidDays = doc.followUpValidDays;
          if (doc?.fees?.followUpFee) followUpFee = doc.fees.followUpFee;
        }

        const expiry = new Date(scheduledAt);
        expiry.setDate(expiry.getDate() + followUpValidDays);
        followUpExpiryForOp  = expiry;
        followUpFeeForOp     = followUpFee;
      }
    }

    // ── Build billing ─────────────────────────────────────────────────────
    let gross = billing?.grossAmount || 0;

    // If consultation fee resolved, ensure it's in gross
    if (components.needsConsultation && consultationFee > 0 && gross === 0) {
      gross = consultationFee;
    }

    const disc  = (billing?.discountAmount || 0) + (billing?.couponDiscount || 0);
    const taxPc = billing?.taxPercent || 0;
    const tax   = taxPc ? +((gross - disc) * (taxPc / 100)).toFixed(2) : 0;
    const net   = Math.max(0, +(gross - disc + tax).toFixed(2));

    // ── Build sub-docs ─────────────────────────────────────────────────────
    const transportDoc = components.needsTransport
      ? { pickupAddress, dropAddress, distanceKm: 0, estimatedDurationMin: 0 }
      : null;

    const careDoc = components.needsCare ? {} : null;

    let consultationDoc = null;
    if (components.needsConsultation) {
      consultationDoc = {
        doctor:           doctorId,
        hospital:         hospitalId || null,
        consultationType: consultationType || 'in_person',
        scheduledAt:      new Date(scheduledAt),
        specialization:   '',
        reasonForVisit:   req.body.reasonForVisit || '',
      };
    }

    let diagnosticDoc = null;
    if (components.needsDiagnostic) {
      if (!diagnosticTests?.length) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'diagnosticTests required' });
      }
      diagnosticDoc = {
        labPartner:             labPartnerId || null,
        isHomeSampleCollection: isHomeSampleCollection || false,
        collectionAddress:      isHomeSampleCollection ? pickupAddress : null,
        collectionScheduledAt:  new Date(scheduledAt),
        testsRequested:         diagnosticTests,
      };
    }

    let bloodBankDoc = null;
    if (components.needsBloodBank) {
      bloodBankDoc = {
        bloodGroup,
        componentRequired,
        unitsRequired:   bloodUnitsRequired || 1,
        hospital:        bloodHospitalId || null,
        requestedForDate: new Date(scheduledAt),
      };
    }

    // ── Subscription context ───────────────────────────────────────────────
    let subscriptionPlan = { plan: null, planSlug: null, isCoveredByPlan: false };
    if (subscriptionPlanId) {
      subscriptionPlan = { plan: subscriptionPlanId, isCoveredByPlan: true };
    } else if (isCoveredBySubscription && subDoc) {
      subscriptionPlan = {
        plan:           subDoc.plan,
        planSlug:       subDoc.planType,
        isCoveredByPlan: true,
      };
    }

    // ── Create booking ─────────────────────────────────────────────────────
    const [booking] = await Booking.create(
      [{
        serviceType: primaryServiceType,
        customer:    req.user._id,
        patient:     patientId || req.user._id,
        patientName: patientName || req.user.name,
        scheduledAt: new Date(scheduledAt),
        subscriptionPlan,
        status:      'pending',
        transport:   transportDoc,
        careAssistant: careDoc,
        consultation: consultationDoc,
        diagnostic:   diagnosticDoc,
        bloodBank:    bloodBankDoc,
        billing: {
          grossAmount:    gross,
          discountAmount: billing?.discountAmount || 0,
          couponCode:     billing?.couponCode || null,
          couponDiscount: billing?.couponDiscount || 0,
          taxPercent:     taxPc,
          taxAmount:      tax,
          netAmount:      net,
          currency:       'INR',
        },
        payment: {
          status: net === 0 ? 'paid' : 'unpaid',
          method: paymentMethod || null,
        },
        bookingSource: bookingSource || 'app_android',
        customerNotes,
        createdBy: req.user._id,
      }],
      { session }
    );

    // ── Generate OP record ────────────────────────────────────────────────
    let opRecord = null;
    if (components.needsConsultation) {
      opRecord = await OutPatientRecord.create(
        [{
          opNumber:        await generateOpNumber(hospitalId),
          booking:         booking._id,
          bookingNumber:   booking.bookingNumber,
          patient:         patientId || req.user._id,
          patientName:     patientName || req.user.name,
          doctor:          doctorId,
          hospital:        hospitalId || null,
          consultationType: consultationType || 'in_person',
          scheduledAt:     new Date(scheduledAt),
          isFollowUp,
          parentOp:        resolvedParentOpId || null,
          followUpExpiry:  followUpExpiryForOp || null,
          followUpFee:     followUpFeeForOp,
          consultationFee,
          feeSource,
          isCoveredBySubscription,
          status:          'scheduled',
        }],
        { session }
      );
      opRecord = opRecord[0];

      // Link OP number to booking
      await Booking.findByIdAndUpdate(
        booking._id,
        { 'consultation.opNumber': opRecord.opNumber, 'consultation.opId': opRecord._id },
        { session }
      );

      // Deduct subscription consultation if used
      if (isCoveredBySubscription && subDoc) {
        await incrementSubscriptionUsage(subDoc._id, 'consultationsUsed');
      }
    }

    await session.commitTransaction();
    session.endSession();

    // ── Razorpay order (outside transaction — external API) ────────────────
    let razorpayOrder = null;
    if (net > 0 && paymentMethod !== 'cash' && paymentMethod !== 'subscription_credit') {
      try {
        razorpayOrder = await createRazorpayOrder(net, booking.bookingNumber, {
          serviceType: primaryServiceType,
          isFollowUp:  isFollowUp ? 'yes' : 'no',
        });

        // Store gateway order ID
        await Booking.findByIdAndUpdate(booking._id, {
          'payment.gatewayOrderId': razorpayOrder.orderId,
        });
      } catch (rzpErr) {
        console.error('[Razorpay order create]', rzpErr.message);
        // Non-fatal — customer can retry payment
      }
    }

    // ── Notifications ──────────────────────────────────────────────────────
    const user = await User.findById(req.user._id).select('email phone name').lean();

    await createNotification({
      recipient: req.user._id,
      title:     'Booking Created',
      body:      `Booking #${booking.bookingNumber} placed. ${isFollowUp ? 'Follow-up consultation.' : ''}`,
      type:      'Booking_Confirmed',
      bookingId: booking._id,
    });

    // Email
    try {
      await sendEmail({
        email:   user.email,
        subject: `Booking Confirmed — #${booking.bookingNumber}`,
        html: transactionalTemplate({
          header:     'BOOKING CONFIRMATION',
          title:      `Booking #${booking.bookingNumber} placed!`,
          body: `
            <b>Service:</b> ${resolvedServiceTypes.join(', ')}<br/>
            <b>Scheduled:</b> ${new Date(scheduledAt).toLocaleString('en-IN')}<br/>
            <b>Amount:</b> ₹${net}<br/>
            ${opRecord ? `<b>OP Number:</b> ${opRecord.opNumber}<br/>` : ''}
            ${isFollowUp ? '<b>Type:</b> Follow-up (discounted/free)<br/>' : ''}
            <b>Status:</b> Pending Confirmation
          `,
          buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
          buttonText: 'View Booking',
        }),
      });
    } catch (e) { console.error('[Booking] Email failed:', e.message); }

    // SMS
    if (user.phone) {
      try {
        await sendSms({
          to:      user.phone,
          message: rideBookedSms({
            userName:       user.name,
            rideId:         booking.bookingNumber,
            scheduledAt:    new Date(scheduledAt).toLocaleString('en-IN'),
            pickupAddress:  `${pickupAddress.street}, ${pickupAddress.city}`,
          }),
        });
      } catch (e) { console.error('[Booking] SMS failed:', e.message); }
    }

    // Doctor appointment notification
    if (components.needsConsultation && doctorId) {
      try {
        const docProfile = await DoctorProfile.findById(doctorId)
          .populate('user', 'email name phone')
          .lean();
        if (docProfile?.user?.email) {
          await sendEmail({
            email:   docProfile.user.email,
            subject: `New Appointment — #${booking.bookingNumber}`,
            html: transactionalTemplate({
              header: 'NEW APPOINTMENT BOOKED',
              title:  'New patient appointment',
              body: `
                <b>Patient:</b> ${patientName || user.name}<br/>
                <b>Type:</b> ${consultationType || 'in_person'}${isFollowUp ? ' (Follow-up)' : ''}<br/>
                <b>Scheduled:</b> ${new Date(scheduledAt).toLocaleString('en-IN')}<br/>
                <b>OP Number:</b> ${opRecord?.opNumber || 'N/A'}<br/>
                <b>Booking #:</b> ${booking.bookingNumber}
              `,
              buttonLink: `${process.env.FRONTEND_URL}/doctor/bookings/${booking._id}`,
              buttonText: 'View Appointment',
            }),
          });
        }
      } catch (e) { console.error('[Booking] Doctor email failed:', e.message); }
    }

    await SystemLog.createLog({
      level:    'success',
      category: 'api',
      message:  `Booking created #${booking.bookingNumber}`,
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      request:  { method: 'POST', path: '/bookings', statusCode: 201 },
    });

    return res.status(201).json({
      success: true,
      message: 'Booking created',
      data: {
        booking,
        opRecord:     opRecord || null,
        razorpayOrder,
        isFollowUp,
        feeSource,
        consultationFee,
      },
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error('[POST /bookings]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /bookings/payment/verify
 * Verify Razorpay payment signature and mark booking paid.
 */
router.post('/payment/verify', protect, authorize('customer'), async (req, res) => {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }

    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment signature invalid', code: 'SIGNATURE_INVALID' });
    }

    const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.payment.status === 'paid') {
      return res.json({ success: true, message: 'Already paid', data: { booking } });
    }

    booking.payment.status          = 'paid';
    booking.payment.gatewayOrderId  = razorpayOrderId;
    booking.payment.gatewayPaymentId = razorpayPaymentId;
    booking.payment.paidAt          = new Date();
    booking.payment.paidAmount      = booking.billing.netAmount;
    await booking.save();

    const user = await User.findById(req.user._id).select('email phone name').lean();

    await createNotification({
      recipient: req.user._id,
      title:     'Payment Successful',
      body:      `Payment of ₹${booking.billing.netAmount} for booking #${booking.bookingNumber} received.`,
      type:      'Payment_Success',
      bookingId: booking._id,
    });

    try {
      await sendSms({
        to:      user.phone,
        message: paymentSuccessfulSms?.({
          userName:  user.name,
          amount:    booking.billing.netAmount,
          bookingId: booking.bookingNumber,
        }) || `Hi ${user.name}, payment of Rs.${booking.billing.netAmount} received for booking #${booking.bookingNumber}. -Likeson`,
      });
    } catch (e) { console.error('[PayVerify] SMS failed:', e.message); }

    return res.json({ success: true, message: 'Payment verified', data: { booking } });
  } catch (err) {
    console.error('[POST /payment/verify]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bookings/my
 * Customer's bookings — paginated, filterable.
 */
router.get('/my', protect, authorize('customer'), async (req, res) => {
  try {
    const { status, serviceType, page = 1, limit = 10 } = req.query;
    const filter = { customer: req.user._id };
    if (status)      filter.status      = status;
    if (serviceType) filter.serviceType = serviceType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-adminNotes -timeline')
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
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bookings/my/ops
 * Customer's OP records — full outpatient history.
 */
router.get('/my/ops', protect, authorize('customer'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const filter = { patient: req.user._id };
    const skip   = (parseInt(page) - 1) * parseInt(limit);

    const [ops, total] = await Promise.all([
      OutPatientRecord.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('doctor', 'user specialization')
        .populate('hospital', 'name address')
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
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bookings/availability/check
 * Pre-booking doctor + hospital availability check.
 */
router.get('/availability/check', protect, authorize('customer'), async (req, res) => {
  try {
    const { doctorId, hospitalId, scheduledAt } = req.query;
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt required' });

    const result = {};

    if (doctorId) {
      result.doctor = await checkDoctorAvailability(doctorId, scheduledAt);
    }

    if (hospitalId) {
      const hospital = await Hospital.findById(hospitalId)
        .select('isActive isVerified name operatingHours')
        .lean();
      if (!hospital) {
        result.hospital = { available: false, reason: 'Hospital not found' };
      } else if (!hospital.isActive || !hospital.isVerified) {
        result.hospital = { available: false, reason: 'Hospital not operational' };
      } else {
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const dayName  = dayNames[new Date(scheduledAt).getDay()];
        const opDay    = hospital.operatingHours?.find(h => h.day === dayName);
        result.hospital = {
          available:  opDay ? !opDay.isClosed : true,
          is24Hours:  opDay?.is24Hours || false,
          name:       hospital.name,
        };
      }
    }

    // Follow-up eligibility check
    if (doctorId && req.query.checkFollowUp === 'true') {
      const fu = await checkFollowUpEligibility({
        customerId: req.user._id,
        doctorId,
        hospitalId,
      });
      result.followUp = fu
        ? { eligible: true, parentOpNumber: fu.parentOpNumber, followUpFee: fu.followUpFee }
        : { eligible: false };
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bookings/:id
 * Booking detail — role-scoped access.
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name phone email avatar')
      .populate('transport.driver', 'legalName phone driverCode')
      .populate('careAssistant.careAssistant', 'fullName phone')
      .populate('consultation.doctor', 'user specialization')
      .populate('consultation.hospital', 'name address contact')
      .populate('diagnostic.labPartner', 'labName contact')
      .lean();

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const userId     = req.user._id.toString();
    const role       = req.user.role;
    const isCustomer = booking.customer?._id?.toString() === userId;
    const isAdmin    = ['admin', 'superadmin'].includes(role);

    if (!isCustomer && !isAdmin) {
      // Check if driver/care/TP is linked
      const driverLinked = await Ride.findOne({ booking: req.params.id, driver: req.user._id }).select('_id').lean();
      const careLinked   = role === 'care assistant'
        ? await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean()
        : null;

      const caId = careLinked?._id?.toString();
      const careBookingMatch = caId && booking.careAssistant?.careAssistant?.toString() === caId;

      if (!driverLinked && !careBookingMatch) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Attach OP record if consultation
    let opRecord = null;
    if (booking.consultation?.opId) {
      opRecord = await OutPatientRecord.findById(booking.consultation.opId).lean();
    }

    return res.json({ success: true, data: { booking, opRecord } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * DELETE /bookings/:id/cancel
 * Customer cancel — refund computed from PlatformPricingConfig refundPolicy.
 */
router.delete('/:id/cancel', protect, authorize('customer'), async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.isCancellable)
      return res.status(400).json({ success: false, message: `Cannot cancel in status: ${booking.status}` });

    const refundPercent = booking.fullRefundEligible ? 100 : 50;
    const refundAmount  = +((booking.billing.netAmount * refundPercent) / 100).toFixed(2);

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledBy:     req.user._id,
      cancelledByRole: 'customer',
      reason:          reason || 'Cancelled by customer',
      refundPercent,
      refundAmount,
      refundStatus: refundAmount > 0 ? 'pending' : 'none',
    };
    await booking.save();

    // If subscription consultation was used — refund the count
    if (booking.subscriptionPlan?.isCoveredByPlan && booking.subscriptionPlan?.plan) {
      const sub = await UserSubscription.findOne({
        user: req.user._id,
        plan: booking.subscriptionPlan.plan,
        status: { $in: ['Active', 'Trial'] },
      });
      if (sub) {
        const now      = new Date();
        const curMonth = now.getMonth() + 1;
        const curYear  = now.getFullYear();
        await UserSubscription.findOneAndUpdate(
          { _id: sub._id, 'usageHistory.month': curMonth, 'usageHistory.year': curYear },
          { $inc: { 'usageHistory.$.consultationsUsed': -1 } }
        );
      }
    }

    // Cancel OP record
    if (booking.consultation?.opId) {
      await OutPatientRecord.findByIdAndUpdate(booking.consultation.opId, { status: 'cancelled' });
    }

    const user = await User.findById(req.user._id).select('email phone name').lean();

    await createNotification({
      recipient: req.user._id,
      title:     'Booking Cancelled',
      body:      `Booking #${booking.bookingNumber} cancelled. Refund: ₹${refundAmount}`,
      type:      'Booking_Cancelled',
      bookingId: booking._id,
    });

    try {
      await sendEmail({
        email:   user.email,
        subject: `Booking Cancelled — #${booking.bookingNumber}`,
        html: transactionalTemplate({
          header:     'BOOKING CANCELLED',
          title:      `Booking #${booking.bookingNumber} cancelled`,
          body:       `Refund of ₹${refundAmount} (${refundPercent}%) processed in 5-7 business days.`,
          buttonLink: `${process.env.FRONTEND_URL}/bookings`,
          buttonText: 'View Bookings',
        }),
      });
    } catch (e) { console.error('[Cancel] Email:', e.message); }

    if (user.phone) {
      try {
        await sendSms({
          to:      user.phone,
          message: rideCancelledSms({
            userName:   user.name,
            rideId:     booking.bookingNumber,
            refundNote: refundAmount > 0 ? `Refund of Rs.${refundAmount} will be processed.` : '',
          }),
        });
      } catch (e) { console.error('[Cancel] SMS:', e.message); }
    }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id,
      status:    'cancelled',
      timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Booking cancelled', data: { refundAmount } });
  } catch (err) {
    console.error('[DELETE /cancel]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /bookings/:id/rate
 * Customer rating after completion.
 */
router.post('/:id/rate', protect, authorize('customer'), async (req, res) => {
  try {
    const { ratingValue, review } = req.body;
    if (!ratingValue || ratingValue < 1 || ratingValue > 5)
      return res.status(400).json({ success: false, message: 'ratingValue 1-5 required' });

    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
    if (!booking)             return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'completed')
      return res.status(400).json({ success: false, message: 'Can only rate completed bookings' });
    if (booking.customerRating?.ratingValue)
      return res.status(400).json({ success: false, message: 'Already rated' });

    booking.customerRating = { ratingValue, review, ratedBy: req.user._id };
    await booking.save();

    return res.json({ success: true, message: 'Rating submitted', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bookings/:id/track
 * REST tracking snapshot (socket fallback).
 */
router.get('/:id/track', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .select('status transport.driver')
      .lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const ride = await Ride.findOne({
      booking: req.params.id,
      status:  { $in: ['En-Route','Arrived','Started'] },
    }).select('_id status liveLocation driver').lean();

    let tracking = null;
    if (ride) {
      tracking = await RideTracking.findOne({ ride: ride._id })
        .select('currentLocation metrics path')
        .lean();
    }

    return res.json({
      success: true,
      data: {
        bookingStatus: booking.status,
        ride: ride ? { status: ride.status, liveLocation: ride.liveLocation } : null,
        tracking: tracking
          ? {
              currentLocation:   tracking.currentLocation,
              remainingDistance: tracking.metrics?.remainingDistanceMeter,
              remainingDuration: tracking.metrics?.remainingDurationSecond,
              lastUpdatedAt:     tracking.metrics?.lastUpdateAt,
            }
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bookings/:id/invoice
 * PDF invoice download.
 */
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('consultation.doctor', 'user specialization')
      .populate('consultation.hospital', 'name address')
      .lean();

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isOwner = booking.customer?._id?.toString() === req.user._id.toString();
    const isAdmin = ['admin','superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin)
      return res.status(403).json({ success: false, message: 'Access denied' });

    const pdfBuffer = await generateBookingInvoicePdf(booking);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking.bookingNumber}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// DRIVER ROUTES (agency drivers)
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/** GET /bookings/driver/assigned */
router.get('/driver/assigned', protect, authorize('driver'), async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id }).select('_id').lean();
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found' });

    const rides = await Ride.find({ driver: req.user._id, status: { $in: ['Assigned','Accepted'] } })
      .populate('booking', 'bookingNumber serviceType scheduledAt patientName billing.netAmount status')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: { rides } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /bookings/:id/ride/accept */
router.patch('/:id/ride/accept', protect, authorize('driver'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'Assigned')
      return res.status(400).json({ success: false, message: 'Ride not in Assigned state' });

    ride.status = 'Accepted';
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status = 'confirmed';
    await booking.save();

    const customer   = await User.findById(booking.customer).select('email phone name').lean();
    const driverUser = await User.findById(req.user._id).select('name phone').lean();
    const driver     = await Driver.findOne({ user: req.user._id })
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
          rideId:        booking.bookingNumber,
          driverName:    driverUser.name,
          vehicleNumber: driver?.assignedVehicleSnapshot?.registrationNumber || 'N/A',
          driverPhone:   driver?.phone || driverUser.phone,
        }),
      });
    } catch (e) { console.error('[Accept] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'confirmed', timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Ride accepted', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /bookings/:id/ride/reject */
router.patch('/:id/ride/reject', protect, authorize('driver'), async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    ride.status = 'Cancelled';
    await ride.save();

    const booking = await Booking.findById(req.params.id).select('transport.assignedTP bookingNumber').lean();
    if (booking?.assignedTP) {
      getBookingSocketService()?.emitToRoom(`tp:${booking.assignedTP}`, 'driver_rejected', {
        bookingId:     req.params.id,
        bookingNumber: booking.bookingNumber,
        reason:        reason || 'Driver rejected',
      });
    }

    return res.json({ success: true, message: 'Ride rejected. TP will reassign.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /bookings/:id/ride/arrived — generates OTP, sends to customer */
router.patch('/:id/ride/arrived', protect, authorize('driver'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['Accepted','En-Route'].includes(ride.status))
      return res.status(400).json({ success: false, message: 'Invalid ride state for arrival' });

    const otpCode    = genOtp();
    ride.status      = 'Arrived';
    ride.startOTP    = otpCode;
    await ride.save();

    const booking  = await Booking.findById(req.params.id);
    const customer = await User.findById(booking.customer).select('email phone name').lean();

    try {
      await sendEmail({
        email:   customer.email,
        subject: `Ride OTP — #${booking.bookingNumber}`,
        html: otpTemplate({
          title:   'Driver arrived! Share OTP to start.',
          body:    'Your driver is waiting at pickup.',
          otpCode,
        }),
      });
    } catch (e) { console.error('[Arrived] OTP email:', e.message); }

    if (customer.phone) {
      try {
        await sendSms({
          to:      customer.phone,
          message: otpSms({ otpCode, purpose: `ride start #${booking.bookingNumber}` }),
        });
      } catch (e) { console.error('[Arrived] OTP SMS:', e.message); }
    }

    await createNotification({
      recipient: booking.customer,
      title:     'Driver Arrived',
      body:      `Driver arrived. Share OTP ${otpCode} to start.`,
      type:      'Driver_Arrived',
      bookingId: booking._id,
      priority:  'High',
    });

    const ss = getBookingSocketService();
    ss?.emitToRoom(`booking:${booking._id}`, 'driver_arrived',  { bookingId: booking._id });
    ss?.emitToRoom(`booking:${booking._id}`, 'otp_required',    { bookingId: booking._id });

    return res.json({ success: true, message: 'Arrival marked, OTP sent' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /bookings/:id/ride/start — OTP verify → start ride */
router.post('/:id/ride/start', protect, authorize('driver'), async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required' });

    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'Arrived')
      return res.status(400).json({ success: false, message: 'Driver must be Arrived' });
    if (ride.startOTP !== otp)
      return res.status(400).json({ success: false, message: 'Invalid OTP' });

    ride.status      = 'Started';
    ride.startTime   = new Date();
    ride.otpVerified = true;
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status = 'in_progress';
    if (booking.transport) booking.transport.rideStartedAt = new Date();
    await booking.save();

    await RideTracking.findOneAndUpdate(
      { ride: ride._id },
      { ride: ride._id, currentLocation: ride.liveLocation },
      { upsert: true, new: true }
    );

    const customer = await User.findById(booking.customer).select('phone name').lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Ride Started',
      body:      `Ride #${booking.bookingNumber} started. Safe journey!`,
      type:      'Ride_Update',
      bookingId: booking._id,
    });

    try {
      await sendSms({
        to:      customer.phone,
        message: rideStartedSms({ userName: customer.name, rideId: booking.bookingNumber, driverName: req.user.name }),
      });
    } catch (e) { console.error('[Start] SMS:', e.message); }

    const ss = getBookingSocketService();
    ss?.emitToRoom(`booking:${booking._id}`, 'ride_started',          { bookingId: booking._id, startedAt: ride.startTime });
    ss?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', { bookingId: booking._id, status: 'in_progress', timestamp: new Date() });

    return res.json({ success: true, message: 'Ride started', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** POST /bookings/:id/ride/end */
router.post('/:id/ride/end', protect, authorize('driver'), async (req, res) => {
  try {
    const { dropPhotoUrl, distanceKm, waitingTimeMinutes } = req.body;

    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'Started')
      return res.status(400).json({ success: false, message: 'Ride must be Started' });

    ride.status             = 'Completed';
    ride.endTime            = new Date();
    ride.distanceKm         = distanceKm || 0;
    ride.waitingTimeMinutes = waitingTimeMinutes || 0;
    if (dropPhotoUrl) ride.images = { ...ride.images, dropPhoto: dropPhotoUrl };
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status = 'completed';
    if (booking.transport) {
      booking.transport.rideEndedAt  = new Date();
      booking.transport.distanceKm   = distanceKm || 0;
      booking.transport.waitingCharges = 0;
    }
    await booking.save();

    const customer = await User.findById(booking.customer).select('email phone name').lean();

    await createNotification({
      recipient: booking.customer,
      title:     'Ride Completed',
      body:      `Booking #${booking.bookingNumber} completed. Thank you!`,
      type:      'Booking_Completed',
      bookingId: booking._id,
    });

    try {
      await sendSms({
        to:      customer.phone,
        message: rideCompletedSms({ userName: customer.name, rideId: booking.bookingNumber, totalFare: booking.billing.netAmount }),
      });
    } catch (e) { console.error('[End] SMS:', e.message); }

    try {
      const pdfBuffer = await generateBookingInvoicePdf(booking);
      await sendEmail({
        email:   customer.email,
        subject: `Invoice — #${booking.bookingNumber}`,
        html: transactionalTemplate({
          header:     'BOOKING COMPLETED',
          title:      `Booking #${booking.bookingNumber} complete!`,
          body:       `Total: ₹${booking.billing.netAmount}. Invoice attached.`,
          buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}/rate`,
          buttonText: 'Rate Your Experience',
        }),
        attachments: [{
          content:     pdfBuffer.toString('base64'),
          filename:    `invoice-${booking.bookingNumber}.pdf`,
          type:        'application/pdf',
          disposition: 'attachment',
        }],
      });
    } catch (e) { console.error('[End] Invoice email:', e.message); }

    const ss = getBookingSocketService();
    ss?.emitToRoom(`booking:${booking._id}`, 'ride_completed',        { bookingId: booking._id, completedAt: ride.endTime });
    ss?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', { bookingId: booking._id, status: 'completed', timestamp: new Date() });

    return res.json({ success: true, message: 'Ride completed', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /bookings/driver/location — HTTP GPS fallback */
router.patch('/driver/location', protect, authorize('driver'), async (req, res) => {
  try {
    const { lat, lng, heading, speed, bookingId } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });

    await Driver.findOneAndUpdate(
      { user: req.user._id },
      {
        'location.coordinates': [lng, lat],
        'location.heading':     heading,
        'location.speedKmh':    speed,
        'location.updatedAt':   new Date(),
      }
    );

    if (bookingId) {
      const ride = await Ride.findOne({
        booking: bookingId,
        driver:  req.user._id,
        status:  { $in: ['En-Route','Arrived','Started'] },
      });
      if (ride) {
        ride.liveLocation = { type: 'Point', coordinates: [lng, lat] };
        await ride.save();

        await RideTracking.findOneAndUpdate(
          { ride: ride._id },
          {
            currentLocation: { type: 'Point', coordinates: [lng, lat] },
            $push: { path: { lat, lng, speed: speed||0, heading: heading||0, timestamp: new Date() } },
            'metrics.lastUpdateAt': new Date(),
          },
          { upsert: true }
        );

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

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// SOLO DRIVER PARTNER ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/** GET /bookings/solo/available */
router.get('/solo/available', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const solo = await SoloDriverPartner.findOne({ user: req.user._id }).select('driverProfile').lean();
    if (!solo?.driverProfile) return res.status(404).json({ success: false, message: 'Driver profile not found' });

    const rides = await Ride.find({ driver: req.user._id, status: { $in: ['Assigned','Accepted'] } })
      .populate('booking', 'bookingNumber serviceType scheduledAt patientName billing.netAmount')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: { rides } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/solo/accept */
router.patch('/:id/solo/accept', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'Assigned')
      return res.status(400).json({ success: false, message: 'Ride not in Assigned state' });

    ride.status = 'Accepted';
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status = 'confirmed';
    await booking.save();

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    const solo     = await SoloDriverPartner.findOne({ user: req.user._id }).select('legalName phone vehicle').lean();

    try {
      await sendSms({
        to:      customer.phone,
        message: driverAssignedSms({
          userName:      customer.name,
          rideId:        booking.bookingNumber,
          driverName:    solo?.legalName || req.user.name,
          vehicleNumber: solo?.vehicle?.registrationNumber || 'N/A',
          driverPhone:   solo?.phone || '',
        }),
      });
    } catch (e) { console.error('[Solo accept] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'confirmed', timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Ride accepted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/solo/reject */
router.patch('/:id/solo/reject', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    ride.status = 'Cancelled';
    await ride.save();

    getBookingSocketService()?.emitToRoom('admin:ops', 'solo_driver_rejected', {
      bookingId: req.params.id,
      message:   'Solo driver rejected. Re-assignment needed.',
    });

    return res.json({ success: true, message: 'Ride rejected. Admin notified.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/solo/arrived */
router.patch('/:id/solo/arrived', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (!['Accepted','En-Route'].includes(ride.status))
      return res.status(400).json({ success: false, message: 'Invalid state for arrival' });

    const otpCode = genOtp();
    ride.status   = 'Arrived';
    ride.startOTP = otpCode;
    await ride.save();

    const booking  = await Booking.findById(req.params.id);
    const customer = await User.findById(booking.customer).select('email phone name').lean();

    try {
      await sendEmail({
        email:   customer.email,
        subject: `Ride OTP — #${booking.bookingNumber}`,
        html:    otpTemplate({ title: 'Driver arrived! Share OTP to start.', body: 'Your driver is at pickup.', otpCode }),
      });
    } catch (e) { console.error('[Solo arrived] OTP email:', e.message); }

    if (customer.phone) {
      try {
        await sendSms({ to: customer.phone, message: otpSms({ otpCode, purpose: `ride start #${booking.bookingNumber}` }) });
      } catch (e) { console.error('[Solo arrived] OTP SMS:', e.message); }
    }

    const ss = getBookingSocketService();
    ss?.emitToRoom(`booking:${booking._id}`, 'driver_arrived', { bookingId: booking._id });
    ss?.emitToRoom(`booking:${booking._id}`, 'otp_required',   { bookingId: booking._id });

    return res.json({ success: true, message: 'Arrived marked, OTP sent' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /bookings/:id/solo/start */
router.post('/:id/solo/start', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required' });

    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'Arrived')
      return res.status(400).json({ success: false, message: 'Driver must be Arrived' });
    if (ride.startOTP !== otp)
      return res.status(400).json({ success: false, message: 'Invalid OTP' });

    ride.status    = 'Started';
    ride.startTime = new Date();
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status = 'in_progress';
    await booking.save();

    await RideTracking.findOneAndUpdate(
      { ride: ride._id },
      { ride: ride._id },
      { upsert: true, new: true }
    );

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_started', { bookingId: booking._id });

    return res.json({ success: true, message: 'Ride started' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /bookings/:id/solo/end */
router.post('/:id/solo/end', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const { dropPhotoUrl, distanceKm } = req.body;

    const ride = await Ride.findOne({ booking: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    if (ride.status !== 'Started')
      return res.status(400).json({ success: false, message: 'Ride must be Started' });

    ride.status     = 'Completed';
    ride.endTime    = new Date();
    ride.distanceKm = distanceKm || 0;
    if (dropPhotoUrl) ride.images = { ...ride.images, dropPhoto: dropPhotoUrl };
    await ride.save();

    const booking = await Booking.findById(req.params.id);
    booking.status = 'completed';
    await booking.save();

    const customer = await User.findById(booking.customer).select('phone name').lean();

    try {
      await sendSms({
        to:      customer.phone,
        message: rideCompletedSms({ userName: customer.name, rideId: booking.bookingNumber, totalFare: booking.billing.netAmount }),
      });
    } catch (e) { console.error('[Solo end] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'ride_completed', { bookingId: booking._id });

    return res.json({ success: true, message: 'Ride completed', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/solo/location */
router.patch('/solo/location', protect, authorize('solodriverpartner'), async (req, res) => {
  try {
    const { lat, lng, heading, speed, bookingId } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });

    await SoloDriverPartner.findOneAndUpdate(
      { user: req.user._id },
      { 'vehicle.lastKnownLocation.coordinates': [lng, lat], 'vehicle.lastLocationUpdatedAt': new Date() }
    );

    if (bookingId) {
      const ride = await Ride.findOne({
        booking: bookingId,
        driver:  req.user._id,
        status:  { $in: ['En-Route','Arrived','Started'] },
      });
      if (ride) {
        ride.liveLocation = { type: 'Point', coordinates: [lng, lat] };
        await ride.save();

        await RideTracking.findOneAndUpdate(
          { ride: ride._id },
          {
            currentLocation: { type: 'Point', coordinates: [lng, lat] },
            $push: { path: { lat, lng, speed: speed||0, heading: heading||0, timestamp: new Date() } },
            'metrics.lastUpdateAt': new Date(),
          },
          { upsert: true }
        );

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

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// TRANSPORT PARTNER ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/** GET /bookings/tp/assigned */
router.get('/tp/assigned', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'TP not found' });

    const bookings = await Booking.find({ assignedTP: tp._id })
      .select('bookingNumber serviceType scheduledAt patientName status billing.netAmount transport.driver')
      .sort({ scheduledAt: -1 })
      .lean();

    return res.json({ success: true, data: { bookings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /bookings/tp/drivers/available */
router.get('/tp/drivers/available', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'TP not found' });

    const drivers = await Driver.find({
      ownerAgency: tp._id,
      status:      'Available',
      isActive:    true,
      isVerified:  true,
      isBlocked:   false,
    })
      .select('legalName phone driverCode assignedVehicleSnapshot performance.rating status')
      .lean();

    return res.json({ success: true, data: { drivers } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/tp/assign-driver */
router.patch('/:id/tp/assign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { driverId, vehicleId } = req.body;
    if (!driverId) return res.status(400).json({ success: false, message: 'driverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id vehicles').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'TP not found' });

    const driver = await Driver.findOne({ _id: driverId, ownerAgency: tp._id }).lean();
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // FIX: assignedTP on booking root, not booking.transport
    if (booking.assignedTP?.toString() !== tp._id.toString())
      return res.status(403).json({ success: false, message: 'Booking not assigned to your TP' });

    const vehicle = vehicleId
      ? tp.vehicles?.find(v => v._id.toString() === vehicleId)
      : tp.vehicles?.find(v => v.assignedDriver?.toString() === driverId.toString());

    const ride = await Ride.create({
      booking:          booking._id,
      legSequence:      1,
      legType:          'Pickup-to-Hospital',
      customer:         booking.customer,
      driver:           driver.user,
      transportPartner: tp._id,
      // vehicle is optional — schema bug fix: not required for TP-assigned rides
      ...(vehicle ? { vehicle: vehicle._id } : {}),
      pickupLocation: {
        address:     `${booking.transport?.pickupAddress?.street || ''}, ${booking.transport?.pickupAddress?.city || ''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.pickupAddress?.coordinates || [0,0] },
      },
      dropLocation: {
        address:     `${booking.transport?.dropAddress?.street || ''}, ${booking.transport?.dropAddress?.city || ''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.dropAddress?.coordinates || [0,0] },
      },
      status:   'Assigned',
      startOTP: genOtp(),
      endOTP:   genOtp(),
    });

    booking.status = 'assigned'; // FIX: must set before save
    if (booking.transport) {
      booking.transport.driver = driver._id;
      if (vehicle) {
        booking.transport.vehicleSnapshot = {
          registrationNumber: vehicle.registrationNumber,
          make:               vehicle.make,
          model:              vehicle.model,
          color:              vehicle.color,
          vehicleType:        vehicle.vehicleType,
        };
      }
    }
    await booking.save();

    const driverUser = await User.findById(driver.user).select('email phone name').lean();

    await createNotification({
      recipient: driver.user,
      title:     'New Ride Assigned',
      body:      `Booking #${booking.bookingNumber} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

    try {
      await sendSms({
        to:      driverUser.phone,
        message: `Hi ${driverUser.name}, new ride: Booking #${booking.bookingNumber}. Accept from Likeson Driver app.`,
      });
    } catch (e) { console.error('[TP assign] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_assigned', {
      bookingId: booking._id, driverName: driverUser.name,
    });

    return res.json({ success: true, message: 'Driver assigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/tp/reassign-driver */
router.patch('/:id/tp/reassign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { newDriverId } = req.body;
    const tp     = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    const driver = await Driver.findOne({ _id: newDriverId, ownerAgency: tp._id }).lean();
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    await Ride.findOneAndUpdate(
      { booking: req.params.id, status: { $in: ['Assigned','Accepted'] } },
      { status: 'Cancelled' }
    );

    const booking = await Booking.findById(req.params.id);
    const ride = await Ride.create({
      booking:          booking._id,
      legSequence:      1,
      legType:          'Pickup-to-Hospital',
      customer:         booking.customer,
      driver:           driver.user,
      transportPartner: tp._id,
      pickupLocation: {
        address:     `${booking.transport?.pickupAddress?.street||''}, ${booking.transport?.pickupAddress?.city||''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.pickupAddress?.coordinates || [0,0] },
      },
      dropLocation: {
        address:     `${booking.transport?.dropAddress?.street||''}, ${booking.transport?.dropAddress?.city||''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.dropAddress?.coordinates || [0,0] },
      },
      status:   'Assigned',
      startOTP: genOtp(),
      endOTP:   genOtp(),
    });

    if (booking.transport) booking.transport.driver = driver._id;
    await booking.save();

    await createNotification({
      recipient: driver.user,
      title:     'Ride Assigned',
      body:      `Booking #${booking.bookingNumber} assigned to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
    });

    return res.json({ success: true, message: 'Driver reassigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/** GET /bookings/care/assigned */
router.get('/care/assigned', protect, authorize('care assistant'), async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const bookings = await Booking.find({ 'careAssistant.careAssistant': profile._id })
      .select('bookingNumber serviceType scheduledAt patientName status transport.pickupAddress careAssistant')
      .sort({ scheduledAt: -1 })
      .lean();

    return res.json({ success: true, data: { bookings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/care/arrived */
router.patch('/:id/care/arrived', protect, authorize('care assistant'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.careAssistant) booking.careAssistant = {};
    booking.careAssistant.arrivedAt = new Date();
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Care Assistant Arrived',
      body:      'Your care assistant arrived at pickup.',
      type:      'Care_Assistant_Arriving',
      bookingId: booking._id,
    });

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_arrived', { bookingId: booking._id });

    return res.json({ success: true, message: 'Arrived marked' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/care/start */
router.patch('/:id/care/start', protect, authorize('care assistant'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.careAssistant) booking.careAssistant = {};
    booking.careAssistant.taskStartedAt = new Date();
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Care Task Started',
      body:      'Care assistant started the task.',
      type:      'Care_Task_Started',
      bookingId: booking._id,
    });

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'care_started', timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Task started' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/care/complete */
router.patch('/:id/care/complete', protect, authorize('care assistant'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.careAssistant) booking.careAssistant = {};
    booking.careAssistant.taskCompletedAt = new Date();
    booking.careAssistant.isPaid          = false;
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Care Task Completed',
      body:      'Care assistant completed the task.',
      type:      'Care_Task_Completed',
      bookingId: booking._id,
    });

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_completed', { bookingId: booking._id });

    return res.json({ success: true, message: 'Task completed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/care/location */
router.patch('/care/location', protect, authorize('care assistant'), async (req, res) => {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// HOSPITAL ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/** GET /bookings/hospital/upcoming */
router.get('/hospital/upcoming', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const bookings = await Booking.find({
      'consultation.hospital': hospital._id,
      status: { $in: ['confirmed','assigned','in_progress'] },
    })
      .select('bookingNumber patientName scheduledAt consultation status transport')
      .sort({ scheduledAt: 1 })
      .populate('consultation.doctor', 'user specialization')
      .lean();

    return res.json({ success: true, data: { bookings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /bookings/:id/hospital/confirm */
router.patch('/:id/hospital/confirm', protect, authorize('hospital'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id); // FIX: removed .lean() — need save()
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.timeline.push({
      status:    booking.status,
      note:      'Hospital confirmed appointment slot',
      actorType: 'admin',
    });
    await booking.save(); // FIX: was missing await

    const customer = await User.findById(booking.customer).select('phone name').lean();
    try {
      await sendSms({
        to:      customer.phone,
        message: appointmentConfirmedSms({
          userName:    customer.name,
          appointmentId: booking.bookingNumber,
          doctorName:  'Your Doctor',
          scheduledAt: new Date(booking.scheduledAt).toLocaleString('en-IN'),
          mode:        booking.consultation?.consultationType || 'in_person',
        }),
      });
    } catch (e) { console.error('[Hospital confirm] SMS:', e.message); }

    return res.json({ success: true, message: 'Appointment slot confirmed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/** GET /admin/bookings */
router.get('/admin/bookings', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { status, serviceType, city, date, page = 1, limit = 20, search, from, to } = req.query;
    const filter = {};
    if (status)      filter.status      = status;
    if (serviceType) filter.serviceType = serviceType;
    if (city)        filter['transport.pickupAddress.city'] = { $regex: city, $options: 'i' };
    if (date)        filter.scheduledDate = date;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }
    if (search) {
      filter.$or = [
        { bookingNumber: { $regex: search, $options: 'i' } },
        { patientName:   { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('customer', 'name phone email')
        .populate('transport.driver', 'legalName driverCode')
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
});

/** GET /admin/bookings/stats */
router.get('/admin/bookings/stats', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter   = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const matchStage = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const [statusStats, serviceStats, revenueAgg] = await Promise.all([
      Booking.aggregate([{ $match: matchStage }, { $group: { _id: '$status',      count: { $sum: 1 } } }]),
      Booking.aggregate([{ $match: matchStage }, { $group: { _id: '$serviceType', count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { ...matchStage, status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$billing.netAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        byStatus:  Object.fromEntries(statusStats.map(s => [s._id, s.count])),
        byService: Object.fromEntries(serviceStats.map(s => [s._id, s.count])),
        revenue:   revenueAgg[0] || { totalRevenue: 0, count: 0 },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /admin/bookings/export — CSV */
router.get('/admin/bookings/export', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { from, to, status, serviceType } = req.query;
    const filter = {};
    if (status)      filter.status      = status;
    if (serviceType) filter.serviceType = serviceType;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }

    const bookings = await Booking.find(filter)
      .select('bookingNumber serviceType status scheduledAt patientName billing.netAmount billing.grossAmount payment.status bookingSource createdAt')
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const csvHeader = 'Booking#,Service,Status,Scheduled,Patient,Customer,Phone,Gross(INR),Net(INR),Payment,Source,CreatedAt\n';
    const csvRows   = bookings.map(b =>
      [
        b.bookingNumber,
        b.serviceType,
        b.status,
        new Date(b.scheduledAt).toLocaleString('en-IN'),
        b.patientName,
        b.customer?.name,
        b.customer?.phone,
        b.billing?.grossAmount,
        b.billing?.netAmount,
        b.payment?.status,
        b.bookingSource,
        new Date(b.createdAt).toLocaleString('en-IN'),
      ].join(',')
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings-export-${Date.now()}.csv`);
    return res.send(csvHeader + csvRows.join('\n'));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /admin/bookings/:id */
router.get('/admin/bookings/:id', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name phone email avatar referralCode')
      .populate('transport.driver')
      .populate('careAssistant.careAssistant')
      .populate('consultation.doctor')
      .populate('consultation.hospital')
      .populate('diagnostic.labPartner')
      .populate('timeline.actor', 'name role')
      .lean();

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Fetch OP record
    let opRecord = null;
    if (booking.consultation?.opId) {
      opRecord = await OutPatientRecord.findById(booking.consultation.opId).lean();
    }

    return res.json({ success: true, data: { booking, opRecord } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /admin/bookings/:id/status */
router.patch('/admin/bookings/:id/status', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = status;
    booking.timeline.push({ status, note, actorType: 'admin', actor: req.user._id });
    await booking.save();

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status, timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Status updated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY LOOKUP ROUTES (100 km radius)
// ─────────────────────────────────────────────────────────────────────────────

const RADIUS_METERS = 100_000;

/** GET /admin/bookings/:id/nearby/solo-drivers */
router.get('/admin/bookings/:id/nearby/solo-drivers', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select('transport.pickupAddress').lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const coords = booking.transport?.pickupAddress?.coordinates;
    if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });

    const [lng, lat] = coords;

    const nearbyDrivers = await Driver.find({
      soloPartner: { $ne: null },
      isActive:    true,
      isVerified:  true,
      isBlocked:   false,
      status:      'Available',
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: RADIUS_METERS,
        },
      },
    })
      .populate('soloPartner', 'legalName phone vehicle serviceZones partnershipStatus isOnboardingComplete rating')
      .select('legalName driverCode location performance.rating assignedVehicleSnapshot')
      .limit(20)
      .lean();

    const results = nearbyDrivers
      .filter(d => d.soloPartner?.partnershipStatus === 'active' && d.soloPartner?.isOnboardingComplete)
      .map(d => ({
        driverId:          d._id,
        soloPartnerId:     d.soloPartner?._id,
        name:              d.soloPartner?.legalName || d.legalName,
        driverCode:        d.driverCode,
        phone:             d.soloPartner?.phone,
        vehicle:           d.assignedVehicleSnapshot,
        rating:            d.performance?.rating,
        distanceKm:        haversineKm(coords, d.location?.coordinates || [0,0]).toFixed(1),
        maxServiceRadiusKm: d.soloPartner?.serviceZones?.[0]?.radiusKm || 15,
        isDispatchReady:   true,
      }));

    return res.json({ success: true, data: { results, total: results.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /admin/bookings/:id/nearby/transport-partners */
router.get('/admin/bookings/:id/nearby/transport-partners', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select('transport.pickupAddress').lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const coords = booking.transport?.pickupAddress?.coordinates;
    if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });

    const [lng, lat] = coords;
    const city       = booking.transport?.pickupAddress?.city;

    const tps = await TransportPartner.find({
      partnershipStatus: 'active',
      isAvailable:       true,
      $or: [
        { 'serviceZones.city':    { $regex: city, $options: 'i' } },
        { 'serviceZones.pinCodes': booking.transport?.pickupAddress?.pinCode },
      ],
    })
      .select('businessName ownerName ownerPhone fleetInfo rating stats serviceZones vehicles partnershipStatus isOnboardingComplete')
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
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: RADIUS_METERS,
            },
          },
        });

        return {
          tpId:                 tp._id,
          businessName:         tp.businessName,
          ownerName:            tp.ownerName,
          ownerPhone:           tp.ownerPhone,
          totalVehicles:        tp.fleetInfo?.totalVehicles || 0,
          activeVehicles:       tp.fleetInfo?.activeVehicles || 0,
          totalDrivers:         tp.fleetInfo?.totalDrivers || 0,
          availableDriversNearby: availDriverCount,
          averageRating:        tp.rating?.averageRating || 0,
          serviceZones:         tp.serviceZones?.map(z => `${z.city}, ${z.state}`),
          isDispatchReady:      tp.isOnboardingComplete && availDriverCount > 0,
        };
      })
    );

    return res.json({ success: true, data: { results: results.filter(r => r.isDispatchReady), total: results.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /admin/bookings/:id/nearby/care-assistants */
router.get('/admin/bookings/:id/nearby/care-assistants', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select('transport.pickupAddress scheduledAt').lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const coords = booking.transport?.pickupAddress?.coordinates;
    if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });

    const [lng, lat] = coords;

    const careAssistants = await CareAssistantProfile.find({
      isActive: true,
      isBlocked: false,
      status:   'Available',
      'kyc.verificationStatus':    'Verified',
      'verification.isVerified':   true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: RADIUS_METERS,
        },
      },
    })
      .select('fullName phone specializations performance maxServiceRadiusKm availability location workType')
      .limit(20)
      .lean();

    const results = careAssistants
      .map(ca => {
        const distKm = haversineKm(coords, ca.location?.coordinates || [0,0]);
        if (distKm > (ca.maxServiceRadiusKm || 10)) return null;
        return {
          careAssistantId:   ca._id,
          name:              ca.fullName,
          phone:             ca.phone,
          specializations:   ca.specializations,
          rating:            ca.performance?.averageRating,
          distanceKm:        distKm.toFixed(1),
          maxServiceRadiusKm: ca.maxServiceRadiusKm,
          workType:          ca.workType,
          currentCity:       ca.availability?.currentCity,
          isDispatchable:    true,
        };
      })
      .filter(Boolean);

    return res.json({ success: true, data: { results, total: results.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /admin/bookings/:id/nearby/hospitals */
router.get('/admin/bookings/:id/nearby/hospitals', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select('transport.pickupAddress').lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const coords = booking.transport?.pickupAddress?.coordinates;
    if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });

    const [lng, lat] = coords;

    const hospitals = await Hospital.find({
      isActive:   true,
      isVerified: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: RADIUS_METERS,
        },
      },
    })
      .select('name hospitalType managementModel address contact specialties is24x7 rating operatingHours isEmergencyReady')
      .limit(20)
      .lean();

    const results = hospitals.map(h => ({
      hospitalId:       h._id,
      name:             h.name,
      hospitalType:     h.hospitalType,
      managementModel:  h.managementModel,
      address:          `${h.address?.line1}, ${h.address?.city}`,
      phone:            h.contact?.phone,
      specialties:      h.specialties,
      is24x7:           h.is24x7,
      isEmergencyReady: h.isEmergencyReady,
      distanceKm:       haversineKm(coords, h.location?.coordinates || [0,0]).toFixed(1),
      averageRating:    h.rating?.averageRating,
      isOperational:    true,
    }));

    return res.json({ success: true, data: { results, total: results.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ASSIGNMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/** POST /admin/bookings/:id/assign/solo-driver */
router.post('/admin/bookings/:id/assign/solo-driver', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { soloDriverPartnerId } = req.body;
    if (!soloDriverPartnerId) return res.status(400).json({ success: false, message: 'soloDriverPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['pending','confirmed'].includes(booking.status))
      return res.status(400).json({ success: false, message: `Cannot assign in status: ${booking.status}` });

    const soloPartner = await SoloDriverPartner.findById(soloDriverPartnerId)
      .populate('user', 'name phone email')
      .lean();
    if (!soloPartner)                     return res.status(404).json({ success: false, message: 'SoloDriverPartner not found' });
    if (soloPartner.partnershipStatus !== 'active') return res.status(400).json({ success: false, message: 'Solo partner not active' });
    if (!soloPartner.driverProfile)       return res.status(400).json({ success: false, message: 'Solo partner has no Driver profile' });

    const driver = await Driver.findById(soloPartner.driverProfile).lean();
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found' });

    const ride = await Ride.create({
      booking:     booking._id,
      legSequence: 1,
      legType:     'Pickup-to-Hospital',
      customer:    booking.customer,
      driver:      soloPartner.user._id,
      // No transportPartner for solo — FIX: schema vehicle not required
      pickupLocation: {
        address:     `${booking.transport?.pickupAddress?.street||''}, ${booking.transport?.pickupAddress?.city||''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.pickupAddress?.coordinates || [0,0] },
      },
      dropLocation: {
        address:     `${booking.transport?.dropAddress?.street||''}, ${booking.transport?.dropAddress?.city||''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.dropAddress?.coordinates || [0,0] },
      },
      status:   'Assigned',
      startOTP: genOtp(),
      endOTP:   genOtp(),
    });

    booking.status = 'assigned';
    if (booking.transport) {
      booking.transport.driver = driver._id;
      booking.transport.vehicleSnapshot = {
        registrationNumber: soloPartner.vehicle?.registrationNumber,
        make:               soloPartner.vehicle?.make,
        model:              soloPartner.vehicle?.model,
        vehicleType:        soloPartner.vehicle?.vehicleType,
        color:              soloPartner.vehicle?.color,
      };
    }
    await booking.save();

    await createNotification({
      recipient: soloPartner.user._id,
      title:     'New Booking Assigned',
      body:      `Admin assigned booking #${booking.bookingNumber} to you.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

    try {
      await sendSms({
        to:      soloPartner.user.phone,
        message: `Hi ${soloPartner.user.name}, new ride by admin: Booking #${booking.bookingNumber}. Accept from Likeson app.`,
      });
    } catch (e) { console.error('[Admin assign solo] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
      bookingId: booking._id, status: 'assigned', timestamp: new Date(),
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message:  `Admin assigned solo driver to #${booking.bookingNumber}`,
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { soloDriverPartnerId, bookingNumber: booking.bookingNumber },
    });

    return res.status(200).json({ success: true, message: 'Solo driver assigned', data: { booking, ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /admin/bookings/:id/assign/transport-partner */
router.post('/admin/bookings/:id/assign/transport-partner', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { transportPartnerId } = req.body;
    if (!transportPartnerId) return res.status(400).json({ success: false, message: 'transportPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const tp = await TransportPartner.findById(transportPartnerId)
      .populate('user', 'name email phone')
      .lean();
    if (!tp)                         return res.status(404).json({ success: false, message: 'TransportPartner not found' });
    if (tp.partnershipStatus !== 'active') return res.status(400).json({ success: false, message: 'TP not active' });

    // FIX: assignedTP on booking root (not booking.transport)
    booking.assignedTP = transportPartnerId;
    booking.status     = 'assigned';
    await booking.save();

    await createNotification({
      recipient: tp.user._id,
      title:     'New Booking Assigned to Fleet',
      body:      `Booking #${booking.bookingNumber} assigned. Please assign a driver.`,
      type:      'Ride_Request',
      bookingId: booking._id,
      priority:  'High',
    });

    try {
      await sendEmail({
        email:   tp.user.email,
        subject: `New Booking #${booking.bookingNumber} — Assign Driver`,
        html: transactionalTemplate({
          header:     'BOOKING ASSIGNED TO YOUR FLEET',
          title:      `Booking #${booking.bookingNumber} needs a driver`,
          body: `
            <b>Service:</b> ${booking.serviceType}<br/>
            <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
            <b>Patient:</b> ${booking.patientName}<br/>
          `,
          buttonLink: `${process.env.FRONTEND_URL}/tp/bookings/${booking._id}`,
          buttonText: 'Assign Driver Now',
        }),
      });
    } catch (e) { console.error('[Admin assign TP] Email:', e.message); }

    try {
      await sendSms({
        to:      tp.user.phone,
        message: `Hi ${tp.user.name}, booking #${booking.bookingNumber} assigned. Assign driver in your Likeson dashboard.`,
      });
    } catch (e) { console.error('[Admin assign TP] SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`tp:${tp._id}`, 'booking_assigned', {
      bookingId:     booking._id,
      bookingNumber: booking.bookingNumber,
      serviceType:   booking.serviceType,
      scheduledAt:   booking.scheduledAt,
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message:  `Admin assigned TP to #${booking.bookingNumber}`,
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { transportPartnerId, bookingNumber: booking.bookingNumber },
    });

    return res.json({ success: true, message: 'TP assigned. Waiting for driver assignment.', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /admin/bookings/:id/assign/care-assistant */
router.post('/admin/bookings/:id/assign/care-assistant', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { careAssistantId } = req.body;
    if (!careAssistantId) return res.status(400).json({ success: false, message: 'careAssistantId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const ca = await CareAssistantProfile.findById(careAssistantId)
      .populate('user', 'name phone email')
      .lean();
    if (!ca) return res.status(404).json({ success: false, message: 'Care assistant not found' });

    // FIX: original check was wrong — use isActive + verification
    if (!ca.isActive || !ca.verification?.isVerified)
      return res.status(400).json({ success: false, message: 'Care assistant not available' });

    booking.careAssistant = { careAssistant: careAssistantId, assignedAt: new Date() };
    await booking.save();

    await createNotification({
      recipient: ca.user._id,
      title:     'New Care Request',
      body:      `Assigned to booking #${booking.bookingNumber}`,
      type:      'Care_Assistant_Assigned',
      bookingId: booking._id,
      priority:  'High',
    });

    try {
      await sendSms({
        to:      ca.user.phone,
        message: newCareRequestToAssistantSms({
          assistantName: ca.fullName,
          requestId:     booking.bookingNumber,
          patientName:   booking.patientName,
          location:      `${booking.transport?.pickupAddress?.street||''}, ${booking.transport?.pickupAddress?.city||''}`,
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
          requestId:      booking.bookingNumber,
          assistantName:  ca.fullName,
          assistantPhone: ca.phone,
        }),
      });
    } catch (e) { console.error('[Admin assign CA] Customer SMS:', e.message); }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_assigned', {
      bookingId:        booking._id,
      careAssistantName: ca.fullName,
    });

    await SystemLog.createLog({
      level: 'success', category: 'api',
      message:  `Admin assigned care assistant to #${booking.bookingNumber}`,
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'Booking', entityId: booking._id },
      metadata: { careAssistantId },
    });

    return res.json({ success: true, message: 'Care assistant assigned', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /admin/bookings/:id/assign/hospital */
router.post('/admin/bookings/:id/assign/hospital', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { hospitalId } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const hospital = await Hospital.findById(hospitalId).select('name isActive isVerified').lean();
    if (!hospital?.isActive || !hospital?.isVerified)
      return res.status(400).json({ success: false, message: 'Hospital not operational' });

    if (booking.consultation) {
      booking.consultation.hospital = hospitalId;
    }
    await booking.save();

    return res.json({ success: true, message: 'Hospital linked', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /admin/bookings/:id/reassign/driver */
router.patch('/admin/bookings/:id/reassign/driver', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { newDriverUserId, reason } = req.body;

    await Ride.findOneAndUpdate(
      { booking: req.params.id, status: { $in: ['Assigned','Accepted','En-Route'] } },
      { status: 'Cancelled' }
    );

    const booking = await Booking.findById(req.params.id);
    const driver  = await Driver.findOne({ user: newDriverUserId }).lean();
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const ride = await Ride.create({
      booking:     booking._id,
      legSequence: 1,
      legType:     'Pickup-to-Hospital',
      customer:    booking.customer,
      driver:      newDriverUserId,
      pickupLocation: {
        address:     `${booking.transport?.pickupAddress?.street||''}, ${booking.transport?.pickupAddress?.city||''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.pickupAddress?.coordinates || [0,0] },
      },
      dropLocation: {
        address:     `${booking.transport?.dropAddress?.street||''}, ${booking.transport?.dropAddress?.city||''}`,
        coordinates: { type: 'Point', coordinates: booking.transport?.dropAddress?.coordinates || [0,0] },
      },
      status:   'Assigned',
      startOTP: genOtp(),
      endOTP:   genOtp(),
    });

    if (booking.transport) booking.transport.driver = driver._id;
    booking.timeline.push({
      status:    booking.status,
      note:      `Driver reassigned by admin. Reason: ${reason || 'N/A'}`,
      actorType: 'admin',
      actor:     req.user._id,
    });
    await booking.save();

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_assigned', { bookingId: booking._id });

    return res.json({ success: true, message: 'Driver reassigned', data: { ride } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /admin/bookings/:id/reassign/care */
router.patch('/admin/bookings/:id/reassign/care', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { newCareAssistantId } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.careAssistant) booking.careAssistant = {};
    booking.careAssistant.careAssistant  = newCareAssistantId;
    booking.careAssistant.assignedAt     = new Date();
    booking.careAssistant.arrivedAt      = null;
    booking.careAssistant.taskStartedAt  = null;  // FIX: was missing
    booking.careAssistant.taskCompletedAt = null;
    await booking.save();

    const ca = await CareAssistantProfile.findById(newCareAssistantId)
      .populate('user', 'phone name')
      .lean();

    await createNotification({
      recipient: ca.user._id,
      title:     'Care Booking Assigned',
      body:      `Booking #${booking.bookingNumber} reassigned to you.`,
      type:      'Care_Assistant_Assigned',
      bookingId: booking._id,
    });

    return res.json({ success: true, message: 'Care assistant reassigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /admin/bookings/:id/refund */
router.post('/admin/bookings/:id/refund', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { refundAmount, reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Razorpay refund if payment was via gateway
    if (booking.payment.gatewayPaymentId && refundAmount > 0) {
      try {
        await razorpay.payments.refund(booking.payment.gatewayPaymentId, {
          amount: Math.round(refundAmount * 100),
          notes:  { reason: reason || 'Admin initiated refund', bookingNumber: booking.bookingNumber },
        });
      } catch (rzpErr) {
        console.error('[Refund] Razorpay refund failed:', rzpErr.message);
        // Continue — mark refund pending manually
      }
    }

    booking.payment.status = 'refunded';
    booking.cancellation = {
      ...booking.cancellation?.toObject?.() || {},
      refundAmount:  refundAmount || booking.billing.netAmount,
      refundStatus:  'processed',
      refundedAt:    new Date(),
    };
    booking.status = 'refunded';
    await booking.save();

    await createNotification({
      recipient: booking.customer,
      title:     'Refund Processed',
      body:      `Refund of ₹${refundAmount} for booking #${booking.bookingNumber} processed.`,
      type:      'Refund_Processed',
      bookingId: booking._id,
    });

    return res.json({ success: true, message: 'Refund initiated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — OP MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** GET /admin/ops — list all OP records */
router.get('/admin/ops', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { doctorId, hospitalId, date, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (doctorId)   filter.doctor   = doctorId;
    if (hospitalId) filter.hospital = hospitalId;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.scheduledAt = { $gte: d, $lt: nextDay };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [ops, total] = await Promise.all([
      OutPatientRecord.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('doctor', 'user specialization')
        .populate('hospital', 'name address')
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
});

/** PATCH /admin/ops/:id/status — update OP status */
router.patch('/admin/ops/:id/status', protect, authorize('admin','superadmin'), async (req, res) => {
  try {
    const { status, doctorNotes } = req.body;
    const validStatuses = ['scheduled','in_progress','completed','cancelled','no_show'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` });

    const op = await OutPatientRecord.findByIdAndUpdate(
      req.params.id,
      { status, ...(doctorNotes ? { doctorNotes } : {}), ...(status === 'completed' ? { completedAt: new Date() } : {}) },
      { new: true }
    );
    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

    return res.json({ success: true, message: 'OP status updated', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;