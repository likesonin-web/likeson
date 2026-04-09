'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ScrollText, ShieldCheck, Clock, Users, AlertTriangle,
  ChevronDown, ChevronRight, BookOpen, Gavel, Globe,
  RefreshCw, Mail, ArrowUp, CheckCircle2, Info
} from 'lucide-react';
import {
  fetchActiveTerms,
  selectActiveTerms,
  selectTermsLoading,
  selectTermsError,
} from '@/store/slices/legalSlice';

// ─── Section Data ────────────────────────────────────────────────────────────
const ICON_MAP = {
  'Acceptance':        { icon: CheckCircle2, color: 'var(--success)' },
  'Use':               { icon: Users,        color: 'var(--primary)' },
  'Account':           { icon: ShieldCheck,  color: 'var(--secondary)' },
  'Content':           { icon: BookOpen,     color: 'var(--accent)' },
  'Prohibited':        { icon: AlertTriangle,color: 'var(--error)' },
  'Termination':       { icon: Clock,        color: 'var(--warning)' },
  'Liability':         { icon: Gavel,        color: 'var(--neutral)' },
  'Governing':         { icon: Globe,        color: 'var(--info)' },
  'Changes':           { icon: RefreshCw,    color: 'var(--primary)' },
  'Contact':           { icon: Mail,         color: 'var(--secondary)' },
  'default':           { icon: Info,         color: 'var(--primary)' },
};

function getIconForSection(title = '') {
  const key = Object.keys(ICON_MAP).find(k => title.includes(k));
  return key ? ICON_MAP[key] : ICON_MAP['default'];
}

// ─── Mocked fallback content ──────────────────────────────────────────────────
const FALLBACK_SECTIONS = [
  { id: 's1', title: '1. Acceptance of Terms', body: 'By accessing or using our platform, you confirm that you are at least 18 years old and agree to be bound by these Terms and Conditions. If you are accessing the platform on behalf of a company or organisation, you represent that you have the authority to bind that entity.' },
  { id: 's2', title: '2. Use of the Platform', body: 'You may use our services solely for lawful purposes and in accordance with these Terms. You agree not to use the platform in any way that violates applicable local, national, or international law or regulation.' },
  { id: 's3', title: '3. Account Responsibilities', body: 'You are responsible for safeguarding the password you use and for all activities that occur under your account. Notify us immediately at support@example.com if you suspect any unauthorised use of your account.' },
  { id: 's4', title: '4. Content & Intellectual Property', body: 'All content on this platform—including text, graphics, logos, and software—is the property of the company or its content suppliers and is protected by applicable intellectual property laws.' },
  { id: 's5', title: '5. Prohibited Activities', body: 'You may not engage in scraping, reverse engineering, transmitting harmful code, or any activity that disrupts or interferes with the platforms infrastructure, security, or other users.' },
  { id: 's6', title: '6. Termination', body: 'We reserve the right to suspend or terminate your access at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, the company, or third parties.' },
  { id: 's7', title: '7. Limitation of Liability', body: 'To the fullest extent permitted by law, the company shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform.' },
  { id: 's8', title: '8. Governing Law', body: 'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the company is registered, without regard to conflict of law provisions.' },
  { id: 's9', title: '9. Changes to Terms', body: 'We may revise these Terms at any time. Your continued use of the platform after any changes constitutes acceptance of the new Terms. We will notify users of material changes via email or in-app notification.' },
  { id: 's10', title: '10. Contact Us', body: 'If you have questions about these Terms, please contact our legal team at legal@example.com or write to us at our registered office address.' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────
function TableOfContents({ sections, activeId, onNavigate }) {
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
          Contents
        </p>
        <nav className="space-y-1">
          {sections.map((s, i) => {
            const active = activeId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                className={`w-full text-left text-xs py-2 px-3 rounded-lg transition-all duration-200 flex items-center gap-2 group ${
                  active ? 'font-bold' : 'font-medium opacity-70 hover:opacity-100'
                }`}
                style={{
                  background: active ? `color-mix(in srgb, var(--primary), transparent 85%)` : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--base-content)',
                  borderLeft: active ? `3px solid var(--primary)` : '3px solid transparent',
                }}
              >
                <span className="shrink-0 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black"
                      style={{ background: active ? 'var(--primary)' : 'var(--base-300)', color: active ? 'var(--primary-content)' : 'var(--base-content)' }}>
                  {i + 1}
                </span>
                <span className="truncate">{s.title.replace(/^\d+\.\s*/, '')}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </motion.aside>
  );
}

function SectionCard({ section, index, onVisible }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(true);
  const { icon: Icon, color } = getIconForSection(section.title);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(section.id); },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [section.id, onVisible]);

  return (
    <motion.section
      ref={ref}
      id={section.id}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
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
          <span className="font-montserrat font-black text-base md:text-lg" style={{ color: 'var(--base-content)' }}>
            {section.title}
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
            <div className="px-6 pb-6 pt-0">
              <div className="h-px mb-4" style={{ background: 'var(--base-300)' }} />
              <p className="text-sm leading-relaxed" style={{ color: 'color-mix(in oklch, var(--base-content) 80%, transparent)' }}>
                {section.body}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Gradient orbs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.08]"
           style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }} />
      <div className="absolute -bottom-16 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06]"
           style={{ background: 'radial-gradient(circle, var(--secondary), transparent 70%)' }} />
      {/* Grid overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="tc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tc-grid)" />
      </svg>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card p-6 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl skeleton" />
            <div className="h-5 w-48 rounded skeleton" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-3 rounded skeleton w-full" />
            <div className="h-3 rounded skeleton w-5/6" />
            <div className="h-3 rounded skeleton w-4/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────
export default function TermsAndConditionsPage() {
  const dispatch = useDispatch();
  const termsData = useSelector(selectActiveTerms);
  const loading   = useSelector(selectTermsLoading);
  const error     = useSelector(selectTermsError);

  const [activeId, setActiveId] = useState(null);
  const [showTop, setShowTop] = useState(false);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  // Parse the content into sections (split by numbered headings)
  const sections = (() => {
    if (!termsData?.content) return FALLBACK_SECTIONS;
    const raw = termsData.content;
    const parts = raw.split(/(?=\n?\d+\.\s)/);
    return parts
      .filter(p => p.trim())
      .map((p, i) => {
        const lines = p.trim().split('\n');
        const title = lines[0].trim();
        const body  = lines.slice(1).join('\n').trim() || p.trim();
        return { id: `s${i + 1}`, title, body };
      });
  })();

  useEffect(() => { dispatch(fetchActiveTerms()); }, [dispatch]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const effectiveDate = termsData?.effectiveDate
    ? new Date(termsData.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'January 1, 2025';

  const version = termsData?.version || '1.0.0';

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── Scroll progress bar ── */}
      <motion.div
        className="fixed top-0 left-0 h-[3px] z-50 origin-left"
        style={{ width: progressWidth, background: 'var(--bg-gradient-primary)' }}
      />

      {/* ── Hero ── */}
      <header ref={heroRef} className="relative overflow-hidden pt-24 pb-20 px-4">
        <HeroBackground />
        <div className="relative container-custom max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
            style={{
              background: 'color-mix(in srgb, var(--primary), transparent 88%)',
              border: '1px solid color-mix(in srgb, var(--primary), transparent 70%)',
              color: 'var(--primary)',
            }}
          >
            <Gavel size={12} />
            Legal Document · Version {version}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="section-heading mb-4"
          >
            Terms &amp;{' '}
            <span className="text-gradient-primary">Conditions</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="section-subheading max-w-xl mx-auto"
          >
            Please read these terms carefully before using our platform and services.
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
              { icon: RefreshCw,  label: `Version ${version}` },
              { icon: ScrollText, label: `${sections.length} Sections` },
            ].map(({ icon: Icon, label }) => (
              <span key={label}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--base-200)', color: 'var(--base-content)' }}>
                <Icon size={12} style={{ color: 'var(--primary)' }} />
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </header>

      {/* ── Notice Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="alert alert-info container-custom max-w-5xl mx-auto mb-8 px-4"
      >
        <Info size={16} style={{ color: 'var(--info)', flexShrink: 0 }} />
        <span className="text-sm">
          By using our platform, you automatically agree to these terms. Last reviewed on{' '}
          <strong>{effectiveDate}</strong>.
        </span>
      </motion.div>

      {/* ── Main Content ── */}
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
            <TableOfContents sections={sections} activeId={activeId} onNavigate={scrollToSection} />

            <div className="flex-1 min-w-0 space-y-4">
              {sections.map((section, i) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={i}
                  onVisible={setActiveId}
                />
              ))}

              {/* Footer note */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="glass-card p-6 flex items-start gap-4 mt-8"
              >
                <ShieldCheck size={24} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="font-montserrat font-black text-sm mb-1">Questions about these terms?</p>
                  <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>
                    Our legal team is available at{' '}
                    <a href="mailto:legal@example.com" className="text-primary font-semibold">
                      legal@example.com
                    </a>
                    . We typically respond within 2 business days.
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
            className="fixed bottom-8 right-8 w-12 h-12 rounded-full flex items-center justify-center shadow-primary z-40 btn-primary-cta !px-0 !py-0 no-print"
            aria-label="Back to top"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}