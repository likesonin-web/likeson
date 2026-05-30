'use client';

import React, { useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectToken } from '@/store/slices/userSlice';
import SocketProvider from '@/context/SocketProvider';
import { ConsultationProvider } from '@/providers/ConsultationSocketProvider';

export default function AuthSocketBridge({
  children,
  showStatusBadge = true,
}: {
  children: React.ReactNode;
  showStatusBadge?: boolean;
}) {
  const rawToken = useSelector(selectToken);

  const token = useMemo(
    () => (rawToken && typeof rawToken === 'string' && rawToken.trim() !== '' ? rawToken : null),
    [rawToken]
  );

  const handleConnect    = useCallback(() => console.log('[Socket] Connected'),    []);
  const handleDisconnect = useCallback(() => console.log('[Socket] Disconnected'), []);

  return (
    <SocketProvider
      token={token}
      showStatusBadge={showStatusBadge}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
    >
      <ConsultationProvider>
        {children}
      </ConsultationProvider>
    </SocketProvider>
  );
}