'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, User, Shield, Coins, Gift, MapPin,
  Smartphone, Bell, FileText, Power, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, LogOut,
  Wallet, TrendingUp, BadgeCheck, ExternalLink,
  Menu, X as XIcon,
} from 'lucide-react';
import {
  selectUser, selectSettings, selectLoaders, selectWallet,
  selectReferral, selectCoins, selectCoinsRupees,
  getSettings, getWallet, getReferralCode, acceptLegal,
  deactivateAccount, sendHeartbeat, logout,
} from '@/store/slices/userSlice';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ── Lazy tab content ──────────────────────────────────────────────────────────
import AccountSettings from './account/page';
import Security        from './security/page';

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const tabSlide = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8,  transition: { duration: 0.2 } },
};

// ── Tabs config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',        icon: Settings },
  { id: 'account',   label: 'Account',         icon: User     },
  { id: 'security',  label: 'Security',        icon: Shield   },
  { id: 'wallet',    label: 'Wallet & Coins',  icon: Wallet   },
  { id: 'referral',  label: 'Referral',        icon: Gift     },
  { id: 'legal',     label: 'Legal',           icon: FileText },
];

// ── Stat mini card ────────────────────────────────────────────────────────────
function MiniStat({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate"
          style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>{label}</p>
        <p className="text-lg font-black font-montserrat leading-tight" style={{ color: 'var(--base-content)' }}>
          {value}
        </p>
        {sub && <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Verification badge row ────────────────────────────────────────────────────
function VerificationRow({ label, ok, action }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor: 'var(--base-300)' }}>
      <div className="flex items-center gap-2.5">
        {ok
          ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
          : <AlertCircle  size={16} style={{ color: 'var(--warning)' }} />}
        <span className="text-sm font-medium" style={{ color: 'var(--base-content)' }}>{label}</span>
      </div>
      {ok ? (
        <span className="badge badge-success text-[10px]">Verified</span>
      ) : (
        <button onClick={action} className="text-xs font-bold flex items-center gap-1"
          style={{ color: 'var(--primary)' }}>
          Verify <ChevronRight size={11} />
        </button>
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ user, settings, wallet, referral, loaders, onNavigate }) {
  const recentTxns = (wallet?.transactions ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero profile card */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="glass-card p-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }} />

        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ border: '3px solid var(--primary)' }}>
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full flex items-center justify-center text-xl font-black"
                  style={{ background: 'var(--bg-gradient-primary)', color: 'var(--primary-content)' }}>
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-xl font-montserrat" style={{ color: 'var(--base-content)' }}>
                {user?.name ?? 'Loading…'}
              </h3>
              {user?.isEmailVerified && <BadgeCheck size={16} style={{ color: 'var(--success)' }} />}
            </div>
            <p className="text-sm truncate" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
              {user?.email}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="badge badge-primary capitalize">{user?.role}</span>
              {user?.isPhoneVerified && <span className="badge badge-success">Phone ✓</span>}
              {user?.googleAuth?.googleId && <span className="badge badge-info">Google ✓</span>}
            </div>
          </div>
          <button onClick={() => onNavigate('account')} className="p-2 rounded-lg flex-shrink-0"
            style={{ background: 'var(--base-200)' }}>
            <ExternalLink size={14} style={{ color: 'var(--primary)' }} />
          </button>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Coins Balance',   value: (user?.coins ?? 0).toLocaleString(), sub: `₹${((user?.coins ?? 0) / 100).toFixed(2)} value`, icon: Coins,       color: 'var(--warning)' },
          { label: 'Wallet Balance',  value: `₹${(wallet?.balance ?? 0).toFixed(2)}`, icon: Wallet, color: 'var(--success)' },
          { label: 'Total Referrals', value: referral?.totalReferrals ?? 0,      sub: `${referral?.coinsEarned ?? 0} coins earned`, icon: Gift, color: 'var(--secondary)' },
          { label: 'Login Count',     value: user?.loginCount ?? 0,              icon: TrendingUp,  color: 'var(--primary)' },
        ].map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} initial="hidden" animate="visible" custom={i * 0.5 + 1}>
            <MiniStat {...s} />
          </motion.div>
        ))}
      </div>

      {/* Verification status + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Verification */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="glass-card p-5">
          <h4 className="font-black text-base font-montserrat mb-3" style={{ color: 'var(--base-content)' }}>
            Verification Status
          </h4>
          <VerificationRow label="Email Address" ok={user?.isEmailVerified}
            action={() => onNavigate('account')} />
          <VerificationRow label="Phone Number" ok={user?.isPhoneVerified}
            action={() => onNavigate('account')} />
          <VerificationRow label="Google Account" ok={!!user?.googleAuth?.googleId}
            action={() => onNavigate('security')} />
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--base-300)' }}>
            <button onClick={() => onNavigate('security')}
              className="text-xs font-bold flex items-center gap-1"
              style={{ color: 'var(--primary)' }}>
              Manage Security <ChevronRight size={11} />
            </button>
          </div>
        </motion.div>

        {/* Recent transactions */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-black text-base font-montserrat" style={{ color: 'var(--base-content)' }}>
              Recent Transactions
            </h4>
            <button onClick={() => onNavigate('wallet')}
              className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              View all <ChevronRight size={11} />
            </button>
          </div>
          {recentTxns.length === 0 ? (
            <div className="text-center py-6">
              <Wallet size={28} className="mx-auto opacity-20 mb-2" style={{ color: 'var(--base-content)' }} />
              <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
                No transactions yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTxns.map((t, i) => (
                <div key={t.transactionId ?? i} className="flex items-center justify-between py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--base-content)' }}>
                      {t.description ?? t.purpose?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
                      {t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-IN') : '—'}
                    </p>
                  </div>
                  <span className={`text-sm font-black ${t.type === 'Credit' ? '' : ''}`}
                    style={{ color: t.type === 'Credit' ? 'var(--success)' : 'var(--error)' }}>
                    {t.type === 'Credit' ? '+' : '−'}₹{t.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick navigation tiles */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5} className="glass-card p-5">
        <h4 className="font-black text-base font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
          Quick Actions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Edit Profile',      tab: 'account',  icon: User,     color: 'var(--primary)' },
            { label: 'Security',          tab: 'security', icon: Shield,   color: 'var(--success)' },
            { label: 'Wallet',            tab: 'wallet',   icon: Wallet,   color: 'var(--warning)' },
            { label: 'Referral Code',     tab: 'referral', icon: Gift,     color: 'var(--secondary)' },
            { label: 'Legal',             tab: 'legal',    icon: FileText, color: 'var(--info)' },
          ].map(({ label, tab, icon: Icon, color }) => (
            <button key={tab} onClick={() => onNavigate(tab)}
              className="flex items-center gap-3 p-3 rounded-xl transition-all text-left"
              style={{ background: 'var(--base-200)' }}
              onMouseEnter={e => e.currentTarget.style.background = `color-mix(in srgb, ${color}, transparent 88%)`}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--base-200)'}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>{label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ── Wallet & Coins tab ────────────────────────────────────────────────────────
function WalletTab({ user, wallet, loaders, onRedeemNav }) {
  const txns = wallet?.transactions ?? [];
  const chartData = txns
    .filter(t => t.type === 'Credit')
    .slice(-12)
    .map((t, i) => ({
      name: i,
      amount: t.amount ?? 0,
      label: t.description?.slice(0, 15) ?? t.purpose,
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <h2 className="section-heading text-3xl md:text-4xl">Wallet & Coins</h2>
        <p className="section-subheading text-base">Your financial overview, transaction history, and coin redemptions.</p>
      </motion.div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Wallet Balance',      value: `₹${(wallet?.balance ?? 0).toFixed(2)}`,            color: 'var(--success)',   icon: Wallet },
          { label: 'Withdrawable',        value: `₹${(wallet?.withdrawableBalance ?? 0).toFixed(2)}`, color: 'var(--primary)',  icon: TrendingUp },
          { label: 'Coins Balance',       value: `${(user?.coins ?? 0).toLocaleString()}`,            color: 'var(--warning)',  icon: Coins,
            sub: `₹${((user?.coins ?? 0) / 100).toFixed(2)} value` },
        ].map((s, i) => (
          <motion.div key={s.label} variants={fadeUp} initial="hidden" animate="visible" custom={i}>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={15} style={{ color: s.color }} />
                <p className="text-xs font-semibold"
                  style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>{s.label}</p>
              </div>
              <p className="text-3xl font-black font-montserrat" style={{ color: s.color }}>{s.value}</p>
              {s.sub && <p className="text-xs mt-1" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>{s.sub}</p>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Coin redemption CTA */}
      {(user?.coins ?? 0) >= 500 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
          className="p-5 rounded-2xl flex items-center justify-between gap-4 flex-wrap"
          style={{ background: 'var(--bg-gradient-primary)' }}>
          <div>
            <p className="font-black text-white text-lg font-montserrat">Redeem your coins!</p>
            <p className="text-white/80 text-sm">
              {user.coins.toLocaleString()} coins = ₹{(user.coins / 100).toFixed(2)} wallet credit
            </p>
          </div>
          <button className="btn-secondary bg-white border-white px-5 py-2.5 text-sm"
            style={{ color: 'var(--primary)', borderColor: 'white', background: 'white' }}>
            Redeem Now
          </button>
        </motion.div>
      )}

      {/* Credit history chart */}
      {chartData.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="glass-card p-5">
          <p className="font-black text-sm font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
            Credit History
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="walletGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" hide />
              <Tooltip formatter={(v) => [`₹${v}`, 'Amount']}
                contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="amount" stroke="var(--success)" strokeWidth={2}
                fill="url(#walletGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Transaction list */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5} className="glass-card p-5">
        <h4 className="font-black text-base font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
          Transaction History
        </h4>
        {txns.length === 0 ? (
          <div className="text-center py-10">
            <Wallet size={36} className="mx-auto opacity-20 mb-3" style={{ color: 'var(--base-content)' }} />
            <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
              No transactions yet
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--primary) var(--base-200)' }}>
            {txns.map((t, i) => (
              <div key={t.transactionId ?? i}
                className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{ background: i % 2 === 0 ? 'var(--base-200)' : 'transparent' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: t.type === 'Credit' ? 'color-mix(in srgb, var(--success), transparent 85%)' : 'color-mix(in srgb, var(--error), transparent 85%)' }}>
                  <TrendingUp size={14} style={{ color: t.type === 'Credit' ? 'var(--success)' : 'var(--error)',
                    transform: t.type === 'Debit' ? 'scaleY(-1)' : 'none' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--base-content)' }}>
                    {t.description ?? t.purpose?.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
                    {t.timestamp ? new Date(t.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
                <span className="text-sm font-black flex-shrink-0"
                  style={{ color: t.type === 'Credit' ? 'var(--success)' : 'var(--error)' }}>
                  {t.type === 'Credit' ? '+' : '−'}₹{t.amount?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Referral tab ──────────────────────────────────────────────────────────────
function ReferralTab({ user, referral }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(referral?.referralCode ?? '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <h2 className="section-heading text-3xl md:text-4xl">Referral Program</h2>
        <p className="section-subheading text-base">Invite friends and earn coins for every successful referral.</p>
      </motion.div>

      {/* Code card */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="glass-card p-6 space-y-4">
        <p className="text-sm font-semibold" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
          Your unique referral code
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 p-4 rounded-xl font-mono text-2xl font-black tracking-widest text-center"
            style={{ background: 'var(--base-200)', color: 'var(--primary)', letterSpacing: '0.25em' }}>
            {referral?.referralCode ?? '—'}
          </div>
          <button onClick={copy}
            className={`btn-primary-cta px-5 py-4 text-sm flex items-center gap-2 ${copied ? 'opacity-80' : ''}`}>
            {copied ? <CheckCircle2 size={16} /> : <Gift size={16} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
          Share this code. You earn <strong>1000 coins (₹10)</strong> for each person who signs up with it.
          They get <strong>500 coins (₹5)</strong> free.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Referrals', value: referral?.totalReferrals ?? 0,      color: 'var(--primary)' },
          { label: 'Coins Earned',    value: (referral?.coinsEarned ?? 0).toLocaleString(),   color: 'var(--success)' },
          { label: 'Coins Redeemed',  value: (referral?.coinsRedeemed ?? 0).toLocaleString(), color: 'var(--warning)' },
          { label: 'Referred By',     value: referral?.referredBy?.name ?? 'Direct',          color: 'var(--secondary)' },
        ].map(({ label, value, color }, i) => (
          <motion.div key={label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 2}
            className="glass-card p-4 text-center">
            <p className="text-2xl font-black font-montserrat" style={{ color }}>{value}</p>
            <p className="text-xs font-semibold mt-1"
              style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* History */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6} className="glass-card p-5">
        <h4 className="font-black text-base font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
          Referral History
        </h4>
        {(referral?.referralHistory ?? []).length === 0 ? (
          <div className="text-center py-8">
            <Gift size={32} className="mx-auto opacity-20 mb-2" style={{ color: 'var(--base-content)' }} />
            <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
              No referrals yet. Share your code to start earning!
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {referral.referralHistory.map((h, i) => (
              <div key={h._id ?? i} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'var(--base-200)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>
                    {h.referredUser?.name ?? 'New User'}
                  </p>
                  <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
                    {h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
                <span className="text-sm font-black" style={{ color: 'var(--success)' }}>
                  +{h.coinsAwarded} coins
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Legal tab ─────────────────────────────────────────────────────────────────
function LegalTab({ settings, loaders, dispatch, user }) {
  const [accepting, setAccepting] = useState(null);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivatePw, setDeactivatePw]   = useState('');

  const handleAccept = async (type) => {
    setAccepting(type);
    await dispatch(acceptLegal({
      acceptTerms:   type === 'terms'   ? true : undefined,
      acceptPrivacy: type === 'privacy' ? true : undefined,
    }));
    setAccepting(null);
  };

  const handleDeactivate = async () => {
    if (!deactivatePw) return;
    await dispatch(deactivateAccount(deactivatePw));
  };

  const legal = settings?.legal ?? {};
  const fmt   = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <h2 className="section-heading text-3xl md:text-4xl">Legal & Privacy</h2>
        <p className="section-subheading text-base">Manage your legal agreements and account lifecycle controls.</p>
      </motion.div>

      {/* Agreements */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="glass-card p-5 space-y-4">
        <h4 className="font-black text-base font-montserrat" style={{ color: 'var(--base-content)' }}>Agreements</h4>
        {[
          { key: 'terms',   label: 'Terms of Service',  accepted: legal.termsAcceptedAt,         acceptType: 'terms' },
          { key: 'privacy', label: 'Privacy Policy',    accepted: legal.privacyPolicyAcceptedAt,  acceptType: 'privacy' },
        ].map(({ key, label, accepted, acceptType }) => (
          <div key={key} className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: 'var(--base-200)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: accepted ? 'color-mix(in srgb, var(--success), transparent 85%)' : 'color-mix(in srgb, var(--warning), transparent 85%)' }}>
                <FileText size={16} style={{ color: accepted ? 'var(--success)' : 'var(--warning)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>{label}</p>
                <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
                  {accepted ? `Accepted ${fmt(accepted)}` : 'Not yet accepted'}
                </p>
              </div>
            </div>
            {!accepted ? (
              <button onClick={() => handleAccept(acceptType)} disabled={accepting === acceptType}
                className="btn-primary-cta px-4 py-2 text-xs flex items-center gap-1.5">
                {accepting === acceptType ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Accept
              </button>
            ) : (
              <span className="badge badge-success">Accepted</span>
            )}
          </div>
        ))}
      </motion.div>

      {/* Deactivate */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
        className="p-5 rounded-2xl space-y-4"
        style={{ background: 'color-mix(in srgb, var(--error), transparent 93%)', border: '1px solid color-mix(in srgb, var(--error), transparent 75%)' }}>
        <div className="flex items-center gap-2">
          <Power size={16} style={{ color: 'var(--error)' }} />
          <h4 className="font-black text-base font-montserrat" style={{ color: 'var(--error)' }}>Deactivate Account</h4>
        </div>
        <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 30%)' }}>
          Temporarily deactivate your account. Your data is preserved and you can reactivate by contacting support.
        </p>
        {!showDeactivate ? (
          <button onClick={() => setShowDeactivate(true)}
            className="btn-secondary border-error text-error px-4 py-2 text-xs flex items-center gap-2"
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
            <Power size={13} /> Deactivate Account
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <input type="password" value={deactivatePw} onChange={e => setDeactivatePw(e.target.value)}
              placeholder="Confirm your password" className="input-field w-full" />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeactivate(false); setDeactivatePw(''); }}
                className="btn-secondary flex-1 py-2 text-xs">Cancel</button>
              <button onClick={handleDeactivate} disabled={!deactivatePw || loaders.deactivate}
                className="flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'var(--error)', color: 'var(--error-content)' }}>
                {loaders.deactivate ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                Confirm Deactivate
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SettingsManagement — master shell
// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsManagement() {
  const dispatch  = useDispatch();
  const user      = useSelector(selectUser);
  const settings  = useSelector(selectSettings);
  const loaders   = useSelector(selectLoaders);
  const wallet    = useSelector(selectWallet);
  const referral  = useSelector(selectReferral);

  const pathname   = usePathname();
  const router     = useRouter();

  // ── URL → tab mapping ───────────────────────────────────────────────────
  // Route           Tab id
  // /settings            overview
  // /settings/account    account
  // /settings/security   security
  // /settings/wallet     wallet
  // /settings/referral   referral
  // /settings/legal      legal
  const PATH_TO_TAB = {
    '/settings':           'overview',
    '/settings/account':   'account',
    '/settings/security':  'security',
    '/settings/wallet':    'wallet',
    '/settings/referral':  'referral',
    '/settings/legal':     'legal',
  };

  const TAB_TO_PATH = {
    overview:  '/settings',
    account:   '/settings/account',
    security:  '/settings/security',
    wallet:    '/settings/wallet',
    referral:  '/settings/referral',
    legal:     '/settings/legal',
  };

  // Derive active tab from current URL (deep-link support)
  const derivedTab = PATH_TO_TAB[pathname] ?? 'overview';

  const [activeTab, setActiveTab] = useState(derivedTab);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync when URL changes externally (e.g. RoleNavLinks deep-link)
  useEffect(() => {
    setActiveTab(PATH_TO_TAB[pathname] ?? 'overview');
  }, [pathname]);

  // ── Bootstrap data ─────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(getSettings());
    dispatch(getWallet());
    dispatch(getReferralCode());
    // Heartbeat every 45 s
    const hb = setInterval(() => dispatch(sendHeartbeat()), 45_000);
    return () => clearInterval(hb);
  }, [dispatch]);

  // ── navigate: updates URL (triggers useEffect above) ──────────────────
  const navigate = useCallback((tab) => {
    const path = TAB_TO_PATH[tab] ?? '/settings';
    router.push(path, { scroll: false });
    setActiveTab(tab);         // instant local update — no flicker
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [router]);

  // ── Render active tab content ──────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case 'overview':  return <OverviewTab user={user} settings={settings} wallet={wallet} referral={referral} loaders={loaders} onNavigate={navigate} />;
      case 'account':   return <AccountSettings />;
      case 'security':  return <Security />;
      case 'wallet':    return <WalletTab user={user} wallet={wallet} loaders={loaders} />;
      case 'referral':  return <ReferralTab user={user} referral={referral} />;
      case 'legal':     return <LegalTab settings={settings} loaders={loaders} dispatch={dispatch} user={user} />;
      default:          return null;
    }
  };

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="container-custom max-w-6xl py-8">

        {/* ── Page title ───────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-montserrat font-black text-3xl md:text-4xl" style={{ color: 'var(--base-content)' }}>
                Settings
              </h1>
              <p className="text-sm mt-1" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                Manage your account, security, and preferences
              </p>
            </div>
            {/* Mobile menu toggle */}
            <button onClick={() => setMobileOpen(p => !p)}
              className="lg:hidden p-2.5 rounded-xl" style={{ background: 'var(--base-200)' }}>
              {mobileOpen ? <XIcon size={20} style={{ color: 'var(--base-content)' }} />
                          : <Menu   size={20} style={{ color: 'var(--base-content)' }} />}
            </button>
          </div>
        </motion.div>

        <div className="flex gap-6 relative">

          {/* ── Sidebar ────────────────────────────────────────────────── */}
          {/* Desktop */}
          <motion.aside
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
            className="hidden lg:flex flex-col gap-1 w-56 flex-shrink-0 sticky top-8 self-start">

            {/* User mini card in sidebar */}
            <div className="glass-card p-4 mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
                style={{ border: '2px solid var(--primary)' }}>
                {user?.avatar
                  ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-black text-sm"
                      style={{ background: 'var(--bg-gradient-primary)', color: 'var(--primary-content)' }}>
                      {user?.name?.[0]?.toUpperCase()}
                    </div>}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--base-content)' }}>{user?.name}</p>
                <p className="text-xs capitalize" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
                  {user?.role}
                </p>
              </div>
            </div>

            {TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button key={tab.id} onClick={() => navigate(tab.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full text-left transition-all duration-200"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'transparent',
                    color:      active ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content), transparent 30%)',
                    borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
                  }}>
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              );
            })}

            {/* Sign out quick link */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--base-300)' }}>
              <button
                onClick={() => { dispatch(logout()); router.push('/'); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full transition-all duration-200 text-left"
                style={{ color: 'var(--error)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--error), transparent 90%)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </motion.aside>

          {/* Mobile sidebar */}
          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="lg:hidden fixed inset-0 z-30"
                  style={{ background: 'color-mix(in srgb, var(--neutral), transparent 50%)' }}
                  onClick={() => setMobileOpen(false)} />
                <motion.div
                  initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  className="lg:hidden fixed top-0 left-0 bottom-0 z-40 w-64 p-6 flex flex-col gap-2"
                  style={{ background: 'var(--base-100)', borderRight: '1px solid var(--base-300)' }}>

                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-lg font-montserrat" style={{ color: 'var(--base-content)' }}>Settings</h3>
                    <button onClick={() => setMobileOpen(false)}>
                      <XIcon size={18} style={{ color: 'var(--base-content)' }} />
                    </button>
                  </div>

                  {/* User */}
                  <div className="glass-card p-3 mb-2 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
                      style={{ border: '2px solid var(--primary)' }}>
                      {user?.avatar
                        ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center font-black text-xs"
                            style={{ background: 'var(--bg-gradient-primary)', color: 'var(--primary-content)' }}>
                            {user?.name?.[0]?.toUpperCase()}
                          </div>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--base-content)' }}>{user?.name}</p>
                      <p className="text-xs capitalize" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
                        {user?.role}
                      </p>
                    </div>
                  </div>

                  {TABS.map((tab) => {
                    const active = tab.id === activeTab;
                    return (
                      <button key={tab.id} onClick={() => navigate(tab.id)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full text-left transition-all"
                        style={{
                          background: active ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'transparent',
                          color:      active ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content), transparent 30%)',
                        }}>
                        <tab.icon size={15} />
                        {tab.label}
                      </button>
                    );
                  })}

                  <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--base-300)' }}>
                    <button
                      onClick={() => { dispatch(logout()); router.push('/'); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full text-left"
                      style={{ color: 'var(--error)' }}>
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ── Main content ─────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">

            {/* Breadcrumb */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1.5}
              className="flex items-center gap-2 mb-5 text-xs font-semibold"
              style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
              <Settings size={12} />
              <span>Settings</span>
              <ChevronRight size={11} />
              <span style={{ color: 'var(--primary)' }}>{currentTab?.label}</span>
            </motion.div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={tabSlide}
                initial="hidden"
                animate="visible"
                exit="exit">
                {renderTab()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}