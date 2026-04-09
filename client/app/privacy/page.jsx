'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Eye, Database, Globe, Cookie, Share2,
  MapPin, Lock, RefreshCw, Mail, Clock, ChevronDown,
  ArrowUp, AlertTriangle, Info, CheckCircle2, FileText,
  Server, User, Fingerprint
} from 'lucide-react';
import {
  fetchActivePrivacyPolicy,
  selectActivePrivacy,
  selectPrivacyLoading,
  selectPrivacyError,
} from '@/store/slices/legalSlice';

// ─── Compliance Badge Colors ─────────────────────────────────────────────────
const COMPLIANCE_COLORS = {
  GDPR:   { bg: 'color-mix(in srgb, var(--primary), transparent 82%)',  text: 'var(--primary)' },
  HIPAA:  { bg: 'color-mix(in srgb, var(--success), transparent 82%)',  text: 'var(--success)' },
  PDPA:   { bg: 'color-mix(in srgb, var(--info), transparent 82%)',     text: 'var(--info)' },
  CCPA:   { bg: 'color-mix(in srgb, var(--accent), transparent 82%)',   text: 'var(--accent)' },
  PIPEDA: { bg: 'color-mix(in srgb, var(--secondary), transparent 82%)',text: 'var(--secondary)' },
  Other:  { bg: 'color-mix(in srgb, var(--neutral), transparent 82%)',  text: 'var(--neutral-content)' },
};

// ─── Section config ───────────────────────────────────────────────────────────
const POLICY_SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    icon: Eye,
    color: 'var(--primary)',
    body: 'This Privacy Policy describes how we collect, use, and share information about you when you use our platform, products, and services. We are committed to protecting your personal data in accordance with applicable privacy laws.',
  },
  {
    id: 'data-collected',
    title: 'Data We Collect',
    icon: Database,
    color: 'var(--secondary)',
    body: 'We collect information you provide directly, such as account details, health information, payment data, and communications. We also automatically collect usage data, device information, and location signals when you interact with our platform.',
  },
  {
    id: 'how-we-use',
    title: 'How We Use Your Data',
    icon: Server,
    color: 'var(--info)',
    body: 'Your data powers core platform features—scheduling, diagnostics, and payments—and helps us personalise your experience. We also use it for fraud prevention, legal compliance, and to improve our services through anonymised analytics.',
  },
  {
    id: 'data-sharing',
    title: 'Data Sharing & Disclosure',
    icon: Share2,
    color: 'var(--warning)',
    body: 'We may share data with trusted service providers, healthcare partners, and as required by law. We never sell your personal information. Any third-party sharing is governed by strict data processing agreements.',
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    icon: User,
    color: 'var(--success)',
    body: 'Depending on your location, you may have the right to access, correct, delete, or port your personal data. You can also object to or restrict processing. To exercise your rights, contact our Data Protection Officer at dpo@example.com.',
  },
  {
    id: 'data-security',
    title: 'Data Security',
    icon: Lock,
    color: 'var(--error)',
    body: 'We use industry-standard encryption (TLS 1.3, AES-256), access controls, and regular security audits to protect your data. In the event of a breach, we will notify affected users and authorities within 72 hours as required by law.',
  },
  {
    id: 'cookies',
    title: 'Cookies & Tracking',
    icon: Cookie,
    color: 'var(--accent)',
    body: 'We use essential cookies for platform functionality and optional analytics cookies to understand how users interact with our service. You can manage cookie preferences through our cookie consent panel at any time.',
  },
  {
    id: 'geolocation',
    title: 'Location Data',
    icon: MapPin,
    color: 'var(--secondary)',
    body: 'With your explicit consent, we collect precise geolocation data to power features like nearby provider search and transport tracking. You can revoke location access at any time through your device settings.',
  },
  {
    id: 'retention',
    title: 'Data Retention',
    icon: Clock,
    color: 'var(--neutral)',
    body: 'We retain personal data for as long as necessary to provide our services and comply with legal obligations. Health records are retained for a minimum of 7 years as required by medical regulations. You may request deletion of non-essential data at any time.',
  },
  {
    id: 'international',
    title: 'International Transfers',
    icon: Globe,
    color: 'var(--primary)',
    body: 'Your data may be transferred to and processed in countries outside your jurisdiction. We ensure appropriate safeguards—such as Standard Contractual Clauses—are in place for any international data transfers.',
  },
  {
    id: 'children',
    title: 'Children\'s Privacy',
    icon: ShieldCheck,
    color: 'var(--success)',
    body: 'Our platform is not directed at children under 18. We do not knowingly collect personal information from minors. If you believe a child has provided us with personal data, please contact us immediately.',
  },
  {
    id: 'contact',
    title: 'Contact & DPO',
    icon: Mail,
    color: 'var(--info)',
    body: 'For privacy-related inquiries, please contact our Data Protection Officer at dpo@example.com. You may also lodge a complaint with your local supervisory authority if you believe your rights have been violated.',
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────
function ComplianceBadge({ framework }) {
  const style = COMPLIANCE_COLORS[framework] || COMPLIANCE_COLORS.Other;
  return (
    <motion.span
      whileHover={{ scale: 1.08 }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.text}30` }}
    >
      <Fingerprint size={10} />
      {framework}
    </motion.span>
  );
}

function DataCategoryCard({ item, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="glass-card p-4 space-y-2"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-montserrat font-black text-sm" style={{ color: 'var(--primary)' }}>
          {item.category}
        </span>
        {item.retentionPeriod && (
          <span className="badge badge-info text-[10px]">
            <Clock size={9} /> {item.retentionPeriod}
          </span>
        )}
      </div>
      {item.description && (
        <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 75%, transparent)' }}>
          {item.description}
        </p>
      )}
      {item.purpose && (
        <p className="text-xs font-semibold" style={{ color: 'var(--base-content)' }}>
          Purpose: <span className="font-normal">{item.purpose}</span>
        </p>
      )}
      {item.sharedWith?.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {item.sharedWith.map(sw => (
            <span key={sw} className="badge badge-warning text-[9px]">{sw}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function PolicySectionCard({ section, index, onVisible }) {
  const ref  = useRef(null);
  const [open, setOpen] = useState(true);
  const { icon: Icon, color, id, title, body } = section;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(id); },
      { threshold: 0.35 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [id, onVisible]);

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.055 }}
      className="card overflow-hidden"
    >
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-base-200/40 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
            <Icon size={18} style={{ color }} />
          </span>
          <span className="font-montserrat font-black text-base md:text-lg">
            {title}
          </span>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown size={16} style={{ color: 'var(--primary)' }} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              <div className="h-px mb-4" style={{ background: 'var(--base-300)' }} />
              <p className="text-sm leading-relaxed"
                 style={{ color: 'color-mix(in oklch, var(--base-content) 80%, transparent)' }}>
                {body}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function SideNav({ sections, activeId, onNavigate }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="hidden lg:block sticky top-28 w-64 shrink-0"
    >
      <div className="card p-5">
        <p className="font-montserrat font-black text-xs uppercase tracking-widest mb-4"
           style={{ color: 'var(--primary)' }}>
          Policy Sections
        </p>
        <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {sections.map((s, i) => {
            const active = activeId === s.id;
            const Icon   = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                className={`w-full text-left text-xs py-2 px-3 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  active ? 'font-bold' : 'font-medium opacity-60 hover:opacity-100'
                }`}
                style={{
                  background: active ? `color-mix(in srgb, ${s.color}, transparent 87%)` : 'transparent',
                  color: active ? s.color : 'var(--base-content)',
                  borderLeft: active ? `3px solid ${s.color}` : '3px solid transparent',
                }}
              >
                <Icon size={12} style={{ color: active ? s.color : undefined, flexShrink: 0 }} />
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </motion.aside>
  );
}

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
           style={{ background: 'radial-gradient(circle, var(--secondary), transparent 65%)' }} />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full opacity-[0.05]"
           style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }} />
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pp-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pp-dots)" />
      </svg>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="card p-6 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl skeleton" />
            <div className="h-5 w-44 rounded skeleton" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-3 rounded skeleton w-full" />
            <div className="h-3 rounded skeleton w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────
export default function PrivacyPolicyPage() {
  const dispatch  = useDispatch();
  const policyData = useSelector(selectActivePrivacy);
  const loading    = useSelector(selectPrivacyLoading);
  const error      = useSelector(selectPrivacyError);

  const [activeId, setActiveId] = useState(null);
  const [showTop,  setShowTop]  = useState(false);

  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const handleVisible = useCallback((id) => setActiveId(id), []);

  useEffect(() => { dispatch(fetchActivePrivacyPolicy()); }, [dispatch]);
  useEffect(() => {
    const fn = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const scrollToSection = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Merge backend content into section bodies if available
  const sections = POLICY_SECTIONS.map(s => {
    if (s.id === 'data-collected' && policyData?.dataRetentionPolicy)
      return { ...s, body: policyData.dataRetentionPolicy };
    if (s.id === 'cookies' && policyData?.cookiePolicy)
      return { ...s, body: policyData.cookiePolicy };
    return s;
  });

  const frameworks    = policyData?.complianceFrameworks ?? ['GDPR', 'HIPAA', 'PDPA'];
  const dataCollected = policyData?.dataCollected ?? [];
  const version       = policyData?.version ?? '1.0.0';
  const effectiveDate = policyData?.effectiveDate
    ? new Date(policyData.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'January 1, 2025';
  const thirdParty    = policyData?.thirdPartySharing ?? false;
  const geoTracking   = policyData?.geolocationTracking ?? false;

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── Scroll progress ── */}
      <motion.div
        className="fixed top-0 left-0 h-[3px] z-50 origin-left"
        style={{ width: progressWidth, background: 'linear-gradient(90deg, var(--secondary), var(--primary))' }}
      />

      {/* ── Hero ── */}
      <header className="relative overflow-hidden pt-24 pb-20 px-4">
        <HeroBackground />
        <div className="relative container-custom max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
            style={{
              background: 'color-mix(in srgb, var(--secondary), transparent 88%)',
              border: '1px solid color-mix(in srgb, var(--secondary), transparent 65%)',
              color: 'var(--secondary)',
            }}
          >
            <ShieldCheck size={12} />
            Legal Document · Version {version}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="section-heading mb-4"
          >
            Privacy{' '}
            <span style={{
              background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Policy
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="section-subheading max-w-xl mx-auto"
          >
            Your privacy matters. Learn how we collect, protect, and use your personal data.
          </motion.p>

          {/* Meta pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-3 mt-6"
          >
            {[
              { icon: Clock,      label: `Effective: ${effectiveDate}` },
              { icon: Share2,     label: `3rd Party Sharing: ${thirdParty ? 'Yes' : 'No'}` },
              { icon: MapPin,     label: `Geo Tracking: ${geoTracking ? 'Enabled' : 'Disabled'}` },
              { icon: FileText,   label: `${sections.length} Sections` },
            ].map(({ icon: Icon, label }) => (
              <span key={label}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--base-200)', color: 'var(--base-content)' }}>
                <Icon size={12} style={{ color: 'var(--secondary)' }} />
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </header>

      {/* ── Compliance Frameworks Banner ── */}
      {frameworks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="container-custom max-w-5xl mx-auto px-4 mb-8"
        >
          <div className="card p-5 flex flex-wrap items-center gap-3">
            <span className="font-montserrat font-black text-xs uppercase tracking-widest shrink-0"
                  style={{ color: 'var(--base-content)' }}>
              Compliance:
            </span>
            {frameworks.map(f => <ComplianceBadge key={f} framework={f} />)}
            <span className="ml-auto text-xs font-semibold hidden sm:inline"
                  style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              We take compliance seriously
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Notice banner ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="alert alert-info container-custom max-w-5xl mx-auto mb-8 px-4"
      >
        <Info size={16} style={{ color: 'var(--info)', flexShrink: 0 }} />
        <span className="text-sm">
          This policy is effective as of <strong>{effectiveDate}</strong>. We notify users of any material changes via email and in-app notifications.
        </span>
      </motion.div>

      {/* ── Main ── */}
      <main className="container-custom max-w-5xl mx-auto px-4 pb-24">
        {loading ? (
          <SkeletonLoader />
        ) : error ? (
          <div className="alert alert-error p-6 rounded-xl">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex gap-10 items-start">
            <SideNav sections={sections} activeId={activeId} onNavigate={scrollToSection} />

            <div className="flex-1 min-w-0 space-y-4">
              {sections.map((section, i) => (
                <PolicySectionCard
                  key={section.id}
                  section={section}
                  index={i}
                  onVisible={handleVisible}
                />
              ))}

              {/* ── Data Categories ── */}
              {dataCollected.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="card p-6 space-y-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'color-mix(in srgb, var(--primary), transparent 82%)' }}>
                      <Database size={18} style={{ color: 'var(--primary)' }} />
                    </span>
                    <h3 className="font-montserrat font-black text-lg">Data Categories Breakdown</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dataCollected.map((item, i) => (
                      <DataCategoryCard key={i} item={item} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Rights Summary ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="card p-6"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--success), transparent 82%)' }}>
                    <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                  </span>
                  <h3 className="font-montserrat font-black text-lg">Your Data Rights at a Glance</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Right to Access',    emoji: '📋' },
                    { label: 'Right to Correct',   emoji: '✏️' },
                    { label: 'Right to Delete',    emoji: '🗑️' },
                    { label: 'Right to Port',      emoji: '📦' },
                    { label: 'Right to Object',    emoji: '✋' },
                    { label: 'Right to Restrict',  emoji: '🔒' },
                  ].map(({ label, emoji }, i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.06 }}
                      className="glass-card p-3 flex flex-col items-center text-center gap-1"
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>{label}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* ── Contact Footer ── */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="glass-card p-6 flex items-start gap-4"
              >
                <ShieldCheck size={24} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="font-montserrat font-black text-sm mb-1">
                    Contact our Data Protection Officer
                  </p>
                  <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>
                    Reach us at{' '}
                    <a href="mailto:dpo@example.com" className="text-primary font-semibold">
                      dpo@example.com
                    </a>{' '}
                    for any privacy concerns or to exercise your data rights. We respond within 30 days.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </main>

      {/* ── Back to top ── */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 w-12 h-12 rounded-full flex items-center justify-center z-40 no-print"
            style={{
              background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
              color: 'var(--primary-content)',
              boxShadow: '0 4px 20px color-mix(in srgb, var(--secondary), transparent 50%)',
            }}
            aria-label="Back to top"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}