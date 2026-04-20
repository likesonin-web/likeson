'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  ScrollText, ChevronDown, Clock, CheckCircle2, AlertCircle,
  ArrowUp, Scale, Users, CreditCard, Truck, FlaskConical,
  Stethoscope, UserCheck, Pill, Info, ChevronRight,
} from 'lucide-react';

import {
  fetchActiveTerms,
  recordConsent,
  fetchConsentStatus,
  selectActiveTerms,
  selectTermsLoading,
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

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Static T&C Sections ───────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'acceptance',
    icon: Scale,
    color: 'var(--primary)',
    title: '1. Acceptance of Terms',
    content: `By registering on Likeson.in or using any of our services, you acknowledge that you have read, 
understood, and agree to be bound by these Terms of Service and our Privacy Policy. 
If you do not agree with any part of these terms, you may not access or use the platform.

These terms apply to all users including Customers, Doctors, Hospital Managers, Lab Partners, 
Transport Partners, Solo Driver Partners, Care Assistants, and Pharmacy Partners.`,
  },
  {
    id: 'accounts',
    icon: Users,
    color: 'var(--secondary)',
    title: '2. User Accounts & Roles',
    content: `Each user is assigned a role at registration. Your role determines what data you can access, 
what actions you can perform, and which pricing models apply to your interactions.

- **Customer**: Book services, earn coins, use referrals.
- **Doctor**: Manage consultations, availability, and fees (subject to hospital management model).
- **Hospital Manager**: Administer MANAGED hospital types and consultation pricing.
- **Lab Partner**: Manage test catalogs, home collection, and accreditation documents.
- **Transport Partner**: Manage fleet, drivers, and service zones.
- **Solo Driver Partner**: Self-employed driver with own vehicle; subject to individual KYC.
- **Care Assistant**: In-home care provider; subject to police verification and health declaration.
- **Pharmacy Partner**: Operate medicine stores with valid Drug Licence on file.

Role misrepresentation is grounds for immediate account termination.`,
  },
  {
    id: 'kyc',
    icon: UserCheck,
    color: 'oklch(62% 0.20 22)',
    title: '3. KYC & Verification',
    content: `All partner roles (Doctors, Labs, Drivers, Transport Partners, Care Assistants, Pharmacies) 
must complete Know Your Customer (KYC) verification before accessing platform services. 
This includes submission of:

- Aadhaar (12-digit, stored encrypted with last-4 digits displayed)
- PAN Card
- Role-specific documents (Medical Council registration, DL, Drug Licence, etc.)
- Bank account details for settlement

KYC documents are reviewed by our admin team. False submissions result in permanent ban 
and potential legal action under the Information Technology Act, 2000.`,
  },
  {
    id: 'pricing',
    icon: CreditCard,
    color: 'oklch(50% 0.20 155)',
    title: '4. Pricing & Payments',
    content: `Platform pricing is governed by PlatformPricingConfig (global) with role-specific overrides. 
Key principles:

- **Transparency**: All charges (platform fees, taxes, delivery charges) are shown before confirmation.
- **Platform Fee**: Deducted from partner payouts per the applicable fee structure (fixed or percentage).
- **GST**: Applied per category — 18% (Care Assistant), 12% (Pharmacy), 5% (Transport, Diagnostics), 0% (Consultations).
- **Refunds**: Full refund if cancelled 24+ hours before; partial (50%) if within 24 hours.
- **Settlement**: Partners are settled on their configured cycle (weekly/bi-weekly/monthly).
- **Coins**: 1 coin = ₹0.01. Coins earned via referrals and loyalty; redeemable against future bookings.

Pricing changes are logged in an immutable audit trail (versionHistory). Users are notified of material pricing changes.`,
  },
  {
    id: 'transport',
    icon: Truck,
    color: 'var(--secondary)',
    title: '5. Transport Services',
    content: `Medical transport is provided by verified Transport Partners and Solo Driver Partners. By booking:

- You consent to GPS location tracking during the ride.
- Night surcharge (1.2×) applies between 22:00 and 06:00.
- Waiting charges apply after 5 free minutes (₹2/min).
- Cancellation fee (50% of fare) applies if cancelled after driver dispatch.

Neither Likeson.in nor the Transport Partner is liable for delays caused by traffic, acts of God, 
or patient medical emergencies en route. Drivers carrying medical certifications (PSV Badge, Medical Fitness) 
are preferred for healthcare transport.`,
  },
  {
    id: 'consultations',
    icon: Stethoscope,
    color: 'var(--primary)',
    title: '6. Medical Consultations',
    content: `Consultations on Likeson.in are advisory in nature and do not replace in-person emergency care. 
Doctors on our platform are independently verified against MCI/State Medical Council registrations.

Pricing varies by hospital management model:
- **Hospital-Manager hospitals**: Fees set by the hospital; doctor honorarium separate.
- **Doctor-Owner clinics**: Fees set by the doctor directly.
- Follow-up consultations qualify for discounts as defined by the respective pricing config (default 20% off, valid 7 days).

Likeson.in is not liable for medical outcomes. All doctors carry independent professional liability.`,
  },
  {
    id: 'diagnostics',
    icon: FlaskConical,
    color: 'oklch(55% 0.22 275)',
    title: '7. Diagnostics & Labs',
    content: `Lab tests are conducted by NABL-accredited partner laboratories. By booking a lab test:

- Home sample collection is subject to lab service area and additional collection fee (default ₹75).
- Physical report printing is available for an additional fee (default ₹50).
- Turnaround time (TAT) is estimated; lab partners are not liable for delays outside their control.
- Platform fee on lab orders follows PlatformPricingConfig.diagnostics (with per-lab overrides).
- Settlement to labs follows their configured cycle (weekly/bi-weekly/monthly).`,
  },
  {
    id: 'pharmacy',
    icon: Pill,
    color: 'oklch(50% 0.20 155)',
    title: '8. Pharmacy Services',
    content: `Pharmacy orders are fulfilled by stores with valid Drug Licences registered on our platform. 
Prescription medications require a valid prescription upload before order confirmation.

- Express delivery charge applies per PlatformPricingConfig.pharmacy (default ₹49).
- Free delivery on orders above the minimum threshold (default ₹200).
- Pharmacy discount plans are subject to caps defined in PlatformPricingConfig.caps.pharmacyDiscountMax.
- Own-store orders carry a platform margin (default 30%) built into the displayed price.
- Returns: Accepted within 24 hours for sealed, unopened, non-prescription items only.`,
  },
  {
    id: 'care',
    icon: UserCheck,
    color: 'oklch(58% 0.18 300)',
    title: '9. Care Assistant Services',
    content: `Care Assistants are background-verified, health-declared professionals. All pricing 
(chargeToUser, payoutToAssistant) is managed exclusively via PlatformPricingConfig.careAssistant.

- Dedicated monthly plans are available for continuous care.
- Punctuality bonus (default ₹25/visit) is rewarded for on-time arrival.
- No-show penalty (default ₹100) applies to unexplained absences.
- Overtime is charged at the configured rate (default ₹120/hr beyond the booked slot).
- GST at 18% applies to all care assistant services.

Likeson.in is a facilitator. Care Assistants are independent service providers and not employees.`,
  },
  {
    id: 'conduct',
    icon: Scale,
    color: 'oklch(62% 0.20 22)',
    title: '10. Prohibited Conduct',
    content: `Users must not:

- Provide false information during registration or KYC.
- Attempt to circumvent platform pricing or settlement mechanisms.
- Engage in fraudulent bookings, review manipulation, or coin abuse.
- Share login credentials or access the platform on behalf of another user without consent.
- Use the platform to facilitate services outside its stated healthcare scope.
- Violate any applicable Indian law including the Information Technology Act, 2000 and Clinical Establishments Act.

Violations may result in immediate account suspension, forfeiture of pending settlements, 
and reporting to relevant authorities.`,
  },
  {
    id: 'liability',
    icon: Info,
    color: 'var(--primary)',
    title: '11. Limitation of Liability',
    content: `To the maximum extent permitted by law, Likeson.in is not liable for:

- Any medical outcomes arising from consultations, care, or diagnostics arranged via the platform.
- Service delays by third-party partners (labs, transport, pharmacies).
- Loss of data due to force majeure events.
- Indirect, consequential, or punitive damages.

Our liability is limited to the transaction value of the specific booking in dispute. 
Platform fees collected are non-refundable except where explicitly stated in the Refund Policy.`,
  },
  {
    id: 'termination',
    icon: Users,
    color: 'var(--secondary)',
    title: '12. Termination',
    content: `We reserve the right to suspend or terminate any account that violates these Terms, 
without prior notice in cases of fraud, KYC misrepresentation, or legal violation.

Upon termination:
- Active bookings will be completed or transferred where feasible.
- Pending settlements are processed within the regular cycle.
- Coins and referral balances are forfeited for accounts terminated due to misconduct.
- Data is retained per our Privacy Policy and applicable regulatory requirements.

You may request account deletion at any time via dpo@likeson.in. Deletion is subject to regulatory hold periods.`,
  },
  {
    id: 'governing',
    icon: Scale,
    color: 'oklch(50% 0.20 155)',
    title: '13. Governing Law & Disputes',
    content: `These Terms are governed by the laws of India. Any dispute arising from the use of 
Likeson.in shall be subject to the exclusive jurisdiction of courts in Vijayawada, 
Andhra Pradesh, India.

We encourage resolution of disputes through our internal grievance mechanism first.
Our Grievance Officer may be contacted at grievance@likeson.in. Unresolved disputes 
may be escalated to the relevant consumer forum or courts.`,
  },
];

// ── TOC Sidebar ───────────────────────────────────────────────────────────────
function TableOfContents({ sections, active }) {
  return (
    <nav className="sticky top-24 hidden lg:block">
      <p className=" font-poppins font-black   text-xs text-base-content uppercase tracking-widest mb-3">
        On This Page
      </p>
      <ul className="flex flex-col gap-1">
        {sections.map(s => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg transition-all duration-200"
              style={{
                color: active === s.id ? 'var(--primary)' : 'color-mix(in oklch, var(--base-content) 60%, transparent)',
                background: active === s.id ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'transparent',
                fontWeight: active === s.id ? 700 : 400,
              }}
            >
              <ChevronRight size={10} style={{ opacity: active === s.id ? 1 : 0.4 }} />
              {s.title.split('. ')[1] || s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Section Block ─────────────────────────────────────────────────────────────
function SectionBlock({ section, index }) {
  const ref = useRef(null);
  const inView = useRef(false);

  return (
    <motion.div
      id={section.id}
      ref={ref}
      variants={fadeUp}
      custom={index}
      className="scroll-mt-28"
    >
      <div className="card p-6 md:p-8">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: `color-mix(in srgb, ${section.color}, transparent 82%)`,
              border: `1px solid color-mix(in srgb, ${section.color}, transparent 55%)`,
            }}
          >
            <section.icon size={16} style={{ color: section.color }} />
          </div>
          <h2
            className=" font-poppins font-black font- text-base-content leading-snug"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}
          >
            {section.title}
          </h2>
        </div>
        <div
          className="text-sm leading-relaxed whitespace-pre-line pl-14"
          style={{ color: 'color-mix(in oklch, var(--base-content) 72%, transparent)' }}
          dangerouslySetInnerHTML={{
            __html: section.content
              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-base-content">$1</strong>')
              .replace(/\n- /g, '<br/>• ')
              .replace(/\n\n/g, '<br/><br/>'),
          }}
        />
      </div>
    </motion.div>
  );
}

// ── Consent Banner ────────────────────────────────────────────────────────────
function ConsentBanner({ status, submitting, onAccept }) {
  const [dismissed, setDismissed] = useState(false);
  if (status?.termsAccepted || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
        style={{
          background: 'linear-gradient(to top, var(--base-100) 80%, transparent)',
        }}
      >
        <div
          className="max-w-2xl mx-auto rounded-2xl p-5 shadow-primary flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{
            background: 'var(--base-100)',
            border: '1px solid color-mix(in srgb, var(--primary), transparent 60%)',
            boxShadow: 'var(--shadow-depth)',
          }}
        >
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="font-bold text-sm text-base-content">Accept Terms of Service</p>
              <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>
                By continuing to use Likeson.in you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={onAccept}
              disabled={submitting}
              className="btn-primary-cta flex-1 sm:flex-none"
              style={{ fontSize: '0.78rem', padding: '0.55rem 1.2rem' }}
            >
              {submitting ? 'Saving…' : 'I Accept'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="btn-secondary flex-1 sm:flex-none"
              style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}
            >
              Later
            </button>
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
    const h = () => setVis(window.scrollY > 600);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  if (!vis) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-28 right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-primary hover:scale-110 transition-transform"
      style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
      aria-label="Back to top"
    >
      <ArrowUp size={16} />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TermsOfServicePage() {
  const dispatch   = useDispatch();
  const terms      = useSelector(selectActiveTerms);
  const loading    = useSelector(selectTermsLoading);
  const status     = useSelector(selectConsentStatus);
  const submitting = useSelector(selectConsentSubmitting);
  const [activeSection, setActiveSection] = useState('acceptance');

  const headerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: headerRef, offset: ['start start', 'end start'] });
  const headerY   = useTransform(scrollYProgress, [0, 1], ['0%', '28%']);
  const headerOpa = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const { scrollYProgress: pageProgress } = useScroll();
  const progressWidth = useTransform(pageProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    dispatch(fetchActiveTerms());
    dispatch(fetchConsentStatus());
  }, [dispatch]);

  // Intersection observer for TOC highlight
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const handleAccept = () =>
    dispatch(recordConsent({ method: 'explicit_checkbox', platform: 'web' }));

  return (
    <main className="min-h-screen bg-base-100">

      {/* Reading progress */}
      <motion.div
        className="fixed top-0 left-0 h-[3px] z-[100] origin-left"
        style={{ width: progressWidth, background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
      />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <section
        ref={headerRef}
        className="relative py-28 md:py-36 overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, var(--base-200) 0%, color-mix(in srgb, var(--primary) 12%, var(--base-100)) 100%)',
        }}
      >
        {/* dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--primary) 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* gradient orb */}
        <div
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: 'var(--primary)' }}
        />

        <motion.div
          style={{ y: headerY, opacity: headerOpa }}
          className="container-custom relative z-10 text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              boxShadow: '0 12px 30px color-mix(in srgb, var(--primary), transparent 55%)',
            }}
          >
            <ScrollText size={28} color="#fff" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className=" font-poppins font-black font- text-base-content mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            Terms of <span className="text-gradient-primary">Service</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-4 text-xs mb-4"
            style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}
          >
            {loading ? (
              <span className="skeleton h-4 w-48 rounded" />
            ) : terms ? (
              <>
                <span className="badge badge-primary">v{terms.version}</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={11} /> Effective {fmt(terms.effectiveDate)}
                </span>
                {terms.requiresReAcceptance && (
                  <span className="badge badge-warning">Re-acceptance Required</span>
                )}
              </>
            ) : (
              <span>Loading terms…</span>
            )}
          </motion.div>

          {terms?.summary && (
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="max-w-xl mx-auto text-sm leading-relaxed"
              style={{ color: 'color-mix(in oklch, var(--base-content) 68%, transparent)' }}
            >
              {terms.summary}
            </motion.p>
          )}

          {/* Quick consent status */}
          {status && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36 }}
              className="mt-6 inline-flex items-center gap-2"
            >
              {status.termsAccepted ? (
                <span className="badge badge-success flex items-center gap-1.5">
                  <CheckCircle2 size={11} /> Accepted v{status.activeTermsVersion}
                </span>
              ) : (
                <button
                  onClick={handleAccept}
                  disabled={submitting}
                  className="btn-primary-cta"
                  style={{ fontSize: '0.8rem', padding: '0.6rem 1.4rem' }}
                >
                  {submitting ? 'Saving…' : 'Accept Terms'}
                </button>
              )}
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ── CONTENT LAYOUT ──────────────────────────────────────────────── */}
      <div className="container-custom py-14 max-w-6xl mx-auto">
        <div className="flex gap-10">

          {/* TOC */}
          <aside className="w-56 shrink-0">
            <TableOfContents sections={SECTIONS} active={activeSection} />
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* DB content if exists */}
            {terms?.content && (
              <motion.div
                variants={fadeUp} initial="hidden" animate="show" custom={0}
                className="card p-6 mb-6"
              >
                <h2 className=" font-poppins font-black font- text-base-content mb-3 flex items-center gap-2">
                  <ScrollText size={16} style={{ color: 'var(--primary)' }} />
                  Official Terms Document
                </h2>
                <div
                  className="text-sm leading-relaxed"
                  style={{ color: 'color-mix(in oklch, var(--base-content) 72%, transparent)' }}
                  dangerouslySetInnerHTML={{ __html: terms.content.replace(/\n/g, '<br/>') }}
                />
              </motion.div>
            )}

            {/* Role-specific clauses from DB */}
            {terms?.roleSpecificClauses?.length > 0 && (
              <motion.div
                variants={stagger} initial="hidden" animate="show"
                className="mb-8"
              >
                <h3 className=" font-poppins font-black font- text-base-content mb-3"
                  style={{ fontSize: '1.1rem' }}>
                  Role-Specific Clauses
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {terms.roleSpecificClauses.map((clause, i) => (
                    <motion.div key={clause.role} variants={fadeUp} custom={i} className="card p-4">
                      <span className="badge badge-primary mb-2">{clause.role}</span>
                      <p className="text-xs leading-relaxed"
                        style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>
                        {clause.content}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Static sections */}
            <motion.div
              variants={stagger} initial="hidden" animate="show"
              className="flex flex-col gap-4"
            >
              {SECTIONS.map((s, i) => (
                <motion.div key={s.id} variants={fadeUp} custom={i}>
                  <SectionBlock section={s} index={i} />
                </motion.div>
              ))}
            </motion.div>

            {/* Footer note */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="show" custom={0}
              className="mt-8 card p-6"
              style={{ border: '1px solid color-mix(in srgb, var(--primary), transparent 65%)' }}
            >
              <h3 className=" font-poppins font-black font- text-base-content mb-2 flex items-center gap-2">
                <Info size={15} style={{ color: 'var(--primary)' }} />
                Questions about these Terms?
              </h3>
              <p className="text-sm leading-relaxed mb-4"
                style={{ color: 'color-mix(in oklch, var(--base-content) 68%, transparent)' }}>
                We&apos;re here to help. If you have questions about how these terms affect your use of 
                Likeson.in, contact our legal team directly.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="mailto:legal@likeson.in" className="btn-primary-cta" style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}>
                  legal@likeson.in
                </a>
                <a href="/legal/privacy" className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}>
                  Privacy Policy
                </a>
                <a href="/contact" className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}>
                  Contact Us
                </a>
              </div>
            </motion.div>

            {/* Consent status */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="show" custom={1}
              className="mt-5"
            >
              {status?.termsAccepted ? (
                <div className="alert alert-success">
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  <span className="text-sm font-semibold">
                    You have accepted these Terms of Service (v{status.activeTermsVersion}).
                  </span>
                </div>
              ) : (
                <div className="alert alert-warning flex items-center justify-between flex-wrap gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <AlertCircle size={15} style={{ color: 'var(--warning)' }} />
                    You have not yet accepted the current Terms of Service.
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
        </div>
      </div>

      <ConsentBanner status={status} submitting={submitting} onAccept={handleAccept} />
      <BackToTop />
    </main>
  );
}