"use client";

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPerformance,
  fetchRewards,
  fetchRewardBadges,
  selectPerformance,
  selectRewards,
  selectBadges,
  selectLoading,
  selectError,
} from "@/store/slices/soloDriverSlice";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, TrendingUp, Trophy, Coins, Shield, Zap, Clock,
  Route, IndianRupee, Award, Target, Activity, ChevronRight,
  AlertCircle, Bike,
} from "lucide-react";
import BackButton from "../../../../components/BackButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = {
  num:  (n) => (n ?? 0).toLocaleString("en-IN"),
  inr:  (n) => `₹${(n ?? 0).toLocaleString("en-IN")}`,
  pct:  (n) => `${(n ?? 0).toFixed(1)}%`,
  star: (n) => (n ?? 0).toFixed(1),
  km:   (n) => `${(n ?? 0).toLocaleString("en-IN")} km`,
  min:  (n) => `${(n ?? 0).toFixed(1)} min`,
};

const TIER_META = {
  Bronze:   { emoji:"🥉", color:"#d97706" },
  Silver:   { emoji:"🥈", color:"#9ca3af" },
  Gold:     { emoji:"🥇", color:"#f59e0b" },
  Platinum: { emoji:"💠", color:"#60a5fa" },
  Diamond:  { emoji:"💎", color:"#a78bfa" },
};
const TIER_ORDER = ["Bronze","Silver","Gold","Platinum","Diamond"];

const BADGE_ICONS = {
  FIRST_RIDE:"🚗",RIDES_10:"🔟",RIDES_50:"⭐",RIDES_100:"💯",RIDES_500:"🏅",
  RIDES_1000:"🏆",TOP_RATED:"⭐",PERFECT_WEEK:"📅",SPEED_KING:"⚡",
  ZERO_CANCEL_MONTH:"🛡️",SAFE_DRIVER:"🦺",NIGHT_OWL:"🦉",LONG_HAUL:"🛣️",
  VERIFIED_DRIVER:"✅",LOYAL_DRIVER_1Y:"💙",LOYAL_DRIVER_2Y:"💜",
  EARLY_ADOPTER:"🌅",SOLO_PARTNER:"🤝",
};

// ─── Variants ─────────────────────────────────────────────────────────────────
const fadeUp  = { hidden:{opacity:0,y:18}, show:{opacity:1,y:0,transition:{duration:0.4,ease:[0.22,1,0.36,1]}} };
const stagger = { show:{ transition:{ staggerChildren:0.07 } } };
const scaleIn = { hidden:{opacity:0,scale:0.88}, show:{opacity:1,scale:1,transition:{duration:0.35,ease:[0.22,1,0.36,1]}} };

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <motion.div variants={fadeUp} className="stat-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="stat-card-label">{label}</p>
          <p className="stat-card-value mt-1.5">{value}</p>
          {sub && <p className="text-xs mt-1 text-base-content/50 font-medium">{sub}</p>}
        </div>
        <div className="shrink-0 w-10 h-10 rounded-[var(--r-field)] flex items-center justify-center"
          style={{ background: iconBg, border: `1px solid ${iconColor}30` }}>
          <Icon size={17} style={{ color: iconColor }} strokeWidth={1.8} />
        </div>
      </div>
    </motion.div>
  );
}

function RatingOrb({ rating, count }) {
  const pct  = ((rating ?? 0) / 5) * 100;
  const data = [{ value:pct },{ value:100-pct }];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={46} outerRadius={60}
              startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
              <Cell fill="var(--accent)" />
              <Cell fill="var(--base-300)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-display leading-none" style={{ color:"var(--base-content)" }}>
            {fmt.star(rating)}
          </span>
          <span className="text-[10px] font-mono mt-0.5 text-base-content/40">/ 5.0</span>
        </div>
      </div>
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map((s) => (
          <Star key={s} size={13}
            fill={s <= Math.round(rating) ? "var(--accent)" : "transparent"}
            stroke={s <= Math.round(rating) ? "var(--accent)" : "var(--base-300)"}
            strokeWidth={1.5} />
        ))}
      </div>
      <p className="text-xs text-base-content/40">{fmt.num(count)} ratings</p>
    </div>
  );
}

function TierDisplay({ tier }) {
  const meta = TIER_META[tier] || TIER_META.Bronze;
  const idx  = TIER_ORDER.indexOf(tier);
  const pct  = Math.round((idx / (TIER_ORDER.length - 1)) * 100);
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <motion.div
        initial={{ scale:0.7, opacity:0 }}
        animate={{ scale:1,   opacity:1 }}
        transition={{ type:"spring", stiffness:180, damping:14 }}
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{
          background:`color-mix(in srgb, ${meta.color}, transparent 80%)`,
          border:`2px solid color-mix(in srgb, ${meta.color}, transparent 45%)`,
          boxShadow:`0 0 24px color-mix(in srgb, ${meta.color}, transparent 58%)`,
        }}
      >
        {meta.emoji}
      </motion.div>
      <div className="text-center">
        <div className="font-display font-black text-xl text-base-content">{tier}</div>
        <span className="badge badge-accent badge-xs mt-1">Driver Tier</span>
      </div>
      {idx < TIER_ORDER.length - 1 && (
        <div className="w-full">
          <div className="flex justify-between text-[10px] text-base-content/40 font-mono mb-1.5">
            <span>{tier}</span>
            <span>{TIER_ORDER[idx+1]}</span>
          </div>
          <div className="progress-bar">
            <motion.div className="progress-bar-fill"
              initial={{ width:0 }}
              animate={{ width:`${pct}%` }}
              transition={{ duration:1, ease:"easeOut", delay:0.4 }} />
          </div>
        </div>
      )}
    </div>
  );
}

function EarningsChart({ totalEarnings }) {
  const weeks = useMemo(() => {
    const base = totalEarnings ?? 0;
    return ["W1","W2","W3","W4","W5","W6","W7","W8"].map((w,i) => ({
      week:w,
      earnings:Math.round(base*(0.08+Math.sin(i*0.9)*0.04+i*0.015)),
    }));
  }, [totalEarnings]);

  const Tip = ({ active, payload }) => {
    if (!active||!payload?.length) return null;
    return (
      <div className="glass-card px-3 py-2 text-xs !shadow-sm !transform-none">
        <p className="text-base-content/50">{payload[0]?.payload?.week}</p>
        <p className="font-bold text-primary">{fmt.inr(payload[0]?.value)}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={155}>
      <AreaChart data={weeks} margin={{ top:8,right:4,left:-26,bottom:0 }}>
        <defs>
          <linearGradient id="sdpEarn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
        <XAxis dataKey="week" tick={{ fill:"var(--base-content)", opacity:0.35, fontSize:10, fontFamily:"monospace" }}
          axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:"var(--base-content)", opacity:0.35, fontSize:9, fontFamily:"monospace" }}
          axisLine={false} tickLine={false} tickFormatter={(v)=>`₹${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<Tip />} cursor={{ stroke:"var(--primary)", strokeOpacity:0.18, strokeWidth:1 }} />
        <Area type="monotone" dataKey="earnings" stroke="var(--primary)" strokeWidth={2}
          fill="url(#sdpEarn)" dot={false}
          activeDot={{ r:4, fill:"var(--primary)", strokeWidth:0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CancelGauge({ rate }) {
  const safe    = Math.min(100,Math.max(0,rate??0));
  const cssColor= safe<5?"var(--success)":safe<15?"var(--warning)":"var(--error)";
  const badgeCls= safe<5?"badge-success":safe<15?"badge-warning":"badge-error";
  const lbl     = safe<5?"Excellent":safe<15?"Acceptable":"Needs work";
  const data    = [{ value:safe },{ value:100-safe }];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={46}
              startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
              <Cell fill={cssColor} />
              <Cell fill="var(--base-300)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black font-display leading-none" style={{ color:cssColor }}>
            {fmt.pct(safe)}
          </span>
        </div>
      </div>
      <span className={`badge ${badgeCls} badge-sm`}>{lbl}</span>
    </div>
  );
}

function BadgeGrid({ badges }) {
  if (!badges?.length)
    return (
      <div className="text-center py-8 text-base-content/30">
        <Award size={30} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No badges earned yet</p>
      </div>
    );
  return (
    <motion.div variants={stagger} className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {badges.map((b) => (
        <motion.div key={b._id||b.badgeId} variants={scaleIn}
          className="glass-card flex flex-col items-center gap-2 p-3 cursor-default !rounded-[var(--r-field)] text-center">
          <span className="text-2xl">{BADGE_ICONS[b.badgeId]||"🏅"}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight text-base-content/50">
            {b.name}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function CoinCard({ balance, earned, redeemed }) {
  const usePct = earned>0 ? Math.min(100,(redeemed/earned)*100) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
          style={{ background:"color-mix(in srgb,var(--accent),transparent 80%)", border:"1.5px solid color-mix(in srgb,var(--accent),transparent 52%)" }}>
          🪙
        </div>
        <div>
          <div className="text-3xl font-black font-display leading-none text-accent">{fmt.num(balance)}</div>
          <div className="text-xs text-base-content/40 font-mono mt-0.5">≈ {fmt.inr(balance/100)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label:"Earned",   value:earned   },
          { label:"Redeemed", value:redeemed },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card !p-3">
            <p className="stat-card-label">{label}</p>
            <p className="stat-card-value !text-xl mt-1">{fmt.num(value)}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-base-content/40 font-mono mb-1.5">
          <span>Redemption rate</span><span>{fmt.pct(usePct)}</span>
        </div>
        <div className="progress-bar">
          <motion.div className="progress-bar-fill"
            initial={{ width:0 }}
            animate={{ width:`${usePct}%` }}
            transition={{ duration:1, ease:"easeOut", delay:0.5 }} />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_,i) => <div key={i} className="skeleton h-24 rounded-[var(--r-box)]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="skeleton h-60 lg:col-span-2 rounded-[var(--r-box)]" />
        <div className="skeleton h-60 rounded-[var(--r-box)]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="skeleton h-52 rounded-[var(--r-box)]" />
        <div className="skeleton h-52 rounded-[var(--r-box)]" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const dispatch = useDispatch();

  const performance = useSelector(selectPerformance);
  const rewards     = useSelector(selectRewards);
  const badges      = useSelector(selectBadges);
  const loadingP    = useSelector(selectLoading("performance"));
  const loadingR    = useSelector(selectLoading("rewards"));
  const loadingB    = useSelector(selectLoading("badges"));
  const errPerf     = useSelector(selectError("performance"));
  const isLoading   = loadingP || loadingR || loadingB;

  useEffect(() => {
    dispatch(fetchPerformance());
    dispatch(fetchRewards());
    dispatch(fetchRewardBadges());
  }, [dispatch]);

  const stats  = performance?.stats  ?? {};
  const rating = performance?.rating ?? {};
  const dp     = performance?.driverPerformance ?? {};
  const tier   = performance?.tier ?? rewards?.tier ?? "Bronze";

  const totalRides    = dp.totalRidesCompleted ?? stats.totalRidesCompleted ?? 0;
  const totalEarnings = dp.totalEarnings       ?? stats.totalEarnings       ?? 0;
  const avgRating     = dp.rating              ?? rating.averageRating       ?? 0;
  const ratingCount   = dp.ratingCount         ?? rating.totalRatings        ?? 0;
  const totalKm       = dp.totalDistanceKm     ?? 0;
  const cancelRate    = dp.cancellationRate    ?? 0;
  const avgPickup     = dp.avgPickupTimeMinutes ?? 0;
  const profilePct    = performance?.profileCompletion ?? 0;
  const partnerSince  = performance?.partnerSince;
  const coinBal       = rewards?.coinBalance   ?? 0;
  const coinEarn      = rewards?.coinsEarned   ?? 0;
  const coinUsed      = rewards?.coinsRedeemed ?? 0;

  const sinceStr = partnerSince
    ? new Date(partnerSince).toLocaleDateString("en-IN",{ month:"long",year:"numeric" })
    : null;

  // KPI card configs (use CSS var strings for inline style)
  const kpiCards = [
    { icon:Bike,        label:"Total Rides",     value:fmt.num(totalRides),    sub:"completed",    bg:"color-mix(in srgb,var(--primary),transparent 88%)",   color:"var(--primary)"   },
    { icon:IndianRupee, label:"Total Earnings",  value:fmt.inr(totalEarnings), sub:"lifetime",     bg:"color-mix(in srgb,var(--success),transparent 88%)",   color:"var(--success)"   },
    { icon:Star,        label:"Avg Rating",      value:fmt.star(avgRating),    sub:`${fmt.num(ratingCount)} reviews`, bg:"color-mix(in srgb,var(--accent),transparent 88%)", color:"var(--accent)" },
    { icon:Route,       label:"Distance",        value:fmt.km(totalKm),        sub:"on-road",      bg:"color-mix(in srgb,var(--info),transparent 88%)",      color:"var(--info)"      },
    { icon:Clock,       label:"Avg Pickup",      value:fmt.min(avgPickup),     sub:"response time",bg:"color-mix(in srgb,var(--warning),transparent 88%)",   color:"var(--warning)"   },
    { icon:Shield,      label:"Cancel Rate",     value:fmt.pct(cancelRate),    sub:cancelRate<5?"Excellent":cancelRate<15?"Acceptable":"Needs work", bg:cancelRate<5?"color-mix(in srgb,var(--success),transparent 85%)":cancelRate<15?"color-mix(in srgb,var(--warning),transparent 85%)":"color-mix(in srgb,var(--error),transparent 85%)", color:cancelRate<5?"var(--success)":cancelRate<15?"var(--warning)":"var(--error)" },
    { icon:Coins,       label:"Coin Balance",    value:fmt.num(coinBal),       sub:"redeemable",   bg:"color-mix(in srgb,var(--accent),transparent 88%)",    color:"var(--accent)"    },
    { icon:Zap,         label:"Monthly Rides",   value:fmt.num(dp.monthlyRides??0), sub:"this month", bg:"color-mix(in srgb,var(--secondary),transparent 88%)", color:"var(--secondary)" },
  ];

  return (
    <div data-theme="solodriverpartner" className="min-h-screen bg-base-100 text-base-content px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
                <BackButton className=' my-2 rounded-md px-3' />
          
        {/* Header */}
        <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={13} className="text-primary" />
              <span className="text-xs font-semibold text-base-content/40 uppercase tracking-widest font-mono">Overview</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
              Performance <span className="text-gradient-primary">Analytics</span>
            </h1>
            {sinceStr && <p className="text-sm text-base-content/40 mt-1 font-mono">Partner since {sinceStr}</p>}
          </div>

          {/* Profile completion */}
          <div className="flex items-center gap-3 card px-4 py-3 !transform-none !hover:transform-none w-fit">
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--base-300)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" strokeWidth="3"
                  strokeDasharray={`${profilePct*0.942} 100`} strokeLinecap="round" />
              </svg>
              <Target size={11} className="text-primary absolute inset-0 m-auto" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">Profile</p>
              <p className="text-sm font-bold text-base-content">{profilePct}% complete</p>
            </div>
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {errPerf && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
              exit={{ opacity:0, height:0 }}
              className="alert alert-error">
              <AlertCircle size={16} />
              <span>{errPerf}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? <LoadingSkeleton /> : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

            {/* KPI Grid */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {kpiCards.map(({ icon, label, value, sub, bg, color }) => (
                <StatCard key={label} icon={icon} label={label} value={value} sub={sub}
                  iconBg={bg} iconColor={color} />
              ))}
            </motion.div>

            {/* Earnings + Rating */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <motion.div variants={fadeUp} className="lg:col-span-2 card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display font-bold text-base text-base-content">Earnings Trend</h2>
                    <p className="text-xs text-base-content/40 font-mono mt-0.5">8-week overview</p>
                  </div>
                  <span className="badge badge-primary badge-sm flex items-center gap-1">
                    <TrendingUp size={10} />{fmt.inr(totalEarnings)} lifetime
                  </span>
                </div>
                <EarningsChart totalEarnings={totalEarnings} />
              </motion.div>

              <motion.div variants={fadeUp} className="card p-5 flex flex-col items-center gap-5 justify-center">
                <div className="text-center w-full">
                  <h2 className="font-display font-bold text-sm text-base-content mb-3">Rating</h2>
                  <RatingOrb rating={avgRating} count={ratingCount} />
                </div>
                <div className="divider !my-0 w-full" />
                <div className="text-center w-full">
                  <h2 className="font-display font-bold text-sm text-base-content mb-3">Cancellation</h2>
                  <CancelGauge rate={cancelRate} />
                </div>
              </motion.div>
            </div>

            {/* Tier + Coins */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div variants={fadeUp} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-sm text-base-content">Driver Tier</h2>
                  <div className="flex items-center gap-1 text-xs text-base-content/40">
                    <Trophy size={12} className="text-accent" /> Rewards Level
                  </div>
                </div>
                <TierDisplay tier={tier} />
              </motion.div>

              <motion.div variants={fadeUp} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-sm text-base-content">Coin Wallet</h2>
                  <span className="text-[10px] text-base-content/30 font-mono">1 coin = ₹0.01</span>
                </div>
                <CoinCard balance={coinBal} earned={coinEarn} redeemed={coinUsed} />
              </motion.div>
            </div>

            {/* Breakdown */}
            <motion.div variants={fadeUp} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-sm text-base-content">Performance Breakdown</h2>
                <span className="text-[10px] text-base-content/30 font-mono uppercase tracking-wider">Lifetime</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label:"Completed",   value:fmt.num(dp.totalRidesCompleted??0), color:"var(--success)" },
                  { label:"Cancelled",   value:fmt.num(dp.totalRidesCancelled??0), color:"var(--error)"   },
                  { label:"Complaints",  value:fmt.num(dp.complaintsCount??0),     color:"var(--error)"   },
                  { label:"Compliments", value:fmt.num(dp.complimentsCount??0),    color:"var(--info)"    },
                  { label:"Warnings",    value:fmt.num(dp.warningCount??0),        color:"var(--warning)" },
                  { label:"Perf. Tier",  value:dp.performanceTier??"Bronze",       color:"var(--primary)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="stat-card !p-3">
                    <p className="stat-card-label">{label}</p>
                    <p className="stat-card-value !text-xl mt-1" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Badges */}
            <motion.div variants={fadeUp} className="card p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display font-bold text-sm text-base-content">Achievements</h2>
                  <p className="text-xs text-base-content/40 font-mono mt-0.5">
                    {badges?.length??0} badge{badges?.length!==1?"s":""} earned
                  </p>
                </div>
                {badges?.length>0 && (
                  <button className="btn btn-ghost btn-xs text-primary flex items-center gap-1">
                    View all <ChevronRight size={12} />
                  </button>
                )}
              </div>
              <BadgeGrid badges={badges} />
            </motion.div>

          </motion.div>
        )}
      </div>
    </div>
  );
}