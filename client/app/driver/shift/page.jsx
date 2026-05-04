'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Wifi,
  WifiOff,
  Coffee,
  Car,
  Clock,
  Calendar,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sun,
  Moon,
  Sunset,
  Zap,
  Radio,
  MapPin,
  Timer,
  RefreshCw,
  Shield,
  Activity,
} from 'lucide-react';
import {
  updateDriverStatus,
  updateDriverShift,
  fetchDriverMe,
  fetchDriverCompliance,
} from '@/store/slices/transportPartnerSlice';

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Available: {
    label:  'Available',
    icon:   Wifi,
    color:  'text-success',
    bg:     'bg-success/10',
    border: 'border-success/40',
    dot:    'bg-success',
    pulse:  true,
  },
  Offline: {
    label:  'Offline',
    icon:   WifiOff,
    color:  'text-base-content/40',
    bg:     'bg-base-200',
    border: 'border-base-300',
    dot:    'bg-base-content/30',
    pulse:  false,
  },
  'On-Break': {
    label:  'On Break',
    icon:   Coffee,
    color:  'text-warning',
    bg:     'bg-warning/10',
    border: 'border-warning/30',
    dot:    'bg-warning',
    pulse:  false,
  },
  'On-Trip': {
    label:  'On Trip',
    icon:   Car,
    color:  'text-info',
    bg:     'bg-info/10',
    border: 'border-info/30',
    dot:    'bg-info',
    pulse:  true,
  },
};

const DRIVER_STATUSES = ['Available', 'Offline', 'On-Break'];

// ─── SHIFT TYPES ──────────────────────────────────────────────────────────────
const SHIFT_TYPES = [
  { id: 'Morning',   label: 'Morning',   icon: Sun,     time: '6 AM – 2 PM',  color: 'text-warning' },
  { id: 'Afternoon', label: 'Afternoon', icon: Sunset,  time: '2 PM – 10 PM', color: 'text-accent'  },
  { id: 'Evening',   label: 'Evening',   icon: Sunset,  time: '4 PM – 12 AM', color: 'text-primary' },
  { id: 'Night',     label: 'Night',     icon: Moon,    time: '10 PM – 6 AM', color: 'text-info'    },
  { id: 'Full-Day',  label: 'Full Day',  icon: Zap,     time: 'All Day',      color: 'text-success' },
  { id: 'On-Call',   label: 'On Call',   icon: Radio,   time: 'Flexible',     color: 'text-error'   },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function PulseDot({ color, pulse }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {pulse && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

function SectionCard({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`card p-3 md:p-6  mb-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div>
        <h3 className="font-display font-bold text-sm text-base-content">{title}</h3>
        {subtitle && <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function CompliancePill({ label, status }) {
  const color =
    status === 'valid'         ? 'text-success border-success/30 bg-success/10' :
    status === 'expiring_soon' ? 'text-warning border-warning/30 bg-warning/10' :
    status === 'expired'       ? 'text-error border-error/30 bg-error/10'       :
                                 'text-base-content/40 border-base-300 bg-base-200';

  const label2 =
    status === 'valid'         ? 'Valid'   :
    status === 'expiring_soon' ? 'Expiring':
    status === 'expired'       ? 'Expired' : 'Missing';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {label}: {label2}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ShiftStatus() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const { driverMe, driverCompliance, loading } = useSelector((s) => s.transportPartner);

  // ── Local state ────────────────────────────────────────────────────────────
  const [statusLoading, setStatusLoading] = useState(null); // which status is being set
  const [shiftForm, setShiftForm] = useState({
    shiftType:      'Full-Day',
    startTime:      '08:00',
    endTime:        '20:00',
    daysAvailable:  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    isAvailableNow: false,
  });
  const [shiftSaving, setShiftSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchDriverMe());
    dispatch(fetchDriverCompliance());
  }, [dispatch]);

  // ── Hydrate shift form ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!driverMe?.shift) return;
    const s = driverMe.shift;
    setShiftForm({
      shiftType:      s.shiftType      || 'Full-Day',
      startTime:      s.startTime      || '08:00',
      endTime:        s.endTime        || '20:00',
      daysAvailable:  Array.isArray(s.daysAvailable) ? s.daysAvailable : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      isAvailableNow: s.isAvailableNow || false,
    });
  }, [driverMe]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentStatus = driverMe?.status || 'Offline';
  const statusCfg     = STATUS_CFG[currentStatus] || STATUS_CFG.Offline;
  const isOnTrip      = currentStatus === 'On-Trip';
  const compliance    = driverCompliance || null;

  const isBlocked  = driverMe?.isBlocked  || false;
  const isPaused   = driverMe?.isPaused   || false;
  const isVerified = driverMe?.isVerified || false;

  const canChangeStatus = !isBlocked && !isPaused && isVerified && !isOnTrip;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSetStatus = async (status) => {
    if (!canChangeStatus || status === currentStatus) return;
    setStatusLoading(status);
    await dispatch(updateDriverStatus({ status }));
    setStatusLoading(null);
  };

  const toggleDay = (day) => {
    setShiftForm((f) => ({
      ...f,
      daysAvailable: f.daysAvailable.includes(day)
        ? f.daysAvailable.filter((d) => d !== day)
        : [...f.daysAvailable, day],
    }));
  };

  const handleShiftSave = async () => {
    setShiftSaving(true);
    await dispatch(updateDriverShift(shiftForm));
    setShiftSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleToggleAvailableNow = () => {
    const next = { ...shiftForm, isAvailableNow: !shiftForm.isAvailableNow };
    setShiftForm(next);
    dispatch(updateDriverShift({ isAvailableNow: next.isAvailableNow }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div data-theme="driver" className="min-h-screen bg-base-100">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm gap-1.5 mb-4 -ml-2 text-base-content/60 hover:text-base-content"
          >
            <ChevronLeft size={16} />
            Go Back
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Activity size={22} className="text-primary" />
            </div>
            <div>
              <h1 className=" font-poppins  text-2xl md:text-3xl text-base-content tracking-tight">
                Shift &amp; Status
              </h1>
              <p className="text-xs md:text-sm text-base-content/50 mt-0.5">
                Control your availability and manage your working hours.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Account Guard Banners ─────────────────────────────────────── */}
        <AnimatePresence>
          {isBlocked && (
            <motion.div
              key="blocked"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex items-start gap-3 p-4 px-2 md:px-4 rounded-2xl bg-error/10 border border-error/30 mb-4"
            >
              <Shield size={18} className="text-error mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-error">Account Blocked</p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  {driverMe?.blockReason || 'Contact your agency or admin to resolve.'}
                </p>
              </div>
            </motion.div>
          )}

          {isPaused && !isBlocked && (
            <motion.div
              key="paused"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex items-start gap-3 p-4 px-2 md:px-4 rounded-2xl bg-warning/10 border border-warning/30 mb-4"
            >
              <AlertTriangle size={18} className="text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-warning">Account Paused</p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  {driverMe?.pauseReason || 'Account is temporarily paused by your agency.'}
                  {driverMe?.pausedUntil && (
                    <> Until: {new Date(driverMe.pausedUntil).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </motion.div>
          )}

          {!isVerified && !isBlocked && !isPaused && (
            <motion.div
              key="unverified"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex items-start gap-3 p-4 px-2 md:px-4 rounded-2xl bg-info/10 border border-info/30 mb-4"
            >
              <AlertTriangle size={18} className="text-info mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-info">KYC Not Verified</p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Complete KYC verification before going Available.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Current Status Hero Card ──────────────────────────────────── */}
        <SectionCard>
          {/* Current status display */}
          <div className={`flex items-center justify-between p-4 px-2 md:px-4 rounded-xl border mb-5 ${statusCfg.bg} ${statusCfg.border}`}>
            <div className="flex items-center gap-3">
              <PulseDot color={statusCfg.dot} pulse={statusCfg.pulse} />
              <div>
                <p className="text-xs text-base-content/50 font-medium uppercase tracking-wider">
                  Current Status
                </p>
                <p className={`   text-md ${statusCfg.color}`}>
                  {statusCfg.label}
                </p>
              </div>
            </div>
            {(() => {
              const Icon = statusCfg.icon;
              return <Icon size={28} className={`${statusCfg.color} opacity-50`} />;
            })()}
          </div>

          {/* Compliance pills row */}
          {compliance && (
            <div className="flex flex-wrap gap-2 mb-5">
              <CompliancePill label="DL"      status={compliance.drivingLicence?.status} />
              <CompliancePill label="PSV"     status={compliance.psvBadge?.status} />
              <CompliancePill label="Medical" status={compliance.medicalFitness?.status} />
            </div>
          )}

          {/* Status selector */}
          <SectionLabel icon={Wifi} title="Set Status" subtitle="Tap to change your availability" />

          {isOnTrip && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-info/10 border border-info/30 mb-4 text-xs text-info font-semibold">
              <Car size={13} />
              Currently on a trip — status locked until trip ends.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {DRIVER_STATUSES.map((s) => {
              const cfg     = STATUS_CFG[s];
              const Icon    = cfg.icon;
              const active  = currentStatus === s;
              const busy    = statusLoading === s;

              return (
                <motion.button
                  key={s}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSetStatus(s)}
                  disabled={!canChangeStatus || busy || loading}
                  className={`
                    relative flex flex-col items-center gap-2 p-4 px-2 md:px-4 rounded-xl border text-center
                    transition-all duration-200 cursor-pointer
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${active
                      ? `${cfg.bg} ${cfg.border} ${cfg.color} shadow-sm`
                      : 'bg-base-200 border-base-300 text-base-content/50 hover:border-primary/30 hover:text-base-content'}
                  `}
                >
                  {active && (
                    <motion.div
                      layoutId="status-active"
                      className={`absolute inset-0 rounded-xl ${cfg.bg} border ${cfg.border}`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">
                    {busy
                      ? <Loader2 size={20} className="animate-spin" />
                      : <Icon size={20} />
                    }
                  </span>
                  <span className="relative z-10 text-xs font-bold">{cfg.label}</span>
                  {active && (
                    <span className="relative z-10">
                                   <PulseDot color={statusCfg.dot} pulse={statusCfg.pulse} />

                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Available now quick toggle */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-base-300">
            <div>
              <p className="text-sm font-bold text-base-content">Available Right Now</p>
              <p className="text-xs text-base-content/50 mt-0.5">
                Instantly accept incoming ride requests
              </p>
            </div>
          <button
  type="button"
  onClick={handleToggleAvailableNow}
  disabled={!canChangeStatus}
  className={`
    relative inline-flex h-7 w-13 items-center rounded-full transition-colors focus:outline-none
    disabled:opacity-40 disabled:cursor-not-allowed
    ${shiftForm.isAvailableNow ? 'bg-success' : 'bg-base-content/20'}
  `}
>
  <span className="sr-only">Toggle availability</span>
  <span
    className={`
      inline-block h-5 w-5 transform rounded-full bg-white transition-transform
      ${shiftForm.isAvailableNow ? 'translate-x-7' : 'translate-x-1'}
    `}
  />
</button>
          </div>
        </SectionCard>

        {/* ── Shift Type ────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionLabel
            icon={Clock}
            title="Shift Type"
            subtitle="Choose your primary working pattern"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SHIFT_TYPES.map((st) => {
              const Icon   = st.icon;
              const active = shiftForm.shiftType === st.id;
              return (
                <motion.button
                  key={st.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShiftForm((f) => ({ ...f, shiftType: st.id }))}
                  className={`
                    flex flex-col items-start gap-1.5 p-3.5 rounded-xl border text-left
                    transition-all duration-200
                    ${active
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-base-200 border-base-300 text-base-content/60 hover:border-primary/20'}
                  `}
                >
                  <Icon size={16} className={active ? 'text-primary' : st.color} />
                  <span className="text-xs font-bold leading-tight">{st.label}</span>
                  <span className="text-xs opacity-60 leading-tight">{st.time}</span>
                </motion.button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Shift Hours ───────────────────────────────────────────────── */}
        <SectionCard>
          <SectionLabel
            icon={Timer}
            title="Working Hours"
            subtitle="Set your daily start and end time"
          />

          <div className="grid grid-cols-2 gap-4 px-2 md:px-4">
            <div>
              <label className="label"><span className="label-text">Start Time</span></label>
              <input
                type="time"
                value={shiftForm.startTime}
                onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="label"><span className="label-text">End Time</span></label>
              <input
                type="time"
                value={shiftForm.endTime}
                onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                className="input-field w-full"
              />
            </div>
          </div>

          {/* Duration badge */}
          {shiftForm.startTime && shiftForm.endTime && (() => {
            const [sh, sm] = shiftForm.startTime.split(':').map(Number);
            const [eh, em] = shiftForm.endTime.split(':').map(Number);
            let mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins < 0) mins += 1440;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-primary font-semibold">
                <Timer size={12} />
                Shift duration: {h}h {m > 0 ? `${m}m` : ''}
              </div>
            );
          })()}
        </SectionCard>

        {/* ── Days Available ────────────────────────────────────────────── */}
        <SectionCard>
          <SectionLabel
            icon={Calendar}
            title="Days Available"
            subtitle="Select which days you work"
          />

          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day) => {
              const active = shiftForm.daysAvailable.includes(day);
              return (
                <motion.button
                  key={day}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => toggleDay(day)}
                  className={`
                    w-12 h-12 rounded-xl text-xs font-bold border   transition-all duration-200
                    ${active
                      ? 'bg-primary text-primary-content  scale-105  shadow-sm'
                      : 'bg-base-200 text-base-content/50 border-base-300  hover:border-primary/30'}
                  `}
                >
                  {day}
                </motion.button>
              );
            })}
          </div>

          <p className="text-xs text-base-content/40 mt-3">
            {shiftForm.daysAvailable.length === 0
              ? 'No days selected'
              : `${shiftForm.daysAvailable.length} day${shiftForm.daysAvailable.length > 1 ? 's' : ''} selected`}
          </p>
        </SectionCard>

        {/* ── Next Available At ─────────────────────────────────────────── */}
        <SectionCard>
          <SectionLabel
            icon={MapPin}
            title="Next Available At"
            subtitle="Optionally schedule when you'll be back online"
          />

          <input
            type="datetime-local"
            onChange={(e) =>
              dispatch(updateDriverShift({ nextAvailableAt: e.target.value }))
            }
            className="input-field w-full"
            defaultValue={
              driverMe?.shift?.nextAvailableAt
                ? new Date(driverMe.shift.nextAvailableAt).toISOString().slice(0, 16)
                : ''
            }
          />
          <p className="text-xs text-base-content/40 mt-2">
            Leave blank if you have no planned return time.
          </p>
        </SectionCard>

        {/* ── Save Button ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between gap-4 px-2 md:px-4 pb-8"
        >
          <p className="text-xs text-base-content/40">
            Changes to shift schedule take effect immediately.
          </p>

          <button
            type="button"
            onClick={handleShiftSave}
            disabled={shiftSaving || loading}
            className="btn btn-primary gap-2 min-w-[160px]"
          >
            <AnimatePresence mode="wait">
              {shiftSaving ? (
                <motion.span key="saving" className="flex items-center gap-2"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 size={15} className="animate-spin" />
                  Saving…
                </motion.span>
              ) : saved ? (
                <motion.span key="saved" className="flex items-center gap-2"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <CheckCircle2 size={15} />
                  Saved!
                </motion.span>
              ) : (
                <motion.span key="idle" className="flex items-center gap-2"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <RefreshCw size={15} />
                  Save Shift
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>

      </div>
    </div>
  );
}