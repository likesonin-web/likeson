'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, BarChart3, Search, Filter, RefreshCw,
  Eye, Edit2, Trash2, Power, Pause, Play, Car, MapPin,
  Phone, Mail, Shield, ShieldCheck, ShieldX, BadgeCheck,
  Clock, Activity, Star, Award, Zap, TrendingUp,
  ChevronRight, ChevronDown, ChevronLeft, X, Check,
  AlertTriangle, Info, Upload, Link2, Camera, FileText,
  MoreVertical, ArrowUpRight, ArrowDownRight, Gauge,
  Navigation, Coffee, Moon, Sun, Calendar, Hash,
  CreditCard, Banknote, Route, CheckCircle2, XCircle,
  Download, Printer, SlidersHorizontal, Grid3X3, List,
  ChevronUp, Loader2, Image as ImageIcon, Package,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

// ── Redux Thunks (from transportPartnerSlice) ──────────────────────────────
import {
  fetchTPDrivers,
  fetchTPDriverById,
  registerTPDriver,
  updateTPDriver,
  toggleTPDriverActive,
  pauseTPDriver,
  unpauseTPDriver,
  removeTPDriver,
  fetchTPDriverPerformance,
  fetchTPDriverLogs,
} from '@/store/slices/transportPartnerSlice';

import {
  uploadSingleFile,
} from '@/store/slices/uploadSlice';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const TAB_ALL     = 'all';
const TAB_ADD     = 'add';
const TAB_PERF    = 'performance';

const STATUS_COLORS = {
  Available:  { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success', label: 'Available' },
  'On-Trip':  { bg: 'bg-info/10',    text: 'text-info',    dot: 'bg-info',    label: 'On Trip'   },
  Offline:    { bg: 'bg-base-300',   text: 'text-base-content/50', dot: 'bg-base-300', label: 'Offline' },
  'On-Break': { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', label: 'On Break'  },
  Suspended:  { bg: 'bg-error/10',   text: 'text-error',   dot: 'bg-error',   label: 'Suspended' },
};

const KYC_COLORS = {
  Pending:       { bg: 'bg-warning/10',  text: 'text-warning',  icon: Clock        },
  'Under-Review':{ bg: 'bg-info/10',     text: 'text-info',     icon: RefreshCw    },
  Verified:      { bg: 'bg-success/10',  text: 'text-success',  icon: ShieldCheck  },
  Rejected:      { bg: 'bg-error/10',    text: 'text-error',    icon: ShieldX      },
};

const TIER_COLORS = {
  Bronze:   'text-amber-700',
  Silver:   'text-slate-400',
  Gold:     'text-yellow-400',
  Platinum: 'text-cyan-400',
  Diamond:  'text-violet-400',
};

const SHIFT_OPTIONS  = ['Full-Day', 'Morning', 'Afternoon', 'Evening', 'Night', 'On-Call'];
const STATUS_OPTIONS = ['Available', 'On-Trip', 'Offline', 'On-Break', 'Suspended'];
const DAYS           = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LANG_OPTIONS   = ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Other'];

const VEHICLE_TYPES = [
  'Bike', 'Scooter', 'Auto', 'E-Rickshaw', 'Hatchback', 'Sedan',
  'SUV', 'MUV', 'Crossover', 'Van', 'Minivan', 'Tempo-Traveller',
  'Minibus', 'Wheelchair-Van', 'Mortuary-Van', 'Bus', 'Truck', 'Pickup',
];

const DUMMY_PERF_TREND = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  rides: Math.floor(Math.random() * 12) + 3,
  earnings: Math.floor(Math.random() * 800) + 200,
  rating: +(Math.random() * 0.5 + 4.3).toFixed(1),
}));

// ══════════════════════════════════════════════════════════════════════════════
// MICRO-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

/** Animated status pill */
const StatusPill = ({ status }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'Available' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
};

/** KYC badge */
const KycBadge = ({ status }) => {
  const k = KYC_COLORS[status] || KYC_COLORS.Pending;
  const Icon = k.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${k.bg} ${k.text}`}>
      <Icon size={10} /> {status}
    </span>
  );
};

/** Stat card */
const StatCard = ({ icon: Icon, label, value, sub, color = 'primary', trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="card p-4 flex items-start gap-3"
  >
    <div className={`p-2.5 rounded-xl bg-${color}/10 text-${color} shrink-0`}>
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-base-content/50 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-base-content mt-0.5">{value}</p>
      {sub && <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </div>
    {trend !== undefined && (
      <span className={`text-xs font-bold ${trend >= 0 ? 'text-success' : 'text-error'} flex items-center gap-0.5`}>
        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(trend)}%
      </span>
    )}
  </motion.div>
);

/** Input field with label + hint */
const Field = ({ label, hint, required, error, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-semibold text-base-content flex items-center gap-1">
      {label}
      {required && <span className="text-error text-xs">*</span>}
      {hint && (
        <span title={hint} className="text-base-content/30 cursor-help">
          <Info size={12} />
        </span>
      )}
    </label>
    {children}
    {error && <p className="text-xs text-error flex items-center gap-1"><AlertTriangle size={10} />{error}</p>}
  </div>
);

/** Reusable text input */
const Input = ({ className = '', ...props }) => (
  <input
    className={`input-field w-full ${className}`}
    {...props}
  />
);

/** Reusable select */
const Select = ({ className = '', children, ...props }) => (
  <select className={`input-field w-full ${className}`} {...props}>
    {children}
  </select>
);

/** Toggle switch */
const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <div
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${checked ? 'bg-primary' : 'bg-base-300'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
    {label && <span className="text-sm font-medium text-base-content">{label}</span>}
  </label>
);

/** Upload input — direct file OR paste link */
const UploadOrLink = ({ label, hint, value, onChange, folder = 'drivers', required }) => {
  const dispatch     = useDispatch();
  const { isUploading } = useSelector((s) => s.upload);
  const [mode, setMode] = useState('link'); // 'link' | 'file'
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await dispatch(uploadSingleFile({ file, folder }));
    if (uploadSingleFile.fulfilled.match(res)) {
      onChange(res.payload.url);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-base-content flex items-center gap-1">
        {label}{required && <span className="text-error text-xs">*</span>}
        {hint && <span title={hint} className="text-base-content/30 cursor-help"><Info size={12} /></span>}
      </label>

      {/* Mode switcher */}
      <div className="flex gap-1 text-xs mb-1">
        {['link', 'file'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-2 py-0.5 rounded font-semibold transition-colors ${mode === m ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60'}`}
          >
            {m === 'link' ? <><Link2 size={10} className="inline mr-0.5" />Paste URL</> : <><Upload size={10} className="inline mr-0.5" />Upload File</>}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <div className="relative">
          <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
          <input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/document.jpg"
            className="input-field w-full pl-8 text-sm"
          />
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed border-base-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {isUploading ? (
            <Loader2 size={20} className="mx-auto animate-spin text-primary" />
          ) : (
            <>
              <ImageIcon size={20} className="mx-auto text-base-content/30 mb-1" />
              <p className="text-xs text-base-content/50">Click to upload · JPG, PNG, PDF</p>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
        </div>
      )}

      {/* Preview */}
      {value && (
        <div className="flex items-center gap-2 mt-1 p-2 bg-success/10 rounded-lg text-xs text-success font-semibold">
          <CheckCircle2 size={12} /> Document linked
          <a href={value} target="_blank" rel="noreferrer" className="ml-auto underline text-info">Preview</a>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// DRIVER CARD (All Drivers grid)
// ══════════════════════════════════════════════════════════════════════════════

const DriverCard = ({ driver, onView, onEdit, onToggle, onPause, onUnpause, onRemove, viewMode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const name    = driver.legalName || driver.user?.name || 'Unnamed Driver';
  const phone   = driver.phone   || driver.user?.phone || '—';
  const avatar  = driver.user?.avatar;
  const code    = driver.driverCode || '—';
  const rating  = driver.performance?.rating?.toFixed(1) || '0.0';
  const rides   = driver.performance?.totalRidesCompleted || 0;
  const kycSt   = driver.kyc?.verificationStatus || 'Pending';
  const tier    = driver.rewards?.tier || 'Bronze';

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        className="card px-4 py-3 flex items-center gap-4 hover:border-primary/40 transition-colors"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden bg-base-200 shrink-0 ring-2 ring-base-300">
          {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> :
            <div className="w-full h-full flex items-center justify-center text-base-content/40 font-bold text-sm">{name[0]}</div>}
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-5 gap-3 items-center">
          <div className="col-span-1">
            <p className="font-bold text-base-content text-sm truncate">{name}</p>
            <p className="text-xs text-base-content/50 font-mono">{code}</p>
          </div>
          <div className="text-xs text-base-content/60">{phone}</div>
          <div><StatusPill status={driver.status} /></div>
          <div><KycBadge status={kycSt} /></div>
          <div className="flex items-center gap-1 text-xs font-semibold text-warning">
            <Star size={11} fill="currentColor" /> {rating}
            <span className="text-base-content/40 font-normal">({rides} rides)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onView(driver)} className="p-1.5 rounded-lg hover:bg-base-200 text-info transition-colors" title="View Details">
            <Eye size={14} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onEdit(driver)} className="p-1.5 rounded-lg hover:bg-base-200 text-primary transition-colors" title="Edit">
            <Edit2 size={14} />
          </motion.button>
          <div className="relative" ref={menuRef}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/50 transition-colors">
              <MoreVertical size={14} />
            </motion.button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-44 card shadow-xl z-50 py-1"
                >
                  {[
                    { label: driver.isActive ? 'Deactivate' : 'Activate', icon: Power, action: () => { onToggle(driver._id); setMenuOpen(false); }, cls: 'text-warning' },
                    driver.isPaused
                      ? { label: 'Unpause',  icon: Play,  action: () => { onUnpause(driver._id); setMenuOpen(false); }, cls: 'text-success' }
                      : { label: 'Pause',    icon: Pause, action: () => { onPause(driver); setMenuOpen(false); }, cls: 'text-info' },
                    { label: 'Remove',  icon: Trash2, action: () => { onRemove(driver._id); setMenuOpen(false); }, cls: 'text-error' },
                  ].map(({ label, icon: Ic, action, cls }) => (
                    <button key={label} onClick={action} className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 transition-colors ${cls}`}>
                      <Ic size={13} /> {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid card
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      className="card p-4 flex flex-col gap-3 relative group"
    >
      {/* Top-right menu */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg bg-base-200 hover:bg-base-300 text-base-content/50 transition-colors">
          <MoreVertical size={13} />
        </motion.button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              className="absolute right-0 top-full mt-1 w-44 card shadow-xl z-50 py-1"
            >
              {[
                { label: driver.isActive ? 'Deactivate' : 'Activate', icon: Power, action: () => { onToggle(driver._id); setMenuOpen(false); }, cls: 'text-warning' },
                driver.isPaused
                  ? { label: 'Unpause', icon: Play,  action: () => { onUnpause(driver._id); setMenuOpen(false); }, cls: 'text-success' }
                  : { label: 'Pause',   icon: Pause, action: () => { onPause(driver); setMenuOpen(false); }, cls: 'text-info' },
                { label: 'Remove', icon: Trash2, action: () => { onRemove(driver._id); setMenuOpen(false); }, cls: 'text-error' },
              ].map(({ label, icon: Ic, action, cls }) => (
                <button key={label} onClick={action} className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 transition-colors ${cls}`}>
                  <Ic size={13} /> {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-base-200 ring-2 ring-base-300">
            {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> :
              <div className="w-full h-full flex items-center justify-center text-base-content/40 font-bold text-lg">{name[0]}</div>}
          </div>
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-base-100 ${STATUS_COLORS[driver.status]?.dot || 'bg-base-300'} ${driver.status === 'Available' ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base-content text-sm truncate">{name}</p>
          <p className="text-xs text-base-content/50 font-mono">{code}</p>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        <StatusPill status={driver.status} />
        <KycBadge status={kycSt} />
        {driver.isPaused && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-warning/10 text-warning">
            <Pause size={9} /> Paused
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Rating', value: <span className="flex items-center justify-center gap-0.5"><Star size={10} fill="currentColor" className="text-warning" />{rating}</span> },
          { label: 'Rides',  value: rides },
          { label: 'Tier',   value: <span className={`font-black text-xs ${TIER_COLORS[tier]}`}>{tier}</span> },
        ].map(({ label, value }) => (
          <div key={label} className="bg-base-200 rounded-xl p-2">
            <p className="text-xs text-base-content/50">{label}</p>
            <p className="text-sm font-bold text-base-content">{value}</p>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-1 text-xs text-base-content/60">
        <span className="flex items-center gap-1.5 truncate"><Phone size={10} />{phone}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 mt-auto pt-2 border-t border-base-300">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => onView(driver)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-info/10 text-info text-xs font-semibold hover:bg-info/20 transition-colors">
          <Eye size={12} /> View
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => onEdit(driver)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
          <Edit2 size={12} /> Edit
        </motion.button>
      </div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ADD DRIVER FORM
// ══════════════════════════════════════════════════════════════════════════════

const AddDriverForm = ({ onSuccess, onCancel }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.transportPartner);

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;

  const [form, setForm] = useState({
    // Step 1 — Account
    name: '', email: '', phone: '', password: '',
    // Step 2 — Professional
    yearsOfExperience: '', languagesSpoken: [],
    hasMedicalTransportExp: false, hasAmbulanceExp: false,
    // Step 3 — KYC
    kyc: {
      aadhaarNumber: '', aadhaarDocUrl: '',
      drivingLicenceNumber: '', drivingLicenceExpiry: '', drivingLicenceDocUrl: '',
      licenceClass: [],
      psvBadgeNumber: '', psvBadgeExpiry: '', psvBadgeDocUrl: '',
      panNumber: '', panDocUrl: '',
    },
    // Step 4 — Bank
    bankDetails: {
      accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', upiId: '',
    },
    emergencyContact: { name: '', phone: '', relationship: '' },
  });

  const [errors, setErrors] = useState({});

  const set = (path, value) => {
    setForm((prev) => {
      const copy = { ...prev };
      const parts = path.split('.');
      let ref = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        ref[parts[i]] = { ...ref[parts[i]] };
        ref = ref[parts[i]];
      }
      ref[parts[parts.length - 1]] = value;
      return copy;
    });
    if (errors[path]) setErrors((e) => { const n = { ...e }; delete n[path]; return n; });
  };

  const toggleLang = (lang) => {
    setForm((prev) => ({
      ...prev,
      languagesSpoken: prev.languagesSpoken.includes(lang)
        ? prev.languagesSpoken.filter((l) => l !== lang)
        : [...prev.languagesSpoken, lang],
    }));
  };

  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.name.trim())  e.name  = 'Full name is required';
      if (!form.email.trim()) e.email = 'Email is required';
      if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
      if (!form.phone.trim() || !/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10))) e.phone = 'Valid 10-digit mobile required';
      if (form.password.length < 8) e.password = 'Min 8 characters';
    }
    if (step === 3) {
      if (!form.kyc.aadhaarNumber || !/^\d{12}$/.test(form.kyc.aadhaarNumber)) e['kyc.aadhaarNumber'] = '12-digit Aadhaar number required';
      if (!form.kyc.drivingLicenceNumber) e['kyc.drivingLicenceNumber'] = 'DL number required';
      if (!form.kyc.drivingLicenceExpiry) e['kyc.drivingLicenceExpiry'] = 'DL expiry date required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => { if (validate()) setStep((s) => Math.min(s + 1, TOTAL_STEPS)); };
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const res = await dispatch(registerTPDriver(form));
    if (registerTPDriver.fulfilled.match(res)) {
      onSuccess?.();
    }
  };

  const stepLabels = ['Account', 'Professional', 'KYC & Docs', 'Bank & Emergency'];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{ scale: step === i + 1 ? 1.1 : 1 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                  step > i + 1 ? 'bg-success text-success-content' :
                  step === i + 1 ? 'bg-primary text-primary-content' :
                  'bg-base-200 text-base-content/40'
                }`}
              >
                {step > i + 1 ? <Check size={14} /> : i + 1}
              </motion.div>
              <span className={`text-xs font-semibold hidden sm:block ${step === i + 1 ? 'text-primary' : 'text-base-content/40'}`}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full transition-colors ${step > i + 1 ? 'bg-success' : 'bg-base-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.form
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          {/* ── Step 1: Account ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><UserPlus size={16} /></div>
                <div>
                  <h3 className="font-black text-base-content text-sm">Account Setup</h3>
                  <p className="text-xs text-base-content/50">Creates a login account for the driver</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Legal Name" hint="As per Aadhaar card" required error={errors.name}>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ravi Kumar Sharma" />
                </Field>
                <Field label="Mobile Number" hint="Driver's primary contact number" required error={errors.phone}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm font-semibold">+91</span>
                    <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9876543210" className="pl-12" maxLength={10} />
                  </div>
                </Field>
              </div>

              <Field label="Email Address" hint="Used for login and notifications" required error={errors.email}>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="driver@example.com" />
              </Field>

              <Field label="Temporary Password" hint="Driver must change this after first login. Min 8 characters." required error={errors.password}>
                <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Minimum 8 characters" />
              </Field>

              <div className="alert alert-info text-xs">
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>A welcome email with login credentials will be sent to the driver automatically after registration.</span>
              </div>
            </>
          )}

          {/* ── Step 2: Professional ────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-secondary/10 rounded-xl text-secondary"><Award size={16} /></div>
                <div>
                  <h3 className="font-black text-base-content text-sm">Professional Details</h3>
                  <p className="text-xs text-base-content/50">Experience, skills and capabilities</p>
                </div>
              </div>

              <Field label="Years of Experience" hint="Total years of professional driving experience">
                <Input type="number" min="0" max="60" value={form.yearsOfExperience} onChange={(e) => set('yearsOfExperience', e.target.value)} placeholder="e.g. 3" />
              </Field>

              <Field label="Languages Spoken" hint="Select all languages the driver can communicate in">
                <div className="flex flex-wrap gap-2">
                  {LANG_OPTIONS.map((lang) => (
                    <motion.button
                      key={lang} type="button" whileTap={{ scale: 0.95 }}
                      onClick={() => toggleLang(lang)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${
                        form.languagesSpoken.includes(lang)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-base-300 text-base-content/50'
                      }`}
                    >
                      {lang}
                    </motion.button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <div className="card p-4">
                  <Toggle
                    checked={form.hasMedicalTransportExp}
                    onChange={(v) => set('hasMedicalTransportExp', v)}
                    label="Medical Transport Exp."
                  />
                  <p className="text-xs text-base-content/40 mt-2 ml-12">Has experience transporting patients or medical cases</p>
                </div>
                <div className="card p-4">
                  <Toggle
                    checked={form.hasAmbulanceExp}
                    onChange={(v) => set('hasAmbulanceExp', v)}
                    label="Ambulance Experience"
                  />
                  <p className="text-xs text-base-content/40 mt-2 ml-12">Has prior ambulance or emergency vehicle experience</p>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: KYC ─────────────────────────────────────────────── */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-warning/10 rounded-xl text-warning"><Shield size={16} /></div>
                <div>
                  <h3 className="font-black text-base-content text-sm">KYC & Documents</h3>
                  <p className="text-xs text-base-content/50">Identity verification documents — required for dispatch clearance</p>
                </div>
              </div>

              <div className="alert alert-warning text-xs">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Aadhaar number is stored encrypted. Only the last 4 digits are visible after submission.</span>
              </div>

              {/* Aadhaar */}
              <div className="card p-4 flex flex-col gap-3 border-l-4 border-l-warning">
                <p className="text-xs font-black uppercase tracking-wider text-warning">Aadhaar</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Aadhaar Number" hint="12-digit unique ID number" required error={errors['kyc.aadhaarNumber']}>
                    <Input
                      value={form.kyc.aadhaarNumber}
                      onChange={(e) => set('kyc.aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="XXXX XXXX XXXX"
                      maxLength={12}
                    />
                  </Field>
                  <UploadOrLink
                    label="Aadhaar Document"
                    hint="Front + back scan or photo. JPG/PNG/PDF under 5MB."
                    value={form.kyc.aadhaarDocUrl}
                    onChange={(v) => set('kyc.aadhaarDocUrl', v)}
                    folder="driver-kyc"
                  />
                </div>
              </div>

              {/* Driving Licence */}
              <div className="card p-4 flex flex-col gap-3 border-l-4 border-l-primary">
                <p className="text-xs font-black uppercase tracking-wider text-primary">Driving Licence</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="DL Number" hint="State-issued licence number e.g. AP09 20200001234" required error={errors['kyc.drivingLicenceNumber']}>
                    <Input
                      value={form.kyc.drivingLicenceNumber}
                      onChange={(e) => set('kyc.drivingLicenceNumber', e.target.value.toUpperCase())}
                      placeholder="AP09 2020 0001234"
                    />
                  </Field>
                  <Field label="DL Expiry Date" hint="Must be valid. Driver will be flagged 30 days before expiry." required error={errors['kyc.drivingLicenceExpiry']}>
                    <Input
                      type="date"
                      value={form.kyc.drivingLicenceExpiry}
                      onChange={(e) => set('kyc.drivingLicenceExpiry', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </Field>
                </div>
                <UploadOrLink
                  label="DL Document"
                  hint="Clear photo or scan of driving licence (both sides)"
                  value={form.kyc.drivingLicenceDocUrl}
                  onChange={(v) => set('kyc.drivingLicenceDocUrl', v)}
                  folder="driver-kyc"
                />
              </div>

              {/* PAN (optional) */}
              <div className="card p-4 flex flex-col gap-3 border-l-4 border-l-info">
                <p className="text-xs font-black uppercase tracking-wider text-info">PAN Card <span className="text-base-content/30 font-normal normal-case">(optional)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="PAN Number" hint="10-character alphanumeric PAN. Required for earnings above ₹50,000/year.">
                    <Input
                      value={form.kyc.panNumber}
                      onChange={(e) => set('kyc.panNumber', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                  </Field>
                  <UploadOrLink
                    label="PAN Document"
                    hint="Clear scan of PAN card"
                    value={form.kyc.panDocUrl}
                    onChange={(v) => set('kyc.panDocUrl', v)}
                    folder="driver-kyc"
                  />
                </div>
              </div>

              {/* PSV Badge (optional) */}
              <div className="card p-4 flex flex-col gap-3 border-l-4 border-l-success">
                <p className="text-xs font-black uppercase tracking-wider text-success">PSV Badge <span className="text-base-content/30 font-normal normal-case">(optional — required for commercial transport)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Badge Number" hint="Public Service Vehicle badge issued by RTO">
                    <Input value={form.kyc.psvBadgeNumber} onChange={(e) => set('kyc.psvBadgeNumber', e.target.value.toUpperCase())} placeholder="PSV12345" />
                  </Field>
                  <Field label="Badge Expiry" hint="PSV badge expiry date">
                    <Input type="date" value={form.kyc.psvBadgeExpiry} onChange={(e) => set('kyc.psvBadgeExpiry', e.target.value)} />
                  </Field>
                  <UploadOrLink
                    label="Badge Document"
                    value={form.kyc.psvBadgeDocUrl}
                    onChange={(v) => set('kyc.psvBadgeDocUrl', v)}
                    folder="driver-kyc"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Step 4: Bank & Emergency ────────────────────────────────── */}
          {step === 4 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-success/10 rounded-xl text-success"><CreditCard size={16} /></div>
                <div>
                  <h3 className="font-black text-base-content text-sm">Bank & Emergency Contact</h3>
                  <p className="text-xs text-base-content/50">Payment details and emergency contact information</p>
                </div>
              </div>

              <div className="card p-4 flex flex-col gap-3 border-l-4 border-l-success">
                <p className="text-xs font-black uppercase tracking-wider text-success">Bank Details <span className="text-base-content/30 font-normal normal-case">(for earnings settlement)</span></p>

                <div className="alert alert-info text-xs mb-1">
                  <Info size={12} /> <span>Account number is encrypted. Only last 4 digits visible after save.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Account Holder Name" hint="Must match bank records exactly">
                    <Input value={form.bankDetails.accountHolderName} onChange={(e) => set('bankDetails.accountHolderName', e.target.value)} placeholder="Full name as in bank" />
                  </Field>
                  <Field label="Account Number" hint="Savings or current account number">
                    <Input value={form.bankDetails.accountNumber} onChange={(e) => set('bankDetails.accountNumber', e.target.value)} placeholder="e.g. 1234567890123" />
                  </Field>
                  <Field label="IFSC Code" hint="11-char code printed on cheque e.g. SBIN0001234">
                    <Input
                      value={form.bankDetails.ifscCode}
                      onChange={(e) => set('bankDetails.ifscCode', e.target.value.toUpperCase())}
                      placeholder="SBIN0001234"
                      maxLength={11}
                    />
                  </Field>
                  <Field label="Bank Name" hint="Full bank name e.g. State Bank of India">
                    <Input value={form.bankDetails.bankName} onChange={(e) => set('bankDetails.bankName', e.target.value)} placeholder="State Bank of India" />
                  </Field>
                  <Field label="UPI ID" hint="Optional — for instant UPI settlements e.g. 9876543210@upi">
                    <Input value={form.bankDetails.upiId} onChange={(e) => set('bankDetails.upiId', e.target.value)} placeholder="9876543210@upi" />
                  </Field>
                </div>
              </div>

              <div className="card p-4 flex flex-col gap-3 border-l-4 border-l-error">
                <p className="text-xs font-black uppercase tracking-wider text-error">Emergency Contact <span className="text-base-content/30 font-normal normal-case">(mandatory for safety)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Contact Name" hint="Next of kin or trusted person">
                    <Input value={form.emergencyContact.name} onChange={(e) => set('emergencyContact.name', e.target.value)} placeholder="e.g. Sunita Sharma" />
                  </Field>
                  <Field label="Contact Phone" hint="Reachable 24×7 mobile number">
                    <Input value={form.emergencyContact.phone} onChange={(e) => set('emergencyContact.phone', e.target.value)} placeholder="9876543210" />
                  </Field>
                  <Field label="Relationship" hint="e.g. Wife, Father, Brother">
                    <Input value={form.emergencyContact.relationship} onChange={(e) => set('emergencyContact.relationship', e.target.value)} placeholder="Wife" />
                  </Field>
                </div>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <motion.button
              type="button" whileTap={{ scale: 0.95 }}
              onClick={step === 1 ? onCancel : prevStep}
              className="btn-secondary px-5 py-2 text-sm"
            >
              {step === 1 ? 'Cancel' : <><ChevronLeft size={14} className="inline" /> Back</>}
            </motion.button>

            {step < TOTAL_STEPS ? (
              <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={nextStep} className="btn-primary-cta px-5 py-2 text-sm">
                Next <ChevronRight size={14} className="inline" />
              </motion.button>
            ) : (
              <motion.button type="submit" whileTap={{ scale: 0.95 }} disabled={loading} className="btn-primary-cta px-6 py-2 text-sm disabled:opacity-60 flex items-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Register Driver
              </motion.button>
            )}
          </div>
        </motion.form>
      </AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// EDIT DRIVER MODAL
// ══════════════════════════════════════════════════════════════════════════════

const EditDriverModal = ({ driver, onClose, onSave }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.transportPartner);

  const [form, setForm] = useState({
    legalName:   driver.legalName || '',
    phone:       driver.phone     || '',
    email:       driver.email     || '',
    yearsOfExperience: driver.yearsOfExperience || 0,
    languagesSpoken: driver.languagesSpoken || [],
    hasMedicalTransportExp: driver.hasMedicalTransportExp || false,
    hasAmbulanceExp: driver.hasAmbulanceExp || false,
    shift: {
      shiftType:    driver.shift?.shiftType    || 'Full-Day',
      startTime:    driver.shift?.startTime    || '08:00',
      endTime:      driver.shift?.endTime      || '20:00',
      daysAvailable:driver.shift?.daysAvailable|| [],
    },
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setNested = (parent, key, value) =>
    setForm((prev) => ({ ...prev, [parent]: { ...prev[parent], [key]: value } }));

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      shift: {
        ...prev.shift,
        daysAvailable: prev.shift.daysAvailable.includes(day)
          ? prev.shift.daysAvailable.filter((d) => d !== day)
          : [...prev.shift.daysAvailable, day],
      },
    }));
  };

  const toggleLang = (lang) =>
    setForm((prev) => ({
      ...prev,
      languagesSpoken: prev.languagesSpoken.includes(lang)
        ? prev.languagesSpoken.filter((l) => l !== lang)
        : [...prev.languagesSpoken, lang],
    }));

  const handleSave = async () => {
    const res = await dispatch(updateTPDriver({ driverId: driver._id, data: form }));
    if (updateTPDriver.fulfilled.match(res)) { onSave?.(); onClose(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        className="card w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-5 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Edit2 size={15} /></div>
            <div>
              <h3 className="font-black text-base-content">Edit Driver</h3>
              <p className="text-xs text-base-content/50">{driver.legalName || driver.user?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Legal Name">
              <Input value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10-digit mobile" />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="driver@example.com" />
          </Field>
          <Field label="Years of Experience">
            <Input type="number" min="0" max="60" value={form.yearsOfExperience} onChange={(e) => set('yearsOfExperience', +e.target.value)} />
          </Field>

          <Field label="Languages Spoken">
            <div className="flex flex-wrap gap-1.5">
              {LANG_OPTIONS.map((lang) => (
                <button key={lang} type="button" onClick={() => toggleLang(lang)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-all ${form.languagesSpoken.includes(lang) ? 'border-primary bg-primary/10 text-primary' : 'border-base-300 text-base-content/50'}`}>
                  {lang}
                </button>
              ))}
            </div>
          </Field>

          {/* Shift */}
          <div className="card p-4 flex flex-col gap-3">
            <p className="text-xs font-black uppercase tracking-wider text-base-content/50">Shift Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shift Type" hint="Working schedule pattern">
                <Select value={form.shift.shiftType} onChange={(e) => setNested('shift', 'shiftType', e.target.value)}>
                  {SHIFT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start" hint="Shift start time">
                  <Input type="time" value={form.shift.startTime} onChange={(e) => setNested('shift', 'startTime', e.target.value)} />
                </Field>
                <Field label="End" hint="Shift end time">
                  <Input type="time" value={form.shift.endTime} onChange={(e) => setNested('shift', 'endTime', e.target.value)} />
                </Field>
              </div>
            </div>
            <Field label="Available Days" hint="Select working days">
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((day) => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${form.shift.daysAvailable.includes(day) ? 'border-primary bg-primary/10 text-primary' : 'border-base-300 text-base-content/50'}`}>
                    {day}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card p-3">
              <Toggle checked={form.hasMedicalTransportExp} onChange={(v) => set('hasMedicalTransportExp', v)} label="Medical Transport Exp." />
            </div>
            <div className="card p-3">
              <Toggle checked={form.hasAmbulanceExp} onChange={(v) => set('hasAmbulanceExp', v)} label="Ambulance Exp." />
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-base-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave} disabled={loading}
            className="btn-primary-cta px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save Changes
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// DRIVER DETAIL MODAL (View)
// ══════════════════════════════════════════════════════════════════════════════

const DriverDetailModal = ({ driverId, onClose }) => {
  const dispatch = useDispatch();
  const { driverDetail, driverPerformance, driverLogs, loading } = useSelector((s) => s.transportPartner);

  useEffect(() => {
    if (driverId) {
      dispatch(fetchTPDriverById(driverId));
      dispatch(fetchTPDriverPerformance(driverId));
      dispatch(fetchTPDriverLogs({ driverId, params: { limit: 10 } }));
    }
  }, [driverId, dispatch]);

  const driver = driverDetail;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-5 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-info/10 rounded-xl text-info"><Eye size={15} /></div>
            <div>
              <h3 className="font-black text-base-content">Driver Profile</h3>
              <p className="text-xs text-base-content/50">Full details and performance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : driver ? (
          <div className="p-5 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-base-200 ring-2 ring-base-300 shrink-0">
                {driver.user?.avatar ?
                  <img src={driver.user.avatar} alt={driver.legalName} className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-2xl font-black text-base-content/30">{(driver.legalName || 'D')[0]}</div>}
              </div>
              <div>
                <h4 className="font-black text-xl text-base-content">{driver.legalName || driver.user?.name}</h4>
                <p className="text-xs font-mono text-base-content/50">{driver.driverCode}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <StatusPill status={driver.status} />
                  <KycBadge status={driver.kyc?.verificationStatus} />
                  {driver.isPaused && <span className="badge badge-warning text-xs"><Pause size={9} />Paused</span>}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Rating',  value: `${driver.performance?.rating?.toFixed(1) || '0.0'} ★` },
                { label: 'Rides',   value: driver.performance?.totalRidesCompleted || 0 },
                { label: 'Coins',   value: driver.rewards?.coinBalance || 0 },
                { label: 'Tier',    value: <span className={TIER_COLORS[driver.rewards?.tier]}>{driver.rewards?.tier || 'Bronze'}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="bg-base-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-base-content/50">{label}</p>
                  <p className="text-lg font-black text-base-content">{value}</p>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-base-content/70"><Phone size={13} className="text-primary shrink-0" />{driver.phone || '—'}</div>
              <div className="flex items-center gap-2 text-base-content/70"><Mail size={13} className="text-primary shrink-0" />{driver.email || '—'}</div>
            </div>

            {/* KYC Details */}
            <div className="card p-4">
              <p className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-3">KYC Summary</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'Aadhaar',  value: driver.kyc?.aadhaarLast4 ? `XXXX XXXX ${driver.kyc.aadhaarLast4}` : '—' },
                  { label: 'DL Number',value: driver.kyc?.drivingLicenceNumber || '—' },
                  { label: 'DL Expiry',value: driver.kyc?.drivingLicenceExpiry ? new Date(driver.kyc.drivingLicenceExpiry).toLocaleDateString() : '—' },
                  { label: 'PAN',      value: driver.kyc?.panNumber ? '••••••••••' : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-base-200 rounded-lg p-2">
                    <p className="text-base-content/50">{label}</p>
                    <p className="font-semibold text-base-content font-mono">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Shift */}
            <div className="card p-4">
              <p className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-3">Shift</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge badge-primary">{driver.shift?.shiftType}</span>
                <span className="text-base-content/60">{driver.shift?.startTime} – {driver.shift?.endTime}</span>
                <div className="flex gap-1">
                  {DAYS.map((d) => (
                    <span key={d} className={`px-1.5 py-0.5 rounded text-xs font-bold ${driver.shift?.daysAvailable?.includes(d) ? 'bg-primary/10 text-primary' : 'bg-base-200 text-base-content/30'}`}>{d}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Mini chart */}
            {driverPerformance && (
              <div className="card p-4">
                <p className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-3">Recent Performance</p>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={DUMMY_PERF_TREND}>
                    <defs>
                      <linearGradient id="ridGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="rides" stroke="var(--primary)" fill="url(#ridGrad)" strokeWidth={2} dot={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-base-content/40 text-sm">Driver not found</div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAUSE MODAL
// ══════════════════════════════════════════════════════════════════════════════

const PauseModal = ({ driver, onClose, onConfirm }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.transportPartner);
  const [reason, setReason] = useState('');
  const [until, setUntil]   = useState('');

  const handleConfirm = async () => {
    const res = await dispatch(pauseTPDriver({
      driverId: driver._id,
      pauseReason: reason,
      pausedUntil: until || null,
    }));
    if (pauseTPDriver.fulfilled.match(res)) { onConfirm?.(); onClose(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="card w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-warning/10 rounded-xl text-warning"><Pause size={15} /></div>
          <div>
            <h3 className="font-black text-base-content">Pause Driver</h3>
            <p className="text-xs text-base-content/50">{driver.legalName || driver.user?.name}</p>
          </div>
        </div>
        <div className="alert alert-warning text-xs"><AlertTriangle size={13} />Paused drivers cannot receive new trip assignments until unpaused.</div>
        <Field label="Pause Reason" hint="Reason visible in driver logs">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Document renewal pending" />
        </Field>
        <Field label="Resume Date" hint="Leave blank to pause indefinitely">
          <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
        </Field>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleConfirm} disabled={loading}
            className="btn-primary-cta px-4 py-2 text-sm bg-warning flex items-center gap-1.5 disabled:opacity-60">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />} Pause Driver
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TAB
// ══════════════════════════════════════════════════════════════════════════════

const PerformanceTab = ({ drivers }) => {
  const [selectedId, setSelectedId] = useState(drivers[0]?._id || null);
  const dispatch = useDispatch();
  const { driverPerformance, driverDetail } = useSelector((s) => s.transportPartner);

  useEffect(() => {
    if (selectedId) {
      dispatch(fetchTPDriverById(selectedId));
      dispatch(fetchTPDriverPerformance(selectedId));
    }
  }, [selectedId, dispatch]);

  const driver = driverDetail;
  const perf   = driver?.performance;

  const COLORS = ['var(--primary)', 'var(--secondary)', 'var(--success)', 'var(--warning)', 'var(--error)', 'var(--accent)'];

  const tierData = Object.entries(
    drivers.reduce((acc, d) => {
      const t = d.rewards?.tier || 'Bronze';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const statusData = Object.entries(
    drivers.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const topDrivers = [...drivers]
    .sort((a, b) => (b.performance?.rating || 0) - (a.performance?.rating || 0))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Fleet overview charts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users}  label="Total Drivers" value={drivers.length} color="primary" />
        <StatCard icon={Activity} label="Available Now" value={drivers.filter((d) => d.status === 'Available').length} color="success" />
        <StatCard icon={Star} label="Avg Rating" value={(drivers.reduce((a, d) => a + (d.performance?.rating || 0), 0) / (drivers.length || 1)).toFixed(1)} color="warning" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Status distribution */}
        <div className="card p-4">
          <p className="text-sm font-black text-base-content mb-4">Status Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tier distribution */}
        <div className="card p-4">
          <p className="text-sm font-black text-base-content mb-4">Reward Tier Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={tierData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--base-300)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top performers */}
      <div className="card p-5">
        <p className="text-sm font-black text-base-content mb-4">Top Rated Drivers</p>
        <div className="flex flex-col gap-2">
          {topDrivers.map((d, i) => (
            <div key={d._id} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-amber-600 text-white' : 'bg-base-200 text-base-content/60'}`}>{i + 1}</span>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-base-200 shrink-0">
                {d.user?.avatar ? <img src={d.user.avatar} className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-base-content/40">{(d.legalName || 'D')[0]}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-content truncate">{d.legalName || d.user?.name || 'Driver'}</p>
                <p className="text-xs text-base-content/50">{d.performance?.totalRidesCompleted || 0} rides</p>
              </div>
              <div className="flex items-center gap-1 text-warning font-bold text-sm shrink-0">
                <Star size={12} fill="currentColor" />
                {d.performance?.rating?.toFixed(1) || '0.0'}
              </div>
            </div>
          ))}
          {topDrivers.length === 0 && <p className="text-sm text-base-content/40 text-center py-4">No driver data yet</p>}
        </div>
      </div>

      {/* Per-driver deep dive */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-black text-base-content">Driver Deep Dive</p>
          <Select value={selectedId || ''} onChange={(e) => setSelectedId(e.target.value)} className="w-52 text-xs">
            {drivers.map((d) => <option key={d._id} value={d._id}>{d.legalName || d.user?.name || d.driverCode}</option>)}
          </Select>
        </div>

        {driver && perf ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Completed', value: perf.totalRidesCompleted, icon: CheckCircle2, color: 'success' },
                { label: 'Cancelled', value: perf.totalRidesCancelled, icon: XCircle, color: 'error' },
                { label: 'Avg Pickup', value: `${perf.avgPickupTimeMinutes || 0}m`, icon: Clock, color: 'info' },
                { label: 'Total km', value: perf.totalDistanceKm || 0, icon: Route, color: 'primary' },
              ].map(({ label, value, icon: Ic, color }) => (
                <div key={label} className={`bg-${color}/10 rounded-xl p-3 text-center`}>
                  <Ic size={16} className={`mx-auto mb-1 text-${color}`} />
                  <p className="text-lg font-black text-base-content">{value}</p>
                  <p className="text-xs text-base-content/50">{label}</p>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={DUMMY_PERF_TREND}>
                <defs>
                  <linearGradient id="earGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--base-300)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`₹${v}`, 'Earnings']} />
                <Area type="monotone" dataKey="earnings" stroke="var(--success)" fill="url(#earGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-8 text-center text-base-content/40 text-sm">Select a driver to view detailed analytics</div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function DriverManagement() {
  const dispatch = useDispatch();
  const { drivers, driverTotal, loading, error } = useSelector((s) => s.transportPartner);

  const [activeTab,  setActiveTab]  = useState(TAB_ALL);
  const [viewMode,   setViewMode]   = useState('grid'); // 'grid' | 'list'
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kycFilter,  setKycFilter]  = useState('');
  const [page,       setPage]       = useState(1);
  const LIMIT = 12;

  const [viewId,     setViewId]     = useState(null);
  const [editDriver, setEditDriver] = useState(null);
  const [pauseDriver,setPauseDriver]= useState(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const searchRef = useRef();
  const debouncedSearch = useRef(null);

  const loadDrivers = useCallback(() => {
    const params = { page, limit: LIMIT };
    if (statusFilter) params.status = statusFilter;
    dispatch(fetchTPDrivers(params));
  }, [dispatch, page, statusFilter]);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(debouncedSearch.current);
    debouncedSearch.current = setTimeout(() => setPage(1), 400);
  };

  const handleToggle = async (driverId) => {
    await dispatch(toggleTPDriverActive(driverId));
    loadDrivers();
  };

  const handleUnpause = async (driverId) => {
    await dispatch(unpauseTPDriver(driverId));
    loadDrivers();
  };

  const handleRemove = async (driverId) => {
    if (!window.confirm('Remove this driver from your agency? This action cannot be undone.')) return;
    await dispatch(removeTPDriver(driverId));
    loadDrivers();
  };

  // Filtered drivers (client-side search + kycFilter on top of server-side status)
  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch = !q || [d.legalName, d.driverCode, d.phone, d.email, d.user?.name, d.user?.email].some((v) => v?.toLowerCase().includes(q));
    const matchKyc = !kycFilter || d.kyc?.verificationStatus === kycFilter;
    return matchSearch && matchKyc;
  });

  const totalPages = Math.ceil(driverTotal / LIMIT);

  const tabs = [
    { id: TAB_ALL,  label: 'All Drivers',      icon: Users,    count: driverTotal },
    { id: TAB_ADD,  label: 'Add Driver',        icon: UserPlus },
    { id: TAB_PERF, label: 'Performance',       icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-base-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="section-heading !text-3xl md:!text-4xl">Driver Management</h1>
            <p className="section-subheading !text-sm !mb-0">
              Manage your fleet's drivers — onboard, track, and analyse performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={loadDrivers}
              className="p-2.5 rounded-xl border border-base-300 hover:bg-base-200 transition-colors text-base-content/60">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setActiveTab(TAB_ADD)}
              className="btn-primary-cta px-4 py-2 text-xs flex items-center gap-1.5">
              <UserPlus size={13} /> Add Driver
            </motion.button>
          </div>
        </motion.div>

        {/* ── Quick Stats ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users}   label="Total Drivers"  value={driverTotal} color="primary" />
          <StatCard icon={Activity} label="Available"    value={drivers.filter((d) => d.status === 'Available').length} color="success" />
          <StatCard icon={Gauge}   label="On Trip"       value={drivers.filter((d) => d.status === 'On-Trip').length} color="info" />
          <StatCard icon={ShieldCheck} label="KYC Verified" value={drivers.filter((d) => d.kyc?.verificationStatus === 'Verified').length} color="warning" />
        </motion.div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-base-200 p-1 rounded-2xl w-full sm:w-fit">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <motion.button
              key={id} whileTap={{ scale: 0.96 }}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === id ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
            >
              <Icon size={14} />
              {label}
              {count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${activeTab === id ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content/50'}`}>
                  {count}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* ── Add Driver success banner ────────────────────────────────────── */}
        <AnimatePresence>
          {addSuccess && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="alert alert-success text-sm font-semibold">
              <CheckCircle2 size={16} />
              Driver registered successfully! Welcome email sent.
              <button onClick={() => setAddSuccess(false)} className="ml-auto"><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TAB: All Drivers ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === TAB_ALL && (
            <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex  max-md:flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-sm md:min-w-md w-full">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                  <Input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search by name, code, phone…"
                    className="pl-9 text-sm"
                  />
                  {search && (
                    <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Status filter */}
                <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="text-sm w-36">
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>

                {/* KYC filter */}
                <Select value={kycFilter} onChange={(e) => setKycFilter(e.target.value)} className="text-sm w-36">
                  <option value="">All KYC</option>
                  {['Pending', 'Under-Review', 'Verified', 'Rejected'].map((k) => <option key={k} value={k}>{k}</option>)}
                </Select>

                {/* View toggle */}
                <div className="flex bg-base-200 rounded-xl p-1 gap-1">
                  {[['grid', Grid3X3], ['list', List]].map(([m, Icon]) => (
                    <button key={m} onClick={() => setViewMode(m)}
                      className={`p-2 rounded-lg transition-colors ${viewMode === m ? 'bg-base-100 shadow text-primary' : 'text-base-content/40 hover:text-base-content'}`}>
                      <Icon size={14} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Results count */}
              {(search || statusFilter || kycFilter) && (
                <p className="text-xs text-base-content/50">
                  Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''} for current filters
                </p>
              )}

              {/* Grid / List */}
              {loading ? (
                <div className={viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'flex flex-col gap-2'}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`skeleton ${viewMode === 'grid' ? 'h-52' : 'h-14'}`} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <Users size={40} className="mx-auto text-base-content/20 mb-3" />
                  <p className="text-base-content/40 font-semibold">No drivers found</p>
                  <p className="text-base-content/30 text-sm mt-1">Try adjusting filters or add a new driver</p>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setActiveTab(TAB_ADD)}
                    className="btn-primary-cta px-5 py-2 text-sm mt-4 inline-flex items-center gap-2">
                    <UserPlus size={13} /> Add First Driver
                  </motion.button>
                </div>
              ) : (
                <AnimatePresence>
                  <div className={viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                    : 'flex flex-col gap-2'}>
                    {filtered.map((d) => (
                      <DriverCard
                        key={d._id}
                        driver={d}
                        viewMode={viewMode}
                        onView={(dr) => setViewId(dr._id)}
                        onEdit={(dr) => setEditDriver(dr)}
                        onToggle={handleToggle}
                        onPause={(dr) => setPauseDriver(dr)}
                        onUnpause={handleUnpause}
                        onRemove={handleRemove}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <motion.button whileTap={{ scale: 0.9 }} disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-2 rounded-xl border border-base-300 hover:bg-base-200 disabled:opacity-40 transition-colors">
                    <ChevronLeft size={14} />
                  </motion.button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page + i - 2;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <motion.button key={p} whileTap={{ scale: 0.9 }} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-xl text-sm font-bold transition-colors ${page === p ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/60'}`}>
                        {p}
                      </motion.button>
                    );
                  })}
                  <motion.button whileTap={{ scale: 0.9 }} disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 rounded-xl border border-base-300 hover:bg-base-200 disabled:opacity-40 transition-colors">
                    <ChevronRight size={14} />
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── TAB: Add Driver ──────────────────────────────────────────── */}
          {activeTab === TAB_ADD && (
            <motion.div key="add" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="card p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-black text-xl text-base-content">Register New Driver</h2>
                    <p className="text-sm text-base-content/50 mt-0.5">Complete all steps to onboard a driver and grant access</p>
                  </div>
                  <button onClick={() => setActiveTab(TAB_ALL)} className="p-2 rounded-xl hover:bg-base-200 transition-colors text-base-content/50">
                    <X size={16} />
                  </button>
                </div>
                <AddDriverForm
                  onSuccess={() => {
                    setAddSuccess(true);
                    setActiveTab(TAB_ALL);
                    loadDrivers();
                    setTimeout(() => setAddSuccess(false), 5000);
                  }}
                  onCancel={() => setActiveTab(TAB_ALL)}
                />
              </div>
            </motion.div>
          )}

          {/* ── TAB: Performance ────────────────────────────────────────── */}
          {activeTab === TAB_PERF && (
            <motion.div key="perf" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {drivers.length === 0 ? (
                <div className="py-20 text-center">
                  <BarChart3 size={40} className="mx-auto text-base-content/20 mb-3" />
                  <p className="text-base-content/40 font-semibold">No driver data yet</p>
                  <p className="text-base-content/30 text-sm mt-1">Add drivers first to see performance analytics</p>
                </div>
              ) : (
                <PerformanceTab drivers={drivers} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {viewId && (
          <DriverDetailModal
            key="view"
            driverId={viewId}
            onClose={() => setViewId(null)}
          />
        )}
        {editDriver && (
          <EditDriverModal
            key="edit"
            driver={editDriver}
            onClose={() => setEditDriver(null)}
            onSave={loadDrivers}
          />
        )}
        {pauseDriver && (
          <PauseModal
            key="pause"
            driver={pauseDriver}
            onClose={() => setPauseDriver(null)}
            onConfirm={loadDrivers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}