"use client";

import React, { useEffect, useMemo, memo, useState, useRef } from "react";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";

import {
  ArrowRight,
  ExternalLink,
  Star,
  ChevronDown,
  Zap,
  TrendingUp,
} from "lucide-react";

import Container from "./Container";
import {
  fetchActiveHero,
  selectActiveHero,
  selectLoadingActiveHero,
} from "@/store/slices/heroPageSlice";

// ─── Animation Variants ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1];

const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  },
  fadeLeft: {
    hidden: { opacity: 0, x: 36 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
  },
  stagger: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  },
  float: {
    animate: {
      y: [0, -14, 0],
      transition: { duration: 8, repeat: Infinity, ease: "easeInOut" },
    },
  },
};

const floatDelay = (delay) => ({
  animate: {
    y: [0, -10, 0],
    transition: { duration: 5.5, repeat: Infinity, ease: "easeInOut", delay },
  },
});

// ─── Sub-Components ────────────────────────────────────────────────────────────

// BUG 3 FIX: z-50 → z-0. Background was rendering above all content.
const Background = memo(() => (
  <div
    className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
    aria-hidden="true"
  >
    {/* Grid Layer */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--primary)_12%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--primary)_12%,transparent)_1px,transparent_1px)] bg-[length:48px_48px] [mask-image:radial-gradient(ellipse_70%_65%_at_50%_50%,black_0%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_70%_65%_at_50%_50%,black_0%,transparent_100%)]" />

    {/* Dot Accent Layer */}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg_xmlns=%22http://www.w3.org/2000/svg%22_width=%2248%22_height=%2248%22%3E%3Ccircle_cx=%220%22_cy=%220%22_r=%221.4%22_fill=%22%230066ff%22_fill-opacity=%220.18%22/%3E%3C/svg%3E')] bg-[length:48px_48px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,black_0%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,black_0%,transparent_100%)]" />
  </div>
));
Background.displayName = "Background";

const Skeleton = memo(() => (
  <section
    className="relative w-full min-h-screen flex items-center bg-base-100 overflow-hidden"
    aria-busy="true"
    aria-label="Loading hero content"
  >
    <Background />
    <Container>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="skeleton h-7 w-48 rounded-full" />
          <div className="space-y-3">
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-4/5 rounded-xl" />
            <div className="skeleton h-12 w-3/5 rounded-xl" />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
          </div>
          <div className="flex gap-4">
            <div className="skeleton h-12 w-40 rounded-xl" />
            <div className="skeleton h-12 w-36 rounded-xl" />
          </div>
        </div>
        <div className="lg:col-span-6 hidden md:flex justify-end">
          <div className="skeleton w-[280px] h-[560px] rounded-[3rem]" />
        </div>
      </div>
    </Container>
  </section>
));
Skeleton.displayName = "Skeleton";

const Fallback = memo(() => (
  <section
    className="relative w-full min-h-screen flex items-center justify-center bg-base-100 overflow-hidden"
    aria-label="Content unavailable"
  >
    <Background />
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="relative z-10 text-center px-6 max-w-lg"
    >
      <h1 className="font-black tracking-tight mb-4 text-[clamp(2.6rem,5.5vw,4.8rem)] text-base-content">
        Something{" "}
        <span className="text-transparent bg-clip-text bg-[image:var(--bg-gradient-primary)]">
          Great
        </span>{" "}
        Awaits
      </h1>
      <p className="text-base leading-relaxed text-base-content/60">
        Check back soon for the latest updates and announcements.
      </p>
    </motion.div>
  </section>
));
Fallback.displayName = "Fallback";

// ─── CtaButton — uses global.css .btn variants ──────────────────────────────
const CtaButton = memo(({ btn }) => {

  // Map DB variant → global.css .btn classes
  const getVariantClass = (variant) => {
    switch (variant) {
      case 'primary':
        // Gradient CTA — most prominent, hero's main action
        return 'btn btn-lg btn-primary-cta';

      case 'secondary':
        // Solid secondary colour fill
        return 'btn btn-lg btn-secondary';

      case 'outline':
        // Transparent + primary border → fills on hover
        return 'btn btn-lg btn-outline';

      case 'ghost':
        // No bg, no border — lightest option
        return 'btn btn-lg btn-ghost';

      default:
        return 'btn btn-lg btn-primary-cta';
    }
  };

  const inner = (
    <motion.span
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full sm:w-auto ${getVariantClass(btn.variant)}`}
    >
      {btn.label}
      {btn.isExternal
        ? <ExternalLink size={15} aria-hidden="true" />
        : <ArrowRight    size={15} aria-hidden="true" />}
    </motion.span>
  );

  if (btn.isExternal) {
    return (
      <a
        href={btn.href}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full sm:w-auto outline-none"
        aria-label={`${btn.label} (opens in new tab)`}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link
      href={btn.href}
      className="w-full sm:w-auto outline-none"
      aria-label={btn.label}
    >
      {inner}
    </Link>
  );
});
CtaButton.displayName = "CtaButton";

CtaButton.displayName = "CtaButton";

const TrustRow = memo(({ priority, centred }) => (
  <motion.div
    variants={variants.fadeUp}
    className={`pt-6 border-t border-base-300/60 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 ${
      centred ? "justify-center" : "justify-center lg:justify-start"
    }`}
  >
    {/* Avatars */}
    <div className="flex -space-x-3" aria-label="Over 1000 trusted users">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-9 h-9 rounded-full overflow-hidden border-[2.5px] border-base-100 bg-base-200 relative"
        >
          <img
            src={`https://i.pravatar.cc/80?u=trust${i}`}
            alt={`Trusted User ${i}`}
            sizes="36px"
            className="object-cover w-full h-full"
            loading="lazy"
          />
        </div>
      ))}
      <div
        className="w-9 h-9 rounded-full border-[2.5px] border-base-100 bg-base-content text-base-100 flex items-center justify-center text-[9px] font-black"
        aria-hidden="true"
      >
        +1k
      </div>
    </div>

    {/* Rating */}
    <div className="text-sm text-center sm:text-left">
      <div
        className="flex items-center justify-center sm:justify-start gap-1 mb-0.5 text-warning"
        aria-label="Rated 4.9 out of 5 stars"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={11} fill="currentColor" aria-hidden="true" />
        ))}
        <span className="font-bold ml-1 text-xs text-base-content">4.9</span>
      </div>
      <p className="text-[11px] font-medium text-base-content/50">
        Trusted by Families & NRIs
      </p>
    </div>

    {/* Priority */}
    {priority > 0 && (
      <div
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border bg-success/10 border-success/20 text-success"
        aria-label={`High Priority Campaign #${priority}`}
      >
        <TrendingUp size={10} aria-hidden="true" />
        Priority #{priority}
      </div>
    )}
  </motion.div>
));
TrustRow.displayName = "TrustRow";

// ─── Mobile Mockup Phone Frame ─────────────────────────────────────────────────

function format12Hour(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Signal Bars SVG ─────────────────────────────────────────────────────────

function SignalBars({ strength = 4 }) {
  const heights = [3, 5, 7, 9];
  return (
    <svg
      width="17"
      height="11"
      viewBox="0 0 17 11"
      fill="none"
      aria-label={`Signal strength ${strength} of 4`}
    >
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 4}
          y={11 - h}
          width="3"
          height={h}
          rx="0.8"
          fill="white"
          opacity={i < strength ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

// ─── WiFi SVG ────────────────────────────────────────────────────────────────

// BUG 6 FIX: WifiIcon used hardcoded #1c1c1e (near-black) for stroke/fill,
// making it invisible on the phone's dark screen. Changed to white to match
// SignalBars and BatteryIcon which already correctly use white/light colors.
function WifiIcon({ connected = true }) {
  return (
    <svg
      width="16"
      height="12"
      viewBox="0 0 16 12"
      fill="none"
      aria-label={connected ? "WiFi connected" : "WiFi disconnected"}
    >
      {/* Dot */}
      <circle cx="8" cy="10.6" r="1.15" fill="white" />
      {/* Inner arc */}
      <path
        d="M5.2 7.4a3.9 3.9 0 0 1 5.6 0"
        stroke="white"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
        opacity={connected ? 1 : 0.22}
      />
      {/* Outer arc */}
      <path
        d="M2.3 4.3a8 8 0 0 1 11.4 0"
        stroke="white"
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
        opacity={connected ? 0.5 : 0.14}
      />
    </svg>
  );
}

// ─── Battery SVG ─────────────────────────────────────────────────────────────

function BatteryIcon({ level = 1, charging = false }) {
  const fillWidth = Math.max(1, Math.round(17 * level));
  const low = level <= 0.2;
  const fillColor = low ? "var(--error)" : "var(--success)";

  return (
    <svg
      width="27"
      height="13"
      viewBox="0 0 27 13"
      fill="none"
      aria-label={`Battery ${Math.round(level * 100)}%${charging ? ", charging" : ""}`}
    >
      {/* Outer shell */}
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="12"
        rx="2.8"
        stroke="white"
        strokeWidth="1"
        opacity="0.32"
      />
      {/* Fill */}
      <rect
        x="2"
        y="2"
        width={fillWidth}
        height="9"
        rx="1.6"
        fill={fillColor}
      />
      {/* Cap nub */}
      <rect
        x="24.2"
        y="3.8"
        width="2"
        height="5.4"
        rx="1"
        fill="white"
        opacity="0.38"
      />
      {/* Charging bolt */}
      {charging && (
        <path
          d="M10.5 2.5 8.5 6.5h3L9.5 10.5"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  );
}

// ─── Phone Status Bar ─────────────────────────────────────────────────────────

function PhoneStatusBar() {
  const [time, setTime] = useState(() => format12Hour(new Date()));
  const [battery, setBattery] = useState({ level: 1, charging: false, supported: false });
  const [signal, setSignal] = useState(4);
  const [wifiConnected, setWifiConnected] = useState(true);
  const [batteryPct, setBatteryPct] = useState(null);

  // ── Time (every second) ──────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setTime(format12Hour(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // BUG 4 FIX: Battery API cleanup was returning a Promise which resolved the
  // cleanup function *after* unmount. Store the cleanup fn in a ref so the
  // effect's return fires it synchronously on unmount.
  const batteryCleanupRef = useRef(null);

  useEffect(() => {
    if (!navigator.getBattery) return;

    let cancelled = false;

    navigator.getBattery().then((b) => {
      if (cancelled) return;

      const update = () => {
        setBattery({ level: b.level, charging: b.charging, supported: true });
        setBatteryPct(Math.round(b.level * 100));
      };
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);

      // Store cleanup so unmount can run it synchronously
      batteryCleanupRef.current = () => {
        b.removeEventListener("levelchange", update);
        b.removeEventListener("chargingchange", update);
      };
    }).catch(() => {});

    return () => {
      cancelled = true;
      batteryCleanupRef.current?.();
      batteryCleanupRef.current = null;
    };
  }, []);

  // ── Network / Signal ─────────────────────────────────────────────────────
  const readNetwork = useCallback(() => {
    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (!conn) {
      setSignal(navigator.onLine ? 4 : 0);
      setWifiConnected(navigator.onLine);
      return;
    }

    const type = conn.effectiveType || conn.type || "";
    const dl = conn.downlink ?? 10;
    const isWifi = conn.type === "wifi" || conn.type === "ethernet";

    let strength = 4;
    if (!navigator.onLine) strength = 0;
    else if (type === "slow-2g") strength = 1;
    else if (type === "2g") strength = 1;
    else if (type === "3g") strength = 2;
    else if (dl < 0.5) strength = 1;
    else if (dl < 2) strength = 2;
    else if (dl < 8) strength = 3;
    else strength = 4;

    setSignal(strength);
    setWifiConnected(isWifi || dl >= 8);
  }, []);

  useEffect(() => {
    readNetwork();

    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    conn?.addEventListener("change", readNetwork);
    window.addEventListener("online", readNetwork);
    window.addEventListener("offline", readNetwork);

    const id = setInterval(readNetwork, 30_000);

    return () => {
      conn?.removeEventListener("change", readNetwork);
      window.removeEventListener("online", readNetwork);
      window.removeEventListener("offline", readNetwork);
      clearInterval(id);
    };
  }, [readNetwork]);

  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 flex items-center px-4 pl-6 py-1 justify-between"
      
    >
      {/* Time */}
      <span
        style={{
          fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "-0.3px",
          color: "white",
        }}
      >
        {time}
      </span>

      {/* Icons cluster */}
      <div className="flex items-center gap-[5px]">
        <SignalBars  strength={signal} />
        <WifiIcon connected={wifiConnected} />
        <div className="flex items-center gap-[3px]">
          {battery.supported && batteryPct !== null && (
            <span
              style={{
                fontFamily: "-apple-system, 'SF Pro Display', sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "-0.2px",
                color: battery.level <= 0.2 ? "var(--error)" : "var(--success)",
              }}
            >
              {batteryPct}%
            </span>
          )}
          <BatteryIcon level={battery.level} charging={battery.charging} />
        </div>
      </div>
    </div>
  );
}

// BUG 5 FIX: destructure all props actually passed at the call site.
// badge and analyticsTag were passed but missing from destructuring — dead props.
const MediaCard = memo(({ media, badge, analyticsTag, activeTo }) => {
  if (!media?.url) return null;

  const scheduleLabel = activeTo
    ? `Until ${new Date(activeTo).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })}`
    : "Live Now";

  return (
    <div
      className="relative w-full max-w-[380px] lg:max-w-none flex justify-center lg:justify-end scale-[0.80] sm:scale-90 lg:scale-100 origin-center lg:origin-right"
      aria-hidden="true"
      data-analytics={analyticsTag}
    >
      {/* ── Realistic Mobile Phone Mockup ───────────────────────────────── */}
      <motion.div
        variants={variants.float}
        animate="animate"
        className="relative z-10 lg:mr-10"
        style={{ filter: "drop-shadow(0 60px 80px rgba(0,0,0,0.28)) drop-shadow(0 30px 40px rgba(0,0,0,0.20))" }}
      >
        {/* Phone outer shell */}
        <div
          className="relative"
          style={{ width: "300px", height: "580px" }}
        >
          {/* Outer frame / chassis */}
          <div
            className="absolute inset-0 rounded-[44px] z-10"
            style={{
              background: "linear-gradient(145deg, #2a2a2e 0%, #1a1a1d 40%, #0d0d0f 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          />

          {/* Metallic side rails highlight */}
          <div
            className="absolute inset-[1px] rounded-[43px] z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%)",
            }}
          />

          {/* Inner bezel */}
          <div
            className="absolute z-10"
            style={{ inset: "8px", borderRadius: "38px", background: "#000" }}
          />

          {/* Screen area */}
          <div
            className="absolute z-20 overflow-hidden bg-black"
            style={{ inset: "8px", borderRadius: "38px" }}
          >
            {/* Status Bar */}
            <PhoneStatusBar />

            {/* ── Media Content ── */}
            {media.type === "video" ? (
              <video
                src={media.url}
                poster={media.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : media.type === "lottie" ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-300 to-base-200">
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                    <Zap size={28} className="text-primary" />
                  </div>
                  <p className="text-xs text-base-content/60 font-medium">Lottie Animation</p>
                </div>
              </div>
            ) : (
              <img
                src={media.url}
                alt={media.altText || "Hero showcase media"}
                className="w-full h-full object-cover"
                loading="eager"
              />
            )}

            {/* Aesthetic Overlay Scrims */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_top,rgba(0,0,0,0.72)_0%,transparent_48%)]" />
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(0,0,0,0.30)_0%,transparent_36%)]" />

            {/* Bottom overlay content inside phone screen */}
            <div className="absolute bottom-0 left-0 right-0 z-30 p-4 pb-8">
              <div className="flex items-center justify-between">
                {/* Live indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                  </span>
                  <span className="text-white text-[8px] font-bold uppercase tracking-wider">
                    {scheduleLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Physical button details — volume buttons left */}
          <div className="absolute z-0" style={{ left: "-3px", top: "100px", width: "3px", height: "28px", borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg, #2a2a2e, #1a1a1d)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }} />
          <div className="absolute z-0" style={{ left: "-3px", top: "138px", width: "3px", height: "52px", borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg, #2a2a2e, #1a1a1d)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }} />
          <div className="absolute z-0" style={{ left: "-3px", top: "200px", width: "3px", height: "52px", borderRadius: "3px 0 0 3px", background: "linear-gradient(180deg, #2a2a2e, #1a1a1d)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }} />

          {/* Power button right */}
          <div className="absolute z-0" style={{ right: "-3px", top: "140px", width: "3px", height: "68px", borderRadius: "0 3px 3px 0", background: "linear-gradient(180deg, #2a2a2e, #1a1a1d)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }} />

          {/* Screen glare/reflection */}
          <div className="absolute z-20 pointer-events-none rounded-[38px]" style={{ inset: "8px", background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%)" }} />
        </div>
      </motion.div>

      {/* Schedule Widget */}
      {activeTo && (
        <motion.div
          variants={floatDelay(2.2)}
          animate="animate"
          className="absolute right-[-6px] sm:right-[4px] bottom-[14%] z-30"
        >
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-full border bg-base-100/75 backdrop-blur-[20px] border-base-300/65 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.12)]">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative bg-[image:var(--bg-gradient-primary)] text-primary-content">
              <Zap size={13} />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 bg-success border-base-100" />
            </div>
            <div>
              <p className="text-xs font-bold text-base-content">Scheduled</p>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 border text-primary bg-primary/10 border-primary/20">
                {scheduleLabel}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* SLA Widget */}
      <motion.div
        variants={floatDelay(3)}
        animate="animate"
        className="absolute left-[-6px] sm:left-[6px] bottom-[26%] z-20"
      >
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border bg-base-100/90 backdrop-blur-[18px] border-base-300/60 shadow-[0_10px_24px_-6px_rgba(0,0,0,0.08)]">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 bg-success/10 text-success">
            <Zap size={12} />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Response</p>
            <p className="text-xs font-black text-success">&lt; 2 hrs</p>
          </div>
        </div>
      </motion.div>

      {/* Ambient glow behind phone */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)",
          filter: "blur(32px)",
        }}
      />
    </div>
  );
});
MediaCard.displayName = "MediaCard";

// ─── Utility Functions ─────────────────────────────────────────────────────────

const buildHeadline = (headline, highlightedText) => {
  if (!highlightedText || !headline?.includes(highlightedText)) {
    return <span className="text-base-content">{headline}</span>;
  }
  const idx = headline.indexOf(highlightedText);
  const before = headline.slice(0, idx);
  const after = headline.slice(idx + highlightedText.length);
  return (
    <>
      {before && <span className="text-base-content">{before}</span>}
      <span className="text-transparent bg-clip-text bg-[image:var(--bg-gradient-primary)]">
        {highlightedText}
      </span>
      {after && <span className="text-base-content">{after}</span>}
    </>
  );
};

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function Hero() {
  const dispatch = useDispatch();
  const hero = useSelector(selectActiveHero);
  const loading = useSelector(selectLoadingActiveHero);
  const reduceMotion = useReducedMotion();

  // BUG 2 FIX: removed `loading` from dependency array. Including it caused an
  // infinite loop: loading flips false after fetch → effect re-runs → if hero
  // is still null (e.g. 404) it dispatches again endlessly.
  // We only want to fetch once on mount when hero is absent.
  useEffect(() => {
    if (!hero) {
      dispatch(fetchActiveHero());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const headlineNode = useMemo(
    () => buildHeadline(hero?.headline, hero?.highlightedText),
    [hero?.headline, hero?.highlightedText]
  );

  const sortedBtns = useMemo(
    () =>
      Array.isArray(hero?.ctaButtons)
        ? [...hero.ctaButtons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        : [],
    [hero?.ctaButtons]
  );

  if (loading && !hero) return <Skeleton />;
  if (!hero) return <Fallback />;

  const hasMedia = Boolean(hero.media?.url);
  const centred = !hasMedia;

  return (
    <Container>
      <AnimatePresence mode="wait">
        <motion.section
          key={hero._id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="relative w-full min-h-screen flex items-center bg-base-100"
          aria-label="Main Hero Campaign"
        >
          <Background />

          <div className="relative z-10 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-6 items-center">

              {/* ── Typographic Content ── */}
              <motion.div
                variants={variants.stagger}
                initial="hidden"
                animate="visible"
                className={`${
                  hasMedia
                    ? "lg:col-span-6"
                    : "lg:col-span-8 lg:col-start-3 text-center"
                } flex flex-col justify-center space-y-6 pt-8 lg:pt-0`}
              >
                {/* Micro-badge Announcement */}
                {hero.badge?.text && (
                  <motion.div
                    variants={variants.fadeUp}
                    className={`flex ${centred ? "justify-center" : "justify-center lg:justify-start"}`}
                  >
                    <div
                      className="inline-flex items-center badge-success gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-md"
                      role="status"
                    >
                      <span className="flex h-2 w-2 relative" aria-hidden="true">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                      {hero.badge.icon && (
                        <span className="text-sm leading-none select-none" aria-hidden="true">
                          {hero.badge.icon}
                        </span>
                      )}
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.14em]">
                        {hero.badge.text}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Main Value Proposition */}
                <motion.div variants={variants.fadeUp} className="space-y-4">
                  <h1 className="font-black leading-[1.08] tracking-tight  ">
                    {headlineNode}
                  </h1>

                  {(hero.subheadline || hero.description) && (
                    <div className={`max-w-xl mx-auto ${centred ? "" : "lg:mx-0"}`}>
                      {hero.subheadline && (
                        <p className="text-base font-semibold mb-1 text-primary">
                          {hero.subheadline}
                        </p>
                      )}
                      {hero.description && (
                        <p className="text-sm leading-relaxed font-medium text-base-content/60">
                          {hero.description}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* Call To Actions */}
                {sortedBtns.length > 0 && (
                  <motion.div
                    variants={variants.fadeUp}
                    className={`flex flex-wrap gap-3 pt-1 ${centred ? "justify-center" : "justify-center lg:justify-start"}`}
                  >
                    {sortedBtns.map((btn, i) => (
                      <CtaButton key={btn._id ?? i} btn={btn} />
                    ))}
                  </motion.div>
                )}

                {/* Social Proof */}
                <TrustRow priority={hero.priority} centred={centred} />
              </motion.div>

              {/* ── Visual Media Area ── */}
              {hasMedia && (
                <motion.div
                  variants={variants.fadeLeft}
                  initial="hidden"
                  animate="visible"
                  className="lg:col-span-6 hidden md:flex relative h-[560px] lg:h-[720px] w-full items-center justify-center lg:justify-end mt-8 lg:mt-0 [perspective:2000px]"
                >
                  <MediaCard
                    media={hero.media}
                    badge={hero.badge}
                    analyticsTag={hero.analyticsTag}
                    activeTo={hero.activeTo}
                  />
                </motion.div>
              )}

            </div>
          </div>

          {/* Scroll Hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2, duration: 0.5 }}
            className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10"
            aria-hidden="true"
          >
            <span className="text-[9px] uppercase tracking-[0.22em] font-semibold text-base-content/20">
              Scroll
            </span>
            <motion.div
              animate={reduceMotion ? {} : { y: [0, 6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown size={13} className="text-base-content/15" />
            </motion.div>
          </motion.div>

        </motion.section>
      </AnimatePresence>
    </Container>
  );
}