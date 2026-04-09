'use client';

import { useEffect, useMemo, useState, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Star, MapPin, Clock, Video, Home, Stethoscope,
  Phone, Mail, BadgeCheck, Award, Languages, Calendar,
  Activity, BookOpen, Users, TrendingUp, Shield, Heart,
  Share2, Bookmark, MessageCircle, AlertCircle,
  CheckCircle2, Building2, CreditCard, Zap, User
} from 'lucide-react';
import {
  fetchDoctorById,
  selectSelectedDoctor,
  selectIsLoadingSelectedDoctor,
  selectHospitalError,
} from '@/store/slices/hospitalSlice';

// ── Theme ──────────────────────────────────────────────────────────────────
const THEME = {
  accent:       '#4f46e5',
  accentLight:  'rgba(79,70,229,0.07)',
  accentMid:    'rgba(79,70,229,0.15)',
  gradient:     'linear-gradient(90deg,#4f46e5,#818cf8)',
  gradientFull: 'linear-gradient(135deg,#4f46e5 0%,#818cf8 100%)',
  shadow:       'rgba(79,70,229,0.25)',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtFee    = (fee) => (fee > 0 ? `₹${fee.toLocaleString('en-IN')}` : 'Free');
const fmtRating = (r)   => (r ?? 0).toFixed(1);

/**
 * Strip a leading "Dr." / "dr." from the name string so we never
 * render "Dr. Dr. Venkata …" when the user.name already contains it.
 */
const stripDrPrefix = (name = '') =>
  name.replace(/^dr\.?\s*/i, '').trim();

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── Animation variants ─────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4 } },
};
const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1, transition: { type: 'spring', damping: 20, stiffness: 260 } },
};

// ── StarRow ────────────────────────────────────────────────────────────────
const StarRow = memo(({ rating, total, large }) => (
  <div className={`flex items-center gap-${large ? 2 : 1.5}`}>
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          size={large ? 16 : 12}
          className={
            s <= Math.round(rating ?? 0)
              ? 'fill-amber-400 text-amber-400'
              : 'text-base-300'
          }
        />
      ))}
    </div>
    <span
      className={`font-black ${large ? 'text-base' : 'text-[11px]'}`}
      style={{ color: THEME.accent }}
    >
      {fmtRating(rating)}
    </span>
    {total > 0 && (
      <span className={`opacity-40 ${large ? 'text-sm' : 'text-[10px]'}`}>
        ({total} reviews)
      </span>
    )}
  </div>
));

// ── StatCard ───────────────────────────────────────────────────────────────
const StatCard = memo(({ icon: Icon, label, value, color }) => (
  <motion.div
    variants={scaleIn}
    className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-base-300 bg-base-100 text-center"
  >
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center"
      style={{ background: `${color}15` }}
    >
      <Icon size={18} style={{ color }} />
    </div>
    <p className="text-lg font-black leading-none" style={{ color }}>{value}</p>
    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</p>
  </motion.div>
));

// ── ConsultCard ─────────────────────────────────────────────────────────────
const ConsultCard = memo(({ type, fee, onBook }) => {
  const map = {
    inPerson: {
      label: 'In-Person Visit',
      desc:  'Visit the clinic',
      Icon:  Stethoscope,
      color: '#10b981',
    },
    video: {
      label: 'Video Consult',
      desc:  'Online from anywhere',
      Icon:  Video,
      color: '#4f46e5',
    },
    homeVisit: {
      label: 'Home Visit',
      desc:  'Doctor comes to you',
      Icon:  Home,
      color: '#f59e0b',
    },
  };
  const { label, desc, Icon, color } = map[type];

  return (
    <motion.div
      variants={scaleIn}
      className="relative rounded-2xl border-2 p-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{ borderColor: `${color}30`, background: `${color}08` }}
      whileHover={{ boxShadow: `0 12px 32px ${color}25`, borderColor: `${color}60` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-40">fee</p>
          <p className="text-lg font-black leading-none" style={{ color }}>{fmtFee(fee)}</p>
        </div>
      </div>
      <p className="font-black text-[13px] mb-0.5">{label}</p>
      <p className="text-[11px] opacity-40">{desc}</p>
      <button
        onClick={onBook}
        className="mt-3 w-full py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all"
        style={{ background: color, boxShadow: `0 4px 14px ${color}40` }}
      >
        Book Now
      </button>
    </motion.div>
  );
});

// ── AvailabilityGrid ────────────────────────────────────────────────────────
const AvailabilityGrid = memo(({ availability }) => {
  // JS getDay(): 0=Sun,1=Mon…6=Sat  →  map to our DAYS array (Mon-first)
  const todayName = DAYS[(new Date().getDay() + 6) % 7];

  return (
    <div className="grid grid-cols-7 gap-1">
      {DAYS.map(day => {
        const entry    = availability?.find(a => a.day === day);
        const hasSlots = (entry?.slots?.length ?? 0) > 0;
        const isToday  = day === todayName;
        return (
          <div key={day} className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-black uppercase opacity-40">
              {day.slice(0, 3)}
            </span>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center border transition-all"
              style={{
                background:  hasSlots
                  ? isToday ? THEME.gradient : THEME.accentLight
                  : 'var(--base-200)',
                borderColor: isToday && hasSlots ? THEME.accent : 'var(--base-300)',
                opacity:     hasSlots ? 1 : 0.4,
              }}
            >
              {hasSlots
                ? <CheckCircle2 size={13} style={{ color: isToday ? '#fff' : THEME.accent }} />
                : <span className="text-[9px] opacity-30">—</span>
              }
            </div>
            {isToday && (
              <span className="text-[7px] font-black uppercase" style={{ color: THEME.accent }}>
                Today
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ── QualificationList ───────────────────────────────────────────────────────
const QualificationList = memo(({ qualifications }) => {
  if (!qualifications?.length) return null;
  return (
    <div className="space-y-2">
      {qualifications.map((q, i) => (
        <motion.div
          key={i}
          variants={fadeUp}
          className="flex items-start gap-3 p-3 rounded-xl border border-base-300 bg-base-200/50"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: THEME.accentLight, color: THEME.accent }}
          >
            <BookOpen size={14} />
          </div>
          <div>
            <p className="font-black text-[13px]">{q.degree}</p>
            {q.college && <p className="text-[11px] opacity-50">{q.college}</p>}
            {q.year    && <p className="text-[10px] opacity-30">{q.year}</p>}
          </div>
        </motion.div>
      ))}
    </div>
  );
});

// ── SectionHeading ──────────────────────────────────────────────────────────
const SectionHeading = ({ children, icon: Icon }) => (
  <div className="flex items-center gap-2 mb-4">
    {Icon && (
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: THEME.accentLight }}
      >
        <Icon size={13} style={{ color: THEME.accent }} />
      </div>
    )}
    <h2 className="font-black text-[13px] uppercase tracking-wider" style={{ color: THEME.accent }}>
      {children}
    </h2>
    <div className="flex-1 h-px bg-base-300" />
  </div>
);

// ── SkeletonDetail ──────────────────────────────────────────────────────────
const SkeletonDetail = () => (
  <div className="min-h-screen">
    <div className="h-52 skeleton" />
    <div className="container-custom -mt-16 relative z-10 pb-10">
      <div className="rounded-3xl border border-base-300 bg-base-100 p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <div className="w-24 h-24 rounded-2xl skeleton flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-3/4 rounded-xl skeleton" />
            <div className="h-4 w-1/2 rounded-xl skeleton" />
            <div className="h-4 w-2/3 rounded-xl skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl skeleton" />)}
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl skeleton" />)}
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl skeleton" />)}
        </div>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DoctorDetails() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const doctor    = useSelector(selectSelectedDoctor);
  const isLoading = useSelector(selectIsLoadingSelectedDoctor);
  const error     = useSelector(selectHospitalError);

  const [activeTab, setActiveTab] = useState('about');
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    if (params?.id) dispatch(fetchDoctorById(params.id));
  }, [dispatch, params?.id]);

  // ── Derived values ─────────────────────────────────────────────────────
  // user.name may already contain "Dr." — strip it so we render exactly once
  const rawName     = doctor?.user?.name ?? '';
  const cleanName   = stripDrPrefix(rawName);
  const displayName = cleanName || 'Unknown Doctor';

  const photo = doctor?.profilePhotoUrl
    || doctor?.user?.avatar
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff`;

  // Only include consult types that are explicitly enabled in consultationTypes
  const consultTypes = useMemo(() => {
    if (!doctor) return [];
    const types = [];
    if (doctor.consultationTypes?.inPerson)
      types.push({ key: 'inPerson',  fee: doctor.fees?.inPersonFee  ?? 0 });
    if (doctor.consultationTypes?.video)
      types.push({ key: 'video',     fee: doctor.fees?.videoFee     ?? 0 });
    if (doctor.consultationTypes?.homeVisit)
      types.push({ key: 'homeVisit', fee: doctor.fees?.homeVisitFee ?? 0 });
    return types;
  }, [doctor]);

  // Stats — public API excludes the `stats` sub-document via DOCTOR_PUBLIC_EXCLUDE.
  // Fall back to rating fields that ARE returned.
  const statCards = useMemo(() => {
    if (!doctor) return [];
    return [
      {
        icon:  Users,
        label: 'Consultations',
        value: doctor.stats?.totalConsultations != null
          ? doctor.stats.totalConsultations
          : '—',
        color: THEME.accent,
      },
      {
        icon:  Star,
        label: 'Rating',
        value: fmtRating(doctor.rating?.averageRating),
        color: '#f59e0b',
      },
      {
        icon:  TrendingUp,
        label: 'Total Ratings',
        value: doctor.rating?.totalRatings ?? 0,
        color: '#10b981',
      },
      {
        icon:  Heart,
        label: 'Reviews',
        // totalReviews is a separate field from totalRatings
        value: doctor.rating?.totalReviews ?? 0,
        color: '#ef4444',
      },
    ];
  }, [doctor]);

  // Fee rows — only show rows where the consult type is enabled
  const feeRows = useMemo(() => {
    if (!doctor) return [];
    return [
      {
        label:   'In-Person Visit',
        fee:     doctor.fees?.inPersonFee  ?? 0,
        enabled: doctor.consultationTypes?.inPerson,
      },
      {
        label:   'Video Consultation',
        fee:     doctor.fees?.videoFee ?? 0,
        enabled: doctor.consultationTypes?.video,
      },
      {
        label:   'Home Visit',
        fee:     doctor.fees?.homeVisitFee ?? 0,
        enabled: doctor.consultationTypes?.homeVisit,
      },
      {
        label:   'Follow-up',
        fee:     doctor.fees?.followUpFee ?? 0,
        enabled: (doctor.fees?.followUpFee ?? 0) > 0,
      },
    ].filter(r => r.enabled);
  }, [doctor]);

  const handleBook = (type) => {
    router.push(`/book-appointment?doctor=${doctor._id}&type=${type}`);
  };

  // ── Render guards ──────────────────────────────────────────────────────
  if (isLoading) return <SkeletonDetail />;

  if (error || !doctor) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-8">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-2"
        style={{ background: THEME.accentLight }}
      >
        <AlertCircle size={36} style={{ color: THEME.accent, opacity: 0.5 }} />
      </div>
      <h2 className="font-black text-xl">Doctor not found</h2>
      <p className="text-sm opacity-50 max-w-xs">
        {error || 'This doctor profile could not be loaded.'}
      </p>
      <Link href="/doctors">
        <button
          className="px-6 py-3 rounded-xl font-black text-sm text-white mt-2"
          style={{ background: THEME.gradient }}
        >
          Back to Doctors
        </button>
      </Link>
    </div>
  );

  const tabs = [
    { key: 'about',     label: 'About'     },
    { key: 'schedule',  label: 'Schedule'  },
    { key: 'hospitals', label: 'Hospitals' },
  ];

  return (
    <main id="main-content" className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── HERO BANNER ───────────────────────────────────────────────── */}
      <div
        className="relative h-48 md:h-56 overflow-hidden"
        style={{ background: THEME.gradientFull }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full border-4 border-white" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full border-4 border-white" />
          <div className="absolute top-4 right-24 w-16 h-16 rounded-2xl border-2 border-white rotate-12" />
        </div>
        <div className="container-custom pt-4">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white font-bold text-sm transition-colors"
          >
            <ArrowLeft size={18} /> Back
          </motion.button>
        </div>
      </div>

      {/* ── PROFILE CARD ──────────────────────────────────────────────── */}
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, type: 'spring', damping: 22 }}
          className="relative -mt-20 z-10 rounded-3xl border border-base-300 bg-base-100 p-5 md:p-6 mb-6"
          style={{ boxShadow: `0 20px 60px ${THEME.shadow}` }}
        >
          <div className="flex flex-col sm:flex-row gap-4 mb-5">

            {/* Photo */}
            <div className="relative w-fit flex-shrink-0">
              <div
                className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-4"
                style={{ borderColor: THEME.accent }}
              >
                <Image
                  src={photo}
                  alt={`Dr. ${displayName}`}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                  priority
                  unoptimized
                />
              </div>
              {doctor.isOnline && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-base-100" />
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-black text-xl md:text-2xl tracking-tight leading-tight">
                      Dr. {displayName}
                    </h1>
                    {doctor.isVerified && (
                      <BadgeCheck size={20} style={{ color: THEME.accent, flexShrink: 0 }} />
                    )}
                  </div>
                  <p className="font-bold text-sm mb-1" style={{ color: THEME.accent }}>
                    {doctor.specialization}
                  </p>
                  <StarRow
                    rating={doctor.rating?.averageRating}
                    total={doctor.rating?.totalReviews}
                    large
                  />
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setSaved(p => !p)}
                    className="w-9 h-9 rounded-xl border border-base-300 flex items-center justify-center transition-all"
                    style={{
                      background: saved ? THEME.accentLight : 'var(--base-200)',
                      color:      saved ? THEME.accent       : 'inherit',
                    }}
                    aria-label="Save doctor"
                  >
                    <Bookmark size={15} className={saved ? 'fill-current' : ''} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    className="w-9 h-9 rounded-xl border border-base-300 flex items-center justify-center bg-base-200"
                    aria-label="Share profile"
                  >
                    <Share2 size={15} />
                  </motion.button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border"
                  style={{
                    background:  THEME.accentLight,
                    color:       THEME.accent,
                    borderColor: `${THEME.accent}25`,
                  }}
                >
                  <Award size={10} /> {doctor.experienceYears}y Experience
                </span>
                {doctor.partnershipStatus === 'Active' && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border"
                    style={{
                      background:  'rgba(16,185,129,0.1)',
                      color:       '#10b981',
                      borderColor: 'rgba(16,185,129,0.25)',
                    }}
                  >
                    <Shield size={10} /> Partner
                  </span>
                )}
                {doctor.isOnline && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border"
                    style={{
                      background:  'rgba(16,185,129,0.1)',
                      color:       '#10b981',
                      borderColor: 'rgba(16,185,129,0.25)',
                    }}
                  >
                    <Activity size={10} /> Online Now
                  </span>
                )}
              </div>
            </div>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {statCards.map(({ icon, label, value, color }) => (
              <StatCard key={label} icon={icon} label={label} value={value} color={color} />
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ── TAB NAV ───────────────────────────────────────────────────── */}
      <div className="sticky top-16 z-20 bg-base-100/95 backdrop-blur-md border-b border-base-300">
        <div className="container-custom">
          <div className="flex items-center">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="relative px-5 py-3.5 text-[11px] font-black uppercase tracking-wider transition-all"
                style={{
                  color:   activeTab === key ? THEME.accent : 'var(--base-content)',
                  opacity: activeTab === key ? 1 : 0.4,
                }}
              >
                {label}
                {activeTab === key && (
                  <motion.div
                    layoutId="doctor-tab-bar"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ background: THEME.gradient }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────── */}
      <div className="container-custom py-6 md:py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT — tab content */}
          <div className="flex-1 min-w-0 space-y-6">
            <AnimatePresence mode="wait">

              {/* ABOUT */}
              {activeTab === 'about' && (
                <motion.div
                  key="about"
                  initial="hidden" animate="show" exit="hidden"
                  variants={stagger}
                  className="space-y-6"
                >
                  {doctor.biography && (
                    <motion.div variants={fadeUp} className="rounded-2xl border border-base-300 bg-base-100 p-5">
                      <SectionHeading icon={User}>About Doctor</SectionHeading>
                      <p className="text-sm leading-relaxed opacity-70">{doctor.biography}</p>
                    </motion.div>
                  )}

                  {doctor.qualifications?.length > 0 && (
                    <motion.div variants={fadeUp} className="rounded-2xl border border-base-300 bg-base-100 p-5">
                      <SectionHeading icon={BookOpen}>Education</SectionHeading>
                      <QualificationList qualifications={doctor.qualifications} />
                    </motion.div>
                  )}

                  {(doctor.languagesSpoken?.length > 0 || doctor.achievements?.length > 0) && (
                    <motion.div variants={fadeUp} className="rounded-2xl border border-base-300 bg-base-100 p-5 space-y-4">
                      {doctor.languagesSpoken?.length > 0 && (
                        <div>
                          <SectionHeading icon={Languages}>Languages</SectionHeading>
                          <div className="flex flex-wrap gap-2">
                            {doctor.languagesSpoken.map(lang => (
                              <span
                                key={lang}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-bold border"
                                style={{
                                  background:  THEME.accentLight,
                                  color:       THEME.accent,
                                  borderColor: `${THEME.accent}20`,
                                }}
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {doctor.achievements?.length > 0 && (
                        <div>
                          <SectionHeading icon={Award}>Achievements</SectionHeading>
                          <ul className="space-y-1.5">
                            {doctor.achievements.map((a, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <Zap
                                  size={13}
                                  style={{ color: THEME.accent, flexShrink: 0, marginTop: 2 }}
                                />
                                <span className="opacity-70">{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* SCHEDULE */}
              {activeTab === 'schedule' && (
                <motion.div
                  key="schedule"
                  initial="hidden" animate="show" exit="hidden"
                  variants={stagger}
                  className="space-y-5"
                >
                  <motion.div variants={fadeUp} className="rounded-2xl border border-base-300 bg-base-100 p-5">
                    <SectionHeading icon={Calendar}>Weekly Availability</SectionHeading>
                    <AvailabilityGrid availability={doctor.availability} />
                  </motion.div>

                  {doctor.availability?.some(a => a.slots?.length > 0) && (
                    <motion.div variants={fadeUp} className="rounded-2xl border border-base-300 bg-base-100 p-5">
                      <SectionHeading icon={Clock}>Time Slots</SectionHeading>
                      <div className="space-y-3">
                        {doctor.availability
                          .filter(a => a.slots?.length > 0)
                          .map(a => (
                            <div key={a.day} className="flex items-start gap-3">
                              <span
                                className="flex-shrink-0 w-20 text-[11px] font-black uppercase py-1 text-center rounded-lg"
                                style={{ background: THEME.accentLight, color: THEME.accent }}
                              >
                                {a.day.slice(0, 3)}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {a.slots.map((slot, si) => (
                                  <span
                                    key={si}
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-base-300 bg-base-200"
                                  >
                                    {slot.startTime}–{slot.endTime}
                                    {slot.maxPatients > 0 && (
                                      <span className="opacity-40 ml-1">
                                        ({slot.maxPatients} slots)
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* HOSPITALS */}
              {activeTab === 'hospitals' && (
                <motion.div
                  key="hospitals"
                  initial="hidden" animate="show" exit="hidden"
                  variants={stagger}
                  className="space-y-5"
                >
                  {doctor.primaryHospital && (
                    <motion.div
                      variants={fadeUp}
                      className="rounded-2xl border-2 p-5"
                      style={{ borderColor: `${THEME.accent}30`, background: THEME.accentLight }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 size={14} style={{ color: THEME.accent }} />
                        <span
                          className="text-[10px] font-black uppercase tracking-widest"
                          style={{ color: THEME.accent }}
                        >
                          Primary Hospital
                        </span>
                      </div>

                      {typeof doctor.primaryHospital === 'object' ? (
                        <>
                          <p className="font-black text-base mb-1">
                            {doctor.primaryHospital.name}
                          </p>
                          {doctor.primaryHospital.address && (
                            <p className="text-[12px] opacity-50">
                              {[
                                doctor.primaryHospital.address.line1,
                                doctor.primaryHospital.address.line2,
                                doctor.primaryHospital.address.city,
                                doctor.primaryHospital.address.state,
                                doctor.primaryHospital.address.pincode,
                              ].filter(Boolean).join(', ')}
                            </p>
                          )}
                          {doctor.primaryHospital.contact?.phone && (
                            <a
                              href={`tel:${doctor.primaryHospital.contact.phone}`}
                              className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold"
                              style={{ color: THEME.accent }}
                            >
                              <Phone size={11} /> {doctor.primaryHospital.contact.phone}
                            </a>
                          )}
                        </>
                      ) : (
                        <p className="font-black text-base opacity-50">
                          Hospital information not loaded
                        </p>
                      )}
                    </motion.div>
                  )}

                  {doctor.otherHospitals?.length > 0 && (
                    <motion.div variants={fadeUp} className="rounded-2xl border border-base-300 bg-base-100 p-5">
                      <SectionHeading icon={Building2}>Also Available At</SectionHeading>
                      <div className="space-y-2">
                        {doctor.otherHospitals.map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200/50"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: THEME.accentLight }}
                            >
                              <Building2 size={13} style={{ color: THEME.accent }} />
                            </div>
                            <p className="font-bold text-[13px]">
                              {typeof h === 'object' ? h.name : `Hospital ${i + 1}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {!doctor.primaryHospital && !doctor.otherHospitals?.length && (
                    <motion.div
                      variants={fadeUp}
                      className="flex flex-col items-center py-10 text-center opacity-50"
                    >
                      <Building2 size={32} className="mb-3 opacity-30" />
                      <p className="text-sm font-bold">No hospital information available</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">

            {/* Book consultation */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-base-300 bg-base-100 p-5"
            >
              <SectionHeading icon={Calendar}>Book Consultation</SectionHeading>
              {consultTypes.length > 0 ? (
                <div className="space-y-3">
                  {consultTypes.map(({ key, fee }) => (
                    <ConsultCard
                      key={key}
                      type={key}
                      fee={fee}
                      onBook={() => handleBook(key)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm opacity-50 text-center py-4">
                  No consultation types available
                </p>
              )}
            </motion.div>

            {/* Contact */}
            {(doctor.contactPerson?.phone || doctor.contactPerson?.email) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-base-300 bg-base-100 p-5"
              >
                <SectionHeading icon={MessageCircle}>Contact</SectionHeading>
                <div className="space-y-2">
                  {doctor.contactPerson.phone && (
                    <a
                      href={`tel:${doctor.contactPerson.phone}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200/50 hover:bg-base-200 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: THEME.accentLight }}
                      >
                        <Phone size={13} style={{ color: THEME.accent }} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase opacity-40">Phone</p>
                        <p className="text-[12px] font-bold">{doctor.contactPerson.phone}</p>
                      </div>
                    </a>
                  )}
                  {doctor.contactPerson.email && (
                    <a
                      href={`mailto:${doctor.contactPerson.email}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200/50 hover:bg-base-200 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: THEME.accentLight }}
                      >
                        <Mail size={13} style={{ color: THEME.accent }} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase opacity-40">Email</p>
                        <p className="text-[12px] font-bold truncate">
                          {doctor.contactPerson.email}
                        </p>
                      </div>
                    </a>
                  )}
                </div>
              </motion.div>
            )}

            {/* Fee structure */}
            {feeRows.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl border border-base-300 bg-base-100 p-5"
              >
                <SectionHeading icon={CreditCard}>Fee Structure</SectionHeading>
                <div className="space-y-2">
                  {feeRows.map(({ label, fee }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-2 border-b border-base-300 last:border-0"
                    >
                      <span className="text-[12px] font-bold opacity-60">{label}</span>
                      <span
                        className="text-[13px] font-black"
                        style={{ color: THEME.accent }}
                      >
                        {fmtFee(fee)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}