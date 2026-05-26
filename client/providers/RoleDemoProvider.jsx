'use client';

/**
 * RoleDemoProvider — DEV-ONLY role switcher.
 * Lets developers preview doctor/patient/admin layouts without backend.
 * Remove or gate behind process.env.NODE_ENV === 'development' in production.
 *
 * Does NOT inject mock consultation data — components pull from real Redux store.
 * Use this only to switch the `user.role` used by ConsultationShell for theme + layout routing.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { patchUser } from '@/store/slices/userSlice';

const ROLES = ['doctor', 'customer', 'admin'];

const DemoCtx = createContext(null);

export function RoleDemoProvider({ children, enabled = false }) {
  const dispatch = useDispatch();
  const [role,     setRole]     = useState('doctor');
  const [darkMode, setDarkMode] = useState(false);

  // Patch Redux user.role so ConsultationShell picks correct layout
  useEffect(() => {
    if (!enabled) return;
    dispatch(patchUser({ role }));
  }, [role, enabled, dispatch]);

  // Theme + dark mode
  useEffect(() => {
    if (!enabled) return;
    const themeMap = { doctor: 'doctor', customer: 'customer', admin: 'admin' };
    document.documentElement.dataset.theme = themeMap[role] ?? 'doctor';
    document.documentElement.classList.toggle('dark', darkMode);
  }, [role, darkMode, enabled]);

  if (!enabled) return <>{children}</>;

  return (
    <DemoCtx.Provider value={{ role, setRole, darkMode, setDarkMode, ROLES }}>
      {/* Floating role switcher — dev only */}
      <div className="fixed top-2 right-2 z-[9999] flex items-center gap-2 bg-base-100/90 backdrop-blur border border-base-300 rounded-xl px-3 py-2 shadow-depth text-xs">
        <span className="font-bold text-base-content/50">DEV</span>
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`btn btn-xs capitalize ${role === r ? 'btn-primary' : 'btn-ghost'}`}
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => setDarkMode((v) => !v)}
          className="btn btn-xs btn-ghost"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      {children}
    </DemoCtx.Provider>
  );
}

export const useDemoRole = () => {
  const ctx = useContext(DemoCtx);
  if (!ctx) throw new Error('useDemoRole outside RoleDemoProvider');
  return ctx;
};
