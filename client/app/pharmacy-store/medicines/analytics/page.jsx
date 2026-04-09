'use client';

import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Pill, ShieldCheck, Ban, DollarSign, TrendingUp, TrendingDown,
  BarChart3, PieChart, Activity, Layers, Package, Syringe, Droplets,
  Wind, Beaker, FlaskConical, Microscope, Heart, Zap, RefreshCw,
  ArrowUpRight, Boxes, Percent, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend, Treemap,
} from 'recharts';
import { fetchMedicines } from '@/store/slices/medicineSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Powder'];
const SCHEDULES  = ['H', 'H1', 'G', 'X', 'None'];

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
];

const CATEGORY_ICONS = {
  Tablet: Pill, Capsule: Package, Syrup: Droplets, Injection: Syringe,
  Ointment: FlaskConical, Drops: Droplets, Inhaler: Wind, Powder: Beaker,
};

// ─── Framer Variants ──────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.4, type: 'spring', damping: 20 } },
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs shadow-lg min-w-[100px]">
      {label && <p className="font-semibold opacity-60 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="opacity-70">{p.name || 'Value'}:</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '' }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, type: 'spring' }}
    >
      {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
    </motion.span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, trend, trendVal, delay = 0 }) {
  return (
    <motion.div variants={fadeUp} transition={{ delay }}
      whileHover={{ y: -4, scale: 1.015 }}
      className="glass-card p-5 relative overflow-hidden group cursor-default">
      {/* glow bg */}
      <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 85% 15%, ${color}18, transparent 65%)` }} />
      {/* animated accent line */}
      <motion.div className="absolute bottom-0 left-0 h-0.5 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ delay: delay + 0.3, duration: 0.9, ease: 'easeOut' }} />

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-xs font-semibold opacity-50 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold" style={{ color }}>
            <AnimatedNumber value={value} />
          </p>
          {sub && <p className="text-xs opacity-40">{sub}</p>}
        </div>
        <motion.div className="p-2.5 rounded-md flex-shrink-0"
          style={{ background: `${color}18` }}
          whileHover={{ rotate: 12, scale: 1.15 }}
          transition={{ type: 'spring', stiffness: 300 }}>
          <Icon size={20} style={{ color }} />
        </motion.div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3 relative z-10">
          {trend >= 0
            ? <TrendingUp size={12} style={{ color: 'var(--success)' }} />
            : <TrendingDown size={12} style={{ color: 'var(--error)' }} />}
          <span className="text-xs font-semibold" style={{ color: trend >= 0 ? 'var(--success)' : 'var(--error)' }}>
            {Math.abs(trendVal)}%
          </span>
          <span className="text-xs opacity-40">vs last month</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, color = 'var(--chart-1)', children, className = '' }) {
  return (
    <motion.div variants={fadeUp} className={`glass-card p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <motion.div className="p-1.5 rounded-md" style={{ background: `${color}18` }}
          whileHover={{ rotate: 8 }}>
          <Icon size={15} style={{ color }} />
        </motion.div>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MedicineAnalytics() {
  const dispatch = useDispatch();
  const { medicines, loading } = useSelector(s => s.medicine);

  useEffect(() => { dispatch(fetchMedicines({ page: 1 })); }, [dispatch]);

  const stats = useMemo(() => {
    const total       = medicines.length;
    const rx          = medicines.filter(m => m.isPrescriptionRequired).length;
    const otc         = total - rx;
    const discontinued = medicines.filter(m => m.isDiscontinued).length;
    const active      = total - discontinued;
    const avgMrp      = total ? Math.round(medicines.reduce((a, m) => a + (m.mrp || 0), 0) / total) : 0;
    const maxMrp      = total ? Math.max(...medicines.map(m => m.mrp || 0)) : 0;
    const minMrp      = total ? Math.min(...medicines.filter(m => m.mrp > 0).map(m => m.mrp)) : 0;
    const totalValue  = medicines.reduce((a, m) => a + (m.mrp || 0), 0);

    return { total, rx, otc, discontinued, active, avgMrp, maxMrp, minMrp, totalValue };
  }, [medicines]);

  // Category distribution
  const categoryData = useMemo(() =>
    CATEGORIES.map((cat, i) => ({
      name: cat,
      value: medicines.filter(m => m.category === cat).length,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).filter(d => d.value > 0),
  [medicines]);

  // Schedule breakdown
  const scheduleData = useMemo(() =>
    SCHEDULES.map((s, i) => ({
      name: s === 'None' ? 'Unscheduled' : `Sch. ${s}`,
      value: medicines.filter(m => m.schedule === s).length,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).filter(d => d.value > 0),
  [medicines]);

  // Prescription pie
  const rxData = useMemo(() => [
    { name: 'Prescription (Rx)', value: stats.rx, color: 'var(--chart-1)' },
    { name: 'Over-the-Counter', value: stats.otc, color: 'var(--chart-3)' },
  ], [stats]);

  // MRP range histogram
  const mrpRanges = useMemo(() => [
    { range: '₹0–50',    count: medicines.filter(m => m.mrp <= 50).length },
    { range: '₹51–100',  count: medicines.filter(m => m.mrp > 50 && m.mrp <= 100).length },
    { range: '₹101–200', count: medicines.filter(m => m.mrp > 100 && m.mrp <= 200).length },
    { range: '₹201–500', count: medicines.filter(m => m.mrp > 200 && m.mrp <= 500).length },
    { range: '₹501–1k',  count: medicines.filter(m => m.mrp > 500 && m.mrp <= 1000).length },
    { range: '₹1k+',     count: medicines.filter(m => m.mrp > 1000).length },
  ], [medicines]);

  // GST distribution
  const gstData = useMemo(() => {
    const map = {};
    medicines.forEach(m => { const k = `${m.gstPercentage}%`; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [medicines]);

  // Manufacturer top 8
  const manufacturerData = useMemo(() => {
    const map = {};
    medicines.forEach(m => { if (m.manufacturer) map[m.manufacturer] = (map[m.manufacturer] || 0) + 1; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [medicines]);

  // Category radar data (rx vs otc per category)
  const radarData = useMemo(() =>
    CATEGORIES.map(cat => {
      const catMeds = medicines.filter(m => m.category === cat);
      return {
        subject: cat,
        Rx:  catMeds.filter(m => m.isPrescriptionRequired).length,
        OTC: catMeds.filter(m => !m.isPrescriptionRequired).length,
      };
    }),
  [medicines]);

  // Active vs discontinued per category
  const statusData = useMemo(() =>
    CATEGORIES.map(cat => {
      const catMeds = medicines.filter(m => m.category === cat);
      return {
        name: cat,
        Active: catMeds.filter(m => !m.isDiscontinued).length,
        Discontinued: catMeds.filter(m => m.isDiscontinued).length,
      };
    }).filter(d => d.Active + d.Discontinued > 0),
  [medicines]);

  if (loading && medicines.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--base-100)' }}>
        <div className="text-center space-y-3">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm opacity-50">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)', color: 'var(--base-content)' }}>
      <div className="container-custom py-8">

        {/* ── Header ──────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <motion.div className="p-2.5 rounded-md"
                style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
                animate={{ rotate: [0, 6, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}>
                <BarChart3 size={22} />
              </motion.div>
              <h1 className="text-2xl font-bold text-gradient-primary">Medicine Analytics</h1>
            </div>
            <p className="text-sm opacity-50 ml-14">
              Real-time insights across {stats.total} medicines in your catalog
            </p>
          </div>
          <motion.button
            onClick={() => dispatch(fetchMedicines({ page: 1 }))}
            whileHover={{ rotate: 180 }} whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="p-2.5 rounded-md border border-[var(--base-300)] hover:border-[var(--primary)] transition-all">
            <RefreshCw size={16} />
          </motion.button>
        </motion.div>

        {/* ── KPI Stat Cards ───────────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Medicines"    value={stats.total}      sub={`${stats.active} active`}         icon={Pill}         color="var(--chart-1)" delay={0}    trend={1} trendVal={4.2} />
          <StatCard label="Prescription (Rx)"  value={stats.rx}         sub={`${stats.otc} OTC available`}     icon={ShieldCheck}   color="var(--chart-2)" delay={0.06} />
          <StatCard label="Avg. MRP"           value={`₹${stats.avgMrp}`} sub={`₹${stats.minMrp}–₹${stats.maxMrp} range`} icon={DollarSign} color="var(--chart-4)" delay={0.12} trend={1} trendVal={2.1} />
          <StatCard label="Discontinued"       value={stats.discontinued} sub={`${stats.active} still active`} icon={Ban}           color="var(--chart-6)" delay={0.18} />
        </motion.div>

        {/* ── Secondary KPI Row ────────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Catalog Value',  value: `₹${stats.totalValue.toLocaleString()}`, icon: Boxes,         color: 'var(--chart-3)' },
            { label: 'Max MRP',        value: `₹${stats.maxMrp}`,                       icon: ArrowUpRight,   color: 'var(--chart-5)' },
            { label: 'OTC Medicines',  value: stats.otc,                                icon: CheckCircle2,   color: 'var(--success)' },
            { label: 'Categories',     value: CATEGORIES.length,                        icon: Layers,         color: 'var(--info)' },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} transition={{ delay: i * 0.06 }}
              whileHover={{ y: -3, scale: 1.01 }}
              className="glass-card px-4 py-3 flex items-center gap-3 group cursor-default">
              <motion.div className="p-2 rounded-md flex-shrink-0"
                style={{ background: `${s.color}18` }}
                whileHover={{ rotate: 10 }}>
                <s.icon size={16} style={{ color: s.color }} />
              </motion.div>
              <div>
                <p className="text-xs opacity-50">{s.label}</p>
                <p className="font-bold text-sm" style={{ color: s.color }}>{s.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Charts Row 1: Category Bar + Rx Donut ───────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Category Bar */}
          <Section title="Medicines by Category" icon={BarChart3} color="var(--chart-1)" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} barSize={28} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Medicines" radius={[5, 5, 0, 0]}>
                  {categoryData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Rx vs OTC Donut */}
          <Section title="Prescription vs OTC" icon={PieChart} color="var(--chart-2)">
            <ResponsiveContainer width="100%" height={220}>
              <RPieChart>
                <Pie data={rxData} cx="50%" cy="45%" innerRadius={52} outerRadius={82}
                  dataKey="value" paddingAngle={4}
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
                    const RADIAN = Math.PI / 180;
                    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + r * Math.cos(-midAngle * RADIAN);
                    const y = cy + r * Math.sin(-midAngle * RADIAN);
                    return value > 0 ? (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {value}
                      </text>
                    ) : null;
                  }}>
                  {rxData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, opacity: 0.7 }} />
              </RPieChart>
            </ResponsiveContainer>
          </Section>
        </motion.div>

        {/* ── Charts Row 2: MRP Histogram + Status Stacked ────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          {/* MRP Range Histogram */}
          <Section title="MRP Price Distribution" icon={DollarSign} color="var(--chart-4)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mrpRanges} barSize={32} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Medicines" radius={[5, 5, 0, 0]}>
                  {mrpRanges.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Active vs Discontinued per Category */}
          <Section title="Active vs Discontinued by Category" icon={Activity} color="var(--chart-3)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} barSize={14} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, opacity: 0.7 }} />
                <Bar dataKey="Active" stackId="a" fill="var(--chart-3)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Discontinued" stackId="a" fill="var(--chart-6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </motion.div>

        {/* ── Charts Row 3: Radar + Schedule + GST ────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Radar: Rx vs OTC per category */}
          <Section title="Rx vs OTC by Category" icon={Microscope} color="var(--chart-5)" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="var(--base-300)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6 }} />
                <PolarRadiusAxis tick={{ fontSize: 9, opacity: 0.4 }} axisLine={false} />
                <Radar name="Prescription" dataKey="Rx" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.25} strokeWidth={2} />
                <Radar name="OTC" dataKey="OTC" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.25} strokeWidth={2} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, opacity: 0.7 }} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </Section>

          {/* Schedule + GST stacked */}
          <div className="flex flex-col gap-5">
            {/* Drug Schedule Pie */}
            <Section title="Schedule Distribution" icon={Layers} color="var(--chart-2)" className="flex-1">
              {scheduleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <RPieChart>
                    <Pie data={scheduleData} cx="50%" cy="50%" outerRadius={50}
                      dataKey="value" paddingAngle={3} labelLine={false}
                      label={({ name, value }) => `${name}:${value}`}>
                      {scheduleData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </RPieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs opacity-40 text-center py-6">No data</p>
              )}
            </Section>

            {/* GST Breakdown */}
            <Section title="GST Rate Split" icon={Percent} color="var(--chart-4)" className="flex-1">
              <div className="space-y-2">
                {gstData.map((g, i) => (
                  <div key={g.name} className="flex items-center gap-2">
                    <span className="text-xs w-10 font-semibold" style={{ color: g.color }}>{g.name}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden bg-[var(--base-300)]">
                      <motion.div className="h-full rounded-full"
                        style={{ background: g.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${medicines.length ? (g.value / medicines.length) * 100 : 0}%` }}
                        transition={{ delay: i * 0.1 + 0.5, duration: 0.7, ease: 'easeOut' }} />
                    </div>
                    <span className="text-xs font-bold w-6 text-right opacity-70">{g.value}</span>
                  </div>
                ))}
                {gstData.length === 0 && <p className="text-xs opacity-40 text-center py-3">No data</p>}
              </div>
            </Section>
          </div>
        </motion.div>

        {/* ── Charts Row 4: Manufacturer Treemap + Top Manufacturers Bar ── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          {/* Top Manufacturers */}
          <Section title="Top Manufacturers" icon={Boxes} color="var(--chart-3)">
            {manufacturerData.length > 0 ? (
              <div className="space-y-2.5">
                {manufacturerData.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold opacity-40 w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold truncate">{m.name}</span>
                        <span className="text-xs opacity-60 ml-2">{m.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-[var(--base-300)]">
                        <motion.div className="h-full rounded-full"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(m.value / manufacturerData[0].value) * 100}%` }}
                          transition={{ delay: i * 0.07 + 0.4, duration: 0.6, ease: 'easeOut' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs opacity-40 text-center py-8">No manufacturer data</p>
            )}
          </Section>

          {/* Category Summary Table */}
          <Section title="Category Summary" icon={Layers} color="var(--chart-5)">
            <div className="overflow-hidden rounded-md border border-[var(--base-300)]">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--base-200)' }}>
                    {['Category', 'Total', 'Rx', 'OTC', 'D/C'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold opacity-60">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map((cat, i) => {
                    const meds = medicines.filter(m => m.category === cat);
                    if (meds.length === 0) return null;
                    return (
                      <motion.tr key={cat}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.2 }}
                        className="border-t border-[var(--base-300)] hover:bg-[var(--base-200)] transition-colors">
                        <td className="px-3 py-2 font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{cat}</td>
                        <td className="px-3 py-2 font-bold">{meds.length}</td>
                        <td className="px-3 py-2">{meds.filter(m => m.isPrescriptionRequired).length}</td>
                        <td className="px-3 py-2">{meds.filter(m => !m.isPrescriptionRequired).length}</td>
                        <td className="px-3 py-2 text-[var(--error)]">{meds.filter(m => m.isDiscontinued).length}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </motion.div>

        {/* ── Quick Insights Row ───────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              title: 'Most Common Category',
              value: categoryData.sort((a, b) => b.value - a.value)[0]?.name || '—',
              sub: `${categoryData[0]?.value || 0} medicines`,
              icon: Pill, color: 'var(--chart-1)',
            },
            {
              title: 'Highest MRP',
              value: `₹${stats.maxMrp}`,
              sub: medicines.find(m => m.mrp === stats.maxMrp)?.name?.substring(0, 22) || '—',
              icon: ArrowUpRight, color: 'var(--chart-4)',
            },
            {
              title: 'Compliance Alert',
              value: `${medicines.filter(m => m.schedule !== 'None').length} Scheduled`,
              sub: 'Require special handling',
              icon: AlertTriangle, color: 'var(--warning)',
            },
          ].map((item, i) => (
            <motion.div key={item.title} variants={fadeUp} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3, scale: 1.01 }}
              className="glass-card p-4 flex items-center gap-4">
              <motion.div className="p-3 rounded-md flex-shrink-0"
                style={{ background: `${item.color}18` }}
                whileHover={{ scale: 1.15, rotate: 8 }}>
                <item.icon size={20} style={{ color: item.color }} />
              </motion.div>
              <div>
                <p className="text-xs opacity-50 font-semibold mb-0.5">{item.title}</p>
                <p className="font-bold" style={{ color: item.color }}>{item.value}</p>
                <p className="text-xs opacity-40">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}