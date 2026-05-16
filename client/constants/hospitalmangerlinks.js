import React from "react";
import {
  LayoutDashboard,
  Hospital,
  UserCog,
  Stethoscope,
  Users,
  Search,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Image as ImageIcon,
  FileText,
  Bell,
  ShieldCheck,
  Settings2,
  LogOut,
  UserRound,
  History,
  Smartphone,
  CheckCircle2,
  MapPin,
  KeyRound,
  SquareUserRound,
  Shield,
  Settings,
  ClipboardList,
  CalendarCheck,
  FileClock,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL MANAGER — SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const HOSPITAL_MANAGER_DASHBOARD_LINKS = [
  // ── 1. Command Centre ────────────────────────────────────────────────────
  {
    title: "Command Centre",
    icons: <LayoutDashboard size={20} />,
    links: [
      { name: "Overview",       href: "/hospital-manager/dashboard",  icon: <LayoutDashboard size={18} /> },
      { name: "Onboarding",     href: "/hospital-manager/onboarding", icon: <CheckCircle2 size={18} />    },
      { name: "Notifications",  href: "/hospital-manager/notifications", icon: <Bell size={18} />         },
    ],
  },

  // ── 2. Medical Logistics (NEW: Integrated from Booking Router) ───────────
  {
    title: "Patient Operations",
    icons: <ClipboardList size={20} />,
    links: [
      { name: "Upcoming Bookings",  href: "/hospital-manager/bookings/upcoming",  icon: <CalendarCheck size={18} /> },
      { name: "All OP Records",     href: "/hospital-manager/ops",               icon: <ClipboardList size={18} /> },
          
    ],
  },

  // ── 3. Clinical Profile ──────────────────────────────────────────────────
  {
    title: "Facility Management",
    icons: <Hospital size={20} />,
    links: [
      { name: "Hospital Profile", href: "/hospital-manager/profile",       icon: <Hospital size={18} />  },
      { name: "Location & GPS",   href: "/hospital-manager/location",      icon: <MapPin size={18} />    },
      { name: "Operating Hours",  href: "/hospital-manager/operating-hours",icon: <Clock size={18} />     },
      { name: "Gallery & Logo",   href: "/hospital-manager/gallery",       icon: <ImageIcon size={18} /> },
      { name: "Legal & Licenses", href: "/hospital-manager/registration",  icon: <FileText size={18} />  },
    ],
  },

  // ── 4. Doctor Network ────────────────────────────────────────────────────
  {
    title: "Medical Staff",
    icons: <Stethoscope size={20} />,
    links: [
      { name: "Linked Doctors",  href: "/hospital-manager/doctors",        icon: <Users size={18} />       },
      { name: "Find & Link",     href: "/hospital-manager/doctors/search", icon: <Search size={18} />      },
      { name: "Staff Stats",     href: "/hospital-manager/doctors/stats",  icon: <UserCog size={18} />     },
      { name: "Availability",    href: "/hospital-manager/doctors/availability", icon: <CalendarDays size={18} /> },
    ],
  },

  // ── 5. Financials ────────────────────────────────────────────────────────
  {
    title: "Commercials",
    icons: <CircleDollarSign size={20} />,
    links: [
      { name: "Consultation Pricing", href: "/hospital-manager/pricing", icon: <CircleDollarSign size={18} /> },
    ],
  },

  // ── 6. Account & Security ────────────────────────────────────────────────
  {
    title: "Settings & Security",
    icons: <Settings2 size={20} />,
    links: [
      { name: "Account Details",    href: "/hospital-manager/settings/account", icon: <UserRound size={18} />    },
      { name: "Active Sessions",    href: "/hospital-manager/security/sessions", icon: <Smartphone size={18} />  },
      { name: "Security & Password", href: "/hospital-manager/security/password", icon: <KeyRound size={18} />    },
      
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TOP-RIGHT QUICK ACCESS (Updated with Booking actions)
// ─────────────────────────────────────────────────────────────────────────────

export const HOSPITAL_MANAGER_TOP_RIGHT_LINKS = [
  { name: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/hospital-manager/dashboard" },
  {
    name: "Quick Actions",
    icon: <UserCog size={18} />,
    links: [
      { name: "Confirm Appts", href: "/hospital-manager/bookings/upcoming", icon: <CalendarCheck size={18} /> },
      { name: "Link Doctor",   href: "/hospital-manager/doctors/search",   icon: <Users size={18} /> },
      { name: "Update Prices", href: "/hospital-manager/pricing",          icon: <CircleDollarSign size={18} /> },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const HOSPITAL_MANAGER_PROFILE_LINKS = [
  { name: "Manager Profile", href: "/hospital-manager/settings/account", icon: <UserRound size={18} />  },
  { name: "Active Sessions", href: "/hospital-manager/security/sessions", icon: <ShieldCheck size={18} /> },
  { name: 'Settings',    href: '/settings',            icon: <Settings size={18}/>        },
  { name: 'My Account',  href: '/settings/account',    icon: <SquareUserRound size={18} /> },
  { name: 'Security',    href: '/settings/security',   icon: <Shield size={18} />          },
  { name: "Logout",          href: "/logout",                            icon: <LogOut size={18} />      },
];