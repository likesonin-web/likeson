'use client';

/**
 * TransportPartnerManagement.jsx — Likeson.in
 * Superadmin — Full Transport Partner Management
 *
 * FIXES APPLIED:
 *  1. Data persistence on tab switch — each section stores its own data in Redux
 *     and re-fetches only when deps change (not on every render).
 *  2. All input fields now have placeholder + helper-note.
 *  3. Analytics upgraded to multi-chart professional layout.
 *  4. Password: auto-generate (LKS prefix, unique) OR manual entry.
 *  5. platformFee object rendering fixed (safeVal / formatFee).
 *  6. vehicleStats byType array safe-rendered.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, ComposedChart,
} from 'recharts';
import {
  Building2, Users, Car, MapPin, Wallet, ShieldCheck, Activity,
  Plus, Search, Filter, ChevronDown, ChevronRight, Eye, Edit3,
  Trash2, Ban, CheckCircle2, XCircle, Clock, AlertTriangle,
  TrendingUp, Star, DollarSign, FileText, Settings, Bell,
  Upload, Link2, X, Check, RefreshCw, Download, MoreVertical,
  ArrowUpRight, Truck, CreditCard, Zap, Globe, Phone,
  Mail, Calendar, Hash, Shield, Lock, ChevronUp,
  BarChart2, List, Send, Pause, Play, AlertCircle,
  Info, ExternalLink, Copy, Camera, Navigation,
  Award, Target, Layers, Percent, Package, ClipboardList,
  UserCheck, UserX, KeyRound, Wrench, Coins, PieChart as PieIcon,
  ToggleLeft, ToggleRight, BookOpen, RefreshCcw, Shuffle,
  EyeOff, BadgeCheck, Banknote, TrendingDown, Hash as HashIcon,
} from 'lucide-react';

import {
  adminFetchPartners, adminFetchPartnerById, adminCreatePartner,
  adminUpdatePartner, adminUpdatePartnerStatus, adminUpdatePartnerKyc,
  adminUpdatePartnerNotes, adminDeletePartner, adminFetchPartnerLogs,
  adminFetchPendingVehicles, adminVerifyVehicle,
  adminFetchAllDrivers, adminFetchAvailableDrivers, adminFetchDriverById,
  adminVerifyDriverKyc, adminBlockDriver, adminUnblockDriver,
  adminUpdateDriverNotes, adminAdjustDriverCoins, adminFetchDriverLogs,
  adminFetchGlobalPricing, adminUpdateGlobalPricing,
  adminSetPartnerPlatformFee, adminProcessPartnerSettlement,
  adminFetchTransportLogs, adminFetchTransportStats,
  clearTPError,
} from '@/store/slices/transportPartnerSlice';

import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ─────────────────────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 16 },     visible: { opacity: 1, y: 0,     transition: { duration: 0.35 } } };
const fadeIn  = { hidden: { opacity: 0 },             visible: { opacity: 1,           transition: { duration: 0.25 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.96 },visible: { opacity: 1, scale: 1, transition: { duration: 0.22 } } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const safeVal = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const formatFee = (fee) => {
  if (!fee) return 'Global default';
  if (typeof fee === 'object' && fee.type && fee.value !== undefined)
    return fee.type === 'percentage' ? `${fee.value}%` : `₹${fee.value} flat`;
  return safeVal(fee);
};

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

/** Generate a unique Likeson password: LKS + 4 random uppercase + 4 digits + 1 symbol */
const generatePassword = () => {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const syms   = '@#$!';
  const rand = (s) => s[Math.floor(Math.random() * s.length)];
  const uid = Date.now().toString(36).slice(-4).toUpperCase();
  return `LKS${uid}${rand(upper)}${rand(upper)}${rand(digits)}${rand(digits)}${rand(syms)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    active: 'badge-success', pending: 'badge-warning', 'under-review': 'badge-info',
    suspended: 'badge-error', rejected: 'badge-error', verified: 'badge-success',
    Verified: 'badge-success', 'not-submitted': 'badge', Available: 'badge-success',
    'On-Trip': 'badge-info', Offline: 'badge', Blocked: 'badge-error',
    Pending: 'badge-warning', 'Under-Review': 'badge-info',
  };
  return <span className={`badge ${map[status] || 'badge'} text-[10px]`}>{safeVal(status)}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, trend, color = 'var(--primary)' }) => (
  <motion.div variants={fadeUp} className="glass-card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
    <div className="flex items-start justify-between">
      <div className="p-2.5 rounded-xl" style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}>
        <Icon size={20} style={{ color }} />
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? <ChevronUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div>
      <p className="text-2xl font-black text-base-content">{safeVal(value)}</p>
      <p className="text-xs font-semibold text-base-content/60 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-base-content/40 mt-1">{safeVal(sub)}</p>}
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}>
        <Icon size={20} style={{ color: 'var(--primary)' }} />
      </div>
      <div>
        <h2 className="text-xl font-black text-base-content">{title}</h2>
        {subtitle && <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative z-10 w-full ${sizes[size]} glass-card p-6 max-h-[90vh] overflow-y-auto`}
            variants={scaleIn} initial="hidden" animate="visible" exit="hidden">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-base-content">{title}</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-base-300 transition-colors"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Field wrapper (label + helper note)
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({ label, children, required, note }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-base-content/70">
      {label}{required && <span className="text-error ml-1">*</span>}
    </label>
    {children}
    {note && <p className="text-[10px] text-base-content/40 mt-0.5">{note}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Media Input
// ─────────────────────────────────────────────────────────────────────────────
const MediaInput = ({ label, value, onChange, folder = 'transport', note }) => {
  const dispatch = useDispatch();
  const { isUploading } = useSelector((s) => s.upload);
  const [mode, setMode] = useState('url');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const res = await dispatch(uploadSingleFile({ file, folder }));
    if (res.payload?.url) onChange(res.payload.url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-base-content/70">{label}</label>
        <div className="flex rounded-lg overflow-hidden border border-base-300 ml-auto">
          {['url', 'upload'].map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${mode === m ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/50'}`}>
              {m === 'url' ? <Link2 size={11} /> : <Upload size={11} />}
            </button>
          ))}
        </div>
      </div>
      {mode === 'url' ? (
        <input type="url" value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder="https://cdn.example.com/doc.jpg" className="input-field w-full text-xs" />
      ) : (
        <div onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-base-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors">
          {isUploading ? <span className="spinner mx-auto" /> : value ? (
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 size={20} className="text-success" />
              <p className="text-[11px] text-success font-semibold">Uploaded</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload size={20} className="text-base-content/30" />
              <p className="text-[11px] text-base-content/50">Click to upload (image / PDF)</p>
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} />
        </div>
      )}
      {value && <p className="text-[10px] text-base-content/40 truncate">{value}</p>}
      {note && <p className="text-[10px] text-base-content/40">{note}</p>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmDialog = ({ open, onClose, onConfirm, title, message, danger }) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-base-content/70 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button onClick={onClose} className="btn-secondary text-xs px-4 py-2">Cancel</button>
      <button onClick={() => { onConfirm(); onClose(); }}
        className="btn-primary-cta text-xs px-4 py-2"
        style={danger ? { background: 'var(--error)' } : {}}>
        Confirm
      </button>
    </div>
  </Modal>
);

// ─────────────────────────────────────────────────────────────────────────────
// Info Row / Cell
// ─────────────────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm py-1.5 border-b border-base-300/40 last:border-0">
    <span className="text-base-content/50 text-xs">{label}</span>
    <span className="font-semibold text-xs text-right max-w-[60%] truncate">{safeVal(value)}</span>
  </div>
);

const InfoCell = ({ label, value, valueNode }) => (
  <div className="flex flex-col gap-1 p-3 bg-base-200/50 rounded-xl">
    <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">{label}</span>
    {valueNode ?? <span className="text-sm font-semibold">{safeVal(value)}</span>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Password field with auto-generate / manual toggle
// ─────────────────────────────────────────────────────────────────────────────
const PasswordField = ({ value, onChange }) => {
  const [mode,    setMode]    = useState('auto');   // 'auto' | 'manual'
  const [visible, setVisible] = useState(false);

  const reGenerate = useCallback(() => {
    onChange(generatePassword());
  }, [onChange]);

  // Auto-generate on first render
  useEffect(() => {
    if (mode === 'auto' && !value) reGenerate();
  }, []); // eslint-disable-line

  const switchMode = (m) => {
    setMode(m);
    if (m === 'auto') reGenerate();
    else onChange('');
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-base-content/70">
          Password <span className="text-error">*</span>
        </label>
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-base-300">
          {['auto', 'manual'].map((m) => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${
                mode === m ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/50 hover:bg-base-300'
              }`}>
              {m === 'auto' ? '⚡ Auto' : '✏️ Manual'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'auto' ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 input-field bg-base-200/80 font-mono text-sm">
            <span className="text-primary font-black tracking-wide">{visible ? value : value?.replace(/./g, '•')}</span>
          </div>
          <button type="button" onClick={() => setVisible((v) => !v)}
            className="p-2.5 rounded-xl border border-base-300 hover:bg-base-200 transition-colors" title="Show/hide">
            <EyeOff size={15} className={visible ? 'text-primary' : 'text-base-content/40'} />
          </button>
          <button type="button" onClick={reGenerate}
            className="p-2.5 rounded-xl border border-base-300 hover:bg-base-200 transition-colors" title="Regenerate">
            <RefreshCcw size={15} className="text-base-content/60" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type={visible ? 'text' : 'password'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter a strong password..."
            className="input-field flex-1 text-sm"
          />
          <button type="button" onClick={() => setVisible((v) => !v)}
            className="p-2.5 rounded-xl border border-base-300 hover:bg-base-200 transition-colors">
            <EyeOff size={15} className={visible ? 'text-primary' : 'text-base-content/40'} />
          </button>
        </div>
      )}

      <p className="text-[10px] text-base-content/40">
        {mode === 'auto'
          ? 'Auto-generated passwords start with LKS and are unique to this account. This password will be emailed to the partner.'
          : 'Min 8 characters. Include uppercase, number and symbol for security.'}
      </p>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// §M  Platform Stats — Professional analytics dashboard
// ═════════════════════════════════════════════════════════════════════════════
const PlatformStats = () => {
  const dispatch = useDispatch();
  const { adminStats, loading } = useSelector((s) => s.transportPartner);

  // FIX: fetch only once on mount, not on every re-render
  useEffect(() => { dispatch(adminFetchTransportStats()); }, [dispatch]);

  const partnerStats = useMemo(() => adminStats?.partnerStats || [], [adminStats]);
  const driverStats  = useMemo(() => adminStats?.driverStats  || [], [adminStats]);
  const vehicleStats = useMemo(() => adminStats?.vehicleStats  || [], [adminStats]);

  const totalPartners = partnerStats.reduce((a, s) => a + (s.count || 0), 0);
  const totalVehicles = partnerStats.reduce((a, s) => a + (s.totalVehicles || 0), 0);
  const totalRides    = partnerStats.reduce((a, s) => a + (s.totalRides || 0), 0);
  const totalEarnings = partnerStats.reduce((a, s) => a + (s.totalEarnings || 0), 0);

  const activePartners    = partnerStats.find((s) => s._id === 'active')?.count || 0;
  const pendingPartners   = partnerStats.find((s) => s._id === 'pending')?.count || 0;
  const availableDrivers  = driverStats.find((s)  => s._id === 'Available')?.count || 0;
  const onTripDrivers     = driverStats.find((s)  => s._id === 'On-Trip')?.count || 0;
  const verifiedVehicles  = vehicleStats.find((s) => s._id === 'verified')?.count || 0;
  const pendingVehicles   = vehicleStats.find((s) => s._id === 'pending')?.count || 0;

  // Utilization gauge data
  const utilization = totalVehicles > 0 ? Math.round((onTripDrivers / totalVehicles) * 100) : 0;

  // Revenue breakdown per status for area chart
  const revenueByStatus = partnerStats.map((s) => ({
    name:     String(s._id),
    earnings: s.totalEarnings || 0,
    rides:    s.totalRides    || 0,
    vehicles: s.totalVehicles || 0,
  }));

  // Driver availability donut data
  const driverDonut = driverStats.map((d, i) => ({
    name:  String(d._id),
    value: d.count || 0,
    fill:  CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Vehicle verification bar data
  const vehicleBar = vehicleStats.map((v) => ({
    name:  String(v._id),
    count: v.count || 0,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-card p-3 shadow-xl text-xs">
        <p className="font-black text-base-content mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('earn')
              ? inr(p.value) : p.value.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  };

  if (loading && !adminStats) {
    return <div className="flex justify-center py-24"><span className="spinner" /></div>;
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <SectionHeader icon={BarChart2} title="Platform Analytics"
        subtitle="Real-time transport ecosystem overview"
        actions={
          <button onClick={() => dispatch(adminFetchTransportStats())}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Partners"     value={totalPartners}  sub={`${activePartners} active`}   color="var(--primary)"   />
        <StatCard icon={Car}       label="Fleet Vehicles"     value={totalVehicles}  sub={`${verifiedVehicles} verified`} color="var(--info)"    />
        <StatCard icon={Users}     label="Registered Drivers" value={driverStats.reduce((a, d) => a + d.count, 0)} sub={`${availableDrivers} available`} color="var(--success)" />
        <StatCard icon={Wallet}    label="Total Earnings"     value={inr(totalEarnings)} sub={`${totalRides.toLocaleString('en-IN')} rides`} color="var(--secondary)" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Partners',    val: activePartners,   icon: CheckCircle2, color: 'var(--success)' },
          { label: 'Pending Approval',   val: pendingPartners,  icon: Clock,        color: 'var(--warning)' },
          { label: 'On-Trip Now',        val: onTripDrivers,    icon: Truck,        color: 'var(--info)'    },
          { label: 'Vehicles Pending',   val: pendingVehicles,  icon: AlertTriangle,color: 'var(--error)'   },
        ].map(({ label, val, icon: Icon, color }) => (
          <motion.div key={label} variants={fadeUp}
            className="glass-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-black text-base-content">{val}</p>
              <p className="text-[10px] text-base-content/50 font-semibold">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue by Partner Status — Composed */}
        <motion.div variants={fadeUp} className="glass-card p-5 lg:col-span-2">
          <p className="text-sm font-black text-base-content mb-1">Revenue by Partner Status</p>
          <p className="text-[11px] text-base-content/40 mb-4">Earnings and ride volume across partnership states</p>
          {revenueByStatus.length === 0 ? (
            <p className="text-sm text-base-content/30 text-center py-12">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="rides" name="Rides" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey="earnings" name="Earnings (₹)" stroke={CHART_COLORS[2]} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS[2] }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Driver Status Donut */}
        <motion.div variants={fadeUp} className="glass-card p-5">
          <p className="text-sm font-black text-base-content mb-1">Driver Status</p>
          <p className="text-[11px] text-base-content/40 mb-4">Real-time availability breakdown</p>
          {driverDonut.length === 0 ? (
            <p className="text-sm text-base-content/30 text-center py-12">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={driverDonut} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85} paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}>
                  {driverDonut.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(val, name) => [val, name]} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {driverDonut.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-[10px] font-semibold text-base-content/60">
                <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Vehicle Verification Horizontal Bar */}
        <motion.div variants={fadeUp} className="glass-card p-5">
          <p className="text-sm font-black text-base-content mb-1">Vehicle Verification Pipeline</p>
          <p className="text-[11px] text-base-content/40 mb-4">Document verification funnel</p>
          {vehicleBar.length === 0 ? (
            <p className="text-sm text-base-content/30 text-center py-10">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={vehicleBar} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" strokeOpacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" name="Vehicles" radius={[0, 6, 6, 0]}>
                  {vehicleBar.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.name === 'verified'   ? '#10b981' :
                      entry.name === 'rejected'   ? '#ef4444' :
                      entry.name === 'pending'    ? '#f59e0b' : '#3b82f6'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* byType breakdown */}
          {vehicleStats.filter((vs) => Array.isArray(vs.byType) && vs.byType.length > 0).map((vs) => (
            <div key={vs._id} className="mt-3 flex items-start gap-2 flex-wrap">
              <StatusBadge status={vs._id} />
              {vs.byType.map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-base-200 rounded-full font-medium text-base-content/60">
                  {String(t)}
                </span>
              ))}
            </div>
          ))}
        </motion.div>

        {/* Fleet Utilization + Per-status breakdown */}
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
          <div>
            <p className="text-sm font-black text-base-content mb-1">Fleet Utilization</p>
            <p className="text-[11px] text-base-content/40">Active trips vs. total fleet capacity</p>
          </div>
          {/* Utilization bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-base-content/60 font-semibold">On-Trip</span>
              <span className="font-black text-base-content">{utilization}%</span>
            </div>
            <div className="h-3 bg-base-300 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${utilization}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-base-content/40">
              <span>{onTripDrivers} on-trip</span>
              <span>{totalVehicles} total vehicles</span>
            </div>
          </div>
          {/* Per-status summary */}
          <div className="space-y-2 pt-2">
            {partnerStats.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <StatusBadge status={s._id} />
                </div>
                <div className="flex gap-4 text-xs text-right">
                  <span className="text-base-content/50">{s.count} partners</span>
                  <span className="font-black text-base-content">{inr(s.totalEarnings)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// §I  Partner List
// FIX: fetch is stable — no re-fetch on unrelated state changes
// ═════════════════════════════════════════════════════════════════════════════
const PartnerList = ({ onSelectPartner }) => {
  const dispatch = useDispatch();
  const { adminPartners, adminPartnersTotal, loading } = useSelector((s) => s.transportPartner);

  const [search, setSearch]         = useState('');
  const [status, setStatus]         = useState('');
  const [page,   setPage]           = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const defaultForm = {
    name: '', email: '', phone: '', password: generatePassword(),
    businessName: '', ownerName: '', ownerPhone: '', ownerEmail: '',
    businessType: 'proprietorship', gstNumber: '', partnershipStatus: 'pending',
  };
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(() => {
    dispatch(adminFetchPartners({ page, limit: 15, search, status }));
  }, [dispatch, page, search, status]);

  // FIX: only fetch when deps actually change
  useEffect(() => { load(); }, [load]);

  const setF = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  const handleCreate = async () => {
    const res = await dispatch(adminCreatePartner(form));
    if (!res.error) {
      setShowCreate(false);
      setForm(defaultForm);
      load();
    }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      <SectionHeader icon={Building2} title="Transport Partners"
        subtitle={`${adminPartnersTotal || 0} total partners on platform`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-2">
            <Plus size={14} /> Add Partner
          </button>
        }
      />

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, phone..." className="input-field w-full pl-9 text-sm" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field text-sm">
          <option value="">All Status</option>
          {['pending', 'under-review', 'active', 'suspended', 'rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={load} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-300 bg-base-200/40">
                {['Business', 'Owner', 'Status', 'KYC', 'Drivers', 'Vehicles', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-base-content/50 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !adminPartners.length ? (
                <tr><td colSpan={7} className="py-16 text-center"><span className="spinner mx-auto" /></td></tr>
              ) : adminPartners.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-base-content/40 text-sm">No partners found</td></tr>
              ) : adminPartners.map((p) => (
                <tr key={p._id}
                  className="border-b border-base-300/40 hover:bg-base-200/50 transition-colors cursor-pointer"
                  onClick={() => onSelectPartner(p._id)}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-sm">{p.businessName}</p>
                    <p className="text-[10px] text-base-content/40 mt-0.5">{p.businessType}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{p.ownerName}</p>
                    <p className="text-[10px] text-base-content/40">{p.ownerPhone}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.partnershipStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={p.ownerKyc?.kycStatus || 'not-submitted'} /></td>
                  <td className="px-4 py-3 font-mono text-sm font-bold">{p.drivers?.length ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-sm font-bold">{p.vehicles?.length ?? 0}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onSelectPartner(p._id)}
                        className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors" title="View details">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)}
                        className="p-1.5 hover:bg-error/10 rounded-lg text-error transition-colors" title="Delete partner">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {adminPartnersTotal > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/50">
              Showing {Math.min((page - 1) * 15 + 1, adminPartnersTotal)}–{Math.min(page * 15, adminPartnersTotal)} of {adminPartnersTotal}
            </p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
              <button disabled={page * 15 >= adminPartnersTotal} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New Transport Partner" size="lg">
        <div className="space-y-6">
          {/* Account credentials section */}
          <div>
            <p className="text-xs font-black text-base-content/50 uppercase tracking-widest mb-3 pb-2 border-b border-base-300">
              Login Account
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required note="This becomes the account display name">
                <input type="text" value={form.name} onChange={setF('name')}
                  placeholder="e.g. Rajesh Kumar" className="input-field text-sm" />
              </Field>
              <Field label="Email Address" required note="Used for login and all notifications">
                <input type="email" value={form.email} onChange={setF('email')}
                  placeholder="rajesh@kumarfleet.in" className="input-field text-sm" />
              </Field>
              <Field label="Mobile Number" required note="10-digit Indian mobile number">
                <input type="tel" value={form.phone} onChange={setF('phone')}
                  placeholder="9876543210" className="input-field text-sm" />
              </Field>
              <div className="sm:col-span-1">
                <PasswordField value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
              </div>
            </div>
          </div>

          {/* Business details section */}
          <div>
            <p className="text-xs font-black text-base-content/50 uppercase tracking-widest mb-3 pb-2 border-b border-base-300">
              Business Information
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business Name" required note="Registered company / trade name">
                <input type="text" value={form.businessName} onChange={setF('businessName')}
                  placeholder="Kumar Fleet Services Pvt Ltd" className="input-field text-sm" />
              </Field>
              <Field label="Owner Name" required note="Legal name of proprietor / director">
                <input type="text" value={form.ownerName} onChange={setF('ownerName')}
                  placeholder="Rajesh Kumar" className="input-field text-sm" />
              </Field>
              <Field label="Owner Phone" note="Can be same as login number">
                <input type="tel" value={form.ownerPhone} onChange={setF('ownerPhone')}
                  placeholder="9876543210" className="input-field text-sm" />
              </Field>
              <Field label="Owner Email" note="Business contact email (can differ from login)">
                <input type="email" value={form.ownerEmail} onChange={setF('ownerEmail')}
                  placeholder="business@kumarfleet.in" className="input-field text-sm" />
              </Field>
              <Field label="GST Number" note="15-digit GSTIN, leave blank if exempt">
                <input type="text" value={form.gstNumber} onChange={setF('gstNumber')}
                  placeholder="29AAACC1234C1Z5" className="input-field text-sm" />
              </Field>
              <Field label="Business Type" note="Legal structure of the entity">
                <select value={form.businessType} onChange={setF('businessType')} className="input-field text-sm">
                  {['individual', 'proprietorship', 'partnership', 'pvt-ltd', 'ltd', 'llp'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Initial Partnership Status" note="Set to 'active' to skip approval flow">
                <select value={form.partnershipStatus} onChange={setF('partnershipStatus')} className="input-field text-sm">
                  {['pending', 'under-review', 'active'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-base-300">
          <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="btn-primary-cta text-xs px-6 py-2 flex items-center gap-2">
            {loading ? <span className="spinner w-4 h-4" /> : <Plus size={14} />} Create Partner & Send Email
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => dispatch(adminDeletePartner(deleteTarget?._id)).then(load)}
        title="Delete Partner"
        message={`Permanently delete "${deleteTarget?.businessName}"? All linked drivers will be unlinked. This cannot be undone.`}
        danger
      />
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// §I  Partner Detail
// FIX: fetch keyed by partnerId so returning to same partner shows cached data
// ═════════════════════════════════════════════════════════════════════════════
const PartnerDetail = ({ partnerId, onBack }) => {
  const dispatch = useDispatch();
  const { adminPartnerDetail: p, adminPartnerLogs, loading } = useSelector((s) => s.transportPartner);

  const [activeTab,   setActiveTab]   = useState('overview');
  const [statusModal, setStatusModal] = useState(false);
  const [kycModal,    setKycModal]    = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [feeModal,    setFeeModal]    = useState(false);
  const [settleModal, setSettleModal] = useState(false);
  const [notesModal,  setNotesModal]  = useState(false);

  const [statusForm, setStatusForm] = useState({ status: '', reason: '' });
  const [kycForm,    setKycForm]    = useState({ kycStatus: '', aadhaarVerified: false, panVerified: false, rejectionReason: '' });
  const [editForm,   setEditForm]   = useState({});
  const [feeForm,    setFeeForm]    = useState({ type: 'percentage', value: '', clear: false });
  const [settleAmt,  setSettleAmt]  = useState('');
  const [notes,      setNotes]      = useState('');

  // FIX: only fetch when partnerId changes
  useEffect(() => {
    if (!partnerId) return;
    dispatch(adminFetchPartnerById(partnerId));
    dispatch(adminFetchPartnerLogs({ partnerId, params: { limit: 20 } }));
  }, [dispatch, partnerId]);

  useEffect(() => {
    if (p) {
      setEditForm({
        businessName: p.businessName || '',
        ownerName:    p.ownerName    || '',
        ownerPhone:   p.ownerPhone   || '',
        ownerEmail:   p.ownerEmail   || '',
        gstNumber:    p.gstNumber    || '',
        isAvailable:  p.isAvailable  ?? true,
      });
      setNotes(p.internalNotes || '');
    }
  }, [p]);

  if (loading && !p) return <div className="flex justify-center py-20"><span className="spinner" /></div>;
  if (!p) return null;

  const refresh = () => dispatch(adminFetchPartnerById(p._id));

  const tabs = [
    { id: 'overview', label: 'Overview',  icon: Activity    },
    { id: 'kyc',      label: 'KYC',       icon: ShieldCheck },
    { id: 'vehicles', label: 'Vehicles',  icon: Car         },
    { id: 'drivers',  label: 'Drivers',   icon: Users       },
    { id: 'bank',     label: 'Bank',      icon: CreditCard  },
    { id: 'pricing',  label: 'Pricing',   icon: DollarSign  },
    { id: 'logs',     label: 'Logs',      icon: FileText    },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-wrap items-start gap-3">
        <button onClick={onBack} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 mt-1">
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-black text-base-content">{p.businessName}</h2>
          <p className="text-xs text-base-content/50 mt-0.5">{p.ownerName} · {p.ownerPhone} · {p.ownerEmail}</p>
        </div>
        <StatusBadge status={p.partnershipStatus} />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStatusModal(true)} className="btn-primary-cta text-xs px-3 py-2 flex items-center gap-1.5"><Settings size={13} /> Status</button>
          <button onClick={() => setEditModal(true)}   className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"><Edit3 size={13} /> Edit</button>
          <button onClick={() => setFeeModal(true)}    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"><Percent size={13} /> Fee</button>
          <button onClick={() => setSettleModal(true)} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"><DollarSign size={13} /> Settle</button>
          <button onClick={refresh}                    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"><RefreshCw size={13} /></button>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Car}    label="Vehicles"       value={p.vehicles?.length ?? 0} color="var(--info)"      />
        <StatCard icon={Users}  label="Drivers"        value={p.drivers?.length ?? 0}  color="var(--success)"   />
        <StatCard icon={Star}   label="Avg Rating"     value={p.rating?.averageRating ? p.rating.averageRating.toFixed(1) : '—'} color="var(--warning)" />
        <StatCard icon={Wallet} label="Pending Payout" value={inr(p.bankDetails?.pendingSettlementAmount)} color="var(--secondary)" />
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeUp} className="flex gap-1 overflow-x-auto pb-1 border-b border-base-300">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-b-2 -mb-px ${
              activeTab === id
                ? 'text-primary border-primary bg-primary/5'
                : 'text-base-content/60 border-transparent hover:bg-base-200'
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} variants={fadeIn} initial="hidden" animate="visible" exit="hidden">

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="glass-card p-5">
                <h3 className="text-sm font-black mb-4 flex items-center gap-2"><Building2 size={15} /> Business Details</h3>
                <InfoRow label="Business Type"  value={p.businessType} />
                <InfoRow label="GST Number"     value={p.gstNumber} />
                <InfoRow label="MSME / Udyam"   value={p.msmeUdyamNumber} />
                <InfoRow label="Partner Since"  value={p.partnerSince ? new Date(p.partnerSince).toLocaleDateString('en-IN') : null} />
                <InfoRow label="Settlement"     value={p.settlementCycle} />
                <InfoRow label="Onboarding"     value={p.isOnboardingComplete ? 'Complete ✅' : 'Incomplete ⏳'} />
                <InfoRow label="Available Now"  value={p.isAvailable ? 'Yes ✅' : 'No'} />
                <InfoRow label="Dispatch Ready" value={p.isDispatchReady ? 'Yes ✅' : 'No'} />
              </div>
              <div className="glass-card p-5">
                <h3 className="text-sm font-black mb-4 flex items-center gap-2"><Activity size={15} /> Performance</h3>
                <InfoRow label="Total Rides"      value={(p.stats?.totalRidesCompleted ?? 0).toLocaleString('en-IN')} />
                <InfoRow label="Cancelled"        value={p.stats?.totalRidesCancelled ?? 0} />
                <InfoRow label="Disputed"         value={p.stats?.totalRidesDisputed ?? 0} />
                <InfoRow label="Total Earnings"   value={inr(p.stats?.totalEarnings)} />
                <InfoRow label="Platform Fees"    value={inr(p.stats?.totalPlatformFeePaid)} />
                <InfoRow label="Avg Pickup Time"  value={`${p.stats?.averagePickupTimeMinutes ?? 0} min`} />
                <InfoRow label="On-Time Rate"     value={`${p.stats?.onTimeArrivalRate ?? 100}%`} />
                <InfoRow label="Last Ride"        value={p.stats?.lastRideAt ? new Date(p.stats.lastRideAt).toLocaleDateString('en-IN') : null} />
              </div>
              <div className="glass-card p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black flex items-center gap-2"><FileText size={15} /> Internal Notes</h3>
                  <button onClick={() => setNotesModal(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    <Edit3 size={12} /> Edit Notes
                  </button>
                </div>
                <p className="text-sm text-base-content/60 whitespace-pre-wrap leading-relaxed">
                  {p.internalNotes || 'No internal notes yet. Click "Edit Notes" to add one.'}
                </p>
              </div>
            </div>
          )}

          {/* KYC */}
          {activeTab === 'kyc' && (
            <div className="glass-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">Owner KYC Verification</h3>
                <button onClick={() => setKycModal(true)} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Update KYC
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <InfoCell label="KYC Status"    valueNode={<StatusBadge status={p.ownerKyc?.kycStatus} />} />
                <InfoCell label="Full Name"     value={p.ownerKyc?.fullName} />
                <InfoCell label="Gender"        value={p.ownerKyc?.gender} />
                <InfoCell label="Aadhaar"       value={p.ownerKyc?.aadhaarLast4 ? `XXXX XXXX ${p.ownerKyc.aadhaarLast4}` : null} />
                <InfoCell label="KYC Verified"  value={p.ownerKyc?.kycVerifiedAt ? new Date(p.ownerKyc.kycVerifiedAt).toLocaleDateString('en-IN') : null} />
                <InfoCell label="Aadhaar Verif" value={p.ownerKyc?.aadhaarVerified ? '✅ Yes' : '❌ No'} />
                <InfoCell label="PAN Verified"  value={p.ownerKyc?.panVerified ? '✅ Yes' : '❌ No'} />
                <InfoCell label="Experience"    value={`${p.ownerKyc?.yearsOfExperience ?? 0} yrs`} />
                <InfoCell label="Languages"     value={p.ownerKyc?.languagesSpoken?.join(', ')} />
                <InfoCell label="Rejection"     value={p.ownerKyc?.kycRejectionReason} />
              </div>
              {/* Doc links */}
              <div className="flex flex-wrap gap-3">
                {[
                  ['Aadhaar Front',   p.ownerKyc?.aadhaarFrontUrl],
                  ['Aadhaar Back',    p.ownerKyc?.aadhaarBackUrl],
                  ['PAN Card',        p.ownerKyc?.panCardUrl],
                  ['Driving Licence', p.ownerKyc?.drivingLicenseUrl],
                ].filter(([, url]) => url).map(([label, url]) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline px-3 py-2 bg-primary/8 rounded-lg transition-colors">
                    <ExternalLink size={12} /> {label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles */}
          {activeTab === 'vehicles' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-black">Fleet Vehicles ({p.vehicles?.length ?? 0})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(p.vehicles || []).map((v) => (
                  <div key={v._id} className="p-4 bg-base-200/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-sm">{v.registrationNumber}</p>
                      <StatusBadge status={v.verificationStatus} />
                    </div>
                    <p className="text-xs text-base-content/60">
                      {v.make} {v.model} · {v.vehicleType} · {v.year} · {v.color}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {v.isWheelchairAccessible && <span className="badge badge-info text-[10px]">♿ Accessible</span>}
                      {v.hasAC                  && <span className="badge badge-primary text-[10px]">❄ AC</span>}
                      {v.hasMedicalKit          && <span className="badge badge-success text-[10px]">🏥 Medical</span>}
                      {v.hasOxygenSupport       && <span className="badge badge-warning text-[10px]">🫁 O₂</span>}
                      {v.hasStretcherSupport    && <span className="badge badge-error text-[10px]">🛏 Stretcher</span>}
                    </div>
                    {v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date() && (
                      <p className="text-[10px] text-error font-bold flex items-center gap-1">
                        <AlertTriangle size={10} /> Insurance expired
                      </p>
                    )}
                    {['pending', 'under-review'].includes(v.verificationStatus) && (
                      <div className="flex gap-2">
                        <button onClick={() => dispatch(adminVerifyVehicle({ partnerId: p._id, vehicleId: v._id, verificationStatus: 'verified' })).then(refresh)}
                          className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1 text-success border-success flex-1 justify-center">
                          <CheckCircle2 size={11} /> Verify
                        </button>
                        <button onClick={() => dispatch(adminVerifyVehicle({ partnerId: p._id, vehicleId: v._id, verificationStatus: 'rejected', rejectionReason: 'Docs invalid' })).then(refresh)}
                          className="text-[10px] px-3 py-1.5 flex items-center gap-1 rounded-lg border border-error text-error hover:bg-error/10 font-bold flex-1 justify-center">
                          <XCircle size={11} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!p.vehicles?.length && (
                  <p className="text-sm text-base-content/40 col-span-2">No vehicles registered yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Drivers */}
          {activeTab === 'drivers' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-black">Linked Drivers ({p.drivers?.length ?? 0})</h3>
              <div className="space-y-2">
                {(p.drivers || []).map((d) => (
                  <div key={d._id || String(d)} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">{d.legalName || (typeof d === 'string' ? d : d._id)}</p>
                      <p className="text-xs text-base-content/40">{d.driverCode} · KYC: {d.kyc?.verificationStatus || '—'}</p>
                    </div>
                    {d.status && <StatusBadge status={d.status} />}
                  </div>
                ))}
                {!p.drivers?.length && <p className="text-sm text-base-content/40">No drivers linked to this agency.</p>}
              </div>
            </div>
          )}

          {/* Bank */}
          {activeTab === 'bank' && (
            <div className="glass-card p-5 space-y-5">
              <h3 className="text-sm font-black">Bank & Settlement Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-warning/8 border border-warning/20 rounded-xl">
                  <p className="text-[10px] font-black text-warning/80 uppercase tracking-widest">Pending Settlement</p>
                  <p className="text-2xl font-black text-warning">{inr(p.bankDetails?.pendingSettlementAmount)}</p>
                </div>
                <div className="p-4 bg-success/8 border border-success/20 rounded-xl">
                  <p className="text-[10px] font-black text-success/80 uppercase tracking-widest">Total Settled</p>
                  <p className="text-2xl font-black text-success">{inr(p.bankDetails?.totalSettledAmount)}</p>
                </div>
                <div className="p-4 bg-base-200/60 rounded-xl">
                  <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest">Preferred Method</p>
                  <p className="text-sm font-black">{p.bankDetails?.preferredSettlementMethod || '—'}</p>
                </div>
              </div>

              {/* Bank Accounts */}
              {(p.bankDetails?.bankAccounts || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-base-content/50 uppercase tracking-widest">Bank Accounts</h4>
                  {p.bankDetails.bankAccounts.map((a) => (
                    <div key={a._id} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm">{a.accountHolderName}</p>
                        <p className="text-xs text-base-content/40">{a.bankName} · ****{a.accountLast4} · {a.accountType}</p>
                        {a.ifscCode && <p className="text-[10px] text-base-content/30">IFSC: {a.ifscCode}</p>}
                      </div>
                      <div className="flex gap-2">
                        {a.isPrimary  && <span className="badge badge-primary text-[10px]">Primary</span>}
                        {a.isVerified && <span className="badge badge-success text-[10px]">Verified</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* UPI */}
              {(p.bankDetails?.upiHandles || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-base-content/50 uppercase tracking-widest">UPI Handles</h4>
                  {p.bankDetails.upiHandles.map((u) => (
                    <div key={u._id} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm">{u.upiId}</p>
                        <p className="text-xs text-base-content/40">{u.upiName}</p>
                      </div>
                      <div className="flex gap-2">
                        {u.isPrimary  && <span className="badge badge-primary text-[10px]">Primary</span>}
                        {u.isVerified && <span className="badge badge-success text-[10px]">Verified</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pricing */}
          {activeTab === 'pricing' && (
            <div className="glass-card p-5 space-y-5">
              <h3 className="text-sm font-black">Partner Pricing Configuration</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Base Fare',    inr(p.pricing?.baseFare ?? 0)],
                  ['Per KM',       inr(p.pricing?.baseFarePerKm ?? 0)],
                  ['Min Fare',     inr(p.pricing?.minimumFare ?? 0)],
                  ['Wait/min',     inr(p.pricing?.waitingChargePerMin ?? 0)],
                  ['Free Wait',    `${p.pricing?.freeWaitingMinutes ?? 0} min`],
                  ['Night Sur.',   `${p.pricing?.nightSurchargePercent ?? 0}%`],
                  ['WC Sur.',      inr(p.pricing?.wheelchairSurcharge ?? 0)],
                  ['Currency',     String(p.pricing?.currency || 'INR')],
                ].map(([k, v]) => (
                  <div key={k} className="p-3 bg-base-200/50 rounded-xl">
                    <p className="text-[10px] font-black text-base-content/40 uppercase tracking-wider">{k}</p>
                    <p className="text-sm font-black mt-1">{String(v)}</p>
                  </div>
                ))}
              </div>

              {/* Platform Fee Override */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-primary/70 uppercase tracking-widest mb-1">Platform Fee Override</p>
                  <p className="text-lg font-black text-base-content">{formatFee(p.platformFeeOverride)}</p>
                  {p.platformFeeOverride && (
                    <p className="text-[10px] text-base-content/40 mt-0.5">
                      Type: {String(p.platformFeeOverride.type)} · Value: {String(p.platformFeeOverride.value)}
                    </p>
                  )}
                </div>
                <button onClick={() => setFeeModal(true)} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
                  <Edit3 size={12} /> Change
                </button>
              </div>

              {p.effectivePlatformFee && (
                <div className="p-3 bg-success/8 border border-success/20 rounded-xl">
                  <p className="text-xs font-bold text-success/80">Effective Platform Fee (applied to all rides)</p>
                  <p className="text-sm font-black text-success">{formatFee(p.effectivePlatformFee)}</p>
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          {activeTab === 'logs' && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-black">Recent Activity Logs</h3>
              {adminPartnerLogs.length === 0 ? (
                <p className="text-sm text-base-content/40 py-6 text-center">No logs found for this partner.</p>
              ) : adminPartnerLogs.map((log) => (
                <div key={log._id} className="flex items-start gap-3 p-3 bg-base-200/50 rounded-xl">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    log.level === 'success' ? 'bg-success' :
                    log.level === 'warning' ? 'bg-warning' :
                    log.level === 'error'   ? 'bg-error'   : 'bg-info'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{log.message}</p>
                    <p className="text-[10px] text-base-content/40 mt-0.5">
                      {log.category} · {new Date(log.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Modals ── */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change Partnership Status" size="sm">
        <div className="space-y-4">
          <Field label="New Status" required note="Changing to 'active' triggers email notification to partner">
            <select value={statusForm.status} onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))} className="input-field text-sm">
              <option value="">Select a status...</option>
              {['pending', 'under-review', 'active', 'suspended', 'rejected'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason" note="Required for suspend / reject — included in notification email">
            <input type="text" value={statusForm.reason}
              onChange={(e) => setStatusForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Document mismatch found" className="input-field text-sm" />
          </Field>
          <div className="flex justify-end gap-3">
            <button onClick={() => setStatusModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
            <button onClick={async () => {
              await dispatch(adminUpdatePartnerStatus({ partnerId: p._id, ...statusForm }));
              refresh(); setStatusModal(false);
            }} className="btn-primary-cta text-xs px-4 py-2">Update Status</button>
          </div>
        </div>
      </Modal>

      <Modal open={kycModal} onClose={() => setKycModal(false)} title="Update Owner KYC" size="sm">
        <div className="space-y-4">
          <Field label="KYC Status" note="Set to 'verified' to activate document approval">
            <select value={kycForm.kycStatus} onChange={(e) => setKycForm((f) => ({ ...f, kycStatus: e.target.value }))} className="input-field text-sm">
              <option value="">Select...</option>
              {['not-submitted', 'pending', 'under-review', 'verified', 'rejected'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={kycForm.aadhaarVerified} onChange={(e) => setKycForm((f) => ({ ...f, aadhaarVerified: e.target.checked }))} className="w-4 h-4 accent-primary" />
              Aadhaar Verified
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={kycForm.panVerified} onChange={(e) => setKycForm((f) => ({ ...f, panVerified: e.target.checked }))} className="w-4 h-4 accent-primary" />
              PAN Verified
            </label>
          </div>
          {kycForm.kycStatus === 'rejected' && (
            <Field label="Rejection Reason" required note="This will be shown to the partner">
              <input type="text" value={kycForm.rejectionReason}
                onChange={(e) => setKycForm((f) => ({ ...f, rejectionReason: e.target.value }))}
                placeholder="e.g. Blurry document, name mismatch" className="input-field text-sm" />
            </Field>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setKycModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
            <button onClick={async () => {
              await dispatch(adminUpdatePartnerKyc({ partnerId: p._id, ...kycForm }));
              refresh(); setKycModal(false);
            }} className="btn-primary-cta text-xs px-4 py-2">Update KYC</button>
          </div>
        </div>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Partner Details" size="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name" required note="Legal / registered trade name">
            <input type="text" value={editForm.businessName || ''} onChange={(e) => setEditForm((f) => ({ ...f, businessName: e.target.value }))}
              placeholder="Kumar Fleet Services Pvt Ltd" className="input-field text-sm" />
          </Field>
          <Field label="Owner Name" note="Proprietor or authorised signatory">
            <input type="text" value={editForm.ownerName || ''} onChange={(e) => setEditForm((f) => ({ ...f, ownerName: e.target.value }))}
              placeholder="Rajesh Kumar" className="input-field text-sm" />
          </Field>
          <Field label="Owner Phone" note="Primary contact number">
            <input type="tel" value={editForm.ownerPhone || ''} onChange={(e) => setEditForm((f) => ({ ...f, ownerPhone: e.target.value }))}
              placeholder="9876543210" className="input-field text-sm" />
          </Field>
          <Field label="Owner Email" note="Business contact email">
            <input type="email" value={editForm.ownerEmail || ''} onChange={(e) => setEditForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              placeholder="business@fleet.in" className="input-field text-sm" />
          </Field>
          <Field label="GST Number" note="15-digit GSTIN, leave blank if exempt">
            <input type="text" value={editForm.gstNumber || ''} onChange={(e) => setEditForm((f) => ({ ...f, gstNumber: e.target.value }))}
              placeholder="29AAACC1234C1Z5" className="input-field text-sm" />
          </Field>
          <Field label="Available for Rides" note="Toggle partner availability on platform">
            <select value={editForm.isAvailable ? 'true' : 'false'}
              onChange={(e) => setEditForm((f) => ({ ...f, isAvailable: e.target.value === 'true' }))} className="input-field text-sm">
              <option value="true">Yes — accepting rides</option>
              <option value="false">No — paused</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setEditModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
          <button onClick={async () => {
            await dispatch(adminUpdatePartner({ partnerId: p._id, data: editForm }));
            refresh(); setEditModal(false);
          }} className="btn-primary-cta text-xs px-4 py-2">Save Changes</button>
        </div>
      </Modal>

      <Modal open={feeModal} onClose={() => setFeeModal(false)} title="Platform Fee Override" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-info/8 border border-info/20 rounded-xl text-xs text-base-content/70">
            <p className="font-bold mb-1">Current fee</p>
            <p>{formatFee(p.platformFeeOverride)}</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={feeForm.clear}
              onChange={(e) => setFeeForm((f) => ({ ...f, clear: e.target.checked }))} className="w-4 h-4 accent-primary" />
            Clear override — revert to global platform default
          </label>
          {!feeForm.clear && (
            <>
              <Field label="Fee Type" note="Percentage of fare or flat rupee amount per ride">
                <select value={feeForm.type} onChange={(e) => setFeeForm((f) => ({ ...f, type: e.target.value }))} className="input-field text-sm">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </Field>
              <Field label="Value" required note={feeForm.type === 'percentage' ? 'Enter a % value e.g. 12 for 12%' : 'Enter rupee amount e.g. 50 for ₹50 flat'}>
                <input type="number" min={0} value={feeForm.value}
                  onChange={(e) => setFeeForm((f) => ({ ...f, value: +e.target.value }))}
                  placeholder={feeForm.type === 'percentage' ? '12' : '50'} className="input-field text-sm" />
              </Field>
            </>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setFeeModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
            <button onClick={async () => {
              await dispatch(adminSetPartnerPlatformFee({ partnerId: p._id, ...feeForm }));
              refresh(); setFeeModal(false);
            }} className="btn-primary-cta text-xs px-4 py-2">Apply Override</button>
          </div>
        </div>
      </Modal>

      <Modal open={settleModal} onClose={() => setSettleModal(false)} title="Process Settlement" size="sm">
        <div className="space-y-4">
          <div className="p-4 bg-warning/8 border border-warning/20 rounded-xl">
            <p className="text-xs text-base-content/60">Pending settlement balance</p>
            <p className="text-2xl font-black text-warning">{inr(p.bankDetails?.pendingSettlementAmount)}</p>
          </div>
          <Field label="Amount to Settle (₹)" required note="Cannot exceed pending balance. Will be transferred to primary bank account.">
            <input type="number" min={1} max={p.bankDetails?.pendingSettlementAmount || 0}
              value={settleAmt} onChange={(e) => setSettleAmt(e.target.value)}
              placeholder="Enter amount in ₹" className="input-field text-sm" />
          </Field>
          <div className="flex justify-end gap-3">
            <button onClick={() => setSettleModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
            <button onClick={async () => {
              await dispatch(adminProcessPartnerSettlement({ partnerId: p._id, amount: +settleAmt }));
              refresh(); setSettleModal(false); setSettleAmt('');
            }} className="btn-success text-xs px-4 py-2">Process Payment</button>
          </div>
        </div>
      </Modal>

      <Modal open={notesModal} onClose={() => setNotesModal(false)} title="Internal Notes" size="sm">
        <Field label="Admin Notes" note="Visible only to admins — not shown to the partner">
          <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Partner onboarded via referral. Pending GST certificate upload as of Mar 2025."
            className="input-field text-sm resize-none" />
        </Field>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setNotesModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
          <button onClick={async () => {
            await dispatch(adminUpdatePartnerNotes({ partnerId: p._id, notes }));
            setNotesModal(false);
          }} className="btn-primary-cta text-xs px-4 py-2">Save Notes</button>
        </div>
      </Modal>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// §J  Pending Vehicles
// ═════════════════════════════════════════════════════════════════════════════
const PendingVehicles = () => {
  const dispatch = useDispatch();
  const { pendingVehicles, loading } = useSelector((s) => s.transportPartner);
  const [rejectModal,  setRejectModal]  = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // FIX: stable fetch on mount only
  useEffect(() => { dispatch(adminFetchPendingVehicles()); }, [dispatch]);

  const doVerify = (item, status, reason) =>
    dispatch(adminVerifyVehicle({ partnerId: item._id, vehicleId: item.vehicle?._id, verificationStatus: status, rejectionReason: reason }))
      .then(() => dispatch(adminFetchPendingVehicles()));

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      <SectionHeader icon={Car} title="Pending Vehicle Verification"
        subtitle={`${pendingVehicles.length} vehicles awaiting review`}
        actions={
          <button onClick={() => dispatch(adminFetchPendingVehicles())} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {loading && !pendingVehicles.length ? (
        <div className="flex justify-center py-20"><span className="spinner" /></div>
      ) : pendingVehicles.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-16 text-center">
          <CheckCircle2 size={44} className="mx-auto mb-3 text-success" />
          <p className="font-black text-base-content mb-1">All clear!</p>
          <p className="text-sm text-base-content/40">No vehicles pending verification.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingVehicles.map((item, i) => (
            <motion.div key={i} variants={fadeUp} className="glass-card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black text-sm">{item.vehicle?.registrationNumber}</p>
                  <p className="text-xs text-base-content/50">{item.businessName}</p>
                  <p className="text-[10px] text-base-content/40">{item.ownerPhone}</p>
                </div>
                <StatusBadge status={item.vehicle?.verificationStatus} />
              </div>
              <div className="text-xs text-base-content/60 space-y-1">
                <p><strong>{item.vehicle?.make} {item.vehicle?.model}</strong> · {item.vehicle?.vehicleType}</p>
                <p>Year: {item.vehicle?.year || '—'} · Color: {item.vehicle?.color || '—'} · Seats: {item.vehicle?.seatingCapacity}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[['RC Book', item.vehicle?.rcBookUrl], ['Insurance', item.vehicle?.insurancePolicyUrl], ['Fitness Cert', item.vehicle?.fitnessCertUrl]]
                  .filter(([, u]) => u).map(([label, url]) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer"
                    className="text-[10px] px-2.5 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 flex items-center gap-1">
                    <ExternalLink size={10} /> {label}
                  </a>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => doVerify(item, 'verified', '')}
                  className="btn-secondary text-[10px] px-3 py-2 flex-1 flex items-center justify-center gap-1 text-success border-success">
                  <CheckCircle2 size={12} /> Approve
                </button>
                <button onClick={() => setRejectModal(item)}
                  className="text-[10px] px-3 py-2 flex-1 rounded-lg border border-error text-error hover:bg-error/10 flex items-center justify-center gap-1 font-bold">
                  <XCircle size={12} /> Reject
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!rejectModal} onClose={() => { setRejectModal(null); setRejectReason(''); }} title="Reject Vehicle" size="sm">
        <Field label="Rejection Reason" required note="This message will be visible to the transport partner">
          <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. RC document expired. Please upload a valid RC book." className="input-field text-sm resize-none" />
        </Field>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="btn-secondary text-xs px-4 py-2">Cancel</button>
          <button onClick={() => { doVerify(rejectModal, 'rejected', rejectReason); setRejectModal(null); setRejectReason(''); }}
            style={{ background: 'var(--error)' }} className="btn-primary-cta text-xs px-4 py-2">Reject Vehicle</button>
        </div>
      </Modal>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// §K  Platform Drivers
// FIX: fetchAllDrivers keyed by deps; detail panel stays when switching rows
// ═════════════════════════════════════════════════════════════════════════════
const PlatformDrivers = () => {
  const dispatch = useDispatch();
  const {
    adminDrivers, adminDriversTotal, adminDriverDetail,
    adminAvailableDrivers, adminDriverLogs, loading,
  } = useSelector((s) => s.transportPartner);

  const [search,      setSearch]     = useState('');
  const [kycStatus,   setKycStatus]  = useState('');
  const [page,        setPage]       = useState(1);
  const [selectedId,  setSelectedId] = useState(null);

  // Modals
  const [coinsModal,  setCoinsModal]  = useState(false);
  const [notesModal,  setNotesModal]  = useState(false);
  const [blockModal,  setBlockModal]  = useState(false);
  const [kycModal,    setKycModal]    = useState(false);
  const [geoModal,    setGeoModal]    = useState(false);

  const [coinsForm,   setCoinsForm]   = useState({ type: 'ADMIN_CREDIT', amount: '', description: '' });
  const [notesVal,    setNotesVal]    = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [kycForm,     setKycForm]     = useState({ verificationStatus: '', rejectionReason: '' });
  const [geoForm,     setGeoForm]     = useState({ lng: '', lat: '', radius: 10000 });

  const load = useCallback(() => {
    dispatch(adminFetchAllDrivers({ page, limit: 15, search, kycStatus }));
  }, [dispatch, page, search, kycStatus]);

  // FIX: stable dep-keyed fetch
  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback((id) => {
    setSelectedId(id);
    dispatch(adminFetchDriverById(id));
    dispatch(adminFetchDriverLogs({ driverId: id, params: { limit: 10 } }));
  }, [dispatch]);

  const refreshDetail = () => selectedId && dispatch(adminFetchDriverById(selectedId));
  const d = adminDriverDetail;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      <SectionHeader icon={Users} title="All Drivers"
        subtitle={`${adminDriversTotal} drivers registered platform-wide`}
        actions={
          <button onClick={() => setGeoModal(true)} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <Navigation size={13} /> Find Nearby
          </button>
        }
      />

      <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, code, email, phone..." className="input-field w-full pl-9 text-sm" />
        </div>
        <select value={kycStatus} onChange={(e) => { setKycStatus(e.target.value); setPage(1); }} className="input-field text-sm">
          <option value="">All KYC Status</option>
          {['Pending', 'Under-Review', 'Verified', 'Rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={load} className="btn-secondary text-xs px-3 py-2"><RefreshCw size={13} /></button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Driver table */}
        <motion.div variants={fadeUp} className="lg:col-span-2 glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-300 bg-base-200/40">
                  {['Driver', 'Agency', 'Status', 'KYC', 'Rating', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-base-content/50 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !adminDrivers.length ? (
                  <tr><td colSpan={6} className="py-12 text-center"><span className="spinner mx-auto" /></td></tr>
                ) : adminDrivers.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-base-content/40 text-sm">No drivers found</td></tr>
                ) : adminDrivers.map((dr) => (
                  <tr key={dr._id}
                    className={`border-b border-base-300/40 hover:bg-base-200/50 cursor-pointer transition-colors ${selectedId === dr._id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                    onClick={() => openDetail(dr._id)}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-sm">{dr.legalName}</p>
                      <p className="text-[10px] text-base-content/40 font-mono">{dr.driverCode}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-base-content/60">{dr.ownerAgency?.businessName || 'Solo'}</td>
                    <td className="px-4 py-3"><StatusBadge status={dr.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={dr.kyc?.verificationStatus} /></td>
                    <td className="px-4 py-3 font-mono text-sm">⭐ {dr.performance?.rating ? dr.performance.rating.toFixed(1) : '—'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => openDetail(dr._id)} className="p-1.5 hover:bg-primary/10 rounded-lg text-primary"><Eye size={13} /></button>
                        {dr.isBlocked
                          ? <button onClick={() => dispatch(adminUnblockDriver(dr._id)).then(load)} className="p-1.5 hover:bg-success/10 rounded-lg text-success"><UserCheck size={13} /></button>
                          : <button onClick={() => { openDetail(dr._id); setBlockModal(true); }} className="p-1.5 hover:bg-error/10 rounded-lg text-error"><UserX size={13} /></button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {adminDriversTotal > 15 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
              <p className="text-xs text-base-content/50">
                {Math.min((page - 1) * 15 + 1, adminDriversTotal)}–{Math.min(page * 15, adminDriversTotal)} of {adminDriversTotal}
              </p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
                <button disabled={page * 15 >= adminDriversTotal} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Detail panel */}
        <AnimatePresence>
          {d && selectedId && (
            <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
              className="glass-card p-5 space-y-4 self-start lg:sticky lg:top-4">
              <div className="flex items-center gap-3">
                {d.user?.avatar
                  ? <img src={d.user.avatar} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-primary/20" />
                  : <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center text-lg font-black">{(d.legalName || 'D')[0]}</div>
                }
                <div>
                  <p className="font-black text-sm">{d.legalName}</p>
                  <p className="text-[10px] text-base-content/40 font-mono">{d.driverCode}</p>
                  <p className="text-[10px] text-base-content/40">{d.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Status',  null, <StatusBadge key="s" status={d.status} />],
                  ['KYC',     null, <StatusBadge key="k" status={d.kyc?.verificationStatus} />],
                  ['Rides',   (d.performance?.totalRidesCompleted ?? 0).toLocaleString()],
                  ['Rating',  `⭐ ${d.performance?.rating ? d.performance.rating.toFixed(1) : '—'}`],
                  ['Coins',   d.rewards?.coinBalance ?? 0],
                  ['Tier',    d.rewards?.tier ?? '—'],
                ].map(([k, v, node]) => (
                  <div key={k} className="p-2 bg-base-200/50 rounded-lg">
                    <p className="text-[9px] text-base-content/40 uppercase tracking-wide font-bold">{k}</p>
                    {node ?? <p className="font-bold">{safeVal(v)}</p>}
                  </div>
                ))}
              </div>

              {d.isBlocked && (
                <div className="p-2 bg-error/10 border border-error/20 rounded-lg">
                  <p className="text-xs text-error font-bold">🚫 Blocked</p>
                  <p className="text-[10px] text-error/70">{d.blockReason}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setKycModal(true)} className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1"><ShieldCheck size={11} /> KYC</button>
                <button onClick={() => setCoinsModal(true)} className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1"><Coins size={11} /> Coins</button>
                <button onClick={() => setNotesModal(true)} className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1"><FileText size={11} /> Notes</button>
                {d.isBlocked
                  ? <button onClick={() => dispatch(adminUnblockDriver(d._id)).then(refreshDetail)}
                      className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1 text-success"><UserCheck size={11} /> Unblock</button>
                  : <button onClick={() => setBlockModal(true)}
                      className="text-[10px] px-3 py-1.5 flex items-center gap-1 rounded-lg border border-error text-error hover:bg-error/10 font-bold"><Ban size={11} /> Block</button>
                }
              </div>

              {adminDriverLogs.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2">Recent Activity</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {adminDriverLogs.map((log) => (
                      <div key={log._id} className="text-[11px] p-2 bg-base-200/50 rounded-lg">
                        <p className="font-semibold leading-tight">{log.message}</p>
                        <p className="text-base-content/40 mt-0.5">{new Date(log.createdAt).toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nearby drivers result */}
      {adminAvailableDrivers.length > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-black">Nearest Available Drivers ({adminAvailableDrivers.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {adminAvailableDrivers.map((dr) => (
              <div key={dr._id} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                <div>
                  <p className="font-semibold text-sm">{dr.legalName}</p>
                  <p className="text-xs text-base-content/40">{dr.driverCode}</p>
                </div>
                <StatusBadge status={dr.status} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Modals */}
      <Modal open={geoModal} onClose={() => setGeoModal(false)} title="Find Nearest Available Drivers" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Longitude" required note="e.g. 80.2707 for Chennai">
              <input type="number" step="0.0001" value={geoForm.lng} onChange={(e) => setGeoForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="80.2707" className="input-field text-sm" />
            </Field>
            <Field label="Latitude" required note="e.g. 13.0827 for Chennai">
              <input type="number" step="0.0001" value={geoForm.lat} onChange={(e) => setGeoForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="13.0827" className="input-field text-sm" />
            </Field>
          </div>
          <Field label="Search Radius (meters)" note="Default 10 km = 10000 meters">
            <input type="number" value={geoForm.radius} onChange={(e) => setGeoForm((f) => ({ ...f, radius: +e.target.value }))}
              placeholder="10000" className="input-field text-sm" />
          </Field>
          <button onClick={() => { dispatch(adminFetchAvailableDrivers({ lng: +geoForm.lng, lat: +geoForm.lat, radius: geoForm.radius })); setGeoModal(false); }}
            className="btn-primary-cta text-xs px-6 py-2 w-full">Search Nearby Drivers</button>
        </div>
      </Modal>

      <Modal open={blockModal} onClose={() => { setBlockModal(false); setBlockReason(''); }} title="Block Driver" size="sm">
        <Field label="Block Reason" required note="Driver will be notified. They cannot accept rides while blocked.">
          <textarea rows={3} value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
            placeholder="e.g. Multiple passenger complaints — pending investigation." className="input-field text-sm resize-none" />
        </Field>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => { setBlockModal(false); setBlockReason(''); }} className="btn-secondary text-xs px-4 py-2">Cancel</button>
          <button onClick={async () => {
            await dispatch(adminBlockDriver({ driverId: selectedId, blockReason }));
            refreshDetail(); load(); setBlockModal(false); setBlockReason('');
          }} style={{ background: 'var(--error)' }} className="btn-primary-cta text-xs px-4 py-2">Block Driver</button>
        </div>
      </Modal>

      <Modal open={coinsModal} onClose={() => setCoinsModal(false)} title="Adjust Driver Coin Balance" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-base-200/60 rounded-xl text-sm">
            Current balance: <strong>{d?.rewards?.coinBalance ?? 0} coins</strong>
          </div>
          <Field label="Transaction Type" note="Credits add coins, debits remove them">
            <select value={coinsForm.type} onChange={(e) => setCoinsForm((f) => ({ ...f, type: e.target.value }))} className="input-field text-sm">
              <option value="ADMIN_CREDIT">Credit — Add coins</option>
              <option value="ADMIN_DEBIT">Debit — Remove coins</option>
            </select>
          </Field>
          <Field label="Amount (coins)" required note="Must be a positive whole number">
            <input type="number" min={1} value={coinsForm.amount}
              onChange={(e) => setCoinsForm((f) => ({ ...f, amount: +e.target.value }))}
              placeholder="e.g. 100" className="input-field text-sm" />
          </Field>
          <Field label="Description" note="Shown in driver's transaction history">
            <input type="text" value={coinsForm.description}
              onChange={(e) => setCoinsForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Monthly performance bonus" className="input-field text-sm" />
          </Field>
          <div className="flex justify-end gap-3">
            <button onClick={() => setCoinsModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
            <button onClick={async () => {
              await dispatch(adminAdjustDriverCoins({ driverId: selectedId, ...coinsForm }));
              refreshDetail(); setCoinsModal(false);
            }} className="btn-primary-cta text-xs px-4 py-2">Apply</button>
          </div>
        </div>
      </Modal>

      <Modal open={kycModal} onClose={() => setKycModal(false)} title="Verify Driver KYC" size="sm">
        <div className="space-y-4">
          <Field label="Verification Status" note="Set to 'Verified' to activate the driver account">
            <select value={kycForm.verificationStatus} onChange={(e) => setKycForm((f) => ({ ...f, verificationStatus: e.target.value }))} className="input-field text-sm">
              <option value="">Select...</option>
              {['Pending', 'Under-Review', 'Verified', 'Rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {kycForm.verificationStatus === 'Rejected' && (
            <Field label="Rejection Reason" required note="Driver will see this reason">
              <input type="text" value={kycForm.rejectionReason}
                onChange={(e) => setKycForm((f) => ({ ...f, rejectionReason: e.target.value }))}
                placeholder="e.g. Expired driving licence. Please upload a valid copy." className="input-field text-sm" />
            </Field>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setKycModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
            <button onClick={async () => {
              await dispatch(adminVerifyDriverKyc({ driverId: selectedId, ...kycForm }));
              refreshDetail(); setKycModal(false);
            }} className="btn-primary-cta text-xs px-4 py-2">Update KYC</button>
          </div>
        </div>
      </Modal>

      <Modal open={notesModal} onClose={() => setNotesModal(false)} title="Admin Notes for Driver" size="sm">
        <Field label="Notes" note="Internal only — not visible to driver or transport partner">
          <textarea rows={4} value={notesVal} onChange={(e) => setNotesVal(e.target.value)}
            placeholder="e.g. Driver flagged for late check-in on 3 occasions. Monitor for 30 days." className="input-field text-sm resize-none" />
        </Field>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setNotesModal(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
          <button onClick={async () => {
            await dispatch(adminUpdateDriverNotes({ driverId: selectedId, notes: notesVal }));
            setNotesModal(false);
          }} className="btn-primary-cta text-xs px-4 py-2">Save Notes</button>
        </div>
      </Modal>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// §L  Global Pricing
// FIX: platformFee is object — flattened for form, re-composed on save
// ═════════════════════════════════════════════════════════════════════════════
const GlobalPricing = () => {
  const dispatch = useDispatch();
  const { globalPricing, loading } = useSelector((s) => s.transportPartner);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [note, setNote] = useState('');

  // FIX: fetch only on mount
  useEffect(() => { dispatch(adminFetchGlobalPricing()); }, [dispatch]);

  useEffect(() => {
    if (globalPricing) {
      setForm({
        baseFare:                 globalPricing.baseFare                ?? 0,
        defaultRatePerKm:         globalPricing.defaultRatePerKm        ?? 0,
        nightSurchargeMultiplier: globalPricing.nightSurchargeMultiplier ?? 1,
        nightStartHour:           globalPricing.nightStartHour           ?? 22,
        nightEndHour:             globalPricing.nightEndHour             ?? 6,
        waitingFreeMinutes:       globalPricing.waitingFreeMinutes       ?? 5,
        waitingChargePerMinute:   globalPricing.waitingChargePerMinute   ?? 2,
        cancellationFeePercent:   globalPricing.cancellationFeePercent   ?? 50,
        platformFeeType:  globalPricing.platformFee?.type  ?? 'percentage',
        platformFeeValue: globalPricing.platformFee?.value ?? 0,
      });
    }
  }, [globalPricing]);

  const handleSave = async () => {
    const { platformFeeType, platformFeeValue, ...rest } = form;
    const payload = { ...rest, platformFee: { type: platformFeeType, value: Number(platformFeeValue) }, note };
    await dispatch(adminUpdateGlobalPricing(payload));
    setEdit(false);
  };

  const scalarFields = [
    ['baseFare',                 'Base Fare',              '₹',  'Starting fare for every ride'],
    ['defaultRatePerKm',         'Rate / KM',              '₹',  'Per-kilometre charge'],
    ['nightSurchargeMultiplier', 'Night Multiplier',        'x',  'Multiplied onto base fare during night hours'],
    ['nightStartHour',           'Night Start (24h)',       'hr', 'Hour from which night rates apply'],
    ['nightEndHour',             'Night End (24h)',         'hr', 'Hour at which night rates end'],
    ['waitingFreeMinutes',       'Free Waiting',            'min','Driver waits this long before charging'],
    ['waitingChargePerMinute',   'Waiting Charge / min',   '₹',  'Per-minute charge after free waiting period'],
    ['cancellationFeePercent',   'Cancellation Fee',        '%',  'Percentage of base fare charged on cancel'],
  ];

  const planRates = globalPricing?.planRateOverrides
    ? Object.entries(globalPricing.planRateOverrides)
    : [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      <SectionHeader icon={DollarSign} title="Global Pricing Configuration"
        subtitle="Superadmin only — defaults applied to all partners without a fee override"
        actions={
          !edit
            ? <button onClick={() => setEdit(true)} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5"><Edit3 size={13} /> Edit Config</button>
            : <div className="flex gap-2">
                <button onClick={() => setEdit(false)} className="btn-secondary text-xs px-4 py-2">Cancel</button>
                <button onClick={handleSave} disabled={loading} className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
                  {loading ? <span className="spinner w-4 h-4" /> : <Check size={13} />} Save Config
                </button>
              </div>
        }
      />

      <motion.div variants={fadeUp} className="glass-card p-6 space-y-8">
        {loading && !globalPricing ? (
          <div className="flex justify-center py-16"><span className="spinner" /></div>
        ) : (
          <>
            {/* Platform Fee — special object render */}
            <div>
              <p className="text-xs font-black text-base-content/50 uppercase tracking-widest mb-4 pb-2 border-b border-base-300">
                Platform Fee
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <Field label="Fee Type" note="How the platform fee is calculated per ride">
                  {edit ? (
                    <select value={form.platformFeeType || 'percentage'}
                      onChange={(e) => setForm((f) => ({ ...f, platformFeeType: e.target.value }))}
                      className="input-field text-sm">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                    </select>
                  ) : (
                    <p className="text-2xl font-black text-base-content">
                      {String(globalPricing?.platformFee?.type ?? '—')}
                    </p>
                  )}
                </Field>
                <Field label={`Fee Value (${form.platformFeeType === 'percentage' ? '%' : '₹'})`}
                  note={form.platformFeeType === 'percentage' ? 'e.g. 12 = 12% of fare' : 'e.g. 50 = ₹50 per ride'}>
                  {edit ? (
                    <input type="number" step="0.01" value={form.platformFeeValue ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, platformFeeValue: e.target.value }))}
                      placeholder={form.platformFeeType === 'percentage' ? '12' : '50'}
                      className="input-field text-sm" />
                  ) : (
                    <p className="text-2xl font-black text-primary">
                      {globalPricing?.platformFee?.type === 'percentage'
                        ? `${globalPricing?.platformFee?.value ?? 0}%`
                        : `₹${globalPricing?.platformFee?.value ?? 0}`}
                    </p>
                  )}
                </Field>
              </div>
            </div>

            {/* Scalar fare fields */}
            <div>
              <p className="text-xs font-black text-base-content/50 uppercase tracking-widest mb-4 pb-2 border-b border-base-300">
                Fare Configuration
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {scalarFields.map(([key, label, unit, hint]) => (
                  <div key={key}>
                    <Field label={`${label} (${unit})`} note={hint}>
                      {edit ? (
                        <input type="number" step="0.01" value={form[key] ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: +e.target.value }))}
                          placeholder={String(globalPricing?.[key] ?? '')}
                          className="input-field text-sm" />
                      ) : (
                        <p className="text-2xl font-black text-base-content">{safeVal(globalPricing?.[key])}</p>
                      )}
                    </Field>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Rate Overrides */}
            {planRates.length > 0 && (
              <div>
                <p className="text-xs font-black text-base-content/50 uppercase tracking-widest mb-4 pb-2 border-b border-base-300">
                  Plan Rate Overrides (₹/km)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {planRates.map(([plan, rate]) => (
                    <div key={plan} className="p-3 bg-base-200/50 rounded-xl">
                      <p className="text-[10px] font-black text-base-content/40 uppercase truncate">{plan}</p>
                      <p className="text-xl font-black text-base-content">
                        {rate === null || rate === undefined ? '—' : `₹${String(rate)}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Change note (edit mode) */}
            {edit && (
              <div className="pt-2 border-t border-base-300">
                <Field label="Change Note (audit trail)" note="This note is stored in the pricing audit log — be specific">
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Q2 2025 pricing revision — increased base fare by ₹5" className="input-field text-sm" />
                </Field>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// §M  System Logs
// FIX: filters object stable, no infinite re-fetch
// ═════════════════════════════════════════════════════════════════════════════
const SystemLogs = () => {
  const dispatch = useDispatch();
  const { adminLogs, adminLogsTotal, loading } = useSelector((s) => s.transportPartner);
  const [level,    setLevel]    = useState('');
  const [category, setCategory] = useState('');
  const [page,     setPage]     = useState(1);

  // FIX: stable dep-keyed fetch
  useEffect(() => {
    dispatch(adminFetchTransportLogs({ level, category, page, limit: 25 }));
  }, [dispatch, level, category, page]);

  const levelConfig = {
    success: { dot: 'bg-success', text: 'text-success' },
    warning: { dot: 'bg-warning', text: 'text-warning' },
    error:   { dot: 'bg-error',   text: 'text-error'   },
    info:    { dot: 'bg-info',    text: 'text-info'     },
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      <SectionHeader icon={FileText} title="System Logs"
        subtitle={`${adminLogsTotal} total events recorded`}
        actions={
          <button onClick={() => dispatch(adminFetchTransportLogs({ level, category, page, limit: 25 }))}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
        <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="input-field text-sm">
          <option value="">All Levels</option>
          {['success', 'info', 'warning', 'error'].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input-field text-sm">
          <option value="">All Categories</option>
          {['user', 'kyc', 'payment', 'security', 'system'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </motion.div>

      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        {loading && !adminLogs.length ? (
          <div className="flex justify-center py-12"><span className="spinner" /></div>
        ) : (
          <div className="divide-y divide-base-300/40">
            {adminLogs.map((log) => {
              const cfg = levelConfig[log.level] || { dot: 'bg-base-300', text: '' };
              return (
                <div key={log._id} className="flex items-start gap-4 px-4 py-3.5 hover:bg-base-200/30 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.text}`}>
                        {String(log.level || '').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-base-content/30 font-semibold">{log.category}</span>
                    </div>
                    <p className="text-sm text-base-content leading-snug">{log.message}</p>
                    <p className="text-[11px] text-base-content/40 mt-0.5">
                      {log.actor?.name || 'System'} · {log.request?.method} {log.request?.path} · {new Date(log.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {log.request?.statusCode != null && (
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
                      log.request.statusCode >= 400 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                    }`}>
                      {log.request.statusCode}
                    </span>
                  )}
                </div>
              );
            })}
            {!adminLogs.length && (
              <p className="py-12 text-center text-sm text-base-content/40">No logs found matching current filters.</p>
            )}
          </div>
        )}
        {adminLogsTotal > 25 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/50">
              {Math.min((page - 1) * 25 + 1, adminLogsTotal)}–{Math.min(page * 25, adminLogsTotal)} of {adminLogsTotal}
            </p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
              <button disabled={page * 25 >= adminLogsTotal} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function TransportPartnerManagement() {
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.user?.user) ?? null;
  const { error } = useSelector((s) => s.transportPartner);

  const [activeSection,     setActiveSection]     = useState('stats');
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);

  useEffect(() => () => { dispatch(clearTPError()); }, [dispatch]);

  const nav = [
    { id: 'stats',    label: 'Overview', icon: BarChart2  },
    { id: 'partners', label: 'Partners', icon: Building2  },
    { id: 'vehicles', label: 'Vehicles', icon: Car        },
    { id: 'drivers',  label: 'Drivers',  icon: Users      },
    { id: 'pricing',  label: 'Pricing',  icon: DollarSign },
    { id: 'logs',     label: 'Logs',     icon: FileText   },
  ];

  const handleSelectPartner = useCallback((id) => {
    setSelectedPartnerId(id);
    setActiveSection('partner-detail');
  }, []);

  const handleBackFromPartner = useCallback(() => {
    setSelectedPartnerId(null);
    setActiveSection('partners');
  }, []);

  const changeSection = useCallback((id) => {
    setActiveSection(id);
    if (id !== 'partner-detail') setSelectedPartnerId(null);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      {/* Global error banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="bg-error/10 border-b border-error/20 px-6 py-2 flex items-center justify-between">
            <p className="text-xs text-error font-semibold flex items-center gap-2">
              <AlertTriangle size={13} /> {error}
            </p>
            <button onClick={() => dispatch(clearTPError())} className="text-error hover:bg-error/10 p-1 rounded-lg transition-colors">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top navigation bar */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 border-b border-base-300"
        style={{ background: 'color-mix(in srgb, var(--base-100), transparent 8%)', backdropFilter: 'blur(20px)' }}>
        <div className="container-custom py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-gradient-primary)' }}>
              <Truck size={15} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-black text-base-content leading-none">Transport</p>
              <p className="text-[9px] text-base-content/40 leading-none tracking-wider">MANAGEMENT</p>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-0.5 overflow-x-auto">
            {nav.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id || (id === 'partners' && activeSection === 'partner-detail');
              return (
                <button key={id} onClick={() => changeSection(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${
                    isActive ? 'text-primary-content' : 'text-base-content/55 hover:bg-base-200'
                  }`}
                  style={isActive ? { background: 'var(--primary)' } : {}}>
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>

          {user && (
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 border-primary/20" />
                : <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center font-black text-xs">{(user.name || 'A')[0]}</div>
              }
              <div className="hidden sm:block">
                <p className="text-xs font-black text-base-content leading-tight">{user.name}</p>
                <p className="text-[9px] text-base-content/40 uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <div className="container-custom py-6">
        {/* Partner detail breadcrumb */}
        {activeSection === 'partner-detail' && (
          <div className="flex items-center gap-2 text-xs text-base-content/40 mb-4">
            <button onClick={() => changeSection('partners')} className="hover:text-primary transition-colors">Partners</button>
            <ChevronRight size={12} />
            <span className="text-base-content font-semibold">Partner Detail</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={activeSection + (selectedPartnerId || '')}
            variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
            {activeSection === 'stats'           && <PlatformStats />}
            {activeSection === 'partners'         && <PartnerList onSelectPartner={handleSelectPartner} />}
            {activeSection === 'partner-detail'   && <PartnerDetail partnerId={selectedPartnerId} onBack={handleBackFromPartner} />}
            {activeSection === 'vehicles'         && <PendingVehicles />}
            {activeSection === 'drivers'          && <PlatformDrivers />}
            {activeSection === 'pricing'          && <GlobalPricing />}
            {activeSection === 'logs'             && <SystemLogs />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}