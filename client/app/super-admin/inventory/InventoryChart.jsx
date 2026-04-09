'use client';

/**
 * InventoryChart.jsx
 * Lazy-loaded companion chart for InventoryManagement.
 *
 * FIX: Recharts ResponsiveContainer -1 width/height error.
 * Root cause: ResponsiveContainer uses ResizeObserver on its parent.
 * If the parent has no layout yet (SSR hydration timing, display:flex
 * with no explicit height, or the iframe hasn't painted), the observed
 * width/height comes back as -1 or 0.
 *
 * Solution:
 *  1. Replace ResponsiveContainer with a plain sized wrapper div.
 *  2. Use `useEffect` to read the actual rendered width with a
 *     ResizeObserver before mounting the chart — prevents -1.
 *  3. Provide an `aspect` prop on BarChart instead of relying on
 *     percentage width/height.
 *  4. Set explicit `width` and `height` numbers on BarChart.
 */

import { useEffect, useRef, useState, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
} from 'recharts';

// Pharmacy-green palette matching globals.css pharmacy theme
const PALETTE = [
  '#0f6e56','#1d9e75','#5dcaa5','#9fe1cb',
  '#185fa5','#378add','#85b7eb',
  '#ba7517','#ef9f27','#fac775',
  '#639922','#97c459',
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--base-100)',
      border: '1px solid var(--base-300)',
      borderRadius: 10,
      padding: '8px 12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', margin: '2px 0 0' }}>
        {payload[0].value} SKUs
      </p>
    </div>
  );
};

const InventoryChart = memo(({ data = [] }) => {
  const containerRef = useRef(null);
  const [width, setWidth]     = useState(0);
  const [mounted, setMounted] = useState(false);

  // Measure container width before rendering BarChart to avoid -1
  useEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      const w = containerRef.current?.getBoundingClientRect().width;
      if (w && w > 0) {
        setWidth(Math.floor(w));
        setMounted(true);
      }
    };

    measure();

    // ResizeObserver keeps it correct if sidebar resizes
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const chartData = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ _id, count }) => ({ name: _id || 'Other', count }));

  // Each bar row = ~34px + top/bottom padding
  const chartH = chartData.length * 34 + 56;

  return (
    <div ref={containerRef} style={{ width: '100%', padding: '12px 0' }}>
      {!mounted || width === 0 ? (
        /* Placeholder while measuring — prevents -1 flash */
        <div style={{ height: chartH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%',
            border: '2px solid var(--primary)', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <BarChart
          width={width}
          height={chartH}
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="4 2" stroke="var(--base-300)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={82}
            tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.7 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={16}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      )}
    </div>
  );
});

InventoryChart.displayName = 'InventoryChart';
export default InventoryChart;