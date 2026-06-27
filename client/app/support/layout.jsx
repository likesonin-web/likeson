'use client';

/**
 * app/support/layout.jsx
 * Root layout for the entire Support module. Mounts SocketProvider scoped
 * to this module (so non-support routes in the host app aren't forced to
 * hold a /support namespace connection open) and the SupportLayout shell.
 */
import SocketProvider from '@/providers/SocketProvider';
import SupportLayout from '@/components/support/SupportLayout';

export default function SupportRootLayout({ children }) {
  return (
    <SocketProvider>
      <SupportLayout>{children}</SupportLayout>
    </SocketProvider>
  );
}
