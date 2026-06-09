'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  Cookie, X, ChevronDown, ChevronUp, ShieldCheck,
  BarChart2, Megaphone, Settings2, CheckCircle2, XCircle,
} from 'lucide-react';

import {
  fetchActiveDocByType,
  recordConsent,
  selectActiveDocByType,
  selectConsentLoading,
} from '@/store/slices/legalSlice';
import { selectToken, selectUser } from '@/store/slices/userSlice';

// ── Selector (stable ref — created outside component) ────────────────────────
const selectCookieDoc = selectActiveDocByType('cookie_policy');

// ── Storage key ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'likeson_cookie_consent_v1';

// ── Cookie category config ───────────────────────────────────────────────────
const CATEGORIES = [
  {
    id:          'necessary',
    label:       'Strictly Necessary',
    description: 'Session management, auth tokens, and CSRF protection. These cannot be disabled — the platform cannot function without them.',
    icon:        ShieldCheck,
    accent:      '#059669',
    always:      true,
  },
  {
    id:          'analytics',
    label:       'Analytics',
    description: 'Google Analytics & Firebase Analytics. Help us understand page visits, session duration, and device types so we can improve the experience.',
    icon:        BarChart2,
    accent:      '#2563eb',
    always:      false,
  },
  {
    id:          'marketing',
    label:       'Marketing',
    description: 'Retargeting pixels (Google, Meta). Off by default — only enabled with your explicit opt-in. Used to show relevant Likeson ads outside the platform.',
    icon:        Megaphone,
    accent:      '#d97706',
    always:      false,
  },
];

// ── Persist helpers ───────────────────────────────────────────────────────────
function loadSaved() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
function savePref(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, savedAt: Date.now() })); } catch {}
}

// ── Animation variants ────────────────────────────────────────────────────────
const BANNER_VARIANTS = {
  hidden: { opacity: 0, y: 100, scale: 0.97 },
  show:   { opacity: 1, y: 0,   scale: 1,    transition: { type: 'spring', damping: 26, stiffness: 220 } },
  exit:   { opacity: 0, y: 80,  scale: 0.96, transition: { duration: 0.28, ease: 'easeInOut' } },
};
const SETTINGS_VARIANTS = {
  hidden: { opacity: 0, height: 0 },
  show:   { opacity: 1, height: 'auto', transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, height: 0,      transition: { duration: 0.22, ease: 'easeInOut' } },
};

// ── Toggle ────────────────────────────────────────────────────────────────────
function CategoryToggle({ category, checked, onChange }) {
  const { id, label, description, icon: Icon, accent, always } = category;
  return (
    <div
      className="flex items-start gap-4 p-4 rounded-xl border transition-all duration-200"
      style={{
        background:   checked ? `color-mix(in oklch, ${accent} 6%, var(--base-100))` : 'var(--base-100)',
        borderColor:  checked ? `color-mix(in oklch, ${accent} 30%, transparent)`    : 'var(--base-300)',
      }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `color-mix(in oklch, ${accent} 14%, var(--base-200))`, color: accent }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-black" style={{ color: 'var(--base-content)' }}>{label}</p>
          {always && (
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
              style={{ background: `color-mix(in oklch, ${accent} 14%, var(--base-200))`, color: accent }}
            >
              Always On
            </span>
          )}
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
          {description}
        </p>
      </div>

      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${always ? 'Required' : (checked ? 'Disable' : 'Enable')} ${label}`}
        disabled={always}
        onClick={() => !always && onChange(id, !checked)}
        className="flex-shrink-0 mt-0.5 relative w-10 h-6 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
        style={{
          background: checked
            ? accent
            : 'color-mix(in oklch, var(--base-content) 18%, var(--base-300))',
        }}
      >
        <span
          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function CookieConsent() {
  const dispatch    = useDispatch();
  const token       = useSelector(selectToken);
  const user        = useSelector(selectUser);
  const cookieDoc   = useSelector(selectCookieDoc);
  const submitting  = useSelector(selectConsentLoading);

  const [visible,      setVisible]      = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState({ necessary: true, analytics: false, marketing: false });
  const [dismissed, setDismissed]       = useState(false);
  const bannerRef = useRef(null);

  // ── Load cookie policy doc ────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchActiveDocByType({ type: 'cookie_policy' }));
  }, [dispatch]);

  // ── Show banner if no saved consent ──────────────────────────────────────
  useEffect(() => {
    const saved = loadSaved();
    if (!saved) {
      // Slight delay — don't fight with page load
      const id = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(id);
    }
  }, []);

  // ── ESC to close settings panel ──────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => { if (e.key === 'Escape') setShowSettings(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible]);

  const handleToggle = useCallback((id, val) => {
    setPrefs((p) => ({ ...p, [id]: val }));
  }, []);

  // ── Shared: save locally + optionally record in backend ──────────────────
  const finalise = useCallback(async (chosenPrefs) => {
    savePref(chosenPrefs);
    setDismissed(true);
    setTimeout(() => setVisible(false), 300);

    // Only hit the consent API when user is logged in
    if (token && user) {
      const platform =
        /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios'
        : /Android/i.test(navigator.userAgent)        ? 'android'
        : 'web';

      await dispatch(recordConsent({
        documentTypes: ['cookie_policy'],
        method:        'click',
        platform,
      }));
    }
  }, [dispatch, token, user]);

  const handleAcceptAll = useCallback(() => {
    const all = { necessary: true, analytics: true, marketing: true };
    setPrefs(all);
    finalise(all);
  }, [finalise]);

  const handleRejectAll = useCallback(() => {
    const minimal = { necessary: true, analytics: false, marketing: false };
    setPrefs(minimal);
    finalise(minimal);
  }, [finalise]);

  const handleSavePrefs = useCallback(() => {
    finalise(prefs);
  }, [finalise, prefs]);

  const handleDismiss = useCallback(() => {
    // Dismiss without consent = reject all non-essential (GDPR safe)
    handleRejectAll();
  }, [handleRejectAll]);

  // Version from doc or fallback
  const version = cookieDoc?.currentVersion ?? cookieDoc?.version ?? '1.0';

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <>
          {/* ── Backdrop blur overlay (subtle) ────────────────────────────── */}
          <motion.div
            key="cookie-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[998] pointer-events-none"
            style={{ background: 'color-mix(in oklch, var(--base-300) 30%, transparent)', backdropFilter: 'blur(1px)' }}
            aria-hidden="true"
          />

          {/* ── Banner ───────────────────────────────────────────────────── */}
          <motion.div
            ref={bannerRef}
            key="cookie-banner"
            variants={BANNER_VARIANTS}
            initial="hidden"
            animate="show"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Cookie preferences"
            aria-live="polite"
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-[420px] z-[999] rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              background:   'var(--base-100)',
              borderColor:  'var(--base-300)',
              boxShadow:    '0 24px 60px -10px rgba(0,0,0,0.22), 0 4px 16px -4px rgba(0,0,0,0.10)',
            }}
          >
            {/* Accent top stripe */}
            <div
              className="h-1 w-full"
              style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
              aria-hidden="true"
            />

            {/* ── Header row ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in oklch, var(--primary) 12%, var(--base-200))', color: 'var(--primary)' }}
                  aria-hidden="true"
                >
                  <Cookie size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight" style={{ color: 'var(--base-content)' }}>
                    We use cookies
                  </p>
                  <p className="text-[10px] font-medium" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                    {cookieDoc?.title ?? 'Cookie Policy'} · v{version}
                  </p>
                </div>
              </div>

              {/* Close (= reject all) */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss and reject optional cookies"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-base-200 flex-shrink-0 mt-0.5"
                style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div className="px-5 pb-2">
              <p className="text-[12px] leading-relaxed" style={{ color: 'color-mix(in oklch, var(--base-content) 62%, transparent)' }}>
                {cookieDoc?.summary ??
                  'Likeson uses essential cookies to run the platform and optional analytics/marketing cookies to improve your experience. You can accept all, reject optional, or customise below.'}
              </p>

              {/* Key points from doc (first 3) */}
              {cookieDoc?.keyPoints?.length > 0 && (
                <ul className="mt-2 space-y-1" aria-label="Cookie policy highlights">
                  {cookieDoc.keyPoints.slice(0, 3).map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px]" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                      <span className="text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true">·</span>
                      {pt}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Cookie Settings expandable panel ───────────────────────── */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  key="settings-panel"
                  variants={SETTINGS_VARIANTS}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="overflow-hidden"
                >
                  <div
                    className="mx-4 mb-3 rounded-xl p-3 flex flex-col gap-2.5 border"
                    style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}
                  >
                    <p
                      className="text-[10px] font-black uppercase tracking-widest px-1"
                      style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}
                    >
                      Customise Preferences
                    </p>
                    {CATEGORIES.map((cat) => (
                      <CategoryToggle
                        key={cat.id}
                        category={cat}
                        checked={cat.always ? true : prefs[cat.id]}
                        onChange={handleToggle}
                      />
                    ))}

                    {/* Save prefs CTA */}
                    <button
                      type="button"
                      onClick={handleSavePrefs}
                      disabled={submitting}
                      className="w-full h-11 mt-1 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
                    >
                      <CheckCircle2 size={14} aria-hidden="true" />
                      Save My Preferences
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Action row ─────────────────────────────────────────────── */}
            <div className="px-4 pb-4 flex flex-col gap-2">

              {/* Primary: Accept All */}
              <button
                type="button"
                onClick={handleAcceptAll}
                disabled={submitting}
                aria-label="Accept all cookies including analytics and marketing"
                className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                Accept All
              </button>

              {/* Secondary row: Reject All + Cookie Settings */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRejectAll}
                  disabled={submitting}
                  aria-label="Reject optional cookies, keep only necessary"
                  className="flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-base-200 active:scale-[0.98]"
                  style={{
                    borderColor: 'var(--base-300)',
                    color:       'color-mix(in oklch, var(--base-content) 60%, transparent)',
                  }}
                >
                  <XCircle size={13} aria-hidden="true" />
                  Reject All
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings((p) => !p)}
                  aria-expanded={showSettings}
                  aria-controls="cookie-settings-panel"
                  aria-label={showSettings ? 'Hide cookie settings' : 'Open cookie settings'}
                  className="flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 hover:bg-base-200 active:scale-[0.98]"
                  style={{
                    background:  showSettings ? 'color-mix(in oklch, var(--primary) 8%, var(--base-200))' : 'transparent',
                    borderColor: showSettings ? 'color-mix(in oklch, var(--primary) 30%, transparent)'    : 'var(--base-300)',
                    color:       showSettings ? 'var(--primary)'                                           : 'color-mix(in oklch, var(--base-content) 60%, transparent)',
                  }}
                >
                  <Settings2 size={13} aria-hidden="true" />
                  Settings
                  {showSettings
                    ? <ChevronUp   size={11} aria-hidden="true" />
                    : <ChevronDown size={11} aria-hidden="true" />
                  }
                </button>
              </div>
            </div>

            {/* ── Footer: compliance note ─────────────────────────────────── */}
            <div
              className="px-5 pb-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--base-300)' }}
            >
              <p
                className="text-[9px] leading-relaxed pt-2"
                style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }}
              >
                Governed by{' '}
                <a
                  href="/legal/cookie-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:opacity-80"
                  style={{ color: 'var(--primary)' }}
                >
                  Cookie Policy
                </a>
                {' '}· DPDP Act 2023 · IT Act 2000
              </p>
              <div
                className="flex items-center gap-1 pt-2 text-[9px] font-black uppercase tracking-wider flex-shrink-0"
                style={{ color: 'color-mix(in oklch, var(--base-content) 25%, transparent)' }}
              >
                <ShieldCheck size={10} aria-hidden="true" />
                Likeson.in
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}