"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Stethoscope, Plus, Search, Filter, RefreshCw,
  ChevronLeft, ChevronRight, Eye, Edit3, Trash2, ToggleLeft,
  ToggleRight, CheckCircle, XCircle, Link, Unlink, Upload,
  MapPin, DollarSign, Shield, Send, Download, FileText,
  Users, Activity, Star, AlertTriangle, X, Save, Image,
  Clock, Phone, Mail, Globe, Hash, Banknote, Award,
  ChevronDown, ChevronUp, MoreVertical, Loader2, Info,
  Hospital, UserCheck, Clipboard, BarChart2, Settings,
  FileDown, ExternalLink, PlusCircle, Paperclip, Link2
} from "lucide-react";

import {
  fetchAvailableForms,
  downloadHospitalForm,
  downloadDoctorForm,
  fetchAllHospitals,
  fetchHospitalById,
  searchHospitals,
  fetchHospitalEffectivePricing,
  createHospital,
  updateHospitalProfile,
  updateHospitalSettings,
  updateHospitalSecurity,
  updateHospitalPlatformFee,
  updateHospitalConsultationPricing,
  resendHospitalManagerCredentials,
  uploadHospitalImages,
  deleteHospitalImage,
  updateHospitalLocation,
  linkDoctorToHospital,
  unlinkDoctorFromHospital,
  verifyHospital,
  toggleHospitalActive,
  deleteHospital,
  fetchAllDoctors,
  fetchDoctorById,
  fetchDoctorsByHospital,
  searchDoctors,
  createDoctorProfile,
  updateDoctorProfile,
  updateDoctorSettings,
  updateDoctorAvailability,
  updateDoctorBankDetails,
  updateDoctorKyc,
  uploadDoctorPhoto,
  updateDoctorSecurity,
  updateDoctorPlatformFee,
  updateDoctorPartnership,
  verifyDoctorKyc,
  toggleDoctorActive,
  deleteDoctorProfile,
  resendDoctorCredentials,
  resendHospitalManagerCredentials as resendHospMgrCreds,
  selectHospitals,
  selectSelectedHospital,
  selectHospitalTotal,
  selectHospitalPage,
  selectHospitalPages,
  selectHospitalEffectivePricing,
  selectAvailableForms,
  selectDoctors,
  selectSelectedDoctor,
  selectHospitalDoctors,
  selectDoctorTotal,
  selectDoctorPage,
  selectDoctorPages,
  selectHospitalLoading,
  selectHospitalError,
  clearSelectedHospital,
  clearSelectedDoctor,
  clearHospitalSearchResults,
  clearDoctorSearchResults,
} from "@/store/slices/hospitalSlice";

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_HOSPITAL_TYPES = [
  "Multi-Specialty", "Super-Specialty", "Trust", "Government", "Clinic", "Nursing Home",
];
const MANAGED_TYPES = ["Multi-Specialty", "Super-Specialty", "Trust", "Government"];
const SPECIALIZATIONS = [
  "General Physician", "Cardiologist", "Neurologist", "Pediatrician", "Oncologist",
  "Orthopedic Surgeon", "Gastroenterologist", "Gynecologist", "Dermatologist",
  "Urologist", "Psychiatry", "Physiotherapist",
];
const ACCREDITATIONS = ["NABH", "NABL", "JCI", "ISO", "AHPI", "Other"];
const SETTLEMENT_CYCLES = ["weekly", "biweekly", "monthly"];
const PARTNERSHIP_STATUSES = ["Pending", "Active", "Inactive", "Suspended"];
const CONSULTATION_TYPES_LIST = ["inPerson", "video", "homeVisit"];
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FACILITIES_LIST = [
  "Operation Theatre", "Blood Bank", "ICU", "NICU", "PICU",
  "Radiology", "Pathology Lab", "Pharmacy", "Physiotherapy",
  "Dialysis Center", "Endoscopy", "Cardiac Cath Lab",
];
const SPECIALTIES_LIST = [
  "General Surgery", "Cardiology", "Neurology", "Orthopedics", "Oncology",
  "Pediatrics", "Gynecology", "Dermatology", "Gastroenterology", "Urology",
  "Psychiatry", "Physiotherapy", "ENT", "Ophthalmology", "Radiology",
];
const ACCEPTED_SCHEMES = [
  "Aarogyasri", "CGHS", "ECHS", "ESI", "Ayushman Bharat", "PMJAY",
];

// ─── Utility helpers ──────────────────────────────────────────────────────────
const isManagedType = (type) => MANAGED_TYPES.includes(type);

// ─── Sub-components ───────────────────────────────────────────────────────────
const Spinner = ({ size = 18 }) => (
  <Loader2 size={size} className="animate-spin" />
);

const Badge = ({ children, color = "primary" }) => {
  const map = {
    primary: "bg-[color-mix(in_srgb,var(--primary),transparent_85%)] text-[var(--primary)] border-[color-mix(in_srgb,var(--primary),transparent_65%)]",
    success: "bg-[color-mix(in_srgb,var(--success),transparent_85%)] text-[var(--success)] border-[color-mix(in_srgb,var(--success),transparent_65%)]",
    warning: "bg-[color-mix(in_srgb,var(--warning),transparent_85%)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning),transparent_65%)]",
    error:   "bg-[color-mix(in_srgb,var(--error),transparent_85%)]   text-[var(--error)]   border-[color-mix(in_srgb,var(--error),transparent_65%)]",
    info:    "bg-[color-mix(in_srgb,var(--info),transparent_85%)]    text-[var(--info)]    border-[color-mix(in_srgb,var(--info),transparent_65%)]",
  };
  return (
    <span className={`badge border ${map[color] ?? map.primary}`}>{children}</span>
  );
};

const FieldNote = ({ children }) => (
  <p className="text-[10px] mt-0.5 opacity-55 flex items-start gap-1">
    <Info size={10} className="mt-0.5 shrink-0" />{children}
  </p>
);

const FormField = ({ label, note, required, children, className = "" }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-xs font-bold uppercase tracking-wider opacity-70">
      {label}{required && <span className="text-[var(--error)] ml-0.5">*</span>}
    </label>
    {children}
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

const Input = ({ className = "", ...props }) => (
  <input className={`input-field w-full text-sm ${className}`} {...props} />
);

const Select = ({ className = "", children, ...props }) => (
  <select className={`input-field w-full text-sm ${className}`} {...props}>
    {children}
  </select>
);

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`input-field w-full text-sm resize-none ${className}`}
    rows={3}
    {...props}
  />
);

const Btn = ({ children, variant = "primary", loading, className = "", ...props }) => {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-field)] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[var(--primary)] text-[var(--primary-content)] hover:brightness-110",
    danger:  "bg-[var(--error)]   text-[var(--error-content)]   hover:brightness-110",
    outline: "border border-[var(--base-300)] bg-transparent hover:bg-[var(--base-200)]",
    success: "bg-[var(--success)] text-[var(--success-content)] hover:brightness-110",
    warning: "bg-[var(--warning)] text-[var(--warning-content)] hover:brightness-110",
  };
  return (
    <button disabled={loading} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
};

const Modal = ({ open, onClose, title, children, wide }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className={`relative z-10 bg-[var(--base-100)] rounded-[var(--r-box)] shadow-2xl w-full overflow-hidden ${wide ? "max-w-4xl" : "max-w-xl"}`}
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--base-300)]">
            <h3 className="text-base font-bold font-montserrat">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--base-200)] transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[80vh]">
            {children}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const SectionTab = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
      active
        ? "bg-[var(--primary)] text-[var(--primary-content)] shadow"
        : "hover:bg-[var(--base-200)] text-[var(--base-content)] opacity-70"
    }`}
  >
    <Icon size={15} />
    {label}
  </button>
);

// ─── Image Upload Component (supports both file upload and URL paste) ─────────
const ImageUploadField = ({ label, note, value, onChange, multiple = false, accept = "image/*" }) => {
  const fileRef = useRef(null);
  const [urlInput, setUrlInput] = useState("");
  const [mode, setMode] = useState("url"); // "url" | "file"

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    // Convert to base64 or object URLs for preview; in real app, upload to CDN first
    const readers = files.map(
      (f) =>
        new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(f);
        })
    );
    Promise.all(readers).then((results) => {
      if (multiple) {
        onChange(results);
      } else {
        onChange(results[0]);
      }
    });
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    if (multiple) {
      const urls = urlInput.split(",").map((u) => u.trim()).filter(Boolean);
      onChange(urls);
    } else {
      onChange(urlInput.trim());
    }
    setUrlInput("");
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</label>
      {/* Mode toggle */}
      <div className="flex rounded-[var(--r-field)] border border-[var(--base-300)] overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
            mode === "url"
              ? "bg-[var(--primary)] text-[var(--primary-content)]"
              : "hover:bg-[var(--base-200)]"
          }`}
        >
          <Link2 size={12} />Paste URL
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all ${
            mode === "file"
              ? "bg-[var(--primary)] text-[var(--primary-content)]"
              : "hover:bg-[var(--base-200)]"
          }`}
        >
          <Upload size={12} />Upload File
        </button>
      </div>

      {mode === "url" ? (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={multiple ? "https://ik.imagekit.io/…/img1.jpg, …" : "https://ik.imagekit.io/…/logo.png"}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
          />
          <Btn type="button" variant="outline" onClick={handleAddUrl} className="shrink-0">
            <PlusCircle size={14} />Add
          </Btn>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-[var(--base-300)] rounded-[var(--r-field)] p-4 text-center cursor-pointer hover:border-[var(--primary)] transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={20} className="mx-auto mb-1 opacity-40" />
          <p className="text-xs opacity-50">Click to select {multiple ? "images" : "image"}</p>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Preview */}
      {value && (
        <div className="flex flex-wrap gap-2 mt-2">
          {(Array.isArray(value) ? value : [value]).filter(Boolean).map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt={`preview-${i}`}
                className="w-16 h-16 object-cover rounded-lg border border-[var(--base-300)]"
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <button
                type="button"
                onClick={() => {
                  if (multiple) {
                    const arr = Array.isArray(value) ? value : [value];
                    onChange(arr.filter((_, idx) => idx !== i));
                  } else {
                    onChange("");
                  }
                }}
                className="absolute -top-1 -right-1 bg-[var(--error)] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
};

// ─── Multi-select checkbox group ──────────────────────────────────────────────
const CheckboxGroup = ({ label, note, options, value = [], onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</label>
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((opt) => {
        const checked = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (checked) onChange(value.filter((v) => v !== opt));
              else onChange([...value, opt]);
            }}
            className={`px-3 py-1 text-xs rounded-[var(--r-selector)] font-semibold border transition-all ${
              checked
                ? "bg-[var(--primary)] text-[var(--primary-content)] border-[var(--primary)]"
                : "border-[var(--base-300)] hover:border-[var(--primary)] hover:bg-[var(--base-200)]"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

// ─── Section divider ──────────────────────────────────────────────────────────
const SectionDivider = ({ label }) => (
  <div className="flex items-center gap-3 py-2">
    <hr className="flex-1 border-[var(--base-300)]" />
    <span className="text-xs font-bold uppercase tracking-widest opacity-50 whitespace-nowrap">{label}</span>
    <hr className="flex-1 border-[var(--base-300)]" />
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function HospitalManagementPage() {
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.user?.user) ?? null;

  const hospitals   = useSelector(selectHospitals);
  const selectedHosp = useSelector(selectSelectedHospital);
  const hospTotal   = useSelector(selectHospitalTotal);
  const hospPage    = useSelector(selectHospitalPage);
  const hospPages   = useSelector(selectHospitalPages);
  const hospPricing = useSelector(selectHospitalEffectivePricing);
  const availForms  = useSelector(selectAvailableForms);

  const doctors     = useSelector(selectDoctors);
  const selectedDoc = useSelector(selectSelectedDoctor);
  const hospDoctors = useSelector(selectHospitalDoctors);
  const docTotal    = useSelector(selectDoctorTotal);
  const docPage     = useSelector(selectDoctorPage);
  const docPages    = useSelector(selectDoctorPages);

  const loading = useSelector(selectHospitalLoading);
  const error   = useSelector(selectHospitalError);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tab,     setTab]     = useState("hospitals");
  const [hospTab, setHospTab] = useState("list");
  const [docTab,  setDocTab]  = useState("list");

  const [searchQ,     setSearchQ]     = useState("");
  const [filterType,  setFilterType]  = useState("");
  const [page,        setPage]        = useState(1);

  // Modals
  const [showVerifyModal,   setShowVerifyModal]   = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [showPricingModal,  setShowPricingModal]  = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [showLinkModal,     setShowLinkModal]     = useState(false);
  const [showImagesModal,   setShowImagesModal]   = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showKycModal,      setShowKycModal]      = useState(false);
  const [showPartnerModal,  setShowPartnerModal]  = useState(false);
  const [showDocPlatModal,  setShowDocPlatModal]  = useState(false);
  const [showDocSecModal,   setShowDocSecModal]   = useState(false);
  const [showDocBankModal,  setShowDocBankModal]  = useState(false);

  // ── Default hospital form — ALL fields from schema ─────────────────────────
  const defaultHospForm = {
    // Identity
    name:         "",
    hospitalType: "Multi-Specialty",
    description:  "",
    // Logo & Images (CDN URLs or base64 from file picker)
    logo:         "",
    images:       [],        // array of URLs
    // Contact
    contact: {
      phone:          "",
      email:          "",
      website:        "",
      emergencyPhone: "",
      alternatePhone: "",
      whatsapp:       "",
    },
    // Address
    address: {
      line1:    "",
      line2:    "",
      landmark: "",
      city:     "Vijayawada",
      state:    "Andhra Pradesh",
      pincode:  "",
    },
    // Location (GeoJSON)
    location: { lat: "", lng: "" },
    googleMapsUrl: "",
    // Registration
    registrationDetails: {
      licenseNumber: "",
      gstNumber:     "",
      panNumber:     "",
      documentUrl:   "",
      licenseExpiry: "",
    },
    // Specialties, Facilities, Accreditations, Accepted Schemes
    specialties:     [],
    facilities:      [],
    accreditations:  [],
    acceptedSchemes: [],
    nabledLabAvailable: false,
    // Bed count
    bedCount: { total: 0, icu: 0 },
    // Facility flags
    is24x7:              false,
    hasICU:              false,
    hasBloodBank:        false,
    hasPharmacy:         false,
    hasDiagnostics:      false,
    hasAmbulance:        false,
    hasWheelchairAccess: false,
    isEmergencyReady:    false,
    // Consultation types (for hospital-manager)
    consultationTypes: {
      inPerson:  true,
      video:     false,
      homeVisit: false,
    },
    // Consultation Pricing (hospital-manager only)
    consultationPricing: {
      inPersonFee:             600,
      videoFee:                500,
      homeVisitFee:            1000,
      inPersonHonorarium:      400,
      videoHonorarium:         350,
      homeVisitHonorarium:     700,
      followUpFee:             0,
      followUpDiscountPercent: 20,
      followUpValidDays:       7,
    },
    // Platform fee (superadmin override)
    platformFee: { type: "fixed", value: 0 },
    settlementCycle: "",
    // Manager account
    managerName:  "",
    managerEmail: "",
    managerPhone: "",
    // Internal notes
    internalNotes: "",
  };

  const [hospForm, setHospForm] = useState(defaultHospForm);
  const setHF = (path, value) => {
    setHospForm((prev) => {
      const keys = path.split(".");
      if (keys.length === 1) return { ...prev, [path]: value };
      if (keys.length === 2) return { ...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: value } };
      if (keys.length === 3)
        return {
          ...prev,
          [keys[0]]: {
            ...prev[keys[0]],
            [keys[1]]: { ...prev[keys[0]][keys[1]], [keys[2]]: value },
          },
        };
      return prev;
    });
  };

  const [docForm, setDocForm] = useState({
    name:                "",
    email:               "",
    phone:               "",
    specialization:      "General Physician",
    experienceYears:     0,
    primaryHospital:     "",
    biography:           "",
    registrationNumber:  "",
    registrationCouncil: "",
    languagesSpoken:     "",
    profilePhotoUrl:     "",
    profilePhotoFile:    null,
    consultationTypes: {
      inPerson:  true,
      video:     false,
      homeVisit: false,
    },
    fees: {
      inPersonFee:             0,
      videoFee:                0,
      homeVisitFee:            0,
      followUpFee:             0,
      followUpDiscountPercent: 20,
      followUpValidDays:       7,
    },
    qualifications:  [],
    achievements:    [],
    notifPrefs: { sms: true, email: true, push: true, whatsapp: true },
  });

  // edit forms
  const [editHospForm,  setEditHospForm]  = useState({});
  const [settingsForm,  setSettingsForm]  = useState({});
  const [securityForm,  setSecurityForm]  = useState({});
  const [pricingForm,   setPricingForm]   = useState({});
  const [platformForm,  setPlatformForm]  = useState({ type: "fixed", value: 0 });
  const [locationForm,  setLocationForm]  = useState({ lat: "", lng: "", googleMapsUrl: "" });
  const [imagesForm,    setImagesForm]    = useState({ logo: "", logoFile: null, images: [], imageFiles: [] });
  const [linkDocId,     setLinkDocId]     = useState("");

  // Doctor forms
  const [editDocForm,  setEditDocForm]  = useState({});
  const [kycForm,      setKycForm]      = useState({ action: "approve", rejectionReason: "" });
  const [partnerForm,  setPartnerForm]  = useState({ partnershipStatus: "Active", adminNotes: "", contractUrl: "" });
  const [docPlatForm,  setDocPlatForm]  = useState({ type: "fixed", value: 0 });
  const [docSecForm,   setDocSecForm]   = useState({ registrationNumber: "", registrationCouncil: "", adminNotes: "" });
  const [docBankForm,  setDocBankForm]  = useState({
    accountHolderName: "", accountNumber: "", ifscCode: "",
    bankName: "", branchName: "", upiId: "", cancelledChequeUrl: "",
  });
  const [docPhotoUrl,  setDocPhotoUrl]  = useState("");
  const [docPhotoFile, setDocPhotoFile] = useState(null);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchAllHospitals({ page: 1, limit: 10 }));
    dispatch(fetchAllDoctors({ page: 1, limit: 10 }));
    dispatch(fetchAvailableForms());
  }, [dispatch]);

  const handleHospSearch = useCallback(() => {
    if (searchQ.length >= 2) {
      dispatch(searchHospitals({ q: searchQ, city: filterType || undefined, page }));
    } else {
      dispatch(fetchAllHospitals({ page, limit: 10, type: filterType || undefined }));
    }
  }, [dispatch, searchQ, filterType, page]);

  useEffect(() => { handleHospSearch(); }, [page, filterType]);

  // ── HOSPITAL ACTIONS ───────────────────────────────────────────────────────
  const handleCreateHospital = async () => {
    // Build payload matching schema
    const payload = {
      name:         hospForm.name,
      hospitalType: hospForm.hospitalType,
      description:  hospForm.description,
      logo:         hospForm.logo || undefined,
      images:       hospForm.images.length ? hospForm.images : undefined,
      contact:      hospForm.contact,
      address:      hospForm.address,
      googleMapsUrl: hospForm.googleMapsUrl || undefined,
      location:     (hospForm.location.lat && hospForm.location.lng)
        ? { type: "Point", coordinates: [parseFloat(hospForm.location.lng), parseFloat(hospForm.location.lat)] }
        : undefined,
      registrationDetails: hospForm.registrationDetails,
      specialties:     hospForm.specialties,
      facilities:      hospForm.facilities,
      accreditations:  hospForm.accreditations,
      acceptedSchemes: hospForm.acceptedSchemes,
      nabledLabAvailable: hospForm.nabledLabAvailable,
      bedCount:           hospForm.bedCount,
      is24x7:             hospForm.is24x7,
      hasICU:             hospForm.hasICU,
      hasBloodBank:       hospForm.hasBloodBank,
      hasPharmacy:        hospForm.hasPharmacy,
      hasDiagnostics:     hospForm.hasDiagnostics,
      hasAmbulance:       hospForm.hasAmbulance,
      hasWheelchairAccess: hospForm.hasWheelchairAccess,
      isEmergencyReady:   hospForm.isEmergencyReady,
      managerName:        hospForm.managerName,
      managerEmail:       hospForm.managerEmail,
      managerPhone:       hospForm.managerPhone,
      internalNotes:      hospForm.internalNotes || undefined,
      settlementCycle:    hospForm.settlementCycle || undefined,
    };

    // Only include consultationPricing for managed hospital types
    if (isManagedType(hospForm.hospitalType)) {
      payload.consultationPricing = {
        ...hospForm.consultationPricing,
        consultationTypes: hospForm.consultationTypes,
      };
    }

    if (hospForm.platformFee.value > 0) {
      payload.platformFee = hospForm.platformFee;
    }

    await dispatch(createHospital(payload));
    setHospForm(defaultHospForm);
    setHospTab("list");
    dispatch(fetchAllHospitals({ page: 1, limit: 10 }));
  };

  const handleSelectHosp = (h) => {
    dispatch(fetchHospitalById(h._id));
    dispatch(fetchDoctorsByHospital({ hospitalId: h._id }));
    dispatch(fetchHospitalEffectivePricing(h._id));
    setHospTab("detail");
  };

  const handleUpdateProfile = async () => {
    await dispatch(updateHospitalProfile({ id: selectedHosp._id, ...editHospForm }));
  };

  const handleUpdateSettings = async () => {
    await dispatch(updateHospitalSettings({ id: selectedHosp._id, ...settingsForm }));
    setShowSettingsModal(false);
  };

  const handleUpdateSecurity = async () => {
    await dispatch(updateHospitalSecurity({ id: selectedHosp._id, ...securityForm }));
    setShowSecurityModal(false);
  };

  const handleUpdatePricing = async () => {
    await dispatch(updateHospitalConsultationPricing({ id: selectedHosp._id, consultationPricing: pricingForm }));
    setShowPricingModal(false);
  };

  const handleUpdatePlatformFee = async () => {
    await dispatch(updateHospitalPlatformFee({ id: selectedHosp._id, platformFee: platformForm }));
    setShowPlatformModal(false);
  };

  const handleUpdateLocation = async () => {
    await dispatch(updateHospitalLocation({ id: selectedHosp._id, ...locationForm }));
    setShowLocationModal(false);
  };

  const handleUploadImages = async () => {
    const payload = { id: selectedHosp._id };
    if (imagesForm.logo)          payload.logo   = imagesForm.logo;
    if (imagesForm.images?.length) payload.images = imagesForm.images;
    await dispatch(uploadHospitalImages(payload));
    setShowImagesModal(false);
    setImagesForm({ logo: "", logoFile: null, images: [], imageFiles: [] });
  };

  const handleVerify = async (isVerified) => {
    await dispatch(verifyHospital({ id: selectedHosp._id, isVerified }));
    setShowVerifyModal(false);
  };

  const handleToggleHosp = async (id) => {
    await dispatch(toggleHospitalActive(id));
  };

  const handleDeleteHosp = async () => {
    await dispatch(deleteHospital(selectedHosp._id));
    setShowDeleteModal(false);
    setHospTab("list");
    dispatch(clearSelectedHospital());
  };

  const handleLinkDoctor = async () => {
    await dispatch(linkDoctorToHospital({ hospitalId: selectedHosp._id, doctorId: linkDocId }));
    setShowLinkModal(false);
    dispatch(fetchDoctorsByHospital({ hospitalId: selectedHosp._id }));
  };

  const handleUnlinkDoctor = async (doctorId) => {
    await dispatch(unlinkDoctorFromHospital({ hospitalId: selectedHosp._id, doctorId }));
    dispatch(fetchDoctorsByHospital({ hospitalId: selectedHosp._id }));
  };

  const handleResendHospCreds = async (id) => {
    await dispatch(resendHospMgrCreds(id));
  };

  const handleDeleteHospImage = async (idx) => {
    await dispatch(deleteHospitalImage({ id: selectedHosp._id, imageIndex: idx }));
  };

  // ── DOCTOR ACTIONS ─────────────────────────────────────────────────────────
  const handleCreateDoctor = async () => {
    const payload = {
      name:                docForm.name,
      email:               docForm.email,
      phone:               docForm.phone,
      specialization:      docForm.specialization,
      experienceYears:     docForm.experienceYears,
      primaryHospital:     docForm.primaryHospital || undefined,
      biography:           docForm.biography,
      registrationNumber:  docForm.registrationNumber,
      registrationCouncil: docForm.registrationCouncil,
      languagesSpoken:     docForm.languagesSpoken
        ? docForm.languagesSpoken.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      profilePhotoUrl:     docForm.profilePhotoUrl || undefined,
      consultationTypes:   docForm.consultationTypes,
      fees:                docForm.fees,
    };
    await dispatch(createDoctorProfile(payload));
    setDocTab("list");
    dispatch(fetchAllDoctors({ page: 1, limit: 10 }));
  };

  const handleSelectDoc = (d) => {
    dispatch(fetchDoctorById(d._id));
    setDocTab("detail");
  };

  const handleUpdateDocProfile = async () => {
    await dispatch(updateDoctorProfile({ id: selectedDoc._id, ...editDocForm }));
  };

  const handleVerifyKyc = async () => {
    await dispatch(verifyDoctorKyc({ id: selectedDoc._id, ...kycForm }));
    setShowKycModal(false);
  };

  const handleUpdatePartner = async () => {
    await dispatch(updateDoctorPartnership({ id: selectedDoc._id, ...partnerForm }));
    setShowPartnerModal(false);
  };

  const handleDocPlatFee = async () => {
    await dispatch(updateDoctorPlatformFee({ id: selectedDoc._id, platformFee: docPlatForm }));
    setShowDocPlatModal(false);
  };

  const handleDocSecurity = async () => {
    await dispatch(updateDoctorSecurity({ id: selectedDoc._id, ...docSecForm }));
    setShowDocSecModal(false);
  };

  const handleDocBank = async () => {
    await dispatch(updateDoctorBankDetails({ id: selectedDoc._id, ...docBankForm }));
    setShowDocBankModal(false);
  };

  const handleDocPhotoUpload = async () => {
    if (!selectedDoc) return;
    if (docPhotoUrl) {
      await dispatch(updateDoctorProfile({ id: selectedDoc._id, profilePhotoUrl: docPhotoUrl }));
      setDocPhotoUrl("");
    }
  };

  const handleToggleDoc = async (id) => {
    await dispatch(toggleDoctorActive(id));
  };

  const handleDeleteDoc = async () => {
    await dispatch(deleteDoctorProfile(selectedDoc._id));
    dispatch(clearSelectedDoctor());
    setDocTab("list");
    setShowDeleteModal(false);
  };

  const handleResendDocCreds = async (id) => {
    await dispatch(resendDoctorCredentials(id));
  };

  // ── Forms download ─────────────────────────────────────────────────────────
  const handleDLHospForm = (type) => dispatch(downloadHospitalForm(type));
  const handleDLDocForm  = (type) => dispatch(downloadDoctorForm(type));

  // ── Stat cards ─────────────────────────────────────────────────────────────
  const stats = [
    { label: "Total Hospitals", value: hospTotal,         icon: Building2,   color: "primary" },
    { label: "Total Doctors",   value: docTotal,          icon: Stethoscope, color: "info"    },
    { label: "Forms Available", value: availForms.length, icon: FileText,    color: "success" },
  ];

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--base-100)] font-poppins">

      {/* Header */}
      <div className="bg-[var(--base-200)] border-b border-[var(--base-300)] px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black font-montserrat tracking-tight text-gradient-primary">
              Hospital Management
            </h1>
            <p className="text-xs opacity-55 mt-0.5">
              Superadmin / Admin Control Panel — Likeson Healthcare
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="role-badge">
              <Shield size={11} />{user?.role ?? "admin"}
            </span>
            <span className="opacity-50">{user?.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Error banner */}
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="alert alert-error text-sm">
            <AlertTriangle size={16} />{error}
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="stat-card flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-[color-mix(in_srgb,var(--${s.color}),transparent_85%)]`}>
                <s.icon size={22} className={`text-[var(--${s.color})]`} />
              </div>
              <div>
                <div className="stat-card-value text-2xl">{s.value ?? "—"}</div>
                <div className="stat-card-label">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Top tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "hospitals", label: "Hospitals",        icon: Building2  },
            { id: "doctors",   label: "Doctors",          icon: Stethoscope },
            { id: "forms",     label: "Forms & Downloads", icon: FileDown   },
          ].map((t) => (
            <SectionTab key={t.id} {...t} active={tab === t.id} onClick={setTab} />
          ))}
        </div>

        {/* ══ HOSPITALS TAB ═══════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {tab === "hospitals" && (
            <motion.div key="hospitals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Sub-nav */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {[
                  { id: "list",   label: "All Hospitals",  icon: Building2 },
                  { id: "create", label: "Create Hospital", icon: Plus      },
                  ...(selectedHosp ? [{ id: "detail", label: selectedHosp.name?.substring(0, 18) + "…", icon: Eye }] : []),
                ].map((t) => (
                  <SectionTab key={t.id} {...t} active={hospTab === t.id} onClick={setHospTab} />
                ))}
              </div>

              {/* ── HOSPITAL LIST ── */}
              {hospTab === "list" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                      <Input
                        className="pl-8"
                        placeholder="Search hospitals…"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleHospSearch()}
                      />
                    </div>
                    <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-44">
                      <option value="">All Types</option>
                      {ALL_HOSPITAL_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                    <Btn onClick={handleHospSearch} loading={loading.fetchAllHospitals || loading.searchHospitals}>
                      <Search size={14} />Search
                    </Btn>
                    <Btn variant="outline" onClick={() => { setSearchQ(""); setFilterType(""); setPage(1); dispatch(fetchAllHospitals({ page: 1, limit: 10 })); }}>
                      <RefreshCw size={14} />Reset
                    </Btn>
                  </div>

                  <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--base-200)] text-xs uppercase tracking-wider opacity-70">
                        <tr>
                          {["Name", "Type", "Model", "City", "Verified", "Active", "Actions"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading.fetchAllHospitals ? (
                          <tr><td colSpan={7} className="text-center py-8"><Spinner /></td></tr>
                        ) : hospitals.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-8 opacity-40">No hospitals found</td></tr>
                        ) : hospitals.map((h, i) => (
                          <motion.tr key={h._id}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-t border-[var(--base-300)] hover:bg-[var(--base-200)] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {h.logo
                                  ? <img src={h.logo} className="w-7 h-7 rounded-lg object-cover border border-[var(--base-300)]" alt="" />
                                  : <div className="w-7 h-7 rounded-lg bg-[var(--base-300)] flex items-center justify-center"><Building2 size={12} /></div>}
                                <span className="font-semibold">{h.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><Badge color="info">{h.hospitalType}</Badge></td>
                            <td className="px-4 py-3 text-xs opacity-60">{h.managementModel}</td>
                            <td className="px-4 py-3 text-xs opacity-60">{h.address?.city}</td>
                            <td className="px-4 py-3">
                              {h.isVerified
                                ? <CheckCircle size={15} className="text-[var(--success)]" />
                                : <XCircle    size={15} className="text-[var(--error)]"   />}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleToggleHosp(h._id)}>
                                {h.isActive
                                  ? <ToggleRight size={20} className="text-[var(--success)]" />
                                  : <ToggleLeft  size={20} className="opacity-40"             />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Btn variant="outline" className="px-2 py-1 text-xs" onClick={() => handleSelectHosp(h)}>
                                  <Eye size={12} />View
                                </Btn>
                                <Btn variant="outline" className="px-2 py-1 text-xs"
                                  onClick={() => handleResendHospCreds(h._id)}
                                  loading={loading.resendHospitalManagerCredentials}>
                                  <Send size={12} />Creds
                                </Btn>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center gap-3 justify-between text-sm">
                    <span className="opacity-50 text-xs">
                      Page {hospPage} of {hospPages} · {hospTotal} total
                    </span>
                    <div className="flex gap-2">
                      <Btn variant="outline" className="px-2 py-1"
                        onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft size={14} />
                      </Btn>
                      <Btn variant="outline" className="px-2 py-1"
                        onClick={() => setPage((p) => Math.min(hospPages, p + 1))} disabled={page >= hospPages}>
                        <ChevronRight size={14} />
                      </Btn>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CREATE HOSPITAL (ALL FIELDS) ── */}
              {hospTab === "create" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="card p-6 space-y-2">
                  <h2 className="text-lg font-bold font-montserrat flex items-center gap-2">
                    <Plus size={18} />Create New Hospital
                  </h2>

                  {/* ── 1. IDENTITY ── */}
                  <SectionDivider label="Identity" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Hospital Name" required note="Official registered name of the facility">
                      <Input value={hospForm.name} onChange={(e) => setHF("name", e.target.value)}
                        placeholder="e.g. Apollo Multi-Specialty Hospital" />
                    </FormField>
                    <FormField label="Hospital Type" required
                      note={`Managed types (${MANAGED_TYPES.join(", ")}) → hospital-manager account. Clinic/Nursing Home → doctor-owner account.`}>
                      <Select value={hospForm.hospitalType} onChange={(e) => setHF("hospitalType", e.target.value)}>
                        {ALL_HOSPITAL_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Description" className="md:col-span-2"
                      note="Short description shown on the public listing page (max 1000 chars)">
                      <Textarea value={hospForm.description} onChange={(e) => setHF("description", e.target.value)}
                        placeholder="Describe facilities, specialties…" rows={4} />
                    </FormField>
                  </div>

                  {/* ── 2. LOGO & IMAGES ── */}
                  <SectionDivider label="Logo & Gallery Images" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ImageUploadField
                      label="Hospital Logo"
                      note="Square image recommended. Paste CDN URL or upload directly (will be sent to CDN before save)."
                      value={hospForm.logo}
                      onChange={(v) => setHF("logo", Array.isArray(v) ? v[0] : v)}
                      multiple={false}
                    />
                    <ImageUploadField
                      label="Gallery Images (up to 20)"
                      note="Comma-separated CDN URLs or upload multiple files. Each image max 5MB."
                      value={hospForm.images}
                      onChange={(v) => setHF("images", Array.isArray(v) ? v : [v])}
                      multiple={true}
                    />
                  </div>

                  {/* ── 3. MANAGER ACCOUNT ── */}
                  <SectionDivider label="Manager / Owner Account" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Manager Full Name" required
                      note="Full name — will appear on credentials email and account">
                      <Input value={hospForm.managerName} onChange={(e) => setHF("managerName", e.target.value)}
                        placeholder="Dr. Ramesh Kumar" />
                    </FormField>
                    <FormField label="Manager Email" required
                      note="Login credentials will be sent to this address">
                      <Input type="email" value={hospForm.managerEmail}
                        onChange={(e) => setHF("managerEmail", e.target.value)}
                        placeholder="manager@hospital.com" />
                    </FormField>
                    <FormField label="Manager Phone"
                      note="Optional — used for WhatsApp and SMS alerts">
                      <Input value={hospForm.managerPhone} onChange={(e) => setHF("managerPhone", e.target.value)}
                        placeholder="+91XXXXXXXXXX" />
                    </FormField>
                  </div>

                  {/* ── 4. CONTACT ── */}
                  <SectionDivider label="Contact Details" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Phone" required note="Primary contact number shown to patients">
                      <Input value={hospForm.contact.phone}
                        onChange={(e) => setHF("contact.phone", e.target.value)}
                        placeholder="+91XXXXXXXXXX" />
                    </FormField>
                    <FormField label="Email" note="Public inquiry email address">
                      <Input type="email" value={hospForm.contact.email}
                        onChange={(e) => setHF("contact.email", e.target.value)}
                        placeholder="info@hospital.com" />
                    </FormField>
                    <FormField label="Emergency Phone" note="24×7 emergency helpline number">
                      <Input value={hospForm.contact.emergencyPhone}
                        onChange={(e) => setHF("contact.emergencyPhone", e.target.value)}
                        placeholder="+91XXXXXXXXXX" />
                    </FormField>
                    <FormField label="Alternate Phone" note="Secondary contact number">
                      <Input value={hospForm.contact.alternatePhone}
                        onChange={(e) => setHF("contact.alternatePhone", e.target.value)}
                        placeholder="+91XXXXXXXXXX" />
                    </FormField>
                    <FormField label="WhatsApp" note="WhatsApp business number for patient queries">
                      <Input value={hospForm.contact.whatsapp}
                        onChange={(e) => setHF("contact.whatsapp", e.target.value)}
                        placeholder="+91XXXXXXXXXX" />
                    </FormField>
                    <FormField label="Website" note="Official website URL">
                      <Input value={hospForm.contact.website}
                        onChange={(e) => setHF("contact.website", e.target.value)}
                        placeholder="https://hospital.com" />
                    </FormField>
                  </div>

                  {/* ── 5. ADDRESS ── */}
                  <SectionDivider label="Address" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Address Line 1" required note="Street/building name and number">
                      <Input value={hospForm.address.line1}
                        onChange={(e) => setHF("address.line1", e.target.value)}
                        placeholder="Plot 12, MG Road" />
                    </FormField>
                    <FormField label="Address Line 2" note="Floor, wing, or nearby landmark">
                      <Input value={hospForm.address.line2}
                        onChange={(e) => setHF("address.line2", e.target.value)}
                        placeholder="3rd Floor, Wing B" />
                    </FormField>
                    <FormField label="Landmark" note="Nearby prominent landmark for navigation">
                      <Input value={hospForm.address.landmark}
                        onChange={(e) => setHF("address.landmark", e.target.value)}
                        placeholder="Near Bus Stand" />
                    </FormField>
                    <FormField label="City" note="Defaults to Vijayawada">
                      <Input value={hospForm.address.city}
                        onChange={(e) => setHF("address.city", e.target.value)} />
                    </FormField>
                    <FormField label="State" note="State name">
                      <Input value={hospForm.address.state}
                        onChange={(e) => setHF("address.state", e.target.value)} />
                    </FormField>
                    <FormField label="PIN Code" required note="6-digit Indian postal code">
                      <Input value={hospForm.address.pincode}
                        onChange={(e) => setHF("address.pincode", e.target.value)}
                        placeholder="520001" maxLength={6} />
                    </FormField>
                  </div>

                  {/* ── 6. LOCATION ── */}
                  <SectionDivider label="Location & Map" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Latitude" note="Decimal degrees — e.g. 16.5062 for Vijayawada">
                      <Input type="number" step="any" value={hospForm.location.lat}
                        onChange={(e) => setHF("location.lat", e.target.value)}
                        placeholder="16.5062" />
                    </FormField>
                    <FormField label="Longitude" note="Decimal degrees — e.g. 80.6480 for Vijayawada">
                      <Input type="number" step="any" value={hospForm.location.lng}
                        onChange={(e) => setHF("location.lng", e.target.value)}
                        placeholder="80.6480" />
                    </FormField>
                    <FormField label="Google Maps URL" note="Full share link for 'Get Directions' button on listing">
                      <Input value={hospForm.googleMapsUrl}
                        onChange={(e) => setHF("googleMapsUrl", e.target.value)}
                        placeholder="https://maps.google.com/…" />
                    </FormField>
                  </div>

                  {/* ── 7. REGISTRATION ── */}
                  <SectionDivider label="Registration & Legal" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField label="License Number" required
                      note="State Medical Council / PCPNDT / Other registration number">
                      <Input value={hospForm.registrationDetails.licenseNumber}
                        onChange={(e) => setHF("registrationDetails.licenseNumber", e.target.value)}
                        placeholder="AP-MED-2024-XXXX" />
                    </FormField>
                    <FormField label="GST Number" note="15-character GSTIN (optional but required for invoicing)">
                      <Input value={hospForm.registrationDetails.gstNumber}
                        onChange={(e) => setHF("registrationDetails.gstNumber", e.target.value)}
                        placeholder="29XXXXX1234X1ZX" maxLength={15} />
                    </FormField>
                    <FormField label="PAN Number" note="10-character PAN — required for settlement payouts">
                      <Input value={hospForm.registrationDetails.panNumber}
                        onChange={(e) => setHF("registrationDetails.panNumber", e.target.value.toUpperCase())}
                        placeholder="ABCDE1234F" maxLength={10} />
                    </FormField>
                    <FormField label="License Expiry Date" note="Renewal date for the hospital operating license">
                      <Input type="date" value={hospForm.registrationDetails.licenseExpiry}
                        onChange={(e) => setHF("registrationDetails.licenseExpiry", e.target.value)} />
                    </FormField>
                    <FormField label="License Document URL" className="md:col-span-2"
                      note="Paste ImageKit CDN URL of the uploaded license document PDF/image">
                      <Input value={hospForm.registrationDetails.documentUrl}
                        onChange={(e) => setHF("registrationDetails.documentUrl", e.target.value)}
                        placeholder="https://ik.imagekit.io/…/license.pdf" />
                    </FormField>
                  </div>

                  {/* ── 8. SPECIALTIES, FACILITIES, ACCREDITATIONS ── */}
                  <SectionDivider label="Specialties, Facilities & Accreditations" />
                  <div className="space-y-4">
                    <CheckboxGroup
                      label="Medical Specialties"
                      note="Specialties available at this facility — drives search indexing"
                      options={SPECIALTIES_LIST}
                      value={hospForm.specialties}
                      onChange={(v) => setHF("specialties", v)}
                    />
                    <CheckboxGroup
                      label="Facilities Available"
                      note="On-premises facilities and departments"
                      options={FACILITIES_LIST}
                      value={hospForm.facilities}
                      onChange={(v) => setHF("facilities", v)}
                    />
                    <CheckboxGroup
                      label="Accreditations"
                      note="Quality certifications held by this hospital"
                      options={ACCREDITATIONS}
                      value={hospForm.accreditations}
                      onChange={(v) => setHF("accreditations", v)}
                    />
                    <CheckboxGroup
                      label="Accepted Schemes"
                      note="Government and insurance schemes accepted"
                      options={ACCEPTED_SCHEMES}
                      value={hospForm.acceptedSchemes}
                      onChange={(v) => setHF("acceptedSchemes", v)}
                    />
                    <FormField label="NABL-Accredited Lab Available" note="Does this hospital have a NABL-accredited diagnostic lab?">
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input type="checkbox" className="accent-[var(--primary)] w-4 h-4"
                          checked={hospForm.nabledLabAvailable}
                          onChange={(e) => setHF("nabledLabAvailable", e.target.checked)} />
                        <span className="text-xs font-semibold">{hospForm.nabledLabAvailable ? "Yes" : "No"}</span>
                      </label>
                    </FormField>
                  </div>

                  {/* ── 9. BED COUNT ── */}
                  <SectionDivider label="Bed Count" />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Total Beds" note="Total inpatient bed capacity">
                      <Input type="number" min={0} value={hospForm.bedCount.total}
                        onChange={(e) => setHF("bedCount.total", +e.target.value)} />
                    </FormField>
                    <FormField label="ICU Beds" note="Number of ICU/critical care beds (auto-enables ICU flag)">
                      <Input type="number" min={0} value={hospForm.bedCount.icu}
                        onChange={(e) => {
                          const v = +e.target.value;
                          setHospForm((p) => ({
                            ...p,
                            bedCount: { ...p.bedCount, icu: v },
                            hasICU: v > 0,
                          }));
                        }} />
                    </FormField>
                  </div>

                  {/* ── 10. FACILITY FLAGS ── */}
                  <SectionDivider label="Facility Flags" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["is24x7",              "Open 24×7",          "Marks the hospital as round-the-clock operational"],
                      ["hasICU",              "Has ICU",            "Enables ICU badge — auto-synced with ICU bed count"],
                      ["hasBloodBank",        "Blood Bank",         "Available on-premises blood bank"],
                      ["hasPharmacy",         "Pharmacy",           "In-house pharmacy accessible to patients"],
                      ["isEmergencyReady",    "Emergency Ready",    "24×7 emergency unit with trauma care"],
                      ["hasAmbulance",        "Ambulance",          "Own ambulance service"],
                      ["hasDiagnostics",      "Diagnostics",        "On-site lab/radiology services"],
                      ["hasWheelchairAccess", "Wheelchair Access",  "Full wheelchair-accessible premises"],
                    ].map(([key, label, note]) => (
                      <div key={key} className="bg-[var(--base-200)] rounded-[var(--r-field)] p-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" className="accent-[var(--primary)] w-4 h-4 mt-0.5"
                            checked={!!hospForm[key]}
                            onChange={(e) => setHF(key, e.target.checked)} />
                          <div>
                            <p className="text-xs font-bold">{label}</p>
                            <p className="text-[10px] opacity-50 mt-0.5">{note}</p>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* ── 11. CONSULTATION TYPES & PRICING (hospital-manager only) ── */}
                  {isManagedType(hospForm.hospitalType) && (
                    <>
                      <SectionDivider label="Consultation Types (Hospital-Manager)" />
                      <div className="flex gap-4 flex-wrap">
                        {CONSULTATION_TYPES_LIST.map((ct) => (
                          <label key={ct} className="flex items-center gap-2 cursor-pointer bg-[var(--base-200)] px-3 py-2 rounded-[var(--r-field)]">
                            <input type="checkbox" className="accent-[var(--primary)] w-4 h-4"
                              checked={hospForm.consultationTypes[ct]}
                              onChange={(e) =>
                                setHospForm((p) => ({
                                  ...p,
                                  consultationTypes: { ...p.consultationTypes, [ct]: e.target.checked },
                                }))
                              } />
                            <span className="text-xs font-semibold capitalize">
                              {ct === "inPerson" ? "In-Person" : ct === "homeVisit" ? "Home Visit" : "Video"}
                            </span>
                          </label>
                        ))}
                      </div>

                      <SectionDivider label="Consultation Pricing (Hospital-Manager)" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                          ["inPersonFee",             "In-Person Fee (₹)",         "Amount charged to patient per in-person visit"],
                          ["inPersonHonorarium",      "In-Person Honorarium (₹)",  "Doctor's share — must not exceed fee"],
                          ["videoFee",                "Video Fee (₹)",             "Amount charged to patient for video consult"],
                          ["videoHonorarium",         "Video Honorarium (₹)",      "Doctor's share for video — cannot exceed fee"],
                          ["homeVisitFee",            "Home Visit Fee (₹)",        "Amount charged to patient for home visit"],
                          ["homeVisitHonorarium",     "Home Visit Honorarium (₹)", "Doctor's pay for home visit — cannot exceed fee"],
                          ["followUpFee",             "Follow-Up Fee (₹)",         "0 = free follow-up"],
                          ["followUpDiscountPercent", "Follow-Up Discount (%)",    "% discount applied to full fee for follow-up visits"],
                          ["followUpValidDays",       "Follow-Up Valid (days)",     "Days after first visit patient qualifies for follow-up pricing (1–90)"],
                        ].map(([key, label, note]) => (
                          <FormField key={key} label={label} note={note}>
                            <Input type="number" min={0}
                              max={key === "followUpDiscountPercent" ? 100 : key === "followUpValidDays" ? 90 : undefined}
                              value={hospForm.consultationPricing[key]}
                              onChange={(e) =>
                                setHospForm((p) => ({
                                  ...p,
                                  consultationPricing: { ...p.consultationPricing, [key]: +e.target.value },
                                }))
                              } />
                          </FormField>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── 12. PLATFORM FEE & SETTLEMENT (superadmin) ── */}
                  <SectionDivider label="Platform Fee & Settlement (Superadmin)" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Platform Fee Type" note="Fixed = flat ₹ deduction; Percentage = % of consultation fee">
                      <Select value={hospForm.platformFee.type}
                        onChange={(e) =>
                          setHospForm((p) => ({ ...p, platformFee: { ...p.platformFee, type: e.target.value } }))
                        }>
                        <option value="fixed">Fixed (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </Select>
                    </FormField>
                    <FormField label={`Platform Fee Value (${hospForm.platformFee.type === "percentage" ? "%" : "₹"})`}
                      note="0 = use global PlatformPricingConfig default">
                      <Input type="number" min={0}
                        max={hospForm.platformFee.type === "percentage" ? 100 : undefined}
                        value={hospForm.platformFee.value}
                        onChange={(e) =>
                          setHospForm((p) => ({ ...p, platformFee: { ...p.platformFee, value: +e.target.value } }))
                        } />
                    </FormField>
                    <FormField label="Settlement Cycle" note="How frequently payouts are sent to this hospital">
                      <Select value={hospForm.settlementCycle}
                        onChange={(e) => setHF("settlementCycle", e.target.value)}>
                        <option value="">Use Global Default</option>
                        {SETTLEMENT_CYCLES.map((c) => <option key={c}>{c}</option>)}
                      </Select>
                    </FormField>
                  </div>

                  {/* ── 13. INTERNAL NOTES ── */}
                  <SectionDivider label="Internal Notes (Admin Only)" />
                  <FormField label="Internal Notes"
                    note="Not visible to hospital manager or patients — for admin audit trail only">
                    <Textarea value={hospForm.internalNotes}
                      onChange={(e) => setHF("internalNotes", e.target.value)}
                      placeholder="Onboarding notes, audit trail, special conditions…" rows={3} />
                  </FormField>

                  {/* Submit */}
                  <div className="flex gap-3 pt-4">
                    <Btn onClick={handleCreateHospital} loading={loading.createHospital}>
                      <Save size={14} />Create Hospital
                    </Btn>
                    <Btn variant="outline" onClick={() => { setHospForm(defaultHospForm); setHospTab("list"); }}>
                      Cancel
                    </Btn>
                  </div>
                </motion.div>
              )}

              {/* ── HOSPITAL DETAIL ── */}
              {hospTab === "detail" && selectedHosp && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                  {/* Detail header card */}
                  <div className="card p-5 flex flex-wrap items-start gap-4 justify-between">
                    <div className="flex items-center gap-4">
                      {selectedHosp.logo
                        ? <img src={selectedHosp.logo} alt="logo"
                            className="w-16 h-16 rounded-xl object-cover border border-[var(--base-300)]" />
                        : <div className="w-16 h-16 rounded-xl bg-[var(--base-200)] flex items-center justify-center">
                            <Building2 size={28} className="opacity-30" />
                          </div>}
                      <div>
                        <h2 className="text-xl font-black font-montserrat">{selectedHosp.name}</h2>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge color="info">{selectedHosp.hospitalType}</Badge>
                          <Badge color={selectedHosp.isVerified ? "success" : "warning"}>
                            {selectedHosp.isVerified ? "Verified" : "Unverified"}
                          </Badge>
                          <Badge color={selectedHosp.isActive ? "success" : "error"}>
                            {selectedHosp.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge color="primary">{selectedHosp.managementModel}</Badge>
                        </div>
                        <p className="text-xs opacity-50 mt-1">
                          {selectedHosp.address?.city}, {selectedHosp.address?.state} · {selectedHosp.address?.pincode}
                        </p>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex flex-wrap gap-2">
                      <Btn variant="outline" className="text-xs px-3 py-1.5"
                        onClick={() => {
                          setEditHospForm({
                            name:        selectedHosp.name,
                            description: selectedHosp.description,
                            specialties:     selectedHosp.specialties ?? [],
                            facilities:      selectedHosp.facilities  ?? [],
                            accreditations:  selectedHosp.accreditations ?? [],
                            acceptedSchemes: selectedHosp.acceptedSchemes ?? [],
                          });
                          setHospTab("edit");
                        }}>
                        <Edit3 size={12} />Edit Profile
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5"
                        onClick={() => {
                          setSettingsForm({
                            is24x7:              selectedHosp.is24x7,
                            hasICU:              selectedHosp.hasICU,
                            hasBloodBank:        selectedHosp.hasBloodBank,
                            hasPharmacy:         selectedHosp.hasPharmacy,
                            isEmergencyReady:    selectedHosp.isEmergencyReady,
                            hasAmbulance:        selectedHosp.hasAmbulance,
                            hasDiagnostics:      selectedHosp.hasDiagnostics,
                            hasWheelchairAccess: selectedHosp.hasWheelchairAccess,
                            nabledLabAvailable:  selectedHosp.nabledLabAvailable,
                            bedCount:            selectedHosp.bedCount ?? { total: 0, icu: 0 },
                          });
                          setShowSettingsModal(true);
                        }}>
                        <Settings size={12} />Settings
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5"
                        onClick={() => {
                          setSecurityForm({
                            licenseNumber: selectedHosp.registrationDetails?.licenseNumber,
                            gstNumber:     selectedHosp.registrationDetails?.gstNumber,
                            panNumber:     selectedHosp.registrationDetails?.panNumber,
                            documentUrl:   selectedHosp.registrationDetails?.documentUrl,
                            licenseExpiry: selectedHosp.registrationDetails?.licenseExpiry,
                          });
                          setShowSecurityModal(true);
                        }}>
                        <Shield size={12} />Security
                      </Btn>
                      {selectedHosp.managementModel === "hospital-manager" && (
                        <Btn variant="outline" className="text-xs px-3 py-1.5"
                          onClick={() => {
                            const cp = selectedHosp.consultationPricing ?? {};
                            setPricingForm({
                              inPersonFee:             cp.inPersonFee             ?? 600,
                              videoFee:                cp.videoFee                ?? 500,
                              homeVisitFee:            cp.homeVisitFee            ?? 1000,
                              inPersonHonorarium:      cp.inPersonHonorarium      ?? 400,
                              videoHonorarium:         cp.videoHonorarium         ?? 350,
                              homeVisitHonorarium:     cp.homeVisitHonorarium     ?? 700,
                              followUpFee:             cp.followUpFee             ?? 0,
                              followUpDiscountPercent: cp.followUpDiscountPercent ?? 20,
                              followUpValidDays:       cp.followUpValidDays       ?? 7,
                              consultationTypes: cp.consultationTypes ?? { inPerson: true, video: false, homeVisit: false },
                            });
                            setShowPricingModal(true);
                          }}>
                          <DollarSign size={12} />Pricing
                        </Btn>
                      )}
                      <Btn variant="outline" className="text-xs px-3 py-1.5"
                        onClick={() => {
                          setPlatformForm({
                            type:            selectedHosp.platformFee?.type ?? "fixed",
                            value:           selectedHosp.platformFee?.value ?? 0,
                            settlementCycle: selectedHosp.settlementCycle ?? "",
                          });
                          setShowPlatformModal(true);
                        }}>
                        <Banknote size={12} />Platform Fee
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5"
                        onClick={() => {
                          setImagesForm({ logo: selectedHosp.logo ?? "", logoFile: null, images: [], imageFiles: [] });
                          setShowImagesModal(true);
                        }}>
                        <Image size={12} />Images
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setShowLocationModal(true)}>
                        <MapPin size={12} />Location
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setShowLinkModal(true)}>
                        <Link size={12} />Link Doctor
                      </Btn>
                      <Btn variant={selectedHosp.isVerified ? "warning" : "success"} className="text-xs px-3 py-1.5"
                        onClick={() => handleVerify(!selectedHosp.isVerified)} loading={loading.verifyHospital}>
                        <CheckCircle size={12} />{selectedHosp.isVerified ? "Unverify" : "Verify"}
                      </Btn>
                      <Btn variant="warning" className="text-xs px-3 py-1.5"
                        onClick={() => handleResendHospCreds(selectedHosp._id)}
                        loading={loading.resendHospitalManagerCredentials}>
                        <Send size={12} />Resend Creds
                      </Btn>
                      <Btn variant="danger" className="text-xs px-3 py-1.5" onClick={() => setShowDeleteModal(true)}>
                        <Trash2 size={12} />Delete
                      </Btn>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Effective Pricing */}
                    <div className="card p-4">
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><DollarSign size={14} />Effective Pricing</h4>
                      {hospPricing ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="opacity-60">Source</span><Badge color="info">{hospPricing.managementModel}</Badge></div>
                          {hospPricing.consultationPricing && (<>
                            <div className="flex justify-between"><span className="opacity-60">In-Person</span><span className="font-semibold">₹{hospPricing.consultationPricing.inPersonFee}</span></div>
                            <div className="flex justify-between"><span className="opacity-60">Video</span><span className="font-semibold">₹{hospPricing.consultationPricing.videoFee}</span></div>
                            <div className="flex justify-between"><span className="opacity-60">Home Visit</span><span className="font-semibold">₹{hospPricing.consultationPricing.homeVisitFee}</span></div>
                          </>)}
                          {hospPricing.platformFee && (
                            <div className="flex justify-between">
                              <span className="opacity-60">Platform Fee</span>
                              <span className="font-semibold">{hospPricing.platformFee.value}{hospPricing.platformFee.type === "percentage" ? "%" : "₹"}</span>
                            </div>
                          )}
                        </div>
                      ) : <p className="text-xs opacity-40">No pricing data</p>}
                    </div>

                    {/* Facilities */}
                    <div className="card p-4">
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Activity size={14} />Facilities</h4>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {[
                          ["24×7", selectedHosp.is24x7], ["ICU", selectedHosp.hasICU],
                          ["Blood Bank", selectedHosp.hasBloodBank], ["Pharmacy", selectedHosp.hasPharmacy],
                          ["Ambulance", selectedHosp.hasAmbulance], ["Emergency", selectedHosp.isEmergencyReady],
                          ["Diagnostics", selectedHosp.hasDiagnostics], ["Wheelchair", selectedHosp.hasWheelchairAccess],
                          ["NABL Lab", selectedHosp.nabledLabAvailable],
                        ].map(([lbl, val]) => (
                          <div key={lbl} className={`flex items-center gap-1 ${val ? "text-[var(--success)]" : "opacity-30"}`}>
                            <CheckCircle size={11} />{lbl}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Beds & Rating */}
                    <div className="card p-4">
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart2 size={14} />Beds & Rating</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between"><span className="opacity-60">Total Beds</span><span className="font-bold">{selectedHosp.bedCount?.total ?? 0}</span></div>
                        <div className="flex justify-between"><span className="opacity-60">ICU Beds</span><span className="font-bold">{selectedHosp.bedCount?.icu ?? 0}</span></div>
                        <div className="flex justify-between">
                          <span className="opacity-60">Avg Rating</span>
                          <span className="font-bold flex items-center gap-1"><Star size={11} className="text-[var(--warning)]" />{selectedHosp.rating?.averageRating?.toFixed(1) ?? "—"}</span>
                        </div>
                        <div className="flex justify-between"><span className="opacity-60">Total Ratings</span><span className="font-bold">{selectedHosp.rating?.totalRatings ?? 0}</span></div>
                        <div className="flex justify-between"><span className="opacity-60">Settlement</span><span className="font-bold capitalize">{selectedHosp.settlementCycle ?? "Global Default"}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Accreditations & Schemes */}
                  {(selectedHosp.accreditations?.length > 0 || selectedHosp.acceptedSchemes?.length > 0) && (
                    <div className="card p-4">
                      <div className="flex flex-wrap gap-4">
                        {selectedHosp.accreditations?.length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold uppercase opacity-50 mb-2">Accreditations</h5>
                            <div className="flex flex-wrap gap-1">
                              {selectedHosp.accreditations.map((a) => <Badge key={a} color="primary">{a}</Badge>)}
                            </div>
                          </div>
                        )}
                        {selectedHosp.acceptedSchemes?.length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold uppercase opacity-50 mb-2">Accepted Schemes</h5>
                            <div className="flex flex-wrap gap-1">
                              {selectedHosp.acceptedSchemes.map((s) => <Badge key={s} color="success">{s}</Badge>)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gallery */}
                  {selectedHosp.images?.length > 0 && (
                    <div className="card p-4">
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                        <Image size={14} />Gallery ({selectedHosp.images.length}/20)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedHosp.images.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img src={url} alt={`img-${idx}`}
                              className="w-20 h-20 object-cover rounded-lg border border-[var(--base-300)]" />
                            <button
                              onClick={() => handleDeleteHospImage(idx)}
                              className="absolute top-1 right-1 bg-[var(--error)] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Doctors */}
                  <div className="card p-4">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                      <Users size={14} />Linked Doctors ({hospDoctors.length})
                    </h4>
                    {hospDoctors.length === 0
                      ? <p className="text-xs opacity-40">No doctors linked yet.</p>
                      : (
                        <div className="space-y-2">
                          {hospDoctors.map((d) => (
                            <div key={d._id} className="flex items-center justify-between bg-[var(--base-200)] rounded-lg px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Stethoscope size={14} className="opacity-40" />
                                <span className="font-semibold">{d.user?.name ?? "—"}</span>
                                <Badge color="info">{d.specialization}</Badge>
                                <Badge color={d.isVerified ? "success" : "warning"}>
                                  {d.isVerified ? "Verified" : "Pending"}
                                </Badge>
                              </div>
                              <Btn variant="danger" className="px-2 py-1 text-xs"
                                onClick={() => handleUnlinkDoctor(d._id)}>
                                <Unlink size={11} />Unlink
                              </Btn>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </motion.div>
              )}

              {/* ── EDIT HOSPITAL PROFILE ── */}
              {hospTab === "edit" && selectedHosp && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 space-y-4">
                  <h3 className="font-bold text-lg font-montserrat flex items-center gap-2">
                    <Edit3 size={16} />Edit Hospital Profile
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Hospital Name" note="Changing the name will regenerate the URL slug">
                      <Input value={editHospForm.name ?? ""}
                        onChange={(e) => setEditHospForm((p) => ({ ...p, name: e.target.value }))} />
                    </FormField>
                    <FormField label="Description" note="Public-facing description (max 1000 chars)">
                      <Textarea value={editHospForm.description ?? ""}
                        onChange={(e) => setEditHospForm((p) => ({ ...p, description: e.target.value }))} />
                    </FormField>
                  </div>
                  <CheckboxGroup label="Specialties" options={SPECIALTIES_LIST}
                    value={editHospForm.specialties ?? []}
                    onChange={(v) => setEditHospForm((p) => ({ ...p, specialties: v }))} />
                  <CheckboxGroup label="Facilities" options={FACILITIES_LIST}
                    value={editHospForm.facilities ?? []}
                    onChange={(v) => setEditHospForm((p) => ({ ...p, facilities: v }))} />
                  <CheckboxGroup label="Accreditations" options={ACCREDITATIONS}
                    value={editHospForm.accreditations ?? []}
                    onChange={(v) => setEditHospForm((p) => ({ ...p, accreditations: v }))} />
                  <CheckboxGroup label="Accepted Schemes" options={ACCEPTED_SCHEMES}
                    value={editHospForm.acceptedSchemes ?? []}
                    onChange={(v) => setEditHospForm((p) => ({ ...p, acceptedSchemes: v }))} />
                  <div className="flex gap-3">
                    <Btn onClick={handleUpdateProfile} loading={loading.updateHospitalProfile}>
                      <Save size={14} />Save
                    </Btn>
                    <Btn variant="outline" onClick={() => setHospTab("detail")}>Cancel</Btn>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ══ DOCTORS TAB ══════════════════════════════════════════════════ */}
          {tab === "doctors" && (
            <motion.div key="doctors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex gap-2 mb-4 flex-wrap">
                {[
                  { id: "list",   label: "All Doctors",   icon: Stethoscope },
                  { id: "create", label: "Create Doctor", icon: Plus        },
                  ...(selectedDoc ? [{ id: "detail", label: selectedDoc.user?.name?.substring(0, 18) + "…" ?? "Doctor", icon: Eye }] : []),
                ].map((t) => (
                  <SectionTab key={t.id} {...t} active={docTab === t.id} onClick={setDocTab} />
                ))}
              </div>

              {/* ── DOCTOR LIST ── */}
              {docTab === "list" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                      <Input className="pl-8" placeholder="Search doctors…"
                        onKeyDown={(e) => e.key === "Enter" && dispatch(searchDoctors({ q: e.target.value, page: 1 }))}
                      />
                    </div>
                    <Select className="w-44"
                      onChange={(e) => dispatch(fetchAllDoctors({ specialization: e.target.value || undefined, page: 1, limit: 10 }))}>
                      <option value="">All Specializations</option>
                      {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                    <Btn variant="outline" onClick={() => dispatch(fetchAllDoctors({ page: 1, limit: 10 }))}>
                      <RefreshCw size={14} />Refresh
                    </Btn>
                  </div>

                  <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--base-200)] text-xs uppercase tracking-wider opacity-70">
                        <tr>
                          {["Doctor", "Specialization", "KYC", "Partnership", "Active", "Actions"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading.fetchAllDoctors ? (
                          <tr><td colSpan={6} className="text-center py-8"><Spinner /></td></tr>
                        ) : doctors.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-8 opacity-40">No doctors found</td></tr>
                        ) : doctors.map((d, i) => (
                          <motion.tr key={d._id}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-t border-[var(--base-300)] hover:bg-[var(--base-200)] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {d.profilePhotoUrl
                                  ? <img src={d.profilePhotoUrl} className="w-7 h-7 rounded-full object-cover" alt="" />
                                  : <div className="w-7 h-7 rounded-full bg-[var(--base-300)] flex items-center justify-center">
                                      <Stethoscope size={12} />
                                    </div>}
                                <span className="font-semibold">{d.user?.name ?? "—"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><Badge color="info">{d.specialization}</Badge></td>
                            <td className="px-4 py-3">
                              <Badge color={d.kycStatus === "verified" ? "success" : d.kycStatus === "rejected" ? "error" : "warning"}>
                                {d.kycStatus}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge color={d.partnershipStatus === "Active" ? "success" : d.partnershipStatus === "Suspended" ? "error" : "warning"}>
                                {d.partnershipStatus}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleToggleDoc(d._id)}>
                                {d.isActive
                                  ? <ToggleRight size={20} className="text-[var(--success)]" />
                                  : <ToggleLeft  size={20} className="opacity-40"             />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Btn variant="outline" className="px-2 py-1 text-xs" onClick={() => handleSelectDoc(d)}>
                                  <Eye size={12} />View
                                </Btn>
                                <Btn variant="outline" className="px-2 py-1 text-xs"
                                  onClick={() => handleResendDocCreds(d._id)} loading={loading.resendDoctorCredentials}>
                                  <Send size={12} />Creds
                                </Btn>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-3 justify-between text-sm">
                    <span className="opacity-50 text-xs">Page {docPage} of {docPages} · {docTotal} total</span>
                    <div className="flex gap-2">
                      <Btn variant="outline" className="px-2 py-1"
                        onClick={() => dispatch(fetchAllDoctors({ page: Math.max(1, docPage - 1), limit: 10 }))}>
                        <ChevronLeft size={14} />
                      </Btn>
                      <Btn variant="outline" className="px-2 py-1"
                        onClick={() => dispatch(fetchAllDoctors({ page: Math.min(docPages, docPage + 1), limit: 10 }))}>
                        <ChevronRight size={14} />
                      </Btn>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CREATE DOCTOR (ALL FIELDS) ── */}
              {docTab === "create" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="card p-6 space-y-2">
                  <h2 className="text-lg font-bold font-montserrat flex items-center gap-2">
                    <Plus size={18} />Create Doctor Account
                  </h2>

                  {/* ── Profile Photo ── */}
                  <SectionDivider label="Profile Photo" />
                  <ImageUploadField
                    label="Profile Photo"
                    note="Doctor's professional headshot. Paste CDN URL or upload file. Displayed on listing and profile pages."
                    value={docForm.profilePhotoUrl}
                    onChange={(v) => setDocForm((p) => ({ ...p, profilePhotoUrl: Array.isArray(v) ? v[0] : v }))}
                    multiple={false}
                  />

                  {/* ── Basic Info ── */}
                  <SectionDivider label="Basic Information" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Full Name" required note="Doctor's full legal name — used on credentials email">
                      <Input value={docForm.name} onChange={(e) => setDocForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Dr. Ananya Sharma" />
                    </FormField>
                    <FormField label="Email" required note="Login credentials will be sent to this email">
                      <Input type="email" value={docForm.email}
                        onChange={(e) => setDocForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="doctor@hospital.com" />
                    </FormField>
                    <FormField label="Phone" note="For SMS/WhatsApp notifications — E.164 format preferred">
                      <Input value={docForm.phone} onChange={(e) => setDocForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+91XXXXXXXXXX" />
                    </FormField>
                    <FormField label="Specialization" required note="Primary medical specialty — drives search indexing">
                      <Select value={docForm.specialization}
                        onChange={(e) => setDocForm((p) => ({ ...p, specialization: e.target.value }))}>
                        {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Experience (years)" required note="Total years of clinical practice including internship">
                      <Input type="number" min={0} max={70} value={docForm.experienceYears}
                        onChange={(e) => setDocForm((p) => ({ ...p, experienceYears: +e.target.value }))} />
                    </FormField>
                    <FormField label="Primary Hospital ID"
                      note="Paste the Hospital ObjectId — determines managed vs owner pricing model. Leave blank for independent doctor.">
                      <Input value={docForm.primaryHospital}
                        onChange={(e) => setDocForm((p) => ({ ...p, primaryHospital: e.target.value }))}
                        placeholder="6823abcd…" />
                    </FormField>
                    <FormField label="Registration Number" note="MCI / State Medical Council registration number — must be unique">
                      <Input value={docForm.registrationNumber}
                        onChange={(e) => setDocForm((p) => ({ ...p, registrationNumber: e.target.value }))}
                        placeholder="MCI-AP-XXXXX" />
                    </FormField>
                    <FormField label="Registration Council" note="Name of the issuing medical council">
                      <Input value={docForm.registrationCouncil}
                        onChange={(e) => setDocForm((p) => ({ ...p, registrationCouncil: e.target.value }))}
                        placeholder="Andhra Pradesh Medical Council" />
                    </FormField>
                    <FormField label="Languages Spoken (comma-separated)"
                      note="e.g. Telugu,English,Hindi — shown to patients for filtering">
                      <Input value={docForm.languagesSpoken}
                        onChange={(e) => setDocForm((p) => ({ ...p, languagesSpoken: e.target.value }))}
                        placeholder="Telugu,English,Hindi" />
                    </FormField>
                    <FormField label="Biography" className="md:col-span-2"
                      note="Public professional summary shown to patients (max 1000 chars)">
                      <Textarea value={docForm.biography}
                        onChange={(e) => setDocForm((p) => ({ ...p, biography: e.target.value }))}
                        placeholder="Briefly describe specialties, achievements…" rows={4} />
                    </FormField>
                  </div>

                  {/* ── Consultation Types ── */}
                  <SectionDivider label="Consultation Types" />
                  <div className="flex gap-4 flex-wrap">
                    {CONSULTATION_TYPES_LIST.map((ct) => (
                      <label key={ct} className="flex items-center gap-2 cursor-pointer bg-[var(--base-200)] px-3 py-2 rounded-[var(--r-field)]">
                        <input type="checkbox" className="accent-[var(--primary)] w-4 h-4"
                          checked={docForm.consultationTypes[ct]}
                          onChange={(e) =>
                            setDocForm((p) => ({
                              ...p,
                              consultationTypes: { ...p.consultationTypes, [ct]: e.target.checked },
                            }))
                          } />
                        <span className="text-xs font-semibold capitalize">
                          {ct === "inPerson" ? "In-Person" : ct === "homeVisit" ? "Home Visit" : "Video"}
                        </span>
                      </label>
                    ))}
                  </div>
                  <FieldNote>
                    For hospital-manager doctors, consultation types are controlled by the hospital. These will be overridden at booking time.
                  </FieldNote>

                  {/* ── Doctor Fees (doctor-owner / independent) ── */}
                  <SectionDivider label="Doctor Fees (Doctor-Owner / Independent Only)" />
                  <div className="alert alert-info text-xs mb-2">
                    <Info size={14} />
                    <span>These fees are <strong>ignored</strong> for hospital-manager doctors — hospital controls pricing. Only applies for doctor-owner (Clinic/Nursing Home) or independent doctors.</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      ["inPersonFee",             "In-Person Fee (₹)",         "Amount charged to patient per in-person visit",          0],
                      ["videoFee",                "Video Fee (₹)",             "Amount charged to patient for video consultation",        0],
                      ["homeVisitFee",            "Home Visit Fee (₹)",        "Amount charged to patient for home visit",                0],
                      ["followUpFee",             "Follow-Up Fee (₹)",         "0 = free follow-up visits",                              0],
                      ["followUpDiscountPercent", "Follow-Up Discount (%)",    "% discount on full fee for follow-up visits",            20],
                      ["followUpValidDays",       "Follow-Up Valid (days)",     "Days after first visit qualifying for follow-up rate",   7],
                    ].map(([key, label, note]) => (
                      <FormField key={key} label={label} note={note}>
                        <Input type="number" min={0}
                          max={key === "followUpDiscountPercent" ? 100 : key === "followUpValidDays" ? 90 : undefined}
                          value={docForm.fees[key]}
                          onChange={(e) =>
                            setDocForm((p) => ({ ...p, fees: { ...p.fees, [key]: +e.target.value } }))
                          } />
                      </FormField>
                    ))}
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3 pt-4">
                    <Btn onClick={handleCreateDoctor} loading={loading.createDoctorProfile}>
                      <Save size={14} />Create Doctor
                    </Btn>
                    <Btn variant="outline" onClick={() => setDocTab("list")}>Cancel</Btn>
                  </div>
                </motion.div>
              )}

              {/* ── DOCTOR DETAIL ── */}
              {docTab === "detail" && selectedDoc && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                  {/* Header */}
                  <div className="card p-5 flex flex-wrap items-start gap-4 justify-between">
                    <div className="flex items-center gap-4">
                      {selectedDoc.profilePhotoUrl
                        ? <img src={selectedDoc.profilePhotoUrl}
                            className="w-16 h-16 rounded-full object-cover border border-[var(--base-300)]" alt="" />
                        : <div className="w-16 h-16 rounded-full bg-[var(--base-200)] flex items-center justify-center">
                            <Stethoscope size={28} className="opacity-30" />
                          </div>}
                      <div>
                        <h2 className="text-xl font-black font-montserrat">{selectedDoc.user?.name}</h2>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge color="info">{selectedDoc.specialization}</Badge>
                          <Badge color={selectedDoc.kycStatus === "verified" ? "success" : "warning"}>{selectedDoc.kycStatus}</Badge>
                          <Badge color={selectedDoc.partnershipStatus === "Active" ? "success" : "warning"}>{selectedDoc.partnershipStatus}</Badge>
                        </div>
                        <p className="text-xs opacity-50 mt-1">
                          {selectedDoc.experienceYears} yrs exp · {selectedDoc.registrationNumber}
                        </p>
                        {selectedDoc.profileCompletionPercent !== undefined && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="progress-bar w-24">
                              <div className="progress-bar-fill" style={{ width: `${selectedDoc.profileCompletionPercent}%` }} />
                            </div>
                            <span className="text-xs opacity-50">{selectedDoc.profileCompletionPercent}% complete</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Btn variant="outline" className="text-xs px-3 py-1.5"
                        onClick={() => {
                          setEditDocForm({
                            biography:       selectedDoc.biography,
                            languagesSpoken: selectedDoc.languagesSpoken?.join(","),
                            achievements:    selectedDoc.achievements?.join(","),
                          });
                          setDocTab("editDoc");
                        }}>
                        <Edit3 size={12} />Edit Profile
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setShowKycModal(true)}>
                        <UserCheck size={12} />KYC Review
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setShowPartnerModal(true)}>
                        <Award size={12} />Partnership
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setShowDocPlatModal(true)}>
                        <Banknote size={12} />Platform Fee
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setShowDocSecModal(true)}>
                        <Shield size={12} />Security
                      </Btn>
                      <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setShowDocBankModal(true)}>
                        <Banknote size={12} />Bank Details
                      </Btn>
                      <Btn variant="warning" className="text-xs px-3 py-1.5"
                        onClick={() => handleResendDocCreds(selectedDoc._id)} loading={loading.resendDoctorCredentials}>
                        <Send size={12} />Resend Creds
                      </Btn>
                      <Btn variant="danger" className="text-xs px-3 py-1.5" onClick={() => setShowDeleteModal(true)}>
                        <Trash2 size={12} />Delete
                      </Btn>
                    </div>
                  </div>

                  {/* Profile Photo update */}
                  <div className="card p-4">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Upload size={14} />Update Profile Photo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ImageUploadField
                        label="New Profile Photo"
                        note="Paste CDN URL or upload a file directly"
                        value={docPhotoUrl}
                        onChange={(v) => setDocPhotoUrl(Array.isArray(v) ? v[0] : v)}
                        multiple={false}
                      />
                      <div className="flex items-end pb-5">
                        <Btn onClick={handleDocPhotoUpload} loading={loading.updateDoctorProfile}>
                          <Save size={14} />Apply Photo
                        </Btn>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["Total Consultations",      selectedDoc.stats?.totalConsultations      ?? 0],
                      ["Video Consultations",       selectedDoc.stats?.totalVideoConsultations ?? 0],
                      ["Home Visits",               selectedDoc.stats?.totalHomeVisits         ?? 0],
                      ["Total Earnings",            `₹${selectedDoc.stats?.totalEarnings      ?? 0}`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="stat-card">
                        <div className="stat-card-value text-xl">{val}</div>
                        <div className="stat-card-label">{lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* Settlement stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      ["Pending Settlement", `₹${selectedDoc.stats?.pendingSettlement ?? 0}`],
                      ["Total Settled",      `₹${selectedDoc.stats?.totalSettled      ?? 0}`],
                      ["Commission Earned",  `₹${selectedDoc.stats?.totalCommissionEarned ?? 0}`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="stat-card">
                        <div className="stat-card-value text-lg">{val}</div>
                        <div className="stat-card-label">{lbl}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── EDIT DOCTOR ── */}
              {docTab === "editDoc" && selectedDoc && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 space-y-4">
                  <h3 className="font-bold text-lg font-montserrat flex items-center gap-2">
                    <Edit3 size={16} />Edit Doctor Profile
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Biography" note="Public description shown on doctor listing page" className="md:col-span-2">
                      <Textarea value={editDocForm.biography ?? ""}
                        onChange={(e) => setEditDocForm((p) => ({ ...p, biography: e.target.value }))} rows={4} />
                    </FormField>
                    <FormField label="Languages Spoken (comma-separated)"
                      note="e.g. Telugu,English,Hindi">
                      <Input value={editDocForm.languagesSpoken ?? ""}
                        onChange={(e) => setEditDocForm((p) => ({ ...p, languagesSpoken: e.target.value }))}
                        placeholder="Telugu,English,Hindi" />
                    </FormField>
                    <FormField label="Achievements (comma-separated)"
                      note="Awards, recognitions, publications — shown on profile">
                      <Input value={editDocForm.achievements ?? ""}
                        onChange={(e) => setEditDocForm((p) => ({ ...p, achievements: e.target.value }))}
                        placeholder="Best Doctor Award 2023, …" />
                    </FormField>
                  </div>
                  <div className="flex gap-3">
                    <Btn onClick={handleUpdateDocProfile} loading={loading.updateDoctorProfile}>
                      <Save size={14} />Save
                    </Btn>
                    <Btn variant="outline" onClick={() => setDocTab("detail")}>Cancel</Btn>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ══ FORMS TAB ════════════════════════════════════════════════════ */}
          {tab === "forms" && (
            <motion.div key="forms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold font-montserrat flex items-center gap-2">
                  <FileDown size={18} />Registration Forms & Downloads
                </h2>
                <Btn variant="outline" onClick={() => dispatch(fetchAvailableForms())} loading={loading.fetchAvailableForms}>
                  <RefreshCw size={13} />Refresh
                </Btn>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-3 flex items-center gap-2">
                  <Building2 size={14} />Hospital Registration Forms
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      type: "hospital-manager",
                      title: "Managed Hospital Form",
                      description: "For Multi-Specialty, Super-Specialty, Trust, Government hospitals. Hospital manager controls consultation pricing for all linked doctors.",
                      badge: "hospital-manager",
                      color: "primary",
                    },
                    {
                      type: "doctor-owner",
                      title: "Doctor-Owner Hospital Form",
                      description: "For Clinics and Nursing Homes owned by a doctor. The owner-doctor controls their own pricing independently.",
                      badge: "doctor-owner",
                      color: "info",
                    },
                  ].map((f) => (
                    <motion.div key={f.type} whileHover={{ y: -2 }} className="card p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm">{f.title}</h4>
                          <Badge color={f.color}>{f.badge}</Badge>
                        </div>
                        <FileText size={24} className="opacity-20" />
                      </div>
                      <p className="text-xs opacity-60 leading-relaxed">{f.description}</p>
                      <Btn onClick={() => handleDLHospForm(f.type)} loading={loading.downloadHospitalForm} className="w-full justify-center">
                        <Download size={14} />Download Hospital Form
                      </Btn>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-3 flex items-center gap-2">
                  <Stethoscope size={14} />Doctor Registration Forms
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      type: "doctor-owner",
                      title: "Doctor-Owner / Independent Form",
                      description: "For doctors who own and operate their own Clinic or Nursing Home. Full control over consultation fees and availability.",
                      badge: "doctor-owner",
                      color: "success",
                    },
                    {
                      type: "hospital-manager",
                      title: "Affiliated Doctor Form",
                      description: "For doctors practicing under a managed hospital. Consultation fees are set at the hospital level by the manager.",
                      badge: "hospital-manager",
                      color: "warning",
                    },
                  ].map((f) => (
                    <motion.div key={f.type} whileHover={{ y: -2 }} className="card p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm">{f.title}</h4>
                          <Badge color={f.color}>{f.badge}</Badge>
                        </div>
                        <FileText size={24} className="opacity-20" />
                      </div>
                      <p className="text-xs opacity-60 leading-relaxed">{f.description}</p>
                      <Btn variant="success" onClick={() => handleDLDocForm(f.type)} loading={loading.downloadDoctorForm} className="w-full justify-center">
                        <Download size={14} />Download Doctor Form
                      </Btn>
                    </motion.div>
                  ))}
                </div>
              </div>

              {availForms.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-3">
                    All Available Forms (from API)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availForms.map((f) => (
                      <div key={f.id} className="card p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{f.name}</p>
                          <p className="text-xs opacity-50 mt-0.5">{f.description}</p>
                        </div>
                        <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer">
                          <Btn variant="outline" className="text-xs px-3 py-1.5 shrink-0">
                            <ExternalLink size={12} />Open
                          </Btn>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════ MODALS ════════════════════════════════════════ */}

      {/* Settings modal */}
      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)}
        title="Hospital Facility Settings" wide>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ["is24x7",             "Open 24×7",         "Marks the hospital as round-the-clock operational"],
            ["hasICU",             "Has ICU",            "Enables ICU badge — syncs with ICU bed count"],
            ["hasBloodBank",       "Blood Bank",         "Available on-premises blood bank"],
            ["hasPharmacy",        "Pharmacy",           "In-house pharmacy accessible to patients"],
            ["isEmergencyReady",   "Emergency Ready",    "24×7 emergency unit with trauma care"],
            ["hasAmbulance",       "Ambulance",          "Own ambulance service"],
            ["hasDiagnostics",     "Diagnostics",        "On-site lab/radiology services"],
            ["hasWheelchairAccess","Wheelchair Access",  "Full wheelchair-accessible premises"],
            ["nabledLabAvailable", "NABL Lab",           "NABL-accredited diagnostic lab on-premises"],
          ].map(([key, label, note]) => (
            <FormField key={key} label={label} note={note}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-[var(--primary)] w-4 h-4"
                  checked={!!settingsForm[key]}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.checked }))} />
                <span className="text-xs font-semibold">{settingsForm[key] ? "Enabled" : "Disabled"}</span>
              </label>
            </FormField>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <FormField label="Total Beds" note="Total inpatient bed capacity">
            <Input type="number" min={0}
              value={settingsForm.bedCount?.total ?? 0}
              onChange={(e) => setSettingsForm((p) => ({ ...p, bedCount: { ...p.bedCount, total: +e.target.value } }))} />
          </FormField>
          <FormField label="ICU Beds" note="Auto-enables hasICU flag when > 0">
            <Input type="number" min={0}
              value={settingsForm.bedCount?.icu ?? 0}
              onChange={(e) => {
                const v = +e.target.value;
                setSettingsForm((p) => ({ ...p, bedCount: { ...p.bedCount, icu: v }, hasICU: v > 0 }));
              }} />
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleUpdateSettings} loading={loading.updateHospitalSettings}>
            <Save size={14} />Save Settings
          </Btn>
          <Btn variant="outline" onClick={() => setShowSettingsModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Security modal */}
      <Modal open={showSecurityModal} onClose={() => setShowSecurityModal(false)}
        title="Hospital Registration Details">
        <div className="space-y-4">
          <FormField label="License Number"
            note="Changing this triggers a duplicate-license check across all hospitals">
            <Input value={securityForm.licenseNumber ?? ""}
              onChange={(e) => setSecurityForm((p) => ({ ...p, licenseNumber: e.target.value }))} />
          </FormField>
          <FormField label="GST Number" note="15-character GSTIN — required for invoice generation">
            <Input value={securityForm.gstNumber ?? ""}
              onChange={(e) => setSecurityForm((p) => ({ ...p, gstNumber: e.target.value }))} maxLength={15} />
          </FormField>
          <FormField label="PAN Number" note="10-character PAN — validated against ABCDE1234F format">
            <Input value={securityForm.panNumber ?? ""}
              onChange={(e) => setSecurityForm((p) => ({ ...p, panNumber: e.target.value.toUpperCase() }))} maxLength={10} />
          </FormField>
          <FormField label="License Expiry Date" note="Renewal date for the operating license">
            <Input type="date" value={securityForm.licenseExpiry ?? ""}
              onChange={(e) => setSecurityForm((p) => ({ ...p, licenseExpiry: e.target.value }))} />
          </FormField>
          <FormField label="License Document URL"
            note="Paste ImageKit CDN URL of the uploaded license document PDF/image">
            <Input value={securityForm.documentUrl ?? ""}
              onChange={(e) => setSecurityForm((p) => ({ ...p, documentUrl: e.target.value }))}
              placeholder="https://ik.imagekit.io/…/license.pdf" />
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleUpdateSecurity} loading={loading.updateHospitalSecurity}>
            <Save size={14} />Save
          </Btn>
          <Btn variant="outline" onClick={() => setShowSecurityModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Consultation Pricing modal */}
      <Modal open={showPricingModal} onClose={() => setShowPricingModal(false)}
        title="Hospital Consultation Pricing" wide>
        <div className="mb-4">
          <p className="text-xs font-bold opacity-50 uppercase mb-2">Consultation Types</p>
          <div className="flex gap-4 flex-wrap">
            {CONSULTATION_TYPES_LIST.map((ct) => (
              <label key={ct} className="flex items-center gap-2 cursor-pointer bg-[var(--base-200)] px-3 py-2 rounded-[var(--r-field)]">
                <input type="checkbox" className="accent-[var(--primary)] w-4 h-4"
                  checked={pricingForm.consultationTypes?.[ct] ?? false}
                  onChange={(e) =>
                    setPricingForm((p) => ({
                      ...p,
                      consultationTypes: { ...p.consultationTypes, [ct]: e.target.checked },
                    }))
                  } />
                <span className="text-xs font-semibold capitalize">
                  {ct === "inPerson" ? "In-Person" : ct === "homeVisit" ? "Home Visit" : "Video"}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["inPersonFee",             "In-Person Fee (₹)",         "Amount charged to patient per in-person visit"],
            ["inPersonHonorarium",      "In-Person Honorarium (₹)",  "Doctor's share — must not exceed fee"],
            ["videoFee",                "Video Fee (₹)",             "Amount charged to patient for video consult"],
            ["videoHonorarium",         "Video Honorarium (₹)",      "Doctor's share — cannot exceed video fee"],
            ["homeVisitFee",            "Home Visit Fee (₹)",        "Amount charged to patient for home visit"],
            ["homeVisitHonorarium",     "Home Visit Honorarium (₹)", "Doctor's pay — cannot exceed home visit fee"],
            ["followUpFee",             "Follow-Up Fee (₹)",         "0 = free follow-up"],
            ["followUpDiscountPercent", "Follow-Up Discount (%)",    "% off full fee for follow-up visits"],
            ["followUpValidDays",       "Follow-Up Valid (days)",     "Days after first visit qualifying for follow-up pricing (1–90)"],
          ].map(([key, label, note]) => (
            <FormField key={key} label={label} note={note}>
              <Input type="number" min={0}
                max={key === "followUpDiscountPercent" ? 100 : key === "followUpValidDays" ? 90 : undefined}
                value={pricingForm[key] ?? 0}
                onChange={(e) => setPricingForm((p) => ({ ...p, [key]: +e.target.value }))} />
            </FormField>
          ))}
        </div>
        <div className="mt-4">
          <p className="text-xs opacity-50 bg-[var(--base-200)] p-3 rounded-lg">
            <Info size={11} className="inline mr-1" />
            <strong>Note:</strong> Platform fee can only be changed by superadmin via the Platform Fee button. These prices apply to ALL doctors linked to this hospital.
          </p>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleUpdatePricing} loading={loading.updateHospitalConsultationPricing}>
            <Save size={14} />Save Pricing
          </Btn>
          <Btn variant="outline" onClick={() => setShowPricingModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Platform Fee modal */}
      <Modal open={showPlatformModal} onClose={() => setShowPlatformModal(false)}
        title="Hospital Platform Fee Override">
        <div className="space-y-4">
          <div className="alert alert-warning text-xs">
            <AlertTriangle size={14} />
            <span>Superadmin-only override. Setting value to 0 / clearing reverts to global PlatformPricingConfig.</span>
          </div>
          <FormField label="Fee Type" note="Fixed = flat ₹ deduction; Percentage = % of consultation fee">
            <Select value={platformForm.type}
              onChange={(e) => setPlatformForm((p) => ({ ...p, type: e.target.value }))}>
              <option value="fixed">Fixed (₹)</option>
              <option value="percentage">Percentage (%)</option>
            </Select>
          </FormField>
          <FormField label={`Fee Value (${platformForm.type === "percentage" ? "%" : "₹"})`}
            note="Amount or percentage to deduct as platform fee per booking">
            <Input type="number" min={0}
              max={platformForm.type === "percentage" ? 100 : undefined}
              value={platformForm.value}
              onChange={(e) => setPlatformForm((p) => ({ ...p, value: +e.target.value }))} />
          </FormField>
          <FormField label="Settlement Cycle" note="How frequently payouts are sent to this hospital">
            <Select value={platformForm.settlementCycle ?? ""}
              onChange={(e) => setPlatformForm((p) => ({ ...p, settlementCycle: e.target.value }))}>
              <option value="">Use Global Default</option>
              {SETTLEMENT_CYCLES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleUpdatePlatformFee} loading={loading.updateHospitalPlatformFee}>
            <Save size={14} />Save
          </Btn>
          <Btn variant="warning"
            onClick={() => {
              dispatch(updateHospitalPlatformFee({ id: selectedHosp?._id, platformFee: null }));
              setShowPlatformModal(false);
            }}>
            Clear Override
          </Btn>
          <Btn variant="outline" onClick={() => setShowPlatformModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Images modal — supports both URL paste and file upload */}
      <Modal open={showImagesModal} onClose={() => setShowImagesModal(false)}
        title="Update Hospital Images" wide>
        <div className="space-y-6">
          <ImageUploadField
            label="Hospital Logo"
            note="Square image recommended. Paste CDN URL or upload directly. Single image only."
            value={imagesForm.logo}
            onChange={(v) => setImagesForm((p) => ({ ...p, logo: Array.isArray(v) ? v[0] : v }))}
            multiple={false}
          />
          <ImageUploadField
            label="Gallery Images (up to 20 total)"
            note="Paste comma-separated CDN URLs or upload multiple files. Existing images won't be removed unless deleted individually from the gallery view."
            value={imagesForm.images}
            onChange={(v) => setImagesForm((p) => ({ ...p, images: Array.isArray(v) ? v : [v] }))}
            multiple={true}
          />
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleUploadImages} loading={loading.uploadHospitalImages}>
            <Upload size={14} />Apply Images
          </Btn>
          <Btn variant="outline" onClick={() => setShowImagesModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Location modal */}
      <Modal open={showLocationModal} onClose={() => setShowLocationModal(false)}
        title="Update Hospital Location">
        <div className="space-y-4">
          <FormField label="Latitude" note="Decimal degrees — e.g. 16.5062 for Vijayawada">
            <Input type="number" step="any" value={locationForm.lat}
              onChange={(e) => setLocationForm((p) => ({ ...p, lat: e.target.value }))}
              placeholder="16.5062" />
          </FormField>
          <FormField label="Longitude" note="Decimal degrees — e.g. 80.6480 for Vijayawada">
            <Input type="number" step="any" value={locationForm.lng}
              onChange={(e) => setLocationForm((p) => ({ ...p, lng: e.target.value }))}
              placeholder="80.6480" />
          </FormField>
          <FormField label="Google Maps URL"
            note="Full share link from Google Maps for the 'Get Directions' button on listing">
            <Input value={locationForm.googleMapsUrl}
              onChange={(e) => setLocationForm((p) => ({ ...p, googleMapsUrl: e.target.value }))}
              placeholder="https://maps.google.com/…" />
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleUpdateLocation} loading={loading.updateHospitalLocation}>
            <MapPin size={14} />Save Location
          </Btn>
          <Btn variant="outline" onClick={() => setShowLocationModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Link Doctor modal */}
      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)}
        title="Link Doctor to Hospital">
        <FormField label="Doctor Profile ID"
          note="Paste the DoctorProfile ObjectId (_id) — not the User _id. Find it from the doctors list.">
          <Input value={linkDocId} onChange={(e) => setLinkDocId(e.target.value)}
            placeholder="6823abcd…" />
        </FormField>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleLinkDoctor} loading={loading.linkDoctorToHospital}>
            <Link size={14} />Link Doctor
          </Btn>
          <Btn variant="outline" onClick={() => setShowLinkModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}
        title="Confirm Permanent Deletion">
        <div className="alert alert-error text-sm mb-4">
          <AlertTriangle size={16} />
          <span>This action is <strong>irreversible</strong>. All linked doctor associations will be cleaned up automatically.</span>
        </div>
        <p className="text-sm opacity-70 mb-4">
          Are you sure you want to permanently delete{" "}
          <strong>{selectedHosp?.name ?? selectedDoc?.user?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Btn variant="danger"
            onClick={tab === "hospitals" ? handleDeleteHosp : handleDeleteDoc}
            loading={loading.deleteHospital || loading.deleteDoctorProfile}>
            <Trash2 size={14} />Yes, Delete Permanently
          </Btn>
          <Btn variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* KYC verify modal */}
      <Modal open={showKycModal} onClose={() => setShowKycModal(false)}
        title="KYC Verification Review">
        <div className="space-y-4">
          <FormField label="Action"
            note="Approve verifies Aadhaar + PAN and marks doctor as verified. Reject requires a reason.">
            <Select value={kycForm.action}
              onChange={(e) => setKycForm((p) => ({ ...p, action: e.target.value }))}>
              <option value="approve">Approve KYC</option>
              <option value="reject">Reject KYC</option>
            </Select>
          </FormField>
          {kycForm.action === "reject" && (
            <FormField label="Rejection Reason" required
              note="Will be shown to the doctor so they can resubmit with correct documents">
              <Textarea value={kycForm.rejectionReason}
                onChange={(e) => setKycForm((p) => ({ ...p, rejectionReason: e.target.value }))}
                placeholder="Documents are blurry / mismatch in name / expired…" />
            </FormField>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <Btn variant={kycForm.action === "approve" ? "success" : "danger"}
            onClick={handleVerifyKyc} loading={loading.verifyDoctorKyc}>
            <CheckCircle size={14} />{kycForm.action === "approve" ? "Approve KYC" : "Reject KYC"}
          </Btn>
          <Btn variant="outline" onClick={() => setShowKycModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Partnership modal */}
      <Modal open={showPartnerModal} onClose={() => setShowPartnerModal(false)}
        title="Update Doctor Partnership">
        <div className="space-y-4">
          <FormField label="Partnership Status"
            note="Active = doctor appears in search results. Suspended = hidden from all listings.">
            <Select value={partnerForm.partnershipStatus}
              onChange={(e) => setPartnerForm((p) => ({ ...p, partnershipStatus: e.target.value }))}>
              {PARTNERSHIP_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="Admin Notes (internal)"
            note="Internal notes visible only to admin team — not shown to doctor or patients">
            <Textarea value={partnerForm.adminNotes ?? ""}
              onChange={(e) => setPartnerForm((p) => ({ ...p, adminNotes: e.target.value }))}
              placeholder="Reason for status change, audit notes…" />
          </FormField>
          <FormField label="Contract URL"
            note="Paste ImageKit CDN URL of the signed contract document PDF">
            <Input value={partnerForm.contractUrl ?? ""}
              onChange={(e) => setPartnerForm((p) => ({ ...p, contractUrl: e.target.value }))}
              placeholder="https://ik.imagekit.io/…/contract.pdf" />
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleUpdatePartner} loading={loading.updateDoctorPartnership}>
            <Save size={14} />Save
          </Btn>
          <Btn variant="outline" onClick={() => setShowPartnerModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Doctor Platform Fee modal */}
      <Modal open={showDocPlatModal} onClose={() => setShowDocPlatModal(false)}
        title="Doctor Platform Fee Override">
        <div className="space-y-4">
          <div className="alert alert-info text-xs">
            <Info size={14} />
            <span>Only applies for <strong>doctor-owner</strong> hospitals. For hospital-manager doctors, the hospital's platform fee is used instead.</span>
          </div>
          <FormField label="Fee Type" note="Fixed = flat ₹ deduction; Percentage = % of consultation fee">
            <Select value={docPlatForm.type}
              onChange={(e) => setDocPlatForm((p) => ({ ...p, type: e.target.value }))}>
              <option value="fixed">Fixed (₹)</option>
              <option value="percentage">Percentage (%)</option>
            </Select>
          </FormField>
          <FormField label={`Value (${docPlatForm.type === "percentage" ? "%" : "₹"})`}
            note="Set to null/clear to revert to global PlatformPricingConfig default">
            <Input type="number" min={0}
              max={docPlatForm.type === "percentage" ? 100 : undefined}
              value={docPlatForm.value}
              onChange={(e) => setDocPlatForm((p) => ({ ...p, value: +e.target.value }))} />
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleDocPlatFee} loading={loading.updateDoctorPlatformFee}>
            <Save size={14} />Save
          </Btn>
          <Btn variant="warning"
            onClick={() => dispatch(updateDoctorPlatformFee({ id: selectedDoc?._id, platformFee: null })).then(() => setShowDocPlatModal(false))}>
            Clear Override
          </Btn>
          <Btn variant="outline" onClick={() => setShowDocPlatModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Doctor Security modal */}
      <Modal open={showDocSecModal} onClose={() => setShowDocSecModal(false)}
        title="Doctor Security Details">
        <div className="space-y-4">
          <FormField label="Registration Number"
            note="MCI / State Medical Council reg no — must be unique across all doctors">
            <Input value={docSecForm.registrationNumber ?? ""}
              onChange={(e) => setDocSecForm((p) => ({ ...p, registrationNumber: e.target.value }))}
              placeholder="MCI-AP-XXXXX" />
          </FormField>
          <FormField label="Registration Council"
            note="Name of the issuing medical council for verification">
            <Input value={docSecForm.registrationCouncil ?? ""}
              onChange={(e) => setDocSecForm((p) => ({ ...p, registrationCouncil: e.target.value }))}
              placeholder="Andhra Pradesh Medical Council" />
          </FormField>
          <FormField label="Admin Notes (internal)" note="Internal notes — not visible to doctor or patients">
            <Textarea value={docSecForm.adminNotes ?? ""}
              onChange={(e) => setDocSecForm((p) => ({ ...p, adminNotes: e.target.value }))}
              placeholder="Security audit notes…" />
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleDocSecurity} loading={loading.updateDoctorSecurity}>
            <Save size={14} />Save
          </Btn>
          <Btn variant="outline" onClick={() => setShowDocSecModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Doctor Bank modal */}
      <Modal open={showDocBankModal} onClose={() => setShowDocBankModal(false)}
        title="Doctor Bank Details">
        <div className="space-y-4">
          <div className="alert alert-warning text-xs">
            <AlertTriangle size={14} />
            <span>Updating bank details resets bank verification status. Admin must re-verify before next payout.</span>
          </div>
          <FormField label="Account Holder Name"
            note="Must match the name on the bank account passbook exactly">
            <Input value={docBankForm.accountHolderName ?? ""}
              onChange={(e) => setDocBankForm((p) => ({ ...p, accountHolderName: e.target.value }))}
              placeholder="Dr. Ananya Sharma" />
          </FormField>
          <FormField label="Account Number"
            note="Full account number — stored encrypted, only last 4 digits shown publicly">
            <Input value={docBankForm.accountNumber ?? ""}
              onChange={(e) => setDocBankForm((p) => ({ ...p, accountNumber: e.target.value }))}
              placeholder="XXXXXXXXXXXXXXXX" type="password" />
          </FormField>
          <FormField label="IFSC Code"
            note="11-character IFSC — format: ABCD0123456 (4 letters + 0 + 6 alphanumeric)">
            <Input value={docBankForm.ifscCode ?? ""}
              onChange={(e) => setDocBankForm((p) => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
              placeholder="SBIN0001234" maxLength={11} />
          </FormField>
          <FormField label="Bank Name"
            note="Full name of the bank — used on settlement reports">
            <Input value={docBankForm.bankName ?? ""}
              onChange={(e) => setDocBankForm((p) => ({ ...p, bankName: e.target.value }))}
              placeholder="State Bank of India" />
          </FormField>
          <FormField label="Branch Name" note="Bank branch name (optional)">
            <Input value={docBankForm.branchName ?? ""}
              onChange={(e) => setDocBankForm((p) => ({ ...p, branchName: e.target.value }))}
              placeholder="Vijayawada Main Branch" />
          </FormField>
          <FormField label="UPI ID" note="Optional — used for instant UPI payouts (format: name@bank)">
            <Input value={docBankForm.upiId ?? ""}
              onChange={(e) => setDocBankForm((p) => ({ ...p, upiId: e.target.value }))}
              placeholder="doctor@upi" />
          </FormField>
          <FormField label="Cancelled Cheque URL"
            note="Paste ImageKit CDN URL of the uploaded cancelled cheque image">
            <Input value={docBankForm.cancelledChequeUrl ?? ""}
              onChange={(e) => setDocBankForm((p) => ({ ...p, cancelledChequeUrl: e.target.value }))}
              placeholder="https://ik.imagekit.io/…/cheque.jpg" />
          </FormField>
        </div>
        <div className="flex gap-3 mt-5">
          <Btn onClick={handleDocBank} loading={loading.updateDoctorBankDetails}>
            <Save size={14} />Save Bank Details
          </Btn>
          <Btn variant="outline" onClick={() => setShowDocBankModal(false)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}