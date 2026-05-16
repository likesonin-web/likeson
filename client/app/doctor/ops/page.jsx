'use client';

/**
 * OPManagement.jsx
 * Likeson.in — Doctor Dashboard
 * MOBILE-FIRST RESPONSIVE — full rewrite of layout/filter/panel
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  FileText, ChevronRight, ChevronLeft, Search, RefreshCw,
  CheckCircle2, AlertCircle, XCircle, Clock3, Activity,
  Stethoscope, Video, Home, Plus, X, CalendarDays,
  PenLine, Download, Eye, BadgeCheck, Hash, User,
  Hospital, ClipboardList, Layers, ArrowLeft, ArrowUpRight,
  Clock, Pill, TestTube2, StickyNote, CalendarCheck,
  BookOpen, Info, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';

import {
  fetchOPRecords,
  fetchOPRecordById,
  completeOPRecord,
  fetchPrescriptions,
  downloadPrescriptionPdf,
  selectOPRecords,
  selectOPRecordsTotal,
  selectSelectedOP,
  selectPrescriptions,
  selectClinicalLoading,
  selectClinicalError,
  clearSelectedOP,
} from '@/store/slices/clinicalSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 12;

const STATUSES = [
  { value: '',            label: 'All'         },
  { value: 'scheduled',   label: 'Scheduled'   },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
  { value: 'no_show',     label: 'No Show'     },
];

const CONSULT_TYPES = [
  { value: '',           label: 'All Types'  },
  { value: 'in_person',  label: 'In Person'  },
  { value: 'video',      label: 'Video'      },
  { value: 'home_visit', label: 'Home Visit' },
  { value: 'follow_up',  label: 'Follow-up'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d, opts) =>
  d
    ? new Date(d).toLocaleString('en-IN', opts || {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusCfg = (s) => ({
  scheduled:   { label: 'Scheduled',   cls: 'bg-info/10 text-info',      Icon: Clock3       },
  in_progress: { label: 'In Progress', cls: 'bg-primary/10 text-primary', Icon: Activity     },
  completed:   { label: 'Completed',   cls: 'bg-success/10 text-success', Icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   cls: 'bg-error/10 text-error',     Icon: XCircle      },
  no_show:     { label: 'No Show',     cls: 'bg-error/10 text-error',     Icon: AlertCircle  },
}[s] || { label: s, cls: 'bg-base-200 text-base-content', Icon: Clock3 });

const rxStatusCfg = (s) => ({
  issued:    'badge-primary',
  dispensed: 'badge-success',
  cancelled: 'badge-error',
  expired:   'badge-warning',
  draft:     'badge-secondary',
}[s] || 'badge-secondary');

const consultIcon = (t) =>
  t === 'video'      ? <Video        size={13} /> :
  t === 'home_visit' ? <Home         size={13} /> :
  t === 'follow_up'  ? <CalendarCheck size={13} /> :
                       <Stethoscope  size={13} />;

const feeSourceBadge = (s) => ({
  hospital:     'badge-info',
  doctor:       'badge-primary',
  subscription: 'badge-success',
  follow_up:    'badge-secondary',
  default:      'badge-base',
}[s] || 'badge-secondary');

const buildBarData = (ops) => {
  const map = {};
  ops.forEach((op) => {
    const key = new Date(op.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).slice(-7).map(([date, count]) => ({ date, count }));
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const { label, cls, Icon } = statusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      <Icon size={10} />{label}
    </span>
  );
};

const DetailSection = ({ icon: Icon, title, children, accent = 'primary' }) => (
  <div className="rounded-xl border border-base-300 overflow-hidden"
    style={{ borderTop: `2px solid var(--${accent})` }}>
    <div className="flex items-center gap-2 px-4 py-3 bg-base-200/50">
      <Icon size={14} style={{ color: `var(--${accent})` }} />
      <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/60">{title}</h4>
    </div>
    <div className="px-4 py-3">{children}</div>
  </div>
);

const IR = ({ label, value, mono, badge, badgeCls }) => {
  if (!value && !badge) return null;
  return (
    <div className="flex items-start gap-2 text-sm py-1 border-b border-base-300/40 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-base-content/40 w-28 sm:w-32 shrink-0 pt-0.5">{label}</span>
      <span className={`flex-1 text-base-content/80 break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {badge
          ? <span className={`badge badge-xs ${badgeCls || 'badge-primary'}`}>{badge}</span>
          : value}
      </span>
    </div>
  );
};

// ─── Complete Modal ───────────────────────────────────────────────────────────

const CompleteModal = ({ open, onClose, onSubmit, loading }) => {
  const [notes,  setNotes]  = useState('');
  const [code,   setCode]   = useState('');
  const [reason, setReason] = useState('');

  const reset = () => { setNotes(''); setCode(''); setReason(''); };
  const submit = () => { onSubmit({ doctorNotes: notes, diagnosisCode: code, reasonForVisit: reason }); reset(); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="bg-base-100 border border-base-300 rounded-t-3xl sm:rounded-2xl shadow-depth-lg w-full sm:max-w-lg p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* drag handle on mobile */}
            <div className="flex justify-center mb-4 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-base-300" />
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-success/10">
                <CheckCircle2 size={20} className="text-success" />
              </div>
              <div>
                <h3 className="font-bold font-montserrat text-base sm:text-lg">Complete Consultation</h3>
                <p className="text-xs text-base-content/40">Finalise OP record with clinical summary</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/40 block mb-1">Reason for Visit</label>
                <input className="input-field text-sm" placeholder="Chief complaint / reason..." value={reason}
                  onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/40 block mb-1">
                  ICD-10 Diagnosis Code <span className="normal-case font-normal text-base-content/30">(optional)</span>
                </label>
                <input className="input-field text-sm font-mono" placeholder="e.g. J06.9" value={code}
                  onChange={(e) => setCode(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/40 block mb-1">Doctor Notes</label>
                <textarea className="input-field text-sm min-h-[88px] resize-none"
                  placeholder="Clinical findings, observations, treatment plan..."
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button className="btn btn-ghost flex-1" onClick={() => { onClose(); reset(); }} disabled={loading}>Cancel</button>
              <button className="btn btn-success flex-1 gap-1.5" onClick={submit} disabled={loading}>
                {loading ? <span className="loading loading-xs loading-spinner" /> : <CheckCircle2 size={14} />}
                Mark Complete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const DetailPanel = ({ opId, onClose, router }) => {
  const dispatch      = useDispatch();
  const op            = useSelector(selectSelectedOP);
  const prescriptions = useSelector(selectPrescriptions);
  const loading       = useSelector(selectClinicalLoading('fetchOPRecordById'));
  const loadingComplete = useSelector(selectClinicalLoading('completeOPRecord'));
  const loadingPdf    = useSelector(selectClinicalLoading('downloadPrescriptionPdf'));
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    if (opId) {
      dispatch(fetchOPRecordById(opId));
      dispatch(fetchPrescriptions({ outPatientRecord: opId, limit: 50 }));
    }
    return () => { dispatch(clearSelectedOP()); };
  }, [opId, dispatch]);

  const linkedRx = useMemo(
    () => prescriptions.filter((p) => p.outPatientRecord === opId),
    [prescriptions, opId]
  );

  const canComplete = op && ['scheduled', 'in_progress'].includes(op.status);

  const handleComplete = async (body) => {
    await dispatch(completeOPRecord({ id: op._id, ...body }));
    setShowComplete(false);
    dispatch(fetchOPRecordById(op._id));
  };

  if (loading || !op) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/40 p-8">
        {loading
          ? <><span className="loading loading-md loading-spinner" /><p className="text-sm">Loading OP record...</p></>
          : <><FileText size={32} strokeWidth={1} /><p className="text-sm">Select an OP record</p></>}
      </div>
    );
  }

  const followUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Panel header */}
        <div className="flex items-start justify-between px-4 sm:px-5 py-4 border-b border-base-300 shrink-0"
          style={{ borderTop: '3px solid var(--primary)' }}>
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-black text-primary text-sm">{op.opNumber}</span>
              <StatusBadge status={op.status} />
              {op.isFollowUp && <span className="badge badge-xs badge-secondary">Follow-up</span>}
              {followUpEligible && (
                <span className="badge badge-xs badge-success gap-1">
                  <CalendarCheck size={9} /> F/U Eligible
                </span>
              )}
            </div>
            <p className="text-xs text-base-content/40 mt-0.5 truncate">{fmt(op.scheduledAt)}</p>
          </div>
          <button className="btn btn-ghost btn-xs btn-circle shrink-0" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 sm:px-4 py-4 space-y-3">

          <DetailSection icon={User} title="Patient" accent="secondary">
            <IR label="Name"  value={op.patientName || op.patient?.name} />
            <IR label="Phone" value={op.patient?.phone} />
            <IR label="Email" value={op.patient?.email} />
          </DetailSection>

          <DetailSection icon={Stethoscope} title="Consultation" accent="primary">
            <IR label="Type" value={
              <span className="inline-flex items-center gap-1">
                {consultIcon(op.consultationType)}{op.consultationType}
              </span>
            } />
            <IR label="Scheduled" value={fmt(op.scheduledAt)} />
            <IR label="Started"   value={fmt(op.startedAt)} />
            <IR label="Completed" value={fmt(op.completedAt)} />
            <IR label="Booking"   value={op.bookingNumber} mono />
          </DetailSection>

          {(op.reasonForVisit || op.doctorNotes || op.diagnosisCode) && (
            <DetailSection icon={StickyNote} title="Clinical Notes" accent="accent">
              {op.reasonForVisit && (
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1">Reason for Visit</p>
                  <p className="text-sm text-base-content/80">{op.reasonForVisit}</p>
                </div>
              )}
              {op.diagnosisCode && (
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1">ICD-10</p>
                  <span className="badge badge-sm badge-primary font-mono">{op.diagnosisCode}</span>
                </div>
              )}
              {op.doctorNotes && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1">Doctor Notes</p>
                  <p className="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">{op.doctorNotes}</p>
                </div>
              )}
            </DetailSection>
          )}

          <DetailSection icon={Hash} title="Billing" accent="info">
            <IR label="Fee"          value={op.consultationFee != null ? `₹ ${op.consultationFee}` : '—'} />
            <IR label="Fee Source"   badge={op.feeSource} badgeCls={feeSourceBadge(op.feeSource)} />
            <IR label="Subscription" value={op.isCoveredBySubscription ? 'Yes' : 'No'} />
          </DetailSection>

          {(op.followUpExpiry || op.followUpFee != null || op.parentOp) && (
            <DetailSection icon={CalendarCheck} title="Follow-Up Window" accent="secondary">
              <IR label="Eligible Until" value={fmtDate(op.followUpExpiry)} />
              <IR label="Follow-Up Fee"  value={op.followUpFee != null ? `₹ ${op.followUpFee}` : '—'} />
              {op.parentOp && <IR label="Parent OP" value={op.parentOp?.toString()} mono />}
              {followUpEligible && (
                <div className="mt-2 p-2.5 rounded-lg bg-success/10 border border-success/20 text-xs text-success font-semibold">
                  ✓ Patient can book follow-up at ₹{op.followUpFee ?? 0}
                </div>
              )}
            </DetailSection>
          )}

          {op.prescriptionUrl && (
            <DetailSection icon={FileText} title="Prescription Document" accent="primary">
              <a href={op.prescriptionUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                <Eye size={12} /> Open Prescription PDF
              </a>
            </DetailSection>
          )}

          <DetailSection icon={Pill} title={`Linked Prescriptions (${linkedRx.length})`} accent="primary">
            {linkedRx.length === 0 ? (
              <p className="text-xs text-base-content/40 italic">No prescriptions issued yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedRx.map((rx) => (
                  <motion.div
                    key={rx._id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between bg-base-200 rounded-xl px-3 py-2.5 border border-base-300 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary">{rx.rxNumber}</span>
                        <span className={`badge badge-xs ${rxStatusCfg(rx.status)}`}>{rx.status}</span>
                      </div>
                      <p className="text-xs text-base-content/40 mt-0.5 truncate">
                        {fmtDate(rx.issuedAt)} · {rx.medicines?.length || 0} medicines
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button title="View" className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => router.push(`/doctor/prescriptions/${rx._id}`)}>
                        <Eye size={12} />
                      </button>
                      <button title="Download PDF" disabled={loadingPdf}
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => dispatch(downloadPrescriptionPdf(rx._id))}>
                        <Download size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </DetailSection>

        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-base-300 px-3 sm:px-4 py-3 flex flex-wrap gap-2 bg-base-100">
          <button
            className="btn btn-primary btn-sm flex-1 gap-1.5 min-w-[130px]"
            onClick={() => router.push(`/doctor/prescriptions/new?opId=${op._id}`)}
          >
            <PenLine size={13} /> Write Rx
          </button>
          {canComplete && (
            <button
              className="btn btn-success btn-sm flex-1 gap-1.5 min-w-[130px]"
              onClick={() => setShowComplete(true)}
            >
              <CheckCircle2 size={13} /> Mark Complete
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm gap-1.5"
            onClick={() => router.push(`/doctor/op-records/${op._id}`)}
            title="Full page detail"
          >
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>

      <CompleteModal
        open={showComplete}
        onClose={() => setShowComplete(false)}
        onSubmit={handleComplete}
        loading={loadingComplete}
      />
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OPManagement() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const params   = useParams();
  const routeId  = params?.id;

  const opRecords   = useSelector(selectOPRecords);
  const total       = useSelector(selectOPRecordsTotal);
  const loadingList = useSelector(selectClinicalLoading('fetchOPRecords'));
  const errorList   = useSelector(selectClinicalError('fetchOPRecords'));

  // Filters
  const [status,        setStatus]        = useState('');
  const [consType,      setConsType]      = useState('');
  const [search,        setSearch]        = useState('');
  const [from,          setFrom]          = useState('');
  const [to,            setTo]            = useState('');
  const [page,          setPage]          = useState(1);
  const [sortAsc,       setSortAsc]       = useState(false);
  const [filtersOpen,   setFiltersOpen]   = useState(false); // mobile filter toggle

  // Panel
  const [selectedId, setSelectedId] = useState(routeId || null);
  const [panelOpen,  setPanelOpen]  = useState(!!routeId);

  const fetchList = useCallback(() => {
    dispatch(fetchOPRecords({
      status: status  || undefined,
      from:   from    || undefined,
      to:     to      || undefined,
      page,
      limit: PAGE_LIMIT,
    }));
  }, [dispatch, status, from, to, page]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { setPage(1); }, [status, consType, from, to, search]);

  useEffect(() => {
    if (routeId) { setSelectedId(routeId); setPanelOpen(true); }
  }, [routeId]);

  const filtered = useMemo(() => {
    let list = [...opRecords];
    if (consType) list = list.filter((o) => o.consultationType === consType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.opNumber?.toLowerCase().includes(q) ||
          (o.patientName || o.patient?.name || '').toLowerCase().includes(q) ||
          o.bookingNumber?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) =>
      sortAsc
        ? new Date(a.scheduledAt) - new Date(b.scheduledAt)
        : new Date(b.scheduledAt) - new Date(a.scheduledAt)
    );
    return list;
  }, [opRecords, consType, search, sortAsc]);

  const stats = useMemo(() => ({
    total,
    completed: opRecords.filter((o) => o.status === 'completed').length,
    pending:   opRecords.filter((o) => ['scheduled', 'in_progress'].includes(o.status)).length,
    noShow:    opRecords.filter((o) => o.status === 'no_show').length,
  }), [opRecords, total]);

  const barData    = useMemo(() => buildBarData(opRecords), [opRecords]);
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const activeFiltersCount = [status, consType, from, to, search].filter(Boolean).length;

  const openPanel = (id) => {
    setSelectedId(id);
    setPanelOpen(true);
    window.history.pushState({}, '', `/doctor/op-records/${id}`);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelectedId(null);
    window.history.pushState({}, '', '/doctor/op-records');
    dispatch(clearSelectedOP());
  };

  const clearFilters = () => {
    setStatus(''); setConsType(''); setFrom(''); setTo(''); setSearch('');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content flex flex-col">

      {/* ── Top bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300 px-4 sm:px-6 py-3 sm:py-4"
      >
        <div className="  mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <ClipboardList size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="font-black font-montserrat text-base sm:text-lg text-base-content leading-tight">
                OP Records
              </h1>
              <p className="text-xs text-base-content/40">{total} records · Out-Patient Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={fetchList} disabled={loadingList}>
              <RefreshCw size={13} className={loadingList ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              className="btn btn-primary btn-sm gap-1.5"
              onClick={() => router.push('/doctor/appointments')}
            >
              <CalendarDays size={13} />
              <span className="hidden xs:inline">Appointments</span>
            </button>
          </div>
        </div>
      </motion.div>

      <div className="w-full  mx-auto px-2   py-4 sm:py-6 flex-1 flex flex-col gap-4 sm:gap-5">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap gap-3">
          {[
            { label: 'Total OPs',  value: stats.total,     color: 'var(--primary)',  Icon: Layers       },
            { label: 'Completed',  value: stats.completed, color: 'var(--success)',  Icon: CheckCircle2 },
            { label: 'Pending',    value: stats.pending,   color: 'var(--warning)',  Icon: Clock3       },
            { label: 'No Show',    value: stats.noShow,    color: 'var(--error)',    Icon: AlertCircle  },
          ].map(({ label, value, color, Icon }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-base-300 bg-base-100 p-3 sm:p-4 flex items-center gap-3 sm:gap-5 lg:w-[220px]"
              style={{ borderTop: `3px solid ${color}` }}
            >
              <div className="p-2 rounded-xl shrink-0"
                style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black font-montserrat leading-none" style={{ color }}>{value}</p>
                <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mt-0.5 truncate">{label}</p>
              </div>
            </motion.div>
          ))}

          {/* Mini bar chart — full-width on mobile, normal on lg */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-2 sm:col-span-4 lg:w-[260px] rounded-2xl border border-base-300 bg-base-100 p-3 sm:p-4"
            style={{ borderTop: '3px solid var(--accent)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">Last 7 Days</p>
            <ResponsiveContainer width="100%" height={52}>
              <BarChart data={barData} barSize={14} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }}
                  cursor={{ fill: 'color-mix(in srgb, var(--primary), transparent 85%)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={i === barData.length - 1 ? 'var(--primary)' : 'color-mix(in srgb, var(--primary), transparent 55%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">

          {/* Search + toggle row (always visible) */}
          <div className="flex items-center gap-2 p-3 sm:p-4">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
              <input
                className="input-field pl-9 text-sm w-full"
                placeholder="OP number, patient, booking…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter toggle button (mobile) */}
            <button
              className={`btn btn-sm gap-1.5 lg:hidden ${filtersOpen ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              onClick={() => setFiltersOpen((p) => !p)}
            >
              <Filter size={13} />
              {activeFiltersCount > 0 && (
                <span className="badge badge-xs badge-primary">{activeFiltersCount}</span>
              )}
              {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Sort button */}
            <button
              className="btn btn-ghost btn-sm gap-1.5 hidden sm:flex"
              onClick={() => setSortAsc((p) => !p)}
            >
              <CalendarDays size={13} />
              <span className="hidden md:inline">{sortAsc ? 'Oldest' : 'Newest'}</span>
            </button>

            {/* Clear (desktop only, inline) */}
            {activeFiltersCount > 0 && (
              <button className="btn btn-ghost btn-sm text-error gap-1 hidden lg:flex" onClick={clearFilters}>
                <XCircle size={13} /> Clear
              </button>
            )}
          </div>

     <AnimatePresence initial={false}>
    {filtersOpen && ( 
      <motion.div
        key="filters"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="lg:block" // Remove overflow-hidden here to prevent clipping during/after animation
      >
        <div className="border-t border-base-300 px-3 sm:px-4 pb-4 pt-4 flex flex-col gap-4">
          
          {/* Status chips: Ensure they wrap naturally */}
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s.value}
                onClick={() => setStatus(s.value)}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                  status === s.value
                    ? 'bg-primary border-primary text-primary-content'
                    : 'border-base-300 text-base-content/60'
                }`}
              >{s.label}</button>
            ))}
          </div>

          {/* Input Group: Stack better on mobile, row on desktop */}
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 items-end">
            
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 ml-1">Type</label>
              <select className="input-field text-sm w-full" value={consType}
                onChange={(e) => setConsType(e.target.value)}>
                {CONSULT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-[2] min-w-[240px]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 ml-1">Date Range</label>
              <div className="flex flex-col items-center gap-2">
                <input type="date" className="input-field   text-sm flex-1" value={from}
                  onChange={(e) => setFrom(e.target.value)} />
                <span className="text-base-content/30 text-sm">→</span>
                <input type="date" className="input-field text-sm flex-1" value={to}
                  onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-2 pt-2 lg:hidden">
              <button className="btn btn-ghost btn-sm flex-1 border border-base-300" onClick={() => setSortAsc(!sortAsc)}>
                <CalendarDays size={13} /> {sortAsc ? 'Oldest' : 'Newest'}
              </button>
              {activeFiltersCount > 0 && (
                <button className="btn btn-ghost btn-sm text-error flex-1 border border-error/20" onClick={clearFilters}>
                  <XCircle size={13} /> Clear
                </button>
              )}
            </div>

          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
        </div>

        {/* Error */}
        {errorList && (
          <div className="alert alert-error text-sm"><AlertCircle size={15} /><span>{errorList}</span></div>
        )}

        {/* ── Main: list + panel ── */}
        <div className={`flex gap-4 flex-1 min-h-0 ${panelOpen ? 'items-start' : ''}`}>

          {/* List — hide on mobile when panel open */}
          <div className={`flex-1 min-w-0 transition-all duration-300 ${panelOpen ? 'hidden lg:block lg:max-w-[55%]' : 'w-full'}`}>
            <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="text-xs">
                      <th>OP / Patient</th>
                      <th>Type</th>
                      <th>Scheduled</th>
                      <th>Status</th>
                      <th>Fee</th>
                      <th>Follow-up</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {loadingList && (
                      <tr><td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="loading loading-md loading-spinner" />
                          <span className="text-sm text-base-content/40">Loading OP records...</span>
                        </div>
                      </td></tr>
                    )}
                    {!loadingList && filtered.length === 0 && (
                      <tr><td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-base-content/40">
                          <FileText size={32} strokeWidth={1} />
                          <p className="text-sm font-medium">No OP records found</p>
                          <p className="text-xs">Adjust filters or date range</p>
                        </div>
                      </td></tr>
                    )}
                    <AnimatePresence mode="popLayout">
                      {!loadingList && filtered.map((op, i) => {
                        const isSelected = selectedId === op._id;
                        const followUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
                        return (
                          <motion.tr
                            key={op._id}
                            layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0, transition: { delay: i * 0.03 } }}
                            exit={{ opacity: 0 }}
                            onClick={() => openPanel(op._id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary/8 border-l-2 border-primary'
                                : 'hover:bg-primary/5'
                            }`}
                          >
                            <td>
                              <div>
                                <p className="font-mono text-xs font-bold text-primary">{op.opNumber}</p>
                                <p className="text-sm font-semibold text-base-content mt-0.5">
                                  {op.patientName || op.patient?.name || '—'}
                                </p>
                                {op.bookingNumber && (
                                  <p className="text-xs text-base-content/30 font-mono">{op.bookingNumber}</p>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="inline-flex items-center gap-1 text-xs text-base-content/60">
                                {consultIcon(op.consultationType)}{op.consultationType || '—'}
                              </span>
                            </td>
                            <td className="text-sm text-base-content/80 whitespace-nowrap">{fmt(op.scheduledAt)}</td>
                            <td><StatusBadge status={op.status} /></td>
                            <td>
                              <div>
                                <p className="text-sm font-semibold">
                                  {op.consultationFee != null ? `₹ ${op.consultationFee}` : '—'}
                                </p>
                                {op.isCoveredBySubscription && (
                                  <span className="badge badge-xs badge-success">Sub</span>
                                )}
                              </div>
                            </td>
                            <td>
                              {followUpEligible
                                ? <span className="badge badge-xs badge-success gap-1"><CalendarCheck size={9} /> Eligible</span>
                                : op.followUpExpiry
                                  ? <span className="badge badge-xs badge-error">Expired</span>
                                  : <span className="text-xs text-base-content/30">—</span>}
                            </td>
                            <td>
                              <ChevronRight size={15} className={`transition-colors ${isSelected ? 'text-primary' : 'text-base-content/20'}`} />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* ── Mobile cards ── */}
              <div className="md:hidden divide-y divide-base-300">
                {loadingList && (
                  <div className="py-16 flex justify-center">
                    <span className="loading loading-md loading-spinner" />
                  </div>
                )}
                {!loadingList && filtered.length === 0 && (
                  <div className="py-14 flex flex-col items-center gap-2 text-base-content/40">
                    <FileText size={28} strokeWidth={1} />
                    <p className="text-sm font-medium">No OP records found</p>
                    <p className="text-xs">Adjust filters or date range</p>
                  </div>
                )}
                <AnimatePresence>
                  {!loadingList && filtered.map((op, i) => {
                    const followUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
                    return (
                      <motion.div
                        key={op._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                        exit={{ opacity: 0 }}
                        onClick={() => openPanel(op._id)}
                        className={`p-4 cursor-pointer transition-colors active:bg-primary/10 ${
                          selectedId === op._id ? 'bg-primary/8' : 'hover:bg-primary/5'
                        }`}
                      >
                        {/* Row 1: OP number + status */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-bold text-primary">{op.opNumber}</p>
                            <p className="font-semibold text-base-content text-sm leading-tight mt-0.5 truncate">
                              {op.patientName || op.patient?.name || '—'}
                            </p>
                          </div>
                          <StatusBadge status={op.status} />
                        </div>

                        {/* Row 2: type + time */}
                        <div className="flex items-center justify-between text-xs text-base-content/50 mb-2">
                          <span className="flex items-center gap-1">
                            {consultIcon(op.consultationType)}
                            <span className="capitalize">{op.consultationType || '—'}</span>
                          </span>
                          <span>{fmt(op.scheduledAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </div>

                        {/* Row 3: badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {op.consultationFee != null && (
                            <span className="badge badge-xs badge-outline badge-primary">₹ {op.consultationFee}</span>
                          )}
                          {op.isCoveredBySubscription && (
                            <span className="badge badge-xs badge-success">Subscription</span>
                          )}
                          {followUpEligible && (
                            <span className="badge badge-xs badge-success gap-1">
                              <CalendarCheck size={9} /> F/U Eligible
                            </span>
                          )}
                          {op.bookingNumber && (
                            <span className="text-xs font-mono text-base-content/30 ml-auto">{op.bookingNumber}</span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-base-300 px-4 py-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-base-content/40 hidden sm:block">
                    Page {page} of {totalPages} · {total} records
                  </p>
                  <p className="text-xs text-base-content/40 sm:hidden">{page}/{totalPages}</p>

                  <div className="flex items-center gap-1">
                    <button className="btn btn-ghost btn-xs sm:btn-sm" disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft size={14} />
                    </button>

                    {/* Show fewer page buttons on mobile */}
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      const n = Math.max(1, Math.min(page - 1, totalPages - 2)) + i;
                      return (
                        <button key={n}
                          className={`btn btn-xs sm:btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setPage(n)}>{n}</button>
                      );
                    })}

                    <button className="btn btn-ghost btn-xs sm:btn-sm" disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Detail Panel — desktop slide-in ── */}
          <AnimatePresence>
            {panelOpen && (
              <motion.div
                key="panel"
                initial={{ opacity: 0, x: 40, width: 0 }}
                animate={{ opacity: 1, x: 0, width: '45%' }}
                exit={{ opacity: 0, x: 40, width: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="hidden lg:flex flex-col bg-base-100 border border-base-300 rounded-2xl overflow-hidden"
                style={{ minWidth: 320, maxWidth: 480, height: 'calc(100vh - 190px)', position: 'sticky', top: 88 }}
              >
                <DetailPanel opId={selectedId} onClose={closePanel} router={router} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Detail Panel — mobile full-screen bottom sheet ── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="mobile-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="lg:hidden fixed inset-0 z-40 bg-base-100 flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Handle + header */}
            <div className="shrink-0">
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="w-10 h-1 rounded-full bg-base-300" />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-base-300">
                <button className="btn btn-ghost btn-sm btn-circle" onClick={closePanel}>
                  <ArrowLeft size={16} />
                </button>
                <span className="font-bold font-montserrat text-sm text-base-content">OP Details</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <DetailPanel opId={selectedId} onClose={closePanel} router={router} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}