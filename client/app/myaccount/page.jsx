'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Briefcase, Bell, Smartphone, Lock,
  Trash2, Plus, X, CheckCircle2, AlertTriangle, Loader2,
  FileText, Pill, Send, Monitor,
  Tablet, Globe, BellOff, LogOut, Flag,
  Activity, User, Stethoscope, Package,
  RefreshCw, CircleAlert, Download
} from 'lucide-react';
import {
  // KYC
  uploadKyc, selectKyc, selectSectionLoading,
  // Schemes
  addGovernmentScheme, deleteGovernmentScheme, selectGovernmentSchemes,
  // Audit Sessions
  deleteAuditSession, deleteAllAuditSessions, selectAuditSessions,
  // Device Tokens
  deleteDeviceToken, selectDeviceTokens,
  // Notifications
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
  selectNotifications, selectUnreadCount, selectNotifMeta,
  // Unblock
  requestUnblock,
  // Profile init
  fetchMyProfile,
  selectCustomerUser,
} from '@/store/slices/customerProfileSlice';

// ─── Animation variants ────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 20 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }) };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

// ─── Small helpers ─────────────────────────────────────────────────────────────
const KYC_TYPES    = ['Aadhaar', 'PAN', 'VoterID', 'Driving License', 'Passport', 'NREGA Job Card'];
const SCHEME_NAMES = [
  'Ayushman Bharat (PM-JAY)', 'Central Government Health Scheme (CGHS)',
  'Employees State Insurance (ESI)', 'Dr. YSR Aarogyasri (Andhra Pradesh)',
  'Mahatma Jyotiba Phule Jan Arogya Yojana', 'Biju Swasthya Kalyan Yojana',
  'Karunya Health Scheme', 'Tamil Nadu CMCHIS', 'Swasthya Sathi',
  'Aam Aadmi Bima Yojana', 'Rashtriya Swasthya Bima Yojana (RSBY)', 'Other State Scheme',
];

const StatusBadge = ({ status }) => {
  const map = {
    Pending:     { cls: 'badge-warning', label: 'Pending' },
    'In-Review': { cls: 'badge-info',    label: 'In Review' },
    Verified:    { cls: 'badge-success', label: 'Verified' },
    Rejected:    { cls: 'badge-error',   label: 'Rejected' },
  };
  const s = map[status] || map.Pending;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

const PlatformIcon = ({ platform }) => {
  const map = { android: Smartphone, ios: Tablet, web: Globe, desktop: Monitor };
  const Icon = map[platform] || Globe;
  return <Icon size={15} />;
};

const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
    <motion.div
      initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
      className="card p-6 max-w-sm w-full shadow-2xl text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: 'color-mix(in oklch, var(--error) 12%, var(--base-100))' }}>
        <AlertTriangle size={22} style={{ color: 'var(--error)' }} />
      </div>
      <p className="text-sm font-bold mb-5" style={{ color: 'var(--base-content)' }}>{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-70"
          style={{ background: 'var(--base-200)', color: 'var(--base-content)' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'var(--error)', color: '#fff' }}>
          Confirm
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const SectionHeader = ({ icon: Icon, title, accent = 'var(--primary)', action }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `color-mix(in oklch, ${accent} 15%, var(--base-200))` }}>
      <Icon size={17} style={{ color: accent }} />
    </div>
    <h2 className="font-black text-base uppercase tracking-widest flex-1"
      style={{ color: 'var(--base-content)' }}>
      {title}
    </h2>
    {action}
  </div>
);

const EmptyState = ({ icon: Icon, text }) => (
  <div className="text-center py-10 flex flex-col items-center gap-3">
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
      style={{ background: 'var(--base-200)' }}>
      <Icon size={22} style={{ color: 'var(--base-content)', opacity: 0.35 }} />
    </div>
    <p className="text-sm font-bold" style={{ color: 'var(--base-content)', opacity: 0.4 }}>{text}</p>
  </div>
);

// ─── Main Tabs ────────────────────────────────────────────────────────────────
const MAIN_TABS = [
  { id: 'kyc',     label: 'KYC',          icon: ShieldCheck },
  { id: 'schemes', label: 'Schemes',      icon: Briefcase   },
  { id: 'sessions',label: 'Sessions',     icon: Lock        },
  { id: 'notifs',  label: 'Notifications',icon: Bell        },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-PANELS
// ═══════════════════════════════════════════════════════════════════════════════

// ── KYC Panel ────────────────────────────────────────────────────────────────
function KycPanel() {
  const dispatch   = useDispatch();
  const kyc        = useSelector(selectKyc);
  const loading    = useSelector(selectSectionLoading('kyc'));
  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState({ type: '', documentNumber: '', holderName: '' });
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile]   = useState(null);

  const handleSubmit = () => {
    if (!form.type) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (frontFile) fd.append('documentFile', frontFile);
    if (backFile)  fd.append('backSideFile', backFile);
    dispatch(uploadKyc(fd)).then(() => {
      setOpen(false);
      setForm({ type: '', documentNumber: '', holderName: '' });
      setFrontFile(null);
      setBackFile(null);
    });
  };

  return (
    <div>
      <SectionHeader
        icon={ShieldCheck} title="KYC Documents" accent="var(--info)"
        action={
          <button onClick={() => setOpen(o => !o)}
            className="btn-primary-cta py-1.5 px-4 text-xs flex items-center gap-1.5">
            <Plus size={13} /> Add
          </button>
        }
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
            <div className="card p-5 space-y-4"
              style={{ border: '1px solid color-mix(in oklch, var(--info) 30%, var(--base-300))' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 opacity-50">
                    Document Type *
                  </label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="input-field w-full">
                    <option value="">Select type</option>
                    {KYC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 opacity-50">
                    Document Number
                  </label>
                  <input
                    value={form.documentNumber}
                    onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))}
                    className="input-field w-full" placeholder="XXXX XXXX XXXX" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 opacity-50">
                    Holder Name
                  </label>
                  <input
                    value={form.holderName}
                    onChange={e => setForm(f => ({ ...f, holderName: e.target.value }))}
                    className="input-field w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Front Side',          setter: setFrontFile, file: frontFile },
                  { label: 'Back Side (optional)', setter: setBackFile,  file: backFile  },
                ].map(({ label, setter, file }) => (
                  <label key={label}
                    className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-primary"
                    style={{ borderColor: file ? 'var(--success)' : 'var(--base-300)', background: 'var(--base-200)' }}>
                    <FileText size={20} style={{ color: file ? 'var(--success)' : 'var(--base-content)', opacity: 0.5 }} />
                    <span className="text-xs font-bold" style={{ color: 'var(--base-content)', opacity: 0.6 }}>
                      {file ? file.name.slice(0, 20) + '…' : label}
                    </span>
                    <input type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => setter(e.target.files[0])} />
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold opacity-60 hover:opacity-100 transition-opacity"
                  style={{ background: 'var(--base-200)' }}>
                  <X size={14} />
                </button>
                <button onClick={handleSubmit} disabled={loading || !form.type}
                  className="btn-primary-cta py-2 px-5 text-xs flex items-center gap-2">
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  Submit KYC
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {kyc?.length ? (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
          {kyc.map(doc => (
            <motion.div key={doc._id} variants={fadeUp} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in oklch, var(--info) 12%, var(--base-200))' }}>
                <FileText size={18} style={{ color: 'var(--info)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--base-content)' }}>{doc.type}</p>
                <p className="text-xs opacity-50 truncate">
                  {doc.holderName || 'No holder name'} · {doc.documentNumber || 'No number'}
                </p>
              </div>
              <StatusBadge status={doc.verificationStatus} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState icon={ShieldCheck} text="No KYC documents uploaded yet" />
      )}
    </div>
  );
}

// ── Government Schemes Panel ──────────────────────────────────────────────────
function SchemesPanel() {
  const dispatch   = useDispatch();
  const schemes    = useSelector(selectGovernmentSchemes);
  const loading    = useSelector(selectSectionLoading('schemes'));
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState({ schemeName: '', beneficiaryId: '', holderName: '' });
  const [file, setFile]       = useState(null);
  const [confirm, setConfirm] = useState(null);

  const handleAdd = () => {
    if (!form.schemeName) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('documentFile', file);
    dispatch(addGovernmentScheme(fd)).then(() => {
      setOpen(false);
      setForm({ schemeName: '', beneficiaryId: '', holderName: '' });
      setFile(null);
    });
  };

  return (
    <div>
      <SectionHeader
        icon={Briefcase} title="Government Schemes" accent="var(--success)"
        action={
          <button onClick={() => setOpen(o => !o)}
            className="btn-success py-1.5 px-4 text-xs flex items-center gap-1.5">
            <Plus size={13} /> Add
          </button>
        }
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
            <div className="card p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 opacity-50">
                    Scheme Name *
                  </label>
                  <select
                    value={form.schemeName}
                    onChange={e => setForm(f => ({ ...f, schemeName: e.target.value }))}
                    className="input-field w-full">
                    <option value="">Select scheme</option>
                    {SCHEME_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 opacity-50">
                    Beneficiary ID
                  </label>
                  <input
                    value={form.beneficiaryId}
                    onChange={e => setForm(f => ({ ...f, beneficiaryId: e.target.value }))}
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 opacity-50">
                    Holder Name
                  </label>
                  <input
                    value={form.holderName}
                    onChange={e => setForm(f => ({ ...f, holderName: e.target.value }))}
                    className="input-field w-full" />
                </div>
              </div>
              <label
                className="flex items-center gap-3 py-3 px-4 rounded-xl border border-dashed cursor-pointer hover:border-success transition-colors"
                style={{ borderColor: 'var(--base-300)', background: 'var(--base-200)' }}>
                <Download size={16} style={{ color: 'var(--success)' }} />
                <span className="text-xs font-bold opacity-60">
                  {file ? file.name : 'Upload card / document (optional)'}
                </span>
                <input type="file" className="hidden" accept="image/*,application/pdf"
                  onChange={e => setFile(e.target.files[0])} />
              </label>
              <div className="flex justify-end gap-3">
                <button onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold opacity-60 hover:opacity-100"
                  style={{ background: 'var(--base-200)' }}>
                  <X size={14} />
                </button>
                <button onClick={handleAdd} disabled={loading || !form.schemeName}
                  className="btn-success py-2 px-5 text-xs flex items-center gap-2">
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add Scheme
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            message="Remove this government scheme?"
            onConfirm={() => { dispatch(deleteGovernmentScheme(confirm)); setConfirm(null); }}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      {schemes?.length ? (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
          {schemes.map(s => (
            <motion.div key={s._id} variants={fadeUp} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in oklch, var(--success) 12%, var(--base-200))' }}>
                <Briefcase size={18} style={{ color: 'var(--success)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--base-content)' }}>{s.schemeName}</p>
                <p className="text-xs opacity-50">{s.holderName || '—'} · ID: {s.beneficiaryId || '—'}</p>
              </div>
              <span className={`badge ${s.isVerified ? 'badge-success' : 'badge-warning'}`}>
                {s.isVerified ? 'Verified' : 'Pending'}
              </span>
              <button onClick={() => setConfirm(s._id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: 'color-mix(in oklch, var(--error) 10%, var(--base-200))' }}>
                <Trash2 size={13} style={{ color: 'var(--error)' }} />
              </button>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState icon={Briefcase} text="No government schemes added" />
      )}
    </div>
  );
}

// ── Sessions & Devices Panel ──────────────────────────────────────────────────
function SessionsPanel() {
  const dispatch      = useDispatch();
  const sessions      = useSelector(selectAuditSessions);
  const tokens        = useSelector(selectDeviceTokens);
  const sessLoading   = useSelector(selectSectionLoading('auditSessions'));
  const tokLoading    = useSelector(selectSectionLoading('deviceTokens'));
  const unblockLoading = useSelector(selectSectionLoading('unblock'));
  const currentUser   = useSelector(selectCustomerUser);
  const [confirm, setConfirm]         = useState(null); // { type: 'session'|'allSessions'|'token', id }
  const [showUnblock, setShowUnblock] = useState(false);
  const [unblockForm, setUnblockForm] = useState('');

  // Sessions come from the profile response (user.auditSessions); no separate fetch needed.

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.type === 'session')     dispatch(deleteAuditSession(confirm.id));
    if (confirm.type === 'allSessions') dispatch(deleteAllAuditSessions());
    if (confirm.type === 'token')       dispatch(deleteDeviceToken(confirm.id));
    setConfirm(null);
  };

  const handleUnblock = () => {
    dispatch(requestUnblock(unblockForm)).then(() => {
      setShowUnblock(false);
      setUnblockForm('');
    });
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            message={
              confirm.type === 'allSessions' ? 'Sign out from ALL devices?' :
              confirm.type === 'session'     ? 'Sign out this device?' :
              'Remove this push notification token?'
            }
            onConfirm={doConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Active Sessions ── */}
      <div>
        <SectionHeader
          icon={Lock} title="Active Sessions" accent="var(--primary)"
          action={
            <button
              onClick={() => setConfirm({ type: 'allSessions' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{ background: 'color-mix(in oklch, var(--error) 10%, var(--base-200))', color: 'var(--error)' }}>
              <LogOut size={12} /> Sign Out All
            </button>
          }
        />
        {sessions?.length ? (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
            {sessions.map(s => (
              <motion.div key={s._id} variants={fadeUp} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in oklch, var(--primary) 10%, var(--base-200))' }}>
                  <PlatformIcon platform={s.platform} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--base-content)' }}>{s.deviceName}</p>
                  <p className="text-xs opacity-50 truncate">
                    {s.ipAddress} · {s.platform} · {new Date(s.lastActiveAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <button
                  onClick={() => setConfirm({ type: 'session', id: s._id })}
                  disabled={sessLoading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ background: 'color-mix(in oklch, var(--error) 10%, var(--base-200))' }}>
                  <LogOut size={13} style={{ color: 'var(--error)' }} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState icon={Monitor} text="No active sessions found" />
        )}
      </div>

      {/* ── Device Tokens ── */}
      <div>
        <SectionHeader icon={Smartphone} title="Push Devices" accent="var(--secondary)" />
        {tokens?.length ? (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
            {tokens.map(t => (
              <motion.div key={t._id} variants={fadeUp} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'color-mix(in oklch, var(--secondary) 12%, var(--base-200))' }}>
                  <PlatformIcon platform={t.platform} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--base-content)' }}>{t.deviceName}</p>
                  <p className="text-xs opacity-50 capitalize">
                    {t.platform} · Last used {new Date(t.lastUsedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <button
                  onClick={() => setConfirm({ type: 'token', id: t._id })}
                  disabled={tokLoading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80"
                  style={{ background: 'color-mix(in oklch, var(--error) 10%, var(--base-200))' }}>
                  <Trash2 size={13} style={{ color: 'var(--error)' }} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState icon={Smartphone} text="No push devices registered" />
        )}
      </div>

      {/* ── Unblock Request ── */}
      {currentUser?.isBlocked && (
        <div>
          <SectionHeader icon={CircleAlert} title="Account Blocked" accent="var(--error)" />
          <div className="card p-5 space-y-4"
            style={{ borderColor: 'color-mix(in oklch, var(--error) 30%, var(--base-300))' }}>
            <div className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'color-mix(in oklch, var(--error) 8%, var(--base-100))' }}>
              <AlertTriangle size={16} style={{ color: 'var(--error)' }} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--error)' }}>
                  Your account is currently blocked
                </p>
                {currentUser.blockReason && (
                  <p className="text-xs opacity-70 mt-0.5">Reason: {currentUser.blockReason}</p>
                )}
                {currentUser.unblockAt && (
                  <p className="text-xs opacity-70">
                    Auto-unblock: {new Date(currentUser.unblockAt).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            </div>
            <AnimatePresence>
              {showUnblock && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <textarea
                    value={unblockForm}
                    onChange={e => setUnblockForm(e.target.value)}
                    rows={3}
                    placeholder="Please explain why your account should be unblocked…"
                    className="input-field w-full resize-none text-sm" />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex gap-3">
              {!showUnblock ? (
                <button onClick={() => setShowUnblock(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'var(--error)', color: '#fff' }}>
                  <Send size={13} /> Request Unblock
                </button>
              ) : (
                <>
                  <button onClick={() => setShowUnblock(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold opacity-60 hover:opacity-100"
                    style={{ background: 'var(--base-200)' }}>
                    Cancel
                  </button>
                  <button onClick={handleUnblock} disabled={unblockLoading || !unblockForm.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'var(--error)', color: '#fff' }}>
                    {unblockLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Submit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Notifications Panel ───────────────────────────────────────────────────────
const NOTIF_TYPE_CONFIG = {
  Ride_Request:       { color: 'var(--primary)',    icon: Activity      },
  Ride_Update:        { color: 'var(--info)',        icon: RefreshCw     },
  Booking_Confirmed:  { color: 'var(--success)',    icon: CheckCircle2  },
  Booking_Cancelled:  { color: 'var(--error)',      icon: X             },
  Medicine_Ready:     { color: 'var(--accent)',     icon: Pill          },
  Lab_Report_Ready:   { color: 'var(--secondary)',  icon: FileText      },
  Prescription_Added: { color: 'var(--info)',       icon: Stethoscope   },
  Payment_Success:    { color: 'var(--success)',    icon: CheckCircle2  },
  Refund_Processed:   { color: 'var(--success)',    icon: RefreshCw     },
  KYC_Approved:       { color: 'var(--success)',    icon: ShieldCheck   },
  KYC_Rejected:       { color: 'var(--error)',      icon: ShieldCheck   },
  SOS_Alert:          { color: 'var(--error)',      icon: AlertTriangle },
  Account_Security:   { color: 'var(--warning)',    icon: Lock          },
  Account_Status:     { color: 'var(--warning)',    icon: CircleAlert   },
  Promo_Marketing:    { color: 'var(--chart-5)',    icon: Flag          },
};

function NotificationsPanel() {
  const dispatch = useDispatch();
  const notifs   = useSelector(selectNotifications);
  const unread   = useSelector(selectUnreadCount);
  const meta     = useSelector(selectNotifMeta);
  const loading  = useSelector(selectSectionLoading('notifications'));
  const [filter, setFilter] = useState('all');
  const [page, setPage]     = useState(1);

  useEffect(() => {
    dispatch(fetchNotifications({ page, limit: 20, unread: filter === 'unread' }));
  }, [dispatch, page, filter]);

  const filtered = filter === 'unread' ? notifs.filter(n => !n.isRead) : notifs;

  return (
    <div>
      <SectionHeader
        icon={Bell} title="Notifications" accent="var(--warning)"
        action={
          <div className="flex items-center gap-2">
            {unread > 0 && <span className="badge badge-warning">{unread} unread</span>}
            <button
              onClick={() => dispatch(markAllNotificationsRead())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{ background: 'color-mix(in oklch, var(--success) 12%, var(--base-200))', color: 'var(--success)' }}>
              <CheckCircle2 size={12} /> Mark All Read
            </button>
          </div>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--base-200)' }}>
        {['all', 'unread'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className="flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200"
            style={filter === f
              ? { background: 'var(--primary)', color: 'var(--primary-content)' }
              : { color: 'var(--base-content)', opacity: 0.6 }}>
            {f === 'all' ? 'All' : `Unread (${unread})`}
          </button>
        ))}
      </div>

      {loading && page === 1 ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filtered.length ? (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
          {filtered.map(n => {
            const cfg   = NOTIF_TYPE_CONFIG[n.type] || { color: 'var(--primary)', icon: Bell };
            const NIcon = cfg.icon;
            return (
              <motion.div key={n._id} variants={fadeUp}
                onClick={() => !n.isRead && dispatch(markNotificationRead(n._id))}
                className="card p-3.5 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md"
                style={{
                  opacity: n.isRead ? 0.65 : 1,
                  borderLeftWidth: n.isRead ? '1px' : '3px',
                  borderLeftColor: n.isRead ? 'var(--base-300)' : cfg.color,
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `color-mix(in oklch, ${cfg.color} 12%, var(--base-200))` }}>
                  <NIcon size={16} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm leading-snug" style={{ color: 'var(--base-content)' }}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: cfg.color }} />
                    )}
                  </div>
                  <p className="text-xs mt-0.5 opacity-60 line-clamp-2">{n.body}</p>
                  <p className="text-xs mt-1 opacity-40">
                    {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <EmptyState icon={BellOff} text="No notifications" />
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40 hover:opacity-80 transition-opacity"
            style={{ background: 'var(--base-200)' }}>
            ← Prev
          </button>
          <span className="text-xs font-bold opacity-50">Page {meta.page} / {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages || loading} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40 hover:opacity-80 transition-opacity"
            style={{ background: 'var(--base-200)' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MyAccount — root component
// ═══════════════════════════════════════════════════════════════════════════════
export default function MyAccount() {
  const dispatch = useDispatch();
  const user     = useSelector(selectCustomerUser);
  const unread   = useSelector(selectUnreadCount);
  const [tab, setTab] = useState('kyc');

  useEffect(() => { if (!user) dispatch(fetchMyProfile()); }, [dispatch, user]);

  // Sessions are part of user.auditSessions from fetchMyProfile — seed the slice from profile data.
  // No separate fetchAuditSessions call is needed since the /profile response includes auditSessions.

  const PANELS = {
    kyc:      KycPanel,
    schemes:  SchemesPanel,
    sessions: SessionsPanel,
    notifs:   NotificationsPanel,
  };
  const ActivePanel = PANELS[tab];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* ── Page Header ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-gradient-primary)' }}>
            <User size={20} style={{ color: 'var(--primary-content)' }} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight" style={{ color: 'var(--base-content)' }}>
              My Account
            </h1>
            <p className="text-xs opacity-50">Manage your health records, documents &amp; security</p>
          </div>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-2xl"
        style={{ background: 'var(--base-200)' }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="relative flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200"
            style={tab === t.id
              ? { background: 'var(--primary)', color: 'var(--primary-content)', boxShadow: '0 4px 16px color-mix(in oklch, var(--primary) 40%, transparent)' }
              : { color: 'var(--base-content)', opacity: 0.55 }}>
            <t.icon size={15} />
            <span className="leading-none">{t.label}</span>
            {t.id === 'notifs' && unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: 'var(--error)', color: '#fff' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ── Active Panel ── */}
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="card p-6">
          <ActivePanel />
        </motion.div>
      </AnimatePresence>

    </div>
  );
}