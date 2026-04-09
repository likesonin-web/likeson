"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
  Car,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Info,
  Star,
  Gift,
  Megaphone,
  Calendar,
  Package,
  FlaskConical,
  Zap,
  TrendingUp,
  BarChart3,
  PieChart,
  Clock,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Activity,
  ClipboardList,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  selectNotifications,
  selectUnreadCount,
  selectLoading,
} from "@/store/slices/soloDriverSlice";

// ── Type → Icon + Color map (Aligned with Mongoose Model) ──────────────────
const TYPE_META = {
  // Rides & Bookings
  Ride_Request:      { icon: Car,          color: "var(--primary)",  label: "Ride Request",       group: "rides" },
  Ride_Update:       { icon: Car,          color: "var(--primary)",  label: "Ride Update",        group: "rides" },
  Driver_Assigned:   { icon: Car,          color: "var(--primary)",  label: "Driver Assigned",    group: "rides" },
  Driver_Arriving:   { icon: Car,          color: "var(--info)",     label: "Driver Arriving",    group: "rides" },
  Driver_Arrived:    { icon: Car,          color: "var(--success)",  label: "Driver Arrived",     group: "rides" },
  Booking_Confirmed: { icon: CheckCheck,   color: "var(--success)",  label: "Booking Confirmed",  group: "rides" },
  Booking_Cancelled: { icon: X,            color: "var(--error)",    label: "Booking Cancelled",  group: "rides" },
  Booking_Completed: { icon: Star,         color: "var(--accent)",   label: "Booking Completed",  group: "rides" },
  
  // Health & Clinical (New categories from Model)
  Lab_Report_Ready:     { icon: FlaskConical, color: "var(--info)",     label: "Lab Report",         group: "clinical" },
  Appointment_Reminder: { icon: Calendar,     color: "var(--warning)",  label: "Appointment",        group: "clinical" },
  Prescription_Added:   { icon: ClipboardList,color: "var(--success)",  label: "Prescription",       group: "clinical" },
  Order_Update:         { icon: Package,      color: "var(--primary)",  label: "Order Update",       group: "general" },

  // Payments & Subscription
  Payment_Success:   { icon: CreditCard,   color: "var(--success)",  label: "Payment Success",    group: "payments" },
  Payment_Failed:    { icon: CreditCard,   color: "var(--error)",    label: "Payment Failed",     group: "payments" },
  Refund_Processed:  { icon: CreditCard,   color: "var(--warning)",  label: "Refund Processed",   group: "payments" },
  Subscription_Activated: { icon: Zap,     color: "var(--success)",  label: "Subscription",       group: "account" },
  
  // Account & KYC
  KYC_Approved:      { icon: ShieldCheck,  color: "var(--success)",  label: "KYC Approved",       group: "account" },
  KYC_Rejected:      { icon: AlertTriangle,color: "var(--error)",    label: "KYC Rejected",       group: "account" },
  Account_Status:    { icon: Info,         color: "var(--info)",     label: "Account Status",     group: "account" },
  
  // Rewards & Admin
  Referral_Bonus:    { icon: Gift,         color: "var(--accent)",   label: "Referral Bonus",     group: "rewards" },
  Coins_Credited:    { icon: Gift,         color: "var(--accent)",   label: "Coins Credited",     group: "rewards" },
  Promo_Marketing:   { icon: Megaphone,    color: "var(--warning)",  label: "Promotion",          group: "general" },
  Admin_Announcement:{ icon: Megaphone,    color: "var(--info)",     label: "Announcement",       group: "general" },
  SOS_Alert:         { icon: AlertTriangle,color: "var(--error)",    label: "SOS Alert",          group: "general" },
};

const DEFAULT_META = { icon: Bell, color: "var(--neutral)", label: "Notification", group: "general" };

const PRIORITY_BADGE = {
  Critical: { cls: "badge-error",   label: "Critical" },
  High:     { cls: "badge-warning", label: "High" },
  Medium:   { cls: "badge-info",    label: "Medium" },
  Normal:   { cls: "badge-info",    label: "Normal" },
  Low:      { cls: "badge-primary", label: "Low" },
};

const FILTER_TABS = [
  { id: "all",      label: "All",       icon: Bell },
  { id: "unread",   label: "Unread",    icon: BellRing },
  { id: "rides",    label: "Rides",     icon: Car },
  { id: "clinical", label: "Medical",   icon: Activity },
  { id: "payments", label: "Payments",  icon: CreditCard },
  { id: "account",  label: "Account",   icon: ShieldCheck },
];

const PIE_COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--accent)", "var(--error)", "var(--info)"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hrs   = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getTypeMeta(type) {
  return TYPE_META[type] || DEFAULT_META;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, delay = 0 }) {
  return (
    <motion.div
      className="glass-card p-4 flex items-center gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1.5px solid color-mix(in srgb, ${color} 30%, transparent)` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>{label}</p>
        <p className="text-2xl font-black" style={{ color: "var(--base-content)", fontFamily: "var(--font-family-montserrat)" }}>{value}</p>
      </div>
    </motion.div>
  );
}

function NotificationItem({ notif, onRead, index }) {
  const meta = getTypeMeta(notif.type);
  const Icon = meta.icon;
  const priorityBadge = PRIORITY_BADGE[notif.priority] || PRIORITY_BADGE.Normal;
  const [expanding, setExpanding] = useState(false);

  const handleClick = () => {
    if (!notif.isRead) onRead(notif._id);
    setExpanding((p) => !p);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, height: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={handleClick}
      className="group cursor-pointer"
      style={{
        position: "relative",
        borderRadius: "var(--r-box)",
        border: `1px solid ${notif.isRead ? "var(--base-300)" : `color-mix(in srgb, ${meta.color} 40%, transparent)`}`,
        background: notif.isRead ? "var(--base-100)" : `color-mix(in srgb, ${meta.color} 5%, var(--base-100))`,
        transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
        overflow: "hidden",
      }}
    >
      {!notif.isRead && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: meta.color, borderRadius: "var(--r-box) 0 0 var(--r-box)" }} />
      )}

      <div className="flex items-start gap-3 p-4" style={{ paddingLeft: notif.isRead ? 16 : 20 }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, border: `1.5px solid color-mix(in srgb, ${meta.color} 30%, transparent)` }}>
          <Icon size={18} style={{ color: meta.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className="text-sm leading-snug" style={{ fontFamily: "var(--font-family-poppins)", fontWeight: notif.isRead ? 500 : 700, color: "var(--base-content)" }}>
              {notif.title}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`badge ${priorityBadge.cls}`} style={{ fontSize: 9 }}>{priorityBadge.label}</span>
              {!notif.isRead && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: meta.color }} />}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={expanding ? "expanded" : "collapsed"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`text-xs mt-1 leading-relaxed ${!expanding && "line-clamp-2"}`}
              style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}
            >
              {notif.body}
            </motion.p>
          </AnimatePresence>

          <div className="flex items-center gap-3 mt-2">
            <Clock size={11} style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
            <span className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>{timeAgo(notif.createdAt)}</span>
            <span className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 35%, transparent)" }}>{meta.label}</span>
          </div>
        </div>
        <motion.div animate={{ rotate: expanding ? 180 : 0 }} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
          <ChevronDown size={14} style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function EmptyState({ activeFilter, searchQuery }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "var(--base-200)", border: "1.5px solid var(--base-300)" }}>
        <Inbox size={36} style={{ color: "color-mix(in oklch, var(--base-content) 30%, transparent)" }} />
      </div>
      <div className="text-center">
        <p className="font-bold text-base" style={{ color: "var(--base-content)", fontFamily: "var(--font-family-montserrat)" }}>
          {searchQuery ? "No results found" : "All caught up!"}
        </p>
        <p className="text-sm mt-1" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
          {searchQuery ? `No matches for "${searchQuery}"` : "You have no new notifications."}
        </p>
      </div>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function Notifications() {
  const dispatch = useDispatch();
  
  // Connect to Redux Store
  const { list: notifications } = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectLoading("notifications"));
  const markingAll = useSelector(selectLoading("markAllRead"));

  // Local UI State
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const searchRef = useRef(null);

  // Fetch on mount
  useEffect(() => {
    dispatch(fetchNotifications({ page: 1, limit: 50 }));
  }, [dispatch]);

  // Derived filtered & sorted list
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const meta = getTypeMeta(n.type);
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "unread" && !n.isRead) ||
        meta.group === activeFilter;
      const matchesSearch =
        !searchQuery ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.body.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [notifications, activeFilter, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (!a.isRead && b.isRead) return -1;
      if (a.isRead && !b.isRead) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [filtered]);

  // Analytics Data Processing
  const typeDistribution = useMemo(() => {
    const groups = {};
    notifications.forEach((n) => {
      const g = getTypeMeta(n.type).group;
      groups[g] = (groups[g] || 0) + 1;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [notifications]);

  // Weekly data (Logic to group from actual notification dates)
  const weeklyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return { day: days[d.getDay()], total: 0, unread: 0, date: d.toDateString() };
    }).reverse();

    notifications.forEach(n => {
      const nDate = new Date(n.createdAt).toDateString();
      const found = last7Days.find(d => d.date === nDate);
      if (found) {
        found.total++;
        if (!n.isRead) found.unread++;
      }
    });
    return last7Days;
  }, [notifications]);

  // Actions
  const handleMarkRead = (id) => dispatch(markNotificationRead(id));
  const handleMarkAllRead = () => dispatch(markAllNotificationsRead());
  const handleRefresh = () => dispatch(fetchNotifications({ page: 1, limit: 50 }));

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40" style={{ background: "color-mix(in srgb, var(--base-100) 90%, transparent)", backdropFilter: "blur(16px) saturate(160%)", borderBottom: "1px solid var(--base-300)" }}>
        <div className="container-custom py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "1.5px solid color-mix(in srgb, var(--primary) 30%, transparent)" }}>
                <BellRing size={20} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-family-montserrat)", color: "var(--base-content)", lineHeight: 1.2 }}>Notifications</h2>
                {unreadCount > 0 && (
                  <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>{unreadCount} unread message{unreadCount !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setShowAnalytics((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: showAnalytics ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "var(--base-200)",
                  color: showAnalytics ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 65%, transparent)",
                  border: `1px solid ${showAnalytics ? "color-mix(in srgb, var(--primary) 35%, transparent)" : "var(--base-300)"}`,
                }}
              >
                <BarChart3 size={14} /> Analytics
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={handleRefresh}
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}
                disabled={loading}
              >
                <motion.div animate={{ rotate: loading ? 360 : 0 }} transition={{ repeat: loading ? Infinity : 0, duration: 0.8, ease: "linear" }}>
                  <RefreshCw size={15} style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }} />
                </motion.div>
              </motion.button>

              {unreadCount > 0 && (
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)" }}
                  disabled={markingAll}
                >
                  {markingAll ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
                  Mark all read
                </motion.button>
              )}
            </div>
          </div>

          <div className="mt-3 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search notifications…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full text-sm"
              style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : undefined }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }} />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
            {FILTER_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeFilter === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setActiveFilter(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                  style={{
                    background: isActive ? "var(--primary)" : "var(--base-200)",
                    color: isActive ? "var(--primary-content)" : "color-mix(in oklch, var(--base-content) 65%, transparent)",
                    border: `1px solid ${isActive ? "transparent" : "var(--base-300)"}`,
                  }}
                >
                  <TabIcon size={12} /> {tab.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container-custom py-6 space-y-6">
        {/* ── Analytics Panel ── */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35 }} className="overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatCard icon={Bell}      label="Total"    value={notifications.length} color="var(--primary)"  delay={0} />
                <StatCard icon={BellRing}  label="Unread"   value={unreadCount}          color="var(--warning)"  delay={0.06} />
                <StatCard icon={CheckCheck}label="Read"     value={notifications.length - unreadCount} color="var(--success)" delay={0.12} />
                <StatCard icon={Zap}       label="Critical" value={notifications.filter(n => n.priority === 'Critical').length} color="var(--error)" delay={0.18} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <motion.div className="glass-card p-5 lg:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} style={{ color: "var(--primary)" }} />
                    <p className="text-sm font-bold" style={{ fontFamily: "var(--font-family-montserrat)" }}>Activity Overview</p>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="total" stroke="var(--primary)" fill="url(#totalGrad)" strokeWidth={2} name="Total" />
                      <Area type="monotone" dataKey="unread" stroke="var(--warning)" fill="transparent" strokeWidth={2} strokeDasharray="4 4" name="Unread" />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>

                <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart size={16} style={{ color: "var(--secondary)" }} />
                    <p className="text-sm font-bold" style={{ fontFamily: "var(--font-family-montserrat)" }}>Categories</p>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <RechartsPie>
                      <Pie data={typeDistribution} cx="50%" cy="45%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value">
                        {typeDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: 8, fontSize: 11 }} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── List Content ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
              {sorted.length} notification{sorted.length !== 1 ? "s" : ""}
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            {sorted.length === 0 ? (
              <EmptyState activeFilter={activeFilter} searchQuery={searchQuery} />
            ) : (
              <div className="space-y-2">
                {sorted.map((notif, i) => (
                  <NotificationItem key={notif._id} notif={notif} onRead={handleMarkRead} index={i} />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Load more stub */}
          {sorted.length >= 20 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full mt-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{ background: "var(--base-200)", color: "color-mix(in oklch, var(--base-content) 60%, transparent)", border: "1px solid var(--base-300)" }}
            >
              <ChevronDown size={14} /> Load older notifications
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}