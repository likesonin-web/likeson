"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, Truck, Pill, Microscope, UserCheck, Home,
  CheckCircle2, X, ChevronDown, ChevronUp, Plus, Minus,
  Sparkles, Crown, Shield, Users, HeartPulse, Rocket,
  Zap, Star, Clock, ArrowRight, Gift, RefreshCw, Tag,
  AlertCircle, BadgeCheck, Layers, Pencil, Info, Lock,
  FlaskConical, Activity, Globe, Infinity as InfinityIcon,
  ChevronRight, Flame, Award, CreditCard, Percent, Package,
} from "lucide-react";

import {
  fetchAllPlans,
  fetchCustomPlanPricing,
  createCustomPlan,
  updateCustomPlan,
  deleteCustomPlan,
  fetchMySubscription,
  fetchMySubscriptionHistory,
  initiateSubscriptionPurchase,
  verifySubscriptionPayment,
  cancelSubscription,
  toggleAutoRenew,
  upgradeSubscription,
  startFreeTrial,
  fetchTrialEligibility,
  fetchTrialStatus,
  initiateTrialConversion,
  verifyTrialConversion,
  optimisticToggleAutoRenew,
  clearPendingOrder,
  clearTrialOrder,
  selectAllPlans,
  selectFixedPlans,
  selectMyCustomPlans,
  selectPlansLoading,
  selectCustomPlanPricing,
  selectCustomPlanPricingLoading,
  selectCustomPlanLoading,
  selectCustomPlanError,
  selectPendingOrder,
  selectPurchaseLoading,
  selectVerifyLoading,
  selectMySubscription,
  selectMySubIsActive,
  selectMySubIsOnTrial,
  selectMySubAutoRenew,
  selectMySubLoading,
  selectMyHistory,
  selectMyHistoryPagination,
  selectMyHistoryLoading,
  selectUpgradeLoading,
  selectCancelLoading,
  selectToggleAutoRenewLoading,
  selectTrialEligibility,
  selectIsTrialEligible,
  selectTrialStatus,
  selectIsOnActiveTrial,
  selectTrialDaysLeft,
  selectTrialStatusLoading,
  selectTrialOrder,
  selectTrialConvertLoading,
  selectTrialVerifyConvertLoading,
} from "@/store/slices/subscriptionSlice";
import BackButton from "../../components/BackButton";

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const TIER = {
  "Basic Care": {
    gradient:     "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(59,130,246,.18) 0%,rgba(29,78,216,.08) 100%)",
    accent:       "#3b82f6",
    glow:         "rgba(59,130,246,0.35)",
    icon:         Shield,
    tag:          "Starter",
    tagline:      "Essential individual coverage",
    patternId:    "zigzag",
    popular:      false,
  },
  "Premium Care": {
    gradient:     "linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(139,92,246,.18) 0%,rgba(109,40,217,.08) 100%)",
    accent:       "#8b5cf6",
    glow:         "rgba(139,92,246,0.4)",
    icon:         Crown,
    tag:          "Most Popular",
    tagline:      "Top-tier comprehensive care",
    patternId:    "diamonds",
    popular:      true,
  },
  "Family Care": {
    gradient:     "linear-gradient(135deg,#10b981 0%,#059669 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(16,185,129,.18) 0%,rgba(5,150,105,.08) 100%)",
    accent:       "#10b981",
    glow:         "rgba(16,185,129,0.35)",
    icon:         Users,
    tag:          "Best Value",
    tagline:      "Complete family protection",
    patternId:    "circles",
    popular:      false,
  },
  "Pregnant Women Care": {
    gradient:     "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(245,158,11,.18) 0%,rgba(217,119,6,.08) 100%)",
    accent:       "#f59e0b",
    glow:         "rgba(245,158,11,0.35)",
    icon:         HeartPulse,
    tag:          "Maternity",
    tagline:      "End-to-end maternity care",
    patternId:    "hearts",
    popular:      false,
  },
  "NRI's Care": {
    gradient:     "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(239,68,68,.18) 0%,rgba(185,28,28,.08) 100%)",
    accent:       "#ef4444",
    glow:         "rgba(239,68,68,0.35)",
    icon:         Globe,
    tag:          "NRI Special",
    tagline:      "Cross-border healthcare",
    patternId:    "grid",
    popular:      false,
  },
};

const CUSTOM_TIER = {
  gradient:     "linear-gradient(135deg,#0ea5e9 0%,#7c3aed 100%)",
  gradientSoft: "linear-gradient(135deg,rgba(14,165,233,.18) 0%,rgba(124,58,237,.08) 100%)",
  accent:       "#0ea5e9",
  glow:         "rgba(14,165,233,0.35)",
  icon:         Layers,
  tag:          "Personalised",
  tagline:      "Build your own healthcare bundle",
  patternId:    "waves",
  popular:      false,
};

const getTier = (name) => TIER[name] || CUSTOM_TIER;

// ─────────────────────────────────────────────────────────────────────────────
//  SVG STROKE PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
const PATTERNS = {
  zigzag: (id) => (
    <pattern id={id} x="0" y="0" width="24" height="12" patternUnits="userSpaceOnUse">
      <polyline points="0,12 6,0 12,12 18,0 24,12" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </pattern>
  ),
  diamonds: (id) => (
    <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="white" strokeWidth="1" />
    </pattern>
  ),
  circles: (id) => (
    <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="0.9" />
    </pattern>
  ),
  hearts: (id) => (
    <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M12,20 C12,20 3,13 3,7.5 C3,5 5,3 7.5,3 C9.24,3 10.91,4.1 12,5.5 C13.09,4.1 14.76,3 16.5,3 C19,3 21,5 21,7.5 C21,13 12,20 12,20Z" fill="none" stroke="white" strokeWidth="0.9" />
    </pattern>
  ),
  grid: (id) => (
    <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0L0 0 0 20" fill="none" stroke="white" strokeWidth="0.7" />
    </pattern>
  ),
  waves: (id) => (
    <pattern id={id} x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse">
      <path d="M0,8 Q8,0 16,8 Q24,16 32,8" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
    </pattern>
  ),
};

function PlanPattern({ patternId, planName }) {
  const uid = `pat-${patternId}-${planName?.replace(/[\s']/g, "")}`;
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
//  POPULAR BADGE
// ─────────────────────────────────────────────────────────────────────────────
function PopularTopBadge({ color, label = "Most Popular" }) {
  return (
    <>
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[calc(var(--r-box,12px)+1px)] z-10 pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${color}aa, ${color}, ${color}aa)` }}
      />
      <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <motion.span
          initial={{ opacity: 0, y: -6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg whitespace-nowrap"
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: "white",
            boxShadow: `0 4px 16px ${color}55`,
          }}
        >
          <Flame size={9} />
          {label}
        </motion.span>
      </div>
      <div
        className="absolute -inset-[2px] rounded-[calc(var(--r-box,12px)+2px)] pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${color}22, transparent 60%, ${color}11)`,
          zIndex: -1,
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  BENEFIT ROW
// ─────────────────────────────────────────────────────────────────────────────
function BenefitRow({ icon: Icon, label, value, active, accent, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: active ? 1 : 0.28, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex items-center gap-2.5 py-2"
      style={{ borderBottom: "1px solid color-mix(in srgb,var(--base-content),transparent 91%)" }}
    >
      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: active ? `${accent}18` : "var(--base-300)" }}>
        <Icon size={12} style={{ color: active ? accent : "inherit" }} />
      </div>
      <span className="text-xs font-semibold flex-1 text-base-content">{label}</span>
      <span className="text-[11px] font-black" style={{ color: active ? accent : "inherit" }}>{value}</span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN CARD
// ─────────────────────────────────────────────────────────────────────────────
function PlanCard({ plan, isActive, isCurrent, onSubscribe, onTrial, onUpgrade, trialEligible, purchaseLoading, trialLoading, index }) {
  const name      = plan.fixedTier || plan.name;
  const t         = getTier(name);
  const TIcon     = t.icon;
  const monthly   = plan.pricing?.monthly ?? 0;
  const billingLabel = plan.pricing?.billingLabel || "/month";
  const consults  = plan.consultations?.freePerMonth ?? 0;
  const pharmMax  = plan.pharmacy?.discountMax ?? plan.pharmacy?.discountMin ?? 0;
  const diagDisc  = plan.diagnostics?.discountPercent ?? 0;
  const maxMem    = plan.membership?.maxMembers ?? 1;
  const careInc   = plan.careAssistant?.included ?? false;
  const homeLab   = plan.diagnostics?.homeSampleCollection ?? false;
  const transport = plan.transport?.isApplicable ?? true;
  const trialDays = plan.freeTrial?.enabled ? plan.freeTrial.durationDays : 0;

  const benefits = [
    { icon: Stethoscope, label: "Doctor Consultations", value: consults === -1 ? "Unlimited" : `${consults}/month`, active: consults !== 0 },
    { icon: Pill,        label: "Pharmacy Discount",    value: plan.pharmacy?.isFlat ? `Flat ${pharmMax}%` : `${plan.pharmacy?.discountMin ?? 0}–${pharmMax}%`, active: pharmMax > 0 },
    { icon: Microscope,  label: "Diagnostic Discount",  value: `${diagDisc}%`, active: diagDisc > 0 },
    { icon: Truck,       label: "Medical Transport",    value: transport ? `₹${plan.transport?.ratePerKm ?? 0}/km` : "N/A", active: transport },
    { icon: UserCheck,   label: "Care Assistant",       value: careInc ? plan.careAssistant?.serviceType || "Standard" : "Not Included", active: careInc },
    { icon: Home,        label: "Home Sample Collection", value: homeLab ? "Available" : "Not Available", active: homeLab },
  ];

  const features = [
    plan.features?.noHiddenCharges       && "No hidden charges",
    plan.features?.monthlyHealthSummary  && "Monthly health summary",
    plan.features?.noCancellationCharges && "No cancellation charges",
    plan.features?.autoRefillReminders   && "Auto refill reminders",
    plan.features?.digitalReportAccess   && "Digital report access",
    ...(plan.features?.additionalFeatures ?? []),
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ delay: index * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, scale: 1.012 }}
      className="relative flex flex-col"
      style={{
        zIndex: t.popular ? 2 : 1,
        paddingTop: t.popular ? "18px" : "0px",
      }}
    >
      {t.popular && <PopularTopBadge color={t.accent} label={t.tag} />}

      <div
        className="relative flex flex-col h-full overflow-hidden"
        style={{
          background: "var(--base-100)",
          border: isCurrent
            ? `2px solid ${t.accent}`
            : t.popular
            ? `2px solid ${t.accent}60`
            : "1.5px solid var(--base-300)",
          borderRadius: "var(--r-box)",
          boxShadow: t.popular
            ? `0 20px 60px ${t.glow}, 0 0 0 0 transparent`
            : "0 4px 20px rgba(0,0,0,0.06)",
          maskImage: "linear-gradient(#fff, #fff)",
        }}
      >
        {/* Gradient header */}
        <div className="relative overflow-hidden flex-shrink-0" style={{ background: t.gradient, minHeight: 148 }}>
          <PlanPattern patternId={t.patternId} planName={name} />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
            className="absolute -right-10 -top-10 w-36 h-36 rounded-full pointer-events-none"
            style={{ border: "22px solid rgba(255,255,255,0.08)" }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute -right-2 -top-2 w-16 h-16 rounded-full pointer-events-none"
            style={{ border: "10px solid rgba(255,255,255,0.06)" }}
          />

          <div className="relative z-10 p-5">
            <div className="flex items-center justify-between mb-3">
              {!t.popular && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{ background: "rgba(255,255,255,0.22)", color: "white", backdropFilter: "blur(4px)" }}
                >
                  {t.tag}
                </span>
              )}
              {t.popular && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{ background: "rgba(255,255,255,0.22)", color: "white", backdropFilter: "blur(4px)" }}
                >
                  <Crown size={9} /> Premium
                </span>
              )}
              {isCurrent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black"
                  style={{ background: "rgba(255,255,255,0.22)", color: "white" }}>
                  <BadgeCheck size={10} /> Current
                </span>
              )}
            </div>

            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
                    <TIcon size={16} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    {maxMem === 1 ? "Individual" : `Up to ${maxMem} members`}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white leading-tight">{name}</h3>
                <p className="text-white/55 text-[11px] mt-0.5 leading-tight">{t.tagline}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-[9px] text-white/45 uppercase font-bold mb-0.5">{billingLabel}</p>
                <p className="text-3xl font-black text-white leading-none">₹{monthly}</p>
                {trialDays > 0 && (
                  <p className="text-[10px] text-white/55 mt-0.5 font-bold">{trialDays}d free trial</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="px-5 pt-4 pb-1">
          {benefits.map((b, i) => (
            <BenefitRow key={i} {...b} accent={t.accent} delay={0.05 + i * 0.04} />
          ))}
        </div>

        {/* Feature pills */}
        {features.length > 0 && (
          <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5">
            {features.slice(0, 4).map((f, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full"
                style={{ background: `${t.accent}12`, color: t.accent }}
              >
                <CheckCircle2 size={8} />
                {f}
              </motion.span>
            ))}
            {features.length > 4 && (
              <span className="text-[9px] font-bold px-2 py-1 rounded-full"
                style={{ background: "var(--base-300)", opacity: 0.65 }}>
                +{features.length - 4} more
              </span>
            )}
          </div>
        )}

        {plan.idealFor && (
          <div className="px-5 pt-2">
            <p className="text-[10px] font-semibold" style={{ opacity: 0.45 }}>
              <Info size={9} className="inline mr-1" />
              Ideal for: {plan.idealFor}
            </p>
          </div>
        )}

        {/* CTA buttons */}
        <div className="p-5 mt-auto space-y-2">
          {isCurrent ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black"
              style={{ background: `${t.accent}15`, color: t.accent, border: `1.5px solid ${t.accent}40` }}>
              <BadgeCheck size={14} /> Active Plan
            </div>
          ) : isActive ? (
            <button
              onClick={() => onUpgrade(plan)}
              disabled={purchaseLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all"
              style={{ background: t.gradient, color: "white", boxShadow: `0 4px 16px ${t.glow}` }}
            >
              {purchaseLoading ? <RefreshCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}
              Upgrade to {name.split(" ")[0]}
            </button>
          ) : (
            <>
              <button
                onClick={() => onSubscribe(plan)}
                disabled={purchaseLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all"
                style={{ background: t.gradient, color: "white", boxShadow: `0 4px 20px ${t.glow}` }}
              >
                {purchaseLoading ? <RefreshCw size={13} className="animate-spin" /> : <CreditCard size={13} />}
                Subscribe — ₹{monthly}{billingLabel}
              </button>
              {trialDays > 0 && trialEligible && (
                <button
                  onClick={() => onTrial(plan)}
                  disabled={trialLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{ background: `${t.accent}12`, color: t.accent, border: `1.5px solid ${t.accent}30` }}
                >
                  {trialLoading ? <RefreshCw size={12} className="animate-spin" /> : <Gift size={12} />}
                  Start {trialDays}-Day Free Trial
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOM PLAN BUILDER  — transport uses dropdown only (no stepper)
// ─────────────────────────────────────────────────────────────────────────────
const OPTION_KEYS = [
  { key: "consultations",        icon: Stethoscope,  label: "Doctor Consultations",  unit: "consults/mo",  isToggle: false, isTransport: false },
  { key: "transport",            icon: Truck,        label: "Medical Transport",      unit: "slab",         isToggle: false, isTransport: true  },
  { key: "diagnostics",          icon: Microscope,   label: "Diagnostic Discount",    unit: "% off",        isToggle: false, isTransport: false },
  { key: "pharmacy",             icon: Pill,         label: "Pharmacy Discount",      unit: "% off",        isToggle: false, isTransport: false },
  { key: "careAssistant",        icon: UserCheck,    label: "Care Assistant Visits",  unit: "visits/mo",    isToggle: false, isTransport: false },
  { key: "homeSampleCollection", icon: Home,         label: "Home Sample Collection", unit: "add-on",       isToggle: true,  isTransport: false },
  { key: "prioritySupport",      icon: Zap,          label: "Priority Support",       unit: "add-on",       isToggle: true,  isTransport: false },
];

function CustomPlanBuilder({ onClose, existingCustomPlan }) {
  const dispatch     = useDispatch();
  const pricing      = useSelector(selectCustomPlanPricing);
  const priceLoading = useSelector(selectCustomPlanPricingLoading);
  const saveLoading  = useSelector(selectCustomPlanLoading);
  const saveError    = useSelector(selectCustomPlanError);

  const [planName, setPlanName] = useState(existingCustomPlan?.name || "My Custom Plan");

  // ── quantities: for transport stores selected slab index (-1 = not selected)
  const [quantities, setQuantities] = useState(() => {
    if (existingCustomPlan?.customOptions) {
      const map = Object.fromEntries(
        existingCustomPlan.customOptions.map((o) => [o.optionKey, o.quantity])
      );
      // transport quantity stored as slabIndex; -1 if absent
      if (!("transport" in map)) map.transport = -1;
      return map;
    }
    const defaults = Object.fromEntries(OPTION_KEYS.map((o) => [o.key, 0]));
    defaults.transport = -1; // -1 = no slab selected
    return defaults;
  });

  useEffect(() => { dispatch(fetchCustomPlanPricing()); }, [dispatch]);

  const unitPrices = pricing?.unitPrices || {};
  const caps       = pricing?.caps || {};

  // kmSlabs from pricing if available, otherwise empty
  const kmSlabs = pricing?.transport?.kmSlabs ?? pricing?.kmSlabs ?? [];

  const PRICE_MAP = {
    consultations:        unitPrices.consultationPricePerUnit           || 150,
    diagnostics:          unitPrices.diagnosticsDiscountPricePerPercent || 20,
    pharmacy:             unitPrices.pharmacyDiscountPricePerPercent    || 25,
    careAssistant:        unitPrices.careAssistantVisitPricePerUnit     || 120,
    homeSampleCollection: unitPrices.homeSampleCollectionFlatPrice      || 199,
    prioritySupport:      unitPrices.prioritySupportFlatPrice           || 99,
  };

  const CAP_MAP = {
    consultations: caps.consultationsMaxPerMonth       || 30,
    diagnostics:   caps.diagnosticsDiscountMax         || 25,
    pharmacy:      caps.pharmacyDiscountMax            || 25,
    careAssistant: caps.careAssistantMaxVisitsPerMonth || 30,
  };

  // ── Compute transport line total from selected slab
  const transportLineTotal = useMemo(() => {
    const slabIdx = quantities.transport;
    if (slabIdx < 0 || !kmSlabs.length) return 0;
    const slab = kmSlabs[slabIdx];
    return slab ? slab.packagePrice ?? slab.price ?? 0 : 0;
  }, [quantities.transport, kmSlabs]);

  const transportSlabLabel = useMemo(() => {
    const slabIdx = quantities.transport;
    if (slabIdx < 0 || !kmSlabs.length) return "";
    const slab = kmSlabs[slabIdx];
    if (!slab) return "";
    return `₹${slab.pricePerKm ?? slab.ratePerKm ?? 0}/km · Bundle ₹${slab.packagePrice ?? slab.price ?? 0}/mo`;
  }, [quantities.transport, kmSlabs]);

  const total = useMemo(() => {
    let sum = 0;
    for (const [key, qty] of Object.entries(quantities)) {
      if (key === "transport") {
        sum += transportLineTotal;
      } else {
        sum += Math.max(0, qty) * (PRICE_MAP[key] || 0);
      }
    }
    return sum;
  }, [quantities, PRICE_MAP, transportLineTotal]);

  const setQty = (key, val) => {
    const max = CAP_MAP[key] ?? 1;
    setQuantities((q) => ({ ...q, [key]: Math.max(0, Math.min(max, val)) }));
  };

  // ── Transport slab select handler
  const handleTransportChange = (e) => {
    const val = e.target.value;
    setQuantities((q) => ({ ...q, transport: val === "" ? -1 : Number(val) }));
  };

  const handleSave = async () => {
    const options = [];

    for (const opt of OPTION_KEYS) {
      if (opt.isTransport) {
        const slabIdx = quantities.transport;
        if (slabIdx >= 0 && kmSlabs[slabIdx]) {
          const slab = kmSlabs[slabIdx];
          options.push({
            optionKey:  "transport",
            label:      opt.label,
            quantity:   slabIdx,           // store slab index as quantity
            unitPrice:  slab.pricePerKm ?? slab.ratePerKm ?? 0,
            lineTotal:  slab.packagePrice ?? slab.price ?? 0,
            slabIndex:  slabIdx,
          });
        }
      } else {
        const qty = quantities[opt.key] ?? 0;
        if (qty > 0) {
          options.push({
            optionKey: opt.key,
            label:     opt.label,
            quantity:  qty,
          });
        }
      }
    }

    if (options.length === 0) return;
    const payload = { name: planName, options };
    const action  = existingCustomPlan
      ? dispatch(updateCustomPlan({ planId: existingCustomPlan._id, ...payload }))
      : dispatch(createCustomPlan(payload));
    const res = await action;
    if (!res.error) onClose();
  };

  return (
    <div className="w-full flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl w-full max-w-xl"
        style={{
          background:  "var(--base-100)",
          border:      "1.5px solid #0ea5e9",
          boxShadow:   "0 20px 60px rgba(14,165,233,0.2)",
        }}
      >
        {/* Header */}
        <div className="relative overflow-hidden px-6 py-5" style={{ background: CUSTOM_TIER.gradient }}>
          <PlanPattern patternId="waves" planName="custom" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-2"
                style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                <Sparkles size={9} /> Build Your Plan
              </span>
              <input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="block text-xl font-black text-white bg-transparent border-none outline-none w-full truncate"
                placeholder="Name your plan…"
              />
              <p className="text-white/50 text-[11px] mt-0.5">Select what matters most to you</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] text-white/45 uppercase font-bold mb-0.5">Estimated</p>
              <motion.p key={total} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
                className="text-3xl font-black text-white">
                ₹{total}
              </motion.p>
              <p className="text-white/45 text-[10px]">/month</p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {priceLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw size={20} className="animate-spin" style={{ color: "#0ea5e9" }} />
            </div>
          ) : (
            OPTION_KEYS.map((opt) => {
              // ── Transport: dropdown-only logic ──
              if (opt.isTransport) {
                const slabIdx   = quantities.transport;
                const active    = slabIdx >= 0;
                const lineTotal = transportLineTotal;

                return (
                  <motion.div
                    key={opt.key}
                    animate={{ opacity: active ? 1 : 0.6 }}
                    className="flex items-start gap-3 p-3.5 rounded-xl transition-all"
                    style={{
                      background: active ? `${CUSTOM_TIER.accent}0e` : "var(--base-200)",
                      border: active ? `1.5px solid ${CUSTOM_TIER.accent}35` : "1.5px solid var(--base-300)",
                    }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: active ? `${CUSTOM_TIER.accent}20` : "var(--base-300)" }}>
                      <opt.icon size={14} style={{ color: active ? CUSTOM_TIER.accent : "inherit" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-base-content mb-1">{opt.label}</p>
                      {/* Slab dropdown — always visible */}
                      <select
                        value={slabIdx === -1 ? "" : slabIdx}
                        onChange={handleTransportChange}
                        className="input-field text-sm py-2 px-3 rounded-xl w-full"
                        style={{ background: "var(--base-100)", border: "1.5px solid var(--base-300)" }}
                      >
                        <option value="">— Not included —</option>
                        {kmSlabs.length > 0
                          ? kmSlabs.map((slab, i) => (
                              <option key={i} value={i}>
                                ₹{slab.pricePerKm ?? slab.ratePerKm ?? 0}/km · Bundle ₹{slab.packagePrice ?? slab.price ?? 0}/mo
                              </option>
                            ))
                          : (
                              // Fallback options if kmSlabs not in pricing yet
                              [
                                { label: "₹8/km · Bundle ₹299/mo",  pricePerKm: 8,  packagePrice: 299  },
                                { label: "₹12/km · Bundle ₹499/mo", pricePerKm: 12, packagePrice: 499  },
                                { label: "₹15/km · Bundle ₹699/mo", pricePerKm: 15, packagePrice: 699  },
                              ].map((s, i) => (
                                <option key={i} value={i}>{s.label}</option>
                              ))
                            )
                        }
                      </select>
                      {active && transportSlabLabel && (
                        <p className="text-[10px] font-bold mt-1.5" style={{ color: CUSTOM_TIER.accent }}>
                          ↳ {transportSlabLabel}
                        </p>
                      )}
                    </div>
                    {active && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] font-black flex-shrink-0 w-14 text-right mt-0.5"
                        style={{ color: CUSTOM_TIER.accent }}
                      >
                        ₹{lineTotal}
                      </motion.span>
                    )}
                  </motion.div>
                );
              }

              // ── All other options: original stepper / toggle logic ──
              const qty       = quantities[opt.key] ?? 0;
              const unitPrice = PRICE_MAP[opt.key] || 0;
              const lineTotal = qty * unitPrice;
              const max       = CAP_MAP[opt.key] ?? 1;
              const active    = qty > 0;

              return (
                <motion.div
                  key={opt.key}
                  animate={{ opacity: active ? 1 : 0.6 }}
                  className="flex items-center gap-3 p-3.5 rounded-xl transition-all"
                  style={{
                    background: active ? `${CUSTOM_TIER.accent}0e` : "var(--base-200)",
                    border: active ? `1.5px solid ${CUSTOM_TIER.accent}35` : "1.5px solid var(--base-300)",
                  }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: active ? `${CUSTOM_TIER.accent}20` : "var(--base-300)" }}>
                    <opt.icon size={14} style={{ color: active ? CUSTOM_TIER.accent : "inherit" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-base-content">{opt.label}</p>
                    <p className="text-[10px] font-bold mt-0.5" style={{ opacity: 0.45 }}>
                      ₹{unitPrice}/{opt.unit}
                      {!opt.isToggle && max && <span className="ml-1">(max {max})</span>}
                    </p>
                  </div>

                  {opt.isToggle ? (
                    <button
                      type="button"
                      onClick={() => setQty(opt.key, qty > 0 ? 0 : 1)}
                      className="relative flex-shrink-0 rounded-full transition-all duration-300"
                      style={{ width: 44, height: 24, background: active ? CUSTOM_TIER.accent : "var(--base-300)" }}
                    >
                      <motion.div
                        animate={{ x: active ? 22 : 2 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-1 w-4 h-4 rounded-full shadow-sm"
                        style={{ background: "white" }}
                      />
                    </button>
                  ) : (
                    <div className="flex items-center gap-0 rounded-xl overflow-hidden flex-shrink-0"
                      style={{ border: "1.5px solid var(--base-300)" }}>
                      <button onClick={() => setQty(opt.key, qty - 1)}
                        className="w-8 h-8 flex items-center justify-center transition-all"
                        style={{ background: "var(--base-200)" }}>
                        <Minus size={10} />
                      </button>
                      <span className="w-8 text-center text-sm font-black" style={{ background: "var(--base-100)" }}>
                        {qty}
                      </span>
                      <button onClick={() => setQty(opt.key, qty + 1)}
                        className="w-8 h-8 flex items-center justify-center transition-all"
                        style={{ background: "var(--base-200)" }}>
                        <Plus size={10} />
                      </button>
                    </div>
                  )}

                  {active && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[10px] font-black flex-shrink-0 w-14 text-right"
                      style={{ color: CUSTOM_TIER.accent }}
                    >
                      ₹{lineTotal}
                    </motion.span>
                  )}
                </motion.div>
              );
            })
          )}

          {saveError && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold"
              style={{ background: "rgba(239,68,68,.1)", color: "#ef4444" }}>
              <AlertCircle size={13} /> {saveError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              style={{ background: "var(--base-300)" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saveLoading || total === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black text-white transition-all"
              style={{
                background: CUSTOM_TIER.gradient,
                opacity: saveLoading || total === 0 ? 0.65 : 1,
                boxShadow: `0 4px 20px ${CUSTOM_TIER.glow}`,
              }}>
              {saveLoading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {existingCustomPlan ? "Update Plan" : "Create Plan"} — ₹{total}/mo
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MY SUBSCRIPTION PANEL
// ─────────────────────────────────────────────────────────────────────────────
function MySubscriptionPanel({ sub, trialStatus, onCancel, onToggleAutoRenew, onConvertTrial, cancelLoading, toggleLoading, trialConvertLoading }) {
  const plan      = sub.plan;
  const name      = plan?.fixedTier || plan?.name || "Unknown Plan";
  const t         = getTier(name);
  const TIcon     = t.icon;
  const expiry    = sub.expiryDate ? new Date(sub.expiryDate) : null;
  const daysLeft  = expiry ? Math.max(0, Math.ceil((expiry - Date.now()) / 86400000)) : 0;
  const isExpiring = daysLeft <= 7 && daysLeft > 0;
  const progress  = expiry ? Math.min(100, Math.max(0, (1 - daysLeft / 30) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "var(--base-100)",
        border: `2px solid ${t.accent}`,
        boxShadow: `0 12px 40px ${t.glow}`,
      }}
    >
      {/* Header */}
      <div className="relative overflow-hidden px-5 py-4" style={{ background: t.gradient }}>
        <PlanPattern patternId={t.patternId} planName={name} />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
              <TIcon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] text-white/55 font-bold uppercase tracking-widest">
                {sub.status === "Trial" ? "Free Trial" : "Active Plan"}
              </p>
              <h3 className="text-lg font-black text-white leading-tight">{name}</h3>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black"
              style={{ background: sub.status === "Trial" ? "rgba(245,158,11,.3)" : "rgba(255,255,255,0.2)", color: "white" }}>
              {sub.status === "Trial" ? <Clock size={9} /> : <BadgeCheck size={9} />}
              {sub.status}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x"
        style={{ borderBottom: "1px solid var(--base-300)" }}>
        {[
          { label: "Days Left",  val: daysLeft, icon: Clock,     warn: isExpiring },
          { label: "Members",    val: plan?.membership?.maxMembers ?? 1, icon: Users },
          { label: "Auto-Renew", val: sub.autoRenew ? "On" : "Off", icon: RefreshCw },
        ].map((s, i) => (
          <div key={i} className="flex flex-col items-center py-3">
            <s.icon size={12} style={{ color: s.warn ? "#ef4444" : t.accent, marginBottom: 2 }} />
            <span className="text-sm font-black" style={{ color: s.warn ? "#ef4444" : "var(--base-content)" }}>
              {s.val}
            </span>
            <span className="text-[9px] font-bold uppercase" style={{ opacity: 0.4 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center justify-between text-[10px] font-bold mb-2" style={{ opacity: 0.55 }}>
          <span>Billing period progress</span>
          <span>{expiry ? expiry.toLocaleDateString("en-IN") : "—"}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--base-300)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: isExpiring ? "#ef4444" : t.gradient }}
          />
        </div>
        {isExpiring && (
          <motion.p
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-[10px] font-bold mt-1.5 flex items-center gap-1"
            style={{ color: "#ef4444" }}
          >
            <AlertCircle size={10} /> Expiring soon — renew to avoid interruption
          </motion.p>
        )}
      </div>

      {/* Trial convert CTA */}
      {sub.status === "Trial" && (
        <div className="px-5 pb-4 pt-3">
          <button
            onClick={onConvertTrial}
            disabled={trialConvertLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black text-white"
            style={{ background: t.gradient, boxShadow: `0 4px 20px ${t.glow}` }}
          >
            {trialConvertLoading ? <RefreshCw size={13} className="animate-spin" /> : <CreditCard size={13} />}
            Convert to Paid — ₹{plan?.pricing?.monthly ?? 0}/month
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 p-5 pt-2" style={{ borderTop: "1px solid var(--base-300)" }}>
        <button
          onClick={onToggleAutoRenew}
          disabled={toggleLoading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
          style={{
            background: sub.autoRenew ? `${t.accent}15` : "var(--base-200)",
            color: sub.autoRenew ? t.accent : "var(--base-content)",
            border: sub.autoRenew ? `1.5px solid ${t.accent}40` : "1.5px solid var(--base-300)",
          }}
        >
          {toggleLoading ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Auto-renew {sub.autoRenew ? "On" : "Off"}
        </button>
        <button
          onClick={onCancel}
          disabled={cancelLoading}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
          style={{ background: "rgba(239,68,68,.08)", color: "#ef4444", border: "1.5px solid rgba(239,68,68,.25)" }}
        >
          {cancelLoading ? <RefreshCw size={11} className="animate-spin" /> : <X size={11} />}
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COUPON INPUT
// ─────────────────────────────────────────────────────────────────────────────
function CouponInput({ value, onChange, applied }) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ opacity: 0.4 }} />
        <input
          type="text"
          placeholder="Coupon code"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="input-field w-full pl-9 text-sm font-mono tracking-widest"
          style={{ textTransform: "uppercase" }}
        />
      </div>
      {applied && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-1 px-3 rounded-xl text-xs font-black"
          style={{ background: "rgba(16,185,129,.12)", color: "#10b981" }}
        >
          <CheckCircle2 size={12} /> Applied
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUBSCRIPTION HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function SubscriptionHistory({ history, pagination, loading, onPageChange }) {
  if (loading && history.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw size={18} className="animate-spin" style={{ opacity: 0.4 }} />
      </div>
    );
  }
  if (history.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.4 }}>History</p>
        <span className="text-[10px] font-bold" style={{ opacity: 0.4 }}>{pagination.total} records</span>
      </div>
      {history.map((h, i) => {
        const name = h.plan?.fixedTier || h.plan?.name || "Plan";
        const t    = getTier(name);
        const statusColor = { Active: "#10b981", Trial: "#f59e0b", Cancelled: "#6b7280", Expired: "#ef4444" }[h.status] || "#6b7280";
        return (
          <motion.div
            key={h._id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 p-3.5 rounded-xl"
            style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: t.gradient }}>
              <t.icon size={13} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{name}</p>
              <p className="text-[10px] font-semibold" style={{ opacity: 0.45 }}>
                {h.createdAt ? new Date(h.createdAt).toLocaleDateString("en-IN") : "—"} →{" "}
                {h.expiryDate ? new Date(h.expiryDate).toLocaleDateString("en-IN") : "—"}
              </p>
            </div>
            <span className="text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0"
              style={{ background: `${statusColor}15`, color: statusColor }}>
              {h.status}
            </span>
          </motion.div>
        );
      })}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
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
//  CHECKOUT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function CheckoutModal({ plan, pendingOrder, onClose, onPay, purchaseLoading, verifyLoading }) {
  const [coupon, setCoupon]               = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const t = getTier(plan?.fixedTier || plan?.name || "");

  if (!plan) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}
        onClick={onClose} />
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background: "var(--base-100)",
          borderRadius: "calc(var(--r-box) * 1.5)",
          border: "1.5px solid var(--base-300)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div className="relative overflow-hidden px-6 py-5" style={{ background: t.gradient }}>
          <PlanPattern patternId={t.patternId} planName={plan.name} />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest mb-0.5">Subscribe</p>
              <h3 className="text-xl font-black text-white">{plan.fixedTier || plan.name}</h3>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40 uppercase font-bold mb-0.5">Total</p>
              <p className="text-2xl font-black text-white">
                ₹{pendingOrder ? pendingOrder.amount : plan.pricing?.monthly ?? 0}
              </p>
              {pendingOrder?.discount > 0 && (
                <p className="text-[10px] text-white/60 line-through">₹{plan.pricing?.monthly}</p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center text-white z-20"
            style={{ background: "rgba(255,255,255,0.15)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <CouponInput value={coupon} onChange={setCoupon} applied={couponApplied} />
          {!pendingOrder ? (
            <button
              onClick={() => onPay({ planId: plan._id, amount: plan.pricing?.monthly ?? 0, couponCode: coupon || undefined })}
              disabled={purchaseLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black text-white"
              style={{ background: t.gradient, boxShadow: `0 4px 20px ${t.glow}` }}
            >
              {purchaseLoading ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
              {purchaseLoading ? "Creating order…" : `Pay ₹${plan.pricing?.monthly ?? 0}`}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2"
                style={{ background: "rgba(16,185,129,.08)", color: "#10b981" }}>
                <CheckCircle2 size={14} /> Order created — complete payment via Razorpay
              </div>
              <div className="p-3 rounded-xl" style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ opacity: 0.4 }}>Order ID</p>
                <p className="text-xs font-mono font-bold">{pendingOrder.orderId}</p>
              </div>
              <p className="text-[10px] font-semibold text-center" style={{ opacity: 0.45 }}>
                In production: Razorpay checkout opens here. After payment, call /verify.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
      <div className="skeleton h-32 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[520px] rounded-2xl" />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const PRIMARY_PLANS  = ["Basic Care", "Premium Care", "Family Care"];
const EXTENDED_PLANS = ["Pregnant Women Care", "NRI's Care"];

export default function SubscriptionPage() {
  const dispatch = useDispatch();

  // ── Selectors ─────────────────────────────────────────────────────────────
  const allPlans       = useSelector(selectAllPlans);
  const fixedPlans     = useSelector(selectFixedPlans);
  const myCustomPlans  = useSelector(selectMyCustomPlans);
  const plansLoading   = useSelector(selectPlansLoading);

  const mySub          = useSelector(selectMySubscription);
  const isActive       = useSelector(selectMySubIsActive);
  const isOnTrial      = useSelector(selectMySubIsOnTrial);
  const autoRenew      = useSelector(selectMySubAutoRenew);
  const subLoading     = useSelector(selectMySubLoading);
  const cancelLoading  = useSelector(selectCancelLoading);
  const toggleLoading  = useSelector(selectToggleAutoRenewLoading);
  const upgradeLoading = useSelector(selectUpgradeLoading);

  const history        = useSelector(selectMyHistory);
  const historyPag     = useSelector(selectMyHistoryPagination);
  const historyLoading = useSelector(selectMyHistoryLoading);

  const pendingOrder    = useSelector(selectPendingOrder);
  const purchaseLoading = useSelector(selectPurchaseLoading);
  const verifyLoading   = useSelector(selectVerifyLoading);

  const trialEligibility   = useSelector(selectTrialEligibility);
  const isTrialEligible    = useSelector(selectIsTrialEligible);
  const trialStatus        = useSelector(selectTrialStatus);
  const isOnActiveTrial    = useSelector(selectIsOnActiveTrial);
  const trialDaysLeft      = useSelector(selectTrialDaysLeft);
  const trialStatusLoading = useSelector(selectTrialStatusLoading);
  const trialOrder         = useSelector(selectTrialOrder);
  const trialConvertLoading     = useSelector(selectTrialConvertLoading);
  const trialVerifyLoading      = useSelector(selectTrialVerifyConvertLoading);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [showExtended,      setShowExtended]      = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [editingCustomPlan, setEditingCustomPlan] = useState(null);
  const [checkoutPlan,      setCheckoutPlan]      = useState(null);
  const [historyPage,       setHistoryPage]       = useState(1);
  const [showHistory,       setShowHistory]       = useState(false);

  // ── Data load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchAllPlans());
    dispatch(fetchMySubscription());
    dispatch(fetchTrialEligibility());
    dispatch(fetchTrialStatus());
  }, [dispatch]);

  useEffect(() => {
    if (showHistory) {
      dispatch(fetchMySubscriptionHistory({ page: historyPage, limit: 5 }));
    }
  }, [showHistory, historyPage, dispatch]);

  // ── Computed plan lists ───────────────────────────────────────────────────
  const primaryPlans = useMemo(
    () => PRIMARY_PLANS.map((n) => fixedPlans.find((p) => (p.fixedTier || p.name) === n)).filter(Boolean),
    [fixedPlans]
  );
  const extendedPlans = useMemo(
    () => EXTENDED_PLANS.map((n) => fixedPlans.find((p) => (p.fixedTier || p.name) === n)).filter(Boolean),
    [fixedPlans]
  );
  const currentPlanName = mySub?.plan?.fixedTier || mySub?.plan?.name || null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubscribe      = useCallback((plan) => setCheckoutPlan(plan), []);
  const handleUpgrade        = useCallback((plan) => {
    if (window.confirm(`Upgrade to ${plan.name}?`)) dispatch(upgradeSubscription({ newPlanId: plan._id }));
  }, [dispatch]);
  const handlePay            = useCallback((payload) => dispatch(initiateSubscriptionPurchase(payload)), [dispatch]);
  const handleTrial          = useCallback((plan) => {
    if (window.confirm(`Start a ${plan.freeTrial?.durationDays ?? 7}-day free trial for ${plan.name}?`))
      dispatch(startFreeTrial({ planId: plan._id }));
  }, [dispatch]);
  const handleCancel         = useCallback(() => {
    if (window.confirm("Cancel your subscription? You retain access until the current period ends."))
      dispatch(cancelSubscription());
  }, [dispatch]);
  const handleToggleAutoRenew = useCallback(() => {
    dispatch(optimisticToggleAutoRenew());
    dispatch(toggleAutoRenew());
  }, [dispatch]);
  const handleConvertTrial   = useCallback(() => dispatch(initiateTrialConversion({})), [dispatch]);
  const handleCloseCheckout  = useCallback(() => { setCheckoutPlan(null); dispatch(clearPendingOrder()); }, [dispatch]);
  const handleCloseCustomBuilder = useCallback(() => { setShowCustomBuilder(false); setEditingCustomPlan(null); }, []);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (plansLoading && allPlans.length === 0) return <PageSkeleton />;

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
        <BackButton />

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <div className="text-center space-y-3">
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
            <h1 className="text-3xl md:text-4xl font-black text-base-content leading-tight">
              Choose Your <span className="text-gradient-primary">Care Plan</span>
            </h1>
            <p className="text-sm md:text-base max-w-xl mx-auto" style={{ opacity: 0.5 }}>
              Transparent pricing. No hidden charges. Cancel anytime.
            </p>
          </div>
        </motion.div>

        {/* ── TRIAL BANNER ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {isOnActiveTrial && trialStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <motion.div
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl flex-wrap"
                style={{
                  background: "linear-gradient(90deg,#f59e0b,#8b5cf6,#3b82f6,#10b981,#f59e0b)",
                  backgroundSize: "300% 100%",
                  boxShadow: "0 8px 32px rgba(245,158,11,0.3)",
                }}
              >
                <div className="flex items-center gap-3">
                  <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <Gift size={20} className="text-white" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-black text-white">Free Trial Active</p>
                    <p className="text-[11px] text-white/70">
                      {trialDaysLeft} days remaining on {trialStatus.plan?.name || "your plan"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConvertTrial}
                  disabled={trialConvertLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all"
                  style={{ background: "rgba(255,255,255,0.22)", color: "white", backdropFilter: "blur(4px)" }}
                >
                  {trialConvertLoading ? <RefreshCw size={12} className="animate-spin" /> : <CreditCard size={12} />}
                  Convert to Paid
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MY ACTIVE SUBSCRIPTION ──────────────────────────────────────── */}
        <AnimatePresence>
          {mySub && (isActive || isOnTrial) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.4 }}>Your Subscription</p>
              </div>
              <MySubscriptionPanel
                sub={mySub}
                trialStatus={trialStatus}
                onCancel={handleCancel}
                onToggleAutoRenew={handleToggleAutoRenew}
                onConvertTrial={handleConvertTrial}
                cancelLoading={cancelLoading}
                toggleLoading={toggleLoading}
                trialConvertLoading={trialConvertLoading}
              />
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1.5 mt-3 text-[11px] font-bold transition-all"
                style={{ color: "var(--primary)" }}
              >
                {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showHistory ? "Hide" : "View"} subscription history
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 overflow-hidden"
                  >
                    <SubscriptionHistory
                      history={history}
                      pagination={historyPag}
                      loading={historyLoading}
                      onPageChange={setHistoryPage}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TRIAL ELIGIBILITY NOTICE ─────────────────────────────────────── */}
        <AnimatePresence>
          {isTrialEligible && !isActive && !isOnTrial && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(245,158,11,.08)", border: "1.5px solid rgba(245,158,11,.25)" }}
            >
              <Gift size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
              <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>
                You're eligible for a <strong>free trial</strong> — click "Start Free Trial" on any plan below
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PRIMARY 3 PLANS ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ opacity: 0.4 }}>Standard Plans</p>
              <h2 className="text-xl font-black">Healthcare For Everyone</h2>
            </div>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full"
              style={{ background: "color-mix(in srgb, var(--primary), transparent 88%)", color: "var(--primary)" }}
            >
              <Zap size={10} /> 7-day free trial available
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {primaryPlans.map((plan, i) => (
              <PlanCard
                key={plan._id}
                plan={plan}
                index={i}
                isActive={isActive || isOnTrial}
                isCurrent={(isActive || isOnTrial) && currentPlanName === (plan.fixedTier || plan.name)}
                onSubscribe={handleSubscribe}
                onTrial={handleTrial}
                onUpgrade={handleUpgrade}
                trialEligible={isTrialEligible ?? true}
                purchaseLoading={purchaseLoading || upgradeLoading}
                trialLoading={trialStatusLoading}
              />
            ))}
          </div>
        </motion.div>

        {/* ── MORE PLANS TOGGLE ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => setShowExtended((v) => !v)}
            className="group flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-black transition-all"
            style={{
              background: showExtended ? "var(--base-300)" : "var(--base-200)",
              border: "1.5px solid var(--base-300)",
              color: "var(--base-content)",
            }}
          >
            <motion.div animate={{ rotate: showExtended ? 180 : 0 }} transition={{ duration: 0.35 }}>
              <ChevronDown size={16} />
            </motion.div>
            {showExtended ? "Show fewer plans" : (
              <>
                <Sparkles size={15} style={{ color: "#f59e0b" }} />
                Explore Maternity & NRI Plans
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
                  style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b" }}>
                  {extendedPlans.length} more
                </span>
              </>
            )}
          </button>
        </div>

        {/* ── EXTENDED PLANS ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showExtended && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ opacity: 0.4 }}>Specialised Plans</p>
                  <h2 className="text-xl font-black">Tailored For Your Life Stage</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {extendedPlans.map((plan, i) => (
                    <PlanCard
                      key={plan._id}
                      plan={plan}
                      index={i}
                      isActive={isActive || isOnTrial}
                      isCurrent={(isActive || isOnTrial) && currentPlanName === (plan.fixedTier || plan.name)}
                      onSubscribe={handleSubscribe}
                      onTrial={handleTrial}
                      onUpgrade={handleUpgrade}
                      trialEligible={isTrialEligible ?? true}
                      purchaseLoading={purchaseLoading || upgradeLoading}
                      trialLoading={trialStatusLoading}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CUSTOM PLAN SECTION ───────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ opacity: 0.4 }}>Personalised</p>
              <h2 className="text-xl font-black">Build Your Own Plan</h2>
            </div>
            {!showCustomBuilder && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setShowCustomBuilder(true); setEditingCustomPlan(null); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white"
                style={{ background: CUSTOM_TIER.gradient, boxShadow: `0 4px 20px ${CUSTOM_TIER.glow}` }}
              >
                <Plus size={15} /> Create Custom Plan
              </motion.button>
            )}
          </div>

          {/* Custom plan builder */}
          <AnimatePresence>
            {showCustomBuilder && (
              <CustomPlanBuilder
                onClose={handleCloseCustomBuilder}
                existingCustomPlan={editingCustomPlan}
              />
            )}
          </AnimatePresence>

          {/* Existing custom plans */}
          <AnimatePresence>
            {myCustomPlans.length > 0 && !showCustomBuilder && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.4 }}>Your Custom Plans</p>
                {myCustomPlans.map((plan, i) => {
                  const total     = plan.pricing?.monthly ?? 0;
                  const isCurrent = currentPlanName === plan.name;
                  return (
                    <motion.div
                      key={plan._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="relative overflow-hidden rounded-2xl"
                      style={{
                        background: "var(--base-100)",
                        border: isCurrent ? `2px solid ${CUSTOM_TIER.accent}` : "1.5px solid var(--base-300)",
                        boxShadow: isCurrent ? `0 8px 32px ${CUSTOM_TIER.glow}` : "0 2px 12px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div className="relative h-2 overflow-hidden" style={{ background: CUSTOM_TIER.gradient }}>
                        <PlanPattern patternId="waves" planName={plan.name} />
                      </div>
                      <div className="p-4 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: CUSTOM_TIER.gradient }}>
                          <Layers size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="text-sm font-black">{plan.name}</h4>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: `${CUSTOM_TIER.accent}18`, color: CUSTOM_TIER.accent }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(plan.customOptions || []).filter((o) => o.quantity > 0).map((o, oi) => (
                              <span key={oi} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: "var(--base-200)", color: "var(--base-content)" }}>
                                {o.optionKey === "transport"
                                  ? `Transport: ₹${o.unitPrice ?? 0}/km bundle`
                                  : `${o.label}: ${o.quantity}`}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-black" style={{ color: CUSTOM_TIER.accent }}>₹{total}</p>
                          <p className="text-[10px] font-bold" style={{ opacity: 0.4 }}>/month</p>
                        </div>
                      </div>
                      <div className="flex gap-2 px-4 pb-4">
                        {!isCurrent && (
                          <button
                            onClick={() => handleSubscribe(plan)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white"
                            style={{ background: CUSTOM_TIER.gradient, boxShadow: `0 4px 16px ${CUSTOM_TIER.glow}` }}
                          >
                            <CreditCard size={12} /> Subscribe
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingCustomPlan(plan); setShowCustomBuilder(true); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: "var(--base-200)" }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this custom plan?")) dispatch(deleteCustomPlan(plan._id)); }}
                          className="flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: "rgba(239,68,68,.08)", color: "#ef4444" }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty custom plan promo */}
          {myCustomPlans.length === 0 && !showCustomBuilder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ y: -3 }}
              onClick={() => setShowCustomBuilder(true)}
              className="relative overflow-hidden rounded-2xl cursor-pointer"
              style={{
                background: CUSTOM_TIER.gradientSoft,
                border: "2px dashed color-mix(in srgb, #0ea5e9, transparent 55%)",
                minHeight: 120,
              }}
            >
              <PlanPattern patternId="waves" planName="empty-custom" />
              <div className="relative z-10 flex flex-col items-center justify-center py-10 gap-3">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: CUSTOM_TIER.gradient }}
                >
                  <Plus size={22} className="text-white" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-black" style={{ color: CUSTOM_TIER.accent }}>Design Your Perfect Plan</p>
                  <p className="text-[11px] mt-0.5" style={{ opacity: 0.5 }}>Mix consultations, pharmacy discounts, transport & more</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── TRUST FOOTER ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { icon: Shield,     label: "No Hidden Charges", desc: "Transparent pricing always" },
            { icon: RefreshCw,  label: "Cancel Anytime",    desc: "No lock-in contracts" },
            { icon: Award,      label: "Quality Assured",   desc: "Verified doctors & labs" },
            { icon: HeartPulse, label: "24/7 Support",      desc: "Always here when you need" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.06 }}
              className="flex flex-col items-center text-center gap-2 p-4 rounded-2xl"
              style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--primary), transparent 88%)" }}>
                <item.icon size={16} style={{ color: "var(--primary)" }} />
              </div>
              <p className="text-xs font-black">{item.label}</p>
              <p className="text-[10px] font-semibold" style={{ opacity: 0.45 }}>{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

      </div>

      {/* ── CHECKOUT MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {checkoutPlan && (
          <CheckoutModal
            plan={checkoutPlan}
            pendingOrder={pendingOrder}
            onClose={handleCloseCheckout}
            onPay={handlePay}
            purchaseLoading={purchaseLoading}
            verifyLoading={verifyLoading}
          />
        )}
      </AnimatePresence>

      {/* ── TRIAL ORDER MODAL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {trialOrder && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}
              onClick={() => dispatch(clearTrialOrder())} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl p-6 text-center space-y-4"
              style={{ background: "var(--base-100)", border: "1.5px solid #f59e0b", boxShadow: "0 32px 64px rgba(245,158,11,0.3)" }}
            >
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Gift size={36} style={{ color: "#f59e0b", margin: "0 auto" }} />
              </motion.div>
              <h3 className="text-lg font-black">Trial Razorpay Order Created</h3>
              <p className="text-xs font-semibold" style={{ opacity: 0.55 }}>
                Order ID: <span className="font-mono">{trialOrder.orderId}</span>
              </p>
              <p className="text-xs" style={{ opacity: 0.45 }}>
                Complete payment to convert your trial to a paid subscription.
              </p>
              <button onClick={() => dispatch(clearTrialOrder())}
                className="w-full py-3 rounded-xl text-sm font-black"
                style={{ background: "var(--base-300)" }}>
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}