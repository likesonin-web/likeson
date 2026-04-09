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

// ── Section definitions — all colours use CSS vars from [data-theme="care-assistant"] ──
const SECTIONS = [
  {
    id: "overview", title: "Overview",
    accentVar: "var(--primary)",
    pillBgVar: "var(--base-200)",
    gradient: "linear-gradient(135deg, var(--neutral) 0%, var(--primary) 100%)",
    icon: LayoutDashboard,
    links: [
      { name: "Dashboard",              href: "/care-assistant/dashboard",   icon: LayoutDashboard },
      { name: "Performance & Earnings", href: "/care-assistant/performance", icon: TrendingUp },
      { name: "Activity Summary",       href: "/care-assistant/stats",       icon: Activity },
    ],
  },
  {
    id: "profile", title: "My Profile",
    accentVar: "var(--secondary)",
    pillBgVar: "color-mix(in oklch, var(--secondary) 12%, var(--base-100))",
    gradient: "linear-gradient(135deg, oklch(35% 0.12 10) 0%, var(--secondary) 100%)",
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
    accentVar: "var(--primary)",
    pillBgVar: "var(--base-200)",
    gradient: "linear-gradient(135deg, var(--neutral) 0%, var(--primary) 100%)",
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
    accentVar: "color-mix(in oklch, var(--primary) 80%, var(--secondary))",
    pillBgVar: "color-mix(in oklch, var(--primary) 10%, var(--base-100))",
    gradient: "linear-gradient(135deg, oklch(30% 0.18 270) 0%, oklch(55% 0.20 285) 100%)",
    icon: Briefcase,
    links: [
      { name: "My Certifications",     href: "/care-assistant/training/certificates",     icon: Star },
      { name: "Add Certificate",       href: "/care-assistant/training/certificates/add", icon: FileText },
      { name: "Training Competencies", href: "/care-assistant/training",                  icon: Stethoscope },
    ],
  },
  {
    id: "finance", title: "Finance & Payouts",
    accentVar: "var(--accent)",
    pillBgVar: "color-mix(in oklch, var(--accent) 12%, var(--base-100))",
    gradient: "linear-gradient(135deg, oklch(40% 0.12 80) 0%, var(--accent) 100%)",
    icon: Landmark,
    links: [
      { name: "Earnings Summary", href: "/care-assistant/performance",      icon: Wallet },
      { name: "Bank Account",     href: "/care-assistant/bank",             icon: CreditCard },
      { name: "Payout Rates",     href: "/care-assistant/platform-pricing", icon: ReceiptIndianRupee },
    ],
  },
  {
    id: "kyc", title: "KYC & Identity Verification",
    accentVar: "var(--success)",
    pillBgVar: "color-mix(in oklch, var(--success) 12%, var(--base-100))",
    gradient: "linear-gradient(135deg, oklch(30% 0.14 150) 0%, var(--success) 100%)",
    icon: ShieldCheck,
    links: [
      { name: "Verification Status",  href: "/care-assistant/kyc/status",      icon: ShieldCheck },
      { name: "Submit KYC Documents", href: "/care-assistant/kyc/submit",      icon: ScanLine },
      { name: "Upload Documents",     href: "/care-assistant/upload/document", icon: FileText },
    ],
  },
  {
    id: "health", title: "Health Declaration",
    accentVar: "var(--error)",
    pillBgVar: "color-mix(in oklch, var(--error) 12%, var(--base-100))",
    gradient: "linear-gradient(135deg, oklch(35% 0.16 25) 0%, var(--error) 100%)",
    icon: HeartPulse,
    links: [
      { name: "Fitness Declaration", href: "/care-assistant/health-declaration", icon: HeartPulse },
    ],
  },
  {
    id: "settings", title: "Settings & Preferences",
    accentVar: "var(--primary)",
    pillBgVar: "var(--base-200)",
    gradient: "linear-gradient(135deg, var(--neutral) 0%, oklch(50% 0.16 295) 100%)",
    icon: Settings2,
    links: [
      { name: "Notification Preferences", href: "/care-assistant/settings/notifications", icon: Bell },
      { name: "Service Area",             href: "/care-assistant/settings/service-area",  icon: MapPin },
      { name: "Registered Devices",       href: "/care-assistant/settings",               icon: Smartphone },
    ],
  },
  {
    id: "security", title: "Account Security",
    accentVar: "var(--neutral-content)",
    pillBgVar: "var(--base-300)",
    gradient: "linear-gradient(135deg, oklch(20% 0.01 240) 0%, oklch(40% 0.04 230) 100%)",
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
    accentVar: "var(--primary)",
    pillBgVar: "var(--base-200)",
    gradient: "linear-gradient(135deg, var(--neutral) 0%, var(--secondary) 100%)",
    icon: LifeBuoy,
    links: [
      { name: "Help Centre",            href: "/care-assistant/support",        icon: LifeBuoy },
      { name: "Raise a Support Ticket", href: "/care-assistant/support/ticket", icon: MessageSquare },
    ],
  },
  {
    id: "account", title: "Sign Out",
    accentVar: "var(--error)",
    pillBgVar: "color-mix(in oklch, var(--error) 12%, var(--base-100))",
    gradient: "linear-gradient(135deg, oklch(38% 0.18 25) 0%, var(--error) 100%)",
    icon: LogOut,
    links: [
      { name: "Sign Out", href: "/care-assistant/logout", icon: LogOut },
    ],
  },
];

const QUICK_ACTIONS = [
  {
    name: "Go Online",
    href: "/care-assistant/availability",
    icon: ToggleRight,
    gradient: "linear-gradient(135deg, var(--neutral) 0%, var(--primary) 100%)",
  },
  {
    name: "Schedule",
    href: "/care-assistant/schedule",
    icon: CalendarCheck,
    gradient: "linear-gradient(135deg, oklch(35% 0.12 10) 0%, var(--secondary) 100%)",
  },
  {
    name: "Earnings",
    href: "/care-assistant/performance",
    icon: Wallet,
    gradient: "linear-gradient(135deg, oklch(40% 0.12 80) 0%, var(--accent) 100%)",
  },
  {
    name: "KYC Status",
    href: "/care-assistant/kyc/status",
    icon: ShieldCheck,
    gradient: "linear-gradient(135deg, oklch(30% 0.14 150) 0%, var(--success) 100%)",
  },
];

// ── Animation variants ─────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

// ── KYC badge ──────────────────────────────────────────────────────────────────
function KycBadge({ status }) {
  const map = {
    Verified:       { colorVar: "var(--success)", bgVar: "color-mix(in oklch, var(--success) 15%, var(--base-100))", icon: CheckCircle2, label: "Verified" },
    "Under-Review": { colorVar: "var(--warning)", bgVar: "color-mix(in oklch, var(--warning) 15%, var(--base-100))", icon: Clock3,       label: "In Review" },
    Pending:        { colorVar: "var(--base-content)", bgVar: "var(--base-300)", icon: Clock3,      label: "Pending" },
    Rejected:       { colorVar: "var(--error)",   bgVar: "color-mix(in oklch, var(--error) 15%, var(--base-100))",   icon: AlertCircle, label: "Rejected" },
  };
  const cfg = map[status] ?? map.Pending;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black"
      style={{ background: cfg.bgVar, color: cfg.colorVar }}
    >
      <Icon size={9} />{cfg.label}
    </span>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────────
function StatusDot({ isOnline }) {
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{
        background: isOnline ? "var(--primary)" : "var(--base-300)",
        boxShadow:  isOnline ? "0 0 0 3px var(--base-200)" : "none",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CareAssistantDashboard() {
  const user    = useSelector((s) => s.user?.user)    ?? null;
  const profile = useSelector((s) => s.user?.profile) ?? null;

  const displayName   = profile?.fullName                    || user?.name   || "Care Assistant";
  const displayCity   = profile?.availability?.currentCity   || profile?.address?.city || "—";
  const displayAvatar = profile?.photoUrl                    || user?.avatar || null;
  const initials      = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const perf          = profile?.performance ?? {};
  const earnings      = profile?.earnings    ?? {};
  const kycStatus     = profile?.kyc?.verificationStatus ?? "Pending";
  const isOnlineProp  = profile?.availability?.isOnline   ?? false;
  const completionPct = profile?.profileCompletionPercent ?? 0;

  const [search,     setSearch]     = useState("");
  const [expanded,   setExpanded]   = useState(null);
  const [isOnline,   setIsOnline]   = useState(isOnlineProp);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { setIsOnline(isOnlineProp); }, [isOnlineProp]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const STATS = [
    {
      label:    "Pending",
      value:    `₹${(earnings.pendingPayout ?? 0).toLocaleString("en-IN")}`,
      sub:      "Payout due",
      accentVar: "var(--accent)",
      icon:     TrendingUp,
    },
    {
      label:    "Sessions",
      value:    String(perf.totalTasksCompleted ?? 0),
      sub:      "Completed",
      accentVar: "var(--primary)",
      icon:     Activity,
    },
    {
      label:    "Rating",
      value:    `${(perf.averageRating ?? 5).toFixed(1)}★`,
      sub:      `${perf.totalRatings ?? 0} reviews`,
      accentVar: "var(--secondary)",
      icon:     Star,
    },
    {
      label:    "KYC",
      value:    kycStatus === "Verified" ? "✓ Done" : kycStatus,
      sub:      "Identity",
      accentVar: kycStatus === "Verified" ? "var(--success)" : "var(--error)",
      icon:     ShieldCheck,
    },
  ];

  const filtered = search.trim()
    ? SECTIONS.map((s) => ({
        ...s,
        links: s.links.filter((l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          s.title.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((s) => s.links.length > 0)
    : SECTIONS;

  const font = { fontFamily: "var(--font-sans, system-ui, sans-serif)" };

  return (
    <div
      data-theme="care-assistant"
      style={{
        position:  "relative",
        minHeight: "100dvh",
        background: "var(--base-100)",
        color:      "var(--base-content)",
        ...font,
      }}
    >
      {/* Top accent stripe */}
      <div
        className="h-1 w-full sticky top-0 z-50"
        style={{ background: "linear-gradient(90deg, var(--neutral), var(--primary), var(--secondary))" }}
      />

      {/* ── INLINE TOOLBAR ── */}
      <div
        className="sticky top-1 z-40 px-4 pt-3 pb-2 flex items-center gap-2"
        style={{
          background:     "color-mix(in oklch, var(--base-100) 90%, transparent)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Online pill */}
        <button
          onClick={() => setIsOnline((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all"
          style={{
            background:  isOnline ? "var(--base-200)" : "var(--base-300)",
            borderColor: isOnline ? "color-mix(in oklch, var(--primary) 45%, transparent)" : "var(--base-300)",
            color:       isOnline ? "var(--neutral)"  : "var(--base-content)",
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
          className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all"
          style={{
            borderColor: "var(--base-300)",
            background:  "color-mix(in oklch, var(--primary) 8%, var(--base-100))",
            color:       "var(--base-content)",
          }}
          aria-label="Toggle search"
        >
          {searchOpen ? <X size={15} /> : <Search size={15} />}
        </button>

        {/* Notifications */}
        <button
          className="w-9 h-9 rounded-xl border flex items-center justify-center relative"
          style={{
            borderColor: "var(--base-300)",
            background:  "var(--base-100)",
            color:       "var(--base-content)",
          }}
          aria-label="Notifications"
        >
          <Bell size={15} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
            style={{
              background:   "var(--error)",
              borderColor:  "var(--base-100)",
            }}
          />
        </button>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden pt-5 px-4 pb-3"
          >
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--primary)" }}
              />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search features…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                style={{
                  border:      "1px solid var(--base-300)",
                  background:  "var(--base-200)",
                  color:       "var(--base-content)",
                  ...font,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN SCROLL AREA ── */}
      <main className="max-w-lg mx-auto px-4 pb-28 pt-2 space-y-5">

        {/* GREETING CARD */}
        {!search && (
          <motion.div
            variants={scaleIn} initial="hidden" animate="show"
            className="relative overflow-hidden rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, var(--neutral) 0%, var(--primary) 100%)",
              color:      "var(--primary-content)",
            }}
          >
            <div
              className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10"
              style={{ background: "var(--secondary)" }}
            />
            <div
              className="absolute -bottom-6 left-8 w-20 h-20 rounded-full opacity-10"
              style={{ background: "var(--primary-content)" }}
            />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60 mb-1"
                    style={{ color: "var(--primary-content)" }}>
                    Welcome back
                  </p>
                  <p className="text-xl font-black tracking-tight leading-tight"
                    style={{ color: "var(--primary-content)" }}>
                    {displayName} 👋
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <MapPin size={10} style={{ color: "var(--primary-content)", opacity: 0.6 }} />
                    <p className="text-[11px] opacity-60" style={{ color: "var(--primary-content)" }}>{displayCity}</p>
                    {user?.role && (
                      <>
                        <span style={{ color: "var(--primary-content)", opacity: 0.3 }}>·</span>
                        <p className="text-[11px] capitalize" style={{ color: "var(--primary-content)", opacity: 0.8 }}>{user.role}</p>
                      </>
                    )}
                  </div>
                </div>

                {displayAvatar ? (
                  <img
                    src={displayAvatar} alt={displayName}
                    className="w-12 h-12 rounded-2xl object-cover flex-shrink-0"
                    style={{ border: "2px solid color-mix(in oklch, var(--primary-content) 30%, transparent)" }}
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black flex-shrink-0"
                    style={{
                      background:     "color-mix(in oklch, var(--primary-content) 20%, transparent)",
                      backdropFilter: "blur(8px)",
                      color:          "var(--primary-content)",
                    }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              {/* Profile completion bar */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[9px] font-black uppercase tracking-widest opacity-60"
                      style={{ color: "var(--primary-content)" }}
                    >
                      Profile
                    </span>
                    <span
                      className="text-[10px] font-black opacity-80"
                      style={{ color: "var(--primary-content)" }}
                    >
                      {completionPct}%
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "color-mix(in oklch, var(--primary-content) 20%, transparent)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${completionPct}%`, background: "var(--secondary)" }}
                    />
                  </div>
                </div>
                <KycBadge status={kycStatus} />
              </div>
            </div>
          </motion.div>
        )}

        {/* STATS */}
        {!search && (
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <motion.div
                key={s.label} variants={fadeUp}
                className="rounded-2xl p-3.5 flex flex-col gap-1"
                style={{
                  background: "var(--base-100)",
                  border:     `1px solid color-mix(in oklch, ${s.accentVar} 22%, transparent)`,
                  boxShadow:  `0 1px 8px color-mix(in oklch, ${s.accentVar} 8%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p
                    className="text-[9px] font-black uppercase tracking-widest opacity-60"
                    style={{ color: "var(--base-content)" }}
                  >
                    {s.label}
                  </p>
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{
                      background: `color-mix(in oklch, ${s.accentVar} 14%, transparent)`,
                      color:       s.accentVar,
                    }}
                  >
                    <s.icon size={11} />
                  </div>
                </div>
                <p className="text-lg font-black leading-none" style={{ color: s.accentVar }}>{s.value}</p>
                <p
                  className="text-[10px] font-semibold opacity-50"
                  style={{ color: "var(--base-content)" }}
                >
                  {s.sub}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* QUICK ACTIONS */}
        {!search && (
          <div>
            <p
              className="text-[9px] font-black uppercase tracking-[0.3em] mb-3 px-1 opacity-55"
              style={{ color: "var(--primary)" }}
            >
              Quick Actions
            </p>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_ACTIONS.map((qa, i) => (
                <motion.a
                  key={qa.name} href={qa.href}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }} whileTap={{ scale: 0.93 }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center"
                  style={{
                    background:  "var(--base-100)",
                    border:      "1px solid var(--base-200)",
                    textDecoration: "none",
                    ...font,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: qa.gradient }}
                  >
                    <qa.icon size={18} color="var(--primary-content)" />
                  </div>
                  <p
                    className="text-[9px] font-black uppercase tracking-tight leading-tight"
                    style={{ color: "var(--base-content)" }}
                  >
                    {qa.name}
                  </p>
                </motion.a>
              ))}
            </div>
          </div>
        )}

        {/* SECTION CARDS */}
        <div>
          {!search && (
            <p
              className="text-[9px] font-black uppercase tracking-[0.3em] mb-3 px-1 opacity-55"
              style={{ color: "var(--primary)" }}
            >
              All Features
            </p>
          )}

          {search && filtered.length === 0 && (
            <div className="text-center py-12" style={{ opacity: 0.4 }}>
              <Search size={32} className="mx-auto mb-2" style={{ color: "var(--primary)" }} />
              <p className="text-sm font-bold" style={{ color: "var(--base-content)" }}>
                No results for "{search}"
              </p>
            </div>
          )}

          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2.5">
            {filtered.map((section) => {
              const isExpanded  = expanded === section.id;
              const SectionIcon = section.icon;

              return (
                <motion.div
                  key={section.id} variants={fadeUp}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border:     isExpanded
                      ? `1px solid color-mix(in oklch, ${section.accentVar} 35%, transparent)`
                      : "1px solid var(--base-200)",
                    background: "var(--base-100)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxShadow:  isExpanded
                      ? `0 2px 16px color-mix(in oklch, ${section.accentVar} 12%, transparent)`
                      : "none",
                  }}
                >
                  {/* Section header */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : section.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all"
                    style={{
                      background: isExpanded
                        ? `color-mix(in oklch, ${section.accentVar} 8%, transparent)`
                        : "transparent",
                      border:  "none",
                      cursor:  "pointer",
                      ...font,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: section.gradient }}
                    >
                      <SectionIcon size={16} color="var(--primary-content)" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-black leading-tight"
                        style={{ color: isExpanded ? section.accentVar : "var(--neutral)" }}
                      >
                        {section.title}
                      </p>
                      <p
                        className="text-[10px] font-semibold opacity-50"
                        style={{ color: "var(--base-content)" }}
                      >
                        {section.links.length} {section.links.length === 1 ? "option" : "options"}
                      </p>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    >
                      <ChevronRight
                        size={15}
                        style={{ color: section.accentVar, opacity: isExpanded ? 1 : 0.4 }}
                      />
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
                        <div
                          className="px-3 pb-3 pt-1 flex flex-col gap-0.5"
                          style={{ borderTop: `1px solid color-mix(in oklch, ${section.accentVar} 15%, transparent)` }}
                        >
                          {section.links.map((link, idx) => {
                            const LinkIcon = link.icon;
                            return (
                              <motion.a
                                key={link.name} href={link.href}
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.045 }} whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                                style={{ background: "transparent", textDecoration: "none", ...font }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    `color-mix(in oklch, ${section.accentVar} 8%, transparent)`;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "transparent";
                                }}
                              >
                                <div
                                  className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{
                                    background: `color-mix(in oklch, ${section.accentVar} 14%, transparent)`,
                                    color:       section.accentVar,
                                  }}
                                >
                                  <LinkIcon size={13} />
                                </div>
                                <span
                                  className="flex-1 text-[12px] font-bold"
                                  style={{ color: "var(--neutral)" }}
                                >
                                  {link.name}
                                </span>
                                <ArrowUpRight
                                  size={12}
                                  style={{ color: section.accentVar, opacity: 0.45 }}
                                />
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

      {/* ── BOTTOM NAV ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 px-4 safe-bottom"
        style={{
          background:     "color-mix(in oklch, var(--base-100) 94%, transparent)",
          backdropFilter: "blur(18px)",
          borderTop:      "1px solid var(--base-200)",
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
            <a
              key={item.name} href={item.href}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all"
              style={{
                color:       item.active ? "var(--primary)" : "var(--base-content)",
                opacity:     item.active ? 1 : 0.45,
                textDecoration: "none",
                ...font,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: item.active ? "var(--base-200)" : "transparent" }}
              >
                <item.icon size={17} />
              </div>
              <span className="text-[8px] font-black uppercase tracking-tight">{item.name}</span>
              {item.active && (
                <motion.div
                  layoutId="bottom-bar"
                  className="w-4 h-0.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
              )}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}