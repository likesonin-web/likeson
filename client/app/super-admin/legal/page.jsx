'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FileText, Shield, Users, CheckCircle2, XCircle, Clock,
  Plus, Edit3, Trash2, Eye, Send, ChevronDown, ChevronUp,
  AlertTriangle, Filter, Search, RefreshCw, Download,
  Globe, Lock, Unlock, History, ArrowRight, X, Check,
  BookOpen, Database, Activity, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, Zap, Calendar, Tag, Info,
  UserCheck, UserX, Layers, Settings, BarChart3
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';

// ─── Import all thunks & selectors ─────────────────────────────
import {
  fetchActiveTerms, fetchAllTermsVersions, fetchTermsById,
  createTerms, updateTerms, publishTerms, deleteTerms,
  fetchActivePrivacyPolicy, fetchAllPrivacyVersions, fetchPrivacyById,
  createPrivacyPolicy, updatePrivacyPolicy, publishPrivacyPolicy, deletePrivacyPolicy,
  fetchAllUserConsents, fetchConsentStatus,
  clearSelectedTerms, clearSelectedPrivacy,
  selectActiveTerms, selectAllTermsVersions, selectTermsPagination,
  selectTermsLoading, selectTermsSubmitting,
  selectActivePrivacy, selectAllPrivacyVersions, selectPrivacyPagination,
  selectPrivacyLoading, selectPrivacySubmitting,
  selectAllUserConsents, selectConsentPagination,
  selectConsentLoading,
} from '@/store/slices/legalSlice';

// ════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ════════════════════════════════════════════════════════════════

const pageVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: 40, transition: { duration: 0.25 } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.2 } },
};

const tabUnderline = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

// ════════════════════════════════════════════════════════════════
// HELPERS & CONSTANTS
// ════════════════════════════════════════════════════════════════

const ROLES = [
  'superadmin', 'admin', 'doctor', 'transportpartner',
  'driver', 'lab partner', 'customer', 'finance',
  'pharmacy', 'care assistant'
];

const COMPLIANCE = ['GDPR', 'HIPAA', 'PDPA', 'CCPA', 'PIPEDA', 'Other'];
const METHODS = ['explicit_checkbox', 'registration', 'forced_update', 'api', 'google_oauth'];
const PLATFORMS = ['web', 'android', 'ios'];

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ════════════════════════════════════════════════════════════════
// MICRO COMPONENTS
// ════════════════════════════════════════════════════════════════

const StatusBadge = ({ active, label }) => (
  <span className={`badge ${active ? 'badge-success' : 'badge-warning'}`}>
    {active ? <CheckCircle2 size={11} /> : <Clock size={11} />}
    {label || (active ? 'Active' : 'Draft')}
  </span>
);

const Pill = ({ children, color = 'primary' }) => (
  <span className={`badge badge-${color} text-[10px]`}>{children}</span>
);

const Spinner = ({ size = 'sm' }) => (
  <div className={`spinner ${size === 'lg' ? 'w-10 h-10 border-4' : 'w-5 h-5 border-2'}`} />
);

const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-base-content/40">
    <Icon size={44} strokeWidth={1} />
    <p className="font-semibold text-base">{title}</p>
    {sub && <p className="text-sm">{sub}</p>}
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-start justify-between mb-6">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-primary/10">
        <Icon size={20} className="text-primary" />
      </div>
      <div>
        <h3 className="font-black text-lg text-base-content tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-base-300">
      <p className="text-xs text-base-content/50">
        Page {pagination.page} of {pagination.pages} · {pagination.total} total
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="p-1.5 rounded-lg border border-base-300 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.pages}
          className="p-1.5 rounded-lg border border-base-300 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ════════════════════════════════════════════════════════════════

const ConfirmModal = ({ open, onClose, onConfirm, title, message, variant = 'danger', loading }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden" animate="visible" exit="exit"
          className="glass-card p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${variant === 'danger' ? 'bg-error/10' : 'bg-primary/10'}`}>
            {variant === 'danger' ? <AlertTriangle size={22} className="text-error" /> : <Zap size={22} className="text-primary" />}
          </div>
          <h4 className="font-black text-lg mb-2">{title}</h4>
          <p className="text-sm text-base-content/60 mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-base-300 text-sm font-semibold hover:border-base-content/40 transition-all">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${variant === 'danger' ? 'bg-error text-white hover:brightness-110' : 'btn-primary-cta'}`}
            >
              {loading ? <Spinner /> : <Check size={15} />}
              Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ════════════════════════════════════════════════════════════════
// DOCUMENT FORM MODAL (Terms / Privacy)
// ════════════════════════════════════════════════════════════════

const DocFormModal = ({ open, onClose, onSubmit, type, initial, submitting }) => {
  const isPrivacy = type === 'privacy';
  const isEdit = !!initial;

  const [form, setForm] = useState({
    version: '', title: '', slug: '', content: '', summary: '',
    effectiveDate: '', changeLog: '', requiresReAcceptance: false,
    applicableRoles: [],
    // privacy-only
    complianceFrameworks: [], dataRetentionPolicy: '',
    cookiePolicy: '', thirdPartySharing: false, geolocationTracking: false,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        version: initial.version || '',
        title: initial.title || '',
        slug: initial.slug || '',
        content: initial.content || '',
        summary: initial.summary || '',
        effectiveDate: initial.effectiveDate ? initial.effectiveDate.slice(0, 10) : '',
        changeLog: initial.changeLog || '',
        requiresReAcceptance: initial.requiresReAcceptance || false,
        applicableRoles: initial.applicableRoles || [],
        complianceFrameworks: initial.complianceFrameworks || [],
        dataRetentionPolicy: initial.dataRetentionPolicy || '',
        cookiePolicy: initial.cookiePolicy || '',
        thirdPartySharing: initial.thirdPartySharing || false,
        geolocationTracking: initial.geolocationTracking || false,
      });
    } else {
      setForm({
        version: '', title: '', slug: '', content: '', summary: '',
        effectiveDate: '', changeLog: '', requiresReAcceptance: false,
        applicableRoles: [],
        complianceFrameworks: [], dataRetentionPolicy: '',
        cookiePolicy: '', thirdPartySharing: false, geolocationTracking: false,
      });
    }
  }, [initial, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArray = (k, val) => setForm(f => ({
    ...f,
    [k]: f[k].includes(val) ? f[k].filter(x => x !== val) : [...f[k], val]
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            variants={slideInRight}
            initial="hidden" animate="visible" exit="exit"
            className="h-full w-full max-w-2xl bg-base-100 border-l border-base-300 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-base-100/95 backdrop-blur-md border-b border-base-300 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  {isPrivacy ? <Shield size={18} className="text-primary" /> : <FileText size={18} className="text-primary" />}
                </div>
                <div>
                  <h3 className="font-black text-base tracking-tight">
                    {isEdit ? 'Edit Draft' : 'Create Draft'} — {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
                  </h3>
                  <p className="text-xs text-base-content/50">Fill in all required fields</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Version & Title */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Version *</label>
                  <input
                    className="input-field w-full"
                    placeholder="e.g. 1.0.0"
                    value={form.version}
                    onChange={e => set('version', e.target.value)}
                    required
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Title</label>
                  <input className="input-field w-full" placeholder="Document title" value={form.title} onChange={e => set('title', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Slug</label>
                  <input className="input-field w-full" placeholder="url-friendly-slug" value={form.slug} onChange={e => set('slug', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Effective Date *</label>
                  <input type="date" className="input-field w-full" value={form.effectiveDate} onChange={e => set('effectiveDate', e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Content *</label>
                <textarea
                  className="input-field w-full min-h-[180px] resize-y font-mono text-xs leading-relaxed"
                  placeholder="Full legal document content (Markdown or HTML supported)..."
                  value={form.content}
                  onChange={e => set('content', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Summary</label>
                <textarea
                  className="input-field w-full min-h-[80px] resize-y"
                  placeholder="Short plain-language summary..."
                  value={form.summary}
                  onChange={e => set('summary', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Change Log</label>
                <input className="input-field w-full" placeholder="What changed in this version?" value={form.changeLog} onChange={e => set('changeLog', e.target.value)} />
              </div>

              {/* Applicable Roles */}
              <div>
                <label className="block text-xs font-bold text-base-content/60 mb-2 uppercase tracking-wider">Applicable Roles</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r} type="button"
                      onClick={() => toggleArray('applicableRoles', r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.applicableRoles.includes(r)
                        ? 'bg-primary text-primary-content border-primary'
                        : 'border-base-300 hover:border-primary hover:text-primary'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Re-acceptance */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300">
                <div>
                  <p className="text-sm font-bold">Requires Re-Acceptance</p>
                  <p className="text-xs text-base-content/50">Users must explicitly re-accept when this version goes live</p>
                </div>
                <button type="button" onClick={() => set('requiresReAcceptance', !form.requiresReAcceptance)} className="transition-all">
                  {form.requiresReAcceptance
                    ? <ToggleRight size={32} className="text-primary" />
                    : <ToggleLeft size={32} className="text-base-content/30" />}
                </button>
              </div>

              {/* Privacy-only fields */}
              {isPrivacy && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-base-content/60 mb-2 uppercase tracking-wider">Compliance Frameworks</label>
                    <div className="flex flex-wrap gap-2">
                      {COMPLIANCE.map(f => (
                        <button
                          key={f} type="button"
                          onClick={() => toggleArray('complianceFrameworks', f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.complianceFrameworks.includes(f)
                            ? 'bg-secondary text-secondary-content border-secondary'
                            : 'border-base-300 hover:border-secondary hover:text-secondary'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Data Retention Policy</label>
                      <input className="input-field w-full" placeholder="e.g. 2 years after account deletion" value={form.dataRetentionPolicy} onChange={e => set('dataRetentionPolicy', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Cookie Policy</label>
                      <input className="input-field w-full" placeholder="Brief cookie policy note" value={form.cookiePolicy} onChange={e => set('cookiePolicy', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'thirdPartySharing', label: 'Third-Party Sharing', desc: 'Data shared with 3rd parties' },
                      { key: 'geolocationTracking', label: 'Geolocation Tracking', desc: 'Location data is collected' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-base-200 border border-base-300">
                        <div>
                          <p className="text-xs font-bold">{label}</p>
                          <p className="text-xs text-base-content/50">{desc}</p>
                        </div>
                        <button type="button" onClick={() => set(key, !form[key])} className="transition-all">
                          {form[key]
                            ? <ToggleRight size={28} className="text-primary" />
                            : <ToggleLeft size={28} className="text-base-content/30" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Footer actions */}
              <div className="flex gap-3 pt-4 border-t border-base-300">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-base-300 font-semibold text-sm hover:border-base-content/40 transition-all">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-primary-cta flex items-center justify-center gap-2 py-3"
                >
                  {submitting ? <Spinner /> : <Check size={16} />}
                  {isEdit ? 'Save Changes' : 'Create Draft'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ════════════════════════════════════════════════════════════════
// VERSION ROW CARD
// ════════════════════════════════════════════════════════════════

const VersionCard = ({ doc, onView, onEdit, onPublish, onDelete, submitting }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      variants={cardVariants}
      layout
      className={`glass-card p-4 transition-all ${doc.isActive ? 'ring-1 ring-primary/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${doc.isActive ? 'bg-success animate-pulse' : 'bg-base-300'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm">v{doc.version}</span>
              <StatusBadge active={doc.isActive} />
              {doc.requiresReAcceptance && <Pill color="warning">Re-accept Required</Pill>}
            </div>
            <p className="text-xs text-base-content/50 mt-0.5 truncate">
              Effective: {formatDate(doc.effectiveDate)} · Created: {formatDate(doc.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onView(doc._id)} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" title="View">
            <Eye size={14} />
          </button>
          {!doc.isActive && (
            <>
              <button onClick={() => onEdit(doc)} className="p-1.5 rounded-lg hover:bg-info/10 hover:text-info transition-all" title="Edit">
                <Edit3 size={14} />
              </button>
              <button onClick={() => onPublish(doc._id)} disabled={submitting} className="p-1.5 rounded-lg hover:bg-success/10 hover:text-success transition-all" title="Publish">
                <Send size={14} />
              </button>
              <button onClick={() => onDelete(doc._id)} disabled={submitting} className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error transition-all" title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-base-200 transition-all">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-base-300 space-y-3">
              {doc.changeLog && (
                <div className="flex gap-2">
                  <History size={13} className="text-base-content/40 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-base-content/60">{doc.changeLog}</p>
                </div>
              )}
              {doc.applicableRoles?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Users size={13} className="text-base-content/40" />
                  {doc.applicableRoles.map(r => <Pill key={r}>{r}</Pill>)}
                </div>
              )}
              {doc.publishedAt && (
                <div className="flex gap-2">
                  <Calendar size={13} className="text-base-content/40 mt-0.5" />
                  <p className="text-xs text-base-content/60">Published: {formatDateTime(doc.publishedAt)}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════
// TERMS TAB
// ════════════════════════════════════════════════════════════════

const TermsTab = () => {
  const dispatch = useDispatch();
  const activeTerms = useSelector(selectActiveTerms);
  const allVersions = useSelector(selectAllTermsVersions);
  const pagination = useSelector(selectTermsPagination);
  const loading = useSelector(selectTermsLoading);
  const submitting = useSelector(selectTermsSubmitting);

  const [formOpen, setFormOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type: 'publish'|'delete', id }

  useEffect(() => {
    dispatch(fetchActiveTerms());
    dispatch(fetchAllTermsVersions({ page: 1 }));
  }, [dispatch]);

  const handleCreate = async (payload) => {
    await dispatch(createTerms(payload));
    setFormOpen(false);
    dispatch(fetchAllTermsVersions({ page: 1 }));
  };

  const handleEdit = async (payload) => {
    await dispatch(updateTerms({ id: editDoc._id, ...payload }));
    setEditDoc(null);
    dispatch(fetchAllTermsVersions({ page: pagination.page }));
  };

  const handlePublish = async () => {
    await dispatch(publishTerms(confirm.id));
    setConfirm(null);
    dispatch(fetchActiveTerms());
    dispatch(fetchAllTermsVersions({ page: 1 }));
  };

  const handleDelete = async () => {
    await dispatch(deleteTerms(confirm.id));
    setConfirm(null);
    dispatch(fetchAllTermsVersions({ page: 1 }));
  };

  return (
    <>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Left: version list */}
        <div>
          <SectionHeader
            icon={FileText}
            title="All Versions"
            subtitle={`${pagination.total} total versions`}
            action={
              <button onClick={() => { setEditDoc(null); setFormOpen(true); }} className="btn-primary-cta flex items-center gap-2 text-xs py-2 px-4">
                <Plus size={14} /> New Draft
              </button>
            }
          />

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : allVersions.length === 0 ? (
            <EmptyState icon={FileText} title="No versions yet" sub="Create your first Terms & Conditions draft" />
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
              {allVersions.map(doc => (
                <VersionCard
                  key={doc._id}
                  doc={doc}
                  onView={(id) => dispatch(fetchTermsById(id))}
                  onEdit={(doc) => { setEditDoc(doc); setFormOpen(true); }}
                  onPublish={(id) => setConfirm({ type: 'publish', id })}
                  onDelete={(id) => setConfirm({ type: 'delete', id })}
                  submitting={submitting}
                />
              ))}
            </motion.div>
          )}

          <Pagination pagination={pagination} onPageChange={(p) => dispatch(fetchAllTermsVersions({ page: p }))} />
        </div>

        {/* Right: active document card */}
        <div>
          <SectionHeader icon={CheckCircle2} title="Currently Active" subtitle="Live version shown to users" />
          {activeTerms ? (
            <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-5 ring-1 ring-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span className="font-black text-sm">v{activeTerms.version}</span>
                <StatusBadge active />
              </div>
              <h4 className="font-bold text-base mb-1">{activeTerms.title}</h4>
              {activeTerms.summary && <p className="text-xs text-base-content/60 leading-relaxed mb-3">{activeTerms.summary}</p>}
              <div className="space-y-2 text-xs text-base-content/50">
                <div className="flex justify-between"><span>Effective</span><span className="font-semibold text-base-content">{formatDate(activeTerms.effectiveDate)}</span></div>
                <div className="flex justify-between"><span>Published</span><span className="font-semibold text-base-content">{formatDate(activeTerms.publishedAt)}</span></div>
                {activeTerms.expiresAt && <div className="flex justify-between"><span>Expires</span><span className="font-semibold text-error">{formatDate(activeTerms.expiresAt)}</span></div>}
              </div>
              {activeTerms.applicableRoles?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-base-300">
                  {activeTerms.applicableRoles.map(r => <Pill key={r}>{r}</Pill>)}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-base-content/30">
              <Globe size={36} strokeWidth={1} />
              <p className="text-sm font-semibold">No active version</p>
              <p className="text-xs text-center">Publish a draft to make it live</p>
            </div>
          )}
        </div>
      </div>

      <DocFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditDoc(null); }}
        onSubmit={editDoc ? handleEdit : handleCreate}
        type="terms"
        initial={editDoc}
        submitting={submitting}
      />

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.type === 'publish' ? handlePublish : handleDelete}
        loading={submitting}
        variant={confirm?.type === 'delete' ? 'danger' : 'primary'}
        title={confirm?.type === 'publish' ? 'Publish Terms?' : 'Delete Draft?'}
        message={confirm?.type === 'publish'
          ? 'This will deactivate the current live version and publish this draft to all users.'
          : 'This will permanently delete this draft. This action cannot be undone.'}
      />
    </>
  );
};

// ════════════════════════════════════════════════════════════════
// PRIVACY TAB
// ════════════════════════════════════════════════════════════════

const PrivacyTab = () => {
  const dispatch = useDispatch();
  const active = useSelector(selectActivePrivacy);
  const allVersions = useSelector(selectAllPrivacyVersions);
  const pagination = useSelector(selectPrivacyPagination);
  const loading = useSelector(selectPrivacyLoading);
  const submitting = useSelector(selectPrivacySubmitting);

  const [formOpen, setFormOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    dispatch(fetchActivePrivacyPolicy());
    dispatch(fetchAllPrivacyVersions({ page: 1 }));
  }, [dispatch]);

  const handleCreate = async (payload) => {
    await dispatch(createPrivacyPolicy(payload));
    setFormOpen(false);
    dispatch(fetchAllPrivacyVersions({ page: 1 }));
  };

  const handleEdit = async (payload) => {
    await dispatch(updatePrivacyPolicy({ id: editDoc._id, ...payload }));
    setEditDoc(null);
    dispatch(fetchAllPrivacyVersions({ page: pagination.page }));
  };

  const handlePublish = async () => {
    await dispatch(publishPrivacyPolicy(confirm.id));
    setConfirm(null);
    dispatch(fetchActivePrivacyPolicy());
    dispatch(fetchAllPrivacyVersions({ page: 1 }));
  };

  const handleDelete = async () => {
    await dispatch(deletePrivacyPolicy(confirm.id));
    setConfirm(null);
    dispatch(fetchAllPrivacyVersions({ page: 1 }));
  };

  return (
    <>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div>
          <SectionHeader
            icon={Shield}
            title="All Versions"
            subtitle={`${pagination.total} total versions`}
            action={
              <button onClick={() => { setEditDoc(null); setFormOpen(true); }} className="btn-primary-cta flex items-center gap-2 text-xs py-2 px-4">
                <Plus size={14} /> New Draft
              </button>
            }
          />

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : allVersions.length === 0 ? (
            <EmptyState icon={Shield} title="No versions yet" sub="Create your first Privacy Policy draft" />
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
              {allVersions.map(doc => (
                <VersionCard
                  key={doc._id}
                  doc={doc}
                  onView={(id) => dispatch(fetchPrivacyById(id))}
                  onEdit={(doc) => { setEditDoc(doc); setFormOpen(true); }}
                  onPublish={(id) => setConfirm({ type: 'publish', id })}
                  onDelete={(id) => setConfirm({ type: 'delete', id })}
                  submitting={submitting}
                />
              ))}
            </motion.div>
          )}

          <Pagination pagination={pagination} onPageChange={(p) => dispatch(fetchAllPrivacyVersions({ page: p }))} />
        </div>

        {/* Active card */}
        <div>
          <SectionHeader icon={CheckCircle2} title="Currently Active" subtitle="Live version shown to users" />
          {active ? (
            <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-5 ring-1 ring-secondary/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span className="font-black text-sm">v{active.version}</span>
                <StatusBadge active />
              </div>
              <h4 className="font-bold text-base mb-1">{active.title}</h4>
              {active.summary && <p className="text-xs text-base-content/60 mb-3 leading-relaxed">{active.summary}</p>}

              {/* Compliance badges */}
              {active.complianceFrameworks?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {active.complianceFrameworks.map(f => <Pill key={f} color="info">{f}</Pill>)}
                </div>
              )}

              <div className="space-y-2 text-xs text-base-content/50">
                <div className="flex justify-between"><span>Effective</span><span className="font-semibold text-base-content">{formatDate(active.effectiveDate)}</span></div>
                <div className="flex justify-between"><span>Third-party sharing</span><span className={`font-semibold ${active.thirdPartySharing ? 'text-warning' : 'text-success'}`}>{active.thirdPartySharing ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between"><span>Geolocation</span><span className={`font-semibold ${active.geolocationTracking ? 'text-warning' : 'text-success'}`}>{active.geolocationTracking ? 'Enabled' : 'Disabled'}</span></div>
              </div>
            </motion.div>
          ) : (
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-base-content/30">
              <Shield size={36} strokeWidth={1} />
              <p className="text-sm font-semibold">No active version</p>
            </div>
          )}
        </div>
      </div>

      <DocFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditDoc(null); }}
        onSubmit={editDoc ? handleEdit : handleCreate}
        type="privacy"
        initial={editDoc}
        submitting={submitting}
      />

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.type === 'publish' ? handlePublish : handleDelete}
        loading={submitting}
        variant={confirm?.type === 'delete' ? 'danger' : 'primary'}
        title={confirm?.type === 'publish' ? 'Publish Policy?' : 'Delete Draft?'}
        message={confirm?.type === 'publish'
          ? 'This will deactivate the current live privacy policy and publish this draft.'
          : 'This will permanently delete this draft version.'}
      />
    </>
  );
};

// ════════════════════════════════════════════════════════════════
// CONSENT TAB
// ════════════════════════════════════════════════════════════════

const ConsentTab = () => {
  const dispatch = useDispatch();
  const consents = useSelector(selectAllUserConsents);
  const pagination = useSelector(selectConsentPagination);
  const loading = useSelector(selectConsentLoading);

  const [filters, setFilters] = useState({ userId: '', platform: '', method: '', page: 1 });
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback((f = filters) => {
    dispatch(fetchAllUserConsents({ ...f }));
  }, [dispatch, filters]);

  useEffect(() => { load(); }, []);

  const applyFilters = () => {
    const f = { ...filters, userId: searchInput, page: 1 };
    setFilters(f);
    dispatch(fetchAllUserConsents(f));
  };

  const clearFilters = () => {
    const f = { userId: '', platform: '', method: '', page: 1 };
    setSearchInput('');
    setFilters(f);
    dispatch(fetchAllUserConsents(f));
  };

  return (
    <div>
      <SectionHeader
        icon={UserCheck}
        title="User Consent Records"
        subtitle="GDPR-compliant immutable audit log"
        action={
          <button onClick={() => load()} className="p-2 rounded-xl border border-base-300 hover:border-primary hover:text-primary transition-all" title="Refresh">
            <RefreshCw size={14} />
          </button>
        }
      />

      {/* Filters */}
      <div className="glass-card p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input
              className="input-field w-full pl-8 text-xs"
              placeholder="Search by User ID…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <select
            className="input-field text-xs"
            value={filters.platform}
            onChange={e => setFilters(f => ({ ...f, platform: e.target.value }))}
          >
            <option value="">All Platforms</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className="input-field text-xs"
            value={filters.method}
            onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}
          >
            <option value="">All Methods</option>
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={applyFilters} className="btn-primary-cta flex-1 flex items-center justify-center gap-1.5 py-2 text-xs">
              <Filter size={12} /> Filter
            </button>
            <button onClick={clearFilters} className="px-3 py-2 rounded-xl border border-base-300 hover:border-error hover:text-error transition-all">
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : consents.length === 0 ? (
        <EmptyState icon={Database} title="No consent records found" sub="Records appear here as users accept legal documents" />
      ) : (
        <>
          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-base-300 bg-base-200/50">
                    {['User', 'Role', 'Terms Ver.', 'Privacy Ver.', 'Method', 'Platform', 'Accepted At', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-bold text-base-content/50 uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consents.map((c, i) => (
                    <motion.tr
                      key={c._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                      className="border-b border-base-300/50 hover:bg-base-200/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-xs">{c.user?.name || 'Unknown'}</p>
                          <p className="text-base-content/40 text-[10px]">{c.user?.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.userRole && <Pill>{c.userRole}</Pill>}
                      </td>
                      <td className="px-4 py-3 font-mono text-base-content/70">{c.termsVersionNumber || '—'}</td>
                      <td className="px-4 py-3 font-mono text-base-content/70">{c.privacyPolicyVersionNumber || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-base-200 text-base-content/60 text-[10px] font-mono">{c.method}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[10px] ${c.platform === 'web' ? 'badge-info' : c.platform === 'ios' ? 'badge-primary' : 'badge-success'}`}>
                          {c.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-base-content/50 whitespace-nowrap">{formatDateTime(c.acceptedAt)}</td>
                      <td className="px-4 py-3">
                        {c.isWithdrawn
                          ? <span className="badge badge-error text-[10px]"><UserX size={9} />Withdrawn</span>
                          : <span className="badge badge-success text-[10px]"><UserCheck size={9} />Active</span>
                        }
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination pagination={pagination} onPageChange={(p) => { setFilters(f => ({ ...f, page: p })); dispatch(fetchAllUserConsents({ ...filters, page: p })); }} />
        </>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// STATS BAR
// ════════════════════════════════════════════════════════════════

const StatsBar = () => {
  const activeTerms = useSelector(selectActiveTerms);
  const activePrivacy = useSelector(selectActivePrivacy);
  const termsPagination = useSelector(selectTermsPagination);
  const privacyPagination = useSelector(selectPrivacyPagination);
  const consentPagination = useSelector(selectConsentPagination);

  const stats = [
    { label: 'Terms Versions', value: termsPagination.total || 0, icon: FileText, color: 'primary' },
    { label: 'Privacy Versions', value: privacyPagination.total || 0, icon: Shield, color: 'secondary' },
    { label: 'Consent Records', value: consentPagination.total || 0, icon: Users, color: 'success' },
    { label: 'Active Terms', value: activeTerms?.version ? `v${activeTerms.version}` : 'None', icon: CheckCircle2, color: activeTerms ? 'success' : 'error' },
    { label: 'Active Privacy', value: activePrivacy?.version ? `v${activePrivacy.version}` : 'None', icon: Lock, color: activePrivacy ? 'success' : 'error' },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8"
    >
      {stats.map(({ label, value, icon: Icon, color }) => (
        <motion.div key={label} variants={cardVariants} className="glass-card p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider leading-tight">{label}</p>
            <div className={`p-1.5 rounded-lg bg-${color}/10`}>
              <Icon size={13} className={`text-${color}`} />
            </div>
          </div>
          <p className="font-black text-xl tracking-tight">{value}</p>
        </motion.div>
      ))}
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function LegalManagement() {
  const [activeTab, setActiveTab] = useState('terms');

  const tabs = [
    { id: 'terms', label: 'Terms & Conditions', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'consent', label: 'User Consents', icon: Users },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-base-100"
    >
      {/* Page Header */}
      <div className="border-b border-base-300 bg-base-100/80 backdrop-blur-md sticky top-0 z-30">
        <div className="container-custom py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Animated icon */}
              <motion.div
                className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-primary"
                whileHover={{ scale: 1.08, rotate: 4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <BookOpen size={20} className="text-primary-content" />
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-primary/30 blur-md -z-10"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
              <div>
                <h1 className="font-black text-xl tracking-tight text-base-content">Legal Management</h1>
                <p className="text-xs text-base-content/50 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
                  Superadmin Console · GDPR & Compliance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-error/10 border border-error/20"
              >
                <Activity size={12} className="text-error" />
                <span className="text-[10px] font-bold text-error uppercase tracking-wider">Live</span>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-custom py-6">
        {/* Stats */}
        <StatsBar />

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-1 bg-base-200 p-1 rounded-2xl w-fit">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === id
                    ? 'bg-base-100 text-base-content shadow-sm'
                    : 'text-base-content/50 hover:text-base-content/80'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
                {activeTab === id && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-xl bg-base-100 -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'terms' && <TermsTab />}
            {activeTab === 'privacy' && <PrivacyTab />}
            {activeTab === 'consent' && <ConsentTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}