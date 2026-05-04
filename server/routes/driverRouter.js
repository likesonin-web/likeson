 

import express   from 'express';
import mongoose  from 'mongoose';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';

import Driver      from '../models/Driver.js';
import SystemLog   from '../models/SystemLog.js';

import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ── CONSTANTS ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_PAGE_SIZE     = 50;
const DEFAULT_PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════════════════
// ── UTILITIES ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const parsePagination = (q) => {
  const page  = Math.max(1, parseInt(q.page  ?? 1,  10));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(q.limit ?? DEFAULT_PAGE_SIZE, 10)));
  return { page, limit, skip: (page - 1) * limit };
};

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

/** Fire-and-forget audit log */
const audit = (payload) => {
  SystemLog.createLog(payload).catch((e) =>
    console.error('[audit] write failed:', e.message)
  );
};

/** Extract actor info from req */
const actor = (req) => ({
  userId:    req.user?._id  ?? null,
  name:      req.user?.name ?? 'system',
  email:     req.user?.email ?? null,
  role:      req.user?.role  ?? 'driver',
  ip:        req.ip          ?? 'unknown',
  userAgent: req.headers['user-agent'] ?? null,
  platform:  req.deviceInfo?.platform  ?? 'unknown',
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── RATE LIMITERS ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Slow down.' },
});

const locationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Location update rate exceeded.' },
});

router.use(generalLimiter);

// ═══════════════════════════════════════════════════════════════════════════════
// ── VALIDATION HELPERS ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const validObjectId = (field = 'id') =>
  param(field).custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val))
      throw new Error(`${field} is not a valid ObjectId.`);
    return true;
  });

// ── Reusable rule sets ────────────────────────────────────────────────────────

const personalRules = [
  body('legalName')
    .optional().isString().trim()
    .isLength({ min: 2, max: 100 }).withMessage('Legal name 2-100 chars'),
  body('dateOfBirth')
    .optional().isISO8601().withMessage('Date of birth must be valid ISO date'),
  body('gender')
    .optional().isIn(['Male', 'Female', 'Other', 'Prefer Not to Say'])
    .withMessage('Invalid gender'),
  body('phone')
    .optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian mobile (10 digits starting 6-9)'),
  body('altPhone')
    .optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid alternate phone'),
  body('whatsappNumber')
    .optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid WhatsApp number'),
  body('yearsOfExperience')
    .optional().isInt({ min: 0, max: 60 }).withMessage('Experience must be 0-60 years'),
  body('photoUrl')
    .optional().isURL().withMessage('photoUrl must be a valid URL'),
  body('languagesSpoken')
    .optional().isArray().withMessage('languagesSpoken must be an array'),
  body('languagesSpoken.*')
    .optional().isIn(['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Other'])
    .withMessage('Invalid language'),
  body('hasMedicalTransportExp')
    .optional().isBoolean().withMessage('hasMedicalTransportExp must be boolean'),
  body('hasAmbulanceExp')
    .optional().isBoolean().withMessage('hasAmbulanceExp must be boolean'),
  body('emergencyContact.name')
    .optional().isString().trim().notEmpty(),
  body('emergencyContact.phone')
    .optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid emergency contact phone'),
  body('emergencyContact.relationship')
    .optional().isString().trim(),
];

const kycRules = [
  body('kyc.aadhaarNumber')
    .optional().matches(/^\d{12}$/).withMessage('Aadhaar must be 12 digits'),
  body('kyc.aadhaarDocUrl')
    .optional().isURL().withMessage('aadhaarDocUrl must be a URL'),
  body('kyc.drivingLicenceNumber')
    .optional().isString().trim().toUpperCase()
    .notEmpty().withMessage('DL number cannot be empty'),
  body('kyc.drivingLicenceExpiry')
    .optional().isISO8601().withMessage('DL expiry must be valid ISO date'),
  body('kyc.drivingLicenceDocUrl')
    .optional().isURL().withMessage('drivingLicenceDocUrl must be a URL'),
  body('kyc.licenceClass')
    .optional().isArray().withMessage('licenceClass must be an array'),
  body('kyc.psvBadgeNumber')
    .optional().isString().trim(),
  body('kyc.psvBadgeExpiry')
    .optional().isISO8601().withMessage('PSV badge expiry must be valid ISO date'),
  body('kyc.psvBadgeDocUrl')
    .optional().isURL().withMessage('psvBadgeDocUrl must be a URL'),
  body('kyc.panNumber')
    .optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN format'),
  body('kyc.panDocUrl')
    .optional().isURL().withMessage('panDocUrl must be a URL'),
];

const bankRules = [
  body('bankDetails.accountHolderName')
    .optional().isString().trim().notEmpty(),
  body('bankDetails.accountNumber')
    .optional().isString().trim().notEmpty(),
  body('bankDetails.ifscCode')
    .optional().matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC code'),
  body('bankDetails.bankName')
    .optional().isString().trim(),
  body('bankDetails.upiId')
    .optional().isString().trim(),
];

const locationRules = [
  body('coordinates')
    .isArray({ min: 2, max: 2 }).withMessage('coordinates must be [lng, lat]'),
  body('coordinates.*')
    .isFloat().withMessage('Coordinates must be numbers'),
  body('heading')
    .optional().isFloat({ min: 0, max: 360 }).withMessage('heading must be 0-360'),
  body('speedKmh')
    .optional().isFloat({ min: 0 }).withMessage('speedKmh must be >= 0'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── GLOBAL GUARD: driver role only ────────────────────────────────────────────
// All routes below require role: 'driver'
// ═══════════════════════════════════════════════════════════════════════════════

router.use(protect, authorize('driver'));

// ═══════════════════════════════════════════════════════════════════════════════
// ── §A  PROFILE ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/profile
 * Own full profile.
 */
router.get('/profile', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .populate('ownerAgency', 'businessName slug partnershipStatus')
      .lean({ virtuals: true });

    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    return res.status(200).json({ success: true, data: driver });
  } catch (err) {
    console.error('[GET /profile]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load profile.' });
  }
});

/**
 * PATCH /driver/profile
 * Update personal details.
 * Whitelisted fields only — no status, KYC, or bank from here.
 */
router.patch(
  '/profile',
  mutationLimiter,
  [...personalRules, validate],
  async (req, res) => {
    try {
      const ALLOWED = [
        'legalName', 'dateOfBirth', 'gender', 'photoUrl',
        'phone', 'altPhone', 'whatsappNumber',
        'yearsOfExperience', 'languagesSpoken',
        'hasMedicalTransportExp', 'hasAmbulanceExp',
        'emergencyContact',
      ];

      const updates = {};
      for (const key of ALLOWED) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean({ virtuals: true });

      if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

      return res.status(200).json({ success: true, message: 'Profile updated.', data: driver });
    } catch (err) {
      console.error('[PATCH /profile]', err.message);
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Phone number already in use.' });
      }
      return res.status(500).json({ success: false, message: 'Profile update failed.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §B  STATUS & LOCATION ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PATCH /driver/status
 * Go online (Available), offline, or on-break.
 * System-only statuses (On-Trip, Suspended) cannot be self-set.
 *
 * Guards before going Available:
 *  - KYC must be Verified
 *  - Account must be active, not blocked, not paused
 *  - Vehicle must be assigned
 */
router.patch(
  '/status',
  mutationLimiter,
  [
    body('status')
      .isIn(['Available', 'Offline', 'On-Break'])
      .withMessage('Allowed values: Available | Offline | On-Break'),
    validate,
  ],
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id }).select(
        'status isActive isVerified isBlocked isPaused ' +
        'kyc.verificationStatus assignedVehicleSnapshot'
      );

      if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

      if (req.body.status === 'Available') {
        if (driver.kyc?.verificationStatus !== 'Verified')
          return res.status(403).json({ success: false, message: 'KYC not verified. Cannot go online.' });
        if (!driver.isActive)
          return res.status(403).json({ success: false, message: 'Account inactive. Contact support.' });
        if (driver.isBlocked)
          return res.status(403).json({ success: false, message: 'Account blocked. Contact support.' });
        if (driver.isPaused)
          return res.status(403).json({ success: false, message: 'Account paused. Contact your agency.' });
        if (!driver.assignedVehicleSnapshot?.registrationNumber)
          return res.status(422).json({ success: false, message: 'No vehicle assigned. Contact your agency.' });
      }

      driver.status = req.body.status;
      await driver.save();

      return res.status(200).json({
        success: true,
        message: `Status set to ${req.body.status}.`,
        data:    { status: driver.status },
      });
    } catch (err) {
      console.error('[PATCH /status]', err.message);
      return res.status(500).json({ success: false, message: 'Status update failed.' });
    }
  }
);

/**
 * PATCH /driver/location
 * High-frequency live location update.
 * Only accepted when driver is Available or On-Trip (silent pass otherwise).
 * Bounding box guard: India approx. lat 6-38, lng 68-98.
 */
router.patch(
  '/location',
  locationLimiter,
  [...locationRules, validate],
  async (req, res) => {
    try {
      const { coordinates, heading, speedKmh } = req.body;
      const [lng, lat] = coordinates;

      if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
        return res.status(422).json({
          success: false,
          message: 'Coordinates outside India bounding box.',
        });
      }

      const update = {
        'location.coordinates': [lng, lat],
        'location.updatedAt':   new Date(),
      };
      if (heading  !== undefined) update['location.heading']  = heading;
      if (speedKmh !== undefined) update['location.speedKmh'] = speedKmh;

      // Only update active drivers — silent accept if offline
      await Driver.findOneAndUpdate(
        { user: req.user._id, status: { $in: ['Available', 'On-Trip'] } },
        { $set: update }
      ).select('_id').lean();

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[PATCH /location]', err.message);
      return res.status(500).json({ success: false, message: 'Location update failed.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §C  KYC & DOCUMENTS ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/kyc
 * Own KYC status + document fields (no raw Aadhaar).
 */
router.get('/kyc', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'kyc.verificationStatus kyc.aadhaarLast4 kyc.aadhaarDocUrl ' +
        'kyc.drivingLicenceNumber kyc.drivingLicenceExpiry kyc.drivingLicenceDocUrl ' +
        'kyc.licenceClass kyc.psvBadgeNumber kyc.psvBadgeExpiry kyc.psvBadgeDocUrl ' +
        'kyc.panNumber kyc.panDocUrl kyc.rejectionReason kyc.submittedAt kyc.verifiedAt kyc.isVerified'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.kyc });
  } catch (err) {
    console.error('[GET /kyc]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load KYC.' });
  }
});

/**
 * PATCH /driver/kyc
 * Submit or resubmit KYC documents.
 * Blocked when status is Under-Review or Verified.
 * Resets to Pending on submit so admin re-reviews.
 */
router.patch(
  '/kyc',
  mutationLimiter,
  [...kycRules, validate],
  async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id }).select('kyc');
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      if (['Verified', 'Under-Review'].includes(driver.kyc.verificationStatus)) {
        return res.status(422).json({
          success: false,
          message: `KYC update blocked — current status: ${driver.kyc.verificationStatus}.`,
        });
      }

      const ALLOWED_KYC = [
        'aadhaarNumber', 'aadhaarDocUrl',
        'drivingLicenceNumber', 'drivingLicenceExpiry', 'drivingLicenceDocUrl', 'licenceClass',
        'psvBadgeNumber', 'psvBadgeExpiry', 'psvBadgeDocUrl',
        'panNumber', 'panDocUrl',
      ];

      const kycUpdate = {};
      for (const key of ALLOWED_KYC) {
        if (req.body.kyc?.[key] !== undefined) {
          kycUpdate[`kyc.${key}`] = req.body.kyc[key];
        }
      }

      if (Object.keys(kycUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No KYC fields provided.' });
      }

      // Reset to Pending for admin re-review
      kycUpdate['kyc.verificationStatus'] = 'Pending';
      kycUpdate['kyc.rejectionReason']    = null;
      kycUpdate['kyc.submittedAt']        = new Date();
      kycUpdate['kyc.isVerified']         = false;

      await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: kycUpdate },
        { runValidators: true }
      );

      audit({
        level: 'info', category: 'kyc',
        message: 'Driver submitted KYC documents',
        actor: actor(req),
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.status(200).json({
        success: true,
        message: 'KYC documents submitted. Pending admin review.',
        data:    { kycStatus: 'Pending' },
      });
    } catch (err) {
      console.error('[PATCH /kyc]', err.message);
      return res.status(500).json({ success: false, message: 'KYC submission failed.' });
    }
  }
);

/**
 * GET /driver/medical
 * Own medical fitness certificate details.
 */
router.get('/medical', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('medicalFitness')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.medicalFitness });
  } catch (err) {
    console.error('[GET /medical]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load medical fitness.' });
  }
});

/**
 * PATCH /driver/medical
 * Submit or update medical fitness certificate.
 * Auto-sets isValid based on expiryDate.
 */
router.patch(
  '/medical',
  mutationLimiter,
  [
    body('certificateNumber').optional().isString().trim(),
    body('issuedBy').optional().isString().trim(),
    body('issuedAt').optional().isISO8601().withMessage('issuedAt must be valid ISO date'),
    body('expiryDate').optional().isISO8601().withMessage('expiryDate must be valid ISO date'),
    body('documentUrl').optional().isURL().withMessage('documentUrl must be a valid URL'),
    body('bloodGroup')
      .optional()
      .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'])
      .withMessage('Invalid blood group'),
    validate,
  ],
  async (req, res) => {
    try {
      const ALLOWED_MED = ['certificateNumber', 'issuedBy', 'issuedAt', 'expiryDate', 'documentUrl', 'bloodGroup'];
      const medUpdate = {};
      for (const key of ALLOWED_MED) {
        if (req.body[key] !== undefined) medUpdate[`medicalFitness.${key}`] = req.body[key];
      }

      if (Object.keys(medUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No medical fields provided.' });
      }

      // Auto-derive isValid from expiryDate
      if (medUpdate['medicalFitness.expiryDate']) {
        medUpdate['medicalFitness.isValid'] = new Date(medUpdate['medicalFitness.expiryDate']) > new Date();
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: medUpdate },
        { new: true, runValidators: true }
      ).select('medicalFitness').lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      return res.status(200).json({
        success: true,
        message: 'Medical fitness updated.',
        data:    driver.medicalFitness,
      });
    } catch (err) {
      console.error('[PATCH /medical]', err.message);
      return res.status(500).json({ success: false, message: 'Medical update failed.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §D  BANK DETAILS ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/bank
 * Own bank details — raw account number excluded (only last4 returned).
 */
router.get('/bank', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('bankDetails.accountLast4 bankDetails.accountHolderName bankDetails.ifscCode bankDetails.bankName bankDetails.upiId bankDetails.isBankVerified')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.bankDetails });
  } catch (err) {
    console.error('[GET /bank]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load bank details.' });
  }
});

/**
 * PATCH /driver/bank
 * Update bank or UPI details.
 * Changing account number auto-resets isBankVerified → false (re-verification needed).
 */
router.patch(
  '/bank',
  mutationLimiter,
  [...bankRules, validate],
  async (req, res) => {
    try {
      const ALLOWED_BANK = ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName', 'upiId'];
      const bankUpdate = {};

      for (const key of ALLOWED_BANK) {
        if (req.body.bankDetails?.[key] !== undefined) {
          bankUpdate[`bankDetails.${key}`] = req.body.bankDetails[key];
        }
      }

      if (Object.keys(bankUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No bank fields provided.' });
      }

      // Account number change → re-verification required
      if (bankUpdate['bankDetails.accountNumber']) {
        bankUpdate['bankDetails.isBankVerified'] = false;
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: bankUpdate },
        { new: true, runValidators: true }
      ).select('bankDetails.accountLast4 bankDetails.bankName bankDetails.isBankVerified').lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      audit({
        level: 'info', category: 'payment',
        message: 'Driver updated bank details',
        actor: actor(req),
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.status(200).json({
        success: true,
        message: 'Bank details updated. Verification pending.',
        data: {
          accountLast4:   driver.bankDetails.accountLast4,
          bankName:       driver.bankDetails.bankName,
          isBankVerified: driver.bankDetails.isBankVerified,
        },
      });
    } catch (err) {
      console.error('[PATCH /bank]', err.message);
      return res.status(500).json({ success: false, message: 'Bank update failed.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §E  EARNINGS & REWARDS ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/earnings
 * Earnings summary: total earnings, rides, monthly rides, coin balance, tier.
 */
router.get('/earnings', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'performance.totalEarnings performance.totalRidesCompleted ' +
        'performance.monthlyRides performance.totalRidesCancelled ' +
        'performance.avgPickupTimeMinutes performance.totalDistanceKm ' +
        'rewards.coinBalance rewards.totalCoinsEarned rewards.totalCoinsRedeem rewards.tier'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver });
  } catch (err) {
    console.error('[GET /earnings]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load earnings.' });
  }
});

/**
 * GET /driver/coin-transactions
 * Paginated coin transaction history (newest first).
 */
router.get(
  '/coin-transactions',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page >= 1'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit 1-50'),
    query('type')
      .optional()
      .isIn(['EARN', 'REDEEM', 'EXPIRE', 'BONUS', 'ADMIN_CREDIT', 'ADMIN_DEBIT'])
      .withMessage('Invalid transaction type'),
    validate,
  ],
  async (req, res) => {
    try {
      const { page, limit, skip } = parsePagination(req.query);
      const typeFilter = req.query.type;

      const driver = await Driver.findOne({ user: req.user._id })
        .select('rewards.coinBalance rewards.tier rewards.coinTransactions')
        .lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      let txns = (driver.rewards?.coinTransactions ?? []).reverse(); // newest first
      if (typeFilter) txns = txns.filter((t) => t.type === typeFilter);

      const total = txns.length;
      const page_ = txns.slice(skip, skip + limit);

      return res.status(200).json({
        success: true,
        data: {
          coinBalance:  driver.rewards.coinBalance,
          tier:         driver.rewards.tier,
          transactions: page_,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext:    skip + limit < total,
          hasPrev:    page > 1,
        },
      });
    } catch (err) {
      console.error('[GET /coin-transactions]', err.message);
      return res.status(500).json({ success: false, message: 'Failed to load transactions.' });
    }
  }
);

/**
 * GET /driver/badges
 * Own badges + reward tier.
 */
router.get('/badges', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('rewards.badges rewards.tier rewards.tierUpdatedAt')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.rewards });
  } catch (err) {
    console.error('[GET /badges]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load badges.' });
  }
});

/**
 * GET /driver/performance
 * Full performance object: rating, rides, cancellation rate, tier, etc.
 */
router.get('/performance', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('performance rewards.tier rewards.badges driverCode')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver });
  } catch (err) {
    console.error('[GET /performance]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load performance.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── §F  ONBOARDING & SETTINGS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/onboarding
 * Onboarding checklist: 6 checks, overall completion flag.
 */
router.get('/onboarding', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'onboarding kyc.verificationStatus medicalFitness.isValid ' +
        'bankDetails.isBankVerified assignedVehicleSnapshot profileCompletionPercent'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    const checklist = {
      profileComplete:  driver.profileCompletionPercent >= 80,
      kycVerified:      driver.kyc?.verificationStatus === 'Verified',
      medicalValid:     driver.medicalFitness?.isValid === true,
      bankLinked:       !!driver.bankDetails?.isBankVerified,
      vehicleAssigned:  !!driver.assignedVehicleSnapshot?.registrationNumber,
      agreedToTerms:    !!driver.onboarding?.agreedToTermsAt,
    };

    const isOnboardingComplete = Object.values(checklist).every(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        onboarding:               driver.onboarding,
        checklist,
        profileCompletionPercent: driver.profileCompletionPercent,
        isOnboardingComplete,
      },
    });
  } catch (err) {
    console.error('[GET /onboarding]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load onboarding.' });
  }
});

/**
 * POST /driver/onboarding/accept-terms
 * Record T&C acceptance — idempotent.
 * Stores timestamp + IP for legal audit trail.
 */
router.post(
  '/onboarding/accept-terms',
  mutationLimiter,
  async (req, res) => {
    try {
      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id, 'onboarding.agreedToTermsAt': null },
        {
          $set: {
            'onboarding.agreedToTermsAt': new Date(),
            'onboarding.agreedToTermsIp': req.ip,
          },
        },
        { new: true }
      ).select('onboarding');

      if (!driver) {
        // Already accepted — idempotent OK
        return res.status(200).json({ success: true, message: 'Terms already accepted.' });
      }

      audit({
        level: 'info', category: 'user',
        message: 'Driver accepted terms and conditions',
        actor: actor(req),
        request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
        metadata: { ip: req.ip, at: driver.onboarding.agreedToTermsAt },
      });

      return res.status(200).json({
        success: true,
        message: 'Terms accepted.',
        data:    { acceptedAt: driver.onboarding.agreedToTermsAt },
      });
    } catch (err) {
      console.error('[POST /onboarding/accept-terms]', err.message);
      return res.status(500).json({ success: false, message: 'Failed to record terms acceptance.' });
    }
  }
);

/**
 * PATCH /driver/notification-preferences
 * Toggle SMS / WhatsApp / push notification channels.
 */
router.patch(
  '/notification-preferences',
  [
    body('smsAlerts').optional().isBoolean().withMessage('smsAlerts must be boolean'),
    body('whatsappAlerts').optional().isBoolean().withMessage('whatsappAlerts must be boolean'),
    body('pushNotifications').optional().isBoolean().withMessage('pushNotifications must be boolean'),
    validate,
  ],
  async (req, res) => {
    try {
      const { smsAlerts, whatsappAlerts, pushNotifications } = req.body;
      const update = {};
      if (smsAlerts        !== undefined) update['notifPrefs.smsAlerts']        = smsAlerts;
      if (whatsappAlerts   !== undefined) update['notifPrefs.whatsappAlerts']   = whatsappAlerts;
      if (pushNotifications !== undefined) update['notifPrefs.pushNotifications'] = pushNotifications;

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ success: false, message: 'No preferences provided.' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: update },
        { new: true }
      ).select('notifPrefs').lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      return res.status(200).json({
        success: true,
        message: 'Notification preferences updated.',
        data:    driver.notifPrefs,
      });
    } catch (err) {
      console.error('[PATCH /notification-preferences]', err.message);
      return res.status(500).json({ success: false, message: 'Update failed.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §G  READ-ONLY LOOKUPS ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /driver/vehicle
 * Current assigned vehicle snapshot + agency info.
 */
router.get('/vehicle', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('assignedVehicleId assignedVehicleSnapshot ownerAgency')
      .populate('ownerAgency', 'businessName slug ownerPhone')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    if (!driver.assignedVehicleSnapshot?.registrationNumber) {
      return res.status(200).json({
        success: true,
        data:    null,
        message: 'No vehicle assigned.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        vehicleId:       driver.assignedVehicleId,
        snapshot:        driver.assignedVehicleSnapshot,
        agency:          driver.ownerAgency,
      },
    });
  } catch (err) {
    console.error('[GET /vehicle]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load vehicle.' });
  }
});

/**
 * GET /driver/agency
 * Own agency info (read-only — driver cannot change agency).
 */
router.get('/agency', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('ownerAgency')
      .populate(
        'ownerAgency',
        'businessName slug ownerName ownerPhone ownerEmail partnershipStatus ' +
        'registeredAddress.city registeredAddress.state availabilityHours notifications'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    if (!driver.ownerAgency) {
      return res.status(200).json({ success: true, data: null, message: 'No agency linked.' });
    }

    return res.status(200).json({ success: true, data: driver.ownerAgency });
  } catch (err) {
    console.error('[GET /agency]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load agency info.' });
  }
});

/**
 * GET /driver/compliance
 * Own compliance overview — DL, PSV, medical expiry status at a glance.
 */
router.get('/compliance', async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'kyc.drivingLicenceNumber kyc.drivingLicenceExpiry kyc.verificationStatus ' +
        'kyc.psvBadgeNumber kyc.psvBadgeExpiry ' +
        'medicalFitness.expiryDate medicalFitness.isValid medicalFitness.bloodGroup'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    const now  = new Date();
    const soon = new Date(Date.now() + 30 * 86400000);

    const expiry = (date) => {
      if (!date) return { status: 'not-set', daysLeft: null };
      const d = new Date(date);
      if (d < now)  return { status: 'expired',  daysLeft: 0 };
      if (d < soon) return { status: 'expiring', daysLeft: Math.ceil((d - now) / 86400000) };
      return         { status: 'valid',   daysLeft: Math.ceil((d - now) / 86400000) };
    };

    return res.status(200).json({
      success: true,
      data: {
        kycStatus:         driver.kyc.verificationStatus,
        drivingLicence: {
          number:  driver.kyc.drivingLicenceNumber,
          expiry:  driver.kyc.drivingLicenceExpiry,
          ...expiry(driver.kyc.drivingLicenceExpiry),
        },
        psvBadge: {
          number:  driver.kyc.psvBadgeNumber,
          expiry:  driver.kyc.psvBadgeExpiry,
          ...expiry(driver.kyc.psvBadgeExpiry),
        },
        medicalFitness: {
          expiry:     driver.medicalFitness?.expiryDate,
          isValid:    driver.medicalFitness?.isValid,
          bloodGroup: driver.medicalFitness?.bloodGroup,
          ...expiry(driver.medicalFitness?.expiryDate),
        },
        hasExpiringCompliance: (
          expiry(driver.kyc.drivingLicenceExpiry).status === 'expiring' ||
          expiry(driver.kyc.psvBadgeExpiry).status       === 'expiring' ||
          expiry(driver.medicalFitness?.expiryDate).status === 'expiring'
        ),
      },
    });
  } catch (err) {
    console.error('[GET /compliance]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load compliance.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── §H  ROUTER-LEVEL ERROR HANDLER ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

router.use((err, req, res, _next) => {
  console.error('[driverSelfRouter error]', {
    message: err.message,
    stack:   err.stack,
    path:    req.originalUrl,
    method:  req.method,
  });

  audit({
    level: 'error', category: 'api',
    message: `Unhandled error in driverSelfRouter: ${err.message}`,
    actor: actor(req),
    request: { method: req.method, path: req.originalUrl, statusCode: 500 },
    details: err.stack,
  });

  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
    ...(process.env.NODE_ENV === 'development' ? { error: err.message } : {}),
  });
});

export default router;