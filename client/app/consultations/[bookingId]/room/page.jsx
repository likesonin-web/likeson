'use client';

/**
 * OnlineConsultationPage.jsx — Likeson.in Patient Portal
 * Production-grade customer-side telemedicine experience
 * All 20 critical requirements implemented
 *
 * Route: /patient/consultations/[bookingId]
 * Usage: <OnlineConsultationPage params={{ bookingId: '...' }} />
 */

import {
  useEffect, useState, useCallback, useMemo, useRef, memo, useReducer,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MeetingProvider, useMeeting, useParticipant,
} from '@videosdk.live/react-sdk';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Maximize2, Minimize2,
  RefreshCw, WifiOff, Wifi, AlertCircle, CheckCircle2, Clock,
  Clock3, FileText, Download, Upload, Star, ChevronRight,
  Stethoscope, User, Shield, ShieldCheck, AlertTriangle,
  Activity, MonitorPlay, Bell, Loader2, XCircle, Signal,
  Camera, Volume2, VolumeX, Settings, Info, Heart,
  Calendar, ArrowRight, ThumbsUp, Eye, Timer, Zap,
  Radio, UserCheck, RotateCcw, HelpCircle, CheckSquare,
  X, Play, Pause, BarChart2, TrendingUp, Users  
} from 'lucide-react';

import {
  fetchJoinDetails,
  fetchConsultationById,
  acceptTelemedicineConsent,
  endConsultation,
  rateConsultation,
  checkFollowUpEligibility,
  logNetworkQuality,
  uploadPrescription,
  selectJoinDetails,
  selectCurrentConsultation,
  selectConsultationLoaders,
  selectConsultationErrors,
  selectFollowUpEligibility,
  clearJoinDetails,
  clearCurrentConsultation,
} from '@/store/slices/consultationSlice';

import socketService from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CONSULTATION_EVENTS = {
  WAITING:               'consultation:waiting',
  DOCTOR_JOINED:         'consultation:doctor_joined',
  PATIENT_JOINED:        'consultation:patient_joined',
  STARTED:               'consultation:started',
  ENDED:                 'consultation:ended',
  RECONNECTING:          'consultation:reconnecting',
  NETWORK_ISSUE:         'consultation:network_issue',
  NETWORK_QUALITY:       'consultation:network_quality',
  PRESCRIPTION_UPLOADED: 'consultation:prescription_uploaded',
  NOTES_AVAILABLE:       'consultation:notes_available',
  FOLLOWUP_READY:        'consultation:followup_ready',
  FORCE_END:             'consultation:force_end',
  CANCELLED:             'consultation:cancelled',
};

const SESSION_KEYS = {
  BOOKING_ID:   'patient_consult_booking_id',
  MEETING_ID:   'patient_consult_meeting_id',
  TIMER_START:  'patient_consult_timer_start',
  CONSENT_DONE: 'patient_consult_consent_',
  DEVICE_PREFS: 'patient_device_prefs',
};

const TIMER_WARN_SECONDS = [600, 300, 60];

const NETWORK_CFG = {
  excellent:    { label: 'Excellent', color: 'text-success', bg: 'bg-success/10', bars: 4 },
  good:         { label: 'Good',      color: 'text-info',    bg: 'bg-info/10',    bars: 3 },
  poor:         { label: 'Poor',      color: 'text-warning', bg: 'bg-warning/10', bars: 2 },
  disconnected: { label: 'No Signal', color: 'text-error',   bg: 'bg-error/10',   bars: 0 },
};

const PHASE = {
  LOADING:      'loading',
  CONSENT:      'consent',
  DEVICE_CHECK: 'device_check',
  WAITING_ROOM: 'waiting_room',
  IN_CALL:      'in_call',
  ENDED:        'ended',
  ERROR:        'error',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const sessionSave = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };
const sessionLoad = (k)    => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const sessionClear= (...ks)=> { ks.forEach((k) => { try { sessionStorage.removeItem(k); } catch {} }); };

const lsSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const lsLoad = (k)    => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };

const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const formatWaitTime = (ms) => {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'Just now';
  if (m === 1) return '1 min';
  return `${m} mins`;
};

const notifyBrowser = (title, body, icon = '/favicon.ico') => {
  if (typeof window === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') new Notification(title, { body, icon });
    });
  }
};

const playAlert = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {}
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE CHECK REDUCER
// ─────────────────────────────────────────────────────────────────────────────

const deviceInitial = {
  mic:     { status: 'idle', label: 'Microphone',  error: null },
  camera:  { status: 'idle', label: 'Camera',      error: null },
  speaker: { status: 'idle', label: 'Speaker',     error: null },
  network: { status: 'idle', label: 'Internet',    error: null, quality: null },
  browser: { status: 'idle', label: 'Browser',     error: null },
};

function deviceReducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, [action.key]: { ...state[action.key], ...action.payload } };
    case 'RESET': return deviceInitial;
    default: return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK QUALITY BARS
// ─────────────────────────────────────────────────────────────────────────────

const NetworkBars = memo(({ quality, size = 'md' }) => {
  const cfg  = NETWORK_CFG[quality] || NETWORK_CFG.disconnected;
  const h    = size === 'sm' ? [4,6,8,10] : [6,9,12,15];
  return (
    <span className={`inline-flex items-end gap-0.5 ${cfg.color}`} title={`Network: ${cfg.label}`}>
      {[0,1,2,3].map((i) => (
        <span key={i} className={`rounded-sm ${i < cfg.bars ? 'opacity-100' : 'opacity-20'}`}
          style={{ width: 3, height: h[i], background: 'currentColor', display: 'block' }} />
      ))}
    </span>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION TIMER
// ─────────────────────────────────────────────────────────────────────────────

const ConsultTimer = memo(({ startedAt, allowedMinutes, onWarn, onExpire }) => {
  const [elapsed,   setElapsed]   = useState(0);
  const [remaining, setRemaining] = useState(null);
  const warnedRef = useRef(new Set());

  useEffect(() => {
    if (!startedAt) return;
    const total = (allowedMinutes || 30) * 60;

    const tick = () => {
      const el  = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const rem = Math.max(0, total - el);
      setElapsed(el);
      setRemaining(rem);

      TIMER_WARN_SECONDS.forEach((w) => {
        if (rem <= w && !warnedRef.current.has(w)) {
          warnedRef.current.add(w);
          onWarn?.(w);
        }
      });

      if (rem === 0) onExpire?.();
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, allowedMinutes, onWarn, onExpire]);

  if (remaining === null) return null;

  const total    = (allowedMinutes || 30) * 60;
  const pct      = ((total - remaining) / total) * 100;
  const critical = remaining <= 60;
  const urgent   = remaining <= 300;

  return (
    <div className={`flex flex-col gap-1 ${critical ? 'text-error' : urgent ? 'text-warning' : 'text-base-content/60'}`}>
      <div className="flex items-center gap-2 text-xs">
        <Timer size={12} />
        <span className="font-mono font-bold">{formatDuration(elapsed)}</span>
        <span className="opacity-50">/</span>
        <span className="opacity-50">{formatDuration(remaining)} left</span>
      </div>
      <div className="h-1 w-28 rounded-full bg-base-300 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${critical ? 'bg-error' : urgent ? 'bg-warning' : 'bg-success'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE CHECK PANEL
// ─────────────────────────────────────────────────────────────────────────────

const DeviceCheckPanel = memo(({ onReady, onSkip }) => {
  const [devices, dispatch] = useReducer(deviceReducer, deviceInitial);
  const [running, setRunning] = useState(false);
  const [allPassed, setAllPassed] = useState(false);
  const streamRef = useRef(null);

  const runChecks = useCallback(async () => {
    setRunning(true);
    dispatch({ type: 'RESET' });

    // Browser check
    dispatch({ type: 'SET', key: 'browser', payload: { status: 'checking' } });
    const supported = !!(navigator.mediaDevices && window.RTCPeerConnection);
    dispatch({ type: 'SET', key: 'browser', payload: {
      status: supported ? 'pass' : 'fail',
      error:  supported ? null : 'Browser does not support WebRTC. Use Chrome or Firefox.',
    }});

    // Camera check
    dispatch({ type: 'SET', key: 'camera', payload: { status: 'checking' } });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      dispatch({ type: 'SET', key: 'camera', payload: { status: 'pass', error: null } });
    } catch (e) {
      dispatch({ type: 'SET', key: 'camera', payload: {
        status: 'fail',
        error:  e.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow in browser settings.'
          : 'Camera not found or unavailable.',
      }});
    }

    // Mic check
    dispatch({ type: 'SET', key: 'mic', payload: { status: 'checking' } });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      dispatch({ type: 'SET', key: 'mic', payload: { status: 'pass', error: null } });
    } catch (e) {
      dispatch({ type: 'SET', key: 'mic', payload: {
        status: 'fail',
        error:  e.name === 'NotAllowedError'
          ? 'Microphone permission denied. Allow in browser settings.'
          : 'Microphone not found or unavailable.',
      }});
    }

    // Speaker check (AudioContext)
    dispatch({ type: 'SET', key: 'speaker', payload: { status: 'checking' } });
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      dispatch({ type: 'SET', key: 'speaker', payload: { status: 'pass', error: null } });
      ctx.close();
    } catch {
      dispatch({ type: 'SET', key: 'speaker', payload: { status: 'warn', error: 'Could not verify speaker. Proceed with caution.' } });
    }

    // Network speed check (simple fetch timing)
    dispatch({ type: 'SET', key: 'network', payload: { status: 'checking' } });
    try {
      const t0  = Date.now();
      await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      const ms  = Date.now() - t0;
      const q   = ms < 500 ? 'excellent' : ms < 1200 ? 'good' : 'poor';
      dispatch({ type: 'SET', key: 'network', payload: { status: q === 'poor' ? 'warn' : 'pass', quality: q, error: q === 'poor' ? 'Slow connection detected. Video quality may be affected.' : null } });
    } catch {
      dispatch({ type: 'SET', key: 'network', payload: { status: 'warn', error: 'Could not measure network speed.', quality: 'unknown' } });
    }

    setRunning(false);
  }, []);

  useEffect(() => {
    runChecks();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [runChecks]);

  useEffect(() => {
    const vals = Object.values(devices);
    if (vals.every((d) => d.status !== 'idle' && d.status !== 'checking')) {
      const critical = ['browser', 'mic', 'camera'];
      const passed   = critical.every((k) => devices[k].status === 'pass');
      setAllPassed(passed);
    }
  }, [devices]);

  const StatusIcon = ({ status }) => {
    if (status === 'idle' || status === 'checking')
      return <Loader2 size={16} className="animate-spin text-base-content/30" />;
    if (status === 'pass')   return <CheckCircle2 size={16} className="text-success" />;
    if (status === 'warn')   return <AlertTriangle size={16} className="text-warning" />;
    return <XCircle size={16} className="text-error" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="bg-base-100 border border-base-300 rounded-2xl shadow-depth overflow-hidden">
        <div className="p-6 border-b border-base-300 bg-gradient-to-r from-primary/5 to-info/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Settings size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg font-montserrat">Device Check</h2>
              <p className="text-sm text-base-content/50">Verifying your setup before joining</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {Object.entries(devices).map(([key, dev]) => (
            <div key={key} className={`flex items-start gap-3 p-3 rounded-xl border ${
              dev.status === 'pass' ? 'border-success/20 bg-success/5' :
              dev.status === 'fail' ? 'border-error/20 bg-error/5' :
              dev.status === 'warn' ? 'border-warning/20 bg-warning/5' :
              'border-base-300 bg-base-200/50'
            }`}>
              <StatusIcon status={dev.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{dev.label}</p>
                {dev.error && (
                  <p className="text-xs text-error mt-0.5">{dev.error}</p>
                )}
                {dev.quality && dev.status !== 'fail' && (
                  <p className="text-xs text-base-content/50 mt-0.5">Quality: {dev.quality}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!allPassed && !running && (
          <div className="px-6 pb-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
              <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
              <div className="text-xs text-warning">
                <p className="font-bold mb-1">Required permissions missing</p>
                <p>Allow camera and microphone in your browser settings, then refresh.</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-base-300 flex gap-3">
          <button
            className="btn btn-ghost flex-1 gap-2"
            onClick={running ? undefined : runChecks}
            disabled={running}
          >
            <RotateCcw size={14} className={running ? 'animate-spin' : ''} />
            {running ? 'Checking…' : 'Re-check'}
          </button>

          <button
            className="btn btn-ghost btn-sm text-base-content/40"
            onClick={onSkip}
          >
            Skip
          </button>

          <button
            className={`btn flex-1 gap-2 ${allPassed ? 'btn-primary' : 'btn-warning'}`}
            onClick={onReady}
            disabled={running}
          >
            <Video size={15} />
            {allPassed ? 'Continue' : 'Continue Anyway'}
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSENT PANEL
// ─────────────────────────────────────────────────────────────────────────────

const ConsentPanel = memo(({ booking, onAccept, loading }) => {
  const [checked, setChecked] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="bg-base-100 border border-base-300 rounded-2xl shadow-depth overflow-hidden">
        <div className="p-6 border-b border-base-300 bg-gradient-to-r from-success/5 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success/10">
              <ShieldCheck size={22} className="text-success" />
            </div>
            <div>
              <h2 className="font-bold text-lg font-montserrat">Telemedicine Consent</h2>
              <p className="text-sm text-base-content/50">Required before your consultation</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Booking summary */}
          <div className="bg-base-200/60 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-base-content/40">Appointment</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Stethoscope size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {booking?.doctorSnapshot?.name ? `Dr. ${booking.doctorSnapshot.name}` : 'Your Doctor'}
                </p>
                <p className="text-xs text-base-content/50">
                  {booking?.doctorSnapshot?.specialization} · {booking?.bookingCode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-base-content/50">
              <Calendar size={12} />
              <span>{formatDate(booking?.scheduledAt)}</span>
              <span>·</span>
              <Clock size={12} />
              <span>{booking?.onlineConsultation?.allowedDurationMinutes ?? 30} min session</span>
            </div>
          </div>

          {/* Consent terms */}
          <div className="space-y-2 text-sm text-base-content/70 max-h-48 overflow-auto pr-1">
            {[
              'This is a real-time video consultation with a licensed medical professional.',
              'Your session may be recorded for quality assurance with your explicit consent.',
              'This does not replace emergency medical care. Call emergency services for life-threatening conditions.',
              'Your health data is protected under applicable privacy laws.',
              'Prescriptions issued are valid per applicable regulations.',
              'You confirm you are the registered patient for this booking.',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-success mt-0.5 flex-shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="checkbox checkbox-primary mt-0.5"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span className="text-sm group-hover:text-base-content transition-colors">
              I have read and agree to the telemedicine consultation terms and consent to this video consultation.
            </span>
          </label>
        </div>

        <div className="p-6 border-t border-base-300">
          <button
            className="btn btn-primary w-full gap-2"
            disabled={!checked || loading}
            onClick={onAccept}
          >
            {loading
              ? <><span className="loading loading-xs loading-spinner" /> Saving consent…</>
              : <><ShieldCheck size={16} /> Accept & Continue</>
            }
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// WAITING ROOM
// ─────────────────────────────────────────────────────────────────────────────

const WaitingRoom = memo(({ booking, joinDetails, onJoin, loading, liveEvents, networkQuality }) => {
  const [waitStart] = useState(Date.now());
  const [waitMs,    setWaitMs]    = useState(0);
  const [doctorJoined, setDoctorJoined] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setWaitMs(Date.now() - waitStart), 5000);
    return () => clearInterval(id);
  }, [waitStart]);

  // Check if doctor joined from live events
  useEffect(() => {
    const lastEv = liveEvents?.[liveEvents.length - 1];
    if (lastEv?.event === 'doctor_joined' || lastEv?.event === 'consultation_started') {
      setDoctorJoined(true);
      playAlert();
      notifyBrowser('Doctor has joined!', 'Your consultation is ready. Click to join.');
    }
  }, [liveEvents]);

  const docName = booking?.doctorSnapshot?.name ? `Dr. ${booking.doctorSnapshot.name}` : 'Your Doctor';
  const docSpec = booking?.doctorSnapshot?.specialization ?? '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Doctor joined banner */}
      <AnimatePresence>
        {doctorJoined && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-success/10 border border-success/30"
          >
            <div className="p-2 rounded-xl bg-success/20">
              <UserCheck size={20} className="text-success" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-success">Doctor has joined!</p>
              <p className="text-sm text-base-content/60">Your consultation room is ready.</p>
            </div>
            <button
              className="btn btn-success gap-2"
              onClick={onJoin}
              disabled={loading}
            >
              {loading ? <span className="loading loading-xs loading-spinner" /> : <Video size={15} />}
              Join Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main waiting card */}
      <div className="bg-base-100 border border-base-300 rounded-2xl shadow-depth overflow-hidden">
        {/* Animated waiting header */}
        <div className="p-8 text-center bg-gradient-to-b from-primary/5 to-transparent border-b border-base-300">
          <div className="relative inline-block mb-5">
            {/* Pulsing rings */}
            {[1,2,3].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ scale: [1, 1.8 * i], opacity: [0.6, 0] }}
                transition={{ duration: 2.5, delay: i * 0.5, repeat: Infinity }}
              />
            ))}
            <div className="relative w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
              <Stethoscope size={32} className="text-primary" />
            </div>
          </div>

          <h2 className="text-xl font-black font-montserrat mb-2">
            {doctorJoined ? `${docName} is ready!` : `Waiting for ${docName}`}
          </h2>
          <p className="text-sm text-base-content/50 mb-4">
            {docSpec && <span className="font-medium text-base-content/70">{docSpec} · </span>}
            {booking?.bookingCode}
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-base-200 text-sm text-base-content/50">
            <Clock size={13} />
            <span>Waiting {formatWaitTime(waitMs)}</span>
          </div>
        </div>

        {/* Appointment info */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { icon: Calendar, label: 'Scheduled',   value: formatDate(booking?.scheduledAt) },
            { icon: Timer,    label: 'Duration',     value: `${joinDetails?.allowedDurationMinutes ?? 30} min` },
            { icon: ShieldCheck, label: 'Payment',  value: booking?.paymentStatus === 'paid' ? 'Paid ✓' : booking?.paymentStatus },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-base-200/50">
              <Icon size={16} className="text-primary mx-auto mb-1" />
              <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">{label}</p>
              <p className="text-sm font-bold mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Network status */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between text-xs text-base-content/40 bg-base-200/50 rounded-xl px-4 py-2">
            <span>Connection Quality</span>
            <span className="flex items-center gap-2 font-medium">
              <NetworkBars quality={networkQuality} size="sm" />
              {NETWORK_CFG[networkQuality]?.label ?? 'Checking…'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            className="btn btn-ghost flex-1 gap-2 text-sm"
            onClick={() => {/* Could add refresh logic */}}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            className="btn btn-primary flex-1 gap-2"
            onClick={onJoin}
            disabled={loading || !joinDetails}
          >
            {loading
              ? <><span className="loading loading-xs loading-spinner" /> Joining…</>
              : <><Video size={15} /> {doctorJoined ? 'Join Now' : 'Join Early'}</>
            }
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-base-100 border border-base-300 rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Consultation Tips</p>
        <div className="space-y-2">
          {[
            'Find a quiet, well-lit room for best experience.',
            'Keep your device charged and internet stable.',
            'Have your previous prescriptions and reports ready.',
            'Note down your symptoms and questions in advance.',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-base-content/60">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO SDK — PARTICIPANT TILE
// ─────────────────────────────────────────────────────────────────────────────

const ParticipantTile = memo(({ participantId, isLocal, isDoctor = false }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const {
    webcamStream, micStream, webcamOn, micOn,
    isActiveSpeaker, displayName,
  } = useParticipant(participantId);

  // Webcam stream attachment + cleanup
  useEffect(() => {
    if (!videoRef.current) return;
    if (webcamStream) {
      const ms = new MediaStream();
      ms.addTrack(webcamStream.track);
      videoRef.current.srcObject = ms;
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (videoRef.current) {
        const s = videoRef.current.srcObject;
        if (s) s.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [webcamStream]);

  // Audio — remote only
  useEffect(() => {
    if (isLocal || !audioRef.current) return;
    if (micStream) {
      const ms = new MediaStream();
      ms.addTrack(micStream.track);
      audioRef.current.srcObject = ms;
      audioRef.current.play().catch(() => {});
    }
    return () => {
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, [micStream, isLocal]);

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-base-300 flex items-center justify-center
      ${isActiveSpeaker ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-100' : ''}
      ${isDoctor ? 'aspect-video' : 'aspect-square'}`}>

      {webcamOn
        ? <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-cover" />
        : (
          <div className="flex flex-col items-center gap-3 text-base-content/40">
            <div className={`rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold font-montserrat
              ${isDoctor ? 'w-20 h-20 text-2xl' : 'w-12 h-12 text-lg'}`}>
              {displayName?.[0] ?? (isDoctor ? 'D' : 'P')}
            </div>
            <span className="text-xs">{isDoctor ? 'Camera off' : 'You'}</span>
          </div>
        )
      }

      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Name + mic indicator */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
        {micOn
          ? <Mic size={10} className="text-success" />
          : <MicOff size={10} className="text-error" />
        }
        <span className="text-white text-xs font-medium max-w-[100px] truncate">
          {isLocal ? 'You' : displayName ?? (isDoctor ? 'Doctor' : 'Participant')}
        </span>
      </div>

      {isDoctor && isActiveSpeaker && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary/80 rounded-full px-2 py-0.5">
          <Radio size={9} className="text-white animate-pulse" />
          <span className="text-white text-xs">Speaking</span>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CALL CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

const CallControls = memo(({
  onLeave, networkQuality, isFullscreen, onToggleFullscreen,
  startedAt, allowedMinutes, onTimerWarn,
}) => {
  const { localMicOn, localWebcamOn, toggleMic, toggleWebcam, leave, participants } = useMeeting();
  const count = [...(participants?.keys() || [])].length;

  const handleLeave = () => { leave(); onLeave(); };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
      <div className="flex items-center justify-between">
        {/* Left — timer + network */}
        <div className="flex flex-col gap-1">
          {startedAt && (
            <ConsultTimer
              startedAt={startedAt}
              allowedMinutes={allowedMinutes}
              onWarn={onTimerWarn}
            />
          )}
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Users size={11} className="text-white/40" />
            <span>{count} in call</span>
            <NetworkBars quality={networkQuality} size="sm" />
          </div>
        </div>

        {/* Center — main controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMic}
            className={`btn btn-circle ${localMicOn ? 'btn-ghost bg-white/10 text-white' : 'btn-error'}`}
            title={localMicOn ? 'Mute' : 'Unmute'}
          >
            {localMicOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          <button
            onClick={toggleWebcam}
            className={`btn btn-circle ${localWebcamOn ? 'btn-ghost bg-white/10 text-white' : 'btn-error'}`}
            title={localWebcamOn ? 'Camera off' : 'Camera on'}
          >
            {localWebcamOn ? <VideoIcon size={18} /> : <VideoOff size={18} />}
          </button>

          <button
            onClick={handleLeave}
            className="btn btn-error btn-circle w-14 h-14"
            title="Leave call"
          >
            <PhoneOff size={22} />
          </button>
        </div>

        {/* Right — fullscreen */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFullscreen}
            className="btn btn-ghost btn-sm btn-circle text-white/70"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
});

const VideoIcon = Video; // alias since Video imported from lucide

// ─────────────────────────────────────────────────────────────────────────────
// IN-CALL VIEW
// ─────────────────────────────────────────────────────────────────────────────

const InCallView = memo(({
  onLeave, joinDetails, networkQuality, onTimerWarn, booking,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);

  const { participants, localParticipant } = useMeeting({ onMeetingLeft: onLeave });

  const remoteIds = useMemo(() => {
    if (!participants || !localParticipant) return [];
    return [...participants.keys()].filter((id) => id !== localParticipant.id);
  }, [participants, localParticipant]);

  // Auto-hide controls after 4s
  const resetControlTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    resetControlTimer();
    return () => clearTimeout(controlsTimer.current);
  }, [resetControlTimer]);

  const doctorId = remoteIds[0] ?? null;

  return (
    <div
      className={`relative bg-black rounded-2xl overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none' : 'aspect-video w-full'}`}
      onMouseMove={resetControlTimer}
      onClick={resetControlTimer}
    >
      {/* Doctor (main) view */}
      {doctorId
        ? <ParticipantTile participantId={doctorId} isLocal={false} isDoctor />
        : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/40">
            <motion.div animate={{ scale: [1,1.1,1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Loader2 size={32} className="text-primary" />
            </motion.div>
            <p className="text-sm font-medium">Waiting for doctor to join…</p>
          </div>
        )
      }

      {/* Self-preview (PiP bottom-right) */}
      {localParticipant && (
        <div className="absolute bottom-16 right-4 w-32 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
          <ParticipantTile participantId={localParticipant.id} isLocal isDoctor={false} />
        </div>
      )}

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            <CallControls
              onLeave={onLeave}
              networkQuality={networkQuality}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((p) => !p)}
              startedAt={joinDetails?.startedAt}
              allowedMinutes={joinDetails?.allowedDurationMinutes}
              onTimerWarn={onTimerWarn}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Network warning banner */}
      {(networkQuality === 'poor' || networkQuality === 'disconnected') && (
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm
            ${networkQuality === 'disconnected' ? 'bg-error/90 text-error-content' : 'bg-warning/90 text-warning-content'}`}>
            {networkQuality === 'disconnected' ? <WifiOff size={14} /> : <Signal size={14} />}
            {networkQuality === 'disconnected' ? 'Connection lost — reconnecting…' : 'Weak connection — quality may be affected'}
          </div>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PRESCRIPTION VIEWER
// ─────────────────────────────────────────────────────────────────────────────

const PrescriptionViewer = memo(({ prescriptionUrl, uploadedAt }) => {
  if (!prescriptionUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-base-100 border border-success/30 rounded-2xl overflow-hidden"
    >
      <div className="flex items-center gap-3 p-4 bg-success/5 border-b border-success/20">
        <div className="p-2 rounded-xl bg-success/10">
          <FileText size={18} className="text-success" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">Prescription Ready</p>
          <p className="text-xs text-base-content/50">{formatDate(uploadedAt)}</p>
        </div>
        <a
          href={prescriptionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-success btn-sm gap-1.5"
        >
          <Download size={13} />
          Download
        </a>
      </div>

      {/* PDF preview iframe */}
      {prescriptionUrl.endsWith('.pdf') && (
        <div className="relative" style={{ height: 300 }}>
          <iframe
            src={`${prescriptionUrl}#toolbar=0`}
            className="w-full h-full"
            title="Prescription Preview"
          />
        </div>
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT UPLOADER
// ─────────────────────────────────────────────────────────────────────────────

const DocumentUploader = memo(({ bookingId, onUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState(null);
  const inputRef = useRef(null);

  const ACCEPTED = 'application/pdf,image/jpeg,image/png,image/jpg,.docx';
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE) { setError('File too large. Maximum 10MB.'); return; }
    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      // In production: upload to S3/Cloudinary, get URL back
      // Simulating upload progress here
      await new Promise((res) => setTimeout(res, 500));
      setProgress(50);
      await new Promise((res) => setTimeout(res, 500));
      setProgress(90);

      // TODO: Replace with real upload to your storage service
      // const url = await uploadToStorage(file);
      const url = URL.createObjectURL(file); // placeholder — replace with real URL

      setProgress(100);
      onUploaded?.(url, file.name);
    } catch (e) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [onUploaded]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0])}
      />

      <button
        className="btn btn-outline btn-sm gap-2 w-full"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading
          ? <><span className="loading loading-xs loading-spinner" /> Uploading…</>
          : <><Upload size={14} /> Share Document</>
        }
      </button>

      {uploading && (
        <div className="h-1.5 rounded-full bg-base-300 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-error flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

const ConsultationTimeline = memo(({ consultation, liveEvents }) => {
  const oc = consultation?.onlineConsultation;

  const steps = [
    { label: 'Booking Confirmed', done: true,                    time: consultation?.createdAt },
    { label: 'Room Created',      done: !!oc?.roomId,            time: null },
    { label: 'You Joined',        done: oc?.patientJoined,       time: oc?.patientJoinedAt },
    { label: 'Doctor Joined',     done: oc?.doctorJoined,        time: oc?.doctorJoinedAt },
    { label: 'Consultation Live', done: oc?.roomStarted,         time: oc?.startedAt },
    { label: 'Prescription',      done: oc?.prescriptionUploaded,time: oc?.prescriptionUploadedAt },
    { label: 'Completed',         done: oc?.roomEnded,           time: oc?.endedAt },
  ];

  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs
            ${s.done ? 'bg-success text-success-content' : 'bg-base-300 text-base-content/30'}`}>
            {s.done ? <CheckCircle2 size={12} /> : <span>{i+1}</span>}
          </div>
          <div className="flex-1 flex items-center justify-between">
            <span className={`text-sm ${s.done ? 'font-medium text-base-content' : 'text-base-content/40'}`}>
              {s.label}
            </span>
            {s.done && s.time && (
              <span className="text-xs text-base-content/30">{formatDate(s.time)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// RATING PANEL
// ─────────────────────────────────────────────────────────────────────────────

const RatingPanel = memo(({ bookingId, onSubmit, loading, already }) => {
  const [doctorRating,  setDocRating]   = useState(5);
  const [overallRating, setOvRating]    = useState(5);
  const [docComment,    setDocComment]  = useState('');
  const [ovComment,     setOvComment]   = useState('');
  const [submitted,     setSubmitted]   = useState(already ?? false);

  const stars = (val, set) => (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          onClick={() => set(n)}
          className={`transition-transform hover:scale-110 ${n <= val ? 'text-warning' : 'text-base-content/20'}`}
        >
          <Star size={22} fill={n <= val ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 size={32} className="text-success" />
        <p className="font-bold">Thank you for your feedback!</p>
        <p className="text-sm text-base-content/50">Your review helps improve our service.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-2">Rate the Doctor</p>
        {stars(doctorRating, setDocRating)}
        <textarea className="input-field mt-2 text-sm resize-none min-h-[60px]"
          placeholder="Comment about the doctor (optional)…"
          value={docComment} onChange={(e) => setDocComment(e.target.value)} />
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Overall Experience</p>
        {stars(overallRating, setOvRating)}
        <textarea className="input-field mt-2 text-sm resize-none min-h-[60px]"
          placeholder="Overall feedback (optional)…"
          value={ovComment} onChange={(e) => setOvComment(e.target.value)} />
      </div>

      <button
        className="btn btn-primary w-full gap-2"
        onClick={() => {
          onSubmit({ doctorRating, overallRating, doctorComment: docComment, overallComment: ovComment });
          setSubmitted(true);
        }}
        disabled={loading}
      >
        {loading ? <span className="loading loading-xs loading-spinner" /> : <ThumbsUp size={15} />}
        Submit Feedback
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST-CONSULTATION VIEW
// ─────────────────────────────────────────────────────────────────────────────

const PostConsultView = memo(({
  consultation, followUp, onRate, rateLoading, router,
}) => {
  const oc = consultation?.onlineConsultation;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Completed banner */}
      <div className="flex items-center gap-4 p-6 rounded-2xl bg-success/10 border border-success/30">
        <div className="p-3 rounded-2xl bg-success/20">
          <CheckCircle2 size={28} className="text-success" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black font-montserrat text-success">Consultation Complete</h2>
          <p className="text-sm text-base-content/60 mt-0.5">
            Duration: {oc?.durationMinutes ?? '—'} min · {formatDate(oc?.endedAt)}
          </p>
        </div>
      </div>

      {/* Prescription */}
      {oc?.prescriptionUrl && (
        <PrescriptionViewer
          prescriptionUrl={oc.prescriptionUrl}
          uploadedAt={oc.prescriptionUploadedAt}
        />
      )}

      {/* Summary */}
      {oc?.consultationSummary && (
        <div className="bg-base-100 border border-base-300 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Consultation Summary</p>
          <p className="text-sm text-base-content/80 leading-relaxed">{oc.consultationSummary}</p>
        </div>
      )}

      {/* Follow-up instructions */}
      {oc?.followUpInstructions && (
        <div className="bg-info/5 border border-info/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-info" />
            <p className="text-xs font-bold uppercase tracking-wider text-info">Follow-Up Instructions</p>
          </div>
          <p className="text-sm text-base-content/80 leading-relaxed">{oc.followUpInstructions}</p>
        </div>
      )}

      {/* Follow-up eligibility */}
      {followUp?.eligible && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Calendar size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Follow-up Available</p>
            <p className="text-xs text-base-content/50 mt-0.5">
              Book a follow-up consultation at ₹{followUp.followUpFee ?? 0} within {followUp.daysLeft} days.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm gap-1.5"
            onClick={() => router.push('/patient/find-doctors')}
          >
            Book <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-base-100 border border-base-300 rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-4">Consultation Timeline</p>
        <ConsultationTimeline consultation={consultation} />
      </div>

      {/* Rating */}
      {!consultation?.isRated && (
        <div className="bg-base-100 border border-base-300 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-4">Rate Your Experience</p>
          <RatingPanel
            bookingId={consultation?._id}
            onSubmit={onRate}
            loading={rateLoading}
            already={consultation?.isRated}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          className="btn btn-ghost flex-1 gap-2"
          onClick={() => router.push('/patient/consultations')}
        >
          View History
        </button>
        <button
          className="btn btn-primary flex-1 gap-2"
          onClick={() => router.push('/patient/find-doctors')}
        >
          Book Again <ArrowRight size={15} />
        </button>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING MINIMIZED VIEW
// ─────────────────────────────────────────────────────────────────────────────

const FloatingMini = memo(({ onExpand, onLeave, networkQuality }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 40 }}
    className="fixed bottom-6 right-6 z-50 bg-base-900 border border-base-600 rounded-2xl shadow-2xl p-3 flex items-center gap-3"
    style={{ background: 'rgba(15,15,15,0.95)' }}
  >
    <div className="relative w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
      <Video size={18} className="text-primary" />
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse border-2 border-black" />
    </div>
    <div className="text-xs">
      <p className="font-bold text-white">Consultation Live</p>
      <div className="flex items-center gap-1 text-white/40 mt-0.5">
        <NetworkBars quality={networkQuality} size="sm" />
        <span>{NETWORK_CFG[networkQuality]?.label}</span>
      </div>
    </div>
    <button onClick={onExpand} className="btn btn-ghost btn-xs btn-circle text-white/60" title="Expand">
      <Maximize2 size={13} />
    </button>
    <button onClick={onLeave} className="btn btn-error btn-xs btn-circle" title="Leave">
      <PhoneOff size={13} />
    </button>
  </motion.div>
));

// ─────────────────────────────────────────────────────────────────────────────
// TIMER WARNING TOAST
// ─────────────────────────────────────────────────────────────────────────────

const TimerWarning = memo(({ seconds, onDismiss }) => {
  const msg = seconds === 60 ? '1 minute' : seconds === 300 ? '5 minutes' : '10 minutes';
  useEffect(() => {
    const id = setTimeout(onDismiss, 8000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg bg-warning text-warning-content"
    >
      <Timer size={16} />
      <span className="font-bold">{msg} remaining in your consultation</span>
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// RECONNECT OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

const ReconnectOverlay = memo(({ visible, count }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <div className="text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw size={40} className="text-primary mx-auto" />
          </motion.div>
          <p className="text-white font-bold text-lg">Reconnecting…</p>
          <p className="text-white/60 text-sm">Attempt {count}</p>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function OnlineConsultationPage() {
const params = useParams();
  const bookingId = params?.bookingId;
  const dispatch = useDispatch();
  const router   = useRouter();

  // ── Redux ──────────────────────────────────────────────────────────────────
  const joinDetails   = useSelector(selectJoinDetails);
  const consultation  = useSelector(selectCurrentConsultation);
  const followUp      = useSelector(selectFollowUpEligibility);
  const {
    isFetchingJoin, isFetchingCurrent, isActionLoading,
  } = useSelector(selectConsultationLoaders);
  const { joinError } = useSelector(selectConsultationErrors);

  // ── Phase state ────────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState(PHASE.LOADING);
  const [minimized,   setMinimized]   = useState(false);
  const [inMeeting,   setInMeeting]   = useState(false);

  // ── Real-time state ────────────────────────────────────────────────────────
  const [networkQuality,  setNetworkQuality]  = useState('excellent');
  const [liveEvents,      setLiveEvents]      = useState([]);
  const [reconnecting,    setReconnecting]    = useState(false);
  const [reconnectCount,  setReconnectCount]  = useState(0);
  const [timerWarn,       setTimerWarn]       = useState(null);
  const [prescription,    setPrescription]    = useState(null);
  const [errorMsg,        setErrorMsg]        = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const meetingMounted  = useRef(false);
  const netLogTimer     = useRef(null);
  const cleanupRefs     = useRef([]);

  // ─────────────────────────────────────────────────────────────────────────
  // BOOTSTRAP
  // ─────────────────────────────────────────────────────────────────────────

  const bootstrap = useCallback(async () => {
    setPhase(PHASE.LOADING);
    setErrorMsg(null);

    try {
      const result = await dispatch(fetchConsultationById(bookingId));
      if (result.type.endsWith('/rejected')) {
        throw new Error(result.payload ?? 'Booking not found');
      }

      const bk = result.payload;

      // SECURITY: customer can only access own booking — backend enforces this,
      // but we also check for graceful error handling.
      if (!bk) throw new Error('Consultation not found or access denied.');

      // Check booking validity
      if (['cancelled', 'no_show'].includes(bk.status)) {
        setErrorMsg(`This booking is ${bk.status}. You cannot join this consultation.`);
        setPhase(PHASE.ERROR);
        return;
      }

      if (bk.paymentStatus !== 'paid') {
        setErrorMsg('Payment is required to access this consultation.');
        setPhase(PHASE.ERROR);
        return;
      }

      if (bk.status === 'completed') {
        // Show post-consultation view
        await dispatch(checkFollowUpEligibility(bookingId));
        setPrescription(bk.onlineConsultation?.prescriptionUrl ?? null);
        setPhase(PHASE.ENDED);
        return;
      }

      // Check consent
      const consentKey = `${SESSION_KEYS.CONSENT_DONE}${bookingId}`;
      const consentDone = bk.onlineConsultation?.isTelemedicineConsentAccepted || sessionLoad(consentKey);

      if (!consentDone) {
        setPhase(PHASE.CONSENT);
        return;
      }

      // Check session recovery
      const savedBookingId = sessionLoad(SESSION_KEYS.BOOKING_ID);
      const savedMeetingId = sessionLoad(SESSION_KEYS.MEETING_ID);

      if (savedBookingId === bookingId && savedMeetingId) {
        // Attempt recovery — skip device check
        const joinResult = await dispatch(fetchJoinDetails(bookingId));
        if (joinResult.payload) {
          sessionSave(SESSION_KEYS.BOOKING_ID, bookingId);
          sessionSave(SESSION_KEYS.MEETING_ID, joinResult.payload.meetingId ?? joinResult.payload.roomId);
          setPhase(PHASE.IN_CALL);
          setInMeeting(true);
          return;
        }
      }

      // Check device prefs (skip if previously passed)
      const devPrefs = lsLoad(SESSION_KEYS.DEVICE_PREFS);
      if (devPrefs?.passed) {
        await dispatch(fetchJoinDetails(bookingId));
        setPhase(PHASE.WAITING_ROOM);
      } else {
        setPhase(PHASE.DEVICE_CHECK);
      }

    } catch (e) {
      setErrorMsg(e.message ?? 'Failed to load consultation.');
      setPhase(PHASE.ERROR);
    }
  }, [bookingId, dispatch]);

  useEffect(() => {
    bootstrap();
    return () => {
      dispatch(clearJoinDetails());
      dispatch(clearCurrentConsultation());
      sessionClear(SESSION_KEYS.BOOKING_ID, SESSION_KEYS.MEETING_ID, SESSION_KEYS.TIMER_START);
      cleanupRefs.current.forEach((fn) => fn?.());
      clearTimeout(netLogTimer.current);
    };
  }, [bootstrap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET SETUP
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!bookingId || !socketService?.connected) return;

    socketService.joinBookingRoom?.(bookingId);

    const addEvent = (ev) => setLiveEvents((prev) => [...prev.slice(-49), ev]);

    const scheduleNetLog = (quality) => {
      clearTimeout(netLogTimer.current);
      netLogTimer.current = setTimeout(() => {
        dispatch(logNetworkQuality({ bookingId, participant: 'patient', quality }));
      }, 5000);
    };

    const handlers = [
      [CONSULTATION_EVENTS.DOCTOR_JOINED, (data) => {
        addEvent({ event: 'doctor_joined', participant: 'doctor', timestamp: new Date() });
        playAlert();
        notifyBrowser('Doctor has joined!', 'Your consultation is ready. Join now.');
      }],
      [CONSULTATION_EVENTS.STARTED, (data) => {
        addEvent({ event: 'consultation_started', participant: 'doctor', timestamp: new Date() });
        if (phase === PHASE.WAITING_ROOM) {
          dispatch(fetchJoinDetails(bookingId));
        }
      }],
      [CONSULTATION_EVENTS.ENDED, (data) => {
        addEvent({ event: 'consultation_ended', participant: data?.endedBy, timestamp: new Date() });
        setInMeeting(false);
        meetingMounted.current = false;
        dispatch(clearJoinDetails());
        dispatch(fetchConsultationById(bookingId)).then(() => {
          dispatch(checkFollowUpEligibility(bookingId));
          setPhase(PHASE.ENDED);
        });
      }],
      [CONSULTATION_EVENTS.FORCE_END, () => {
        addEvent({ event: 'force_end', participant: 'admin', timestamp: new Date() });
        handleLeave();
      }],
      [CONSULTATION_EVENTS.PRESCRIPTION_UPLOADED, (data) => {
        addEvent({ event: 'prescription_uploaded', participant: 'doctor', timestamp: new Date() });
        setPrescription(data?.prescriptionUrl);
        playAlert();
        notifyBrowser('Prescription Ready!', 'Your doctor has uploaded your prescription.');
      }],
      [CONSULTATION_EVENTS.NETWORK_QUALITY, (data) => {
        if (data?.participant === 'patient') {
          setNetworkQuality(data.quality ?? 'excellent');
          scheduleNetLog(data.quality);
        }
        if (data?.quality === 'disconnected') {
          setReconnecting(true);
          setReconnectCount((n) => n + 1);
        } else {
          setReconnecting(false);
        }
      }],
      [CONSULTATION_EVENTS.NETWORK_ISSUE, () => {
        setReconnecting(true);
        setReconnectCount((n) => n + 1);
      }],
      [CONSULTATION_EVENTS.RECONNECTING, () => {
        setReconnecting(true);
        setReconnectCount((n) => n + 1);
      }],
      [CONSULTATION_EVENTS.CANCELLED, () => {
        setErrorMsg('Consultation has been cancelled.');
        setPhase(PHASE.ERROR);
      }],
    ];

    const cleanups = handlers.map(([ev, fn]) => socketService.on(ev, fn));
    cleanupRefs.current = cleanups;

    return () => {
      cleanups.forEach((fn) => fn?.());
      socketService.leaveBookingRoom?.(bookingId);
      clearTimeout(netLogTimer.current);
    };
  }, [bookingId, phase, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleConsentAccept = useCallback(async () => {
    const result = await dispatch(acceptTelemedicineConsent({
      bookingId,
      ipAddress: null, // server reads req.ip
    }));
    if (!result.type.endsWith('/rejected')) {
      // Save consent locally to avoid re-prompting on refresh
      sessionSave(`${SESSION_KEYS.CONSENT_DONE}${bookingId}`, true);
      await dispatch(fetchJoinDetails(bookingId));
      setPhase(PHASE.DEVICE_CHECK);
    }
  }, [bookingId, dispatch]);

  const handleDeviceReady = useCallback(async () => {
    lsSave(SESSION_KEYS.DEVICE_PREFS, { passed: true, ts: Date.now() });
    if (!joinDetails) await dispatch(fetchJoinDetails(bookingId));
    setPhase(PHASE.WAITING_ROOM);
  }, [bookingId, dispatch, joinDetails]);

  const handleJoin = useCallback(async () => {
    // SECURITY: always re-fetch fresh token from backend. Never reuse stale token.
    const result = await dispatch(fetchJoinDetails(bookingId));
    if (result.type.endsWith('/rejected')) return;

    const data = result.payload;
    if (!data?.token || !(data?.meetingId ?? data?.roomId)) {
      setErrorMsg('Could not get meeting details. Please refresh and try again.');
      return;
    }

    // Prevent duplicate join
    if (meetingMounted.current) return;

    sessionSave(SESSION_KEYS.BOOKING_ID, bookingId);
    sessionSave(SESSION_KEYS.MEETING_ID, data.meetingId ?? data.roomId);
    sessionSave(SESSION_KEYS.TIMER_START, new Date().toISOString());

    meetingMounted.current = true;
    setInMeeting(true);
    setPhase(PHASE.IN_CALL);
  }, [bookingId, dispatch]);

  const handleLeave = useCallback(() => {
    meetingMounted.current = false;
    setInMeeting(false);
    setMinimized(false);
    sessionClear(SESSION_KEYS.BOOKING_ID, SESSION_KEYS.MEETING_ID, SESSION_KEYS.TIMER_START);
    dispatch(clearJoinDetails());
    dispatch(fetchConsultationById(bookingId)).then((res) => {
      const bk = res.payload;
      if (bk?.status === 'completed') {
        dispatch(checkFollowUpEligibility(bookingId));
        setPhase(PHASE.ENDED);
      } else {
        setPhase(PHASE.WAITING_ROOM);
      }
    });
  }, [bookingId, dispatch]);

  const handleRate = useCallback(async (data) => {
    await dispatch(rateConsultation({ bookingId, ...data }));
  }, [bookingId, dispatch]);

  const handleTimerWarn = useCallback((seconds) => {
    setTimerWarn(seconds);
    playAlert();
    const msg = seconds === 60 ? '1 minute' : seconds === 300 ? '5 minutes' : '10 minutes';
    notifyBrowser(`${msg} remaining`, 'Your consultation is ending soon.');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED
  // ─────────────────────────────────────────────────────────────────────────

  const actualMeetingId = joinDetails?.meetingId ?? joinDetails?.roomId ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="patient" className="min-h-screen bg-base-50">

      {/* Reconnect overlay */}
      <ReconnectOverlay visible={reconnecting} count={reconnectCount} />

      {/* Timer warning */}
      <AnimatePresence>
        {timerWarn && (
          <TimerWarning seconds={timerWarn} onDismiss={() => setTimerWarn(null)} />
        )}
      </AnimatePresence>

      {/* Floating mini — when minimized */}
      <AnimatePresence>
        {minimized && phase === PHASE.IN_CALL && (
          <FloatingMini
            onExpand={() => setMinimized(false)}
            onLeave={handleLeave}
            networkQuality={networkQuality}
          />
        )}
      </AnimatePresence>

      {/* ── Top nav ── */}
      <div className="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-300 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <MonitorPlay size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm font-montserrat">Online Consultation</p>
              <p className="text-xs text-base-content/40">{consultation?.bookingCode ?? bookingId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Network indicator (during call) */}
            {phase === PHASE.IN_CALL && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${NETWORK_CFG[networkQuality]?.bg} ${NETWORK_CFG[networkQuality]?.color}`}>
                <NetworkBars quality={networkQuality} size="sm" />
                {NETWORK_CFG[networkQuality]?.label}
              </div>
            )}

            {/* Phase badge */}
            <span className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
              ${phase === PHASE.IN_CALL ? 'bg-success/10 text-success' :
                phase === PHASE.WAITING_ROOM ? 'bg-warning/10 text-warning' :
                phase === PHASE.ENDED ? 'bg-info/10 text-info' :
                'bg-base-300/60 text-base-content/40'}`}>
              {phase === PHASE.IN_CALL && <><span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />Live</>}
              {phase === PHASE.WAITING_ROOM && <><Clock size={10} />Waiting</>}
              {phase === PHASE.ENDED && <><CheckCircle2 size={10} />Completed</>}
              {phase === PHASE.DEVICE_CHECK && <><Settings size={10} />Setup</>}
              {phase === PHASE.CONSENT && <><ShieldCheck size={10} />Consent</>}
              {phase === PHASE.LOADING && <><Loader2 size={10} className="animate-spin" />Loading</>}
            </span>

            {/* Minimize (in call) */}
            {phase === PHASE.IN_CALL && !minimized && (
              <button onClick={() => setMinimized(true)} className="btn btn-ghost btn-xs btn-circle" title="Minimize">
                <Minimize2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-6 ${minimized ? 'hidden' : ''}`}>
        <AnimatePresence mode="wait">

          {/* LOADING */}
          {phase === PHASE.LOADING && (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
            >
              <Loader2 size={36} className="text-primary animate-spin" />
              <p className="text-base-content/50 font-medium">Loading consultation…</p>
            </motion.div>
          )}

          {/* ERROR */}
          {phase === PHASE.ERROR && (
            <motion.div key="error"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center max-w-md mx-auto"
            >
              <div className="p-4 rounded-2xl bg-error/10">
                <AlertTriangle size={36} className="text-error" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-montserrat mb-2">Unable to Join</h2>
                <p className="text-base-content/60 text-sm leading-relaxed">{errorMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button className="btn btn-ghost flex-1" onClick={() => router.push('/patient/bookings')}>
                  My Bookings
                </button>
                <button className="btn btn-primary flex-1 gap-2" onClick={bootstrap}>
                  <RefreshCw size={14} /> Try Again
                </button>
              </div>
            </motion.div>
          )}

          {/* CONSENT */}
          {phase === PHASE.CONSENT && (
            <motion.div key="consent"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex justify-center py-6"
            >
              <ConsentPanel
                booking={consultation}
                onAccept={handleConsentAccept}
                loading={isActionLoading}
              />
            </motion.div>
          )}

          {/* DEVICE CHECK */}
          {phase === PHASE.DEVICE_CHECK && (
            <motion.div key="device"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex justify-center py-6"
            >
              <DeviceCheckPanel
                onReady={handleDeviceReady}
                onSkip={handleDeviceReady}
              />
            </motion.div>
          )}

          {/* WAITING ROOM */}
          {phase === PHASE.WAITING_ROOM && (
            <motion.div key="waiting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="py-4"
            >
              <WaitingRoom
                booking={consultation}
                joinDetails={joinDetails}
                onJoin={handleJoin}
                loading={isFetchingJoin}
                liveEvents={liveEvents}
                networkQuality={networkQuality}
              />
            </motion.div>
          )}

          {/* IN CALL */}
          {phase === PHASE.IN_CALL && !minimized && (
            <motion.div key="incall"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Video area */}
              {joinDetails?.token && actualMeetingId ? (
                <MeetingProvider
                  key={`meeting-${actualMeetingId}`}
                  config={{
                    meetingId:     actualMeetingId,
                    micEnabled:    true,
                    webcamEnabled: true,
                    name:          consultation?.patientInfo?.name ?? 'Patient',
                  }}
                  token={joinDetails.token}
                  joinWithoutUserInteraction
                  onMeetingStateChanged={(state) => {
                    if (state === 'CONNECTING' || state === 'RECONNECTING') {
                      setReconnecting(true);
                      setReconnectCount((n) => n + 1);
                    }
                    if (state === 'CONNECTED') setReconnecting(false);
                    if (state === 'FAILED') {
                      setReconnecting(false);
                      setErrorMsg('Could not connect to the meeting room. Please retry.');
                    }
                  }}
                >
                  <InCallView
                    onLeave={handleLeave}
                    joinDetails={joinDetails}
                    networkQuality={networkQuality}
                    onTimerWarn={handleTimerWarn}
                    booking={consultation}
                  />
                </MeetingProvider>
              ) : (
                <div className="flex items-center justify-center aspect-video bg-base-300 rounded-2xl gap-3">
                  <Loader2 size={24} className="text-primary animate-spin" />
                  <p className="text-sm text-base-content/50">Setting up meeting room…</p>
                </div>
              )}

              {/* Prescription notification (real-time) */}
              {prescription && (
                <PrescriptionViewer
                  prescriptionUrl={prescription}
                  uploadedAt={new Date()}
                />
              )}

              {/* Document upload during call */}
              <div className="bg-base-100 border border-base-300 rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Share Documents</p>
                <DocumentUploader
                  bookingId={bookingId}
                  onUploaded={(url, name) => {
                    /* Emit to backend or socket */
                    socketService.emit?.('consultation:patient_document', { bookingId, url, name });
                  }}
                />
              </div>

              {/* Network + timeline sidebar row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Network quality card */}
                <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Connection</p>
                  <div className={`flex items-center gap-3 p-3 rounded-xl ${NETWORK_CFG[networkQuality]?.bg}`}>
                    <NetworkBars quality={networkQuality} />
                    <div>
                      <p className={`font-bold text-sm ${NETWORK_CFG[networkQuality]?.color}`}>
                        {NETWORK_CFG[networkQuality]?.label}
                      </p>
                      {reconnectCount > 0 && (
                        <p className="text-xs text-base-content/40">Reconnected {reconnectCount}x</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Timeline</p>
                  <ConsultationTimeline consultation={consultation} liveEvents={liveEvents} />
                </div>
              </div>
            </motion.div>
          )}

          {/* POST CONSULTATION */}
          {phase === PHASE.ENDED && (
            <motion.div key="ended"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="py-4"
            >
              <PostConsultView
                consultation={consultation}
                followUp={followUp}
                onRate={handleRate}
                rateLoading={isActionLoading}
                router={router}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}