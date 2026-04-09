'use client';

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Star, X, Video,
  Home, Stethoscope, Users, SlidersHorizontal, RefreshCw,
  Navigation2, Zap, Award, Languages, ArrowRight, BadgeCheck, Activity
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
  selectIsLoadingNearbyDoctors,
} from '@/store/slices/hospitalSlice';

// ── Theme ──────────────────────────────────────────────────────────────────
const THEME = {
  accent:      '#4f46e5',
  accentLight: 'rgba(79,70,229,0.07)',
  accentMid:   'rgba(79,70,229,0.15)',
  gradient:    'linear-gradient(90deg,#4f46e5,#818cf8)',
  gradientFull:'linear-gradient(135deg,#4f46e5 0%,#818cf8 100%)',
  shadow:      'rgba(79,70,229,0.35)',
};

// ── Specializations ────────────────────────────────────────────────────────
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
  { label: 'Top Rated',   value: '-rating.averageRating' },
  { label: 'Experience',  value: '-experienceYears'      },
  { label: 'Newest',      value: '-createdAt'            },
  { label: 'Lowest Fee',  value: 'fees.inPersonFee'      },
];

const CONSULT_TYPES = [
  { label: 'In-Person', value: 'inPerson',  icon: Stethoscope },
  { label: 'Video',     value: 'video',     icon: Video       },
  { label: 'Home Visit',value: 'homeVisit', icon: Home        },
];

// ── Animation variants ─────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show:   { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 20, stiffness: 260 } },
  exit:   { opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.18 } },
};
const fadeSlide = {
  hidden: { opacity: 0, x: -10 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtFee    = (fee) => fee > 0 ? `₹${fee.toLocaleString('en-IN')}` : 'Free';
const fmtRating = (r)   => (r ?? 0).toFixed(1);

/**
 * Strip a leading "Dr." / "dr." prefix so the card's own "Dr." label
 * never produces "Dr. Dr. Venkata …"
 */
const stripDrPrefix = (name = '') => name.replace(/^dr\.?\s*/i, '').trim();

// ── StarRow ────────────────────────────────────────────────────────────────
const StarRow = memo(({ rating, total }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          size={12}
          className={s <= Math.round(rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-base-300'}
        />
      ))}
    </div>
    <span className="text-[11px] font-bold" style={{ color: THEME.accent }}>
      {fmtRating(rating)}
    </span>
    {total > 0 && (
      <span className="text-[10px] opacity-40">({total})</span>
    )}
  </div>
));

// ── ConsultBadge ───────────────────────────────────────────────────────────
const ConsultBadge = memo(({ type }) => {
  const map = {
    inPerson:  { Icon: Stethoscope, label: 'In-Person', color: '#10b981' },
    video:     { Icon: Video,       label: 'Video',     color: '#4f46e5' },
    homeVisit: { Icon: Home,        label: 'Home',      color: '#f59e0b' },
  };
  const { Icon, label, color } = map[type];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border"
      style={{ background: `${color}12`, color, borderColor: `${color}25` }}
    >
      <Icon size={9} /> {label}
    </span>
  );
});

// ── DoctorCard ─────────────────────────────────────────────────────────────
const DoctorCard = memo(function DoctorCard({ doctor }) {
  const {
    _id, profilePhotoUrl, isOnline, isVerified, specialization,
    experienceYears, rating, fees, consultationTypes,
    languagesSpoken, availability, user: doctorUser,
  } = doctor;

  // user.name may already contain "Dr." prefix — strip before re-adding
  const cleanName   = stripDrPrefix(doctorUser?.name ?? '');
  const displayName = cleanName || 'Unknown Doctor';

  // Always prefer profilePhotoUrl → user.avatar → generated avatar
  const photo = profilePhotoUrl
    || doctorUser?.avatar
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff`;

  // unoptimized only for ui-avatars (external, no Next.js image domain config needed)
  const isGeneratedAvatar = photo.includes('ui-avatars.com');

  // Only include enabled consult types
  const consultTypes = useMemo(() => {
    const types = [];
    if (consultationTypes?.inPerson)  types.push('inPerson');
    if (consultationTypes?.video)     types.push('video');
    if (consultationTypes?.homeVisit) types.push('homeVisit');
    return types;
  }, [consultationTypes]);

  // Lowest fee across enabled types only
  const lowestFee = useMemo(() => {
    const vals = [];
    if (consultationTypes?.inPerson  && fees?.inPersonFee  > 0) vals.push(fees.inPersonFee);
    if (consultationTypes?.video     && fees?.videoFee     > 0) vals.push(fees.videoFee);
    if (consultationTypes?.homeVisit && fees?.homeVisitFee > 0) vals.push(fees.homeVisitFee);
    return vals.length > 0 ? Math.min(...vals) : 0;
  }, [fees, consultationTypes]);

  // Today's availability
  const todayAvail = useMemo(() => {
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    return availability?.find(a => a.day === day);
  }, [availability]);

  // stats is excluded from public API — show rating count as a proxy
  const ratingCount = rating?.totalRatings ?? 0;

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="group relative rounded-2xl border bg-base-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{ borderColor: 'var(--base-300)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
      whileHover={{ boxShadow: `0 16px 40px ${THEME.shadow}`, borderColor: THEME.accent }}
    >
      {/* Hover top stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: THEME.gradient }}
      />

      <Link href={`/doctors/${_id}`} className="block p-4">

        {/* Header row */}
        <div className="flex items-start gap-3.5 mb-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden border-2"
              style={{ borderColor: isOnline ? '#10b981' : 'var(--base-300)' }}
            >
              <Image
                src={photo}
                alt={`Dr. ${displayName}`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
                unoptimized={isGeneratedAvatar}
              />
            </div>
            {isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-base-100" />
              </span>
            )}
          </div>

          {/* Name / spec / fee */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-[14px] truncate leading-tight">
                    Dr. {displayName}
                  </h3>
                  {isVerified && (
                    <BadgeCheck size={14} style={{ color: THEME.accent, flexShrink: 0 }} />
                  )}
                </div>
                <p className="text-[11px] font-bold truncate" style={{ color: THEME.accent }}>
                  {specialization}
                </p>
              </div>
              {/* Fee badge */}
              <div
                className="flex-shrink-0 px-2.5 py-1 rounded-xl text-center"
                style={{ background: THEME.accentLight }}
              >
                <p className="text-[8px] font-black uppercase tracking-widest opacity-50 leading-none">from</p>
                <p className="text-[13px] font-black leading-tight" style={{ color: THEME.accent }}>
                  {fmtFee(lowestFee)}
                </p>
              </div>
            </div>
            {/* Use totalReviews for review count display */}
            <StarRow rating={rating?.averageRating} total={rating?.totalReviews ?? 0} />
          </div>
        </div>

        {/* Stats row */}
        <div
          className="flex items-center gap-3 mb-3 py-2.5 rounded-xl px-3"
          style={{ background: THEME.accentLight }}
        >
          <div className="flex items-center gap-1.5">
            <Award size={12} style={{ color: THEME.accent }} />
            <span className="text-[11px] font-black">{experienceYears}y exp</span>
          </div>
          <div className="w-px h-4 bg-base-300" />
          {/* stats excluded from public API — show totalRatings as activity proxy */}
          <div className="flex items-center gap-1.5">
            <Users size={12} style={{ color: THEME.accent }} />
            <span className="text-[11px] font-black">
              {ratingCount > 0 ? `${ratingCount} ratings` : 'New'}
            </span>
          </div>
          {todayAvail?.slots?.length > 0 && (
            <>
              <div className="w-px h-4 bg-base-300" />
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-green-500" />
                <span className="text-[11px] font-black text-green-600">Available today</span>
              </div>
            </>
          )}
        </div>

        {/* Consult type badges */}
        {consultTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {consultTypes.map(t => <ConsultBadge key={t} type={t} />)}
          </div>
        )}

        {/* Languages */}
        {languagesSpoken?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Languages size={11} className="opacity-40" />
            <span className="text-[10px] opacity-40 font-medium">
              {languagesSpoken.slice(0, 3).join(' · ')}
            </span>
          </div>
        )}
      </Link>

      {/* CTA footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-t"
        style={{ borderColor: 'var(--base-300)', background: 'var(--base-200)' }}
      >
        <Link
          href={`/doctors/${_id}`}
          className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
          style={{ color: THEME.accent }}
        >
          View Profile <ArrowRight size={11} />
        </Link>
        <Link href={`/book-appointment?doctor=${_id}`}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white"
            style={{ background: THEME.gradient }}
          >
            Book Now
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
});

// ── SkeletonCard ───────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="rounded-2xl border border-base-300 bg-base-100 p-4 space-y-3">
    <div className="flex gap-3.5">
      <div className="w-16 h-16 rounded-2xl skeleton" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded-lg skeleton" />
        <div className="h-3 w-1/2 rounded-lg skeleton" />
        <div className="h-3 w-2/3 rounded-lg skeleton" />
      </div>
    </div>
    <div className="h-10 rounded-xl skeleton" />
    <div className="flex gap-2">
      <div className="h-5 w-16 rounded-full skeleton" />
      <div className="h-5 w-16 rounded-full skeleton" />
    </div>
  </div>
);

// ── FilterPanel ────────────────────────────────────────────────────────────
const FilterPanel = memo(function FilterPanel({ filters, onChange, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="rounded-2xl border border-base-300 bg-base-100 p-5 space-y-5 sticky top-24"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: THEME.accent }}>
          Filters
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-base-200 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Consultation type */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Consultation</p>
        <div className="space-y-1.5">
          {CONSULT_TYPES.map(({ label, value, icon: Icon }) => (
            <label key={value} className="flex items-center gap-2.5 cursor-pointer">
              <div
                className="w-4 h-4 rounded flex items-center justify-center border-2 transition-all"
                style={{
                  borderColor: filters.consultationType === value ? THEME.accent : 'var(--base-300)',
                  background:  filters.consultationType === value ? THEME.accentLight : 'transparent',
                }}
                onClick={() => onChange('consultationType', filters.consultationType === value ? '' : value)}
              >
                {filters.consultationType === value && (
                  <div className="w-2 h-2 rounded-sm" style={{ background: THEME.accent }} />
                )}
              </div>
              <Icon
                size={12}
                style={{
                  color:   filters.consultationType === value ? THEME.accent : 'var(--base-content)',
                  opacity: filters.consultationType === value ? 1 : 0.4,
                }}
              />
              <span
                className="text-[12px] font-bold"
                style={{ color: filters.consultationType === value ? THEME.accent : 'inherit' }}
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Min rating */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Min Rating</p>
        <div className="flex gap-1.5">
          {[0, 3, 4, 4.5].map(r => (
            <button
              key={r}
              onClick={() => onChange('rating', filters.rating === r ? 0 : r)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-black border transition-all"
              style={{
                borderColor: filters.rating === r ? THEME.accent : 'var(--base-300)',
                background:  filters.rating === r ? THEME.accentLight : 'transparent',
                color:       filters.rating === r ? THEME.accent : 'inherit',
              }}
            >
              {r === 0 ? 'Any' : `${r}★`}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Sort By</p>
        <div className="space-y-1">
          {SORT_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onChange('sort', value)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold border transition-all"
              style={{
                borderColor: filters.sort === value ? THEME.accent : 'transparent',
                background:  filters.sort === value ? THEME.accentLight : 'var(--base-200)',
                color:       filters.sort === value ? THEME.accent : 'inherit',
              }}
            >
              {label}
              {filters.sort === value && <Zap size={10} style={{ color: THEME.accent }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange('reset')}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-base-300 text-[11px] font-black opacity-40 hover:opacity-80 transition-opacity"
      >
        <RefreshCw size={12} /> Reset Filters
      </button>
    </motion.div>
  );
});

// ── NearbyBanner ───────────────────────────────────────────────────────────
const NearbyBanner = memo(function NearbyBanner({ count, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative overflow-hidden rounded-2xl p-4 flex items-center justify-between gap-4 mb-6"
      style={{ background: THEME.gradient }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Navigation2 size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-black text-sm leading-tight">{count} doctors near you</p>
          <p className="text-white/70 text-[11px]">Based on your current location</p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 hover:bg-white/30 transition-colors"
      >
        <X size={13} className="text-white" />
      </button>
      <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -right-2 -bottom-4 w-12 h-12 rounded-full bg-white/5 pointer-events-none" />
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
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

  const [searchQuery,      setSearchQuery]      = useState('');
  const [selectedSpec,     setSelectedSpec]      = useState('');
  const [showFilters,      setShowFilters]       = useState(false);
  const [showNearbyBanner, setShowNearbyBanner]  = useState(false);
  const [currentPage,      setCurrentPage]       = useState(1);
  const [activeTab,        setActiveTab]         = useState('all');
  const [filters,          setFilters]           = useState({
    consultationType: '',
    rating: 0,
    sort:   '-rating.averageRating',
  });

  const searchTimer = useRef(null);
  const topRef      = useRef(null);

  // ── Fetch nearby on mount if location available ─────────────────────────
  useEffect(() => {
    const coords = user?.location?.coordinates;
    // coords = [lng, lat]; skip if default [0,0]
    if (coords && (coords[0] !== 0 || coords[1] !== 0)) {
      const [lng, lat] = coords;
      dispatch(fetchNearbyDoctors({ lat, lng, distance: 10000, limit: 6 }));
      setShowNearbyBanner(true);
    }
  }, [dispatch, user?.location?.coordinates]);

  // ── Main fetch ──────────────────────────────────────────────────────────
  const fetchDoctors = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      dispatch(searchDoctors({
        q:              searchQuery,
        specialization: selectedSpec || undefined,
        page:           currentPage,
        limit:          12,
      }));
      setActiveTab('search');
    } else if (selectedSpec) {
      dispatch(fetchDoctorsBySpecialization({
        spec:             selectedSpec,
        rating:           filters.rating           || undefined,
        consultationType: filters.consultationType || undefined,
        page:             currentPage,
        limit:            12,
      }));
      setActiveTab('spec');
    } else {
      dispatch(fetchAllDoctors({
        rating:           filters.rating           || undefined,
        consultationType: filters.consultationType || undefined,
        sort:             filters.sort             || undefined,
        page:             currentPage,
        limit:            12,
      }));
      setActiveTab('all');
    }
  }, [dispatch, searchQuery, selectedSpec, filters, currentPage]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  // ── Search debounce ─────────────────────────────────────────────────────
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

  // ── Displayed list ──────────────────────────────────────────────────────
  const displayedDoctors = useMemo(() => {
    if (activeTab === 'search' && searchQuery.trim().length >= 2) return searchResults;
    if (activeTab === 'spec'   && selectedSpec)                   return specializationDoctors;
    return doctors;
  }, [activeTab, searchQuery, searchResults, specializationDoctors, doctors, selectedSpec]);

  return (
    <main id="main-content" className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-12 md:py-16"
        style={{ background: `linear-gradient(180deg, ${THEME.accentLight} 0%, transparent 100%)` }}
      >
        <div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(129,140,248,0.12)' }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(79,70,229,0.08)' }}
        />

        <div className="container-custom relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center mb-8"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border"
              style={{ background: THEME.accentLight, color: THEME.accent, borderColor: `${THEME.accent}25` }}
            >
              <Stethoscope size={11} /> Find Your Doctor
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-3">
              Expert Care,{' '}
              <span
                style={{
                  background:             THEME.gradient,
                  WebkitBackgroundClip:   'text',
                  WebkitTextFillColor:    'transparent',
                  backgroundClip:         'text',
                }}
              >
                Right Here
              </span>
            </h1>
            <p className="text-sm opacity-60 max-w-md mx-auto">
              Connect with top-rated doctors near you. Book consultations in minutes.
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-2xl mx-auto"
          >
            <div
              className="flex items-center gap-3 p-2 rounded-2xl border-2 bg-base-100 shadow-lg"
              style={{ borderColor: `${THEME.accent}30` }}
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: THEME.accentLight }}
              >
                <Search size={16} style={{ color: THEME.accent }} />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search doctors by name or specialization…"
                className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:opacity-30"
                aria-label="Search doctors"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-base-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={() => setShowFilters(p => !p)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[12px] border transition-all"
                style={{
                  background:  showFilters ? THEME.accentLight : 'var(--base-200)',
                  color:       showFilters ? THEME.accent       : 'inherit',
                  borderColor: showFilters ? `${THEME.accent}40` : 'var(--base-300)',
                }}
                aria-label="Toggle filters"
              >
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SPECIALIZATION TABS ─────────────────────────────────────── */}
      <section className="border-b border-base-300 sticky top-[64px] z-30 bg-base-100/95 backdrop-blur-md">
        <div className="container-custom">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-3 -mx-1 px-1">
            {SPECIALIZATIONS.map(({ label, value, icon }) => {
              const isActive = selectedSpec === value;
              return (
                <motion.button
                  key={value}
                  onClick={() => handleSpecChange(value)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all"
                  style={{
                    background:  isActive ? THEME.gradient   : 'var(--base-200)',
                    color:       isActive ? '#fff'            : 'var(--base-content)',
                    borderColor: isActive ? 'transparent'     : 'var(--base-300)',
                    boxShadow:   isActive ? `0 4px 16px ${THEME.shadow}` : 'none',
                    opacity:     isActive ? 1 : 0.7,
                  }}
                >
                  <span>{icon}</span>
                  {label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="container-custom py-6 md:py-8" ref={topRef}>

        <AnimatePresence>
          {showNearbyBanner && nearbyDoctors.length > 0 && (
            <NearbyBanner
              count={nearbyDoctors.length}
              onDismiss={() => setShowNearbyBanner(false)}
            />
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
              >
                <FilterPanel
                  filters={filters}
                  onChange={handleFilterChange}
                  onClose={() => setShowFilters(false)}
                />
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
                  <FilterPanel
                    filters={filters}
                    onChange={handleFilterChange}
                    onClose={() => setShowFilters(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results header */}
            <div className="flex items-center justify-between mb-5">
              <motion.div variants={fadeSlide} initial="hidden" animate="show">
                {isLoadingAll ? (
                  <div className="h-5 w-40 rounded-lg skeleton" />
                ) : (
                  <p className="text-sm font-bold">
                    <span className="font-black" style={{ color: THEME.accent }}>{total}</span>
                    {' '}doctor{total !== 1 ? 's' : ''} found
                    {selectedSpec && <span className="opacity-40"> in {selectedSpec}</span>}
                  </p>
                )}
              </motion.div>

              <select
                value={filters.sort}
                onChange={e => handleFilterChange('sort', e.target.value)}
                className="text-[11px] font-bold border border-base-300 rounded-xl px-3 py-2 bg-base-200 outline-none"
                style={{ color: THEME.accent }}
                aria-label="Sort doctors"
              >
                {SORT_OPTIONS.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Nearby sub-section (after banner dismissed) */}
            {!showNearbyBanner && nearbyDoctors.length > 0
              && activeTab === 'all' && !selectedSpec && !searchQuery && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin size={15} style={{ color: THEME.accent }} />
                  <h2
                    className="font-black text-sm uppercase tracking-wider"
                    style={{ color: THEME.accent }}
                  >
                    Near You
                  </h2>
                  <div className="flex-1 h-px bg-base-300" />
                </div>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {nearbyDoctors.slice(0, 3).map(doc => (
                    <DoctorCard key={doc._id} doctor={doc} />
                  ))}
                </motion.div>
              </div>
            )}

            {/* Main grid */}
            {isLoadingAll ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : displayedDoctors.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto"
                  style={{ background: THEME.accentLight }}
                >
                  <Stethoscope size={32} style={{ color: THEME.accent, opacity: 0.6 }} />
                </div>
                <h3 className="font-black text-lg mb-2">No doctors found</h3>
                <p className="text-sm opacity-50 mb-5 max-w-xs">
                  Try adjusting your search or filters to find available doctors.
                </p>
                <button
                  onClick={() => {
                    handleSearch('');
                    handleSpecChange('');
                    handleFilterChange('reset');
                  }}
                  className="px-6 py-2.5 rounded-xl font-black text-sm text-white"
                  style={{ background: THEME.gradient }}
                >
                  Clear all filters
                </button>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`${activeTab}-${selectedSpec}-${currentPage}`}
                  variants={containerVariants}
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

            {/* Pagination */}
            {pages > 1 && !isLoadingAll && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 mt-8"
              >
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-xl text-[12px] font-black border border-base-300 disabled:opacity-30 hover:border-base-content/40 transition-all"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className="w-9 h-9 rounded-xl text-[12px] font-black border transition-all"
                      style={{
                        background:  p === page ? THEME.gradient  : 'transparent',
                        color:       p === page ? '#fff'          : 'inherit',
                        borderColor: p === page ? 'transparent'   : 'var(--base-300)',
                        boxShadow:   p === page ? `0 4px 14px ${THEME.shadow}` : 'none',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-4 py-2 rounded-xl text-[12px] font-black border border-base-300 disabled:opacity-30 hover:border-base-content/40 transition-all"
                >
                  Next
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}