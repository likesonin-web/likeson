'use client';

/**
 * NotificationPage.jsx — Pharmacy Notification Centre
 *
 * Architecture:
 *  - Single Client Component (page-level)
 *  - All async/API work routed through Redux Toolkit slices (no direct API calls)
 *  - Memoised sub-components to prevent unnecessary re-renders
 *  - Framer Motion for entrance + micro-interaction animations
 *  - data-theme="pharmacy" activates the global CSS token set
 */

import dynamic from 'next/dynamic';
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  ChevronDown,
  Package,
  RefreshCcw,
  CreditCard,
  AlertTriangle,
  Tag,
  UserCheck,
  ClipboardList,
  FlaskConical,
  Megaphone,
  Filter,
  X,
  Loader2,
  InboxIcon,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  selectAllNotifications,
  selectUnreadCount,
  selectNotificationLoading,
  selectNotificationPagination,
} from '@/store/slices/notificationSlice';

// ─── Constants ───────────────────────────────────────────────────────────────

const PHARMACY_FILTER_GROUPS = [
  { id: 'all',          label: 'All' },
  { id: 'orders',       label: 'Orders' },
  { id: 'payments',     label: 'Payments' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'alerts',       label: 'Alerts' },
  { id: 'account',      label: 'Account' },
];

const TYPE_GROUP_MAP = {
  Order_Placed:             'orders',
  Order_Update:             'orders',
  Medicine_Ready:           'orders',
  Out_For_Delivery:         'orders',
  Order_Delivered:          'orders',
  Order_Cancelled:          'orders',
  Return_Verification:      'orders',
  Auto_Refill_Reminder:     'orders',
  Payment_Success:          'payments',
  Payment_Failed:           'payments',
  Refund_Processed:         'payments',
  Refund_Update:            'payments',
  Subscription_Activated:   'subscription',
  Subscription_Expiring_Soon:'subscription',
  Subscription_Expired:     'subscription',
  Subscription_Renewed:     'subscription',
  Subscription_Renewal_Failed:'subscription',
  SOS_Alert:                'alerts',
  Account_Security:         'account',
  Account_Status:           'account',
  KYC_Approved:             'account',
  KYC_Rejected:             'account',
  Promo_Marketing:          'alerts',
  Admin_Announcement:       'alerts',
};

const PRIORITY_META = {
  Critical: { color: 'text-error border-error/40 bg-error/10',  dot: 'bg-error' },
  High:     { color: 'text-warning border-warning/40 bg-warning/10', dot: 'bg-warning' },
  Medium:   { color: 'text-info border-info/40 bg-info/10',     dot: 'bg-info' },
  Normal:   { color: 'text-info border-info/40 bg-info/10',     dot: 'bg-info' },
  Low:      { color: 'text-base-content/50 border-base-300 bg-base-200', dot: 'bg-base-content/30' },
};

const PAGE_SIZE = 20;

// ─── Icon resolver ────────────────────────────────────────────────────────────

function resolveIcon(type) {
  if (!type) return <Bell size={16} />;
  if (type.startsWith('Order') || type === 'Medicine_Ready' || type === 'Out_For_Delivery' || type === 'Auto_Refill_Reminder' || type === 'Return_Verification')
    return <Package size={16} />;
  if (type.startsWith('Payment') || type.startsWith('Refund'))
    return <CreditCard size={16} />;
  if (type.startsWith('Subscription'))
    return <RefreshCcw size={16} />;
  if (type === 'SOS_Alert' || type === 'Account_Security')
    return <ShieldAlert size={16} />;
  if (type === 'KYC_Approved' || type === 'KYC_Rejected')
    return <UserCheck size={16} />;
  if (type === 'Lab_Report_Ready' || type.startsWith('Sample'))
    return <FlaskConical size={16} />;
  if (type === 'Promo_Marketing')
    return <Tag size={16} />;
  if (type === 'Admin_Announcement')
    return <Megaphone size={16} />;
  return <ClipboardList size={16} />;
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function formatRelative(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const NotificationSkeleton = memo(function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b border-base-300 animate-pulse">
      <div className="mt-0.5 w-8 h-8 rounded-full bg-base-300 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-base-300 rounded w-2/3" />
        <div className="h-3 bg-base-300 rounded w-full" />
        <div className="h-3 bg-base-300 rounded w-1/2" />
      </div>
      <div className="h-3 w-12 bg-base-300 rounded shrink-0 mt-1" />
    </div>
  );
});

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState({ filtered }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <InboxIcon size={28} className="text-primary/60" />
      </div>
      <h3 className="font-semibold text-base-content mb-1">
        {filtered ? 'No notifications here' : 'All caught up!'}
      </h3>
      <p className="text-sm text-base-content/55 max-w-xs">
        {filtered
          ? 'No notifications match the selected filter. Try switching categories.'
          : 'You have no notifications right now. Check back later.'}
      </p>
    </motion.div>
  );
});

// ─── Error state ──────────────────────────────────────────────────────────────

const ErrorState = memo(function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <AlertTriangle size={32} className="text-error mb-3" />
      <p className="text-sm text-base-content/70 mb-4">Failed to load notifications.</p>
      <button
        onClick={onRetry}
        className="btn-secondary text-xs px-4 py-2"
        aria-label="Retry loading notifications"
      >
        Try again
      </button>
    </div>
  );
});

// ─── Single notification row ──────────────────────────────────────────────────

const NotificationRow = memo(function NotificationRow({ notification, onRead, onDelete }) {
  const { _id, title, body, type, priority, isRead, createdAt } = notification;
  const icon     = useMemo(() => resolveIcon(type), [type]);
  const timeStr  = useMemo(() => formatRelative(createdAt), [createdAt]);
  const prioMeta = PRIORITY_META[priority] ?? PRIORITY_META.Normal;

  const handleRead = useCallback(() => {
    if (!isRead) onRead(_id);
  }, [_id, isRead, onRead]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    onDelete(_id);
  }, [_id, onDelete]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleRead}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleRead()}
      aria-label={`Notification: ${title}${isRead ? '' : ', unread'}`}
      className={[
        'group relative flex items-start gap-3 px-4 py-4 border-b border-base-300',
        'cursor-pointer transition-colors duration-150',
        isRead
          ? 'hover:bg-base-200/60'
          : 'bg-primary/[0.04] hover:bg-primary/[0.07]',
      ].join(' ')}
    >
      {/* Unread indicator */}
      {!isRead && (
        <span
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}

      {/* Icon badge */}
      <div
        className={[
          'mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          'bg-primary/10 text-primary',
        ].join(' ')}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
          <span className={`font-semibold text-sm truncate ${isRead ? 'text-base-content/70' : 'text-base-content'}`}>
            {title}
          </span>
          <span
            className={`badge text-[10px] px-1.5 py-0.5 leading-none border ${prioMeta.color}`}
            aria-label={`Priority: ${priority}`}
          >
            {priority}
          </span>
        </div>
        <p className="text-xs text-base-content/60 leading-relaxed line-clamp-2">
          {body}
        </p>
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end gap-2 shrink-0 ml-1">
        <time className="text-[11px] text-base-content/45 whitespace-nowrap" dateTime={createdAt}>
          {timeStr}
        </time>
        <button
          onClick={handleDelete}
          className={[
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
            'w-6 h-6 rounded flex items-center justify-center',
            'text-base-content/40 hover:text-error hover:bg-error/10',
          ].join(' ')}
          aria-label="Dismiss notification"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.article>
  );
});

// ─── Filter tab bar ───────────────────────────────────────────────────────────

const FilterBar = memo(function FilterBar({ active, onChange, counts }) {
  return (
    <nav
      role="tablist"
      aria-label="Filter notifications by category"
      className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-none border-b border-base-300"
    >
      {PHARMACY_FILTER_GROUPS.map(({ id, label }) => {
        const count  = counts[id] ?? 0;
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={[
              'relative shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
              isActive
                ? 'bg-primary text-primary-content shadow-sm'
                : 'text-base-content/60 hover:bg-base-200 hover:text-base-content',
            ].join(' ')}
          >
            {label}
            {count > 0 && (
              <span
                className={[
                  'ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
                  'rounded-full text-[10px] font-bold leading-none',
                  isActive
                    ? 'bg-primary-content/20 text-primary-content'
                    : 'bg-primary/15 text-primary',
                ].join(' ')}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
});

// ─── Header ───────────────────────────────────────────────────────────────────

const PageHeader = memo(function PageHeader({
  unreadCount,
  loading,
  onMarkAll,
  onRefresh,
  markingAll,
}) {
  return (
    <header className="sticky top-0 z-10 bg-base-100/90 backdrop-blur-soft border-b border-base-300 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Bell size={20} className="text-primary" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-error text-error-content text-[9px] font-black flex items-center justify-center leading-none"
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="font-bold text-base text-base-content leading-tight">Notifications</h1>
            <p className="text-[11px] text-base-content/50 leading-tight">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh notifications"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/50 hover:bg-base-200 hover:text-base-content transition-colors disabled:opacity-40"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAll}
              disabled={markingAll}
              aria-label="Mark all notifications as read"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
});

// ─── Load more trigger ────────────────────────────────────────────────────────

const LoadMoreTrigger = memo(function LoadMoreTrigger({ onLoadMore, loading, hasMore }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
      { rootMargin: '200px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-6" aria-live="polite">
      {loading && <Loader2 size={20} className="text-primary animate-spin" />}
    </div>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationPage() {
  const dispatch   = useDispatch();

  // Redux selectors
  const user        = useSelector((s) => s.user?.user) ?? null;
  const items       = useSelector(selectAllNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading     = useSelector(selectNotificationLoading);
  const pagination  = useSelector(selectNotificationPagination);

  // Local UI state
  const [activeFilter, setActiveFilter]  = useState('all');
  const [page, setPage]                  = useState(1);
  const [markingAll, setMarkingAll]      = useState(false);
  const [hasError, setHasError]          = useState(false);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    setHasError(false);
    try {
      await dispatch(fetchNotifications({ page: p, limit: PAGE_SIZE })).unwrap();
    } catch {
      setHasError(true);
    }
  }, [dispatch]);

  useEffect(() => {
    load(1);
    // Lightweight unread-count polling every 60s
    const interval = setInterval(() => dispatch(fetchUnreadCount()), 60_000);
    return () => clearInterval(interval);
  }, [load, dispatch]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRead = useCallback(async (id) => {
    try {
      await dispatch(markAsRead(id)).unwrap();
    } catch {
      toast.error('Could not mark as read');
    }
  }, [dispatch]);

  const handleDelete = useCallback(async (id) => {
    try {
      await dispatch(deleteNotification(id)).unwrap();
    } catch {
      toast.error('Could not dismiss notification');
    }
  }, [dispatch]);

  const handleMarkAll = useCallback(async () => {
    setMarkingAll(true);
    try {
      await dispatch(markAllAsRead()).unwrap();
    } catch {
      toast.error('Could not mark all as read');
    } finally {
      setMarkingAll(false);
    }
  }, [dispatch]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage);
  }, [page, load]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    load(1);
  }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  /**
   * Count unread items per filter group so badges stay accurate.
   * Memoised — only recalculated when items array reference changes.
   */
  const unreadGroupCounts = useMemo(() => {
    const counts = { all: 0 };
    PHARMACY_FILTER_GROUPS.slice(1).forEach(({ id }) => { counts[id] = 0; });

    items.forEach((n) => {
      if (n.isRead) return;
      counts.all++;
      const group = TYPE_GROUP_MAP[n.type];
      if (group) counts[group] = (counts[group] ?? 0) + 1;
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((n) => TYPE_GROUP_MAP[n.type] === activeFilter);
  }, [items, activeFilter]);

  const hasMore = useMemo(
    () => pagination.page < pagination.pages,
    [pagination]
  );

  const showSkeletons = loading && items.length === 0;
  const showEmpty     = !loading && !hasError && filteredItems.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-100">
      <main
        id="main-content"
        aria-label="Notification centre"
        className="max-w-2xl mx-auto flex flex-col"
      >
        {/* Screen-reader landmark */}
        <h2 className="sr-only">Pharmacy Notification Centre</h2>

        <PageHeader
          unreadCount={unreadCount}
          loading={loading}
          onMarkAll={handleMarkAll}
          onRefresh={handleRefresh}
          markingAll={markingAll}
        />

        <FilterBar
          active={activeFilter}
          onChange={setActiveFilter}
          counts={unreadGroupCounts}
        />

        <section aria-live="polite" aria-label="Notification list" className="flex-1">
          {/* Skeleton */}
          {showSkeletons && (
            Array.from({ length: 6 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))
          )}

          {/* Error */}
          {hasError && !loading && (
            <ErrorState onRetry={handleRefresh} />
          )}

          {/* Empty */}
          {showEmpty && (
            <EmptyState filtered={activeFilter !== 'all'} />
          )}

          {/* Notification list */}
          {!showSkeletons && !hasError && filteredItems.length > 0 && (
            <AnimatePresence initial={false}>
              {filteredItems.map((n) => (
                <NotificationRow
                  key={n._id}
                  notification={n}
                  onRead={handleRead}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          )}

          {/* Infinite scroll sentinel */}
          <LoadMoreTrigger
            onLoadMore={handleLoadMore}
            loading={loading && items.length > 0}
            hasMore={hasMore}
          />

          {/* All loaded indicator */}
          {!hasMore && filteredItems.length > 0 && !loading && (
            <p className="text-center text-xs text-base-content/35 py-6">
              You've seen all notifications
            </p>
          )}
        </section>
      </main>
    </div>
  );
}