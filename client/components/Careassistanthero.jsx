"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  HeartPulse, ShieldCheck, Star, Clock, MapPin,
  ArrowRight, CheckCircle2, Users, Stethoscope,
  CalendarCheck, Wallet, ChevronDown, Sparkles,
  Award, TrendingUp, Activity,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ALL COLOURS come directly from the CSS variables defined in globals.css under
// [data-theme="care-assistant"] and .dark [data-theme="care-assistant"].
// No hardcoded hex anywhere — dark/light mode switches automatically.
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "12,000+", label: "Active Assistants", icon: Users },
  { value: "4.9★",    label: "Average Rating",    icon: Star },
  { value: "₹18K",    label: "Avg. Monthly Earn", icon: Wallet },
  { value: "98%",     label: "Verification Rate", icon: ShieldCheck },
];

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Flexible Scheduling",
    desc: "Set your own hours — full-time, part-time, weekends-only, or on-call. You decide when you work.",
    varBg: "color-mix(in srgb, var(--primary) 10%, var(--base-100))",
    varColor: "var(--primary)",
  },
  {
    icon: Wallet,
    title: "Transparent Payouts",
    desc: "Weekly direct bank transfers. See every rupee you earn with a clear, itemised payout breakdown.",
    varBg: "color-mix(in srgb, var(--accent) 12%, var(--base-100))",
    varColor: "var(--accent)",
  },
  {
    icon: ShieldCheck,
    title: "Verified & Trusted",
    desc: "KYC, police verification, and background checks — so families trust you from day one.",
    varBg: "color-mix(in srgb, var(--secondary) 10%, var(--base-100))",
    varColor: "var(--secondary)",
  },
  {
    icon: Stethoscope,
    title: "Training Support",
    desc: "Free access to first-aid, patient etiquette, and specialised care training certifications.",
    varBg: "color-mix(in srgb, var(--success) 10%, var(--base-100))",
    varColor: "var(--success)",
  },
  {
    icon: MapPin,
    title: "Local Opportunities",
    desc: "Get matched with patients in your preferred service area — no long commutes required.",
    varBg: "color-mix(in srgb, var(--primary) 10%, var(--base-100))",
    varColor: "var(--primary)",
  },
  {
    icon: TrendingUp,
    title: "Performance Rewards",
    desc: "High ratings unlock bonus pay, priority matching, and exclusive certification opportunities.",
    varBg: "color-mix(in srgb, var(--accent) 12%, var(--base-100))",
    varColor: "var(--accent)",
  },
];

const TESTIMONIALS = [
  {
    name: "Lakshmi Devi",
    city: "Vijayawada",
    rating: 5,
    text: "I started as a part-time assistant and within 3 months I was earning more than my previous full-time job. The app makes everything simple.",
    avatar: "LD",
    varColor: "var(--primary)",
  },
  {
    name: "Ravi Kumar",
    city: "Hyderabad",
    rating: 5,
    text: "The training modules helped me get certified in dementia care. Now I get premium bookings and my rating is 4.9. Highly recommend joining.",
    avatar: "RK",
    varColor: "var(--secondary)",
  },
  {
    name: "Sunita Rao",
    city: "Guntur",
    rating: 5,
    text: "Payouts are always on time, every week. The KYC process was straightforward and the support team was very helpful throughout.",
    avatar: "SR",
    varColor: "var(--success)",
  },
];

const STEPS = [
  { num: "01", title: "Create Your Account",   desc: "Sign up in minutes. Enter your basic details and set your work preferences.", icon: HeartPulse },
  { num: "02", title: "Complete Verification", desc: "Submit KYC documents and pass the background check — we verify you fast.",    icon: ShieldCheck },
  { num: "03", title: "Set Your Schedule",     desc: "Choose your availability, service area, and specialisations.",                icon: CalendarCheck },
  { num: "04", title: "Start Earning",         desc: "Get matched with patients, deliver excellent care, and grow your rating.",     icon: Award },
];

const EARNINGS_TABLE = [
  { label: "Base hourly rate",       value: "₹85 – ₹140/hr" },
  { label: "Weekend/holiday bonus",  value: "+15%" },
  { label: "High-rating multiplier", value: "Up to +20%" },
  { label: "Referral bonus",         value: "₹500 per referral" },
];

const EARNINGS_PROGRESS = [
  { label: "Sessions completed", val: "47",   pct: 100 },
  { label: "Avg. rating",        val: "4.9★", pct: 98 },
  { label: "On-time arrival",    val: "96%",  pct: 96 },
];

// ── Animation helpers ──────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } },
});
const stagger = (delay = 0) => ({
  hidden: {},
  show:   { transition: { staggerChildren: 0.09, delayChildren: delay } },
});

// ── FloatingBadge ──────────────────────────────────────────────────────────────
function FloatingBadge({ icon: Icon, label, value, varAccent, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
      transition={{
        opacity: { duration: 0.5, ease: "easeOut" },
        scale:   { duration: 0.5, ease: "easeOut" },
        y:       { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
      }}
      className="absolute hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl border"
      style={{
        background:   `color-mix(in srgb, ${varAccent} 10%, var(--base-100))`,
        borderColor:  `color-mix(in srgb, ${varAccent} 30%, transparent)`,
        boxShadow:    `0 4px 20px color-mix(in srgb, ${varAccent} 18%, transparent)`,
        fontFamily:   "var(--font-sans, system-ui, sans-serif)",
        zIndex: 10,
        ...style,
      }}
    >
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: varAccent }}
      >
        <Icon size={13} color="var(--primary-content)" />
      </div>
      <div>
        <p className="text-[11px] font-black leading-none" style={{ color: "var(--base-content)" }}>{value}</p>
        <p className="text-[9px] font-semibold mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>{label}</p>
      </div>
    </motion.div>
  );
}

// ── PulseRing ──────────────────────────────────────────────────────────────────
function PulseRing({ delay = 0 }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{ border: "2px solid var(--primary)" }}
      initial={{ opacity: 0.5, scale: 1 }}
      animate={{ opacity: 0, scale: 1.55 }}
      transition={{ duration: 2.2, repeat: Infinity, delay, ease: "easeOut" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function CareAssistantHero() {
  const containerRef = useRef(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroY   = useTransform(scrollYProgress, [0, 0.3], [0, -50]);
  const heroBgY = useTransform(scrollYProgress, [0, 0.3], [0,  35]);

  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial((p) => (p + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      ref={containerRef}
      data-theme="care-assistant"
      style={{
        position:   "relative",
        background: "var(--base-100)",
        color:      "var(--base-content)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        overflowX:  "hidden",
      }}
    >

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "92vh", paddingTop: "4rem", paddingBottom: "5rem", paddingLeft: "1.25rem", paddingRight: "1.25rem" }}
      >
        {/* Background radials */}
        <motion.div style={{ y: heroBgY }} className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 55% at 50% -5%, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 70%),
                radial-gradient(ellipse 50% 35% at 85% 55%, color-mix(in srgb, var(--secondary) 6%, transparent) 0%, transparent 60%),
                radial-gradient(ellipse 40% 30% at 10% 80%, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 60%)
              `,
            }}
          />
          {/* Dot grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--base-content) 8%, transparent) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
        </motion.div>

        {/* Floating badges — hidden on mobile, visible sm+ */}
        <FloatingBadge icon={Star}        label="Avg Rating"  value="4.9★"  varAccent="var(--accent)"    style={{ top: "18%",    left: "2%" }} />
        <FloatingBadge icon={Users}       label="Assistants"  value="12K+"  varAccent="var(--primary)"   style={{ top: "12%",    right: "3%" }} />
        <FloatingBadge icon={Wallet}      label="Avg Monthly" value="₹18K"  varAccent="var(--secondary)" style={{ bottom: "22%", left: "1.5%" }} />
        <FloatingBadge icon={ShieldCheck} label="Verified"    value="98%"   varAccent="var(--success)"   style={{ bottom: "18%", right: "2%" }} />

        {/* Central content */}
        <motion.div style={{ y: heroY }} className="relative z-10 text-center w-full max-w-2xl mx-auto">

          {/* Pill badge */}
          <motion.div
            variants={fadeUp(0)} initial="hidden" animate="show"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5 border"
            style={{
              background:  "color-mix(in srgb, var(--primary) 10%, var(--base-100))",
              borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          >
            <Sparkles size={11} style={{ color: "var(--primary)" }} />
            <span
              className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest"
              style={{ color: "var(--base-content)" }}
            >
              India's Most Trusted Care Platform
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp(0.08)} initial="hidden" animate="show"
            className="font-black leading-[1.08] tracking-tight mb-4"
            style={{
              fontSize: "clamp(2rem, 7vw, 4rem)",
              color: "var(--base-content)",
              fontFamily: "var(--font-display, system-ui, sans-serif)",
            }}
          >
            Care for Others.
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Build Your Future.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={fadeUp(0.15)} initial="hidden" animate="show"
            className="font-medium leading-relaxed mb-7 mx-auto"
            style={{
              fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
              color: "color-mix(in oklch, var(--base-content) 65%, transparent)",
              maxWidth: "36rem",
            }}
          >
            Join thousands of professional care assistants across India. Flexible work, weekly payouts,
            and the training to grow a career you're proud of.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp(0.22)} initial="hidden" animate="show"
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-7"
          >
            <a
              href="/care-assistant/register"
              className="flex items-center justify-center gap-2 font-black uppercase tracking-wide transition-all hover:scale-[1.03] active:scale-95 w-full sm:w-auto"
              style={{
                background:    "linear-gradient(135deg, var(--neutral), var(--primary))",
                color:         "var(--primary-content)",
                borderRadius:  "var(--r-field, 1rem)",
                padding:       "0.875rem 1.75rem",
                fontSize:      "0.8125rem",
                textDecoration:"none",
                boxShadow:     "0 6px 28px color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
            >
              Apply as Care Assistant <ArrowRight size={15} />
            </a>
            <a
              href="/care-assistant/login"
              className="flex items-center justify-center gap-2 font-black transition-all hover:opacity-75 w-full sm:w-auto"
              style={{
                background:    "transparent",
                border:        "1.5px solid color-mix(in srgb, var(--primary) 45%, transparent)",
                color:         "var(--base-content)",
                borderRadius:  "var(--r-field, 1rem)",
                padding:       "0.875rem 1.75rem",
                fontSize:      "0.8125rem",
                textDecoration:"none",
              }}
            >
              Sign In to Dashboard
            </a>
          </motion.div>

          {/* Trust chips */}
          <motion.div
            variants={fadeUp(0.3)} initial="hidden" animate="show"
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {[
              { icon: CheckCircle2, label: "Free to Join" },
              { icon: ShieldCheck,  label: "Background Verified" },
              { icon: Clock,        label: "Weekly Payouts" },
              { icon: Activity,     label: "24/7 Support" },
            ].map((chip) => (
              <span key={chip.label} className="badge badge-primary inline-flex items-center gap-1.5">
                <chip.icon size={10} />
                {chip.label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{ opacity: { delay: 1.2 }, y: { duration: 2, repeat: Infinity } }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        >
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: "color-mix(in oklch, var(--base-content) 35%, transparent)" }}
          >Scroll</span>
          <ChevronDown size={15} style={{ color: "var(--primary)", opacity: 0.45 }} />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          STATS BAND
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        className="py-10 px-5"
        style={{ background: "linear-gradient(135deg, var(--neutral), var(--primary))" }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={stagger(0)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8"
          >
            {STATS.map((s) => (
              <motion.div key={s.label} variants={fadeUp()} className="text-center">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <s.icon size={18} color="var(--primary-content)" />
                </div>
                <p className="font-black leading-none text-white" style={{ fontSize: "clamp(1.5rem, 5vw, 2rem)" }}>{s.value}</p>
                <p className="text-[11px] font-semibold mt-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-12"
          >
            <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full mb-4 badge badge-primary">
              Simple Process
            </span>
            <h2
              className="font-black leading-tight"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                color: "var(--base-content)",
                fontFamily: "var(--font-display, system-ui, sans-serif)",
              }}
            >
              From Sign-up to{" "}
              <span style={{ color: "var(--primary)" }}>First Booking</span>
            </h2>
          </motion.div>

          {/* Mobile: vertical stack, md: horizontal grid */}
          <div className="relative">
            {/* Connector line — desktop only */}
            <div
              className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px"
              style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
              aria-hidden="true"
            />

            <motion.div
              variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-6"
            >
              {STEPS.map((step, i) => (
                <motion.div key={step.num} variants={fadeUp(i * 0.07)} className="flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <div
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center relative z-10"
                      style={{
                        width: "4.5rem",
                        height: "4.5rem",
                        background: "linear-gradient(135deg, var(--neutral), var(--primary))",
                        boxShadow: "0 8px 28px color-mix(in srgb, var(--primary) 35%, transparent)",
                      }}
                    >
                      <step.icon size={24} color="var(--primary-content)" />
                    </div>
                    <PulseRing delay={i * 0.6} />
                    <span
                      className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black z-20"
                      style={{ background: "var(--accent)", color: "var(--accent-content)" }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-[13px] sm:text-[14px] font-black mb-2" style={{ color: "var(--base-content)" }}>{step.title}</h3>
                  <p className="text-[12px] font-medium leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>{step.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURES GRID
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="py-16 sm:py-20 px-4 sm:px-6"
        style={{ background: "var(--base-200)" }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
            className="text-center mb-12"
          >
            <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full mb-4 badge badge-primary">
              Why Choose Us
            </span>
            <h2
              className="font-black leading-tight"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                color: "var(--base-content)",
                fontFamily: "var(--font-display, system-ui, sans-serif)",
              }}
            >
              Everything You Need{" "}
              <span style={{ color: "var(--primary)" }}>to Succeed</span>
            </h2>
          </motion.div>

          <motion.div
            variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp(i * 0.05)}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className="card rounded-2xl p-5 sm:p-6 cursor-default"
                style={{
                  background:  "var(--base-100)",
                  border:      `1px solid color-mix(in srgb, ${f.varColor} 18%, transparent)`,
                  boxShadow:   `0 2px 16px color-mix(in srgb, ${f.varColor} 8%, transparent)`,
                  borderRadius: "var(--r-box)",
                }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: f.varBg }}
                >
                  <f.icon size={20} style={{ color: f.varColor }} />
                </div>
                <h3 className="text-[14px] font-black mb-2" style={{ color: "var(--base-content)" }}>{f.title}</h3>
                <p className="text-[12px] font-medium leading-relaxed" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          EARNINGS SPOTLIGHT
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="earnings" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">

            {/* Left — table */}
            <motion.div
              variants={stagger(0)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}
            >
              <motion.div variants={fadeUp()}>
                <span
                  className="inline-block text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full mb-5"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 15%, var(--base-100))",
                    color:      "var(--accent)",
                    border:     "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                    borderRadius: "var(--r-selector)",
                  }}
                >
                  Earnings
                </span>
                <h2
                  className="font-black leading-tight mb-4"
                  style={{
                    fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                    color: "var(--base-content)",
                    fontFamily: "var(--font-display, system-ui, sans-serif)",
                  }}
                >
                  Earn What You{" "}
                  <span style={{ color: "var(--accent)" }}>Deserve</span>
                </h2>
                <p
                  className="font-medium leading-relaxed mb-6"
                  style={{
                    fontSize: "0.875rem",
                    color: "color-mix(in oklch, var(--base-content) 65%, transparent)",
                  }}
                >
                  Care assistants on our platform earn between ₹12,000 and ₹28,000 per month depending
                  on their experience, ratings, and hours. Payouts land in your bank account every week.
                </p>
              </motion.div>

              {EARNINGS_TABLE.map((item, i) => (
                <motion.div
                  key={item.label}
                  variants={fadeUp(i * 0.07)}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid var(--base-300)" }}
                >
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}
                  >{item.label}</span>
                  <span className="text-[13px] font-black" style={{ color: "var(--base-content)" }}>{item.value}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Right — earnings card */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true, amount: 0.25 }}
              className="relative"
            >
              <div
                className="rounded-3xl p-5 sm:p-6 relative overflow-hidden"
                style={{
                  background:  "linear-gradient(135deg, var(--neutral), var(--primary))",
                  boxShadow:   "0 20px 60px color-mix(in srgb, var(--primary) 35%, transparent)",
                  borderRadius: "var(--r-box)",
                }}
              >
                {/* Decorative circles */}
                <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-10" style={{ background: "#fff" }} aria-hidden="true" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-10" style={{ background: "var(--secondary)" }} aria-hidden="true" />

                <div className="relative z-10">
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.25em] mb-1"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >This Month</p>
                  <p className="font-black text-white leading-none mb-1" style={{ fontSize: "clamp(2rem, 8vw, 3rem)" }}>₹21,340</p>
                  <div className="flex items-center gap-1.5 mb-5">
                    <TrendingUp size={12} style={{ color: "rgba(255,255,255,0.6)" }} />
                    <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>+18% vs last month</span>
                  </div>

                  {EARNINGS_PROGRESS.map((row) => (
                    <div key={row.label} className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{row.label}</span>
                        <span className="text-[10px] font-black text-white">{row.val}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.pct}%`, background: "var(--secondary)" }}
                        />
                      </div>
                    </div>
                  ))}

                  <div
                    className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)" }}
                  >
                    <Wallet size={14} color="#fff" />
                    <span className="text-[11px] font-black text-white">Next payout in 3 days</span>
                    <span
                      className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-black"
                      style={{ background: "var(--accent)", color: "var(--accent-content)" }}
                    >₹5,320</span>
                  </div>
                </div>
              </div>

              {/* Floating top-performer badge */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-5 -left-4 sm:-left-6 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl flex items-center gap-3"
                style={{
                  background:   "var(--base-100)",
                  border:       "1px solid var(--base-300)",
                  boxShadow:    "0 8px 28px color-mix(in srgb, var(--primary) 20%, transparent)",
                  borderRadius: "var(--r-box)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--base-100))" }}
                >
                  <Star size={14} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <p className="text-[12px] font-black" style={{ color: "var(--base-content)" }}>Top Performer</p>
                  <p className="text-[9px] font-semibold" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>Bonus unlocked · +20%</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "var(--base-200)" }}>
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            variants={fadeUp()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            className="mb-10 sm:mb-12"
          >
            <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full mb-4 badge badge-primary">
              Testimonials
            </span>
            <h2
              className="font-black leading-tight"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                color: "var(--base-content)",
                fontFamily: "var(--font-display, system-ui, sans-serif)",
              }}
            >
              Heard from <span style={{ color: "var(--primary)" }}>Our Assistants</span>
            </h2>
          </motion.div>

          <div className="relative" style={{ minHeight: "220px" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-3xl p-6 sm:p-8"
                style={{
                  background:   "var(--base-100)",
                  border:       "1px solid var(--base-300)",
                  boxShadow:    "0 4px 32px color-mix(in srgb, var(--primary) 8%, transparent)",
                  borderRadius: "var(--r-box)",
                }}
              >
                {/* Stars */}
                <div className="flex justify-center gap-1 mb-4">
                  {Array.from({ length: TESTIMONIALS[activeTestimonial].rating }).map((_, i) => (
                    <Star key={i} size={14} style={{ color: "var(--accent)", fill: "var(--accent)" }} />
                  ))}
                </div>
                <p
                  className="font-medium leading-relaxed mb-5 italic"
                  style={{
                    fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
                    color: "color-mix(in oklch, var(--base-content) 65%, transparent)",
                  }}
                >
                  "{TESTIMONIALS[activeTestimonial].text}"
                </p>
                <div className="flex items-center justify-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, var(--neutral), ${TESTIMONIALS[activeTestimonial].varColor})`,
                      color: "var(--primary-content)",
                    }}
                  >
                    {TESTIMONIALS[activeTestimonial].avatar}
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-black" style={{ color: "var(--base-content)" }}>{TESTIMONIALS[activeTestimonial].name}</p>
                    <p className="text-[10px] font-semibold" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>{TESTIMONIALS[activeTestimonial].city}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dot navigation */}
            <div className="flex justify-center gap-2 mt-5">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:      i === activeTestimonial ? "24px" : "8px",
                    height:     "8px",
                    background: i === activeTestimonial ? "var(--primary)" : "var(--base-300)",
                    border:     "none",
                    cursor:     "pointer",
                    padding:    0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA BAND
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="join-now" className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true, amount: 0.3 }}
            className="relative overflow-hidden p-8 sm:p-10 text-center"
            style={{
              background:   "linear-gradient(135deg, var(--neutral), var(--primary))",
              borderRadius: "var(--r-box)",
            }}
          >
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-[0.07]" style={{ background: "#fff" }} aria-hidden="true" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-[0.07]" style={{ background: "var(--secondary)" }} aria-hidden="true" />

            <div className="relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
              >
                <HeartPulse size={26} color="var(--primary-content)" />
              </div>

              <h2
                className="font-black text-white leading-tight mb-3"
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2.4rem)",
                  fontFamily: "var(--font-display, system-ui, sans-serif)",
                }}
              >
                Ready to Start Your Journey?
              </h2>

              <p
                className="font-medium leading-relaxed mb-7 mx-auto"
                style={{
                  fontSize: "0.875rem",
                  color: "rgba(255,255,255,0.65)",
                  maxWidth: "30rem",
                }}
              >
                Join 12,000+ care assistants earning well, growing their skills, and making a real
                difference in people's lives — across India.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="/care-assistant/register"
                  className="flex items-center justify-center gap-2 font-black transition-all hover:scale-[1.03] active:scale-95 w-full sm:w-auto"
                  style={{
                    background:    "#fff",
                    color:         "var(--neutral)",
                    borderRadius:  "var(--r-field, 1rem)",
                    padding:       "0.875rem 2rem",
                    fontSize:      "0.875rem",
                    textDecoration:"none",
                    boxShadow:     "0 6px 28px rgba(0,0,0,0.18)",
                  }}
                >
                  Apply Now — It's Free <ArrowRight size={15} />
                </a>
                <a
                  href="/care-assistant/support"
                  className="flex items-center justify-center gap-2 font-black transition-all hover:opacity-80 w-full sm:w-auto"
                  style={{
                    background:    "rgba(255,255,255,0.12)",
                    color:         "#fff",
                    border:        "1px solid rgba(255,255,255,0.25)",
                    borderRadius:  "var(--r-field, 1rem)",
                    padding:       "0.875rem 2rem",
                    fontSize:      "0.875rem",
                    textDecoration:"none",
                  }}
                >
                  Talk to Support
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}