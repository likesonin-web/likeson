"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Filter, Mail, Phone,
  CheckCircle2, AlertCircle, Loader2,
  Shield, Calendar, UserCheck, UserX,
  Stethoscope, Store, Truck, HeartHandshake,
  User, ShieldCheck, ShieldAlert, Wallet,
  Car, FlaskConical, RefreshCw, ChevronDown,
  Globe, X
} from 'lucide-react';
import { fetchEmployees } from '@/store/slices/userManagementSlice';

// ─── Role config (mirrors User schema enum) ───────────────────────────────────
const ROLE_META = {
  superadmin:       { color: 'var(--error)',     icon: ShieldAlert,    label: 'Super Admin',       group: 'admin' },
  admin:            { color: 'var(--primary)',   icon: ShieldCheck,    label: 'Admin',             group: 'admin' },
  customer:         { color: 'var(--success)',   icon: User,           label: 'Customer',          group: 'public' },
  finance:          { color: 'var(--warning)',   icon: Wallet,         label: 'Finance',           group: 'admin' },
  'care assistant': { color: 'var(--chart-5)',   icon: HeartHandshake, label: 'Care Assistant',    group: 'care' },
  doctor:           { color: 'var(--secondary)', icon: Stethoscope,    label: 'Doctor',            group: 'medical' },
  transportpartner: { color: 'var(--accent)',    icon: Car,            label: 'Transport Partner', group: 'logistics' },
  driver:           { color: 'var(--chart-1)',   icon: Truck,          label: 'Driver',            group: 'logistics' },
  pharmacy:         { color: 'var(--chart-2)',   icon: Store,          label: 'Pharmacy',          group: 'medical' },
  'lab partner':    { color: 'var(--chart-3)',   icon: FlaskConical,   label: 'Lab Partner',       group: 'medical' },
};

const FILTER_ROLES = [
  { value: '',               label: 'All Roles' },
  { value: 'superadmin',     label: 'Super Admin' },
  { value: 'admin',          label: 'Admin' },
  { value: 'finance',        label: 'Finance' },
  { value: 'doctor',         label: 'Doctor' },
  { value: 'pharmacy',       label: 'Pharmacy' },
  { value: 'driver',         label: 'Driver' },
  { value: 'transportpartner', label: 'Transport Partner' },
  { value: 'care assistant', label: 'Care Assistant' },
  { value: 'lab partner',    label: 'Lab Partner' },
];

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 20 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }) };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const cardAnim = {
  hidden:  { opacity: 0, scale: 0.96, y: 12 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.2 } },
};

// ─── Initials avatar fallback ─────────────────────────────────────────────────
const InitialsAvatar = ({ name, color }) => {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-full h-full flex items-center justify-center text-base font-black"
      style={{ background: `color-mix(in oklch, ${color} 14%, var(--base-200))`, color }}>
      {initials}
    </div>
  );
};

// ─── Employee Card ────────────────────────────────────────────────────────────
const EmployeeCard = React.memo(({ emp, index }) => {
  const meta   = ROLE_META[emp.role] || ROLE_META.customer;
  const RIcon  = meta.icon;
  const isBlocked = emp.isBlocked;

  return (
    <motion.div
      layout
      variants={cardAnim}
      custom={index}
      className="card relative overflow-hidden flex flex-col"
      style={{
        borderColor: isBlocked
          ? 'color-mix(in oklch, var(--error) 30%, var(--base-300))'
          : undefined,
      }}>

      {/* ── Top accent bar (role colour) ── */}
      <div className="h-1 w-full flex-shrink-0"
        style={{ background: `linear-gradient(90deg, ${meta.color}, color-mix(in oklch, ${meta.color} 50%, transparent))` }} />

      <div className="p-5 flex flex-col gap-4 flex-1">

        {/* ── Top row: avatar + name + status dot ── */}
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2"
              style={{ ringColor: `color-mix(in oklch, ${meta.color} 35%, transparent)` }}>
              {emp.avatar
                ? <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                : <InitialsAvatar name={emp.name} color={meta.color} />}
            </div>
            {/* Online/blocked dot */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={{
                background: isBlocked ? 'var(--error)' : emp.isOnline ? 'var(--success)' : 'var(--base-300)',
                borderColor: 'var(--base-100)',
              }}>
              <div className={`w-1.5 h-1.5 rounded-full bg-white ${!isBlocked && emp.isOnline ? 'animate-pulse' : ''}`} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-black text-sm leading-tight truncate" style={{ color: 'var(--base-content)' }}>
              {emp.name}
            </h3>
            {/* Role badge */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: `color-mix(in oklch, ${meta.color} 14%, var(--base-200))` }}>
                <RIcon size={11} style={{ color: meta.color }} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider"
                style={{ color: meta.color }}>{meta.label}</span>
            </div>
          </div>

          {/* Block badge */}
          {isBlocked && (
            <span className="badge badge-error text-[9px] flex-shrink-0">Blocked</span>
          )}
        </div>

        {/* ── Contact details ── */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--base-content)', opacity: 0.6 }}>
            <Mail size={12} className="flex-shrink-0" />
            <span className="truncate font-medium">{emp.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--base-content)', opacity: 0.6 }}>
            <Phone size={12} className="flex-shrink-0" />
            <span className="font-medium">{emp.phone || 'No phone linked'}</span>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="divider my-0" />

        {/* ── Meta grid ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Email verified */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Email</span>
            <div className="flex items-center gap-1">
              {emp.isEmailVerified
                ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                : <AlertCircle  size={12} style={{ color: 'var(--warning)' }} />}
              <span className="text-[10px] font-bold" style={{ color: emp.isEmailVerified ? 'var(--success)' : 'var(--warning)' }}>
                {emp.isEmailVerified ? 'Verified' : 'Pending'}
              </span>
            </div>
          </div>

          {/* Google auth */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Google</span>
            <div className="flex items-center gap-1">
              <Globe size={12} style={{ color: emp.googleAuth?.isVerified ? 'var(--info)' : 'var(--base-content)', opacity: emp.googleAuth?.isVerified ? 1 : 0.3 }} />
              <span className="text-[10px] font-bold" style={{ opacity: emp.googleAuth?.isVerified ? 1 : 0.4 }}>
                {emp.googleAuth?.isVerified ? 'Linked' : 'None'}
              </span>
            </div>
          </div>

          {/* Joined */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Joined</span>
            <span className="text-[10px] font-bold">
              {new Date(emp.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
            </span>
          </div>
        </div>

        {/* ── Action row ── */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {/* Work status pill */}
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
            style={{ background: 'var(--base-200)', color: 'var(--base-content)', opacity: 0.7 }}>
            {emp.workStatus || 'office'}
          </span>

          {isBlocked ? (
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:opacity-80"
              style={{ background: 'color-mix(in oklch, var(--success) 12%, var(--base-200))', color: 'var(--success)' }}>
              <UserCheck size={11} /> Unblock
            </button>
          ) : (
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:opacity-80"
              style={{ background: 'color-mix(in oklch, var(--error) 10%, var(--base-200))', color: 'var(--error)' }}>
              <UserX size={11} /> Block
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

EmployeeCard.displayName = 'EmployeeCard';

// ─── Stat pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, color }) => (
  <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
    style={{ background: `color-mix(in oklch, ${color} 10%, var(--base-200))` }}>
    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
    <span className="text-sm font-black" style={{ color }}>{value}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Employees() {
  const dispatch = useDispatch();
  const { employees = [], loading } = useSelector(state => state.userManagement);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter,  setRoleFilter]  = useState('');

  useEffect(() => {
    dispatch(fetchEmployees(roleFilter));
  }, [dispatch, roleFilter]);

  const safeEmployees = Array.isArray(employees) ? employees : [];

  const filteredEmployees = useMemo(() =>
    safeEmployees.filter(emp => {
      const matchSearch =
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === '' || emp.role === roleFilter;
      return matchSearch && matchRole;
    }),
  [safeEmployees, searchQuery, roleFilter]);

  // ── Derived stats ──
  const stats = useMemo(() => ({
    total:   safeEmployees.length,
    active:  safeEmployees.filter(e => !e.isBlocked).length,
    blocked: safeEmployees.filter(e =>  e.isBlocked).length,
    online:  safeEmployees.filter(e =>  e.isOnline).length,
  }), [safeEmployees]);

  const clearFilters = () => { setSearchQuery(''); setRoleFilter(''); };
  const hasFilters   = searchQuery || roleFilter;

  return (
    <div className="container-custom py-8 space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="section-heading flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--bg-gradient-primary)' }}>
              <Users size={20} style={{ color: 'var(--primary-content)' }} />
            </div>
            Workforce Directory
          </h1>
          <p className="section-subheading">Manage all registered system personnel.</p>
        </div>

        <button onClick={() => dispatch(fetchEmployees(roleFilter))}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
          style={{ background: 'var(--base-200)', color: 'var(--base-content)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </motion.div>

      {/* ── Stats row ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="flex flex-wrap gap-2">
        <StatPill label="Total"   value={stats.total}   color="var(--primary)" />
        <StatPill label="Active"  value={stats.active}  color="var(--success)" />
        <StatPill label="Online"  value={stats.online}  color="var(--info)" />
        <StatPill label="Blocked" value={stats.blocked} color="var(--error)" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl ml-auto"
          style={{ background: 'var(--base-200)' }}>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Showing</span>
          <span className="text-sm font-black" style={{ color: 'var(--primary)' }}>{filteredEmployees.length}</span>
        </div>
      </motion.div>

      {/* ── Filters ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}
        className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-30" />
          <input
            type="text"
            placeholder="Search by name or email…"
            className="input-field w-full pl-10 text-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="relative sm:w-52">
          <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-30" />
          <select
            className="input-field w-full pl-10 pr-8 appearance-none text-sm"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}>
            {FILTER_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" />
        </div>

        {/* Clear filters */}
        <AnimatePresence>
          {hasFilters && (
            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80 flex-shrink-0"
              style={{ background: 'color-mix(in oklch, var(--error) 10%, var(--base-200))', color: 'var(--error)' }}>
              <X size={12} /> Clear
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Active role filter badge ── */}
      <AnimatePresence>
        {roleFilter && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2">
            {(() => {
              const meta  = ROLE_META[roleFilter];
              const RIcon = meta?.icon || User;
              return (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: `color-mix(in oklch, ${meta?.color} 12%, var(--base-200))`, color: meta?.color }}>
                  <RIcon size={12} />
                  Filtered: {meta?.label || roleFilter}
                  <button onClick={() => setRoleFilter('')} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
                    <X size={11} />
                  </button>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid / Loading / Empty ── */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center glass-card">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow"
            style={{ background: 'var(--bg-gradient-primary)' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary-content)' }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Loading Personnel…</span>
        </div>
      ) : filteredEmployees.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredEmployees.map((emp, i) => (
              <EmployeeCard key={emp._id} emp={emp} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass-card py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--base-200)' }}>
            <Users size={28} style={{ color: 'var(--base-content)', opacity: 0.2 }} />
          </div>
          <div className="text-center">
            <h3 className="font-black uppercase tracking-widest text-sm" style={{ opacity: 0.35 }}>
              No matching personnel found
            </h3>
            {hasFilters && (
              <button onClick={clearFilters}
                className="mt-3 text-xs font-bold uppercase tracking-wider transition-all hover:opacity-70"
                style={{ color: 'var(--primary)' }}>
                Clear all filters
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}