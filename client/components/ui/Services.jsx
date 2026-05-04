"use client";

/**
 * Services.jsx — Likeson.in Services Grid
 * Corrected: now links to story routes, expanded to 7 services matching
 * the project document and StoryPage routes.
 * Performance: React.memo, useCallback, framer-motion only for hover spotlight.
 */

import React, { useCallback, memo } from "react";
import Link from "next/link";
import {
  Stethoscope,
  Ambulance,
  HeartHandshake,
  Pill,
  Microscope,
  Zap,
  Activity,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// Import routes from StoryPage — single source of truth.
// Adjust this import path to match your project structure.
// import { SERVICE_ROUTES } from "@/app/(pages)/story/StoryPage";

// ─── Route Constants (mirrors StoryPage.SERVICE_ROUTES) ───────────────────────
const SERVICE_ROUTES = {
  fullCareRide: "/services/full-care-ride",
  doctorConsultation: "/services/doctor-consultation",
  doctorOnline: "/services/doctor-online",
  physiotherapist: "/services/physiotherapist",
  careAssistant: "/services/care-assistant",
  diagnostics: "/services/diagnostics",
  pharmacy: "/services/pharmacy",
  transport: "/services/transport",
  followUp: "/services/follow-up",
  bloodBank: "/services/blood-bank",
  storyPage: "/how-it-works",   // ← full StoryPage route
};

// ─── Services Data ─────────────────────────────────────────────────────────────
// 7 services matching the project DPR and mind-map exactly.
const SERVICES_DATA = [
  {
    id: "full-care-ride",
    title: "Full Care Ride",
    description:
      "Complete door-to-hospital-and-back experience with a verified care assistant, GPS-tracked vehicle, and 13-step care journey.",
    icon: Ambulance,
    href: SERVICE_ROUTES.fullCareRide,
    storyHref: `${SERVICE_ROUTES.storyPage}#full-care-ride`,
    cssVar: "--warning",
    styleMap: {
      bg: "bg-warning/15",
      text: "text-warning",
      hoverBorder: "group-hover:border-warning/50",
      hoverText: "group-hover:text-warning",
    },
    features: [
      "13-Step Care Journey",
      "Live GPS Vehicle Tracking",
      "Care Assistant Included",
      "Medicines Collected En Route",
      "Safe Return Confirmation",
    ],
    badge: "Most Popular",
  },
  {
    id: "doctor-consultation",
    title: "Doctor Consultations",
    description:
      "Connect with board-certified specialists for in-person hospital visits, home visits, or scheduled clinic appointments.",
    icon: Stethoscope,
    href: SERVICE_ROUTES.doctorConsultation,
    storyHref: `${SERVICE_ROUTES.storyPage}#doctor-consultation`,
    cssVar: "--info",
    styleMap: {
      bg: "bg-info/15",
      text: "text-info",
      hoverBorder: "group-hover:border-info/50",
      hoverText: "group-hover:text-info",
    },
    features: [
      "In-Person & Home Visits",
      "Choose Specialization & Hospital",
      "Digital Prescription Management",
      "Specialist Referrals",
      "Follow-up Care Tracking",
    ],
  },
  {
    id: "doctor-online",
    title: "Online Consultation",
    description:
      "Video or audio appointments with qualified doctors — ideal for NRIs managing parents remotely, follow-ups, and chronic care.",
    icon: Zap,
    href: SERVICE_ROUTES.doctorOnline,
    storyHref: `${SERVICE_ROUTES.storyPage}#doctor-online`,
    cssVar: "--primary",
    styleMap: {
      bg: "bg-primary/15",
      text: "text-primary",
      hoverBorder: "group-hover:border-primary/50",
      hoverText: "group-hover:text-primary",
    },
    features: [
      "24/7 Video & Audio Calls",
      "Upload Patient History",
      "Likeson Chatbot Link",
      "NRI-Friendly Scheduling",
      "Instant Booking Confirmation",
    ],
  },
  {
    id: "physiotherapist",
    title: "Physiotherapist",
    description:
      "Certified physiotherapy sessions at the clinic or in the comfort of your home — ideal for post-surgical recovery and mobility support.",
    icon: Activity,
    href: SERVICE_ROUTES.physiotherapist,
    storyHref: `${SERVICE_ROUTES.storyPage}#physiotherapist`,
    cssVar: "--error",
    styleMap: {
      bg: "bg-error/15",
      text: "text-error",
      hoverBorder: "group-hover:border-error/50",
      hoverText: "group-hover:text-error",
    },
    features: [
      "Clinic or Home Visit",
      "Certified Physiotherapists",
      "Post-Surgical Recovery",
      "Mobility & Pain Management",
      "Automated Follow-up Reminders",
    ],
  },
  {
    id: "care-assistant",
    title: "Care Assistants",
    description:
      "Background-verified professionals who escort patients, manage queues, handle billing, and ensure safe return — so no one faces a hospital alone.",
    icon: HeartHandshake,
    href: SERVICE_ROUTES.careAssistant,
    storyHref: `${SERVICE_ROUTES.storyPage}#care-assistant`,
    cssVar: "--success",
    styleMap: {
      bg: "bg-success/15",
      text: "text-success",
      hoverBorder: "group-hover:border-success/50",
      hoverText: "group-hover:text-success",
    },
    features: [
      "Hospital Queue Management",
      "Billing & Admin Assistance",
      "Elderly Companionship",
      "Post-Surgical Support",
      "Medication Reminders",
    ],
  },
  {
    id: "diagnostics",
    title: "Diagnostic Services",
    description:
      "NABL-accredited lab tests with home sample collection and digital reports delivered straight to your patient dashboard.",
    icon: Microscope,
    href: SERVICE_ROUTES.diagnostics,
    storyHref: `${SERVICE_ROUTES.storyPage}#diagnostics`,
    cssVar: "--secondary",
    styleMap: {
      bg: "bg-secondary/15",
      text: "text-secondary",
      hoverBorder: "group-hover:border-secondary/50",
      hoverText: "group-hover:text-secondary",
    },
    features: [
      "NABL Accredited Partners",
      "Home Sample Collection",
      "Fast Digital Reports (6–48hr)",
      "Full Body Checkup Packages",
      "Physician Report Review Add-on",
    ],
  },
  {
    id: "pharmacy",
    title: "Pharmacy Delivery",
    description:
      "Verified medication delivery with strict cold-chain maintenance — including auto-refill plans for chronic patients.",
    icon: Pill,
    href: SERVICE_ROUTES.pharmacy,
    storyHref: `${SERVICE_ROUTES.storyPage}#pharmacy`,
    cssVar: "--warning",
    styleMap: {
      bg: "bg-warning/15",
      text: "text-warning",
      hoverBorder: "group-hover:border-warning/50",
      hoverText: "group-hover:text-warning",
    },
    features: [
      "Express 2-Hour Delivery",
      "Cold-Chain Management",
      "Chronic Medicine Auto-Refill",
      "Authenticity Guarantee",
      "Prescription Digitization",
    ],
  },
];

// ─── Background Component ──────────────────────────────────────────────────────
const AuroraBackground = memo(() => (
  <div
    className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-base-100"
    aria-hidden="true"
  >
    <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary/[0.06] rounded-full blur-[120px]" />
    <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary/[0.06] rounded-full blur-[100px]" />
  </div>
));
AuroraBackground.displayName = "AuroraBackground";

// ─── Service Card ──────────────────────────────────────────────────────────────
const ServiceCard = memo(({ service }) => {
  const Icon = service.icon;

  return (
    <li
      className="group relative h-full rounded-[var(--r-box)] border border-base-300 bg-base-100 transition-all duration-500 hover:border-transparent hover:shadow-[var(--shadow-md)] overflow-hidden list-none"
      aria-labelledby={`service-title-${service.id}`}
    >
      <div className="relative z-10 p-8 flex flex-col h-full">
        {/* Icon & Story Link */}
        <div className="flex justify-between items-start mb-10">
          <div
            className={`p-4 rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm ${service.styleMap.bg} ${service.styleMap.text}`}
            aria-hidden="true"
          >
            <Icon size={32} strokeWidth={1.5} />
          </div>

          {/* Badge (conditionally shown) */}
          {service.badge && (
            <span className="badge badge-warning text-[10px] py-1 px-2">
              {service.badge}
            </span>
          )}

          {/* Arrow — links to story section */}
          <Link
            href={service.storyHref}
            className={`h-10 w-10 rounded-full border border-base-300 flex items-center justify-center text-base-content/30 transition-all duration-300 ${service.styleMap.hoverText} ${service.styleMap.hoverBorder} hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
            aria-label={`Read the ${service.title} story and how it works`}
            tabIndex={0}
          >
            <ChevronRight size={20} />
          </Link>
        </div>

        {/* Content */}
        <h1
          id={`service-title-${service.id}`}
          className="text-2xl font-black   mb-4 group-hover:translate-x-1 transition-transform duration-300 font-montserrat text-base-content"
        >
          {service.title}
        </h1>

        <p className="text-base-content/60 leading-relaxed text-sm mb-8 font-poppins">
          {service.description}
        </p>

        {/* Feature List */}
        <ul
          className="space-y-4 pt-6 border-t border-base-300 mt-auto"
          aria-label={`Features of ${service.title}`}
        >
          {service.features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 group/item">
              <CheckCircle2
                size={16}
                className={`shrink-0 opacity-70 group-hover/item:opacity-100 transition-opacity ${service.styleMap.text}`}
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-base-content/70 group-hover/item:text-base-content transition-colors font-poppins">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {/* Book CTA */}
        <div className="mt-8">
          <Link
            href={service.href}
            className={`inline-flex items-center gap-2 text-sm font-semibold font-poppins transition-all duration-300 ${service.styleMap.text} opacity-0 group-hover:opacity-100 group-hover:translate-x-1`}
            aria-label={`Book ${service.title} on Likeson.in`}
          >
            Book Now
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </li>
  );
});
ServiceCard.displayName = "ServiceCard";

// ─── Main Export ───────────────────────────────────────────────────────────────
const Services = memo(() => {
  return (
    <section
      className="relative min-h-screen text-base-content bg-base-100 overflow-hidden"
      aria-labelledby="services-section-heading"
      id="services"
    >
      <AuroraBackground />

      <div className="relative z-10 container-custom py-20 lg:py-28">

        {/* Header */}
        <header className="max-w-3xl mb-16">
          <h2
            id="services-section-heading"
            className="text-2xl md:text-5xl font-black tracking-tight leading-[1.1] mb-6 font-montserrat"
          >
            Modern Healthcare,{" "}
            <br />
            <span className="text-gradient-primary">
              Right at Your Door.
            </span>
          </h2>

          <p className="text-responsive-base text-base-content/70 max-w-2xl leading-relaxed font-poppins">
            <strong className="text-base-content">Likeson.in</strong> makes
            healthcare easy by bringing{" "}
            <span className="text-primary font-semibold">expert doctors</span>{" "}
            and{" "}
            <span className="text-primary font-semibold">
              essential medical services
            </span>{" "}
            directly to your home. Skip the waiting rooms — choose a service
            below to get{" "}
            <strong className="text-base-content">
              professional care today.
            </strong>
          </p>

          {/* Story page CTA */}
          <div className="mt-6">
            <Link
              href={SERVICE_ROUTES.storyPage}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary font-poppins hover:gap-3 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg px-1 py-1"
              aria-label="Read the full story of how each Likeson.in service works"
            >
              See how each service works →
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </header>

        {/* Services Grid — 7 services */}
        <ul
          className="grid gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          aria-label="Likeson.in healthcare services"
        >
          {SERVICES_DATA.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </ul>

        {/* Bottom CTA strip */}
        <div
          className="mt-16 rounded-2xl border border-base-300 p-8 text-center"
          style={{
            background:
              "linear-gradient(135deg, var(--base-200) 0%, var(--base-100) 100%)",
          }}
        >
          <p className="text-base-content/60 font-poppins mb-4 text-sm">
            Not sure which service you need?
          </p>
          <Link
            href="/contact"
            className="btn-primary-cta inline-flex items-center gap-2"
            aria-label="Talk to the Likeson.in team for help choosing the right service"
          >
            Talk to Our Team
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
});

Services.displayName = "Services";
export default Services;