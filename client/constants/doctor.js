import React from "react";
import {
  // Identity & Profile
  UserCog, Stethoscope, Award, Languages, Camera,
  // Scheduling & Availability
  CalendarCheck, CalendarDays, Clock, CalendarClock,
  // Clinical
  HeartPulse, Activity, ClipboardList, Users,
  // Finance & Payments
  Landmark, CreditCard, ReceiptIndianRupee, Wallet,
  CircleDollarSign, ArrowLeftRight,
  // KYC & Security
  ShieldCheck, FileText, ScanLine, KeyRound,
  // Settings & Notifications
  Settings2, Bell, ToggleRight, Wifi,
  // Hospitals
  Hospital, Building2, MapPin,
  // Dashboard
  LayoutDashboard, AreaChart, TrendingUp, Star,
  // Misc
  LifeBuoy, MessageSquare, Video, Phone,
  UserRound,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR SIDEBAR NAVIGATION
// Mirrors routes in hospitalRoutes.js (Doctor Self-Service + shared routes)
// ─────────────────────────────────────────────────────────────────────────────

export const DOCTOR_DASHBOARD_LINKS = [

  // ── 1. Overview ──────────────────────────────────────────────────────────
  // Personal performance metrics, today's schedule summary, rating snapshot.
  {
    title: "Overview",
    icons: <LayoutDashboard />,
    links: [
      { name: "Dashboard",           href: "/doctor/dashboard",             icon: <LayoutDashboard size={18} />  },
      { name: "Analytics",           href: "/doctor/analytics",             icon: <AreaChart size={18} />        },
      { name: "Performance",         href: "/doctor/performance",           icon: <TrendingUp size={18} />       },
      { name: "My Stats",            href: "/doctor/stats",                 icon: <Activity size={18} />         },
    ],
  },

  // ── 2. My Profile ────────────────────────────────────────────────────────
  // Mirrors: GET/PUT /doctors/me  →  /doctors/:id/profile
  {
    title: "My Profile",
    icons: <UserCog />,
    links: [
      { name: "Profile Overview",    href: "/doctor/profile",               icon: <UserRound size={18} />        },
      { name: "Professional Info",   href: "/doctor/profile/professional",  icon: <Stethoscope size={18} />      },
      { name: "Qualifications",      href: "/doctor/profile/qualifications", icon: <Award size={18} />           },
      { name: "Languages & Bio",     href: "/doctor/profile/bio",           icon: <Languages size={18} />        },
      { name: "Consultation Fees",   href: "/doctor/profile/fees",          icon: <CircleDollarSign size={18} /> },
      { name: "Profile Photo",       href: "/doctor/profile/photo",         icon: <Camera size={18} />           },
    ],
  },

  // ── 3. Appointments & Schedule ───────────────────────────────────────────
  // Mirrors: GET/PUT /doctors/:id/availability
  {
    title: "Appointments & Schedule",
    icons: <CalendarCheck />,
    links: [
      { name: "My Appointments",     href: "/doctor/appointments",          icon: <CalendarClock size={18} />    },
      { name: "Availability Slots",  href: "/doctor/availability",          icon: <Clock size={18} />            },
      { name: "Weekly Schedule",     href: "/doctor/schedule",              icon: <CalendarDays size={18} />     },
      { name: "Consultation Types",  href: "/doctor/consultation-types",    icon: <ClipboardList size={18} />    },
    ],
  },

  // ── 4. Consultations ─────────────────────────────────────────────────────
  {
    title: "Consultations",
    icons: <HeartPulse />,
    links: [
      { name: "Video Consultations", href: "/doctor/consultations/video",   icon: <Video size={18} />            },
      { name: "In-Person Queue",     href: "/doctor/consultations/inperson", icon: <Users size={18} />           },
      { name: "Chat Consultations",  href: "/doctor/consultations/chat",    icon: <MessageSquare size={18} />    },
      { name: "Home Visit Requests", href: "/doctor/consultations/home",    icon: <Phone size={18} />            },
    ],
  },

  // ── 5. My Hospitals ──────────────────────────────────────────────────────
  // Mirrors: GET /doctors/me/hospitals
  {
    title: "My Hospitals",
    icons: <Hospital />,
    links: [
      { name: "All My Hospitals",    href: "/doctor/hospitals",             icon: <Building2 size={18} />        },
      { name: "Primary Hospital",    href: "/doctor/hospitals/primary",     icon: <Hospital size={18} />         },
      { name: "Other Affiliations",  href: "/doctor/hospitals/affiliated",  icon: <MapPin size={18} />           },
      { name: "Managed Hospitals",   href: "/doctor/hospitals/managed",     icon: <Star size={18} />             },
    ],
  },

  // ── 6. Finance & Earnings ────────────────────────────────────────────────
  // Mirrors: PUT /doctors/:id/bank  |  GET /doctors/:id/platform-fee info
  {
    title: "Finance & Earnings",
    icons: <Landmark />,
    links: [
      { name: "Earnings Overview",   href: "/doctor/finance/earnings",      icon: <Wallet size={18} />           },
      { name: "Transactions",        href: "/doctor/finance/transactions",  icon: <ArrowLeftRight size={18} />   },
      { name: "Invoices",            href: "/doctor/finance/invoices",      icon: <ReceiptIndianRupee size={18} />},
      { name: "Bank Details",        href: "/doctor/finance/bank",          icon: <CreditCard size={18} />       },
      { name: "Platform Fee Info",   href: "/doctor/finance/platform-fee",  icon: <CircleDollarSign size={18} /> },
    ],
  },

  // ── 7. KYC & Verification ────────────────────────────────────────────────
  // Mirrors: PUT /doctors/:id/kyc
  {
    title: "KYC & Verification",
    icons: <ShieldCheck />,
    links: [
      { name: "KYC Status",          href: "/doctor/kyc",                   icon: <ShieldCheck size={18} />      },
      { name: "Aadhaar Verification",href: "/doctor/kyc/aadhaar",           icon: <ScanLine size={18} />         },
      { name: "PAN Verification",    href: "/doctor/kyc/pan",               icon: <FileText size={18} />         },
    ],
  },

  // ── 8. Settings ──────────────────────────────────────────────────────────
  // Mirrors: PUT /doctors/:id/settings (notifPrefs, onboarding, isOnline)
  {
    title: "Settings",
    icons: <Settings2 />,
    links: [
      { name: "Account Settings",    href: "/doctor/settings",              icon: <Settings2 size={18} />        },
      { name: "Online Status",       href: "/doctor/settings/online",       icon: <ToggleRight size={18} />      },
      { name: "Notifications",       href: "/doctor/settings/notifications", icon: <Bell size={18} />            },
      { name: "Onboarding Checklist",href: "/doctor/settings/onboarding",   icon: <ClipboardList size={18} />   },
      { name: "Security",            href: "/doctor/settings/security",     icon: <KeyRound size={18} />         },
    ],
  },

  // ── 9. Support ───────────────────────────────────────────────────────────
  {
    title: "Support",
    icons: <LifeBuoy />,
    links: [
      { name: "Help & Support",      href: "/doctor/support",               icon: <LifeBuoy size={18} />         },
      { name: "Raise a Ticket",      href: "/doctor/support/ticket",        icon: <MessageSquare size={18} />    },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR QUICK ACCESS (top-right header dropdown)
// ─────────────────────────────────────────────────────────────────────────────

export const DOCTOR_TOP_RIGHT_LINKS = [
  {
    name: "Quick Actions",
    icon: <CalendarCheck size={18} />,
    links: [
      { name: "My Appointments", href: "/doctor/appointments",  icon: <CalendarClock size={18} /> },
      { name: "Availability",    href: "/doctor/availability",  icon: <Clock size={18} />         },
      { name: "My Hospitals",    href: "/doctor/hospitals",     icon: <Hospital size={18} />      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const DOCTOR_SEARCH_LINKS = [
  // Recently visited
  [
    { name: "Dashboard",           href: "/doctor/dashboard",            icon: <LayoutDashboard size={18} /> },
    { name: "Appointments",        href: "/doctor/appointments",         icon: <CalendarCheck size={18} />   },
    { name: "Availability",        href: "/doctor/availability",         icon: <Clock size={18} />           },
    { name: "KYC Status",          href: "/doctor/kyc",                  icon: <ShieldCheck size={18} />     },
    { name: "Bank Details",        href: "/doctor/finance/bank",         icon: <CreditCard size={18} />      },
    { name: "Earnings",            href: "/doctor/finance/earnings",     icon: <Wallet size={18} />          },
    { name: "My Hospitals",        href: "/doctor/hospitals",            icon: <Building2 size={18} />       },
  ],
  // Quick actions
  [
    { name: "Update Availability", href: "/doctor/availability",         icon: <CalendarDays size={18} />    },
    { name: "Upload KYC Docs",     href: "/doctor/kyc/aadhaar",          icon: <ScanLine size={18} />        },
    { name: "Update Bank Details", href: "/doctor/finance/bank",         icon: <CreditCard size={18} />      },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR PROFILE DROPDOWN LINKS
// ─────────────────────────────────────────────────────────────────────────────

export const DOCTOR_PROFILE_LINKS = [
  { name: "My Profile",       href: "/doctor/profile",          icon: <UserRound size={18} />   },
  { name: "Account Settings", href: "/doctor/settings",         icon: <Settings2 size={18} />   },
  { name: "KYC Status",       href: "/doctor/kyc",              icon: <ShieldCheck size={18} /> },
  { name: "Bank Details",     href: "/doctor/finance/bank",     icon: <CreditCard size={18} />  },
  { name: "Online Status",    href: "/doctor/settings/online",  icon: <Wifi size={18} />        },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const DOCTOR_SHORTCUTS = [
  { name: "Command Palette",  keys: "Cmd + K" },
  { name: "Search",           keys: "Cmd + S" },
  { name: "Toggle Online",    keys: "Cmd + O" },
  { name: "Logout",           keys: "Cmd + Q" },
];