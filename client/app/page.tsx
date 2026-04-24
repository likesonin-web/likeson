"use client";

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

// Components
import Hero from "@/components/ui/Hero";
import Services from "@/components/ui/Services";
import Container from "@/components/ui/Container";
import HospitalPage from "@/app/(page)/HospitalPage";
import Subscription from "@/app/(page)/Subscription";
import Banner from "@/components/Banner";
import Ads from "@/components/Ads";
import Faq from "@/components/Faq";
import LabHero from "@/app/lab-partner/Hero";
import HeroSoloDriver from "@/components/hero/HeroSoloDriver";
import CareAssistant from "@/components/Careassistanthero";
import HeroDriver from "@/components/hero/HeroDriver";
const Home: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.user);

  return (
    <main className="min-h-screen bg-base-100 transition-colors duration-300 overflow-x-hidden">
      {(user?.role === "customer" || !user) && (
        <Container className="w-full flex flex-col gap-12 py-6">
          {/* 1. Value Proposition */}
          <Hero />

          {/* 2. Popup Ad */}
          {/* <Ads page="Global" slot="Popup" /> */}

          {/* 3. Core Navigation / Action Hub */}
          <Services />

          {/* 4. Dynamic Promotions & Seasonal Health Alerts */}
          <section className="animate-fade-in">
            <Banner position="Home_Middle" />
          </section>

          {/* 5. Trust & Provider Discovery */}
          {/* <HospitalPage /> */}

          {/* 6. Retention & Commitment */}
          <Subscription />

          {/* 7. FAQ */}
          {/* <Faq /> */}
        </Container>
      )}

      {user?.role === "care assistant" && (
        <CareAssistant />
      )}

      {user?.role=== 'lab partner' && (
         
          <LabHero/>
         
      )}
      {user?.role=== 'solodriverpartner' && (
         
          <HeroSoloDriver/>
         
      )}
      {user?.role === "driver" && (
         
          <HeroDriver/>
         
      )}
    </main>
  );
};

export default Home;