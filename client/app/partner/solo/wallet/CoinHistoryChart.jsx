'use client';

/**
 * _CoinHistoryChart.jsx
 *
 * Lazy-loaded via next/dynamic from WalletPage.
 * Receives raw coinTransactions array and aggregates weekly earn/redeem totals.
 * Heavy Recharts bundle is isolated here so the main page tree stays light.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Aggregate coin transactions into weekly buckets
function aggregateWeekly(transactions) {
  if (!transactions?.length) return [];

  const buckets = {};

  transactions.forEach((txn) => {
    const date = new Date(txn.timestamp || txn.createdAt);
    if (isNaN(date.getTime())) return;

    // ISO week key: "YYYY-Www"
    const jan1    = new Date(date.getFullYear(), 0, 1);
    const week    = Math.ceil(((date - jan1) / 86_400_000 + jan1.getDay() + 1) / 7);
    const key     = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
    const label   = `W${week} ${date.toLocaleString('en-IN', { month: 'short' })}`;

    if (!buckets[key]) buckets[key] = { week: label, earned: 0, redeemed: 0 };

    const isEarn = ['EARN', 'BONUS', 'ADMIN_CREDIT'].includes(txn.type);
    const isRedeem = ['REDEEM', 'ADMIN_DEBIT', 'EXPIRE'].includes(txn.type);

    if (isEarn)   buckets[key].earned   += txn.amount;
    if (isRedeem) buckets[key].redeemed += txn.amount;
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)  // show last 8 weeks
    .map(([, v]) => v);
}

const TOOLTIP_STYLE = {
  background:   'var(--base-100)',
  border:       '1px solid var(--base-300)',
  borderRadius: '12px',
  fontSize:     11,
  color:        'var(--base-content)',
};

export default function CoinHistoryChart({ transactions, isLoading }) {
  const chartData = useMemo(
    () => aggregateWeekly(transactions),
    [transactions]
  );

  if (isLoading) return null; // Parent shows skeleton

  if (!chartData.length) {
    return (
      <section className="card p-5 mb-6" aria-label="Coin activity chart">
        <h3
          className="font-black text-base mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}
        >
          Coin Activity
        </h3>
        <div
          className="flex flex-col items-center justify-center h-40 rounded-xl"
          style={{ background: 'var(--base-200)' }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}
          >
            No activity yet
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-5 mb-6" aria-label="Weekly coin activity chart">
      <h3
        className="font-black text-base mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}
      >
        Coin Activity
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 9, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--base-200)' }} />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="earned"   name="Earned"   fill="var(--warning)" radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="redeemed" name="Redeemed" fill="var(--error)"   radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}