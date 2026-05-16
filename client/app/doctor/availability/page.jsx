'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Clock, Plus, Trash2, Save,
  Loader2, Power, ChevronDown, ChevronUp,
  Wifi, WifiOff, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  fetchDoctorWeekly,
  updateDoctorWeekly,
  updateDoctorDay,
  toggleDoctorOnlineStatus,
  selectDoctorWeeklyAvailability,
  selectDoctorIsOnline,
  selectAvailabilityLoading,
  selectAvailabilityError,
} from '@/store/slices/availabilitySlice';

/* ─── constants ─── */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
const CONSULT_TYPES = ['any', 'inPerson', 'video', 'homeVisit'];
const CONSULT_LABELS = { any: 'Any', inPerson: 'In-Person', video: 'Video', homeVisit: 'Home Visit' };

/* ─── animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' } }),
};
const slideDown = {
  hidden: { opacity: 0, height: 0 },
  show:   { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: 'easeOut' } },
  exit:   { opacity: 0, height: 0,      transition: { duration: 0.2, ease: 'easeIn' } },
};

/* ─── helpers ─── */
const emptySlot = () => ({ startTime: '09:00', endTime: '17:00', maxPatients: 10, consultationType: 'any', isActive: true });
const buildDefault = () => DAYS.map(day => ({ day, isAvailable: false, slots: [] }));

/* ─── slot row ─── */
const SlotRow = ({ slot, onChange, onRemove, idx }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 8, height: 0 }}
    transition={{ duration: 0.22 }}
    className="grid grid-cols-[1fr_1fr_auto_auto_auto] sm:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center"
  >
    {/* start */}
    <input
      type="time" value={slot.startTime}
      onChange={e => onChange(idx, 'startTime', e.target.value)}
      className="input-field text-xs font-mono py-2 px-2"
    />
    {/* end */}
    <input
      type="time" value={slot.endTime}
      onChange={e => onChange(idx, 'endTime', e.target.value)}
      className="input-field text-xs font-mono py-2 px-2"
    />
    {/* type — hidden on mobile, visible sm+ */}
    <select
      value={slot.consultationType}
      onChange={e => onChange(idx, 'consultationType', e.target.value)}
      className="input-field text-xs py-2 px-2 hidden sm:block"
    >
      {CONSULT_TYPES.map(t => <option key={t} value={t}>{CONSULT_LABELS[t]}</option>)}
    </select>
    {/* max patients */}
    <input
      type="number" min="1" max="99" value={slot.maxPatients}
      onChange={e => onChange(idx, 'maxPatients', parseInt(e.target.value) || 1)}
      className="input-field text-xs font-mono py-2 px-2 w-14"
    />
    {/* remove */}
    <button type="button" onClick={() => onRemove(idx)}
      className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors flex-shrink-0">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </motion.div>
);

/* ─── day card ─── */
const DayCard = ({ entry, dayIdx, onChange, onAddSlot, onRemoveSlot, onSlotChange }) => {
  const [expanded, setExpanded] = useState(entry.isAvailable);

  const toggleAvailable = () => {
    const next = !entry.isAvailable;
    onChange(dayIdx, 'isAvailable', next);
    setExpanded(next);
  };

  useEffect(() => {
    if (entry.isAvailable) setExpanded(true);
  }, [entry.isAvailable]);

  const bookingCount = entry.slots.reduce((a, s) => a + (s.maxPatients || 0), 0);

  return (
    <motion.div
      variants={fadeUp} custom={dayIdx} initial="hidden" animate="show"
      className={`rounded-2xl border transition-colors duration-200 overflow-hidden ${
        entry.isAvailable ? 'border-primary/30 bg-base-200' : 'border-base-300/60 bg-base-200/50'
      }`}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => entry.isAvailable && setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          {/* day toggle */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleAvailable(); }}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
              entry.isAvailable ? 'bg-primary' : 'bg-base-300'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
              entry.isAvailable ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
          <div>
            <p className={`text-sm font-bold ${entry.isAvailable ? 'text-base-content' : 'text-base-content/40'}`}>
              {entry.day}
            </p>
            {entry.isAvailable && entry.slots.length > 0 && (
              <p className="text-[10px] text-base-content/50">
                {entry.slots.length} slot{entry.slots.length > 1 ? 's' : ''} · {bookingCount} max patients
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!entry.isAvailable && (
            <span className="badge badge-xs text-[10px] px-1.5 py-0.5">Day Off</span>
          )}
          {entry.isAvailable && (
            expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-base-content/40" />
              : <ChevronDown className="w-3.5 h-3.5 text-base-content/40" />
          )}
        </div>
      </div>

      {/* slots panel */}
      <AnimatePresence initial={false}>
        {entry.isAvailable && expanded && (
          <motion.div
            key="slots"
            variants={slideDown} initial="hidden" animate="show" exit="exit"
            className="px-4 pb-4 space-y-3"
          >
            {/* column headers */}
            {entry.slots.length > 0 && (
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] sm:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 px-0.5">
                <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">Start</p>
                <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">End</p>
                <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider hidden sm:block">Type</p>
                <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">Max</p>
                <span />
              </div>
            )}

            <AnimatePresence>
              {entry.slots.map((slot, sIdx) => (
                <SlotRow
                  key={sIdx} idx={sIdx} slot={slot}
                  onChange={(i, k, v) => onSlotChange(dayIdx, i, k, v)}
                  onRemove={(i) => onRemoveSlot(dayIdx, i)}
                />
              ))}
            </AnimatePresence>

            {entry.slots.length === 0 && (
              <p className="text-xs text-base-content/30 italic py-1">No slots added yet</p>
            )}

            <button
              type="button"
              onClick={() => onAddSlot(dayIdx)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Slot
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ─── main page ─── */
export default function Availability() {
  const dispatch = useDispatch();
  const weekly   = useSelector(selectDoctorWeeklyAvailability);
  const isOnline = useSelector(selectDoctorIsOnline);
  const loading  = useSelector(selectAvailabilityLoading);
  const error    = useSelector(selectAvailabilityError);

  const [availability, setAvailability] = useState(buildDefault());
  const [dirty, setDirty]               = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(false);

  /* seed from redux */
  useEffect(() => { dispatch(fetchDoctorWeekly()); }, [dispatch]);

  useEffect(() => {
    if (weekly?.length) {
      const base  = buildDefault();
      const merged = base.map(def => {
        const found = weekly.find(w => w.day === def.day);
        return found ? { ...def, ...found } : def;
      });
      setAvailability(merged);
      setDirty(false);
    }
  }, [weekly]);

  /* mutations */
  const handleChange = useCallback((dayIdx, key, value) => {
    setAvailability(prev => prev.map((d, i) => i === dayIdx ? { ...d, [key]: value } : d));
    setDirty(true);
  }, []);

  const handleSlotChange = useCallback((dayIdx, slotIdx, key, value) => {
    setAvailability(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const slots = d.slots.map((s, si) => si === slotIdx ? { ...s, [key]: value } : s);
      return { ...d, slots };
    }));
    setDirty(true);
  }, []);

  const handleAddSlot = useCallback((dayIdx) => {
    setAvailability(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const last = d.slots[d.slots.length - 1];
      const next = last
        ? { ...emptySlot(), startTime: last.endTime }
        : emptySlot();
      return { ...d, slots: [...d.slots, next] };
    }));
    setDirty(true);
  }, []);

  const handleRemoveSlot = useCallback((dayIdx, slotIdx) => {
    setAvailability(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return { ...d, slots: d.slots.filter((_, si) => si !== slotIdx) };
    }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    await dispatch(updateDoctorWeekly(availability));
    setDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleToggleOnline = () => {
    dispatch(toggleDoctorOnlineStatus({ isOnline: !isOnline }));
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary">
                <CalendarDays className="w-5 h-5 text-primary-content" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-base-content">Availability</h1>
                <p className="text-sm text-base-content/50">Set your weekly schedule and slot capacity</p>
              </div>
            </div>

            {/* online toggle */}
            <button
              onClick={handleToggleOnline}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                isOnline
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-base-300/60 bg-base-200 text-base-content/50'
              }`}
            >
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Online' : 'Offline'}
            </button>
          </div>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-error/30 bg-error/5 text-sm text-error"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Days ── */}
        {loading && !availability.some(d => d.slots.length > 0) ? (
          <div className="space-y-3">
            {DAYS.map(d => <div key={d} className="h-14 rounded-2xl skeleton" />)}
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {availability.map((entry, dayIdx) => (
              <DayCard
                key={entry.day}
                entry={entry}
                dayIdx={dayIdx}
                onChange={handleChange}
                onAddSlot={handleAddSlot}
                onRemoveSlot={handleRemoveSlot}
                onSlotChange={handleSlotChange}
              />
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <motion.div variants={fadeUp} custom={8} initial="hidden" animate="show"
          className="flex items-center justify-between gap-4 sticky bottom-4">
          <AnimatePresence>
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-xs font-semibold text-success"
              >
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 ml-auto">
            {dirty && (
              <span className="text-xs text-warning font-medium">Unsaved changes</span>
            )}
            <motion.button
              onClick={handleSave}
              disabled={!dirty || loading}
              whileHover={{ scale: !dirty || loading ? 1 : 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Schedule</>
              }
            </motion.button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}