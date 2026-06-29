'use client';

/**
 * AuthSocketBridge.tsx
 *
 * Thin wrapper that mounts SocketProvider.
 * Token is read from Redux inside SocketProvider itself (state.user.token),
 * so no need to pass it as a prop — the useMemo/token logic here was dead code.
 *
 * showStatusBadge retained as a no-op prop so callers don't break.
 */

import React                from 'react';
import SocketProvider       from '@/context/SocketProvider';

interface AuthSocketBridgeProps {
  children:         React.ReactNode;
  showStatusBadge?: boolean; // no-op — kept for backwards compat
}

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