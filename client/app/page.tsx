"use client";

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

// Components
import Hero from "@/components/ui/Hero";
import Services from "@/components/ui/Services";
import Container from "@/components/ui/Container";
import Subscription from "@/app/(page)/Subscription";
import Banner from "@/components/Banner";
import Ads from "@/components/Ads";
import LabHero from "@/app/lab-partner/Hero";
import HeroSoloDriver from "@/components/hero/HeroSoloDriver";
import CareAssistant from "@/components/Careassistanthero";
import HeroDriver from "@/components/hero/HeroDriver";
import Hospital from "@/app/(page)/HospitalPage";
import Faq from "@/components/Faq";
 
const Home: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.user);
  const role = user?.role || "customer"; // Default to customer for guests

  return (
    <main className="min-h-screen bg-base-100 transition-colors duration-300 overflow-x-hidden relative">

      {/* ── CUSTOMER / GUEST ──────────────────────────────────────────────── */}
      {role === "customer" && (
        <Container className="w-full flex flex-col gap-8 pb-12">
          {/* 1. Hero */}
          <Hero />

          {/* 2. Hero Banner ad - Global */}
          <Ads page="Global" slot="Hero_Banner" />

          {/* 3. Core service navigation hub */}
          <Services />
             
          {/* 4. Native Feed ad */}
          <Ads page="Global" slot="Native_Feed" />
          
          <Hospital />
          
          {/* 5. Dynamic promotions */}
          <section className="animate-fade-in">
            <Banner position="Home_Middle" />
          </section>
        <Ads page="Global" slot="Popup" />
          {/* 6. Retention */}
          <Subscription />
          <Faq />
        </Container>
      )}

      {/* ── CARE ASSISTANT ────────────────────────────────────────────────── */}
      {role === "care_assistant" && (
        <Container className="w-full flex flex-col gap-12 py-6">
          <CareAssistant />
           
        </Container>
      )}

      {/* ── LAB PARTNER ───────────────────────────────────────────────────── */}
      {role === "lab_partner" && (
        <Container className="w-full flex flex-col gap-12 py-6">
          <LabHero />
          
        </Container>
      )}

      {/* ── SOLO DRIVER PARTNER ───────────────────────────────────────────── */}
      {role === "solodriverpartner" && (
        <>
          <Container className="w-full flex flex-col gap-12 py-6">
            <HeroSoloDriver />
 
          </Container>
  
        </>
      )}

      {/* ── DRIVER ────────────────────────────────────────────────────────── */}
      {role === "driver" && (
        <>
          <Container className="w-full flex flex-col gap-12 py-6">
            <HeroDriver />
    
          </Container>
     
        </>
      )}

      {/* ── TRULY GLOBAL ADS (Render for everyone) ────────────────────────── */}
      {/* These are mounted globally at the bottom of the DOM. 
        Your backend/Redux state (via `targeting.userSegments`) will decide 
        if the current user actually gets an ad returned for these slots.
      */}
     

      {/* Only show the Global Sticky Bottom if they aren't drivers (drivers get the Ride Tracking sticky) */}
      {(role !== "driver" && role !== "solodriverpartner") && (
        <Ads page="Global" slot="Sticky_Bottom" />
      )}

    </main>
  );
};

export default Home;