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
  TestTube2,
  Activity,
  ArrowUpRight,
  Beaker,
} from "lucide-react";
import Link from "next/link";

// ── Animation Variants ────────────────────────────────────────────────────────

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

// ── 3D SVG Animated Lab Creatures ─────────────────────────────────────────────

// 1. The Big Centerpiece: Sentient Erlenmeyer Flask
const CreatureBigFlask = ({ className }) => (
  <motion.div
    initial={{ scale: 0.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1, y: [0, -15, 0] }}
    transition={{ 
      scale: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1], delay: 0.2 },
      y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    }}
    className={`absolute z-20 flex items-center justify-center pointer-events-none w-64 h-64 ${className}`}
  >
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full drop-shadow-2xl overflow-visible">
      <defs>
        <radialGradient id="flaskLiquid" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--primary)" />
        </radialGradient>
        <filter id="flaskGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="15" floodOpacity="0.4" floodColor="var(--primary)" />
        </filter>
      </defs>
      
      <g filter="url(#flaskGlow)">
        {/* Flask Body */}
        <path 
          d="M80 30 L120 30 L120 70 L170 160 Q180 180 150 180 L50 180 Q20 180 30 160 L80 70 Z" 
          fill="var(--base-200)" fillOpacity="0.4" stroke="var(--primary)" strokeWidth="6" strokeLinejoin="round" className="backdrop-blur-md"
        />
        
        {/* Flask Lip */}
        <rect x="75" y="20" width="50" height="10" rx="4" fill="var(--primary)" />
        
        {/* Liquid */}
        <path 
          d="M44 135 L156 135 L165 155 Q175 175 150 175 L50 175 Q25 175 35 155 Z" 
          fill="url(#flaskLiquid)" 
        />
        
        {/* Highlights */}
        <path d="M45 160 Q35 170 60 170" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.4" fill="none" />
        <path d="M85 45 L85 65" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.4" fill="none" />

        {/* Cute Face */}
        <circle cx="85" cy="150" r="7" fill="#fff" />
        <circle cx="115" cy="150" r="7" fill="#fff" />
        <motion.circle cx="85" cy="150" r="7" fill="#fff" animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 4 }} />
        <motion.circle cx="115" cy="150" r="7" fill="#fff" animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 4 }} />
        <path d="M95 158 Q100 164 105 158" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* Animated Bubbles */}
        <motion.circle cx="80" cy="140" r="4" fill="#fff" opacity="0.6" animate={{ y: [0, -70], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} />
        <motion.circle cx="120" cy="155" r="5" fill="#fff" opacity="0.6" animate={{ y: [0, -85], opacity: [0.6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }} />
        <motion.circle cx="100" cy="145" r="3" fill="#fff" opacity="0.6" animate={{ y: [0, -60], opacity: [0.6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 1.2 }} />
      </g>
    </svg>
  </motion.div>
);

// 2. DNA Buddy
const CreatureDNABuddy = ({ className, delay }) => (
  <motion.div
    animate={{ y: [0, -12, 0], rotate: [-5, 5, -5] }}
    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay }}
    className={`absolute pointer-events-none z-30 ${className}`}
  >
    <svg width="75" height="75" viewBox="0 0 100 100" fill="none" className="drop-shadow-lg">
      <defs>
        <filter id="dnaGlow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" floodColor="var(--accent)" />
        </filter>
      </defs>
      <g filter="url(#dnaGlow)">
        {/* Helix strands */}
        <path d="M30 10 Q70 30 30 50 T30 90" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M70 10 Q30 30 70 50 T70 90" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" fill="none" />
        
        {/* Rungs */}
        <line x1="42" y1="20" x2="58" y2="20" stroke="var(--base-content)" opacity="0.3" strokeWidth="3" />
        <line x1="50" y1="50" x2="50" y2="50" stroke="var(--base-content)" opacity="0.3" strokeWidth="3" />
        <line x1="42" y1="80" x2="58" y2="80" stroke="var(--base-content)" opacity="0.3" strokeWidth="3" />

        {/* Floating Head/Node */}
        <circle cx="50" cy="50" r="16" fill="var(--base-100)" stroke="var(--primary)" strokeWidth="4" />
        <circle cx="45" cy="48" r="2.5" fill="var(--primary)" />
        <circle cx="55" cy="48" r="2.5" fill="var(--primary)" />
        <path d="M47 54 Q50 57 53 54" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  </motion.div>
);

// 3. Microbe Cell
const CreatureCell = ({ className, delay }) => (
  <motion.div
    animate={{ y: [0, 15, 0], x: [0, -8, 0], scale: [1, 1.05, 1] }}
    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay }}
    className={`absolute pointer-events-none z-10 ${className}`}
  >
    <svg width="85" height="85" viewBox="0 0 100 100" fill="none" className="drop-shadow-lg">
      <defs>
        <radialGradient id="cellBody" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--info)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--secondary)" stopOpacity="1" />
        </radialGradient>
      </defs>
      <g>
        {/* Receptors */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <g key={i} transform={`rotate(${angle} 50 50)`}>
            <line x1="50" y1="50" x2="50" y2="8" stroke="var(--secondary)" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
            <circle cx="50" cy="8" r="4" fill="var(--info)" />
          </g>
        ))}
        {/* Core Body */}
        <circle cx="50" cy="50" r="30" fill="url(#cellBody)" />
        <circle cx="40" cy="40" r="8" fill="rgba(255,255,255,0.2)" />
        {/* Happy Face */}
        <path d="M 38 48 Q 42 43 46 48" stroke="var(--base-100)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M 54 48 Q 58 43 62 48" stroke="var(--base-100)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <circle cx="50" cy="56" r="4" fill="var(--base-100)" opacity="0.8" />
      </g>
    </svg>
  </motion.div>
);

// 4. Bio-Pill Drone
const CreaturePill = ({ className, delay }) => (
  <motion.div
    animate={{ y: [0, -10, 0], rotate: [15, 5, 15] }}
    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay }}
    className={`absolute pointer-events-none z-30 ${className}`}
  >
    <svg width="65" height="65" viewBox="0 0 100 100" fill="none" className="drop-shadow-md">
      <g>
        {/* Hover rings */}
        <ellipse cx="50" cy="75" rx="25" ry="6" stroke="var(--primary)" strokeWidth="2" fill="none" opacity="0.4" />
        <ellipse cx="50" cy="82" rx="15" ry="4" stroke="var(--accent)" strokeWidth="2" fill="none" opacity="0.3" />
        
        {/* Capsule Top */}
        <path d="M30 50 L30 35 A20 20 0 0 1 70 35 L70 50 Z" fill="var(--primary)" />
        {/* Capsule Bottom */}
        <path d="M30 50 L70 50 L70 60 A20 20 0 0 1 30 60 Z" fill="var(--base-100)" stroke="var(--primary)" strokeWidth="3" />
        
        {/* Eye */}
        <rect x="40" y="38" width="20" height="8" rx="4" fill="var(--base-100)" opacity="0.9" />
        <motion.circle cx="50" cy="42" r="2.5" fill="var(--primary)" animate={{ scaleX: [1, 0, 1] }} transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3 }} />
      </g>
    </svg>
  </motion.div>
);

// ── Small Components ──────────────────────────────────────────────────────────

function StatChip({ icon: Icon, value, label, delay, className = "" }) {
  return (
    <motion.div
      variants={scaleIn}
      custom={delay}
      initial="hidden"
      animate="show"
      className={`glass-card flex items-center gap-3 px-4 py-3 min-w-max backdrop-blur-md bg-base-100/60 border border-primary/20 ${className}`}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/15 text-primary">
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <div>
        <p className="font-montserrat font-black text-sm leading-none text-primary">
          {value}
        </p>
        <p className="text-xs mt-0.5 text-base-content/60">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

function FeaturePill({ icon: Icon, text, delay }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      animate="show"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 shadow-sm"
    >
      <Icon size={13} className="text-primary" strokeWidth={2.2} />
      <span className="text-xs font-semibold text-primary">{text}</span>
    </motion.div>
  );
}

function OrbitIcon({ icon: Icon, angle, radius, size = 38, delay }) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      className="absolute flex items-center justify-center rounded-xl bg-base-100 border border-primary/20 shadow-lg z-10"
      style={{
        width: size,
        height: size,
        left: `calc(50% + ${x}px - ${size / 2}px)`,
        top: `calc(50% + ${y}px - ${size / 2}px)`,
      }}
    >
      <Icon size={size * 0.45} className="text-primary" strokeWidth={2} />
    </motion.div>
  );
}

// ── Main Hero Component ───────────────────────────────────────────────────────

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
      className="relative min-h-[100svh] bg-base-100  "
    >
      {/* ── Background Geometry ──────────────────────────────────────────── */}
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
              <circle cx="1" cy="1" r="1" className="fill-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Large blurred orb — top right */}
        <div className="absolute -top-32 -right-32 w-[540px] h-[540px] rounded-full bg-primary/15 blur-[90px]" />

        {/* Medium orb — bottom left */}
        <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-secondary/15 blur-[80px]" />

        {/* Accent orb — mid */}
        <div className="absolute top-1/2 left-1/3 w-[280px] h-[280px] rounded-full bg-accent/10 blur-[100px]" />
      </motion.div>

      {/* ── Content Wrapper ──────────────────────────────────────────────── */}
      <motion.div
        style={{ y: textY, opacity }}
        className="relative container-custom max-w-7xl w-full mx-auto flex flex-col lg:flex-row items-center gap-12 xl:gap-20 pt-28 pb-24 lg:pt-36 lg:pb-32"
      >
        {/* ── LEFT: Copy ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-6 text-center lg:text-left max-w-2xl mx-auto lg:mx-0 z-10">
          
          {/* Greeting badge */}
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-2 self-center lg:self-start px-4 py-2 rounded-full bg-primary/10 border border-primary/30 shadow-sm"
          >
            <BadgeCheck size={14} className="text-accent" strokeWidth={2.4} />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {labProfile ? "Verified Lab Partner" : "Lab Partner Portal"}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="show"
            className="font-montserrat font-black leading-[1.08] tracking-tight text-base-content text-[clamp(2.4rem,5vw,3.75rem)]"
          >
            {user ? (
              <>
                Welcome back,{" "}
                <span className="text-gradient-primary">{firstName}</span>
                <br />
                <span className="text-[78%] text-base-content/60">
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
            className="text-base md:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0 text-base-content/60"
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
            className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mt-2"
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
                  className="btn-primary-cta btn flex items-center justify-center gap-2 no-underline"
                >
                  <FlaskConical size={15} strokeWidth={2.4} />
                  Join as Lab Partner
                  <ChevronRight size={15} strokeWidth={2.4} />
                </Link>
                <Link
                  href="/labs"
                  className="btn-secondary btn flex items-center justify-center gap-2 no-underline"
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
            className="flex flex-wrap gap-6 justify-center lg:justify-start pt-4"
          >
            {[
              { value: "1,200+", label: "Verified Labs" },
              { value: "50K+",   label: "Monthly Tests" },
              { value: "4.8★",   label: "Avg. Rating"  },
            ].map(({ value, label }) => (
              <div key={label} className="text-center lg:text-left">
                <p className="font-montserrat font-black text-xl leading-none text-primary">
                  {value}
                </p>
                <p className="text-xs mt-1 font-semibold uppercase tracking-wider text-base-content/50">
                  {label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RIGHT: Visual Cluster & Lab Creatures ───────────────────────── */}
        <motion.div
          variants={fadeLeft}
          custom={2}
          initial="hidden"
          animate="show"
          className="flex-shrink-0 relative flex items-center justify-center z-10 w-[clamp(280px,42vw,480px)] h-[clamp(280px,42vw,480px)]"
        >
          {/* Big Centerpiece Lab Creature */}
          <CreatureBigFlask />

          {/* Small Orbiting Lab Creatures */}
          <CreatureDNABuddy delay={0} className="top-[5%] right-[-5%]" />
          <CreatureCell delay={1.2} className="bottom-[10%] left-[-10%]" />
          <CreaturePill delay={2.5} className="top-[25%] left-[0%]" />

          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border border-dashed border-primary/30 animate-[spin_60s_linear_infinite]" />

          {/* Mid ring */}
          <div className="absolute rounded-full inset-[15%] border border-primary/15 animate-[spin_40s_linear_infinite_reverse]" />

          {/* Orbiting icons */}
          {[
            { icon: FlaskConical, angle: -60,  radius: 135, delay: 0.8  },
            { icon: TestTube2,    angle:   0,  radius: 155, delay: 0.95 },
            { icon: ShieldCheck,  angle:  80,  radius: 145, delay: 1.1  },
            { icon: Activity,     angle: 155,  radius: 150, delay: 1.25 },
            { icon: Beaker,       angle: 220,  radius: 140, delay: 1.4  },
          ].map((o, i) => (
            <OrbitIcon key={i} {...o} />
          ))}

          {/* Floating stat chips */}
          <StatChip
            icon={Clock3}
            value="< 24h"
            label="Avg. Turnaround"
            delay={6}
            className="absolute -bottom-4 left-0 lg:-left-12 z-40"
          />
          <StatChip
            icon={BadgeCheck}
            value="NABL"
            label="Accredited"
            delay={7}
            className="absolute -top-4 right-0 lg:-right-8 z-40"
          />
        </motion.div>
      </motion.div>

      {/* ── Bottom Scroll Indicator ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-base-content/40"
      >
        <span className="text-xs font-semibold uppercase tracking-widest">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full border border-base-content/30 flex items-start justify-center pt-1"
        >
          <div className="w-1 h-2 rounded-full bg-primary" />
        </motion.div>
      </motion.div>
    </section>
  );
}