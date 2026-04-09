"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchPaymentAccount,
  fetchSettlements,
  fetchSettlementHistory,
  requestSettlement,
  addBankAccount,
  deleteBankAccount,
  addUpiHandle,
  deleteUpiHandle,
  clearSuccess,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  Building2, Smartphone, ArrowDownToLine, Wallet, CreditCard,
  Plus, Trash2, CheckCircle2, Clock, ChevronLeft, ChevronRight,
  IndianRupee, Shield, History, TrendingUp, Landmark, Star,
  X, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

/* ── Variants ────────────────────────────────────── */
const spring  = { type: "spring", stiffness: 270, damping: 22 };
const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: spring } };
const stagger = { hidden: {},                     show: { transition: { staggerChildren: 0.07 } } };

/* ── CSS row animation (table-safe) ─────────────── */
const rowStyle = (i) => ({
  animation: "fadeInRow 0.35s ease both",
  animationDelay: `${i * 0.04}s`,
});

/* ── Finance background ──────────────────────────── */
function FinanceBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* fadeInRow keyframe injected once */}
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <motion.div
        animate={{ opacity: [0.08, 0.16, 0.08], x: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--success), transparent 70%)" }}
      />
      <motion.div
        animate={{ opacity: [0.06, 0.14, 0.06], y: [0, -20, 0] }}
        transition={{ duration: 9, repeat: Infinity, delay: 3 }}
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
      />
    </div>
  );
}

/* ── Balance card (hero) ─────────────────────────── */
function BalanceHero({ settlements }) {
  const pending = settlements?.pendingBalance || 0;
  const earned  = settlements?.totalEarned    || 0;
  const settled = settlements?.totalSettled   || 0;

  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-3xl p-6 text-white"
      style={{
        background:  "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 60%, var(--success) 100%)",
        boxShadow:   "0 20px 60px color-mix(in oklch, var(--primary) 35%, transparent)",
      }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 -translate-y-1/2 translate-x-1/2"
        style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10 translate-y-1/2 -translate-x-1/2"
        style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1 opacity-80">
          <Wallet size={14} />
          <p className="text-xs font-bold uppercase tracking-widest">Pending Balance</p>
        </div>
        <motion.p
          key={pending}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          className="text-4xl font-black font-montserrat mb-1"
        >
          ₹{pending.toLocaleString("en-IN")}
        </motion.p>
        <p className="text-xs opacity-60">Available for settlement</p>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-white/20">
          {[
            { label: "Total Earned",  value: earned,  icon: TrendingUp  },
            { label: "Total Settled", value: settled, icon: CheckCircle2 },
            { label: "Cycle",         value: settlements?.payoutCycle || "Weekly", icon: Clock, isText: true },
          ].map(({ label, value, icon: Icon, isText }) => (
            <div key={label}>
              <Icon size={12} className="opacity-60 mb-1" />
              <p className="text-sm font-black">
                {isText ? value : `₹${(value || 0).toLocaleString("en-IN")}`}
              </p>
              <p className="text-xs opacity-50 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Bank card ───────────────────────────────────── */
function BankCard({ bank, onDelete }) {
  return (
    <motion.div variants={fadeUp} layout className="glass-card p-4 flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/12">
          <Landmark size={16} className="text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm">{bank.bankName || "Bank"}</p>
            {bank.isPrimary && (
              <span
                className="flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "color-mix(in oklch, var(--accent) 15%, var(--base-200))", color: "var(--accent)" }}
              >
                <Star size={9} /> Primary
              </span>
            )}
          </div>
          <p className="text-xs text-base-content/50 font-mono">
            •••• •••• {bank.accountNumber?.slice(-4) || "????"}
          </p>
          <p className="text-xs text-base-content/40">{bank.ifscCode} · {bank.accountType}</p>
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onDelete(bank._id)}
        aria-label={`Delete ${bank.bankName} account`}
        className="p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/10 text-error focus-visible:outline-none"
      >
        <Trash2 size={13} />
      </motion.button>
    </motion.div>
  );
}

/* ── UPI card ────────────────────────────────────── */
function UpiCard({ upi, onDelete }) {
  return (
    <motion.div variants={fadeUp} layout className="glass-card p-4 flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-secondary/12">
          <Smartphone size={16} className="text-secondary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm font-mono">{upi.upiId}</p>
            {upi.isPrimary && (
              <span
                className="flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "color-mix(in oklch, var(--accent) 15%, var(--base-200))", color: "var(--accent)" }}
              >
                <Star size={9} /> Primary
              </span>
            )}
          </div>
          {upi.upiName && <p className="text-xs text-base-content/40">{upi.upiName}</p>}
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onDelete(upi._id)}
        aria-label={`Delete UPI ${upi.upiId}`}
        className="p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/10 text-error focus-visible:outline-none"
      >
        <Trash2 size={13} />
      </motion.button>
    </motion.div>
  );
}

/* ── Add Bank Modal ──────────────────────────────── */
function AddBankModal({ onClose, onAdd, loading }) {
  const [form, setForm] = useState({
    accountHolderName: "", accountNumber: "", ifscCode: "",
    bankName: "", branchName: "", accountType: "Current", isPrimary: false,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 30 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.88, opacity: 0         }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="glass-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15">
              <Landmark size={15} className="text-primary" />
            </div>
            <h3 className="font-black text-base font-montserrat">Add Bank Account</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl hover:bg-base-300 transition-colors focus-visible:outline-none"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          {[
            { key: "accountHolderName", label: "Account Holder Name", placeholder: "Full name"          },
            { key: "accountNumber",     label: "Account Number",       placeholder: "1234 5678 9012"     },
            { key: "ifscCode",          label: "IFSC Code",            placeholder: "SBIN0001234"        },
            { key: "bankName",          label: "Bank Name",            placeholder: "State Bank of India" },
            { key: "branchName",        label: "Branch Name",          placeholder: "MG Road Branch"     },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block mb-1 text-xs font-semibold text-base-content/60">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="input-field w-full text-sm"
              />
            </div>
          ))}

          <div>
            <label className="block mb-1 text-xs font-semibold text-base-content/60">Account Type</label>
            <select
              value={form.accountType}
              onChange={(e) => set("accountType", e.target.value)}
              className="input-field w-full text-sm"
            >
              <option>Current</option>
              <option>Savings</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => set("isPrimary", e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm font-semibold text-base-content/70">Set as primary account</span>
          </label>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          onClick={() => onAdd(form)}
          className="btn-primary-cta w-full mt-5 flex items-center justify-center gap-2"
        >
          {loading ? <span className="spinner w-4 h-4" /> : <><Plus size={14} /> Add Account</>}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ── Request settlement modal ────────────────────── */
function SettlementModal({ maxAmount, onClose, onRequest, loading }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [note,   setNote  ] = useState("");

  const handleSubmit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0 || n > maxAmount) return;
    onRequest({ amount: n, method, note });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 30 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.88, opacity: 0         }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="glass-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-success/15">
              <ArrowDownToLine size={15} className="text-success" />
            </div>
            <h3 className="font-black text-base font-montserrat">Request Settlement</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl hover:bg-base-300 transition-colors focus-visible:outline-none"
          >
            <X size={14} />
          </button>
        </div>

        <div className="bg-base-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <AlertCircle size={14} className="text-info shrink-0" />
          <p className="text-xs text-base-content/60">
            Max available:{" "}
            <strong className="text-success">₹{maxAmount.toLocaleString("en-IN")}</strong>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-base-content/60">Amount (₹)</label>
            <div className="relative">
              <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                max={maxAmount}
                className="input-field w-full pl-8 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map((pct) => (
                <motion.button
                  key={pct}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setAmount(((maxAmount * pct) / 100).toFixed(2))}
                  className="flex-1 py-1 text-xs font-bold bg-base-200 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors"
                >
                  {pct}%
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-base-content/60">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option>Bank Transfer</option>
              <option>UPI</option>
            </select>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-semibold text-base-content/60">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note"
              className="input-field w-full text-sm"
            />
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          disabled={loading || !amount || parseFloat(amount) > maxAmount}
          onClick={handleSubmit}
          className="btn-success w-full mt-5 flex items-center justify-center gap-2"
        >
          {loading
            ? <span className="spinner w-4 h-4" />
            : <><ArrowDownToLine size={14} /> Request Settlement</>}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ── Table skeleton ──────────────────────────────── */
function TableSkeleton({ rows = 5, cols = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="py-4 px-4">
          <div className="skeleton h-4 rounded-lg" />
        </td>
      ))}
    </tr>
  ));
}

/* ── Main ────────────────────────────────────────── */
export default function BankSettlements() {
  const dispatch = useDispatch();
  const {
    paymentAccount,
    settlements,
    settlementHistory,
    settlementHistoryPagination,
    loading,
    success,
  } = useSelector((s) => s.pharmacyStore);

  const [histPage,     setHistPage    ] = useState(1);
  const [showAddBank,  setShowAddBank ] = useState(false);
  const [showUpiForm,  setShowUpiForm ] = useState(false);
  const [showSettle,   setShowSettle  ] = useState(false);
  const [upiId,        setUpiId       ] = useState("");
  const [upiName,      setUpiName     ] = useState("");
  const [activeTab,    setActiveTab   ] = useState("accounts");

  useEffect(() => {
    dispatch(fetchPaymentAccount());
    dispatch(fetchSettlements());
    dispatch(fetchSettlementHistory({ page: histPage }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchSettlementHistory({ page: histPage }));
  }, [histPage, dispatch]);

  /* Close modals on success */
  useEffect(() => {
    if (success.addBankAccount) {
      setShowAddBank(false);
      dispatch(clearSuccess("addBankAccount"));
      dispatch(fetchPaymentAccount());
    }
    if (success.addUpiHandle) {
      setShowUpiForm(false);
      dispatch(clearSuccess("addUpiHandle"));
      dispatch(fetchPaymentAccount());
    }
    if (success.settlementRequest) {
      setShowSettle(false);
      dispatch(clearSuccess("settlementRequest"));
      dispatch(fetchSettlements());
      dispatch(fetchSettlementHistory({ page: 1 }));
    }
  }, [success, dispatch]);

  /* Chart data */
  const histChartData = [...settlementHistory].reverse().slice(0, 12).map((s) => ({
    date:   s.settledAt
      ? new Date(s.settledAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : "—",
    amount: s.amount,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <FinanceBg />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1,  y: 0  }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={15} className="text-success" />
              <span className="text-xs font-black uppercase tracking-widest text-success/70">
                Financial Security
              </span>
            </div>
            <h1 className="section-heading text-3xl lg:text-4xl">
              Bank &amp; <span className="text-gradient-success">Settlements</span>
            </h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowSettle(true)}
            disabled={!(settlements?.pendingBalance > 0)}
            className="btn-success flex items-center gap-2 text-sm px-5 disabled:opacity-40"
          >
            <ArrowDownToLine size={14} /> Request Settlement
          </motion.button>
        </motion.div>

        {/* ── Balance hero ── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6">
          <BalanceHero settlements={settlements} />
        </motion.div>

        {/* ── Settlement trend chart ── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-5 mb-6">
          <p className="font-bold text-sm mb-4 flex items-center gap-2">
            <History size={14} className="text-primary" /> Settlement History Trend
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={histChartData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.4 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--base-200)",
                  border: "1px solid var(--base-300)",
                  borderRadius: 10,
                  fontSize: 11,
                }}
                formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Amount"]}
              />
              <Bar dataKey="amount" radius={[5, 5, 0, 0]} animationDuration={1200}>
                {histChartData.map((_, i) => (
                  <Cell key={i} fill={`oklch(${65 + i * 2}% 0.16 ${150 + i * 5})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 bg-base-200 rounded-xl mb-6 w-fit">
          {[
            { key: "accounts", label: "Payment Accounts", icon: CreditCard },
            { key: "history",  label: "Settlement History", icon: History   },
          ].map(({ key, label, icon: Icon }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === key
                  ? "bg-primary text-primary-content shadow-sm"
                  : "text-base-content/50 hover:bg-base-300"
              }`}
            >
              <Icon size={13} /> {label}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Payment accounts tab ── */}
          {activeTab === "accounts" && (
            <motion.div
              key="accounts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1,  y: 0  }}
              exit={{   opacity: 0, y: -10  }}
            >
              {/* Bank accounts */}
              <div className="glass-card p-5 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-sm flex items-center gap-2">
                    <Building2 size={14} className="text-primary" /> Bank Accounts
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowAddBank(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                  >
                    <Plus size={12} /> Add Bank
                  </motion.button>
                </div>

                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
                  {(paymentAccount?.bankAccounts || []).length === 0 ? (
                    <div className="py-8 text-center text-sm text-base-content/30">
                      No bank accounts added yet
                    </div>
                  ) : (
                    (paymentAccount?.bankAccounts || []).map((b) => (
                      <BankCard
                        key={b._id}
                        bank={b}
                        onDelete={(id) => dispatch(deleteBankAccount(id))}
                      />
                    ))
                  )}
                </motion.div>
              </div>

              {/* UPI handles */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-sm flex items-center gap-2">
                    <Smartphone size={14} className="text-secondary" /> UPI Handles
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setShowUpiForm((x) => !x)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/10 text-secondary text-xs font-bold hover:bg-secondary/20 transition-colors"
                  >
                    <Plus size={12} /> Add UPI
                  </motion.button>
                </div>

                {/* Inline UPI form */}
                <AnimatePresence>
                  {showUpiForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{   opacity: 0, height: 0      }}
                      className="mb-4 overflow-hidden"
                    >
                      <div className="bg-base-200 rounded-xl p-4 flex gap-3 flex-wrap items-end">
                        <div className="flex-1 min-w-40">
                          <label className="block text-xs mb-1 font-semibold text-base-content/60">UPI ID</label>
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="name@upi"
                            className="input-field w-full text-sm py-2"
                          />
                        </div>
                        <div className="flex-1 min-w-36">
                          <label className="block text-xs mb-1 font-semibold text-base-content/60">Display Name</label>
                          <input
                            type="text"
                            value={upiName}
                            onChange={(e) => setUpiName(e.target.value)}
                            placeholder="My UPI"
                            className="input-field w-full text-sm py-2"
                          />
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          disabled={!upiId || loading.upiHandle}
                          onClick={() => dispatch(addUpiHandle({ upiId, upiName }))}
                          className="btn-primary-cta px-4 py-2 text-xs"
                        >
                          {loading.upiHandle ? <span className="spinner w-3 h-3" /> : "Add"}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
                  {(paymentAccount?.upiHandles || []).length === 0 ? (
                    <div className="py-8 text-center text-sm text-base-content/30">
                      No UPI handles added yet
                    </div>
                  ) : (
                    (paymentAccount?.upiHandles || []).map((u) => (
                      <UpiCard
                        key={u._id}
                        upi={u}
                        onDelete={(id) => dispatch(deleteUpiHandle(id))}
                      />
                    ))
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── Settlement history tab ─────────────────────────────────
              FIX: was <motion.tr initial animate transition> which renders
                   as <div>, breaking the table's HTML structure.
                   Fixed: plain <tr> with CSS fadeInRow stagger animation.
          ─────────────────────────────────────────────────────────── */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1,  y: 0  }}
              exit={{   opacity: 0, y: -10  }}
              className="glass-card overflow-hidden"
            >
              <div className="overflow-x-auto">
                {/* plain <table> — NOT motion.table */}
                <table className="w-full" aria-label="Settlement history table">
                  <thead>
                    <tr className="bg-base-200/60">
                      {["Amount", "Method", "Note", "Date", "Status"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-base-content/40"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* plain <tbody> — NOT motion.tbody */}
                  <tbody>
                    {loading.settlementHistory ? (
                      <TableSkeleton rows={5} cols={5} />
                    ) : settlementHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-sm text-base-content/30">
                          No settlement records yet
                        </td>
                      </tr>
                    ) : (
                      /* plain <tr> with CSS animation — NOT motion.tr */
                      settlementHistory.map((s, i) => (
                        <tr
                          key={s._id || i}
                          className="border-b border-base-300/40 hover:bg-success/5 transition-colors"
                          style={rowStyle(i)}
                        >
                          <td className="py-3.5 px-4">
                            <p className="font-black text-success text-sm">
                              ₹{(s.amount || 0).toLocaleString("en-IN")}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="badge badge-info text-xs">{s.method}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-base-content/50 max-w-xs truncate">
                            {s.note || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-base-content/50">
                            {s.settledAt
                              ? new Date(s.settledAt).toLocaleDateString("en-IN", {
                                  day: "2-digit", month: "short", year: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="flex items-center gap-1 text-xs font-bold text-success">
                              <CheckCircle2 size={12} /> Settled
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-base-300/40">
                <p className="text-xs text-base-content/40">
                  {settlementHistory.length} records · Page{" "}
                  <strong className="text-base-content/60">{settlementHistoryPagination.currentPage || 1}</strong>
                </p>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    disabled={histPage <= 1}
                    onClick={() => setHistPage((p) => p - 1)}
                    aria-label="Previous page"
                    className="p-1.5 rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors focus-visible:outline-none"
                  >
                    <ChevronLeft size={14} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    disabled={histPage >= (settlementHistoryPagination.totalPages || 1)}
                    onClick={() => setHistPage((p) => p + 1)}
                    aria-label="Next page"
                    className="p-1.5 rounded-lg border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors focus-visible:outline-none"
                  >
                    <ChevronRight size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddBank && (
          <AddBankModal
            onClose={() => setShowAddBank(false)}
            onAdd={(form) => dispatch(addBankAccount(form))}
            loading={loading.bankAccount}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettle && (
          <SettlementModal
            maxAmount={settlements?.pendingBalance || 0}
            onClose={() => setShowSettle(false)}
            onRequest={(params) => dispatch(requestSettlement(params))}
            loading={loading.settlementRequest}
          />
        )}
      </AnimatePresence>
    </div>
  );
}