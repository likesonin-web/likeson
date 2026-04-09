"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound, PenLine, KeyRound, Stethoscope, ChevronRight,
  Camera, Shield, Star, Award, Clock, Phone, Mail, MapPin,
  Save, Eye, EyeOff, Check, AlertCircle, Loader2, Building2,
  BadgeCheck, TrendingUp, Package, Pill
} from "lucide-react";
import {
  fetchProfile, updateUserProfile, changePassword,
  fetchPharmacyProfile, updatePharmacyProfile,
  clearSuccess, clearError
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

/* ─── Sidebar nav config ─────────────────────────────────────────────────── */
const NAV_LINKS = [
  { name: "My Profile",       href: "/pharmacy-store/profile",          icon: UserRound  },
  { name: "Edit Profile",     href: "/pharmacy-store/profile/edit",     icon: PenLine    },
  { name: "Change Password",  href: "/pharmacy-store/profile/password", icon: KeyRound   },
  { name: "Pharmacy Profile", href: "/pharmacy-store/profile/pharmacy", icon: Stethoscope},
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

function Avatar({ src, name, size = "lg" }) {
  const sz = size === "lg" ? "w-24 h-24" : "w-12 h-12";
  const text = size === "lg" ? "text-3xl" : "text-lg";
  if (src) return (
    <img src={src} alt={name}
      className={`${sz} rounded-2xl object-cover ring-4 ring-primary/20 shadow-lg`} />
  );
  return (
    <div className={`${sz} rounded-2xl bg-gradient-to-br from-primary to-secondary
      flex items-center justify-center ${text} font-bold text-primary-content shadow-lg`}>
      {name?.[0]?.toUpperCase() ?? "P"}
    </div>
  );
}

function FieldRow({ label, value, icon: Icon }) {
  return (
    <motion.div variants={fadeUp}
      className="flex items-start gap-4 p-4 rounded-xl bg-base-200/60 hover:bg-base-200
        border border-base-300/50 transition-colors group">
      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-base-content truncate">{value || "—"}</p>
      </div>
    </motion.div>
  );
}

function StatusBadge({ label, active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
      ${active
        ? "bg-success/15 text-success border border-success/30"
        : "bg-error/15 text-error border border-error/30"
      }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-success animate-pulse" : "bg-error"}`} />
      {label}
    </span>
  );
}

/* ─── Section: My Profile ─────────────────────────────────────────────────── */
function MyProfile({ user }) {
  if (!user) return <LoadingState />;
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Hero card */}
      <motion.div variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-base-100 to-secondary/10
          border border-base-300/60 p-6 shadow-sm">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative">
            <Avatar src={user.avatar} name={user.name} size="lg" />
            <div className="absolute -bottom-1 -right-1 p-1 bg-success rounded-full shadow">
              <div className="w-2.5 h-2.5 rounded-full bg-success-content" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-2xl font-black text-base-content font-montserrat">{user.name}</h2>
              {user.isEmailVerified && <BadgeCheck size={20} className="text-primary" />}
            </div>
            <p className="text-sm text-base-content/60 mb-3">{user.email}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label="Email Verified"  active={user.isEmailVerified} />
              <StatusBadge label="Phone Verified"  active={user.isPhoneVerified} />
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                bg-primary/15 text-primary border border-primary/30 capitalize">
                {user.role}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right hidden sm:flex">
            <div className="text-2xl font-black text-primary font-montserrat">{user.coins ?? 0}</div>
            <div className="text-xs text-base-content/50 font-semibold uppercase tracking-wider">Coins</div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Coins",        value: user.coins ?? 0,        icon: Star,      color: "warning" },
          { label: "Earned",       value: user.coinsEarned ?? 0,  icon: TrendingUp,color: "success" },
          { label: "Redeemed",     value: user.coinsRedeemed ?? 0,icon: Award,     color: "info" },
          { label: "Login Count",  value: user.loginCount ?? 0,   icon: Shield,    color: "primary" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`p-4 rounded-xl border border-${color}/20 bg-${color}/5`}>
            <div className={`text-${color} mb-2`}><Icon size={18} /></div>
            <div className="text-xl font-black text-base-content font-montserrat">{value}</div>
            <div className="text-xs text-base-content/50 font-semibold uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </motion.div>

      {/* Info grid */}
      <motion.div variants={fadeUp}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-base-content/40 mb-3">Account Details</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <FieldRow label="Full Name"    value={user.name}              icon={UserRound} />
          <FieldRow label="Email"        value={user.email}             icon={Mail} />
          <FieldRow label="Phone"        value={user.phone}             icon={Phone} />
          <FieldRow label="Role"         value={user.role}              icon={Shield} />
          <FieldRow label="Location"     value={user.lastKnownAddress}  icon={MapPin} />
          <FieldRow label="Last Login"   value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : null} icon={Clock} />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Section: Edit Profile ───────────────────────────────────────────────── */
function EditProfile({ user, dispatch }) {
  const { loading, errors, success } = useSelector(s => s.pharmacyStore);
  const [form, setForm] = useState({ name: "", phone: "", avatar: "" });

  useEffect(() => {
    if (user) setForm({ name: user.name ?? "", phone: user.phone ?? "", avatar: user.avatar ?? "" });
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(updateUserProfile(form));
  };

  useEffect(() => {
    if (success.profileUpdate) {
      setTimeout(() => dispatch(clearSuccess("profileUpdate")), 3000);
    }
  }, [success.profileUpdate]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}
        className="rounded-2xl border border-base-300/60 bg-base-100 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-base-300/50 bg-base-200/30">
          <h3 className="font-black text-lg text-base-content font-montserrat">Edit Profile</h3>
          <p className="text-sm text-base-content/50 mt-0.5">Update your personal information</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar preview */}
          <motion.div variants={fadeUp} className="flex items-center gap-4 p-4 rounded-xl bg-base-200/50">
            <Avatar src={form.avatar || user?.avatar} name={form.name || user?.name} size="sm" />
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">
                Avatar URL
              </label>
              <input value={form.avatar} onChange={e => setForm(p => ({ ...p, avatar: e.target.value }))}
                placeholder="https://..."
                className="input-field w-full" />
            </div>
          </motion.div>

          {[
            { label: "Full Name",  key: "name",  type: "text",  icon: UserRound, placeholder: "Your full name" },
            { label: "Phone",      key: "phone", type: "tel",   icon: Phone,     placeholder: "+91 XXXXX XXXXX" },
          ].map(({ label, key, type, icon: Icon, placeholder }) => (
            <motion.div variants={fadeUp} key={key}>
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">
                {label}
              </label>
              <div className="relative">
                <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input type={type} value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="input-field w-full pl-10" />
              </div>
            </motion.div>
          ))}

          <AnimatePresence>
            {errors.profile && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-error/10 text-error text-sm border border-error/20">
                <AlertCircle size={16} /> {errors.profile?.message}
              </motion.div>
            )}
            {success.profileUpdate && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-success/10 text-success text-sm border border-success/20">
                <Check size={16} /> Profile updated successfully!
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={fadeUp} className="flex justify-end pt-2">
            <button type="submit" disabled={loading.profile}
              className="btn-primary-cta flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading.profile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ─── Section: Change Password ────────────────────────────────────────────── */
function ChangePassword({ dispatch }) {
  const { loading, errors, success } = useSelector(s => s.pharmacyStore);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(changePassword(form));
  };

  useEffect(() => {
    if (success.passwordChange) {
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => dispatch(clearSuccess("passwordChange")), 3000);
    }
  }, [success.passwordChange]);

  const strength = (() => {
    const p = form.newPassword;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "error", "warning", "info", "success"][strength];

  const fields = [
    { label: "Current Password", key: "currentPassword", showKey: "current" },
    { label: "New Password",     key: "newPassword",     showKey: "new"     },
    { label: "Confirm Password", key: "confirmPassword", showKey: "confirm" },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}
        className="rounded-2xl border border-base-300/60 bg-base-100 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-base-300/50 bg-base-200/30">
          <h3 className="font-black text-lg text-base-content font-montserrat">Change Password</h3>
          <p className="text-sm text-base-content/50 mt-0.5">Keep your account secure with a strong password</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {fields.map(({ label, key, showKey }) => (
            <motion.div variants={fadeUp} key={key}>
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">
                {label}
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input type={show[showKey] ? "text" : "password"}
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder="••••••••"
                  className="input-field w-full pl-10 pr-11" />
                <button type="button"
                  onClick={() => setShow(p => ({ ...p, [showKey]: !p[showKey] }))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-content/40
                    hover:text-base-content transition-colors">
                  {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {key === "newPassword" && form.newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300
                        ${i <= strength ? `bg-${strengthColor}` : "bg-base-300"}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-semibold text-${strengthColor}`}>{strengthLabel}</p>
                </div>
              )}
              {key === "confirmPassword" && form.confirmPassword &&
                form.newPassword !== form.confirmPassword && (
                <p className="mt-1 text-xs text-error font-semibold">Passwords don't match</p>
              )}
            </motion.div>
          ))}

          <AnimatePresence>
            {errors.profile && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-error/10 text-error text-sm border border-error/20">
                <AlertCircle size={16} /> {errors.profile?.message}
              </motion.div>
            )}
            {success.passwordChange && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-success/10 text-success text-sm border border-success/20">
                <Check size={16} /> Password changed successfully!
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={fadeUp} className="flex justify-end pt-2">
            <button type="submit" disabled={loading.profile ||
              !form.currentPassword || !form.newPassword ||
              form.newPassword !== form.confirmPassword}
              className="btn-primary-cta flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading.profile ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              Update Password
            </button>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ─── Section: Pharmacy Profile ───────────────────────────────────────────── */
function PharmacyProfile({ dispatch }) {
  const { pharmacyProfile, loading, errors, success } = useSelector(s => s.pharmacyStore);
  const [form, setForm] = useState({ experienceYears: "", qualification: "" });

  useEffect(() => {
    dispatch(fetchPharmacyProfile());
  }, []);

  useEffect(() => {
    if (pharmacyProfile) {
      setForm({
        experienceYears: pharmacyProfile.experienceYears ?? "",
        qualification: pharmacyProfile.qualification ?? "",
      });
    }
  }, [pharmacyProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(updatePharmacyProfile({
      experienceYears: Number(form.experienceYears),
      qualification: form.qualification,
    }));
  };

  const qualifications = ["D.Pharm", "B.Pharm", "M.Pharm", "Pharm.D"];

  if (loading.pharmacyProfile && !pharmacyProfile) return <LoadingState />;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Profile card */}
      {pharmacyProfile && (
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-base-100 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary">
              <Pill size={28} />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-xl text-base-content font-montserrat">
                {pharmacyProfile.pharmacistName}
              </h3>
              <p className="text-sm text-base-content/60">{pharmacyProfile.roleInStore} • {pharmacyProfile.qualification}</p>
              <p className="text-xs text-base-content/40 mt-1">
                Reg: {pharmacyProfile.registrationNumber ?? "Not set"}
              </p>
            </div>
            <StatusBadge label={pharmacyProfile.verification?.isVerified ? "Verified" : "Pending"} 
              active={pharmacyProfile.verification?.isVerified} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
            {[
              { label: "Orders Fulfilled", value: pharmacyProfile.performance?.totalOrdersFulfilled ?? 0, icon: Package },
              { label: "Rating",           value: `${pharmacyProfile.performance?.rating ?? 0}/5`,          icon: Star   },
              { label: "Experience",       value: `${pharmacyProfile.experienceYears ?? 0} yrs`,            icon: Award  },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="p-3 rounded-xl bg-base-200/50 border border-base-300/50 text-center">
                <Icon size={18} className="mx-auto mb-1 text-primary" />
                <div className="font-black text-lg text-base-content font-montserrat">{value}</div>
                <div className="text-xs text-base-content/50 font-semibold">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Edit form */}
      <motion.div variants={fadeUp}
        className="rounded-2xl border border-base-300/60 bg-base-100 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-base-300/50 bg-base-200/30">
          <h3 className="font-black text-lg text-base-content font-montserrat">Update Pharmacy Details</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <motion.div variants={fadeUp}>
            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">
              Qualification
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {qualifications.map(q => (
                <button key={q} type="button"
                  onClick={() => setForm(p => ({ ...p, qualification: q }))}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all border
                    ${form.qualification === q
                      ? "bg-primary text-primary-content border-primary shadow-sm"
                      : "bg-base-200 text-base-content/70 border-base-300 hover:border-primary hover:text-primary"
                    }`}>
                  {q}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2">
              Years of Experience
            </label>
            <div className="relative">
              <Award size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input type="number" min="0" max="60"
                value={form.experienceYears}
                onChange={e => setForm(p => ({ ...p, experienceYears: e.target.value }))}
                placeholder="0"
                className="input-field w-full pl-10" />
            </div>
          </motion.div>

          <AnimatePresence>
            {success.pharmacyProfileUpdate && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-success/10 text-success text-sm border border-success/20">
                <Check size={16} /> Pharmacy profile updated!
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={fadeUp} className="flex justify-end pt-2">
            <button type="submit" disabled={loading.pharmacyProfile}
              className="btn-primary-cta flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading.pharmacyProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Details
            </button>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />
      ))}
    </div>
  );
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({ activeSection, onNavigate }) {
  return (
    <nav className="space-y-1">
      {NAV_LINKS.map(({ name, href, icon: Icon }) => {
        const section = href.split("/pharmacy-store/profile/")[1] || "index";
        const isActive = activeSection === section;
        return (
          <button key={href} onClick={() => onNavigate(section)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
              transition-all duration-200 group text-left
              ${isActive
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
              }`}>
            <Icon size={17} className={isActive ? "text-primary-content" : "text-base-content/50 group-hover:text-primary"} />
            <span className="flex-1">{name}</span>
            <ChevronRight size={14} className={`transition-transform duration-200
              ${isActive ? "text-primary-content/60 translate-x-0" : "text-base-content/30 -translate-x-1"}`} />
          </button>
        );
      })}
    </nav>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function ProfilePage({ params }) {
  const dispatch = useDispatch();
  const { userProfile: user, loading } = useSelector(s => s.pharmacyStore);

  // Derive active section from next.js [...section] params
  const section = params?.section?.[0] ?? "index";
  const [activeSection, setActiveSection] = useState(section);

  useEffect(() => {
    dispatch(fetchProfile());
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case "edit":     return <EditProfile user={user} dispatch={dispatch} />;
      case "password": return <ChangePassword dispatch={dispatch} />;
      case "pharmacy": return <PharmacyProfile dispatch={dispatch} />;
      default:         return <MyProfile user={user} />;
    }
  };

  const currentLink = NAV_LINKS.find(l => {
    const s = l.href.split("/pharmacy-store/profile/")[1] || "index";
    return s === activeSection;
  });

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8">
          <div className="flex items-center gap-2 text-xs text-base-content/40 font-semibold uppercase tracking-widest mb-3">
            <Building2 size={13} />
            <span>Pharmacy Store</span>
            <ChevronRight size={12} />
            <span className="text-primary">Profile</span>
          </div>
          <h1 className="text-3xl font-black text-base-content font-montserrat tracking-tight">
            Account & Profile
          </h1>
          <p className="text-base-content/50 text-sm mt-1">
            Manage your personal details, security and professional information
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:sticky lg:top-6 h-fit">
            {/* User mini card */}
            <div className="rounded-2xl border border-base-300/60 bg-base-100 p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar src={user?.avatar} name={user?.name} size="sm" />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-base-content truncate">{user?.name ?? "Loading…"}</p>
                  <p className="text-xs text-base-content/50 capitalize">{user?.role ?? "Pharmacist"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-base-300/60 bg-base-100 p-3 shadow-sm">
              <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
            </div>
          </motion.div>

          {/* Content */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeSection}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-5">
                  {currentLink && (
                    <>
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <currentLink.icon size={16} />
                      </div>
                      <h2 className="font-black text-xl text-base-content font-montserrat">
                        {currentLink.name}
                      </h2>
                    </>
                  )}
                </div>
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}