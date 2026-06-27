"use client";

import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector }     from "react-redux";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  MapPin, Star, TrendingUp, Clock, Shield, Zap, ChevronRight,
  DollarSign, Navigation, Bell, CheckCircle, ArrowRight,
  Car, Calendar, Award, BarChart2, Users, Menu, X, Phone,
  Wallet, Route, AlertCircle, Sun, Moon, User, Wifi, WifiOff,
  Coffee, Play, RefreshCw, Lock,
} from "lucide-react";
import Link from "next/link";

// ── Redux ─────────────────────────────────────────────────────────────────────
import {
  fetchMyProfile,
  fetchDispatchStatus,
  fetchPerformance,
  fetchRewards,
  updateDispatchStatus,
  setDispatchStatusOptimistic,
  selectProfile,
  selectDispatch,
  selectPerformance,
  selectRewards,
  selectLoading,
  selectIsOnline,
  selectDispatchStatus,
  selectPartnershipStatus,
} from "@/store/slices/soloDriverSlice";

// ── Animation Variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
};

const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.09 } },
};

// ── Dispatch Status Config ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Available: {
    label: "Online",
    color: "var(--success)",
    bg:    "color-mix(in srgb, var(--success), transparent 80%)",
    icon:  Wifi,
    dot:   "status-dot-success",
  },
  "On-Break": {
    label: "On Break",
    color: "var(--warning)",
    bg:    "color-mix(in srgb, var(--warning), transparent 80%)",
    icon:  Coffee,
    dot:   "status-dot-warning",
  },
  Offline: {
    label: "Offline",
    color: "var(--error)",
    bg:    "color-mix(in srgb, var(--error), transparent 80%)",
    icon:  WifiOff,
    dot:   "status-dot-error",
  },
};

// ── Features (static — marketing copy, not data) ──────────────────────────────
const features = [
  { icon: Wallet,   title: "Instant Payouts",       desc: "Get paid within minutes of completing a trip — no waiting, no bank delays.",                                  badge: "Most Popular", color: "accent"   },
  { icon: Shield,   title: "Full Insurance Cover",  desc: "Comprehensive on-trip and off-trip protection so you and your passengers stay safe.",                          badge: "New",          color: "primary"  },
  { icon: Navigation, title: "Smart Route AI",      desc: "AI-optimised routing reduces fuel costs and finds surge zones before they disappear.",                         badge: null,           color: "secondary"},
  { icon: BarChart2,  title: "Earnings Dashboard",  desc: "Real-time analytics on trips, ratings, bonuses, and monthly comparisons.",                                      badge: null,           color: "success"  },
  { icon: Bell,       title: "Priority Dispatch",   desc: "Top-rated drivers get priority ride requests in high-demand zones.",                                            badge: null,           color: "info"     },
  { icon: Users,      title: "Driver Community",    desc: "Access forums, mentorship, and exclusive events for independent drivers.",                                       badge: null,           color: "accent"   },
];

// ── Navbar ─────────────────────────────────────────────────────────────────────
function Navbar({ dark, toggleDark }) {
  const [open, setOpen]       = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = ["Dashboard", "Earnings", "Trips", "Community", "Support"];

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "backdrop-blur-strong shadow-depth border-b border-base-300/60" : ""
      }`}
      style={{ backgroundColor: scrolled ? "color-mix(in srgb, var(--base-100) 90%, transparent)" : "transparent" }}
    >
    

    
    </motion.header>
  );
}

// ── Status Toggle Panel ────────────────────────────────────────────────────────
function StatusPanel({ dispatch: dispatchData, onStatusChange, loading }) {
  const currentStatus = dispatchData?.status || "Offline";
  const cfg           = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.Offline;
  const Icon          = cfg.icon;

  const statuses = ["Available", "On-Break", "Offline"];

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      {/* Current status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
            <Icon className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
              Current Status
            </p>
            <p className="font-montserrat font-bold text-sm" style={{ color: cfg.color }}>
              {cfg.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ backgroundColor: cfg.bg }}>
          <span className={`status-dot ${cfg.dot} ${currentStatus === "Available" ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      {/* Status buttons */}
      <div className="grid grid-cols-3 gap-2">
        {statuses.map((s) => {
          const c    = STATUS_CONFIG[s];
          const SIcon = c.icon;
          const active = currentStatus === s;
          return (
            <button
              key={s}
              onClick={() => !active && !loading && onStatusChange(s)}
              disabled={loading || active}
              className="flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-bold transition-all duration-200"
              style={{
                backgroundColor: active ? c.bg : "var(--base-200)",
                color:           active ? c.color : "color-mix(in oklch, var(--base-content) 55%, transparent)",
                border:          active ? `1px solid ${c.color}` : "1px solid var(--base-300)",
                opacity:         loading ? 0.6 : 1,
              }}
            >
              <SIcon className="w-4 h-4" />
              {s === "Available" ? "Online" : s === "On-Break" ? "Break" : "Offline"}
            </button>
          );
        })}
      </div>

      {/* Dispatch readiness */}
      {dispatchData && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-base-300">
          {dispatchData.isDispatchable ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>Dispatch ready — accepting rides</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5" style={{ color: "var(--warning)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--warning)" }}>
                {!dispatchData.isOnboardingComplete ? "Complete onboarding first" :
                 !dispatchData.kycVerified          ? "KYC verification needed" :
                 "Not accepting rides"}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hero Section ───────────────────────────────────────────────────────────────
function Hero({ profile, dispatchData, performance, onStatusChange, statusLoading }) {
  const ref  = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y    = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opac = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const currentStatus = dispatchData?.status || "Offline";
  const cfg           = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.Offline;

  const driverName    = profile?.displayName || profile?.legalName || profile?.user?.name || "Driver";
  const rating        = profile?.rating?.averageRating || profile?.driverProfile?.performance?.rating || 0;
  const totalRides    = profile?.stats?.totalRidesCompleted || performance?.driverPerformance?.totalRidesCompleted || 0;
  const tier          = performance?.tier || "Bronze";

  // Greeting
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ backgroundColor: "var(--base-100)" }}
    >
      {/* Background glow */}
      <motion.div style={{ y }} className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute top-[-10%] right-[-5%] w-[55vw] h-[55vw] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[5%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 200" fill="none" preserveAspectRatio="none">
          <path
            d="M0 160 Q360 80 720 140 Q1080 200 1440 100 L1440 200 L0 200 Z"
            fill="color-mix(in srgb, var(--base-200) 60%, transparent)"
          />
        </svg>
      </motion.div>

      <motion.div style={{ opacity: opac }} className="container-custom relative z-10 py-20">
        <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-center">
          {/* Left — Copy */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
            <motion.div variants={fadeUp} custom={0}>
              <span className="role-badge">
                <Zap className="w-3 h-3" />
                Solo Driver Partner
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="leading-[1.1]" style={{ color: "var(--base-content)" }}>
              Drive Smarter.{" "}
              <span className="text-gradient-primary block">Earn More.</span>
              Live Better.
            </motion.h1>

            <motion.p
              variants={fadeUp} custom={2}
              className="text-responsive-base max-w-lg"
              style={{ color: "color-mix(in oklch, var(--base-content) 70%, transparent)" }}
            >
              India's most rewarding platform for independent drivers. Instant payouts,
              AI-powered routing, and full insurance coverage — everything you need to
              build a thriving driving career on your own terms.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-3 pt-2">
              <Link href="partner/solo/dashboard" className="btn-primary-cta flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="partner/solo/rides" className="btn-secondary btn flex items-center gap-2">
                <Car className="w-4 h-4" />
                Check Rides
              </Link>
              <Link href="partner/solo/profile" className="btn-ghost btn flex items-center gap-2">
                <User className="w-4 h-4" />
                Profile
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2">
              {[
                { icon: CheckCircle, text: "No registration fee" },
                { icon: CheckCircle, text: "Flexible hours" },
                { icon: CheckCircle, text: "Instant withdrawals" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--success)" }} />
                  <span className="text-xs font-semibold" style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}>
                    {text}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right — Live Status Card */}
          <motion.div
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Main card */}
            <div className="glass-card p-6 relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                    Today's Summary
                  </p>
                  <p className="font-montserrat font-extrabold text-xl sm:text-2xl" style={{ color: "var(--base-content)" }}>
                    {greeting}, {driverName.split(" ")[0]} 👋
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: cfg.bg }}>
                  <span className={`status-dot ${cfg.dot} ${currentStatus === "Available" ? "animate-pulse" : ""}`} />
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>

              {/* Partnership status alert */}
              {profile?.partnershipStatus && profile.partnershipStatus !== "active" && (
                <div className="alert alert-warning mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--warning)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--base-content)" }}>
                    Account status: <strong className="capitalize">{profile.partnershipStatus}</strong>
                    {profile.partnershipStatus === "pending" && " — Complete onboarding to start driving"}
                    {profile.partnershipStatus === "under-review" && " — Under review by our team"}
                    {profile.partnershipStatus === "suspended" && " — Contact support"}
                  </span>
                </div>
              )}

              {/* Live earnings highlight */}
              <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--bg-gradient-primary)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Total Earnings
                </p>
                <p className="font-montserrat font-black text-3xl sm:text-4xl" style={{ color: "var(--primary-content)" }}>
                  ₹{(performance?.stats?.totalEarnings || profile?.stats?.totalEarnings || 0).toLocaleString("en-IN")}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {totalRides} rides completed · {tier} tier
                  </span>
                </div>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  {
                    label: "Trips",
                    value: totalRides.toLocaleString("en-IN"),
                    icon:  Car,
                  },
                  {
                    label: "Rating",
                    value: rating > 0 ? `${rating.toFixed(1)}★` : "N/A",
                    icon:  Star,
                  },
                  {
                    label: "Tier",
                    value: tier,
                    icon:  Award,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="stat-card flex flex-col items-center text-center py-3 gap-1">
                    <Icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    <span className="font-montserrat font-black text-base sm:text-lg" style={{ color: "var(--primary)" }}>
                      {value}
                    </span>
                    <span className="stat-card-label">{label}</span>
                  </div>
                ))}
              </div>

              {/* Status toggle panel */}
              <StatusPanel
                dispatch={dispatchData}
                onStatusChange={onStatusChange}
                loading={statusLoading}
              />

              {/* Check rides CTA */}
              <Link
                href="partner/solo/rides"
                className="mt-4 flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.01]"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--primary), transparent 88%)",
                  border:          "1px solid color-mix(in srgb, var(--primary), transparent 70%)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}>
                    <Play className="w-4 h-4" style={{ color: "var(--primary-content)" }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "var(--base-content)" }}>Check Available Rides</p>
                    <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
                      View and accept new bookings
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: "var(--primary)" }} />
              </Link>
            </div>

            {/* Floating badge — profile completion */}
            {profile?.profileCompletionPercent !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="absolute -bottom-4 -left-6 glass-card px-4 py-3 flex items-center gap-2.5 z-20"
                style={{ minWidth: "180px" }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--primary), transparent 80%)" }}>
                  <User className="w-4 h-4" style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: "var(--base-content)" }}>Profile Complete</p>
                  <p className="text-xs" style={{ color: "var(--primary)" }}>{profile.profileCompletionPercent}% done</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

// ── Stats Section — real data ──────────────────────────────────────────────────
function StatsSection({ profile, performance, rewards }) {
  const stats = [
    {
      icon:  DollarSign,
      label: "Total Earnings",
      value: `₹${(performance?.stats?.totalEarnings || profile?.stats?.totalEarnings || 0).toLocaleString("en-IN")}`,
      sub:   "lifetime",
      color: "var(--accent)",
    },
    {
      icon:  Route,
      label: "Rides Completed",
      value: (performance?.stats?.totalRidesCompleted || profile?.stats?.totalRidesCompleted || 0).toLocaleString("en-IN"),
      sub:   "total",
      color: "var(--primary)",
    },
    {
      icon:  Star,
      label: "Driver Rating",
      value: (profile?.rating?.averageRating || performance?.rating?.averageRating || 0).toFixed(2),
      sub:   `${profile?.rating?.totalRatings || 0} ratings`,
      color: "var(--secondary)",
    },
    {
      icon:  Award,
      label: "Reward Tier",
      value: performance?.tier || "Bronze",
      sub:   `${rewards?.coinBalance || 0} coins`,
      color: "var(--success)",
    },
  ];

  return (
    <section className="py-16 border-y border-base-300" style={{ backgroundColor: "var(--base-200)" }}>
      <div className="container-custom">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {stats.map(({ icon: Icon, label, value, sub, color }, i) => (
            <motion.div key={label} variants={fadeUp} custom={i} className="stat-card group">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${color}, transparent 82%)` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
              </div>
              <p className="stat-card-value" style={{ color }}>{value}</p>
              <p className="stat-card-label">{label}</p>
              {sub && (
                <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                  {sub}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Features Section ───────────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section className="py-24" style={{ backgroundColor: "var(--base-100)" }}>
      <div className="container-custom">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="text-center mb-16"
        >
          <motion.div variants={fadeUp} custom={0}>
            <span className="role-badge mb-4 inline-flex"><Zap className="w-3 h-3" /> Why Partners Choose Us</span>
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="section-heading mb-4">
            Everything a Solo Driver Needs
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="section-subheading max-w-xl mx-auto">
            Every feature built from real driver feedback — tools that save time, protect income, and make every shift count.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid-responsive"
        >
          {features.map(({ icon: Icon, title, desc, badge, color }, i) => (
            <motion.div key={title} variants={fadeUp} custom={i} className="card p-6 flex flex-col gap-4 group cursor-pointer">
              <div className="flex items-start justify-between">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `color-mix(in srgb, var(--${color}), transparent 80%)` }}
                >
                  <Icon className="w-6 h-6" style={{ color: `var(--${color})` }} />
                </div>
                {badge && (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--${color}), transparent 85%)`,
                      color:           `var(--${color})`,
                      border:          `1px solid color-mix(in srgb, var(--${color}), transparent 65%)`,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <div>
                <h5 className="font-montserrat font-extrabold mb-1.5" style={{ color: "var(--base-content)" }}>{title}</h5>
                <p className="text-sm leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}>
                  {desc}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold mt-auto transition-colors duration-200" style={{ color: `var(--${color})` }}>
                Learn more <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────────
function CTASection({ profile }) {
  const partnershipStatus = profile?.partnershipStatus;

  return (
    <section className="py-24" style={{ backgroundColor: "var(--base-200)" }}>
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden p-8 sm:p-10 md:p-16 text-center"
          style={{ background: "var(--bg-gradient-primary)" }}
        >
          <div className="absolute top-[-30%] right-[-10%] w-72 h-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />
          <div className="absolute bottom-[-20%] left-[-8%] w-56 h-56 rounded-full opacity-15" style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)" }}>
              <Zap className="w-3 h-3" />
              {partnershipStatus === "active" ? "You're Active" : "Complete Onboarding"}
            </span>
            <h2 className="font-montserrat font-black text-3xl md:text-4xl lg:text-5xl mb-4 tracking-tight" style={{ color: "var(--primary-content)" }}>
              {partnershipStatus === "active" ? "Keep Driving. Keep Earning." : "Ready to Own Your Drive?"}
            </h2>
            <p className="text-base mb-8 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.8)" }}>
              {partnershipStatus === "active"
                ? "Your account is active. Head to your dashboard to manage rides, track earnings, and update your availability."
                : "Complete your profile, submit KYC, and verify your vehicle to start accepting rides on the Likeson platform."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="partner/solo/dashboard"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ backgroundColor: "var(--primary-content)", color: "var(--primary)" }}
              >
                {partnershipStatus === "active" ? "Go to Dashboard" : "Complete Profile"}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="partner/solo/rides"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider border-2 transition-all duration-200 hover:bg-white/10 active:scale-95"
                style={{ borderColor: "rgba(255,255,255,0.5)", color: "var(--primary-content)" }}
              >
                <Car className="w-4 h-4" /> Check Rides
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    { heading: "Platform", links: ["Dashboard", "Earnings", "Trip History", "Analytics", "Payouts"] },
    { heading: "Support",  links: ["Help Center", "Safety", "Insurance", "Community", "Contact"] },
    { heading: "Company",  links: ["About Us", "Careers", "Press", "Blog", "Investors"] },
  ];

  return (
    <footer className="pt-16 pb-8 border-t border-base-300" style={{ backgroundColor: "var(--base-100)" }}>
      <div className="container-custom">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-gradient-primary)" }}>
                <Car className="w-5 h-5" style={{ color: "var(--primary-content)" }} />
              </div>
              <span className="font-montserrat font-extrabold text-lg" style={{ color: "var(--base-content)" }}>DrivePartner</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
              Empowering independent drivers with tools, income, and freedom.
            </p>
          </div>

          {cols.map(({ heading, links }) => (
            <div key={heading}>
              <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                {heading}
              </p>
              <ul className="flex flex-col gap-2.5">
                {links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm no-underline transition-colors duration-200"
                      style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "color-mix(in oklch, var(--base-content) 65%, transparent)")}
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-base-300">
          <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
            © {new Date().getFullYear()} DrivePartner. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((t) => (
              <a
                key={t}
                href="#"
                className="text-xs no-underline"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "color-mix(in oklch, var(--base-content) 50%, transparent)")}
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Access Denied wall (not registered / pending) ─────────────────────────────
function AccessDenied({ partnershipStatus, loading }) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--base-100)" }}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
          <p className="text-sm font-semibold" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
            Loading your profile…
          </p>
        </div>
      </div>
    );
  }

  const isSuspended = partnershipStatus === "suspended" || partnershipStatus === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--base-100)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 sm:p-12 max-w-md w-full text-center"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: isSuspended ? "color-mix(in srgb, var(--error), transparent 80%)" : "var(--bg-gradient-primary)" }}
        >
          <Lock className="w-8 h-8" style={{ color: isSuspended ? "var(--error)" : "var(--primary-content)" }} />
        </div>
        <h2 className="font-montserrat font-black text-2xl mb-3" style={{ color: "var(--base-content)" }}>
          {isSuspended ? "Account Restricted" : "Access Restricted"}
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}>
          {partnershipStatus === "suspended"
            ? "Your account has been suspended. Please contact support for assistance."
            : partnershipStatus === "rejected"
            ? "Your application was not approved. Please contact support to understand next steps."
            : partnershipStatus === "under-review"
            ? "Your account is currently under review by our team. You'll be notified once approved."
            : "This page is only accessible to registered Solo Driver Partners. Please complete your onboarding first."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="partner/solo/onboarding" className="btn-primary-cta flex items-center justify-center gap-2">
            Complete Onboarding <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="mailto:support@likeson.in" className="btn btn-ghost text-sm">
            Contact Support
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// ── Page Root ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [dark, setDark] = useState(false);
  const dispatch        = useDispatch();

  // Selectors
  const profile           = useSelector(selectProfile);
  const dispatchData      = useSelector(selectDispatch);
  const performance       = useSelector(selectPerformance);
  const rewards           = useSelector(selectRewards);
  const profileLoading    = useSelector(selectLoading("profile"));
  const statusLoading     = useSelector(selectLoading("updateDispatchStatus"));
  const partnershipStatus = useSelector(selectPartnershipStatus);

  // Fetch real data on mount
  useEffect(() => {
    dispatch(fetchMyProfile());
    dispatch(fetchDispatchStatus());
    dispatch(fetchPerformance());
    dispatch(fetchRewards());
  }, [dispatch]);

  // Dark mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "solodriverpartner");
    dark
      ? document.documentElement.classList.add("dark")
      : document.documentElement.classList.remove("dark");
  }, [dark]);

  // Dispatch status change
  const handleStatusChange = async (status) => {
    // Optimistic update
    dispatch(setDispatchStatusOptimistic(status));
    dispatch(updateDispatchStatus(status));
  };

  // Guard: only active partners (or under-review / pending to show limited view)
  // Suspended / rejected → hard wall
  const blockedStatuses = ["suspended", "rejected"];
  const showAccessDenied =
    !profileLoading &&
    profile !== null &&
    blockedStatuses.includes(partnershipStatus);

  // Still loading initial profile
  const isInitialLoad = profileLoading && !profile;

  if (isInitialLoad || showAccessDenied) {
    return (
      <AccessDenied
        partnershipStatus={partnershipStatus}
        loading={isInitialLoad}
      />
    );
  }

  return (
    <div data-theme="solodriverpartner">
      <Navbar dark={dark} toggleDark={() => setDark((d) => !d)} />
      <main>
        <Hero
          profile={profile}
          dispatchData={dispatchData}
          performance={performance}
          onStatusChange={handleStatusChange}
          statusLoading={statusLoading}
        />
        <StatsSection
          profile={profile}
          performance={performance}
          rewards={rewards}
        />
        <FeaturesSection />
        <CTASection profile={profile} />
      </main>
      <Footer />
    </div>
  );
}