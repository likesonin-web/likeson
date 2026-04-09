"use client";

import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  UserRound, Camera, Save, Phone, MapPin, Briefcase,
  ShieldAlert, FileUser, Plus, Trash2, Loader2,
  CheckCircle2, AlertCircle, Heart, Stethoscope,
  Award, Star, BadgeCheck, TrendingUp, Car,
  Contact2, Info, ChevronRight, Languages,
} from "lucide-react";

import {
  fetchMyProfile,
  updateMyProfile,
  updateContactInfo,
  updateAddress,
  updateProfessionalInfo,
  updateEmergencyContact,
  addTrainingCertificate,
  removeTrainingCertificate,
  selectProfile,
  selectLoading,
  selectProfileCompletion,
  selectPartnershipStatus,
} from "@/store/slices/soloDriverSlice";
import { uploadSingleFile } from "@/store/slices/uploadSlice";

// ─────────────────────────────────────────────────────────────────────────────
// Route → Tab map  (mirrors SOLO_DRIVER_PARTNER_LINKS "My Profile" section)
// ─────────────────────────────────────────────────────────────────────────────
const ROUTE_TAB_MAP = {
  "/partner/solo/profile":                   "personal",
  "/partner/solo/profile/contact":           "contact",
  "/partner/solo/profile/address":           "address",
  "/partner/solo/profile/professional":      "professional",
  "/partner/solo/profile/emergency":         "emergency",
  "/partner/solo/profile/certificates":      "certificates",
};

const TABS = [
  { id: "personal",     label: "Personal Details",   icon: UserRound,  href: "/partner/solo/profile" },
  { id: "contact",      label: "Contact Info",        icon: Contact2,   href: "/partner/solo/profile/contact" },
  { id: "address",      label: "Address",             icon: MapPin,     href: "/partner/solo/profile/address" },
  { id: "professional", label: "Professional Info",   icon: Briefcase,  href: "/partner/solo/profile/professional" },
  { id: "emergency",    label: "Emergency Contact",   icon: ShieldAlert,href: "/partner/solo/profile/emergency" },
  { id: "certificates", label: "Certificates",        icon: FileUser,   href: "/partner/solo/profile/certificates" },
];

// ─── Animation preset ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const map = {
    active:           { cls: "badge-success", label: "Active" },
    pending:          { cls: "badge-warning", label: "Pending" },
    "under-review":   { cls: "badge-info",    label: "Under Review" },
    suspended:        { cls: "badge-error",   label: "Suspended" },
    rejected:         { cls: "badge-error",   label: "Rejected" },
  };
  const { cls, label } = map[status] || { cls: "badge-info", label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
};

/** Titled card with optional subtitle below the section heading */
const SectionCard = ({ title, icon: Icon, subtitle, children, index = 0 }) => (
  <motion.div
    variants={fadeUp} initial="hidden" animate="visible" custom={index}
    className="card p-6 space-y-5"
  >
    <div className="flex items-start gap-3 border-b border-base-300 pb-4">
      <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
        <Icon size={18} />
      </span>
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-base-content/80">{title}</h2>
        {subtitle && (
          <p className="text-[10px] text-base-content/40 mt-1 leading-relaxed max-w-lg">{subtitle}</p>
        )}
      </div>
    </div>
    {children}
  </motion.div>
);

/** Label + optional hint below an input */
const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-base-content/30 leading-relaxed">{hint}</p>}
  </div>
);

const Input = ({ value, onChange, placeholder, type = "text", disabled = false }) => (
  <input
    type={type}
    value={value ?? ""}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
  />
);

const Select = ({ value, onChange, children }) => (
  <select value={value ?? ""} onChange={onChange} className="input-field w-full">
    {children}
  </select>
);

/** Inline note / tip banner */
const InfoNote = ({ children, variant = "info" }) => {
  const styles = {
    info:    "bg-info/10    border-info/30    text-info",
    warning: "bg-warning/10 border-warning/30 text-warning",
    success: "bg-success/10 border-success/30 text-success",
  };
  return (
    <div className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs font-medium leading-relaxed ${styles[variant]}`}>
      <Info size={14} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
};

/** Bottom-right save action */
const SaveButton = ({ onClick, loading }) => (
  <div className="flex justify-end pt-2">
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-primary-cta flex items-center gap-2 px-6 py-2.5 text-xs disabled:opacity-60"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {loading ? "Saving…" : "Save Changes"}
    </button>
  </div>
);

/** SVG radial progress ring */
const CompletionRing = ({ percent }) => {
  const r    = 42;
  const circ = 2 * Math.PI * r;
  const dash = ((percent || 0) / 100) * circ;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="rotate-[-90deg] w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--base-300)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke="var(--primary)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-primary">{percent || 0}%</span>
        <span className="text-[8px] uppercase tracking-widest text-base-content/40">Complete</span>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ProfilePage() {
  const dispatch    = useDispatch();
  const pathname    = usePathname();

  const profile     = useSelector(selectProfile);
  const completion  = useSelector(selectProfileCompletion);
  const status      = useSelector(selectPartnershipStatus);
  const isLoading   = useSelector(selectLoading("profile"));
  const isUpdating  = useSelector(selectLoading("updateProfile"));
  const isUploading = useSelector((s) => s.upload?.isUploading);

  // Derive active tab purely from the current URL
  const activeTab = ROUTE_TAB_MAP[pathname] ?? "personal";

  // ── Form state ─────────────────────────────────────────────────────────
  const [basic,        setBasic]        = useState({});
  const [contact,      setContact]      = useState({});
  const [address,      setAddress]      = useState({});
  const [professional, setProfessional] = useState({});
  const [emergency,    setEmergency]    = useState({});
  const [newCert,      setNewCert]      = useState({ name: "", issuedBy: "", issuedAt: "", expiresAt: "" });
  const [showCertForm, setShowCertForm] = useState(false);
  const photoRef = useRef(null);

  const LANGUAGES = ["Telugu", "Hindi", "English", "Tamil", "Kannada", "Other"];

  // ── Fetch ──────────────────────────────────────────────────────────────
  useEffect(() => { dispatch(fetchMyProfile()); }, [dispatch]);

  // ── Sync profile → local form state ───────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    setBasic({
      displayName:            profile.displayName            || "",
      dateOfBirth:            profile.dateOfBirth ? profile.dateOfBirth.split("T")[0] : "",
      gender:                 profile.gender                 || "",
      bio:                    profile.bio                    || "",
      yearsOfExperience:      profile.yearsOfExperience      ?? 0,
      hasMedicalTransportExp: profile.hasMedicalTransportExp ?? false,
      hasAmbulanceExp:        profile.hasAmbulanceExp        ?? false,
      profilePhotoUrl:        profile.profilePhotoUrl        || "",
    });
    setContact({
      phone:          profile.phone          || "",
      altPhone:       profile.altPhone       || "",
      whatsappNumber: profile.whatsappNumber || "",
      email:          profile.email          || "",
    });
    setAddress(profile.address || {});
    setProfessional({
      yearsOfExperience:      profile.yearsOfExperience      ?? 0,
      hasMedicalTransportExp: profile.hasMedicalTransportExp ?? false,
      hasAmbulanceExp:        profile.hasAmbulanceExp        ?? false,
      languagesSpoken:        profile.languagesSpoken        || [],
    });
    setEmergency(profile.emergencyContact || {});
  }, [profile]);

  // ── Action handlers ────────────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await dispatch(uploadSingleFile({ file, folder: "solo-driver/profile" })).unwrap();
    if (result?.url) dispatch(updateMyProfile({ profilePhotoUrl: result.url }));
  };

  const handleSaveBasic        = () => dispatch(updateMyProfile(basic));
  const handleSaveContact      = () => dispatch(updateContactInfo(contact));
  const handleSaveAddress      = () => dispatch(updateAddress(address));
  const handleSaveProfessional = () => dispatch(updateProfessionalInfo(professional));
  const handleSaveEmergency    = () => dispatch(updateEmergencyContact(emergency));

  const handleAddCert = () => {
    if (!newCert.name.trim()) return;
    dispatch(addTrainingCertificate(newCert));
    setNewCert({ name: "", issuedBy: "", issuedAt: "", expiresAt: "" });
    setShowCertForm(false);
  };

  const toggleLang = (lang) => {
    const langs = professional.languagesSpoken || [];
    setProfessional((p) => ({
      ...p,
      languagesSpoken: langs.includes(lang)
        ? langs.filter((l) => l !== lang)
        : [...langs, lang],
    }));
  };

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-10 h-10" />
          <p className="text-xs font-black uppercase tracking-widest text-base-content/40">Loading Profile…</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible"
        className="relative rounded-3xl overflow-hidden border border-base-300 bg-gradient-to-br from-primary/10 via-base-200 to-secondary/10 p-6"
      >
        {/* Ambient blobs */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: [
              "radial-gradient(circle at 15% 55%, var(--primary) 0%, transparent 55%)",
              "radial-gradient(circle at 85% 20%, var(--secondary) 0%, transparent 55%)",
            ].join(", "),
          }}
        />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-xl bg-base-300">
              {basic.profilePhotoUrl || profile?.profilePhotoUrl ? (
                <img
                  src={basic.profilePhotoUrl || profile?.profilePhotoUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Car size={36} className="text-primary/40" />
                </div>
              )}
            </div>
            <button
              onClick={() => photoRef.current?.click()}
              disabled={isUploading}
              title="Upload photo"
              className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-primary text-primary-content shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {/* Name / bio */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-2xl font-black tracking-tight text-base-content">
                {profile?.displayName || profile?.legalName || "Your Name"}
              </h1>
              {status && <StatusBadge status={status} />}
            </div>
            <p className="text-xs text-base-content/40 font-mono uppercase tracking-widest">
              {profile?.partnerCode || "—"}
            </p>
            <p className="text-sm text-base-content/60 mt-1 max-w-sm">
              {profile?.bio || "No bio yet — add one under Personal Details."}
            </p>
          </div>

          {/* Progress ring */}
          <CompletionRing percent={completion} />
        </div>

        {/* Stat chips */}
        <div className="relative mt-5 flex flex-wrap gap-3">
          {[
            { icon: Star,       value: profile?.rating?.averageRating?.toFixed(1) ?? "0.0", label: "Rating" },
            { icon: TrendingUp, value: profile?.stats?.totalRidesCompleted ?? 0,             label: "Rides"  },
            { icon: BadgeCheck, value: profile?.kyc?.verificationStatus ?? "Not Submitted",  label: "KYC"    },
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-2 bg-base-100/60 border border-base-300 rounded-xl backdrop-blur-sm"
            >
              <Icon size={14} className="text-primary" />
              <span className="text-xs font-black text-base-content">{value}</span>
              <span className="text-[9px] uppercase tracking-widest text-base-content/40">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── URL-driven Tab Nav ───────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="space-y-2">
        <div className="flex gap-1 bg-base-200 p-1 rounded-2xl overflow-x-auto custom-scrollbar">
          {TABS.map(({ id, label, icon: Icon, href }) => (
            <Link
              key={id}
              href={href}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                activeTab === id
                  ? "bg-primary text-primary-content shadow-md"
                  : "text-base-content/50 hover:text-base-content hover:bg-base-300"
              }`}
            >
              <Icon size={13} />
              {label}
            </Link>
          ))}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-base-content/30">
          <Link href="/partner/solo/profile" className="hover:text-primary transition-colors">Profile</Link>
          <ChevronRight size={9} />
          <span className="text-primary">{TABS.find((t) => t.id === activeTab)?.label}</span>
        </div>
      </motion.div>

      {/* ── Tab Content ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.28 }}
        >

          {/* ══ /partner/solo/profile  →  Personal Details ══════════════ */}
          {activeTab === "personal" && (
            <SectionCard
              title="Personal Details"
              icon={UserRound}
              subtitle="Your basic identity on the Likeson platform. Your display name is visible to riders; your legal name is managed by admin."
              index={0}
            >
              <InfoNote>
                Fill in all fields to improve your <strong>profile completion score</strong>. 
                A higher score increases your match priority for premium rides.
              </InfoNote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Display Name" hint="Shown to riders on the booking screen.">
                  <Input
                    value={basic.displayName}
                    onChange={(e) => setBasic((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="e.g. Ravi Kumar"
                  />
                </Field>

                <Field label="Date of Birth" hint="Used for identity verification. Not shown publicly.">
                  <Input
                    type="date"
                    value={basic.dateOfBirth}
                    onChange={(e) => setBasic((p) => ({ ...p, dateOfBirth: e.target.value }))}
                  />
                </Field>

                <Field label="Gender">
                  <Select value={basic.gender} onChange={(e) => setBasic((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="">Select gender</option>
                    {["Male", "Female", "Other", "Prefer Not to Say"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Years of Driving Experience" hint="Total years as a paid, professional driver.">
                  <Input
                    type="number"
                    value={basic.yearsOfExperience}
                    onChange={(e) => setBasic((p) => ({ ...p, yearsOfExperience: e.target.value }))}
                    placeholder="e.g. 5"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Bio" hint="Max 500 characters. Tell riders a little about yourself.">
                    <textarea
                      value={basic.bio}
                      onChange={(e) => setBasic((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="e.g. Experienced driver with 5+ years in medical transport. Fluent in Telugu & Hindi."
                      rows={3}
                      maxLength={500}
                      className="input-field w-full resize-none"
                    />
                    <p className="text-[9px] text-base-content/30 text-right mt-1">
                      {(basic.bio || "").length}/500
                    </p>
                  </Field>
                </div>
              </div>

              {/* Specialisations */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                  Specialisations
                </label>
                <p className="text-[10px] text-base-content/30 leading-relaxed">
                  Toggle the service types you are trained and equipped for. These influence your ride-matching priority.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {[
                    { key: "hasMedicalTransportExp", label: "Medical Transport", icon: Stethoscope },
                    { key: "hasAmbulanceExp",         label: "Ambulance",         icon: Heart        },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setBasic((p) => ({ ...p, [key]: !p[key] }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${
                        basic[key]
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-base-300 text-base-content/40 hover:border-primary/50"
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                      {basic[key] && <CheckCircle2 size={12} />}
                    </button>
                  ))}
                </div>
              </div>

              <SaveButton onClick={handleSaveBasic} loading={isUpdating} />
            </SectionCard>
          )}

          {/* ══ /partner/solo/profile/contact  →  Contact Info ══════════ */}
          {activeTab === "contact" && (
            <SectionCard
              title="Contact Info"
              icon={Contact2}
              subtitle="Your contact details are used by the operations team and for ride notifications. Keep them accurate and current."
              index={0}
            >
              <InfoNote>
                Your <strong>Primary Phone</strong> is tied to OTPs and ride alerts. 
                If you need to change your login phone number, please contact support directly.
              </InfoNote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Primary Phone *" hint="10-digit Indian mobile number — used for OTPs and ride alerts.">
                  <Input
                    value={contact.phone}
                    onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="9XXXXXXXXX"
                  />
                </Field>

                <Field label="Alternate Phone" hint="Backup contact in case primary is unreachable.">
                  <Input
                    value={contact.altPhone}
                    onChange={(e) => setContact((p) => ({ ...p, altPhone: e.target.value }))}
                    placeholder="Optional"
                  />
                </Field>

                <Field label="WhatsApp Number" hint="For ride confirmations and operational messages via WhatsApp.">
                  <Input
                    value={contact.whatsappNumber}
                    onChange={(e) => setContact((p) => ({ ...p, whatsappNumber: e.target.value }))}
                    placeholder="Same as primary? Enter here if different."
                  />
                </Field>

                <Field label="Email Address" hint="For settlement reports, account alerts, and admin communication.">
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </Field>
              </div>

              <InfoNote variant="warning">
                Changes to your phone number or email are reviewed by the operations team 
                and may require re-verification before taking effect.
              </InfoNote>

              <SaveButton onClick={handleSaveContact} loading={isUpdating} />
            </SectionCard>
          )}

          {/* ══ /partner/solo/profile/address  →  Address ═══════════════ */}
          {activeTab === "address" && (
            <SectionCard
              title="Residential Address"
              icon={MapPin}
              subtitle="Used for background verification and compliance records only. Your address is never shared with riders."
              index={0}
            >
              <InfoNote>
                Providing an accurate address speeds up your <strong>KYC approval</strong>. 
                City and State are required fields.
              </InfoNote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Street / Door No." hint="Flat number, building name, street name, locality.">
                  <Input
                    value={address.street}
                    onChange={(e) => setAddress((p) => ({ ...p, street: e.target.value }))}
                    placeholder="e.g. Flat 4B, Krishna Nagar"
                  />
                </Field>

                <Field label="City *">
                  <Input
                    value={address.city}
                    onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                    placeholder="e.g. Vijayawada"
                  />
                </Field>

                <Field label="State *">
                  <Input
                    value={address.state}
                    onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))}
                    placeholder="e.g. Andhra Pradesh"
                  />
                </Field>

                <Field label="PIN Code" hint="6-digit Indian postal code.">
                  <Input
                    value={address.pinCode}
                    onChange={(e) => setAddress((p) => ({ ...p, pinCode: e.target.value }))}
                    placeholder="500000"
                  />
                </Field>

                <Field label="Country">
                  <Input
                    value={address.country || "India"}
                    onChange={(e) => setAddress((p) => ({ ...p, country: e.target.value }))}
                  />
                </Field>
              </div>

              <SaveButton onClick={handleSaveAddress} loading={isUpdating} />
            </SectionCard>
          )}

          {/* ══ /partner/solo/profile/professional  →  Professional Info ══ */}
          {activeTab === "professional" && (
            <SectionCard
              title="Professional Info"
              icon={Briefcase}
              subtitle="Your professional qualifications affect which ride types you are matched to. Keep this section accurate and up to date."
              index={0}
            >
              <InfoNote>
                Enabling <strong>Medical Transport</strong> or <strong>Ambulance Experience</strong> qualifies you 
                for higher-priority healthcare rides with better payout rates on the Likeson platform.
              </InfoNote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Years of Professional Driving Experience"
                  hint="Count only years actively working as a paid driver."
                >
                  <Input
                    type="number"
                    value={professional.yearsOfExperience}
                    onChange={(e) => setProfessional((p) => ({ ...p, yearsOfExperience: e.target.value }))}
                    placeholder="e.g. 3"
                  />
                </Field>
              </div>

              <Field
                label="Languages Spoken"
                hint="Select all languages you can comfortably communicate in with riders."
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => toggleLang(lang)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${
                        professional.languagesSpoken?.includes(lang)
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-base-300 text-base-content/40 hover:border-primary/40"
                      }`}
                    >
                      <Languages size={10} />
                      {lang}
                      {professional.languagesSpoken?.includes(lang) && <CheckCircle2 size={10} />}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Special Capabilities"
                hint="Toggle what you are trained or equipped for. This directly affects your matching priority."
              >
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  {[
                    {
                      key:  "hasMedicalTransportExp",
                      label: "Medical Transport",
                      icon:  Stethoscope,
                      note:  "Trained in patient transport protocols",
                    },
                    {
                      key:  "hasAmbulanceExp",
                      label: "Ambulance Experience",
                      icon:  Heart,
                      note:  "Has operated or assisted in ambulance services",
                    },
                  ].map(({ key, label, icon: Icon, note }) => (
                    <button
                      key={key}
                      onClick={() => setProfessional((p) => ({ ...p, [key]: !p[key] }))}
                      className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-left flex-1 transition-all ${
                        professional[key]
                          ? "bg-primary/10 border-primary"
                          : "border-base-300 hover:border-primary/40"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={`shrink-0 mt-0.5 ${professional[key] ? "text-primary" : "text-base-content/40"}`}
                      />
                      <div className="flex-1">
                        <p className={`text-xs font-black uppercase tracking-wide ${professional[key] ? "text-primary" : "text-base-content/60"}`}>
                          {label}
                        </p>
                        <p className="text-[10px] text-base-content/40 mt-0.5">{note}</p>
                      </div>
                      {professional[key] && (
                        <CheckCircle2 size={15} className="text-primary shrink-0 self-center" />
                      )}
                    </button>
                  ))}
                </div>
              </Field>

              <SaveButton onClick={handleSaveProfessional} loading={isUpdating} />
            </SectionCard>
          )}

          {/* ══ /partner/solo/profile/emergency  →  Emergency Contact ══ */}
          {activeTab === "emergency" && (
            <SectionCard
              title="Emergency Contact"
              icon={ShieldAlert}
              subtitle="This person will be notified only in genuine emergencies — accidents, medical incidents, or if you become unreachable mid-trip."
              index={0}
            >
              <InfoNote variant="warning">
                Please <strong>inform this person</strong> that they have been listed as your emergency contact on Likeson. 
                They should be reachable 24/7 and ideally located in the same city as you.
              </InfoNote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *" hint="Legal name of your emergency contact.">
                  <Input
                    value={emergency.name}
                    onChange={(e) => setEmergency((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Lakshmi Devi"
                  />
                </Field>

                <Field label="Relationship" hint="Your relationship to this person.">
                  <Input
                    value={emergency.relationship}
                    onChange={(e) => setEmergency((p) => ({ ...p, relationship: e.target.value }))}
                    placeholder="e.g. Spouse, Parent, Sibling"
                  />
                </Field>

                <Field label="Phone Number *" hint="Must be reachable 24/7. Indian mobile preferred.">
                  <Input
                    value={emergency.phone}
                    onChange={(e) => setEmergency((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="9XXXXXXXXX"
                  />
                </Field>
              </div>

              {/* Live preview chip */}
              {emergency.name && emergency.phone && (
                <InfoNote variant="success">
                  Emergency contact set: <strong>{emergency.name}</strong>
                  {emergency.relationship && ` (${emergency.relationship})`} — {emergency.phone}
                </InfoNote>
              )}

              <SaveButton onClick={handleSaveEmergency} loading={isUpdating} />
            </SectionCard>
          )}

          {/* ══ /partner/solo/profile/certificates  →  Certificates ══════ */}
          {activeTab === "certificates" && (
            <SectionCard
              title="Training Certificates"
              icon={FileUser}
              subtitle="Professional certifications strengthen your profile ranking and unlock premium ride categories."
              index={0}
            >
              <InfoNote>
                Certificates like <strong>First Aid</strong>, <strong>EVTS</strong>, or 
                <strong> Defensive Driving</strong> increase your match rate for specialised 
                medical rides. Expired certificates should be renewed and re-uploaded promptly.
              </InfoNote>

              {/* Certificate list */}
              <div className="space-y-2.5">
                {(profile?.trainingCertificates || []).length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <Award size={36} className="text-base-content/20" />
                    <p className="text-sm font-bold text-base-content/40">No certificates added yet</p>
                    <p className="text-[10px] text-base-content/30 max-w-xs">
                      Adding certifications can increase your match rate for specialised medical rides.
                    </p>
                  </div>
                ) : (
                  (profile?.trainingCertificates || []).map((cert) => {
                    const isExpired = cert.expiresAt && new Date(cert.expiresAt) < new Date();
                    return (
                      <motion.div
                        key={cert._id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center justify-between p-4 rounded-2xl border bg-base-200/50 group hover:border-primary/40 transition-all ${
                          isExpired ? "border-error/40 bg-error/5" : "border-base-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isExpired ? "bg-error/10" : "bg-primary/10"}`}>
                            <Award size={15} className={isExpired ? "text-error" : "text-primary"} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-base-content flex items-center gap-2 flex-wrap">
                              {cert.name}
                              {isExpired && (
                                <span className="text-[9px] bg-error/10 text-error border border-error/30 px-1.5 py-0.5 rounded font-black uppercase tracking-wide">
                                  Expired
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-base-content/40 mt-0.5">
                              {cert.issuedBy || "—"}
                              {cert.issuedAt  && ` · Issued: ${new Date(cert.issuedAt).toLocaleDateString()}`}
                              {cert.expiresAt && ` · Expires: ${new Date(cert.expiresAt).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => dispatch(removeTrainingCertificate(cert._id))}
                          title="Remove certificate"
                          className="p-2 rounded-xl text-error opacity-0 group-hover:opacity-100 hover:bg-error/10 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Add form */}
              <AnimatePresence>
                {showCertForm ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4 mt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-widest text-primary">New Certificate</p>
                        <button
                          onClick={() => setShowCertForm(false)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/50 hover:text-primary transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Certificate Name *" hint="e.g. First Aid, EVTS, Defensive Driving">
                          <Input
                            value={newCert.name}
                            onChange={(e) => setNewCert((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Certificate title"
                          />
                        </Field>
                        <Field label="Issued By" hint="Organisation or institution that issued this certificate.">
                          <Input
                            value={newCert.issuedBy}
                            onChange={(e) => setNewCert((p) => ({ ...p, issuedBy: e.target.value }))}
                            placeholder="e.g. Red Cross India"
                          />
                        </Field>
                        <Field label="Issue Date">
                          <Input
                            type="date"
                            value={newCert.issuedAt}
                            onChange={(e) => setNewCert((p) => ({ ...p, issuedAt: e.target.value }))}
                          />
                        </Field>
                        <Field label="Expiry Date">
                          <Input
                            type="date"
                            value={newCert.expiresAt}
                            onChange={(e) => setNewCert((p) => ({ ...p, expiresAt: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleAddCert}
                          disabled={!newCert.name.trim()}
                          className="btn-primary-cta text-xs px-5 py-2 disabled:opacity-50"
                        >
                          Add Certificate
                        </button>
                        <button
                          onClick={() => setShowCertForm(false)}
                          className="btn-secondary text-xs px-5 py-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setShowCertForm(true)}
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-primary/40 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/5 transition-all w-full justify-center mt-1"
                  >
                    <Plus size={14} /> Add Certificate
                  </motion.button>
                )}
              </AnimatePresence>
            </SectionCard>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}