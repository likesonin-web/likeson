'use client';

/**
 * AnalyticsPanelInline.jsx
 * Lazy-loaded via next/dynamic from BookingManagement.jsx
 * Recharts imported dynamically inside — zero impact on main bundle
 * Uses global.css theme tokens only
 */

import { useEffect, useState, memo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  CheckCircle,
  Clock,
  XCircle,
  IndianRupee,
  Bike,
  Calendar,
  Award,
} from 'lucide-react';

// ── mock data (replace with real Redux selectors) ───────────────────────────

const weeklyData = [
  { day: 'Mon', rides: 4, earnings: 1240 },
  { day: 'Tue', rides: 6, earnings: 1890 },
  { day: 'Wed', rides: 3, earnings: 940 },
  { day: 'Thu', rides: 8, earnings: 2450 },
  { day: 'Fri', rides: 5, earnings: 1560 },
  { day: 'Sat', rides: 9, earnings: 2810 },
  { day: 'Sun', rides: 7, earnings: 2190 },
];

const monthlyEarnings = [
  { month: 'Jan', earnings: 28400 },
  { month: 'Feb', earnings: 31200 },
  { month: 'Mar', earnings: 27800 },
  { month: 'Apr', earnings: 35600 },
  { month: 'May', earnings: 14080 }, // current (partial)
];

const bookingTypeData = [
  { name: 'Patient Transport', value: 48, colorVar: 'var(--primary)' },
  { name: 'Consultation',      value: 28, colorVar: 'var(--success)' },
  { name: 'Diagnostic',        value: 15, colorVar: 'var(--warning)' },
  { name: 'Home Care',         value: 9,  colorVar: 'var(--error)'   },
];

const perfMetrics = [
  {
    label: 'Rating',
    value: '4.8',
    icon: Star,
    colorVar: 'var(--warning)',
    sub: '127 reviews',
    trend: +0.2,
  },
  {
    label: 'Acceptance',
    value: '94%',
    icon: CheckCircle,
    colorVar: 'var(--success)',
    sub: 'this week',
    trend: +3,
  },
  {
    label: 'On-time',
    value: '88%',
    icon: Clock,
    colorVar: 'var(--info)',
    sub: 'avg punctual',
    trend: -1,
  },
  {
    label: 'Cancellations',
    value: '2',
    icon: XCircle,
    colorVar: 'var(--error)',
    sub: 'this month',
    trend: -1,
  },
];

const summaryCards = [
  {
    label: 'This Week',
    value: '₹13,080',
    icon: IndianRupee,
    colorVar: 'var(--primary)',
    sub: '42 rides completed',
  },
  {
    label: 'This Month',
    value: '₹14,080',
    icon: Calendar,
    colorVar: 'var(--accent)',
    sub: 'partial — 4 days left',
  },
  {
    label: 'Total Rides',
    value: '318',
    icon: Bike,
    colorVar: 'var(--success)',
    sub: 'all time',
  },
  {
    label: 'Best Day',
    value: '₹2,810',
    icon: Award,
    colorVar: 'var(--warning)',
    sub: 'Saturday',
  },
];

// ── skeleton ────────────────────────────────────────────────────────────────

const ChartSkeleton = memo(({ height = 200 }) => (
  <div
    className="animate-pulse bg-base-300 rounded-xl w-full"
    style={{ height }}
    aria-hidden="true"
  />
));
ChartSkeleton.displayName = 'ChartSkeleton';

// ── custom tooltip ──────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-4 py-3 shadow-2xl text-sm border border-base-300">
      <p className="text-xs text-base-content/40 font-mono mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color || p.fill }}>
          {p.name === 'earnings' ? `₹${p.value.toLocaleString('en-IN')}` : p.value}{' '}
          <span className="font-normal text-base-content/40">{p.name}</span>
        </p>
      ))}
    </div>
  );
};

// ── perf metric card ────────────────────────────────────────────────────────

const PerfCard = memo(({ label, value, icon: Icon, colorVar, sub, trend }) => {
  const isPositive = trend > 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="stat-card text-center relative overflow-hidden">
      {/* background tint */}
      <span
        className="absolute inset-0 opacity-5 rounded-xl"
        style={{ background: colorVar }}
        aria-hidden="true"
      />
      <Icon
        size={18}
        style={{ color: colorVar }}
        className="mx-auto mb-2"
        aria-hidden="true"
      />
      <p className="stat-card-value text-2xl" style={{ color: colorVar }}>
        {value}
      </p>
      <p className="stat-card-label mt-1">{label}</p>
      <p className="text-xs text-base-content/30">{sub}</p>
      {trend !== undefined && (
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-bold mt-1 ${
            isPositive ? 'text-success' : 'text-error'
          }`}
          aria-label={`Trend: ${isPositive ? '+' : ''}${trend}`}
        >
          <TrendIcon size={11} aria-hidden="true" />
          {isPositive ? '+' : ''}{trend}
        </span>
      )}
    </div>
  );
});
PerfCard.displayName = 'PerfCard';

// ── booking type legend row ─────────────────────────────────────────────────

const TypeLegend = memo(({ data }) => (
  <div className="flex flex-col gap-2 flex-1 min-w-0">
    {data.map((d) => (
      <div key={d.name} className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: d.colorVar }}
            aria-hidden="true"
          />
          <span className="text-xs text-base-content/50 truncate">{d.name}</span>
        </div>
        <span className="text-xs font-bold text-base-content/70 shrink-0">
          {d.value}%
        </span>
      </div>
    ))}
  </div>
));
TypeLegend.displayName = 'TypeLegend';

// ── main panel ──────────────────────────────────────────────────────────────

function AnalyticsPanelInline() {
  const [Charts, setCharts] = useState(null);

  // Dynamic recharts import — excluded from main bundle
  useEffect(() => {
    import('recharts').then((m) => setCharts(m));
  }, []);

  const chartsReady = !!Charts;

  return (
    <div className="space-y-6" aria-label="Analytics dashboard" role="region">

      {/* ── summary stat cards ── */}
      <section aria-label="Earnings summary">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryCards.map((c) => (
            <div
              key={c.label}
              className="stat-card relative overflow-hidden"
              role="region"
              aria-label={c.label}
            >
              <span
                className="absolute inset-0 opacity-5 rounded-xl"
                style={{ background: c.colorVar }}
                aria-hidden="true"
              />
              <div className="flex items-center gap-2 mb-2">
                <c.icon
                  size={14}
                  style={{ color: c.colorVar }}
                  aria-hidden="true"
                />
                <span className="label-text text-xs uppercase tracking-widest">
                  {c.label}
                </span>
              </div>
              <p className="stat-card-value text-2xl" style={{ color: c.colorVar }}>
                {c.value}
              </p>
              <p className="stat-card-label mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── weekly earnings area chart ── */}
      <section className="card p-6" aria-label="Weekly earnings chart">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-base">Weekly Earnings</h2>
            <p className="text-xs text-base-content/40 font-mono mt-0.5">
              Last 7 days performance
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-bold text-success">
            <TrendingUp size={14} aria-hidden="true" />
            +12.4%
          </span>
        </div>

        {!chartsReady ? (
          <ChartSkeleton height={200} />
        ) : (
          <Charts.ResponsiveContainer width="100%" height={200}>
            <Charts.AreaChart
              data={weeklyData}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <Charts.CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--base-300)"
              />
              <Charts.XAxis
                dataKey="day"
                tick={{ fill: 'var(--base-content)', fontSize: 11, opacity: 0.4 }}
                axisLine={false}
                tickLine={false}
              />
              <Charts.YAxis
                tick={{ fill: 'var(--base-content)', fontSize: 11, opacity: 0.4 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v}`}
              />
              <Charts.Tooltip content={<CustomTooltip />} />
              <Charts.Area
                type="monotone"
                dataKey="earnings"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#earningsGrad)"
                dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 0 }}
              />
            </Charts.AreaChart>
          </Charts.ResponsiveContainer>
        )}
      </section>

      {/* ── rides bar + booking type pie row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* rides per day bar */}
        <section className="card p-6" aria-label="Rides per day chart">
          <h2 className="font-bold text-sm mb-4">Rides Per Day</h2>
          {!chartsReady ? (
            <ChartSkeleton height={160} />
          ) : (
            <Charts.ResponsiveContainer width="100%" height={160}>
              <Charts.BarChart
                data={weeklyData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <Charts.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--base-300)"
                />
                <Charts.XAxis
                  dataKey="day"
                  tick={{ fill: 'var(--base-content)', fontSize: 10, opacity: 0.4 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Charts.YAxis
                  tick={{ fill: 'var(--base-content)', fontSize: 10, opacity: 0.4 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Charts.Tooltip content={<CustomTooltip />} />
                <Charts.Bar
                  dataKey="rides"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </Charts.BarChart>
            </Charts.ResponsiveContainer>
          )}
        </section>

        {/* booking type pie */}
        <section className="card p-6" aria-label="Booking types chart">
          <h2 className="font-bold text-sm mb-4">Booking Types</h2>
          {!chartsReady ? (
            <div className="flex items-center gap-4">
              <ChartSkeleton height={140} />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Charts.ResponsiveContainer width="50%" height={140}>
                <Charts.PieChart>
                  <Charts.Pie
                    data={bookingTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={58}
                    dataKey="value"
                    strokeWidth={0}
                    aria-label="Booking type distribution"
                  >
                    {bookingTypeData.map((entry, i) => (
                      <Charts.Cell
                        key={i}
                        fill={entry.colorVar}
                        aria-label={`${entry.name}: ${entry.value}%`}
                      />
                    ))}
                  </Charts.Pie>
                  <Charts.Tooltip
                    formatter={(v, name) => [`${v}%`, name]}
                    contentStyle={{
                      background: 'var(--base-100)',
                      border: '1px solid var(--base-300)',
                      borderRadius: 'var(--r-box)',
                      color: 'var(--base-content)',
                      fontSize: 12,
                    }}
                  />
                </Charts.PieChart>
              </Charts.ResponsiveContainer>
              <TypeLegend data={bookingTypeData} />
            </div>
          )}
        </section>
      </div>

      {/* ── monthly earnings bar ── */}
      <section className="card p-6" aria-label="Monthly earnings chart">
        <h2 className="font-bold text-sm mb-4">Monthly Earnings</h2>
        {!chartsReady ? (
          <ChartSkeleton height={160} />
        ) : (
          <Charts.ResponsiveContainer width="100%" height={160}>
            <Charts.BarChart
              data={monthlyEarnings}
              margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
            >
              <Charts.CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--base-300)"
              />
              <Charts.XAxis
                dataKey="month"
                tick={{ fill: 'var(--base-content)', fontSize: 11, opacity: 0.4 }}
                axisLine={false}
                tickLine={false}
              />
              <Charts.YAxis
                tick={{ fill: 'var(--base-content)', fontSize: 11, opacity: 0.4 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Charts.Tooltip content={<CustomTooltip />} />
              <Charts.Bar
                dataKey="earnings"
                radius={[4, 4, 0, 0]}
              >
                {monthlyEarnings.map((_, i) => (
                  <Charts.Cell
                    key={i}
                    fill={
                      i === monthlyEarnings.length - 1
                        ? 'var(--accent)'   // current month
                        : 'var(--primary)'
                    }
                  />
                ))}
              </Charts.Bar>
            </Charts.BarChart>
          </Charts.ResponsiveContainer>
        )}
        <p className="text-xs text-base-content/30 mt-2 font-mono">
          * Current month partial
        </p>
      </section>

      {/* ── performance metrics ── */}
      <section aria-label="Performance metrics">
        <h2 className="font-bold text-sm mb-4">Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {perfMetrics.map((m) => (
            <PerfCard key={m.label} {...m} />
          ))}
        </div>
      </section>

    </div>
  );
}

export default AnalyticsPanelInline;