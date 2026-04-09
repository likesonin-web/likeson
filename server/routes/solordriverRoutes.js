/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOLO DRIVER PARTNER ROUTER — Likeson.in
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Self-contained router for SoloDriverPartner operations.
 * All logic lives here — no separate controller/service files.
 *
 * SECTIONS
 *  §0   Imports & Bootstrap
 *  §1   Internal Logger
 *  §2   Input Validation Helpers
 *  §3   Async Wrapper
 *  §4   Solo-Partner Middleware (attach + guard)
 *  §5   Cache Key Builders
 *  §6   Audit Helper
 *  §7   Profile Routes          (own profile, settings, notifications)
 *  §8   KYC Routes              (submit, re-submit, status)
 *  §9   Vehicle Routes          (details, update, documents)
 *  §10  Bank & Settlement Routes
 *  §11  Availability & Location Routes
 *  §12  Service Zones & Pricing Routes
 *  §13  Stats & Rating Routes
 *  §14  Documents & Compliance Routes
 *  §15  Security Routes         (sessions, devices, account actions)
 *  §16  Admin Routes            (list, detail, verify, block, assign driver)
 *  §17  Export
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── §0  Imports & Bootstrap ───────────────────────────────────────────────────

import express              from 'express';
import mongoose             from 'mongoose';
import bcrypt               from 'bcryptjs';

import { protect, authorize }           from '../middleware/authMiddleware.js';
import SoloDriverPartner                from '../models/SoloDriverPartner.js';
import Driver                           from '../models/Driver.js';
import User                             from '../models/User.js';
import Notification                     from '../models/Notification.js';
import SystemLog                        from '../models/SystemLog.js';
import Wallet                           from '../models/Wallet.js';
import cache                            from '../middleware/cache.js';
import { invalidateKey, invalidatePattern } from '../utils/cacheInvalidation.js';
import sendEmail                        from '../utils/sendEmail.js';
import { transactionalTemplate }        from '../utils/emailTemplates.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js'
const router = express.Router();

// ── §1  Internal Logger ───────────────────────────────────────────────────────

const log = {
  info:  (...a) => console.log ('[SoloDriver]', ...a),
  warn:  (...a) => console.warn ('[SoloDriver]', ...a),
  error: (...a) => console.error('[SoloDriver]', ...a),
};

// ── §2  Input Validation Helpers ──────────────────────────────────────────────

/** Validate Indian mobile number (10-digit, starting with 6-9) */
const isValidPhone = (p) => /^[6-9]\d{9}$/.test(String(p || '').replace(/\D/g, '').slice(-10));

/** Validate IFSC code */
const isValidIFSC = (c) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(c || '').toUpperCase());

/** Validate PAN number */
const isValidPAN = (p) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(p || '').toUpperCase());

/** Validate Aadhaar (12 digits) */
const isValidAadhaar = (a) => /^\d{12}$/.test(String(a || ''));

/** Validate driving licence (basic format) */
const isValidDL = (dl) => /^[A-Z]{2}\d{2}\s?\d{4}\d{7}$/.test(String(dl || '').replace(/ /g, '').toUpperCase()) || String(dl || '').length >= 10;

/** Validate vehicle registration number (Indian format) */
const isValidRegNum = (r) => /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(String(r || '').replace(/\s/g, '').toUpperCase()) || String(r || '').length >= 6;

/** Strip unknown fields — only allow listed keys */
const pick = (obj, keys) =>
  keys.reduce((acc, k) => { if (k in obj) acc[k] = obj[k]; return acc; }, {});

/** Build pagination params from query */
const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  return { page, limit, skip: (page - 1) * limit };
};

/** Build a standard paginated response envelope */
const paginate = (data, total, page, limit) => ({
  success: true,
  data,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext:    page * limit < total,
    hasPrev:    page > 1,
  },
});

// ── §3  Async Wrapper ─────────────────────────────────────────────────────────

/**
 * Wraps an async route handler so unhandled promise rejections are forwarded
 * to Express's error handler via next(err), preventing server crashes.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    log.error(err.message, { stack: err.stack });
    next(err);
  });
};

// ── §4  Solo-Partner Middleware ───────────────────────────────────────────────

/**
 * attachSoloPartner
 *
 * Loads the SoloDriverPartner document for the authenticated user and attaches
 * it to req.soloPartner. Suspended partners are blocked from mutating their data.
 * 
 * Callers: all solodriverpartner-scoped routes.
 */
const attachSoloPartner = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (req.user.role !== 'solodriverpartner') {
    return res.status(403).json({
      success:  false,
      message:  'Solo driver-partner role required',
      userRole: req.user.role,
    });
  }

  const partner = await SoloDriverPartner.findOne({ user: req.user._id }).lean(false);

  if (!partner) {
    return res.status(404).json({
      success: false,
      message: 'Solo driver-partner profile not found. Please complete onboarding or contact support.',
    });
  }

  if (partner.partnershipStatus === 'suspended') {
    return res.status(403).json({
      success:         false,
      message:         'Your partner account has been suspended. Please contact support.',
      rejectionReason: partner.rejectionReason,
    });
  }

  req.soloPartner = partner;
  next();
});

/** Guard: partner must be in 'active' status to access certain operational routes */
const requireActive = (req, res, next) => {
  const s = req.soloPartner?.partnershipStatus;
  if (s !== 'active') {
    return res.status(403).json({
      success: false,
      message: `Partner account is not active (current status: ${s}). Please complete onboarding and verification.`,
    });
  }
  next();
};

/** Guard: KYC must be verified before accessing compliance-gated routes */
const requireKyc = (req, res, next) => {
  if (!req.soloPartner?.kyc?.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'KYC verification is required before accessing this feature.',
      kycStatus: req.soloPartner?.kyc?.verificationStatus,
    });
  }
  next();
};

/** Convenience stack — every partner route starts with these three */
const partnerGuard = [protect, authorize('solodriverpartner'), attachSoloPartner];

/** Admin and superadmin guard */
const adminGuard = [protect, authorize('admin', 'superadmin')];

// ── §5  Cache Key Builders ────────────────────────────────────────────────────

const CK = {
  profile:  (id) => `sdp:${id}:profile`,
  list:     (q)  => `sdp:list:${JSON.stringify(q)}`,
  stats:    (id) => `sdp:${id}:stats`,
  zones:    (id) => `sdp:${id}:zones`,
  vehicle:  (id) => `sdp:${id}:vehicle`,
  kyc:      (id) => `sdp:${id}:kyc`,
  bankDetails: (id) => `sdp:${id}:bank`,
};

const invalidateSdpCache = async (partnerId) => {
  await invalidatePattern(`sdp:${partnerId}:*`);
  await invalidatePattern('sdp:list:*');
};

// ── §6  Audit Helper ──────────────────────────────────────────────────────────

/**
 * createAuditLog — non-blocking fire-and-forget wrapper around SystemLog.createLog.
 * Route handlers call this without awaiting, so audit failures never stall responses.
 */
const createAuditLog = (payload) => {
  SystemLog.createLog(payload).catch((err) =>
    log.error('[AuditLog] Failed to persist:', err.message)
  );
};

/**
 * buildActor — extract actor metadata from req for audit logs
 */
const buildActor = (req) => ({
  userId:    req.user?._id,
  name:      req.user?.name,
  email:     req.user?.email,
  role:      req.user?.role,
  ip:        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown',
  userAgent: req.headers['user-agent'] || null,
  platform:  req.deviceInfo?.platform || 'unknown',
});

// ── §7  Profile Routes ────────────────────────────────────────────────────────
// GET    /api/solo-driver/me              → own profile
// PATCH  /api/solo-driver/me              → update basic details
// PATCH  /api/solo-driver/me/contact      → update contact info
// PATCH  /api/solo-driver/me/address      → update address
// PATCH  /api/solo-driver/me/professional → update professional info
// PATCH  /api/solo-driver/me/emergency    → update emergency contact
// GET    /api/solo-driver/me/settings     → notification prefs
// PATCH  /api/solo-driver/me/settings     → update notification prefs
// DELETE /api/solo-driver/me              → request account deletion

/** GET /me — own full profile */
router.get(
  '/me',
  ...partnerGuard,
  cache(60, (req) => CK.profile(req.soloPartner._id)),
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .populate('user', 'name email phone avatar role referralCode coins isEmailVerified isPhoneVerified')
      .populate('driverProfile', 'status isActive isVerified performance.rating rewards.tier location')
      .lean();

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Mask sensitive fields before sending
    if (partner.kyc?.aadhaarNumber) delete partner.kyc.aadhaarNumber;
    if (partner.bankDetails?.accountNumber) {
      partner.bankDetails.maskedAccount = `XXXX${partner.bankDetails.accountLast4 || ''}`;
      delete partner.bankDetails.accountNumber;
    }
    if (partner.panNumber) delete partner.panNumber;

    res.json({ success: true, data: partner });
  })
);

/** PATCH /me — update basic personal details */
router.patch(
  '/me',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const allowed = ['displayName', 'dateOfBirth', 'gender', 'bio', 'languagesSpoken', 'yearsOfExperience', 'hasMedicalTransportExp', 'hasAmbulanceExp', 'profilePhotoUrl'];
    const updates = pick(req.body, allowed);

    if (updates.bio && updates.bio.length > 500) {
      return res.status(422).json({ success: false, message: 'Bio must be 500 characters or less' });
    }
    if (updates.yearsOfExperience !== undefined) {
      const y = Number(updates.yearsOfExperience);
      if (isNaN(y) || y < 0 || y > 60) {
        return res.status(422).json({ success: false, message: 'Years of experience must be between 0 and 60' });
      }
      updates.yearsOfExperience = y;
    }

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { ...updates, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);

    createAuditLog({
      level: 'info', category: 'user',
      message: 'Solo partner updated basic profile',
      actor: buildActor(req),
      relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
    });

    res.json({ success: true, message: 'Profile updated', data: partner });
  })
);

/** PATCH /me/contact — update contact numbers and WhatsApp */
router.patch(
  '/me/contact',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { phone, altPhone, whatsappNumber, email } = req.body;

    if (phone && !isValidPhone(phone)) {
      return res.status(422).json({ success: false, message: 'Invalid primary phone number' });
    }
    if (altPhone && !isValidPhone(altPhone)) {
      return res.status(422).json({ success: false, message: 'Invalid alternate phone number' });
    }

    const updates = {};
    if (phone)          updates.phone          = phone.replace(/\D/g, '').slice(-10);
    if (altPhone)       updates.altPhone       = altPhone;
    if (whatsappNumber) updates.whatsappNumber = whatsappNumber;
    if (email)          updates.email          = email.toLowerCase().trim();

    updates.updatedBy = req.user._id;

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Contact info updated', data: { phone: partner.phone, altPhone: partner.altPhone, whatsappNumber: partner.whatsappNumber } });
  })
);

/** PATCH /me/address — update residential address */
router.patch(
  '/me/address',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const allowed = ['street', 'city', 'state', 'pinCode', 'country'];
    const address = pick(req.body, allowed);

    if (!address.city || !address.state) {
      return res.status(422).json({ success: false, message: 'City and state are required' });
    }

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { address, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Address updated', data: partner.address });
  })
);

/** PATCH /me/professional — update professional qualifications */
router.patch(
  '/me/professional',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const allowed = ['languagesSpoken', 'hasMedicalTransportExp', 'hasAmbulanceExp', 'yearsOfExperience'];
    const updates = pick(req.body, allowed);

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { ...updates, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Professional info updated', data: pick(partner, allowed) });
  })
);

/** POST /me/training-certificates — add a training certificate */
router.post(
  '/me/training-certificates',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { name, issuedBy, issuedAt, expiresAt, documentUrl } = req.body;
    if (!name) {
      return res.status(422).json({ success: false, message: 'Certificate name is required' });
    }

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      {
        $push: {
          trainingCertificates: { name, issuedBy, issuedAt, expiresAt, documentUrl },
        },
        $set: { updatedBy: req.user._id },
      },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);

    res.status(201).json({ success: true, message: 'Certificate added', data: partner.trainingCertificates });
  })
);

/** DELETE /me/training-certificates/:certId — remove a training certificate */
router.delete(
  '/me/training-certificates/:certId',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { certId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(certId)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate ID' });
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $pull: { trainingCertificates: { _id: new mongoose.Types.ObjectId(certId) } } }
    );

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Certificate removed' });
  })
);

/** PATCH /me/emergency — update emergency contact */
router.patch(
  '/me/emergency',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { name, relationship, phone } = req.body;
    if (!name || !phone) {
      return res.status(422).json({ success: false, message: 'Emergency contact name and phone are required' });
    }
    if (!isValidPhone(phone)) {
      return res.status(422).json({ success: false, message: 'Invalid emergency contact phone number' });
    }

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { emergencyContact: { name, relationship, phone }, updatedBy: req.user._id } },
      { new: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Emergency contact updated', data: partner.emergencyContact });
  })
);

/** GET /me/settings — get notification preferences */
router.get(
  '/me/settings',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('notifications settlementCycle availabilityHours')
      .lean();

    res.json({ success: true, data: partner });
  })
);

/** PATCH /me/settings — update notification preferences */
router.patch(
  '/me/settings',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const allowed = ['sms', 'email', 'push', 'whatsapp'];
    const prefs   = pick(req.body.notifications || {}, allowed);
    const updates = { updatedBy: req.user._id };

    if (Object.keys(prefs).length) updates['notifications'] = prefs;

    if (req.body.settlementCycle) {
      const valid = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];
      if (!valid.includes(req.body.settlementCycle)) {
        return res.status(422).json({ success: false, message: `settlementCycle must be one of: ${valid.join(', ')}` });
      }
      updates.settlementCycle = req.body.settlementCycle;
    }

    if (req.body.availabilityHours) {
      updates.availabilityHours = pick(req.body.availabilityHours, ['start', 'end']);
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: updates }
    );

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Settings updated' });
  })
);

/** DELETE /me — request account deletion (soft deactivation, requires admin action) */
router.delete(
  '/me',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { reason, password } = req.body;
    if (!password) {
      return res.status(422).json({ success: false, message: 'Your password is required to delete your account' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const match = await bcrypt.compare(password, user.password || '');
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Flag for admin review — actual deletion is done by admin
    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      {
        $set: {
          'tags': [...(req.soloPartner.tags || []), 'deletion-requested'],
          'internalNotes': `Deletion requested at ${new Date().toISOString()}. Reason: ${reason || 'Not provided'}`,
          'partnershipStatus': 'suspended',
          updatedBy: req.user._id,
        },
      }
    );

    createAuditLog({
      level: 'warning', category: 'user',
      message: `Solo partner requested account deletion: ${req.user.email}`,
      actor: buildActor(req),
      relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
      metadata: { reason },
    });

    res.json({ success: true, message: 'Account deletion request submitted. Your account will be reviewed within 7 business days.' });
  })
);

// ── §8  KYC Routes ────────────────────────────────────────────────────────────
// GET   /api/solo-driver/kyc         → own KYC status
// POST  /api/solo-driver/kyc         → submit / update KYC
// POST  /api/solo-driver/kyc/medical → submit medical fitness
// POST  /api/solo-driver/kyc/psv     → submit PSV badge details

/** GET /kyc — KYC status and field completeness */
router.get(
  '/kyc',
  ...partnerGuard,
  cache(30, (req) => CK.kyc(req.soloPartner._id)),
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('kyc medicalFitness profileCompletionPercent isOnboardingComplete partnershipStatus')
      .lean();

    // Mask Aadhaar
    if (partner.kyc?.aadhaarNumber) {
      partner.kyc.maskedAadhaar = `XXXX XXXX ${partner.kyc.aadhaarLast4 || ''}`;
      delete partner.kyc.aadhaarNumber;
    }

    res.json({ success: true, data: partner });
  })
);

/** POST /kyc — submit KYC documents */
router.post(
  '/kyc',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const {
      aadhaarNumber,
      aadhaarFrontUrl,
      aadhaarBackUrl,
      drivingLicenceNumber,
      drivingLicenceExpiry,
      drivingLicenceDocUrl,
      licenceClass,
      panNumber,
      panCardUrl,
    } = req.body;

    // Validate required KYC fields
    const errors = [];
    if (aadhaarNumber && !isValidAadhaar(aadhaarNumber)) errors.push('Invalid Aadhaar number (must be 12 digits)');
    if (!drivingLicenceNumber)  errors.push('Driving licence number is required');
    if (!drivingLicenceExpiry)  errors.push('Driving licence expiry date is required');
    if (panNumber && !isValidPAN(panNumber)) errors.push('Invalid PAN format');

    const dlExpiry = new Date(drivingLicenceExpiry);
    if (drivingLicenceExpiry && dlExpiry <= new Date()) {
      errors.push('Driving licence is expired. Please renew before submitting KYC.');
    }

    if (errors.length) {
      return res.status(422).json({ success: false, message: 'Validation failed', errors });
    }

    const kycUpdate = {
      'kyc.aadhaarFrontUrl':        aadhaarFrontUrl,
      'kyc.aadhaarBackUrl':         aadhaarBackUrl,
      'kyc.drivingLicenceNumber':   drivingLicenceNumber?.toUpperCase().trim(),
      'kyc.drivingLicenceExpiry':   dlExpiry,
      'kyc.drivingLicenceDocUrl':   drivingLicenceDocUrl,
      'kyc.licenceClass':           licenceClass || [],
      'kyc.verificationStatus':     'pending',
      'kyc.submittedAt':            new Date(),
    };

    if (aadhaarNumber)  kycUpdate['kyc.aadhaarNumber']  = aadhaarNumber;
    if (aadhaarFrontUrl) kycUpdate['kyc.aadhaarFrontUrl'] = aadhaarFrontUrl;
    if (panNumber)      kycUpdate['kyc.panNumber']       = panNumber.toUpperCase();
    if (panCardUrl)     kycUpdate['kyc.panCardUrl']      = panCardUrl;

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { ...kycUpdate, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    );

    await invalidateSdpCache(req.soloPartner._id);

    // Notify admin
    createAuditLog({
      level: 'info', category: 'kyc',
      message: `Solo partner submitted KYC: ${req.user.email}`,
      actor: buildActor(req),
      relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
    });

    res.json({
      success: true,
      message: 'KYC submitted successfully. Verification will be completed within 24-48 hours.',
      data: { kycStatus: partner.kyc.verificationStatus, submittedAt: partner.kyc.submittedAt },
    });
  })
);

/** POST /kyc/medical — submit medical fitness certificate */
router.post(
  '/kyc/medical',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { certificateNumber, issuedBy, issuedAt, expiryDate, documentUrl, bloodGroup } = req.body;

    if (!expiryDate || new Date(expiryDate) <= new Date()) {
      return res.status(422).json({ success: false, message: 'Medical fitness certificate is required and must not be expired' });
    }

    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
    if (bloodGroup && !validBloodGroups.includes(bloodGroup)) {
      return res.status(422).json({ success: false, message: 'Invalid blood group' });
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      {
        $set: {
          medicalFitness: {
            certificateNumber,
            issuedBy,
            issuedAt:    issuedAt ? new Date(issuedAt) : undefined,
            expiryDate:  new Date(expiryDate),
            documentUrl,
            bloodGroup:  bloodGroup || 'Unknown',
            isValid:     new Date(expiryDate) > new Date(),
          },
          updatedBy: req.user._id,
        },
      }
    );

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Medical fitness certificate submitted' });
  })
);

/** POST /kyc/psv — submit PSV badge details */
router.post(
  '/kyc/psv',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { psvBadgeNumber, psvBadgeExpiry, psvBadgeDocUrl } = req.body;
    if (!psvBadgeNumber) {
      return res.status(422).json({ success: false, message: 'PSV badge number is required' });
    }
    if (!psvBadgeExpiry || new Date(psvBadgeExpiry) <= new Date()) {
      return res.status(422).json({ success: false, message: 'PSV badge is required and must not be expired' });
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      {
        $set: {
          'kyc.psvBadgeNumber':  psvBadgeNumber.toUpperCase().trim(),
          'kyc.psvBadgeExpiry':  new Date(psvBadgeExpiry),
          'kyc.psvBadgeDocUrl':  psvBadgeDocUrl,
          updatedBy:             req.user._id,
        },
      }
    );

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'PSV badge details submitted' });
  })
);

// ── §9  Vehicle Routes ────────────────────────────────────────────────────────
// GET   /api/solo-driver/vehicle                  → own vehicle info
// PUT   /api/solo-driver/vehicle                  → update vehicle details
// PATCH /api/solo-driver/vehicle/documents        → update vehicle documents
// PATCH /api/solo-driver/vehicle/features         → update accessibility features
// PATCH /api/solo-driver/vehicle/location         → update GPS location

/** GET /vehicle — own vehicle info */
router.get(
  '/vehicle',
  ...partnerGuard,
  cache(60, (req) => CK.vehicle(req.soloPartner._id)),
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('vehicle partnerCode')
      .lean();

    res.json({ success: true, data: partner?.vehicle || null });
  })
);

/** PUT /vehicle — update / register own vehicle details */
router.put(
  '/vehicle',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const {
      registrationNumber, make, model, year, color,
      vehicleType, seatingCapacity,
    } = req.body;

    const errors = [];
    if (!registrationNumber || !isValidRegNum(registrationNumber)) errors.push('Valid vehicle registration number is required');
    if (!make)        errors.push('Vehicle make (manufacturer) is required');
    if (!model)       errors.push('Vehicle model is required');
    if (!vehicleType) errors.push('Vehicle type is required');

    const validTypes = ['Sedan', 'SUV', 'Van', 'Minivan', 'Wheelchair-Van', 'Tempo-Traveller', 'Hatchback', 'Auto'];
    if (vehicleType && !validTypes.includes(vehicleType)) {
      errors.push(`Vehicle type must be one of: ${validTypes.join(', ')}`);
    }

    if (errors.length) {
      return res.status(422).json({ success: false, message: 'Validation failed', errors });
    }

    const vehicleUpdate = {
      'vehicle.registrationNumber': registrationNumber.toUpperCase().replace(/\s/g, ''),
      'vehicle.make':               make,
      'vehicle.model':              model,
      'vehicle.year':               year ? Number(year) : undefined,
      'vehicle.color':              color,
      'vehicle.vehicleType':        vehicleType,
      'vehicle.seatingCapacity':    seatingCapacity ? Number(seatingCapacity) : 4,
      'vehicle.verificationStatus': 'pending',
      updatedBy:                    req.user._id,
    };

    // Clean undefined values
    Object.keys(vehicleUpdate).forEach((k) => vehicleUpdate[k] === undefined && delete vehicleUpdate[k]);

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: vehicleUpdate },
      { new: true, runValidators: true }
    );

    await invalidateSdpCache(req.soloPartner._id);

    createAuditLog({
      level: 'info', category: 'user',
      message: `Solo partner updated vehicle: ${registrationNumber}`,
      actor: buildActor(req),
      relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
    });

    res.json({
      success: true,
      message: 'Vehicle details submitted for verification',
      data: partner.vehicle,
    });
  })
);

/** PATCH /vehicle/documents — upload/update vehicle document URLs */
router.patch(
  '/vehicle/documents',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const allowed = [
      'rcBookUrl', 'insurancePolicyUrl', 'insuranceExpiry',
      'pollutionCertUrl', 'pollutionCertExpiry',
      'fitnessCertUrl', 'fitnessCertExpiry',
      'permitType', 'permitExpiry', 'photos',
    ];
    const docs = pick(req.body, allowed);

    if (!Object.keys(docs).length) {
      return res.status(422).json({ success: false, message: 'No document fields provided' });
    }

    const update = {};
    for (const [k, v] of Object.entries(docs)) {
      update[`vehicle.${k}`] = v;
    }
    update.updatedBy = req.user._id;

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: update }
    );

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Vehicle documents updated' });
  })
);

/** PATCH /vehicle/features — update medical/accessibility features */
router.patch(
  '/vehicle/features',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const allowed = ['isWheelchairAccessible', 'hasStretcherSupport', 'hasOxygenSupport', 'hasMedicalKit', 'hasAC'];
    const features = pick(req.body, allowed);

    if (!Object.keys(features).length) {
      return res.status(422).json({ success: false, message: 'No feature fields provided' });
    }

    const update = { updatedBy: req.user._id };
    for (const [k, v] of Object.entries(features)) {
      update[`vehicle.${k}`] = Boolean(v);
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: update }
    );

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Vehicle features updated', data: features });
  })
);

/** PATCH /vehicle/location — update live GPS coordinates */
router.patch(
  '/vehicle/location',
  ...partnerGuard,
  requireActive,
  asyncHandler(async (req, res) => {
    const { lng, lat, gpsDeviceId } = req.body;
    const longitude = parseFloat(lng);
    const latitude  = parseFloat(lat);

    if (isNaN(longitude) || isNaN(latitude)) {
      return res.status(422).json({ success: false, message: 'Valid longitude (lng) and latitude (lat) are required' });
    }
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(422).json({ success: false, message: 'Coordinates out of valid range' });
    }

    const now = new Date();
    const update = {
      'vehicle.lastKnownLocation': { type: 'Point', coordinates: [longitude, latitude] },
      'vehicle.lastLocationUpdatedAt': now,
      updatedBy: req.user._id,
    };
    if (gpsDeviceId) update['vehicle.gpsDeviceId'] = gpsDeviceId;

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, { $set: update });

    // Also sync location on companion Driver document if exists
    if (req.soloPartner.driverProfile) {
      await Driver.findByIdAndUpdate(req.soloPartner.driverProfile, {
        $set: {
          'location.coordinates': [longitude, latitude],
          'location.updatedAt':   now,
        },
      });
    }

    res.json({ success: true, message: 'Location updated', data: { lng: longitude, lat: latitude, updatedAt: now } });
  })
);

// ── §10  Bank & Settlement Routes ─────────────────────────────────────────────
// GET   /api/solo-driver/bank          → get bank details (masked)
// POST  /api/solo-driver/bank          → submit / update bank details
// GET   /api/solo-driver/settlement    → settlement history

/** GET /bank — bank details (masked) */
router.get(
  '/bank',
  ...partnerGuard,
  cache(120, (req) => CK.bankDetails(req.soloPartner._id)),
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('bankDetails settlement')
      .lean();

    // Mask account number
    if (partner.bankDetails?.accountLast4) {
      partner.bankDetails.maskedAccount = `XXXX XXXX XXXX ${partner.bankDetails.accountLast4}`;
    }
    delete partner.bankDetails?.accountNumber;

    res.json({ success: true, data: partner });
  })
);

/** POST /bank — submit / update bank details */
router.post(
  '/bank',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const {
      accountHolderName, accountNumber, ifscCode, bankName, upiId, upiName,
      accountType, cancelledChequeUrl,
    } = req.body;

    const errors = [];
    if (!accountHolderName) errors.push('Account holder name is required');
    if (!accountNumber || accountNumber.length < 8) errors.push('Valid account number is required');
    if (!ifscCode || !isValidIFSC(ifscCode)) errors.push('Valid IFSC code is required');
    if (!bankName) errors.push('Bank name is required');
    if (accountType && !['Savings', 'Current'].includes(accountType)) errors.push('Account type must be Savings or Current');

    if (errors.length) {
      return res.status(422).json({ success: false, message: 'Validation failed', errors });
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      {
        $set: {
          'bankDetails.accountHolderName': accountHolderName.trim(),
          'bankDetails.accountNumber':     accountNumber.trim(),
          'bankDetails.accountLast4':      accountNumber.trim().slice(-4),
          'bankDetails.ifscCode':          ifscCode.toUpperCase().trim(),
          'bankDetails.bankName':          bankName.trim(),
          'bankDetails.upiId':             upiId?.trim() || undefined,
          'bankDetails.upiName':           upiName?.trim() || undefined,
          'bankDetails.accountType':       accountType || 'Savings',
          'bankDetails.cancelledChequeUrl': cancelledChequeUrl,
          'bankDetails.isVerified':        false,  // re-verify on update
          updatedBy:                       req.user._id,
        },
      }
    );

    await invalidateSdpCache(req.soloPartner._id);

    createAuditLog({
      level: 'info', category: 'user',
      message: `Solo partner submitted bank details: XXXX${accountNumber.slice(-4)}`,
      actor: buildActor(req),
      relatedEntity: { model: 'User', entityId: req.user._id, label: req.user.email },
    });

    res.json({ success: true, message: 'Bank details submitted for verification. Allow 1-2 business days.' });
  })
);

/** GET /settlement — settlement history & pending balance */
router.get(
  '/settlement',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);

    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('settlement partnerCode stats.totalEarnings stats.totalCommissionPaid')
      .lean();

    res.json({
      success: true,
      data: {
        summary: {
          pendingAmount:  partner.settlement?.pendingAmount || 0,
          totalSettled:   partner.settlement?.totalSettled  || 0,
          totalEarnings:  partner.stats?.totalEarnings      || 0,
          commissionPaid: partner.stats?.totalCommissionPaid || 0,
          lastSettledAt:  partner.settlement?.lastSettledAt,
          preferredMethod: partner.settlement?.preferredMethod,
        },
      },
    });
  })
);

// ── §11  Availability & Location Routes ───────────────────────────────────────
// PATCH /api/solo-driver/availability   → toggle online / offline
// GET   /api/solo-driver/availability   → current availability status

/** GET /availability — current availability state */
router.get(
  '/availability',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('isAvailable availabilityHours partnershipStatus isOnboardingComplete')
      .populate('driverProfile', 'status isActive isVerified')
      .lean();

    res.json({
      success: true,
      data: {
        isAvailable:          partner.isAvailable,
        availabilityHours:    partner.availabilityHours,
        partnershipStatus:    partner.partnershipStatus,
        isOnboardingComplete: partner.isOnboardingComplete,
        driverDispatchStatus: partner.driverProfile?.status || null,
        isDispatchReady:      (
          partner.partnershipStatus === 'active' &&
          partner.isAvailable &&
          partner.isOnboardingComplete &&
          !!partner.driverProfile
        ),
      },
    });
  })
);

/** PATCH /availability — go online / offline */
router.patch(
  '/availability',
  ...partnerGuard,
  requireActive,
  asyncHandler(async (req, res) => {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return res.status(422).json({ success: false, message: '`isAvailable` must be a boolean' });
    }

    // If going online, validate dispatch readiness
    if (isAvailable) {
      const partner = req.soloPartner;
      if (!partner.isOnboardingComplete) {
        return res.status(403).json({ success: false, message: 'Please complete onboarding before going online' });
      }
      if (!partner.kyc?.isVerified) {
        return res.status(403).json({ success: false, message: 'KYC verification is required before going online' });
      }
      if (!partner.driverProfile) {
        return res.status(403).json({ success: false, message: 'Dispatch profile not yet created. Please contact support.' });
      }
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { isAvailable, updatedBy: req.user._id } }
    );

    // Mirror status to companion Driver doc
    if (req.soloPartner.driverProfile) {
      await Driver.findByIdAndUpdate(req.soloPartner.driverProfile, {
        $set: {
          status: isAvailable ? 'Available' : 'Offline',
          'shift.isAvailableNow': isAvailable,
        },
      });
    }

    res.json({
      success: true,
      message: isAvailable ? "You're now online and accepting rides" : "You're now offline",
      data:    { isAvailable },
    });
  })
);

// ── §12  Service Zones & Pricing Routes ───────────────────────────────────────
// GET    /api/solo-driver/service-zones        → list own zones
// POST   /api/solo-driver/service-zones        → add zone
// DELETE /api/solo-driver/service-zones/:id    → remove zone
// GET    /api/solo-driver/pricing              → own pricing config
// PUT    /api/solo-driver/pricing              → update pricing

/** GET /service-zones */
router.get(
  '/service-zones',
  ...partnerGuard,
  cache(120, (req) => CK.zones(req.soloPartner._id)),
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('serviceZones')
      .lean();

    res.json({ success: true, data: partner?.serviceZones || [] });
  })
);

/** POST /service-zones — add a new service zone */
router.post(
  '/service-zones',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { city, state, pinCodes, radiusKm } = req.body;
    if (!city || !state) {
      return res.status(422).json({ success: false, message: 'City and state are required for a service zone' });
    }

    const partner = await SoloDriverPartner.findById(req.soloPartner._id).select('serviceZones');
    if (partner.serviceZones.length >= 10) {
      return res.status(422).json({ success: false, message: 'Maximum 10 service zones allowed' });
    }

    // Check for duplicate city/state
    const exists = partner.serviceZones.some(
      (z) => z.city.toLowerCase() === city.toLowerCase() && z.state.toLowerCase() === state.toLowerCase()
    );
    if (exists) {
      return res.status(409).json({ success: false, message: `Service zone for ${city}, ${state} already exists` });
    }

    const updated = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      {
        $push: {
          serviceZones: {
            city:     city.trim(),
            state:    state.trim(),
            pinCodes: Array.isArray(pinCodes) ? pinCodes : [],
            radiusKm: Number(radiusKm) || 15,
            isActive: true,
          },
        },
        $set: { updatedBy: req.user._id },
      },
      { new: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);

    res.status(201).json({ success: true, message: 'Service zone added', data: updated.serviceZones });
  })
);

/** DELETE /service-zones/:zoneId */
router.delete(
  '/service-zones/:zoneId',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      return res.status(400).json({ success: false, message: 'Invalid zone ID' });
    }

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $pull: { serviceZones: { _id: new mongoose.Types.ObjectId(zoneId) } } }
    );

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Service zone removed' });
  })
);

/** GET /pricing */
router.get(
  '/pricing',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('pricing platformFeeOverride settlementCycle')
      .lean();
 
    // Resolve effective platform fee: partner override ?? global config
    let effectivePlatformFee = partner.platformFeeOverride ?? null;
    if (!effectivePlatformFee) {
      const globalConfig    = await PlatformPricingConfig.getGlobal();
      effectivePlatformFee  = globalConfig.transport.platformFee;
    }
 
    res.json({
      success: true,
      data: {
        pricing:             partner.pricing,
        platformFeeOverride: partner.platformFeeOverride ?? null,
        effectivePlatformFee,               // resolved value the partner actually pays
        settlementCycle:     partner.settlementCycle,
        isUsingGlobalFee:    !partner.platformFeeOverride,
      },
    });
  })
);
 

/** PUT /pricing — update own pricing */
router.put(
  '/pricing',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const allowed = [
      'baseFare', 'baseFarePerKm', 'minimumFare', 'waitingChargePerMin',
      'freeWaitingMinutes', 'nightSurchargePercent', 'wheelchairSurcharge',
    ];
    const pricing = pick(req.body, allowed);

    // Basic numeric validation
    for (const [k, v] of Object.entries(pricing)) {
      const n = Number(v);
      if (isNaN(n) || n < 0) {
        return res.status(422).json({ success: false, message: `${k} must be a non-negative number` });
      }
      pricing[k] = n;
    }

    if (pricing.minimumFare !== undefined && pricing.minimumFare < 50) {
      return res.status(422).json({ success: false, message: 'Minimum fare cannot be less than ₹50' });
    }

    const update = { updatedBy: req.user._id };
    for (const [k, v] of Object.entries(pricing)) {
      update[`pricing.${k}`] = v;
    }

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, { $set: update });

    await invalidateSdpCache(req.soloPartner._id);

    res.json({ success: true, message: 'Pricing updated', data: pricing });
  })
);

// ── §13  Stats & Rating Routes ────────────────────────────────────────────────
// GET /api/solo-driver/stats    → ride and earnings stats
// GET /api/solo-driver/rating   → rating summary

/** GET /stats */
router.get(
  '/stats',
  ...partnerGuard,
  cache(120, (req) => CK.stats(req.soloPartner._id)),
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('stats rating partnerSince profileCompletionPercent')
      .populate('driverProfile', 'performance.totalRidesCompleted performance.rating rewards.tier performance.totalEarnings')
      .lean();

    res.json({ success: true, data: partner });
  })
);

/** GET /rating */
router.get(
  '/rating',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('rating stats.totalRidesCompleted')
      .lean();

    res.json({ success: true, data: partner?.rating || { averageRating: 0, totalRatings: 0, totalRides: 0 } });
  })
);

// ── §14  Documents & Compliance Routes ───────────────────────────────────────
// GET /api/solo-driver/compliance   → all document expiry statuses

/** GET /compliance — summary of all expiring documents */
router.get(
  '/compliance',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('kyc medicalFitness vehicle.insuranceExpiry vehicle.pollutionCertExpiry vehicle.fitnessCertExpiry vehicle.permitExpiry')
      .lean();

    const now  = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const flagDoc = (label, expiry) => {
      if (!expiry) return { label, status: 'missing', expiry: null };
      const d = new Date(expiry);
      if (d < now)   return { label, status: 'expired',  expiry: d, daysLeft: 0 };
      if (d < soon)  return { label, status: 'expiring', expiry: d, daysLeft: Math.ceil((d - now) / 86_400_000) };
      return { label, status: 'valid', expiry: d, daysLeft: Math.ceil((d - now) / 86_400_000) };
    };

    const docs = [
      flagDoc('Driving Licence',         partner.kyc?.drivingLicenceExpiry),
      flagDoc('PSV Badge',               partner.kyc?.psvBadgeExpiry),
      flagDoc('Medical Fitness',         partner.medicalFitness?.expiryDate),
      flagDoc('Vehicle Insurance',       partner.vehicle?.insuranceExpiry),
      flagDoc('Pollution Certificate',   partner.vehicle?.pollutionCertExpiry),
      flagDoc('Fitness Certificate',     partner.vehicle?.fitnessCertExpiry),
      flagDoc('Vehicle Permit',          partner.vehicle?.permitExpiry),
    ];

    const hasExpired  = docs.some((d) => d.status === 'expired');
    const hasExpiring = docs.some((d) => d.status === 'expiring');

    res.json({
      success: true,
      data: {
        documents:   docs,
        overallStatus: hasExpired ? 'critical' : hasExpiring ? 'warning' : 'good',
        hasExpired,
        hasExpiring,
      },
    });
  })
);

// ── §15  Security Routes ──────────────────────────────────────────────────────
// GET    /api/solo-driver/security/sessions      → list active sessions
// DELETE /api/solo-driver/security/sessions/:id  → revoke a session
// GET    /api/solo-driver/security/devices       → registered device tokens
// DELETE /api/solo-driver/security/devices/:id   → remove device token
// POST   /api/solo-driver/security/change-password → change password
// GET    /api/solo-driver/notifications           → own notifications
// PATCH  /api/solo-driver/notifications/:id/read  → mark notification read
// PATCH  /api/solo-driver/notifications/read-all  → mark all read

/** GET /security/sessions */
router.get(
  '/security/sessions',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions lastLoginAt lastLoginIp').lean();

    res.json({ success: true, data: { sessions: user.auditSessions || [], lastLoginAt: user.lastLoginAt, lastLoginIp: user.lastLoginIp } });
  })
);

/** DELETE /security/sessions/:sessionId — revoke a specific session */
router.delete(
  '/security/sessions/:sessionId',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid session ID' });
    }

    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { auditSessions: { _id: new mongoose.Types.ObjectId(sessionId) } } }
    );

    res.json({ success: true, message: 'Session revoked' });
  })
);

/** GET /security/devices */
router.get(
  '/security/devices',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('deviceTokens').lean();
    const safe = (user.deviceTokens || []).map(({ _id, platform, deviceName, lastUsedAt }) => ({
      _id, platform, deviceName, lastUsedAt,
    }));
    res.json({ success: true, data: safe });
  })
);

/** DELETE /security/devices/:deviceId — remove a registered device */
router.delete(
  '/security/devices/:deviceId',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(400).json({ success: false, message: 'Invalid device ID' });
    }

    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { deviceTokens: { _id: new mongoose.Types.ObjectId(deviceId) } } }
    );

    res.json({ success: true, message: 'Device removed' });
  })
);

/** POST /security/change-password */
router.post(
  '/security/change-password',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(422).json({ success: false, message: 'Current password and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(422).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    if (currentPassword === newPassword) {
      return res.status(422).json({ success: false, message: 'New password must be different from the current password' });
    }

    const user  = await User.findById(req.user._id).select('+password');
    const match = await bcrypt.compare(currentPassword, user.password || '');
    if (!match) {
      createAuditLog({
        level: 'warning', category: 'security',
        message: `Failed password change attempt for solo partner: ${req.user.email}`,
        actor: buildActor(req),
      });
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password          = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    createAuditLog({
      level: 'success', category: 'security',
      message: `Solo partner changed password: ${req.user.email}`,
      actor: buildActor(req),
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    // Send confirmation email (non-blocking)
    sendEmail({
      email:   req.user.email,
      subject: 'Your Likeson password was changed',
      html:    transactionalTemplate({
        header:     'SECURITY ALERT',
        title:      'Password Changed Successfully',
        body:       'Your Likeson account password was recently changed. If this was not you, please contact support immediately.',
        buttonLink: `${process.env.FRONTEND_URL}/support`,
        buttonText: 'Contact Support',
      }),
    }).catch((e) => log.error('[PasswordChange] Email error:', e.message));

    res.json({ success: true, message: 'Password changed successfully' });
  })
);

// ── Notifications ─────────────────────────────────────────────────────────────

/** GET /notifications — own notifications (paginated) */
router.get(
  '/notifications',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { recipient: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;
    if (req.query.type) filter.type = req.query.type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({
      ...paginate(notifications, total, page, limit),
      unreadCount,
    });
  })
);

/** PATCH /notifications/:id/read — mark one notification as read */
router.patch(
  '/notifications/:id/read',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.json({ success: true, message: 'Notification marked as read' });
  })
);

/** PATCH /notifications/read-all — mark all notifications as read */
router.patch(
  '/notifications/read-all',
  ...partnerGuard,
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.json({ success: true, message: `${result.modifiedCount} notifications marked as read` });
  })
);

// ── §16  Admin Routes ─────────────────────────────────────────────────────────
// GET    /api/solo-driver/admin/list                → list all partners (paginated, filtered)
// POST   /api/solo-driver/admin/create
// GET    /api/solo-driver/admin/:id                 → single partner detail
// PATCH  /api/solo-driver/admin/:id/verify-kyc      → approve/reject KYC
// PATCH  /api/solo-driver/admin/:id/verify-vehicle  → approve/reject vehicle
// PATCH  /api/solo-driver/admin/:id/verify-bank     → mark bank verified
// PATCH  /api/solo-driver/admin/:id/status          → change partnership status
// PATCH  /api/solo-driver/admin/:id/block           → block/unblock the user account
// POST   /api/solo-driver/admin/:id/create-driver   → create companion Driver doc
// PATCH  /api/solo-driver/admin/:id/commission      → override commission
// GET    /api/solo-driver/admin/compliance-alerts   → partners with expiring docs
// POST   /api/solo-driver/admin/:id/notes           → update admin notes

/** GET /admin/list — paginated list with powerful filtering */
router.get(
  '/admin/list',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const {
      status, kycStatus, vehicleStatus, city, state,
      search, hasDriverProfile, sortBy, sortOrder,
    } = req.query;

    const filter = {};
    if (status)        filter.partnershipStatus            = status;
    if (kycStatus)     filter['kyc.verificationStatus']    = kycStatus;
    if (vehicleStatus) filter['vehicle.verificationStatus'] = vehicleStatus;
    if (city)          filter['serviceZones.city']         = new RegExp(city, 'i');
    if (state)         filter['serviceZones.state']        = new RegExp(state, 'i');
    if (hasDriverProfile === 'true')  filter.driverProfile = { $ne: null };
    if (hasDriverProfile === 'false') filter.driverProfile = null;

    if (search) {
      filter.$or = [
        { legalName:   new RegExp(search, 'i') },
        { displayName: new RegExp(search, 'i') },
        { partnerCode: new RegExp(search, 'i') },
        { phone:       new RegExp(search, 'i') },
        { email:       new RegExp(search, 'i') },
      ];
    }

    const sortField = sortBy || 'createdAt';
    const sort      = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const [partners, total] = await Promise.all([
      SoloDriverPartner.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-kyc.aadhaarNumber -bankDetails.accountNumber -panNumber -adminNotes -internalNotes')
        .populate('user', 'name email phone avatar isEmailVerified isPhoneVerified isBlocked')
        .populate('driverProfile', 'status isActive isVerified')
        .lean(),
      SoloDriverPartner.countDocuments(filter),
    ]);

    res.json(paginate(partners, total, page, limit));
  })
);

 
/**
 * @route   POST /api/v1/admin/create-solo-partner
 * @desc    Admin creates a Solo Driver Partner (User + Partner + Driver Doc)
 * @access  Private (Admin/Superadmin)
 */
router.post(
  "/admin/create",
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const {
      // ── User / Personal ──────────────────────────────────────────────────
      name,
      email,
      phone,
      // ── SoloDriverPartner core ───────────────────────────────────────────
      legalName,
      displayName,
      dateOfBirth,
      gender,
      address, // { street, city, state, pinCode, country }
      // ── KYC ──────────────────────────────────────────────────────────────
      drivingLicenceNumber,
      drivingLicenceExpiry,
      aadhaarNumber,
      // ── Vehicle ──────────────────────────────────────────────────────────
      registrationNumber,
      vehicleType,
      make,
      vehicleModel,
      // ── Business / Operational ───────────────────────────────────────────
      businessType,
      tradeName,
      settlementCycle,
      platformFeeOverride, // { type: 'fixed'|'percentage', value: Number }
      // ── Internal ─────────────────────────────────────────────────────────
      internalNotes,
      adminNotes: adminNotesInput,
    } = req.body;

    // ── 1. Validation ────────────────────────────────────────────────────────
    const errors = [];
    if (!name?.trim()) errors.push("Full name is required");
    if (!email?.trim()) errors.push("Email is required");
    if (!phone) errors.push("Phone number is required");
    if (!legalName?.trim()) errors.push("Legal name is required");
    if (!address?.city) errors.push("City is required");
    if (!address?.state) errors.push("State is required");
    if (!drivingLicenceNumber)
      errors.push("Driving Licence Number is required");

    // Validate Platform Fee Override if provided
    if (platformFeeOverride) {
      const { type, value } = platformFeeOverride;
      if (!["fixed", "percentage"].includes(type)) {
        errors.push('platformFeeOverride.type must be "fixed" or "percentage"');
      }
      if (typeof value !== "number" || value < 0) {
        errors.push("platformFeeOverride.value must be a non-negative number");
      }
    }

    if (errors.length) {
      return res
        .status(422)
        .json({ success: false, message: "Validation failed", errors });
    }

    // ── 2. Duplicate Check ───────────────────────────────────────────────────
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

    const [emailExists, phoneExists] = await Promise.all([
      User.exists({ email: normalizedEmail }),
      User.exists({ phone: { $regex: normalizedPhone + "$" } }),
    ]);

    if (emailExists)
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    if (phoneExists)
      return res
        .status(409)
        .json({ success: false, message: "Phone number already registered" });

    // ── 3. Fetch Global Pricing Defaults ─────────────────────────────────────
    const globalConfig = await PlatformPricingConfig.getGlobal();
    const effectiveFee =
      platformFeeOverride || globalConfig.transport.platformFee;

    // ── 4. Create User ───────────────────────────────────────────────────────
    const rawPassword = `Lks@${Math.random().toString(36).slice(-4).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      role: "solodriverpartner",
      isEmailVerified: true,
      isPhoneVerified: true,
      createdBy: req.user._id,
    });

    // ── 5. Create SoloDriverPartner Document ─────────────────────────────────
    const partnerPayload = {
      user: newUser._id,
      legalName: legalName.trim(),
      displayName: displayName?.trim() || legalName.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      address: {
        street: address.street || "",
        city: address.city.trim(),
        state: address.state.trim(),
        pinCode: address.pinCode || "",
        country: address.country || "India",
      },
      businessType: businessType || "individual",
      tradeName: tradeName?.trim(),
      settlementCycle: settlementCycle || "Weekly",
      platformFeeOverride: platformFeeOverride || null, // null = use global
      partnershipStatus: "pending",
      createdBy: req.user._id,
      internalNotes,
      adminNotes: adminNotesInput,
      kyc: {
        drivingLicenceNumber: drivingLicenceNumber.toUpperCase().trim(),
        drivingLicenceExpiry: drivingLicenceExpiry
          ? new Date(drivingLicenceExpiry)
          : undefined,
        aadhaarNumber: aadhaarNumber || undefined,
        verificationStatus: "not-submitted",
      },
    };

    if (dateOfBirth) partnerPayload.dateOfBirth = new Date(dateOfBirth);
    if (gender) partnerPayload.gender = gender;

    // Build Vehicle sub-doc if registration is provided
    if (registrationNumber) {
      partnerPayload.vehicle = {
        registrationNumber: registrationNumber.toUpperCase().replace(/\s/g, ""),
        make: make || "Unknown",
        model: vehicleModel || "Unknown",
        vehicleType: vehicleType || "Sedan",
        verificationStatus: "pending",
      };
    }

    const newPartner = await SoloDriverPartner.create(partnerPayload);

    // ── 6. Create Companion Driver Document (The "Dispatch Profile") ──────────
    // Every SoloDriverPartner needs a companion Driver record for the dispatch engine
    const driverDoc = await Driver.create({
      user: newUser._id,
      soloPartner: newPartner._id,
      legalName: partnerPayload.legalName,
      phone: normalizedPhone,
      email: normalizedEmail,
      kyc: {
        drivingLicenceNumber: partnerPayload.kyc.drivingLicenceNumber,
        drivingLicenceExpiry: partnerPayload.kyc.drivingLicenceExpiry,
        aadhaarNumber: aadhaarNumber || "000000000000", // Default placeholder if missing
        verificationStatus: "Pending",
      },
      assignedVehicleSnapshot: partnerPayload.vehicle
        ? {
            registrationNumber: partnerPayload.vehicle.registrationNumber,
            make: partnerPayload.vehicle.make,
            model: partnerPayload.vehicle.model,
            vehicleType: partnerPayload.vehicle.vehicleType,
          }
        : undefined,
      status: "Offline",
      createdBy: req.user._id,
    });

    // Link the Driver profile back to the Partner doc
    newPartner.driverProfile = driverDoc._id;
    await newPartner.save();

    // ── 7. Infrastructure (Wallet & Notifications) ───────────────────────────
    await Wallet.create({
      user: newUser._id,
      balance: 0,
      createdBy: req.user._id,
    });
  const loginUrl = `${process.env.FRONTEND_URL}/login`
    sendEmail({
      email: normalizedEmail,

      subject: "🏥 Welcome to Likeson Healthcare — Your Driver Partner Account",

      html: transactionalTemplate({
        header: "WELCOME TO LIKESON",

        title: `Hi ${name.trim()}, your partner account is ready!`,

        body: `

          <p style="margin:0 0 16px;">You have been registered as a <strong>Solo Driver Partner</strong> on the Likeson Healthcare platform by our operations team.</p>



          <table width="100%" cellpadding="0" cellspacing="0"

                 style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin-bottom:16px;">

            <tr>

              <td style="font-size:13px;color:#475569;padding:4px 0;width:40%;">Login Email</td>

              <td style="font-size:13px;font-weight:700;color:#1e293b;padding:4px 0;">${normalizedEmail}</td>

            </tr>

            <tr>

              <td style="font-size:13px;color:#475569;padding:4px 0;">Temporary Password</td>

              <td style="font-size:15px;font-weight:800;color:#0f3460;

                         font-family:'Courier New',monospace;padding:4px 0;letter-spacing:2px;">

                ${rawPassword}

              </td>

            </tr>
            <tr>
              <td style="font-size:13px;color:#475569;padding:4px 0;">Partner Code</td>

              <td style="font-size:13px;font-weight:700;color:#1e293b;padding:4px 0;">${newPartner.partnerCode}</td>

            </tr>

          </table>



          <p style="margin:0 0 8px;font-size:12px;color:#64748b;">

            ⚠️ <strong>Please change your password immediately</strong> after your first login for security.

          </p>

          <p style="margin:0;font-size:12px;color:#64748b;">

            Complete your profile, submit KYC documents, and add your vehicle details to activate your account.

          </p>

        `,

        buttonLink: loginUrl,

        buttonText: "Login to Your Account →",
      }),
    }).catch((e) =>
      log.error("[AdminCreate] Welcome email failed:", e.message),
    );

    // ── 8. In-app notification ───────────────────────────────────────────────

    Notification.create({
      recipient: newUser._id,

      title: "Welcome to Likeson! 🎉",

      body: "Your solo driver partner account has been created. Please complete your KYC and vehicle details to get started.",

      type: "Account_Status",

      priority: "High",

      triggeredBy: "admin",
    }).catch((e) => log.error("[AdminCreate] Notification failed:", e.message));

    // ── 9. Audit log ─────────────────────────────────────────────────────────

    createAuditLog({
      level: "success",

      category: "user",

      message: `Admin created new solo driver partner: ${normalizedEmail}`,

      actor: buildActor(req),

      relatedEntity: {
        model: "User",
        entityId: newUser._id,
        label: normalizedEmail,
      },

      request: { method: "POST", path: req.path, statusCode: 201 },

      metadata: {
        partnerCode: newPartner.partnerCode,

        partnerId: newPartner._id,

        hasVehicle: !!partnerPayload.vehicle,

        hasKyc: !!partnerPayload.kyc,

        createdByRole: req.user.role,
      },
    });

    await invalidatePattern("sdp:list:*");

    // ── 10. Final Response ───────────────────────────────────────────────────
    res.status(201).json({
      success: true,
      message: "Solo Driver Partner created successfully",
      data: {
        userId: newUser._id,
        partnerId: newPartner._id,
        driverId: driverDoc._id,
        partnerCode: newPartner.partnerCode,
        effectivePlatformFee: effectiveFee,
      },
    });
  }),
);

 
 

/** GET /admin/:id — full partner detail for admin */
router.get(
  '/admin/:id',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    const partner = await SoloDriverPartner
      .findById(id)
      .populate('user', 'name email phone avatar role isEmailVerified isPhoneVerified isBlocked blockReason auditSessions loginCount lastLoginAt coins referralCode')
      .populate('driverProfile')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .lean();

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    // Mask bank account for safety
    if (partner.bankDetails?.accountNumber) {
      partner.bankDetails.maskedAccount = `XXXX${partner.bankDetails.accountLast4}`;
      delete partner.bankDetails.accountNumber;
    }

    res.json({ success: true, data: partner });
  })
);

/** PATCH /admin/:id/verify-kyc — approve or reject KYC */
router.patch(
  '/admin/:id/verify-kyc',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(422).json({ success: false, message: 'action must be "approve" or "reject"' });
    }
    if (action === 'reject' && !rejectionReason) {
      return res.status(422).json({ success: false, message: 'Rejection reason is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    const approved = action === 'approve';
    const update   = {
      'kyc.verificationStatus': approved ? 'verified' : 'rejected',
      'kyc.isVerified':         approved,
      'kyc.verifiedAt':         approved ? new Date() : undefined,
      'kyc.verifiedBy':         req.user._id,
      'kyc.rejectionReason':    !approved ? rejectionReason : undefined,
      updatedBy:                req.user._id,
    };

    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const partner = await SoloDriverPartner.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('user', 'name email');

    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    // Notify partner
    await Notification.create({
      recipient: partner.user._id,
      title:     approved ? 'KYC Verified ✅' : 'KYC Rejected ❌',
      body:      approved
        ? 'Your KYC documents have been verified. You can now proceed to activate your account.'
        : `KYC rejected: ${rejectionReason}. Please re-submit with corrections.`,
      type:      'KYC_Approved',
      priority:  'High',
      triggeredBy: 'admin',
    });

    createAuditLog({
      level:    approved ? 'success' : 'warning',
      category: 'kyc',
      message:  `Admin ${approved ? 'approved' : 'rejected'} solo partner KYC: ${partner.user.email}`,
      actor:    buildActor(req),
      relatedEntity: { model: 'User', entityId: partner.user._id, label: partner.user.email },
      metadata: { action, rejectionReason },
    });

    await invalidateSdpCache(id);

    res.json({ success: true, message: `KYC ${action}d`, data: { kycStatus: partner.kyc.verificationStatus } });
  })
);

/** PATCH /admin/:id/verify-vehicle — approve or reject vehicle */
router.patch(
  '/admin/:id/verify-vehicle',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(422).json({ success: false, message: 'action must be "approve" or "reject"' });
    }
    if (action === 'reject' && !rejectionReason) {
      return res.status(422).json({ success: false, message: 'Rejection reason is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    const approved = action === 'approve';
    const update   = {
      'vehicle.verificationStatus': approved ? 'verified' : 'rejected',
      'vehicle.isActive':           approved,
      'vehicle.verifiedAt':         approved ? new Date() : undefined,
      'vehicle.verifiedBy':         req.user._id,
      'vehicle.rejectionReason':    !approved ? rejectionReason : undefined,
      updatedBy:                    req.user._id,
    };
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const partner = await SoloDriverPartner.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('user', 'name email');

    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    await Notification.create({
      recipient:   partner.user._id,
      title:       approved ? 'Vehicle Verified ✅' : 'Vehicle Rejected ❌',
      body:        approved
        ? 'Your vehicle has been verified and activated on the platform.'
        : `Vehicle verification rejected: ${rejectionReason}`,
      type:        'Account_Status',
      priority:    'High',
      triggeredBy: 'admin',
    });

    createAuditLog({
      level:    approved ? 'success' : 'warning',
      category: 'kyc',
      message:  `Admin ${approved ? 'approved' : 'rejected'} solo partner vehicle: ${partner.user.email}`,
      actor:    buildActor(req),
      relatedEntity: { model: 'User', entityId: partner.user._id },
    });

    await invalidateSdpCache(id);

    res.json({ success: true, message: `Vehicle ${action}d`, data: { vehicleStatus: partner.vehicle.verificationStatus } });
  })
);

/** PATCH /admin/:id/verify-bank — mark bank account as verified */
router.patch(
  '/admin/:id/verify-bank',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      id,
      {
        $set: {
          'bankDetails.isVerified': true,
          'bankDetails.verifiedAt': new Date(),
          'bankDetails.verifiedBy': req.user._id,
          updatedBy:                req.user._id,
        },
      },
      { new: true }
    ).populate('user', 'name email');

    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    await invalidateSdpCache(id);

    createAuditLog({
      level: 'success', category: 'user',
      message: `Admin verified bank account for solo partner: ${partner.user.email}`,
      actor: buildActor(req),
      relatedEntity: { model: 'User', entityId: partner.user._id },
    });

    res.json({ success: true, message: 'Bank account verified' });
  })
);

/** PATCH /admin/:id/status — change partnership status */
router.patch(
  '/admin/:id/status',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const validStatuses = ['pending', 'under-review', 'active', 'suspended', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(422).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });
    }
    if (['suspended', 'rejected'].includes(status) && !rejectionReason) {
      return res.status(422).json({ success: false, message: 'A reason is required when suspending or rejecting a partner' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    const update = {
      partnershipStatus: status,
      updatedBy:         req.user._id,
    };
    if (status === 'active')   { update.partnerSince = update.partnerSince || new Date(); update.verifiedBy = req.user._id; update.verifiedAt = new Date(); }
    if (rejectionReason)       { update.rejectionReason = rejectionReason; }
    if (status === 'active')   { update.isAvailable = false; } // start offline after activation

    const partner = await SoloDriverPartner.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('user', 'name email');

    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    // Mirror suspension to companion Driver doc
    if (partner.driverProfile) {
      await Driver.findByIdAndUpdate(partner.driverProfile, {
        $set: {
          status:   ['suspended', 'rejected'].includes(status) ? 'Suspended' : 'Offline',
          isActive: status === 'active',
          isBlocked: ['suspended', 'rejected'].includes(status),
        },
      });
    }

    const notifTitle = {
      active:       'Account Activated 🎉',
      suspended:    'Account Suspended ⚠️',
      rejected:     'Application Rejected',
      'under-review': 'Application Under Review',
    }[status] || 'Account Status Updated';

    await Notification.create({
      recipient:   partner.user._id,
      title:       notifTitle,
      body:        status === 'active'
        ? 'Congratulations! Your partner account is now active. You can start accepting rides.'
        : `Your account status has been updated to ${status}. ${rejectionReason || ''}`,
      type:        'Account_Status',
      priority:    ['suspended', 'rejected'].includes(status) ? 'High' : 'Medium',
      triggeredBy: 'admin',
    });

    createAuditLog({
      level:    status === 'active' ? 'success' : 'warning',
      category: 'user',
      message:  `Admin changed solo partner status to "${status}": ${partner.user.email}`,
      actor:    buildActor(req),
      relatedEntity: { model: 'User', entityId: partner.user._id },
      metadata: { status, rejectionReason },
    });

    await invalidateSdpCache(id);

    res.json({ success: true, message: `Partner status updated to ${status}`, data: { partnershipStatus: status } });
  })
);

/** PATCH /admin/:id/block — block or unblock the user account */
router.patch(
  '/admin/:id/block',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, blockReason, unblockAt } = req.body;

    if (!['block', 'unblock'].includes(action)) {
      return res.status(422).json({ success: false, message: 'action must be "block" or "unblock"' });
    }
    if (action === 'block' && !blockReason) {
      return res.status(422).json({ success: false, message: 'Block reason is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    const partner = await SoloDriverPartner.findById(id).populate('user', 'name email');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    const blocking = action === 'block';
    await User.findByIdAndUpdate(partner.user._id, {
      $set: {
        isBlocked:   blocking,
        blockReason: blocking ? blockReason : undefined,
        unblockAt:   blocking && unblockAt ? new Date(unblockAt) : undefined,
      },
    });

    // Also take offline
    if (blocking) {
      await SoloDriverPartner.findByIdAndUpdate(id, { $set: { isAvailable: false } });
      if (partner.driverProfile) {
        await Driver.findByIdAndUpdate(partner.driverProfile, {
          $set: { status: 'Suspended', isBlocked: true },
        });
      }
    }

    createAuditLog({
      level:    blocking ? 'warning' : 'info',
      category: 'security',
      message:  `Admin ${action}ed solo partner account: ${partner.user.email}`,
      actor:    buildActor(req),
      relatedEntity: { model: 'User', entityId: partner.user._id },
      metadata: { action, blockReason, unblockAt },
    });

    await invalidateSdpCache(id);

    res.json({ success: true, message: `User account ${action}ed` });
  })
);

/** POST /admin/:id/create-driver — create the companion Driver document for dispatch */
router.post(
  '/admin/:id/create-driver',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    const partner = await SoloDriverPartner.findById(id)
      .populate('user', 'name email phone role');

    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    if (partner.driverProfile) {
      return res.status(409).json({
        success: false,
        message: 'Companion Driver document already exists',
        driverProfileId: partner.driverProfile,
      });
    }

    if (!partner.kyc?.drivingLicenceNumber) {
      return res.status(422).json({ success: false, message: 'KYC (driving licence) must be submitted before creating a driver profile' });
    }

    // Create companion Driver document
    const driverDoc = await Driver.create({
      user:         partner.user._id,
      soloPartner:  partner._id,
      ownerAgency:  null,
      legalName:    partner.legalName,
      phone:        partner.phone,
      email:        partner.email,
      dateOfBirth:  partner.dateOfBirth,
      gender:       partner.gender,
      languagesSpoken: partner.languagesSpoken,
      hasMedicalTransportExp: partner.hasMedicalTransportExp,
      hasAmbulanceExp:        partner.hasAmbulanceExp,
      yearsOfExperience:      partner.yearsOfExperience,
      kyc: {
        aadhaarNumber:        'XXXX', // placeholder — solo partner KYC is on SoloDriverPartner.kyc
        drivingLicenceNumber: partner.kyc.drivingLicenceNumber,
        drivingLicenceExpiry: partner.kyc.drivingLicenceExpiry,
        drivingLicenceDocUrl: partner.kyc.drivingLicenceDocUrl,
        licenceClass:         partner.kyc.licenceClass,
        verificationStatus:   partner.kyc.isVerified ? 'Verified' : 'Pending',
        isVerified:           partner.kyc.isVerified,
      },
      medicalFitness:    partner.medicalFitness,
      assignedVehicleSnapshot: partner.vehicle?.registrationNumber ? {
        vehicleCode:        partner.vehicle.vehicleCode,
        registrationNumber: partner.vehicle.registrationNumber,
        make:               partner.vehicle.make,
        model:              partner.vehicle.model,
        vehicleType:        partner.vehicle.vehicleType,
        color:              partner.vehicle.color,
      } : undefined,
      status:    'Offline',
      isActive:  partner.partnershipStatus === 'active',
      isVerified: partner.kyc.isVerified,
      createdBy: req.user._id,
    });

    // Link back
    partner.driverProfile = driverDoc._id;
    await partner.save();

    // Award SOLO_PARTNER badge
    await driverDoc.awardBadge('SOLO_PARTNER', 'Solo Partner', 'Self-employed vehicle owner on the Likeson platform');

    createAuditLog({
      level: 'success', category: 'user',
      message: `Admin created companion Driver doc for solo partner: ${partner.user.email}`,
      actor:   buildActor(req),
      relatedEntity: { model: 'User', entityId: partner.user._id },
      metadata: { driverProfileId: driverDoc._id },
    });

    await invalidateSdpCache(id);

    res.status(201).json({
      success: true,
      message: 'Companion Driver profile created. Partner is now dispatch-ready.',
      data: { driverProfileId: driverDoc._id },
    });
  })
);

/** PATCH /admin/:id/commission — override commission percentage */
router.patch(
  '/admin/:id/platform-fee',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { platformFeeOverride, settlementCycle } = req.body;
 
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }
 
    const updates = { updatedBy: req.user._id };
 
    // ── Validate platformFeeOverride ─────────────────────────────────────────
    if (platformFeeOverride !== undefined) {
      if (platformFeeOverride === null) {
        // Explicit null → clear the override
        updates.platformFeeOverride = null;
      } else {
        const validTypes = ['fixed', 'percentage'];
        if (!validTypes.includes(platformFeeOverride.type)) {
          return res.status(422).json({
            success: false,
            message: `platformFeeOverride.type must be one of: ${validTypes.join(', ')}`,
          });
        }
        const val = Number(platformFeeOverride.value);
        if (isNaN(val) || val < 0) {
          return res.status(422).json({
            success: false,
            message: 'platformFeeOverride.value must be a non-negative number',
          });
        }
        if (platformFeeOverride.type === 'percentage' && val > 100) {
          return res.status(422).json({
            success: false,
            message: 'platformFeeOverride.value must be ≤ 100 for percentage type',
          });
        }
        updates.platformFeeOverride = { type: platformFeeOverride.type, value: val };
      }
    }
 
    // ── Validate settlementCycle ─────────────────────────────────────────────
    if (settlementCycle !== undefined) {
      const valid = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];
      if (!valid.includes(settlementCycle)) {
        return res.status(422).json({
          success: false,
          message: `settlementCycle must be one of: ${valid.join(', ')}`,
        });
      }
      updates.settlementCycle = settlementCycle;
    }
 
    if (Object.keys(updates).length === 1) {
      // Only updatedBy — nothing else to update
      return res.status(422).json({
        success: false,
        message: 'Provide at least one of: platformFeeOverride, settlementCycle',
      });
    }
 
    await SoloDriverPartner.findByIdAndUpdate(id, { $set: updates });
 
    // Resolve the effective fee after save for audit log
    const globalConfig  = await PlatformPricingConfig.getGlobal();
    const effectiveFee  = updates.platformFeeOverride ?? globalConfig.transport.platformFee;
 
    createAuditLog({
      level:    'info',
      category: 'user',
      message:  `Admin updated platform fee for solo partner ${id}`,
      actor:    buildActor(req),
      metadata: {
        platformFeeOverride: updates.platformFeeOverride,
        settlementCycle:     updates.settlementCycle,
        effectiveFee,
      },
    });
 
    await invalidateSdpCache(id);
 
    res.json({
      success: true,
      message: 'Platform fee settings updated',
      data: {
        platformFeeOverride: updates.platformFeeOverride,
        effectivePlatformFee: effectiveFee,
        settlementCycle:      updates.settlementCycle,
        isUsingGlobalFee:     !updates.platformFeeOverride,
      },
    });
  })
);

/** GET /admin/compliance-alerts — partners with expiring or expired documents */
router.get(
  '/admin/compliance-alerts',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const cutoff = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
    const now    = new Date();

    const partners = await SoloDriverPartner.find({
      partnershipStatus: 'active',
      $or: [
        { 'kyc.drivingLicenceExpiry':     { $lte: cutoff } },
        { 'kyc.psvBadgeExpiry':           { $lte: cutoff } },
        { 'medicalFitness.expiryDate':    { $lte: cutoff } },
        { 'vehicle.insuranceExpiry':      { $lte: cutoff } },
        { 'vehicle.pollutionCertExpiry':  { $lte: cutoff } },
        { 'vehicle.fitnessCertExpiry':    { $lte: cutoff } },
        { 'vehicle.permitExpiry':         { $lte: cutoff } },
      ],
    })
      .select('legalName partnerCode phone email kyc.drivingLicenceExpiry kyc.psvBadgeExpiry medicalFitness.expiryDate vehicle.insuranceExpiry vehicle.pollutionCertExpiry vehicle.fitnessCertExpiry vehicle.permitExpiry')
      .populate('user', 'name email phone')
      .lean();

    // Annotate with severity
    const annotated = partners.map((p) => {
      const checks = [
        { label: 'DL Expiry',         date: p.kyc?.drivingLicenceExpiry },
        { label: 'PSV Badge',         date: p.kyc?.psvBadgeExpiry },
        { label: 'Medical Fitness',   date: p.medicalFitness?.expiryDate },
        { label: 'Insurance',         date: p.vehicle?.insuranceExpiry },
        { label: 'Pollution Cert',    date: p.vehicle?.pollutionCertExpiry },
        { label: 'Fitness Cert',      date: p.vehicle?.fitnessCertExpiry },
        { label: 'Permit',            date: p.vehicle?.permitExpiry },
      ].filter((c) => c.date && new Date(c.date) <= cutoff)
       .map((c) => ({
          ...c,
          daysLeft: Math.max(0, Math.ceil((new Date(c.date) - now) / 86_400_000)),
          isExpired: new Date(c.date) < now,
        }));

      return { ...p, expiringDocs: checks };
    });

    res.json({ success: true, total: annotated.length, data: annotated });
  })
);

/** POST /admin/:id/notes — update admin notes */
router.post(
  '/admin/:id/notes',
  ...adminGuard,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes || String(notes).trim().length === 0) {
      return res.status(422).json({ success: false, message: 'Notes content is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    }

    await SoloDriverPartner.findByIdAndUpdate(id, {
      $set: { adminNotes: String(notes).trim().slice(0, 1000), updatedBy: req.user._id },
    });

    res.json({ success: true, message: 'Admin notes updated' });
  })
);

// ── §17  Centralized Error Handler ────────────────────────────────────────────

// This must be the last middleware registered on this router.
// Express identifies error handlers by their 4-parameter signature.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  log.error('Unhandled route error:', err.message, { path: req.path, method: req.method });

  // Mongoose validation errors → 422
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ success: false, message: 'Validation failed', errors });
  }

  // Mongoose duplicate key → 409
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `Duplicate value for ${field}. Please use a unique value.` });
  }

  // Mongoose cast errors (invalid ObjectId) → 400
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid value for field: ${err.path}` });
  }

  // JWT errors (should be caught by protect, but belt-and-suspenders)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Authentication token is invalid or expired' });
  }

  // Fallback 500
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
    ...(isDev ? { error: err.message, stack: err.stack } : {}),
  });
});

// ── §18  Export ───────────────────────────────────────────────────────────────

export default router;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOUNT IN app.js / server.js:
 *
 *   import soloDriverRouter from './routes/soloDriverRouter.js';
 *   app.use('/api/solo-driver', soloDriverRouter);
 *
 * ROUTE SUMMARY
 * ───────────────────────────────────────────────────────────────────────────────
 * PARTNER (role: solodriverpartner)
 *   GET    /api/solo-driver/me
 *   PATCH  /api/solo-driver/me
 *   PATCH  /api/solo-driver/me/contact
 *   PATCH  /api/solo-driver/me/address
 *   PATCH  /api/solo-driver/me/professional
 *   POST   /api/solo-driver/me/training-certificates
 *   DELETE /api/solo-driver/me/training-certificates/:certId
 *   PATCH  /api/solo-driver/me/emergency
 *   GET    /api/solo-driver/me/settings
 *   PATCH  /api/solo-driver/me/settings
 *   DELETE /api/solo-driver/me
 *
 *   GET    /api/solo-driver/kyc
 *   POST   /api/solo-driver/kyc
 *   POST   /api/solo-driver/kyc/medical
 *   POST   /api/solo-driver/kyc/psv
 *
 *   GET    /api/solo-driver/vehicle
 *   PUT    /api/solo-driver/vehicle
 *   PATCH  /api/solo-driver/vehicle/documents
 *   PATCH  /api/solo-driver/vehicle/features
 *   PATCH  /api/solo-driver/vehicle/location
 *
 *   GET    /api/solo-driver/bank
 *   POST   /api/solo-driver/bank
 *   GET    /api/solo-driver/settlement
 *
 *   GET    /api/solo-driver/availability
 *   PATCH  /api/solo-driver/availability
 *
 *   GET    /api/solo-driver/service-zones
 *   POST   /api/solo-driver/service-zones
 *   DELETE /api/solo-driver/service-zones/:zoneId
 *   GET    /api/solo-driver/pricing
 *   PUT    /api/solo-driver/pricing
 *
 *   GET    /api/solo-driver/stats
 *   GET    /api/solo-driver/rating
 *   GET    /api/solo-driver/compliance
 *
 *   GET    /api/solo-driver/security/sessions
 *   DELETE /api/solo-driver/security/sessions/:sessionId
 *   GET    /api/solo-driver/security/devices
 *   DELETE /api/solo-driver/security/devices/:deviceId
 *   POST   /api/solo-driver/security/change-password
 *
 *   GET    /api/solo-driver/notifications
 *   PATCH  /api/solo-driver/notifications/read-all
 *   PATCH  /api/solo-driver/notifications/:id/read
 *
 * ADMIN (role: admin | superadmin)
 *   GET    /api/solo-driver/admin/list
 *   GET    /api/solo-driver/admin/compliance-alerts
 *   GET    /api/solo-driver/admin/:id
 *   PATCH  /api/solo-driver/admin/:id/verify-kyc
 *   PATCH  /api/solo-driver/admin/:id/verify-vehicle
 *   PATCH  /api/solo-driver/admin/:id/verify-bank
 *   PATCH  /api/solo-driver/admin/:id/status
 *   PATCH  /api/solo-driver/admin/:id/block
 *   POST   /api/solo-driver/admin/:id/create-driver
 *   PATCH  /api/solo-driver/admin/:id/commission
 *   POST   /api/solo-driver/admin/:id/notes
 * ═══════════════════════════════════════════════════════════════════════════════
 */