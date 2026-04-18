/**
 * LAB PARTNER NAVIGATION LINKS
 * Extracted from the Lab Partner Router — Likeson.in
 
 *
 * Used by: LabPartnerDashboard, Sidebar, MobileNav
 */

import {
  LayoutDashboard,
  User,
  FlaskConical,
  Package,
  ShieldCheck,
  FileText,
  ClipboardList,
  Star,
  Settings,
  Sliders,
  Monitor,
  Bell,
  Users,
  Clock,
  Image,
  Lock,
  Mail,
  Smartphone,
  History,
  Activity,
  AreaChart,
  CreditCard,
  Microscope,
  ScrollText,
  BadgeCheck,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TOP-LEVEL SIDEBAR GROUPS  (Lab Partner only)
// Maps 1-to-1 with the router sections
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_PARTNER_NAV = [
  // ── 1. Dashboard & Analytics ──────────────────────────────────────────────
  // GET /api/labs/partner/me/dashboard
  // GET /api/labs/partner/me/analytics/reviews
  {
    group: "Overview",
    links: [
      {
        name: "Dashboard",
        href: "/lab-partner/dashboard",
        icon: LayoutDashboard,
        description: "High-level stats and recent activity",
        api: "GET /api/labs/partner/me/dashboard",
      },
      {
        name: "Review Analytics",
        href: "/lab-partner/analytics/reviews",
        icon: AreaChart,
        description: "Rating breakdown and 6-month trend",
        api: "GET /api/labs/partner/me/analytics/reviews",
      },
    ],
  },

  // ── 2. Profile ────────────────────────────────────────────────────────────
  // GET  /api/labs/partner/me
  // PATCH /api/labs/partner/me
  // PATCH /api/labs/partner/me/bank-details
  {
    group: "Profile",
    links: [
      {
        name: "My Profile",
        href: "/lab-partner/profile",
        icon: User,
        description: "View and update your lab profile",
        api: "GET | PATCH /api/labs/partner/me",
      },
      {
        name: "Bank Details",
        href: "/lab-partner/profile/bank-details",
        icon: CreditCard,
        description: "Payout bank account information",
        api: "PATCH /api/labs/partner/me/bank-details",
      },
    ],
  },

  // ── 3. Tests & Packages ───────────────────────────────────────────────────
  // GET | POST          /api/labs/partner/me/tests
  // PATCH | DELETE      /api/labs/partner/me/tests/:testId
  // GET | POST          /api/labs/partner/me/packages
  // PATCH | DELETE      /api/labs/partner/me/packages/:pkgId
  {
    group: "Catalogue",
    links: [
      {
        name: "Lab Tests",
        href: "/lab-partner/tests",
        icon: FlaskConical,
        description: "Manage your diagnostic test catalogue",
        api: "GET | POST | PATCH | DELETE /api/labs/partner/me/tests",
      },
      {
        name: "Packages",
        href: "/lab-partner/packages",
        icon: Package,
        description: "Health check-up bundles and offers",
        api: "GET | POST | PATCH | DELETE /api/labs/partner/me/packages",
      },
    ],
  },

  // ── 4. Documents & Compliance ─────────────────────────────────────────────
  // GET  /api/labs/partner/me/accreditations
  // POST /api/labs/partner/me/accreditations
  // POST /api/labs/partner/me/compliance-docs
  {
    group: "Documents",
    links: [
      {
        name: "Accreditations",
        href: "/lab-partner/accreditations",
        icon: BadgeCheck,
        description: "NABL, ISO and other certifications",
        api: "GET | POST /api/labs/partner/me/accreditations",
      },
      {
        name: "Compliance Docs",
        href: "/lab-partner/compliance-docs",
        icon: FileText,
        description: "Regulatory documents and licences",
        api: "POST /api/labs/partner/me/compliance-docs",
      },
    ],
  },

  // ── 5. Reviews & Status ───────────────────────────────────────────────────
  // GET /api/labs/partner/me/reviews
  // GET /api/labs/partner/me/status-log
  {
    group: "Reputation",
    links: [
      {
        name: "Reviews",
        href: "/lab-partner/reviews",
        icon: Star,
        description: "Customer feedback and ratings",
        api: "GET /api/labs/partner/me/reviews",
      },
      {
        name: "Status Log",
        href: "/lab-partner/status-log",
        icon: ScrollText,
        description: "Account approval and suspension history",
        api: "GET /api/labs/partner/me/status-log",
      },
    ],
  },

  // ── 6. Notifications ─────────────────────────────────────────────────────
  // GET    /api/labs/partner/me/notifications
  // PATCH  /api/labs/partner/me/notifications/:id/read
  // PATCH  /api/labs/partner/me/notifications/read-all
  // DELETE /api/labs/partner/me/notifications/:id
  // DELETE /api/labs/partner/me/notifications
  {
    group: "Notifications",
    links: [
      {
        name: "Notifications",
        href: "/lab-partner/notifications",
        icon: Bell,
        description: "In-app alerts and announcements",
        api: "GET | PATCH | DELETE /api/labs/partner/me/notifications",
      },
    ],
  },

  // ── 7. Settings ───────────────────────────────────────────────────────────
  // GET   /api/labs/partner/me/settings
  // PATCH /api/labs/partner/me/settings/operational
  // PATCH /api/labs/partner/me/settings/display
  // PATCH /api/labs/partner/me/settings/notifications
  // PATCH /api/labs/partner/me/settings/contact-persons
  // PATCH /api/labs/partner/me/settings/timing
  // PATCH /api/labs/partner/me/settings/images
  {
    group: "Settings",
    links: [
      {
        name: "General Settings",
        href: "/lab-partner/settings",
        icon: Settings,
        description: "All configurable preferences",
        api: "GET /api/labs/partner/me/settings",
      },
      {
        name: "Operational",
        href: "/lab-partner/settings/operational",
        icon: Sliders,
        description: "Collection mode, radius, TAT, payout",
        api: "PATCH /api/labs/partner/me/settings/operational",
      },
      {
        name: "Display",
        href: "/lab-partner/settings/display",
        icon: Monitor,
        description: "Description, website URL, tags",
        api: "PATCH /api/labs/partner/me/settings/display",
      },
      {
        name: "Notification Prefs",
        href: "/lab-partner/settings/notifications",
        icon: Bell,
        description: "Email and SMS preference toggles",
        api: "PATCH /api/labs/partner/me/settings/notifications",
      },
      {
        name: "Contact Persons",
        href: "/lab-partner/settings/contact-persons",
        icon: Users,
        description: "Lab director, ops head contacts",
        api: "PATCH /api/labs/partner/me/settings/contact-persons",
      },
      {
        name: "Operating Hours",
        href: "/lab-partner/settings/timing",
        icon: Clock,
        description: "Daily open/close schedule",
        api: "PATCH /api/labs/partner/me/settings/timing",
      },
      {
        name: "Lab Images",
        href: "/lab-partner/settings/images",
        icon: Image,
        description: "Logo and cover photo",
        api: "PATCH /api/labs/partner/me/settings/images",
      },
    ],
  },

  // ── 8. Security ───────────────────────────────────────────────────────────
  // PATCH  /api/labs/partner/me/change-password
  // POST   /api/labs/partner/me/security/request-email-change
  // PATCH  /api/labs/partner/me/security/confirm-email-change
  // GET    /api/labs/partner/me/security/sessions
  // DELETE /api/labs/partner/me/security/sessions/:sessionId
  // DELETE /api/labs/partner/me/security/sessions
  // GET    /api/labs/partner/me/security/login-history
  // POST   /api/labs/partner/me/security/send-verification-otp
  // POST   /api/labs/partner/me/security/verify-email
  {
    group: "Security",
    links: [
      {
        name: "Change Password",
        href: "/lab-partner/security/change-password",
        icon: Lock,
        description: "Update your account password",
        api: "PATCH /api/labs/partner/me/change-password",
      },
      {
        name: "Email & Verification",
        href: "/lab-partner/security/email",
        icon: Mail,
        description: "Change or verify your email address",
        api: "POST | PATCH /api/labs/partner/me/security/*-email*",
      },
      {
        name: "Active Sessions",
        href: "/lab-partner/security/sessions",
        icon: Smartphone,
        description: "View and revoke logged-in devices",
        api: "GET | DELETE /api/labs/partner/me/security/sessions",
      },
      {
        name: "Login History",
        href: "/lab-partner/security/login-history",
        icon: History,
        description: "Recent login attempts and audit log",
        api: "GET /api/labs/partner/me/security/login-history",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLAT LIST — for command palette / spotlight search
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_PARTNER_ALL_LINKS = LAB_PARTNER_NAV.flatMap((group) =>
  group.links.map((link) => ({ ...link, group: group.group }))
);

// ─────────────────────────────────────────────────────────────────────────────
// QUICK-ACCESS  — pinned to mobile bottom bar and desktop topbar
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_PARTNER_QUICK_LINKS = [
  { name: "Dashboard",   href: "/lab-partner/dashboard",   icon: LayoutDashboard },
  { name: "Tests",       href: "/lab-partner/tests",        icon: FlaskConical    },
  { name: "Packages",   href: "/lab-partner/packages",     icon: Package         },
  { name: "Reviews",    href: "/lab-partner/reviews",      icon: Star            },
  { name: "Settings",   href: "/lab-partner/settings",     icon: Settings        },
];

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STAT CARDS  — maps to /partner/me/dashboard API response fields
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_DASHBOARD_STAT_KEYS = [
  { key: "tests.active",       label: "Active Tests",    icon: FlaskConical,    color: "primary"  },
  { key: "packages.active",    label: "Active Packages", icon: Package,         color: "secondary" },
  { key: "rating.average",     label: "Avg Rating",      icon: Star,            color: "warning"  },
  { key: "rating.total",       label: "Total Reviews",   icon: Activity,        color: "info"     },
  { key: "documents.pending",  label: "Docs Pending",    icon: ClipboardList,   color: "error"    },
];