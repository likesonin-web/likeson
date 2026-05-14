'use client';

/**
 * RecordsManagement.jsx
 * Care Assistant — Patient Care Record Hub
 * Covers ALL Section D thunks:
 *   fetchCareRecords · fetchCareRecordById · logVitals · logFood
 *   logMedicine · addCareNote · resolveCareNote · addInstruction
 *   fetchInstructions · dischargePatient · updateCareRecordStatus
 *
 * Theme: care-assistant (Rose) · Next.js · Tailwind · Lucide · Framer Motion
 */

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Heart, Thermometer, Droplets, Wind, Weight,
  UtensilsCrossed, Pill, StickyNote, CheckCircle2, XCircle,
  AlertTriangle, BookOpen, LogOut, RefreshCw, Plus, ChevronDown,
  User, Phone, Calendar, Clock, Search, Filter, Eye,
  ArrowRight, Loader2, Shield, Clipboard, ClipboardCheck,
  Zap, Info, ChevronRight, Inbox, FileText, Lock, Unlock,
  TrendingUp, Coffee, Syringe, FlaskConical, Camera, X,
  MessageSquarePlus, ListChecks, AlertCircle, CheckCheck,
  BarChart3, Hash
} from 'lucide-react';

import {
  fetchCareRecords,
  fetchCareRecordById,
  logVitals,
  logFood,
  logMedicine,
  addCareNote,
  resolveCareNote,
  addInstruction,
  fetchInstructions,
  dischargePatient,
  updateCareRecordStatus,
  selectCareRecords,
  selectCareRecordsTotal,
  selectSelectedCareRecord,
  selectInstructionsFor,
  selectLatestVitals,
  selectOpenAlerts,
  selectTodaysMissedMeds,
  selectClinicalLoading,
  selectClinicalError,
  clearSelectedCareRecord,
} from '@/store/slices/clinicalSlice';

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.2 } },
};
const stagger   = { visible: { transition: { staggerChildren: 0.06 } } };
const slideUp   = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: 24, transition: { duration: 0.22 } },
};
const slideIn = {
  hidden:  { opacity: 0, x: '100%' },
  visible: { opacity: 1, x: 0,      transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: '100%', transition: { duration: 0.25 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  active:      { badge: 'badge-success',   border: 'var(--success)',  dot: 'status-dot-success'  },
  discharged:  { badge: 'badge-secondary', border: 'var(--info)',     dot: 'status-dot-info'     },
  transferred: { badge: 'badge-info',      border: 'var(--info)',     dot: 'status-dot-info'     },
  on_hold:     { badge: 'badge-warning',   border: 'var(--warning)',  dot: 'status-dot-warning'  },
};

const SEVERITY_COLORS = {
  low:      { cls: 'badge-success', border: 'var(--success)' },
  medium:   { cls: 'badge-warning', border: 'var(--warning)' },
  high:     { cls: 'badge-error',   border: 'var(--error)'   },
  critical: { cls: 'badge-error',   border: 'var(--error)'   },
};

function FieldNote({ children }) {
  return (
    <span className="block text-[0.67rem] font-medium leading-tight tracking-wide mt-0.5"
      style={{ color: 'color-mix(in oklch, var(--base-content) 38%, transparent)' }}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] || { badge: 'badge-secondary', dot: '' };
  return (
    <span className={`badge badge-sm ${cfg.badge} gap-1.5`}>
      <span className={`status-dot ${cfg.dot}`} style={{ width: '0.4rem', height: '0.4rem' }} />
      {status?.replace('_', ' ')}
    </span>
  );
}

function Spinner({ size = 'md' }) {
  const dims = { xs: '1rem', sm: '1.25rem', md: '1.75rem', lg: '2.5rem' };
  const bw   = { xs: '2px',  sm: '2px',    md: '3px',     lg: '3px'  };
  return (
    <span className="loading" style={{ width: dims[size], height: dims[size], borderWidth: bw[size] }} />
  );
}

function EmptySlate({ icon: Icon, title, sub }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible"
      className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'color-mix(in srgb, var(--primary), transparent 87%)' }}>
        <Icon className="w-7 h-7" style={{ color: 'var(--primary)', opacity: 0.55 }} />
      </div>
      <p className="text-sm font-bold" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{title}</p>
      {sub && <p className="text-xs mt-1 max-w-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 38%, transparent)' }}>{sub}</p>}
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'color-mix(in srgb, var(--primary), transparent 87%)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
      </div>
      <p className="text-xs font-extrabold uppercase tracking-widest"
        style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
        {label}
      </p>
      {count != null && (
        <span className="badge badge-xs badge-primary">{count}</span>
      )}
    </div>
  );
}

// ─── Record Card (list) ───────────────────────────────────────────────────────
function RecordCard({ record, onOpen }) {
  const cfg = STATUS_COLORS[record.status] || STATUS_COLORS.active;
  const assignedDate = record.assignedAt ? new Date(record.assignedAt) : null;

  return (
    <motion.div variants={fadeUp}
      className="card overflow-hidden cursor-pointer group"
      style={{ borderLeft: `4px solid ${cfg.border}` }}
      onClick={() => onOpen(record._id)}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--primary), transparent 87%)' }}>
              <User className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-base-content truncate">
                {record.patientName || record.patient?.name || 'Unknown Patient'}
              </p>
              <FieldNote>Patient under care</FieldNote>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusBadge status={record.status} />
                {record.careNotes?.filter(n => n.severity === 'critical' && !n.isResolved).length > 0 && (
                  <span className="badge badge-xs badge-error gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {record.careNotes.filter(n => n.severity === 'critical' && !n.isResolved).length} Critical
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-1"
            style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }} />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-base-300/60 text-center">
          {[
            { label: 'Vitals',      val: record.vitalsLog?.length    || 0, icon: Activity },
            { label: 'Notes',       val: record.careNotes?.length    || 0, icon: StickyNote },
            { label: 'Meds',        val: record.medicineLog?.length  || 0, icon: Pill },
          ].map(s => (
            <div key={s.label}>
              <p className="text-base font-black" style={{ color: 'var(--primary)' }}>{s.val}</p>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide"
                style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {assignedDate && (
          <p className="text-[0.67rem] mt-3 flex items-center gap-1"
            style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
            <Clock className="w-3 h-3" />
            Assigned {assignedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            <FieldNote className="inline">&nbsp;— care session start date</FieldNote>
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Log Forms ────────────────────────────────────────────────────────────────

function VitalsForm({ recordId, onSubmit, isLoading }) {
  const [v, setV] = useState({
    bloodPressure: '', pulseRate: '', temperature: '',
    spO2: '', bloodSugar: '', weightKg: '', respiratoryRate: '', notes: '',
  });
  const set = k => e => setV(p => ({ ...p, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(v).filter(([, val]) => val !== '')
        .map(([k, val]) => [k, isNaN(val) || k === 'bloodPressure' || k === 'notes' ? val : Number(val)])
    );
    onSubmit({ id: recordId, ...payload });
  }
  const fields = [
    { k: 'bloodPressure',   label: 'Blood Pressure',    icon: Activity,    ph: '120/80 mmHg',  note: 'Systolic/Diastolic in mmHg',    type: 'text'   },
    { k: 'pulseRate',       label: 'Pulse Rate',         icon: Heart,       ph: '72 bpm',       note: 'Beats per minute',              type: 'number' },
    { k: 'temperature',     label: 'Temperature (°C)',   icon: Thermometer, ph: '37.0',         note: 'Body temp in Celsius',          type: 'number' },
    { k: 'spO2',            label: 'SpO₂ (%)',           icon: Droplets,    ph: '98',           note: 'Blood oxygen saturation level', type: 'number' },
    { k: 'bloodSugar',      label: 'Blood Sugar',        icon: FlaskConical,ph: '110 mg/dL',    note: 'Fasting or random blood sugar', type: 'number' },
    { k: 'weightKg',        label: 'Weight (kg)',         icon: Weight,      ph: '65',           note: 'Current body weight in kg',     type: 'number' },
    { k: 'respiratoryRate', label: 'Respiratory Rate',   icon: Wind,        ph: '16',           note: 'Breaths per minute',            type: 'number' },
  ];
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.k}>
            <label className="label"><span className="label-text flex items-center gap-1.5"><f.icon className="w-3.5 h-3.5" />{f.label}</span></label>
            <input type={f.type} placeholder={f.ph} value={v[f.k]} onChange={set(f.k)}
              className="input-field text-sm" />
            <FieldNote>{f.note}</FieldNote>
          </div>
        ))}
      </div>
      <div>
        <label className="label"><span className="label-text">Notes</span></label>
        <textarea value={v.notes} onChange={set('notes')} placeholder="Optional observation notes…" rows={2}
          className="input-field text-sm resize-none" />
        <FieldNote>Free-text remarks about this reading</FieldNote>
      </div>
      <button type="submit" disabled={isLoading} className="btn btn-primary btn-sm gap-2 w-full">
        {isLoading ? <Spinner size="xs" /> : <Activity className="w-4 h-4" />}
        Record Vitals
      </button>
    </form>
  );
}

function FoodForm({ recordId, onSubmit, isLoading }) {
  const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'supplement', 'fluid'];
  const STATUSES   = ['consumed', 'partial', 'refused', 'vomited'];
  const [v, setV] = useState({ mealType: 'breakfast', description: '', quantityMl: '', status: 'consumed', refusalReason: '', notes: '' });
  const set = k => e => setV(p => ({ ...p, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    onSubmit({ id: recordId, ...v, quantityMl: v.quantityMl ? Number(v.quantityMl) : undefined });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">Meal Type *</span></label>
          <select value={v.mealType} onChange={set('mealType')} className="input-field text-sm appearance-none">
            {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <FieldNote>Category of the food or fluid intake</FieldNote>
        </div>
        <div>
          <label className="label"><span className="label-text">Status</span></label>
          <select value={v.status} onChange={set('status')} className="input-field text-sm appearance-none">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <FieldNote>Did patient consume, partially eat, refuse, or vomit?</FieldNote>
        </div>
      </div>
      <div>
        <label className="label"><span className="label-text">Description</span></label>
        <input type="text" placeholder="e.g. Rice and dal, 250ml water…" value={v.description} onChange={set('description')}
          className="input-field text-sm" />
        <FieldNote>What was given/taken — describe food or fluid</FieldNote>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">Quantity (ml)</span></label>
          <input type="number" placeholder="250" value={v.quantityMl} onChange={set('quantityMl')}
            className="input-field text-sm" />
          <FieldNote>For fluids — volume in millilitres</FieldNote>
        </div>
        <div>
          <label className="label"><span className="label-text">Refusal Reason</span></label>
          <input type="text" placeholder="Nausea, not hungry…" value={v.refusalReason} onChange={set('refusalReason')}
            className="input-field text-sm" />
          <FieldNote>Required only if status is 'refused'</FieldNote>
        </div>
      </div>
      <div>
        <label className="label"><span className="label-text">Notes</span></label>
        <textarea value={v.notes} onChange={set('notes')} placeholder="Additional observations…" rows={2}
          className="input-field text-sm resize-none" />
        <FieldNote>Extra notes about this meal event</FieldNote>
      </div>
      <button type="submit" disabled={isLoading} className="btn btn-primary btn-sm gap-2 w-full">
        {isLoading ? <Spinner size="xs" /> : <UtensilsCrossed className="w-4 h-4" />}
        Log Food Entry
      </button>
    </form>
  );
}

function MedicineForm({ recordId, onSubmit, isLoading }) {
  const ROUTES   = ['oral', 'iv', 'im', 'topical', 'inhalation', 'rectal', 'sublingual', 'other'];
  const STATUSES = ['given', 'missed', 'refused', 'held'];
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [v, setV] = useState({
    medicineName: '', dosage: '', route: 'oral',
    status: 'given', scheduledAt: localNow, missedReason: '', notes: '',
  });
  const set = k => e => setV(p => ({ ...p, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    if (!v.medicineName) return;
    onSubmit({ id: recordId, ...v });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label"><span className="label-text">Medicine Name *</span></label>
        <input type="text" placeholder="e.g. Paracetamol 500mg, Metformin…" value={v.medicineName} onChange={set('medicineName')}
          className="input-field text-sm" required />
        <FieldNote>Full name of the medicine as written on prescription</FieldNote>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">Dosage</span></label>
          <input type="text" placeholder="500mg / 10ml" value={v.dosage} onChange={set('dosage')}
            className="input-field text-sm" />
          <FieldNote>Exact dose administered this time</FieldNote>
        </div>
        <div>
          <label className="label"><span className="label-text">Route</span></label>
          <select value={v.route} onChange={set('route')} className="input-field text-sm appearance-none">
            {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <FieldNote>How medicine entered the body</FieldNote>
        </div>
        <div>
          <label className="label"><span className="label-text">Status</span></label>
          <select value={v.status} onChange={set('status')} className="input-field text-sm appearance-none">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <FieldNote>Was medicine successfully given?</FieldNote>
        </div>
        <div>
          <label className="label"><span className="label-text">Scheduled At *</span></label>
          <input type="datetime-local" value={v.scheduledAt} onChange={set('scheduledAt')}
            className="input-field text-sm" required />
          <FieldNote>When this dose was supposed to be given</FieldNote>
        </div>
      </div>
      {v.status !== 'given' && (
        <div>
          <label className="label"><span className="label-text">Reason</span></label>
          <input type="text" placeholder="Patient refused, vein collapsed…" value={v.missedReason} onChange={set('missedReason')}
            className="input-field text-sm" />
          <FieldNote>Required for missed / refused / held — explain why</FieldNote>
        </div>
      )}
      <div>
        <label className="label"><span className="label-text">Notes</span></label>
        <textarea value={v.notes} onChange={set('notes')} placeholder="Any reaction, site condition…" rows={2}
          className="input-field text-sm resize-none" />
        <FieldNote>Post-administration observations or site notes</FieldNote>
      </div>
      <button type="submit" disabled={isLoading} className="btn btn-primary btn-sm gap-2 w-full">
        {isLoading ? <Spinner size="xs" /> : <Pill className="w-4 h-4" />}
        Log Medicine
      </button>
    </form>
  );
}

function CareNoteForm({ recordId, onSubmit, isLoading }) {
  const CATEGORIES = ['general', 'behavior', 'pain', 'mobility', 'hygiene', 'emotional', 'alert'];
  const SEVERITIES = ['low', 'medium', 'high', 'critical'];
  const [v, setV] = useState({ note: '', category: 'general', severity: 'low' });
  const set = k => e => setV(p => ({ ...p, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    if (!v.note.trim()) return;
    onSubmit({ id: recordId, ...v });
    setV({ note: '', category: 'general', severity: 'low' });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label"><span className="label-text">Observation Note *</span></label>
        <textarea value={v.note} onChange={set('note')} placeholder="Describe what you observed…" rows={3}
          className="input-field text-sm resize-none" required />
        <FieldNote>Detailed observation — be specific about time, location, behaviour</FieldNote>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">Category</span></label>
          <select value={v.category} onChange={set('category')} className="input-field text-sm appearance-none">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldNote>Type of observation made</FieldNote>
        </div>
        <div>
          <label className="label"><span className="label-text">Severity</span></label>
          <select value={v.severity} onChange={set('severity')} className="input-field text-sm appearance-none"
            style={{ borderColor: SEVERITY_COLORS[v.severity]?.border || 'var(--base-300)' }}>
            {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <FieldNote>How urgent is this observation? Critical triggers alert.</FieldNote>
        </div>
      </div>
      <button type="submit" disabled={isLoading} className="btn btn-primary btn-sm gap-2 w-full">
        {isLoading ? <Spinner size="xs" /> : <StickyNote className="w-4 h-4" />}
        Add Care Note
      </button>
    </form>
  );
}

function InstructionForm({ recordId, onSubmit, isLoading }) {
  const CATEGORIES = ['diet', 'mobility', 'medication', 'wound_care', 'general', 'emergency'];
  const [v, setV] = useState({ instruction: '', category: 'general' });
  const set = k => e => setV(p => ({ ...p, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    if (!v.instruction.trim()) return;
    onSubmit({ id: recordId, instruction: v.instruction, category: v.category });
    setV({ instruction: '', category: 'general' });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label"><span className="label-text">Instruction Text *</span></label>
        <textarea value={v.instruction} onChange={set('instruction')} placeholder="e.g. Change wound dressing every 8 hours…" rows={3}
          className="input-field text-sm resize-none" required />
        <FieldNote>Clear instruction for care — once added, cannot be edited (append-only record)</FieldNote>
      </div>
      <div>
        <label className="label"><span className="label-text">Category</span></label>
        <select value={v.category} onChange={set('category')} className="input-field text-sm appearance-none">
          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <FieldNote>Classification helps filter instructions by type</FieldNote>
      </div>
      <button type="submit" disabled={isLoading} className="btn btn-primary btn-sm gap-2 w-full">
        {isLoading ? <Spinner size="xs" /> : <BookOpen className="w-4 h-4" />}
        Append Instruction
      </button>
    </form>
  );
}

// ─── Collapsible Log Section ──────────────────────────────────────────────────
function LogSection({ id: sectionId, icon: Icon, title, count, accent, children, formTitle, form }) {
  const [open, setOpen]     = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-base-200/60 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${accent}, transparent 87%)` }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div>
            <p className="text-sm font-bold text-base-content">{title}</p>
            <FieldNote>{count} entries logged</FieldNote>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-sm" style={{ background: `color-mix(in srgb, ${accent}, transparent 85%)`, color: accent, border: `1px solid color-mix(in srgb, ${accent}, transparent 70%)` }}>
            {count}
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-base-content/40 rotate-180 transition-transform" />
                : <ChevronDown className="w-4 h-4 text-base-content/40 transition-transform" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden">
            <div className="px-5 pb-5 space-y-3 border-t border-base-300/60 pt-4">
              {children}
              {form && (
                <>
                  <button onClick={() => setFormOpen(o => !o)}
                    className="btn btn-sm btn-outline gap-2 w-full"
                    style={{ borderColor: accent, color: accent }}>
                    {formOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {formOpen ? 'Cancel' : formTitle}
                  </button>
                  <AnimatePresence>
                    {formOpen && (
                      <motion.div variants={slideUp} initial="hidden" animate="visible" exit="exit"
                        className="p-4 rounded-xl border border-base-300 bg-base-200/50 space-y-1">
                        {form}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function RecordDetailPanel({ record, instructions, dispatch, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [dischargeNotes, setDischargeNotes] = useState('');

  const loadingVitals    = useSelector(selectClinicalLoading('logVitals'));
  const loadingFood      = useSelector(selectClinicalLoading('logFood'));
  const loadingMedicine  = useSelector(selectClinicalLoading('logMedicine'));
  const loadingNote      = useSelector(selectClinicalLoading('addCareNote'));
  const loadingResolve   = useSelector(selectClinicalLoading('resolveCareNote'));
  const loadingInstr     = useSelector(selectClinicalLoading('addInstruction'));
  const loadingDischarge = useSelector(selectClinicalLoading('dischargePatient'));
  const latestVitals     = useSelector(selectLatestVitals);
  const openAlerts       = useSelector(selectOpenAlerts);
  const missedMeds       = useSelector(selectTodaysMissedMeds);

  const isActive = record.status === 'active';

  const tabs = [
    { k: 'overview',      label: 'Overview',      icon: BarChart3 },
    { k: 'vitals',        label: 'Vitals',         icon: Activity   },
    { k: 'food',          label: 'Food',           icon: UtensilsCrossed },
    { k: 'medicine',      label: 'Medicine',       icon: Pill        },
    { k: 'notes',         label: 'Notes',          icon: StickyNote  },
    { k: 'instructions',  label: 'Instructions',   icon: BookOpen    },
  ];

  async function handleLogVitals(body)   { await dispatch(logVitals(body)); }
  async function handleLogFood(body)     { await dispatch(logFood(body)); }
  async function handleLogMedicine(body) { await dispatch(logMedicine(body)); }
  async function handleAddNote(body)     { await dispatch(addCareNote(body)); }
  async function handleResolve(noteId)   { await dispatch(resolveCareNote({ id: record._id, noteId })); }
  async function handleAddInstr(body)    { await dispatch(addInstruction(body)); }
  async function handleDischarge() {
    await dispatch(dischargePatient({ id: record._id, dischargeNotes }));
    setDischargeOpen(false);
  }

  return (
    <motion.div variants={slideIn} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 z-50 mt-20 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div className="w-full max-w-lg h-full flex flex-col bg-base-100 overflow-hidden shadow-depth-lg"
        onClick={e => e.stopPropagation()}>

        {/* Panel Header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-base font-black text-white">
                {record.patientName || 'Patient Care Record'}
              </p>
              <p className="text-xs text-white/60 mt-0.5">
                {record.booking?.bookingCode || `Record ${record._id?.slice(-6)}`}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Status + Quick Stats */}
        <div className="px-6 py-3 border-b border-base-300/60 flex items-center gap-3 flex-shrink-0 bg-base-200/40">
          <StatusBadge status={record.status} />
          {openAlerts?.length > 0 && (
            <span className="badge badge-xs badge-error gap-1">
              <Zap className="w-2.5 h-2.5" /> {openAlerts.length} Alert{openAlerts.length > 1 ? 's' : ''}
            </span>
          )}
          {missedMeds?.length > 0 && (
            <span className="badge badge-xs badge-warning gap-1">
              <Pill className="w-2.5 h-2.5" /> {missedMeds.length} Missed
            </span>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-0.5 px-4 py-2 border-b border-base-300/60 overflow-x-auto scrollbar-thin flex-shrink-0 bg-base-100">
          {tabs.map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                ${activeTab === t.k
                  ? 'text-primary bg-primary/10 font-bold'
                  : 'text-base-content/50 hover:text-base-content/80 hover:bg-base-200/60'}`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          <AnimatePresence mode="wait">

            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <motion.div key="overview" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
                className="space-y-5">

                {/* Patient Snapshot */}
                <div className="card p-4 space-y-2">
                  <SectionTitle icon={User} label="Patient Snapshot" />
                  {[
                    { label: 'Blood Group',         val: record.patientSnapshot?.bloodGroup || '—',                  note: 'Emergency reference' },
                    { label: 'Allergies',           val: record.patientSnapshot?.allergies?.join(', ') || 'None',    note: 'Known allergic substances' },
                    { label: 'Chronic Conditions',  val: record.patientSnapshot?.chronicConditions?.join(', ') || 'None', note: 'Pre-existing diagnoses' },
                    { label: 'Language',            val: record.patientSnapshot?.primaryLanguage || 'English',        note: 'Preferred communication language' },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-start py-2 border-b border-base-300/50 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">{r.label}</p>
                        <FieldNote>{r.note}</FieldNote>
                      </div>
                      <p className="text-sm font-bold text-base-content text-right max-w-[55%]">{r.val}</p>
                    </div>
                  ))}
                  {record.patientSnapshot?.emergencyContact?.phone && (
                    <div className="flex justify-between items-start py-2">
                      <div>
                        <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">Emergency Contact</p>
                        <FieldNote>Call immediately for critical events</FieldNote>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-base-content">{record.patientSnapshot.emergencyContact.name}</p>
                        <p className="text-xs text-primary">{record.patientSnapshot.emergencyContact.phone}</p>
                        <p className="text-xs text-base-content/40">{record.patientSnapshot.emergencyContact.relation}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Latest Vitals */}
                {latestVitals && (
                  <div className="card p-4">
                    <SectionTitle icon={Activity} label="Latest Vitals" />
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Blood Pressure', val: latestVitals.bloodPressure, icon: Activity  },
                        { label: 'Pulse',          val: latestVitals.pulseRate ? `${latestVitals.pulseRate} bpm` : null, icon: Heart },
                        { label: 'Temperature',    val: latestVitals.temperature ? `${latestVitals.temperature}°C` : null, icon: Thermometer },
                        { label: 'SpO₂',           val: latestVitals.spO2 ? `${latestVitals.spO2}%` : null, icon: Droplets },
                        { label: 'Blood Sugar',    val: latestVitals.bloodSugar ? `${latestVitals.bloodSugar} mg/dL` : null, icon: FlaskConical },
                      ].filter(v => v.val).map(v => (
                        <div key={v.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-base-200">
                          <v.icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                          <div>
                            <p className="text-xs text-base-content/40 font-semibold">{v.label}</p>
                            <p className="text-sm font-bold text-base-content">{v.val}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[0.67rem] mt-2" style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
                      Recorded {latestVitals.recordedAt ? new Date(latestVitals.recordedAt).toLocaleString('en-IN') : 'recently'}
                    </p>
                  </div>
                )}

                {/* Open Critical Alerts */}
                {openAlerts?.length > 0 && (
                  <div className="card p-4">
                    <SectionTitle icon={AlertCircle} label="Open Critical Alerts" count={openAlerts.length} />
                    {openAlerts.map(n => (
                      <div key={n._id} className="p-3 rounded-lg mb-2 last:mb-0 border-l-4"
                        style={{ background: 'color-mix(in srgb, var(--error), transparent 91%)', borderLeftColor: 'var(--error)' }}>
                        <p className="text-sm font-semibold text-base-content">{n.note}</p>
                        <p className="text-xs text-base-content/40 mt-0.5">{n.category} · {n.severity}</p>
                        <FieldNote>Critical unresolved note — needs immediate attention</FieldNote>
                        <button onClick={() => handleResolve(n._id)} disabled={loadingResolve}
                          className="btn btn-xs btn-success gap-1 mt-2">
                          {loadingResolve ? <Spinner size="xs" /> : <CheckCheck className="w-3 h-3" />}
                          Resolve
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Discharge button */}
                {isActive && (
                  <div className="card p-4">
                    <SectionTitle icon={LogOut} label="Discharge Patient" />
                    <p className="text-xs text-base-content/50 mb-3">
                      Discharging marks the care session complete, frees you for new assignments, and closes the booking.
                    </p>
                    <FieldNote>Only discharge when doctor confirms patient is ready to leave care</FieldNote>
                    {!dischargeOpen ? (
                      <button onClick={() => setDischargeOpen(true)}
                        className="btn btn-warning btn-sm gap-2 w-full mt-2">
                        <LogOut className="w-4 h-4" />
                        Initiate Discharge
                      </button>
                    ) : (
                      <motion.div variants={slideUp} initial="hidden" animate="visible" className="space-y-3 mt-2">
                        <div>
                          <label className="label"><span className="label-text">Discharge Notes</span></label>
                          <textarea value={dischargeNotes} onChange={e => setDischargeNotes(e.target.value)}
                            placeholder="Condition at discharge, follow-up instructions, special notes…"
                            rows={3} className="input-field text-sm resize-none" />
                          <FieldNote>Summary note for doctor and admin — what was patient's condition on leaving?</FieldNote>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleDischarge} disabled={loadingDischarge}
                            className="btn btn-warning btn-sm flex-1 gap-2">
                            {loadingDischarge ? <Spinner size="xs" /> : <CheckCircle2 className="w-4 h-4" />}
                            Confirm Discharge
                          </button>
                          <button onClick={() => setDischargeOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* VITALS TAB */}
            {activeTab === 'vitals' && (
              <motion.div key="vitals" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
                className="space-y-4">
                <SectionTitle icon={Activity} label="Vitals Log" count={record.vitalsLog?.length || 0} />

                {isActive && (
                  <div className="p-4 rounded-xl border border-base-300 bg-base-200/40">
                    <p className="text-xs font-bold text-base-content/60 mb-3">Record New Vitals Reading</p>
                    <VitalsForm recordId={record._id} onSubmit={handleLogVitals} isLoading={loadingVitals} />
                  </div>
                )}

                <div className="space-y-2">
                  {record.vitalsLog?.length === 0 && <EmptySlate icon={Activity} title="No vitals yet" sub="Use the form above to record first reading." />}
                  {[...(record.vitalsLog || [])].reverse().map((v, i) => (
                    <motion.div variants={fadeUp} key={v._id || i}
                      className="p-3 rounded-xl border border-base-300 bg-base-200/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-primary">Reading #{record.vitalsLog.length - i}</p>
                        <p className="text-[0.67rem] text-base-content/40">
                          {v.recordedAt ? new Date(v.recordedAt).toLocaleString('en-IN') : '—'}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'BP', val: v.bloodPressure },
                          { label: 'Pulse', val: v.pulseRate ? `${v.pulseRate} bpm` : null },
                          { label: 'Temp', val: v.temperature ? `${v.temperature}°C` : null },
                          { label: 'SpO₂', val: v.spO2 ? `${v.spO2}%` : null },
                          { label: 'Sugar', val: v.bloodSugar ? `${v.bloodSugar}` : null },
                          { label: 'RR', val: v.respiratoryRate ? `${v.respiratoryRate}/m` : null },
                        ].filter(x => x.val).map(x => (
                          <div key={x.label} className="text-center">
                            <p className="text-[0.65rem] text-base-content/40 font-semibold uppercase">{x.label}</p>
                            <p className="text-xs font-bold text-base-content">{x.val}</p>
                          </div>
                        ))}
                      </div>
                      {v.notes && <p className="text-xs text-base-content/50 italic">{v.notes}</p>}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* FOOD TAB */}
            {activeTab === 'food' && (
              <motion.div key="food" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
                className="space-y-4">
                <SectionTitle icon={UtensilsCrossed} label="Food Log" count={record.foodLog?.length || 0} />

                {isActive && (
                  <div className="p-4 rounded-xl border border-base-300 bg-base-200/40">
                    <p className="text-xs font-bold text-base-content/60 mb-3">Log Meal / Fluid Intake</p>
                    <FoodForm recordId={record._id} onSubmit={handleLogFood} isLoading={loadingFood} />
                  </div>
                )}

                <div className="space-y-2">
                  {record.foodLog?.length === 0 && <EmptySlate icon={UtensilsCrossed} title="No food entries" sub="Log meals and fluid intake above." />}
                  {[...(record.foodLog || [])].reverse().map((f, i) => (
                    <motion.div variants={fadeUp} key={f._id || i}
                      className="p-3 rounded-xl border border-base-300 bg-base-200/40">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-base-content capitalize">{f.mealType}</p>
                          {f.description && <p className="text-xs text-base-content/60 mt-0.5">{f.description}</p>}
                        </div>
                        <span className={`badge badge-xs ${f.status === 'consumed' ? 'badge-success' : f.status === 'refused' ? 'badge-error' : 'badge-warning'}`}>
                          {f.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        {f.quantityMl && <p className="text-xs text-base-content/40">{f.quantityMl} ml</p>}
                        <p className="text-[0.67rem] text-base-content/30">
                          {f.mealTime ? new Date(f.mealTime).toLocaleString('en-IN') : '—'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* MEDICINE TAB */}
            {activeTab === 'medicine' && (
              <motion.div key="medicine" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
                className="space-y-4">
                <SectionTitle icon={Pill} label="Medicine Log" count={record.medicineLog?.length || 0} />

                {missedMeds?.length > 0 && (
                  <div className="p-3 rounded-xl border-l-4 bg-warning/10" style={{ borderLeftColor: 'var(--warning)' }}>
                    <p className="text-xs font-bold" style={{ color: 'var(--warning)' }}>
                      {missedMeds.length} missed dose{missedMeds.length > 1 ? 's' : ''} today
                    </p>
                    <FieldNote>Medicines scheduled today that were not administered</FieldNote>
                  </div>
                )}

                {isActive && (
                  <div className="p-4 rounded-xl border border-base-300 bg-base-200/40">
                    <p className="text-xs font-bold text-base-content/60 mb-3">Log Medicine Administration</p>
                    <MedicineForm recordId={record._id} onSubmit={handleLogMedicine} isLoading={loadingMedicine} />
                  </div>
                )}

                <div className="space-y-2">
                  {record.medicineLog?.length === 0 && <EmptySlate icon={Pill} title="No medicine logs" sub="Record each dose administered above." />}
                  {[...(record.medicineLog || [])].reverse().map((m, i) => (
                    <motion.div variants={fadeUp} key={m._id || i}
                      className="p-3 rounded-xl border border-base-300 bg-base-200/40">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-base-content">{m.medicineName}</p>
                          <p className="text-xs text-base-content/50 mt-0.5">{m.dosage} · {m.route}</p>
                        </div>
                        <span className={`badge badge-xs ${m.status === 'given' ? 'badge-success' : m.status === 'missed' ? 'badge-error' : 'badge-warning'}`}>
                          {m.status}
                        </span>
                      </div>
                      {m.missedReason && <p className="text-xs text-error mt-1">{m.missedReason}</p>}
                      <p className="text-[0.67rem] text-base-content/30 mt-1">
                        Scheduled: {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('en-IN') : '—'}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* NOTES TAB */}
            {activeTab === 'notes' && (
              <motion.div key="notes" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
                className="space-y-4">
                <SectionTitle icon={StickyNote} label="Care Notes" count={record.careNotes?.length || 0} />

                {isActive && (
                  <div className="p-4 rounded-xl border border-base-300 bg-base-200/40">
                    <p className="text-xs font-bold text-base-content/60 mb-3">Add Observation / Alert</p>
                    <CareNoteForm recordId={record._id} onSubmit={handleAddNote} isLoading={loadingNote} />
                  </div>
                )}

                <div className="space-y-2">
                  {record.careNotes?.length === 0 && <EmptySlate icon={StickyNote} title="No notes yet" sub="Document patient observations above." />}
                  {[...(record.careNotes || [])].reverse().map((n, i) => {
                    const sev = SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.low;
                    return (
                      <motion.div variants={fadeUp} key={n._id || i}
                        className="p-3 rounded-xl border-l-4"
                        style={{ background: `color-mix(in srgb, ${sev.border}, transparent 93%)`, borderLeftColor: sev.border }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-base-content flex-1">{n.note}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`badge badge-xs ${sev.cls}`}>{n.severity}</span>
                            {n.isResolved
                              ? <span className="badge badge-xs badge-success gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Resolved</span>
                              : isActive && (
                                <button onClick={() => handleResolve(n._id)} disabled={loadingResolve}
                                  className="btn btn-xs btn-ghost gap-0.5 text-success" style={{ color: 'var(--success)' }}>
                                  {loadingResolve ? <Spinner size="xs" /> : <CheckCheck className="w-3 h-3" />}
                                  Resolve
                                </button>
                              )
                            }
                          </div>
                        </div>
                        <p className="text-[0.67rem] text-base-content/40 mt-1.5">
                          {n.category} · {n.recordedAt ? new Date(n.recordedAt).toLocaleString('en-IN') : '—'}
                          {n.isResolved && n.resolvedAt && ` · Resolved ${new Date(n.resolvedAt).toLocaleString('en-IN')}`}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* INSTRUCTIONS TAB */}
            {activeTab === 'instructions' && (
              <motion.div key="instructions" variants={fadeUp} initial="hidden" animate="visible" exit="exit"
                className="space-y-4">
                <SectionTitle icon={BookOpen} label="Hospital Instructions" count={instructions?.length || 0} />

                <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
                  style={{ background: 'color-mix(in srgb, var(--info), transparent 91%)', borderLeft: '3px solid var(--info)' }}>
                  <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--info)' }} />
                  <div>
                    <p className="font-semibold text-base-content">Append-only record</p>
                    <FieldNote>Instructions cannot be edited or deleted once saved — they are a permanent medical audit trail</FieldNote>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-base-300 bg-base-200/40">
                  <p className="text-xs font-bold text-base-content/60 mb-3">Add New Instruction</p>
                  <InstructionForm recordId={record._id} onSubmit={handleAddInstr} isLoading={loadingInstr} />
                </div>

                <div className="space-y-2">
                  {!instructions?.length && <EmptySlate icon={BookOpen} title="No instructions yet" sub="Doctor or admin-added care instructions appear here." />}
                  {[...(instructions || [])].reverse().map((ins, i) => (
                    <motion.div variants={fadeUp} key={ins._id || i}
                      className="p-3 rounded-xl border border-base-300 bg-base-200/40">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: 'color-mix(in srgb, var(--primary), transparent 87%)' }}>
                          <Hash className="w-3 h-3" style={{ color: 'var(--primary)' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-base-content">{ins.instruction}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="badge badge-xs badge-accent">{ins.category?.replace('_', ' ')}</span>
                            <p className="text-[0.67rem] text-base-content/35">
                              {ins.issuedByName && `by ${ins.issuedByName} · `}
                              {ins.issuedAt ? new Date(ins.issuedAt).toLocaleString('en-IN') : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RecordsManagement() {
  const dispatch = useDispatch();

  const records        = useSelector(selectCareRecords);
  const recordsTotal   = useSelector(selectCareRecordsTotal);
  const selectedRecord = useSelector(selectSelectedCareRecord);

  const loadingRecords = useSelector(selectClinicalLoading('fetchCareRecords'));
  const loadingDetail  = useSelector(selectClinicalLoading('fetchCareRecordById'));
  const loadingInstr   = useSelector(selectClinicalLoading('fetchInstructions'));
  const errorRecords   = useSelector(selectClinicalError('fetchCareRecords'));

  const instructions   = useSelector(
    selectInstructionsFor(selectedRecord?._id || '')
  );

  const [page, setPage]           = useState(1);
  const [statusFilter, setStatus] = useState('');
  const [search, setSearch]       = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  const PAGE_LIMIT = 12;

  const load = useCallback(() => {
    const params = { page, limit: PAGE_LIMIT };
    if (statusFilter) params.status = statusFilter;
    dispatch(fetchCareRecords(params));
  }, [dispatch, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleOpen(id) {
    await dispatch(fetchCareRecordById(id));
    setPanelOpen(true);
  }

  // fetch instructions when record loads
  useEffect(() => {
    if (selectedRecord?._id && panelOpen) {
      dispatch(fetchInstructions(selectedRecord._id));
    }
  }, [selectedRecord?._id, panelOpen, dispatch]);

  function handleClose() {
    setPanelOpen(false);
    dispatch(clearSelectedCareRecord());
  }

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.patientName || r.patient?.name || '').toLowerCase().includes(q);
  });

  const totalPages   = Math.ceil(recordsTotal / PAGE_LIMIT);
  const activeCnt    = records.filter(r => r.status === 'active').length;
  const dischargedCnt= records.filter(r => r.status === 'discharged').length;

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100">

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-25"
        style={{
          backgroundImage: `radial-gradient(ellipse 70% 55% at 85% 5%, color-mix(in srgb, var(--secondary), transparent 82%), transparent),
                            radial-gradient(ellipse 60% 45% at 10% 95%, color-mix(in srgb, var(--primary), transparent 86%), transparent)`,
        }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Page Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible"
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--bg-gradient-primary)', boxShadow: 'var(--shadow-depth)' }}>
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-base-content tracking-tight">
                Care Records
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                Patient care record management · Likeson.in
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: 'Total Records',  val: recordsTotal, icon: Clipboard,      color: 'var(--primary)'  },
              { label: 'Active Now',     val: activeCnt,    icon: Activity,       color: 'var(--success)'  },
              { label: 'Discharged',     val: dischargedCnt,icon: CheckCircle2,   color: 'var(--secondary)'},
            ].map(s => (
              <div key={s.label} className="stat-card px-4 py-3 flex items-center gap-2.5">
                <s.icon className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} />
                <div>
                  <p className="stat-card-value text-xl" style={{ color: s.color }}>{s.val}</p>
                  <p className="stat-card-label text-[0.63rem]">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Filter Bar */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.06 }}
          className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search patient name…"
              className="input-field pl-9 text-sm" />
            <FieldNote>Filter by patient name in current page</FieldNote>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 -mt-2 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }} />
            <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="input-field pl-9 text-sm appearance-none min-w-[160px]">
              <option value="">All Statuses</option>
              {['active', 'discharged', 'transferred', 'on_hold'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <FieldNote>Filter care records by status</FieldNote>
          </div>
          <button onClick={load} disabled={loadingRecords}
            className="btn btn-outline btn-sm gap-2 self-start">
            {loadingRecords ? <Spinner size="xs" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </motion.div>

        {/* Error */}
        {errorRecords && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible"
            className="alert alert-error gap-3">
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--error)' }} />
            <p className="text-sm">{errorRecords}</p>
          </motion.div>
        )}

        {/* Grid */}
        {loadingRecords ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptySlate icon={Inbox} title="No care records found"
            sub="Records for patients under your care appear here after accepting a booking." />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(r => (
              <RecordCard key={r._id} record={r} onOpen={handleOpen} />
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible"
            className="flex items-center justify-between pt-2">
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 38%, transparent)' }}>
              Page {page} of {totalPages} · {recordsTotal} total
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loadingRecords}
                className="btn btn-outline btn-xs gap-1">
                <ChevronDown className="w-3.5 h-3.5 -rotate-90" /> Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loadingRecords}
                className="btn btn-outline btn-xs gap-1">
                Next <ChevronDown className="w-3.5 h-3.5 rotate-90" />
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {panelOpen && (
          loadingDetail
            ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(5px)' }}>
                <div className="bg-base-100 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-depth-lg">
                  <Spinner />
                  <p className="text-sm font-semibold" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                    Loading care record…
                  </p>
                </div>
              </motion.div>
            )
            : selectedRecord && (
              <RecordDetailPanel
                key="panel"
                record={selectedRecord}
                instructions={instructions}
                dispatch={dispatch}
                onClose={handleClose}
              />
            )
        )}
      </AnimatePresence>
    </div>
  );
}