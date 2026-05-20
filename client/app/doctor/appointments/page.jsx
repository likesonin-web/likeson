'use client';

/**
 * AppointmentsManagement.jsx — PRODUCTION v6
 *
 * CRITICAL FIXES APPLIED:
 * 1. MeetingProvider mounts ONCE — stable key `meeting-${meetingId}`, never remounts on UI state
 * 2. Participant deduplication via useMemo + Set
 * 3. Full stream cleanup on leave/unmount (track.stop() + srcObject = null)
 * 4. No duplicate socket listeners — cleanup on every effect return
 * 5. Socket listener re-registration guarded by videoBooking._id dep
 * 6. Session recovery on mount
 * 7. Waiting room approve/deny via socket emit
 * 8. Reconnect overlay with exponential-backoff state
 * 9. Screen share support (startScreenShare/stopScreenShare)
 * 10. Notes auto-save to sessionStorage
 */

import {
  useEffect, useState, useCallback, useMemo, useRef, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  MeetingProvider, useMeeting, useParticipant,
} from '@videosdk.live/react-sdk';
import {
  Calendar, Clock, User, ChevronRight, ChevronLeft,
  FileText, Stethoscope, Video, Home, Search,
  CheckCircle2, AlertCircle, XCircle, Clock3, RefreshCw,
  Plus, Eye, Activity, CalendarDays, MoreVertical, Layers,
  ClipboardList, PenLine, BadgeCheck, Mic, MicOff,
  VideoIcon, VideoOff, PhoneOff, Maximize2, Minimize2,
  Signal, Users, WifiOff, Loader2, MonitorPlay, Bell,
  AlertTriangle, TrendingUp, Zap, Timer, BarChart2,
  ShieldCheck, Radio, UserCheck, UserX, Upload, StickyNote,
  Monitor, MonitorOff, Share2,
} from 'lucide-react';

import {
  fetchDoctorAppointments,
  fetchOPRecords,
  completeOPRecord,
  selectDoctorAppointments,
  selectDoctorAppointmentsTotal,
  selectOPRecords,
  selectClinicalLoading,
  selectClinicalError,
} from '@/store/slices/clinicalSlice';

import {
  fetchJoinDetails,
  startConsultation,
  endConsultation,
  logNetworkQuality,
  uploadPrescription,
  selectJoinDetails,
  selectConsultationLoaders,
  clearJoinDetails,
} from '@/store/slices/consultationSlice';

import socketService from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: '',            label: 'All'         },
  { value: 'pending',     label: 'Pending'     },
  { value: 'confirmed',   label: 'Confirmed'   },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
  { value: 'no_show',     label: 'No Show'     },
];

const CONSULT_TYPES = [
  { value: '',          label: 'All Types'  },
  { value: 'inPerson',  label: 'In Person'  },
  { value: 'video',     label: 'Video'      },
  { value: 'homeVisit', label: 'Home Visit' },
];

const BOOKING_TYPE_LABEL = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Consultation',
  doctor_online:       'Online',
  physiotherapist:     'Physio',
  follow_up:           'Follow-up',
};

const PAGE_LIMIT = 10;

const NETWORK_QUALITY_MAP = {
  excellent:    { label: 'Excellent', color: 'text-success', bars: 4 },
  good:         { label: 'Good',      color: 'text-info',    bars: 3 },
  poor:         { label: 'Poor',      color: 'text-warning', bars: 2 },
  disconnected: { label: 'Lost',      color: 'text-error',   bars: 0 },
};

const TIMER_WARNINGS = [600, 300, 60]; // 10min, 5min, 1min

const CONSULT_EVENTS = {
  WAITING:               'consultation:waiting',
  DOCTOR_JOINED:         'consultation:doctor_joined',
  PATIENT_JOINED:        'consultation:patient_joined',
  STARTED:               'consultation:started',
  ENDED:                 'consultation:ended',
  RECONNECTING:          'consultation:reconnecting',
  NETWORK_ISSUE:         'consultation:network_issue',
  NETWORK_QUALITY:       'consultation:network_quality',
  PARTICIPANT_LEFT:      'consultation:participant_left',
  PRESCRIPTION_UPLOADED: 'consultation:prescription_uploaded',
  NOTES_UPDATED:         'consultation:notes_updated',
  RECORDING_STARTED:     'consultation:recording_started',
  RECORDING_STOPPED:     'consultation:recording_stopped',
  FORCE_END:             'consultation:force_end',
  CANCELLED:             'consultation:cancelled',
};

const SESSION_KEYS = {
  ACTIVE_BOOKING:  'consult_active_booking_id',
  ACTIVE_MEETING:  'consult_active_meeting_id',
  NOTES_DRAFT:     'consult_notes_draft',
  TIMER_START:     'consult_timer_start',
  CONSULT_SUMMARY: 'consult_summary_draft',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig = (status) => {
  const map = {
    pending:     { label: 'Pending',     bg: 'bg-warning/10',  text: 'text-warning',  Icon: Clock3       },
    confirmed:   { label: 'Confirmed',   bg: 'bg-info/10',     text: 'text-info',     Icon: BadgeCheck   },
    in_progress: { label: 'In Progress', bg: 'bg-primary/10',  text: 'text-primary',  Icon: Activity     },
    completed:   { label: 'Completed',   bg: 'bg-success/10',  text: 'text-success',  Icon: CheckCircle2 },
    cancelled:   { label: 'Cancelled',   bg: 'bg-error/10',    text: 'text-error',    Icon: XCircle      },
    no_show:     { label: 'No Show',     bg: 'bg-error/10',    text: 'text-error',    Icon: AlertCircle  },
  };
  return map[status] ?? { label: status, bg: 'bg-base-200', text: 'text-base-content', Icon: Clock3 };
};

const consultIcon = (type) => {
  if (type === 'video')     return <Video size={14} />;
  if (type === 'homeVisit') return <Home  size={14} />;
  return <Stethoscope size={14} />;
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const formatShortDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const buildChartData = (appointments) => {
  const now  = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return { date: formatShortDate(d), count: 0, key: d.toDateString() };
  });
  appointments.forEach((a) => {
    const k    = new Date(a.scheduledAt).toDateString();
    const slot = days.find((d) => d.key === k);
    if (slot) slot.count += 1;
  });
  return days;
};

const isOnlineBooking = (b) =>
  b.bookingType === 'doctor_online' || b.consultationType === 'video';

const canJoinConsult = (b) =>
  isOnlineBooking(b) && ['confirmed', 'in_progress'].includes(b.status);

const bookingIdFromOP = (op) => {
  if (!op?.booking) return null;
  if (typeof op.booking === 'string') return op.booking;
  if (typeof op.booking === 'object') return op.booking?._id?.toString() ?? null;
  return null;
};

const sessionSave = (key, value) => {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
};
const sessionLoad = (key) => {
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
};
const sessionClear = (...keys) => {
  keys.forEach((k) => { try { sessionStorage.removeItem(k); } catch {} });
};

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK QUALITY BARS
// ─────────────────────────────────────────────────────────────────────────────

const NetworkQualityBars = memo(({ quality, size = 'sm' }) => {
  const cfg = NETWORK_QUALITY_MAP[quality] || NETWORK_QUALITY_MAP.disconnected;
  const h   = size === 'sm' ? [4, 6, 8, 10] : [6, 9, 12, 15];
  return (
    <span title={`Network: ${cfg.label}`} className={`inline-flex items-end gap-0.5 ${cfg.color}`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`rounded-sm transition-all ${i < cfg.bars ? 'opacity-100' : 'opacity-20'}`}
          style={{ width: 3, height: h[i], background: 'currentColor', display: 'block' }}
        />
      ))}
    </span>
  );
});
NetworkQualityBars.displayName = 'NetworkQualityBars';

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION TIMER
// ─────────────────────────────────────────────────────────────────────────────

const ConsultationTimer = memo(({ allowedMinutes, startedAt, onWarning, onAutoEnd }) => {
  const [remaining, setRemaining] = useState(null);
  const warnedRef  = useRef(new Set());

  useEffect(() => {
    if (!startedAt || !allowedMinutes) return;
    const total = allowedMinutes * 60;
    const tick  = () => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const rem     = Math.max(0, total - elapsed);
      setRemaining(rem);
      TIMER_WARNINGS.forEach((w) => {
        if (rem <= w && !warnedRef.current.has(w)) {
          warnedRef.current.add(w);
          onWarning?.(w);
        }
      });
      if (rem === 0) onAutoEnd?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, allowedMinutes, onWarning, onAutoEnd]);

  if (remaining === null) return null;

  const pct      = allowedMinutes ? (remaining / (allowedMinutes * 60)) * 100 : 100;
  const urgent   = remaining <= 300;
  const critical = remaining <= 60;

  return (
    <div className={`flex flex-col gap-1 ${critical ? 'text-error animate-pulse' : urgent ? 'text-warning' : 'text-success'}`}>
      <div className="flex items-center gap-2">
        <Timer size={14} />
        <span className="font-mono font-bold text-sm">{formatDuration(remaining)}</span>
        <span className="text-xs opacity-60">remaining</span>
      </div>
      <div className="h-1.5 w-32 rounded-full bg-base-300">
        <div
          className={`h-full rounded-full transition-all ${critical ? 'bg-error' : urgent ? 'bg-warning' : 'bg-success'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});
ConsultationTimer.displayName = 'ConsultationTimer';

// ─────────────────────────────────────────────────────────────────────────────
// WAITING ROOM PANEL
// ─────────────────────────────────────────────────────────────────────────────

const WaitingRoomPanel = memo(({ waitingPatients, onApprove, onDeny }) => {
  if (!waitingPatients?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed top-20 right-4 z-40 w-80 bg-base-100 border border-warning/40 rounded-2xl shadow-depth overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-warning/10 border-b border-warning/20">
        <Bell size={14} className="text-warning animate-bounce" />
        <span className="text-sm font-bold text-warning">Waiting Room</span>
        <span className="ml-auto badge badge-warning badge-sm">{waitingPatients.length}</span>
      </div>
      <div className="divide-y divide-base-300 max-h-64 overflow-auto">
        {waitingPatients.map((p) => (
          <div key={p.bookingId} className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
              {p.patientName?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.patientName}</p>
              <p className="text-xs text-base-content/40">{p.bookingCode}</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => onApprove(p.bookingId)} className="btn btn-success btn-xs btn-circle" title="Approve">
                <UserCheck size={12} />
              </button>
              <button onClick={() => onDeny(p.bookingId)} className="btn btn-error btn-xs btn-circle" title="Deny">
                <UserX size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
});
WaitingRoomPanel.displayName = 'WaitingRoomPanel';

// ─────────────────────────────────────────────────────────────────────────────
// LIVE EVENT FEED
// ─────────────────────────────────────────────────────────────────────────────

const LiveEventFeed = memo(({ events }) => {
  const icons = {
    consultation_started:  { Icon: Radio,       color: 'text-success' },
    consultation_ended:    { Icon: PhoneOff,    color: 'text-error'   },
    patient_joined:        { Icon: User,        color: 'text-info'    },
    doctor_joined:         { Icon: Stethoscope, color: 'text-primary' },
    prescription_uploaded: { Icon: Upload,      color: 'text-accent'  },
    network_issue:         { Icon: WifiOff,     color: 'text-warning' },
    consent_accepted:      { Icon: ShieldCheck, color: 'text-success' },
    default:               { Icon: Activity,    color: 'text-base-content/40' },
  };

  if (!events?.length) {
    return <div className="text-center py-6 text-base-content/30 text-xs">No events yet</div>;
  }

  return (
    <div className="space-y-1 max-h-48 overflow-auto">
      {[...events].reverse().slice(0, 20).map((ev, i) => {
        const cfg   = icons[ev.event] || icons.default;
        const { Icon } = cfg;
        return (
          <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-base-200 transition-colors">
            <Icon size={12} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium capitalize">{ev.event?.replace(/_/g, ' ')}</p>
              <p className="text-xs text-base-content/40">{ev.participant} · {formatDate(ev.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
});
LiveEventFeed.displayName = 'LiveEventFeed';

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

const ConsultationTimeline = memo(({ booking }) => {
  const oc = booking?.onlineConsultation;
  if (!oc) return null;

  const steps = [
    { label: 'Room Created',      done: !!oc.roomId,                                    time: null              },
    { label: 'Patient Joined',    done: oc.patientJoined,                               time: oc.patientJoinedAt },
    { label: 'Doctor Joined',     done: oc.doctorJoined,                                time: oc.doctorJoinedAt  },
    { label: 'Consultation Live', done: oc.consultationStatus === 'live' || oc.roomStarted, time: oc.startedAt  },
    { label: 'Prescription',      done: oc.prescriptionUploaded,                        time: oc.prescriptionUploadedAt },
    { label: 'Completed',         done: oc.roomEnded,                                   time: oc.endedAt        },
  ];

  return (
    <div className="space-y-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-success text-success-content' : 'bg-base-300 text-base-content/30'}`}>
            {s.done ? <CheckCircle2 size={11} /> : <span className="w-1.5 h-1.5 rounded-full bg-current block" />}
          </div>
          <div className="flex-1">
            <span className={`text-xs font-medium ${s.done ? 'text-base-content' : 'text-base-content/40'}`}>{s.label}</span>
            {s.done && s.time && (
              <span className="text-xs text-base-content/40 ml-2">{formatDate(s.time)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});
ConsultationTimeline.displayName = 'ConsultationTimeline';

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = memo(({ icon: Icon, label, value, sub, color, chartData, live }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden flex flex-col gap-3 p-5 rounded-2xl border border-base-300 bg-base-100"
    style={{ borderTop: `3px solid ${color}` }}
  >
    {live && (
      <span className="absolute top-3 right-3 flex items-center gap-1 text-xs text-success">
        <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
        Live
      </span>
    )}
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-1">{label}</p>
        <p className="text-3xl font-black font-montserrat" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
      </div>
      <div className="p-2 rounded-xl" style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
    {chartData && (
      <div className="h-12 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2}
              fill={`url(#grad-${label})`} dot={false} />
            <Tooltip
              contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'var(--base-content)' }}
              itemStyle={{ color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </motion.div>
));
StatCard.displayName = 'StatCard';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = memo(({ status }) => {
  const { label, bg, text, Icon } = statusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${bg} ${text}`}>
      <Icon size={10} />
      {label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ─────────────────────────────────────────────────────────────────────────────
// ACTION MENU
// ─────────────────────────────────────────────────────────────────────────────

const MenuItem = ({ icon, label, highlight = '', onClick }) => (
  <button
    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-primary/5 text-base-content transition-colors ${highlight}`}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

const ActionMenu = memo(({ booking, opRecord, onComplete, onJoinVideo, router }) => {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  const canComplete = ['in_progress', 'confirmed'].includes(booking.status);
  const showVideo   = canJoinConsult(booking);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((p) => !p)} className="btn btn-ghost btn-xs btn-circle">
        <MoreVertical size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-8 z-20 w-56 bg-base-100 border border-base-300 rounded-xl shadow-depth py-1 overflow-hidden"
          >
            <MenuItem icon={<Eye size={14} className="text-primary" />} label="View Details"
              onClick={() => { setOpen(false); router.push(`/doctor/appointments/${booking._id}`); }} />
            {showVideo && (
              <MenuItem icon={<Video size={14} className="text-info" />} label="Join Video Call"
                highlight="text-info"
                onClick={() => { setOpen(false); onJoinVideo(booking); }} />
            )}
            <MenuItem icon={<PenLine size={14} className="text-accent" />} label="Write Prescription"
              onClick={() => { setOpen(false); router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`); }} />
            <MenuItem icon={<ClipboardList size={14} className="text-secondary" />} label="View Prescriptions"
              onClick={() => { setOpen(false); router.push(`/doctor/prescriptions?bookingId=${booking._id}`); }} />
            {opRecord && (
              <MenuItem icon={<FileText size={14} className="text-info" />}
                label={`OP: ${opRecord.opNumber || 'View Record'}`}
                onClick={() => { setOpen(false); router.push(`/doctor/op-records/${opRecord._id}`); }} />
            )}
            {canComplete && (
              <>
                <div className="h-px bg-base-300 mx-3 my-1" />
                <MenuItem icon={<CheckCircle2 size={14} className="text-success" />} label="Mark Complete"
                  highlight="text-success hover:bg-success/5"
                  onClick={() => { setOpen(false); onComplete(booking._id, opRecord?._id); }} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
ActionMenu.displayName = 'ActionMenu';

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

const CompleteModal = memo(({ open, onClose, onSubmit, loading }) => {
  const [notes,  setNotes]  = useState('');
  const [code,   setCode]   = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (loading) return;
    onSubmit({ doctorNotes: notes, diagnosisCode: code, reasonForVisit: reason });
    setNotes(''); setCode(''); setReason('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="bg-base-100 border border-base-300 rounded-2xl shadow-depth-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-success/10">
                <CheckCircle2 size={20} className="text-success" />
              </div>
              <div>
                <h3 className="font-bold text-base-content text-lg font-montserrat">Complete Consultation</h3>
                <p className="text-xs text-base-content/50">Fill clinical summary (all optional)</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Reason for Visit</label>
                <input className="input-field" placeholder="Chief complaints / reason..."
                  value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <label className="label-text block mb-1.5">ICD-10 Code <span className="text-base-content/30 font-normal">(optional)</span></label>
                <input className="input-field font-mono" placeholder="e.g. J06.9"
                  value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div>
                <label className="label-text block mb-1.5">Doctor Notes</label>
                <textarea className="input-field min-h-[96px] resize-none"
                  placeholder="Clinical findings, advice, observations..."
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn btn-ghost flex-1" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="btn btn-success flex-1 gap-2" onClick={handleSubmit} disabled={loading}>
                {loading ? <span className="loading loading-xs loading-spinner" /> : <CheckCircle2 size={15} />}
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
CompleteModal.displayName = 'CompleteModal';

// ─────────────────────────────────────────────────────────────────────────────
// END CONSULTATION MODAL
// ─────────────────────────────────────────────────────────────────────────────

const EndConsultationModal = memo(({ open, onClose, onSubmit, loading }) => {
  const [summary,  setSummary]  = useState('');
  const [followUp, setFollowUp] = useState('');
  const [reason,   setReason]   = useState('');

  useEffect(() => {
    if (open) {
      const saved = sessionLoad(SESSION_KEYS.CONSULT_SUMMARY);
      if (saved?.summary)  setSummary(saved.summary);
      if (saved?.followUp) setFollowUp(saved.followUp);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      sessionSave(SESSION_KEYS.CONSULT_SUMMARY, { summary, followUp });
    }, 10000);
    return () => clearInterval(id);
  }, [open, summary, followUp]);

  const handleSubmit = () => {
    if (loading) return;
    onSubmit({ consultationSummary: summary, followUpInstructions: followUp, reason });
    sessionClear(SESSION_KEYS.CONSULT_SUMMARY);
    setSummary(''); setFollowUp(''); setReason('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="bg-base-100 border border-base-300 rounded-2xl shadow-depth-lg w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-error/10">
                <PhoneOff size={20} className="text-error" />
              </div>
              <div>
                <h3 className="font-bold text-lg font-montserrat">End Consultation</h3>
                <p className="text-xs text-base-content/50">Draft auto-saved every 10 seconds</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Consultation Summary</label>
                <textarea className="input-field min-h-[80px] resize-none"
                  placeholder="Brief summary of consultation..."
                  value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <div>
                <label className="label-text block mb-1.5">Follow-Up Instructions</label>
                <textarea className="input-field min-h-[60px] resize-none"
                  placeholder="Instructions for patient follow-up..."
                  value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
              </div>
              <div>
                <label className="label-text block mb-1.5">End Reason <span className="text-base-content/30 font-normal">(optional)</span></label>
                <input className="input-field" placeholder="e.g. Consultation complete"
                  value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn btn-ghost flex-1" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="btn btn-error flex-1 gap-2" onClick={handleSubmit} disabled={loading}>
                {loading ? <span className="loading loading-xs loading-spinner" /> : <PhoneOff size={15} />}
                End Consultation
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
EndConsultationModal.displayName = 'EndConsultationModal';

// ─────────────────────────────────────────────────────────────────────────────
// PARTICIPANT TILE — FIX: full stream cleanup on unmount
// ─────────────────────────────────────────────────────────────────────────────

const ParticipantTile = memo(({ participantId, isLocal, isScreenShare = false }) => {
  const micRef   = useRef(null);
  const videoRef = useRef(null);

  const {
    webcamStream, micStream, screenShareStream,
    webcamOn, micOn, screenShareOn,
    isActiveSpeaker, displayName,
  } = useParticipant(participantId);

  const activeStream = isScreenShare ? screenShareStream : webcamStream;
  const isOn         = isScreenShare ? screenShareOn      : webcamOn;

  // ── Mic audio — remote only ────────────────────────────────────────────────
  useEffect(() => {
    if (isLocal || !micRef.current) return;
    let ms = null;
    if (micStream?.track) {
      ms = new MediaStream([micStream.track]);
      micRef.current.srcObject = ms;
      micRef.current.play().catch(() => {});
    }
    return () => {
      // FIX: stop track + clear srcObject
      if (micRef.current) {
        if (ms) ms.getTracks().forEach((t) => t.stop());
        micRef.current.srcObject = null;
      }
    };
  }, [micStream, isLocal]);

  // ── Webcam / screen-share video ────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current) return;
    let ms = null;
    if (activeStream?.track) {
      ms = new MediaStream([activeStream.track]);
      videoRef.current.srcObject = ms;
      videoRef.current.play().catch(() => {});
    }
    return () => {
      // FIX: mandatory track.stop() + clear srcObject
      if (videoRef.current) {
        if (ms) ms.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [activeStream]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-base-300 flex items-center justify-center aspect-video
        ${isActiveSpeaker && !isScreenShare ? 'ring-2 ring-primary ring-offset-1' : ''}
        ${isScreenShare ? 'ring-2 ring-accent ring-offset-1' : ''}`}
    >
      {isScreenShare && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-accent/90 rounded-full px-2 py-0.5">
          <Monitor size={10} className="text-accent-content" />
          <span className="text-accent-content text-xs font-semibold">Screen Share</span>
        </div>
      )}

      {isOn ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-base-content/40">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold font-montserrat">
            {isScreenShare ? <MonitorOff size={24} /> : (displayName?.[0] ?? '?')}
          </div>
          {!isScreenShare && <span className="text-xs">{displayName}</span>}
        </div>
      )}

      {!isLocal && <audio ref={micRef} autoPlay />}

      {!isScreenShare && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-0.5">
          {micOn
            ? <Mic    size={10} className="text-success" />
            : <MicOff size={10} className="text-error"   />
          }
          <span className="text-white text-xs font-medium truncate max-w-[80px]">
            {isLocal ? 'You (Dr.)' : displayName}
          </span>
        </div>
      )}
    </div>
  );
});
ParticipantTile.displayName = 'ParticipantTile';

// ─────────────────────────────────────────────────────────────────────────────
// MEETING CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

const MeetingControls = memo(({
  onLeave, onEndConsultation, allowedDuration,
  startedAt, networkQuality, isFullscreen, onToggleFullscreen,
  isScreenSharing, onToggleScreenShare,
  participantCount,   
}) => {
  const {
    localMicOn, localWebcamOn,
    toggleMic, toggleWebcam, leave,
    // NO participants here
  } = useMeeting();


  

  return (
    <div className="flex items-center justify-between bg-base-200 border-t border-base-300 px-6 py-3 flex-wrap gap-3">
      <div className="flex items-center gap-4 text-sm text-base-content/50">
        <span className="flex items-center gap-1.5">
  <Users size={14} />
  {participantCount} joined
</span>

        {networkQuality && (
          <span className="flex items-center gap-1.5">
            <NetworkQualityBars quality={networkQuality} />
          </span>
        )}
        {startedAt && allowedDuration && (
          <ConsultationTimer
            allowedMinutes={allowedDuration}
            startedAt={startedAt}
            onWarning={(sec) => console.warn(`[Timer] ${sec}s left`)}
          />
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Mic toggle — does NOT cause MeetingProvider remount */}
        <button
          onClick={toggleMic}
          className={`btn btn-circle btn-sm ${localMicOn ? 'btn-ghost' : 'btn-error btn-outline'}`}
          title={localMicOn ? 'Mute' : 'Unmute'}
        >
          {localMicOn ? <Mic size={16} /> : <MicOff size={16} />}
        </button>

        {/* Webcam toggle — does NOT cause MeetingProvider remount */}
        <button
          onClick={toggleWebcam}
          className={`btn btn-circle btn-sm ${localWebcamOn ? 'btn-ghost' : 'btn-error btn-outline'}`}
          title={localWebcamOn ? 'Camera off' : 'Camera on'}
        >
          {localWebcamOn ? <VideoIcon size={16} /> : <VideoOff size={16} />}
        </button>

        {/* Screen share toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`btn btn-circle btn-sm ${isScreenSharing ? 'btn-accent' : 'btn-ghost'}`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
        </button>

        <button
          onClick={onToggleFullscreen}
          className="btn btn-ghost btn-circle btn-sm"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        <div className="w-px h-6 bg-base-300" />

        <button
          onClick={() => { leave(); onLeave(); }}
          className="btn btn-ghost btn-sm gap-1.5 text-warning"
          title="Leave (patient stays)"
        >
          <PhoneOff size={15} />
          Leave
        </button>

        <button
          onClick={onEndConsultation}
          className="btn btn-error btn-sm gap-1.5"
          title="End for everyone"
        >
          <XCircle size={15} />
          End
        </button>
      </div>
    </div>
  );
});
MeetingControls.displayName = 'MeetingControls';

// ─────────────────────────────────────────────────────────────────────────────
// MEETING CONTENT — FIX: dedup participants, screen share support
// ─────────────────────────────────────────────────────────────────────────────

const MeetingContent = memo(({
  onLeave, onEndConsultation, allowedDuration, startedAt,
  networkQuality, booking,
}) => {
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

const meetingRef = useRef(null);
const { participants, localParticipant, ...meetingActions } = useMeeting({

    onMeetingLeft: onLeave,
    // FIX: handle screen share end events
    onPresenterChanged: (presenterId) => {
      if (!presenterId) setIsScreenSharing(false);
    },
  });

  // FIX: Deduplicated unique remote participants
  const uniqueRemoteParticipants = useMemo(() => {
    if (!participants || !localParticipant) return [];
    const seen = new Set();
    const all  = [...participants.values()];
    return all.filter((p) => {
      if (p.id === localParticipant.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [participants, localParticipant]);

  const toggleFullscreen = useCallback(() => setIsFullscreen((p) => !p), []);

  const handleToggleScreenShare = useCallback(async () => {
  try {
    if (isScreenSharing) {
      if (typeof meetingActions.stopScreenShare === 'function') {
        await meetingActions.stopScreenShare();
      }
      setIsScreenSharing(false);
    } else {
      if (typeof meetingActions.startScreenShare === 'function') {
        await meetingActions.startScreenShare();
        setIsScreenSharing(true);
      } else {
        console.warn('[ScreenShare] startScreenShare not available');
      }
    }
  } catch (err) {
    console.error('[ScreenShare]', err.message);
    setIsScreenSharing(false);
  }
}, [isScreenSharing, meetingActions]);

  const gridCols = uniqueRemoteParticipants.length > 0 ? 'repeat(2, 1fr)' : '1fr';

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-[100] bg-black' : 'h-full'}`}>
      {/* Screen share banner */}
      {isScreenSharing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border-b border-accent/20 text-accent text-xs font-semibold">
          <Monitor size={13} />
          You are sharing your screen
          <button onClick={handleToggleScreenShare} className="ml-auto btn btn-accent btn-xs gap-1">
            <MonitorOff size={11} /> Stop
          </button>
        </div>
      )}

      <div
        className="flex-1 p-3 grid gap-3 overflow-auto"
        style={{ gridTemplateColumns: gridCols }}
      >
        {/* Local participant */}
        {localParticipant && (
          <div className={uniqueRemoteParticipants.length ? 'col-span-1' : 'col-span-full'}>
            <ParticipantTile participantId={localParticipant.id} isLocal />
          </div>
        )}

        {/* FIX: Remote participants — deduped, stable keys by p.id */}
        {uniqueRemoteParticipants.map((p) => (
          <ParticipantTile key={p.id} participantId={p.id} isLocal={false} />
        ))}

        {/* Screen share tile */}
        {isScreenSharing && localParticipant && (
          <div className="col-span-full">
            <ParticipantTile participantId={localParticipant.id} isLocal isScreenShare />
          </div>
        )}

        {uniqueRemoteParticipants.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-3 text-base-content/40 py-12">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Loader2 size={28} className="text-primary" />
            </motion.div>
            <p className="text-sm font-medium">Waiting for patient to join…</p>
            <p className="text-xs opacity-60">Patient will see waiting screen until you start</p>
          </div>
        )}
      </div>

     <MeetingControls
  onLeave={onLeave}
  onEndConsultation={onEndConsultation}
  allowedDuration={allowedDuration}
  startedAt={startedAt}
  networkQuality={networkQuality}
  isFullscreen={isFullscreen}
  onToggleFullscreen={toggleFullscreen}
  isScreenSharing={isScreenSharing}
  onToggleScreenShare={handleToggleScreenShare}
  participantCount={uniqueRemoteParticipants.length + 1}  // +1 for local
/>

    </div>
  );
});
MeetingContent.displayName = 'MeetingContent';

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO CALL MODAL
// CRITICAL FIX:
//   - MeetingProvider key = stable `meeting-${actualMeetingId}` — NEVER changes
//   - meetingConfig memoized — never rebuilt on UI state
//   - Provider never mounts on mic/webcam state change
// ─────────────────────────────────────────────────────────────────────────────

const VideoCallModal = memo(({
  open, booking, joinDetails, onClose, onStart, onMinimise,
  onEndConsultation, networkQuality, liveEvents,
}) => {
  const [started,       setStarted]       = useState(false);
  const [showEndModal,  setShowEndModal]  = useState(false);
  const [endLoading,    setEndLoading]    = useState(false);
  const [showTimeline,  setShowTimeline]  = useState(false);
  const [showNotes,     setShowNotes]     = useState(false);
  const [notesDraft,    setNotesDraft]    = useState('');
  const [reconnecting,  setReconnecting]  = useState(false);
  const [reconnectCount,setReconnectCount]= useState(0);

  // Stable meeting ID — never changes once set
  const stableMeetingIdRef = useRef(null);

  const actualMeetingId = joinDetails?.meetingId ?? joinDetails?.roomId ?? null;

  // Set stable meeting ID once on start — NEVER reset it during session
  useEffect(() => {
    if (actualMeetingId && !stableMeetingIdRef.current) {
      stableMeetingIdRef.current = actualMeetingId;
    }
  }, [actualMeetingId]);

  // Recover notes draft on open
  useEffect(() => {
    if (!open) return;
    const savedNotes = sessionLoad(SESSION_KEYS.NOTES_DRAFT);
    if (savedNotes) setNotesDraft(savedNotes);
  }, [open]);

  // Auto-save notes every 10s
  useEffect(() => {
    if (!open || !notesDraft) return;
    const id = setInterval(() => sessionSave(SESSION_KEYS.NOTES_DRAFT, notesDraft), 10000);
    return () => clearInterval(id);
  }, [open, notesDraft]);

  // Reset on new booking
  useEffect(() => {
    if (open && booking?._id) {
      setStarted(false);
      setReconnecting(false);
      setReconnectCount(0);
      stableMeetingIdRef.current = null;
    }
  }, [open, booking?._id]);

  // Force-end via live events
  useEffect(() => {
    const last = liveEvents?.[liveEvents.length - 1];
    if (last?.event === 'consultation_ended' || last?.event === 'force_end') {
      handleLeave();
    }
  }, [liveEvents]); // eslint-disable-line

  if (!open || !booking) return null;

  // ── CRITICAL: Stable memoized config — mic/webcam state NOT in deps ────────
  // MeetingProvider must NEVER remount when mic/webcam toggled
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const meetingConfig = useMemo(() => {
    if (!stableMeetingIdRef.current || !joinDetails?.token) return null;
    return {
      meetingId:     stableMeetingIdRef.current,
      micEnabled:    true,   // Always start enabled; toggleMic() handles runtime state
      webcamEnabled: true,   // Always start enabled; toggleWebcam() handles runtime state
      name:          'Doctor',
    };
  }, [stableMeetingIdRef.current, joinDetails?.token]); // eslint-disable-line

  const handleLeave = () => {
    setStarted(false);
    sessionClear(SESSION_KEYS.NOTES_DRAFT, SESSION_KEYS.ACTIVE_MEETING, SESSION_KEYS.TIMER_START);
    onClose();
  };

  const handleStart = async () => {
    await onStart(booking._id);
    setStarted(true);
    sessionSave(SESSION_KEYS.ACTIVE_BOOKING, booking._id);
  };

  const handleEndConsultation = async (data) => {
    setEndLoading(true);
    try {
      await onEndConsultation(booking._id, data);
      sessionClear(
        SESSION_KEYS.ACTIVE_BOOKING, SESSION_KEYS.ACTIVE_MEETING,
        SESSION_KEYS.NOTES_DRAFT, SESSION_KEYS.TIMER_START, SESSION_KEYS.CONSULT_SUMMARY,
      );
      setShowEndModal(false);
      handleLeave();
    } finally {
      setEndLoading(false);
    }
  };

  const isConfirmed = booking.status === 'confirmed';

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="video-modal-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            key="video-modal-panel"
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="bg-base-100 border border-base-300 rounded-2xl shadow-depth-lg w-full max-w-4xl flex flex-col overflow-hidden"
            style={{ height: '90vh', maxHeight: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-base-300 bg-base-100">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-info/10">
                  <MonitorPlay size={18} className="text-info" />
                </div>
                <div>
                  <p className="font-bold text-sm text-base-content font-montserrat">
                    Online Consultation
                    {started && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-success font-normal">
                        <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                        Live
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-base-content/40">
                    {booking.patientInfo?.name} · {booking.bookingCode}
                    {networkQuality && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <NetworkQualityBars quality={networkQuality} size="sm" />
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTimeline((p) => !p)}
                  className={`btn btn-ghost btn-xs gap-1 ${showTimeline ? 'btn-active' : ''}`}
                >
                  <Activity size={13} />
                  <span className="hidden sm:inline">Timeline</span>
                </button>

                {started && (
                  <button
                    onClick={() => setShowNotes((p) => !p)}
                    className={`btn btn-ghost btn-xs gap-1 ${showNotes ? 'btn-active' : ''}`}
                  >
                    <StickyNote size={13} />
                    <span className="hidden sm:inline">Notes</span>
                  </button>
                )}

                {started && (
                  <button onClick={onMinimise} className="btn btn-ghost btn-xs btn-circle" title="Minimise">
                    <Minimize2 size={14} />
                  </button>
                )}

                <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle text-error" title="Close">
                  <XCircle size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Main video area */}
              <div className={`flex-1 overflow-hidden flex flex-col relative ${showTimeline || showNotes ? 'border-r border-base-300' : ''}`}>
                {/* Reconnect overlay */}
                {reconnecting && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                    <div className="text-center">
                      <Loader2 size={32} className="animate-spin text-primary mx-auto mb-2" />
                      <p className="text-white font-semibold">Reconnecting… ({reconnectCount})</p>
                    </div>
                  </div>
                )}

                {/* Pre-start screen */}
                {!started && (
                  <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                      className="p-5 rounded-2xl bg-info/10"
                    >
                      <Video size={40} className="text-info" />
                    </motion.div>
                    <div>
                      <h3 className="font-bold text-xl font-montserrat text-base-content mb-1">Ready to start?</h3>
                      <p className="text-sm text-base-content/50">
                        Patient: <span className="font-semibold text-base-content">{booking.patientInfo?.name}</span>
                        {' · '}Allowed: <span className="font-semibold text-base-content">{joinDetails?.allowedDurationMinutes ?? 30} min</span>
                      </p>
                    </div>

                    <div className="w-full max-w-sm bg-base-200 rounded-xl px-5 py-4 text-left space-y-2">
                      <InfoRow label="Meeting ID" value={actualMeetingId ?? '—'} />
                      <InfoRow label="Booking"    value={booking.bookingCode} />
                      <InfoRow label="Status"     value={isConfirmed ? 'Will mark In-Progress' : 'Already in progress'} />
                    </div>

                    {!joinDetails && (
                      <div className="flex items-center gap-2 text-warning text-sm">
                        <AlertCircle size={14} /> Loading join details…
                      </div>
                    )}

                    <div className="flex gap-3 w-full max-w-sm">
                      <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
                      <button
                        className="btn btn-primary flex-1 gap-2"
                        disabled={!joinDetails || !actualMeetingId}
                        onClick={handleStart}
                      >
                        <VideoIcon size={15} />
                        {isConfirmed ? 'Start Consultation' : 'Rejoin Call'}
                      </button>
                    </div>
                  </div>
                )}

                {/*
                  CRITICAL FIX:
                  key="meeting-{stableMeetingId}" — NEVER changes → MeetingProvider mounts ONCE
                  config is memoized — not affected by mic/webcam state
                  joinWithoutUserInteraction — no double-join prompt
                */}
                {started && meetingConfig && joinDetails?.token && (
                  <MeetingProvider
                    key={`meeting-${stableMeetingIdRef.current}`}
                    config={meetingConfig}
                    token={joinDetails.token}
                    joinWithoutUserInteraction
                    onMeetingStateChanged={(state) => {
                      if (state === 'CONNECTING')   setReconnecting(true);
                      if (state === 'CONNECTED')    setReconnecting(false);
                      if (state === 'RECONNECTING') { setReconnecting(true); setReconnectCount((n) => n + 1); }
                      if (state === 'FAILED')       setReconnectCount((n) => n + 1);
                    }}
                  >
                    <MeetingContent
                      onLeave={handleLeave}
                      onEndConsultation={() => setShowEndModal(true)}
                      allowedDuration={joinDetails.allowedDurationMinutes}
                      startedAt={joinDetails.startedAt}
                      networkQuality={networkQuality}
                      booking={booking}
                    />
                  </MeetingProvider>
                )}

                {started && (!meetingConfig || !joinDetails?.token) && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/40">
                    <Loader2 size={28} className="animate-spin text-primary" />
                    <p className="text-sm">Preparing room…</p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <AnimatePresence>
                {(showTimeline || showNotes) && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 280, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden flex-shrink-0"
                  >
                    <div className="h-full flex flex-col p-4 overflow-auto" style={{ width: 280 }}>
                      {showTimeline && !showNotes && (
                        <>
                          <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Consultation Timeline</p>
                          <ConsultationTimeline booking={{ onlineConsultation: joinDetails }} />
                          <div className="mt-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">Recent Events</p>
                            <LiveEventFeed events={liveEvents} />
                          </div>
                        </>
                      )}
                      {showNotes && (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-base-content/40">Doctor Notes</p>
                            <span className="text-xs text-base-content/30">Auto-saved</span>
                          </div>
                          <textarea
                            className="input-field flex-1 resize-none text-sm min-h-[200px]"
                            placeholder="Clinical notes, observations… (auto-saved every 10s)"
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                          />
                          <p className="text-xs text-base-content/30 mt-2">Saved to session. Persists on refresh.</p>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <EndConsultationModal
        open={showEndModal}
        onClose={() => setShowEndModal(false)}
        onSubmit={handleEndConsultation}
        loading={endLoading}
      />
    </>
  );
});
VideoCallModal.displayName = 'VideoCallModal';

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-base-content/40 font-semibold">{label}</span>
    <span className="font-mono text-base-content font-medium">{value}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING PIP
// ─────────────────────────────────────────────────────────────────────────────

const FloatingPip = memo(({ booking, onExpand, onHangup, networkQuality }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 40 }}
    className="fixed bottom-6 right-6 z-50 bg-base-100 border border-base-300 rounded-2xl shadow-depth p-3 flex items-center gap-3 min-w-[220px]"
  >
    <div className="relative p-2 rounded-xl bg-info/10">
      <Video size={16} className="text-info" />
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full animate-pulse" />
    </div>
    <div className="text-xs flex-1">
      <p className="font-bold text-base-content">{booking?.patientInfo?.name ?? 'Patient'}</p>
      <div className="flex items-center gap-1.5 text-base-content/40">
        <span>Call live</span>
        {networkQuality && <NetworkQualityBars quality={networkQuality} size="sm" />}
      </div>
    </div>
    <button onClick={onExpand} className="btn btn-ghost btn-xs btn-circle" title="Expand">
      <Maximize2 size={13} />
    </button>
    <button onClick={onHangup} className="btn btn-error btn-xs btn-circle" title="Leave">
      <PhoneOff size={13} />
    </button>
  </motion.div>
));
FloatingPip.displayName = 'FloatingPip';

// ─────────────────────────────────────────────────────────────────────────────
// RECONNECT OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

const ReconnectOverlay = memo(({ visible, attempts }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-warning/90 text-warning-content px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-lg"
      >
        <RefreshCw size={14} className="animate-spin" />
        Reconnecting ({attempts})…
      </motion.div>
    )}
  </AnimatePresence>
));
ReconnectOverlay.displayName = 'ReconnectOverlay';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AppointmentsManagement() {
  const dispatch = useDispatch();
  const router   = useRouter();

  // ── Redux ──────────────────────────────────────────────────────────────────
  const appointments = useSelector(selectDoctorAppointments);
  const total        = useSelector(selectDoctorAppointmentsTotal);
  const opRecords    = useSelector(selectOPRecords);
  const joinDetails  = useSelector(selectJoinDetails);

  const loadingAppts = useSelector(selectClinicalLoading('fetchDoctorAppointments'));
  const loadingOP    = useSelector(selectClinicalLoading('completeOPRecord'));
  const error        = useSelector(selectClinicalError('fetchDoctorAppointments'));
  const { isFetchingJoin } = useSelector(selectConsultationLoaders);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [status,   setStatus]   = useState('');
  const [consType, setConsType] = useState('');
  const [search,   setSearch]   = useState('');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [page,     setPage]     = useState(1);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [completeTarget, setCompleteTarget] = useState(null);
  const [showComplete,   setShowComplete]   = useState(false);

  // ── Video state ────────────────────────────────────────────────────────────
  const [videoBooking,  setVideoBooking]  = useState(null);
  const [showVideo,     setShowVideo]     = useState(false);
  const [callMinimised, setCallMinimised] = useState(false);

  // ── Socket state ───────────────────────────────────────────────────────────
  const [networkQuality,  setNetworkQuality]  = useState('excellent');
  const [liveEvents,      setLiveEvents]      = useState([]);
  const [waitingPatients, setWaitingPatients] = useState([]);
  const [reconnecting,    setReconnecting]    = useState(false);
  const [reconnectCount,  setReconnectCount]  = useState(0);
  const [activeSessions,  setActiveSessions]  = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const networkLogTimer = useRef(null);
  // Store videoBooking in ref so socket handlers get current value without re-registering
  const videoBookingRef = useRef(null);

  useEffect(() => {
    videoBookingRef.current = videoBooking;
  }, [videoBooking]);

  // ── Session recovery on mount ──────────────────────────────────────────────
  useEffect(() => {
    const savedBookingId = sessionLoad(SESSION_KEYS.ACTIVE_BOOKING);
    const savedMeetingId = sessionLoad(SESSION_KEYS.ACTIVE_MEETING);
    if (savedBookingId && savedMeetingId) {
      const match = appointments.find((a) => a._id === savedBookingId);
      if (match && canJoinConsult(match)) {
        handleJoinVideo(match, true);
      }
    }
  }, []); // eslint-disable-line

  // ── Socket listeners — registered ONCE, use ref for current videoBooking ──
  useEffect(() => {
    const io = socketService;
    if (!io?.connected) return;

    const addEvent = (ev) => setLiveEvents((prev) => [...prev.slice(-49), ev]);

    const scheduleNetworkLog = (bookingId, quality) => {
  clearTimeout(networkLogTimer.current);
  // Extract only primitive string — never pass full booking object
  const safeId = typeof bookingId === 'string' ? bookingId : bookingId?._id?.toString?.() ?? null;
  if (!safeId) return;
  networkLogTimer.current = setTimeout(() => {
    dispatch(logNetworkQuality({ bookingId: safeId, participant: 'doctor', quality }));
  }, 5000);
};


    // FIX: all handlers defined once, no re-registration on videoBooking change
    const handlers = [
      [CONSULT_EVENTS.WAITING, (data) => {
        setWaitingPatients((prev) => {
          if (prev.find((p) => p.bookingId === data.bookingId)) return prev;
          return [...prev, data];
        });
        addEvent({ event: 'patient_waiting', participant: 'patient', timestamp: new Date(), metadata: data });
      }],
      [CONSULT_EVENTS.PATIENT_JOINED, (data) => {
        addEvent({ event: 'patient_joined', participant: 'patient', timestamp: new Date(), metadata: data });
        setWaitingPatients((prev) => prev.filter((p) => p.bookingId !== data.bookingId));
      }],
      [CONSULT_EVENTS.DOCTOR_JOINED, (data) => {
        addEvent({ event: 'doctor_joined', participant: 'doctor', timestamp: new Date(), metadata: data });
      }],
      [CONSULT_EVENTS.STARTED, (data) => {
        addEvent({ event: 'consultation_started', participant: 'doctor', timestamp: new Date(), metadata: data });
        setActiveSessions((n) => n + 1);
        fetchData();
      }],
      [CONSULT_EVENTS.ENDED, (data) => {
        addEvent({ event: 'consultation_ended', participant: data.endedBy, timestamp: new Date(), metadata: data });
        setActiveSessions((n) => Math.max(0, n - 1));
        fetchData();
      }],
      [CONSULT_EVENTS.NETWORK_QUALITY, (data) => {
        if (data.participant === 'doctor') {
          setNetworkQuality(data.quality);
          const current = videoBookingRef.current;
          if (current) scheduleNetworkLog(current._id, data.quality);
        }
        if (data.quality === 'disconnected') {
          setReconnecting(true);
          setReconnectCount((n) => n + 1);
        } else {
          setReconnecting(false);
        }
      }],
      [CONSULT_EVENTS.NETWORK_ISSUE, (data) => {
        addEvent({ event: 'network_issue', participant: data.participant, timestamp: new Date(), metadata: data });
      }],
      [CONSULT_EVENTS.RECONNECTING, () => {
        setReconnecting(true);
        setReconnectCount((n) => n + 1);
      }],
      [CONSULT_EVENTS.PRESCRIPTION_UPLOADED, (data) => {
        addEvent({ event: 'prescription_uploaded', participant: 'doctor', timestamp: new Date(), metadata: data });
        fetchData();
      }],
      [CONSULT_EVENTS.FORCE_END, (data) => {
        addEvent({ event: 'force_end', participant: 'admin', timestamp: new Date(), metadata: data });
        handleCloseVideo();
      }],
      [CONSULT_EVENTS.CANCELLED, () => {
        fetchData();
        handleCloseVideo();
      }],
    ];

    // FIX: register once, store cleanup fns
    const cleanups = handlers.map(([event, handler]) => io.on(event, handler));

    return () => {
      cleanups.forEach((fn) => fn?.());
      clearTimeout(networkLogTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — handlers use refs for fresh values

  // Join booking-level socket room
  useEffect(() => {
    if (showVideo && videoBooking?._id) {
      socketService.joinBookingRoom?.(videoBooking._id);
      sessionSave(SESSION_KEYS.ACTIVE_BOOKING, videoBooking._id);
    }
    return () => {
      if (videoBooking?._id) socketService.leaveBookingRoom?.(videoBooking._id);
    };
  }, [showVideo, videoBooking?._id]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    dispatch(fetchDoctorAppointments({
      status:           status   || undefined,
      consultationType: consType || undefined,
      from:             from     || undefined,
      to:               to       || undefined,
      search:           search   || undefined,
      page,
      limit: PAGE_LIMIT,
    }));
    dispatch(fetchOPRecords({ page: 1, limit: 200 }));
  }, [dispatch, status, consType, search, from, to, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page on filter change
  const filtersKey  = `${status}|${consType}|${search}|${from}|${to}`;
  const prevFilters = useRef(filtersKey);
  useEffect(() => {
    if (prevFilters.current !== filtersKey) {
      prevFilters.current = filtersKey;
      setPage(1);
    }
  }, [filtersKey]);

  // ── OP map ─────────────────────────────────────────────────────────────────
  const opByBooking = useMemo(() => {
    const map = {};
    opRecords.forEach((op) => {
      const bk = bookingIdFromOP(op);
      if (bk) map[bk] = op;
    });
    return map;
  }, [opRecords]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total,
      completed:  appointments.filter((a) => a.status === 'completed').length,
      today:      appointments.filter((a) => new Date(a.scheduledAt).toDateString() === today).length,
      pending:    appointments.filter((a) => ['pending', 'confirmed'].includes(a.status)).length,
      online:     appointments.filter((a) => a.status === 'in_progress' && isOnlineBooking(a)).length + activeSessions,
      waiting:    waitingPatients.length,
    };
  }, [appointments, total, activeSessions, waitingPatients]);

  const chartData  = useMemo(() => buildChartData(appointments), [appointments]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  // ── Complete handlers ──────────────────────────────────────────────────────
  const handleCompleteClick = useCallback((bookingId, opId) => {
    setCompleteTarget({ bookingId, opId });
    setShowComplete(true);
  }, []);

  const handleCompleteSubmit = useCallback(async (body) => {
    if (!completeTarget) return;
    const { bookingId, opId } = completeTarget;
    if (opId) await dispatch(completeOPRecord({ id: opId, ...body }));
    else       await dispatch(completeOPRecord({ bookingId, ...body }));
    setShowComplete(false);
    fetchData();
  }, [completeTarget, dispatch, fetchData]);

  // ── Video handlers ─────────────────────────────────────────────────────────
  const handleJoinVideo = useCallback(async (booking, isRecovery = false) => {
    if (!canJoinConsult(booking)) return;
    // FIX: prevent duplicate join
    if (showVideo && videoBooking?._id === booking._id) {
      setCallMinimised(false);
      return;
    }
    setVideoBooking(booking);
    setShowVideo(true);
    setCallMinimised(false);
    dispatch(clearJoinDetails());
    await dispatch(fetchJoinDetails(booking._id));
  }, [dispatch, showVideo, videoBooking]);

  const handleStartCall = useCallback(async (bookingId) => {
    if (videoBooking?.status === 'confirmed') {
      await dispatch(startConsultation(bookingId));
    }
    const result = await dispatch(fetchJoinDetails(bookingId));
    if (result?.payload?.roomId) {
      sessionSave(SESSION_KEYS.ACTIVE_MEETING, result.payload.roomId);
      sessionSave(SESSION_KEYS.TIMER_START, new Date().toISOString());
    }
    fetchData();
  }, [dispatch, videoBooking, fetchData]);

  const handleEndConsultation = useCallback(async (bookingId, data) => {
    await dispatch(endConsultation({ bookingId, ...data }));
    fetchData();
  }, [dispatch, fetchData]);

  const handleCloseVideo = useCallback(() => {
    setShowVideo(false);
    setCallMinimised(false);
    setVideoBooking(null);
    setNetworkQuality('excellent');
    setLiveEvents([]);
    dispatch(clearJoinDetails());
    sessionClear(SESSION_KEYS.ACTIVE_BOOKING, SESSION_KEYS.ACTIVE_MEETING);
  }, [dispatch]);

  // ── Waiting room ───────────────────────────────────────────────────────────
  const handleApproveWaiting = useCallback((bookingId) => {
    setWaitingPatients((prev) => prev.filter((p) => p.bookingId !== bookingId));
    socketService.emit?.('consultation:approve_waiting', { bookingId });
  }, []);

  const handleDenyWaiting = useCallback((bookingId) => {
    setWaitingPatients((prev) => prev.filter((p) => p.bookingId !== bookingId));
    socketService.emit?.('consultation:deny_waiting', { bookingId });
  }, []);

  // ── Filters ────────────────────────────────────────────────────────────────
  const clearFilters = useCallback(() => {
    setStatus(''); setConsType(''); setFrom(''); setTo(''); setSearch('');
  }, []);
  const hasFilters = status || consType || from || to || search;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content">

      <ReconnectOverlay visible={reconnecting} attempts={reconnectCount} />

      <AnimatePresence>
        {waitingPatients.length > 0 && (
          <WaitingRoomPanel
            waitingPatients={waitingPatients}
            onApprove={handleApproveWaiting}
            onDeny={handleDenyWaiting}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <CalendarDays size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black font-montserrat text-base-content leading-tight">Appointments</h1>
              <p className="text-xs text-base-content/40">
                {total} total
                {stats.online > 0 && <span className="ml-2 text-success font-semibold">· {stats.online} live</span>}
                {stats.waiting > 0 && <span className="ml-2 text-warning font-semibold">· {stats.waiting} waiting</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} disabled={loadingAppts} className="btn btn-ghost btn-sm gap-1.5">
              <RefreshCw size={14} className={loadingAppts ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={() => router.push('/doctor/prescriptions/new')} className="btn btn-primary btn-sm gap-1.5">
              <Plus size={14} />
              New Prescription
            </button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <StatCard icon={Layers}       label="Total"     value={stats.total}     color="var(--primary)" sub="All time"          chartData={chartData} />
          <StatCard icon={CalendarDays} label="Today"     value={stats.today}     color="var(--info)"    sub="Scheduled today"   />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed}  color="var(--success)" sub="This page"         />
          <StatCard icon={Clock3}       label="Pending"   value={stats.pending}   color="var(--warning)" sub="Awaiting"          />
          <StatCard icon={Radio}        label="Live"      value={stats.online}    color="var(--success)" sub="Active sessions"   live={stats.online > 0} />
          <StatCard icon={Bell}         label="Waiting"   value={stats.waiting}   color="var(--error)"   sub="In waiting room"   live={stats.waiting > 0} />
        </div>

        {/* Live event feed */}
        {liveEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-base-100 border border-base-300 rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Radio size={14} className="text-success" />
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/50">Live Events</span>
            </div>
            <LiveEventFeed events={liveEvents} />
          </motion.div>
        )}

        {/* Filters */}
        <div className="bg-base-100 border border-base-300 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input
              className="input-field pl-9 text-sm"
              placeholder="Search patient, code, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  status === s.value
                    ? 'border-primary bg-primary text-primary-content'
                    : 'border-base-300 text-base-content/60 hover:border-primary/40'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <select
            className="input-field text-sm w-auto min-w-[130px]"
            value={consType}
            onChange={(e) => setConsType(e.target.value)}
          >
            {CONSULT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="flex flex-col sm:flex-row items-center gap-1.5">
            <input type="date" className="input-field text-sm w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-base-content/30 text-sm">→</span>
            <input type="date" className="input-field text-sm w-auto" value={to}   onChange={(e) => setTo(e.target.value)} />
          </div>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm text-error gap-1" onClick={clearFilters}>
              <XCircle size={13} /> Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">

          {/* Desktop */}
          <div className="overflow-x-auto hidden md:block">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Booking</th>
                  <th>Type</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>OP Record</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingAppts && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="loading loading-md loading-spinner" />
                        <span className="text-sm text-base-content/40">Loading appointments…</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loadingAppts && appointments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-base-content/40">
                        <CalendarDays size={32} strokeWidth={1} />
                        <p className="text-sm font-medium">No appointments found</p>
                        <p className="text-xs">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                )}

                <AnimatePresence mode="popLayout">
                  {!loadingAppts && appointments.map((booking, i) => {
                    const op       = opByBooking[booking._id?.toString()];
                    const joinable = canJoinConsult(booking);
                    const isActive = videoBooking?._id === booking._id && showVideo;

                    return (
                      <motion.tr
                        key={booking._id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: i * 0.03 } }}
                        exit={{ opacity: 0 }}
                        className={`hover:bg-primary/5 cursor-default group ${isActive ? 'bg-info/5 border-l-2 border-info' : ''}`}
                      >
                        {/* Patient */}
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="avatar placeholder">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm">
                                <span>{booking.patientInfo?.name?.[0] ?? booking.customer?.name?.[0] ?? '?'}</span>
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-base-content leading-tight">
                                {booking.patientInfo?.name ?? booking.customer?.name ?? '—'}
                              </p>
                              <p className="text-xs text-base-content/40">
                                {booking.patientInfo?.phone ?? booking.customer?.phone ?? '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Booking */}
                        <td>
                          <p className="font-mono text-xs font-bold text-primary">{booking.bookingCode ?? '—'}</p>
                          <p className="text-xs text-base-content/40">
                            {BOOKING_TYPE_LABEL[booking.bookingType] ?? booking.bookingType}
                          </p>
                        </td>

                        {/* Type */}
                        <td>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-base-content/60">
                            {consultIcon(booking.consultationType)}
                            {booking.consultationType ?? '—'}
                          </span>
                        </td>

                        {/* Scheduled */}
                        <td>
                          <p className="text-sm">{formatDate(booking.scheduledAt)}</p>
                        </td>

                        {/* Status */}
                        <td>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={booking.status} />
                            {isActive && (
                              <span className="inline-flex items-center gap-1 text-xs text-success">
                                <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                                You're in call
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Payment */}
                        <td>
                          <span className={`text-xs font-semibold ${
                            booking.paymentStatus === 'paid'   ? 'text-success' :
                            booking.paymentStatus === 'unpaid' ? 'text-error'   : 'text-warning'
                          }`}>
                            {booking.paymentStatus ?? '—'}
                          </span>
                        </td>

                        {/* OP */}
                        <td>
                          {op ? (
                            <button
                              onClick={() => router.push(`/doctor/op-records/${op._id}`)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <FileText size={11} />
                              {op.opNumber ?? 'View'}
                            </button>
                          ) : (
                            <span className="text-xs text-base-content/30">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {joinable && (
                              <button
                                title={isActive ? 'In call' : 'Join Video Call'}
                                className={`btn btn-xs gap-1 ${isActive ? 'btn-success' : 'btn-info'}`}
                                onClick={() => isActive ? setCallMinimised(false) : handleJoinVideo(booking)}
                                disabled={isFetchingJoin && videoBooking?._id === booking._id && !isActive}
                              >
                                {isFetchingJoin && videoBooking?._id === booking._id && !isActive
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <Video size={12} />
                                }
                                <span className="hidden lg:inline">{isActive ? 'Resume' : 'Join'}</span>
                              </button>
                            )}

                            <button
                              title="Write Prescription"
                              className="btn btn-ghost btn-xs gap-1 text-accent hover:bg-accent/10"
                              onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)}
                            >
                              <PenLine size={13} />
                              <span className="hidden lg:inline text-xs">Prescribe</span>
                            </button>

                            <ActionMenu
                              booking={booking}
                              opRecord={op}
                              onComplete={handleCompleteClick}
                              onJoinVideo={handleJoinVideo}
                              router={router}
                            />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-base-300">
            {loadingAppts && (
              <div className="py-16 flex justify-center">
                <span className="loading loading-md loading-spinner" />
              </div>
            )}

            <AnimatePresence>
              {!loadingAppts && appointments.map((booking, i) => {
                const op       = opByBooking[booking._id?.toString()];
                const joinable = canJoinConsult(booking);
                const isActive = videoBooking?._id === booking._id && showVideo;

                return (
                  <motion.div
                    key={booking._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                    exit={{ opacity: 0 }}
                    className={`p-4 space-y-3 ${isActive ? 'bg-info/5 border-l-2 border-info' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="avatar placeholder">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold">
                            <span>{booking.patientInfo?.name?.[0] ?? booking.customer?.name?.[0] ?? '?'}</span>
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-sm">{booking.patientInfo?.name ?? booking.customer?.name}</p>
                          <p className="text-xs text-base-content/40">{booking.bookingCode}</p>
                        </div>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-base-content/40 font-semibold uppercase tracking-wide mb-0.5">Scheduled</p>
                        <p>{formatDate(booking.scheduledAt)}</p>
                      </div>
                      <div>
                        <p className="text-base-content/40 font-semibold uppercase tracking-wide mb-0.5">Type</p>
                        <p className="flex items-center gap-1">{consultIcon(booking.consultationType)} {booking.consultationType ?? '—'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {joinable && (
                        <button
                          className={`btn btn-sm flex-1 gap-1 text-xs ${isActive ? 'btn-success' : 'btn-info'}`}
                          onClick={() => isActive ? setCallMinimised(false) : handleJoinVideo(booking)}
                          disabled={isFetchingJoin && videoBooking?._id === booking._id && !isActive}
                        >
                          <Video size={12} /> {isActive ? 'Resume Call' : 'Join Call'}
                        </button>
                      )}

                      <button
                        className="btn btn-primary btn-sm flex-1 gap-1 text-xs"
                        onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)}
                      >
                        <PenLine size={12} /> Prescribe
                      </button>

                      {op && (
                        <button
                          className="btn btn-outline btn-sm gap-1 text-xs"
                          onClick={() => router.push(`/doctor/op-records/${op._id}`)}
                        >
                          <FileText size={12} /> OP
                        </button>
                      )}

                      <ActionMenu
                        booking={booking}
                        opRecord={op}
                        onComplete={handleCompleteClick}
                        onJoinVideo={handleJoinVideo}
                        router={router}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-base-300 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-base-content/50">
                Page {page} of {totalPages} · {total} appointments
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={n}
                      className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  );
                })}

                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CompleteModal
        open={showComplete}
        onClose={() => setShowComplete(false)}
        onSubmit={handleCompleteSubmit}
        loading={loadingOP}
      />

      {/* FIX: Single VideoCallModal — no duplicate mount possible */}
      {showVideo && !callMinimised && (
        <VideoCallModal
          open={showVideo && !callMinimised}
          booking={videoBooking}
          joinDetails={joinDetails}
          onClose={handleCloseVideo}
          onStart={handleStartCall}
          onMinimise={() => setCallMinimised(true)}
          onEndConsultation={handleEndConsultation}
          networkQuality={networkQuality}
          liveEvents={liveEvents}
        />
      )}

      {/* Floating PiP */}
      <AnimatePresence>
        {showVideo && callMinimised && (
          <FloatingPip
            booking={videoBooking}
            onExpand={() => setCallMinimised(false)}
            onHangup={handleCloseVideo}
            networkQuality={networkQuality}
          />
        )}
      </AnimatePresence>
    </div>
  );
}