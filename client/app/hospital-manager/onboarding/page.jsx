'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Image, FileText, Clock, DollarSign, Users,
  ShieldCheck, CheckCircle2, Circle, ChevronRight, Upload,
  AlertCircle, ArrowRight, Sparkles, Lock, Zap,
} from 'lucide-react';
import {
  fetchOnboarding,
  selectOnboarding,
  isLoading,
  fetchOnboarding as fetchOnboardingThunk,
} from '@/store/slices/hospitalManagerSlice';

// ─── step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    key:         'basicProfile',
    icon:        Building2,
    title:       'Basic Profile',
    description: 'Set your hospital name, description, contact info, address, and specialties.',
    action:      'Complete Profile',
    href:        '/hospital/profile',
    tip:         'A complete profile increases patient trust and search visibility.',
    color:       'var(--color-primary)',
  },
  {
    key:         'logoUploaded',
    icon:        Image,
    title:       'Upload Logo',
    description: 'Add your hospital logo and up to 20 gallery photos.',
    action:      'Upload Logo',
    href:        '/hospital/profile#media',
    tip:         'High-quality images improve click-through rates by up to 3×.',
    color:       'var(--color-chart-2)',
  },
  {
    key:         'licenseDocument',
    icon:        FileText,
    title:       'Registration Document',
    description: 'Upload your hospital license or registration document for verification.',
    action:      'Upload Document',
    href:        '/hospital/profile#documents',
    tip:         'Required for admin verification. PDF or image accepted (max 10 MB).',
    color:       'var(--color-warning)',
  },
  {
    key:         'operatingHoursSet',
    icon:        Clock,
    title:       'Operating Hours',
    description: 'Define your weekly operating schedule so patients know when you\'re open.',
    action:      'Set Hours',
    href:        '/hospital/operating-hours',
    tip:         'Patients are 2× more likely to book when hours are clearly listed.',
    color:       'var(--color-accent)',
  },
  {
    key:         'pricingConfigured',
    icon:        DollarSign,
    title:       'Consultation Pricing',
    description: 'Configure in-person, video, and home-visit fees for all linked doctors.',
    action:      'Set Pricing',
    href:        '/hospital/pricing',
    tip:         'Transparent pricing builds confidence and reduces drop-offs.',
    color:       'var(--color-success)',
  },
  {
    key:         'doctorsLinked',
    icon:        Users,
    title:       'Link Doctors',
    description: 'Search and link verified doctors to your hospital.',
    action:      'Add Doctors',
    href:        '/hospital/doctors',
    tip:         'Minimum 1 doctor required to accept patient bookings.',
    color:       'var(--color-chart-5)',
  },
  {
    key:         'verified',
    icon:        ShieldCheck,
    title:       'Admin Verification',
    description: 'Our team will review your profile and verify your hospital within 24–48 hours.',
    action:      null,
    href:        null,
    tip:         'Ensure all documents are uploaded before submitting for review.',
    color:       'var(--color-info)',
  },
];

// ─── animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideIn = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// ─── step card ────────────────────────────────────────────────────────────────

function StepCard({ step, done, index, isLast, isActive, onSelect, selected }) {
  const Icon = step.icon;
  const isSelected = selected === step.key;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      layout
    >
      <button
        onClick={() => onSelect(step.key)}
        className={`w-full text-left group relative rounded-2xl border transition-all duration-300 overflow-hidden
          ${done
            ? 'border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/5'
            : isSelected
            ? 'border-[color:var(--color-primary)]/40 bg-[color:var(--color-primary)]/5 shadow-lg shadow-[color:var(--color-primary)]/8'
            : 'border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] hover:border-[color:var(--color-primary)]/30'
          }`}
        style={{ boxShadow: isSelected ? `0 0 0 1px ${step.color}22` : undefined }}
      >
        {/* Left color accent */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300 ${done ? 'opacity-100' : isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
          style={{ background: done ? 'var(--color-success)' : step.color }}
        />

        <div className="flex items-center gap-4 p-5 pl-6">
          {/* Step number / check */}
          <div className="flex-shrink-0">
            {done ? (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-[color:var(--color-success)]/15"
              >
                <CheckCircle2 size={22} className="text-[color:var(--color-success)]" />
              </motion.div>
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-300"
                style={{
                  background: isSelected
                    ? `color-mix(in oklch, ${step.color} 18%, transparent)`
                    : 'var(--color-base-200)',
                }}
              >
                <Icon
                  size={20}
                  style={{ color: isSelected ? step.color : 'var(--color-base-content)', opacity: isSelected ? 1 : 0.5 }}
                />
              </div>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                done ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-base-content)]/40'
              }`}>
                Step {index + 1}
              </span>
              {!done && step.key === 'verified' && (
                <span className="flex items-center gap-1 text-[10px] text-[color:var(--color-info)] font-semibold">
                  <Lock size={10} /> Admin only
                </span>
              )}
            </div>
            <p className={`mt-0.5 font-bold text-xs ${
              done
                ? 'text-[color:var(--color-base-content)]/60 line-through'
                : 'text-[color:var(--color-base-content)]'
            }`}>
              {step.title}
            </p>
          </div>

          {/* Arrow */}
          <ChevronRight
            size={16}
            className={`flex-shrink-0 transition-all duration-300 ${
              isSelected
                ? 'rotate-90 text-[color:var(--color-primary)]'
                : 'text-[color:var(--color-base-content)]/25 group-hover:text-[color:var(--color-base-content)]/50'
            }`}
          />
        </div>

        {/* Expanded detail */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-5 pt-0 border-t border-[color:var(--color-base-300)]/60">
                <p className="mt-4 text-xs text-[color:var(--color-base-content)]/65 leading-relaxed">
                  {step.description}
                </p>

                {/* Tip */}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-[color:var(--color-base-200)] p-3">
                  <Sparkles size={13} className="flex-shrink-0 mt-0.5" style={{ color: step.color }} />
                  <p className="text-[10px] text-[color:var(--color-base-content)]/55 leading-relaxed">
                    {step.tip}
                  </p>
                </div>

                {step.action && step.href && !done && (
                  <a
                    href={step.href}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:opacity-90 hover:gap-3"
                    style={{ background: step.color }}
                  >
                    {step.action}
                    <ArrowRight size={14} />
                  </a>
                )}
                {done && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[color:var(--color-success)]">
                    <CheckCircle2 size={15} />
                    Completed
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Connector line */}
      {!isLast && (
        <div className="flex justify-start pl-[2.375rem] my-1">
          <div
            className="w-0.5 h-4 rounded-full transition-colors duration-500"
            style={{ background: done ? 'var(--color-success)' : 'var(--color-base-300)' }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ─── circular progress ────────────────────────────────────────────────────────

function CircularProgress({ percent, color }) {
  const r        = 54;
  const circum   = 2 * Math.PI * r;
  const dashOffset = circum * (1 - percent / 100);

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-base-300)" strokeWidth="10" />
        <motion.circle
          cx="64" cy="64" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circum}
          initial={{ strokeDashoffset: circum }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)]"
        >
          {percent}%
        </motion.span>
        <span className="text-[10px] text-[color:var(--color-base-content)]/45 font-semibold">complete</span>
      </div>
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export default function Onboarding() {
  const dispatch  = useDispatch();
  const onboarding = useSelector(selectOnboarding);
  const loading    = useSelector(isLoading(fetchOnboardingThunk));

  const [selected, setSelected] = useState(null);

  useEffect(() => {
    dispatch(fetchOnboarding());
  }, [dispatch]);

  const checklist    = onboarding?.checklist ?? {};
  const percent      = onboarding?.percentComplete ?? 0;
  const completedSteps = onboarding?.completedSteps ?? 0;
  const totalSteps   = onboarding?.totalSteps ?? STEPS.length;

  const nextPending = STEPS.find((s) => !checklist[s.key]);

  // Auto-expand the first incomplete step
  useEffect(() => {
    if (!selected && nextPending) setSelected(nextPending.key);
  }, [nextPending?.key]);

  const progressColor =
    percent === 100
      ? 'var(--color-success)'
      : percent >= 60
      ? 'var(--color-primary)'
      : 'var(--color-warning)';

  if (loading && !onboarding) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2 border-[color:var(--color-base-300)] border-t-[color:var(--color-primary)]"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-base-200)] p-2">
      {/* ── Page Header ── */}
      <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="mb-8">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-primary)]/70">
          Setup
        </span>
        <h1 className="mt-1 text-3xl lg:text-4xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)] leading-tight">
          Hospital Onboarding
        </h1>
        <p className="mt-2 text-xs text-[color:var(--color-base-content)]/55 max-w-lg">
          Complete each step to get your hospital verified and live on the Likeson Healthcare platform.
        </p>
      </motion.div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* ── Left — Steps ── */}
        <div className="xl:col-span-2 space-y-0">
          {STEPS.map((step, i) => (
            <StepCard
              key={step.key}
              step={step}
              done={!!checklist[step.key]}
              index={i}
              isLast={i === STEPS.length - 1}
              isActive={!checklist[step.key]}
              selected={selected}
              onSelect={(key) => setSelected((prev) => (prev === key ? null : key))}
            />
          ))}
        </div>

        {/* ── Right — Progress & Info ── */}
        <div className="space-y-6">

          {/* Progress Card */}
          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm"
          >
            <h3 className="text-xs font-bold text-[color:var(--color-base-content)]/60 uppercase tracking-widest mb-6">
              Overall Progress
            </h3>

            <div className="flex items-center gap-6">
              <CircularProgress percent={percent} color={progressColor} />
              <div>
                <p className="text-4xl font-black text-[color:var(--color-base-content)] font-[family-name:var(--font-display)]">
                  {completedSteps}
                  <span className="text-xl text-[color:var(--color-base-content)]/35">/{totalSteps}</span>
                </p>
                <p className="text-xs text-[color:var(--color-base-content)]/50 mt-1">steps completed</p>

                {percent < 100 && nextPending && (
                  <div className="mt-3 flex items-start gap-2 text-[10px] text-[color:var(--color-warning)] font-semibold">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                    Next: {nextPending.title}
                  </div>
                )}
                {percent === 100 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-3 flex items-center gap-2 text-[10px] font-bold text-[color:var(--color-success)]"
                  >
                    <CheckCircle2 size={14} />
                    All steps done!
                  </motion.div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 w-full h-2 bg-[color:var(--color-base-200)] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: progressColor }}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-[color:var(--color-base-content)]/40">0%</span>
              <span className="text-[10px] text-[color:var(--color-base-content)]/40">100%</span>
            </div>
          </motion.div>

          {/* Step Checklist Mini */}
          <motion.div
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm"
          >
            <h3 className="text-xs font-bold text-[color:var(--color-base-content)]/60 uppercase tracking-widest mb-4">
              Checklist
            </h3>
            <div className="space-y-2.5">
              {STEPS.map((step) => {
                const done = !!checklist[step.key];
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.key}
                    variants={slideIn}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center gap-3"
                  >
                    {done ? (
                      <CheckCircle2 size={16} className="flex-shrink-0 text-[color:var(--color-success)]" />
                    ) : (
                      <Circle size={16} className="flex-shrink-0 text-[color:var(--color-base-content)]/25" />
                    )}
                    <span className={`text-xs ${done ? 'text-[color:var(--color-base-content)]/40 line-through' : 'text-[color:var(--color-base-content)]'}`}>
                      {step.title}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* CTA Card */}
          {percent > 0 && percent < 100 && (
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              }}
            >
              {/* decorative circles */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-white/5" />

              <div className="relative p-6">
                <Zap size={22} className="text-white/80 mb-3" />
                <p className="text-white font-black text-lg font-[family-name:var(--font-display)] leading-snug">
                  Almost there!
                </p>
                <p className="text-white/70 text-xs mt-1 mb-4">
                  Complete {totalSteps - completedSteps} more step{totalSteps - completedSteps > 1 ? 's' : ''} to go live on the platform.
                </p>
                {nextPending?.href && (
                  <a
                    href={nextPending.href}
                    className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200"
                  >
                    Continue Setup <ArrowRight size={14} />
                  </a>
                )}
              </div>
            </motion.div>
          )}

          {percent === 100 && (
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="rounded-2xl overflow-hidden relative"
              style={{ background: 'linear-gradient(135deg, var(--color-success), var(--color-accent))' }}
            >
              <div className="relative p-6">
                <CheckCircle2 size={22} className="text-white/90 mb-3" />
                <p className="text-white font-black text-lg font-[family-name:var(--font-display)]">
                  Onboarding Complete!
                </p>
                <p className="text-white/75 text-xs mt-1">
                  Your profile is under admin review. You'll be notified within 24–48 hours.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}