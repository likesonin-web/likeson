"use client";

/**
 * RechartsPanel.jsx
 * Lazy-loaded via next/dynamic — only downloads recharts when analytics panel is open.
 * Shows: Views vs Clicks bar chart, Status distribution pie, Budget utilization.
 */

import React, { useMemo, memo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const STATUS_COLORS = {
  Active:   "var(--success)",
  Paused:   "var(--warning)",
  Archived: "var(--base-content)",
  Depleted: "var(--error)",
  Draft:    "var(--info)",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-field p-3 shadow-xl text-xs">
      <p className="font-black mb-1 text-base-content">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="capitalize text-base-content/60">{p.dataKey}:</span>
          <span className="font-bold text-base-content">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const RechartsPanel = memo(({ ads }) => {
  const barData = useMemo(
    () =>
      ads.slice(0, 10).map((a) => ({
        name: a.adContent.headline.slice(0, 18) + (a.adContent.headline.length > 18 ? "…" : ""),
        views: a.analytics.views ?? 0,
        clicks: a.analytics.clicks ?? 0,
      })),
    [ads]
  );

  const pieData = useMemo(() => {
    const counts = {};
    ads.forEach((a) => {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [ads]);

  const budgetData = useMemo(
    () =>
      ads
        .filter((a) => a.budget.totalMax > 0)
        .slice(0, 8)
        .map((a) => ({
          name: a.adContent.headline.slice(0, 14) + "…",
          spent: a.budget.currentSpend ?? 0,
          remaining: Math.max(0, a.budget.totalMax - (a.budget.currentSpend ?? 0)),
        })),
    [ads]
  );

  if (!ads.length) {
    return (
      <p className="text-sm text-base-content/40 text-center py-12">
        No data yet — launch a campaign to see analytics.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Views vs Clicks */}
      <div className="lg:col-span-2">
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">
          Views vs Clicks (top 10)
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} barSize={12} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="views" fill="var(--primary)" radius={[4, 4, 0, 0]} opacity={0.8} />
            <Bar dataKey="clicks" fill="var(--success)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status Pie */}
      <div>
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">
          Status Breakdown
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.name] ?? "var(--accent)"}
                />
              ))}
            </Pie>
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => (
                <span style={{ fontSize: 10, color: "var(--base-content)", opacity: 0.7 }}>{v}</span>
              )}
            />
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Budget Utilization */}
      {budgetData.length > 0 && (
        <div className="lg:col-span-3">
          <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">
            Budget Utilization
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={budgetData} layout="vertical" barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="spent" fill="var(--primary)" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="remaining" fill="var(--base-300)" stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});

RechartsPanel.displayName = "RechartsPanel";
export default RechartsPanel;