'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Added for visibility check
import { useSelector } from 'react-redux';
import {
  Mail,
  Phone,
  MapPin,
  ArrowUpRight,
  ShieldCheck,
  HeartPulse,
} from 'lucide-react';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa6';

// ── Role → data-theme mapping ─────────────────────────────────────────────────
const ROLE_THEME_MAP = {
  doctor:            'doctor',
  hospital:          'hospital',
  'care assistant':  'care-assistant',
  transportpartner:  'transport',
  solodriverpartner: 'transport',
  driver:            'transport',
  pharmacy:          'pharmacy',
  'lab partner':     'lab',
  customer:          null,
  superadmin:        null,
  admin:             null,
  finance:           null,
};

// ── Role-specific footer link sets ────────────────────────────────────────────
const ROLE_FOOTER_CONFIG = {
  doctor: {
    label: 'Doctor Portal',
    services: [
      { name: 'My Consultations',   href: '/doctor/consultations' },
      { name: 'Patient Records',    href: '/doctor/patients' },
      { name: 'Schedule',           href: '/doctor/schedule' },
      { name: 'Earnings',           href: '/doctor/earnings' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Medical Guidelines', href: '/guidelines' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/help' },
      { name: 'Raise a Ticket',     href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  hospital: {
    label: 'Hospital Portal',
    services: [
      { name: 'Dashboard',          href: '/hospital/dashboard' },
      { name: 'Bed Management',     href: '/hospital/beds' },
      { name: 'Staff Directory',    href: '/hospital/staff' },
      { name: 'Reports',            href: '/hospital/reports' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Compliance',         href: '/compliance' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Admin Help',         href: '/help' },
      { name: 'Technical Support',  href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  'care assistant': {
    label: 'Care Assistant',
    services: [
      { name: 'My Dashboard',       href: '/care-assistant/dashboard' },
      { name: 'Availability',       href: '/care-assistant/availability' },
      { name: 'Earnings',           href: '/care-assistant/performance' },
      { name: 'KYC Status',         href: '/care-assistant/kyc/status' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Training Portal',    href: '/care-assistant/training' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/care-assistant/support' },
      { name: 'Raise a Ticket',     href: '/care-assistant/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  transportpartner: {
    label: 'Transport Partner',
    services: [
      { name: 'My Dashboard',       href: '/transport/dashboard' },
      { name: 'Active Rides',       href: '/transport/rides' },
      { name: 'Earnings',           href: '/transport/earnings' },
      { name: 'Vehicle Details',    href: '/transport/vehicle' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Driver Guidelines',  href: '/transport/guidelines' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/help' },
      { name: 'Raise a Ticket',     href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  solodriverpartner: {
    label: 'Solo Driver Partner',
    services: [
      { name: 'My Dashboard',       href: '/transport/dashboard' },
      { name: 'Active Rides',       href: '/transport/rides' },
      { name: 'Earnings',           href: '/transport/earnings' },
      { name: 'Vehicle Details',    href: '/transport/vehicle' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Driver Guidelines',  href: '/transport/guidelines' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/help' },
      { name: 'Raise a Ticket',     href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  driver: {
    label: 'Driver Portal',
    services: [
      { name: 'My Dashboard',       href: '/transport/dashboard' },
      { name: 'Active Rides',       href: '/transport/rides' },
      { name: 'Earnings',           href: '/transport/earnings' },
      { name: 'My Documents',       href: '/transport/documents' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Driver Guidelines',  href: '/transport/guidelines' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/help' },
      { name: 'Raise a Ticket',     href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  pharmacy: {
    label: 'Pharmacy Portal',
    services: [
      { name: 'My Dashboard',       href: '/pharmacy/dashboard' },
      { name: 'Orders',             href: '/pharmacy/orders' },
      { name: 'Inventory',          href: '/pharmacy/inventory' },
      { name: 'Earnings',           href: '/pharmacy/earnings' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Regulatory Docs',    href: '/pharmacy/compliance' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/help' },
      { name: 'Raise a Ticket',     href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  'lab partner': {
    label: 'Lab Partner',
    services: [
      { name: 'My Dashboard',       href: '/lab/dashboard' },
      { name: 'Test Requests',      href: '/lab/requests' },
      { name: 'Reports',            href: '/lab/reports' },
      { name: 'Earnings',           href: '/lab/earnings' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Lab Standards',      href: '/lab/standards' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/help' },
      { name: 'Raise a Ticket',     href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  default: {
    label: 'Healthcare Platform',
    services: [
      { name: 'Consultations',      href: '/consultations' },
      { name: 'Diagnostics',        href: '/diagnostics' },
      { name: 'Pharmacy',           href: '/pharmacy' },
      { name: 'Transportation',     href: '/transport' },
    ],
    company: [
      { name: 'About Us',           href: '/about' },
      { name: 'Contact Support',    href: '/contact' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Center',        href: '/help' },
      { name: 'Partner with Us',    href: '/partner' },
      { name: 'Health Blog',        href: '/blog' },
      { name: 'Emergency Care',     href: '/emergency' },
    ],
  },
};

// ── Footer Component ───────────────────────────────────────────────────────────
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname() || ''; // Added fallback string to avoid null errors

  // Pull authenticated user from Redux
  const user = useSelector((s) => s.user?.user) ?? null;

  // Visibility Logic: Hide on search or ANY route containing 'tracking'
  const isHidden = useMemo(() => {
    return (pathname.startsWith('/rides/') && pathname.endsWith('/tracking')) ||
    pathname.startsWith('/driver/tracking')||
    pathname.includes('/tracking');
  }, [pathname]);

  // Resolve role → theme + link config
  const role      = user?.role ?? null;
  const themeAttr = role ? (ROLE_THEME_MAP[role] ?? null) : null;
  const config    = (role && ROLE_FOOTER_CONFIG[role]) ? ROLE_FOOTER_CONFIG[role] : ROLE_FOOTER_CONFIG.default;

  // Don't render anything if on a hidden route
  if (isHidden) return null;

  return (
    <footer
      {...(themeAttr ? { 'data-theme': themeAttr } : {})}
      className="bg-base-200/50 border-t border-base-300 mt-20 transition-colors duration-300 overflow-hidden relative font-sans"
    >
      {/* Decorative */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none" />

      {/* ── TOP: Newsletter / Tagline ── */}
      <div className="relative border-b border-base-300/50 bg-base-100">
        <div className="container-custom py-16 flex flex-col lg:flex-row items-center justify-between gap-10 relative z-10">
          <div className="max-w-xl text-center lg:text-left space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider border border-primary/20">
              <HeartPulse size={14} />
              <span>{config.label}</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-base-content tracking-tight leading-none">
              Stay <span className="text-gradient-primary">Informed.</span>
            </h3>
            <p className="text-base-content/60 text-base font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
              Get expert health tips and exclusive updates on{' '}
              <span className="text-base-content font-bold">Likeson medical services</span> directly in your inbox.
            </p>
          </div>
        </div>
      </div>

      {/* ── MIDDLE: Links & Branding ── */}
      <div className="container-custom py-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
        <div className="lg:col-span-4 space-y-8 pr-0 lg:pr-12">
          <Link href="/" className="inline-block group">
            <h2 className="text-4xl font-bold text-base-content tracking-tighter group-hover:text-primary transition-colors">
              Likeson<span className="text-primary">.in</span>
            </h2>
          </Link>
          <p className="text-base-content/60 leading-relaxed text-sm font-medium border-l-4 border-primary/20 pl-6">
            Bridging the healthcare gap by delivering essential non-emergency services through modern technology and compassionate on-demand support.
          </p>
          <div className="flex items-center gap-3">
            {[FaFacebook, FaTwitter, FaInstagram, FaLinkedin].map((Icon, i) => (
              <Link
                key={i}
                href="#"
                className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-field)] bg-base-100 border border-base-300 text-base-content/70 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm hover:shadow-primary/30 hover:-translate-y-1"
              >
                <Icon size={18} />
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h4 className="font-bold text-xs uppercase tracking-widest text-base-content/40 mb-8">Services</h4>
          <ul className="space-y-4">
            {config.services.map((link) => (
              <li key={link.name}>
                <Link
                  href={link.href}
                  className="group flex items-center gap-2 text-sm font-medium text-base-content/70 hover:text-primary transition-colors"
                >
                  <span>{link.name}</span>
                  <ArrowUpRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h4 className="font-bold text-xs uppercase tracking-widest text-base-content/40 mb-8">Company</h4>
          <ul className="space-y-4">
            {config.company.map((link) => (
              <li key={link.name}>
                <Link href={link.href} className="text-sm font-medium text-base-content/70 hover:text-primary transition-colors">
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4">
          <div className="glass-card p-8 rounded-[var(--radius-box)] space-y-6">
            <h4 className="font-bold text-xs uppercase tracking-widest text-base-content/40 mb-2">Direct Contact</h4>
            <div className="space-y-5">
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-[var(--radius-field)] bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  <MapPin size={18} className="text-primary group-hover:text-white" />
                </div>
                <span className="text-sm font-medium text-base-content/80 leading-relaxed">
                  Vijayawada & Amaravathi,<br />
                  Andhra Pradesh, India
                </span>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-[var(--radius-field)] bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  <Phone size={18} className="text-primary group-hover:text-white" />
                </div>
                <span className="text-sm font-bold text-base-content">+91 800 123 4567</span>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-[var(--radius-field)] bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  <Mail size={18} className="text-primary group-hover:text-white" />
                </div>
                <a href="mailto:support@likeson.in" className="text-sm font-medium text-primary hover:text-secondary underline decoration-primary/30 underline-offset-4 transition-colors">
                  support@likeson.in
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Legal ── */}
      <div className="border-t border-base-300 py-8 bg-base-100/50 backdrop-blur-sm">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 rounded-full border border-success/20">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold text-success uppercase tracking-wider">System Operational</span>
            </div>
            <p className="text-[11px] text-base-content/40 font-bold uppercase tracking-widest">
              © {currentYear} Likeson Healthcare.
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8">
            <Link href="/privacy" className="text-[11px] font-bold text-base-content/40 hover:text-primary transition-all uppercase tracking-widest">Privacy</Link>
            <Link href="/terms" className="text-[11px] font-bold text-base-content/40 hover:text-primary transition-all uppercase tracking-widest">Terms</Link>
            <div className="flex items-center gap-2 opacity-50">
              <ShieldCheck size={14} className="text-primary" />
              <span className="text-[10px] font-bold text-base-content uppercase tracking-wider">ISO 27001</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;