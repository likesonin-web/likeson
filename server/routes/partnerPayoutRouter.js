/**
 * Payout Routes — Likeson.in
 *
 * Mount at: /api/payouts
 *
 * ENDPOINTS:
 *
 *  POST   /bank-account               → partner adds/updates bank account
 *  POST   /upi                        → partner adds/updates UPI
 *  GET    /fund-accounts              → list partner's fund accounts
 *
 *  POST   /admin/settle/:partnerType/:profileId  → admin triggers manual settlement
 *  POST   /admin/settle/batch         → admin runs settlement cycle
 *  GET    /admin/settlements          → list all settlements (admin)
 *  GET    /admin/payouts              → list all payouts (admin)
 *  POST   /admin/retry-failed         → manually trigger retry of failed payouts
 *
 *  POST   /refund                     → dispatch customer refund
 *
 *  POST   /webhook/razorpayx          → RazorpayX webhook receiver
 *
 *  GET    /my/settlements             → partner views their own settlements
 *  GET    /my/payouts                 → partner views their own payouts
 *  GET    /my/earnings                → partner views pending + total earnings
 */

import express        from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose       from 'mongoose';

import {
  createOrSyncContact,
  createFundAccount,
  handleBankUpdate,
  dispatchPayout,
  handleWebhook,
  runSettlementCycle,
  triggerManualSettlement,
  dispatchCustomerRefund,
  retryFailedPayouts,
} from '../services/payoutService.js';

import Payout      from '../models/Payout.js';
import Settlement  from '../models/Settlement.js';
import FundAccount from '../models/FundAccount.js';

const router = express.Router();

// ── Middleware placeholders ───────────────────────────────────────────────────
// Replace with your actual auth middleware

const requireAuth      = (req, res, next) => next();  // attach req.user
const requireAdmin     = (req, res, next) => next();  // check admin/superadmin role
const requireSuperAdmin= (req, res, next) => next();  // check superadmin role

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}

// ── IFSC regex ────────────────────────────────────────────────────────────────
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ══════════════════════════════════════════════════════════════════════════════
// PARTNER — BANK / UPI MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/payouts/bank-account
 *
 * Partner adds or UPDATES their bank account.
 * If they already have a fund account → safe rotation (old deactivated, new created).
 *
 * Body: { partnerType, partnerProfileId, accountHolderName, accountNumber, ifscCode, bankName }
 */
router.post(
  '/bank-account',
  requireAuth,
  [
    body('partnerType').isIn([
      'doctor','hospital','transportpartner','driver',
      'solodriverpartner','pharmacy','care_assistant','lab_partner','customer',
    ]),
    body('partnerProfileId').isMongoId(),
    body('accountHolderName').trim().notEmpty(),
    body('accountNumber').trim().notEmpty().isLength({ min: 9, max: 18 }),
    body('ifscCode').trim().notEmpty().matches(IFSC_REGEX).withMessage('Invalid IFSC'),
    body('bankName').trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        partnerType, partnerProfileId,
        accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType,
      } = req.body;

      const result = await handleBankUpdate({
        partnerType,
        partnerUserId:    req.user._id,
        partnerProfileId: new mongoose.Types.ObjectId(partnerProfileId),
        accountType:      'bank_account',
        bankDetails: {
          accountHolderName,
          accountNumber,
          ifscCode:    ifscCode.toUpperCase(),
          bankName,
          branchName:  branchName || '',
          accountType: accountType || 'savings',
        },
        updatedByUserId: req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Bank account updated. Payouts will use this account from next cycle.',
        data: {
          newFundAccountId: result.newFundAccount.razorpayFundAccountId,
          display:          result.newFundAccount.displayAccount,
        },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/payouts/upi
 *
 * Partner adds or UPDATES their UPI handle.
 * Same safe rotation logic as bank account.
 *
 * Body: { partnerType, partnerProfileId, upiAddress }
 */
router.post(
  '/upi',
  requireAuth,
  [
    body('partnerType').isIn([
      'doctor','hospital','transportpartner','driver',
      'solodriverpartner','pharmacy','care_assistant','lab_partner','customer',
    ]),
    body('partnerProfileId').isMongoId(),
    body('upiAddress').trim().notEmpty().matches(/^[\w.\-]+@[\w]+$/).withMessage('Invalid UPI ID format'),
  ],
  validate,
  async (req, res) => {
    try {
      const { partnerType, partnerProfileId, upiAddress } = req.body;

      const result = await handleBankUpdate({
        partnerType,
        partnerUserId:    req.user._id,
        partnerProfileId: new mongoose.Types.ObjectId(partnerProfileId),
        accountType:      'vpa',
        vpaDetails:       { address: upiAddress },
        updatedByUserId:  req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'UPI updated. Payouts will use this UPI from next cycle.',
        data: {
          newFundAccountId: result.newFundAccount.razorpayFundAccountId,
          display:          result.newFundAccount.displayAccount,
        },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/payouts/fund-accounts
 *
 * Partner views all their fund accounts (current + history).
 * Query: partnerType, partnerProfileId
 */
router.get(
  '/fund-accounts',
  requireAuth,
  [
    query('partnerType').notEmpty(),
    query('partnerProfileId').isMongoId(),
  ],
  validate,
  async (req, res) => {
    try {
      const { partnerProfileId } = req.query;

      const accounts = await FundAccount.find({
        partnerUserId: req.user._id,
        partnerProfileId: new mongoose.Types.ObjectId(partnerProfileId),
      })
        .select('-bank.accountNumber -razorpayRawResponse')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: accounts.map(a => ({
          ...a,
          displayAccount: a.accountType === 'bank_account'
            ? `${a.bank?.bankName} ••••${a.bank?.accountNumberLast4}`
            : `UPI: ${a.vpa?.address}`,
        })),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PARTNER — MY PAYOUTS / SETTLEMENTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/payouts/my/settlements
 * Query: page, limit, status
 */
router.get('/my/settlements', requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const filter = { partnerUserId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const [settlements, total] = await Promise.all([
      Settlement.find(filter)
        .select('-settledBookings -statusLog')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Settlement.countDocuments(filter),
    ]);

    res.json({ success: true, data: settlements, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payouts/my/settlements/:id
 * Full detail including earningLines breakdown.
 */
router.get('/my/settlements/:id', requireAuth, async (req, res) => {
  try {
    const s = await Settlement.findOne({
      _id:            req.params.id,
      partnerUserId:  req.user._id,
    }).populate('payoutId', 'payoutCode status processedAt fundAccountSnapshot').lean();

    if (!s) return res.status(404).json({ success: false, message: 'Settlement not found' });
    res.json({ success: true, data: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payouts/my/payouts
 * Query: page, limit, status
 */
router.get('/my/payouts', requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const filter = { recipientUserId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .select('-earningLines -webhookRaw -statusLog')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payout.countDocuments(filter),
    ]);

    res.json({ success: true, data: payouts, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payouts/my/earnings
 * Returns partner's current earnings snapshot.
 */
router.get('/my/earnings', requireAuth, async (req, res) => {
  try {
    const { partnerType, partnerProfileId } = req.query;
    if (!partnerType || !partnerProfileId) {
      return res.status(400).json({ success: false, message: 'partnerType + partnerProfileId required' });
    }

    const MODELS = {
      doctor: 'DoctorProfile', hospital: 'Hospital',
      transportpartner: 'TransportPartner', driver: 'Driver',
      solodriverpartner: 'SoloDriverPartner', pharmacy: 'PharmacyStore',
      lab_partner: 'LabPartnerProfile',
    };
    const ModelName = MODELS[partnerType];
    if (!ModelName) return res.status(400).json({ success: false, message: 'Invalid partnerType' });

    const profile = await mongoose.model(ModelName)
      .findById(partnerProfileId)
      .select('earnings')
      .lean();

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const e = profile.earnings || {};
    res.json({
      success: true,
      data: {
        pendingPayoutPaise:    e.pendingPayoutPaise    || 0,
        pendingPayoutRupees:   +((e.pendingPayoutPaise || 0) / 100).toFixed(2),
        totalPaidPaise:        e.totalPaidPaise        || 0,
        totalPaidRupees:       +((e.totalPaidPaise     || 0) / 100).toFixed(2),
        lifetimeEarningsPaise: e.lifetimeEarningsPaise || 0,
        lifetimeEarningsRupees: +((e.lifetimeEarningsPaise || 0) / 100).toFixed(2),
        lastPayoutAt:          e.lastPayoutAt          || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — SETTLEMENT MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/payouts/admin/settle/:partnerType/:profileId
 *
 * Admin triggers manual settlement for ONE partner.
 * Body: { periodStart?, periodEnd? }  (defaults: last 30 days)
 */
router.post(
  '/admin/settle/:partnerType/:profileId',
  requireAdmin,
  [
    param('partnerType').isIn([
      'doctor','hospital','transportpartner','driver',
      'solodriverpartner','pharmacy','care_assistant','lab_partner',
    ]),
    param('profileId').isMongoId(),
  ],
  validate,
  async (req, res) => {
    try {
      const { partnerType, profileId } = req.params;

      const periodEnd   = req.body.periodEnd   ? new Date(req.body.periodEnd)   : new Date();
      const periodStart = req.body.periodStart
        ? new Date(req.body.periodStart)
        : new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch userId from profile
      const MODELS = {
        doctor: 'DoctorProfile', hospital: 'Hospital',
        transportpartner: 'TransportPartner', driver: 'Driver',
        solodriverpartner: 'SoloDriverPartner', pharmacy: 'PharmacyStore',
        care_assistant: 'CareAssistantProfile', lab_partner: 'LabPartnerProfile',
      };
      const profile = await mongoose.model(MODELS[partnerType])
        .findById(profileId).select('user').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Partner not found' });

      const settlement = await triggerManualSettlement({
        partnerType,
        partnerUserId:    profile.user,
        partnerProfileId: new mongoose.Types.ObjectId(profileId),
        periodStart,
        periodEnd,
        cycle:            'Manual',
        trigger:          'manual',
        adminUserId:      req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Settlement triggered',
        data: {
          settlementCode:         settlement.settlementCode,
          finalPayableRupees:     settlement.finalPayableRupees,
          status:                 settlement.status,
        },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/payouts/admin/settle/batch
 *
 * Admin triggers settlement cycle for ALL eligible partners.
 * Body: { cycle }  — 'Daily'|'Weekly'|'Bi-Weekly'|'Monthly'
 */
router.post(
  '/admin/settle/batch',
  requireSuperAdmin,
  [body('cycle').isIn(['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'])],
  validate,
  async (req, res) => {
    try {
      const results = await runSettlementCycle(req.body.cycle, req.user._id);
      res.json({ success: true, data: results });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/payouts/admin/settlements
 * Query: partnerType, partnerUserId, status, page, limit
 */
router.get('/admin/settlements', requireAdmin, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 30);
    const filter = {};
    if (req.query.partnerType)   filter.partnerType   = req.query.partnerType;
    if (req.query.partnerUserId) filter.partnerUserId = req.query.partnerUserId;
    if (req.query.status)        filter.status        = req.query.status;

    const [settlements, total] = await Promise.all([
      Settlement.find(filter)
        .select('-settledBookings')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('payoutId', 'payoutCode status razorpayPayoutId')
        .lean(),
      Settlement.countDocuments(filter),
    ]);

    res.json({ success: true, data: settlements, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payouts/admin/payouts
 * Query: payoutFor, status, page, limit
 */
router.get('/admin/payouts', requireAdmin, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 30);
    const filter = {};
    if (req.query.payoutFor) filter.payoutFor = req.query.payoutFor;
    if (req.query.status)    filter.status    = req.query.status;

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .select('-earningLines -webhookRaw')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payout.countDocuments(filter),
    ]);

    res.json({ success: true, data: payouts, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/payouts/admin/retry-failed
 *
 * Manually trigger retry of all eligible failed payouts.
 */
router.post('/admin/retry-failed', requireAdmin, async (req, res) => {
  try {
    const results = await retryFailedPayouts(req.user._id);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMER REFUND
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/payouts/refund
 *
 * Admin dispatches refund to customer.
 * Body: { customerUserId, amountPaise, narration, bookingId? }
 */
router.post(
  '/refund',
  requireAdmin,
  [
    body('customerUserId').isMongoId(),
    body('amountPaise').isInt({ min: 100 }),
    body('narration').trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const payout = await dispatchCustomerRefund({
        customerUserId: new mongoose.Types.ObjectId(req.body.customerUserId),
        amountPaise:    req.body.amountPaise,
        narration:      req.body.narration,
        bookingId:      req.body.bookingId ? new mongoose.Types.ObjectId(req.body.bookingId) : undefined,
        adminUserId:    req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Refund dispatched',
        data: { payoutCode: payout.payoutCode, status: payout.status },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// RAZORPAYX WEBHOOK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/payouts/webhook/razorpayx
 *
 * RazorpayX sends webhook events here.
 * IMPORTANT: Mount this BEFORE express.json() or use express.raw() for this route
 * so we can verify the raw body signature.
 *
 * In your app.js:
 *   app.post('/api/payouts/webhook/razorpayx', express.raw({ type: '*\/*' }), payoutRouter)
 *   // OR ensure rawBody is attached by middleware
 */
router.post('/webhook/razorpayx', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing signature header' });
    }

    // rawBody must be the raw Buffer/string — ensure your middleware attaches it
    const rawBody = req.rawBody || req.body;
    const payload = typeof rawBody === 'string'
      ? JSON.parse(rawBody)
      : (Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString()) : rawBody);

    const result = await handleWebhook(
      typeof rawBody === 'string' ? rawBody : rawBody.toString(),
      signature,
      payload
    );

    res.json({ received: true, ...result });
  } catch (err) {
    // Always return 200 to Razorpay (avoid retries on logic errors)
    // Log the actual error internally
    console.error('[RazorpayX Webhook Error]', err.message, err.stack);
    res.json({ received: true, error: err.message });
  }
});

export default router;