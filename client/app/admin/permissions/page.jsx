"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
} from "recharts";
import {
  Shield, ShieldCheck, ShieldX, Search, SlidersHorizontal,
  Coins, Bell, Settings, ChevronRight, CheckCircle, XCircle,
  Clock, Eye, RotateCcw, AlertTriangle, Loader2,
  Send, Minus, Plus, Filter, Users, Star, Lock,
  BadgeCheck, FileCheck, Fingerprint, CreditCard,
} from "lucide-react";
import Link from "next/link";
import {
  fetchAllUsers, updateUserKyc, adjustUserCoins,
  sendUserNotification, updateUserSettings, fetchUserSettings,
  selectAllUsers, selectUsersPagination, selectUsersFilters,
  selectListLoading, selectUpdateKycLoading,
  selectAdjustCoinsLoading, selectSendNotificationLoading,
  setFilters,
} from "@/store/slices/adminUserSlice";

// ── KYC status config ─────────────────────────────────────────────────────────
const KYC_STATUS = {
  verified:      { label: "Verified",      color: "var(--success)", icon: ShieldCheck },
  pending:       { label: "Pending",       color: "var(--warning)", icon: Clock       },
  "under-review":{ label: "Under Review",  color: "var(--info)",    icon: Eye         },
  rejected:      { label: "Rejected",      color: "var(--error)",   icon: ShieldX     },
  "not-submitted":{ label: "Not Submitted",color: "var(--neutral)", icon: Shield      },
};

// Roles that have KYC in the system
const KYC_ROLES = ["transportpartner", "care assistant", "driver"];

// ── Small stat pill ───────────────────────────────────────────────────────────
function Pill({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
      style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}>
      <Icon size={16} style={{ color }} />
      <div>
        <p className="text-xs opacity-55 font-semibold uppercase tracking-wider">{label}</p>
        <p className="font-display font-black text-lg leading-tight" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

// ── KYC status badge ──────────────────────────────────────────────────────────
function KycBadge({ status }) {
  const cfg = KYC_STATUS[status] || KYC_STATUS["not-submitted"];
  const Icon = cfg.icon;
  return (
    <span className="badge flex items-center gap-1" style={{
      background: `color-mix(in srgb, ${cfg.color}, transparent 85%)`,
      color: cfg.color,
      border: `1px solid color-mix(in srgb, ${cfg.color}, transparent 65%)`,
    }}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

// ── KYC Update Panel (slide-in) ───────────────────────────────────────────────
function KycPanel({ user, onClose }) {
  const dispatch = useDispatch();
  const loading  = useSelector(selectUpdateKycLoading);
  const [kycStatus, setKycStatus] = useState("");
  const [reason, setReason]       = useState("");

  const handleUpdate = async () => {
    if (!kycStatus) return;
    const result = await dispatch(updateUserKyc({ userId: user._id, kycStatus, rejectionReason: reason }));
    if (!result.error) onClose();
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 backdrop-blur-strong" style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose} />
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        className="glass-card p-7 w-full max-w-md relative z-10">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--primary), transparent 85%)" }}>
            <Fingerprint size={20} style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h3 className="font-display font-black text-lg" style={{ color: "var(--base-content)" }}>
              Update KYC
            </h3>
            <p className="text-xs opacity-50">{user.name} · {user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block mb-2">New KYC Status</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(KYC_STATUS).map(([val, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={val} onClick={() => setKycStatus(val)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border"
                    style={kycStatus === val ? {
                      background: cfg.color,
                      color: "white",
                      borderColor: cfg.color,
                    } : {
                      background: `color-mix(in srgb, ${cfg.color}, transparent 90%)`,
                      color: cfg.color,
                      borderColor: `color-mix(in srgb, ${cfg.color}, transparent 70%)`,
                    }}>
                    <Icon size={12} />{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {kycStatus === "rejected" && (
            <div>
              <label className="block mb-1.5">Rejection Reason</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                rows={3} placeholder="Explain why documents were rejected…"
                className="input-field w-full resize-none" />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1 !py-2.5">Cancel</button>
          <button onClick={handleUpdate} disabled={!kycStatus || loading}
            className="btn-primary-cta flex-1 !py-2.5 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
            Update KYC
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Coin Adjust Panel ─────────────────────────────────────────────────────────
function CoinPanel({ user, onClose }) {
  const dispatch = useDispatch();
  const loading  = useSelector(selectAdjustCoinsLoading);
  const [action, setAction] = useState("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!amount || !reason) return;
    const result = await dispatch(adjustUserCoins({
      userId: user._id, action, amount: Number(amount), reason,
    }));
    if (!result.error) onClose();
  };

  const rupeesPreview = amount ? (Number(amount) / 100).toFixed(2) : "0.00";

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 backdrop-blur-strong" style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose} />
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-card p-7 w-full max-w-md relative z-10">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--warning), transparent 82%)" }}>
            <Coins size={20} style={{ color: "var(--warning)" }} />
          </div>
          <div>
            <h3 className="font-display font-black text-lg">Adjust Coins</h3>
            <p className="text-xs opacity-50">
              {user.name} · Current balance: <strong>{user.coins || 0}</strong> coins
              (₹{((user.coins || 0) / 100).toFixed(2)})
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Action toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--base-300)" }}>
            {["credit", "debit"].map(a => (
              <button key={a} onClick={() => setAction(a)}
                className="flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={action === a ? {
                  background: a === "credit" ? "var(--success)" : "var(--error)",
                  color: "white"
                } : {
                  background: "var(--base-200)",
                  color: "var(--base-content)",
                  opacity: 0.6,
                }}>
                {a === "credit" ? <Plus size={14} /> : <Minus size={14} />}
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>

          <div>
            <label className="block mb-1.5">Coin Amount</label>
            <input type="number" min="1" value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 500 (= ₹5)"
              className="input-field w-full" />
            {amount && (
              <p className="text-xs mt-1 opacity-50">
                ≈ ₹{rupeesPreview} ({amount} coins = ₹{rupeesPreview})
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1.5">Reason <span className="text-error">*</span></label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Referral bonus, promotional credit…"
              className="input-field w-full" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1 !py-2.5">Cancel</button>
          <button onClick={handleSubmit} disabled={!amount || !reason || loading}
            className="flex-1 !py-2.5 flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-wider rounded-lg transition-all"
            style={{
              background: action === "credit" ? "var(--success)" : "var(--error)",
              color: "white",
              opacity: (!amount || !reason || loading) ? 0.5 : 1,
            }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
            {action === "credit" ? "Credit" : "Debit"} Coins
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Send Notification Panel ───────────────────────────────────────────────────
function NotifPanel({ user, onClose }) {
  const dispatch = useDispatch();
  const loading  = useSelector(selectSendNotificationLoading);
  const NOTIF_TYPES = [
    "Admin_Announcement", "Account_Security", "Account_Status",
    "Promo_Marketing", "Coins_Credited", "KYC_Approved", "KYC_Rejected",
  ];
  const [form, setForm] = useState({
    title: "", body: "", type: "Admin_Announcement", priority: "Medium",
  });

  const handleSend = async () => {
    if (!form.title || !form.body) return;
    const result = await dispatch(sendUserNotification({ userId: user._id, ...form }));
    if (!result.error) onClose();
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 backdrop-blur-strong" style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose} />
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="glass-card p-7 w-full max-w-md relative z-10">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--info), transparent 82%)" }}>
            <Send size={18} style={{ color: "var(--info)" }} />
          </div>
          <div>
            <h3 className="font-display font-black text-lg">Send Notification</h3>
            <p className="text-xs opacity-50">{user.name} · {user.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block mb-1.5">Title</label>
            <input type="text" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Notification title…" className="input-field w-full" />
          </div>
          <div>
            <label className="block mb-1.5">Message Body</label>
            <textarea rows={3} value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              placeholder="Write your message…" className="input-field w-full resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="input-field w-full text-sm cursor-pointer">
                {NOTIF_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="input-field w-full text-sm cursor-pointer">
                {["Low", "Medium", "High", "Critical"].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1 !py-2.5">Cancel</button>
          <button onClick={handleSend} disabled={!form.title || !form.body || loading}
            className="btn-primary-cta flex-1 !py-2.5 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── User permission row ───────────────────────────────────────────────────────
function PermissionRow({ user, index, onKyc, onCoin, onNotif }) {
  const kycStatus = user.profile?.ownerKyc?.kycStatus
    || user.profile?.kyc?.verificationStatus?.toLowerCase()
    || "not-submitted";

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.04 }}
      className="hover:bg-base-200 transition-colors group"
      style={{ borderBottom: "1px solid var(--base-300)" }}
    >
      {/* User */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: "var(--base-300)" }}>
            {user.avatar
              ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-xs font-black"
                  style={{ color: "var(--primary)" }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
            }
          </div>
          <div>
            <p className="font-semibold text-sm">{user.name}</p>
            <p className="text-xs opacity-45">{user.role}</p>
          </div>
        </div>
      </td>

      {/* Email verified */}
      <td className="px-5 py-4">
        {user.isEmailVerified
          ? <CheckCircle size={16} style={{ color: "var(--success)" }} />
          : <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
        }
      </td>

      {/* KYC */}
      <td className="px-5 py-4">
        {KYC_ROLES.includes(user.role)
          ? <KycBadge status={kycStatus} />
          : <span className="text-xs opacity-30">N/A</span>
        }
      </td>

      {/* Coins */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <Coins size={12} style={{ color: "var(--warning)" }} />
          <span className="text-sm font-semibold">{(user.coins || 0).toLocaleString()}</span>
          <span className="text-xs opacity-40">= ₹{((user.coins || 0) / 100).toFixed(0)}</span>
        </div>
      </td>

      {/* Blocked */}
      <td className="px-5 py-4">
        {user.isBlocked
          ? <span className="badge badge-error gap-1"><XCircle size={10} />Blocked</span>
          : <span className="badge badge-success gap-1"><CheckCircle size={10} />Active</span>
        }
      </td>

      {/* Actions */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/admin/users/${user._id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-300 transition-colors"
            title="View Profile">
            <Eye size={14} />
          </Link>
          {KYC_ROLES.includes(user.role) && (
            <button onClick={() => onKyc(user)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-300 transition-colors"
              title="Update KYC">
              <ShieldCheck size={14} style={{ color: "var(--info)" }} />
            </button>
          )}
          <button onClick={() => onCoin(user)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-300 transition-colors"
            title="Adjust Coins">
            <Coins size={14} style={{ color: "var(--warning)" }} />
          </button>
          <button onClick={() => onNotif(user)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-300 transition-colors"
            title="Send Notification">
            <Send size={14} style={{ color: "var(--primary)" }} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function Permissions() {
  const dispatch = useDispatch();
  const users      = useSelector(selectAllUsers);
  const filters    = useSelector(selectUsersFilters);
  const listLoading = useSelector(selectListLoading);

  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [kycTarget, setKycTarget] = useState(null);
  const [coinTarget, setCoinTarget] = useState(null);
  const [notifTarget, setNotifTarget] = useState(null);

  useEffect(() => {
    dispatch(fetchAllUsers({ ...filters, search, role: roleFilter, page: 1, limit: 50 }));
  }, [dispatch, search, roleFilter]);

  // Stats
  const totalCoins     = users.reduce((s, u) => s + (u.coins || 0), 0);
  const kycPending     = users.filter(u => u.profile?.ownerKyc?.kycStatus === "pending").length;
  const kycVerified    = users.filter(u => u.profile?.ownerKyc?.kycStatus === "verified").length;
  const verifiedEmails = users.filter(u => u.isEmailVerified).length;

  const kycDistData = [
    { name: "Verified",      value: kycVerified,   color: "var(--success)" },
    { name: "Pending",       value: kycPending,     color: "var(--warning)" },
    { name: "Rejected",      value: users.filter(u => u.profile?.ownerKyc?.kycStatus === "rejected").length, color: "var(--error)" },
    { name: "Under Review",  value: users.filter(u => u.profile?.ownerKyc?.kycStatus === "under-review").length, color: "var(--info)" },
  ].filter(d => d.value > 0);

  const filtered = users.filter(u =>
    (!search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter)
  );

  return (
    <div className="min-h-screen p-6 space-y-8" style={{ background: "var(--base-100)" }}>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/users" className="text-xs opacity-50 hover:opacity-80 transition-opacity">
              User Management
            </Link>
            <ChevronRight size={12} className="opacity-30" />
            <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>Permissions & KYC</span>
          </div>
          <h1 className="section-heading !mb-0">Permissions &amp; KYC</h1>
          <p className="section-subheading !mb-0">Verify identities, adjust coins, manage access</p>
        </div>
      </motion.div>

      {/* ── Summary pills ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: BadgeCheck, label: "KYC Verified",   value: kycVerified,   color: "var(--success)" },
          { icon: Clock,      label: "KYC Pending",    value: kycPending,    color: "var(--warning)" },
          { icon: CheckCircle,label: "Emails Verified",value: verifiedEmails,color: "var(--chart-1)" },
          { icon: Coins,      label: "Total Coins",    value: totalCoins.toLocaleString(), color: "var(--warning)" },
        ].map((p, i) => (
          <motion.div key={p.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Pill {...p} />
          </motion.div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* KYC Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-5">
          <h3 className="text-base font-bold mb-4">KYC Distribution</h3>
          {kycDistData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={kycDistData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={4} dataKey="value">
                    {kycDistData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{
                    background: "var(--base-100)", border: "1px solid var(--base-300)",
                    borderRadius: "var(--r-box)", fontSize: 12
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {kycDistData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="opacity-65">{d.name}</span>
                    <span className="font-bold ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center opacity-30 text-sm">
              No KYC data yet
            </div>
          )}
        </motion.div>

        {/* Verification coverage */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card p-5">
          <h3 className="text-base font-bold mb-4">Verification Coverage</h3>
          <div className="space-y-4 mt-2">
            {[
              { label: "Email Verified",   value: verifiedEmails,  total: users.length, color: "var(--chart-1)" },
              { label: "KYC Verified",     value: kycVerified,     total: Math.max(users.filter(u => KYC_ROLES.includes(u.role)).length, 1), color: "var(--success)" },
              { label: "Not Blocked",      value: users.filter(u => !u.isBlocked).length, total: users.length, color: "var(--chart-2)" },
            ].map(item => {
              const pct = users.length > 0 ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="opacity-60 font-semibold">{item.label}</span>
                    <span className="font-bold">{item.value} / {item.total} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--base-300)" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className="h-full rounded-full" style={{ background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Table ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="glass-card overflow-hidden">

        {/* Toolbar */}
        <div className="p-5 border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center"
          style={{ borderColor: "var(--base-300)" }}>
          <div className="flex items-center gap-2 input-field flex-1 max-w-xs">
            <Search size={14} className="opacity-40" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search user…" className="bg-transparent flex-1 outline-none text-sm" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="input-field text-sm cursor-pointer">
            <option value="">All Roles</option>
            {["customer","doctor","pharmacy","transportpartner","lab partner","care assistant","driver"].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <p className="text-xs opacity-40 ml-auto">{filtered.length} users</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--base-200)", borderBottom: "1px solid var(--base-300)" }}>
                {["User", "Email", "KYC Status", "Coins", "Account", "Quick Actions"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider"
                    style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {listLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--base-300)" }}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-4"><div className="skeleton h-4 rounded" /></td>
                        ))}
                      </tr>
                    ))
                  : filtered.map((user, i) => (
                      <PermissionRow key={user._id} user={user} index={i}
                        onKyc={setKycTarget}
                        onCoin={setCoinTarget}
                        onNotif={setNotifTarget} />
                    ))
                }
              </AnimatePresence>
            </tbody>
          </table>
          {!listLoading && filtered.length === 0 && (
            <div className="text-center py-16 opacity-30">
              <Users size={36} className="mx-auto mb-3" />
              <p className="text-sm font-semibold">No users match your filters</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Panels ── */}
      <AnimatePresence>
        {kycTarget   && <KycPanel   user={kycTarget}   onClose={() => setKycTarget(null)} />}
        {coinTarget  && <CoinPanel  user={coinTarget}  onClose={() => setCoinTarget(null)} />}
        {notifTarget && <NotifPanel user={notifTarget} onClose={() => setNotifTarget(null)} />}
      </AnimatePresence>
    </div>
  );
}