'use client';

import React, { use } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/userSlice';
import ConsultationProvider from '@/context/ConsultationProvider';
import AgoraProvider from '@/context/AgoraProvider';
import ConsultationRoom from '@/components/consultation/ConsultationRoom';

export default function DoctorConsultationPage({ params }) {
  // Next.js 15: params is a Promise
  const { consultationId } = use(params);
  const currentUser = useSelector(selectCurrentUser);

  if (!currentUser) {
    return (
      <div className="session-end-screen">
        <div className="session-end-card">
          <p className="session-end-sub">Loading session…</p>
          <span className="loading loading-md loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <ConsultationProvider
      consultationId={consultationId}
      userRole="doctor"
      userId={currentUser._id}
    >
      <AgoraProvider
        consultationId={consultationId}
        userId={currentUser._id}
        role="doctor"
      >
        <ConsultationRoom isDoctor />
      </AgoraProvider>
    </ConsultationProvider>
  );
}