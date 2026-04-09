'use client';

/**
 * WalletPage — Likeson Healthcare
 *
 * Fully corrected to match:
 *   • walletRouter.js   — all routes, correct payloads
 *   • walletSlice.js    — all thunks, all selectors
 *   • globals.css       — CSS variables, .card, .glass-card, .btn-*, .badge-*, etc.
 *
 * Key fixes over previous version:
 *   1. completeWithdrawal — NO razorpayPayoutId input; server calls Razorpay X internally.
 *      Admin only supplies { requestId, walletId }.
 *   2. All new selectors imported: selectLockedBalance, selectNonWithdrawable,
 *      selectWithdrawalLimits, selectVerifiedBankAccounts, selectLookupReceiver,
 *      selectLookupIsSelf, selectTransfers, selectTransfersTotal,
 *      selectAdminWithdrawalsPage, selectAdminWithdrawalsLimit,
 *      selectWithdrawalsLimit, patchWalletBalance.
 *   3. WithdrawModal reads selectVerifiedBankAccounts directly.
 *   4. WithdrawablePanel renders withdrawableSources + note from server.
 *   5. AdminWithdrawalsPanel Approved row → single "Initiate Payout" button (no payout ID field).
 *   6. StatsRow uses selectNonWithdrawable for "Withdrawn" stat.
 *   7. All CSS uses variables / utility classes from globals.css.
 *   8. TransactionRow shows withdrawableBalanceBefore snapshot.
 */

import {
  useState, useCallback, useMemo, useRef, useEffect, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  motion, AnimatePresence, useMotionValue, useTransform, useSpring,
} from 'framer-motion';
import {
  Wallet, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw,
  ShieldCheck, Filter, ChevronDown, X, CheckCircle2,
  AlertCircle, Loader2, CreditCard, Banknote, History,
  Star, Clock, Zap, Send, QrCode, Eye, EyeOff, Copy,
  CheckCheck, Smartphone, BarChart3, Activity, ArrowRight,
  Building2, Trash2, Info, BanknoteIcon, LockKeyhole,
  RotateCcw, ListChecks, UserCog, TrendingUp,
} from 'lucide-react';

import {
  // Core
  fetchWalletDetails,
  fetchMyUpiId,
  fetchWithdrawableBalance,
  // Top-up
  initializeWalletTopup,
  verifyWalletTopup,
  // Lookup + P2P
  lookupTransferTarget,
  transferMoney,
  fetchTransferHistory,
  // Bank accounts
  fetchBankAccounts,
  addBankAccount,
  setPrimaryBankAccount,
  removeBankAccount,
  // Withdrawals (user)
  fetchWithdrawals,
  requestWithdrawal,
  cancelWithdrawal,
  // Admin withdrawals
  fetchAdminWithdrawals,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  failWithdrawal,
  // Admin bank verify
  adminVerifyBankAccount,
  // Actions
  clearWalletErrors,
  clearLookupResult,
  clearActiveWithdrawal,
  patchWalletBalance,
  // Selectors — core
  selectWalletData,
  selectWalletBalance,
  selectWalletLoading,
  selectWalletActionLoading,
  selectWalletError,
  selectWalletTransactions,
  selectMyUpiId,
  // Selectors — withdrawable
  selectWithdrawableInfo,
  selectWithdrawableBalance,
  selectWithdrawableAvailable,
  selectLockedBalance,
  selectNonWithdrawable,
  selectWithdrawalLimits,
  selectWithdrawableLoading,
  // Selectors — bank accounts
  selectBankAccounts,
  selectPrimaryBankAccount,
  selectVerifiedBankAccounts,
  selectBankAccountsLoading,
  selectBankAccountActing,
  // Selectors — withdrawals (user)
  selectWithdrawals,
  selectWithdrawalsTotal,
  selectWithdrawalsLimit,
  selectWithdrawalsLoading,
  selectWithdrawalActing,
  selectActiveWithdrawal,
  // Selectors — admin
  selectAdminWithdrawals,
  selectAdminWithdrawalsTotal,
  selectAdminWithdrawalsLoading,
  selectAdminWithdrawalsPage,
  selectAdminWithdrawalsLimit,
  // Selectors — P2P
  selectTransfers,
  selectTransfersTotal,
  selectTransferHistory,
  selectHistoryLoading,
  // Selectors — lookup
  selectLookupResult,
  selectLookupLoading,
  selectLookupIsSelf,
  selectLookupReceiver,
} from '@/store/slices/walletSlice';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SJTh9WQJSGGnIT';

const QUICK_AMOUNTS          = [100, 200, 500, 1000, 2000, 5000];
const QUICK_TRANSFER_AMOUNTS = [50, 100, 200, 500, 1000];
const QUICK_WITHDRAW_AMOUNTS = [500, 1000, 2000, 5000, 10000];
const PER_PAGE               = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Display metadata
// ─────────────────────────────────────────────────────────────────────────────

const PURPOSE_META = {
  Add_Money:           { label: 'Top Up',        color: 'text-emerald-500', bg: 'bg-emerald-500/10', Icon: Plus          },
  Booking_Payment:     { label: 'Booking',        color: 'text-sky-500',     bg: 'bg-sky-500/10',     Icon: CreditCard    },
  Medicine_Purchase:   { label: 'Pharmacy',       color: 'text-violet-500',  bg: 'bg-violet-500/10',  Icon: Banknote      },
  Refund:              { label: 'Refund',          color: 'text-cyan-500',    bg: 'bg-cyan-500/10',    Icon: ArrowDownLeft },
  Referral_Bonus:      { label: 'Referral',        color: 'text-amber-500',   bg: 'bg-amber-500/10',   Icon: Star          },
  Subscription_Fee:    { label: 'Subscription',   color: 'text-rose-500',    bg: 'bg-rose-500/10',    Icon: RefreshCw     },
  Coin_Conversion:     { label: 'Coins',           color: 'text-yellow-500',  bg: 'bg-yellow-500/10',  Icon: Star          },
  Admin_Credit:        { label: 'Admin Credit',   color: 'text-emerald-500', bg: 'bg-emerald-500/10', Icon: CheckCircle2  },
  Admin_Debit:         { label: 'Admin Debit',    color: 'text-rose-500',    bg: 'bg-rose-500/10',    Icon: AlertCircle   },
  Cashback:            { label: 'Cashback',        color: 'text-lime-500',    bg: 'bg-lime-500/10',    Icon: TrendingUp    },
  P2P_Send:            { label: 'Sent',            color: 'text-rose-500',    bg: 'bg-rose-500/10',    Icon: ArrowUpRight  },
  P2P_Receive:         { label: 'Received',        color: 'text-emerald-500', bg: 'bg-emerald-500/10', Icon: ArrowDownLeft },
  Withdrawal_Debit:    { label: 'Withdrawal',      color: 'text-orange-500',  bg: 'bg-orange-500/10',  Icon: BanknoteIcon  },
  Withdrawal_Reversal: { label: 'Reversal',        color: 'text-teal-500',    bg: 'bg-teal-500/10',    Icon: RotateCcw     },
};

const WITHDRAWAL_STATUS_META = {
  Pending:   { color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Pending'   },
  Approved:  { color: 'text-sky-500',     bg: 'bg-sky-500/10',     label: 'Approved'  },
  Completed: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Completed' },
  Failed:    { color: 'text-rose-500',    bg: 'bg-rose-500/10',    label: 'Failed'    },
  Rejected:  { color: 'text-red-500',     bg: 'bg-red-500/10',     label: 'Rejected'  },
};

const FILTER_OPTIONS = [
  { key: 'All',               label: 'All'         },
  { key: 'Credit',            label: 'Credits'     },
  { key: 'Debit',             label: 'Debits'      },
  { key: 'Add_Money',         label: 'Top Ups'     },
  { key: 'Refund',            label: 'Refunds'     },
  { key: 'P2P_Send',          label: 'Sent'        },
  { key: 'P2P_Receive',       label: 'Received'    },
  { key: 'Withdrawal_Debit',  label: 'Withdrawals' },
  { key: 'Medicine_Purchase', label: 'Pharmacy'    },
  { key: 'Booking_Payment',   label: 'Bookings'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
  }).format(n ?? 0);

const fmtCompact = (n) => {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay loader (singleton)
// ─────────────────────────────────────────────────────────────────────────────

const loadRazorpay = (() => {
  let p = null;
  return () => {
    if (!p) p = new Promise((res) => {
      if (typeof window !== 'undefined' && window.Razorpay) return res(true);
      const s = document.createElement('script');
      s.src     = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload  = () => res(true);
      s.onerror = () => { p = null; res(false); };
      document.body.appendChild(s);
    });
    return p;
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.14 } },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 24 } },
  exit:    { opacity: 0, scale: 0.93, transition: { duration: 0.13 } },
};

const slideLeft = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit:    { opacity: 0, x: -24, transition: { duration: 0.12 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom hook: wallet ops
// ─────────────────────────────────────────────────────────────────────────────

function useWalletOps() {
  const dispatch = useDispatch();

  const handleAddMoney = useCallback(
    async (amount, { onProcessing, onSuccess, onError, onDismiss } = {}) => {
      try {
        const loaded = await loadRazorpay();
        if (!loaded) throw new Error('Payment gateway failed to load. Please refresh.');
        onProcessing?.();
        const { rzpOrder } = await dispatch(initializeWalletTopup({ amount })).unwrap();
        const options = {
          key:         RAZORPAY_KEY_ID,
          amount:      rzpOrder.amount,
          currency:    rzpOrder.currency,
          name:        'Likeson Healthcare',
          description: 'Wallet Top-Up',
          order_id:    rzpOrder.id,
          handler: async (resp) => {
            try {
              await dispatch(verifyWalletTopup({
                razorpay_order_id:   resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature:  resp.razorpay_signature,
                amount,
              })).unwrap();
              onSuccess?.();
            } catch (e) {
              onError?.(e?.message || 'Payment verification failed');
            }
          },
          modal:   { ondismiss: () => onDismiss?.() },
          prefill: { name: '', email: '', contact: '' },
          theme:   { color: '#3b82f6' },
        };
        new window.Razorpay(options).open();
      } catch (e) {
        onError?.(e?.message || 'Failed to initialise payment');
      }
    },
    [dispatch]
  );

  const handleRefresh = useCallback(() => {
    dispatch(fetchWalletDetails());
    dispatch(fetchWithdrawableBalance());
  }, [dispatch]);

  return { handleAddMoney, handleRefresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const Pill = ({ children, color = '', bg = '' }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${color} ${bg}`}>
    {children}
  </span>
);

const FieldRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-base-300/50 last:border-0">
    <span className="text-[11px] text-base-content/45 uppercase tracking-wider">{label}</span>
    <span className="text-[13px] font-bold text-base-content">{value}</span>
  </div>
);

const ErrorBox = ({ msg }) =>
  msg ? (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="flex items-start gap-2 rounded-xl bg-error/10 border border-error/20 px-3 py-2.5 mt-1"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-error mt-0.5" />
      <p className="text-[12px] text-error leading-snug">{msg}</p>
    </motion.div>
  ) : null;

const Spinner = ({ size = 4 }) => <Loader2 className={`h-${size} w-${size} animate-spin`} />;

const ModalOverlay = ({ onClose, children }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-md"
    onClick={(e) => e.target === e.currentTarget && onClose()}
    aria-modal="true" role="dialog"
  >
    {children}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Animated balance counter
// ─────────────────────────────────────────────────────────────────────────────

const AnimatedBalance = memo(({ value }) => {
  const mv  = useMotionValue(value ?? 0);
  const sp  = useSpring(mv, { stiffness: 75, damping: 16 });
  const out = useTransform(sp, (v) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 2,
    }).format(v)
  );
  useEffect(() => { mv.set(value ?? 0); }, [value, mv]);
  return (
    <motion.span className="tabular-nums" style={{ display: 'contents' }}>
      {out}
    </motion.span>
  );
});
AnimatedBalance.displayName = 'AnimatedBalance';

// ─────────────────────────────────────────────────────────────────────────────
// Balance Card
// ─────────────────────────────────────────────────────────────────────────────

const BalanceCard = memo(({ onAddMoney, onSend, onReceive }) => {
  const balance    = useSelector(selectWalletBalance);
  const wallet     = useSelector(selectWalletData);
  const isLoading  = useSelector(selectWalletLoading);
  const wdAvail    = useSelector(selectWithdrawableAvailable);
  const locked     = useSelector(selectLockedBalance);
  const [hidden, setHidden] = useState(false);

  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-2xl border border-white/10 shadow-primary"
      style={{ background: 'linear-gradient(140deg,#1d4ed8 0%,#1e3a8a 50%,#0f172a 100%)' }}
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/[0.04] blur-[50px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-52 w-52 rounded-full bg-blue-400/10 blur-[50px]" />
      {/* dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '20px 20px' }}
      />

      <div className="relative z-10 p-6 sm:p-8">
        {/* header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Likeson Wallet</p>
              <p className="text-[11px] text-white/35">{wallet?.currency ?? 'INR'} Account</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHidden(h => !h)}
              aria-label={hidden ? 'Show balance' : 'Hide balance'}
              className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            >
              {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${wallet?.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${wallet?.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {wallet?.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        {/* balance */}
        <div className="mt-7">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Available Balance</p>
          {isLoading && balance === 0 ? (
            <div className="h-14 w-56 animate-pulse rounded-xl bg-white/10" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.p
                key={hidden ? 'h' : 's'}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="font-black text-white leading-none"
                style={{ fontSize: 'clamp(2rem,8vw,3.2rem)', fontFamily: 'var(--font-family-montserrat,sans-serif)' }}
              >
                {hidden ? '₹ ••••••' : <AnimatedBalance value={balance} />}
              </motion.p>
            </AnimatePresence>
          )}
        </div>

        {/* withdrawable mini-bar */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-white/40" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Withdrawable</p>
            <p className="text-[13px] font-black text-white/90">{fmt(wdAvail)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Locked</p>
            <p className="text-[13px] font-black text-amber-300">{fmt(locked)}</p>
          </div>
        </div>

        {/* action buttons */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {[
            { label: 'Add Money', Icon: Plus,   onClick: onAddMoney, primary: true  },
            { label: 'Send',      Icon: Send,   onClick: onSend,     primary: false },
            { label: 'Receive',   Icon: QrCode, onClick: onReceive,  primary: false },
          ].map(({ label, Icon, onClick, primary }) => (
            <motion.button
              key={label}
              onClick={onClick}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide transition-all ${
                primary
                  ? 'bg-white text-blue-700 shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:bg-white/90'
                  : 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </motion.button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-1.5 text-white/25">
          <ShieldCheck className="h-3 w-3" />
          <span className="text-[11px]">Secured &amp; encrypted by Razorpay</span>
        </div>
      </div>
    </motion.div>
  );
});
BalanceCard.displayName = 'BalanceCard';

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawable Balance Panel
// ─────────────────────────────────────────────────────────────────────────────

const WithdrawablePanel = memo(({ onWithdraw }) => {
  const dispatch  = useDispatch();
  const info      = useSelector(selectWithdrawableInfo);
  const loading   = useSelector(selectWithdrawableLoading);
  const balance   = useSelector(selectWalletBalance);
  const wdBalance = useSelector(selectWithdrawableBalance);
  const wdAvail   = useSelector(selectWithdrawableAvailable);
  const locked    = useSelector(selectLockedBalance);
  const nonWd     = useSelector(selectNonWithdrawable);
  const limits    = useSelector(selectWithdrawalLimits);

  useEffect(() => { dispatch(fetchWithdrawableBalance()); }, [dispatch]);

  if (loading && !info) {
    return (
      <motion.div variants={fadeUp} className="card p-5 animate-pulse space-y-3">
        <div className="h-4 w-40 rounded bg-base-300" />
        <div className="h-8 w-28 rounded bg-base-300" />
        <div className="h-3 w-full rounded bg-base-300" />
      </motion.div>
    );
  }

  const pct = balance > 0 ? Math.round((wdBalance / balance) * 100) : 0;

  return (
    <motion.div variants={fadeUp} className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-base-300 bg-base-200/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <BanknoteIcon className="h-4 w-4 text-warning" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">Withdrawable Balance</h3>
        </div>
        <button
          onClick={() => dispatch(fetchWithdrawableBalance())}
          className="text-base-content/30 hover:text-base-content transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* progress */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[10px] text-base-content/45 uppercase tracking-wider">Available to withdraw</p>
              <p className="text-2xl font-black text-base-content">{fmt(wdAvail)}</p>
            </div>
            <span className="text-[11px] font-bold text-base-content/40">{pct}% of balance</span>
          </div>
          <div className="h-2 w-full rounded-full bg-base-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-warning to-orange-400"
            />
          </div>
        </div>

        {/* breakdown grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Balance',    value: fmt(balance),   color: 'text-base-content'    },
            { label: 'Withdrawable',     value: fmt(wdBalance), color: 'text-warning'          },
            { label: 'Locked',           value: fmt(locked),    color: 'text-error'            },
            { label: 'Non-Withdrawable', value: fmt(nonWd),     color: 'text-base-content/50' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-base-200 px-3 py-3">
              <p className="text-[10px] text-base-content/40 uppercase tracking-wider">{label}</p>
              <p className={`text-[15px] font-black mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* limits */}
        {limits && (
          <div className="rounded-xl border border-base-300 bg-base-200/60 px-4 py-3 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-base-content/40">Withdrawal Limits</p>
            <FieldRow label="Min per request" value={fmt(limits.minAmount)}  />
            <FieldRow label="Max per request" value={fmt(limits.maxAmount)}  />
            <FieldRow label="Daily limit"     value={fmt(limits.dailyLimit)} />
            <FieldRow label="Used today"      value={fmt(limits.usedToday)}  />
          </div>
        )}

        {/* eligible sources — comes from server */}
        <div className="flex items-start gap-2 rounded-xl bg-warning/6 border border-warning/15 px-3 py-2.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" />
          <p className="text-[11px] text-base-content/55 leading-relaxed">
            Only <strong>Add Money</strong> (top-ups) and <strong>Referral Bonus</strong> credits are withdrawable.
            {info?.note && <span className="block mt-1 text-base-content/40">{info.note}</span>}
          </p>
        </div>

        <motion.button
          onClick={onWithdraw}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          disabled={wdAvail < 100}
          className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 bg-warning text-warning-content hover:brightness-110"
          style={{ background: 'var(--warning)' }}
        >
          <BanknoteIcon className="h-4 w-4" />
          Withdraw to Bank
        </motion.button>
      </div>
    </motion.div>
  );
});
WithdrawablePanel.displayName = 'WithdrawablePanel';

// ─────────────────────────────────────────────────────────────────────────────
// Bank Accounts Panel
// ─────────────────────────────────────────────────────────────────────────────

const BankAccountsPanel = memo(({ onAddNew }) => {
  const dispatch = useDispatch();
  const accounts = useSelector(selectBankAccounts);
  const loading  = useSelector(selectBankAccountsLoading);
  const acting   = useSelector(selectBankAccountActing);

  useEffect(() => { dispatch(fetchBankAccounts()); }, [dispatch]);

  return (
    <motion.div variants={fadeUp} className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-base-300 bg-base-200/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-info" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">Bank Accounts</h3>
          <span className="badge badge-info">{accounts.length}/3</span>
        </div>
        {accounts.length < 3 && (
          <button
            onClick={onAddNew}
            className="flex items-center gap-1 rounded-lg bg-info/10 px-3 py-1.5 text-[11px] font-bold text-info hover:bg-info/20 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading && accounts.length === 0 ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full rounded-xl" />
          ))
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-base-200">
              <Building2 className="h-5 w-5 text-base-content/20" />
            </div>
            <p className="text-sm font-bold text-base-content/40">No bank accounts added</p>
            <button onClick={onAddNew} className="rounded-xl bg-info/10 px-4 py-2 text-[12px] font-bold text-info hover:bg-info/20 transition-colors">
              Add your first account
            </button>
          </div>
        ) : (
          accounts.map((acc) => (
            <motion.div
              key={acc._id} layout
              className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3.5 hover:border-info/30 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10">
                <Building2 className="h-4 w-4 text-info" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-bold text-base-content truncate">{acc.accountHolderName}</p>
                  {acc.isPrimary  && <Pill color="text-info"    bg="bg-info/10">Primary</Pill>}
                  {acc.isVerified
                    ? <Pill color="text-success" bg="bg-success/10">Verified</Pill>
                    : <Pill color="text-warning" bg="bg-warning/10">Pending</Pill>
                  }
                </div>
                <p className="text-[11px] text-base-content/45 mt-0.5 truncate">
                  {acc.maskedAccount} · {acc.ifscCode} · {acc.accountType}
                  {acc.bankName && ` · ${acc.bankName}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!acc.isPrimary && (
                  <button
                    onClick={() => dispatch(setPrimaryBankAccount({ bankAccountId: acc._id }))}
                    disabled={acting}
                    title="Set as primary"
                    className="rounded-lg p-1.5 text-base-content/30 hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => dispatch(removeBankAccount({ bankAccountId: acc._id }))}
                  disabled={acting}
                  title="Remove account"
                  className="rounded-lg p-1.5 text-base-content/30 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
});
BankAccountsPanel.displayName = 'BankAccountsPanel';

// ─────────────────────────────────────────────────────────────────────────────
// User Withdrawals Panel
// ─────────────────────────────────────────────────────────────────────────────

const UserWithdrawalsPanel = memo(({ onNewWithdrawal }) => {
  const dispatch   = useDispatch();
  const requests   = useSelector(selectWithdrawals);
  const total      = useSelector(selectWithdrawalsTotal);
  const loading    = useSelector(selectWithdrawalsLoading);
  const acting     = useSelector(selectWithdrawalActing);

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);

  useEffect(() => {
    dispatch(fetchWithdrawals({ page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}) }));
  }, [dispatch, page, statusFilter]);

  const handleCancel = (requestId) => {
    if (!confirm('Cancel this withdrawal request? Funds will be unlocked.')) return;
    dispatch(cancelWithdrawal({ requestId }));
  };

  return (
    <motion.div variants={fadeUp} className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-base-300 bg-base-200/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-warning" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">My Withdrawals</h3>
          {total > 0 && <span className="badge badge-warning">{total}</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field py-1 text-[11px] font-bold"
          >
            <option value="">All</option>
            {['Pending', 'Approved', 'Completed', 'Failed', 'Rejected'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={onNewWithdrawal}
            className="flex items-center gap-1 rounded-lg bg-warning/10 px-3 py-1.5 text-[11px] font-bold text-warning hover:bg-warning/20 transition-colors"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2.5">
        {loading && requests.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full rounded-xl" />
          ))
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-base-200">
              <BanknoteIcon className="h-5 w-5 text-base-content/20" />
            </div>
            <p className="text-sm font-bold text-base-content/40">No withdrawal requests</p>
          </div>
        ) : (
          requests.map((r) => {
            const meta = WITHDRAWAL_STATUS_META[r.status] ?? WITHDRAWAL_STATUS_META.Pending;
            return (
              <motion.div key={r.requestId} layout
                className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3.5"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                  <BanknoteIcon className={`h-4 w-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-bold text-base-content">{fmt(r.amount)}</p>
                    <Pill color={meta.color} bg={meta.bg}>{meta.label}</Pill>
                  </div>
                  <p className="text-[11px] text-base-content/45 mt-0.5 truncate">
                    XXXX{r.accountNumber} · {r.bankName || r.ifscCode} · {fmtDate(r.requestedAt)}
                  </p>
                </div>
                {r.status === 'Pending' && (
                  <button
                    onClick={() => handleCancel(r.requestId)}
                    disabled={acting}
                    title="Cancel request"
                    className="shrink-0 rounded-lg p-1.5 text-base-content/30 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            );
          })
        )}

        {requests.length < total && (
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="w-full rounded-xl border border-base-300 bg-base-200 py-2.5 text-[11px] font-bold uppercase tracking-wider text-base-content/50 hover:text-base-content transition-all disabled:opacity-50"
          >
            {loading ? 'Loading…' : `Load More · ${total - requests.length} remaining`}
          </button>
        )}
      </div>
    </motion.div>
  );
});
UserWithdrawalsPanel.displayName = 'UserWithdrawalsPanel';

 
// ─────────────────────────────────────────────────────────────────────────────
// Transaction Row
// ─────────────────────────────────────────────────────────────────────────────

const TransactionRow = memo(({ txn }) => {
  const meta = PURPOSE_META[txn.purpose] ?? {
    label: txn.purpose, color: 'text-base-content', bg: 'bg-base-300', Icon: Clock,
  };
  const isCredit = txn.type === 'Credit';
  const statusCls =
    txn.status === 'Success' ? 'bg-success/10 text-success' :
    txn.status === 'Pending' ? 'bg-warning/10 text-warning' :
                               'bg-error/10 text-error';

  return (
    <motion.div
      variants={fadeUp} layout
      className="group flex items-center gap-3.5 rounded-xl p-3 transition-colors hover:bg-base-200 cursor-default"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg} transition-transform group-hover:scale-105`}>
        <meta.Icon className={`h-4 w-4 ${meta.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-semibold text-base-content">{txn.description || meta.label}</p>
          <p className={`shrink-0 text-[13px] font-black ${isCredit ? 'text-success' : 'text-error'}`}>
            {isCredit ? '+' : '−'}{fmt(txn.amount)}
          </p>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-base-content/40">{fmtDate(txn.timestamp)}</p>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusCls}`}>{txn.status}</span>
          </div>
        </div>
        {txn.withdrawableBalanceBefore != null && (
          <p className="text-[10px] text-base-content/25 mt-0.5">
            Withdrawable before: {fmt(txn.withdrawableBalanceBefore)}
          </p>
        )}
      </div>
    </motion.div>
  );
});
TransactionRow.displayName = 'TransactionRow';

const TxnSkeleton = () => (
  <div className="flex flex-col gap-1 p-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3.5 rounded-xl p-3">
        <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="skeleton h-2.5 w-1/3 rounded" />
        </div>
        <div className="skeleton h-4 w-14 rounded" />
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Transaction History Panel
// ─────────────────────────────────────────────────────────────────────────────

const TransactionHistory = memo(() => {
  const isLoading = useSelector(selectWalletLoading);
  const allTxns   = useSelector(selectWalletTransactions);
  const [filter, setFilter] = useState('All');
  const [page, setPage]     = useState(1);
  const [open, setOpen]     = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() =>
    [...allTxns]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter((t) => {
        if (filter === 'All')    return true;
        if (filter === 'Credit') return t.type === 'Credit';
        if (filter === 'Debit')  return t.type === 'Debit';
        return t.purpose === filter;
      }),
    [allTxns, filter]
  );

  const paginated = useMemo(() => filtered.slice(0, page * PER_PAGE), [filtered, page]);
  const hasMore   = filtered.length > paginated.length;
  const active    = FILTER_OPTIONS.find((o) => o.key === filter) ?? FILTER_OPTIONS[0];

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between border-b border-base-300 bg-base-200/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-base-content">All Transactions</h3>
          {filtered.length > 0 && <span className="badge badge-primary">{filtered.length}</span>}
        </div>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-base-300 bg-base-200 px-3 py-1.5 text-[11px] font-bold text-base-content hover:border-primary/40 transition-colors"
          >
            <Filter className="h-3 w-3" />{active.label}
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.ul
                initial={{ opacity: 0, y: 5, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.96 }}
                className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-xl"
                role="listbox"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <li key={opt.key}>
                    <button
                      role="option" aria-selected={filter === opt.key}
                      onClick={() => { setFilter(opt.key); setPage(1); setOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-[12px] font-medium transition-colors ${filter === opt.key ? 'bg-primary/10 text-primary' : 'text-base-content hover:bg-base-200'}`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="h-[400px] overflow-y-auto p-2">
        <AnimatePresence mode="wait">
          {isLoading && allTxns.length === 0 ? (
            <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TxnSkeleton />
            </motion.div>
          ) : paginated.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex h-full flex-col items-center justify-center py-16 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-base-200 mb-4">
                <Wallet className="h-6 w-6 text-base-content/20" />
              </div>
              <p className="text-sm font-bold text-base-content/40">No transactions found</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-base-content/25">
                {filter !== 'All' ? 'Try adjusting filters' : 'Add funds to start'}
              </p>
            </motion.div>
          ) : (
            <motion.div key="list" variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-0.5">
              {paginated.map((txn) => (
                <TransactionRow key={txn._id || txn.transactionId || txn.timestamp} txn={txn} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasMore && (
        <div className="border-t border-base-300 p-4">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="w-full rounded-xl border border-base-300 bg-base-200 py-2.5 text-[11px] font-black uppercase tracking-widest text-base-content/50 hover:text-base-content transition-all"
          >
            Load More · {filtered.length - paginated.length} remaining
          </button>
        </div>
      )}
    </div>
  );
});
TransactionHistory.displayName = 'TransactionHistory';

// ─────────────────────────────────────────────────────────────────────────────
// P2P History Panel
// ─────────────────────────────────────────────────────────────────────────────

const P2PHistoryPanel = memo(() => {
  const dispatch   = useDispatch();
  const transfers  = useSelector(selectTransfers);
  const total      = useSelector(selectTransfersTotal);
  const { page: curPage, limit } = useSelector(selectTransferHistory);
  const loading    = useSelector(selectHistoryLoading);

  useEffect(() => { dispatch(fetchTransferHistory({ page: 1, limit: 20 })); }, [dispatch]);

  if (loading && transfers.length === 0) return <TxnSkeleton />;

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-base-200">
          <Send className="h-5 w-5 text-base-content/20" />
        </div>
        <p className="text-sm font-bold text-base-content/40">No P2P transfers yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transfers.map((txn) => <TransactionRow key={txn._id || txn.pairTxnId} txn={txn} />)}
      {transfers.length < total && (
        <button
          onClick={() => dispatch(fetchTransferHistory({ page: curPage + 1, limit }))}
          disabled={loading}
          className="w-full mt-2 rounded-xl border border-base-300 bg-base-200 py-2.5 text-[11px] font-bold uppercase tracking-wider text-base-content/50 hover:text-base-content transition-all disabled:opacity-50"
        >
          {loading ? 'Loading…' : `Load More · ${total - transfers.length} remaining`}
        </button>
      )}
    </div>
  );
});
P2PHistoryPanel.displayName = 'P2PHistoryPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Insights Panel
// ─────────────────────────────────────────────────────────────────────────────

const InsightsPanel = memo(() => {
  const txns = useSelector(selectWalletTransactions);

  const monthly = useMemo(() => {
    const map = {};
    txns.forEach((t) => {
      const k = new Date(t.timestamp).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (!map[k]) map[k] = { credit: 0, debit: 0 };
      if (t.type === 'Credit') map[k].credit += t.amount;
      else map[k].debit += t.amount;
    });
    return Object.entries(map).slice(-6).reverse();
  }, [txns]);

  if (monthly.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-base-200">
          <BarChart3 className="h-5 w-5 text-base-content/20" />
        </div>
        <p className="text-sm font-bold text-base-content/40">No data yet</p>
      </div>
    );
  }

  const maxVal = Math.max(...monthly.flatMap(([, v]) => [v.credit, v.debit]), 1);

  return (
    <div className="space-y-4 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-base-content/40 px-1">Monthly Activity</p>
      {monthly.map(([month, vals]) => (
        <div key={month} className="px-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-base-content/70">{month}</span>
            <div className="flex gap-3 text-[11px]">
              <span className="text-success font-bold">+{fmtCompact(vals.credit)}</span>
              <span className="text-error font-bold">−{fmtCompact(vals.debit)}</span>
            </div>
          </div>
          {[['credit', 'from-success to-secondary'], ['debit', 'from-error to-warning']].map(([k, grad]) => (
            <div key={k} className="h-2 w-full rounded-full bg-base-300 overflow-hidden mb-1">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${(vals[k] / maxVal) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${grad} opacity-80`}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});
InsightsPanel.displayName = 'InsightsPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Stats Row
// ─────────────────────────────────────────────────────────────────────────────

const StatsRow = memo(() => {
  const txns   = useSelector(selectWalletTransactions);
  const nonWd  = useSelector(selectNonWithdrawable);

  const stats = useMemo(() => {
    const credits = txns.filter((t) => t.type === 'Credit').reduce((s, t) => s + t.amount, 0);
    const debits  = txns.filter((t) => t.type === 'Debit').reduce((s, t) => s + t.amount, 0);
    const success = txns.filter((t) => t.status === 'Success').length;
    return [
      { label: 'Total In',     value: fmtCompact(credits), color: 'text-success', bg: 'bg-success/10', Icon: ArrowDownLeft, sub: 'All time'   },
      { label: 'Total Out',    value: fmtCompact(debits),  color: 'text-error',   bg: 'bg-error/10',   Icon: ArrowUpRight,  sub: 'All time'   },
      { label: 'Transactions', value: success,             color: 'text-primary', bg: 'bg-primary/10', Icon: Activity,      sub: 'Successful' },
      { label: 'Non-Wthdwbl',  value: fmtCompact(nonWd),  color: 'text-warning', bg: 'bg-warning/10', Icon: BanknoteIcon,  sub: 'Platform only' },
    ];
  }, [txns, nonWd]);

  return (
    <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, color, bg, Icon, sub }) => (
        <motion.div key={label} variants={fadeUp}
          className="card p-4 flex flex-col gap-2 hover:-translate-y-0.5 transition-transform cursor-default"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <div>
            <p className={`font-black text-base-content ${typeof value === 'number' ? 'text-2xl' : 'text-xl'}`}>{value}</p>
            <p className="text-[10px] uppercase tracking-wider text-base-content/35 mt-0.5">{sub}</p>
          </div>
          <p className="text-[11px] text-base-content/45">{label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
});
StatsRow.displayName = 'StatsRow';

// ─────────────────────────────────────────────────────────────────────────────
// Tab Bar
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',      label: 'History',  Icon: History     },
  { key: 'p2p',      label: 'P2P',      Icon: Send        },
  { key: 'bank',     label: 'Bank',     Icon: Building2   },
  { key: 'withdraw', label: 'Withdraw', Icon: BanknoteIcon },
  { key: 'insights', label: 'Insights', Icon: BarChart3   },
 
];

const TabBar = memo(({ active, onChange }) => (
  <div className="flex gap-1 items-center justify-center overflow-x-auto rounded-xl bg-base-200 p-1 no-scrollbar" role="tablist">
    {TABS.map(({ key, label, Icon }) => (
      <button key={key} role="tab" aria-selected={active === key} onClick={() => onChange(key)}
        className={`flex shrink-0 w-auto items-center justify-center gap-1.5 rounded-[calc(0.75rem-3px)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-all ${
          active === key
            ? 'bg-base-100 text-base-content shadow-sm'
            : 'text-base-content/45 hover:text-base-content'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    ))}
  </div>
));
TabBar.displayName = 'TabBar';

// ─────────────────────────────────────────────────────────────────────────────
// Receive Modal
// ─────────────────────────────────────────────────────────────────────────────

const ReceiveModal = memo(({ open, onClose }) => {
  const dispatch = useDispatch();
  const myUpiId  = useSelector(selectMyUpiId);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (open && !myUpiId) dispatch(fetchMyUpiId()); }, [open, myUpiId, dispatch]);

  const handleCopy = () => {
    if (!myUpiId) return;
    navigator.clipboard.writeText(myUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={onClose}>
          <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-primary/20 bg-base-100 shadow-2xl"
          >
            <div className="h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <h2 className="font-black text-xl text-base-content">Receive Money</h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-tight text-base-content/45">Share your UPI ID</p>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-8 flex flex-col items-center gap-5">
              <div className="flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
                <div className="flex flex-col items-center gap-2 text-primary/50">
                  <QrCode className="h-12 w-12" />
                  <p className="text-[11px] font-bold uppercase tracking-wider">QR Code</p>
                </div>
              </div>
              <div className="w-full rounded-xl border border-base-300 bg-base-200 px-4 py-3 flex items-center justify-between gap-3">
                {myUpiId ? (
                  <>
                    <p className="text-sm font-bold text-base-content truncate">{myUpiId}</p>
                    <button
                      onClick={handleCopy}
                      className={`shrink-0 rounded-full p-1.5 transition-colors ${copied ? 'text-success' : 'text-base-content/40 hover:text-primary'}`}
                    >
                      {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </>
                ) : (
                  <div className="skeleton h-4 w-40 rounded" />
                )}
              </div>
              <p className="text-center text-[12px] text-base-content/40 leading-relaxed">
                Share your UPI ID or QR code. Money credited instantly.
              </p>
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
});
ReceiveModal.displayName = 'ReceiveModal';

// ─────────────────────────────────────────────────────────────────────────────
// Send Modal
// ─────────────────────────────────────────────────────────────────────────────

const TSTEP = { FORM: 'form', CONFIRM: 'confirm', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error' };

const SendModal = memo(({ open, onClose }) => {
  const dispatch      = useDispatch();
  const balance       = useSelector(selectWalletBalance);
  const lookupLoading = useSelector(selectLookupLoading);
  const isSelf        = useSelector(selectLookupIsSelf);
  const receiver      = useSelector(selectLookupReceiver);
  const actionLoading = useSelector(selectWalletActionLoading);

  const [step, setStep]     = useState(TSTEP.FORM);
  const [idType, setIdType] = useState('upiId');
  const [identifier, setId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');
  const [err, setErr]       = useState('');

  const reset = useCallback(() => {
    setStep(TSTEP.FORM); setId(''); setAmount(''); setNote(''); setErr('');
    dispatch(clearLookupResult());
  }, [dispatch]);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleLookup = useCallback(async () => {
    if (!identifier.trim()) { setErr('Please enter a UPI ID or phone number'); return; }
    setErr('');
    try {
      await dispatch(lookupTransferTarget({ [idType]: identifier.trim() })).unwrap();
      if (isSelf) { setErr('You cannot transfer money to yourself'); return; }
      setStep(TSTEP.CONFIRM);
    } catch (e) { setErr(e?.message || 'User not found'); }
  }, [identifier, idType, dispatch, isSelf]);

  // Move to confirm once lookup resolves and receiver is set
  useEffect(() => {
    if (step === TSTEP.FORM && receiver && !isSelf) setStep(TSTEP.CONFIRM);
  }, [receiver, isSelf, step]);

  const handleTransfer = useCallback(async () => {
    const amt = Number(amount);
    if (!amt || amt < 1)   { setErr('Enter a valid amount (min ₹1)'); return; }
    if (amt > balance)     { setErr(`Insufficient balance. Available: ${fmt(balance)}`); return; }
    setErr(''); setStep(TSTEP.PROCESSING);
    try {
      await dispatch(transferMoney({ amount: amt, note: note || undefined, [idType]: identifier.trim() })).unwrap();
      setStep(TSTEP.SUCCESS);
    } catch (e) { setErr(e?.message || 'Transfer failed'); setStep(TSTEP.ERROR); }
  }, [amount, balance, note, idType, identifier, dispatch]);

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={handleClose}>
          <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-primary/20 bg-base-100 shadow-2xl"
          >
            <div className="h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
            <div className="flex items-center justify-between px-6 py-5 pb-4">
              <div>
                <h2 className="font-black text-xl text-base-content">Send Money</h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-tight text-base-content/45">
                  {step === TSTEP.FORM ? 'Enter recipient' : step === TSTEP.CONFIRM ? 'Confirm transfer' : ''}
                </p>
              </div>
              <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-7">
              <AnimatePresence mode="wait">
                {/* ── Step 1: Lookup ── */}
                {step === TSTEP.FORM && (
                  <motion.div key="form" variants={slideLeft} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                    <div className="flex gap-2">
                      {[['upiId', 'UPI ID'], ['phone', 'Phone']].map(([v, l]) => (
                        <button key={v} onClick={() => setIdType(v)}
                          className={`flex-1 rounded-xl py-2 text-[12px] font-bold transition-all ${idType === v ? 'bg-primary text-primary-content shadow-md' : 'bg-base-200 text-base-content'}`}
                        >{l}</button>
                      ))}
                    </div>
                    <div className="relative">
                      {idType === 'phone' && <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />}
                      <input
                        className={`input-field w-full ${idType === 'phone' ? 'pl-10' : ''}`}
                        placeholder={idType === 'upiId' ? 'e.g. 9876543210@likeson' : 'Mobile number'}
                        value={identifier} onChange={(e) => setId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                        inputMode={idType === 'phone' ? 'numeric' : 'text'}
                      />
                    </div>
                    <ErrorBox msg={err} />
                    <motion.button
                      onClick={handleLookup}
                      disabled={!identifier.trim() || lookupLoading}
                      whileHover={identifier.trim() ? { scale: 1.01 } : {}}
                      whileTap={identifier.trim() ? { scale: 0.98 } : {}}
                      className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {lookupLoading ? <><Spinner /> Looking up…</> : <><ArrowRight className="h-4 w-4" /> Continue</>}
                    </motion.button>
                  </motion.div>
                )}

                {/* ── Step 2: Confirm ── */}
                {step === TSTEP.CONFIRM && receiver && (
                  <motion.div key="confirm" variants={slideLeft} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                    <div className="flex items-center gap-3.5 rounded-xl border border-base-300 bg-base-200 p-4">
                      {receiver.avatar
                        ? <img src={receiver.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                        : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black text-xl">
                            {receiver.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )
                      }
                      <div className="min-w-0">
                        <p className="font-bold text-base-content">{receiver.name}</p>
                        <p className="text-[12px] text-base-content/45 truncate">{receiver.upiId}</p>
                        <Pill color="text-success" bg="bg-success/10">Verified Likeson User</Pill>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-base-content/45">Amount (₹)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-base-content/40">₹</span>
                        <input
                          type="number" min={1} max={10000}
                          value={amount} onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="input-field w-full pl-8 text-lg font-black"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {QUICK_TRANSFER_AMOUNTS.map((v) => (
                          <button key={v} onClick={() => setAmount(String(v))}
                            className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-all ${Number(amount) === v ? 'bg-primary text-primary-content border-primary' : 'bg-base-200 border-base-300 text-base-content'}`}
                          >₹{v}</button>
                        ))}
                      </div>
                    </div>

                    <input
                      className="input-field w-full"
                      placeholder="Note (optional)"
                      value={note} onChange={(e) => setNote(e.target.value)} maxLength={100}
                    />
                    <p className="text-[11px] text-base-content/40">Available: <strong>{fmt(balance)}</strong></p>
                    <ErrorBox msg={err} />
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setStep(TSTEP.FORM); setErr(''); dispatch(clearLookupResult()); }}
                        className="btn-secondary flex-1 py-3"
                      >Back</button>
                      <motion.button
                        onClick={handleTransfer}
                        disabled={!amount || Number(amount) < 1 || actionLoading}
                        whileHover={amount ? { scale: 1.01 } : {}}
                        whileTap={amount ? { scale: 0.98 } : {}}
                        className="btn-primary-cta flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" /> Send {amount ? fmt(Number(amount)) : ''}
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* ── Processing ── */}
                {step === TSTEP.PROCESSING && (
                  <motion.div key="proc" variants={scaleIn} initial="hidden" animate="visible"
                    className="flex flex-col items-center justify-center py-12 text-center gap-4"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10">
                      <Loader2 className="h-7 w-7 text-primary animate-spin" />
                    </div>
                    <p className="font-black text-base-content">Processing…</p>
                  </motion.div>
                )}

                {/* ── Success ── */}
                {step === TSTEP.SUCCESS && (
                  <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-10 text-center gap-4"
                  >
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-success/40 bg-success/10"
                    >
                      <CheckCircle2 className="h-7 w-7 text-success" />
                    </motion.div>
                    <div>
                      <p className="font-black text-xl text-base-content">Money Sent!</p>
                      <p className="mt-1 text-sm text-base-content/50">{fmt(Number(amount))} sent to {receiver?.name}</p>
                    </div>
                    <button onClick={handleClose} className="mt-2 btn-success px-10">Done</button>
                  </motion.div>
                )}

                {/* ── Error ── */}
                {step === TSTEP.ERROR && (
                  <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-10 text-center gap-4"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-error/40 bg-error/10">
                      <AlertCircle className="h-7 w-7 text-error" />
                    </div>
                    <div>
                      <p className="font-black text-lg text-base-content">Transfer Failed</p>
                      <p className="mt-1 text-sm text-base-content/50">{err}</p>
                    </div>
                    <button onClick={() => { setStep(TSTEP.CONFIRM); setErr(''); }}
                      className="mt-2 rounded-xl bg-base-300 px-6 py-2.5 text-[12px] font-bold uppercase tracking-widest text-base-content"
                    >Try Again</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
});
SendModal.displayName = 'SendModal';

// ─────────────────────────────────────────────────────────────────────────────
// Add Money Modal
// ─────────────────────────────────────────────────────────────────────────────

const AMStep = { SELECT: 'select', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error' };

const AddMoneyModal = memo(({ open, onClose }) => {
  const dispatch = useDispatch();
  const { handleAddMoney } = useWalletOps();
  const [step, setStep]     = useState(AMStep.SELECT);
  const [preset, setPreset] = useState('');
  const [custom, setCustom] = useState('');
  const [errMsg, setErr]    = useState('');

  const selAmt = Number(custom || preset);

  const handleClose = useCallback(() => {
    setStep(AMStep.SELECT); setPreset(''); setCustom(''); setErr(''); onClose();
  }, [onClose]);

  const handleProceed = useCallback(() => {
    if (!selAmt || selAmt < 100) { setErr('Minimum top-up amount is ₹100'); return; }
    setErr('');
    handleAddMoney(selAmt, {
      onProcessing: () => setStep(AMStep.PROCESSING),
      onSuccess:    () => {
        setStep(AMStep.SUCCESS);
        dispatch(fetchWalletDetails());
        dispatch(fetchWithdrawableBalance());
      },
      onError:   (m) => { setStep(AMStep.ERROR); setErr(m); },
      onDismiss: () => setStep(AMStep.SELECT),
    });
  }, [selAmt, handleAddMoney, dispatch]);

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={handleClose}>
          <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-primary/20 bg-base-100 shadow-2xl"
          >
            <div className="h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
            <div className="flex items-center justify-between px-6 py-5 pb-4">
              <div>
                <h2 className="font-black text-xl text-base-content">Add Money</h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-tight text-base-content/45">Min ₹100 · Instant · Withdrawable</p>
              </div>
              <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-7">
              <AnimatePresence mode="wait">
                {step === AMStep.SELECT && (
                  <motion.div key="sel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                    <div>
                      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-base-content/40">Quick Select</p>
                      <div className="grid grid-cols-3 gap-2">
                        {QUICK_AMOUNTS.map((val) => {
                          const sel = Number(preset) === val && !custom;
                          return (
                            <motion.button key={val} onClick={() => { setPreset(String(val)); setCustom(''); }}
                              whileTap={{ scale: 0.94 }}
                              className={`rounded-xl border py-3 text-[13px] font-bold transition-all ${
                                sel
                                  ? 'border-transparent bg-gradient-to-br from-primary to-secondary text-primary-content shadow-lg shadow-primary/25'
                                  : 'border-base-300 bg-base-200 text-base-content hover:border-primary/40'
                              }`}
                            >₹{val.toLocaleString('en-IN')}</motion.button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-base-content/40">Custom Amount</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-base-content/40">₹</span>
                        <input
                          type="number" min={100} value={custom}
                          onChange={(e) => { setCustom(e.target.value); setPreset(''); }}
                          placeholder="Enter amount"
                          className="input-field w-full pl-8"
                        />
                      </div>
                    </div>

                    <ErrorBox msg={errMsg} />

                    <AnimatePresence>
                      {selAmt >= 100 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/6 px-4 py-3"
                        >
                          <span className="text-[12px] text-base-content/55">You will add</span>
                          <span className="font-black text-lg text-primary">{fmt(selAmt)}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center gap-2 rounded-xl bg-warning/6 border border-warning/15 px-3 py-2">
                      <Info className="h-3.5 w-3.5 shrink-0 text-warning" />
                      <p className="text-[11px] text-base-content/50">
                        Top-up credits are <strong className="text-warning">withdrawable</strong> to your bank account.
                      </p>
                    </div>

                    <motion.button onClick={handleProceed} disabled={!selAmt || selAmt < 100}
                      whileHover={selAmt >= 100 ? { scale: 1.01 } : {}}
                      whileTap={selAmt >= 100 ? { scale: 0.98 } : {}}
                      className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Zap className="h-4 w-4" />
                      {selAmt >= 100 ? `Pay ${fmt(selAmt)}` : 'Select Amount'}
                    </motion.button>

                    <div className="flex items-center justify-center gap-1.5 text-base-content/25">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <p className="text-[11px]">100% secure via Razorpay</p>
                    </div>
                  </motion.div>
                )}

                {step === AMStep.PROCESSING && (
                  <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center gap-4"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10">
                      <Loader2 className="h-7 w-7 text-primary animate-spin" />
                    </div>
                    <div>
                      <p className="font-black text-base-content">Opening Payment Gateway</p>
                      <p className="mt-1 text-[12px] text-base-content/45">Complete payment in Razorpay window</p>
                    </div>
                  </motion.div>
                )}

                {step === AMStep.SUCCESS && (
                  <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-10 text-center gap-4"
                  >
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-success/40 bg-success/10"
                    >
                      <CheckCircle2 className="h-7 w-7 text-success" />
                    </motion.div>
                    <div>
                      <p className="font-black text-xl text-base-content">Money Added!</p>
                      <p className="mt-2 text-sm text-base-content/50">{fmt(selAmt)} credited — withdrawable to bank</p>
                    </div>
                    <button onClick={handleClose} className="mt-2 btn-success px-10">Done</button>
                  </motion.div>
                )}

                {step === AMStep.ERROR && (
                  <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-10 text-center gap-4"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-error/40 bg-error/10">
                      <AlertCircle className="h-7 w-7 text-error" />
                    </div>
                    <div>
                      <p className="font-black text-lg text-base-content">Payment Failed</p>
                      <p className="mt-1 text-sm text-base-content/50">{errMsg}</p>
                    </div>
                    <button onClick={() => { setStep(AMStep.SELECT); setErr(''); }}
                      className="mt-2 rounded-xl bg-base-300 px-6 py-2.5 text-[12px] font-bold uppercase tracking-widest text-base-content"
                    >Try Again</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
});
AddMoneyModal.displayName = 'AddMoneyModal';

// ─────────────────────────────────────────────────────────────────────────────
// Add Bank Account Modal
// ─────────────────────────────────────────────────────────────────────────────

const AddBankModal = memo(({ open, onClose }) => {
  const dispatch = useDispatch();
  const acting   = useSelector(selectBankAccountActing);
  const [form, setForm] = useState({
    accountHolderName: '',
    accountNumber:     '',
    ifscCode:          '',
    bankName:          '',
    branchName:        '',
    accountType:       'Savings',
    isPrimary:         false,
  });
  const [err, setErr] = useState('');

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async () => {
    if (!form.accountHolderName.trim() || !form.accountNumber.trim() || !form.ifscCode.trim()) {
      setErr('Account holder name, account number, and IFSC are required');
      return;
    }
    setErr('');
    try {
      await dispatch(addBankAccount(form)).unwrap();
      onClose();
      setForm({ accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', branchName: '', accountType: 'Savings', isPrimary: false });
    } catch (e) { setErr(e?.message || 'Failed to add bank account'); }
  };

  const FIELDS = [
    { label: 'Account Holder Name *', key: 'accountHolderName', placeholder: 'As per bank records'        },
    { label: 'Account Number *',      key: 'accountNumber',     placeholder: '9–18 digit account number', inputMode: 'numeric' },
    { label: 'IFSC Code *',           key: 'ifscCode',          placeholder: 'e.g. SBIN0001234',           upper: true  },
    { label: 'Bank Name',             key: 'bankName',          placeholder: 'e.g. State Bank of India'   },
    { label: 'Branch Name',           key: 'branchName',        placeholder: 'Optional'                   },
  ];

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={onClose}>
          <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-info/20 bg-base-100 shadow-2xl"
          >
            <div className="h-1 bg-gradient-to-r from-info via-primary to-secondary" />
            <div className="flex items-center justify-between px-6 py-5 pb-4">
              <div>
                <h2 className="font-black text-xl text-base-content">Add Bank Account</h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-tight text-base-content/45">Max 3 accounts · Admin verification required</p>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-7 space-y-3 max-h-[70vh] overflow-y-auto">
              {FIELDS.map(({ label, key, placeholder, inputMode, upper }) => (
                <div key={key}>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-base-content/45">{label}</label>
                  <input
                    className="input-field w-full"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={set(key)}
                    inputMode={inputMode}
                    style={upper ? { textTransform: 'uppercase' } : {}}
                  />
                </div>
              ))}

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-base-content/45">Account Type</label>
                <select value={form.accountType} onChange={set('accountType')} className="input-field w-full">
                  {['Savings', 'Current', 'Salary'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isPrimary} onChange={set('isPrimary')} className="rounded" />
                <span className="text-[13px] font-semibold text-base-content">Set as primary payout account</span>
              </label>

              <ErrorBox msg={err} />

              <motion.button onClick={handleSubmit} disabled={acting}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {acting ? <><Spinner /> Adding…</> : <><Building2 className="h-4 w-4" /> Add Account</>}
              </motion.button>

              <p className="text-center text-[11px] text-base-content/35 leading-relaxed">
                Account verified via penny-drop before withdrawals are enabled.
              </p>
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
});
AddBankModal.displayName = 'AddBankModal';

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Request Modal
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Uses selectVerifiedBankAccounts (not selectBankAccounts) to filter
 * the list to only verified accounts, matching the server requirement.
 */
const WithdrawModal = memo(({ open, onClose }) => {
  const dispatch          = useDispatch();
  const verifiedAccounts  = useSelector(selectVerifiedBankAccounts);
  const wdAvailable       = useSelector(selectWithdrawableAvailable);
  const wdBalance         = useSelector(selectWithdrawableBalance);
  const lockedBalance     = useSelector(selectLockedBalance);
  const acting            = useSelector(selectWithdrawalActing);

  const [amount, setAmount]   = useState('');
  const [bankId, setBankId]   = useState('');
  const [err, setErr]         = useState('');
  const [success, setSuccess] = useState(false);

  // Auto-select primary verified account
  useEffect(() => {
    if (open && verifiedAccounts.length > 0 && !bankId) {
      const primary = verifiedAccounts.find((a) => a.isPrimary) ?? verifiedAccounts[0];
      setBankId(primary._id);
    }
  }, [open, verifiedAccounts, bankId]);

  const handleClose = useCallback(() => {
    setAmount(''); setBankId(''); setErr(''); setSuccess(false); onClose();
  }, [onClose]);

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt < 100)     { setErr('Minimum withdrawal amount is ₹100'); return; }
    if (amt > wdAvailable)     {
      setErr(`Insufficient withdrawable balance. Available: ${fmt(wdAvailable)}. Note: only Add Money + Referral Bonus are withdrawable.`);
      return;
    }
    if (!bankId)               { setErr('Please select a bank account'); return; }
    setErr('');
    try {
      await dispatch(requestWithdrawal({ amount: amt, bankAccountId: bankId })).unwrap();
      setSuccess(true);
    } catch (e) { setErr(e?.message || 'Failed to submit withdrawal request'); }
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={handleClose}>
          <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-warning/20 bg-base-100 shadow-2xl"
          >
            <div className="h-1 bg-gradient-to-r from-warning via-orange-400 to-error" />
            <div className="flex items-center justify-between px-6 py-5 pb-4">
              <div>
                <h2 className="font-black text-xl text-base-content">Withdraw to Bank</h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-tight text-base-content/45">
                  Available: <strong className="text-warning">{fmt(wdAvailable)}</strong>
                </p>
              </div>
              <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-300 hover:opacity-80">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-7 max-h-[80vh] overflow-y-auto">
              <AnimatePresence mode="wait">
                {!success ? (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    {verifiedAccounts.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                          <Building2 className="h-5 w-5 text-warning" />
                        </div>
                        <p className="font-bold text-base-content/60">No verified bank accounts</p>
                        <p className="text-[12px] text-base-content/40 leading-relaxed">
                          Add a bank account and wait for admin verification before withdrawing.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* balance info strip */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Withdrawable', value: fmt(wdBalance),  color: 'text-warning'  },
                            { label: 'Available',    value: fmt(wdAvailable), color: 'text-success'  },
                            { label: 'Locked',       value: fmt(lockedBalance), color: 'text-error'  },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="rounded-xl bg-base-200 px-2 py-2 text-center">
                              <p className="text-[9px] text-base-content/40 uppercase tracking-wider">{label}</p>
                              <p className={`text-[12px] font-black mt-0.5 ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* bank account selector */}
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-base-content/45">Select Bank Account</label>
                          <div className="space-y-2">
                            {verifiedAccounts.map((acc) => (
                              <button key={acc._id} onClick={() => setBankId(acc._id)}
                                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                  bankId === acc._id
                                    ? 'border-warning/50 bg-warning/8'
                                    : 'border-base-300 bg-base-200 hover:border-warning/30'
                                }`}
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                                  <Building2 className="h-3.5 w-3.5 text-warning" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-base-content">{acc.maskedAccount}</p>
                                  <p className="text-[11px] text-base-content/45">{acc.accountHolderName} · {acc.ifscCode}</p>
                                </div>
                                {bankId === acc._id && <CheckCircle2 className="h-4 w-4 text-warning ml-auto shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* amount */}
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-base-content/45">Amount (₹)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-base-content/40">₹</span>
                            <input
                              type="number" min={100} max={50000}
                              value={amount} onChange={(e) => setAmount(e.target.value)}
                              placeholder="0.00"
                              className="input-field w-full pl-8 text-lg font-black"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {QUICK_WITHDRAW_AMOUNTS.filter((v) => v <= wdAvailable).map((v) => (
                              <button key={v} onClick={() => setAmount(String(v))}
                                className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-all ${Number(amount) === v ? 'bg-warning text-warning-content border-warning' : 'bg-base-200 border-base-300 text-base-content'}`}
                              >₹{v.toLocaleString('en-IN')}</button>
                            ))}
                          </div>
                        </div>

                        <ErrorBox msg={err} />

                        <div className="rounded-xl border border-warning/20 bg-warning/6 px-4 py-3 space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-wider text-warning/70">Note</p>
                          <p className="text-[12px] text-base-content/55 leading-relaxed">
                            Only <strong>Add Money</strong> and <strong>Referral Bonus</strong> credits are withdrawable.
                            Funds locked until admin approves and payout completes.
                          </p>
                        </div>

                        <motion.button
                          onClick={handleSubmit}
                          disabled={acting || !amount || Number(amount) < 100}
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'var(--warning)', color: 'var(--warning-content)' }}
                        >
                          {acting ? <><Spinner /> Submitting…</> : <><BanknoteIcon className="h-4 w-4" /> Submit Request</>}
                        </motion.button>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-10 text-center gap-4"
                  >
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-warning/40 bg-warning/10"
                    >
                      <CheckCircle2 className="h-7 w-7 text-warning" />
                    </motion.div>
                    <div>
                      <p className="font-black text-xl text-base-content">Request Submitted!</p>
                      <p className="mt-2 text-sm text-base-content/50">Pending admin approval.</p>
                    </div>
                    <button onClick={handleClose}
                      className="mt-2 rounded-xl bg-warning/15 px-10 py-2.5 text-[12px] font-bold uppercase tracking-widest text-warning hover:bg-warning/25 transition-colors"
                    >Done</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
});
WithdrawModal.displayName = 'WithdrawModal';

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const dispatch = useDispatch();
  const error    = useSelector(selectWalletError);
  const { handleRefresh } = useWalletOps();

  const [showAdd,      setShowAdd]      = useState(false);
  const [showSend,     setShowSend]     = useState(false);
  const [showReceive,  setShowReceive]  = useState(false);
  const [showAddBank,  setShowAddBank]  = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [activeTab,    setActiveTab]    = useState('all');

  useEffect(() => {
    dispatch(fetchWalletDetails());
    dispatch(fetchWithdrawableBalance());
    dispatch(fetchBankAccounts());
    return () => {
      dispatch(clearWalletErrors());
      dispatch(clearLookupResult());
      dispatch(clearActiveWithdrawal());
    };
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-base-100 py-8">
      <div className="mx-auto w-full max-w-[46rem] px-4">
        <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-5">

          {/* ── Page Header ── */}
          <motion.div variants={fadeUp} className="flex items-center justify-between">
            <div>
              <h1 className="font-black text-base-content tracking-tighter leading-none section-heading mb-0" style={{ fontSize: 'clamp(1.75rem,6vw,2.75rem)' }}>
                My Wallet
              </h1>
              <p className="mt-1 text-sm text-base-content/45 font-medium">Likeson Healthcare · Secure Payments</p>
            </div>
            <motion.button
              onClick={handleRefresh}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94, rotate: 180 }}
              aria-label="Refresh wallet"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-base-300 bg-base-200 text-base-content hover:bg-base-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </motion.button>
          </motion.div>

          {/* ── Error Banner ── */}
          <AnimatePresence>
            {error && (
              <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit" role="alert"
                className="alert alert-error"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-error" />
                <p className="flex-1 text-sm font-medium text-error">{error}</p>
                <button onClick={() => dispatch(clearWalletErrors())} className="text-error/50 hover:text-error">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Balance Card ── */}
          <BalanceCard
            onAddMoney={() => setShowAdd(true)}
            onSend={() => setShowSend(true)}
            onReceive={() => setShowReceive(true)}
          />

          {/* ── Stats Row ── */}
          <StatsRow />

          {/* ── Tabbed Content Panel ── */}
          <motion.div variants={fadeUp} className="card overflow-hidden">
            <div className="border-b border-base-300 bg-base-100/80 px-4 pt-4 pb-3">
              <TabBar active={activeTab} onChange={setActiveTab} />
            </div>

            <div className="p-3 sm:p-4 min-h-[360px]">
              <AnimatePresence mode="wait">

                {activeTab === 'all' && (
                  <motion.div key="all" variants={slideLeft} initial="hidden" animate="visible" exit="exit">
                    <TransactionHistory />
                  </motion.div>
                )}

                {activeTab === 'p2p' && (
                  <motion.div key="p2p" variants={slideLeft} initial="hidden" animate="visible" exit="exit">
                    <P2PHistoryPanel />
                  </motion.div>
                )}

                {activeTab === 'bank' && (
                  <motion.div key="bank" variants={slideLeft} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                    <WithdrawablePanel onWithdraw={() => setShowWithdraw(true)} />
                    <BankAccountsPanel onAddNew={() => setShowAddBank(true)} />
                  </motion.div>
                )}

                {activeTab === 'withdraw' && (
                  <motion.div key="wd" variants={slideLeft} initial="hidden" animate="visible" exit="exit">
                    <UserWithdrawalsPanel onNewWithdrawal={() => setShowWithdraw(true)} />
                  </motion.div>
                )}

                {activeTab === 'insights' && (
                  <motion.div key="ins" variants={slideLeft} initial="hidden" animate="visible" exit="exit">
                    <InsightsPanel />
                  </motion.div>
                )}

              

              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── Platform Note ── */}
          <motion.div variants={fadeUp}
            className="flex items-start gap-3 rounded-xl border border-info/15 bg-info/5 p-4"
          >
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-info" />
            <p className="text-[12px] leading-relaxed text-base-content/55">
              <strong className="text-base-content/70">Add Money</strong> and <strong className="text-base-content/70">Referral Bonus</strong> credits are withdrawable to your bank account.
              All other credits — Cashback, Refunds, P2P Received, Coin Conversions — are for <strong className="text-base-content/70">platform use only</strong> within Likeson Healthcare.
            </p>
          </motion.div>

        </motion.div>
      </div>

      {/* ── Modals ── */}
      <AddMoneyModal   open={showAdd}      onClose={() => setShowAdd(false)}      />
      <SendModal       open={showSend}     onClose={() => setShowSend(false)}     />
      <ReceiveModal    open={showReceive}  onClose={() => setShowReceive(false)}  />
      <AddBankModal    open={showAddBank}  onClose={() => setShowAddBank(false)}  />
      <WithdrawModal   open={showWithdraw} onClose={() => setShowWithdraw(false)} />
    </div>
  );
}