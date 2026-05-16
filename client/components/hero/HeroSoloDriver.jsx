"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  MapPin, Star, TrendingUp, Clock, Shield, Zap, ChevronRight,
  DollarSign, Navigation, Bell, CheckCircle, ArrowRight,
  Car, Calendar, Award, BarChart2, Users, Menu, X, Phone,
  Wallet, Route, AlertCircle, Sun, Moon,
  User
} from "lucide-react";
import Container from "../ui/Container";
import Link from "next/link";

/* ─── Animation Variants ──────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" }
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

/* ─── Stats ───────────────────────────────────────────────────── */
const stats = [
  { icon: DollarSign, label: "Avg. Monthly Earnings", value: "₹62,400", delta: "+18%", color: "var(--accent)" },
  { icon: Route,      label: "Trips Completed",        value: "1,284",   delta: "+24%", color: "var(--primary)" },
  { icon: Star,       label: "Driver Rating",           value: "4.91",    delta: "+0.2", color: "var(--secondary)" },
  { icon: Clock,      label: "Online Hours (Month)",    value: "186 hrs", delta: "+9%",  color: "var(--success)" },
];

/* ─── Features ────────────────────────────────────────────────── */
const features = [
  {
    icon: Wallet,
    title: "Instant Payouts",
    desc: "Get paid within minutes of completing a trip — no waiting, no bank delays.",
    badge: "Most Popular",
    color: "accent",
  },
  {
    icon: Shield,
    title: "Full Insurance Cover",
    desc: "Comprehensive on-trip and off-trip protection, so you and your passengers are always safe.",
    badge: "New",
    color: "primary",
  },
  {
    icon: Navigation,
    title: "Smart Route AI",
    desc: "AI-optimised routing reduces fuel costs and finds surge zones before they disappear.",
    badge: null,
    color: "secondary",
  },
  {
    icon: BarChart2,
    title: "Earnings Dashboard",
    desc: "Real-time analytics on trips, ratings, bonuses, and monthly comparisons.",
    badge: null,
    color: "success",
  },
  {
    icon: Bell,
    title: "Priority Dispatch",
    desc: "Top-rated drivers get priority ride requests in high-demand zones.",
    badge: null,
    color: "info",
  },
  {
    icon: Users,
    title: "Driver Community",
    desc: "Access forums, mentorship, and exclusive events for independent drivers.",
    badge: null,
    color: "accent",
  },
];

/* ─── Trips Feed ──────────────────────────────────────────────── */
const trips = [
  { from: "Banjara Hills", to: "Hitech City",    fare: "₹320", dist: "12.4 km", time: "22 min", status: "Completed" },
  { from: "Jubilee Hills", to: "Gachibowli",     fare: "₹280", dist: "9.8 km",  time: "18 min", status: "Completed" },
  { from: "Secunderabad", to: "Kukatpally",       fare: "₹410", dist: "16.2 km", time: "31 min", status: "Completed" },
  { from: "Madhapur",     to: "Airport Road",     fare: "₹560", dist: "21 km",   time: "40 min", status: "Completed" },
];

/* ─── Testimonials ────────────────────────────────────────────── */
const testimonials = [
  {
    name: "Ravi Shankar",
    city: "Hyderabad",
    text: "Since joining as a solo partner, my income jumped by 35%. The instant payout feature is a game-changer for managing daily expenses.",
    rating: 5,
    trips: "2,100+ trips",
  },
  {
    name: "Priya Mehta",
    city: "Bangalore",
    text: "The Smart Route AI genuinely saves me fuel every day. I spend less and earn more — couldn't ask for a better platform.",
    rating: 5,
    trips: "890+ trips",
  },
  {
    name: "Arjun Reddy",
    city: "Chennai",
    text: "The insurance cover gives me peace of mind. I drive confidently knowing both my car and passengers are protected.",
    rating: 5,
    trips: "1,450+ trips",
  },
];

/* ─── Navbar ──────────────────────────────────────────────────── */
function Navbar({ dark, toggleDark }) {
  const [open, setOpen] = useState(false);
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
        scrolled
          ? "backdrop-blur-strong shadow-depth border-b border-base-300/60"
          : ""
      }`}
      style={{ backgroundColor: scrolled ? "color-mix(in srgb, var(--base-100) 90%, transparent)" : "transparent" }}
    >
      <nav className="container-custom flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--bg-gradient-primary)" }}
          >
            <Car className="w-5 h-5" style={{ color: "var(--primary-content)" }} />
          </div>
          <span className="font-montserrat font-extrabold text-lg tracking-tight" style={{ color: "var(--base-content)" }}>
            DrivePartner
          </span>
        </div>

        {/* Desktop links */}
        <ul className="hide-mobile flex items-center gap-7">
          {links.map((l) => (
            <li key={l}>
              <a
                href="#"
                className="text-sm font-semibold no-underline transition-colors duration-200"
                style={{ color: "color-mix(in oklch, var(--base-content) 70%, transparent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "color-mix(in oklch, var(--base-content) 70%, transparent)")}
              >
                {l}
              </a>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDark}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200"
            style={{ backgroundColor: "var(--base-200)", color: "var(--base-content)" }}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button className="hide-mobile btn-primary-cta text-xs px-5 py-2.5">
            Go Online
          </button>
          <button
            className="show-mobile w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--base-200)", color: "var(--base-content)" }}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden border-t border-base-300"
            style={{ backgroundColor: "var(--base-100)" }}
          >
            <ul className="container-custom py-4 flex flex-col gap-3">
              {links.map((l) => (
                <li key={l}>
                  <a
                    href="#"
                    className="block py-2 text-sm font-semibold no-underline"
                    style={{ color: "var(--base-content)" }}
                    onClick={() => setOpen(false)}
                  >
                    {l}
                  </a>
                </li>
              ))}
              <li className="pt-2">
                <button className="btn-primary-cta w-full text-center">Go Online</button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/* ─── Hero Section ────────────────────────────────────────────── */
function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y    = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opac = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden  "
      style={{ backgroundColor: "var(--base-100)" }}
    >
      {/* Background radial glow */}
      <motion.div
        style={{ y }}
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute top-[-10%] right-[-5%] w-[55vw] h-[55vw] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[5%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
        {/* Road line decoration */}
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 1440 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0 160 Q360 80 720 140 Q1080 200 1440 100 L1440 200 L0 200 Z"
            fill="color-mix(in srgb, var(--base-200) 60%, transparent)"
          />
        </svg>
      </motion.div>

      <motion.div style={{ opacity: opac }} className="container-custom relative z-10 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6"
          >
            <motion.div variants={fadeUp} custom={0}>
              <span className="role-badge">
                <Zap className="w-3 h-3" />
                Solo Driver Partner
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="leading-[1.1]"
              style={{ color: "var(--base-content)" }}
            >
              Drive Smarter.{" "}
              <span className="text-gradient-primary block">Earn More.</span>
              Live Better.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-responsive-base max-w-lg"
              style={{ color: "color-mix(in oklch, var(--base-content) 70%, transparent)" }}
            >
              India's most rewarding platform for independent drivers. Instant payouts,
              AI-powered routing, and full insurance coverage — everything you need to
              build a thriving driving career on your own terms.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-3 pt-2">
              <Link href={'partner/solo/dashboard'} className="btn-primary-cta flex items-center gap-2">
                Go to Dashbaord
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href={'partner/solo/profile'} className="btn-secondary btn flex items-center gap-2">
                <User className="w-4 h-4" />
                Go to Profile
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="flex items-center gap-6 pt-2">
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
                  <p className="font-montserrat font-extrabold text-2xl" style={{ color: "var(--base-content)" }}>
                    Good Morning, Arjun 👋
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--success), transparent 80%)" }}>
                  <span className="status-dot status-dot-success animate-pulse" />
                  <span className="text-xs font-bold" style={{ color: "var(--success)" }}>Online</span>
                </div>
              </div>

              {/* Earnings highlight */}
              <div
                className="rounded-2xl p-5 mb-5"
                style={{ background: "var(--bg-gradient-primary)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Earned Today
                </p>
                <p className="font-montserrat font-black text-4xl" style={{ color: "var(--primary-content)" }}>
                  ₹2,340
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
                    +18% vs yesterday
                  </span>
                </div>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Trips", value: "7", icon: Car },
                  { label: "Hours", value: "5.2", icon: Clock },
                  { label: "Rating", value: "4.9★", icon: Star },
                ].map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="stat-card flex flex-col items-center text-center py-3 gap-1"
                  >
                    <Icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    <span className="font-montserrat font-black text-lg" style={{ color: "var(--primary)" }}>
                      {value}
                    </span>
                    <span className="stat-card-label">{label}</span>
                  </div>
                ))}
              </div>

              {/* Next trip suggestion */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: "color-mix(in srgb, var(--accent), transparent 88%)", border: "1px solid color-mix(in srgb, var(--accent), transparent 70%)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    <MapPin className="w-4 h-4" style={{ color: "var(--accent-content)" }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "var(--base-content)" }}>Surge Zone Nearby</p>
                    <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
                      Hitech City · 2.1km · 1.8× fare
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="absolute -bottom-4 -left-6 glass-card px-4 py-3 flex items-center gap-2.5 z-20"
              style={{ minWidth: "180px" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--success), transparent 80%)" }}>
                <DollarSign className="w-4 h-4" style={{ color: "var(--success)" }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--base-content)" }}>Payout Sent</p>
                <p className="text-xs" style={{ color: "var(--success)" }}>₹1,860 · 2 min ago</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/* ─── Stats Section ───────────────────────────────────────────── */
function StatsSection() {
  return (
    <section className="py-16 border-y border-base-300" style={{ backgroundColor: "var(--base-200)" }}>
      <div className="container-custom">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {stats.map(({ icon: Icon, label, value, delta, color }, i) => (
            <motion.div key={label} variants={fadeUp} custom={i} className="stat-card group">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${color}, transparent 82%)` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--success), transparent 85%)`,
                    color: "var(--success)",
                  }}
                >
                  {delta}
                </span>
              </div>
              <p className="stat-card-value" style={{ color }}>{value}</p>
              <p className="stat-card-label">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Features Section ────────────────────────────────────────── */
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
            <span className="role-badge mb-4 inline-flex">
              <Zap className="w-3 h-3" /> Why Partners Choose Us
            </span>
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="section-heading mb-4">
            Everything a Solo Driver Needs
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="section-subheading max-w-xl mx-auto">
            We built every feature from real driver feedback — tools that save time, protect income, and make every shift count.
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
            <motion.div
              key={title}
              variants={fadeUp}
              custom={i}
              className="card p-6 flex flex-col gap-4 group cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `color-mix(in srgb, var(--${color}), transparent 80%)`,
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: `var(--${color})` }} />
                </div>
                {badge && (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--${color}), transparent 85%)`,
                      color: `var(--${color})`,
                      border: `1px solid color-mix(in srgb, var(--${color}), transparent 65%)`,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <div>
                <h5 className="font-montserrat font-extrabold mb-1.5" style={{ color: "var(--base-content)" }}>
                  {title}
                </h5>
                <p className="text-sm leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}>
                  {desc}
                </p>
              </div>
              <div
                className="flex items-center gap-1 text-xs font-bold mt-auto transition-colors duration-200"
                style={{ color: `var(--${color})` }}
              >
                Learn more <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Recent Trips Section ────────────────────────────────────── */
function TripsSection() {
  return (
    <section className="py-24" style={{ backgroundColor: "var(--base-200)" }}>
      <div className="container-custom">
        <div className="flex-responsive items-start md:items-center justify-between mb-12">
          <div>
            <span className="role-badge mb-3 inline-flex">
              <Car className="w-3 h-3" /> Activity Feed
            </span>
            <h2 className="section-heading mb-2">Recent Trips</h2>
            <p className="section-subheading mb-0">Your last 4 completed rides at a glance.</p>
          </div>
          <button className="btn-secondary text-sm flex items-center gap-2 mt-4 md:mt-0 self-start">
            View All Trips <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="flex flex-col gap-4"
        >
          {trips.map(({ from, to, fare, dist, time, status }, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i}
              className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: "var(--bg-gradient-primary)" }}
                >
                  <Navigation className="w-5 h-5" style={{ color: "var(--primary-content)" }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--base-content)" }}>
                    {from} → {to}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
                    {dist} · {time}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="font-montserrat font-extrabold text-lg"
                  style={{ color: "var(--primary)" }}
                >
                  {fare}
                </span>
                <span className="badge badge-success">{status}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Earnings summary bar */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="card p-6 mt-6"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: "var(--base-content)" }}>
              Weekly Goal Progress
            </p>
            <p className="text-sm font-extrabold" style={{ color: "var(--primary)" }}>₹11,200 / ₹15,000</p>
          </div>
          <div className="progress-bar">
            <motion.div
              className="progress-bar-fill"
              initial={{ width: 0 }}
              whileInView={{ width: "74.6%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
            74.6% completed · 3 days remaining
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Testimonials ────────────────────────────────────────────── */
function TestimonialsSection() {
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
            <span className="role-badge mb-4 inline-flex">
              <Award className="w-3 h-3" /> Partner Stories
            </span>
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="section-heading">
            Trusted by 50,000+ Drivers
          </motion.h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {testimonials.map(({ name, city, text, rating, trips }, i) => (
            <motion.div
              key={name}
              variants={fadeUp}
              custom={i}
              className="glass-card p-6 flex flex-col gap-4"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-current" style={{ color: "var(--accent)" }} />
                ))}
              </div>
              <p className="text-sm leading-relaxed flex-1" style={{ color: "color-mix(in oklch, var(--base-content) 75%, transparent)" }}>
                "{text}"
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-base-300">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-montserrat font-black text-sm"
                  style={{ background: "var(--bg-gradient-primary)", color: "var(--primary-content)" }}
                >
                  {name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--base-content)" }}>{name}</p>
                  <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
                    {city} · {trips}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─── CTA Banner ──────────────────────────────────────────────── */
function CTASection() {
  return (
    <section className="py-24" style={{ backgroundColor: "var(--base-200)" }}>
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center"
          style={{ background: "var(--bg-gradient-primary)" }}
        >
          {/* Decorative circles */}
          <div className="absolute top-[-30%] right-[-10%] w-72 h-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />
          <div className="absolute bottom-[-20%] left-[-8%] w-56 h-56 rounded-full opacity-15" style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)" }}>
              <Zap className="w-3 h-3" /> Limited Onboarding Slots
            </span>
            <h2
              className="font-montserrat font-black text-3xl md:text-4xl lg:text-5xl mb-4 tracking-tight"
              style={{ color: "var(--primary-content)" }}
            >
              Ready to Own Your Drive?
            </h2>
            <p className="text-base mb-8 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.8)" }}>
              Join thousands of independent drivers who've taken control of their income.
              Sign up today and get your first week's platform fee waived.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ backgroundColor: "var(--primary-content)", color: "var(--primary)" }}
              >
                Register as Partner <ArrowRight className="w-4 h-4" />
              </button>
              <button
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider border-2 transition-all duration-200 hover:bg-white/10 active:scale-95"
                style={{ borderColor: "rgba(255,255,255,0.5)", color: "var(--primary-content)" }}
              >
                <Calendar className="w-4 h-4" /> Schedule Demo
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { heading: "Platform", links: ["Dashboard", "Earnings", "Trip History", "Analytics", "Payouts"] },
    { heading: "Support",  links: ["Help Center", "Safety", "Insurance", "Community", "Contact"] },
    { heading: "Company",  links: ["About Us", "Careers", "Press", "Blog", "Investors"] },
  ];

  return (
    <footer
      className="pt-16 pb-8 border-t border-base-300"
      style={{ backgroundColor: "var(--base-100)" }}
    >
      <div className="container-custom">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "var(--bg-gradient-primary)" }}
              >
                <Car className="w-5 h-5" style={{ color: "var(--primary-content)" }} />
              </div>
              <span className="font-montserrat font-extrabold text-lg" style={{ color: "var(--base-content)" }}>
                DrivePartner
              </span>
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

        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-base-300"
        >
          <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
            © {new Date().getFullYear()} DrivePartner. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
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

/* ─── Page Root ───────────────────────────────────────────────── */
export default function Home() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "solodriverpartner");
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <div data-theme="solodriverpartner"   >
       <Container className="">
      <main>
        <Hero />
        <StatsSection />
        <FeaturesSection />
        <TripsSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
     </Container>
    </div>
  );
}