"use client";

import React, {
  useEffect, useState, useMemo, useCallback, useRef, memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Stethoscope, Truck, Pill, Microscope, UserCheck, Home,
  CheckCircle2, X, ChevronDown, Plus, Sparkles, Crown, Shield,
  Users, HeartPulse, Zap, ArrowRight, Gift, RefreshCw, Tag,
  AlertCircle, BadgeCheck, Layers, Info, Globe, Flame, Award,
  CreditCard, Minus, BarChart3, Activity, Clock, UserPlus,
} from "lucide-react";

import {
  fetchAllPlans, fetchCustomPlanPricing, createCustomPlan,
  updateCustomPlan, deleteCustomPlan, fetchMySubscription,
  initiateSubscriptionPurchase, verifySubscriptionPayment,
  upgradeSubscription, startFreeTrial, fetchTrialEligibility,
  fetchTrialStatus, initiateTrialConversion, verifyTrialConversion,
  clearPendingOrder, clearTrialOrder,
  selectAllPlans, selectFixedPlans, selectMyCustomPlans,
  selectPlansLoading, selectCustomPlanPricing,
  selectCustomPlanPricingLoading, selectCustomPlanLoading,
  selectCustomPlanError, selectPendingOrder, selectPurchaseLoading,
  selectVerifyLoading, selectMySubscription, selectMySubHasAccess,
  selectUpgradeLoading, selectIsTrialEligible, selectTrialStatus,
  selectIsOnActiveTrial, selectTrialDaysLeft, selectTrialStatusLoading,
  selectTrialOrder, selectTrialConvertLoading,
} from "@/store/slices/subscriptionSlice";
import {motion} from "framer-motion";
// ─── Razorpay loader ──────────────────────────────────────────────────────────
export function preconnectRazorpay() {
  if (typeof document === "undefined") return;
  ["https://checkout.razorpay.com", "https://api.razorpay.com"].forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const link = Object.assign(document.createElement("link"), {
      rel: "preconnect", href, crossOrigin: "anonymous",
    });
    document.head.appendChild(link);
  });
}

let _rzpLoadPromise = null;
function loadRazorpay() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (_rzpLoadPromise) return _rzpLoadPromise;
  _rzpLoadPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { _rzpLoadPromise = null; resolve(false); };
    document.body.appendChild(s);
  });
  return _rzpLoadPromise;
}

// ─── Pricing Engine ───────────────────────────────────────────────────────────
/**
 * resolveOptionPrice
 *
 * careAssistant: quantity = visits/month, careAssistantTierIndex = selected tier index
 * consultations: quantity = consult count, doctorTierCount = selected doctor count for tier bonus
 */
function resolveOptionPrice(optionPricing, optionKey, quantity, extras = {}) {
  if (!optionPricing || quantity <= 0) {
    return { unitPrice: 0, lineTotal: 0, slabLabel: "" };
  }

  const qty = Number(quantity);
  let unitPrice = 0;
  let slabLabel = "";

  switch (optionKey) {
    case "consultations": {
      const base = optionPricing?.consultation?.pricePerConsultation ?? 0;
      unitPrice = base;
      const tiers = optionPricing?.consultation?.doctorPricingTiers ?? [];
      // doctorTierCount: how many doctors selected (must be <= qty)
      const selectedDoctorCount = extras.doctorTierCount ?? 0;
      let tierBonus = 0;
      if (tiers.length > 0 && selectedDoctorCount > 0) {
        const matched = [...tiers]
          .sort((a, b) => b.doctorCount - a.doctorCount)
          .find((t) => t.doctorCount <= selectedDoctorCount);
        if (matched) {
          tierBonus = matched.additionalPrice ?? 0;
          slabLabel = `Base ₹${base}/consult + ₹${tierBonus} doctor-tier bonus (${selectedDoctorCount} doctors)`;
        }
      } else {
        slabLabel = `₹${base}/consult`;
      }
      unitPrice = base + tierBonus;
      return { unitPrice, lineTotal: +(qty * unitPrice).toFixed(2), slabLabel };
    }

    case "transport": {
      const slabs = optionPricing?.transport?.kmSlabs ?? [];
      if (slabs.length > 0) {
        const sorted = [...slabs].sort((a, b) => b.km - a.km);
        const matched = sorted.find((s) => s.km <= qty);
        if (matched) {
          slabLabel = `${matched.km}km slab @ ₹${matched.price} bundle`;
          return { unitPrice: matched.price, lineTotal: matched.price, slabLabel };
        }
      }
      return { unitPrice: 0, lineTotal: 0, slabLabel: "No matching slab" };
    }

    case "diagnostics": {
      const slabs = optionPricing?.diagnosticsDiscount?.slabs ?? [];
      if (slabs.length > 0) {
        const exact = slabs.find((s) => s.percent === qty);
        const picked = exact ?? [...slabs].sort((a, b) => b.percent - a.percent).find((s) => s.percent <= qty);
        if (picked) {
          slabLabel = `${picked.percent}% discount @ ₹${picked.price}/mo`;
          return { unitPrice: picked.price, lineTotal: picked.price, slabLabel };
        }
      }
      return { unitPrice: 0, lineTotal: 0, slabLabel: "No matching slab" };
    }

    case "pharmacy": {
      const slabs = optionPricing?.pharmacyDiscount?.slabs ?? [];
      if (slabs.length > 0) {
        const exact = slabs.find((s) => s.percent === qty);
        const picked = exact ?? [...slabs].sort((a, b) => b.percent - a.percent).find((s) => s.percent <= qty);
        if (picked) {
          slabLabel = `${picked.percent}% discount @ ₹${picked.price}/mo`;
          return { unitPrice: picked.price, lineTotal: picked.price, slabLabel };
        }
      }
      return { unitPrice: 0, lineTotal: 0, slabLabel: "No matching slab" };
    }

    case "careAssistant": {
      // quantity = visits/month, careAssistantTierIndex = which tier selected
      const caTiers = optionPricing?.careAssistant?.pricingTiers ?? [];
      const tierIdx = extras.careAssistantTierIndex ?? 0;
      if (caTiers.length > 0) {
        const tier = caTiers[tierIdx] ?? caTiers[0];
        unitPrice = tier.chargeToUser ?? 0;
        slabLabel = `${tier.label}: ₹${unitPrice}/visit × ${qty} visits`;
      }
      return { unitPrice, lineTotal: +(qty * unitPrice).toFixed(2), slabLabel };
    }

    case "homeSampleCollection": {
      const price = optionPricing?.addOns?.homeSampleCollection ?? 199;
      slabLabel = `Flat ₹${price}`;
      return { unitPrice: price, lineTotal: qty > 0 ? price : 0, slabLabel };
    }

    case "prioritySupport": {
      const price = optionPricing?.addOns?.prioritySupport ?? 99;
      slabLabel = `Flat ₹${price}`;
      return { unitPrice: price, lineTotal: qty > 0 ? price : 0, slabLabel };
    }

    default:
      return { unitPrice: 0, lineTotal: 0, slabLabel: "" };
  }
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const TIER_META = {
  "Basic Care": {
    gradient: "from-blue-500 to-blue-700",
    gradientCSS: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
    accent: "#3b82f6", glow: "rgba(59,130,246,0.35)",
    icon: Shield, tag: "Starter", popular: false,
    tagline: "Essential individual coverage",
    patternId: "zigzag", ring: "ring-blue-500/30",
  },
  "Premium Care": {
    gradient: "from-violet-500 to-violet-700",
    gradientCSS: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
    accent: "#8b5cf6", glow: "rgba(139,92,246,0.4)",
    icon: Crown, tag: "Most Popular", popular: true,
    tagline: "Top-tier comprehensive care",
    patternId: "diamonds", ring: "ring-violet-500/40",
  },
  "Family Care": {
    gradient: "from-emerald-500 to-emerald-700",
    gradientCSS: "linear-gradient(135deg,#10b981,#059669)",
    accent: "#10b981", glow: "rgba(16,185,129,0.35)",
    icon: Users, tag: "Best Value", popular: false,
    tagline: "Complete family protection",
    patternId: "circles", ring: "ring-emerald-500/30",
  },
  "Pregnant Women Care": {
    gradient: "from-amber-500 to-amber-700",
    gradientCSS: "linear-gradient(135deg,#f59e0b,#d97706)",
    accent: "#f59e0b", glow: "rgba(245,158,11,0.35)",
    icon: HeartPulse, tag: "Maternity", popular: false,
    tagline: "End-to-end maternity care",
    patternId: "hearts", ring: "ring-amber-500/30",
  },
  "NRI's Care": {
    gradient: "from-rose-500 to-rose-700",
    gradientCSS: "linear-gradient(135deg,#ef4444,#b91c1c)",
    accent: "#ef4444", glow: "rgba(239,68,68,0.35)",
    icon: Globe, tag: "NRI Special", popular: false,
    tagline: "Cross-border healthcare",
    patternId: "grid", ring: "ring-rose-500/30",
  },
};

const CUSTOM_META = {
  gradient: "from-sky-500 to-purple-600",
  gradientCSS: "linear-gradient(135deg,#0ea5e9,#7c3aed)",
  accent: "#0ea5e9", glow: "rgba(14,165,233,0.35)",
  icon: Layers, tag: "Personalised", popular: false,
  tagline: "Build your own healthcare bundle",
  patternId: "waves", ring: "ring-sky-500/30",
};

const getMeta = (name) => TIER_META[name] || CUSTOM_META;

// ─── Option config ────────────────────────────────────────────────────────────
const OPTION_CONFIG = [
  { key: "consultations", icon: Stethoscope, label: "Doctor Consultations", unit: "consults/mo", isToggle: false, hint: "Price = base per consult + optional doctor-tier bonus" },
  { key: "transport", icon: Truck, label: "Medical Transport Rides", unit: "km quota", isToggle: false, hint: "Bundle price per km-slab selected" },
  { key: "diagnostics", icon: Microscope, label: "Diagnostic Discount", unit: "% off", isToggle: false, hint: "Flat monthly price for chosen % off" },
  { key: "pharmacy", icon: Pill, label: "Pharmacy Discount", unit: "% off", isToggle: false, hint: "Flat monthly price for chosen % off (max 25%)" },
  { key: "careAssistant", icon: UserCheck, label: "Care Assistant Visits", unit: "visits/mo", isToggle: false, hint: "Select visit duration tier then set visits/month" },
  { key: "homeSampleCollection", icon: Home, label: "Home Sample Collection", unit: "add-on", isToggle: true, hint: "One-time monthly flat charge", inputMax: 1 },
  { key: "prioritySupport", icon: Zap, label: "Priority Support", unit: "add-on", isToggle: true, hint: "One-time monthly flat charge", inputMax: 1 },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = memo(function Toast({ message, type = "error", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isErr = type === "error";
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-3 px-5 py-3.5
        rounded-2xl shadow-2xl max-w-sm w-[calc(100%-2rem)] backdrop-blur-xl border
        ${isErr ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}
      role="alert" aria-live="polite" aria-atomic="true"
    >
      <AlertCircle size={16} className={`flex-shrink-0 ${isErr ? "text-red-500" : "text-emerald-500"}`} aria-hidden="true" />
      <p className={`text-xs font-bold flex-1 ${isErr ? "text-red-500" : "text-emerald-500"}`}>{message}</p>
      <button onClick={onClose} aria-label="Dismiss" className="opacity-50 hover:opacity-100 transition-opacity">
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
});

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
const ConfirmDialog = memo(function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  onConfirm, onCancel, accent = "#8b5cf6",
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-base-100 border border-base-300 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}18` }} aria-hidden="true">
            <AlertCircle size={18} style={{ color: accent }} />
          </div>
          <div>
            <p id="confirm-title" className="text-sm font-black text-base-content">{title}</p>
            <p id="confirm-msg" className="text-xs mt-0.5 text-base-content/55">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-xs font-black bg-base-300 text-base-content">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-xs font-black text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent}, #000 20%))` }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── SVG Patterns ─────────────────────────────────────────────────────────────
const PATTERNS = {
  zigzag:   (id) => <pattern id={id} x="0" y="0" width="24" height="12" patternUnits="userSpaceOnUse"><polyline points="0,12 6,0 12,12 18,0 24,12" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></pattern>,
  diamonds: (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="white" strokeWidth="1" /></pattern>,
  circles:  (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="0.9" /></pattern>,
  hearts:   (id) => <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12,20C12,20 3,13 3,7.5C3,5 5,3 7.5,3C9.24,3 10.91,4.1 12,5.5C13.09,4.1 14.76,3 16.5,3C19,3 21,5 21,7.5C21,13 12,20 12,20Z" fill="none" stroke="white" strokeWidth="0.9" /></pattern>,
  grid:     (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0L0 0 0 20" fill="none" stroke="white" strokeWidth="0.7" /></pattern>,
  waves:    (id) => <pattern id={id} x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse"><path d="M0,8 Q8,0 16,8 Q24,16 32,8" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" /></pattern>,
};

const PlanPattern = memo(function PlanPattern({ patternId, uid }) {
  const fn = PATTERNS[patternId] || PATTERNS.grid;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.08]" aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>{fn(uid)}</defs>
        <rect width="100%" height="100%" fill={`url(#${uid})`} />
      </svg>
    </div>
  );
});

// ─── Benefit Row ──────────────────────────────────────────────────────────────
const BenefitRow = memo(function BenefitRow({ icon: Icon, label, value, active, accent }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-base-content/[0.08] last:border-0"
      style={{ opacity: active ? 1 : 0.3 }}>
      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: active ? `${accent}18` : undefined }}
        aria-hidden="true">
        {!active && <Icon size={11} className="text-base-content/40" />}
        {active && <Icon size={11} style={{ color: accent }} />}
      </div>
      <span className="text-xs font-semibold flex-1 text-base-content">{label}</span>
      <span className="text-[11px] font-black" style={{ color: active ? accent : undefined }}>
        {value}
      </span>
    </div>
  );
});

// ─── Plan Card ────────────────────────────────────────────────────────────────
const PlanCard = memo(function PlanCard({
  plan, hasAccess, isCurrent, onSubscribe, onTrial, onUpgrade,
  trialEligible, purchaseLoading, trialLoading,
}) {
  const name      = plan.fixedTier || plan.name;
  const meta      = getMeta(name);
  const TIcon     = meta.icon;
  const monthly   = plan.pricing?.monthly ?? 0;
  const billing   = plan.pricing?.billingLabel || "/month";
  const consults  = plan.consultations?.freePerMonth ?? 0;
  const pharmMax  = plan.pharmacy?.isFlat ? plan.pharmacy?.discountMax : (plan.pharmacy?.discountMax ?? 0);
  const pharmMin  = plan.pharmacy?.discountMin ?? 0;
  const diagDisc  = plan.diagnostics?.discountPercent ?? 0;
  const maxMem    = plan.membership?.maxMembers ?? 1;
  const careInc   = plan.careAssistant?.included ?? false;
  const homeLab   = plan.diagnostics?.homeSampleCollection ?? false;
  const transport = plan.transport?.isApplicable ?? true;
  const trialDays = plan.freeTrial?.enabled ? (plan.freeTrial.durationDays ?? 7) : 0;
  const uid       = `pat-${meta.patternId}-${name.replace(/[\s']/g, "")}`;

  const benefits = [
    { icon: Stethoscope, label: "Consultations",     value: consults === -1 ? "Unlimited" : `${consults}/mo`,   active: consults !== 0 },
    { icon: Pill,        label: "Pharmacy Discount", value: plan.pharmacy?.isFlat ? `${pharmMax}%` : `${pharmMin}–${pharmMax}%`, active: pharmMax > 0 },
    { icon: Microscope,  label: "Diagnostics",       value: `${diagDisc}% off`,                                  active: diagDisc > 0 },
    { icon: Truck,       label: "Transport",         value: transport ? `₹${plan.transport?.ratePerKm ?? 0}/km` : "N/A", active: transport },
    { icon: UserCheck,   label: "Care Assistant",    value: careInc ? (plan.careAssistant?.serviceType || "Standard") : "—", active: careInc },
    { icon: Home,        label: "Home Sample",       value: homeLab ? "Included" : "—",                          active: homeLab },
    { icon: Users,       label: "Members",           value: maxMem === 1 ? "Individual" : `Up to ${maxMem}`,     active: true },
  ];

  return (
    <article
      className="relative  flex flex-col h-full transition-transform duration-300 hover:-translate-y-1"
      aria-label={`${name} plan, ₹${monthly}${billing}${isCurrent ? ", currently active" : ""}`}
      style={{ paddingTop: meta.popular ? 14 : 0, zIndex: meta.popular ? 10 : 1 }}
    >
      {meta.popular && (
        <>
          <div
            className="absolute -top-[14px] left-1/2 -translate-x-1/2 flex items-center gap-1.5
              px-4 py-1.5 rounded-t-2xl text-[10px] font-black uppercase tracking-wider text-white z-30"
            style={{ background: meta.gradientCSS, boxShadow: `0 -4px 20px ${meta.accent}55` }}
            aria-hidden="true"
          >
            <Flame size={10} fill="currentColor" /> Most Popular <Flame size={10} fill="currentColor" />
          </div>
          
        </>
      )}

      <div
        className={`relative flex flex-col h-full overflow-hidden rounded-[20px] transition-all duration-300
          ${isCurrent ? "border-2" : meta.popular ? "border-2" : "border border-base-300"}`}
        style={{
          borderColor: (isCurrent || meta.popular) ? meta.accent : undefined,
          background: meta.popular
            ? `linear-gradient(180deg, color-mix(in srgb, ${meta.accent}, var(--base-100) 92%) 0%, var(--base-100) 30%)`
            : undefined,
          boxShadow: meta.popular
            ? `0 0 0 1px ${meta.accent}22, 0 8px 32px ${meta.accent}33`
            : isCurrent
            ? `0 4px 24px ${meta.accent}25`
            : "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div className="relative overflow-hidden flex-shrink-0"
          style={{ background: meta.gradientCSS, minHeight: meta.popular ? 164 : 148 }}>
          <PlanPattern patternId={meta.patternId} uid={uid} />
          <div className="relative z-10 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
                {meta.tag}
              </span>
              {isCurrent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                  text-[10px] font-black bg-white/20 text-white" aria-label="Current active plan">
                  <BadgeCheck size={10} aria-hidden="true" /> Active
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20" aria-hidden="true">
                    <TIcon size={16} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    {maxMem === 1 ? "Individual" : `Up to ${maxMem}`}
                  </span>
                </div>
                <h3 className={`font-black text-white leading-tight ${meta.popular ? "text-2xl" : "text-xl"}`}>
                  {name}
                </h3>
                <p className="text-white/55 text-[11px] mt-0.5">{meta.tagline}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[9px] text-white/45 uppercase font-bold mb-0.5">{billing}</p>
                <p className={`font-black text-white leading-none ${meta.popular ? "text-4xl" : "text-3xl"}`}
                  aria-label={`₹${monthly} ${billing}`}>
                  ₹{monthly}
                </p>
                {trialDays > 0 && (
                  <p className="text-[10px] text-white/55 mt-0.5 font-bold">{trialDays}d free trial</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="px-5 pt-4 pb-2 bg-base-100">
          {benefits.map((b, i) => <BenefitRow key={i} {...b} accent={meta.accent} />)}
        </div>

        {plan.support?.tier && (
          <div className="px-5 pb-1 bg-base-100">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ background: `${meta.accent}0f` }}>
              <Activity size={10} style={{ color: meta.accent }} aria-hidden="true" />
              <span className="text-[10px] font-bold" style={{ color: meta.accent }}>
                Support: {plan.support.tier}
              </span>
            </div>
          </div>
        )}

        {plan.idealFor && (
          <p className="px-5 py-1 text-[10px] font-semibold text-base-content/40 bg-base-100">
            <Info size={9} className="inline mr-1" aria-hidden="true" />
            Ideal for: {plan.idealFor}
          </p>
        )}

        {/* CTAs */}
        <div className="p-4 mt-auto space-y-2 bg-base-100">
          {isCurrent ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black"
              style={{ background: `${meta.accent}15`, color: meta.accent, border: `1.5px solid ${meta.accent}40` }}>
              <BadgeCheck size={14} aria-hidden="true" /> Active Plan
            </div>
          ) : hasAccess ? (
            <button
              onClick={() => onUpgrade(plan)}
              disabled={purchaseLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                text-xs font-black text-white transition-all disabled:opacity-60 hover:brightness-110"
              style={{ background: meta.gradientCSS, boxShadow: `0 4px 16px ${meta.glow}` }}
              aria-label={`Upgrade to ${name}`} aria-busy={purchaseLoading}
            >
              {purchaseLoading
                ? <><RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Upgrading…</>
                : <><ArrowRight size={13} aria-hidden="true" /> Upgrade to {name.split(" ")[0]}</>
              }
            </button>
          ) : (
            <>
              <button
                onClick={() => onSubscribe(plan)}
                disabled={purchaseLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                  text-xs font-black text-white transition-all disabled:opacity-60 hover:brightness-110"
                style={{ background: meta.gradientCSS, boxShadow: `0 4px 20px ${meta.glow}` }}
                aria-label={`Subscribe to ${name} for ₹${monthly}${billing}`}
                aria-busy={purchaseLoading}
              >
                {purchaseLoading
                  ? <><RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Loading…</>
                  : <><CreditCard size={13} aria-hidden="true" /> Subscribe — ₹{monthly}{billing}</>
                }
              </button>
              {trialDays > 0 && trialEligible && (
                <button
                  onClick={() => onTrial(plan)}
                  disabled={trialLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                    text-xs font-bold transition-all disabled:opacity-60"
                  style={{ background: `${meta.accent}12`, color: meta.accent, border: `1.5px solid ${meta.accent}30` }}
                  aria-label={`Start ${trialDays}-day free trial for ${name}`}
                  aria-busy={trialLoading}
                >
                  {trialLoading
                    ? <><RefreshCw size={12} className="animate-spin" aria-hidden="true" /> Loading…</>
                    : <><Gift size={12} aria-hidden="true" /> {trialDays}-Day Free Trial</>
                  }
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
});

// ─── Checkout Modal ───────────────────────────────────────────────────────────
const CheckoutModal = memo(function CheckoutModal({
  plan, pendingOrder, onClose, onInitiatePay, onVerifyPay,
  purchaseLoading, verifyLoading, onToast,
}) {
  const [coupon, setCoupon] = useState("");
  const [paying, setPaying] = useState(false);
  const meta = getMeta(plan?.fixedTier || plan?.name || "");
  const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const uid = `modal-pat-${Date.now()}`;

  const openRazorpay = useCallback(async (order) => {
    if (!RZP_KEY) { onToast("Payment gateway not configured. Contact support.", "error"); return; }
    const loaded = await loadRazorpay().catch(() => false);
    if (!loaded) { onToast("Failed to load payment gateway. Check your connection.", "error"); return; }

    const amountInPaise = order.amount < 100000
      ? Math.round(order.amount * 100)
      : Math.round(order.amount);

    const rzp = new window.Razorpay({
      key: RZP_KEY,
      amount: amountInPaise,
      currency: order.currency || "INR",
      name: "Likeson Health",
      description: `${plan.fixedTier || plan.name} Subscription`,
      order_id: order.orderId || order.id,
      image: "/logo.png",
      handler: async (response) => {
        setPaying(true);
        try {
          const res = await onVerifyPay({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId: order.planId,
            amount: order.amount,
          });
          if (res?.error) onToast(res.error.message || "Payment verification failed.", "error");
          else onClose();
        } finally { setPaying(false); }
      },
      prefill: { name: "", email: "", contact: "" },
      theme: { color: meta.accent },
      modal: { ondismiss: () => setPaying(false) },
    });
    rzp.on("payment.failed", (resp) => {
      onToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
      setPaying(false);
    });
    rzp.open();
  }, [plan, meta.accent, RZP_KEY, onVerifyPay, onClose, onToast]);

  const handlePay = useCallback(async () => {
    try {
      const result = await onInitiatePay({
        planId: plan._id,
        amount: plan.pricing?.monthly ?? 0,
        couponCode: coupon || undefined,
      });
      if (result?.error) { onToast(result.error.message || "Failed to create order.", "error"); return; }
      const order = result?.payload;
      if (!order) { onToast("Unexpected server response. Please try again.", "error"); return; }
      if (order.activated === true || Number(order.amount) === 0) { onClose(); return; }
      if (order.orderId || order.id) await openRazorpay(order);
      else onToast("Order created but payment details missing. Please retry.", "error");
    } catch {
      onToast("Something went wrong. Please try again.", "error");
    }
  }, [plan, coupon, onInitiatePay, openRazorpay, onClose, onToast]);

  if (!plan) return null;
  const isLoading = purchaseLoading || verifyLoading || paying;
  const displayAmount = pendingOrder?.amount ?? plan.pricing?.monthly ?? 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden bg-base-100
        border border-base-300 shadow-2xl">
        <div className="relative overflow-hidden px-6 py-5" style={{ background: meta.gradientCSS }}>
          <PlanPattern patternId={meta.patternId} uid={uid} />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest mb-0.5">Subscribe</p>
              <h2 id="checkout-title" className="text-xl font-black text-white">
                {plan.fixedTier || plan.name}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40 uppercase font-bold mb-0.5">Total</p>
              <p className="text-2xl font-black text-white" aria-label={`Total ₹${displayAmount}`}>
                ₹{displayAmount}
              </p>
              {pendingOrder?.discount > 0 && (
                <p className="text-[10px] text-white/60 line-through" aria-label={`Original ₹${plan.pricing?.monthly}`}>
                  ₹{plan.pricing?.monthly}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center
              text-white bg-white/15 z-20 hover:bg-white/25 transition-colors"
            aria-label="Close checkout">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="coupon-input" className="sr-only">Coupon code</label>
              <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" aria-hidden="true" />
              <input
                id="coupon-input"
                type="text"
                placeholder="Coupon code (optional)"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                className="input-field w-full pl-9 text-sm font-mono tracking-widest uppercase"
                autoComplete="off"
              />
            </div>
          </div>
          <button
            onClick={handlePay}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
              text-sm font-black text-white disabled:opacity-60 transition-all hover:brightness-110"
            style={{ background: meta.gradientCSS, boxShadow: `0 4px 20px ${meta.glow}` }}
            aria-label={`Pay ₹${displayAmount}`} aria-busy={isLoading}
          >
            {purchaseLoading
              ? <><RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Creating order…</>
              : (verifyLoading || paying)
              ? <><RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Verifying…</>
              : <><CreditCard size={14} aria-hidden="true" /> Pay ₹{displayAmount}</>
            }
          </button>
          <p className="text-center text-[10px] text-base-content/40">
            Secured by Razorpay · 256-bit SSL
          </p>
        </div>
      </div>
    </div>
  );
});

// ─── Custom Plan Builder ──────────────────────────────────────────────────────
const CustomPlanBuilder = memo(function CustomPlanBuilder({ onClose, existingCustomPlan, onToast }) {
  const dispatch    = useDispatch();
  const pricingData = useSelector(selectCustomPlanPricing);
  const priceLoad   = useSelector(selectCustomPlanPricingLoading);
  const saveLoad    = useSelector(selectCustomPlanLoading);
  const saveErr     = useSelector(selectCustomPlanError);

  const [planName, setPlanName] = useState(existingCustomPlan?.name || "My Custom Plan");

  const [quantities, setQty] = useState(() => {
    if (existingCustomPlan?.customOptions) {
      return Object.fromEntries(existingCustomPlan.customOptions.map((o) => [o.optionKey, o.quantity]));
    }
    return Object.fromEntries(OPTION_CONFIG.map((o) => [o.key, 0]));
  });

  const [careAssistantTierIndex, setCareAssistantTierIndex] = useState(() => {
    if (existingCustomPlan?.customOptions) {
      const caOpt = existingCustomPlan.customOptions.find((o) => o.optionKey === "careAssistant");
      return caOpt?.careAssistantTierIndex ?? 0;
    }
    return 0;
  });

  const [doctorTierCount, setDoctorTierCount] = useState(() => {
    if (existingCustomPlan?.customOptions) {
      const cOpt = existingCustomPlan.customOptions.find((o) => o.optionKey === "consultations");
      return cOpt?.doctorTierCount ?? 0;
    }
    return 0;
  });

  useEffect(() => { dispatch(fetchCustomPlanPricing()); }, [dispatch]);

  const optionPricing = pricingData?.optionPricing ?? null;
  const caps = pricingData?.caps ?? {};

  const CAP_MAP = useMemo(() => ({
    consultations:        caps.consultationsMaxPerMonth       ?? 30,
    transport:            caps.transportMaxRidesPerMonth      ?? 20,
    diagnostics:          caps.diagnosticsDiscountMax         ?? 25,
    pharmacy:             caps.pharmacyDiscountMax            ?? 25,
    careAssistant:        caps.careAssistantMaxVisitsPerMonth ?? 30,
    homeSampleCollection: 1,
    prioritySupport:      1,
  }), [caps]);

  const caTiers     = optionPricing?.careAssistant?.pricingTiers ?? [];
  const doctorTiers = optionPricing?.consultation?.doctorPricingTiers ?? [];
  const maxDoctorsAllowed = optionPricing?.consultation?.maxDoctorsAllowed ?? 5;

  const consultQty = quantities["consultations"] ?? 0;

  const availableDoctorTiers = useMemo(() => {
    if (!doctorTiers.length || consultQty <= 0) return [];
    return [...doctorTiers]
      .filter((t) => t.doctorCount <= consultQty && t.doctorCount <= maxDoctorsAllowed)
      .sort((a, b) => a.doctorCount - b.doctorCount);
  }, [doctorTiers, consultQty, maxDoctorsAllowed]);

  useEffect(() => {
    if (doctorTierCount > consultQty) setDoctorTierCount(0);
  }, [consultQty, doctorTierCount]);

  const priceBreakdown = useMemo(() => {
    if (!optionPricing) return {};
    return Object.fromEntries(
      OPTION_CONFIG.map((opt) => {
        const qty = quantities[opt.key] ?? 0;
        const extras = {
          careAssistantTierIndex: opt.key === "careAssistant" ? careAssistantTierIndex : undefined,
          doctorTierCount:        opt.key === "consultations"  ? doctorTierCount        : undefined,
        };
        const result = resolveOptionPrice(optionPricing, opt.key, qty, extras);
        return [opt.key, result];
      })
    );
  }, [optionPricing, quantities, careAssistantTierIndex, doctorTierCount]);

  const total = useMemo(
    () => Object.values(priceBreakdown).reduce((s, v) => s + (v?.lineTotal ?? 0), 0),
    [priceBreakdown]
  );

  const handleSetQty = useCallback((key, val) => {
    const max = CAP_MAP[key] ?? 1;
    setQty((q) => ({ ...q, [key]: Math.max(0, Math.min(max, Number(val))) }));
  }, [CAP_MAP]);

  const handleSave = useCallback(async () => {
    const options = OPTION_CONFIG
      .filter((o) => (quantities[o.key] ?? 0) > 0)
      .map((o) => {
        const extras = {};
        if (o.key === "careAssistant") extras.careAssistantTierIndex = careAssistantTierIndex;
        if (o.key === "consultations") extras.doctorTierCount = doctorTierCount;
        return { optionKey: o.key, label: o.label, quantity: quantities[o.key], ...extras };
      });

    if (!options.length) { onToast("Add at least one option to your plan.", "error"); return; }
    try {
      const res = await dispatch(
        existingCustomPlan
          ? updateCustomPlan({ planId: existingCustomPlan._id, name: planName, options })
          : createCustomPlan({ name: planName, options })
      );
      if (!res.error) onClose();
    } catch { /* handled by slice */ }
  }, [quantities, planName, existingCustomPlan, dispatch, onClose, onToast, careAssistantTierIndex, doctorTierCount]);

  const getSlabOptions = useCallback((optionKey) => {
    if (!optionPricing) return [];
    if (optionKey === "transport")   return (optionPricing.transport?.kmSlabs ?? []).map((s) => ({ value: s.km,      label: `${s.km}km — ₹${s.price}` }));
    if (optionKey === "diagnostics") return (optionPricing.diagnosticsDiscount?.slabs ?? []).map((s) => ({ value: s.percent, label: `${s.percent}% off — ₹${s.price}/mo` }));
    if (optionKey === "pharmacy")    return (optionPricing.pharmacyDiscount?.slabs ?? []).map((s) => ({ value: s.percent, label: `${s.percent}% off — ₹${s.price}/mo` }));
    return [];
  }, [optionPricing]);

  const useDropdown = (key) => ["transport", "diagnostics", "pharmacy"].includes(key);

  return (
    <section
      className="rounded-2xl overflow-hidden border-2 w-full max-w-xl mx-auto"
      style={{ borderColor: CUSTOM_META.accent, boxShadow: `0 20px 60px ${CUSTOM_META.glow}` }}
      aria-label="Custom plan builder"
    >
      {/* ── Header ── */}
      <div className="relative overflow-hidden px-4 py-4 sm:px-6 sm:py-5" style={{ background: CUSTOM_META.gradientCSS }}>
        <PlanPattern patternId="waves" uid="custom-builder-pat" />

        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          {/* Left: badge + name + hint */}
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
              text-[10px] font-black uppercase tracking-wider bg-white/20 text-white mb-2">
              <Sparkles size={9} aria-hidden="true" /> Build Your Plan
            </span>

            <label htmlFor="custom-plan-name" className="sr-only">Plan name</label>
            <input
              id="custom-plan-name"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="block text-base sm:text-xl font-black text-white bg-transparent border-none
                outline-none w-full border-b border-white/30 pb-1 placeholder-white/40"
              placeholder="Name your plan…"
            />
            <p className="text-white/50 text-[11px] mt-1">Select services and quantities below</p>
          </div>

          {/* Right: total — row on mobile too but smaller */}
          <div className="flex items-baseline gap-2 sm:block sm:text-right flex-shrink-0">
            <p className="text-[9px] text-white/45 uppercase font-bold sm:mb-0.5 hidden sm:block">Monthly Total</p>
            <p
              className="text-3xl sm:text-4xl font-black text-white"
              aria-label={`₹${total} per month`}
            >
              ₹{total.toFixed(0)}
            </p>
            <p className="text-white/45 text-[11px]">/mo</p>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-3 sm:p-5 space-y-3 bg-base-100">
        {priceLoad ? (
          <div className="flex justify-center py-8" role="status" aria-label="Loading pricing">
            <RefreshCw size={20} className="animate-spin" style={{ color: CUSTOM_META.accent }} aria-hidden="true" />
          </div>
        ) : (
          <>
            {OPTION_CONFIG.map((opt) => {
              const qty       = quantities[opt.key] ?? 0;
              const active    = qty > 0;
              const breakdown = priceBreakdown[opt.key] ?? { unitPrice: 0, lineTotal: 0, slabLabel: "" };
              const max       = CAP_MAP[opt.key] ?? 1;
              const slabOpts  = getSlabOptions(opt.key);

              return (
                <div
                  key={opt.key}
                  className="relative rounded-2xl p-3 sm:p-4 transition-all border"
                  style={{
                    background:   active ? `${CUSTOM_META.accent}08` : undefined,
                    borderColor:  active ? `${CUSTOM_META.accent}35` : undefined,
                  }}
                >
                  {!active && (
                    <div className="absolute inset-0 rounded-2xl bg-base-200 border border-base-300 -z-10" />
                  )}

                  {/* ── Row 1: icon + label + toggle (toggle stays in row 1) ── */}
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: active ? `${CUSTOM_META.accent}20` : undefined }}
                      aria-hidden="true"
                    >
                      {active
                        ? <opt.icon size={14} style={{ color: CUSTOM_META.accent }} />
                        : <opt.icon size={14} className="text-base-content/40" />
                      }
                    </div>

                    {/* Label + hint + slab label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-base-content leading-tight">{opt.label}</p>
                      <p className="text-[11px] font-semibold text-base-content/40 mt-0.5 leading-snug">{opt.hint}</p>
                      {active && breakdown.slabLabel && (
                        <p className="text-[11px] font-bold mt-1" style={{ color: CUSTOM_META.accent }}>
                          ↳ {breakdown.slabLabel}
                        </p>
                      )}
                    </div>

                    {/* Toggle sits in row 1 on ALL screen sizes */}
                    {opt.isToggle && (
                      <div className="flex-shrink-0 flex flex-col items-end gap-1 ml-1">
                        <button
                          type="button"
                          onClick={() => handleSetQty(opt.key, qty > 0 ? 0 : 1)}
                          className="relative rounded-full transition-all duration-300"
                          style={{ width: 44, height: 24, background: active ? CUSTOM_META.accent : undefined }}
                          role="switch"
                          aria-checked={active}
                          aria-label={`${active ? "Disable" : "Enable"} ${opt.label}`}
                        >
                          {!active && <div className="absolute inset-0 rounded-full bg-base-300" />}
                          <div
                            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                            style={{ transform: `translateX(${active ? 22 : 2}px)` }}
                          />
                        </button>
                        {active && (
                          <div
                            className="text-[11px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: `${CUSTOM_META.accent}18`, color: CUSTOM_META.accent }}
                            aria-label={`₹${breakdown.lineTotal} for ${opt.label}`}
                          >
                            ₹{breakdown.lineTotal.toFixed(0)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Row 2: stepper / dropdown + price badge (non-toggle only) ── */}
                  {!opt.isToggle && (
                    <div className="flex items-center justify-between mt-3 ml-[42px] sm:ml-[46px] gap-2">
                      {/* Control */}
                      <div className="flex-1 min-w-0">
                        {useDropdown(opt.key) && slabOpts.length > 0 ? (
                          <select
                            value={qty}
                            onChange={(e) => handleSetQty(opt.key, Number(e.target.value))}
                            className="input-field text-sm py-2 px-3 pr-7 rounded-xl w-full"
                            aria-label={`Select ${opt.label} slab`}
                          >
                            <option value={0}>— Not included —</option>
                            {slabOpts.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        ) : (
                          <div
                            className="inline-flex items-center rounded-xl overflow-hidden border border-base-300"
                            role="group"
                            aria-label={`${opt.label} quantity, max ${max}`}
                          >
                            {/* Decrease */}
                            <button
                              onClick={() => handleSetQty(opt.key, qty - 1)}
                              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center
                                bg-base-200 hover:bg-base-300 active:scale-95 transition-colors"
                              aria-label={`Decrease ${opt.label}`}
                              disabled={qty === 0}
                            >
                              <Minus size={13} aria-hidden="true" />
                            </button>

                            {/* Count */}
                            <span
                              className="w-12 sm:w-10 text-center text-base sm:text-sm font-black bg-base-100 select-none"
                              aria-label={`${qty} ${opt.unit}`}
                            >
                              {qty}
                            </span>

                            {/* Increase */}
                            <button
                              onClick={() => handleSetQty(opt.key, qty + 1)}
                              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center
                                bg-base-200 hover:bg-base-300 active:scale-95 transition-colors"
                              aria-label={`Increase ${opt.label}`}
                              disabled={qty >= max}
                            >
                              <Plus size={13} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Price badge */}
                      {active && (
                        <div
                          className="flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{ background: `${CUSTOM_META.accent}18`, color: CUSTOM_META.accent }}
                          aria-label={`₹${breakdown.lineTotal} for ${opt.label}`}
                        >
                          ₹{breakdown.lineTotal.toFixed(0)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Consultations sub-section ── */}
                  {opt.key === "consultations" && qty > 0 && optionPricing?.consultation && (
                    <div className="mt-3 space-y-2">
                      {doctorTiers.length > 0 && (
                        <div
                          className="p-3 rounded-xl"
                          style={{ background: `${CUSTOM_META.accent}0a`, border: `1px dashed ${CUSTOM_META.accent}30` }}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <UserPlus size={11} style={{ color: CUSTOM_META.accent }} aria-hidden="true" />
                            <p className="text-xs font-black text-base-content/70">
                              Doctor Tier Bonus
                              <span className="ml-1 text-base-content/40 font-normal text-[11px]">
                                (optional · max {maxDoctorsAllowed} doctors)
                              </span>
                            </p>
                          </div>
                          <select
                            value={doctorTierCount}
                            onChange={(e) => setDoctorTierCount(Number(e.target.value))}
                            className="input-field text-sm py-2 px-3 rounded-xl w-full"
                            aria-label="Select doctor tier for bonus pricing"
                          >
                            <option value={0}>— No doctor tier bonus —</option>
                            {availableDoctorTiers.map((t) => (
                              <option key={t.doctorCount} value={t.doctorCount}>
                                {t.doctorCount} doctor{t.doctorCount !== 1 ? "s" : ""} — +₹{t.additionalPrice}/consult bonus
                              </option>
                            ))}
                          </select>
                          {availableDoctorTiers.length === 0 && consultQty > 0 && (
                            <p className="text-xs text-base-content/40 mt-1">
                              No tier bonus available for {consultQty} consult{consultQty !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Price breakdown */}
                      <div
                        className="p-3 rounded-xl space-y-1"
                        style={{ background: `${CUSTOM_META.accent}0a`, border: `1px dashed ${CUSTOM_META.accent}30` }}
                      >
                        <p className="font-black text-xs text-base-content/70">Pricing breakdown:</p>
                        <p className="font-semibold text-xs text-base-content/55">
                          Base: {qty} consults × ₹{optionPricing.consultation.pricePerConsultation ?? 0} each
                          {" "}= ₹{(qty * (optionPricing.consultation.pricePerConsultation ?? 0)).toFixed(0)}
                        </p>
                        {doctorTierCount > 0 && (() => {
                          const matched = [...doctorTiers]
                            .sort((a, b) => b.doctorCount - a.doctorCount)
                            .find((t) => t.doctorCount <= doctorTierCount);
                          return matched ? (
                            <p className="font-semibold text-xs" style={{ color: CUSTOM_META.accent }}>
                              + Doctor tier: {qty} × ₹{matched.additionalPrice}
                              {" "}= ₹{(qty * matched.additionalPrice).toFixed(0)}
                              <span className="text-base-content/40 text-[11px] ml-1">
                                (≥{matched.doctorCount} doctors)
                              </span>
                            </p>
                          ) : null;
                        })()}
                        <p className="font-black text-sm" style={{ color: CUSTOM_META.accent }}>
                          = ₹{breakdown.lineTotal.toFixed(0)}/month total
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Care Assistant sub-section ── */}
                  {opt.key === "careAssistant" && qty > 0 && caTiers.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {/* Tier selector */}
                      <div
                        className="p-3 rounded-xl"
                        style={{ background: `${CUSTOM_META.accent}0a`, border: `1px dashed ${CUSTOM_META.accent}30` }}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <Clock size={11} style={{ color: CUSTOM_META.accent }} aria-hidden="true" />
                          <p className="text-xs font-black text-base-content/70">Select Visit Duration Tier</p>
                        </div>
                        <select
                          value={careAssistantTierIndex}
                          onChange={(e) => setCareAssistantTierIndex(Number(e.target.value))}
                          className="input-field text-sm py-2 px-3 rounded-xl w-full"
                          aria-label="Select care assistant duration tier"
                        >
                          {caTiers.map((tier, idx) => (
                            <option key={idx} value={idx}>
                              {tier.label} — ₹{tier.chargeToUser}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Pricing breakdown */}
                      <div
                        className="p-3 rounded-xl space-y-1"
                        style={{ background: `${CUSTOM_META.accent}0a`, border: `1px dashed ${CUSTOM_META.accent}30` }}
                      >
                        <p className="font-black text-xs text-base-content/70">Visit pricing breakdown:</p>
                        {(() => {
                          const selectedTier = caTiers[careAssistantTierIndex] ?? caTiers[0];
                          return (
                            <>
                              <p className="font-semibold text-xs text-base-content/55">
                                Duration: {selectedTier.label}
                              </p>
                              <p className="font-semibold text-xs" style={{ color: CUSTOM_META.accent }}>
                                {qty} visits × ₹{selectedTier.chargeToUser} = ₹{breakdown.lineTotal.toFixed(0)}/month
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Grand total ── */}
            <div
              className="rounded-2xl p-3 sm:p-4 border-2"
              style={{ background: `${CUSTOM_META.accent}08`, borderColor: `${CUSTOM_META.accent}35` }}
              aria-label="Custom plan total cost breakdown"
            >
              <p className="text-[11px] font-black text-base-content/60 uppercase tracking-widest mb-3">
                Cost Breakdown
              </p>
              <div className="space-y-2">
                {OPTION_CONFIG.filter((o) => (quantities[o.key] ?? 0) > 0).map((opt) => {
                  const b = priceBreakdown[opt.key];
                  return (
                    <div key={opt.key} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-base-content/70 flex items-center gap-1.5 min-w-0">
                        <opt.icon size={10} aria-hidden="true" className="flex-shrink-0" />
                        <span className="truncate">{opt.label}</span>
                        {b?.slabLabel && (
                          <span className="text-[10px] text-base-content/40 font-normal hidden sm:inline flex-shrink-0">
                            ({b.slabLabel})
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-black flex-shrink-0" style={{ color: CUSTOM_META.accent }}>
                        ₹{b?.lineTotal?.toFixed(0) ?? 0}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: `1.5px solid ${CUSTOM_META.accent}30` }}
              >
                <span className="text-sm font-black text-base-content">Monthly Total</span>
                <span className="text-2xl font-black" style={{ color: CUSTOM_META.accent }}>
                  ₹{total.toFixed(0)}
                  <span className="text-xs font-bold text-base-content/40">/mo</span>
                </span>
              </div>
            </div>

            {/* ── Error ── */}
            {saveErr && (
              <div
                className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-red-500/10 text-red-500"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle size={13} aria-hidden="true" /> {saveErr}
              </div>
            )}

            {/* ── Action buttons ── */}
            <div className="flex flex-col md:flex-row gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-4 sm:py-3 rounded-xl text-sm sm:text-xs font-black uppercase
                  tracking-wider bg-base-300 text-base-content hover:bg-base-300/80 transition-colors
                  active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveLoad || total === 0}
                className="flex-1 flex items-center justify-center gap-2 py-4 sm:py-3 rounded-xl
                  text-sm sm:text-xs font-black text-white disabled:opacity-65 transition-all
                  hover:brightness-110 active:scale-95"
                style={{ background: CUSTOM_META.gradientCSS, boxShadow: `0 4px 20px ${CUSTOM_META.glow}` }}
                aria-label={`${existingCustomPlan ? "Update" : "Create"} plan — ₹${total.toFixed(0)}/month`}
                aria-busy={saveLoad}
              >
                {saveLoad ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    {existingCustomPlan ? "Update" : "Create"} — ₹{total.toFixed(0)}/mo
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
});

// ─── Inline Comparison Table ──────────────────────────────────────────────────
const InlineComparisonTable = memo(function InlineComparisonTable({
  allFixedPlans, currentPlanName, onSubscribe, onUpgrade, hasAccess,
}) {
  const [mode, setMode] = useState("overview");

  if (!allFixedPlans?.length) return null;

  const ROWS = [
    { key: "price",         label: "Monthly Price",          icon: CreditCard,   getValue: (p) => p ? `₹${p.pricing?.monthly}${p.pricing?.billingLabel || "/mo"}` : "Pay-per-use" },
    { key: "trial",         label: "Free Trial",             icon: Gift,         getValue: (p) => p?.freeTrial?.enabled ? `${p.freeTrial.durationDays}d free` : "—" },
    { key: "consultations", label: "Doctor Consultations",   icon: Stethoscope,  getValue: (p) => p ? (p.consultations?.freePerMonth === -1 ? "Unlimited" : `${p.consultations?.freePerMonth ?? 0}/mo`) : "Charged separately" },
    { key: "pharmacy",      label: "Pharmacy Discount",      icon: Pill,         getValue: (p) => p ? (p.pharmacy?.isFlat ? `Flat ${p.pharmacy?.discountMax}%` : `${p.pharmacy?.discountMin ?? 0}–${p.pharmacy?.discountMax ?? 0}%`) : "0%" },
    { key: "diagnostics",   label: "Diagnostic Discount",    icon: Microscope,   getValue: (p) => p ? `${p.diagnostics?.discountPercent ?? 0}%` : "0%" },
    { key: "transport",     label: "Transport Rate",         icon: Truck,        getValue: (p) => p ? (p.transport?.isApplicable ? `₹${p.transport?.ratePerKm ?? 0}/km` : "N/A") : "Market rate" },
    { key: "careAssistant", label: "Care Assistant",         icon: UserCheck,    getValue: (p) => p ? (p.careAssistant?.included ? (p.careAssistant?.serviceType || "Standard") : "—") : "Charged separately" },
    { key: "homeSample",    label: "Home Sample Collection", icon: Home,         getValue: (p) => p ? (p.diagnostics?.homeSampleCollection ? "Included" : "—") : "Extra charge" },
    { key: "members",       label: "Max Members",            icon: Users,        getValue: (p) => p ? `${p.membership?.maxMembers ?? 1}` : "1" },
    { key: "support",       label: "Support Tier",           icon: Zap,          getValue: (p) => p?.support?.tier || "Standard" },
    { key: "billing",       label: "Billing Cycle",          icon: Clock,        getValue: (p) => p?.pricing?.billingCycle === "till_delivery" ? "Till Delivery" : "Monthly" },
    { key: "hidden",        label: "Hidden Charges",         icon: Shield,       getValue: (p) => p?.features?.noHiddenCharges ? "None" : "May apply" },
    { key: "summary",       label: "Monthly Health Summary", icon: BarChart3,    getValue: (p) => p?.features?.monthlyHealthSummary ? "Yes" : "—" },
    { key: "cancel",        label: "No Cancel Charges",      icon: CheckCircle2, getValue: (p) => p?.features?.noCancellationCharges ? "Yes" : "—" },
    { key: "digital",       label: "Digital Reports",        icon: Activity,     getValue: (p) => p?.features?.digitalReportAccess ? "Yes" : "—" },
  ];

  const noPlan = null;
  const columns = mode === "overview" ? [noPlan, ...allFixedPlans] : allFixedPlans;

  const isHighlighted = (plan) => {
    if (mode === "overview") return plan !== null && TIER_META[plan.fixedTier || plan.name]?.popular;
    return (plan?.fixedTier || plan?.name) === currentPlanName;
  };

  return (
    <section aria-labelledby="compare-heading" className="space-y-4">
      <div className="w-full flex items-center justify-between flex-wrap gap-3">
        <div className="w-full ml-auto">
          <p className="text-[10px] text-center font-black uppercase tracking-widest text-base-content/40 mb-0.5">Compare</p>
          <h2 id="compare-heading" className="text-xl text-center  font-black text-base-content">Plan Comparison</h2>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-base-300 text-xs font-black"
          role="group" aria-label="Comparison view selector">
          <button
            onClick={() => setMode("overview")}
            className={`px-4  py-2 transition-colors ${mode === "overview"
              ? "bg-primary text-primary-content"
              : "bg-base-200 text-base-content hover:bg-base-300"}`}
            aria-pressed={mode === "overview"}>
            All Plans
          </button>
          {currentPlanName && (
            <button
              onClick={() => setMode("current")}
              className={`px-4 py-2 transition-colors ${mode === "current"
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content hover:bg-base-300"}`}
              aria-pressed={mode === "current"}>
              vs My Plan
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto w-full rounded-2xl border border-base-300">
        <table className="w-full text-xs" role="table" style={{ minWidth: "600px" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-base-200 px-4 py-3 text-left
                text-[10px] font-black uppercase tracking-widest text-base-content/60
                border-b border-r border-base-300"
                scope="col" style={{ minWidth: 140 }}>
                Feature
              </th>
              {columns.map((plan, ci) => {
                const name = plan ? (plan.fixedTier || plan.name) : "No Plan";
                const meta = plan ? getMeta(name) : null;
                const highlighted = isHighlighted(plan);
                return (
                  <th key={ci} className="px-4 py-3 text-center font-black border-b border-base-300"
                    scope="col"
                    style={{
                      minWidth: 120,
                      background: highlighted && meta ? `${meta.accent}12` : undefined,
                      borderBottom: highlighted && meta ? `2px solid ${meta.accent}` : undefined,
                    }}>
                    {plan ? (
                      <div className="flex flex-col items-center gap-1">
                        {highlighted && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full
                            text-[9px] font-black text-white mb-0.5"
                            style={{ background: meta?.gradientCSS }}>
                            {mode === "current"
                              ? <><BadgeCheck size={8} /> Current</>
                              : <><Flame size={8} fill="currentColor" /> Popular</>
                            }
                          </span>
                        )}
                        <span className="text-xs font-black"
                          style={{ color: highlighted && meta ? meta.accent : undefined }}>
                          {name}
                        </span>
                        <span className="text-[10px] font-bold text-base-content/50">
                          ₹{plan.pricing?.monthly}{plan.pricing?.billingLabel || "/mo"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-black text-base-content/60">No Plan</span>
                        <span className="text-[10px] font-bold text-base-content/40">Pay-per-use</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={row.key}
                className={`transition-colors ${ri % 2 === 0 ? "bg-base-100" : "bg-base-100/50"}`}>
                <td className="sticky left-0 z-10 px-4 py-3 border-r border-base-300
                  bg-base-200 font-semibold text-base-content/70" style={{ fontSize: "11px" }}>
                  <div className="flex items-center gap-1.5">
                    <row.icon size={10} className="flex-shrink-0" aria-hidden="true" />
                    {row.label}
                  </div>
                </td>
                {columns.map((plan, ci) => {
                  const val         = row.getValue(plan);
                  const highlighted = isHighlighted(plan);
                  const meta        = plan ? getMeta(plan.fixedTier || plan.name) : null;
                  const isBetter    = plan !== null && val !== "—" && val !== "0%" && val !== "0";
                  const isNoPlan    = plan === null;
                  return (
                    <td key={ci} className="px-4 py-3 text-center text-xs"
                      style={{ background: highlighted && meta ? `${meta.accent}06` : undefined }}>
                      {isNoPlan && row.key !== "price" && row.key !== "trial" ? (
                        <span className="text-base-content/35 font-semibold">{val}</span>
                      ) : isBetter ? (
                        <span className="font-black"
                          style={{ color: highlighted && meta ? meta.accent : undefined }}>
                          {val}
                        </span>
                      ) : (
                        <span className="text-base-content/40 font-semibold">{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Subscribe row */}
            <tr className="bg-base-200">
              <td className="sticky left-0 z-10 px-4 py-3 bg-base-300 border-r border-base-300
                text-[11px] font-black text-base-content/60">
                Action
              </td>
              {columns.map((plan, ci) => {
                if (!plan) {
                  return (
                    <td key={ci} className="px-4 py-3 text-center">
                      <span className="text-[10px] text-base-content/35 font-semibold">Current</span>
                    </td>
                  );
                }
                const name      = plan.fixedTier || plan.name;
                const meta      = getMeta(name);
                const isCurrent = name === currentPlanName;
                return (
                  <td key={ci} className="px-3 py-3 text-center">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                        text-[10px] font-black"
                        style={{ background: `${meta.accent}15`, color: meta.accent }}>
                        <BadgeCheck size={10} aria-hidden="true" /> Active
                      </span>
                    ) : hasAccess ? (
                      <button onClick={() => onUpgrade(plan)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                          text-[10px] font-black text-white transition-all hover:brightness-110"
                        style={{ background: meta.gradientCSS }}
                        aria-label={`Upgrade to ${name}`}>
                        <ArrowRight size={9} aria-hidden="true" /> Upgrade
                      </button>
                    ) : (
                      <button onClick={() => onSubscribe(plan)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                          text-[10px] font-black text-white transition-all hover:brightness-110"
                        style={{ background: meta.gradientCSS }}
                        aria-label={`Subscribe to ${name}`}>
                        <CreditCard size={9} aria-hidden="true" /> Subscribe
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
});

// ─── Page Skeleton ────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-10" role="status" aria-label="Loading">
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[520px] rounded-2xl" />)}
      </div>
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY_PLANS  = ["Basic Care", "Premium Care", "Family Care"];
const EXTENDED_PLANS = ["Pregnant Women Care", "NRI's Care"];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubscriptionPage() {
  const dispatch = useDispatch();

  const allPlans      = useSelector(selectAllPlans);
  const fixedPlans    = useSelector(selectFixedPlans);
  const myCustomPlans = useSelector(selectMyCustomPlans);
  const plansLoading  = useSelector(selectPlansLoading);

  const mySub          = useSelector(selectMySubscription);
  const hasAccess      = useSelector(selectMySubHasAccess);
  const upgradeLoading = useSelector(selectUpgradeLoading);

  const pendingOrder    = useSelector(selectPendingOrder);
  const purchaseLoading = useSelector(selectPurchaseLoading);
  const verifyLoading   = useSelector(selectVerifyLoading);

  const isTrialEligible     = useSelector(selectIsTrialEligible);
  const isOnActiveTrial     = useSelector(selectIsOnActiveTrial);
  const trialDaysLeft       = useSelector(selectTrialDaysLeft);
  const trialStatus         = useSelector(selectTrialStatus);
  const trialStatusLoading  = useSelector(selectTrialStatusLoading);
  const trialOrder          = useSelector(selectTrialOrder);
  const trialConvertLoading = useSelector(selectTrialConvertLoading);

  const [showExtended,      setShowExtended]      = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [editingCustomPlan, setEditingCustomPlan] = useState(null);
  const [checkoutPlan,      setCheckoutPlan]      = useState(null);
  const [toast,             setToast]             = useState(null);
  const [confirmDialog,     setConfirmDialog]     = useState(null);

  const showToast    = useCallback((message, type = "error") => setToast({ message, type }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const openConfirm  = useCallback((opts) => setConfirmDialog(opts), []);
  const closeConfirm = useCallback(() => setConfirmDialog(null), []);

  const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  useEffect(() => {
    dispatch(fetchAllPlans());
    dispatch(fetchMySubscription());
    dispatch(fetchTrialEligibility());
    dispatch(fetchTrialStatus());
  }, [dispatch]);

  useEffect(() => {
    const warmup = () => preconnectRazorpay();
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warmup, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(warmup, 2000);
    return () => clearTimeout(id);
  }, []);

  const prevMySubRef = useRef(null);
  useEffect(() => {
    if (checkoutPlan && mySub && !pendingOrder && mySub !== prevMySubRef.current) {
      setCheckoutPlan(null);
    }
    prevMySubRef.current = mySub;
  }, [mySub, pendingOrder, checkoutPlan]);

  useEffect(() => {
    if (!trialOrder?.orderId) return;
    (async () => {
      if (!RZP_KEY) { showToast("Payment gateway not configured.", "error"); dispatch(clearTrialOrder()); return; }
      const loaded = await loadRazorpay().catch(() => false);
      if (!loaded) { showToast("Failed to load payment gateway.", "error"); dispatch(clearTrialOrder()); return; }

      const planName = trialStatus?.plan?.name || trialOrder.planName || "";
      const meta = getMeta(planName);
      const amountInPaise = trialOrder.amount < 100000
        ? Math.round(trialOrder.amount * 100)
        : Math.round(trialOrder.amount);

      const rzp = new window.Razorpay({
        key: RZP_KEY,
        amount: amountInPaise,
        currency: trialOrder.currency || "INR",
        name: "Likeson Health",
        description: `Convert trial — ${planName}`,
        order_id: trialOrder.orderId,
        image: "/logo.png",
        handler: async (response) => {
          try {
            await dispatch(verifyTrialConversion({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: trialOrder.amount,
            }));
            dispatch(clearTrialOrder());
            showToast("Trial converted successfully!", "success");
          } catch { showToast("Payment verification failed.", "error"); }
        },
        prefill: { name: "", email: "", contact: "" },
        theme: { color: meta.accent || "#8b5cf6" },
        modal: { ondismiss: () => dispatch(clearTrialOrder()) },
      });
      rzp.on("payment.failed", (resp) => {
        showToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
        dispatch(clearTrialOrder());
      });
      rzp.open();
    })();
  }, [trialOrder?.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const primaryPlans = useMemo(
    () => PRIMARY_PLANS.map((n) => fixedPlans.find((p) => (p.fixedTier || p.name) === n)).filter(Boolean),
    [fixedPlans]
  );
  const extendedPlans = useMemo(
    () => EXTENDED_PLANS.map((n) => fixedPlans.find((p) => (p.fixedTier || p.name) === n)).filter(Boolean),
    [fixedPlans]
  );
  const currentPlanName = mySub?.plan?.fixedTier || mySub?.plan?.name || null;

  const handleSubscribe = useCallback((plan) => setCheckoutPlan(plan), []);

  const handleUpgrade = useCallback((plan) => {
    openConfirm({
      title: `Upgrade to ${plan.name}?`,
      message: "Billing period resets to 30 days from today.",
      confirmLabel: "Upgrade Now",
      accent: getMeta(plan.fixedTier || plan.name).accent,
      onConfirm: async () => {
        closeConfirm();
        try {
          const result = await dispatch(upgradeSubscription({ newPlanId: plan._id }));
          if (result?.error) showToast(result.error.message || "Upgrade failed.", "error");
          else showToast(`Upgraded to ${plan.name}!`, "success");
        } catch { showToast("Upgrade failed.", "error"); }
      },
    });
  }, [dispatch, openConfirm, closeConfirm, showToast]);

  const handleInitiatePay = useCallback(
    (payload) => dispatch(initiateSubscriptionPurchase(payload)),
    [dispatch]
  );
  const handleVerifyPay = useCallback(
    (payload) => dispatch(verifySubscriptionPayment(payload)),
    [dispatch]
  );

  const handleTrial = useCallback((plan) => {
    const days = plan.freeTrial?.durationDays ?? 7;
    openConfirm({
      title: `Start ${days}-day free trial?`,
      message: `Try ${plan.name} free for ${days} days. No payment required.`,
      confirmLabel: "Start Free Trial",
      accent: getMeta(plan.fixedTier || plan.name).accent,
      onConfirm: async () => {
        closeConfirm();
        try {
          const result = await dispatch(startFreeTrial({ planId: plan._id }));
          if (result?.error) showToast(result.error.message || "Could not start trial.", "error");
          else showToast(`${days}-day free trial started!`, "success");
        } catch { showToast("Could not start trial.", "error"); }
      },
    });
  }, [dispatch, openConfirm, closeConfirm, showToast]);

  const handleCloseCheckout      = useCallback(() => { setCheckoutPlan(null); dispatch(clearPendingOrder()); }, [dispatch]);
  const handleCloseCustomBuilder = useCallback(() => { setShowCustomBuilder(false); setEditingCustomPlan(null); }, []);
  const handleConvertTrial       = useCallback(() => { dispatch(initiateTrialConversion({})); }, [dispatch]);

  const handleDeleteCustomPlan = useCallback((planId, planName) => {
    openConfirm({
      title: "Delete custom plan?",
      message: `"${planName}" will be permanently deleted.`,
      confirmLabel: "Delete",
      accent: "#ef4444",
      onConfirm: async () => {
        closeConfirm();
        try { await dispatch(deleteCustomPlan(planId)); }
        catch { showToast("Failed to delete plan.", "error"); }
      },
    });
  }, [dispatch, openConfirm, closeConfirm, showToast]);

  if (plansLoading && allPlans.length === 0) return <PageSkeleton />;

  return (
    <>
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999]
          focus:px-4 focus:py-2 focus:rounded-xl focus:bg-white focus:text-black focus:font-bold focus:outline-none">
        Skip to main content
      </a>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "Likeson Health Subscription Plans",
            "provider": { "@type": "Organization", "name": "Likeson Health" },
            "offers": primaryPlans.map((p) => ({
              "@type": "Offer",
              "name": p.fixedTier || p.name,
              "price": p.pricing?.monthly ?? 0,
              "priceCurrency": "INR",
              "availability": "https://schema.org/InStock",
            })),
          }),
        }}
      />

      <main id="main-content" className="min-h-screen bg-base-100">
        <div className="  mx-auto   py-10 space-y-14">

          {/* Hero */}
          <section aria-labelledby="hero-heading" className="text-center space-y-4">
             <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-1"
              style={{
                background: "color-mix(in srgb, var(--primary), transparent 88%)",
                border: "1px solid color-mix(in srgb, var(--primary), transparent 70%)",
              }}
            >
              <HeartPulse size={14} style={{ color: "var(--primary)" }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--primary)" }}>
                Likeson Health Plans
              </span>
            </motion.div>
            <h1 id="hero-heading" className="text-3xl md:text-5xl font-black text-base-content leading-tight">
              Choose Your{" "}
              <span className="text-gradient-primary">Care Plan</span>
            </h1>
            <p className="text-sm md:text-base max-w-xl mx-auto text-base-content/50">
              Transparent pricing · No hidden charges · Cancel anytime
            </p>
            <div className="flex items-center justify-center gap-6 flex-wrap pt-2">
              {[
                { label: "No Hidden Charges", icon: Shield },
                { label: "7-Day Free Trial",  icon: Gift },
                { label: "Cancel Anytime",    icon: RefreshCw },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs font-bold text-base-content/50">
                  <item.icon size={12} aria-hidden="true" />
                  {item.label}
                </div>
              ))}
            </div>
          </section>

          {/* Active trial banner */}
          {isOnActiveTrial && trialStatus && (
            <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl flex-wrap"
              style={{
                background: "linear-gradient(90deg,#f59e0b,#8b5cf6,#3b82f6,#10b981)",
                boxShadow: "0 8px 32px rgba(245,158,11,0.3)",
              }}
              role="status" aria-live="polite"
              aria-label={`Free trial active: ${trialDaysLeft} days remaining`}>
              <div className="flex items-center gap-3">
                <Gift size={20} className="text-white" aria-hidden="true" />
                <div>
                  <p className="text-sm font-black text-white">Free Trial Active</p>
                  <p className="text-[11px] text-white/70">
                    {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining on{" "}
                    {trialStatus.plan?.name || "your plan"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleConvertTrial}
                disabled={trialConvertLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black
                  text-white bg-white/22 backdrop-blur-sm disabled:opacity-60 hover:bg-white/30 transition-colors"
                aria-label="Convert trial to paid" aria-busy={trialConvertLoading}>
                {trialConvertLoading
                  ? <><RefreshCw size={12} className="animate-spin" aria-hidden="true" /> Converting…</>
                  : <><CreditCard size={12} aria-hidden="true" /> Convert to Paid</>
                }
              </button>
            </div>
          )}

          {/* Trial eligibility notice */}
          {isTrialEligible && !hasAccess && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border
              bg-amber-500/[0.08] border-amber-500/25" role="note">
              <Gift size={16} className="text-amber-500 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs font-bold text-amber-500">
                You&apos;re eligible for a <strong>free trial</strong> — tap &quot;Free Trial&quot; on any plan below
              </p>
            </div>
          )}

          {/* Primary 3 plans */}
          <section aria-labelledby="standard-plans-heading">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-0.5">
                  Standard Plans
                </p>
                <h2 id="standard-plans-heading" className="text-xl font-black text-base-content">
                  Healthcare For Everyone
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full
                bg-primary/10 text-primary">
                <Zap size={10} aria-hidden="true" /> 7-day free trial on all plans
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {primaryPlans.map((plan) => (
                <PlanCard
                  key={plan._id}
                  plan={plan}
                  hasAccess={hasAccess}
                  isCurrent={hasAccess && currentPlanName === (plan.fixedTier || plan.name)}
                  onSubscribe={handleSubscribe}
                  onTrial={handleTrial}
                  onUpgrade={handleUpgrade}
                  trialEligible={isTrialEligible ?? true}
                  purchaseLoading={purchaseLoading || upgradeLoading}
                  trialLoading={trialStatusLoading}
                />
              ))}
            </div>
          </section>

          {/* More plans toggle */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setShowExtended((v) => !v)}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-black
                transition-all border border-base-300 bg-base-200
                hover:bg-base-300 text-base-content"
              aria-expanded={showExtended}
              aria-controls="extended-plans"
              aria-label={showExtended ? "Show fewer plans" : "Show Maternity and NRI plans"}>
              <ChevronDown size={16} aria-hidden="true"
                className={`transition-transform duration-300 ${showExtended ? "rotate-180" : ""}`} />
              {showExtended ? "Show fewer plans" : (
                <>
                  <Sparkles size={15} className="text-amber-500" aria-hidden="true" />
                  Explore Maternity &amp; NRI Plans
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-500">
                    {extendedPlans.length} more
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Extended plans */}
          {showExtended && (
            <section id="extended-plans" aria-labelledby="specialised-heading" className="space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-0.5">
                  Specialised
                </p>
                <h2 id="specialised-heading" className="text-xl font-black text-base-content">
                  Tailored For Your Life Stage
                </h2>
              </div>
              <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch">
                {extendedPlans.map((plan) => (
                  <div key={plan._id} className="w-full md:max-w-md">
                    <PlanCard
                      plan={plan}
                      hasAccess={hasAccess}
                      isCurrent={hasAccess && currentPlanName === (plan.fixedTier || plan.name)}
                      onSubscribe={handleSubscribe}
                      onTrial={handleTrial}
                      onUpgrade={handleUpgrade}
                      trialEligible={isTrialEligible ?? true}
                      purchaseLoading={purchaseLoading || upgradeLoading}
                      trialLoading={trialStatusLoading}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Comparison table */}
          {fixedPlans.length > 0 && (
            <InlineComparisonTable
              allFixedPlans={fixedPlans}
              currentPlanName={currentPlanName}
              onSubscribe={handleSubscribe}
              onUpgrade={handleUpgrade}
              hasAccess={hasAccess}
            />
          )}

          {/* Custom plan section */}
          <section aria-labelledby="custom-heading" className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-0.5">
                  Personalised
                </p>
                <h2 id="custom-heading" className="text-xl font-black text-base-content">
                  Build Your Own Plan
                </h2>
                <p className="text-xs text-base-content/50 mt-0.5">
                  Mix any services. Price calculated live from admin rates.
                </p>
              </div>
              {!showCustomBuilder && (
                <button
                  onClick={() => { setShowCustomBuilder(true); setEditingCustomPlan(null); }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black
                    text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: CUSTOM_META.gradientCSS, boxShadow: `0 4px 20px ${CUSTOM_META.glow}` }}
                  aria-label="Open custom plan builder">
                  <Plus size={15} aria-hidden="true" /> Create Custom Plan
                </button>
              )}
            </div>

            {showCustomBuilder && (
              <CustomPlanBuilder
                onClose={handleCloseCustomBuilder}
                existingCustomPlan={editingCustomPlan}
                onToast={showToast}
              />
            )}

            {/* Existing custom plans */}
            {myCustomPlans.length > 0 && !showCustomBuilder && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                  Your Custom Plans
                </p>
                {myCustomPlans.map((plan) => {
                  const planTotal = plan.pricing?.monthly ?? 0;
                  const isCurrent = currentPlanName === plan.name;
                  return (
                    <article key={plan._id}
                      className="relative overflow-hidden rounded-2xl border transition-all"
                      style={{
                        borderColor: isCurrent ? CUSTOM_META.accent : undefined,
                        borderWidth: isCurrent ? 2 : 1,
                        boxShadow: isCurrent ? `0 8px 32px ${CUSTOM_META.glow}` : undefined,
                      }}
                      aria-label={`${plan.name} custom plan, ₹${planTotal}/month${isCurrent ? ", active" : ""}`}>
                      {!isCurrent && <div className="absolute inset-0 border border-base-300 rounded-2xl pointer-events-none" />}
                      <div className="h-1.5 w-full" style={{ background: CUSTOM_META.gradientCSS }} aria-hidden="true" />
                      <div className="p-4 flex items-start gap-4 bg-base-100">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: CUSTOM_META.gradientCSS }} aria-hidden="true">
                          <Layers size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="text-sm font-black text-base-content">{plan.name}</h3>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: `${CUSTOM_META.accent}18`, color: CUSTOM_META.accent }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(plan.customOptions || []).filter((o) => o.quantity > 0).map((opt, oi) => (
                              <div key={oi}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 bg-base-200">
                                <span className="text-base-content/60">{opt.label}:</span>
                                <span className="text-base-content">{opt.quantity}</span>
                                <span style={{ color: CUSTOM_META.accent }}>= ₹{opt.lineTotal?.toFixed(0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-black" style={{ color: CUSTOM_META.accent }}
                            aria-label={`₹${planTotal}/month`}>
                            ₹{planTotal}
                          </p>
                          <p className="text-[10px] font-bold text-base-content/40">/month</p>
                        </div>
                      </div>
                      <div className="flex gap-2 px-4 pb-4 bg-base-100">
                        {!isCurrent && (
                          <button onClick={() => handleSubscribe(plan)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                              text-xs font-black text-white hover:brightness-110 transition-all"
                            style={{ background: CUSTOM_META.gradientCSS, boxShadow: `0 4px 16px ${CUSTOM_META.glow}` }}
                            aria-label={`Subscribe to ${plan.name}`}>
                            <CreditCard size={12} aria-hidden="true" /> Subscribe
                          </button>
                        )}
                        <button onClick={() => { setEditingCustomPlan(plan); setShowCustomBuilder(true); }}
                          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl
                            text-xs font-bold bg-base-200 hover:bg-base-300 transition-colors"
                          aria-label={`Edit ${plan.name}`}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteCustomPlan(plan._id, plan.name)}
                          className="flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-bold
                            bg-red-500/[0.08] text-red-500 hover:bg-red-500/15 transition-colors"
                          aria-label={`Delete ${plan.name}`}>
                          <X size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Empty custom plan CTA */}
            {myCustomPlans.length === 0 && !showCustomBuilder && (
              <button
                onClick={() => setShowCustomBuilder(true)}
                className="relative overflow-hidden rounded-2xl w-full text-left p-0 border-0
                  transition-transform duration-200 hover:-translate-y-1"
                style={{
                  background: `${CUSTOM_META.accent}08`,
                  outline: `2px dashed color-mix(in srgb, ${CUSTOM_META.accent}, transparent 55%)`,
                  minHeight: 120,
                }}
                aria-label="Create your first custom healthcare plan">
                <PlanPattern patternId="waves" uid="empty-custom" />
                <div className="relative z-10 flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: CUSTOM_META.gradientCSS }} aria-hidden="true">
                    <Plus size={22} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black" style={{ color: CUSTOM_META.accent }}>
                      Design Your Perfect Plan
                    </p>
                    <p className="text-[11px] mt-0.5 text-base-content/50">
                      Mix consultations, pharmacy discounts, transport &amp; more
                    </p>
                  </div>
                </div>
              </button>
            )}
          </section>

          {/* Trust footer */}
          <section aria-label="Why choose Likeson Health">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Shield,     label: "No Hidden Charges", desc: "Transparent pricing always" },
                { icon: RefreshCw,  label: "Cancel Anytime",    desc: "No lock-in contracts" },
                { icon: Award,      label: "Quality Assured",   desc: "Verified doctors & labs" },
                { icon: HeartPulse, label: "24/7 Support",      desc: "Always here when needed" },
              ].map((item, i) => (
                <div key={i}
                  className="flex flex-col items-center text-center gap-2 p-4 rounded-2xl
                    bg-base-200 border border-base-300 hover:border-primary/30 transition-colors">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10" aria-hidden="true">
                    <item.icon size={16} className="text-primary" />
                  </div>
                  <p className="text-xs font-black text-base-content">{item.label}</p>
                  <p className="text-[10px] font-semibold text-base-content/45">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      {/* Checkout modal */}
      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          pendingOrder={pendingOrder}
          onClose={handleCloseCheckout}
          onInitiatePay={handleInitiatePay}
          onVerifyPay={handleVerifyPay}
          purchaseLoading={purchaseLoading}
          verifyLoading={verifyLoading}
          onToast={showToast}
        />
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        accent={confirmDialog?.accent}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
    </>
  );
}