/**
 * @file    referralRoutes.js
 * @version 2.0.0
 *
 * KEY DESIGN DECISIONS:
 *
 * attachPendingReferral(newUserId, referralCode)
 *   - Accepts a userId (string/ObjectId), NOT a Mongoose document.
 *   - Does its own fresh DB reads so it is safe to call after a transaction commits.
 *   - Saves newUser.referredByCode = code  ← THE critical field processReferralReward needs.
 *
 * processReferralReward(userId)
 *   - Accepts a userId (string/ObjectId), NOT a Mongoose document.
 *   - Always re-fetches from DB inside a transaction (race-safe, stale-doc-safe).
 *   - Referrer  gets COINS_PER_REFERRAL  = 1000 coins + ₹10 wallet credit.
 *   - Invitee   gets REFEREE_COINS_BONUS =  500 coins + ₹5  wallet credit.
 *   - Referral entry: pending → completed.
 *   - Sets referralRewardCredited = true (idempotency guard — fires exactly once).
 */

import express   from 'express';
import mongoose  from 'mongoose';
import { body, param, query, validationResult } from 'express-validator';

import User   from '../models/User.js';
import Wallet from '../models/Wallet.js';

import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler           from '../utils/asyncHandler.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const COINS_PER_REFERRAL  = 1_000;  // referrer earns per completed referral
export const REFEREE_COINS_BONUS =   500;  // invitee earns on first login
export const POINTS_PER_RUPEE    =   100;  // 100 coins = ₹1
export const MIN_REDEEM_POINTS   =   500;  // minimum to redeem

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────

const log = {
  info:  (msg, meta = {}) => console.log( `✅  [REFERRAL] ${msg}`, meta),
  warn:  (msg, meta = {}) => console.warn(`⚠️  [REFERRAL] ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`❌  [REFERRAL] ${msg}`, meta),
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ status: 'fail', errors: errors.array() });
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// WALLET HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getOrCreateWallet = async (userId, session = null) => {
  const opts = session ? { session } : {};
  let wallet = await Wallet.findOne({ user: userId }, null, opts);
  if (!wallet) {
    const docs = await Wallet.create([{ user: userId, balance: 0 }], opts);
    wallet = docs[0];
  }
  return wallet;
};

const creditWallet = async ({ userId, amount, purpose, description, session = null }) => {
  const wallet        = await getOrCreateWallet(userId, session);
  const balanceBefore = wallet.balance;
  const balanceAfter  = +(balanceBefore + amount).toFixed(2);
  const opts          = session ? { session } : {};
  wallet.balance = balanceAfter;
  wallet.transactions.push({
    type: 'Credit', amount, purpose, description,
    balanceBefore, balanceAfter, status: 'Success',
  });
  await wallet.save(opts);
  return wallet;
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED CORE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * attachPendingReferral
 *
 * Call at SIGNUP when the new user provides a referral code.
 * Must run AFTER the signup transaction has committed.
 *
 * @param {string|mongoose.Types.ObjectId} newUserId
 * @param {string}                         referralCode
 * @returns {Promise<boolean>}
 */
export async function attachPendingReferral(newUserId, referralCode) {
  if (!referralCode || !newUserId) return false;

  const code = String(referralCode).trim().toUpperCase();

  // Fresh reads — never trust an in-memory doc from another transaction
  const [newUser, referrer] = await Promise.all([
    User.findById(newUserId),
    User.findOne({ referralCode: code }),
  ]);

  if (!newUser)  { log.warn('attachPendingReferral: newUser not found', { newUserId }); return false; }
  if (!referrer) { log.warn('attachPendingReferral: referrer not found', { code });     return false; }

  // Self-referral guard
  if (referrer._id.toString() === newUser._id.toString()) return false;

  // ── Save referredByCode on the invitee (the key field processReferralReward reads) ──
  if (newUser.referredByCode !== code) {
    newUser.referredByCode = code;
    await newUser.save();
    log.info('referredByCode saved on invitee', { newUserId: newUser._id, code });
  }

  // ── Create pending entry on referrer (idempotent) ──────────────────────────
  const alreadyListed = (referrer.referrals ?? []).some(
    (r) => r.referredUser?.toString() === newUser._id.toString()
  );

  if (!alreadyListed) {
    if (!Array.isArray(referrer.referrals)) referrer.referrals = [];
    referrer.referrals.push({
      referredUser:      newUser._id,
      referredUserName:  newUser.name,
      referredUserEmail: newUser.email,
      pointsAwarded:     0,
      status:            'pending',
    });
    await referrer.save();
    log.info('Pending referral entry created on referrer', { referrerId: referrer._id, newUserId: newUser._id });
  }

  return true;
}

/**
 * processReferralReward
 *
 * Call on every LOGIN. Idempotency guard ensures coins are awarded exactly once.
 *
 * Flow:
 *   1. Pre-check (no session): if already rewarded or no referredByCode → return false.
 *   2. Open transaction.
 *   3. Re-fetch invitee + referrer with write-lock.
 *   4. Credit 500 coins + ₹5 wallet to invitee.
 *   5. Credit 1000 coins + ₹10 wallet to referrer.
 *   6. Update referral entry: pending → completed.
 *   7. Set invitee.referralRewardCredited = true.
 *   8. Commit.
 *
 * @param {string|mongoose.Types.ObjectId} userId  — the user who just logged in
 * @returns {Promise<boolean>}
 */
export async function processReferralReward(userId) {
  if (!userId) return false;

  // ── Pre-check (cheap, no session) ─────────────────────────────────────────
  const preCheck = await User.findById(userId)
    .select('referralRewardCredited referredByCode')
    .lean();

  if (!preCheck)                        return false;
  if (preCheck.referralRewardCredited)  return false;  // already awarded
  if (!preCheck.referredByCode)         return false;  // no referral code on record

  // Find referrer
  const referrer = await User.findOne({ referralCode: preCheck.referredByCode });
  if (!referrer) {
    log.warn('processReferralReward: referrer not found', { code: preCheck.referredByCode, userId });
    return false;
  }
  if (referrer._id.toString() === userId.toString()) return false;

  // ── Transaction ────────────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Re-fetch inside transaction (final idempotency check + write-lock)
    const invitee = await User.findById(userId).session(session);
    if (!invitee || invitee.referralRewardCredited) {
      await session.abortTransaction();
      return false;
    }

    const lockedReferrer = await User.findById(referrer._id).session(session);
    if (!lockedReferrer) {
      await session.abortTransaction();
      return false;
    }

    const now = new Date();

    // ── 1. Credit invitee 500 coins ────────────────────────────────────────
    invitee.redeemPoints           = (invitee.redeemPoints ?? 0) + REFEREE_COINS_BONUS;
    invitee.referredBy             = lockedReferrer._id;
    invitee.referralRewardCredited = true;
    await invitee.save({ session });

    // ── 2. Credit referrer 1000 coins ──────────────────────────────────────
    lockedReferrer.redeemPoints = (lockedReferrer.redeemPoints ?? 0) + COINS_PER_REFERRAL;

    // Update pending → completed
    const entry = (lockedReferrer.referrals ?? []).find(
      (r) => r.referredUser?.toString() === invitee._id.toString()
    );

    if (entry) {
      entry.status        = 'completed';
      entry.pointsAwarded = COINS_PER_REFERRAL;
      entry.completedAt   = now;
    } else {
      // Fallback: entry was never pre-created (code added late)
      if (!Array.isArray(lockedReferrer.referrals)) lockedReferrer.referrals = [];
      lockedReferrer.referrals.push({
        referredUser:      invitee._id,
        referredUserName:  invitee.name,
        referredUserEmail: invitee.email,
        pointsAwarded:     COINS_PER_REFERRAL,
        status:            'completed',
        completedAt:       now,
      });
    }

    await lockedReferrer.save({ session });

    // ── 3. Credit both wallets ─────────────────────────────────────────────
    const inviteeRupees  = +(REFEREE_COINS_BONUS / POINTS_PER_RUPEE).toFixed(2); // ₹5
    const referrerRupees = +(COINS_PER_REFERRAL  / POINTS_PER_RUPEE).toFixed(2); // ₹10

    await creditWallet({
      userId:      invitee._id,
      amount:      inviteeRupees,
      purpose:     'Referral_Bonus',
      description: `Welcome bonus: ${REFEREE_COINS_BONUS} coins → ₹${inviteeRupees}`,
      session,
    });

    await creditWallet({
      userId:      lockedReferrer._id,
      amount:      referrerRupees,
      purpose:     'Referral_Bonus',
      description: `Referral reward for inviting ${invitee.name}: ${COINS_PER_REFERRAL} coins → ₹${referrerRupees}`,
      session,
    });

    await session.commitTransaction();

    log.info('Referral reward processed ✔', {
      inviteeId:      invitee._id,
      referrerId:     lockedReferrer._id,
      inviteeCoins:   REFEREE_COINS_BONUS,
      referrerCoins:  COINS_PER_REFERRAL,
      inviteeRupees,
      referrerRupees,
    });

    return true;

  } catch (err) {
    await session.abortTransaction();
    log.error('Referral reward transaction failed', { err: err.message, userId });
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USER-FACING ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/referral/my-code
 * @access  Protected
 */
router.get(
  '/my-code',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select('referralCode redeemPoints referrals name email');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    const baseUrl      = process.env.FRONTEND_URL ?? 'https://likeson.in';
    const shareableUrl = `${baseUrl}/signup?ref=${user.referralCode}`;

    const successfulReferrals = (user.referrals ?? []).filter((r) => r.status === 'completed').length;
    const pendingReferrals    = (user.referrals ?? []).filter((r) => r.status === 'pending').length;

    return res.json({
      status: 'success',
      data: {
        referralCode:     user.referralCode,
        shareableUrl,
        redeemPoints:     user.redeemPoints ?? 0,
        coinsValue:       `₹${((user.redeemPoints ?? 0) / POINTS_PER_RUPEE).toFixed(2)}`,
        successfulReferrals,
        pendingReferrals,
        coinsPerReferral: COINS_PER_REFERRAL,
        refereeBonus:     REFEREE_COINS_BONUS,
        minRedeemPoints:  MIN_REDEEM_POINTS,
        pointsPerRupee:   POINTS_PER_RUPEE,
      },
    });
  })
);

/**
 * @route   GET /api/referral/my-referrals
 * @access  Protected
 */
router.get(
  '/my-referrals',
  protect,
  [
    query('status').optional().isIn(['pending', 'completed']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip   = (page - 1) * limit;
    const status = req.query.status;

    const user = await User.findById(req.user._id).select('referrals redeemPoints').lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    let referrals = user.referrals ?? [];
    if (status) referrals = referrals.filter((r) => r.status === status);
    referrals.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));

    const total     = referrals.length;
    const paginated = referrals.slice(skip, skip + limit);

    const totalEarned = (user.referrals ?? [])
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + (r.pointsAwarded ?? 0), 0);

    return res.json({
      status: 'success',
      data: {
        referrals: paginated,
        summary: {
          totalReferrals:     (user.referrals ?? []).length,
          completedReferrals: (user.referrals ?? []).filter((r) => r.status === 'completed').length,
          pendingReferrals:   (user.referrals ?? []).filter((r) => r.status === 'pending').length,
          totalCoinsEarned:   totalEarned,
          totalRupeesEarned:  `₹${(totalEarned / POINTS_PER_RUPEE).toFixed(2)}`,
          currentCoins:       user.redeemPoints ?? 0,
        },
        pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
      },
    });
  })
);

/**
 * @route   POST /api/referral/redeem-coins
 * @access  Protected
 */
router.post(
  '/redeem-coins',
  protect,
  [
    body('points').isInt({ min: MIN_REDEEM_POINTS })
      .withMessage(`Minimum ${MIN_REDEEM_POINTS} coins required for redemption.`),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const pointsToRedeem = parseInt(req.body.points, 10);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(req.user._id).session(session);
      if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User not found.' }); }

      if ((user.redeemPoints ?? 0) < pointsToRedeem) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient coins. You have ${user.redeemPoints ?? 0} coins (₹${((user.redeemPoints ?? 0) / POINTS_PER_RUPEE).toFixed(2)}).`,
        });
      }

      const rupeesEarned    = +(pointsToRedeem / POINTS_PER_RUPEE).toFixed(2);
      user.redeemPoints     = (user.redeemPoints ?? 0) - pointsToRedeem;
      await user.save({ session });

      const wallet = await creditWallet({
        userId:      user._id,
        amount:      rupeesEarned,
        purpose:     'Referral_Bonus',
        description: `${pointsToRedeem} coins redeemed → ₹${rupeesEarned}`,
        session,
      });

      await session.commitTransaction();
      log.info('Coins redeemed', { userId: user._id, pointsToRedeem, rupeesEarned });

      return res.json({
        status:  'success',
        message: `${pointsToRedeem} coins successfully converted to ₹${rupeesEarned}.`,
        data: {
          pointsRedeemed: pointsToRedeem,
          rupeesEarned,
          walletBalance:  wallet.balance,
          remainingCoins: user.redeemPoints,
          remainingValue: `₹${(user.redeemPoints / POINTS_PER_RUPEE).toFixed(2)}`,
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

/**
 * @route   GET /api/referral/validate/:code
 * @access  Public
 */
router.get(
  '/validate/:code',
  [param('code').isAlphanumeric().isLength({ min: 6, max: 10 }), validate],
  asyncHandler(async (req, res) => {
    const code     = req.params.code.trim().toUpperCase();
    const referrer = await User.findOne({ referralCode: code }).select('name role referralCode').lean();
    if (!referrer) return res.status(404).json({ status: 'fail', message: 'Referral code not found.' });
    return res.json({
      status: 'success',
      data: { valid: true, referralCode: code, referrerName: referrer.name.split(' ')[0], refereeBonus: REFEREE_COINS_BONUS, bonusValue: `₹${(REFEREE_COINS_BONUS / POINTS_PER_RUPEE).toFixed(2)}` },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ANALYTICS ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/overview', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [overviewResult] = await User.aggregate([
    { $unwind: { path: '$referrals', preserveNullAndEmpty: false } },
    {
      $group: {
        _id: null,
        totalInvites:       { $sum: 1 },
        completedReferrals: { $sum: { $cond: [{ $eq: ['$referrals.status', 'completed'] }, 1, 0] } },
        pendingReferrals:   { $sum: { $cond: [{ $eq: ['$referrals.status', 'pending']   }, 1, 0] } },
        totalCoinsAwarded:  { $sum: '$referrals.pointsAwarded' },
        recentCompleted:    { $sum: { $cond: [{ $and: [{ $eq: ['$referrals.status', 'completed'] }, { $gte: ['$referrals.completedAt', thirtyDaysAgo] }] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0, totalInvites: 1, completedReferrals: 1, pendingReferrals: 1, totalCoinsAwarded: 1,
        totalRupeesDistributed: { $round: [{ $divide: ['$totalCoinsAwarded', POINTS_PER_RUPEE] }, 2] },
        conversionRate: { $cond: [{ $eq: ['$totalInvites', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$completedReferrals', '$totalInvites'] }, 100] }, 1] }] },
        recentCompleted30d: '$recentCompleted',
      },
    },
  ]);

  const activeReferrers = await User.countDocuments({ 'referrals.0': { $exists: true } });
  return res.json({
    status: 'success',
    data: {
      ...(overviewResult ?? { totalInvites: 0, completedReferrals: 0, pendingReferrals: 0, totalCoinsAwarded: 0, totalRupeesDistributed: 0, conversionRate: 0, recentCompleted30d: 0 }),
      activeReferrers, coinsPerReferral: COINS_PER_REFERRAL, refereeBonus: REFEREE_COINS_BONUS,
    },
  });
}));

router.get('/admin/leaderboard', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const page  = Math.max(parseInt(req.query.page)  || 1, 1);
  const skip  = (page - 1) * limit;

  const leaderboard = await User.aggregate([
    { $match: { 'referrals.0': { $exists: true } } },
    {
      $project: {
        name: 1, email: 1, role: 1, avatar: 1, redeemPoints: 1, referralCode: 1, createdAt: 1,
        successfulReferrals: { $size: { $filter: { input: { $ifNull: ['$referrals', []] }, as: 'r', cond: { $eq: ['$$r.status', 'completed'] } } } },
        pendingReferrals:    { $size: { $filter: { input: { $ifNull: ['$referrals', []] }, as: 'r', cond: { $eq: ['$$r.status', 'pending']   } } } },
        totalCoinsEarned:    { $sum: { $map: { input: { $ifNull: ['$referrals', []] }, as: 'r', in: { $ifNull: ['$$r.pointsAwarded', 0] } } } },
      },
    },
    { $addFields: { totalRupeesEarned: { $round: [{ $divide: ['$totalCoinsEarned', POINTS_PER_RUPEE] }, 2] } } },
    { $sort: { successfulReferrals: -1, totalCoinsEarned: -1 } },
    { $skip: skip }, { $limit: limit },
  ]);

  const totalCount = await User.countDocuments({ 'referrals.0': { $exists: true } });
  return res.json({
    status: 'success',
    data: { leaderboard: leaderboard.map((u, i) => ({ rank: skip + i + 1, ...u })), pagination: { total: totalCount, page, pages: Math.ceil(totalCount / limit) || 1, limit } },
  });
}));

router.get('/admin/user/:userId', protect, authorize('superadmin', 'admin'), [param('userId').isMongoId(), validate], asyncHandler(async (req, res) => {
  const [user, wallet] = await Promise.all([
    User.findById(req.params.userId).select('name email phone role avatar referralCode referredByCode referredBy redeemPoints referrals referralRewardCredited createdAt').populate('referredBy', 'name email role referralCode').lean({ virtuals: true }),
    Wallet.findOne({ user: req.params.userId }).select('balance currency transactions').lean(),
  ]);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const completed        = (user.referrals ?? []).filter((r) => r.status === 'completed');
  const pending          = (user.referrals ?? []).filter((r) => r.status === 'pending');
  const totalCoinsEarned = completed.reduce((s, r) => s + (r.pointsAwarded ?? 0), 0);
  const walletRefCredits = (wallet?.transactions ?? []).filter((t) => t.purpose === 'Referral_Bonus' && t.type === 'Credit').reduce((s, t) => s + (t.amount ?? 0), 0);

  return res.json({
    status: 'success',
    data: {
      user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatar: user.avatar, createdAt: user.createdAt, referralCode: user.referralCode },
      referralSummary: { totalInvites: (user.referrals ?? []).length, completedReferrals: completed.length, pendingReferrals: pending.length, totalCoinsEarned, totalRupeesEarned: `₹${(totalCoinsEarned / POINTS_PER_RUPEE).toFixed(2)}`, currentCoins: user.redeemPoints ?? 0, currentCoinsValue: `₹${((user.redeemPoints ?? 0) / POINTS_PER_RUPEE).toFixed(2)}`, referralRewardCredited: user.referralRewardCredited },
      walletSummary: { balance: wallet?.balance ?? 0, currency: wallet?.currency ?? 'INR', totalReferralCredited: +walletRefCredits.toFixed(2) },
      referredBy: user.referredBy ?? null, referredByCode: user.referredByCode ?? null,
      referrals: { completed: completed.sort((a, b) => new Date(b.completedAt ?? 0) - new Date(a.completedAt ?? 0)), pending: pending.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)) },
    },
  });
}));

router.get('/admin/transactions', protect, authorize('superadmin'), asyncHandler(async (req, res) => {
  const page  = Math.max(parseInt(req.query.page)  || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip  = (page - 1) * limit;
  const pipeline = [
    { $unwind: '$transactions' },
    { $match: { 'transactions.purpose': 'Referral_Bonus', 'transactions.type': 'Credit' } },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userInfo', pipeline: [{ $project: { name: 1, email: 1, role: 1 } }] } },
    { $unwind: '$userInfo' },
    { $project: { _id: '$transactions._id', transactionId: '$transactions.transactionId', amount: '$transactions.amount', description: '$transactions.description', balanceBefore: '$transactions.balanceBefore', balanceAfter: '$transactions.balanceAfter', status: '$transactions.status', timestamp: '$transactions.timestamp', user: '$userInfo' } },
    { $sort: { timestamp: -1 } },
  ];
  const [countResult] = await Wallet.aggregate([...pipeline, { $count: 'total' }]);
  const total         = countResult?.total ?? 0;
  const transactions  = await Wallet.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]);
  return res.json({ status: 'success', data: transactions, pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit } });
}));

router.post('/admin/manual-award', protect, authorize('superadmin'), [body('userId').isMongoId(), body('coins').isInt({ min: 1 }), body('reason').notEmpty().trim(), validate], asyncHandler(async (req, res) => {
  const { userId, coins, reason } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User not found.' }); }
    const rupees = +(coins / POINTS_PER_RUPEE).toFixed(2);
    user.redeemPoints = (user.redeemPoints ?? 0) + coins;
    await user.save({ session });
    const wallet = await creditWallet({ userId: user._id, amount: rupees, purpose: 'Referral_Bonus', description: `Admin manual award: ${coins} coins → ₹${rupees}. Reason: ${reason}`, session });
    await session.commitTransaction();
    log.info('Manual coin award', { by: req.user._id, to: userId, coins, rupees });
    return res.json({ status: 'success', message: `${coins} coins (₹${rupees}) awarded to ${user.name}.`, data: { userId: user._id, userName: user.name, coinsAwarded: coins, rupeesAwarded: rupees, totalCoins: user.redeemPoints, walletBalance: wallet.balance } });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

router.use((err, req, res, _next) => {
  log.error('Unhandled referral router error', { message: err.message, stack: err.stack });
  return res.status(err.statusCode || 500).json({
    status: 'error', message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

export default router;