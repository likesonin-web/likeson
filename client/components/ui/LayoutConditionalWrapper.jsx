"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Header from "./Header";
import Footer from "./Footer";
import LikesonSuperAdminDashboard from "@/components/dashboard/LikesonSuperAdminDashboard";
import AdminDashboard from "@/app/admin/AdminDashboard";
import PharmacyDashboard from '@/components/dashboard/PharmacyDashboard'
import TransportPartnerDashboard from '@/components/dashboard/Transportpartnerdashboard'
import SoloDriverDashboard from'@/components/dashboard/SoloDriverDashboard'
import DoctorDashboard from '@/components/dashboard/DoctorDashboard'
import CareDashboard from '@/components/dashboard/Caredashboard'
import Marquee from '@/components/Marquee'
import LabPartnerDashboard from "@/components/dashboard/LabPartnerDashboard";
export default function LayoutConditionalWrapper({ children }) {
  const { user } = useSelector((state) => state.user);
  const [isClient, setIsClient] = useState(false);

  // UseEffect ensures we only render after the client-side hydration 
  // This prevents Redux "undefined" errors during SSR
  useEffect(() => {
    setIsClient(true);
  }, []);

  

  // 1. Loading State: Prevent layout jumping while Redux hydrates
  if (!isClient) {
    return <div className="min-h-screen bg-base-100" />; 
  }

  // 2. Super Admin Layout
  if (user?.role === 'superadmin') {
    return <LikesonSuperAdminDashboard>{children}</LikesonSuperAdminDashboard>;
  }

  // 3. Admin Layout
  if (user?.role === 'admin') {
    return <AdminDashboard>{children}</AdminDashboard>;
  }
  // 4. Pharmacy Layout
  if (user?.role === 'pharmacy') {
    return <PharmacyDashboard>{children}</PharmacyDashboard>;
  }
  // 5. Transport Layout 
  if (user?.role === 'transportpartner') {
    return <TransportPartnerDashboard>{children}</TransportPartnerDashboard>;
  }
  if (user?.role === 'solodriverpartner') {
    return <SoloDriverDashboard>{children}</SoloDriverDashboard>;
  }
  if (user?.role === 'doctor') {
    return <DoctorDashboard>{children}</DoctorDashboard>;
  }
  if (user?.role === 'labpartner') {
    return <LabPartnerDashboard>{children}</LabPartnerDashboard>;
  }
  

  // 4. Standard Consumer Layout (Patient/Guest/NRI)
  return (
    <>
       {/* {user &&    <Marquee/>} */}
      <Header />
      <main className="min-h-screen transition-all duration-300">
        {children}
      </main>
      <Footer />
    </>
  );
}