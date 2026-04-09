'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Truck, Users, Star, TrendingUp, Clock, CheckCircle2,
  AlertCircle, IndianRupee, Zap, Activity, MapPin, ArrowUpRight,
  ArrowDownRight, Package, ShieldCheck, Ban, BarChart2,
} from 'lucide-react';
import { fetchTPDashboard } from '@/store/slices/transportPartnerSlice';

// ── Mock data (replace with real Redux state) ──────────────────────────────
const mockRidesData = [
  { month: 'Oct', completed: 38, cancelled: 4 },
  { month: 'Nov', completed: 52, cancelled: 6 },
  { month: 'Dec', completed: 45, cancelled: 3 },
  { month: 'Jan', completed: 61, cancelled: 5 },
  { month: 'Feb', completed: 74, cancelled: 7 },
  { month: 'Mar', completed: 88, cancelled: 4 },
];

const mockEarningsData = [
  { month: 'Oct', earnings: 42000 },
  { month: 'Nov', earnings: 58000 },
  { month: 'Dec', earnings: 51000 },
  { month: 'Jan', earnings: 67000 },
  { month: 'Feb', earnings: 82000 },
  { month: 'Mar', earnings: 96000 },
];

const mockVehicleStatus = [
  { name: 'Verified', value: 8, color: 'var(--success)' },
  { name: 'Pending',  value: 3, color: 'var(--warning)' },
  { name: 'Inactive', value: 2, color: 'var(--error)' },
];

const mockDriverStatus = [
  { name: 'Available', value: 5, color: 'var(--success)' },
  { name: 'On-Trip',   value: 3, color: 'var(--info)' },
  { name: 'Offline',   value: 4, color: 'var(--neutral)' },
];

// ── Animation variants ─────────────────────────────────────────────────────
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, trend, trendUp, color = 'primary' }) {
  const colorMap = {
    primary: 'var(--primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    info:    'var(--info)',
    error:   'var(--error)',
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <motion.div variants={item} className="glass-card p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${c}, transparent 82%)`, border: `1px solid color-mix(in srgb, ${c}, transparent 68%)` }}
        >
          <Icon size={20} style={{ color: c }} />
        </div>
        {trend !== undefined && (
          <span
            className="flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full"
            style={{
              background: trendUp
                ? 'color-mix(in srgb, var(--success), transparent 85%)'
                : 'color-mix(in srgb, var(--error), transparent 85%)',
              color: trendUp ? 'var(--success)' : 'var(--error)',
            }}
          >
            {trendUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{label}</p>
        <p className="text-2xl font-black font-montserrat" style={{ color: 'var(--base-content)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs" style={{ minWidth: 120 }}>
      <p className="font-bold mb-1" style={{ color: 'var(--base-content)' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>{p.name}:</span>
          <span className="font-bold ml-auto" style={{ color: 'var(--base-content)' }}>{prefix}{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)', border: '1px solid color-mix(in srgb, var(--primary), transparent 70%)' }}
      >
        <Icon size={17} style={{ color: 'var(--primary)' }} />
      </div>
      <div>
        <h3 className="text-base font-black font-montserrat leading-tight" style={{ color: 'var(--base-content)' }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Status Pill ────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    active:       { label: 'Active',       cls: 'badge-success' },
    pending:      { label: 'Pending',      cls: 'badge-warning' },
    suspended:    { label: 'Suspended',    cls: 'badge-error' },
    'under-review': { label: 'Under Review', cls: 'badge-info' },
  };
  const s = map[status] || { label: status, cls: 'badge-primary' };
  return <span className={`badge ${s.cls} text-xs`}>{s.label}</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function TransportPartnerDashboard() {
  const dispatch = useDispatch();
  const { dashboard, loading } = useSelector((s) => s.transportPartner);

  useEffect(() => {
    dispatch(fetchTPDashboard());
  }, [dispatch]);

  // Merge real data with mocks
  const d = dashboard || {};
  const stats = d.stats || {};
  const fleetInfo = d.fleetInfo || {};
  const rating = d.rating || {};
  const liveDriverStats = d.liveDriverStats || {};

  const statCards = [
    {
      icon: Truck,
      label: 'Total Vehicles',
      value: d.totalVehicles ?? 13,
      sub: `${d.verifiedVehicles ?? 8} verified`,
      trend: 8,
      trendUp: true,
      color: 'primary',
    },
    {
      icon: Users,
      label: 'Fleet Drivers',
      value: fleetInfo.totalDrivers ?? 12,
      sub: `${liveDriverStats.availableDrivers ?? 5} available now`,
      trend: 4,
      trendUp: true,
      color: 'success',
    },
    {
      icon: IndianRupee,
      label: 'Total Earnings',
      value: `₹${((stats.totalEarnings ?? 396000) / 1000).toFixed(0)}K`,
      sub: `₹${((d.totalSettled ?? 320000) / 1000).toFixed(0)}K settled`,
      trend: 17,
      trendUp: true,
      color: 'info',
    },
    {
      icon: Star,
      label: 'Avg Rating',
      value: rating.averageRating?.toFixed(1) ?? '4.7',
      sub: `${(rating.totalRatings ?? 342).toLocaleString()} ratings`,
      trend: 2,
      trendUp: true,
      color: 'warning',
    },
    {
      icon: CheckCircle2,
      label: 'Rides Completed',
      value: (stats.totalRidesCompleted ?? 358).toLocaleString(),
      sub: `${stats.totalRidesCancelled ?? 29} cancelled`,
      trend: 11,
      trendUp: true,
      color: 'success',
    },
    {
      icon: Clock,
      label: 'Avg Pickup Time',
      value: `${stats.averagePickupTimeMinutes ?? 7}m`,
      sub: `${stats.onTimeArrivalRate ?? 94}% on-time`,
      trend: 5,
      trendUp: false,
      color: 'error',
    },
    {
      icon: IndianRupee,
      label: 'Pending Settlement',
      value: `₹${((d.pendingSettlement ?? 76000) / 1000).toFixed(1)}K`,
      sub: 'Awaiting payout',
      color: 'warning',
    },
    {
      icon: Activity,
      label: 'On-Trip Now',
      value: liveDriverStats.onTripDrivers ?? 3,
      sub: 'Live active rides',
      color: 'info',
    },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ background: 'var(--base-100)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--success)' }}>Live Dashboard</span>
          </div>
          <h1 className="font-montserrat font-black text-3xl md:text-4xl" style={{ color: 'var(--base-content)' }}>
            Fleet Overview
          </h1>
          <p className="text-sm mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
            Real-time insights for your transport operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={d.partnershipStatus ?? 'active'} />
          {d.isOnboardingComplete === false && (
            <span className="badge badge-warning text-xs">Onboarding Incomplete</span>
          )}
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
      >
        {statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </motion.div>

      {/* Charts Row 1 */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
      >
        {/* Rides Chart */}
        <motion.div variants={item} className="glass-card p-5 lg:col-span-2">
          <SectionHeader icon={BarChart2} title="Rides Overview" subtitle="Completed vs Cancelled (6 months)" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockRidesData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--base-300), transparent 40%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--primary), transparent 92%)' }} />
              <Bar dataKey="completed" name="Completed" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cancelled"  name="Cancelled"  fill="var(--error)"   radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Vehicle Pie */}
        <motion.div variants={item} className="glass-card p-5">
          <SectionHeader icon={Truck} title="Vehicle Status" subtitle="Verification breakdown" />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={mockVehicleStatus} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                {mockVehicleStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {mockVehicleStatus.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>{s.name}</span>
                </div>
                <span className="font-bold" style={{ color: 'var(--base-content)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Charts Row 2 */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
      >
        {/* Earnings Area */}
        <motion.div variants={item} className="glass-card p-5 lg:col-span-2">
          <SectionHeader icon={TrendingUp} title="Earnings Trend" subtitle="Monthly earnings (₹)" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockEarningsData}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--base-300), transparent 40%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTooltip prefix="₹" />} />
              <Area type="monotone" dataKey="earnings" name="Earnings" stroke="var(--primary)" strokeWidth={2.5} fill="url(#earnGrad)" dot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--base-100)', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Driver Status Pie */}
        <motion.div variants={item} className="glass-card p-5">
          <SectionHeader icon={Users} title="Driver Status" subtitle="Live breakdown" />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={mockDriverStatus} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                {mockDriverStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {mockDriverStatus.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>{s.name}</span>
                </div>
                <span className="font-bold" style={{ color: 'var(--base-content)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Performance Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="glass-card p-5"
      >
        <SectionHeader icon={Zap} title="Performance Snapshot" subtitle="Key operational metrics at a glance" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {[
            { icon: CheckCircle2, label: 'On-Time Rate',     value: `${stats.onTimeArrivalRate ?? 94}%`,   color: 'var(--success)' },
            { icon: AlertCircle,  label: 'Disputes',         value: stats.totalRidesDisputed ?? 5,           color: 'var(--warning)' },
            { icon: IndianRupee,  label: 'Platform Fees',    value: `₹${((stats.totalPlatformFeePaid ?? 18700) / 1000).toFixed(1)}K`, color: 'var(--info)' },
            { icon: MapPin,       label: 'Service Zones',    value: d.serviceZones?.length ?? 3,             color: 'var(--primary)' },
            { icon: ShieldCheck,  label: 'KYC Status',       value: d.isOwnerKycComplete ? 'Verified' : 'Pending', color: d.isOwnerKycComplete ? 'var(--success)' : 'var(--warning)' },
            { icon: Ban,          label: 'Cancel Rate',       value: `${((stats.totalRidesCancelled ?? 29) / Math.max(stats.totalRidesCompleted ?? 358, 1) * 100).toFixed(1)}%`, color: 'var(--error)' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--base-200), transparent 40%)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}>
                <Icon size={17} style={{ color }} />
              </div>
              <div>
                <p className="text-base font-black font-montserrat leading-tight" style={{ color: 'var(--base-content)' }}>{value}</p>
                <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}