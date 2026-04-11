'use client';
// path: store/api.js

import axios from 'axios';

const API = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach token ─────────────────────────────────────────────────────
API.interceptors.request.use(
  (config) => {
    // Only access localStorage on the client
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response: handle 401 codes that require auto-logout ───────────────────────
//
// IMPORTANT: The interceptor is wired to the Redux store lazily (imported below)
// to avoid a circular-dependency between api.js ↔ store/index.js at module
// initialisation time.  We import the store only when the interceptor fires.
//
// Codes that must trigger auto-logout (mirrors AUTO_LOGOUT_CODES in userSlice):
//   TOKEN_EXPIRED          – JWT has expired; server also cleaned up the session
//   SESSION_REVOKED        – session was deleted (sign-out from another device)
//   DEVICE_TOKEN_REVOKED   – device token removed (remote sign-out)
//   USER_NOT_FOUND         – account deleted while token was still valid
//   ACCOUNT_BLOCKED        – account suspended server-side
//
// Everything else (wrong password, missing token on a public route, etc.) is
// passed through as a normal rejection so the calling thunk can handle it.

const AUTO_LOGOUT_CODES = new Set([
  'TOKEN_EXPIRED',
  'SESSION_REVOKED',
  'DEVICE_TOKEN_REVOKED',
  'USER_NOT_FOUND',
  'ACCOUNT_BLOCKED',
]);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code   = error.response?.data?.code;

    // Only intercept 401s that carry a recognised auto-logout code.
    // Plain 401s (e.g. "Invalid credentials" on the login form, or routes
    // that return 401 without a `code` field) are left alone so the thunk
    // that made the request can show the proper error to the user.
    if (status === 401 && AUTO_LOGOUT_CODES.has(code)) {
      // Lazy-import the store to avoid circular dependency.
      // We use dynamic require() because this file is not an async context.
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { store }      = require('@/store');          // adjust path if needed
        const { autoLogout } = require('@/store/slices/userSlice');
        store.dispatch(autoLogout(code));
      } catch (e) {
        // Fallback: if the store isn't available yet (SSR edge case),
        // clear storage manually and redirect.
        console.warn('[api] store unavailable during auto-logout, clearing manually', e);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('tokenExpiresAt');
          window.location.href = '/';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default API;