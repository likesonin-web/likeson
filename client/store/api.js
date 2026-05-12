'use client';
// path: store/api.js

import axios from 'axios';

const API = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

API.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const AUTO_LOGOUT_CODES = new Set([
  'TOKEN_EXPIRED',
  'SESSION_REVOKED',
  'DEVICE_TOKEN_REVOKED',
  'USER_NOT_FOUND',
  'ACCOUNT_BLOCKED',
]);

// ← THE FIX: module-level dedup flag
let isHandling401 = false;

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code   = error.response?.data?.code;

    if (status === 401 && AUTO_LOGOUT_CODES.has(code)) {
      if (!isHandling401) {                           // ← only first 401 passes
        isHandling401 = true;
        try {
          const { store }      = require('@/store');
          const { autoLogout } = require('@/store/slices/userSlice');
          store.dispatch(autoLogout(code));
        } catch (e) {
          console.warn('[api] store unavailable, clearing manually', e);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('tokenExpiresAt');
            window.location.href = '/';
          }
        } finally {
          setTimeout(() => { isHandling401 = false; }, 3000); // ← reset after 3s
        }
      }
      // all parallel 401s silently swallowed here
    }

    return Promise.reject(error);
  }
);

export default API;