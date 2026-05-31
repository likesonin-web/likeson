"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Activity, Home, Stethoscope, Pill, Microscope } from 'lucide-react';

// ── Animated Creature (MediBot) ──────────────────────────────────────────────
const MediBot = () => {
  return (
    <div className="relative w-48 h-48 mx-auto -mb-8 z-30 pointer-events-none" aria-hidden="true">
      {/* Bot Hover Animation */}
      <motion.div
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="w-full h-full relative"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
          {/* Scanning Beam (Fades in and out) */}
          <motion.path
            d="M100 120 L20 250 L180 250 Z"
            fill="url(#scan-gradient)"
            animate={{ opacity: [0, 0.4, 0], scaleX: [0.8, 1.2, 0.8] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: 'top center' }}
          />

          {/* Antenna */}
          <line x1="100" y1="40" x2="100" y2="20" stroke="var(--base-300)" strokeWidth="4" strokeLinecap="round" />
          <motion.circle 
            cx="100" cy="20" r="4" 
            fill="var(--accent)" 
            animate={{ opacity: [1, 0.2, 1] }} 
            transition={{ duration: 1.5, repeat: Infinity }} 
          />

          {/* Head / Body Base */}
          <rect x="60" y="40" width="80" height="70" rx="24" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="3" />
          
          {/* Visor */}
          <rect x="70" y="55" width="60" height="28" rx="10" fill="var(--neutral)" />

          {/* Animated Eyes */}
          <motion.g
            animate={{ x: [-4, 4, 4, -4, -4] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Blinking Logic */}
            <motion.g
              animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
              transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
              style={{ transformOrigin: 'center' }}
            >
              <circle cx="88" cy="69" r="4" fill="var(--primary)" />
              <circle cx="112" cy="69" r="4" fill="var(--primary)" />
            </motion.g>
          </motion.g>

          {/* Cute little medical cross on chest */}
          <path d="M96 125 h8 v-8 h-8 v8 z M92 121 h16 v-2 h-16 v2 z" fill="var(--error)" />
          
          {/* Floating Thrusters */}
          <path d="M85 110 Q100 130 115 110" stroke="var(--base-300)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <motion.circle 
            cx="100" cy="125" r="5" 
            fill="var(--primary)"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="scan-gradient" x1="100" y1="120" x2="100" y2="250" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
};


// ── 404 Page Component ────────────────────────────────────────────────────────
const NotFound = () => {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-base-100 overflow-hidden transition-colors duration-300 font-sans">
      
      {/* --- PREMIUM BACKGROUND ANIMATIONS --- */}
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        {/* Breathing Medical Glow */}
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] min-w-[500px] min-h-[500px] bg-primary/10 rounded-full blur-[100px]"
        />

        {/* Floating Telemetry Elements */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: 0, opacity: 0 }}
            animate={{ 
              y: [-40, 40, -40],
              opacity: [0, 0.15, 0],
              x: i % 2 === 0 ? i * 150 - 200 : i * -150 + 100
            }}
            transition={{ 
              duration: 7 + i * 1.5, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: i * 1.2 
            }}
            className="absolute top-1/3 left-1/2 text-primary"
          >
            <Activity size={40 + i * 10} strokeWidth={1} />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 container-custom max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center text-center">
          
          {/* Animated Diagnostic Bot */}
          <MediBot />

          {/* Main 404 Typography */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative"
          >
            <motion.h1 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="font-montserrat text-[10rem] md:text-[14rem] lg:text-[16rem] font-black leading-none tracking-tighter text-transparent bg-clip-text select-none"
              style={{ backgroundImage: "linear-gradient(180deg, var(--primary) 0%, color-mix(in srgb, var(--primary), transparent 90%) 100%)" }}
            >
              404
            </motion.h1>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-[-2rem] md:mt-[-4rem] relative z-20"
            >
              <h2 className="font-montserrat text-3xl md:text-5xl lg:text-6xl font-black text-base-content mb-4 tracking-tight leading-none">
                Lost in <span className="text-primary">The Clinic?</span>
              </h2>
              <p className="font-poppins text-base-content/60 text-sm md:text-base max-w-md mx-auto mb-10 leading-relaxed font-medium">
                The heartbeat of this page seems to have faded. Don&apos;t worry, our diagnostic bot is here to guide you back to safety.
              </p>
            </motion.div>
          </motion.div>

          {/* Staggered Actions & Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col gap-10 items-center w-full"
          >
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-center">
              <Link href="/" className="w-full sm:w-auto" aria-label="Return to Homepage">
                <button className="btn btn-outline w-full sm:w-auto h-14 px-8 font-poppins font-bold text-xs uppercase tracking-wider rounded-[var(--r-field)] group">
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                  Return Home
                </button>
              </Link>

              <Link href="/search" className="w-full sm:w-auto" aria-label="Search Medical Services">
                <button className="btn-primary-cta w-full sm:w-auto h-14 px-8 font-poppins text-xs uppercase tracking-wider shadow-primary/20 hover:shadow-primary/40 flex items-center justify-center group">
                  <Search className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" aria-hidden="true" />
                  Search Services
                </button>
              </Link>
            </div>

            {/* Quick Links Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
              {[
                { name: 'Dashboard', icon: Home, href: '/dashboard' },
                { name: 'Doctors', icon: Stethoscope, href: '/doctors' },
                { name: 'Pharmacy', icon: Pill, href: '/pharmacy' },
                { name: 'Lab Tests', icon: Microscope, href: '/diagnostics' }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.name}
                    whileHover={{ y: -4, scale: 1.02 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + idx * 0.1 }}
                  >
                    <Link 
                      href={item.href}
                      className="glass-card flex flex-col items-center justify-center p-5 text-center gap-2 font-poppins text-xs font-bold text-base-content/70 hover:text-primary transition-all shadow-sm border border-base-300 rounded-[var(--r-box)] h-full"
                    >
                      <Icon className="w-5 h-5 text-primary/70 mb-1" aria-hidden="true" />
                      {item.name}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Trust Indicator */}
            <div className="flex items-center gap-3 px-5 py-2.5 bg-base-200 border border-base-300 rounded-full shadow-sm mt-4">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_var(--color-success)]" aria-hidden="true" />
              <span className="font-poppins text-[10px] font-bold text-base-content/60 uppercase tracking-widest">
                System Online • Navigational Assist Active
              </span>
            </div>
          </motion.div>

        </div>
      </div>
    </main>
  );
};

export default NotFound;