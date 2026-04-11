'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Search,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Info,
  BadgeCheck,
  Zap,
  ShoppingBag,
  CreditCard,
  Star,
  Shield,
  Megaphone,
  FlaskConical,
  Coins,
  Users,
  Clock,
  Eye,
  EyeOff,
  Inbox,
} from 'lucide-react';

import {
  fetchPartnerNotifications,
  markPartnerNotificationRead,
  markAllPartnerNotificationsRead,
  deletePartnerNotification,
  clearPartnerNotifications,
  selectPartnerNotifications,
  selectPartnerNotificationsPagination,
  selectPartnerUnreadCount,
  selectLabLoading,
  selectLabActionLoading,
  selectLabError,
} from '@/store/slices/labSlice';

// ─── Type → icon + color map ────────────────────────────────────────────────
const TYPE_META = {
  Booking_Confirmed:          { icon: BadgeCheck,   color: 'var(--success)',  label: 'Booking' },
  Booking_Cancelled:          { icon: X,            color: 'var(--error)',    label: 'Booking' },
  Booking_Completed:          { icon: Check,        color: 'var(--success)',  label: 'Booking' },
  Booking_No_Show:            { icon: AlertCircle,  color: 'var(--warning)',  label: 'Booking' },
  Ride_Request:               { icon: Zap,          color: 'var(--accent)',   label: 'Ride' },
  Ride_Update:                { icon: Info,         color: 'var(--info)',     label: 'Ride' },
  Driver_Assigned:            { icon: Users,        color: 'var(--primary)',  label: 'Driver' },
  Driver_Arriving:            { icon: Clock,        color: 'var(--accent)',   label: 'Driver' },
  Driver_Arrived:             { icon: BadgeCheck,   color: 'var(--success)',  label: 'Driver' },
  Care_Assistant_Assigned:    { icon: Users,        color: 'var(--secondary)',label: 'Care' },
  Care_Task_Started:          { icon: Zap,          color: 'var(--info)',     label: 'Care' },
  Care_Task_Completed:        { icon: Check,        color: 'var(--success)',  label: 'Care' },
  Appointment_Reminder:       { icon: Clock,        color: 'var(--warning)',  label: 'Appointment' },
  Appointment_Confirmed:      { icon: BadgeCheck,   color: 'var(--success)',  label: 'Appointment' },
  Prescription_Added:         { icon: FlaskConical, color: 'var(--primary)',  label: 'Prescription' },
  Order_Placed:               { icon: ShoppingBag,  color: 'var(--info)',     label: 'Order' },
  Order_Delivered:            { icon: Check,        color: 'var(--success)',  label: 'Order' },
  Order_Cancelled:            { icon: X,            color: 'var(--error)',    label: 'Order' },
  Lab_Report_Ready:           { icon: FlaskConical, color: 'var(--accent)',   label: 'Lab' },
  Payment_Success:            { icon: CreditCard,   color: 'var(--success)',  label: 'Payment' },
  Payment_Failed:             { icon: CreditCard,   color: 'var(--error)',    label: 'Payment' },
  Refund_Processed:           { icon: CreditCard,   color: 'var(--info)',     label: 'Refund' },
  Subscription_Activated:     { icon: Zap,          color: 'var(--success)',  label: 'Subscription' },
  Subscription_Expiring_Soon: { icon: Clock,        color: 'var(--warning)',  label: 'Subscription' },
  Subscription_Expired:       { icon: X,            color: 'var(--error)',    label: 'Subscription' },
  KYC_Approved:               { icon: Shield,       color: 'var(--success)',  label: 'KYC' },
  KYC_Rejected:               { icon: Shield,       color: 'var(--error)',    label: 'KYC' },
  Account_Status:             { icon: BadgeCheck,   color: 'var(--primary)',  label: 'Account' },
  Account_Security:           { icon: Shield,       color: 'var(--warning)',  label: 'Security' },
  Referral_Bonus:             { icon: Users,        color: 'var(--accent)',   label: 'Referral' },
  Coins_Credited:             { icon: Coins,        color: 'var(--accent)',   label: 'Coins' },
  Coins_Redeemed:             { icon: Coins,        color: 'var(--secondary)',label: 'Coins' },
  SOS_Alert:                  { icon: AlertCircle,  color: 'var(--error)',    label: 'SOS' },
  Promo_Marketing:            { icon: Megaphone,    color: 'var(--info)',     label: 'Promo' },
  Admin_Announcement:         { icon: Megaphone,    color: 'var(--primary)',  label: 'Admin' },
};

const PRIORITY_COLOR = {
  Critical: 'var(--error)',
  High:     'var(--warning)',
  Medium:   'var(--info)',
  Normal:   'var(--info)',
  Low:      'var(--base-content)',
};

const FILTER_TABS = [
  { key: '',     label: 'All' },
  { key: 'false',label: 'Unread' },
  { key: 'true', label: 'Read' },
];

// ─── Relative time formatter ────────────────────────────────────────────────
function timeAgo(date) {
  const now  = Date.now();
  const diff = now - new Date(date).getTime();
  const s    = Math.floor(diff / 1000);
  if (s < 60)   return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────
function NotifSkeleton() {
  return (
    <div className="flex gap-4 p-5 animate-pulse">
      <div className="w-12 h-12 rounded-xl skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 skeleton rounded w-3/4" />
        <div className="h-3 skeleton rounded w-full" />
        <div className="h-3 skeleton rounded w-1/3" />
      </div>
    </div>
  );
}

// ─── Single notification card ─────────────────────────────────────────────
function NotifCard({ notif, onRead, onDelete, index }) {
  const meta = TYPE_META[notif.type] || { icon: Bell, color: 'var(--primary)', label: notif.type };
  const IconComp = meta.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0,   scale: 1 }}
      exit={{    opacity: 0, x:  24,  scale: 0.95 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={()   => setHovered(false)}
      className="relative group"
    >
      {/* Unread accent bar */}
      {!notif.isRead && (
        <motion.div
          layoutId={`bar-${notif._id}`}
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
          style={{ background: `linear-gradient(180deg, ${meta.color}, var(--secondary))` }}
        />
      )}

      <div
        className={`
          relative flex items-start gap-4 px-6 py-5 cursor-pointer
          transition-all duration-200
          ${!notif.isRead ? 'bg-[color-mix(in_oklch,var(--base-200)_80%,var(--primary)_8%)]' : 'bg-transparent'}
          hover:bg-[color-mix(in_oklch,var(--base-200)_60%,var(--primary)_6%)]
        `}
        onClick={() => !notif.isRead && onRead(notif._id)}
      >
        {/* Icon orb */}
        <div
          className="relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: `color-mix(in oklch, ${meta.color} 15%, var(--base-200))`,
            border: `1px solid color-mix(in oklch, ${meta.color} 30%, transparent)`,
            boxShadow: hovered ? `0 0 16px color-mix(in oklch, ${meta.color} 30%, transparent)` : 'none',
            transition: 'box-shadow 0.3s',
          }}
        >
          <IconComp size={20} style={{ color: meta.color }} />
          {/* Priority dot */}
          {notif.priority === 'Critical' || notif.priority === 'High' ? (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-base-100"
              style={{ background: PRIORITY_COLOR[notif.priority] }}
            />
          ) : null}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm leading-snug ${!notif.isRead ? 'font-semibold text-[color:var(--base-content)]' : 'font-medium text-[color:color-mix(in_oklch,var(--base-content)_80%,transparent)]'}`}
            >
              {notif.title}
            </p>
            <span
              className="text-[10px] font-medium flex-shrink-0 mt-0.5"
              style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}
            >
              {timeAgo(notif.createdAt)}
            </span>
          </div>
          <p
            className="text-xs mt-1 leading-relaxed line-clamp-2"
            style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}
          >
            {notif.body}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: `color-mix(in oklch, ${meta.color} 12%, transparent)`,
                color: meta.color,
                border: `1px solid color-mix(in oklch, ${meta.color} 25%, transparent)`,
              }}
            >
              {meta.label}
            </span>
            {!notif.isRead && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                  color: 'var(--primary)',
                  border: '1px solid color-mix(in oklch, var(--primary) 20%, transparent)',
                }}
              >
                New
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{    opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-1.5 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {!notif.isRead && (
                <button
                  onClick={() => onRead(notif._id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                  style={{
                    background: 'color-mix(in oklch, var(--success) 15%, var(--base-200))',
                    border: '1px solid color-mix(in oklch, var(--success) 25%, transparent)',
                    color: 'var(--success)',
                  }}
                  title="Mark as read"
                >
                  <Eye size={13} />
                </button>
              )}
              <button
                onClick={() => onDelete(notif._id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{
                  background: 'color-mix(in oklch, var(--error) 12%, var(--base-200))',
                  border: '1px solid color-mix(in oklch, var(--error) 20%, transparent)',
                  color: 'var(--error)',
                }}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Separator */}
      <div className="mx-6 h-px" style={{ background: 'var(--base-300)' }} />
    </motion.div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ filtered }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 px-6 text-center"
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: 'color-mix(in oklch, var(--primary) 10%, var(--base-200))',
          border: '1px solid color-mix(in oklch, var(--primary) 20%, transparent)',
        }}
      >
        <Inbox size={36} style={{ color: 'var(--primary)' }} />
      </div>
      <p className="text-lg font-bold" style={{ color: 'var(--base-content)' }}>
        {filtered ? 'No matching notifications' : 'All caught up!'}
      </p>
      <p className="text-sm mt-2" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
        {filtered ? 'Try adjusting your filters or search query.' : 'You have no notifications at the moment.'}
      </p>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const dispatch = useDispatch();

  const notifications  = useSelector(selectPartnerNotifications);
  const pagination     = useSelector(selectPartnerNotificationsPagination);
  const unreadCount    = useSelector(selectPartnerUnreadCount);
  const loading        = useSelector(selectLabLoading);
  const actionLoading  = useSelector(selectLabActionLoading);
  const error          = useSelector(selectLabError);

  const [page, setPage]         = useState(1);
  const [isReadFilter, setIsReadFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [search, setSearch]             = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFilters, setShowFilters]   = useState(false);

  const LIMIT = 15;

  const load = useCallback(() => {
    const params = { page, limit: LIMIT };
    if (isReadFilter !== '') params.isRead = isReadFilter;
    if (typeFilter)          params.type   = typeFilter;
    dispatch(fetchPartnerNotifications(params));
  }, [dispatch, page, isReadFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side search filter
  const displayed = search.trim()
    ? notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.body.toLowerCase().includes(search.toLowerCase())
      )
    : notifications;

  const totalPages = pagination?.totalPages || 1;

  const handleRead   = (id) => dispatch(markPartnerNotificationRead(id));
  const handleDelete = (id) => dispatch(deletePartnerNotification(id)).then(load);
  const handleReadAll = () => dispatch(markAllPartnerNotificationsRead());
  const handleClearRead = () => {
    dispatch(clearPartnerNotifications(true)).then(() => {
      setShowClearConfirm(false);
      load();
    });
  };

  const allTypes = Object.keys(TYPE_META);

  return (
    <div data-theme="lab" className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      {/* ── Background grid decoration ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(var(--primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--primary) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20">

        {/* ── Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {/* Animated bell */}
                <motion.div
                  animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                  transition={{ duration: 1.2, delay: 0.5, ease: 'easeInOut' }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    boxShadow: '0 4px 16px color-mix(in oklch, var(--primary) 40%, transparent)',
                  }}
                >
                  <Bell size={20} style={{ color: 'var(--primary-content)' }} />
                </motion.div>
                <div>
                  <h1
                    className="text-2xl font-black tracking-tight"
                    style={{
                      fontFamily: 'var(--font-display)',
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Notifications
                  </h1>
                </div>
              </div>
              <p className="text-sm ml-13" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Stay updated on all lab activity and alerts
              </p>
            </div>

            {/* Unread badge */}
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{   scale: 0, opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <motion.span
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 2.4 }}
                    className="text-3xl font-black"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: 'var(--primary)',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                    unread
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Action bar ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-4"
        >
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
            <input
              type="text"
              placeholder="Search notifications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full pl-9 pr-4 py-2.5 text-sm"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: showFilters
                ? 'color-mix(in oklch, var(--primary) 15%, var(--base-200))'
                : 'var(--base-200)',
              border: `1px solid ${showFilters ? 'color-mix(in oklch, var(--primary) 35%, transparent)' : 'var(--base-300)'}`,
              color: showFilters ? 'var(--primary)' : 'var(--base-content)',
            }}
          >
            <Filter size={14} />
            Filters
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50"
            style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
          >
            <motion.div animate={loading ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 0.8 }}>
              <RefreshCw size={14} />
            </motion.div>
          </button>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50"
              style={{
                background: 'color-mix(in oklch, var(--success) 12%, var(--base-200))',
                border: '1px solid color-mix(in oklch, var(--success) 25%, transparent)',
                color: 'var(--success)',
              }}
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}

          {/* Clear read */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
            style={{
              background: 'color-mix(in oklch, var(--error) 10%, var(--base-200))',
              border: '1px solid color-mix(in oklch, var(--error) 20%, transparent)',
              color: 'var(--error)',
            }}
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear read</span>
          </button>
        </motion.div>

        {/* ── Filter panel ────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{   height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-4"
            >
              <div
                className="p-4 rounded-2xl space-y-4"
                style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
              >
                {/* Read status tabs */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>Status</p>
                  <div className="flex gap-2">
                    {FILTER_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => { setIsReadFilter(tab.key); setPage(1); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
                        style={{
                          background: isReadFilter === tab.key
                            ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                            : 'var(--base-300)',
                          color: isReadFilter === tab.key ? 'var(--primary-content)' : 'var(--base-content)',
                          boxShadow: isReadFilter === tab.key ? '0 2px 8px color-mix(in oklch, var(--primary) 35%, transparent)' : 'none',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type filter */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => { setTypeFilter(''); setPage(1); }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200"
                      style={{
                        background: typeFilter === '' ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--base-300)',
                        color: typeFilter === '' ? 'var(--primary-content)' : 'var(--base-content)',
                      }}
                    >
                      All
                    </button>
                    {allTypes.map((t) => {
                      const m = TYPE_META[t];
                      return (
                        <button
                          key={t}
                          onClick={() => { setTypeFilter(t); setPage(1); }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200"
                          style={{
                            background: typeFilter === t
                              ? `color-mix(in oklch, ${m.color} 20%, var(--base-200))`
                              : 'var(--base-300)',
                            color: typeFilter === t ? m.color : 'color-mix(in oklch, var(--base-content) 65%, transparent)',
                            border: typeFilter === t ? `1px solid color-mix(in oklch, ${m.color} 35%, transparent)` : '1px solid transparent',
                          }}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error banner ────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1,  y: 0 }}
              exit={{   opacity: 0,  y: -8 }}
              className="alert alert-error mb-4 text-sm"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Notification list card ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            boxShadow: 'var(--shadow-depth)',
          }}
        >
          {/* Card header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{
              background: 'linear-gradient(135deg, color-mix(in oklch, var(--base-200) 60%, var(--primary) 8%), var(--base-200))',
              borderBottom: '1px solid var(--base-300)',
            }}
          >
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>
                {pagination?.total || 0} notification{pagination?.total !== 1 ? 's' : ''}
              </p>
              {(typeFilter || isReadFilter !== '') && (
                <span className="badge badge-primary text-[10px]">Filtered</span>
              )}
            </div>
            {(typeFilter || isReadFilter !== '' || search) && (
              <button
                onClick={() => { setTypeFilter(''); setIsReadFilter(''); setSearch(''); setPage(1); }}
                className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--primary)' }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => <NotifSkeleton key={i} />)}
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState filtered={!!(typeFilter || isReadFilter !== '' || search)} />
          ) : (
            <AnimatePresence mode="popLayout">
              {displayed.map((notif, i) => (
                <NotifCard
                  key={notif._id}
                  notif={notif}
                  index={i}
                  onRead={handleRead}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          )}
        </motion.div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 mt-6"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 hover:scale-105"
                  style={{
                    background: page === p
                      ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                      : 'var(--base-200)',
                    border: page === p ? 'none' : '1px solid var(--base-300)',
                    color: page === p ? 'var(--primary-content)' : 'var(--base-content)',
                    boxShadow: page === p ? '0 2px 10px color-mix(in oklch, var(--primary) 40%, transparent)' : 'none',
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
            >
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Clear confirm modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showClearConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{   opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
              onClick={() => setShowClearConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 40 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.85, y: 40 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
            >
              <div
                className="w-full max-w-sm rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--base-100)',
                  border: '1px solid var(--base-300)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                }}
              >
                {/* Modal header */}
                <div
                  className="px-6 pt-6 pb-4"
                  style={{ borderBottom: '1px solid var(--base-300)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'color-mix(in oklch, var(--error) 15%, var(--base-200))', border: '1px solid color-mix(in oklch, var(--error) 25%, transparent)' }}
                    >
                      <Trash2 size={18} style={{ color: 'var(--error)' }} />
                    </div>
                    <div>
                      <p className="font-bold text-base" style={{ color: 'var(--base-content)' }}>Clear Read Notifications</p>
                      <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>This action cannot be undone</p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>
                    All notifications marked as <strong>read</strong> will be permanently deleted. Unread notifications will remain.
                  </p>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:opacity-80"
                    style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearRead}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, var(--error), color-mix(in oklch, var(--error) 80%, var(--warning)))',
                      color: 'var(--error-content)',
                      boxShadow: '0 4px 12px color-mix(in oklch, var(--error) 35%, transparent)',
                    }}
                  >
                    {actionLoading ? 'Clearing…' : 'Clear Read'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}