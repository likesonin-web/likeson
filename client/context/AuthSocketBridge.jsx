'use client';

/**
 * AuthSocketBridge.jsx — Likeson.in
 *
 * Root-level wrapper around SocketProvider (services/socketService.js).
 * Mounted once, near the top of the tree (inside StoreProvider, outside
 * everything else) — see app/layout.tsx.
 *
 * Job: read the JWT out of Redux (userSlice) and hand it down as the
 * `token` prop SocketProvider needs. That's it. No bookingId/tpId here —
 * this is the APP-WIDE connection (auth'd socket exists for the whole
 * session so things like global SOS banners / push-style events can fire
 * on any page). Pages that need a specific booking room call
 * `useSocket()` themselves and join via `joinBookingRoom` / pass their
 * own bookingId further down — see useRideTracking.js /
 * useCareAssistantTracking.js, both of which do this directly off the
 * shared socketService singleton without needing a second <SocketProvider>.
 *
 * Token lifecycle:
 *   - No token (logged out / not yet hydrated)  -> SocketProvider gets
 *     token=null/undefined, internally skips connecting (see its own
 *     init effect — `if (!token) { socketService.destroy(); ... return; }`).
 *   - Token appears (login, OTP login, Google callback, rehydrate from
 *     localStorage on first paint) -> SocketProvider's effect re-fires on
 *     the token dependency change and calls socketService.init(token).
 *   - Token goes from truthy -> falsy (logout, autoLogout, account
 *     deactivate/delete) -> SocketProvider explicitly destroys the
 *     socket and resets its local state. Nothing extra needed here.
 *
 * Why this file exists instead of just useSelector-ing directly in
 * layout.tsx: layout.tsx is a Server Component (no 'use client' at top),
 * so it can't call hooks. This is the client boundary.
 */

import { useSelector } from 'react-redux';
import SocketProvider from '@/context/SocketProvider';
import { selectToken } from '@/store/slices/userSlice';

export default function AuthSocketBridge({ children }) {
  const token = useSelector(selectToken);

  return (
    <SocketProvider token={token}>
      {children}
    </SocketProvider>
  );
}