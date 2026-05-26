/**
 * constants/careassistant.js
 * 
 * Updated to include:
 * - Booking Management (Assignments, Pending Requests)
 * - Patient Care Records (Clinical logs, Vitals, Meds)
 */

import React from "react";
import {
  // Identity & Profile
  UserCog, UserRound, Camera, Languages, Phone,
  // Scheduling & Availability
  CalendarCheck, Clock, ToggleRight, MapPin,
  // Clinical / Task / Records
  HeartPulse, ClipboardList, Activity, Star,
  Briefcase, Stethoscope, Pill, Utensils, 
  FileCheck, FolderHeart, UserPlus,
  // Finance & Payments
  Landmark, CreditCard, Wallet, ArrowLeftRight,
  ReceiptIndianRupee,
  // KYC & Security
  ShieldCheck, FileText, ScanLine, KeyRound,
  // Settings & Notifications
  Settings2, Bell, Wifi,
  // Dashboard
  LayoutDashboard, AreaChart, TrendingUp,
  // Misc / Support
  LifeBuoy, MessageSquare, AlertCircle, Users,
  LogOut, Smartphone, History,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_DASHBOARD_LINKS = [

  // ── 1. Overview ──────────────────────────────────────────────────────────
  {
    title: "Overview",
    icons: <LayoutDashboard />,
    links: [
      { name: "Dashboard",            href: "/care-assistant/dashboard",               icon: <LayoutDashboard size={18} /> },
      { name: "Performance & Earnings", href: "/care-assistant/performance",           icon: <TrendingUp size={18} />      },
      { name: "Activity Summary",     href: "/care-assistant/stats",                  icon: <Activity size={18} />        },
      { name: "Work Calendar",        href: "/care-assistant/calendar",                icon: <CalendarCheck size={18} />   },
    ],
  },

  // ── 2. Booking Management ────────────────────────────────────────────────
  // Mirrors: GET /clinical/care/bookings/pending & /clinical/care/bookings
  {
    title: "Booking Management",
    icons: <ClipboardList />,
    links: [
      { name: "New Requests",         href: "/care-assistant/bookings/pending",        icon: <UserPlus size={18} />        },
      { name: "My Bookings",          href: "/care-assistant/bookings",                icon: <ClipboardList size={18} />   },
      { name: "Booking History",      href: "/care-assistant/bookings/history",        icon: <History size={18} />         },
    ],
  },

  // ── 3. Patient Care Records ──────────────────────────────────────────────
  // Mirrors: GET /clinical/care/records & clinical logging POSTs
  {
    title: "Care Records",
    icons: <FolderHeart />,
    links: [
      { name: "Active Care Records",  href: "/care-assistant/care-records/active",     icon: <FileCheck size={18} />       },
    ],
  },

  // ── 4. My Profile ────────────────────────────────────────────────────────
  {
    title: "My Profile",
    icons: <UserCog />,
    links: [
      { name: "Profile Overview",     href: "/care-assistant/profile",                 icon: <UserRound size={18} />       },
      { name: "Personal Information", href: "/care-assistant/profile/personal",        icon: <UserCog size={18} />         },
      { name: "Address Details",      href: "/care-assistant/profile/address",         icon: <MapPin size={18} />          },
      { name: "Emergency Contact",    href: "/care-assistant/profile/emergency-contact", icon: <Phone size={18} />         },
      { name: "Profile Photo",        href: "/care-assistant/upload/photo",            icon: <Camera size={18} />          },
    ],
  },

  // ── 5. Availability & Scheduling ─────────────────────────────────────────
  {
    title: "Availability & Scheduling",
    icons: <CalendarCheck />,
    links: [
      { name: "Go Online / Offline",  href: "/care-assistant/availability",            icon: <ToggleRight size={18} />     },
      { name: "Work Status",          href: "/care-assistant/status",                  icon: <Clock size={18} />           },
      { name: "Live Location",        href: "/care-assistant/location",                icon: <MapPin size={18} />          },
      { name: "Weekly Schedule",      href: "/care-assistant/schedule",                icon: <CalendarCheck size={18} />   },
    ],
  },

  // ── 6. Training & Certifications ─────────────────────────────────────────
  {
    title: "Training & Certifications",
    icons: <Briefcase />,
    links: [
      { name: "My Certifications",    href: "/care-assistant/training/certificates",   icon: <Star size={18} />            },
      { name: "Add Certificate",      href: "/care-assistant/training/certificates/add", icon: <FileText size={18} />      },
      { name: "Training Competencies", href: "/care-assistant/training",               icon: <Stethoscope size={18} />     },
    ],
  },

  // ── 7. Finance & Payouts ─────────────────────────────────────────────────
  {
    title: "Finance & Payouts",
    icons: <Landmark />,
    links: [
      { name: "Earnings Summary",     href: "/care-assistant/performance",             icon: <Wallet size={18} />          },
      { name: "Bank Account",         href: "/care-assistant/bank",                    icon: <CreditCard size={18} />      },
      { name: "Payout Rates",         href: "/care-assistant/platform-pricing",        icon: <ReceiptIndianRupee size={18} /> },
    ],
  },

  // ── 8. KYC & Identity Verification ──────────────────────────────────────
  {
    title: "KYC & Identity Verification",
    icons: <ShieldCheck />,
    links: [
      { name: "Verification Status",  href: "/care-assistant/kyc/status",              icon: <ShieldCheck size={18} />     },
      { name: "Submit KYC Documents", href: "/care-assistant/kyc/submit",              icon: <ScanLine size={18} />        },
      { name: "Upload Documents",     href: "/care-assistant/upload/document",         icon: <FileText size={18} />        },
    ],
  },

  // ── 9. Health Declaration ─────────────────────────────────────────────────
  {
    title: "Health Declaration",
    icons: <HeartPulse />,
    links: [
      { name: "Fitness Declaration",  href: "/care-assistant/health-declaration",      icon: <HeartPulse size={18} />      },
    ],
  },

  // ── 10. Settings & Preferences ────────────────────────────────────────────
  {
    title: "Settings & Preferences",
    icons: <Settings2 />,
    links: [
      { name: "Notification Preferences", href: "/care-assistant/settings/notifications", icon: <Bell size={18} />         },
      { name: "Service Area",          href: "/care-assistant/settings/service-area",  icon: <MapPin size={18} />          },
      { name: "Registered Devices",    href: "/care-assistant/settings",               icon: <Smartphone size={18} />      },
    ],
  },

  // ── 11. Account Security ───────────────────────────────────────────────────
  {
    title: "Account Security",
    icons: <KeyRound />,
    links: [
      { name: "Change Password",      href: "/care-assistant/security/change-password", icon: <KeyRound size={18} />       },
      { name: "Active Sessions",      href: "/care-assistant/security/sessions",        icon: <History size={18} />        },
      { name: "Email Verification",   href: "/care-assistant/security/verify-email",    icon: <ShieldCheck size={18} />    },
      { name: "Delete Account",       href: "/care-assistant/security/delete-account",  icon: <AlertCircle size={18} />    },
    ],
  },

  // ── 12. Sign Out ──────────────────────────────────────────────────────────
  {
    title: "Account",
    icons: <LogOut />,
    links: [
      { name: "Sign Out",             href: "/care-assistant/logout",                  icon: <LogOut size={18} />          },
    ],
  },

  // ── 13. Help & Support ────────────────────────────────────────────────────
  {
    title: "Help & Support",
    icons: <LifeBuoy />,
    links: [
      { name: "Help Centre",          href: "/care-assistant/support",                 icon: <LifeBuoy size={18} />        },
      { name: "Raise a Support Ticket", href: "/care-assistant/support/ticket",        icon: <MessageSquare size={18} />   },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_TOP_RIGHT_LINKS = [
  {
    name: "Quick Actions",
    icon: <CalendarCheck size={18} />,
    links: [
      { name: "Go Online / Offline",  href: "/care-assistant/availability",            icon: <ToggleRight size={18} />     },
      { name: "Pending Bookings",     href: "/care-assistant/bookings/pending",        icon: <UserPlus size={18} />        },
      { name: "Active Records",       href: "/care-assistant/care-records/active",     icon: <FileCheck size={18} />       },
      { name: "Earnings Summary",     href: "/care-assistant/performance",             icon: <Wallet size={18} />          },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT COMMAND PALETTE
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_SEARCH_LINKS = [
  [
    { name: "Dashboard",              href: "/care-assistant/dashboard",               icon: <LayoutDashboard size={18} /> },
    { name: "My Bookings",            href: "/care-assistant/bookings",                icon: <ClipboardList size={18} />   },
    { name: "Active Care Records",    href: "/care-assistant/care-records/active",     icon: <FileCheck size={18} />       },
    { name: "Verification Status",    href: "/care-assistant/kyc/status",              icon: <ShieldCheck size={18} />     },
    { name: "Earnings Summary",       href: "/care-assistant/performance",             icon: <Wallet size={18} />          },
  ],
  [
    { name: "Log Vitals",             href: "/care-assistant/care-records/vitals",     icon: <HeartPulse size={18} />      },
    { name: "Log Medication",         href: "/care-assistant/care-records/medicines",  icon: <Pill size={18} />            },
    { name: "Submit KYC",             href: "/care-assistant/kyc/submit",              icon: <ScanLine size={18} />        },
    { name: "Work Schedule",          href: "/care-assistant/schedule",                icon: <CalendarCheck size={18} />   },
    { name: "Change Password",        href: "/care-assistant/security/change-password", icon: <KeyRound size={18} />       },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_PROFILE_LINKS = [
  { name: "My Profile",             href: "/care-assistant/profile",                   icon: <UserRound size={18} />       },
  { name: "Active Tasks",           href: "/care-assistant/care-records/active",       icon: <Activity size={18} />        },
  { name: "Verification Status",    href: "/care-assistant/kyc/status",                icon: <ShieldCheck size={18} />     },
  { name: "Bank Account",           href: "/care-assistant/bank",                      icon: <CreditCard size={18} />      },
  { name: "Sign Out",               href: "/care-assistant/logout",                    icon: <LogOut size={18} />          },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_SHORTCUTS = [
  { name: "Command Palette",        keys: "Cmd + K" },
  { name: "Log Vitals Quick",       keys: "Cmd + V" },
  { name: "Toggle Online",          keys: "Cmd + O" },
  { name: "Sign Out",               keys: "Cmd + Q" },
];