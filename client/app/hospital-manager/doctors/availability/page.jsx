"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Users, Search, Eye, X, CheckCircle2, XCircle,
  Loader2, Info, User, Wifi, WifiOff, CalendarDays, Timer, AlertCircle,
} from "lucide-react";

import {
  fetchLinkedDoctors,
  fetchDoctorAvailability,
  selectLinkedDoctors,
  selectDoctorAvailability,
  isLoading,
  getError,
} from "@/store/slices/hospitalManagerSlice";

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS     = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const TYPE_COLORS = {
  inPerson:  { bg: "var(--primary)",   text: "var(--primary-content)",   label: "In-Person"  },
  video:     { bg: "var(--secondary)", text: "var(--secondary-content)", label: "Video"       },
  homeVisit: { bg: "var(--accent)",    text: "var(--accent-content)",    label: "Home Visit"  },
  any:       { bg: "var(--info)",      text: "var(--info-content)",      label: "Any"         },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMins   = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
const fmtTime  = t => {
  const [h,m] = t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
};
const slotDuration = (s,e) => {
  const mins = toMins(e)-toMins(s);
  const h = Math.floor(mins/60), m = mins%60;
  return h>0 ? (m>0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

// ─── Doctor Selector ──────────────────────────────────────────────────────────
const DoctorSelector = ({ doctors, selected, onSelect, loadingList }) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() =>
    doctors.filter(d =>
      d.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization?.toLowerCase().includes(search.toLowerCase())
    ), [doctors, search]);

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-[10px] font-bold text-[var(--base-content)] uppercase tracking-wider flex items-center gap-2">
        <Users size={13} /> Select Doctor
      </p>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" />
        <input
          type="text"
          placeholder="Search doctors…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field w-full pl-9 text-[10px] py-2"
        />
      </div>
      <p className="text-[10px] text-[var(--base-content)]/35">
        Only linked doctors shown — availability is read-only for hospital managers
      </p>

      {loadingList ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[var(--primary)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2">
          <User size={20} className="text-[var(--base-content)]/20" />
          <p className="text-[10px] text-[var(--base-content)]/40">No doctors found</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {filtered.map(doc => {
            // weeklyAvailability may not be populated in list view — use consultationTypes as fallback indicator
            const activeDays = (doc.weeklyAvailability || []).filter(d => d.isAvailable).length;
            const isSelected = selected?._id === doc._id;
            return (
              <button
                key={doc._id}
                onClick={() => onSelect(doc)}
                className={`w-full text-left p-3 rounded-[var(--r-field)] border transition-all flex items-center gap-3 ${
                  isSelected
                    ? "bg-[var(--primary)] border-[var(--primary)]"
                    : "border-[var(--base-300)] hover:border-[var(--primary)] bg-[var(--base-200)]"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  isSelected ? "bg-white/20 text-white" : "bg-[var(--primary)] text-[var(--primary-content)]"
                }`}>
                  {doc.user?.name?.split(" ").map(n => n[0]).join("").slice(0,2) ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-bold truncate ${isSelected ? "text-white" : "text-[var(--base-content)]"}`}>
                    {doc.user?.name ?? "—"}
                  </p>
                  <p className={`text-[10px] truncate ${isSelected ? "text-white/70" : "text-[var(--base-content)]/50"}`}>
                    {doc.specialization}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {activeDays > 0 && (
                    <span className={`text-[10px] font-bold ${isSelected ? "text-white/80" : "text-[var(--base-content)]/60"}`}>
                      {activeDays}d
                    </span>
                  )}
                  <div className={`w-2 h-2 rounded-full ${doc.isOnline ? "bg-[var(--success)]" : "bg-[var(--base-content)]/30"}`} />
                </div>
              </button>
            );
          })}
        </div>
      )}
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
      className="w-full text-left p-1 rounded-md border border-transparent hover:border-[var(--primary)]/30 transition-all group"
      style={{ background: `color-mix(in srgb, ${color.bg} 12%, var(--base-200))` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Clock size={11} style={{ color: color.bg }} />
          <span className="text-[8px] font-bold text-[var(--base-content)]">{fmtTime(slot.startTime)}</span>
          <span className="text-[8px] text-[var(--base-content)]/40">→</span>
          <span className="text-[8px] font-bold text-[var(--base-content)]">{fmtTime(slot.endTime)}</span>
        </div>
         
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: color.bg, color: color.text }}>
          {color.label}
        </span>
        <span className="text-[8px] text-[var(--base-content)]/50">{slotDuration(slot.startTime, slot.endTime)}</span>
        <span className="text-[8px] text-[var(--base-content)]/50">· {slot.maxPatients} pts</span>
      </div>
    </motion.button>
  );
};

// ─── Slot Detail Modal ────────────────────────────────────────────────────────
const SlotDetailModal = ({ slot, day, onClose }) => {
  if (!slot) return null;
  const color = TYPE_COLORS[slot.consultationType] || TYPE_COLORS.any;
  const rows = [
    { label: "Day",               value: day,                               note: "Day of week this slot recurs" },
    { label: "Start Time",        value: fmtTime(slot.startTime),           note: `24-hour: ${slot.startTime}` },
    { label: "End Time",          value: fmtTime(slot.endTime),             note: `24-hour: ${slot.endTime}` },
    { label: "Duration",          value: slotDuration(slot.startTime, slot.endTime), note: "Total available consultation window" },
    { label: "Max Patients",      value: slot.maxPatients,                  note: "Booking capacity — patients cannot book beyond this" },
    { label: "Consultation Type", value: color.label,                       note: "Set by the doctor per slot" },
    { label: "Status",            value: slot.isActive ? "Active" : "Inactive", note: "Inactive slots hidden from patients" },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-[var(--base-100)] rounded-[var(--r-box)] shadow-2xl border border-[var(--base-300)] overflow-hidden"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between border-b border-[var(--base-300)]"
          style={{ background: `color-mix(in srgb, ${color.bg} 10%, var(--base-200))` }}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} style={{ color: color.bg }} />
            <p className="font-bold text-xs text-[var(--base-content)]">Slot Details</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--base-300)] transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {rows.map(r => (
            <div key={r.label} className="flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--base-content)]/50 font-medium">{r.label}</span>
                <span className="text-[10px] font-bold text-[var(--base-content)]">{r.value}</span>
              </div>
              <p className="text-[10px] text-[var(--base-content)]/30 mt-0.5">{r.note}</p>
              <div className="h-px bg-[var(--base-300)] mt-2" />
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <div className="alert alert-info text-[10px] flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
            <p className="text-[var(--base-content)]/70 text-[10px]  ">
              Hospital managers can view availability but cannot edit it. Doctors manage their own slots.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Weekly Grid View ─────────────────────────────────────────────────────────
const WeeklyGrid = ({ availability, onSlotClick }) => {
  const availMap = useMemo(() => {
    const m = {};
    (availability || []).forEach(d => { m[d.day] = d; });
    return m;
  }, [availability]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS.map((day, i) => {
        const dayData  = availMap[day];
        const isOff    = !dayData || !dayData.isAvailable;
        const slots    = dayData?.slots?.filter(s => s.isActive) || [];
        const isWeekend = i >= 5;

        return (
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-md border overflow-hidden transition-colors ${
              isOff
                ? "border-[var(--base-300)] opacity-60"
                : "border-[var(--base-300)] hover:border-[var(--primary)]/40"
            } ${isWeekend ? "bg-[var(--base-200)]/50" : "bg-[var(--base-100)]"}`}
          >
            {/* Day header */}
            <div className={`px-2 py-2.5 border-b border-[var(--base-300)] flex items-center justify-between ${isOff ? "bg-[var(--base-300)]/40" : "bg-[var(--base-200)]"}`}>
              <div>
                <p className="text-[10px]  uppercase tracking-wider text-[var(--base-content)]/60">{DAY_SHORT[i]}{day.slice(3)}</p>
                 
              </div>
              {isOff
                ? <XCircle size={13} className="text-[var(--error)]/60" />
                : <CheckCircle2 size={13} className="text-[var(--success)]" />
              }
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
                slots.map(slot => (
                  <SlotBadge key={slot._id} slot={slot} onClick={s => onSlotClick(s, day)} />
                ))
              )}
            </div>

            {/* Footer */}
            {!isOff && slots.length > 0 && (
              <div className="px-2 pb-2">
                <p className="text-[9px] text-[var(--base-content)]/40 font-semibold">
                  {slots.length} slot{slots.length !== 1 ? "s" : ""} · {slots.reduce((s, sl) => s + sl.maxPatients, 0)} max pts
                </p>
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
        <p className="font-bold text-[var(--base-content)] text-xs">No availability set</p>
        <p className="text-[10px] text-[var(--base-content)]/50 mt-1 max-w-xs">
          This doctor hasn't published any weekly slots yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active.map(day => {
        const activeSlots = day.slots.filter(s => s.isActive);
        return (
          <div key={day.day} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-[var(--r-field)] bg-[var(--primary)] flex items-center justify-center">
                <span className="text-[10px] font-black text-[var(--primary-content)]">{day.day.slice(0,3).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-bold text-xs text-[var(--base-content)]">{day.day}</p>
                <p className="text-[10px] text-[var(--base-content)]/50">
                  {activeSlots.length} active slot{activeSlots.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeSlots.map(slot => (
                <SlotBadge key={slot._id} slot={slot} onClick={s => onSlotClick(s, day.day)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Availability() {
  const dispatch = useDispatch();

  // Selectors
  const doctors         = useSelector(selectLinkedDoctors);
  // BUG FIX: selectDoctorAvailability returns { doctorProfileId, availability, doctorName }
  const availabilityRaw = useSelector(selectDoctorAvailability);

  const loadingList   = useSelector(isLoading(fetchLinkedDoctors));
  const loadingAvail  = useSelector(isLoading(fetchDoctorAvailability));
  const errorList     = useSelector(getError(fetchLinkedDoctors));
  const errorAvail    = useSelector(getError(fetchDoctorAvailability));

  // Local UI state
  const [selected, setSelected]       = useState(null);
  const [view, setView]               = useState("grid");
  const [activeSlot, setActiveSlot]   = useState(null);
  const [activeSlotDay, setActiveSlotDay] = useState(null);

  // Fetch linked doctors on mount
  useEffect(() => {
    dispatch(fetchLinkedDoctors({ limit: 100 })); // get all for selector panel
  }, [dispatch]);

  // When doctor selected, fetch their availability
  const handleSelectDoctor = (doc) => {
    setSelected(doc);
    setActiveSlot(null);
    setActiveSlotDay(null);
    dispatch(fetchDoctorAvailability(doc._id));
  };

  // BUG FIX: extract availability array from slice shape { doctorProfileId, availability, doctorName }
  // guard: only show if returned availability belongs to current selected doctor
  const availability = (
    availabilityRaw?.doctorProfileId === selected?._id
      ? availabilityRaw?.availability
      : null
  );

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!availability) return null;
    const activeDays    = availability.filter(d => d.isAvailable).length;
    const totalSlots    = availability.reduce((sum, d) => sum + d.slots.filter(s => s.isActive).length, 0);
    const totalPatients = availability.reduce((sum, d) =>
      sum + d.slots.filter(s => s.isActive).reduce((s2, sl) => s2 + sl.maxPatients, 0), 0
    );
    const typeCount = {};
    availability.forEach(d =>
      d.slots.filter(s => s.isActive).forEach(sl => {
        typeCount[sl.consultationType] = (typeCount[sl.consultationType] || 0) + 1;
      })
    );
    return { activeDays, totalSlots, totalPatients, typeCount };
  }, [availability]);

  return (
    <div className="min-h-screen bg-[var(--base-100)] p-4  " data-theme="hospital">

      {/* Slot detail modal */}
      <AnimatePresence>
        {activeSlot && (
          <SlotDetailModal
            slot={activeSlot}
            day={activeSlotDay}
            onClose={() => { setActiveSlot(null); setActiveSlotDay(null); }}
          />
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
        <h1 className="text-2xl md:text-3xl font-black text-[var(--base-content)] font-montserrat tracking-tight">
          Doctor Availability
        </h1>
        <p className="text-xs text-[var(--base-content)]/50 mt-1">
          View weekly slot schedules for all linked doctors — read-only for hospital managers
        </p>
      </div>

      {/* Error banner — list fetch failed */}
      {errorList && (
        <div className="alert alert-error flex items-center gap-2 mb-4">
          <AlertCircle size={14} />
          <p className="text-[10px] font-semibold">{errorList}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">

        {/* Left: doctor selector */}
        <div className="lg:col-span-1">
          <DoctorSelector
            doctors={doctors}
            selected={selected}
            onSelect={handleSelectDoctor}
            loadingList={loadingList}
          />
        </div>

        {/* Right: availability */}
        <div className="lg:col-span-3 space-y-4">

          {/* No doctor selected */}
          {!selected && !loadingList && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card p-12 flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-[var(--base-200)] flex items-center justify-center">
                <CalendarDays size={28} className="text-[var(--base-content)]/30" />
              </div>
              <p className="font-bold text-[var(--base-content)]">Select a doctor</p>
              <p className="text-xs text-[var(--base-content)]/50 max-w-xs">
                Choose a linked doctor from the left panel to view their weekly availability and slot details
              </p>
            </motion.div>
          )}

          {/* Loading availability */}
          {loadingAvail && selected && (
            <div className="card p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-[var(--primary)]" />
              <p className="text-xs text-[var(--base-content)]/50">Loading availability…</p>
            </div>
          )}

          {/* Error fetching availability */}
          {errorAvail && selected && !loadingAvail && (
            <div className="card p-8 flex flex-col items-center gap-3 text-center">
              <AlertCircle size={24} className="text-[var(--error)]" />
              <p className="text-xs font-semibold text-[var(--base-content)]">Failed to load availability</p>
              <p className="text-[10px] text-[var(--base-content)]/50">{errorAvail}</p>
              <button
                onClick={() => dispatch(fetchDoctorAvailability(selected._id))}
                className="btn-secondary text-[10px] px-4 py-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loaded */}
          {!loadingAvail && selected && availability && (
            <AnimatePresence>
              <motion.div
                key={selected._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Doctor header card */}
                <div className="card p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center font-bold text-[var(--primary-content)] font-montserrat">
                        {selected.user?.name?.split(" ").map(n => n[0]).join("").slice(0,2) ?? "?"}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--base-100)] ${selected.isOnline ? "bg-[var(--success)]" : "bg-[var(--base-content)]/30"}`} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--base-content)]">{selected.user?.name}</p>
                      <p className="text-[10px] text-[var(--primary)] font-semibold">{selected.specialization}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {selected.isOnline
                          ? <Wifi size={11} className="text-[var(--success)]" />
                          : <WifiOff size={11} className="text-[var(--base-content)]/40" />
                        }
                        <span className="text-[10px] text-[var(--base-content)]/50">
                          {selected.isOnline ? "Online now" : "Offline"}
                        </span>
                        {/* Show doctor name from API response if available */}
                        {availabilityRaw?.doctorName && (
                          <span className="text-[10px] text-[var(--base-content)]/30 ml-1">
                            · via API: {availabilityRaw.doctorName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* View toggle */}
                  <div className="flex items-center gap-2">
                    {[
                      { key: "grid", icon: CalendarDays, label: "Grid" },
                      { key: "list", icon: Timer,        label: "List" },
                    ].map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setView(key)}
                        className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-[var(--r-field)] border font-semibold transition-colors ${
                          view === key
                            ? "bg-[var(--primary)] text-[var(--primary-content)] border-[var(--primary)]"
                            : "border-[var(--base-300)] text-[var(--base-content)] hover:border-[var(--primary)]"
                        }`}
                      >
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary stats */}
                {summaryStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Active Days",        value: summaryStats.activeDays,    color: "var(--primary)", note: "Days with isAvailable: true and at least one active slot" },
                      { label: "Total Slots",        value: summaryStats.totalSlots,    color: "var(--success)", note: "Sum of all isActive slots across available days" },
                      { label: "Max Patients/Week",  value: summaryStats.totalPatients, color: "var(--info)",    note: "Total booking capacity — sum of maxPatients across active slots" },
                      { label: "Consult Types",      value: Object.keys(summaryStats.typeCount).length, color: "var(--accent)", note: "Distinct consultation types offered this week" },
                    ].map(({ label, value, color, note }) => (
                      <div key={label} className="card p-4 flex flex-col gap-2">
                        <p className="text-2xl font-black font-montserrat" style={{ color }}>{value}</p>
                        <p className="text-[10px] font-semibold text-[var(--base-content)]">{label}</p>
                        <p className="text-[10px] text-[var(--base-content)]/35 leading-snug">{note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Read-only notice */}
                <div className="alert alert-info flex items-start gap-2.5">
                  <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
                  <div>
                    <p className="text-[10px] font-bold text-[var(--base-content)]">Read-only view</p>
                    <p className="text-[11px] text-[var(--base-content)]/60 mt-0.5">
                      Hospital managers can view but not modify doctor schedules. Weekly slots are managed exclusively by the doctor. Hospital controls pricing; doctors control availability.
                    </p>
                  </div>
                </div>

                {/* Grid or list */}
                {view === "grid" ? (
                  <WeeklyGrid
                    availability={availability}
                    onSlotClick={(slot, day) => { setActiveSlot(slot); setActiveSlotDay(day); }}
                  />
                ) : (
                  <ListView
                    availability={availability}
                    onSlotClick={(slot, day) => { setActiveSlot(slot); setActiveSlotDay(day); }}
                  />
                )}

                {/* Legend */}
                <div className="card p-4">
                  <p className="text-[10px] font-bold text-[var(--base-content)] mb-3">Consultation Type Legend</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(TYPE_COLORS).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: val.bg }} />
                        <span className="text-[10px] text-[var(--base-content)]/70 font-medium">{val.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--base-content)]/35 mt-2">
                    'Any' means doctor accepts all consultation types in that slot
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}