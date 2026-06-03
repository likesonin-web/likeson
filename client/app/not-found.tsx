"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Activity, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Container from '../components/ui/Container';

const NotFound = () => {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-base-100 overflow-hidden transition-colors duration-300">
      
      {/* --- PREMIUM BACKGROUND ANIMATIONS --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Breathing Medical Glow - Uses Primary Trust Blue */}
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1] 
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px]"
        />

        {/* Floating Telemetry Icons */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: 0, opacity: 0 }}
            animate={{ 
              y: [-30, 30, -30],
              opacity: [0, 0.15, 0],
              x: i * 150 - 150
            }}
            transition={{ 
              duration: 6 + i, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: i * 2 
            }}
            className="absolute top-1/4 left-1/2 text-primary"
          >
            <Activity size={60 + i * 20} strokeWidth={0.5} />
          </motion.div>
        ))}
      </div>

      <Container className="relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          
          {/* Main 404 Hero Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.h1 
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="text-[12rem] md:text-[18rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-primary to-primary/5 select-none"
            >
              404
            </motion.h1>
            
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-[-3rem] md:mt-[-5rem] relative z-20"
            >
              <h2 className="text-4xl md:text-6xl font-black text-base-content mb-4 tracking-tighter uppercase leading-none">
                Lost in <br className="md:hidden" /> <span className="text-primary">The Clinic?</span>
              </h2>
              <p className="text-base-content/50 text-sm md:text-base max-w-md mx-auto mb-12 leading-relaxed font-black uppercase tracking-tight">
                The heartbeat of this page seems to have faded. Let's get you back to your medical continuity plan.
              </p>
            </motion.div>
          </motion.div>

          {/* Staggered Content Container */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col gap-10 items-center"
          >
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-5 w-full justify-center">
              <Link href="/" className="w-full sm:w-auto">
                <Button 
                  variant="outline"
                  className="group relative w-full sm:w-auto h-16 px-12 rounded-field border-2 border-primary/20 text-primary font-black uppercase tracking-[0.2em] text-[11px] overflow-hidden transition-all hover:bg-primary/5 active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4 mr-3 group-hover:-translate-x-2 transition-transform" />
                  Return Home
                  <span className="absolute bottom-0 left-0 w-full h-1 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </Button>
              </Link>

              <Link href="/search" className="w-full sm:w-auto">
                <Button className="btn-primary-cta w-full sm:w-auto h-16 px-12 uppercase tracking-[0.2em] font-black text-[11px] shadow-xl shadow-primary/20">
                  <Search className="w-4 h-4 mr-3" />
                  Search Services
                </Button>
              </Link>
            </div>

            {/* Quick Links Grid - Surgical Glass */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl mt-4 px-4">
              {[
                { name: 'Doctors', href: '/doctors' },
                { name: 'Medicines', href: '/pharmacy' },
                { name: 'Lab Tests', href: '/diagnostics' },
                { name: 'Support', href: '/contact' }
              ].map((item, idx) => (
                <motion.div
                  key={item.name}
                  whileHover={{ y: -8, scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + idx * 0.1 }}
                >
                  <Link 
                    href={item.href}
                    className="glass-card flex items-center justify-center p-6 text-[10px] font-black text-base-content/80 uppercase tracking-[0.2em] hover:text-primary transition-all shadow-sm border border-base-300"
                  >
                    {item.name}
                  </Link>
                </motion.div>
              ))}
            </div>
            
            {/* Trust Indicator */}
            <div className="flex items-center gap-4 px-6 py-2.5 bg-base-200 border border-base-300 rounded-full">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--color-accent)]" />
                <span className="text-[10px] font-black text-base-content/40 uppercase tracking-[0.25em]">
                  24/7 Assistance Protocol Active
                </span>
              </div>
            </div>
          </motion.div>

        </div>
      </Container>
    </main>
  );
};

export default NotFound;