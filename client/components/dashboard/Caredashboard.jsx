"use client";

import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, TrendingUp, Activity,
  UserRound, UserCog, MapPin, Phone, Camera,
  ToggleRight, Clock, CalendarCheck,
  Star, FileText, Stethoscope, Briefcase,
  Wallet, CreditCard, ReceiptIndianRupee, Landmark,
  ShieldCheck, ScanLine, HeartPulse,
  Bell, Smartphone, Settings2,
  KeyRound, History, AlertCircle,
  LogOut, LifeBuoy, MessageSquare,
  ChevronRight, X, Search,
  ArrowUpRight, CheckCircle2, Clock3,
} from "lucide-react";

// ── CARE-ASSISTANT THEME — raw hex fallbacks so inline styles stay valid ───────
// The wrapping element carries data-theme="care-assistant" so CSS vars from
// globals.css will override these wherever they can.
const T = {
  primary:       "#8b5cc8",   // --primary  (lavender-purple)
  primaryLight:  "#f5f1fd",   // --base-200
  primaryMid:    "#d44c75",   // --secondary (rose)
  primaryDark:   "#2c2040",   // --neutral
  secondary:     "#d44c75",   // --secondary
  secondaryLight:"#fbeaf0",
  amber:         "#c09020",   // --accent
  amberLight:    "#faeeda",   // near --base-300
  red:           "#e24b4a",
  redLight:      "#fcebeb",
  green:         "#639922",
  greenLight:    "#eaf3de",
  slate:         "#4d5a6a",
  slateLight:    "#f1eff8",
};

// ── Section definitions ────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "overview", title: "Overview",
    accent: T.primary, pillBg: T.primaryLight,
    gradient: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
    icon: LayoutDashboard,
    links: [
      { name: "Dashboard",              href: "/care-assistant/dashboard",   icon: LayoutDashboard },
      { name: "Performance & Earnings", href: "/care-assistant/performance", icon: TrendingUp },
      { name: "Activity Summary",       href: "/care-assistant/stats",       icon: Activity },
            {name:"Work Calendar", href:"/care-assistant/calendar", icon:<CalendarCheck size={18} />},
      
    ],
  },
  {
    id: "profile", title: "My Profile",
    accent: T.secondary, pillBg: T.secondaryLight,
    gradient: `linear-gradient(135deg,#791F1F,${T.secondary})`,
    icon: UserCog,
    links: [
      { name: "Profile Overview",     href: "/care-assistant/profile",                   icon: UserRound },
      { name: "Personal Information", href: "/care-assistant/profile/personal",          icon: UserCog },
      { name: "Address Details",      href: "/care-assistant/profile/address",           icon: MapPin },
      { name: "Emergency Contact",    href: "/care-assistant/profile/emergency-contact", icon: Phone },
      { name: "Profile Photo",        href: "/care-assistant/upload/photo",              icon: Camera },
    ],
  },
  {
    id: "availability", title: "Availability & Scheduling",
    accent: T.primary, pillBg: T.primaryLight,
    gradient: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
    icon: CalendarCheck,
    links: [
      { name: "Go Online / Offline", href: "/care-assistant/availability", icon: ToggleRight },
      { name: "Work Status",         href: "/care-assistant/status",       icon: Clock },
      { name: "Live Location",       href: "/care-assistant/location",     icon: MapPin },
      { name: "Weekly Schedule",     href: "/care-assistant/schedule",     icon: CalendarCheck },
    ],
  },
  {
    id: "training", title: "Training & Certifications",
    accent: "#7e4fc2", pillBg: "#ede7f8",
    gradient: `linear-gradient(135deg,#4a2a8a,#7e4fc2)`,
    icon: Briefcase,
    links: [
      { name: "My Certifications",     href: "/care-assistant/training/certificates",     icon: Star },
      { name: "Add Certificate",       href: "/care-assistant/training/certificates/add", icon: FileText },
      { name: "Training Competencies", href: "/care-assistant/training",                  icon: Stethoscope },
    ],
  },
  {
    id: "finance", title: "Finance & Payouts",
    accent: T.amber, pillBg: T.amberLight,
    gradient: `linear-gradient(135deg,#7a5210,${T.amber})`,
    icon: Landmark,
    links: [
      { name: "Earnings Summary", href: "/care-assistant/performance",      icon: Wallet },
      { name: "Bank Account",     href: "/care-assistant/bank",             icon: CreditCard },
      { name: "Payout Rates",     href: "/care-assistant/platform-pricing", icon: ReceiptIndianRupee },
    ],
  },
  {
    id: "kyc", title: "KYC & Identity Verification",
    accent: T.green, pillBg: T.greenLight,
    gradient: `linear-gradient(135deg,#27500A,${T.green})`,
    icon: ShieldCheck,
    links: [
      { name: "Verification Status",  href: "/care-assistant/kyc/status",      icon: ShieldCheck },
      { name: "Submit KYC Documents", href: "/care-assistant/kyc/submit",      icon: ScanLine },
      { name: "Upload Documents",     href: "/care-assistant/upload/document", icon: FileText },
    ],
  },
  {
    id: "health", title: "Health Declaration",
    accent: T.red, pillBg: T.redLight,
    gradient: `linear-gradient(135deg,#791F1F,${T.red})`,
    icon: HeartPulse,
    links: [
      { name: "Fitness Declaration", href: "/care-assistant/health-declaration", icon: HeartPulse },
    ],
  },
  {
    id: "settings", title: "Settings & Preferences",
    accent: T.primary, pillBg: T.primaryLight,
    gradient: `linear-gradient(135deg,${T.primaryDark},#6040a0)`,
    icon: Settings2,
    links: [
      { name: "Notification Preferences", href: "/care-assistant/settings/notifications", icon: Bell },
      { name: "Service Area",             href: "/care-assistant/settings/service-area",  icon: MapPin },
      { name: "Registered Devices",       href: "/care-assistant/settings",               icon: Smartphone },
    ],
  },
  {
    id: "security", title: "Account Security",
    accent: T.slate, pillBg: T.slateLight,
    gradient: `linear-gradient(135deg,#2c3540,${T.slate})`,
    icon: KeyRound,
    links: [
      { name: "Change Password",    href: "/care-assistant/security/change-password", icon: KeyRound },
      { name: "Active Sessions",    href: "/care-assistant/security/sessions",        icon: History },
      { name: "Email Verification", href: "/care-assistant/security/verify-email",    icon: ShieldCheck },
      { name: "Delete Account",     href: "/care-assistant/security/delete-account",  icon: AlertCircle },
    ],
  },
  {
    id: "support", title: "Help & Support",
    accent: T.primary, pillBg: T.primaryLight,
    gradient: `linear-gradient(135deg,${T.primaryDark},${T.primaryMid})`,
    icon: LifeBuoy,
    links: [
      { name: "Help Centre",            href: "/care-assistant/support",        icon: LifeBuoy },
      { name: "Raise a Support Ticket", href: "/care-assistant/support/ticket", icon: MessageSquare },
    ],
  },
  {
    id: "account", title: "Sign Out",
    accent: T.red, pillBg: T.redLight,
    gradient: `linear-gradient(135deg,#A32D2D,${T.red})`,
    icon: LogOut,
    links: [
      { name: "Sign Out", href: "/care-assistant/logout", icon: LogOut },
    ],
  },
];

const QUICK_ACTIONS = [
  { name: "Go Online",  href: "/care-assistant/availability",   icon: ToggleRight,  gradient: `linear-gradient(135deg,${T.primaryDark},${T.primary})` },
  { name: "Schedule",   href: "/care-assistant/schedule",        icon: CalendarCheck,gradient: `linear-gradient(135deg,#791F1F,${T.secondary})` },
  { name: "Earnings",   href: "/care-assistant/performance",     icon: Wallet,       gradient: `linear-gradient(135deg,#7a5210,${T.amber})` },
  { name: "KYC Status", href: "/care-assistant/kyc/status",      icon: ShieldCheck,  gradient: `linear-gradient(135deg,#27500A,${T.green})` },
];

// ── Animation variants ─────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

// ── KYC badge ──────────────────────────────────────────────────────────────────
function KycBadge({ status }) {
  const map = {
    Verified:      { color: T.green,  bg: T.greenLight, icon: CheckCircle2, label: "Verified" },
    "Under-Review":{ color: T.amber,  bg: T.amberLight, icon: Clock3,       label: "In Review" },
    Pending:       { color: T.slate,  bg: T.slateLight, icon: Clock3,       label: "Pending" },
    Rejected:      { color: T.red,    bg: T.redLight,   icon: AlertCircle,  label: "Rejected" },
  };
  const cfg = map[status] ?? map.Pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={9} />{cfg.label}
    </span>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────────
function StatusDot({ isOnline }) {
  return (
    <span className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: isOnline ? T.primary : "#94a3b8", boxShadow: isOnline ? `0 0 0 3px ${T.primaryLight}` : "none" }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// Note: no header / no footer — those live in layout.jsx.
// The root div uses position:relative to fix the framer-motion scroll-offset
// console warning ("container has a non-static position").
// fontFamily references CSS vars only — no extra font files are preloaded.
// ─────────────────────────────────────────────────────────────────────────────
export default function CareAssistantDashboard() {
  // ── Redux: User + CareAssistantProfile ─────────────────────────────────────
  // Matches User schema (user.js) and CareAssistantProfile schema (careAssistantProfile.js)
  const user    = useSelector((s) => s.user?.user)    ?? null;
  const profile = useSelector((s) => s.user?.profile) ?? null;

  // Derived from CareAssistantProfile fields
  const displayName   = profile?.fullName               || user?.name   || "Care Assistant";
  const displayCity   = profile?.availability?.currentCity || profile?.address?.city || "—";
  const displayAvatar = profile?.photoUrl               || user?.avatar || null;
  const initials      = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // CareAssistantProfile.performance (performanceSchema)
  const perf      = profile?.performance ?? {};
  // CareAssistantProfile.earnings
  const earnings  = profile?.earnings    ?? {};
  // CareAssistantProfile.kyc.verificationStatus  (kycSchema enum)
  const kycStatus = profile?.kyc?.verificationStatus ?? "Pending";
  // CareAssistantProfile.availability.isOnline
  const isOnlineProp = profile?.availability?.isOnline ?? false;
  // CareAssistantProfile.profileCompletionPercent (computed in pre-save)
  const completionPct = profile?.profileCompletionPercent ?? 0;

  // ── Local state ────────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null);
  const [isOnline, setIsOnline] = useState(isOnlineProp);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { setIsOnline(isOnlineProp); }, [isOnlineProp]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  // Stats derived from CareAssistantProfile model fields
  const STATS = [
    {
      label: "Pending",
      // earnings.pendingPayout — CareAssistantProfile.earnings.pendingPayout
      value: `₹${(earnings.pendingPayout ?? 0).toLocaleString("en-IN")}`,
      sub:   "Payout due",
      accent: T.amber,
      icon:  TrendingUp,
    },
    {
      label: "Sessions",
      // performance.totalTasksCompleted — performanceSchema.totalTasksCompleted
      value: String(perf.totalTasksCompleted ?? 0),
      sub:   "Completed",
      accent: T.primary,
      icon:  Activity,
    },
    {
      label: "Rating",
      // performance.averageRating — performanceSchema.averageRating (0-5)
      value: `${(perf.averageRating ?? 5).toFixed(1)}★`,
      sub:   `${perf.totalRatings ?? 0} reviews`,
      accent: T.secondary,
      icon:  Star,
    },
    {
      label: "KYC",
      // kyc.verificationStatus — kycSchema enum: Pending|Under-Review|Verified|Rejected
      value: kycStatus === "Verified" ? "✓ Done" : kycStatus,
      sub:   "Identity",
      accent: kycStatus === "Verified" ? T.green : T.red,
      icon:  ShieldCheck,
    },
  ];

  // Filter sections by search
  const filtered = search.trim()
    ? SECTIONS.map((s) => ({
        ...s,
        links: s.links.filter((l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          s.title.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((s) => s.links.length > 0)
    : SECTIONS;

  // ── Shared font style (avoids preload warnings — uses CSS var, not external font) ──
  const font = { fontFamily: "var(--font-sans, system-ui, sans-serif)" };

  return (
    // position:relative fixes framer-motion "non-static position" scroll warning.
    // data-theme="care-assistant" activates the CSS vars from globals.css.
    <div
      data-theme="care-assistant"
      style={{
        position:   "relative",          // ← fixes scroll-offset warning
        minHeight:  "100dvh",
        background: "var(--base-100, #fefcff)",
        color:      "var(--base-content, #2c2040)",
        ...font,
      }}
    >
      {/* Accent stripe at the very top of the page content area (no nav needed) */}
      <div className="h-1 w-full sticky top-0 z-50"
        style={{ background: `linear-gradient(90deg,${T.primaryDark},${T.primary},${T.secondary})` }} />

      {/* ── INLINE TOOLBAR (search + online toggle — replaces removed header) ── */}
      <div className="sticky top-1 z-40 px-4 pt-3 pb-2 flex items-center gap-2"
        style={{ background: "color-mix(in srgb, var(--base-100, #fefcff) 90%, transparent)", backdropFilter: "blur(16px)" }}>

        {/* Online pill */}
        <button
          onClick={() => setIsOnline((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all"
          style={{
            background:  isOnline ? T.primaryLight : "var(--base-200, #ece5f8)",
            borderColor: isOnline ? `${T.primary}55` : "#ccc",
            color:       isOnline ? T.primaryDark  : T.slate,
            ...font,
          }}
        >
          <StatusDot isOnline={isOnline} />
          {isOnline ? "Online" : "Offline"}
        </button>

        <div className="flex-1" />

        {/* Search toggle */}
        <button
          onClick={() => setSearchOpen((p) => !p)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: T.primaryLight, color: T.primaryDark }}
          aria-label="Toggle search"
        >
          {searchOpen ? <X size={15} /> : <Search size={15} />}
        </button>

        {/* Notifications */}
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center relative"
          style={{ background: T.primaryLight, color: T.primaryDark }}
          aria-label="Notifications"
        >
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
            style={{ background: T.red, borderColor: "var(--base-100, #fefcff)" }} />
        </button>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden px-4 pb-3"
          >
            <div className="relative">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.primary }} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search features…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                style={{ background: T.primaryLight, border: `1px solid ${T.primary}30`, color: T.primaryDark, ...font }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN SCROLL AREA ─────────────────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 pb-28 pt-2 space-y-5">

        {/* ── GREETING CARD ──────────────────────────────────────────────────── */}
        {!search && (
          <motion.div
            variants={scaleIn} initial="hidden" animate="show"
            className="relative overflow-hidden rounded-2xl p-5"
            style={{ background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`, color: "#fff" }}
          >
            <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10" style={{ background: T.secondary }} />
            <div className="absolute -bottom-6 left-8 w-20 h-20 rounded-full opacity-10" style={{ background: "#fff" }} />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60 mb-1">Welcome back</p>
                  <p className="text-xl font-black tracking-tight leading-tight" style={{ fontFamily: "var(--font-display, system-ui, sans-serif)" }}>
                    {displayName} 👋
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <MapPin size={10} style={{ opacity: 0.6 }} />
                    <p className="text-[11px] opacity-60">{displayCity}</p>
                    {/* user.role from User schema */}
                    {user?.role && (
                      <>
                        <span style={{ opacity: 0.3 }}>·</span>
                        <p className="text-[11px] opacity-60 capitalize">{user.role}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Avatar: photoUrl from CareAssistantProfile or avatar from User */}
                {displayAvatar ? (
                  <img src={displayAvatar} alt={displayName}
                    className="w-12 h-12 rounded-2xl object-cover flex-shrink-0"
                    style={{ border: "2px solid rgba(255,255,255,0.3)" }} />
                ) : (
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
                    {initials}
                  </div>
                )}
              </div>

              {/* Profile completion: CareAssistantProfile.profileCompletionPercent (pre-save computed) */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Profile</span>
                    <span className="text-[10px] font-black opacity-80">{completionPct}%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${completionPct}%`, background: T.secondary }} />
                  </div>
                </div>
                {/* kyc.verificationStatus from kycSchema */}
                <KycBadge status={kycStatus} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STATS ──────────────────────────────────────────────────────────── */}
        {!search && (
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <motion.div key={s.label} variants={fadeUp}
                className="rounded-2xl p-3.5 flex flex-col gap-1"
                style={{ background: "var(--base-100, #fff)", border: `1px solid ${s.accent}22`, boxShadow: `0 1px 8px ${s.accent}0a` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.slate, opacity: 0.6 }}>{s.label}</p>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${s.accent}18`, color: s.accent }}>
                    <s.icon size={11} />
                  </div>
                </div>
                <p className="text-lg font-black leading-none" style={{ color: s.accent }}>{s.value}</p>
                <p className="text-[10px] font-semibold" style={{ color: T.slate, opacity: 0.5 }}>{s.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── QUICK ACTIONS ──────────────────────────────────────────────────── */}
        {!search && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-3 px-1" style={{ color: T.primary, opacity: 0.55 }}>Quick Actions</p>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_ACTIONS.map((qa, i) => (
                <motion.a
                  key={qa.name} href={qa.href}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }} whileTap={{ scale: 0.93 }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center"
                  style={{ background: "var(--base-100, #fefcff)", border: `1px solid ${T.primaryLight}`, textDecoration: "none" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: qa.gradient }}>
                    <qa.icon size={18} color="#fff" />
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-tight leading-tight" style={{ color: T.slate }}>{qa.name}</p>
                </motion.a>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION CARDS ──────────────────────────────────────────────────── */}
        <div>
          {!search && (
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-3 px-1" style={{ color: T.primary, opacity: 0.55 }}>All Features</p>
          )}

          {search && filtered.length === 0 && (
            <div className="text-center py-12" style={{ opacity: 0.4 }}>
              <Search size={32} className="mx-auto mb-2" style={{ color: T.primary }} />
              <p className="text-sm font-bold" style={{ color: T.primaryDark }}>No results for "{search}"</p>
            </div>
          )}

          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2.5">
            {filtered.map((section) => {
              const isExpanded  = expanded === section.id;
              const SectionIcon = section.icon;

              return (
                <motion.div key={section.id} variants={fadeUp}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border:     `1px solid ${isExpanded ? section.accent + "35" : T.primaryLight}`,
                    background: "var(--base-100, #fefcff)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxShadow:  isExpanded ? `0 2px 16px ${section.accent}12` : "none",
                  }}
                >
                  {/* Section header */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : section.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all"
                    style={{ background: isExpanded ? `${section.accent}08` : "transparent", border: "none", cursor: "pointer", ...font }}
                  >
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: section.gradient }}>
                      <SectionIcon size={16} color="#fff" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black leading-tight" style={{ color: isExpanded ? section.accent : T.primaryDark }}>
                        {section.title}
                      </p>
                      <p className="text-[10px] font-semibold" style={{ color: T.slate, opacity: 0.5 }}>
                        {section.links.length} {section.links.length === 1 ? "option" : "options"}
                      </p>
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}>
                      <ChevronRight size={15} style={{ color: isExpanded ? section.accent : T.primary, opacity: isExpanded ? 1 : 0.4 }} />
                    </motion.div>
                  </button>

                  {/* Expanded links */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-1 flex flex-col gap-0.5"
                          style={{ borderTop: `1px solid ${section.accent}15` }}>
                          {section.links.map((link, idx) => {
                            const LinkIcon = link.icon;
                            return (
                              <motion.a
                                key={link.name} href={link.href}
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.045 }} whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                                style={{ background: "transparent", textDecoration: "none", ...font }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = `${section.accent}08`; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                              >
                                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{ background: `${section.accent}14`, color: section.accent }}>
                                  <LinkIcon size={13} />
                                </div>
                                <span className="flex-1 text-[12px] font-bold" style={{ color: T.primaryDark }}>{link.name}</span>
                                <ArrowUpRight size={12} style={{ color: section.accent, opacity: 0.45 }} />
                              </motion.a>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </main>

      {/* ── BOTTOM NAV ─────────────────────────────────────────────────────────
          Stays on screen but is part of this component (not the layout), as
          the bottom nav is dashboard-specific. Uses position:fixed but the
          root div is position:relative so the offset is still computable.
      ────────────────────────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 px-4 safe-bottom"
        style={{
          background:     "color-mix(in srgb, var(--base-100, #fefcff) 94%, transparent)",
          backdropFilter: "blur(18px)",
          borderTop:      `1px solid ${T.primaryLight}`,
        }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          {[
            { name: "Home",     href: "/care-assistant/dashboard",   icon: LayoutDashboard, active: true },
            { name: "Schedule", href: "/care-assistant/schedule",    icon: CalendarCheck },
            { name: "Earnings", href: "/care-assistant/performance", icon: TrendingUp },
            { name: "Profile",  href: "/care-assistant/profile",     icon: UserRound },
            { name: "Support",  href: "/care-assistant/support",     icon: LifeBuoy },
          ].map((item) => (
            <a key={item.name} href={item.href}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all"
              style={{ color: item.active ? T.primary : T.slate, opacity: item.active ? 1 : 0.45, textDecoration: "none", ...font }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: item.active ? T.primaryLight : "transparent" }}>
                <item.icon size={17} />
              </div>
              <span className="text-[8px] font-black uppercase tracking-tight">{item.name}</span>
              {item.active && (
                <motion.div layoutId="bottom-bar" className="w-4 h-0.5 rounded-full" style={{ background: T.primary }} />
              )}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}