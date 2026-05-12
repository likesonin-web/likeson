'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Activity, FileText, CheckCircle2, Clock, AlertCircle, Search,
  Filter, ChevronDown, ChevronRight, Calendar, User, Hospital,
  Stethoscope, RefreshCw, Download, Eye, ClipboardList, X,
  TrendingUp, Users, Zap, MoreVertical, ArrowUpRight, Star,
  BookOpen, Pill, FlaskConical, Phone, Mail, BadgeCheck,
  ChevronLeft, SlidersHorizontal, RotateCcw, Save
} from 'lucide-react';

import {
  fetchDoctorOps,
  fetchDoctorOpByNumber,
  completeOp,
  selectDoctorOps,
  selectDoctorOpsMeta,
  selectDoctorOpDetail,
  selectDoctorOpFollowUps,
  selectDoctorOpDetailMeta,
  selectOpCompleteAction,
  selectOpCompleteLoading,
  resetOpCompleteAction,
  clearDoctorOpDetail,
} from '@/store/slices/operationsSlice';

import {
  fetchMyDoctorProfile,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_META = {
  scheduled:   { label: 'Scheduled',   color: '#3b82f6', bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  completed:   { label: 'Completed',   color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  cancelled:   { label: 'Cancelled',   color: '#ef4444', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
  no_show:     { label: 'No Show',     color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
};

const CONSULT_ICONS = {
  in_person:  { icon: Stethoscope, label: 'In Person',   color: 'text-blue-600'   },
  video:      { icon: Activity,    label: 'Video',        color: 'text-violet-600' },
  home_visit: { icon: Hospital,    label: 'Home Visit',   color: 'text-emerald-600'},
  follow_up:  { icon: RefreshCw,   label: 'Follow Up',    color: 'text-amber-600'  },
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

const slideIn = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit:   { opacity: 0, x: 40, transition: { duration: 0.25 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:   { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (date) => date
  ? new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

const fmtDate = (date) => date
  ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const buildChartData = (ops = []) => {
  const byDay = {};
  ops.forEach(op => {
    const day = new Date(op.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    byDay[day] = (byDay[day] || 0) + 1;
  });
  return Object.entries(byDay).slice(-7).map(([day, count]) => ({ day, count }));
};

const buildStatusPie = (ops = []) => {
  const counts = {};
  ops.forEach(op => { counts[op.status] = (counts[op.status] || 0) + 1; });
  return Object.entries(counts).map(([status, value]) => ({
    name: STATUS_META[status]?.label || status,
    value,
    color: STATUS_META[status]?.color || '#94a3b8',
  }));
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.scheduled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} flex-shrink-0`} />
      {m.label}
    </span>
  );
};

const ConsultTypeBadge = ({ type }) => {
  const m = CONSULT_ICONS[type] || CONSULT_ICONS.in_person;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.color}`}>
      <Icon size={12} />
      {m.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color, delay = 0 }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    animate="show"
    transition={{ delay }}
    className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 group"
  >
    <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 group-hover:opacity-10 transition-opacity"
      style={{ background: color }} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-800" style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
          {value}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-xl px-4 py-3">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-800">{payload[0].value} OPs</p>
    </div>
  );
};

// ─── Complete OP Modal ────────────────────────────────────────────────────────

const CompleteOpModal = ({ op, onClose, onSubmit, loading }) => {
  const [form, setForm] = useState({
    doctorNotes:     '',
    prescriptionUrl: '',
    diagnosisCode:   '',
    reasonForVisit:  op?.reasonForVisit || '',
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.doctorNotes.trim()) return;
    onSubmit({ bookingId: op.booking?._id || op.booking, ...form });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose} />
      <motion.div
        variants={scaleIn} initial="hidden" animate="show" exit="exit"
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Complete Consultation</h3>
              <p className="text-xs text-slate-500">{op?.opNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Doctor Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.doctorNotes}
              onChange={set('doctorNotes')}
              rows={4}
              placeholder="Clinical observations, treatment plan, recommendations..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Reason for Visit
            </label>
            <input
              value={form.reasonForVisit}
              onChange={set('reasonForVisit')}
              placeholder="Chief complaint..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                ICD-10 Code
              </label>
              <input
                value={form.diagnosisCode}
                onChange={set('diagnosisCode')}
                placeholder="e.g. J06.9"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Prescription URL
              </label>
              <input
                value={form.prescriptionUrl}
                onChange={set('prescriptionUrl')}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading || !form.doctorNotes.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
              : <><Save size={15} />Complete OP</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── OP Detail Panel ──────────────────────────────────────────────────────────

const OpDetailPanel = ({ opNumber, onClose, dispatch }) => {
  const op        = useSelector(selectDoctorOpDetail);
  const followUps = useSelector(selectDoctorOpFollowUps);
  const meta      = useSelector(selectDoctorOpDetailMeta);
  const complete  = useSelector(selectOpCompleteAction);
  const complLoading = useSelector(selectOpCompleteLoading);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  useEffect(() => {
    if (opNumber) dispatch(fetchDoctorOpByNumber(opNumber));
    return () => dispatch(clearDoctorOpDetail());
  }, [opNumber, dispatch]);

  useEffect(() => {
    if (complete.status === 'success') {
      setShowCompleteModal(false);
      dispatch(resetOpCompleteAction());
      dispatch(fetchDoctorOpByNumber(opNumber));
    }
  }, [complete.status]);

  const handleComplete = (payload) => dispatch(completeOp(payload));

  if (meta.status === 'loading') return (
    <motion.div variants={slideIn} initial="hidden" animate="show" exit="exit"
      className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-40 flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </motion.div>
  );

  if (!op) return null;

  const statusM = STATUS_META[op.status] || STATUS_META.scheduled;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-30"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)' }}
      />
      <motion.div
        variants={slideIn} initial="hidden" animate="show" exit="exit"
        className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-40 overflow-y-auto"
      >
        {/* Panel header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-100 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)' }}>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/80 flex items-center justify-center hover:bg-white transition-colors shadow-sm">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-800 text-lg truncate">{op.opNumber}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={op.status} />
              <ConsultTypeBadge type={op.consultationType} />
            </div>
          </div>
          {op.status === 'scheduled' || op.status === 'in_progress' ? (
            <button onClick={() => setShowCompleteModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 shadow-md"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <CheckCircle2 size={15} />Complete
            </button>
          ) : null}
        </div>

        <div className="p-6 space-y-6">
          {/* Patient info */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User size={22} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">{op.patient?.name || '—'}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {op.patient?.phone && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone size={11} />{op.patient.phone}
                    </span>
                  )}
                  {op.patient?.email && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Mail size={11} />{op.patient.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Appointment details */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Scheduled', value: fmt(op.scheduledAt), icon: Calendar },
              { label: 'Hospital',  value: op.hospital?.name || '—', icon: Hospital },
              { label: 'Booking',   value: op.booking?.bookingCode || '—', icon: ClipboardList },
              { label: 'Fee',       value: `₹${op.consultationFee || 0}`, icon: Star },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                  <Icon size={11} />{label}
                </p>
                <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Follow-up eligibility */}
          {op.followUpExpiry && (
            <div className={`rounded-xl p-4 border ${op.isFollowUpEligible
              ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={14} className={op.isFollowUpEligible ? 'text-emerald-600' : 'text-slate-400'} />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Follow-Up</p>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {op.isFollowUpEligible
                  ? `Eligible · ${op.daysUntilFollowUpExpiry ?? '?'} days remaining`
                  : 'Expired'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Expiry: {fmtDate(op.followUpExpiry)} · Fee: ₹{op.followUpFee || 0}
              </p>
            </div>
          )}

          {/* Clinical notes */}
          {op.reasonForVisit && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reason for Visit</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">{op.reasonForVisit}</p>
            </div>
          )}

          {op.doctorNotes && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Doctor Notes</p>
              <p className="text-sm text-slate-700 bg-blue-50 rounded-xl px-4 py-3 leading-relaxed">{op.doctorNotes}</p>
            </div>
          )}

          {op.diagnosisCode && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
              <FlaskConical size={13} className="text-violet-600" />
              <span className="text-xs font-semibold text-violet-700">ICD-10: {op.diagnosisCode}</span>
            </div>
          )}

          {op.prescriptionUrl && (
            <a href={op.prescriptionUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
              <Pill size={15} />View Prescription
              <ArrowUpRight size={13} className="ml-auto" />
            </a>
          )}

          {/* Follow-ups */}
          {followUps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Follow-Up Visits ({followUps.length})</p>
              {followUps.map(fu => (
                <div key={fu._id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <RefreshCw size={14} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{fu.opNumber}</p>
                    <p className="text-xs text-slate-400">{fmtDate(fu.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={fu.status} />
                </div>
              ))}
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            {op.startedAt   && <p className="text-xs text-slate-400">Started: {fmt(op.startedAt)}</p>}
            {op.completedAt && <p className="text-xs text-slate-400">Completed: {fmt(op.completedAt)}</p>}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCompleteModal && (
          <CompleteOpModal
            op={op}
            onClose={() => { setShowCompleteModal(false); dispatch(resetOpCompleteAction()); }}
            onSubmit={handleComplete}
            loading={complLoading}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ─── OP Row ───────────────────────────────────────────────────────────────────

const OpRow = ({ op, onSelect, idx }) => {
  const statusM = STATUS_META[op.status] || STATUS_META.scheduled;
  return (
    <motion.tr
      variants={fadeUp}
      custom={idx}
      whileHover={{ backgroundColor: 'rgba(239,246,255,0.6)' }}
      onClick={() => onSelect(op.opNumber)}
      className="cursor-pointer border-b border-slate-50 transition-colors group"
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FileText size={14} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{op.opNumber}</p>
            <p className="text-xs text-slate-400">{op.booking?.bookingCode || '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">{op.patient?.name || '—'}</p>
          <p className="text-xs text-slate-400">{op.patient?.phone || '—'}</p>
        </div>
      </td>
      <td className="px-5 py-4">
        <ConsultTypeBadge type={op.consultationType} />
      </td>
      <td className="px-5 py-4">
        <p className="text-sm text-slate-700">{fmtDate(op.scheduledAt)}</p>
        <p className="text-xs text-slate-400">
          {new Date(op.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={op.status} />
      </td>
      <td className="px-5 py-4">
        <p className="text-sm font-semibold text-slate-800">₹{op.consultationFee || 0}</p>
        {op.isCoveredBySubscription && (
          <span className="text-xs text-emerald-600 font-medium">Subscription</span>
        )}
      </td>
      <td className="px-5 py-4">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(op.opNumber); }}
          className="w-8 h-8 rounded-lg bg-slate-100 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-blue-100 transition-all"
        >
          <Eye size={14} className="text-slate-600 group-hover:text-blue-600" />
        </button>
      </td>
    </motion.tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OpManagement() {
  const dispatch = useDispatch();

  // Selectors
  const ops       = useSelector(selectDoctorOps);
  const opsMeta   = useSelector(selectDoctorOpsMeta);
  const profile   = useSelector(selectMyDoctorProfile);
  const hospLoad  = useSelector(selectHospitalLoading);

  // Local state
  const [selectedOp, setSelectedOp]   = useState(null);
  const [filters, setFilters]          = useState({ status: '', hospitalId: '', date: '', page: 1, limit: 20 });
  const [search, setSearch]            = useState('');
  const [showFilters, setShowFilters]  = useState(false);
  const [view, setView]                = useState('table'); // 'table' | 'grid'

  // Derived stats
  const total       = opsMeta.total || 0;
  const scheduled   = ops.filter(o => o.status === 'scheduled').length;
  const completed   = ops.filter(o => o.status === 'completed').length;
  const inProgress  = ops.filter(o => o.status === 'in_progress').length;
  const chartData   = buildChartData(ops);
  const pieData     = buildStatusPie(ops);

  const filteredOps = search.trim()
    ? ops.filter(op =>
        op.opNumber?.toLowerCase().includes(search.toLowerCase()) ||
        op.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
        op.booking?.bookingCode?.toLowerCase().includes(search.toLowerCase()))
    : ops;

  // Fetch on mount & filter change
  useEffect(() => {
    dispatch(fetchMyDoctorProfile());
  }, [dispatch]);

  useEffect(() => {
    const params = {};
    if (filters.status)     params.status     = filters.status;
    if (filters.hospitalId) params.hospitalId = filters.hospitalId;
    if (filters.date)       params.date       = filters.date;
    params.page  = filters.page;
    params.limit = filters.limit;
    dispatch(fetchDoctorOps(params));
  }, [dispatch, filters]);

  const refresh = () => dispatch(fetchDoctorOps({ page: 1, limit: 20 }));

  const setFilter = (k) => (v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));
  const clearFilters = () => setFilters({ status: '', hospitalId: '', date: '', page: 1, limit: 20 });

  const activeFilters = [filters.status, filters.date].filter(Boolean).length;

  const loading = opsMeta.status === 'loading';

  return (
    <div data-theme="doctor" className="min-h-screen bg-slate-50">
      {/* Background accent */}
      <div className="absolute top-0 left-0 right-0 h-72 pointer-events-none overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 60%, transparent 100%)' }} />
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
        >
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                <ClipboardList size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900"
                  style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                  OP Management
                </h1>
                <p className="text-sm text-slate-500">
                  {profile
                    ? `Dr. ${profile.user?.name || '—'} · ${profile.specialization}`
                    : 'Loading doctor profile...'}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center gap-2 flex-wrap">
            <button onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-colors shadow-sm ${
                showFilters || activeFilters > 0
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              <SlidersHorizontal size={14} />
              Filters
              {activeFilters > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-bold flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
          </motion.div>
        </motion.div>

        {/* ── Stats Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={FileText}      label="Total OPs"    value={total}      sub="all time"         color="#3b82f6" delay={0}    />
          <StatCard icon={Clock}         label="Scheduled"    value={scheduled}  sub="upcoming"         color="#f59e0b" delay={0.07} />
          <StatCard icon={CheckCircle2}  label="Completed"    value={completed}  sub="in current page"  color="#10b981" delay={0.14} />
          <StatCard icon={Activity}      label="In Progress"  value={inProgress} sub="active now"       color="#8b5cf6" delay={0.21} />
        </div>

        {/* ── Charts Row ────────────────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">

          {/* Area chart — 7-day trend */}
          <motion.div variants={fadeUp} className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800">Consultation Trend</h3>
                <p className="text-xs text-slate-400">Last 7 days</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                <TrendingUp size={13} />
                Active
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5}
                  fill="url(#areaGrad)" dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie chart — status distribution */}
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-1">Status Breakdown</h3>
            <p className="text-xs text-slate-400 mb-4">Current page</p>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-slate-600">{d.name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-36 flex items-center justify-center text-sm text-slate-400">
                No data yet
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* ── Filters Bar ───────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                    <select
                      value={filters.status}
                      onChange={e => setFilter('status')(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                    >
                      <option value="">All Statuses</option>
                      {Object.entries(STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                    <input type="date" value={filters.date}
                      onChange={e => setFilter('date')(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                    />
                  </div>

                  <button onClick={clearFilters}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                    <RotateCcw size={13} />Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Table toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">All OP Records</h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                {opsMeta.total || 0}
              </span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search OP, patient, booking..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X size={13} className="text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-slate-400">Loading OP records...</p>
                </div>
              </div>
            ) : filteredOps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <BookOpen size={28} className="text-slate-400" />
                </div>
                <p className="font-semibold text-slate-600 mb-1">No OP records found</p>
                <p className="text-sm text-slate-400">
                  {search ? 'Try adjusting your search' : 'Apply different filters or check back later'}
                </p>
              </div>
            ) : (
              <motion.table
                variants={stagger} initial="hidden" animate="show"
                className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['OP / Booking', 'Patient', 'Type', 'Scheduled', 'Status', 'Fee', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOps.map((op, i) => (
                    <OpRow key={op._id} op={op} idx={i} onSelect={setSelectedOp} />
                  ))}
                </tbody>
              </motion.table>
            )}
          </div>

          {/* Pagination */}
          {opsMeta.pages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Page {opsMeta.page} of {opsMeta.pages} · {opsMeta.total} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                  disabled={filters.page <= 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} className="text-slate-600" />
                </button>
                {Array.from({ length: Math.min(5, opsMeta.pages) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p}
                      onClick={() => setFilters(f => ({ ...f, page: p }))}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                        filters.page === p
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.min(opsMeta.pages, f.page + 1) }))}
                  disabled={filters.page >= opsMeta.pages}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={15} className="text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Doctor profile badge bottom */}
        {profile && (
          <motion.div
            variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.4 }}
            className="mt-6 flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 px-5 py-3 shadow-sm w-fit"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Stethoscope size={17} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {profile.user?.name || 'Doctor'} · {profile.specialization}
              </p>
              <div className="flex items-center gap-2">
                <BadgeCheck size={12} className={profile.isVerified ? 'text-emerald-500' : 'text-slate-300'} />
                <span className="text-xs text-slate-400">
                  {profile.registrationNumber || 'Reg. pending'} · {profile.experienceYears}yr exp
                </span>
              </div>
            </div>
            <div className="ml-4 flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
              <Star size={11} />
              {profile.rating?.averageRating?.toFixed(1) || '—'}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── OP Detail Side Panel ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedOp && (
          <OpDetailPanel
            key={selectedOp}
            opNumber={selectedOp}
            onClose={() => setSelectedOp(null)}
            dispatch={dispatch}
          />
        )}
      </AnimatePresence>
    </div>
  );
}