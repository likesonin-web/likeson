"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, Truck, Pill, Microscope, UserCheck, Home,
  Shield, Users, HeartPulse, Globe, Crown, Layers,
  BadgeCheck, RefreshCw, X, Clock, ChevronDown, ChevronUp,
  Gift, CreditCard, AlertCircle, CheckCircle2, ArrowRight,
  Zap, Activity, Calendar, TrendingUp, Info,
} from "lucide-react";

import {
  fetchMySubscription,
  fetchMySubscriptionHistory,
  fetchTrialStatus,
  cancelSubscription,
  toggleAutoRenew,
  initiateTrialConversion,
  verifyTrialConversion,
  optimisticToggleAutoRenew,
  clearTrialOrder,
  selectMySubscription,
  selectMySubIsActive,
  selectMySubIsOnTrial,
  selectMySubAutoRenew,
  selectMySubLoading,
  selectMyHistory,
  selectMyHistoryPagination,
  selectMyHistoryLoading,
  selectCancelLoading,
  selectToggleAutoRenewLoading,
  selectTrialStatus,
  selectIsOnActiveTrial,
  selectTrialDaysLeft,
  selectTrialStatusLoading,
  selectTrialOrder,
  selectTrialConvertLoading,
  selectTrialVerifyConvertLoading,
} from "@/store/slices/subscriptionSlice";

// ─────────────────────────────────────────────────────────────────────────────
//  DESIGN TOKENS  (same as SubscriptionPage)
// ─────────────────────────────────────────────────────────────────────────────
const TIER = {
  "Basic Care": {
    gradient:  "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)",
    accent:    "#3b82f6",
    glow:      "rgba(59,130,246,0.35)",
    icon:      Shield,
    patternId: "zigzag",
  },
  "Premium Care": {
    gradient:  "linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)",
    accent:    "#8b5cf6",
    glow:      "rgba(139,92,246,0.4)",
    icon:      Crown,
    patternId: "diamonds",
  },
  "Family Care": {
    gradient:  "linear-gradient(135deg,#10b981 0%,#059669 100%)",
    accent:    "#10b981",
    glow:      "rgba(16,185,129,0.35)",
    icon:      Users,
    patternId: "circles",
  },
  "Pregnant Women Care": {
    gradient:  "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    accent:    "#f59e0b",
    glow:      "rgba(245,158,11,0.35)",
    icon:      HeartPulse,
    patternId: "hearts",
  },
  "NRI's Care": {
    gradient:  "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
    accent:    "#ef4444",
    glow:      "rgba(239,68,68,0.35)",
    icon:      Globe,
    patternId: "grid",
  },
};

const CUSTOM_TIER = {
  gradient:  "linear-gradient(135deg,#0ea5e9 0%,#7c3aed 100%)",
  accent:    "#0ea5e9",
  glow:      "rgba(14,165,233,0.35)",
  icon:      Layers,
  patternId: "waves",
};

const getTier = (name) => TIER[name] || CUSTOM_TIER;

// ─────────────────────────────────────────────────────────────────────────────
//  SVG PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
const PATTERNS = {
  zigzag:   (id) => <pattern id={id} x="0" y="0" width="24" height="12" patternUnits="userSpaceOnUse"><polyline points="0,12 6,0 12,12 18,0 24,12" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></pattern>,
  diamonds: (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="white" strokeWidth="1" /></pattern>,
  circles:  (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="0.9" /></pattern>,
  hearts:   (id) => <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12,20 C12,20 3,13 3,7.5 C3,5 5,3 7.5,3 C9.24,3 10.91,4.1 12,5.5 C13.09,4.1 14.76,3 16.5,3 C19,3 21,5 21,7.5 C21,13 12,20 12,20Z" fill="none" stroke="white" strokeWidth="0.9" /></pattern>,
  grid:     (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0L0 0 0 20" fill="none" stroke="white" strokeWidth="0.7" /></pattern>,
  waves:    (id) => <pattern id={id} x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse"><path d="M0,8 Q8,0 16,8 Q24,16 32,8" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" /></pattern>,
};

function PlanPattern({ patternId, planName }) {
  const uid = `mysub-pat-${patternId}-${planName?.replace(/[\s']/g, "")}`;
  const PatternFn = PATTERNS[patternId] || PATTERNS.grid;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.1 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>{PatternFn(uid)}</defs>
        <rect width="100%" height="100%" fill={`url(#${uid})`} />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RAZORPAY LOADER
// ─────────────────────────────────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAT CHIP
// ─────────────────────────────────────────────────────────────────────────────
function StatChip({ icon: Icon, label, value, accent, warn = false }) {
  return (
    <div className="flex flex-col items-center py-4 px-2 gap-1">
      <Icon size={14} style={{ color: warn ? "#ef4444" : accent }} />
      <span className="text-base font-black leading-none" style={{ color: warn ? "#ef4444" : "var(--base-content)" }}>
        {value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ opacity: 0.4 }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACTIVE PLAN HERO CARD
// ─────────────────────────────────────────────────────────────────────────────
function ActivePlanHeroCard({ sub, t, TIcon, daysLeft, isExpiring, progress, expiry }) {
  const name = sub.plan?.fixedTier || sub.plan?.name || "Unknown Plan";
  const monthly = sub.plan?.pricing?.monthly ?? 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "var(--base-100)",
        border: `2px solid ${t.accent}`,
        boxShadow: `0 12px 48px ${t.glow}`,
      }}
    >
      {/* ── Gradient Header ── */}
      <div className="relative overflow-hidden" style={{ background: t.gradient, minHeight: 160 }}>
        <PlanPattern patternId={t.patternId} planName={name} />

        {/* Rotating circles */}
        <motion.div
          animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute -right-12 -top-12 w-44 h-44 rounded-full pointer-events-none"
          style={{ border: "28px solid rgba(255,255,255,0.07)" }}
        />
        <motion.div
          animate={{ rotate: -360 }} transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          className="absolute -right-4 top-8 w-20 h-20 rounded-full pointer-events-none"
          style={{ border: "12px solid rgba(255,255,255,0.06)" }}
        />
        {/* Glow bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.15), transparent)" }} />

        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Status badge */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black"
                  style={{
                    background: sub.status === "Trial" ? "rgba(245,158,11,.3)" : "rgba(255,255,255,0.2)",
                    color: "white",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {sub.status === "Trial" ? <Gift size={10} /> : <BadgeCheck size={10} />}
                  {sub.status === "Trial" ? "Free Trial Active" : "Active Subscription"}
                </span>
                {sub.autoRenew && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black"
                    style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
                    <RefreshCw size={9} /> Auto-renew On
                  </span>
                )}
              </div>

              {/* Plan name */}
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
                  <TIcon size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white leading-tight">{name}</h2>
                  <p className="text-white/55 text-xs mt-0.5">
                    {sub.plan?.membership?.maxMembers === 1 ? "Individual plan" : `Up to ${sub.plan?.membership?.maxMembers} members`}
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] text-white/40 uppercase font-bold mb-0.5">Monthly</p>
              <p className="text-3xl font-black text-white leading-none">₹{monthly}</p>
              {sub.status === "Trial" && (
                <p className="text-[10px] text-white/60 mt-1 font-bold">Free for now</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 divide-x" style={{ borderBottom: "1px solid var(--base-300)" }}>
        <StatChip icon={Clock}     label="Days Left"   value={daysLeft}                                   accent={t.accent} warn={isExpiring} />
        <StatChip icon={Users}     label="Members"     value={sub.plan?.membership?.maxMembers ?? 1}       accent={t.accent} />
        <StatChip icon={Calendar}  label="Renews"      value={expiry ? expiry.toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—"} accent={t.accent} />
      </div>

      {/* ── Progress bar ── */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center justify-between text-[10px] font-bold mb-2" style={{ opacity: 0.5 }}>
          <span className="flex items-center gap-1"><TrendingUp size={10} /> Billing period</span>
          <span>{expiry ? expiry.toLocaleDateString("en-IN") : "—"}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--base-300)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: isExpiring ? "#ef4444" : t.gradient }}
          />
        </div>
        {isExpiring && (
          <motion.p
            animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="text-[10px] font-bold mt-2 flex items-center gap-1"
            style={{ color: "#ef4444" }}
          >
            <AlertCircle size={10} /> Expiring soon — renew to avoid interruption
          </motion.p>
        )}
      </div>

      {/* ── Plan benefits preview ── */}
      <div className="px-6 py-4">
        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>Your Benefits</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Stethoscope, label: "Consultations", value: sub.plan?.consultations?.freePerMonth === -1 ? "Unlimited" : `${sub.plan?.consultations?.freePerMonth ?? 0}/mo` },
            { icon: Pill,        label: "Pharmacy",       value: `Up to ${sub.plan?.pharmacy?.discountMax ?? 0}% off` },
            { icon: Microscope,  label: "Diagnostics",    value: `${sub.plan?.diagnostics?.discountPercent ?? 0}% off` },
            { icon: Truck,       label: "Transport",      value: sub.plan?.transport?.isApplicable ? `₹${sub.plan?.transport?.ratePerKm ?? 0}/km` : "N/A" },
            { icon: UserCheck,   label: "Care Assistant", value: sub.plan?.careAssistant?.included ? "Included" : "Not included" },
            { icon: Home,        label: "Home Lab",       value: sub.plan?.diagnostics?.homeSampleCollection ? "Available" : "N/A" },
          ].map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-2 p-2.5 rounded-xl"
              style={{ background: `${t.accent}08`, border: `1px solid ${t.accent}18` }}
            >
              <b.icon size={12} style={{ color: t.accent, flexShrink: 0 }} />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wide" style={{ opacity: 0.45 }}>{b.label}</p>
                <p className="text-[11px] font-black truncate">{b.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACTION BUTTONS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ActionPanel({ sub, t, onToggleAutoRenew, onCancel, onConvertTrial, cancelLoading, toggleLoading, trialConvertLoading }) {
  return (
    <div className="space-y-3">
      {/* Convert trial CTA */}
      {sub.status === "Trial" && (
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onConvertTrial}
          disabled={trialConvertLoading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black text-white relative overflow-hidden"
          style={{ background: t.gradient, boxShadow: `0 6px 24px ${t.glow}` }}
        >
          {/* Shimmer */}
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
            className="absolute inset-y-0 w-1/3 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)" }}
          />
          {trialConvertLoading ? <RefreshCw size={15} className="animate-spin" /> : <CreditCard size={15} />}
          Convert to Paid — ₹{sub.plan?.pricing?.monthly ?? 0}/month
        </motion.button>
      )}

      {/* Auto-renew toggle */}
      <button
        onClick={onToggleAutoRenew}
        disabled={toggleLoading}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all"
        style={{
          background: sub.autoRenew ? `${t.accent}10` : "var(--base-200)",
          border: sub.autoRenew ? `1.5px solid ${t.accent}35` : "1.5px solid var(--base-300)",
          color: sub.autoRenew ? t.accent : "var(--base-content)",
        }}
      >
        <div className="flex items-center gap-3">
          {toggleLoading
            ? <RefreshCw size={16} className="animate-spin" />
            : <RefreshCw size={16} style={{ color: sub.autoRenew ? t.accent : "inherit" }} />
          }
          <div className="text-left">
            <p className="text-sm font-black">Auto-Renew</p>
            <p className="text-[10px] font-semibold" style={{ opacity: 0.5 }}>
              {sub.autoRenew ? "Your plan renews automatically" : "Your plan won't auto-renew"}
            </p>
          </div>
        </div>
        {/* Toggle pill */}
        <div
          className="relative rounded-full flex-shrink-0 transition-colors duration-300"
          style={{ width: 48, height: 26, background: sub.autoRenew ? t.accent : "var(--base-300)" }}
        >
          <motion.div
            animate={{ x: sub.autoRenew ? 24 : 2 }}
            transition={{ duration: 0.25, type: "spring", stiffness: 400, damping: 25 }}
            className="absolute top-[3px] w-5 h-5 rounded-full shadow-md"
            style={{ background: "white" }}
          />
        </div>
      </button>

      {/* Cancel */}
      <button
        onClick={onCancel}
        disabled={cancelLoading}
        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold transition-all"
        style={{ background: "rgba(239,68,68,.06)", color: "#ef4444", border: "1.5px solid rgba(239,68,68,.2)" }}
      >
        {cancelLoading ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
        Cancel Subscription
      </button>

      <p className="text-[10px] font-semibold text-center" style={{ opacity: 0.35 }}>
        <Info size={9} className="inline mr-1" />
        You'll retain access until {new Date(sub.expiryDate).toLocaleDateString("en-IN")}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HISTORY LIST
// ─────────────────────────────────────────────────────────────────────────────
function SubscriptionHistory({ history, pagination, loading, onPageChange }) {
  if (loading && history.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw size={18} className="animate-spin" style={{ opacity: 0.35 }} />
      </div>
    );
  }
  if (history.length === 0) return (
    <p className="text-center text-xs font-semibold py-6" style={{ opacity: 0.4 }}>No history yet</p>
  );

  const STATUS_COLORS = { Active: "#10b981", Trial: "#f59e0b", Cancelled: "#6b7280", Expired: "#ef4444" };

  return (
    <div className="space-y-2">
      {history.map((h, i) => {
        const name = h.plan?.fixedTier || h.plan?.name || "Plan";
        const t    = getTier(name);
        const statusColor = STATUS_COLORS[h.status] || "#6b7280";
        return (
          <motion.div
            key={h._id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-3.5 rounded-xl"
            style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: t.gradient }}>
              <t.icon size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{name}</p>
              <p className="text-[10px] font-semibold" style={{ opacity: 0.4 }}>
                {h.createdAt ? new Date(h.createdAt).toLocaleDateString("en-IN") : "—"}
                {" → "}
                {h.expiryDate ? new Date(h.expiryDate).toLocaleDateString("en-IN") : "—"}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[10px] font-black px-2 py-1 rounded-full"
                style={{ background: `${statusColor}15`, color: statusColor }}>
                {h.status}
              </span>
              {h.plan?.pricing?.monthly && (
                <p className="text-[10px] font-bold mt-0.5" style={{ opacity: 0.4 }}>₹{h.plan.pricing.monthly}/mo</p>
              )}
            </div>
          </motion.div>
        );
      })}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <button onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: "var(--base-200)", opacity: pagination.page === 1 ? 0.4 : 1 }}>
            ‹ Prev
          </button>
          <span className="px-3 py-1.5 text-xs font-black" style={{ opacity: 0.5 }}>
            {pagination.page} / {pagination.pages}
          </span>
          <button onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
            disabled={pagination.page === pagination.pages}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: "var(--base-200)", opacity: pagination.page === pagination.pages ? 0.4 : 1 }}>
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  EMPTY STATE — no active subscription
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", boxShadow: "0 16px 40px rgba(139,92,246,0.3)" }}
      >
        <HeartPulse size={32} className="text-white" />
      </motion.div>
      <div>
        <h2 className="text-xl font-black mb-1">No Active Subscription</h2>
        <p className="text-sm" style={{ opacity: 0.45 }}>You don't have an active health plan yet.</p>
      </div>
      <motion.a
        href="/subscriptions"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black text-white"
        style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", boxShadow: "0 6px 24px rgba(139,92,246,0.35)" }}
      >
        <Zap size={15} /> Browse Plans
      </motion.a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function MySubscriptionPage() {
  const dispatch = useDispatch();

  const mySub          = useSelector(selectMySubscription);
  const isActive       = useSelector(selectMySubIsActive);
  const isOnTrial      = useSelector(selectMySubIsOnTrial);
  const autoRenew      = useSelector(selectMySubAutoRenew);
  const subLoading     = useSelector(selectMySubLoading);
  const cancelLoading  = useSelector(selectCancelLoading);
  const toggleLoading  = useSelector(selectToggleAutoRenewLoading);

  const history        = useSelector(selectMyHistory);
  const historyPag     = useSelector(selectMyHistoryPagination);
  const historyLoading = useSelector(selectMyHistoryLoading);

  const trialStatus          = useSelector(selectTrialStatus);
  const isOnActiveTrial      = useSelector(selectIsOnActiveTrial);
  const trialDaysLeft        = useSelector(selectTrialDaysLeft);
  const trialOrder           = useSelector(selectTrialOrder);
  const trialConvertLoading  = useSelector(selectTrialConvertLoading);
  const trialVerifyLoading   = useSelector(selectTrialVerifyConvertLoading);

  const [showHistory, setShowHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    dispatch(fetchMySubscription());
    dispatch(fetchTrialStatus());
  }, [dispatch]);

  useEffect(() => {
    if (showHistory) dispatch(fetchMySubscriptionHistory({ page: historyPage, limit: 6 }));
  }, [showHistory, historyPage, dispatch]);

  // Trial Razorpay conversion
  useEffect(() => {
    if (trialOrder?.orderId) {
      (async () => {
        const loaded = await loadRazorpay();
        if (!loaded) { alert("Failed to load Razorpay."); return; }
        const planName = mySub?.plan?.fixedTier || mySub?.plan?.name || "";
        const t = getTier(planName);
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_ST1ytIDhRNEoT3",
          amount: trialOrder.amount * 100,
          currency: trialOrder.currency || "INR",
          name: "Likeson Health",
          description: "Convert Trial to Paid Subscription",
          order_id: trialOrder.orderId,
          handler: async (response) => {
            await dispatch(verifyTrialConversion({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }));
            dispatch(clearTrialOrder());
            dispatch(fetchMySubscription());
          },
          prefill: { name: "", email: "", contact: "" },
          theme: { color: t.accent || "#8b5cf6" },
          modal: { ondismiss: () => dispatch(clearTrialOrder()) },
        };
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (r) => {
          alert(`Payment failed: ${r.error.description}`);
          dispatch(clearTrialOrder());
        });
        rzp.open();
      })();
    }
  }, [trialOrder]);

  const handleCancel = useCallback(() => {
    if (window.confirm("Cancel your subscription? You'll retain access until the current period ends."))
      dispatch(cancelSubscription()).then(() => dispatch(fetchMySubscription()));
  }, [dispatch]);

  const handleToggleAutoRenew = useCallback(() => {
    dispatch(optimisticToggleAutoRenew());
    dispatch(toggleAutoRenew());
  }, [dispatch]);

  const handleConvertTrial = useCallback(() => {
    dispatch(initiateTrialConversion({}));
  }, [dispatch]);

  // ── Derived ──
  const planName  = mySub?.plan?.fixedTier || mySub?.plan?.name || "";
  const t         = getTier(planName);
  const TIcon     = t.icon;
  const expiry    = mySub?.expiryDate ? new Date(mySub.expiryDate) : null;
  const daysLeft  = expiry ? Math.max(0, Math.ceil((expiry - Date.now()) / 86400000)) : 0;
  const isExpiring = daysLeft <= 7 && daysLeft > 0;
  const progress  = expiry ? Math.min(100, Math.max(0, (1 - daysLeft / 30) * 100)) : 0;

  // ── Loading ──
  if (subLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  const hasActiveSub = mySub && (isActive || isOnTrial);

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* ── Page Header ── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ opacity: 0.4 }}>Account</p>
              <h1 className="text-2xl font-black">My Subscription</h1>
            </div>
            {hasActiveSub && (
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: `${t.accent}15`, color: t.accent, border: `1.5px solid ${t.accent}30` }}
              >
                <Activity size={11} />
                {isOnTrial ? "Trial Active" : "Subscription Active"}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ── No subscription ── */}
        {!hasActiveSub && <EmptyState />}

        {/* ── Active subscription ── */}
        <AnimatePresence>
          {hasActiveSub && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Hero card */}
              <ActivePlanHeroCard
                sub={mySub}
                t={t}
                TIcon={TIcon}
                daysLeft={daysLeft}
                isExpiring={isExpiring}
                progress={progress}
                expiry={expiry}
              />

              {/* Action panel */}
              <ActionPanel
                sub={mySub}
                t={t}
                onToggleAutoRenew={handleToggleAutoRenew}
                onCancel={handleCancel}
                onConvertTrial={handleConvertTrial}
                cancelLoading={cancelLoading}
                toggleLoading={toggleLoading}
                trialConvertLoading={trialConvertLoading}
              />

              {/* ── History toggle ── */}
              <div>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex items-center gap-2 w-full px-5 py-4 rounded-2xl text-sm font-bold transition-all"
                  style={{ background: "var(--base-200)", border: "1.5px solid var(--base-300)" }}
                >
                  <motion.div animate={{ rotate: showHistory ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown size={15} />
                  </motion.div>
                  <span className="flex-1 text-left">Subscription History</span>
                  {historyPag.total > 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: "var(--base-300)", opacity: 0.7 }}>
                      {historyPag.total}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3">
                        <SubscriptionHistory
                          history={history}
                          pagination={historyPag}
                          loading={historyLoading}
                          onPageChange={(p) => setHistoryPage(p)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Browse more plans CTA ── */}
              <motion.a
                href="/subscriptions"
                whileHover={{ y: -2 }}
                className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all group"
                style={{ background: "var(--base-200)", border: "1.5px solid var(--base-300)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--primary), transparent 88%)" }}>
                    <Zap size={15} style={{ color: "var(--primary)" }} />
                  </div>
                  <div>
                    <p className="font-black text-sm">Explore Other Plans</p>
                    <p className="text-[10px] font-semibold" style={{ opacity: 0.45 }}>Upgrade or switch your healthcare plan</p>
                  </div>
                </div>
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowRight size={16} style={{ color: "var(--primary)" }} />
                </motion.div>
              </motion.a>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}