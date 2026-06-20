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
  FileQuestion, LifeBuoy, MessageCircle, Scale, SquareDashedTopSolid,
  PanelsTopLeft, Car, AlertTriangle, Droplets
} from "lucide-react";
import { FcInvite } from "react-icons/fc";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { name: "Order Medicines",  href: "/pharmacy/buy-medicines", icon: Pill       },
  { name: "Book a Doctor",    href: "/doctors",                icon: UserRound  },
  { name: "Locate Hospitals", href: "/hospitals",              icon: Hospital   },
  { name: "Get Membership",   href: "/membership",             icon: Gem        },
  { name: "Lab Diagnostics",  href: "/diagnostics",            icon: Microscope },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_LINKS = [

  // ── 1. Overview & Analytics ───────────────────────────────────────────────
  {
    title: "Overview & Analytics",
    icons: <LayoutPanelTop size={18} />,
    links: [
      { name: "Dashboard Overview", href: "/super-admin/dashboard",   icon: <LayoutDashboard size={15} /> },
      { name: "Platform Insights",  href: "/super-admin/analytics",   icon: <AreaChart size={15} />       },
      { name: "Referral Engine",    href: "/super-admin/referral",    icon: <FcInvite size={15} />        },
      { name: "Pricing Models",     href: "/super-admin/pricing",     icon: <CircleDollarSign size={15} />},
      { name: "Wallet Ledgers",     href: "/super-admin/wallet",      icon: <WalletCards size={15} />     },
      { name: "Landing Page (Hero)",href: "/super-admin/hero-page",   icon: <PanelsTopLeft size={15} />   },
    ],
  },

  // ── 2. User Management ────────────────────────────────────────────────────
  {
    title: "User Management",
    icons: <Users size={18} />,
    links: [
      { name: "User Directory",     href: "/super-admin/users",           icon: <Users size={15} />      },
      { name: "Audience Analytics", href: "/super-admin/users/analytics", icon: <AreaChart size={15} />  },
      { name: "Access Control",     href: "/super-admin/permissions",     icon: <ShieldAlert size={15} />},
      { name: "Staff Directory",    href: "/super-admin/employees",       icon: <Contact2 size={15} />   },
      { name: "Internal Comms",     href: "/super-admin/chats",           icon: <MessageSquare size={15} />},
      { name: "Video Consults",     href: "/super-admin/meetings",        icon: <Video size={15} />      },
    ],
  },

  // ── 3. Partner Network ────────────────────────────────────────────────────
  {
    title: "Partner Network",
    icons: <Handshake size={18} />,
    links: [
      { name: "Fleet Partners",       href: "/super-admin/partners/transport",      icon: <Truck size={15} />      },
      { name: "Independent Drivers",  href: "/super-admin/partners/solor-driver",   icon: <Car size={15} />        },
      { name: "Gig Caregivers",       href: "/super-admin/partners/care-assistants",icon: <Users2 size={15} />     },
      { name: "Diagnostic Labs",      href: "/super-admin/partners/labs",           icon: <Microscope size={15} /> },
      
    ],
  },

  // ── 4. Pharmacy & Supply Chain ────────────────────────────────────────────
  {
    title: "Pharmacy & Supply Chain",
    icons: <Tablets size={18} />,
    links: [
      { name: "Store Locations",   href: "/super-admin/pharmacy",   icon: <Store size={15} />       },
      { name: "Product Catalogue", href: "/super-admin/medicines",  icon: <Tablets size={15} />     },
      { name: "Inventory Levels",  href: "/super-admin/inventory",  icon: <Package size={15} />     },
      { name: "Fulfillment Orders",href: "/super-admin/orders",     icon: <ShoppingCart size={15} />},
    ],
  },

  // ── 5. Clinical Network ───────────────────────────────────────────────────
  {
    title: "Clinical Network",
    icons: <Hospital size={18} />,
    links: [
      { name: "Hospital Affiliates",    href: "/super-admin/hospitals",        icon: <Hospital size={15} />      },
      { name: "Physician Directory",    href: "/super-admin/doctors",          icon: <UserCog size={15} />       },
      { name: "Clinical Appointments",  href: "/super-admin/appointments",     icon: <CalendarClock size={15} /> },
      { name: "Consultation Management",href: "/super-admin/consultations",    icon: <Activity size={15} />      },
      { name: "Medical Specialties",    href: "/super-admin/specialties",      icon: <Stethoscope size={15} />   },
      { name: "Blood Bank",             href: "/super-admin/blood-bank",       icon: <Droplets size={15} />      },
    ],
  },

  // ── 6. Booking Engine ─────────────────────────────────────────────────────
  {
    title: "Booking Engine",
    icons: <CalendarCheck size={18} />,
    links: [
      { name: "Master Calendar",   href: "/super-admin/bookings",      icon: <CalendarCheck size={15} />},
      { name: "Provider Schedules",href: "/super-admin/schedules",     icon: <CalendarDays size={15} /> },
      { name: "Time Slots",        href: "/super-admin/availability",  icon: <Clock size={15} />        },
    ],
  },

  // ── 7. Financials & Ledger ────────────────────────────────────────────────
  {
    title: "Financials & Ledger",
    icons: <CircleDollarSign size={18} />,
    links: [
      { name: "Payment Gateway",   href: "/super-admin/payments",      icon: <Landmark size={15} />           },
      { name: "Transaction Ledger",href: "/super-admin/transactions",  icon: <ArrowLeftRight size={15} />     },
      { name: "Client Invoices",   href: "/super-admin/invoices",      icon: <ReceiptIndianRupee size={15} /> },
      { name: "Refund Processing", href: "/super-admin/refunds",       icon: <Undo2 size={15} />              },
      { name: "Accounting Console",href: "/super-admin/accounting",    icon: <FileBarChart size={15} />       }, // <-- ADDED HERE
    ],
  },

  // ── 8. Subscriptions ──────────────────────────────────────────────────────
  {
    title: "Subscriptions",
    icons: <Gem size={18} />,
    links: [
      { name: "Plan Tiers",        href: "/super-admin/subscription-plans", icon: <ListChecks size={15} />},
      { name: "Subscriber Base",   href: "/super-admin/subscriptions",      icon: <Gem size={15} />      },
      { name: "Recurring Billing", href: "/super-admin/billing",            icon: <CreditCard size={15} />},
    ],
  },

  // ── 9. Growth & Marketing ─────────────────────────────────────────────────
  {
    title: "Growth & Marketing",
    icons: <Target size={18} />,
    links: [
      { name: "Ad Campaigns",    href: "/super-admin/ads",       icon: <Presentation size={15} /> },
      { name: "App Banners",     href: "/super-admin/banners",   icon: <ImageIcon size={15} />    },
      { name: "Discount Codes",  href: "/super-admin/coupons",   icon: <TicketPercent size={15} />},
      { name: "Marketing Hub",   href: "/super-admin/campaigns", icon: <Target size={15} />       },
    ],
  },

  // ── 10. Content & Communications ──────────────────────────────────────────
  {
    title: "Content & Communications",
    icons: <LifeBuoy size={18} />,
    links: [
      { name: "Platform Announcements", href: "/super-admin/marquee",  icon: <Megaphone size={15} />            },
      { name: "Legal & Compliance",     href: "/super-admin/legal",          icon: <Scale size={15} />                },
      { name: "Knowledge Base",         href: "/super-admin/faq",            icon: <FileQuestion size={15} />         },
      { name: "Push Notifications",     href: "/super-admin/notifications",  icon: <Bell size={15} />                 },
      { name: "Compliance Alerts",      href: "/super-admin/compliance/alerts", icon: <AlertTriangle size={15} />     },
      { name: "Audit Trails",           href: "/super-admin/logs",           icon: <ScrollText size={15} />           },
    ],
  },

  // ── 11. System Settings ───────────────────────────────────────────────────
  {
    title: "System Settings",
    icons: <Settings2 size={18}/>,
    links: [
      { name: "Global Preferences", href: "/super-admin/settings/general",       icon: <Globe2 size={15} />      },
      { name: "Chat Config",        href: "/chat",          icon: <MessageCircle size={15} />},
      { name: "Security Policies",  href: "/super-admin/settings/security",      icon: <ShieldCheck size={15} /> },
      { name: "Third-Party APIs",   href: "/super-admin/settings/integrations",  icon: <Terminal size={15} />    },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_TOP_RIGHT_LINKS = [
  { name: "Home", icon: <LayoutDashboard size={15} /> },
  {
    name: "Quick Actions",
    icon: <Briefcase size={15} />,
    links: [
      { name: "Hospitals", href: "/super-admin/hospitals",  icon: <Hospital size={15} /> },
      { name: "Pharmacies",href: "/super-admin/pharmacies", icon: <Store size={15} />    },
      { name: "Users",     href: "/super-admin/users",      icon: <Users size={15} />    },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_SEARCH_LINKS = [
  // Common Destinations
  [
    { name: "Dashboard",       href: "/super-admin/dashboard",   icon: <LayoutDashboard size={15} /> },
    { name: "Product Catalog", href: "/super-admin/medicines",   icon: <Tablets size={15} />         },
    { name: "Master Calendar", href: "/super-admin/bookings",    icon: <CalendarCheck size={15} />   },
    { name: "Helpdesk",        href: "/super-admin/support",     icon: <LifeBuoy size={15} />        },
    { name: "Ad Campaigns",    href: "/super-admin/ads",         icon: <Presentation size={15} />    },
    { name: "App Banners",     href: "/super-admin/banners",     icon: <ImageIcon size={15} />       },
    { name: "Discount Codes",  href: "/super-admin/coupons",     icon: <TicketPercent size={15} />   },
  ],
  // Creation Actions
  [
    { name: "Add New Medicine",  href: "/super-admin/medicines/create", icon: <Plus size={15} />         },
    { name: "Create Coupon",     href: "/super-admin/coupons/create",   icon: <TicketPercent size={15} />},
    { name: "New Announcement",  href: "/super-admin/announcements",    icon: <Megaphone size={15} />    },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const PROFILE_LINKS = [
  { name: "My Profile",       href: "/super-admin/profile",           icon: <UserRound size={15} />  },
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