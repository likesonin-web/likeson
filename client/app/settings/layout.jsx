/**
 * Next.js App Router page files for the /settings/* routes.
 *
 * All six files are identical — they all render <SettingsManagement />.
 * The shell uses usePathname() internally to derive which tab to activate,
 * so the correct tab opens automatically when any deep-link is visited.
 *
 * File structure (create each as its own file):
 *
 *   app/
 *   └── settings/
 *       ├── page.jsx              ← /settings          → Overview tab
 *       ├── layout.jsx            ← shared layout/auth guard (optional)
 *       ├── account/
 *       │   └── page.jsx          ← /settings/account  → Account tab
 *       ├── security/
 *       │   └── page.jsx          ← /settings/security → Security tab
 *       ├── wallet/
 *       │   └── page.jsx          ← /settings/wallet   → Wallet tab
 *       ├── referral/
 *       │   └── page.jsx          ← /settings/referral → Referral tab
 *       └── legal/
 *           └── page.jsx          ← /settings/legal    → Legal tab
 */

// ─────────────────────────────────────────────────────────────────────────────
// app/settings/page.jsx
// app/settings/account/page.jsx
// app/settings/security/page.jsx
// app/settings/wallet/page.jsx
// app/settings/referral/page.jsx
// app/settings/legal/page.jsx
//
// All six files are exactly this — copy as-is into each location:
// ─────────────────────────────────────────────────────────────────────────────

import SettingsManagement from '../settings/page';

export default function SettingsPage() {
  return <SettingsManagement />;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL: app/settings/layout.jsx
// Wraps all /settings/* routes with an auth guard so unauthenticated users
// are redirected to /login before any settings page is rendered.
// ─────────────────────────────────────────────────────────────────────────────

/*
'use client';

import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { selectIsLoggedIn } from '@/store/slices/userSlice';

export default function SettingsLayout({ children }) {
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const router     = useRouter();

  useEffect(() => {
    if (!isLoggedIn) router.replace('/login?redirect=/settings');
  }, [isLoggedIn, router]);

  if (!isLoggedIn) return null; // or a loading spinner

  return <>{children}</>;
}
*/