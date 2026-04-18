'use client'
// constants/Solodriverpartnerlinks.js
import {
  // Profile & Identity
  UserRound,
  BadgeCheck,
  Contact2,
  MapPin,
  Briefcase,
  FileUser,
  ShieldAlert,
  KeyRound,
  Smartphone,
  MonitorSmartphone,
  // KYC & Compliance
  ScanLine,
  FileCheck2,
  HeartPulse,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  // Vehicle
  Car,
  FileText,
  Wrench,
  Navigation,
  // Bank & Earnings
  Landmark,
  ReceiptIndianRupee,
  WalletCards,
  ArrowDownToLine,
  // Availability & Zones
  ToggleRight,
  Map,
  Plus,
  Trash2,
  // Pricing
  CircleDollarSign,
  Tag,
  // Stats & Ratings
  BarChart3,
  Star,
  TrendingUp,
  // Security & Notifications
  Bell,
  History,
  Lock,
  // Settings
  Settings2,
  LayoutDashboard,
} from "lucide-react";

 
export const SOLO_DRIVER_PARTNER_LINKS = [

  // ── 1. Dashboard ─────────────────────────────────────────────────────────
  // Quick-glance overview: ride stats, earnings summary, compliance alerts.
  {
    title: "Dashboard",
    icons: <LayoutDashboard />,
    links: [
      { name: "Overview",         href: "/partner/solo/dashboard",        icon: <LayoutDashboard size={18} /> },
      { name: "Stats",            href: "/partner/solo/stats",            icon: <BarChart3 size={18} />       },
      { name: "My Rating",        href: "/partner/solo/rating",           icon: <Star size={18} />            },
      { name: "Performance",      href: "/partner/solo/performance",      icon: <TrendingUp size={18} />      },
    ],
  },

  // ── 2. My Profile ─────────────────────────────────────────────────────────
 
  {
    title: "My Profile",
    icons: <UserRound />,
    links: [
      { name: "Personal Details",   href: "/partner/solo/profile",                    icon: <UserRound size={18} />  },
      { name: "Contact Info",       href: "/partner/solo/profile/contact",             icon: <Contact2 size={18} />   },
      { name: "Address",            href: "/partner/solo/profile/address",             icon: <MapPin size={18} />     },
      { name: "Professional Info",  href: "/partner/solo/profile/professional",        icon: <Briefcase size={18} />  },
      { name: "Emergency Contact",  href: "/partner/solo/profile/emergency",           icon: <ShieldAlert size={18} />},
      { name: "Certificates",       href: "/partner/solo/profile/certificates",        icon: <FileUser size={18} />   },
    ],
  },

  // ── 3. KYC & Verification ─────────────────────────────────────────────────
 
  {
    title: "KYC & Verification",
    icons: <BadgeCheck />,
    links: [
      { name: "KYC Status",         href: "/partner/solo/kyc",              icon: <ScanLine size={18} />     },
      { name: "Submit Documents",   href: "/partner/solo/kyc/submit",       icon: <FileCheck2 size={18} />   },
      { name: "Medical Fitness",    href: "/partner/solo/kyc/medical",      icon: <HeartPulse size={18} />   },
      { name: "PSV Badge",          href: "/partner/solo/kyc/psv",          icon: <ShieldCheck size={18} />  },
    ],
  },

  // ── 4. Vehicle ────────────────────────────────────────────────────────────
 
  {
    title: "Vehicle",
    icons: <Car />,
    links: [
      { name: "Vehicle Details",    href: "/partner/solo/vehicle",              icon: <Car size={18} />         },
      { name: "Vehicle Documents",  href: "/partner/solo/vehicle/documents",    icon: <FileText size={18} />    },
      { name: "Features & Extras",  href: "/partner/solo/vehicle/features",     icon: <Wrench size={18} />      },
      { name: "Update Location",    href: "/partner/solo/vehicle/location",     icon: <Navigation size={18} />  },
    ],
  },

  // ── 5. Bank & Earnings ────────────────────────────────────────────────────
   
  {
    title: "Bank & Earnings",
    icons: <Landmark />,
    links: [
      { name: "Bank Details",       href: "/partner/solo/bank",             icon: <Landmark size={18} />           },
      { name: "Settlement History", href: "/partner/solo/settlement",       icon: <ReceiptIndianRupee size={18} /> },
      { name: "Wallet",             href: "/partner/solo/wallet",           icon: <WalletCards size={18} />        },
      { name: "Payouts",            href: "/partner/solo/payouts",          icon: <ArrowDownToLine size={18} />    },
    ],
  },

  // ── 6. Availability & Zones ───────────────────────────────────────────────
 
  {
    title: "Availability & Zones",
    icons: <ToggleRight />,
    links: [
      { name: "Go Online / Offline", href: "/partner/solo/availability",          icon: <ToggleRight size={18} /> },
      { name: "Service Zones",       href: "/partner/solo/service-zones",         icon: <Map size={18} />         },
      { name: "Add Zone",            href: "/partner/solo/service-zones/add",     icon: <Plus size={18} />        },
    ],
  },

  // ── 7. Pricing ────────────────────────────────────────────────────────────
 
  {
    title: "Pricing",
    icons: <CircleDollarSign />,
    links: [
      { name: "My Pricing Config",   href: "/partner/solo/pricing",          icon: <Tag size={18} />              },
      { name: "Platform Fee Info",   href: "/partner/solo/pricing/platform", icon: <CircleDollarSign size={18} /> },
    ],
  },

  // ── 8. Compliance ─────────────────────────────────────────────────────────
  
  {
    title: "Compliance",
    icons: <ClipboardList />,
    links: [
      { name: "Document Expiry",    href: "/partner/solo/compliance",         icon: <ClipboardList size={18} /> },
      { name: "Expiry Alerts",      href: "/partner/solo/compliance/alerts",  icon: <AlertTriangle size={18} /> },
    ],
  },

  // ── 9. Security ───────────────────────────────────────────────────────────
 
  {
    title: "Security",
    icons: <Lock />,
    links: [
      { name: "Active Sessions",    href: "/partner/solo/security/sessions",         icon: <History size={18} />        },
      { name: "Registered Devices", href: "/partner/solo/security/devices",          icon: <MonitorSmartphone size={18} />},
      { name: "Change Password",    href: "/partner/solo/security/change-password",  icon: <KeyRound size={18} />       },
    ],
  },

  // ── 10. Notifications & Settings ─────────────────────────────────────────
 
  {
    title: "Notifications & Settings",
    icons: <Bell />,
    links: [
      { name: "Notifications",        href: "/partner/solo/notifications",       icon: <Bell size={18} />      },
      { name: "Notification Prefs",   href: "/partner/solo/settings",            icon: <Settings2 size={18} /> },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SOLO DRIVER PARTNER — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_TOP_RIGHT_LINKS = [
  { name: "Home", icon: <LayoutDashboard size={18} /> },
  {
    name: "Quick Actions",
    icon: <Briefcase size={18} />,
    links: [
      { name: "Go Online",        href: "/partner/solo/availability",        icon: <ToggleRight size={18} /> },
      { name: "Update Location",  href: "/partner/solo/vehicle/location",    icon: <Navigation size={18} />  },
      { name: "Compliance Check", href: "/partner/solo/compliance",          icon: <ClipboardList size={18} />},
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SOLO DRIVER PARTNER — COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_SEARCH_LINKS = [
  // Frequently visited
  [
    { name: "Dashboard",        href: "/partner/solo/dashboard",               icon: <LayoutDashboard size={18} /> },
    { name: "KYC Status",       href: "/partner/solo/kyc",                     icon: <ScanLine size={18} />        },
    { name: "My Vehicle",       href: "/partner/solo/vehicle",                 icon: <Car size={18} />             },
    { name: "Availability",     href: "/partner/solo/availability",            icon: <ToggleRight size={18} />     },
    { name: "Compliance",       href: "/partner/solo/compliance",              icon: <ClipboardList size={18} />   },
    { name: "Settlement",       href: "/partner/solo/settlement",              icon: <ReceiptIndianRupee size={18} />},
    { name: "Notifications",    href: "/partner/solo/notifications",           icon: <Bell size={18} />            },
  ],
  // Quick actions
  [
    { name: "Add Service Zone", href: "/partner/solo/service-zones/add",      icon: <Plus size={18} />            },
    { name: "Change Password",  href: "/partner/solo/security/change-password",icon: <KeyRound size={18} />       },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN (Solo Driver Partner)
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_PROFILE_LINKS = [
  { name: "My Profile",        href: "/partner/solo/profile",          icon: <UserRound size={18} />  },
  { name: "Account Settings",  href: "/partner/solo/settings",         icon: <Settings2 size={18} />  },
  { name: "Security",          href: "/partner/solo/security/sessions",icon: <Lock size={18} />       },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_SHORTCUTS = [
  { name: "Command Palette",  keys: "Cmd + K" },
  { name: "Search",           keys: "Cmd + S" },
  { name: "Toggle Online",    keys: "Cmd + O" },
  { name: "Logout",           keys: "Cmd + Q" },
];