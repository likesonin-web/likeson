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
import Hospital from "@/app/(page)/HospitalPage"
import Faq from "@/components/Faq"
 
const Home: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.user);

  return (
    <main className="min-h-screen bg-base-100 transition-colors duration-300 overflow-x-hidden">

      {/* ── CUSTOMER / GUEST ──────────────────────────────────────────────── */}
      {(user?.role === "customer" || !user) && (
        <>
          <Container className="w-full  ">

            {/* 1. Hero — value proposition, first thing user sees */}
            <Hero />

            {/* 2. Hero Banner ad — immediately after hero while attention is
                    at peak. Full-width, high-impact. Best slot for premium
                    advertisers (Apollo, Practo etc). page=Global covers all
                    customers regardless of where they came from. */}
            <Ads page="Global" slot="Hero_Banner" />

            {/* 3. Core service navigation hub */}
            <Services />
             
            {/* 4. Native Feed ad — sandwiched between Services and Banner.
                    Feels organic, not intrusive. User has engaged with services,
                    now primed for a contextual product offer. */}
            <Ads page="Global" slot="Native_Feed" />
            <Hospital />
            {/* 5. Dynamic promotions, seasonal health alerts */}
            <section className="animate-fade-in">
              <Banner position="Home_Middle" />
            </section>
         
            {/* 6. Retention & subscription CTA */}
            <Subscription />
            <Faq/>
          </Container>

          {/* 7. Popup ad — OUTSIDE Container. Renders as fixed full-screen
                  overlay on mount. Internal component handles backdrop +
                  dismiss logic. Must never be inside a flow container. */}
          <Ads page="Global" slot="Popup" />

          {/* 8. Sticky Bottom ad — OUTSIDE Container. Fixed to viewport
                  bottom, persists while user scrolls. Component owns its
                  own `position: fixed; bottom: 0` styling.
                  Dismissed via internal X button. */}
          <Ads page="Global" slot="Sticky_Bottom" />
        </>
      )}

      {/* ── CARE ASSISTANT ────────────────────────────────────────────────── */}
      {user?.role === "care_assistant" && (
        <>
          <Container className="w-full flex flex-col gap-12 py-6">
            <CareAssistant />

            {/* Native feed — training tools, health product offers for
                care assistants. Between hero and any dashboard cards. */}
            <Ads page="Global" slot="Native_Feed" />
          </Container>

          {/* Sticky upsell — cert courses, equipment offers */}
          <Ads page="Global" slot="Sticky_Bottom" />
        </>
      )}

      {/* ── LAB PARTNER ───────────────────────────────────────────────────── */}
      {user?.role === "lab_partner" && (
        <>
          <Container className="w-full flex flex-col gap-12 py-6">
            <LabHero />

            {/* Hero Banner — reagent suppliers, lab equipment brands.
                Below hero, before test listing grid. */}
            <Ads page="Global" slot="Hero_Banner" />

            {/* Native Feed — between test categories / collection slots */}
            <Ads page="Global" slot="Native_Feed" />
          </Container>

          <Ads page="Global" slot="Sticky_Bottom" />
        </>
      )}

      {/* ── SOLO DRIVER PARTNER ───────────────────────────────────────────── */}
      {user?.role === "solodriverpartner" && (
        <>
          <Container className="w-full flex flex-col gap-12 py-6">
            <HeroSoloDriver />

            {/* Native Feed — vehicle insurance, fuel card offers.
                Between hero stats and active rides section. */}
            <Ads page="Global" slot="Native_Feed" />
          </Container>

          {/* Ride Tracking Screen sticky — vehicle upgrade / EMI offers.
              Shown while driver is on an active ride. page=Ride_Tracking_Screen
              ensures only ads targeted to that context are served. */}
          <Ads page="Ride_Tracking_Screen" slot="Sticky_Bottom" />
        </>
      )}

      {/* ── DRIVER ────────────────────────────────────────────────────────── */}
      {user?.role === "driver" && (
        <>
          <Container className="w-full flex flex-col gap-12 py-6">
            <HeroDriver />

            {/* Native Feed — between trip history cards / earnings summary.
                Fleet insurance, tyre brands, EV upgrade promos. */}
            <Ads page="Global" slot="Native_Feed" />
          </Container>

          {/* Ride tracking sticky — shown during active trip.
              Ola Electric, fuel apps, roadside assist ads fit here. */}
          <Ads page="Ride_Tracking_Screen" slot="Sticky_Bottom" />
        </>
      )}

    </main>
  );
};

export default Home;