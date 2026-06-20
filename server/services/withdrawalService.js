/**
 * withdrawalService.js
 *
 * Partner withdrawal flow via RazorpayX.
 *
 * Lifecycle:
 *   requestWithdrawal()  → REQUESTED
 *   approveWithdrawal()  → APPROVED → initiate RazorpayX payout
 *   handlePayoutWebhook() → processes RazorpayX status events
 *     processed → WITHDRAWAL_SUCCESS ledger, wallet finalized
 *     failed    → WITHDRAWAL_REVERSED ledger, balance restored
 *     reversed  → WITHDRAWAL_REVERSED ledger
 *
 * Compliance gates (requestWithdrawal):
 *   kycVerified + bankVerified + no complianceHold + no suspension
 *   + availableBalance >= amount + no pending withdrawal
 */

import mongoose from 'mongoose';
import PartnerWallet from '../models/PartnerWallet.js';
import PartnerWithdrawal from '../models/PartnerWithdrawal.js';
import PartnerWalletTransaction from '../models/PartnerWalletTransaction.js';

// RazorpayX SDK — import from your razorpay instance
// import { razorpayX } from '../utils/razorpay.js';

const MIN_WITHDRAWAL = 100;
const MAX_WITHDRAWAL = 50_000;

// ── Request Withdrawal ────────────────────────────────────────────────────────

/**
 * requestWithdrawal
 *
 * Partner-initiated. Runs compliance checks.
 * Creates PartnerWithdrawal (REQUESTED).
 * Writes WITHDRAWAL_REQUEST ledger entry.
 * Locks amount in withdrawalBalance.
 */
export async function requestWithdrawal({ partnerId, amount, bankAccountDetails, actorId }) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ── Load Wallet ──────────────────────────────────────────────────────────
    const wallet = await PartnerWallet.findOne({ partner: partnerId }).session(session);
    if (!wallet) throw new Error('Partner wallet not found');

    // ── Compliance Checks ────────────────────────────────────────────────────
    const checks = runComplianceChecks(wallet, amount);
    if (!checks.allPassed) {
      throw new Error(`Withdrawal compliance failed: ${checks.failures.join(', ')}`);
    }

    // ── Amount Validation ─────────────────────────────────────────────────────
    if (amount < MIN_WITHDRAWAL) throw new Error(`Minimum withdrawal: ₹${MIN_WITHDRAWAL}`);
    if (amount > MAX_WITHDRAWAL) throw new Error(`Maximum withdrawal: ₹${MAX_WITHDRAWAL}`);
    if (wallet.availableBalance < amount) {
      throw new Error(`Insufficient balance. Available: ₹${wallet.availableBalance}`);
    }

    // ── No Pending Withdrawal ────────────────────────────────────────────────
    const pendingWithdrawal = await PartnerWithdrawal.findOne({
      partnerId,
      status: { $in: ['REQUESTED', 'APPROVED', 'queued', 'pending', 'processing'] },
    }).session(session);
    if (pendingWithdrawal) {
      throw new Error(`Pending withdrawal exists: ${pendingWithdrawal.withdrawalId}`);
    }

    // ── Create Withdrawal Record ──────────────────────────────────────────────
    const [withdrawal] = await PartnerWithdrawal.create(
      [{
        partnerId,
        partnerRole:          wallet.partnerRole,
        walletId:             wallet._id,
        amount,
        bankAccountSnapshot: {
          accountHolderName:     bankAccountDetails.accountHolderName,
          accountNumberLast4:    bankAccountDetails.accountNumber.slice(-4),
          ifscCode:              bankAccountDetails.ifscCode,
          bankName:              bankAccountDetails.bankName,
          razorpayFundAccountId: bankAccountDetails.razorpayFundAccountId,
        },
        razorpayContactId:     wallet.razorpayContactId,
        razorpayFundAccountId: wallet.razorpayFundAccountId,
        status:                'REQUESTED',
        requestedAt:           new Date(),
        complianceChecksPassed: true,
        complianceChecksLog:   checks.log,
        createdBy:             actorId,
      }],
      { session }
    );

    // ── Write WITHDRAWAL_REQUEST Ledger ──────────────────────────────────────
    const beforeBalance = wallet.availableBalance;
    const afterBalance  = +(beforeBalance - amount).toFixed(2);

    const [txn] = await PartnerWalletTransaction.create(
      [{
        type:          'WITHDRAWAL_REQUEST',
        direction:     'debit',
        partnerId,
        walletId:      wallet._id,
        amount,
        beforeBalance,
        afterBalance,
        balanceSnapshot: {
          availableBalance:  afterBalance,
          pendingBalance:    wallet.pendingBalance,
          withdrawalBalance: wallet.withdrawalBalance + amount,
          recoveryBalance:   wallet.recoveryBalance,
        },
        withdrawalId:  withdrawal._id,
        actor:         actorId,
        actorRole:     'partner',
        idempotencyKey: `WITHDRAWAL_REQUEST:${withdrawal._id}`,
        remarks:       `Withdrawal request ₹${amount} — ${withdrawal.withdrawalId}`,
      }],
      { session }
    );

    // ── Update Wallet Balances ────────────────────────────────────────────────
    await PartnerWallet.findOneAndUpdate(
      { _id: wallet._id, __v_balance: wallet.__v_balance },
      {
        $inc: {
          availableBalance:  -amount,
          withdrawalBalance: amount,
          __v_balance:       1,
        },
        $set: { updatedBy: actorId },
      },
      { session }
    );

    // ── Link ledger txn to withdrawal ────────────────────────────────────────
    await PartnerWithdrawal.findByIdAndUpdate(
      withdrawal._id,
      { $set: { requestLedgerTxnId: txn._id } },
      { session }
    );

    await session.commitTransaction();

    return {
      withdrawalId:  withdrawal.withdrawalId,
      amount,
      status:        'REQUESTED',
    };

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ── Approve & Initiate Payout ──────────────────────────────────────────────────

/**
 * approveWithdrawal
 *
 * Finance/admin approves. Sends payout to RazorpayX.
 */
export async function approveWithdrawal({ withdrawalId, adminUserId }) {
  const withdrawal = await PartnerWithdrawal.findOne({ withdrawalId });
  if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found`);
  if (withdrawal.status !== 'REQUESTED') {
    throw new Error(`Cannot approve withdrawal in status: ${withdrawal.status}`);
  }

  // Initiate RazorpayX payout
  const payoutResponse = await initiateRazorpayXPayout(withdrawal);

  withdrawal.status            = payoutResponse.status; // 'queued' typically
  withdrawal.razorpayPayoutId  = payoutResponse.id;
  withdrawal.approvedAt        = new Date();
  withdrawal.reviewedBy        = adminUserId;
  withdrawal.reviewedAt        = new Date();
  await withdrawal.save();

  return { withdrawalId, razorpayPayoutId: payoutResponse.id, status: withdrawal.status };
}

// ── RazorpayX Webhook Handler ─────────────────────────────────────────────────

/**
 * handlePayoutWebhook
 *
 * Called by RazorpayX webhook controller.
 * Maps RazorpayX events to withdrawal lifecycle.
 *
 * Events we care about:
 *   payout.processed → success
 *   payout.failed    → failed + reversal
 *   payout.reversed  → reversed + reversal
 *   payout.updated   → status sync
 */
export async function handlePayoutWebhook({ event, payload }) {
  const payout = payload.payout?.entity;
  if (!payout) return;

  const withdrawal = await PartnerWithdrawal.findOne({ razorpayPayoutId: payout.id });
  if (!withdrawal) {
    console.warn(`[withdrawalService] No withdrawal found for razorpayPayoutId: ${payout.id}`);
    return;
  }

  switch (event) {
    case 'payout.processed':
      await handlePayoutSuccess(withdrawal, payout);
      break;
    case 'payout.failed':
      await handlePayoutFailed(withdrawal, payout);
      break;
    case 'payout.reversed':
      await handlePayoutReversed(withdrawal, payout);
      break;
    case 'payout.updated':
      await syncPayoutStatus(withdrawal, payout);
      break;
  }
}

// ── Internal: Payout Success ──────────────────────────────────────────────────

async function handlePayoutSuccess(withdrawal, payout) {
  if (withdrawal.status === 'processed') return; // idempotent

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const wallet = await PartnerWallet.findById(withdrawal.walletId).session(session);

    // Write WITHDRAWAL_SUCCESS ledger
    const [txn] = await PartnerWalletTransaction.create(
      [{
        type:         'WITHDRAWAL_SUCCESS',
        direction:    'debit',
        partnerId:    withdrawal.partnerId,
        walletId:     withdrawal.walletId,
        amount:       withdrawal.amount,
        beforeBalance: wallet.availableBalance,
        afterBalance:  wallet.availableBalance, // already debited at request time
        balanceSnapshot: {
          availableBalance:  wallet.availableBalance,
          pendingBalance:    wallet.pendingBalance,
          withdrawalBalance: Math.max(0, wallet.withdrawalBalance - withdrawal.amount),
          recoveryBalance:   wallet.recoveryBalance,
        },
        withdrawalId:  withdrawal._id,
        actorRole:     'system',
        idempotencyKey: `WITHDRAWAL_SUCCESS:${withdrawal._id}`,
        remarks:       `Payout success. UTR: ${payout.utr ?? 'N/A'}`,
      }],
      { session }
    );

    // Update wallet: withdrawalBalance → lifetimeWithdrawn
    await PartnerWallet.findOneAndUpdate(
      { _id: withdrawal.walletId, __v_balance: wallet.__v_balance },
      {
        $inc: {
          withdrawalBalance: -withdrawal.amount,
          lifetimeWithdrawn: withdrawal.amount,
          __v_balance:       1,
        },
      },
      { session }
    );

    // Update withdrawal
    await PartnerWithdrawal.findByIdAndUpdate(
      withdrawal._id,
      {
        $set: {
          status:               'processed',
          processedAt:          new Date(),
          completedAt:          new Date(),
          utr:                  payout.utr ?? null,
          bankReference:        payout.reference_id ?? null,
          completionLedgerTxnId: txn._id,
        },
      },
      { session }
    );

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ── Internal: Payout Failed/Reversed ─────────────────────────────────────────

async function handlePayoutFailed(withdrawal, payout) {
  await reverseWithdrawal(withdrawal, payout, 'failed', 'WITHDRAWAL_FAILED');
}

async function handlePayoutReversed(withdrawal, payout) {
  await reverseWithdrawal(withdrawal, payout, 'reversed', 'WITHDRAWAL_REVERSED');
}

async function reverseWithdrawal(withdrawal, payout, newStatus, ledgerType) {
  if (['processed', 'failed', 'reversed'].includes(withdrawal.status)) return;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const wallet = await PartnerWallet.findById(withdrawal.walletId).session(session);
    const beforeBalance = wallet.availableBalance;
    const afterBalance  = +(beforeBalance + withdrawal.amount).toFixed(2);

    // Write reversal ledger entry
    const [txn] = await PartnerWalletTransaction.create(
      [{
        type:          ledgerType,
        direction:     'credit',
        partnerId:     withdrawal.partnerId,
        walletId:      withdrawal.walletId,
        amount:        withdrawal.amount,
        beforeBalance,
        afterBalance,
        balanceSnapshot: {
          availableBalance:  afterBalance,
          pendingBalance:    wallet.pendingBalance,
          withdrawalBalance: Math.max(0, wallet.withdrawalBalance - withdrawal.amount),
          recoveryBalance:   wallet.recoveryBalance,
        },
        withdrawalId:  withdrawal._id,
        actorRole:     'system',
        idempotencyKey: `${ledgerType}:${withdrawal._id}`,
        remarks:       `Payout ${newStatus}. Reason: ${payout.error?.description ?? 'N/A'}`,
      }],
      { session }
    );

    // Restore wallet: availableBalance up, withdrawalBalance down
    await PartnerWallet.findOneAndUpdate(
      { _id: withdrawal.walletId, __v_balance: wallet.__v_balance },
      {
        $inc: {
          availableBalance:  withdrawal.amount,
          withdrawalBalance: -withdrawal.amount,
          __v_balance:       1,
        },
      },
      { session }
    );

    await PartnerWithdrawal.findByIdAndUpdate(
      withdrawal._id,
      {
        $set: {
          status:               newStatus,
          failureReason:        payout.error?.description ?? null,
          failedAt:             new Date(),
          completionLedgerTxnId: txn._id,
        },
        $inc: { retryCount: 1 },
      },
      { session }
    );

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function syncPayoutStatus(withdrawal, payout) {
  await PartnerWithdrawal.findByIdAndUpdate(withdrawal._id, {
    $set: { status: payout.status },
  });
}

// ── Compliance Checks ─────────────────────────────────────────────────────────

function runComplianceChecks(wallet, amount) {
  const log = [];
  const failures = [];

  const checks = [
    { check: 'kyc_verified',       pass: wallet.kycVerified,                  label: 'KYC not verified' },
    { check: 'bank_verified',      pass: wallet.bankVerified,                 label: 'Bank account not verified' },
    { check: 'no_compliance_hold', pass: !wallet.complianceHold,              label: 'Compliance hold active' },
    { check: 'wallet_active',      pass: wallet.walletStatus === 'active',    label: `Wallet is ${wallet.walletStatus}` },
    { check: 'sufficient_balance', pass: wallet.availableBalance >= amount,   label: 'Insufficient available balance' },
  ];

  for (const c of checks) {
    log.push({ check: c.check, passed: c.pass, details: c.pass ? 'OK' : c.label });
    if (!c.pass) failures.push(c.label);
  }

  return { allPassed: failures.length === 0, failures, log };
}

// ── RazorpayX Payout Initiation ───────────────────────────────────────────────

async function initiateRazorpayXPayout(withdrawal) {
  /**
   * In production:
   *   const razorpay = new Razorpay({ key_id: ..., key_secret: ... });
   *   return razorpay.payouts.create({
   *     account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
   *     fund_account_id: withdrawal.razorpayFundAccountId,
   *     amount: withdrawal.amount * 100, // paise
   *     currency: 'INR',
   *     mode: 'IMPS',
   *     purpose: 'payout',
   *     queue_if_low_balance: true,
   *     reference_id: withdrawal.withdrawalId,
   *     narration: `Likeson payout ${withdrawal.withdrawalId}`,
   *   });
   */
  throw new Error('RazorpayX integration: set razorpay instance and account number');
}

// ── Admin: Force/Retry Failed Withdrawal ─────────────────────────────────────

export async function retryWithdrawal({ withdrawalId, adminUserId }) {
  const withdrawal = await PartnerWithdrawal.findOne({ withdrawalId });
  if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found`);
  if (!['failed', 'REQUESTED'].includes(withdrawal.status)) {
    throw new Error(`Cannot retry withdrawal in status: ${withdrawal.status}`);
  }
  if (withdrawal.retryCount >= withdrawal.maxRetries) {
    throw new Error(`Max retries (${withdrawal.maxRetries}) reached for ${withdrawalId}`);
  }

  return approveWithdrawal({ withdrawalId, adminUserId });
}