'use client';

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Star, X, Video,
  Home, Stethoscope, Users, SlidersHorizontal, RefreshCw,
  Navigation2, Zap, Award, Languages, ArrowRight, BadgeCheck,
  Activity, ChevronRight, Filter, TrendingUp, Clock,
} from 'lucide-react';
import {
  fetchNearbyDoctors,
  fetchAllDoctors,
  fetchDoctorsBySpecialization,
  searchDoctors,
  selectDoctors,
  selectNearbyDoctors,
  selectSpecializationDoctors,
  selectDoctorSearchResults,
  selectDoctorTotal,
  selectDoctorPage,
  selectDoctorPages,
  selectIsLoadingDoctors,
} from '@/store/slices/hospitalSlice';
import Container from '@/components/ui/Container';
import BackButton from '../../components/BackButton';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — all via CSS vars, zero hardcoded colors
// Doctor theme: royal blue (h 250) per global.css [data-theme="doctor"]
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Primary uses CSS var tokens — adapts to dark mode automatically
  accent:        'var(--primary)',
  accentContent: 'var(--primary-content)',
  secondary:     'var(--secondary)',
  base100:       'var(--base-100)',
  base200:       'var(--base-200)',
  base300:       'var(--base-300)',
  baseContent:   'var(--base-content)',
  success:       'var(--success)',
  warning:       'var(--warning)',

  // Computed opacity mixes
  accentBg:    'color-mix(in srgb, var(--primary) 8%,  transparent)',
  accentBgMid: 'color-mix(in srgb, var(--primary) 14%, transparent)',
  accentBgSm:  'color-mix(in srgb, var(--primary) 5%,  transparent)',
  accentBorder:'color-mix(in srgb, var(--primary) 25%, transparent)',
  accentShadow:'color-mix(in srgb, var(--primary) 28%, transparent)',
  accentGrad:  'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
  successBg:   'color-mix(in srgb, var(--success) 10%, transparent)',
  warningBg:   'color-mix(in srgb, var(--warning) 10%, transparent)',
};

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALIZATIONS
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALIZATIONS = [
  { label: 'All',                value: '',                    icon: '🩺' },
  { label: 'General Physician',  value: 'General Physician',   icon: '👨‍⚕️' },
  { label: 'Cardiologist',       value: 'Cardiologist',        icon: '❤️' },
  { label: 'Neurologist',        value: 'Neurologist',         icon: '🧠' },
  { label: 'Pediatrician',       value: 'Pediatrician',        icon: '👶' },
  { label: 'Oncologist',         value: 'Oncologist',          icon: '🔬' },
  { label: 'Orthopedic',         value: 'Orthopedic Surgeon',  icon: '🦴' },
  { label: 'Gastroenterologist', value: 'Gastroenterologist',  icon: '🫁' },
  { label: 'Gynecologist',       value: 'Gynecologist',        icon: '🌸' },
  { label: 'Dermatologist',      value: 'Dermatologist',       icon: '✨' },
  { label: 'Urologist',          value: 'Urologist',           icon: '💊' },
  { label: 'Psychiatry',         value: 'Psychiatry',          icon: '🧘' },
  { label: 'Physiotherapist',    value: 'Physiotherapist',     icon: '💪' },
];

const SORT_OPTIONS = [
  { label: 'Top Rated',   value: '-rating.averageRating', icon: Star       },
  { label: 'Experience',  value: '-experienceYears',      icon: Award      },
  { label: 'Newest',      value: '-createdAt',            icon: Clock      },
  { label: 'Lowest Fee',  value: 'fees.inPersonFee',      icon: TrendingUp },
];

const CONSULT_TYPES = [
  { label: 'In-Person', value: 'inPerson',  icon: Stethoscope },
  { label: 'Video',     value: 'video',     icon: Video       },
  { label: 'Home Visit',value: 'homeVisit', icon: Home        },
];

// Per-consult-type accent colors (static — not role-themed, semantic meaning)
const CONSULT_COLORS = {
  inPerson:  { bg: 'color-mix(in srgb, var(--success)  12%, transparent)', text: 'var(--success)',  border: 'color-mix(in srgb, var(--success) 30%, transparent)'  },
  video:     { bg: 'color-mix(in srgb, var(--primary)  12%, transparent)', text: 'var(--primary)',  border: 'color-mix(in srgb, var(--primary) 30%, transparent)'  },
  homeVisit: { bg: 'color-mix(in srgb, var(--warning)  12%, transparent)', text: 'var(--warning)',  border: 'color-mix(in srgb, var(--warning) 30%, transparent)'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const containerVar = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const cardVar = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show:   { opacity: 1, y: 0,  scale: 1,    transition: { type: 'spring', damping: 22, stiffness: 280 } },
  exit:   { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.16 } },
};
const fadeIn = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtFee    = (fee) => fee > 0 ? `₹${fee.toLocaleString('en-IN')}` : 'Free';
const fmtRating = (r)   => (r ?? 0).toFixed(1);
const stripDr   = (name = '') => name.replace(/^dr\.?\s*/i, '').trim();

// ─────────────────────────────────────────────────────────────────────────────
// STAR ROW
// ─────────────────────────────────────────────────────────────────────────────
const StarRow = memo(({ rating, total }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          size={11}
          style={{
            fill:   s <= Math.round(rating ?? 0) ? 'var(--warning)' : 'transparent',
            color:  s <= Math.round(rating ?? 0) ? 'var(--warning)' : 'var(--base-300)',
          }}
        />
      ))}
    </div>
    <span className="text-[11px] font-black" style={{ color: T.accent }}>
      {fmtRating(rating)}
    </span>
    {total > 0 && (
      <span className="text-[10px] opacity-40">({total})</span>
    )}
  </div>
));

// ─────────────────────────────────────────────────────────────────────────────
// CONSULT BADGE
// ─────────────────────────────────────────────────────────────────────────────
const ConsultBadge = memo(({ type }) => {
  const map = {
    inPerson:  { Icon: Stethoscope, label: 'In-Person' },
    video:     { Icon: Video,       label: 'Video'     },
    homeVisit: { Icon: Home,        label: 'Home'      },
  };
  const { Icon, label } = map[type];
  const c = CONSULT_COLORS[type];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      <Icon size={9} /> {label}
    </span>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR CARD — premium redesign
// ─────────────────────────────────────────────────────────────────────────────
const DoctorCard = memo(function DoctorCard({ doctor }) {
  const {
    _id, profilePhotoUrl, isOnline, isVerified, specialization,
    experienceYears, rating, fees, consultationTypes,
    languagesSpoken, availability, user: doctorUser,
  } = doctor;

  const cleanName   = stripDr(doctorUser?.name ?? '');
  const displayName = cleanName || 'Unknown Doctor';

  const photo = profilePhotoUrl
    || doctorUser?.avatar
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`;

  const isGeneratedAvatar = photo.includes('ui-avatars.com');

  const consultTypes = useMemo(() => {
    const types = [];
    if (consultationTypes?.inPerson)  types.push('inPerson');
    if (consultationTypes?.video)     types.push('video');
    if (consultationTypes?.homeVisit) types.push('homeVisit');
    return types;
  }, [consultationTypes]);

  const lowestFee = useMemo(() => {
    const vals = [];
    if (consultationTypes?.inPerson  && fees?.inPersonFee  > 0) vals.push(fees.inPersonFee);
    if (consultationTypes?.video     && fees?.videoFee     > 0) vals.push(fees.videoFee);
    if (consultationTypes?.homeVisit && fees?.homeVisitFee > 0) vals.push(fees.homeVisitFee);
    return vals.length > 0 ? Math.min(...vals) : 0;
  }, [fees, consultationTypes]);

  const todayAvail = useMemo(() => {
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    return availability?.find(a => a.day === day);
  }, [availability]);

  const isAvailableToday = todayAvail?.slots?.length > 0;

  return (
    <motion.div
      variants={cardVar}
      layout
      className="group relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background:   T.base100,
        border:       `1px solid var(--base-300)`,
        boxShadow:    '0 1px 8px rgba(0,0,0,0.04)',
        transition:   'box-shadow 0.25s, border-color 0.25s, transform 0.25s',
      }}
      whileHover={{
        y: -3,
        boxShadow: `0 16px 40px ${T.accentShadow}`,
        borderColor: T.accent,
      }}
    >
      {/* Top gradient accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: T.accentGrad }}
        aria-hidden="true"
      />

      {/* Available today pill — floats top-right */}
      {isAvailableToday && (
        <div
          className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
          style={{ background: T.successBg, color: T.success }}
          aria-label="Available today"
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: T.success }}
            aria-hidden="true"
          />
          Today
        </div>
      )}

      <Link href={`/doctors/${_id}`} className="block p-5 flex-1">

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-4">

          {/* Avatar with online indicator */}
          <div className="relative flex-shrink-0">
            <div
              className="w-[68px] h-[68px] rounded-2xl overflow-hidden"
              style={{
                border: `2px solid ${isOnline ? 'var(--success)' : 'var(--base-300)'}`,
                boxShadow: isOnline ? `0 0 0 3px ${T.successBg}` : 'none',
              }}
            >
              <Image
                src={photo}
                alt={`Dr. ${displayName}`}
                width={68}
                height={68}
                className="w-full h-full object-cover"
                unoptimized={isGeneratedAvatar}
              />
            </div>
            {isOnline && (
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5" aria-label="Online">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: 'var(--success)' }}
                  aria-hidden="true"
                />
                <span
                  className="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-base-100"
                  style={{ background: 'var(--success)' }}
                  aria-hidden="true"
                />
              </span>
            )}
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="font-black text-[15px] leading-tight truncate">
                Dr. {displayName}
              </h3>
              {isVerified && (
                <BadgeCheck size={15} style={{ color: T.accent, flexShrink: 0 }} aria-label="Verified" />
              )}
            </div>
            <p
              className="text-[12px] font-bold mb-2 truncate"
              style={{ color: T.accent }}
            >
              {specialization}
            </p>
            <StarRow rating={rating?.averageRating} total={rating?.totalReviews ?? 0} />
          </div>
        </div>

        {/* ── STAT ROW ─────────────────────────────────────────────── */}
       <div
  className="flex items-stretch justify-between mb-4 rounded-xl p-3"
  style={{ background: T.accentBgSm, border: `1px solid ${T.accentBorder}` }}
>
  {/* Experience */}
  <div className="flex flex-1 flex-col items-center gap-1">
    <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Exp</span>
    <span className="text-[13px] font-black leading-none" style={{ color: T.accent }}>
      {experienceYears}y
    </span>
  </div>

  {/* Separator 1 */}
  <div className="w-px bg-current opacity-20" style={{ backgroundColor: T.accentBorder }} aria-hidden="true" />

  {/* Ratings */}
  <div className="flex flex-1 flex-col items-center gap-1">
    <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Ratings</span>
    <span className="text-[13px] font-black leading-none" style={{ color: T.accent }}>
      {(rating?.totalRatings ?? 0) > 0 ? rating.totalRatings : '–'}
    </span>
  </div>

  {/* Separator 2 */}
  <div className="w-px bg-current opacity-20" style={{ backgroundColor: T.accentBorder }} aria-hidden="true" />

  {/* Fee */}
  <div className="flex flex-1 flex-col items-center gap-1">
    <span className="text-[8px] font-black uppercase tracking-widest opacity-40">From</span>
    <span className="text-[13px] font-black leading-none" style={{ color: T.accent }}>
      {fmtFee(lowestFee)}
    </span>
  </div>
</div>

        {/* ── CONSULT BADGES ──────────────────────────────────────── */}
        {consultTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {consultTypes.map(t => <ConsultBadge key={t} type={t} />)}
          </div>
        )}

        {/* ── LANGUAGES ───────────────────────────────────────────── */}
        {languagesSpoken?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Languages size={10} className="opacity-30 flex-shrink-0" aria-hidden="true" />
            <span className="text-[10px] opacity-40 font-medium truncate">
              {languagesSpoken.slice(0, 3).join(' · ')}
            </span>
          </div>
        )}
      </Link>

      {/* ── CTA FOOTER ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-t"
        style={{ borderColor: 'var(--base-300)', background: T.base200 }}
      >
        <Link
          href={`/doctors/${_id}`}
          className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors hover:opacity-80"
          style={{ color: T.accent }}
          aria-label={`View profile of Dr. ${displayName}`}
        >
          View Profile <ChevronRight size={11} />
        </Link>

        <Link
          href={`/book-appointment?doctor=${_id}&type=doctor_consultation&name=${encodeURIComponent(displayName)}&spec=${encodeURIComponent(specialization || '')}`}
          aria-label={`Book appointment with Dr. ${displayName}`}
        >
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-0 cursor-pointer"
            style={{
              background: T.accentGrad,
              color:      'var(--primary-content)',
              boxShadow:  `0 4px 14px ${T.accentShadow}`,
            }}
          >
            Book Now
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON CARD
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div
    className="rounded-2xl p-5 space-y-4"
    style={{ border: '1px solid var(--base-300)', background: 'var(--base-100)' }}
  >
    <div className="flex gap-4">
      <div className="w-[68px] h-[68px] rounded-2xl skeleton" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded-lg skeleton" />
        <div className="h-3 w-1/2 rounded-lg skeleton" />
        <div className="h-3 w-2/3 rounded-lg skeleton" />
      </div>
    </div>
    <div className="h-12 rounded-xl skeleton" />
    <div className="flex gap-1.5">
      <div className="h-5 w-16 rounded-full skeleton" />
      <div className="h-5 w-14 rounded-full skeleton" />
    </div>
    <div className="h-10 rounded-xl skeleton" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// FILTER PANEL
// ─────────────────────────────────────────────────────────────────────────────
const FilterPanel = memo(function FilterPanel({ filters, onChange, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="rounded-2xl p-5 space-y-5 sticky top-24"
      style={{ border: '1px solid var(--base-300)', background: 'var(--base-100)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: T.accentBg }}
            aria-hidden="true"
          >
            <Filter size={13} style={{ color: T.accent }} />
          </div>
          <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: T.accent }}>
            Filters
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close filters"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-base-200"
          style={{ color: 'var(--base-content)', opacity: 0.5 }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Consultation type */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2.5">Consultation</p>
        <div className="space-y-2">
          {CONSULT_TYPES.map(({ label, value, icon: Icon }) => {
            const active = filters.consultationType === value;
            return (
              <button
                key={value}
                onClick={() => onChange('consultationType', active ? '' : value)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all"
                style={{
                  background:  active ? T.accentBg  : 'transparent',
                  borderColor: active ? T.accent     : 'var(--base-300)',
                  color:       active ? T.accent     : 'var(--base-content)',
                }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? T.accentBgMid : 'var(--base-200)' }}
                  aria-hidden="true"
                >
                  <Icon size={12} style={{ color: active ? T.accent : 'var(--base-content)', opacity: active ? 1 : 0.4 }} />
                </div>
                <span className="text-[12px] font-bold">{label}</span>
                {active && (
                  <div
                    className="ml-auto w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: T.accent }}
                    aria-hidden="true"
                  >
                    <X size={8} style={{ color: 'var(--primary-content)' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Min rating */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2.5">Min Rating</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 3, 4, 4.5].map(r => (
            <button
              key={r}
              onClick={() => onChange('rating', filters.rating === r ? 0 : r)}
              className="py-2 rounded-xl text-[10px] font-black border transition-all"
              style={{
                borderColor: filters.rating === r ? T.accent : 'var(--base-300)',
                background:  filters.rating === r ? T.accentBg : 'transparent',
                color:       filters.rating === r ? T.accent : 'var(--base-content)',
              }}
            >
              {r === 0 ? 'Any' : `${r}★`}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2.5">Sort By</p>
        <div className="space-y-1.5">
          {SORT_OPTIONS.map(({ label, value, icon: Icon }) => {
            const active = filters.sort === value;
            return (
              <button
                key={value}
                onClick={() => onChange('sort', value)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all"
                style={{
                  borderColor: active ? T.accent    : 'transparent',
                  background:  active ? T.accentBg  : 'var(--base-200)',
                  color:       active ? T.accent     : 'var(--base-content)',
                }}
              >
                <Icon size={12} style={{ color: active ? T.accent : 'var(--base-content)', opacity: active ? 1 : 0.4 }} />
                {label}
                {active && <Zap size={10} className="ml-auto" style={{ color: T.accent }} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange('reset')}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed text-[11px] font-black transition-opacity hover:opacity-80"
        style={{ borderColor: 'var(--base-300)', color: 'var(--base-content)', opacity: 0.45 }}
      >
        <RefreshCw size={12} aria-hidden="true" /> Reset Filters
      </button>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY BANNER
// ─────────────────────────────────────────────────────────────────────────────
const NearbyBanner = memo(function NearbyBanner({ count, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative overflow-hidden rounded-2xl p-4 flex items-center justify-between gap-4 mb-6"
      style={{ background: T.accentGrad }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.2)' }}
          aria-hidden="true"
        >
          <Navigation2 size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-black text-sm leading-tight">{count} doctors near you</p>
          <p className="text-white/70 text-[11px]">Based on your current location</p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss nearby banner"
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/30"
        style={{ background: 'rgba(255,255,255,0.15)' }}
      >
        <X size={13} className="text-white" />
      </button>
      <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.05)' }} />
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TRUST STATS BAR — builds social proof above fold
// ─────────────────────────────────────────────────────────────────────────────
const TrustBar = memo(function TrustBar() {
  const stats = [
    { label: 'Verified Doctors',     value: '500+', icon: BadgeCheck },
    { label: 'Specializations',      value: '12',   icon: Stethoscope },
    { label: 'Appointments Booked',  value: '10K+', icon: Activity },
    { label: 'Average Rating',       value: '4.8★', icon: Star },
  ];
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-0 border-y"
      style={{ borderColor: 'var(--base-300)' }}
    >
      {stats.map(({ label, value, icon: Icon }, i) => (
        <div
          key={label}
          className="flex flex-col items-center justify-center py-5 gap-1 text-center"
          style={{
            borderRight: i < stats.length - 1 ? `1px solid var(--base-300)` : 'none',
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center mb-1"
            style={{ background: T.accentBg }}
            aria-hidden="true"
          >
            <Icon size={14} style={{ color: T.accent }} />
          </div>
          <span className="text-[17px] font-black leading-none" style={{ color: T.accent }}>{value}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">{label}</span>
        </div>
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorsPage() {
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.user?.user) ?? null;

  const doctors               = useSelector(selectDoctors);
  const nearbyDoctors         = useSelector(selectNearbyDoctors);
  const specializationDoctors = useSelector(selectSpecializationDoctors);
  const searchResults         = useSelector(selectDoctorSearchResults);
  const total                 = useSelector(selectDoctorTotal);
  const page                  = useSelector(selectDoctorPage);
  const pages                 = useSelector(selectDoctorPages);
  const isLoadingAll          = useSelector(selectIsLoadingDoctors);

  const [searchQuery,      setSearchQuery]     = useState('');
  const [selectedSpec,     setSelectedSpec]    = useState('');
  const [showFilters,      setShowFilters]     = useState(false);
  const [showNearbyBanner, setShowNearbyBanner]= useState(false);
  const [currentPage,      setCurrentPage]    = useState(1);
  const [activeTab,        setActiveTab]       = useState('all');
  const [filters,          setFilters]         = useState({
    consultationType: '',
    rating: 0,
    sort:   '-rating.averageRating',
  });

  const searchTimer = useRef(null);
  const topRef      = useRef(null);
  const specScrollRef = useRef(null);

  // Fetch nearby on mount
  useEffect(() => {
    const coords = user?.location?.coordinates;
    if (coords && (coords[0] !== 0 || coords[1] !== 0)) {
      const [lng, lat] = coords;
      dispatch(fetchNearbyDoctors({ lat, lng, distance: 10000, limit: 6 }));
      setShowNearbyBanner(true);
    }
  }, [dispatch, user?.location?.coordinates]);

  const fetchDoctors = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      dispatch(searchDoctors({ q: searchQuery, specialization: selectedSpec || undefined, page: currentPage, limit: 12 }));
      setActiveTab('search');
    } else if (selectedSpec) {
      dispatch(fetchDoctorsBySpecialization({
        spec: selectedSpec, rating: filters.rating || undefined,
        consultationType: filters.consultationType || undefined, page: currentPage, limit: 12,
      }));
      setActiveTab('spec');
    } else {
      dispatch(fetchAllDoctors({
        rating: filters.rating || undefined, consultationType: filters.consultationType || undefined,
        sort: filters.sort || undefined, page: currentPage, limit: 12,
      }));
      setActiveTab('all');
    }
  }, [dispatch, searchQuery, selectedSpec, filters, currentPage]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const handleSearch = useCallback((val) => {
    setSearchQuery(val);
    setCurrentPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        dispatch(searchDoctors({ q: val, page: 1, limit: 12 }));
        setActiveTab('search');
      } else if (val.trim() === '') {
        fetchDoctors();
      }
    }, 350);
  }, [dispatch, fetchDoctors]);

  const handleFilterChange = useCallback((key, value) => {
    if (key === 'reset') {
      setFilters({ consultationType: '', rating: 0, sort: '-rating.averageRating' });
      setCurrentPage(1);
      return;
    }
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleSpecChange = useCallback((spec) => {
    setSelectedSpec(spec);
    setCurrentPage(1);
    setSearchQuery('');
  }, []);

  const displayedDoctors = useMemo(() => {
    if (activeTab === 'search' && searchQuery.trim().length >= 2) return searchResults;
    if (activeTab === 'spec'   && selectedSpec)                   return specializationDoctors;
    return doctors;
  }, [activeTab, searchQuery, searchResults, specializationDoctors, doctors, selectedSpec]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.consultationType) count++;
    if (filters.rating > 0) count++;
    if (filters.sort !== '-rating.averageRating') count++;
    return count;
  }, [filters]);

  return (
    <div id="main-content" style={{ background: 'var(--base-100)', minHeight: '100vh' }}>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${T.accentBgSm} 0%, var(--base-100) 100%)`,
          paddingTop: '3rem',
          paddingBottom: '2.5rem',
        }}
      >
        <div className=" absolute top-5 left-5 ">
          <BackButton label=' back to home'/>
        </div>
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--secondary) 7%, transparent)', filter: 'blur(40px)' }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: `color-mix(in srgb, var(--primary) 5%, transparent)`, filter: 'blur(32px)' }}
          aria-hidden="true"
        />

        <Container className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl mx-auto text-center mb-8"
          >
            {/* Eyebrow pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-5 border"
              style={{ background: T.accentBg, color: T.accent, borderColor: T.accentBorder }}
              aria-hidden="true"
            >
              <Stethoscope size={11} />
              Find Your Doctor
            </div>

            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-4 leading-tight"
              style={{ color: 'var(--base-content)' }}
            >
              Expert Care,{' '}
              <span
                style={{
                  background:           T.accentGrad,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor:  'transparent',
                  backgroundClip:       'text',
                }}
              >
                Right Here
              </span>
            </h1>
            <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: 'var(--base-content)', opacity: 0.55 }}>
              Connect with verified, top-rated doctors near you. Book consultations in minutes — in-person, video, or home visit.
            </p>
          </motion.div>

          {/* ── SEARCH BAR ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="max-w-2xl mx-auto"
          >
            <div
              className="flex items-center gap-2 p-2 rounded-2xl"
              style={{
                background:  'var(--base-100)',
                border:      `2px solid ${T.accentBorder}`,
                boxShadow:   `0 8px 32px ${T.accentShadow}`,
              }}
            >
              {/* Search icon */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: T.accentBg }}
                aria-hidden="true"
              >
                <Search size={16} style={{ color: T.accent }} />
              </div>

              <input
                type="search"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search doctors by name or specialization…"
                aria-label="Search doctors"
                className="flex-1 bg-transparent text-sm font-medium outline-none"
                style={{
                  color: 'var(--base-content)',
                  fontFamily: 'var(--font-family-poppins)',
                }}
              />

              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  aria-label="Clear search"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-base-200"
                >
                  <X size={13} style={{ color: 'var(--base-content)', opacity: 0.5 }} />
                </button>
              )}

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(p => !p)}
                aria-label={`Toggle filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
                aria-expanded={showFilters}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[12px] border transition-all"
                style={{
                  background:  showFilters ? T.accentBg  : 'var(--base-200)',
                  color:       showFilters ? T.accent     : 'var(--base-content)',
                  borderColor: showFilters ? T.accent     : 'var(--base-300)',
                }}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                    style={{ background: T.accent, color: 'var(--primary-content)' }}
                    aria-hidden="true"
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ── TRUST STATS ──────────────────────────────────────────────── */}
      <TrustBar />

      {/* ── SPECIALIZATION TABS ──────────────────────────────────────── */}
      <div
        className="sticky z-30 border-b"
        style={{
          top: 'var(--header-height, 72px)',
          background: 'color-mix(in srgb, var(--base-100) 94%, transparent)',
          backdropFilter: 'blur(16px)',
          borderColor: 'var(--base-300)',
        }}
      >
        <Container>
          <div
            ref={specScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto py-3 -mx-1 px-1"
            style={{ scrollbarWidth: 'none' }}
            aria-label="Filter by specialization"
            role="tablist"
          >
            {SPECIALIZATIONS.map(({ label, value, icon }) => {
              const isActive = selectedSpec === value;
              return (
                <motion.button
                  key={value}
                  onClick={() => handleSpecChange(value)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Filter by ${label}`}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all"
                  style={{
                    background:  isActive ? T.accentGrad   : 'var(--base-200)',
                    color:       isActive ? 'var(--primary-content)' : 'var(--base-content)',
                    borderColor: isActive ? 'transparent'   : 'var(--base-300)',
                    boxShadow:   isActive ? `0 4px 16px ${T.accentShadow}` : 'none',
                    opacity:     isActive ? 1 : 0.65,
                  }}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </motion.button>
              );
            })}
          </div>
        </Container>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <Container className="py-6 md:py-8" ref={topRef}>

        <AnimatePresence>
          {showNearbyBanner && nearbyDoctors.length > 0 && (
            <NearbyBanner count={nearbyDoctors.length} onDismiss={() => setShowNearbyBanner(false)} />
          )}
        </AnimatePresence>

        <div className="flex gap-6">

          {/* Filter sidebar — desktop */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 260 }}
                exit={{ opacity: 0, width: 0 }}
                className="hidden lg:block flex-shrink-0 overflow-hidden"
                aria-label="Filter panel"
              >
                <FilterPanel filters={filters} onChange={handleFilterChange} onClose={() => setShowFilters(false)} />
              </motion.aside>
            )}
          </AnimatePresence>

          <div className="flex-1 min-w-0">

            {/* Filter panel — mobile */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="lg:hidden mb-5 overflow-hidden"
                >
                  <FilterPanel filters={filters} onChange={handleFilterChange} onClose={() => setShowFilters(false)} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── RESULTS HEADER ──────────────────────────────────── */}
            <div className="flex items-center justify-between mb-5">
              <motion.div variants={fadeIn} initial="hidden" animate="show">
                {isLoadingAll ? (
                  <div className="h-5 w-40 rounded-lg skeleton" aria-hidden="true" />
                ) : (
                  <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>
                    <span className="font-black" style={{ color: T.accent }}>{total}</span>
                    {' '}doctor{total !== 1 ? 's' : ''} found
                    {selectedSpec && (
                      <span style={{ opacity: 0.4 }}> in {selectedSpec}</span>
                    )}
                  </p>
                )}
              </motion.div>

              <select
                value={filters.sort}
                onChange={e => handleFilterChange('sort', e.target.value)}
                aria-label="Sort doctors"
                className="text-[11px] font-bold rounded-xl px-3 py-2 outline-none cursor-pointer border"
                style={{
                  background:  'var(--base-200)',
                  borderColor: 'var(--base-300)',
                  color:       T.accent,
                  fontFamily:  'var(--font-family-poppins)',
                }}
              >
                {SORT_OPTIONS.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Nearby sub-section */}
            {!showNearbyBanner && nearbyDoctors.length > 0
              && activeTab === 'all' && !selectedSpec && !searchQuery && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: T.accentBg }}
                    aria-hidden="true"
                  >
                    <MapPin size={12} style={{ color: T.accent }} />
                  </div>
                  <h2 className="font-black text-sm uppercase tracking-wider" style={{ color: T.accent }}>
                    Near You
                  </h2>
                  <div className="flex-1 h-px" style={{ background: 'var(--base-300)' }} aria-hidden="true" />
                </div>
                <motion.div
                  variants={containerVar}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {nearbyDoctors.slice(0, 2).map(doc => (
                    <DoctorCard key={doc._id} doctor={doc} />
                  ))}
                </motion.div>
              </div>
            )}

            {/* ── GRID ──────────────────────────────────────────── */}
            {isLoadingAll ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : displayedDoctors.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto"
                  style={{ background: T.accentBg }}
                  aria-hidden="true"
                >
                  <Stethoscope size={32} style={{ color: T.accent, opacity: 0.6 }} />
                </div>
                <h3 className="font-black text-lg mb-2" style={{ color: 'var(--base-content)' }}>
                  No doctors found
                </h3>
                <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--base-content)', opacity: 0.5 }}>
                  Try adjusting your search or filters to find available doctors.
                </p>
                <button
                  onClick={() => { handleSearch(''); handleSpecChange(''); handleFilterChange('reset'); }}
                  className="px-6 py-2.5 rounded-xl font-black text-sm"
                  style={{ background: T.accentGrad, color: 'var(--primary-content)' }}
                >
                  Clear all filters
                </button>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`${activeTab}-${selectedSpec}-${currentPage}`}
                  variants={containerVar}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {displayedDoctors.map(doc => (
                    <DoctorCard key={doc._id} doctor={doc} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* ── PAGINATION ─────────────────────────────────────── */}
            {pages > 1 && !isLoadingAll && (
              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 mt-10"
                aria-label="Pagination"
              >
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="px-4 py-2 rounded-xl text-[12px] font-black border disabled:opacity-30 transition-all hover:border-base-content/40"
                  style={{ borderColor: 'var(--base-300)', color: 'var(--base-content)', background: 'var(--base-100)' }}
                >
                  Prev
                </button>

                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                  const isCurrentPage = p === page;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={isCurrentPage ? 'page' : undefined}
                      className="w-9 h-9 rounded-xl text-[12px] font-black border transition-all"
                      style={{
                        background:  isCurrentPage ? T.accentGrad   : 'transparent',
                        color:       isCurrentPage ? 'var(--primary-content)' : 'var(--base-content)',
                        borderColor: isCurrentPage ? 'transparent'   : 'var(--base-300)',
                        boxShadow:   isCurrentPage ? `0 4px 14px ${T.accentShadow}` : 'none',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(p => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  aria-label="Next page"
                  className="px-4 py-2 rounded-xl text-[12px] font-black border disabled:opacity-30 transition-all hover:border-base-content/40"
                  style={{ borderColor: 'var(--base-300)', color: 'var(--base-content)', background: 'var(--base-100)' }}
                >
                  Next
                </button>
              </motion.nav>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}