'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, Search, Shield, ShieldOff, RefreshCw, Mail, Trash2,
  Eye, ChevronLeft, ChevronRight, X, Check, AlertTriangle,
  TrendingUp, Activity, UserCheck, UserX, Stethoscope, Truck,
  FlaskConical, ShoppingBag, HeartPulse, DollarSign, Crown,
  Key, Smartphone, Clock, MapPin, Star, Lock, Unlock,
  SlidersHorizontal, Circle, Zap, BarChart2, Coins,
} from 'lucide-react';

import {
  fetchAllUsers,
  fetchUsersAnalytics,
  blockUnblockUser,
  resetUserPassword,
  verifyUserEmail,
  deleteUser,
  setFilters,
  setPage,
  selectAllUsers,
  selectUsersPagination,
  selectUsersFilters,
  selectUsersAnalytics,
  selectListLoading,
  selectAnalyticsLoading,
  selectBlockLoading,
} from '@/store/slices/adminUserSlice';

// ─────────────────────────────────────────────────────────────
// ROLES — values must exactly match User.role enum in DB
// ─────────────────────────────────────────────────────────────
const ROLES = [
  { value: '',                label: 'All',             icon: Users,        color: 'var(--primary)' },
  { value: 'customer',        label: 'Customers',       icon: Users,        color: 'oklch(65% 0.14 180)' },
  { value: 'doctor',          label: 'Doctors',         icon: Stethoscope,  color: 'oklch(65% 0.16 150)' },
  { value: 'pharmacy',        label: 'Pharmacy',        icon: ShoppingBag,  color: 'oklch(68% 0.15 50)'  },
  { value: 'transportpartner',label: 'Transport',       icon: Truck,        color: 'oklch(75% 0.15 70)'  },
  { value: 'care assistant',  label: 'Care Assistants', icon: HeartPulse,   color: 'oklch(62% 0.20 25)'  },
  { value: 'lab partner',     label: 'Lab Partners',    icon: FlaskConical, color: 'oklch(62% 0.16 280)' },
  { value: 'driver',          label: 'Drivers',         icon: Truck,        color: 'oklch(70% 0.13 60)'  },
  { value: 'finance',         label: 'Finance',         icon: DollarSign,   color: 'oklch(62% 0.16 230)' },
  { value: 'admin',           label: 'Admins',          icon: Shield,       color: 'oklch(55% 0.18 240)' },
  { value: 'superadmin',      label: 'Superadmin',      icon: Crown,        color: 'oklch(70% 0.15 50)'  },
];

// Map every role value → color (including space-bearing keys like 'care assistant')
const ROLE_COLOR_MAP = Object.fromEntries(ROLES.map(r => [r.value, r.color]));

const PIE_COLORS = [
  'var(--primary)',
  'oklch(65% 0.14 180)', 'oklch(65% 0.16 150)', 'oklch(68% 0.15 50)',
  'oklch(75% 0.15 70)',  'oklch(62% 0.20 25)',  'oklch(62% 0.16 280)',
  'oklch(70% 0.13 60)',  'oklch(62% 0.16 230)', 'oklch(55% 0.18 240)',
  'oklch(70% 0.15 50)',
];

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 18 },
    show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } },
  },
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const getRoleEntry = (role) => ROLES.find(r => r.value === role) ?? null;

const Avatar = ({ src, name, role, size = 40 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color    = ROLE_COLOR_MAP[role] ?? 'var(--primary)';
  if (src) {
    return (
      <img src={src} alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover ring-2 ring-white/20 shrink-0" />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.35,
        background: `color-mix(in srgb, ${color}, transparent 75%)`,
        border: `2px solid ${color}`, color }}
      className="rounded-full flex items-center justify-center font-black font-montserrat shrink-0">
      {initials}
    </div>
  );
};

const RoleBadge = ({ role }) => {
  const entry = getRoleEntry(role);
  const Icon  = entry?.icon ?? Circle;
  const color = entry?.color ?? 'var(--primary)';
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
      style={{
        background: `color-mix(in srgb, ${color}, transparent 85%)`,
        color,
        border: `1px solid color-mix(in srgb, ${color}, transparent 65%)`,
      }}>
      <Icon size={11} />
      {entry?.label ?? role}
    </span>
  );
};

const StatusDot = ({ online, blocked }) => {
  const color = blocked ? 'var(--error)' : online ? 'var(--success)' : 'var(--base-300)';
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-base-100"
      style={{ background: color }} />
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <motion.div variants={stagger.item}
    className="glass-card p-5 flex flex-col gap-3 relative overflow-hidden">
    <div className="absolute inset-0 opacity-5 pointer-events-none"
      style={{ background: `radial-gradient(circle at 80% 20%, ${color}, transparent 65%)` }} />
    <div className="p-2.5 rounded-xl w-fit"
      style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <div className="text-2xl font-black font-montserrat" style={{ color }}>{value ?? '—'}</div>
      <div className="text-xs font-semibold text-base-content/60 uppercase tracking-widest mt-0.5">{label}</div>
      {sub && <div className="text-xs text-base-content/45 mt-1">{sub}</div>}
    </div>
  </motion.div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-sm border border-primary/20 shadow-xl">
      <p className="font-bold text-base-content/70 mb-2 text-xs uppercase tracking-wider">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 font-semibold" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          {p.name}: <span className="text-base-content ml-1">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// USER ROW
// ─────────────────────────────────────────────────────────────

const UserRow = ({ user, onView, onBlock, onReset, onDelete, onVerify }) => {
  const [menu, setMenu] = useState(false);
  const blocked = user.isBlocked || user.isCurrentlyBlocked;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="border-b border-base-300/50 hover:bg-primary/[0.04] transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar src={user.avatar} name={user.name} role={user.role} size={36} />
            <StatusDot online={user.isOnline} blocked={blocked} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-base-content truncate max-w-[150px]">{user.name}</div>
            <div className="text-xs text-base-content/50 truncate max-w-[150px]">{user.email}</div>
          </div>
        </div>
      </td>

      {/* RoleBadge handles ALL role strings including 'care assistant', 'lab partner' */}
      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>

      <td className="px-4 py-3 text-xs text-base-content/60 font-mono">{user.phone || '—'}</td>

      <td className="px-4 py-3">
        {blocked
          ? <span className="badge badge-error text-[10px] gap-1"><ShieldOff size={9} />Blocked</span>
          : user.isEmailVerified
            ? <span className="badge badge-success text-[10px] gap-1"><Check size={9} />Verified</span>
            : <span className="badge badge-warning text-[10px] gap-1"><AlertTriangle size={9} />Unverified</span>
        }
      </td>

      <td className="px-4 py-3 text-xs text-base-content/50">
        {user.createdAt
          ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—'}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView(user)} title="View"
            className="p-1.5 rounded-lg hover:bg-primary/15 text-primary transition-colors">
            <Eye size={14} />
          </button>
          <button onClick={() => onBlock(user)} title={blocked ? 'Unblock' : 'Block'}
            className={`p-1.5 rounded-lg transition-colors ${blocked ? 'hover:bg-success/15 text-success' : 'hover:bg-error/15 text-error'}`}>
            {blocked ? <Unlock size={14} /> : <Lock size={14} />}
          </button>
          <div className="relative">
            <button onClick={() => setMenu(m => !m)}
              className="p-1.5 rounded-lg hover:bg-base-300 text-base-content/60 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -6 }}
                  className="absolute right-0 top-full mt-1 w-48 glass-card border border-base-300 z-50 py-1 shadow-xl"
                  onMouseLeave={() => setMenu(false)}
                >
                  {[
                    { icon: Key,    label: 'Reset Password', fn: () => { onReset(user._id);  setMenu(false); }, cls: 'text-warning' },
                    { icon: Mail,   label: 'Verify Email',   fn: () => { onVerify(user._id); setMenu(false); }, cls: 'text-info'    },
                    { icon: Trash2, label: 'Deactivate',     fn: () => { onDelete(user._id); setMenu(false); }, cls: 'text-error'   },
                  ].map(({ icon: Icon, label, fn, cls }) => (
                    <button key={label} onClick={fn}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold hover:bg-base-200 transition-colors ${cls}`}>
                      <Icon size={13} />{label}
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
};

// ─────────────────────────────────────────────────────────────
// USER DETAIL DRAWER
// ─────────────────────────────────────────────────────────────

const InfoRow = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-base-300/50 last:border-0">
      <div className="mt-0.5 text-base-content/40 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-base-content/50 uppercase tracking-wider font-semibold">{label}</div>
        <div className="text-sm font-medium text-base-content mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
};

const UserDrawer = ({ user, onClose }) => {
  const blocked = user.isBlocked || user.isCurrentlyBlocked;

  return (
    <motion.div className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="ml-auto w-full max-w-md h-full overflow-y-auto relative z-10"
        style={{ background: 'var(--base-100)', borderLeft: '1px solid var(--base-300)' }}
      >
        <div className="sticky top-0 z-10 p-5 border-b border-base-300 flex items-center gap-3"
          style={{ background: 'var(--base-100)' }}>
          <Avatar src={user.avatar} name={user.name} role={user.role} size={48} />
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg font-montserrat truncate">{user.name}</h3>
            <p className="text-xs text-base-content/50 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <RoleBadge role={user.role} />
              {blocked && <span className="badge badge-error text-[10px] gap-1"><ShieldOff size={9} />Blocked</span>}
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-base-200 text-base-content/50 shrink-0 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Logins', value: user.loginCount ?? 0,       icon: Activity },
              { label: 'Online', value: user.isOnline ? 'Yes' : 'No', icon: Circle  },
              { label: 'Coins',  value: user.coins ?? 0,             icon: Coins   },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="glass-card p-3 text-center">
                <Icon size={14} className="mx-auto mb-1 text-primary" />
                <div className="text-lg font-black font-montserrat text-primary">{value}</div>
                <div className="text-[10px] text-base-content/50 uppercase tracking-wider font-semibold">{label}</div>
              </div>
            ))}
          </div>

          <div className="glass-card p-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Account Info</h4>
            <InfoRow icon={<Mail size={14} />}       label="Email"        value={user.email} />
            <InfoRow icon={<Smartphone size={14} />} label="Phone"        value={user.phone} />
            <InfoRow icon={<MapPin size={14} />}     label="Last Address" value={user.lastKnownAddress} />
            <InfoRow icon={<Clock size={14} />}      label="Last Login"
              value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : null} />
            <InfoRow icon={<Star size={14} />}       label="Referral Code" value={user.referralCode} />
            <InfoRow icon={<Clock size={14} />}      label="Joined"
              value={user.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                : null} />
          </div>

          <div className="glass-card p-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Verification</h4>
            <div className="space-y-2.5">
              {[
                { label: 'Email Verified',   value: user.isEmailVerified, invert: false },
                { label: 'Phone Verified',   value: user.isPhoneVerified, invert: false },
                { label: 'Currently Online', value: user.isOnline,        invert: false },
                { label: 'Account Blocked',  value: blocked,              invert: true  },
              ].map(({ label, value, invert }) => {
                const good = invert ? !value : value;
                return (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-base-content/70">{label}</span>
                    <span className={`font-bold flex items-center gap-1 text-xs ${good ? 'text-success' : 'text-error'}`}>
                      {value ? <Check size={12} /> : <X size={12} />}
                      {value ? 'Yes' : 'No'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {blocked && user.blockReason && (
            <div className="glass-card p-4 border border-error/30">
              <h4 className="text-xs font-black uppercase tracking-widest text-error/70 mb-2">Block Reason</h4>
              <p className="text-sm text-base-content/70">{user.blockReason}</p>
              {user.unblockAt && (
                <p className="text-xs text-warning mt-2">
                  Auto-unblock: {new Date(user.unblockAt).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>
          )}

          {user.role === 'customer' && user.orderStats && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Order Summary</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Orders', value: user.orderStats.totalOrders },
                  { label: 'Delivered',    value: user.orderStats.deliveredOrders },
                  { label: 'Pending',      value: user.orderStats.pendingOrders },
                  { label: 'Total Spent',  value: `₹${user.orderStats.totalSpent}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-base-200 rounded-xl p-3">
                    <div className="text-lg font-black text-primary font-montserrat">{value}</div>
                    <div className="text-[10px] text-base-content/50 uppercase tracking-wider font-semibold">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user.role === 'doctor' && user.profile && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Doctor Info</h4>
              <InfoRow icon={<Stethoscope size={14} />} label="Specialization" value={user.profile.specialization} />
              <InfoRow icon={<Clock size={14} />}        label="Experience"
                value={user.profile.experienceYears ? `${user.profile.experienceYears} yrs` : null} />
              <InfoRow icon={<Shield size={14} />}       label="Reg. Number"  value={user.profile.registrationNumber} />
            </div>
          )}

          {user.role === 'transportpartner' && user.profile && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Agency Info</h4>
              <InfoRow icon={<Shield size={14} />} label="KYC Status"  value={user.profile.ownerKyc?.kycStatus} />
              <InfoRow icon={<Users size={14} />}  label="Business"    value={user.profile.businessName} />
              <InfoRow icon={<Truck size={14} />}  label="Type"        value={user.profile.businessType} />
            </div>
          )}

          {user.role === 'pharmacy' && user.profile && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Pharmacy Info</h4>
              <InfoRow icon={<ShoppingBag size={14} />} label="Pharmacist"   value={user.profile.pharmacistName} />
              <InfoRow icon={<Shield size={14} />}      label="Reg. Number"  value={user.profile.registrationNumber} />
              <InfoRow icon={<Star size={14} />}        label="Role in Store" value={user.profile.roleInStore} />
            </div>
          )}

          {user.role === 'care assistant' && user.profile && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Care Assistant Info</h4>
              <InfoRow icon={<Clock size={14} />}      label="Experience"
                value={user.profile.experienceYears ? `${user.profile.experienceYears} yrs` : null} />
              <InfoRow icon={<MapPin size={14} />}     label="Current City"  value={user.profile.availability?.currentCity} />
            </div>
          )}

          {user.role === 'lab partner' && user.profile && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-base-content/50 mb-3">Lab Partner Info</h4>
              <InfoRow icon={<FlaskConical size={14} />} label="Hospital" value={user.profile?.name} />
            </div>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const dispatch = useDispatch();

  const users         = useSelector(selectAllUsers);
  const pagination    = useSelector(selectUsersPagination);
  const filters       = useSelector(selectUsersFilters);
  const analytics     = useSelector(selectUsersAnalytics);
  const listLoading   = useSelector(selectListLoading);
  const analyticsLoad = useSelector(selectAnalyticsLoading);
  const blockLoading  = useSelector(selectBlockLoading);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [searchVal,    setSearchVal]    = useState('');
  const [activeRole,   setActiveRole]   = useState('');
  const [activeTab,    setActiveTab]    = useState('users');

  useEffect(() => {
    const t = setTimeout(() => dispatch(setFilters({ search: searchVal })), 400);
    return () => clearTimeout(t);
  }, [searchVal, dispatch]);

  useEffect(() => {
    dispatch(fetchAllUsers(filters));
  }, [filters, dispatch]);

  useEffect(() => {
    dispatch(fetchUsersAnalytics({}));
  }, [dispatch]);

  const applyRole = (role) => {
    setActiveRole(role);
    dispatch(setFilters({ role }));
  };

  const handleBlock  = (user) => dispatch(blockUnblockUser({ id: user._id, action: user.isBlocked ? 'unblock' : 'block' }));
  const handleReset  = (id)   => dispatch(resetUserPassword(id));
  const handleVerify = (id)   => dispatch(verifyUserEmail(id));
  const handleDelete = (id)   => dispatch(deleteUser(id));

  // ── chart data ─────────────────────────────────────────────
  const registrationData = (analytics?.registrationTrend ?? []).map(d => ({
    date:  d._id?.slice(5) ?? '',
    users: d.count,
  }));

  // All roles with data — uses exact key match so 'care assistant' etc. resolve correctly
  const roleData = analytics?.byRole
    ? Object.entries(analytics.byRole)
        .filter(([, count]) => count > 0)
        .map(([role, count]) => ({
          name:  getRoleEntry(role)?.label ?? role,
          value: count,
          role,
        }))
    : [];

  // Safe role count lookup — handles spaced role keys
  const roleCount = (roleValue) => analytics?.byRole?.[roleValue] ?? 0;

  const orderData = analytics?.orders
    ? Object.entries(analytics.orders).map(([status, v]) => ({
        status:  status.length > 9 ? status.slice(0, 9) : status,
        orders:  v.count,
        revenue: Math.round(v.revenue ?? 0),
      }))
    : [];

  const summary = analytics?.summary ?? {};

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── Sticky header ─────────────────────────────────── */}
      <div className="border-b border-base-300 sticky top-0 z-40 backdrop-blur-md"
        style={{ background: 'color-mix(in srgb, var(--base-100) 92%, transparent)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black font-montserrat text-base-content leading-none">
              Platform Users
            </h1>
            <p className="text-xs text-base-content/50 font-semibold uppercase tracking-widest mt-1">
              All roles · Customers · Staff · Partners
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl shrink-0"
            style={{ background: 'var(--base-200)' }}>
            {[
              { id: 'users',     label: 'Users',     icon: Users     },
              { id: 'analytics', label: 'Analytics', icon: BarChart2 },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  activeTab === id
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'text-base-content/60 hover:text-base-content'
                }`}>
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          <button onClick={() => dispatch(fetchAllUsers(filters))} title="Refresh"
            className="p-2.5 rounded-xl border border-base-300 hover:bg-base-200 text-base-content/60 transition-colors shrink-0">
            <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════
              USERS TAB
          ══════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Stat cards */}
              <motion.div variants={stagger.container} initial="hidden" animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <StatCard icon={Users}      label="Total Users"  value={summary.totalUsers}      color="var(--primary)"          sub="All roles" />
                <StatCard icon={Activity}   label="Online Now"   value={summary.onlineUsers}     color="oklch(65% 0.16 150)" />
                <StatCard icon={UserCheck}  label="Verified"     value={summary.verifiedEmails}  color="oklch(65% 0.14 180)"     sub={summary.verificationRate} />
                <StatCard icon={UserX}      label="Blocked"      value={summary.blockedUsers}    color="oklch(62% 0.20 25)" />
                <StatCard icon={Zap}        label="This Week"    value={summary.newThisWeek}     color="oklch(68% 0.15 50)" />
                <StatCard icon={TrendingUp} label="Verify Rate"  value={summary.verificationRate ?? '—'} color="oklch(62% 0.16 230)" />
              </motion.div>

              {/* Role filter pills — ALL roles, always rendered */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: 'none' }}>
                {ROLES.map(({ value, label, icon: Icon, color }) => {
                  const count  = value === '' ? (summary.totalUsers ?? 0) : roleCount(value);
                  const active = activeRole === value;
                  return (
                    <button
                      key={value}
                      onClick={() => applyRole(value)}
                      style={active ? { background: color, color: 'white', borderColor: color } : {}}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${
                        active
                          ? 'shadow-sm scale-105'
                          : 'border-base-300 text-base-content/60 hover:border-primary hover:text-primary'
                      }`}>
                      <Icon size={12} style={{ color: active ? 'white' : color }} />
                      {label}
                      {count > 0 && (
                        <span className="opacity-70 text-[10px]">({count})</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search + filter bar */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input type="text" value={searchVal}
                    onChange={e => setSearchVal(e.target.value)}
                    placeholder="Search name, email or phone…"
                    className="input-field w-full pl-10 pr-4 text-sm h-10" />
                  {searchVal && (
                    <button onClick={() => setSearchVal('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <button onClick={() => setShowFilters(f => !f)}
                  className={`flex items-center gap-2 px-4 h-10 rounded-xl border text-sm font-semibold transition-all ${
                    showFilters
                      ? 'bg-primary text-primary-content border-primary'
                      : 'border-base-300 text-base-content/70 hover:border-primary'
                  }`}>
                  <SlidersHorizontal size={14} />
                  Filters
                  {(filters.isBlocked || filters.isEmailVerified) && (
                    <span className="w-2 h-2 rounded-full bg-warning" />
                  )}
                </button>

                <select
                  value={`${filters.sortBy}:${filters.sortOrder}`}
                  onChange={e => {
                    const [sortBy, sortOrder] = e.target.value.split(':');
                    dispatch(setFilters({ sortBy, sortOrder }));
                  }}
                  className="input-field h-10 text-sm cursor-pointer"
                  style={{ background: 'var(--base-200)', minWidth: 160 }}>
                  {[
                    ['createdAt:desc', 'Newest First'],
                    ['createdAt:asc',  'Oldest First'],
                    ['name:asc',       'Name A→Z'],
                    ['name:desc',      'Name Z→A'],
                    ['loginCount:desc','Most Logins'],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Expanded filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-5">
                    <div className="glass-card p-4 flex flex-wrap items-center gap-4">
                      {[
                        { label: 'Blocked only',    field: 'isBlocked',       val: 'true'  },
                        { label: 'Verified only',   field: 'isEmailVerified', val: 'true'  },
                        { label: 'Unverified only', field: 'isEmailVerified', val: 'false' },
                      ].map(({ label, field, val }) => (
                        <label key={label} className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                          <input type="checkbox" className="accent-primary rounded"
                            checked={filters[field] === val}
                            onChange={e => dispatch(setFilters({ [field]: e.target.checked ? val : '' }))} />
                          {label}
                        </label>
                      ))}
                      <button
                        onClick={() => { dispatch(setFilters({ isBlocked: '', isEmailVerified: '', role: '' })); setActiveRole(''); }}
                        className="ml-auto text-xs text-error font-bold flex items-center gap-1 hover:underline">
                        <X size={12} /> Clear all
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Table */}
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: 'var(--base-200)' }}>
                        {['User', 'Role', 'Phone', 'Status', 'Joined', 'Actions'].map(col => (
                          <th key={col}
                            className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-base-content/50">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {listLoading
                          ? Array.from({ length: 8 }).map((_, i) => (
                            <tr key={i} className="border-b border-base-300/50">
                              {Array.from({ length: 6 }).map((_, j) => (
                                <td key={j} className="px-4 py-4">
                                  <div className="skeleton h-4 rounded-lg"
                                    style={{ width: `${45 + (i * 13 + j * 7) % 40}%` }} />
                                </td>
                              ))}
                            </tr>
                          ))
                          : users.length === 0
                          ? (
                            <tr>
                              <td colSpan={6} className="py-20 text-center">
                                <Users size={40} className="mx-auto mb-3 text-base-content/20" />
                                <p className="text-base-content/40 font-semibold">No users found</p>
                                <p className="text-xs text-base-content/30 mt-1">Try adjusting your filters</p>
                              </td>
                            </tr>
                          )
                          : users.map(user => (
                            <UserRow
                              key={user._id}
                              user={user}
                              onView={setSelectedUser}
                              onBlock={handleBlock}
                              onReset={handleReset}
                              onVerify={handleVerify}
                              onDelete={handleDelete}
                              actionLoading={blockLoading}
                            />
                          ))
                        }
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {!listLoading && pagination.totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-base-300 flex items-center justify-between gap-4">
                    <span className="text-xs text-base-content/50 font-semibold whitespace-nowrap">
                      {(pagination.page - 1) * pagination.limit + 1}–
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => dispatch(setPage(pagination.page - 1))}
                        disabled={pagination.page <= 1}
                        className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const p = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i;
                        return (
                          <button key={p} onClick={() => dispatch(setPage(p))}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                              pagination.page === p
                                ? 'bg-primary text-primary-content'
                                : 'hover:bg-base-200 text-base-content/60'
                            }`}>{p}</button>
                        );
                      })}
                      <button onClick={() => dispatch(setPage(pagination.page + 1))}
                        disabled={pagination.page >= pagination.totalPages}
                        className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════
              ANALYTICS TAB
          ══════════════════════════════════════════════ */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-6">

              <motion.div variants={stagger.container} initial="hidden" animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={Users}      label="Total"       value={summary.totalUsers}      color="var(--primary)" />
                <StatCard icon={Activity}   label="Online"      value={summary.onlineUsers}     color="oklch(65% 0.16 150)" />
                <StatCard icon={UserCheck}  label="Verified"    value={summary.verifiedEmails}  color="oklch(65% 0.14 180)" />
                <StatCard icon={UserX}      label="Blocked"     value={summary.blockedUsers}    color="oklch(62% 0.20 25)" />
                <StatCard icon={Zap}        label="This Week"   value={summary.newThisWeek}     color="oklch(68% 0.15 50)" />
                <StatCard icon={TrendingUp} label="Verify Rate" value={summary.verificationRate} color="oklch(62% 0.16 230)" />
              </motion.div>

              {/* Charts row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={stagger.item} initial="hidden" animate="show"
                  className="glass-card p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-black font-montserrat text-base">Registration Trend</h3>
                      <p className="text-xs text-base-content/50 mt-0.5">Last 30 days · All roles</p>
                    </div>
                    <div className="p-2 rounded-xl"
                      style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}>
                      <TrendingUp size={16} className="text-primary" />
                    </div>
                  </div>
                  {analyticsLoad
                    ? <div className="skeleton h-52 rounded-xl" />
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={registrationData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                          <defs>
                            <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                          <XAxis dataKey="date"
                            tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                            axisLine={false} tickLine={false} interval={4} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                            axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="users" name="Users"
                            stroke="var(--primary)" strokeWidth={2.5}
                            fill="url(#regGrad)" dot={false}
                            activeDot={{ r: 4, fill: 'var(--primary)' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )
                  }
                </motion.div>

                {/* Role pie — ALL roles with data */}
                <motion.div variants={stagger.item} initial="hidden" animate="show"
                  className="glass-card p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-black font-montserrat text-base">By Role</h3>
                      <p className="text-xs text-base-content/50 mt-0.5">{roleData.length} active roles</p>
                    </div>
                    <div className="p-2 rounded-xl"
                      style={{ background: 'color-mix(in srgb, oklch(65% 0.14 180), transparent 85%)' }}>
                      <Users size={16} style={{ color: 'oklch(65% 0.14 180)' }} />
                    </div>
                  </div>
                  {analyticsLoad
                    ? <div className="skeleton h-52 rounded-xl" />
                    : roleData.length > 0
                    ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={roleData} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                            {roleData.map((entry, i) => (
                              <Cell key={i}
                                fill={ROLE_COLOR_MAP[entry.role] ?? PIE_COLORS[i % PIE_COLORS.length]}
                                stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend iconType="circle" iconSize={8}
                            formatter={v => <span className="text-[10px] font-semibold text-base-content/70">{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )
                    : <div className="h-52 flex items-center justify-center text-base-content/30 text-sm">No data</div>
                  }
                </motion.div>
              </div>

              {/* Charts row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={stagger.item} initial="hidden" animate="show"
                  className="glass-card p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-black font-montserrat text-base">Order Status</h3>
                      <p className="text-xs text-base-content/50 mt-0.5">Pharmacy orders</p>
                    </div>
                    <div className="p-2 rounded-xl"
                      style={{ background: 'color-mix(in srgb, oklch(68% 0.15 50), transparent 85%)' }}>
                      <ShoppingBag size={16} style={{ color: 'oklch(68% 0.15 50)' }} />
                    </div>
                  </div>
                  {analyticsLoad
                    ? <div className="skeleton h-52 rounded-xl" />
                    : orderData.length > 0
                    ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={orderData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                          <XAxis dataKey="status"
                            tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                            axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                            axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="orders" name="Orders"
                            fill="oklch(68% 0.15 50)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    )
                    : <div className="h-52 flex items-center justify-center text-base-content/30 text-sm">No data</div>
                  }
                </motion.div>

                <motion.div variants={stagger.item} initial="hidden" animate="show"
                  className="glass-card p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-black font-montserrat text-base">Top Service Cities</h3>
                      <p className="text-xs text-base-content/50 mt-0.5">Care assistant coverage</p>
                    </div>
                    <div className="p-2 rounded-xl"
                      style={{ background: 'color-mix(in srgb, oklch(62% 0.16 280), transparent 85%)' }}>
                      <MapPin size={16} style={{ color: 'oklch(62% 0.16 280)' }} />
                    </div>
                  </div>
                  {analyticsLoad
                    ? <div className="skeleton h-52 rounded-xl" />
                    : (analytics?.topServiceCities?.length ?? 0) > 0
                    ? (
                      <div className="space-y-3 mt-2">
                        {analytics.topServiceCities.map((city, i) => {
                          const max = analytics.topServiceCities[0].count;
                          const pct = Math.round((city.count / max) * 100);
                          return (
                            <div key={city._id} className="flex items-center gap-3">
                              <span className="text-xs font-black text-base-content/40 w-4 shrink-0">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold text-base-content/80 truncate">{city._id}</span>
                                  <span className="text-xs font-black text-primary shrink-0 ml-2">{city.count}</span>
                                </div>
                                <div className="h-2 rounded-full bg-base-300 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ delay: i * 0.1 + 0.3, duration: 0.8, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                    : <div className="h-52 flex items-center justify-center text-base-content/30 text-sm">No city data</div>
                  }
                </motion.div>
              </div>

              {/* ALL role count cards — every role always rendered, 0 shown for empty */}
              {analytics?.byRole && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4">
                    Users by Role — click to filter
                  </h3>
                  <motion.div variants={stagger.container} initial="hidden" animate="show"
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {ROLES.slice(1).map(({ value, label, icon: Icon, color }) => (
                      <motion.div key={value} variants={stagger.item}
                        className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform duration-200"
                        onClick={() => { setActiveTab('users'); applyRole(value); }}>
                        <div className="p-2.5 rounded-xl shrink-0"
                          style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
                          <Icon size={18} style={{ color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xl font-black font-montserrat" style={{ color }}>
                            {roleCount(value)}
                          </div>
                          <div className="text-xs text-base-content/50 font-semibold truncate">{label}</div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User detail drawer */}
      <AnimatePresence>
        {selectedUser && (
          <UserDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}