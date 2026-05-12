'use client';

/**
 * AuthSocketBridge
 * ────────────────
 * A thin client component that sits between the Server Component layout
 * and SocketProvider. Its only job is to read the JWT token from Redux
 * (userSlice) and forward it to SocketProvider.
 *
 * Why a separate component?
 *   • layout.tsx must stay a Server Component (no 'use client') to keep
 *     Next.js metadata exports working.
 *   • SocketProvider needs useSelector, which requires 'use client'.
 *   • This bridge is the minimal surface area that needs to be a client
 *     component — everything inside it can still be server-rendered.
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { selectToken } from '@/store/slices/userSlice'; // adjust path if needed
import SocketProvider  from '@/context/SocketProvider';

interface Props {
  children: React.ReactNode;
}

export default function AuthSocketBridge({ children }: Props) {
  // selectToken returns the JWT string or null (from userSlice initialState)
  const token = useSelector(selectToken);

  return (
    // SocketProvider connects only when token is non-null (i.e. user is logged in).
    // On logout (token → null) the provider cleans up the socket automatically.
    <SocketProvider token={token}>
      {children}
    </SocketProvider>
  );
}