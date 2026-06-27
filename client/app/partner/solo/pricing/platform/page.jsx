'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Globe2,
  ToggleRight,
  IndianRupee,
  Percent,
  CalendarClock,
  AlertCircle,
  Info,
  BadgeCheck,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import {
  fetchPricing,
  selectPricing,
  selectLoading,
  selectError,
  selectEffectivePlatformFee,
} from '@/store/slices/soloDriverSlice';
import BackButton from '../../../../../components/BackButton';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Given a fee object + fare amount, compute deduction */
function computeDeduction(fee, fare) {
  if (!fee) return null;
  if (fee.type === 'percentage') return (fare * fee.value) / 100;
  return fee.value;
}

/** Build a sample payout chart for different fare levels */
function buildChartData(fee) {
  const fares = [100, 200, 300, 400, 500, 700, 1000, 1500, 2000];
  return fares.map((fare) => {
    const deduction = computeDeduction(fee, fare) ?? 0;
    return {
      fare: `₹${fare}`,
      Deduction: +deduction.toFixed(2),
      Payout: +(fare - deduction).toFixed(2),
    };
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function FeeTypePill({ type }) {
  const isPercentage = type === 'percentage';
  return (
    <span
      className="badge"
      style={{
        background: isPercentage
          ? 'color-mix(in srgb, var(--primary), transparent 85%)'
          : 'color-mix(in srgb, var(--success), transparent 85%)',
        color: isPercentage ? 'var(--primary)' : 'var(--success)',
        border: `1px solid ${isPercentage
          ? 'color-mix(in srgb, var(--primary), transparent 70%)'
          : 'color-mix(in srgb, var(--success), transparent 70%)'}`,
      }}
    >
      {isPercentage ? <Percent size={11} /> : <IndianRupee size={11} />}
      {isPercentage ? 'Percentage' : 'Fixed amount'}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, accent, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-5 flex items-center gap-4"
    >
      <span
        className="flex items-center justify-center w-11 h-11 rounded-[var(--r-field)] shrink-0"
        style={{ background: `color-mix(in srgb, ${accent}, transparent 88%)` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
          {label}
        </p>
        <p className="text-lg font-black font-display tracking-tight mt-0.5">{value}</p>
      </div>
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="p-3 rounded-[var(--r-field)] text-xs shadow-xl"
      style={{
        background: 'var(--base-200)',
        border: '1px solid var(--base-300)',
        fontFamily: 'var(--font-family-poppins)',
      }}
    >
      <p className="font-bold mb-1 text-base-content">Fare: {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>₹{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

const SETTLEMENT_LABELS = {
  Daily:     { label: 'Daily',     color: 'var(--success)' },
  Weekly:    { label: 'Weekly',    color: 'var(--primary)' },
  'Bi-Weekly': { label: 'Bi-Weekly', color: 'var(--secondary)' },
  Monthly:   { label: 'Monthly',  color: 'var(--warning)' },
};

// ─── main component ───────────────────────────────────────────────────────────

export default function PlatformFeeInfo() {
  const dispatch          = useDispatch();
  const pricing           = useSelector(selectPricing);
  const isLoading         = useSelector(selectLoading('pricing'));
  const fetchError        = useSelector(selectError('pricing'));
  const effectiveFeeLabel = useSelector(selectEffectivePlatformFee);

  useEffect(() => {
    dispatch(fetchPricing());
  }, [dispatch]);

  const fee            = pricing?.effectivePlatformFee;
  const isOverridden   = !pricing?.isUsingGlobalFee;
  const settlementCycle = pricing?.settlementCycle ?? 'Weekly';
  const chartData      = fee ? buildChartData(fee) : [];

  // ── loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-10 w-72 rounded-[var(--r-field)]" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-[var(--r-box)]" />)}
        </div>
        <div className="skeleton h-52 rounded-[var(--r-box)]" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{fetchError}</span>
        </div>
      </div>
    );
  }

  const settlementMeta = SETTLEMENT_LABELS[settlementCycle] ?? SETTLEMENT_LABELS.Weekly;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

            <BackButton className=' my-2 rounded-md px-3' />
      
      {/* ── header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
      >
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight">Platform Fee Info</h3>
          <p className="text-sm mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
            Understand how the platform deducts its fee from your ride earnings.
          </p>
        </div>

        {/* source badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-field)] border shrink-0"
          style={{
            borderColor: isOverridden
              ? 'color-mix(in srgb, var(--accent), transparent 60%)'
              : 'color-mix(in srgb, var(--info), transparent 60%)',
            background: isOverridden
              ? 'color-mix(in srgb, var(--accent), transparent 92%)'
              : 'color-mix(in srgb, var(--info), transparent 92%)',
          }}
        >
          {isOverridden ? (
            <ToggleRight size={15} style={{ color: 'var(--accent)' }} />
          ) : (
            <Globe2 size={15} style={{ color: 'var(--info)' }} />
          )}
          <span className="text-xs font-semibold">
            {isOverridden ? 'Custom override active' : 'Using platform default'}
          </span>
        </motion.div>
      </motion.div>

      {/* ── metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={fee?.type === 'percentage' ? Percent : IndianRupee}
          label="Effective Fee"
          value={
            fee
              ? fee.type === 'percentage'
                ? `${fee.value}% of fare`
                : `₹${fee.value} / ride`
              : '—'
          }
          accent="var(--primary)"
          delay={0.05}
        />
        <MetricCard
          icon={CalendarClock}
          label="Settlement Cycle"
          value={settlementMeta.label}
          accent={settlementMeta.color}
          delay={0.1}
        />
        <MetricCard
          icon={isOverridden ? BadgeCheck : ShieldCheck}
          label="Fee Source"
          value={isOverridden ? 'Admin override' : 'Global config'}
          accent={isOverridden ? 'var(--accent)' : 'var(--success)'}
          delay={0.15}
        />
      </div>

      {/* ── fee detail card ── */}
      {fee && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5 space-y-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <IndianRupee size={17} style={{ color: 'var(--primary)' }} />
              <h4 className="text-base font-bold">Fee Breakdown</h4>
            </div>
            <FeeTypePill type={fee.type} />
          </div>

          {/* formula */}
          <div
            className="rounded-[var(--r-field)] px-5 py-4 font-mono text-sm"
            style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
          >
            <p className="text-xs uppercase tracking-widest mb-2 font-sans font-semibold" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              Calculation formula
            </p>
            {fee.type === 'percentage' ? (
              <p className="text-base-content">
                Platform Deduction = Ride Fare &times;{' '}
                <span className="font-bold" style={{ color: 'var(--primary)' }}>{fee.value}%</span>
                <br />
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                  Your Payout = Ride Fare − Deduction
                </span>
              </p>
            ) : (
              <p className="text-base-content">
                Platform Deduction ={' '}
                <span className="font-bold" style={{ color: 'var(--primary)' }}>₹{fee.value}</span> (flat per ride)
                <br />
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                  Your Payout = Ride Fare − ₹{fee.value}
                </span>
              </p>
            )}
          </div>

          {/* example row */}
          <div className="flex flex-wrap gap-3">
            {[200, 500, 1000].map((ex) => {
              const deduction = computeDeduction(fee, ex);
              const payout    = ex - deduction;
              return (
                <div
                  key={ex}
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-field)] text-sm"
                  style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
                >
                  <span className="font-semibold">₹{ex} fare</span>
                  <ArrowRight size={13} style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
                  <span style={{ color: 'var(--error)' }}>−₹{deduction?.toFixed(0)}</span>
                  <ArrowRight size={13} style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
                  <span className="font-bold" style={{ color: 'var(--success)' }}>₹{payout?.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── payout chart ── */}
      {chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <RefreshCw size={16} style={{ color: 'var(--secondary)' }} />
            <h4 className="text-base font-bold">Payout vs Deduction by Fare</h4>
          </div>
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Stacked view showing how much you keep vs what the platform takes, across sample fares.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorPayout" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="colorDeduction" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--error)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--error)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="color-mix(in srgb, var(--base-content), transparent 90%)"
                vertical={false}
              />
              <XAxis
                dataKey="fare"
                tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontFamily: 'var(--font-family-poppins)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontFamily: 'var(--font-family-poppins)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="Payout"
                stroke="var(--success)"
                strokeWidth={2}
                fill="url(#colorPayout)"
              />
              <Area
                type="monotone"
                dataKey="Deduction"
                stroke="var(--error)"
                strokeWidth={2}
                fill="url(#colorDeduction)"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-5 pt-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: 'var(--success)' }} />
              <span style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>Your payout</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: 'var(--error)' }} />
              <span style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>Platform deduction</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── info note ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="alert alert-info text-sm"
      >
        <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--info)' }} />
        <p>
          The platform fee shown here is set by the admin. If you have a custom override, it takes precedence over
          the global rate. Contact your account manager to negotiate a different rate.
        </p>
      </motion.div>
    </div>
  );
}