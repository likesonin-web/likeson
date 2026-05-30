'use client';

/**
 * usePatientConsultationGuard
 *
 * Validates:
 *   1. User authenticated
 *   2. Role === 'customer'
 *   3. (Ownership validated server-side; client double-check in page)
 *
 * Redirects unauthorized users immediately.
 * Never exposes doctor/admin controls.
 */

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { useSelector }         from 'react-redux';

// Adjust selector to your userSlice shape
const selectUser  = (s) => s.user?.user;
const selectToken = (s) => s.user?.token;

export function usePatientConsultationGuard() {
  const router    = useRouter();
  const user      = useSelector(selectUser);
  const token     = useSelector(selectToken);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!user;
  const isCustomer      = user?.role === 'customer';
  const isAllowed       = isAuthenticated && isCustomer;

  useEffect(() => {
    // Give Redux a tick to hydrate from storage
    const timer = setTimeout(() => {
      setIsLoading(false);

      if (!isAuthenticated) {
        router.replace('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }
      if (!isCustomer) {
        // Doctor/admin accidentally hit patient route
        router.replace('/unauthorized');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isCustomer, router]);

  return { user, isAllowed, isLoading };
}