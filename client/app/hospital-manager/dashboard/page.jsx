'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Building2, Users, Stethoscope, Wifi, ShieldCheck, TrendingUp,
  BadgeCheck, AlertCircle, Clock, ChevronRight, Activity, Star,
  BellRing, MapPin, Phone, Globe, Zap, ArrowUpRight, ArrowDownRight,
  CalendarDays, DollarSign, Heart,
} from 'lucide-react';
import {
  fetchDashboard, fetchDoctorStats,
  selectDashboard, selectDoctorStats, isLoading,
  fetchDashboard as fetchDashboardThunk,
} from '@/store/slices/hospitalManagerSlice';

// ─── mock data for charts ────────────────────────────────────────────────────

const consultationTrend = [
  { day: 'Mon', inPerson: 42, video: 18, homeVisit: 6 },
  { day: 'Tue', inPerson: 55, video: 22, homeVisit: 8 },
  { day: 'Wed', inPerson: 48, video: 30, homeVisit: 5 },
  { day: 'Thu', inPerson: 63, video: 25, homeVisit: 12 },
  { day: 'Fri', inPerson: 70, video: 35, homeVisit: 9 },
  { day: 'Sat', inPerson: 80, video: 40, homeVisit: 15 },
  { day: 'Sun', inPerson: 35, video: 20, homeVisit: 4 },
];

const revenueData = [
  { month: 'Oct', revenue: 128000 },
  { month: 'Nov', revenue: 154000 },
  { month: 'Dec', revenue: 142000 },
  { month: 'Jan', revenue: 178000 },
  { month: 'Feb', revenue: 195000 },
  { month: 'Mar', revenue: 221000 },
];

const specialtyData = [
  { name: 'Cardiologist', value: 28, fill: 'var(--color-chart-1)' },
  { name: 'Neurologist',  value: 20, fill: 'var(--color-chart-2)' },
  { name: 'Pediatrician', value: 18, fill: 'var(--color-chart-3)' },
  { name: 'Orthopedic',   value: 15, fill: 'var(--color-chart-4)' },
  { name: 'Others',       value: 19, fill: 'var(--color-chart-5)' },
];

const recentActivity = [
  { id: 1, action: 'Dr. Ravi Kumar linked',        time: '2 min ago',  icon: Stethoscope, type: 'success' },
  { id: 2, action: 'Pricing updated by manager',   time: '18 min ago', icon: DollarSign,  type: 'info'    },
  { id: 3, action: 'License document uploaded',    time: '1 hr ago',   icon: ShieldCheck, type: 'success' },
  { id: 4, action: 'Dr. Priya Sharma unlinked',    time: '3 hrs ago',  icon: AlertCircle, type: 'warning' },
  { id: 5, action: 'Operating hours updated',      time: '5 hrs ago',  icon: Clock,       type: 'info'    },
  { id: 6, action: 'New booking confirmed',         time: '6 hrs ago',  icon: CalendarDays,type: 'success' },
];

// ─── animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } }),
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, delta, deltaLabel, color, delay, bg }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const isPos  = delta >= 0;

  return (
    <motion.div
      ref={ref}
      custom={delay}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      className="relative overflow-hidden rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm group"
      style={{ ['--hover-color']: color }}
      whileHover={{ y: -4, boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12)' }}
    >
      {/* Background blob */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 blur-2xl transition-all duration-500 group-hover:opacity-20"
        style={{ background: color }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex items-center justify-center w-11 h-11 rounded-xl"
          style={{ background: `color-mix(in oklch, ${color} 15%, transparent)` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
            isPos
              ? 'bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]'
              : 'bg-[color:var(--color-error)]/10 text-[color:var(--color-error)]'
          }`}
        >
          {isPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(delta)}%
        </span>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-[color:var(--color-base-content)]/60">{label}</p>
        <p className="mt-1 text-3xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)]">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--color-base-content)]/45">{deltaLabel}</p>
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, action, actionLabel }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="text-xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[color:var(--color-base-content)]/50">{subtitle}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action}
          className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--color-primary)] hover:gap-2.5 transition-all duration-200"
        >
          {actionLabel} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-3 shadow-xl text-xs">
      <p className="font-bold text-[color:var(--color-base-content)] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[color:var(--color-base-content)]/60">{p.name}:</span>
          <span className="font-semibold text-[color:var(--color-base-content)]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── main component ────────────────────────────────────────────────────────────

export default function Overview() {
  const dispatch    = useDispatch();
  const dashboard   = useSelector(selectDashboard);
  const doctorStats = useSelector(selectDoctorStats);
  const loading     = useSelector(isLoading(fetchDashboardThunk));

  useEffect(() => {
    dispatch(fetchDashboard());
    dispatch(fetchDoctorStats());
  }, [dispatch]);

  const hospital = dashboard?.hospital;
  const doctors  = dashboard?.doctors ?? { total: 0, verified: 0, online: 0 };
  const pricing  = dashboard?.pricing;

  const stats = [
    {
      icon: Users,
      label: 'Total Doctors',
      value: doctorStats?.total ?? doctors.total,
      delta: 12,
      deltaLabel: 'vs last month',
      color: 'var(--color-primary)',
    },
    {
      icon: BadgeCheck,
      label: 'Verified Doctors',
      value: doctorStats?.verified ?? doctors.verified,
      delta: 8,
      deltaLabel: 'KYC approved',
      color: 'var(--color-success)',
    },
    {
      icon: Wifi,
      label: 'Doctors Online',
      value: doctorStats?.online ?? doctors.online,
      delta: -3,
      deltaLabel: 'currently active',
      color: 'var(--color-accent)',
    },
    {
      icon: DollarSign,
      label: 'In-Person Fee',
      value: pricing?.inPersonFee ? `₹${pricing.inPersonFee}` : '₹600',
      delta: 0,
      deltaLabel: 'per consultation',
      color: 'var(--color-warning)',
    },
    {
      icon: Star,
      label: 'Avg Rating',
      value: hospital?.rating?.averageRating?.toFixed(1) ?? '4.7',
      delta: 5,
      deltaLabel: `${hospital?.rating?.totalRatings ?? 284} ratings`,
      color: 'var(--color-chart-4)',
    },
    {
      icon: Heart,
      label: 'Unread Alerts',
      value: dashboard?.unreadNotifications ?? 0,
      delta: -18,
      deltaLabel: 'pending notifications',
      color: 'var(--color-error)',
    },
  ];

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2 border-[color:var(--color-base-300)] border-t-[color:var(--color-primary)]"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-base-200)] p-6 lg:p-8">
      {/* ── Header ── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="mb-8"
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-primary)]/70">
                Dashboard
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)] leading-tight">
              {hospital?.name ?? 'Hospital Overview'}
            </h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {hospital?.address?.city && (
                <span className="flex items-center gap-1.5 text-sm text-[color:var(--color-base-content)]/55">
                  <MapPin size={13} />
                  {hospital.address.city}, {hospital.address.state}
                </span>
              )}
              {hospital?.contact?.phone && (
                <span className="flex items-center gap-1.5 text-sm text-[color:var(--color-base-content)]/55">
                  <Phone size={13} />
                  {hospital.contact.phone}
                </span>
              )}
              {hospital?.isVerified && (
                <span className="flex items-center gap-1 text-xs font-bold text-[color:var(--color-success)] bg-[color:var(--color-success)]/10 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={12} /> Verified
                </span>
              )}
              {!hospital?.isVerified && (
                <span className="flex items-center gap-1 text-xs font-bold text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10 px-2 py-0.5 rounded-full">
                  <AlertCircle size={12} /> Pending Verification
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[color:var(--color-primary)] text-[color:var(--color-primary-content)] text-sm font-bold shadow-lg shadow-[color:var(--color-primary)]/20"
            >
              <Zap size={15} />
              Quick Actions
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i} />
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

        {/* Consultation Trend — spans 2 cols */}
        <motion.div
          variants={fadeUp}
          custom={2}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="xl:col-span-2 rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm"
        >
          <SectionHeader
            title="Consultation Trend"
            subtitle="Weekly breakdown by type"
          />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={consultationTrend}>
              <defs>
                <linearGradient id="gradIP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gradVid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gradHV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-chart-3)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-3)" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: 'var(--color-base-content)', opacity: 0.45, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--color-base-content)', opacity: 0.45, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="inPerson"  name="In-Person"   stroke="var(--color-chart-1)" fill="url(#gradIP)"  strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="video"     name="Video"        stroke="var(--color-chart-2)" fill="url(#gradVid)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="homeVisit" name="Home Visit"   stroke="var(--color-chart-3)" fill="url(#gradHV)"  strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4">
            {[
              { label: 'In-Person', color: 'var(--color-chart-1)' },
              { label: 'Video',     color: 'var(--color-chart-2)' },
              { label: 'Home Visit',color: 'var(--color-chart-3)' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                <span className="text-xs text-[color:var(--color-base-content)]/55">{l.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Specialty Distribution */}
        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm"
        >
          <SectionHeader title="By Specialty" subtitle="Doctor distribution" />
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart
              innerRadius="35%"
              outerRadius="90%"
              data={specialtyData}
              startAngle={180}
              endAngle={-180}
            >
              <RadialBar
                minAngle={15}
                dataKey="value"
                cornerRadius={6}
                background={{ fill: 'var(--color-base-200)' }}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadialBarChart>
          </ResponsiveContainer>

          <div className="space-y-2 mt-2">
            {specialtyData.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                  <span className="text-xs text-[color:var(--color-base-content)]/60">{s.name}</span>
                </div>
                <span className="text-xs font-bold text-[color:var(--color-base-content)]">{s.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Revenue + Activity Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

        {/* Revenue Chart */}
        <motion.div
          variants={fadeUp}
          custom={1}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="xl:col-span-2 rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm"
        >
          <SectionHeader title="Monthly Revenue" subtitle="6-month overview" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--color-base-content)', opacity: 0.45, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--color-base-content)', opacity: 0.45, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']}
                content={<CustomTooltip />}
              />
              <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]}>
                {revenueData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === revenueData.length - 1
                      ? 'var(--color-primary)'
                      : 'var(--color-base-300)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          variants={fadeUp}
          custom={2}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm"
        >
          <SectionHeader title="Recent Activity" />
          <div className="space-y-3">
            {recentActivity.map((item, i) => {
              const Icon   = item.icon;
              const colors = {
                success: 'var(--color-success)',
                info:    'var(--color-info)',
                warning: 'var(--color-warning)',
              };
              const c = colors[item.type] || colors.info;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 group"
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                    style={{ background: `color-mix(in oklch, ${c} 15%, transparent)` }}
                  >
                    <Icon size={14} style={{ color: c }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[color:var(--color-base-content)] leading-snug">{item.action}</p>
                    <p className="text-xs text-[color:var(--color-base-content)]/40 mt-0.5">{item.time}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Pricing Summary Cards ── */}
      <motion.div
        variants={fadeUp}
        custom={1}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm"
      >
        <SectionHeader title="Consultation Pricing" subtitle="Current fee structure" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'In-Person',  fee: pricing?.inPersonFee  ?? 600,  honorarium: 400, icon: Users,       color: 'var(--color-chart-1)' },
            { label: 'Video',      fee: pricing?.videoFee     ?? 500,  honorarium: 350, icon: Activity,    color: 'var(--color-chart-2)' },
            { label: 'Home Visit', fee: pricing?.homeVisitFee ?? 1000, honorarium: 700, icon: MapPin,      color: 'var(--color-chart-3)' },
            { label: 'Follow-Up',  fee: pricing?.followUpFee  ?? 0,    honorarium: 0,   icon: CalendarDays,color: 'var(--color-chart-4)' },
          ].map((p) => {
            const PIcon = p.icon;
            return (
              <div
                key={p.label}
                className="rounded-xl p-4 border border-[color:var(--color-base-300)] bg-[color:var(--color-base-200)] group hover:border-current transition-colors duration-200"
                style={{ ['--hover']: p.color }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `color-mix(in oklch, ${p.color} 15%, transparent)` }}
                  >
                    <PIcon size={14} style={{ color: p.color }} />
                  </div>
                  <span className="text-xs font-bold text-[color:var(--color-base-content)]/60">{p.label}</span>
                </div>
                <p className="text-2xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)]">
                  {p.fee === 0 ? 'Free' : `₹${p.fee}`}
                </p>
                <p className="text-xs text-[color:var(--color-base-content)]/40 mt-1">
                  Honorarium: ₹{p.honorarium}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}