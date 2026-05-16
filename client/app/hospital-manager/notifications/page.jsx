'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, CheckCheck, Trash2, Filter, Search,
  CalendarDays, DollarSign, Users, ShieldCheck, AlertCircle,
  Info, TrendingUp, Clock, ChevronRight, Loader2, Inbox,
  Stethoscope, Activity, Star, Zap, RefreshCw, X,
} from 'lucide-react';
import {
  fetchNotifications,
  markNotificationsRead,
  selectNotifications,
  selectUnreadCount,
  selectNotificationsPagination,
  isLoading,
  fetchNotifications as fetchNotificationsThunk,
} from '@/store/slices/hospitalManagerSlice';

// ─── type → icon/color map ────────────────────────────────────────────────────

const TYPE_CONFIG = {
  Account_Status:          { icon: ShieldCheck,   color: 'var(--color-info)',    label: 'Account'       },
  Booking_Confirmed:       { icon: CalendarDays,  color: 'var(--color-success)', label: 'Booking'       },
  Booking_Cancelled:       { icon: CalendarDays,  color: 'var(--color-error)',   label: 'Booking'       },
  Booking_Completed:       { icon: CalendarDays,  color: 'var(--color-success)', label: 'Booking'       },
  Appointment_Confirmed:   { icon: CalendarDays,  color: 'var(--color-success)', label: 'Appointment'   },
  Appointment_Reminder:    { icon: Clock,         color: 'var(--color-warning)', label: 'Reminder'      },
  Payment_Success:         { icon: DollarSign,    color: 'var(--color-success)', label: 'Payment'       },
  Payment_Failed:          { icon: DollarSign,    color: 'var(--color-error)',   label: 'Payment'       },
  Refund_Processed:        { icon: DollarSign,    color: 'var(--color-info)',    label: 'Refund'        },
  KYC_Approved:            { icon: ShieldCheck,   color: 'var(--color-success)', label: 'KYC'           },
  KYC_Rejected:            { icon: ShieldCheck,   color: 'var(--color-error)',   label: 'KYC'           },
  Subscription_Activated:  { icon: Zap,           color: 'var(--color-primary)', label: 'Subscription'  },
  Subscription_Expired:    { icon: Zap,           color: 'var(--color-error)',   label: 'Subscription'  },
  Admin_Announcement:      { icon: Info,          color: 'var(--color-accent)',  label: 'Admin'         },
  SOS_Alert:               { icon: AlertCircle,   color: 'var(--color-error)',   label: 'SOS'           },
  Promo_Marketing:         { icon: TrendingUp,    color: 'var(--color-chart-4)', label: 'Promo'         },
  Referral_Bonus:          { icon: Star,          color: 'var(--color-chart-4)', label: 'Referral'      },
  Coins_Credited:          { icon: Star,          color: 'var(--color-warning)', label: 'Coins'         },
  default:                 { icon: Bell,          color: 'var(--color-primary)', label: 'Notification'  },
};

function getConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.default;
}

// ─── filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'unread',   label: 'Unread' },
  { key: 'Account',  label: 'Account' },
  { key: 'Booking',  label: 'Bookings' },
  { key: 'Payment',  label: 'Payments' },
  { key: 'Admin',    label: 'Admin' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)    return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] },
  }),
};

const itemVariants = {
  hidden:  { opacity: 0, x: -16, height: 0 },
  visible: { opacity: 1, x: 0, height: 'auto', transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 16, height: 0, transition: { duration: 0.25 } },
};

// ─── notification item ────────────────────────────────────────────────────────

function NotificationItem({ notif, onMarkRead, onSelect, isSelected }) {
  const cfg  = getConfig(notif.type);
  const Icon = cfg.icon;

  const priorityBadge = {
    Critical: { label: 'Critical', bg: 'var(--color-error)',   text: 'var(--color-error-content)'   },
    High:     { label: 'High',     bg: 'var(--color-warning)', text: 'var(--color-warning-content)' },
    Medium:   null,
    Normal:   null,
    Low:      null,
  };
  const badge = priorityBadge[notif.priority];

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={`group relative cursor-pointer rounded-2xl border transition-all duration-200 overflow-hidden ${
        !notif.isRead
          ? 'bg-[color:var(--color-primary)]/4 border-[color:var(--color-primary)]/20 hover:border-[color:var(--color-primary)]/40'
          : 'bg-[color:var(--color-base-100)] border-[color:var(--color-base-300)] hover:border-[color:var(--color-primary)]/25'
      } ${isSelected ? 'ring-1 ring-[color:var(--color-primary)]/40 shadow-lg shadow-[color:var(--color-primary)]/8' : ''}`}
      onClick={() => onSelect(notif._id)}
    >
      {/* Unread bar */}
      {!notif.isRead && (
        <motion.div
          layoutId={`unread-${notif._id}`}
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: cfg.color }}
        />
      )}

      <div className="flex items-start gap-4 p-4 pl-5">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
          style={{ background: `color-mix(in oklch, ${cfg.color} 15%, transparent)` }}
        >
          <Icon size={18} style={{ color: cfg.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm leading-snug ${!notif.isRead ? 'font-bold text-[color:var(--color-base-content)]' : 'font-medium text-[color:var(--color-base-content)]/70'}`}>
              {notif.title}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {badge && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: `color-mix(in oklch, ${badge.bg} 15%, transparent)`,
                    color: badge.bg,
                  }}
                >
                  {badge.label}
                </span>
              )}
              <span className="text-xs text-[color:var(--color-base-content)]/35 whitespace-nowrap">
                {relativeTime(notif.createdAt)}
              </span>
            </div>
          </div>

          <p className="mt-1 text-xs text-[color:var(--color-base-content)]/55 leading-relaxed line-clamp-2">
            {notif.body}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: `color-mix(in oklch, ${cfg.color} 10%, transparent)`,
                color: cfg.color,
              }}
            >
              {cfg.label}
            </span>

            {!notif.isRead && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkRead(notif._id); }}
                className="text-xs font-semibold text-[color:var(--color-primary)] hover:underline opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden border-t border-[color:var(--color-base-300)]/50"
          >
            <div className="px-5 py-4 pl-[4.25rem]">
              <p className="text-sm text-[color:var(--color-base-content)]/65 leading-relaxed">
                {notif.body}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-[color:var(--color-base-content)]/40">
                <span>Type: <strong className="text-[color:var(--color-base-content)]/60">{notif.type?.replace(/_/g, ' ')}</strong></span>
                <span>Priority: <strong className="text-[color:var(--color-base-content)]/60">{notif.priority}</strong></span>
                {notif.isRead && notif.readAt && (
                  <span>Read: <strong className="text-[color:var(--color-base-content)]/60">{relativeTime(notif.readAt)}</strong></span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-[color:var(--color-base-200)] flex items-center justify-center mb-4">
        {filtered ? <Search size={28} className="text-[color:var(--color-base-content)]/25" /> : <Inbox size={28} className="text-[color:var(--color-base-content)]/25" />}
      </div>
      <p className="font-bold text-[color:var(--color-base-content)]">
        {filtered ? 'No results found' : 'All caught up!'}
      </p>
      <p className="text-sm text-[color:var(--color-base-content)]/45 mt-1">
        {filtered ? 'Try adjusting your search or filter.' : 'No notifications at the moment.'}
      </p>
    </motion.div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export default function Notifications() {
  const dispatch    = useDispatch();
  const notifs      = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const pagination  = useSelector(selectNotificationsPagination);
  const loading     = useSelector(isLoading(fetchNotificationsThunk));

  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage]        = useState(1);

  const load = useCallback(
    (p = 1, unreadOnly = false) => {
      dispatch(fetchNotifications({ page: p, limit: 15, unreadOnly }));
    },
    [dispatch]
  );

  useEffect(() => {
    load(1, activeFilter === 'unread');
    setPage(1);
  }, [activeFilter]);

  // Filter + search in-memory for label-based filters
  const filtered = notifs.filter((n) => {
    if (activeFilter === 'unread' && n.isRead) return false;
    if (!['all', 'unread'].includes(activeFilter)) {
      const cfg = getConfig(n.type);
      if (cfg.label !== activeFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleMarkRead = (id) => {
    dispatch(markNotificationsRead([id]));
  };

  const handleMarkAllRead = () => {
    dispatch(markNotificationsRead([]));
  };

  const handleRefresh = () => {
    load(1, activeFilter === 'unread');
  };

  return (
    <div className="min-h-screen bg-[color:var(--color-base-200)] p-3">

      {/* ── Header ── */}
      <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-primary)]/70">
              Inbox
            </span>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-3xl lg:text-4xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)] leading-tight">
                Notifications
              </h1>
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-xl text-sm font-black text-white"
                    style={{ background: 'var(--color-error)' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] text-sm font-semibold text-[color:var(--color-base-content)]/70 hover:border-[color:var(--color-primary)]/40 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </motion.button>

            {unreadCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[color:var(--color-primary)] text-[color:var(--color-primary-content)] text-sm font-bold shadow-lg shadow-[color:var(--color-primary)]/20"
              >
                <CheckCheck size={15} />
                Mark All Read
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Summary Strip ── */}
      <motion.div
        variants={fadeUp}
        custom={1}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-3 gap-4 mb-6"
      >
        {[
          { label: 'Total',   value: pagination?.total ?? notifs.length, color: 'var(--color-primary)', icon: Bell },
          { label: 'Unread',  value: unreadCount, color: 'var(--color-error)', icon: BellOff },
          { label: 'Read',    value: (pagination?.total ?? notifs.length) - unreadCount, color: 'var(--color-success)', icon: CheckCheck },
        ].map((s) => {
          const SIcon = s.icon;
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] px-5 py-4 shadow-sm"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `color-mix(in oklch, ${s.color} 15%, transparent)` }}
              >
                <SIcon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)]">{s.value}</p>
                <p className="text-xs text-[color:var(--color-base-content)]/45">{s.label}</p>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ── Filters & Search ── */}
      <motion.div
        variants={fadeUp}
        custom={2}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[color:var(--color-base-100)] border border-[color:var(--color-base-300)] overflow-x-auto shadow-sm flex-shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                activeFilter === f.key
                  ? 'bg-[color:var(--color-primary)] text-[color:var(--color-primary-content)] shadow-sm'
                  : 'text-[color:var(--color-base-content)]/55 hover:text-[color:var(--color-base-content)] hover:bg-[color:var(--color-base-200)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-base-content)]/35" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications…"
            className="w-full h-10 pl-9 pr-9 text-sm rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] text-[color:var(--color-base-content)] placeholder:text-[color:var(--color-base-content)]/35 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/30 focus:border-[color:var(--color-primary)]/50 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-base-content)]/40 hover:text-[color:var(--color-base-content)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Notification List ── */}
      {loading && notifs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 rounded-full border-2 border-[color:var(--color-base-300)] border-t-[color:var(--color-primary)]"
          />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filtered={!!search || activeFilter !== 'all'} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((notif, i) => (
              <NotificationItem
                key={notif._id}
                notif={notif}
                onMarkRead={handleMarkRead}
                onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
                isSelected={selected === notif._id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination?.pages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-3 mt-8"
        >
          <button
            onClick={() => { setPage((p) => p - 1); load(page - 1, activeFilter === 'unread'); }}
            disabled={page <= 1 || loading}
            className="px-4 py-2 rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] text-sm font-semibold text-[color:var(--color-base-content)]/60 disabled:opacity-40 hover:border-[color:var(--color-primary)]/40 transition-colors"
          >
            Previous
          </button>

          <span className="text-sm font-bold text-[color:var(--color-base-content)]">
            Page {page} of {pagination.pages}
          </span>

          <button
            onClick={() => { setPage((p) => p + 1); load(page + 1, activeFilter === 'unread'); }}
            disabled={page >= pagination.pages || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] text-sm font-semibold text-[color:var(--color-base-content)]/60 disabled:opacity-40 hover:border-[color:var(--color-primary)]/40 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </motion.div>
      )}
    </div>
  );
}