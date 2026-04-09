"use client";

 
import React, {
  useState, useEffect, useCallback, useMemo, useRef, memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  MessageSquare, Users, Building2,
  Search, Filter, Plus, Trash2, Archive, ExternalLink, Eye,
  MoreVertical, X, AlertTriangle, CheckCircle2,
  Activity, Shield, RefreshCw,
  Upload, UserPlus, Crown, Lock,
  Radio, Headphones,
  ChevronRight, Loader2,
  MessagesSquare, BarChart3, Zap, Clock, Pin,
  TrendingUp, Hash, ChevronDown,
} from "lucide-react";
import {
  adminFetchConversations,
  adminDeleteMessage,
  createConversation,
  createDepartmentChannel,
  fetchDepartmentChannel,
  archiveConversation,
  deleteConversation,
  fetchConversations,
  updateConversation,
  addMembers,
  removeMember,
  fetchPartners,
  selectAdminConversations,
  selectAdminPagination,
  selectAdminLoading,
  selectAllConversations,
  selectPartners,
  selectLoadingPartners,
  selectDepartmentChannel,
  selectChatError,
  clearError,
} from "@/store/slices/chatSlice";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zara&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar&backgroundColor=ffdfbf",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Max&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ivy&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kai&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Nora&backgroundColor=ffdfbf",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ezra&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Isla&backgroundColor=c0aede",
];

const ALL_ROLES = [
  { value: "",               label: "All Roles",          icon: "👥" },
  { value: "superadmin",     label: "Super Admin",        icon: "🔑" },
  { value: "admin",          label: "Admin",              icon: "⚙️" },
  { value: "doctor",         label: "Doctor",             icon: "🩺" },
  { value: "transportpartner", label: "Transport Partner",icon: "🚚" },
  { value: "driver",         label: "Driver",             icon: "🚗" },
  { value: "lab partner",    label: "Lab Partner",        icon: "🧪" },
  { value: "customer",       label: "Customer",           icon: "👤" },
  { value: "finance",        label: "Finance",            icon: "💰" },
  { value: "pharmacy",       label: "Pharmacy",           icon: "💊" },
  { value: "care assistant", label: "Care Assistant",     icon: "🤝" },
];

const DEPARTMENT_ROLES = ALL_ROLES.filter((r) => r.value !== "" && r.value !== "superadmin" && r.value !== "admin").concat([
  { value: "admin", label: "Admins", icon: "⚙️" },
]);

const DEPT_ROLE_COLORS = {
  doctor:           "oklch(65% 0.14 180)",
  driver:           "oklch(68% 0.15 50)",
  pharmacy:         "oklch(65% 0.16 150)",
  transportpartner: "oklch(62% 0.20 25)",
  "care assistant": "oklch(62% 0.16 230)",
  "lab partner":    "oklch(62% 0.16 280)",
  finance:          "oklch(75% 0.15 70)",
  admin:            "oklch(55% 0.18 240)",
  customer:         "oklch(70% 0.16 180)",
};

// All 5 conversation types
const CONV_TYPE_CONFIG = {
  direct:     { label: "Direct",     icon: MessageSquare, color: "text-primary",   bg: "bg-primary/10",   desc: "1-to-1 private DM"                        },
  group:      { label: "Group",      icon: Users,         color: "text-secondary", bg: "bg-secondary/10", desc: "Named group chat (multi-user)"             },
  department: { label: "Department", icon: Building2,     color: "text-accent",    bg: "bg-accent/10",    desc: "Role-scoped channel (e.g. all doctors)"    },
  broadcast:  { label: "Broadcast",  icon: Radio,         color: "text-warning",   bg: "bg-warning/10",   desc: "Admin → many (recipients can't reply)"     },
  support:    { label: "Support",    icon: Headphones,    color: "text-info",      bg: "bg-info/10",      desc: "Customer ↔ internal-team ticket thread"    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const slideIn = {
  hidden:  { opacity: 0, x: 48 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 48, transition: { duration: 0.22 } },
};

const modalVariant = {
  hidden:  { opacity: 0, scale: 0.95, y: 16 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.95, y: 16, transition: { duration: 0.18 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = memo(({ icon: Icon, label, value, sub, color, delta, delay = 0 }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    animate="visible"
    transition={{ delay }}
    className="glass-card p-5 flex items-center gap-4 group cursor-default hover:shadow-lg transition-shadow"
  >
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
      style={{ background: `color-mix(in oklch, ${color} 15%, var(--color-base-100))` }}
    >
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest truncate">{label}</p>
      <p className="text-2xl font-black text-base-content font-montserrat leading-tight">{value}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {delta !== undefined && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${delta >= 0 ? "text-success" : "text-error"}`}>
            <TrendingUp className="w-2.5 h-2.5" />
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
        {sub && <p className="text-[10px] text-base-content/40">{sub}</p>}
      </div>
    </div>
  </motion.div>
));

const AvatarStack = memo(({ participants = [], max = 4 }) => {
  const shown = participants.slice(0, max);
  const extra = participants.length - max;
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => {
        const src = p?.user?.avatar || SAMPLE_AVATARS[i % SAMPLE_AVATARS.length];
        return (
          <div key={p?.user?._id || i} className="w-7 h-7 rounded-full border-2 border-base-100 overflow-hidden bg-base-300 flex-shrink-0">
            <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        );
      })}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-base-100 bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold text-primary">+{extra}</span>
        </div>
      )}
    </div>
  );
});

const TypeBadge = memo(({ type }) => {
  const cfg = CONV_TYPE_CONFIG[type] || CONV_TYPE_CONFIG.direct;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
});

const LoadingRow = () => (
  <div className="flex items-center gap-3 p-4 animate-pulse">
    <div className="w-10 h-10 rounded-xl skeleton" />
    <div className="flex-1 space-y-2">
      <div className="h-3 skeleton rounded w-2/5" />
      <div className="h-2 skeleton rounded w-3/5" />
    </div>
    <div className="h-5 w-16 skeleton rounded-full" />
  </div>
);

const EmptyState = memo(({ icon: Icon, title, desc, action }) => (
  <motion.div
    variants={fadeUp} initial="hidden" animate="visible"
    className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6"
  >
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Icon className="w-8 h-8 text-primary/50" />
    </div>
    <div>
      <p className="text-base font-bold text-base-content">{title}</p>
      <p className="text-sm text-base-content/50 mt-1">{desc}</p>
    </div>
    {action}
  </motion.div>
));

const ConfirmDialog = memo(({ open, title, desc, onConfirm, onCancel, danger }) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        />
        <motion.div
          variants={modalVariant} initial="hidden" animate="visible" exit="exit"
          className="relative z-10 glass-card p-6 w-full max-w-sm"
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${danger ? "bg-error/15" : "bg-warning/15"}`}>
            <AlertTriangle className={`w-6 h-6 ${danger ? "text-error" : "text-warning"}`} />
          </div>
          <h3 className="font-black text-lg text-base-content font-montserrat">{title}</h3>
          <p className="text-sm text-base-content/60 mt-1 mb-5">{desc}</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-semibold text-base-content/70 hover:bg-base-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${danger ? "bg-error text-error-content hover:brightness-110" : "bg-warning text-warning-content hover:brightness-110"}`}
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
));

// ─────────────────────────────────────────────────────────────────────────────
// REAL ANALYTICS SECTION — computed from actual conversations data
// ─────────────────────────────────────────────────────────────────────────────

const AnalyticsSection = memo(({ conversations }) => {
  // ── Derived real stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = conversations.length;
    const active    = conversations.filter((c) => !c.isArchived && !c.isDeleted).length;
    const archived  = conversations.filter((c) => c.isArchived).length;
    const deleted   = conversations.filter((c) => c.isDeleted).length;
    const msgs      = conversations.reduce((a, c) => a + (c.totalMessages || 0), 0);
    const totalPart = conversations.reduce((a, c) => a + (c.participants?.filter((p) => p.isActive).length || 0), 0);
    const readOnly  = conversations.filter((c) => c.isReadOnly).length;
    const pinned    = conversations.filter((c) => c.isPinned).length;
    return { total, active, archived, deleted, msgs, totalPart, readOnly, pinned };
  }, [conversations]);

  // ── Type breakdown (real) ─────────────────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const counts = { direct: 0, group: 0, department: 0, broadcast: 0, support: 0 };
    conversations.forEach((c) => { if (counts[c.type] !== undefined) counts[c.type]++; });
    const total = conversations.length || 1;
    return [
      { name: "Direct",     value: counts.direct,     pct: Math.round((counts.direct     / total) * 100), color: "var(--color-primary)"   },
      { name: "Group",      value: counts.group,      pct: Math.round((counts.group      / total) * 100), color: "var(--color-secondary)"  },
      { name: "Department", value: counts.department, pct: Math.round((counts.department / total) * 100), color: "var(--color-accent)"     },
      { name: "Broadcast",  value: counts.broadcast,  pct: Math.round((counts.broadcast  / total) * 100), color: "var(--color-warning)"    },
      { name: "Support",    value: counts.support,    pct: Math.round((counts.support    / total) * 100), color: "var(--color-info)"       },
    ];
  }, [conversations]);

  // ── Activity by date (last 7 days, real) ──────────────────────────────────
  const activityData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const dayConvs = conversations.filter((c) => {
        const created = new Date(c.createdAt);
        return created >= d && created < next;
      });
      const msgs = dayConvs.reduce((a, c) => a + (c.totalMessages || 0), 0);
      const members = dayConvs.reduce((a, c) => a + (c.participants?.filter((p) => p.isActive).length || 0), 0);
      days.push({
        day: d.toLocaleDateString("en", { weekday: "short" }),
        conversations: dayConvs.length,
        messages: msgs,
        members,
      });
    }
    return days;
  }, [conversations]);

  // ── Top department channels ───────────────────────────────────────────────
  const deptStats = useMemo(() => {
    return conversations
      .filter((c) => c.type === "department" && c.departmentRole)
      .map((c) => ({
        role:     c.departmentRole,
        name:     c.name,
        members:  c.participants?.filter((p) => p.isActive).length || 0,
        messages: c.totalMessages || 0,
      }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 6);
  }, [conversations]);

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-card p-3 text-xs border border-base-300 shadow-xl rounded-xl">
        <p className="font-bold text-base-content mb-1.5">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="flex items-center gap-1.5 mb-0.5" style={{ color: p.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}: <span className="font-bold ml-auto pl-3">{p.value?.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={MessagesSquare} label="Total Conversations" value={stats.total.toLocaleString()}  sub="All time"       color="oklch(55% 0.18 240)" delay={0}     />
        <StatCard icon={Activity}       label="Active"              value={stats.active.toLocaleString()} sub="Not archived"   color="oklch(65% 0.16 150)" delay={0.05}  />
        <StatCard icon={Zap}            label="Total Messages"      value={stats.msgs > 999 ? `${(stats.msgs/1000).toFixed(1)}k` : stats.msgs.toLocaleString()} sub="Across all" color="oklch(62% 0.16 280)" delay={0.10} />
        <StatCard icon={Users}          label="Total Participants"  value={stats.totalPart.toLocaleString()} sub="Active members" color="oklch(68% 0.15 50)" delay={0.15} />
      </motion.div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Archived",   value: stats.archived, icon: Archive,       color: "oklch(75% 0.15 70)"  },
          { label: "Read Only",  value: stats.readOnly, icon: Lock,          color: "oklch(62% 0.14 240)" },
          { label: "Pinned",     value: stats.pinned,   icon: Pin,           color: "oklch(70% 0.16 30)"  },
          { label: "Deleted",    value: stats.deleted,  icon: Trash2,        color: "oklch(60% 0.20 15)"  },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.2 + i * 0.04 }}
            className="glass-card p-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in oklch, ${color} 15%, var(--color-base-100))` }}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">{label}</p>
              <p className="text-lg font-black text-base-content font-montserrat">{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity area chart */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-sm text-base-content font-montserrat">7-Day Activity</h3>
              <p className="text-[10px] text-base-content/40 mt-0.5">Conversations created & messages sent</p>
            </div>
            <span className="badge badge-primary text-[9px] px-2">Real-time</span>
          </div>
          {activityData.every((d) => d.conversations === 0 && d.messages === 0) ? (
            <div className="flex items-center justify-center h-[180px] text-xs text-base-content/40">No activity data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={activityData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-primary)"   stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)"   stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-secondary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" strokeOpacity={0.4} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} />
                <Area type="monotone" dataKey="conversations" name="Conversations" stroke="var(--color-primary)"   strokeWidth={2} fill="url(#gConv)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="messages"      name="Messages"      stroke="var(--color-secondary)" strokeWidth={2} fill="url(#gMsg)"  dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Type breakdown pie */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="glass-card p-5">
          <h3 className="font-black text-sm text-base-content font-montserrat mb-0.5">Type Breakdown</h3>
          <p className="text-[10px] text-base-content/40 mb-3">Distribution of conversation types</p>
          {conversations.length === 0 ? (
            <div className="flex items-center justify-center h-[140px] text-xs text-base-content/40">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={62} dataKey="pct" paddingAngle={3}>
                  {typeBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={customTooltip} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-1.5 mt-2">
            {typeBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-base-content/60">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base-content/40">{item.value}</span>
                  <span className="font-bold text-base-content w-8 text-right">{item.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Department channels + members bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Members per day bar chart */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.15 }} className="glass-card p-5">
          <h3 className="font-black text-sm text-base-content font-montserrat mb-0.5">New Members Added</h3>
          <p className="text-[10px] text-base-content/40 mb-4">Participants joining conversations per day</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={activityData} margin={{ top: 0, right: 5, bottom: 0, left: -20 }} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
              <Tooltip content={customTooltip} />
              <Bar dataKey="members" name="Members" radius={[4, 4, 0, 0]}>
                {activityData.map((_, i) => (
                  <Cell key={i} fill={`oklch(${58 + i * 4}% 0.16 ${240 - i * 10})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top department channels */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.2 }} className="glass-card p-5">
          <h3 className="font-black text-sm text-base-content font-montserrat mb-0.5">Department Channels</h3>
          <p className="text-[10px] text-base-content/40 mb-3">Top by message volume</p>
          {deptStats.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-base-content/40">No department channels yet</div>
          ) : (
            <div className="space-y-2">
              {deptStats.map((d, i) => {
                const roleInfo = ALL_ROLES.find((r) => r.value === d.role);
                const maxMsgs  = deptStats[0]?.messages || 1;
                return (
                  <div key={d.role} className="flex items-center gap-3">
                    <span className="text-base w-5 flex-shrink-0">{roleInfo?.icon || "💬"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-semibold text-base-content truncate">{d.name || roleInfo?.label}</p>
                        <p className="text-[10px] text-base-content/50 flex-shrink-0 ml-2">{d.messages} msgs</p>
                      </div>
                      <div className="h-1 bg-base-300 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(d.messages / maxMsgs) * 100}%`,
                            background: DEPT_ROLE_COLORS[d.role] || "var(--color-primary)",
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-base-content/40 flex-shrink-0 w-14 text-right">{d.members} members</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE CONVERSATION MODAL — all 5 types + role filter for participants
// ─────────────────────────────────────────────────────────────────────────────

const CreateConversationModal = memo(({ open, onClose, onSuccess }) => {
  const dispatch  = useDispatch();
  const partners  = useSelector(selectPartners);
  const loading   = useSelector(selectLoadingPartners);

  const [type,          setType]          = useState("group");
  const [name,          setName]          = useState("");
  const [description,   setDescription]   = useState("");
  const [selectedAvatar,setSelectedAvatar]= useState(SAMPLE_AVATARS[0]);
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [searchQ,       setSearchQ]       = useState("");
  const [roleFilter,    setRoleFilter]    = useState("");   // "" = all roles
  const [selectedIds,   setSelectedIds]   = useState([]);
  const [submitting,    setSubmitting]    = useState(false);
  const [showRoleDD,    setShowRoleDD]    = useState(false);
  const fileRef    = useRef(null);
  const roleDDRef  = useRef(null);

  useEffect(() => {
    if (open) dispatch(fetchPartners({ limit: 200 }));
  }, [open, dispatch]);

  // Close role dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (roleDDRef.current && !roleDDRef.current.contains(e.target)) setShowRoleDD(false);
    };
    if (showRoleDD) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showRoleDD]);

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchRole   = !roleFilter || p.role === roleFilter;
      const matchSearch = !searchQ.trim() ||
        p.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.role?.toLowerCase().includes(searchQ.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [partners, searchQ, roleFilter]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }, []);

  const toggleUser = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // Select / deselect all visible
  const toggleAll = useCallback(() => {
    const visibleIds = filteredPartners.map((p) => p._id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  }, [filteredPartners, selectedIds]);

  const handleSubmit = useCallback(async () => {
    const needsName = type !== "direct";
    if (needsName && !name.trim()) return toast.error("Name is required for this conversation type");
    if (selectedIds.length === 0) return toast.error("Select at least one participant");
    if (type === "direct" && selectedIds.length !== 1) return toast.error("Direct chat requires exactly 1 participant");

    setSubmitting(true);
    try {
      const avatar = avatarPreview || selectedAvatar;
      const res = await dispatch(createConversation({
        type, name, description, participantIds: selectedIds, avatar,
      })).unwrap();
      toast.success("Conversation created!");
      onSuccess?.(res.conversation);
      onClose();
    } catch (err) {
      toast.error(err || "Failed to create conversation");
    } finally {
      setSubmitting(false);
    }
  }, [name, type, description, selectedIds, avatarPreview, selectedAvatar, dispatch, onSuccess, onClose]);

  const reset = useCallback(() => {
    setType("group"); setName(""); setDescription(""); setSelectedAvatar(SAMPLE_AVATARS[0]);
    setAvatarFile(null); setAvatarPreview(null); setSearchQ(""); setRoleFilter(""); setSelectedIds([]);
  }, []);

  const selectedRoleLabel = ALL_ROLES.find((r) => r.value === roleFilter)?.label || "All Roles";
  const selectedRoleIcon  = ALL_ROLES.find((r) => r.value === roleFilter)?.icon  || "👥";

  const needsName = type !== "direct";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { onClose(); reset(); }}
          />
          <motion.div
            variants={modalVariant} initial="hidden" animate="visible" exit="exit"
            className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto glass-card rounded-t-2xl sm:rounded-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-base-300 flex-shrink-0">
              <div>
                <h2 className="font-black text-lg text-base-content font-montserrat">New Conversation</h2>
                <p className="text-xs text-base-content/50 mt-0.5">Choose type &amp; add participants</p>
              </div>
              <button onClick={() => { onClose(); reset(); }} className="w-8 h-8 rounded-lg hover:bg-base-300 flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">

              {/* Type selector — all 5 types */}
              <div>
                <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-2 block">Conversation Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(CONV_TYPE_CONFIG).map(([t, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                          type === t
                            ? "border-primary bg-primary/10"
                            : "border-base-300 hover:border-primary/40"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${type === t ? cfg.bg : "bg-base-200"}`}>
                          <Icon className={`w-3 h-3 ${type === t ? cfg.color : "text-base-content/50"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${type === t ? "text-primary" : "text-base-content/70"}`}>{cfg.label}</p>
                          <p className="text-[9px] text-base-content/40 leading-tight mt-0.5 line-clamp-2">{cfg.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Avatar — only for non-direct */}
              {type !== "direct" && (
                <div>
                  <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-2 block">Avatar</label>
                  <div className="flex gap-3 items-start">
                    <div
                      className="w-14 h-14 rounded-xl border-2 border-dashed border-base-300 flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden flex-shrink-0"
                      onClick={() => fileRef.current?.click()}
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload className="w-4 h-4 text-base-content/30" />
                          <span className="text-[8px] text-base-content/30 font-medium">Upload</span>
                        </div>
                      )}
                      <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {SAMPLE_AVATARS.slice(0, 8).map((av) => (
                        <button
                          key={av}
                          onClick={() => { setSelectedAvatar(av); setAvatarPreview(null); setAvatarFile(null); }}
                          className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition-all ${selectedAvatar === av && !avatarPreview ? "border-primary scale-110" : "border-transparent hover:border-primary/50"}`}
                        >
                          <img src={av} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Name — not required for direct */}
              <div>
                <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-1.5 block">
                  Name {needsName && <span className="text-error">*</span>}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === "direct" ? "Optional display name" : "e.g. Operations Team"}
                  className="input-field w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="input-field w-full resize-none"
                />
              </div>

              {/* Direct: 1 participant warning */}
              {type === "direct" && (
                <div className="bg-info/10 border border-info/20 rounded-xl p-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-info flex-shrink-0" />
                  <p className="text-xs text-base-content/70">Select exactly <strong>1 participant</strong> for a direct message.</p>
                </div>
              )}

              {/* Broadcast notice */}
              {type === "broadcast" && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-warning flex-shrink-0" />
                  <p className="text-xs text-base-content/70">Recipients <strong>cannot reply</strong> to broadcast conversations.</p>
                </div>
              )}

              {/* Participants */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest">
                    Participants
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-black">{selectedIds.length}</span>
                  </label>
                  {filteredPartners.length > 0 && (
                    <button onClick={toggleAll} className="text-[10px] text-primary hover:underline font-semibold">
                      {filteredPartners.every((p) => selectedIds.includes(p._id)) ? "Deselect all" : "Select all visible"}
                    </button>
                  )}
                </div>

                {/* Search + role filter row */}
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-base-content/40" />
                    <input
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="Search by name or email..."
                      className="input-field w-full pl-8 py-2 text-xs"
                    />
                    {searchQ && (
                      <button onClick={() => setSearchQ("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X className="w-3 h-3 text-base-content/40" />
                      </button>
                    )}
                  </div>

                  {/* Role dropdown filter */}
                  <div className="relative flex-shrink-0" ref={roleDDRef}>
                    <button
                      onClick={() => setShowRoleDD((v) => !v)}
                      className="flex items-center gap-1.5 h-full px-3 rounded-xl border border-base-300 bg-base-100 text-xs font-semibold text-base-content/70 hover:border-primary/40 transition-colors whitespace-nowrap"
                    >
                      <span>{selectedRoleIcon}</span>
                      <span className="hidden sm:inline">{selectedRoleLabel}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showRoleDD ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {showRoleDD && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -6 }}
                          animate={{ opacity: 1, scale: 1,    y: 0  }}
                          exit={{   opacity: 0, scale: 0.95, y: -6  }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-1 z-50 glass-card border border-base-300 shadow-xl w-48 py-1 rounded-xl overflow-hidden max-h-64 overflow-y-auto"
                        >
                          {ALL_ROLES.map((r) => (
                            <button
                              key={r.value}
                              onClick={() => { setRoleFilter(r.value); setShowRoleDD(false); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left ${
                                roleFilter === r.value
                                  ? "bg-primary/10 text-primary font-bold"
                                  : "text-base-content/70 hover:bg-base-200"
                              }`}
                            >
                              <span className="text-sm">{r.icon}</span>
                              {r.label}
                              {roleFilter === r.value && <CheckCircle2 className="w-3 h-3 ml-auto text-primary" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Partner list */}
                <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
                  {loading ? (
                    [1,2,3].map((i) => <LoadingRow key={i} />)
                  ) : filteredPartners.length === 0 ? (
                    <div className="text-xs text-center text-base-content/40 py-8">
                      {roleFilter ? `No ${ALL_ROLES.find((r) => r.value === roleFilter)?.label || ""} users found` : "No users found"}
                    </div>
                  ) : filteredPartners.map((p) => {
                    const checked = selectedIds.includes(p._id);
                    const roleInfo = ALL_ROLES.find((r) => r.value === p.role);
                    return (
                      <button
                        key={p._id}
                        onClick={() => toggleUser(p._id)}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border ${
                          checked
                            ? "bg-primary/8 border-primary/25"
                            : "hover:bg-base-200 border-transparent"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-base-300 flex-shrink-0 relative">
                          <img src={p.avatar || SAMPLE_AVATARS[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {p.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2 h-2 bg-success rounded-full border border-base-100" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-base-content truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px]">{roleInfo?.icon}</span>
                            <p className="text-[10px] text-base-content/50 capitalize truncate">{p.role}</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          checked ? "bg-primary border-primary" : "border-base-300"
                        }`}>
                          {checked && <CheckCircle2 className="w-3 h-3 text-primary-content" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected chips */}
                {selectedIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-16 overflow-y-auto pt-2 border-t border-base-300">
                    {selectedIds.map((id) => {
                      const p = partners.find((u) => u._id === id);
                      if (!p) return null;
                      return (
                        <span key={id} className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-semibold">
                          {p.name}
                          <button onClick={() => toggleUser(id)}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-base-300 flex gap-3 flex-shrink-0">
              <button onClick={() => { onClose(); reset(); }} className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-semibold text-base-content/70 hover:bg-base-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 btn-primary-cta py-2.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none normal-case text-sm"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT CHANNEL MODAL
// ─────────────────────────────────────────────────────────────────────────────

const DepartmentChannelModal = memo(({ open, onClose }) => {
  const dispatch = useDispatch();

  const [role,        setRole]        = useState("");
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [fetching,    setFetching]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [existing,    setExisting]    = useState(null);

  const handleRoleChange = useCallback(async (r) => {
    setRole(r);
    setExisting(null);
    if (!r) return;
    setFetching(true);
    try {
      const res = await dispatch(fetchDepartmentChannel(r)).unwrap();
      if (res?.conversation) setExisting(res.conversation);
    } catch { /* new channel */ }
    finally { setFetching(false); }
  }, [dispatch]);

  const handleCreate = useCallback(async () => {
    if (!role || !name.trim()) return toast.error("Role and name are required");
    setSubmitting(true);
    try {
      await dispatch(createDepartmentChannel({ departmentRole: role, name, description })).unwrap();
      toast.success("Department channel created!");
      onClose();
    } catch (err) {
      toast.error(err || "Failed to create channel");
    } finally { setSubmitting(false); }
  }, [role, name, description, dispatch, onClose]);

  const deptRoles = ALL_ROLES.filter((r) => r.value !== "");
  const selectedRoleData = deptRoles.find((r) => r.value === role);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            variants={modalVariant} initial="hidden" animate="visible" exit="exit"
            className="relative z-10 w-full sm:max-w-md glass-card rounded-t-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-base-300">
              <div>
                <h2 className="font-black text-lg text-base-content font-montserrat">Department Channel</h2>
                <p className="text-xs text-base-content/50 mt-0.5">Create a role-scoped channel</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-base-300 flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-2 block">Department Role <span className="text-error">*</span></label>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {deptRoles.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => handleRoleChange(r.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-left ${
                        role === r.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-base-300 hover:border-primary/40 text-base-content/70"
                      }`}
                    >
                      <span className="text-base">{r.icon}</span>
                      <span className="truncate">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {fetching && (
                <div className="flex items-center gap-2 text-xs text-base-content/50 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking existing channels...
                </div>
              )}

              {existing && (
                <div className="alert alert-warning rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-base-content">Channel already exists: <span className="text-warning">"{existing.name}"</span></p>
                    <p className="text-[10px] text-base-content/60 mt-0.5">{existing.participants?.length || 0} participants</p>
                  </div>
                </div>
              )}

              {!existing && role && (
                <>
                  <div>
                    <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-1.5 block">Channel Name <span className="text-error">*</span></label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`e.g. ${selectedRoleData?.label || ""} General`}
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-1.5 block">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional..."
                      rows={2}
                      className="input-field w-full resize-none"
                    />
                  </div>
                  {selectedRoleData && (
                    <div className="bg-info/10 border border-info/20 rounded-xl p-3 flex items-center gap-2">
                      <span className="text-xl">{selectedRoleData.icon}</span>
                      <p className="text-xs text-base-content/70">
                        All active <strong>{selectedRoleData.label}</strong> users will be automatically added to this channel.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-5 border-t border-base-300 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-semibold text-base-content/70 hover:bg-base-200 transition-colors">
                Cancel
              </button>
              {!existing && (
                <button
                  onClick={handleCreate}
                  disabled={submitting || !role || !name.trim()}
                  className="flex-1 btn-primary-cta py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none normal-case text-sm"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  {submitting ? "Creating..." : "Create Channel"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

const ConversationDrawer = memo(({ conversation, onClose, onArchive, onDelete }) => {
  const router   = useRouter();
  const dispatch = useDispatch();
  const [submitting, setSubmitting] = useState(false);
  const [name,     setName]         = useState(conversation?.name || "");
  const [readOnly, setReadOnly]     = useState(conversation?.isReadOnly || false);

  if (!conversation) return null;

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await dispatch(updateConversation({
        conversationId: conversation._id, name, isReadOnly: readOnly,
      })).unwrap();
      toast.success("Updated successfully");
    } catch (err) {
      toast.error(err || "Update failed");
    } finally { setSubmitting(false); }
  };

  const activeParticipants = conversation.participants?.filter((p) => p.isActive) || [];
  const typeCfg = CONV_TYPE_CONFIG[conversation.type] || CONV_TYPE_CONFIG.direct;

  return (
    <motion.div
      variants={slideIn} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 z-[140] flex justify-end"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm h-full glass-card rounded-l-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-base-300 flex-shrink-0">
            <img
              src={conversation.avatar || SAMPLE_AVATARS[0]}
              alt={conversation.name || "Chat"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-base-content truncate">{conversation.name || "Direct Chat"}</p>
            <TypeBadge type={conversation.type} />
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-base-300 flex items-center justify-center transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Edit fields */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-1.5 block">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-field w-full text-sm" />
            </div>
            <div className="flex items-center justify-between p-3 bg-base-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-base-content">Read Only</p>
                <p className="text-[10px] text-base-content/50">Only admins can send messages</p>
              </div>
              <button
                onClick={() => setReadOnly((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${readOnly ? "bg-primary" : "bg-base-300"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${readOnly ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <button
              onClick={handleUpdate}
              disabled={submitting}
              className="w-full btn-primary-cta py-2.5 text-sm flex items-center justify-center gap-2 normal-case disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Messages",     value: conversation.totalMessages || 0, icon: MessageSquare },
              { label: "Participants", value: activeParticipants.length,        icon: Users         },
              { label: "Type",         value: typeCfg.label,                   icon: typeCfg.icon  },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-base-200 rounded-xl p-3 flex flex-col gap-1 items-center text-center">
                <Icon className="w-4 h-4 text-primary" />
                <p className="text-sm font-black text-base-content font-montserrat leading-none">{value}</p>
                <p className="text-[9px] text-base-content/50">{label}</p>
              </div>
            ))}
          </div>

          {/* Dept role badge */}
          {conversation.departmentRole && (
            <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-xl">
              <Hash className="w-4 h-4 text-accent flex-shrink-0" />
              <div>
                <p className="text-[10px] text-base-content/50 font-semibold uppercase tracking-wider">Department Role</p>
                <p className="text-xs font-bold text-base-content capitalize">{conversation.departmentRole}</p>
              </div>
            </div>
          )}

          {/* Participants */}
          <div>
            <p className="text-[10px] font-black text-base-content/50 uppercase tracking-widest mb-2">
              Participants ({activeParticipants.length})
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {activeParticipants.map((p, i) => {
                const u   = p.user;
                const src = u?.avatar || SAMPLE_AVATARS[i % SAMPLE_AVATARS.length];
                const roleInfo = ALL_ROLES.find((r) => r.value === u?.role);
                return (
                  <div key={u?._id || i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-base-200 transition-colors">
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-base-300 flex-shrink-0 relative">
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {u?.isOnline && (
                        <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-success rounded-full border border-base-100" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-base-content truncate">{u?.name || "Unknown"}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px]">{roleInfo?.icon}</span>
                        <p className="text-[10px] text-base-content/50 capitalize truncate">{p.conversationRole}</p>
                      </div>
                    </div>
                    {p.conversationRole === "owner" && <Crown className="w-3 h-3 text-warning flex-shrink-0" />}
                    {p.conversationRole === "admin"  && <Shield className="w-3 h-3 text-info flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Open Chat */}
          <button
            onClick={() => router.push(`/dashboard/chat?conversation=${conversation._id}`)}
            className="w-full flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Open in Chat</span>
            </div>
            <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-base-300 flex gap-2 flex-shrink-0">
          <button
            onClick={() => onArchive(conversation)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-base-300 text-base-content/70 hover:bg-base-200 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
            {conversation.isArchived ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={() => onDelete(conversation)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-error/10 text-error hover:bg-error/20 transition-colors border border-error/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION ROW
// ─────────────────────────────────────────────────────────────────────────────

const ConversationRow = memo(({ conv, onView, onArchive, onDelete, onOpenChat, index }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const avatar = conv.avatar || SAMPLE_AVATARS[index % SAMPLE_AVATARS.length];

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const activeCount = conv.participants?.filter((p) => p.isActive).length || 0;

  return (
    <motion.div
      variants={fadeUp}
      className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border transition-all hover:border-primary/30 hover:bg-base-200/50 group ${
        conv.isArchived ? "border-base-300/50 opacity-60" : "border-base-300"
      }`}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-base-300 flex-shrink-0 relative">
        <img src={avatar} alt={conv.name || "Chat"} className="w-full h-full object-cover" loading="lazy" />
        {conv.isReadOnly && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-base-content truncate max-w-[140px] sm:max-w-xs">
            {conv.name || "Direct Chat"}
          </p>
          <TypeBadge type={conv.type} />
          {conv.isArchived && <span className="badge badge-warning text-[9px]">Archived</span>}
          {conv.isPinned   && <Pin className="w-3 h-3 text-primary" />}
          {conv.departmentRole && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold capitalize">
              {conv.departmentRole}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] text-base-content/50 flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />{activeCount}
          </span>
          <span className="text-[10px] text-base-content/50 flex items-center gap-1">
            <MessageSquare className="w-2.5 h-2.5" />{conv.totalMessages || 0}
          </span>
          {conv.lastMessage?.sentAt && (
            <span className="text-[10px] text-base-content/40 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {new Date(conv.lastMessage.sentAt).toLocaleDateString()}
            </span>
          )}
          {conv.lastMessage?.content && (
            <span className="text-[10px] text-base-content/40 truncate max-w-[120px] hidden sm:block">
              {conv.lastMessage.content}
            </span>
          )}
        </div>
      </div>

      {/* Avatar stack */}
      <div className="hidden sm:block flex-shrink-0">
        <AvatarStack participants={conv.participants || []} max={3} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onOpenChat(conv)}
          className="w-7 h-7 rounded-lg hover:bg-primary/10 flex items-center justify-center transition-colors text-primary/60 hover:text-primary opacity-0 group-hover:opacity-100"
          title="Open Chat"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onView(conv)}
          className="w-7 h-7 rounded-lg hover:bg-base-300 flex items-center justify-center transition-colors text-base-content/50 hover:text-base-content opacity-0 group-hover:opacity-100"
          title="View Details"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-lg hover:bg-base-300 flex items-center justify-center transition-colors text-base-content/50 hover:text-base-content"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-8 z-50 glass-card border border-base-300 shadow-xl w-44 py-1 rounded-xl overflow-hidden"
              >
                {[
                  { label: "View Details",                              icon: Eye,          action: () => { onView(conv); setMenuOpen(false); }    },
                  { label: "Open in Chat",                              icon: ExternalLink, action: () => { onOpenChat(conv); setMenuOpen(false); } },
                  { label: conv.isArchived ? "Unarchive" : "Archive",  icon: Archive,      action: () => { onArchive(conv); setMenuOpen(false); }  },
                  { label: "Delete",                                    icon: Trash2,       action: () => { onDelete(conv); setMenuOpen(false); }, danger: true },
                ].map(({ label, icon: Icon, action, danger }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left ${
                      danger
                        ? "text-error hover:bg-error/10"
                        : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatsManagement() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const user     = useSelector((state) => state.user?.user) ?? null;

  // Redux state
  const adminConvs   = useSelector(selectAdminConversations);
  const adminPaging  = useSelector(selectAdminPagination);
  const adminLoading = useSelector(selectAdminLoading);
  const allConvs     = useSelector(selectAllConversations);
  const chatError    = useSelector(selectChatError);

  // Local UI state
  const [activeTab,    setActiveTab]    = useState("overview");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [searchQ,      setSearchQ]      = useState("");
  const [page,         setPage]         = useState(1);
  const [showCreate,   setShowCreate]   = useState(false);
  const [showDept,     setShowDept]     = useState(false);
  const [selectedConv, setSelectedConv] = useState(null);
  const [confirmDel,   setConfirmDel]   = useState(null);
  const [confirmArch,  setConfirmArch]  = useState(null);
  const [refreshKey,   setRefreshKey]   = useState(0);

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    dispatch(adminFetchConversations({ page, type: typeFilter !== "all" ? typeFilter : undefined }));
  }, [page, typeFilter, refreshKey, dispatch, isAdmin]);

  useEffect(() => {
    if (chatError) {
      toast.error(chatError);
      dispatch(clearError());
    }
  }, [chatError, dispatch]);

  const filteredConvs = useMemo(() => {
    if (!searchQ.trim()) return adminConvs;
    const q = searchQ.toLowerCase();
    return adminConvs.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.type?.toLowerCase().includes(q) ||
      c.departmentRole?.toLowerCase().includes(q) ||
      c.lastMessage?.content?.toLowerCase().includes(q)
    );
  }, [adminConvs, searchQ]);

  // Handlers
  const handleArchive = useCallback((conv) => setConfirmArch(conv), []);
  const handleArchiveConfirm = useCallback(async () => {
    if (!confirmArch) return;
    try {
      await dispatch(archiveConversation({ conversationId: confirmArch._id, archive: !confirmArch.isArchived })).unwrap();
      toast.success(confirmArch.isArchived ? "Unarchived" : "Archived");
      setRefreshKey((k) => k + 1);
      if (selectedConv?._id === confirmArch._id) setSelectedConv(null);
    } catch (err) { toast.error(err || "Failed"); }
    finally { setConfirmArch(null); }
  }, [confirmArch, dispatch, selectedConv]);

  const handleDelete = useCallback((conv) => setConfirmDel(conv), []);
  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDel) return;
    try {
      await dispatch(deleteConversation(confirmDel._id)).unwrap();
      toast.success("Deleted");
      setRefreshKey((k) => k + 1);
      if (selectedConv?._id === confirmDel._id) setSelectedConv(null);
    } catch (err) { toast.error(err || "Failed"); }
    finally { setConfirmDel(null); }
  }, [confirmDel, dispatch, selectedConv]);

  const handleOpenChat = useCallback((conv) => {
    router.push(`/dashboard/chat?conversation=${conv._id}`);
  }, [router]);

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const TABS = [
    { id: "overview",      label: "Overview",      icon: BarChart3     },
    { id: "conversations", label: "Conversations",  icon: MessageSquare },
    { id: "departments",   label: "Departments",    icon: Building2     },
  ];

  const CONV_TYPES = [
    { value: "all",        label: "All Types"  },
    { value: "direct",     label: "Direct"     },
    { value: "group",      label: "Group"      },
    { value: "department", label: "Department" },
    { value: "broadcast",  label: "Broadcast"  },
    { value: "support",    label: "Support"    },
  ];

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-10 text-center max-w-sm">
          <Shield className="w-12 h-12 text-error mx-auto mb-4" />
          <h2 className="font-black text-xl text-base-content font-montserrat mb-2">Access Denied</h2>
          <p className="text-sm text-base-content/60">Admin or SuperAdmin access required.</p>
        </div>
      </div>
    );
  }

  const analyticsData = adminConvs.length ? adminConvs : allConvs;

  return (
    <div className="min-h-screen bg-base-100">

      {/* ── Page Header ── */}
      <div className="border-b border-base-300 bg-base-100/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="container-custom py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center border border-primary/20">
                <MessagesSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-black text-xl text-base-content font-montserrat leading-tight">Chats Management</h1>
                <p className="text-xs text-base-content/50 hidden sm:flex items-center gap-2 mt-0.5">
                  <span>{adminPaging?.total || analyticsData.length} conversations</span>
                  <span className="w-1 h-1 rounded-full bg-base-content/30" />
                  <span className="flex items-center gap-1 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Live data
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRefresh}
                className="w-9 h-9 rounded-xl border border-base-300 flex items-center justify-center hover:bg-base-200 transition-colors text-base-content/60"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adminLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setShowDept(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-base-300 text-xs font-semibold text-base-content/70 hover:bg-base-200 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dept Channel</span>
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary-cta flex items-center gap-1.5 px-4 py-2 normal-case text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Conversation</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-px">
            {TABS.map((t) => {
              const Icon   = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-base-content/50 hover:text-base-content hover:border-base-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.id === "conversations" && adminConvs.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-black">
                      {adminPaging?.total || adminConvs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container-custom py-6">

        {/* ── Overview Tab — REAL analytics ── */}
        {activeTab === "overview" && (
          <AnalyticsSection conversations={analyticsData} />
        )}

        {/* ── Conversations Tab ── */}
        {activeTab === "conversations" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search by name, type, department role, or last message..."
                  className="input-field w-full pl-9 py-2.5 text-sm"
                />
                {searchQ && (
                  <button onClick={() => setSearchQ("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-base-content/40" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Filter className="w-3.5 h-3.5 text-base-content/40 flex-shrink-0" />
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  className="input-field py-2.5 text-sm pr-8 min-w-[130px]"
                >
                  {CONV_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Result count */}
            {(searchQ || typeFilter !== "all") && (
              <p className="text-xs text-base-content/50">
                Showing <strong className="text-base-content">{filteredConvs.length}</strong> result{filteredConvs.length !== 1 ? "s" : ""}
                {typeFilter !== "all" && <> for type <strong className="text-base-content capitalize">{typeFilter}</strong></>}
                {searchQ && <> matching <strong className="text-base-content">"{searchQ}"</strong></>}
              </p>
            )}

            {/* List */}
            <div className="glass-card overflow-hidden">
              {adminLoading && filteredConvs.length === 0 ? (
                <div className="divide-y divide-base-300">
                  {[1,2,3,4,5].map((i) => <LoadingRow key={i} />)}
                </div>
              ) : filteredConvs.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No conversations found"
                  desc={searchQ ? "Try a different search term or clear filters" : "Create a conversation to get started"}
                  action={
                    !searchQ && (
                      <button onClick={() => setShowCreate(true)} className="btn-primary-cta px-5 py-2.5 text-xs normal-case flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Create First
                      </button>
                    )
                  }
                />
              ) : (
                <motion.div variants={stagger} initial="hidden" animate="visible" className="divide-y divide-base-300">
                  {filteredConvs.map((conv, i) => (
                    <div key={conv._id} className="p-2">
                      <ConversationRow
                        conv={conv}
                        index={i}
                        onView={setSelectedConv}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onOpenChat={handleOpenChat}
                      />
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Pagination */}
            {adminPaging?.pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-base-content/50">
                  Page {page} of {adminPaging.pages} · {adminPaging.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-base-300 text-xs font-semibold text-base-content/70 hover:bg-base-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Prev
                  </button>
                  {/* Page number pills */}
                  {Array.from({ length: Math.min(5, adminPaging.pages) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          page === p ? "bg-primary text-primary-content" : "border border-base-300 text-base-content/70 hover:bg-base-200"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(adminPaging.pages, p + 1))}
                    disabled={page >= adminPaging.pages}
                    className="px-3 py-1.5 rounded-lg border border-base-300 text-xs font-semibold text-base-content/70 hover:bg-base-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Departments Tab ── */}
        {activeTab === "departments" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-base text-base-content font-montserrat">Department Channels</h2>
                <p className="text-xs text-base-content/50 mt-0.5">Role-scoped channels for internal teams — auto-populated with all matching users</p>
              </div>
              <button
                onClick={() => setShowDept(true)}
                className="btn-primary-cta px-4 py-2 normal-case text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Create Channel</span>
              </button>
            </div>

            {/* Summary strip */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { label: "Total Dept Channels", value: adminConvs.filter((c) => c.type === "department").length },
                  { label: "Active",               value: adminConvs.filter((c) => c.type === "department" && !c.isArchived && !c.isDeleted).length },
                  { label: "Total Messages",        value: adminConvs.filter((c) => c.type === "department").reduce((a, c) => a + (c.totalMessages || 0), 0) },
                  { label: "Total Members",         value: adminConvs.filter((c) => c.type === "department").reduce((a, c) => a + (c.participants?.filter((p) => p.isActive).length || 0), 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">{label}</span>
                    <span className="text-xl font-black text-base-content font-montserrat">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALL_ROLES.filter((r) => r.value !== "").map((dept, i) => {
                const conv = adminConvs.find(
                  (c) => c.type === "department" && c.departmentRole === dept.value
                );
                const color = DEPT_ROLE_COLORS[dept.value] || "oklch(55% 0.18 240)";

                return (
                  <motion.div key={dept.value} variants={fadeUp} className="glass-card p-4 group hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                          style={{ background: `color-mix(in oklch, ${color} 18%, var(--color-base-100))` }}
                        >
                          {dept.icon}
                        </div>
                        <div>
                          <p className="font-black text-sm text-base-content">{dept.label}</p>
                          <p className="text-[10px] text-base-content/40 capitalize font-mono">{dept.value}</p>
                        </div>
                      </div>
                      {conv ? (
                        <span className="badge badge-success text-[9px] px-2">Active</span>
                      ) : (
                        <span className="text-[10px] text-base-content/30 italic">No channel</span>
                      )}
                    </div>

                    {conv ? (
                      <>
                        <p className="text-xs text-base-content/60 truncate mb-2">{conv.name}</p>
                        <div className="flex items-center gap-3 mb-3 text-[10px] text-base-content/50">
                          <span className="flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            {conv.participants?.filter((p) => p.isActive).length || 0} members
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-2.5 h-2.5" />
                            {conv.totalMessages || 0} messages
                          </span>
                          {conv.lastMessage?.sentAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(conv.lastMessage.sentAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <AvatarStack participants={conv.participants || []} max={5} />
                        <div className="flex gap-2 mt-3 pt-3 border-t border-base-300">
                          <button
                            onClick={() => setSelectedConv(conv)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-base-200 text-[10px] font-semibold text-base-content/70 hover:bg-base-300 transition-colors"
                          >
                            <Eye className="w-3 h-3" /> Manage
                          </button>
                          <button
                            onClick={() => handleOpenChat(conv)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
                            style={{ background: `color-mix(in oklch, ${color} 12%, var(--color-base-100))`, color }}
                          >
                            <ExternalLink className="w-3 h-3" /> Open
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowDept(true)}
                        className="w-full mt-2 py-3 rounded-xl border-2 border-dashed border-base-300 text-[10px] font-semibold text-base-content/40 hover:text-primary transition-colors flex items-center justify-center gap-1.5 group/btn"
                        style={{ "--tw-border-opacity": 1 }}
                      >
                        <Plus className="w-3 h-3" />
                        Create {dept.label} Channel
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        )}
      </div>

      {/* ── Modals & Overlays ── */}

      <CreateConversationModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      <DepartmentChannelModal
        open={showDept}
        onClose={() => { setShowDept(false); setRefreshKey((k) => k + 1); }}
      />

      <AnimatePresence>
        {selectedConv && (
          <ConversationDrawer
            conversation={selectedConv}
            onClose={() => setSelectedConv(null)}
            onArchive={(c) => { setSelectedConv(null); handleArchive(c); }}
            onDelete={(c)  => { setSelectedConv(null); handleDelete(c);  }}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!confirmDel}
        title="Delete Conversation"
        desc={`"${confirmDel?.name || "This conversation"}" will be soft-deleted. Messages are preserved.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDel(null)}
        danger
      />

      <ConfirmDialog
        open={!!confirmArch}
        title={confirmArch?.isArchived ? "Unarchive Conversation" : "Archive Conversation"}
        desc={confirmArch?.isArchived
          ? `Restore "${confirmArch?.name || "this conversation"}" to active state?`
          : `Archive "${confirmArch?.name || "this conversation"}"? Members can still access history.`}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setConfirmArch(null)}
      />
    </div>
  );
}