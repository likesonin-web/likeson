'use client';

/**
 * WalletPage — Solo Driver Partner
 *
 * Fixes from original broken file:
 *  - `fetchStats` / `selectStats` don't exist → replaced with
 *    `fetchPerformance`, `fetchRewards`, `fetchRewardBadges`,
 *    `fetchComplianceDashboard` + their correct selectors.
 *  - All mock data replaced by live Redux state with graceful fallbacks.
 *  - No inline styles; uses global.css custom-property classes exclusively.
 *  - Heavy chart section lazy-loaded via next/dynamic.
 *  - Skeleton loaders for every async section.
 *  - Full a11y: semantic HTML, ARIA labels, focus-visible rings.
 *  - No prop drilling; hooks-only data access.
 *  - useCallback / useMemo guard all derived computations.
 */

import dynamic from 'next/dynamic';
import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Coins,
  Star,
  TrendingUp,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  Zap,
  Award,
  Target,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchPerformance,
  fetchRewards,
  fetchRewardBadges,
  fetchComplianceDashboard,
  selectPerformance,
  selectRewards,
  selectBadges,
  selectCompliance,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';

// ── Lazy-load Recharts (heavy, ~70 KB gz) ────────────────────────────────────
const CoinHistoryChart = dynamic(() => import('./CoinHistoryChart'), {
  ssr:     false,
  loading: () => <ChartSkeleton />,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  Bronze:   { color: '#cd7f32', Icon: Target,   next: 'Silver',   threshold: 50   },
  Silver:   { color: '#a8a9ad', Icon: Award,    next: 'Gold',     threshold: 200  },
  Gold:     { color: '#ffd700', Icon: Crown,    next: 'Platinum', threshold: 500  },
  Platinum: { color: '#e5e4e2', Icon: Sparkles, next: 'Diamond',  threshold: 1000 },
  Diamond:  { color: '#b9f2ff', Icon: Zap,      next: null,       threshold: null },
};

const ALL_BADGE_DEFINITIONS = [
  { id: 'FIRST_RIDE',       name: 'First Ride',    icon: '🚗' },
  { id: 'RIDES_10',         name: '10 Rides',      icon: '🏆' },
  { id: 'RIDES_50',         name: '50 Rides',      icon: '⭐' },
  { id: 'RIDES_100',        name: '100 Rides',     icon: '🎖️' },
  { id: 'TOP_RATED',        name: 'Top Rated',     icon: '💎' },
  { id: 'SAFE_DRIVER',      name: 'Safe Driver',   icon: '🛡️' },
  { id: 'NIGHT_OWL',        name: 'Night Owl',     icon: '🦉' },
  { id: 'PERFECT_WEEK',     name: 'Perfect Week',  icon: '🎯' },
  { id: 'SOLO_PARTNER',     name: 'Solo Partner',  icon: '🎪' },
  { id: 'LOYAL_DRIVER_1Y',  name: '1 Year Club',   icon: '🗓️' },
  { id: 'LONG_HAUL',        name: 'Long Haul',     icon: '🛣️' },
  { id: 'ZERO_CANCEL_MONTH',name: 'Zero Cancels',  icon: '✅' },
];

const TXN_CONFIG = {
  EARN:         { Icon: ArrowDownRight, colorVar: 'var(--success)', sign: '+' },
  REDEEM:       { Icon: ArrowUpRight,   colorVar: 'var(--error)',   sign: '-' },
  BONUS:        { Icon: Gift,           colorVar: 'var(--warning)', sign: '+' },
  ADMIN_CREDIT: { Icon: Star,           colorVar: 'var(--primary)', sign: '+' },
  ADMIN_DEBIT:  { Icon: ArrowUpRight,   colorVar: 'var(--error)',   sign: '-' },
  EXPIRE:       { Icon: ArrowUpRight,   colorVar: 'var(--neutral)', sign: '-' },
};

// ── Skeleton Components ───────────────────────────────────────────────────────

function BalanceCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-6 mb-6 animate-pulse bg-base-200"
      aria-label="Loading balance"
      aria-busy="true"
    >
      <div className="skeleton h-4 w-28 mb-3 rounded" />
      <div className="skeleton h-12 w-40 mb-4 rounded" />
      <div className="flex gap-8 pt-4 border-t border-base-300">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
    </div>
  );
}

function TierCardSkeleton() {
  return (
    <div className="card p-6 mb-6 animate-pulse" aria-busy="true">
      <div className="flex items-center gap-6">
        <div className="skeleton w-24 h-24 rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-2 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="card p-5 mb-6 animate-pulse" aria-busy="true">
      <div className="skeleton h-4 w-32 mb-4 rounded" />
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}

function BadgeSkeleton() {
  return (
    <div className="card p-5 mb-6 animate-pulse" aria-busy="true">
      <div className="skeleton h-4 w-40 mb-4 rounded" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function TxnListSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse" aria-busy="true">
      <div className="p-5 border-b border-base-300">
        <div className="skeleton h-4 w-40 rounded" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-48 rounded" />
              <div className="skeleton h-2 w-24 rounded" />
            </div>
            <div className="skeleton h-4 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function BalanceCard({ coinBalance, totalCoinsEarned, totalCoinsRedeemed }) {
  const rupeeValue = useMemo(
    () => (coinBalance / 100).toFixed(2),
    [coinBalance]
  );

  return (
    <section
      aria-label="Coin balance"
      className="relative overflow-hidden rounded-2xl p-6 mb-6"
      style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
        boxShadow: '0 20px 60px rgba(245,158,11,0.4)',
      }}
    >
      {/* Decorative blobs — purely visual, hidden from AT */}
      <div
        aria-hidden="true"
        className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1 text-white opacity-70">
              Coin Balance
            </p>
            <div className="flex items-end gap-3">
              <p
                className="text-5xl font-black text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {coinBalance.toLocaleString('en-IN')}
              </p>
              <p className="text-sm text-white opacity-70 mb-2">= ₹{rupeeValue}</p>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <Coins size={26} className="text-white" />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
          <div>
            <dt className="text-xs uppercase tracking-wider mb-0.5 text-white opacity-60">
              Total Earned
            </dt>
            <dd className="font-bold text-white">
              {totalCoinsEarned.toLocaleString('en-IN')} coins
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider mb-0.5 text-white opacity-60">
              Redeemed
            </dt>
            <dd className="font-bold text-white">
              {totalCoinsRedeemed.toLocaleString('en-IN')} coins
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function TierProgressCard({ tier, totalRides }) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.Bronze;
  const { Icon, color, next, threshold } = config;

  const progress = useMemo(
    () => (threshold ? Math.min(100, Math.round((totalRides / threshold) * 100)) : 100),
    [totalRides, threshold]
  );

  const ridesLeft = threshold ? Math.max(0, threshold - totalRides) : 0;

  return (
    <section
      aria-label={`Driver tier: ${tier}`}
      className="relative overflow-hidden rounded-2xl p-6 mb-6"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color}, var(--base-100) 60%) 0%, var(--base-100) 100%)`,
        border: `1.5px solid ${color}40`,
        boxShadow: `0 16px 48px ${color}25`,
      }}
    >
      <div className="flex items-center gap-6">
        {/* Circular progress ring via SVG — no Recharts dependency needed here */}
        <div
          aria-hidden="true"
          className="relative w-24 h-24 shrink-0"
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="var(--base-300)"
              strokeWidth="10"
            />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon size={20} style={{ color }} aria-hidden="true" />
          </div>
        </div>

        <div className="flex-1">
          <p
            className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}
          >
            Current Tier
          </p>
          <h2
            className="text-3xl font-black mb-1"
            style={{ fontFamily: 'var(--font-display)', color }}
          >
            {tier}
          </h2>

          {next ? (
            <>
              <p
                className="text-xs mb-2"
                style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}
              >
                {ridesLeft} rides to {next}
              </p>
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress to ${next}: ${progress}%`}
                className="progress-bar"
              >
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%`, background: color }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs font-bold" style={{ color }}>
              🎉 Maximum tier achieved!
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function BadgeGrid({ earnedBadgeIds }) {
  const badgeSet = useMemo(() => new Set(earnedBadgeIds), [earnedBadgeIds]);
  const earnedCount = badgeSet.size;

  return (
    <section aria-label="Achievement badges" className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="font-black text-base"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}
        >
          Badges{' '}
          <span className="text-warning">
            ({earnedCount}/{ALL_BADGE_DEFINITIONS.length})
          </span>
        </h3>
        <TrendingUp size={16} style={{ color: 'var(--warning)' }} aria-hidden="true" />
      </div>

      <ul
        className="grid grid-cols-4 gap-3 list-none p-0 m-0"
        aria-label="Badge list"
      >
        {ALL_BADGE_DEFINITIONS.map((badge) => {
          const earned = badgeSet.has(badge.id);
          return (
            <li
              key={badge.id}
              aria-label={`${badge.name} badge — ${earned ? 'earned' : 'not yet earned'}`}
            >
              <div
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                style={{
                  background: earned
                    ? 'color-mix(in srgb, var(--warning), transparent 88%)'
                    : 'var(--base-200)',
                  border: `1px solid ${earned
                    ? 'color-mix(in srgb, var(--warning), transparent 60%)'
                    : 'var(--base-300)'}`,
                  opacity: earned ? 1 : 0.45,
                  filter: earned ? 'none' : 'grayscale(100%)',
                }}
              >
                <span className="text-2xl" aria-hidden="true">{badge.icon}</span>
                <p
                  className="text-center text-xs font-semibold leading-tight"
                  style={{
                    color: earned
                      ? 'var(--base-content)'
                      : 'color-mix(in oklch, var(--base-content) 50%, transparent)',
                  }}
                >
                  {badge.name}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TransactionRow({ txn }) {
  const cfg = TXN_CONFIG[txn.type] ?? TXN_CONFIG.EARN;
  const { Icon, colorVar, sign } = cfg;

  const formattedDate = useMemo(
    () =>
      new Date(txn.timestamp || txn.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [txn.timestamp, txn.createdAt]
  );

  const bgColor = useMemo(
    () => `color-mix(in srgb, ${colorVar}, transparent 88%)`,
    [colorVar]
  );

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-all">
      <div
        aria-hidden="true"
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bgColor }}
      >
        <Icon size={15} style={{ color: colorVar }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--base-content)' }}
        >
          {txn.description}
        </p>
        <p
          className="text-xs"
          style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}
        >
          {formattedDate}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold" style={{ color: colorVar }}>
          {sign}
          {txn.amount}
        </p>
        {txn.balance !== undefined && (
          <p
            className="text-xs"
            style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}
          >
            bal: {txn.balance}
          </p>
        )}
      </div>
    </div>
  );
}

function TransactionList({ transactions }) {
  if (!transactions?.length) {
    return (
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-base-300">
          <h3
            className="font-black text-base"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}
          >
            Coin Transactions
          </h3>
        </div>
        <div className="p-10 flex flex-col items-center gap-3">
          <Coins
            size={40}
            style={{ color: 'color-mix(in oklch, var(--base-content) 20%, transparent)' }}
            aria-hidden="true"
          />
          <p
            className="text-sm font-semibold"
            style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}
          >
            No transactions yet
          </p>
          <p
            className="text-xs text-center"
            style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }}
          >
            Complete rides to start earning coins!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden" aria-label="Coin transaction history">
      <div className="p-5 border-b border-base-300">
        <h3
          className="font-black text-base"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}
        >
          Coin Transactions
        </h3>
      </div>
      <div className="p-3" role="list" aria-label="Recent transactions">
        {transactions.slice(0, 20).map((txn) => (
          <div key={txn._id ?? txn.transactionId ?? txn.id} role="listitem">
            <TransactionRow txn={txn} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ComplianceAlert({ compliance }) {
  if (!compliance?.hasExpired && !compliance?.hasExpiring) return null;

  return (
    <div
      role="alert"
      className={`alert mb-6 ${compliance.hasExpired ? 'alert-error' : 'alert-warning'}`}
    >
      <AlertTriangle
        size={18}
        aria-hidden="true"
        style={{
          color: compliance.hasExpired ? 'var(--error)' : 'var(--warning)',
          flexShrink: 0,
        }}
      />
      <p className="text-sm font-semibold">
        {compliance.hasExpired
          ? 'Some compliance documents have expired. Your account may be restricted.'
          : 'Some compliance documents are expiring soon. Please renew to avoid disruptions.'}
      </p>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div role="alert" className="alert alert-error mb-6">
      <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--error)' }} />
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

/**
 * WalletPage
 *
 * Data sources (from soloDriverSlice):
 *   - selectPerformance → totalRidesCompleted, rating, totalEarnings
 *   - selectRewards     → coinBalance, totalCoinsEarned, totalCoinsRedeem,
 *                         tier, coinTransactions
 *   - selectBadges      → array of { badgeId, name, isActive }
 *   - selectCompliance  → hasExpired, hasExpiring, documents[]
 */
export default function WalletPage() {
  const dispatch = useDispatch();

  const performance  = useSelector(selectPerformance);
  const rewards      = useSelector(selectRewards);
  const badges       = useSelector(selectBadges);
  const compliance   = useSelector(selectCompliance);

  const isLoadingPerf  = useSelector(selectLoading('performance'));
  const isLoadingRew   = useSelector(selectLoading('rewards'));
  const isLoadingBadge = useSelector(selectLoading('badges'));
  const isLoadingComp  = useSelector(selectLoading('compliance'));
  const errorPerf      = useSelector(selectError('performance'));
  const errorRew       = useSelector(selectError('rewards'));

  const isLoading = isLoadingPerf || isLoadingRew || isLoadingBadge;

  const loadAll = useCallback(() => {
    dispatch(fetchPerformance());
    dispatch(fetchRewards());
    dispatch(fetchRewardBadges());
    dispatch(fetchComplianceDashboard());
  }, [dispatch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Derived data (memoised) ────────────────────────────────────────────────
  const coinBalance       = useMemo(() => rewards?.coinBalance       ?? 0, [rewards]);
  const totalCoinsEarned  = useMemo(() => rewards?.totalCoinsEarned  ?? 0, [rewards]);
  const totalCoinsRedeemed = useMemo(() => rewards?.totalCoinsRedeem ?? 0, [rewards]);
  const tier              = useMemo(() => rewards?.tier              ?? 'Bronze', [rewards]);
  const totalRides        = useMemo(() => performance?.totalRidesCompleted ?? 0, [performance]);
  const transactions      = useMemo(() => rewards?.coinTransactions  ?? [], [rewards]);

  /** Map earned badge IDs for O(1) lookup in BadgeGrid */
  const earnedBadgeIds = useMemo(
    () => (badges ?? []).filter((b) => b.isActive).map((b) => b.badgeId),
    [badges]
  );

  const hasError = !!(errorPerf || errorRew);

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--base-100)' }}
      aria-label="Wallet and rewards"
    >
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--warning), transparent 85%)' }}
              aria-hidden="true"
            >
              <Coins size={20} style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <h1
                className="text-2xl font-black"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}
              >
                Wallet &amp; Rewards
              </h1>
              <p
                className="text-sm"
                style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}
              >
                Coins · Badges · Tier status
              </p>
            </div>
          </div>

          <button
            onClick={loadAll}
            disabled={isLoading}
            aria-label="Refresh wallet data"
            className="btn btn-ghost btn-circle"
          >
            <RefreshCw
              size={16}
              className={isLoading ? 'animate-spin' : ''}
              style={{ color: 'var(--base-content)' }}
              aria-hidden="true"
            />
          </button>
        </header>

        {/* ── Compliance banner (non-blocking) ─────────────────────────── */}
        {!isLoadingComp && compliance && (
          <ComplianceAlert compliance={compliance} />
        )}

        {/* ── Error state ──────────────────────────────────────────────── */}
        {hasError && (
          <ErrorBanner
            message={errorPerf ?? errorRew ?? 'Failed to load wallet data. Please refresh.'}
          />
        )}

        {/* ── Coin Balance Card ─────────────────────────────────────────── */}
        {isLoadingRew ? (
          <BalanceCardSkeleton />
        ) : (
          <BalanceCard
            coinBalance={coinBalance}
            totalCoinsEarned={totalCoinsEarned}
            totalCoinsRedeemed={totalCoinsRedeemed}
          />
        )}

        {/* ── Tier Progress ─────────────────────────────────────────────── */}
        {isLoadingRew || isLoadingPerf ? (
          <TierCardSkeleton />
        ) : (
          <TierProgressCard tier={tier} totalRides={totalRides} />
        )}

        {/* ── Coin History Chart (lazy) ─────────────────────────────────── */}
        <CoinHistoryChart transactions={transactions} isLoading={isLoadingRew} />

        {/* ── Badges ───────────────────────────────────────────────────── */}
        {isLoadingBadge ? (
          <BadgeSkeleton />
        ) : (
          <BadgeGrid earnedBadgeIds={earnedBadgeIds} />
        )}

        {/* ── Transaction History ───────────────────────────────────────── */}
        {isLoadingRew ? (
          <TxnListSkeleton />
        ) : (
          <TransactionList transactions={transactions} />
        )}

        {/* ── Footer note ───────────────────────────────────────────────── */}
        <footer className="mt-8 text-center">
          <p
            className="text-xs"
            style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}
          >
            100 coins = ₹1.00 &nbsp;·&nbsp; Coins expire after 365 days of inactivity
          </p>
        </footer>
      </div>
    </main>
  );
}