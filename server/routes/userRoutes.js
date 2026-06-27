import express   from 'express';
import bcrypt    from 'bcryptjs';
import passport  from 'passport';
import mongoose  from 'mongoose';
import jwt       from 'jsonwebtoken';
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
import TransportPartner        from '../models/TransportPartner.js';

// ── Middleware / Utils ────────────────────────────────────────────────────────
import { protect, authorize, getDeviceInfo } from '../middleware/authMiddleware.js';
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

router.use(getDeviceInfo);

// ═══════════════════════════════════════════════════════════════════════════════
// § 0  CONSTANTS & LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

const MIN_REDEEM_COINS = 500;

const log = {
  info:  (msg, meta = {}) => console.log( `✅  [USER] ${msg}`, meta),
  warn:  (msg, meta = {}) => console.warn(`⚠️  [USER] ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`❌  [USER] ${msg}`, meta),
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const PROFILE_MAP = {
  customer:         CustomerProfile,
  doctor:           DoctorProfile,
  driver:           DriverProfile,
  pharmacy:         PharmacyProfile,
  transportpartner: TransportPartner,
  'care assistant': CareAssistantProfile,
};

const getProfileModel = (role) => PROFILE_MAP[role] ?? null;

const generateOtp = () =>
  Math.floor(100_000 + Math.random() * 900_000).toString();

const buildLoginFilter = (identifier) => {
  const t = (identifier ?? '').trim();
  if (!t) return null;
  if (t.includes('@'))                               return { email: t.toLowerCase() };
  if (/^\+?\d{10,15}$/.test(t.replace(/\s/g, ''))) return { phone: t.replace(/\s/g, '') };
  return { name: { $regex: `^${t}$`, $options: 'i' } };
};

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

const upsertAuditSession = (user, record) => {
  if (!Array.isArray(user.auditSessions)) user.auditSessions = [];
  const fp  = `${record.ipAddress}::${record.userAgent}`;
  const idx = user.auditSessions.findIndex(
    (s) => `${s.ipAddress}::${s.userAgent}` === fp
  );
  if (idx !== -1) {
    user.auditSessions[idx].lastActiveAt = new Date();
    return user.auditSessions[idx]._id;
  } else {
    if (user.auditSessions.length >= 10) {
      user.auditSessions.sort((a, b) => new Date(a.lastActiveAt) - new Date(b.lastActiveAt));
      user.auditSessions.shift();
    }
    user.auditSessions.push(record);
    return user.auditSessions[user.auditSessions.length - 1]._id;
  }
};

const upsertDeviceToken = (user, { token, platform, deviceName, ipAddress }) => {
  if (!Array.isArray(user.deviceTokens)) user.deviceTokens = [];
  const existing = user.deviceTokens.find((t) => t.token === token);
  if (existing) {
    existing.lastUsedAt = new Date();
    return existing._id;
  }
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
  return user.deviceTokens[user.deviceTokens.length - 1]._id;
};

const upsertLoginDeviceToken = (user, req) => {
  const ipAddress  = req.deviceInfo?.ipAddress  ?? 'Unknown';
  const userAgent  = req.deviceInfo?.userAgent  ?? 'Unknown';
  const platform   = req.deviceInfo?.platform   ?? 'web';
  const deviceName = req.deviceInfo?.deviceName ?? 'Unknown Device';

  const fingerprintToken = `login:${Buffer.from(`${ipAddress}::${userAgent}`).toString('base64')}`;

  return upsertDeviceToken(user, {
    token:      fingerprintToken,
    platform,
    deviceName,
    ipAddress,
  });
};

// ── Wallet helpers ────────────────────────────────────────────────────────────

const getOrCreateWallet = async (userId, session = null) => {
  const opts = session ? { session } : {};
  let wallet = await Wallet.findOne({ user: userId }, null, opts);
  if (!wallet) {
    const docs = await Wallet.create([{ user: userId, balance: 0 }], opts);
    wallet = docs[0];
  }
  return wallet;
};

const creditWallet = async ({
  userId, amount, purpose, description,
  referenceId = null, onModel = null, session = null,
}) => {
  const opts          = session ? { session } : {};
  const wallet        = await getOrCreateWallet(userId, session);
  const balanceBefore = wallet.balance;
  const balanceAfter  = +(balanceBefore + amount).toFixed(2);

  wallet.balance = balanceAfter;
  wallet.transactions.push({
    type: 'Credit', amount, purpose, description,
    ...(referenceId && { referenceId }),
    ...(onModel     && { onModel }),
    balanceBefore, balanceAfter, status: 'Success',
  });

  await wallet.save(opts);
  return wallet;
};

// ── Token generation with sessionId ──────────────────────────────────────────

/**
 * generateTokenWithSession
 *
 * Embeds auditSession._id in the JWT so protect middleware can validate
 * that the session still exists (i.e. was not remotely revoked).
 *
 * When the JWT expires (TokenExpiredError), protect returns:
 *   { message: '...', code: 'TOKEN_EXPIRED' }
 * → api.js interceptor dispatches autoLogout → user is signed out client-side.
 */
const generateTokenWithSession = (userId, sessionId) =>
  jwt.sign(
    { id: userId.toString(), sessionId: sessionId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '12h' }
  );

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  NOTIFICATION DISPATCHERS
// ═══════════════════════════════════════════════════════════════════════════════

const dispatchOtp = async ({ user, otpCode, purpose = 'verification', subject }) => {
  const tasks = [
    sendEmail({
      email:   user.email,
      subject: subject ?? 'Your Verification Code — Likeson',
      html:    otpTemplate({
        header: purpose.toUpperCase(), title: 'Security Code',
        body:   'Use this code to verify your identity. It expires in 10 minutes.',
        otpCode,
      }),
    }).catch((e) => log.warn('OTP email failed', { email: user.email, err: e.message })),
  ];
  if (user.phone) {
    tasks.push(
      sendSms({ to: user.phone, message: otpSms({ otpCode, purpose }) })
        .catch((e) => log.warn('OTP SMS failed', { err: e.message }))
    );
  }
  await Promise.allSettled(tasks);
};

const dispatchWelcome = async ({ user }) => {
  const tasks = [
    sendEmail({
      email:   user.email,
      subject: 'Welcome to Likeson.in — Your Account is Ready',
      html:    welcomeTemplate({
        header: 'Welcome to Likeson Healthcare',
        title:  `Hi ${user.name}, welcome aboard!`,
        body:   `Your ${user.role} account is ready.`,
        buttonText: 'Go to Dashboard',
        buttonLink: `${process.env.FRONTEND_URL}/dashboard`,
      }),
    }).catch((e) => log.warn('Welcome email failed', { err: e.message })),
  ];
  if (user.phone) {
    tasks.push(
      sendSms({ to: user.phone, message: welcomeSms({ name: user.name, role: user.role }) })
        .catch(() => {})
    );
  }
  await Promise.allSettled(tasks);
};

const dispatchLoginAlert = async ({ user, req }) => {
  if (!user.phone) return;
  await Promise.allSettled([
    sendSms({
      to:      user.phone,
      message: newLoginAlertSms({
        name:       user.name,
        deviceName: req.deviceInfo?.deviceName ?? 'Unknown Device',
        ipAddress:  req.deviceInfo?.ipAddress  ?? 'Unknown',
      }),
    }).catch(() => {}),
  ]);
};

const dispatchPasswordResetOtp = async ({ user, otpCode }) => {
  const tasks = [
    sendEmail({
      email:   user.email,
      subject: 'Password Reset Code — Likeson',
      html:    otpTemplate({
        header: 'RECOVERY', title: 'Reset Your Password',
        body:   'Use this code to reset your password. It expires in 15 minutes.',
        otpCode,
      }),
    }).catch((e) => log.warn('Password reset email failed', { err: e.message })),
  ];
  if (user.phone) {
    tasks.push(
      sendSms({ to: user.phone, message: passwordResetOtpSms({ name: user.name, otpCode }) })
        .catch(() => {})
    );
  }
  await Promise.allSettled(tasks);
};

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
      sendSms({ to: user.phone, message: passwordChangedSms({ name: user.name, changedAt }) })
        .catch(() => {})
    );
  }
  await Promise.allSettled(tasks);
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  VALIDATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ status: 'fail', errors: errors.array() });
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  SHARED LOGIN FINALISATION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * finaliseLogin
 *
 * Called after credentials are verified. Handles:
 *   1. FCM device token upsert (if provided in body)
 *   2. Audit session upsert — returns the session _id
 *   3. Login metadata update (lastLoginAt, loginCount, isOnline)
 *   4. JWT generation with embedded sessionId
 *
 * The sessionId in the JWT is validated by protect middleware on every request.
 * If the session is deleted (remote sign-out), protect returns:
 *   { code: 'SESSION_REVOKED' } → api.js interceptor → autoLogout
 *
 * If the JWT expires, protect returns:
 *   { code: 'TOKEN_EXPIRED' } → api.js interceptor → autoLogout
 *
 * @param {object} user — Mongoose User document (writable)
 * @param {object} req  — Express request
 * @returns {{ token: string, sessionId: string }}
 */
const finaliseLogin = async (user, req) => {
  const { fcmToken, platform, deviceName } = req.body ?? {};

  // ── 1. Upsert FCM device token (only when client supplies one) ─────────────
  let deviceTokenId = null;
  if (fcmToken && platform) {
    deviceTokenId = upsertDeviceToken(user, {
      token:      fcmToken,
      platform:   ['android', 'ios', 'web', 'desktop'].includes(platform) ? platform : 'web',
      deviceName: deviceName ?? req.deviceInfo?.deviceName ?? 'Unknown',
      ipAddress:  req.deviceInfo?.ipAddress,
    });
  }

  // ── 2. Build + upsert audit session ───────────────────────────────────────
  const sessionRecord = buildSessionRecord(req);
  const sessionId     = upsertAuditSession(user, sessionRecord);

  // ── 3. New-device detection ────────────────────────────────────────────────
  const fp       = `${req.deviceInfo?.ipAddress}::${req.deviceInfo?.userAgent}`;
  const isNewDev = (user.auditSessions ?? []).filter(
    (s) => `${s.ipAddress}::${s.userAgent}` === fp
  ).length <= 1;

  // ── 4. Update login metadata ───────────────────────────────────────────────
  user.lastLoginAt  = new Date();
  user.lastLoginIp  = req.deviceInfo?.ipAddress ?? 'Unknown';
  user.loginCount   = (user.loginCount ?? 0) + 1;
  user.isOnline     = true;
  user.lastActiveAt = new Date();

  await user.save();
  await invalidateUserCache(user._id);

  if (isNewDev) dispatchLoginAlert({ user, req }).catch(() => {});

  // ── 5. Issue JWT with sessionId embedded ──────────────────────────────────
  const token = generateTokenWithSession(user._id, sessionId);

  log.info('Login finalised', {
    userId:         user._id,
    sessionId:      sessionId.toString(),
    hasDeviceToken: !!deviceTokenId,
    isNewDev,
  });

  return { token, sessionId: sessionId.toString() };
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  PUBLIC ROUTES — AUTH & OTP
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

      const ProfileModel = getProfileModel(newUser.role);
      if (ProfileModel) {
        await ProfileModel.create([{ user: newUser._id }], { session });
      }

      await Wallet.create([{ user: newUser._id, balance: 0 }], { session });

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
/**
 * Now calls finaliseLogin which handles device token + session + JWT together.
 * JWT embeds sessionId → protect validates it on every request.
 * When token expires → protect returns { code: 'TOKEN_EXPIRED' } → auto-logout.
 *
 * Request body may include:
 *   identifier  — email / phone / name  (required)
 *   password    — (required)
 *   fcmToken    — push notification token  (optional)
 *   platform    — 'android' | 'ios' | 'web' | 'desktop'  (required when fcmToken sent)
 *   deviceName  — human-readable device label  (optional)
 */
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

    const user = await User.findOne(filter).select('+password +otp +otpExpires +auditSessions');
    if (!user)  return res.status(401).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      log.warn('Failed login', { filter, ip: req.deviceInfo?.ipAddress });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.isCurrentlyBlocked) {
      return res.status(403).json({
        message:   'Account suspended.',
        reason:    user.blockReason,
        unblockAt: user.unblockAt,
      });
    }

    // finaliseLogin handles session upsert, device token, save, JWT generation
    const { token, sessionId } = await finaliseLogin(user, req);

    log.info('Login success', { userId: user._id });

    return res.json({
      status: 'success',
      token,
      sessionId,
      user,
      expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    });
  })
);

// ── POST /logout ──────────────────────────────────────────────────────────────
/**
 * Removes the exact session (by IP+UA) and its associated device tokens.
 * Uses sessionId from JWT (via protect middleware) when available.
 */
router.post(
  '/logout',
  protect,
  asyncHandler(async (req, res) => {
    const ipAddress = req.deviceInfo?.ipAddress ?? 'Unknown';
    const userAgent = req.deviceInfo?.userAgent ?? 'Unknown';
    const sessionId = req.user.sessionId;

    const userDoc   = await User.findById(req.user._id).select('auditSessions');
    const remaining = (userDoc?.auditSessions ?? []).filter((s) => {
      if (sessionId) return s._id.toString() !== sessionId;
      return !(s.ipAddress === ipAddress && s.userAgent === userAgent);
    });
    const goOffline = remaining.length === 0;

    const pullFilter = sessionId
      ? { auditSessions: { _id: new mongoose.Types.ObjectId(sessionId) } }
      : { auditSessions: { ipAddress, userAgent } };

    await User.findByIdAndUpdate(req.user._id, {
      ...(goOffline && { $set: { isOnline: false, lastseen: new Date() } }),
      lastActiveAt: new Date(),
      $pull: {
        ...pullFilter,
        deviceTokens: { ipAddress },
      },
    });

    await invalidateUserCache(req.user._id);

    log.info('Logout', { userId: req.user._id, sessionId });
    return res.json({ status: 'success', message: 'Logged out successfully.' });
  })
);

// ── POST /otp-request ─────────────────────────────────────────────────────────
router.post(
  '/otp-request',
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() });
    if (user) {
      const otp = generateOtp();
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60_000);
      await user.save();
      await dispatchOtp({ user, otpCode: otp, purpose: 'verification' });
    }
    return res.json({ message: 'If that account exists, an OTP has been sent.' });
  })
);

// ── POST /verify-email ────────────────────────────────────────────────────────
router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'email and otp are required.' });

    const user = await User.findOne({
      email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() },
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

// ── POST /request-otp-login ───────────────────────────────────────────────────
router.post(
  '/request-otp-login',
  [body('identifier').notEmpty().trim().withMessage('Identifier required'), validate],
  asyncHandler(async (req, res) => {
    const filter = buildLoginFilter(req.body.identifier);
    const user   = filter ? await User.findOne(filter) : null;
    if (user) {
      const otp = generateOtp();
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60_000);
      await user.save();
      await dispatchOtp({ user, otpCode: otp, purpose: 'login', subject: 'Your Likeson Login OTP' });
    }
    return res.json({ message: 'If that account exists, an OTP has been sent.' });
  })
);

// ── POST /otp-login ───────────────────────────────────────────────────────────
/**
 * Calls finaliseLogin — same device token + session + JWT flow as /login.
 * JWT includes sessionId → auto-logout on expiry or session revocation.
 *
 * Request body may include fcmToken + platform for device token registration.
 */
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

    const user = await User.findOne({
      ...filter, otp, otpExpires: { $gt: Date.now() },
    }).select('+otp +otpExpires +auditSessions');

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });
    if (user.isCurrentlyBlocked)
      return res.status(403).json({ message: 'Account suspended.', reason: user.blockReason });

    user.isEmailVerified = true;
    user.otp             = undefined;
    user.otpExpires      = undefined;
    // Note: do NOT save yet — finaliseLogin will save after adding session

    const { token, sessionId } = await finaliseLogin(user, req);

    log.info('OTP login', { userId: user._id });

    return res.json({
      status: 'success',
      token,
      sessionId,
      user: {
        _id: user._id, name: user.name, email: user.email, phone: user.phone,
        role: user.role, avatar: user.avatar, isEmailVerified: user.isEmailVerified,
        isOnline: true, coins: user.coins,
        coinsInRupees: +(user.coins / COINS_PER_RUPEE).toFixed(2),
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
      const otp = generateOtp();
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 15 * 60_000);
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
    const user   = filter
      ? await User.findOne({ ...filter, otp, otpExpires: { $gt: Date.now() } })
                  .select('+otp +otpExpires')
      : null;

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });

    user.password          = await bcrypt.hash(newPassword, 12);
    user.otp               = undefined;
    user.otpExpires        = undefined;
    user.passwordChangedAt = new Date();
    user.isOnline          = false;
    user.auditSessions     = [];
    user.deviceTokens      = [];
    await user.save();
    await invalidateUserCache(user._id);

    log.info('Password reset', { userId: user._id });
    dispatchPasswordChanged({ user }).catch(() => {});
    return res.json({ message: 'Password reset. Please log in again.' });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  PROTECTED — PROFILE & PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/profile',
  protect,
  cache(60, (req) => `user:${req.user._id}:profile`),
  asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(req.user._id, { lastActiveAt: new Date() }).exec().catch(() => {});
    const user = await User.findById(req.user._id).populate('profile').lean({ virtuals: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: user });
  })
);

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

    let updatedProfile = null;
    if (roleProfileData) {
      const M = getProfileModel(user.role);
      if (M) {
        updatedProfile = await M.findOneAndUpdate(
          { user: user._id }, { $set: roleProfileData },
          { new: true, runValidators: true, upsert: true }
        );
      }
    }

    await invalidateUserCache(user._id);
    return res.json({ success: true, message: 'Profile updated.', data: { user, profile: updatedProfile } });
  })
);

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

router.delete(
  '/delete-account',
  protect,
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
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
// § 7  AUDIT SESSION MANAGEMENT
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
 * Removes a session by _id and all device tokens associated with that session's IP.
 * If the removed session is the caller's own → effectively a logout.
 * Subsequent requests with that JWT will fail protect() with SESSION_REVOKED.
 */
router.delete(
  '/sessions/:sessionId',
  protect,
  [param('sessionId').isMongoId().withMessage('Invalid session ID'), validate],
  asyncHandler(async (req, res) => {
    const sessionId = new mongoose.Types.ObjectId(req.params.sessionId);

    const userDoc = await User.findById(req.user._id).select('auditSessions deviceTokens');
    if (!userDoc) return res.status(404).json({ message: 'User not found.' });

    const targetSession = (userDoc.auditSessions ?? []).find(
      (s) => s._id.equals(sessionId)
    );

    if (!targetSession) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const sessionIp         = targetSession.ipAddress;
    const remainingSessions = (userDoc.auditSessions ?? []).filter(
      (s) => !s._id.equals(sessionId)
    );
    const goOffline = remainingSessions.length === 0;

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $pull: {
          auditSessions: { _id: sessionId },
          deviceTokens:  { ipAddress: sessionIp },
        },
        ...(goOffline && { $set: { isOnline: false, lastseen: new Date() } }),
      },
      { new: true }
    ).select('auditSessions');

    await invalidateUserCache(req.user._id);

    log.info('Session + device tokens revoked', {
      userId:    req.user._id,
      sessionId: req.params.sessionId,
      ip:        sessionIp,
    });

    return res.json({
      message:         'Session revoked. Device has been signed out.',
      sessionId:       req.params.sessionId,
      deviceSignedOut: true,
    });
  })
);

// ── DELETE /sessions  (revoke all) ────────────────────────────────────────────
router.delete(
  '/sessions',
  protect,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        auditSessions: [],
        deviceTokens:  [],
        isOnline:      false,
        lastseen:      new Date(),
      },
    });

    await invalidateUserCache(req.user._id);

    return res.json({
      message:          'All sessions revoked. You are signed out on all devices.',
      devicesSignedOut: true,
    });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  DEVICE TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /device-tokens ───────────────────────────────────────────────────────
router.post(
  '/device-tokens',
  protect,
  asyncHandler(async (req, res) => {
    const { token, platform, deviceName } = req.body;
    if (!token || !platform)
      return res.status(400).json({ message: 'token and platform required.' });
    if (!['android', 'ios', 'web', 'desktop'].includes(platform))
      return res.status(400).json({ message: 'platform must be android | ios | web | desktop.' });

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
// § 9  HEARTBEAT
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/heartbeat',
  protect,
  asyncHandler(async (req, res) => {
    const sessionId = req.user.sessionId;
    const update    = { isOnline: true, lastActiveAt: new Date() };

    if (sessionId) {
      await User.findOneAndUpdate(
        { _id: req.user._id, 'auditSessions._id': new mongoose.Types.ObjectId(sessionId) },
        { $set: { ...update, 'auditSessions.$.lastActiveAt': new Date() } }
      );
    } else {
      await User.findByIdAndUpdate(req.user._id, update);
    }

    return res.json({ ok: true });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 10  GOOGLE OAUTH
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

/**
 * Google OAuth callback — calls finaliseLogin for session + JWT generation.
 * FCM device token registration must be done separately via POST /device-tokens
 * after the redirect, since tokens can't be passed through OAuth redirect params.
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

    // Need auditSessions for finaliseLogin
    const fullUser = await User.findById(user._id).select('+auditSessions +deviceTokens');
    if (!fullUser) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth-error?reason=no_user`);
    }

    const { token, sessionId } = await finaliseLogin(fullUser, req);

    log.info('Google OAuth login', { userId: fullUser._id });

    const url = new URL(`${process.env.FRONTEND_URL}/auth-success`);
    url.searchParams.set('token',     token);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('role',      fullUser.role);

    return res.redirect(url.toString());
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 11  LOCATION
// ═══════════════════════════════════════════════════════════════════════════════

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

    if (geoRes.data.status !== 'OK' || !geoRes.data.results?.length)
      return res.status(400).json({ message: 'Location not found.', geocodeStatus: geoRes.data.status });

    const { lat, lng }     = geoRes.data.results[0].geometry.location;
    const formattedAddress = geoRes.data.results[0].formatted_address;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { 'location.type': 'Point', 'location.coordinates': [lng, lat], lastKnownAddress: formattedAddress, lastActiveAt: new Date() } },
      { new: true, runValidators: true }
    );

    await invalidateUserCache(req.user._id);
    return res.json({ status: 'success', data: { address: formattedAddress, coordinates: { lat, lng }, user } });
  })
);

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
    const upd = { 'location.type': 'Point', 'location.coordinates': [parseFloat(lng), parseFloat(lat)], lastActiveAt: new Date() };
    if (address) upd.lastKnownAddress = address;

    const user = await User.findByIdAndUpdate(req.user._id, { $set: upd }, { new: true });
    await invalidateUserCache(req.user._id);
    return res.json({ success: true, data: { coordinates: { lat, lng }, user } });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 12  WALLET ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/wallet',
  protect,
  cache(60, (req) => `user:${req.user._id}:wallet:p${req.query.page || 1}:l${req.query.limit || 20}`),
  asyncHandler(async (req, res) => {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const wallet    = await getOrCreateWallet(req.user._id);
    const sorted    = [...wallet.transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total     = sorted.length;
    const paginated = sorted.slice(skip, skip + limit);

    return res.json({
      status: 'success',
      data: {
        balance: wallet.balance, currency: wallet.currency, isActive: wallet.isActive,
        withdrawableBalance: wallet.withdrawableBalance, lockedBalance: wallet.lockedBalance,
        availableBalance: wallet.availableBalance,
        transactions: paginated,
        pagination: { total, page, pages: Math.ceil(total / limit), limit },
      },
    });
  })
);

router.post(
  '/wallet/redeem-coins',
  protect,
  [body('coins').isInt({ min: MIN_REDEEM_COINS }).withMessage(`Minimum ${MIN_REDEEM_COINS} coins required to redeem.`), validate],
  asyncHandler(async (req, res) => {
    const coinsToRedeem = parseInt(req.body.coins, 10);
    const rupeesEarned  = +(coinsToRedeem / COINS_PER_RUPEE).toFixed(2);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(req.user._id).session(session);
      if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User not found.' }); }

      if ((user.coins ?? 0) < coinsToRedeem) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Insufficient coins. You have ${user.coins ?? 0} coins.` });
      }

      user.coins         -= coinsToRedeem;
      user.coinsRedeemed += coinsToRedeem;
      await user.save({ session });

      const wallet        = await getOrCreateWallet(user._id, session);
      const balanceBefore = wallet.balance;
      const balanceAfter  = +(balanceBefore + rupeesEarned).toFixed(2);

      wallet.balance = balanceAfter;
      wallet.transactions.push({
        type: 'Credit', amount: rupeesEarned, purpose: 'Coin_Conversion',
        description: `${coinsToRedeem} coins redeemed → ₹${rupeesEarned}`,
        balanceBefore, balanceAfter, status: 'Success',
      });
      await wallet.save({ session });
      await session.commitTransaction();
      await invalidateUserCache(user._id);

      return res.json({
        status: 'success',
        message: `${coinsToRedeem} coins redeemed successfully. ₹${rupeesEarned} added to your wallet.`,
        data: {
          coinsRedeemed:       coinsToRedeem,
          rupeesEarned,
          walletBalance:       balanceAfter,
          remainingCoins:      user.coins,
          remainingRupees:     +(user.coins / COINS_PER_RUPEE).toFixed(2),
          totalCoinsRedeemed:  user.coinsRedeemed,
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
// § 13  REFERRAL ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

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

router.get(
  '/referral/validate',
  [query('code').notEmpty().trim().withMessage('code query param required'), validate],
  cache(300, (req) => `referral:validate:${(req.query.code || '').toUpperCase().trim()}`),
  asyncHandler(async (req, res) => {
    const code = (req.query.code ?? '').toString().toUpperCase().trim();
    if (!code || code.length < 6 || code.length > 12)
      return res.status(400).json({ success: false, data: { valid: false }, message: 'Code must be between 6 and 12 characters.' });

    const inviter = await User.findOne({ referralCode: code }).select('name referralCode').lean();
    if (!inviter)
      return res.status(404).json({ success: false, data: { valid: false }, message: 'Referral code not found.' });

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

router.post(
  '/referral/apply',
  protect,
  [body('referralCode').notEmpty().trim().withMessage('referralCode is required.'), validate],
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const newUser = await User.findById(req.user._id).session(session);
      if (!newUser) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'User not found.' }); }
      if (newUser.referredBy) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Referral code already applied.' }); }

      const code    = req.body.referralCode.trim().toUpperCase();
      const inviter = await User.findOne({ referralCode: code }).session(session);
      if (!inviter) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Invalid referral code.' }); }
      if (inviter._id.equals(newUser._id)) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'You cannot use your own referral code.' }); }

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
// § 14  CUSTOMER SETTINGS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/settings',
  protect,
  cache(30, (req) => `user:${req.user._id}:settings`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select('name email phone avatar role isEmailVerified isPhoneVerified googleAuth.googleId googleAuth.isVerified referralCode coins coinsEarned coinsRedeemed coinsInRupees lastLoginAt lastLoginIp loginCount lastActiveAt termsAcceptedAt privacyPolicyAcceptedAt createdAt')
      .lean({ virtuals: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({
      success: true,
      data: {
        profile:      { name: user.name, email: user.email, phone: user.phone ?? null, avatar: user.avatar, role: user.role },
        verification: { isEmailVerified: user.isEmailVerified, isPhoneVerified: user.isPhoneVerified, isGoogleLinked: !!(user.googleAuth?.googleId), googleVerified: user.googleAuth?.isVerified ?? false },
        coins:        { balance: user.coins, balanceRupees: user.coinsInRupees, earned: user.coinsEarned, redeemed: user.coinsRedeemed },
        referralCode: user.referralCode,
        activity:     { lastLoginAt: user.lastLoginAt, lastLoginIp: user.lastLoginIp, loginCount: user.loginCount, lastActiveAt: user.lastActiveAt, memberSince: user.createdAt },
        legal:        { termsAcceptedAt: user.termsAcceptedAt ?? null, privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt ?? null },
      },
    });
  })
);

router.post(
  '/settings/verify-phone',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+otp +otpExpires');
    if (!user)              return res.status(404).json({ message: 'User not found.' });
    if (!user.phone)        return res.status(400).json({ message: 'No phone number on account.' });
    if (user.isPhoneVerified) return res.status(400).json({ message: 'Phone is already verified.' });

    const otp = generateOtp();
    user.otp        = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60_000);
    await user.save();
    await sendSms({ to: user.phone, message: otpSms({ otpCode: otp, purpose: 'phone verification' }) })
      .catch((e) => log.warn('Phone verify SMS failed', { err: e.message }));
    return res.json({ message: 'OTP sent to your registered phone number.' });
  })
);

router.post(
  '/settings/verify-phone/confirm',
  protect,
  [body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'), validate],
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      _id: req.user._id, otp: req.body.otp, otpExpires: { $gt: Date.now() },
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

router.post(
  '/settings/request-email-change',
  protect,
  [body('newEmail').isEmail().normalizeEmail().withMessage('Valid new email required'), validate],
  asyncHandler(async (req, res) => {
    const { newEmail } = req.body;
    if (newEmail === req.user.email) return res.status(400).json({ message: 'New email is the same as your current email.' });

    const conflict = await User.findOne({ email: newEmail });
    if (conflict) return res.status(409).json({ message: 'That email address is already in use.' });

    const user = await User.findById(req.user._id).select('+otp +otpExpires');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const otp = generateOtp();
    user.otp        = `${otp}|${newEmail}`;
    user.otpExpires = new Date(Date.now() + 15 * 60_000);
    await user.save();

    await sendEmail({
      email:   user.email,
      subject: 'Confirm Your Email Change — Likeson',
      html:    otpTemplate({
        header: 'EMAIL CHANGE',
        title:  'Confirm your email change request',
        body:   `Enter this code to change your email to ${newEmail}. It expires in 15 minutes.`,
        otpCode: otp,
      }),
    }).catch((e) => log.warn('Email change OTP send failed', { err: e.message }));

    return res.json({ message: 'OTP sent to your current email address.' });
  })
);

router.post(
  '/settings/confirm-email-change',
  protect,
  [body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'), validate],
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      _id: req.user._id, otpExpires: { $gt: Date.now() },
    }).select('+otp +otpExpires');

    if (!user || !user.otp) return res.status(400).json({ message: 'No pending email change request.' });

    const [storedOtp, newEmail] = (user.otp ?? '').split('|');
    if (storedOtp !== req.body.otp || !newEmail)
      return res.status(400).json({ message: 'Invalid or expired OTP.' });

    const conflict = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
    if (conflict) {
      user.otp        = undefined;
      user.otpExpires = undefined;
      await user.save();
      return res.status(409).json({ message: 'That email address is already in use.' });
    }

    const oldEmail    = user.email;
    user.email        = newEmail;
    user.isEmailVerified = false;
    user.otp          = undefined;
    user.otpExpires   = undefined;
    await user.save();
    await invalidateUserCache(user._id);

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
    return res.json({ success: true, message: 'Email changed successfully. Please verify your new email address.', newEmail });
  })
);

router.delete(
  '/settings/google-unlink',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.googleAuth?.googleId) return res.status(400).json({ message: 'No Google account is linked.' });
    if (!user.password) return res.status(400).json({ message: 'Cannot unlink Google — set a password first.' });

    user.googleAuth = { googleId: undefined, isVerified: false };
    await user.save();
    await invalidateUserCache(user._id);

    log.info('Google unlinked', { userId: user._id });
    return res.json({ success: true, message: 'Google account unlinked successfully.' });
  })
);

router.get(
  '/settings/activity',
  protect,
  cache(30, (req) => `user:${req.user._id}:activity`),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select('auditSessions deviceTokens lastLoginAt lastLoginIp loginCount lastActiveAt isOnline passwordChangedAt')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const sessions = (user.auditSessions ?? [])
      .slice()
      .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt))
      .slice(0, 10);

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
    if (!acceptTerms && !acceptPrivacy)
      return res.status(400).json({ message: 'Provide acceptTerms and/or acceptPrivacy.' });

    const $set = {};
    if (acceptTerms   === true) $set.termsAcceptedAt         = new Date();
    if (acceptPrivacy === true) $set.privacyPolicyAcceptedAt = new Date();

    await User.findByIdAndUpdate(req.user._id, { $set });
    await invalidateUserCache(req.user._id);
    return res.json({ success: true, message: 'Legal acceptance recorded.', updated: $set });
  })
);

router.post(
  '/settings/deactivate',
  protect,
  [body('password').exists().withMessage('Password confirmation required'), validate],
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!(await bcrypt.compare(req.body.password, user.password)))
      return res.status(401).json({ message: 'Incorrect password.' });

    user.isBlocked     = true;
    user.blockReason   = 'User requested deactivation.';
    user.unblockAt     = new Date('2099-01-01T00:00:00.000Z');
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
    return res.json({ success: true, message: 'Account deactivated. Contact support to reactivate your account.' });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 15  ADMIN / SUPERADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/admin/users',
  protect,
  // 1. Removed authorize() so all authenticated users can hit this endpoint.
  // 2. Updated the cache key to factor in the user's role, preventing cross-role cache leaks.
  cache(60, (req) => `admin:users:${req.user.role}:${req.originalUrl}`),
  asyncHandler(async (req, res) => {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;
    const filter = {};

    // Check if the requesting user has elevated privileges
    const isPrivileged = ['superadmin', 'admin'].includes(req.user.role);

    if (isPrivileged) {
      // Admins & Superadmins can view and filter any role
      if (req.query.role) filter.role = req.query.role;
    } else {
      // Regular users can ONLY see Admins & Superadmins
      const allowedRoles = ['superadmin', 'admin'];
      
      if (req.query.role) {
        // If a regular user specifically filters by a role, verify it is allowed
        if (allowedRoles.includes(req.query.role)) {
          filter.role = req.query.role;
        } else {
          // If they try to fetch a restricted role (like 'doctor' or 'customer'), return empty
          return res.json({ data: [], total: 0, pages: 0, currentPage: page });
        }
      } else {
        // Default behavior for regular users: lock the filter to only show admins
        filter.role = { $in: allowedRoles };
      }
    }

    if (req.query.isBlocked !== undefined) filter.isBlocked = req.query.isBlocked === 'true';
    
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

    return res.json({ data: users, total, pages: Math.ceil(total / limit), currentPage: page });
  })
);

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
      if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User not found.' }); }

      const oldRole = user.role;
      if (oldRole === newRole) { await session.abortTransaction(); return res.status(400).json({ message: 'User already has this role.' }); }

      user.role = newRole;
      await user.save({ session });

      const OldM = getProfileModel(oldRole);
      if (OldM) await OldM.findOneAndDelete({ user: user._id }).session(session);

      const NewM = getProfileModel(newRole);
      let newProfile = null;
      if (NewM) [newProfile] = await NewM.create([{ user: user._id }], { session });

      await session.commitTransaction();
      await invalidateUserCache(user._id);
      await invalidatePattern('GET:/api/users/admin/users*');

      log.info('Role changed', { userId: user._id, from: oldRole, to: newRole, by: req.user._id });
      return res.json({ success: true, message: `Role changed: ${oldRole} → ${newRole}.`, user, newProfile });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

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
      sendSms({
        to:      user.phone,
        message: accountBlockedSms({
          name:      user.name,
          reason:    user.blockReason,
          unblockAt: unblockAt.toLocaleDateString('en-IN'),
        }),
      }).catch(() => {});
    }

    await invalidateUserCache(user._id);
    await invalidatePattern('GET:/api/users/admin/users*');

    log.warn('User suspended', { userId: user._id, by: req.user._id });
    return res.json({ message: `Suspended until ${unblockAt.toISOString()}.`, user });
  })
);

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
      sendSms({ to: user.phone, message: accountUnblockedSms({ name: user.name }) }).catch(() => {});
    }

    await invalidateUserCache(user._id);
    await invalidatePattern('GET:/api/users/admin/users*');

    log.info('User unblocked', { userId: user._id, by: req.user._id });
    return res.json({ message: 'User unblocked.', user });
  })
);

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

    user.coins       += coins;
    user.coinsEarned += coins;
    await user.save();
    await invalidateUserCache(user._id);

    log.info('Admin credited coins', { userId: user._id, coins, reason, by: req.user._id });
    return res.json({
      success: true,
      message: `${coins} coins credited to ${user.name}.`,
      data:    { userId: user._id, newBalance: user.coins, reason },
    });
  })
);

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


// GET /cookie-consent  → get current user's consent state
router.get(
  '/cookie-consent',
  protect,
  asyncHandler(async (req, res) => {
    const consent = await CookieConsent.findOne({ user: req.user._id }).lean();
    return res.json({
      success: true,
      data: consent ?? {
        consentGiven: false,
        preferences: {
          necessary: true,
          analytics: false,
          marketing: false,
          functional: false,
        },
      },
    });
  })
);

// POST /cookie-consent  → accept all or custom
// body: { acceptAll: true }
//   OR
// body: { preferences: { analytics: true, marketing: false, functional: true } }
router.post(
  '/cookie-consent',
  protect,
  [
    body('acceptAll').optional().isBoolean(),
    body('preferences.analytics').optional().isBoolean(),
    body('preferences.marketing').optional().isBoolean(),
    body('preferences.functional').optional().isBoolean(),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { acceptAll, preferences } = req.body;

    const prefs = acceptAll
      ? { necessary: true, analytics: true, marketing: true, functional: true }
      : {
          necessary:  true, // always true
          analytics:  preferences?.analytics  ?? false,
          marketing:  preferences?.marketing  ?? false,
          functional: preferences?.functional ?? false,
        };

    const consent = await CookieConsent.findOneAndUpdate(
      { user: req.user._id },
      {
        user:         req.user._id,
        preferences:  prefs,
        consentGiven: true,
        consentAt:    new Date(),
        updatedAt:    new Date(),
        ipAddress:    req.deviceInfo?.ipAddress,
        userAgent:    req.deviceInfo?.userAgent,
        version:      '1.0',
      },
      { upsert: true, new: true, runValidators: true }
    );

    log.info('Cookie consent saved', { userId: req.user._id, acceptAll: !!acceptAll });
    return res.json({ success: true, message: 'Cookie preferences saved.', data: consent });
  })
);

// PATCH /cookie-consent  → update specific categories
router.patch(
  '/cookie-consent',
  protect,
  [
    body('preferences').isObject().withMessage('preferences object required'),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const { preferences } = req.body;

    const allowed = ['analytics', 'marketing', 'functional'];
    const updates = {};
    for (const key of allowed) {
      if (typeof preferences[key] === 'boolean') {
        updates[`preferences.${key}`] = preferences[key];
      }
    }

    if (!Object.keys(updates).length)
      return res.status(400).json({ message: 'No valid preferences provided.' });

    const consent = await CookieConsent.findOneAndUpdate(
      { user: req.user._id },
      { $set: { ...updates, updatedAt: new Date(), ipAddress: req.deviceInfo?.ipAddress } },
      { new: true, upsert: true }
    );

    return res.json({ success: true, message: 'Preferences updated.', data: consent });
  })
);

// DELETE /cookie-consent  → withdraw consent (GDPR right to withdraw)
router.delete(
  '/cookie-consent',
  protect,
  asyncHandler(async (req, res) => {
    await CookieConsent.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          consentGiven: false,
          preferences:  { necessary: true, analytics: false, marketing: false, functional: false },
          updatedAt:    new Date(),
        },
      }
    );
    log.info('Cookie consent withdrawn', { userId: req.user._id });
    return res.json({ success: true, message: 'Cookie consent withdrawn.' });
  })
);

// ADMIN: GET /admin/user/:id/cookie-consent
router.get(
  '/admin/user/:id/cookie-consent',
  protect,
  authorize('superadmin', 'admin'),
  [param('id').isMongoId(), validate],
  asyncHandler(async (req, res) => {
    const consent = await CookieConsent.findOne({ user: req.params.id }).lean();
    if (!consent) return res.status(404).json({ message: 'No consent record found.' });
    return res.json({ success: true, data: consent });
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 16  CENTRALISED ERROR BOUNDARY
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