'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info, AlertTriangle, CheckCircle2, AlertCircle, Sparkles,
  X, ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react';

import {
  fetchMarquees,
  dismissMarquee,
  trackMarqueeClick,
  optimisticallyDismiss,
  selectMarquees,
  selectUserLoading,
} from '@/store/slices/marqueeSlice';

// ─── Static Theme Map (Zero Inline Styles) ───────────────────────────────────

const THEME_MAP = {
  info: {
    icon: Info,
    gradient: 'from-info/5 via-info/10 to-info/5 border-info/20',
    bar: 'from-info/40 via-info to-info/40',
    iconWrap: 'bg-info/10 text-info ring-1 ring-info/20',
    text: 'text-base-content',
    subtext: 'text-base-content/70',
    dot: 'bg-info',
    separator: 'text-info/30',
    pill: 'bg-info text-info-content hover:brightness-110',
    dismiss: 'text-base-content/50 hover:bg-info/20 hover:text-base-content',
    counter: 'text-base-content/50 hover:text-base-content',
    urgent: false,
  },
  success: {
    icon: CheckCircle2,
    gradient: 'from-success/5 via-success/10 to-success/5 border-success/20',
    bar: 'from-success/40 via-success to-success/40',
    iconWrap: 'bg-success/10 text-success ring-1 ring-success/20',
    text: 'text-base-content',
    subtext: 'text-base-content/70',
    dot: 'bg-success',
    separator: 'text-success/30',
    pill: 'bg-success text-success-content hover:brightness-110',
    dismiss: 'text-base-content/50 hover:bg-success/20 hover:text-base-content',
    counter: 'text-base-content/50 hover:text-base-content',
    urgent: false,
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-warning/5 via-warning/10 to-warning/5 border-warning/20',
    bar: 'from-warning/40 via-warning to-warning/40',
    iconWrap: 'bg-warning/10 text-warning ring-1 ring-warning/20',
    text: 'text-base-content',
    subtext: 'text-base-content/70',
    dot: 'bg-warning',
    separator: 'text-warning/30',
    pill: 'bg-warning text-warning-content hover:brightness-110',
    dismiss: 'text-base-content/50 hover:bg-warning/20 hover:text-base-content',
    counter: 'text-base-content/50 hover:text-base-content',
    urgent: true,
  },
  error: {
    icon: AlertCircle,
    gradient: 'from-error/5 via-error/10 to-error/5 border-error/20',
    bar: 'from-error/40 via-error to-error/40',
    iconWrap: 'bg-error/10 text-error ring-1 ring-error/20',
    text: 'text-base-content',
    subtext: 'text-base-content/70',
    dot: 'bg-error',
    separator: 'text-error/30',
    pill: 'bg-error text-error-content hover:brightness-110',
    dismiss: 'text-base-content/50 hover:bg-error/20 hover:text-base-content',
    counter: 'text-base-content/50 hover:text-base-content',
    urgent: true,
  },
  promo: {
    icon: Sparkles,
    gradient: 'from-primary/5 via-primary/10 to-primary/5 border-primary/20',
    bar: 'from-primary/40 via-primary to-primary/40',
    iconWrap: 'bg-primary/10 text-primary ring-1 ring-primary/20',
    text: 'text-base-content',
    subtext: 'text-base-content/70',
    dot: 'bg-primary',
    separator: 'text-primary/30',
    pill: 'bg-primary text-primary-content hover:brightness-110',
    dismiss: 'text-base-content/50 hover:bg-primary/20 hover:text-base-content',
    counter: 'text-base-content/50 hover:text-base-content',
    urgent: false,
  },
};

const SPEED_DURATION = { slow: 42, normal: 26, fast: 14 };
const CAROUSEL_INTERVAL_MS = 8000;
const SESSION_KEY = 'mq_dismissed';

// ─── Animation Variants ───────────────────────────────────────────────────────

const STRIP_VARIANTS = {
  hidden: { height: 0, opacity: 0 },
  show: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: 'easeInOut' } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
};

const ICON_VARIANTS = {
  hidden: { scale: 0.6, opacity: 0, rotate: -12 },
  show: { scale: 1, opacity: 1, rotate: 0, transition: { duration: 0.22, type: 'spring', damping: 14 } },
  exit: { scale: 0.6, opacity: 0, rotate: 12, transition: { duration: 0.16 } },
};

const MESSAGE_VARIANTS = {
  hidden: { y: 10, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.22 } },
  exit: { y: -10, opacity: 0, transition: { duration: 0.18 } },
};

// ─── Utility Functions ───────────────────────────────────────────────────────

const getTokens = (type) => THEME_MAP[type] || THEME_MAP.info;

const readSessionDismissed = () => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]'); } 
  catch { return []; }
};

const writeSessionDismissed = (ids) => {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids)); } 
  catch { /* noop */ }
};

const isVisibleToUser = (marquee, userRole, userId) => {
  const now = new Date();
  if (!marquee.isActive || marquee.isArchived) return false;
  if (marquee.startsAt && new Date(marquee.startsAt) > now) return false;
  if (marquee.endsAt && new Date(marquee.endsAt) <= now) return false;

  const hasTargetRoles = Array.isArray(marquee.targetRoles) && marquee.targetRoles.length > 0;
  const hasTargetUsers = Array.isArray(marquee.targetUsers) && marquee.targetUsers.length > 0;

  if (!hasTargetRoles && !hasTargetUsers) return true;
  if (hasTargetRoles && userRole && marquee.targetRoles.includes(userRole)) return true;
  if (hasTargetUsers && userId) {
    return marquee.targetUsers.some((u) => String(u?._id ?? u) === String(userId));
  }
  return false;
};

// ─── Custom Hooks ────────────────────────────────────────────────────────────

function useMarqueeData() {
  const allMarquees = useSelector(selectMarquees);
  const loading = useSelector(selectUserLoading);
  const user = useSelector((s) => s.user?.user) || null;
  const userRole = user?.role || null;
  const userId = user?._id || null;

  // Hydration safe state
  const [localDismissed, setLocalDismissed] = useState([]);

  useEffect(() => {
    setLocalDismissed(readSessionDismissed());
  }, []);

  return { allMarquees, loading, userRole, userId, localDismissed, setLocalDismissed };
}

function useCarousel(length) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setIdx((i) => (i + 1) % length), [length]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + length) % length), [length]);

  useEffect(() => {
    if (length <= 1 || paused) return;
    const timer = setInterval(next, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [length, next, paused]);

  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, length - 1)));
  }, [length]);

  return { idx, next, prev, paused, setPaused };
}

// ─── UI Components ───────────────────────────────────────────────────────────

const StatusDot = memo(({ tokens }) => (
  <span className="relative inline-flex w-2 h-2 flex-shrink-0" aria-hidden="true">
    {tokens.urgent && (
      <motion.span
        className={`absolute inset-0 rounded-full ${tokens.dot}`}
        animate={{ scale: [1, 2.4, 1], opacity: [0.65, 0, 0.65] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    )}
    <span className={`relative inline-flex w-2 h-2 rounded-full ${tokens.dot}`} />
  </span>
));
StatusDot.displayName = 'StatusDot';

const IconBubble = memo(({ tokens, animate }) => {
  const Icon = tokens.icon;
  const iconEl = <Icon className="w-3.5 h-3.5" strokeWidth={2.3} />;
  
  return (
    <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${tokens.iconWrap}`} aria-hidden="true">
      {animate ? (
        <motion.span animate={{ rotate: [-4, 4, -4] }} transition={{ duration: 0.45, repeat: Infinity, ease: 'easeInOut' }}>
          {iconEl}
        </motion.span>
      ) : iconEl}
    </span>
  );
});
IconBubble.displayName = 'IconBubble';

const AccentBar = memo(({ tokens, animated }) => {
  const barClass = `h-[2.5px] w-full bg-gradient-to-r ${tokens.bar}`;
  if (!animated) return <div className={barClass} aria-hidden="true" />;
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tokens.bar}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1, transition: { duration: 0.4, ease: 'easeOut' } }}
        className={`origin-left ${barClass}`}
        aria-hidden="true"
      />
    </AnimatePresence>
  );
});
AccentBar.displayName = 'AccentBar';

const ScrollRow = memo(({ message, subText, tokens, dur, paused }) => (
  <motion.div
    animate={paused ? {} : { x: ['100vw', '-100%'] }}
    transition={paused ? {} : { duration: dur, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
    className="whitespace-nowrap inline-flex items-center gap-10"
  >
    {[0, 1, 2].map((i) => (
      <span key={i} className="inline-flex items-center gap-3 font-poppins">
        <StatusDot tokens={tokens} />
        <span className={`text-xs font-semibold tracking-wide ${tokens.text}`}>
          {message}
        </span>
        {subText && <span className={`text-xs font-normal ${tokens.subtext}`}>— {subText}</span>}
        <span className={`text-[10px] font-bold select-none ${tokens.separator}`} aria-hidden="true">✦</span>
      </span>
    ))}
  </motion.div>
));
ScrollRow.displayName = 'ScrollRow';

const CtaPill = memo(({ cta, tokens, onCtaClick, id }) => {
  if (!cta?.url || !cta?.label) return null;
  return (
    <a
      href={cta.url}
      target={cta.target || '_self'}
      rel="noopener noreferrer"
      onClick={() => onCtaClick(id)}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-poppins ${tokens.pill}`}
      aria-label={`${cta.label}${cta.target === '_blank' ? ' (opens in new tab)' : ''}`}
    >
      {cta.label}
      {cta.target === '_blank' && <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />}
    </a>
  );
});
CtaPill.displayName = 'CtaPill';

// ─── Layout Components ────────────────────────────────────────────────────────

const MarqueeStrip = memo(({ marquee, onDismiss, onCtaClick }) => {
  const tokens = useMemo(() => getTokens(marquee.type), [marquee.type]);
  const dur = SPEED_DURATION[marquee.speed] || 26;
  const [paused, setPaused] = useState(false);

  return (
    <motion.div
      variants={STRIP_VARIANTS}
      initial="hidden"
      animate="show"
      exit="exit"
      role={tokens.urgent ? 'alert' : 'status'}
      className={`w-full border-b overflow-hidden bg-gradient-to-r ${tokens.gradient}`}
    >
      <AccentBar tokens={tokens} />
      <div className="relative flex items-center h-8 px-3 gap-2.5 max-w-screen-2xl mx-auto">
        <IconBubble tokens={tokens} animate={tokens.urgent} />

        {marquee.icon && <span className="flex-shrink-0 text-sm leading-none" aria-hidden="true">{marquee.icon}</span>}

        <div
          className="flex-1 overflow-hidden relative cursor-default"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <ScrollRow message={marquee.message} subText={marquee.subText} tokens={tokens} dur={dur} paused={paused} />
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5 ml-2">
          <CtaPill cta={marquee.cta} tokens={tokens} onCtaClick={onCtaClick} id={marquee._id} />
          {marquee.isDismissible !== false && (
            <button
              onClick={() => onDismiss(marquee._id)}
              aria-label="Dismiss announcement"
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 outline-none ${tokens.dismiss}`}
            >
              <X className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
MarqueeStrip.displayName = 'MarqueeStrip';

const MarqueeCarousel = memo(({ marquees, onDismiss, onCtaClick }) => {
  const { idx, next, prev, paused, setPaused } = useCarousel(marquees.length);
  const current = marquees[idx];
  const tokens = useMemo(() => getTokens(current?.type), [current?.type]);
  const dur = SPEED_DURATION[current?.speed] || 26;

  if (!current) return null;

  return (
    <div 
      role={tokens.urgent ? 'alert' : 'status'}
      className={`w-full border-b overflow-hidden transition-colors duration-500 bg-gradient-to-r ${tokens.gradient}`}
    >
      <AccentBar tokens={tokens} animated />
      <div className="relative flex items-center h-8 px-3 gap-2 max-w-screen-2xl mx-auto">
        <button
          onClick={prev}
          aria-label="Previous announcement"
          className={`flex-shrink-0 hidden md:flex items-center gap-0.5 text-[10px] font-bold tabular-nums transition-colors outline-none font-poppins ${tokens.counter}`}
        >
          <ChevronLeft className="w-3 h-3" aria-hidden="true" />
          <span aria-hidden="true">{idx + 1}/{marquees.length}</span>
        </button>

        <AnimatePresence mode="wait">
          <motion.div key={`icon-${current._id}`} variants={ICON_VARIANTS} initial="hidden" animate="show" exit="exit">
            <IconBubble tokens={tokens} animate={tokens.urgent} />
          </motion.div>
        </AnimatePresence>

        <div
          className="flex-1 overflow-hidden relative cursor-default"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div key={current._id} variants={MESSAGE_VARIANTS} initial="hidden" animate="show" exit="exit" className="w-full">
              <ScrollRow message={current.message} subText={current.subText} tokens={tokens} dur={dur} paused={paused} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5 ml-2">
          <CtaPill cta={current.cta} tokens={tokens} onCtaClick={onCtaClick} id={current._id} />
          {current.isDismissible !== false && (
            <button
              onClick={() => onDismiss(current._id)}
              aria-label="Dismiss announcement"
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 outline-none ${tokens.dismiss}`}
            >
              <X className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          <button onClick={next} aria-label="Next announcement" className={`flex-shrink-0 transition-colors outline-none ${tokens.counter}`}>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});
MarqueeCarousel.displayName = 'MarqueeCarousel';

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function Marquee() {
  const dispatch = useDispatch();
  const { allMarquees, loading, userRole, userId, localDismissed, setLocalDismissed } = useMarqueeData();

  useEffect(() => {
    dispatch(fetchMarquees());
  }, [dispatch, userId, userRole]);

  const visible = useMemo(() => 
    allMarquees
      .filter((m) => !localDismissed.includes(String(m._id)) && isVisibleToUser(m, userRole, userId))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    [allMarquees, localDismissed, userRole, userId]
  );

  const handleDismiss = useCallback((id) => {
    dispatch(optimisticallyDismiss(id));
    const next = [...localDismissed, String(id)];
    setLocalDismissed(next);
    writeSessionDismissed(next);
    dispatch(dismissMarquee(id));
  }, [dispatch, localDismissed, setLocalDismissed]);

  const handleCtaClick = useCallback((id) => { 
    dispatch(trackMarqueeClick(id)); 
  }, [dispatch]);

  if (loading || visible.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.section
        variants={STRIP_VARIANTS}
        initial="hidden"
        animate="show"
        exit="exit"
        className="w-full z-50 sticky top-0 bg-base-100"
        aria-label="Important Site Announcements"
      >
        {visible.length === 1 ? (
          <MarqueeStrip marquee={visible[0]} onDismiss={handleDismiss} onCtaClick={handleCtaClick} />
        ) : (
          <MarqueeCarousel marquees={visible} onDismiss={handleDismiss} onCtaClick={handleCtaClick} />
        )}
      </motion.section>
    </AnimatePresence>
  );
}