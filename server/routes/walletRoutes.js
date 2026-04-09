/**
 * walletRouter.js — Likeson.in
 *
 * Enterprise-grade wallet router.
 *
 * Fixes & additions over the previous version:
 *  1.  Withdrawal balance validation — checks withdrawableAvailable (not raw balance).
 *      Only Add_Money + Referral_Bonus are withdrawable (WITHDRAWABLE_PURPOSES).
 *  2.  Admin /complete now calls Razorpay X Payout API directly instead of
 *      trusting a caller-supplied razorpayPayoutId.
 *  3.  SystemLog entries on every significant action (audit trail).
 *  4.  Redis cache invalidation on wallet-mutating routes.
 *  5.  Role-based access control via authorize() on all admin routes.
 *  6.  Idempotency guards on top-up verify (duplicate payment blocked).
 *  7.  All async paths wrapped in asyncHandler; centralised error handler at bottom.
 *  8.  Pagination helpers normalised; consistent response envelope.
 *  9.  P2P transfer uses wallet.availableBalance (includes locked-balance awareness).
 * 10.  Withdrawal request snapshots last-4 digits only (PCI hygiene).
 */

import express            from 'express';
import Razorpay           from 'razorpay';
import crypto             from 'crypto';
import axios              from 'axios';

import { protect, authorize } from '../middleware/authMiddleware.js';
import cache                  from '../middleware/cache.js';
import { invalidateKey, invalidatePattern } from '../utils/cacheInvalidation.js';

import Wallet, {
  TRANSFER_LIMITS,
  WITHDRAWAL_LIMITS,
  WITHDRAWABLE_PURPOSES,
}                         from '../models/Wallet.js';
import User               from '../models/User.js';
import Notification       from '../models/Notification.js';
import SystemLog          from '../models/SystemLog.js';
import sendEmail          from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || 'rzp_test_SJTh9WQJSGGnIT';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '0IT2SC59bGq578K2QnUEleFX';

/**
 * Razorpay X (Payout) uses a separate key-pair in production.
 * Falls back to the standard key for test/sandbox environments.
 */
const RAZORPAY_X_KEY_ID     = process.env.RAZORPAY_X_KEY_ID     || RAZORPAY_KEY_ID;
const RAZORPAY_X_KEY_SECRET = process.env.RAZORPAY_X_KEY_SECRET || RAZORPAY_KEY_SECRET;

/**
 * Razorpay X Fund Account ID for the platform's own payout account.
 * Required when initiating payouts from the Razorpay X API.
 */
const RAZORPAY_X_ACCOUNT_NUMBER = process.env.RAZORPAY_X_ACCOUNT_NUMBER || '';

const razorpay = new Razorpay({
  key_id:     RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Wraps an async route handler — forwards errors to Express error handler. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Structured audit console log (replace with Winston transport in production). */
const logAudit = (action, metadata = {}) =>
  console.log(
    `[AUDIT][${new Date().toISOString()}] ${action} | ${JSON.stringify(metadata)}`
  );

/**
 * Persists an entry to the SystemLog collection (non-blocking).
 * Never throws — logs errors to console only.
 */
const persistLog = async ({
  level    = 'info',
  category = 'payment',
  message,
  actor    = {},
  metadata = null,
  request  = {},
  relatedEntity = {},
}) => {
  try {
    await SystemLog.createLog({
      level,
      category,
      message,
      actor,
      metadata,
      request,
      relatedEntity,
    });
  } catch (err) {
    console.error('[SystemLog] Failed to persist:', err.message);
  }
};

/** Returns today's date string in YYYY-MM-DD (IST). */
const todayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * Finds or auto-creates a wallet for the given userId.
 * UPI ID is derived from the user's phone number on first creation.
 */
const findOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId }).lean(false);
  if (!wallet) {
    const user  = await User.findById(userId).select('phone').lean();
    const upiId = user?.phone
      ? `${user.phone.replace('+', '')}@likeson`
      : `${userId.toString().slice(-8)}@likeson`;

    wallet = await Wallet.create({ user: userId, balance: 0, transactions: [], upiId });
    logAudit('WALLET_CREATED', { userId, upiId });

    await persistLog({
      level:   'success',
      message: 'Wallet auto-created',
      actor:   { userId, role: 'customer' },
      relatedEntity: { model: 'User', entityId: userId },
      metadata: { upiId },
    });
  }
  return wallet;
};

/**
 * Invalidates cached wallet data for a user.
 * Call after any balance-mutating operation.
 */
const invalidateWalletCache = async (userId) => {
  await Promise.allSettled([
    invalidateKey(`wallet:${userId}`),
    invalidateKey(`GET:/api/wallet/me`),
    invalidatePattern(`wallet:${userId}:*`),
  ]);
};

/**
 * Dispatches in-app notification + email (non-blocking; swallows errors).
 */
const dispatchNotification = async (userId, { title, body, type, emailSubject }) => {
  try {
    await Notification.create({ recipient: userId, title, body, type, priority: 'High' });

    const user = await User.findById(userId).select('email').lean();
    if (user?.email) {
      const html = transactionalTemplate({
        header:     'LIKESON HEALTHCARE',
        title:      emailSubject || title,
        body,
        buttonText: 'View Wallet',
        buttonLink: 'https://likeson.in/wallet',
      });
      await sendEmail({
        email:   user.email,
        subject: `[Likeson] ${emailSubject || title}`,
        html,
      });
    }
  } catch (err) {
    logAudit('NOTIFICATION_FAILURE', { userId, error: err.message });
  }
};

/** Generates a shared pair transaction ID for P2P transfers. */
const generatePairTxnId = () =>
  `P2P-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * Parses a UPI deep-link URI and extracts the VPA (UPI ID).
 * e.g. "upi://pay?pa=9876543210@likeson&pn=John"
 */
const extractUpiIdFromQrString = (qrString = '') => {
  try {
    const match = qrString.match(/[?&]pa=([^&]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]).toLowerCase().trim();

    if (/^[\w.\-+]+@[\w]+$/.test(qrString.trim()))
      return qrString.trim().toLowerCase();
  } catch {
    // Malformed QR string — return null
  }
  return null;
};

/**
 * Resolves a transfer target to { receiverWallet, resolvedUpiId, mode }.
 * Supports: upi_id | phone | qr scan modes.
 */
const resolveTransferTarget = async ({ upiId, phone, qrString }) => {
  if (qrString) {
    const extractedUpiId = extractUpiIdFromQrString(qrString);
    if (!extractedUpiId) return null;
    const receiverWallet = await Wallet.findOne({ upiId: extractedUpiId });
    if (!receiverWallet) return null;
    return { receiverWallet, resolvedUpiId: extractedUpiId, mode: 'qr' };
  }

  if (upiId) {
    const normalised     = upiId.trim().toLowerCase();
    const receiverWallet = await Wallet.findOne({ upiId: normalised });
    if (!receiverWallet) return null;
    return { receiverWallet, resolvedUpiId: normalised, mode: 'upi_id' };
  }

  if (phone) {
    const normalised = phone.replace(/\D/g, '');
    const user       = await User.findOne({ phone: { $regex: normalised } }).select('_id').lean();
    if (!user) return null;
    const receiverWallet = await Wallet.findOne({ user: user._id });
    if (!receiverWallet) return null;
    return {
      receiverWallet,
      resolvedUpiId: receiverWallet.upiId || `${normalised}@likeson`,
      mode:          'phone',
    };
  }

  return null;
};

/**
 * Builds a Razorpay X Payout via the REST API.
 *
 * Razorpay X Payout API docs:
 *   https://razorpay.com/docs/api/x/payouts/create/
 *
 * Returns the full payout object on success.
 * Throws a structured error on failure (caller must handle).
 */
const initiateRazorpayXPayout = async ({
  razorpayFundAccountId,
  amount,               // in paise (integer)
  requestId,
  narration,
}) => {
  const authToken = Buffer.from(`${RAZORPAY_X_KEY_ID}:${RAZORPAY_X_KEY_SECRET}`).toString('base64');

  const payload = {
    account_number: RAZORPAY_X_ACCOUNT_NUMBER,
    fund_account_id: razorpayFundAccountId,
    amount,                                   // paise
    currency: 'INR',
    mode: 'IMPS',
    purpose: 'payout',
    queue_if_low_balance: true,
    reference_id: requestId,
    narration: narration || 'Likeson Wallet Withdrawal',
    notes: {
      source: 'likeson_wallet',
      requestId,
    },
  };

 const response = await axios.post(
  'https://api.razorpay.com/v1/payouts',
  payload,
  {
    auth: {
      username: process.env.RAZORPAY_X_KEY_ID,
      password: process.env.RAZORPAY_X_KEY_SECRET
    },
    headers: {
      'Content-Type': 'application/json'
    }
  }
);

  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagination helper
// ─────────────────────────────────────────────────────────────────────────────
const parsePagination = (query, maxLimit = 50) => ({
  page:  Math.max(1, parseInt(query.page)  || 1),
  limit: Math.min(maxLimit, parseInt(query.limit) || 20),
});

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/wallet/me ────────────────────────────────────────────────────────
/**
 * Returns the authenticated user's full wallet document.
 * Cached per-user for 30 s.
 */
router.get(
  '/me',
  protect,
  cache(30, (req) => `wallet:${req.user._id}`),
  asyncHandler(async (req, res) => {
    const wallet = await findOrCreateWallet(req.user._id);
    res.status(200).json({ success: true, wallet });
  })
);

// ── POST /api/wallet/add-money ────────────────────────────────────────────────
/**
 * Initialises a Razorpay order for wallet top-up (minimum ₹100).
 */
router.post(
  '/add-money',
  protect,
  asyncHandler(async (req, res) => {
    const { amount } = req.body;

    if (!amount || Number(amount) < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum top-up amount is ₹100',
      });
    }

    await findOrCreateWallet(req.user._id);

    const rzpOrder = await razorpay.orders.create({
      amount:   Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt:  `WALLET_${req.user._id.toString().slice(-6)}_${Date.now()}`,
      notes:    { userId: req.user._id.toString(), type: 'wallet_topup' },
    });

    logAudit('WALLET_TOPUP_INIT', {
      userId:    req.user._id,
      amount,
      rzpOrderId: rzpOrder.id,
    });

    await persistLog({
      level:   'info',
      message: 'Wallet top-up order created',
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { amount, rzpOrderId: rzpOrder.id },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    res.status(200).json({ success: true, rzpOrder, razorpayKey: RAZORPAY_KEY_ID });
  })
);

// ── POST /api/wallet/verify-topup ─────────────────────────────────────────────
/**
 * Verifies Razorpay HMAC signature and credits the wallet.
 * Idempotent — duplicate payment_ids are rejected with 409.
 */
router.post(
  '/verify-topup',
  protect,
  asyncHandler(async (req, res) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment fields',
      });
    }

    const creditAmount = Number(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }

    // 1. Verify HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    if (hmac.digest('hex') !== razorpay_signature) {
      logAudit('WALLET_TOPUP_SECURITY_ALERT', {
        userId: req.user._id,
        razorpay_order_id,
        ip: req.ip,
      });

      await persistLog({
        level:    'warning',
        category: 'security',
        message:  'Invalid Razorpay signature on wallet top-up',
        actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
        request:  { method: 'POST', path: req.originalUrl, statusCode: 400 },
        metadata: { razorpay_order_id, razorpay_payment_id },
        relatedEntity: { model: 'User', entityId: req.user._id },
      });

      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // 2. Idempotency guard
    const wallet = await findOrCreateWallet(req.user._id);
    if (wallet.transactions.some((t) => t.transactionId === razorpay_payment_id)) {
      return res.status(409).json({
        success: false,
        message: 'Payment already credited to wallet',
      });
    }

    // 3. Credit wallet (Add_Money is withdrawable — pre-save hook manages withdrawableBalance)
    await wallet.credit(creditAmount, 'Add_Money', {
      transactionId: razorpay_payment_id,
      description:   `Wallet top-up via Razorpay (Order: ${razorpay_order_id})`,
    });

    await invalidateWalletCache(req.user._id);

    logAudit('WALLET_TOPUP_SUCCESS', {
      userId:     req.user._id,
      amount:     creditAmount,
      newBalance: wallet.balance,
    });

    await persistLog({
      level:   'success',
      message: `Wallet credited ₹${creditAmount} via Razorpay`,
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { creditAmount, razorpay_payment_id, razorpay_order_id },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    dispatchNotification(req.user._id, {
      title:        'Wallet Top-Up Successful',
      body:         `₹${creditAmount.toLocaleString('en-IN')} has been added to your Likeson Wallet.`,
      type:         'Payment_Success',
      emailSubject: 'Wallet Credited — Likeson Healthcare',
    });

    const updatedWallet = await Wallet.findOne({ user: req.user._id });
    res.status(200).json({ success: true, wallet: updatedWallet });
  })
);

// ── POST /api/wallet/lookup ───────────────────────────────────────────────────
/**
 * Resolves a UPI ID / phone / QR string to the receiver's public profile.
 */
router.post(
  '/lookup',
  protect,
  asyncHandler(async (req, res) => {
    const { upiId, phone, qrString } = req.body;

    if (!upiId && !phone && !qrString) {
      return res.status(400).json({
        success: false,
        message: 'Provide one of: upiId, phone, or qrString',
      });
    }

    const result = await resolveTransferTarget({ upiId, phone, qrString });
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No Likeson wallet found for the provided identifier',
      });
    }

    const isSelf       = result.receiverWallet.user.toString() === req.user._id.toString();
    const receiverUser = await User.findById(result.receiverWallet.user)
      .select('name avatar phone')
      .lean();

    res.status(200).json({
      success: true,
      isSelf,
      receiver: {
        name:   receiverUser?.name  || 'Likeson User',
        upiId:  result.resolvedUpiId,
        avatar: receiverUser?.avatar || null,
        mode:   result.mode,
      },
    });
  })
);

// ── POST /api/wallet/transfer ─────────────────────────────────────────────────
/**
 * Sends money from the authenticated user's wallet to another Likeson wallet.
 *
 * Body: { amount, note?, upiId | phone | qrString }
 *
 * NOTE: P2P transfers debit from availableBalance (total – locked).
 * Transferred funds arrive as P2P_Receive on the receiver side, which is
 * NOT in WITHDRAWABLE_PURPOSES — recipients cannot withdraw P2P money.
 * Only Add_Money + Referral_Bonus credits are withdrawable.
 */
router.post(
  '/transfer',
  protect,
  asyncHandler(async (req, res) => {
    const { amount, note, upiId, phone, qrString } = req.body;

    // 1. Validate amount
    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount < TRANSFER_LIMITS.MIN_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Minimum transfer amount is ₹${TRANSFER_LIMITS.MIN_AMOUNT}`,
      });
    }
    if (transferAmount > TRANSFER_LIMITS.MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Maximum transfer per transaction is ₹${TRANSFER_LIMITS.MAX_AMOUNT.toLocaleString('en-IN')}`,
      });
    }

    // 2. Validate identifier
    if (!upiId && !phone && !qrString) {
      return res.status(400).json({
        success: false,
        message: 'Provide one of: upiId, phone, or qrString',
      });
    }

    // 3. Resolve receiver
    const target = await resolveTransferTarget({ upiId, phone, qrString });
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'No Likeson wallet found for the provided identifier',
      });
    }
    const { receiverWallet, resolvedUpiId, mode } = target;

    // 4. Self-transfer guard
    if (receiverWallet.user.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer money to yourself',
      });
    }

    // 5. Load sender wallet
    const senderWallet = await findOrCreateWallet(req.user._id);

    if (!senderWallet.isActive) {
      return res.status(403).json({ success: false, message: 'Your wallet is currently inactive' });
    }
    if (!receiverWallet.isActive) {
      return res.status(403).json({ success: false, message: 'Recipient wallet is currently inactive' });
    }

    // 6. Available balance check (balance − lockedBalance)
    if (senderWallet.availableBalance < transferAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${senderWallet.availableBalance.toLocaleString('en-IN')}`,
      });
    }

    // 7. Daily limit check
    const todayTotal = senderWallet.getDailyTransferTotal();
    if (todayTotal + transferAmount > TRANSFER_LIMITS.DAILY_LIMIT) {
      const remaining = +(TRANSFER_LIMITS.DAILY_LIMIT - todayTotal).toFixed(2);
      return res.status(400).json({
        success: false,
        message: `Daily transfer limit reached. Remaining today: ₹${remaining.toLocaleString('en-IN')}`,
      });
    }

    // 8. Execute transfer
    const pairTxnId  = generatePairTxnId();
    const timestamp  = new Date();

    const [receiverUser, senderUser] = await Promise.all([
      User.findById(receiverWallet.user).select('name').lean(),
      User.findById(req.user._id).select('name').lean(),
    ]);

    // Debit sender
    const senderBalanceBefore    = senderWallet.balance;
    senderWallet.balance         = +(senderWallet.balance - transferAmount).toFixed(2);
    senderWallet.transactions.push({
      type:              'Debit',
      amount:            transferAmount,
      purpose:           'P2P_Send',
      status:            'Success',
      balanceBefore:     senderBalanceBefore,
      balanceAfter:      senderWallet.balance,
      pairTxnId,
      counterpartyId:    receiverWallet.user,
      counterpartyUpiId: resolvedUpiId,
      transferMode:      mode,
      description:       `Sent to ${receiverUser?.name || resolvedUpiId}`,
      note:              note || undefined,
      timestamp,
    });
    senderWallet.incrementDailyTransfer(transferAmount);
    senderWallet._newTxnCount = 1;

    // Credit receiver
    const receiverBalanceBefore    = receiverWallet.balance;
    receiverWallet.balance         = +(receiverWallet.balance + transferAmount).toFixed(2);
    receiverWallet.transactions.push({
      type:              'Credit',
      amount:            transferAmount,
      purpose:           'P2P_Receive',   // NOT withdrawable — intentional
      status:            'Success',
      balanceBefore:     receiverBalanceBefore,
      balanceAfter:      receiverWallet.balance,
      pairTxnId,
      counterpartyId:    req.user._id,
      counterpartyUpiId: senderWallet.upiId || `${req.user._id.toString().slice(-8)}@likeson`,
      transferMode:      mode,
      description:       `Received from ${senderUser?.name || 'Likeson User'}`,
      note:              note || undefined,
      timestamp,
    });
    receiverWallet._newTxnCount = 1;

    // Save both (true atomicity requires MongoDB replica-set sessions)
    await Promise.all([senderWallet.save(), receiverWallet.save()]);
    await Promise.all([
      invalidateWalletCache(req.user._id),
      invalidateWalletCache(receiverWallet.user),
    ]);

    logAudit('P2P_TRANSFER_SUCCESS', {
      senderId: req.user._id,
      receiverId: receiverWallet.user,
      amount:   transferAmount,
      pairTxnId,
      mode,
      resolvedUpiId,
    });

    await persistLog({
      level:   'success',
      message: `P2P transfer ₹${transferAmount} via ${mode}`,
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: {
        transferAmount,
        pairTxnId,
        mode,
        resolvedUpiId,
        receiverId: receiverWallet.user,
      },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    // 9. Notifications (non-blocking)
    const amtFmt = `₹${transferAmount.toLocaleString('en-IN')}`;
    dispatchNotification(req.user._id, {
      title:        'Money Sent',
      body:         `${amtFmt} sent to ${receiverUser?.name || resolvedUpiId} successfully.`,
      type:         'Payment_Success',
      emailSubject: 'Transfer Successful — Likeson Wallet',
    });
    dispatchNotification(receiverWallet.user, {
      title:        'Money Received',
      body:         `${amtFmt} received from ${senderUser?.name || 'Likeson User'}.`,
      type:         'Payment_Success',
      emailSubject: 'You Received Money — Likeson Wallet',
    });

    res.status(200).json({
      success: true,
      message: `${amtFmt} sent successfully`,
      transfer: {
        pairTxnId,
        amount:        transferAmount,
        mode,
        receiverUpiId: resolvedUpiId,
        receiverName:  receiverUser?.name || 'Likeson User',
        newBalance:    senderWallet.balance,
      },
    });
  })
);

// ── GET /api/wallet/transfers ─────────────────────────────────────────────────
/**
 * Returns paginated P2P transfer history for the authenticated user.
 * Query: ?page=1&limit=20
 */
router.get(
  '/transfers',
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query);

    const wallet = await Wallet.findOne({ user: req.user._id }).lean();
    if (!wallet) {
      return res.status(200).json({ success: true, transfers: [], total: 0 });
    }

    const p2pTxns = wallet.transactions
      .filter((t) => t.purpose === 'P2P_Send' || t.purpose === 'P2P_Receive')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total     = p2pTxns.length;
    const paginated = p2pTxns.slice((page - 1) * limit, page * limit);

    res.status(200).json({ success: true, total, page, limit, transfers: paginated });
  })
);

// ── GET /api/wallet/upi-id ────────────────────────────────────────────────────
/**
 * Returns the authenticated user's UPI ID.
 */
router.get(
  '/upi-id',
  protect,
  asyncHandler(async (req, res) => {
    const wallet = await findOrCreateWallet(req.user._id);
    res.status(200).json({ success: true, upiId: wallet.upiId });
  })
);

// ── GET /api/wallet/withdrawable-balance ──────────────────────────────────────
/**
 * Returns a detailed breakdown of the user's withdrawable balance.
 *
 * withdrawableBalance  = sum of Add_Money + Referral_Bonus credits (tracked by Wallet model)
 * lockedBalance        = amount held pending withdrawal approval
 * withdrawableAvailable = withdrawableBalance − lockedBalance  ← ceiling for new requests
 * nonWithdrawable      = balance − withdrawableBalance (P2P received, cashback, etc.)
 */
router.get(
  '/withdrawable-balance',
  protect,
  asyncHandler(async (req, res) => {
    const wallet = await findOrCreateWallet(req.user._id);

    res.status(200).json({
      success:              true,
      balance:              wallet.balance,
      withdrawableBalance:  wallet.withdrawableBalance,
      lockedBalance:        wallet.lockedBalance,
      withdrawableAvailable: wallet.withdrawableAvailable,
      nonWithdrawable:      +(wallet.balance - wallet.withdrawableBalance).toFixed(2),
      withdrawableSources:  ['Add_Money', 'Referral_Bonus'],
      note:                 'Only funds added via top-up or referral bonus can be withdrawn to a bank account.',
      withdrawalLimits: {
        minAmount:  WITHDRAWAL_LIMITS.MIN_AMOUNT,
        maxAmount:  WITHDRAWAL_LIMITS.MAX_AMOUNT,
        dailyLimit: WITHDRAWAL_LIMITS.DAILY_LIMIT,
        usedToday:  wallet.getDailyWithdrawalTotal(),
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Bank Accounts
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/wallet/bank-accounts ─────────────────────────────────────────────
router.get(
  '/bank-accounts',
  protect,
  asyncHandler(async (req, res) => {
    const wallet   = await findOrCreateWallet(req.user._id);
    const accounts = wallet.bankAccounts.map(maskBankAccount);
    res.status(200).json({ success: true, bankAccounts: accounts });
  })
);

// ── POST /api/wallet/bank-accounts ────────────────────────────────────────────
/**
 * Adds a new verified bank account (max 3 per wallet).
 *
 * Body:
 *   accountHolderName, accountNumber, ifscCode,
 *   bankName?, branchName?, accountType?, isPrimary?
 */
router.post(
  '/bank-accounts',
  protect,
  asyncHandler(async (req, res) => {
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      accountType,
      isPrimary,
    } = req.body;

    // 1. Basic Validations
    if (!accountHolderName || !accountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: 'accountHolderName, accountNumber, and ifscCode are required',
      });
    }

    const cleanAccountNumber = accountNumber.replace(/\D/g, '');
    const cleanIfsc = ifscCode.trim().toUpperCase();

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format' });
    }

    // 2. Razorpay X Automation: Create Contact & Fund Account
    let razorpayContactId;
    let razorpayFundAccountId;

    try {
      // Step A: Create or Get Razorpay Contact
      // Using axios because Razorpay's standard SDK doesn't always support full X features well
      const authHeader = {
        auth: { username: RAZORPAY_X_KEY_ID, password: RAZORPAY_X_KEY_SECRET }
      };

      const contactResponse = await axios.post(
        'https://api.razorpay.com/v1/contacts',
        {
          name: accountHolderName,
          email: req.user.email,
          contact: req.user.phone || "9999999999", // Fallback if phone missing
          type: "customer",
          reference_id: req.user._id.toString()
        },
        authHeader
      );
      razorpayContactId = contactResponse.data.id;

      // Step B: Create Fund Account (Bank Account)
      const fundResponse = await axios.post(
        'https://api.razorpay.com/v1/fund_accounts',
        {
          contact_id: razorpayContactId,
          account_type: "bank_account",
          bank_account: {
            name: accountHolderName,
            ifsc: cleanIfsc,
            account_number: cleanAccountNumber
          }
        },
        authHeader
      );
      razorpayFundAccountId = fundResponse.data.id;

    } catch (rzpErr) {
      const errorMsg = rzpErr.response?.data?.error?.description || "Razorpay verification failed";
      return res.status(422).json({
        success: false,
        message: `Verification Error: ${errorMsg}. Please check your bank details.`
      });
    }

    // 3. Save to Database
    const wallet = await findOrCreateWallet(req.user._id);
    
    // addBankAccount handles the primary logic and max 3 accounts limit
    const updatedWallet = await wallet.addBankAccount({
      accountHolderName: accountHolderName.trim(),
      accountNumber:     cleanAccountNumber,
      ifscCode:          cleanIfsc,
      bankName:          bankName?.trim(),
      branchName:        branchName?.trim(),
      accountType:       accountType || 'Savings',
      isPrimary:         isPrimary === true,
      // Store the Razorpay IDs
      razorpayContactId,
      razorpayFundAccountId,
      isVerified: true // Set to true as Razorpay accepted the details
    });

    // 4. Logging & Audit
    logAudit('BANK_ACCOUNT_ADDED', {
      userId: req.user._id,
      razorpayFundAccountId,
      maskedAccount: `XXXX${cleanAccountNumber.slice(-4)}`,
    });

    await persistLog({
      level:   'success',
      category: 'payment',
      message: 'Bank account added and verified with Razorpay X',
      actor:   { userId: req.user._id, role: req.user.role },
      metadata: { razorpayFundAccountId, ifscCode: cleanIfsc },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    res.status(201).json({
      success: true,
      message: 'Bank account verified and added successfully.',
      bankAccounts: updatedWallet.bankAccounts.map(maskBankAccount),
    });
  })
);

// ── PATCH /api/wallet/bank-accounts/:bankAccountId/set-primary ────────────────
router.patch(
  '/bank-accounts/:bankAccountId/set-primary',
  protect,
  asyncHandler(async (req, res) => {
    const { bankAccountId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const updatedWallet = await wallet.setPrimaryBankAccount(bankAccountId);

    logAudit('BANK_ACCOUNT_SET_PRIMARY', { userId: req.user._id, bankAccountId });

    res.status(200).json({
      success:            true,
      message:            'Primary bank account updated successfully',
      primaryBankAccount: updatedWallet.primaryBankAccount,
    });
  })
);

// ── DELETE /api/wallet/bank-accounts/:bankAccountId ───────────────────────────
router.delete(
  '/bank-accounts/:bankAccountId',
  protect,
  asyncHandler(async (req, res) => {
    const { bankAccountId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Guard: cannot remove if a pending/approved withdrawal references this account
    const hasPendingWithdrawal = wallet.withdrawalRequests.some(
      (r) =>
        r.bankAccountId?.toString() === bankAccountId &&
        ['Pending', 'Approved'].includes(r.status)
    );
    if (hasPendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove this bank account while a withdrawal request is pending.',
      });
    }

    await wallet.removeBankAccount(bankAccountId);

    logAudit('BANK_ACCOUNT_REMOVED', { userId: req.user._id, bankAccountId });

    res.status(200).json({ success: true, message: 'Bank account removed successfully' });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawals (User-facing)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/wallet/withdrawals ───────────────────────────────────────────────
/**
 * Returns paginated withdrawal history for the authenticated user.
 * Query: ?page=1&limit=20&status=Pending
 */
router.get(
  '/withdrawals',
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query);
    const status          = req.query.status;

    const wallet = await Wallet.findOne({ user: req.user._id }).lean();
    if (!wallet) {
      return res.status(200).json({ success: true, withdrawals: [], total: 0 });
    }

    let requests = [...wallet.withdrawalRequests].sort(
      (a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)
    );

    if (status) requests = requests.filter((r) => r.status === status);

    const total     = requests.length;
    const paginated = requests.slice((page - 1) * limit, page * limit);

    res.status(200).json({ success: true, total, page, limit, withdrawals: paginated });
  })
);

// ── POST /api/wallet/withdrawals ──────────────────────────────────────────────
/**
 * Creates a withdrawal request for admin approval.
 *
 * IMPORTANT — what can be withdrawn:
 *   Only credits from Add_Money (Razorpay top-up) and Referral_Bonus
 *   are counted in withdrawableBalance. P2P received money, cashback,
 *   coin conversions etc. are NOT withdrawable.
 *
 * The ceiling for a new request is wallet.withdrawableAvailable
 *   = withdrawableBalance − lockedBalance
 *
 * Body: { amount: number, bankAccountId: string }
 */
router.post(
  '/withdrawals',
  protect,
  asyncHandler(async (req, res) => {
    const { amount, bankAccountId } = req.body;

    if (!amount || !bankAccountId) {
      return res.status(400).json({
        success: false,
        message: 'amount and bankAccountId are required',
      });
    }

    const withdrawAmount = Number(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    if (withdrawAmount < WITHDRAWAL_LIMITS.MIN_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${WITHDRAWAL_LIMITS.MIN_AMOUNT}`,
      });
    }

    if (withdrawAmount > WITHDRAWAL_LIMITS.MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal per request is ₹${WITHDRAWAL_LIMITS.MAX_AMOUNT.toLocaleString('en-IN')}`,
      });
    }

    const wallet = await findOrCreateWallet(req.user._id);

    if (!wallet.isActive) {
      return res.status(403).json({ success: false, message: 'Your wallet is currently inactive' });
    }

    // --- Balance eligibility check ---
    // Only withdrawableAvailable (Add_Money + Referral_Bonus, minus locked) can be withdrawn.
    if (wallet.withdrawableAvailable < withdrawAmount) {
      const isLocked = wallet.withdrawableBalance >= withdrawAmount;
      return res.status(400).json({
        success:              false,
        message:              isLocked
          ? `Amount is locked by a pending withdrawal request. Available to withdraw: ₹${wallet.withdrawableAvailable.toLocaleString('en-IN')}`
          : `Insufficient withdrawable balance. Only top-up and referral bonus money (₹${wallet.withdrawableBalance.toLocaleString('en-IN')}) can be withdrawn. Available: ₹${wallet.withdrawableAvailable.toLocaleString('en-IN')}`,
        withdrawableAvailable: wallet.withdrawableAvailable,
        withdrawableBalance:   wallet.withdrawableBalance,
        lockedBalance:         wallet.lockedBalance,
        withdrawableSources:   ['Add_Money', 'Referral_Bonus'],
      });
    }

    // Daily limit check
    const dailyUsed = wallet.getDailyWithdrawalTotal();
    if (dailyUsed + withdrawAmount > WITHDRAWAL_LIMITS.DAILY_LIMIT) {
      const remaining = +(WITHDRAWAL_LIMITS.DAILY_LIMIT - dailyUsed).toFixed(2);
      return res.status(400).json({
        success: false,
        message: `Daily withdrawal limit exceeded. You can withdraw ₹${remaining.toLocaleString('en-IN')} more today.`,
      });
    }

    // requestWithdrawal handles bank-account existence & verification checks
    const { request } = await wallet.requestWithdrawal({
      amount:      withdrawAmount,
      bankAccountId,
      initiatedBy: req.user._id,
    });

    await invalidateWalletCache(req.user._id);

    logAudit('WITHDRAWAL_REQUESTED', {
      userId:       req.user._id,
      requestId:    request.requestId,
      amount:       withdrawAmount,
      bankAccountId,
    });

    await persistLog({
      level:   'info',
      message: `Withdrawal request submitted: ₹${withdrawAmount}`,
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 201 },
      metadata: { withdrawAmount, bankAccountId, requestId: request.requestId },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    dispatchNotification(req.user._id, {
      title:        'Withdrawal Request Submitted',
      body:         `Your withdrawal request of ₹${withdrawAmount.toLocaleString('en-IN')} has been submitted and is pending admin approval.`,
      type:         'Payment_Pending',
      emailSubject: 'Withdrawal Request Received — Likeson Wallet',
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted. Awaiting admin approval.',
      request: {
        requestId:         request.requestId,
        amount:            request.amount,
        status:            request.status,
        accountHolderName: request.accountHolderName,
        maskedAccount:     `XXXX${request.accountNumber}`,
        bankName:          request.bankName,
        requestedAt:       request.requestedAt,
      },
      withdrawableAvailable: wallet.withdrawableAvailable,
    });
  })
);

// ── GET /api/wallet/withdrawals/:requestId ────────────────────────────────────
router.get(
  '/withdrawals/:requestId',
  protect,
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id }).lean();
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    const { accountNumber: _raw, ...safeRequest } = request;
    res.status(200).json({
      success: true,
      request: {
        ...safeRequest,
        maskedAccount: `XXXX${request.accountNumber}`,
      },
    });
  })
);

// ── POST /api/wallet/withdrawals/:requestId/cancel ────────────────────────────
/**
 * Allows the user to cancel a PENDING withdrawal before admin acts on it.
 */
router.post(
  '/withdrawals/:requestId/cancel',
  protect,
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a withdrawal in status: ${request.status}. Only Pending requests can be cancelled.`,
      });
    }

    await wallet.rejectWithdrawal({
      requestId,
      reviewedBy: req.user._id,
      adminNote:  'Cancelled by user',
    });

    await invalidateWalletCache(req.user._id);

    logAudit('WITHDRAWAL_CANCELLED_BY_USER', {
      userId: req.user._id,
      requestId,
      amount: request.amount,
    });

    await persistLog({
      level:   'info',
      message: `User cancelled withdrawal ${requestId}`,
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal request cancelled. Your funds have been unlocked.',
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Withdrawal Management
// ─────────────────────────────────────────────────────────────────────────────
// All admin routes require role: admin or superadmin (via authorize middleware).

// ── GET /api/wallet/admin/withdrawals ─────────────────────────────────────────
/**
 * [Admin] Lists all withdrawal requests across all wallets, filtered by status.
 * Query: ?status=Pending&page=1&limit=20
 */
router.get(
  '/admin/withdrawals',
  protect,
  authorize('admin', 'superadmin', 'finance'),
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, 100);
    const status          = req.query.status || 'Pending';

    const [results, countResult] = await Promise.all([
      Wallet.aggregate([
        { $unwind: '$withdrawalRequests' },
        { $match:  { 'withdrawalRequests.status': status } },
        { $sort:   { 'withdrawalRequests.requestedAt': -1 } },
        { $skip:   (page - 1) * limit },
        { $limit:  limit },
        {
          $lookup: {
            from:         'users',
            localField:   'user',
            foreignField: '_id',
            as:           '_userArr',
            pipeline:     [{ $project: { name: 1, email: 1, phone: 1 } }],
          },
        },
        {
          $project: {
            _id:      0,
            walletId: '$_id',
            userId:   '$user',
            user:     { $arrayElemAt: ['$_userArr', 0] },
            request:  '$withdrawalRequests',
          },
        },
      ]),
      Wallet.aggregate([
        { $unwind: '$withdrawalRequests' },
        { $match:  { 'withdrawalRequests.status': status } },
        { $count:  'total' },
      ]),
    ]);

    const total = countResult[0]?.total || 0;

    res.status(200).json({ success: true, total, page, limit, withdrawals: results });
  })
);

// ── POST /api/wallet/admin/withdrawals/:requestId/approve ─────────────────────
/**
 * [Admin] Approves a pending withdrawal request.
 * Body: { walletId }
 */
router.post(
  '/admin/withdrawals/:requestId/approve',
  protect,
  authorize('admin', 'superadmin', 'finance'),
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { walletId }  = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Request is already in status: ${request.status}`,
      });
    }

    request.status     = 'Approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await wallet.save();

    await invalidateWalletCache(wallet.user);

    logAudit('WITHDRAWAL_APPROVED', {
      adminId:   req.user._id,
      requestId,
      userId:    wallet.user,
      amount:    request.amount,
    });

    await persistLog({
      level:    'success',
      category: 'payment',
      message:  `Withdrawal ${requestId} approved by admin`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount, userId: wallet.user },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title:        'Withdrawal Approved',
      body:         `Your withdrawal of ₹${request.amount.toLocaleString('en-IN')} has been approved and will be credited to your bank account shortly.`,
      type:         'Payment_Success',
      emailSubject: 'Withdrawal Approved — Likeson Wallet',
    });

    res.status(200).json({ success: true, message: 'Withdrawal request approved', request });
  })
);

// ── POST /api/wallet/admin/withdrawals/:requestId/complete ────────────────────
/**
 * [Admin] Initiates the actual bank payout via Razorpay X Payout API,
 * then marks the withdrawal as completed and debits the wallet.
 *
 * The payout is initiated HERE — callers do NOT supply a razorpayPayoutId.
 * The razorpayPayoutId is obtained from the Razorpay API response and stored.
 *
 * Prerequisites:
 *   - Bank account must have razorpayFundAccountId set (via /admin/bank-accounts/.../verify).
 *   - RAZORPAY_X_ACCOUNT_NUMBER env var must be configured.
 *
 * Body: { walletId }
 */
// ── POST /api/wallet/admin/withdrawals/:requestId/complete ────────────────────
/**
 * [Admin] Initiates the actual bank payout via Razorpay X Payout API.
 * * FIX: Ensures we correctly resolve the bank account from the sub-document 
 * array and validates the Razorpay Fund Account ID.
 */
router.post(
  '/admin/withdrawals/:requestId/complete',
  protect,
  authorize('admin', 'superadmin', 'finance'),
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { walletId }  = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    // 1. Fetch wallet with the sub-documents
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // 2. Find the specific withdrawal request
    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // 3. Status Guard: Only 'Approved' requests should be processed for payout
    // If it's still 'Pending', you might want to approve it first or allow it here
    if (!['Pending', 'Approved'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete withdrawal. Current status: ${request.status}`,
      });
    }

    // 4. Idempotency Guard: Don't trigger duplicate payouts
    if (request.razorpayPayoutId) {
      return res.status(409).json({
        success: false,
        message: `Payout already exists for this request: ${request.razorpayPayoutId}`,
      });
    }

    // 5. Resolve the specific bank account used for this request
    const bankAccount = wallet.bankAccounts.id(request.bankAccountId);
    
    if (!bankAccount) {
      return res.status(400).json({
        success: false,
        message: 'The bank account associated with this request has been removed from the wallet.',
      });
    }

    // 6. CRITICAL FIX: The Fund Account ID check
    if (!bankAccount.razorpayFundAccountId) {
      return res.status(400).json({
        success: false,
        message: `Payout failed: Bank account ending in ${bankAccount.accountNumber.slice(-4)} is not verified with Razorpay. Please verify it first.`,
      });
    }

    if (!RAZORPAY_X_ACCOUNT_NUMBER) {
      return res.status(500).json({
        success: false,
        message: 'Platform Error: RAZORPAY_X_ACCOUNT_NUMBER is missing from environment variables.',
      });
    }

    // 7. Initiate Razorpay X Payout
    let payoutResult;
    try {
      payoutResult = await initiateRazorpayXPayout({
        razorpayFundAccountId: bankAccount.razorpayFundAccountId,
        amount: Math.round(request.amount * 100), // Convert INR to Paise
        requestId: request.requestId,
        narration: `Likeson Wdr ${request.requestId.slice(-6)}`,
      });
    } catch (payoutErr) {
      const errDetail = payoutErr?.response?.data?.error?.description || payoutErr.message;
      
      await persistLog({
        level: 'error',
        category: 'payment',
        message: `Razorpay Payout API Error: ${errDetail}`,
        actor: { userId: req.user._id },
        metadata: { requestId, error: errDetail }
      });

      return res.status(502).json({
        success: false,
        message: `Razorpay X Error: ${errDetail}`,
      });
    }

    // 8. Update Wallet Transaction and Status
    // completeWithdrawal handles: status = 'Completed', releases lockedBalance, and records the debit txn.
    const updatedWallet = await wallet.completeWithdrawal({
      requestId,
      razorpayPayoutId: payoutResult.id,
      reviewedBy: req.user._id,
    });

    // 9. Sync the Payout Status (e.g., 'processing', 'processed')
    const finalReq = updatedWallet.withdrawalRequests.find(r => r.requestId === requestId);
    finalReq.razorpayPayoutStatus = payoutResult.status;
    await updatedWallet.save();

    await invalidateWalletCache(wallet.user);

    // 10. Audit and Notifications
    await persistLog({
      level: 'success',
      category: 'payment',
      message: `Payout ${payoutResult.id} initiated for request ${requestId}`,
      actor: { userId: req.user._id },
      relatedEntity: { model: 'User', entityId: wallet.user }
    });

    dispatchNotification(wallet.user, {
      title: 'Withdrawal Processed',
      body: `₹${request.amount} is being transferred to your bank account. Payout ID: ${payoutResult.id}`,
      type: 'Payment_Success'
    });

    res.status(200).json({
      success: true,
      message: 'Payout successfully initiated',
      payoutId: payoutResult.id,
      status: payoutResult.status,
      newBalance: updatedWallet.balance
    });
  })
);

// ── POST /api/wallet/admin/withdrawals/:requestId/reject ──────────────────────
/**
 * [Admin] Rejects a pending withdrawal. Releases locked amount.
 * Body: { walletId, adminNote? }
 */
router.post(
  '/admin/withdrawals/:requestId/reject',
  protect,
  authorize('admin', 'superadmin', 'finance'),
  asyncHandler(async (req, res) => {
    const { requestId }           = req.params;
    const { walletId, adminNote } = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    await wallet.rejectWithdrawal({ requestId, reviewedBy: req.user._id, adminNote });

    await invalidateWalletCache(wallet.user);

    logAudit('WITHDRAWAL_REJECTED', {
      adminId:   req.user._id,
      requestId,
      userId:    wallet.user,
      amount:    request.amount,
      adminNote,
    });

    await persistLog({
      level:    'warning',
      category: 'payment',
      message:  `Withdrawal ${requestId} rejected by admin`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount, adminNote },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title:        'Withdrawal Rejected',
      body:         `Your withdrawal request of ₹${request.amount.toLocaleString('en-IN')} was rejected. Funds have been unlocked.${adminNote ? ` Reason: ${adminNote}` : ''}`,
      type:         'Payment_Failed',
      emailSubject: 'Withdrawal Rejected — Likeson Wallet',
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal request rejected and funds unlocked',
    });
  })
);

// ── POST /api/wallet/admin/withdrawals/:requestId/fail ────────────────────────
/**
 * [Admin] Marks a withdrawal as failed after payout attempt fails.
 * Releases lock and credits reversal (restores withdrawableBalance).
 * Body: { walletId, failureReason? }
 */
router.post(
  '/admin/withdrawals/:requestId/fail',
  protect,
  authorize('admin', 'superadmin', 'finance'),
  asyncHandler(async (req, res) => {
    const { requestId }               = req.params;
    const { walletId, failureReason } = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    const updatedWallet = await wallet.failWithdrawal({
      requestId,
      failureReason,
      reviewedBy: req.user._id,
    });

    await invalidateWalletCache(wallet.user);

    logAudit('WITHDRAWAL_FAILED', {
      adminId:       req.user._id,
      requestId,
      userId:        updatedWallet.user,
      amount:        request.amount,
      failureReason,
    });

    await persistLog({
      level:    'error',
      category: 'payment',
      message:  `Withdrawal ${requestId} marked failed — amount reversed`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount, failureReason },
      relatedEntity: { model: 'User', entityId: updatedWallet.user },
    });

    dispatchNotification(updatedWallet.user, {
      title:        'Withdrawal Failed',
      body:         `Your withdrawal of ₹${request.amount.toLocaleString('en-IN')} could not be processed. The amount has been returned to your wallet.${failureReason ? ` Reason: ${failureReason}` : ''}`,
      type:         'Payment_Failed',
      emailSubject: 'Withdrawal Failed — Funds Returned — Likeson Wallet',
    });

    res.status(200).json({
      success:             true,
      message:             'Withdrawal marked as failed and amount reversed to wallet',
      newBalance:          updatedWallet.balance,
      withdrawableBalance: updatedWallet.withdrawableBalance,
    });
  })
);

// ── PATCH /api/wallet/admin/bank-accounts/:walletId/:bankAccountId/verify ─────
/**
 * [Admin] Marks a bank account as verified (post penny-drop / manual check).
 * Also stores Razorpay Fund Account & Contact IDs needed for payouts.
 *
 * Body (optional):
 *   { razorpayFundAccountId: "fa_...", razorpayContactId: "cont_..." }
 */
// ── PATCH /api/wallet/admin/bank-accounts/:walletId/:bankAccountId/verify ─────
/**
 * [Admin] Marks a bank account as verified.
 * This is the FIX for the "No Razorpay Fund Account ID" error.
 * * Body: { razorpayFundAccountId: string, razorpayContactId: string }
 */
router.patch(
  '/admin/bank-accounts/:walletId/:bankAccountId/verify',
  protect,
  authorize('admin', 'superadmin', 'finance'),
  asyncHandler(async (req, res) => {
    const { walletId, bankAccountId } = req.params;
    const { razorpayFundAccountId, razorpayContactId } = req.body;

    // 1. Validation: Ensure the Fund Account ID is provided
    if (!razorpayFundAccountId) {
      return res.status(400).json({
        success: false,
        message: 'razorpayFundAccountId is required to enable payouts for this account.'
      });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // 2. Find the specific bank account in the sub-document array
    const account = wallet.bankAccounts.id(bankAccountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Bank account not found in this wallet' });
    }

    // 3. Update the fields
    account.isVerified = true;
    account.verifiedAt = new Date();
    account.razorpayFundAccountId = razorpayFundAccountId;
    if (razorpayContactId) account.razorpayContactId = razorpayContactId;
    account.updatedAt = new Date();

    // 4. Save the parent document
    await wallet.save();

    // Invalidate cache
    await invalidateWalletCache(wallet.user);

    await persistLog({
      level: 'success',
      category: 'kyc',
      message: `Bank account XXXX${account.accountNumber.slice(-4)} verified with Fund ID`,
      actor: { userId: req.user._id, role: req.user.role },
      metadata: { walletId, bankAccountId, razorpayFundAccountId },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title: 'Bank Account Verified',
      body: `Your bank account ending in ${account.accountNumber.slice(-4)} is now verified and ready for withdrawals.`,
      type: 'KYC_Approved'
    });

    res.status(200).json({
      success: true,
      message: 'Bank account verified and Razorpay IDs linked successfully.',
      account: maskBankAccount(account)
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers (defined after routes to avoid hoisting confusion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a safe, masked representation of a bank account sub-document.
 * Always strips the raw accountNumber before sending to clients.
 */
function maskBankAccount(acc) {
  return {
    _id:               acc._id,
    accountHolderName: acc.accountHolderName,
    maskedAccount:     `XXXX${acc.accountNumber.slice(-4)}`,
    ifscCode:          acc.ifscCode,
    bankName:          acc.bankName,
    branchName:        acc.branchName,
    accountType:       acc.accountType,
    isPrimary:         acc.isPrimary,
    isVerified:        acc.isVerified,
    verifiedAt:        acc.verifiedAt,
    addedAt:           acc.addedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Centralised Error Handler
// ─────────────────────────────────────────────────────────────────────────────
router.use(async (err, req, res, _next) => {
  const status  = err.status  || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logAudit('WALLET_ROUTER_ERROR', {
    message,
    userId:  req.user?._id,
    path:    req.originalUrl,
    stack:   process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Persist error to SystemLog (non-blocking)
  await persistLog({
    level:    'error',
    category: 'system',
    message:  `Wallet router error: ${message}`,
    actor:    { userId: req.user?._id, ip: req.ip },
    request:  { method: req.method, path: req.originalUrl, statusCode: status },
    metadata: {
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
  }).catch(() => {});

  res.status(status).json({
    success: false,
    message: status === 500 ? 'A system error occurred. Please try again.' : message,
  });
});

export default router;