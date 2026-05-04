import React from "react";
import {
  // Profile
  UserRound, PenLine, KeyRound,
  // KYC
  ShieldCheck, FileText,
  // Shift & Status
  Clock, ToggleRight,
  // Location
  MapPin,
  // Bank
  Landmark, CreditCard,
  // Rewards
  Star, Coins,
  // Logs
  ScrollText,
  // Sessions & Devices
  MonitorSmartphone, LogOut, Laptop, Trash2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER DASHBOARD — SIDEBAR NAVIGATION
// Mirrors §H driver routes in TransportPartnerRoutes.js
// GET  /driver/me            → My Profile
// PATCH /driver/me           → Edit Profile
// PUT  /driver/kyc           → Submit KYC
// PATCH /driver/shift        → Shift Settings
// PATCH /driver/status       → Update Status
// PATCH /driver/location     → Update Location
// GET  /driver/rewards       → My Rewards
// PUT  /driver/bank          → Bank Details
// GET  /driver/logs          → Activity Logs
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_DASHBOARD_LINKS = [

  // ── Profile ───────────────────────────────────────────────────────────────
  // GET /driver/me | PATCH /driver/me | password via User model
  {
    title: "My Profile",
    icon: <UserRound />,
    links: [
      { name: "View Profile",    href: "/driver/profile",          icon: <UserRound size={18} /> },
      { name: "Change Password", href: "/driver/profile/password", icon: <KeyRound size={18} />  },
    ],
  },

  // ── KYC ───────────────────────────────────────────────────────────────────
  // PUT /driver/kyc
  {
    title: "KYC & Documents",
    icon: <ShieldCheck />,
    links: [
      { name: "KYC Status",    href: "/driver/kyc",        icon: <ShieldCheck size={18} /> },
      { name: "Submit KYC",    href: "/driver/kyc/submit", icon: <FileText size={18} />    },
    ],
  },

  // ── Shift & Status ────────────────────────────────────────────────────────
  // PATCH /driver/shift | PATCH /driver/status
  {
    title: "Shift & Status",
    icon: <Clock />,
    links: [
      { name: "Shift Settings", href: "/driver/shift",  icon: <Clock size={18} />       },
    ],
  },

  // ── Location ─────────────────────────────────────────────────────────────
  // PATCH /driver/location
  {
    title: "Location",
    icon: <MapPin />,
    links: [
      { name: "Update Location", href: "/driver/location", icon: <MapPin size={18} /> },
    ],
  },

  // ── Bank Details ──────────────────────────────────────────────────────────
  // PUT /driver/bank
  {
    title: "Bank Details",
    icon: <Landmark />,
    links: [
      { name: "View Bank Details", href: "/driver/bank",      icon: <Landmark size={18} />   },
      { name: "Update Bank",       href: "/driver/bank/edit", icon: <CreditCard size={18} /> },
    ],
  },

  // ── Rewards ───────────────────────────────────────────────────────────────
  // GET /driver/rewards
  {
    title: "Rewards",
    icon: <Star />,
    links: [
      { name: "My Rewards",   href: "/driver/rewards",         icon: <Star size={18} />  },
      { name: "Coin Balance", href: "/driver/rewards/balance", icon: <Star size={18} />  },
    ],
  },

  // ── Activity Logs ─────────────────────────────────────────────────────────
  // GET /driver/logs
  {
    title: "Activity Logs",
    icon: <ScrollText />,
    links: [
      { name: "My Logs", href: "/driver/logs", icon: <ScrollText size={18} /> },
    ],
  },

  // ── Sessions & Devices ────────────────────────────────────────────────────
  // Via User model — same session routes as transport partner §A
  {
    title: "Sessions & Devices",
    icon: <MonitorSmartphone />,
    links: [
      { name: "Active Sessions", href: "/driver/audit/sessions",        icon: <Clock size={18} />             },
      { name: "Revoke Session",  href: "/driver/audit/sessions/revoke", icon: <LogOut size={18} />            },
      { name: "Revoke All",      href: "/driver/audit/all-sessions",    icon: <ShieldCheck size={18} />       },
      { name: "All Devices",     href: "/driver/audit/devices",         icon: <MonitorSmartphone size={18} /> },
      { name: "Remove Device",   href: "/driver/audit/devices/remove",  icon: <Laptop size={18} />            },
      { name: "Remove All",      href: "/driver/audit/devices/all",     icon: <Trash2 size={18} />            },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_TOP_RIGHT_LINKS = [
  { name: "Status",   href: "/driver/shift",   icon: <ToggleRight size={18} /> },
  { name: "Location", href: "/driver/location", icon: <MapPin size={18} />      },
  { name: "Rewards",  href: "/driver/rewards",  icon: <Star size={18} />        },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_PROFILE_LINKS = [
  { name: "My Profile",      href: "/driver/profile",          icon: <UserRound size={18} />  },
  { name: "KYC Status",      href: "/driver/kyc",              icon: <ShieldCheck size={18} /> },
  { name: "Change Password", href: "/driver/profile/password", icon: <KeyRound size={18} />    },
  { name: "Sessions",        href: "/driver/audit/sessions",   icon: <MonitorSmartphone size={18} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_SHORTCUTS = [
  { name: "Command Palette", keys: "Cmd + K" },
  { name: "Update Status",   keys: "Cmd + S" },
  { name: "Logout",          keys: "Cmd + Q" },
];