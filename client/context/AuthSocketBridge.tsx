'use client';

import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectToken } from '@/store/slices/userSlice';
import SocketProvider from '@/context/SocketProvider';

interface AuthSocketBridgeProps {
  children: React.ReactNode;
  token: string | null; // JWT token or null if not authenticated
  showStatusBadge?: boolean; 
}

export default function AuthSocketBridge({ children, showStatusBadge = true }: AuthSocketBridgeProps) {
  // selectToken returns the JWT string or null
  const rawToken = useSelector(selectToken);

  // Guard against undefined or empty strings that might slip through Redux initial states
  const token = useMemo(() => {
    return (rawToken && typeof rawToken === 'string' && rawToken.trim() !== '') 
      ? rawToken 
      : null;
  }, [rawToken]);

  return (
  
    <SocketProvider token={token} showStatusBadge={showStatusBadge}>
      {children}
    </SocketProvider>
  );
}