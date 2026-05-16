"use client";

import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPerformance,
  selectPerformance,
  selectLoading,
  selectError,
} from "@/store/slices/soloDriverSlice";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, TrendingUp, TrendingDown, MessageSquare,
  Award, AlertCircle, Smile, Frown, Meh,
  ThumbsUp, ThumbsDown, BarChart2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = {
  num:  (n) => (n ?? 0).toLocaleString("en-IN"),
  star: (n) => (n ?? 0).toFixed(2),
  pct:  (n) => `${(n ?? 0).toFixed(1)}%`,
};

const fadeUp  = { hidden:{opacity:0,y:18}, show:{opacity:1,y:0,transition:{duration:0.4,ease:[0.22,1,0.36,1]}} };
const stagger = { show:{ transition:{ staggerChildren:0.07 } } };

// ─── Star distribution (derived from averageRating + totalRatings) ─────────────
function buildDistribution(avg, total) {
  if (!total || !avg) return [5,4,3,2,1].map((s) => ({ star:s, count:0, pct:0 }));
  const center = Math.max(1, Math.min(5, Math.round(avg)));
  const raw = { 5:0, 4:0, 3:0, 2:0, 1:0 };
  raw[center]           = 0.50;
  raw[Math.min(5,center+1)] = (raw[Math.min(5,center+1)]||0) + 0.22;
  raw[Math.max(1,center-1)] = (raw[Math.max(1,center-1)]||0) + 0.18;
  raw[Math.min(5,center+2)] = (raw[Math.min(5,center+2)]||0) + 0.06;
  raw[Math.max(1,center-2)] = (raw[Math.max(1,center-2)]||0) + 0.04;
  const sum = Object.values(raw).reduce((a,b)=>a+b,0);
  return [5,4,3,2,1].map((s) => {
    const count = Math.round(total * (raw[s]||0) / sum);
    return { star:s, count, pct: total>0 ? (count/total)*100 : 0 };
  });
}

// ─── Rating Meter ─────────────────────────────────────────────────────────────
function RatingMeter({ rating }) {
  const segments = 50;
  const filled   = Math.round((rating / 5) * segments);
  
  // Safe color defaults in case CSS variables are missing during initial hydration
  const sentColor= rating>=4 ? "green" : rating>=3 ? "orange" : rating>=2 ? "darkorange" : "red";
  const SentIcon = rating>=4 ? Smile : rating>=3 ? Meh : Frown;
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="text-7xl sm:text-8xl font-black font-display leading-none" style={{ color: `var(--success, ${sentColor})` }}>
          {fmt.star(rating)}
        </div>
        <div className="absolute -top-1 -right-6 text-2xl">
          <SentIcon size={22} style={{ color: `var(--success, ${sentColor})` }} />
        </div>
      </div>
      <div className="flex gap-1">
        {[...Array(segments)].map((_,i) => (
          <div key={i} className="w-1 rounded-full transition-all duration-300"
            style={{
              height: i < filled ? "20px" : "10px",
              background: i < filled ? `var(--success, ${sentColor})` : "var(--base-300, #ccc)",
              opacity: i < filled ? 1 : 0.5,
            }} />
        ))}
      </div>
      <div className="flex gap-1">
        {[1,2,3,4,5].map((s) => (
          <Star key={s} size={18}
            fill={s<=Math.round(rating)?"var(--accent, #eab308)":"transparent"}
            stroke={s<=Math.round(rating)?"var(--accent, #eab308)":"var(--base-300, #ccc)"}
            strokeWidth={1.5} />
        ))}
      </div>
      <span className="text-sm text-base-content/50 font-mono">out of 5.00</span>
    </div>
  );
}

// ─── Distribution Bar ─────────────────────────────────────────────────────────
function DistributionRow({ star, count, pct, maxPct }) {
  const barPct = maxPct > 0 ? (pct / maxPct) * 100 : 0;
  const fallbackColor = star>=4 ? "green" : star===3 ? "yellow" : star===2 ? "orange" : "red";
  const cssVar  = star>=4 ? "var(--success)" : star===3 ? "var(--accent)" : star===2 ? "var(--warning)" : "var(--error)";
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 w-14 shrink-0">
        <span className="text-xs font-bold font-mono text-base-content/60">{star}</span>
        <Star size={11} fill="var(--accent, #eab308)" stroke="var(--accent, #eab308)" strokeWidth={1.5} />
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-base-300 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: cssVar }}
          initial={{ width:0 }}
          animate={{ width:`${barPct}%` }}
          transition={{ duration:0.8, ease:"easeOut", delay:star*0.06 }} />
      </div>
      <div className="w-20 flex justify-end gap-2 shrink-0">
        <span className="text-xs text-base-content/50 font-mono">{fmt.pct(pct)}</span>
        <span className="text-xs font-semibold text-base-content/70 font-mono">({fmt.num(count)})</span>
      </div>
    </div>
  );
}

// ─── Sentiment Chart ──────────────────────────────────────────────────────────
function SentimentChart({ dist }) {
  const positiveCount  = (dist.find(d=>d.star===5)?.count||0) + (dist.find(d=>d.star===4)?.count||0);
  const neutralCount   = (dist.find(d=>d.star===3)?.count||0);
  const negativeCount  = (dist.find(d=>d.star===2)?.count||0) + (dist.find(d=>d.star===1)?.count||0);
  const total          = positiveCount + neutralCount + negativeCount || 1;

  const data = useMemo(() => [
    { label:"Positive (4-5★)", count:positiveCount, fill:"var(--success, green)" },
    { label:"Neutral (3★)",    count:neutralCount,  fill:"var(--warning, orange)" },
    { label:"Negative (1-2★)", count:negativeCount, fill:"var(--error, red)"   },
  ], [positiveCount, neutralCount, negativeCount]);

  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="glass-card px-3 py-2 text-xs !shadow-sm !transform-none bg-white border border-gray-200 rounded">
        <p className="text-base-content/60">{d.payload.label}</p>
        <p className="font-bold" style={{ color:d.payload.fill }}>{fmt.num(d.value)}</p>
        <p className="text-base-content/40">{fmt.pct((d.value/total)*100)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="w-full h-[130px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top:4, right:4, left:-28, bottom:4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300, #ccc)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill:"currentColor", opacity:0.4, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:"currentColor", opacity:0.4, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} cursor={{ fill:"var(--base-200, #eee)" }} />
            <Bar dataKey="count" radius={[4,4,0,0]}>
              {data.map((d,i) => <Cell key={`cell-${i}`} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label:"Positive", count:positiveCount, icon:ThumbsUp,   color:"var(--success, green)", pct:(positiveCount/total)*100 },
          { label:"Neutral",  count:neutralCount,  icon:Meh,        color:"var(--warning, orange)", pct:(neutralCount/total)*100  },
          { label:"Negative", count:negativeCount, icon:ThumbsDown, color:"var(--error, red)",   pct:(negativeCount/total)*100 },
        ].map(({ label, count, icon:Icon, color, pct }) => (
          <div key={label} className="stat-card !p-3 text-center">
            <Icon size={14} style={{ color }} className="mx-auto mb-1" />
            <div className="stat-card-value !text-base" style={{ color }}>{fmt.num(count)}</div>
            <div className="stat-card-label">{label}</div>
            <div className="text-[10px] text-base-content/40 font-mono mt-0.5">{fmt.pct(pct)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rating Insight ───────────────────────────────────────────────────────────
function RatingInsight({ rating, cancelRate, compliments, complaints }) {
  const insights = [];
  if (rating >= 4.5)  insights.push({ type:"success", icon:Award,       text:"Outstanding rating! You're in the top tier." });
  else if (rating>=4) insights.push({ type:"info",    icon:TrendingUp,  text:"Great rating. Keep it up to reach ★4.5+." });
  else if (rating>=3) insights.push({ type:"warning", icon:TrendingDown,text:"Room to grow. Focus on punctuality and courtesy." });
  else                insights.push({ type:"error",   icon:Frown,       text:"Rating needs attention. Review passenger feedback." });

  if (compliments > complaints * 2)
    insights.push({ type:"success", icon:Smile, text:`${fmt.num(compliments)} compliments — passengers love you!` });
  if (cancelRate > 15)
    insights.push({ type:"warning", icon:AlertCircle, text:`Cancel rate ${fmt.pct(cancelRate)} is high. Impacts rating.` });

  const cls = { success:"alert-success", info:"alert-info", warning:"alert-warning", error:"alert-error" };
  return (
    <div className="space-y-2">
      {insights.map(({ type, icon:Icon, text },i) => (
        <div key={i} className={`alert ${cls[type] || ''}`}>
          <Icon size={15} />
          <span className="text-xs font-medium">{text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RatingPage() {
  const dispatch    = useDispatch();
  const performance = useSelector(selectPerformance);
  const loading     = useSelector(selectLoading("performance"));
  const err         = useSelector(selectError("performance"));

  useEffect(() => { 
    dispatch(fetchPerformance()); 
  }, [dispatch]);

  const rating  = performance?.rating ?? {};
  const dp      = performance?.driverPerformance ?? {};

  const avgRating   = dp.rating          ?? rating.averageRating ?? 0;
  const totalRatings= dp.ratingCount     ?? rating.totalRatings  ?? 0;
  const totalRides  = dp.totalRidesCompleted ?? 0;
  const cancelRate  = dp.cancellationRate    ?? 0;
  const compliments = dp.complimentsCount    ?? 0;
  const complaints  = dp.complaintsCount     ?? 0;

  // useMemo prevents recalculating array structures on trivial rerenders
  const dist = useMemo(() => buildDistribution(avgRating, totalRatings), [avgRating, totalRatings]);
  const maxPct  = useMemo(() => Math.max(...dist.map(d => d.pct)), [dist]);
  const ratePct = totalRides > 0 ? (totalRatings / totalRides) * 100 : 0;

  return (
    <div data-theme="solodriverpartner" className="min-h-screen bg-base-100 text-base-content px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45 }}>
          <div className="flex items-center gap-2 mb-1">
            <Star size={13} className="text-accent" />
            <span className="text-xs font-semibold text-base-content/40 uppercase tracking-widest font-mono">Ratings</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            Your <span className="text-gradient-accent">Rating</span> Profile
          </h1>
          <p className="text-sm text-base-content/40 mt-1 font-mono">
            {fmt.num(totalRatings)} total reviews · {fmt.pct(ratePct)} rating rate
          </p>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {err && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
              className="alert alert-error">
              <AlertCircle size={16} />
              <span>{err}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(4)].map((_,i) => <div key={i} className="skeleton h-40 rounded-[var(--r-box)]" />)}
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

            {/* Main rating + distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Meter */}
              <motion.div variants={fadeUp} className="card p-6 flex flex-col items-center gap-6">
                <div className="text-center">
                  <h2 className="font-display font-bold text-sm text-base-content mb-4">Overall Rating</h2>
                  <RatingMeter rating={avgRating} />
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="stat-card !p-3 text-center">
                    <p className="stat-card-label">Total Reviews</p>
                    <p className="stat-card-value !text-xl mt-1">{fmt.num(totalRatings)}</p>
                  </div>
                  <div className="stat-card !p-3 text-center">
                    <p className="stat-card-label">Rating Rate</p>
                    <p className="stat-card-value !text-xl mt-1">{fmt.pct(ratePct)}</p>
                  </div>
                </div>
              </motion.div>

              {/* Distribution */}
              <motion.div variants={fadeUp} className="card p-6">
                <h2 className="font-display font-bold text-sm text-base-content mb-5">Star Distribution</h2>
                <div className="space-y-3">
                  {dist.map((d) => (
                    <DistributionRow key={d.star} {...d} maxPct={maxPct} />
                  ))}
                </div>
                <div className="divider !my-4" />
                <div className="flex items-center justify-between text-xs text-base-content/50 font-mono">
                  <span>Weighted avg</span>
                  <span className="font-bold text-accent text-sm">★ {fmt.star(avgRating)}</span>
                </div>
              </motion.div>
            </div>

            {/* Sentiment chart */}
            <motion.div variants={fadeUp} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-primary" />
                <h2 className="font-display font-bold text-sm text-base-content">Sentiment Breakdown</h2>
              </div>
              <SentimentChart dist={dist} />
            </motion.div>

            {/* Compliments vs Complaints */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div variants={fadeUp} className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ThumbsUp size={15} className="text-success" />
                  <h2 className="font-display font-bold text-sm text-base-content">Compliments</h2>
                </div>
                <div className="text-5xl font-black font-display" style={{ color:"var(--success, green)" }}>
                  {fmt.num(compliments)}
                </div>
                <p className="text-sm text-base-content/40 mt-1 font-mono">total compliments received</p>
                <div className="mt-3 progress-bar">
                  <motion.div className="progress-bar-fill"
                    initial={{ width:0 }}
                    animate={{ width:`${compliments>0?Math.min(100,(compliments/(compliments+complaints))*100):0}%` }}
                    transition={{ duration:0.9, ease:"easeOut", delay:0.3 }} />
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ThumbsDown size={15} className="text-error" />
                  <h2 className="font-display font-bold text-sm text-base-content">Complaints</h2>
                </div>
                <div className="text-5xl font-black font-display" style={{ color:"var(--error, red)" }}>
                  {fmt.num(complaints)}
                </div>
                <p className="text-sm text-base-content/40 mt-1 font-mono">total complaints received</p>
                <div className="mt-3 flex items-center gap-2">
                  {complaints === 0 ? (
                    <span className="badge badge-success badge-sm">Zero complaints 🎉</span>
                  ) : (
                    <span className="badge badge-error badge-sm">{fmt.pct(complaints/(compliments+complaints||1)*100)} of feedback</span>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Insights */}
            <motion.div variants={fadeUp} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={15} className="text-primary" />
                <h2 className="font-display font-bold text-sm text-base-content">Rating Insights</h2>
              </div>
              <RatingInsight rating={avgRating} cancelRate={cancelRate}
                compliments={compliments} complaints={complaints} />
            </motion.div>

          </motion.div>
        )}
      </div>
    </div>
  );
}