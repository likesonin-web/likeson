'use client';

/**
 * AccountingManagementPage.jsx
 *
 * Admin / Superadmin console for the full accounting domain.
 * Wires every thunk exported by `accountingSlice.js` (39 total).
 *
 * Structure (top to bottom):
 * §0  Constants, format helpers, shared UI primitives
 * §1  HelpSection — full operation manual, opened from a header button
 * §2  OverviewTab
 * §3  WalletsTab
 * §4  TransactionsTab
 * §5  SettlementsTab
 * §6  AllocationsTab
 * §7  WithdrawalsTab
 * §8  LiabilitiesTab
 * §9  ReconciliationTab
 * §10 FinanceControlsTab
 * §11 ReportsTab
 * §12 Layout (TabNav, PageHeader) + default export page
 *
 * Styling: every visual class below comes from global.css (.btn, .card,
 * .input-field, .badge, .table, .stat-card, .alert, .label, etc). No
 * inline style={{}} is used anywhere in this file.
 *
 * Suggested location: app/(admin)/accounting/page.jsx
 *
 * Before using, double check:
 * 1. The import path for accountingSlice below.
 * 2. The current-user selector (`state.user.user`) — adjust to match
 * your actual auth slice shape.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Wallet,
  History,
  Receipt,
  ClipboardList,
  ArrowUpFromLine,
  ShieldAlert,
  Scale,
  Banknote,
  BarChart3,
  ShieldCheck,
  Search,
  RefreshCw,
  Snowflake,
  Unlock,
  BadgeCheck,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  IndianRupee,
  Filter,
  Info,
  Gavel,
  PlayCircle,
  HelpCircle,
  BookOpen,
  Landmark,
  ListChecks,
} from 'lucide-react';

import {
  // §1 Settlement
  processBookingSettlement,
  fetchSettlementStatus,
  // §2 Wallet
  fetchMyWallet,
  fetchPartnerWallet,
  fetchWalletsList,
  freezeWallet,
  releaseWallet,
  updateWalletKycStatus,
  // §2b Wallet bank
  fetchMyBankDetails,
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount,
  verifyBankAccount,
  // §3 Transactions
  fetchMyTransactions,
  fetchPartnerTransactions,
  fetchTransactionByTxnId,
  // §4 Settlements
  fetchMySettlements,
  fetchSettlementById,
  fetchSettlementsList,
  reverseSettlement,
  // §5 Allocations
  fetchBookingAllocations,
  fetchMyAllocations,
  // §6 Withdrawals
  requestWithdrawal,
  fetchMyWithdrawals,
  fetchWithdrawalsList,
  fetchWithdrawalById,
  approveWithdrawal,
  rejectWithdrawal,
  retryWithdrawal,
  // §7 Liabilities
  fetchMyLiabilities,
  fetchLiabilitiesList,
  waiveLiability,
  fetchLiabilityById,
  // §8 Reconciliation
  runReconciliation,
  reconcileWallet,
  fetchPlatformRevenueReconciliation,
  // §9 Finance admin
  manualCredit,
  manualDebit,
  forceSettleBooking,
  // §10 Reports
  fetchPartnerDashboard,
  fetchPartnerEarnings,
  fetchPlatformRevenueSummary,
  fetchSettlementSummary,
  fetchLiabilitySummary,
  // Selectors
  selectIsLoading,
  selectError,
  selectSettlementStatus,
  selectLastSettlementResult,
  selectMyWallet,
  selectSelectedPartnerWallet,
  selectWalletsList,
  selectWalletsPagination,
  selectMyBankDetails,
  selectMyBankVerified,
  selectMyTransactions,
  selectPartnerTransactions,
  selectSelectedTxn,
  selectMySettlements,
  selectSettlementsList,
  selectSettlementsListPagination,
  selectSelectedSettlement,
  selectMyAllocations,
  selectBookingAllocations,
  selectMyWithdrawals,
  selectWithdrawalsList,
  selectWithdrawalsListPagination,
  selectSelectedWithdrawal,
  selectMyLiabilities,
  selectLiabilitiesList,
  selectLiabilitiesListSummary,
  selectSelectedLiability,
  selectLastReconciliationRun,
  selectWalletReconciliation,
  selectPlatformRevenueReconciliation,
  selectLastManualCredit,
  selectLastManualDebit,
  selectLastForceSettle,
  selectPartnerDashboard,
  selectPartnerEarnings,
  selectPlatformRevenueSummary,
  selectSettlementSummary,
  selectLiabilitySummary,
} from '@/store/slices/accountingSlice'; // ← adjust path to your slice location

// ═══════════════════════════════════════════════════════════════════════════
// §0a ENUMS (mirrored from backend models, used to populate filter dropdowns)
// ═══════════════════════════════════════════════════════════════════════════

const PARTNER_TYPES = ['doctor', 'hospital', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'lab_partner'];
const WALLET_STATUSES = ['active', 'frozen', 'suspended', 'closed'];
const LEDGER_TYPES = [
  'BOOKING_EARNING', 'BOOKING_REVERSAL', 'SETTLEMENT_CREDIT', 'RECOVERY_DEDUCTION',
  'LIABILITY_CREATED', 'MANUAL_CREDIT', 'MANUAL_DEBIT', 'WITHDRAWAL_REQUEST',
  'WITHDRAWAL_SUCCESS', 'WITHDRAWAL_FAILED', 'WITHDRAWAL_REVERSED', 'ADJUSTMENT', 'REFUND_RECOVERY',
];
const SETTLEMENT_STATUSES = ['PENDING', 'SETTLED', 'REVERSED', 'FAILED', 'SKIPPED'];
const WITHDRAWAL_STATUSES = [
  'REQUESTED', 'APPROVED', 'REJECTED', 'queued', 'pending', 'processing', 'processed', 'reversed', 'cancelled', 'failed',
];
const LIABILITY_STATUSES = ['OPEN', 'PARTIALLY_RECOVERED', 'RECOVERED', 'WAIVED'];

const WALLET_BADGE = { active: 'badge-success', frozen: 'badge-error', suspended: 'badge-warning', closed: 'badge-secondary' };
const SETTLEMENT_BADGE = { PENDING: 'badge-warning', SETTLED: 'badge-success', REVERSED: 'badge-error', FAILED: 'badge-error', SKIPPED: 'badge-secondary' };
const WITHDRAWAL_BADGE = {
  REQUESTED: 'badge-info', APPROVED: 'badge-info', REJECTED: 'badge-error', queued: 'badge-info',
  pending: 'badge-warning', processing: 'badge-warning', processed: 'badge-success', reversed: 'badge-warning',
  cancelled: 'badge-secondary', failed: 'badge-error',
};
const LIABILITY_BADGE = { OPEN: 'badge-error', PARTIALLY_RECOVERED: 'badge-warning', RECOVERED: 'badge-success', WAIVED: 'badge-secondary' };

// ═══════════════════════════════════════════════════════════════════════════
// §0b FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const formatINR = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0));

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const idOf = (ref) => (ref?._id ? ref._id : ref) ?? '—';
const nameOf = (ref) => ref?.name ?? idOf(ref);

// ═══════════════════════════════════════════════════════════════════════════
// §0c SHARED UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

function FieldLabel({ children, note, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5">
      <span className="label-text">
        {children}
        {required ? <span className="text-error"> *</span> : null}
      </span>
      {note ? <span className="label-text-alt block mt-0.5">{note}</span> : null}
    </label>
  );
}

function StatusBadge({ status, map }) {
  if (!status) return <span className="badge badge-secondary">UNKNOWN</span>;
  return <span className={`badge ${map[status] || 'badge-secondary'}`}>{status}</span>;
}

function ActionButton({ children, onClick, loading, variant = 'primary', icon: Icon, size, disabled, type = 'button', className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}

function IconButton({ icon: Icon, onClick, title, loading, variant = 'ghost', disabled }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-sm btn-circle btn-${variant}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
    </button>
  );
}

function SectionCard({ title, icon: Icon, subtitle, children, className = '', step }) {
  return (
    <div className={`card p-5 md:p-6 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 flex items-start gap-2.5">
          {step ? <span className="role-badge shrink-0">{step}</span> : Icon ? <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" /> : null}
          <div>
            {title ? <h4 className="!text-base font-bold m-0">{title}</h4> : null}
            {subtitle ? <p className="label-text-alt mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function CompletenessNote({ children }) {
  return (
    <div className="alert alert-info mt-1">
      <Info className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="text-xs">{children}</p>
    </div>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="alert alert-error mt-3">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-8 text-base-content/50 text-sm">
        {children}
      </td>
    </tr>
  );
}

function SkeletonRows({ rows = 3, colSpan = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={colSpan} className="py-3">
            <div className="skeleton h-5 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

function PaginationBar({ pagination, onPageChange, disabled }) {
  const { page = 1, pages = 1, total = 0 } = pagination ?? {};
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-base-300 text-sm">
      <span className="text-base-content/60">
        Page {page} of {pages} &middot; {total} total
      </span>
      <div className="flex gap-2">
        <button className="btn btn-sm btn-ghost" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <button className="btn btn-sm btn-ghost" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ReasonModal({ open, title, note, onConfirm, onClose, loading, confirmLabel = 'Confirm', variant = 'error' }) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-neutral/60 backdrop-blur-soft z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="card p-6 w-full max-w-md"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="!text-base font-bold m-0">{title}</h4>
            <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost"><X className="w-4 h-4" /></button>
          </div>
          <FieldLabel note={note} required>Reason</FieldLabel>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="input-field resize-none"
            placeholder="Explain why for the audit trail…"
          />
          <div className="flex justify-end gap-2 mt-5">
            <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
            <ActionButton
              variant={variant}
              loading={loading}
              disabled={!reason.trim()}
              onClick={() => onConfirm(reason.trim())}
            >
              {confirmLabel}
            </ActionButton>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §0d ACCESS GATE
// ═══════════════════════════════════════════════════════════════════════════

function AccessDenied() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-error mx-auto mb-4" />
        <h3 className="mb-2">Access Restricted</h3>
        <p className="text-base-content/70 text-sm">
          Accounting Management is limited to Admin and Superadmin roles. Contact a system administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 HELP SECTION
// ═══════════════════════════════════════════════════════════════════════════

const HELP_TOPICS = [
  {
    id: 'settlement',
    icon: PlayCircle,
    title: 'Settlement — turn a completed booking into partner payouts',
    steps: [
      'Open the Settlements tab.',
      'Paste the Booking ID into "Process Booking Settlement" and click Process.',
      'The engine computes one allocation per partner (doctor, hospital, care assistant, driver/transport, lab), deducts platform fee + tax + TDS + any recovery, then credits each partner wallet.',
      'Re-running the same Booking ID is safe — it detects settlementProcessed and returns "already processed" instead of double-crediting.',
    ],
    example:
      'Booking BK-7F3K2QXZ (full_care_ride, total Rs 3000) completes. Click Process with that booking ObjectId. Result: doctor gets Rs 1200 gross minus platform fee, care assistant gets Rs 1000 minus platform fee, driver gets the ride fare minus 1 percent TDS. Platform keeps the remainder.',
  },
  {
    id: 'wallets',
    icon: Wallet,
    title: 'Wallets — balances, freeze/release, KYC flags',
    steps: [
      'Open the Wallets tab and filter by role/status/min balance, or leave filters empty to see everyone.',
      'Click the eye icon to load full detail for one partner.',
      'Freeze stops all future credits/debits — you must type a reason; it is written to the ledger as an audit ADJUSTMENT entry.',
      'Release reverses a freeze the same way.',
      'The badge-check icon toggles both kycVerified and bankVerified at once — use this after confirming documents outside the system.',
    ],
    example:
      'A driver wallet shows recoveryBalance greater than zero (they owe cash they collected on a PAY_AT_SERVICE booking). Filter "Only wallets with outstanding liability" to find every such wallet platform-wide.',
  },
  {
    id: 'transactions',
    icon: History,
    title: 'Transactions — the append-only ledger',
    steps: [
      'Every wallet balance is a cached projection; this ledger is the real source of truth.',
      'Enter a Partner ID (the User._id, not the profile id) to see their full history.',
      'Filter by type (e.g. BOOKING_EARNING, WITHDRAWAL_SUCCESS, RECOVERY_DEDUCTION) and date range.',
      'Use "Look Up a Single Transaction" with the human-readable txnId (e.g. PTXN-AB12CD34EF) when a partner quotes one to you.',
    ],
    example:
      'Partner disputes a payout. Search their Partner ID with type=BOOKING_EARNING and the date of the booking — you will see beforeBalance/afterBalance and the exact bookingId tied to the entry.',
  },
  {
    id: 'settlements',
    icon: Receipt,
    title: 'Settlements — per-partner settlement records + reversal',
    steps: [
      'List/filter every settlement by partner, booking, role, status, or date.',
      'Click the eye icon to view the raw settlement document.',
      'Only a SETTLED settlement can be reversed (e.g. customer refund after payout). Reversal clamps to the partner current available balance so it can never push them negative.',
      'Look up by booking with "Settlement Status Lookup" — shows booking + every allocation + every settlement record together, which is the fastest way to debug a multi-partner booking.',
    ],
    example:
      'Customer refunds a Rs 2000 ride after the driver was already paid Rs 900 net. Reverse that settlement with reason "Customer refund — booking cancelled post-completion"; Rs 900 (or whatever remains available) is debited back and the settlement flips to REVERSED.',
  },
  {
    id: 'allocations',
    icon: ClipboardList,
    title: 'Allocations — per-partner share of one booking',
    steps: [
      'Paste a Booking ID to see every partner allocation row for that booking side by side.',
      'Useful for multi-partner bookings (full_care_ride) where doctor + care assistant + driver + platform all take a slice of one payment.',
      '"Cash Collector?" shows which partner physically received the customer cash on a PAY_AT_SERVICE booking and how much.',
    ],
    example:
      'full_care_ride booking totaling Rs 3000: doctor allocation grossAmount Rs 1200, care assistant Rs 1000, driver Rs 500 — platform retains the remaining Rs 300 (not shown as an allocation row, since the platform does not have a wallet).',
  },
  {
    id: 'withdrawals',
    icon: ArrowUpFromLine,
    title: 'Withdrawals — partner payout requests via RazorpayX',
    steps: [
      'List/filter requests by partner, status, or date.',
      'A REQUESTED withdrawal can be Approved (locks the amount and fires the RazorpayX payout) or Rejected (reason required — restores the locked amount to availableBalance immediately).',
      'A failed payout can be Retried once the underlying issue (e.g. bad IFSC) is fixed.',
      'The webhook endpoint (POST /withdrawals/webhook) is public and Razorpay-signed — it updates status automatically as the payout clears; you do not need to do anything for that part.',
    ],
    example:
      'Partner requests Rs 4500. You see it as REQUESTED. Approve it once their KYC + bank are verified — clicking Approve calls RazorpayX and the row moves to processing, then processed once Razorpay confirms.',
  },
  {
    id: 'liabilities',
    icon: ShieldAlert,
    title: 'Liabilities — cash a partner collected but does not fully own',
    steps: [
      'Created automatically when a PAY_AT_SERVICE collector receives more cash than their own entitlement (e.g. a driver collects the full booking amount which also covers the doctor share).',
      'List/filter by partner, status, or booking.',
      'Waive clears the remaining outstanding balance — use only when the partner cannot or should not repay (write-off), since it is irreversible and audit-logged.',
      'outstandingLiability = totalLiability minus amountRecovered; recovery normally happens automatically from the partner future settlements before this needs manual attention.',
    ],
    example:
      'Driver collects Rs 3000 cash for a full_care_ride but only owns Rs 500 of that (the ride fare) — the other Rs 2500 belongs to the doctor and care assistant. A liability of Rs 2500 is created against the driver wallet and recovered from their next earnings.',
  },
  {
    id: 'reconciliation',
    icon: Scale,
    title: 'Reconciliation — verify ledger sum equals wallet balance',
    steps: [
      'Run Full Reconciliation to check every non-closed wallet at once (normally runs nightly via cron; this lets you force it).',
      'Any mismatch (delta over Rs 0.01) is listed with walletBalance vs ledgerBalance so you can see the drift immediately.',
      'Reconcile a single wallet when investigating one partner dispute — paste the PartnerWallet._id (not the User id).',
      'Platform Revenue Reconciliation cross-checks total platform fee collected against all SETTLED settlements for a date range.',
    ],
    example:
      'A partner disputes their balance. Find their walletId from the Wallets tab, paste it into "Reconcile a Single Wallet" — if ledgerBalance does not equal walletBalance, that confirms a real bug rather than partner confusion.',
  },
  {
    id: 'finance',
    icon: Banknote,
    title: 'Finance Controls — manual credit/debit, force-settle',
    steps: [
      'Manual Credit/Debit directly adjusts a partner availableBalance. Both require Partner ID, Amount, and a Reason — every action writes an immutable MANUAL_CREDIT/MANUAL_DEBIT ledger entry visible to the partner.',
      'Debit cannot exceed the partner current available balance (the backend rejects it).',
      'Force-Settle is superadmin-only — it resets a stuck booking settlementProcessed flag and re-runs settlement. Use only when a booking is confirmed completed but stuck unsettled.',
    ],
    example:
      'Goodwill credit: partner had a bad ride experience, support team approves Rs 200 goodwill. Manual Credit with reason "Goodwill credit — ticket 4821, delayed pickup compensation".',
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Reports — dashboards for one partner or the whole platform',
    steps: [
      'Partner Earnings Report: paste a Partner ID plus optional date range plus grouping (day/week/month) for a full earning history and role breakdown.',
      'Platform Revenue Summary: gross/platform-fee/net/absorbed totals across all SETTLED settlements, grouped by partner role.',
      'Settlement Summary: counts and totals broken down by settlementStatus and by partnerRole.',
      'Liability Summary: platform-wide outstanding liability plus a top-10 "offenders" table (largest outstanding balances).',
    ],
    example:
      'Monthly finance review: pull Platform Revenue Summary for the last calendar month, cross-check grandTotalNet against your bank settlement report.',
  },
];

function HelpSection({ open, onClose, initialTopic }) {
  const [activeTopic, setActiveTopic] = useState(initialTopic || HELP_TOPICS[0].id);
  
  useEffect(() => {
    if (open) {
      setActiveTopic(initialTopic || HELP_TOPICS[0].id);
    }
  }, [open, initialTopic]);

  if (!open) return null;

  const topic = HELP_TOPICS.find((t) => t.id === activeTopic) ?? HELP_TOPICS[0];
  const TopicIcon = topic.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-neutral/60 backdrop-blur-soft z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          className="card w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 shrink-0">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-primary" />
              <div>
                <h4 className="!text-lg font-bold m-0">How Accounting Management Works</h4>
                <p className="label-text-alt mt-0.5">Every operation on this page, in plain terms, with a worked example.</p>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex flex-1 min-h-0 flex-col md:flex-row">
            <nav className="md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-base-300 overflow-x-auto md:overflow-y-auto p-3 flex md:flex-col gap-1">
              {HELP_TOPICS.map((t) => {
                const Icon = t.icon;
                const active = t.id === activeTopic;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTopic(t.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-field text-left text-sm font-semibold whitespace-nowrap md:whitespace-normal transition-colors
                      ${active ? 'bg-primary/10 text-primary border border-primary/30' : 'text-base-content/70 hover:bg-base-200'}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {t.title.split('—')[0].trim()}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start gap-2.5 mb-4">
                <TopicIcon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <h5 className="!text-base font-bold m-0">{topic.title}</h5>
              </div>

              <ol className="space-y-2.5 mb-5">
                {topic.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="role-badge shrink-0 !px-2 !py-0.5">{i + 1}</span>
                    <span className="text-base-content/85">{s}</span>
                  </li>
                ))}
              </ol>

              <div className="alert alert-info">
                <ListChecks className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1">Worked example</p>
                  <p className="text-xs">{topic.example}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 border-t border-base-300 shrink-0 flex justify-end">
            <ActionButton variant="ghost" onClick={onClose}>Close</ActionButton>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function HelpButton({ label = 'How does this work?', topicId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <HelpCircle className="w-4 h-4" /> {label}
      </button>
      <HelpSection open={open} onClose={() => setOpen(false)} initialTopic={topicId} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const dispatch = useDispatch();
  const revenueSummary = useSelector(selectPlatformRevenueSummary);
  const settlementSummary = useSelector(selectSettlementSummary);
  const liabilitySummary = useSelector(selectLiabilitySummary);
  const lastRun = useSelector(selectLastReconciliationRun);
  const myWallet = useSelector(selectMyWallet);
  const partnerDashboard = useSelector(selectPartnerDashboard);

  const loadingSettlementSummary = useSelector(selectIsLoading('reports/settlementSummary'));
  const loadingLiabilitySummary = useSelector(selectIsLoading('reports/liabilitySummary'));
  const loadingReconciliation = useSelector(selectIsLoading('reconciliation/run'));
  const loadingMyWallet = useSelector(selectIsLoading('wallet/fetchMine'));
  const loadingDashboard = useSelector(selectIsLoading('reports/partnerDashboard'));

  const [showSelfService, setShowSelfService] = useState(false);

  useEffect(() => {
    dispatch(fetchPlatformRevenueSummary({}));
    dispatch(fetchSettlementSummary({}));
    dispatch(fetchLiabilitySummary());
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">Platform-wide snapshot. Each card below links to the tab that can act on it.</p>
        <HelpButton label="What does this dashboard mean?" topicId="reports" />
      </div>

      <div className="grid-responsive">
        <div className="stat-card">
          <p className="stat-card-label">Platform Net Revenue</p>
          <p className="stat-card-value">{formatINR(revenueSummary?.grandTotalNet)}</p>
          <p className="label-text-alt mt-1">Sum of netSettlement across all SETTLED settlements, all-time.</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Platform Fees Collected</p>
          <p className="stat-card-value">{formatINR(revenueSummary?.grandTotalPlatformFee)}</p>
          <p className="label-text-alt mt-1">Total commission retained across every partner role.</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Subscription Absorbed</p>
          <p className="stat-card-value">{formatINR(revenueSummary?.grandTotalAbsorbed)}</p>
          <p className="label-text-alt mt-1">Discount the platform absorbed so partner payouts stayed unchanged.</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Pending Settlements</p>
          <p className="stat-card-value">{settlementSummary?.pendingTotal?.count ?? 0}</p>
          <p className="label-text-alt mt-1">Allocations created but not yet credited to a wallet.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Settlement Status Breakdown" icon={Receipt} subtitle="Counts and totals by settlementStatus, all-time. Drill in from the Settlements tab.">
          {loadingSettlementSummary ? (
            <div className="skeleton h-32 w-full" />
          ) : (
            <table className="table">
              <thead><tr><th>Status</th><th>Count</th><th>Net total</th></tr></thead>
              <tbody>
                {(settlementSummary?.byStatus ?? []).length === 0 ? (
                  <EmptyRow colSpan={3}>No settlement data yet.</EmptyRow>
                ) : (
                  settlementSummary.byStatus.map((row) => (
                    <tr key={row._id}>
                      <td><StatusBadge status={row._id} map={SETTLEMENT_BADGE} /></td>
                      <td>{row.count}</td>
                      <td>{formatINR(row.totalNet)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title="Liability Status Breakdown" icon={ShieldAlert} subtitle="Cash-collection liability across all partners. Drill in from the Liabilities tab.">
          {loadingLiabilitySummary ? (
            <div className="skeleton h-32 w-full" />
          ) : (
            <table className="table">
              <thead><tr><th>Status</th><th>Count</th><th>Outstanding</th></tr></thead>
              <tbody>
                {(liabilitySummary?.summary ?? []).length === 0 ? (
                  <EmptyRow colSpan={3}>No liabilities recorded.</EmptyRow>
                ) : (
                  liabilitySummary.summary.map((row) => (
                    <tr key={row._id}>
                      <td><StatusBadge status={row._id} map={LIABILITY_BADGE} /></td>
                      <td>{row.count}</td>
                      <td>{formatINR(row.totalOutstanding)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Daily Reconciliation" icon={Scale} subtitle="Cross-checks ledger sum against the cached wallet projection for every active wallet.">
        <FieldLabel note="No inputs needed — this checks every non-closed wallet platform-wide. Normally runs nightly; use this button to force a run on demand.">
          Run check now
        </FieldLabel>
        <ActionButton icon={PlayCircle} loading={loadingReconciliation} onClick={() => dispatch(runReconciliation())}>
          Run Reconciliation Now
        </ActionButton>
        {lastRun && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            <div className="stat-card"><p className="stat-card-label">Checked</p><p className="stat-card-value">{lastRun.checked}</p></div>
            <div className="stat-card"><p className="stat-card-label">Matched</p><p className="stat-card-value text-success">{lastRun.matched}</p></div>
            <div className="stat-card"><p className="stat-card-label">Mismatches</p><p className="stat-card-value text-error">{lastRun.mismatches}</p></div>
            <div className="stat-card"><p className="stat-card-label">Checked At</p><p className="text-sm font-semibold mt-2">{formatDate(lastRun.checkedAt)}</p></div>
          </div>
        )}
      </SectionCard>

      <button onClick={() => setShowSelfService((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelfService ? 'Hide' : 'Show'} self-service endpoints (completeness)
      </button>

      <AnimatePresence>
        {showSelfService && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="My Wallet (self)" icon={Wallet} subtitle="fetchMyWallet / fetchPartnerDashboard — partner-only routes, included for completeness">
              <CompletenessNote>
                These two endpoints require a PARTNER_ROLES account (doctor, care_assistant, driver, etc). An admin/superadmin
                account does not have a wallet, so the requests below will return a 403/404 — that's expected, not a bug.
              </CompletenessNote>
              <div className="flex gap-2 mt-3">
                <ActionButton size="sm" variant="outline" loading={loadingMyWallet} onClick={() => dispatch(fetchMyWallet())}>
                  Fetch My Wallet
                </ActionButton>
                <ActionButton size="sm" variant="outline" loading={loadingDashboard} onClick={() => dispatch(fetchPartnerDashboard())}>
                  Fetch My Partner Dashboard
                </ActionButton>
              </div>
              {myWallet && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(myWallet, null, 2)}</pre>}
              {partnerDashboard && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(partnerDashboard, null, 2)}</pre>}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §3 TAB: WALLETS
// ═══════════════════════════════════════════════════════════════════════════

function WalletsTab() {
  const dispatch = useDispatch();
  const list = useSelector(selectWalletsList);
  const pagination = useSelector(selectWalletsPagination);
  const selected = useSelector(selectSelectedPartnerWallet);
  const myWallet = useSelector(selectMyWallet);
  const myBankDetails = useSelector(selectMyBankDetails);
  const myBankVerified = useSelector(selectMyBankVerified);

  const loadingList = useSelector(selectIsLoading('wallet/fetchList'));
  const loadingDetail = useSelector(selectIsLoading('wallet/fetchOne'));
  const loadingFreeze = useSelector(selectIsLoading('wallet/freeze'));
  const loadingRelease = useSelector(selectIsLoading('wallet/release'));
  const loadingKyc = useSelector(selectIsLoading('wallet/updateKyc'));
  const loadingMine = useSelector(selectIsLoading('wallet/fetchMine'));
  const loadingBankFetch = useSelector(selectIsLoading('wallet/bank/fetchMine'));
  const loadingBankAdd = useSelector(selectIsLoading('wallet/bank/add'));
  const loadingBankUpdate = useSelector(selectIsLoading('wallet/bank/update'));
  const loadingBankDelete = useSelector(selectIsLoading('wallet/bank/delete'));
  const loadingBankPrimary = useSelector(selectIsLoading('wallet/bank/setPrimary'));
  const loadingBankVerify = useSelector(selectIsLoading('wallet/bank/verify'));
  const error = useSelector(selectError('wallet/fetchList'));

  const [filters, setFilters] = useState({ role: '', status: '', hasLiability: false, minBalance: '', limit: 20 });
  const [freezeTarget, setFreezeTarget] = useState(null);
  const [showSelf, setShowSelf] = useState(false);
  const [bankForm, setBankForm] = useState({ accountHolderName: '', accountNumberLast4: '', ifscCode: '', bankName: '', branchName: '', upiId: '' });
  const [editBankId, setEditBankId] = useState(null);
  const [verifyForm, setVerifyForm] = useState({ partnerId: '', bankId: '' });

  const runSearch = useCallback((page = 1) => {
    const params = { page, limit: filters.limit };
    if (filters.role) params.role = filters.role;
    if (filters.status) params.status = filters.status;
    if (filters.hasLiability) params.hasLiability = 'true';
    if (filters.minBalance) params.minBalance = filters.minBalance;
    dispatch(fetchWalletsList(params));
  }, [dispatch, filters]);

  useEffect(() => { runSearch(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">Search, inspect, freeze/release, or update KYC + bank details for any partner wallet.</p>
        <HelpButton label="How do freeze / KYC / bank verification work?" topicId="wallets" />
      </div>

      <SectionCard title="Partner Wallets" icon={Wallet} subtitle="Filter, inspect, freeze, release, or update KYC flags on any partner wallet">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <FieldLabel note="Restrict results to a single partner type. Leave blank to see every role mixed together.">Partner Role</FieldLabel>
            <select className="input-field" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
              <option value="">All roles</option>
              {PARTNER_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel note="active = normal. frozen/suspended block credits+debits. closed is permanently retired.">Wallet Status</FieldLabel>
            <select className="input-field" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {WALLET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel note="Only show wallets with at least this much in availableBalance, in rupees.">Min Balance</FieldLabel>
            <input type="number" className="input-field" placeholder="e.g. 500" value={filters.minBalance} onChange={(e) => setFilters((f) => ({ ...f, minBalance: e.target.value }))} />
          </div>
          <div>
            <FieldLabel note="How many rows to load per page. Server caps this at 100.">Page Size</FieldLabel>
            <select className="input-field" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, limit: Number(e.target.value) }))}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <label className="label mt-3 !p-0 w-fit">
          <input type="checkbox" className="checkbox" checked={filters.hasLiability} onChange={(e) => setFilters((f) => ({ ...f, hasLiability: e.target.checked }))} />
          <span className="label-text">Only wallets with outstanding liability (recoveryBalance &gt; 0)</span>
        </label>
        <ActionButton icon={Search} className="mt-4" loading={loadingList} onClick={() => runSearch(1)}>Search</ActionButton>
        <ErrorNote message={error} />

        <div className="overflow-x-auto mt-5">
          <table className="table">
            <thead>
              <tr><th>Partner</th><th>Role</th><th>Available</th><th>Recovery</th><th>Status</th><th>KYC / Bank</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loadingList ? <SkeletonRows colSpan={7} /> : list.length === 0 ? (
                <EmptyRow colSpan={7}>No wallets match these filters.</EmptyRow>
              ) : (
                list.map((w) => (
                  <tr key={w._id}>
                    <td className="font-semibold">{nameOf(w.partner)}</td>
                    <td><span className="badge badge-secondary">{w.partnerRole}</span></td>
                    <td>{formatINR(w.availableBalance)}</td>
                    <td className={w.recoveryBalance > 0 ? 'text-error font-semibold' : ''}>{formatINR(w.recoveryBalance)}</td>
                    <td><StatusBadge status={w.walletStatus} map={WALLET_BADGE} /></td>
                    <td>
                      <span className={`badge badge-sm ${w.kycVerified ? 'badge-success' : 'badge-error'}`}>KYC</span>{' '}
                      <span className={`badge badge-sm ${w.bankVerified ? 'badge-success' : 'badge-error'}`}>Bank</span>
                    </td>
                    <td className="flex gap-1.5 justify-end">
                      <IconButton icon={Eye} title="View detail" loading={loadingDetail} onClick={() => dispatch(fetchPartnerWallet(idOf(w.partner)))} />
                      {w.walletStatus === 'frozen' ? (
                        <IconButton icon={Unlock} title="Release" loading={loadingRelease} onClick={() => dispatch(releaseWallet({ partnerId: idOf(w.partner), reason: 'Released from Wallets tab' }))} />
                      ) : (
                        <IconButton icon={Snowflake} title="Freeze" loading={loadingFreeze} onClick={() => setFreezeTarget(idOf(w.partner))} />
                      )}
                      <IconButton
                        icon={BadgeCheck}
                        title="Toggle KYC + Bank verified"
                        loading={loadingKyc}
                        onClick={() => dispatch(updateWalletKycStatus({ partnerId: idOf(w.partner), kycVerified: !w.kycVerified, bankVerified: !w.bankVerified }))}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={pagination} disabled={loadingList} onPageChange={runSearch} />
      </SectionCard>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <SectionCard title={`Wallet Detail — ${nameOf(selected.user)}`} icon={Wallet} subtitle={idOf(selected.user)}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card"><p className="stat-card-label">Available</p><p className="stat-card-value">{formatINR(selected.wallet.availableBalance)}</p></div>
                <div className="stat-card"><p className="stat-card-label">Withdrawal Locked</p><p className="stat-card-value">{formatINR(selected.wallet.withdrawalBalance)}</p></div>
                <div className="stat-card"><p className="stat-card-label">Outstanding Liability</p><p className="stat-card-value text-error">{formatINR(selected.outstandingLiability)}</p></div>
                <div className="stat-card"><p className="stat-card-label">Status</p><div className="mt-2"><StatusBadge status={selected.wallet.walletStatus} map={WALLET_BADGE} /></div></div>
              </div>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionCard title="Verify a Partner Bank Account" icon={BadgeCheck} subtitle="Admin confirms a bank account after checking documents outside the system. Marks bankVerified on the wallet if this is the partner's primary account.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <FieldLabel note="Required. The partner User._id (not the wallet id)." required>Partner ID</FieldLabel>
            <input className="input-field" value={verifyForm.partnerId} onChange={(e) => setVerifyForm((f) => ({ ...f, partnerId: e.target.value }))} />
          </div>
          <div>
            <FieldLabel note="Required. The bank sub-document _id from that partner's bankDetails array (see their wallet detail)." required>Bank ID</FieldLabel>
            <input className="input-field" value={verifyForm.bankId} onChange={(e) => setVerifyForm((f) => ({ ...f, bankId: e.target.value }))} />
          </div>
          <ActionButton
            icon={BadgeCheck}
            loading={loadingBankVerify}
            disabled={!verifyForm.partnerId.trim() || !verifyForm.bankId.trim()}
            onClick={() => dispatch(verifyBankAccount({ partnerId: verifyForm.partnerId.trim(), bankId: verifyForm.bankId.trim() }))}
          >
            Verify Bank Account
          </ActionButton>
        </div>
      </SectionCard>

      <button onClick={() => setShowSelf((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelf ? 'Hide' : 'Show'} self-service endpoints (completeness)
      </button>
      <AnimatePresence>
        {showSelf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="fetchMyWallet (self)" icon={Wallet} subtitle="Partner-only — included for completeness">
              <CompletenessNote>Admin accounts have no partner wallet; expect a 403/404 from this call.</CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingMine} onClick={() => dispatch(fetchMyWallet())}>Fetch My Wallet</ActionButton>
              {myWallet && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(myWallet, null, 2)}</pre>}
            </SectionCard>

            <SectionCard title="My Bank Accounts (self) — full CRUD" icon={Landmark} subtitle="Partner-only — fetchMyBankDetails, addBankAccount, updateBankAccount, deleteBankAccount, setPrimaryBankAccount" className="mt-4">
              <CompletenessNote>Up to 3 bank accounts per wallet. Only the last 4 digits of the account number are ever stored.</CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingBankFetch} onClick={() => dispatch(fetchMyBankDetails())}>Fetch My Bank Accounts</ActionButton>

              <div className="divider" />
              <p className="label-text mb-3">Add / Update a bank account</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel note="Required. Name exactly as registered with the bank." required>Account Holder Name</FieldLabel>
                  <input className="input-field" value={bankForm.accountHolderName} onChange={(e) => setBankForm((f) => ({ ...f, accountHolderName: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel note="Required for new accounts. Exactly 4 digits — only the last 4 are ever stored." required>Account Number (last 4)</FieldLabel>
                  <input maxLength={4} className="input-field" value={bankForm.accountNumberLast4} onChange={(e) => setBankForm((f) => ({ ...f, accountNumberLast4: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel note="Required for new accounts. 11-character branch code, e.g. HDFC0001234." required>IFSC Code</FieldLabel>
                  <input className="input-field" value={bankForm.ifscCode} onChange={(e) => setBankForm((f) => ({ ...f, ifscCode: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel note="Optional, display only.">Bank Name</FieldLabel>
                  <input className="input-field" value={bankForm.bankName} onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel note="Optional, display only.">Branch Name</FieldLabel>
                  <input className="input-field" value={bankForm.branchName} onChange={(e) => setBankForm((f) => ({ ...f, branchName: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel note="Optional. Only editable on existing accounts, not required to add a new one.">UPI ID</FieldLabel>
                  <input className="input-field" value={bankForm.upiId} onChange={(e) => setBankForm((f) => ({ ...f, upiId: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <ActionButton
                  size="sm"
                  icon={PlusCircle}
                  loading={loadingBankAdd}
                  disabled={!bankForm.accountHolderName || !bankForm.accountNumberLast4 || !bankForm.ifscCode}
                  onClick={() => dispatch(addBankAccount(bankForm))}
                >
                  Add New Bank Account
                </ActionButton>
                <ActionButton
                  size="sm"
                  variant="outline"
                  icon={RotateCcw}
                  loading={loadingBankUpdate}
                  disabled={!editBankId}
                  onClick={() => dispatch(updateBankAccount({ bankId: editBankId, payload: { accountHolderName: bankForm.accountHolderName, bankName: bankForm.bankName, branchName: bankForm.branchName, upiId: bankForm.upiId } }))}
                >
                  Update Selected (Bank ID: {editBankId || 'none selected'})
                </ActionButton>
              </div>

              {myBankDetails.length > 0 && (
                <div className="overflow-x-auto mt-5">
                  <table className="table">
                    <thead><tr><th>Holder</th><th>Account</th><th>IFSC</th><th>Primary</th><th>Verified</th><th>Actions</th></tr></thead>
                    <tbody>
                      {myBankDetails.map((b) => (
                        <tr key={b._id}>
                          <td>{b.accountHolderName}</td>
                          <td className="font-mono text-xs">••••{b.accountNumberLast4}</td>
                          <td className="font-mono text-xs">{b.ifscCode}</td>
                          <td>{b.isPrimary ? <span className="badge badge-success badge-sm">Primary</span> : '—'}</td>
                          <td>{b.isVerified ? <span className="badge badge-success badge-sm">Verified</span> : <span className="badge badge-warning badge-sm">Pending</span>}</td>
                          <td className="flex gap-1.5 justify-end">
                            <IconButton icon={Eye} title="Select for update" onClick={() => { setEditBankId(b._id); setBankForm((f) => ({ ...f, accountHolderName: b.accountHolderName, bankName: b.bankName ?? '', branchName: b.branchName ?? '', upiId: b.upiId ?? '' })); }} />
                            {!b.isPrimary && <IconButton icon={BadgeCheck} title="Set as primary" loading={loadingBankPrimary} onClick={() => dispatch(setPrimaryBankAccount(b._id))} />}
                            <IconButton icon={X} variant="error" title="Delete" loading={loadingBankDelete} onClick={() => dispatch(deleteBankAccount(b._id))} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="label-text-alt mt-2">bankVerified (wallet-level): {myBankVerified ? 'Yes' : 'No'}</p>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ReasonModal
        open={!!freezeTarget}
        title="Freeze Wallet"
        note="Required. Stored on the wallet and written to the ledger as an audit ADJUSTMENT entry."
        confirmLabel="Freeze Wallet"
        loading={loadingFreeze}
        onClose={() => setFreezeTarget(null)}
        onConfirm={(reason) => { dispatch(freezeWallet({ partnerId: freezeTarget, reason })); setFreezeTarget(null); }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §4 TAB: TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function TransactionsTab() {
  const dispatch = useDispatch();
  const [partnerId, setPartnerId] = useState('');
  const [type, setType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [txnIdLookup, setTxnIdLookup] = useState('');
  const [showSelf, setShowSelf] = useState(false);

  const partnerTx = useSelector(selectPartnerTransactions(partnerId));
  const selectedTxn = useSelector(selectSelectedTxn);
  const myTransactions = useSelector(selectMyTransactions);

  const loadingPartner = useSelector(selectIsLoading('transactions/fetchForPartner'));
  const loadingTxn = useSelector(selectIsLoading('transactions/fetchOne'));
  const loadingMine = useSelector(selectIsLoading('transactions/fetchMine'));
  const error = useSelector(selectError('transactions/fetchForPartner'));

  const search = useCallback((page = 1) => {
    if (!partnerId.trim()) return;
    const params = { page, limit: 20 };
    if (type) params.type = type;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    dispatch(fetchPartnerTransactions({ partnerId: partnerId.trim(), params }));
  }, [dispatch, partnerId, type, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">The append-only ledger — the real source of truth behind every wallet balance.</p>
        <HelpButton label="What is the ledger and how do I read it?" topicId="transactions" />
      </div>

      <SectionCard title="Ledger Transactions" icon={History} subtitle="Append-only ledger — the source of truth for every wallet balance">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <FieldLabel note="Required. Mongo ObjectId of the partner User (not the role-profile id)." required>Partner ID</FieldLabel>
            <input className="input-field" placeholder="64f1a2b3c4d5e6f7a8b9c0d1" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} />
          </div>
          <div>
            <FieldLabel note="Optional. Narrow down to one kind of ledger entry, e.g. BOOKING_EARNING.">Type</FieldLabel>
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {LEDGER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel note="Inclusive start date.">From</FieldLabel>
              <input type="date" className="input-field" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <FieldLabel note="Inclusive end date.">To</FieldLabel>
              <input type="date" className="input-field" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </div>
        <ActionButton icon={Search} className="mt-4" loading={loadingPartner} disabled={!partnerId.trim()} onClick={() => search(1)}>
          Search Transactions
        </ActionButton>
        <ErrorNote message={error} />

        <div className="overflow-x-auto mt-5">
          <table className="table">
            <thead><tr><th>Txn ID</th><th>Type</th><th>Direction</th><th>Amount</th><th>Balance After</th><th>Date</th></tr></thead>
            <tbody>
              {loadingPartner ? <SkeletonRows colSpan={6} /> : partnerTx.items.length === 0 ? (
                <EmptyRow colSpan={6}>{partnerId ? 'No transactions found.' : 'Enter a Partner ID and search.'}</EmptyRow>
              ) : (
                partnerTx.items.map((t) => (
                  <tr key={t._id}>
                    <td className="font-mono text-xs">{t.txnId}</td>
                    <td><span className="badge badge-secondary badge-sm">{t.type}</span></td>
                    <td className={t.direction === 'credit' ? 'text-success font-semibold' : t.direction === 'debit' ? 'text-error font-semibold' : ''}>{t.direction}</td>
                    <td>{formatINR(t.amount)}</td>
                    <td>{formatINR(t.afterBalance)}</td>
                    <td className="text-xs">{formatDate(t.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={partnerTx.pagination} disabled={loadingPartner} onPageChange={search} />
      </SectionCard>

      <SectionCard title="Look Up a Single Transaction" icon={Search} subtitle="Resolve any ledger entry by its human-readable txnId (e.g. PTXN-ABC123)">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <FieldLabel note="Exact txnId, case sensitive. Partners can read this off their own transaction history." required>Transaction ID</FieldLabel>
            <input className="input-field" placeholder="PTXN-XXXXXXXXXXXX" value={txnIdLookup} onChange={(e) => setTxnIdLookup(e.target.value)} />
          </div>
          <ActionButton icon={Search} loading={loadingTxn} disabled={!txnIdLookup.trim()} onClick={() => dispatch(fetchTransactionByTxnId(txnIdLookup.trim()))}>
            Look Up
          </ActionButton>
        </div>
        {selectedTxn && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto">{JSON.stringify(selectedTxn, null, 2)}</pre>}
      </SectionCard>

      <button onClick={() => setShowSelf((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelf ? 'Hide' : 'Show'} self-service endpoint (completeness)
      </button>
      <AnimatePresence>
        {showSelf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="fetchMyTransactions (self)" icon={History} subtitle="Partner-only — included for completeness">
              <CompletenessNote>Returns the ledger for the currently authenticated account. Admins typically have none.</CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingMine} onClick={() => dispatch(fetchMyTransactions({}))}>Fetch My Transactions</ActionButton>
              {myTransactions.length > 0 && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(myTransactions, null, 2)}</pre>}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §5 TAB: SETTLEMENTS
// ═══════════════════════════════════════════════════════════════════════════

function SettlementsTab() {
  const dispatch = useDispatch();

  const [processBookingId, setProcessBookingId] = useState('');
  const [statusBookingId, setStatusBookingId] = useState('');
  const [filters, setFilters] = useState({ partnerId: '', bookingId: '', partnerRole: '', status: '', fromDate: '', toDate: '' });
  const [reverseTarget, setReverseTarget] = useState(null);
  const [showSelf, setShowSelf] = useState(false);

  const lastProcessResult = useSelector(selectLastSettlementResult);
  const settlementStatus = useSelector(selectSettlementStatus(statusBookingId));
  const list = useSelector(selectSettlementsList);
  const pagination = useSelector(selectSettlementsListPagination);
  const selected = useSelector(selectSelectedSettlement);
  const mine = useSelector(selectMySettlements);

  const loadingProcess = useSelector(selectIsLoading('settlement/process'));
  const loadingStatus = useSelector(selectIsLoading('settlement/fetchStatus'));
  const loadingList = useSelector(selectIsLoading('settlements/fetchList'));
  const loadingDetail = useSelector(selectIsLoading('settlements/fetchOne'));
  const loadingReverse = useSelector(selectIsLoading('settlements/reverse'));
  const loadingMine = useSelector(selectIsLoading('settlements/fetchMine'));
  const error = useSelector(selectError('settlements/fetchList'));

  const search = useCallback((page = 1) => {
    const params = { page, limit: 20 };
    if (filters.partnerId) params.partnerId = filters.partnerId;
    if (filters.bookingId) params.bookingId = filters.bookingId;
    if (filters.partnerRole) params.partnerRole = filters.partnerRole;
    if (filters.status) params.status = filters.status;
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    dispatch(fetchSettlementsList(params));
  }, [dispatch, filters]);

  useEffect(() => { search(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">Process bookings into payouts, look up status, and reverse settled payments on refund.</p>
        <HelpButton label="How does settlement + reversal work?" topicId="settlements" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Process Booking Settlement" icon={PlayCircle} subtitle="Idempotent — safe to retry. Only works once booking.status === 'completed'.">
          <FieldLabel note="Required. The booking must already be marked completed. Re-running a settled booking is a safe no-op." required>Booking ID</FieldLabel>
          <div className="flex gap-2">
            <input className="input-field" placeholder="Booking ObjectId" value={processBookingId} onChange={(e) => setProcessBookingId(e.target.value)} />
            <ActionButton loading={loadingProcess} disabled={!processBookingId.trim()} onClick={() => dispatch(processBookingSettlement(processBookingId.trim()))}>
              Process
            </ActionButton>
          </div>
          {lastProcessResult && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto">{JSON.stringify(lastProcessResult, null, 2)}</pre>}
        </SectionCard>

        <SectionCard title="Settlement Status Lookup" icon={Search} subtitle="Shows booking + every per-partner allocation + settlement record">
          <FieldLabel note="Required. Same booking id used above — works for any booking, settled or not." required>Booking ID</FieldLabel>
          <div className="flex gap-2">
            <input className="input-field" placeholder="Booking ObjectId" value={statusBookingId} onChange={(e) => setStatusBookingId(e.target.value)} />
            <ActionButton loading={loadingStatus} disabled={!statusBookingId.trim()} onClick={() => dispatch(fetchSettlementStatus(statusBookingId.trim()))}>
              Look Up
            </ActionButton>
          </div>
          {settlementStatus && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto max-h-64">{JSON.stringify(settlementStatus, null, 2)}</pre>}
        </SectionCard>
      </div>

      <SectionCard title="All Settlements" icon={Receipt} subtitle="Every per-partner settlement record across the platform">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><FieldLabel note="Optional. Filter to one partner's User._id.">Partner ID</FieldLabel><input className="input-field" value={filters.partnerId} onChange={(e) => setFilters((f) => ({ ...f, partnerId: e.target.value }))} /></div>
          <div><FieldLabel note="Optional. Filter to one booking's ObjectId.">Booking ID</FieldLabel><input className="input-field" value={filters.bookingId} onChange={(e) => setFilters((f) => ({ ...f, bookingId: e.target.value }))} /></div>
          <div>
            <FieldLabel note="Optional. Restrict to one partner type.">Partner Role</FieldLabel>
            <select className="input-field" value={filters.partnerRole} onChange={(e) => setFilters((f) => ({ ...f, partnerRole: e.target.value }))}>
              <option value="">All roles</option>
              {PARTNER_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel note="Optional. PENDING = not yet credited. SETTLED = paid out. REVERSED = refunded back.">Status</FieldLabel>
            <select className="input-field" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {SETTLEMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><FieldLabel note="Inclusive start date.">From</FieldLabel><input type="date" className="input-field" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} /></div>
          <div><FieldLabel note="Inclusive end date.">To</FieldLabel><input type="date" className="input-field" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} /></div>
        </div>
        <ActionButton icon={Filter} className="mt-4" loading={loadingList} onClick={() => search(1)}>Apply Filters</ActionButton>
        <ErrorNote message={error} />

        <div className="overflow-x-auto mt-5">
          <table className="table">
            <thead><tr><th>Settlement</th><th>Partner</th><th>Gross</th><th>Net</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loadingList ? <SkeletonRows colSpan={6} /> : list.length === 0 ? (
                <EmptyRow colSpan={6}>No settlements match these filters.</EmptyRow>
              ) : (
                list.map((s) => (
                  <tr key={s._id}>
                    <td className="font-mono text-xs">{s.settlementId}</td>
                    <td>{nameOf(s.partnerId)} <span className="text-base-content/50">({s.partnerRole})</span></td>
                    <td>{formatINR(s.grossAmount)}</td>
                    <td className="font-semibold">{formatINR(s.netSettlement)}</td>
                    <td><StatusBadge status={s.settlementStatus} map={SETTLEMENT_BADGE} /></td>
                    <td className="flex gap-1.5 justify-end">
                      <IconButton icon={Eye} title="View" loading={loadingDetail} onClick={() => dispatch(fetchSettlementById(s.settlementId))} />
                      {s.settlementStatus === 'SETTLED' && (
                        <IconButton icon={RotateCcw} variant="error" title="Reverse" loading={loadingReverse} onClick={() => setReverseTarget(s.settlementId)} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={pagination} disabled={loadingList} onPageChange={search} />
      </SectionCard>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <SectionCard title={`Settlement Detail — ${selected.settlementId}`} icon={Receipt}>
              <pre className="bg-base-200 rounded-field p-3 text-xs overflow-x-auto max-h-72">{JSON.stringify(selected, null, 2)}</pre>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => setShowSelf((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelf ? 'Hide' : 'Show'} self-service endpoint (completeness)
      </button>
      <AnimatePresence>
        {showSelf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="fetchMySettlements (self)" icon={Receipt} subtitle="Partner-only — included for completeness">
              <CompletenessNote>Returns the authenticated account's own settlement history.</CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingMine} onClick={() => dispatch(fetchMySettlements({}))}>Fetch My Settlements</ActionButton>
              {mine.length > 0 && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(mine, null, 2)}</pre>}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ReasonModal
        open={!!reverseTarget}
        title="Reverse Settlement"
        note="Required. Recorded against the BOOKING_REVERSAL ledger entry — clamped to the partner's available balance so it can never go negative."
        confirmLabel="Reverse Settlement"
        loading={loadingReverse}
        onClose={() => setReverseTarget(null)}
        onConfirm={(reason) => { dispatch(reverseSettlement({ settlementId: reverseTarget, reason })); setReverseTarget(null); }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §6 TAB: ALLOCATIONS
// ═══════════════════════════════════════════════════════════════════════════

function AllocationsTab() {
  const dispatch = useDispatch();
  const [bookingId, setBookingId] = useState('');
  const [showSelf, setShowSelf] = useState(false);

  const allocations = useSelector(selectBookingAllocations(bookingId));
  const mine = useSelector(selectMyAllocations);

  const loading = useSelector(selectIsLoading('allocations/fetchForBooking'));
  const loadingMine = useSelector(selectIsLoading('allocations/fetchMine'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">See exactly how one booking's payment was split across every partner.</p>
        <HelpButton label="What is an allocation?" topicId="allocations" />
      </div>

      <SectionCard title="Booking Partner Allocations" icon={ClipboardList} subtitle="One row per partner on a multi-partner booking (full_care_ride, etc)">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <FieldLabel note="Required. Returns every partner's allocation row for this booking, side by side." required>Booking ID</FieldLabel>
            <input className="input-field" placeholder="Booking ObjectId" value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
          </div>
          <ActionButton icon={Search} loading={loading} disabled={!bookingId.trim()} onClick={() => dispatch(fetchBookingAllocations(bookingId.trim()))}>
            Look Up
          </ActionButton>
        </div>

        <div className="overflow-x-auto mt-5">
          <table className="table">
            <thead><tr><th>Partner</th><th>Role</th><th>Gross</th><th>Recovery</th><th>Net Payable</th><th>Status</th><th>Cash Collector?</th></tr></thead>
            <tbody>
              {loading ? <SkeletonRows colSpan={7} /> : allocations.length === 0 ? (
                <EmptyRow colSpan={7}>{bookingId ? 'No allocations found for this booking.' : 'Enter a Booking ID and look it up.'}</EmptyRow>
              ) : (
                allocations.map((a) => (
                  <tr key={a._id}>
                    <td>{nameOf(a.partnerId)}</td>
                    <td><span className="badge badge-secondary badge-sm">{a.partnerRole}</span></td>
                    <td>{formatINR(a.grossAmount)}</td>
                    <td className={a.recoveryDeduction > 0 ? 'text-error font-semibold' : ''}>{formatINR(a.recoveryDeduction)}</td>
                    <td className="font-semibold">{formatINR(a.netPayable)}</td>
                    <td><span className="badge badge-sm badge-secondary">{a.status}</span></td>
                    <td>{a.isCashCollector ? <span className="badge badge-sm badge-warning">Yes &middot; {formatINR(a.cashCollected)}</span> : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <button onClick={() => setShowSelf((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelf ? 'Hide' : 'Show'} self-service endpoint (completeness)
      </button>
      <AnimatePresence>
        {showSelf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="fetchMyAllocations (self)" icon={ClipboardList} subtitle="Partner-only — included for completeness">
              <CompletenessNote>Returns the authenticated account's own allocation history.</CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingMine} onClick={() => dispatch(fetchMyAllocations({}))}>Fetch My Allocations</ActionButton>
              {mine.length > 0 && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(mine, null, 2)}</pre>}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §7 TAB: WITHDRAWALS
// ═══════════════════════════════════════════════════════════════════════════

function WithdrawalsTab() {
  const dispatch = useDispatch();
  const [filters, setFilters] = useState({ partnerId: '', status: '', fromDate: '', toDate: '' });
  const [withdrawalIdLookup, setWithdrawalIdLookup] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [showSelf, setShowSelf] = useState(false);
  const [selfForm, setSelfForm] = useState({ amount: '', bankId: '' });

  const list = useSelector(selectWithdrawalsList);
  const pagination = useSelector(selectWithdrawalsListPagination);
  const selected = useSelector(selectSelectedWithdrawal);
  const mine = useSelector(selectMyWithdrawals);
  const myBankDetails = useSelector(selectMyBankDetails);

  const loadingList = useSelector(selectIsLoading('withdrawals/fetchList'));
  const loadingOne = useSelector(selectIsLoading('withdrawals/fetchOne'));
  const loadingApprove = useSelector(selectIsLoading('withdrawals/approve'));
  const loadingReject = useSelector(selectIsLoading('withdrawals/reject'));
  const loadingRetry = useSelector(selectIsLoading('withdrawals/retry'));
  const loadingMine = useSelector(selectIsLoading('withdrawals/fetchMine'));
  const loadingRequest = useSelector(selectIsLoading('withdrawals/request'));
  const error = useSelector(selectError('withdrawals/fetchList'));

  const search = useCallback((page = 1) => {
    const params = { page, limit: 20 };
    if (filters.partnerId) params.partnerId = filters.partnerId;
    if (filters.status) params.status = filters.status;
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    dispatch(fetchWithdrawalsList(params));
  }, [dispatch, filters]);

  useEffect(() => { search(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">RazorpayX payout lifecycle — review, approve, reject, or retry partner withdrawal requests.</p>
        <HelpButton label="How does the withdrawal lifecycle work?" topicId="withdrawals" />
      </div>

      <SectionCard title="Partner Withdrawals" icon={ArrowUpFromLine} subtitle="RazorpayX payout lifecycle — REQUESTED → APPROVED → queued → processed">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><FieldLabel note="Optional. Filter to one partner's User._id.">Partner ID</FieldLabel><input className="input-field" value={filters.partnerId} onChange={(e) => setFilters((f) => ({ ...f, partnerId: e.target.value }))} /></div>
          <div>
            <FieldLabel note="Optional. REQUESTED needs your decision; failed can be retried.">Status</FieldLabel>
            <select className="input-field" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {WITHDRAWAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><FieldLabel note="Inclusive start date.">From</FieldLabel><input type="date" className="input-field" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} /></div>
          <div><FieldLabel note="Inclusive end date.">To</FieldLabel><input type="date" className="input-field" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} /></div>
        </div>
        <ActionButton icon={Filter} className="mt-4" loading={loadingList} onClick={() => search(1)}>Apply Filters</ActionButton>
        <ErrorNote message={error} />

        <div className="overflow-x-auto mt-5">
          <table className="table">
            <thead><tr><th>Withdrawal</th><th>Partner</th><th>Amount</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead>
            <tbody>
              {loadingList ? <SkeletonRows colSpan={6} /> : list.length === 0 ? (
                <EmptyRow colSpan={6}>No withdrawals match these filters.</EmptyRow>
              ) : (
                list.map((w) => (
                  <tr key={w._id}>
                    <td className="font-mono text-xs">{w.withdrawalId}</td>
                    <td>{nameOf(w.partnerId)}</td>
                    <td className="font-semibold">{formatINR(w.amount)}</td>
                    <td><StatusBadge status={w.status} map={WITHDRAWAL_BADGE} /></td>
                    <td className="text-xs">{formatDate(w.requestedAt)}</td>
                    <td className="flex gap-1.5 justify-end">
                      <IconButton icon={Eye} title="View" loading={loadingOne} onClick={() => dispatch(fetchWithdrawalById(w.withdrawalId))} />
                      {w.status === 'REQUESTED' && (
                        <>
                          <IconButton icon={CheckCircle2} variant="success" title="Approve" loading={loadingApprove} onClick={() => dispatch(approveWithdrawal(w.withdrawalId))} />
                          <IconButton icon={XCircle} variant="error" title="Reject" loading={loadingReject} onClick={() => setRejectTarget(w.withdrawalId)} />
                        </>
                      )}
                      {w.status === 'failed' && (
                        <IconButton icon={RotateCcw} title="Retry payout" loading={loadingRetry} onClick={() => dispatch(retryWithdrawal(w.withdrawalId))} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={pagination} disabled={loadingList} onPageChange={search} />
      </SectionCard>

      <SectionCard title="Look Up a Withdrawal" icon={Search}>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <FieldLabel note="Human-readable withdrawalId, e.g. WD-ABCDEFGHIJ." required>Withdrawal ID</FieldLabel>
            <input className="input-field" value={withdrawalIdLookup} onChange={(e) => setWithdrawalIdLookup(e.target.value)} />
          </div>
          <ActionButton icon={Search} loading={loadingOne} disabled={!withdrawalIdLookup.trim()} onClick={() => dispatch(fetchWithdrawalById(withdrawalIdLookup.trim()))}>
            Look Up
          </ActionButton>
        </div>
        {selected && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto max-h-64">{JSON.stringify(selected, null, 2)}</pre>}
      </SectionCard>

      <button onClick={() => setShowSelf((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelf ? 'Hide' : 'Show'} self-service endpoints (completeness)
      </button>
      <AnimatePresence>
        {showSelf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="fetchMyWithdrawals / requestWithdrawal (self)" icon={ArrowUpFromLine} subtitle="Partner-only — included for completeness">
              <CompletenessNote>
                Withdrawal requests are normally partner-initiated against the partner's own wallet. The compliance gate
                requires kycVerified + bankVerified + an active wallet, which an admin account won't have.
              </CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingMine} onClick={() => dispatch(fetchMyWithdrawals({}))}>Fetch My Withdrawals</ActionButton>
              {mine.length > 0 && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(mine, null, 2)}</pre>}

              <div className="divider" />
              <p className="label-text mb-3">Submit a test withdrawal request — payload is now {'{ amount, bankId? }'}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel note="Required. Amount to withdraw, in rupees." required>Amount</FieldLabel>
                  <input type="number" className="input-field" value={selfForm.amount} onChange={(e) => setSelfForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel note="Optional. The bank sub-document _id to pay out to. Leave blank to use the wallet's primary bank account automatically.">Bank ID (optional)</FieldLabel>
                  <select className="input-field" value={selfForm.bankId} onChange={(e) => setSelfForm((f) => ({ ...f, bankId: e.target.value }))}>
                    <option value="">Use primary bank account</option>
                    {myBankDetails.map((b) => (
                      <option key={b._id} value={b._id}>{b.accountHolderName} — ••••{b.accountNumberLast4}{b.isPrimary ? ' (primary)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ActionButton
                className="mt-4"
                loading={loadingRequest}
                disabled={!selfForm.amount}
                onClick={() => dispatch(requestWithdrawal({
                  amount: Number(selfForm.amount),
                  bankId: selfForm.bankId || undefined,
                }))}
              >
                Submit Withdrawal Request
              </ActionButton>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ReasonModal
        open={!!rejectTarget}
        title="Reject Withdrawal"
        note="Required. The locked amount is restored to the partner's available balance immediately."
        confirmLabel="Reject Withdrawal"
        loading={loadingReject}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => { dispatch(rejectWithdrawal({ withdrawalId: rejectTarget, reason })); setRejectTarget(null); }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §8 TAB: LIABILITIES
// ═══════════════════════════════════════════════════════════════════════════

function LiabilitiesTab() {
  const dispatch = useDispatch();
  const [filters, setFilters] = useState({ partnerId: '', status: '', bookingId: '' });
  const [liabilityIdLookup, setLiabilityIdLookup] = useState('');
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [showSelf, setShowSelf] = useState(false);

  const list = useSelector(selectLiabilitiesList);
  const summary = useSelector(selectLiabilitiesListSummary);
  const selected = useSelector(selectSelectedLiability);
  const mine = useSelector(selectMyLiabilities);

  const loadingList = useSelector(selectIsLoading('liabilities/fetchList'));
  const loadingOne = useSelector(selectIsLoading('liabilities/fetchOne'));
  const loadingWaive = useSelector(selectIsLoading('liabilities/waive'));
  const loadingMine = useSelector(selectIsLoading('liabilities/fetchMine'));
  const error = useSelector(selectError('liabilities/fetchList'));

  const search = useCallback((page = 1) => {
    const params = { page, limit: 20 };
    if (filters.partnerId) params.partnerId = filters.partnerId;
    if (filters.status) params.status = filters.status;
    if (filters.bookingId) params.bookingId = filters.bookingId;
    dispatch(fetchLiabilitiesList(params));
  }, [dispatch, filters]);

  useEffect(() => { search(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">Cash a partner collected on behalf of others (PAY_AT_SERVICE) that still needs recovering.</p>
        <HelpButton label="What is a cash-collection liability?" topicId="liabilities" />
      </div>

      <SectionCard title="Cash Collection Liabilities" icon={ShieldAlert} subtitle="Created when a PAY_AT_SERVICE collector receives more cash than their own entitlement">
        {summary?.totalOutstanding !== undefined && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="stat-card"><p className="stat-card-label">Total Liability</p><p className="stat-card-value">{formatINR(summary.totalLiability)}</p></div>
            <div className="stat-card"><p className="stat-card-label">Recovered</p><p className="stat-card-value text-success">{formatINR(summary.totalRecovered)}</p></div>
            <div className="stat-card"><p className="stat-card-label">Outstanding</p><p className="stat-card-value text-error">{formatINR(summary.totalOutstanding)}</p></div>
            <div className="stat-card"><p className="stat-card-label">Open + Partial</p><p className="stat-card-value">{(summary.openCount ?? 0) + (summary.partialCount ?? 0)}</p></div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><FieldLabel note="Optional. Filter to one partner's User._id.">Partner ID</FieldLabel><input className="input-field" value={filters.partnerId} onChange={(e) => setFilters((f) => ({ ...f, partnerId: e.target.value }))} /></div>
          <div>
            <FieldLabel note="Optional. OPEN = nothing recovered yet. PARTIALLY_RECOVERED = some paid back.">Status</FieldLabel>
            <select className="input-field" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {LIABILITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><FieldLabel note="Optional. Filter to the booking that created the liability.">Booking ID</FieldLabel><input className="input-field" value={filters.bookingId} onChange={(e) => setFilters((f) => ({ ...f, bookingId: e.target.value }))} /></div>
        </div>
        <ActionButton icon={Filter} className="mt-4" loading={loadingList} onClick={() => search(1)}>Apply Filters</ActionButton>
        <ErrorNote message={error} />

        <div className="overflow-x-auto mt-5">
          <table className="table">
            <thead><tr><th>Partner</th><th>Collected</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loadingList ? <SkeletonRows colSpan={5} /> : list.length === 0 ? (
                <EmptyRow colSpan={5}>No liabilities match these filters.</EmptyRow>
              ) : (
                list.map((l) => (
                  <tr key={l._id}>
                    <td>{nameOf(l.partner)} <span className="text-base-content/50">({l.partnerRole})</span></td>
                    <td>{formatINR(l.amountCollected)}</td>
                    <td className={l.outstandingLiability > 0 ? 'text-error font-semibold' : ''}>{formatINR(l.outstandingLiability)}</td>
                    <td><StatusBadge status={l.status} map={LIABILITY_BADGE} /></td>
                    <td className="flex gap-1.5 justify-end">
                      <IconButton icon={Eye} title="View" loading={loadingOne} onClick={() => dispatch(fetchLiabilityById(l._id))} />
                      {['OPEN', 'PARTIALLY_RECOVERED'].includes(l.status) && (
                        <IconButton icon={Gavel} variant="warning" title="Waive remaining" loading={loadingWaive} onClick={() => setWaiveTarget(l._id)} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Look Up a Liability" icon={Search}>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <FieldLabel note="Mongo ObjectId of the PartnerCollectionLiability document." required>Liability ID</FieldLabel>
            <input className="input-field" value={liabilityIdLookup} onChange={(e) => setLiabilityIdLookup(e.target.value)} />
          </div>
          <ActionButton icon={Search} loading={loadingOne} disabled={!liabilityIdLookup.trim()} onClick={() => dispatch(fetchLiabilityById(liabilityIdLookup.trim()))}>
            Look Up
          </ActionButton>
        </div>
        {selected && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto max-h-64">{JSON.stringify(selected, null, 2)}</pre>}
      </SectionCard>

      <button onClick={() => setShowSelf((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelf ? 'Hide' : 'Show'} self-service endpoint (completeness)
      </button>
      <AnimatePresence>
        {showSelf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="fetchMyLiabilities (self)" icon={ShieldAlert} subtitle="Partner-only — included for completeness">
              <CompletenessNote>Returns the authenticated account's own liabilities, plus an outstandingTotal.</CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingMine} onClick={() => dispatch(fetchMyLiabilities({}))}>Fetch My Liabilities</ActionButton>
              {mine.length > 0 && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto">{JSON.stringify(mine, null, 2)}</pre>}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ReasonModal
        open={!!waiveTarget}
        title="Waive Liability"
        note="Required. Clears the remaining outstanding balance and writes an audit ADJUSTMENT entry. This is irreversible."
        confirmLabel="Waive Liability"
        variant="warning"
        loading={loadingWaive}
        onClose={() => setWaiveTarget(null)}
        onConfirm={(reason) => { dispatch(waiveLiability({ liabilityId: waiveTarget, reason })); setWaiveTarget(null); }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §9 TAB: RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════

function ReconciliationTab() {
  const dispatch = useDispatch();
  const [walletId, setWalletId] = useState('');
  const [revRange, setRevRange] = useState({ fromDate: '', toDate: '' });

  const lastRun = useSelector(selectLastReconciliationRun);
  const walletResult = useSelector(selectWalletReconciliation(walletId));
  const platformRevenue = useSelector(selectPlatformRevenueReconciliation);

  const loadingRun = useSelector(selectIsLoading('reconciliation/run'));
  const loadingWallet = useSelector(selectIsLoading('reconciliation/wallet'));
  const loadingPlatform = useSelector(selectIsLoading('reconciliation/platformRevenue'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">Verify the cached wallet balance still matches the underlying ledger.</p>
        <HelpButton label="What does reconciliation check?" topicId="reconciliation" />
      </div>

      <SectionCard title="Run Full Reconciliation" icon={Scale} subtitle="Checks every non-closed wallet's ledger sum against its cached balance">
        <FieldLabel note="No inputs needed — runs against every active wallet platform-wide.">Run check now</FieldLabel>
        <ActionButton icon={RefreshCw} loading={loadingRun} onClick={() => dispatch(runReconciliation())}>Run Reconciliation</ActionButton>
        {lastRun && (
          <div className="mt-5">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="stat-card"><p className="stat-card-label">Checked</p><p className="stat-card-value">{lastRun.checked}</p></div>
              <div className="stat-card"><p className="stat-card-label">Matched</p><p className="stat-card-value text-success">{lastRun.matched}</p></div>
              <div className="stat-card"><p className="stat-card-label">Mismatches</p><p className="stat-card-value text-error">{lastRun.mismatches}</p></div>
            </div>
            {lastRun.alerts?.length > 0 && (
              <table className="table">
                <thead><tr><th>Partner</th><th>Wallet Balance</th><th>Ledger Balance</th><th>Delta</th></tr></thead>
                <tbody>
                  {lastRun.alerts.map((a) => (
                    <tr key={a.walletId}>
                      <td>{idOf(a.partnerId)}</td>
                      <td>{formatINR(a.walletBalance)}</td>
                      <td>{formatINR(a.ledgerBalance)}</td>
                      <td className="text-error font-semibold">{formatINR(a.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Reconcile a Single Wallet" icon={Wallet} subtitle="Useful when investigating a specific partner's balance dispute">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <FieldLabel note="Mongo ObjectId of the PartnerWallet document itself (not the User id). Find it on the Wallets tab detail view." required>Wallet ID</FieldLabel>
            <input className="input-field" value={walletId} onChange={(e) => setWalletId(e.target.value)} />
          </div>
          <ActionButton icon={RefreshCw} loading={loadingWallet} disabled={!walletId.trim()} onClick={() => dispatch(reconcileWallet(walletId.trim()))}>
            Reconcile
          </ActionButton>
        </div>
        {walletResult && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto max-h-64">{JSON.stringify(walletResult, null, 2)}</pre>}
      </SectionCard>

      <SectionCard title="Platform Revenue Reconciliation" icon={IndianRupee} subtitle="Cross-checks platform fee revenue across all SETTLED settlements">
        <div className="grid grid-cols-2 gap-4">
          <div><FieldLabel note="Optional inclusive start. Leave both blank for all-time.">From</FieldLabel><input type="date" className="input-field" value={revRange.fromDate} onChange={(e) => setRevRange((r) => ({ ...r, fromDate: e.target.value }))} /></div>
          <div><FieldLabel note="Optional inclusive end.">To</FieldLabel><input type="date" className="input-field" value={revRange.toDate} onChange={(e) => setRevRange((r) => ({ ...r, toDate: e.target.value }))} /></div>
        </div>
        <ActionButton icon={Search} className="mt-4" loading={loadingPlatform} onClick={() => dispatch(fetchPlatformRevenueReconciliation(revRange))}>
          Fetch
        </ActionButton>
        {platformRevenue && (
          <table className="table mt-5">
            <thead><tr><th>Role</th><th>Gross</th><th>Platform Fee</th><th>Net</th><th>Subsc. Absorbed</th></tr></thead>
            <tbody>
              {(platformRevenue.byRole ?? []).map((row) => (
                <tr key={row._id}>
                  <td><span className="badge badge-secondary badge-sm">{row._id}</span></td>
                  <td>{formatINR(row.totalGross)}</td>
                  <td>{formatINR(row.totalPlatformFee)}</td>
                  <td>{formatINR(row.totalNet)}</td>
                  <td>{formatINR(row.totalSubscAbsorb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §10 TAB: FINANCE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

function FinanceControlsTab({ isSuperAdmin }) {
  const dispatch = useDispatch();
  const [creditForm, setCreditForm] = useState({ partnerId: '', amount: '', reason: '', referenceId: '' });
  const [debitForm, setDebitForm] = useState({ partnerId: '', amount: '', reason: '', referenceId: '' });
  const [forceSettleBookingId, setForceSettleBookingId] = useState('');

  const lastCredit = useSelector(selectLastManualCredit);
  const lastDebit = useSelector(selectLastManualDebit);
  const lastForceSettle = useSelector(selectLastForceSettle);

  const loadingCredit = useSelector(selectIsLoading('finance/manualCredit'));
  const loadingDebit = useSelector(selectIsLoading('finance/manualDebit'));
  const loadingForceSettle = useSelector(selectIsLoading('finance/forceSettle'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">Direct, irreversible ledger writes. Every action below is audit-logged and visible to the partner.</p>
        <HelpButton label="When should I use manual credit/debit?" topicId="finance" />
      </div>

      <div className="alert alert-warning">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="text-xs">Every action below writes an immutable ledger entry and is visible in the partner's transaction history. Use sparingly and always provide a clear reason.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Manual Credit" icon={PlusCircle} subtitle="Adds money to a partner's available balance">
          <div className="space-y-4">
            <div><FieldLabel note="Required. Mongo ObjectId of the partner User." required>Partner ID</FieldLabel><input className="input-field" value={creditForm.partnerId} onChange={(e) => setCreditForm((f) => ({ ...f, partnerId: e.target.value }))} /></div>
            <div><FieldLabel note="Required. Must be a positive number, in rupees." required>Amount</FieldLabel><input type="number" className="input-field" value={creditForm.amount} onChange={(e) => setCreditForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            <div><FieldLabel note="Required. Recorded verbatim on the MANUAL_CREDIT ledger entry for audit — be specific." required>Reason</FieldLabel><textarea rows={2} className="input-field resize-none" value={creditForm.reason} onChange={(e) => setCreditForm((f) => ({ ...f, reason: e.target.value }))} /></div>
            <div><FieldLabel note="Optional. Any external reference (support ticket ID, refund ID, etc).">Reference ID</FieldLabel><input className="input-field" value={creditForm.referenceId} onChange={(e) => setCreditForm((f) => ({ ...f, referenceId: e.target.value }))} /></div>
          </div>
          <ActionButton
            className="mt-4"
            icon={PlusCircle}
            loading={loadingCredit}
            disabled={!creditForm.partnerId || !creditForm.amount || !creditForm.reason.trim()}
            onClick={() => dispatch(manualCredit({ ...creditForm, amount: Number(creditForm.amount), referenceId: creditForm.referenceId || undefined }))}
          >
            Apply Manual Credit
          </ActionButton>
          {lastCredit && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto">{JSON.stringify(lastCredit, null, 2)}</pre>}
        </SectionCard>

        <SectionCard title="Manual Debit" icon={MinusCircle} subtitle="Removes money from a partner's available balance">
          <div className="space-y-4">
            <div><FieldLabel note="Required. Mongo ObjectId of the partner User." required>Partner ID</FieldLabel><input className="input-field" value={debitForm.partnerId} onChange={(e) => setDebitForm((f) => ({ ...f, partnerId: e.target.value }))} /></div>
            <div><FieldLabel note="Required. Cannot exceed the partner's current available balance — the backend rejects it otherwise." required>Amount</FieldLabel><input type="number" className="input-field" value={debitForm.amount} onChange={(e) => setDebitForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            <div><FieldLabel note="Required. Recorded verbatim on the MANUAL_DEBIT ledger entry for audit." required>Reason</FieldLabel><textarea rows={2} className="input-field resize-none" value={debitForm.reason} onChange={(e) => setDebitForm((f) => ({ ...f, reason: e.target.value }))} /></div>
            <div><FieldLabel note="Optional. Any external reference.">Reference ID</FieldLabel><input className="input-field" value={debitForm.referenceId} onChange={(e) => setDebitForm((f) => ({ ...f, referenceId: e.target.value }))} /></div>
          </div>
          <ActionButton
            className="mt-4"
            variant="error"
            icon={MinusCircle}
            loading={loadingDebit}
            disabled={!debitForm.partnerId || !debitForm.amount || !debitForm.reason.trim()}
            onClick={() => dispatch(manualDebit({ ...debitForm, amount: Number(debitForm.amount), referenceId: debitForm.referenceId || undefined }))}
          >
            Apply Manual Debit
          </ActionButton>
          {lastDebit && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto">{JSON.stringify(lastDebit, null, 2)}</pre>}
        </SectionCard>
      </div>

      <SectionCard
        title="Force-Settle Booking"
        icon={Gavel}
        subtitle={isSuperAdmin ? 'Resets the settlement flag and re-runs settlement — use only to recover a stuck booking' : 'Superadmin only'}
      >
        {!isSuperAdmin && (
          <div className="alert alert-warning mb-4">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-xs">This action is restricted to the superadmin role on the backend. The button below is disabled for your role.</p>
          </div>
        )}
        <FieldLabel note="Required. Booking must already be marked completed. This clears settlementProcessed and re-runs the full settlement pipeline." required>
          Booking ID
        </FieldLabel>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <input className="input-field" value={forceSettleBookingId} onChange={(e) => setForceSettleBookingId(e.target.value)} disabled={!isSuperAdmin} />
          </div>
          <ActionButton
            variant="warning"
            icon={Gavel}
            loading={loadingForceSettle}
            disabled={!isSuperAdmin || !forceSettleBookingId.trim()}
            onClick={() => dispatch(forceSettleBooking(forceSettleBookingId.trim()))}
          >
            Force Settle
          </ActionButton>
        </div>
        {lastForceSettle && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto">{JSON.stringify(lastForceSettle, null, 2)}</pre>}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 TAB: REPORTS
// ═══════════════════════════════════════════════════════════════════════════

function ReportsTab() {
  const dispatch = useDispatch();
  const [earningsForm, setEarningsForm] = useState({ partnerId: '', fromDate: '', toDate: '', groupBy: 'month' });
  const [revenueRange, setRevenueRange] = useState({ fromDate: '', toDate: '' });
  const [settlementRange, setSettlementRange] = useState({ fromDate: '', toDate: '' });
  const [showSelf, setShowSelf] = useState(false);

  const partnerEarnings = useSelector(selectPartnerEarnings(earningsForm.partnerId));
  const revenueSummary = useSelector(selectPlatformRevenueSummary);
  const settlementSummary = useSelector(selectSettlementSummary);
  const liabilitySummary = useSelector(selectLiabilitySummary);
  const partnerDashboard = useSelector(selectPartnerDashboard);

  const loadingEarnings = useSelector(selectIsLoading('reports/partnerEarnings'));
  const loadingRevenue = useSelector(selectIsLoading('reports/platformRevenueSummary'));
  const loadingSettlement = useSelector(selectIsLoading('reports/settlementSummary'));
  const loadingLiability = useSelector(selectIsLoading('reports/liabilitySummary'));
  const loadingDashboard = useSelector(selectIsLoading('reports/partnerDashboard'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="label-text-alt m-0">Per-partner and platform-wide dashboards for finance review.</p>
        <HelpButton label="What does each report show?" topicId="reports" />
      </div>

      <SectionCard title="Partner Earnings Report" icon={BarChart3} subtitle="Earning history + role breakdown for a single partner">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <FieldLabel note="Required. Mongo ObjectId of the partner User." required>Partner ID</FieldLabel>
            <input className="input-field" value={earningsForm.partnerId} onChange={(e) => setEarningsForm((f) => ({ ...f, partnerId: e.target.value }))} />
          </div>
          <div><FieldLabel note="Optional inclusive start. Leave blank for all-time.">From</FieldLabel><input type="date" className="input-field" value={earningsForm.fromDate} onChange={(e) => setEarningsForm((f) => ({ ...f, fromDate: e.target.value }))} /></div>
          <div><FieldLabel note="Optional inclusive end.">To</FieldLabel><input type="date" className="input-field" value={earningsForm.toDate} onChange={(e) => setEarningsForm((f) => ({ ...f, toDate: e.target.value }))} /></div>
          <div>
            <FieldLabel note="Buckets the time-series chart by day, week, or month.">Group By</FieldLabel>
            <select className="input-field" value={earningsForm.groupBy} onChange={(e) => setEarningsForm((f) => ({ ...f, groupBy: e.target.value }))}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <ActionButton
          icon={Search}
          className="mt-4"
          loading={loadingEarnings}
          disabled={!earningsForm.partnerId.trim()}
          onClick={() => dispatch(fetchPartnerEarnings({
            partnerId: earningsForm.partnerId.trim(),
            params: { fromDate: earningsForm.fromDate || undefined, toDate: earningsForm.toDate || undefined, groupBy: earningsForm.groupBy },
          }))}
        >
          Generate Report
        </ActionButton>
        {partnerEarnings && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto max-h-72">{JSON.stringify(partnerEarnings, null, 2)}</pre>}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Platform Revenue Summary" icon={IndianRupee}>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel note="Optional. Leave blank for all-time.">From</FieldLabel><input type="date" className="input-field" value={revenueRange.fromDate} onChange={(e) => setRevenueRange((r) => ({ ...r, fromDate: e.target.value }))} /></div>
            <div><FieldLabel note="Optional.">To</FieldLabel><input type="date" className="input-field" value={revenueRange.toDate} onChange={(e) => setRevenueRange((r) => ({ ...r, toDate: e.target.value }))} /></div>
          </div>
          <ActionButton icon={Search} className="mt-4" loading={loadingRevenue} onClick={() => dispatch(fetchPlatformRevenueSummary(revenueRange))}>Fetch</ActionButton>
          {revenueSummary && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto max-h-64">{JSON.stringify(revenueSummary, null, 2)}</pre>}
        </SectionCard>

        <SectionCard title="Settlement Summary" icon={Receipt}>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel note="Optional. Leave blank for all-time.">From</FieldLabel><input type="date" className="input-field" value={settlementRange.fromDate} onChange={(e) => setSettlementRange((r) => ({ ...r, fromDate: e.target.value }))} /></div>
            <div><FieldLabel note="Optional.">To</FieldLabel><input type="date" className="input-field" value={settlementRange.toDate} onChange={(e) => setSettlementRange((r) => ({ ...r, toDate: e.target.value }))} /></div>
          </div>
          <ActionButton icon={Search} className="mt-4" loading={loadingSettlement} onClick={() => dispatch(fetchSettlementSummary(settlementRange))}>Fetch</ActionButton>
          {settlementSummary && <pre className="bg-base-200 rounded-field p-3 text-xs mt-4 overflow-x-auto max-h-64">{JSON.stringify(settlementSummary, null, 2)}</pre>}
        </SectionCard>
      </div>

      <SectionCard title="Liability Summary" icon={ShieldAlert} subtitle="Includes top-10 outstanding offenders across the platform">
        <FieldLabel note="No inputs needed — covers all partners, all-time.">Run report</FieldLabel>
        <ActionButton icon={Search} loading={loadingLiability} onClick={() => dispatch(fetchLiabilitySummary())}>Fetch</ActionButton>
        {liabilitySummary?.topOffenders?.length > 0 && (
          <table className="table mt-5">
            <thead><tr><th>Partner</th><th>Role</th><th>Outstanding</th></tr></thead>
            <tbody>
              {liabilitySummary.topOffenders.map((o) => (
                <tr key={o._id}>
                  <td>{nameOf(o.partner)}</td>
                  <td><span className="badge badge-secondary badge-sm">{o.partnerRole}</span></td>
                  <td className="text-error font-semibold">{formatINR(o.outstandingLiability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <button onClick={() => setShowSelf((v) => !v)} className="text-sm text-primary font-semibold flex items-center gap-1.5">
        <Info className="w-4 h-4" /> {showSelf ? 'Hide' : 'Show'} self-service endpoint (completeness)
      </button>
      <AnimatePresence>
        {showSelf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="fetchPartnerDashboard (self)" icon={LayoutDashboard} subtitle="Partner-only — included for completeness">
              <CompletenessNote>Bundles wallet + recent transactions + pending settlements + liabilities + withdrawals for the authenticated partner.</CompletenessNote>
              <ActionButton size="sm" variant="outline" className="mt-3" loading={loadingDashboard} onClick={() => dispatch(fetchPartnerDashboard())}>Fetch My Dashboard</ActionButton>
              {partnerDashboard && <pre className="bg-base-200 rounded-field p-3 text-xs mt-3 overflow-x-auto max-h-64">{JSON.stringify(partnerDashboard, null, 2)}</pre>}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §12 LAYOUT — NAV + HEADER + PAGE
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, component: OverviewTab },
  { id: 'wallets', label: 'Wallets', icon: Wallet, component: WalletsTab },
  { id: 'transactions', label: 'Transactions', icon: History, component: TransactionsTab },
  { id: 'settlements', label: 'Settlements', icon: Receipt, component: SettlementsTab },
  { id: 'allocations', label: 'Allocations', icon: ClipboardList, component: AllocationsTab },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine, component: WithdrawalsTab },
  { id: 'liabilities', label: 'Liabilities', icon: ShieldAlert, component: LiabilitiesTab },
  { id: 'reconciliation', label: 'Reconciliation', icon: Scale, component: ReconciliationTab },
  { id: 'finance', label: 'Finance Controls', icon: Banknote, component: FinanceControlsTab },
  { id: 'reports', label: 'Reports', icon: BarChart3, component: ReportsTab },
];

function TabNav({ activeTab, onChange }) {
  return (
    <nav className="lg:w-64 shrink-0">
      <div className="card p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-field text-sm font-semibold whitespace-nowrap transition-colors
                ${active ? 'bg-primary/10 text-primary border border-primary/30' : 'text-base-content/70 hover:bg-base-200'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

function PageHeader({ role, onOpenHelp }) {
  return (
    <header className="border-b border-base-300 bg-base-100/80 backdrop-blur-soft sticky top-0 z-30">
      <div className="container-custom py-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="!text-2xl md:!text-3xl m-0">Accounting Management</h2>
          <p className="label-text-alt mt-1">Settlement, wallets, withdrawals, liabilities &amp; reconciliation — one console</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpenHelp} className="btn btn-outline btn-sm">
            <HelpCircle className="w-4 h-4" /> Help &amp; Full Guide
          </button>
          <span className="role-badge">
            <ShieldCheck className="w-3.5 h-3.5" /> {role}
          </span>
        </div>
      </div>
    </header>
  );
}

export default function AccountingManagementPage() {
  // ── Adjust this selector to match your actual auth slice shape ──────────
  const user = useSelector((state) => state.user?.user ?? null);
  const role = user?.role;
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;

  const [activeTab, setActiveTab] = useState('overview');
  const [helpOpen, setHelpOpen] = useState(false);

  if (!isAdmin) return <AccessDenied />;

  const ActiveTab = TABS.find((t) => t.id === activeTab)?.component ?? OverviewTab;

  return (
    <div data-theme={isSuperAdmin ? 'superadmin' : 'admin'} className="min-h-screen bg-base-100">
      <PageHeader role={role} onOpenHelp={() => setHelpOpen(true)} />
      <div className="container-custom py-6 flex flex-col lg:flex-row gap-6">
        <TabNav activeTab={activeTab} onChange={setActiveTab} />
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <ActiveTab isSuperAdmin={isSuperAdmin} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <HelpSection open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}