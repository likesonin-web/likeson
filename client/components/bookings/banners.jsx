"use client";

import { motion } from "framer-motion";
import {
  IndianRupee,
  Wallet,
  AlertTriangle,
  Coins,
  Ban,
  ShieldCheck,
  Check,
  Info,
  Percent,
  TrendingDown,
  Home,
  X,
} from "lucide-react";
import { PP, IN_PERSON_ONLY_PLAN_TIERS } from "@/lib/constants";
import { fmt } from "@/lib/helpers";
import { resolveHomeCollectionFree } from "@/lib/feeResolvers";

export function GstReferenceBox() {
  return (
    <div className="rounded-xl border border-base-300 bg-base-200/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-base-300">
        <IndianRupee size={11} className="text-base-content/40 flex-shrink-0" />
        <p
          className="text-[10px] font-black uppercase tracking-widest text-base-content/40"
          style={PP}
        >
          GST Reference
        </p>
      </div>
      <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {[
          { label: "Consultation (in-person)", rate: "0% — exempt" },
          { label: "Video / tele-consultation", rate: "5%" },
          { label: "Home visit", rate: "5%" },
          { label: "Transport", rate: "5%" },
          { label: "Care assistant", rate: "18%" },
          { label: "Diagnostics / lab tests", rate: "5%" },
          { label: "Home sample collection", rate: "5%" },
          { label: "Pharmacy", rate: "12%" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-2"
          >
            <p className="text-[9px] text-base-content/45 truncate" style={PP}>
              {item.label}
            </p>
            <p
              className="text-[9px] font-black text-base-content/60 flex-shrink-0"
              style={PP}
            >
              {item.rate}
            </p>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-base-300">
        <p
          className="text-[9px] text-base-content/35 leading-relaxed"
          style={PP}
        >
          Subscription discounts: pharmacy max 25%, diagnostics max 25%
          (admin-capped). Transport plan rates override default ₹21/km.
        </p>
      </div>
    </div>
  );
}

export function WalletSplitBanner({
  walletBalance,
  walletData,
  totalAmount,
  paymentMethod,
}) {
  if (paymentMethod !== "Wallet" || !totalAmount) return null;
  const available = walletData
    ? Math.max(0, (walletData.balance || 0) - (walletData.lockedBalance || 0))
    : (walletBalance ?? 0);
  const shortfall = Math.max(0, totalAmount - available);
  const walletPays = Math.min(available, totalAmount);

  if (available <= 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-2 p-3 rounded-xl border border-warning/30 bg-warning/5"
      >
        <AlertTriangle
          size={13}
          className="text-warning flex-shrink-0 mt-0.5"
        />
        <div>
          <p className="text-[11px] font-black text-warning" style={PP}>
            No Wallet Balance — Full Razorpay
          </p>
          <p
            className="text-[10px] text-warning font-semibold mt-0.5 opacity-80"
            style={PP}
          >
            Wallet balance is ₹0. Razorpay will open for the full amount of{" "}
            {fmt(totalAmount)}.
          </p>
        </div>
      </motion.div>
    );
  }

  if (shortfall > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/20"
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/15 bg-primary/5">
          <Wallet size={13} className="text-primary flex-shrink-0" />
          <p className="text-[11px] font-black text-primary" style={PP}>
            Partial Wallet + Razorpay
          </p>
        </div>
        <div className="px-3 py-2.5 space-y-1.5">
          <div className="flex justify-between text-[11px]" style={PP}>
            <span className="text-base-content/60 font-semibold">
              Wallet balance:
            </span>
            <span className="font-black text-primary">{fmt(available)}</span>
          </div>
          <div className="flex justify-between text-[11px]" style={PP}>
            <span className="text-base-content/60 font-semibold">
              Wallet deducted now:
            </span>
            <span className="font-black text-success">{fmt(walletPays)}</span>
          </div>
          <div className="flex justify-between text-[11px]" style={PP}>
            <span className="text-base-content/60 font-semibold">
              Razorpay opens for:
            </span>
            <span className="font-black text-secondary">{fmt(shortfall)}</span>
          </div>
          <div className="flex items-start gap-1.5 pt-1.5 border-t border-base-300">
            <AlertTriangle
              size={10}
              className="text-warning flex-shrink-0 mt-0.5"
            />
            <p
              className="text-[9px] text-warning font-bold leading-snug"
              style={PP}
            >
              If Razorpay payment fails, {fmt(walletPays)} wallet amount is
              automatically refunded and booking is deleted.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 p-3 rounded-xl border border-success/30 bg-success/5"
    >
      <Wallet size={13} className="text-success flex-shrink-0" />
      <div>
        <p className="text-[11px] font-black text-success" style={PP}>
          Full payment from wallet
        </p>
        <p
          className="text-[10px] text-success font-semibold mt-0.5 opacity-80"
          style={PP}
        >
          {fmt(totalAmount)} deducted from wallet (balance: {fmt(available)}).
        </p>
      </div>
    </motion.div>
  );
}

export function CashPaymentBanner({ totalAmount }) {
  if (!totalAmount) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-warning/40 bg-warning/5"
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-b border-warning/30">
        <Coins size={13} className="text-warning flex-shrink-0" />
        <p className="text-[11px] font-black text-warning" style={PP}>
          Pay at Service — Amount Due
        </p>
      </div>
      <div className="px-4 py-3 text-center">
        <p className="text-3xl font-black text-warning" style={PP}>
          {fmt(totalAmount)}
        </p>
        <p
          className="text-[10px] text-warning font-semibold mt-1 opacity-80"
          style={PP}
        >
          Keep this amount ready at time of service.
        </p>
        <p
          className="text-[9px] text-base-content/40 mt-1.5 font-semibold"
          style={PP}
        >
          Payment collected by assigned provider. No advance online payment
          needed.
        </p>
      </div>
    </motion.div>
  );
}

export function OnlineCashNotAvailableBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 p-3 rounded-xl border border-base-300 bg-base-200/60"
    >
      <Ban size={13} className="text-base-content/40 flex-shrink-0 mt-0.5" />
      <p className="text-[10px] text-base-content/50 font-semibold" style={PP}>
        Cash payment is not available for video consultations. Please use Wallet
        or Razorpay.
      </p>
    </motion.div>
  );
}

export function SubCoverageBanner({ form, subCoverage, consultationType }) {
  if (!subCoverage) return null;

  const isHomeVisit = consultationType === "homeVisit";
  const isVideo =
    form?.bookingType === "doctor_online" || consultationType === "video";
  const fixedTier = subCoverage?.fixedTier ?? null;
  const videoBlocked =
    isVideo && !!fixedTier && IN_PERSON_ONLY_PLAN_TIERS.has(fixedTier);

  if (
    isHomeVisit &&
    (subCoverage.consultationFree ||
      (subCoverage.remaining ?? 0) > 0 ||
      subCoverage.isFree)
  ) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-2 p-3 rounded-xl border border-warning/30 bg-warning/5"
      >
        <AlertTriangle
          size={13}
          className="text-warning flex-shrink-0 mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-warning" style={PP}>
            Home Visit — Subscription Quota Not Applicable
          </p>
          <p
            className="text-[10px] text-warning font-semibold mt-0.5 opacity-80"
            style={PP}
          >
            Home visit fee (+ 5% GST) always charged. Subscription covers
            in-person &amp; video only.
            {subCoverage.consultationQuota
              ? ` (${subCoverage.consultationQuota})`
              : ""}
          </p>
        </div>
      </motion.div>
    );
  }

  const hasConsultFree = !isHomeVisit && subCoverage.consultationFree;
const hasCaFree =
        subCoverage.careAssistantFree &&
        !subCoverage.isCustomPlan &&
        (subCoverage.careAssistantRemaining == null ||
          subCoverage.careAssistantRemaining === Infinity ||
          (subCoverage.careAssistantRemaining ?? 0) > 0);
  const hasCaCustomQuota = !!(
    subCoverage.isCustomPlan &&
    subCoverage.careAssistantAllowed &&
    (subCoverage.careAssistantRemaining ?? 0) > 0
  );
  const hasSubRate = subCoverage.kmRateSource === "subscription";
  const hasConsultQuota =
    !isHomeVisit &&
    !subCoverage.consultationFree &&
    subCoverage.consultationQuota;
  const caQuotaExhausted =
    subCoverage.isCustomPlan &&
    (!subCoverage.careAssistantAllowed ||
      subCoverage.careAssistantRemaining <= 0);

  const nothingToShow =
    !videoBlocked &&
    !hasConsultFree &&
    !hasCaFree &&
    !hasCaCustomQuota &&
    !hasSubRate &&
    !hasConsultQuota;
  if (nothingToShow) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-success/30 bg-success/5"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-success/20">
        <ShieldCheck size={13} className="text-success flex-shrink-0" />
        <p className="text-[11px] font-black text-success" style={PP}>
          Subscription Benefits Active
        </p>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        {videoBlocked && (
          <div className="flex items-start gap-2 p-2 rounded-lg border border-warning/20 bg-warning/5">
            <AlertTriangle
              size={10}
              className="text-warning flex-shrink-0 mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-warning" style={PP}>
                Video not covered by {fixedTier}
              </p>
              <p
                className="text-[9px] text-warning font-semibold mt-0.5 opacity-80"
                style={PP}
              >
                Plan covers in-person (0% GST) only. Full video fee + 5% GST
                charged.
              </p>
            </div>
          </div>
        )}
        {hasConsultFree && (
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check size={8} className="text-success" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-success" style={PP}>
                Consultation FREE · 0% GST
              </p>
              {subCoverage.consultationQuota && (
                <p
                  className="text-[9px] text-success font-semibold mt-0.5 opacity-80"
                  style={PP}
                >
                  {subCoverage.consultationQuota}
                </p>
              )}
            </div>
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black border bg-success/10 text-success border-success/30"
              style={PP}
            >
              FREE
            </span>
          </div>
        )}
        {hasConsultQuota && (
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Info size={8} className="text-warning" />
            </div>
            <p className="text-[10px] text-warning font-semibold" style={PP}>
              {subCoverage.consultationQuota}
            </p>
          </div>
        )}
        {hasCaFree && (
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check size={8} className="text-success" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-success" style={PP}>
                Care Assistant FREE · 0% GST (quota)
              </p>
              {subCoverage.careAssistantQuota && (
                <p
                  className="text-[9px] text-success font-semibold mt-0.5 opacity-80"
                  style={PP}
                >
                  {subCoverage.careAssistantQuota}
                </p>
              )}
              <p className="text-[9px] text-base-content/40 mt-0.5" style={PP}>
                Quota consumed when admin assigns CA to booking
              </p>
            </div>
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black border bg-success/10 text-success border-success/30"
              style={PP}
            >
              FREE
            </span>
          </div>
        )}
        {hasCaCustomQuota && (
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check size={8} className="text-primary" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[11px] font-black text-primary" style={PP}>
                  Care Assistant — Plan Tier FREE
                </p>
                <span
                  className="px-1.5 py-0.5 rounded-md text-[8px] font-black border bg-primary/10 text-primary border-primary/30"
                  style={PP}
                >
                  INCLUDED
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                <p className="text-[10px] text-primary font-bold" style={PP}>
                  Your plan's care assistant tier is FREE — already paid in
                  subscription.
                </p>
                {subCoverage.careAssistantRemaining != null && (
                  <p
                    className="text-[9px] text-primary font-semibold opacity-70"
                    style={PP}
                  >
                    {subCoverage.careAssistantRemaining} visit
                    {subCoverage.careAssistantRemaining !== 1 ? "s" : ""}{" "}
                    remaining this month
                  </p>
                )}
                <p
                  className="text-[9px] text-warning font-bold italic"
                  style={PP}
                >
                  ⚠ Selecting a different duration tier charges platform rate
                  (18% GST).
                </p>
              </div>
            </div>
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black border bg-success/10 text-success border-success/30"
              style={PP}
            >
              FREE
            </span>
          </div>
        )}
        {hasSubRate && subCoverage.ratePerKm != null && (
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check size={8} className="text-success" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-success" style={PP}>
                Transport at ₹{subCoverage.ratePerKm}/km · 5% GST
              </p>
              <p
                className="text-[9px] text-success font-semibold mt-0.5 opacity-80"
                style={PP}
              >
                Subscription plan rate — lower than standard ₹21/km
              </p>
            </div>
          </div>
        )}
        {caQuotaExhausted && (
          <div className="flex items-start gap-2 pt-1 border-t border-success/20 mt-1">
            <AlertTriangle
              size={10}
              className="text-warning flex-shrink-0 mt-0.5"
            />
            <p className="text-[9px] text-warning font-semibold" style={PP}>
              Care assistant quota exhausted for this month. Standard platform
              rate + 18% GST applies.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function DiagSubBanner({ subCoverage }) {
  if (!subCoverage) return null;
  const discount = subCoverage.diagnosticsDiscountPercent || 0;
  const homeIncluded = subCoverage.homeCollectionIncluded ?? false;
  const homeStillFree = resolveHomeCollectionFree(subCoverage);
  const homeUsed = subCoverage.homeCollectionUsed ?? 0;
  const homeRemaining = subCoverage.homeCollectionRemaining;
  const homeUnlimited =
    (subCoverage.homeCollectionUnlimited ?? false) && homeStillFree;

  if (!discount && !homeIncluded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-info/30 bg-info/5"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-info/20">
        <Percent size={13} className="text-info flex-shrink-0" />
        <p className="text-[11px] font-black text-info" style={PP}>
          Diagnostics Subscription Benefits
        </p>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        {discount > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-info/15 flex items-center justify-center flex-shrink-0">
                <TrendingDown size={8} className="text-info" />
              </div>
              <div>
                <p className="text-[11px] text-info font-semibold" style={PP}>
                  {discount}% off all tests & packages
                </p>
                <p className="text-[9px] text-info/70 font-medium" style={PP}>
                  5% GST still applies on discounted price · max cap 25%
                </p>
              </div>
            </div>
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-info/10 text-info border border-info/30 flex-shrink-0"
              style={PP}
            >
              ACTIVE
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0">
              <X size={8} className="text-base-content/40" />
            </div>
            <p
              className="text-[10px] text-base-content/45 font-semibold"
              style={PP}
            >
              No diagnostic discount in your plan · 5% GST on full price
            </p>
          </div>
        )}
        {homeIncluded ? (
          <div className="rounded-lg border border-success/25 bg-success/5 px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                  <Home size={8} className="text-success" />
                </div>
                <p className="text-[11px] font-black text-success" style={PP}>
                  Home Collection
                </p>
              </div>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border flex-shrink-0 ${homeStillFree ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}`}
                style={PP}
              >
                {homeStillFree
                  ? `FREE · 1 use remaining this cycle`
                  : "USED — FEE + 5% GST"}
              </span>
            </div>
            <p
              className={`text-[10px] font-semibold leading-snug ${homeStillFree ? "text-success" : "text-warning"}`}
              style={PP}
            >
              {homeStillFree
                ? "1 free home collection remaining this billing cycle."
                : "Home collection used this cycle. Lab fee + 5% GST applies."}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0">
              <X size={8} className="text-base-content/40" />
            </div>
            <p
              className="text-[10px] text-base-content/45 font-semibold"
              style={PP}
            >
              Home collection not in plan — lab fee + 5% GST applies
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
