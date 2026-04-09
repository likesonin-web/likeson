'use client'
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend,
} from 'recharts';
import {
  Users, UserPlus, Search, Filter, Shield, ShieldOff, KeyRound,
  MailCheck, Trash2, PencilLine, Eye, X, ChevronLeft, ChevronRight,
  RefreshCw, Building2, Stethoscope, FlaskConical, Truck, Pill,
  BadgeDollarSign, HeartHandshake, UserCircle, CheckCircle2,
  XCircle, Clock, MoreVertical, LogOut, Monitor, Smartphone, Globe,
  AlertTriangle, Loader2, Info, ArrowUpDown, SlidersHorizontal,
  Phone, Mail, Calendar, MapPin, Star, Package, Upload, FileText,
  LayoutGrid, LayoutList, TrendingUp, TrendingDown, Activity,
  BarChart2, PieChart as PieChartIcon, ChevronDown, ChevronUp,
  Zap, Award, Shield as ShieldIcon, Eye as EyeIcon,
} from 'lucide-react';

import {
  fetchAllUsers,
  fetchUserById,
  fetchRefHospitals,
  fetchRefLabPartnerHospitals,
  fetchRefPharmacyStores,
  fetchRefTransportPartners,
  createCustomer,
  createDoctor,
  createLabPartner,
  createTransportPartner,
  createPharmacy,
  createFinance,
  createCareAssistant,
  blockUnblockUser,
  resetUserPassword,
  verifyUserEmail,
  updateUser,
  deleteUser,
  fetchUserSessions,
  revokeUserSession,
  setFilters,
  setPage,
  clearSelectedUser,
  clearErrors,
  selectAllUsers,
  selectUsersPagination,
  selectUsersFilters,
  selectListLoading,
  selectDetailLoading,
  selectSelectedUser,
  selectRefData,
  selectUsersErrors,
  selectUserSessions,
  selectSessionsLoading,
  selectCreateLoading,
  selectBlockLoading,
  selectResetPasswordLoading,
  selectDeleteLoading,
  selectUsersLoading,
} from '@/store/slices/adminUserSlice';

import {
  uploadSingleFile,
  resetUploadState,
} from '@/store/slices/uploadSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = [
  { value: '',               label: 'All Roles',      icon: Users,          color: 'primary'   },
  { value: 'customer',       label: 'Customer',        icon: UserCircle,     color: 'info'      },
  { value: 'doctor',         label: 'Doctor',          icon: Stethoscope,    color: 'success'   },
  { value: 'lab partner',    label: 'Lab Partner',     icon: FlaskConical,   color: 'warning'   },
  { value: 'transportpartner', label: 'Transport',     icon: Truck,          color: 'accent'    },
  { value: 'pharmacy',       label: 'Pharmacy',        icon: Pill,           color: 'secondary' },
  { value: 'finance',        label: 'Finance',         icon: BadgeDollarSign,color: 'success'   },
  { value: 'care assistant', label: 'Care Assistant',  icon: HeartHandshake, color: 'error'     },
];

const ROLE_CREATE_CONFIG = {
  customer: {
    label: 'Customer', icon: UserCircle, color: 'info',
    fields: [
      { name: 'name',       label: 'Full Name',   type: 'text',   required: true  },
      { name: 'email',      label: 'Email',       type: 'email',  required: true  },
      { name: 'phone',      label: 'Phone',       type: 'tel',    required: false },
      { name: 'gender',     label: 'Gender',      type: 'select', required: false,
        options: ['Male','Female','Transgender','Other','Prefer not to say'] },
      { name: 'bloodGroup', label: 'Blood Group', type: 'select', required: false,
        options: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
    ],
  },
  doctor: {
    label: 'Doctor', icon: Stethoscope, color: 'success',
    fields: [
      { name: 'name',               label: 'Full Name',          type: 'text',   required: true  },
      { name: 'email',              label: 'Email',              type: 'email',  required: true  },
      { name: 'phone',              label: 'Phone',              type: 'tel',    required: false },
      { name: 'specialization',     label: 'Specialization',     type: 'select', required: true,
        options: ['General Physician','Cardiologist','Neurologist','Pediatrician',
                  'Oncologist','Orthopedic Surgeon','Gastroenterologist','Gynecologist',
                  'Dermatologist','Urologist','Psychiatry','Physiotherapist'] },
      { name: 'experienceYears',    label: 'Experience (Years)', type: 'number', required: true  },
      { name: 'registrationNumber', label: 'MCI Reg. Number',    type: 'text',   required: false },
      { name: 'primaryHospital',    label: 'Primary Hospital',   type: 'ref',    required: true, refKey: 'hospitals' },
      { name: 'inPersonFee',        label: 'In-Person Fee (₹)',  type: 'number', required: true  },
    ],
  },
  'lab partner': {
    label: 'Lab Partner', icon: FlaskConical, color: 'warning',
    fields: [
      { name: 'name',             label: 'Full Name',            type: 'text',  required: true  },
      { name: 'email',            label: 'Email',                type: 'email', required: true  },
      { name: 'phone',            label: 'Phone',                type: 'tel',   required: false },
      { name: 'assignedHospital', label: 'Assigned Clinic / Lab',type: 'ref',   required: true, refKey: 'labPartnerHospitals' },
    ],
  },
  transportpartner: {
    label: 'Transport Partner', icon: Truck, color: 'accent',
    fields: [
      { name: 'name',              label: 'Full Name',        type: 'text',   required: true  },
      { name: 'email',             label: 'Email',            type: 'email',  required: true  },
      { name: 'phone',             label: 'Phone',            type: 'tel',    required: false },
      // ── agencyId ref ──────────────────────────────────────────────────────────
      // Response shape from GET /ref/transport-partners (aligned to TransportPartner schema):
      //   { _id, businessName, businessType, registeredAddress: { city }, vehicles[] }
      // labelField is resolved in the ref dropdown renderer below.
      { name: 'agencyId',          label: 'Agency',           type: 'ref',    required: true,  refKey: 'transportPartners' },
      { name: 'kyc.panNumber',     label: 'PAN Number',       type: 'text',   required: true,
        hint: 'Format: ABCDE1234F' },
      { name: 'kyc.aadhaarNumber', label: 'Aadhaar Number',   type: 'text',   required: true,
        hint: 'Exactly 12 digits' },
      { name: 'kyc.documentUrl',   label: 'Identity Proof',   type: 'upload', required: true,
        hint: 'PAN card / Aadhaar scan / Passport (JPG, PNG or PDF, max 5 MB)',
        folder: 'kyc/transport-partners' },
    ],
  },
  pharmacy: {
    label: 'Pharmacist', icon: Pill, color: 'secondary',
    fields: [
      { name: 'name',               label: 'Full Name',       type: 'text',   required: true  },
      { name: 'email',              label: 'Email',           type: 'email',  required: true  },
      { name: 'phone',              label: 'Phone',           type: 'tel',    required: false },
      { name: 'pharmacistName',     label: 'Pharmacist Name', type: 'text',   required: true  },
      { name: 'registrationNumber', label: 'PCI Reg. Number', type: 'text',   required: true  },
      { name: 'qualification',      label: 'Qualification',   type: 'select', required: true,
        options: ['D.Pharm','B.Pharm','M.Pharm','Pharm.D'] },
      { name: 'assignedStore',      label: 'Assigned Store',  type: 'ref',    required: true, refKey: 'pharmacyStores' },
    ],
  },
  finance: {
    label: 'Finance', icon: BadgeDollarSign, color: 'success',
    fields: [
      { name: 'name',  label: 'Full Name', type: 'text',  required: true  },
      { name: 'email', label: 'Email',     type: 'email', required: true  },
      { name: 'phone', label: 'Phone',     type: 'tel',   required: false },
    ],
  },
  'care assistant': {
    label: 'Care Assistant', icon: HeartHandshake, color: 'error',
    fields: [
      { name: 'name',             label: 'Full Name',          type: 'text',   required: true  },
      { name: 'email',            label: 'Email',              type: 'email',  required: true  },
      { name: 'phone',            label: 'Phone',              type: 'tel',    required: false },
      { name: 'experienceYears',  label: 'Experience (Years)', type: 'number', required: false },
      { name: 'baseServiceCharge',label: 'Base Charge (₹)',    type: 'number', required: false },
    ],
  },
};

const PLATFORM_ICON = { android: Smartphone, ios: Smartphone, web: Globe, desktop: Monitor };

const CHART_COLORS = [
  'var(--primary)',
  'var(--success)',
  'var(--warning)',
  'var(--accent)',
  'var(--info)',
  'var(--error)',
  'var(--secondary)',
];

// ─────────────────────────────────────────────────────────────────────────────
// REF ITEM LABEL RESOLVER
// Returns the human-readable display label for any ref item regardless of model.
//
// Transport Partner response shape (from TransportPartner schema):
//   { _id, businessName, businessType, registeredAddress: { city }, vehicles[] }
//
// Hospital response shape:
//   { _id, name, hospitalType, address: { city } }
//
// PharmacyStore response shape:
//   { _id, storeName, storeType, address: { city } }
// ─────────────────────────────────────────────────────────────────────────────
const resolveRefLabel = (item) => {
  // TransportPartner — uses businessName + registeredAddress.city
  if (item.businessName) {
    const city = item.registeredAddress?.city ?? '';
    const type = item.businessType ? ` (${item.businessType})` : '';
    return `${item.businessName}${city ? ` — ${city}` : ''}${type}`;
  }
  // PharmacyStore — uses storeName
  if (item.storeName) {
    const city = item.address?.city ?? '';
    return `${item.storeName}${city ? ` — ${city}` : ''}`;
  }
  // Hospital / Clinic / Diagnostic Center — uses name
  if (item.name) {
    const city = item.address?.city ?? '';
    const type = item.hospitalType ? ` (${item.hospitalType})` : '';
    return `${item.name}${city ? ` — ${city}` : ''}${type}`;
  }
  return item._id;
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => {
  const cfg  = ROLES.find(r => r.value === role) || ROLES[0];
  const Icon = cfg.icon;
  return (
    <span className={`badge badge-${cfg.color} gap-1`}>
      <Icon size={10} />
      {role || 'all'}
    </span>
  );
};

const StatusDot = ({ online }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-success animate-pulse' : 'bg-base-300'}`} />
);

const BlockBadge = ({ isBlocked }) =>
  isBlocked
    ? <span className="badge badge-error gap-1"><ShieldOff size={10} />Blocked</span>
    : <span className="badge badge-success gap-1"><Shield size={10} />Active</span>;

const VerifyBadge = ({ verified }) =>
  verified
    ? <span className="badge badge-success gap-1"><CheckCircle2 size={10} />Verified</span>
    : <span className="badge badge-warning gap-1"><Clock size={10} />Unverified</span>;

const LoadingSpinner = ({ size = 20 }) => (
  <Loader2 size={size} className="animate-spin text-primary" />
);

const EmptyState = ({ message = 'No users found' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-24 gap-4"
  >
    <div className="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center">
      <Users size={32} className="text-base-content/30" />
    </div>
    <p className="text-base-content/50 font-medium">{message}</p>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED COUNTER
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedCounter({ value, duration = 1200, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const start  = performance.now();
    startRef.current = start;

    const tick = (now) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return <>{prefix}{display.toLocaleString('en-IN')}{suffix}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS SECTION
// ─────────────────────────────────────────────────────────────────────────────

const mockTrend = () => {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      users: Math.floor(Math.random() * 80) + 10,
    });
  }
  return data;
};

const MOCK_TREND = mockTrend();

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="font-black text-base-content mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-base-content/70">{p.name}:</span>
          <span className="font-bold text-base-content">{p.value?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
};

function StatCard({ label, value, icon: Icon, color, trend, trendLabel, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', damping: 20, stiffness: 260 }}
      className="card p-5 relative overflow-hidden group"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[inherit]"
        style={{ background: `radial-gradient(ellipse at top left, color-mix(in oklch, var(--${color}) 12%, transparent), transparent 70%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `color-mix(in oklch, var(--${color}) 15%, var(--base-200))` }}
          >
            <Icon size={20} style={{ color: `var(--${color})` }} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
              trend >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
            }`}>
              {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-3xl font-black text-base-content">
          <AnimatedCounter value={value} />
        </p>
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mt-1">{label}</p>
        {trendLabel && (
          <p className="text-[10px] text-base-content/30 mt-0.5">{trendLabel}</p>
        )}
      </div>
    </motion.div>
  );
}

function AnalyticsSection({ users, pagination, filters }) {
  const [activeChart, setActiveChart] = useState('trend');
  const [isExpanded, setIsExpanded]   = useState(true);

  const total    = pagination?.total || 0;
  const blocked  = users.filter(u => u.isBlocked).length;
  const verified = users.filter(u => u.isEmailVerified).length;
  const online   = users.filter(u => u.isOnline).length;

  const roleCount = {};
  users.forEach(u => {
    const label = ROLES.find(r => r.value === u.role)?.label || u.role || 'Unknown';
    roleCount[label] = (roleCount[label] || 0) + 1;
  });
  const pieData = Object.entries(roleCount).map(([name, value]) => ({ name, value }));

  const barData = Object.entries(roleCount).map(([name, count]) => ({
    name: name.length > 10 ? name.slice(0, 9) + '…' : name,
    count,
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="card overflow-hidden"
    >
      <div
        className="flex items-center justify-between p-5 border-b border-base-300 cursor-pointer select-none"
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="font-black text-base-content text-base">Platform Analytics</h2>
            <p className="text-[11px] text-base-content/50">Live stats · {total.toLocaleString()} users</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-base-200 rounded-lg p-1">
            {[
              { id: 'trend', icon: Activity,     label: 'Trend' },
              { id: 'roles', icon: BarChart2,    label: 'Roles' },
              { id: 'pie',   icon: PieChartIcon, label: 'Share' },
            ].map(({ id, icon: Ic, label }) => (
              <button
                key={id}
                onClick={(e) => { e.stopPropagation(); setActiveChart(id); setIsExpanded(true); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  activeChart === id
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'text-base-content/50 hover:text-base-content'
                }`}
              >
                <Ic size={10} /> {label}
              </button>
            ))}
          </div>
          <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} className="text-base-content/40" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 border-b border-base-300">
              <StatCard label="Total Users"    value={total}         icon={Users}        color="primary"  trend={8}  trendLabel="vs last month" delay={0}    />
              <StatCard label="Active"         value={total-blocked} icon={Shield}       color="success"  trend={3}  trendLabel="vs last week"  delay={0.05} />
              <StatCard label="Verified"       value={verified}      icon={CheckCircle2} color="info"     trend={12} trendLabel="email verified" delay={0.1}  />
              <StatCard label="Online Now"     value={online}        icon={Activity}     color="accent"              trendLabel="currently active" delay={0.15} />
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">
                {activeChart === 'trend' && (
                  <motion.div
                    key="trend"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4">
                      Registration Trend · Last 30 Days
                    </p>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={MOCK_TREND} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="var(--primary)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone" dataKey="users" name="New Users"
                          stroke="var(--primary)" strokeWidth={2} fill="url(#areaGrad)"
                          dot={false} activeDot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
                          animationBegin={0} animationDuration={1200} animationEasing="ease-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}

                {activeChart === 'roles' && (
                  <motion.div
                    key="roles"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4">
                      Users by Role · Current Page Sample
                    </p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="var(--primary)"   stopOpacity={1}   />
                            <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.5 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Users" fill="url(#barGrad)" radius={[6,6,0,0]} animationBegin={0} animationDuration={900} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}

                {activeChart === 'pie' && (
                  <motion.div
                    key="pie"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4">Role Distribution</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" animationBegin={0} animationDuration={1000} animationEasing="ease-out">
                            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 min-w-32">
                      {pieData.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-[10px] text-base-content/60 truncate">{item.name}</span>
                          <span className="text-[10px] font-black text-base-content ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC DOCUMENT UPLOAD FIELD
// ─────────────────────────────────────────────────────────────────────────────

function KycDocUploadField({ field, currentUrl, onUploadComplete }) {
  const dispatch    = useDispatch();
  const uploadState = useSelector(state => state.upload);
  const { isUploading, lastUploadedUrl, error: uploadError } = uploadState;

  const [localFile, setLocalFile]             = useState(null);
  const [localPreview, setLocalPreview]       = useState(null);
  const [uploadTriggered, setUploadTriggered] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (uploadTriggered && !isUploading && lastUploadedUrl) {
      onUploadComplete(field.name, lastUploadedUrl);
      setUploadTriggered(false);
    }
  }, [isUploading, lastUploadedUrl, uploadTriggered, field.name, onUploadComplete]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Maximum size is 5 MB.'); return; }
    setLocalFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setLocalPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else { setLocalPreview(null); }
    dispatch(resetUploadState());
    setUploadTriggered(true);
    dispatch(uploadSingleFile({ file, folder: field.folder || 'kyc/documents' }));
  };

  const isUploaded = Boolean(currentUrl);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider flex items-center gap-1">
        {field.label} <span className="text-error">*</span>
      </label>
      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed cursor-pointer transition-all p-4 min-h-[90px] ${
          isUploaded
            ? 'border-success/50 bg-success/5'
            : isUploading
              ? 'border-primary/50 bg-primary/5 cursor-not-allowed'
              : 'border-base-300 bg-base-200/40 hover:border-primary/40 hover:bg-primary/5'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-1.5">
            <LoadingSpinner size={22} />
            <p className="text-xs text-base-content/50 font-medium">Uploading…</p>
          </div>
        ) : isUploaded ? (
          <div className="flex items-center gap-3 w-full">
            {localPreview ? (
              <img src={localPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-base-300 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-success" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-success flex items-center gap-1">
                <CheckCircle2 size={12} /> Uploaded successfully
              </p>
              <p className="text-[10px] text-base-content/50 truncate">{localFile?.name || 'Document'}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocalFile(null); setLocalPreview(null);
                onUploadComplete(field.name, '');
                dispatch(resetUploadState());
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="w-6 h-6 rounded-full bg-base-300 hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <Upload size={20} className="text-base-content/30" />
            <p className="text-xs font-semibold text-base-content/50">Click to upload</p>
            <p className="text-[10px] text-base-content/30">{field.hint}</p>
          </div>
        )}
        <input
          ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf"
          className="hidden" onChange={handleFileChange}
          required={field.required && !isUploaded}
        />
      </div>
      {uploadError && uploadTriggered === false && (
        <p className="text-[10px] text-error flex items-center gap-1">
          <XCircle size={10} /> {uploadError}
        </p>
      )}
      {!isUploaded && field.hint && (
        <p className="text-[10px] text-base-content/40">{field.hint}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE USER MODAL
// ─────────────────────────────────────────────────────────────────────────────

const CREATE_THUNKS = {
  customer:         createCustomer,
  doctor:           createDoctor,
  'lab partner':    createLabPartner,
  transportpartner: createTransportPartner,
  pharmacy:         createPharmacy,
  finance:          createFinance,
  'care assistant': createCareAssistant,
};

function CreateUserModal({ onClose }) {
  const dispatch      = useDispatch();
  const ref           = useSelector(selectRefData);
  const loadingMap    = useSelector(selectUsersLoading);
  const refLoading    = loadingMap.refHospitals || loadingMap.refLabHospitals
                        || loadingMap.refPharmacyStores || loadingMap.refTransportPartners;
  const createLoading = useSelector(selectCreateLoading);
  const errors        = useSelector(selectUsersErrors);
  const createError   = errors.create;

  const [succeeded, setSucceeded] = useState(false);
  const wasLoading = useRef(false);

  useEffect(() => {
    if (wasLoading.current && !createLoading && !createError) setSucceeded(true);
    wasLoading.current = createLoading;
  }, [createLoading, createError]);

  useEffect(() => {
    if (succeeded) {
      const t = setTimeout(() => {
        dispatch(clearErrors()); dispatch(resetUploadState()); onClose();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [succeeded, dispatch, onClose]);

  useEffect(() => { return () => { dispatch(resetUploadState()); }; }, [dispatch]);

  const [selectedRole, setSelectedRole] = useState('customer');
  const [formData, setFormData]         = useState({});

  // ── Ref data lookup map ───────────────────────────────────────────────────
  // Keys match the refKey values in ROLE_CREATE_CONFIG.
  // transportPartners comes from GET /ref/transport-partners whose items
  // have shape: { _id, businessName, businessType, registeredAddress: { city }, vehicles[] }
  const REF_DATA = {
    hospitals:           ref.hospitals           ?? [],
    labPartnerHospitals: ref.labPartnerHospitals ?? [],
    pharmacyStores:      ref.pharmacyStores      ?? [],
    transportPartners:   ref.transportPartners   ?? [],
  };

  const config = ROLE_CREATE_CONFIG[selectedRole];

  useEffect(() => {
    dispatch(fetchRefHospitals());
    dispatch(fetchRefLabPartnerHospitals());
    dispatch(fetchRefPharmacyStores());
    dispatch(fetchRefTransportPartners());
  }, [dispatch]);

  const handleRoleChange = (role) => {
    setSelectedRole(role); setFormData({});
    dispatch(clearErrors()); dispatch(resetUploadState()); setSucceeded(false);
  };

  const setNestedValue = (obj, path, value) => {
    const keys   = path.split('.');
    const result = { ...obj };
    let current  = result;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...(current[keys[i]] || {}) };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return result;
  };

  const handleChange = useCallback(
    (name, value) => setFormData(prev => setNestedValue(prev, name, value)), []
  );

  const getNestedValue = (obj, path) =>
    path.split('.').reduce((o, k) => o?.[k] ?? '', obj);

  const [localValidationError, setLocalValidationError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(clearErrors()); setSucceeded(false); setLocalValidationError('');
    const payload = { ...formData };

    if (selectedRole === 'transportpartner') {
      if (!payload.kyc?.documentUrl) {
        setLocalValidationError('Please upload the identity proof document before submitting.');
        return;
      }
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(payload.kyc?.panNumber || '')) {
        setLocalValidationError('Invalid PAN format. Expected: ABCDE1234F'); return;
      }
      if (!/^\d{12}$/.test(payload.kyc?.aadhaarNumber || '')) {
        setLocalValidationError('Aadhaar must be exactly 12 digits.'); return;
      }
    }

    if (selectedRole === 'doctor' && payload.inPersonFee) {
      payload.fees = { inPersonFee: Number(payload.inPersonFee) };
      delete payload.inPersonFee;
    }

    dispatch(CREATE_THUNKS[selectedRole](payload));
  };

  const roleKeys           = Object.keys(ROLE_CREATE_CONFIG);
  const isUploadInProgress = useSelector(state => state.upload.isUploading);
  const submitDisabled     = createLoading || isUploadInProgress;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black text-base-content">Create New User</h2>
              <p className="text-xs text-base-content/50">Credentials will be emailed automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-base-200 hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Role tabs */}
        <div className="p-4 border-b border-base-300 bg-base-200/50">
          <div className="flex flex-wrap gap-2">
            {roleKeys.map(role => {
              const cfg  = ROLE_CREATE_CONFIG[role];
              const Icon = cfg.icon;
              const active = selectedRole === role;
              return (
                <button
                  key={role} onClick={() => handleRoleChange(role)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-primary text-primary-content shadow-sm'
                      : 'bg-base-100 text-base-content/60 hover:text-base-content hover:bg-base-300'
                  }`}
                >
                  <Icon size={12} />{cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4">
            {selectedRole === 'transportpartner' && (
              <div className="flex items-center gap-2 pb-1">
                <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                  <Truck size={12} className="text-accent" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-base-content/50">
                  KYC fields marked <span className="text-error">*</span> are mandatory per transport regulations
                </p>
              </div>
            )}

            {config.fields.map(field => {
              const value = getNestedValue(formData, field.name);

              // ── Upload field ─────────────────────────────────────────────
              if (field.type === 'upload') {
                return (
                  <KycDocUploadField
                    key={field.name} field={field}
                    currentUrl={value} onUploadComplete={handleChange}
                  />
                );
              }

              // ── Select field ─────────────────────────────────────────────
              if (field.type === 'select') return (
                <div key={field.name} className="space-y-1.5">
                  <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider">
                    {field.label} {field.required && <span className="text-error">*</span>}
                  </label>
                  <select
                    className="input-field w-full" value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    required={field.required}
                  >
                    <option value="">Select {field.label}</option>
                    {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              );

              // ── Ref (relationship) dropdown ──────────────────────────────
              // Uses resolveRefLabel() which handles all model shapes:
              //   - TransportPartner → businessName + registeredAddress.city
              //   - Hospital         → name + address.city + hospitalType
              //   - PharmacyStore    → storeName + address.city
              if (field.type === 'ref') {
                const refItems = REF_DATA[field.refKey] ?? [];
                return (
                  <div key={field.name} className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider">
                      {field.label} {field.required && <span className="text-error">*</span>}
                    </label>
                    {refLoading ? (
                      <div className="input-field w-full flex items-center gap-2 text-base-content/40">
                        <LoadingSpinner size={14} /> Loading…
                      </div>
                    ) : refItems.length === 0 ? (
                      <div className="input-field w-full flex items-center gap-2 text-base-content/40 text-xs">
                        <AlertTriangle size={14} className="text-warning" />
                        No {field.label} records found
                      </div>
                    ) : (
                      <select
                        className="input-field w-full" value={value}
                        onChange={e => handleChange(field.name, e.target.value)}
                        required={field.required}
                      >
                        <option value="">Select {field.label}</option>
                        {refItems.map(item => (
                          <option key={item._id} value={item._id}>
                            {resolveRefLabel(item)}
                          </option>
                        ))}
                      </select>
                    )}
                    {/* Show vehicle count hint for transport partner dropdown */}
                    {field.refKey === 'transportPartners' && value && (() => {
                      const selected = refItems.find(i => i._id === value);
                      if (!selected) return null;
                      const vehicleCount = selected.vehicles?.length ?? 0;
                      const city = selected.registeredAddress?.city ?? '';
                      return (
                        <p className="text-[10px] text-base-content/40 flex items-center gap-1.5 mt-1">
                          <Truck size={9} />
                          {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''} registered
                          {city ? ` · ${city}` : ''}
                        </p>
                      );
                    })()}
                  </div>
                );
              }

              // ── Text / number / email / tel field ────────────────────────
              return (
                <div key={field.name} className="space-y-1.5">
                  <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider">
                    {field.label} {field.required && <span className="text-error">*</span>}
                  </label>
                  <input
                    type={field.type} className="input-field w-full"
                    placeholder={field.hint || field.label} value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    required={field.required}
                    min={field.type === 'number' ? 0 : undefined}
                  />
                  {field.hint && <p className="text-[10px] text-base-content/40">{field.hint}</p>}
                </div>
              );
            })}

            {localValidationError && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="alert alert-warning text-sm">
                <AlertTriangle size={16} className="text-warning flex-shrink-0" />{localValidationError}
              </motion.div>
            )}
            {createError && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="alert alert-error text-sm">
                <XCircle size={16} className="text-error flex-shrink-0" />{createError}
              </motion.div>
            )}
            {succeeded && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="alert alert-success text-sm">
                <CheckCircle2 size={16} className="text-success flex-shrink-0" />Account created! Closing…
              </motion.div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-base-300 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
          <button
            form="create-user-form" type="submit" disabled={submitDisabled}
            title={isUploadInProgress ? 'Please wait for the document upload to complete' : undefined}
            className="btn-primary-cta px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {createLoading
              ? <><LoadingSpinner size={14} /> Creating…</>
              : isUploadInProgress
                ? <><LoadingSpinner size={14} /> Uploading…</>
                : <><UserPlus size={14} /> Create User</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function UserDetailDrawer({ userId, onClose }) {
  const dispatch      = useDispatch();
  const detail        = useSelector(selectSelectedUser);
  const detailLoading = useSelector(selectDetailLoading);
  const errors        = useSelector(selectUsersErrors);
  const detailError   = errors.detail;
  const sessions      = useSelector(selectUserSessions);
  const sessLoading   = useSelector(selectSessionsLoading);
  const blockLoading  = useSelector(selectBlockLoading);
  const resetLoading  = useSelector(selectResetPasswordLoading);
  const loadingMap    = useSelector(selectUsersLoading);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (userId) { dispatch(fetchUserById(userId)); dispatch(fetchUserSessions(userId)); }
    return () => { dispatch(clearSelectedUser()); dispatch(clearErrors()); };
  }, [userId, dispatch]);

  const handleBlock         = () => dispatch(blockUnblockUser({ id: userId, action: detail?.isBlocked ? 'unblock' : 'block', reason: 'Admin action via user panel' }));
  const handleResetPwd      = () => dispatch(resetUserPassword(userId));
  const handleVerifyEmail   = () => dispatch(verifyUserEmail(userId));
  const handleRevokeSession = (sessionId) => dispatch(revokeUserSession({ userId, sessionId }));

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'profile',  label: 'Profile'  },
    { id: 'orders',   label: 'Orders'   },
    { id: 'security', label: 'Security' },
  ];

  const PlatformIcon = ({ platform }) => {
    const Icon = PLATFORM_ICON[platform] || Monitor;
    return <Icon size={14} className="text-base-content/50" />;
  };

  const actionLoading = blockLoading || resetLoading || loadingMap.verifyEmail;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-xl h-full bg-base-100 border-l border-base-300 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-base-300 flex-shrink-0">
          <h2 className="text-lg font-black text-base-content">User Detail</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        {detailLoading && (
          <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} /></div>
        )}
        {detailError && !detailLoading && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="alert alert-error"><XCircle size={16} className="text-error" /> {detailError}</div>
          </div>
        )}

        {detail && !detailLoading && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 bg-gradient-to-br from-primary/5 to-secondary/5 border-b border-base-300">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={detail.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(detail.name)}&background=random`}
                    alt={detail.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-base-300"
                  />
                  <div className="absolute -bottom-1 -right-1"><StatusDot online={detail.isOnline} /></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-xl text-base-content truncate">{detail.name}</h3>
                  <p className="text-sm text-base-content/60 truncate">{detail.email}</p>
                  {detail.phone && <p className="text-xs text-base-content/50">{detail.phone}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <RoleBadge role={detail.role} />
                    <BlockBadge isBlocked={detail.isCurrentlyBlocked ?? detail.isBlocked} />
                    <VerifyBadge verified={detail.isEmailVerified} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleBlock} disabled={actionLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60 ${
                    (detail.isCurrentlyBlocked ?? detail.isBlocked)
                      ? 'bg-success/10 text-success hover:bg-success/20'
                      : 'bg-error/10 text-error hover:bg-error/20'
                  }`}
                >
                  {blockLoading ? <LoadingSpinner size={12} />
                    : (detail.isCurrentlyBlocked ?? detail.isBlocked)
                      ? <><Shield size={12} /> Unblock</>
                      : <><ShieldOff size={12} /> Block</>}
                </button>
                <button
                  onClick={handleResetPwd} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-warning/10 text-warning hover:bg-warning/20 transition-all disabled:opacity-60"
                >
                  {resetLoading ? <LoadingSpinner size={12} /> : <><KeyRound size={12} /> Reset Password</>}
                </button>
                {!detail.isEmailVerified && (
                  <button
                    onClick={handleVerifyEmail} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-info/10 text-info hover:bg-info/20 transition-all disabled:opacity-60"
                  >
                    {loadingMap.verifyEmail ? <LoadingSpinner size={12} /> : <><MailCheck size={12} /> Verify Email</>}
                  </button>
                )}
              </div>
            </div>

            <div className="flex border-b border-base-300 px-5 bg-base-200/30">
              {TABS.map(tab => (
                <button
                  key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                    activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-base-content/50 hover:text-base-content'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {activeTab === 'overview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Mail,     label: 'Email',       value: detail.email },
                      { icon: Phone,    label: 'Phone',       value: detail.phone || '—' },
                      { icon: Calendar, label: 'Joined',      value: new Date(detail.accountTimeline?.createdAt).toLocaleDateString('en-IN') },
                      { icon: Clock,    label: 'Last Active', value: detail.accountTimeline?.lastActiveAt ? new Date(detail.accountTimeline.lastActiveAt).toLocaleDateString('en-IN') : '—' },
                      { icon: MapPin,   label: 'Address',     value: detail.lastKnownAddress || '—' },
                      { icon: Shield,   label: 'Work Status', value: detail.workStatus || '—' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="bg-base-200/50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={12} className="text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">{label}</span>
                        </div>
                        <p className="text-sm font-semibold text-base-content truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {(detail.isCurrentlyBlocked ?? detail.isBlocked) && detail.blockReason && (
                    <div className="alert alert-error text-sm">
                      <AlertTriangle size={14} className="text-error flex-shrink-0" />
                      <div>
                        <p className="font-bold text-xs uppercase">Block Reason</p>
                        <p className="text-xs mt-0.5">{detail.blockReason}</p>
                        {detail.unblockAt && (
                          <p className="text-xs mt-1 opacity-70">
                            Auto-unblocks: {new Date(detail.unblockAt).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {detail.notifications?.recent?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-2">Recent Notifications</h4>
                      <div className="space-y-2">
                        {detail.notifications.recent.slice(0, 5).map((n, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${n.isRead ? 'bg-base-200/30 border-transparent' : 'bg-primary/5 border-primary/20'}`}>
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Info size={10} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-base-content truncate">{n.title}</p>
                              <p className="text-[11px] text-base-content/60 mt-0.5 line-clamp-2">{n.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'profile' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {detail.profile ? (
                    <div className="space-y-3">
                      {Object.entries(detail.profile)
                        .filter(([k]) => !['_id','__v','user','createdAt','updatedAt'].includes(k))
                        .map(([key, value]) => {
                          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                            return (
                              <div key={key} className="bg-base-200/50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50 mb-2">{key}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(value).filter(([, v]) => v !== null && v !== undefined).map(([k2, v2]) => (
                                    <div key={k2}>
                                      <p className="text-[10px] text-base-content/40">{k2}</p>
                                      <p className="text-xs font-semibold text-base-content truncate">{String(v2)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          if (Array.isArray(value)) {
                            return (
                              <div key={key} className="bg-base-200/50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50 mb-1">{key}</p>
                                <p className="text-xs text-base-content/70">{value.join(', ') || '—'}</p>
                              </div>
                            );
                          }
                          return (
                            <div key={key} className="flex justify-between items-center py-2 border-b border-base-300">
                              <span className="text-xs text-base-content/50 capitalize">{key}</span>
                              <span className="text-xs font-semibold text-base-content">{String(value)}</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : <EmptyState message="No profile data available" />}
                </motion.div>
              )}

              {activeTab === 'orders' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {detail.orderStats && (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total',     value: detail.orderStats.totalOrders,     color: 'primary' },
                        { label: 'Delivered', value: detail.orderStats.deliveredOrders, color: 'success' },
                        { label: 'Cancelled', value: detail.orderStats.cancelledOrders, color: 'error'   },
                      ].map(({ label, value, color }) => (
                        <div key={label} className={`bg-${color}/5 border border-${color}/20 rounded-xl p-3 text-center`}>
                          <p className={`text-2xl font-black text-${color}`}>{value}</p>
                          <p className="text-[10px] text-base-content/50 uppercase tracking-wider">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {detail.orderStats?.totalSpent && (
                    <div className="bg-success/5 border border-success/20 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-sm text-base-content/60 font-medium">Total Spent</span>
                      <span className="text-2xl font-black text-success">
                        ₹{Number(detail.orderStats.totalSpent).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {detail.orderHistory?.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50">Order History</h4>
                      {detail.orderHistory.map((order, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                          <div>
                            <p className="text-xs font-bold text-base-content">{order.orderId}</p>
                            <p className="text-[10px] text-base-content/50">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-base-content">
                              ₹{order.billing?.totalPayable?.toLocaleString('en-IN')}
                            </p>
                            <span
                              className={`badge badge-${order.delivery?.status === 'Delivered' ? 'success' : order.delivery?.status === 'Cancelled' ? 'error' : 'warning'}`}
                              style={{ fontSize: '9px' }}
                            >
                              {order.delivery?.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState message="No orders yet" />}
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-base-200/50 rounded-xl p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50">Login Count</p>
                      <p className="text-2xl font-black text-primary">{detail.security?.loginCount ?? 0}</p>
                    </div>
                    <div className="bg-base-200/50 rounded-xl p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50">Active Sessions</p>
                      <p className="text-2xl font-black text-primary">{detail.security?.totalSessions ?? 0}</p>
                    </div>
                  </div>
                  {detail.security?.lastLoginAt && (
                    <div className="flex justify-between items-center py-2 border-b border-base-300">
                      <span className="text-xs text-base-content/50">Last Login</span>
                      <span className="text-xs font-semibold">{new Date(detail.security.lastLoginAt).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {detail.security?.lastLoginIp && (
                    <div className="flex justify-between items-center py-2 border-b border-base-300">
                      <span className="text-xs text-base-content/50">Last IP</span>
                      <span className="text-xs font-mono font-semibold">{detail.security.lastLoginIp}</span>
                    </div>
                  )}
                  {sessLoading ? (
                    <div className="flex justify-center py-4"><LoadingSpinner /></div>
                  ) : sessions && sessions.length > 0 ? (
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-2">Active Sessions</h4>
                      <div className="space-y-2">
                        {sessions.map(session => (
                          <div key={session._id} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl gap-3">
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={session.platform} />
                              <div>
                                <p className="text-xs font-bold text-base-content">{session.deviceName}</p>
                                <p className="text-[10px] text-base-content/50">{session.ipAddress}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeSession(session._id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-error/10 text-error hover:bg-error/20 transition-colors"
                            >
                              <LogOut size={10} /> Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <EmptyState message="No active sessions" />}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERS BAR
// ─────────────────────────────────────────────────────────────────────────────

function FiltersBar({ filters, onFilterChange, onReset, onSearch }) {
  const [searchValue, setSearchValue] = useState(filters.search || '');

  const handleSearchSubmit = (e) => { e.preventDefault(); onSearch(searchValue); };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-base-200/40 border-b border-base-300">
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-52">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text" placeholder="Search name, email, phone…"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            className="input-field w-full pl-9 py-2 text-sm"
          />
        </div>
        <button type="submit" className="btn-primary-cta px-3 py-2 text-xs"><Search size={12} /></button>
      </form>

      <select
        className="input-field py-2 text-sm min-w-32"
        value={filters.role}
        onChange={e => onFilterChange({ role: e.target.value })}
      >
        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>

      <select
        className="input-field py-2 text-sm"
        value={filters.isBlocked !== undefined ? String(filters.isBlocked) : ''}
        onChange={e => onFilterChange({ isBlocked: e.target.value })}
      >
        <option value="">All Status</option>
        <option value="false">Active</option>
        <option value="true">Blocked</option>
      </select>

      <select
        className="input-field py-2 text-sm"
        value={filters.isEmailVerified !== undefined ? String(filters.isEmailVerified) : ''}
        onChange={e => onFilterChange({ isEmailVerified: e.target.value })}
      >
        <option value="">All Verified</option>
        <option value="true">Verified</option>
        <option value="false">Unverified</option>
      </select>

      <select
        className="input-field py-2 text-sm"
        value={`${filters.sortBy}_${filters.sortOrder}`}
        onChange={e => { const [sortBy, sortOrder] = e.target.value.split('_'); onFilterChange({ sortBy, sortOrder }); }}
      >
        <option value="createdAt_desc">Newest First</option>
        <option value="createdAt_asc">Oldest First</option>
        <option value="name_asc">Name A–Z</option>
        <option value="name_desc">Name Z–A</option>
      </select>

      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-base-content/60 hover:text-base-content bg-base-200 hover:bg-base-300 transition-colors"
      >
        <RefreshCw size={12} /> Reset
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER ROW (Table view)
// ─────────────────────────────────────────────────────────────────────────────

function UserRow({ user, onView, onBlock, onResetPwd, onDelete, mutLoading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="border-b border-base-300 hover:bg-primary/3 transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img
              src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=40&background=random`}
              alt={user.name}
              className="w-9 h-9 rounded-xl object-cover"
            />
            <div className="absolute -bottom-0.5 -right-0.5"><StatusDot online={user.isOnline} /></div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-base-content truncate max-w-36">{user.name}</p>
            <p className="text-xs text-base-content/50 truncate max-w-36">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <BlockBadge isBlocked={user.isCurrentlyBlocked ?? user.isBlocked} />
          <VerifyBadge verified={user.isEmailVerified} />
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-base-content/60">{new Date(user.createdAt).toLocaleDateString('en-IN')}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(user._id)}
            className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
            title="View Details"
          >
            <Eye size={13} />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
            >
              <MoreVertical size={13} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute right-0 top-8 z-20 w-44 card shadow-xl py-1 overflow-hidden"
                >
                  {[
                    { icon: user.isBlocked ? Shield : ShieldOff, label: user.isBlocked ? 'Unblock' : 'Block', color: user.isBlocked ? 'text-success' : 'text-error', onClick: () => { onBlock(user); setMenuOpen(false); } },
                    { icon: KeyRound, label: 'Reset Password', color: 'text-warning', onClick: () => { onResetPwd(user._id); setMenuOpen(false); } },
                    { icon: Trash2, label: 'Delete User', color: 'text-error', onClick: () => { onDelete(user._id); setMenuOpen(false); } },
                  ].map(({ icon: Icon, label, color, onClick }) => (
                    <button key={label} onClick={onClick} disabled={mutLoading}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold ${color} hover:bg-base-200 transition-colors disabled:opacity-50`}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER GRID CARD
// ─────────────────────────────────────────────────────────────────────────────

function UserGridCard({ user, onView, onBlock, onResetPwd, onDelete, mutLoading, index }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const roleCfg = ROLES.find(r => r.value === user.role) || ROLES[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.03, type: 'spring', damping: 22, stiffness: 280 }}
      className="card p-5 group relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: `var(--${roleCfg.color})` }}
      />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img
              src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=48&background=random`}
              alt={user.name}
              className="w-12 h-12 rounded-2xl object-cover border-2 border-base-300 group-hover:border-primary/40 transition-colors"
            />
            <div className="absolute -bottom-0.5 -right-0.5"><StatusDot online={user.isOnline} /></div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-base-content truncate max-w-28">{user.name}</p>
            <p className="text-[10px] text-base-content/50 truncate max-w-28">{user.email}</p>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical size={12} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88 }}
                className="absolute right-0 top-8 z-20 w-44 card shadow-xl py-1 overflow-hidden"
              >
                {[
                  { icon: EyeIcon, label: 'View Details', color: 'text-primary', onClick: () => { onView(user._id); setMenuOpen(false); } },
                  { icon: user.isBlocked ? Shield : ShieldOff, label: user.isBlocked ? 'Unblock' : 'Block', color: user.isBlocked ? 'text-success' : 'text-error', onClick: () => { onBlock(user); setMenuOpen(false); } },
                  { icon: KeyRound, label: 'Reset Password', color: 'text-warning', onClick: () => { onResetPwd(user._id); setMenuOpen(false); } },
                  { icon: Trash2, label: 'Delete User', color: 'text-error', onClick: () => { onDelete(user._id); setMenuOpen(false); } },
                ].map(({ icon: Icon, label, color, onClick }) => (
                  <button key={label} onClick={onClick} disabled={mutLoading}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold ${color} hover:bg-base-200 transition-colors disabled:opacity-50`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <RoleBadge role={user.role} />
        <BlockBadge isBlocked={user.isCurrentlyBlocked ?? user.isBlocked} />
      </div>

      <div className="space-y-1.5 mb-4">
        {user.phone && (
          <div className="flex items-center gap-2 text-[10px] text-base-content/50">
            <Phone size={9} /> <span className="truncate">{user.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px] text-base-content/50">
          <Calendar size={9} />
          <span>Joined {new Date(user.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {user.isEmailVerified
            ? <><CheckCircle2 size={9} className="text-success" /><span className="text-success">Email verified</span></>
            : <><Clock size={9} className="text-warning" /><span className="text-warning">Unverified</span></>}
        </div>
      </div>

      <button
        onClick={() => onView(user._id)}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-primary/8 text-primary hover:bg-primary/15 transition-colors"
      >
        <Eye size={11} /> View Details
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

function Pagination({ pagination, onPageChange, onLimitChange }) {
  const { total, page, limit, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between p-4 border-t border-base-300">
      <div className="flex items-center gap-2 text-xs text-base-content/60">
        <span>Show</span>
        <select
          className="input-field py-1 px-2 text-xs"
          value={limit}
          onChange={e => onLimitChange(Number(e.target.value))}
        >
          {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>of <strong className="text-base-content">{total.toLocaleString()}</strong> users ({from}–{to})</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="w-8 h-8 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i;
          if (p > totalPages) return null;
          return (
            <button
              key={p} onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                p === page ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300 text-base-content'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="w-8 h-8 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({ action, onConfirm, onCancel, loading }) {
  const configs = {
    block:    { title: 'Block User',     body: 'This will prevent the user from logging in.',              color: 'error',   icon: ShieldOff },
    unblock:  { title: 'Unblock User',   body: 'The user will regain access to their account.',            color: 'success', icon: Shield    },
    delete:   { title: 'Delete User',    body: 'This performs a soft delete. The action can be reversed.', color: 'error',   icon: Trash2    },
    resetPwd: { title: 'Reset Password', body: 'A new password will be generated and emailed to the user.',color: 'warning', icon: KeyRound  },
  };
  const cfg  = configs[action?.type] || configs.block;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="card w-full max-w-sm p-6 space-y-4"
      >
        <div className={`w-12 h-12 rounded-2xl bg-${cfg.color}/10 flex items-center justify-center mx-auto`}>
          <Icon size={24} className={`text-${cfg.color}`} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-base-content">{cfg.title}</h3>
          <p className="text-sm text-base-content/60 mt-1">{cfg.body}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-secondary py-2 text-sm">Cancel</button>
          <button
            onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all bg-${cfg.color} text-${cfg.color === 'warning' ? 'base-100' : `${cfg.color}-content`} hover:brightness-110 disabled:opacity-60`}
          >
            {loading ? <><LoadingSpinner size={14} /> Processing…</> : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function UsersManagement() {
  const dispatch = useDispatch();

  const users       = useSelector(selectAllUsers);
  const pagination  = useSelector(selectUsersPagination);
  const filters     = useSelector(selectUsersFilters);
  const listLoading = useSelector(selectListLoading);
  const errors      = useSelector(selectUsersErrors);
  const listError   = errors.list;
  const loadingMap  = useSelector(selectUsersLoading);
  const mutLoading  = loadingMap.block || loadingMap.resetPassword || loadingMap.delete;

  const [showCreate,    setShowCreate]    = useState(false);
  const [viewUserId,    setViewUserId]    = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [viewMode,      setViewMode]      = useState('table');

  useEffect(() => {
    dispatch(fetchAllUsers({ ...filters, page: pagination.page, limit: pagination.limit }));
  }, [filters, pagination.page, pagination.limit, dispatch]);

  const handleFilterChange = (changes) => dispatch(setFilters(changes));
  const handleSearch       = (search)  => dispatch(setFilters({ search }));
  const handleResetFilters = ()        => dispatch(setFilters({
    role: '', isBlocked: '', isEmailVerified: '', search: '',
    sortBy: 'createdAt', sortOrder: 'desc',
  }));

  const handlePageChange  = (page)  => dispatch(setPage(page));
  const handleLimitChange = (limit) => dispatch(setFilters({ limit }));

  const handleBlock    = (user)   => setConfirmAction({ type: user.isBlocked ? 'unblock' : 'block', userId: user._id, user });
  const handleResetPwd = (userId) => setConfirmAction({ type: 'resetPwd', userId });
  const handleDelete   = (userId) => setConfirmAction({ type: 'delete',   userId });

  const handleConfirm = () => {
    if (!confirmAction) return;
    const { type, userId } = confirmAction;
    if (type === 'block' || type === 'unblock') {
      dispatch(blockUnblockUser({ id: userId, action: type, reason: 'Admin action' }));
    } else if (type === 'resetPwd') {
      dispatch(resetUserPassword(userId));
    } else if (type === 'delete') {
      dispatch(deleteUser(userId));
    }
    setConfirmAction(null);
  };

  return (
    <div className="min-h-screen bg-base-100">

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-strong border-b border-base-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-base-content tracking-tight">Users Management</h1>
            <p className="text-sm text-base-content/50 mt-0.5">
              <strong className="text-base-content">{pagination.total.toLocaleString()}</strong> total users across all roles
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-base-200 rounded-xl p-1 gap-1">
              <button
                onClick={() => setViewMode('table')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  viewMode === 'table' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'
                }`}
                title="Table view"
              >
                <LayoutList size={15} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  viewMode === 'grid' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'
                }`}
                title="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
            <button
              onClick={() => dispatch(fetchAllUsers({ ...filters, page: pagination.page, limit: pagination.limit }))}
              disabled={listLoading}
              className="w-9 h-9 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={listLoading ? 'animate-spin text-primary' : 'text-base-content/60'} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary-cta flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <UserPlus size={15} /> New User
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* ── Analytics Section ── */}
        <AnalyticsSection users={users} pagination={pagination} filters={filters} />

        {/* ── Role Summary Pills ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-2"
        >
          <button
            onClick={() => handleFilterChange({ role: '' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filters.role === ''
                ? 'bg-primary text-primary-content border-primary'
                : 'bg-base-200 text-base-content/70 border-base-300 hover:border-primary/50'
            }`}
          >
            <Users size={11} />
            All · {pagination.total.toLocaleString()}
          </button>
          {ROLES.slice(1).map(r => {
            const Icon = r.icon;
            return (
              <button
                key={r.value}
                onClick={() => handleFilterChange({ role: r.value })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  filters.role === r.value
                    ? `bg-${r.color} text-${r.color}-content border-${r.color}`
                    : 'bg-base-200 text-base-content/70 border-base-300 hover:border-primary/50'
                }`}
              >
                <Icon size={11} />{r.label}
              </button>
            );
          })}
        </motion.div>

        {/* ── Table / Grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card overflow-hidden"
        >
          <FiltersBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            onSearch={handleSearch}
          />

          {listError && (
            <div className="p-4">
              <div className="alert alert-error text-sm">
                <XCircle size={14} className="text-error" /> {listError}
              </div>
            </div>
          )}

          {/* TABLE */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-base-200/60 border-b border-base-300">
                    {['User', 'Role', 'Status', 'Joined', 'Actions'].map(col => (
                      <th key={col} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-base-content/50">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {listLoading ? (
                      <tr>
                        <td colSpan={5} className="py-24 text-center"><LoadingSpinner size={32} /></td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={5}><EmptyState message="No users match your filters" /></td>
                      </tr>
                    ) : (
                      users.map(user => (
                        <UserRow
                          key={user._id} user={user}
                          onView={setViewUserId} onBlock={handleBlock}
                          onResetPwd={handleResetPwd} onDelete={handleDelete}
                          mutLoading={mutLoading}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* GRID */}
          {viewMode === 'grid' && (
            <div className="p-4">
              {listLoading ? (
                <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>
              ) : users.length === 0 ? (
                <EmptyState message="No users match your filters" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <AnimatePresence mode="popLayout">
                    {users.map((user, index) => (
                      <UserGridCard
                        key={user._id} user={user} index={index}
                        onView={setViewUserId} onBlock={handleBlock}
                        onResetPwd={handleResetPwd} onDelete={handleDelete}
                        mutLoading={mutLoading}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {pagination.total > 0 && (
            <Pagination
              pagination={pagination}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          )}
        </motion.div>
      </div>

      {/* ── Overlays ── */}
      <AnimatePresence>
        {showCreate && (
          <CreateUserModal
            onClose={() => { setShowCreate(false); dispatch(clearErrors()); dispatch(resetUploadState()); }}
          />
        )}
        {viewUserId && (
          <UserDetailDrawer userId={viewUserId} onClose={() => setViewUserId(null)} />
        )}
        {confirmAction && (
          <ConfirmDialog
            action={confirmAction}
            onConfirm={handleConfirm}
            onCancel={() => setConfirmAction(null)}
            loading={mutLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}