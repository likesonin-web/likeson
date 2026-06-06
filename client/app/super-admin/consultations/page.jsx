'use client';

/**
 * AdminConsultationDashboard.jsx
 * Admin / SuperAdmin — Online Doctor Consultation Management
 *
 * Uses: Next.js · Tailwind CSS (global.css tokens) · Lucide React · Framer Motion
 * CSS: styles/consultation-admin.css (no inline styles)
 *
 * Sections:
 *  - Platform stats bar
 *  - Active sessions (live)
 *  - All consultations table (paginated, filterable)
 *  - Override status modal
 *  - Assign admin modal
 *  - Recording viewer
 *  - Cron job triggers
 */

import React, {
  useState, useEffect, useCallback, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Users, Video, CheckCircle2, XCircle, Clock,
  AlertTriangle, Search, Filter, RefreshCw, Play, Square,
  UserCheck, ChevronLeft, ChevronRight, MoreVertical,
  Mic, MicOff, Camera, Radio, Shield, Zap, Eye,
  FileText, Download, Trash2, Ban, RotateCcw, Terminal,
  MonitorPlay, PhoneCall, TrendingUp, Star, Calendar,
  ChevronDown, X, Check, Info, Wifi, Bell, Settings,
  PlayCircle, StopCircle, Circle,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAdminAll,
  fetchAdminActive,
  fetchAdminStats,
  fetchAdminUpcoming,
  overrideStatus,
  assignAdmin,
  startRecording,
  stopRecording,
  fetchRecordingUrls,
  triggerAutoMiss,
  triggerTokenRefreshCron,
  triggerReminders,
  triggerExpirePrescriptions,
  selectAdminAll,
  selectAdminActive,
  selectAdminStats,
  selectAdminUpcoming,
  selectPagination,
  selectLoading,
  selectError,
} from '@/store/slices/consultationSlice';
import { selectUser } from '@/store/slices/userSlice';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  scheduled:        { label: 'Scheduled',    color: 'badge-info',    icon: Calendar },
  waiting:          { label: 'Waiting',      color: 'badge-warning', icon: Clock },
  doctor_joined:    { label: 'Dr. Joined',   color: 'badge-primary', icon: UserCheck },
  patient_joined:   { label: 'Pt. Joined',   color: 'badge-primary', icon: UserCheck },
  in_progress:      { label: 'Live',         color: 'badge-success', icon: Radio },
  paused:           { label: 'Paused',       color: 'badge-warning', icon: Clock },
  completed:        { label: 'Completed',    color: 'badge-success', icon: CheckCircle2 },
  cancelled:        { label: 'Cancelled',    color: 'badge-error',   icon: XCircle },
  missed:           { label: 'Missed',       color: 'badge-error',   icon: AlertTriangle },
  no_show_patient:  { label: 'No Show (Pt)', color: 'badge-error',   icon: AlertTriangle },
  no_show_doctor:   { label: 'No Show (Dr)', color: 'badge-error',   icon: AlertTriangle },
  technical_failure:{ label: 'Tech Failure', color: 'badge-error',   icon: Zap },
};

const CONSULTATION_TYPES = ['video', 'audio', 'chat', 'in_person', 'home_visit'];
const ALL_STATUSES = Object.keys(STATUS_CONFIG);
const ITEMS_PER_PAGE = 15;

const OVERRIDE_STATUSES = [
  'scheduled', 'waiting', 'in_progress', 'paused',
  'completed', 'cancelled', 'missed', 'no_show_patient',
  'no_show_doctor', 'technical_failure',
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmt = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const fmtDuration = (sec) => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const typeIcon = (type) => {
  switch (type) {
    case 'video':      return <Video size={13} />;
    case 'audio':      return <Mic size={13} />;
    case 'in_person':  return <UserCheck size={13} />;
    case 'home_visit': return <Activity size={13} />;
    default:           return <FileText size={13} />;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

const StatusBadge = memo(({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'badge-neutral', icon: Info };
  const Icon = cfg.icon;
  const isLive = status === 'in_progress';

  return (
    <span className={`badge ${cfg.color} badge-sm gap-1 font-semibold`}>
      {isLive
        ? <span className="ca-live-dot" />
        : <Icon size={10} />
      }
      {cfg.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════

const StatCard = memo(({ icon: Icon, label, value, sub, accent, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="ca-stat-card"
  >
    <div className="ca-stat-icon-wrap" style={{ '--accent-color': `var(--${accent})` }}>
      <Icon size={20} />
    </div>
    <div className="ca-stat-body">
      <p className="ca-stat-label">{label}</p>
      <p className="ca-stat-value">{value ?? '—'}</p>
      {sub && <p className="ca-stat-sub">{sub}</p>}
    </div>
    {trend !== undefined && (
      <span className={`ca-trend ${trend >= 0 ? 'ca-trend-up' : 'ca-trend-down'}`}>
        <TrendingUp size={12} />
        {Math.abs(trend)}%
      </span>
    )}
  </motion.div>
));
StatCard.displayName = 'StatCard';

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE SESSION CARD
// ═══════════════════════════════════════════════════════════════════════════════

const LiveSessionCard = memo(({ session, onViewDetails, onOverride, onStopRecording, onStartRecording }) => {
  const isRecording = session?.agora?.isRecordingEnabled;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="ca-live-card"
    >
      <div className="ca-live-header">
        <div className="ca-live-indicator">
          <span className="ca-live-dot" />
          LIVE
        </div>
        <span className="ca-live-code">{session?.consultationCode ?? '—'}</span>
        <span className="ca-live-type">
          {typeIcon(session?.consultationType)}
          {session?.consultationType}
        </span>
      </div>

      <div className="ca-live-participants">
        <div className="ca-live-person">
          <div className="ca-avatar ca-avatar-doctor">
            {(session?.doctorSnapshot?.name?.[0] ?? 'D').toUpperCase()}
          </div>
          <div>
            <p className="ca-person-name">{session?.doctorSnapshot?.name ?? '—'}</p>
            <p className="ca-person-role">{session?.doctorSnapshot?.specialization ?? 'Doctor'}</p>
          </div>
        </div>
        <div className="ca-live-vs">VS</div>
        <div className="ca-live-person">
          <div className="ca-avatar ca-avatar-patient">
            {(session?.patientSnapshot?.name?.[0] ?? 'P').toUpperCase()}
          </div>
          <div>
            <p className="ca-person-name">{session?.patientSnapshot?.name ?? '—'}</p>
            <p className="ca-person-role">Patient</p>
          </div>
        </div>
      </div>

      <div className="ca-live-meta">
        <span className="ca-live-meta-item">
          <Clock size={11} />
          {session?.sessionStartedAt ? fmtDuration(Math.round((Date.now() - new Date(session.sessionStartedAt)) / 1000)) : '—'}
        </span>
        {isRecording && (
          <span className="ca-rec-badge">
            <Circle size={8} className="fill-current animate-pulse" /> REC
          </span>
        )}
      </div>

      <div className="ca-live-actions">
        <button className="btn btn-xs btn-ghost" onClick={() => onViewDetails(session)}>
          <Eye size={13} /> Details
        </button>
        <button
          className={`btn btn-xs ${isRecording ? 'btn-error' : 'btn-outline'}`}
          onClick={() => isRecording ? onStopRecording(session._id) : onStartRecording(session._id)}
        >
          {isRecording ? <StopCircle size={13} /> : <PlayCircle size={13} />}
          {isRecording ? 'Stop Rec' : 'Record'}
        </button>
        <button className="btn btn-xs btn-warning" onClick={() => onOverride(session)}>
          <Shield size={13} /> Override
        </button>
      </div>
    </motion.div>
  );
});
LiveSessionCard.displayName = 'LiveSessionCard';

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER BAR
// ═══════════════════════════════════════════════════════════════════════════════

const FilterBar = memo(({ filters, onChange, onReset }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="ca-filter-bar">
      <div className="ca-search-wrap">
        <Search size={15} className="ca-search-icon" />
        <input
          className="ca-search-input"
          placeholder="Search by code, doctor, patient…"
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
        />
        {filters.search && (
          <button className="ca-search-clear" onClick={() => onChange({ search: '' })}>
            <X size={13} />
          </button>
        )}
      </div>

      <div className="ca-filter-controls">
        <select
          className="ca-select"
          value={filters.status}
          onChange={e => onChange({ status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
          ))}
        </select>

        <select
          className="ca-select"
          value={filters.type}
          onChange={e => onChange({ type: e.target.value })}
        >
          <option value="">All Types</option>
          {CONSULTATION_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          type="date"
          className="ca-select"
          value={filters.from}
          onChange={e => onChange({ from: e.target.value })}
        />
        <input
          type="date"
          className="ca-select"
          value={filters.to}
          onChange={e => onChange({ to: e.target.value })}
        />

        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onReset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
});
FilterBar.displayName = 'FilterBar';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTATIONS TABLE
// ═══════════════════════════════════════════════════════════════════════════════

const ConsultationRow = memo(({ consultation, onOverride, onAssign, onViewRecording, onDetails }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="ca-table-row"
    >
      {/* Code + Type */}
      <td className="ca-td ca-td-code">
        <div className="ca-code-cell">
          <span className="ca-code">{consultation.consultationCode ?? '—'}</span>
          <span className="ca-type-badge">
            {typeIcon(consultation.consultationType)}
            {consultation.consultationType}
          </span>
        </div>
      </td>

      {/* Doctor */}
      <td className="ca-td">
        <div className="ca-person-cell">
          <div className="ca-avatar ca-avatar-sm ca-avatar-doctor">
            {(consultation.doctorSnapshot?.name?.[0] ?? 'D').toUpperCase()}
          </div>
          <div>
            <p className="ca-cell-name">{consultation.doctorSnapshot?.name ?? '—'}</p>
            <p className="ca-cell-sub">{consultation.doctorSnapshot?.specialization ?? ''}</p>
          </div>
        </div>
      </td>

      {/* Patient */}
      <td className="ca-td">
        <div className="ca-person-cell">
          <div className="ca-avatar ca-avatar-sm ca-avatar-patient">
            {(consultation.patientSnapshot?.name?.[0] ?? 'P').toUpperCase()}
          </div>
          <div>
            <p className="ca-cell-name">{consultation.patientSnapshot?.name ?? '—'}</p>
            <p className="ca-cell-sub">{consultation.patientSnapshot?.phone ?? ''}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="ca-td">
        <StatusBadge status={consultation.status} />
      </td>

      {/* Scheduled At */}
      <td className="ca-td ca-td-date">
        <span className="ca-date">{fmt(consultation.scheduledAt)}</span>
      </td>

      {/* Duration */}
      <td className="ca-td ca-td-dur">
        <span className="ca-duration">{fmtDuration(consultation.actualDurationSec)}</span>
      </td>

      {/* Urgency */}
      <td className="ca-td">
        <span className={`ca-urgency ca-urgency-${consultation.urgency ?? 'routine'}`}>
          {consultation.urgency ?? 'routine'}
        </span>
      </td>

      {/* Rating */}
      <td className="ca-td">
        {consultation.isRated ? (
          <span className="ca-rating">
            <Star size={12} className="fill-current text-warning" />
            {consultation.rating?.overallRating ?? '—'}
          </span>
        ) : (
          <span className="ca-rating-empty">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="ca-td ca-td-actions">
        <div className="ca-action-group">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => onDetails(consultation)}
            title="View Details"
          >
            <Eye size={13} />
          </button>
          {consultation.agora?.recordingFileUrls?.length > 0 && (
            <button
              className="btn btn-ghost btn-xs text-info"
              onClick={() => onViewRecording(consultation._id)}
              title="View Recordings"
            >
              <MonitorPlay size={13} />
            </button>
          )}

          {/* Context menu */}
          <div className="ca-menu-wrap">
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreVertical size={13} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="ca-menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                    className="ca-context-menu"
                  >
                    <button
                      className="ca-menu-item"
                      onClick={() => { onOverride(consultation); setMenuOpen(false); }}
                    >
                      <Shield size={13} /> Override Status
                    </button>
                    <button
                      className="ca-menu-item"
                      onClick={() => { onAssign(consultation); setMenuOpen(false); }}
                    >
                      <UserCheck size={13} /> Assign Admin
                    </button>
                    <button
                      className="ca-menu-item ca-menu-item-danger"
                      onClick={() => { onOverride({ ...consultation, _forceCancel: true }); setMenuOpen(false); }}
                    >
                      <Ban size={13} /> Force Cancel
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </td>
    </motion.tr>
  );
});
ConsultationRow.displayName = 'ConsultationRow';

// ═══════════════════════════════════════════════════════════════════════════════
// OVERRIDE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const OverrideModal = memo(({ consultation, onClose, onConfirm, loading }) => {
  const [newStatus, setNewStatus] = useState(consultation?.status ?? 'completed');
  const [reason, setReason] = useState('');

  return (
    <div className="ca-modal-backdrop">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        className="ca-modal"
      >
        <div className="ca-modal-header">
          <div className="ca-modal-title-group">
            <Shield size={18} className="text-warning" />
            <h2 className="ca-modal-title">Override Status</h2>
          </div>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ca-modal-body">
          <div className="ca-modal-info">
            <p className="ca-modal-info-row">
              <span className="ca-modal-info-label">Consultation</span>
              <span className="ca-modal-info-value">{consultation?.consultationCode}</span>
            </p>
            <p className="ca-modal-info-row">
              <span className="ca-modal-info-label">Current Status</span>
              <StatusBadge status={consultation?.status} />
            </p>
          </div>

          <div className="ca-form-group">
            <label className="ca-label">New Status *</label>
            <select
              className="ca-select ca-select-full"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
            >
              {OVERRIDE_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
              ))}
            </select>
          </div>

          <div className="ca-form-group">
            <label className="ca-label">Reason *</label>
            <textarea
              className="ca-textarea"
              placeholder="Provide a reason for this override…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="ca-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-warning gap-2"
            onClick={() => onConfirm(consultation._id, newStatus, reason)}
            disabled={!reason.trim() || loading}
          >
            {loading ? <span className="loading loading-xs loading-spinner" /> : <Shield size={14} />}
            Override
          </button>
        </div>
      </motion.div>
    </div>
  );
});
OverrideModal.displayName = 'OverrideModal';

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN ADMIN MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const AssignAdminModal = memo(({ consultation, currentUserId, onClose, onConfirm, loading }) => {
  const [adminId, setAdminId] = useState('');

  return (
    <div className="ca-modal-backdrop">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        className="ca-modal"
      >
        <div className="ca-modal-header">
          <div className="ca-modal-title-group">
            <UserCheck size={18} className="text-primary" />
            <h2 className="ca-modal-title">Assign Admin</h2>
          </div>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="ca-modal-body">
          <div className="ca-modal-info">
            <p className="ca-modal-info-row">
              <span className="ca-modal-info-label">Consultation</span>
              <span className="ca-modal-info-value">{consultation?.consultationCode}</span>
            </p>
            {consultation?.assignedAdminId && (
              <p className="ca-modal-info-row">
                <span className="ca-modal-info-label">Currently Assigned</span>
                <span className="ca-modal-info-value ca-assigned">
                  <Check size={12} /> {consultation.assignedAdminId}
                </span>
              </p>
            )}
          </div>

          <div className="ca-form-group">
            <label className="ca-label">Admin User ID *</label>
            <input
              className="ca-input"
              placeholder="Paste admin user ID or email"
              value={adminId}
              onChange={e => setAdminId(e.target.value)}
            />
          </div>

          <button
            className="ca-self-assign-btn"
            onClick={() => setAdminId(currentUserId ?? '')}
          >
            <UserCheck size={13} /> Assign to myself
          </button>
        </div>

        <div className="ca-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary gap-2"
            onClick={() => onConfirm(consultation._id, adminId)}
            disabled={!adminId.trim() || loading}
          >
            {loading ? <span className="loading loading-xs loading-spinner" /> : <UserCheck size={14} />}
            Assign
          </button>
        </div>
      </motion.div>
    </div>
  );
});
AssignAdminModal.displayName = 'AssignAdminModal';

// ═══════════════════════════════════════════════════════════════════════════════
// RECORDING MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const RecordingModal = memo(({ consultationId, recordings, onClose, loading }) => (
  <div className="ca-modal-backdrop">
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 24 }}
      className="ca-modal ca-modal-wide"
    >
      <div className="ca-modal-header">
        <div className="ca-modal-title-group">
          <MonitorPlay size={18} className="text-info" />
          <h2 className="ca-modal-title">Session Recordings</h2>
        </div>
        <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="ca-modal-body">
        {loading ? (
          <div className="ca-loading-center">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="ca-loading-text">Loading recordings…</p>
          </div>
        ) : recordings?.urls?.length > 0 ? (
          <div className="ca-recording-list">
            {recordings.urls.map((url, i) => (
              <div key={i} className="ca-recording-item">
                <div className="ca-recording-icon">
                  <Video size={20} />
                </div>
                <div className="ca-recording-meta">
                  <p className="ca-recording-name">Recording {i + 1}</p>
                  {recordings.recordingStartedAt && (
                    <p className="ca-recording-date">{fmt(recordings.recordingStartedAt)}</p>
                  )}
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline gap-1.5"
                >
                  <Download size={13} /> Download
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="ca-empty-state">
            <Video size={36} className="ca-empty-icon" />
            <p className="ca-empty-title">No recordings available</p>
          </div>
        )}
      </div>
    </motion.div>
  </div>
));
RecordingModal.displayName = 'RecordingModal';

// ═══════════════════════════════════════════════════════════════════════════════
// CRON PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const CronPanel = memo(({ onTrigger, loading, results }) => {
  const crons = [
    { key: 'autoMiss',            label: 'Auto Miss',          icon: AlertTriangle,  action: 'triggerAutoMiss',            color: 'error'   },
    { key: 'tokenRefresh',        label: 'Token Refresh',      icon: RefreshCw,      action: 'triggerTokenRefreshCron',    color: 'primary' },
    { key: 'reminders',           label: 'Send Reminders',     icon: Bell,           action: 'triggerReminders',           color: 'info'    },
    { key: 'expirePrescriptions', label: 'Expire Prescriptions',icon: FileText,      action: 'triggerExpirePrescriptions', color: 'warning' },
  ];

  return (
    <div className="ca-cron-panel">
      <div className="ca-cron-header">
        <Terminal size={16} className="text-primary" />
        <h3 className="ca-cron-title">Cron Jobs</h3>
        <span className="ca-cron-badge">Admin Only</span>
      </div>
      <div className="ca-cron-grid">
        {crons.map(({ key, label, icon: Icon, action, color }) => (
          <div key={key} className="ca-cron-item">
            <div className="ca-cron-item-info">
              <Icon size={14} className={`text-${color}`} />
              <span className="ca-cron-item-label">{label}</span>
              {results?.[key] && (
                <span className="ca-cron-result">
                  ✓ {JSON.stringify(results[key]).slice(0, 30)}
                </span>
              )}
            </div>
            <button
              className={`btn btn-xs btn-outline text-${color} border-${color}/40`}
              onClick={() => onTrigger(action)}
              disabled={loading}
            >
              {loading ? <span className="loading loading-xs loading-spinner" /> : <Play size={11} />}
              Run
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
CronPanel.displayName = 'CronPanel';

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════════

const DetailDrawer = memo(({ consultation, onClose }) => {
  if (!consultation) return null;

  const fields = [
    { label: 'Consultation Code',  value: consultation.consultationCode },
    { label: 'Type',               value: consultation.consultationType },
    { label: 'Status',             value: <StatusBadge status={consultation.status} /> },
    { label: 'Urgency',            value: consultation.urgency },
    { label: 'Scheduled At',       value: fmt(consultation.scheduledAt) },
    { label: 'Session Started',    value: fmt(consultation.sessionStartedAt) },
    { label: 'Session Ended',      value: fmt(consultation.sessionEndedAt) },
    { label: 'Duration',           value: fmtDuration(consultation.actualDurationSec) },
    { label: 'Doctor',             value: consultation.doctorSnapshot?.name },
    { label: 'Specialization',     value: consultation.doctorSnapshot?.specialization },
    { label: 'Patient',            value: consultation.patientSnapshot?.name },
    { label: 'Patient Phone',      value: consultation.patientSnapshot?.phone },
    { label: 'Agora Channel',      value: consultation.agora?.channelName },
    { label: 'Is Follow-Up',       value: consultation.isFollowUp ? 'Yes' : 'No' },
    { label: 'Is Emergency',       value: consultation.isEmergency ? 'Yes' : 'No' },
    { label: 'Messages',           value: consultation.sessionMetrics?.chatMessagesCount ?? 0 },
    { label: 'Prescription Issued',value: consultation.sessionMetrics?.prescriptionIssued ? 'Yes' : 'No' },
    { label: 'Referral Issued',    value: consultation.sessionMetrics?.referralIssued ? 'Yes' : 'No' },
  ];

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="ca-drawer"
    >
      <div className="ca-drawer-header">
        <h2 className="ca-drawer-title">Consultation Details</h2>
        <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="ca-drawer-body">
        <div className="ca-detail-grid">
          {fields.map(({ label, value }) => (
            <div key={label} className="ca-detail-row">
              <span className="ca-detail-label">{label}</span>
              <span className="ca-detail-value">{value ?? '—'}</span>
            </div>
          ))}
        </div>

        {consultation.clinicalNotes?.chiefComplaint && (
          <div className="ca-detail-section">
            <h4 className="ca-detail-section-title">Chief Complaint</h4>
            <p className="ca-detail-text">{consultation.clinicalNotes.chiefComplaint}</p>
          </div>
        )}

        {consultation.cancellation && (
          <div className="ca-detail-section ca-detail-section-error">
            <h4 className="ca-detail-section-title">Cancellation</h4>
            <p className="ca-detail-text">
              By: {consultation.cancellation.cancelledBy} · {fmt(consultation.cancellation.cancelledAt)}
            </p>
            <p className="ca-detail-text">{consultation.cancellation.reason}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});
DetailDrawer.displayName = 'DetailDrawer';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminConsultationDashboard() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const consultations = useSelector(selectAdminAll);
  const activeSessions = useSelector(selectAdminActive);
  const stats = useSelector(selectAdminStats);
  const upcoming = useSelector(selectAdminUpcoming);
  const pagination = useSelector(selectPagination);
  const loadingAdmin = useSelector(selectLoading('admin'));
  const loadingFetch = useSelector(selectLoading('fetch'));
  const loadingAgora = useSelector(selectLoading('agora'));
  const loadingCron = useSelector(selectLoading('cron'));
  const error = useSelector(selectError);

  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({ search: '', status: '', type: '', from: '', to: '' });
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [recordingTarget, setRecordingTarget] = useState(null);
  const [recordingData, setRecordingData] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [cronResults, setCronResults] = useState({});

  // ── Fetch on mount + page/filter change ───────────────────────────────────
  useEffect(() => {
    dispatch(fetchAdminStats());
    dispatch(fetchAdminActive());
    dispatch(fetchAdminUpcoming());
  }, [dispatch]);

  useEffect(() => {
    const params = { page, limit: ITEMS_PER_PAGE };
    if (filters.status) params.status = filters.status;
    if (filters.type)   params.type   = filters.type;
    if (filters.from)   params.from   = filters.from;
    if (filters.to)     params.to     = filters.to;
    dispatch(fetchAdminAll(params));
  }, [dispatch, page, filters.status, filters.type, filters.from, filters.to]);

  const handleFilterChange = useCallback((patch) => {
    setFilters(f => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({ search: '', status: '', type: '', from: '', to: '' });
    setPage(1);
  }, []);

  // ── Filtered table rows (client-side search) ──────────────────────────────
  const filteredRows = useMemo(() => {
    if (!filters.search) return consultations;
    const q = filters.search.toLowerCase();
    return consultations.filter(c =>
      c.consultationCode?.toLowerCase().includes(q) ||
      c.doctorSnapshot?.name?.toLowerCase().includes(q) ||
      c.patientSnapshot?.name?.toLowerCase().includes(q) ||
      c.patientSnapshot?.phone?.includes(q)
    );
  }, [consultations, filters.search]);

  // ── Override ──────────────────────────────────────────────────────────────
  const handleOverrideConfirm = useCallback(async (id, status, reason) => {
    await dispatch(overrideStatus({ id, status, reason }));
    setOverrideTarget(null);
    dispatch(fetchAdminAll({ page, limit: ITEMS_PER_PAGE }));
  }, [dispatch, page]);

  // ── Assign Admin ──────────────────────────────────────────────────────────
  const handleAssignConfirm = useCallback(async (id, adminId) => {
    await dispatch(assignAdmin({ id, adminId }));
    setAssignTarget(null);
  }, [dispatch]);

  // ── Recording ─────────────────────────────────────────────────────────────
  const handleViewRecording = useCallback(async (consultationId) => {
    setRecordingTarget(consultationId);
    const res = await dispatch(fetchRecordingUrls(consultationId));
    if (res.payload) setRecordingData(res.payload);
  }, [dispatch]);

  // ── Cron ──────────────────────────────────────────────────────────────────
  const handleCronTrigger = useCallback(async (action) => {
    const cronKey = process.env.NEXT_PUBLIC_CRON_SECRET || '';
    let result;
    switch (action) {
      case 'triggerAutoMiss':           result = await dispatch(triggerAutoMiss(cronKey));          break;
      case 'triggerTokenRefreshCron':   result = await dispatch(triggerTokenRefreshCron(cronKey));  break;
      case 'triggerReminders':          result = await dispatch(triggerReminders(cronKey));          break;
      case 'triggerExpirePrescriptions':result = await dispatch(triggerExpirePrescriptions(cronKey));break;
      default: break;
    }
    if (result?.payload) {
      const key = action.replace('trigger', '').replace(/^\w/, c => c.toLowerCase());
      setCronResults(r => ({ ...r, [key]: result.payload }));
    }
  }, [dispatch]);

  const totalPages = pagination ? Math.ceil(pagination.total / ITEMS_PER_PAGE) : 1;

  return (
    <div className="ca-root" data-theme="admin">
      {/* ── PAGE HEADER ───────────────────────────────────────────────────── */}
      <header className="ca-page-header">
        <div className="ca-page-header-left">
          <div className="ca-page-icon">
            <Video size={22} />
          </div>
          <div>
            <h1 className="ca-page-title">Online Consultations</h1>
            <p className="ca-page-sub">
              {user?.role === 'superadmin' ? 'SuperAdmin' : 'Admin'} · Platform Management
            </p>
          </div>
        </div>
        <div className="ca-page-header-right">
          <button
            className="btn btn-ghost btn-sm gap-1.5"
            onClick={() => { dispatch(fetchAdminStats()); dispatch(fetchAdminActive()); }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {activeSessions.length > 0 && (
            <div className="ca-live-count">
              <span className="ca-live-dot" />
              {activeSessions.length} Live
            </div>
          )}
        </div>
      </header>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="ca-error-banner"
          >
            <AlertTriangle size={15} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STATS ─────────────────────────────────────────────────────────── */}
      <section className="ca-stats-grid">
        <StatCard icon={Activity}    label="Total Sessions"   value={stats?.total}     sub="All time"         accent="primary"  />
        <StatCard icon={Radio}       label="Live Now"         value={stats?.active}    sub="In progress"      accent="success"  trend={0} />
        <StatCard icon={CheckCircle2}label="Completed"        value={stats?.completed} sub="Successfully done" accent="info"    />
        <StatCard icon={Calendar}    label="Today"            value={stats?.todayCount}sub="New today"         accent="secondary"/>
        <StatCard icon={XCircle}     label="Cancelled/Missed" value={stats?.cancelled} sub="All time"         accent="error"    />
        <StatCard icon={Star}        label="Avg Rating"
          value={stats?.avgRating ? stats.avgRating.toFixed(1) : '—'}
          sub="Platform avg"  accent="warning"
        />
      </section>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <div className="ca-content">

        {/* ── LEFT: Table + Active ───────────────────────────────────────── */}
        <div className="ca-main">

          {/* Tabs */}
          <div className="ca-tabs">
            {[
              { key: 'all',      label: 'All Consultations', count: pagination?.total },
              { key: 'active',   label: 'Active Sessions',   count: activeSessions.length },
              { key: 'upcoming', label: 'Upcoming',          count: upcoming.length },
            ].map(tab => (
              <button
                key={tab.key}
                className={`ca-tab ${activeTab === tab.key ? 'ca-tab-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ca-tab-count">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'all' && (
              <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <FilterBar
                  filters={filters}
                  onChange={handleFilterChange}
                  onReset={handleFilterReset}
                />

                <div className="ca-table-wrap">
                  {loadingAdmin || loadingFetch ? (
                    <div className="ca-loading-center ca-loading-table">
                      <span className="loading loading-spinner loading-lg text-primary" />
                    </div>
                  ) : filteredRows.length === 0 ? (
                    <div className="ca-empty-state ca-empty-table">
                      <Search size={36} className="ca-empty-icon" />
                      <p className="ca-empty-title">No consultations found</p>
                      <p className="ca-empty-sub">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <table className="ca-table">
                      <thead>
                        <tr className="ca-thead-row">
                          <th className="ca-th">Code / Type</th>
                          <th className="ca-th">Doctor</th>
                          <th className="ca-th">Patient</th>
                          <th className="ca-th">Status</th>
                          <th className="ca-th">Scheduled</th>
                          <th className="ca-th">Duration</th>
                          <th className="ca-th">Urgency</th>
                          <th className="ca-th">Rating</th>
                          <th className="ca-th ca-th-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {filteredRows.map(c => (
                            <ConsultationRow
                              key={c._id}
                              consultation={c}
                              onOverride={setOverrideTarget}
                              onAssign={setAssignTarget}
                              onViewRecording={handleViewRecording}
                              onDetails={setDetailTarget}
                            />
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="ca-pagination">
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="ca-page-info">
                      Page {page} of {totalPages}
                      {pagination && (
                        <span className="ca-total">({pagination.total} total)</span>
                      )}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'active' && (
              <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {activeSessions.length === 0 ? (
                  <div className="ca-empty-state">
                    <PhoneCall size={36} className="ca-empty-icon" />
                    <p className="ca-empty-title">No active sessions right now</p>
                  </div>
                ) : (
                  <div className="ca-live-grid">
                    {activeSessions.map(s => (
                      <LiveSessionCard
                        key={s._id}
                        session={s}
                        onViewDetails={setDetailTarget}
                        onOverride={setOverrideTarget}
                        onStartRecording={id => dispatch(startRecording(id))}
                        onStopRecording={id => dispatch(stopRecording(id))}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'upcoming' && (
              <motion.div key="upcoming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {upcoming.length === 0 ? (
                  <div className="ca-empty-state">
                    <Calendar size={36} className="ca-empty-icon" />
                    <p className="ca-empty-title">No upcoming consultations in the next 24h</p>
                  </div>
                ) : (
                  <div className="ca-upcoming-list">
                    {upcoming.map(c => (
                      <div key={c._id} className="ca-upcoming-item">
                        <div className="ca-upcoming-time">
                          <Clock size={13} />
                          {fmt(c.scheduledAt)}
                        </div>
                        <div className="ca-upcoming-info">
                          <span className="ca-code">{c.consultationCode}</span>
                          <span className="ca-type-badge">
                            {typeIcon(c.consultationType)} {c.consultationType}
                          </span>
                        </div>
                        <div className="ca-upcoming-people">
                          <span>{c.doctorSnapshot?.name ?? '—'}</span>
                          <span className="ca-upcoming-sep">↔</span>
                          <span>{c.patientSnapshot?.name ?? '—'}</span>
                        </div>
                        <StatusBadge status={c.status} />
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setDetailTarget(c)}
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="ca-sidebar">
          <CronPanel
            onTrigger={handleCronTrigger}
            loading={loadingCron}
            results={cronResults}
          />

          {/* Quick stats */}
          <div className="ca-sidebar-card">
            <h3 className="ca-sidebar-title">
              <Wifi size={15} className="text-primary" /> Live Overview
            </h3>
            <div className="ca-live-overview">
              {activeSessions.slice(0, 5).map(s => (
                <div key={s._id} className="ca-live-overview-item">
                  <span className="ca-live-dot ca-live-dot-sm" />
                  <span className="ca-live-overview-code">{s.consultationCode}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
              {activeSessions.length === 0 && (
                <p className="ca-empty-sidebar">No active sessions</p>
              )}
              {activeSessions.length > 5 && (
                <button
                  className="btn btn-ghost btn-xs w-full mt-2"
                  onClick={() => setActiveTab('active')}
                >
                  +{activeSessions.length - 5} more
                </button>
              )}
            </div>
          </div>

          {/* Platform health */}
          <div className="ca-sidebar-card">
            <h3 className="ca-sidebar-title">
              <Activity size={15} className="text-success" /> Platform Health
            </h3>
            <div className="ca-health-list">
              <div className="ca-health-item">
                <span className="ca-health-label">Completion Rate</span>
                <span className="ca-health-value">
                  {stats?.total
                    ? `${((stats.completed / stats.total) * 100).toFixed(0)}%`
                    : '—'
                  }
                </span>
              </div>
              <div className="ca-health-item">
                <span className="ca-health-label">Avg Rating</span>
                <span className="ca-health-value">
                  {stats?.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : '—'}
                </span>
              </div>
              <div className="ca-health-item">
                <span className="ca-health-label">Cancellation Rate</span>
                <span className="ca-health-value">
                  {stats?.total
                    ? `${((stats.cancelled / stats.total) * 100).toFixed(0)}%`
                    : '—'
                  }
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {overrideTarget && (
          <OverrideModal
            key="override"
            consultation={overrideTarget}
            onClose={() => setOverrideTarget(null)}
            onConfirm={handleOverrideConfirm}
            loading={loadingAdmin}
          />
        )}

        {assignTarget && (
          <AssignAdminModal
            key="assign"
            consultation={assignTarget}
            currentUserId={user?._id}
            onClose={() => setAssignTarget(null)}
            onConfirm={handleAssignConfirm}
            loading={loadingAdmin}
          />
        )}

        {recordingTarget && (
          <RecordingModal
            key="recording"
            consultationId={recordingTarget}
            recordings={recordingData}
            onClose={() => { setRecordingTarget(null); setRecordingData(null); }}
            loading={loadingAgora}
          />
        )}
      </AnimatePresence>

      {/* ── DETAIL DRAWER ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {detailTarget && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="ca-drawer-backdrop"
              onClick={() => setDetailTarget(null)}
            />
            <DetailDrawer
              key="drawer"
              consultation={detailTarget}
              onClose={() => setDetailTarget(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}