'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Coins, Star, TrendingUp, Gift, ArrowUpRight, ArrowDownRight,
  Crown, Zap, Award, Target, RefreshCw, ChevronRight, Sparkles
} from 'lucide-react';
import { fetchStats, selectStats, selectProfile, selectLoading } from '@/store/slices/soloDriverSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

const TIER_CONFIG = {
  Bronze:   { color: '#cd7f32', icon: Target,  next: 'Silver',   ridesNeeded: 50 },
  Silver:   { color: '#a8a9ad', icon: Award,   next: 'Gold',     ridesNeeded: 200 },
  Gold:     { color: '#ffd700', icon: Crown,   next: 'Platinum', ridesNeeded: 500 },
  Platinum: { color: '#e5e4e2', icon: Sparkles, next: 'Diamond', ridesNeeded: 1000 },
  Diamond:  { color: '#b9f2ff', icon: Zap,     next: null,       ridesNeeded: null },
};

const BADGES = [
  { id: 'FIRST_RIDE', name: 'First Ride', icon: '🚗', earned: true },
  { id: 'RIDES_10', name: '10 Rides', icon: '🏆', earned: true },
  { id: 'RIDES_50', name: '50 Rides', icon: '⭐', earned: true },
  { id: 'TOP_RATED', name: 'Top Rated', icon: '💎', earned: false },
  { id: 'SAFE_DRIVER', name: 'Safe Driver', icon: '🛡️', earned: true },
  { id: 'NIGHT_OWL', name: 'Night Owl', icon: '🦉', earned: false },
  { id: 'PERFECT_WEEK', name: 'Perfect Week', icon: '🎯', earned: false },
  { id: 'SOLO_PARTNER', name: 'Solo Partner', icon: '🎪', earned: true },
];

const mockCoinHistory = [
  { week: 'W1 Feb', earned: 180, redeemed: 50 },
  { week: 'W2 Feb', earned: 220, redeemed: 0 },
  { week: 'W3 Feb', earned: 160, redeemed: 100 },
  { week: 'W4 Feb', earned: 300, redeemed: 50 },
  { week: 'W1 Mar', earned: 250, redeemed: 0 },
  { week: 'W2 Mar', earned: 190, redeemed: 200 },
];

const mockTxns = [
  { id: 1, type: 'EARN', amount: 25, desc: 'Ride completed · #RD2891', date: '2026-03-22', balance: 1240 },
  { id: 2, type: 'EARN', amount: 15, desc: 'Ride completed · #RD2889', date: '2026-03-21', balance: 1215 },
  { id: 3, type: 'REDEEM', amount: 200, desc: 'Redeemed for ₹2 off', date: '2026-03-19', balance: 1200 },
  { id: 4, type: 'BONUS', amount: 100, desc: 'Perfect Week Bonus', date: '2026-03-17', balance: 1400 },
  { id: 5, type: 'EARN', amount: 50, desc: 'Ride completed · #RD2856', date: '2026-03-15', balance: 1300 },
  { id: 6, type: 'ADMIN_CREDIT', amount: 500, desc: 'Referral bonus', date: '2026-03-10', balance: 1250 },
];

const txnConfig = {
  EARN: { icon: ArrowDownRight, color: 'var(--success)', sign: '+', bg: 'color-mix(in srgb, var(--success), transparent 88%)' },
  REDEEM: { icon: ArrowUpRight, color: 'var(--error)', sign: '-', bg: 'color-mix(in srgb, var(--error), transparent 88%)' },
  BONUS: { icon: Gift, color: 'var(--warning)', sign: '+', bg: 'color-mix(in srgb, var(--warning), transparent 88%)' },
  ADMIN_CREDIT: { icon: Star, color: 'var(--primary)', sign: '+', bg: 'color-mix(in srgb, var(--primary), transparent 88%)' },
  ADMIN_DEBIT: { icon: ArrowUpRight, color: 'var(--error)', sign: '-', bg: 'color-mix(in srgb, var(--error), transparent 88%)' },
  EXPIRE: { icon: ArrowUpRight, color: 'var(--neutral)', sign: '-', bg: 'color-mix(in srgb, var(--neutral), transparent 88%)' },
};

function TierCard({ tier, totalRides }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.Bronze;
  const TierIcon = config.icon;
  const progress = config.ridesNeeded
    ? Math.min(100, (totalRides / config.ridesNeeded) * 100)
    : 100;

  const pieData = [
    { value: progress, fill: config.color },
    { value: 100 - progress, fill: 'transparent' },
  ];

  return (
    <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show"
      className="relative overflow-hidden rounded-2xl p-6 mb-6"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${config.color}, var(--base-100) 60%) 0%, var(--base-100) 100%)`,
        border: `1.5px solid ${config.color}40`,
        boxShadow: `0 16px 48px ${config.color}25`,
      }}>
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={42}
                startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <TierIcon size={18} style={{ color: config.color }} />
          </div>
        </div>

        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Current Tier</p>
          <h2 className="text-3xl font-black mb-1" style={{ fontFamily: 'var(--font-display)', color: config.color }}>
            {tier}
          </h2>
          {config.next && (
            <>
              <p className="text-xs mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                {config.ridesNeeded - totalRides} rides to {config.next}
              </p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--base-300)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: config.color }}
                />
              </div>
            </>
          )}
          {!config.next && (
            <p className="text-xs font-bold" style={{ color: config.color }}>
              🎉 Maximum tier achieved!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function WalletPage() {
  const dispatch = useDispatch();
  const stats = useSelector(selectStats);
  const profile = useSelector(selectProfile);
  const loading = useSelector(selectLoading('stats'));

  useEffect(() => { dispatch(fetchStats()); }, [dispatch]);

  const driverProfile = stats?.driverProfile;
  const coinBalance = driverProfile?.rewards?.coinBalance ?? 1240;
  const totalCoinsEarned = driverProfile?.rewards?.totalCoinsEarned ?? 3400;
  const totalCoinsRedeemed = driverProfile?.rewards?.totalCoinsRedeem ?? 800;
  const tier = driverProfile?.rewards?.tier ?? 'Silver';
  const totalRides = driverProfile?.performance?.totalRidesCompleted ?? 73;
  const earnedBadges = BADGES.filter(b => b.earned);

  const coinsInRupees = (coinBalance / 100).toFixed(2);

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--warning), transparent 85%)' }}>
              <Coins size={20} style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Wallet & Rewards
              </h1>
              <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Coins · Badges · Tier status
              </p>
            </div>
          </div>
          <button onClick={() => dispatch(fetchStats())}
            className="p-2.5 rounded-xl transition-all hover:bg-base-200"
            style={{ border: '1px solid var(--base-300)' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--base-content)' }} />
          </button>
        </motion.div>

        {/* Coin Balance Card */}
        <motion.div variants={fadeUp} custom={0.3} initial="hidden" animate="show"
          className="relative overflow-hidden rounded-2xl p-6 mb-6"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
            boxShadow: '0 20px 60px rgba(245, 158, 11, 0.4)',
          }}>
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Coin Balance</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {coinBalance.toLocaleString()}
                  </p>
                  <p className="text-white/70 text-sm mb-2">= ₹{coinsInRupees}</p>
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Coins size={26} className="text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Total Earned</p>
                <p className="text-white font-bold">{totalCoinsEarned.toLocaleString()} coins</p>
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Redeemed</p>
                <p className="text-white font-bold">{totalCoinsRedeemed.toLocaleString()} coins</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tier */}
        <TierCard tier={tier} totalRides={totalRides} />

        {/* Coin History Chart */}
        <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show" className="card p-5 mb-6">
          <h3 className="font-black text-base mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
            Coin Activity
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={mockCoinHistory} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: '12px', fontSize: 11 }} />
              <Bar dataKey="earned" name="Earned" fill="var(--warning)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="redeemed" name="Redeemed" fill="var(--error)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Badges */}
        <motion.div variants={fadeUp} custom={1.5} initial="hidden" animate="show" className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
              Badges <span className="text-warning">({earnedBadges.length}/{BADGES.length})</span>
            </h3>
            <TrendingUp size={16} style={{ color: 'var(--warning)' }} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {BADGES.map((badge, i) => (
              <motion.div key={badge.id} variants={fadeUp} custom={i * 0.05} initial="hidden" animate="show"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                style={{
                  background: badge.earned ? 'color-mix(in srgb, var(--warning), transparent 88%)' : 'var(--base-200)',
                  border: `1px solid ${badge.earned ? 'color-mix(in srgb, var(--warning), transparent 60%)' : 'var(--base-300)'}`,
                  opacity: badge.earned ? 1 : 0.45,
                  filter: badge.earned ? 'none' : 'grayscale(100%)',
                }}>
                <span className="text-2xl">{badge.icon}</span>
                <p className="text-center text-xs font-semibold leading-tight"
                  style={{ color: badge.earned ? 'var(--base-content)' : 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                  {badge.name}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show" className="card overflow-hidden">
          <div className="p-5 border-b" style={{ borderColor: 'var(--base-300)' }}>
            <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
              Coin Transactions
            </h3>
          </div>
          <div className="p-3">
            {mockTxns.map((txn, i) => {
              const cfg = txnConfig[txn.type] || txnConfig.EARN;
              const TxnIcon = cfg.icon;
              return (
                <motion.div key={txn.id} variants={fadeUp} custom={i * 0.04} initial="hidden" animate="show"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-all cursor-pointer">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: cfg.bg }}>
                    <TxnIcon size={15} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--base-content)' }}>{txn.desc}</p>
                    <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                      {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: cfg.color }}>
                      {cfg.sign}{txn.amount}
                    </p>
                    <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                      bal: {txn.balance}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}