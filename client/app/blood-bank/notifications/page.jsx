'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, CheckCheck, Trash2, RefreshCw,
  Droplets, FlaskConical, ClipboardList, CreditCard,
  ShieldAlert, Package, Siren, Megaphone, UserCheck,
  ChevronRight, Filter, SlidersHorizontal, Inbox,
  AlertTriangle, Clock, Circle,
} from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  selectAllNotifications,
  selectUnreadCount,
  selectNotificationPagination,
  selectNotificationLoading,
  clearNotificationError,
} from '@/store/slices/notificationSlice';

// ─── Type → Icon + color ────────────────────────────────────────────────────

const TYPE_META = {
  // Booking
  Booking_Confirmed:  { icon: ClipboardList, color: 'text-success',  bg: 'bg-success/10',  label: 'Booking'     },
  Booking_Cancelled:  { icon: ClipboardList, color: 'text-error',    bg: 'bg-error/10',    label: 'Booking'     },
  Booking_Completed:  { icon: ClipboardList, color: 'text-info',     bg: 'bg-info/10',     label: 'Booking'     },
  Booking_No_Show:    { icon: ClipboardList, color: 'text-warning',  bg: 'bg-warning/10',  label: 'Booking'     },
  // Ride
  Ride_Request:       { icon: Droplets,      color: 'text-primary',  bg: 'bg-primary/10',  label: 'Ride'        },
  Ride_Update:        { icon: Droplets,      color: 'text-primary',  bg: 'bg-primary/10',  label: 'Ride'        },
  Driver_Assigned:    { icon: UserCheck,     color: 'text-success',  bg: 'bg-success/10',  label: 'Driver'      },
  Driver_Arriving:    { icon: UserCheck,     color: 'text-info',     bg: 'bg-info/10',     label: 'Driver'      },
  Driver_Arrived:     { icon: UserCheck,     color: 'text-success',  bg: 'bg-success/10',  label: 'Driver'      },
  // Care
  Care_Assistant_Assigned: { icon: UserCheck, color: 'text-accent', bg: 'bg-accent/10',   label: 'Care'        },
  Care_Assistant_Arriving: { icon: UserCheck, color: 'text-accent', bg: 'bg-accent/10',   label: 'Care'        },
  Care_Task_Started:  { icon: UserCheck,     color: 'text-accent',  bg: 'bg-accent/10',   label: 'Care'        },
  Care_Task_Completed:{ icon: UserCheck,     color: 'text-success', bg: 'bg-success/10',  label: 'Care'        },
  Leg_Update:         { icon: UserCheck,     color: 'text-info',    bg: 'bg-info/10',     label: 'Care'        },
  // Doctor
  Appointment_Reminder:  { icon: Bell,       color: 'text-warning', bg: 'bg-warning/10',  label: 'Appointment' },
  Appointment_Confirmed: { icon: Bell,       color: 'text-success', bg: 'bg-success/10',  label: 'Appointment' },
  Consultation_Started:  { icon: Bell,       color: 'text-info',    bg: 'bg-info/10',     label: 'Consultation'},
  Prescription_Added:    { icon: FlaskConical,color:'text-primary', bg: 'bg-primary/10',  label: 'Prescription'},
  Prescription_Update:   { icon: FlaskConical,color:'text-primary', bg: 'bg-primary/10',  label: 'Prescription'},
  Follow_Up_Due:         { icon: Clock,      color: 'text-warning', bg: 'bg-warning/10',  label: 'Follow-up'   },
  // Pharmacy
  Order_Placed:       { icon: Package,       color: 'text-info',    bg: 'bg-info/10',     label: 'Order'       },
  Order_Update:       { icon: Package,       color: 'text-primary', bg: 'bg-primary/10',  label: 'Order'       },
  Medicine_Ready:     { icon: Package,       color: 'text-success', bg: 'bg-success/10',  label: 'Pharmacy'    },
  Out_For_Delivery:   { icon: Package,       color: 'text-info',    bg: 'bg-info/10',     label: 'Delivery'    },
  Order_Delivered:    { icon: Package,       color: 'text-success', bg: 'bg-success/10',  label: 'Delivery'    },
  Order_Cancelled:    { icon: Package,       color: 'text-error',   bg: 'bg-error/10',    label: 'Order'       },
  Return_Verification:{ icon: Package,       color: 'text-warning', bg: 'bg-warning/10',  label: 'Return'      },
  Refund_Update:      { icon: CreditCard,    color: 'text-success', bg: 'bg-success/10',  label: 'Refund'      },
  Auto_Refill_Reminder:{ icon: Package,      color: 'text-warning', bg: 'bg-warning/10',  label: 'Refill'      },
  // Lab
  Sample_Collection_Scheduled: { icon: FlaskConical, color: 'text-info',    bg: 'bg-info/10',    label: 'Lab' },
  Sample_Collected:   { icon: FlaskConical,  color: 'text-primary', bg: 'bg-primary/10',  label: 'Lab'         },
  Lab_Report_Ready:   { icon: FlaskConical,  color: 'text-success', bg: 'bg-success/10',  label: 'Lab'         },
  // Payment
  Payment_Success:    { icon: CreditCard,    color: 'text-success', bg: 'bg-success/10',  label: 'Payment'     },
  Payment_Failed:     { icon: CreditCard,    color: 'text-error',   bg: 'bg-error/10',    label: 'Payment'     },
  Refund_Processed:   { icon: CreditCard,    color: 'text-success', bg: 'bg-success/10',  label: 'Refund'      },
  // Subscription
  Subscription_Activated:     { icon: ShieldAlert, color: 'text-success', bg: 'bg-success/10', label: 'Subscription' },
  Subscription_Expiring_Soon: { icon: ShieldAlert, color: 'text-warning', bg: 'bg-warning/10', label: 'Subscription' },
  Subscription_Expired:       { icon: ShieldAlert, color: 'text-error',   bg: 'bg-error/10',   label: 'Subscription' },
  Subscription_Renewed:       { icon: ShieldAlert, color: 'text-success', bg: 'bg-success/10', label: 'Subscription' },
  Subscription_Renewal_Failed:{ icon: ShieldAlert, color: 'text-error',   bg: 'bg-error/10',   label: 'Subscription' },
  // KYC
  KYC_Approved:  { icon: UserCheck, color: 'text-success', bg: 'bg-success/10', label: 'KYC'     },
  KYC_Rejected:  { icon: UserCheck, color: 'text-error',   bg: 'bg-error/10',   label: 'KYC'     },
  Account_Security: { icon: ShieldAlert, color: 'text-warning', bg: 'bg-warning/10', label: 'Security' },
  Account_Status:   { icon: ShieldAlert, color: 'text-info',    bg: 'bg-info/10',    label: 'Account'  },
  // Rewards
  Referral_Bonus: { icon: Droplets, color: 'text-accent',  bg: 'bg-accent/10',  label: 'Referral' },
  Coins_Credited: { icon: Droplets, color: 'text-accent',  bg: 'bg-accent/10',  label: 'Coins'    },
  Coins_Redeemed: { icon: Droplets, color: 'text-primary', bg: 'bg-primary/10', label: 'Coins'    },
  // Admin
  SOS_Alert:          { icon: Siren,     color: 'text-error',   bg: 'bg-error/10',    label: 'SOS'         },
  Promo_Marketing:    { icon: Megaphone, color: 'text-accent',  bg: 'bg-accent/10',   label: 'Promo'       },
  Admin_Announcement: { icon: Megaphone, color: 'text-primary', bg: 'bg-primary/10',  label: 'Announcement'},
};

const PRIORITY_DOT = {
  Critical: 'bg-error animate-pulse',
  High:     'bg-warning',
  Medium:   'bg-info',
  Normal:   'bg-info',
  Low:      'bg-base-content/30',
};

// ─── Relative time ───────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',      label: 'All'      },
  { key: 'unread',   label: 'Unread'   },
  { key: 'Critical', label: 'Critical' },
  { key: 'High',     label: 'High'     },
];

// ─── Single Notification Card ─────────────────────────────────────────────────

function NotifCard({ notif, onRead, onDelete }) {
  const meta  = TYPE_META[notif.type] ?? { icon: Bell, color: 'text-primary', bg: 'bg-primary/10', label: notif.type };
  const Icon  = meta.icon;
  const dotCls = PRIORITY_DOT[notif.priority] ?? 'bg-base-content/30';
  const isSOS  = notif.priority === 'Critical';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`
        relative flex gap-4 px-4 py-4 rounded-xl border transition-colors duration-150 group
        ${notif.isRead
          ? 'bg-base-100 border-base-300/60'
          : isSOS
            ? 'bg-error/5 border-error/30'
            : 'bg-primary/5 border-primary/20'}
      `}
    >
      {/* Unread stripe */}
      {!notif.isRead && (
        <span className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${isSOS ? 'bg-error' : 'bg-primary'}`} />
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center`}>
        <Icon className={`w-[18px] h-[18px] ${meta.color}`} strokeWidth={2} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
            {/* Priority dot */}
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
              <span className="text-[10px] font-mono text-base-content/40">{notif.priority}</span>
            </span>
          </div>
          {/* Timestamp */}
          <span className="text-[10px] font-mono text-base-content/40 flex-shrink-0 mt-0.5">
            {relativeTime(notif.createdAt)}
          </span>
        </div>

        <p className={`mt-1.5 text-sm font-bold leading-snug ${notif.isRead ? 'text-base-content/80' : 'text-base-content'}`}>
          {notif.title}
        </p>
        <p className="mt-0.5 text-xs text-base-content/60 leading-relaxed line-clamp-2">
          {notif.body}
        </p>

        {/* Actions */}
        <div className="mt-2.5 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {!notif.isRead && (
            <button
              onClick={() => onRead(notif._id)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark read
            </button>
          )}
          <button
            onClick={() => onDelete(notif._id)}
            className="flex items-center gap-1 text-xs font-semibold text-error/60 hover:text-error transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Dismiss
          </button>
          {notif.actionUrl && (
            <a
              href={notif.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-semibold text-base-content/50 hover:text-base-content transition-colors ml-auto"
            >
              View <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 gap-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-base-300/60 flex items-center justify-center">
        <Inbox className="w-7 h-7 text-base-content/30" />
      </div>
      <div>
        <p className="text-sm font-bold text-base-content/50">
          {tab === 'unread' ? 'All caught up' : 'No notifications'}
        </p>
        <p className="text-xs text-base-content/30 mt-1">
          {tab === 'unread' ? 'No unread notifications right now.' : 'Nothing here yet.'}
        </p>
      </div>
    </motion.div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const dispatch   = useDispatch();
  const items      = useSelector(selectAllNotifications);
  const unread     = useSelector(selectUnreadCount);
  const pagination = useSelector(selectNotificationPagination);
  const loading    = useSelector(selectNotificationLoading);

  const [tab,        setTab]        = useState('all');
  const [page,       setPage]       = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // Initial load
  useEffect(() => {
    dispatch(fetchNotifications({ page, limit: 20 }));
    dispatch(fetchUnreadCount());
  }, [dispatch, page]);

  // Filter logic
  const filtered = items.filter(n => {
    if (tab === 'unread')   return !n.isRead;
    if (tab === 'Critical') return n.priority === 'Critical';
    if (tab === 'High')     return n.priority === 'High';
    return true;
  });

  const handleRead = useCallback((id) => {
    dispatch(markAsRead(id));
  }, [dispatch]);

  const handleDelete = useCallback((id) => {
    dispatch(deleteNotification(id));
  }, [dispatch]);

  const handleMarkAll = useCallback(() => {
    dispatch(markAllAsRead());
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchNotifications({ page, limit: 20 }));
    await dispatch(fetchUnreadCount());
    setRefreshing(false);
  }, [dispatch, page]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-montserrat font-black text-2xl md:text-3xl text-base-content tracking-tight">
              Notifications
            </h1>
            {unread > 0 && (
              <motion.span
                key={unread}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5
                  rounded-full bg-error text-error-content text-[11px] font-black"
              >
                {unread > 99 ? '99+' : unread}
              </motion.span>
            )}
          </div>
          <p className="text-xs font-mono text-base-content/40 mt-1">
            {pagination.total ?? 0} total · {unread} unread
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleRefresh}
            className="p-2 rounded-xl border border-base-300/60 bg-base-100 hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-[16px] h-[16px] ${refreshing ? 'animate-spin' : ''}`} />
          </motion.button>

          {unread > 0 && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleMarkAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
                bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mark all read</span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ── Filter tabs ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.06 }}
        className="flex gap-1 p-1 bg-base-200 rounded-xl w-fit"
      >
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150
              ${tab === t.key
                ? 'bg-base-100 text-base-content shadow-sm'
                : 'text-base-content/50 hover:text-base-content'
              }`}
          >
            {t.label}
            {/* unread dot on Unread tab */}
            {t.key === 'unread' && unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-error rounded-full" />
            )}
            {/* critical dot */}
            {t.key === 'Critical' && items.some(n => n.priority === 'Critical' && !n.isRead) && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-error rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </motion.div>

      {/* ── List ── */}
      {loading && items.length === 0 ? (
        /* Skeleton */
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 rounded-xl border border-base-300/60 bg-base-100">
              <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-3.5 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <motion.div layout className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map(notif => (
              <NotifCard
                key={notif._id}
                notif={notif}
                onRead={handleRead}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Pagination ── */}
      {pagination.pages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between pt-2"
        >
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-base-300/60
              disabled:opacity-30 disabled:cursor-not-allowed
              hover:bg-base-200 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs font-mono text-base-content/40">
            {page} / {pagination.pages}
          </span>
          <button
            disabled={page === pagination.pages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-base-300/60
              disabled:opacity-30 disabled:cursor-not-allowed
              hover:bg-base-200 transition-colors"
          >
            Next →
          </button>
        </motion.div>
      )}
    </div>
  );
}