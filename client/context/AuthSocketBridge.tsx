'use client';

import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectToken } from '@/store/slices/userSlice';
import SocketProvider from '@/context/SocketProvider';

interface SocketProviderProps {
  token: any;
  children: any;
  showStatusBadge?: boolean;
  onConnect?: () => void;    // Add the '?' here
  onDisconnect?: () => void; // Add the '?' here
}

export default function AuthSocketBridge({ children, showStatusBadge = true }: { children: React.ReactNode; showStatusBadge?: boolean }) {
  // selectToken returns the JWT string or null
  const rawToken = useSelector(selectToken);

  // Guard against undefined or empty strings that might slip through Redux initial states
  const token = useMemo(() => {
    return (rawToken && typeof rawToken === 'string' && rawToken.trim() !== '') 
      ? rawToken 
      : null;
  }, [rawToken]);

 return (
    <SocketProvider 
      token={token} 
      showStatusBadge={showStatusBadge}
      onConnect={() => console.log('Connected')}       // Added required prop
      onDisconnect={() => console.log('Disconnected')} // Added required prop
    >
      {children}
    </SocketProvider>
  );
}