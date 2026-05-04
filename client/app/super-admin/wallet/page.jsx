'use client';

/**
 * AdminWalletsPage.jsx — Likeson Healthcare
 * Full admin wallet system management.
 * Uses ALL admin thunks from walletSlice + selectUser from userSlice.
 *
 * Thunks covered:
 *   fetchAdminWallets     fetchAdminWalletById   toggleWalletActive
 *   fetchAdminWithdrawals approveWithdrawal      completeWithdrawal
 *   rejectWithdrawal      failWithdrawal
 *   adminCreditWallet     adminDebitWallet
 *   adminVerifyBankAccount
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, Eye, ToggleLeft, ToggleRight,
  CreditCard, Banknote, ShieldCheck, ChevronDown, ChevronUp,
  Search, Filter, Download, TrendingUp, Users, Clock, Activity,
  MoreVertical, X, Check, AlertCircle, Loader2, Building2,
  Receipt, BadgeCheck, Lock, Unlock, Send,
} from 'lucide-react';

import {
  fetchAdminWallets,
  fetchAdminWalletById,
  toggleWalletActive,
  fetchAdminWithdrawals,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  failWithdrawal,
  adminCreditWallet,
  adminDebitWallet,
  adminVerifyBankAccount,

  selectAdminWallets,
  selectAdminWalletsTotal,
  selectAdminWalletsLoading,
  selectAdminWithdrawals,
  selectAdminWithdrawalsTotal,
  selectAdminWithdrawalsLoading,
  selectWithdrawalActing,
  selectWalletActionLoading,
  selectBankAccountActing,
  selectWalletError,
} from '@/store/slices/walletSlice';

import { selectUser } from '@/store/slices/userSlice';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META = {
  Pending:   { color: 'text-warning',  bg: 'bg-warning/10',  border: 'border-warning/30',  icon: Clock },
  Approved:  { color: 'text-info',     bg: 'bg-info/10',     border: 'border-info/30',     icon: CheckCircle },
  Completed: { color: 'text-success',  bg: 'bg-success/10',  border: 'border-success/30',  icon: Check },
  Failed:    { color: 'text-error',    bg: 'bg-error/10',    border: 'border-error/30',    icon: XCircle },
  Rejected:  { color: 'text-error',    bg: 'bg-error/10',    border: 'border-error/30',    icon: XCircle },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { color: 'text-base-content/60', bg: 'bg-base-300/60', border: 'border-base-300', icon: Activity };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${m.color} ${m.bg} ${m.border}`}>
      <Icon size={11} />
      {status}
    </span>
  );
}

function Stat({ label, value, icon: Icon, accent }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50">{label}</p>
        <p className="text-xl font-black text-base-content mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative z-[210] ${width} w-full bg-base-100 rounded-2xl shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto`}
            initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          >
            <div className="flex items-center justify-between p-5 border-b border-base-300 sticky top-0 bg-base-100 z-10">
              <h3 className="font-black text-lg text-base-content">{title}</h3>
              <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AmountInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="label-text block mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/50 font-bold">₹</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '0.00'}
          className="input-field w-full pl-8"
        />
      </div>
    </div>
  );
}

// ─── left panel: wallet list ──────────────────────────────────────────────────

function WalletListPanel({ selectedId, onSelect }) {
  const dispatch = useDispatch();
  const wallets  = useSelector(selectAdminWallets);
  const total    = useSelector(selectAdminWalletsTotal);
  const loading  = useSelector(selectAdminWalletsLoading);
  const acting   = useSelector(selectWalletActionLoading);

  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [activeFilter, setAF]   = useState('');      // '' | 'true' | 'false'

  const load = useCallback(() => {
    const params = { page, limit: 20 };
    if (activeFilter !== '') params.isActive = activeFilter;
    dispatch(fetchAdminWallets(params));
  }, [dispatch, page, activeFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = wallets.filter((w) => {
    const q = search.toLowerCase();
    return (
      !q ||
      w.user?.name?.toLowerCase().includes(q) ||
      w.user?.email?.toLowerCase().includes(q) ||
      w.user?.phone?.includes(q)
    );
  });

  const handleToggle = async (e, w) => {
    e.stopPropagation();
    await dispatch(toggleWalletActive({ walletId: w._id, isActive: !w.isActive }));
    load();
  };

  return (
    <div className="flex flex-col h-full">
      {/* search + filter */}
      <div className="p-4 border-b border-base-300 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user…"
            className="input-field w-full pl-9 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {[['All', ''], ['Active', 'true'], ['Inactive', 'false']].map(([label, val]) => (
            <button
              key={val}
              onClick={() => { setAF(val); setPage(1); }}
              className={`btn btn-xs flex-1 ${activeFilter === val ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {loading && !wallets.length ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-base-content/50 text-sm">No wallets found</div>
        ) : (
          filtered.map((w) => (
            <motion.div
              key={w._id}
              whileHover={{ x: 2 }}
              onClick={() => onSelect(w._id)}
              className={`p-4 border-b border-base-300 cursor-pointer transition-colors group
                ${selectedId === w._id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-base-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-base-content truncate">{w.user?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-base-content/50 truncate">{w.user?.email}</p>
                  <p className="text-xs font-bold text-primary mt-1">{fmt(w.balance)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => handleToggle(e, w)}
                    disabled={acting}
                    className={`transition-colors ${w.isActive ? 'text-success' : 'text-base-content/30'}`}
                    title={w.isActive ? 'Deactivate wallet' : 'Activate wallet'}
                  >
                    {w.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <span className={`text-xs font-semibold ${w.isActive ? 'text-success' : 'text-error'}`}>
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* pagination */}
      <div className="p-3 border-t border-base-300 flex items-center justify-between text-xs text-base-content/50">
        <span>{total} total</span>
        <div className="flex gap-1">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn btn-xs btn-ghost">‹</button>
          <span className="px-2 py-1 font-bold">{page}</span>
          <button disabled={filtered.length < 20} onClick={() => setPage((p) => p + 1)} className="btn btn-xs btn-ghost">›</button>
        </div>
      </div>
    </div>
  );
}

// ─── right panel: wallet detail ───────────────────────────────────────────────

function WalletDetailPanel({ walletId }) {
  const dispatch = useDispatch();
  const acting   = useSelector(selectWalletActionLoading);
  const bankAct  = useSelector(selectBankAccountActing);

  const [detail, setDetail]         = useState(null);
  const [detailLoading, setDL]      = useState(false);
  const [activeTab, setTab]         = useState('overview');  // overview | txns | banks

  // modals
  const [creditModal, setCreditM]   = useState(false);
  const [debitModal, setDebitM]     = useState(false);
  const [verifyModal, setVerifyM]   = useState(null);  // bankAccount obj

  // form state
  const [creditAmt, setCreditAmt]   = useState('');
  const [creditDesc, setCreditDesc] = useState('');
  const [debitAmt, setDebitAmt]     = useState('');
  const [debitDesc, setDebitDesc]   = useState('');
  const [fundAccId, setFundAccId]   = useState('');

  const load = useCallback(async () => {
    if (!walletId) return;
    setDL(true);
    const result = await dispatch(fetchAdminWalletById({ walletId }));
    if (result.payload) setDetail(result.payload);
    setDL(false);
  }, [dispatch, walletId]);

  useEffect(() => { load(); setTab('overview'); }, [load]);

  const handleCredit = async () => {
    await dispatch(adminCreditWallet({ walletId, amount: creditAmt, description: creditDesc }));
    setCreditM(false); setCreditAmt(''); setCreditDesc('');
    load();
  };

  const handleDebit = async () => {
    await dispatch(adminDebitWallet({ walletId, amount: debitAmt, description: debitDesc }));
    setDebitM(false); setDebitAmt(''); setDebitDesc('');
    load();
  };

  const handleVerifyBank = async () => {
    if (!verifyModal || !fundAccId.trim()) return;
    await dispatch(adminVerifyBankAccount({
      walletId,
      bankAccountId: verifyModal._id,
      razorpayFundAccountId: fundAccId.trim(),
    }));
    setVerifyM(null); setFundAccId('');
    load();
  };

  if (!walletId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-base-content/30 gap-4">
        <Wallet size={48} strokeWidth={1} />
        <p className="text-sm font-semibold">Select wallet to inspect</p>
      </div>
    );
  }

  if (detailLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!detail) return null;

  const txnChart = [...(detail.transactions ?? [])]
    .slice(-30)
    .map((t) => ({
      date:   fmtDate(t.timestamp),
      credit: t.type === 'Credit' ? t.amount : 0,
      debit:  t.type === 'Debit'  ? t.amount : 0,
    }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* header */}
      <div className="p-5 border-b border-base-300 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-black text-xl text-base-content">{detail.user?.name}</h2>
            <p className="text-sm text-base-content/50">{detail.user?.email}</p>
            <p className="text-xs text-base-content/40 mt-0.5">{detail.user?.phone}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black text-primary">{fmt(detail.balance)}</p>
            <p className="text-xs text-base-content/50">total balance</p>
          </div>
        </div>

        {/* balance breakdown */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { l: 'Withdrawable',  v: detail.withdrawableBalance, c: 'text-success' },
            { l: 'Locked',        v: detail.lockedBalance,        c: 'text-warning' },
            { l: 'Total Withdrawn', v: detail.totalWithdrawn,     c: 'text-error'   },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-base-200 rounded-xl p-3 text-center">
              <p className={`text-base font-black ${c}`}>{fmt(v)}</p>
              <p className="text-xs text-base-content/50 mt-0.5">{l}</p>
            </div>
          ))}
        </div>

        {/* action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setCreditM(true)} className="btn btn-success btn-sm gap-1.5">
            <ArrowDownCircle size={15} /> Credit
          </button>
          <button onClick={() => setDebitM(true)} className="btn btn-error btn-sm gap-1.5">
            <ArrowUpCircle size={15} /> Debit
          </button>
          <button onClick={() => load()} className="btn btn-ghost btn-sm gap-1.5 border border-base-300">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex border-b border-base-300 bg-base-100 flex-shrink-0">
        {['overview', 'txns', 'banks'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors
              ${activeTab === t ? 'text-primary border-b-2 border-primary' : 'text-base-content/50 hover:text-base-content'}`}
          >
            {t === 'txns' ? 'Transactions' : t === 'banks' ? 'Bank Accounts' : 'Overview'}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="ov" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { l: 'Total Credited', v: detail.totalCredited },
                  { l: 'Total Debited',  v: detail.totalDebited  },
                ].map(({ l, v }) => (
                  <div key={l} className="stat-card">
                    <p className="stat-card-label">{l}</p>
                    <p className="stat-card-value text-base">{fmt(v)}</p>
                  </div>
                ))}
              </div>
              {txnChart.length > 0 && (
                <div className="bg-base-200 rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-3">Last 30 Transactions</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={txnChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--success)" stopOpacity={0}   />
                        </linearGradient>
                        <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--error)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--error)" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                      <XAxis dataKey="date" hide />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 11 }}
                        formatter={(v, n) => [fmt(v), n === 'credit' ? 'Credit' : 'Debit']}
                      />
                      <Area type="monotone" dataKey="credit" stroke="var(--success)" fill="url(#gc)" strokeWidth={2} />
                      <Area type="monotone" dataKey="debit"  stroke="var(--error)"   fill="url(#gd)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'txns' && (
            <motion.div key="tx" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {(detail.transactions ?? []).length === 0 ? (
                <p className="text-center text-sm text-base-content/40 py-10">No transactions</p>
              ) : (
                <div className="space-y-2">
                  {[...(detail.transactions)].reverse().slice(0, 50).map((t) => (
                    <div key={t._id} className="flex items-center justify-between p-3 bg-base-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === 'Credit' ? 'bg-success/10' : 'bg-error/10'}`}>
                          {t.type === 'Credit'
                            ? <ArrowDownCircle size={14} className="text-success" />
                            : <ArrowUpCircle   size={14} className="text-error"   />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-base-content">{t.purpose}</p>
                          <p className="text-xs text-base-content/40">{fmtDate(t.timestamp)}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-black ${t.type === 'Credit' ? 'text-success' : 'text-error'}`}>
                        {t.type === 'Credit' ? '+' : '-'}{fmt(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'banks' && (
            <motion.div key="bk" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {(detail.bankAccounts ?? []).length === 0 ? (
                <p className="text-center text-sm text-base-content/40 py-10">No bank accounts</p>
              ) : (
                <div className="space-y-3">
                  {detail.bankAccounts.map((acc) => (
                    <div key={acc._id} className="bg-base-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm text-base-content">{acc.accountHolderName}</p>
                          <p className="text-xs text-base-content/50">{acc.maskedAccount} · {acc.ifscCode}</p>
                          <p className="text-xs text-base-content/40">{acc.bankName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {acc.isVerified
                            ? <span className="badge badge-success badge-xs"><BadgeCheck size={10} /> Verified</span>
                            : <span className="badge badge-warning badge-xs"><AlertCircle size={10} /> Unverified</span>}
                          {acc.isPrimary && <span className="badge badge-primary badge-xs">Primary</span>}
                        </div>
                      </div>
                      {!acc.isVerified && (
                        <button
                          onClick={() => setVerifyM(acc)}
                          className="btn btn-xs btn-outline w-full gap-1"
                        >
                          <ShieldCheck size={12} /> Link Fund Account
                        </button>
                      )}
                      {acc.razorpayFundAccountId && (
                        <p className="text-xs text-base-content/40 font-mono">FA: {acc.razorpayFundAccountId}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Credit Modal ── */}
      <Modal open={creditModal} onClose={() => setCreditM(false)} title="Credit Wallet">
        <div className="space-y-4">
          <AmountInput label="Amount" value={creditAmt} onChange={setCreditAmt} />
          <div>
            <label className="label-text block mb-1.5">Description (optional)</label>
            <input value={creditDesc} onChange={(e) => setCreditDesc(e.target.value)}
              placeholder="Admin manual credit" className="input-field w-full" />
          </div>
          <div className="alert alert-warning text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>Credits <strong>Admin_Credit</strong> purpose — not withdrawable.</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setCreditM(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleCredit} disabled={acting || !creditAmt} className="btn btn-success flex-1 gap-2">
              {acting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Debit Modal ── */}
      <Modal open={debitModal} onClose={() => setDebitM(false)} title="Debit Wallet">
        <div className="space-y-4">
          <AmountInput label="Amount" value={debitAmt} onChange={setDebitAmt} />
          <div>
            <label className="label-text block mb-1.5">Description (optional)</label>
            <input value={debitDesc} onChange={(e) => setDebitDesc(e.target.value)}
              placeholder="Admin manual debit" className="input-field w-full" />
          </div>
          <div className="alert alert-error text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>This will immediately debit the wallet balance.</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDebitM(false)} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleDebit} disabled={acting || !debitAmt} className="btn btn-error flex-1 gap-2">
              {acting ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Verify Bank Modal ── */}
      <Modal open={!!verifyModal} onClose={() => { setVerifyM(null); setFundAccId(''); }} title="Link Razorpay Fund Account">
        {verifyModal && (
          <div className="space-y-4">
            <div className="bg-base-200 rounded-xl p-3 text-sm">
              <p className="font-bold">{verifyModal.accountHolderName}</p>
              <p className="text-base-content/50">{verifyModal.maskedAccount} · {verifyModal.ifscCode}</p>
            </div>
            <div>
              <label className="label-text block mb-1.5">Razorpay Fund Account ID</label>
              <input value={fundAccId} onChange={(e) => setFundAccId(e.target.value)}
                placeholder="fa_xxxxxxxxxxxx" className="input-field w-full font-mono" />
            </div>
            <div className="alert alert-info text-xs">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>Required to enable payouts for this account. Get the FA ID from Razorpay X dashboard.</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setVerifyM(null); setFundAccId(''); }} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleVerifyBank} disabled={bankAct || !fundAccId.trim()} className="btn btn-primary flex-1 gap-2">
                {bankAct ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />} Verify
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── withdrawal queue panel ───────────────────────────────────────────────────

function WithdrawalQueuePanel() {
  const dispatch   = useDispatch();
  const requests   = useSelector(selectAdminWithdrawals);
  const total      = useSelector(selectAdminWithdrawalsTotal);
  const loading    = useSelector(selectAdminWithdrawalsLoading);
  const acting     = useSelector(selectWithdrawalActing);

  const [statusFilter, setSF]   = useState('Pending');
  const [page, setPage]         = useState(1);
  const [expanded, setExpanded] = useState(null);

  // action modals
  const [rejectModal, setRejectM]   = useState(null);   // { requestId, walletId }
  const [failModal, setFailM]       = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [failReason, setFailReason] = useState('');

  const load = useCallback(() => {
    dispatch(fetchAdminWithdrawals({ status: statusFilter, page, limit: 20 }));
  }, [dispatch, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, args) => {
    await dispatch(fn(args));
    load();
  };

  const handleApprove  = (r) => act(approveWithdrawal,  { requestId: r.request.requestId, walletId: r.walletId });
  const handleComplete = (r) => act(completeWithdrawal, { requestId: r.request.requestId, walletId: r.walletId });
  const handleReject   = async () => {
    await act(rejectWithdrawal, { requestId: rejectModal.requestId, walletId: rejectModal.walletId, adminNote: rejectNote });
    setRejectM(null); setRejectNote('');
  };
  const handleFail = async () => {
    await act(failWithdrawal, { requestId: failModal.requestId, walletId: failModal.walletId, failureReason: failReason });
    setFailM(null); setFailReason('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* filter tabs */}
      <div className="flex border-b border-base-300 flex-shrink-0">
        {['Pending', 'Approved', 'Completed', 'Failed', 'Rejected'].map((s) => {
          const m = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => { setSF(s); setPage(1); setExpanded(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors
                ${statusFilter === s ? `${m.color} border-b-2 border-current` : 'text-base-content/40 hover:text-base-content/70'}`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {loading && !requests.length ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-base-content/40 gap-3">
            <CheckCircle size={36} strokeWidth={1} />
            <p className="text-sm">No {statusFilter.toLowerCase()} requests</p>
          </div>
        ) : (
          requests.map((item) => {
            const r   = item.request;
            const key = r.requestId;
            const exp = expanded === key;
            return (
              <motion.div key={key} layout className="border-b border-base-300">
                {/* row */}
                <div
                  className="p-4 cursor-pointer hover:bg-base-200 transition-colors"
                  onClick={() => setExpanded(exp ? null : key)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={r.status} />
                        <span className="text-xs text-base-content/40 font-mono">{r.requestId}</span>
                      </div>
                      <p className="font-bold text-base-content">{item.user?.name}</p>
                      <p className="text-xs text-base-content/50">{item.user?.email}</p>
                      <p className="text-sm font-black text-primary mt-1">{fmt(r.amount)}</p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs text-base-content/40">{fmtDate(r.requestedAt)}</p>
                      {exp ? <ChevronUp size={16} className="text-base-content/40" /> : <ChevronDown size={16} className="text-base-content/40" />}
                    </div>
                  </div>
                </div>

                {/* expanded detail + actions */}
                <AnimatePresence>
                  {exp && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        {/* bank info */}
                        <div className="bg-base-200 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex items-center gap-2 text-base-content/60 font-semibold mb-1">
                            <Building2 size={12} /> Bank Details
                          </div>
                          <p><span className="text-base-content/40">Holder:</span> {r.accountHolderName}</p>
                          <p><span className="text-base-content/40">Account:</span> XXXX{r.accountNumber}</p>
                          <p><span className="text-base-content/40">IFSC:</span> {r.ifscCode}</p>
                          {r.bankName && <p><span className="text-base-content/40">Bank:</span> {r.bankName}</p>}
                          {r.razorpayPayoutId && (
                            <p className="font-mono text-primary"><span className="text-base-content/40">Payout ID:</span> {r.razorpayPayoutId}</p>
                          )}
                          {r.adminNote && <p className="text-warning"><span className="text-base-content/40">Note:</span> {r.adminNote}</p>}
                          {r.failureReason && <p className="text-error"><span className="text-base-content/40">Failure:</span> {r.failureReason}</p>}
                        </div>

                        {/* action buttons */}
                        {r.status === 'Pending' && (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleApprove(item)} disabled={acting} className="btn btn-info btn-sm gap-1.5 flex-1">
                              {acting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Approve
                            </button>
                            <button
                              onClick={() => setRejectM({ requestId: r.requestId, walletId: item.walletId })}
                              disabled={acting}
                              className="btn btn-error btn-sm gap-1.5 flex-1"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </div>
                        )}

                        {(r.status === 'Pending' || r.status === 'Approved') && (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleComplete(item)} disabled={acting} className="btn btn-success btn-sm gap-1.5 flex-1">
                              {acting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Initiate Payout
                            </button>
                            <button
                              onClick={() => setFailM({ requestId: r.requestId, walletId: item.walletId })}
                              disabled={acting}
                              className="btn btn-warning btn-sm gap-1.5 flex-1"
                            >
                              <AlertTriangle size={13} /> Mark Failed
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* pagination */}
      <div className="p-3 border-t border-base-300 flex items-center justify-between text-xs text-base-content/50">
        <span>{total} total</span>
        <div className="flex gap-1">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn btn-xs btn-ghost">‹</button>
          <span className="px-2 py-1 font-bold">{page}</span>
          <button disabled={requests.length < 20} onClick={() => setPage((p) => p + 1)} className="btn btn-xs btn-ghost">›</button>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => { setRejectM(null); setRejectNote(''); }} title="Reject Withdrawal">
        <div className="space-y-4">
          <div className="alert alert-warning text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>Locked funds will be released back to the user wallet.</span>
          </div>
          <div>
            <label className="label-text block mb-1.5">Admin Note (optional)</label>
            <textarea
              value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
              rows={3} placeholder="Reason for rejection…"
              className="input-field w-full resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setRejectM(null); setRejectNote(''); }} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleReject} disabled={acting} className="btn btn-error flex-1 gap-2">
              {acting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
            </button>
          </div>
        </div>
      </Modal>

      {/* Fail Modal */}
      <Modal open={!!failModal} onClose={() => { setFailM(null); setFailReason(''); }} title="Mark Payout Failed">
        <div className="space-y-4">
          <div className="alert alert-info text-xs">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>This releases the lock and credits a <strong>Withdrawal_Reversal</strong> back to the user wallet.</span>
          </div>
          <div>
            <label className="label-text block mb-1.5">Failure Reason (optional)</label>
            <textarea
              value={failReason} onChange={(e) => setFailReason(e.target.value)}
              rows={3} placeholder="e.g. Bank account invalid, RZP API error…"
              className="input-field w-full resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setFailM(null); setFailReason(''); }} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleFail} disabled={acting} className="btn btn-warning flex-1 gap-2">
              {acting ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} Mark Failed
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── stats bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const wallets  = useSelector(selectAdminWallets);
  const wdrs     = useSelector(selectAdminWithdrawals);
  const wdrTotal = useSelector(selectAdminWithdrawalsTotal);

  const activeCount    = wallets.filter((w) => w.isActive).length;
  const pendingAmount  = wdrs.reduce((s, r) => s + (r.request?.amount ?? 0), 0);

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 p-4 border-b border-base-300 bg-base-100 flex-shrink-0">
      <Stat label="Active Wallets"    value={activeCount}          icon={Wallet}       accent="bg-primary"  />
      <Stat label="Pending Withdrawals" value={wdrTotal}           icon={Clock}        accent="bg-warning"  />
      <Stat label="Pending Amount"    value={fmt(pendingAmount)}   icon={Banknote}     accent="bg-info"     />
      <Stat label="Total Wallets"     value={useSelector(selectAdminWalletsTotal)} icon={Users} accent="bg-secondary" />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AdminWalletsPage() {
  const user            = useSelector(selectUser);
  const error           = useSelector(selectWalletError);

  const [selectedWalletId, setSelectedWalletId] = useState(null);
  const [view, setView]                         = useState('wallets');  // 'wallets' | 'withdrawals'

  return (
    <div className="flex flex-col h-screen bg-base-100 overflow-hidden">
      {/* top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-base-300 bg-base-100 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Wallet size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg leading-none text-base-content">Wallet System</h1>
            <p className="text-xs text-base-content/50">Management Console</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* view toggle */}
          <div className="bg-base-200 rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setView('wallets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${view === 'wallets' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/60 hover:text-base-content'}`}
            >
              Wallets
            </button>
            <button
              onClick={() => setView('withdrawals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${view === 'withdrawals' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/60 hover:text-base-content'}`}
            >
              Withdrawals
            </button>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-base-content">{user?.name}</p>
            <p className="text-xs text-base-content/40 capitalize">{user?.role}</p>
          </div>
        </div>
      </header>

      {/* global error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-error/10 border-b border-error/30 text-error text-xs font-semibold flex items-center gap-2"
          >
            <AlertCircle size={13} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* stats */}
      <StatsBar />

      {/* main content — left/right split */}
      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'wallets' ? (
            <motion.div key="wallets" className="flex flex-1 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* LEFT — wallet list */}
              <div className="w-80 xl:w-96 flex-shrink-0 border-r border-base-300 flex flex-col overflow-hidden">
                <WalletListPanel selectedId={selectedWalletId} onSelect={setSelectedWalletId} />
              </div>

              {/* RIGHT — wallet detail */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <WalletDetailPanel walletId={selectedWalletId} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="withdrawals" className="flex flex-1 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex-1 flex flex-col overflow-hidden">
                <WithdrawalQueuePanel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}