"use client";

import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2, Bell, MessageSquare, Mail, Smartphone,
  Phone, Clock, Wallet, Save, Loader2, Check,
  ToggleLeft, ToggleRight, AlertCircle, RefreshCw,
  Sun, Sunset, Moon, CalendarClock, ChevronDown,
  Trash2, ShieldCheck, BadgeAlert, Banknote, Info,
  MessageCircle
} from "lucide-react";
import {
  fetchSettings,
  updateSettings,
  requestAccountDeletion,
  selectSettings,
  selectLoading,
  selectError,
} from "@/store/slices/soloDriverSlice";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const SectionCard = ({ title, icon: Icon, description, children, index = 0 }) => (
  <motion.div
    variants={fadeUp} initial="hidden" animate="visible" custom={index}
    className="card p-6 space-y-5"
  >
    <div className="border-b border-base-300 pb-4">
      <div className="flex items-center gap-3">
        <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-base-content/80">{title}</h2>
          {description && <p className="text-[10px] text-base-content/40 mt-0.5">{description}</p>}
        </div>
      </div>
    </div>
    {children}
  </motion.div>
);

// ── Toggle Switch ─────────────────────────────────────────────────────────────
const Toggle = ({ value, onChange, label, description, icon: Icon }) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-base-200/60 border border-base-300 hover:border-primary/30 transition-all group">
    <div className="flex items-center gap-3">
      {Icon && <span className="text-primary"><Icon size={16} /></span>}
      <div>
        <p className="text-sm font-bold text-base-content">{label}</p>
        {description && <p className="text-[10px] text-base-content/40">{description}</p>}
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${value ? "bg-primary" : "bg-base-300"}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md ${value ? "left-[26px]" : "left-0.5"}`}
      />
    </button>
  </div>
);

// ── Pill Selector ─────────────────────────────────────────────────────────────
const PillSelect = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${
          value === opt.value
            ? "bg-primary text-primary-content border-primary shadow-md"
            : "border-base-300 text-base-content/50 hover:border-primary/50 hover:text-base-content"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
  const dispatch  = useDispatch();
  const settings  = useSelector(selectSettings);
  const isLoading = useSelector(selectLoading("settings"));
  const isSaving  = useSelector(selectLoading("updateSettings"));
  const isDeleting = useSelector(selectLoading("deletionRequest"));

  // ── Notif prefs ───────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState({ sms: true, email: true, push: true, whatsapp: true });
  // ── Settlement cycle ──────────────────────────────────────────────────────
  const [cycle, setCycle] = useState("Weekly");
  // ── Availability hours ────────────────────────────────────────────────────
  const [hours, setHours] = useState({ start: "06:00", end: "22:00" });
  // ── Deletion modal ────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ password: "", reason: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (!settings) return;
    if (settings.notifications) setNotifs(settings.notifications);
    if (settings.settlementCycle) setCycle(settings.settlementCycle);
    if (settings.availabilityHours) setHours(settings.availabilityHours);
  }, [settings]);

  const handleSave = async () => {
    await dispatch(updateSettings({
      notifications:    notifs,
      settlementCycle:  cycle,
      availabilityHours: hours,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDelete = () => {
    if (!deleteForm.password) return;
    dispatch(requestAccountDeletion(deleteForm));
    setShowDeleteModal(false);
  };

  const CYCLE_OPTIONS = [
    { value: "Daily",    label: "Daily"    },
    { value: "Weekly",   label: "Weekly"   },
    { value: "Bi-Weekly", label: "Bi-Weekly" },
    { value: "Monthly",  label: "Monthly"  },
  ];

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-10 h-10" />
          <p className="text-xs font-black uppercase tracking-widest text-base-content/40">Loading Settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-8">

      {/* ── Page Header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-base-content">Account Settings</h1>
          <p className="text-sm text-base-content/40 mt-1">Manage your preferences, payout schedule, and account options.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary-cta flex items-center gap-2 px-6 py-2.5 text-xs disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : (
            <Save size={14} />
          )}
          {isSaving ? "Saving…" : saved ? "Saved!" : "Save All Changes"}
        </button>
      </motion.div>

      {/* ── Notification Preferences ── */}
      <SectionCard
        title="Notification Channels"
        icon={Bell}
        description="Choose how you want to receive updates from Likeson."
        index={0}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Toggle
            value={notifs.sms}
            onChange={v => setNotifs(p => ({ ...p, sms: v }))}
            label="SMS Alerts"
            description="Text messages for ride updates"
            icon={Phone}
          />
          <Toggle
            value={notifs.email}
            onChange={v => setNotifs(p => ({ ...p, email: v }))}
            label="Email Notifications"
            description="Account activity, reports & receipts"
            icon={Mail}
          />
          <Toggle
            value={notifs.push}
            onChange={v => setNotifs(p => ({ ...p, push: v }))}
            label="Push Notifications"
            description="In-app alerts on your device"
            icon={Smartphone}
          />
          <Toggle
            value={notifs.whatsapp}
            onChange={v => setNotifs(p => ({ ...p, whatsapp: v }))}
            label="WhatsApp Updates"
            description="Ride confirmations via WhatsApp"
            icon={MessageCircle}
          />
        </div>

        {/* Quick note */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-info/10 border border-info/20 text-xs text-info">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>Safety-critical alerts (account blocked, suspicious login) are always sent regardless of these preferences.</span>
        </div>
      </SectionCard>

      {/* ── Settlement Cycle ── */}
      <SectionCard
        title="Settlement Cycle"
        icon={Banknote}
        description="How frequently your earnings are transferred to your bank."
        index={1}
      >
        <PillSelect options={CYCLE_OPTIONS} value={cycle} onChange={setCycle} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          {[
            { label: "Daily",    desc: "Same-day payouts",         cycle: "Daily"    },
            { label: "Weekly",   desc: "Every Monday",             cycle: "Weekly"   },
            { label: "Bi-Weekly", desc: "Every fortnight",         cycle: "Bi-Weekly" },
            { label: "Monthly",  desc: "1st of each month",        cycle: "Monthly"  },
          ].map(o => (
            <div
              key={o.cycle}
              onClick={() => setCycle(o.cycle)}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                cycle === o.cycle
                  ? "border-primary bg-primary/5"
                  : "border-base-300 hover:border-primary/40"
              }`}
            >
              <p className={`text-xs font-black uppercase ${cycle === o.cycle ? "text-primary" : "text-base-content/60"}`}>{o.label}</p>
              <p className="text-[10px] text-base-content/40 mt-0.5">{o.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Availability Hours ── */}
      <SectionCard
        title="Availability Hours"
        icon={Clock}
        description="Set your default online window. You can still go online/offline manually."
        index={2}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5">
              <Sun size={11} className="text-warning" /> Start Time
            </label>
            <input
              type="time"
              value={hours.start}
              onChange={e => setHours(p => ({ ...p, start: e.target.value }))}
              className="input-field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5">
              <Moon size={11} className="text-secondary" /> End Time
            </label>
            <input
              type="time"
              value={hours.end}
              onChange={e => setHours(p => ({ ...p, end: e.target.value }))}
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Visual timeline */}
        <div className="relative h-10 rounded-xl bg-base-300 overflow-hidden mt-2">
          {(() => {
            const toPercent = (t) => {
              const [h, m] = (t || "00:00").split(":").map(Number);
              return ((h * 60 + m) / 1440) * 100;
            };
            const s = toPercent(hours.start);
            const e = toPercent(hours.end);
            const w = e > s ? e - s : 100 - s + e;
            return (
              <div
                className="absolute top-0 bottom-0 bg-primary/30 border-x-2 border-primary"
                style={{ left: `${s}%`, width: `${w}%` }}
              />
            );
          })()}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/50">
              {hours.start} — {hours.end}
            </span>
          </div>
          {/* Hour markers */}
          {[0, 6, 12, 18].map(h => (
            <div
              key={h}
              className="absolute top-0 bottom-0 border-l border-base-content/10"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              <span className="absolute bottom-1 left-1 text-[8px] text-base-content/20">{h}h</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Danger Zone ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={3}
        className="card p-6 border-error/30"
      >
        <div className="flex items-center gap-3 mb-4 border-b border-error/20 pb-4">
          <span className="p-2 rounded-xl bg-error/10 text-error">
            <BadgeAlert size={18} />
          </span>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-error">Danger Zone</h2>
            <p className="text-[10px] text-base-content/40">Irreversible account actions</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-error/5 border border-error/20">
          <div>
            <p className="text-sm font-bold text-base-content">Request Account Deletion</p>
            <p className="text-[10px] text-base-content/40 mt-0.5">Your account will be reviewed and suspended. Data retained for 30 days.</p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-error text-error text-xs font-black uppercase hover:bg-error/10 transition-all"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </motion.div>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-base-200 border border-error/30 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="p-2.5 rounded-2xl bg-error/10 text-error"><Trash2 size={20} /></span>
                <div>
                  <h3 className="font-black text-base-content text-lg">Delete Account?</h3>
                  <p className="text-xs text-base-content/40">This action cannot be undone.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Confirm Password *</label>
                  <input
                    type="password"
                    value={deleteForm.password}
                    onChange={e => setDeleteForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Your current password"
                    className="input-field w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Reason (Optional)</label>
                  <textarea
                    value={deleteForm.reason}
                    onChange={e => setDeleteForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="Why are you leaving?"
                    rows={3}
                    className="input-field w-full resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleDelete}
                  disabled={!deleteForm.password || isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-error text-white text-xs font-black uppercase tracking-wide disabled:opacity-50 hover:brightness-110 transition-all"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {isDeleting ? "Submitting…" : "Confirm Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 btn-secondary text-xs py-2.5"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}