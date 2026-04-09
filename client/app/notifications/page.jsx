"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, CheckCheck, RefreshCw, Search, X,
  Truck, FlaskConical, CreditCard, ShieldAlert, Megaphone,
  FileText, Package, Activity, UserCheck, UserX, KeyRound,
  AlertTriangle, Clock, Inbox, Zap, CheckCircle2, XCircle,
  Eye, SlidersHorizontal, ChevronRight,
} from 'lucide-react';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  selectAllNotifications,
  selectUnreadCount,
  selectNotificationLoading,
} from '@/store/slices/notificationSlice';
import Container from '../../components/ui/Container';

// ─── Static Configuration & Meta ──────────────────────────────────────────────

const TYPE_META = {
  Ride_Request:       { icon: Truck,         label: 'Ride Request',      theme: 'primary'   },
  Ride_Update:        { icon: Truck,         label: 'Ride Update',       theme: 'primary'   },
  Leg_Update:         { icon: Activity,      label: 'Journey Update',    theme: 'secondary' },
  Booking_Confirmed:  { icon: CheckCircle2,  label: 'Booking Confirmed', theme: 'success'   },
  Booking_Cancelled:  { icon: XCircle,       label: 'Booking Cancelled', theme: 'error'     },
  Medicine_Ready:     { icon: Package,       label: 'Medicine Ready',    theme: 'accent'    },
  Lab_Report_Ready:   { icon: FlaskConical,  label: 'Lab Report',        theme: 'info'      },
  Prescription_Added: { icon: FileText,      label: 'Prescription',      theme: 'secondary' },
  Payment_Success:    { icon: CreditCard,    label: 'Payment',           theme: 'success'   },
  Refund_Processed:   { icon: CreditCard,    label: 'Refund',            theme: 'warning'   },
  KYC_Approved:       { icon: UserCheck,     label: 'KYC Approved',      theme: 'success'   },
  KYC_Rejected:       { icon: UserX,         label: 'KYC Rejected',      theme: 'error'     },
  SOS_Alert:          { icon: ShieldAlert,   label: 'SOS Alert',         theme: 'error'     },
  Account_Security:   { icon: KeyRound,      label: 'Security',          theme: 'warning'   },
  Account_Status:     { icon: AlertTriangle, label: 'Account Status',    theme: 'warning'   },
  Promo_Marketing:    { icon: Megaphone,     label: 'Promotion',         theme: 'accent'    },
};

const THEME_CLASSES = {
  primary:   { text: 'text-primary',   bg: 'bg-primary/10',   dot: 'bg-primary'   },
  secondary: { text: 'text-secondary', bg: 'bg-secondary/10', dot: 'bg-secondary' },
  accent:    { text: 'text-accent',    bg: 'bg-accent/10',    dot: 'bg-accent'    },
  success:   { text: 'text-success',   bg: 'bg-success/10',   dot: 'bg-success'   },
  warning:   { text: 'text-warning',   bg: 'bg-warning/10',   dot: 'bg-warning'   },
  error:     { text: 'text-error',     bg: 'bg-error/10',     dot: 'bg-error'     },
  info:      { text: 'text-info',      bg: 'bg-info/10',      dot: 'bg-info'      },
};

const FILTERS = [
  { id: 'all',               label: 'All Activity' },
  { id: 'unread',            label: 'Unread'       },
  { id: 'High',              label: 'Urgent'       },
  { id: 'Payment_Success',   label: 'Financial'    },
  { id: 'Booking_Confirmed', label: 'Bookings'     },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

const relativeTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ─── Animation Variants ───────────────────────────────────────────────────────
// Enterprise motion: Snappy, low-duration, fade-focused

const listVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit:    { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

// ─── Atomic Components ────────────────────────────────────────────────────────

const SkeletonRow = memo(() => (
  <div className="flex items-start gap-4 p-5 border-b border-base-200/60 bg-base-100" aria-hidden="true">
    <div className="w-10 h-10 rounded-[var(--r-field)] bg-base-200 animate-pulse shrink-0" />
    <div className="flex-1 space-y-3 py-1">
      <div className="flex justify-between">
        <div className="h-3 bg-base-200 rounded-full w-1/4 animate-pulse" />
        <div className="h-2 bg-base-200 rounded-full w-12 animate-pulse" />
      </div>
      <div className="h-4 bg-base-200 rounded-full w-3/4 animate-pulse" />
      <div className="h-3 bg-base-200 rounded-full w-1/2 animate-pulse" />
    </div>
  </div>
));
SkeletonRow.displayName = 'SkeletonRow';

const NotificationRow = memo(({ notification, onMarkRead, isMarkingRead }) => {
  const meta   = TYPE_META[notification.type] || TYPE_META.Promo_Marketing;
  const theme  = THEME_CLASSES[meta.theme]    || THEME_CLASSES.primary;
  const Icon   = meta.icon;
  const unread = !notification.isRead;
  const isSOS  = notification.type === 'SOS_Alert';

  return (
    <motion.article
      layout
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`group relative flex items-start gap-4 p-5 border-b border-base-200/60 transition-colors duration-200 focus-within:bg-base-200/30 hover:bg-base-200/30 outline-none ${
        unread ? 'bg-primary/[0.02]' : 'bg-base-100'
      }`}
      role="listitem"
    >
      {/* Unread Indicator Bar */}
      {unread && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.dot}`} aria-hidden="true" />
      )}

      {/* Icon Area */}
      <div className="relative shrink-0 pt-1">
        <div className={`w-10 h-10 rounded-[var(--r-field)] flex items-center justify-center ${theme.bg}`}>
          <Icon className={`w-4 h-4 ${theme.text}`} aria-hidden="true" />
        </div>
        {isSOS && (
          <span className={`absolute inset-0 rounded-[var(--r-field)] ring-2 ring-error animate-ping opacity-20`} aria-hidden="true" />
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.text} font-poppins`}>
              {meta.label}
            </span>
            {notification.priority === 'High' && (
              <span className="badge badge-error py-0.5 px-1.5 text-[8px]">URGENT</span>
            )}
          </div>
          <span className="text-[11px] font-medium text-base-content/40 font-poppins shrink-0">
            {relativeTime(notification.createdAt)}
          </span>
        </div>

        <h3 className={`text-sm leading-snug font-poppins mb-1 ${unread ? 'font-bold text-base-content' : 'font-semibold text-base-content/70'}`}>
          {notification.title}
        </h3>

        <p className="text-xs text-base-content/60 leading-relaxed font-poppins line-clamp-2">
          {notification.body}
        </p>

        {/* Action Meta (Deep Links) */}
        {notification.actionData?.screen && (
          <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline cursor-pointer w-max">
            View Details <ChevronRight className="w-3 h-3" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Hover Actions */}
      <div className="flex flex-col items-end gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 pt-1">
        {unread && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onMarkRead(notification._id); }}
            disabled={isMarkingRead}
            className="w-8 h-8 rounded-[var(--r-field)] flex items-center justify-center bg-base-100 border border-base-300 text-base-content/50 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm disabled:opacity-50"
            aria-label={`Mark "${notification.title}" as read`}
            title="Mark as Read"
          >
            {isMarkingRead ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </motion.article>
  );
});
NotificationRow.displayName = 'NotificationRow';


const EnterpriseTabs = memo(({ active, onChange }) => (
  <div role="tablist" aria-label="Filter notifications" className="flex items-center gap-6 overflow-x-auto border-b border-base-300 px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
    {FILTERS.map((f) => {
      const isActive = active === f.id;
      return (
        <button
          key={f.id}
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(f.id)}
          className={`relative py-4 text-sm font-semibold transition-colors outline-none focus-visible:text-primary font-poppins whitespace-nowrap ${
            isActive ? 'text-primary' : 'text-base-content/50 hover:text-base-content/80'
          }`}
        >
          {f.label}
          {isActive && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
        </button>
      );
    })}
  </div>
));
EnterpriseTabs.displayName = 'EnterpriseTabs';


const EmptyState = memo(({ isFiltered }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center py-24 text-center px-6"
    role="status"
  >
    <div className="w-16 h-16 rounded-[var(--r-box)] bg-base-200 border border-base-300 flex items-center justify-center mb-6">
      {isFiltered ? <SlidersHorizontal className="w-6 h-6 text-base-content/30" aria-hidden="true" /> : <Inbox className="w-6 h-6 text-base-content/30" aria-hidden="true" />}
    </div>
    <h2 className="text-lg font-bold text-base-content mb-2 font-montserrat">
      {isFiltered ? 'No matches found' : 'Inbox zero'}
    </h2>
    <p className="text-sm text-base-content/50 max-w-sm leading-relaxed font-poppins">
      {isFiltered ? 'Adjust your filters or clear the search query to see more results.' : "You're all caught up. New notifications will appear here automatically."}
    </p>
  </motion.div>
));
EmptyState.displayName = 'EmptyState';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const dispatch = useDispatch();

  // Redux state
  const notifications = useSelector(selectAllNotifications) || [];
  const unreadCount   = useSelector(selectUnreadCount) || 0;
  const isLoading     = useSelector(selectNotificationLoading);
  const error         = useSelector((s) => s.notifications?.error);

  // Local state
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [markingId, setMarkingId]   = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  // Fetch data only if empty
  useEffect(() => {
    if (!notifications.length && !isLoading) {
      dispatch(fetchNotifications());
    }
  }, [dispatch, notifications.length, isLoading]);

  // Handlers
  const handleMarkRead = useCallback(async (id) => {
    setMarkingId(id);
    try { await dispatch(markAsRead(id)).unwrap(); } 
    catch { /* Handled globally */ } 
    finally { setMarkingId(null); }
  }, [dispatch]);

  const handleMarkAll = useCallback(async () => {
    if (markingAll || !unreadCount) return;
    setMarkingAll(true);
    try { await dispatch(markAllAsRead()).unwrap(); } 
    catch { /* Handled globally */ } 
    finally { setMarkingAll(false); }
  }, [dispatch, markingAll, unreadCount]);

  const handleRetry = useCallback(() => dispatch(fetchNotifications()), [dispatch]);
  const handleSearchClear = useCallback(() => setSearch(''), []);

  // Derived filtered state (Memoized)
  const filtered = useMemo(() => {
    let list = [...notifications];
    if (filter === 'unread') list = list.filter((n) => !n.isRead);
    else if (filter === 'High') list = list.filter((n) => n.priority === 'High');
    else if (filter !== 'all') list = list.filter((n) => n.type === filter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    }
    return list;
  }, [notifications, filter, search]);

  // Derived grouping state (Memoized)
  const grouped = useMemo(() => {
    const result = {};
    const now = new Date();
    filtered.forEach((n) => {
      const d = new Date(n.createdAt);
      let label;
      if (d.toDateString() === now.toDateString()) {
        label = 'Today';
      } else {
        const yd = new Date(now); 
        yd.setDate(now.getDate() - 1);
        label = d.toDateString() === yd.toDateString()
          ? 'Yesterday'
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      (result[label] = result[label] || []).push(n);
    });
    return result;
  }, [filtered]);

  const isFiltered = filter !== 'all' || search.trim().length > 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="bg-base-200 min-h-screen py-10 font-poppins text-base-content">
      <Container className="max-w-5xl">
        
        {/* ── Main Inbox Container ── */}
        <div className="card bg-base-100 flex flex-col min-h-[75vh]">
          
          {/* ── Header Area ── */}
          <header className="px-6 pt-6 pb-2 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              
              {/* Title & Badge */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[var(--r-box)] bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <Bell className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-base-content leading-none font-montserrat">Inbox</h1>
                  <p className="text-sm font-medium text-base-content/50 mt-1">
                    {unreadCount > 0 ? (
                      <span className="text-primary font-bold">{unreadCount} unread</span>
                    ) : 'All caught up'}
                  </p>
                </div>
              </div>

              {/* Toolbar Actions */}
              <div className="flex items-center gap-3">
                
                {/* Search Input */}
                <div className="relative group w-full md:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 group-focus-within:text-primary transition-colors" aria-hidden="true" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search messages..."
                    className="input-field w-full pl-10 pr-10 py-2 bg-base-200/50 border-transparent focus:bg-base-100"
                    aria-label="Search notifications"
                  />
                  {search && (
                    <button type="button" onClick={handleSearchClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-error transition-colors outline-none" aria-label="Clear search">
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="btn-secondary px-3 py-2 flex items-center justify-center bg-base-100 text-base-content border-base-300 hover:border-primary hover:text-primary disabled:opacity-50"
                  aria-label="Refresh inbox"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>

                {/* Mark All Read */}
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    disabled={markingAll}
                    className="btn-primary-cta px-4 py-2 flex items-center gap-2"
                  >
                    {markingAll ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <CheckCheck className="w-4 h-4" aria-hidden="true" />}
                    <span className="hidden sm:inline">Mark All Read</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <EnterpriseTabs active={filter} onChange={setFilter} />
          </header>

          {/* ── Feed Area ── */}
          <main className="flex-1 bg-base-100 rounded-b-[var(--r-box)] relative" aria-live="polite" aria-busy={isLoading}>
            
            {/* Skeletons */}
            {isLoading && (
              <div className="w-full">
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertTriangle className="w-8 h-8 text-error mb-3" />
                <h3 className="text-base font-bold text-base-content mb-1">Failed to load inbox</h3>
                <p className="text-sm text-base-content/50 mb-4">{error}</p>
                <button onClick={handleRetry} className="btn-secondary px-4 py-2">Try Again</button>
              </div>
            )}

            {/* Results Feed */}
            {!isLoading && !error && hasResults && (
              <motion.div variants={listVariants} initial="hidden" animate="visible" role="feed">
                {Object.entries(grouped).map(([dateLabel, group]) => (
                  <section key={dateLabel} aria-label={`Notifications from ${dateLabel}`}>
                    
                    {/* Sticky Date Header */}
                    <div className="sticky top-0 z-10 bg-base-100/95 backdrop-blur-sm border-b border-base-200 px-6 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">{dateLabel}</span>
                      <span className="badge badge-info py-0.5 px-1.5 text-[9px] bg-base-200 border-none text-base-content/50">{group.length}</span>
                    </div>

                    <div className="w-full">
                      <AnimatePresence mode="popLayout">
                        {group.map((n) => (
                          <NotificationRow
                            key={n._id}
                            notification={n}
                            onMarkRead={handleMarkRead}
                            isMarkingRead={markingId === n._id}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </section>
                ))}
                
                {/* End Marker */}
                <div className="py-8 flex items-center justify-center gap-2 text-xs font-bold text-base-content/20 uppercase tracking-widest">
                  End of results
                </div>
              </motion.div>
            )}

            {/* Empty State */}
            {!isLoading && !error && !hasResults && <EmptyState isFiltered={isFiltered} />}
            
          </main>
        </div>
      </Container>
    </div>
  );
}