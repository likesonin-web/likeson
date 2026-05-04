"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCcw, Router, Signal, Globe } from "lucide-react";

const ecgPath = "M0 35H35L48 8L58 62L68 35H95L108 20L118 50L128 35H190";

const diagnostics = [
  { icon: Router, label: "Router Status", hint: "Restart your router" },
  { icon: Signal, label: "Signal Strength", hint: "Move closer to Wi-Fi" },
  { icon: Globe, label: "DNS Resolution", hint: "Check network settings" },
];

export default function NoInternetPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => window.location.reload(), 1800);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--base-100)",
        padding: "1.5rem",
        fontFamily: "var(--font-family-poppins, sans-serif)",
        transition: "background-color 0.3s ease",
      }}
    >
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>

        {/* ── ECG + Icon cluster ── */}
        <div style={{ position: "relative", display: "flex", justifyContent: "center", marginBottom: "2.5rem" }}>

          {/* Faint glow disc */}
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.12, 0.22, 0.12] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: 0,
              margin: "auto",
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <svg width="200" height="70" viewBox="0 0 190 70" fill="none" style={{ position: "relative", zIndex: 1 }}>
            {/* Ghost trace */}
            <path d={ecgPath} stroke="var(--base-300)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

            {/* Animated primary trace */}
            <motion.path
              d={ecgPath}
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: [0, 0.45, 0],
                pathOffset: [0, 1.15],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
            />

            {/* Dot rider */}
            <motion.circle
              r="3.5"
              fill="var(--primary)"
              initial={{ offsetDistance: "0%" }}
              animate={{ offsetDistance: "100%" }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
              style={{
                offsetPath: `path('${ecgPath}')`,
                filter: "drop-shadow(0 0 6px var(--primary))",
              }}
            />
          </svg>

          {/* WifiOff badge */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }}
            style={{
              position: "absolute",
              top: -8,
              right: "8%",
              backgroundColor: "var(--accent)",
              color: "var(--accent-content)",
              padding: "0.45rem",
              borderRadius: "var(--r-box, 1rem)",
              border: "2px solid var(--base-100)",
              boxShadow: "0 4px 14px color-mix(in srgb, var(--accent), transparent 55%)",
              display: "flex",
            }}
          >
            <WifiOff size={18} />
          </motion.div>
        </div>

        {/* ── Headline ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{ marginBottom: "2rem" }}
        >
          <h1
            style={{
              fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
              fontWeight: 800,
              fontFamily: "var(--font-family-montserrat, sans-serif)",
              color: "var(--base-content)",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              margin: "0 0 0.5rem",
            }}
          >
            Pulse{" "}
            <span style={{ color: "var(--primary)" }}>Interrupted</span>
          </h1>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "color-mix(in oklch, var(--base-content) 55%, transparent)",
              lineHeight: 1.65,
              maxWidth: 240,
              margin: "0 auto",
            }}
          >
            Your connection has flatlined. Check your network to restore the signal.
          </p>
        </motion.div>

        {/* ── Retry button ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ marginBottom: "0.875rem" }}
        >
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              width: "100%",
              height: "3rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              backgroundColor: "var(--primary)",
              color: "var(--primary-content)",
              border: "none",
              borderRadius: "var(--r-field, 0.5rem)",
              fontFamily: "var(--font-family-poppins, sans-serif)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              opacity: isRefreshing ? 0.65 : 1,
              boxShadow: "0 4px 16px color-mix(in srgb, var(--primary), transparent 60%)",
              transition: "filter 0.2s, transform 0.15s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => { if (!isRefreshing) e.currentTarget.style.filter = "brightness(1.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.96)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.9, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCcw size={16} />
            </motion.div>
            <span>{isRefreshing ? "Retrying…" : "Retry Connection"}</span>
          </button>
        </motion.div>

        {/* ── Offline pill ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            backgroundColor: "color-mix(in srgb, var(--base-200), transparent 30%)",
            border: "1px solid var(--base-300)",
            borderRadius: "9999px",
            marginBottom: "1.75rem",
          }}
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: "var(--accent)",
            }}
          />
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "color-mix(in oklch, var(--base-content) 50%, transparent)",
            }}
          >
            Offline Mode Active
          </span>
        </motion.div>

        {/* ── Diagnostics list ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {diagnostics.map(({ icon: Icon, label, hint }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.7rem 0.9rem",
                backgroundColor: "var(--base-100)",
                border: "1px solid var(--base-300)",
                borderRadius: "var(--r-box, 1rem)",
                cursor: "default",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              whileHover={{
                borderColor: "color-mix(in srgb, var(--primary), transparent 55%)",
                boxShadow: "0 2px 12px color-mix(in srgb, var(--primary), transparent 82%)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "calc(var(--r-box, 1rem) * 0.6)",
                    backgroundColor: "color-mix(in srgb, var(--primary), transparent 88%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--base-content)", margin: 0, lineHeight: 1.3 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: "0.625rem", color: "color-mix(in oklch, var(--base-content) 45%, transparent)", margin: 0, lineHeight: 1.3 }}>
                    {hint}
                  </p>
                </div>
              </div>

              {/* Animated status dots */}
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: d * 0.25 + i * 0.15,
                    }}
                    style={{
                      display: "inline-block",
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: "color-mix(in srgb, var(--primary), transparent 30%)",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Footer note ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          style={{
            marginTop: "1.75rem",
            fontSize: "0.625rem",
            color: "color-mix(in oklch, var(--base-content) 35%, transparent)",
            letterSpacing: "0.04em",
          }}
        >
          Error code: NET::ERR_CONNECTION_LOST
        </motion.p>
      </div>
    </main>
  );
}