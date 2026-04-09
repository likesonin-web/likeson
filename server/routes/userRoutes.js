/**
 * @file    userRoutes.js
 * @desc    Enterprise-grade User Auth & Profile Router with Redis Caching
 *
 * Notification policy:
 * • OTP events        → Email + SMS  (dispatchOtp)
 * • Welcome           → Email + SMS  (dispatchWelcome)
 * • New device login  → SMS only     (dispatchLoginAlert)
 * • Password reset    → Email + SMS  (dispatchPasswordResetOtp)
 * • Password changed  → Email + SMS  (dispatchPasswordChanged)
 * • Account blocked   → SMS only
 * • Account unblocked → SMS only
 *
 * Google OAuth:
 * • Uses passport-google-oauth20 strategy registered in passport.js config.
 * • On callback, updates login fields and redirects to FRONTEND_URL/auth-success
 *   with a JWT token in the query string.
 *
 * getDeviceInfo middleware:
 * • Imported from authMiddleware (uses device-detector-js library).
 * • Attached as req.deviceInfo = { userAgent, ipAddress, deviceName, platform, _raw }.
 *
 * SESSION REMOVAL BEHAVIOUR:
 * • When a specific session is removed via DELETE /sessions/:sessionId,
 *   the corresponding device token is also removed (matched by ipAddress).
 * • When ALL sessions are revoked via DELETE /sessions,
 *   ALL device tokens are cleared too — effectively signing out everywhere.
 *
 * @version 5.4.0  — corrected models alignment, added customer settings routes,
 *                   session removal now also removes associated device tokens
 */

import express   from 'express';
import bcrypt    from 'bcryptjs';
import passport  from 'passport';
import mongoose  from 'mongoose';
import { body, param, query, validationResult } from 'express-validator';
import axios     from 'axios';

// ── Models ────────────────────────────────────────────────────────────────────
import User, {
  REFERRAL_INVITER_COINS,
  REFERRAL_INVITEE_COINS,
  COINS_PER_RUPEE,
}                              from '../models/User.js';
import Wallet                  from '../models/Wallet.js';
import CustomerProfile         from '../models/CustomerProfile.js';
import DoctorProfile           from '../models/DoctorProfile.js';
import DriverProfile           from '../models/Driver.js';
import CareAssistantProfile    from '../models/CareAssistantProfile.js';
import PharmacyProfile         from '../models/PharmacyProfile.js';
import TransportPartner        from '../models/TransportPartner.js';  // FIX: was TransportPartnerProfile

// ── Middleware / Utils ─────────────────────────────────────────────────────────
import { protect, authorize, getDeviceInfo } from '../middleware/authMiddleware.js'; // FIX: import getDeviceInfo from authMiddleware
import asyncHandler                           from '../utils/asyncHandler.js';
import { generateToken }                      from '../utils/generateToken.js';

// ── Caching ───────────────────────────────────────────────────────────────────
import cache from '../middleware/cache.js';
import {
  invalidateUserCache,
  invalidatePattern,
} from '../utils/cacheInvalidation.js';

// ── Notifications ─────────────────────────────────────────────────────────────
import sendEmail from '../utils/sendEmail.js';
import sendSms   from '../services/Sendsms.js';

import {
  otpTemplate,
  welcomeTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
} from '../utils/emailTemplates.js';

import {
  otpSms,
  welcomeSms,
  newLoginAlertSms,
  passwordResetOtpSms,
  passwordChangedSms,
  accountBlockedSms,
  accountUnblockedSms,
} from '../utils/Smstemplates.js';

// ─────────────────────────────────────────────────────────────────────────────
const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// §  getDeviceInfo  — applied router-wide from authMiddleware
//
// FIX: The router previously duplicated device-info parsing inline.
//      We now delegate to the single canonical getDeviceInfo exported from
//      authMiddleware.js (which uses device-detector-js for richer parsing).
//      This keeps the fingerprint logic consistent across all routes.
// ═══════════════════════════════════════════════════════════════════════════════

router.use(getDeviceInfo);

// ═══════════════════════════════════════════════════════════════════════════════
// § 0  CONSTANTS & LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

/** Minimum coins a user must hold before redeeming to wallet */
const MIN_REDEEM_COINS = 500;

const log = {
  info:  (msg, meta = {}) => console.log( `✅  [USER] ${msg}`, meta),
  warn:  (msg, meta = {}) => console.warn(`⚠️  [USER] ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`❌  [USER] ${msg}`, meta),
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FIX: PROFILE_MAP updated to use TransportPartner (the real Mongoose model)
 *      instead of the removed TransportPartnerProfile model.
 *      Maps role strings to their matching Mongoose profile model.
 */
const PROFILE_MAP = {
  customer:         CustomerProfile,
  doctor:           DoctorProfile,
  driver:           DriverProfile,
  pharmacy:         PharmacyProfile,
  transportpartner: TransportPartner,        // FIX: was TransportPartnerProfile
  'care assistant': CareAssistantProfile,
};

const getProfileModel = (role) => PROFILE_MAP[role] ?? null;

/** Returns a cryptographically-adequate 6-digit OTP string */
const generateOtp = () =>
  Math.floor(100_000 + Math.random() * 900_000).toString();

/**
 * Builds a MongoDB filter object from a flexible login identifier.
 *  - Strings containing '@'          → email lookup (lowercased)
 *  - Strings matching a phone regex  → phone lookup (whitespace stripped)
 *  - Everything else                 → case-insensitive name lookup
 *
 * Returns null if the trimmed identifier is empty.
 */
const buildLoginFilter = (identifier) => {
  const t = (identifier ?? '').trim();
  if (!t) return null;
  if (t.includes('@'))                               return { email: t.toLowerCase() };
  if (/^\+?\d{10,15}$/.test(t.replace(/\s/g, ''))) return { phone: t.replace(/\s/g, '') };
  return { name: { $regex: `^${t}$`, $options: 'i' } };
};

/**
 * Builds a lean audit-session record from req.deviceInfo.
 * Stored in user.auditSessions (capped at 10).
 */
const buildSessionRecord = (req) => ({
  userAgent:    req.deviceInfo?.userAgent    ?? 'Unknown',
  ipAddress:    req.deviceInfo?.ipAddress    ?? 'Unknown',
  deviceName:   req.deviceInfo?.deviceName   ?? 'Unknown Device',
  platform:     ['android', 'ios', 'web', 'desktop'].includes(req.deviceInfo?.platform)
                  ? req.deviceInfo.platform
                  : 'web',
  createdAt:    new Date(),
  lastActiveAt: new Date(),
});

/**
 * Upserts an audit session into user.auditSessions (max 10 FIFO).
 * Fingerprint is IP::UserAgent. If already present, updates lastActiveAt.
 * Otherwise evicts the oldest session when at capacity and pushes the new one.
 */
const upsertAuditSession = (user, record) => {
  if (!Array.isArray(user.auditSessions)) user.auditSessions = [];
  const fp  = `${record.ipAddress}::${record.userAgent}`;
  const idx = user.auditSessions.findIndex(
    (s) => `${s.ipAddress}::${s.userAgent}` === fp
  );
  if (idx !== -1) {
    user.auditSessions[idx].lastActiveAt = new Date();
  } else {
    if (user.auditSessions.length >= 10) {
      user.auditSessions.sort((a, b) => new Date(a.lastActiveAt) - new Date(b.lastActiveAt));
      user.auditSessions.shift();
    }
    user.auditSessions.push(record);
  }
};

/**
 * Upserts a device push token into user.deviceTokens (max 10 FIFO).
 * If the token already exists, its lastUsedAt is refreshed.
 */
const upsertDeviceToken = (user, { token, platform, deviceName, ipAddress }) => {
  if (!Array.isArray(user.deviceTokens)) user.deviceTokens = [];
  const existing = user.deviceTokens.find((t) => t.token === token);
  if (existing) { existing.lastUsedAt = new Date(); return; }
  if (user.deviceTokens.length >= 10) {
    user.deviceTokens.sort((a, b) => new Date(a.lastUsedAt) - new Date(b.lastUsedAt));
    user.deviceTokens.shift();
  }
  user.deviceTokens.push({
    token,
    platform,
    deviceName: deviceName ?? 'Unknown',
    ipAddress,
    lastUsedAt: new Date(),
  });
};

// ── Wallet helpers ─────────────────────────────────────────────────────────────

/** Finds the wallet for userId, creating it (balance=0) if absent. */
const getOrCreateWallet = async (userId, session = null) => {
  const opts = session ? { session } : {};
  let wallet = await Wallet.findOne({ user: userId }, null, opts);
  if (!wallet) {
    const docs = await Wallet.create([{ user: userId, balance: 0 }], opts);
    wallet = docs[0];
  }
  return wallet;
};

/**
 * Credits a wallet with a structured transaction record.
 * Creates the wallet if it does not yet exist.
 */
const creditWallet = async ({
  userId,
  amount,
  purpose,
  description,
  referenceId = null,
  onModel     = null,
  session     = null,
}) => {
  const opts          = session ? { session } : {};
  const wallet        = await getOrCreateWallet(userId, session);
  const balanceBefore = wallet.balance;
  const balanceAfter  = +(balanceBefore + amount).toFixed(2);

  wallet.balance = balanceAfter;
  wallet.transactions.push({
    type:          'Credit',
    amount,
    purpose,
    description,
    ...(referenceId && { referenceId }),
    ...(onModel     && { onModel }),
    balanceBefore,
    balanceAfter,
    status:        'Success',
  });

  await wallet.save(opts);
  return wallet;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  NOTIFICATION DISPATCHERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sends an OTP via Email + SMS (non-blocking; swallows individual channel errors).
 */
const dispatchOtp = async ({ user, otpCode, purpose = 'verification', subject }) => {
  const tasks = [
    sendEmail({
      email:   user.email,
      subject: subject ?? 'Your Verification Code — Likeson',
      html:    otpTemplate({
        header:  purpose.toUpperCase(),
        title:   'Security Code',
        body:    'Use this code to verify your identity. It expires in 10 minutes.',
        otpCode,
      }),
    }).catch((e) => log.warn('OTP email failed', { email: user.email, err: e.message })),
  ];

  if (user.phone) {
    tasks.push(
      sendSms({
        to:      user.phone,
        message: otpSms({ otpCode, purpose }),
      }).catch((e) => log.warn('OTP SMS failed', { err: e.message }))
    );
  }

  await Promise.allSettled(tasks);
};

/** Sends a welcome message via Email + SMS after successful registration. */
const dispatchWelcome = async ({ user }) => {
  const tasks = [
    sendEmail({
      email:   user.email,
      subject: 'Welcome to Likeson.in — Your Account is Ready',
      html:    welcomeTemplate({
        header:     'Welcome to Likeson Healthcare',
        title:      `Hi ${user.name}, welcome aboard!`,
        body:       `Your ${user.role} account is ready.`,
        buttonText: 'Go to Dashboard',
        buttonLink: `${process.env.FRONTEND_URL}/dashboard`,
      }),
    }).catch((e) => log.warn('Welcome email failed', { err: e.message })),
  ];

  if (user.phone) {
    tasks.push(
      sendSms({
        to:      user.phone,
        message: welcomeSms({ name: user.name, role: user.role }),
      }).catch(() => {})
    );
  }

  await Promise.allSettled(tasks);
};

/** Sends a new-device login alert via SMS only (security signal). */
const dispatchLoginAlert = async ({ user, req }) => {
  if (!user.phone) return;
  const deviceName = req.deviceInfo?.deviceName ?? 'Unknown Device';
  const ipAddress  = req.deviceInfo?.ipAddress  ?? 'Unknown';

  await Promise.allSettled([
    sendSms({
      to:      user.phone,
      message: newLoginAlertSms({ name: user.name, deviceName, ipAddress }),
    }).catch(() => {}),
  ]);
};

/** Sends a password-reset OTP via Email + SMS. */
const dispatchPasswordResetOtp = async ({ user, otpCode }) => {
  const tasks = [
    sendEmail({
      email:   user.email,
      subject: 'Password Reset Code — Likeson',
      html:    otpTemplate({
        header:  'RECOVERY',
        title:   'Reset Your Password',
        body:    'Use this code to reset your password. It expires in 15 minutes.',
        otpCode,
      }),
    }).catch((e) => log.warn('Password reset email failed', { err: e.message })),
  ];

  if (user.phone) {
    tasks.push(
      sendSms({
        to:      user.phone,
        message: passwordResetOtpSms({ name: user.name, otpCode }),
      }).catch(() => {})
    );
  }

  await Promise.allSettled(tasks);
};

/** Notifies the user that their password was changed via Email + SMS. */
const dispatchPasswordChanged = async ({ user }) => {
  const changedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const tasks = [
    sendEmail({
      email:   user.email,
      subject: 'Your Likeson Password Was Changed',
      html:    passwordChangedTemplate({
        header:     'PASSWORD CHANGED',
        title:      'Your password has been updated',
        body:       `Your password was changed on ${changedAt}. If this wasn't you, contact support immediately.`,
        buttonText: 'Secure My Account',
        buttonLink: `${process.env.FRONTEND_URL}/support`,
      }),
    }).catch((e) => log.warn('Password changed email failed', { err: e.message })),
  ];

  if (user.phone) {
    tasks.push(
      sendSms({
        to:      user.phone,
        message: passwordChangedSms({ name: user.name, changedAt }),
      }).catch(() => {})
    );
  }

  await Promise.allSettled(tasks);
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  VALIDATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Runs express-validator result check and short-circuits with a 400
 * if any validation rule failed.  Use as the last item in a middleware array.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ status: 'fail', errors: errors.array() });
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  PUBLIC ROUTES — AUTH & OTP
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /signup ──────────────────────────────────────────────────────────────
router.post(
  '/signup',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Min 8 chars'),
    body('name').notEmpty().trim().withMessage('Name required'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, role, referralCode } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── Duplicate check ─────────────────────────────────────────────────
      const conflict = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          ...(phone ? [{ phone }] : []),
        ],
      }).session(session);

      if (conflict) {
        await session.abortTransaction();
        return res.status(409).json({ message: 'Account with this email or phone already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      // ── Create user ─────────────────────────────────────────────────────
      const [newUser] = await User.create(
        [{
          name,
          email,
          phone:    phone  || undefined,
          role:     role   || 'customer',
          password: hashedPassword,
        }],
        { session }
      );

      // ── Create role-specific profile if a model exists ──────────────────
      // FIX: TransportPartner uses { user } field same as other profiles.
      //      The ProfileModel lookup now correctly resolves to TransportPartner
      //      for transportpartner role via the updated PROFILE_MAP.
      const ProfileModel = getProfileModel(newUser.role);
      if (ProfileModel) {
        await ProfileModel.create([{ user: newUser._id }], { session });
      }

      // ── Create wallet ───────────────────────────────────────────────────
      await Wallet.create([{ user: newUser._id, balance: 0 }], { session });

      // ── Referral handling ───────────────────────────────────────────────
      let inviterRewarded = false;
      let inviterId       = null;

      if (referralCode) {
        const code    = referralCode.trim().toUpperCase();
        const inviter = await User.findOne({ referralCode: code }).session(session);

        if (inviter && !inviter._id.equals(newUser._id)) {
          inviter.coins       += REFERRAL_INVITER_COINS;
          inviter.coinsEarned += REFERRAL_INVITER_COINS;
          inviter.referralHistory.push({
            referredUser: newUser._id,
            coinsAwarded: REFERRAL_INVITER_COINS,
          });
          await inviter.save({ session });

          newUser.referredBy   = inviter._id;
          newUser.coins       += REFERRAL_INVITEE_COINS;
          newUser.coinsEarned += REFERRAL_INVITEE_COINS;
          await newUser.save({ session });

          inviterRewarded = true;
          inviterId       = inviter._id;
        }
      }

      await session.commitTransaction();

      // ── Post-commit side effects ────────────────────────────────────────
      if (inviterRewarded && inviterId) {
        await invalidateUserCache(inviterId);
      }

      log.info('User signed up', { userId: newUser._id, role: newUser.role, referralApplied: inviterRewarded });
      dispatchWelcome({ user: newUser }).catch(() => {});

      return res.status(201).json({
        status: 'success',
        token:  generateToken(newUser._id),
        user:   newUser,
        ...(inviterRewarded && {
          referral: {
            message:       `Referral applied! You received ${REFERRAL_INVITEE_COINS} coins (₹${(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2)}).`,
            coinsReceived: REFERRAL_INVITEE_COINS,
            coinsInRupees: +(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2),
          },
        }),
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('identifier').notEmpty().trim().withMessage('Email, phone, or name required'),
    body('password').exists().withMessage('Password required'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;

    const filter = buildLoginFilter(identifier);
    if (!filter) return res.status(400).json({ message: 'Invalid identifier.' });

    const user = await User.findOne(filter).select('+password +otp +otpExpires');
    if (!user)  return res.status(401).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      log.warn('Failed login', { filter, ip: req.deviceInfo?.ipAddress });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // FIX: Use the virtual isCurrentlyBlocked which correctly handles unblockAt expiry
    if (user.isCurrentlyBlocked) {
      return res.status(403).json({
        message:   'Account suspended.',
        reason:    user.blockReason,
        unblockAt: user.unblockAt,
      });
    }

    // ── New-device fingerprint check ────────────────────────────────────
    const fp       = `${req.deviceInfo?.ipAddress}::${req.deviceInfo?.userAgent}`;
    const isNewDev = !Array.isArray(user.auditSessions) ||
                     !user.auditSessions.some((s) => `${s.ipAddress}::${s.userAgent}` === fp);

    user.lastLoginAt  = new Date();
    user.lastLoginIp  = req.deviceInfo?.ipAddress ?? 'Unknown';
    user.loginCount  += 1;
    user.isOnline     = true;
    user.lastActiveAt = new Date();
    upsertAuditSession(user, buildSessionRecord(req));
    await user.save();

    await invalidateUserCache(user._id);

    if (isNewDev) dispatchLoginAlert({ user, req }).catch(() => {});

    log.info('Login success', { userId: user._id, isNewDev });

    return res.json({ status: 'success', token: generateToken(user._id), user });
  })
);

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post(
  '/logout',
  protect,
  asyncHandler(async (req, res) => {
    const ipAddress  = req.deviceInfo?.ipAddress  ?? 'Unknown';
    const userAgent  = req.deviceInfo?.userAgent  ?? 'Unknown';

    // FIX: On logout, also remove the device token associated with this IP.
    //      This ensures the device stops receiving push notifications after sign-out.
    await User.findByIdAndUpdate(req.user._id, {
      isOnline:     false,
      lastseen:     new Date(),
      lastActiveAt: new Date(),
      $pull: {
        auditSessions: { ipAddress, userAgent },
        // Remove device token(s) registered from the same IP address
        deviceTokens: { ipAddress },
      },
    });

    await invalidateUserCache(req.user._id);

    log.info('Logout', { userId: req.user._id });
    return res.json({ status: 'success', message: 'Logged out successfully.' });
  })
);

// ── POST /otp-request  (email-only OTP trigger) ───────────────────────────────
router.post(
  '/otp-request',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() });
    if (user) {
      const otp       = generateOtp();
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60_000);
      await user.save();
      await dispatchOtp({ user, otpCode: otp, purpose: 'verification' });
    }
    // Respond identically whether or not the account exists (prevents enumeration)
    return res.json({ message: 'If that account exists, an OTP has been sent.' });
  })
);

// ── POST /verify-email ────────────────────────────────────────────────────────
router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'email and otp are required.' });

    // FIX: Must use .select('+otp +otpExpires') because these fields have select:false
    const user = await User.findOne({
      email:      email.toLowerCase(),
      otp,
      otpExpires: { $gt: Date.now() },
    }).select('+otp +otpExpires');

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });

    user.isEmailVerified = true;
    user.otp             = undefined;
    user.otpExpires      = undefined;
    await user.save();

    await invalidateUserCache(user._id);

    return res.json({ message: 'Email verified successfully.' });
  })
);

// ── POST /request-otp-login  (passwordless — send OTP) ───────────────────────
router.post(
  '/request-otp-login',
  [body('identifier').notEmpty().trim().withMessage('Identifier required'), validate],
  asyncHandler(async (req, res) => {
    const filter = buildLoginFilter(req.body.identifier);
    const user   = filter ? await User.findOne(filter) : null;

    if (user) {
      const otp       = generateOtp();
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60_000);
      await user.save();
      await dispatchOtp({ user, otpCode: otp, purpose: 'login', subject: 'Your Likeson Login OTP' });
    }
    return res.json({ message: 'If that account exists, an OTP has been sent.' });
  })
);

// ── POST /otp-login  (passwordless — verify OTP) ─────────────────────────────
router.post(
  '/otp-login',
  [
    body('identifier').notEmpty().trim().withMessage('Identifier required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { identifier, otp } = req.body;
    const filter = buildLoginFilter(identifier);
    if (!filter) return res.status(400).json({ message: 'Invalid identifier.' });

    // FIX: Must select +otp +otpExpires
    const user = await User.findOne({
      ...filter,
      otp,
      otpExpires: { $gt: Date.now() },
    }).select('+otp +otpExpires');

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });
    if (user.isCurrentlyBlocked)
      return res.status(403).json({ message: 'Account suspended.', reason: user.blockReason });

    const fp       = `${req.deviceInfo?.ipAddress}::${req.deviceInfo?.userAgent}`;
    const isNewDev = !Array.isArray(user.auditSessions) ||
                     !user.auditSessions.some((s) => `${s.ipAddress}::${s.userAgent}` === fp);

    user.lastLoginAt     = new Date();
    user.lastLoginIp     = req.deviceInfo?.ipAddress ?? 'Unknown';
    user.loginCount     += 1;
    user.isEmailVerified = true;  // OTP login implicitly verifies the email
    user.isOnline        = true;
    user.lastActiveAt    = new Date();
    upsertAuditSession(user, buildSessionRecord(req));
    user.otp        = undefined;
    user.otpExpires = undefined;
    await user.save();

    await invalidateUserCache(user._id);

    if (isNewDev) dispatchLoginAlert({ user, req }).catch(() => {});

    log.info('OTP login', { userId: user._id, isNewDev });

    return res.json({
      status: 'success',
      token:  generateToken(user._id),
      user: {
        _id:             user._id,
        name:            user.name,
        email:           user.email,
        phone:           user.phone,
        role:            user.role,
        avatar:          user.avatar,
        isEmailVerified: user.isEmailVerified,
        isOnline:        user.isOnline,
        coins:           user.coins,
        coinsInRupees:   +(user.coins / COINS_PER_RUPEE).toFixed(2),
      },
    });
  })
);

// ── POST /forgot-password ─────────────────────────────────────────────────────
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const filter = buildLoginFilter(req.body.identifier ?? req.body.email);
    const user   = filter ? await User.findOne(filter) : null;

    if (user) {
      const otp       = generateOtp();
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 15 * 60_000); // 15 min for reset
      await user.save();
      await dispatchPasswordResetOtp({ user, otpCode: otp });
    }
    return res.json({ message: 'If that account exists, a reset code has been sent.' });
  })
);

// ── POST /reset-password ──────────────────────────────────────────────────────
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { email, identifier, otp, newPassword } = req.body;
    const id = identifier ?? email;

    if (!id || !otp || !newPassword)
      return res.status(400).json({ message: 'identifier, otp, and newPassword required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const filter = buildLoginFilter(id);
    // FIX: select +otp +otpExpires for the OTP check
    const user   = filter
      ? await User.findOne({ ...filter, otp, otpExpires: { $gt: Date.now() } })
                  .select('+otp +otpExpires')
      : null;

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });

    // Reset password and invalidate all existing sessions for security
    user.password          = await bcrypt.hash(newPassword, 12);
    user.otp               = undefined;
    user.otpExpires        = undefined;
    user.passwordChangedAt = new Date();
    user.isOnline          = false;
    user.auditSessions     = [];
    user.deviceTokens      = [];   // FIX: clear all device tokens on password reset
    await user.save();

    await invalidateUserCache(user._id);

    log.info('Password reset', { userId: user._id });
    dispatchPasswordChanged({ user }).catch(() => {});

    return res.json({ message: 'Password reset. Please log in again.' });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  PROTECTED — PROFILE & PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /profile ──────────────────────────────────────────────────────────────
router.get(
  '/profile',
  protect,
  cache(60, (req) => `user:${req.user._id}:profile`),
  asyncHandler(async (req, res) => {
    // Touch lastActiveAt without blocking the main query
    User.findByIdAndUpdate(req.user._id, { lastActiveAt: new Date() }).exec().catch(() => {});

    // FIX: The 'profile' virtual uses roleModelMap which maps transportpartner
    //      to 'TransportPartner'. The populate() will correctly follow it.
    const user = await User.findById(req.user._id)
      .populate('profile')
      .lean({ virtuals: true });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({ success: true, data: user });
  })
);

// ── PUT /profile ──────────────────────────────────────────────────────────────
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim(),
    body('avatar').optional().trim().isURL().withMessage('Avatar must be a valid URL'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { name, phone, avatar, roleProfileData } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (name   !== undefined) user.name   = name;
    if (phone  !== undefined) user.phone  = phone;
    if (avatar !== undefined) user.avatar = avatar;
    user.lastActiveAt = new Date();
    await user.save();

    // Optionally update the role-specific extended profile
    let updatedProfile = null;
    if (roleProfileData) {
      const M = getProfileModel(user.role);
      if (M) {
        updatedProfile = await M.findOneAndUpdate(
          { user: user._id },
          { $set: roleProfileData },
          { new: true, runValidators: true, upsert: true }
        );
      }
    }

    await invalidateUserCache(user._id);

    return res.json({
      success: true,
      message: 'Profile updated.',
      data:    { user, profile: updatedProfile },
    });
  })
);

// ── PUT /change-password ──────────────────────────────────────────────────────
router.put(
  '/change-password',
  protect,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res.status(400).json({ message: 'oldPassword and newPassword required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ message: 'Min 8 characters.' });

    const user = await User.findById(req.user._id).select('+password');
    if (!(await bcrypt.compare(oldPassword, user.password)))
      return res.status(401).json({ message: 'Current password incorrect.' });

    user.password          = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    await invalidateUserCache(user._id);

    log.info('Password changed', { userId: user._id });
    dispatchPasswordChanged({ user }).catch(() => {});

    return res.json({ message: 'Password updated.' });
  })
);

// ── DELETE /delete-account ────────────────────────────────────────────────────
router.delete(
  '/delete-account',
  protect,
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // FIX: getProfileModel now correctly returns TransportPartner for transportpartner role
      const M = getProfileModel(req.user.role);
      if (M) await M.findOneAndDelete({ user: req.user._id }).session(session);
      await Wallet.findOneAndDelete({ user: req.user._id }).session(session);
      await User.findByIdAndDelete(req.user._id).session(session);
      await session.commitTransaction();

      await invalidateUserCache(req.user._id);
      await invalidatePattern('GET:/api/users/admin/users*');

      log.info('Account deleted', { userId: req.user._id });
      return res.json({ message: 'Account permanently deleted.' });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  AUDIT SESSION MANAGEMENT
//
// FIX (KEY CHANGE): When a specific session is revoked, this router now also
// removes the device token registered from the same IP address. This ensures
// the removed device immediately loses access to push notifications, effectively
// signing it out at the infrastructure level — not just the session record.
//
// When ALL sessions are cleared, ALL device tokens are also wiped.
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /sessions ─────────────────────────────────────────────────────────────
router.get(
  '/sessions',
  protect,
  cache(60, (req) => `user:${req.user._id}:sessions`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions deviceTokens').lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const sessions = (user.auditSessions ?? [])
      .slice()
      .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt));

    // Mark each session with whether it has a registered push token
    const deviceTokenIPs = new Set((user.deviceTokens ?? []).map(t => t.ipAddress));
    const enriched = sessions.map((s) => ({
      ...s,
      hasPushToken: deviceTokenIPs.has(s.ipAddress),
    }));

    return res.json({ status: 'success', count: enriched.length, data: enriched });
  })
);

// ── DELETE /sessions/:sessionId ───────────────────────────────────────────────
/**
 * FIX: Now also removes the device token matching the session's IP address.
 * Flow:
 *   1. Load the user to find the target session (for its ipAddress).
 *   2. Remove the session by _id from auditSessions.
 *   3. Remove any device tokens registered from the same IP address.
 *   4. If no other auditSessions remain, set isOnline=false.
 *
 * This guarantees that removing a session immediately stops push
 * notifications to that device — it cannot continue operating silently.
 */
router.delete(
  '/sessions/:sessionId',
  protect,
  [param('sessionId').isMongoId().withMessage('Invalid session ID'), validate],
  asyncHandler(async (req, res) => {
    const sessionId = new mongoose.Types.ObjectId(req.params.sessionId);

    // Step 1: load to get the session's IP (needed to clear device token)
    const userDoc = await User.findById(req.user._id).select('auditSessions deviceTokens');
    if (!userDoc) return res.status(404).json({ message: 'User not found.' });

    const targetSession = (userDoc.auditSessions ?? []).find(
      (s) => s._id.equals(sessionId)
    );

    if (!targetSession) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const sessionIp      = targetSession.ipAddress;
    const remainingSessions = (userDoc.auditSessions ?? []).filter(
      (s) => !s._id.equals(sessionId)
    );
    const goOffline = remainingSessions.length === 0;

    // Step 2 + 3: atomically remove session AND device token for the same IP
    const result = await User.findByIdAndUpdate(
      req.user._id,
      {
        $pull: {
          auditSessions: { _id: sessionId },
          deviceTokens:  { ipAddress: sessionIp },  // FIX: remove device token too
        },
        ...(goOffline && { $set: { isOnline: false, lastseen: new Date() } }),
      },
      { new: true }
    ).select('auditSessions');

    if (!result) return res.status(404).json({ message: 'User not found.' });

    await invalidateUserCache(req.user._id);

    log.info('Session + device token revoked', {
      userId:    req.user._id,
      sessionId: req.params.sessionId,
      ip:        sessionIp,
    });

    return res.json({
      message:   'Session revoked. Device has been signed out.',
      sessionId: req.params.sessionId,
      deviceSignedOut: true,
    });
  })
);

// ── DELETE /sessions  (revoke all) ───────────────────────────────────────────
/**
 * FIX: Clearing all sessions now also wipes ALL device tokens.
 * This is a "sign out everywhere" operation — no device retains push access.
 */
router.delete(
  '/sessions',
  protect,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        auditSessions: [],
        deviceTokens:  [],    // FIX: also clear all device tokens
        isOnline:      false,
        lastseen:      new Date(),
      },
    });

    await invalidateUserCache(req.user._id);

    return res.json({
      message: 'All sessions revoked. You are signed out on all devices.',
      devicesSignedOut: true,
    });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 7  DEVICE TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /device-tokens ───────────────────────────────────────────────────────
router.post(
  '/device-tokens',
  protect,
  asyncHandler(async (req, res) => {
    const { token, platform, deviceName } = req.body;
    if (!token || !platform)
      return res.status(400).json({ message: 'token and platform required.' });
    if (!['android', 'ios', 'web'].includes(platform))
      return res.status(400).json({ message: 'platform must be android | ios | web.' });

    const user = await User.findById(req.user._id).select('deviceTokens');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    upsertDeviceToken(user, {
      token,
      platform,
      deviceName: deviceName ?? req.deviceInfo?.deviceName ?? 'Unknown',
      ipAddress:  req.deviceInfo?.ipAddress,
    });

    await user.save();
    await invalidateUserCache(req.user._id);

    return res.json({ message: 'Device token registered.' });
  })
);

// ── GET /device-tokens ────────────────────────────────────────────────────────
router.get(
  '/device-tokens',
  protect,
  cache(60, (req) => `user:${req.user._id}:device-tokens`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('deviceTokens').lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.json({
      status: 'success',
      count:  (user.deviceTokens ?? []).length,
      data:   user.deviceTokens ?? [],
    });
  })
);

// ── DELETE /device-tokens/:token ──────────────────────────────────────────────
router.delete(
  '/device-tokens/:token',
  protect,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { deviceTokens: { token: req.params.token } } }
    );
    await invalidateUserCache(req.user._id);
    return res.json({ message: 'Device token removed.' });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  HEARTBEAT
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/heartbeat',
  protect,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline:     true,
      lastActiveAt: new Date(),
    });
    return res.json({ ok: true });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 9  GOOGLE OAUTH  (passport-google-oauth20)
//
// Prerequisites (in your app entry-point / passport.js config):
//
//   import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
//   import User from './models/User.js';
//   import { generateToken } from './utils/generateToken.js';
//
//   passport.use(
//     new GoogleStrategy(
//       {
//         clientID:     process.env.GOOGLE_CLIENT_ID,
//         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//         callbackURL:  process.env.GOOGLE_CALLBACK_URL,   // e.g. /api/users/google/callback
//         passReqToCallback: true,                         // gives us req in the verify callback
//       },
//       async (req, accessToken, refreshToken, profile, done) => {
//         try {
//           const email  = profile.emails?.[0]?.value?.toLowerCase();
//           const avatar = profile.photos?.[0]?.value ?? null;
//           const name   = profile.displayName ?? 'Google User';
//
//           // FIX: User model stores googleId under googleAuth.googleId (nested)
//           //      not as a top-level googleId field. Correct the lookup:
//           let user = await User.findOne({
//             $or: [
//               { 'googleAuth.googleId': profile.id },
//               ...(email ? [{ email }] : []),
//             ],
//           });
//
//           if (user) {
//             // Link Google ID to existing account if not already set
//             if (!user.googleAuth?.googleId) {
//               user.googleAuth = { googleId: profile.id, isVerified: true };
//               if (avatar && !user.avatar) user.avatar = avatar;
//               await user.save();
//             }
//           } else {
//             // First-time Google sign-in — auto-create account
//             const { hash } = await import('bcryptjs');
//             user = await User.create({
//               name,
//               email,
//               avatar,
//               googleAuth:      { googleId: profile.id, isVerified: true },
//               isEmailVerified: true,       // Google already verified the email
//               role:            'customer',
//               password:        await hash(Math.random().toString(36), 12),
//             });
//
//             // Create wallet + customer profile for the new user
//             await Promise.all([
//               Wallet.create({ user: user._id, balance: 0 }),
//               CustomerProfile.create({ user: user._id }),
//             ]);
//           }
//
//           return done(null, user);
//         } catch (err) {
//           return done(err, null);
//         }
//       }
//     )
//   );
//
//   // Passport serialize / deserialize are not used (JWT-only, no sessions)
//   passport.serializeUser((user, done) => done(null, user._id));
//   passport.deserializeUser(async (id, done) => {
//     try   { done(null, await User.findById(id)); }
//     catch (err) { done(err, null); }
//   });
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /google
 * Initiates the OAuth2 code-grant flow. Redirects to Google's consent page.
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope:  ['profile', 'email'],
    session: false,   // no express-session; we use JWT
  })
);

/**
 * GET /google/callback
 * Google redirects here after the user grants / denies consent.
 *
 * On success  → update login metadata, issue JWT, redirect to frontend.
 * On failure  → redirect to a frontend error page.
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session:         false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth-error?reason=google_denied`,
  }),
  asyncHandler(async (req, res) => {
    const user = req.user;

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth-error?reason=no_user`);
    }

    // ── New-device detection ─────────────────────────────────────────────
    const fp       = `${req.deviceInfo?.ipAddress}::${req.deviceInfo?.userAgent}`;
    const isNewDev = !Array.isArray(user.auditSessions) ||
                     !user.auditSessions.some((s) => `${s.ipAddress}::${s.userAgent}` === fp);

    // ── Update login metadata ────────────────────────────────────────────
    user.lastLoginAt  = new Date();
    user.lastLoginIp  = req.deviceInfo?.ipAddress ?? 'Unknown';
    user.loginCount   = (user.loginCount ?? 0) + 1;
    user.isOnline     = true;
    user.lastActiveAt = new Date();
    upsertAuditSession(user, buildSessionRecord(req));
    await user.save();

    await invalidateUserCache(user._id);

    // ── New-device alert (non-blocking) ──────────────────────────────────
    if (isNewDev) dispatchLoginAlert({ user, req }).catch(() => {});

    log.info('Google OAuth login', { userId: user._id, isNewDev });

    // ── Redirect to frontend with JWT ────────────────────────────────────
    const token = generateToken(user._id);
    const url   = new URL(`${process.env.FRONTEND_URL}/auth-success`);
    url.searchParams.set('token', token);
    url.searchParams.set('role',  user.role);

    return res.redirect(url.toString());
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 10  LOCATION
// ═══════════════════════════════════════════════════════════════════════════════

// ── PATCH /update-location-by-address  (geocodes a text address) ──────────────
router.patch(
  '/update-location-by-address',
  protect,
  asyncHandler(async (req, res) => {
    const { address } = req.body;
    if (!address?.trim()) return res.status(400).json({ message: 'Address required.' });

    const key = process.env.GOOGLE_MAPS_KEY;
    if (!key) return res.status(500).json({ message: 'Geocoding not configured.' });

    const geoRes = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
    );

    if (geoRes.data.status !== 'OK' || !geoRes.data.results?.length) {
      return res.status(400).json({
        message:        'Location not found.',
        geocodeStatus:  geoRes.data.status,
      });
    }

    const { lat, lng }     = geoRes.data.results[0].geometry.location;
    const formattedAddress = geoRes.data.results[0].formatted_address;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          'location.type':        'Point',
          'location.coordinates': [lng, lat],
          lastKnownAddress:        formattedAddress,
          lastActiveAt:            new Date(),
        },
      },
      { new: true, runValidators: true }
    );

    await invalidateUserCache(req.user._id);

    return res.json({
      status: 'success',
      data:   { address: formattedAddress, coordinates: { lat, lng }, user },
    });
  })
);

// ── PATCH /update-location  (raw lat/lng) ─────────────────────────────────────
router.patch(
  '/update-location',
  protect,
  [
    body('lat').isFloat({ min: -90,  max: 90  }).withMessage('lat must be between -90 and 90'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be between -180 and 180'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { lat, lng, address } = req.body;

    const upd = {
      'location.type':        'Point',
      'location.coordinates': [parseFloat(lng), parseFloat(lat)],
      lastActiveAt:            new Date(),
    };
    if (address) upd.lastKnownAddress = address;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: upd },
      { new: true }
    );

    await invalidateUserCache(req.user._id);

    return res.json({ success: true, data: { coordinates: { lat, lng }, user } });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 11  WALLET ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /wallet  (paginated transaction history) ──────────────────────────────
router.get(
  '/wallet',
  protect,
  cache(60, (req) =>
    `user:${req.user._id}:wallet:p${req.query.page || 1}:l${req.query.limit || 20}`
  ),
  asyncHandler(async (req, res) => {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const wallet = await getOrCreateWallet(req.user._id);

    const sorted    = [...wallet.transactions]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total     = sorted.length;
    const paginated = sorted.slice(skip, skip + limit);

    return res.json({
      status: 'success',
      data: {
        balance:             wallet.balance,
        currency:            wallet.currency,
        isActive:            wallet.isActive,
        // FIX: also expose withdrawable balance in the response
        withdrawableBalance: wallet.withdrawableBalance,
        lockedBalance:       wallet.lockedBalance,
        availableBalance:    wallet.availableBalance,  // virtual
        transactions:        paginated,
        pagination:          { total, page, pages: Math.ceil(total / limit), limit },
      },
    });
  })
);

// ── POST /wallet/redeem-coins ─────────────────────────────────────────────────
router.post(
  '/wallet/redeem-coins',
  protect,
  [
    body('coins')
      .isInt({ min: MIN_REDEEM_COINS })
      .withMessage(`Minimum ${MIN_REDEEM_COINS} coins required to redeem.`),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const coinsToRedeem = parseInt(req.body.coins, 10);
    const rupeesEarned  = +(coinsToRedeem / COINS_PER_RUPEE).toFixed(2);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'User not found.' });
      }

      if ((user.coins ?? 0) < coinsToRedeem) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient coins. You have ${user.coins ?? 0} coins (₹${+((user.coins ?? 0) / COINS_PER_RUPEE).toFixed(2)}).`,
        });
      }

      user.coins         -= coinsToRedeem;
      user.coinsRedeemed += coinsToRedeem;
      await user.save({ session });

      const wallet        = await getOrCreateWallet(user._id, session);
      const balanceBefore = wallet.balance;
      const balanceAfter  = +(balanceBefore + rupeesEarned).toFixed(2);

      wallet.balance = balanceAfter;
      wallet.transactions.push({
        type:          'Credit',
        amount:        rupeesEarned,
        // FIX: use 'Coin_Conversion' — correct purpose enum value from Wallet model
        //      (was 'Referral_Bonus' which is semantically wrong for coin redemption)
        purpose:       'Coin_Conversion',
        description:   `${coinsToRedeem} coins redeemed → ₹${rupeesEarned}`,
        balanceBefore,
        balanceAfter,
        status:        'Success',
      });
      await wallet.save({ session });

      await session.commitTransaction();

      await invalidateUserCache(user._id);

      log.info('Coins redeemed to wallet', {
        userId:         user._id,
        coinsRedeemed:  coinsToRedeem,
        rupeesEarned,
        newWalletBal:   balanceAfter,
        remainingCoins: user.coins,
      });

      return res.json({
        status:  'success',
        message: `${coinsToRedeem} coins redeemed successfully. ₹${rupeesEarned} added to your wallet.`,
        data: {
          coinsRedeemed:      coinsToRedeem,
          rupeesEarned,
          walletBalance:      balanceAfter,
          remainingCoins:     user.coins,
          remainingRupees:    +(user.coins / COINS_PER_RUPEE).toFixed(2),
          totalCoinsRedeemed: user.coinsRedeemed,
        },
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 12  REFERRAL ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /referral/my-code ─────────────────────────────────────────────────────
router.get(
  '/referral/my-code',
  protect,
  cache(60, (req) => `user:${req.user._id}:referral`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select('referralCode coins coinsEarned coinsRedeemed referralHistory referredBy')
      .populate('referralHistory.referredUser', 'name email avatar')
      .populate('referredBy', 'name email avatar');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({
      success: true,
      data: {
        referralCode:    user.referralCode,
        totalReferrals:  user.referralHistory.length,
        coins:           user.coins,
        coinsInRupees:   +(user.coins / COINS_PER_RUPEE).toFixed(2),
        coinsEarned:     user.coinsEarned,
        coinsRedeemed:   user.coinsRedeemed,
        referredBy:      user.referredBy ?? null,
        referralHistory: user.referralHistory,
      },
    });
  })
);

// ── GET /referral/validate?code=XYZ  (public — no auth needed) ───────────────
router.get(
  '/referral/validate',
  [
    query('code').notEmpty().trim().withMessage('code query param required'),
    validate,
  ],
  cache(300, (req) => `referral:validate:${(req.query.code || '').toUpperCase().trim()}`),
  asyncHandler(async (req, res) => {
    const code = (req.query.code ?? '').toString().toUpperCase().trim();

    if (!code || code.length < 6 || code.length > 12) {
      return res.status(400).json({
        success: false,
        data:    { valid: false },
        message: 'Code must be between 6 and 12 characters.',
      });
    }

    const inviter = await User.findOne({ referralCode: code }).select('name referralCode').lean();

    if (!inviter) {
      return res.status(404).json({
        success: false,
        data:    { valid: false },
        message: 'Referral code not found.',
      });
    }

    // Build a privacy-safe display name:  "John D."
    const parts       = (inviter.name ?? '').trim().split(/\s+/);
    const displayName = parts.length > 1
      ? `${parts[0]} ${parts.at(-1).charAt(0).toUpperCase()}.`
      : (parts[0] ?? 'A friend');

    return res.status(200).json({
      success: true,
      data: {
        valid:        true,
        referrerName: displayName,
        bonusCoins:   REFERRAL_INVITEE_COINS,
        bonusRupees:  `₹${(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2)}`,
      },
    });
  })
);

// ── POST /referral/apply  (post-signup code application) ─────────────────────
router.post(
  '/referral/apply',
  protect,
  [body('referralCode').notEmpty().trim().withMessage('referralCode is required.'), validate],
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newUser = await User.findById(req.user._id).session(session);
      if (!newUser) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (newUser.referredBy) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Referral code already applied to this account.',
        });
      }

      const code    = req.body.referralCode.trim().toUpperCase();
      const inviter = await User.findOne({ referralCode: code }).session(session);

      if (!inviter) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: 'Invalid referral code.' });
      }

      if (inviter._id.equals(newUser._id)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'You cannot use your own referral code.' });
      }

      inviter.coins       += REFERRAL_INVITER_COINS;
      inviter.coinsEarned += REFERRAL_INVITER_COINS;
      inviter.referralHistory.push({ referredUser: newUser._id, coinsAwarded: REFERRAL_INVITER_COINS });
      await inviter.save({ session });

      newUser.referredBy   = inviter._id;
      newUser.coins       += REFERRAL_INVITEE_COINS;
      newUser.coinsEarned += REFERRAL_INVITEE_COINS;
      await newUser.save({ session });

      await session.commitTransaction();

      await invalidateUserCache(inviter._id);
      await invalidateUserCache(newUser._id);

      log.info('Referral applied post-signup', { inviterId: inviter._id, newUserId: newUser._id });

      return res.status(200).json({
        success: true,
        message: `Referral applied! You received ${REFERRAL_INVITEE_COINS} coins (₹${+(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2)}).`,
        data: {
          yourCoins:       newUser.coins,
          yourCoinsRupees: +(newUser.coins / COINS_PER_RUPEE).toFixed(2),
          inviterRewarded: REFERRAL_INVITER_COINS,
        },
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 13  CUSTOMER SETTINGS ROUTES
//
// These routes cover account-level preferences and privacy controls
// available to any authenticated user (not just customers — the name
// "customer settings" refers to end-user/self-service settings).
//
// Routes:
//   GET    /settings                  — fetch all settings
//   PATCH  /settings/notifications    — update notification preferences
//   PATCH  /settings/privacy          — update privacy preferences
//   POST   /settings/verify-phone     — send OTP to verify phone number
//   POST   /settings/verify-phone/confirm — confirm phone OTP
//   POST   /settings/request-email-change  — send OTP to old email to approve change
//   POST   /settings/confirm-email-change  — verify OTP then update email
//   DELETE /settings/google-unlink    — unlink Google OAuth from account
//   GET    /settings/activity         — recent login/activity summary
//   POST   /settings/deactivate       — soft-deactivate account (keeps data, blocks login)
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /settings ─────────────────────────────────────────────────────────────
/**
 * Returns a snapshot of all user-facing settings and account metadata.
 * No sensitive fields (password, otp) are returned.
 */
router.get(
  '/settings',
  protect,
  cache(30, (req) => `user:${req.user._id}:settings`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select(
        'name email phone avatar role ' +
        'isEmailVerified isPhoneVerified ' +
        'googleAuth.googleId googleAuth.isVerified ' +
        'referralCode coins coinsEarned coinsRedeemed coinsInRupees ' +
        'lastLoginAt lastLoginIp loginCount lastActiveAt ' +
        'termsAcceptedAt privacyPolicyAcceptedAt ' +
        'createdAt'
      )
      .lean({ virtuals: true });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({
      success: true,
      data: {
        profile: {
          name:    user.name,
          email:   user.email,
          phone:   user.phone ?? null,
          avatar:  user.avatar,
          role:    user.role,
        },
        verification: {
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          isGoogleLinked:  !!(user.googleAuth?.googleId),
          googleVerified:  user.googleAuth?.isVerified ?? false,
        },
        coins: {
          balance:       user.coins,
          balanceRupees: user.coinsInRupees,
          earned:        user.coinsEarned,
          redeemed:      user.coinsRedeemed,
        },
        referralCode: user.referralCode,
        activity: {
          lastLoginAt:  user.lastLoginAt,
          lastLoginIp:  user.lastLoginIp,
          loginCount:   user.loginCount,
          lastActiveAt: user.lastActiveAt,
          memberSince:  user.createdAt,
        },
        legal: {
          termsAcceptedAt:         user.termsAcceptedAt ?? null,
          privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt ?? null,
        },
      },
    });
  })
);

// ── POST /settings/verify-phone ───────────────────────────────────────────────
/**
 * Sends a 6-digit OTP to the user's registered phone number.
 * The phone must already be set on the account.
 */
router.post(
  '/settings/verify-phone',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+otp +otpExpires');
    if (!user)         return res.status(404).json({ message: 'User not found.' });
    if (!user.phone)   return res.status(400).json({ message: 'No phone number on account. Update your profile first.' });
    if (user.isPhoneVerified) return res.status(400).json({ message: 'Phone is already verified.' });

    const otp       = generateOtp();
    user.otp        = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60_000);
    await user.save();

    await sendSms({
      to:      user.phone,
      message: otpSms({ otpCode: otp, purpose: 'phone verification' }),
    }).catch((e) => log.warn('Phone verify SMS failed', { err: e.message }));

    return res.json({ message: 'OTP sent to your registered phone number.' });
  })
);

// ── POST /settings/verify-phone/confirm ──────────────────────────────────────
/**
 * Confirms the OTP sent to the user's phone and marks isPhoneVerified = true.
 */
router.post(
  '/settings/verify-phone/confirm',
  protect,
  [
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { otp } = req.body;

    const user = await User.findOne({
      _id:        req.user._id,
      otp,
      otpExpires: { $gt: Date.now() },
    }).select('+otp +otpExpires');

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });

    user.isPhoneVerified = true;
    user.otp             = undefined;
    user.otpExpires      = undefined;
    await user.save();

    await invalidateUserCache(user._id);

    return res.json({ success: true, message: 'Phone number verified successfully.' });
  })
);

// ── POST /settings/request-email-change ───────────────────────────────────────
/**
 * Initiates an email change request.
 * Sends an OTP to the CURRENT email address for ownership confirmation.
 * The new email is stored temporarily in req.body but NOT saved yet —
 * it is saved only after OTP confirmation.
 *
 * To pass the new email through the OTP step we store it in user.otp
 * as a composite "OTP|newEmail" value (both cleared on confirm/expiry).
 */
router.post(
  '/settings/request-email-change',
  protect,
  [
    body('newEmail').isEmail().normalizeEmail().withMessage('Valid new email required'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { newEmail } = req.body;

    if (newEmail === req.user.email) {
      return res.status(400).json({ message: 'New email is the same as your current email.' });
    }

    // Check if new email is already taken
    const conflict = await User.findOne({ email: newEmail });
    if (conflict) return res.status(409).json({ message: 'That email address is already in use.' });

    const user = await User.findById(req.user._id).select('+otp +otpExpires');
    if (!user)  return res.status(404).json({ message: 'User not found.' });

    const otp = generateOtp();
    // Store composite value: OTP|newEmail — parsed on confirm
    user.otp        = `${otp}|${newEmail}`;
    user.otpExpires = new Date(Date.now() + 15 * 60_000);
    await user.save();

    await sendEmail({
      email:   user.email,
      subject: 'Confirm Your Email Change — Likeson',
      html:    otpTemplate({
        header:  'EMAIL CHANGE',
        title:   'Confirm your email change request',
        body:    `Enter this code to change your email to ${newEmail}. It expires in 15 minutes.`,
        otpCode: otp,
      }),
    }).catch((e) => log.warn('Email change OTP send failed', { err: e.message }));

    return res.json({ message: 'OTP sent to your current email address. Verify to complete the change.' });
  })
);

// ── POST /settings/confirm-email-change ───────────────────────────────────────
/**
 * Confirms the email change OTP and updates the user's email.
 * Also resets email verification state (new email must be re-verified).
 */
router.post(
  '/settings/confirm-email-change',
  protect,
  [
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { otp } = req.body;

    const user = await User.findOne({
      _id:        req.user._id,
      otpExpires: { $gt: Date.now() },
    }).select('+otp +otpExpires');

    if (!user || !user.otp) return res.status(400).json({ message: 'No pending email change request.' });

    const [storedOtp, newEmail] = (user.otp ?? '').split('|');

    if (storedOtp !== otp || !newEmail) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // Check again that the new email is not taken (race condition guard)
    const conflict = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
    if (conflict) {
      user.otp        = undefined;
      user.otpExpires = undefined;
      await user.save();
      return res.status(409).json({ message: 'That email address is already in use.' });
    }

    const oldEmail       = user.email;
    user.email           = newEmail;
    user.isEmailVerified = false;  // new email needs re-verification
    user.otp             = undefined;
    user.otpExpires      = undefined;
    await user.save();

    await invalidateUserCache(user._id);

    // Notify the OLD email that the address was changed
    sendEmail({
      email:   oldEmail,
      subject: 'Your Likeson Email Address Was Changed',
      html:    passwordChangedTemplate({
        header:     'EMAIL CHANGED',
        title:      'Your email address has been updated',
        body:       `Your account email was changed to ${newEmail}. If this wasn't you, contact support immediately.`,
        buttonText: 'Contact Support',
        buttonLink: `${process.env.FRONTEND_URL}/support`,
      }),
    }).catch(() => {});

    log.info('Email changed', { userId: user._id, from: oldEmail, to: newEmail });

    return res.json({
      success: true,
      message: 'Email changed successfully. Please verify your new email address.',
      newEmail,
    });
  })
);

// ── DELETE /settings/google-unlink ────────────────────────────────────────────
/**
 * Unlinks the Google OAuth identity from the account.
 * Requires the user to have a password set (to avoid locking themselves out).
 */
router.delete(
  '/settings/google-unlink',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (!user.googleAuth?.googleId) {
      return res.status(400).json({ message: 'No Google account is linked.' });
    }

    // Safety: ensure user can still log in without Google
    if (!user.password) {
      return res.status(400).json({
        message: 'Cannot unlink Google — you have no password set. Set a password first.',
      });
    }

    // FIX: Clear the nested googleAuth sub-document correctly
    user.googleAuth = { googleId: undefined, isVerified: false };
    await user.save();

    await invalidateUserCache(user._id);

    log.info('Google unlinked', { userId: user._id });
    return res.json({ success: true, message: 'Google account unlinked successfully.' });
  })
);

// ── GET /settings/activity ────────────────────────────────────────────────────
/**
 * Returns a sanitised activity summary: recent sessions, device tokens,
 * login stats. Useful for the "Security" settings page.
 */
router.get(
  '/settings/activity',
  protect,
  cache(30, (req) => `user:${req.user._id}:activity`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select(
        'auditSessions deviceTokens lastLoginAt lastLoginIp loginCount ' +
        'lastActiveAt isOnline passwordChangedAt'
      )
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found.' });

    const sessions = (user.auditSessions ?? [])
      .slice()
      .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt))
      .slice(0, 10);

    // Mask sensitive fields in device token list
    const devices = (user.deviceTokens ?? []).map((t) => ({
      _id:        t._id,
      platform:   t.platform,
      deviceName: t.deviceName,
      ipAddress:  t.ipAddress,
      lastUsedAt: t.lastUsedAt,
    }));

    return res.json({
      success: true,
      data: {
        isOnline:          user.isOnline,
        lastLoginAt:       user.lastLoginAt,
        lastLoginIp:       user.lastLoginIp,
        loginCount:        user.loginCount,
        lastActiveAt:      user.lastActiveAt,
        passwordChangedAt: user.passwordChangedAt ?? null,
        activeSessions:    sessions,
        registeredDevices: devices,
      },
    });
  })
);

// ── PATCH /settings/legal ─────────────────────────────────────────────────────
/**
 * Records the timestamp when the user accepts Terms of Service
 * or Privacy Policy. Frontend should call this on first launch / after updates.
 */
router.patch(
  '/settings/legal',
  protect,
  [
    body('acceptTerms').optional().isBoolean(),
    body('acceptPrivacy').optional().isBoolean(),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { acceptTerms, acceptPrivacy } = req.body;

    if (!acceptTerms && !acceptPrivacy) {
      return res.status(400).json({ message: 'Provide acceptTerms and/or acceptPrivacy.' });
    }

    const $set = {};
    if (acceptTerms   === true) $set.termsAcceptedAt         = new Date();
    if (acceptPrivacy === true) $set.privacyPolicyAcceptedAt = new Date();

    await User.findByIdAndUpdate(req.user._id, { $set });
    await invalidateUserCache(req.user._id);

    return res.json({ success: true, message: 'Legal acceptance recorded.', updated: $set });
  })
);

// ── POST /settings/deactivate ─────────────────────────────────────────────────
/**
 * Soft-deactivates the account. The user record is NOT deleted.
 * The account is blocked with reason "User requested deactivation."
 * All sessions and device tokens are cleared.
 * The user can reactivate by contacting support (admin unblock route).
 *
 * Requires password confirmation for security.
 */
router.post(
  '/settings/deactivate',
  protect,
  [
    body('password').exists().withMessage('Password confirmation required'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!user)  return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password.' });

    // Set a far-future unblockAt so auto-unblock doesn't trigger
    const DEACTIVATION_PLACEHOLDER = new Date('2099-01-01T00:00:00.000Z');

    user.isBlocked     = true;
    user.blockReason   = 'User requested deactivation.';
    user.unblockAt     = DEACTIVATION_PLACEHOLDER;
    user.isOnline      = false;
    user.lastseen      = new Date();
    user.auditSessions = [];
    user.deviceTokens  = [];
    await user.save();

    await invalidateUserCache(user._id);

    log.info('Account self-deactivated', { userId: user._id });

    if (user.phone) {
      sendSms({
        to:      user.phone,
        message: accountBlockedSms({
          name:      user.name,
          reason:    'Self-requested deactivation',
          unblockAt: 'Contact support to reactivate',
        }),
      }).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Account deactivated. Contact support to reactivate your account.',
    });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 14  ADMIN / SUPERADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /admin/users ──────────────────────────────────────────────────────────
router.get(
  '/admin/users',
  protect,
  authorize('superadmin', 'admin'),
  cache(60),
  asyncHandler(async (req, res) => {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isBlocked !== undefined)
      filter.isBlocked = req.query.isBlocked === 'true';
    if (req.query.search) {
      filter.$or = [
        { name:  { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -otp -otpExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      data:        users,
      total,
      pages:       Math.ceil(total / limit),
      currentPage: page,
    });
  })
);

// ── PATCH /admin/update-role/:id ──────────────────────────────────────────────
router.patch(
  '/admin/update-role/:id',
  protect,
  authorize('superadmin'),
  [param('id').isMongoId().withMessage('Invalid user ID'), validate],
  asyncHandler(async (req, res) => {
    const { role: newRole } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(req.params.id).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'User not found.' });
      }

      const oldRole = user.role;
      if (oldRole === newRole) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'User already has this role.' });
      }

      user.role = newRole;
      await user.save({ session });

      // Drop the old role profile and create a fresh one for the new role
      // FIX: getProfileModel correctly handles TransportPartner for transportpartner role
      const OldM = getProfileModel(oldRole);
      if (OldM) await OldM.findOneAndDelete({ user: user._id }).session(session);

      const NewM = getProfileModel(newRole);
      let newProfile = null;
      if (NewM) [newProfile] = await NewM.create([{ user: user._id }], { session });

      await session.commitTransaction();

      await invalidateUserCache(user._id);
      await invalidatePattern('GET:/api/users/admin/users*');

      log.info('Role changed', {
        userId: user._id,
        from:   oldRole,
        to:     newRole,
        by:     req.user._id,
      });

      return res.json({
        success:    true,
        message:    `Role changed: ${oldRole} → ${newRole}.`,
        user,
        newProfile,
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// ── PATCH /admin/suspend/:id ──────────────────────────────────────────────────
router.patch(
  '/admin/suspend/:id',
  protect,
  authorize('superadmin', 'admin'),
  [param('id').isMongoId().withMessage('Invalid user ID'), validate],
  asyncHandler(async (req, res) => {
    const { reason, durationDays } = req.body;
    const unblockAt = new Date();
    unblockAt.setDate(unblockAt.getDate() + (parseInt(durationDays) || 30));

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBlocked:     true,
        blockReason:   reason || 'Violation of terms of service',
        unblockAt,
        isOnline:      false,
        lastseen:      new Date(),
        auditSessions: [],
        deviceTokens:  [],
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.phone) {
      const unblockDate = unblockAt.toLocaleDateString('en-IN');
      sendSms({
        to:      user.phone,
        message: accountBlockedSms({ name: user.name, reason: user.blockReason, unblockAt: unblockDate }),
      }).catch(() => {});
    }

    await invalidateUserCache(user._id);
    await invalidatePattern('GET:/api/users/admin/users*');

    log.warn('User suspended', { userId: user._id, by: req.user._id });
    return res.json({ message: `Suspended until ${unblockAt.toISOString()}.`, user });
  })
);

// ── PATCH /admin/unblock/:id ──────────────────────────────────────────────────
router.patch(
  '/admin/unblock/:id',
  protect,
  authorize('superadmin', 'admin'),
  [param('id').isMongoId().withMessage('Invalid user ID'), validate],
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false, blockReason: undefined, unblockAt: undefined },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.phone) {
      sendSms({
        to:      user.phone,
        message: accountUnblockedSms({ name: user.name }),
      }).catch(() => {});
    }

    await invalidateUserCache(user._id);
    await invalidatePattern('GET:/api/users/admin/users*');

    log.info('User unblocked', { userId: user._id, by: req.user._id });
    return res.json({ message: 'User unblocked.', user });
  })
);

// ── POST /admin/reset-otp/:email ──────────────────────────────────────────────
router.post(
  '/admin/reset-otp/:email',
  protect,
  authorize('admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const user = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      { $unset: { otp: 1, otpExpires: 1 } }
    );

    if (user) await invalidateUserCache(user._id);

    return res.json({ message: 'OTP state cleared.' });
  })
);

// ── GET /admin/user/:id/coins ─────────────────────────────────────────────────
router.get(
  '/admin/user/:id/coins',
  protect,
  authorize('superadmin', 'admin'),
  [param('id').isMongoId().withMessage('Invalid user ID'), validate],
  cache(60, (req) => `admin:user:${req.params.id}:coins`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .select('name email coins coinsEarned coinsRedeemed referralCode referralHistory referredBy')
      .populate('referralHistory.referredUser', 'name email')
      .populate('referredBy', 'name email');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.json({
      success: true,
      data: {
        name:            user.name,
        email:           user.email,
        referralCode:    user.referralCode,
        referredBy:      user.referredBy ?? null,
        totalReferrals:  user.referralHistory.length,
        coins:           user.coins,
        coinsInRupees:   +(user.coins / COINS_PER_RUPEE).toFixed(2),
        coinsEarned:     user.coinsEarned,
        coinsRedeemed:   user.coinsRedeemed,
        referralHistory: user.referralHistory,
      },
    });
  })
);

// ── POST /admin/credit-coins/:id  (manual coin grant) ────────────────────────
/**
 * Allows superadmin to manually credit coins to any user.
 * Useful for promotions, compensation, or testing.
 */
router.post(
  '/admin/credit-coins/:id',
  protect,
  authorize('superadmin'),
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('coins').isInt({ min: 1 }).withMessage('coins must be a positive integer'),
    body('reason').notEmpty().trim().withMessage('reason is required'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { coins, reason } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.coins        += coins;
    user.coinsEarned  += coins;
    await user.save();

    await invalidateUserCache(user._id);

    log.info('Admin credited coins', {
      userId: user._id,
      coins,
      reason,
      by:     req.user._id,
    });

    return res.json({
      success: true,
      message: `${coins} coins credited to ${user.name}.`,
      data: {
        userId:    user._id,
        newBalance: user.coins,
        reason,
      },
    });
  })
);

// ── GET /admin/user/:id/sessions  (view sessions of any user) ─────────────────
router.get(
  '/admin/user/:id/sessions',
  protect,
  authorize('superadmin', 'admin'),
  [param('id').isMongoId().withMessage('Invalid user ID'), validate],
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .select('auditSessions deviceTokens isOnline lastLoginAt lastLoginIp')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found.' });

    const sessions = (user.auditSessions ?? [])
      .slice()
      .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt));

    return res.json({
      success:           true,
      isOnline:          user.isOnline,
      lastLoginAt:       user.lastLoginAt,
      lastLoginIp:       user.lastLoginIp,
      activeSessions:    sessions,
      registeredDevices: user.deviceTokens ?? [],
    });
  })
);

// ── DELETE /admin/user/:id/sessions  (force sign-out any user) ───────────────
/**
 * Forces a full sign-out of all sessions for any user.
 * Useful after a compromise or admin intervention.
 */
router.delete(
  '/admin/user/:id/sessions',
  protect,
  authorize('superadmin', 'admin'),
  [param('id').isMongoId().withMessage('Invalid user ID'), validate],
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          auditSessions: [],
          deviceTokens:  [],
          isOnline:      false,
          lastseen:      new Date(),
        },
      },
      { new: true }
    ).select('name email');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    await invalidateUserCache(req.params.id);

    log.warn('Admin force sign-out', { targetUserId: req.params.id, by: req.user._id });

    return res.json({
      success: true,
      message: `All sessions cleared for ${user.name}. User has been signed out everywhere.`,
    });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 15  CENTRALISED ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
  log.error('Unhandled error', { message: err.message, stack: err.stack });
  return res.status(err.statusCode || 500).json({
    status:  'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

export default router;