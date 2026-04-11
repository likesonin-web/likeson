"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  CreditCard, Building2, User, MapPin, Hash, Wallet,
  ShieldCheck, AlertCircle, CheckCircle2, Save, Eye, EyeOff,
  ChevronRight, Loader2, Info, Lock, DollarSign, Landmark,
  Phone, Clock, BadgeCheck,
} from "lucide-react";

import {
  fetchPartnerProfile,
  updatePartnerBankDetails,
  fetchPartnerSettings,
  selectPartnerProfile,
  selectLabActionLoading,
  selectLabError,
  selectLabLoading,
} from "@/store/slices/labSlice";

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.07 },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] } },
};

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = 14 }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: "var(--primary)" }} />;
}

/**
 * FieldGroup — wraps a label + input + hint note.
 * `note` is the small inline label shown below the field.
 */
function FieldGroup({ label, hint, note, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1"
        style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
        {label}
        {required && <span style={{ color: "var(--error)" }}>*</span>}
      </label>
      {children}
      {/* Inline note badge */}
      {note && (
        <p className="text-[10px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 w-fit"
          style={{
            background: "color-mix(in oklch, var(--primary), transparent 90%)",
            color: "color-mix(in oklch, var(--primary) 80%, var(--base-content))",
          }}>
          <Info size={9} style={{ flexShrink: 0 }} /> {note}
        </p>
      )}
      {/* Secondary hint in grey */}
      {hint && (
        <p className="text-[10px] flex items-center gap-1"
          style={{ color: "color-mix(in oklch, var(--base-content) 42%, transparent)" }}>
          <Info size={9} style={{ flexShrink: 0 }} /> {hint}
        </p>
      )}
    </div>
  );
}

function InputWithIcon({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon size={13} strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}
        />
      )}
      <input
        {...props}
        className={`input-field w-full text-sm ${Icon ? "pl-9" : ""} ${props.className ?? ""}`}
      />
    </div>
  );
}

function StatusBadge({ verified }) {
  return verified ? (
    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
      style={{
        background: "color-mix(in oklch, var(--success), transparent 84%)",
        color: "var(--success)",
        border: "1px solid color-mix(in oklch, var(--success), transparent 65%)",
      }}>
      <CheckCircle2 size={11} /> Verified by Admin
    </span>
  ) : (
    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
      style={{
        background: "color-mix(in oklch, var(--warning), transparent 84%)",
        color: "var(--warning)",
        border: "1px solid color-mix(in oklch, var(--warning), transparent 65%)",
      }}>
      <Clock size={11} /> Pending Verification
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT HISTORY MOCK  (replace with real BookingLab payout data)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PAYOUTS = [
  { id: "PAY-001", amount: 12500, status: "completed", date: "2026-03-15", period: "Feb 2026" },
  { id: "PAY-002", amount: 9800,  status: "completed", date: "2026-02-15", period: "Jan 2026" },
  { id: "PAY-003", amount: 15200, status: "completed", date: "2026-01-15", period: "Dec 2025" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BankDetailsPage() {
  const dispatch      = useDispatch();
  const profile       = useSelector(selectPartnerProfile);
  const actionLoading = useSelector(selectLabActionLoading);
  const loading       = useSelector(selectLabLoading);
  const error         = useSelector(selectLabError);

  // Form state — mirrors bankDetailsSchema in LabPartnerProfile model
  // accountNumber has select:false in schema; we never pre-fill it from profile
  const [form, setForm] = useState({
    accountHolderName:    "",
    accountNumber:        "",   // sensitive — never pre-populated from API
    confirmAccountNumber: "",   // UI-only confirm field; stripped before dispatch
    ifscCode:             "",
    bankName:             "",
    branchName:           "",
    accountType:          "Current", // enum: ["Savings","Current"]
    upiId:                "",
  });

  const [showAccNo,    setShowAccNo]    = useState(false);
  const [dirty,        setDirty]        = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [ifscLoading,  setIfscLoading]  = useState(false);
  const [ifscData,     setIfscData]     = useState(null);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchPartnerProfile());
    dispatch(fetchPartnerSettings());
  }, [dispatch]);

  // Pre-fill non-sensitive fields when profile loads.
  // accountNumber is intentionally excluded — schema has select:false,
  // so it is never returned by the API.
  useEffect(() => {
    if (profile?.bankDetails) {
      const bd = profile.bankDetails;
      setForm((prev) => ({
        ...prev,
        accountHolderName: bd.accountHolderName ?? "",
        // accountNumber: intentionally NOT pre-filled (select:false in schema)
        ifscCode:          bd.ifscCode          ?? "",
        bankName:          bd.bankName          ?? "",
        branchName:        bd.branchName        ?? "",
        accountType:       bd.accountType       ?? "Current",
        upiId:             bd.upiId             ?? "",
      }));
    }
  }, [profile?.bankDetails]);

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
    setSaved(false);
  };

  // ── IFSC lookup via Razorpay public API ────────────────────────────────────
  const lookupIfsc = useCallback(async (ifsc) => {
    if (ifsc.length !== 11) return;
    setIfscLoading(true);
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setIfscData(data);
        // Auto-fill bankName + branchName from IFSC lookup result
        setForm((prev) => ({
          ...prev,
          bankName:   data.BANK   ?? prev.bankName,
          branchName: data.BRANCH ?? prev.branchName,
        }));
        setDirty(true);
      }
    } catch { /* silent fail — user can still type manually */ }
    finally { setIfscLoading(false); }
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────
  // Strips confirmAccountNumber (UI-only) before sending to the router.
  // Also skips sending accountNumber if the field is blank (user didn't change it).
  // Router PATCH /partner/me/bank-details accepts all bankDetailsSchema fields.
  // On save, isVerified is reset to false server-side (re-verification required).
  const handleSave = useCallback(() => {
    const { confirmAccountNumber, ...payload } = form;

    // If accountNumber is blank, don't send it — keeps existing DB value intact
    if (!payload.accountNumber) {
      delete payload.accountNumber;
    }

    // ifscCode stored uppercase in schema
    if (payload.ifscCode) {
      payload.ifscCode = payload.ifscCode.toUpperCase();
    }

    dispatch(updatePartnerBankDetails(payload)).then((r) => {
      if (!r.error) {
        setDirty(false);
        setSaved(true);
        // Re-fetch to reflect isVerified: false from server
        dispatch(fetchPartnerProfile());
      }
    });
  }, [dispatch, form]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isVerified      = !!profile?.bankDetails?.isVerified;
  const hasDetails      = !!profile?.bankDetails?.accountHolderName;
  const accNumbersMatch = form.accountNumber === form.confirmAccountNumber;
  const canSave         = !actionLoading && (!form.accountNumber || accNumbersMatch);

  const payoutFreq = profile?.payoutFrequency ?? "Monthly";  // enum: Weekly/Bi-weekly/Monthly
  const commission = profile?.commissionRate  ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="lab" className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <div className="container-custom max-w-5xl py-8">

        {/* ── Breadcrumb + title ───────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-2 mb-1"
            style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
            <Link href="/lab-partner/dashboard" className="text-xs hover:underline no-underline">Dashboard</Link>
            <ChevronRight size={12} />
            <Link href="/lab-partner/settings/operational" className="text-xs hover:underline no-underline">Settings</Link>
            <ChevronRight size={12} />
            <span className="text-xs" style={{ color: "var(--primary)" }}>Bank & Payout</span>
          </div>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: "color-mix(in oklch, var(--primary), transparent 84%)" }}>
                <CreditCard size={20} style={{ color: "var(--primary)" }} strokeWidth={2} />
              </div>
              <div>
                <h1 className="font-montserrat font-black text-2xl md:text-3xl"
                  style={{ color: "var(--base-content)" }}>
                  Bank & Payout
                </h1>
                <p className="text-sm" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
                  Manage your bank account and payout preferences
                </p>
              </div>
            </div>
            {hasDetails && <StatusBadge verified={isVerified} />}
          </div>
        </motion.div>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="alert alert-error mb-6 text-sm">
              <AlertCircle size={14} style={{ color: "var(--error)", flexShrink: 0 }} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Success flash ────────────────────────────────────────────── */}
        <AnimatePresence>
          {saved && (
            <motion.div variants={scaleIn} initial="hidden" animate="show" exit="hidden"
              className="alert alert-success mb-6 text-sm">
              <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
              Bank details saved. Admin re-verification has been triggered.
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Summary chips ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Payout Frequency", value: payoutFreq,                     icon: Clock      },
            { label: "Commission Rate",  value: `${commission}%`,               icon: DollarSign },
            { label: "Account Type",     value: form.accountType,               icon: Landmark   },
            { label: "Status",           value: isVerified ? "Verified" : "Pending", icon: ShieldCheck },
          ].map(({ label, value, icon: Icon }, i) => (
            <motion.div key={label} variants={fadeUp} custom={i} initial="hidden" animate="show"
              className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-card-label">{label}</span>
                <Icon size={13} style={{ color: "var(--primary)" }} strokeWidth={2} />
              </div>
              <span className="stat-card-value text-lg">{value}</span>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Main form ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Bank Account Details */}
            <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
              className="card p-0 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b"
                style={{ borderColor: "var(--base-300)", background: "var(--base-200)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in oklch, var(--primary), transparent 84%)" }}>
                  <Building2 size={14} style={{ color: "var(--primary)" }} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm" style={{ color: "var(--base-content)" }}>
                    Bank Account Details
                  </h3>
                  <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                    All data encrypted at rest · Stored in bankDetails subdocument
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-5">

                {/* accountHolderName */}
                <FieldGroup
                  label="Account Holder Name"
                  required
                  note="Must match the name printed on your bank passbook or cheque leaf"
                >
                  <InputWithIcon
                    icon={User}
                    placeholder="e.g. Srinivas Diagnostics Pvt. Ltd."
                    value={form.accountHolderName}
                    onChange={(e) => set("accountHolderName", e.target.value)}
                  />
                </FieldGroup>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  {/* accountNumber — select:false in schema; never pre-filled */}
                  <FieldGroup
                    label="Account Number"
                    note="Stored encrypted · Leave blank to keep existing number unchanged"
                  >
                    <div className="relative">
                      <Lock size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}
                      />
                      <input
                        type={showAccNo ? "text" : "password"}
                        inputMode="numeric"
                        className="input-field w-full text-sm pl-9 pr-10"
                        placeholder="Not shown after saving"
                        value={form.accountNumber}
                        onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))}
                      />
                      <button type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}
                        onClick={() => setShowAccNo((p) => !p)}>
                        {showAccNo ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </FieldGroup>

                  {/* confirmAccountNumber — UI only, stripped before dispatch */}
                  <FieldGroup
                    label="Confirm Account Number"
                    note="UI-only check — not sent to server"
                  >
                    <InputWithIcon
                      icon={Lock}
                      type="password"
                      inputMode="numeric"
                      placeholder="Re-enter to confirm"
                      value={form.confirmAccountNumber}
                      onChange={(e) => set("confirmAccountNumber", e.target.value.replace(/\D/g, ""))}
                      className={
                        form.confirmAccountNumber
                          ? accNumbersMatch
                            ? "border-[var(--success)]"
                            : "border-[var(--error)]"
                          : ""
                      }
                    />
                    {form.confirmAccountNumber && !accNumbersMatch && (
                      <p className="text-xs" style={{ color: "var(--error)" }}>
                        Account numbers do not match
                      </p>
                    )}
                  </FieldGroup>
                </div>

                {/* ifscCode — stored uppercase (schema: uppercase:true) */}
                <FieldGroup
                  label="IFSC Code"
                  required
                  note="11-character code printed on your cheque book · Stored in uppercase"
                >
                  <div className="relative">
                    <Hash size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}
                    />
                    <input
                      className="input-field w-full text-sm pl-9 pr-24 uppercase tracking-widest"
                      placeholder="SBIN0001234"
                      value={form.ifscCode}
                      maxLength={11}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                        set("ifscCode", v);
                        if (v.length === 11) lookupIfsc(v);
                      }}
                    />
                    <button
                      onClick={() => lookupIfsc(form.ifscCode)}
                      disabled={form.ifscCode.length < 11 || ifscLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2.5 py-1 rounded-lg font-semibold transition-all disabled:opacity-40"
                      style={{
                        background: "color-mix(in oklch, var(--primary), transparent 85%)",
                        color: "var(--primary)",
                      }}>
                      {ifscLoading ? <Spinner size={11} /> : "Lookup"}
                    </button>
                  </div>
                  {ifscData && (
                    <motion.div variants={scaleIn} initial="hidden" animate="show"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{
                        background: "color-mix(in oklch, var(--success), transparent 88%)",
                        border: "1px solid color-mix(in oklch, var(--success), transparent 65%)",
                        color: "var(--success)",
                      }}>
                      <CheckCircle2 size={12} />
                      {ifscData.BANK} — {ifscData.BRANCH}, {ifscData.CITY}
                    </motion.div>
                  )}
                </FieldGroup>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  {/* bankName — auto-filled from IFSC lookup */}
                  <FieldGroup
                    label="Bank Name"
                    note="Auto-filled when IFSC is looked up · Can be edited manually"
                  >
                    <InputWithIcon
                      icon={Building2}
                      placeholder="e.g. State Bank of India"
                      value={form.bankName}
                      onChange={(e) => set("bankName", e.target.value)}
                    />
                  </FieldGroup>

                  {/* branchName — auto-filled from IFSC lookup */}
                  <FieldGroup
                    label="Branch Name"
                    note="Auto-filled when IFSC is looked up · Can be edited manually"
                  >
                    <InputWithIcon
                      icon={MapPin}
                      placeholder="e.g. Banjara Hills"
                      value={form.branchName}
                      onChange={(e) => set("branchName", e.target.value)}
                    />
                  </FieldGroup>
                </div>

                {/* accountType — enum: ["Savings","Current"] in schema */}
                <FieldGroup
                  label="Account Type"
                  required
                  note='Schema enum: "Savings" or "Current" — default is Current for lab partners'
                >
                  <div className="flex gap-3">
                    {["Savings", "Current"].map((t) => (
                      <button key={t} onClick={() => set("accountType", t)}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: form.accountType === t
                            ? "var(--bg-gradient-primary)"
                            : "var(--base-200)",
                          color: form.accountType === t
                            ? "var(--primary-content)"
                            : "color-mix(in oklch, var(--base-content) 65%, transparent)",
                          border: `1px solid ${form.accountType === t ? "transparent" : "var(--base-300)"}`,
                          boxShadow: form.accountType === t
                            ? "0 4px 14px color-mix(in oklch, var(--primary), transparent 60%)"
                            : "none",
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              </div>
            </motion.div>

            {/* UPI — optional field in schema */}
            <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show"
              className="card p-0 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b"
                style={{ borderColor: "var(--base-300)", background: "var(--base-200)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in oklch, var(--accent), transparent 84%)" }}>
                  <Wallet size={14} style={{ color: "var(--accent)" }} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm" style={{ color: "var(--base-content)" }}>
                    UPI ID{" "}
                    <span className="text-xs font-medium opacity-60">(Optional)</span>
                  </h3>
                  <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                    Enables faster payouts via UPI transfer
                  </p>
                </div>
              </div>
              <div className="p-6">
                <FieldGroup
                  label="UPI ID"
                  note="Optional · Stored as plain text · Format: handle@bank or mobile@upi"
                  hint="e.g. labname@okaxis or 9876543210@upi"
                >
                  <div className="relative">
                    <Phone size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}
                    />
                    <input
                      className="input-field w-full text-sm pl-9"
                      placeholder="yourlab@okaxis"
                      value={form.upiId}
                      onChange={(e) => set("upiId", e.target.value.trim())}
                    />
                  </div>
                </FieldGroup>
              </div>
            </motion.div>

            {/* Verification reset notice */}
            <motion.div variants={fadeUp} custom={2.5} initial="hidden" animate="show"
              className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "color-mix(in oklch, var(--warning), transparent 90%)",
                border: "1px solid color-mix(in oklch, var(--warning), transparent 68%)",
              }}>
              <AlertCircle size={13} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
              <p className="text-xs leading-relaxed" style={{ color: "color-mix(in oklch, var(--warning) 80%, var(--base-content))" }}>
                <strong>Re-verification notice:</strong> Saving any bank detail sets{" "}
                <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: "color-mix(in oklch, var(--warning), transparent 75%)" }}>isVerified: false</code>{" "}
                server-side. Admin must re-verify before the next payout is processed.
              </p>
            </motion.div>

            {/* Save button */}
            <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show">
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="btn-primary-cta w-full flex items-center justify-center gap-2 py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? <Spinner size={16} /> : <Save size={16} />}
                Save Bank Details
              </button>
              {dirty && !actionLoading && (
                <p className="text-xs text-center mt-2"
                  style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                  You have unsaved changes
                </p>
              )}
            </motion.div>
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Checklist */}
            <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show"
              className="card p-5 space-y-4">
              <h4 className="font-montserrat font-black text-sm" style={{ color: "var(--base-content)" }}>
                Completion Checklist
              </h4>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Account Holder Name", done: !!form.accountHolderName },
                  { label: "IFSC Code (11 chars)", done: form.ifscCode.length === 11 },
                  { label: "Bank & Branch Name",   done: !!form.bankName && !!form.branchName },
                  { label: "Account Type set",     done: !!form.accountType },
                  { label: "Admin Verified",        done: isVerified },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs"
                      style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}>
                      {label}
                    </span>
                    {done ? (
                      <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2"
                        style={{ borderColor: "color-mix(in oklch, var(--base-content), transparent 65%)" }} />
                    )}
                  </div>
                ))}
                <div className="progress-bar mt-1">
                  <div className="progress-bar-fill"
                    style={{
                      width: `${[
                        !!form.accountHolderName,
                        form.ifscCode.length === 11,
                        !!form.bankName && !!form.branchName,
                        !!form.accountType,
                        isVerified,
                      ].filter(Boolean).length * 20}%`,
                    }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Security notice */}
            <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show"
              className="card p-5"
              style={{
                background: "color-mix(in oklch, var(--info), transparent 92%)",
                border: "1px solid color-mix(in oklch, var(--info), transparent 70%)",
              }}>
              <div className="flex gap-2 mb-2">
                <ShieldCheck size={14} style={{ color: "var(--info)", flexShrink: 0, marginTop: 1 }} />
                <h4 className="text-xs font-bold" style={{ color: "var(--info)" }}>Security Notice</h4>
              </div>
              <ul className="space-y-1.5">
                {[
                  "accountNumber stored with select:false — never returned by API",
                  "IFSC always saved in uppercase (schema enforced)",
                  "isVerified resets to false on every save",
                  "Admin must re-verify before payout is processed",
                  "Contact support@likeson.in for disputes",
                ].map((t, i) => (
                  <li key={i}
                    className="flex items-start gap-1.5 text-xs"
                    style={{ color: "color-mix(in oklch, var(--info) 80%, var(--base-content))" }}>
                    <span style={{ marginTop: 3, flexShrink: 0 }}>•</span> {t}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Payout history */}
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show"
              className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "var(--base-300)", background: "var(--base-200)" }}>
                <h4 className="font-montserrat font-black text-sm" style={{ color: "var(--base-content)" }}>
                  Payout History
                </h4>
                <DollarSign size={13} style={{ color: "var(--primary)" }} />
              </div>
              <div className="p-4 space-y-2">
                {MOCK_PAYOUTS.map((p) => (
                  <div key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: "var(--base-200)" }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--base-content)" }}>
                        {p.period}
                      </p>
                      <p className="text-xs"
                        style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                        {p.id} · {new Date(p.date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black" style={{ color: "var(--success)" }}>
                        ₹{p.amount.toLocaleString("en-IN")}
                      </p>
                      <span className="badge badge-success text-[10px]">{p.status}</span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-center pt-1"
                  style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
                  Showing last 3 payouts · Replace with real BookingLab data
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}