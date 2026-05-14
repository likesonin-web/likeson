'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Building2, Search, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Star, StarOff, Trash2, Eye, ChevronDown, ChevronUp,
  Shield, ShieldCheck, ShieldOff, Activity, Droplets, TrendingUp,
  MapPin, Phone, Mail, Calendar, Award, FileText, BadgeCheck,
  ChevronLeft, ChevronRight, X, Loader2,
  Clock, Package,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Globe, Truck,
  FlaskConical, Heart, Info,
} from 'lucide-react';
import {
  adminFetchAllBanks,
  adminFetchBank,
  adminFetchBankStats,
  adminUpdateStatus,
  adminVerifyBank,
  adminToggleFeatured,
  adminVerifyLicense,
  adminDeleteBank,
} from '@/store/slices/bloodbankSlice';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:       { label: 'Active',       color: 'var(--success)', bg: 'bg-success/10',   border: 'border-success/30',  icon: CheckCircle },
  pending:      { label: 'Pending',      color: 'var(--warning)', bg: 'bg-warning/10',   border: 'border-warning/30',  icon: Clock },
  under_review: { label: 'Under Review', color: 'var(--info)',    bg: 'bg-info/10',       border: 'border-info/30',     icon: Eye },
  suspended:    { label: 'Suspended',    color: 'var(--error)',   bg: 'bg-error/10',      border: 'border-error/30',    icon: ShieldOff },
  revoked:      { label: 'Revoked',      color: 'var(--error)',   bg: 'bg-error/10',      border: 'border-error/30',    icon: XCircle },
  deactivated:  { label: 'Deactivated',  color: 'oklch(60% 0.01 240)', bg: 'bg-base-300/60', border: 'border-base-300', icon: Minus },
};

const BANK_TYPE_CONFIG = {
  standalone:        { label: 'Standalone',  icon: Building2, color: 'text-primary' },
  hospital_embedded: { label: 'Hospital',    icon: Heart,     color: 'text-error' },
  mobile_unit:       { label: 'Mobile Unit', icon: Truck,     color: 'text-accent' },
};

const CHART_COLORS = [
  'var(--primary)', 'var(--success)', 'var(--warning)',
  'var(--error)', 'var(--info)', 'var(--accent)',
];

const STATUSES_ALL = ['pending', 'under_review', 'active', 'suspended', 'revoked', 'deactivated'];

// ─── Animation Variants ──────────────────────────────────────────────────────

const staggerContainer = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};
const slideIn = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, x: 60, transition: { duration: 0.28 } },
};
const backdropVariant = {
  hidden: { opacity: 0 },
  show:   { opacity: 1 },
  exit:   { opacity: 0 },
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-4 py-3 text-sm shadow-lg" style={{ minWidth: 140 }}>
      <p className="font-bold text-base-content/70 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-semibold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color, delta, sub, onClick, active }) => (
  <motion.div
    variants={fadeUp}
    className={`stat-card group cursor-default transition-all ${onClick ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-primary' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between mb-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      {delta !== undefined && (
        <span
          className="flex items-center gap-0.5 text-xs font-bold"
          style={{ color: delta >= 0 ? 'var(--success)' : 'var(--error)' }}
        >
          {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(delta)}%
        </span>
      )}
    </div>
    <div className="stat-card-value" style={{ color }}>{value ?? '—'}</div>
    <div className="stat-card-label">{label}</div>
    {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
  </motion.div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.deactivated;
  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.bg} ${cfg.border} border gap-1`} style={{ color: cfg.color }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

const ConfirmDialog = ({ open, title, desc, confirmLabel, danger, onConfirm, onCancel, children }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        variants={backdropVariant} initial="hidden" animate="show" exit="exit"
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="card p-6 w-full max-w-md"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold mb-2 font-montserrat">{title}</h3>
          <p className="text-sm text-base-content/60 mb-4">{desc}</p>
          {children}
          <div className="flex gap-3 justify-end mt-4">
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
            <button
              className={`btn btn-sm ${danger ? 'btn-error' : 'btn-primary'}`}
              onClick={onConfirm}
            >
              {confirmLabel || 'Confirm'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Bank Detail Drawer ──────────────────────────────────────────────────────

const BankDetailDrawer = ({
  bank,
  stats,
  drawerLoading,
  onClose,
  onStatusChange,
  onVerify,
  onToggleFeatured,
  onVerifyLicense,
  onDelete,
}) => {
  const [activeTab,       setActiveTab]       = useState('overview');
  // FIX: init statusInput from bank.status, reset when bank changes
  const [statusInput,     setStatusInput]     = useState(bank?.status || 'active');
  const [reasonInput,     setReasonInput]     = useState('');
  const [showStatusForm,  setShowStatusForm]  = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // FIX: sync statusInput when bank prop changes (switching between banks)
  useEffect(() => {
    if (bank?.status) {
      setStatusInput(bank.status);
      setReasonInput('');
      setShowStatusForm(false);
      setActiveTab('overview');
    }
  }, [bank?._id]);

  if (!bank) return null;

  // FIX: stats shape from backend = { bank: { name, bankCode, rating, stats }, inventory: {...} }
  const invStats  = stats?.inventory || {};
  const bankStats = stats?.bank?.stats || bank?.stats || {};

  const tabs = [
    { id: 'overview',   label: 'Overview',   icon: Info },
    { id: 'inventory',  label: 'Inventory',  icon: Droplets },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'stats',      label: 'Stats',      icon: Activity },
  ];

  const TypeIcon = BANK_TYPE_CONFIG[bank.bankType]?.icon || Building2;

  return (
    <motion.div
      variants={backdropVariant} initial="hidden" animate="show" exit="exit"
      className="fixed inset-0 z-[100] flex justify-end"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <motion.aside
        variants={slideIn} initial="hidden" animate="show" exit="exit"
        className="h-full w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--base-100)', boxShadow: 'var(--shadow-depth-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-base-300">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}
          >
            {bank.logoUrl
              ? <img src={bank.logoUrl} alt="" className="w-full h-full object-cover" />
              : <TypeIcon size={24} style={{ color: 'var(--primary)' }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-lg font-montserrat truncate">{bank.name}</h2>
              {bank.isFeatured && <Star size={14} className="text-warning shrink-0" fill="currentColor" />}
            </div>
            <p className="text-xs text-base-content/50 font-mono">{bank.bankCode}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={bank.status} />
              <span className="badge badge-primary text-xs">
                {BANK_TYPE_CONFIG[bank.bankType]?.label || bank.bankType}
              </span>
              {bank.isVerified && (
                <span className="badge bg-success/10 border border-success/30 text-success text-xs gap-1">
                  <BadgeCheck size={11} /> Verified
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-circle btn-sm ml-auto shrink-0" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-base-300 px-4 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-base-content/50 hover:text-base-content'
              }`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 relative">
          {/* FIX: show loader while fetching bank details */}
          {drawerLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: 'color-mix(in srgb, var(--base-100), transparent 20%)' }}
            >
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          )}

          {activeTab === 'overview' && (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
              {/* Contact */}
              <motion.div variants={fadeUp} className="card p-4 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Contact</h4>
                {[
                  { icon: Phone, val: bank.contact?.phone },
                  { icon: Phone, val: bank.contact?.emergencyPhone, label: 'Emergency' },
                  { icon: Mail,  val: bank.contact?.email },
                  { icon: Globe, val: bank.contact?.website },
                ].map(({ icon: I, val, label }) => val && (
                  <div key={val} className="flex items-center gap-2 text-sm">
                    <I size={13} className="text-base-content/40 shrink-0" />
                    <span>{label ? `${label}: ` : ''}{val}</span>
                  </div>
                ))}
              </motion.div>

              {/* Address */}
              <motion.div variants={fadeUp} className="card p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Address</h4>
                <div className="flex gap-2 text-sm">
                  <MapPin size={13} className="text-base-content/40 shrink-0 mt-0.5" />
                  <span>
                    {[bank.address?.line1, bank.address?.line2, bank.address?.landmark,
                      bank.address?.city, bank.address?.state, bank.address?.pincode]
                      .filter(Boolean).join(', ')}
                  </span>
                </div>
              </motion.div>

              {/* Services */}
              <motion.div variants={fadeUp} className="card p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Services</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Accepts Donations',    bank.acceptsDonations],
                    ['Offers Delivery',      bank.offersDelivery],
                    ['Cross Match',          bank.offersCrossMatch],
                    ['Component Sep.',       bank.offersComponentSeparation],
                    ['Emergency 24×7',       bank.isEmergency24x7],
                    ['Apheresis',            bank.hasApheresisFacility],
                    ['Mobile Unit',          bank.hasMobileUnit],
                    ['Emergency Supply',     bank.offersEmergencySupply],
                  ].map(([name, val]) => (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      {val
                        ? <CheckCircle size={13} className="text-success shrink-0" />
                        : <XCircle    size={13} className="text-base-content/20 shrink-0" />
                      }
                      <span className={val ? 'text-base-content' : 'text-base-content/40'}>{name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Blood Groups & Components */}
              <motion.div variants={fadeUp} className="card p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-2">Blood Groups</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(bank.bloodGroupsAvailable || []).map(g => (
                      <span key={g} className="badge badge-primary badge-sm">{g}</span>
                    ))}
                    {!bank.bloodGroupsAvailable?.length && <span className="text-xs text-base-content/40">None listed</span>}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-2">Components Handled</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(bank.componentsHandled || []).map(c => (
                      <span key={c} className="badge badge-outline badge-sm text-xs">{c}</span>
                    ))}
                    {!bank.componentsHandled?.length && <span className="text-xs text-base-content/40">None listed</span>}
                  </div>
                </div>
              </motion.div>

              {/* Delivery Info */}
              {bank.offersDelivery && (
                <motion.div variants={fadeUp} className="card p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Delivery</h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: 'Radius',      val: `${bank.deliveryRadiusKm || 0} km` },
                      { label: 'Fee/km',      val: `₹${bank.deliveryFeePerKm || 0}` },
                      { label: 'Free upto',   val: `${bank.freeDeliveryKm || 0} km` },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-base-200 rounded-xl p-2">
                        <p className="font-bold text-sm">{val}</p>
                        <p className="text-xs text-base-content/50">{label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Manager */}
              {bank.managedBy && (
                <motion.div variants={fadeUp} className="card p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Manager</h4>
                  <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {(bank.managedBy.name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{bank.managedBy.name || '—'}</p>
                      <p className="text-xs text-base-content/50">{bank.managedBy.email || '—'}</p>
                      {bank.managedBy.phone && (
                        <p className="text-xs text-base-content/40">{bank.managedBy.phone}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Onboarding */}
              {bank.onboarding && (
                <motion.div variants={fadeUp} className="card p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Onboarding</h4>
                  <div className="flex items-center gap-3">
                    <progress
                      className="progress progress-primary flex-1"
                      value={bank.onboarding.isComplete ? 100 : ((bank.onboarding.step - 1) / 5) * 100}
                      max="100"
                    />
                    <span className="text-xs font-bold">
                      {bank.onboarding.isComplete ? 'Complete' : `Step ${bank.onboarding.step}`}
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Available',   val: invStats.totalAvailable, color: 'var(--success)' },
                  { label: 'Reserved',    val: invStats.totalReserved,  color: 'var(--warning)' },
                  { label: 'Issued',      val: invStats.totalIssued,    color: 'var(--primary)' },
                  { label: 'Expired',     val: invStats.totalExpired,   color: 'var(--error)' },
                  { label: 'Inv. Slots',  val: invStats.slots,          color: 'var(--info)' },
                  { label: 'Low Stock',   val: invStats.lowStockCount,  color: 'var(--warning)' },
                  { label: 'Critical',    val: invStats.criticalCount,  color: 'var(--error)' },
                ].map(({ label, val, color }) => (
                  <motion.div key={label} variants={fadeUp} className="stat-card">
                    <div className="stat-card-value" style={{ color }}>{val ?? 0}</div>
                    <div className="stat-card-label">{label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Stock pie */}
              {(invStats.totalAvailable !== undefined) && (
                <motion.div variants={fadeUp} className="card p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Stock Distribution</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Available', value: invStats.totalAvailable || 0 },
                          { name: 'Reserved',  value: invStats.totalReserved  || 0 },
                          { name: 'Issued',    value: invStats.totalIssued    || 0 },
                          { name: 'Expired',   value: invStats.totalExpired   || 0 },
                        ]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                        dataKey="value" paddingAngle={3}
                      >
                        {CHART_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={v => <span className="text-xs text-base-content/70">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {!invStats.totalAvailable && !invStats.slots && (
                <div className="text-center py-8 text-base-content/40 text-sm">
                  No inventory data yet
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'compliance' && (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
              {/* Licenses */}
              <motion.div variants={fadeUp} className="card p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">
                  Licenses ({bank.licenses?.length || 0})
                </h4>
                {!bank.licenses?.length && (
                  <p className="text-sm text-base-content/40">No licenses added.</p>
                )}
                <div className="space-y-3">
                  {(bank.licenses || []).map(lic => (
                    <div
                      key={lic._id}
                      className={`border rounded-xl p-3 ${
                        lic.isVerified
                          ? 'border-success/30 bg-success/5'
                          : 'border-warning/30 bg-warning/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{lic.licenseType?.replace(/_/g, ' ')}</p>
                          <p className="text-xs font-mono text-base-content/60">{lic.licenseNumber}</p>
                          {lic.issuedBy && (
                            <p className="text-xs text-base-content/40 mt-0.5">Issued by: {lic.issuedBy}</p>
                          )}
                          {lic.validUntil && (
                            <p className="text-xs text-base-content/40 mt-0.5 flex items-center gap-1">
                              <Calendar size={10} />
                              Expires {new Date(lic.validUntil).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {lic.isVerified
                            ? (
                              <span className="badge bg-success/10 border-success/30 border text-success text-xs gap-1">
                                <BadgeCheck size={11} /> Verified
                              </span>
                            )
                            : (
                              <button
                                className="btn btn-xs btn-primary"
                                onClick={() => onVerifyLicense({ id: bank._id, licId: lic._id })}
                              >
                                Verify
                              </button>
                            )
                          }
                          {lic.documentUrl && (
                            <a
                              href={lic.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-xs btn-ghost"
                              title="View document"
                            >
                              <FileText size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Accreditations */}
              <motion.div variants={fadeUp} className="card p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">
                  Accreditations ({bank.accreditations?.length || 0})
                </h4>
                {!bank.accreditations?.length && (
                  <p className="text-sm text-base-content/40">No accreditations added.</p>
                )}
                <div className="space-y-2">
                  {(bank.accreditations || []).map(acc => (
                    <div
                      key={acc._id}
                      className={`border rounded-xl p-3 ${
                        acc.isVerified ? 'border-success/30 bg-success/5' : 'border-base-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm flex items-center gap-1.5">
                            <Award size={13} className="text-warning" />{acc.body}
                          </p>
                          {acc.certificateNo && (
                            <p className="text-xs font-mono text-base-content/50">{acc.certificateNo}</p>
                          )}
                          {acc.validUntil && (
                            <p className="text-xs text-base-content/40 flex items-center gap-1">
                              <Calendar size={10} />
                              Expires {new Date(acc.validUntil).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                        {acc.isVerified
                          ? (
                            <span className="badge bg-success/10 border-success/30 border text-success text-xs gap-1">
                              <BadgeCheck size={11} /> Verified
                            </span>
                          )
                          : <span className="badge badge-warning text-xs">Unverified</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Ratings */}
              <motion.div variants={fadeUp} className="card p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Rating Summary</h4>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-black font-montserrat text-warning">
                      {bank.rating?.averageRating?.toFixed(1) || '—'}
                    </p>
                    <div className="flex gap-0.5 justify-center mt-1">
                      {[1,2,3,4,5].map(n => (
                        <Star
                          key={n}
                          size={12}
                          className={n <= Math.round(bank.rating?.averageRating || 0) ? 'text-warning' : 'text-base-content/20'}
                          fill="currentColor"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-base-content/60 space-y-1">
                    <p>{bank.rating?.totalRatings || 0} total ratings</p>
                    <p>{bank.rating?.totalReviews || 0} reviews</p>
                  </div>
                </div>
              </motion.div>

              {/* Status Log */}
              {bank.statusLog?.length > 0 && (
                <motion.div variants={fadeUp} className="card p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">
                    Status History ({bank.statusLog.length})
                  </h4>
                  <div className="space-y-2">
                    {[...bank.statusLog].reverse().slice(0, 8).map((log, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: STATUS_CONFIG[log.toStatus]?.color || 'var(--base-300)' }}
                        />
                        <span className="font-semibold">
                          {log.fromStatus || '—'} → {log.toStatus}
                        </span>
                        {log.reason && (
                          <span className="text-base-content/40 italic truncate max-w-[120px]">{log.reason}</span>
                        )}
                        <span className="text-base-content/40 ml-auto shrink-0">
                          {new Date(log.changedAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                    {bank.statusLog.length > 8 && (
                      <p className="text-xs text-base-content/40 text-center pt-1">
                        +{bank.statusLog.length - 8} more entries
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Units Collected',   val: bankStats.totalUnitsCollected,    color: 'var(--primary)' },
                  { label: 'Units Issued',       val: bankStats.totalUnitsIssued,       color: 'var(--success)' },
                  { label: 'Total Donors',       val: bankStats.totalDonors,            color: 'var(--info)' },
                  { label: 'Total Donations',    val: bankStats.totalDonations,         color: 'var(--accent)' },
                  { label: 'Req. Fulfilled',     val: bankStats.totalRequestsFulfilled, color: 'var(--success)' },
                  { label: 'Req. Partial',       val: bankStats.totalRequestsPartial,   color: 'var(--warning)' },
                  { label: 'Req. Failed',        val: bankStats.totalRequestsFailed,    color: 'var(--error)' },
                  { label: 'Total Earnings',     val: bankStats.totalEarnings ? `₹${bankStats.totalEarnings.toLocaleString('en-IN')}` : 0, color: 'var(--success)' },
                ].map(({ label, val, color }) => (
                  <motion.div key={label} variants={fadeUp} className="stat-card">
                    <div className="stat-card-value text-xl" style={{ color }}>{val ?? 0}</div>
                    <div className="stat-card-label">{label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Request Funnel chart */}
              {bankStats.totalRequestsFulfilled !== undefined && (
                <motion.div variants={fadeUp} className="card p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">
                    Request Outcomes
                  </h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={[
                        { name: 'Fulfilled', value: bankStats.totalRequestsFulfilled || 0 },
                        { name: 'Partial',   value: bankStats.totalRequestsPartial   || 0 },
                        { name: 'Failed',    value: bankStats.totalRequestsFailed    || 0 },
                      ]}
                      barSize={32}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }}
                        axisLine={false} tickLine={false} allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {['var(--success)', 'var(--warning)', 'var(--error)'].map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Timestamps */}
              <motion.div variants={fadeUp} className="card p-4 text-sm space-y-2">
                {bankStats.lastDonationAt && (
                  <p className="flex items-center gap-2 text-base-content/60">
                    <Heart size={13} className="text-error" />
                    Last Donation:{' '}
                    <strong>{new Date(bankStats.lastDonationAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                  </p>
                )}
                {bankStats.lastIssuanceAt && (
                  <p className="flex items-center gap-2 text-base-content/60">
                    <Package size={13} className="text-primary" />
                    Last Issuance:{' '}
                    <strong>{new Date(bankStats.lastIssuanceAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                  </p>
                )}
                {!bankStats.lastDonationAt && !bankStats.lastIssuanceAt && (
                  <p className="text-base-content/40">No activity recorded yet.</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* ── Action Footer ───────────────────────────────────────────────────── */}
        <div className="border-t border-base-300 p-4 space-y-3">
          {/* Status change accordion */}
          <div>
            <button
              className="btn btn-ghost btn-sm w-full justify-between"
              onClick={() => setShowStatusForm(v => !v)}
            >
              <span className="flex items-center gap-2">
                <Shield size={14} /> Change Status
                <span className="ml-1 opacity-60 text-xs">
                  (currently <StatusBadge status={bank.status} />)
                </span>
              </span>
              {showStatusForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <AnimatePresence>
              {showStatusForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-2">
                    <select
                      className="input-field text-sm"
                      value={statusInput}
                      onChange={e => setStatusInput(e.target.value)}
                    >
                      {STATUSES_ALL.map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                      ))}
                    </select>
                    <input
                      className="input-field text-sm"
                      placeholder="Reason (optional)"
                      value={reasonInput}
                      onChange={e => setReasonInput(e.target.value)}
                    />
                    <button
                      className="btn btn-primary btn-sm w-full"
                      disabled={statusInput === bank.status}
                      onClick={() => {
                        onStatusChange({ id: bank._id, status: statusInput, reason: reasonInput });
                        setShowStatusForm(false);
                        setReasonInput('');
                      }}
                    >
                      Apply Status
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {!bank.isVerified && (
              <button
                className="btn btn-success btn-sm flex-1 gap-1"
                onClick={() => onVerify(bank._id)}
              >
                <ShieldCheck size={14} /> Verify & Activate
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm flex-1 gap-1"
              onClick={() => onToggleFeatured(bank._id)}
            >
              {bank.isFeatured
                ? <><StarOff size={14} /> Unfeature</>
                : <><Star size={14} /> Feature</>
              }
            </button>
            <button
              className="btn btn-error btn-outline btn-sm gap-1"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Permanently Delete Blood Bank"
        desc={`This will hard-delete "${bank.name}" and ALL its inventory. This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        danger
        onConfirm={() => {
          onDelete(bank._id);
          setShowDeleteConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// ── MAIN PAGE ────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

export default function BloodBankManagement() {
  const dispatch = useDispatch();
  const { adminBanks, adminTotal, adminSelectedBank, adminStats, loading } =
    useSelector(s => s.bloodBank);

  // FIX: separate loading state for drawer (fetching individual bank)
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Filters
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [page,         setPage]         = useState(1);
  const LIMIT = 15;

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Summary chart tab
  const [chartView, setChartView] = useState('status');

  // ── Fetch list ─────────────────────────────────────────────────────────────
  const fetchList = useCallback(() => {
    dispatch(adminFetchAllBanks({
      page, limit: LIMIT,
      ...(search       && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter   && { bankType: typeFilter }),
    }));
  }, [dispatch, page, search, statusFilter, typeFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── Open drawer ────────────────────────────────────────────────────────────
  const openDrawer = useCallback((id) => {
    setDrawerLoading(true);
    setDrawerOpen(true);
    Promise.all([
      dispatch(adminFetchBank(id)),
      dispatch(adminFetchBankStats(id)),
    ]).finally(() => setDrawerLoading(false));
  }, [dispatch]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(({ id, status, reason }) => {
    dispatch(adminUpdateStatus({ id, status, reason })).then(fetchList);
  }, [dispatch, fetchList]);

  const handleVerify = useCallback((id) => {
    dispatch(adminVerifyBank(id)).then(fetchList);
  }, [dispatch, fetchList]);

  const handleToggleFeatured = useCallback((id) => {
    dispatch(adminToggleFeatured(id)).then(fetchList);
  }, [dispatch, fetchList]);

  // FIX: adminVerifyLicense — no fetchList needed, slice updates adminSelectedBank.licenses in-place
  const handleVerifyLicense = useCallback(({ id, licId }) => {
    dispatch(adminVerifyLicense({ id, licId }));
  }, [dispatch]);

  const handleDelete = useCallback((id) => {
    dispatch(adminDeleteBank(id)).then(() => {
      setDrawerOpen(false);
      fetchList();
    });
  }, [dispatch, fetchList]);

  // ── Derived chart data ─────────────────────────────────────────────────────
  const statusChartData = STATUSES_ALL.map(s => ({
    name:  STATUS_CONFIG[s]?.label || s,
    value: adminBanks.filter(b => b.status === s).length,
    fill:  STATUS_CONFIG[s]?.color || 'var(--base-300)',
  })).filter(d => d.value > 0);

  const typeChartData = Object.entries(BANK_TYPE_CONFIG).map(([key, cfg]) => ({
    name:  cfg.label,
    value: adminBanks.filter(b => b.bankType === key).length,
    fill:  CHART_COLORS[Object.keys(BANK_TYPE_CONFIG).indexOf(key)],
  }));

  const totalPages = Math.ceil(adminTotal / LIMIT);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalActive    = adminBanks.filter(b => b.status === 'active').length;
  const totalPending   = adminBanks.filter(b => b.status === 'pending').length;
  const totalVerified  = adminBanks.filter(b => b.isVerified).length;
  const totalFeatured  = adminBanks.filter(b => b.isFeatured).length;
  const totalEmergency = adminBanks.filter(b => b.isEmergency24x7).length;
  // FIX: avgRating now actually displayed in header sub-text
  const avgRating = adminBanks.length
    ? (adminBanks.reduce((s, b) => s + (b.rating?.averageRating || 0), 0) / adminBanks.length).toFixed(1)
    : '—';

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-base-100">

      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-40 border-b border-base-300"
        style={{ background: 'var(--base-100)', backdropFilter: 'blur(12px)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-gradient-primary)' }}
            >
              <Droplets size={20} color="white" />
            </div>
            <div>
              <h1 className="font-black text-xl font-montserrat leading-none">Blood Bank Management</h1>
              {/* FIX: avgRating now shown */}
              <p className="text-xs text-base-content/50 mt-0.5">
                {adminTotal} total banks · Avg rating {avgRating} · Admin Control Panel
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm gap-2"
            onClick={fetchList}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.header>

      <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* ── Summary stat cards ─────────────────────────────────────────────── */}
        <motion.div
          variants={staggerContainer} initial="hidden" animate="show"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        >
          <StatCard label="Total Banks"    value={adminTotal}     icon={Building2}  color="var(--primary)"  />
          <StatCard label="Active"         value={totalActive}    icon={Zap}        color="var(--success)"  />
          <StatCard label="Pending"        value={totalPending}   icon={Clock}      color="var(--warning)"  />
          <StatCard label="Verified"       value={totalVerified}  icon={ShieldCheck}color="var(--info)"     />
          <StatCard label="Featured"       value={totalFeatured}  icon={Star}       color="var(--accent)"   />
          <StatCard label="Emergency 24×7" value={totalEmergency} icon={Activity}   color="var(--error)"    />
        </motion.div>

        {/* ── Charts row ────────────────────────────────────────────────────── */}
        <motion.div
          variants={staggerContainer} initial="hidden" animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Distribution bar chart */}
          <motion.div variants={fadeUp} className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm font-montserrat uppercase tracking-wider text-base-content/70">
                Distribution
              </h3>
              <div className="flex gap-1">
                {['status', 'type'].map(v => (
                  <button
                    key={v}
                    onClick={() => setChartView(v)}
                    className={`btn btn-xs ${chartView === v ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={chartView === 'status' ? statusChartData : typeChartData}
                barSize={28}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }}
                  axisLine={false} tickLine={false} allowDecimals={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'color-mix(in srgb, var(--primary), transparent 92%)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {(chartView === 'status' ? statusChartData : typeChartData).map((d, i) => (
                    <Cell key={i} fill={d.fill || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Verification pie */}
          <motion.div variants={fadeUp} className="card p-5">
            <h3 className="font-black text-sm font-montserrat uppercase tracking-wider text-base-content/70 mb-4">
              Verification
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Verified',   value: totalVerified },
                    { name: 'Unverified', value: Math.max(0, adminBanks.length - totalVerified) },
                  ]}
                  cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                  dataKey="value" paddingAngle={4}
                >
                  <Cell fill="var(--success)" />
                  <Cell fill="var(--base-300)" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={v => <span className="text-xs text-base-content/60">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <span className="text-2xl font-black font-montserrat text-success">
                {adminBanks.length ? Math.round((totalVerified / adminBanks.length) * 100) : 0}%
              </span>
              <p className="text-xs text-base-content/50">verified</p>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          className="flex flex-wrap gap-3 items-center"
        >
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              className="input-field pl-9 text-sm"
              placeholder="Search name or code…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <select
            className="input-field text-sm w-40"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            {STATUSES_ALL.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>

          <select
            className="input-field text-sm w-40"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            {Object.entries(BANK_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {(search || statusFilter || typeFilter) && (
            <button
              className="btn btn-ghost btn-sm gap-1.5 text-error"
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1); }}
            >
              <X size={13} /> Clear
            </button>
          )}

          <div className="ml-auto text-xs text-base-content/40">
            {adminTotal} result{adminTotal !== 1 ? 's' : ''}
          </div>
        </motion.div>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="card overflow-hidden"
        >
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-sm text-base-content/50">Loading blood banks…</span>
            </div>
          )}

          {!loading && adminBanks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Building2 size={40} className="text-base-content/20" />
              <p className="text-base-content/40 text-sm">No blood banks found</p>
              {(search || statusFilter || typeFilter) && (
                <button
                  className="btn btn-ghost btn-sm text-primary"
                  onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && adminBanks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Bank</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Rating</th>
                    <th>Features</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {adminBanks.map((bank, idx) => {
                      const TypeIcon = BANK_TYPE_CONFIG[bank.bankType]?.icon || Building2;
                      return (
                        <motion.tr
                          key={bank._id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.025, duration: 0.3 }}
                          className="cursor-pointer hover:bg-primary/5 transition-colors"
                          onClick={() => openDrawer(bank._id)}
                        >
                          {/* Bank name + code */}
                          <td>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                                style={{ background: 'color-mix(in srgb, var(--primary), transparent 88%)' }}
                              >
                                {bank.logoUrl
                                  ? <img src={bank.logoUrl} alt="" className="w-full h-full object-cover" />
                                  : <TypeIcon size={16} style={{ color: 'var(--primary)' }} />
                                }
                              </div>
                              <div>
                                <div className="font-bold text-sm flex items-center gap-1.5">
                                  {bank.name}
                                  {bank.isFeatured && (
                                    <Star size={11} className="text-warning" fill="currentColor" />
                                  )}
                                  {bank.isVerified && (
                                    <BadgeCheck size={11} className="text-success" />
                                  )}
                                </div>
                                <div className="text-xs font-mono text-base-content/40">{bank.bankCode}</div>
                              </div>
                            </div>
                          </td>

                          {/* Type */}
                          <td>
                            <span
                              className="badge badge-sm"
                              style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
                            >
                              {BANK_TYPE_CONFIG[bank.bankType]?.label || bank.bankType}
                            </span>
                          </td>

                          {/* Status */}
                          <td><StatusBadge status={bank.status} /></td>

                          {/* Location */}
                          <td>
                            <div className="text-xs flex items-center gap-1 text-base-content/60">
                              <MapPin size={11} />
                              {[bank.address?.city, bank.address?.state].filter(Boolean).join(', ') || '—'}
                            </div>
                          </td>

                          {/* Rating */}
                          <td>
                            <div className="flex items-center gap-1 text-sm">
                              <Star size={12} className="text-warning" fill="currentColor" />
                              <span className="font-bold">
                                {bank.rating?.averageRating?.toFixed(1) || '—'}
                              </span>
                              {bank.rating?.totalRatings > 0 && (
                                <span className="text-xs text-base-content/40">
                                  ({bank.rating.totalRatings})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Feature flags */}
                          <td>
                            <div className="flex gap-1.5">
                              {bank.isEmergency24x7 && (
                                <span title="Emergency 24×7">
                                  <Zap size={13} className="text-error" />
                                </span>
                              )}
                              {bank.offersDelivery && (
                                <span title="Delivery">
                                  <Truck size={13} className="text-info" />
                                </span>
                              )}
                              {bank.hasApheresisFacility && (
                                <span title="Apheresis">
                                  <FlaskConical size={13} className="text-accent" />
                                </span>
                              )}
                              {bank.acceptsDonations && (
                                <span title="Accepts Donations">
                                  <Heart size={13} className="text-error" />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Created */}
                          <td>
                            <span className="text-xs text-base-content/50">
                              {bank.createdAt
                                ? new Date(bank.createdAt).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'short', year: '2-digit',
                                  })
                                : '—'}
                            </span>
                          </td>

                          {/* Quick actions — stop propagation so row click doesn't open drawer */}
                          <td onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {!bank.isVerified && bank.status === 'pending' && (
                                <button
                                  title="Quick Verify"
                                  className="btn btn-xs btn-success"
                                  onClick={() => handleVerify(bank._id)}
                                >
                                  <ShieldCheck size={12} />
                                </button>
                              )}
                              <button
                                title={bank.isFeatured ? 'Unfeature' : 'Feature'}
                                className="btn btn-xs btn-ghost"
                                onClick={() => handleToggleFeatured(bank._id)}
                              >
                                {bank.isFeatured
                                  ? <Star size={12} className="text-warning" fill="currentColor" />
                                  : <StarOff size={12} className="text-base-content/30" />
                                }
                              </button>
                              <button
                                title="View Details"
                                className="btn btn-xs btn-ghost"
                                onClick={() => openDrawer(bank._id)}
                              >
                                <Eye size={12} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
              <span className="text-xs text-base-content/50">
                Page {page} of {totalPages} · {adminTotal} total
              </span>
              <div className="flex gap-1">
                <button
                  className="btn btn-xs btn-ghost"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      className={`btn btn-xs ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="btn btn-xs btn-ghost"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Bottom status filter cards ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.38 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        >
          {STATUSES_ALL.map(s => {
            const cfg  = STATUS_CONFIG[s];
            const count = adminBanks.filter(b => b.status === s).length;
            const Icon  = cfg.icon;
            return (
              <button
                key={s}
                className={`stat-card text-left transition-all hover:ring-1 hover:ring-primary/40 ${
                  statusFilter === s ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  setStatusFilter(statusFilter === s ? '' : s);
                  setPage(1);
                }}
              >
                <Icon size={16} style={{ color: cfg.color }} className="mb-2" />
                <div className="stat-card-value text-xl" style={{ color: cfg.color }}>{count}</div>
                <div className="stat-card-label">{cfg.label}</div>
              </button>
            );
          })}
        </motion.div>

      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && adminSelectedBank && (
          <BankDetailDrawer
            bank={adminSelectedBank}
            stats={adminStats}
            drawerLoading={drawerLoading}
            onClose={() => setDrawerOpen(false)}
            onStatusChange={handleStatusChange}
            onVerify={handleVerify}
            onToggleFeatured={handleToggleFeatured}
            onVerifyLicense={handleVerifyLicense}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}