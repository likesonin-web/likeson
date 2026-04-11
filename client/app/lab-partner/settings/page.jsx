"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Settings, Sliders, Monitor, Bell, Users, Clock, ImageIcon,
  Save, ChevronRight, Loader2, Check, AlertCircle, CheckCircle2,
  Upload, Link as LinkIcon, X, Plus, Trash2, Info, Globe,
  MapPin, Clock3, DollarSign, FileText, Smartphone, Mail,
  BellOff, Star, Activity, Home, Package, TestTube2, Image,
  Camera, RefreshCw,
} from "lucide-react";

import {
  fetchPartnerSettings,
  updatePartnerOperationalSettings,
  updatePartnerDisplaySettings,
  updatePartnerNotificationPreferences,
  updatePartnerContactPersons,
  updatePartnerTiming,
  updatePartnerImages,
  selectPartnerSettings,
  selectLabLoading,
  selectLabActionLoading,
  selectLabError,
} from "@/store/slices/labSlice";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SECTION_META = {
  operational:     { label: "Operational",     icon: Sliders,   desc: "Collection modes, TAT, fees & payout"   },
  display:         { label: "Display",          icon: Monitor,   desc: "Description, website & tags"             },
  notifications:   { label: "Notifications",    icon: Bell,      desc: "Email & SMS alert preferences"          },
  "contact-persons":{ label: "Contact Persons", icon: Users,     desc: "Lab directors & operations heads"       },
  timing:          { label: "Timing",           icon: Clock,     desc: "Operating hours for each day"           },
  images:          { label: "Images",           icon: ImageIcon, desc: "Logo & cover image"                     },
};

const NAV_SECTIONS = Object.entries(SECTION_META);

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.06 },
  }),
};

const panel = {
  hidden: { opacity: 0, x: 12 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] } },
  exit:   { opacity: 0, x: -8, transition: { duration: 0.18 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = 14 }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: "var(--primary)" }} />;
}

function SaveBar({ onSave, loading, dirty }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg"
          style={{
            background: "var(--base-100)",
            border: "1.5px solid color-mix(in oklch, var(--primary), transparent 60%)",
            boxShadow: "0 8px 32px color-mix(in oklch, var(--primary), transparent 65%)",
          }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--base-content)" }}>
            Unsaved changes
          </span>
          <button
            onClick={onSave}
            disabled={loading}
            className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-60"
          >
            {loading ? <Spinner size={12} /> : <Save size={12} />}
            Save Changes
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <div className={`card p-0 overflow-hidden ${className}`}>
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: "var(--base-300)", background: "var(--base-200)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "color-mix(in oklch, var(--primary), transparent 84%)" }}
        >
          <Icon size={15} style={{ color: "var(--primary)" }} strokeWidth={2.2} />
        </div>
        <div>
          <h3
            className="font-montserrat font-black text-sm tracking-tight"
            style={{ color: "var(--base-content)", lineHeight: 1.2 }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function InputRow({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 42%, transparent)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, sub, icon: Icon }) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all"
      style={{
        background: checked
          ? "color-mix(in oklch, var(--primary), transparent 91%)"
          : "var(--base-200)",
        border: `1px solid ${checked
          ? "color-mix(in oklch, var(--primary), transparent 68%)"
          : "var(--base-300)"}`,
      }}
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: checked
                ? "color-mix(in oklch, var(--primary), transparent 78%)"
                : "var(--base-300)",
            }}>
            <Icon size={13} style={{ color: checked ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 40%, transparent)" }} strokeWidth={2} />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--base-content)" }}>{label}</p>
          {sub && <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>{sub}</p>}
        </div>
      </div>
      <div className="w-10 h-5.5 rounded-full relative flex-shrink-0 transition-all"
        style={{
          background: checked ? "var(--primary)" : "color-mix(in oklch, var(--base-content), transparent 75%)",
          height: "1.375rem",
          width: "2.5rem",
        }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? "calc(100% - 1.125rem)" : "0.125rem" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION PANELS
// ─────────────────────────────────────────────────────────────────────────────

// ── OPERATIONAL ──────────────────────────────────────────────────────────────
function OperationalSection({ settings, onSave, loading }) {
  const [form, setForm] = useState({
    sampleCollectionMode: settings?.operational?.sampleCollectionMode ?? "Both",
    homeCollectionRadius: settings?.operational?.homeCollectionRadius ?? 0,
    homeCollectionFee:    settings?.operational?.homeCollectionFee    ?? 0,
    avgTurnaroundHours:   settings?.operational?.avgTurnaroundHours   ?? "",
    payoutFrequency:      settings?.operational?.payoutFrequency      ?? "Monthly",
    reportDeliveryModes:  settings?.operational?.reportDeliveryModes  ?? [],
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings?.operational) {
      setForm({
        sampleCollectionMode: settings.operational.sampleCollectionMode ?? "Both",
        homeCollectionRadius: settings.operational.homeCollectionRadius ?? 0,
        homeCollectionFee:    settings.operational.homeCollectionFee    ?? 0,
        avgTurnaroundHours:   settings.operational.avgTurnaroundHours   ?? "",
        payoutFrequency:      settings.operational.payoutFrequency      ?? "Monthly",
        reportDeliveryModes:  settings.operational.reportDeliveryModes  ?? [],
      });
    }
  }, [settings]);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  const toggleDeliveryMode = (mode) => {
    setForm((p) => ({
      ...p,
      reportDeliveryModes: p.reportDeliveryModes.includes(mode)
        ? p.reportDeliveryModes.filter((m) => m !== mode)
        : [...p.reportDeliveryModes, mode],
    }));
    setDirty(true);
  };

  const DELIVERY_MODES = ["Digital (App)", "Email", "WhatsApp", "Physical Copy", "All"];

  return (
    <>
      <div className="space-y-6">
        <SectionCard title="Sample Collection" icon={TestTube2} subtitle="How patients can submit samples">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["Walk-in", "Home Collection", "Both"].map((m) => (
              <button key={m} onClick={() => set("sampleCollectionMode", m)}
                className="p-3 rounded-xl text-sm font-semibold text-center transition-all"
                style={{
                  background: form.sampleCollectionMode === m
                    ? "var(--bg-gradient-primary)"
                    : "var(--base-200)",
                  color: form.sampleCollectionMode === m
                    ? "var(--primary-content)"
                    : "color-mix(in oklch, var(--base-content) 65%, transparent)",
                  border: `1px solid ${form.sampleCollectionMode === m
                    ? "transparent"
                    : "var(--base-300)"}`,
                  boxShadow: form.sampleCollectionMode === m
                    ? "0 4px 14px color-mix(in oklch, var(--primary), transparent 60%)"
                    : "none",
                }}>
                {m}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Home Collection Details" icon={Home}
          subtitle="Radius and fee for home sample collection">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputRow label="Collection Radius (km)" hint="Set 0 to disable home collection">
              <div className="relative">
                <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
                <input type="number" min={0} value={form.homeCollectionRadius}
                  onChange={(e) => set("homeCollectionRadius", Number(e.target.value))}
                  className="input-field w-full text-sm pl-9" placeholder="10" />
              </div>
            </InputRow>
            <InputRow label="Collection Fee (₹)" hint="Charge applied per home visit">
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
                <input type="number" min={0} value={form.homeCollectionFee}
                  onChange={(e) => set("homeCollectionFee", Number(e.target.value))}
                  className="input-field w-full text-sm pl-9" placeholder="0" />
              </div>
            </InputRow>
          </div>
        </SectionCard>

        <SectionCard title="Report Delivery & TAT" icon={FileText}
          subtitle="How reports reach patients and turnaround time">
          <div className="space-y-5">
            <InputRow label="Average Turnaround (hours)">
              <div className="relative">
                <Clock3 size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
                <input type="number" min={1} value={form.avgTurnaroundHours}
                  onChange={(e) => set("avgTurnaroundHours", Number(e.target.value))}
                  className="input-field w-full text-sm pl-9" placeholder="24" />
              </div>
            </InputRow>
            <InputRow label="Report Delivery Modes">
              <div className="flex flex-wrap gap-2 mt-1">
                {DELIVERY_MODES.map((m) => {
                  const active = form.reportDeliveryModes.includes(m);
                  return (
                    <button key={m} onClick={() => toggleDeliveryMode(m)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: active
                          ? "var(--primary)"
                          : "color-mix(in oklch, var(--primary), transparent 90%)",
                        color: active ? "var(--primary-content)" : "var(--primary)",
                        border: `1px solid ${active ? "transparent" : "color-mix(in oklch, var(--primary), transparent 65%)"}`,
                      }}>
                      {active && <Check size={10} className="inline mr-1" />}
                      {m}
                    </button>
                  );
                })}
              </div>
            </InputRow>
          </div>
        </SectionCard>

        <SectionCard title="Payout Frequency" icon={DollarSign} subtitle="How often you receive payouts">
          <div className="grid grid-cols-3 gap-3">
            {["Weekly", "Bi-weekly", "Monthly"].map((f) => (
              <button key={f} onClick={() => set("payoutFrequency", f)}
                className="p-3 rounded-xl text-sm font-semibold text-center transition-all"
                style={{
                  background: form.payoutFrequency === f
                    ? "color-mix(in oklch, var(--primary), transparent 84%)"
                    : "var(--base-200)",
                  color: form.payoutFrequency === f ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 65%, transparent)",
                  border: `1.5px solid ${form.payoutFrequency === f ? "color-mix(in oklch, var(--primary), transparent 60%)" : "var(--base-300)"}`,
                }}>
                {f}
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <SaveBar dirty={dirty} loading={loading} onSave={() => { onSave(form); setDirty(false); }} />
    </>
  );
}

// ── DISPLAY ──────────────────────────────────────────────────────────────────
function DisplaySection({ settings, onSave, loading }) {
  const [form, setForm] = useState({
    description: settings?.display?.description ?? "",
    websiteUrl:  settings?.display?.websiteUrl  ?? "",
    tags:        settings?.display?.tags        ?? [],
  });
  const [dirty,   setDirty]   = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (settings?.display) {
      setForm({
        description: settings.display.description ?? "",
        websiteUrl:  settings.display.websiteUrl  ?? "",
        tags:        settings.display.tags        ?? [],
      });
    }
  }, [settings]);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      set("tags", [...form.tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (t) => set("tags", form.tags.filter((x) => x !== t));

  return (
    <>
      <div className="space-y-6">
        <SectionCard title="Lab Description" icon={FileText} subtitle="Shown to patients on your public profile">
          <InputRow label="Description">
            <textarea
              rows={4}
              className="input-field w-full text-sm resize-none"
              placeholder="Describe your laboratory, specialties, and services…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </InputRow>
        </SectionCard>

        <SectionCard title="Web Presence" icon={Globe} subtitle="Your public website and online identity">
          <InputRow label="Website URL">
            <div className="relative">
              <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
              <input type="url" value={form.websiteUrl}
                onChange={(e) => set("websiteUrl", e.target.value)}
                className="input-field w-full text-sm pl-9" placeholder="https://yourlab.in" />
            </div>
          </InputRow>
        </SectionCard>

        <SectionCard title="Search Tags" icon={Settings} subtitle="Help patients find your lab by keyword">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-sm"
                placeholder="e.g. blood test, pathology, nabl…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <button onClick={addTag}
                className="btn-secondary text-xs px-4 flex items-center gap-1.5">
                <Plus size={13} /> Add
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map((t) => (
                  <span key={t}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: "color-mix(in oklch, var(--primary), transparent 86%)",
                      color: "var(--primary)",
                      border: "1px solid color-mix(in oklch, var(--primary), transparent 68%)",
                    }}>
                    {t}
                    <button onClick={() => removeTag(t)}
                      className="hover:opacity-70 transition-opacity">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 42%, transparent)" }}>
              Press Enter or click Add. Tags help with full-text search.
            </p>
          </div>
        </SectionCard>
      </div>
      <SaveBar dirty={dirty} loading={loading} onSave={() => { onSave(form); setDirty(false); }} />
    </>
  );
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────
function NotificationsSection({ settings, onSave, loading }) {
  const initial = settings?.notifications ?? {};
  const [prefs, setPrefs] = useState(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings?.notifications) { setPrefs(settings.notifications); }
  }, [settings]);

  const toggle = (k) => { setPrefs((p) => ({ ...p, [k]: !p[k] })); setDirty(true); };

  const PREFS = [
    { key: "emailOnNewBooking",    label: "New Booking",       sub: "Email when a new test is booked",            icon: Package    },
    { key: "emailOnCancellation",  label: "Cancellation",      sub: "Email when a booking is cancelled",          icon: BellOff    },
    { key: "emailOnReview",        label: "New Review",        sub: "Email when a patient leaves a review",       icon: Star       },
    { key: "emailOnStatusChange",  label: "Account Status",    sub: "Updates on approval or suspension changes",  icon: Activity   },
    { key: "smsOnNewBooking",      label: "SMS — New Booking", sub: "SMS alert for every new booking",            icon: Smartphone },
  ];

  return (
    <>
      <div className="space-y-3">
        {PREFS.map(({ key, label, sub, icon }) => (
          <Toggle key={key} checked={!!prefs[key]} onChange={() => toggle(key)}
            label={label} sub={sub} icon={icon} />
        ))}
        <div className="flex items-start gap-2 p-3 rounded-xl mt-2"
          style={{ background: "color-mix(in oklch, var(--info), transparent 90%)" }}>
          <Info size={13} style={{ color: "var(--info)", flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs" style={{ color: "var(--info)" }}>
            SMS notifications incur standard carrier charges. Ensure your phone number is verified.
          </p>
        </div>
      </div>
      <SaveBar dirty={dirty} loading={loading} onSave={() => { onSave(prefs); setDirty(false); }} />
    </>
  );
}

// ── CONTACT PERSONS ──────────────────────────────────────────────────────────
function ContactPersonsSection({ settings, onSave, loading }) {
  const [persons, setPersons] = useState(settings?.display?.contactPersons ?? []);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // contact persons come from partnerProfile via settings or we init empty
    if (Array.isArray(settings?.display?.contactPersons)) {
      setPersons(settings.display.contactPersons);
    }
  }, [settings]);

  const add = () => {
    setPersons((p) => [...p, { name: "", designation: "", phone: "", email: "", isPrimary: false }]);
    setDirty(true);
  };

  const remove = (i) => { setPersons((p) => p.filter((_, idx) => idx !== i)); setDirty(true); };

  const update = (i, field, value) => {
    setPersons((p) => p.map((x, idx) => idx === i ? { ...x, [field]: value } : x));
    setDirty(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
            {persons.length} contact person{persons.length !== 1 ? "s" : ""} registered
          </p>
          <button onClick={add}
            className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5">
            <Plus size={12} /> Add Person
          </button>
        </div>

        {persons.length === 0 ? (
          <div className="text-center py-16 rounded-2xl"
            style={{ background: "var(--base-200)", border: "2px dashed var(--base-300)" }}>
            <Users size={28} style={{ color: "color-mix(in oklch, var(--base-content) 30%, transparent)", margin: "0 auto 10px" }} />
            <p className="text-sm font-semibold" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
              No contact persons yet
            </p>
            <p className="text-xs mt-1" style={{ color: "color-mix(in oklch, var(--base-content) 35%, transparent)" }}>
              Add lab directors, operations heads, or key staff
            </p>
          </div>
        ) : (
          persons.map((cp, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" animate="show"
              className="p-5 rounded-2xl"
              style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: "var(--bg-gradient-primary)", color: "var(--primary-content)" }}>
                    {i + 1}
                  </div>
                  {cp.isPrimary && (
                    <span className="badge badge-primary text-[10px]">Primary</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer"
                    style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
                    <input type="checkbox" checked={cp.isPrimary}
                      onChange={(e) => update(i, "isPrimary", e.target.checked)}
                      className="w-3 h-3 accent-[var(--primary)]" />
                    Set as Primary
                  </label>
                  <button onClick={() => remove(i)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{
                      background: "color-mix(in oklch, var(--error), transparent 86%)",
                      color: "var(--error)",
                    }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { field: "name",        placeholder: "Full Name",       type: "text"  },
                  { field: "designation", placeholder: "Designation",     type: "text"  },
                  { field: "phone",       placeholder: "Phone Number",    type: "tel"   },
                  { field: "email",       placeholder: "Email Address",   type: "email" },
                ].map(({ field, placeholder, type }) => (
                  <input key={field} type={type}
                    className="input-field text-sm"
                    placeholder={placeholder}
                    value={cp[field] ?? ""}
                    onChange={(e) => update(i, field, e.target.value)}
                  />
                ))}
              </div>
            </motion.div>
          ))
        )}
      </div>
      <SaveBar dirty={dirty} loading={loading} onSave={() => { onSave(persons); setDirty(false); }} />
    </>
  );
}

// ── TIMING ───────────────────────────────────────────────────────────────────
function TimingSection({ settings, onSave, loading }) {
  const buildDefault = () =>
    DAYS.map((day) => ({ day, openTime: "09:00", closeTime: "18:00", isClosed: false }));

  const [timing, setTiming] = useState(buildDefault());
  const [dirty,  setDirty]  = useState(false);

  useEffect(() => {
    const t = settings?.operational?.timing;
    if (Array.isArray(t) && t.length > 0) {
      const map = Object.fromEntries(t.map((x) => [x.day, x]));
      setTiming(DAYS.map((day) => map[day] ?? { day, openTime: "09:00", closeTime: "18:00", isClosed: false }));
    }
  }, [settings]);

  const update = (i, field, value) => {
    setTiming((p) => p.map((x, idx) => idx === i ? { ...x, [field]: value } : x));
    setDirty(true);
  };

  const setAllOpen = () => {
    setTiming((p) => p.map((x) => ({ ...x, isClosed: false })));
    setDirty(true);
  };

  const setWeekdaysOnly = () => {
    setTiming((p) => p.map((x) => ({
      ...x,
      isClosed: x.day === "Saturday" || x.day === "Sunday",
    })));
    setDirty(true);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 pb-2">
          <button onClick={setAllOpen} className="btn-secondary text-xs px-3 py-1.5">
            All Days Open
          </button>
          <button onClick={setWeekdaysOnly} className="btn-secondary text-xs px-3 py-1.5">
            Weekdays Only
          </button>
        </div>

        {timing.map((slot, i) => (
          <motion.div key={slot.day} variants={fadeUp} custom={i * 0.5} initial="hidden" animate="show"
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl transition-all"
            style={{
              background: slot.isClosed ? "var(--base-200)" : "color-mix(in oklch, var(--primary), transparent 93%)",
              border: `1px solid ${slot.isClosed ? "var(--base-300)" : "color-mix(in oklch, var(--primary), transparent 72%)"}`,
              opacity: slot.isClosed ? 0.65 : 1,
            }}>
            {/* Day name */}
            <div className="w-28 flex-shrink-0">
              <span className="text-sm font-bold" style={{ color: "var(--base-content)" }}>
                {slot.day}
              </span>
            </div>

            {/* Closed toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0"
              style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
              <input type="checkbox" checked={slot.isClosed}
                onChange={(e) => update(i, "isClosed", e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--error)]" />
              <span className="text-xs font-semibold">Closed</span>
            </label>

            {/* Time inputs */}
            {!slot.isClosed && (
              <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs flex-shrink-0"
                    style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                    Opens
                  </span>
                  <input type="time" value={slot.openTime}
                    onChange={(e) => update(i, "openTime", e.target.value)}
                    className="input-field text-sm flex-1 min-w-0" />
                </div>
                <span className="text-xs hidden sm:block"
                  style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>→</span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs flex-shrink-0"
                    style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                    Closes
                  </span>
                  <input type="time" value={slot.closeTime}
                    onChange={(e) => update(i, "closeTime", e.target.value)}
                    className="input-field text-sm flex-1 min-w-0" />
                </div>
              </div>
            )}

            {slot.isClosed && (
              <span className="text-xs font-semibold ml-2"
                style={{ color: "color-mix(in oklch, var(--base-content) 35%, transparent)" }}>
                Not operational today
              </span>
            )}
          </motion.div>
        ))}
      </div>
      <SaveBar dirty={dirty} loading={loading} onSave={() => { onSave(timing); setDirty(false); }} />
    </>
  );
}

// ── IMAGES ───────────────────────────────────────────────────────────────────
function ImagesSection({ settings, onSave, loading }) {
  const [logo,       setLogo]       = useState({ type: "url", file: null, url: settings?.display?.logoUrl   ?? "" });
  const [cover,      setCover]      = useState({ type: "url", file: null, url: settings?.display?.coverImageUrl ?? "" });
  const [logoPreview,  setLogoPreview]  = useState(settings?.display?.logoUrl   ?? "");
  const [coverPreview, setCoverPreview] = useState(settings?.display?.coverImageUrl ?? "");
  const [dirty, setDirty] = useState(false);
  const logoRef  = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    setLogoPreview(settings?.display?.logoUrl ?? "");
    setCoverPreview(settings?.display?.coverImageUrl ?? "");
    setLogo((p) => ({ ...p, url: settings?.display?.logoUrl ?? "" }));
    setCover((p) => ({ ...p, url: settings?.display?.coverImageUrl ?? "" }));
  }, [settings]);

  const handleFileChange = (e, which) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (which === "logo")  { setLogo({ type: "file", file, url: "" });  setLogoPreview(preview);  }
    else                   { setCover({ type: "file", file, url: "" }); setCoverPreview(preview); }
    setDirty(true);
  };

  const handleUrlChange = (val, which) => {
    if (which === "logo")  { setLogo({ type: "url", file: null, url: val });  setLogoPreview(val);  }
    else                   { setCover({ type: "url", file: null, url: val }); setCoverPreview(val); }
    setDirty(true);
  };

  const handleSave = () => {
    const payload = {};
    if (logo.type  === "file" && logo.file)  payload.logo       = logo.file;
    if (cover.type === "file" && cover.file) payload.coverImage = cover.file;
    // URL-only updates go through display settings
    if (logo.type  === "url"  && logo.url)   payload.logoUrl       = logo.url;
    if (cover.type === "url"  && cover.url)  payload.coverImageUrl = cover.url;
    onSave(payload, { hasFiles: !!(logo.file || cover.file) });
    setDirty(false);
  };

  const ImageUploadCard = ({ label, preview, which, inputRef, desc }) => (
    <SectionCard title={label} icon={which === "logo" ? Camera : ImageIcon} subtitle={desc}>
      {/* Preview */}
      {preview && (
        <div className="mb-4 relative group overflow-hidden rounded-xl"
          style={{ aspectRatio: which === "logo" ? "1/1" : "16/5", maxHeight: which === "logo" ? 160 : 120 }}>
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(0,0,0,0.4)" }}>
            <span className="text-white text-xs font-semibold">Change Image</span>
          </div>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { mode: "file", icon: Upload,   label: "Upload File" },
          { mode: "url",  icon: LinkIcon, label: "Paste URL"   },
        ].map(({ mode, icon: Icon, label: ml }) => {
          const current = which === "logo" ? logo.type : cover.type;
          return (
            <button key={mode}
              onClick={() => which === "logo"
                ? setLogo((p) => ({ ...p, type: mode }))
                : setCover((p) => ({ ...p, type: mode }))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: current === mode
                  ? "var(--primary)"
                  : "color-mix(in oklch, var(--primary), transparent 88%)",
                color: current === mode ? "var(--primary-content)" : "var(--primary)",
              }}>
              <Icon size={11} /> {ml}
            </button>
          );
        })}
      </div>

      {/* Upload */}
      {(which === "logo" ? logo.type : cover.type) === "file" ? (
        <label
          className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-primary"
          style={{ borderColor: "color-mix(in oklch, var(--primary), transparent 62%)" }}
          onClick={() => inputRef.current?.click()}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "color-mix(in oklch, var(--primary), transparent 85%)" }}>
            <Upload size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--base-content)" }}>
              {(which === "logo" ? logo.file : cover.file)?.name ?? "Click to upload"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
              JPG, PNG, WebP — max 10 MB
            </p>
          </div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" onChange={(e) => handleFileChange(e, which)} />
        </label>
      ) : (
        <div>
          <div className="relative">
            <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
            <input type="url" className="input-field w-full text-sm pl-9"
              placeholder="https://ik.imagekit.io/…"
              value={which === "logo" ? logo.url : cover.url}
              onChange={(e) => handleUrlChange(e.target.value, which)} />
          </div>
          <p className="text-xs mt-1.5"
            style={{ color: "color-mix(in oklch, var(--base-content) 42%, transparent)" }}>
            ImageKit, Cloudinary, or any public image URL
          </p>
        </div>
      )}
    </SectionCard>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImageUploadCard
          label="Lab Logo"
          which="logo"
          inputRef={logoRef}
          preview={logoPreview}
          desc="Square image — shown on listings & profile cards"
        />
        <ImageUploadCard
          label="Cover Image"
          which="cover"
          inputRef={coverRef}
          preview={coverPreview}
          desc="Wide banner — shown on your public lab profile page"
        />
      </div>
      <SaveBar dirty={dirty} loading={loading} onSave={handleSave} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SETTINGS PAGE  — app/lab-partner/settings/[...section]/page.jsx
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const rawSection = params?.section;
  const activeSection =
    (Array.isArray(rawSection) ? rawSection[0] : rawSection) ?? "operational";

  const settings     = useSelector(selectPartnerSettings);
  const loading      = useSelector(selectLabLoading);
  const actionLoading = useSelector(selectLabActionLoading);
  const error        = useSelector(selectLabError);

  useEffect(() => {
    dispatch(fetchPartnerSettings());
  }, [dispatch]);

  // Redirect bare /settings to /settings/operational
  useEffect(() => {
    if (!rawSection) router.replace("/lab-partner/settings/operational");
  }, [rawSection, router]);

  // ── Section save handlers ────────────────────────────────────────────
  const saveHandlers = {
    operational: (data) => dispatch(updatePartnerOperationalSettings(data)),
    display:     (data) => dispatch(updatePartnerDisplaySettings(data)),
    notifications: (data) => dispatch(updatePartnerNotificationPreferences(data)),
    "contact-persons": (data) => dispatch(updatePartnerContactPersons(data)),
    timing:      (data) => dispatch(updatePartnerTiming(data)),
    images:      (data, meta) => {
      if (meta?.hasFiles) {
        dispatch(updatePartnerImages(data));
      } else {
        // URL-based images go through display settings
        const payload = {};
        if (data.logoUrl)       payload.logoUrl       = data.logoUrl;
        if (data.coverImageUrl) payload.coverImageUrl = data.coverImageUrl;
        if (Object.keys(payload).length) dispatch(updatePartnerDisplaySettings(payload));
      }
    },
  };

  const meta = SECTION_META[activeSection] ?? SECTION_META.operational;
  const ActiveIcon = meta.icon;

  const SECTION_COMPONENTS = {
    operational:      <OperationalSection   settings={settings} onSave={saveHandlers.operational} loading={actionLoading} />,
    display:          <DisplaySection       settings={settings} onSave={saveHandlers.display}     loading={actionLoading} />,
    notifications:    <NotificationsSection settings={settings} onSave={saveHandlers.notifications} loading={actionLoading} />,
    "contact-persons":<ContactPersonsSection settings={settings} onSave={saveHandlers["contact-persons"]} loading={actionLoading} />,
    timing:           <TimingSection        settings={settings} onSave={saveHandlers.timing}      loading={actionLoading} />,
    images:           <ImagesSection        settings={settings} onSave={saveHandlers.images}       loading={actionLoading} />,
  };

  return (
    <div data-theme="lab" className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <div className="container-custom max-w-7xl py-8">

        {/* Breadcrumb */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-2 mb-1"
            style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
            <Link href="/lab-partner/dashboard" className="text-xs hover:underline no-underline">Dashboard</Link>
            <ChevronRight size={12} />
            <Link href="/lab-partner/settings/operational" className="text-xs hover:underline no-underline">Settings</Link>
            <ChevronRight size={12} />
            <span className="text-xs" style={{ color: "var(--primary)" }}>{meta.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in oklch, var(--primary), transparent 84%)" }}>
              <ActiveIcon size={18} style={{ color: "var(--primary)" }} strokeWidth={2} />
            </div>
            <div>
              <h1 className="font-montserrat font-black text-2xl md:text-3xl"
                style={{ color: "var(--base-content)" }}>
                Settings
              </h1>
              <p className="text-sm" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
                {meta.desc}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="alert alert-error mb-6 text-sm">
              <AlertCircle size={14} style={{ color: "var(--error)", flexShrink: 0 }} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar — desktop */}
          <motion.nav variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="hidden lg:flex flex-col gap-1 w-60 flex-shrink-0">
            <div className="card p-3">
              {NAV_SECTIONS.map(([id, { label, icon: Icon, desc }]) => {
                const isActive = activeSection === id;
                return (
                  <Link key={id} href={`/lab-partner/settings/${id}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all group no-underline"
                    style={{
                      background: isActive
                        ? "color-mix(in oklch, var(--primary), transparent 86%)"
                        : "transparent",
                      borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                      marginBottom: "2px",
                    }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isActive
                          ? "color-mix(in oklch, var(--primary), transparent 75%)"
                          : "var(--base-200)",
                      }}>
                      <Icon size={13} strokeWidth={isActive ? 2.4 : 2}
                        style={{ color: isActive ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 55%, transparent)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate"
                        style={{ color: isActive ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 70%, transparent)" }}>
                        {label}
                      </p>
                    </div>
                    {isActive && <ChevronRight size={12} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                  </Link>
                );
              })}
            </div>
          </motion.nav>

          {/* Mobile tabs */}
          <div className="lg:hidden overflow-x-auto pb-1">
            <div className="flex gap-2 w-max">
              {NAV_SECTIONS.map(([id, { label, icon: Icon }]) => {
                const isActive = activeSection === id;
                return (
                  <Link key={id} href={`/lab-partner/settings/${id}`}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all no-underline"
                    style={{
                      background: isActive ? "var(--primary)" : "color-mix(in oklch, var(--primary), transparent 88%)",
                      color: isActive ? "var(--primary-content)" : "var(--primary)",
                    }}>
                    <Icon size={13} strokeWidth={2.2} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Panel */}
          <div className="flex-1 min-w-0">
            {loading && !settings ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="spinner w-10 h-10 animate-spin" />
                <p className="text-sm" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                  Loading settings…
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  variants={panel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  {SECTION_COMPONENTS[activeSection] ?? SECTION_COMPONENTS.operational}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}