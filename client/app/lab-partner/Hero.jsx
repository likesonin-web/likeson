"use client";

import { useSelector } from "react-redux";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  FlaskConical,
  ShieldCheck,
  Clock3,
  MapPin,
  Star,
  ChevronRight,
  BadgeCheck,
  Microscope,
  TestTube2,
  Activity,
  ArrowUpRight,
  Beaker,
} from "lucide-react";
import Link from "next/link";

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.1 },
  }),
};

const fadeLeft = {
  hidden: { opacity: 0, x: 40 },
  show: (i = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.12 },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  show: (i = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1], delay: i * 0.08 },
  }),
};

// ── Floating stat chip ────────────────────────────────────────────────────────

function StatChip({ icon: Icon, value, label, delay, className = "" }) {
  return (
    <motion.div
      variants={scaleIn}
      custom={delay}
      initial="hidden"
      animate="show"
      className={`glass-card flex items-center gap-3 px-4 py-3 min-w-max ${className}`}
    >
      <div className="w-9 h-9 rounded-[var(--r-selector)] flex items-center justify-center"
        style={{ background: "color-mix(in oklch, var(--primary), transparent 85%)" }}>
        <Icon size={16} style={{ color: "var(--primary)" }} strokeWidth={2.2} />
      </div>
      <div>
        <p className="font-montserrat font-black text-sm leading-none" style={{ color: "var(--primary)" }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
          {label}
        </p>
      </div>
    </motion.div>
  );
}

// ── Feature pill ─────────────────────────────────────────────────────────────

function FeaturePill({ icon: Icon, text, delay }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      animate="show"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
      style={{
        borderColor: "color-mix(in oklch, var(--primary), transparent 70%)",
        background: "color-mix(in oklch, var(--primary), transparent 92%)",
      }}
    >
      <Icon size={13} style={{ color: "var(--primary)" }} strokeWidth={2.2} />
      <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>{text}</span>
    </motion.div>
  );
}

// ── Decorative orbiting icon ─────────────────────────────────────────────────

function OrbitIcon({ icon: Icon, angle, radius, size = 36, delay }) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="absolute flex items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        left: `calc(50% + ${x}px - ${size / 2}px)`,
        top: `calc(50% + ${y}px - ${size / 2}px)`,
        background: "var(--base-100)",
        border: "1px solid color-mix(in oklch, var(--primary), transparent 72%)",
        boxShadow: "var(--shadow-depth)",
      }}
    >
      <Icon size={size * 0.42} style={{ color: "var(--primary)" }} strokeWidth={1.8} />
    </motion.div>
  );
}

// ── Main Hero ─────────────────────────────────────────────────────────────────

export default function LabHero() {
  const user = useSelector((s) => s.user?.user) ?? null;
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const bgY    = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const textY  = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const labProfile = user?.role === "lab partner" ? user : null;
  const firstName  = user?.name?.split(" ")[0] ?? "Partner";

  return (
    <section
      ref={heroRef}
      data-theme="lab"
      className="relative   "
      style={{ minHeight: "100svh", background: "var(--base-100)" }}
    >
      {/* ── Background geometry ──────────────────────────────────────────── */}
      <motion.div
        style={{ y: bgY }}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        {/* Grid dots */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.035]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--primary)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Large blurred orb — top right */}
        <div
          className="absolute -top-32 -right-32 w-[540px] h-[540px] rounded-full"
          style={{
            background: "color-mix(in oklch, var(--primary), transparent 84%)",
            filter: "blur(90px)",
          }}
        />

        {/* Medium orb — bottom left */}
        <div
          className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full"
          style={{
            background: "color-mix(in oklch, var(--secondary), transparent 88%)",
            filter: "blur(80px)",
          }}
        />

        {/* Accent orb — mid */}
        <div
          className="absolute top-1/2 left-1/3 w-[280px] h-[280px] rounded-full"
          style={{
            background: "color-mix(in oklch, var(--accent), transparent 92%)",
            filter: "blur(100px)",
          }}
        />
      </motion.div>

      {/* ── Content wrapper ──────────────────────────────────────────────── */}
      <motion.div
        style={{ y: textY, opacity }}
        className="relative  max-w-7xl w-full mx-auto  flex flex-col lg:flex-row items-center gap-12 xl:gap-20 pt-28 pb-24 lg:pt-36 lg:pb-32"
      >
        {/* ── LEFT: Copy ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-6 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">

          {/* Greeting badge */}
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-2 self-center lg:self-start px-4 py-2 rounded-full"
            style={{
              background: "color-mix(in oklch, var(--primary), transparent 88%)",
              border: "1px solid color-mix(in oklch, var(--primary), transparent 68%)",
            }}
          >
            <BadgeCheck size={14} style={{ color: "var(--accent)" }} strokeWidth={2.4} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
              {labProfile ? "Verified Lab Partner" : "Lab Partner Portal"}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="show"
            className="font-montserrat font-black leading-[1.08] tracking-tight"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.75rem)", color: "var(--base-content)" }}
          >
            {user ? (
              <>
                Welcome back,{" "}
                <span className="text-gradient-primary">{firstName}</span>
                <br />
                <span style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)", fontSize: "78%" }}>
                  Your lab dashboard
                </span>
              </>
            ) : (
              <>
                Precision{" "}
                <span className="text-gradient-primary">Diagnostics</span>
                <br />
                Reimagined.
              </>
            )}
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate="show"
            className="text-base md:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0"
            style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}
          >
            {labProfile
              ? `Manage your tests, track bookings, and grow your diagnostic practice — all in one intelligent platform.`
              : `Connect your laboratory with thousands of patients. Streamlined workflows, real-time bookings, and verified credibility.`}
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-2 justify-center lg:justify-start"
          >
            {[
              { icon: ShieldCheck,  text: "NABL Compliant",       delay: 3 },
              { icon: Clock3,       text: "Real-time Reports",    delay: 4 },
              { icon: MapPin,       text: "Home Collection",      delay: 5 },
              { icon: Star,         text: "Verified Reviews",     delay: 6 },
            ].map((p) => (
              <FeaturePill key={p.text} {...p} />
            ))}
          </motion.div>

          {/* CTA row */}
          <motion.div
            variants={fadeUp}
            custom={7}
            initial="hidden"
            animate="show"
            className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
          >
            {user ? (
              <>
                <Link
                  href="/lab-partner/dashboard"
                  className="btn-primary-cta btn flex items-center justify-center gap-2 no-underline"
                >
                  <Activity size={15} strokeWidth={2.4} />
                  Go to Dashboard
                  <ChevronRight size={15} strokeWidth={2.4} />
                </Link>
                <Link
                  href="/lab-partner/tests"
                  className="btn-secondary btn flex items-center justify-center gap-2 no-underline"
                >
                  <TestTube2 size={15} strokeWidth={2.2} />
                  Manage Tests
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register?role=lab+partner"
                  className="btn-primary-cta flex items-center justify-center gap-2 no-underline"
                >
                  <FlaskConical size={15} strokeWidth={2.4} />
                  Join as Lab Partner
                  <ChevronRight size={15} strokeWidth={2.4} />
                </Link>
                <Link
                  href="/labs"
                  className="btn-secondary flex items-center justify-center gap-2 no-underline"
                >
                  Explore Labs
                  <ArrowUpRight size={14} strokeWidth={2.2} />
                </Link>
              </>
            )}
          </motion.div>

          {/* Quick stats row */}
          <motion.div
            variants={fadeUp}
            custom={8}
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-6 justify-center lg:justify-start pt-2"
          >
            {[
              { value: "1,200+", label: "Verified Labs" },
              { value: "50K+",   label: "Monthly Tests" },
              { value: "4.8★",   label: "Avg. Rating"  },
            ].map(({ value, label }) => (
              <div key={label} className="text-center lg:text-left">
                <p
                  className="font-montserrat font-black text-xl leading-none"
                  style={{ color: "var(--primary)" }}
                >
                  {value}
                </p>
                <p
                  className="text-xs mt-1 font-semibold uppercase tracking-wider"
                  style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RIGHT: Visual cluster ────────────────────────────────────────── */}
        <motion.div
          variants={fadeLeft}
          custom={2}
          initial="hidden"
          animate="show"
          className="flex-shrink-0 relative flex items-center justify-center"
          style={{ width: "clamp(280px, 42vw, 480px)", height: "clamp(280px, 42vw, 480px)" }}
        >
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "1px dashed color-mix(in oklch, var(--primary), transparent 65%)",
            }}
          />

          {/* Mid ring */}
          <div
            className="absolute rounded-full"
            style={{
              inset: "15%",
              border: "1px solid color-mix(in oklch, var(--primary), transparent 80%)",
            }}
          />

          {/* Centre hexagon / avatar */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative z-10 flex flex-col items-center justify-center rounded-2xl"
            style={{
              width: "40%",
              aspectRatio: "1",
              background: "var(--bg-gradient-primary)",
              boxShadow: "0 20px 60px color-mix(in oklch, var(--primary), transparent 50%)",
            }}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <Microscope
                size={48}
                color="white"
                strokeWidth={1.6}
              />
            )}
          </motion.div>

          {/* Orbiting icons */}
          {[
            { icon: FlaskConical, angle: -60,  radius: 130, delay: 0.8  },
            { icon: TestTube2,    angle:   0,  radius: 145, delay: 0.95 },
            { icon: ShieldCheck,  angle:  80,  radius: 135, delay: 1.1  },
            { icon: Activity,     angle: 155,  radius: 140, delay: 1.25 },
            { icon: Beaker,       angle: 220,  radius: 130, delay: 1.4  },
          ].map((o, i) => (
            <OrbitIcon key={i} {...o} />
          ))}

          {/* Floating stat chips */}
          <StatChip
            icon={Clock3}
            value="< 24h"
            label="Avg. Turnaround"
            delay={6}
            className="absolute -bottom-4 left-0 lg:-left-8"
          />
          <StatChip
            icon={BadgeCheck}
            value="NABL"
            label="Accredited"
            delay={7}
            className="absolute -top-4 right-0 lg:-right-8"
          />
        </motion.div>
      </motion.div>

      {/* ── Bottom scroll indicator ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ color: "color-mix(in oklch, var(--base-content) 35%, transparent)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full border flex items-start justify-center pt-1"
          style={{ borderColor: "color-mix(in oklch, var(--base-content), transparent 70%)" }}
        >
          <div className="w-1 h-2 rounded-full" style={{ background: "var(--primary)" }} />
        </motion.div>
      </motion.div>
    </section>
  );
}