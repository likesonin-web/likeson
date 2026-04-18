"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, ChevronLeft, ChevronRight, Users, Search,
  Eye, X, CheckCircle2, XCircle, Loader2, Building2, Video, Home,
  AlertCircle, Info, ChevronDown, User, Stethoscope, Wifi, WifiOff,
  CalendarDays, Timer, RefreshCw
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const makeSlots = (times, type = "inPerson") =>
  times.map(([s, e], i) => ({ _id: `slot_${i}`, startTime: s, endTime: e, maxPatients: 10 + i * 2, consultationType: type, isActive: true }));

const MOCK_DOCTORS = [
  {
    _id: "dp1", user: { name: "Dr. Anika Sharma" }, specialization: "Cardiologist", isOnline: true,
    weeklyAvailability: [
      { _id: "d1", day: "Monday", isAvailable: true, slots: makeSlots([["09:00","13:00"],["15:00","18:00"]], "inPerson") },
      { _id: "d2", day: "Tuesday", isAvailable: true, slots: makeSlots([["10:00","14:00"]], "video") },
      { _id: "d3", day: "Wednesday", isAvailable: false, slots: [] },
      { _id: "d4", day: "Thursday", isAvailable: true, slots: makeSlots([["09:00","12:00"],["14:00","17:00"]], "inPerson") },
      { _id: "d5", day: "Friday", isAvailable: true, slots: makeSlots([["09:00","13:00"]], "inPerson") },
      { _id: "d6", day: "Saturday", isAvailable: true, slots: makeSlots([["10:00","13:00"]], "any") },
      { _id: "d7", day: "Sunday", isAvailable: false, slots: [] },
    ],
    consultationTypes: { inPerson: true, video: true, homeVisit: false }
  },
  {
    _id: "dp2", user: { name: "Dr. Rajan Mehta" }, specialization: "Neurologist", isOnline: false,
    weeklyAvailability: [
      { _id: "d8", day: "Monday", isAvailable: true, slots: makeSlots([["08:00","11:00"]], "inPerson") },
      { _id: "d9", day: "Tuesday", isAvailable: false, slots: [] },
      { _id: "d10", day: "Wednesday", isAvailable: true, slots: makeSlots([["09:00","13:00"],["15:00","19:00"]], "inPerson") },
      { _id: "d11", day: "Thursday", isAvailable: false, slots: [] },
      { _id: "d12", day: "Friday", isAvailable: true, slots: makeSlots([["10:00","15:00"]], "homeVisit") },
      { _id: "d13", day: "Saturday", isAvailable: false, slots: [] },
      { _id: "d14", day: "Sunday", isAvailable: false, slots: [] },
    ],
    consultationTypes: { inPerson: true, video: false, homeVisit: true }
  },
  {
    _id: "dp3", user: { name: "Dr. Priya Nair" }, specialization: "Pediatrician", isOnline: true,
    weeklyAvailability: DAYS.map((day, i) => ({
      _id: `day_${i}`, day,
      isAvailable: i < 5,
      slots: i < 5 ? makeSlots([["09:00","17:00"]], "any") : []
    })),
    consultationTypes: { inPerson: true, video: true, homeVisit: true }
  },
];

const TYPE_COLORS = {
  inPerson:  { bg: "var(--primary)", text: "var(--primary-content)", label: "In-Person" },
  video:     { bg: "var(--secondary)", text: "var(--secondary-content)", label: "Video" },
  homeVisit: { bg: "var(--accent)", text: "var(--accent-content)", label: "Home Visit" },
  any:       { bg: "var(--info)", text: "var(--info-content)", label: "Any" },
};

// ─── Time to minutes helper ───────────────────────────────────────────────────
const toMins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fmtTime = t => {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ap}`;
};
const slotDuration = (s, e) => {
  const mins = toMins(e) - toMins(s);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

// ─── Doctor Selector ──────────────────────────────────────────────────────────
const DoctorSelector = ({ doctors, selected, onSelect }) => {
  const [search, setSearch] = useState("");
  const filtered = doctors.filter(d =>
    d.user.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialization.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-xs font-bold text-[var(--base-content)] uppercase tracking-wider flex items-center gap-2">
        <Users size={13} /> Select Doctor
      </p>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
        <input
          type="text"
          placeholder="Search doctors…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field w-full pl-9 text-xs py-2"
        />
      </div>
      <p className="text-[10px] text-[var(--base-content)]/35">Only linked doctors are shown — availability is read-only for hospital managers</p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {filtered.map(doc => {
          const totalSlots = doc.weeklyAvailability.reduce((sum, d) => sum + d.slots.filter(s => s.isActive).length, 0);
          const activeDays = doc.weeklyAvailability.filter(d => d.isAvailable).length;
          const isSelected = selected?._id === doc._id;
          return (
            <button
              key={doc._id}
              onClick={() => onSelect(doc)}
              className={`w-full text-left p-3 rounded-[var(--r-field)] border transition-all flex items-center gap-3 ${isSelected ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--base-300)] hover:border-[var(--primary)] bg-[var(--base-200)]"}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-[var(--primary)] text-[var(--primary-content)]"}`}>
                {doc.user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-[var(--base-content)]"}`}>{doc.user.name}</p>
                <p className={`text-[10px] truncate ${isSelected ? "text-white/70" : "text-[var(--base-content)]/50"}`}>{doc.specialization}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className={`text-[10px] font-bold ${isSelected ? "text-white/80" : "text-[var(--base-content)]/60"}`}>{activeDays}d</span>
                <div className={`w-2 h-2 rounded-full ${doc.isOnline ? "bg-[var(--success)]" : "bg-[var(--base-content)]/30"}`} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Slot Badge ───────────────────────────────────────────────────────────────
const SlotBadge = ({ slot, onClick }) => {
  const color = TYPE_COLORS[slot.consultationType] || TYPE_COLORS.any;
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(slot)}
      className="w-full text-left p-2.5 rounded-[var(--r-field)] border border-transparent hover:border-[var(--primary)]/30 transition-all group"
      style={{ background: `color-mix(in srgb, ${color.bg} 12%, var(--base-200))` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Clock size={11} style={{ color: color.bg }} />
          <span className="text-[11px] font-bold text-[var(--base-content)]">{fmtTime(slot.startTime)}</span>
          <span className="text-[10px] text-[var(--base-content)]/40">→</span>
          <span className="text-[11px] font-bold text-[var(--base-content)]">{fmtTime(slot.endTime)}</span>
        </div>
        <Eye size={11} className="text-[var(--base-content)]/30 group-hover:text-[var(--primary)] transition-colors" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: color.bg, color: color.text }}>
          {color.label}
        </span>
        <span className="text-[10px] text-[var(--base-content)]/50">{slotDuration(slot.startTime, slot.endTime)}</span>
        <span className="text-[10px] text-[var(--base-content)]/50">· {slot.maxPatients} pts</span>
      </div>
    </motion.button>
  );
};

// ─── Slot Detail Modal ────────────────────────────────────────────────────────
const SlotDetailModal = ({ slot, day, onClose }) => {
  if (!slot) return null;
  const color = TYPE_COLORS[slot.consultationType] || TYPE_COLORS.any;
  const rows = [
    { label: "Day", value: day, note: "Day of the week this slot recurs" },
    { label: "Start Time", value: fmtTime(slot.startTime), note: "Slot opening time (24-hour: " + slot.startTime + ")" },
    { label: "End Time", value: fmtTime(slot.endTime), note: "Slot closing time (24-hour: " + slot.endTime + ")" },
    { label: "Duration", value: slotDuration(slot.startTime, slot.endTime), note: "Total available consultation window" },
    { label: "Max Patients", value: slot.maxPatients, note: "Booking capacity for this slot — patients cannot book beyond this limit" },
    { label: "Consultation Type", value: color.label, note: "Type of consultation accepted in this slot — set by the doctor" },
    { label: "Status", value: slot.isActive ? "Active" : "Inactive", note: "Inactive slots are hidden from patients even if the day is available" },
  ];

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-sm bg-[var(--base-100)] rounded-[var(--r-box)] shadow-2xl border border-[var(--base-300)] overflow-hidden" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--base-300)]" style={{ background: `color-mix(in srgb, ${color.bg} 10%, var(--base-200))` }}>
          <div className="flex items-center gap-2">
            <Clock size={16} style={{ color: color.bg }} />
            <p className="font-bold text-sm text-[var(--base-content)]">Slot Details</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--base-300)] transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {rows.map(r => (
            <div key={r.label} className="flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--base-content)]/50 font-medium">{r.label}</span>
                <span className="text-xs font-bold text-[var(--base-content)]">{r.value}</span>
              </div>
              <p className="text-[10px] text-[var(--base-content)]/30 mt-0.5">{r.note}</p>
              <div className="h-px bg-[var(--base-300)] mt-2" />
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <div className="alert alert-info text-xs flex items-start gap-2">
            <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
            <p className="text-[var(--base-content)]/70">Hospital managers can view availability but cannot edit it. Doctors manage their own slots.</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Weekly Grid View ─────────────────────────────────────────────────────────
const WeeklyGrid = ({ availability, onSlotClick }) => {
  const availMap = {};
  (availability || []).forEach(d => { availMap[d.day] = d; });

  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS.map((day, i) => {
        const dayData = availMap[day];
        const isOff = !dayData || !dayData.isAvailable;
        const slots = dayData?.slots?.filter(s => s.isActive) || [];
        const isWeekend = i >= 5;

        return (
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-[var(--r-box)] border overflow-hidden ${isOff ? "border-[var(--base-300)] opacity-60" : "border-[var(--base-300)] hover:border-[var(--primary)]/40"} ${isWeekend ? "bg-[var(--base-200)]/50" : "bg-[var(--base-100)]"} transition-colors`}
          >
            {/* Day header */}
            <div className={`px-2 py-2.5 border-b border-[var(--base-300)] flex items-center justify-between ${isOff ? "bg-[var(--base-300)]/40" : "bg-[var(--base-200)]"}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--base-content)]/60">{DAY_SHORT[i]}</p>
                <p className="text-xs font-bold text-[var(--base-content)] leading-none">{day.slice(3)}</p>
              </div>
              {isOff ? (
                <XCircle size={13} className="text-[var(--error)]/60" />
              ) : (
                <CheckCircle2 size={13} className="text-[var(--success)]" />
              )}
            </div>

            {/* Slots */}
            <div className="p-1.5 min-h-20 space-y-1">
              {isOff ? (
                <div className="flex flex-col items-center justify-center h-16 gap-1">
                  <CalendarDays size={14} className="text-[var(--base-content)]/20" />
                  <p className="text-[9px] text-[var(--base-content)]/30 font-medium">Day Off</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-16 gap-1">
                  <AlertCircle size={14} className="text-[var(--warning)]/60" />
                  <p className="text-[9px] text-[var(--base-content)]/40 font-medium text-center">No slots</p>
                </div>
              ) : (
                slots.map(slot => <SlotBadge key={slot._id} slot={slot} onClick={s => onSlotClick(s, day)} />)
              )}
            </div>

            {/* Footer */}
            {!isOff && slots.length > 0 && (
              <div className="px-2 pb-2">
                <p className="text-[9px] text-[var(--base-content)]/40 font-semibold">{slots.length} slot{slots.length !== 1 ? "s" : ""} · {slots.reduce((s, sl) => s + sl.maxPatients, 0)} max pts</p>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ─── List View ────────────────────────────────────────────────────────────────
const ListView = ({ availability, onSlotClick }) => {
  const active = (availability || []).filter(d => d.isAvailable && d.slots?.some(s => s.isActive));
  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarDays size={36} className="text-[var(--base-content)]/20 mb-3" />
        <p className="font-bold text-[var(--base-content)] text-sm">No availability set</p>
        <p className="text-xs text-[var(--base-content)]/50 mt-1 max-w-xs">This doctor hasn't published any weekly slots yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {active.map(day => (
        <div key={day.day} className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-[var(--r-field)] bg-[var(--primary)] flex items-center justify-center">
              <span className="text-[10px] font-black text-[var(--primary-content)]">{day.day.slice(0, 3).toUpperCase()}</span>
            </div>
            <div>
              <p className="font-bold text-sm text-[var(--base-content)]">{day.day}</p>
              <p className="text-[10px] text-[var(--base-content)]/50">{day.slots.filter(s => s.isActive).length} active slot{day.slots.filter(s => s.isActive).length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {day.slots.filter(s => s.isActive).map(slot => (
              <SlotBadge key={slot._id} slot={slot} onClick={s => onSlotClick(s, day.day)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Availability() {
  const [doctors, setDoctors] = useState(MOCK_DOCTORS);
  const [selected, setSelected] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("grid"); // grid | list
  const [activeSlot, setActiveSlot] = useState(null);
  const [activeSlotDay, setActiveSlotDay] = useState(null);

  const loadAvailability = (doc) => {
    setSelected(doc);
    setLoading(true);
    setAvailability(null);
    setTimeout(() => {
      setAvailability(doc.weeklyAvailability);
      setLoading(false);
    }, 700);
  };

  // Summary stats for selected doctor
  const summaryStats = availability ? (() => {
    const activeDays = availability.filter(d => d.isAvailable).length;
    const totalSlots = availability.reduce((sum, d) => sum + d.slots.filter(s => s.isActive).length, 0);
    const totalPatients = availability.reduce((sum, d) => sum + d.slots.filter(s => s.isActive).reduce((s2, sl) => s2 + sl.maxPatients, 0), 0);
    const typeCount = {};
    availability.forEach(d => d.slots.filter(s => s.isActive).forEach(sl => { typeCount[sl.consultationType] = (typeCount[sl.consultationType] || 0) + 1; }));
    return { activeDays, totalSlots, totalPatients, typeCount };
  })() : null;

  return (
    <div className="min-h-screen bg-[var(--base-100)] p-4 md:p-6 lg:p-8" data-theme="hospital">
      {/* Slot detail modal */}
      <AnimatePresence>
        {activeSlot && (
          <SlotDetailModal slot={activeSlot} day={activeSlotDay} onClose={() => { setActiveSlot(null); setActiveSlotDay(null); }} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-[var(--r-field)] bg-[var(--primary)] flex items-center justify-center">
            <Calendar size={15} className="text-[var(--primary-content)]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">Schedule</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-[var(--base-content)] font-montserrat tracking-tight">Doctor Availability</h1>
        <p className="text-sm text-[var(--base-content)]/50 mt-1">View weekly slot schedules for all linked doctors — read-only for hospital managers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left panel: doctor list */}
        <div className="lg:col-span-1">
          <DoctorSelector doctors={doctors} selected={selected} onSelect={loadAvailability} />
        </div>

        {/* Right panel: availability */}
        <div className="lg:col-span-3 space-y-4">

          {/* No doctor selected */}
          {!selected && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-[var(--base-200)] flex items-center justify-center">
                <CalendarDays size={28} className="text-[var(--base-content)]/30" />
              </div>
              <p className="font-bold text-[var(--base-content)]">Select a doctor</p>
              <p className="text-sm text-[var(--base-content)]/50 max-w-xs">Choose a linked doctor from the left panel to view their weekly availability and slot details</p>
            </motion.div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="card p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-[var(--primary)]" />
              <p className="text-sm text-[var(--base-content)]/50">Loading availability…</p>
            </div>
          )}

          {/* Loaded */}
          {!loading && selected && availability && (
            <AnimatePresence>
              <motion.div key={selected._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                {/* Doctor header */}
                <div className="card p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center font-bold text-[var(--primary-content)] font-montserrat">
                        {selected.user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--base-100)] ${selected.isOnline ? "bg-[var(--success)]" : "bg-[var(--base-content)]/30"}`} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--base-content)]">{selected.user.name}</p>
                      <p className="text-xs text-[var(--primary)] font-semibold">{selected.specialization}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {selected.isOnline ? <Wifi size={11} className="text-[var(--success)]" /> : <WifiOff size={11} className="text-[var(--base-content)]/40" />}
                        <span className="text-[10px] text-[var(--base-content)]/50">{selected.isOnline ? "Online now" : "Offline"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setView("grid")}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--r-field)] border font-semibold transition-colors ${view === "grid" ? "bg-[var(--primary)] text-[var(--primary-content)] border-[var(--primary)]" : "border-[var(--base-300)] text-[var(--base-content)] hover:border-[var(--primary)]"}`}
                    >
                      <CalendarDays size={12} /> Grid
                    </button>
                    <button
                      onClick={() => setView("list")}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--r-field)] border font-semibold transition-colors ${view === "list" ? "bg-[var(--primary)] text-[var(--primary-content)] border-[var(--primary)]" : "border-[var(--base-300)] text-[var(--base-content)] hover:border-[var(--primary)]"}`}
                    >
                      <Timer size={12} /> List
                    </button>
                  </div>
                </div>

                {/* Summary stats */}
                {summaryStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Active Days", value: summaryStats.activeDays, note: "Days per week with isAvailable: true and at least one active slot", color: "var(--primary)" },
                      { label: "Total Slots", value: summaryStats.totalSlots, note: "Sum of all isActive slots across all available days in the weekly schedule", color: "var(--success)" },
                      { label: "Max Patients/Week", value: summaryStats.totalPatients, note: "Total booking capacity per week — sum of maxPatients across all active slots", color: "var(--info)" },
                      { label: "Consult Types", value: Object.keys(summaryStats.typeCount).length, note: "Number of distinct consultation types (inPerson/video/homeVisit/any) offered this week", color: "var(--accent)" },
                    ].map(({ label, value, note, color }) => (
                      <div key={label} className="card p-4 flex flex-col gap-2">
                        <p className="text-2xl font-black font-montserrat" style={{ color }}>{value}</p>
                        <p className="text-xs font-semibold text-[var(--base-content)]">{label}</p>
                        <p className="text-[10px] text-[var(--base-content)]/35 leading-snug">{note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Read-only notice */}
                <div className="alert alert-info flex items-start gap-2.5">
                  <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
                  <div>
                    <p className="text-xs font-bold text-[var(--base-content)]">Read-only view</p>
                    <p className="text-[11px] text-[var(--base-content)]/60 mt-0.5">Hospital managers can view but not modify doctor schedules. Weekly slots and availability are managed exclusively by the doctor from their own dashboard. Hospital controls pricing; doctors control availability.</p>
                  </div>
                </div>

                {/* Grid or list view */}
                {view === "grid" ? (
                  <WeeklyGrid availability={availability} onSlotClick={(slot, day) => { setActiveSlot(slot); setActiveSlotDay(day); }} />
                ) : (
                  <ListView availability={availability} onSlotClick={(slot, day) => { setActiveSlot(slot); setActiveSlotDay(day); }} />
                )}

                {/* Legend */}
                <div className="card p-4">
                  <p className="text-xs font-bold text-[var(--base-content)] mb-3">Consultation Type Legend</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(TYPE_COLORS).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: val.bg }} />
                        <span className="text-xs text-[var(--base-content)]/70 font-medium">{val.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--base-content)]/35 mt-2">Consultation type is set per-slot by the doctor. 'Any' means the doctor accepts all types in that slot</p>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}