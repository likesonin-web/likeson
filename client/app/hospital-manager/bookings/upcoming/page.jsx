'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, User, Stethoscope, ChevronRight,
  RefreshCw, Filter, Search, AlertCircle, CheckCircle2,
  Activity, MapPin, Phone, XCircle, Loader2,
} from 'lucide-react';

import {
  fetchHospitalUpcoming,
  hospitalConfirm,
  selectHospitalUpcoming,
  selectHospitalUpcomingMeta,
  selectHospitalAction,
  resetHospitalAction,
} from '@/store/slices/operationsSlice';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const STATUS_META = {
  confirmed:   { label: 'Confirmed',   color: 'var(--success)', bg: 'var(--success)', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'var(--warning)', bg: 'var(--warning)', icon: Activity },
  pending:     { label: 'Pending',     color: 'var(--info)',    bg: 'var(--info)',    icon: Clock },
};

const TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Consultation',
  doctor_online:       'Online',
  physiotherapist:     'Physiotherapy',
  follow_up:           'Follow-Up',
  care_assistant:      'Care Assist',
  patient_transport:   'Transport',
};

// ─── card ────────────────────────────────────────────────────────────────────

function BookingCard({ booking, onConfirm, confirmingId }) {
  // Fallback to 'pending' if status doesn't exist in your meta mapping
  const meta = STATUS_META[booking.status] || STATUS_META.pending;
  const Icon = meta.icon;
  const isConfirming = confirmingId === booking._id;

  // Map JSON bookingType to readable labels
  const TYPE_LABELS = {
    doctor_consultation: "Doctor Consultation",
    home_visit: "Home Visit",
    // add others as needed
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: 'var(--base-100)',
        border: '1px solid var(--base-300)',
        borderRadius: 'var(--r-box)',
        overflow: 'hidden',
      }}
      className="shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      {/* Top visual stripe */}
      <div style={{ height: 4, background: `linear-gradient(90deg, var(--primary), var(--secondary))` }} />

      <div className="p-5">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'color-mix(in srgb, var(--primary), transparent 85%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Stethoscope size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: 'var(--base-content)', fontFamily: 'var(--font-montserrat)' }}>
                {booking.bookingCode}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                {TYPE_LABELS[booking.bookingType] || booking.bookingType}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span
            style={{
              background: `color-mix(in srgb, ${meta.bg}, transparent 85%)`,
              color: meta.color,
              border: `1px solid color-mix(in srgb, ${meta.bg}, transparent 65%)`,
              padding: '2px 10px',
              borderRadius: 'var(--r-selector)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={10} />
            {meta.label}
          </span>
        </div>

        {/* Data Rows */}
        <div className="grid grid-cols-1 gap-2 mb-4">
          <InfoRow icon={User} label="Patient" value={booking.patientInfo?.name} />
          <InfoRow icon={Calendar} label="Scheduled" value={fmt(booking.scheduledAt)} />
          
          {/* Using doctorSnapshot for the name as per your JSON */}
          {booking.doctorSnapshot?.name && (
            <InfoRow 
              icon={Stethoscope} 
              label="Doctor" 
              value={booking.doctorSnapshot.name} 
              subValue={booking.doctorSnapshot.specialization}
            />
          )}

          {/* Conditional check for Care Assistant (not present in your JSON sample, so it stays hidden) */}
          {booking.careAssistantSnapshot?.name && (
            <InfoRow icon={Activity} label="Care Assist" value={booking.careAssistantSnapshot.name} />
          )}
        </div>

        {/* Footer Actions */}
        {booking.status === 'confirmed' ? (
          <div
            style={{
              background: 'color-mix(in srgb, var(--success), transparent 90%)',
              border: '1px solid color-mix(in srgb, var(--success), transparent 70%)',
              borderRadius: 'var(--r-field)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--success)',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            Booking Confirmed
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onConfirm(booking._id)}
            disabled={isConfirming}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'var(--primary-content)',
              border: 'none',
              borderRadius: 'var(--r-field)',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: isConfirming ? 0.7 : 1,
            }}
          >
            {isConfirming ? (
              <><Loader2 size={14} className="animate-spin" /> Finalizing...</>
            ) : (
              <><CheckCircle2 size={14} /> Confirm Appointment</>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

 

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', minWidth: 56 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--base-content)', fontWeight: 600, truncate: true }} className="truncate">{value || '—'}</span>
    </div>
  );
}

// ─── empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full flex flex-col items-center justify-center py-20 gap-4"
    >
      <div
        style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'color-mix(in srgb, var(--primary), transparent 88%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Calendar size={32} style={{ color: 'var(--primary)' }} />
      </div>
      <p style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 800, fontSize: 18, color: 'var(--base-content)' }}>
        No upcoming appointments
      </p>
      <p style={{ fontSize: 13, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
        Confirmed & in-progress bookings appear here
      </p>
    </motion.div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function UpcomingBookings() {
  const dispatch = useDispatch();
  const bookings = useSelector(selectHospitalUpcoming);
  const meta     = useSelector(selectHospitalUpcomingMeta);
  const action   = useSelector(selectHospitalAction);

  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    dispatch(fetchHospitalUpcoming());
  }, [dispatch]);

  // handle confirm
  const handleConfirm = async (bookingId) => {
    setConfirmingId(bookingId);
    await dispatch(hospitalConfirm(bookingId));
    setConfirmingId(null);
    dispatch(fetchHospitalUpcoming());
  };

  // filter + search
  const filtered = (bookings || []).filter((b) => {
    const matchFilter = filter === 'all' || b.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.bookingCode?.toLowerCase().includes(q) ||
      b.patientInfo?.name?.toLowerCase().includes(q) ||
      b.doctorSnapshot?.name?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts = {
    all:         (bookings || []).length,
    confirmed:   (bookings || []).filter(b => b.status === 'confirmed').length,
    in_progress: (bookings || []).filter(b => b.status === 'in_progress').length,
  };

  const isLoading = meta.status === 'loading';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--base-200)',
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {/* hero header */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
          padding: '32px 24px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: 60, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div className="relative max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Hospital Dashboard
            </p>
            <h1 style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 900, fontSize: 'clamp(22px,4vw,32px)', color: '#fff', marginBottom: 4 }}>
              Upcoming Appointments
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
              {counts.all} total · {counts.confirmed} confirmed · {counts.in_progress} in progress
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto  mt-2 "  >

        {/* controls card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'var(--base-100)',
            borderRadius: 'var(--r-box)',
            border: '1px solid var(--base-300)',
            padding: '16px',
            marginBottom: 24,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          {/* search */}
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by code, patient or doctor…"
              style={{
                width: '100%',
                paddingLeft: 34,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 13,
                background: 'var(--base-200)',
                border: '1px solid var(--base-300)',
                borderRadius: 'var(--r-field)',
                color: 'var(--base-content)',
                outline: 'none',
              }}
            />
          </div>

          {/* filter tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: `All (${counts.all})` },
              { key: 'confirmed', label: `Confirmed (${counts.confirmed})` },
              { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--r-selector)',
                  border: filter === tab.key ? 'none' : '1px solid var(--base-300)',
                  background: filter === tab.key ? 'var(--primary)' : 'transparent',
                  color: filter === tab.key ? 'var(--primary-content)' : 'var(--base-content)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* refresh */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => dispatch(fetchHospitalUpcoming())}
            style={{
              padding: '8px',
              borderRadius: 'var(--r-field)',
              border: '1px solid var(--base-300)',
              background: 'var(--base-200)',
              color: 'var(--base-content)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </motion.button>
        </motion.div>

        {/* loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-10">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background: 'var(--base-100)', borderRadius: 'var(--r-box)', border: '1px solid var(--base-300)', height: 220 }}>
                <div style={{ height: 4, background: 'var(--base-300)' }} />
                <div className="p-5 space-y-3">
                  {[60,80,100,40].map((w,j) => (
                    <div key={j} style={{ height: 12, borderRadius: 6, background: 'var(--base-300)', width: `${w}%` }} className="skeleton" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* error */}
        {meta.error && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: 'color-mix(in srgb, var(--error), transparent 90%)',
              border: '1px solid color-mix(in srgb, var(--error), transparent 65%)',
              borderRadius: 'var(--r-box)',
              padding: '16px 20px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 20,
              color: 'var(--error)',
            }}
          >
            <AlertCircle size={18} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{meta.error}</span>
          </motion.div>
        )}

        {/* grid */}
        {!isLoading && (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-10">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map((booking, i) => (
                  <motion.div key={booking._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <BookingCard
                      booking={booking}
                      onConfirm={handleConfirm}
                      confirmingId={confirmingId}
                    />
                  </motion.div>
                ))
              )}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}