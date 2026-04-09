"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, MapPin, Star, ChevronRight, ExternalLink,
  Phone, Mail, Globe, Clock, Shield, CheckCircle2,
  XCircle, AlertTriangle, Users, Stethoscope, Bed,
  Activity, TrendingUp, BarChart2, Info, RefreshCcw,
  Navigation, Hospital, ArrowUpRight, Layers, Award,
  Calendar, HeartPulse, FlaskConical, Ambulance,
  Wifi, WifiOff
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

import {
  fetchMyManagedHospitals,
  fetchMyDoctorProfile,
  selectMyManagedHospitals,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from "@/store/slices/hospitalSlice";

// ═══════════════════════════════════════════════════════════════════════════════
// NAV LINKS
// ═══════════════════════════════════════════════════════════════════════════════
const links = [
  { name: "All My Hospitals",   section: "",          icon: Building2 },
  { name: "Primary Hospital",   section: "primary",   icon: Hospital  },
  { name: "Other Affiliations", section: "affiliated", icon: MapPin   },
  { name: "Managed Hospitals",  section: "managed",   icon: Star      },
];

// ── Chart colours (CSS var aware) ─────────────────────────────────────────────
const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#a78bfa"];

// ── Mock analytics data (replace with real API data) ────────────────────────
const mockMonthly = [
  { month: "Sep", consultations: 38, referrals: 14, earnings: 28400 },
  { month: "Oct", consultations: 52, referrals: 19, earnings: 39000 },
  { month: "Nov", consultations: 45, referrals: 16, earnings: 33750 },
  { month: "Dec", consultations: 61, referrals: 23, earnings: 45750 },
  { month: "Jan", consultations: 48, referrals: 18, earnings: 36000 },
  { month: "Feb", consultations: 70, referrals: 28, earnings: 52500 },
  { month: "Mar", consultations: 65, referrals: 24, earnings: 48750 },
];

const mockTypeBreakdown = [
  { name: "In-Person",   value: 58 },
  { name: "Video",       value: 25 },
  { name: "Home Visit",  value: 17 },
];

const mockHospitalRating = [
  { name: "Primary",    rating: 4.8, fill: "#6366f1" },
  { name: "Apollo",     rating: 4.5, fill: "#22d3ee" },
  { name: "Care Hosp.", rating: 4.2, fill: "#34d399" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      {Icon && (
        <div className="p-2 rounded-xl bg-primary/10 shrink-0">
          <Icon size={20} className="text-primary" />
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-base-content font-montserrat">{title}</h2>
        {subtitle && <p className="text-sm text-base-content/55 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatChip({ label, value, icon: Icon, color = "primary", trend }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    info:    "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    accent:  "bg-accent/10 text-accent",
  };
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl shrink-0 ${colorMap[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">{label}</p>
        <p className="font-extrabold text-xl text-base-content font-montserrat mt-0.5">{value}</p>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 text-xs font-bold ${trend >= 0 ? "text-success" : "text-error"}`}>
          <TrendingUp size={12} className={trend < 0 ? "rotate-180" : ""} />
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

function HospitalBadge({ type }) {
  const map = {
    "Multi-Specialty":   "badge-primary",
    "Super-Specialty":   "badge-info",
    "Clinic":            "badge-success",
    "Diagnostic Center": "badge-warning",
    "Government":        "badge-error",
    "Nursing Home":      "badge-primary",
    "Trust":             "badge-info",
  };
  return <span className={`badge ${map[type] || "badge-primary"} text-xs`}>{type}</span>;
}

function VerifiedBadge({ isVerified }) {
  return isVerified
    ? <span className="badge badge-success text-xs flex items-center gap-1"><CheckCircle2 size={10} />Verified</span>
    : <span className="badge badge-warning text-xs flex items-center gap-1"><Clock size={10} />Pending</span>;
}

function HospitalCard({ hospital, role = "affiliated", index = 0 }) {
  const [expanded, setExpanded] = useState(false);
  if (!hospital) return null;

  const addr = hospital.address;
  const addrStr = [addr?.line1, addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(", ");

  const facilities = [
    { flag: hospital.hasICU,              icon: Activity,    label: "ICU" },
    { flag: hospital.hasBloodBank,        icon: HeartPulse,  label: "Blood Bank" },
    { flag: hospital.hasPharmacy,         icon: FlaskConical,label: "Pharmacy" },
    { flag: hospital.hasAmbulance,        icon: Ambulance,   label: "Ambulance" },
    { flag: hospital.isEmergencyReady,    icon: AlertTriangle,label:"Emergency" },
    { flag: hospital.is24x7,             icon: Clock,       label: "24×7" },
  ].filter((f) => f.flag);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="card overflow-hidden"
    >
      {/* Role ribbon */}
      {role === "primary" && (
        <div className="h-1 w-full bg-gradient-to-r from-primary to-secondary" />
      )}
      {role === "managed" && (
        <div className="h-1 w-full bg-gradient-to-r from-accent to-warning" />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-4">
          {/* Logo / Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center shrink-0 overflow-hidden border border-base-300">
            {hospital.logo
              ? <img src={hospital.logo} alt={hospital.name} className="w-full h-full object-cover" />
              : <Building2 size={24} className="text-base-content/30" />
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-bold text-base-content text-base leading-tight truncate max-w-xs">
                  {hospital.name}
                </h3>
                {hospital.slug && (
                  <p className="text-xs text-base-content/40 font-mono mt-0.5">/{hospital.slug}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <VerifiedBadge isVerified={hospital.isVerified} />
                {role === "primary" && <span className="badge badge-primary text-xs">Primary</span>}
                {role === "managed" && <span className="badge badge-warning text-xs flex items-center gap-1"><Star size={9} />Managed</span>}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 mt-2">
              <HospitalBadge type={hospital.hospitalType} />
              {hospital.accreditations?.slice(0, 2).map((a) => (
                <span key={a} className="badge badge-info text-xs">{a}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Address */}
        {addrStr && (
          <div className="flex items-start gap-2 mt-3">
            <MapPin size={13} className="text-base-content/40 shrink-0 mt-0.5" />
            <p className="text-xs text-base-content/55 leading-relaxed">{addrStr}</p>
          </div>
        )}

        {/* Stat pills */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {hospital.bedCount?.total > 0 && (
            <span className="flex items-center gap-1 text-xs bg-base-200 px-2 py-1 rounded-lg font-medium text-base-content/70">
              <Bed size={11} /> {hospital.bedCount.total} beds
            </span>
          )}
          {hospital.rating?.averageRating > 0 && (
            <span className="flex items-center gap-1 text-xs bg-base-200 px-2 py-1 rounded-lg font-medium text-base-content/70">
              <Star size={11} className="text-warning fill-warning" /> {hospital.rating.averageRating.toFixed(1)}
            </span>
          )}
          {hospital.linkedDoctors?.length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-base-200 px-2 py-1 rounded-lg font-medium text-base-content/70">
              <Stethoscope size={11} /> {hospital.linkedDoctors.length} doctors
            </span>
          )}
          {hospital.is24x7 && (
            <span className="flex items-center gap-1 text-xs bg-success/10 px-2 py-1 rounded-lg font-medium text-success">
              <Wifi size={11} /> 24×7
            </span>
          )}
        </div>

        {/* Expandable details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-base-300 space-y-3">
                {/* Contact */}
                {hospital.contact && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hospital.contact.phone && (
                      <a href={`tel:${hospital.contact.phone}`}
                        className="flex items-center gap-2 text-xs text-base-content/70 hover:text-primary transition-colors">
                        <Phone size={12} /> {hospital.contact.phone}
                      </a>
                    )}
                    {hospital.contact.email && (
                      <a href={`mailto:${hospital.contact.email}`}
                        className="flex items-center gap-2 text-xs text-base-content/70 hover:text-primary transition-colors">
                        <Mail size={12} /> {hospital.contact.email}
                      </a>
                    )}
                    {hospital.contact.website && (
                      <a href={hospital.contact.website} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <Globe size={12} /> Website <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                )}

                {/* Facilities */}
                {facilities.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">Facilities</p>
                    <div className="flex flex-wrap gap-2">
                      {facilities.map(({ icon: Icon, label }) => (
                        <span key={label}
                          className="flex items-center gap-1 text-xs bg-success/10 text-success px-2.5 py-1 rounded-lg font-semibold">
                          <Icon size={11} /> {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accepted schemes */}
                {hospital.acceptedSchemes?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">Accepted Schemes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hospital.acceptedSchemes.map((s) => (
                        <span key={s} className="text-xs bg-info/10 text-info px-2 py-0.5 rounded-md font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specialties */}
                {hospital.specialties?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hospital.specialties.slice(0, 8).map((s) => (
                        <span key={s} className="text-xs bg-base-200 text-base-content/60 px-2 py-0.5 rounded-md font-medium">{s}</span>
                      ))}
                      {hospital.specialties.length > 8 && (
                        <span className="text-xs text-base-content/40">+{hospital.specialties.length - 8} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-base-300/60">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            {expanded ? "Show less" : "View details"}
            <ChevronRight size={12} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
          {hospital.googleMapsUrl && (
            <a href={hospital.googleMapsUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-base-content/50 hover:text-primary transition-colors">
              <Navigation size={12} /> Directions
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card p-12 text-center flex flex-col items-center gap-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center">
        <Icon size={28} className="text-base-content/25" />
      </div>
      <div>
        <p className="font-bold text-base-content text-base">{title}</p>
        <p className="text-sm text-base-content/50 mt-1 max-w-xs mx-auto">{description}</p>
      </div>
      {action && (
        <button onClick={onAction} className="btn-primary-cta text-xs px-5 py-2.5 mt-2">
          {action}
        </button>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════
function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs shadow-xl border border-base-300 min-w-[120px]">
      <p className="font-bold text-base-content mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-base-content/60">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-bold text-base-content">{prefix}{entry.value?.toLocaleString()}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS PANEL (shared across sections)
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsPanel({ profile, hospitalCount }) {
  const stats = profile?.stats || {};

  const kpiCards = [
    { label: "Total Consultations", value: stats.totalConsultations || 0,    icon: HeartPulse,   color: "primary", trend: 12 },
    { label: "Total Referrals",     value: stats.totalReferrals || 0,        icon: Users,        color: "info",    trend: 8  },
    { label: "Total Earnings",      value: `₹${((stats.totalEarnings||0)/1000).toFixed(1)}k`, icon: TrendingUp, color: "success", trend: 15 },
    { label: "Pending Settlement",  value: `₹${((stats.pendingSettlement||0)/1000).toFixed(1)}k`, icon: Clock, color: "warning" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpiCards.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <StatChip {...k} />
          </motion.div>
        ))}
      </div>

      {/* Consultations trend */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-primary" />
            <h4 className="font-bold text-base-content text-sm">Monthly Consultations & Referrals</h4>
          </div>
          <span className="badge badge-primary text-xs">Last 7 months</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={mockMonthly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradConsult" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRef" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="consultations" name="Consultations" stroke="#6366f1" strokeWidth={2} fill="url(#gradConsult)" dot={false} activeDot={{ r: 5, fill: "#6366f1" }} />
            <Area type="monotone" dataKey="referrals"     name="Referrals"     stroke="#22d3ee" strokeWidth={2} fill="url(#gradRef)"    dot={false} activeDot={{ r: 5, fill: "#22d3ee" }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Earnings + Consultation type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Earnings bar */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-success" />
            <h4 className="font-bold text-base-content text-sm">Monthly Earnings (₹)</h4>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={mockMonthly} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
              <Tooltip content={<ChartTooltip prefix="₹" />} />
              <Bar dataKey="earnings" name="Earnings" radius={[5, 5, 0, 0]}>
                {mockMonthly.map((_, i) => (
                  <Cell key={i} fill={i === mockMonthly.length - 1 ? "#6366f1" : "#6366f120"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Consultation type pie */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-accent" />
            <h4 className="font-bold text-base-content text-sm">Consultation Type Split</h4>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={mockTypeBreakdown} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                  {mockTypeBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {mockTypeBreakdown.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i] }} />
                  <span className="text-xs text-base-content/70 font-medium">{d.name}</span>
                  <span className="text-xs font-bold text-base-content ml-auto">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Hospital rating radial */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }} className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star size={16} className="text-warning" />
          <h4 className="font-bold text-base-content text-sm">Hospital Ratings</h4>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width={180} height={180}>
            <RadialBarChart cx="50%" cy="50%" innerRadius={28} outerRadius={80} data={mockHospitalRating.map((d) => ({ ...d, max: 5 }))} startAngle={90} endAngle={-270}>
              <RadialBar background={{ fill: "var(--base-300)" }} dataKey="rating" cornerRadius={6}>
                {mockHospitalRating.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </RadialBar>
              <Tooltip formatter={(v) => `${v}/5`} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-3 w-full">
            {mockHospitalRating.map((h, i) => (
              <div key={h.name}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-base-content/70">{h.name}</span>
                  <span style={{ color: h.fill }}>{h.rating}/5</span>
                </div>
                <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: h.fill }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(h.rating / 5) * 100}%` }}
                    transition={{ duration: 0.9, delay: 0.5 + i * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: ALL MY HOSPITALS
// ═══════════════════════════════════════════════════════════════════════════════
function AllHospitals({ managed, profile }) {
  const primary  = managed?.primaryHospital;
  const others   = managed?.otherHospitals   || [];
  const managed_ = managed?.managedHospitals || [];

  const total = (primary ? 1 : 0) + others.length + managed_.length;

  const overviewStats = [
    { label: "Total Hospitals",  value: total,           icon: Building2,    color: "primary" },
    { label: "Primary",          value: primary ? 1 : 0, icon: Hospital,     color: "success" },
    { label: "Affiliated",       value: others.length,   icon: MapPin,       color: "info"    },
    { label: "Managed",          value: managed_.length, icon: Star,         color: "warning" },
  ];

  return (
    <div className="space-y-6">
      {/* Overview chips */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {overviewStats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <StatChip {...s} />
          </motion.div>
        ))}
      </div>

      {/* Analytics */}
      <AnalyticsPanel profile={profile} hospitalCount={total} />

      {/* All hospitals list */}
      {total === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hospitals linked yet"
          description="Your hospital affiliations will appear here once an admin links you."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-base-content/40" />
            <h3 className="text-sm font-bold text-base-content/60 uppercase tracking-wide">All Linked Hospitals</h3>
          </div>
          {primary && <HospitalCard hospital={primary} role="primary" index={0} />}
          {others.map((h, i)   => <HospitalCard key={h._id} hospital={h} role="affiliated" index={i + 1} />)}
          {managed_.map((h, i) => <HospitalCard key={h._id} hospital={h} role="managed"    index={others.length + i + 1} />)}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: PRIMARY HOSPITAL
// ═══════════════════════════════════════════════════════════════════════════════
function PrimaryHospital({ managed, profile }) {
  const hospital = managed?.primaryHospital;

  return (
    <div className="space-y-6">
      <SectionHeader title="Primary Hospital" subtitle="Your main practice location" icon={Hospital} />

      {!hospital ? (
        <EmptyState
          icon={Hospital}
          title="No primary hospital set"
          description="Contact admin to link you to a primary hospital. This is your main practice location visible to patients."
        />
      ) : (
        <>
          {/* Hero card */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            className="card overflow-hidden border-primary/30">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-accent" />
            <div className="p-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-20 h-20 rounded-2xl bg-base-200 flex items-center justify-center overflow-hidden border-2 border-primary/20 shrink-0">
                  {hospital.logo
                    ? <img src={hospital.logo} alt={hospital.name} className="w-full h-full object-cover" />
                    : <Hospital size={32} className="text-primary/40" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-extrabold text-xl text-base-content font-montserrat">{hospital.name}</h3>
                    <span className="badge badge-primary text-xs">Primary</span>
                    <VerifiedBadge isVerified={hospital.isVerified} />
                  </div>
                  <HospitalBadge type={hospital.hospitalType} />
                  {hospital.description && (
                    <p className="text-sm text-base-content/60 mt-2 leading-relaxed line-clamp-2">{hospital.description}</p>
                  )}
                </div>
              </div>

              {/* Detail grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                {[
                  { label: "Phone",    value: hospital.contact?.phone,   icon: Phone  },
                  { label: "Email",    value: hospital.contact?.email,   icon: Mail   },
                  { label: "Website",  value: hospital.contact?.website, icon: Globe, link: true },
                  { label: "Address",  value: [hospital.address?.line1, hospital.address?.city, hospital.address?.pincode].filter(Boolean).join(", "), icon: MapPin },
                  { label: "Total Beds", value: hospital.bedCount?.total || "—", icon: Bed },
                  { label: "ICU Beds",   value: hospital.bedCount?.icu   || "—", icon: Activity },
                ].map(({ label, value, icon: Icon, link }) => value && (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-base-200/50">
                    <Icon size={14} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-base-content/45 uppercase tracking-wide">{label}</p>
                      {link
                        ? <a href={value} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline flex items-center gap-1 truncate">{value} <ExternalLink size={10} /></a>
                        : <p className="text-sm font-semibold text-base-content truncate">{value}</p>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Accreditations */}
              {hospital.accreditations?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Award size={11} /> Accreditations
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {hospital.accreditations.map((a) => (
                      <span key={a} className="badge badge-info text-xs flex items-center gap-1">
                        <Shield size={9} /> {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Analytics for primary */}
          <AnalyticsPanel profile={profile} hospitalCount={1} />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: OTHER AFFILIATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function OtherAffiliations({ managed, profile }) {
  const others = managed?.otherHospitals || [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Other Affiliations"
        subtitle={`You practice at ${others.length} additional hospital${others.length !== 1 ? "s" : ""}`}
        icon={MapPin}
      />

      {others.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No additional affiliations"
          description="You are not linked to any hospitals beyond your primary. Admin can add more affiliations."
        />
      ) : (
        <>
          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-info/5 border border-info/20">
            <Info size={16} className="text-info shrink-0" />
            <p className="text-sm text-base-content/70">
              You consult at <strong className="text-info">{others.length}</strong> affiliated hospitals in addition to your primary practice.
              Patients can book you from any of these locations.
            </p>
          </motion.div>

          {/* Hospital cards */}
          <div className="space-y-3">
            {others.map((h, i) => (
              <HospitalCard key={h._id || i} hospital={h} role="affiliated" index={i} />
            ))}
          </div>

          {/* Type breakdown chart */}
          {others.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={16} className="text-primary" />
                <h4 className="font-bold text-base-content text-sm">Affiliated Hospital Types</h4>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[...new Set(others.map((h) => h.hospitalType))].map((type) => ({
                    type: type?.split(" ")[0] || "Other",
                    count: others.filter((h) => h.hospitalType === type).length,
                  }))}
                  margin={{ top: 0, right: 5, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip suffix=" hospitals" />} />
                  <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: MANAGED HOSPITALS
// ═══════════════════════════════════════════════════════════════════════════════
function ManagedHospitals({ managed, profile }) {
  const hospitals = managed?.managedHospitals || [];

  const totalDoctors = hospitals.reduce((s, h) => s + (h.linkedDoctors?.length || 0), 0);
  const totalBeds    = hospitals.reduce((s, h) => s + (h.bedCount?.total || 0), 0);
  const avgRating    = hospitals.length
    ? (hospitals.reduce((s, h) => s + (h.rating?.averageRating || 0), 0) / hospitals.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Managed Hospitals"
        subtitle="Hospitals under your administrative oversight"
        icon={Star}
      />

      {hospitals.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No managed hospitals"
          description="Hospitals assigned under your management will appear here."
        />
      ) : (
        <>
          {/* Management KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Hospitals",     value: hospitals.length, icon: Building2, color: "primary" },
              { label: "Total Doctors", value: totalDoctors,     icon: Stethoscope,color: "info"   },
              { label: "Total Beds",    value: totalBeds,        icon: Bed,        color: "success" },
              { label: "Avg. Rating",   value: avgRating,        icon: Star,       color: "warning" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <StatChip {...s} />
              </motion.div>
            ))}
          </div>

          {/* Beds & doctors comparison */}
          {hospitals.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-primary" />
                <h4 className="font-bold text-base-content text-sm">Hospitals — Beds & Doctors</h4>
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={hospitals.map((h) => ({
                    name:    h.name?.slice(0, 10) + (h.name?.length > 10 ? "…" : ""),
                    beds:    h.bedCount?.total || 0,
                    doctors: h.linkedDoctors?.length || 0,
                  }))}
                  margin={{ top: 0, right: 5, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar dataKey="beds"    name="Beds"    radius={[4, 4, 0, 0]} fill="#6366f1" />
                  <Bar dataKey="doctors" name="Doctors" radius={[4, 4, 0, 0]} fill="#22d3ee" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Rating comparison */}
          {hospitals.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star size={16} className="text-warning" />
                <h4 className="font-bold text-base-content text-sm">Hospital Ratings</h4>
              </div>
              <div className="space-y-3">
                {hospitals.map((h, i) => (
                  <div key={h._id || i}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-base-content/70 truncate max-w-[180px]">{h.name}</span>
                      <span className="text-warning">{(h.rating?.averageRating || 0).toFixed(1)}/5</span>
                    </div>
                    <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-warning to-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${((h.rating?.averageRating || 0) / 5) * 100}%` }}
                        transition={{ duration: 0.9, delay: 0.4 + i * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Hospital cards */}
          <div className="space-y-3">
            {hospitals.map((h, i) => (
              <HospitalCard key={h._id || i} hospital={h} role="managed" index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function MyHospitals() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const managed  = useSelector(selectMyManagedHospitals);
  const profile  = useSelector(selectMyDoctorProfile);
  const loading  = useSelector(selectHospitalLoading);

  const section  = params?.section || "";

  useEffect(() => {
    dispatch(fetchMyManagedHospitals());
    dispatch(fetchMyDoctorProfile());
  }, [dispatch]);

  const totalCount =
    (managed?.primaryHospital ? 1 : 0) +
    (managed?.otherHospitals?.length || 0) +
    (managed?.managedHospitals?.length || 0);

  const sectionMap = {
    "":         <AllHospitals       managed={managed} profile={profile} />,
    primary:    <PrimaryHospital    managed={managed} profile={profile} />,
    affiliated: <OtherAffiliations  managed={managed} profile={profile} />,
    managed:    <ManagedHospitals   managed={managed} profile={profile} />,
  };

  const isLoading = (loading.fetchMyManagedHospitals || loading.fetchMyDoctorProfile) && !managed?.primaryHospital && !managed?.otherHospitals?.length;

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="border-b border-base-300 bg-base-100 sticky top-0 z-30">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Building2 size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold font-montserrat text-base-content tracking-tight">
                  My Hospitals
                </h1>
                <p className="text-xs text-base-content/50">
                  {totalCount} hospital{totalCount !== 1 ? "s" : ""} linked to your account
                </p>
              </div>
            </div>
            <button
              onClick={() => { dispatch(fetchMyManagedHospitals()); dispatch(fetchMyDoctorProfile()); }}
              disabled={loading.fetchMyManagedHospitals}
              className="flex items-center gap-1.5 text-xs font-semibold text-base-content/60 hover:text-primary transition-colors disabled:opacity-40"
            >
              <RefreshCcw size={13} className={loading.fetchMyManagedHospitals ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        <div className="flex gap-6">
          {/* ── Sidebar ───────────────────────────────────────────── */}
          <aside className="hidden md:flex flex-col gap-1 w-56 shrink-0">
            {links.map(({ name, section: sec, icon: Icon }) => {
              const isActive = sec === section;
              const count =
                sec === ""          ? totalCount :
                sec === "primary"   ? (managed?.primaryHospital ? 1 : 0) :
                sec === "affiliated"? (managed?.otherHospitals?.length || 0) :
                sec === "managed"   ? (managed?.managedHospitals?.length || 0) : 0;

              return (
                <button
                  key={sec}
                  onClick={() => router.push(`/doctor/hospitals${sec ? `/${sec}` : ""}`)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${
                    isActive
                      ? "bg-primary text-primary-content shadow-md shadow-primary/20"
                      : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1 truncate">{name}</span>
                  {count > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? "bg-white/20 text-white" : "bg-base-300 text-base-content/60"
                    }`}>
                      {count}
                    </span>
                  )}
                  {isActive && <ChevronRight size={14} className="shrink-0 ml-0.5" />}
                </button>
              );
            })}

            {/* Sidebar stats mini */}
            <div className="mt-4 space-y-2">
              <div className="p-3 rounded-xl bg-base-200/50 border border-base-300">
                <p className="text-xs font-semibold text-base-content/50 mb-2 uppercase tracking-wide">Quick Stats</p>
                {[
                  { label: "Rating",   value: `${(profile?.rating?.averageRating || 0).toFixed(1)} ★`, color: "text-warning" },
                  { label: "Reviews",  value: profile?.rating?.totalReviews || 0,    color: "text-base-content" },
                  { label: "KYC",      value: profile?.kycStatus || "N/A",           color: profile?.kycStatus === "verified" ? "text-success" : "text-warning" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center py-1">
                    <span className="text-xs text-base-content/50">{label}</span>
                    <span className={`text-xs font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Mobile tabs ──────────────────────────────────────── */}
          <div className="md:hidden mb-4 w-full -mt-2">
            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
              {links.map(({ name, section: sec, icon: Icon }) => {
                const isActive = sec === section;
                return (
                  <button
                    key={sec}
                    onClick={() => router.push(`/doctor/hospitals${sec ? `/${sec}` : ""}`)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                      isActive ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"
                    }`}
                  >
                    <Icon size={14} />
                    {name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Main ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="spinner w-8 h-8" />
                  <p className="text-sm text-base-content/50">Loading hospitals…</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={section}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22 }}
                >
                  {sectionMap[section] ?? (
                    <div className="card p-8 text-center">
                      <p className="text-base-content/50">Section not found.</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}