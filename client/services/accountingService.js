/**
 * accountingService.js
 *
 * Pure HTTP layer for /api/accounting/* routes (accountingRouter.js).
 * No business logic, no toasts, no state — just axios calls.
 * Consumed exclusively by accountingSlice.js thunks.
 *
 * Assumes `API` is an axios instance whose baseURL already includes `/api`
 * (so paths below are relative: `/accounting/...`).
 */

import API from '@/store/api';

const BASE = '/accounting';

// ═══════════════════════════════════════════════════════════════════════════
// §1 SETTLEMENT
// ═══════════════════════════════════════════════════════════════════════════

export const processBookingSettlement = (bookingId) =>
  API.post(`${BASE}/settlement/process/${bookingId}`).then((r) => r.data);

export const getSettlementStatus = (bookingId) =>
  API.get(`${BASE}/settlement/status/${bookingId}`).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §2 PARTNER WALLET
// ═══════════════════════════════════════════════════════════════════════════

export const getMyWallet = () =>
  API.get(`${BASE}/wallets/me`).then((r) => r.data);

export const getPartnerWallet = (partnerId) =>
  API.get(`${BASE}/wallets/${partnerId}`).then((r) => r.data);

export const listWallets = (params = {}) =>
  API.get(`${BASE}/wallets`, { params }).then((r) => r.data);

export const freezeWallet = (partnerId, reason) =>
  API.patch(`${BASE}/wallets/${partnerId}/freeze`, { reason }).then((r) => r.data);

export const releaseWallet = (partnerId, reason) =>
  API.patch(`${BASE}/wallets/${partnerId}/release`, { reason }).then((r) => r.data);

export const updateWalletKycStatus = (partnerId, payload) =>
  API.patch(`${BASE}/wallets/${partnerId}/kyc-status`, payload).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §2b WALLET BANK DETAILS
// ═══════════════════════════════════════════════════════════════════════════

export const getMyBankDetails = () =>
  API.get(`${BASE}/wallets/me/bank`).then((r) => r.data);

export const addBankAccount = (payload) =>
  API.post(`${BASE}/wallets/me/bank`, payload).then((r) => r.data);

export const updateBankAccount = (bankId, payload) =>
  API.patch(`${BASE}/wallets/me/bank/${bankId}`, payload).then((r) => r.data);

export const deleteBankAccount = (bankId) =>
  API.delete(`${BASE}/wallets/me/bank/${bankId}`).then((r) => r.data);

export const setPrimaryBankAccount = (bankId) =>
  API.patch(`${BASE}/wallets/me/bank/${bankId}/set-primary`).then((r) => r.data);

export const verifyBankAccount = (partnerId, bankId) =>
  API.patch(`${BASE}/wallets/${partnerId}/bank/${bankId}/verify`).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §3 LEDGER TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const getMyTransactions = (params = {}) =>
  API.get(`${BASE}/transactions/me`, { params }).then((r) => r.data);

export const getPartnerTransactions = (partnerId, params = {}) =>
  API.get(`${BASE}/transactions/${partnerId}`, { params }).then((r) => r.data);

export const getTransactionByTxnId = (txnId) =>
  API.get(`${BASE}/transactions/txn/${txnId}`).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §4 SETTLEMENT RECORDS
// ═══════════════════════════════════════════════════════════════════════════

export const getMySettlements = (params = {}) =>
  API.get(`${BASE}/settlements/me`, { params }).then((r) => r.data);

export const getSettlementById = (settlementId) =>
  API.get(`${BASE}/settlements/${settlementId}`).then((r) => r.data);

export const listSettlements = (params = {}) =>
  API.get(`${BASE}/settlements`, { params }).then((r) => r.data);

export const reverseSettlement = (settlementId, reason) =>
  API.post(`${BASE}/settlements/${settlementId}/reverse`, { reason }).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §5 BOOKING PARTNER ALLOCATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const getBookingAllocations = (bookingId) =>
  API.get(`${BASE}/allocations/booking/${bookingId}`).then((r) => r.data);

export const getMyAllocations = (params = {}) =>
  API.get(`${BASE}/allocations/me`, { params }).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §6 WITHDRAWALS
// ═══════════════════════════════════════════════════════════════════════════

export const requestWithdrawal = (payload) =>
  API.post(`${BASE}/withdrawals/request`, payload).then((r) => r.data);

export const getMyWithdrawals = (params = {}) =>
  API.get(`${BASE}/withdrawals/me`, { params }).then((r) => r.data);

export const listWithdrawals = (params = {}) =>
  API.get(`${BASE}/withdrawals`, { params }).then((r) => r.data);

export const getWithdrawalById = (withdrawalId) =>
  API.get(`${BASE}/withdrawals/${withdrawalId}`).then((r) => r.data);

export const approveWithdrawal = (withdrawalId) =>
  API.post(`${BASE}/withdrawals/${withdrawalId}/approve`).then((r) => r.data);

export const rejectWithdrawal = (withdrawalId, reason) =>
  API.post(`${BASE}/withdrawals/${withdrawalId}/reject`, { reason }).then((r) => r.data);

export const retryWithdrawal = (withdrawalId) =>
  API.post(`${BASE}/withdrawals/${withdrawalId}/retry`).then((r) => r.data);

// NOTE: POST /withdrawals/webhook is a server-to-server RazorpayX callback
// (no `protect` middleware, signature-verified). It is intentionally NOT
// exposed here — it is never called from the frontend.

// ═══════════════════════════════════════════════════════════════════════════
// §7 CASH COLLECTION LIABILITIES
// ═══════════════════════════════════════════════════════════════════════════

export const getMyLiabilities = (params = {}) =>
  API.get(`${BASE}/liabilities/me`, { params }).then((r) => r.data);

export const listLiabilities = (params = {}) =>
  API.get(`${BASE}/liabilities`, { params }).then((r) => r.data);

export const waiveLiability = (liabilityId, reason) =>
  API.post(`${BASE}/liabilities/${liabilityId}/waive`, { reason }).then((r) => r.data);

export const getLiabilityById = (liabilityId) =>
  API.get(`${BASE}/liabilities/${liabilityId}`).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §8 RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════

export const runReconciliation = () =>
  API.post(`${BASE}/reconciliation/run`).then((r) => r.data);

export const reconcileWallet = (walletId) =>
  API.post(`${BASE}/reconciliation/wallet/${walletId}`).then((r) => r.data);

export const getPlatformRevenueReconciliation = (params = {}) =>
  API.get(`${BASE}/reconciliation/platform-revenue`, { params }).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §9 FINANCE ADMIN CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

export const manualCredit = (payload) =>
  API.post(`${BASE}/finance/manual-credit`, payload).then((r) => r.data);

export const manualDebit = (payload) =>
  API.post(`${BASE}/finance/manual-debit`, payload).then((r) => r.data);

export const forceSettleBooking = (bookingId) =>
  API.post(`${BASE}/finance/force-settle/${bookingId}`).then((r) => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// §10 REPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const getPartnerDashboard = () =>
  API.get(`${BASE}/reports/partner-dashboard`).then((r) => r.data);

export const getPartnerEarnings = (partnerId, params = {}) =>
  API.get(`${BASE}/reports/partner-earnings/${partnerId}`, { params }).then((r) => r.data);

export const getPlatformRevenueSummary = (params = {}) =>
  API.get(`${BASE}/reports/platform-revenue-summary`, { params }).then((r) => r.data);

export const getSettlementSummary = (params = {}) =>
  API.get(`${BASE}/reports/settlement-summary`, { params }).then((r) => r.data);

export const getLiabilitySummary = () =>
  API.get(`${BASE}/reports/liability-summary`).then((r) => r.data);

export default {
  processBookingSettlement,
  getSettlementStatus,
  getMyWallet,
  getPartnerWallet,
  listWallets,
  freezeWallet,
  releaseWallet,
  updateWalletKycStatus,
  getMyBankDetails,          // Added
  addBankAccount,            // Added
  updateBankAccount,         // Added
  deleteBankAccount,         // Added
  setPrimaryBankAccount,     // Added
  verifyBankAccount,         // Added
  getMyTransactions,
  getPartnerTransactions,
  getTransactionByTxnId,
  getMySettlements,
  getSettlementById,
  listSettlements,
  reverseSettlement,
  getBookingAllocations,
  getMyAllocations,
  requestWithdrawal,
  getMyWithdrawals,
  listWithdrawals,
  getWithdrawalById,
  approveWithdrawal,
  rejectWithdrawal,
  retryWithdrawal,
  getMyLiabilities,
  listLiabilities,
  waiveLiability,
  getLiabilityById,
  runReconciliation,
  reconcileWallet,
  getPlatformRevenueReconciliation,
  manualCredit,
  manualDebit,
  forceSettleBooking,
  getPartnerDashboard,
  getPartnerEarnings,
  getPlatformRevenueSummary,
  getSettlementSummary,
  getLiabilitySummary,
};