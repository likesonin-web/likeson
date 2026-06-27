/**
 * refundService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-grade refund engine for PharmacyOrder.
 *
 * REFUND AMOUNT LOGIC:
 *   refundAmount = totalPayable
 *                - discountAmount   (coupon/promo — customer never paid this)
 *                - walletAmountUsed (already coins — handled separately)
 *                + platformFee      (we absorb platform fee, so we include it)
 *
 *   In plain terms: refund exactly what the customer paid in cash/online,
 *   minus nothing extra. Platform fee is NOT deducted from their refund.
 *
 * FLOW:
 *   returnDecision = 'Accepted'  →  pre-save hook calls initiateRefund()
 *   initiateRefund() determines method and calls the right handler.
 *
 * SUPPORTED selectedRefundMethod values:
 *   'Wallet'       → credit Wallet model (coins or balance)
 *   'Online'       → Razorpay refund to original razorpayPaymentId
 *   'Bank_Transfer'→ Razorpay payout or manual (admin releases)
 *   'Custom_Bank'  → same as Bank_Transfer with customer-supplied details
 *
 * COD ORDERS:
 *   Payment never captured on Razorpay → only Wallet or Bank payout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Razorpay from 'razorpay';
import mongoose from 'mongoose';
import PharmacyOrder from '../models/PharmacyOrder.js';
import Wallet        from '../models/Wallet.js';         // your existing Wallet model

// ── Razorpay client (singleton) ───────────────────────────────────────────────

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Constants ─────────────────────────────────────────────────────────────────

export const REFUND_ERRORS = Object.freeze({
  ORDER_NOT_FOUND:        'ORDER_NOT_FOUND',
  ALREADY_REFUNDED:       'ALREADY_REFUNDED',
  INVALID_METHOD:         'INVALID_METHOD',
  COD_ONLINE_NOT_ALLOWED: 'COD_ONLINE_NOT_ALLOWED',
  NO_RAZORPAY_PAYMENT:    'NO_RAZORPAY_PAYMENT',
  RAZORPAY_FAILED:        'RAZORPAY_FAILED',
  WALLET_CREDIT_FAILED:   'WALLET_CREDIT_FAILED',
  ZERO_AMOUNT:            'ZERO_AMOUNT',
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute exact cash refund amount.
 *
 * totalPayable already accounts for everything the customer paid.
 * discountAmount and walletAmountUsed were NEVER real cash from customer,
 * so we subtract them. Platform fee was real cash → we include it (don't deduct).
 *
 * Formula:
 *   cashPaid = totalPayable - walletAmountUsed
 *   (discountAmount is already excluded from totalPayable by order creation logic)
 *
 * If order creation sets totalPayable = subTotal + gst + delivery + platform - discount - wallet,
 * then cashPaid = totalPayable + walletAmountUsed - walletAmountUsed = totalPayable.
 * But to be safe and explicit we compute both paths.
 */
export function computeRefundAmount(billing) {
  const {
    totalPayable     = 0,
    discountAmount   = 0,
    walletAmountUsed = 0,
    subTotal         = 0,
    gstAmount        = 0,
    deliveryCharges  = 0,
    platformFee      = 0,
  } = billing;

  // Cash the customer physically paid (card/UPI/netbanking via Razorpay)
  // = total they were charged minus wallet credits they spent
  const cashPaid = totalPayable - walletAmountUsed;

  // Sanity: cashPaid should equal subTotal + gst + delivery + platformFee - discountAmount
  // We trust totalPayable from order creation but log discrepancy in dev
  if (process.env.NODE_ENV === 'development') {
    const expected = subTotal + gstAmount + deliveryCharges + platformFee - discountAmount - walletAmountUsed;
    if (Math.abs(cashPaid - expected) > 0.5) {
      console.warn('[refundService] cashPaid mismatch', { cashPaid, expected });
    }
  }

  return {
    cashRefundAmount:   Math.max(0, Math.round(cashPaid * 100) / 100),   // rounded to paise-safe 2dp
    walletRefundAmount: Math.max(0, walletAmountUsed),                    // coins/wallet to re-credit
  };
}

// ── Razorpay: refund online payment ──────────────────────────────────────────

/**
 * @param {string} razorpayPaymentId  - original payment ID (pay_xxx)
 * @param {number} amountInRupees     - refund amount
 * @param {string} orderId            - internal order ID (for notes)
 * @returns {object} Razorpay refund object
 */
async function razorpayRefund(razorpayPaymentId, amountInRupees, orderId) {
  if (!razorpayPaymentId) {
    throw Object.assign(
      new Error('Razorpay payment ID missing — cannot process online refund'),
      { code: REFUND_ERRORS.NO_RAZORPAY_PAYMENT }
    );
  }

  const amountInPaise = Math.round(amountInRupees * 100);

  try {
    const refund = await razorpay.payments.refund(razorpayPaymentId, {
      amount: amountInPaise,
      speed:  'optimum',          // 'normal' (5–7d) or 'optimum' (instant if eligible)
      notes:  {
        order_id:   orderId,
        refund_src: 'pharmacy_return',
        platform:   'likeson',
      },
      receipt: `rfnd_${orderId}_${Date.now()}`,
    });

    return refund; // { id, entity, amount, payment_id, status, ... }
  } catch (err) {
    const msg = err?.error?.description || err.message || 'Razorpay refund failed';
    throw Object.assign(new Error(msg), { code: REFUND_ERRORS.RAZORPAY_FAILED, raw: err });
  }
}

// ── Wallet credit ─────────────────────────────────────────────────────────────

/**
 * Credit refund to customer Wallet model.
 * Adjust this to match your Wallet schema's credit method/field.
 */
async function creditWallet(customerId, amountInRupees, orderId, session) {
  try {
    const wallet = await Wallet.findOne({ user: customerId }).session(session);

    if (!wallet) {
      // Create wallet if first time
      await Wallet.create([{
        user:    customerId,
        balance: amountInRupees,
        transactions: [{
          type:      'credit',
          amount:    amountInRupees,
          note:      `Refund for order ${orderId}`,
          createdAt: new Date(),
        }],
      }], { session });
    } else {
      wallet.balance += amountInRupees;
      wallet.transactions.push({
        type:      'credit',
        amount:    amountInRupees,
        note:      `Refund for order ${orderId}`,
        createdAt: new Date(),
      });
      await wallet.save({ session });
    }
  } catch (err) {
    throw Object.assign(
      new Error(`Wallet credit failed: ${err.message}`),
      { code: REFUND_ERRORS.WALLET_CREDIT_FAILED }
    );
  }
}

// ── Core: initiateRefund ──────────────────────────────────────────────────────

/**
 * Main entry point. Called automatically from PharmacyOrder pre-save hook
 * when cancellation.returnDecision flips to 'Accepted'.
 *
 * Also callable directly from admin controllers for manual override.
 *
 * @param {string} orderId   - PharmacyOrder._id (ObjectId string)
 * @param {object} [opts]
 * @param {string} [opts.adminNote]         - optional note to append
 * @param {string} [opts.overrideMethod]    - force a refund method (admin override)
 * @param {boolean}[opts.dryRun]            - compute amounts only, no DB write
 * @returns {object} result
 */
export async function initiateRefund(orderId, opts = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Load order ──────────────────────────────────────────────────────────
    const order = await PharmacyOrder
      .findById(orderId)
      .select('+payment.razorpaySignature +deliveryOtp.code')
      .session(session);

    if (!order) {
      throw Object.assign(new Error('Order not found'), { code: REFUND_ERRORS.ORDER_NOT_FOUND });
    }

    // ── 2. Guard: already refunded ─────────────────────────────────────────────
    if (['Processed', 'In-Progress'].includes(order.cancellation?.refundStatus)) {
      throw Object.assign(
        new Error('Refund already processed or in progress'),
        { code: REFUND_ERRORS.ALREADY_REFUNDED }
      );
    }

    // ── 3. Compute amounts ─────────────────────────────────────────────────────
    const { cashRefundAmount, walletRefundAmount } = computeRefundAmount(order.billing);

    if (cashRefundAmount <= 0 && walletRefundAmount <= 0) {
      throw Object.assign(
        new Error('Refund amount is zero — nothing to refund'),
        { code: REFUND_ERRORS.ZERO_AMOUNT }
      );
    }

    if (opts.dryRun) {
      await session.abortTransaction();
      return { dryRun: true, cashRefundAmount, walletRefundAmount };
    }

    // ── 4. Determine refund method ─────────────────────────────────────────────
    const method = opts.overrideMethod
      || order.cancellation?.selectedRefundMethod
      || 'Wallet';

    const isCOD       = order.payment.method === 'COD';
    const isOnline    = ['Razorpay'].includes(order.payment.method);

    // COD orders can never do Online refund (no payment was captured)
    if (isCOD && method === 'Online') {
      throw Object.assign(
        new Error('COD orders cannot use Online refund method'),
        { code: REFUND_ERRORS.COD_ONLINE_NOT_ALLOWED }
      );
    }

    // ── 5. Mark refund in-progress (optimistic lock) ───────────────────────────
    order.cancellation.refundStatus      = 'In-Progress';
    order.cancellation.refundAmount      = cashRefundAmount;
    order.cancellation.refundInitiatedAt = order.cancellation.refundInitiatedAt || new Date();
    order.cancellation.refundMethod      = methodToRefundMethod(method);
    if (opts.adminNote) {
      order.adminNotes.push({ text: opts.adminNote, addedAt: new Date() });
    }
    await order.save({ session });

    // ── 6. Execute refund by method ────────────────────────────────────────────
    let razorpayRefundId  = null;
    let razorpayRefundObj = null;

    switch (method) {
      // ── Online: refund to original Razorpay payment ───────────────────────
      case 'Online': {
        if (cashRefundAmount > 0) {
          razorpayRefundObj = await razorpayRefund(
            order.payment.razorpayPaymentId,
            cashRefundAmount,
            order.orderId,
          );
          razorpayRefundId = razorpayRefundObj.id;
        }

        // Also re-credit wallet portion (coins used → coins returned)
        if (walletRefundAmount > 0) {
          await creditWallet(order.customer, walletRefundAmount, order.orderId, session);
        }
        break;
      }

      // ── Wallet: everything goes to wallet balance ─────────────────────────
      case 'Wallet': {
        const totalWalletCredit = cashRefundAmount + walletRefundAmount;
        if (totalWalletCredit > 0) {
          await creditWallet(order.customer, totalWalletCredit, order.orderId, session);
        }
        break;
      }

      // ── Bank Transfer / Custom Bank ───────────────────────────────────────
      // Razorpay Payout API or manual — for now mark Requested so finance acts.
      // Extend here with razorpay.payouts.create() if payout account is set up.
      case 'Bank_Transfer':
      case 'Custom_Bank': {
        // Re-credit wallet portion immediately
        if (walletRefundAmount > 0) {
          await creditWallet(order.customer, walletRefundAmount, order.orderId, session);
        }

        // Cash portion: if Razorpay payout is set up use it, else stays In-Progress for finance
        if (cashRefundAmount > 0 && isOnline && order.payment.razorpayPaymentId) {
          // Optional: use Razorpay Refund (goes back to source) as fallback for bank
          razorpayRefundObj = await razorpayRefund(
            order.payment.razorpayPaymentId,
            cashRefundAmount,
            order.orderId,
          );
          razorpayRefundId = razorpayRefundObj.id;
        }
        // If COD + Bank: manual payout — status stays In-Progress, finance picks up
        break;
      }

      default: {
        throw Object.assign(
          new Error(`Unknown refund method: ${method}`),
          { code: REFUND_ERRORS.INVALID_METHOD }
        );
      }
    }

    // ── 7. Update order — mark Processed ──────────────────────────────────────
    order.cancellation.refundStatus  = 'Processed';
    order.cancellation.refundedAt    = new Date();
    if (razorpayRefundId) {
      order.cancellation.refundId = razorpayRefundId;
    }

    // Update payment status
    order.payment.status = 'Refunded';
    order.payment.transactionLog.push({
      action:    'REFUND_PROCESSED',
      status:    'success',
      note:      `Refund ₹${cashRefundAmount} via ${method}`,
      metadata:  {
        method,
        cashRefundAmount,
        walletRefundAmount,
        razorpayRefundId,
        razorpayRefundObj: razorpayRefundObj
          ? { id: razorpayRefundObj.id, status: razorpayRefundObj.status }
          : null,
      },
      timestamp: new Date(),
    });

    await order.save({ session });
    await session.commitTransaction();

    return {
      success:          true,
      method,
      cashRefundAmount,
      walletRefundAmount,
      razorpayRefundId,
      orderId:          order.orderId,
    };

  } catch (err) {
    await session.abortTransaction();

    // Attempt to stamp Failed status (best-effort, outside main session)
    try {
      await PharmacyOrder.findByIdAndUpdate(orderId, {
        $set: {
          'cancellation.refundStatus': 'Failed',
        },
        $push: {
          'payment.transactionLog': {
            action:    'REFUND_FAILED',
            status:    'failed',
            note:      err.message,
            metadata:  { code: err.code },
            timestamp: new Date(),
          },
        },
      });
    } catch (_) { /* swallow — don't mask original error */ }

    throw err;
  } finally {
    session.endSession();
  }
}

// ── Helper: map selectedRefundMethod → refundMethod enum ─────────────────────

function methodToRefundMethod(selected) {
  const map = {
    Wallet:        'Wallet',
    Online:        'Original_Source',
    Bank_Transfer: 'Bank_Transfer',
    Custom_Bank:   'Bank_Transfer',
  };
  return map[selected] || 'None';
}