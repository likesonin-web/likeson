'use client';

/**
 * ExpiryChart
 * ─────────────────────────────────────────────────────────────
 * Dynamically imported by ExpiryAlertsPage so Recharts is
 * excluded from the initial bundle.
 */

import { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Activity } from 'lucide-react';

/* ── Custom tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-[10px] px-3.5 py-2.5 shadow-lg text-xs">
      <p className="text-base-content/55 font-semibold uppercase tracking-widest mb-1" style={{ fontSize: 10 }}>{label}</p>
      <p className="text-warning font-bold text-base">
        {payload[0].value}{' '}
        <span className="text-[11px] font-medium text-base-content/60">medicines</span>
      </p>
    </div>
  );
}

const ExpiryChart = memo(function ExpiryChart({ data }) {
  return (
    <div
      className="bg-base-100 border border-base-300 rounded-[var(--r-box)] p-5"
      aria-label="Expiry timeline chart"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-warning" aria-hidden="true" />
          <span className="text-[13px] font-bold text-base-content">Expiry Timeline</span>
        </div>
        <span className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">
          Next 30 days
        </span>
      </div>

      <ResponsiveContainer width="100%" height={145}>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="warningGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--warning)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--base-300)"
            strokeOpacity={0.6}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.45 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.45 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'var(--warning)', strokeWidth: 1, strokeDasharray: '4 3' }}
          />
          <Area
            type="monotone"
            dataKey="items"
            stroke="var(--warning)"
            fill="url(#warningGrad)"
            strokeWidth={2}
            dot={{ fill: 'var(--warning)', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: 'var(--warning)', strokeWidth: 2, stroke: 'var(--base-100)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default ExpiryChart;