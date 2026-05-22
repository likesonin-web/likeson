'use client';

import { ReactNode } from 'react';
import { ConsultationSocketProvider } from '@/provider/ConsultationSocketProvider';
import { useSelector } from 'react-redux';

interface RootState {
  auth: {
    token: string | null;
  };
}

interface ConsultationLayoutInnerProps {
  children: ReactNode;
  consultationId: string;
}

function ConsultationLayoutInner({
  children,
  consultationId,
}: ConsultationLayoutInnerProps) {
  const token = useSelector((state: RootState) => state.auth.token);

  return (
    <ConsultationSocketProvider
      token={token ?? ''}
      consultationId={consultationId}
      autoJoin={false}
      onConnect={() => console.log('Connected')}
      onDisconnect={() => console.log('Disconnected')}
      onError={(err: any) => console.error(err)}
    >
      {children}
    </ConsultationSocketProvider>
  );
}

interface LayoutProps {
  children: ReactNode;
  params: Promise<{
    consultationId: string;
  }>;
}

export default async function ConsultationLayout({
  children,
  params,
}: LayoutProps) {
  const { consultationId } = await params;

  return (
    <ConsultationLayoutInner consultationId={consultationId}>
      {children}
    </ConsultationLayoutInner>
  );
}