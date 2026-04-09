'use client';

/**
 * BenefitsChart.jsx
 *
 * Recharts-powered animated analysis panel for the active subscription.
 * Lazy-loaded from ActiveSubscription.jsx.
 *
 * Charts:
 *   1. RadarChart  — benefit coverage vs ideal (looping animation via key)
 *   2. RadialBarChart — usage meters per category
 *   3. AreaChart   — simulated monthly usage trend
 */

import { useMemo, useState, useEffect, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell,
} from 'recharts';
import { Activity, BarChart3, Radar as RadarIcon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise a raw benefit value to 0–100 for charting */
const normalise = (value, max) => {
  if (value === -1) return 100; // "Unlimited"
  if (!value || !max) return 0;
  return Math.min(Math.round((value / max) * 100), 100);
};

/** Generate fake monthly usage trend from plan data */
const buildTrend = (benefits) => {
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const max = benefits?.doctorConsultations === -1 ? 10 : (benefits?.doctorConsultations ?? 0);
  return months.map((m, i) => ({
    month: m,
    consultations: Math.round(max * (0.4 + Math.random() * 0.55) * (0.7 + i * 0.05)),
    rides:         Math.round((benefits?.transportRides ?? 0) * (0.3 + Math.random() * 0.6)),
  }));
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB BUTTON
// ─────────────────────────────────────────────────────────────────────────────

const TabButton = memo(({ id, label, icon: Icon, active, onClick }) => (
  <button
    role="tab"
    aria-selected={active}
    aria-controls={`chart-panel-${id}`}
    id={`chart-tab-${id}`}
    onClick={() => onClick(id)}
    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    style={
      active
        ? { background: 'var(--primary)', color: 'var(--primary-content)' }
        : {
            background: 'transparent',
            color: `color-mix(in oklch, var(--base-content) 55%, transparent)`,
          }
    }
  >
    <Icon size={13} aria-hidden="true" />
    {label}
  </button>
));
TabButton.displayName = 'TabButton';

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="card px-4 py-3 shadow-xl text-xs"
      role="tooltip"
    >
      <p className="font-bold mb-1.5" style={{ color: 'var(--base-content)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RADAR CHART PANEL
// ─────────────────────────────────────────────────────────────────────────────

const RadarPanel = memo(({ radarData, animKey }) => (
  <div style={{ height: 280 }} role="img" aria-label="Benefit coverage radar chart">
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData} key={animKey}>
        <PolarGrid stroke="color-mix(in oklch, var(--base-content) 12%, transparent)" />
        <PolarAngleAxis
          dataKey="benefit"
          tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 60%, transparent)', fontFamily: 'var(--font-family-poppins)' }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Your Plan"
          dataKey="value"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.28}
          isAnimationActive
          animationDuration={1200}
          animationEasing="ease-out"
        />
        <Radar
          name="Max Available"
          dataKey="max"
          stroke="var(--base-300)"
          fill="var(--base-300)"
          fillOpacity={0.1}
          isAnimationActive
          animationDuration={900}
        />
      </RadarChart>
    </ResponsiveContainer>
  </div>
));
RadarPanel.displayName = 'RadarPanel';

// ─────────────────────────────────────────────────────────────────────────────
// RADIAL BAR PANEL
// ─────────────────────────────────────────────────────────────────────────────

const RADIAL_COLORS = ['var(--primary)', 'var(--info)', 'var(--success)', 'var(--warning)', 'var(--secondary)'];

const RadialPanel = memo(({ radialData, animKey }) => (
  <div style={{ height: 280 }} role="img" aria-label="Benefit utilisation radial chart">
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        key={animKey}
        cx="50%"
        cy="50%"
        innerRadius="18%"
        outerRadius="88%"
        data={radialData}
        startAngle={90}
        endAngle={-270}
        barSize={12}
      >
        <RadialBar
          minAngle={10}
          dataKey="value"
          isAnimationActive
          animationDuration={1400}
          animationEasing="ease-out"
          label={false}
        >
          {radialData.map((_, i) => (
            <Cell key={i} fill={RADIAL_COLORS[i % RADIAL_COLORS.length]} />
          ))}
        </RadialBar>
        <Legend
          iconSize={10}
          iconType="circle"
          formatter={(value) => (
            <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 65%, transparent)', fontFamily: 'var(--font-family-poppins)' }}>
              {value}
            </span>
          )}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  </div>
));
RadialPanel.displayName = 'RadialPanel';

// ─────────────────────────────────────────────────────────────────────────────
// AREA TREND PANEL
// ─────────────────────────────────────────────────────────────────────────────

const TrendPanel = memo(({ trend, animKey }) => (
  <div style={{ height: 280 }} role="img" aria-label="6-month usage trend area chart">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart key={animKey} data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradConsult" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--primary)"   stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--primary)"   stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gradRides" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--info)"      stopOpacity={0.3}  />
            <stop offset="95%" stopColor="var(--info)"      stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklch, var(--base-content) 8%, transparent)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontFamily: 'var(--font-family-poppins)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)', fontFamily: 'var(--font-family-poppins)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="consultations"
          name="Consultations"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#gradConsult)"
          isAnimationActive
          animationDuration={1500}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          dataKey="rides"
          name="Rides"
          stroke="var(--info)"
          strokeWidth={2}
          fill="url(#gradRides)"
          isAnimationActive
          animationDuration={1200}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
));
TrendPanel.displayName = 'TrendPanel';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BenefitsChart({ subscription }) {
  const [activeTab, setActiveTab] = useState('radar');
  // animKey triggers Recharts re-mount for looping animation on tab switch
  const [animKey, setAnimKey] = useState(0);

  const handleTabChange = useCallback((id) => {
    setActiveTab(id);
    setAnimKey((k) => k + 1);
  }, []);

  // Loop animation every 8 seconds on the active tab
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimKey((k) => k + 1);
    }, 8_000);
    return () => clearInterval(timer);
  }, [activeTab]);

  const plan = subscription?.plan;
  const benefits = plan?.benefits ?? {};

  // Radar data
  const radarData = useMemo(() => [
    { benefit: 'Consultations', value: normalise(benefits.doctorConsultations, 10),   max: 100 },
    { benefit: 'Transport',     value: normalise(benefits.transportRides, 10),         max: 100 },
    { benefit: 'Pharmacy',      value: normalise(benefits.pharmacyDiscount, 20),       max: 100 },
    { benefit: 'Diagnostics',   value: normalise(benefits.diagnosticDiscount, 20),     max: 100 },
    { benefit: 'Lab Tests',     value: normalise(benefits.labTestsIncluded, 5),        max: 100 },
  ], [benefits]);

  // Radial data
  const radialData = useMemo(() => [
    { name: 'Consultations', value: normalise(benefits.doctorConsultations, 10) },
    { name: 'Transport',     value: normalise(benefits.transportRides, 10)      },
    { name: 'Pharmacy',      value: benefits.pharmacyDiscount ?? 0              },
    { name: 'Diagnostics',   value: benefits.diagnosticDiscount ?? 0            },
    { name: 'Lab Tests',     value: normalise(benefits.labTestsIncluded, 5)     },
  ], [benefits]);

  // Trend data (stable seeded mock — reset only on plan change)
  const trend = useMemo(() => buildTrend(benefits), [plan?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = [
    { id: 'radar',   label: 'Coverage',  icon: RadarIcon  },
    { id: 'radial',  label: 'Breakdown', icon: Activity   },
    { id: 'trend',   label: 'Trend',     icon: BarChart3  },
  ];

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="card p-6"
      aria-labelledby="chart-section-heading"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <Activity size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <h2 id="chart-section-heading" className="font-black text-base font-montserrat" style={{ color: 'var(--base-content)' }}>
            Plan Analysis
          </h2>
        </div>

        {/* Tab bar */}
        <div
          className="flex items-center gap-1 p-1 rounded-2xl"
          style={{ background: 'var(--base-200)' }}
          role="tablist"
          aria-label="Chart type selector"
        >
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              {...tab}
              active={activeTab === tab.id}
              onClick={handleTabChange}
            />
          ))}
        </div>
      </div>

      {/* Chart panels */}
      <div
        id={`chart-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`chart-tab-${activeTab}`}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'radar' && (
            <motion.div key="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RadarPanel radarData={radarData} animKey={animKey} />
              <p className="text-center text-xs mt-3" style={{ color: `color-mix(in oklch, var(--base-content) 40%, transparent)` }}>
                Benefit coverage score vs maximum available (normalised to 100)
              </p>
            </motion.div>
          )}
          {activeTab === 'radial' && (
            <motion.div key="radial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RadialPanel radialData={radialData} animKey={animKey} />
              <p className="text-center text-xs mt-3" style={{ color: `color-mix(in oklch, var(--base-content) 40%, transparent)` }}>
                Utilisation score per benefit category
              </p>
            </motion.div>
          )}
          {activeTab === 'trend' && (
            <motion.div key="trend" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TrendPanel trend={trend} animKey={animKey} />
              <p className="text-center text-xs mt-3" style={{ color: `color-mix(in oklch, var(--base-content) 40%, transparent)` }}>
                Simulated 6-month usage trend (consultations & rides)
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}