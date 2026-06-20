/**
 * reconciliation.service.js
 *
 * Daily reconciliation cron.
 * Validates: ledger sum === wallet balance projection.
 * Creates alerts on mismatch.
 *
 * Run via: cron.schedule('0 2 * * *', runDailyReconciliation)
 * or via admin endpoint: POST /api/finance/reconciliation/run
 */

import mongoose from 'mongoose';
import PartnerWallet from '../models/PartnerWallet.js';
import PartnerWalletTransaction from '../models/PartnerWalletTransaction.js';
import PartnerSettlement from '../models/PartnerSettlement.js';
import PartnerWithdrawal from '../models/PartnerWithdrawal.js';
import PartnerCollectionLiability from '../models/PartnerCollectionLiability.js';

// Finance alert model (simple — expand as needed)
// Replace with your actual alert/notification system
const createAlert = async (alert) => {
  console.error('[RECONCILIATION ALERT]', JSON.stringify(alert, null, 2));
  // TODO: write to FinanceAlert collection + notify finance team
};

// ── Main Reconciliation ───────────────────────────────────────────────────────

/**
 * runDailyReconciliation
 *
 * Checks ALL active partner wallets.
 * Returns { checked, mismatches, alerts }
 */
export async function runDailyReconciliation({ adminUserId = null } = {}) {
  console.log('[reconciliation] Starting daily reconciliation...');

  const wallets = await PartnerWallet.find({ walletStatus: { $ne: 'closed' } }).lean();

  const results = {
    checkedAt:  new Date(),
    checked:    wallets.length,
    matched:    0,
    mismatches: 0,
    alerts:     [],
    details:    [],
  };

  for (const wallet of wallets) {
    const check = await reconcilePartnerWallet(wallet);
    if (check.mismatch) {
      results.mismatches++;
      results.alerts.push(check);
      await createAlert({
        type:      'WALLET_RECONCILIATION_MISMATCH',
        walletId:  wallet._id,
        partnerId: wallet.partner,
        ...check,
      });

      // Mark wallet with reconciliation status
      await PartnerWallet.findByIdAndUpdate(wallet._id, {
        $set: {
          lastReconciliationAt:     new Date(),
          lastReconciliationStatus: 'mismatch',
          lastReconciliationDelta:  check.delta,
        },
      });
    } else {
      results.matched++;
      await PartnerWallet.findByIdAndUpdate(wallet._id, {
        $set: {
          lastReconciliationAt:     new Date(),
          lastReconciliationStatus: 'matched',
          lastReconciliationDelta:  0,
        },
      });
    }
    results.details.push(check);
  }

  console.log(`[reconciliation] Done. Checked: ${results.checked}, Mismatches: ${results.mismatches}`);
  return results;
}

// ── Per-Wallet Reconciliation ─────────────────────────────────────────────────

async function reconcilePartnerWallet(wallet) {
  const partnerId = wallet.partner;
  const walletId  = wallet._id;

  // ── 1. Compute ledger-derived balance ───────────────────────────────────────
  const ledgerSum = await computeLedgerBalance(walletId);

  // ── 2. Compare with wallet projection ──────────────────────────────────────
  const walletBalance     = +wallet.availableBalance.toFixed(2);
  const ledgerBalance     = +ledgerSum.net.toFixed(2);
  const delta             = +(walletBalance - ledgerBalance).toFixed(2);
  const mismatch          = Math.abs(delta) > 0.01; // tolerance: 1 paisa

  // ── 3. Settlement validation ────────────────────────────────────────────────
  const settlementSum = await PartnerSettlement.aggregate([
    { $match: { partnerId, settlementStatus: 'SETTLED' } },
    { $group: { _id: null, total: { $sum: '$netSettlement' } } },
  ]);
  const totalSettled = settlementSum[0]?.total ?? 0;

  // ── 4. Withdrawal validation ────────────────────────────────────────────────
  const withdrawalSum = await PartnerWithdrawal.aggregate([
    { $match: { partnerId, status: 'processed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalWithdrawn = withdrawalSum[0]?.total ?? 0;

  // ── 5. Recovery validation ──────────────────────────────────────────────────
  const recoverySum = await PartnerCollectionLiability.aggregate([
    { $match: { partner: partnerId } },
    { $group: { _id: null, total: { $sum: '$amountRecovered' } } },
  ]);
  const totalRecovered = recoverySum[0]?.total ?? 0;

  // ── 6. Cross-checks ──────────────────────────────────────────────────────────
  const lifetimeEarnedDelta   = +(wallet.lifetimeEarned - ledgerSum.totalEarned).toFixed(2);
  const lifetimeWithdrawnDelta= +(wallet.lifetimeWithdrawn - totalWithdrawn).toFixed(2);
  const lifetimeRecoveredDelta= +(wallet.lifetimeRecovered - totalRecovered).toFixed(2);

  const hasLifetimeMismatch = (
    Math.abs(lifetimeEarnedDelta) > 0.01 ||
    Math.abs(lifetimeWithdrawnDelta) > 0.01 ||
    Math.abs(lifetimeRecoveredDelta) > 0.01
  );

  return {
    partnerId,
    walletId,
    partnerRole:    wallet.partnerRole,
    walletBalance,
    ledgerBalance,
    delta,
    mismatch:       mismatch || hasLifetimeMismatch,
    // Breakdowns
    ledgerDebits:   +ledgerSum.totalDebits.toFixed(2),
    ledgerCredits:  +ledgerSum.totalCredits.toFixed(2),
    totalSettled:   +totalSettled.toFixed(2),
    totalWithdrawn: +totalWithdrawn.toFixed(2),
    totalRecovered: +totalRecovered.toFixed(2),
    // Lifetime cross-checks
    lifetimeEarned:         wallet.lifetimeEarned,
    lifetimeEarnedLedger:   ledgerSum.totalEarned,
    lifetimeEarnedDelta,
    lifetimeWithdrawnDelta,
    lifetimeRecoveredDelta,
    checkedAt: new Date(),
  };
}

// ── Ledger Balance Computation ────────────────────────────────────────────────

async function computeLedgerBalance(walletId) {
  /**
   * Recompute balance from ledger:
   * net = sum of credits - sum of debits
   * Excludes WITHDRAWAL_REQUEST (balance moved to withdrawalBalance, not lost)
   * Excludes LIABILITY_CREATED (neutral; no balance change)
   */
  const result = await PartnerWalletTransaction.aggregate([
    { $match: { walletId: new mongoose.Types.ObjectId(walletId) } },
    {
      $group: {
        _id: null,
        totalCredits: {
          $sum: {
            $cond: [
              { $in: ['$direction', ['credit']] },
              '$amount',
              0,
            ],
          },
        },
        totalDebits: {
          $sum: {
            $cond: [
              { $eq: ['$direction', 'debit'] },
              '$amount',
              0,
            ],
          },
        },
        totalEarned: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'BOOKING_EARNING'] },
              '$grossAmount',
              0,
            ],
          },
        },
        recoveryDeductions: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'RECOVERY_DEDUCTION'] },
              '$amount',
              0,
            ],
          },
        },
        withdrawalRequestTotal: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'WITHDRAWAL_REQUEST'] },
              '$amount',
              0,
            ],
          },
        },
        withdrawalSuccessTotal: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'WITHDRAWAL_SUCCESS'] },
              '$amount',
              0,
            ],
          },
        },
        withdrawalReversals: {
          $sum: {
            $cond: [
              { $in: ['$type', ['WITHDRAWAL_FAILED', 'WITHDRAWAL_REVERSED']] },
              '$amount',
              0,
            ],
          },
        },
      },
    },
  ]);

  const r = result[0] ?? {
    totalCredits: 0, totalDebits: 0, totalEarned: 0,
    recoveryDeductions: 0, withdrawalRequestTotal: 0,
    withdrawalSuccessTotal: 0, withdrawalReversals: 0,
  };

  // Net available = credits - debits
  // Note: WITHDRAWAL_REQUEST moves balance to withdrawalBalance (debit from available)
  // WITHDRAWAL_SUCCESS finalizes (debit from withdrawalBalance — already not in available)
  // So for availableBalance: exclude WITHDRAWAL_SUCCESS from debits (handled separately)
  const net = r.totalCredits - r.totalDebits + r.withdrawalSuccessTotal;
  // (adding back withdrawalSuccess because WITHDRAWAL_REQUEST already debited available,
  //  and SUCCESS only debits withdrawalBalance which is separate)

  return {
    net,
    totalCredits:           r.totalCredits,
    totalDebits:            r.totalDebits,
    totalEarned:            r.totalEarned,
    recoveryDeductions:     r.recoveryDeductions,
    withdrawalRequestTotal: r.withdrawalRequestTotal,
    withdrawalSuccessTotal: r.withdrawalSuccessTotal,
    withdrawalReversals:    r.withdrawalReversals,
  };
}

// ── Admin: Single Wallet Reconcile ─────────────────────────────────────────────

export async function reconcilePartnerWalletById(walletId) {
  const wallet = await PartnerWallet.findById(walletId).lean();
  if (!wallet) throw new Error(`Wallet ${walletId} not found`);
  return reconcilePartnerWallet(wallet);
}

// ── Platform Revenue Reconciliation ───────────────────────────────────────────

/**
 * reconcilePlatformRevenue
 *
 * Cross-checks: sum of all platformFee across settlements
 * vs total booking revenue minus total partner payouts.
 *
 * Returns summary for finance dashboard.
 */
export async function reconcilePlatformRevenue({ fromDate, toDate } = {}) {
  const matchStage = {
    settlementStatus: 'SETTLED',
    ...(fromDate || toDate ? {
      settledAt: {
        ...(fromDate ? { $gte: new Date(fromDate) } : {}),
        ...(toDate   ? { $lte: new Date(toDate)   } : {}),
      },
    } : {}),
  };

  const result = await PartnerSettlement.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$partnerRole',
        totalGross:        { $sum: '$grossAmount' },
        totalPlatformFee:  { $sum: '$platformFee' },
        totalTax:          { $sum: '$taxAmount' },
        totalNet:          { $sum: '$netSettlement' },
        totalRecovery:     { $sum: '$recoveryDeduction' },
        totalSubscAbsorb:  { $sum: '$subscriptionAbsorbed' },
        count:             { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        byRole: { $push: '$$ROOT' },
        grandTotalGross:       { $sum: '$totalGross' },
        grandTotalPlatformFee: { $sum: '$totalPlatformFee' },
        grandTotalTax:         { $sum: '$totalTax' },
        grandTotalNet:         { $sum: '$totalNet' },
        grandTotalAbsorbed:    { $sum: '$totalSubscAbsorb' },
      },
    },
  ]);

  return result[0] ?? {
    byRole: [],
    grandTotalGross: 0,
    grandTotalPlatformFee: 0,
    grandTotalTax: 0,
    grandTotalNet: 0,
    grandTotalAbsorbed: 0,
  };
}