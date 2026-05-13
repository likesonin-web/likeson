"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Header from "./Header";
import Footer from "./Footer";
import LikesonSuperAdminDashboard from "@/components/dashboard/LikesonSuperAdminDashboard";
import AdminDashboard from "@/app/admin/AdminDashboard";
import PharmacyDashboard from '@/components/dashboard/PharmacyDashboard'
import TransportPartnerDashboard from '@/components/dashboard/Transportpartnerdashboard'
 import Marquee from "@/components/Marquee";
 import HospitalMangerDashboard from "@/components/dashboard/HospitalMangerDashboard";
import DoctorDashboard from '@/components/dashboard/DoctorDashboard'
 import { usePathname } from 'next/navigation';
import BloodBankDashboard from "@/components/dashboard/BloodBankDashboard";
 
import LabPartnerDashboard from "@/components/dashboard/LabPartnerDashboard";
export default function LayoutConditionalWrapper({ children }) {
  const { user } = useSelector((state) => state.user);
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname(); // ← MOVED HERE, before any returns

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isTrackingPage = pathname?.startsWith('/rides/') && pathname?.endsWith('/tracking');

  if (!isClient) {
    return <div className="min-h-screen bg-base-100" />;
  }

  if (user?.role === 'superadmin') {
    return <LikesonSuperAdminDashboard>{children}</LikesonSuperAdminDashboard>;
  }
  if (user?.role === 'admin') {
    return <AdminDashboard>{children}</AdminDashboard>;
  }
  if (user?.role === 'pharmacy') {
    return <PharmacyDashboard>{children}</PharmacyDashboard>;
  }
  if (user?.role === 'transportpartner') {
    return <TransportPartnerDashboard>{children}</TransportPartnerDashboard>;
  }
  if (user?.role === 'doctor') {
    return <DoctorDashboard>{children}</DoctorDashboard>;
  }
  if (user?.role === 'labpartner') {
    return <LabPartnerDashboard>{children}</LabPartnerDashboard>;
  }
  if (user?.role === 'hospital') {
    return <HospitalMangerDashboard>{children}</HospitalMangerDashboard>;
  }
  if(user?.role === 'blood_bank'){
    return <BloodBankDashboard>{children}</BloodBankDashboard>;
  }

  return (
    <>
      {user && !isTrackingPage && <Marquee />}
      <Header />
      <main className="min-h-screen transition-all duration-300">
        {children}
      </main>
      <Footer />
    </>
  );
}