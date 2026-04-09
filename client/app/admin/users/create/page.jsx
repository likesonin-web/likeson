"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Stethoscope, Truck, FlaskConical, ShoppingBag,
  Heart, DollarSign, ChevronRight, ChevronLeft, Check,
  User, Mail, Phone, Building2, FileText, Hash,
  CreditCard, MapPin, Calendar, Fingerprint, Lock,
  Loader2, AlertCircle, X, Plus, Eye, EyeOff,
  GraduationCap, Briefcase, Languages, Shield,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCustomer, createDoctor, createLabPartner,
  createTransportPartner, createPharmacy, createFinance,
  createCareAssistant,
  fetchRefHospitals, fetchRefLabPartnerHospitals,
  fetchRefPharmacyStores, fetchRefTransportPartners,
  selectCreateLoading, selectUsersErrors,
  selectRefHospitals, selectRefLabPartnerHospitals,
  selectRefPharmacyStores, selectRefTransportPartners,
  selectRefHospitalsLoading, selectRefLabHospitalsLoading,
  selectRefPharmacyStoresLoading, selectRefTransportPartnersLoading,
  clearCreateError,
} from "@/store/slices/adminUserSlice";

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = [
  {
    key: "customer",
    label: "Customer",
    icon: Users,
    color: "var(--chart-1)",
    desc: "End user / patient account",
  },
  {
    key: "doctor",
    label: "Doctor",
    icon: Stethoscope,
    color: "var(--chart-2)",
    desc: "Medical professional with hospital affiliation",
  },
  {
    key: "pharmacy",
    label: "Pharmacist",
    icon: ShoppingBag,
    color: "var(--chart-3)",
    desc: "Pharmacy staff assigned to a store",
  },
  {
    key: "lab-partner",
    label: "Lab Partner",
    icon: FlaskConical,
    color: "var(--chart-4)",
    desc: "Clinic or Diagnostic Center operator",
  },
  {
    key: "transport-partner",
    label: "Transport Partner",
    icon: Truck,
    color: "var(--chart-5)",
    desc: "Transport agency user with KYC",
  },
  {
    key: "care-assistant",
    label: "Care Assistant",
    icon: Heart,
    color: "var(--chart-6)",
    desc: "Home care & patient escort staff",
  },
  {
    key: "finance",
    label: "Finance Staff",
    icon: DollarSign,
    color: "var(--warning)",
    desc: "Internal finance team member (superadmin only)",
  },
];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ steps, current }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <motion.div
              animate={{
                background: i < current
                  ? "var(--success)"
                  : i === current
                  ? "var(--primary)"
                  : "var(--base-300)",
                scale: i === current ? 1.15 : 1,
              }}
              transition={{ duration: 0.3 }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
              style={{ color: i <= current ? "white" : "var(--base-content)", opacity: i <= current ? 1 : 0.5 }}
            >
              {i < current ? <Check size={14} /> : i + 1}
            </motion.div>
            <span className="text-[10px] font-semibold mt-1 whitespace-nowrap"
              style={{ color: i === current ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-0.5 mx-2 mb-4 rounded"
              style={{ background: i < current ? "var(--success)" : "var(--base-300)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Input component ───────────────────────────────────────────────────────────
function Field({ label, required, error, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold" style={{ color: "var(--base-content)" }}>
        {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs opacity-45">{hint}</p>
      )}
      {error && (
        <p className="text-xs flex items-center gap-1" style={{ color: "var(--error)" }}>
          <AlertCircle size={11} />{error}
        </p>
      )}
    </div>
  );
}

function TextInput({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon size={15} style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
        </div>
      )}
      <input
        {...props}
        className={`input-field w-full text-sm ${Icon ? "pl-10" : ""} ${props.className || ""}`}
      />
    </div>
  );
}

function SelectInput({ icon: Icon, children, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <Icon size={15} style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
        </div>
      )}
      <select
        {...props}
        className={`input-field w-full text-sm cursor-pointer ${Icon ? "pl-10" : ""} ${props.className || ""}`}
      >
        {children}
      </select>
    </div>
  );
}

// ── Role selector step ────────────────────────────────────────────────────────
function RoleSelector({ selected, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {ROLES.map((role, i) => {
        const Icon = role.icon;
        const isSelected = selected === role.key;
        return (
          <motion.button
            key={role.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => onSelect(role.key)}
            className="relative p-5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] group"
            style={{
              borderColor: isSelected ? role.color : "var(--base-300)",
              background: isSelected
                ? `color-mix(in srgb, ${role.color}, transparent 88%)`
                : "var(--base-100)",
              boxShadow: isSelected ? `0 4px 20px color-mix(in srgb, ${role.color}, transparent 65%)` : "none",
            }}
          >
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: role.color }}
              >
                <Check size={12} color="white" />
              </motion.div>
            )}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `color-mix(in srgb, ${role.color}, transparent 82%)` }}>
              <Icon size={22} style={{ color: role.color }} />
            </div>
            <p className="font-display font-black text-base leading-tight mb-1"
              style={{ color: isSelected ? role.color : "var(--base-content)" }}>
              {role.label}
            </p>
            <p className="text-xs leading-relaxed"
              style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
              {role.desc}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Form steps per role ───────────────────────────────────────────────────────

// Customer form
function CustomerForm({ form, setForm, errors }) {
  const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.name}>
          <TextInput icon={User} placeholder="e.g. Ravi Kumar" value={form.name || ""}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <TextInput icon={Mail} type="email" placeholder="ravi@example.com" value={form.email || ""}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone Number" hint="10-digit Indian number">
          <TextInput icon={Phone} type="tel" placeholder="9876543210" value={form.phone || ""}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
        <Field label="Gender">
          <SelectInput icon={User} value={form.gender || ""}
            onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
            <option value="">Select gender</option>
            {["Male", "Female", "Other", "Prefer Not to Say"].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Date of Birth">
          <TextInput icon={Calendar} type="date" value={form.dob || ""}
            onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} />
        </Field>
        <Field label="Blood Group">
          <SelectInput icon={Heart} value={form.bloodGroup || ""}
            onChange={e => setForm(p => ({ ...p, bloodGroup: e.target.value }))}>
            <option value="">Select blood group</option>
            {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
          </SelectInput>
        </Field>
      </div>
      <div className="p-4 rounded-xl" style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3 opacity-50">Emergency Contact (Optional)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput icon={User} placeholder="Contact Name"
            value={form.emergencyContact?.name || ""}
            onChange={e => setForm(p => ({
              ...p, emergencyContact: { ...p.emergencyContact, name: e.target.value }
            }))} />
          <TextInput icon={Phone} placeholder="Contact Phone"
            value={form.emergencyContact?.phone || ""}
            onChange={e => setForm(p => ({
              ...p, emergencyContact: { ...p.emergencyContact, phone: e.target.value }
            }))} />
        </div>
      </div>
    </div>
  );
}

// Doctor form
function DoctorForm({ form, setForm, errors, hospitals, hospitalsLoading }) {
  const SPECS = [
    "General Medicine", "Cardiology", "Neurology", "Orthopedics",
    "Pediatrics", "Gynecology", "Dermatology", "Ophthalmology",
    "ENT", "Psychiatry", "Oncology", "Radiology", "Anesthesiology",
    "Urology", "Nephrology", "Gastroenterology", "Pulmonology", "Endocrinology",
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.name}>
          <TextInput icon={User} placeholder="Dr. Suresh Reddy" value={form.name || ""}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <TextInput icon={Mail} type="email" placeholder="doctor@hospital.com" value={form.email || ""}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone Number">
          <TextInput icon={Phone} type="tel" placeholder="9876543210" value={form.phone || ""}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
        <Field label="Specialization" required error={errors.specialization}>
          <SelectInput icon={Stethoscope} value={form.specialization || ""}
            onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}>
            <option value="">Select specialization</option>
            {SPECS.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </Field>
        <Field label="Years of Experience" required error={errors.experienceYears}>
          <TextInput icon={Briefcase} type="number" min="0" max="60"
            placeholder="e.g. 10" value={form.experienceYears || ""}
            onChange={e => setForm(p => ({ ...p, experienceYears: e.target.value }))} />
        </Field>
        <Field label="Registration Number">
          <TextInput icon={Hash} placeholder="MCI-XXXXXX" value={form.registrationNumber || ""}
            onChange={e => setForm(p => ({ ...p, registrationNumber: e.target.value }))} />
        </Field>
        <Field label="Primary Hospital" required error={errors.primaryHospital}
          hint={hospitalsLoading ? "Loading hospitals…" : `${hospitals.length} hospitals available`}>
          <SelectInput icon={Building2} value={form.primaryHospital || ""}
            onChange={e => setForm(p => ({ ...p, primaryHospital: e.target.value }))}>
            <option value="">{hospitalsLoading ? "Loading…" : "Select hospital"}</option>
            {hospitals.map(h => (
              <option key={h._id} value={h._id}>
                {h.name} — {h.hospitalType} ({h.address?.city})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="In-Person Fee (₹)" required error={errors.fees}>
          <TextInput icon={CreditCard} type="number" min="0"
            placeholder="e.g. 500" value={form.fees?.inPersonFee || ""}
            onChange={e => setForm(p => ({ ...p, fees: { ...p.fees, inPersonFee: e.target.value } }))} />
        </Field>
      </div>
      <Field label="Biography / About">
        <textarea rows={3} placeholder="Brief professional biography…"
          value={form.biography || ""}
          onChange={e => setForm(p => ({ ...p, biography: e.target.value }))}
          className="input-field w-full text-sm resize-none" />
      </Field>
    </div>
  );
}

// Pharmacy form
function PharmacyForm({ form, setForm, errors, stores, storesLoading }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.name}>
          <TextInput icon={User} placeholder="Priya Sharma" value={form.name || ""}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <TextInput icon={Mail} type="email" placeholder="pharmacist@store.com" value={form.email || ""}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone Number">
          <TextInput icon={Phone} type="tel" placeholder="9876543210" value={form.phone || ""}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
        <Field label="Pharmacist Name" required error={errors.pharmacistName}>
          <TextInput icon={User} placeholder="Legal name on license" value={form.pharmacistName || ""}
            onChange={e => setForm(p => ({ ...p, pharmacistName: e.target.value }))} />
        </Field>
        <Field label="Registration Number" required error={errors.registrationNumber}>
          <TextInput icon={Hash} placeholder="PCI-XXXXXX" value={form.registrationNumber || ""}
            onChange={e => setForm(p => ({ ...p, registrationNumber: e.target.value }))} />
        </Field>
        <Field label="Qualification" required error={errors.qualification}>
          <TextInput icon={GraduationCap} placeholder="B.Pharm / M.Pharm" value={form.qualification || ""}
            onChange={e => setForm(p => ({ ...p, qualification: e.target.value }))} />
        </Field>
        <Field label="Assigned Store" required error={errors.assignedStore}
          hint={storesLoading ? "Loading stores…" : `${stores.length} stores available`}>
          <SelectInput icon={Building2} value={form.assignedStore || ""}
            onChange={e => setForm(p => ({ ...p, assignedStore: e.target.value }))}>
            <option value="">{storesLoading ? "Loading…" : "Select store"}</option>
            {stores.map(s => (
              <option key={s._id} value={s._id}>
                {s.storeName} ({s.address?.city})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Role in Store">
          <SelectInput icon={Briefcase} value={form.roleInStore || "Store Manager"}
            onChange={e => setForm(p => ({ ...p, roleInStore: e.target.value }))}>
            {["Store Manager", "Senior Pharmacist", "Junior Pharmacist", "Dispenser"].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Years of Experience">
          <TextInput icon={Briefcase} type="number" min="0" placeholder="e.g. 5"
            value={form.experienceYears || ""}
            onChange={e => setForm(p => ({ ...p, experienceYears: e.target.value }))} />
        </Field>
      </div>
    </div>
  );
}

// Lab Partner form
function LabPartnerForm({ form, setForm, errors, hospitals, hospitalsLoading }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.name}>
          <TextInput icon={User} placeholder="Anand Labs Operator" value={form.name || ""}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <TextInput icon={Mail} type="email" placeholder="lab@clinic.com" value={form.email || ""}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone Number">
          <TextInput icon={Phone} type="tel" placeholder="9876543210" value={form.phone || ""}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
        <Field label="Assigned Hospital / Clinic" required error={errors.assignedHospital}
          hint={hospitalsLoading ? "Loading…" : "Only Clinics and Diagnostic Centers shown"}>
          <SelectInput icon={Building2} value={form.assignedHospital || ""}
            onChange={e => setForm(p => ({ ...p, assignedHospital: e.target.value }))}>
            <option value="">{hospitalsLoading ? "Loading…" : "Select clinic / diagnostic center"}</option>
            {hospitals.map(h => (
              <option key={h._id} value={h._id}>
                {h.name} — {h.hospitalType} ({h.address?.city})
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </div>
  );
}

// Transport Partner form
function TransportPartnerForm({ form, setForm, errors, partners, partnersLoading }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.name}>
          <TextInput icon={User} placeholder="Owner/Driver Name" value={form.name || ""}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <TextInput icon={Mail} type="email" placeholder="transport@agency.com" value={form.email || ""}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone Number" hint="10-digit Indian mobile">
          <TextInput icon={Phone} type="tel" placeholder="9876543210" value={form.phone || ""}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
        <Field label="Agency / Transport Partner" required error={errors.agencyId}
          hint={partnersLoading ? "Loading…" : `${partners.length} active agencies`}>
          <SelectInput icon={Truck} value={form.agencyId || ""}
            onChange={e => setForm(p => ({ ...p, agencyId: e.target.value }))}>
            <option value="">{partnersLoading ? "Loading…" : "Select agency"}</option>
            {partners.map(tp => (
              <option key={tp._id} value={tp._id}>
                {tp.businessName} ({tp.businessType}) — {tp.registeredAddress?.city}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Date of Birth">
          <TextInput icon={Calendar} type="date" value={form.dateOfBirth || ""}
            onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} />
        </Field>
        <Field label="Gender">
          <SelectInput icon={User} value={form.gender || ""}
            onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
            <option value="">Select gender</option>
            {["male", "female", "other", "prefer-not-to-say"].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {/* KYC section */}
      <div className="p-4 rounded-xl space-y-4"
        style={{ background: "color-mix(in srgb, var(--warning), transparent 92%)", border: "1px solid color-mix(in srgb, var(--warning), transparent 72%)" }}>
        <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          style={{ color: "var(--warning)" }}>
          <Fingerprint size={13} />KYC Documents (Required)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Aadhaar Number" required error={errors.aadhaarNumber}>
            <TextInput icon={Fingerprint} placeholder="12-digit Aadhaar"
              value={form.kyc?.aadhaarNumber || ""}
              onChange={e => setForm(p => ({ ...p, kyc: { ...p.kyc, aadhaarNumber: e.target.value } }))} />
          </Field>
          <Field label="PAN Number" required error={errors.panNumber}>
            <TextInput icon={CreditCard} placeholder="ABCDE1234F"
              value={form.kyc?.panNumber || ""}
              onChange={e => setForm(p => ({
                ...p, kyc: { ...p.kyc, panNumber: e.target.value.toUpperCase() }
              }))} />
          </Field>
          <Field label="Driving License Number">
            <TextInput icon={FileText} placeholder="DL No. (optional)"
              value={form.kyc?.drivingLicenseNumber || ""}
              onChange={e => setForm(p => ({ ...p, kyc: { ...p.kyc, drivingLicenseNumber: e.target.value } }))} />
          </Field>
          <Field label="DL Expiry Date">
            <TextInput icon={Calendar} type="date"
              value={form.kyc?.drivingLicenseExpiry || ""}
              onChange={e => setForm(p => ({ ...p, kyc: { ...p.kyc, drivingLicenseExpiry: e.target.value } }))} />
          </Field>
        </div>
      </div>
    </div>
  );
}

// Care Assistant form
function CareAssistantForm({ form, setForm, errors }) {
  const SERVICE_AREAS = ["Vijayawada", "Guntur", "Amaravati", "Tenali", "Machilipatnam", "Eluru"];
  const [customArea, setCustomArea] = useState("");

  const addArea = () => {
    if (!customArea.trim()) return;
    setForm(p => ({
      ...p,
      preferredServiceAreas: [...(p.preferredServiceAreas || []), customArea.trim()],
    }));
    setCustomArea("");
  };

  const removeArea = (area) => {
    setForm(p => ({
      ...p,
      preferredServiceAreas: (p.preferredServiceAreas || []).filter(a => a !== area),
    }));
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.name}>
          <TextInput icon={User} placeholder="Lakshmi Devi" value={form.name || ""}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <TextInput icon={Mail} type="email" placeholder="care@assist.com" value={form.email || ""}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone Number">
          <TextInput icon={Phone} type="tel" placeholder="9876543210" value={form.phone || ""}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
        <Field label="Years of Experience">
          <TextInput icon={Briefcase} type="number" min="0" placeholder="e.g. 3"
            value={form.experienceYears || ""}
            onChange={e => setForm(p => ({ ...p, experienceYears: e.target.value }))} />
        </Field>
        <Field label="Base Service Charge (₹)" hint="Default: ₹500 per visit">
          <TextInput icon={CreditCard} type="number" min="0" placeholder="500"
            value={form.baseServiceCharge || ""}
            onChange={e => setForm(p => ({ ...p, baseServiceCharge: e.target.value }))} />
        </Field>
      </div>

      {/* Training flags */}
      <div className="p-4 rounded-xl" style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3 opacity-50">Training & Certifications</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: "isFirstAidCertified", label: "First Aid Certified" },
            { key: "patientEtiquetteTrained", label: "Patient Etiquette" },
            { key: "mobilitySupportTrained", label: "Mobility Support" },
          ].map(t => (
            <label key={t.key} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
              style={{
                background: form.training?.[t.key]
                  ? "color-mix(in srgb, var(--success), transparent 88%)"
                  : "var(--base-100)",
                border: "1px solid var(--base-300)",
              }}>
              <input type="checkbox" checked={!!form.training?.[t.key]}
                onChange={e => setForm(p => ({
                  ...p,
                  training: { ...p.training, [t.key]: e.target.checked },
                }))}
                className="w-4 h-4 accent-success" />
              <span className="text-sm font-semibold">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Service areas */}
      <Field label="Preferred Service Areas">
        <div className="flex gap-2 mb-2">
          <input type="text" value={customArea} onChange={e => setCustomArea(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addArea())}
            placeholder="Type area name + Enter"
            className="input-field flex-1 text-sm" />
          <button type="button" onClick={addArea}
            className="btn-primary-cta !px-3 !py-2.5 flex items-center gap-1 !text-xs">
            <Plus size={13} />Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SERVICE_AREAS.filter(a => !(form.preferredServiceAreas || []).includes(a)).map(a => (
            <button key={a} type="button" onClick={() => setForm(p => ({
              ...p, preferredServiceAreas: [...(p.preferredServiceAreas || []), a],
            }))}
              className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
              style={{ borderColor: "var(--base-300)", color: "var(--base-content)", opacity: 0.65 }}>
              + {a}
            </button>
          ))}
          {(form.preferredServiceAreas || []).map(a => (
            <span key={a} className="badge badge-primary flex items-center gap-1">
              {a}
              <button onClick={() => removeArea(a)} className="hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      </Field>
    </div>
  );
}

// Finance form
function FinanceForm({ form, setForm, errors }) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl flex items-start gap-3"
        style={{ background: "color-mix(in srgb, var(--warning), transparent 88%)", border: "1px solid color-mix(in srgb, var(--warning), transparent 65%)" }}>
        <Shield size={16} style={{ color: "var(--warning)" }} className="flex-shrink-0 mt-0.5" />
        <p className="text-sm" style={{ color: "var(--warning)" }}>
          <strong>Superadmin Only.</strong> Finance accounts have access to financial data and settlement records. Ensure you have the required authorization.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full Name" required error={errors.name}>
          <TextInput icon={User} placeholder="Finance Team Member" value={form.name || ""}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <TextInput icon={Mail} type="email" placeholder="finance@likeson.in" value={form.email || ""}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Phone Number">
          <TextInput icon={Phone} type="tel" placeholder="9876543210" value={form.phone || ""}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
      </div>
    </div>
  );
}

// ── Review step ───────────────────────────────────────────────────────────────
function ReviewStep({ role, form, hospitals, stores, partners, labHospitals }) {
  const roleMeta = ROLES.find(r => r.key === role);
  const Icon = roleMeta?.icon || Users;

  const getRoleRef = () => {
    if (role === "doctor") return hospitals.find(h => h._id === form.primaryHospital)?.name;
    if (role === "pharmacy") return stores.find(s => s._id === form.assignedStore)?.storeName;
    if (role === "lab-partner") return labHospitals.find(h => h._id === form.assignedHospital)?.name;
    if (role === "transport-partner") return partners.find(p => p._id === form.agencyId)?.businessName;
    return null;
  };

  const ref = getRoleRef();

  const rows = [
    { label: "Full Name", value: form.name },
    { label: "Email", value: form.email },
    { label: "Phone", value: form.phone || "—" },
    role === "doctor" && { label: "Specialization", value: form.specialization },
    role === "doctor" && { label: "Experience", value: form.experienceYears ? `${form.experienceYears} years` : "—" },
    role === "doctor" && { label: "Hospital", value: ref },
    role === "doctor" && { label: "In-Person Fee", value: form.fees?.inPersonFee ? `₹${form.fees.inPersonFee}` : "—" },
    role === "pharmacy" && { label: "Pharmacist Name", value: form.pharmacistName },
    role === "pharmacy" && { label: "Registration No.", value: form.registrationNumber },
    role === "pharmacy" && { label: "Qualification", value: form.qualification },
    role === "pharmacy" && { label: "Assigned Store", value: ref },
    role === "lab-partner" && { label: "Assigned Hospital", value: ref },
    role === "transport-partner" && { label: "Agency", value: ref },
    role === "transport-partner" && { label: "Aadhaar (last 4)", value: form.kyc?.aadhaarNumber ? `XXXX XXXX ${form.kyc.aadhaarNumber.slice(-4)}` : "—" },
    role === "transport-partner" && { label: "PAN", value: form.kyc?.panNumber || "—" },
    role === "care-assistant" && { label: "Experience", value: form.experienceYears ? `${form.experienceYears} years` : "—" },
    role === "care-assistant" && { label: "Service Areas", value: (form.preferredServiceAreas || []).join(", ") || "—" },
    role === "care-assistant" && { label: "Base Charge", value: form.baseServiceCharge ? `₹${form.baseServiceCharge}` : "₹500" },
    role === "customer" && { label: "Blood Group", value: form.bloodGroup || "—" },
    role === "customer" && { label: "Gender", value: form.gender || "—" },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Role badge */}
      <div className="flex items-center gap-4 p-5 rounded-2xl"
        style={{ background: `color-mix(in srgb, ${roleMeta?.color}, transparent 88%)`, border: `1px solid color-mix(in srgb, ${roleMeta?.color}, transparent 65%)` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${roleMeta?.color}, transparent 75%)` }}>
          <Icon size={24} style={{ color: roleMeta?.color }} />
        </div>
        <div>
          <p className="font-display font-black text-lg" style={{ color: roleMeta?.color }}>
            {roleMeta?.label}
          </p>
          <p className="text-xs opacity-60">Account will be created with these details</p>
        </div>
      </div>

      {/* Details table */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--base-300)" }}>
        {rows.map((row, i) => (
          <div key={row.label}
            className="flex items-center px-5 py-3.5"
            style={{
              background: i % 2 === 0 ? "var(--base-100)" : "var(--base-200)",
              borderBottom: i < rows.length - 1 ? "1px solid var(--base-300)" : "none",
            }}>
            <span className="text-xs font-bold uppercase tracking-wider w-40 flex-shrink-0 opacity-50">
              {row.label}
            </span>
            <span className="text-sm font-semibold flex-1" style={{ color: "var(--base-content)" }}>
              {row.value || "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl flex items-start gap-3"
        style={{ background: "color-mix(in srgb, var(--info), transparent 90%)", border: "1px solid color-mix(in srgb, var(--info), transparent 70%)" }}>
        <Mail size={15} style={{ color: "var(--info)" }} className="flex-shrink-0 mt-0.5" />
        <p className="text-sm" style={{ color: "var(--info)" }}>
          A temporary password will be auto-generated and sent to <strong>{form.email}</strong> immediately after account creation.
        </p>
      </div>
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(role, form) {
  const errs = {};
  if (!form.name?.trim()) errs.name = "Name is required";
  if (!form.email?.trim()) errs.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";

  if (role === "doctor") {
    if (!form.specialization) errs.specialization = "Specialization is required";
    if (!form.experienceYears) errs.experienceYears = "Experience is required";
    if (!form.primaryHospital) errs.primaryHospital = "Primary hospital is required";
    if (!form.fees?.inPersonFee) errs.fees = "In-person fee is required";
  }
  if (role === "pharmacy") {
    if (!form.pharmacistName) errs.pharmacistName = "Pharmacist name is required";
    if (!form.registrationNumber) errs.registrationNumber = "Registration number is required";
    if (!form.qualification) errs.qualification = "Qualification is required";
    if (!form.assignedStore) errs.assignedStore = "Assigned store is required";
  }
  if (role === "lab-partner") {
    if (!form.assignedHospital) errs.assignedHospital = "Hospital is required";
  }
  if (role === "transport-partner") {
    if (!form.agencyId) errs.agencyId = "Agency is required";
    if (!form.kyc?.aadhaarNumber) errs.aadhaarNumber = "Aadhaar number is required";
    if (!form.kyc?.panNumber) errs.panNumber = "PAN number is required";
  }
  return errs;
}

// ── Build submit payload ──────────────────────────────────────────────────────
function buildPayload(role, form) {
  const base = { name: form.name?.trim(), email: form.email?.trim(), phone: form.phone?.trim() || undefined };
  switch (role) {
    case "customer": return { ...base, gender: form.gender, dob: form.dob, bloodGroup: form.bloodGroup, emergencyContact: form.emergencyContact };
    case "doctor": return {
      ...base, specialization: form.specialization,
      qualifications: form.qualifications || [],
      experienceYears: Number(form.experienceYears),
      registrationNumber: form.registrationNumber,
      primaryHospital: form.primaryHospital,
      fees: { inPersonFee: Number(form.fees?.inPersonFee) },
      biography: form.biography,
      languagesSpoken: form.languagesSpoken || ["English", "Telugu"],
    };
    case "pharmacy": return {
      ...base, pharmacistName: form.pharmacistName,
      registrationNumber: form.registrationNumber,
      qualification: form.qualification,
      experienceYears: Number(form.experienceYears) || 0,
      assignedStore: form.assignedStore,
      roleInStore: form.roleInStore || "Store Manager",
    };
    case "lab-partner": return { ...base, assignedHospital: form.assignedHospital };
    case "transport-partner": return {
      ...base, agencyId: form.agencyId,
      dateOfBirth: form.dateOfBirth, gender: form.gender, address: form.address,
      kyc: form.kyc, emergencyContact: form.emergencyContact,
      bio: form.bio, languagesSpoken: form.languagesSpoken,
    };
    case "care-assistant": return {
      ...base,
      experienceYears: Number(form.experienceYears) || 0,
      languagesKnown: form.languagesKnown || ["Telugu", "English"],
      training: form.training || {},
      preferredServiceAreas: form.preferredServiceAreas || [],
      baseServiceCharge: Number(form.baseServiceCharge) || 500,
    };
    case "finance": return base;
    default: return base;
  }
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function CreateUser() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const creating  = useSelector(selectCreateLoading);
  const errors    = useSelector(selectUsersErrors);

  const hospitals       = useSelector(selectRefHospitals);
  const labHospitals    = useSelector(selectRefLabPartnerHospitals);
  const stores          = useSelector(selectRefPharmacyStores);
  const partners        = useSelector(selectRefTransportPartners);
  const hospitalsLoading = useSelector(selectRefHospitalsLoading);
  const labHospitalsLoading = useSelector(selectRefLabHospitalsLoading);
  const storesLoading    = useSelector(selectRefPharmacyStoresLoading);
  const partnersLoading  = useSelector(selectRefTransportPartnersLoading);

  const [step, setStep]       = useState(0); // 0: role, 1: details, 2: review
  const [role, setRole]       = useState("");
  const [form, setForm]       = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [success, setSuccess] = useState(false);

  // Load ref data when role changes
  useEffect(() => {
    if (role === "doctor") dispatch(fetchRefHospitals());
    if (role === "lab-partner") dispatch(fetchRefLabPartnerHospitals());
    if (role === "pharmacy") dispatch(fetchRefPharmacyStores());
    if (role === "transport-partner") dispatch(fetchRefTransportPartners());
  }, [role, dispatch]);

  useEffect(() => {
    dispatch(clearCreateError());
  }, [dispatch]);

  const STEPS = ["Select Role", "Fill Details", "Review & Create"];

  const handleNext = () => {
    if (step === 0) {
      if (!role) return;
      setForm({});
      setFormErrors({});
      setStep(1);
    } else if (step === 1) {
      const errs = validateForm(role, form);
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        return;
      }
      setFormErrors({});
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    const payload = buildPayload(role, form);
    const thunkMap = {
      customer: createCustomer,
      doctor: createDoctor,
      pharmacy: createPharmacy,
      "lab-partner": createLabPartner,
      "transport-partner": createTransportPartner,
      "care-assistant": createCareAssistant,
      finance: createFinance,
    };
    const result = await dispatch(thunkMap[role](payload));
    if (!result.error) {
      setSuccess(true);
      setTimeout(() => router.push("/admin/users"), 2500);
    }
  };

  const selectedRoleMeta = ROLES.find(r => r.key === role);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--base-100)" }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-10 text-center max-w-md w-full">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "color-mix(in srgb, var(--success), transparent 80%)" }}>
            <Check size={36} style={{ color: "var(--success)" }} />
          </motion.div>
          <h2 className="font-display font-black text-2xl mb-2" style={{ color: "var(--base-content)" }}>
            Account Created!
          </h2>
          <p className="text-sm opacity-55 mb-4">
            Credentials have been sent to <strong>{form.email}</strong>
          </p>
          <div className="spinner mx-auto" />
          <p className="text-xs opacity-35 mt-3">Redirecting to users list…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--base-100)" }}>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/users" className="text-xs opacity-50 hover:opacity-80 transition-opacity">
                User Management
              </Link>
              <ChevronRight size={12} className="opacity-30" />
              <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>Create User</span>
            </div>
            <h1 className="section-heading !mb-0">Create New User</h1>
            <p className="section-subheading !mb-0">Role-specific onboarding with automatic credential delivery</p>
          </div>
          <Link href="/admin/users" className="btn-secondary !px-4 !py-2.5 !text-sm">
            Cancel
          </Link>
        </motion.div>

        {/* Step bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="glass-card p-6">
          <StepBar steps={STEPS} current={step} />
        </motion.div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="glass-card p-7">

            {step === 0 && (
              <>
                <h2 className="font-display font-black text-xl mb-6" style={{ color: "var(--base-content)" }}>
                  Choose Account Type
                </h2>
                <RoleSelector selected={role} onSelect={setRole} />
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  {selectedRoleMeta && (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `color-mix(in srgb, ${selectedRoleMeta.color}, transparent 82%)` }}>
                      <selectedRoleMeta.icon size={20} style={{ color: selectedRoleMeta.color }} />
                    </div>
                  )}
                  <div>
                    <h2 className="font-display font-black text-xl" style={{ color: "var(--base-content)" }}>
                      {selectedRoleMeta?.label} Details
                    </h2>
                    <p className="text-xs opacity-45">Fill in the required information below</p>
                  </div>
                </div>

                {/* Role-specific form */}
                {role === "customer" && <CustomerForm form={form} setForm={setForm} errors={formErrors} />}
                {role === "doctor" && <DoctorForm form={form} setForm={setForm} errors={formErrors} hospitals={hospitals} hospitalsLoading={hospitalsLoading} />}
                {role === "pharmacy" && <PharmacyForm form={form} setForm={setForm} errors={formErrors} stores={stores} storesLoading={storesLoading} />}
                {role === "lab-partner" && <LabPartnerForm form={form} setForm={setForm} errors={formErrors} hospitals={labHospitals} hospitalsLoading={labHospitalsLoading} />}
                {role === "transport-partner" && <TransportPartnerForm form={form} setForm={setForm} errors={formErrors} partners={partners} partnersLoading={partnersLoading} />}
                {role === "care-assistant" && <CareAssistantForm form={form} setForm={setForm} errors={formErrors} />}
                {role === "finance" && <FinanceForm form={form} setForm={setForm} errors={formErrors} />}

                {/* API error */}
                {errors.create && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-4 p-4 rounded-xl flex items-start gap-3"
                    style={{ background: "color-mix(in srgb, var(--error), transparent 88%)", border: "1px solid color-mix(in srgb, var(--error), transparent 65%)" }}>
                    <AlertCircle size={15} style={{ color: "var(--error)" }} />
                    <p className="text-sm" style={{ color: "var(--error)" }}>{errors.create}</p>
                  </motion.div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-display font-black text-xl mb-6" style={{ color: "var(--base-content)" }}>
                  Review Details
                </h2>
                <ReviewStep role={role} form={form}
                  hospitals={hospitals} stores={stores}
                  partners={partners} labHospitals={labHospitals} />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : router.push("/admin/users")}
            className="btn-secondary flex items-center gap-2 !px-5 !py-2.5">
            <ChevronLeft size={15} />
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 2 ? (
            <button onClick={handleNext}
              disabled={step === 0 && !role}
              className="btn-primary-cta flex items-center gap-2 !px-6 !py-2.5 disabled:opacity-40">
              Continue
              <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={creating}
              className="btn-primary-cta flex items-center gap-2 !px-6 !py-2.5">
              {creating
                ? <><Loader2 size={15} className="animate-spin" />Creating…</>
                : <><Check size={15} />Create Account</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}