"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  adminGetStats,
  getProfile,
  getPerformance,
  selectProfile,
  selectPerformance,
  selectEarnings,
  selectAdminStats,
  selectIsOnline,
  selectCurrentStatus,
  selectProfileCompletion,
  selectKycStatus,
} from "@/store/slices/careAssistantSlice";

import {
  HeartPulse, ShieldCheck, Star, Clock, MapPin,
  ArrowRight, CheckCircle2, Users, Stethoscope,
  CalendarCheck, Wallet, ChevronDown, Sparkles,
  Award, TrendingUp, Activity, Zap, BarChart3,
  BadgeCheck, Timer, Heart, ArrowUpRight,
  WifiOff, Wifi, UserRound, ClipboardCheck,
  ReceiptIndianRupee, BookOpen, Target,
} from "lucide-react";

// ── Selectors ─────────────────────────────────────────────────────────────────
const selectUser = (s) => s.user?.user ?? null;

// ── Variants ──────────────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] } },
});
const fadeIn = (delay = 0) => ({
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.5, delay } },
});
const stagger = (delay = 0) => ({
  hidden: {},
  show:   { transition: { staggerChildren: 0.1, delayChildren: delay } },
});

// ── Feature config (design only, no data) ────────────────────────────────────
const FEATURE_CARDS = [
  {
    icon: CalendarCheck,
    title: "Flexible Scheduling",
    desc: "Full-time, part-time, weekends-only, or on-call — you decide when you're available.",
    accent: "var(--primary)",
  },
  {
    icon: Wallet,
    title: "Weekly Bank Payouts",
    desc: "Earnings hit your account every week. Clear itemised breakdown, no surprises.",
    accent: "var(--success)",
  },
  {
    icon: ShieldCheck,
    title: "Verified & Trusted",
    desc: "KYC, police clearance, and background checks — families trust you from day one.",
    accent: "var(--secondary)",
  },
  {
    icon: Stethoscope,
    title: "Training Certifications",
    desc: "Free first-aid, patient etiquette, and specialist care courses to level up your career.",
    accent: "var(--accent)",
  },
  {
    icon: MapPin,
    title: "Local Matches",
    desc: "Bookings in your preferred service area — shorter commutes, more hours that count.",
    accent: "var(--primary)",
  },
  {
    icon: TrendingUp,
    title: "Performance Bonuses",
    desc: "Top-rated assistants unlock multiplied pay, priority assignments, and exclusive perks.",
    accent: "var(--success)",
  },
];

const STEPS = [
  { num: "01", title: "Create Account",       desc: "Sign up in minutes with your basic details and work preferences.",              icon: UserRound },
  { num: "02", title: "Verify Your Identity", desc: "Submit KYC docs and pass background verification. We move fast.",               icon: ShieldCheck },
  { num: "03", title: "Set Your Schedule",    desc: "Choose availability, preferred city, and your care specialisations.",            icon: CalendarCheck },
  { num: "04", title: "Start Earning",        desc: "Accept bookings, deliver great care, grow your rating, collect payouts.",        icon: ReceiptIndianRupee },
];

// ── Thin horizontal rule with glow ───────────────────────────────────────────
function GlowRule({ color = "var(--primary)" }) {
  return (
    <div className="w-full h-px my-0" style={{
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      opacity: 0.3,
    }} />
  );
}

// ── Organic blob background ───────────────────────────────────────────────────
function BlobBg({ style }) {
  return (
    <div aria-hidden className="absolute pointer-events-none overflow-hidden" style={style}>
      <svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <filter id="gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
        </filter>
        <g filter="url(#gooey)">
          <circle cx="300" cy="280" r="160" fill="color-mix(in srgb, var(--primary) 14%, transparent)" />
          <circle cx="420" cy="340" r="120" fill="color-mix(in srgb, var(--secondary) 10%, transparent)" />
          <circle cx="180" cy="360" r="100" fill="color-mix(in srgb, var(--accent) 10%, transparent)" />
        </g>
      </svg>
    </div>
  );
}

// ── Stat chip — driven by real adminStats or performance data ─────────────────
function LiveStatChip({ label, value, icon: Icon, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
      transition={{
        opacity: { duration: 0.45 },
        scale:   { duration: 0.45 },
        y:       { duration: 3.8, repeat: Infinity, ease: "easeInOut" },
      }}
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border backdrop-blur-sm"
      style={{
        background:  `color-mix(in srgb, ${color} 9%, var(--base-100))`,
        borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
        boxShadow:   `0 4px 18px color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 18%, var(--base-200))` }}>
        <Icon size={13} style={{ color }} />
      </div>
      <div>
        <p className="text-[12px] font-black leading-none" style={{ color: "var(--base-content)" }}>
          {value ?? "—"}
        </p>
        <p className="text-[9px] font-semibold mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
          {label}
        </p>
      </div>
    </motion.div>
  );
}

// ── Profile Hero Card — real slice data ───────────────────────────────────────
function ProfileHeroCard({ user, profile, isOnline, status, completion, kycStatus }) {
  if (!profile) return null;

  const kycState   = kycStatus?.kyc?.verificationStatus ?? "Pending";
  const statusMap  = {
    Available: { color: "var(--success)",   label: "Available" },
    "On-Task": { color: "var(--warning)",   label: "On Task" },
    "On-Break": { color: "var(--info)",     label: "On Break" },
    Offline:   { color: "var(--base-300)", label: "Offline" },
    Suspended: { color: "var(--error)",    label: "Suspended" },
  };
  const st = statusMap[status] || statusMap.Offline;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background:   "var(--base-200)",
        border:       "1px solid color-mix(in srgb, var(--primary) 18%, transparent)",
        boxShadow:    "0 20px 60px color-mix(in srgb, var(--primary) 12%, transparent)",
        borderRadius: "var(--r-box)",
        minWidth:     "260px",
        maxWidth:     "320px",
      }}
    >
      {/* Top gradient strip */}
      <div className="h-1.5 w-full" style={{
        background: "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))",
      }} />

      <div className="p-5">
        {/* Avatar + name */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-shrink-0">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/personas/svg?seed=${profile?.fullName}`}
              alt={profile?.fullName || "Care Assistant"}
              className="w-14 h-14 rounded-2xl object-cover"
              style={{ background: "var(--base-300)" }}
            />
            <span
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-[var(--base-200)]"
              style={{ background: isOnline ? "var(--success)" : "var(--base-300)" }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black truncate" style={{ color: "var(--base-content)" }}>
              {profile?.fullName || "Care Assistant"}
            </p>
            <p className="text-[10px] font-medium truncate" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
              {profile?.specializations?.length
                ? profile.specializations.slice(0, 2).join(" · ")
                : profile?.workType || "Care Professional"}
            </p>
          </div>
        </div>

        {/* Status pill + city */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{
              background: `color-mix(in srgb, ${st.color}, transparent 85%)`,
              color: st.color,
              border: `1px solid color-mix(in srgb, ${st.color}, transparent 60%)`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
            {st.label}
          </span>
          {profile?.availability?.currentCity && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
              <MapPin size={9} /> {profile.availability.currentCity}
            </span>
          )}
        </div>

        {/* KYC */}
        <div className="flex items-center justify-between mb-4 p-2.5 rounded-xl"
          style={{ background: "var(--base-100)" }}>
          <span className="text-[10px] font-semibold" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
            KYC Status
          </span>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{
              background: kycState === "Verified"
                ? "color-mix(in srgb, var(--success), transparent 82%)"
                : kycState === "Under-Review"
                ? "color-mix(in srgb, var(--warning), transparent 82%)"
                : "color-mix(in srgb, var(--base-content), transparent 88%)",
              color: kycState === "Verified"
                ? "var(--success)"
                : kycState === "Under-Review"
                ? "var(--warning)"
                : "var(--base-content)",
            }}>
            {kycState}
          </span>
        </div>

        {/* Profile completion */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
              Profile
            </span>
            <span className="text-[10px] font-black" style={{ color: "var(--primary)" }}>{completion}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: "var(--base-300)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}
              initial={{ width: 0 }}
              animate={{ width: `${completion}%` }}
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.4 }}
            />
          </div>
        </div>

        {/* CTA */}
        <Link href="/care-assistant/dashboard">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="mt-4 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-black cursor-pointer"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--secondary))",
              color: "var(--primary-content)",
            }}
          >
            Go to Dashboard <ArrowRight size={12} />
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
}

// ── Minimal guest card shown when not logged in ───────────────────────────────
function GuestCard() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background:   "var(--base-200)",
        border:       "1px solid color-mix(in srgb, var(--primary) 18%, transparent)",
        boxShadow:    "0 20px 60px color-mix(in srgb, var(--primary) 12%, transparent)",
        borderRadius: "var(--r-box)",
        minWidth:     "260px",
        maxWidth:     "320px",
      }}
    >
      <div className="h-1.5 w-full" style={{
        background: "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))",
      }} />
      <div className="p-5 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mt-2"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--base-100))" }}>
          <Heart size={28} style={{ color: "var(--primary)", fill: "color-mix(in srgb, var(--primary), transparent 50%)" }} />
        </div>
        <div>
          <p className="text-sm font-black" style={{ color: "var(--base-content)" }}>Join Our Network</p>
          <p className="text-[11px] font-medium mt-1" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
            Verified care professionals across India
          </p>
        </div>
        <div className="w-full space-y-2">
          {[
            { icon: ShieldCheck, text: "Background Verified" },
            { icon: CalendarCheck, text: "Flexible Scheduling" },
            { icon: Wallet, text: "Weekly Payouts" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: "var(--base-100)" }}>
              <item.icon size={12} style={{ color: "var(--primary)" }} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--base-content)" }}>{item.text}</span>
            </div>
          ))}
        </div>
        <Link href="/care-assistant/login" className="w-full">
          <motion.div
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-black cursor-pointer"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--secondary))",
              color: "var(--primary-content)",
            }}
          >
            Get Started <ArrowRight size={12} />
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
}

// ── Performance card — real data ──────────────────────────────────────────────
function PerformanceCard({ performance, earnings }) {
  if (!performance && !earnings) return null;

  const completionRate = (() => {
    const total = (performance?.totalTasksCompleted ?? 0) + (performance?.totalTasksCancelled ?? 0);
    return total ? Math.round(((performance?.totalTasksCompleted ?? 0) / total) * 100) : null;
  })();

  const bars = [
    { label: "On-Time",    pct: performance?.onTimeArrivalRate   ?? null, color: "var(--primary)" },
    { label: "Repeat",     pct: performance?.repeatClientRate     ?? null, color: "var(--secondary)" },
    { label: "Completion", pct: completionRate,                            color: "var(--success)" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      className="rounded-2xl p-5 border"
      style={{
        background:   "var(--base-200)",
        borderColor:  "color-mix(in srgb, var(--success) 20%, transparent)",
        borderRadius: "var(--r-box)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
          My Performance
        </p>
        {performance?.averageRating && (
          <div className="flex items-center gap-1">
            <Star size={11} style={{ color: "var(--accent)", fill: "var(--accent)" }} />
            <span className="text-xs font-black" style={{ color: "var(--accent)" }}>
              {Number(performance.averageRating).toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {earnings?.totalPaid && (
        <p className="text-2xl font-black leading-none mb-1" style={{ color: "var(--success)" }}>
          ₹{Number(earnings.totalPaid).toLocaleString("en-IN")}
        </p>
      )}
      {earnings?.totalPaid && (
        <p className="text-[9px] font-semibold mb-3" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
          Total earned lifetime
        </p>
      )}

      <div className="space-y-2.5">
        {bars.map((b) => b.pct != null && (
          <div key={b.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-semibold" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>{b.label}</span>
              <span className="text-[9px] font-black" style={{ color: b.color }}>{b.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "var(--base-300)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: b.color }}
                initial={{ width: 0 }}
                animate={{ width: `${b.pct}%` }}
                transition={{ duration: 1.1, delay: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      {performance?.totalTasksCompleted != null && (
        <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--base-300)" }}>
          <ClipboardCheck size={11} style={{ color: "var(--primary)" }} />
          <span className="text-[10px] font-bold" style={{ color: "var(--base-content)" }}>
            {performance.totalTasksCompleted.toLocaleString("en-IN")} tasks completed
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ── Platform stats row — from adminGetStats ───────────────────────────────────
function PlatformStatsRow({ adminStats }) {
  if (!adminStats) return null;

  const items = [
    { label: "Total Assistants", value: adminStats.total?.toLocaleString("en-IN"), icon: Users, color: "var(--primary)" },
    { label: "Active Now",        value: adminStats.active?.toLocaleString("en-IN"), icon: Activity, color: "var(--success)" },
    { label: "Online Now",        value: adminStats.online?.toLocaleString("en-IN"), icon: Wifi, color: "var(--secondary)" },
    { label: "KYC Verified",      value: adminStats.kyc?.verified?.toLocaleString("en-IN"), icon: BadgeCheck, color: "var(--accent)" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => item.value && (
        <motion.div
          key={item.label}
          variants={fadeUp()}
          className="p-4 rounded-2xl border text-center"
          style={{
            background:   "var(--base-100)",
            borderColor:  `color-mix(in srgb, ${item.color} 15%, transparent)`,
            borderRadius: "var(--r-box)",
          }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2"
            style={{ background: `color-mix(in srgb, ${item.color} 14%, var(--base-200))` }}>
            <item.icon size={14} style={{ color: item.color }} />
          </div>
          <p className="text-xl font-black leading-none" style={{ color: item.color }}>{item.value}</p>
          <p className="text-[9px] font-semibold mt-1 uppercase tracking-wide" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
            {item.label}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Online city breakdown ─────────────────────────────────────────────────────
function CityBreakdown({ adminStats }) {
  const cities = adminStats?.topOnlineCities ?? [];
  if (!cities.length) return null;

  const max = Math.max(...cities.map((c) => c.count), 1);

  return (
    <motion.div variants={fadeUp()} className="rounded-2xl p-5 border"
      style={{
        background:   "var(--base-200)",
        borderColor:  "color-mix(in srgb, var(--secondary) 15%, transparent)",
        borderRadius: "var(--r-box)",
      }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-4"
        style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
        Active Cities
      </p>
      <div className="space-y-2.5">
        {cities.slice(0, 6).map((c, i) => (
          <div key={c._id} className="flex items-center gap-3">
            <span className="text-[9px] font-black w-4 text-right flex-shrink-0"
              style={{ color: "color-mix(in oklch, var(--base-content) 35%, transparent)" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[11px] font-bold flex-1 min-w-0 truncate"
              style={{ color: "var(--base-content)" }}>
              {c._id || "Unknown"}
            </span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 rounded-full flex-shrink-0"
                style={{
                  width: `${Math.max((c.count / max) * 60, 12)}px`,
                  background: i === 0 ? "var(--primary)" : "color-mix(in srgb, var(--primary), transparent 50%)",
                }} />
              <span className="text-[10px] font-black flex-shrink-0" style={{ color: "var(--primary)" }}>
                {c.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Work type donut ───────────────────────────────────────────────────────────
function WorkTypeDonut({ adminStats }) {
  const breakdown = adminStats?.workTypeBreakdown ?? [];
  if (!breakdown.length) return null;

  const total = breakdown.reduce((s, b) => s + b.count, 0);
  const colors = ["var(--primary)", "var(--secondary)", "var(--accent)", "var(--success)"];

  let cumulAngle = 0;
  const slices = breakdown.map((b, i) => {
    const pct   = b.count / total;
    const start = cumulAngle;
    const end   = cumulAngle + pct * 360;
    cumulAngle  = end;
    const startR = (start * Math.PI) / 180;
    const endR   = (end   * Math.PI) / 180;
    const cx = 60, cy = 60, r = 46;
    const x1 = cx + r * Math.sin(startR), y1 = cy - r * Math.cos(startR);
    const x2 = cx + r * Math.sin(endR),   y2 = cy - r * Math.cos(endR);
    const large = pct > 0.5 ? 1 : 0;
    return { b, pct, color: colors[i % colors.length], path: `M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` };
  });

  return (
    <motion.div variants={fadeUp()} className="rounded-2xl p-5 border"
      style={{
        background:   "var(--base-200)",
        borderColor:  "color-mix(in srgb, var(--primary) 15%, transparent)",
        borderRadius: "var(--r-box)",
      }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-4"
        style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
        Work Types
      </p>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" width={80} height={80} style={{ flexShrink: 0 }}>
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} />
          ))}
          <circle cx="60" cy="60" r="28" fill="var(--base-200)" />
        </svg>
        <div className="flex-1 space-y-1.5">
          {slices.map((s) => (
            <div key={s.b._id} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-[10px] font-semibold truncate" style={{ color: "var(--base-content)" }}>
                {s.b._id || "—"}
              </span>
              <span className="text-[9px] font-black ml-auto flex-shrink-0" style={{ color: s.color }}>
                {Math.round(s.pct * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Dispatchable assistant counter ────────────────────────────────────────────
function DispatchableCounter({ adminStats }) {
  const count = adminStats?.dispatchableNow;
  if (count == null) return null;

  return (
    <motion.div
      variants={fadeUp()}
      animate={{ y: [0, -4, 0] }}
      transition={{ y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" } }}
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        background:   "linear-gradient(135deg, var(--primary), var(--secondary))",
        borderRadius: "var(--r-box)",
        boxShadow:    "0 8px 28px color-mix(in srgb, var(--primary) 35%, transparent)",
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.15)" }}>
        <Zap size={18} color="white" />
      </div>
      <div>
        <p className="text-xl font-black text-white leading-none">{count.toLocaleString("en-IN")}</p>
        <p className="text-[9px] font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
          Ready to dispatch right now
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function CareAssistantLanding() {
  const dispatch    = useDispatch();
  const containerRef = useRef(null);

  const user        = useSelector(selectUser);
  const profile     = useSelector(selectProfile);
  const performance = useSelector(selectPerformance);
  const earnings    = useSelector(selectEarnings);
  const kycStatus   = useSelector(selectKycStatus);
  const adminStats  = useSelector(selectAdminStats);
  const isOnline    = useSelector(selectIsOnline);
  const status      = useSelector(selectCurrentStatus);
  const completion  = useSelector(selectProfileCompletion);

  const isLoggedIn  = !!profile;
  const isAdmin     = user?.role === "admin" || user?.role === "superadmin";

  // Load data on mount
  useEffect(() => {
    if (user) {
      dispatch(getProfile());
      dispatch(getPerformance());
    }
    if (isAdmin) {
      dispatch(adminGetStats());
    }
  }, [dispatch, user, isAdmin]);

  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroY   = useTransform(scrollYProgress, [0, 0.3], [0, -40]);
  const blobY   = useTransform(scrollYProgress, [0, 0.4], [0, 60]);

  return (
    <div
      ref={containerRef}
      data-theme="care-assistant"
      style={{
        position:   "relative",
        background: "var(--base-100)",
        color:      "var(--base-content)",
        overflowX:  "hidden",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", minHeight: "96vh", display: "flex", alignItems: "center", padding: "5rem 1.25rem 4rem" }}>

        {/* Blob background */}
        <motion.div style={{ y: blobY }} className="absolute inset-0 pointer-events-none">
          <BlobBg style={{ top: "-10%", left: "30%", width: "70%", height: "80%", opacity: 0.85 }} />
          {/* Crosshatch texture overlay */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 29px, color-mix(in srgb, var(--base-content) 3%, transparent) 30px),
              repeating-linear-gradient(90deg, transparent, transparent 29px, color-mix(in srgb, var(--base-content) 3%, transparent) 30px)
            `,
          }} aria-hidden />
        </motion.div>

        <div className="max-w-6xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* LEFT — copy */}
            <motion.div style={{ y: heroY }}>
              {/* Pill */}
              <motion.div
                variants={fadeUp(0)} initial="hidden" animate="show"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border"
                style={{
                  background:  "color-mix(in srgb, var(--primary) 9%, var(--base-100))",
                  borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
                }}
              >
                <Heart size={10} style={{ color: "var(--primary)", fill: "var(--primary)" }} />
                <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: "var(--base-content)" }}>
                  India's Most Trusted Care Platform
                </span>
              </motion.div>

              {/* Headline — editorial italic style */}
              <motion.h1
                variants={fadeUp(0.07)} initial="hidden" animate="show"
                style={{
                  fontFamily:  "var(--font-display, Georgia, serif)",
                  fontSize:    "clamp(2.4rem, 6.5vw, 4.5rem)",
                  fontWeight:  900,
                  lineHeight:  1.05,
                  letterSpacing: "-0.02em",
                  color:       "var(--base-content)",
                  marginBottom: "1.25rem",
                }}
              >
                Heal with{" "}
                <em style={{
                  fontStyle:  "italic",
                  background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>Purpose.</em>
                <br />
                Earn with{" "}
                <em style={{
                  fontStyle:  "italic",
                  background: "linear-gradient(135deg, var(--accent), var(--secondary))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>Dignity.</em>
              </motion.h1>

              <motion.p
                variants={fadeUp(0.14)} initial="hidden" animate="show"
                style={{
                  fontSize: "clamp(0.875rem, 2vw, 1.0625rem)",
                  lineHeight: 1.7,
                  color: "color-mix(in oklch, var(--base-content) 62%, transparent)",
                  marginBottom: "2rem",
                  maxWidth: "38rem",
                }}
              >
                Join India's most trusted network of professional care assistants.
                Set your own hours, get verified, and earn weekly — while making a
                real difference in people's lives.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={fadeUp(0.2)} initial="hidden" animate="show"
                className="flex flex-col sm:flex-row gap-3 mb-7"
              >
                <Link href={isLoggedIn ? "/care-assistant/dashboard" : "/care-assistant/register"}>
                  <motion.div
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center justify-center gap-2 font-black text-sm cursor-pointer px-7 py-3.5 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                      color:      "var(--primary-content)",
                      boxShadow:  "0 8px 32px color-mix(in srgb, var(--primary) 40%, transparent)",
                      width:      "fit-content",
                    }}
                  >
                    {isLoggedIn ? "Go to Dashboard" : "Apply — It's Free"} <ArrowRight size={14} />
                  </motion.div>
                </Link>

                <Link href="/care-assistant/login">
                  <motion.div
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center justify-center gap-2 font-bold text-sm cursor-pointer px-7 py-3.5 rounded-full"
                    style={{
                      background:  "transparent",
                      border:      "1.5px solid color-mix(in srgb, var(--base-content) 20%, transparent)",
                      color:       "var(--base-content)",
                      width:       "fit-content",
                    }}
                  >
                    {isLoggedIn ? "My Account" : "Sign In"}
                  </motion.div>
                </Link>
              </motion.div>

              {/* Trust chips */}
              <motion.div
                variants={fadeUp(0.27)} initial="hidden" animate="show"
                className="flex flex-wrap gap-2"
              >
                {[
                  { icon: CheckCircle2, text: "Free to Join" },
                  { icon: ShieldCheck,  text: "Background Checked" },
                  { icon: Clock,        text: "Weekly Payouts" },
                  { icon: HeartPulse,   text: "Care Training" },
                ].map((c) => (
                  <span key={c.text}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border"
                    style={{
                      background:  "color-mix(in srgb, var(--primary) 8%, var(--base-100))",
                      borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
                      color:       "var(--base-content)",
                    }}
                  >
                    <c.icon size={10} style={{ color: "var(--primary)" }} /> {c.text}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            {/* RIGHT — live cards stack */}
            <div className="flex flex-col gap-4 items-center lg:items-end">

              {/* Profile card (logged in) or guest card */}
              {isLoggedIn
                ? <ProfileHeroCard user={user} profile={profile} isOnline={isOnline} status={status} completion={completion} kycStatus={kycStatus} />
                : <GuestCard />
              }

              {/* Performance card — only if logged in and has data */}
              {isLoggedIn && (performance || earnings) && (
                <PerformanceCard performance={performance} earnings={earnings} />
              )}

              {/* Admin dispatch counter */}
              {isAdmin && adminStats?.dispatchableNow != null && (
                <div className="w-full max-w-xs">
                  <DispatchableCounter adminStats={adminStats} />
                </div>
              )}

              {/* Floating stat chips — only shown to non-admins as platform teaser, no fake data */}
              {!isAdmin && !isLoggedIn && (
                <div className="flex flex-wrap gap-3 justify-center lg:justify-end max-w-xs">
                  {/* These chips have NO data — they're design placeholders removed: nothing shown */}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1, y: [0, 5, 0] }}
          transition={{ opacity: { delay: 1.4 }, y: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 cursor-default"
        >
          <span className="text-[8px] font-black uppercase tracking-[0.3em]"
            style={{ color: "color-mix(in oklch, var(--base-content) 30%, transparent)" }}>Scroll</span>
          <ChevronDown size={14} style={{ color: "var(--primary)", opacity: 0.4 }} />
        </motion.div>
      </section>

      <GlowRule />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — PLATFORM STATS (Admin only — real data)
      ══════════════════════════════════════════════════════════════════ */}
      {isAdmin && adminStats && (
        <>
          <section className="py-14 px-5">
            <div className="max-w-5xl mx-auto">
              <motion.div
                variants={stagger(0)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
                className="space-y-5"
              >
                <motion.div variants={fadeUp()}>
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full inline-block mb-3"
                    style={{
                      background:   "color-mix(in srgb, var(--primary) 10%, var(--base-100))",
                      color:        "var(--primary)",
                      border:       "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
                      borderRadius: "var(--r-selector)",
                    }}>
                    Platform Overview
                  </span>
                  <h2 style={{
                    fontFamily:   "var(--font-display, Georgia, serif)",
                    fontSize:     "clamp(1.6rem, 4vw, 2.8rem)",
                    fontWeight:   900,
                    letterSpacing: "-0.02em",
                    lineHeight:   1.1,
                    color:        "var(--base-content)",
                  }}>
                    Live Network <em style={{ fontStyle: "italic", color: "var(--primary)" }}>Statistics</em>
                  </h2>
                </motion.div>

                <PlatformStatsRow adminStats={adminStats} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CityBreakdown adminStats={adminStats} />
                  <WorkTypeDonut adminStats={adminStats} />
                </div>
              </motion.div>
            </div>
          </section>
          <GlowRule />
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
      ══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={stagger(0)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}
          >
            <motion.div variants={fadeUp()} className="text-center mb-12">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full inline-block mb-4"
                style={{
                  background: "color-mix(in srgb, var(--secondary) 10%, var(--base-100))",
                  color: "var(--secondary)",
                  border: "1px solid color-mix(in srgb, var(--secondary) 22%, transparent)",
                  borderRadius: "var(--r-selector)",
                }}>
                Process
              </span>
              <h2 style={{
                fontFamily:   "var(--font-display, Georgia, serif)",
                fontSize:     "clamp(1.6rem, 4vw, 2.8rem)",
                fontWeight:   900,
                letterSpacing: "-0.02em",
                lineHeight:   1.1,
                color:        "var(--base-content)",
              }}>
                From Sign-up to{" "}
                <em style={{ fontStyle: "italic", color: "var(--secondary)" }}>First Booking</em>
              </h2>
            </motion.div>

            {/* Vertical timeline on mobile, horizontal on desktop */}
            <div className="relative">
              {/* Desktop connector */}
              <div className="hidden md:block absolute top-10 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)", opacity: 0.2 }}
                aria-hidden />

              <motion.div
                variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-6"
              >
                {STEPS.map((step, i) => (
                  <motion.div key={step.num} variants={fadeUp(i * 0.06)} className="flex flex-col items-center text-center">
                    <div className="relative mb-5">
                      {/* Pulse rings */}
                      {[0, 0.7].map((d) => (
                        <motion.div key={d}
                          className="absolute inset-0 rounded-full"
                          style={{ border: "2px solid var(--primary)" }}
                          initial={{ opacity: 0.4, scale: 1 }}
                          animate={{ opacity: 0, scale: 1.6 }}
                          transition={{ duration: 2.4, repeat: Infinity, delay: d + i * 0.5, ease: "easeOut" }}
                        />
                      ))}

                      <div
                        className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center"
                        style={{
                          background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 15%, var(--base-200)), color-mix(in srgb, var(--secondary) 10%, var(--base-200)))",
                          border:     "2px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                        }}
                      >
                        <step.icon size={26} style={{ color: "var(--primary)" }} />
                      </div>

                      <span className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black z-20"
                        style={{ background: "var(--accent)", color: "var(--accent-content)" }}>
                        {i + 1}
                      </span>
                    </div>

                    <h3 className="text-[13px] font-black mb-2" style={{ color: "var(--base-content)" }}>{step.title}</h3>
                    <p className="text-[11px] font-medium leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
                      {step.desc}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <GlowRule />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — FEATURE CARDS (design text, no data)
      ══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "var(--base-200)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-12"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full inline-block mb-4"
              style={{
                background:   "color-mix(in srgb, var(--accent) 12%, var(--base-100))",
                color:        "var(--accent)",
                border:       "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                borderRadius: "var(--r-selector)",
              }}>
              Platform Benefits
            </span>
            <h2 style={{
              fontFamily:   "var(--font-display, Georgia, serif)",
              fontSize:     "clamp(1.6rem, 4vw, 2.8rem)",
              fontWeight:   900,
              letterSpacing: "-0.02em",
              lineHeight:   1.1,
              color:        "var(--base-content)",
            }}>
              Everything You Need{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>to Thrive</em>
            </h2>
          </motion.div>

          <motion.div
            variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {FEATURE_CARDS.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp(i * 0.05)}
                whileHover={{ y: -5, transition: { duration: 0.25 } }}
                className="p-5 cursor-default"
                style={{
                  background:   "var(--base-100)",
                  border:       `1px solid color-mix(in srgb, ${f.accent} 16%, transparent)`,
                  borderRadius: "var(--r-box)",
                }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: `color-mix(in srgb, ${f.accent} 12%, var(--base-200))` }}>
                  <f.icon size={20} style={{ color: f.accent }} />
                </div>
                <h3 className="text-[14px] font-black mb-2" style={{ color: "var(--base-content)" }}>{f.title}</h3>
                <p className="text-[12px] font-medium leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 58%, transparent)" }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <GlowRule />

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — CTA BAND
      ══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true, amount: 0.3 }}
            className="relative overflow-hidden text-center p-8 sm:p-12"
            style={{
              background:   "linear-gradient(140deg, var(--primary), color-mix(in srgb, var(--primary) 60%, var(--secondary)))",
              borderRadius: "var(--r-box)",
              boxShadow:    "0 24px 80px color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          >
            {/* Organic shape overlays */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
              <div className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4 rounded-full opacity-10" style={{ background: "var(--accent)" }} />
              <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full opacity-10" style={{ background: "var(--secondary)" }} />
              {/* Crosshatch */}
              <div className="absolute inset-0" style={{
                backgroundImage: `
                  repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.03) 9px),
                  repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.03) 9px)
                `,
              }} />
            </div>

            <div className="relative z-10">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
              >
                <HeartPulse size={28} color="white" />
              </motion.div>

              <h2 style={{
                fontFamily:   "var(--font-display, Georgia, serif)",
                fontSize:     "clamp(1.6rem, 4vw, 2.6rem)",
                fontWeight:   900,
                letterSpacing: "-0.02em",
                lineHeight:   1.1,
                color:        "white",
                marginBottom: "0.75rem",
              }}>
                Ready to Make a{" "}
                <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.75)" }}>Difference?</em>
              </h2>

              <p style={{
                fontSize:     "0.9375rem",
                lineHeight:   1.65,
                color:        "rgba(255,255,255,0.65)",
                marginBottom: "1.75rem",
                maxWidth:     "30rem",
                marginLeft:   "auto",
                marginRight:  "auto",
              }}>
                Professional care work that pays well, grows your skills, and helps real people
                across India. Join our network today — it's completely free to apply.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={isLoggedIn ? "/care-assistant/dashboard" : "/care-assistant/register"}>
                  <motion.div
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-full font-black text-sm cursor-pointer"
                    style={{
                      background: "white",
                      color:      "var(--primary)",
                      boxShadow:  "0 6px 24px rgba(0,0,0,0.18)",
                    }}
                  >
                    {isLoggedIn ? "Open Dashboard" : "Apply Now — It's Free"} <ArrowRight size={14} />
                  </motion.div>
                </Link>

                <Link href="/care-assistant/support">
                  <motion.div
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      color:      "white",
                      border:     "1px solid rgba(255,255,255,0.25)",
                    }}
                  >
                    Talk to Support
                  </motion.div>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}