'use client';

import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  IndianRupee, Info, Star, Clock, Zap, TrendingUp,
  ShieldCheck, AlertCircle, ChevronRight, Award
} from 'lucide-react';
import { selectProfile, selectPerformance, selectEarnings } from '@/store/slices/careAssistantSlice';
import BackButton from '../../../components/BackButton';

/* ─── Static platform pricing (owned by PlatformPricingConfig on backend) ─── */
const BASE_RATES = [
  { service: 'Basic Daily Care',     hourlyRate: 80,  minHours: 4,  category: 'hourly' },
  { service: 'Post-Surgery Care',    hourlyRate: 120, minHours: 6,  category: 'hourly' },
  { service: 'Dementia Care',        hourlyRate: 150, minHours: 8,  category: 'hourly' },
  { service: 'Night Shift (8 hrs)',  flatRate:   700, minHours: 8,  category: 'flat'   },
  { service: 'Full-Day (12 hrs)',    flatRate:   1200,minHours: 12, category: 'flat'   },
  { service: 'Hospital Escort',      flatRate:   500, minHours: 4,  category: 'flat'   },
];

const PAYOUT_SPLIT = [
  { name: 'Your Payout (70%)',    value: 70,  color: 'var(--success)' },
  { name: 'Platform Fee (20%)',   value: 20,  color: 'var(--primary)' },
  { name: 'GST & Taxes (10%)',    value: 10,  color: 'var(--warning)' },
];

const BONUSES = [
  { label: '5-Star Review Bonus',    amount: '+₹50',   icon: Star,      color: 'var(--warning)' },
  { label: 'On-Time Bonus (streak)', amount: '+₹100',  icon: Clock,     color: 'var(--success)' },
  { label: 'Urgent Booking',         amount: '+25%',   icon: Zap,       color: 'var(--accent)'  },
  { label: '10 Tasks/Month Streak',  amount: '+₹500',  icon: TrendingUp,color: 'var(--primary)' },
  { label: 'High Rating (≥4.8)',     amount: '+₹200',  icon: Award,     color: 'var(--secondary)' },
];

const PENALTIES = [
  { label: 'No-show / Last-minute cancel', amount: '-₹200', color: 'var(--error)' },
  { label: 'Late arrival (>30 min)',       amount: '-₹50',  color: 'var(--warning)' },
  { label: 'Complaint verified',           amount: '-₹100', color: 'var(--error)'   },
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-xs shadow-xl"
      style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'var(--base-content)' }}>
      <p className="font-bold">{payload[0].name}</p>
      <p style={{ color: payload[0].payload.color }}>{payload[0].value}%</p>
    </div>
  );
};

export default function PayoutRatesPage() {
  const profile     = useSelector(selectProfile);
  const performance = useSelector(selectPerformance);
  const earnings    = useSelector(selectEarnings);

  const rating      = performance?.averageRating ?? 5;
  const multiplier  = rating >= 4.8 ? 1.05 : rating >= 4.5 ? 1.02 : 1;

  /* Example estimated payout for a 6-hour basic booking */
  const sampleServiceRate = 80 * 6;   // ₹480
  const yourCut           = Math.round(sampleServiceRate * 0.70 * multiplier);

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-8 pb-4">
           <BackButton className='my-3' />
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--accent), transparent 85%)' }}>
            <IndianRupee size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-2xl font-black font-montserrat" style={{ color: 'var(--base-content)' }}>
            Payout Rates
          </h1>
        </div>
        <p className="text-sm ml-12" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
          Platform pricing, your earnings split & bonuses
        </p>
      </motion.div>

      <div className="px-6 pb-10 space-y-6">

        {/* Rating multiplier banner */}
        {multiplier > 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card p-4 flex items-center gap-4"
            style={{ background: 'color-mix(in srgb, var(--success), transparent 90%)', border: '1px solid color-mix(in srgb, var(--success), transparent 70%)' }}>
            <ShieldCheck size={20} style={{ color: 'var(--success)' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>
                High-Rating Bonus Active ({rating.toFixed(1)}★) — {((multiplier - 1) * 100).toFixed(0)}% extra per booking
              </p>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Maintain ≥4.8 average to keep this bonus
              </p>
            </div>
          </motion.div>
        )}

        {/* Payout Split Pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="card p-5">
          <h3 className="text-sm font-black font-montserrat mb-1" style={{ color: 'var(--base-content)' }}>
            Earnings Split
          </h3>
          <p className="text-xs mb-4" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            For every booking charged to the client
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={PAYOUT_SPLIT} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="value" paddingAngle={3}>
                  {PAYOUT_SPLIT.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3 w-full">
              {PAYOUT_SPLIT.map(({ name, value, color }) => (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>{name}</p>
                  </div>
                  <span className="text-sm font-black" style={{ color }}>{value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Base Rates Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }} className="card p-5">
          <h3 className="text-sm font-black font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
            Service Base Rates (Client Price)
          </h3>
          <div className="space-y-2">
            {BASE_RATES.map((rate, i) => {
              const clientPrice = rate.hourlyRate
                ? `₹${rate.hourlyRate}/hr`
                : `₹${rate.flatRate}`;
              const yourPayout = rate.hourlyRate
                ? `₹${Math.round(rate.hourlyRate * 0.7 * rate.minHours * multiplier)} (${rate.minHours}h)`
                : `₹${Math.round(rate.flatRate * 0.7 * multiplier)}`;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.04 }}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--base-200)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>{rate.service}</p>
                    <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                      Min {rate.minHours}h · Client pays {clientPrice}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: 'var(--success)' }}>{yourPayout}</p>
                    <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>your payout</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {multiplier > 1 && (
            <p className="mt-3 text-xs flex items-center gap-1.5"
              style={{ color: 'var(--success)' }}>
              <ShieldCheck size={12} /> Includes your {((multiplier - 1) * 100).toFixed(0)}% rating bonus
            </p>
          )}
        </motion.div>

        {/* Bonuses */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }} className="card p-5">
          <h3 className="text-sm font-black font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
            Bonuses & Incentives
          </h3>
          <div className="space-y-2">
            {BONUSES.map(({ label, amount, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: `color-mix(in srgb, ${color}, transparent 92%)` }}>
                <div className="p-1.5 rounded-lg" style={{ background: `color-mix(in srgb, ${color}, transparent 80%)` }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <p className="flex-1 text-sm" style={{ color: 'var(--base-content)' }}>{label}</p>
                <span className="text-sm font-black" style={{ color }}>{amount}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Penalties */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }} className="card p-5">
          <h3 className="text-sm font-black font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
            Deductions & Penalties
          </h3>
          <div className="space-y-2">
            {PENALTIES.map(({ label, amount, color }) => (
              <div key={label} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: `color-mix(in srgb, ${color}, transparent 92%)` }}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} style={{ color }} />
                  <p className="text-sm" style={{ color: 'var(--base-content)' }}>{label}</p>
                </div>
                <span className="text-sm font-black" style={{ color }}>{amount}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Example Calculation */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }} className="card p-5"
          style={{ background: 'color-mix(in srgb, var(--primary), transparent 93%)', border: '1px solid color-mix(in srgb, var(--primary), transparent 75%)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Info size={16} style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-black font-montserrat" style={{ color: 'var(--base-content)' }}>
              Example: Basic 6-Hour Booking
            </h3>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Client pays',     value: `₹${sampleServiceRate}`, bold: false },
              { label: 'Platform fee (30%)', value: `-₹${Math.round(sampleServiceRate * 0.30)}`, bold: false, color: 'var(--error)' },
              { label: 'Your payout (70%)', value: `₹${yourCut}`, bold: true, color: 'var(--success)' },
            ].map(({ label, value, bold, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>{label}</span>
                <span className={`text-sm ${bold ? 'font-black' : 'font-semibold'}`}
                  style={{ color: color || 'var(--base-content)' }}>{value}</span>
              </div>
            ))}
            {multiplier > 1 && (
              <p className="text-xs pt-1 border-t border-base-300"
                style={{ color: 'var(--success)' }}>
                ✦ Includes {((multiplier - 1) * 100).toFixed(0)}% high-rating bonus
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}