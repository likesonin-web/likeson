'use client';

/**
 * BookingSystem.jsx — Likeson.in Customer Booking Wizard
 * FIXED:
 *  1. Full care ride schedule = transport calc (km×rate) + care assistant duration + GST breakdown
 *  2. Doctor online hides hospital, forces video type
 *  3. Consultation type shows fee per type, hides unsupported types
 *  4. Unique step labels per service
 *  5. Map open/close bug fixed (mapKey remount)
 *  6. "Use my location" button in map picker
 *  7. Full care payment shows transport + CA fee + GST separate rows
 */

import {
  useEffect, useState, useCallback, useRef, useLayoutEffect,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope, Video, Home, Ambulance, TestTube2,
  UserCheck, Calendar, ChevronRight, ChevronLeft, Check,
  AlertCircle, Loader2, CreditCard, Wallet, Coins,
  MapPin, User, CheckCircle2, FileText, Building2,
  HeartPulse, Microscope, Navigation2, FlaskConical,
  Timer, IndianRupee, RefreshCw, Zap, Hospital, Info,
  Search, Star, ArrowRight, Package, Receipt, ShieldCheck,
  Percent, TrendingDown, AlertTriangle, Phone, X,
  HelpCircle, Clock, Shield, ChevronDown, ChevronUp, LocateFixed,
} from 'lucide-react';

import {
  fetchHospitals, fetchDoctorsByHospital, checkHospitalAvailability,
  checkDoctorAvailability, fetchLabs, fetchLabDetail, fetchBookingOptions,
  estimateTransport, checkFollowUp, createFullCareRide, createDoctorConsultation,
  createDoctorOnline, createPhysiotherapist, createCareAssistant,
  createDiagnosticCenter, createDiagnosticHome, createPatientTransport,
  createFollowUp, resetCreateBooking, resetHospitals, resetDoctorsByHospital,
  resetHospitalAvailability, resetDoctorAvailability, resetTransportEstimate,
  resetFollowUpCheck, resetBookingOptions,
  selectHospitals, selectHospitalsLoading, selectDoctorsByHospital,
  selectDoctorsByHospitalLoading, selectHospitalAvailability, selectHospitalAvailLoading,
  selectDoctorAvailability, selectDoctorAvailLoading, selectLabs, selectLabsLoading,
  selectLabDetail, selectLabDetailLoading, selectBookingOptions, selectBookingOptionsLoading,
  selectTransportEstimate, selectTransportEstimLoading, selectFollowUpCheck,
  selectFollowUpCheckLoading, selectCreateBookingData, selectCreateBookingLoading,
  selectCreateBookingError, selectCreateBookingStatus,
} from '@/store/slices/bookingSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GMAPS_KEY  = 'AIzaSyBkwZzM-ZJCCHUg5hG5vbT9OSIeUPVi_qw';
const VIJAYAWADA = { lat: 16.5062, lng: 80.6480 };

const ALL_STEP_DEFS = {
  service:  { id: 'service',  label: 'Service',  icon: Zap         },
  provider: { id: 'provider', label: 'Provider',  icon: Hospital    },
  patient:  { id: 'patient',  label: 'Patient',   icon: User        },
  schedule: { id: 'schedule', label: 'Schedule',  icon: Calendar    },
  payment:  { id: 'payment',  label: 'Payment',   icon: Receipt     },
  confirm:  { id: 'confirm',  label: 'Confirm',   icon: CheckCircle2 },
};

const STEPS_MAP = {
  full_care_ride:      ['service','provider','patient','schedule','payment','confirm'],
  doctor_consultation: ['service','provider','patient','schedule','payment','confirm'],
  doctor_online:       ['service','provider','patient','schedule','payment','confirm'],
  physiotherapist:     ['service','provider','patient','schedule','payment','confirm'],
  care_assistant:      ['service','patient','schedule','payment','confirm'],
  diagnostic_center:   ['service','provider','patient','schedule','payment','confirm'],
  diagnostic_home:     ['service','provider','patient','schedule','payment','confirm'],
  patient_transport:   ['service','patient','schedule','payment','confirm'],
  follow_up:           ['service','provider','patient','schedule','payment','confirm'],
};

const DEFAULT_STEPS = ['service','provider','patient','schedule','payment','confirm'];

// Unique step labels per service
const STEP_LABELS_MAP = {
  full_care_ride: {
    service:  'Care Type',
    provider: 'Hospital & Doctor',
    patient:  'Patient Info',
    schedule: 'Pickup & Trip',
    payment:  'Fare & Pay',
    confirm:  'Confirm Ride',
  },
  doctor_consultation: {
    service:  'Service',
    provider: 'Hospital & Doctor',
    patient:  'Patient Info',
    schedule: 'Appointment',
    payment:  'Fee & Pay',
    confirm:  'Confirm Visit',
  },
  doctor_online: {
    service:  'Service',
    provider: 'Select Doctor',
    patient:  'Patient Info',
    schedule: 'Call Time',
    payment:  'Video Fee & Pay',
    confirm:  'Confirm Call',
  },
  physiotherapist: {
    service:  'Service',
    provider: 'Select Therapist',
    patient:  'Patient Info',
    schedule: 'Session & Venue',
    payment:  'Session Fee',
    confirm:  'Confirm Session',
  },
  care_assistant: {
    service:  'Service',
    patient:  'Patient Info',
    schedule: 'Location & Hours',
    payment:  'Assistant Fee',
    confirm:  'Confirm Assist',
  },
  diagnostic_center: {
    service:  'Service',
    provider: 'Select Lab',
    patient:  'Patient Info',
    schedule: 'Lab Appointment',
    payment:  'Test Charges',
    confirm:  'Confirm Tests',
  },
  diagnostic_home: {
    service:  'Service',
    provider: 'Select Lab',
    patient:  'Patient Info',
    schedule: 'Home Collection',
    payment:  'Collection Fee',
    confirm:  'Confirm Booking',
  },
  patient_transport: {
    service:  'Service',
    patient:  'Patient Info',
    schedule: 'Route & Timing',
    payment:  'Transport Fare',
    confirm:  'Confirm Ride',
  },
  follow_up: {
    service:  'Service',
    provider: 'Same Doctor',
    patient:  'Patient Info',
   schedule: 'Follow-Up Date',   // → 'F/U Date'
payment:  'Discounted Fee',   // → 'Disc. Fee'
    confirm:  'Confirm Follow-Up',
  },
};

const BOOKING_TYPES = [
  {
    value: 'full_care_ride',
    label: 'Full Care Ride',
    icon: Ambulance,
    desc: 'Doctor + care assistant + door-to-door transport',
    color: '#4f46e5',
    bg: 'rgba(79,70,229,0.08)',
    needsDoctor: true, needsCare: true, needsTransport: true, isDiag: false,
    isOnline: false,
    tooltip: '⚠️ Non-emergency only. For life-threatening emergencies call 108 immediately.',
    educationNotes: [
      'We assign a verified care assistant to accompany you from your home.',
      'Doctor consultation happens at the hospital you select.',
      'Transport fare calculated based on distance — pickup to hospital and optionally back home.',
      'Care assistant fee is duration-based (2–12 hrs).',
      'Payment happens after service confirmation.',
    ],
    steps: [
      { step: 'Care Type', note: 'Choose Full Care Ride.' },
      { step: 'Hospital & Doctor', note: 'Pick hospital & doctor.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Pickup & Trip', note: 'Set pickup location, care duration & transport route.' },
      { step: 'Fare & Pay', note: 'Review full fare breakdown & pay.' },
    ],
  },
  {
    value: 'doctor_consultation',
    label: 'Doctor Consultation',
    icon: Stethoscope,
    desc: 'In-person visit at hospital or clinic',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)',
    needsDoctor: true, needsCare: false, needsTransport: false, isDiag: false,
    isOnline: false,
    tooltip: '⚠️ Non-emergency only. Serious conditions — go directly to emergency ward.',
    educationNotes: [
      'Book a slot with your preferred doctor at a hospital or clinic.',
      'Consultation fee set by hospital or doctor — shown before you confirm.',
      'You travel to the hospital on your own (add transport separately if needed).',
      'Confirmation SMS sent after booking — carry it to the hospital.',
      'Follow-up bookings at discounted rates available after your visit.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Doctor Consultation.' },
      { step: 'Hospital & Doctor', note: 'Pick hospital & doctor.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Appointment', note: 'Set appointment date & time.' },
      { step: 'Fee & Pay', note: 'Review fee & pay.' },
    ],
  },
  {
    value: 'doctor_online',
    label: 'Online Consultation',
    icon: Video,
    desc: 'Video or audio call with your doctor from anywhere',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    needsDoctor: true, needsCare: false, needsTransport: false, isDiag: false,
    isOnline: true,
    tooltip: '⚠️ Non-emergency only. Physical symptoms requiring examination — book in-person instead.',
    educationNotes: [
      'Speak to a doctor via video or audio call from your home.',
      'Doctor sends prescription digitally to your app after call.',
      'No travel needed — available anywhere with internet.',
      'Video fee is typically lower than in-person consultation.',
      'Best for follow-ups, minor illnesses, second opinions.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Online Consultation.' },
      { step: 'Select Doctor', note: 'Pick your doctor — no hospital needed.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Call Time', note: 'Set call date & time.' },
      { step: 'Video Fee & Pay', note: 'Review video fee & pay.' },
    ],
  },
  {
    value: 'physiotherapist',
    label: 'Physiotherapist',
    icon: HeartPulse,
    desc: 'Physio session at clinic or home visit',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    needsDoctor: true, needsCare: false, needsTransport: false, isDiag: false,
    isOnline: false,
    tooltip: '⚠️ Non-emergency only. Acute injuries with severe pain — visit emergency first.',
    educationNotes: [
      'Book a physiotherapy session at a clinic or get a home visit.',
      'Home visit fee is higher than clinic session — factored into fare.',
      'Therapist brings equipment needed for standard sessions.',
      'Ideal for post-surgery recovery, sports injuries, chronic pain.',
      'Multiple sessions can be booked as a package for discount.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Physiotherapist.' },
      { step: 'Select Therapist', note: 'Pick physiotherapist.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Session & Venue', note: 'Set session date & location.' },
      { step: 'Session Fee', note: 'Review fee & pay.' },
    ],
  },
  {
    value: 'care_assistant',
    label: 'Care Assistant',
    icon: UserCheck,
    desc: 'Dedicated care assistant — auto-assigned nearest',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    needsDoctor: false, needsCare: true, needsTransport: false, isDiag: false,
    isOnline: false,
    tooltip: '⚠️ Non-emergency only. Medical emergencies — call 108 first.',
    educationNotes: [
      'We auto-assign the nearest verified, available care assistant to you.',
      'Care assistants are trained in basic first aid and patient mobility.',
      'Pricing is tiered by session duration — 2, 4, 6, 8, or 12 hours.',
      'Great for elderly care, post-operative assistance, hospital companions.',
      'You cannot manually select an assistant — system picks nearest for fastest dispatch.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Care Assistant.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Location & Hours', note: 'Set date, location & duration.' },
      { step: 'Assistant Fee', note: 'Review fee & pay.' },
    ],
  },
  {
    value: 'diagnostic_center',
    label: 'Diagnostic Center',
    icon: Microscope,
    desc: 'Lab tests at a diagnostic center (you travel to lab)',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.08)',
    needsDoctor: false, needsCare: false, needsTransport: false, isDiag: true,
    isOnline: false,
    tooltip: '⚠️ Non-emergency only. Urgent diagnostic needs — visit hospital emergency.',
    educationNotes: [
      'Search for labs in your city and book tests or health packages.',
      'You travel to the lab on your appointment date.',
      'Reports delivered digitally to your app, email, or WhatsApp.',
      'Lab prices shown before you confirm — no hidden charges.',
      'Fasting requirements for certain tests — lab will notify you.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Diagnostic Center.' },
      { step: 'Select Lab', note: 'Select lab & tests.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Lab Appointment', note: 'Set appointment date.' },
      { step: 'Test Charges', note: 'Review charges & pay.' },
    ],
  },
  {
    value: 'diagnostic_home',
    label: 'Home Diagnostics',
    icon: TestTube2,
    desc: 'Lab technician visits your home for sample collection',
    color: '#14b8a6',
    bg: 'rgba(20,184,166,0.08)',
    needsDoctor: false, needsCare: false, needsTransport: true, isDiag: true,
    isOnline: false,
    tooltip: '⚠️ Non-emergency only. Critical samples — visit diagnostic centre directly.',
    educationNotes: [
      'A certified lab technician comes to your home to collect samples.',
      'Available for most blood, urine and basic diagnostic tests.',
      'Home collection fee may apply — shown clearly before you confirm.',
      'Reports sent digitally — no need to visit lab at all.',
      'Best for elderly, bedridden patients, or those with mobility issues.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Home Diagnostics.' },
      { step: 'Select Lab', note: 'Select lab & tests.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Home Collection', note: 'Set date & home address.' },
      { step: 'Collection Fee', note: 'Review charges & pay.' },
    ],
  },
  {
    value: 'patient_transport',
    label: 'Patient Transport',
    icon: Navigation2,
    desc: 'Standalone transport — pickup to drop-off',
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    needsDoctor: false, needsCare: false, needsTransport: true, isDiag: false,
    isOnline: false,
    tooltip: '⚠️ Non-emergency transport only. Ambulance emergencies — call 108.',
    educationNotes: [
      'Book a dedicated vehicle to transport a patient from one location to another.',
      'Fare calculated by distance — set pickup and drop-off on map.',
      'Return trip option available — vehicle waits and brings patient back.',
      'Waiting charges apply after first 5 minutes at destination.',
      'Suitable for hospital transfers, clinic visits, home discharge.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Patient Transport.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Route & Timing', note: 'Set pickup & drop-off.' },
      { step: 'Transport Fare', note: 'Review fare & pay.' },
    ],
  },
  {
    value: 'follow_up',
    label: 'Follow-Up Visit',
    icon: RefreshCw,
    desc: 'Follow-up to a prior consultation (same doctor & hospital)',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    needsDoctor: true, needsCare: false, needsTransport: false, isDiag: false,
    isOnline: false,
    tooltip: '⚠️ Non-emergency only. Must have a prior consultation with same doctor.',
    educationNotes: [
      'Book a follow-up with the same doctor from a previous Likeson booking.',
      'Follow-up fee is discounted — typically lower than first consultation.',
      'Eligibility is automatically verified — must be within allowed follow-up window.',
      'Your previous OP number is linked automatically.',
      'Not applicable for new conditions — book Doctor Consultation instead.',
    ],
    steps: [
      { step: 'Service', note: 'Choose Follow-Up Visit.' },
      { step: 'Same Doctor', note: 'Select same doctor & hospital.' },
      { step: 'Patient Info', note: 'Enter patient details.' },
      { step: 'Follow-Up Date', note: 'Set appointment date.' },
      { step: 'Discounted Fee', note: 'Review discounted fee & pay.' },
    ],
  },
];

const CONSULT_TYPES = [
  { value: 'inPerson',  label: 'In-Person',  icon: Stethoscope, feeKey: 'inPersonFee'  },
  { value: 'video',     label: 'Video Call', icon: Video,       feeKey: 'videoFee'     },
  { value: 'homeVisit', label: 'Home Visit', icon: Home,        feeKey: 'homeVisitFee' },
];

const PAYMENT_METHODS = [
  { value: 'Razorpay', label: 'Razorpay',       icon: CreditCard, desc: 'Pay via UPI, Card or Net Banking' },
  { value: 'Wallet',   label: 'Wallet Balance',  icon: Wallet,     desc: 'Deduct from your Likeson wallet'  },
  { value: 'Cash',     label: 'Pay at Service',  icon: Coins,      desc: 'Pay cash at the time of service'  },
];

const GENDER_OPTIONS   = ['Male', 'Female', 'Other', 'Prefer Not to Say'];
const BLOOD_GROUPS     = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const DURATION_OPTIONS = [2, 4, 6, 8, 12];
const REPORT_MODES     = ['Digital (App)', 'Email', 'WhatsApp', 'Physical Copy'];

const CA_TIERS = [
  { hours: 2,  label: '2 hrs',  price: 299  },
  { hours: 4,  label: '4 hrs',  price: 499  },
  { hours: 6,  label: '6 hrs',  price: 699  },
  { hours: 8,  label: '8 hrs',  price: 899  },
  { hours: 12, label: '12 hrs', price: 1199 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n = 0) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

const getSteps = (bookingType) => {
  const keys = (bookingType && STEPS_MAP[bookingType]) ? STEPS_MAP[bookingType] : DEFAULT_STEPS;
  const labels = (bookingType && STEP_LABELS_MAP[bookingType]) ? STEP_LABELS_MAP[bookingType] : {};
  return keys.map((k, i) => ({
    ...ALL_STEP_DEFS[k],
    label: labels[k] || ALL_STEP_DEFS[k].label,
    num: i + 1,
  }));
};

let _gmapsPromise = null;
const loadGMaps = () => {
  if (_gmapsPromise) return _gmapsPromise;
  _gmapsPromise = new Promise((res, rej) => {
    if (window.google?.maps) { res(window.google.maps); return; }
    const s   = document.createElement('script');
    s.src     = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&loading=async`;
    s.async   = true;
    s.onload  = () => res(window.google.maps);
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return _gmapsPromise;
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

const slide = {
  enter:  (d) => ({ x: d > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', damping: 26, stiffness: 320 } },
  exit:   (d) => ({ x: d > 0 ? -56 : 56, opacity: 0, transition: { duration: 0.14 } }),
};

const PP = { fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif" };

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, required, note, error, children }) {
  return (
    <div className="space-y-1.5" style={PP}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-base-content/50" style={PP}>
            {label}{required && <span className="text-error ml-0.5">*</span>}
          </label>
          {note && (
            <span className="flex items-center gap-1 text-[10px] text-base-content/35 text-right" style={PP}>
              <Info size={9} className="flex-shrink-0" />{note}
            </span>
          )}
        </div>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-error font-semibold" style={PP}>
          <AlertCircle size={10} />{error}
        </p>
      )}
    </div>
  );
}

function Inp({ className = '', ...p }) {
  return (
    <input
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3.5 py-2.5 text-sm
        font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15
        transition-all placeholder:text-base-content/25 ${className}`}
    />
  );
}

function Sel({ children, className = '', ...p }) {
  return (
    <select
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3.5 py-2.5 text-sm
        font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15
        transition-all cursor-pointer ${className}`}
    >
      {children}
    </select>
  );
}

function Txta({ className = '', ...p }) {
  return (
    <textarea
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3.5 py-2.5 text-sm
        font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15
        transition-all placeholder:text-base-content/25 resize-none ${className}`}
    />
  );
}

function SCard({ title, icon: Icon, accent, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-base-300 bg-base-100/50 overflow-hidden ${className}`}>
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b border-base-300"
        style={{ background: accent ? `${accent}0d` : 'var(--base-200)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: accent ? `${accent}20` : 'var(--base-300)', color: accent || 'var(--primary)' }}
        >
          <Icon size={14} />
        </div>
        <h4 className="font-black text-sm tracking-tight" style={PP}>{title}</h4>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function AvailPill({ avail, loading }) {
  if (loading) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-base-200 border border-base-300 text-base-content/50" style={PP}>
      <Loader2 size={9} className="animate-spin" />Checking…
    </span>
  );
  if (!avail) return null;
  const ok = avail.available;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border"
      style={{
        background:  ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        color:       ok ? '#10b981' : '#ef4444',
        borderColor: ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        ...PP,
      }}
    >
      {ok ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
      {ok ? 'Available' : (avail.reason || 'Unavailable')}
    </span>
  );
}

function FareRow({ label, value, note, accent, bold, highlight }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg ${highlight ? 'bg-primary/5 border border-primary/15' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${bold ? 'font-black' : 'font-semibold'}`} style={{ color: accent || 'var(--base-content)', ...PP }}>
          {label}
        </p>
        {note && <p className="text-[10px] text-base-content/40 mt-0.5 leading-snug" style={PP}>{note}</p>}
      </div>
      <p className={`text-sm whitespace-nowrap flex-shrink-0 ${bold ? 'font-black' : 'font-bold'}`}
        style={{ color: accent || 'var(--base-content)', ...PP }}>
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE TOOLTIP
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
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setOpen(o => !o); }}}
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
        style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}
        aria-label="Important notice"
      >
        <AlertTriangle size={10} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl border shadow-lg"
            style={{
              background: '#fff9f0',
              borderColor: 'rgba(249,115,22,0.3)',
              boxShadow: '0 8px 24px rgba(249,115,22,0.15)',
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} style={{ color: '#f97316', flexShrink: 0, marginTop: 1 }} />
              <p className="text-[11px] font-semibold leading-relaxed" style={{ color: '#92400e', ...PP }}>
                {tooltip}
              </p>
            </div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b"
              style={{ background: '#fff9f0', borderColor: 'rgba(249,115,22,0.3)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE EDUCATION PANEL
// ─────────────────────────────────────────────────────────────────────────────

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
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${bt.color}30`, background: bt.bg }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: `${bt.color}20` }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${bt.color}20`, color: bt.color }}>
          <Icon size={16} />
        </div>
        <div>
          <p className="font-black text-sm" style={{ color: bt.color, ...PP }}>{bt.label}</p>
          <p className="text-[10px] text-base-content/40" style={PP}>How this service works</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {bt.educationNotes.map((note, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${bt.color}20`, color: bt.color }}>
              <span className="text-[8px] font-black">{i + 1}</span>
            </div>
            <p className="text-[11px] font-medium text-base-content/65 leading-snug" style={PP}>{note}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-base-content/30 mb-2" style={PP}>
          Your booking steps
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          {bt.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                style={{ background: `${bt.color}15`, color: bt.color, ...PP }}>
                {s.step}
              </span>
              {i < bt.steps.length - 1 && (
                <ChevronRight size={9} style={{ color: bt.color, opacity: 0.4 }} />
              )}
            </div>
          ))}
          <div className="flex items-center gap-1">
            <ChevronRight size={9} style={{ color: bt.color, opacity: 0.4 }} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
              style={{ background: `${bt.color}15`, color: bt.color, ...PP }}>
              Confirm
            </span>
          </div>
        </div>
      </div>
      <div className="mx-4 mb-3 flex items-start gap-2 p-2.5 rounded-xl border"
        style={{ background: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.2)' }}>
        <AlertTriangle size={11} style={{ color: '#f97316', flexShrink: 0, marginTop: 1 }} />
        <p className="text-[10px] font-semibold leading-snug" style={{ color: '#92400e', ...PP }}>
          {bt.tooltip}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP BAR
// ─────────────────────────────────────────────────────────────────────────────

function StepBar({ steps, currentId, visitedIds }) {
  return (
    <div className="flex items-center px-4 py-3.5 overflow-x-auto scrollbar-none gap-0" style={PP}>
      {steps.map((s, i) => {
        const Icon   = s.icon;
        const done   = visitedIds.includes(s.id) && s.id !== currentId;
        const active = s.id === currentId;
        const ok     = visitedIds.includes(s.id) || active;
        return (
          <div key={s.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1 min-w-[52px]">
              <motion.div
                animate={{ scale: active ? 1.18 : 1 }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-300"
                style={{
                  opacity: ok ? 1 : 0.35,
                  background: done ? '#10b981' : active ? 'var(--primary)' : 'var(--base-300)',
                  color: done || active ? '#fff' : 'var(--base-content)',
                }}
              >
                {done ? <Check size={11} strokeWidth={3} /> : <Icon size={11} />}
              </motion.div>
              <span
                className="text-[8px] font-black uppercase tracking-wider whitespace-nowrap text-center leading-tight"
                style={{ color: active ? 'var(--primary)' : 'var(--base-content)', opacity: ok ? 1 : 0.35, ...PP, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis' }}

              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-6 h-px mx-1 flex-shrink-0 transition-all duration-500"
                style={{ background: done ? '#10b981' : 'var(--base-300)', opacity: done ? 1 : 0.3 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION PICKER — FIXED map open/close bug + "Use my location" button
// Key insight: use mapKey to remount the inner map div cleanly each open
// ─────────────────────────────────────────────────────────────────────────────

function LocationPicker({ label, note, value, onChange, error, required }) {
  const containerRef = useRef(null);
  const inputRef     = useRef(null);
  const mapRef       = useRef(null);
  const mapObj       = useRef(null);
  const markerObj    = useRef(null);
  const acObj        = useRef(null);
  const [expanded,   setExpanded]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  // mapKey increments each open to force fresh div mount → fixes double-toggle bug
  const [mapKey, setMapKey] = useState(0);

  const destroyMap = () => {
    if (acObj.current) {
      window.google?.maps?.event?.clearInstanceListeners(acObj.current);
      acObj.current = null;
    }
    mapObj.current    = null;
    markerObj.current = null;
  };

  const handleClose = () => {
    destroyMap();
    setExpanded(false);
  };

  const handleOpen = () => {
    destroyMap(); // always clean before open
    setMapKey(k => k + 1); // remount map div
    setExpanded(true);
  };

  const handleToggle = () => {
    if (expanded) handleClose();
    else handleOpen();
  };

  // Init map after expanded + mapKey change (mapRef will point to fresh div)
  useEffect(() => {
    if (!expanded) return;
    // Small timeout ensures DOM painted fresh div
    const t = setTimeout(() => {
      if (!mapRef.current) return;
      setLoading(true);
      loadGMaps().then((maps) => {
        setLoading(false);
        if (!mapRef.current) return;
        const center = value?.coordinates
          ? { lat: value.coordinates[1], lng: value.coordinates[0] }
          : VIJAYAWADA;
        const map = new maps.Map(mapRef.current, {
          center, zoom: 14,
          disableDefaultUI: true, zoomControl: true,
          styles: [
            { featureType: 'all',    elementType: 'geometry', stylers: [{ color: '#f8f9fb' }] },
            { featureType: 'road',   elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
            { featureType: 'water',  elementType: 'geometry', stylers: [{ color: '#d4e5f7' }] },
            { featureType: 'poi',    stylers: [{ visibility: 'off' }] },
          ],
        });
        const marker = new maps.Marker({
          position: center, map, draggable: true,
          icon: {
            path: maps.SymbolPath.CIRCLE, scale: 10,
            fillColor: '#4f46e5', fillOpacity: 1,
            strokeColor: '#fff', strokeWeight: 3,
          },
        });
        const geocoder = new maps.Geocoder();
        const updateFromLL = (latLng) => {
          geocoder.geocode({ location: latLng }, (results, status) => {
            if (status === 'OK' && results[0]) {
              const r = results[0];
              const comps = r.address_components;
              onChange({
                address:     r.formatted_address,
                city:    comps.find(c => c.types.includes('locality'))?.long_name || 'Vijayawada',
                pincode: comps.find(c => c.types.includes('postal_code'))?.long_name || '',
                coordinates: [latLng.lng(), latLng.lat()],
              });
            }
          });
        };
        marker.addListener('dragend', () => updateFromLL(marker.getPosition()));
        map.addListener('click', (e) => { marker.setPosition(e.latLng); updateFromLL(e.latLng); });

        if (inputRef.current) {
          const ac = new maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: 'in' },
            fields: ['formatted_address', 'geometry', 'address_components'],
          });
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place.geometry) return;
            const loc = place.geometry.location;
            map.setCenter(loc); map.setZoom(16); marker.setPosition(loc);
            const comps = place.address_components || [];
            onChange({
              address:     place.formatted_address,
              city:    comps.find(c => c.types.includes('locality'))?.long_name || 'Vijayawada',
              pincode: comps.find(c => c.types.includes('postal_code'))?.long_name || '',
              coordinates: [loc.lng(), loc.lat()],
            });
          });
          acObj.current = ac;
        }

        mapObj.current    = map;
        markerObj.current = marker;
      }).catch(() => setLoading(false));
    }, 60);
    return () => clearTimeout(t);
  }, [expanded, mapKey]);

  // Sync marker when value.coordinates changes externally
  useEffect(() => {
    if (!mapObj.current || !markerObj.current || !value?.coordinates) return;
    const pos = { lat: value.coordinates[1], lng: value.coordinates[0] };
    markerObj.current.setPosition(pos);
    mapObj.current.setCenter(pos);
  }, [value?.coordinates?.[0], value?.coordinates?.[1]]);

  // Cleanup on unmount
  useEffect(() => {
    return () => destroyMap();
  }, []);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapObj.current && markerObj.current) {
          const latLng = new window.google.maps.LatLng(lat, lng);
          markerObj.current.setPosition(latLng);
          mapObj.current.setCenter(latLng);
          mapObj.current.setZoom(16);
          // Reverse geocode
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: latLng }, (results, status) => {
            if (status === 'OK' && results[0]) {
              const r = results[0];
              const comps = r.address_components;
              onChange({
                address:     r.formatted_address,
                city:    comps.find(c => c.types.includes('locality'))?.long_name || 'Vijayawada',
                pincode: comps.find(c => c.types.includes('postal_code'))?.long_name || '',
                coordinates: [lng, lat],
              });
            }
          });
        } else {
          // Map not loaded yet — just set coords and open map will center on them
          onChange({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '', pincode: '', coordinates: [lng, lat] });
        }
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <Field label={label} required={required} note={note} error={error}>
      <div
        ref={containerRef}
        className="border border-base-300 rounded-xl transition-all"
        style={{ borderColor: expanded ? 'var(--primary)' : undefined }}
      >
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <button
            type="button"
            onClick={handleToggle}
            className="flex-1 flex items-center gap-3 text-left hover:bg-base-200/60 rounded-lg transition-colors"
          >
            <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span className="flex-1 text-sm font-medium truncate" style={PP}>
              {value?.address
                ? <span>{value.address}</span>
                : <span className="opacity-30">Tap to pick on map or search address…</span>
              }
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 flex-shrink-0" style={PP}>
              {expanded ? 'Close ▲' : 'Open ▼'}
            </span>
          </button>
          {/* Use my location button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={geoLoading}
            title="Use my current location"
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-primary/10"
            style={{ color: 'var(--primary)' }}
          >
            {geoLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <LocateFixed size={14} />
            }
          </button>
        </div>

        {expanded && (
          <div className="border-t border-base-300">
            {/* Search input — position relative + z-index to float autocomplete above map */}
            <div className="p-2 bg-base-200/60" style={{ position: 'relative', zIndex: 10 }}>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search address, landmark, or area…"
                  defaultValue={value?.address || ''}
                  style={PP}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-base-100 border border-base-300 rounded-lg
                    outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
            {loading
              ? <div className="h-52 flex items-center justify-center bg-base-200/40"><Loader2 size={22} className="animate-spin opacity-40" /></div>
              : (
                <div
                  key={mapKey}
                  ref={mapRef}
                  style={{ height: 220, width: '100%', position: 'relative', zIndex: 1 }}
                />
              )
            }
            {value?.address && (
              <div className="flex items-start gap-2 px-3 py-2 bg-base-200/60 border-t border-base-300">
                <MapPin size={11} className="mt-0.5 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={PP}>{value.address}</p>
                  <p className="text-[10px] opacity-40" style={PP}>{value.city}{value.pincode ? ` — ${value.pincode}` : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { onChange(null); handleClose(); }}
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
// STEP 1 — SERVICE TYPE
// ─────────────────────────────────────────────────────────────────────────────

function StepType({ form, set }) {
  const selected = BOOKING_TYPES.find(b => b.value === form.bookingType);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-tight mb-0.5" style={PP}>What service do you need?</h2>
        <p className="text-sm text-base-content/45" style={PP}>
          Select the care type. Each service is for <strong>non-emergency situations only.</strong>
        </p>
      </div>

      <div className="flex items-center gap-2.5 p-3 rounded-xl border"
        style={{ background: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.25)' }}>
        <Phone size={13} style={{ color: '#f97316', flexShrink: 0 }} />
        <p className="text-[11px] font-bold" style={{ color: '#92400e', ...PP }}>
          For life-threatening emergencies call <strong>108</strong> immediately. This platform is non-emergency only.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {BOOKING_TYPES.map((bt) => {
          const Icon   = bt.icon;
          const active = form.bookingType === bt.value;
          return (
            <motion.button
              key={bt.value}
              type="button"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.975 }}
              onClick={() => set('bookingType', bt.value)}
              className="relative flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
              style={{
                borderColor: active ? bt.color : 'var(--base-300)',
                background:  active ? bt.bg    : 'var(--base-100)',
                boxShadow:   active ? `0 4px 18px ${bt.color}22` : 'none',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: active ? bt.bg : 'var(--base-200)', color: bt.color }}
              >
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-tight" style={{ color: active ? bt.color : 'inherit', ...PP }}>
                  {bt.label}
                </p>
                <p className="text-[11px] text-base-content/40 mt-0.5 leading-snug" style={PP}>{bt.desc}</p>
              </div>
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                {active && (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: bt.color }}
                  >
                    <Check size={9} className="text-white" strokeWidth={3} />
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
          className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5"
        >
          <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
          <p className="text-xs font-bold text-primary" style={PP}>
            {selected?.label} selected. Press Continue to proceed.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — PROVIDER
// FIXED: doctor_online hides hospital, shows only doctor
//        consultation type shows per-type fee, hides unsupported types
// ─────────────────────────────────────────────────────────────────────────────

function StepProvider({
  form, set, errors,
  hospitals, hospitalsLoading,
  doctorsByHospital, doctorsLoading,
  hospitalAvail, hospitalAvailLoading,
  doctorAvail, doctorAvailLoading,
  labs, labsLoading, labDetail, labDetailLoading,
  followUpCheck, followUpCheckLoading,
  onLoadHospitals, onLoadDoctors,
  onLoadLabs, onLoadLabDetail,
  onCheckHospAvail, onCheckDocAvail, onCheckFollowUp,
}) {
  const bt     = BOOKING_TYPES.find(b => b.value === form.bookingType);
  const isDiag = bt?.isDiag;
  const isOnline = bt?.isOnline || form.bookingType === 'doctor_online';

  const providerIcon   = isDiag ? FlaskConical : Stethoscope;
  const providerAccent = isDiag ? '#06b6d4' : isOnline ? '#8b5cf6' : '#0ea5e9';

  useEffect(() => {
    if (form.bookingType === 'follow_up' && form.doctorId) {
      onCheckFollowUp(form.doctorId, form.hospitalId);
    }
  }, [form.doctorId, form.hospitalId]);

  useEffect(() => {
    if (form.scheduledAt && form.hospitalId) onCheckHospAvail();
  }, [form.scheduledAt, form.hospitalId]);

  useEffect(() => {
    if (form.scheduledAt && form.doctorId) onCheckDocAvail();
  }, [form.scheduledAt, form.doctorId]);

  // For online consultation: only video fee matters — force type
  useEffect(() => {
    if (isOnline) set('consultationType', 'video');
  }, [isOnline]);

  // Resolve consultation fee for selected type
  const getConsultFeeForType = (type) => {
    if (!form.doctorFees) return null;
    const map = { inPerson: form.doctorFees.inPersonFee, video: form.doctorFees.videoFee, homeVisit: form.doctorFees.homeVisitFee };
    return map[type] ?? null;
  };

  // Which consultation types to show (not for online / follow_up / physio)
  const showConsultTypes = bt?.needsDoctor
    && form.bookingType !== 'doctor_online'
    && form.bookingType !== 'follow_up'
    && form.bookingType !== 'physiotherapist';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-tight mb-0.5" style={PP}>
          {isDiag ? 'Select Diagnostic Lab' : isOnline ? 'Select Your Doctor' : 'Select Doctor & Hospital'}
        </h2>
        <p className="text-sm text-base-content/45" style={PP}>
          {isDiag
            ? 'Find a lab and choose the tests or packages you need.'
            : isOnline
            ? 'Search for a doctor available for video consultation.'
            : 'Search for a hospital, then choose your doctor and consultation type.'}
        </p>
      </div>

      {/* Online consultation info banner */}
      {isOnline && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-purple-200 bg-purple-50">
          <Video size={14} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
          <p className="text-[11px] font-semibold text-purple-700 leading-snug" style={PP}>
            Online consultation is video-only. No hospital selection needed — choose your doctor and confirm your call time.
          </p>
        </div>
      )}

      {/* DIAGNOSTIC FLOW */}
      {isDiag && (
        <SCard title="Find a Lab" icon={providerIcon} accent={providerAccent}>
          <Field label="Search by City" note="Type your city and click Find">
            <div className="flex gap-2">
              <Inp
                placeholder="e.g. Vijayawada, Hyderabad…"
                value={form.labCity || ''}
                onChange={e => set('labCity', e.target.value)}
                className="flex-1"
              />
              <button type="button" onClick={() => onLoadLabs(form.labCity)}
                className="px-3 py-2 rounded-xl border-2 border-primary text-primary font-black text-xs
                  flex items-center gap-1 hover:bg-primary hover:text-white transition-colors min-w-[64px] justify-center"
                style={PP}>
                {labsLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                Find
              </button>
            </div>
          </Field>

          {labs?.length > 0 && (
            <Field label="Select Lab" note="Home collection labs marked with (Home ✓)" error={errors.labId}>
              <Sel value={form.labId || ''} onChange={e => {
                set('labId', e.target.value);
                set('labName', labs.find(l => l._id === e.target.value)?.labName || '');
                if (e.target.value) onLoadLabDetail(e.target.value);
              }}>
                <option value="">— Choose a lab —</option>
                {labs.map(l => (
                  <option key={l._id} value={l._id}>
                    {l.labName} — {l.registeredAddress?.city}
                    {l.sampleCollectionMode !== 'Center Only' ? ' (Home ✓)' : ''}
                  </option>
                ))}
              </Sel>
            </Field>
          )}

          {labDetailLoading && (
            <div className="flex items-center gap-2 text-xs text-base-content/40 py-1" style={PP}>
              <Loader2 size={12} className="animate-spin" />Loading tests from lab…
            </div>
          )}

          {labDetail && (
            <>
              <Field label="Select Tests" note="Ctrl/Cmd + click for multiple" error={errors.selectedTests}>
                <select multiple size={Math.min((labDetail.labTests?.length || 4), 7)} style={PP}
                  className="w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2 text-sm font-medium
                    outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                  value={form.selectedTests || []}
                  onChange={e => set('selectedTests', Array.from(e.target.selectedOptions, o => o.value))}>
                  {labDetail.labTests?.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.testName} — {fmt(t.discountedPrice ?? t.mrpPrice)}
                      {form.bookingType === 'diagnostic_home' && !t.homeCollectionAvailable ? ' (centre only)' : ''}
                    </option>
                  ))}
                </select>
                {(form.selectedTests?.length > 0) && (
                  <p className="text-[10px] text-primary font-bold" style={PP}>
                    {form.selectedTests.length} test{form.selectedTests.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </Field>

              {labDetail.labPackages?.length > 0 && (
                <Field label="Select Packages (optional)" note="Health bundles at discounted rates">
                  <select multiple size={Math.min(labDetail.labPackages.length, 4)} style={PP}
                    className="w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2 text-sm font-medium
                      outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    value={form.selectedPackages || []}
                    onChange={e => set('selectedPackages', Array.from(e.target.selectedOptions, o => o.value))}>
                    {labDetail.labPackages.map(p => (
                      <option key={p._id} value={p._id}>{p.packageName} — {fmt(p.mrpPrice)}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Report Delivery Mode" note="How you'd like to receive reports">
                <Sel value={form.reportDeliveryMode || 'Digital (App)'} onChange={e => set('reportDeliveryMode', e.target.value)}>
                  {REPORT_MODES.map(m => <option key={m}>{m}</option>)}
                </Sel>
              </Field>

              {form.bookingType === 'diagnostic_home' && labDetail.homeCollectionFee > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-teal-50 border border-teal-200">
                  <Info size={13} className="text-teal-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-700 font-semibold" style={PP}>
                    Home collection fee: {fmt(labDetail.homeCollectionFee)} — waived if subscription includes home sample collection.
                  </p>
                </div>
              )}
            </>
          )}
        </SCard>
      )}

      {/* Pre-filled hospital chip */}
      {form.hospitalId && !hospitals?.length && !hospitalsLoading && !isOnline && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5">
          <Building2 size={13} className="text-primary flex-shrink-0" />
          <p className="text-xs font-bold text-primary flex-1" style={PP}>
            {form.hospitalName || form.hospitalId}
          </p>
          <span className="text-[9px] font-black uppercase tracking-widest text-primary/50" style={PP}>
            Pre-selected
          </span>
        </div>
      )}

      {/* DOCTOR FLOW */}
      {bt?.needsDoctor && (
        <SCard
          title={isOnline ? 'Find Doctor for Video Call' : 'Hospital & Doctor'}
          icon={providerIcon}
          accent={providerAccent}
        >
          {/* Hospital search — hidden for online */}
          {!isOnline && (
            <Field label="Hospital / Clinic" note="Search by city" error={errors.hospitalId}>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Inp placeholder="City, e.g. Vijayawada…" value={form.hospSearch || ''}
                    onChange={e => set('hospSearch', e.target.value)} className="flex-1" />
                  <button type="button" onClick={() => onLoadHospitals(form.hospSearch)}
                    className="px-3 py-2 rounded-xl border-2 border-primary text-primary font-black text-xs
                      flex items-center gap-1 hover:bg-primary hover:text-white transition-colors min-w-[64px] justify-center"
                    style={PP}>
                    {hospitalsLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    Find
                  </button>
                </div>
                {hospitals?.length > 0 && (
                  <Sel value={form.hospitalId || ''} onChange={e => {
                    const h = hospitals.find(h => h._id === e.target.value);
                    set('hospitalId', e.target.value);
                    set('hospitalName', h?.name || '');
                    set('doctorId', ''); set('doctorName', '');
                    if (e.target.value) onLoadDoctors(e.target.value);
                  }}>
                    <option value="">— Select hospital —</option>
                    {hospitals.map(h => (
                      <option key={h._id} value={h._id}>
                        {h.name} — {h.address?.city}{h.is24x7 ? ' · 24×7' : ''}
                      </option>
                    ))}
                  </Sel>
                )}
                {form.hospitalId && form.scheduledAt && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[10px] text-base-content/40" style={PP}>Hospital availability:</span>
                    <AvailPill avail={hospitalAvail} loading={hospitalAvailLoading} />
                    {!hospitalAvail && !hospitalAvailLoading && (
                      <button type="button" onClick={onCheckHospAvail}
                        className="text-[10px] text-primary font-bold hover:underline" style={PP}>Check now</button>
                    )}
                  </div>
                )}
              </div>
            </Field>
          )}

          {/* Online: city search for doctors directly */}
          {isOnline && (
            <Field label="Search Doctors" note="Find doctors available for video">
              <div className="flex gap-2">
                <Inp placeholder="City or doctor name…" value={form.hospSearch || ''}
                  onChange={e => set('hospSearch', e.target.value)} className="flex-1" />
                <button type="button" onClick={() => onLoadHospitals(form.hospSearch)}
                  className="px-3 py-2 rounded-xl border-2 border-purple-500 text-purple-600 font-black text-xs
                    flex items-center gap-1 hover:bg-purple-500 hover:text-white transition-colors min-w-[64px] justify-center"
                  style={PP}>
                  {hospitalsLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  Find
                </button>
              </div>
            </Field>
          )}

          {doctorsLoading && (
            <div className="flex items-center gap-2 text-xs text-base-content/40 py-1" style={PP}>
              <Loader2 size={12} className="animate-spin" />Loading doctors…
            </div>
          )}

          {doctorsByHospital?.length > 0 && (
            <Field label={isOnline ? 'Select Doctor' : 'Doctor'} note="Fee source shown below" error={errors.doctorId}>
              <Sel value={form.doctorId || ''} onChange={e => {
                const d = doctorsByHospital.find(d => d._id === e.target.value);
                set('doctorId', e.target.value);
                set('doctorName', d?.user?.name || '');
                set('doctorSpec', d?.specialization || '');
                set('doctorFees', d?.effectiveFees || null);
              }}>
                <option value="">— Select doctor —</option>
                {doctorsByHospital.map(d => {
                  const feeDisplay = isOnline
                    ? (d.effectiveFees?.videoFee ? ` · Video: ${fmt(d.effectiveFees.videoFee)}` : '')
                    : (d.effectiveFees?.inPersonFee ? ` · from ${fmt(d.effectiveFees.inPersonFee)}` : '');
                  return (
                    <option key={d._id} value={d._id}>
                      {d.user?.name || 'Doctor'} — {d.specialization}{feeDisplay}
                    </option>
                  );
                })}
              </Sel>
            </Field>
          )}

          {!doctorsByHospital?.length && !doctorsLoading && (
            <Field label="Doctor Profile ID" note="Enter directly if you know it" error={errors.doctorId}>
              <Inp placeholder="Doctor profile ObjectId…" value={form.doctorId || ''}
                onChange={e => { set('doctorId', e.target.value); set('doctorName', ''); set('doctorFees', null); }} />
            </Field>
          )}

          {form.doctorId && form.scheduledAt && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-base-content/40" style={PP}>Doctor slot:</span>
              <AvailPill avail={doctorAvail} loading={doctorAvailLoading} />
              {!doctorAvail && !doctorAvailLoading && (
                <button type="button" onClick={onCheckDocAvail}
                  className="text-[10px] text-primary font-bold hover:underline" style={PP}>Check now</button>
              )}
            </div>
          )}

          {/* Doctor fees card */}
          {form.doctorFees && (
            <div className="rounded-xl overflow-hidden border border-sky-200/60 bg-sky-50/60">
              <p className="text-[9px] font-black uppercase tracking-widest text-sky-600 px-3 pt-2 pb-1" style={PP}>
                Doctor Fee Schedule
              </p>
              <div className="grid grid-cols-3 gap-0 px-3 pb-3">
                {[
                  { key: 'inPersonFee', label: 'In-Person' },
                  { key: 'videoFee',    label: 'Video' },
                  { key: 'followUpFee', label: 'Follow-Up' },
                ].map((item, idx) => (
                  <div key={item.key} className={`text-center ${idx > 0 ? 'border-l border-sky-200' : ''}`}>
                    <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider" style={PP}>{item.label}</p>
                    <p className="text-sm font-black text-sky-700" style={PP}>
                      {form.doctorFees[item.key] != null ? fmt(form.doctorFees[item.key]) : '—'}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-center text-base-content/35 px-3 pb-2" style={PP}>
                Source: {form.doctorFees?.source === 'hospital' ? 'Hospital pricing' : "Doctor's own rates"}
              </p>
            </div>
          )}

          {/* Consultation Type — FIXED: show per-type fee, hide for online/follow-up/physio */}
          {showConsultTypes && (
            <Field label="Consultation Type" note="Select your preferred visit type — fee shown per type">
              <div className="grid grid-cols-3 gap-2">
                {CONSULT_TYPES.map(({ value, label, icon: Icon, feeKey }) => {
                  const on = form.consultationType === value;
                  const fee = form.doctorFees ? form.doctorFees[feeKey] : null;
                  // If doctor has no fee for this type AND no doctorFees at all, show anyway
                  // If doctor has fees but this type is null/0, mark as not available
                  const notAvailable = form.doctorFees != null && (fee == null || fee === 0);
                  return (
                    <button key={value} type="button"
                      onClick={() => !notAvailable && set('consultationType', value)}
                      disabled={notAvailable}
                      className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all text-center"
                      style={{
                        borderColor: on ? providerAccent : notAvailable ? 'var(--base-300)' : 'var(--base-300)',
                        background:  on ? `${providerAccent}18` : notAvailable ? 'var(--base-100)' : 'var(--base-200)',
                        color:       on ? providerAccent : notAvailable ? 'var(--base-content)' : 'var(--base-content)',
                        opacity:     notAvailable ? 0.4 : 1,
                        cursor:      notAvailable ? 'not-allowed' : 'pointer',
                        ...PP,
                      }}>
                      <Icon size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wide leading-tight" style={PP}>{label}</span>
                      {fee != null
                        ? <span className="text-[9px] font-bold" style={{ color: on ? providerAccent : '#64748b', ...PP }}>{fmt(fee)}</span>
                        : notAvailable
                        ? <span className="text-[8px] font-bold text-error/60" style={PP}>N/A</span>
                        : <span className="text-[8px] text-base-content/30" style={PP}>—</span>
                      }
                    </button>
                  );
                })}
              </div>
              {form.consultationType && form.doctorFees && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 mt-1">
                  <CheckCircle2 size={12} className="text-sky-600 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-sky-700" style={PP}>
                    {CONSULT_TYPES.find(c => c.value === form.consultationType)?.label} selected —{' '}
                    Fee: {fmt(form.doctorFees[CONSULT_TYPES.find(c => c.value === form.consultationType)?.feeKey])}
                  </p>
                </div>
              )}
            </Field>
          )}

          {/* Online: show video fee prominently */}
          {isOnline && form.doctorFees && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-200">
              <div className="flex items-center gap-2">
                <Video size={14} style={{ color: '#8b5cf6' }} />
                <p className="text-sm font-black text-purple-700" style={PP}>Video Consultation Fee</p>
              </div>
              <p className="text-lg font-black text-purple-700" style={PP}>
                {form.doctorFees.videoFee != null ? fmt(form.doctorFees.videoFee) : '—'}
              </p>
            </div>
          )}
        </SCard>
      )}

      {/* FOLLOW-UP CHECK */}
      {form.bookingType === 'follow_up' && form.doctorId && (
        <div className="space-y-2">
          {followUpCheckLoading && (
            <div className="flex items-center gap-2 text-xs text-base-content/40 p-3 rounded-xl border border-base-300 bg-base-200" style={PP}>
              <Loader2 size={12} className="animate-spin" />Checking follow-up eligibility…
            </div>
          )}
          {followUpCheck && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 p-3.5 rounded-xl border text-sm"
              style={{
                background:  followUpCheck.isEligible ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                borderColor: followUpCheck.isEligible ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                color:       followUpCheck.isEligible ? '#065f46' : '#991b1b',
              }}>
              {followUpCheck.isEligible
                ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />}
              <div>
                <p className="font-bold text-xs" style={PP}>
                  {followUpCheck.isEligible
                    ? `Eligible for follow-up — Fee: ${fmt(followUpCheck.followUpFee)}`
                    : followUpCheck.reason}
                </p>
                {followUpCheck.isEligible && (
                  <p className="text-[10px] opacity-70 mt-0.5" style={PP}>
                    {followUpCheck.daysRemaining} days remaining · Ref: {followUpCheck.parentOpNumber}
                  </p>
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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-tight mb-0.5" style={PP}>Patient Information</h2>
        <p className="text-sm text-base-content/45" style={PP}>
          These details are captured at booking time and stay accurate even if your profile is updated later.
        </p>
      </div>
      <div className="flex gap-2.5">
        {[{ v: true, l: 'Booking for myself' }, { v: false, l: 'For someone else' }].map(({ v, l }) => {
          const on = form.patientIsSelf === v;
          return (
            <button key={String(v)} type="button" onClick={() => set('patientIsSelf', v)}
              className="flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all"
              style={{
                borderColor: on ? 'var(--primary)' : 'var(--base-300)',
                background:  on ? 'rgba(var(--color-primary),0.07)' : 'var(--base-200)',
                color:       on ? 'var(--primary)' : 'inherit',
                ...PP,
              }}>
              {l}
            </button>
          );
        })}
      </div>
      <SCard title="Patient Details" icon={User} accent="var(--primary)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field label="Full Name" required note="As on government ID" error={errors.patientName}>
              <Inp placeholder="e.g. Ravi Kumar Reddy" value={form.patientName || ''}
                onChange={e => set('patientName', e.target.value)} />
            </Field>
          </div>
          <Field label="Age (years)" note="Used on medical records" error={errors.patientAge}>
            <Inp type="number" min="0" max="150" placeholder="34" value={form.patientAge || ''}
              onChange={e => set('patientAge', Number(e.target.value))} />
          </Field>
          <Field label="Gender" note="Required for clinical notes">
            <Sel value={form.patientGender || ''} onChange={e => set('patientGender', e.target.value)}>
              <option value="">— Select —</option>
              {GENDER_OPTIONS.map(g => <option key={g}>{g}</option>)}
            </Sel>
          </Field>
          <Field label="Mobile Number" note="Confirmation SMS sent here" error={errors.patientPhone}>
            <Inp type="tel" placeholder="+91 98765 43210" value={form.patientPhone || ''}
              onChange={e => set('patientPhone', e.target.value)} />
          </Field>
          <Field label="Blood Group" note="Critical for transport & emergency">
            <Sel value={form.patientBloodGroup || ''} onChange={e => set('patientBloodGroup', e.target.value)}>
              <option value="">— Select —</option>
              {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
            </Sel>
          </Field>
          <Field label="Weight (kg)" note="For vehicle selection & stretcher">
            <Inp type="number" min="0" placeholder="68" value={form.patientWeight || ''}
              onChange={e => set('patientWeight', Number(e.target.value))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Emergency Contact (optional)" note="Alternative number for emergency">
              <Inp type="tel" placeholder="+91 77777 88888" value={form.emergencyContact || ''}
                onChange={e => set('emergencyContact', e.target.value)} />
            </Field>
          </div>
        </div>
      </SCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — SCHEDULE + LOCATION
// FIXED: Full care ride shows transport calc + care duration + GST note
// ─────────────────────────────────────────────────────────────────────────────

function StepSchedule({
  form, set, errors,
  hospitalAvail, hospitalAvailLoading,
  doctorAvail, doctorAvailLoading,
  transportEstimate, transportLoading,
  onCheckHospAvail, onCheckDocAvail, onEstimateTransport,
}) {
  const isFullCare = form.bookingType === 'full_care_ride';
  const isTransport= form.bookingType === 'patient_transport';
  const isDiagHome = form.bookingType === 'diagnostic_home';
  const isCareOnly = form.bookingType === 'care_assistant';
  const isPhysio   = form.bookingType === 'physiotherapist';

  useEffect(() => {
    if (
      form.patientLocation?.coordinates &&
      (form.destinationLocation?.coordinates || isFullCare) &&
      (isTransport || isFullCare)
    ) {
      onEstimateTransport();
    }
  }, [form.patientLocation, form.destinationLocation, form.includeReturn, form.includeReturnHome, form.waitingMinutes]);

  const minDate = new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16);

  const caTier = CA_TIERS.find(t => t.hours === (form.durationHours || 4));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-tight mb-0.5" style={PP}>Schedule & Location</h2>
        <p className="text-sm text-base-content/45" style={PP}>Set your preferred date, time, and pickup/drop-off locations.</p>
      </div>

      {/* For full care ride: drop destination FIRST, then pickup */}
      {isFullCare && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50">
          <Info size={12} style={{ color: '#d97706', flexShrink: 0 }} />
          <p className="text-[11px] font-semibold text-amber-800" style={PP}>
            Tip: Enter your drop-off hospital location first, then set your pickup address below.
          </p>
        </div>
      )}

      <SCard title="Appointment Date & Time" icon={Calendar} accent="var(--primary)">
        <Field label="Scheduled Date & Time" required note="Min 15 minutes from now" error={errors.scheduledAt}>
          <Inp type="datetime-local" value={form.scheduledAt || ''} min={minDate} step="60"
  onChange={e => set('scheduledAt', e.target.value)} />
        </Field>
        {form.scheduledAt && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {form.hospitalId && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-base-content/40" style={PP}>Hospital:</span>
                <AvailPill avail={hospitalAvail} loading={hospitalAvailLoading} />
                {!hospitalAvail && !hospitalAvailLoading && (
                  <button type="button" onClick={onCheckHospAvail}
                    className="text-[10px] text-primary font-bold hover:underline" style={PP}>Check now</button>
                )}
              </div>
            )}
            {form.doctorId && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-base-content/40" style={PP}>Doctor slot:</span>
                <AvailPill avail={doctorAvail} loading={doctorAvailLoading} />
                {!doctorAvail && !doctorAvailLoading && (
                  <button type="button" onClick={onCheckDocAvail}
                    className="text-[10px] text-primary font-bold hover:underline" style={PP}>Check now</button>
                )}
              </div>
            )}
          </div>
        )}
        <Field label="Slot ID (optional)" note="If doctor shared a specific slot ref">
          <Inp placeholder="e.g. SLOT-202506-0042" value={form.slotId || ''}
            onChange={e => set('slotId', e.target.value)} />
        </Field>
      </SCard>

      {/* FULL CARE RIDE — pickup + care duration + transport estimate */}
      {isFullCare && (
        <>
          <SCard title="Drop-off Destination (Hospital)" icon={Building2} accent="#ef4444">
            <LocationPicker label="Hospital / Destination Address" required
              note="Where patient will be taken — used for fare calculation"
              value={form.destinationLocation} onChange={loc => set('destinationLocation', loc)}
              error={errors.destinationLocation} />
          </SCard>

          <SCard title="Pickup Location (Your Home)" icon={MapPin} accent="#f59e0b">
            <LocationPicker label="Your Home / Pickup Address" required
              note="Transport fare calculated: pickup → hospital"
              value={form.patientLocation} onChange={loc => set('patientLocation', loc)}
              error={errors.patientLocation} />
            <Field label="Include Return Trip Home?" note="Return ride from hospital back home">
              <div className="flex gap-2">
                {[{ v: false, l: 'No — drop at hospital' }, { v: true, l: 'Yes — return home' }].map(({ v, l }) => {
                  const on = form.includeReturnHome === v;
                  return (
                    <button key={String(v)} type="button" onClick={() => set('includeReturnHome', v)}
                      className="flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all"
                      style={{
                        borderColor: on ? 'var(--primary)' : 'var(--base-300)',
                        background:  on ? 'rgba(var(--color-primary),0.08)' : 'var(--base-200)',
                        color:       on ? 'var(--primary)' : 'inherit',
                        ...PP,
                      }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </Field>
          </SCard>

          {/* Care Assistant Duration for Full Care */}
          <SCard title="Care Assistant Duration" icon={Timer} accent="#f59e0b">
            <p className="text-[11px] text-base-content/55 font-medium leading-snug" style={PP}>
              Select how many hours you need the care assistant. Fee calculated per tier.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_OPTIONS.map(h => {
                const on   = form.durationHours === h;
                const tier = CA_TIERS.find(t => t.hours === h);
                return (
                  <button key={h} type="button" onClick={() => set('durationHours', h)}
                    className="flex flex-col items-center gap-0.5 py-2.5 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: on ? '#f59e0b' : 'var(--base-300)',
                      background:  on ? 'rgba(245,158,11,0.1)' : 'var(--base-200)',
                      color:       on ? '#f59e0b' : 'var(--base-content)',
                    }}>
                    <span className="text-xs font-black" style={PP}>{h}h</span>
                    {tier && <span className="text-[9px] font-bold opacity-60" style={PP}>{fmt(tier.price)}</span>}
                  </button>
                );
              })}
            </div>
          </SCard>

          {/* Transport estimate for full care */}
          {form.patientLocation?.coordinates && form.destinationLocation?.coordinates && (
            <SCard title="Live Transport Estimate" icon={Navigation2} accent="#4f46e5">
              {transportLoading ? (
                <div className="flex items-center gap-2 text-xs text-base-content/40" style={PP}>
                  <Loader2 size={12} className="animate-spin" />Calculating fare…
                </div>
              ) : transportEstimate ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { l: 'Distance', v: `${transportEstimate.distanceKm} km` },
                      { l: 'Rate/km',  v: fmt(transportEstimate.ratePerKm) },
                      { l: 'Outbound fare', v: fmt(transportEstimate.outbound?.totalFare) },
                      transportEstimate.returnLeg && { l: 'Return fare', v: fmt(transportEstimate.returnLeg.totalFare) },
                    ].filter(Boolean).map(({ l, v }) => (
                      <div key={l} className="flex justify-between">
                        <span className="text-base-content/40" style={PP}>{l}</span>
                        <span className="font-bold" style={PP}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-base-300 pt-2 mt-1">
                    <span className="font-black text-sm" style={PP}>Transport Total</span>
                    <span className="font-black text-primary text-sm" style={PP}>{fmt(transportEstimate.totalTransportFee)}</span>
                  </div>
                  <p className="text-[10px] text-base-content/35" style={PP}>
                    + Care assistant: {fmt(caTier?.price || 499)} for {form.durationHours || 4} hrs
                  </p>
                  <p className="text-[10px] text-base-content/35" style={PP}>
                    GST: 5% on transport · 18% on care assistant (calculated at payment step)
                  </p>
                </div>
              ) : (
                <p className="text-xs text-base-content/40" style={PP}>Set pickup & destination to see estimate.</p>
              )}
            </SCard>
          )}
        </>
      )}

      {/* PATIENT TRANSPORT */}
      {isTransport && (
        <>
          <span className="text-sm text-red-500 font-semibold block" style={PP}>
            Tip: Enter your Drop-off Destination first, then set your Pickup Location.
          </span>
          <SCard title="Drop-off Destination" icon={Navigation2} accent="#ef4444">
            <LocationPicker label="Drop-off Address" required
              note="Fare is distance-based (pickup → drop-off)"
              value={form.destinationLocation} onChange={loc => set('destinationLocation', loc)}
              error={errors.destinationLocation} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Field label="Return Trip?" note="Ride back to pickup after visit">
                <div className="flex gap-2">
                  {[{ v: false, l: 'No' }, { v: true, l: 'Yes, return' }].map(({ v, l }) => {
                    const on = form.includeReturn === v;
                    return (
                      <button key={String(v)} type="button" onClick={() => set('includeReturn', v)}
                        className="flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all"
                        style={{
                          borderColor: on ? 'var(--primary)' : 'var(--base-300)',
                          background:  on ? 'rgba(var(--color-primary),0.08)' : 'var(--base-200)',
                          color:       on ? 'var(--primary)' : 'inherit',
                          ...PP,
                        }}>
                        {l}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Wait at Destination (min)" note="First 5 min free, then ₹2/min">
                <Inp type="number" min="0" max="180" placeholder="0"
                  value={form.waitingMinutes || ''}
                  onChange={e => set('waitingMinutes', Number(e.target.value))} />
              </Field>
            </div>
          </SCard>

          <SCard title="Pickup Location" icon={MapPin} accent="#f59e0b">
            <LocationPicker label="Patient Pickup Address" required
              note="Drag pin or search for exact location"
              value={form.patientLocation} onChange={loc => set('patientLocation', loc)}
              error={errors.patientLocation} />
          </SCard>

          {form.patientLocation?.coordinates && form.destinationLocation?.coordinates && (
            <div className="pt-1">
              {transportLoading && (
                <div className="flex items-center gap-2 text-xs text-base-content/40" style={PP}>
                  <Loader2 size={12} className="animate-spin" />Calculating fare estimate…
                </div>
              )}
              {transportEstimate && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2" style={PP}>Live Transport Estimate</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      { l: 'Distance',      v: `${transportEstimate.distanceKm} km` },
                      { l: 'Rate/km',       v: fmt(transportEstimate.ratePerKm) },
                      { l: 'Outbound fare', v: fmt(transportEstimate.outbound?.totalFare) },
                      { l: 'Distance fare', v: fmt(transportEstimate.outbound?.distanceFare) },
                      form.waitingMinutes > 0 && { l: `Waiting (${form.waitingMinutes} min)`, v: fmt(transportEstimate.outbound?.waitingCharge) },
                      form.includeReturn && transportEstimate.returnLeg && { l: 'Return fare', v: fmt(transportEstimate.returnLeg.totalFare) },
                    ].filter(Boolean).map(({ l, v }) => (
                      <div key={l} className="flex justify-between col-span-1">
                        <span className="text-base-content/40" style={PP}>{l}</span>
                        <span className="font-bold" style={PP}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-primary/20 pt-2 mt-1">
                    <span className="font-black text-sm" style={PP}>Estimated Total</span>
                    <span className="font-black text-primary text-sm" style={PP}>{fmt(transportEstimate.totalTransportFee)}</span>
                  </div>
                  <p className="text-[10px] text-base-content/35" style={PP}>
                    + 5% GST on transport applied at payment step
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </>
      )}

      {/* DIAGNOSTIC HOME */}
      {isDiagHome && (
        <SCard title="Sample Collection Address" icon={Home} accent="#14b8a6">
          <LocationPicker label="Your Home Address" required
            note="Lab technician will come here to collect your sample"
            value={form.patientLocation} onChange={loc => set('patientLocation', loc)}
            error={errors.patientLocation} />
        </SCard>
      )}

      {/* CARE ASSISTANT ONLY */}
      {isCareOnly && (
        <SCard title="Service Location & Duration" icon={Timer} accent="#f59e0b">
          <LocationPicker label="Your Location" required
            note="Nearest care assistant dispatched here"
            value={form.patientLocation} onChange={loc => set('patientLocation', loc)}
            error={errors.patientLocation} />
          <Field label="Care Duration" note="Tiered pricing — see exact charge in Payment step">
            <div className="grid grid-cols-5 gap-2">
              {DURATION_OPTIONS.map(h => {
                const on   = form.durationHours === h;
                const tier = CA_TIERS.find(t => t.hours === h);
                return (
                  <button key={h} type="button" onClick={() => set('durationHours', h)}
                    className="flex flex-col items-center gap-0.5 py-2.5 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: on ? '#f59e0b' : 'var(--base-300)',
                      background:  on ? 'rgba(245,158,11,0.1)' : 'var(--base-200)',
                      color:       on ? '#f59e0b' : 'var(--base-content)',
                    }}>
                    <span className="text-xs font-black" style={PP}>{h}h</span>
                    {tier && <span className="text-[9px] font-bold opacity-60" style={PP}>{fmt(tier.price)}</span>}
                  </button>
                );
              })}
            </div>
          </Field>
        </SCard>
      )}

      {/* PHYSIOTHERAPIST */}
      {isPhysio && (
        <SCard title="Visit Type" icon={HeartPulse} accent="#10b981">
          <Field label="How would you like the session?" note="Home visit fee differs from clinic">
            <div className="grid grid-cols-2 gap-3">
              {[{ v: 'inPerson', l: 'At Clinic', icon: Building2 }, { v: 'homeVisit', l: 'Home Visit', icon: Home }].map(({ v, l, icon: Icon }) => {
                const on = form.consultationType === v;
                return (
                  <button key={v} type="button" onClick={() => set('consultationType', v)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: on ? '#10b981' : 'var(--base-300)',
                      background:  on ? 'rgba(16,185,129,0.1)' : 'var(--base-200)',
                      color:       on ? '#10b981' : 'var(--base-content)',
                    }}>
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="font-black text-sm" style={PP}>{l}</span>
                    {on && <Check size={12} className="ml-auto flex-shrink-0" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </Field>
          {form.consultationType === 'homeVisit' && (
            <LocationPicker label="Your Home Address for Physio" required
              note="Physiotherapist will visit here"
              value={form.patientLocation} onChange={loc => set('patientLocation', loc)}
              error={errors.patientLocation} />
          )}
        </SCard>
      )}

      <SCard title="Special Instructions (optional)" icon={FileText} accent="var(--info)">
        <Field label="Notes for Provider" note="Symptoms, accessibility needs, special requests">
          <Txta rows={3}
            placeholder="e.g. Patient uses wheelchair — please arrange ramp. Allergic to penicillin…"
            value={form.customerNotes || ''}
            onChange={e => set('customerNotes', e.target.value)} />
        </Field>
      </SCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — PAYMENT
// FIXED: Full care = transport + CA fee + GST on each component separately
// ─────────────────────────────────────────────────────────────────────────────

function StepPayment({ form, set, transportEstimate, followUpCheck }) {
  const bt = BOOKING_TYPES.find(b => b.value === form.bookingType);

  // Resolve consultation fee
  let consultFee = 0;
  if (form.doctorFees) {
    if (form.consultationType === 'video')        consultFee = form.doctorFees.videoFee     || 0;
    else if (form.consultationType === 'homeVisit') consultFee = form.doctorFees.homeVisitFee || 0;
    else                                           consultFee = form.doctorFees.inPersonFee  || 0;
  } else if (bt?.needsDoctor && form.bookingType !== 'follow_up') {
    consultFee = 600;
  }
  if (form.bookingType === 'follow_up' && followUpCheck?.isEligible) {
    consultFee = followUpCheck.followUpFee || 0;
  }
  if (form.bookingType === 'doctor_online' && form.doctorFees) {
    consultFee = form.doctorFees.videoFee || 0;
  }

  const transportFee = transportEstimate?.totalTransportFee || 0;
  const caTier = CA_TIERS.find(t => t.hours === (form.durationHours || 4));
  const caFee  = bt?.needsCare ? (caTier?.price || 499) : 0;
  const hasDiag = bt?.isDiag;

  // GST per component
  const consultGst   = form.bookingType === 'doctor_online' ? 0.05 : 0.00; // 5% for online, 0% for in-person
  const transportGst = 0.05; // 5%
  const caGst        = 0.18; // 18%
  const diagGst      = 0.05; // 5%

  const consultGstAmt   = bt?.needsDoctor ? +(consultFee * consultGst).toFixed(2) : 0;
  const transportGstAmt = bt?.needsTransport ? +(transportFee * transportGst).toFixed(2) : 0;
  const caGstAmt        = bt?.needsCare ? +(caFee * caGst).toFixed(2) : 0;

  const subtotal     = consultFee + transportFee + caFee;
  const totalGst     = consultGstAmt + transportGstAmt + caGstAmt;
  const estimatedTotal = +(subtotal + totalGst).toFixed(2);
  const hasKnownTotal  = subtotal > 0;

  // Effective consult type label
  const consultTypeLabel = CONSULT_TYPES.find(c => c.value === form.consultationType)?.label || 'In-Person';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-tight mb-0.5" style={PP}>Payment & Fare Breakdown</h2>
        <p className="text-sm text-base-content/45" style={PP}>
          Review all charges before confirming. Exact amount locked after provider confirms.
        </p>
      </div>

      <SCard title="Fare Breakdown" icon={Receipt} accent="var(--primary)">
        {/* Consultation */}
        {bt?.needsDoctor && (
          <>
            <FareRow label={`Consultation Fee (${consultTypeLabel})`}
              value={consultFee > 0 ? fmt(consultFee) : 'Resolved on booking'}
              note={form.bookingType === 'follow_up'
                ? 'Follow-up discounted fee (same doctor & hospital)'
                : form.bookingType === 'doctor_online'
                ? `Video call fee · Source: ${form.doctorFees?.source || 'platform default'}`
                : form.doctorFees
                ? `${consultTypeLabel} · Source: ${form.doctorFees?.source || 'platform'}`
                : 'Resolved from hospital, doctor, or platform default (₹600)'}
            />
            {consultGst > 0 && consultFee > 0 && (
              <FareRow label={`GST on Consultation (${(consultGst * 100).toFixed(0)}%)`}
                value={fmt(consultGstAmt)}
                note="Applied on consultation fee only"
              />
            )}
            {consultGst === 0 && bt?.needsDoctor && (
              <div className="px-3 py-1">
                <p className="text-[10px] text-base-content/35" style={PP}>
                  Consultation GST: 0% (in-person medical consultations are GST-exempt per Indian tax law)
                </p>
              </div>
            )}
          </>
        )}

        {/* Transport */}
        {bt?.needsTransport && (
          <>
            <FareRow label="Transport Charge"
              value={transportFee > 0 ? fmt(transportFee) : 'Set pickup & destination to estimate'}
              note={transportEstimate
                ? `${transportEstimate.distanceKm} km × ${fmt(transportEstimate.ratePerKm)}/km${(form.includeReturn || form.includeReturnHome) ? ' + return' : ''}${form.waitingMinutes > 0 ? ` + waiting (${form.waitingMinutes} min)` : ''}`
                : 'Fare calculated from your location to destination'}
            />
            {transportFee > 0 && (
              <FareRow label="GST on Transport (5%)"
                value={fmt(transportGstAmt)}
                note="5% GST applicable on patient transport services"
              />
            )}
          </>
        )}

        {/* Subscription km rate discount note */}
        {transportEstimate?.kmRateSource === 'subscription' && bt?.needsTransport && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
            <Star size={10} />
            <span className="text-[11px] font-bold" style={PP}>Subscription rate applied — saving vs ₹12/km standard</span>
          </div>
        )}

        {/* Care assistant */}
        {bt?.needsCare && (
          <>
            <FareRow label="Care Assistant Fee"
              value={fmt(caFee)}
              note={`${form.durationHours || 4}-hour session · ${caTier?.label || ''} tier`}
            />
            <FareRow label="GST on Care Assistant (18%)"
              value={fmt(caGstAmt)}
              note="18% GST applicable on care assistant services"
            />
          </>
        )}

        {/* Diagnostics */}
        {hasDiag && (
          <>
            <FareRow label="Diagnostic Tests / Packages"
              value="See lab prices above"
              note={`${(form.selectedTests?.length || 0) + (form.selectedPackages?.length || 0)} item(s) selected`}
            />
            <FareRow label="GST on Diagnostics (5%)"
              value="Applied on lab charges"
              note="5% GST on diagnostic services"
            />
          </>
        )}

        {form.bookingType === 'diagnostic_home' && (
          <FareRow label="Home Collection Fee"
            value="Lab-dependent"
            note="Waived if subscription includes home sample collection"
          />
        )}

        {/* Subscription discount note */}
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70">
          <Percent size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-700 font-semibold" style={PP}>
            Subscription discounts applied automatically when booking is confirmed.
          </p>
        </div>

        <div className="border-t border-base-300 pt-2 mt-1" />

        {/* GST summary row if multiple */}
        {hasKnownTotal && totalGst > 0 && (
          <FareRow
            label="Total GST"
            value={fmt(totalGst)}
            note={`Breakdown: consult ${fmt(consultGstAmt)} + transport ${fmt(transportGstAmt)} + care ${fmt(caGstAmt)}`}
          />
        )}

        <FareRow
          label={hasKnownTotal ? 'Estimated Total (incl. GST)' : 'Total Amount'}
          value={hasKnownTotal ? fmt(estimatedTotal) : 'Confirmed after booking'}
          note={hasKnownTotal ? 'May vary ±5% after subscription & coupon applied' : 'Exact breakdown in confirmation'}
          accent="var(--primary)" bold highlight
        />
      </SCard>

      <SCard title="Coupon & Discounts" icon={Percent} accent="var(--success)">
        <Field label="Coupon Code (optional)" note="Only valid coupons applied at booking">
          <div className="flex gap-2">
            <Inp placeholder="e.g. CARE20 / FIRST50" value={form.couponCode || ''}
              onChange={e => set('couponCode', e.target.value.toUpperCase())} className="flex-1" />
            <button type="button"
              className="px-3 py-2 rounded-xl border-2 border-primary text-primary font-black text-xs
                hover:bg-primary hover:text-white transition-colors min-w-[60px]"
              style={PP}>
              Apply
            </button>
          </div>
        </Field>
        {form.couponCode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle size={12} className="text-amber-600 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 font-semibold" style={PP}>
              Coupon validity verified at booking creation. Invalid codes ignored automatically.
            </p>
          </div>
        )}
      </SCard>

      <SCard title="Payment Method" icon={CreditCard} accent="var(--secondary)">
        <div className="space-y-2">
          {PAYMENT_METHODS.map(({ value, label, icon: Icon, desc }) => {
            const on = form.paymentMethod === value;
            return (
              <motion.button key={value} type="button" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={() => set('paymentMethod', value)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: on ? 'var(--primary)' : 'var(--base-300)',
                  background:  on ? 'rgba(var(--color-primary),0.05)' : 'var(--base-100)',
                }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: on ? 'rgba(var(--color-primary),0.12)' : 'var(--base-200)',
                    color:      on ? 'var(--primary)' : 'var(--base-content)',
                    opacity:    on ? 1 : 0.55,
                  }}>
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm" style={{ color: on ? 'var(--primary)' : 'inherit', ...PP }}>{label}</p>
                  <p className="text-[11px] text-base-content/40" style={PP}>{desc}</p>
                </div>
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: on ? 'var(--primary)' : 'var(--base-300)', background: on ? 'var(--primary)' : 'transparent' }}>
                  {on && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </motion.button>
            );
          })}
        </div>
        {form.paymentMethod === 'Wallet' && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-blue-200 bg-blue-50">
            <Info size={13} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 font-semibold" style={PP}>
              Wallet balance deducted at booking creation. Ensure sufficient balance before confirming.
            </p>
          </div>
        )}
      </SCard>

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-base-300 bg-base-200/50">
        <ShieldCheck size={14} className="text-base-content/40 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-base-content/45 leading-relaxed" style={PP}>
          Cancellations 24+ hrs before scheduled time: 100% refund. Within 24 hrs: 50% refund. Same-day no-show: no refund.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — REVIEW & CONFIRM
// ─────────────────────────────────────────────────────────────────────────────

function StepReview({ form, isLoading, error, transportEstimate, followUpCheck }) {
  const bt   = BOOKING_TYPES.find(b => b.value === form.bookingType);
  const Icon = bt?.icon || Stethoscope;
  const caTier = CA_TIERS.find(t => t.hours === (form.durationHours || 4));

  let consultFee = 0;
  if (form.doctorFees) {
    if (form.consultationType === 'video')        consultFee = form.doctorFees.videoFee     || 0;
    else if (form.consultationType === 'homeVisit') consultFee = form.doctorFees.homeVisitFee || 0;
    else                                           consultFee = form.doctorFees.inPersonFee  || 0;
  } else if (bt?.needsDoctor && form.bookingType !== 'follow_up') {
    consultFee = 600;
  }
  if (form.bookingType === 'follow_up' && followUpCheck?.isEligible) {
    consultFee = followUpCheck.followUpFee || 0;
  }
  if (form.bookingType === 'doctor_online' && form.doctorFees) {
    consultFee = form.doctorFees.videoFee || 0;
  }

  const transportFee   = transportEstimate?.totalTransportFee || 0;
  const caFee          = bt?.needsCare ? (caTier?.price || 499) : 0;
  const consultGst     = form.bookingType === 'doctor_online' ? 0.05 : 0;
  const transportGst   = 0.05;
  const caGst          = 0.18;
  const consultGstAmt  = bt?.needsDoctor ? +(consultFee * consultGst).toFixed(2) : 0;
  const transportGstAmt= bt?.needsTransport ? +(transportFee * transportGst).toFixed(2) : 0;
  const caGstAmt       = bt?.needsCare ? +(caFee * caGst).toFixed(2) : 0;
  const subtotal       = consultFee + transportFee + caFee;
  const totalGst       = consultGstAmt + transportGstAmt + caGstAmt;
  const total          = +(subtotal + totalGst).toFixed(2);

  const consultTypeLabel = CONSULT_TYPES.find(c => c.value === form.consultationType)?.label || 'In-Person';

  const summaryItems = [
    { l: 'Service type',    v: bt?.label },
    { l: 'Patient name',    v: form.patientName },
    { l: 'Age / Gender',    v: `${form.patientAge || '—'} yrs · ${form.patientGender || '—'}` },
    { l: 'Phone',           v: form.patientPhone || '—' },
    { l: 'Scheduled at',    v: fmtDate(form.scheduledAt) },
    form.hospitalName && !bt?.isOnline && { l: 'Hospital',    v: form.hospitalName },
    (form.doctorName || form.doctorId) && { l: 'Doctor',      v: form.doctorName || form.doctorId },
    form.consultationType && form.bookingType !== 'follow_up' && {
      l: 'Consult type', v: consultTypeLabel,
    },
    form.bookingType === 'care_assistant' && { l: 'Care duration', v: `${form.durationHours || 4} hours` },
    form.bookingType === 'full_care_ride' && { l: 'Care duration', v: `${form.durationHours || 4} hours with assistant` },
    form.labName && { l: 'Lab', v: form.labName },
    form.patientLocation?.address && { l: 'Pickup', v: form.patientLocation.address },
    form.destinationLocation?.address && { l: 'Drop-off / Hospital', v: form.destinationLocation.address },
    (form.includeReturn || form.includeReturnHome) && { l: 'Return trip', v: 'Yes — included' },
    { l: 'Payment method',  v: PAYMENT_METHODS.find(p => p.value === form.paymentMethod)?.label },
    form.couponCode && { l: 'Coupon code', v: form.couponCode },
  ].filter(Boolean).filter(i => i.v);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-tight mb-0.5" style={PP}>Review & Confirm</h2>
        <p className="text-sm text-base-content/45" style={PP}>
          Double-check everything below. Once confirmed, your booking is placed and providers notified.
        </p>
      </div>
      <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: bt?.bg || 'var(--base-200)' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#fff', color: bt?.color || 'var(--primary)' }}>
          <Icon size={22} />
        </div>
        <div>
          <p className="font-black text-base" style={{ color: bt?.color || 'var(--primary)', ...PP }}>{bt?.label}</p>
          <p className="text-[11px] text-base-content/45" style={PP}>{bt?.desc}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-base-300 overflow-hidden">
        {summaryItems.map((item, i) => (
          <div key={item.l} className="flex items-start justify-between px-4 py-2.5 gap-4"
            style={{ borderBottom: i < summaryItems.length - 1 ? '1px solid var(--base-300)' : 'none' }}>
            <span className="text-[11px] font-black uppercase tracking-widest text-base-content/35 flex-shrink-0 mt-0.5" style={PP}>{item.l}</span>
            <span className="text-sm font-bold text-right" style={PP}>{item.v}</span>
          </div>
        ))}
      </div>
      {subtotal > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-primary/15">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary" style={PP}>Estimated Charges</p>
          </div>
          <div className="p-4 space-y-2">
            {consultFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/55" style={PP}>Consultation ({consultTypeLabel})</span>
                <span className="font-bold" style={PP}>{fmt(consultFee)}</span>
              </div>
            )}
            {consultGstAmt > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/55" style={PP}>GST on Consultation ({(consultGst*100).toFixed(0)}%)</span>
                <span className="font-bold" style={PP}>{fmt(consultGstAmt)}</span>
              </div>
            )}
            {transportFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/55" style={PP}>Transport</span>
                <span className="font-bold" style={PP}>{fmt(transportFee)}</span>
              </div>
            )}
            {transportGstAmt > 0 && transportFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/55" style={PP}>GST on Transport (5%)</span>
                <span className="font-bold" style={PP}>{fmt(transportGstAmt)}</span>
              </div>
            )}
            {caFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/55" style={PP}>Care Assistant ({form.durationHours || 4} hrs)</span>
                <span className="font-bold" style={PP}>{fmt(caFee)}</span>
              </div>
            )}
            {caGstAmt > 0 && caFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/55" style={PP}>GST on Care Assistant (18%)</span>
                <span className="font-bold" style={PP}>{fmt(caGstAmt)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black border-t border-primary/20 pt-2 mt-1">
              <span style={PP}>Estimated Total (incl. GST)</span>
              <span className="text-primary" style={PP}>{fmt(total)}</span>
            </div>
            <p className="text-[10px] text-base-content/35" style={PP}>
              * Exact total confirmed after booking — subscription discounts, coupons & diagnostic fees applied then.
            </p>
          </div>
        </div>
      )}
      {form.customerNotes && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-base-200 border border-base-300">
          <FileText size={13} className="opacity-40 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-base-content/60 leading-snug" style={PP}>{form.customerNotes}</p>
        </div>
      )}
      {form.bookingType === 'follow_up' && followUpCheck?.isEligible && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50">
          <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-emerald-700" style={PP}>Follow-up eligible</p>
            <p className="text-[11px] text-emerald-600 mt-0.5" style={PP}>
              Ref: {followUpCheck.parentOpNumber} · {followUpCheck.daysRemaining} days remaining · Fee: {fmt(followUpCheck.followUpFee)}
            </p>
          </div>
        </div>
      )}
      {error && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl border"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--error)' }}>
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold" style={PP}>{error}</p>
        </motion.div>
      )}
      {isLoading && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <Loader2 size={18} className="animate-spin text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-black text-primary" style={PP}>Creating your booking…</p>
            <p className="text-[11px] text-base-content/40" style={PP}>Processing payment and assigning providers</p>
          </div>
        </div>
      )}
      <p className="text-[10px] text-base-content/30 text-center leading-relaxed" style={PP}>
        By confirming, you agree to Likeson.in Terms of Service and Cancellation Policy.
        Charges apply as per selected payment method.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function BookingSuccess({ data, onReset, router }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center py-10 space-y-6 px-6">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.1 }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: 'rgba(16,185,129,0.12)' }}>
        <CheckCircle2 size={40} style={{ color: '#10b981' }} />
      </motion.div>
      <div>
        <h2 className="text-xl font-black tracking-tight mb-1" style={{ color: '#10b981', ...PP }}>Booking Confirmed!</h2>
        <p className="text-sm text-base-content/50 max-w-xs mx-auto leading-relaxed" style={PP}>
          Your booking has been placed successfully. A confirmation SMS and email will arrive shortly.
        </p>
      </div>
      {data?.bookingId && (
        <div className="w-full max-w-sm rounded-2xl border border-emerald-200/80 overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-emerald-200/60 bg-emerald-50">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700" style={PP}>Booking Reference</span>
            <span className="font-black text-sm text-emerald-700" style={PP}>#{data.bookingCode}</span>
          </div>
          <div className="p-4 space-y-2.5 text-sm bg-base-100">
            {data.opNumber && (
              <div className="flex justify-between">
                <span className="text-base-content/50" style={PP}>OP Number</span>
                <span className="font-black" style={PP}>{data.opNumber}</span>
              </div>
            )}
            {data.careAssistantAssigned && (
              <div className="flex justify-between">
                <span className="text-base-content/50" style={PP}>Care Assistant</span>
                <span className="font-black" style={PP}>{data.careAssistantAssigned.name}</span>
              </div>
            )}
            {data.fareBreakdown?.totalAmount > 0 && (
              <div className="flex justify-between border-t border-base-300 pt-2 mt-1">
                <span className="font-black" style={PP}>Total Charged</span>
                <span className="font-black text-primary" style={PP}>{fmt(data.fareBreakdown.totalAmount)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex gap-3 w-full max-w-sm">
        {data?.bookingId && (
          <button onClick={() => router.push(`/bookings/${data.bookingId}`)}
            className="flex-1 py-3 rounded-xl font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', ...PP }}>
            View Booking
          </button>
        )}
        <button onClick={onReset}
          className="flex-1 py-3 rounded-xl font-black text-sm border-2 border-base-300 hover:border-primary hover:text-primary transition-colors"
          style={PP}>
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
  bookingType: '',
  hospSearch: '', hospitalId: '', hospitalName: '',
  doctorId: '', doctorName: '', doctorSpec: '', doctorFees: null,
  consultationType: 'inPerson', slotId: '',
  labCity: '', labId: '', labName: '',
  selectedTests: [], selectedPackages: [], reportDeliveryMode: 'Digital (App)',
  patientIsSelf: true,
  patientName: '', patientAge: '', patientGender: '',
  patientPhone: '', patientBloodGroup: '', patientWeight: '',
  emergencyContact: '',
  patientLocation: null, destinationLocation: null,
  includeReturn: false, includeReturnHome: false,
  waitingMinutes: 0, durationHours: 4,
  scheduledAt: '', customerNotes: '',
  paymentMethod: 'Razorpay', couponCode: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BookingSystem() {
  const dispatch     = useDispatch();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const hospitals            = useSelector(selectHospitals);
  const hospitalsLoading     = useSelector(selectHospitalsLoading);
  const doctorsByHospital    = useSelector(selectDoctorsByHospital);
  const doctorsLoading       = useSelector(selectDoctorsByHospitalLoading);
  const hospitalAvail        = useSelector(selectHospitalAvailability);
  const hospitalAvailLoading = useSelector(selectHospitalAvailLoading);
  const doctorAvail          = useSelector(selectDoctorAvailability);
  const doctorAvailLoading   = useSelector(selectDoctorAvailLoading);
  const labs                 = useSelector(selectLabs);
  const labsLoading          = useSelector(selectLabsLoading);
  const labDetail            = useSelector(selectLabDetail);
  const labDetailLoading     = useSelector(selectLabDetailLoading);
  const transportEstimate    = useSelector(selectTransportEstimate);
  const transportLoading     = useSelector(selectTransportEstimLoading);
  const followUpCheck        = useSelector(selectFollowUpCheck);
  const followUpCheckLoading = useSelector(selectFollowUpCheckLoading);
  const createData           = useSelector(selectCreateBookingData);
  const createLoading        = useSelector(selectCreateBookingLoading);
  const createError          = useSelector(selectCreateBookingError);
  const createStatus         = useSelector(selectCreateBookingStatus);

  const [currentStepId, setCurrentStepId] = useState('service');
  const [direction,     setDirection]     = useState(1);
  const [visitedIds,    setVisitedIds]    = useState(['service']);
  const [form,          setForm]          = useState(INIT);
  const [errors,        setErrors]        = useState({});
  const [success,       setSuccess]       = useState(false);

  const set = useCallback((key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  }, []);

  const steps   = getSteps(form.bookingType);
  const stepIds = steps.map(s => s.id);
  const curIdx  = stepIds.indexOf(currentStepId);
  const isLast  = currentStepId === stepIds[stepIds.length - 1];

  // Reset to service step if bookingType changes and current step no longer valid
  useEffect(() => {
    if (form.bookingType && !stepIds.includes(currentStepId)) {
      setCurrentStepId('service');
      setVisitedIds(['service']);
    }
  }, [form.bookingType]);

  // Force consultation type for online
  useEffect(() => {
    if (form.bookingType === 'doctor_online') {
      setForm(p => ({ ...p, consultationType: 'video' }));
    } else if (form.bookingType === 'physiotherapist' && form.consultationType === 'video') {
      setForm(p => ({ ...p, consultationType: 'inPerson' }));
    }
  }, [form.bookingType]);

  // Pre-fill from URL params
  useEffect(() => {
    const doctorId   = searchParams.get('doctor');
    const hospitalId = searchParams.get('hospital');
    const labId      = searchParams.get('lab');
    const type       = searchParams.get('type');
    const name       = searchParams.get('name');
    const spec       = searchParams.get('spec');

    if (doctorId || hospitalId || labId || type) {
      setForm(p => ({
        ...p,
        ...(doctorId   && { doctorId, doctorName: name || '', doctorSpec: spec || '' }),
        ...(hospitalId && { hospitalId }),
        ...(labId      && { labId }),
        ...(type       && { bookingType: type }),
      }));

      if (type && doctorId) {
        setCurrentStepId('patient');
        setVisitedIds(['service', 'provider', 'patient']);
      } else if (type || doctorId || hospitalId || labId) {
        setCurrentStepId('provider');
        setVisitedIds(['service', 'provider']);
      }
    }
  }, []);

  // Auto-fetch hospital name when pre-filled
  useEffect(() => {
    const hospitalId = searchParams.get('hospital');
    if (!hospitalId) return;
    dispatch(fetchHospitals({ id: hospitalId })).then((res) => {
      const h = res.payload?.hospitals?.[0] || res.payload?.[0];
      if (h) {
        setForm(p => ({ ...p, hospitalName: h.name }));
        dispatch(fetchDoctorsByHospital(hospitalId));
      }
    });
  }, []);

  // Auto-fetch lab name when pre-filled
  useEffect(() => {
    const labId = searchParams.get('lab');
    if (!labId) return;
    dispatch(fetchLabDetail(labId)).then((res) => {
      const l = res.payload;
      if (l) setForm(p => ({ ...p, labName: l.labName }));
    });
  }, []);

  // Auto-fetch doctors when hospitalId pre-filled
  useEffect(() => {
    if (form.hospitalId && !doctorsByHospital?.length && !doctorsLoading) {
      onLoadDoctors(form.hospitalId);
    }
  }, [form.hospitalId]);

  useEffect(() => () => { dispatch(resetCreateBooking()); }, [dispatch]);
  useEffect(() => {
    if (createStatus === 'success' && createData) setSuccess(true);
  }, [createStatus, createData]);


  useEffect(() => {
  if (form.scheduledAt && form.hospitalId) onCheckHospAvail();
}, [form.scheduledAt, form.hospitalId]);

useEffect(() => {
  if (form.scheduledAt && form.doctorId) onCheckDocAvail();
}, [form.scheduledAt, form.doctorId]);

  // Actions
  const onLoadHospitals  = useCallback((city) => dispatch(fetchHospitals({ city })), [dispatch]);
  const onLoadDoctors    = useCallback((hId)  => dispatch(fetchDoctorsByHospital(hId)), [dispatch]);
  const onLoadLabs       = useCallback((city) =>
    dispatch(fetchLabs({ city, homeCollection: form.bookingType === 'diagnostic_home' })), [dispatch, form.bookingType]);
  const onLoadLabDetail  = useCallback((lId)  => dispatch(fetchLabDetail(lId)), [dispatch]);
  const onCheckHospAvail = useCallback(() => {
    if (form.hospitalId && form.scheduledAt)
      dispatch(checkHospitalAvailability({ hospitalId: form.hospitalId, scheduledAt: form.scheduledAt }));
  }, [dispatch, form.hospitalId, form.scheduledAt]);
  const onCheckDocAvail  = useCallback(() => {
    if (form.doctorId && form.scheduledAt)
      dispatch(checkDoctorAvailability({ doctorId: form.doctorId, scheduledAt: form.scheduledAt, hospitalId: form.hospitalId }));
  }, [dispatch, form.doctorId, form.scheduledAt, form.hospitalId]);
  const onCheckFollowUp  = useCallback((dId, hId) => {
    if (dId) dispatch(checkFollowUp({ doctorId: dId, hospitalId: hId }));
  }, [dispatch]);
  const onEstimateTransport = useCallback(() => {
    const pickup  = form.patientLocation?.coordinates;
    const dropoff = form.destinationLocation?.coordinates;
    if (!pickup) return;
    // For full care ride, if no destinationLocation yet, skip
    if (form.bookingType === 'patient_transport' && !dropoff) return;
    const params = {
      pickupLng: pickup[0],
      pickupLat: pickup[1],
      bookingType: form.bookingType || 'patient_transport',
    };
    if (dropoff) {
      params.dropoffLng = dropoff[0];
      params.dropoffLat = dropoff[1];
    }
    if (form.includeReturn || form.includeReturnHome) params.includeReturn = true;
    if (form.waitingMinutes) params.waitingMinutes = form.waitingMinutes;
    dispatch(estimateTransport(params));
  }, [dispatch, form]);

  // Build payload helpers
  const mkLoc = (loc) => loc
    ? { coordinates: loc.coordinates, address: loc.address, city: loc.city, pincode: loc.pincode }
    : undefined;
  const mkPatient = () => ({
    name:       form.patientName,
    age:        form.patientAge || undefined,
    gender:     form.patientGender || undefined,
    phone:      form.patientPhone || undefined,
    bloodGroup: form.patientBloodGroup || undefined,
    weight:     form.patientWeight || undefined,
  });
  const mkCommon = () => ({
    patientInfo:   mkPatient(),
    scheduledAt:   form.scheduledAt,
    paymentMethod: form.paymentMethod,
    couponCode:    form.couponCode || undefined,
    slotId:        form.slotId || undefined,
    documents:     [],
  });

  const handleSubmit = useCallback(async () => {
    const common = mkCommon();
    const map = {
      full_care_ride:      () => dispatch(createFullCareRide({
        ...common, hospitalId: form.hospitalId, doctorId: form.doctorId,
        consultationType: form.consultationType,
        patientLocation: mkLoc(form.patientLocation),
        destinationLocation: mkLoc(form.destinationLocation),
        includeReturnHome: form.includeReturnHome,
        durationHours: form.durationHours,
      })),
      doctor_consultation: () => dispatch(createDoctorConsultation({
        ...common, hospitalId: form.hospitalId || undefined, doctorId: form.doctorId,
        consultationType: form.consultationType,
      })),
      doctor_online:       () => dispatch(createDoctorOnline({ ...common, doctorId: form.doctorId })),
      physiotherapist:     () => dispatch(createPhysiotherapist({
        ...common, doctorId: form.doctorId, visitType: form.consultationType,
      })),
      care_assistant:      () => dispatch(createCareAssistant({
        ...common, patientLocation: mkLoc(form.patientLocation), durationHours: form.durationHours,
      })),
      diagnostic_center:   () => dispatch(createDiagnosticCenter({
        ...common, labId: form.labId, tests: form.selectedTests || [],
        packages: form.selectedPackages || [], reportDeliveryMode: form.reportDeliveryMode,
      })),
      diagnostic_home:     () => dispatch(createDiagnosticHome({
        ...common, labId: form.labId, tests: form.selectedTests || [],
        packages: form.selectedPackages || [], patientLocation: mkLoc(form.patientLocation),
        reportDeliveryMode: form.reportDeliveryMode,
      })),
      patient_transport:   () => dispatch(createPatientTransport({
        ...common, patientLocation: mkLoc(form.patientLocation),
        destinationLocation: mkLoc(form.destinationLocation),
        includeReturn: form.includeReturn, waitingMinutes: form.waitingMinutes,
        vehicleClass: 'four_wheeler', addConsultation: false,
      })),
      follow_up:           () => dispatch(createFollowUp({
        ...common, doctorId: form.doctorId, hospitalId: form.hospitalId || undefined,
      })),
    };
    const action = map[form.bookingType];
    if (action) await action();
  }, [dispatch, form]);

  // Validation per step
  const validate = useCallback((sid) => {
    const e = {};
    if (sid === 'service' && !form.bookingType) e.bookingType = 'Select a service type to continue';
    if (sid === 'provider') {
      const bt = BOOKING_TYPES.find(b => b.value === form.bookingType);
      if (bt?.isDiag && !form.labId) e.labId = 'Select a lab';
      if (bt?.isDiag && !form.selectedTests?.length && !form.selectedPackages?.length)
        e.selectedTests = 'Select at least one test or package';
      if (bt?.needsDoctor && !form.doctorId) e.doctorId = 'Select a doctor to continue';
      if (form.bookingType === 'follow_up' && followUpCheck && !followUpCheck.isEligible)
        e.doctorId = followUpCheck.reason || 'Not eligible for follow-up';
    }
    if (sid === 'patient') {
      if (!form.patientName?.trim()) e.patientName = 'Patient full name is required';
      if (!form.patientPhone?.trim()) e.patientPhone = 'Mobile number required for confirmation SMS';
    }
    if (sid === 'schedule') {
      if (!form.scheduledAt) e.scheduledAt = 'Select appointment date and time';
      const bt = BOOKING_TYPES.find(b => b.value === form.bookingType);
      if ((bt?.needsTransport || form.bookingType === 'full_care_ride') && !form.patientLocation?.coordinates)
        e.patientLocation = 'Set your pickup address on the map';
      if (form.bookingType === 'patient_transport' && !form.destinationLocation?.coordinates)
        e.destinationLocation = 'Set the drop-off destination on the map';
      if (form.bookingType === 'full_care_ride' && !form.destinationLocation?.coordinates)
        e.destinationLocation = 'Set the hospital/drop-off address on the map';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, followUpCheck]);

  // Navigation
  const goNext = useCallback(() => {
    if (!validate(currentStepId)) return;
    if (isLast) { handleSubmit(); return; }
    const next = stepIds[curIdx + 1];
    setDirection(1);
    setCurrentStepId(next);
    setVisitedIds(v => v.includes(next) ? v : [...v, next]);
  }, [currentStepId, isLast, stepIds, curIdx, validate, handleSubmit]);

  const goPrev = useCallback(() => {
    if (curIdx === 0) return;
    setDirection(-1);
    setCurrentStepId(stepIds[curIdx - 1]);
  }, [curIdx, stepIds]);

  const handleReset = useCallback(() => {
    setForm(INIT);
    setCurrentStepId('service');
    setVisitedIds(['service']);
    setDirection(1);
    setErrors({});
    setSuccess(false);
    dispatch(resetCreateBooking());
    dispatch(resetHospitals());
    dispatch(resetDoctorsByHospital());
    dispatch(resetHospitalAvailability());
    dispatch(resetDoctorAvailability());
    dispatch(resetTransportEstimate());
    dispatch(resetFollowUpCheck());
    dispatch(resetBookingOptions());
  }, [dispatch]);

  const stepContent = {
    service: <StepType form={form} set={set} />,
    provider: (
      <StepProvider
        form={form} set={set} errors={errors}
        hospitals={hospitals} hospitalsLoading={hospitalsLoading}
        doctorsByHospital={doctorsByHospital} doctorsLoading={doctorsLoading}
        hospitalAvail={hospitalAvail} hospitalAvailLoading={hospitalAvailLoading}
        doctorAvail={doctorAvail} doctorAvailLoading={doctorAvailLoading}
        labs={labs} labsLoading={labsLoading}
        labDetail={labDetail} labDetailLoading={labDetailLoading}
        followUpCheck={followUpCheck} followUpCheckLoading={followUpCheckLoading}
        onLoadHospitals={onLoadHospitals} onLoadDoctors={onLoadDoctors}
        onLoadLabs={onLoadLabs} onLoadLabDetail={onLoadLabDetail}
        onCheckHospAvail={onCheckHospAvail} onCheckDocAvail={onCheckDocAvail}
        onCheckFollowUp={onCheckFollowUp}
      />
    ),
    patient: <StepPatient form={form} set={set} errors={errors} />,
    schedule: (
      <StepSchedule
        form={form} set={set} errors={errors}
        hospitalAvail={hospitalAvail} hospitalAvailLoading={hospitalAvailLoading}
        doctorAvail={doctorAvail} doctorAvailLoading={doctorAvailLoading}
        transportEstimate={transportEstimate} transportLoading={transportLoading}
        onCheckHospAvail={onCheckHospAvail} onCheckDocAvail={onCheckDocAvail}
        onEstimateTransport={onEstimateTransport}
      />
    ),
    payment: (
      <StepPayment
        form={form} set={set}
        transportEstimate={transportEstimate}
        followUpCheck={followUpCheck}
      />
    ),
    confirm: (
      <StepReview
        form={form}
        isLoading={createLoading}
        error={createError}
        transportEstimate={transportEstimate}
        followUpCheck={followUpCheck}
      />
    ),
  };

  return (
    <div className="min-h-screen py-6 px-4" style={{ background: 'var(--base-100)', ...PP }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border"
            style={{
              background:  'rgba(var(--color-primary),0.07)',
              color:       'var(--primary)',
              borderColor: 'rgba(var(--color-primary),0.2)',
              ...PP,
            }}
          >
            <HeartPulse size={10} />
            Likeson.in — Book Care
          </div>
          {!success && (
            <h1 className="text-2xl font-black tracking-tight" style={PP}>
              Book Your{' '}
              <span style={{
                background:           'linear-gradient(135deg, var(--primary), var(--secondary))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}>
                Healthcare
              </span>
            </h1>
          )}
        </div>

        {/* Main card */}
        <div
          className="rounded-3xl border-2 overflow-hidden shadow-sm"
          style={{ borderColor: 'var(--base-300)', background: 'var(--base-100)' }}
        >
          {success ? (
            <BookingSuccess data={createData} onReset={handleReset} router={router} />
          ) : (
            <>
              {/* Step bar */}
              <div style={{ background: 'var(--base-200)', borderBottom: '1px solid var(--base-300)' }}>
                <StepBar steps={steps} currentId={currentStepId} visitedIds={visitedIds} />
              </div>

              {/* Content */}
              <div className="relative overflow-hidden" style={{ minHeight: 480 }}>
                <AnimatePresence custom={direction} mode="wait">
                  <motion.div
                    key={currentStepId + '_' + form.bookingType}
                    custom={direction}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="p-5 md:p-6"
                  >
                    {stepContent[currentStepId]}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer nav */}
              <div
                className="flex items-center justify-between gap-3 px-5 py-4 border-t"
                style={{ borderColor: 'var(--base-300)', background: 'var(--base-200)' }}
              >
                <motion.button
                  type="button"
                  whileHover={{ scale: curIdx === 0 ? 1 : 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={goPrev}
                  disabled={curIdx === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-sm border-2 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--base-300)', ...PP }}
                >
                  <ChevronLeft size={15} />Back
                </motion.button>

                <div className="flex flex-col items-center gap-0.5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-base-content/35" style={PP}>
                    {curIdx + 1} / {steps.length}
                  </p>
                  <div className="flex gap-1">
                    {steps.map(s => (
                      <div key={s.id} className="rounded-full transition-all duration-300"
                        style={{
                          width:      s.id === currentStepId ? 16 : 5,
                          height:     5,
                          background: visitedIds.includes(s.id) ? 'var(--primary)' : 'var(--base-300)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={goNext}
                  disabled={createLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-50 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    boxShadow:  '0 4px 14px rgba(var(--color-primary),0.28)',
                    ...PP,
                  }}
                >
                  {createLoading
                    ? <><Loader2 size={15} className="animate-spin" />Booking…</>
                    : isLast
                    ? <><CheckCircle2 size={15} />Confirm</>
                    : <>Continue<ChevronRight size={15} /></>
                  }
                </motion.button>
              </div>
            </>
          )}
        </div>

        {/* Back link */}
        {!success && (
          <div className="flex justify-center mt-4">
            <button type="button" onClick={() => router.push('/doctors')}
              className="flex items-center gap-1 text-xs font-bold text-base-content/35 hover:text-base-content/60 transition-colors"
              style={PP}>
              <ChevronLeft size={12} />Back to Doctors
            </button>
          </div>
        )}
      </div>
    </div>
  );
}