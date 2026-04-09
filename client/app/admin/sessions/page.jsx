"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor, Smartphone, Tablet, Globe, MapPin, Clock,
  RefreshCw, LogOut, Shield, ChevronRight, Search,
  CheckCircle, XCircle, Key, Activity, Users, Lock,
} from "lucide-react";
import Link from "next/link";
import {
  fetchUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  fetchAllUsers,
  selectUserSessions,
  selectAllUsers,
  selectSessionsLoading,
  selectRevokeSessionLoading,
  selectRevokeAllSessionsLoading,
  selectListLoading,
} from "@/store/slices/adminUserSlice";

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

function getPlatformIcon(ua) {
  if (!ua) return Monitor;
  const u = ua.toLowerCase();
  if (u.includes("android") || u.includes("iphone") || u.includes("mobile")) return Smartphone;
  if (u.includes("ipad") || u.includes("tablet")) return Tablet;
  return Monitor;
}

function isValidObjectId(val) {
  return /^[a-f\d]{24}$/i.test((val || "").trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE
// ─────────────────────────────────────────────────────────────────────────────

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

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || { bg: "rgba(107,114,128,0.1)", color: "#6b7280" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {role}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PICKER ROW — exact fields from real API response
// avatar, name, email, role, isOnline, isBlocked
// ─────────────────────────────────────────────────────────────────────────────

function UserPickerRow({ u, selected, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
        borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", width: "100%",
        background: selected ? "rgba(99,102,241,0.08)" : "transparent",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? "rgba(99,102,241,0.08)" : "transparent"; }}
    >
      {/* Avatar from real API `avatar` field */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {u.avatar ? (
          <img src={u.avatar} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} />
        ) : (
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(99,102,241,0.1)", fontSize: 13, fontWeight: 800,
            color: "var(--primary,#6366f1)",
          }}>
            {(u.name || u.email || "?")[0].toUpperCase()}
          </div>
        )}
        {/* isOnline dot — real API field */}
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: 8, height: 8, borderRadius: "50%",
          background: u.isOnline ? "#22c55e" : "#d1d5db",
          border: "1.5px solid var(--base-100,#fff)",
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* name */}
        <p style={{ fontSize: 12, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {u.name || "—"}
        </p>
        {/* email */}
        <p style={{ fontSize: 10, opacity: 0.45, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {u.email}
        </p>
      </div>

      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <RoleBadge role={u.role} />
        {selected && <CheckCircle size={11} style={{ color: "var(--primary,#6366f1)" }} />}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CARD
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({ session, index, onRevoke, revoking }) {
  const [confirm, setConfirm] = useState(false);
  const PIcon = getPlatformIcon(session.userAgent || "");
  const isStale = session.isRevoked || session.isExpired;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.04, 0.28) }}
      style={{
        padding: "14px 18px", borderRadius: 12,
        border: "1px solid var(--base-300,#e5e7eb)",
        background: "var(--base-100,#fff)",
        display: "flex", alignItems: "flex-start", gap: 14,
        opacity: isStale ? 0.55 : 1,
      }}
    >
      {/* Device icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isStale ? "rgba(107,114,128,0.08)" : "rgba(99,102,241,0.1)",
      }}>
        <PIcon size={17} style={{ color: isStale ? "#6b7280" : "var(--primary,#6366f1)" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title + status badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 5 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
            {session.deviceName || session.platform || "Unknown device"}
          </p>
          {session.isCurrent && (
            <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: "rgba(34,197,94,0.12)", color: "#16a34a", letterSpacing: "0.05em" }}>
              CURRENT
            </span>
          )}
          {session.isRevoked && (
            <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(239,68,68,0.08)", color: "#dc2626" }}>
              REVOKED
            </span>
          )}
          {session.isExpired && !session.isRevoked && (
            <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(107,114,128,0.1)", color: "#6b7280" }}>
              EXPIRED
            </span>
          )}
        </div>

        {/* IP, location, userAgent */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, opacity: 0.5, marginBottom: 6 }}>
          {session.ip && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Globe size={9} />{session.ip}
            </span>
          )}
          {session.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <MapPin size={9} />{session.location}
            </span>
          )}
          {session.userAgent && (
            <span style={{ fontFamily: "monospace", fontSize: 10, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.userAgent}
            </span>
          )}
        </div>

        {/* Timestamps */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11, opacity: 0.4 }}>
          {session.createdAt && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={9} />Signed in {fmt(session.createdAt)}
            </span>
          )}
          {session.lastActiveAt && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Activity size={9} />Active {timeAgo(session.lastActiveAt)}
            </span>
          )}
          {session.expiresAt && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Key size={9} />Expires {fmt(session.expiresAt)}
            </span>
          )}
        </div>
      </div>

      {/* Revoke — only for non-current, non-stale */}
      {!session.isCurrent && !isStale && (
        <div style={{ flexShrink: 0 }}>
          {!confirm ? (
            <button onClick={() => setConfirm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: "rgba(239,68,68,0.08)", color: "#dc2626",
                border: "1px solid rgba(239,68,68,0.2)",
              }}>
              <LogOut size={12} />Revoke
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { onRevoke(session._id); setConfirm(false); }} disabled={revoking}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#dc2626", color: "white", border: "none", cursor: revoking ? "not-allowed" : "pointer", opacity: revoking ? 0.6 : 1 }}>
                {revoking ? "…" : "Yes"}
              </button>
              <button onClick={() => setConfirm(false)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "var(--base-200,#f3f4f6)", border: "none", cursor: "pointer" }}>
                No
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SessionManagement() {
  const dispatch = useDispatch();

  // Auth — real API response is in s.user.user
  const user         = useSelector((s) => s.user?.user) ?? null;
  const isSuperadmin = user?.role === "superadmin";

  const sessions         = useSelector(selectUserSessions);
  const allUsers         = useSelector(selectAllUsers);          // shape matches real API data[]
  const sessionsLoading  = useSelector(selectSessionsLoading);
  const revokeLoading    = useSelector(selectRevokeSessionLoading);
  const revokeAllLoading = useSelector(selectRevokeAllSessionsLoading);
  const usersLoading     = useSelector(selectListLoading);

  const [selectedUserId, setSelectedUserId]     = useState("");
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);  // holds the full user object from allUsers
  const [userIdInput, setUserIdInput]           = useState("");
  const [idError, setIdError]                   = useState("");
  const [userSearch, setUserSearch]             = useState("");
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  // Initial user list load
  useEffect(() => {
    dispatch(fetchAllUsers({ limit: 20, sortBy: "createdAt", sortOrder: "desc" }));
  }, [dispatch]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(fetchAllUsers({ search: userSearch, limit: 20 }));
    }, 350);
    return () => clearTimeout(t);
  }, [userSearch, dispatch]);

  const loadSessions = useCallback((uid) => {
    dispatch(fetchUserSessions(uid));
  }, [dispatch]);

  const handleManualFetch = (e) => {
    e.preventDefault();
    const trimmed = userIdInput.trim();
    if (!trimmed) { setIdError("Enter a User ID."); return; }
    if (!isValidObjectId(trimmed)) { setIdError("Must be a valid 24-character MongoDB ObjectId."); return; }
    setIdError("");
    setSelectedUserId(trimmed);
    setSelectedUserInfo(null);
    loadSessions(trimmed);
  };

  const selectFromPicker = (u) => {
    setSelectedUserId(u._id);
    setSelectedUserInfo(u);         // stores full user obj: name, email, avatar, role, isOnline, etc.
    setUserIdInput(u._id);
    setIdError("");
    loadSessions(u._id);
  };

  const handleRevoke = (sessionId) => {
    dispatch(revokeUserSession({ userId: selectedUserId, sessionId }));
  };

  const handleRevokeAll = async () => {
    await dispatch(revokeAllUserSessions(selectedUserId));
    setConfirmRevokeAll(false);
  };

  const activeSessions  = (sessions || []).filter(s => !s.isRevoked && !s.isExpired);
  const expiredSessions = (sessions || []).filter(s => s.isRevoked  || s.isExpired);

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "var(--base-100,#f9fafb)" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Link href="/admin" style={{ fontSize: 12, opacity: 0.45, textDecoration: "none" }}>Admin</Link>
          <ChevronRight size={12} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary,#6366f1)" }}>Session Management</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>Session Management</h1>
        <p style={{ fontSize: 13, opacity: 0.45, marginTop: 4 }}>View and revoke active login sessions for any user</p>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Manual ID lookup */}
          <div style={{ padding: "18px 20px", borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
              Lookup by User ID
            </p>
            <form onSubmit={handleManualFetch} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                border: `1px solid ${idError ? "#ef4444" : "var(--base-300,#e5e7eb)"}`, borderRadius: 9,
              }}>
                <Key size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                <input value={userIdInput}
                  onChange={e => { setUserIdInput(e.target.value); if (idError) setIdError(""); }}
                  placeholder="664abc123def456789012345" maxLength={24}
                  style={{ border: "none", outline: "none", fontSize: 12, fontFamily: "monospace", background: "transparent", flex: 1 }} />
              </div>
              {idError && <p style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, margin: 0 }}>{idError}</p>}
              <button type="submit" disabled={sessionsLoading}
                style={{ padding: "8px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "var(--primary,#6366f1)", color: "white", border: "none", cursor: sessionsLoading ? "not-allowed" : "pointer", opacity: sessionsLoading ? 0.6 : 1 }}>
                {sessionsLoading ? "Loading…" : "Fetch Sessions"}
              </button>
            </form>
          </div>

          {/* User picker — uses real API fields */}
          <div style={{ padding: "18px 20px", borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Or pick a user
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", border: "1px solid var(--base-300,#e5e7eb)", borderRadius: 9, marginBottom: 10 }}>
              <Search size={13} style={{ opacity: 0.4 }} />
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Search name or email…"
                style={{ border: "none", outline: "none", fontSize: 12, background: "transparent", flex: 1 }} />
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {usersLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", opacity: 0.4, fontSize: 12 }}>
                  <RefreshCw size={16} style={{ display: "block", margin: "0 auto 6px" }} className="animate-spin" />Loading…
                </div>
              ) : allUsers.length === 0 ? (
                <p style={{ fontSize: 12, opacity: 0.35, textAlign: "center", padding: "20px 0" }}>No users found</p>
              ) : allUsers.map(u => (
                <UserPickerRow key={u._id} u={u} selected={selectedUserId === u._id} onClick={() => selectFromPicker(u)} />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div>
          {!selectedUserId ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ padding: "60px 40px", borderRadius: 16, textAlign: "center", border: "1px dashed var(--base-300,#e5e7eb)", opacity: 0.4 }}>
              <Shield size={36} style={{ margin: "0 auto 14px" }} />
              <p style={{ fontSize: 14, fontWeight: 700 }}>Select a user to view their sessions</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Pick from the list or enter a User ID</p>
            </motion.div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Selected user header — uses real API fields from selectedUserInfo */}
              {selectedUserInfo && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
                  {/* avatar — real field */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {selectedUserInfo.avatar ? (
                      <img src={selectedUserInfo.avatar} alt="" style={{ width: 46, height: 46, borderRadius: 11, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 46, height: 46, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.1)", fontSize: 18, fontWeight: 900, color: "var(--primary,#6366f1)" }}>
                        {(selectedUserInfo.name || selectedUserInfo.email || "?")[0].toUpperCase()}
                      </div>
                    )}
                    {/* isOnline — real field */}
                    <span style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: selectedUserInfo.isOnline ? "#22c55e" : "#d1d5db", border: "2px solid var(--base-100,#fff)" }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      {/* name — real field */}
                      <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{selectedUserInfo.name || "—"}</p>
                      <RoleBadge role={selectedUserInfo.role} />
                      {selectedUserInfo.isBlocked && (
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(239,68,68,0.1)", color: "#dc2626" }}>Blocked</span>
                      )}
                    </div>
                    {/* email · phone · lastLoginAt — all real fields */}
                    <p style={{ fontSize: 11, opacity: 0.45, margin: 0 }}>
                      {selectedUserInfo.email} · {selectedUserInfo.phone} · Last login {fmt(selectedUserInfo.lastLoginAt)}
                    </p>
                    {/* lastLoginIp — real field */}
                    {selectedUserInfo.lastLoginIp && (
                      <p style={{ fontSize: 10, opacity: 0.3, margin: "2px 0 0", fontFamily: "monospace" }}>
                        IP {selectedUserInfo.lastLoginIp} · Logins: {selectedUserInfo.loginCount}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => loadSessions(selectedUserId)} disabled={sessionsLoading}
                      style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent" }}>
                      <RefreshCw size={14} style={{ opacity: 0.5 }} className={sessionsLoading ? "animate-spin" : ""} />
                    </button>

                    {activeSessions.length > 0 && (
                      !confirmRevokeAll ? (
                        <button onClick={() => setConfirmRevokeAll(true)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <LogOut size={13} />Revoke All
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626" }}>Sure?</span>
                          <button onClick={handleRevokeAll} disabled={revokeAllLoading}
                            style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "#dc2626", color: "white", border: "none", cursor: "pointer", opacity: revokeAllLoading ? 0.6 : 1 }}>
                            {revokeAllLoading ? "…" : "Yes"}
                          </button>
                          <button onClick={() => setConfirmRevokeAll(false)}
                            style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "var(--base-200,#f3f4f6)", border: "none", cursor: "pointer" }}>
                            No
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </motion.div>
              )}

              {/* Stats */}
              {sessions && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Total",          value: sessions.length,        color: "var(--primary,#6366f1)", icon: Users       },
                    { label: "Active",         value: activeSessions.length,  color: "#16a34a",               icon: CheckCircle },
                    { label: "Expired/Revoked",value: expiredSessions.length, color: "#6b7280",               icon: XCircle     },
                  ].map(s => {
                    const SIcon = s.icon;
                    return (
                      <div key={s.label} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)", display: "flex", alignItems: "center", gap: 10 }}>
                        <SIcon size={18} style={{ color: s.color, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 20, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
                          <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{s.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading */}
              {sessionsLoading && (
                <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.4 }}>
                  <RefreshCw size={24} className="animate-spin" style={{ display: "block", margin: "0 auto 10px" }} />
                  <p style={{ fontSize: 13 }}>Loading sessions…</p>
                </div>
              )}

              {!sessionsLoading && sessions !== null && (
                <>
                  {/* Active */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Active Sessions ({activeSessions.length})
                    </p>
                    {activeSessions.length === 0 ? (
                      <div style={{ padding: "24px", borderRadius: 12, border: "1px dashed var(--base-300,#e5e7eb)", textAlign: "center", opacity: 0.35 }}>
                        <p style={{ fontSize: 13 }}>No active sessions</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <AnimatePresence>
                          {activeSessions.map((s, i) => (
                            <SessionCard key={s._id} session={s} index={i} onRevoke={handleRevoke} revoking={revokeLoading} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* Expired / revoked */}
                  {expiredSessions.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                        Expired / Revoked ({expiredSessions.length})
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {expiredSessions.map((s, i) => (
                          <SessionCard key={s._id} session={s} index={i} onRevoke={() => {}} revoking={false} />
                        ))}
                      </div>
                    </div>
                  )}

                  {sessions.length === 0 && (
                    <div style={{ padding: "40px", borderRadius: 14, border: "1px dashed var(--base-300,#e5e7eb)", textAlign: "center", opacity: 0.35 }}>
                      <Lock size={28} style={{ margin: "0 auto 10px" }} />
                      <p style={{ fontSize: 13, fontWeight: 600 }}>No sessions found for this user</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}