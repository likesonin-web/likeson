"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, RefreshCcw, ShieldAlert, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Container from '@/components/ui/Container';

const NoInternetPage = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate a check before re-establishing the "pulse"
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // The exact medical ECG path used for telemetry animations
  const ecgPath = "M0 40H60L70 10L85 70L100 40H125L135 25L145 55L155 40H240";

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-100 p-6 overflow-hidden transition-colors duration-300">
      <Container>
        <div className="max-w-md mx-auto text-center">
          
          {/* --- ANIMATED HEARTBEAT (ECG) SECTION --- */}
          <div className="relative flex justify-center mb-16 scale-110 md:scale-125">
            <svg 
              width="240" 
              height="80" 
              viewBox="0 0 240 80" 
              fill="none" 
              className="drop-shadow-[0_0_15px_rgba(var(--primary),0.2)]"
            >
              {/* Background "Flatline" Reference */}
              <path
                d={ecgPath}
                stroke="var(--color-base-300)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-50"
              />
              
              {/* Animated Glowing Pulse Line - Primary Color */}
              <motion.path
                d={ecgPath}
                stroke="var(--color-primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: [0, 0.3, 0],
                  pathOffset: [0, 1.2],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />

              {/* Glowing Telemetry Dot */}
              <motion.circle
                r="4"
                fill="var(--color-primary)"
                initial={{ offsetDistance: "0%" }}
                animate={{ offsetDistance: "100%" }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{
                  offsetPath: `path('${ecgPath}')`,
                  filter: "drop-shadow(0 0 8px var(--color-primary))"
                }}
              />
            </svg>

            {/* Floating Warning Badge - Accent Color */}
            <motion.div 
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="absolute -top-6 right-[10%] bg-accent text-white p-3.5 rounded-2xl shadow-2xl border-4 border-base-100"
            >
              <WifiOff size={24} />
            </motion.div>
          </div>

          {/* --- TEXT CONTENT --- */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h1 className="text-4xl md:text-5xl font-black text-base-content tracking-tighter uppercase leading-none">
              Pulse <br /> <span className="text-primary">Interrupted.</span>
            </h1>
            <p className="text-base-content/50 text-sm md:text-base mb-10 leading-relaxed font-black uppercase tracking-tight max-w-xs mx-auto">
              Your connection has flatlined. Please verify network status to continue.
            </p>
          </motion.div>

          {/* --- ACTION BUTTONS --- */}
          <div className="flex flex-col gap-5 mt-10">
            <Button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-primary-cta h-16 text-[11px] font-black uppercase tracking-[0.25em] shadow-xl shadow-primary/20"
            >
              <div className="flex items-center justify-center gap-3">
                <motion.div
                  animate={isRefreshing ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
                >
                  <RefreshCcw className="w-5 h-5" />
                </motion.div>
                <span>{isRefreshing ? "Re-establishing Pulse..." : "Retry Connection"}</span>
              </div>
            </Button>

            <div className="flex items-center justify-center gap-3 py-3 px-6 bg-base-200 border border-base-300 rounded-full">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--color-accent)]" />
              <ShieldAlert size={14} className="text-accent" />
              <span className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                Secure Offline Protocol Active
              </span>
            </div>
          </div>

          {/* --- DIAGNOSTIC TIPS (Surgical Glass) --- */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 space-y-3"
          >
            {[
              "Verify Wi-Fi or Cellular data status",
              "Restart router or toggle Airplane mode",
              "Check secondary connection nodes"
            ].map((tip, i) => (
              <motion.div 
                key={i} 
                whileHover={{ x: 8 }}
                className="glass-card flex items-center justify-between p-5 text-left group cursor-default border border-base-300 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-primary group-hover:scale-150 transition-all duration-300" />
                  <span className="text-[10px] font-black text-base-content/70 uppercase tracking-widest">{tip}</span>
                </div>
                <ChevronRight size={14} className="text-base-content/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Container>
    </main>
  );
};

export default NoInternetPage;