// /constants/careassistant.js
import React from "react";
import {
  // Identity & Profile
  UserCog, UserRound, Camera, Languages, Phone,
  // Scheduling & Availability
  CalendarCheck, Clock, ToggleRight, MapPin,
  // Clinical / Task
  HeartPulse, ClipboardList, Activity, Star,
  Briefcase, Stethoscope,
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
// Mirrors every route in careAssistantRoutes.js
//
// Router base : /api/care-assistant
// Frontend base: /care-assistant
//
// Profile      → GET/PUT   /profile
// Upload       → POST      /upload/photo | /upload/document
// KYC          → GET       /kyc/status   | PUT /kyc/submit
// Training     → PUT       /training     | POST/DELETE /training/certificates/:certId
// Schedule     → GET/PUT   /schedule
// Availability → PATCH     /availability | /location | /status
// Bank         → GET/PUT   /bank
// Health       → PUT       /health-declaration
// Onboarding   → PATCH     /onboarding/step | /onboarding/complete
// Settings     → GET       /settings
//               PUT        /settings/notifications | /settings/service-area
//               POST/DEL   /settings/device-token
// Security     → PUT       /security/change-password
//               POST       /security/send-email-otp | /security/verify-email-otp
//               GET/DEL    /security/sessions | /security/sessions/:sessionId
//               POST       /security/request-account-deletion
//               DELETE     /security/confirm-account-deletion
// Performance  → GET       /performance
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_DASHBOARD_LINKS = [

  // ── 1. Overview ──────────────────────────────────────────────────────────
  // GET /care-assistant/profile      → full profile
  // GET /care-assistant/performance  → earnings + performance stats
  {
    title: "Overview",
    icons: <LayoutDashboard />,
    links: [
      { name: "Dashboard",            href: "/care-assistant/dashboard",               icon: <LayoutDashboard size={18} /> },
      { name: "Performance & Earnings", href: "/care-assistant/performance",           icon: <TrendingUp size={18} />      },
      { name: "Activity Summary",     href: "/care-assistant/stats",                   icon: <Activity size={18} />        },
    ],
  },

  // ── 2. My Profile ────────────────────────────────────────────────────────
  // GET  /care-assistant/profile           → full profile overview
  // PUT  /care-assistant/profile           → update personal & professional details
  // POST /care-assistant/upload/photo      → upload profile photo (multipart)
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

  // ── 3. Availability & Scheduling ─────────────────────────────────────────
  // PATCH /care-assistant/availability → isOnline toggle, currentCity
  // PATCH /care-assistant/status       → Available | On-Break | Offline
  // PATCH /care-assistant/location     → longitude, latitude (GeoJSON)
  // GET   /care-assistant/schedule     → weekly shift schedule
  // PUT   /care-assistant/schedule     → update weekly shift schedule
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

  // ── 4. Training & Certifications ─────────────────────────────────────────
  // PUT    /care-assistant/training                      → update training flags
  // POST   /care-assistant/training/certificates        → add certificate
  // DELETE /care-assistant/training/certificates/:certId → remove certificate
  // POST   /care-assistant/upload/document              → upload KYC / cert document
  {
    title: "Training & Certifications",
    icons: <Briefcase />,
    links: [
      { name: "My Certifications",    href: "/care-assistant/training/certificates",   icon: <Star size={18} />            },
      { name: "Add Certificate",      href: "/care-assistant/training/certificates/add", icon: <FileText size={18} />      },
      { name: "Training Competencies", href: "/care-assistant/training",               icon: <Stethoscope size={18} />     },
    ],
  },

  // ── 5. Finance & Payouts ─────────────────────────────────────────────────
  // GET /care-assistant/performance    → earnings summary + performance stats
  // GET /care-assistant/bank           → masked bank account info
  // PUT /care-assistant/bank           → add / update bank account details
  {
    title: "Finance & Payouts",
    icons: <Landmark />,
    links: [
      { name: "Earnings Summary",     href: "/care-assistant/performance",             icon: <Wallet size={18} />          },
      { name: "Bank Account",         href: "/care-assistant/bank",                    icon: <CreditCard size={18} />      },
      { name: "Payout Rates",         href: "/care-assistant/platform-pricing",        icon: <ReceiptIndianRupee size={18} /> },
    ],
  },

  // ── 6. KYC & Identity Verification ──────────────────────────────────────
  // GET /care-assistant/kyc/status  → verification status, doc URLs, rejection reason
  // PUT /care-assistant/kyc/submit  → submit Aadhaar & PAN numbers
  // POST /care-assistant/upload/document → upload Aadhaar / PAN / police verification doc
  {
    title: "KYC & Identity Verification",
    icons: <ShieldCheck />,
    links: [
      { name: "Verification Status",  href: "/care-assistant/kyc/status",              icon: <ShieldCheck size={18} />     },
      { name: "Submit KYC Documents", href: "/care-assistant/kyc/submit",              icon: <ScanLine size={18} />        },
      { name: "Upload Documents",     href: "/care-assistant/kyc/document",         icon: <FileText size={18} />        },
    ],
  },

  // ── 7. Health Declaration ─────────────────────────────────────────────────
  // PUT /care-assistant/health-declaration → isMedicallyFit, anyKnownConditions
  {
    title: "Health Declaration",
    icons: <HeartPulse />,
    links: [
      { name: "Fitness Declaration",  href: "/care-assistant/health-declaration",      icon: <HeartPulse size={18} />      },
    ],
  },

  // ── 8. Settings & Preferences ────────────────────────────────────────────
  // GET /care-assistant/settings                         → all preferences
  // PUT /care-assistant/settings/notifications           → SMS, email, push, WhatsApp
  // PUT /care-assistant/settings/service-area            → preferred areas, max radius
  // POST/DELETE /care-assistant/settings/device-token   → register / remove FCM token
  {
    title: "Settings & Preferences",
    icons: <Settings2 />,
    links: [
      { name: "Notification Preferences", href: "/care-assistant/settings/notifications", icon: <Bell size={18} />         },
      { name: "Service Area",          href: "/care-assistant/settings/service-area",  icon: <MapPin size={18} />          },
      { name: "Registered Devices",    href: "/care-assistant/settings",               icon: <Smartphone size={18} />      },
    ],
  },

  // ── 9. Account Security ───────────────────────────────────────────────────
  // PUT    /care-assistant/security/change-password           → change password
  // POST   /care-assistant/security/send-email-otp            → request OTP
  // POST   /care-assistant/security/verify-email-otp          → verify OTP
  // GET    /care-assistant/security/sessions                   → active sessions list
  // DELETE /care-assistant/security/sessions/:sessionId        → revoke session
  // DELETE /care-assistant/security/sessions                   → revoke all sessions
  // POST   /care-assistant/security/request-account-deletion   → request deletion OTP
  // DELETE /care-assistant/security/confirm-account-deletion   → confirm deletion
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

  // ── 10. Sign Out ──────────────────────────────────────────────────────────
  {
    title: "Account",
    icons: <LogOut />,
    links: [
      { name: "Sign Out",             href: "/care-assistant/logout",                  icon: <LogOut size={18} />          },
    ],
  },

  // ── 11. Help & Support ────────────────────────────────────────────────────
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
// CARE ASSISTANT QUICK ACCESS  (top-right header dropdown)
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_TOP_RIGHT_LINKS = [
  {
    name: "Quick Actions",
    icon: <CalendarCheck size={18} />,
    links: [
      { name: "Go Online / Offline",  href: "/care-assistant/availability",            icon: <ToggleRight size={18} />     },
      { name: "Work Status",          href: "/care-assistant/status",                  icon: <Clock size={18} />           },
      { name: "Verification Status",  href: "/care-assistant/kyc/status",              icon: <ShieldCheck size={18} />     },
      { name: "Earnings Summary",     href: "/care-assistant/performance",             icon: <Wallet size={18} />          },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_SEARCH_LINKS = [
  // Frequently visited
  [
    { name: "Dashboard",              href: "/care-assistant/dashboard",               icon: <LayoutDashboard size={18} /> },
    { name: "Go Online / Offline",    href: "/care-assistant/availability",            icon: <ToggleRight size={18} />     },
    { name: "Verification Status",    href: "/care-assistant/kyc/status",              icon: <ShieldCheck size={18} />     },
    { name: "Bank Account",           href: "/care-assistant/bank",                    icon: <CreditCard size={18} />      },
    { name: "Earnings Summary",       href: "/care-assistant/performance",             icon: <Wallet size={18} />          },
    { name: "My Certifications",      href: "/care-assistant/training/certificates",   icon: <Star size={18} />            },
    { name: "Weekly Schedule",        href: "/care-assistant/schedule",                icon: <CalendarCheck size={18} />   },
  ],
  // Quick actions
  [
    { name: "Submit KYC Documents",   href: "/care-assistant/kyc/submit",              icon: <ScanLine size={18} />        },
    { name: "Update Bank Account",    href: "/care-assistant/bank",                    icon: <CreditCard size={18} />      },
    { name: "Add Certificate",        href: "/care-assistant/training/certificates/add", icon: <FileText size={18} />      },
    { name: "Change Password",        href: "/care-assistant/security/change-password", icon: <KeyRound size={18} />       },
    { name: "Notification Preferences", href: "/care-assistant/settings/notifications", icon: <Bell size={18} />           },
    { name: "Payout Rates",           href: "/care-assistant/platform-pricing",        icon: <ReceiptIndianRupee size={18} /> },
    { name: "Upload Documents",       href: "/care-assistant/upload/document",         icon: <FileText size={18} />        },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT PROFILE DROPDOWN LINKS
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_PROFILE_LINKS = [
  { name: "My Profile",             href: "/care-assistant/profile",                   icon: <UserRound size={18} />       },
  { name: "Personal Information",   href: "/care-assistant/profile/personal",          icon: <UserCog size={18} />         },
  { name: "Verification Status",    href: "/care-assistant/kyc/status",                icon: <ShieldCheck size={18} />     },
  { name: "Bank Account",           href: "/care-assistant/bank",                      icon: <CreditCard size={18} />      },
  { name: "Go Online / Offline",    href: "/care-assistant/availability",              icon: <Wifi size={18} />            },
  { name: "Sign Out",               href: "/care-assistant/logout",                    icon: <LogOut size={18} />          },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_ASSISTANT_SHORTCUTS = [
  { name: "Command Palette",        keys: "Cmd + K" },
  { name: "Search",                 keys: "Cmd + S" },
  { name: "Toggle Online / Offline", keys: "Cmd + O" },
  { name: "Sign Out",               keys: "Cmd + Q" },
];

 