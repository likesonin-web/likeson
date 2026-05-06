"use client";

import React, { useCallback, memo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Stethoscope, Ambulance, HeartHandshake, Pill,
  Microscope, Zap, Activity, CheckCircle2,
  ArrowUpRight, ChevronRight, Sparkles,
} from "lucide-react";

const BOOK = (type) => `/book-appointment?type=${type}`;
const HOW_IT_WORKS = "/how-it-works";

const SERVICES_DATA = [
  {
    id: "full_care_ride", title: "Full Care Ride",
    tagline: "Door-to-door with a dedicated care assistant",
    description: "13-step care journey — verified assistant, GPS-tracked vehicle, medicines collected en route, safe return confirmed.",
    icon: Ambulance, href: BOOK("full_care_ride"), storyHref: `${HOW_IT_WORKS}#full-care-ride`,
    palette: { glow: "rgba(249,115,22,0.32)", border: "rgba(249,115,22,0.5)", text: "#f97316", light: "rgba(249,115,22,0.10)" },
    badge: "Most Popular",
    features: ["13-Step Care Journey", "Live GPS Tracking", "En-Route Pharmacy", "Safe Return Confirmed"],
  },
  {
    id: "doctor_consultation", title: "Doctor Consultation",
    tagline: "In-person visit at hospital or clinic",
    description: "Book board-certified specialists for in-person visits, home visits, or scheduled clinic appointments.",
    icon: Stethoscope, href: BOOK("doctor_consultation"), storyHref: `${HOW_IT_WORKS}#doctor-consultation`,
    palette: { glow: "rgba(14,165,233,0.32)", border: "rgba(14,165,233,0.5)", text: "#0ea5e9", light: "rgba(14,165,233,0.10)" },
    features: ["Choose Hospital & Doctor", "In-Person & Home Visits", "Digital Prescriptions", "Follow-Up Tracking"],
  },
  {
    id: "doctor_online", title: "Online Consultation",
    tagline: "Video call with your doctor from anywhere",
    description: "Video or audio appointments — ideal for NRIs managing parents remotely, follow-ups, and chronic care.",
    icon: Zap, href: BOOK("doctor_online"), storyHref: `${HOW_IT_WORKS}#doctor-online`,
    palette: { glow: "rgba(139,92,246,0.32)", border: "rgba(139,92,246,0.5)", text: "#8b5cf6", light: "rgba(139,92,246,0.10)" },
    badge: "NRI Friendly",
    features: ["24/7 Video & Audio", "Upload Patient History", "Instant Confirmation", "NRI-Friendly Scheduling"],
  },
  {
    id: "physiotherapist", title: "Physiotherapy",
    tagline: "Clinic or home session by a certified therapist",
    description: "Post-surgical recovery, mobility support, chronic pain — certified physio sessions at clinic or your home.",
    icon: Activity, href: BOOK("physiotherapist"), storyHref: `${HOW_IT_WORKS}#physiotherapist`,
    palette: { glow: "rgba(239,68,68,0.32)", border: "rgba(239,68,68,0.5)", text: "#ef4444", light: "rgba(239,68,68,0.10)" },
    features: ["Certified Physiotherapists", "Clinic or Home Visit", "Post-Surgery Recovery", "Auto Follow-Up Reminders"],
  },
  {
    id: "care_assistant", title: "Care Assistant",
    tagline: "Background-verified professional at your side",
    description: "Verified care assistants who escort patients, manage queues, handle billing — so no one faces a hospital alone.",
    icon: HeartHandshake, href: BOOK("care_assistant"), storyHref: `${HOW_IT_WORKS}#care-assistant`,
    palette: { glow: "rgba(16,185,129,0.32)", border: "rgba(16,185,129,0.5)", text: "#10b981", light: "rgba(16,185,129,0.10)" },
    features: ["Queue Management", "Billing Assistance", "Elderly Companionship", "Medication Reminders"],
  },
  {
    id: "diagnostic_home", title: "Home Diagnostics",
    tagline: "Lab technician at your doorstep",
    description: "NABL-accredited lab tests with home sample collection. Digital reports delivered to your dashboard in 6-48 hrs.",
    icon: Microscope, href: BOOK("diagnostic_home"), storyHref: `${HOW_IT_WORKS}#diagnostics`,
    palette: { glow: "rgba(6,182,212,0.32)", border: "rgba(6,182,212,0.5)", text: "#06b6d4", light: "rgba(6,182,212,0.10)" },
    badge: "Home Visit",
    features: ["NABL Accredited Labs", "Home Sample Collection", "Reports in 6-48 hrs", "Full Body Packages"],
  },
  {
    id: "pharmacy", title: "Pharmacy Delivery",
    tagline: "Verified medicines, delivered fast",
    description: "Express delivery with cold-chain maintenance — including auto-refill plans for chronic patients.",
    icon: Pill, href: BOOK("pharmacy"), storyHref: `${HOW_IT_WORKS}#pharmacy`,
    palette: { glow: "rgba(245,158,11,0.32)", border: "rgba(245,158,11,0.5)", text: "#f59e0b", light: "rgba(245,158,11,0.10)" },
    features: ["2-Hour Express Delivery", "Cold-Chain Maintained", "Auto-Refill Chronic", "Prescription Digitization"],
  },
];

const SpotlightCard = memo(({ service, index }) => {
  const Icon = service.icon;
  const cardRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  // Spotlight only - removed tilt calculations
  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--spot-x", x + "px");
    el.style.setProperty("--spot-y", y + "px");
  }, []);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const { palette } = service;

  return (
    <motion.li
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      // Card remains static (scale only), no rotateX or rotateY
      animate={{ scale: hovered ? 1.015 : 1 }}
      style={{ listStyle: "none", "--spot-x": "50%", "--spot-y": "50%" }}
      className="relative rounded-2xl will-change-transform"
      aria-labelledby={"svc-title-" + service.id}
    >
      {/* Glow border */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{
          boxShadow: hovered
            ? "0 0 0 1.5px " + palette.border + ", 0 20px 56px -10px " + palette.glow + ", 0 6px 18px -4px " + palette.glow
            : "0 0 0 1px var(--base-300), 0 4px 12px -4px rgba(0,0,0,0.06)",
        }}
        transition={{ duration: 0.3 }}
      />

      <div className="relative h-full rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--base-100)" }}>
        {/* Spotlight overlay */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
          style={{
            opacity: hovered ? 1 : 0,
            background: "radial-gradient(180px circle at var(--spot-x) var(--spot-y), " + palette.glow + ", transparent 80%)",
          }}
        />

        <div className="relative z-10 flex flex-col flex-1 p-7">
          {/* Header */}
          <div className="flex items-start justify-between mb-7">
            <motion.div
              animate={{ scale: hovered ? 1.1 : 1, rotate: hovered ? 5 : 0 }}
              transition={{ duration: 0.3 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
              style={{
                background: hovered ? palette.light : "var(--base-200)",
                boxShadow: hovered ? "0 0 16px " + palette.glow : "none",
              }}
            >
              <Icon size={26} style={{ color: palette.text }} strokeWidth={1.6} />
            </motion.div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {service.badge && (
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: palette.light, color: palette.text, border: "1px solid " + palette.border, fontFamily: "'Poppins', sans-serif" }}
                >
                  {service.badge}
                </span>
              )}
              <Link
                href={service.storyHref}
                className="w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ borderColor: "var(--base-300)", color: "var(--base-content)", opacity: 0.4 }}
                aria-label={"How " + service.title + " works"}
              >
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          {/* Text */}
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1.5"
              style={{ color: palette.text, fontFamily: "'Poppins', sans-serif" }}>
              {service.tagline}
            </p>
            <h2
              id={"svc-title-" + service.id}
              className="text-[1.3rem] font-black leading-tight tracking-tight mb-3"
              style={{ fontFamily: "'Montserrat', sans-serif", color: "var(--base-content)" }}
            >
              {service.title}
            </h2>
            <p className="text-sm leading-relaxed"
              style={{ color: "var(--base-content)", opacity: 0.55, fontFamily: "'Poppins', sans-serif" }}>
              {service.description}
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-7 mt-auto">
            {service.features.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-300"
                style={{
                  background: hovered ? palette.light : "var(--base-200)",
                  color: hovered ? palette.text : "var(--base-content)",
                  border: "1px solid " + (hovered ? palette.border : "var(--base-300)"),
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <CheckCircle2 size={10} style={{ flexShrink: 0 }} />
                {f}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Link href={service.href} aria-label={"Book " + service.title}>
            <motion.div
              className="relative w-full flex items-center justify-between px-5 py-3.5 rounded-xl overflow-hidden font-black text-sm cursor-pointer"
              style={{ fontFamily: "'Poppins', sans-serif" }}
              animate={{ background: hovered ? palette.text : "var(--base-200)", color: hovered ? "#ffffff" : palette.text }}
              transition={{ duration: 0.28 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span>Book Now</span>
              <motion.span animate={{ x: hovered ? 3 : 0 }} transition={{ duration: 0.22 }}>
                <ArrowUpRight size={16} />
              </motion.span>
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.li>
  );
});
SpotlightCard.displayName = "SpotlightCard";

const AmbientBG = memo(() => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div className="absolute top-[-15%] right-[-8%] w-[700px] h-[700px] rounded-full blur-[140px]" style={{ background: "rgba(14,165,233,0.05)" }} />
    <div className="absolute bottom-[-10%] left-[-8%] w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: "rgba(16,185,129,0.05)" }} />
    <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: "rgba(139,92,246,0.04)" }} />
  </div>
));
AmbientBG.displayName = "AmbientBG";

const SectionHeader = memo(() => (
  <motion.header
    className="max-w-3xl mb-20"
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
  >
    <div className="flex items-center gap-3 mb-6">
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] border"
        style={{ background: "rgba(14,165,233,0.08)", borderColor: "rgba(14,165,233,0.25)", color: "#0ea5e9", fontFamily: "'Poppins', sans-serif" }}>
        <Sparkles size={11} />
        Our Services
      </div>
    </div>
    <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.08] mb-6"
      style={{ fontFamily: "'Montserrat', sans-serif", color: "var(--base-content)" }}>
      Modern Healthcare,{" "}
      <br className="hidden sm:block" />
      <span className="text-gradient-primary">Right at Your Door.</span>
    </h2>
    <p className="text-base md:text-lg leading-relaxed mb-8 max-w-xl"
      style={{ color: "var(--base-content)", opacity: 0.6, fontFamily: "'Poppins', sans-serif" }}>
      <strong style={{ color: "var(--base-content)", opacity: 1 }}>Likeson.in</strong> brings{" "}
      <span style={{ color: "var(--primary)", fontWeight: 700 }}>expert doctors</span> and{" "}
      <span style={{ color: "var(--primary)", fontWeight: 700 }}>essential medical services</span>{" "}
      directly to your home. Skip the waiting rooms — book below.
    </p>
    <Link href={HOW_IT_WORKS}
      className="inline-flex items-center gap-2 text-sm font-bold transition-all duration-300 hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
      style={{ color: "var(--primary)", fontFamily: "'Poppins', sans-serif" }}>
      See how each service works
      <ArrowUpRight size={15} />
    </Link>
  </motion.header>
));
SectionHeader.displayName = "SectionHeader";

const BottomCTA = memo(() => (
  <motion.div
    className="mt-20 relative rounded-3xl overflow-hidden"
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)" }}
  >
    <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-10">
      <div>
        <p className="text-white/60 text-sm font-semibold mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Not sure which service you need?
        </p>
        <p className="text-white text-xl font-black tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Talk to our care team — we'll guide you.
        </p>
      </div>
      <Link href="/contact" aria-label="Contact the Likeson.in team">
        <motion.div
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-black text-sm whitespace-nowrap cursor-pointer"
          style={{ background: "rgba(255,255,255,0.18)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.35)", backdropFilter: "blur(12px)", fontFamily: "'Poppins', sans-serif" }}
        >
          Talk to Our Team
          <ChevronRight size={16} />
        </motion.div>
      </Link>
    </div>
  </motion.div>
));
BottomCTA.displayName = "BottomCTA";

const Services = memo(() => (
  <section id="services" className="relative min-h-screen bg-base-100 text-base-content overflow-hidden" aria-labelledby="services-heading">
    <AmbientBG />
    <div className="relative z-10 container-custom py-24 lg:py-32">
      <SectionHeader />
      <ul className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" aria-label="Likeson.in healthcare services">
        {SERVICES_DATA.map((service, i) => (
          <SpotlightCard key={service.id} service={service} index={i} />
        ))}
      </ul>
      <BottomCTA />
    </div>
  </section>
));
Services.displayName = "Services";
export default Services;