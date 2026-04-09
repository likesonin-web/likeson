"use client";

/**
 * SettlementsPaymentsPage
 * Route: /pharmacy-store/financials/[...sections]/page.jsx (settlements branch)
 *
 * Covers:
 *  - payment-account         → PaymentAccountSection
 *  - payment-account/bank    → AddBankSection
 *  - payment-account/upi     → AddUpiSection
 *  - settlements             → SettlementsOverviewSection
 *  - settlements/request     → RequestSettlementSection
 *  - settlements/history     → SettlementHistorySection
 *
 * This file can be co-located with FinancialReportsPage (page.jsx) in the same
 * [...sections]/page.jsx. Simply import the appropriate sections and add them
 * to SECTION_COMPONENTS in the parent file. They are exported as named exports.
 */

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  WalletCards, Building2, IndianRupee, CircleDollarSign,
  ArrowLeftRight, History, CheckCircle2, Trash2, Loader2,
  Star, AlertCircle, TrendingUp, TrendingDown, RefreshCw,
  ShieldCheck, CreditCard,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  fetchPaymentAccount,
  addBankAccount,
  addUpiHandle,
  deleteBankAccount,
  deleteUpiHandle,
  fetchSettlements,
  requestSettlement,
  fetchSettlementHistory,
  clearSuccess,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function SectionLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 size={32} className="text-primary animate-spin" />
      <p className="text-base-content/50 text-sm">Loading data…</p>
    </div>
  );
}

function EmptyState({ message = "No data available" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle size={36} className="text-base-content/30" />
      <p className="text-base-content/40 text-sm">{message}</p>
    </div>
  );
}

function FormField({ label, id, error, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-base-content">{label}</label>
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

// ─── Payment Account Overview ─────────────────────────────────────────────────
export function PaymentAccountSection() {
  const dispatch = useDispatch();
  const { paymentAccount, loading } = useSelector((s) => s.pharmacyStore);

  useEffect(() => { dispatch(fetchPaymentAccount()); }, [dispatch]);

  const handleDeleteBank = (id) => {
    if (confirm("Remove this bank account?")) dispatch(deleteBankAccount(id));
  };
  const handleDeleteUpi = (id) => {
    if (confirm("Remove this UPI handle?")) dispatch(deleteUpiHandle(id));
  };

  if (loading.paymentAccount) return <SectionLoading />;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black font-montserrat text-base-content">Payment Account</h2>
          <p className="text-sm text-base-content/50 mt-0.5">Your linked bank accounts and UPI handles</p>
        </div>
        <button onClick={() => dispatch(fetchPaymentAccount())}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </motion.div>

      {/* Balances */}
      {paymentAccount && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Pending Balance",  value: fmt(paymentAccount.pendingBalance), Icon: TrendingUp,   accent: true },
            { label: "Total Earned",     value: fmt(paymentAccount.totalEarned),    Icon: CircleDollarSign },
            { label: "Total Settled",    value: fmt(paymentAccount.totalSettled),   Icon: CheckCircle2 },
          ].map(({ label, value, Icon, accent }) => (
            <div key={label}
              className={`rounded-xl p-5 border flex items-center gap-4 ${accent
                ? "bg-primary/5 border-primary/20" : "bg-base-100 border-base-300"}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ? "bg-primary/10" : "bg-base-200"}`}>
                <Icon size={18} className={accent ? "text-primary" : "text-base-content/50"} />
              </div>
              <div>
                <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">{label}</p>
                <p className={`text-xl font-black font-montserrat ${accent ? "text-primary" : "text-base-content"}`}>{value}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Bank Accounts */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-widest text-base-content/60">Bank Accounts</h3>
          <span className="text-xs text-base-content/40">{paymentAccount?.bankAccounts?.length || 0} linked</span>
        </div>
        {(paymentAccount?.bankAccounts || []).length === 0
          ? <div className="bg-base-200/50 border border-dashed border-base-300 rounded-xl p-6 text-center text-sm text-base-content/40">No bank accounts linked</div>
          : (paymentAccount.bankAccounts).map((b) => (
            <div key={b._id} className="bg-base-100 border border-base-300 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-base-content text-sm">{b.accountHolderName}</p>
                  {b.isPrimary && (
                    <span className="badge badge-primary text-xs flex items-center gap-1">
                      <Star size={10} /> Primary
                    </span>
                  )}
                  {b.isVerified && (
                    <span className="badge badge-success text-xs flex items-center gap-1">
                      <ShieldCheck size={10} /> Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-base-content/50 mt-0.5">
                  {b.bankName} · {b.ifscCode} · A/c ending {b.accountNumber?.slice(-4)}
                </p>
                <p className="text-xs text-base-content/40">{b.accountType} Account · {b.branchName}</p>
              </div>
              <button onClick={() => handleDeleteBank(b._id)}
                className="p-2 rounded-lg hover:bg-error/10 text-base-content/30 hover:text-error transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))
        }
      </motion.div>

      {/* UPI */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-widest text-base-content/60">UPI Handles</h3>
          <span className="text-xs text-base-content/40">{paymentAccount?.upiHandles?.length || 0} linked</span>
        </div>
        {(paymentAccount?.upiHandles || []).length === 0
          ? <div className="bg-base-200/50 border border-dashed border-base-300 rounded-xl p-6 text-center text-sm text-base-content/40">No UPI handles linked</div>
          : (paymentAccount.upiHandles).map((u) => (
            <div key={u._id} className="bg-base-100 border border-base-300 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <IndianRupee size={16} className="text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-base-content text-sm">{u.upiId}</p>
                  {u.isPrimary && <span className="badge badge-primary text-xs">Primary</span>}
                  {u.isVerified && <span className="badge badge-success text-xs">Verified</span>}
                </div>
                <p className="text-xs text-base-content/50 mt-0.5">{u.upiName}</p>
              </div>
              <button onClick={() => handleDeleteUpi(u._id)}
                className="p-2 rounded-lg hover:bg-error/10 text-base-content/30 hover:text-error transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))
        }
      </motion.div>
    </motion.div>
  );
}

// ─── Add Bank Account ─────────────────────────────────────────────────────────
export function AddBankSection() {
  const dispatch = useDispatch();
  const { loading, success, errors } = useSelector((s) => s.pharmacyStore);
  const [form, setForm] = useState({
    accountHolderName: "", accountNumber: "", ifscCode: "",
    bankName: "", branchName: "", accountType: "Current", isPrimary: false,
  });
  const [localErr, setLocalErr] = useState({});

  useEffect(() => {
    if (success.addBankAccount) {
      setForm({ accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", branchName: "", accountType: "Current", isPrimary: false });
      dispatch(clearSuccess("addBankAccount"));
    }
  }, [success.addBankAccount, dispatch]);

  const validate = () => {
    const e = {};
    if (!form.accountHolderName.trim()) e.accountHolderName = "Name is required";
    if (!form.accountNumber.trim())     e.accountNumber     = "Account number is required";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.toUpperCase())) e.ifscCode = "Invalid IFSC code";
    setLocalErr(e);
    return Object.keys(e).length === 0;
  };

  const handle = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    dispatch(addBankAccount({ ...form, ifscCode: form.ifscCode.toUpperCase() }));
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-black font-montserrat text-base-content">Add Bank Account</h2>
        <p className="text-sm text-base-content/50 mt-0.5">Link a bank account for settlements and payouts</p>
      </motion.div>

      <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-2xl p-6 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Account Holder Name" id="ahn" error={localErr.accountHolderName}>
              <input id="ahn" className="input-field w-full" placeholder="Full name as on bank account"
                value={form.accountHolderName} onChange={(e) => handle("accountHolderName", e.target.value)} />
            </FormField>
            <FormField label="Account Number" id="an" error={localErr.accountNumber}>
              <input id="an" className="input-field w-full" placeholder="Bank account number"
                value={form.accountNumber} onChange={(e) => handle("accountNumber", e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="IFSC Code" id="ifsc" error={localErr.ifscCode}>
              <input id="ifsc" className="input-field w-full uppercase" placeholder="e.g. HDFC0001234"
                value={form.ifscCode} onChange={(e) => handle("ifscCode", e.target.value.toUpperCase())} />
            </FormField>
            <FormField label="Account Type" id="at">
              <select id="at" className="input-field w-full" value={form.accountType} onChange={(e) => handle("accountType", e.target.value)}>
                <option value="Current">Current</option>
                <option value="Savings">Savings</option>
                <option value="OD">OD (Overdraft)</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Bank Name" id="bn">
              <input id="bn" className="input-field w-full" placeholder="e.g. HDFC Bank"
                value={form.bankName} onChange={(e) => handle("bankName", e.target.value)} />
            </FormField>
            <FormField label="Branch Name" id="bran">
              <input id="bran" className="input-field w-full" placeholder="e.g. Vijayawada Main"
                value={form.branchName} onChange={(e) => handle("branchName", e.target.value)} />
            </FormField>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" className="checkbox checkbox-primary"
              checked={form.isPrimary} onChange={(e) => handle("isPrimary", e.target.checked)} />
            <span className="text-sm font-medium text-base-content">Set as primary account</span>
          </label>

          {errors.bankAccount && (
            <div className="alert alert-error text-sm">{errors.bankAccount?.message || "Failed to add bank account"}</div>
          )}
          {success.addBankAccount && (
            <div className="alert alert-success text-sm flex items-center gap-2">
              <CheckCircle2 size={14} /> Bank account added successfully!
            </div>
          )}

          <button type="submit" disabled={loading.bankAccount}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-content font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
            {loading.bankAccount ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            {loading.bankAccount ? "Adding…" : "Add Bank Account"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Add UPI Handle ───────────────────────────────────────────────────────────
export function AddUpiSection() {
  const dispatch = useDispatch();
  const { loading, success, errors } = useSelector((s) => s.pharmacyStore);
  const [form, setForm] = useState({ upiId: "", upiName: "", isPrimary: false });
  const [localErr, setLocalErr] = useState({});

  useEffect(() => {
    if (success.addUpiHandle) {
      setForm({ upiId: "", upiName: "", isPrimary: false });
      dispatch(clearSuccess("addUpiHandle"));
    }
  }, [success.addUpiHandle, dispatch]);

  const validate = () => {
    const e = {};
    if (!form.upiId.trim()) e.upiId = "UPI ID is required";
    else if (!/^[\w.\-]+@[\w]+$/.test(form.upiId)) e.upiId = "Invalid UPI ID format (e.g. name@ybl)";
    setLocalErr(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    dispatch(addUpiHandle(form));
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-black font-montserrat text-base-content">Add UPI Handle</h2>
        <p className="text-sm text-base-content/50 mt-0.5">Link a UPI ID for instant payment settlement</p>
      </motion.div>

      <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-2xl p-6 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="UPI ID" id="upiId" error={localErr.upiId}>
            <input id="upiId" className="input-field w-full" placeholder="e.g. store@ybl"
              value={form.upiId} onChange={(e) => setForm((p) => ({ ...p, upiId: e.target.value }))} />
          </FormField>
          <FormField label="Display Name" id="upiName">
            <input id="upiName" className="input-field w-full" placeholder="e.g. Likeson Pharmacy"
              value={form.upiName} onChange={(e) => setForm((p) => ({ ...p, upiName: e.target.value }))} />
          </FormField>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" className="checkbox checkbox-primary"
              checked={form.isPrimary} onChange={(e) => setForm((p) => ({ ...p, isPrimary: e.target.checked }))} />
            <span className="text-sm font-medium text-base-content">Set as primary UPI</span>
          </label>
          {errors.upiHandle && (
            <div className="alert alert-error text-sm">{errors.upiHandle?.message || "Failed to add UPI handle"}</div>
          )}
          {success.addUpiHandle && (
            <div className="alert alert-success text-sm flex items-center gap-2">
              <CheckCircle2 size={14} /> UPI handle added!
            </div>
          )}
          <button type="submit" disabled={loading.upiHandle}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-content font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
            {loading.upiHandle ? <Loader2 size={16} className="animate-spin" /> : <IndianRupee size={16} />}
            {loading.upiHandle ? "Adding…" : "Add UPI Handle"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Settlements Overview ─────────────────────────────────────────────────────
export function SettlementsSection() {
  const dispatch = useDispatch();
  const { settlements, loading } = useSelector((s) => s.pharmacyStore);
  useEffect(() => { dispatch(fetchSettlements()); }, [dispatch]);
  if (loading.settlements) return <SectionLoading />;
  if (!settlements) return <EmptyState />;
  const s = settlements;
  const history = (s.settlementHistory || []).slice(0, 10);
  const chartData = history.map((h) => ({
    date: new Date(h.settledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    amount: h.amount,
  })).reverse();
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black font-montserrat text-base-content">Settlements Overview</h2>
          <p className="text-sm text-base-content/50 mt-0.5">Your payout summary and account status</p>
        </div>
        <button onClick={() => dispatch(fetchSettlements())}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Balance",  value: fmt(s.pendingBalance), accent: true, Icon: CircleDollarSign },
          { label: "Total Earned",     value: fmt(s.totalEarned),    Icon: TrendingUp },
          { label: "Total Settled",    value: fmt(s.totalSettled),   Icon: CheckCircle2 },
          { label: "Total Deductions", value: fmt(s.totalDeductions), Icon: TrendingDown },
        ].map(({ label, value, accent, Icon }) => (
          <motion.div key={label} variants={fadeUp}
            className={`rounded-xl p-4 border flex items-center gap-3 ${accent ? "bg-primary/5 border-primary/20" : "bg-base-100 border-base-300"}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? "bg-primary/10" : "bg-base-200"}`}>
              <Icon size={16} className={accent ? "text-primary" : "text-base-content/50"} />
            </div>
            <div>
              <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest leading-none">{label}</p>
              <p className={`text-lg font-black font-montserrat mt-0.5 ${accent ? "text-primary" : "text-base-content"}`}>{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Payout prefs */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-base-100 border border-base-300 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/50">Preferred Method</p>
          <p className="font-bold text-base-content flex items-center gap-2">
            <CreditCard size={15} className="text-primary" /> {s.preferredPayoutMethod}
          </p>
        </div>
        <div className="bg-base-100 border border-base-300 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/50">Payout Cycle</p>
          <p className="font-bold text-base-content flex items-center gap-2">
            <History size={15} className="text-primary" /> {s.payoutCycle}
          </p>
        </div>
      </motion.div>

      {/* Primary accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {s.primaryBank && (
          <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-2">Primary Bank</p>
            <p className="font-bold text-base-content text-sm">{s.primaryBank.accountHolderName}</p>
            <p className="text-xs text-base-content/50">{s.primaryBank.bankName} · {s.primaryBank.ifscCode}</p>
            <p className="text-xs text-base-content/40">A/c ending {s.primaryBank.accountNumber?.slice(-4)}</p>
          </motion.div>
        )}
        {s.primaryUpi && (
          <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-2">Primary UPI</p>
            <p className="font-bold text-base-content text-sm">{s.primaryUpi.upiId}</p>
            <p className="text-xs text-base-content/50">{s.primaryUpi.upiName}</p>
          </motion.div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-5">
          <h3 className="font-bold text-sm uppercase tracking-widest text-base-content mb-4">Recent Settlement Amounts</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmt(v), "Settled"]} />
                <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Request Settlement ───────────────────────────────────────────────────────
export function RequestSettlementSection() {
  const dispatch = useDispatch();
  const { settlements, loading, success, errors } = useSelector((s) => s.pharmacyStore);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [note,   setNote]   = useState("");

  useEffect(() => { dispatch(fetchSettlements()); }, [dispatch]);

  useEffect(() => {
    if (success.settlementRequest) {
      setAmount(""); setNote("");
      setTimeout(() => dispatch(clearSuccess("settlementRequest")), 3000);
    }
  }, [success.settlementRequest, dispatch]);

  const pending = settlements?.pendingBalance || 0;
  const amtNum  = parseFloat(amount) || 0;
  const valid   = amtNum > 0 && amtNum <= pending;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    dispatch(requestSettlement({ amount: amtNum, method, note }));
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-black font-montserrat text-base-content">Request Settlement</h2>
        <p className="text-sm text-base-content/50 mt-0.5">Withdraw your pending balance to your bank or UPI</p>
      </motion.div>

      {/* Pending balance card */}
      <motion.div variants={fadeUp}
        className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <CircleDollarSign size={22} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Available to Withdraw</p>
          <p className="text-3xl font-black font-montserrat text-primary">{fmt(pending)}</p>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-2xl p-6 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Amount (₹)" id="amt">
            <input id="amt" type="number" min="1" max={pending} step="0.01"
              className="input-field w-full" placeholder={`Max: ${fmt(pending)}`}
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            {amtNum > pending && amount && (
              <p className="text-xs text-error mt-1">Exceeds pending balance of {fmt(pending)}</p>
            )}
          </FormField>

          <FormField label="Settlement Method" id="meth">
            <select id="meth" className="input-field w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
            </select>
          </FormField>

          <FormField label="Note (optional)" id="note">
            <textarea id="note" className="input-field w-full resize-none" rows={2}
              placeholder="Any remarks for this settlement"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>

          {errors.settlementRequest && (
            <div className="alert alert-error text-sm">{errors.settlementRequest?.message}</div>
          )}
          {success.settlementRequest && (
            <div className="alert alert-success text-sm flex items-center gap-2">
              <CheckCircle2 size={14} /> Settlement request submitted!
            </div>
          )}

          <button type="submit" disabled={!valid || loading.settlementRequest}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-content font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading.settlementRequest ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftRight size={16} />}
            {loading.settlementRequest ? "Processing…" : "Request Settlement"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Settlement History ───────────────────────────────────────────────────────
export function SettlementHistorySection() {
  const dispatch = useDispatch();
  const { settlementHistory, settlementHistoryPagination, loading } = useSelector((s) => s.pharmacyStore);
  useEffect(() => { dispatch(fetchSettlementHistory()); }, [dispatch]);
  if (loading.settlementHistory) return <SectionLoading />;
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black font-montserrat text-base-content">Settlement History</h2>
          <p className="text-sm text-base-content/50 mt-0.5">All past settlement transactions</p>
        </div>
        <button onClick={() => dispatch(fetchSettlementHistory())}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </motion.div>

      {settlementHistory.length === 0 ? (
        <EmptyState message="No settlement history found" />
      ) : (
        <motion.div variants={fadeUp} className="space-y-3">
          {settlementHistory.map((h, i) => (
            <div key={i} className="bg-base-100 border border-base-300 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base-content text-sm">{fmt(h.amount)}</p>
                <p className="text-xs text-base-content/50 truncate">
                  {h.method} · {h.note || "No remarks"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-success">Settled</p>
                <p className="text-xs text-base-content/40 mt-0.5">
                  {new Date(h.settledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          ))}
          {settlementHistoryPagination?.totalPages > 1 && (
            <div className="text-center pt-2">
              <button onClick={() => dispatch(fetchSettlementHistory({ page: (settlementHistoryPagination.currentPage || 1) + 1 }))}
                className="text-sm text-primary hover:underline">
                Load more
              </button>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}