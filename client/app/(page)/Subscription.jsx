"use client";

/**
 * SubscriptionPage — Next.js App Router
 *
 * Razorpay fixes applied:
 *  1. Key sourced ONLY from process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID — no hardcoded fallback
 *  2. loadRazorpay() is truly idempotent (module-level promise cache, never re-injects)
 *  3. CheckoutModal: the Pay button calls handlePay() directly which:
 *        a) dispatches initiateSubscriptionPurchase and awaits the resolved action
 *        b) reads order data from result.payload immediately (no useEffect race)
 *        c) calls openRazorpay() with that data right away
 *  4. onClose() called ONLY after verifySubscriptionPayment resolves, not inside handler
 *  5. All window.alert / window.confirm replaced with custom <ConfirmDialog> + <Toast>
 *  6. Every async path has try/catch
 *  7. amount paise conversion logic documented — adjust to match your backend contract
 *  8. All aria-labels, roles, h1→h2→h3 hierarchy, skip-nav added (Lighthouse a11y fixes)
 *  9. JSON-LD structured data + metadata export for SEO
 */

import React, {
  useEffect, useState, useMemo, useCallback, useRef,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Stethoscope, Truck, Pill, Microscope, UserCheck, Home,
  CheckCircle2, X, ChevronDown, Plus,
  Sparkles, Crown, Shield, Users, HeartPulse,
  Zap, ArrowRight, Gift, RefreshCw, Tag,
  AlertCircle, BadgeCheck, Layers, Info,
  Globe, Flame, Award, CreditCard,
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
  selectVerifyLoading, selectMySubscription, selectMySubIsActive,
  selectMySubIsOnTrial, selectMySubHasAccess, selectUpgradeLoading,
  selectIsTrialEligible, selectTrialStatus, selectIsOnActiveTrial,
  selectTrialDaysLeft, selectTrialStatusLoading, selectTrialOrder,
  selectTrialConvertLoading, selectTrialVerifyConvertLoading,
} from "@/store/slices/subscriptionSlice";

// ─── Metadata (App Router) ───────────────────────────────────────────────────
export const metadata = {
  title: "Health Subscription Plans | Likeson Health",
  description:
    "Choose from Basic Care, Premium Care, Family Care, Maternity, and NRI health plans. Transparent pricing, no hidden charges. Cancel anytime.",
  openGraph: {
    title: "Health Subscription Plans | Likeson Health",
    description:
      "Comprehensive healthcare coverage starting from ₹499/month. Doctor consultations, pharmacy discounts, diagnostics & more.",
    images: [{ url: "/og-plans.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: "index, follow",
};

// ─────────────────────────────────────────────────────────────────────────────
//  RAZORPAY LOADER
//  ► Injects script ONLY on first payment trigger (never on page load)
//  ► Module-level promise prevents double-injection
//  ► preconnectRazorpay() warms DNS/TLS via requestIdleCallback
// ─────────────────────────────────────────────────────────────────────────────
export function preconnectRazorpay() {
  if (typeof document === "undefined") return;
  const hosts = [
    "https://checkout.razorpay.com",
    "https://api.razorpay.com",
    "https://lumberjack.razorpay.com",
  ];
  hosts.forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const link = Object.assign(document.createElement("link"), {
      rel: "preconnect",
      href,
      crossOrigin: "anonymous",
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
    const script = document.createElement("script");
    script.src   = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload  = () => resolve(true);
    script.onerror = () => { _rzpLoadPromise = null; resolve(false); };
    document.body.appendChild(script);
  });

  return _rzpLoadPromise;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const TIER = {
  "Basic Care": {
    gradient:     "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(59,130,246,.18) 0%,rgba(29,78,216,.08) 100%)",
    accent: "#3b82f6", glow: "rgba(59,130,246,0.35)",
    icon: Shield, tag: "Starter", tagline: "Essential individual coverage",
    patternId: "zigzag", popular: false,
  },
  "Premium Care": {
    gradient:     "linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(139,92,246,.18) 0%,rgba(109,40,217,.08) 100%)",
    accent: "#8b5cf6", glow: "rgba(139,92,246,0.4)",
    icon: Crown, tag: "Most Popular", tagline: "Top-tier comprehensive care",
    patternId: "diamonds", popular: true,
  },
  "Family Care": {
    gradient:     "linear-gradient(135deg,#10b981 0%,#059669 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(16,185,129,.18) 0%,rgba(5,150,105,.08) 100%)",
    accent: "#10b981", glow: "rgba(16,185,129,0.35)",
    icon: Users, tag: "Best Value", tagline: "Complete family protection",
    patternId: "circles", popular: false,
  },
  "Pregnant Women Care": {
    gradient:     "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(245,158,11,.18) 0%,rgba(217,119,6,.08) 100%)",
    accent: "#f59e0b", glow: "rgba(245,158,11,0.35)",
    icon: HeartPulse, tag: "Maternity", tagline: "End-to-end maternity care",
    patternId: "hearts", popular: false,
  },
  "NRI's Care": {
    gradient:     "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
    gradientSoft: "linear-gradient(135deg,rgba(239,68,68,.18) 0%,rgba(185,28,28,.08) 100%)",
    accent: "#ef4444", glow: "rgba(239,68,68,0.35)",
    icon: Globe, tag: "NRI Special", tagline: "Cross-border healthcare",
    patternId: "grid", popular: false,
  },
};

const CUSTOM_TIER = {
  gradient:     "linear-gradient(135deg,#0ea5e9 0%,#7c3aed 100%)",
  gradientSoft: "linear-gradient(135deg,rgba(14,165,233,.18) 0%,rgba(124,58,237,.08) 100%)",
  accent: "#0ea5e9", glow: "rgba(14,165,233,0.35)",
  icon: Layers, tag: "Personalised", tagline: "Build your own healthcare bundle",
  patternId: "waves", popular: false,
};

const getTier = (name) => TIER[name] || CUSTOM_TIER;

// ─── SVG Patterns ─────────────────────────────────────────────────────────────
const PATTERNS = {
  zigzag:   (id) => (
    <pattern id={id} x="0" y="0" width="24" height="12" patternUnits="userSpaceOnUse">
      <polyline points="0,12 6,0 12,12 18,0 24,12" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </pattern>
  ),
  diamonds: (id) => (
    <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="white" strokeWidth="1" />
    </pattern>
  ),
  circles:  (id) => (
    <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="0.9" />
    </pattern>
  ),
  hearts:   (id) => (
    <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M12,20 C12,20 3,13 3,7.5 C3,5 5,3 7.5,3 C9.24,3 10.91,4.1 12,5.5 C13.09,4.1 14.76,3 16.5,3 C19,3 21,5 21,7.5 C21,13 12,20 12,20Z" fill="none" stroke="white" strokeWidth="0.9" />
    </pattern>
  ),
  grid:     (id) => (
    <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0L0 0 0 20" fill="none" stroke="white" strokeWidth="0.7" />
    </pattern>
  ),
  waves:    (id) => (
    <pattern id={id} x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse">
      <path d="M0,8 Q8,0 16,8 Q24,16 32,8" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
    </pattern>
  ),
};

function PlanPattern({ patternId, planName }) {
  const uid = `pat-${patternId}-${planName?.replace(/[\s']/g, "")}`;
  const PatternFn = PATTERNS[patternId] || PATTERNS.grid;
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ opacity: 0.1 }}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>{PatternFn(uid)}</defs>
        <rect width="100%" height="100%" fill={`url(#${uid})`} />
      </svg>
    </div>
  );
}

// ─── Custom Confirm Dialog — replaces window.confirm ─────────────────────────
function ConfirmDialog({
  open, title, message,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  onConfirm, onCancel, accent = "#8b5cf6",
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className="relative rounded-2xl p-6 w-full max-w-sm space-y-4"
        style={{
          background: "var(--base-100)",
          border: "1.5px solid var(--base-300)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}18` }}
            aria-hidden="true"
          >
            <AlertCircle size={18} style={{ color: accent }} />
          </div>
          <div>
            <p id="confirm-title" className="text-sm font-black text-base-content">{title}</p>
            <p id="confirm-message" className="text-xs mt-0.5" style={{ opacity: 0.55 }}>{message}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-xs font-black"
            style={{ background: "var(--base-300)" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-xs font-black text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent}, black 20%))`,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast — replaces window.alert ───────────────────────────────────────────
function Toast({ message, type = "error", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isError = type === "error";
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl max-w-sm w-full"
      style={{
        background: isError ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.12)",
        border: `1.5px solid ${isError ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.3)"}`,
        backdropFilter: "blur(16px)",
      }}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <AlertCircle
        size={16}
        style={{ color: isError ? "#ef4444" : "#10b981", flexShrink: 0 }}
        aria-hidden="true"
      />
      <p className="text-xs font-bold flex-1" style={{ color: isError ? "#ef4444" : "#10b981" }}>
        {message}
      </p>
      <button onClick={onClose} aria-label="Dismiss notification" style={{ opacity: 0.5 }}>
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Popular badge ────────────────────────────────────────────────────────────
function PopularTopBadge({ color, label = "Most Popular" }) {
  return (
    <>
      <div
        className="absolute -top-[14px] w-full left-1/2 -translate-x-1/2 z-30 pointer-events-none flex justify-center"
        aria-hidden="true"
      >
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-t-2xl text-[11px] font-black uppercase tracking-wider shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color}, black 20%))`,
            color: "white",
            boxShadow: `0 -4px 20px ${color}55`,
          }}
        >
          <Flame size={11} fill="currentColor" aria-hidden="true" />
          {label}
          <Flame size={11} fill="currentColor" aria-hidden="true" />
        </div>
      </div>
      <div
        className="absolute top-0 left-0 right-0 h-[3px] z-20 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          borderRadius: "20px 20px 0 0",
        }}
        aria-hidden="true"
      />
    </>
  );
}

// ─── Benefit row ──────────────────────────────────────────────────────────────
function BenefitRow({ icon: Icon, label, value, active, accent }) {
  return (
    <div
      className="flex items-center gap-2.5 py-2"
      style={{
        borderBottom: "1px solid color-mix(in srgb,var(--base-content),transparent 91%)",
        opacity: active ? 1 : 0.28,
      }}
    >
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: active ? `${accent}18` : "var(--base-300)" }}
        aria-hidden="true"
      >
        <Icon size={12} style={{ color: active ? accent : "inherit" }} />
      </div>
      <span className="text-xs font-semibold flex-1 text-base-content">{label}</span>
      <span
        className="text-[11px] font-black"
        style={{ color: active ? accent : "inherit" }}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PlanCard({
  plan, hasAccess, isCurrent,
  onSubscribe, onTrial, onUpgrade,
  trialEligible, purchaseLoading, trialLoading,
}) {
  const name         = plan.fixedTier || plan.name;
  const t            = getTier(name);
  const TIcon        = t.icon;
  const monthly      = plan.pricing?.monthly ?? 0;
  const billingLabel = plan.pricing?.billingLabel || "/month";
  const consults     = plan.consultations?.freePerMonth ?? 0;
  const pharmMax     = plan.pharmacy?.discountMax ?? plan.pharmacy?.discountMin ?? 0;
  const diagDisc     = plan.diagnostics?.discountPercent ?? 0;
  const maxMem       = plan.membership?.maxMembers ?? 1;
  const careInc      = plan.careAssistant?.included ?? false;
  const homeLab      = plan.diagnostics?.homeSampleCollection ?? false;
  const transport    = plan.transport?.isApplicable ?? true;
  const trialDays    = plan.freeTrial?.enabled ? plan.freeTrial.durationDays : 0;

  const benefits = [
    { icon: Stethoscope, label: "Doctor Consultations",   value: consults === -1 ? "Unlimited" : `${consults}/month`, active: consults !== 0 },
    { icon: Pill,        label: "Pharmacy Discount",      value: plan.pharmacy?.isFlat ? `Flat ${pharmMax}%` : `${plan.pharmacy?.discountMin ?? 0}–${pharmMax}%`, active: pharmMax > 0 },
    { icon: Microscope,  label: "Diagnostic Discount",    value: `${diagDisc}%`, active: diagDisc > 0 },
    { icon: Truck,       label: "Medical Transport",      value: transport ? `₹${plan.transport?.ratePerKm ?? 0}/km` : "N/A", active: transport },
    { icon: UserCheck,   label: "Care Assistant",         value: careInc ? plan.careAssistant?.serviceType || "Standard" : "Not Included", active: careInc },
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
    <article
      className="relative flex flex-col h-full"
      aria-label={`${name} plan, ₹${monthly}${billingLabel}${isCurrent ? ", currently active" : ""}`}
      style={{ zIndex: t.popular ? 10 : 1, paddingTop: t.popular ? "14px" : "0px" }}
    >
      {t.popular && <PopularTopBadge color={t.accent} label={t.tag} />}

      <div
        className="relative flex flex-col h-full overflow-hidden"
        style={{
          background: t.popular
            ? `linear-gradient(180deg, color-mix(in srgb, ${t.accent}, var(--base-100) 92%) 0%, var(--base-100) 30%)`
            : "var(--base-100)",
          borderRadius: "20px",
          border: t.popular
            ? `2px solid ${t.accent}`
            : isCurrent
            ? `2px solid ${t.accent}`
            : "1px solid var(--base-300)",
          boxShadow: t.popular
            ? `0 0 0 1px ${t.accent}22, 0 8px 32px ${t.accent}33, 0 32px 64px -16px ${t.accent}44`
            : "0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Gradient header */}
        <div
          className="relative overflow-hidden flex-shrink-0"
          style={{ background: t.gradient, minHeight: t.popular ? 164 : 148 }}
        >
          <PlanPattern patternId={t.patternId} planName={name} />
          <div className="relative z-10 p-5">
            <div className="flex items-center justify-between mb-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                style={{ background: "rgba(255,255,255,0.22)", color: "white", backdropFilter: "blur(4px)" }}
              >
                {t.popular ? <><Crown size={9} aria-hidden="true" /> Premium</> : t.tag}
              </span>
              {isCurrent && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black"
                  style={{ background: "rgba(255,255,255,0.22)", color: "white" }}
                  aria-label="Currently active plan"
                >
                  <BadgeCheck size={10} aria-hidden="true" /> Current
                </span>
              )}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.2)" }}
                    aria-hidden="true"
                  >
                    <TIcon size={16} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    {maxMem === 1 ? "Individual" : `Up to ${maxMem} members`}
                  </span>
                </div>
                <h3 className={`font-black text-white leading-tight ${t.popular ? "text-2xl" : "text-xl"}`}>
                  {name}
                </h3>
                <p className="text-white/55 text-[11px] mt-0.5 leading-tight">{t.tagline}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-[9px] text-white/45 uppercase font-bold mb-0.5">{billingLabel}</p>
                <p
                  className={`font-black text-white leading-none ${t.popular ? "text-4xl" : "text-3xl"}`}
                  aria-label={`₹${monthly} per month`}
                >
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
        <div className="px-5 pt-4 pb-1" role="list" aria-label={`${name} plan benefits`}>
          {benefits.map((b, i) => (
            <div key={i} role="listitem">
              <BenefitRow {...b} accent={t.accent} />
            </div>
          ))}
        </div>

        {/* Feature pills */}
        {features.length > 0 && (
          <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5" aria-label="Additional features">
            {features.slice(0, 4).map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full"
                style={{ background: `${t.accent}12`, color: t.accent }}
              >
                <CheckCircle2 size={8} aria-hidden="true" />{f}
              </span>
            ))}
            {features.length > 4 && (
              <span
                className="text-[9px] font-bold px-2 py-1 rounded-full"
                style={{ background: "var(--base-300)", opacity: 0.65 }}
              >
                +{features.length - 4} more
              </span>
            )}
          </div>
        )}

        {plan.idealFor && (
          <div className="px-5 pt-2">
            <p className="text-[10px] font-semibold" style={{ opacity: 0.45 }}>
              <Info size={9} className="inline mr-1" aria-hidden="true" />
              Ideal for: {plan.idealFor}
            </p>
          </div>
        )}

        {/* CTA buttons */}
        <div className="p-5 mt-auto space-y-2">
          {isCurrent ? (
            <div
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black"
              style={{ background: `${t.accent}15`, color: t.accent, border: `1.5px solid ${t.accent}40` }}
              aria-label="This is your current active plan"
            >
              <BadgeCheck size={14} aria-hidden="true" /> Active Plan
            </div>
          ) : hasAccess ? (
            <button
              onClick={() => onUpgrade(plan)}
              disabled={purchaseLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all disabled:opacity-60"
              style={{ background: t.gradient, color: "white", boxShadow: `0 4px 16px ${t.glow}` }}
              aria-label={`Upgrade to ${name} plan`}
              aria-busy={purchaseLoading}
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all disabled:opacity-60"
                style={{
                  background: t.gradient,
                  color: "white",
                  boxShadow: t.popular
                    ? `0 6px 24px ${t.glow}, 0 2px 8px rgba(0,0,0,0.2)`
                    : `0 4px 20px ${t.glow}`,
                }}
                aria-label={`Subscribe to ${name} for ₹${monthly}${billingLabel}`}
                aria-busy={purchaseLoading}
              >
                {purchaseLoading
                  ? <><RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Loading…</>
                  : <><CreditCard size={13} aria-hidden="true" /> Subscribe — ₹{monthly}{billingLabel}</>
                }
              </button>

              {trialDays > 0 && trialEligible && (
                <button
                  onClick={() => onTrial(plan)}
                  disabled={trialLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                  style={{ background: `${t.accent}12`, color: t.accent, border: `1.5px solid ${t.accent}30` }}
                  aria-label={`Start ${trialDays}-day free trial for ${name}`}
                  aria-busy={trialLoading}
                >
                  {trialLoading
                    ? <><RefreshCw size={12} className="animate-spin" aria-hidden="true" /> Loading…</>
                    : <><Gift size={12} aria-hidden="true" /> Start {trialDays}-Day Free Trial</>
                  }
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Coupon input ─────────────────────────────────────────────────────────────
function CouponInput({ value, onChange, applied }) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <label htmlFor="coupon-code-input" className="sr-only">Coupon code</label>
        <Tag
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ opacity: 0.4 }}
          aria-hidden="true"
        />
        <input
          id="coupon-code-input"
          type="text"
          placeholder="Coupon code (optional)"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="input-field w-full pl-9 text-sm font-mono tracking-widest"
          style={{ textTransform: "uppercase" }}
          autoComplete="off"
          aria-label="Enter coupon code"
        />
      </div>
      {applied && (
        <div
          className="flex items-center gap-1 px-3 rounded-xl text-xs font-black"
          style={{ background: "rgba(16,185,129,.12)", color: "#10b981" }}
          role="status"
          aria-label="Coupon applied"
        >
          <CheckCircle2 size={12} aria-hidden="true" /> Applied
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHECKOUT MODAL
//
//  KEY FIX: Razorpay is opened DIRECTLY from the Pay button click (handlePay),
//  not from a useEffect watching pendingOrder. This eliminates the race condition
//  where the useEffect fires before Razorpay is loaded or before the component
//  re-renders with the new pendingOrder value.
//
//  Flow:
//    1. User clicks "Pay ₹X"
//    2. handlePay() dispatches initiateSubscriptionPurchase and AWAITS it
//    3. result.payload contains the order data immediately (no state cycle needed)
//    4. If amount === 0 (free/coupon): close modal, done
//    5. If paid: call openRazorpay(order) directly with the fresh order data
//    6. Razorpay handler calls onVerifyPay, then closes modal on success
// ─────────────────────────────────────────────────────────────────────────────
function CheckoutModal({
  plan, pendingOrder, onClose,
  onInitiatePay, onVerifyPay,
  purchaseLoading, verifyLoading,
  onToast,
}) {
  const [coupon, setCoupon]   = useState("");
  const [paying, setPaying]   = useState(false);
  const t = getTier(plan?.fixedTier || plan?.name || "");

  // Only use env key — never a hardcoded fallback
  const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  const openRazorpay = useCallback(async (order) => {
    if (!RZP_KEY) {
      onToast("Payment gateway is not configured. Please contact support.", "error");
      return;
    }

    const loaded = await loadRazorpay().catch(() => false);
    if (!loaded) {
      onToast(
        "Failed to load payment gateway. Please check your connection and try again.",
        "error"
      );
      return;
    }

    /**
     * AMOUNT CONVERSION:
     * Razorpay requires amount in PAISE (1 INR = 100 paise).
     *
     * If your backend returns RUPEES (e.g. 499): multiply × 100 → 49900 paise ✓
     * If your backend already returns PAISE (e.g. 49900): do NOT multiply again.
     *
     * Current assumption: backend returns RUPEES (amount < 100,000).
     * Adjust the condition below to match your API contract.
     */
    const amountInPaise =
      order.amount < 100000
        ? Math.round(order.amount * 100) // backend returns rupees
        : Math.round(order.amount);      // backend already returns paise

    const options = {
      key:         RZP_KEY,
      amount:      amountInPaise,
      currency:    order.currency || "INR",
      name:        "Likeson Health",
      description: `${plan.fixedTier || plan.name} Subscription`,
      order_id:    order.orderId || order.id, // handle both API response shapes
      image:       "/logo.png",
      handler: async (response) => {
        setPaying(true);
        try {
          const verifyResult = await onVerifyPay({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            planId:              order.planId,
            amount:              order.amount,
          });

          if (verifyResult?.error) {
            onToast(
              verifyResult.error.message || "Payment verification failed. Contact support with your payment ID.",
              "error"
            );
          } else {
            onClose(); // close ONLY after successful verification
          }
        } catch (err) {
          onToast(
            "Payment verification failed. Please contact support with your payment ID.",
            "error"
          );
          if (process.env.NODE_ENV === "development") {
            console.error("[Razorpay] verify error:", err);
          }
        } finally {
          setPaying(false);
        }
      },
      prefill: { name: "", email: "", contact: "" },
      theme:   { color: t.accent },
      modal: {
        ondismiss: () => setPaying(false),
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (resp) => {
      onToast(
        `Payment failed: ${resp.error?.description || "Unknown error. Please try again."}`,
        "error"
      );
      setPaying(false);
    });
    rzp.open();
  }, [plan, t.accent, RZP_KEY, onVerifyPay, onClose, onToast]);

  /**
   * Called when user clicks the Pay button.
   * Awaits order creation, then immediately launches Razorpay.
   * No useEffect / state dance required.
   */
  const handlePay = useCallback(async () => {
    try {
      const result = await onInitiatePay({
        planId:     plan._id,
        amount:     plan.pricing?.monthly ?? 0,
        couponCode: coupon || undefined,
      });

      // Thunk failed
      if (result?.error) {
        onToast(
          result.error.message || "Failed to create order. Please try again.",
          "error"
        );
        return;
      }

      const order = result?.payload;
      if (!order) {
        onToast("Unexpected server response. Please try again.", "error");
        return;
      }

      // ₹0 path — coupon or free plan — slice sets mySubscription; close modal
      if (order.activated === true || Number(order.amount) === 0) {
        onClose();
        return;
      }

      // Paid path — open Razorpay immediately with fresh order data
      const hasOrderId = Boolean(order.orderId || order.id);
      if (hasOrderId) {
        await openRazorpay(order);
      } else {
        onToast("Order created but payment details are missing. Please try again.", "error");
      }
    } catch (err) {
      onToast("Something went wrong. Please try again.", "error");
      if (process.env.NODE_ENV === "development") {
        console.error("[CheckoutModal] handlePay error:", err);
      }
    }
  }, [plan, coupon, onInitiatePay, openRazorpay, onClose, onToast]);

  if (!plan) return null;

  const isLoading = purchaseLoading || verifyLoading || paying;
  const displayAmount = pendingOrder?.amount ?? plan.pricing?.monthly ?? 0;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background: "var(--base-100)",
          borderRadius: "24px",
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
              <h2 id="checkout-modal-title" className="text-xl font-black text-white">
                {plan.fixedTier || plan.name}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40 uppercase font-bold mb-0.5">Total</p>
              <p className="text-2xl font-black text-white" aria-label={`Total ₹${displayAmount}`}>
                ₹{displayAmount}
              </p>
              {pendingOrder?.discount > 0 && (
                <p
                  className="text-[10px] text-white/60 line-through"
                  aria-label={`Original price ₹${plan.pricing?.monthly}`}
                >
                  ₹{plan.pricing?.monthly}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center text-white z-20"
            style={{ background: "rgba(255,255,255,0.15)" }}
            aria-label="Close checkout modal"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <CouponInput value={coupon} onChange={setCoupon} applied={false} />

          <button
            onClick={handlePay}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black text-white disabled:opacity-60 transition-all"
            style={{ background: t.gradient, boxShadow: `0 4px 20px ${t.glow}` }}
            aria-label={`Pay ₹${displayAmount} for ${plan.fixedTier || plan.name}`}
            aria-busy={isLoading}
          >
            {purchaseLoading
              ? <><RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Creating order…</>
              : verifyLoading || paying
              ? <><RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Verifying payment…</>
              : <><CreditCard size={14} aria-hidden="true" /> Pay ₹{displayAmount}</>
            }
          </button>

          <p className="text-center text-[10px]" style={{ opacity: 0.4 }}>
            Secured by Razorpay · 256-bit SSL encryption
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Custom plan builder ──────────────────────────────────────────────────────
const OPTION_KEYS = [
  { key: "consultations",        icon: Stethoscope, label: "Doctor Consultations",  unit: "consults/mo",  isToggle: false },
  { key: "transport",            icon: Truck,       label: "Transport Rides",        unit: "rides/mo",     isToggle: false },
  { key: "diagnostics",          icon: Microscope,  label: "Diagnostic Discount",    unit: "% off",        isToggle: false },
  { key: "pharmacy",             icon: Pill,        label: "Pharmacy Discount",      unit: "% off",        isToggle: false },
  { key: "careAssistant",        icon: UserCheck,   label: "Care Assistant Visits",  unit: "visits/mo",    isToggle: false },
  { key: "homeSampleCollection", icon: Home,        label: "Home Sample Collection", unit: "add-on",       isToggle: true  },
  { key: "prioritySupport",      icon: Zap,         label: "Priority Support",       unit: "add-on",       isToggle: true  },
];

function CustomPlanBuilder({ onClose, existingCustomPlan, onToast }) {
  const dispatch     = useDispatch();
  const pricing      = useSelector(selectCustomPlanPricing);
  const priceLoading = useSelector(selectCustomPlanPricingLoading);
  const saveLoading  = useSelector(selectCustomPlanLoading);
  const saveError    = useSelector(selectCustomPlanError);

  const [planName, setPlanName] = useState(existingCustomPlan?.name || "My Custom Plan");
  const [quantities, setQuantities] = useState(() => {
    if (existingCustomPlan?.customOptions) {
      return Object.fromEntries(existingCustomPlan.customOptions.map((o) => [o.optionKey, o.quantity]));
    }
    return Object.fromEntries(OPTION_KEYS.map((o) => [o.key, 0]));
  });

  useEffect(() => { dispatch(fetchCustomPlanPricing()); }, [dispatch]);

  const unitPrices = pricing?.unitPrices || {};
  const caps       = pricing?.caps       || {};

  const PRICE_MAP = useMemo(() => ({
    consultations:        unitPrices.consultationPricePerUnit           || 150,
    transport:            unitPrices.transportRidePricePerUnit          || 100,
    diagnostics:          unitPrices.diagnosticsDiscountPricePerPercent || 20,
    pharmacy:             unitPrices.pharmacyDiscountPricePerPercent    || 25,
    careAssistant:        unitPrices.careAssistantVisitPricePerUnit     || 120,
    homeSampleCollection: unitPrices.homeSampleCollectionFlatPrice      || 199,
    prioritySupport:      unitPrices.prioritySupportFlatPrice           || 99,
  }), [unitPrices]);

  const CAP_MAP = useMemo(() => ({
    consultations: caps.consultationsMaxPerMonth       || 30,
    transport:     caps.transportMaxRidesPerMonth      || 20,
    diagnostics:   caps.diagnosticsDiscountMax         || 25,
    pharmacy:      caps.pharmacyDiscountMax            || 25,
    careAssistant: caps.careAssistantMaxVisitsPerMonth || 30,
  }), [caps]);

  const total = useMemo(
    () => Object.entries(quantities).reduce((sum, [key, qty]) => sum + qty * (PRICE_MAP[key] || 0), 0),
    [quantities, PRICE_MAP]
  );

  const setQty = useCallback((key, val) => {
    const max = CAP_MAP[key] ?? 1;
    setQuantities((q) => ({ ...q, [key]: Math.max(0, Math.min(max, val)) }));
  }, [CAP_MAP]);

  const handleSave = useCallback(async () => {
    const options = OPTION_KEYS
      .filter((o) => quantities[o.key] > 0)
      .map((o) => ({ optionKey: o.key, label: o.label, quantity: quantities[o.key] }));

    if (!options.length) {
      onToast("Please add at least one option to your plan.", "error");
      return;
    }

    try {
      const res = await dispatch(
        existingCustomPlan
          ? updateCustomPlan({ planId: existingCustomPlan._id, name: planName, options })
          : createCustomPlan({ name: planName, options })
      );
      if (!res.error) onClose();
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("[CustomPlanBuilder] save error:", err);
    }
  }, [quantities, planName, existingCustomPlan, dispatch, onClose, onToast]);

  return (
    <div className="w-full flex justify-center">
      <div
        className="relative overflow-hidden rounded-2xl w-full max-w-xl"
        style={{
          background: "var(--base-100)",
          border: "1.5px solid #0ea5e9",
          boxShadow: "0 20px 60px rgba(14,165,233,0.2)",
        }}
        role="region"
        aria-label="Custom plan builder"
      >
        <div className="relative overflow-hidden px-6 py-5" style={{ background: CUSTOM_TIER.gradient }}>
          <PlanPattern patternId="waves" planName="custom" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-2"
                style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
              >
                <Sparkles size={9} aria-hidden="true" /> Build Your Plan
              </span>
              <label htmlFor="custom-plan-name" className="sr-only">Plan name</label>
              <input
                id="custom-plan-name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="block text-xl font-black text-white bg-transparent border-none outline-none w-full truncate"
                placeholder="Name your plan…"
                aria-label="Custom plan name"
              />
              <p className="text-white/50 text-[11px] mt-0.5">Select what matters most to you</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] text-white/45 uppercase font-bold mb-0.5">Estimated</p>
              <p
                className="text-3xl font-black text-white"
                aria-label={`Estimated ₹${total} per month`}
              >
                ₹{total}
              </p>
              <p className="text-white/45 text-[10px]">/month</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {priceLoading ? (
            <div
              className="flex justify-center py-8"
              role="status"
              aria-label="Loading pricing options"
            >
              <RefreshCw size={20} className="animate-spin" style={{ color: "#0ea5e9" }} aria-hidden="true" />
            </div>
          ) : (
            OPTION_KEYS.map((opt) => {
              const qty       = quantities[opt.key];
              const unitPrice = PRICE_MAP[opt.key] || 0;
              const lineTotal = qty * unitPrice;
              const max       = CAP_MAP[opt.key] ?? 1;
              const active    = qty > 0;

              return (
                <div
                  key={opt.key}
                  className="flex items-center gap-3 p-3.5 rounded-xl transition-all"
                  style={{
                    opacity: active ? 1 : 0.6,
                    background: active ? `${CUSTOM_TIER.accent}0e` : "var(--base-200)",
                    border: active ? `1.5px solid ${CUSTOM_TIER.accent}35` : "1.5px solid var(--base-300)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: active ? `${CUSTOM_TIER.accent}20` : "var(--base-300)" }}
                    aria-hidden="true"
                  >
                    <opt.icon size={14} style={{ color: active ? CUSTOM_TIER.accent : "inherit" }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-base-content">{opt.label}</p>
                    <p className="text-[10px] font-bold mt-0.5" style={{ opacity: 0.45 }}>
                      ₹{unitPrice}/{opt.unit}
                      {!opt.isToggle && max ? <span className="ml-1">(max {max})</span> : null}
                    </p>
                  </div>

                  {opt.isToggle ? (
                    <button
                      type="button"
                      onClick={() => setQty(opt.key, qty > 0 ? 0 : 1)}
                      className="relative flex-shrink-0 rounded-full transition-all duration-300"
                      style={{ width: 44, height: 24, background: active ? CUSTOM_TIER.accent : "var(--base-300)" }}
                      role="switch"
                      aria-checked={active}
                      aria-label={`${active ? "Disable" : "Enable"} ${opt.label}`}
                    >
                      <div
                        className="absolute top-1 w-4 h-4 rounded-full shadow-sm transition-transform duration-200"
                        style={{
                          background: "white",
                          transform: `translateX(${active ? 22 : 2}px)`,
                        }}
                      />
                    </button>
                  ) : (
                    <div
                      className="flex items-center rounded-xl overflow-hidden flex-shrink-0"
                      style={{ border: "1.5px solid var(--base-300)" }}
                      role="group"
                      aria-label={`${opt.label} quantity`}
                    >
                      <button
                        onClick={() => setQty(opt.key, qty - 1)}
                        className="w-8 h-8 flex items-center justify-center"
                        style={{ background: "var(--base-200)" }}
                        aria-label={`Decrease ${opt.label}`}
                        disabled={qty === 0}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">−</span>
                      </button>
                      <span
                        className="w-8 text-center text-sm font-black"
                        style={{ background: "var(--base-100)" }}
                        aria-label={`${qty} ${opt.unit}`}
                      >
                        {qty}
                      </span>
                      <button
                        onClick={() => setQty(opt.key, qty + 1)}
                        className="w-8 h-8 flex items-center justify-center"
                        style={{ background: "var(--base-200)" }}
                        aria-label={`Increase ${opt.label}`}
                        disabled={qty >= max}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">+</span>
                      </button>
                    </div>
                  )}

                  {active && (
                    <span
                      className="text-[10px] font-black flex-shrink-0 w-14 text-right"
                      style={{ color: CUSTOM_TIER.accent }}
                      aria-label={`₹${lineTotal} for ${opt.label}`}
                    >
                      ₹{lineTotal}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {saveError && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold"
              style={{ background: "rgba(239,68,68,.1)", color: "#ef4444" }}
              role="alert"
              aria-live="polite"
            >
              <AlertCircle size={13} aria-hidden="true" /> {saveError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider"
              style={{ background: "var(--base-300)" }}
              aria-label="Cancel and close plan builder"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveLoading || total === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black text-white disabled:opacity-65"
              style={{ background: CUSTOM_TIER.gradient, boxShadow: `0 4px 20px ${CUSTOM_TIER.glow}` }}
              aria-label={`${existingCustomPlan ? "Update" : "Create"} custom plan for ₹${total} per month`}
              aria-busy={saveLoading}
            >
              {saveLoading
                ? <><RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Saving…</>
                : <><CheckCircle2 size={13} aria-hidden="true" />
                    {existingCustomPlan ? "Update Plan" : "Create Plan"} — ₹{total}/mo
                  </>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page skeleton ────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div
      className="max-w-5xl mx-auto px-4 py-12 space-y-10"
      role="status"
      aria-label="Loading subscription plans"
    >
      <div className="skeleton h-32 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[520px] rounded-2xl" />)}
      </div>
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

  const showToast = useCallback((message, type = "error") => setToast({ message, type }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const openConfirm  = useCallback((opts) => setConfirmDialog(opts), []);
  const closeConfirm = useCallback(() => setConfirmDialog(null), []);

  const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchAllPlans());
    dispatch(fetchMySubscription());
    dispatch(fetchTrialEligibility());
    dispatch(fetchTrialStatus());
  }, [dispatch]);

  // ── Warm Razorpay DNS on idle — no render cost ───────────────────────────
  useEffect(() => {
    const warmup = () => preconnectRazorpay();
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warmup, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(warmup, 2000);
    return () => clearTimeout(id);
  }, []);

  // ── Auto-close checkout on ₹0 activation ────────────────────────────────
  const prevMySubRef = useRef(null);
  useEffect(() => {
    if (checkoutPlan && mySub && !pendingOrder && mySub !== prevMySubRef.current) {
      setCheckoutPlan(null);
    }
    prevMySubRef.current = mySub;
  }, [mySub, pendingOrder, checkoutPlan]);

  // ── Trial conversion — paid path only ────────────────────────────────────
  useEffect(() => {
    if (!trialOrder?.orderId) return;

    (async () => {
      if (!RZP_KEY) {
        showToast("Payment gateway is not configured. Please contact support.", "error");
        dispatch(clearTrialOrder());
        return;
      }

      const loaded = await loadRazorpay().catch(() => false);
      if (!loaded) {
        showToast("Failed to load payment gateway. Please check your connection.", "error");
        dispatch(clearTrialOrder());
        return;
      }

      const planName = trialStatus?.plan?.name || trialOrder.planName || "";
      const t = getTier(planName);

      const amountInPaise =
        trialOrder.amount < 100000
          ? Math.round(trialOrder.amount * 100)
          : Math.round(trialOrder.amount);

      const options = {
        key:         RZP_KEY,
        amount:      amountInPaise,
        currency:    trialOrder.currency || "INR",
        name:        "Likeson Health",
        description: `Convert trial to paid — ${planName}`,
        order_id:    trialOrder.orderId,
        image:       "/logo.png",
        handler: async (response) => {
          try {
            await dispatch(verifyTrialConversion({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              amount:              trialOrder.amount,
            }));
            dispatch(clearTrialOrder());
            showToast("Trial converted to paid subscription successfully!", "success");
          } catch (err) {
            showToast("Payment verification failed. Please contact support.", "error");
            if (process.env.NODE_ENV === "development") {
              console.error("[Trial conversion] verify error:", err);
            }
          }
        },
        prefill: { name: "", email: "", contact: "" },
        theme:   { color: t.accent || "#8b5cf6" },
        modal: {
          ondismiss: () => dispatch(clearTrialOrder()),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        showToast(
          `Payment failed: ${resp.error?.description || "Unknown error"}`,
          "error"
        );
        dispatch(clearTrialOrder());
      });
      rzp.open();
    })();
  }, [trialOrder?.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed lists ───────────────────────────────────────────────────────
  const primaryPlans = useMemo(
    () => PRIMARY_PLANS
      .map((n) => fixedPlans.find((p) => (p.fixedTier || p.name) === n))
      .filter(Boolean),
    [fixedPlans]
  );
  const extendedPlans = useMemo(
    () => EXTENDED_PLANS
      .map((n) => fixedPlans.find((p) => (p.fixedTier || p.name) === n))
      .filter(Boolean),
    [fixedPlans]
  );
  const currentPlanName = mySub?.plan?.fixedTier || mySub?.plan?.name || null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubscribe = useCallback((plan) => setCheckoutPlan(plan), []);

  const handleUpgrade = useCallback((plan) => {
    openConfirm({
      title: `Upgrade to ${plan.name}?`,
      message: "Your billing period resets to 30 days from today.",
      confirmLabel: "Upgrade Now",
      accent: getTier(plan.fixedTier || plan.name).accent,
      onConfirm: async () => {
        closeConfirm();
        try {
          const result = await dispatch(upgradeSubscription({ newPlanId: plan._id }));
          if (result?.error) {
            showToast(result.error.message || "Upgrade failed. Please try again.", "error");
          } else {
            showToast(`Upgraded to ${plan.name} successfully!`, "success");
          }
        } catch (err) {
          showToast("Upgrade failed. Please try again.", "error");
        }
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
      accent: getTier(plan.fixedTier || plan.name).accent,
      onConfirm: async () => {
        closeConfirm();
        try {
          const result = await dispatch(startFreeTrial({ planId: plan._id }));
          if (result?.error) {
            showToast(result.error.message || "Could not start trial. Please try again.", "error");
          } else {
            showToast(`Your ${days}-day free trial has started!`, "success");
          }
        } catch (err) {
          showToast("Could not start trial. Please try again.", "error");
        }
      },
    });
  }, [dispatch, openConfirm, closeConfirm, showToast]);

  const handleCloseCheckout = useCallback(() => {
    setCheckoutPlan(null);
    dispatch(clearPendingOrder());
  }, [dispatch]);

  const handleCloseCustomBuilder = useCallback(() => {
    setShowCustomBuilder(false);
    setEditingCustomPlan(null);
  }, []);

  const handleConvertTrial = useCallback(() => {
    dispatch(initiateTrialConversion({}));
  }, [dispatch]);

  const handleDeleteCustomPlan = useCallback((planId, planName) => {
    openConfirm({
      title: "Delete custom plan?",
      message: `"${planName}" will be permanently deleted.`,
      confirmLabel: "Delete",
      accent: "#ef4444",
      onConfirm: async () => {
        closeConfirm();
        try {
          await dispatch(deleteCustomPlan(planId));
        } catch (err) {
          showToast("Failed to delete plan. Please try again.", "error");
        }
      },
    });
  }, [dispatch, openConfirm, closeConfirm, showToast]);

  if (plansLoading && allPlans.length === 0) return <PageSkeleton />;

  return (
    <>
      {/* Skip navigation for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-white focus:text-black focus:font-bold focus:outline-none"
      >
        Skip to main content
      </a>

      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "Likeson Health Subscription Plans",
            "description": "Comprehensive healthcare subscription plans including Basic, Premium, Family, Maternity, and NRI care.",
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

      <main
        id="main-content"
        className="min-h-screen"
        style={{ background: "var(--base-100)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">

          {/* ── Hero ── */}
          <section aria-labelledby="hero-heading">
            <div className="text-center space-y-3">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-1"
                style={{
                  background: "color-mix(in srgb, var(--primary), transparent 88%)",
                  border: "1px solid color-mix(in srgb, var(--primary), transparent 70%)",
                }}
              >
                <HeartPulse size={14} style={{ color: "var(--primary)" }} aria-hidden="true" />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--primary)" }}>
                  Likeson Health Plans
                </span>
              </div>
              <h1 id="hero-heading" className="text-3xl md:text-4xl font-black text-base-content leading-tight">
                Choose Your <span className="text-gradient-primary">Care Plan</span>
              </h1>
              <p className="text-sm md:text-base max-w-xl mx-auto" style={{ opacity: 0.5 }}>
                Transparent pricing. No hidden charges. Cancel anytime.
              </p>
            </div>
          </section>

          {/* ── Active trial banner ── */}
          {isOnActiveTrial && trialStatus && (
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl flex-wrap"
              style={{
                background: "linear-gradient(90deg,#f59e0b,#8b5cf6,#3b82f6,#10b981)",
                boxShadow: "0 8px 32px rgba(245,158,11,0.3)",
              }}
              role="status"
              aria-live="polite"
              aria-label={`Free trial active: ${trialDaysLeft} days remaining on ${trialStatus.plan?.name}`}
            >
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.22)", color: "white", backdropFilter: "blur(4px)" }}
                aria-label="Convert free trial to paid subscription"
                aria-busy={trialConvertLoading}
              >
                {trialConvertLoading
                  ? <><RefreshCw size={12} className="animate-spin" aria-hidden="true" /> Converting…</>
                  : <><CreditCard size={12} aria-hidden="true" /> Convert to Paid</>
                }
              </button>
            </div>
          )}

          {/* ── Trial eligibility notice ── */}
          {isTrialEligible && !hasAccess && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(245,158,11,.08)", border: "1.5px solid rgba(245,158,11,.25)" }}
              role="note"
            >
              <Gift size={16} style={{ color: "#f59e0b", flexShrink: 0 }} aria-hidden="true" />
              <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>
                You&apos;re eligible for a <strong>free trial</strong> — click &quot;Start Free Trial&quot; on any plan below
              </p>
            </div>
          )}

          {/* ── Primary 3 plans ── */}
          <section aria-labelledby="standard-plans-heading">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ opacity: 0.4 }}>
                  Standard Plans
                </p>
                <h2 id="standard-plans-heading" className="text-xl font-black">Healthcare For Everyone</h2>
              </div>
              <div
                className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full"
                style={{ background: "color-mix(in srgb, var(--primary), transparent 88%)", color: "var(--primary)" }}
                aria-label="7-day free trial available on all plans"
              >
                <Zap size={10} aria-hidden="true" /> 7-day free trial available
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

          {/* ── More plans toggle ── */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setShowExtended((v) => !v)}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-black transition-all"
              style={{
                background: showExtended ? "var(--base-300)" : "var(--base-200)",
                border: "1.5px solid var(--base-300)",
              }}
              aria-expanded={showExtended}
              aria-controls="extended-plans-region"
              aria-label={showExtended ? "Show fewer plans" : "Explore Maternity and NRI Plans"}
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                style={{ transform: showExtended ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.35s" }}
              />
              {showExtended ? "Show fewer plans" : (
                <>
                  <Sparkles size={15} style={{ color: "#f59e0b" }} aria-hidden="true" />
                  Explore Maternity &amp; NRI Plans
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-black"
                    style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b" }}
                  >
                    {extendedPlans.length} more
                  </span>
                </>
              )}
            </button>
          </div>

          {/* ── Extended plans ── */}
          <div id="extended-plans-region" aria-hidden={!showExtended}>
            {showExtended && (
              <section aria-labelledby="specialised-plans-heading" className="pt-2 space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ opacity: 0.4 }}>
                    Specialised Plans
                  </p>
                  <h2 id="specialised-plans-heading" className="text-xl font-black">
                    Tailored For Your Life Stage
                  </h2>
                </div>
                <div className="flex flex-col md:flex-row gap-6 justify-center items-start">
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
          </div>

          {/* ── Custom plan section ── */}
          <section aria-labelledby="custom-plan-heading" className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ opacity: 0.4 }}>
                  Personalised
                </p>
                <h2 id="custom-plan-heading" className="text-xl font-black">Build Your Own Plan</h2>
              </div>
              {!showCustomBuilder && (
                <button
                  onClick={() => { setShowCustomBuilder(true); setEditingCustomPlan(null); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: CUSTOM_TIER.gradient, boxShadow: `0 4px 20px ${CUSTOM_TIER.glow}` }}
                  aria-label="Open custom plan builder"
                >
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

            {myCustomPlans.length > 0 && !showCustomBuilder && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.4 }}>
                  Your Custom Plans
                </p>
                {myCustomPlans.map((plan) => {
                  const planTotal = plan.pricing?.monthly ?? 0;
                  const isCurrent = currentPlanName === plan.name;
                  return (
                    <article
                      key={plan._id}
                      className="relative overflow-hidden rounded-2xl"
                      style={{
                        background: "var(--base-100)",
                        border: isCurrent ? `2px solid ${CUSTOM_TIER.accent}` : "1.5px solid var(--base-300)",
                        boxShadow: isCurrent ? `0 8px 32px ${CUSTOM_TIER.glow}` : "0 2px 12px rgba(0,0,0,0.04)",
                      }}
                      aria-label={`${plan.name} custom plan, ₹${planTotal}/month${isCurrent ? ", active" : ""}`}
                    >
                      <div
                        className="relative h-2 overflow-hidden"
                        style={{ background: CUSTOM_TIER.gradient }}
                        aria-hidden="true"
                      >
                        <PlanPattern patternId="waves" planName={plan.name} />
                      </div>
                      <div className="p-4 flex items-start gap-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: CUSTOM_TIER.gradient }}
                          aria-hidden="true"
                        >
                          <Layers size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-black">{plan.name}</h3>
                            {isCurrent && (
                              <span
                                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: `${CUSTOM_TIER.accent}18`, color: CUSTOM_TIER.accent }}
                              >
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5" aria-label="Plan options">
                            {(plan.customOptions || []).filter((o) => o.quantity > 0).map((o, oi) => (
                              <span
                                key={oi}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: "var(--base-200)" }}
                              >
                                {o.label}: {o.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p
                            className="text-xl font-black"
                            style={{ color: CUSTOM_TIER.accent }}
                            aria-label={`₹${planTotal} per month`}
                          >
                            ₹{planTotal}
                          </p>
                          <p className="text-[10px] font-bold" style={{ opacity: 0.4 }}>/month</p>
                        </div>
                      </div>
                      <div className="flex gap-2 px-4 pb-4">
                        {!isCurrent && (
                          <button
                            onClick={() => handleSubscribe(plan)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white"
                            style={{ background: CUSTOM_TIER.gradient, boxShadow: `0 4px 16px ${CUSTOM_TIER.glow}` }}
                            aria-label={`Subscribe to ${plan.name} for ₹${planTotal}/month`}
                          >
                            <CreditCard size={12} aria-hidden="true" /> Subscribe
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingCustomPlan(plan); setShowCustomBuilder(true); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: "var(--base-200)" }}
                          aria-label={`Edit ${plan.name} plan`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCustomPlan(plan._id, plan.name)}
                          className="flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-bold"
                          style={{ background: "rgba(239,68,68,.08)", color: "#ef4444" }}
                          aria-label={`Delete ${plan.name} plan`}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {myCustomPlans.length === 0 && !showCustomBuilder && (
              <button
                onClick={() => setShowCustomBuilder(true)}
                className="relative overflow-hidden rounded-2xl cursor-pointer w-full text-left p-0 border-0 transition-transform duration-200 hover:-translate-y-1"
                style={{
                  background: CUSTOM_TIER.gradientSoft,
                  outline: `2px dashed color-mix(in srgb, #0ea5e9, transparent 55%)`,
                  minHeight: 120,
                }}
                aria-label="Create your first custom healthcare plan"
              >
                <PlanPattern patternId="waves" planName="empty-custom" />
                <div className="relative z-10 flex flex-col items-center justify-center py-10 gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: CUSTOM_TIER.gradient }}
                    aria-hidden="true"
                  >
                    <Plus size={22} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black" style={{ color: CUSTOM_TIER.accent }}>
                      Design Your Perfect Plan
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ opacity: 0.5 }}>
                      Mix consultations, pharmacy discounts, transport &amp; more
                    </p>
                  </div>
                </div>
              </button>
            )}
          </section>

          {/* ── Trust footer ── */}
          <section aria-label="Why choose Likeson Health">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Shield,     label: "No Hidden Charges", desc: "Transparent pricing always" },
                { icon: RefreshCw,  label: "Cancel Anytime",    desc: "No lock-in contracts" },
                { icon: Award,      label: "Quality Assured",   desc: "Verified doctors & labs" },
                { icon: HeartPulse, label: "24/7 Support",      desc: "Always here when you need" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center gap-2 p-4 rounded-2xl"
                  style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--primary), transparent 88%)" }}
                    aria-hidden="true"
                  >
                    <item.icon size={16} style={{ color: "var(--primary)" }} />
                  </div>
                  <p className="text-xs font-black">{item.label}</p>
                  <p className="text-[10px] font-semibold" style={{ opacity: 0.45 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      {/* ── Checkout modal ── */}
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

      {/* ── Confirm dialog (replaces window.confirm) ── */}
      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        accent={confirmDialog?.accent}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={closeConfirm}
      />

      {/* ── Toast (replaces window.alert) ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={dismissToast}
        />
      )}
    </>
  );
}