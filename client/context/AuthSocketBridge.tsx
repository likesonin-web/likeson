'use client';

import React from 'react';
// Note: Ensure this path matches the location of your Support SocketProvider
import SocketProvider from '@/providers/SocketProvider'; 

interface AuthSocketBridgeProps {
  children: React.ReactNode;
  showStatusBadge?: boolean; 
}

/**
 * AuthSocketBridge
 *
 * Thin wrapper that mounts SocketProvider.
 * User data and tokens are read directly from Redux inside SocketProvider,
 * removing the need to pass them as props.
 *
 * @param showStatusBadge - Retained as a no-op prop to prevent breaking existing callers.
 */
export default function AuthSocketBridge({
  children,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showStatusBadge = true,
}: AuthSocketBridgeProps) {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  );
}