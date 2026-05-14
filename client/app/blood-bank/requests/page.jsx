"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchMyRequests,
  respondToRequest,
  issueBloodUnits,
  fetchMyBank,
  fetchMyStats,
} from "@/store/slices/bloodbankSlice";
import {
  Droplets, CheckCircle2, XCircle, Truck, Clock, AlertCircle,
  Search, Filter, RefreshCcw, ChevronLeft, ChevronRight,
  User, Phone, Mail, FileText, Zap, Package, Hash,
  BarChart3, TrendingUp, Activity, Eye, X, Loader2,
  CheckCheck, Ban, SendHorizonal, FlaskConical, Calendar,
  ChevronDown, ChevronUp, Inbox, ArrowUpRight, Info,
  BadgeCheck, ClipboardList, Stethoscope,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ── Constants ────────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  routine:      { label: "Routine",       color: "text-blue-600",  bg: "bg-blue-50 border-blue-200",    dot: "bg-blue-500"   },
  urgent:       { label: "Urgent",        color: "text-amber-600", bg: "bg-amber-50 border-amber-200",  dot: "bg-amber-500"  },
  emergency:    { label: "Emergency",     color: "text-red-600",   bg: "bg-red-50 border-red-200",      dot: "bg-red-500"    },
  mass_casualty:{ label: "Mass Casualty", color: "text-red-700",   bg: "bg-red-100 border-red-300",     dot: "bg-red-700"    },
};

const STATUS_CONFIG = {
  raised:              { label: "Raised",           color: "text-slate-600",  bg: "bg-slate-50 border-slate-200"   },
  searching:           { label: "Searching",        color: "text-blue-600",   bg: "bg-blue-50 border-blue-200"     },
  partially_matched:   { label: "Part. Matched",    color: "text-amber-600",  bg: "bg-amber-50 border-amber-200"   },
  fully_matched:       { label: "Fully Matched",    color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-200"},
  cross_matching:      { label: "Cross-Matching",   color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  cross_match_done:    { label: "Cross-Match Done", color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  approved:            { label: "Approved",         color: "text-green-600",  bg: "bg-green-50 border-green-200"   },
  dispatched:          { label: "Dispatched",       color: "text-teal-600",   bg: "bg-teal-50 border-teal-200"     },
  partially_delivered: { label: "Part. Delivered",  color: "text-cyan-600",   bg: "bg-cyan-50 border-cyan-200"     },
  delivered:           { label: "Delivered",        color: "text-green-700",  bg: "bg-green-100 border-green-300"  },
  transfused:          { label: "Transfused",       color: "text-green-800",  bg: "bg-green-100 border-green-400"  },
  cancelled:           { label: "Cancelled",        color: "text-red-500",    bg: "bg-red-50 border-red-200"       },
  expired:             { label: "Expired",          color: "text-gray-500",   bg: "bg-gray-50 border-gray-200"     },
  rejected:            { label: "Rejected",         color: "text-red-600",    bg: "bg-red-50 border-red-200"       },
};

const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];

const STATUS_FILTERS = [
  "all", "searching", "cross_matching", "approved",
  "dispatched", "delivered", "rejected", "cancelled",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (date) => {
  if (!date) return "—";
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const urgencyCfg   = (u) => URGENCY_CONFIG[u]   || URGENCY_CONFIG.routine;
const statusCfg    = (s) => STATUS_CONFIG[s]     || STATUS_CONFIG.searching;

// ── Subcomponents ─────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }) {
  const cfg = urgencyCfg(urgency);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = statusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function BloodGroupBadge({ group }) {
  const isNeg = group?.includes("-");
  return (
    <span
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-black text-xs shrink-0 ${
        isNeg
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : "border-red-300 bg-red-50 text-red-700"
      }`}
      style={{ fontFamily: "var(--font-family-montserrat)" }}
    >
      {group}
    </span>
  );
}

// ── Issue Modal ───────────────────────────────────────────────────────────────

function IssueModal({ request, onClose, onIssued }) {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.bloodBank);
  const [bagInput, setBagInput] = useState("");
  const [bagNumbers, setBagNumbers] = useState([]);
  const [error, setError] = useState("");

  const addBag = () => {
    const v = bagInput.trim().toUpperCase();
    if (!v) return;
    if (bagNumbers.includes(v)) { setError("Bag already added"); return; }
    setBagNumbers((p) => [...p, v]);
    setBagInput("");
    setError("");
  };

  const removeBag = (b) => setBagNumbers((p) => p.filter((x) => x !== b));

  const handleIssue = async () => {
    if (!bagNumbers.length) { setError("Add at least one bag number"); return; }
    setError("");
    const res = await dispatch(issueBloodUnits({
      reqId: request._id,
      issueData: {
        bagNumbers,
        issuedBy:     "Blood Bank Staff",
        bloodGroup:   request.bloodGroup,
        component:    request.component,
        customerEmail: request.requestedBy?.email,
        customerName:  request.requestedBy?.name || request.patient?.name,
        hospitalId:    request.hospital?._id || request.hospital || null,
      },
    }));
    if (res.meta.requestStatus === "fulfilled") {
      onIssued();
      onClose();
    } else {
      setError(res.payload || "Issue failed");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.94, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 16 }}
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#064e3b,#059669)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Truck size={15} className="text-white" />
              </div>
              <div>
                <p className="font-extrabold text-white text-sm" style={{ fontFamily: "var(--font-family-montserrat)" }}>
                  Issue Blood Units
                </p>
                <p className="text-white/65 text-xs">{request.requestCode}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Summary */}
            <div className="rounded-xl bg-base-200 border border-base-300 p-4 flex items-center gap-3">
              <BloodGroupBadge group={request.bloodGroup} />
              <div>
                <p className="font-bold text-sm text-base-content">{request.bloodGroup} — {request.component}</p>
                <p className="text-xs text-base-content/50">{request.unitsRequired} unit(s) · {request.patient?.name}</p>
              </div>
            </div>

            {/* Bag number entry */}
            <div>
              <label className="label-text text-xs mb-1.5 block">Bag Numbers</label>
              <div className="flex gap-2">
                <input
                  value={bagInput}
                  onChange={(e) => setBagInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && addBag()}
                  placeholder="e.g. BAG-001"
                  className="input-field text-sm flex-1"
                />
                <button
                  onClick={addBag}
                  className="px-3 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}
                >
                  Add
                </button>
              </div>
              {bagNumbers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {bagNumbers.map((b) => (
                    <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {b}
                      <button onClick={() => removeBag(b)} className="hover:text-red-500 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-semibold text-base-content/70 hover:bg-base-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleIssue}
                disabled={loading || !bagNumbers.length}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                Issue Units
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RespondModal({ request, action, onClose, onDone }) {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.bloodBank);
  const [reason, setReason] = useState("");
  const [error, setError]   = useState("");

  const isAccept = action === "accept";

  const handleConfirm = async () => {
    if (!isAccept && !reason.trim()) { setError("Rejection reason is required"); return; }
    setError("");
    const res = await dispatch(respondToRequest({ reqId: request._id, action, reason }));
    if (res.meta.requestStatus === "fulfilled") {
      onDone();
      onClose();
    } else {
      setError(res.payload || "Action failed");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
          className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: isAccept ? "linear-gradient(135deg,#064e3b,#059669)" : "linear-gradient(135deg,#7f1d1d,#dc2626)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                {isAccept ? <CheckCheck size={15} className="text-white" /> : <Ban size={15} className="text-white" />}
              </div>
              <div>
                <p className="font-extrabold text-white text-sm" style={{ fontFamily: "var(--font-family-montserrat)" }}>
                  {isAccept ? "Accept Request" : "Reject Request"}
                </p>
                <p className="text-white/65 text-xs">{request.requestCode}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="rounded-xl bg-base-200 border border-base-300 p-3 flex items-center gap-3">
              <BloodGroupBadge group={request.bloodGroup} />
              <div>
                <p className="font-bold text-sm text-base-content">{request.bloodGroup} {request.component}</p>
                <p className="text-xs text-base-content/50">{request.unitsRequired} unit(s) — {request.patient?.name}</p>
              </div>
            </div>

            {!isAccept && (
              <div>
                <label className="label-text text-xs mb-1 block">Rejection Reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Insufficient stock, cross-match failure…"
                  rows={3}
                  className="input-field text-sm resize-none"
                />
              </div>
            )}

            {isAccept && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex gap-2">
                <Info size={13} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700">Request will move to cross-matching stage. Prepare units accordingly.</p>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {error}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-semibold text-base-content/70 hover:bg-base-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: isAccept ? "linear-gradient(135deg,#059669,#34d399)" : "linear-gradient(135deg,#dc2626,#f87171)" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : isAccept ? <CheckCheck size={14} /> : <Ban size={14} />}
                {isAccept ? "Accept" : "Reject"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Request Detail Drawer ─────────────────────────────────────────────────────

function RequestDrawer({ request, onClose, onActionDone }) {
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'accept'|'reject'|'issue' }

  if (!request) return null;

  const canAcceptReject = ["searching","partially_matched","fully_matched","raised"].includes(request.status);
  const canIssue        = ["cross_matching","cross_match_done","approved","fully_matched"].includes(request.status);

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/40"
          style={{ backdropFilter: "blur(4px)" }}
          onClick={onClose}
        />
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl overflow-y-auto"
        >
          {/* Drawer header */}
          <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b border-base-300 bg-white/95 backdrop-blur-sm">
            <div>
              <p className="font-extrabold text-base text-base-content" style={{ fontFamily: "var(--font-family-montserrat)" }}>
                {request.requestCode}
              </p>
              <p className="text-xs text-base-content/50 mt-0.5">Blood Request Details</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors">
              <X size={16} className="text-base-content/70" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Top status row */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={request.status} />
              <UrgencyBadge urgency={request.urgency} />
              {request.prescriptionWaived && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Zap size={10} /> Rx Waived
                </span>
              )}
              {request.prescriptionUrl && !request.prescriptionWaived && (
                <a href={request.prescriptionUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                  <FileText size={10} /> Prescription
                </a>
              )}
            </div>

            {/* Blood info card */}
            <div
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)" }}
            >
              <BloodGroupBadge group={request.bloodGroup} />
              <div className="flex-1">
                <p className="font-black text-lg text-red-700" style={{ fontFamily: "var(--font-family-montserrat)" }}>
                  {request.bloodGroup} — {request.component}
                </p>
                <p className="text-sm text-red-600/70 font-medium">
                  {request.unitsRequired} unit(s) required · {request.fulfilledUnits ?? 0} fulfilled
                </p>
              </div>
            </div>

            {/* Patient */}
            <Section title="Patient Information" icon={User}>
              <div className="space-y-2 text-sm">
                {[
                  ["Name",   request.patient?.name],
                  ["Age",    request.patient?.age ? `${request.patient.age} yrs` : null],
                  ["Gender", request.patient?.gender],
                  ["Ward/Bed",request.patient?.wardBed],
                  ["UHID",   request.patient?.uhid],
                ].filter(([,v]) => v).map(([k,v]) => (
                  <div key={k} className="flex items-center justify-between py-1 border-b border-base-200 last:border-0">
                    <span className="text-base-content/50 text-xs">{k}</span>
                    <span className="font-semibold text-base-content">{v}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Requester */}
            {request.requestedBy && (
              <Section title="Requested By" icon={Stethoscope}>
                <div className="space-y-2 text-sm">
                  {[
                    [<User size={11}/>,    request.requestedBy.name],
                    [<Mail size={11}/>,    request.requestedBy.email],
                    [<Phone size={11}/>,   request.requestedBy.phone],
                  ].filter(([,v]) => v).map(([icon,val], i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-base-content/70">
                      <span className="text-base-content/40">{icon}</span> {val}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Clinical */}
            <Section title="Clinical Details" icon={ClipboardList}>
              <div className="space-y-2 text-sm">
                {[
                  ["Indication",  request.clinicalIndication],
                  ["Notes",       request.clinicalNotes],
                  ["Requested",   fmtDate(request.raisedAt || request.createdAt)],
                  ["Required By", fmtDate(request.requiredBy)],
                  ["Payment",     request.paymentStatus],
                  ["Request Type",request.requestType?.replace(/_/g," ")],
                ].filter(([,v]) => v).map(([k,v]) => (
                  <div key={k} className="flex items-start justify-between py-1 border-b border-base-200 last:border-0 gap-3">
                    <span className="text-base-content/50 text-xs shrink-0">{k}</span>
                    <span className="font-semibold text-base-content text-right text-xs capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Allocations */}
            {request.allocations?.length > 0 && (
              <Section title={`Allocations (${request.allocations.length})`} icon={Package}>
                <div className="space-y-2">
                  {request.allocations.map((alloc, i) => (
                    <div key={i} className="p-3 rounded-xl border border-base-300 bg-base-200/50 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-base-content text-sm">{alloc.bloodBankName || "Blood Bank"}</span>
                        <StatusBadge status={alloc.status} />
                      </div>
                      <p className="text-base-content/60">{alloc.unitsAllocated} unit(s)</p>
                      {alloc.bagNumbers?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {alloc.bagNumbers.map((b) => (
                            <span key={b} className="px-1.5 py-0.5 rounded bg-base-300 font-mono text-[10px]">{b}</span>
                          ))}
                        </div>
                      )}
                      {alloc.crossMatchResult && (
                        <p className="mt-1">Cross-match: <span className={`font-bold ${alloc.crossMatchResult === "Compatible" ? "text-green-600" : "text-red-600"}`}>{alloc.crossMatchResult}</span></p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {canAcceptReject && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmAction({ type: "accept" })}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}
                  >
                    <CheckCheck size={15} /> Accept Request
                  </button>
                  <button
                    onClick={() => setConfirmAction({ type: "reject" })}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    style={{ background: "linear-gradient(135deg,#dc2626,#f87171)" }}
                  >
                    <Ban size={15} /> Reject
                  </button>
                </div>
              )}

              {canIssue && (
                <button
                  onClick={() => setConfirmAction({ type: "issue" })}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  style={{ background: "linear-gradient(135deg,#0369a1,#38bdf8)" }}
                >
                  <Truck size={15} /> Issue Units
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nested modals */}
      {confirmAction?.type === "issue" && (
        <IssueModal
          request={request}
          onClose={() => setConfirmAction(null)}
          onIssued={onActionDone}
        />
      )}
      {(confirmAction?.type === "accept" || confirmAction?.type === "reject") && (
        <RespondModal
          request={request}
          action={confirmAction.type}
          onClose={() => setConfirmAction(null)}
          onDone={onActionDone}
        />
      )}
    </>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-base-300 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-base-200/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
              <Icon size={12} className="text-red-600" />
            </div>
          )}
          <span className="text-xs font-bold text-base-content uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp size={13} className="text-base-content/40" /> : <ChevronDown size={13} className="text-base-content/40" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-base-300">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stats cards row ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white border border-base-300 rounded-2xl p-5"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={17} className="text-white" />
        </div>
      </div>
      <p
        className="text-2xl font-black text-base-content mb-0.5"
        style={{ fontFamily: "var(--font-family-montserrat)" }}
      >
        {value ?? "—"}
      </p>
      <p className="text-xs font-semibold text-base-content/50">{label}</p>
      {sub && <p className="text-[10px] text-base-content/35 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ── Mini chart components ─────────────────────────────────────────────────────

const CHART_COLORS = ["#dc2626","#059669","#0369a1","#d97706","#7c3aed","#0891b2"];

function StatusPieChart({ requests }) {
  const data = useMemo(() => {
    const counts = {};
    (requests || []).forEach((r) => {
      const label = STATUS_CONFIG[r.status]?.label || r.status;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [requests]);

  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, n) => [v, n]}
          contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function UrgencyBarChart({ requests }) {
  const data = useMemo(() => {
    const map = { routine: 0, urgent: 0, emergency: 0, mass_casualty: 0 };
    (requests || []).forEach((r) => { if (map[r.urgency] !== undefined) map[r.urgency]++; });
    return [
      { name: "Routine",    count: map.routine },
      { name: "Urgent",     count: map.urgent },
      { name: "Emergency",  count: map.emergency },
      { name: "Mass Cas.",  count: map.mass_casualty },
    ].filter((d) => d.count > 0);
  }, [requests]);

  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
        <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} />
        <Tooltip
          contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 11 }}
        />
        <Bar dataKey="count" radius={[4,4,0,0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TimelineAreaChart({ requests }) {
  const data = useMemo(() => {
    const map = {};
    (requests || []).forEach((r) => {
      const d = new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).slice(-14).map(([date, count]) => ({ date, count }));
  }, [requests]);

  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} />
        <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 11 }} />
        <Area type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} fill="url(#areaGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="h-44 flex items-center justify-center text-base-content/25">
      <BarChart3 size={24} />
    </div>
  );
}

// ── Request Row ───────────────────────────────────────────────────────────────

function RequestRow({ request, onView, onAccept, onReject, onIssue }) {
  const canAcceptReject = ["searching","partially_matched","fully_matched","raised"].includes(request.status);
  const canIssue        = ["cross_matching","cross_match_done","approved","fully_matched"].includes(request.status);

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="border-b border-base-200 hover:bg-red-50/30 transition-colors group cursor-pointer"
      onClick={() => onView(request)}
    >
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <BloodGroupBadge group={request.bloodGroup} />
          <div>
            <p className="font-bold text-sm text-base-content leading-tight">{request.component}</p>
            <p className="text-xs text-base-content/50 font-mono">{request.requestCode}</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div>
          <p className="text-sm font-semibold text-base-content leading-tight">{request.patient?.name || "—"}</p>
          {request.requestedBy?.name && (
            <p className="text-xs text-base-content/40">by {request.requestedBy.name}</p>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span
          className="text-lg font-black text-red-600"
          style={{ fontFamily: "var(--font-family-montserrat)" }}
        >
          {request.unitsRequired}
        </span>
        <span className="text-xs text-base-content/40 ml-1">u</span>
      </td>
      <td className="py-3.5 px-4">
        <UrgencyBadge urgency={request.urgency} />
      </td>
      <td className="py-3.5 px-4">
        <StatusBadge status={request.status} />
      </td>
      <td className="py-3.5 px-4">
        <div className="text-xs text-base-content/50">
          <p>{fmtDate(request.createdAt)}</p>
          <p className="text-[10px] text-base-content/30">{timeAgo(request.createdAt)}</p>
        </div>
      </td>
      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onView(request)}
            className="p-1.5 rounded-lg hover:bg-base-200 text-base-content/50 hover:text-base-content transition-colors"
            title="View details"
          >
            <Eye size={13} />
          </button>
          {canAcceptReject && (
            <>
              <button
                onClick={() => onAccept(request)}
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-colors"
                title="Accept"
              >
                <CheckCheck size={13} />
              </button>
              <button
                onClick={() => onReject(request)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                title="Reject"
              >
                <Ban size={13} />
              </button>
            </>
          )}
          {canIssue && (
            <button
              onClick={() => onIssue(request)}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
              title="Issue units"
            >
              <Truck size={13} />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RequestsManagement() {
  const dispatch = useDispatch();
  const {
    myRequests,
    myRequestsTotal,
    myRequestsPage,
    myRequestsPages,
    myStats,
    myBank,
    loading,
  } = useSelector((s) => s.bloodBank);

  // Filters
  const [statusFilter, setStatusFilter]   = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [page,          setPage]          = useState(1);
  const limit = 15;

  // UI state
  const [selectedRequest,  setSelectedRequest]  = useState(null);
  const [inlineAction,     setInlineAction]      = useState(null); // { type, request }
  const [showCharts,       setShowCharts]        = useState(true);
  const [refreshKey,       setRefreshKey]        = useState(0);

  // Load data
  const loadRequests = useCallback(() => {
    const params = { page, limit };
    if (statusFilter !== "all") params.status = statusFilter;
    dispatch(fetchMyRequests(params));
  }, [dispatch, page, limit, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, refreshKey]);

  useEffect(() => {
    dispatch(fetchMyBank());
    dispatch(fetchMyStats());
  }, [dispatch]);

  // Derived filtered list (client-side search + urgency)
  const filteredRequests = useMemo(() => {
    let list = myRequests || [];
    if (urgencyFilter !== "all") {
      list = list.filter((r) => r.urgency === urgencyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        r.requestCode?.toLowerCase().includes(q) ||
        r.bloodGroup?.toLowerCase().includes(q) ||
        r.component?.toLowerCase().includes(q) ||
        r.patient?.name?.toLowerCase().includes(q) ||
        r.requestedBy?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [myRequests, urgencyFilter, searchQuery]);

  // Computed summary stats from current page
  const pageSummary = useMemo(() => {
    const reqs = myRequests || [];
    return {
      pending:    reqs.filter((r) => ["searching","raised","partially_matched","fully_matched"].includes(r.status)).length,
      crossMatch: reqs.filter((r) => r.status === "cross_matching").length,
      dispatched: reqs.filter((r) => r.status === "dispatched").length,
      emergency:  reqs.filter((r) => r.urgency === "emergency" || r.urgency === "mass_casualty").length,
    };
  }, [myRequests]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    dispatch(fetchMyStats());
  };

  const handleActionDone = () => {
    setSelectedRequest(null);
    setInlineAction(null);
    handleRefresh();
  };

  // Pagination
  const totalPages = myRequestsPages || Math.ceil((myRequestsTotal || 0) / limit);
  const goToPage = (p) => { setPage(p); };

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 55%,#b91c1c 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-56 h-56 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
        <div className="container-custom max-w-7xl py-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <ClipboardList size={14} className="text-white" />
                </div>
                <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">Blood Bank Manager</span>
              </div>
              <h1
                className="text-2xl md:text-3xl font-black text-white"
                style={{ fontFamily: "var(--font-family-montserrat)" }}
              >
                Requests Management
              </h1>
              {myBank && (
                <p className="text-white/60 text-sm mt-0.5">{myBank.name} · {myBank.bankCode}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCharts((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  showCharts ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                }`}
              >
                <BarChart3 size={13} /> Analytics
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="container-custom max-w-7xl py-6 space-y-6">

        {/* ── Summary Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Fulfilled"
            value={myStats?.stats?.totalRequestsFulfilled ?? 0}
            icon={CheckCircle2}
            color="bg-emerald-500"
            sub="All time"
          />
          <StatCard
            label="Pending Actions"
            value={pageSummary.pending}
            icon={Clock}
            color="bg-amber-500"
            sub="This page"
          />
          <StatCard
            label="Cross-Matching"
            value={pageSummary.crossMatch}
            icon={FlaskConical}
            color="bg-purple-500"
            sub="In progress"
          />
          <StatCard
            label="Emergency Requests"
            value={pageSummary.emergency}
            icon={Zap}
            color="bg-red-600"
            sub="Critical priority"
          />
        </div>

        {/* ── Charts ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showCharts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "Request Volume (14d)", comp: <TimelineAreaChart requests={myRequests} /> },
                  { title: "By Status",            comp: <StatusPieChart requests={myRequests} /> },
                  { title: "By Urgency",           comp: <UrgencyBarChart requests={myRequests} /> },
                ].map(({ title, comp }) => (
                  <div key={title} className="bg-white border border-base-300 rounded-2xl p-5">
                    <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-3">{title}</p>
                    {comp}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="bg-white border border-base-300 rounded-2xl p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/35" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, blood group, component, patient…"
              className="input-field text-sm pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status + urgency filters */}
          <div className="flex flex-wrap gap-2">
            {/* Status pills */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-base-content/40 font-semibold mr-1">Status:</span>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all capitalize ${
                    statusFilter === s
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-base-200 text-base-content/60 border-base-300 hover:border-red-300 hover:text-red-600"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
                </button>
              ))}
            </div>

            {/* Urgency pills */}
            <div className="flex items-center gap-1 flex-wrap ml-auto">
              <span className="text-xs text-base-content/40 font-semibold mr-1">Urgency:</span>
              {["all","routine","urgent","emergency","mass_casualty"].map((u) => (
                <button
                  key={u}
                  onClick={() => setUrgencyFilter(u)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all capitalize ${
                    urgencyFilter === u
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-base-200 text-base-content/60 border-base-300 hover:border-red-300 hover:text-red-600"
                  }`}
                >
                  {u === "all" ? "All" : URGENCY_CONFIG[u]?.label || u}
                </button>
              ))}
            </div>
          </div>

          {/* Result count */}
          <div className="flex items-center justify-between text-xs text-base-content/40">
            <span>
              {filteredRequests.length} result{filteredRequests.length !== 1 ? "s" : ""}
              {myRequestsTotal ? ` of ${myRequestsTotal} total` : ""}
            </span>
            {(statusFilter !== "all" || urgencyFilter !== "all" || searchQuery) && (
              <button
                onClick={() => { setStatusFilter("all"); setUrgencyFilter("all"); setSearchQuery(""); setPage(1); }}
                className="flex items-center gap-1 text-red-500 hover:text-red-700 font-semibold transition-colors"
              >
                <X size={11} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-base-300 rounded-2xl overflow-hidden">
          {loading && !myRequests?.length ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-red-500" />
              <p className="text-sm text-base-content/50">Loading requests…</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center">
                <Inbox size={24} className="text-base-content/25" />
              </div>
              <p className="text-sm font-semibold text-base-content/50">No requests found</p>
              <p className="text-xs text-base-content/30">
                {searchQuery || statusFilter !== "all" || urgencyFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Blood requests will appear here once customers submit them"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Blood / Code</th>
                    <th>Patient</th>
                    <th>Units</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredRequests.map((req) => (
                      <RequestRow
                        key={req._id}
                        request={req}
                        onView={setSelectedRequest}
                        onAccept={(r) => setInlineAction({ type: "accept", request: r })}
                        onReject={(r) => setInlineAction({ type: "reject", request: r })}
                        onIssue={(r)  => setInlineAction({ type: "issue",  request: r })}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-base-300">
              <p className="text-xs text-base-content/50">
                Page {myRequestsPage || page} of {totalPages} · {myRequestsTotal} total
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="w-8 h-8 rounded-lg border border-base-300 flex items-center justify-center disabled:opacity-40 hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                        page === p
                          ? "bg-red-600 text-white border-red-600"
                          : "border-base-300 text-base-content/60 hover:border-red-300 hover:text-red-600"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="w-8 h-8 rounded-lg border border-base-300 flex items-center justify-center disabled:opacity-40 hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Quick action legend ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 text-xs text-base-content/40">
          {[
            [<Eye size={11}/>,       "View details"],
            [<CheckCheck size={11}/>, "Accept request"],
            [<Ban size={11}/>,        "Reject request"],
            [<Truck size={11}/>,      "Issue units"],
          ].map(([icon, label], i) => (
            <span key={i} className="flex items-center gap-1.5">{icon} {label}</span>
          ))}
          <span className="ml-auto flex items-center gap-1.5">
            <Activity size={11} /> Hover rows to reveal quick actions
          </span>
        </div>
      </div>

      {/* ── Request detail drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedRequest && (
          <RequestDrawer
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onActionDone={handleActionDone}
          />
        )}
      </AnimatePresence>

      {/* ── Inline action modals (from table row actions) ─────────────────── */}
      {inlineAction?.type === "issue" && (
        <IssueModal
          request={inlineAction.request}
          onClose={() => setInlineAction(null)}
          onIssued={handleActionDone}
        />
      )}
      {(inlineAction?.type === "accept" || inlineAction?.type === "reject") && (
        <RespondModal
          request={inlineAction.request}
          action={inlineAction.type}
          onClose={() => setInlineAction(null)}
          onDone={handleActionDone}
        />
      )}
    </div>
  );
}