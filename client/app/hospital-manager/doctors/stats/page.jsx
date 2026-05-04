"use client";

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  Users, BadgeCheck, Activity, Wifi, WifiOff, Stethoscope,
  BarChart3, PieChart, RefreshCw, ChevronRight,
  UserX, Loader2, Building2, Video, Home, Award
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
  AreaChart, Area
} from "recharts";

import {
  fetchDoctorStats,
  selectDoctorStats,
  isLoading,
  getError,
} from "@/store/slices/hospitalManagerSlice";

// ─── Static chart data (not from DB — illustrative) ───────────────────────────
const CONSULT_TYPE_DATA = [
  { name: "In-Person", value: 18, icon: Building2 },
  { name: "Video",     value: 12, icon: Video },
  { name: "Home Visit", value: 6, icon: Home },
];

const ACTIVITY_DATA = [
  { day: "Mon", consultations: 42, online: 9 },
  { day: "Tue", consultations: 58, online: 11 },
  { day: "Wed", consultations: 37, online: 7 },
  { day: "Thu", consultations: 63, online: 14 },
  { day: "Fri", consultations: 71, online: 16 },
  { day: "Sat", consultations: 45, online: 10 },
  { day: "Sun", consultations: 22, online: 5 },
];

const PIE_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--accent)", "var(--secondary)"
];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-field)] shadow-xl px-3 py-2.5 text-xs">
      <p className="font-bold text-[var(--base-content)] mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-[var(--base-content)]/70">{p.name}:</span>
          <span className="font-semibold text-[var(--base-content)]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, subLabel, icon: Icon, color, note, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="card p-5 flex flex-col gap-3"
  >
    <div className="flex items-start justify-between">
      <div
        className="w-10 h-10 rounded-[var(--r-field)] flex items-center justify-center"
        style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <ChevronRight size={14} className="text-[var(--base-content)]/30 mt-1" />
    </div>
    <div>
      <p className="text-3xl font-black font-montserrat tracking-tight" style={{ color }}>{value}</p>
      <p className="text-sm font-semibold text-[var(--base-content)] mt-0.5">{label}</p>
      {subLabel && <p className="text-xs text-[var(--base-content)]/50 mt-0.5">{subLabel}</p>}
    </div>
    {note && (
      <p className="text-[10px] text-[var(--base-content)]/35 leading-snug border-t border-[var(--base-300)] pt-2">
        {note}
      </p>
    )}
  </motion.div>
);

// ─── Chart Card ───────────────────────────────────────────────────────────────
const ChartCard = ({ title, subtitle, note, children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="card p-5 flex flex-col gap-4"
  >
    <div>
      <p className="font-bold text-sm text-[var(--base-content)]">{title}</p>
      {subtitle && <p className="text-xs text-[var(--base-content)]/50">{subtitle}</p>}
    </div>
    {children}
    {note && (
      <p className="text-[10px] text-[var(--base-content)]/35 leading-snug border-t border-[var(--base-300)] pt-2">
        {note}
      </p>
    )}
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaffStats() {
  const dispatch   = useDispatch();
  const stats      = useSelector(selectDoctorStats);
  const loading    = useSelector(isLoading(fetchDoctorStats));
  const error      = useSelector(getError(fetchDoctorStats));

  useEffect(() => {
    dispatch(fetchDoctorStats());
  }, [dispatch]);

  const handleRefresh = () => dispatch(fetchDoctorStats());

  // ── Derived data (safe defaults when stats null) ──────────────────────────
  const total          = stats?.total          ?? 0;
  const verified       = stats?.verified       ?? 0;
  const active         = stats?.active         ?? 0;
  const online         = stats?.online         ?? 0;
  const unverified     = stats?.unverified     ?? 0;
  const bySpec         = stats?.bySpecialization ?? [];
  const specCount      = bySpec.length;

  // BUG FIX: sort BEFORE deriving max — original sorted then compared to [0] of unsorted
  const sortedSpec = useMemo(
    () => [...bySpec].sort((a, b) => b.count - a.count),
    [bySpec]
  );
  const maxSpecCount = sortedSpec[0]?.count ?? 1; // avoid /0

  const specBarData = useMemo(
    () => sortedSpec.map(s => ({
      name:     s._id.length > 12 ? s._id.slice(0, 11) + "…" : s._id,
      fullName: s._id,
      count:    s.count,
    })),
    [sortedSpec]
  );

  const KYC_DATA = useMemo(() => [
    { name: "Verified",   value: verified,              color: "var(--success)" },
    { name: "Pending",    value: unverified,             color: "var(--warning)" },
    { name: "Unverified", value: total - verified - unverified < 0 ? 0 : total - verified - unverified, color: "var(--error)" },
  ], [verified, unverified, total]);

  const RADIAL_DATA = useMemo(() => [
    { name: "Active",   value: total ? Math.round(active   / total * 100) : 0, fill: "var(--success)" },
    { name: "Verified", value: total ? Math.round(verified / total * 100) : 0, fill: "var(--primary)" },
    { name: "Online",   value: total ? Math.round(online   / total * 100) : 0, fill: "var(--info)" },
  ], [active, verified, online, total]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[var(--base-100)] flex items-center justify-center" data-theme="hospital">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
          <p className="text-sm text-[var(--base-content)]/50 font-medium">Loading staff statistics…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[var(--base-100)] flex items-center justify-center" data-theme="hospital">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <p className="text-sm font-semibold text-[var(--error)]">Failed to load stats</p>
          <p className="text-xs text-[var(--base-content)]/50">{error}</p>
          <button onClick={handleRefresh} className="btn-secondary text-xs px-4 py-2 mt-1">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── KPI card configs ──────────────────────────────────────────────────────
  const topCards = [
    {
      label: "Total Doctors", value: total,
      subLabel: "Linked to hospital", icon: Users, color: "var(--primary)",
      note: "All DoctorProfile records in the linkedDoctors array of this hospital", delay: 0,
    },
    {
      label: "Verified Doctors", value: verified,
      subLabel: total ? `${Math.round(verified / total * 100)}% of total` : "—",
      icon: BadgeCheck, color: "var(--success)",
      note: "Doctors with kycStatus === 'verified' — cleared for digital bookings", delay: 0.05,
    },
    {
      label: "Active Doctors", value: active,
      subLabel: `${total - active} inactive`, icon: Activity, color: "var(--info)",
      note: "Doctors with isActive: true — currently accepting consultations", delay: 0.1,
    },
    {
      label: "Currently Online", value: online,
      subLabel: "Right now", icon: Wifi, color: "var(--accent)",
      note: "Doctors with isOnline: true — live presence indicator", delay: 0.15,
    },
  ];

  const secondaryCards = [
    {
      label: "Unverified", value: unverified,
      subLabel: "KYC pending", icon: UserX, color: "var(--warning)",
      note: "Doctors who haven't completed KYC — cannot accept digital bookings", delay: 0.2,
    },
    {
      label: "Offline", value: total - online,
      subLabel: "Not active now", icon: WifiOff, color: "var(--base-content)",
      note: "Total linked doctors minus currently online count", delay: 0.25,
    },
    {
      label: "Specializations", value: specCount,
      subLabel: "Unique types", icon: Stethoscope, color: "var(--secondary)",
      note: "Number of distinct medical specializations across all linked doctors", delay: 0.3,
    },
    {
      label: "Avg. per Spec.", value: specCount ? (total / specCount).toFixed(1) : "—",
      subLabel: "Doctors/speciality", icon: Award, color: "var(--chart-5)",
      note: "Average doctors per specialization — useful for identifying gaps in coverage", delay: 0.35,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--base-100)] p-4 md:p-6 lg:p-8" data-theme="hospital">

      {/* Header */}
      <div className="mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-[var(--r-field)] bg-[var(--primary)] flex items-center justify-center">
              <BarChart3 size={15} className="text-[var(--primary-content)]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">Analytics</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--base-content)] font-montserrat tracking-tight">
            Staff Statistics
          </h1>
          <p className="text-sm text-[var(--base-content)]/50 mt-1">
            Real-time overview of all doctors linked to your hospital
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-xs px-5 py-2.5 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing…" : "Refresh Stats"}
        </button>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {topCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {secondaryCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Specialization bar chart */}
        <ChartCard
          title="Doctors by Specialization"
          subtitle="Distribution across all medical fields"
          note="Aggregated from DoctorProfile.specialization for all linked doctors"
          delay={0.4}
        >
          <div className="h-52">
            {specBarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--base-content)]/40">
                No specialization data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={specBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.6 }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.6 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Doctors" radius={[4, 4, 0, 0]}>
                    {specBarData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        {/* KYC Status pie */}
        <ChartCard
          title="KYC / Verification Status"
          subtitle="Breakdown by verification state"
          note="Verified = kycStatus 'verified'. Pending = unverified count from API."
          delay={0.45}
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={KYC_DATA}
                  cx="50%" cy="45%"
                  innerRadius={48} outerRadius={70}
                  paddingAngle={3} dataKey="value"
                >
                  {KYC_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Weekly activity area chart */}
        <ChartCard
          title="Weekly Consultation Activity"
          subtitle="Consultations & online doctors per day"
          note="Illustrative trend data — connect to bookings collection for live values"
          delay={0.5}
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ACTIVITY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="consultGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.6 }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.6 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="consultations" name="Consultations"
                  stroke="var(--primary)" strokeWidth={2} fill="url(#consultGrad)" />
                <Area type="monotone" dataKey="online" name="Online Doctors"
                  stroke="var(--accent)" strokeWidth={2} fill="url(#onlineGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Consultation types donut */}
        <ChartCard
          title="Consultation Types"
          subtitle="Offered across linked doctors"
          note="Illustrative — connect to DoctorProfile.consultationTypes for live values"
          delay={0.55}
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={CONSULT_TYPE_DATA}
                  cx="50%" cy="45%"
                  innerRadius={44} outerRadius={68}
                  paddingAngle={4} dataKey="value"
                >
                  {CONSULT_TYPE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Radial + Spec table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Radial availability */}
        <ChartCard
          title="Capacity Utilization Overview"
          subtitle="Active, Verified & Online rates against total staff"
          note="Radial bars show % of total linked doctors who are Active, Verified, and Online"
          delay={0.6}
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="85%" data={RADIAL_DATA}>
                <RadialBar
                  minAngle={15}
                  background
                  clockWise
                  dataKey="value"
                  cornerRadius={4}
                  label={{ position: "insideStart", fill: "var(--base-content)", fontSize: 11 }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`]} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Spec table */}
        <ChartCard
          title="Specialization Breakdown"
          subtitle="Ranked by doctor count"
          note="Derived from DoctorProfile.specialization aggregation via /doctors/stats"
          delay={0.65}
        >
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {sortedSpec.length === 0 ? (
              <p className="text-xs text-[var(--base-content)]/40 text-center py-6">No data yet</p>
            ) : (
              sortedSpec.map((s, i) => (
                <div key={s._id} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[var(--base-content)]/40 w-4 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-[var(--base-content)] truncate">{s._id}</span>
                      <span className="text-xs font-bold text-[var(--base-content)]/70 ml-2 flex-shrink-0">
                        {s.count}
                      </span>
                    </div>
                    <div className="progress-bar h-1.5">
                      <div
                        className="progress-bar-fill"
                        style={{
                          // BUG FIX: use pre-computed maxSpecCount not stats.bySpecialization[0].count
                          width: `${(s.count / maxSpecCount) * 100}%`,
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}