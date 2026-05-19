import React from "react";
import {
  // General & Branding
  Pill, UserRound, Hospital, Activity, ArrowLeftRight, LayoutPanelTop,
  LayoutDashboard, AreaChart, Building2,
  // User & Access
  Users, UserPlus, ShieldCheck, Contact2, MessageSquare, Video,
  // Financial
  CircleDollarSign, ReceiptIndianRupee, FileBarChart, WalletCards,
  CreditCard, Undo2, Landmark,
  // Healthcare Specific
  Network, UserCog, CalendarClock, CalendarCheck, Clock, CalendarDays,
  Stethoscope, HeartPulse, Microscope,
  // Logistics & Pharmacy
  Warehouse, Package, Truck, ShoppingCart, Store, Tablets,
  // Subscription & Admin
  Gem, ListChecks, ScrollText, History, MonitorSmartphone, Bell,
  // Partnership & Growth
  Handshake, HeartHandshake, Users2, Star, Briefcase,
  // Marketing
  Megaphone, Target, TicketPercent, Presentation, Image as ImageIcon,
  Share2, Mail,
  // Systems
  Settings2, ShieldAlert, Globe2, Component, Terminal, Plus,
  FileQuestion, LifeBuoy,
  MessageCircle,
  Scale,
  SquareDashedTopSolid,
  PanelsTopLeft,
  Car,
  AlertTriangle,
  Droplets
} from "lucide-react";
import { FcInvite } from "react-icons/fc";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { name: "Buy Medicines",    href: "/pharmacy/buy-medicines", icon: Pill       },
  { name: "Find Doctors",     href: "/doctors",                icon: UserRound  },
  { name: "Find Hospitals",   href: "/hospitals",              icon: Hospital   },
  { name: "Buy Membership",   href: "/membership",             icon: Gem        },
  { name: "Diagnostics",      href: "/diagnostics",            icon: Microscope },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_LINKS = [

  // ── 1. Command Centre ────────────────────────────────────────────────────
  // The top-level pulse: overview metrics, analytics, org tree, referrals,
  // pricing levers, wallet flows, and the public hero page.
  {
    title: "Command Centre",
    icons: <LayoutPanelTop size={18} />,
    links: [
      { name: "Overview",         href: "/super-admin/dashboard",   icon: <LayoutDashboard size={15} />      },
      { name: "Analytics",        href: "/super-admin/analytics",   icon: <AreaChart size={15} />            },
      { name: "Referral Program", href: "/super-admin/referral",    icon: <FcInvite size={15} />             },
      { name: "Platform Pricing", href: "/super-admin/pricing",     icon: <CircleDollarSign size={15} />     },
      { name: "Wallet Management",href: "/super-admin/wallet",      icon: <WalletCards size={15} />          },
      { name: "Hero Page",        href: "/super-admin/hero-page",   icon: <PanelsTopLeft size={15} />        },
    ],
  },

  // ── 2. People & Access ───────────────────────────────────────────────────
  // Every human on the platform: patients/users, internal employees,
  // role-based permissions, and real-time comms (chats + meetings).
  {
    title: "People & Access",
    icons: <Users size={18} />,
    links: [
      { name: "All Users",        href: "/super-admin/users",             icon: <Users size={15} />      },
      { name: "User Analytics",   href: "/super-admin/users/analytics",   icon: <AreaChart size={15} />  },
      { name: "Roles & Permissions",href: "/super-admin/permissions",     icon: <ShieldAlert size={15} />},
      { name: "Employees",        href: "/super-admin/employees",         icon: <Contact2 size={15} />   },
      { name: "Chats",            href: "/super-admin/chats",             icon: <MessageSquare size={15} />},
      { name: "Meetings",         href: "/super-admin/meetings",          icon: <Video size={15} />      },
    ],
  },

  // ── 3. Partners & Members ────────────────────────────────────────────────
  // External stakeholders who deliver services: transport, gig care,
  // diagnostic labs, B2B institutions, plus the loyalty member directory.
  {
    title: "Partners & Members",
    icons: <Handshake size={18} />,
    links: [
      { name: "Transport Partners",   href: "/super-admin/partners/transport",      icon: <Truck size={15} />      },
      { name: "Solo Transport Partners",   href: "/super-admin/partners/solor-driver",      icon: <Car size={15} />      },
      { name: "Care Assistants (Gig)",href: "/super-admin/partners/care-assistants",icon: <Users2 size={15} />     },
      { name: "Diagnostic Labs",      href: "/super-admin/partners/labs",           icon: <Microscope size={15} /> },
      { name: "B2B / Institutional",  href: "/super-admin/partners/institutional",  icon: <Handshake size={15} />  },
      { name: "Member Directory",     href: "/super-admin/members/directory",       icon: <Users size={15} />      },
      { name: "Loyalty & Rewards",    href: "/super-admin/members/loyalty",         icon: <Star size={15} />       },
    ],
  },

  // ── 4. Pharmacy & Inventory ──────────────────────────────────────────────
  // The end-to-end medicine supply chain: stores, catalogue, stock,
  // and customer orders.
  {
    title: "Pharmacy & Inventory",
    icons: <Tablets size={18} />,
    links: [
      { name: "Pharmacy Stores", href: "/super-admin/pharmacy",   icon: <Store size={15} />       },
      { name: "Medicine Catalogue",href: "/super-admin/medicines", icon: <Tablets size={15} />    },
      { name: "Stock & Inventory",href: "/super-admin/inventory", icon: <Package size={15} />     },
      { name: "Orders",          href: "/super-admin/orders",     icon: <ShoppingCart size={15} />},
    ],
  },

  // ── 5. Clinical Operations ───────────────────────────────────────────────
  // Hospitals, affiliated doctors, appointment pipeline,
  // and specialty management.
  {
    title: "Clinical Operations",
    icons: <Hospital size={18} />,
    links: [
      { name: "Hospitals",     href: "/super-admin/hospitals",    icon: <Hospital size={15} />      },
      { name: "Doctors",       href: "/super-admin/doctors",      icon: <UserCog size={15} />       },
      { name: "Appointments",  href: "/super-admin/appointments", icon: <CalendarClock size={15} /> },
      { name: "Specialties",   href: "/super-admin/specialties",  icon: <Stethoscope size={15} />   },
      {name:"Blood Bank", href: "/super-admin/blood-bank",  icon: <Droplets size={15} />   },
    ],
  },

  // ── 6. Scheduling & Availability ────────────────────────────────────────
  // All bookings across the platform, doctor/clinic schedules,
  // and real-time availability slots.
  {
    title: "Scheduling & Availability",
    icons: <CalendarCheck size={18} />,
    links: [
      { name: "All Bookings",  href: "/super-admin/bookings",      icon: <CalendarCheck size={15} />},
      { name: "Schedules",     href: "/super-admin/schedules",     icon: <CalendarDays size={15} /> },
      { name: "Availability",  href: "/super-admin/availability",  icon: <Clock size={15} />        },
    ],
  },

  // ── 7. Finance & Payments ────────────────────────────────────────────────
  // Money in and money out: gateway settlements, transaction ledger,
  // invoices issued, and refund processing.
  {
    title: "Finance & Payments",
    icons: <CircleDollarSign size={18} />,
    links: [
      { name: "Payments",      href: "/super-admin/payments",      icon: <Landmark size={15} />           },
      { name: "Transactions",  href: "/super-admin/transactions",  icon: <ArrowLeftRight size={15} />     },
      { name: "Invoices",      href: "/super-admin/invoices",      icon: <ReceiptIndianRupee size={15} /> },
      { name: "Refunds",       href: "/super-admin/refunds",       icon: <Undo2 size={15} />              },
    ],
  },

  // ── 8. Subscriptions & Billing ──────────────────────────────────────────
  // Membership plan design, active subscriber management,
  // and recurring billing cycle oversight.
  {
    title: "Subscriptions & Billing",
    icons: <Gem size={18} />,
    links: [
      { name: "Membership Plans",       href: "/super-admin/subscription-plans", icon: <ListChecks size={15} />},
      { name: "Active Subscriptions",   href: "/super-admin/subscriptions",      icon: <Gem size={15} />      },
      { name: "Billing Cycles",         href: "/super-admin/billing",            icon: <CreditCard size={15} />},
    ],
  },

  // ── 9. Marketing & Growth ────────────────────────────────────────────────
  // Everything that drives acquisition and retention: ad campaigns,
  // banners, promo coupons, and targeted growth campaigns.
  {
    title: "Marketing & Growth",
    icons: <Megaphone size={18} />,
    links: [
      { name: "Advertisements", href: "/super-admin/ads",       icon: <Presentation size={15} /> },
      { name: "Banners",        href: "/super-admin/banners",   icon: <ImageIcon size={15} />    },
      { name: "Promo Coupons",  href: "/super-admin/coupons",   icon: <TicketPercent size={15} />},
      { name: "Campaigns",      href: "/super-admin/campaigns", icon: <Target size={15} />       },
    ],
  },

  // ── 10. Support & Content ────────────────────────────────────────────────
  // User-facing support tickets, legal/compliance docs, FAQs,
  // running marquee text, push notifications, and full audit logs.
  {
    title: "Support & Content",
    icons: <LifeBuoy size={18} />,
    links: [
      { name: "Support Tickets",  href: "/super-admin/support",        icon: <LifeBuoy size={15} />             },
      { name: "Legal Documents",  href: "/super-admin/legal",          icon: <Scale size={15} />                },
      { name: "FAQs",             href: "/super-admin/faq",            icon: <FileQuestion size={15} />         },
      { name: "Marquee",          href: "/super-admin/marquee",        icon: <SquareDashedTopSolid size={15} /> },
      { name: "Notifications",    href: "/super-admin/notifications",  icon: <Bell size={15} />                 },
      { name: "Expiry Alerts",      href: "/super-admin/compliance/alerts",  icon: <AlertTriangle size={15} /> },
      { name: "Logs & Audit",     href: "/super-admin/logs",           icon: <ScrollText size={15} />           },
    ],
  },

  // ── 11. System & Configuration ───────────────────────────────────────────
  // Platform-level settings: global config, internal chat tooling,
  // security policies, and third-party API integrations.
  {
    title: "System & Configuration",
    icons: <Settings2 size={18}/>,
    links: [
      { name: "General Settings",   href: "/super-admin/settings/general",       icon: <Globe2 size={15} />      },
      { name: "Chat Management",    href: "/dashboard/chat/management",           icon: <MessageCircle size={15} />},
      { name: "Security & Privacy", href: "/super-admin/settings/security",      icon: <ShieldCheck size={15} /> },
      { name: "API & Integrations", href: "/super-admin/settings/integrations",  icon: <Terminal size={15} />    },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_TOP_RIGHT_LINKS = [
  { name: "Home", icon: <LayoutDashboard size={15} /> },
  {
    name: "Quick Manage",
    icon: <Briefcase size={15} />,
    links: [
      { name: "Hospitals", href: "/super-admin/hospitals",  icon: <Hospital size={15} /> },
      { name: "Pharmacy",  href: "/super-admin/pharmacies", icon: <Store size={15} />    },
      { name: "Users",     href: "/super-admin/users",      icon: <Users size={15} />    },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_SEARCH_LINKS = [
  // Recent / commonly visited
  [
    { name: "Dashboard",    href: "/super-admin/dashboard",   icon: <LayoutDashboard size={15} /> },
    { name: "Medicines",    href: "/super-admin/medicines",   icon: <Tablets size={15} />         },
    { name: "Bookings",     href: "/super-admin/bookings",    icon: <CalendarCheck size={15} />   },
    { name: "Support",      href: "/super-admin/support",     icon: <LifeBuoy size={15} />        },
    { name: "Ads",          href: "/super-admin/ads",         icon: <Presentation size={15} />    },
    { name: "Banners",      href: "/super-admin/banners",     icon: <ImageIcon size={15} />       },
    { name: "Coupons",      href: "/super-admin/coupons",     icon: <TicketPercent size={15} />   },
  ],
  // Quick create actions
  [
    { name: "Add New Medicine",  href: "/super-admin/medicines/create", icon: <Plus size={15} />         },
    { name: "Create Coupon",     href: "/super-admin/coupons/create",   icon: <TicketPercent size={15} />},
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const PROFILE_LINKS = [
  { name: "My Profile",       href: "/super-admin/profile",           icon: <UserRound size={15} />  },
  { name: "Account Settings", href: "/super-admin/account-settings",  icon: <Settings2 size={15} />  },
  { name: "Activity Log",     href: "/super-admin/activity-log",      icon: <HeartPulse size={15} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const SHORTCUTS = [
  { name: "Command Palette", keys: "Cmd + K" },
  { name: "Search",          keys: "Cmd + S" },
  { name: "Logout",          keys: "Cmd + Q" },
];