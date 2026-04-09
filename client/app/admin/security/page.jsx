"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Search, RefreshCw, ChevronRight, Key,
  Bell, CheckCircle, XCircle, Clock, Globe,
  Smartphone, Monitor, Lock, Send,
  TrendingUp, TrendingDown, Award, Activity,
  Cpu, Users, User, Database, AlertTriangle,
  Info,
} from "lucide-react";
import Link from "next/link";
import {
  fetchUserSecurity,
  fetchAllUsers,
  sendUserNotification,
  adjustUserCoins,
  updateUserKyc,
  selectUserSecurity,
  selectAllUsers,
  selectSecurityLoading,
  selectSendNotificationLoading,
  selectAdjustCoinsLoading,
  selectUpdateKycLoading,
  selectListLoading,
} from "@/store/slices/adminUserSlice";

// ─────────────────────────────────────────────────────────────────────────────
// REAL SECURITY API RESPONSE SHAPE (doc index 6):
//
// data._id, data.name, data.email, data.role
// data.account.isEmailVerified, isPhoneVerified, isBlocked, blockReason, unblockAt, createdAt
// data.loginActivity.totalLogins, lastLoginAt, lastLoginIp, passwordChangedAt
// data.sessions.total, sessions.list[].{ userAgent, ipAddress, deviceName, platform, createdAt, lastActiveAt, _id }
// data.devices.total, devices.byPlatform
// data.coins.balance, totalEarned, totalRedeemed, balanceInRupees
// data.referral.code, referral.referredBy.{ _id, name, email }, referral.totalReferrals, referral.totalCoinsAwarded
// data.recentSecurityEvents[].{ _id, title, body, type, priority, isRead, createdAt }
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const KYC_STATUSES = [
  { value: "not-submitted", label: "Not Submitted", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  { value: "pending",       label: "Pending",       color: "#2563eb", bg: "rgba(59,130,246,0.1)"  },
  { value: "under-review",  label: "Under Review",  color: "#d97706", bg: "rgba(245,158,11,0.1)"  },
  { value: "verified",      label: "Verified",      color: "#16a34a", bg: "rgba(34,197,94,0.1)"   },
  { value: "rejected",      label: "Rejected",      color: "#dc2626", bg: "rgba(239,68,68,0.1)"   },
];

const NOTIF_TYPES      = ["general", "alert", "promotion", "account", "order", "payment"];
const NOTIF_PRIORITIES = ["low", "normal", "high", "urgent"];
const NOTIF_CHANNELS   = ["push", "email", "sms", "in-app"];

const ROLE_COLORS = {
  superadmin:       { bg: "rgba(139,92,246,0.12)", color: "#7c3aed" },
  admin:            { bg: "rgba(99,102,241,0.12)",  color: "#4f46e5" },
  doctor:           { bg: "rgba(16,185,129,0.12)",  color: "#059669" },
  pharmacy:         { bg: "rgba(245,158,11,0.12)",  color: "#d97706" },
  customer:         { bg: "rgba(59,130,246,0.12)",  color: "#2563eb" },
  "lab partner":    { bg: "rgba(236,72,153,0.12)",  color: "#db2777" },
  transportpartner: { bg: "rgba(234,88,12,0.12)",   color: "#ea580c" },
  finance:          { bg: "rgba(107,114,128,0.12)", color: "#4b5563" },
};

// Security event type → icon + color
const EVENT_TYPE_CFG = {
  Account_Security: { icon: Shield,        color: "#dc2626", bg: "rgba(239,68,68,0.08)"   },
  Account_Status:   { icon: Info,          color: "#2563eb", bg: "rgba(59,130,246,0.08)"  },
  Payment:          { icon: TrendingUp,    color: "#d97706", bg: "rgba(245,158,11,0.08)"  },
  default:          { icon: Bell,          color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

const PRIORITY_COLORS = {
  High:   "#dc2626",
  Normal: "#2563eb",
  Low:    "#6b7280",
  Urgent: "#7c3aed",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isValidObjectId(val) {
  return /^[a-f\d]{24}$/i.test((val || "").trim());
}

function kycCfg(status) {
  return KYC_STATUSES.find(k => k.value === status) || KYC_STATUSES[0];
}

function getPlatformIcon(platform) {
  if (!platform) return Monitor;
  const p = platform.toLowerCase();
  if (p.includes("mobile") || p.includes("android") || p.includes("ios")) return Smartphone;
  return Monitor;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || { bg: "rgba(107,114,128,0.1)", color: "#6b7280" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {role}
    </span>
  );
}

function KycBadge({ status, size = "sm" }) {
  const cfg = kycCfg(status);
  return (
    <span style={{ padding: size === "lg" ? "6px 14px" : "3px 10px", borderRadius: 20, fontSize: size === "lg" ? 12 : 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function SectionCard({ title, icon: Icon, iconColor = "var(--primary,#6366f1)", children, badge }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)", overflow: "hidden" }}>
      <div style={{ padding: "13px 20px", borderBottom: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={14} style={{ color: iconColor }} />
        <p style={{ fontSize: 13, fontWeight: 800, margin: 0, flex: 1 }}>{title}</p>
        {badge}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, badge, last }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
      paddingBottom: last ? 0 : 10,
      borderBottom: last ? "none" : "1px solid var(--base-200,#f3f4f6)",
      marginBottom: last ? 0 : 10,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0, width: 140 }}>
        {label}
      </span>
      {badge || (
        <span style={{ fontSize: 12, textAlign: "right", flex: 1, fontFamily: mono ? "monospace" : "inherit", fontWeight: mono ? 400 : 600, wordBreak: "break-all" }}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PICKER ROW
// ─────────────────────────────────────────────────────────────────────────────

function UserPickerRow({ u, selected, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9, padding: "8px 9px",
        borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", width: "100%",
        background: selected ? "rgba(99,102,241,0.08)" : "transparent",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = selected ? "rgba(99,102,241,0.08)" : "transparent"; }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        {u.avatar ? (
          <img src={u.avatar} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.1)", fontSize: 12, fontWeight: 800, color: "var(--primary,#6366f1)" }}>
            {(u.name || u.email || "?")[0].toUpperCase()}
          </div>
        )}
        <span style={{ position: "absolute", bottom: 0, right: 0, width: 7, height: 7, borderRadius: "50%", background: u.isOnline ? "#22c55e" : "#d1d5db", border: "1.5px solid var(--base-100,#fff)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "—"}</p>
        <p style={{ fontSize: 10, opacity: 0.4, margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
      </div>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        <RoleBadge role={u.role} />
        {selected && <CheckCircle size={11} style={{ color: "var(--primary,#6366f1)" }} />}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ROW — uses real sessions.list[] shape
// { userAgent, ipAddress, deviceName, platform, createdAt, lastActiveAt, _id }
// ─────────────────────────────────────────────────────────────────────────────

function SessionRow({ session, index }) {
  const PIcon = getPlatformIcon(session.platform);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
        borderRadius: 10, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)",
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.1)" }}>
        <PIcon size={16} style={{ color: "var(--primary,#6366f1)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* deviceName + platform */}
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 3px" }}>
          {session.deviceName || "Unknown device"}
          {session.platform && <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.45, marginLeft: 6 }}>({session.platform})</span>}
        </p>
        {/* userAgent */}
        {session.userAgent && (
          <p style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.35, margin: "0 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.userAgent}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, opacity: 0.45 }}>
          {/* ipAddress — real field name */}
          {session.ipAddress && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Globe size={9} />{session.ipAddress}
            </span>
          )}
          {/* createdAt */}
          {session.createdAt && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={9} />Signed in {fmt(session.createdAt)}
            </span>
          )}
          {/* lastActiveAt */}
          {session.lastActiveAt && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Activity size={9} />Active {timeAgo(session.lastActiveAt)}
            </span>
          )}
        </div>
      </div>
      {/* session _id suffix */}
      <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.25, flexShrink: 0, marginTop: 2 }}>
        …{session._id?.slice(-6)}
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY EVENT ROW — real recentSecurityEvents[] shape
// { _id, title, body, type, priority, isRead, createdAt }
// ─────────────────────────────────────────────────────────────────────────────

function SecurityEventRow({ event, index }) {
  const cfg = EVENT_TYPE_CFG[event.type] || EVENT_TYPE_CFG.default;
  const EIcon = cfg.icon;
  const priorityColor = PRIORITY_COLORS[event.priority] || "#6b7280";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px",
        borderRadius: 10, background: event.isRead ? "transparent" : cfg.bg,
        border: `1px solid ${event.isRead ? "var(--base-300,#e5e7eb)" : "color-mix(in srgb, " + cfg.color + ", transparent 70%)"}`,
      }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: cfg.bg }}>
        <EIcon size={14} style={{ color: cfg.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{event.title}</p>
          {/* priority badge */}
          <span style={{ padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 800, background: `${priorityColor}18`, color: priorityColor, letterSpacing: "0.05em" }}>
            {event.priority?.toUpperCase()}
          </span>
          {/* unread dot */}
          {!event.isRead && (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
          )}
        </div>
        <p style={{ fontSize: 11, opacity: 0.5, margin: "0 0 4px", lineHeight: 1.4 }}>{event.body}</p>
        <span style={{ fontSize: 10, opacity: 0.3 }}>{fmt(event.createdAt)}</span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND NOTIFICATION PANEL
// ─────────────────────────────────────────────────────────────────────────────

function SendNotificationPanel({ userId, loading, onSubmit }) {
  const [form, setForm] = useState({ title: "", body: "", type: "general", priority: "normal", channels: ["push"] });

  const toggleChannel = (ch) => setForm(p => ({
    ...p,
    channels: p.channels.includes(ch) ? p.channels.filter(c => c !== ch) : [...p.channels, ch],
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    onSubmit({ userId, ...form });
  };

  const fs = { width: "100%", padding: "8px 12px", borderRadius: 8, boxSizing: "border-box", border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, outline: "none", background: "var(--base-100,#fff)" };
  const ls = { display: "block", fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={ls}>Type</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={fs}>
            {NOTIF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={ls}>Priority</label>
          <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={fs}>
            {NOTIF_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={ls}>Title *</label>
        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Notification title" required style={fs} />
      </div>
      <div>
        <label style={ls}>Body *</label>
        <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Notification message" required rows={3} style={{ ...fs, resize: "vertical" }} />
      </div>
      <div>
        <label style={ls}>Channels</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {NOTIF_CHANNELS.map(ch => {
            const active = form.channels.includes(ch);
            return (
              <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", border: active ? "1.5px solid var(--primary,#6366f1)" : "1px solid var(--base-300,#e5e7eb)", background: active ? "rgba(99,102,241,0.1)" : "transparent", color: active ? "var(--primary,#6366f1)" : "inherit" }}>
                {ch}
              </button>
            );
          })}
        </div>
      </div>
      <button type="submit" disabled={loading || !form.title.trim() || !form.body.trim()}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "var(--primary,#6366f1)", color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
        {loading ? <><RefreshCw size={13} className="animate-spin" />Sending…</> : <><Send size={13} />Send Notification</>}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADJUST COINS PANEL — superadmin only
// Uses real: coins.balance
// ─────────────────────────────────────────────────────────────────────────────

function AdjustCoinsPanel({ userId, loading, onSubmit, coinsObj }) {
  const [form, setForm] = useState({ action: "credit", amount: "", reason: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || !form.reason.trim()) return;
    onSubmit({ userId, action: form.action, amount: Number(form.amount), reason: form.reason.trim() });
    setForm(p => ({ ...p, amount: "", reason: "" }));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Real fields: coins.balance, coins.balanceInRupees */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 900, color: "var(--primary,#6366f1)", margin: 0 }}>{(coinsObj?.balance || 0).toLocaleString()}</p>
          <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Coins Balance</p>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 900, color: "#16a34a", margin: 0 }}>₹{(coinsObj?.balanceInRupees || 0).toFixed(2)}</p>
          <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>In Rupees</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button type="button" onClick={() => setForm(p => ({ ...p, action: "credit" }))}
          style={{ padding: "9px 0", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: form.action === "credit" ? "1.5px solid #16a34a" : "1px solid var(--base-300,#e5e7eb)", background: form.action === "credit" ? "rgba(34,197,94,0.1)" : "transparent", color: form.action === "credit" ? "#16a34a" : "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <TrendingUp size={13} />Credit
        </button>
        <button type="button" onClick={() => setForm(p => ({ ...p, action: "debit" }))}
          style={{ padding: "9px 0", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: form.action === "debit" ? "1.5px solid #dc2626" : "1px solid var(--base-300,#e5e7eb)", background: form.action === "debit" ? "rgba(239,68,68,0.1)" : "transparent", color: form.action === "debit" ? "#dc2626" : "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <TrendingDown size={13} />Debit
        </button>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Amount *</label>
        <input type="number" min="1" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 500" required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, boxSizing: "border-box", outline: "none" }} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Reason *</label>
        <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Reason for adjustment" required style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, boxSizing: "border-box", outline: "none" }} />
      </div>
      <button type="submit" disabled={loading || !form.amount || !form.reason.trim()}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: form.action === "credit" ? "#16a34a" : "#dc2626", color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
        {loading
          ? <><RefreshCw size={13} className="animate-spin" />Processing…</>
          : form.action === "credit"
            ? <><TrendingUp size={13} />Credit Coins</>
            : <><TrendingDown size={13} />Debit Coins</>
        }
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC PANEL
// ─────────────────────────────────────────────────────────────────────────────

function KycPanel({ userId, currentStatus, loading, onSubmit }) {
  const [newStatus, setNewStatus] = useState(currentStatus || "not-submitted");
  const [rejection, setRejection] = useState("");
  const [confirm, setConfirm]     = useState(false);

  useEffect(() => { setNewStatus(currentStatus || "not-submitted"); }, [currentStatus]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ userId, kycStatus: newStatus, rejectionReason: rejection || undefined });
    setConfirm(false);
    setRejection("");
  };

  const changed = newStatus !== currentStatus;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Current Status</p>
        <KycBadge status={currentStatus} size="lg" />
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Set New Status</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {KYC_STATUSES.map(s => (
            <button key={s.value} type="button" onClick={() => setNewStatus(s.value)}
              style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", border: newStatus === s.value ? `1.5px solid ${s.color}` : "1px solid var(--base-300,#e5e7eb)", background: newStatus === s.value ? s.bg : "transparent", color: newStatus === s.value ? s.color : "inherit" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {newStatus === "rejected" && (
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Rejection Reason</label>
          <textarea value={rejection} onChange={e => setRejection(e.target.value)} placeholder="Explain why KYC was rejected…" rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
        </div>
      )}
      {changed && (
        !confirm ? (
          <button type="button" onClick={() => setConfirm(true)}
            style={{ padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: kycCfg(newStatus).bg, color: kycCfg(newStatus).color, border: `1.5px solid ${kycCfg(newStatus).color}`, cursor: "pointer" }}>
            Update to → {kycCfg(newStatus).label}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "var(--primary,#6366f1)", color: "white", border: "none", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Updating…" : "Confirm Update"}
            </button>
            <button type="button" onClick={() => setConfirm(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "var(--base-200,#f3f4f6)", border: "none", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SecurityManagement() {
  const dispatch = useDispatch();

  const user         = useSelector((s) => s.user?.user) ?? null;
  const isSuperadmin = user?.role === "superadmin";

  const security        = useSelector(selectUserSecurity);
  const allUsers        = useSelector(selectAllUsers);
  const securityLoading = useSelector(selectSecurityLoading);
  const notifLoading    = useSelector(selectSendNotificationLoading);
  const coinsLoading    = useSelector(selectAdjustCoinsLoading);
  const kycLoading      = useSelector(selectUpdateKycLoading);
  const usersLoading    = useSelector(selectListLoading);

  const [selectedUserId, setSelectedUserId]     = useState("");
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [userIdInput, setUserIdInput]           = useState("");
  const [idError, setIdError]                   = useState("");
  const [userSearch, setUserSearch]             = useState("");
  const [activeSection, setActiveSection]       = useState("overview");

  useEffect(() => {
    dispatch(fetchAllUsers({ limit: 20, sortBy: "createdAt", sortOrder: "desc" }));
  }, [dispatch]);

  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(fetchAllUsers({ search: userSearch, limit: 20 }));
    }, 350);
    return () => clearTimeout(t);
  }, [userSearch, dispatch]);

  const loadSecurity = useCallback((uid) => {
    dispatch(fetchUserSecurity(uid));
  }, [dispatch]);

  const handleManualFetch = (e) => {
    e.preventDefault();
    const trimmed = userIdInput.trim();
    if (!trimmed) { setIdError("Enter a User ID."); return; }
    if (!isValidObjectId(trimmed)) { setIdError("Must be a valid 24-character MongoDB ObjectId."); return; }
    setIdError("");
    setSelectedUserId(trimmed);
    setSelectedUserInfo(null);
    loadSecurity(trimmed);
  };

  const selectFromPicker = (u) => {
    setSelectedUserId(u._id);
    setSelectedUserInfo(u);
    setUserIdInput(u._id);
    setIdError("");
    loadSecurity(u._id);
  };

  const SECTIONS = [
    { key: "overview",     label: "Overview",     icon: Shield   },
    { key: "sessions",     label: "Sessions",     icon: Activity },
    { key: "kyc",          label: "KYC",          icon: Award    },
    { key: "coins",        label: "Coins",        icon: TrendingUp },
    { key: "notification", label: "Notification", icon: Bell     },
    { key: "events",       label: "Security Events", icon: AlertTriangle },
    { key: "devices",      label: "Devices",      icon: Cpu      },
  ];

  // ── Shorthand accessors for real API nested fields ───────────────────────
  // security = data from /security endpoint (stored in Redux as selectUserSecurity)
  const sec = security;
  // Nested objects — all from real response
  const acct   = sec?.account          ?? {};   // isEmailVerified, isPhoneVerified, isBlocked, blockReason, unblockAt, createdAt
  const login  = sec?.loginActivity    ?? {};   // totalLogins, lastLoginAt, lastLoginIp, passwordChangedAt
  const sess   = sec?.sessions         ?? {};   // total, list[]
  const devs   = sec?.devices          ?? {};   // total, byPlatform
  const coins  = sec?.coins            ?? {};   // balance, totalEarned, totalRedeemed, balanceInRupees
  const ref    = sec?.referral         ?? {};   // code, referredBy{_id,name,email}, totalReferrals, totalCoinsAwarded
  const events = sec?.recentSecurityEvents ?? [];

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "var(--base-100,#f9fafb)" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Link href="/admin" style={{ fontSize: 12, opacity: 0.45, textDecoration: "none" }}>Admin</Link>
          <ChevronRight size={12} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary,#6366f1)" }}>Security Management</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>Security Management</h1>
        <p style={{ fontSize: 13, opacity: 0.45, marginTop: 4 }}>Sessions, KYC, coins, notifications and security events per user</p>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Manual ID lookup */}
          <div style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Lookup by User ID</p>
            <form onSubmit={handleManualFetch} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: `1px solid ${idError ? "#ef4444" : "var(--base-300,#e5e7eb)"}`, borderRadius: 8 }}>
                <Key size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                <input value={userIdInput}
                  onChange={e => { setUserIdInput(e.target.value); if (idError) setIdError(""); }}
                  placeholder="24-char ObjectId" maxLength={24}
                  style={{ border: "none", outline: "none", fontSize: 11, fontFamily: "monospace", background: "transparent", flex: 1 }} />
              </div>
              {idError && <p style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, margin: 0 }}>{idError}</p>}
              <button type="submit" disabled={securityLoading}
                style={{ padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "var(--primary,#6366f1)", color: "white", border: "none", cursor: securityLoading ? "not-allowed" : "pointer", opacity: securityLoading ? 0.6 : 1 }}>
                {securityLoading ? "Loading…" : "Load Security"}
              </button>
            </form>
          </div>

          {/* User picker */}
          <div style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Or pick a user</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid var(--base-300,#e5e7eb)", borderRadius: 8, marginBottom: 8 }}>
              <Search size={12} style={{ opacity: 0.4 }} />
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name / email…"
                style={{ border: "none", outline: "none", fontSize: 11, background: "transparent", flex: 1 }} />
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {usersLoading
                ? <p style={{ fontSize: 11, opacity: 0.35, textAlign: "center", padding: "16px 0" }}>Loading…</p>
                : allUsers.map(u => (
                    <UserPickerRow key={u._id} u={u} selected={selectedUserId === u._id} onClick={() => selectFromPicker(u)} />
                  ))
              }
            </div>
          </div>

          {/* Section nav — only shown once data loads */}
          {selectedUserId && sec && (
            <div style={{ padding: "8px", borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)", display: "flex", flexDirection: "column", gap: 2 }}>
              {SECTIONS.map(s => {
                const SIcon = s.icon;
                const active = activeSection === s.key;
                return (
                  <button key={s.key} onClick={() => setActiveSection(s.key)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", background: active ? "rgba(99,102,241,0.08)" : "transparent", color: active ? "var(--primary,#6366f1)" : "inherit", fontWeight: active ? 700 : 500, fontSize: 13 }}>
                    <SIcon size={14} style={{ color: active ? "var(--primary,#6366f1)" : undefined, opacity: active ? 1 : 0.45 }} />
                    {s.label}
                    {s.key === "events" && events.length > 0 && (
                      <span style={{ marginLeft: "auto", padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 800, background: "rgba(239,68,68,0.1)", color: "#dc2626" }}>
                        {events.filter(e => !e.isRead).length || events.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT CONTENT ─────────────────────────────────────────────────── */}
        <div>
          {!selectedUserId ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ padding: "60px 40px", borderRadius: 16, textAlign: "center", border: "1px dashed var(--base-300,#e5e7eb)", opacity: 0.4 }}>
              <Shield size={36} style={{ margin: "0 auto 14px" }} />
              <p style={{ fontSize: 14, fontWeight: 700 }}>Select a user to view security details</p>
            </motion.div>
          ) : securityLoading ? (
            <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.4 }}>
              <RefreshCw size={24} className="animate-spin" style={{ display: "block", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13 }}>Loading security data…</p>
            </div>
          ) : !sec ? (
            <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.35 }}>
              <XCircle size={28} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13 }}>No data found for this user</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">

              {/* ════════════════════════════════════════════════════════════ */}
              {/* OVERVIEW                                                      */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "overview" && (
                <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Identity card — uses sec._id, sec.name, sec.email, sec.role + selectedUserInfo for avatar/isOnline */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {selectedUserInfo?.avatar ? (
                        <img src={selectedUserInfo.avatar} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.1)", fontSize: 22, fontWeight: 900, color: "var(--primary,#6366f1)" }}>
                          {(sec.name || sec.email || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      {selectedUserInfo && (
                        <span style={{ position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: "50%", background: selectedUserInfo.isOnline ? "#22c55e" : "#d1d5db", border: "2px solid var(--base-100,#fff)" }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{sec.name || "—"}</p>
                        <RoleBadge role={sec.role} />
                        {/* account.isBlocked — real field */}
                        {acct.isBlocked && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(239,68,68,0.1)", color: "#dc2626" }}>Blocked</span>}
                        {/* account.isEmailVerified — real field */}
                        {acct.isEmailVerified && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>Email Verified</span>}
                      </div>
                      <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 2px" }}>{sec.email}</p>
                      {/* loginActivity.lastLoginAt, lastLoginIp, totalLogins — real fields */}
                      <p style={{ fontSize: 11, opacity: 0.35, margin: 0, fontFamily: "monospace" }}>
                        Last login {fmt(login.lastLoginAt)} · {login.lastLoginIp} · {login.totalLogins} total logins
                      </p>
                    </div>
                    <button onClick={() => loadSecurity(selectedUserId)}
                      style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", flexShrink: 0 }}>
                      <RefreshCw size={14} style={{ opacity: 0.5 }} />
                    </button>
                  </div>

                  {/* Stats — real fields from nested objects */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                    {[
                      { label: "Coins Balance",  value: (coins.balance || 0).toLocaleString(),      color: "#d97706", icon: TrendingUp  },
                      { label: "Total Earned",   value: (coins.totalEarned || 0).toLocaleString(),   color: "#16a34a", icon: TrendingUp  },
                      { label: "Total Redeemed", value: (coins.totalRedeemed || 0).toLocaleString(), color: "#dc2626", icon: TrendingDown },
                      { label: "Active Sessions",value: sess.total ?? 0,                              color: "var(--primary,#6366f1)", icon: Activity },
                      { label: "Total Logins",   value: login.totalLogins ?? "—",                    color: "#6b7280", icon: User        },
                    ].map(s => {
                      const SIcon = s.icon;
                      return (
                        <div key={s.label} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)", display: "flex", alignItems: "center", gap: 10 }}>
                          <SIcon size={16} style={{ color: s.color, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 17, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
                            <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{s.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Account details — sec.account.* */}
                  <SectionCard title="Account" icon={Shield}>
                    <InfoRow label="User ID"         value={sec._id}              mono />
                    <InfoRow label="Name"            value={sec.name}                  />
                    <InfoRow label="Email"           value={sec.email}            mono />
                    <InfoRow label="Role"            badge={<RoleBadge role={sec.role} />} />
                    <InfoRow label="Email Verified"  badge={
                      <span style={{ fontSize: 12, fontWeight: 700, color: acct.isEmailVerified ? "#16a34a" : "#dc2626" }}>
                        {acct.isEmailVerified ? "✓ Yes" : "✗ No"}
                      </span>
                    } />
                    <InfoRow label="Phone Verified"  badge={
                      <span style={{ fontSize: 12, fontWeight: 700, color: acct.isPhoneVerified ? "#16a34a" : "#dc2626" }}>
                        {acct.isPhoneVerified ? "✓ Yes" : "✗ No"}
                      </span>
                    } />
                    <InfoRow label="Blocked"         badge={
                      <span style={{ fontSize: 12, fontWeight: 700, color: acct.isBlocked ? "#dc2626" : "#16a34a" }}>
                        {acct.isBlocked ? "✗ Yes" : "✓ No"}
                      </span>
                    } />
                    {acct.blockReason && <InfoRow label="Block Reason"   value={acct.blockReason}       />}
                    {acct.unblockAt   && <InfoRow label="Unblock At"     value={fmt(acct.unblockAt)}    />}
                    <InfoRow label="Account Created" value={fmt(acct.createdAt)} last />
                  </SectionCard>

                  {/* Login activity — sec.loginActivity.* */}
                  <SectionCard title="Login Activity" icon={Activity}>
                    <InfoRow label="Total Logins"      value={login.totalLogins}                              />
                    <InfoRow label="Last Login"        value={fmt(login.lastLoginAt)}                         />
                    <InfoRow label="Last Login IP"     value={login.lastLoginIp}         mono                 />
                    <InfoRow label="Password Changed"  value={fmt(login.passwordChangedAt)} last              />
                  </SectionCard>

                  {/* Referral — sec.referral.* */}
                  <SectionCard title="Referral" icon={Users}>
                    <InfoRow label="Referral Code"    value={ref.code}                     mono />
                    <InfoRow label="Total Referrals"  value={ref.totalReferrals}                />
                    <InfoRow label="Coins Awarded"    value={(ref.totalCoinsAwarded || 0).toLocaleString()}  />
                    {ref.referredBy && (
                      <InfoRow label="Referred By" badge={
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{ref.referredBy.name}</p>
                          <p style={{ fontSize: 10, opacity: 0.45, margin: 0 }}>{ref.referredBy.email}</p>
                        </div>
                      } last />
                    )}
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* SESSIONS — sec.sessions.{ total, list[] }                   */}
              {/* Each session: userAgent, ipAddress, deviceName, platform,   */}
              {/*               createdAt, lastActiveAt, _id                   */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "sessions" && (
                <motion.div key="sessions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SectionCard title={`Active Sessions (${sess.total ?? 0})`} icon={Activity}
                    badge={
                      <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: "rgba(99,102,241,0.1)", color: "var(--primary,#6366f1)" }}>
                        {sess.total ?? 0} total
                      </span>
                    }>
                    {!sess.list || sess.list.length === 0 ? (
                      <div style={{ padding: "24px 0", textAlign: "center", opacity: 0.35 }}>
                        <Lock size={24} style={{ margin: "0 auto 8px" }} />
                        <p style={{ fontSize: 12 }}>No active sessions found</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {sess.list.map((s, i) => (
                          <SessionRow key={s._id} session={s} index={i} />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* KYC                                                          */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "kyc" && (
                <motion.div key="kyc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SectionCard title="Update KYC Status" icon={Award} iconColor="#d97706">
                    <KycPanel
                      userId={selectedUserId}
                      currentStatus={undefined}   // security endpoint does not return kyc status — pass undefined = "not-submitted"
                      loading={kycLoading}
                      onSubmit={(payload) => dispatch(updateUserKyc(payload))}
                    />
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* COINS — sec.coins.{ balance, totalEarned, totalRedeemed, balanceInRupees } */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "coins" && (
                <motion.div key="coins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  <SectionCard title="Coin Summary" icon={TrendingUp} iconColor="#d97706">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                      {[
                        { label: "Balance",       value: coins.balance      || 0, color: "var(--primary,#6366f1)" },
                        { label: "In Rupees",     value: `₹${(coins.balanceInRupees || 0).toFixed(2)}`, color: "#16a34a", raw: true },
                        { label: "Total Earned",  value: coins.totalEarned  || 0, color: "#16a34a" },
                        { label: "Total Redeemed",value: coins.totalRedeemed|| 0, color: "#dc2626" },
                      ].map(c => (
                        <div key={c.label} style={{ padding: "12px 10px", borderRadius: 10, background: "var(--base-200,#f3f4f6)", textAlign: "center" }}>
                          <p style={{ fontSize: 18, fontWeight: 900, color: c.color, margin: 0 }}>
                            {c.raw ? c.value : Number(c.value).toLocaleString()}
                          </p>
                          <p style={{ fontSize: 9, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{c.label}</p>
                        </div>
                      ))}
                    </div>
                    <InfoRow label="Referral Code" value={ref.code} mono last />
                  </SectionCard>

                  {isSuperadmin ? (
                    <SectionCard title="Adjust Coins" icon={TrendingUp} iconColor="#16a34a">
                      <AdjustCoinsPanel
                        userId={selectedUserId}
                        loading={coinsLoading}
                        coinsObj={coins}
                        onSubmit={(payload) => dispatch(adjustUserCoins(payload))}
                      />
                    </SectionCard>
                  ) : (
                    <div style={{ padding: "24px", borderRadius: 14, border: "1px dashed var(--base-300,#e5e7eb)", textAlign: "center", opacity: 0.35 }}>
                      <Lock size={24} style={{ margin: "0 auto 8px" }} />
                      <p style={{ fontSize: 13 }}>Coin adjustment requires superadmin access</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* NOTIFICATION                                                  */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "notification" && (
                <motion.div key="notification" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SectionCard title="Send Manual Notification" icon={Bell} iconColor="var(--primary,#6366f1)">
                    <SendNotificationPanel
                      userId={selectedUserId}
                      loading={notifLoading}
                      onSubmit={(payload) => dispatch(sendUserNotification(payload))}
                    />
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* SECURITY EVENTS — sec.recentSecurityEvents[]                 */}
              {/* Each event: _id, title, body, type, priority, isRead, createdAt */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "events" && (
                <motion.div key="events" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SectionCard title={`Recent Security Events (${events.length})`} icon={AlertTriangle} iconColor="#dc2626"
                    badge={
                      events.filter(e => !e.isRead).length > 0 && (
                        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: "rgba(239,68,68,0.1)", color: "#dc2626" }}>
                          {events.filter(e => !e.isRead).length} unread
                        </span>
                      )
                    }>
                    {events.length === 0 ? (
                      <div style={{ padding: "24px 0", textAlign: "center", opacity: 0.35 }}>
                        <Bell size={24} style={{ margin: "0 auto 8px" }} />
                        <p style={{ fontSize: 12 }}>No security events</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {events.map((ev, i) => (
                          <SecurityEventRow key={ev._id} event={ev} index={i} />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* DEVICES — sec.devices.{ total, byPlatform }                  */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "devices" && (
                <motion.div key="devices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SectionCard title="Registered Devices" icon={Cpu} iconColor="var(--info,#3b82f6)">
                    <InfoRow label="Total Devices" value={devs.total ?? 0} />

                    {/* byPlatform — real field: devices.byPlatform{} */}
                    {Object.keys(devs.byPlatform || {}).length > 0 ? (
                      <>
                        <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 4 }}>By Platform</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {Object.entries(devs.byPlatform).map(([platform, count]) => (
                            <div key={platform} style={{ padding: "8px 14px", borderRadius: 9, background: "var(--base-200,#f3f4f6)", textAlign: "center" }}>
                              <p style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{count}</p>
                              <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{platform}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: "20px 0", textAlign: "center", opacity: 0.3, marginTop: 8 }}>
                        <Cpu size={22} style={{ margin: "0 auto 8px" }} />
                        {/* devices.total = 0 from real response */}
                        <p style={{ fontSize: 12 }}>No device tokens registered (total: {devs.total ?? 0})</p>
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}