'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Shield, Eye, Lock, Database, Globe, UserCheck,
  ChevronRight, ChevronDown, Clock, FileText,
  CheckCircle2, AlertCircle, ArrowUp, Wifi,
} from 'lucide-react';

import {
  fetchActivePrivacyPolicy,
  recordConsent,
  fetchConsentStatus,
  selectActivePrivacy,
  selectPrivacyLoading,
  selectConsentStatus,
  selectConsentSubmitting,
} from '@/store/slices/legalSlice';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Static sections from schema ───────────────────────────────────────────────
const STATIC_SECTIONS = [
  {
    id: 'collect',
    icon: Database,
    title: 'Data We Collect',
    color: 'var(--primary)',
    content: `We collect information you voluntarily provide (name, email, phone, address) and data generated 
through platform use (booking history, location for dispatch, device tokens for push notifications). 
Sensitive fields — Aadhaar, PAN, bank account numbers — are stored encrypted with select:false 
and returned only when explicitly required by verified roles.`,
  },
  {
    id: 'usage',
    icon: Eye,
    title: 'How We Use Your Data',
    color: 'var(--secondary)',
    content: `Your data powers service delivery: matching patients to nearby doctors, dispatching GPS-tracked 
transport, calculating lab turnaround times, and processing pharmacy orders. We also use aggregated 
analytics (never individually identifiable) to improve platform performance, pricing models, and 
partner matching algorithms.`,
  },
  {
    id: 'sharing',
    icon: Globe,
    title: 'Data Sharing',
    color: 'oklch(55% 0.22 275)',
    content: `We share your data only with service partners relevant to your booking (e.g., the lab processing 
your sample, the driver assigned to your ride). Partners receive only what they need. We do not sell 
personal data. Payment gateways (Razorpay, Cashfree) receive tokenized payment data under their own 
privacy frameworks.`,
  },
  {
    id: 'security',
    icon: Lock,
    title: 'Security Measures',
    color: 'oklch(50% 0.20 155)',
    content: `Account passwords are hashed with bcrypt. Sensitive documents (Aadhaar, bank accounts) are 
select:false in MongoDB — requiring explicit projection to access. OTPs expire after a defined 
window. Audit sessions track every device login with IP and user-agent. Platform fees and pricing 
configs maintain immutable version history for forensic accountability.`,
  },
  {
    id: 'rights',
    icon: UserCheck,
    title: 'Your Rights (GDPR / PDPA)',
    color: 'oklch(58% 0.18 300)',
    content: `You may request access to, correction of, or deletion of your personal data at any time. 
Consent records (UserConsent) are never deleted — withdrawals are marked isWithdrawn:true with a 
timestamp and reason. You may withdraw consent via your account settings or by contacting our 
Data Protection Officer at dpo@likeson.in.`,
  },
  {
    id: 'retention',
    icon: Clock,
    title: 'Data Retention',
    color: 'oklch(62% 0.20 22)',
    content: `Active account data is retained for the duration of your relationship with Likeson.in plus 
7 years for regulatory compliance. Consent audit logs are retained indefinitely as legal proof. 
Anonymised analytics data may be retained beyond this period. KYC documents are purged upon 
account deletion subject to mandatory regulatory hold periods.`,
  },
  {
    id: 'cookies',
    icon: Wifi,
    title: 'Cookies & Tracking',
    color: 'oklch(68% 0.16 50)',
    content: `We use strictly necessary cookies for session management and device token tracking. 
No third-party advertising cookies are placed. Location tracking occurs only while a ride is active 
and with explicit permission. Push notification tokens (FCM) are stored per-device and may be 
revoked by removing the device from your account sessions.`,
  },
];

const DATA_CATEGORIES = [
  { cat: 'Identity',   examples: 'Name, email, phone, Aadhaar (encrypted), PAN',    roles: 'All' },
  { cat: 'Location',   examples: 'GPS coordinates, last known address, service zone', roles: 'Customers, Drivers, CAs' },
  { cat: 'Financial',  examples: 'Bank account last-4, UPI ID, settlement records',  roles: 'Partners' },
  { cat: 'Health',     examples: 'Booking history, lab results, care assistant notes', roles: 'Customers' },
  { cat: 'Device',     examples: 'FCM tokens, IP address, user-agent, audit sessions', roles: 'All' },
  { cat: 'Behavioural',examples: 'Coin transactions, referral history, rating patterns', roles: 'All' },
];

// ── Accordion ─────────────────────────────────────────────────────────────────
function Accordion({ section, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const { icon: Icon, title, color, content } = section;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-5 text-left group"
        aria-expanded={open}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{ background: `color-mix(in srgb, ${color}, transparent 82%)`, border: `1px solid color-mix(in srgb, ${color}, transparent 55%)` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <span className="font-montserrat font-black text-sm text-base-content flex-1">{title}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown size={16} style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 pt-1">
              <div className="divider mt-0 mb-4" />
              <p className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: 'color-mix(in oklch, var(--base-content) 72%, transparent)' }}>
                {content}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Consent Banner ────────────────────────────────────────────────────────────
function ConsentBanner({ status, submitting, onAccept }) {
  if (status?.privacyAccepted) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
      >
        <div
          className="rounded-2xl p-5 shadow-primary"
          style={{
            background: 'var(--base-100)',
            border: '1px solid color-mix(in srgb, var(--primary), transparent 60%)',
            boxShadow: 'var(--shadow-depth)',
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle size={18} style={{ color: 'var(--warning)' }} className="shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed text-base-content">
              We updated our Privacy Policy. Please review and accept to continue using Likeson.in.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onAccept}
              disabled={submitting}
              className="btn-primary-cta flex-1 text-center"
              style={{ fontSize: '0.8rem', padding: '0.6rem 1rem' }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner w-4 h-4 animate-spin" /> Saving…
                </span>
              ) : (
                <>I Accept <CheckCircle2 size={13} className="inline ml-1" /></>
              )}
            </button>
            <a href="/legal/terms" className="btn-secondary flex-1 text-center text-xs py-2.5">
              View Terms
            </a>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Back to Top ───────────────────────────────────────────────────────────────
function BackToTop() {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const h = () => setVis(window.scrollY > 500);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  if (!vis) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-primary transition-transform hover:scale-110"
      style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
      aria-label="Back to top"
    >
      <ArrowUp size={16} />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PrivacyPolicyPage() {
  const dispatch   = useDispatch();
  const policy     = useSelector(selectActivePrivacy);
  const loading    = useSelector(selectPrivacyLoading);
  const status     = useSelector(selectConsentStatus);
  const submitting = useSelector(selectConsentSubmitting);

  const headerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: headerRef, offset: ['start start', 'end start'] });
  const headerY   = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const headerOpa = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Progress bar
  const { scrollYProgress: pageProgress } = useScroll();
  const progressWidth = useTransform(pageProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    dispatch(fetchActivePrivacyPolicy());
    dispatch(fetchConsentStatus());
  }, [dispatch]);

  const handleAccept = () =>
    dispatch(recordConsent({ method: 'explicit_checkbox', platform: 'web' }));

  return (
    <main className="min-h-screen bg-base-100">

      {/* Progress bar */}
      <motion.div
        className="fixed top-0 left-0 h-[3px] z-[100] origin-left"
        style={{ width: progressWidth, background: 'var(--primary)' }}
      />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <section
        ref={headerRef}
        className="relative py-28 md:py-36 overflow-hidden"
        style={{ background: 'linear-gradient(150deg, color-mix(in srgb, var(--primary) 85%, var(--base-100)) 0%, var(--base-200) 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--base-content) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <motion.div
          style={{ y: headerY, opacity: headerOpa }}
          className="container-custom relative z-10 text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55 }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-primary"
            style={{ background: 'var(--primary)' }}
          >
            <Shield size={28} color="#fff" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="font-montserrat font-black text-base-content mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            Privacy <span className="text-gradient-primary">Policy</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="flex flex-wrap items-center justify-center gap-4 text-xs"
            style={{ color: 'color-mix(in oklch, var(--base-content) 62%, transparent)' }}
          >
            {loading ? (
              <span className="skeleton h-4 w-40 rounded" />
            ) : policy ? (
              <>
                <span className="badge badge-primary">v{policy.version}</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={12} /> Effective {formatDate(policy.effectiveDate)}
                </span>
                {policy.publishedAt && (
                  <span className="flex items-center gap-1.5">
                    <FileText size={12} /> Published {formatDate(policy.publishedAt)}
                  </span>
                )}
              </>
            ) : (
              <span>Loading policy…</span>
            )}
          </motion.div>

          {policy?.summary && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.28 }}
              className="mt-5 max-w-xl mx-auto text-sm leading-relaxed"
              style={{ color: 'color-mix(in oklch, var(--base-content) 68%, transparent)' }}
            >
              {policy.summary}
            </motion.p>
          )}
        </motion.div>
      </section>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div className="container-custom py-16 max-w-4xl mx-auto">

        {/* Compliance badges */}
        {policy?.complianceFrameworks?.length > 0 && (
          <motion.div
            variants={stagger} initial="hidden" animate="show"
            className="flex flex-wrap gap-2 mb-10"
          >
            {policy.complianceFrameworks.map((f, i) => (
              <motion.span key={f} variants={fadeUp} custom={i} className="badge badge-info">
                <Globe size={10} /> {f}
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* Dynamic content from DB (if exists) */}
        {policy?.content && (
          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={0}
            className="card p-6 mb-8"
          >
            <h2 className="font-montserrat font-black text-base-content mb-3 flex items-center gap-2">
              <FileText size={16} style={{ color: 'var(--primary)' }} />
              Full Policy Text
            </h2>
            <div
              className="text-sm leading-relaxed prose prose-sm max-w-none"
              style={{ color: 'color-mix(in oklch, var(--base-content) 72%, transparent)' }}
              dangerouslySetInnerHTML={{ __html: policy.content.replace(/\n/g, '<br/>') }}
            />
          </motion.div>
        )}

        {/* Static accordion sections */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="flex flex-col gap-3 mb-12"
        >
          <motion.h2 variants={fadeUp} custom={0}
            className="font-montserrat font-black text-base-content mb-2"
            style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)' }}>
            Policy Details
          </motion.h2>
          {STATIC_SECTIONS.map((s, i) => (
            <motion.div key={s.id} variants={fadeUp} custom={i}>
              <Accordion section={s} defaultOpen={i === 0} />
            </motion.div>
          ))}
        </motion.div>

        {/* Data table */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          className="mb-12"
        >
          <h2 className="font-montserrat font-black text-base-content mb-4"
            style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)' }}>
            Data Categories We Process
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--primary)' }}>
                  {['Category', 'Examples', 'Applies To'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider"
                      style={{ color: 'var(--primary-content)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATA_CATEGORIES.map(({ cat, examples, roles }, i) => (
                  <tr
                    key={cat}
                    style={{ background: i % 2 === 0 ? 'var(--base-100)' : 'var(--base-200)' }}
                  >
                    <td className="px-4 py-3 font-bold text-xs text-base-content whitespace-nowrap">{cat}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>{examples}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-primary text-[10px]">{roles}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Dynamic dataCollected from DB */}
        {policy?.dataCollected?.length > 0 && (
          <motion.div variants={stagger} initial="hidden" animate="show" className="mb-12">
            <h2 className="font-montserrat font-black text-base-content mb-4"
              style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)' }}>
              Detailed Data Processing Records
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {policy.dataCollected.map((item, i) => (
                <motion.div key={i} variants={fadeUp} custom={i} className="card p-5">
                  <p className="font-montserrat font-black text-sm text-base-content mb-1">{item.category}</p>
                  <p className="text-xs leading-relaxed mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 68%, transparent)' }}>
                    {item.description}
                  </p>
                  {item.retentionPeriod && (
                    <span className="badge badge-info text-[10px]">
                      <Clock size={9} /> {item.retentionPeriod}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Contact DPO */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          className="card p-6"
          style={{ border: '1px solid color-mix(in srgb, var(--primary), transparent 65%)' }}
        >
          <h3 className="font-montserrat font-black text-base-content mb-2 flex items-center gap-2">
            <Shield size={16} style={{ color: 'var(--primary)' }} />
            Contact Our Data Protection Officer
          </h3>
          <p className="text-sm leading-relaxed mb-4"
            style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>
            For data access requests, corrections, deletions, or to exercise your GDPR/PDPA rights,
            contact us directly. We respond within 30 days.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="mailto:dpo@likeson.in" className="btn-primary-cta" style={{ fontSize: '0.8rem', padding: '0.55rem 1.2rem' }}>
              Email DPO
            </a>
            <a href="/contact" className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.55rem 1.2rem' }}>
              Contact Us
            </a>
          </div>
        </motion.div>

        {/* Consent status */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={1}
          className="mt-6"
        >
          {status?.privacyAccepted ? (
            <div className="alert alert-success flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              <span className="text-sm font-semibold">
                You have accepted this Privacy Policy (v{status.activePrivacyVersion}).
              </span>
            </div>
          ) : (
            <div className="alert alert-warning flex items-center justify-between flex-wrap gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                You haven&apos;t accepted the current Privacy Policy yet.
              </span>
              <button
                onClick={handleAccept}
                disabled={submitting}
                className="btn-primary-cta"
                style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}
              >
                {submitting ? 'Saving…' : 'Accept Now'}
              </button>
            </div>
          )}
        </motion.div>

      </div>

      <ConsentBanner status={status} submitting={submitting} onAccept={handleAccept} />
      <BackToTop />
    </main>
  );
}