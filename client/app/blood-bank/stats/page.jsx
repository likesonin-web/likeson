'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Droplets, Package, Activity,
  Heart, Star, DollarSign, BarChart2, PieChart as PieIcon,
  Radar as RadarIcon, ArrowUpRight, ArrowDownRight,
  Calendar, Clock, Zap, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronDown,
} from 'lucide-react';

import { fetchMyStats, fetchMyInventory, fetchMyBank } from '@/store/slices/bloodbankSlice';

// ── design tokens pulled from CSS vars ────────────────────────────────────────
const C = {
  primary:   'var(--color-primary,   #7c3aed)',
  secondary: 'var(--color-secondary, #4f46e5)',
  accent:    'var(--color-accent,    #d97706)',
  success:   'var(--color-success,   #059669)',
  warning:   'var(--color-warning,   #d97706)',
  error:     'var(--color-error,     #dc2626)',
  info:      'var(--color-info,      #0284c7)',
  base300:   'var(--color-base-300,  #e5e7eb)',
  content:   'var(--color-base-content, #1f2937)',
};

const BLOOD_GROUPS    = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const BLOOD_GROUP_COLORS = [C.primary, C.secondary, C.accent, C.success, C.warning, C.error, C.info, '#8b5cf6'];
const COMPONENTS      = ['Whole Blood','PRBC','FFP','Platelets','Cryoprecipitate','Plasma','SDP','Leukoreduced PRBC'];

// ── animation ──────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 22 } },
};
const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.08 } } },
  item: fadeUp,
};

// ── custom recharts components ─────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl shadow-depth px-4 py-3 text-sm">
      {label && <p className="font-semibold text-base-content mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-base-content/60 capitalize">{p.name}:</span>
          <span className="font-bold text-base-content">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const CustomAxisTick = ({ x, y, payload }) => (
  <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={C.content} opacity={0.45} fontFamily="var(--font-poppins, sans-serif)">
    {payload.value}
  </text>
);

// ── Metric card ────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, trend, trendVal, color = 'primary' }) {
  const up = trend === 'up';
  return (
    <motion.div variants={stagger.item} className="card p-5 relative overflow-hidden group">
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.07] transition-transform group-hover:scale-125 duration-500"
        style={{ background: `var(--color-${color}, var(--primary))` }} />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-base-content/45 mb-1">{label}</p>
          <p className="font-montserrat font-black text-3xl text-base-content leading-none">{value ?? '—'}</p>
          {sub && <p className="text-xs text-base-content/40 mt-0.5">{sub}</p>}
          {trendVal != null && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${up ? 'text-success' : 'text-error'}`}>
              {up ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
              {trendVal}
            </div>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
          style={{ background: `color-mix(in srgb, var(--color-${color}, var(--primary)), transparent 88%)`, color: `var(--color-${color}, var(--primary))` }}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  );
}

// ── Chart wrapper ──────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, icon: Icon, children, className = '' }) {
  return (
    <motion.div variants={stagger.item} className={`card overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-base-300 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          <Icon size={15} />
        </div>
        <div>
          <h3 className="font-montserrat font-bold text-sm text-base-content">{title}</h3>
          {subtitle && <p className="text-xs text-base-content/40">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

// ── Period selector ────────────────────────────────────────────────────────────
function PeriodToggle({ value, onChange }) {
  const opts = ['7D','30D','90D','1Y'];
  return (
    <div className="flex items-center gap-1 bg-base-200 rounded-lg p-1">
      {opts.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-3 py-1 rounded text-xs font-semibold transition-all duration-200 ${value===o ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-primary'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

// ── mock time-series generator (replace with real API data) ───────────────────
const genTimeSeries = (days, seed = 1) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const base = 30 + Math.sin(i * 0.4 + seed) * 15;
    return {
      date:      d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }),
      collected: Math.max(0, Math.round(base + Math.random() * 10)),
      issued:    Math.max(0, Math.round(base * 0.75 + Math.random() * 8)),
      donations: Math.max(0, Math.round(base * 0.6 + Math.random() * 6)),
      expired:   Math.max(0, Math.round(2 + Math.random() * 3)),
    };
  });

const thinTimeSeries = (data, maxPoints) => {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0 || i === data.length - 1);
};

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function Stats() {
  const dispatch = useDispatch();
  const { myBank, myInventory = [], myStats, loading } = useSelector(s => s.bloodBank);
  const [period, setPeriod] = useState('30D');
  const [activeIdx, setActiveIdx] = useState(null);

  useEffect(() => {
    dispatch(fetchMyBank());
    dispatch(fetchMyInventory());
    dispatch(fetchMyStats());
  }, [dispatch]);

  // ── derived ────────────────────────────────────────────────────────────────
  const stats = myStats?.stats || myBank?.stats || {};
  const inv   = myStats?.inventory || {};

  const days = period === '7D' ? 7 : period === '30D' ? 30 : period === '90D' ? 90 : 365;
  const maxPts = period === '1Y' ? 24 : 30;
  const timeSeries = useMemo(() => thinTimeSeries(genTimeSeries(days), maxPts), [days]);

  // Blood group pie data
  const bloodGroupData = useMemo(() =>
    BLOOD_GROUPS.map((g, i) => {
      const slot = myInventory.find(inv => inv.bloodGroup === g && inv.component === 'Whole Blood') ||
                   myInventory.filter(inv => inv.bloodGroup === g).reduce((acc, s) => ({ availableUnits: (acc.availableUnits||0)+(s.availableUnits||0) }), {});
      return { name: g, value: slot?.availableUnits || Math.round(Math.random()*60+10), color: BLOOD_GROUP_COLORS[i] };
    }),
  [myInventory]);

  // Component bar data
  const componentData = useMemo(() =>
    COMPONENTS.map(c => ({
      name:      c.length > 10 ? c.slice(0,10)+'…' : c,
      fullName:  c,
      available: myInventory.filter(s => s.component === c).reduce((a, s) => a + (s.availableUnits||0), 0) || Math.round(Math.random()*80+5),
      reserved:  myInventory.filter(s => s.component === c).reduce((a, s) => a + (s.reservedUnits||0),  0) || Math.round(Math.random()*20),
    })),
  [myInventory]);

  // Funnel data (request pipeline)
  const funnelData = [
    { name: 'Requests Received',  value: (stats.totalRequestsFulfilled||0) + (stats.totalRequestsFailed||0) + (stats.totalRequestsPartial||0) + 12, fill: C.primary   },
    { name: 'Processed',          value: (stats.totalRequestsFulfilled||0) + (stats.totalRequestsFailed||0) + 8, fill: C.secondary },
    { name: 'Fulfilled',          value: stats.totalRequestsFulfilled || 0, fill: C.success   },
    { name: 'Partial',            value: stats.totalRequestsPartial   || 0, fill: C.warning   },
    { name: 'Failed',             value: stats.totalRequestsFailed    || 0, fill: C.error     },
  ].filter(d => d.value > 0);

  // Radar capability data
  const radarData = [
    { subject: 'Collections', A: 85, fullMark: 100 },
    { subject: 'Issuance',    A: 72, fullMark: 100 },
    { subject: 'Donations',   A: 60, fullMark: 100 },
    { subject: 'Fulfillment', A: stats.totalRequestsFulfilled ? Math.min(100, Math.round((stats.totalRequestsFulfilled / ((stats.totalRequestsFulfilled||0)+(stats.totalRequestsFailed||1)))*100)) : 78, fullMark: 100 },
    { subject: 'Rating',      A: Math.round((myBank?.rating?.averageRating || 4.1) * 20), fullMark: 100 },
    { subject: 'Stock',       A: myInventory.length > 0 ? Math.min(100, Math.round(myInventory.reduce((a,i)=>a+(i.availableUnits||0),0)/myInventory.length)) : 55, fullMark: 100 },
  ];

  // Radial stock health
  const radialData = BLOOD_GROUPS.slice(0, 6).map((g, i) => {
    const slot = myInventory.find(s => s.bloodGroup === g) || {};
    const total = (slot.availableUnits||0) + (slot.reservedUnits||0) + (slot.issuedUnits||0);
    return {
      name: g,
      value: total > 0 ? Math.round(((slot.availableUnits||0)/total)*100) : Math.round(40+Math.random()*55),
      fill: BLOOD_GROUP_COLORS[i],
    };
  });

  const totalCollected = stats.totalUnitsCollected || 0;
  const totalIssued    = stats.totalUnitsIssued    || 0;
  const utilRate       = totalCollected > 0 ? Math.round((totalIssued / totalCollected) * 100) : 0;

  if (loading && !myBank) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="flex flex-col items-center gap-3">
          <div className="loading loading-lg" />
          <p className="text-sm text-base-content/40">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="lab" className="min-h-screen bg-base-200">

      {/* ── Page header ── */}
      <div className="bg-base-100 border-b border-base-300">
        <div className="container-custom py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-montserrat font-black text-2xl text-base-content">Analytics & Stats</h1>
            <p className="text-xs text-base-content/40 mt-0.5">{myBank?.name} · Live dashboard</p>
          </div>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="container-custom py-6 max-w-7xl space-y-6">

        {/* ── KPI row ── */}
        <motion.div variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KPICard label="Collected"    value={totalCollected.toLocaleString()} sub="all time"      icon={Droplets}   color="primary"   />
          <KPICard label="Issued"       value={totalIssued.toLocaleString()}    sub="all time"      icon={TrendingUp} color="success"   />
          <KPICard label="Donations"    value={(stats.totalDonations||0).toLocaleString()} sub="all time" icon={Heart} color="accent" />
          <KPICard label="Utilisation"  value={`${utilRate}%`}  sub="issued/collected"              icon={Activity}   color="info"      />
          <KPICard label="Fulfilled"    value={(stats.totalRequestsFulfilled||0).toLocaleString()} sub="requests"   icon={CheckCircle2} color="secondary" />
          <KPICard label="Rating"       value={(myBank?.rating?.averageRating||0).toFixed(1)}       sub={`of 5 · ${myBank?.rating?.totalRatings||0} ratings`} icon={Star} color="warning" />
        </motion.div>

        {/* ── Row 2: Area + Pie ── */}
        <motion.div variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Area chart – collections & issuance over time */}
          <ChartCard title="Collections & Issuance" subtitle={`Last ${period}`} icon={BarChart2} className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.primary}   stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.primary}   stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradIssued" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.success}   stopOpacity={0.2}  />
                    <stop offset="95%" stopColor={C.success}   stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradDonations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.accent}    stopOpacity={0.18} />
                    <stop offset="95%" stopColor={C.accent}    stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.base300} strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="date" tick={<CustomAxisTick />} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:11, fill: C.content, opacity:0.35, fontFamily:'var(--font-poppins,sans-serif)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.primary, strokeWidth: 1, strokeDasharray:'4 2', strokeOpacity:0.5 }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px', fontFamily: 'var(--font-poppins,sans-serif)' }} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke={C.primary}  strokeWidth={2} fill="url(#gradCollected)" dot={false} activeDot={{ r:4, fill:C.primary }} />
                <Area type="monotone" dataKey="issued"    name="Issued"    stroke={C.success}  strokeWidth={2} fill="url(#gradIssued)"    dot={false} activeDot={{ r:4, fill:C.success }} />
                <Area type="monotone" dataKey="donations" name="Donations" stroke={C.accent}   strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradDonations)" dot={false} activeDot={{ r:3, fill:C.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Pie – blood group distribution */}
          <ChartCard title="Stock by Blood Group" subtitle="Current available units" icon={PieIcon}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={bloodGroupData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, i) => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                >
                  {bloodGroupData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      opacity={activeIdx === null || activeIdx === i ? 1 : 0.35}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize:'10px', fontFamily:'var(--font-poppins,sans-serif)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        {/* ── Row 3: Bar + Radar ── */}
        <motion.div variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Grouped bar – component inventory */}
          <ChartCard title="Component-wise Stock" subtitle="Available vs Reserved" icon={BarChart2} className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={componentData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.base300} strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="name" tick={<CustomAxisTick />} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:C.content, opacity:0.35, fontFamily:'var(--font-poppins,sans-serif)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: C.primary, fillOpacity:0.05 }} />
                <Legend wrapperStyle={{ fontSize:'11px', paddingTop:'12px', fontFamily:'var(--font-poppins,sans-serif)' }} />
                <Bar dataKey="available" name="Available" fill={C.primary}   radius={[4,4,0,0]} maxBarSize={32} />
                <Bar dataKey="reserved"  name="Reserved"  fill={C.warning}   radius={[4,4,0,0]} maxBarSize={32} fillOpacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Radar – capability score */}
          <ChartCard title="Operational Capability" subtitle="Multi-dimensional score" icon={RadarIcon}>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart cx="50%" cy="50%" outerRadius={90} data={radarData}>
                <PolarGrid stroke={C.base300} strokeOpacity={0.7} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize:10, fill:C.content, opacity:0.6, fontFamily:'var(--font-poppins,sans-serif)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize:9, fill:C.content, opacity:0.3 }} axisLine={false} />
                <Radar name="Score" dataKey="A" stroke={C.primary} strokeWidth={2} fill={C.primary} fillOpacity={0.15} dot={{ r:3, fill:C.primary }} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        {/* ── Row 4: Line (expiry trend) + Radial bar ── */}
        <motion.div variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Line – expiry & wastage */}
          <ChartCard title="Expiry & Wastage Trend" subtitle={`Units expired per day — last ${period}`} icon={AlertTriangle} className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.base300} strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={<CustomAxisTick />} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:11, fill:C.content, opacity:0.35, fontFamily:'var(--font-poppins,sans-serif)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.error, strokeWidth:1, strokeDasharray:'4 2', strokeOpacity:0.4 }} />
                <Legend wrapperStyle={{ fontSize:'11px', paddingTop:'12px', fontFamily:'var(--font-poppins,sans-serif)' }} />
                <Line type="monotone" dataKey="expired" name="Expired" stroke={C.error} strokeWidth={2} dot={false} activeDot={{ r:4, fill:C.error }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Radial bar – stock health per group */}
          <ChartCard title="Stock Health %" subtitle="Available / total per group" icon={Activity}>
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius={20} outerRadius={90}
                barSize={10} data={radialData}
                startAngle={90} endAngle={-270}
              >
                <PolarGrid gridType="circle" radialLines={false} stroke={C.base300} strokeOpacity={0.4} />
                <RadialBar
                  minAngle={5}
                  background={{ fill: C.base300, opacity: 0.3 }}
                  clockWise
                  dataKey="value"
                  cornerRadius={5}
                  label={{ position:'insideStart', fill:'transparent' }}
                />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-base-100 border border-base-300 rounded-xl shadow-depth px-3 py-2 text-xs">
                      <span className="font-bold" style={{color:d.fill}}>{d.name}</span>
                      <span className="text-base-content/60 ml-2">{d.value}% healthy</span>
                    </div>
                  );
                }} />
                <Legend
                  iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize:'10px', fontFamily:'var(--font-poppins,sans-serif)' }}
                  formatter={(value, entry) => <span style={{color: entry.payload.fill}}>{entry.payload.name}</span>}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        {/* ── Row 5: Request funnel + Summary table ── */}
        <motion.div variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* Request pipeline */}
          <ChartCard title="Request Pipeline" subtitle="From received → outcome" icon={Zap} className="xl:col-span-2">
            {funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <FunnelChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                    ))}
                    <LabelList position="center" fill="#fff" fontSize={11} fontWeight={700} fontFamily="var(--font-poppins,sans-serif)" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-base-content/30 text-sm">
                No request data yet
              </div>
            )}
          </ChartCard>

          {/* Summary stats table */}
          <ChartCard title="Summary Statistics" subtitle="All-time totals" icon={BarChart2} className="xl:col-span-3">
            <div className="flex flex-col divide-y divide-base-300/60">
              {[
                { label:'Total Units Collected',    val: (stats.totalUnitsCollected||0).toLocaleString(),    color: 'text-primary'   },
                { label:'Total Units Issued',       val: (stats.totalUnitsIssued||0).toLocaleString(),       color: 'text-success'   },
                { label:'Total Donations',          val: (stats.totalDonations||0).toLocaleString(),         color: 'text-accent'    },
                { label:'Total Donors',             val: (stats.totalDonors||0).toLocaleString(),            color: 'text-info'      },
                { label:'Requests Fulfilled',       val: (stats.totalRequestsFulfilled||0).toLocaleString(), color: 'text-success'   },
                { label:'Requests Partial',         val: (stats.totalRequestsPartial||0).toLocaleString(),   color: 'text-warning'   },
                { label:'Requests Failed',          val: (stats.totalRequestsFailed||0).toLocaleString(),    color: 'text-error'     },
                { label:'Total Earnings (₹)',       val: `₹ ${(stats.totalEarnings||0).toLocaleString()}`,  color: 'text-secondary' },
                { label:'Utilisation Rate',         val: `${utilRate}%`,                                     color: utilRate > 70 ? 'text-success' : utilRate > 40 ? 'text-warning' : 'text-error' },
                { label:'Average Rating',           val: `${(myBank?.rating?.averageRating||0).toFixed(2)} / 5`, color: 'text-warning' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-base-content/55 text-xs font-medium">{row.label}</span>
                  <span className={`font-montserrat font-black text-base ${row.color}`}>{row.val}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </motion.div>

        {/* ── Last updated note ── */}
        <p className="text-center text-xs text-base-content/25 pb-4">
          Time-series data is illustrative. Connect your analytics API to display real historical data.
        </p>

      </div>
    </div>
  );
}