"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  Zap,
  ReceiptText,
  Wallet,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Building2,
  Hash,
  RefreshCw,
  Shield,
  Calendar,
  TrendingUp,
  Clock,
  X,
  Eye,
  EyeOff,
  CreditCard,
  Landmark,
  ArrowUpRight,
  Info,
  Loader2,
} from "lucide-react";

import {
  fetchTPBankDetails,
  addTPBankAccount,
  removeTPBankAccount,
  setTPPrimaryBankAccount,
  addTPUpiHandle,
  removeTPUpiHandle,
  updateTPPreferredSettlementMethod,
  updateTPSettlementCycle,
} from "@/store/slices/transportPartnerSlice";

// ─── Tab config ──────────────────────────────────────────────────────────────
const TABS = [
  {
    id: "accounts",
    label: "Bank Accounts",
    path: "/transport-partner/bank/accounts",
    icon: Banknote,
    description: "Manage your bank accounts for settlements",
  },
  {
    id: "upi",
    label: "UPI Handles",
    path: "/transport-partner/bank/upi",
    icon: Zap,
    description: "Add and manage UPI payment handles",
  },
  {
    id: "settlement",
    label: "Settlement Preference",
    path: "/transport-partner/bank/settlement",
    icon: ReceiptText,
    description: "Configure how and when you get paid",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const tab = (pathname) =>
  TABS.find((t) => t.path === pathname)?.id ?? "accounts";

const SETTLEMENT_METHODS = ["Bank Transfer", "UPI", "Cheque"];
const SETTLEMENT_CYCLES = ["Daily", "Weekly", "Bi-Weekly", "Monthly"];

const CYCLE_INFO = {
  Daily:    { color: "text-success", bg: "bg-success/10 border-success/30", icon: "⚡", desc: "Same-day transfers, fastest option" },
  Weekly:   { color: "text-primary", bg: "bg-primary/10 border-primary/30", icon: "📅", desc: "Every 7 days, balanced choice" },
  "Bi-Weekly": { color: "text-accent", bg: "bg-accent/10 border-accent/30", icon: "🗓️", desc: "Twice a month" },
  Monthly:  { color: "text-neutral", bg: "bg-neutral/10 border-neutral/30", icon: "📆", desc: "Monthly lump-sum settlement" },
};

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeSlide = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariant = {
  hidden: { opacity: 0, scale: 0.97, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Reusable Components ─────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-base-content font-montserrat">{title}</h2>
          <p className="text-xs text-base-content/50 mt-0.5">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <motion.div
      variants={fadeSlide}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center mb-4 text-base-content/30">
        <Icon size={28} />
      </div>
      <h3 className="text-base font-semibold text-base-content/60 mb-1">{title}</h3>
      <p className="text-sm text-base-content/40 max-w-xs mb-5">{message}</p>
      {action}
    </motion.div>
  );
}

function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-neutral/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-md bg-base-100 rounded-2xl border border-base-300 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
              <h3 className="font-bold text-base-content font-montserrat">{title}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/40 hover:bg-base-200 hover:text-base-content transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InputField({ label, name, value, onChange, type = "text", placeholder, icon: Icon, required, hint }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30">
            <Icon size={14} />
          </div>
        )}
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`input-field w-full ${Icon ? "pl-9" : ""} ${isPassword ? "pr-9" : ""} text-sm`}
          required={required}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-base-content/40">{hint}</p>}
    </div>
  );
}

// ─── TAB: Bank Accounts ───────────────────────────────────────────────────────
function BankAccountsTab({ bankDetails, loading, dispatch }) {
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    branchName: "",
    accountType: "Current",
    isPrimary: false,
  });

  const accounts = bankDetails?.bankAccounts ?? [];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await dispatch(addTPBankAccount(form));
    await dispatch(fetchTPBankDetails());
    setSubmitting(false);
    setShowModal(false);
    setForm({ accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", branchName: "", accountType: "Current", isPrimary: false });
  };

  const handleRemove = async (id) => {
    if (!confirm("Remove this bank account?")) return;
    await dispatch(removeTPBankAccount(id));
    dispatch(fetchTPBankDetails());
  };

  const handleSetPrimary = async (id) => {
    await dispatch(setTPPrimaryBankAccount(id));
    dispatch(fetchTPBankDetails());
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
      <SectionHeader
        icon={Landmark}
        title="Bank Accounts"
        description="Add bank accounts for receiving settlements"
        action={
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="btn-primary-cta flex items-center gap-2 text-xs py-2 px-4"
          >
            <Plus size={14} />
            Add Account
          </motion.button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <EmptyState
          icon={Landmark}
          title="No bank accounts yet"
          message="Add a bank account to receive your settlements directly."
          action={
            <button onClick={() => setShowModal(true)} className="btn-secondary text-xs py-2 px-4">
              + Add your first account
            </button>
          }
        />
      )}

      <div className="grid gap-3">
        {accounts.map((acc, i) => (
          <motion.div key={acc._id} variants={cardVariant} className="card p-5 group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${acc.isPrimary ? "bg-primary/15 text-primary border border-primary/30" : "bg-base-200 text-base-content/40 border border-base-300"}`}>
                  <Landmark size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-base-content">{acc.bankName || "Bank Account"}</span>
                    {acc.isPrimary && (
                      <span className="badge badge-primary text-[10px] px-2 py-0.5">Primary</span>
                    )}
                    {acc.isVerified && (
                      <CheckCircle2 size={12} className="text-success" />
                    )}
                  </div>
                  <p className="text-xs text-base-content/50 mt-0.5">{acc.accountHolderName}</p>
                  <p className="text-xs text-base-content/40 font-mono mt-0.5">
                    •••• •••• {acc.accountLast4 || "????"}
                    <span className="ml-2 text-base-content/30 font-sans">{acc.accountType}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {!acc.isPrimary && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSetPrimary(acc._id)}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1"
                  >
                    <Star size={10} />
                    Set Primary
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRemove(acc._id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-error/60 hover:bg-error/10 hover:text-error border border-transparent hover:border-error/20 transition-colors"
                >
                  <Trash2 size={13} />
                </motion.button>
              </div>
            </div>

            {acc.ifscCode && (
              <div className="mt-3 pt-3 border-t border-base-300 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-base-content/40">
                  <Hash size={10} />
                  <span className="font-mono">{acc.ifscCode}</span>
                </div>
                {acc.branchName && (
                  <div className="flex items-center gap-1.5 text-xs text-base-content/40">
                    <Building2 size={10} />
                    <span>{acc.branchName}</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary card */}
      {accounts.length > 0 && (
        <motion.div variants={cardVariant} className="rounded-xl bg-primary/5 border border-primary/15 p-4 flex items-center gap-3">
          <Shield size={16} className="text-primary" />
          <p className="text-xs text-base-content/60">
            Your bank details are encrypted and secured. Only the last 4 digits are displayed.
          </p>
        </motion.div>
      )}

      {/* Add Account Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Bank Account">
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField label="Account Holder Name" name="accountHolderName" value={form.accountHolderName} onChange={handleChange} icon={CreditCard} placeholder="Full legal name" required />
          <InputField label="Account Number" name="accountNumber" value={form.accountNumber} onChange={handleChange} icon={Hash} placeholder="Enter account number" type="password" required hint="Will be masked after saving" />
          <InputField label="IFSC Code" name="ifscCode" value={form.ifscCode} onChange={handleChange} icon={Building2} placeholder="e.g. HDFC0001234" required />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Bank Name" name="bankName" value={form.bankName} onChange={handleChange} placeholder="e.g. HDFC Bank" />
            <InputField label="Branch Name" name="branchName" value={form.branchName} onChange={handleChange} placeholder="Branch name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">Account Type</label>
            <select name="accountType" value={form.accountType} onChange={handleChange} className="input-field text-sm">
              {["Savings", "Current", "OD"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-base-200 border border-base-300 hover:border-primary/30 transition-colors">
            <input type="checkbox" name="isPrimary" checked={form.isPrimary} onChange={handleChange} className="w-4 h-4 rounded accent-primary" />
            <div>
              <span className="text-sm font-semibold text-base-content">Set as primary account</span>
              <p className="text-xs text-base-content/40">Settlements will be sent to this account</p>
            </div>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancel</button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="btn-primary-cta flex-1 text-sm py-2.5 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {submitting ? "Saving…" : "Add Account"}
            </motion.button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}

// ─── TAB: UPI Handles ─────────────────────────────────────────────────────────
function UpiHandlesTab({ bankDetails, loading, dispatch }) {
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ upiId: "", upiName: "", isPrimary: false });

  const handles = bankDetails?.upiHandles ?? [];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await dispatch(addTPUpiHandle(form));
    await dispatch(fetchTPBankDetails());
    setSubmitting(false);
    setShowModal(false);
    setForm({ upiId: "", upiName: "", isPrimary: false });
  };

  const handleRemove = async (id) => {
    if (!confirm("Remove this UPI handle?")) return;
    await dispatch(removeTPUpiHandle(id));
    dispatch(fetchTPBankDetails());
  };

  // UPI provider icon
  const getUpiIcon = (upiId = "") => {
    const lower = upiId.toLowerCase();
    if (lower.includes("paytm"))  return "🟦";
    if (lower.includes("gpay") || lower.includes("okaxis") || lower.includes("okicici")) return "🟩";
    if (lower.includes("phonepe") || lower.includes("ybl")) return "🟪";
    if (lower.includes("upi"))   return "🔷";
    return "⚡";
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
      <SectionHeader
        icon={Zap}
        title="UPI Handles"
        description="Receive instant payments via UPI"
        action={
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="btn-primary-cta flex items-center gap-2 text-xs py-2 px-4"
          >
            <Plus size={14} />
            Add UPI
          </motion.button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && handles.length === 0 && (
        <EmptyState
          icon={Zap}
          title="No UPI handles added"
          message="Add a UPI ID to accept instant settlements from Likeson."
          action={
            <button onClick={() => setShowModal(true)} className="btn-secondary text-xs py-2 px-4">
              + Add UPI Handle
            </button>
          }
        />
      )}

      <div className="grid gap-3">
        {handles.map((h) => (
          <motion.div key={h._id} variants={cardVariant} className="card p-4 group">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center text-xl">
                  {getUpiIcon(h.upiId)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-base-content font-mono">{h.upiId}</span>
                    {h.isPrimary && <span className="badge badge-primary text-[10px] px-2">Primary</span>}
                    {h.isVerified && <CheckCircle2 size={12} className="text-success" />}
                  </div>
                  {h.upiName && <p className="text-xs text-base-content/50 mt-0.5">{h.upiName}</p>}
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleRemove(h._id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-error/50 hover:bg-error/10 hover:text-error border border-transparent hover:border-error/20 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* UPI Info callout */}
      <motion.div variants={cardVariant} className="rounded-xl bg-accent/5 border border-accent/15 p-4 flex items-start gap-3">
        <Info size={14} className="text-accent mt-0.5 shrink-0" />
        <div className="text-xs text-base-content/60 space-y-0.5">
          <p className="font-semibold text-base-content/70">UPI Settlement Rules</p>
          <p>UPI settlements are typically processed within 30 minutes. Maximum ₹2 lakh per transaction.</p>
        </div>
      </motion.div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add UPI Handle">
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="UPI ID"
            name="upiId"
            value={form.upiId}
            onChange={handleChange}
            icon={Zap}
            placeholder="yourname@bankname"
            required
            hint="Example: business@hdfcbank, merchant@paytm"
          />
          <InputField
            label="UPI Name (optional)"
            name="upiName"
            value={form.upiName}
            onChange={handleChange}
            icon={CreditCard}
            placeholder="Display name for this UPI"
          />
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-base-200 border border-base-300 hover:border-primary/30 transition-colors">
            <input type="checkbox" name="isPrimary" checked={form.isPrimary} onChange={handleChange} className="w-4 h-4 rounded accent-primary" />
            <div>
              <span className="text-sm font-semibold text-base-content">Set as primary UPI</span>
              <p className="text-xs text-base-content/40">Preferred for instant settlements</p>
            </div>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancel</button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="btn-primary-cta flex-1 text-sm py-2.5 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {submitting ? "Adding…" : "Add UPI"}
            </motion.button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}

// ─── TAB: Settlement Preference ───────────────────────────────────────────────
function SettlementPreferenceTab({ bankDetails, dispatch }) {
  const [savingMethod, setSavingMethod] = useState(false);
  const [savingCycle, setSavingCycle] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(bankDetails?.preferredSettlementMethod ?? "Bank Transfer");
  const [selectedCycle, setSelectedCycle] = useState("Weekly");

  useEffect(() => {
    if (bankDetails?.preferredSettlementMethod) {
      setSelectedMethod(bankDetails.preferredSettlementMethod);
    }
  }, [bankDetails]);

  const handleMethodSave = async () => {
    setSavingMethod(true);
    await dispatch(updateTPPreferredSettlementMethod({ method: selectedMethod }));
    setSavingMethod(false);
  };

  const handleCycleSave = async () => {
    setSavingCycle(true);
    await dispatch(updateTPSettlementCycle({ settlementCycle: selectedCycle }));
    setSavingCycle(false);
  };

  const pendingAmount = bankDetails?.pendingSettlementAmount ?? 0;
  const totalSettled  = bankDetails?.totalSettledAmount ?? 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <SectionHeader
        icon={ReceiptText}
        title="Settlement Preference"
        description="Choose how and when you receive your earnings"
      />

      {/* Balance overview */}
      <motion.div variants={cardVariant} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Pending</span>
          </div>
          <p className="text-3xl font-black text-base-content font-montserrat">
            ₹{pendingAmount.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-base-content/50 mt-1">Awaiting next settlement</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-success/10 to-accent/10 border border-success/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-success" />
            <span className="text-xs font-semibold text-success uppercase tracking-wider">Total Settled</span>
          </div>
          <p className="text-3xl font-black text-base-content font-montserrat">
            ₹{totalSettled.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-base-content/50 mt-1">All-time settlements received</p>
        </div>
      </motion.div>

      {/* Settlement Method */}
      <motion.div variants={cardVariant} className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={15} className="text-primary" />
          <h3 className="text-sm font-bold text-base-content">Payment Method</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SETTLEMENT_METHODS.map((m) => (
            <motion.button
              key={m}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedMethod(m)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                selectedMethod === m
                  ? "border-primary bg-primary/10"
                  : "border-base-300 bg-base-200 hover:border-primary/40"
              }`}
            >
              <div className="text-lg mb-1">
                {m === "Bank Transfer" ? "🏦" : m === "UPI" ? "⚡" : "📄"}
              </div>
              <div className={`text-sm font-bold ${selectedMethod === m ? "text-primary" : "text-base-content"}`}>{m}</div>
              <div className="text-[11px] text-base-content/40 mt-0.5">
                {m === "Bank Transfer" ? "1–3 business days" : m === "UPI" ? "Instant" : "5–7 days"}
              </div>
              {selectedMethod === m && (
                <div className="mt-2">
                  <CheckCircle2 size={14} className="text-primary" />
                </div>
              )}
            </motion.button>
          ))}
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleMethodSave}
          disabled={savingMethod}
          className="btn-primary-cta text-xs py-2.5 px-5 flex items-center gap-2"
        >
          {savingMethod ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          {savingMethod ? "Saving…" : "Save Method"}
        </motion.button>
      </motion.div>

      {/* Settlement Cycle */}
      <motion.div variants={cardVariant} className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={15} className="text-primary" />
          <h3 className="text-sm font-bold text-base-content">Settlement Cycle</h3>
          <span className="ml-auto badge badge-info text-[10px] px-2">How often</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SETTLEMENT_CYCLES.map((c) => {
            const info = CYCLE_INFO[c];
            return (
              <motion.button
                key={c}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedCycle(c)}
                className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                  selectedCycle === c ? `border-current ${info.bg}` : "border-base-300 bg-base-200 hover:border-base-content/20"
                }`}
              >
                <div className="text-lg mb-1">{info.icon}</div>
                <div className={`text-xs font-bold ${selectedCycle === c ? info.color : "text-base-content"}`}>{c}</div>
                <div className="text-[10px] text-base-content/40 mt-0.5 leading-tight">{info.desc}</div>
              </motion.button>
            );
          })}
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-base-200 border border-base-300">
          <AlertCircle size={13} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-base-content/60">
            Changing your cycle will take effect from the next billing period. Current pending amount remains unaffected.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleCycleSave}
          disabled={savingCycle}
          className="btn-primary-cta text-xs py-2.5 px-5 flex items-center gap-2"
        >
          {savingCycle ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {savingCycle ? "Saving…" : "Save Cycle"}
        </motion.button>
      </motion.div>

      {/* Last settled info */}
      {bankDetails?.lastSettledAt && (
        <motion.div variants={cardVariant} className="rounded-xl border border-base-300 bg-base-200 px-4 py-3 flex items-center gap-3">
          <ArrowUpRight size={14} className="text-success" />
          <p className="text-xs text-base-content/60">
            Last settlement on{" "}
            <span className="font-semibold text-base-content">
              {new Date(bankDetails.lastSettledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BankManagement() {
  const dispatch  = useDispatch();
  const router    = useRouter();
  const pathname  = usePathname();

  const { bankDetails, loading } = useSelector((s) => s.transportPartner);
  const activeTab = tab(pathname);

  useEffect(() => {
    dispatch(fetchTPBankDetails());
  }, [dispatch]);

  const navigate = (path) => router.push(path);

  return (
    <div className="min-h-screen bg-base-100">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-6 pt-8 pb-0"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Wallet size={17} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-base-content font-montserrat">Bank & Settlement</h1>
            <p className="text-xs text-base-content/45">Manage your payout methods and settlement schedule</p>
          </div>
        </div>
      </motion.div>

      {/* Tab Bar */}
      <div className="sticky top-0 z-20 bg-base-100/95 backdrop-blur-md border-b border-base-300 mt-6 px-6">
        <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => navigate(t.path)}
                whileHover={{ y: -1 }}
                className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-200 ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-base-content/50 hover:text-base-content hover:border-base-300"
                }`}
              >
                <Icon size={15} />
                {t.label}
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 max-w-3xl">
        <AnimatePresence mode="wait">
          {activeTab === "accounts" && (
            <motion.div key="accounts" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
              <BankAccountsTab bankDetails={bankDetails} loading={loading} dispatch={dispatch} />
            </motion.div>
          )}
          {activeTab === "upi" && (
            <motion.div key="upi" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
              <UpiHandlesTab bankDetails={bankDetails} loading={loading} dispatch={dispatch} />
            </motion.div>
          )}
          {activeTab === "settlement" && (
            <motion.div key="settlement" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
              <SettlementPreferenceTab bankDetails={bankDetails} dispatch={dispatch} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}