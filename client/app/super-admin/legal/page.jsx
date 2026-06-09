'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Shield, RefreshCw, Cookie, AlertCircle,
  Plus, Eye, Pencil, Trash2, Upload, Archive,
  CheckCircle2, Clock, Send, ChevronRight, Users,
  BarChart2, History, ShieldCheck, ChevronDown,
  ChevronUp, X, Save, Loader2, Search, Filter,
  ExternalLink, Hash, Globe, Smartphone, Download,
  AlertTriangle, Info, CheckCheck, RotateCcw,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Redux ──────────────────────────────────────────────────────────────────────
import {
  fetchAdminDocs,
  fetchAdminDocById,
  fetchVersionHistory,
  fetchDocConsents,
  fetchAllConsents,
  createLegalDoc,
  updateLegalDoc,
  submitDocForReview,
  approveDoc,
  publishDoc,
  createNewVersion,
  archiveDoc,
  deleteLegalDoc,
  verifyChecksum,
  clearSelectedDoc,
  clearDocConsents,
  patchAdminDoc,
  selectAdminDocs,
  selectAdminDocsLoading,
  selectAdminPagination,
  selectSelectedDoc,
  selectSelectedDocLoading,
  selectVersionHistory,
  selectDocConsents,
  selectDocConsentsPagination,
  selectAllConsents,
  selectChecksumResult,
  selectChecksumLoading,
  selectIsCreating,
  selectIsUpdating,
  selectIsSubmitting,
  selectIsApproving,
  selectIsPublishing,
  selectIsArchiving,
  selectIsDeleting,
} from '@/store/slices/legalSlice';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DOC_TYPE_META = {
  terms_and_conditions: { label: 'Terms & Conditions', icon: FileText,    color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/30'  },
  privacy_policy:       { label: 'Privacy Policy',      icon: Shield,      color: 'text-info',      bg: 'bg-info/10',      border: 'border-info/30'     },
  refund_policy:        { label: 'Refund Policy',        icon: RefreshCw,   color: 'text-success',   bg: 'bg-success/10',   border: 'border-success/30'  },
  cookie_policy:        { label: 'Cookie Policy',        icon: Cookie,      color: 'text-warning',   bg: 'bg-warning/10',   border: 'border-warning/30'  },
  disclaimer:           { label: 'Disclaimer',           icon: AlertCircle, color: 'text-error',     bg: 'bg-error/10',     border: 'border-error/30'    },
};

const STATUS_META = {
  draft:      { label: 'Draft',      color: 'text-base-content/50', bg: 'bg-base-300/60',  border: 'border-base-300', step: 0 },
  review:     { label: 'In Review',  color: 'text-warning',         bg: 'bg-warning/10',   border: 'border-warning/30', step: 1 },
  approved:   { label: 'Approved',   color: 'text-info',            bg: 'bg-info/10',      border: 'border-info/30',  step: 2 },
  active:     { label: 'Live',       color: 'text-success',         bg: 'bg-success/10',   border: 'border-success/30', step: 3 },
  superseded: { label: 'Superseded', color: 'text-base-content/40', bg: 'bg-base-200',     border: 'border-base-300', step: -1 },
  archived:   { label: 'Archived',   color: 'text-base-content/40', bg: 'bg-base-200',     border: 'border-base-300', step: -1 },
};

const PIPELINE_STEPS = [
  { key: 'draft',    label: 'Draft',    icon: Pencil },
  { key: 'review',   label: 'Review',   icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'active',   label: 'Live',     icon: Globe },
];

const TABS = [
  { id: 'documents', label: 'Documents',  icon: FileText },
  { id: 'consents',  label: 'Consents',   icon: Users },
  { id: 'analytics', label: 'Analytics',  icon: BarChart2 },
];

const AUDIENCE_OPTIONS = [
  'all','customer','doctor','hospital','driver',
  'solodriverpartner','transportpartner','pharmacy',
  'care_assistant','lab_partner','blood_bank',
];

const PLATFORM_OPTIONS = ['all','web','android','ios'];

const COMPLIANCE_OPTIONS = ['DPDP','IT_ACT_2000','HIPAA_LIKE','ISO27001','GDPR'];

const NOTIFICATION_CHANNELS = ['sms','email','push','whatsapp'];

const PIE_COLORS = ['#22c55e','#ef4444','#f59e0b','#3b82f6'];

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span className={`badge badge-sm ${m.bg} ${m.color} border ${m.border}`}>
      {m.label}
    </span>
  );
};

const DocTypeBadge = ({ type }) => {
  const m = DOC_TYPE_META[type];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <span className={`badge badge-sm ${m.bg} ${m.color} border ${m.border} gap-1`}>
      <Icon size={10} />
      {m.label}
    </span>
  );
};

const Note = ({ children }) => (
  <p className="text-xs text-base-content/50 mt-0.5 leading-relaxed">{children}</p>
);

const FieldLabel = ({ children, required }) => (
  <label className="label-text mb-0.5 block">
    {children}{required && <span className="text-error ml-0.5">*</span>}
  </label>
);

const SectionDivider = ({ label }) => (
  <div className="flex items-center gap-3 my-6">
    <div className="divider flex-1 my-0" />
    <span className="text-xs font-bold uppercase tracking-widest text-base-content/40">{label}</span>
    <div className="divider flex-1 my-0" />
  </div>
);

// Pipeline stepper — signature element
const PipelineStepper = ({ status }) => {
  const currentStep = STATUS_META[status]?.step ?? 0;
  return (
    <div className="flex items-center gap-0 w-full">
      {PIPELINE_STEPS.map((step, i) => {
        const Icon = step.icon;
        const done    = currentStep > i;
        const current = currentStep === i;
        const last    = i === PIPELINE_STEPS.length - 1;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${done    ? 'bg-success border-success text-success-content'    : ''}
                ${current ? 'bg-primary border-primary text-primary-content ring-4 ring-primary/20' : ''}
                ${!done && !current ? 'bg-base-200 border-base-300 text-base-content/30' : ''}
              `}>
                <Icon size={14} />
              </div>
              <span className={`text-xs font-semibold whitespace-nowrap
                ${current ? 'text-primary' : done ? 'text-success' : 'text-base-content/30'}
              `}>
                {step.label}
              </span>
            </div>
            {!last && (
              <div className={`flex-1 h-0.5 mb-5 mx-1 transition-all duration-500
                ${done ? 'bg-success' : 'bg-base-300'}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function LegalManagement() {
  const dispatch = useDispatch();

  // ── Redux state ──────────────────────────────────────────────────────────────
  const adminDocs        = useSelector(selectAdminDocs);
  const docsLoading      = useSelector(selectAdminDocsLoading);
  const pagination       = useSelector(selectAdminPagination);
  const selectedDoc      = useSelector(selectSelectedDoc);
  const selectedLoading  = useSelector(selectSelectedDocLoading);
  const versionHistory   = useSelector(selectVersionHistory);
  const docConsents      = useSelector(selectDocConsents);
  const consentPages     = useSelector(selectDocConsentsPagination);
  const allConsents      = useSelector(selectAllConsents);
  const checksumResult   = useSelector(selectChecksumResult);
  const checksumLoading  = useSelector(selectChecksumLoading);
  const isCreating       = useSelector(selectIsCreating);

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('documents');
  const [panel,        setPanel]        = useState(null);  // null | 'create' | 'edit' | 'view' | 'consents' | 'history'
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [newVersionId, setNewVersionId] = useState(null);
  const [newVersionNum,setNewVersionNum]= useState('');
  const [publishModal, setPublishModal] = useState(null);   // docId | null
  const [deleteModal,  setDeleteModal]  = useState(null);   // docId | null
  const [changeSummary,setChangeSummary]= useState('');

  // ── Form state ───────────────────────────────────────────────────────────────
  const EMPTY_FORM = {
    documentType: 'terms_and_conditions',
    title: '', subtitle: '', slug: '',
    currentVersion: '1.0', effectiveDate: '',
    summary: '', keyPoints: '',
    fullText: '', fullHtml: '',
    platform: 'all', audienceType: 'all',
    complianceStandards: [],
    governingLaw: 'India', jurisdiction: 'Andhra Pradesh, India',
    minAge: 18, requiresParentalConsent: false,
    disputeResolution: 'Arbitration, Andhra Pradesh courts',
    requiresExplicitConsent: true, consentMethod: 'checkbox',
    notifyUsersOnUpdate: true, notificationChannels: [],
    showInFooter: true, showInOnboarding: false,
    displayOrder: 0,
    dataRetention: '',
    legalReviewedBy: '', legalReviewedAt: '',
    metaTitle: '', metaDescription: '', pdfUrl: '',
    // Privacy specifics
    dataCollected: { personalData: '', sensitiveData: '', financialData: '', locationData: false, deviceData: false, biometricData: false, cookies: true },
    dataSharing: { thirdParties: '', crossBorderTransfer: false, soldToThirdParties: false },
    userRights: '',
    dataPurpose: '',
    // Refund specifics
    refundRules: { fullRefundWindowHours: 24, partialRefundPercent: 50, noRefundOnceDriverStarts: true, doubleChargeFullRefund: true, processingDaysMin: 5, processingDaysMax: 12, refundMethods: '' },
    // DPO
    dpoName: '', dpoEmail: '', dpoPhone: '',
  };

  const [form, setForm] = useState(EMPTY_FORM);

  // ── Load docs ────────────────────────────────────────────────────────────────
  const loadDocs = useCallback(() => {
    dispatch(fetchAdminDocs({ type: filterType || undefined, status: filterStatus || undefined, page, limit: 10 }));
  }, [dispatch, filterType, filterStatus, page]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setPanel('create');
  };

  const openEdit = (doc) => {
    setForm({
      ...EMPTY_FORM,
      documentType: doc.documentType,
      title: doc.title ?? '',
      subtitle: doc.subtitle ?? '',
      slug: doc.slug ?? '',
      currentVersion: doc.currentVersion ?? '1.0',
      effectiveDate: doc.effectiveDate ? doc.effectiveDate.slice(0,10) : '',
      summary: doc.summary ?? '',
      keyPoints: (doc.keyPoints ?? []).join('\n'),
      fullText: doc.fullText ?? '',
      fullHtml: doc.fullHtml ?? '',
      platform: doc.platform ?? 'all',
      audienceType: doc.audienceType ?? 'all',
      complianceStandards: doc.complianceStandards ?? [],
      governingLaw: doc.governingLaw ?? 'India',
      jurisdiction: doc.jurisdiction ?? 'Andhra Pradesh, India',
      minAge: doc.minAge ?? 18,
      requiresParentalConsent: doc.requiresParentalConsent ?? false,
      disputeResolution: doc.disputeResolution ?? '',
      requiresExplicitConsent: doc.requiresExplicitConsent ?? true,
      consentMethod: doc.consentMethod ?? 'checkbox',
      notifyUsersOnUpdate: doc.notifyUsersOnUpdate ?? true,
      notificationChannels: doc.notificationChannels ?? [],
      showInFooter: doc.showInFooter ?? true,
      showInOnboarding: doc.showInOnboarding ?? false,
      displayOrder: doc.displayOrder ?? 0,
      dataRetention: doc.dataRetention ?? '',
      legalReviewedBy: doc.legalReviewedBy ?? '',
      legalReviewedAt: doc.legalReviewedAt ? doc.legalReviewedAt.slice(0,10) : '',
      metaTitle: doc.metaTitle ?? '',
      metaDescription: doc.metaDescription ?? '',
      pdfUrl: doc.pdfUrl ?? '',
      dataCollected: {
        personalData: (doc.dataCollected?.personalData ?? []).join(', '),
        sensitiveData: (doc.dataCollected?.sensitiveData ?? []).join(', '),
        financialData: (doc.dataCollected?.financialData ?? []).join(', '),
        locationData: doc.dataCollected?.locationData ?? false,
        deviceData: doc.dataCollected?.deviceData ?? false,
        biometricData: doc.dataCollected?.biometricData ?? false,
        cookies: doc.dataCollected?.cookies ?? true,
      },
      dataSharing: {
        thirdParties: (doc.dataSharing?.thirdParties ?? []).join(', '),
        crossBorderTransfer: doc.dataSharing?.crossBorderTransfer ?? false,
        soldToThirdParties: doc.dataSharing?.soldToThirdParties ?? false,
      },
      userRights: (doc.userRights ?? []).join(', '),
      dataPurpose: (doc.dataPurpose ?? []).join(', '),
      refundRules: {
        fullRefundWindowHours: doc.refundRules?.fullRefundWindowHours ?? 24,
        partialRefundPercent: doc.refundRules?.partialRefundPercent ?? 50,
        noRefundOnceDriverStarts: doc.refundRules?.noRefundOnceDriverStarts ?? true,
        doubleChargeFullRefund: doc.refundRules?.doubleChargeFullRefund ?? true,
        processingDaysMin: doc.refundRules?.processingDaysMin ?? 5,
        processingDaysMax: doc.refundRules?.processingDaysMax ?? 12,
        refundMethods: (doc.refundRules?.refundMethods ?? []).join(', '),
      },
      dpoName: doc.dataProtectionOfficer?.name ?? '',
      dpoEmail: doc.dataProtectionOfficer?.email ?? '',
      dpoPhone: doc.dataProtectionOfficer?.phone ?? '',
    });
    setPanel('edit');
  };

  const openView = async (id) => {
    await dispatch(fetchAdminDocById(id));
    setPanel('view');
  };

  const openConsents = (id) => {
    dispatch(fetchDocConsents({ id, page: 1, limit: 20 }));
    setPanel('consents');
  };

  const openHistory = async (id) => {
    await dispatch(fetchAdminDocById(id));
    dispatch(fetchVersionHistory(id));
    setPanel('history');
  };

  const closePanel = () => {
    setPanel(null);
    dispatch(clearSelectedDoc());
    dispatch(clearDocConsents());
  };

  const buildPayload = () => ({
    ...form,
    keyPoints: form.keyPoints.split('\n').map(s => s.trim()).filter(Boolean),
    dataCollected: {
      personalData:  form.dataCollected.personalData.split(',').map(s=>s.trim()).filter(Boolean),
      sensitiveData: form.dataCollected.sensitiveData.split(',').map(s=>s.trim()).filter(Boolean),
      financialData: form.dataCollected.financialData.split(',').map(s=>s.trim()).filter(Boolean),
      locationData:  form.dataCollected.locationData,
      deviceData:    form.dataCollected.deviceData,
      biometricData: form.dataCollected.biometricData,
      cookies:       form.dataCollected.cookies,
    },
    dataSharing: {
      thirdParties: form.dataSharing.thirdParties.split(',').map(s=>s.trim()).filter(Boolean),
      crossBorderTransfer: form.dataSharing.crossBorderTransfer,
      soldToThirdParties: form.dataSharing.soldToThirdParties,
    },
    userRights:  form.userRights.split(',').map(s=>s.trim()).filter(Boolean),
    dataPurpose: form.dataPurpose.split(',').map(s=>s.trim()).filter(Boolean),
    refundRules: {
      ...form.refundRules,
      refundMethods: form.refundRules.refundMethods.split(',').map(s=>s.trim()).filter(Boolean),
    },
    dataProtectionOfficer: { name: form.dpoName, email: form.dpoEmail, phone: form.dpoPhone },
    effectiveDate: form.effectiveDate || undefined,
    legalReviewedAt: form.legalReviewedAt || undefined,
  });

  const handleCreate = async () => {
    const res = await dispatch(createLegalDoc(buildPayload()));
    if (!res.error) closePanel();
  };

  const handleUpdate = async (id) => {
    const res = await dispatch(updateLegalDoc({ id, ...buildPayload() }));
    if (!res.error) closePanel();
  };

  const handleSubmitReview = (id) => dispatch(submitDocForReview(id));
  const handleApprove      = (id) => dispatch(approveDoc(id));

  const handlePublish = async () => {
    if (!publishModal) return;
    const res = await dispatch(publishDoc({ id: publishModal, changeSummary: changeSummary || 'Published' }));
    if (!res.error) { setPublishModal(null); setChangeSummary(''); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    const res = await dispatch(deleteLegalDoc(deleteModal));
    if (!res.error) setDeleteModal(null);
  };

  const handleArchive   = (id) => dispatch(archiveDoc(id));
  const handleChecksum  = (id) => dispatch(verifyChecksum(id));

  const handleNewVersion = async (id) => {
    if (!newVersionNum) return;
    await dispatch(createNewVersion({ id, newVersion: newVersionNum }));
    setNewVersionId(null);
    setNewVersionNum('');
  };

  const toggleComplianceStd = (std) => {
    setForm(f => ({
      ...f,
      complianceStandards: f.complianceStandards.includes(std)
        ? f.complianceStandards.filter(s => s !== std)
        : [...f.complianceStandards, std],
    }));
  };

  const toggleChannel = (ch) => {
    setForm(f => ({
      ...f,
      notificationChannels: f.notificationChannels.includes(ch)
        ? f.notificationChannels.filter(c => c !== ch)
        : [...f.notificationChannels, ch],
    }));
  };

  // Filtered docs (client-side search)
  const filteredDocs = adminDocs.filter(d =>
    !search || d.title?.toLowerCase().includes(search.toLowerCase()) || d.slug?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Analytics mock data from allConsents ─────────────────────────────────────
  const consentByType = TABS[2] && allConsents.reduce((acc, row) => {
    const t = row.documentType ?? 'unknown';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(consentByType ?? {}).map(([name, value]) => ({ name, value }));

  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString('en-IN', { weekday:'short' }), consents: Math.floor(Math.random()*40+10) };
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-base-100">

      {/* ── Page Header ── */}
      <div className="border-b border-base-300 bg-base-100 sticky top-0 z-30">
        <div className="container-custom py-4 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-display text-base-content">Legal Management</h4>
            <p className="text-xs text-base-content/50 mt-0.5">
              Manage Terms, Privacy Policy, Refund Rules — version-controlled with consent tracking
            </p>
          </div>
          <button onClick={openCreate} className="btn btn-primary btn-sm gap-2">
            <Plus size={15} /> New Document
          </button>
        </div>

        {/* Tabs */}
        <div className="container-custom">
          <div className="flex gap-1 border-b border-base-300 -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-200
                    ${activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-base-content/50 hover:text-base-content hover:border-base-300'}
                  `}
                >
                  <Icon size={15} />{tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="container-custom py-6">
        <AnimatePresence mode="wait">

          {/* ══════════════════════ DOCUMENTS TAB ══════════════════════ */}
          {activeTab === 'documents' && (
            <motion.div key="documents"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
            >
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by title or slug…"
                    className="input-field pl-9 h-9"
                  />
                </div>
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
                  className="input-field h-9 w-auto min-w-40">
                  <option value="">All types</option>
                  {Object.entries(DOC_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                  className="input-field h-9 w-auto min-w-36">
                  <option value="">All statuses</option>
                  {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
                <button onClick={loadDocs} className="btn btn-ghost btn-sm gap-1.5">
                  <Filter size={13} /> Refresh
                </button>
              </div>

              {/* Table */}
              {docsLoading ? (
                <div className="flex justify-center items-center py-20">
                  <span className="loading loading-md" />
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="card p-12 text-center">
                  <FileText size={36} className="mx-auto text-base-content/20 mb-3" />
                  <p className="text-base-content/40 text-sm">No documents found. Create your first legal document.</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>Type</th>
                          <th>Version</th>
                          <th>Status</th>
                          <th>Effective</th>
                          <th>Consents</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {filteredDocs.map((doc, i) => (
                            <DocumentRow
                              key={doc._id}
                              doc={doc}
                              index={i}
                              openView={openView}
                              openEdit={openEdit}
                              handleSubmitReview={handleSubmitReview}
                              handleApprove={handleApprove}
                              setPublishModal={setPublishModal}
                              setNewVersionId={setNewVersionId}
                              handleArchive={handleArchive}
                              openConsents={openConsents}
                              openHistory={openHistory}
                              handleChecksum={handleChecksum}
                              checksumLoading={checksumLoading}
                              setDeleteModal={setDeleteModal}
                            />
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
                      <span className="text-xs text-base-content/50">
                        {pagination.total} total · Page {pagination.page} of {pagination.pages}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                          className="btn btn-ghost btn-xs">Prev</button>
                        <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                          className="btn btn-ghost btn-xs">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Checksum result inline alert */}
              <AnimatePresence>
                {checksumResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`alert mt-4 ${checksumResult.intact ? 'alert-success' : 'alert-error'}`}
                  >
                    {checksumResult.intact ? <CheckCheck size={16} /> : <AlertTriangle size={16} />}
                    <span className="text-sm">{checksumResult.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ══════════════════════ CONSENTS TAB ══════════════════════ */}
          {activeTab === 'consents' && (
            <motion.div key="consents"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h5>All Consent Records</h5>
                <button onClick={() => dispatch(fetchAllConsents({ page: 1 }))} className="btn btn-ghost btn-sm gap-1.5">
                  <RefreshCw size={13} /> Load
                </button>
              </div>
              {allConsents.length === 0 ? (
                <div className="card p-12 text-center">
                  <Users size={36} className="mx-auto text-base-content/20 mb-3" />
                  <p className="text-base-content/40 text-sm">No consent records loaded. Click Load above.</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>User</th><th>Role</th><th>Document</th>
                          <th>Version</th><th>Method</th><th>Platform</th>
                          <th>Date</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allConsents.map((row, i) => (
                          <motion.tr key={i}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                          >
                            <td>
                              <div className="text-sm font-semibold">{row.consent?.user?.name ?? '—'}</div>
                              <div className="text-xs text-base-content/40">{row.consent?.user?.email ?? '—'}</div>
                            </td>
                            <td><span className="role-badge text-xs">{row.consent?.user?.role ?? '—'}</span></td>
                            <td><DocTypeBadge type={row.documentType} /></td>
                            <td><span className="badge badge-sm bg-base-200 text-base-content/60 border border-base-300">v{row.consent?.version}</span></td>
                            <td className="text-xs text-base-content/60 capitalize">{row.consent?.method ?? '—'}</td>
                            <td className="text-xs text-base-content/60 capitalize">{row.consent?.platform ?? '—'}</td>
                            <td className="text-xs text-base-content/60">{fmt(row.consent?.consentedAt)}</td>
                            <td>
                              {row.consent?.isWithdrawn
                                ? <span className="badge badge-sm bg-error/10 text-error border border-error/30">Withdrawn</span>
                                : <span className="badge badge-sm bg-success/10 text-success border border-success/30">Active</span>
                              }
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════ ANALYTICS TAB ══════════════════════ */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
              className="space-y-6"
            >
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Documents', value: pagination.total, icon: FileText, color: 'text-primary' },
                  { label: 'Active / Live',   value: adminDocs.filter(d=>d.status==='active').length, icon: Globe, color: 'text-success' },
                  { label: 'In Review',       value: adminDocs.filter(d=>d.status==='review').length, icon: Clock, color: 'text-warning' },
                  { label: 'Total Consents',  value: adminDocs.reduce((s,d)=>s+(d.totalConsents??0),0), icon: CheckCheck, color: 'text-info' },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <motion.div key={s.label} whileHover={{ y: -2 }} className="stat-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="stat-card-label">{s.label}</span>
                        <Icon size={16} className={s.color} />
                      </div>
                      <div className={`stat-card-value ${s.color}`}>{s.value}</div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Consent trend area chart */}
                <div className="card p-5">
                  <h6 className="mb-4">Consent Trend (7 days)</h6>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: 'var(--base-content)' }}
                      />
                      <Area type="monotone" dataKey="consents" stroke="var(--primary)" fill="url(#gradC)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Consent by type pie */}
                <div className="card p-5">
                  <h6 className="mb-4">Consents by Document Type</h6>
                  {pieData.length === 0 ? (
                    <div className="flex items-center justify-center h-52 text-base-content/30 text-sm">
                      Load consents data first
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                          dataKey="value" paddingAngle={3}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Status breakdown */}
              <div className="card p-5">
                <h6 className="mb-4">Document Status Distribution</h6>
                <div className="space-y-3">
                  {Object.entries(STATUS_META).filter(([k]) => !['superseded','archived'].includes(k)).map(([status, meta]) => {
                    const count = adminDocs.filter(d => d.status === status).length;
                    const pct   = pagination.total ? Math.round((count / pagination.total) * 100) : 0;
                    return (
                      <div key={status} className="flex items-center gap-4">
                        <span className={`text-xs font-bold w-20 shrink-0 ${meta.color}`}>{meta.label}</span>
                        <div className="progress-bar flex-1">
                          <motion.div className="progress-bar-fill" initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.2 }} />
                        </div>
                        <span className="text-xs text-base-content/50 w-10 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SLIDE-OVER PANEL
      ══════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {panel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-neutral/60 backdrop-blur-soft z-40"
            />

            {/* Panel */}
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-base-100 shadow-depth-lg z-50 flex flex-col"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 shrink-0">
                <h5 className="text-base-content">
                  {panel === 'create'   && 'Create Legal Document'}
                  {panel === 'edit'     && 'Edit Draft'}
                  {panel === 'view'     && 'Document Details'}
                  {panel === 'consents' && 'Consent Records'}
                  {panel === 'history'  && 'Version History'}
                </h5>
                <button onClick={closePanel} className="btn btn-ghost btn-sm btn-circle">
                  <X size={16} />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* ── CREATE / EDIT FORM ── */}
                {(panel === 'create' || panel === 'edit') && (
                  <DocForm
                    form={form} setForm={setForm}
                    toggleComplianceStd={toggleComplianceStd}
                    toggleChannel={toggleChannel}
                  />
                )}

                {/* ── VIEW PANEL ── */}
                {panel === 'view' && (
                  <ViewPanel doc={selectedDoc} loading={selectedLoading} />
                )}

                {/* ── CONSENTS PANEL ── */}
                {panel === 'consents' && (
                  <ConsentsPanel consents={docConsents} pages={consentPages} />
                )}

                {/* ── HISTORY PANEL ── */}
                {panel === 'history' && (
                  <HistoryPanel doc={selectedDoc} history={versionHistory} loading={selectedLoading} />
                )}
              </div>

              {/* Panel footer */}
              {(panel === 'create' || panel === 'edit') && (
                <div className="px-6 py-4 border-t border-base-300 shrink-0 flex items-center justify-end gap-3">
                  <button onClick={closePanel} className="btn btn-ghost btn-sm">Cancel</button>
                  {panel === 'create' ? (
                    <button onClick={handleCreate} disabled={isCreating} className="btn btn-primary btn-sm gap-2">
                      {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save Draft
                    </button>
                  ) : (
                    <button onClick={() => handleUpdate(selectedDoc?._id ?? form._id)}
                      className="btn btn-primary btn-sm gap-2">
                      <Save size={14} /> Update Draft
                    </button>
                  )}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Publish Confirm Modal ── */}
      <AnimatePresence>
        {publishModal && (
          <Modal onClose={() => setPublishModal(null)} title="Publish Document">
            <div className="alert alert-warning mb-4">
              <AlertTriangle size={16} />
              <span className="text-sm">Publishing will immediately make this document live and supersede the current active version.</span>
            </div>
            <div>
              <FieldLabel>Change Summary</FieldLabel>
              <input value={changeSummary} onChange={e => setChangeSummary(e.target.value)}
                placeholder="e.g. Added DPDP 2023 data rights clause"
                className="input-field" />
              <Note>Shown in version history for audit trail.</Note>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setPublishModal(null)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handlePublish} className="btn btn-success btn-sm gap-2">
                <Globe size={13} /> Publish Live
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm Modal ── */}
      <AnimatePresence>
        {deleteModal && (
          <Modal onClose={() => setDeleteModal(null)} title="Delete Draft">
            <div className="alert alert-error mb-4">
              <AlertTriangle size={16} />
              <span className="text-sm">This will permanently soft-delete the draft. Only drafts can be deleted.</span>
            </div>
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setDeleteModal(null)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handleDelete} className="btn btn-error btn-sm gap-2">
                <Trash2 size={13} /> Delete Draft
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── New Version Modal ── */}
      <AnimatePresence>
        {newVersionId && (
          <Modal onClose={() => { setNewVersionId(null); setNewVersionNum(''); }} title="Create New Version">
            <div>
              <FieldLabel required>New Version Number</FieldLabel>
              <input value={newVersionNum} onChange={e => setNewVersionNum(e.target.value)}
                placeholder="e.g. 2.0" className="input-field" />
              <Note>Clones the active document as a new draft with this version number.</Note>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => { setNewVersionId(null); setNewVersionNum(''); }} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={() => handleNewVersion(newVersionId)} disabled={!newVersionNum} className="btn btn-primary btn-sm gap-2">
                <RotateCcw size={13} /> Create Draft
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT ROW COMPONENT (Extracted to fix Hook Rules)
// ═══════════════════════════════════════════════════════════════════════════════
function DocumentRow({
  doc, index, openView, openEdit, handleSubmitReview, handleApprove, setPublishModal,
  setNewVersionId, handleArchive, openConsents, openHistory, handleChecksum,
  checksumLoading, setDeleteModal
}) {
  const isUpdating   = useSelector(selectIsUpdating(doc._id));
  const isSubmitting = useSelector(selectIsSubmitting(doc._id));
  const isApproving  = useSelector(selectIsApproving(doc._id));
  const isPublishing = useSelector(selectIsPublishing(doc._id));
  const isArchiving  = useSelector(selectIsArchiving(doc._id));
  const isDeleting   = useSelector(selectIsDeleting(doc._id));
  const anyLoading   = isUpdating || isSubmitting || isApproving || isPublishing || isArchiving || isDeleting;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={anyLoading ? 'opacity-60 pointer-events-none' : ''}
    >
      <td>
        <div className="font-semibold text-sm text-base-content truncate max-w-48">
          {doc.title}
        </div>
        <div className="text-xs text-base-content/40 mt-0.5">/{doc.slug}</div>
      </td>
      <td><DocTypeBadge type={doc.documentType} /></td>
      <td>
        <span className="badge badge-sm bg-base-200 text-base-content/60 border border-base-300">
          v{doc.currentVersion}
        </span>
      </td>
      <td><StatusBadge status={doc.status} /></td>
      <td className="text-xs text-base-content/60">{fmt(doc.effectiveDate)}</td>
      <td>
        <span className="text-sm font-semibold text-primary">{doc.totalConsents ?? 0}</span>
      </td>
      <td>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => openView(doc._id)} className="btn btn-ghost btn-xs" title="View">
            <Eye size={13} />
          </button>
          {doc.status === 'draft' && (
            <button onClick={() => openEdit(doc)} className="btn btn-ghost btn-xs" title="Edit">
              <Pencil size={13} />
            </button>
          )}
          {doc.status === 'draft' && (
            <button onClick={() => handleSubmitReview(doc._id)} className="btn btn-ghost btn-xs text-warning" title="Submit for review">
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          )}
          {doc.status === 'review' && (
            <button onClick={() => handleApprove(doc._id)} className="btn btn-ghost btn-xs text-info" title="Approve">
              {isApproving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            </button>
          )}
          {(doc.status === 'approved' || doc.status === 'draft') && (
            <button onClick={() => setPublishModal(doc._id)} className="btn btn-ghost btn-xs text-success" title="Publish">
              <Globe size={13} />
            </button>
          )}
          {doc.status === 'active' && (
            <>
              <button onClick={() => setNewVersionId(doc._id)} className="btn btn-ghost btn-xs text-primary" title="New version">
                <RotateCcw size={13} />
              </button>
              <button onClick={() => handleArchive(doc._id)} className="btn btn-ghost btn-xs text-base-content/40" title="Archive">
                {isArchiving ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
              </button>
            </>
          )}
          <button onClick={() => openConsents(doc._id)} className="btn btn-ghost btn-xs" title="Consents">
            <Users size={13} />
          </button>
          <button onClick={() => openHistory(doc._id)} className="btn btn-ghost btn-xs" title="History">
            <History size={13} />
          </button>
          <button onClick={() => handleChecksum(doc._id)} className="btn btn-ghost btn-xs" title="Verify integrity">
            {checksumLoading ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
          </button>
          {doc.status === 'draft' && (
            <button onClick={() => setDeleteModal(doc._id)} className="btn btn-ghost btn-xs text-error" title="Delete draft">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// DOC FORM — extracted for readability
// ═══════════════════════════════════════════════════════════════════════════════

function DocForm({ form, setForm, toggleComplianceStd, toggleChannel }) {
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setNested = (key, sub, val) => setForm(f => ({ ...f, [key]: { ...f[key], [sub]: val } }));
  const isPrivacy = form.documentType === 'privacy_policy';
  const isRefund  = form.documentType === 'refund_policy';
  const isTerms   = form.documentType === 'terms_and_conditions';

  return (
    <div className="space-y-5">

      {/* ── IDENTITY ── */}
      <SectionDivider label="Identity" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel required>Document Type</FieldLabel>
          <select value={form.documentType} onChange={e => set('documentType', e.target.value)} className="input-field">
            {Object.entries(DOC_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Note>Determines which form sections are shown. Cannot change on published docs.</Note>
        </div>
        <div>
          <FieldLabel required>Title</FieldLabel>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="Terms and Conditions" className="input-field" />
          <Note>Displayed to users in the footer and onboarding flow.</Note>
        </div>
        <div>
          <FieldLabel>Subtitle</FieldLabel>
          <input value={form.subtitle} onChange={e => set('subtitle', e.target.value)}
            placeholder="Effective for all users from 1 Jan 2025" className="input-field" />
          <Note>Optional tagline shown below the title.</Note>
        </div>
        <div>
          <FieldLabel required>Slug</FieldLabel>
          <input value={form.slug} onChange={e => set('slug', e.target.value)}
            placeholder="terms-and-conditions" className="input-field" />
          <Note>URL-safe unique identifier. Lowercase, hyphens only. Cannot be changed after creation.</Note>
        </div>
        <div>
          <FieldLabel required>Version</FieldLabel>
          <input value={form.currentVersion} onChange={e => set('currentVersion', e.target.value)}
            placeholder="1.0" className="input-field" />
          <Note>Semantic version string used for consent tracking. e.g. "1.0", "2.3"</Note>
        </div>
        <div>
          <FieldLabel required>Effective Date</FieldLabel>
          <input type="date" value={form.effectiveDate} onChange={e => set('effectiveDate', e.target.value)}
            className="input-field" />
          <Note>Date from which this version is legally binding. Auto-schedules next review +12 months.</Note>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <SectionDivider label="Content" />

      <div>
        <FieldLabel>Plain-language Summary</FieldLabel>
        <textarea value={form.summary} onChange={e => set('summary', e.target.value)}
          rows={3} placeholder="In simple terms, this document covers…" className="input-field resize-none" />
        <Note>2–3 sentence summary shown in onboarding modals. Write for a non-legal audience.</Note>
      </div>
      <div>
        <FieldLabel>Key Points</FieldLabel>
        <textarea value={form.keyPoints} onChange={e => set('keyPoints', e.target.value)}
          rows={4} placeholder="One key point per line" className="input-field resize-none" />
        <Note>One bullet per line. Shown as highlights to users before they consent.</Note>
      </div>
      <div>
        <FieldLabel>Full Plain Text</FieldLabel>
        <textarea value={form.fullText} onChange={e => set('fullText', e.target.value)}
          rows={6} placeholder="Paste the full legal text here…" className="input-field resize-none" />
        <Note>Used for full-text search and SHA-256 checksum tamper detection. Must match fullHtml content.</Note>
      </div>
      <div>
        <FieldLabel>Full HTML</FieldLabel>
        <textarea value={form.fullHtml} onChange={e => set('fullHtml', e.target.value)}
          rows={6} placeholder="<h2>1. Introduction</h2><p>…</p>" className="input-field resize-none font-mono text-xs" />
        <Note>Rendered HTML served to frontend. Supports Tailwind prose classes.</Note>
      </div>

      {/* ── AUDIENCE & PLATFORM ── */}
      <SectionDivider label="Audience & Platform" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Platform</FieldLabel>
          <select value={form.platform} onChange={e => set('platform', e.target.value)} className="input-field">
            {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <Note>"all" applies to web, Android, and iOS simultaneously.</Note>
        </div>
        <div>
          <FieldLabel>Audience / Role</FieldLabel>
          <select value={form.audienceType} onChange={e => set('audienceType', e.target.value)} className="input-field">
            {AUDIENCE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Note>Restrict this document to a specific user role. "all" shows it to everyone.</Note>
        </div>
        <div>
          <FieldLabel>Minimum Age</FieldLabel>
          <input type="number" min={0} value={form.minAge} onChange={e => set('minAge', +e.target.value)}
            className="input-field" />
          <Note>Users below this age require parental consent. Default 18 per Indian law.</Note>
        </div>
        <div className="flex items-start gap-3 pt-6">
          <input type="checkbox" checked={form.requiresParentalConsent}
            onChange={e => set('requiresParentalConsent', e.target.checked)}
            className="checkbox checkbox-sm mt-0.5" />
          <div>
            <span className="label-text">Requires Parental Consent</span>
            <Note>Enable for documents shown to minors or guardian-managed accounts.</Note>
          </div>
        </div>
      </div>

      {/* ── JURISDICTION & COMPLIANCE ── */}
      <SectionDivider label="Jurisdiction & Compliance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Governing Law</FieldLabel>
          <input value={form.governingLaw} onChange={e => set('governingLaw', e.target.value)}
            placeholder="India" className="input-field" />
          <Note>Country whose laws govern this document.</Note>
        </div>
        <div>
          <FieldLabel>Jurisdiction</FieldLabel>
          <input value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)}
            placeholder="Andhra Pradesh, India" className="input-field" />
          <Note>Courts / arbitration seat. Defaults to Andhra Pradesh per Likeson HQ.</Note>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Dispute Resolution</FieldLabel>
          <input value={form.disputeResolution} onChange={e => set('disputeResolution', e.target.value)}
            placeholder="Arbitration, Andhra Pradesh courts" className="input-field" />
          <Note>Method and forum for resolving disputes with users.</Note>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Compliance Standards</FieldLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {COMPLIANCE_OPTIONS.map(std => (
              <button key={std} type="button"
                onClick={() => toggleComplianceStd(std)}
                className={`badge badge-sm cursor-pointer transition-all
                  ${form.complianceStandards.includes(std)
                    ? 'bg-primary/15 text-primary border-primary/30 border'
                    : 'bg-base-200 text-base-content/50 border-base-300 border'}
                `}>
                {std}
              </button>
            ))}
          </div>
          <Note>Tag applicable compliance frameworks. DPDP = India Digital Personal Data Protection Act 2023.</Note>
        </div>
      </div>

      {/* ── LEGAL REVIEW ── */}
      <SectionDivider label="Legal Review" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <FieldLabel>Reviewed By</FieldLabel>
          <input value={form.legalReviewedBy} onChange={e => set('legalReviewedBy', e.target.value)}
            placeholder="Advocate / CA Name" className="input-field" />
          <Note>External counsel who reviewed this version.</Note>
        </div>
        <div>
          <FieldLabel>Review Date</FieldLabel>
          <input type="date" value={form.legalReviewedAt} onChange={e => set('legalReviewedAt', e.target.value)}
            className="input-field" />
          <Note>Date of last external legal sign-off.</Note>
        </div>
        <div>
          <FieldLabel>PDF URL</FieldLabel>
          <input value={form.pdfUrl} onChange={e => set('pdfUrl', e.target.value)}
            placeholder="https://cdn.likeson.in/legal/…" className="input-field" />
          <Note>S3/CDN link for downloadable PDF version shown to users.</Note>
        </div>
      </div>

      {/* ── DATA PROTECTION OFFICER ── */}
      <SectionDivider label="Data Protection Officer" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <FieldLabel>DPO Name</FieldLabel>
          <input value={form.dpoName} onChange={e => set('dpoName', e.target.value)}
            placeholder="Full name" className="input-field" />
          <Note>Mandatory under DPDP Act for platforms handling health data.</Note>
        </div>
        <div>
          <FieldLabel>DPO Email</FieldLabel>
          <input type="email" value={form.dpoEmail} onChange={e => set('dpoEmail', e.target.value)}
            placeholder="dpo@likeson.in" className="input-field" />
          <Note>Publicly listed contact for data rights requests from users.</Note>
        </div>
        <div>
          <FieldLabel>DPO Phone</FieldLabel>
          <input value={form.dpoPhone} onChange={e => set('dpoPhone', e.target.value)}
            placeholder="+91 …" className="input-field" />
          <Note>Optional — only list if your DPO policy requires phone contact.</Note>
        </div>
      </div>

      {/* ── PRIVACY POLICY FIELDS ── */}
      {isPrivacy && (
        <>
          <SectionDivider label="Data Collection (Privacy Policy)" />
          <div className="space-y-4">
            <div>
              <FieldLabel>Personal Data Collected</FieldLabel>
              <input value={form.dataCollected.personalData}
                onChange={e => setNested('dataCollected','personalData',e.target.value)}
                placeholder="name, email, phone, dob" className="input-field" />
              <Note>Comma-separated. Data directly identifying the user.</Note>
            </div>
            <div>
              <FieldLabel>Sensitive / Health Data</FieldLabel>
              <input value={form.dataCollected.sensitiveData}
                onChange={e => setNested('dataCollected','sensitiveData',e.target.value)}
                placeholder="health_records, prescriptions, diagnostics" className="input-field" />
              <Note>DPDP "special category" data requiring explicit consent. Stored encrypted.</Note>
            </div>
            <div>
              <FieldLabel>Financial Data</FieldLabel>
              <input value={form.dataCollected.financialData}
                onChange={e => setNested('dataCollected','financialData',e.target.value)}
                placeholder="upi_id, card_last4" className="input-field" />
              <Note>Payment identifiers stored — full card numbers are never stored per PCI-DSS.</Note>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { key:'locationData', label:'Location Data', note:'GPS for transport tracking.' },
                { key:'deviceData',   label:'Device Data',   note:'Device model, OS, IP address.' },
                { key:'biometricData',label:'Biometric Data',note:'Fingerprint / Face ID if used.' },
                { key:'cookies',      label:'Cookies & Tracking', note:'Analytics, session, preferences.' },
              ].map(({ key, label, note }) => (
                <div key={key} className="flex items-start gap-2">
                  <input type="checkbox" className="checkbox checkbox-sm mt-0.5"
                    checked={form.dataCollected[key]}
                    onChange={e => setNested('dataCollected', key, e.target.checked)} />
                  <div>
                    <span className="label-text text-xs">{label}</span>
                    <Note>{note}</Note>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <FieldLabel>Data Purpose</FieldLabel>
              <input value={form.dataPurpose}
                onChange={e => set('dataPurpose', e.target.value)}
                placeholder="service_delivery, analytics, reminders, diagnosis" className="input-field" />
              <Note>Comma-separated. Explain why each data category is collected.</Note>
            </div>
            <div>
              <FieldLabel>Data Retention Period</FieldLabel>
              <input value={form.dataRetention}
                onChange={e => set('dataRetention', e.target.value)}
                placeholder="3 years after account deletion" className="input-field" />
              <Note>How long data is kept. DPDP requires a defined, purpose-limited retention window.</Note>
            </div>
            <div>
              <FieldLabel>Third-Party Data Sharing</FieldLabel>
              <input value={form.dataSharing.thirdParties}
                onChange={e => setNested('dataSharing','thirdParties',e.target.value)}
                placeholder="hospitals, labs, payment_gateways, transport_partners" className="input-field" />
              <Note>Comma-separated. All third parties who may receive user data per your DPR partners list.</Note>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { key:'crossBorderTransfer', label:'Cross-border Transfer', note:'Data leaves India — requires DPDP chapter IV compliance.' },
                { key:'soldToThirdParties',  label:'Data Sold to Third Parties', note:'Must be false — Likeson policy prohibits selling user data.' },
              ].map(({ key, label, note }) => (
                <div key={key} className="flex items-start gap-2">
                  <input type="checkbox" className="checkbox checkbox-sm mt-0.5"
                    checked={form.dataSharing[key]}
                    onChange={e => setNested('dataSharing', key, e.target.checked)} />
                  <div>
                    <span className="label-text text-xs">{label}</span>
                    <Note>{note}</Note>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <FieldLabel>User Rights</FieldLabel>
              <input value={form.userRights}
                onChange={e => set('userRights', e.target.value)}
                placeholder="access, rectify, delete, portability, grievance" className="input-field" />
              <Note>Comma-separated. Rights granted under DPDP / IT Act. Include "grievance" for Grievance Officer route.</Note>
            </div>
          </div>
        </>
      )}

      {/* ── REFUND POLICY FIELDS ── */}
      {isRefund && (
        <>
          <SectionDivider label="Refund Rules (Refund Policy)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key:'fullRefundWindowHours', label:'Full Refund Window (hours)', note:'Cancel before this many hours → 100% refund. Default 24h per your DPR.' },
              { key:'partialRefundPercent',  label:'Partial Refund %',            note:'Refund percent when cancelled within the window. Default 50%.' },
              { key:'processingDaysMin',     label:'Processing Days Min',        note:'Minimum business days to process refund. Default 5.' },
              { key:'processingDaysMax',     label:'Processing Days Max',        note:'Maximum business days to process refund. Default 12.' },
            ].map(({ key, label, note }) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <input type="number" min={0}
                  value={form.refundRules[key]}
                  onChange={e => setNested('refundRules', key, +e.target.value)}
                  className="input-field" />
                <Note>{note}</Note>
              </div>
            ))}
            <div className="sm:col-span-2">
              <FieldLabel>Accepted Refund Methods</FieldLabel>
              <input value={form.refundRules.refundMethods}
                onChange={e => setNested('refundRules','refundMethods',e.target.value)}
                placeholder="upi, credit_card, debit_card" className="input-field" />
              <Note>Comma-separated payment methods eligible for refund.</Note>
            </div>
            <div className="flex items-start gap-2">
              <input type="checkbox" className="checkbox checkbox-sm mt-0.5"
                checked={form.refundRules.noRefundOnceDriverStarts}
                onChange={e => setNested('refundRules','noRefundOnceDriverStarts',e.target.checked)} />
              <div>
                <span className="label-text text-xs">No refund once driver starts</span>
                <Note>No refund issued after driver begins journey or reaches pickup. Matches your DPR policy.</Note>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <input type="checkbox" className="checkbox checkbox-sm mt-0.5"
                checked={form.refundRules.doubleChargeFullRefund}
                onChange={e => setNested('refundRules','doubleChargeFullRefund',e.target.checked)} />
              <div>
                <span className="label-text text-xs">Full refund on double charge</span>
                <Note>Accidental duplicate payment always refunded in full regardless of timing.</Note>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TERMS FIELDS ── */}
      {isTerms && (
        <>
          <SectionDivider label="Terms-specific" />
          <div>
            <FieldLabel>Dispute Resolution Detail</FieldLabel>
            <input value={form.disputeResolution} onChange={e => set('disputeResolution', e.target.value)}
              placeholder="Arbitration, Andhra Pradesh courts" className="input-field" />
            <Note>Specific clause wording for dispute resolution section.</Note>
          </div>
        </>
      )}

      {/* ── CONSENT & NOTIFICATIONS ── */}
      <SectionDivider label="Consent & Notifications" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Consent Method</FieldLabel>
          <select value={form.consentMethod} onChange={e => set('consentMethod', e.target.value)} className="input-field">
            {['checkbox','click','scroll','api'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <Note>"checkbox" = explicit tick before proceed. "scroll" = scroll-to-bottom required.</Note>
        </div>
        <div className="flex items-start gap-3 pt-6">
          <input type="checkbox" checked={form.requiresExplicitConsent}
            onChange={e => set('requiresExplicitConsent', e.target.checked)}
            className="checkbox checkbox-sm mt-0.5" />
          <div>
            <span className="label-text">Requires Explicit Consent</span>
            <Note>Disable only for informational pages where passive viewing suffices.</Note>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={form.notifyUsersOnUpdate}
            onChange={e => set('notifyUsersOnUpdate', e.target.checked)}
            className="checkbox checkbox-sm mt-0.5" />
          <div>
            <span className="label-text">Notify users on update</span>
            <Note>Sends notification to all users when a new version goes live.</Note>
          </div>
        </div>
        <div>
          <FieldLabel>Notification Channels</FieldLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {NOTIFICATION_CHANNELS.map(ch => (
              <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                className={`badge badge-sm cursor-pointer transition-all
                  ${form.notificationChannels.includes(ch)
                    ? 'bg-primary/15 text-primary border-primary/30 border'
                    : 'bg-base-200 text-base-content/50 border-base-300 border'}
                `}>
                {ch}
              </button>
            ))}
          </div>
          <Note>Select all channels used to notify users. WhatsApp = primary in Tier 2/3 cities.</Note>
        </div>
      </div>

      {/* ── SEO & DISPLAY ── */}
      <SectionDivider label="SEO & Display" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Meta Title</FieldLabel>
          <input value={form.metaTitle} onChange={e => set('metaTitle', e.target.value)}
            placeholder="Terms and Conditions | Likeson" className="input-field" />
          <Note>Overrides the page &lt;title&gt; tag for SEO. Leave blank to auto-generate.</Note>
        </div>
        <div>
          <FieldLabel>Meta Description</FieldLabel>
          <input value={form.metaDescription} onChange={e => set('metaDescription', e.target.value)}
            placeholder="Read Likeson's Terms…" className="input-field" />
          <Note>160 characters max. Used by search engines and social sharing previews.</Note>
        </div>
        <div>
          <FieldLabel>Display Order</FieldLabel>
          <input type="number" value={form.displayOrder} onChange={e => set('displayOrder', +e.target.value)}
            className="input-field" />
          <Note>Lower number = shown first in footer. e.g. T&C=1, Privacy=2, Refund=3.</Note>
        </div>
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-start gap-2">
            <input type="checkbox" className="checkbox checkbox-sm mt-0.5"
              checked={form.showInFooter} onChange={e => set('showInFooter', e.target.checked)} />
            <div>
              <span className="label-text text-xs">Show in footer</span>
              <Note>Displays link in site/app footer.</Note>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <input type="checkbox" className="checkbox checkbox-sm mt-0.5"
              checked={form.showInOnboarding} onChange={e => set('showInOnboarding', e.target.checked)} />
            <div>
              <span className="label-text text-xs">Show in onboarding</span>
              <Note>Surfaces this doc in the signup/registration consent screen.</Note>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function ViewPanel({ doc, loading }) {
  if (loading) return <div className="flex justify-center py-20"><span className="loading loading-md" /></div>;
  if (!doc) return null;

  return (
    <div className="space-y-6">
      {/* Pipeline stepper */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-4">Publication Pipeline</p>
        <PipelineStepper status={doc.status} />
      </div>

      {/* Identity */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h5>{doc.title}</h5>
            {doc.subtitle && <p className="text-sm text-base-content/60 mt-0.5">{doc.subtitle}</p>}
          </div>
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <DocTypeBadge type={doc.documentType} />
          <span className="badge badge-sm bg-base-200 text-base-content/60 border border-base-300">v{doc.currentVersion}</span>
          <span className="badge badge-sm bg-base-200 text-base-content/60 border border-base-300">{doc.platform}</span>
          <span className="badge badge-sm bg-base-200 text-base-content/60 border border-base-300">{doc.audienceType}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-base-content/40 text-xs block">Effective</span>{fmt(doc.effectiveDate)}</div>
          <div><span className="text-base-content/40 text-xs block">Next Review</span>{fmt(doc.nextReviewDue)}</div>
          <div><span className="text-base-content/40 text-xs block">Total Consents</span>
            <span className="font-bold text-primary">{doc.totalConsents ?? 0}</span>
          </div>
          <div><span className="text-base-content/40 text-xs block">Jurisdiction</span>{doc.jurisdiction ?? '—'}</div>
        </div>
      </div>

      {/* Key points */}
      {doc.keyPoints?.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Key Points</p>
          <ul className="space-y-1.5">
            {doc.keyPoints.map((kp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight size={13} className="text-primary mt-0.5 shrink-0" />
                {kp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Compliance */}
      {doc.complianceStandards?.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Compliance Standards</p>
          <div className="flex flex-wrap gap-2">
            {doc.complianceStandards.map(s => (
              <span key={s} className="badge badge-sm bg-primary/10 text-primary border border-primary/30">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* DPO */}
      {doc.dataProtectionOfficer?.email && (
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Data Protection Officer</p>
          <div className="text-sm space-y-1">
            <div>{doc.dataProtectionOfficer.name}</div>
            <div className="text-primary">{doc.dataProtectionOfficer.email}</div>
            {doc.dataProtectionOfficer.phone && <div className="text-base-content/60">{doc.dataProtectionOfficer.phone}</div>}
          </div>
        </div>
      )}

      {/* PDF link */}
      {doc.pdfUrl && (
        <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"
          className="btn btn-outline btn-sm gap-2 w-full">
          <Download size={13} /> Download PDF
        </a>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function ConsentsPanel({ consents, pages }) {
  if (consents.length === 0)
    return (
      <div className="text-center py-12">
        <Users size={32} className="mx-auto text-base-content/20 mb-3" />
        <p className="text-sm text-base-content/40">No consent records for this document.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-base-content/50">{pages.total} total consents</span>
      </div>
      {consents.map((c, i) => (
        <motion.div key={c._id ?? i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="card p-4 flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{c.userId?.name ?? c.userId?.toString() ?? '—'}</span>
              <span className="badge badge-xs bg-base-200 text-base-content/50 border border-base-300">v{c.version}</span>
              <span className="badge badge-xs bg-base-200 text-base-content/50 border border-base-300 capitalize">{c.method}</span>
              <span className="badge badge-xs bg-base-200 text-base-content/50 border border-base-300 capitalize">{c.platform}</span>
            </div>
            <div className="text-xs text-base-content/40">{fmt(c.consentedAt)} · {c.ipAddress ?? '—'}</div>
            {c.state && <div className="text-xs text-base-content/40">{c.city}, {c.state}</div>}
          </div>
          {c.isWithdrawn
            ? <span className="badge badge-sm bg-error/10 text-error border border-error/30 shrink-0">Withdrawn</span>
            : <span className="badge badge-sm bg-success/10 text-success border border-success/30 shrink-0">Active</span>
          }
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function HistoryPanel({ doc, history, loading }) {
  if (loading) return <div className="flex justify-center py-20"><span className="loading loading-md" /></div>;

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <span className="text-sm font-semibold">Current: v{doc?.currentVersion}</span>
        <StatusBadge status={doc?.status} />
      </div>

      {history.length === 0 ? (
        <div className="text-center py-10">
          <History size={28} className="mx-auto text-base-content/20 mb-2" />
          <p className="text-sm text-base-content/40">No archived versions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((v, i) => (
            <motion.div key={v._id ?? i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="badge badge-sm bg-base-200 text-base-content/60 border border-base-300">v{v.version}</span>
                <span className="text-xs text-base-content/40">{fmt(v.effectiveDate)}</span>
              </div>
              {v.changeSummary && (
                <p className="text-sm text-base-content/70">{v.changeSummary}</p>
              )}
              {v.archivedBy && (
                <p className="text-xs text-base-content/40">Archived by {v.archivedBy?.name ?? v.archivedBy}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

function Modal({ children, onClose, title }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-neutral/60 backdrop-blur-soft z-50" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-base-100 border border-base-300 rounded-[var(--r-box)] shadow-depth-lg p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h6>{title}</h6>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle"><X size={14} /></button>
        </div>
        {children}
      </motion.div>
    </>
  );
}