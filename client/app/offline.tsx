"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { WifiOff, RefreshCcw, Router, Signal, Globe } from "lucide-react";

// ── Animated Creature (CommsBot) ──────────────────────────────────────────────
const CommsBot = () => {
  return (
    <div className="relative w-48 h-48 mx-auto -mb-6 z-10 pointer-events-none" aria-hidden="true">
      
      {/* Background Glow */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 m-auto w-32 h-32 rounded-full bg-error/20 blur-xl"
      />

      {/* Bot Hover Animation */}
      <motion.div
        animate={{ y: [-6, 6, -6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="w-full h-full relative"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
          
          {/* Fading Radar Signal Pings */}
          {[1, 2, 3].map((wave) => (
            <motion.path
              key={wave}
              d="M75 25 Q100 5 125 25"
              stroke="var(--error)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ opacity: 0, y: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.6, 0], y: -20 - (wave * 5), scale: 1 + (wave * 0.1) }}
              transition={{ duration: 2, repeat: Infinity, delay: wave * 0.4, ease: "easeOut" }}
            />
          ))}

          {/* Rotating Radar Dish */}
          <motion.g
            animate={{ rotate: [-15, 15, -15] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "100px 50px" }}
          >
            <line x1="100" y1="65" x2="100" y2="45" stroke="var(--base-300)" strokeWidth="4" strokeLinecap="round" />
            <path d="M80 45 C80 30, 120 30, 120 45 Z" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="100" cy="40" r="3" fill="var(--error)" />
          </motion.g>

          {/* Main Body */}
          <rect x="65" y="65" width="70" height="60" rx="18" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="3" />
          
          {/* Visor Screen */}
          <rect x="75" y="78" width="50" height="24" rx="8" fill="var(--neutral)" />

          {/* "Searching" Scanner Eye */}
          <motion.circle
            r="4"
            fill="var(--error)"
            animate={{ cx: [85, 115, 85] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            cy="90"
            style={{ filter: "drop-shadow(0 0 4px var(--error))" }}
          />

          {/* Disconnected / Sad Details on body */}
          <path d="M80 115 h10 M110 115 h10" stroke="var(--base-300)" strokeWidth="2" strokeLinecap="round" />

          {/* Severed Dangling Cable */}
          <path d="M100 125 C100 150, 80 160, 95 180" stroke="var(--base-300)" strokeWidth="4" strokeLinecap="round" fill="none" />
          
          {/* Electrical Sparks falling from cable */}
          <motion.g
            animate={{ opacity: [0, 1, 0], y: [0, 10] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut", repeatDelay: 1.2 }}
          >
            <path d="M95 185 L92 192 L98 190 L94 198" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" fill="none" />
          </motion.g>

        </svg>
      </motion.div>

      {/* Floating WifiOff Badge */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }}
        className="absolute top-2 right-4 bg-error text-error-content p-2 rounded-[var(--r-box)] border-2 border-base-100 shadow-[0_4px_14px_var(--color-error)]"
      >
        <WifiOff size={16} aria-hidden="true" />
      </motion.div>
    </div>
  );
};


// ── Main Page Component ───────────────────────────────────────────────────────
const diagnostics = [
  { icon: Router, label: "Router Status", hint: "Restart your router" },
  { icon: Signal, label: "Signal Strength", hint: "Move closer to Wi-Fi" },
  { icon: Globe, label: "DNS Resolution", hint: "Check network settings" },
];

export default function NoInternetPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fallback timer just to ensure the UI feels "alive" while offline
  useEffect(() => {
    const id = setInterval(() => {}, 3000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => window.location.reload(), 1800);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-100 p-6 font-poppins transition-colors duration-300">
      <div className="max-w-[380px] w-full text-center relative z-10">

        {/* Animated Creature */}
        <CommsBot />

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-8 mt-2"
        >
          <h1 className="font-montserrat text-[clamp(1.6rem,5vw,2.2rem)] font-black text-base-content tracking-tight leading-[1.15] mb-2">
            Signal <span className="text-error">Lost</span>
          </h1>
          <p className="text-sm text-base-content/60 leading-relaxed max-w-[240px] mx-auto font-medium">
            Your connection has flatlined. Check your network to restore the signal.
          </p>
        </motion.div>

        {/* Retry Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-content border-none rounded-[var(--r-field)] font-poppins text-sm font-bold tracking-wider uppercase transition-all duration-200 shadow-[0_4px_16px_color-mix(in_srgb,var(--primary),transparent_60%)] ${
              isRefreshing ? "opacity-65 cursor-not-allowed" : "hover:brightness-110 active:scale-95"
            }`}
            aria-label="Retry connection"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.9, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCcw size={16} aria-hidden="true" />
            </motion.div>
            <span>{isRefreshing ? "Retrying…" : "Retry Connection"}</span>
          </button>
        </motion.div>

        {/* Offline Pill Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-base-200/30 border border-base-300 rounded-full mb-7 w-max mx-auto"
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-error"
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
            Offline Mode Active
          </span>
        </motion.div>

        {/* Diagnostics List */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="flex flex-col gap-2"
          role="list"
        >
          {diagnostics.map(({ icon: Icon, label, hint }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              whileHover={{ scale: 1.015 }}
              className="flex items-center justify-between p-3 px-4 bg-base-100 border border-base-300 rounded-[var(--r-box)] transition-all hover:border-primary/50 hover:shadow-[0_2px_12px_color-mix(in_srgb,var(--primary),transparent_82%)] group cursor-default"
              role="listitem"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[calc(var(--r-box)*0.6)] bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-content transition-colors">
                  <Icon size={14} aria-hidden="true" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-base-content m-0 leading-snug">
                    {label}
                  </p>
                  <p className="text-[10px] font-medium text-base-content/50 m-0 leading-snug">
                    {hint}
                  </p>
                </div>
              </div>

              {/* Animated status dots */}
              <div className="flex gap-1 items-center" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.25 + i * 0.15 }}
                    className="w-1.5 h-1.5 rounded-full bg-primary/30"
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-7 text-[10px] font-medium text-base-content/40 tracking-wider font-mono uppercase"
        >
          ERR_CONNECTION_LOST
        </motion.p>
      </div>
    </main>
  );
}