"use client";

import { AlertCircle, Info, CheckCircle2, Loader2, Star, IndianRupee } from "lucide-react";
import { PP } from "@/lib/constants";

export function Field({ label, required, note, error, children }) {
  return (
    <div className="space-y-1.5" style={PP}>
      {label && (
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <label
            className="text-[10px] font-black uppercase tracking-widest text-base-content/50 leading-tight"
            style={PP}
          >
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </label>
          {note && (
            <span
              className="flex items-center gap-1 text-[9px] text-base-content/35 text-right leading-tight"
              style={PP}
            >
              <Info size={8} className="flex-shrink-0" />
              {note}
            </span>
          )}
        </div>
      )}
      {children}
      {error && (
        <p
          className="flex items-center gap-1 text-[11px] text-error font-semibold"
          style={PP}
        >
          <AlertCircle size={10} />
          {error}
        </p>
      )}
    </div>
  );
}

export function Inp({ className = "", ...p }) {
  return (
    <input
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-base-content/25 ${className}`}
    />
  );
}

export function Sel({ children, className = "", ...p }) {
  return (
    <select
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all cursor-pointer ${className}`}
    >
      {children}
    </select>
  );
}

export function Txta({ className = "", ...p }) {
  return (
    <textarea
      {...p}
      style={PP}
      className={`w-full bg-base-200/60 border border-base-300 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-base-content/25 resize-none ${className}`}
    />
  );
}

export function SCard({ title, icon: Icon, accent, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-base-300 bg-base-100/50 ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-base-300 bg-base-200">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-base-300"
          style={{ color: accent || "var(--primary)" }}
        >
          <Icon size={12} />
        </div>
        <h4 className="font-black text-xs tracking-tight truncate" style={PP}>
          {title}
        </h4>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

export function AvailPill({ avail, loading }) {
  if (loading)
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-base-200 border border-base-300 text-base-content/50"
        style={PP}
      >
        <Loader2 size={8} className="animate-spin" />
        Checking…
      </span>
    );
  if (!avail) return null;
  const ok = avail.available;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${ok ? "bg-success/10 text-success border-success/30" : "bg-error/10 text-error border-error/30"}`}
      style={PP}
    >
      {ok ? <CheckCircle2 size={8} /> : <AlertCircle size={8} />}
      {ok ? "Available" : avail.reason || "Unavailable"}
    </span>
  );
}

export function SubTag({ isFree, reason, className = "" }) {
  if (!isFree) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black border bg-success/10 text-success border-success/30 ${className}`}
      style={PP}
      title={reason || "Covered by subscription"}
    >
      <Star size={7} />
      FREE · Sub
    </span>
  );
}

// Pricing info pill — shows GST rate / tax note inline
export function GstPill({ rate, label }) {
  const pct = rate != null ? `${Math.round(rate * 100)}%` : null;
  const display = label || (pct ? `GST ${pct}` : null);
  if (!display) return null;
  const isExempt = rate === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-black border ${isExempt ? "bg-success/8 text-success/70 border-success/20" : "bg-warning/8 text-warning/70 border-warning/20"}`}
      style={PP}
    >
      <IndianRupee size={6} />
      {display}
    </span>
  );
}

export function FareRow({
  label,
  value,
  note,
  accent,
  bold,
  highlight,
  sub,
  isFree,
  freeReason,
  gstRate,
  gstLabel,
}) {
  return (
    <div
      className={`flex items-start justify-between gap-2 py-2 px-2.5 rounded-lg ${highlight ? "bg-primary/5 border border-primary/20" : sub ? "bg-base-200/40" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p
            className={`text-xs ${bold ? "font-black" : sub ? "font-medium" : "font-semibold"} leading-snug`}
            style={{
              color: accent || "var(--base-content)",
              opacity: sub ? 0.6 : 1,
              ...PP,
            }}
          >
            {label}
          </p>
          {isFree && <SubTag isFree={isFree} reason={freeReason} />}
          {gstRate != null && !isFree && (
            <GstPill rate={gstRate} label={gstLabel} />
          )}
        </div>
        {note && (
          <p
            className="text-[9px] text-base-content/40 mt-0.5 leading-snug"
            style={PP}
          >
            {note}
          </p>
        )}
      </div>
      <p
        className={`text-xs whitespace-nowrap flex-shrink-0 ${bold ? "font-black" : sub ? "font-medium opacity-60" : "font-bold"}`}
        style={{
          color: isFree ? "var(--success)" : accent || "var(--base-content)",
          ...PP,
        }}
      >
        {isFree ? "FREE" : value}
      </p>
    </div>
  );
}
