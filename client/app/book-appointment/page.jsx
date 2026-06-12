"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GoogleMap,
  useJsApiLoader,
  Autocomplete,
  Marker,
} from "@react-google-maps/api";
import { useGoogleMaps } from "@/context/GoogleMapsProvider";
import {
  Stethoscope,
  Video,
  Home,
  Ambulance,
  TestTube2,
  UserCheck,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
  CreditCard,
  Wallet,
  Coins,
  MapPin,
  User,
  CheckCircle2,
  FileText,
  Building2,
  HeartPulse,
  Microscope,
  Navigation2,
  FlaskConical,
  Timer,
  RefreshCw,
  Zap,
  Hospital,
  Info,
  Search,
  Receipt,
  ShieldCheck,
  Percent,
  AlertTriangle,
  Phone,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  LocateFixed,
  Star,
  Ban,
  IndianRupee,
  TrendingDown,
  Package,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchHospitals,
  fetchHospitalDoctors,
  checkHospitalAvailability,
  checkDoctorAvailability,
  fetchLabs,
  fetchLabById,
  fetchTransportEstimate,
  checkFollowUpEligibility,
  createFullCareRide,
  createDoctorConsultation,
  createDoctorOnline,
  createPhysiotherapist,
  createCareAssistant,
  createDiagnosticCenter,
  createDiagnosticHome,
  createPatientTransport,
  createFollowUp,
  resetCreateBooking,
  resetHospitals,
  resetDoctorsByHospital,
  resetHospitalAvailability,
  resetDoctorAvailability,
  resetTransportEstimate,
  resetFollowUpCheck,
  selectHospitals,
  selectHospitalsLoading,
  selectDoctorsByHospital,
  selectDoctorsByHospitalLoading,
  selectHospitalAvailability,
  selectHospitalAvailLoading,
  selectDoctorAvailability,
  selectDoctorAvailLoading,
  selectLabs,
  selectLabsLoading,
  selectLabDetail,
  selectLabDetailLoading,
  selectTransportEstimate,
  selectTransportEstimLoading,
  selectFollowUpCheck,
  selectFollowUpCheckLoading,
  selectCreateBookingData,
  selectCreateBookingLoading,
  selectCreateBookingError,
  selectCreateBookingStatus,
  verifyRazorpayPayment,
  fetchPlatformPricing,
  selectPlatformPricing,
  selectPlatformPricingLoading,
  checkConsultationCoverage,
  selectConsultationCoverage,
  fetchSubscriptionBenefitConsultations,
  fetchSubscriptionBenefitCareAssistant,
  selectSubBenefitConsultations,
  selectSubBenefitCareAssistant,
  fetchAllDoctors,
  selectAllDoctors,
  selectAllDoctorsLoading,
  cancelMyBooking,
  deleteFailedBooking,
  fetchSubscriptionBenefitLabs,
  selectSubBenefitLabs,
} from "@/store/slices/bookingSlice";

import {
  fetchWalletDetails,
  selectWalletBalance,
  selectWalletData,
} from "@/store/slices/walletSlice";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const RAZORPAY_KEY = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
const VIJAYAWADA = { lat: 16.5062, lng: 80.648 };
const GMAPS_LIBRARIES = ["places", "geometry"];

// Plans that only cover in-person consultations via subscription quota.
// Video consultations still bookable but charged at full fee + 5% GST.
// Source of truth = plan.consultations.modes.video in DB (via checkConsultationCoverage).
// IN_PERSON_ONLY_PLAN_TIERS used as UI-side fallback for banner display only.
const IN_PERSON_ONLY_PLAN_TIERS = new Set([
  "Basic Care",
  "Standard Care",
  "Premium Care",
]);

const ALL_STEP_DEFS = {
  service: { id: "service", label: "Service", icon: Zap },
  provider: { id: "provider", label: "Provider", icon: Hospital },
  patient: { id: "patient", label: "Patient", icon: User },
  schedule: { id: "schedule", label: "Schedule", icon: Calendar },
  payment: { id: "payment", label: "Payment", icon: Receipt },
  confirm: { id: "confirm", label: "Confirm", icon: CheckCircle2 },
};

const STEPS_MAP = {
  full_care_ride: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  doctor_consultation: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  doctor_online: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  physiotherapist: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  care_assistant: ["service", "patient", "schedule", "payment", "confirm"],
  diagnostic_center: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  diagnostic_home: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  patient_transport: ["service", "patient", "schedule", "payment", "confirm"],
  follow_up: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
};

const DEFAULT_STEPS = [
  "service",
  "provider",
  "patient",
  "schedule",
  "payment",
  "confirm",
];

const STEP_LABELS_MAP = {
  full_care_ride: {
    service: "Care Type",
    provider: "Hospital & Doctor",
    patient: "Patient Info",
    schedule: "Pickup & Trip",
    payment: "Fare & Pay",
    confirm: "Confirm Ride",
  },
  doctor_consultation: {
    service: "Service",
    provider: "Hospital & Doctor",
    patient: "Patient Info",
    schedule: "Appointment",
    payment: "Fee & Pay",
    confirm: "Confirm Visit",
  },
  doctor_online: {
    service: "Service",
    provider: "Select Doctor",
    patient: "Patient Info",
    schedule: "Call Time",
    payment: "Video Fee & Pay",
    confirm: "Confirm Call",
  },
  physiotherapist: {
    service: "Service",
    provider: "Select Therapist",
    patient: "Patient Info",
    schedule: "Session & Venue",
    payment: "Session Fee",
    confirm: "Confirm Session",
  },
  care_assistant: {
    service: "Service",
    patient: "Patient Info",
    schedule: "Location & Hours",
    payment: "Assistant Fee",
    confirm: "Confirm Assist",
  },
  diagnostic_center: {
    service: "Service",
    provider: "Select Lab",
    patient: "Patient Info",
    schedule: "Lab Appointment",
    payment: "Test Charges",
    confirm: "Confirm Tests",
  },
  diagnostic_home: {
    service: "Service",
    provider: "Select Lab",
    patient: "Patient Info",
    schedule: "Home Collection",
    payment: "Collection Fee",
    confirm: "Confirm Booking",
  },
  patient_transport: {
    service: "Service",
    patient: "Patient Info",
    schedule: "Route & Timing",
    payment: "Transport Fare",
    confirm: "Confirm Ride",
  },
  follow_up: {
    service: "Service",
    provider: "Same Doctor",
    patient: "Patient Info",
    schedule: "Follow-Up Date",
    payment: "Discounted Fee",
    confirm: "Confirm Follow-Up",
  },
};

const BOOKING_TYPES = [
  {
    value: "full_care_ride",
    label: "Full Care Ride",
    icon: Ambulance,
    desc: "Doctor + care assistant + door-to-door transport",
    color: "#4f46e5",
    bg: "rgba(79,70,229,0.08)",
    needsDoctor: true,
    needsCare: true,
    needsTransport: true,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. For life-threatening emergencies call 108 immediately.",
    educationNotes: [
      "We assign a verified care assistant to accompany you from your home.",
      "Doctor consultation happens at the hospital you select.",
      "Transport fare: ₹/km (plan rate or platform default ₹21/km) + 5% GST. Base fare ₹50 applies.",
      "Care assistant fee is duration-based (tiered pricing). Fixed plan subscribers get CA free.",
      "18% GST on care assistant. Consultation fee is GST exempt (0%).",
    ],
    steps: [
      { step: "Care Type", note: "Choose Full Care Ride." },
      { step: "Hospital & Doctor", note: "Pick hospital & doctor." },
      { step: "Patient Info", note: "Enter patient details." },
      {
        step: "Pickup & Trip",
        note: "Set pickup location, care duration & transport route.",
      },
      { step: "Fare & Pay", note: "Review full fare breakdown & pay." },
    ],
  },
  {
    value: "doctor_consultation",
    label: "Doctor Consultation",
    icon: Stethoscope,
    desc: "In-person visit at hospital or clinic",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Serious conditions — go directly to emergency ward.",
    educationNotes: [
      "Book a slot with your preferred doctor at a hospital or clinic.",
      "Consultation fee set by hospital or doctor. In-person = 0% GST (healthcare exempt).",
      "Subscription holders: consultation counted against monthly free quota.",
      "You travel to the hospital on your own (add transport separately if needed).",
      "Follow-up bookings at discounted rates available after your visit (within policy window).",
    ],
    steps: [
      { step: "Service", note: "Choose Doctor Consultation." },
      { step: "Hospital & Doctor", note: "Pick hospital & doctor." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Appointment", note: "Set appointment date & time." },
      { step: "Fee & Pay", note: "Review fee & pay." },
    ],
  },
  {
    value: "doctor_online",
    label: "Online Consultation",
    icon: Video,
    desc: "Video call with your doctor from anywhere",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: true,
    tooltip:
      "⚠️ Non-emergency only. Physical symptoms requiring examination — book in-person instead.",
    educationNotes: [
      "Speak to a doctor via video call from your home.",
      "Video consultation attracts 5% GST (unlike in-person which is exempt).",
      "Basic/Standard/Premium plan holders: video not covered by in-person quota. Full fee + 5% GST charged.",
      "Family Care, Pregnant Women Care, NRI Care plans: check your plan's video mode coverage.",
      "Cash payment NOT available for video consultations. Use Wallet or Razorpay.",
    ],
    steps: [
      { step: "Service", note: "Choose Online Consultation." },
      { step: "Select Doctor", note: "Pick your doctor — no hospital needed." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Call Time", note: "Set call date & time." },
      { step: "Video Fee & Pay", note: "Review video fee + 5% GST & pay." },
    ],
  },
  {
    value: "physiotherapist",
    label: "Physiotherapist",
    icon: HeartPulse,
    desc: "Physio session at clinic or home visit",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Acute injuries with severe pain — visit emergency first.",
    educationNotes: [
      "Book a physiotherapy session at a clinic or get a home visit.",
      "Home visit fee is higher than clinic session — factored into fare.",
      "Physiotherapy consultation = 0% GST (healthcare exempt).",
      "Ideal for post-surgery recovery, sports injuries, chronic pain.",
      "Subscription quota not consumed for physiotherapist bookings.",
    ],
    steps: [
      { step: "Service", note: "Choose Physiotherapist." },
      { step: "Select Therapist", note: "Pick physiotherapist." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Session & Venue", note: "Set session date & location." },
      { step: "Session Fee", note: "Review fee & pay." },
    ],
  },
  {
    value: "care_assistant",
    label: "Care Assistant",
    icon: UserCheck,
    desc: "Dedicated care assistant — auto-assigned nearest",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    needsDoctor: false,
    needsCare: true,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip: "⚠️ Non-emergency only. Medical emergencies — call 108 first.",
    educationNotes: [
      "We auto-assign the nearest verified, available care assistant to you.",
      "Pricing is tiered by session duration. 18% GST applies on care assistant fee.",
      "Fixed plan subscribers: CA visit free (quota consumed on assignment by admin).",
      "Custom plan subscribers: only your subscribed tier is free. Other tiers = platform rate.",
      "You cannot manually select an assistant — system picks nearest for fastest dispatch.",
    ],
    steps: [
      { step: "Service", note: "Choose Care Assistant." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Location & Hours", note: "Set date, location & duration." },
      { step: "Assistant Fee", note: "Review fee + 18% GST & pay." },
    ],
  },
  {
    value: "diagnostic_center",
    label: "Diagnostic Center",
    icon: Microscope,
    desc: "Lab tests at a diagnostic center (you travel to lab)",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.08)",
    needsDoctor: false,
    needsCare: false,
    needsTransport: false,
    isDiag: true,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Urgent diagnostic needs — visit hospital emergency.",
    educationNotes: [
      "Search for labs in your city and book tests or health packages.",
      "5% GST applies on diagnostic tests/packages.",
      "Subscription holders get up to 25% discount on diagnostics (admin-capped).",
      "Reports delivered digitally to your app, email, or WhatsApp.",
      "Fasting requirements for certain tests — lab will notify you.",
    ],
    steps: [
      { step: "Service", note: "Choose Diagnostic Center." },
      { step: "Select Lab", note: "Select lab & tests." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Lab Appointment", note: "Set appointment date." },
      { step: "Test Charges", note: "Review charges + 5% GST & pay." },
    ],
  },
  {
    value: "diagnostic_home",
    label: "Home Diagnostics",
    icon: TestTube2,
    desc: "Lab technician visits your home for sample collection",
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.08)",
    needsDoctor: false,
    needsCare: false,
    needsTransport: true,
    isDiag: true,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Critical samples — visit diagnostic centre directly.",
    educationNotes: [
      "A certified lab technician comes to your home to collect samples.",
      "Home collection fee set by lab + 5% GST. Waived if your plan includes it (one-time per subscription period).",
      "5% GST on diagnostic tests. 5% GST on home collection fee (if charged).",
      "Subscription: home collection once free per active period. After that, lab fee applies.",
      "Reports sent digitally — no need to visit lab at all.",
    ],
    steps: [
      { step: "Service", note: "Choose Home Diagnostics." },
      { step: "Select Lab", note: "Select lab & tests." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Home Collection", note: "Set date & home address." },
      { step: "Collection Fee", note: "Review charges + GST & pay." },
    ],
  },
  {
    value: "patient_transport",
    label: "Patient Transport",
    icon: Navigation2,
    desc: "Standalone transport — pickup to drop-off",
    color: "#64748b",
    bg: "rgba(100,116,139,0.08)",
    needsDoctor: false,
    needsCare: false,
    needsTransport: true,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency transport only. Ambulance emergencies — call 108.",
    educationNotes: [
      "Book a dedicated vehicle to transport a patient from one location to another.",
      "Fare = base fare ₹50 + (distance km × rate/km). 5% GST on total transport.",
      "Subscription plan rate overrides default ₹21/km (lower for higher plans).",
      "Return trip option: vehicle picks up from destination and returns patient home.",
      "Waiting charges: first 5 min free, then ₹2/min.",
    ],
    steps: [
      { step: "Service", note: "Choose Patient Transport." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Route & Timing", note: "Set pickup & drop-off." },
      { step: "Transport Fare", note: "Review fare + 5% GST & pay." },
    ],
  },
  {
    value: "follow_up",
    label: "Follow-Up Visit",
    icon: RefreshCw,
    desc: "Follow-up to a prior consultation (same doctor & hospital)",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Must have a prior consultation with same doctor.",
    educationNotes: [
      "Book a follow-up with the same doctor from a previous Likeson booking.",
      "Follow-up fee is set by hospital/doctor policy — typically lower than first consultation.",
      "Follow-up fee is independent of subscription quota (quota NOT consumed).",
      "Eligibility auto-verified — must be within allowed follow-up window (usually 7 days).",
      "Not applicable for new conditions — book Doctor Consultation instead.",
    ],
    steps: [
      { step: "Service", note: "Choose Follow-Up Visit." },
      { step: "Same Doctor", note: "Select same doctor & hospital." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Follow-Up Date", note: "Set appointment date." },
      { step: "Discounted Fee", note: "Review discounted fee & pay." },
    ],
  },
];

const CONSULT_TYPES = [
  {
    value: "inPerson",
    label: "In-Person",
    icon: Stethoscope,
    feeKey: "inPersonFee",
    gstNote: "0% GST (exempt)",
  },
  {
    value: "video",
    label: "Video Call",
    icon: Video,
    feeKey: "videoFee",
    gstNote: "5% GST",
  },
  {
    value: "homeVisit",
    label: "Home Visit",
    icon: Home,
    feeKey: "homeVisitFee",
    gstNote: "5% GST · no sub",
  },
];

// Cash hidden for doctor_online — backend returns 400 for Cash on video
const ALL_PAYMENT_METHODS = [
  {
    value: "Razorpay",
    label: "Razorpay",
    icon: CreditCard,
    desc: "UPI, Card, Net Banking · secure",
  },
  {
    value: "Wallet",
    label: "Wallet Balance",
    icon: Wallet,
    desc: "Deduct from your Likeson wallet",
  },
  {
    value: "Cash",
    label: "Pay at Service",
    icon: Coins,
    desc: "Pay cash at the time of service",
  },
];

const getPaymentMethods = (bookingType) =>
  bookingType === "doctor_online"
    ? ALL_PAYMENT_METHODS.filter((m) => m.value !== "Cash")
    : ALL_PAYMENT_METHODS;

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer Not to Say"];
const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
];
const REPORT_MODES = ["Digital (App)", "Email", "WhatsApp", "Physical Copy"];

// GST rates by consultation type (Indian GST rules 2024)
// In-person: Section 9 healthcare exempt → 0%
// Video/audio tele-consultation → 5%
// Home visit → 5%
const CONSULT_GST_RATE = {
  inPerson: 0.0,
  video: 0.05,
  homeVisit: 0.05,
};

// Platform GST rates reference
const GST_RATES = {
  transport: 0.05, // 5% on transport
  careAssistant: 0.18, // 18% on care assistant
  diagnostics: 0.05, // 5% on diagnostics
  homeCollection: 0.05, // 5% on home sample collection
  pharmacy: 0.12, // 12% on pharmacy
  consultation: 0.0, // 0% in-person (exempt), 5% video/home
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n = 0) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const normalizeId = (id) => {
  if (!id) return "";
  if (typeof id === "object" && id.$oid) return id.$oid;
  return id?.toString?.() ?? String(id);
};

const getSteps = (bookingType) => {
  const keys =
    bookingType && STEPS_MAP[bookingType]
      ? STEPS_MAP[bookingType]
      : DEFAULT_STEPS;
  const labels =
    bookingType && STEP_LABELS_MAP[bookingType]
      ? STEP_LABELS_MAP[bookingType]
      : {};
  return keys.map((k, i) => ({
    ...ALL_STEP_DEFS[k],
    label: labels[k] || ALL_STEP_DEFS[k].label,
    num: i + 1,
  }));
};

// Add this near your other helpers (around line 380)
const toISOSafe = (dtLocal) => {
  if (!dtLocal) return undefined;
  let raw = String(dtLocal).trim();
  
  // If it's a standard datetime-local output (YYYY-MM-DDTHH:mm)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00+05:30`; // Force IST timezone explicitly
  }
  
  // If it already has seconds but no timezone (YYYY-MM-DDTHH:mm:ss)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
     return `${raw}+05:30`;
  }

  // Fallback for already formatted strings
  return raw;
};

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const openRazorpay = async ({
  order,
  bookingId,
  name,
  description,
  prefill,
  onSuccess,
  onFailure,
  dispatch,
}) => {
  if (!RAZORPAY_KEY) {
    onFailure?.("Payment configuration missing. Contact support.");
    return;
  }
  if (
    !RAZORPAY_KEY.startsWith("rzp_test_") &&
    !RAZORPAY_KEY.startsWith("rzp_live_")
  ) {
    onFailure?.("Payment configuration error — invalid key. Contact support.");
    return;
  }
  const loaded = await loadRazorpay();
  if (!loaded) {
    onFailure?.("Razorpay failed to load. Check your internet connection.");
    return;
  }

  const options = {
    key: RAZORPAY_KEY,
    amount: Math.round((order.amount || 0) * 100),
    currency: order.currency || "INR",
    name: "Likeson.in",
    description: description || "Healthcare Booking",
    order_id: order.orderId,
    prefill: prefill || {},
    theme: { color: "#4f46e5" },
    handler: async (response) => {
      try {
        if (dispatch && bookingId) {
          const verifyResult = await dispatch(
            verifyRazorpayPayment({
              bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          );
          if (
            verifyResult?.error ||
            verifyResult?.payload?.success === false ||
            !verifyResult?.payload?.success
          ) {
            onFailure?.(
              verifyResult?.error?.message ||
                "Payment verification failed — contact support with payment ID: " +
                  response.razorpay_payment_id,
            );
            return;
          }
        }
        onSuccess?.({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      } catch (err) {
        onFailure?.(
          err?.message || "Payment verification error — contact support.",
        );
      }
    },
    modal: { ondismiss: () => onFailure?.("Payment cancelled by user") },
  };
  const rz = new window.Razorpay(options);
  rz.on("payment.failed", (r) =>
    onFailure?.(r.error?.description || "Payment failed"),
  );
  rz.open();
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION FEE RESOLVERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolveConsultFee
 *
 * Returns { fee, isFree, gstRate, reason, videoBlocked? }
 *
 * GST rules (India):
 *   in-person  → 0%  (Section 9 healthcare exempt)
 *   video      → 5%  (tele-consultation taxable)
 *   home visit → 5%  (taxable)
 *
 * Subscription coverage logic:
 *   home visit  → NEVER free via quota (always charged at full fee + 5% GST)
 *   video + plan that blocks video → NOT free, booking still allowed, full fee + 5% GST
 *   follow_up   → independent of subscription quota
 */
const resolveConsultFee = (form, followUpCheck) => {
  if (form.bookingType === "follow_up") {
    const fee = followUpCheck?.isEligible ? followUpCheck.followUpFee || 0 : 0;
    return {
      fee,
      isFree: fee === 0 && followUpCheck?.isEligible,
      gstRate: 0.0,
      reason: "Follow-up fee",
    };
  }

  const sub = form.subCoverage;
  const isVideo =
    form.bookingType === "doctor_online" || form.consultationType === "video";
  const isHome = form.consultationType === "homeVisit";

  const gstRate = isHome || isVideo ? 0.05 : 0.0;

  // Home visit: never free via subscription quota
  if (isHome) {
    const fee = form.doctorFees?.homeVisitFee ?? 600;
    return {
      fee,
      isFree: false,
      gstRate: 0.05,
      reason:
        "Home visit always charged — subscription quota covers in-person/video only",
    };
  }

  // Video: check if plan blocks video from quota
  const fixedTier = sub?.fixedTier ?? null;
  const videoBlocked =
    isVideo && !!fixedTier && IN_PERSON_ONLY_PLAN_TIERS.has(fixedTier);

  if (videoBlocked) {
    const fee = form.doctorFees?.videoFee ?? 600;
    return {
      fee,
      isFree: false,
      gstRate: 0.05,
      reason: `Your ${fixedTier} plan covers in-person only. Video fee + 5% GST charged.`,
      videoBlocked: true,
    };
  }

  // Check if subscription covers this consultation
  const isCovered = !!(
    sub?.isFree === true ||
    sub?.consultationFree === true ||
    (sub?.allowed === true && (sub?.remaining == null || sub?.remaining > 0))
  );

  if (isCovered) {
    return {
      fee: 0,
      isFree: true,
      gstRate: 0,
      reason:
        sub?.reason || sub?.consultationQuota || "Covered by subscription",
    };
  }

  // Not covered — resolve fee from doctor/hospital data
  let fee = 0;
  if (form.doctorFees) {
    fee = isVideo
      ? form.doctorFees.videoFee || 0
      : form.doctorFees.inPersonFee || 0;
  } else {
    fee = 600; // platform default
  }

  return {
    fee,
    isFree: false,
    gstRate,
    reason: sub?.consultationQuota || sub?.reason || null,
  };
};

/**
 * resolveCaFee
 * Returns { fee, isFree, isCustomPlan, reason }
 *
 * Fixed plan: CA free (quota consumed on admin assignment)
 * Custom plan: Only subscribed tier free. Different tier = platform rate (no quota).
 * No sub / exhausted: platform tier rate applies. 18% GST on all non-free CA.
 */
const resolveCaFee = (form, caTiers) => {
  const sub = form.subCoverage;

 // Fixed plan — only tier index 0 (Standard / Short Visit) free
  if (sub?.careAssistantFree && !sub?.isCustomPlan) {
    const durHours    = form.durationHours ?? caTiers[0]?.hours ?? 1;
    const isFirstTier = durHours === (caTiers[0]?.hours ?? durHours);

    if (isFirstTier) {
      return {
        fee: 0,
        isFree: true,
        isCustomPlan: false,
        reason: sub.careAssistantQuota || "Standard tier covered by subscription",
      };
    }

    // Higher tier — charge that tier price + 18% GST
    const selectedTier = caTiers.find((t) => t.hours === durHours) ?? caTiers[caTiers.length - 1];
    return {
      fee: selectedTier?.price ?? 0,
      isFree: false,
      isCustomPlan: false,
      reason: `Only Standard tier (${caTiers[0]?.hours ?? 1}h) free — upgrade tier charges platform rate + 18% GST`,
    };
  }

  // Custom plan with quota remaining
// Custom plan with quota remaining
  // careAssistantRemaining: null = unlimited, number = count, missing = 0
  const caRemaining = sub?.careAssistantRemaining;
  const hasQuota    = sub?.isCustomPlan && sub?.careAssistantAllowed &&
                      (caRemaining === null || caRemaining === Infinity || (caRemaining ?? 0) > 0);

  if (hasQuota) {
    const planTierIdx     = sub?.careAssistantTierIndex ?? 0;
    const durHours        = form.durationHours ?? caTiers[0]?.hours ?? 1;
    const selectedTierIdx = caTiers.findIndex((t) => t.hours === durHours);
    const effectiveIdx    = selectedTierIdx >= 0 ? selectedTierIdx : 0;

    if (effectiveIdx === planTierIdx) {
      return {
        fee: 0,
        isFree: true,
        isCustomPlan: true,
        reason: `Plan tier included · ${sub.careAssistantRemaining} visit(s) remaining this month`,
      };
    }

    // Different tier selected → charge platform rate for that tier
    const allTiers = sub?.careAssistantAllTiers;
    const selectedTier = allTiers
      ? allTiers[effectiveIdx]
      : caTiers[effectiveIdx];
    const extraFee = selectedTier?.chargeToUser ?? selectedTier?.price ?? 0;
    return {
      fee: extraFee,
      isFree: false,
      isCustomPlan: true,
      reason: `Plan covers tier 0 only — this tier charges platform rate`,
    };
  }

  // No sub or quota exhausted — platform tier rate
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];
  return {
    fee: caTier?.price || 0,
    isFree: false,
    isCustomPlan: false,
    reason: sub?.isCustomPlan
      ? "Quota exhausted — platform rate applies"
      : null,
  };
};

const resolveTransportFee = (transportEstimate) => {
  if (!transportEstimate) return { fee: 0, ratePerKm: null };
  return {
    fee: transportEstimate.totalTransportFee || 0,
    ratePerKm: transportEstimate.ratePerKm || null,
  };
};

const resolveHomeCollectionFree = (subCoverage) => {
  if (!subCoverage?.homeCollectionIncluded) return false;
  // homeCollectionAvailable = included AND homeCollectionUsedOnce === false
  // Prefer explicit backend flag; fall back to homeSampleCollectionFree
  if (subCoverage.homeCollectionAvailable != null)
    return subCoverage.homeCollectionAvailable === true;
  return subCoverage.homeSampleCollectionFree === true;
};

const labSupportsHomeCollection = (lab) => {
  if (!lab) return false;
  const mode = lab.sampleCollectionMode || "";
  return mode === "Both" || mode === "Home Collection" || mode === "Home";
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

const slide = {
  enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", damping: 26, stiffness: 320 },
  },
  exit: (d) => ({
    x: d > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.14 },
  }),
};

const PP = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" };

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, required, note, error, children }) {
  return (
    <div className="space-y-1.5" style={PP}>
      {label && (
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <label
            className="text-[10px] font-black uppercase tracking-widest text-base-content/50 leading-tight"
            style={PP}
          >
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </label>
          {note && (
            <span
              className="flex items-center gap-1 text-[9px] text-base-content/35 text-right leading-tight"
              style={PP}
            >
              <Info size={8} className="flex-shrink-0" />
              {note}
            </span>
          )}
        </div>
      )}
      {children}
      {error && (
        <p
          className="flex items-center gap-1 text-[11px] text-error font-semibold"
          style={PP}
        >
          <AlertCircle size={10} />
          {error}
        </p>
      )}
    </div>
  );
}

function Inp({ className = "", ...p }) {
  return (
    <input
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-base-content/25 ${className}`}
    />
  );
}

function Sel({ children, className = "", ...p }) {
  return (
    <select
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all cursor-pointer ${className}`}
    >
      {children}
    </select>
  );
}

function Txta({ className = "", ...p }) {
  return (
    <textarea
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-base-content/25 resize-none ${className}`}
    />
  );
}

function SCard({ title, icon: Icon, accent, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-base-300 bg-base-100/50 ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-base-300 bg-base-200">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-base-300"
          style={{ color: accent || "var(--primary)" }}
        >
          <Icon size={12} />
        </div>
        <h4 className="font-black text-xs tracking-tight truncate" style={PP}>
          {title}
        </h4>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

function AvailPill({ avail, loading }) {
  if (loading)
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-base-200 border border-base-300 text-base-content/50"
        style={PP}
      >
        <Loader2 size={8} className="animate-spin" />
        Checking…
      </span>
    );
  if (!avail) return null;
  const ok = avail.available;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${ok ? "bg-success/10 text-success border-success/30" : "bg-error/10 text-error border-error/30"}`}
      style={PP}
    >
      {ok ? <CheckCircle2 size={8} /> : <AlertCircle size={8} />}
      {ok ? "Available" : avail.reason || "Unavailable"}
    </span>
  );
}

function SubTag({ isFree, reason, className = "" }) {
  if (!isFree) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black border bg-success/10 text-success border-success/30 ${className}`}
      style={PP}
      title={reason || "Covered by subscription"}
    >
      <Star size={7} />
      FREE · Sub
    </span>
  );
}

// Pricing info pill — shows GST rate / tax note inline
function GstPill({ rate, label }) {
  const pct = rate != null ? `${Math.round(rate * 100)}%` : null;
  const display = label || (pct ? `GST ${pct}` : null);
  if (!display) return null;
  const isExempt = rate === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-black border ${isExempt ? "bg-success/8 text-success/70 border-success/20" : "bg-warning/8 text-warning/70 border-warning/20"}`}
      style={PP}
    >
      <IndianRupee size={6} />
      {display}
    </span>
  );
}

function FareRow({
  label,
  value,
  note,
  accent,
  bold,
  highlight,
  sub,
  isFree,
  freeReason,
  gstRate,
  gstLabel,
}) {
  return (
    <div
      className={`flex items-start justify-between gap-2 py-2 px-2.5 rounded-lg ${highlight ? "bg-primary/5 border border-primary/20" : sub ? "bg-base-200/40" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p
            className={`text-xs ${bold ? "font-black" : sub ? "font-medium" : "font-semibold"} leading-snug`}
            style={{
              color: accent || "var(--base-content)",
              opacity: sub ? 0.6 : 1,
              ...PP,
            }}
          >
            {label}
          </p>
          {isFree && <SubTag isFree={isFree} reason={freeReason} />}
          {gstRate != null && !isFree && (
            <GstPill rate={gstRate} label={gstLabel} />
          )}
        </div>
        {note && (
          <p
            className="text-[9px] text-base-content/40 mt-0.5 leading-snug"
            style={PP}
          >
            {note}
          </p>
        )}
      </div>
      <p
        className={`text-xs whitespace-nowrap flex-shrink-0 ${bold ? "font-black" : sub ? "font-medium opacity-60" : "font-bold"}`}
        style={{
          color: isFree ? "var(--success)" : accent || "var(--base-content)",
          ...PP,
        }}
      >
        {isFree ? "FREE" : value}
      </p>
    </div>
  );
}

// ─── Pricing breakdown info box ─────────────────────────────────────────────

function GstReferenceBox() {
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

// ─── Wallet split banner ─────────────────────────────────────────────────────

function WalletSplitBanner({
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

function CashPaymentBanner({ totalAmount }) {
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

function OnlineCashNotAvailableBanner() {
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

// ─── Subscription coverage banners ──────────────────────────────────────────

function SubCoverageBanner({ form, subCoverage, consultationType }) {
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
  const hasCaFree = subCoverage.careAssistantFree && !subCoverage.isCustomPlan;
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

function DiagSubBanner({ subCoverage }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION PICKER
// ─────────────────────────────────────────────────────────────────────────────

const MAP_CONTAINER_STYLE = { width: "100%", height: "200px" };

function LocationPicker({
  label,
  note,
  value,
  onChange,
  error,
  required,
  readOnly,
  readOnlyNote,
  isLoaded,
}) {
  const [expanded, setExpanded] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [markerPos, setMarkerPos] = useState(
    value?.coordinates
      ? { lat: value.coordinates[1], lng: value.coordinates[0] }
      : VIJAYAWADA,
  );
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value?.coordinates)
      setMarkerPos({ lat: value.coordinates[1], lng: value.coordinates[0] });
  }, [value?.coordinates?.[0], value?.coordinates?.[1]]);

  const reverseGeocode = useCallback(
    (latLng) => {
      if (!window.google?.maps) return;
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK" && results[0]) {
          const r = results[0];
          const comps = r.address_components || [];
          onChange({
            address: r.formatted_address,
            city:
              comps.find((c) => c.types.includes("locality"))?.long_name ||
              "Vijayawada",
            pincode:
              comps.find((c) => c.types.includes("postal_code"))?.long_name ||
              "",
            coordinates: [latLng.lng(), latLng.lat()],
          });
        }
      });
    },
    [onChange],
  );

  const handleMapClick = useCallback(
    (e) => {
      if (readOnly) return;
      const ll = e.latLng;
      setMarkerPos({ lat: ll.lat(), lng: ll.lng() });
      reverseGeocode(ll);
    },
    [reverseGeocode, readOnly],
  );

  const handleMarkerDragEnd = useCallback(
    (e) => {
      if (readOnly) return;
      const ll = e.latLng;
      setMarkerPos({ lat: ll.lat(), lng: ll.lng() });
      reverseGeocode(ll);
    },
    [reverseGeocode, readOnly],
  );

  const handlePlaceChanged = useCallback(() => {
    if (!autocompleteRef.current || readOnly) return;
    const place = autocompleteRef.current.getPlace();
    if (!place?.geometry) return;
    const loc = place.geometry.location;
    const comps = place.address_components || [];
    setMarkerPos({ lat: loc.lat(), lng: loc.lng() });
    onChange({
      address: place.formatted_address,
      city:
        comps.find((c) => c.types.includes("locality"))?.long_name ||
        "Vijayawada",
      pincode:
        comps.find((c) => c.types.includes("postal_code"))?.long_name || "",
      coordinates: [loc.lng(), loc.lat()],
    });
  }, [onChange, readOnly]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation || readOnly) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const lat = pos.coords.latitude,
          lng = pos.coords.longitude;
        if (!window.google?.maps) return;
        const ll = new window.google.maps.LatLng(lat, lng);
        setMarkerPos({ lat, lng });
        reverseGeocode(ll);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [reverseGeocode, readOnly]);

  if (readOnly && value?.address) {
    return (
      <Field label={label} required={required} note={note} error={error}>
        <div className="flex items-start gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <Building2 size={13} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary truncate" style={PP}>
              {value.address}
            </p>
            <p className="text-[10px] text-base-content/45 mt-0.5" style={PP}>
              {readOnlyNote || "Auto-set from hospital location"}
            </p>
          </div>
          <span
            className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={PP}
          >
            Auto
          </span>
        </div>
      </Field>
    );
  }

  return (
    <Field label={label} required={required} note={note} error={error}>
      <div
        className={`border rounded-xl transition-all ${expanded ? "border-primary" : "border-base-300"}`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => !readOnly && setExpanded((e) => !e)}
            className="flex-1 flex items-center gap-2 text-left hover:bg-base-200/60 rounded-lg transition-colors min-w-0"
          >
            <MapPin size={14} className="text-primary flex-shrink-0" />
            <span className="flex-1 text-xs font-medium truncate" style={PP}>
              {value?.address ? (
                <span>{value.address}</span>
              ) : (
                <span className="opacity-30">Tap to pick on map…</span>
              )}
            </span>
            {!readOnly && (
              <span
                className="text-[9px] font-black uppercase tracking-widest opacity-40 flex-shrink-0"
                style={PP}
              >
                {expanded ? "▲" : "▼"}
              </span>
            )}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={geoLoading}
              title="Use my current location"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-primary/10 text-primary"
            >
              {geoLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <LocateFixed size={13} />
              )}
            </button>
          )}
        </div>
        {expanded && !readOnly && (
          <div className="border-t border-base-300">
            {!isLoaded ? (
              <div className="h-44 flex items-center justify-center bg-base-200/40">
                <Loader2 size={20} className="animate-spin opacity-40" />
              </div>
            ) : (
              <>
                <div
                  className="p-2 bg-base-200/60"
                  style={{ position: "relative", zIndex: 10 }}
                >
                  <Autocomplete
                    onLoad={(ac) => {
                      autocompleteRef.current = ac;
                    }}
                    onPlaceChanged={handlePlaceChanged}
                    options={{
                      componentRestrictions: { country: "in" },
                      fields: [
                        "formatted_address",
                        "geometry",
                        "address_components",
                      ],
                    }}
                  >
                    <div className="relative">
                      <Search
                        size={12}
                        className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                      />
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search address, landmark…"
                        defaultValue={value?.address || ""}
                        style={PP}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-base-100 border border-base-300 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </Autocomplete>
                </div>
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={markerPos}
                  zoom={14}
                  onClick={handleMapClick}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                      {
                        featureType: "all",
                        elementType: "geometry",
                        stylers: [{ color: "#f8f9fb" }],
                      },
                      {
                        featureType: "road",
                        elementType: "geometry",
                        stylers: [{ color: "#ffffff" }],
                      },
                      {
                        featureType: "water",
                        elementType: "geometry",
                        stylers: [{ color: "#d4e5f7" }],
                      },
                      { featureType: "poi", stylers: [{ visibility: "off" }] },
                    ],
                  }}
                >
                  <Marker
                    position={markerPos}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                    icon={
                      isLoaded && window.google?.maps
                        ? {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 9,
                            fillColor: "#4f46e5",
                            fillOpacity: 1,
                            strokeColor: "#fff",
                            strokeWeight: 3,
                          }
                        : undefined
                    }
                  />
                </GoogleMap>
              </>
            )}
            {value?.address && (
              <div className="flex items-start gap-2 px-3 py-2 bg-base-200/60 border-t border-base-300">
                <MapPin
                  size={10}
                  className="mt-0.5 flex-shrink-0 text-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold truncate" style={PP}>
                    {value.address}
                  </p>
                  <p className="text-[9px] opacity-40" style={PP}>
                    {value.city}
                    {value.pincode ? ` — ${value.pincode}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setExpanded(false);
                  }}
                  className="text-[10px] text-error font-bold flex-shrink-0 hover:underline"
                  style={PP}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE TOOLTIP + EDUCATION
// ─────────────────────────────────────────────────────────────────────────────

function ServiceTooltip({ tooltip }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <div
        role="button"
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            setOpen((o) => !o);
          }
        }}
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer bg-warning/15 text-warning"
        aria-label="Important notice"
      >
        <AlertTriangle size={9} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-xl border border-warning/30 shadow-lg bg-base-100"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={11}
                className="text-warning flex-shrink-0 mt-0.5"
              />
              <p
                className="text-[10px] font-semibold leading-relaxed text-base-content/70"
                style={PP}
              >
                {tooltip}
              </p>
            </div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b border-warning/30 bg-base-100" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ServiceEducation({ bt }) {
  if (!bt) return null;
  const Icon = bt.icon;
  return (
    <motion.div
      key={bt.value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22 }}
      className="rounded-2xl border"
      style={{ borderColor: `${bt.color}30`, background: bt.bg }}
    >
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 border-b"
        style={{ borderColor: `${bt.color}20` }}
      >
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${bt.color}20`, color: bt.color }}
        >
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <p
            className="font-black text-xs truncate"
            style={{ color: bt.color, ...PP }}
          >
            {bt.label}
          </p>
          <p className="text-[9px] text-base-content/40" style={PP}>
            How this service works
          </p>
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        {bt.educationNotes.map((note, i) => (
          <div key={i} className="flex items-start gap-2">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${bt.color}20`, color: bt.color }}
            >
              <span className="text-[8px] font-black">{i + 1}</span>
            </div>
            <p
              className="text-[11px] font-medium text-base-content/65 leading-snug"
              style={PP}
            >
              {note}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-3 mb-3 flex items-start gap-2 p-2 rounded-xl border border-warning/20 bg-warning/5">
        <AlertTriangle
          size={10}
          className="text-warning flex-shrink-0 mt-0.5"
        />
        <p
          className="text-[10px] font-semibold leading-snug text-base-content/70"
          style={PP}
        >
          {bt.tooltip}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP BAR
// ─────────────────────────────────────────────────────────────────────────────

function StepBar({ steps, currentId, visitedIds, onStepClick }) {
  const [hoveredId, setHoveredId] = useState(null);
  return (
    <div className="w-full overflow-x-auto" style={{ overflowY: "visible" }}>
      <div
        className="flex items-end justify-center gap-0 px-2 pb-2"
        style={{
          paddingTop: "3rem",
          minWidth: "max-content",
          position: "relative",
        }}
      >
        {steps.map((s, i) => {
          const Icon = s.icon;
          const done = visitedIds.includes(s.id) && s.id !== currentId;
          const active = s.id === currentId;
          const ok = visitedIds.includes(s.id) || active;
          const canClick = visitedIds.includes(s.id) && s.id !== currentId;
          const isHov = hoveredId === s.id;
          return (
            <div key={s.id} className="flex items-center flex-shrink-0">
              <div
                className="relative flex flex-col items-center gap-0.5"
                style={{ minWidth: "44px" }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => canClick && onStepClick?.(s.id)}
              >
                {isHov && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none flex flex-col items-center">
                    <div
                      className={`px-2 py-1 rounded-lg text-[10px] font-black text-center whitespace-nowrap shadow-lg ${active ? "bg-primary text-primary-content" : done ? "bg-success text-success-content" : "bg-base-300 text-base-content"}`}
                      style={PP}
                    >
                      {s.label}
                      {canClick && <span className="ml-1 opacity-70">↩</span>}
                    </div>
                    <div
                      className={`w-2 h-2 rotate-45 -mt-1 ${active ? "bg-primary" : done ? "bg-success" : "bg-base-300"}`}
                    />
                  </div>
                )}
                <motion.div
                  animate={{ scale: active ? 1.12 : 1 }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-300 cursor-${canClick ? "pointer" : "default"} ${done ? "bg-success text-success-content" : active ? "bg-primary text-primary-content" : "bg-base-300 text-base-content"} ${ok ? "opacity-100" : "opacity-30"} ${isHov && canClick ? "ring-2 ring-primary/30" : ""}`}
                >
                  {done ? (
                    <Check size={9} strokeWidth={3} />
                  ) : (
                    <Icon size={9} />
                  )}
                </motion.div>
                <span
                  className={`hidden sm:block text-[7px] font-black uppercase tracking-wider text-center leading-tight ${ok ? "opacity-100" : "opacity-30"} ${active ? "text-primary" : canClick ? "text-primary" : "text-base-content"}`}
                  style={{
                    maxWidth: "44px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    ...PP,
                  }}
                >
                  {s.label}
                </span>
                <span
                  className={`block sm:hidden w-1 h-1 rounded-full mt-0.5 ${active ? "bg-primary" : ok ? "bg-success" : "bg-base-300"}`}
                />
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-3 h-px mx-0.5 flex-shrink-0 transition-all duration-500 ${done ? "bg-success opacity-100" : "bg-base-300 opacity-30"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — SERVICE TYPE
// ─────────────────────────────────────────────────────────────────────────────

function StepType({ form, set, onSelectBookingType }) {
  const selected = BOOKING_TYPES.find((b) => b.value === form.bookingType);
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          What service do you need?
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Select care type. Each service for{" "}
          <strong>non-emergency situations only.</strong>
        </p>
      </div>
      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-warning/25 bg-warning/5">
        <Phone size={12} className="text-warning flex-shrink-0" />
        <p className="text-[10px] font-bold text-base-content/70" style={PP}>
          Life-threatening emergencies — call <strong>108</strong> immediately.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BOOKING_TYPES.map((bt) => {
          const Icon = bt.icon;
          const active = form.bookingType === bt.value;
          return (
            <motion.button
              key={bt.value}
              type="button"
              whileTap={{ scale: 0.975 }}
              onClick={() => onSelectBookingType(bt.value)}
              className="relative flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all w-full"
              style={{
                borderColor: active ? bt.color : "var(--base-300)",
                background: active ? bt.bg : "var(--base-100)",
                boxShadow: active ? `0 4px 14px ${bt.color}22` : "none",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: active ? bt.bg : "var(--base-200)",
                  color: bt.color,
                }}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0 pr-7">
                <p
                  className="font-black text-xs leading-tight"
                  style={{ color: active ? bt.color : "inherit", ...PP }}
                >
                  {bt.label}
                </p>
                <p
                  className="text-[10px] text-base-content/40 mt-0.5 leading-snug line-clamp-2"
                  style={PP}
                >
                  {bt.desc}
                </p>
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {active && (
                  <div
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    style={{ background: bt.color }}
                  >
                    <Check size={8} className="text-white" strokeWidth={3} />
                  </div>
                )}
                <ServiceTooltip tooltip={bt.tooltip} />
              </div>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {selected && <ServiceEducation key={selected.value} bt={selected} />}
      </AnimatePresence>
      {form.bookingType && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5"
        >
          <CheckCircle2 size={13} className="text-primary flex-shrink-0" />
          <p className="text-xs font-bold text-primary" style={PP}>
            {selected?.label} selected. Press Continue.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

function StepProvider({
  form,
  set,
  errors,
  hospitals,
  hospitalsLoading,
  doctorsByHospital,
  doctorsLoading,
  allDoctors,
  allDoctorsLoading,
  hospitalAvail,
  hospitalAvailLoading,
  doctorAvail,
  doctorAvailLoading,
  labs,
  labsLoading,
  labDetail,
  labDetailLoading,
  followUpCheck,
  followUpCheckLoading,
  onLoadHospitals,
  onLoadDoctors,
  onLoadAllDoctors,
  onLoadLabs,
  onLoadLabDetail,
  onCheckHospAvail,
  onCheckDocAvail,
  onCheckFollowUp,
  onResetHospAvail,
  onResetDocAvail,
}) {
  const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
  const isDiag = bt?.isDiag;
  const isOnline = bt?.isOnline || form.bookingType === "doctor_online";
  const providerAccent = isDiag ? "#06b6d4" : isOnline ? "#8b5cf6" : "#0ea5e9";
  const providerIcon = isDiag ? FlaskConical : Stethoscope;

  useEffect(() => {
    if (isOnline && !allDoctors?.length && !allDoctorsLoading)
      onLoadAllDoctors?.({ consultationType: "video", isOnline: "true" });
  }, [isOnline]);

  useEffect(() => {
    if (isDiag && !labs?.length) onLoadLabs(form.labCity || "");
  }, [isDiag]);

  useEffect(() => {
    if (form.bookingType === "follow_up" && form.doctorId)
      onCheckFollowUp(form.doctorId, form.hospitalId);
  }, [form.doctorId, form.hospitalId, form.bookingType]);

  useEffect(() => {
    if (isOnline) set("consultationType", "video");
  }, [isOnline]);

  const showConsultTypes =
    bt?.needsDoctor &&
    form.bookingType !== "doctor_online" &&
    form.bookingType !== "follow_up" &&
    form.bookingType !== "physiotherapist" &&
    form.bookingType !== "full_care_ride";

  const buildDoctorOptionText = (d) => {
    const fees = d.effectiveFees || d.fees;
    const name = d.user?.name || d.doctorName || d.name || "Doctor";
    const spec = d.specialization || d.doctorSpec || "";
    const parts = [name];
    if (spec) parts.push(`— ${spec}`);
    if (isOnline) {
      if (fees?.videoFee > 0) parts.push(`· Video: ${fmt(fees.videoFee)}`);
    } else {
      if (fees?.inPersonFee > 0) parts.push(`· ${fmt(fees.inPersonFee)}`);
    }
    return parts.join(" ");
  };

  const doctorList = isOnline ? allDoctors || [] : doctorsByHospital || [];
  const isDoctorListLoading = isOnline ? allDoctorsLoading : doctorsLoading;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          {isDiag
            ? "Select Diagnostic Lab"
            : isOnline
              ? "Select Your Doctor"
              : "Select Doctor & Hospital"}
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          {isDiag
            ? "Find a lab and choose tests or packages. Prices shown include subscription discount if applicable."
            : isOnline
              ? "Search for a doctor available for video consultation. 5% GST applies on video fee."
              : "Search for a hospital, then choose your doctor and consultation type."}
        </p>
      </div>

      <SubCoverageBanner
        form={form}
        subCoverage={form.subCoverage}
        consultationType={form.consultationType}
      />
      {isDiag && <DiagSubBanner subCoverage={form.subCoverage} />}

      {isOnline && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5">
          <Video size={13} className="text-primary flex-shrink-0 mt-0.5" />
          <p
            className="text-[11px] font-semibold text-primary leading-snug"
            style={PP}
          >
            Online consultation is video-only. 5% GST applies. Cash payment not
            available. No hospital selection needed.
          </p>
        </div>
      )}

      {/* ─── Diagnostic Lab ─────────────────────────────────────────────── */}
      {isDiag && (
        <SCard title="Find a Lab" icon={providerIcon} accent={providerAccent}>
          <Field label="Search by City" note="Type city and click Find">
            <div className="flex gap-2">
              <Inp
                placeholder="e.g. Vijayawada…"
                value={form.labCity || ""}
                onChange={(e) => set("labCity", e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => onLoadLabs(form.labCity || "")}
                className="px-3 py-2.5 rounded-xl border-2 border-primary text-primary font-black text-xs flex items-center gap-1 hover:bg-primary hover:text-primary-content transition-colors flex-shrink-0 min-w-[64px] justify-center"
                style={PP}
              >
                {labsLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Search size={12} />
                )}
                <span className="hidden sm:inline ml-1">Find</span>
              </button>
            </div>
          </Field>

          {labs?.length > 0 && (
            <Field
              label="Select Lab"
              note="Home ✓ = home collection available"
              error={errors.labId}
            >
              <Sel
                value={form.labId || ""}
                onChange={(e) => {
                  const labId = e.target.value;
                  set("labId", labId);
                  set(
                    "labName",
                    labs.find((l) => l._id === labId)?.labName || "",
                  );
                  set("selectedTests", []);
                  set("selectedPackages", []);
                  if (labId) onLoadLabDetail(labId);
                }}
              >
                <option value="">— Choose a lab —</option>
                {labs.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.labName} — {l.registeredAddress?.city}
                    {labSupportsHomeCollection(l) ? " (Home ✓)" : ""}
                  </option>
                ))}
              </Sel>
            </Field>
          )}

          {labDetailLoading && (
            <div
              className="flex items-center gap-2 text-xs text-base-content/40 py-1"
              style={PP}
            >
              <Loader2 size={11} className="animate-spin" />
              Loading tests…
            </div>
          )}
          {!labDetailLoading && form.labId && !labDetail && (
            <div
              className="flex items-center gap-2 text-xs text-error py-1"
              style={PP}
            >
              <AlertCircle size={11} />
              Failed to load lab tests. Try selecting lab again.
            </div>
          )}

          {labDetail && (
            <>
              <Field
                label="Select Tests"
                note="Tap to select/deselect · prices after sub discount"
                error={errors.selectedTests}
              >
                <div className="w-full bg-base-200/60 border border-base-300 rounded-xl max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                  {labDetail.labTests
                    ?.filter((t) =>
                      form.bookingType === "diagnostic_home"
                        ? t.homeCollectionAvailable === true
                        : true,
                    )
                    .map((t) => {
                      const testSlug = t.slug;
                      if (!testSlug) return null;

                      const discPct =
                        form.subCoverage?.diagnosticsDiscountPercent || 0;
                      const basePrice = t.discountedPrice ?? t.mrpPrice;
                      const displayPrice =
                        discPct > 0
                          ? +(basePrice * (1 - discPct / 100)).toFixed(0)
                          : basePrice;

                      const isSelected = (form.selectedTests || []).includes(
                        testSlug,
                      );

                      return (
                        <button
                          key={testSlug}
                          type="button"
                          onClick={() => {
                            const current = form.selectedTests || [];
                            if (current.includes(testSlug)) {
                              set(
                                "selectedTests",
                                current.filter((v) => v !== testSlug),
                              );
                            } else {
                              set("selectedTests", [...current, testSlug]);
                            }
                          }}
                          style={PP}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-base-300/50 text-base-content"
                          }`}
                        >
                          <span className="text-left flex-1 pr-2">
                            {t.testName} — {fmt(displayPrice)}
                            {discPct > 0
                              ? ` (was ${fmt(basePrice)}, ${discPct}% off)`
                              : ""}{" "}
                            · +5% GST
                          </span>
                          {isSelected && (
                            <Check
                              size={14}
                              className="flex-shrink-0"
                              strokeWidth={3}
                            />
                          )}
                        </button>
                      );
                    })}
                </div>
                {form.selectedTests?.length > 0 && (
                  <p
                    className="text-[10px] text-primary font-bold mt-1"
                    style={PP}
                  >
                    {form.selectedTests.length} test
                    {form.selectedTests.length > 1 ? "s" : ""} selected · 5% GST
                    on each
                  </p>
                )}
              </Field>

              {labDetail.labPackages?.length > 0 && (
                <Field
                  label="Packages (optional)"
                  note="Tap to select/deselect · prices after sub discount"
                >
                  <div className="w-full bg-base-200/60 border border-base-300 rounded-xl max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                    {labDetail.labPackages?.map((p) => {
                      const pkgSlug = p.slug;
                      if (!pkgSlug) return null;

                      const discPct =
                        form.subCoverage?.diagnosticsDiscountPercent || 0;
                      const basePrice = p.mrpPrice;
                      const displayPrice =
                        discPct > 0
                          ? +(basePrice * (1 - discPct / 100)).toFixed(0)
                          : basePrice;

                      const isSelected = (form.selectedPackages || []).includes(
                        pkgSlug,
                      );

                      return (
                        <button
                          key={pkgSlug}
                          type="button"
                          onClick={() => {
                            const current = form.selectedPackages || [];
                            if (current.includes(pkgSlug)) {
                              set(
                                "selectedPackages",
                                current.filter((v) => v !== pkgSlug),
                              );
                            } else {
                              set("selectedPackages", [...current, pkgSlug]);
                            }
                          }}
                          style={PP}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-base-300/50 text-base-content"
                          }`}
                        >
                          <span className="text-left flex-1 pr-2">
                            {p.packageName} — {fmt(displayPrice)}
                            {discPct > 0
                              ? ` (was ${fmt(basePrice)}, ${discPct}% off)`
                              : ""}{" "}
                            · +5% GST
                          </span>
                          {isSelected && (
                            <Check
                              size={14}
                              className="flex-shrink-0"
                              strokeWidth={3}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              <Field label="Report Delivery Mode">
                <Sel
                  value={form.reportDeliveryMode || "Digital (App)"}
                  onChange={(e) => set("reportDeliveryMode", e.target.value)}
                >
                  {REPORT_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Sel>
              </Field>
            </>
          )}
        </SCard>
      )}

      {/* ─── Doctor / Hospital ────────────────────────────────────────────── */}
      {bt?.needsDoctor && (
        <SCard
          title={isOnline ? "Find Doctor for Video Call" : "Hospital & Doctor"}
          icon={providerIcon}
          accent={providerAccent}
        >
          {!isOnline && (
            <Field
              label="Hospital / Clinic"
              note="Search by city"
              error={errors.hospitalId}
            >
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Inp
                    placeholder="City, e.g. Vijayawada…"
                    value={form.hospSearch || ""}
                    onChange={(e) => set("hospSearch", e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => onLoadHospitals(form.hospSearch)}
                    className="px-3 py-2.5 rounded-xl border-2 border-primary text-primary font-black text-xs flex items-center gap-1 hover:bg-primary hover:text-primary-content transition-colors flex-shrink-0 min-w-[64px] justify-center"
                    style={PP}
                  >
                    {hospitalsLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Search size={12} />
                    )}
                    <span className="hidden sm:inline ml-1">Find</span>
                  </button>
                </div>
                {hospitals?.length > 0 && (
                  <Sel
                    value={form.hospitalId || ""}
                    onChange={(e) => {
                      const hId = e.target.value;
                      const h = hospitals.find((h) => h._id === hId);
                      set("hospitalId", hId);
                      set("hospitalName", h?.name || "");
                      set("hospitalAddress", h?.address || null);
                      set("hospitalCoords", h?.location?.coordinates || null);
                      set("doctorId", "");
                      set("doctorName", "");
                      if (hId && h?.location?.coordinates) {
                        const coords = h.location.coordinates;
                        set("destinationLocation", {
                          coordinates: coords,
                          address:
                            [
                              h.address?.line1,
                              h.address?.line2,
                              h.address?.city,
                            ]
                              .filter(Boolean)
                              .join(", ") || h.name,
                          city: h.address?.city || "",
                          pincode: h.address?.pincode || "",
                        });
                      }
                      if (hId) onLoadDoctors(hId);
                      onResetHospAvail?.();
                      onResetDocAvail?.();
                    }}
                  >
                    <option value="">— Select hospital —</option>
                    {hospitals.map((h) => (
                      <option key={h._id} value={h._id}>
                        {h.name} — {h.address?.city}
                        {h.is24x7 ? " · 24×7" : ""}
                      </option>
                    ))}
                  </Sel>
                )}
                {form.hospitalId && form.scheduledAt && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span
                      className="text-[10px] text-base-content/40"
                      style={PP}
                    >
                      Hospital:
                    </span>
                    <AvailPill
                      avail={hospitalAvail}
                      loading={hospitalAvailLoading}
                    />
                    {!hospitalAvail && !hospitalAvailLoading && (
                      <button
                        type="button"
                        onClick={onCheckHospAvail}
                        className="text-[10px] text-primary font-bold hover:underline"
                        style={PP}
                      >
                        Check now
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Field>
          )}

          {isOnline && (
            <Field
              label="Search Doctors"
              note="Filter by name or specialization"
            >
              <div className="flex gap-2">
                <Inp
                  placeholder="e.g. Cardiologist, Dr. Kumar…"
                  value={form.doctorSearch || ""}
                  onChange={(e) => set("doctorSearch", e.target.value)}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() =>
                    onLoadAllDoctors?.({
                      isOnline: "true",
                      consultationType: "video",
                    })
                  }
                  className="px-3 py-2.5 rounded-xl border-2 border-primary text-primary font-black text-xs flex items-center gap-1 hover:bg-primary hover:text-primary-content transition-colors flex-shrink-0 min-w-[64px] justify-center"
                  style={PP}
                >
                  {allDoctorsLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Search size={12} />
                  )}
                  <span className="hidden sm:inline ml-1">Find</span>
                </button>
              </div>
            </Field>
          )}

          {isDoctorListLoading && (
            <div
              className="flex items-center gap-2 text-xs text-base-content/40 py-1"
              style={PP}
            >
              <Loader2 size={11} className="animate-spin" />
              Loading doctors…
            </div>
          )}

          {doctorList.length > 0 && (
            <Field
              label={isOnline ? "Select Doctor" : "Doctor"}
              note="Fee shown in option"
              error={errors.doctorId}
            >
              <Sel
                value={form.doctorId || ""}
                onChange={(e) => {
                  const d = doctorList.find((d) => d._id === e.target.value);
                  set("doctorId", e.target.value);
                  set("doctorName", d?.user?.name || d?.name || "");
                  set("doctorSpec", d?.specialization || "");
                  set("doctorFees", d?.effectiveFees || d?.fees || null);
                  if (isOnline && d) {
                    set("hospitalId", d.hospitalId || d.hospital?._id || "");
                    set(
                      "hospitalName",
                      d.hospitalName || d.hospital?.name || "",
                    );
                  }
                  onResetDocAvail?.();
                }}
              >
                <option value="">— Select doctor —</option>
                {doctorList
                  .filter((d) => {
                    if (!form.doctorSearch) return true;
                    const q = form.doctorSearch.toLowerCase();
                    return (
                      (d.user?.name || d.name || "")
                        .toLowerCase()
                        .includes(q) ||
                      (d.specialization || "").toLowerCase().includes(q)
                    );
                  })
                  .map((d) => (
                    <option key={d._id} value={d._id}>
                      {buildDoctorOptionText(d)}
                    </option>
                  ))}
              </Sel>
            </Field>
          )}

          {isOnline &&
            form.doctorId &&
            (form.hospitalName || form.doctorSpec) && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-primary/20 bg-primary/5"
              >
                <Building2 size={13} className="text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  {form.hospitalName && (
                    <p
                      className="text-xs font-black text-primary truncate"
                      style={PP}
                    >
                      {form.hospitalName}
                    </p>
                  )}
                  {form.doctorSpec && (
                    <p
                      className="text-[10px] text-primary font-semibold opacity-70"
                      style={PP}
                    >
                      {form.doctorSpec}
                    </p>
                  )}
                </div>
                <span
                  className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={PP}
                >
                  Hospital
                </span>
              </motion.div>
            )}

          {!doctorList.length && !isDoctorListLoading && !isOnline && (
            <Field
              label="Doctor Profile ID"
              note="Enter directly if known"
              error={errors.doctorId}
            >
              <Inp
                placeholder="Doctor profile ObjectId…"
                value={form.doctorId || ""}
                onChange={(e) => {
                  set("doctorId", e.target.value);
                  set("doctorName", "");
                  set("doctorFees", null);
                  onResetDocAvail?.();
                }}
              />
            </Field>
          )}

          {form.doctorId && form.scheduledAt && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-base-content/40" style={PP}>
                Doctor slot:
              </span>
              <AvailPill avail={doctorAvail} loading={doctorAvailLoading} />
              {!doctorAvail && !doctorAvailLoading && (
                <button
                  type="button"
                  onClick={onCheckDocAvail}
                  className="text-[10px] text-primary font-bold hover:underline"
                  style={PP}
                >
                  Check now
                </button>
              )}
            </div>
          )}

          {form.doctorFees && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-info/20 bg-info/5"
            >
              <p
                className="text-[9px] font-black uppercase tracking-widest text-info px-3 pt-2 pb-1"
                style={PP}
              >
                {form.doctorName || "Doctor"} — Fee Schedule
              </p>
              <div className="grid grid-cols-3 gap-0 px-3 pb-2">
                {[
                  { key: "inPersonFee", label: "In-Person", gst: "0% GST" },
                  { key: "videoFee", label: "Video", gst: "+5% GST" },
                  { key: "followUpFee", label: "Follow-Up", gst: "0% GST" },
                ].map((item, idx) => (
                  <div
                    key={item.key}
                    className={`text-center ${idx > 0 ? "border-l border-info/20" : ""}`}
                  >
                    <p
                      className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider"
                      style={PP}
                    >
                      {item.label}
                    </p>
                    <p className="text-xs font-black text-info" style={PP}>
                      {form.doctorFees[item.key] != null &&
                      form.doctorFees[item.key] > 0 ? (
                        fmt(form.doctorFees[item.key])
                      ) : (
                        <span className="text-base-content/30">—</span>
                      )}
                    </p>
                    <p
                      className="text-[8px] text-base-content/35 font-semibold"
                      style={PP}
                    >
                      {item.gst}
                    </p>
                  </div>
                ))}
              </div>
              <p
                className="text-[9px] text-center text-base-content/35 px-3 pb-2"
                style={PP}
              >
                Source:{" "}
                {form.doctorFees?.source === "hospital"
                  ? "Hospital pricing"
                  : "Doctor's own rates"}
              </p>
            </motion.div>
          )}

          {showConsultTypes && (
            <Field label="Consultation Type" note="GST differs by type">
              <div className="grid grid-cols-3 gap-1.5">
                {CONSULT_TYPES.map(
                  ({ value, label, icon: Icon, feeKey, gstNote }) => {
                    const on = form.consultationType === value;
                    const fee = form.doctorFees
                      ? form.doctorFees[feeKey]
                      : null;
                    const notAvailable =
                      form.doctorFees != null && (fee == null || fee === 0);
                    const isHome = value === "homeVisit";
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          !notAvailable && set("consultationType", value)
                        }
                        disabled={notAvailable}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 transition-all text-center relative ${on ? "border-primary bg-primary/10 text-primary" : notAvailable ? "border-base-300 bg-base-100 opacity-40 cursor-not-allowed" : "border-base-300 bg-base-200 text-base-content"}`}
                        style={PP}
                      >
                        <Icon size={13} />
                        <span
                          className="text-[9px] font-black uppercase tracking-wide leading-tight"
                          style={PP}
                        >
                          {label}
                        </span>
                        {fee != null && fee > 0 ? (
                          <span
                            className={`text-[8px] font-bold ${on ? "text-primary" : "text-base-content/60"}`}
                            style={PP}
                          >
                            {fmt(fee)}
                          </span>
                        ) : notAvailable ? (
                          <span
                            className="text-[8px] font-bold text-error/60"
                            style={PP}
                          >
                            N/A
                          </span>
                        ) : (
                          <span
                            className="text-[8px] text-base-content/30"
                            style={PP}
                          >
                            —
                          </span>
                        )}
                        <span
                          className={`text-[7px] font-black leading-none ${on ? "text-primary/60" : "text-base-content/30"}`}
                          style={PP}
                        >
                          {gstNote}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </Field>
          )}

          {isOnline && form.doctorFees && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Video size={13} className="text-primary" />
                <div>
                  <p className="text-xs font-black text-primary" style={PP}>
                    Video Fee
                  </p>
                  <p
                    className="text-[9px] text-primary/60 font-semibold"
                    style={PP}
                  >
                    +5% GST on video
                  </p>
                </div>
              </div>
              <p className="text-base font-black text-primary" style={PP}>
                {form.doctorFees.videoFee != null &&
                form.doctorFees.videoFee > 0
                  ? fmt(form.doctorFees.videoFee)
                  : "—"}
              </p>
            </div>
          )}
        </SCard>
      )}

      {/* ─── Follow-up eligibility ─────────────────────────────────────────── */}
      {form.bookingType === "follow_up" && form.doctorId && (
        <div className="space-y-2">
          {followUpCheckLoading && (
            <div
              className="flex items-center gap-2 text-xs text-base-content/40 p-3 rounded-xl border border-base-300 bg-base-200"
              style={PP}
            >
              <Loader2 size={11} className="animate-spin" />
              Checking follow-up eligibility…
            </div>
          )}
          {followUpCheck && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${followUpCheck.isEligible ? "border-success/25 bg-success/5 text-success" : "border-error/25 bg-error/5 text-error"}`}
            >
              {followUpCheck.isEligible ? (
                <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold text-xs" style={PP}>
                  {followUpCheck.isEligible
                    ? `Eligible — Fee: ${fmt(followUpCheck.followUpFee)}`
                    : followUpCheck.reason}
                </p>
                {followUpCheck.isEligible && (
                  <>
                    <p className="text-[10px] opacity-70 mt-0.5" style={PP}>
                      {followUpCheck.daysRemaining} days remaining · Ref:{" "}
                      {followUpCheck.parentOpNumber}
                    </p>
                    <p
                      className="text-[10px] opacity-60 mt-0.5 italic"
                      style={PP}
                    >
                      Follow-up fee is independent of subscription quota. 0%
                      GST.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — PATIENT
// ─────────────────────────────────────────────────────────────────────────────

function StepPatient({ form, set, errors }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Patient Information
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Details captured at booking — accurate even if your profile updates
          later.
        </p>
      </div>
      <div className="flex gap-2">
        {[
          { v: true, l: "For myself" },
          { v: false, l: "For someone else" },
        ].map(({ v, l }) => {
          const on = form.patientIsSelf === v;
          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => set("patientIsSelf", v)}
              className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-xs transition-all ${on ? "border-primary bg-primary/5 text-primary" : "border-base-300 bg-base-200 text-base-content"}`}
              style={PP}
            >
              {l}
            </button>
          );
        })}
      </div>
      <SCard title="Patient Details" icon={User} accent="var(--primary)">
        <div className="space-y-3">
          <Field
            label="Full Name"
            required
            note="As on government ID"
            error={errors.patientName}
          >
            <Inp
              placeholder="e.g. Ravi Kumar Reddy"
              value={form.patientName || ""}
              onChange={(e) => set("patientName", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Age (years)" error={errors.patientAge}>
              <Inp
                type="number"
                min="0"
                max="150"
                placeholder="34"
                value={form.patientAge || ""}
                onChange={(e) => set("patientAge", Number(e.target.value))}
              />
            </Field>
            <Field label="Gender">
              <Sel
                value={form.patientGender || ""}
                onChange={(e) => set("patientGender", e.target.value)}
              >
                <option value="">— Select —</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Sel>
            </Field>
          </div>
          <Field
            label="Mobile Number"
            note="Confirmation SMS here"
            error={errors.patientPhone}
          >
            <Inp
              type="tel"
              placeholder="+91 98765 43210"
              value={form.patientPhone || ""}
              onChange={(e) => set("patientPhone", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Blood Group">
              <Sel
                value={form.patientBloodGroup || ""}
                onChange={(e) => set("patientBloodGroup", e.target.value)}
              >
                <option value="">— Select —</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Sel>
            </Field>
            <Field label="Weight (kg)">
              <Inp
                type="number"
                min="0"
                placeholder="68"
                value={form.patientWeight || ""}
                onChange={(e) => set("patientWeight", Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Emergency Contact (optional)" note="Alternative number">
            <Inp
              type="tel"
              placeholder="+91 77777 88888"
              value={form.emergencyContact || ""}
              onChange={(e) => set("emergencyContact", e.target.value)}
            />
          </Field>
        </div>
      </SCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — SCHEDULE + LOCATION
// ─────────────────────────────────────────────────────────────────────────────

function StepSchedule({
  form,
  set,
  errors,
  caTiersLoading,
  hospitalAvail,
  hospitalAvailLoading,
  doctorAvail,
  doctorAvailLoading,
  transportEstimate,
  transportLoading,
  onCheckHospAvail,
  onCheckDocAvail,
  onEstimateTransport,
  onResetHospAvail,
  onResetDocAvail,
  caTiers,
  isLoaded,
}) {
  const isFullCare = form.bookingType === "full_care_ride";
  const isTransport = form.bookingType === "patient_transport";
  const isDiagHome = form.bookingType === "diagnostic_home";
  const isCareOnly = form.bookingType === "care_assistant";
  const isPhysio = form.bookingType === "physiotherapist";

  useEffect(() => {
    if (
      (isTransport || isFullCare) &&
      form.patientLocation?.coordinates &&
      (form.destinationLocation?.coordinates || isFullCare)
    ) {
      onEstimateTransport();
    }
  }, [
    form.patientLocation?.coordinates?.[0],
    form.patientLocation?.coordinates?.[1],
    form.destinationLocation?.coordinates?.[0],
    form.destinationLocation?.coordinates?.[1],
    form.includeReturn,
    form.includeReturnHome,
    form.waitingMinutes,
    form.bookingType,
    isFullCare,
    isTransport,
  ]);

 const getIstMinDate = () => {
    const d = new Date(Date.now() + 15 * 60000);
    // Add 5.5 hours to align the UTC output with IST for the HTML input
    const istTime = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
    return istTime.toISOString().slice(0, 16);
  };
  const minDate = getIstMinDate();
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];
  const tFee = resolveTransportFee(transportEstimate);
  const caResolved = resolveCaFee(form, caTiers);

  const handleDateTimeChange = (val) => {
    set("scheduledAt", val);
    onResetHospAvail?.();
    onResetDocAvail?.();
  };

  const CaTierGrid = ({ tiers, selectedHours, onSelect }) => (
    <div className="grid grid-cols-3 gap-1.5">
      {tiers.map(({ hours: h, maxHours, label, price }, tierIdx) => {
        const on = selectedHours === h;
        const rangeLabel = maxHours ? `${h}–${maxHours}h` : `${h}+h`;
        const caFreeViaSub =
          !!form.subCoverage?.careAssistantFree &&
          !form.subCoverage?.isCustomPlan;
        const planTierIdx = form.subCoverage?.careAssistantTierIndex ?? 0;
        const hasQuota = !!(
          form.subCoverage?.isCustomPlan &&
          form.subCoverage?.careAssistantAllowed &&
          (form.subCoverage?.careAssistantRemaining ?? 0) > 0
        );
        const isQuotaTier = hasQuota && tierIdx === planTierIdx;
        return (
          <button
            key={h}
            type="button"
            onClick={() => onSelect(h)}
            className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl border-2 transition-all ${on ? (isQuotaTier || caFreeViaSub ? "border-success bg-success/10 text-success" : "border-warning bg-warning/10 text-warning") : "border-base-300 bg-base-200 text-base-content"}`}
          >
            <span
              className="text-[10px] font-black text-center leading-tight"
              style={PP}
            >
              {label}
            </span>
            <span
              className="text-[9px] font-semibold opacity-60 text-center"
              style={PP}
            >
              {rangeLabel}
            </span>
         {caFreeViaSub && tierIdx === 0 ? (
                          <span className="text-[9px] font-black text-success" style={PP}>
                            FREE
                          </span>
                        ) : caFreeViaSub && tierIdx > 0 ? (
                          <span className="text-[9px] font-black text-warning" style={PP}>
                            {fmt(price)} · extra
                          </span>
            ) : isQuotaTier ? (
              <span className="text-[9px] font-black text-success" style={PP}>
                FREE · plan
              </span>
            ) : hasQuota ? (
              <span className="text-[9px] font-black text-warning" style={PP}>
                {fmt(price)} · extra
              </span>
            ) : (
              <span
                className={`text-[11px] font-black ${on ? "text-warning" : "text-primary"}`}
                style={PP}
              >
                {fmt(price)}
              </span>
            )}
            {!caFreeViaSub && !isQuotaTier && (
              <span
                className="text-[7px] text-base-content/30 font-semibold"
                style={PP}
              >
                +18% GST
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Schedule & Location
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Set your preferred date, time, and locations.
        </p>
      </div>
      <SubCoverageBanner
        subCoverage={form.subCoverage}
        consultationType={form.consultationType}
      />

      <SCard
        title="Appointment Date & Time"
        icon={Calendar}
        accent="var(--primary)"
      >
        <Field
          label="Scheduled Date & Time"
          required
          note="Min 15 min from now"
          error={errors.scheduledAt}
        >
          <Inp
            type="datetime-local"
            value={form.scheduledAt || ""}
            min={minDate}
            step="60"
            onChange={(e) => handleDateTimeChange(e.target.value)}
          />
        </Field>
        {form.scheduledAt && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {form.hospitalId && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-base-content/40" style={PP}>
                  Hospital:
                </span>
                <AvailPill
                  avail={hospitalAvail}
                  loading={hospitalAvailLoading}
                />
                {!hospitalAvailLoading && (
                  <button
                    type="button"
                    onClick={onCheckHospAvail}
                    className="text-[10px] text-primary font-bold hover:underline"
                    style={PP}
                  >
                    {hospitalAvail ? "Recheck" : "Check now"}
                  </button>
                )}
              </div>
            )}
            {form.doctorId && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-base-content/40" style={PP}>
                  Doctor:
                </span>
                <AvailPill avail={doctorAvail} loading={doctorAvailLoading} />
                {!doctorAvailLoading && (
                  <button
                    type="button"
                    onClick={onCheckDocAvail}
                    className="text-[10px] text-primary font-bold hover:underline"
                    style={PP}
                  >
                    {doctorAvail ? "Recheck" : "Check now"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <Field label="Slot ID (optional)" note="If doctor shared a slot ref">
          <Inp
            placeholder="e.g. SLOT-202506-0042"
            value={form.slotId || ""}
            onChange={(e) => set("slotId", e.target.value)}
          />
        </Field>
      </SCard>

      {isFullCare && (
        <>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-info/20 bg-info/5">
            <Info size={11} className="text-info flex-shrink-0" />
            <p className="text-[10px] font-semibold text-info" style={PP}>
              Drop-off auto-set to selected hospital. Set your pickup below.
              Transport = ₹/km × distance + 5% GST.
            </p>
          </div>
          <SCard
            title="Drop-off Destination (Hospital)"
            icon={Building2}
            accent="#ef4444"
          >
            <LocationPicker
              label="Hospital / Destination Address"
              required
              note="Auto-set from hospital selection"
              value={form.destinationLocation}
              onChange={(loc) => set("destinationLocation", loc)}
              error={errors.destinationLocation}
              readOnly={!!form.hospitalId && !!form.destinationLocation}
              readOnlyNote={`Hospital: ${form.hospitalName || "Selected hospital"}`}
              isLoaded={isLoaded}
            />
          </SCard>
          <SCard
            title="Pickup Location (Your Home)"
            icon={MapPin}
            accent="#f59e0b"
          >
            <LocationPicker
              label="Your Home / Pickup Address"
              required
              note="Transport fare: pickup → hospital"
              value={form.patientLocation}
              onChange={(loc) => set("patientLocation", loc)}
              error={errors.patientLocation}
              isLoaded={isLoaded}
            />
            <Field
              label="Include Return Trip Home?"
              note="Return ride from hospital"
            >
              <div className="flex gap-2">
                {[
                  { v: false, l: "No" },
                  { v: true, l: "Yes — return home" },
                ].map(({ v, l }) => {
                  const on = form.includeReturnHome === v;
                  return (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => set("includeReturnHome", v)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-[11px] font-bold transition-all ${on ? "border-primary bg-primary/5 text-primary" : "border-base-300 bg-base-200 text-base-content"}`}
                      style={PP}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </Field>
          </SCard>
          <SCard title="Care Assistant Duration" icon={Timer} accent="#f59e0b">
            <div className="flex items-start gap-1.5 mb-2 p-2 rounded-lg bg-warning/5 border border-warning/15">
              <Info
                size={10}
                className="text-warning/70 flex-shrink-0 mt-0.5"
              />
              <p
                className="text-[9px] text-warning/80 font-semibold leading-snug"
                style={PP}
              >
                Fixed plan: CA free (quota consumed on admin assignment). Custom
                plan: only your subscribed tier is free. Other tiers charge
                platform rate + 18% GST.
              </p>
            </div>
            {caTiersLoading ? (
              <div
                className="flex items-center gap-2 text-xs text-base-content/40 py-2"
                style={PP}
              >
                <Loader2 size={11} className="animate-spin" />
                Loading pricing…
              </div>
            ) : caTiers.length === 0 ? (
              <p className="text-xs text-error font-bold" style={PP}>
                Pricing unavailable. Please retry.
              </p>
            ) : (
              <CaTierGrid
                tiers={caTiers}
                selectedHours={form.durationHours}
                onSelect={(h) => set("durationHours", h)}
              />
            )}
          </SCard>
          {form.patientLocation?.coordinates &&
            form.destinationLocation?.coordinates && (
              <SCard
                title="Live Transport Estimate"
                icon={Navigation2}
                accent="#4f46e5"
              >
                {transportLoading ? (
                  <div
                    className="flex items-center gap-2 text-xs text-base-content/40"
                    style={PP}
                  >
                    <Loader2 size={11} className="animate-spin" />
                    Calculating…
                  </div>
                ) : transportEstimate ? (
                  <div className="space-y-1">
                    <FareRow
                      label="Distance"
                      value={`${transportEstimate.distanceKm} km`}
                      sub
                    />
                    <FareRow
                      label={`Rate/km${tFee.ratePerKm ? ` (₹${tFee.ratePerKm})` : ""}`}
                      value={tFee.ratePerKm ? `₹${tFee.ratePerKm}/km` : "—"}
                      sub
                      note={
                        transportEstimate.kmRateSource === "subscription"
                          ? "Subscription plan rate (lower than ₹21/km default)"
                          : "Standard rate ₹21/km"
                      }
                    />
                    <FareRow
                      label="Transport (outbound)"
                      value={fmt(transportEstimate.outbound?.totalFare)}
                      gstRate={0}
                      gstLabel="excl. GST"
                    />
                    {form.includeReturnHome && transportEstimate.returnLeg && (
                      <FareRow
                        label="Return trip"
                        value={fmt(transportEstimate.returnLeg?.totalFare)}
                        sub
                      />
                    )}
                    <FareRow
                      label="Care Assistant"
                      value={
                        caResolved.isFree
                          ? "FREE"
                          : caResolved.fee > 0
                            ? fmt(caResolved.fee)
                            : fmt(caTier?.price || 0)
                      }
                      note={`${form.durationHours || caTiers[0]?.hours || 4} hrs`}
                      isFree={caResolved.isFree}
                      freeReason={caResolved.reason}
                      gstRate={caResolved.isFree ? null : 0.18}
                    />
                    <div className="border-t border-base-300 pt-1">
                      <FareRow
                        label="Transport Total (excl. GST)"
                        value={fmt(transportEstimate.totalTransportFee)}
                        bold
                        accent="var(--primary)"
                      />
                    </div>
                    <p
                      className="text-[9px] text-base-content/35 px-2"
                      style={PP}
                    >
                      + 5% GST on transport · 18% GST on care assistant (if not
                      free)
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-base-content/40" style={PP}>
                    Set pickup & destination to estimate.
                  </p>
                )}
              </SCard>
            )}
        </>
      )}

      {isTransport && (
        <>
          <SCard
            title="Drop-off Destination"
            icon={Navigation2}
            accent="#ef4444"
          >
            <LocationPicker
              label="Drop-off Address"
              required
              note="Fare is distance-based + 5% GST"
              value={form.destinationLocation}
              onChange={(loc) => set("destinationLocation", loc)}
              error={errors.destinationLocation}
              isLoaded={isLoaded}
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="Return Trip?" note="Ride back">
                <div className="flex gap-1.5">
                  {[
                    { v: false, l: "No" },
                    { v: true, l: "Yes" },
                  ].map(({ v, l }) => {
                    const on = form.includeReturn === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => set("includeReturn", v)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${on ? "border-primary bg-primary/5 text-primary" : "border-base-300 bg-base-200 text-base-content"}`}
                        style={PP}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Wait (min)" note="5 min free · ₹2/min after">
                <Inp
                  type="number"
                  min="0"
                  max="180"
                  placeholder="0"
                  value={form.waitingMinutes || ""}
                  onChange={(e) =>
                    set("waitingMinutes", Number(e.target.value))
                  }
                />
              </Field>
            </div>
          </SCard>
          <SCard title="Pickup Location" icon={MapPin} accent="#f59e0b">
            <LocationPicker
              label="Patient Pickup Address"
              required
              note="Drag pin for exact location"
              value={form.patientLocation}
              onChange={(loc) => set("patientLocation", loc)}
              error={errors.patientLocation}
              isLoaded={isLoaded}
            />
          </SCard>
          {form.patientLocation?.coordinates &&
            form.destinationLocation?.coordinates && (
              <div className="pt-1">
                {transportLoading && (
                  <div
                    className="flex items-center gap-2 text-xs text-base-content/40"
                    style={PP}
                  >
                    <Loader2 size={11} className="animate-spin" />
                    Calculating fare…
                  </div>
                )}
                {transportEstimate && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1"
                  >
                    <p
                      className="text-[10px] font-black uppercase tracking-widest text-primary mb-2"
                      style={PP}
                    >
                      Live Transport Estimate
                    </p>
                    <FareRow
                      label="Distance"
                      value={`${transportEstimate.distanceKm} km`}
                      sub
                    />
                    <FareRow
                      label="Rate/km"
                      value={tFee.ratePerKm ? `₹${tFee.ratePerKm}/km` : "—"}
                      note={
                        transportEstimate.kmRateSource === "subscription"
                          ? "Subscription plan rate · base ₹50 applies"
                          : "Standard rate · base ₹50 applies"
                      }
                      sub
                    />
                    <FareRow
                      label="Outbound fare"
                      value={fmt(transportEstimate.outbound?.totalFare)}
                    />
                    {form.includeReturn && transportEstimate.returnLeg && (
                      <FareRow
                        label="Return fare"
                        value={fmt(transportEstimate.returnLeg?.totalFare)}
                      />
                    )}
                    {form.waitingMinutes > 5 && (
                      <FareRow
                        label={`Waiting (${form.waitingMinutes - 5} billable min × ₹2)`}
                        value={fmt(transportEstimate.outbound?.waitingCharge)}
                        sub
                      />
                    )}
                    <div className="border-t border-primary/20 pt-1 mt-1">
                      <FareRow
                        label="Estimated Total (excl. GST)"
                        value={fmt(transportEstimate.totalTransportFee)}
                        bold
                        accent="var(--primary)"
                      />
                    </div>
                    <p
                      className="text-[9px] text-base-content/35 px-2"
                      style={PP}
                    >
                      + 5% GST applied at payment step
                      {transportEstimate.kmRateSource === "subscription" && (
                        <span className="text-success font-bold">
                          {" "}
                          · Subscription rate applied
                        </span>
                      )}
                    </p>
                  </motion.div>
                )}
              </div>
            )}
        </>
      )}

      {isDiagHome && (
        <SCard title="Sample Collection Address" icon={Home} accent="#14b8a6">
          <LocationPicker
            label="Your Home Address"
            required
            note="Lab technician comes here"
            value={form.patientLocation}
            onChange={(loc) => set("patientLocation", loc)}
            error={errors.patientLocation}
            isLoaded={isLoaded}
          />
        </SCard>
      )}

      {isCareOnly && (
        <SCard
          title="Service Location & Duration"
          icon={Timer}
          accent="#f59e0b"
        >
          <LocationPicker
            label="Your Location"
            required
            note="Nearest care assistant dispatched here"
            value={form.patientLocation}
            onChange={(loc) => set("patientLocation", loc)}
            error={errors.patientLocation}
            isLoaded={isLoaded}
          />
          <Field
            label="Care Duration"
            note="Tiered pricing · 18% GST on CA fee"
          >
            {caTiersLoading ? (
              <div
                className="flex items-center gap-2 text-xs text-base-content/40 py-2"
                style={PP}
              >
                <Loader2 size={11} className="animate-spin" />
                Loading pricing…
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {caTiers.map(
                  ({ hours: h, maxHours, label, price }, tierIdx) => {
                    const on = form.durationHours === h;
                    const rangeLabel = maxHours
                      ? `${h}–${maxHours}h`
                      : `${h}+h`;
                    const caFreeViaSub =
                      !!form.subCoverage?.careAssistantFree &&
                      !form.subCoverage?.isCustomPlan;
                    const planTierIdx =
                      form.subCoverage?.careAssistantTierIndex ?? 0;
                    const hasQuota = !!(
                      form.subCoverage?.isCustomPlan &&
                      form.subCoverage?.careAssistantAllowed &&
                      (form.subCoverage?.careAssistantRemaining ?? 0) > 0
                    );
                    const isQuotaTier = hasQuota && tierIdx === planTierIdx;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => set("durationHours", h)}
                        className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl border-2 transition-all ${on ? "border-warning bg-warning/10 text-warning" : "border-base-300 bg-base-200 text-base-content"}`}
                      >
                        <span
                          className="text-[10px] font-black text-center leading-tight"
                          style={PP}
                        >
                          {label}
                        </span>
                        <span
                          className="text-[9px] font-semibold opacity-60"
                          style={PP}
                        >
                          {rangeLabel}
                        </span>
{caFreeViaSub && tierIdx === 0 ? (
                          <span className="text-[9px] font-black text-success" style={PP}>
                            FREE
                          </span>
                        ) : caFreeViaSub && tierIdx > 0 ? (
                          <span className="text-[9px] font-black text-warning" style={PP}>
                            {fmt(price)}
                          </span>
                        ) : isQuotaTier ? (
                          <span
                            className="text-[9px] font-black text-success"
                            style={PP}
                          >
                            FREE · plan
                          </span>
                        ) : hasQuota ? (
                          <span
                            className="text-[9px] font-black text-warning"
                            style={PP}
                          >
                            {fmt(price)} · extra
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-black ${on ? "text-warning" : "text-primary"}`}
                            style={PP}
                          >
                            {fmt(price)}
                          </span>
                        )}
                        {!caFreeViaSub && !isQuotaTier && (
                          <span
                            className="text-[7px] text-base-content/30 font-semibold"
                            style={PP}
                          >
                            +18% GST
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </Field>
        </SCard>
      )}

      {isPhysio && (
        <SCard title="Visit Type" icon={HeartPulse} accent="#10b981">
          <Field
            label="How would you like the session?"
            note="0% GST on consultation"
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  v: "inPerson",
                  l: "At Clinic",
                  icon: Building2,
                  note: "0% GST",
                },
                { v: "homeVisit", l: "Home Visit", icon: Home, note: "5% GST" },
              ].map(({ v, l, icon: Icon, note }) => {
                const on = form.consultationType === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("consultationType", v)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${on ? "border-success bg-success/10 text-success" : "border-base-300 bg-base-200 text-base-content"}`}
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-xs" style={PP}>
                        {l}
                      </span>
                      <p
                        className="text-[8px] opacity-50 font-semibold"
                        style={PP}
                      >
                        {note}
                      </p>
                    </div>
                    {on && (
                      <Check
                        size={11}
                        className="ml-auto flex-shrink-0"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Field>
          {form.consultationType === "homeVisit" && (
            <LocationPicker
              label="Your Home Address for Physio"
              required
              note="Physiotherapist will visit here"
              value={form.patientLocation}
              onChange={(loc) => set("patientLocation", loc)}
              error={errors.patientLocation}
              isLoaded={isLoaded}
            />
          )}
        </SCard>
      )}

      <SCard
        title="Special Instructions (optional)"
        icon={FileText}
        accent="var(--info)"
      >
        <Field label="Notes for Provider" note="Symptoms, accessibility needs">
          <Txta
            rows={3}
            placeholder="e.g. Patient uses wheelchair. Allergic to penicillin…"
            value={form.customerNotes || ""}
            onChange={(e) => set("customerNotes", e.target.value)}
          />
        </Field>
      </SCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

function StepPayment({
  form,
  set,
  transportEstimate,
  followUpCheck,
  caTiers,
  walletBalance,
  walletData,
  labDetail,
}) {
  const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);

  const consultResolved = bt?.needsDoctor
    ? resolveConsultFee(form, followUpCheck)
    : { fee: 0, isFree: false, gstRate: 0 };
  const caResolved = bt?.needsCare
    ? resolveCaFee(form, caTiers)
    : { fee: 0, isFree: false };
  const tResolved = resolveTransportFee(transportEstimate);

  const consultFee = consultResolved.fee;
  const caFee = caResolved.fee;
  const transportFee = bt?.needsTransport ? tResolved.fee : 0;
  const hasDiag = bt?.isDiag;

  const diagDiscountPct = form.subCoverage?.diagnosticsDiscountPercent || 0;
  // resolveHomeCollectionFree: true only if plan includes AND not yet used this period
  const homeCollectionFree =
    hasDiag && form.bookingType === "diagnostic_home"
      ? resolveHomeCollectionFree(form.subCoverage)
      : false;

  const diagFee = hasDiag ? form.estimatedDiagFee || 0 : 0;
  const diagGstAmt = hasDiag
    ? +(diagFee * GST_RATES.diagnostics).toFixed(2)
    : 0;

  const rawHomeColFee = labDetail?.homeCollectionFee ?? 0;
  const homeColFeeToCharge =
    form.bookingType === "diagnostic_home"
      ? homeCollectionFree
        ? 0
        : rawHomeColFee
      : 0;
  const homeColGstAmt = +(
    homeColFeeToCharge * GST_RATES.homeCollection
  ).toFixed(2);

  const consultGstRate = consultResolved.gstRate ?? 0;
  const consultGstAmt = bt?.needsDoctor
    ? +(consultFee * consultGstRate).toFixed(2)
    : 0;
  const transportGstAmt = bt?.needsTransport
    ? +(transportFee * GST_RATES.transport).toFixed(2)
    : 0;
  const caGstAmt =
    bt?.needsCare && !caResolved.isFree
      ? +(caFee * GST_RATES.careAssistant).toFixed(2)
      : 0;

  const subtotal =
    consultFee + transportFee + caFee + diagFee + homeColFeeToCharge;
  const totalGst =
    consultGstAmt + transportGstAmt + caGstAmt + diagGstAmt + homeColGstAmt;
  const estimatedTotal = +(subtotal + totalGst).toFixed(2);

  const hasKnownTotal =
    subtotal > 0 ||
    consultResolved.isFree ||
    caResolved.isFree ||
    (hasDiag &&
      (form.selectedTests?.length > 0 || form.selectedPackages?.length > 0));
  const consultTypeLabel =
    CONSULT_TYPES.find((c) => c.value === form.consultationType)?.label ||
    "In-Person";
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];

  // Available payment methods filtered by booking type (Cash hidden for doctor_online)
  const paymentMethods = getPaymentMethods(form.bookingType);

  // Reset Cash→Razorpay if switched to doctor_online
  useEffect(() => {
    if (form.bookingType === "doctor_online" && form.paymentMethod === "Cash") {
      set("paymentMethod", "Razorpay");
    }
  }, [form.bookingType, form.paymentMethod]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Payment & Fare Breakdown
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Review all charges before confirming. GST rates vary by service type.
        </p>
      </div>
      <SubCoverageBanner
        subCoverage={form.subCoverage}
        consultationType={form.consultationType}
      />
      {hasDiag && <DiagSubBanner subCoverage={form.subCoverage} />}

      <SCard title="Fare Breakdown" icon={Receipt} accent="var(--primary)">
        {bt?.needsDoctor && (
          <>
            <FareRow
              label={`Consultation (${consultTypeLabel})`}
              value={fmt(consultFee)}
              isFree={consultResolved.isFree}
              freeReason={consultResolved.reason}
              gstRate={consultResolved.isFree ? null : consultGstRate}
              note={
                form.bookingType === "follow_up"
                  ? "Follow-up fee — independent of subscription quota"
                  : form.consultationType === "homeVisit"
                    ? "Home visit — sub quota not applicable"
                    : undefined
              }
            />
            {!consultResolved.isFree && consultGstAmt > 0 && (
              <FareRow
                label={`GST on Consultation (${(consultGstRate * 100).toFixed(0)}%)`}
                value={fmt(consultGstAmt)}
                sub
              />
            )}
            {!consultResolved.isFree &&
              consultFee > 0 &&
              consultGstRate === 0 && (
                <div className="px-2.5 pb-1">
                  <p
                    className="text-[9px] text-base-content/35 italic"
                    style={PP}
                  >
                    In-person consultation: 0% GST (Section 9 healthcare exempt)
                  </p>
                </div>
              )}
            {!consultResolved.isFree &&
              form.consultationType === "homeVisit" && (
                <div className="px-2.5 pb-1">
                  <p
                    className="text-[9px] text-warning font-bold italic"
                    style={PP}
                  >
                    ⚠ Home visit always charged — sub quota covers
                    in-person/video only · 5% GST
                  </p>
                </div>
              )}
          </>
        )}

        {bt?.needsTransport && (
          <>
            <div className="border-t border-base-300/40 pt-1" />
            <FareRow
              label="Transport Charge"
              value={
                transportFee > 0
                  ? fmt(transportFee)
                  : "Set pickup & destination"
              }
              gstRate={transportFee > 0 ? GST_RATES.transport : null}
              note={
                transportEstimate
                  ? `${transportEstimate.distanceKm} km · ₹${tResolved.ratePerKm || "—"}/km${transportEstimate.kmRateSource === "subscription" ? " (plan rate)" : " (default)"}  · base ₹50`
                  : "Calculated from your location"
              }
            />
            {transportFee > 0 && (
              <FareRow
                label="GST on Transport (5%)"
                value={fmt(transportGstAmt)}
                sub
              />
            )}
          </>
        )}

        {bt?.needsCare && (
          <>
            <div className="border-t border-base-300/40 pt-1" />
            <FareRow
              label="Care Assistant Fee"
              value={
                caResolved.isFree
                  ? "FREE"
                  : caResolved.fee > 0
                    ? fmt(caResolved.fee)
                    : fmt(caTier?.price || 0)
              }
              note={
                caTier
                  ? `${caTier.label} · ${caTier.hours}${caTier.maxHours ? `–${caTier.maxHours}` : "+"} hrs`
                  : `${durHours}-hr session`
              }
              isFree={caResolved.isFree}
              freeReason={caResolved.reason}
              gstRate={caResolved.isFree ? null : GST_RATES.careAssistant}
            />
            {!caResolved.isFree && caGstAmt > 0 && (
              <FareRow
                label="GST on Care Assistant (18%)"
                value={fmt(caGstAmt)}
                sub
              />
            )}
            {!caResolved.isFree && (
              <div className="px-2.5">
                <p
                  className="text-[9px] text-base-content/35 italic"
                  style={PP}
                >
                  Care assistant services attract 18% GST (non-medical support
                  service)
                </p>
              </div>
            )}
          </>
        )}

        {hasDiag && (
          <>
            <div className="border-t border-base-300/40 pt-1" />
            <FareRow
              label="Diagnostic Tests / Packages"
              value={
                diagFee > 0 ? (
                  (form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 ? (
                    <span className="flex items-center gap-1.5 justify-end">
                      <span className="line-through text-[10px] opacity-50 font-medium">
                        {fmt(
                          Math.round(
                            diagFee /
                              (1 -
                                (form.subCoverage?.diagnosticsDiscountPercent ||
                                  0) /
                                  100),
                          ),
                        )}
                      </span>
                      <span>{fmt(diagFee)}</span>
                    </span>
                  ) : (
                    fmt(diagFee)
                  )
                ) : form.selectedTests?.length > 0 ||
                  form.selectedPackages?.length > 0 ? (
                  fmt(0)
                ) : (
                  "No tests selected"
                )
              }
              note={`${(form.selectedTests?.length || 0) + (form.selectedPackages?.length || 0)} item(s) selected${(form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 ? ` · ${form.subCoverage?.diagnosticsDiscountPercent || 0}% sub discount applied` : ""}`}
              gstRate={diagFee > 0 ? GST_RATES.diagnostics : null}
            />
            {(form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 &&
              diagFee > 0 && (
                <FareRow
                  label={`Subscription discount (${form.subCoverage?.diagnosticsDiscountPercent || 0}%)`}
                  value={`-${fmt(Math.round(diagFee / (1 - (form.subCoverage?.diagnosticsDiscountPercent || 0) / 100)) - diagFee)}`}
                  sub
                  note="Applied to base price · max cap 25%"
                  accent="var(--success)"
                />
              )}
            {diagFee > 0 && (
              <FareRow
                label="GST on Diagnostics (5%)"
                value={fmt(diagGstAmt)}
                sub
              />
            )}
          </>
        )}

        {form.bookingType === "diagnostic_home" && (
          <FareRow
            label="Home Collection Fee"
            value={
              homeCollectionFree
                ? "WAIVED"
                : labDetail?.homeCollectionFee != null
                  ? fmt(labDetail.homeCollectionFee)
                  : "Lab-dependent"
            }
            note={
              !homeCollectionFree && labDetail?.homeCollectionFee != null
                ? form.subCoverage?.homeCollectionIncluded &&
                  (form.subCoverage?.homeCollectionRemaining ?? 0) <= 0
                  ? "Quota exhausted — lab fee + 5% GST applies"
                  : "Charged by lab for technician visit · 5% GST"
                : undefined
            }
            sub={!homeCollectionFree}
            isFree={homeCollectionFree}
            freeReason={
              homeCollectionFree
                ? form.subCoverage?.homeCollectionUnlimited
                  ? "Unlimited home collection — included in plan"
                  : `${form.subCoverage?.homeCollectionRemaining ?? ""} use(s) remaining this subscription period`
                : undefined
            }
            gstRate={
              homeCollectionFree
                ? null
                : labDetail?.homeCollectionFee
                  ? GST_RATES.homeCollection
                  : null
            }
          />
        )}

        {hasKnownTotal && subtotal > 0 && !caResolved.isCustomPlan && (
          <div className="border-t border-base-300 pt-1 mt-1 space-y-0.5">
            <FareRow label="Subtotal (before GST)" value={fmt(subtotal)} />
            {totalGst > 0 && (
              <FareRow
                label="Total GST (mixed rates)"
                value={fmt(totalGst)}
                sub
                note="Transport 5% + CA 18% + Diag 5% + Consult varies"
              />
            )}
          </div>
        )}
        {hasKnownTotal &&
          subtotal === 0 &&
          (consultResolved.isFree || caResolved.isFree) && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-success/30 bg-success/5">
              <ShieldCheck size={12} className="text-success flex-shrink-0" />
              <p className="text-[11px] font-black text-success" style={PP}>
                All charges covered by your subscription!
              </p>
            </div>
          )}

        <div className="border-t border-base-300 pt-1 mt-1" />
        <FareRow
          label={
            caResolved.isCustomPlan
              ? "Partial Estimated Total"
              : "Estimated Total"
          }
          value={fmt(estimatedTotal)}
          note={
            estimatedTotal === 0
              ? "Fully covered by subscription"
              : "May vary ±5% after subscription & coupon application"
          }
          accent="var(--primary)"
          bold
          highlight
        />
      </SCard>

      {/* GST Reference box */}
      <GstReferenceBox />

      <SCard title="Coupon & Discounts" icon={Percent} accent="var(--success)">
        <Field
          label="Coupon Code (optional)"
          note="Valid coupons applied at booking"
        >
          <div className="flex gap-2">
            <Inp
              placeholder="e.g. CARE20 / FIRST50"
              value={form.couponCode || ""}
              onChange={(e) => set("couponCode", e.target.value.toUpperCase())}
              className="flex-1"
            />
            <button
              type="button"
              className="px-3 py-2.5 rounded-xl border-2 border-primary text-primary font-black text-xs hover:bg-primary hover:text-primary-content transition-colors flex-shrink-0"
              style={PP}
            >
              Apply
            </button>
          </div>
        </Field>
      </SCard>

      <SCard title="Payment Method" icon={CreditCard} accent="var(--secondary)">
        <div className="space-y-2">
          {paymentMethods.map(({ value, label, icon: Icon, desc }) => {
            const on = form.paymentMethod === value;
            return (
              <motion.button
                key={value}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => set("paymentMethod", value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${on ? "border-primary bg-primary/5" : "border-base-300 bg-base-100"}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? "bg-primary/12 text-primary" : "bg-base-200 text-base-content opacity-55"}`}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-black text-xs ${on ? "text-primary" : "text-base-content"}`}
                    style={PP}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[10px] text-base-content/40 truncate"
                    style={PP}
                  >
                    {desc}
                  </p>
                  {value === "Wallet" && on && walletBalance != null && (
                    <p
                      className="text-[10px] text-primary font-semibold mt-0.5"
                      style={PP}
                    >
                      Balance: {fmt(walletBalance)}
                    </p>
                  )}
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${on ? "border-primary bg-primary" : "border-base-300 bg-transparent"}`}
                >
                  {on && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </motion.button>
            );
          })}
          {form.bookingType === "doctor_online" && (
            <OnlineCashNotAvailableBanner />
          )}
        </div>

        {form.paymentMethod === "Wallet" && (
          <div className="mt-2">
            <WalletSplitBanner
              walletBalance={walletBalance}
              walletData={walletData}
              totalAmount={estimatedTotal}
              paymentMethod={form.paymentMethod}
            />
          </div>
        )}
        {form.paymentMethod === "Cash" && estimatedTotal > 0 && (
          <div className="mt-2">
            <CashPaymentBanner totalAmount={estimatedTotal} />
          </div>
        )}
        {form.paymentMethod === "Razorpay" && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5 mt-2">
            <CreditCard
              size={12}
              className="text-primary flex-shrink-0 mt-0.5"
            />
            <p className="text-[10px] text-primary font-semibold" style={PP}>
              Razorpay opens after you confirm. Supports UPI, Card, Net Banking.
              Secured by RBI-regulated gateway.
            </p>
          </div>
        )}
      </SCard>

      <div className="flex items-start gap-2 p-3 rounded-xl border border-base-300 bg-base-200/50">
        <ShieldCheck
          size={13}
          className="text-base-content/40 flex-shrink-0 mt-0.5"
        />
        <p
          className="text-[10px] text-base-content/45 leading-relaxed"
          style={PP}
        >
          Cancellations 24+ hrs before: 100% refund. Within 24 hrs: 50% refund.
          Same-day no-show: no refund. Refund processing: 5–12 business days.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — REVIEW & CONFIRM
// ─────────────────────────────────────────────────────────────────────────────

function StepReview({
  form,
  isLoading,
  error,
  transportEstimate,
  followUpCheck,
  caTiers,
  walletBalance,
  paymentState,
  pendingPaymentBooking,
  handleRetryPayment,
  isRetryingPayment,
  labDetail,
}) {
  const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
  const Icon = bt?.icon || Stethoscope;
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];

  const consultResolved = bt?.needsDoctor
    ? resolveConsultFee(form, followUpCheck)
    : { fee: 0, isFree: false, gstRate: 0 };
  const caResolved = bt?.needsCare
    ? resolveCaFee(form, caTiers)
    : { fee: 0, isFree: false };
  const tResolved = resolveTransportFee(transportEstimate);

  const consultFee = consultResolved.fee;
  const caFee = caResolved.fee;
  const transportFee = bt?.needsTransport ? tResolved.fee : 0;
  const diagFee = bt?.isDiag ? form.estimatedDiagFee || 0 : 0;
  const diagGstAmt = bt?.isDiag
    ? +(diagFee * GST_RATES.diagnostics).toFixed(2)
    : 0;

  const homeCollectionFree2 =
    bt?.isDiag && form.bookingType === "diagnostic_home"
      ? resolveHomeCollectionFree(form.subCoverage)
      : false;
  const rawHomeColFee2 = labDetail?.homeCollectionFee ?? 0;
  const homeColFeeToCharge2 =
    form.bookingType === "diagnostic_home"
      ? homeCollectionFree2
        ? 0
        : rawHomeColFee2
      : 0;
  const homeColGstAmt2 = +(
    homeColFeeToCharge2 * GST_RATES.homeCollection
  ).toFixed(2);

  const consultGstRate = consultResolved.gstRate ?? 0;
  const consultGstAmt = bt?.needsDoctor
    ? +(consultFee * consultGstRate).toFixed(2)
    : 0;
  const transportGstAmt = bt?.needsTransport
    ? +(transportFee * GST_RATES.transport).toFixed(2)
    : 0;
  const caGstAmt =
    bt?.needsCare && !caResolved.isFree
      ? +(caFee * GST_RATES.careAssistant).toFixed(2)
      : 0;

  const subtotal =
    consultFee + transportFee + caFee + diagFee + homeColFeeToCharge2;
  const totalGst =
    consultGstAmt + transportGstAmt + caGstAmt + diagGstAmt + homeColGstAmt2;
  const total = +(subtotal + totalGst).toFixed(2);

  const consultTypeLabel =
    CONSULT_TYPES.find((c) => c.value === form.consultationType)?.label ||
    "In-Person";
  const walletAvailable = Math.max(0, walletBalance ?? 0);
  const walletPays =
    form.paymentMethod === "Wallet" && total > 0
      ? Math.min(walletAvailable, total)
      : 0;
  const razorpayPortion =
    form.paymentMethod === "Wallet" ? Math.max(0, total - walletPays) : 0;

  const summaryItems = [
    { l: "Service type", v: bt?.label },
    { l: "Patient name", v: form.patientName },
    {
      l: "Age / Gender",
      v: `${form.patientAge || "—"} yrs · ${form.patientGender || "—"}`,
    },
    { l: "Phone", v: form.patientPhone || "—" },
    { l: "Scheduled at", v: fmtDate(form.scheduledAt) },
    !bt?.isOnline && form.hospitalName
      ? { l: "Hospital", v: form.hospitalName }
      : null,
    form.doctorName || form.doctorId
      ? { l: "Doctor", v: form.doctorName || form.doctorId }
      : null,
    form.consultationType && form.bookingType !== "follow_up" && !bt?.isDiag
      ? { l: "Consult type", v: consultTypeLabel }
      : null,
    (form.bookingType === "care_assistant" ||
      form.bookingType === "full_care_ride") &&
    caTier
      ? {
          l: "Care duration",
          v: `${caTier.label} (${caTier.hours}${caTier.maxHours ? `–${caTier.maxHours}` : "+"}  hrs)`,
        }
      : null,
    form.labName ? { l: "Lab", v: form.labName } : null,
    form.patientLocation?.address
      ? { l: "Pickup", v: form.patientLocation.address }
      : null,
    form.destinationLocation?.address
      ? { l: "Drop-off", v: form.destinationLocation.address }
      : null,
    form.includeReturn || form.includeReturnHome
      ? { l: "Return trip", v: "Yes — included" }
      : null,
    {
      l: "Payment",
      v: getPaymentMethods(form.bookingType).find(
        (p) => p.value === form.paymentMethod,
      )?.label,
    },
    form.couponCode ? { l: "Coupon code", v: form.couponCode } : null,
    form.subCoverage?.consultationFree && form.consultationType !== "homeVisit"
      ? { l: "Sub benefit", v: "Consultation FREE · 0% GST" }
      : null,
    form.subCoverage?.careAssistantFree
      ? { l: "Sub benefit", v: "Care Assistant FREE" }
      : null,
    form.paymentMethod === "Wallet" && walletPays > 0
      ? { l: "Wallet pays", v: fmt(walletPays) }
      : null,
    form.paymentMethod === "Wallet" && razorpayPortion > 0
      ? { l: "Razorpay pays", v: fmt(razorpayPortion) }
      : null,
  ]
    .filter(Boolean)
    .filter((i) => i && i.v);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Review & Confirm
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Double-check everything before confirming.
        </p>
      </div>

      <div
        className="flex items-center gap-2.5 p-3 rounded-2xl"
        style={{ background: bt?.bg || "var(--base-200)" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-base-100"
          style={{ color: bt?.color || "var(--primary)" }}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p
            className="font-black text-sm truncate"
            style={{ color: bt?.color || "var(--primary)", ...PP }}
          >
            {bt?.label}
          </p>
          <p
            className="text-[10px] text-base-content/45 line-clamp-1"
            style={PP}
          >
            {bt?.desc}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-base-300">
        {summaryItems.map((item, i) => (
          <div
            key={(item.l || "") + i}
            className="flex items-start justify-between px-3 py-2 gap-3"
            style={{
              borderBottom:
                i < summaryItems.length - 1
                  ? "1px solid var(--base-300)"
                  : "none",
            }}
          >
            <span
              className="text-[10px] font-black uppercase tracking-widest text-base-content/35 flex-shrink-0 mt-0.5 w-20"
              style={PP}
            >
              {item.l}
            </span>
            <span
              className={`text-xs font-bold text-right break-words min-w-0 flex-1 ${item.l === "Sub benefit" ? "text-success" : item.l === "Wallet pays" ? "text-primary" : item.l === "Razorpay pays" ? "text-secondary" : "text-base-content"}`}
              style={PP}
            >
              {item.v}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5">
        <div className="px-3 py-2 border-b border-primary/15">
          <p
            className="text-[10px] font-black uppercase tracking-widest text-primary"
            style={PP}
          >
            Estimated Charges (incl. GST)
          </p>
        </div>
        <div className="p-3 space-y-1">
          {bt?.needsDoctor && (
            <>
              <FareRow
                label={`Consultation (${consultTypeLabel})`}
                value={consultFee > 0 ? fmt(consultFee) : "FREE"}
                isFree={consultResolved.isFree}
                freeReason={consultResolved.reason}
                gstRate={consultResolved.isFree ? null : consultGstRate}
                note={
                  form.bookingType === "follow_up"
                    ? "Follow-up fee — independent of subscription · 0% GST"
                    : form.consultationType === "homeVisit"
                      ? "Home visit — subscription quota not applicable · 5% GST"
                      : undefined
                }
              />
              {!consultResolved.isFree && consultGstAmt > 0 && (
                <FareRow
                  label={`GST (${(consultGstRate * 100).toFixed(0)}%)`}
                  value={fmt(consultGstAmt)}
                  sub
                />
              )}
            </>
          )}
          {bt?.needsTransport && transportFee > 0 && (
            <>
              <FareRow
                label="Transport"
                value={fmt(transportFee)}
                gstRate={GST_RATES.transport}
                note={
                  transportEstimate
                    ? `${transportEstimate.distanceKm} km · ₹${tResolved.ratePerKm}/km${transportEstimate.kmRateSource === "subscription" ? " (plan)" : " (default)"} · base ₹50`
                    : undefined
                }
              />
              {transportGstAmt > 0 && (
                <FareRow
                  label="GST on Transport (5%)"
                  value={fmt(transportGstAmt)}
                  sub
                />
              )}
            </>
          )}
          {bt?.isDiag && diagFee > 0 && (
            <>
              <FareRow
                label="Diagnostic Tests / Packages"
                value={
                  (form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 ? (
                    <span className="flex items-center gap-1.5 justify-end">
                      <span className="line-through text-[10px] opacity-50 font-medium">
                        {fmt(
                          Math.round(
                            diagFee /
                              (1 -
                                (form.subCoverage?.diagnosticsDiscountPercent ||
                                  0) /
                                  100),
                          ),
                        )}
                      </span>
                      <span>{fmt(diagFee)}</span>
                    </span>
                  ) : (
                    fmt(diagFee)
                  )
                }
                gstRate={GST_RATES.diagnostics}
                note={`${(form.selectedTests?.length || 0) + (form.selectedPackages?.length || 0)} item(s)${(form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 ? ` · ${form.subCoverage?.diagnosticsDiscountPercent || 0}% sub discount applied` : ""}`}
              />
              {diagGstAmt > 0 && (
                <FareRow
                  label="GST on Diagnostics (5%)"
                  value={fmt(diagGstAmt)}
                  sub
                />
              )}
            </>
          )}
          {bt?.isDiag && form.bookingType === "diagnostic_home" && (
            <FareRow
              label="Home Collection Fee"
              value={homeCollectionFree2 ? "WAIVED" : fmt(homeColFeeToCharge2)}
              isFree={homeCollectionFree2}
              freeReason={
                homeCollectionFree2
                  ? form.subCoverage?.homeCollectionUnlimited
                    ? "Unlimited — included in plan"
                    : `${form.subCoverage?.homeCollectionRemaining ?? ""} use(s) remaining`
                  : undefined
              }
              gstRate={
                homeCollectionFree2
                  ? null
                  : homeColFeeToCharge2 > 0
                    ? GST_RATES.homeCollection
                    : null
              }
              note={
                !homeCollectionFree2
                  ? "Lab technician visit charge · 5% GST"
                  : undefined
              }
            />
          )}
          {bt?.needsCare && (
            <>
              <FareRow
                label="Care Assistant"
                value={
                  caResolved.isFree
                    ? "FREE"
                    : caResolved.fee > 0
                      ? fmt(caResolved.fee)
                      : fmt(caTier?.price || 0)
                }
                note={
                  caTier
                    ? `${caTier.label} · ${caTier.hours}${caTier.maxHours ? `–${caTier.maxHours}` : "+"}  hrs`
                    : undefined
                }
                isFree={caResolved.isFree}
                freeReason={caResolved.reason}
                gstRate={caResolved.isFree ? null : GST_RATES.careAssistant}
              />
              {!caResolved.isFree &&
                !caResolved.isCustomPlan &&
                caGstAmt > 0 && (
                  <FareRow label="GST on CA (18%)" value={fmt(caGstAmt)} sub />
                )}
            </>
          )}
          {totalGst > 0 && !caResolved.isCustomPlan && (
            <div className="border-t border-primary/15 pt-1">
              <FareRow
                label="Total GST"
                value={fmt(totalGst)}
                sub
                note="Mixed rates: transport 5%, CA 18%, diagnostics 5%"
              />
            </div>
          )}
          <div className="border-t border-primary/20 pt-1 mt-1">
            <FareRow
              label={
                caResolved.isCustomPlan
                  ? "Partial Estimated Total"
                  : "Total (incl. GST)"
              }
              value={fmt(total)}
              bold
              accent="var(--primary)"
              highlight
              note={
                total === 0
                  ? "Fully covered by subscription"
                  : "* Confirmed at booking — coupons applied then."
              }
            />
          </div>
          {form.paymentMethod === "Wallet" && total > 0 && walletPays > 0 && (
            <div className="border-t border-primary/10 pt-2 mt-1 space-y-1">
              <FareRow
                label="From Wallet"
                value={fmt(walletPays)}
                sub
                accent="var(--primary)"
              />
              {razorpayPortion > 0 && (
                <FareRow
                  label="Via Razorpay"
                  value={fmt(razorpayPortion)}
                  sub
                  accent="var(--secondary)"
                />
              )}
            </div>
          )}
          {form.paymentMethod === "Cash" && total > 0 && (
            <div className="border-t border-warning/20 pt-2 mt-1">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-warning/5 border border-warning/20">
                <div className="flex items-center gap-2">
                  <Coins size={12} className="text-warning flex-shrink-0" />
                  <p className="text-[11px] font-black text-warning" style={PP}>
                    Cash to pay at service
                  </p>
                </div>
                <p className="text-base font-black text-warning" style={PP}>
                  {fmt(total)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {form.paymentMethod === "Razorpay" && total > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <CreditCard size={13} className="text-primary flex-shrink-0 mt-0.5" />
          <p
            className="text-[10px] font-semibold text-primary leading-relaxed"
            style={PP}
          >
            Clicking <strong>Confirm</strong> opens Razorpay. Complete payment
            to finalise booking. Amount includes all GST.
          </p>
        </div>
      )}
      {form.paymentMethod === "Razorpay" &&
        total === 0 &&
        !caResolved.isCustomPlan && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-success/30 bg-success/5">
            <ShieldCheck
              size={13}
              className="text-success flex-shrink-0 mt-0.5"
            />
            <p
              className="text-[10px] font-semibold text-success leading-relaxed"
              style={PP}
            >
              No payment required — fully covered by your subscription. Clicking{" "}
              <strong>Confirm</strong> completes the booking.
            </p>
          </div>
        )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 p-3 rounded-xl border border-error/30 bg-error/5 text-error"
        >
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold" style={PP}>
            {error}
          </p>
        </motion.div>
      )}

      {isLoading && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <Loader2
            size={16}
            className="animate-spin text-primary flex-shrink-0"
          />
          <div>
            <p className="text-xs font-black text-primary" style={PP}>
              Creating your booking…
            </p>
            <p className="text-[10px] text-base-content/40" style={PP}>
              Processing payment and assigning providers
            </p>
          </div>
        </div>
      )}

      {paymentState === "failed" && pendingPaymentBooking && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 p-3 rounded-xl border border-warning/30 bg-warning/5"
        >
          <p className="text-[11px] font-black text-warning" style={PP}>
            Booking saved — payment incomplete
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={isRetryingPayment}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs text-primary-content min-h-[40px] bg-primary hover:opacity-90 transition-opacity disabled:opacity-50"
              style={PP}
            >
              {isRetryingPayment ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Opening…
                </>
              ) : (
                <>
                  <CreditCard size={12} /> Retry Payment
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-1 text-center">
        <p
          className="text-[9px] text-base-content/30 leading-relaxed"
          style={PP}
        >
          By confirming, you agree to Likeson.in{" "}
          <a
            href="/terms"
            className="underline hover:text-primary transition-colors"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/cancellation-policy"
            className="underline hover:text-primary transition-colors"
          >
            Cancellation Policy
          </a>
          .
        </p>
        <p
          className="text-[9px] text-base-content/25 leading-relaxed"
          style={PP}
        >
          Likeson Healthcare Pvt. Ltd. · Vijayawada, Andhra Pradesh · CIN:
          U85100AP2024PTC001 ·{" "}
          <a
            href="mailto:support@likeson.in"
            className="underline hover:text-primary transition-colors"
          >
            support@likeson.in
          </a>{" "}
          ·{" "}
          <a
            href="tel:+918008000000"
            className="underline hover:text-primary transition-colors"
          >
            +91 80080 00000
          </a>
        </p>
        <p className="text-[9px] text-base-content/20" style={PP}>
          Payments secured by Razorpay · Data protected under IT Act 2000 · GST
          compliant
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function BookingSuccess({ data, onReset, router }) {
  const bookingId = data?.bookingId || data?._id;
  const bookingCode = data?.bookingCode;
  const opNumber = data?.opNumber;
  const caAssigned = data?.careAssistantAssigned;
  const totalCharged = data?.fareBreakdown?.totalAmount;
  const walletApplied = data?.fareBreakdown?.walletApplied || 0;
  const razorpayPortion = data?.walletSplit?.razorpayPortion || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center py-8 space-y-5 px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 220, delay: 0.1 }}
        className="w-16 h-16 rounded-3xl flex items-center justify-center bg-success/12"
      >
        <CheckCircle2 size={32} className="text-success" />
      </motion.div>
      <div>
        <h2
          className="text-lg font-black tracking-tight mb-1 text-success"
          style={PP}
        >
          Booking Confirmed!
        </h2>
        <p
          className="text-xs text-base-content/50 max-w-xs mx-auto leading-relaxed"
          style={PP}
        >
          Your booking is placed. Confirmation SMS and email arriving shortly.
        </p>
      </div>
      <div className="w-full max-w-xs rounded-2xl border border-success/30">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-success/20 bg-success/5">
          <span
            className="text-[10px] font-black uppercase tracking-widest text-success"
            style={PP}
          >
            Booking Reference
          </span>
          <span className="font-black text-xs text-success" style={PP}>
            {bookingCode ? `#${bookingCode}` : "—"}
          </span>
        </div>
        <div className="p-3 space-y-2 text-xs bg-base-100">
          {opNumber && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                OP Number
              </span>
              <span className="font-black" style={PP}>
                {opNumber}
              </span>
            </div>
          )}
          {caAssigned?.name && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                Care Assistant
              </span>
              <span className="font-black" style={PP}>
                {caAssigned.name}
              </span>
            </div>
          )}
          {walletApplied > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                Wallet paid
              </span>
              <span className="font-black text-primary" style={PP}>
                {fmt(walletApplied)}
              </span>
            </div>
          )}
          {razorpayPortion > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                Razorpay paid
              </span>
              <span className="font-black text-primary" style={PP}>
                {fmt(razorpayPortion)}
              </span>
            </div>
          )}
          {totalCharged != null && (
            <div className="flex justify-between border-t border-base-300 pt-2 mt-1 gap-2">
              <span className="font-black" style={PP}>
                Total Charged (incl. GST)
              </span>
              <span className="font-black text-primary" style={PP}>
                {totalCharged === 0 ? "FREE (subscription)" : fmt(totalCharged)}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-base-300 bg-base-200/50 w-full max-w-xs">
        <img
          src="https://ik.imagekit.io/4wja0s7p9/%20favicon.ico"
          alt="Likeson"
          className="w-5 h-5 rounded object-contain flex-shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="min-w-0">
          <p
            className="text-[10px] font-black text-base-content/60 truncate"
            style={PP}
          >
            Likeson Healthcare · Vijayawada
          </p>
          <p className="text-[9px] text-base-content/35" style={PP}>
            support@likeson.in · +91 80080 00000
          </p>
        </div>
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        {bookingId && (
          <button
            onClick={() => router.push(`/my-bookings/${bookingId}`)}
            className="flex-1 py-3 rounded-xl font-black text-xs text-primary-content bg-primary hover:opacity-90 transition-opacity min-h-[44px]"
            style={PP}
          >
            View Booking
          </button>
        )}
        <button
          onClick={onReset}
          className={`${bookingId ? "flex-1" : "w-full"} py-3 rounded-xl font-black text-xs border-2 border-base-300 hover:border-primary hover:text-primary transition-colors min-h-[44px]`}
          style={PP}
        >
          New Booking
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL FORM STATE
// ─────────────────────────────────────────────────────────────────────────────

const INIT = {
  bookingType: "",
  hospSearch: "",
  doctorSearch: "",
  hospitalId: "",
  hospitalName: "",
  hospitalAddress: null,
  hospitalCoords: null,
  doctorId: "",
  doctorName: "",
  doctorSpec: "",
  doctorFees: null,
  consultationType: "inPerson",
  slotId: "",
  labCity: "",
  labId: "",
  labName: "",
  selectedTests: [], // array of test slugs (not _ids)
  selectedPackages: [], // array of package slugs (not _ids)
  reportDeliveryMode: "Digital (App)",
  patientIsSelf: true,
  patientName: "",
  patientAge: "",
  patientGender: "",
  patientPhone: "",
  patientBloodGroup: "",
  patientWeight: "",
  emergencyContact: "",
  patientLocation: null,
  destinationLocation: null,
  includeReturn: false,
  includeReturnHome: false,
  waitingMinutes: 0,
  durationHours: null,
  scheduledAt: "",
  customerNotes: "",
  paymentMethod: "Razorpay",
  couponCode: "",
  subCoverage: null,
  estimatedDiagFee: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BookingSystem() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const subBenefitLabs = useSelector(selectSubBenefitLabs);
  const { isLoaded } = useGoogleMaps();

  const hospitals = useSelector(selectHospitals);
  const hospitalsLoading = useSelector(selectHospitalsLoading);
  const doctorsByHospital = useSelector(selectDoctorsByHospital);
  const doctorsLoading = useSelector(selectDoctorsByHospitalLoading);
  const hospitalAvail = useSelector(selectHospitalAvailability);
  const hospitalAvailLoading = useSelector(selectHospitalAvailLoading);
  const doctorAvail = useSelector(selectDoctorAvailability);
  const doctorAvailLoading = useSelector(selectDoctorAvailLoading);
  const labs = useSelector(selectLabs);
  const labsLoading = useSelector(selectLabsLoading);
  const labDetail = useSelector(selectLabDetail);
  const labDetailLoading = useSelector(selectLabDetailLoading);
  const transportEstimate = useSelector(selectTransportEstimate);
  const transportLoading = useSelector(selectTransportEstimLoading);
  const followUpCheck = useSelector(selectFollowUpCheck);
  const followUpCheckLoading = useSelector(selectFollowUpCheckLoading);
  const createData = useSelector(selectCreateBookingData);
  const createLoading = useSelector(selectCreateBookingLoading);
  const createError = useSelector(selectCreateBookingError);
  const createStatus = useSelector(selectCreateBookingStatus);
  const platformPricing = useSelector(selectPlatformPricing);
  const platformPricingLoading = useSelector(selectPlatformPricingLoading);
  const consultationCoverage = useSelector(selectConsultationCoverage);
  const subBenefitConsultations = useSelector(selectSubBenefitConsultations);
  const subBenefitCareAssistant = useSelector(selectSubBenefitCareAssistant);
  const allDoctors = useSelector(selectAllDoctors);
  const allDoctorsLoading = useSelector(selectAllDoctorsLoading);
  const walletData = useSelector(selectWalletData);
  const walletBalance = useSelector(selectWalletBalance);

  const stepContentRef = useRef(null);
  const [currentStepId, setCurrentStepId] = useState("service");
  const [direction, setDirection] = useState(1);
  const [visitedIds, setVisitedIds] = useState(["service"]);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [paymentState, setPaymentState] = useState("idle");
  const [paymentError, setPaymentError] = useState(null);
  const [caTiers, setCaTiers] = useState([]);
  const [caTiersLoading, setCaTiersLoading] = useState(true);
  const [pendingPaymentBooking, setPendingPaymentBooking] = useState(null);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);

  // Ref to track estimatedDiagFee — prevents infinite setState loop
  const prevDiagFeeRef = useRef(0);

  useEffect(() => {
    dispatch(fetchWalletDetails());
  }, [dispatch]);

  const set = useCallback((key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }, []);

  const steps = getSteps(form.bookingType);
  const stepIds = steps.map((s) => s.id);
  const curIdx = stepIds.indexOf(currentStepId);
  const isLast = currentStepId === stepIds[stepIds.length - 1];

  const scrollToTop = useCallback(() => {
    if (stepContentRef.current)
      stepContentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    dispatch(fetchPlatformPricing());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchSubscriptionBenefitConsultations());
    dispatch(fetchSubscriptionBenefitCareAssistant());
    dispatch(fetchSubscriptionBenefitLabs());
    dispatch(
      checkConsultationCoverage({
        consultationType: form.consultationType || "inPerson",
      }),
    );
  }, [dispatch]);

  useEffect(() => {
    if (!form.consultationType) return;
    dispatch(
      checkConsultationCoverage({ consultationType: form.consultationType }),
    );
  }, [dispatch, form.consultationType]);

  const onSelectBookingType = useCallback(
    (btValue) => {
      if (form.bookingType === btValue) return;
      setForm((p) => ({
        ...INIT,
        patientIsSelf: p.patientIsSelf,
        patientName: p.patientName,
        patientAge: p.patientAge,
        patientGender: p.patientGender,
        patientPhone: p.patientPhone,
        patientBloodGroup: p.patientBloodGroup,
        patientWeight: p.patientWeight,
        emergencyContact: p.emergencyContact,
        subCoverage: p.subCoverage,
        // Reset paymentMethod to Razorpay when switching to doctor_online (Cash not allowed)
        paymentMethod:
          btValue === "doctor_online"
            ? "Razorpay"
            : p.paymentMethod || "Razorpay",
        bookingType: btValue,
        durationHours: null,
        estimatedDiagFee: 0,
      }));
      setErrors({});
      prevDiagFeeRef.current = 0;
      dispatch(resetHospitals());
      dispatch(resetDoctorsByHospital());
      dispatch(resetHospitalAvailability());
      dispatch(resetDoctorAvailability());
      dispatch(resetTransportEstimate());
      dispatch(resetFollowUpCheck());
    },
    [form.bookingType, dispatch],
  );

  // Sync subscription coverage into form.subCoverage
  useEffect(() => {
    if (
      !consultationCoverage &&
      !subBenefitConsultations &&
      !subBenefitCareAssistant &&
      !subBenefitLabs
    )
      return;

    setForm((p) => {
      const consult = subBenefitConsultations?.consultations ?? null;
      const care = subBenefitCareAssistant?.careAssistant ?? null;
      const coverage = consultationCoverage ?? {};

      const consultationsRemaining = consult?.unlimited
        ? null
        : (consult?.remaining ?? coverage.remaining ?? 0);
      const consultationFree = !!(
        coverage.isFree === true || coverage.consultationFree === true
      );

      const caRemaining = care?.unlimited
        ? null
        : (care?.remaining ?? coverage.careAssistantRemaining ?? 0);
      const caIncluded = subBenefitCareAssistant?.included ?? false;
      const isCustomPlan =
        subBenefitConsultations?.planType === "custom" ||
        subBenefitCareAssistant?.planType === "custom" ||
        coverage.isCustomPlan ||
        false;
      const activeTier = care?.activeTier ?? null;
      const careAssistantFree =
        caIncluded &&
        !isCustomPlan &&
        !care?.isDedicated &&
        (caRemaining === null || caRemaining > 0);

      const labsBenefit = subBenefitLabs ?? null;
      const diagDiscount =
        labsBenefit?.labs?.discountPercent ??
        coverage.diagnosticsDiscountPercent ??
        0;
      const homeColIncluded =
        labsBenefit?.homeCollection?.included ??
        coverage.homeSampleCollectionFree ??
        false;
      const homeColUsed = labsBenefit?.homeCollection?.homeVisitsUsed ?? 0;
      // homeCollectionRemaining from /subscription-benefits/labs route
      // null = unlimited, 0 = exhausted, >0 = remaining
      const homeColRemaining =
        labsBenefit?.homeCollection?.homeVisitsRemaining ?? null;
      const homeColUnlimited =
        labsBenefit?.homeCollection?.homeVisitUnlimited ?? false;
      const homeColLimit = labsBenefit?.homeCollection?.homeVisitLimit ?? null;

      const homeCollectionAvailable =
        labsBenefit?.homeCollection?.homeCollectionAvailable ?? null;
      const homeCollectionUsedOnce =
        labsBenefit?.homeCollection?.homeCollectionUsedOnce ?? false;
      // homeSampleCollectionFree kept as fallback for older API responses
      const homeSampleCollectionFree =
        homeCollectionAvailable != null
          ? homeCollectionAvailable === true
          : homeColIncluded && !homeCollectionUsedOnce;

      return {
        ...p,
        subCoverage: {
          ...(p.subCoverage || {}),
          isFree: consultationFree,
          allowed: coverage.allowed ?? false,
          remaining: consultationsRemaining,
          reason: coverage.reason ?? null,
          consultationFree,
          consultationQuota: coverage.reason ?? null,
          careAssistantFree,
          careAssistantAllowed:
            caIncluded &&
            (care?.unlimited || (caRemaining !== null && caRemaining > 0)),
          careAssistantRemaining: caRemaining,
          careAssistantQuota: coverage.careAssistantQuota ?? null,
          careAssistantCustomFee: isCustomPlan
            ? (activeTier?.chargeToUser ??
              coverage.careAssistantCustomFee ??
              null)
            : null,
          careAssistantTierIndex: activeTier?.tierIndex ?? null,
          careAssistantActiveTier: activeTier,
          careAssistantAllTiers:
            subBenefitCareAssistant?.careAssistant?.allTiers ?? null,
          isCustomPlan,
          diagnosticsDiscountPercent: diagDiscount,
          // homeSampleCollectionFree: true = this period's free use still available
          homeSampleCollectionFree,
          homeCollectionAvailable:
            homeCollectionAvailable ?? homeSampleCollectionFree,
          homeCollectionUsedOnce,
          homeCollectionUsed: homeColUsed,
          homeCollectionRemaining: homeColRemaining,
          homeCollectionUnlimited: false, // always one-time — never unlimited
          homeCollectionLimit: homeColLimit,
          homeCollectionIncluded: homeColIncluded,
          labsMessage: labsBenefit?.labs?.message ?? null,
          homeCollectionMessage: labsBenefit?.homeCollection?.message ?? null,
          // fixedTier / planType used for video-gate logic in resolveConsultFee
          fixedTier:
            subBenefitConsultations?.fixedTier ??
            subBenefitCareAssistant?.fixedTier ??
            null,
          planType:
            subBenefitConsultations?.planType ??
            subBenefitCareAssistant?.planType ??
            "fixed",
          kmRateSource: p.subCoverage?.kmRateSource ?? null,
          ratePerKm: p.subCoverage?.ratePerKm ?? null,
        },
      };
    });
  }, [
    consultationCoverage,
    subBenefitConsultations,
    subBenefitCareAssistant,
    subBenefitLabs,
  ]);

  // Sync care assistant tiers from platform pricing
  useEffect(() => {
    setCaTiersLoading(platformPricingLoading);
    if (!platformPricing) return;
    const tiers = Array.isArray(platformPricing) ? platformPricing : null;
    if (tiers?.length) {
      const mapped = tiers
        .filter((t) => t.isActive !== false)
        .sort(
          (a, b) => (a.minHours ?? a.hours ?? 0) - (b.minHours ?? b.hours ?? 0),
        )
        .map((t) => ({
          hours: t.minHours ?? t.hours,
          maxHours: t.maxHours ?? null,
          label: t.label || `${t.minHours ?? t.hours} hrs`,
          price: t.chargeToUser ?? t.price ?? 0,
        }))
        .filter((t) => t.hours != null && t.price != null);
      if (mapped.length) {
        setCaTiers(mapped);
        setForm((p) => ({
          ...p,
          durationHours: p.durationHours || mapped[0].hours,
        }));
      }
    }
    if (!platformPricingLoading) setCaTiersLoading(false);
  }, [platformPricing, platformPricingLoading]);

  // Sync km rate from transport estimate into subCoverage
  useEffect(() => {
    if (!transportEstimate) return;
    setForm((p) => ({
      ...p,
      subCoverage: {
        ...(p.subCoverage || {}),
        kmRateSource: transportEstimate.kmRateSource,
        ratePerKm: transportEstimate.ratePerKm,
      },
    }));
  }, [transportEstimate]);

  // estimatedDiagFee calculation
  // CRITICAL: uses test/package SLUG (not _id) to match — backend looks up by slug
  // Uses ref to avoid infinite setState loop — only updates when value changes
  useEffect(() => {
    const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
    if (!bt?.isDiag || !labDetail) {
      if (prevDiagFeeRef.current !== 0) {
        prevDiagFeeRef.current = 0;
        setForm((p) => ({ ...p, estimatedDiagFee: 0 }));
      }
      return;
    }
    const hasSelections =
      (form.selectedTests?.length ?? 0) > 0 ||
      (form.selectedPackages?.length ?? 0) > 0;
    if (!hasSelections) {
      if (prevDiagFeeRef.current !== 0) {
        prevDiagFeeRef.current = 0;
        setForm((p) => ({ ...p, estimatedDiagFee: 0 }));
      }
      return;
    }
    const discPct = form.subCoverage?.diagnosticsDiscountPercent || 0;
    let total = 0;
    for (const testSlug of form.selectedTests || []) {
      if (!testSlug) continue;
      // Match by slug — same as backend: lab.labTests.find(lt => lt.slug === slug)
      const t = labDetail.labTests?.find((lt) => lt.slug === testSlug);
      if (t) {
        const base = t.discountedPrice ?? t.mrpPrice ?? 0;
        total += discPct > 0 ? +(base * (1 - discPct / 100)) : base;
      }
    }
    for (const pkgSlug of form.selectedPackages || []) {
      if (!pkgSlug) continue;
      // Match by slug — same as backend: lab.labPackages.find(lp => lp.slug === slug)
      const pkg = labDetail.labPackages?.find((lp) => lp.slug === pkgSlug);
      if (pkg) {
        const base = pkg.mrpPrice ?? 0;
        total += discPct > 0 ? +(base * (1 - discPct / 100)) : base;
      }
    }
    const computed = +total.toFixed(2);
    if (computed !== prevDiagFeeRef.current) {
      prevDiagFeeRef.current = computed;
      setForm((p) => ({ ...p, estimatedDiagFee: computed }));
    }
  }, [
    form.bookingType,
    JSON.stringify(form.selectedTests),
    JSON.stringify(form.selectedPackages),
    form.subCoverage?.diagnosticsDiscountPercent,
    labDetail,
  ]);

  // Reset step if booking type changes and current step is invalid
  useEffect(() => {
    if (!form.bookingType) return;
    const newStepIds = getSteps(form.bookingType).map((s) => s.id);
    if (!newStepIds.includes(currentStepId)) {
      setCurrentStepId("service");
      setVisitedIds(["service"]);
    }
  }, [form.bookingType]);

  // Force video consultation type for doctor_online
  useEffect(() => {
    if (form.bookingType === "doctor_online")
      setForm((p) => ({ ...p, consultationType: "video" }));
    else if (
      form.bookingType === "physiotherapist" &&
      form.consultationType === "video"
    )
      setForm((p) => ({ ...p, consultationType: "inPerson" }));
  }, [form.bookingType, form.consultationType]);

  // Handle URL query params for pre-filling
  useEffect(() => {
    const doctorId = searchParams.get("doctor"),
      hospitalId = searchParams.get("hospital"),
      labId = searchParams.get("lab"),
      type = searchParams.get("type"),
      name = searchParams.get("name"),
      spec = searchParams.get("spec");
    if (doctorId || hospitalId || labId || type) {
      setForm((p) => ({
        ...p,
        ...(doctorId && {
          doctorId,
          doctorName: name || "",
          doctorSpec: spec || "",
        }),
        ...(hospitalId && { hospitalId }),
        ...(labId && { labId }),
        ...(type && { bookingType: type }),
      }));
      if (type && doctorId) {
        setCurrentStepId("patient");
        setVisitedIds(["service", "provider", "patient"]);
      } else if (type || doctorId || hospitalId || labId) {
        setCurrentStepId("provider");
        setVisitedIds(["service", "provider"]);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const hospitalId = searchParams.get("hospital");
    if (!hospitalId) return;
    dispatch(fetchHospitals({ city: "" }));
    dispatch(fetchHospitalDoctors({ hospitalId }));
  }, [searchParams, dispatch]);

  useEffect(() => {
    const labId = searchParams.get("lab");
    if (!labId) return;
    dispatch(fetchLabById({ labId })).then((res) => {
      const lab = res?.payload?.data || res?.payload;
      if (lab?.labName) setForm((p) => ({ ...p, labName: lab.labName }));
    });
  }, [searchParams, dispatch]);

  useEffect(
    () => () => {
      dispatch(resetCreateBooking());
    },
    [dispatch],
  );

  // On booking success — refresh subscription benefits
  useEffect(() => {
    if (createStatus === "succeeded" && createData) {
      if (createData.subscriptionCoverage) {
        const sc = createData.subscriptionCoverage;
        setForm((p) => ({
          ...p,
          subCoverage: {
            ...(p.subCoverage || {}),
            consultationFree: sc.consultationFree ?? false,
            careAssistantAllTiers: sc.careAssistantAllTiers ?? null,
            consultationQuota: sc.consultationQuota || sc.quotaInfo || null,
            careAssistantFree: sc.careAssistantFree ?? false,
            careAssistantQuota:
              sc.careAssistantQuota ||
              (sc.visitsRemaining != null
                ? `${sc.visitsRemaining} visits remaining`
                : null),
          },
        }));
      }
      dispatch(
        checkConsultationCoverage({
          consultationType: form.consultationType || "inPerson",
        }),
      );
      dispatch(fetchSubscriptionBenefitConsultations());
      dispatch(fetchSubscriptionBenefitCareAssistant());
      dispatch(fetchSubscriptionBenefitLabs());
      setSuccess(true);
    }
  }, [createStatus, createData, dispatch, form.consultationType]);

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  const onLoadHospitals = useCallback(
    (city) => dispatch(fetchHospitals({ city })),
    [dispatch],
  );
  const onLoadDoctors = useCallback(
    (hospitalId) => dispatch(fetchHospitalDoctors({ hospitalId })),
    [dispatch],
  );
  const onLoadAllDoctors = useCallback(
    (params) => dispatch(fetchAllDoctors(params || {})),
    [dispatch],
  );
  const onLoadLabs = useCallback(
    (city) =>
      dispatch(
        fetchLabs({
          city: city || "",
          homeCollection: form.bookingType === "diagnostic_home",
        }),
      ),
    [dispatch, form.bookingType],
  );

  const onLoadLabDetail = useCallback(
    async (labId) => {
      const result = await dispatch(fetchLabById({ labId }));
      const lab = result?.payload?.data || result?.payload;
      if (lab?.labName) set("labName", lab.labName);
    },
    [dispatch, set],
  );

const onCheckHospAvail = useCallback(() => {
    if (form.hospitalId && form.scheduledAt)
      dispatch(
        checkHospitalAvailability({
          hospitalId: form.hospitalId,
          scheduledAt: toISOSafe(form.scheduledAt), // <-- UPDATED
        }),
      );
  }, [dispatch, form.hospitalId, form.scheduledAt]);

  const onCheckDocAvail = useCallback(() => {
    if (form.doctorId && form.scheduledAt)
      dispatch(
        checkDoctorAvailability({
          doctorId: form.doctorId,
          scheduledAt: toISOSafe(form.scheduledAt), // <-- UPDATED
          hospitalId: form.hospitalId,
        }),
      );
  }, [dispatch, form.doctorId, form.scheduledAt, form.hospitalId]);

  const onCheckFollowUp = useCallback(
    (doctorId, hospitalId) => {
      if (doctorId)
        dispatch(checkFollowUpEligibility({ doctorId, hospitalId }));
    },
    [dispatch],
  );

  const onResetHospAvail = useCallback(
    () => dispatch(resetHospitalAvailability()),
    [dispatch],
  );
  const onResetDocAvail = useCallback(
    () => dispatch(resetDoctorAvailability()),
    [dispatch],
  );

  const onEstimateTransport = useCallback(() => {
    const pickup = form.patientLocation?.coordinates;
    const dropoff = form.destinationLocation?.coordinates;
    if (!pickup) return;
    if (form.bookingType === "patient_transport" && !dropoff) return;
    if (form.bookingType === "full_care_ride" && !dropoff) return;
    const params = {
      pickupLng: pickup[0],
      pickupLat: pickup[1],
      bookingType: form.bookingType || "patient_transport",
    };
    if (dropoff) {
      params.dropoffLng = dropoff[0];
      params.dropoffLat = dropoff[1];
    }
    if (form.includeReturn || form.includeReturnHome)
      params.includeReturn = true;
    if (form.waitingMinutes) params.waitingMinutes = form.waitingMinutes;
    dispatch(fetchTransportEstimate(params));
  }, [
    dispatch,
    form.patientLocation?.coordinates?.[0],
    form.patientLocation?.coordinates?.[1],
    form.destinationLocation?.coordinates?.[0],
    form.destinationLocation?.coordinates?.[1],
    form.includeReturn,
    form.includeReturnHome,
    form.waitingMinutes,
    form.bookingType,
  ]);

  // ─── PAYLOAD BUILDERS ─────────────────────────────────────────────────────

  const mkLoc = (loc) =>
    loc
      ? {
          coordinates: loc.coordinates,
          address: loc.address,
          city: loc.city,
          pincode: loc.pincode,
        }
      : undefined;
  const mkPatient = () => ({
    name: form.patientName,
    age: form.patientAge || undefined,
    gender: form.patientGender || undefined,
    phone: form.patientPhone || undefined,
    bloodGroup: form.patientBloodGroup || undefined,
    weight: form.patientWeight || undefined,
  });

  

 const mkCommon = () => ({
      patientInfo: mkPatient(),
      scheduledAt: toISOSafe(form.scheduledAt), // Uses the new global helper
      paymentMethod: form.paymentMethod,
      couponCode: form.couponCode || undefined,
      slotId: form.slotId || undefined,
      documents: [],
    });

  // ─── VALIDATION ───────────────────────────────────────────────────────────

  const validate = useCallback(
    (sid) => {
      const e = {};
      if (sid === "service" && !form.bookingType)
        e.bookingType = "Select a service type to continue";
      if (sid === "provider") {
        const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
        if (bt?.isDiag && !form.labId) e.labId = "Select a lab";
        if (
          bt?.isDiag &&
          !form.selectedTests?.length &&
          !form.selectedPackages?.length
        )
          e.selectedTests = "Select at least one test or package";
        if (bt?.needsDoctor && !form.doctorId)
          e.doctorId = "Select a doctor to continue";
        if (
          form.bookingType === "follow_up" &&
          followUpCheck &&
          !followUpCheck.isEligible
        )
          e.doctorId = followUpCheck.reason || "Not eligible for follow-up";
      }
      if (sid === "patient") {
        if (!form.patientName?.trim())
          e.patientName = "Patient full name is required";
        if (!form.patientPhone?.trim())
          e.patientPhone = "Mobile number required for confirmation SMS";
      }
      if (sid === "schedule") {
        const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
        if (!form.scheduledAt)
          e.scheduledAt = "Select appointment date and time";
        if (
          (bt?.needsTransport || form.bookingType === "full_care_ride") &&
          !form.patientLocation?.coordinates
        )
          e.patientLocation = "Set your pickup address on the map";
        if (
          form.bookingType === "patient_transport" &&
          !form.destinationLocation?.coordinates
        )
          e.destinationLocation = "Set the drop-off destination on the map";
        if (
          form.bookingType === "full_care_ride" &&
          !form.destinationLocation?.coordinates
        )
          e.destinationLocation =
            "Set the hospital/drop-off address on the map";
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    },
    [form, followUpCheck],
  );

  // ─── SUBMIT ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const common = mkCommon();
    const map = {
      full_care_ride: () =>
        dispatch(
          createFullCareRide({
            ...common,
            hospitalId: form.hospitalId,
            doctorId: form.doctorId,
            consultationType: form.consultationType,
            patientLocation: mkLoc(form.patientLocation),
            destinationLocation: mkLoc(form.destinationLocation),
            includeReturnHome: form.includeReturnHome,
            durationHours: form.durationHours,
          }),
        ),
      doctor_consultation: () =>
        dispatch(
          createDoctorConsultation({
            ...common,
            hospitalId: form.hospitalId || undefined,
            doctorId: form.doctorId,
            consultationType: form.consultationType,
          }),
        ),
      doctor_online: () =>
        dispatch(createDoctorOnline({ ...common, doctorId: form.doctorId })),
      physiotherapist: () =>
        dispatch(
          createPhysiotherapist({
            ...common,
            doctorId: form.doctorId,
            visitType: form.consultationType,
          }),
        ),
      care_assistant: () =>
        dispatch(
          createCareAssistant({
            ...common,
            patientLocation: mkLoc(form.patientLocation),
            durationHours: form.durationHours,
          }),
        ),
      diagnostic_center: () =>
        dispatch(
          createDiagnosticCenter({
            ...common,
            labId: form.labId,
            // Send slugs — backend looks up by slug in lab.labTests/labPackages
            tests: (form.selectedTests || []).filter(Boolean),
            packages: (form.selectedPackages || []).filter(Boolean),
            reportDeliveryMode: form.reportDeliveryMode,
          }),
        ),
      diagnostic_home: () =>
        dispatch(
          createDiagnosticHome({
            ...common,
            labId: form.labId,
            // Send slugs — backend looks up by slug
            tests: (form.selectedTests || []).filter(Boolean),
            packages: (form.selectedPackages || []).filter(Boolean),
            patientLocation: mkLoc(form.patientLocation),
            reportDeliveryMode: form.reportDeliveryMode,
          }),
        ),
      patient_transport: () =>
        dispatch(
          createPatientTransport({
            ...common,
            patientLocation: mkLoc(form.patientLocation),
            destinationLocation: mkLoc(form.destinationLocation),
            includeReturn: form.includeReturn,
            waitingMinutes: form.waitingMinutes,
            vehicleClass: "four_wheeler",
            addConsultation: false,
          }),
        ),
      follow_up: () =>
        dispatch(
          createFollowUp({
            ...common,
            doctorId: form.doctorId,
            hospitalId: form.hospitalId || undefined,
          }),
        ),
    };

    const action = map[form.bookingType];
    if (!action) return;

    const actionResult = await action();
    const bookingData = actionResult?.payload;
    if (!bookingData || actionResult?.error) return;

    const targetBookingId = bookingData.bookingId || bookingData._id;
    const razorpayOrder = bookingData.razorpayOrder;
    const walletSplit = bookingData.walletSplit;
    const fareBreakdown = bookingData.fareBreakdown;
    const totalAmount = fareBreakdown?.totalAmount ?? 0;

    const refreshAfterSuccess = () => {
      dispatch(
        checkConsultationCoverage({
          consultationType: form.consultationType || "inPerson",
        }),
      );
      dispatch(fetchSubscriptionBenefitConsultations());
      dispatch(fetchSubscriptionBenefitCareAssistant());
      dispatch(fetchSubscriptionBenefitLabs());
    };

    if (form.paymentMethod === "Razorpay") {
      if (!razorpayOrder && totalAmount > 0) {
        setPaymentState("idle");
        setPaymentError(
          "Payment gateway unavailable. Booking was not created. Please try again or choose Wallet / Cash.",
        );
        if (targetBookingId) {
          try {
            await dispatch(
              deleteFailedBooking({
                bookingId: targetBookingId,
                walletApplied: 0,
              }),
            );
          } catch {}
        }
        return;
      }
      if (razorpayOrder && totalAmount > 0) {
        setPaymentState("opening");
        setPaymentError(null);
        setPendingPaymentBooking({
          bookingData,
          razorpayOrder,
          targetBookingId,
        });
        await openRazorpay({
          order: razorpayOrder,
          bookingId: targetBookingId,
          dispatch,
          description: `${form.bookingType?.replace(/_/g, " ")} booking`,
          prefill: {
            name: form.patientName || "",
            contact: form.patientPhone
              ? `+91${form.patientPhone.replace(/\D/g, "").slice(-10)}`
              : "",
          },
          onSuccess: () => {
            setPaymentState("done");
            setPendingPaymentBooking(null);
            toast.success("Payment verified! Booking confirmed.");
            refreshAfterSuccess();
            setSuccess(true);
          },
          onFailure: async (msg) => {
            setPaymentState("failed");
            setIsRetryingPayment(false);
            setPendingPaymentBooking(null);
            if (targetBookingId) {
              try {
                await dispatch(
                  deleteFailedBooking({
                    bookingId: targetBookingId,
                    walletApplied: 0,
                  }),
                );
              } catch (e) {
                console.error(e);
              }
            }
            setPaymentError(
              `Payment ${msg || "cancelled"}. Booking deleted — no charge made. Please book again.`,
            );
          },
        });
        return;
      }
      setPendingPaymentBooking(null);
      refreshAfterSuccess();
      setSuccess(true);
      return;
    }

    if (form.paymentMethod === "Wallet") {
      if (walletSplit?.needsRazorpay && razorpayOrder) {
        const walletApplied = walletSplit.walletApplied || 0;
        const razorpayPortion = walletSplit.razorpayPortion || 0;
        setPaymentState("opening");
        setPaymentError(null);
        setPendingPaymentBooking({
          bookingData,
          razorpayOrder,
          targetBookingId,
          isWalletSplit: true,
          walletSplit,
        });
        await openRazorpay({
          order: razorpayOrder,
          bookingId: targetBookingId,
          dispatch,
          description: `${form.bookingType?.replace(/_/g, " ")} booking (₹${razorpayPortion} remaining after wallet)`,
          prefill: {
            name: form.patientName || "",
            contact: form.patientPhone
              ? `+91${form.patientPhone.replace(/\D/g, "").slice(-10)}`
              : "",
          },
          onSuccess: () => {
            setPaymentState("done");
            setPendingPaymentBooking(null);
            refreshAfterSuccess();
            dispatch(fetchWalletDetails());
            setSuccess(true);
          },
          onFailure: async (msg) => {
            setPaymentState("failed");
            setIsRetryingPayment(false);
            setPendingPaymentBooking(null);
            if (targetBookingId) {
              try {
                await dispatch(
                  deleteFailedBooking({
                    bookingId: targetBookingId,
                    walletApplied,
                  }),
                );
              } catch (e) {
                console.error(e);
              }
            }
            dispatch(fetchWalletDetails());
            setPaymentError(
              walletApplied > 0
                ? `Payment ${msg || "failed"}. ₹${walletApplied.toLocaleString("en-IN")} wallet amount automatically refunded. Booking deleted. Please book again.`
                : `Payment ${msg || "failed"}. Booking deleted — no charge made. Please book again.`,
            );
          },
        });
        return;
      }
      setPendingPaymentBooking(null);
      refreshAfterSuccess();
      dispatch(fetchWalletDetails());
      setSuccess(true);
      return;
    }

    if (form.paymentMethod === "Cash") {
      setPendingPaymentBooking(null);
      refreshAfterSuccess();
      setSuccess(true);
      return;
    }
    setSuccess(true);
  }, [dispatch, form]);

  const handleRetryPayment = useCallback(async () => {
    if (!pendingPaymentBooking) return;
    const { razorpayOrder, targetBookingId, walletSplit } =
      pendingPaymentBooking;
    setIsRetryingPayment(true);
    setPaymentError(null);
    setPaymentState("opening");
    await openRazorpay({
      order: razorpayOrder,
      bookingId: targetBookingId,
      dispatch,
      description: `${form.bookingType?.replace(/_/g, " ")} booking`,
      prefill: {
        name: form.patientName || "",
        contact: form.patientPhone || "",
      },
      onSuccess: () => {
        setPaymentState("done");
        setPendingPaymentBooking(null);
        setIsRetryingPayment(false);
        dispatch(
          checkConsultationCoverage({
            consultationType: form.consultationType || "inPerson",
          }),
        );
        setSuccess(true);
      },
      onFailure: async (msg) => {
        setPaymentState("failed");
        setIsRetryingPayment(false);
        setPendingPaymentBooking(null);
        const walletApplied = walletSplit?.walletApplied || 0;
        if (targetBookingId) {
          try {
            await dispatch(
              deleteFailedBooking({
                bookingId: targetBookingId,
                walletApplied,
              }),
            );
          } catch (e) {
            console.error(e);
          }
        }
        setPaymentError(
          walletApplied > 0
            ? `Payment ${msg || "failed"}. ₹${walletApplied} wallet refunded. Booking deleted. Please book again.`
            : `Payment ${msg || "failed"}. Booking deleted — no charge. Please book again.`,
        );
      },
    });
  }, [pendingPaymentBooking, dispatch, form]);

  // ─── NAVIGATION ───────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (!validate(currentStepId)) {
      setTimeout(() => {
        const firstError =
          document.querySelector("[data-error]") || stepContentRef.current;
        firstError?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return;
    }
    if (isLast) {
      handleSubmit();
      return;
    }
    const next = stepIds[curIdx + 1];
    setDirection(1);
    setCurrentStepId(next);
    setVisitedIds((v) => (v.includes(next) ? v : [...v, next]));
    setTimeout(scrollToTop, 50);
  }, [
    currentStepId,
    isLast,
    stepIds,
    curIdx,
    validate,
    handleSubmit,
    scrollToTop,
  ]);

  const goPrev = useCallback(() => {
    if (curIdx === 0) return;
    const prev = stepIds[curIdx - 1];
    setDirection(-1);
    setCurrentStepId(prev);
    setTimeout(scrollToTop, 50);
  }, [curIdx, stepIds, scrollToTop]);

  const handleStepClick = useCallback(
    (stepId) => {
      if (!visitedIds.includes(stepId) || stepId === currentStepId) return;
      const targetIdx = stepIds.indexOf(stepId);
      const currentIdx = stepIds.indexOf(currentStepId);
      setDirection(targetIdx < currentIdx ? -1 : 1);
      setCurrentStepId(stepId);
      setTimeout(scrollToTop, 50);
    },
    [visitedIds, currentStepId, stepIds, scrollToTop],
  );

  const handleReset = useCallback(() => {
    setForm(INIT);
    setCurrentStepId("service");
    setVisitedIds(["service"]);
    setDirection(1);
    setErrors({});
    setSuccess(false);
    setPaymentState("idle");
    setPaymentError(null);
    setPendingPaymentBooking(null);
    prevDiagFeeRef.current = 0;
    dispatch(resetHospitals());
    dispatch(resetDoctorsByHospital());
    dispatch(resetHospitalAvailability());
    dispatch(resetDoctorAvailability());
    dispatch(resetTransportEstimate());
    dispatch(resetFollowUpCheck());
    dispatch(resetCreateBooking());
  }, [dispatch]);

  const isSubmitting = createLoading || paymentState === "opening";
  const combinedError =
    paymentError || (createStatus === "failed" ? createError : null);

  const stepContent = {
    service: (
      <StepType
        form={form}
        set={set}
        onSelectBookingType={onSelectBookingType}
      />
    ),
    provider: (
      <StepProvider
        form={form}
        set={set}
        errors={errors}
        hospitals={hospitals}
        hospitalsLoading={hospitalsLoading}
        doctorsByHospital={doctorsByHospital}
        doctorsLoading={doctorsLoading}
        allDoctors={allDoctors}
        allDoctorsLoading={allDoctorsLoading}
        hospitalAvail={hospitalAvail}
        hospitalAvailLoading={hospitalAvailLoading}
        doctorAvail={doctorAvail}
        doctorAvailLoading={doctorAvailLoading}
        labs={labs}
        labsLoading={labsLoading}
        labDetail={labDetail}
        labDetailLoading={labDetailLoading}
        followUpCheck={followUpCheck}
        followUpCheckLoading={followUpCheckLoading}
        onLoadHospitals={onLoadHospitals}
        onLoadDoctors={onLoadDoctors}
        onLoadAllDoctors={onLoadAllDoctors}
        onLoadLabs={onLoadLabs}
        onLoadLabDetail={onLoadLabDetail}
        onCheckHospAvail={onCheckHospAvail}
        onCheckDocAvail={onCheckDocAvail}
        onCheckFollowUp={onCheckFollowUp}
        onResetHospAvail={onResetHospAvail}
        onResetDocAvail={onResetDocAvail}
      />
    ),
    patient: <StepPatient form={form} set={set} errors={errors} />,
    schedule: (
      <StepSchedule
        form={form}
        set={set}
        errors={errors}
        hospitalAvail={hospitalAvail}
        hospitalAvailLoading={hospitalAvailLoading}
        doctorAvail={doctorAvail}
        doctorAvailLoading={doctorAvailLoading}
        transportEstimate={transportEstimate}
        transportLoading={transportLoading}
        onCheckHospAvail={onCheckHospAvail}
        onCheckDocAvail={onCheckDocAvail}
        onEstimateTransport={onEstimateTransport}
        onResetHospAvail={onResetHospAvail}
        onResetDocAvail={onResetDocAvail}
        caTiers={caTiers}
        caTiersLoading={caTiersLoading}
        isLoaded={isLoaded}
      />
    ),
    payment: (
      <StepPayment
        form={form}
        set={set}
        transportEstimate={transportEstimate}
        followUpCheck={followUpCheck}
        caTiers={caTiers}
        walletBalance={walletBalance}
        walletData={walletData}
        labDetail={labDetail}
      />
    ),
    confirm: (
      <StepReview
        form={form}
        isLoading={isSubmitting}
        error={combinedError}
        transportEstimate={transportEstimate}
        followUpCheck={followUpCheck}
        caTiers={caTiers}
        walletBalance={walletBalance}
        paymentState={paymentState}
        pendingPaymentBooking={pendingPaymentBooking}
        handleRetryPayment={handleRetryPayment}
        isRetryingPayment={isRetryingPayment}
        labDetail={labDetail}
      />
    ),
  };

  return (
    <div
      className="min-h-screen py-4 px-3 sm:py-6 sm:px-4 bg-base-100"
      style={PP}
    >
      <div className="max-w-xl mx-auto w-full">
        <div className="text-center mb-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <img
              src="https://ik.imagekit.io/4wja0s7p9/%20favicon.ico"
              alt="Likeson.in"
              className="w-8 h-8 rounded-lg object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-primary/5 text-primary border-primary/20"
              style={PP}
            >
              <HeartPulse size={9} />
              Likeson.in — Healthcare Platform, Vijayawada
            </div>
            <p
              className="text-[9px] text-base-content/35 font-semibold"
              style={PP}
            >
              ABDM-compliant · Verified Doctors · Secure Payments · GST
              Compliant
            </p>
          </div>
          {!success && (
            <h1 className="text-xl font-black tracking-tight" style={PP}>
              Book Your{" "}
              <span className="text-gradient-primary">Healthcare</span>
            </h1>
          )}
        </div>

        <div
          ref={stepContentRef}
          className="rounded-2xl border-2 border-base-300 shadow-sm"
          style={{ background: "var(--base-100)", overflow: "visible" }}
        >
          {success ? (
            <BookingSuccess
              data={createData}
              onReset={handleReset}
              router={router}
            />
          ) : (
            <>
              <div
                className="bg-base-200 border-b border-base-300"
                style={{
                  overflow: "visible",
                  position: "relative",
                  zIndex: 20,
                }}
              >
                <StepBar
                  steps={steps}
                  currentId={currentStepId}
                  visitedIds={visitedIds}
                  onStepClick={handleStepClick}
                />
              </div>
              <div className="relative" style={{ minHeight: 420 }}>
                <AnimatePresence custom={direction} mode="wait">
                  <motion.div
                    key={currentStepId + "_" + form.bookingType}
                    custom={direction}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="p-3 sm:p-5"
                  >
                    {stepContent[currentStepId]}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 border-t border-base-300 bg-base-200">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={goPrev}
                  disabled={curIdx === 0}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl font-black text-xs border-2 border-base-300 transition-all disabled:opacity-25 disabled:cursor-not-allowed flex-shrink-0 min-h-[44px] min-w-[72px] justify-center text-base-content bg-base-100 hover:border-primary hover:text-primary"
                  style={PP}
                >
                  <ChevronLeft size={14} />
                  Back
                </motion.button>
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <p
                    className="text-[9px] font-black uppercase tracking-widest text-base-content/35"
                    style={PP}
                  >
                    {curIdx + 1}/{steps.length}
                  </p>
                  <div className="flex gap-1">
                    {steps.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: s.id === currentStepId ? 10 : 4,
                          height: 4,
                          background: visitedIds.includes(s.id)
                            ? "var(--primary)"
                            : "var(--base-300)",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={goNext}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs text-primary-content disabled:opacity-50 transition-all flex-shrink-0 min-h-[44px] min-w-[96px] justify-center bg-primary hover:opacity-90"
                  style={{
                    boxShadow: "0 4px 12px rgba(var(--color-primary),0.25)",
                    ...PP,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      {<Loader2 size={13} className="animate-spin" />}
                      {paymentState === "opening" ? "Payment…" : "Booking…"}
                    </>
                  ) : isLast ? (
                    <>
                      <CheckCircle2 size={13} />
                      Confirm
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight size={13} />
                    </>
                  )}
                </motion.button>
              </div>
            </>
          )}
        </div>

        {!success && (
          <div className="flex justify-center mt-3">
            <button
              type="button"
              onClick={() => router.push("/doctors")}
              className="flex items-center gap-1 text-xs font-bold text-base-content/35 hover:text-base-content/60 transition-colors min-h-[40px] px-3"
              style={PP}
            >
              <ChevronLeft size={11} />
              Back to Doctors
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
