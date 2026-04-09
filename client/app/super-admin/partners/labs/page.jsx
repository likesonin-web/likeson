'use client';

/**
 * DiagnosticCenterManagement.jsx
 *
 * Full CRUD management for Diagnostic Centers.
 * hospitalType is LOCKED to "Diagnostic Center" — never editable by user.
 *
 * Redux slice: store/slices/hospitalSlice.js
 *   fetchDiagnosticCenters · onboardHospital · updateHospital
 *   verifyHospital · deleteHospital
 *
 * Stack: Next.js · Redux Toolkit · Tailwind CSS · Framer Motion · Lucide
 */

import {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Microscope, Plus, Search, RefreshCw, X, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Pencil, Trash2, Eye, MapPin, Phone, Mail,
  Globe, FileText, Star, Users, Activity, Building2, AlertTriangle,
  ShieldCheck, ShieldOff, Percent, FlaskConical, Zap, BadgeCheck,
  MoreVertical, Filter, Download,
} from 'lucide-react';

import {
  fetchDiagnosticCenters,
  onboardHospital,
  updateHospital,
  verifyHospital,
  deleteHospital,
  selectHospitalItems,
  selectHospitalPagination,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — Diagnostic Center specific
// ─────────────────────────────────────────────────────────────────────────────

const HOSPITAL_TYPE = 'Diagnostic Center'; // LOCKED

const DC_SPECIALTIES = [
  'Blood Tests', 'Urine Analysis', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound',
  'ECG / EEG', 'Biopsy', 'Culture & Sensitivity', 'Pathology',
  'Biochemistry', 'Microbiology', 'Haematology', 'Immunology',
  'Genetic Testing', 'Thyroid Profile', 'Lipid Profile', 'Liver Function',
  'Kidney Function', 'Hormone Tests', 'COVID-19 Tests',
];

const DC_FACILITIES = [
  'Air Conditioned', 'Home Sample Collection', 'Online Reports',
  'WhatsApp Reports', 'Insurance Accepted', 'Wheelchair Accessible',
  'Parking', 'Waiting Lounge', 'NABL Accredited', 'ISO Certified',
  '24/7 Service', 'Walk-in Welcome', 'Senior Citizen Discount',
];

const ACCEPTED_SCHEMES = [
  'Aarogyasri', 'CGHS', 'ESI', 'PMJAY', 'YSR Arogyasri',
  'Ayushman Bharat', 'Insurance – Cashless', 'Insurance – Reimbursement',
];

const EMPTY_FORM = {
  name:                '',
  description:         '',
  logo:                '',
  'contact.email':     '',
  'contact.phone':     '',
  'contact.emergencyPhone': '',
  'contact.website':   '',
  'address.line1':     '',
  'address.line2':     '',
  'address.landmark':  '',
  'address.city':      'Vijayawada',
  'address.state':     'Andhra Pradesh',
  'address.pincode':   '',
  specialties:         [],
  facilities:          [],
  'bedCount.total':    0,
  'registrationDetails.licenseNumber': '',
  'registrationDetails.gstNumber':     '',
  acceptedSchemes:     [],
  commissionRate:      15,
  isEmergencyReady:    false,
  adminEmail:          '',       // used for onboard only
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

/** Flatten nested Mongoose doc to dotted keys for the form */
function flattenDoc(doc) {
  if (!doc) return { ...EMPTY_FORM };
  return {
    name:                           doc.name                              ?? '',
    description:                    doc.description                       ?? '',
    logo:                           doc.logo                              ?? '',
    'contact.email':                doc.contact?.email                    ?? '',
    'contact.phone':                doc.contact?.phone                    ?? '',
    'contact.emergencyPhone':       doc.contact?.emergencyPhone           ?? '',
    'contact.website':              doc.contact?.website                  ?? '',
    'address.line1':                doc.address?.line1                    ?? '',
    'address.line2':                doc.address?.line2                    ?? '',
    'address.landmark':             doc.address?.landmark                 ?? '',
    'address.city':                 doc.address?.city                     ?? 'Vijayawada',
    'address.state':                doc.address?.state                    ?? 'Andhra Pradesh',
    'address.pincode':              doc.address?.pincode                  ?? '',
    specialties:                    doc.specialties                       ?? [],
    facilities:                     doc.facilities                        ?? [],
    'bedCount.total':               doc.bedCount?.total                   ?? 0,
    'registrationDetails.licenseNumber': doc.registrationDetails?.licenseNumber ?? '',
    'registrationDetails.gstNumber':     doc.registrationDetails?.gstNumber     ?? '',
    acceptedSchemes:                doc.acceptedSchemes                   ?? [],
    commissionRate:                 doc.commissionRate                    ?? 15,
    isEmergencyReady:               doc.isEmergencyReady                  ?? false,
    adminEmail:                     '',
  };
}

/** Rebuild nested payload from flat form state */
function buildPayload(form) {
  return {
    name:             form.name,
    description:      form.description,
    logo:             form.logo,
    hospitalType:     HOSPITAL_TYPE,           // always locked
    contact: {
      email:          form['contact.email'],
      phone:          form['contact.phone'],
      emergencyPhone: form['contact.emergencyPhone'],
      website:        form['contact.website'],
    },
    address: {
      line1:    form['address.line1'],
      line2:    form['address.line2'],
      landmark: form['address.landmark'],
      city:     form['address.city'],
      state:    form['address.state'],
      pincode:  form['address.pincode'],
    },
    specialties:  form.specialties,
    facilities:   form.facilities,
    bedCount:     { total: Number(form['bedCount.total']) },
    registrationDetails: {
      licenseNumber: form['registrationDetails.licenseNumber'],
      gstNumber:     form['registrationDetails.gstNumber'],
    },
    acceptedSchemes: form.acceptedSchemes,
    commissionRate:  Number(form.commissionRate),
    isEmergencyReady: form.isEmergencyReady,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useDiagnosticCenters() {
  const dispatch    = useDispatch();
  const items       = useSelector(selectHospitalItems);
  const pagination  = useSelector(selectHospitalPagination);
  const loading     = useSelector(selectHospitalLoading);
  const error       = useSelector((s) => s.hospital.error);

  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [modal,  setModal]  = useState({ type: null, data: null });

  const searchTimer = useRef(null);

  const fetch = useCallback(
    (overrides = {}) => {
      dispatch(fetchDiagnosticCenters({ page, limit: 12, search, ...overrides }));
    },
    [dispatch, page, search]
  );

  useEffect(() => { fetch(); }, [page]);  // eslint-disable-line

  const handleSearch = useCallback((val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
      dispatch(fetchDiagnosticCenters({ page: 1, limit: 12, search: val }));
    }, 380);
  }, [dispatch]);

  const openModal  = useCallback((type, data = null) => setModal({ type, data }), []);
  const closeModal = useCallback(() => setModal({ type: null, data: null }), []);

  const handleOnboard = useCallback(async (form) => {
    const res = await dispatch(onboardHospital({ ...buildPayload(form), adminEmail: form.adminEmail, hospitalType: HOSPITAL_TYPE }));
    if (!res.error) { closeModal(); fetch(); }
  }, [dispatch, closeModal, fetch]);

  const handleUpdate = useCallback(async (id, form) => {
    const res = await dispatch(updateHospital({ id, hospitalData: buildPayload(form) }));
    if (!res.error) { closeModal(); fetch(); }
  }, [dispatch, closeModal, fetch]);

  const handleVerify = useCallback(async (id, isVerified, commissionRate) => {
    const res = await dispatch(verifyHospital({ id, isVerified, commissionRate }));
    if (!res.error) { closeModal(); fetch(); }
  }, [dispatch, closeModal, fetch]);

  const handleDelete = useCallback(async (id) => {
    const res = await dispatch(deleteHospital(id));
    if (!res.error) { closeModal(); fetch(); }
  }, [dispatch, closeModal, fetch]);

  return {
    items, pagination, loading, error, page, setPage,
    modal, openModal, closeModal,
    handleSearch, handleOnboard, handleUpdate, handleVerify, handleDelete,
    refetch: fetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE: FormField
// ─────────────────────────────────────────────────────────────────────────────

const FormField = memo(function FormField({ label, id, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE: MultiSelect pill picker
// ─────────────────────────────────────────────────────────────────────────────

const PillPicker = memo(function PillPicker({ label, options, selected, onChange }) {
  const toggle = useCallback((val) => {
    onChange(selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val]
    );
  }, [selected, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                ${active
                  ? 'bg-secondary/15 border-secondary text-secondary'
                  : 'border-base-300 text-base-content/50 hover:border-secondary/50 hover:text-secondary'
                }`}
            >
              {active && <span className="mr-1">✓</span>}{opt}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM — shared for Onboard + Edit
// ─────────────────────────────────────────────────────────────────────────────

function DiagnosticForm({ initial, isNew, onSubmit, onCancel, loading }) {
  const [form, setForm]       = useState(initial);
  const [section, setSection] = useState(0);

  const set = useCallback((key, val) => setForm((p) => ({ ...p, [key]: val })), []);
  const inp = useCallback((key) => ({
    id: key, value: form[key] ?? '',
    onChange: (e) => set(key, e.target.value),
    className: 'input-field w-full text-sm h-10',
  }), [form, set]);

  const SECTIONS = ['Basic Info', 'Contact', 'Address', 'Services', 'Registration'];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Section tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1 flex-shrink-0">
        {SECTIONS.map((s, i) => (
          <button
            key={s} type="button" onClick={() => setSection(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all
              ${section === i
                ? 'bg-secondary text-secondary-content shadow-sm'
                : 'text-base-content/50 hover:bg-base-200'
              }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{   opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {/* ── SECTION 0: Basic ── */}
            {section === 0 && <>
              <div className="sm:col-span-2">
                {/* Type locked badge */}
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-secondary/8 border border-secondary/20">
                  <FlaskConical className="w-4 h-4 text-secondary flex-shrink-0" />
                  <span className="text-xs text-secondary font-bold">
                    Facility Type: <span className="uppercase tracking-widest">Diagnostic Center</span>
                  </span>
                  <span className="ml-auto text-[10px] text-secondary/60 border border-secondary/30 rounded px-1.5 py-0.5">LOCKED</span>
                </div>
              </div>
              {isNew && (
                <div className="sm:col-span-2">
                  <FormField label="Admin Email" id="adminEmail" required>
                    <input type="email" {...inp('adminEmail')} placeholder="admin@diagnostics.com" />
                  </FormField>
                </div>
              )}
              <div className="sm:col-span-2">
                <FormField label="Center Name" id="name" required>
                  <input type="text" {...inp('name')} placeholder="Vijayawada Diagnostics Pvt. Ltd." />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Description" id="description">
                  <textarea
                    id="description" value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={3} placeholder="About this diagnostic center…"
                    className="input-field w-full text-sm resize-none pt-2.5"
                  />
                </FormField>
              </div>
              <FormField label="Logo URL" id="logo">
                <input type="url" {...inp('logo')} placeholder="https://…" />
              </FormField>
              <FormField label="Commission Rate (%)" id="commissionRate">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={50} step={0.5}
                    value={form.commissionRate}
                    onChange={(e) => set('commissionRate', e.target.value)}
                    className="flex-1 accent-secondary h-1.5 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-secondary w-12 text-right tabular-nums">
                    {form.commissionRate}%
                  </span>
                </div>
              </FormField>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set('isEmergencyReady', !form.isEmergencyReady)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.isEmergencyReady ? 'bg-error' : 'bg-base-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.isEmergencyReady ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-xs text-base-content/60 font-semibold">24/7 Emergency Ready</span>
              </div>
            </>}

            {/* ── SECTION 1: Contact ── */}
            {section === 1 && <>
              <FormField label="Email" id="contact.email" required>
                <input type="email" {...inp('contact.email')} placeholder="info@center.com" />
              </FormField>
              <FormField label="Phone" id="contact.phone" required>
                <input type="tel" {...inp('contact.phone')} placeholder="+91 XXXXX XXXXX" />
              </FormField>
              <FormField label="Emergency Phone" id="contact.emergencyPhone">
                <input type="tel" {...inp('contact.emergencyPhone')} placeholder="+91 XXXXX XXXXX" />
              </FormField>
              <FormField label="Website" id="contact.website">
                <input type="url" {...inp('contact.website')} placeholder="https://center.com" />
              </FormField>
            </>}

            {/* ── SECTION 2: Address ── */}
            {section === 2 && <>
              <div className="sm:col-span-2">
                <FormField label="Address Line 1" id="address.line1" required>
                  <input type="text" {...inp('address.line1')} placeholder="Street, Building No." />
                </FormField>
              </div>
              <FormField label="Address Line 2" id="address.line2">
                <input type="text" {...inp('address.line2')} placeholder="Colony / Area" />
              </FormField>
              <FormField label="Landmark" id="address.landmark">
                <input type="text" {...inp('address.landmark')} placeholder="Near ..." />
              </FormField>
              <FormField label="City" id="address.city">
                <input type="text" {...inp('address.city')} />
              </FormField>
              <FormField label="State" id="address.state">
                <input type="text" {...inp('address.state')} />
              </FormField>
              <FormField label="Pincode" id="address.pincode" required>
                <input type="text" {...inp('address.pincode')} placeholder="520001" maxLength={6} />
              </FormField>
            </>}

            {/* ── SECTION 3: Services ── */}
            {section === 3 && <>
              <div className="sm:col-span-2">
                <PillPicker
                  label="Test / Specialties Offered"
                  options={DC_SPECIALTIES}
                  selected={form.specialties}
                  onChange={(v) => set('specialties', v)}
                />
              </div>
              <div className="sm:col-span-2">
                <PillPicker
                  label="Facilities & Amenities"
                  options={DC_FACILITIES}
                  selected={form.facilities}
                  onChange={(v) => set('facilities', v)}
                />
              </div>
              <div className="sm:col-span-2">
                <PillPicker
                  label="Accepted Schemes"
                  options={ACCEPTED_SCHEMES}
                  selected={form.acceptedSchemes}
                  onChange={(v) => set('acceptedSchemes', v)}
                />
              </div>
            </>}

            {/* ── SECTION 4: Registration ── */}
            {section === 4 && <>
              <FormField label="License Number" id="reg.license" required>
                <input type="text" {...inp('registrationDetails.licenseNumber')} placeholder="PCPNDT-XXXX" />
              </FormField>
              <FormField label="GST Number" id="reg.gst">
                <input type="text" {...inp('registrationDetails.gstNumber')} placeholder="22AAAAA0000A1Z5" />
              </FormField>
              <FormField label="Sample/Report Count (capacity)" id="bedCount.total">
                <input type="number" {...inp('bedCount.total')} min={0} placeholder="0" className="input-field w-full text-sm h-10" />
              </FormField>
            </>}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <div className="flex gap-2 pt-4 mt-4 border-t border-base-300/40 flex-shrink-0">
        {section > 0 && (
          <button type="button" onClick={() => setSection(s => s - 1)}
            className="flex items-center gap-1.5 px-4 h-10 rounded-xl border-2 border-base-300 text-base-content/60 text-sm font-bold hover:bg-base-200 transition-all">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <button type="button" onClick={onCancel}
          className="px-4 h-10 rounded-xl border-2 border-base-300 text-base-content/60 text-sm font-bold hover:bg-base-200 transition-all ml-auto">
          Cancel
        </button>
        {section < SECTIONS.length - 1 ? (
          <button type="button" onClick={() => setSection(s => s + 1)}
            className="flex items-center gap-1.5 px-5 h-10 rounded-xl bg-secondary text-secondary-content text-sm font-bold hover:brightness-110 transition-all">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-6 h-10 rounded-xl bg-secondary text-secondary-content text-sm font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {loading ? <span className="spinner !w-4 !h-4 border-secondary-content/40 border-t-secondary-content" /> : <CheckCircle2 className="w-4 h-4" />}
            {isNew ? 'Onboard Center' : 'Save Changes'}
          </button>
        )}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL SHELL
// ─────────────────────────────────────────────────────────────────────────────

function ModalShell({ title, icon: Icon, onClose, children, wide = false }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div key="modal"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.94, y: 16  }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`pointer-events-auto bg-base-100 rounded-2xl border border-base-300/50 shadow-2xl flex flex-col ${wide ? 'w-full max-w-2xl max-h-[90vh]' : 'w-full max-w-md'}`}>
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-base-300/40 flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/20">
              <Icon className="w-5 h-5 text-secondary" />
            </div>
            <h2 className="text-lg font-black text-base-content" style={{ fontFamily: 'var(--font-family-montserrat,sans-serif)' }}>
              {title}
            </h2>
            <button onClick={onClose} aria-label="Close"
              className="ml-auto p-1.5 rounded-lg text-base-content/35 hover:text-base-content hover:bg-base-200 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-5 flex-1 overflow-hidden flex flex-col">
            {children}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: View Detail
// ─────────────────────────────────────────────────────────────────────────────

function ViewModal({ center, onClose }) {
  return (
    <ModalShell title={center.name} icon={FlaskConical} onClose={onClose} wide>
      <div className="overflow-y-auto flex-1 space-y-5 pr-1">
        {/* Header banner */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/5 border border-secondary/15">
          {center.logo
            ? <img src={center.logo} alt={center.name} className="w-14 h-14 rounded-xl object-cover border border-secondary/20" />
            : <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center"><FlaskConical className="w-7 h-7 text-secondary" /></div>
          }
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`badge text-[10px] ${center.isVerified ? 'badge-success' : 'badge-warning'}`}>
                {center.isVerified ? '✓ Verified' : '⏳ Pending'}
              </span>
              {center.isEmergencyReady && <span className="badge badge-error text-[10px]">🚨 24/7</span>}
            </div>
            <p className="text-sm text-base-content/50">{center.address?.city}, {center.address?.state}</p>
            <p className="text-xs text-secondary font-bold mt-0.5">{stars(center.rating)} ({center.reviewCount} reviews)</p>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Mail,     label: 'Email',   val: center.contact?.email },
            { icon: Phone,    label: 'Phone',   val: center.contact?.phone },
            { icon: Globe,    label: 'Website', val: center.contact?.website },
            { icon: MapPin,   label: 'Address', val: `${center.address?.line1}, ${center.address?.city} – ${center.address?.pincode}` },
            { icon: Percent,  label: 'Commission', val: `${center.commissionRate ?? 15}%` },
            { icon: FileText, label: 'License', val: center.registrationDetails?.licenseNumber },
          ].map(({ icon: Ic, label, val }) => val ? (
            <div key={label} className="flex items-start gap-2.5 p-3 rounded-xl bg-base-200/50">
              <Ic className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-base-content/40 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-xs text-base-content truncate">{val}</p>
              </div>
            </div>
          ) : null)}
        </div>

        {/* Specialties */}
        {center.specialties?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-2">Tests Offered</p>
            <div className="flex flex-wrap gap-1.5">
              {center.specialties.map((s) => (
                <span key={s} className="badge badge-info text-[10px]">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Facilities */}
        {center.facilities?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-2">Facilities</p>
            <div className="flex flex-wrap gap-1.5">
              {center.facilities.map((f) => (
                <span key={f} className="badge badge-primary text-[10px]">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Schemes */}
        {center.acceptedSchemes?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-2">Accepted Schemes</p>
            <div className="flex flex-wrap gap-1.5">
              {center.acceptedSchemes.map((s) => (
                <span key={s} className="badge badge-success text-[10px]">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Verify
// ─────────────────────────────────────────────────────────────────────────────

function VerifyModal({ center, onConfirm, onClose, loading }) {
  const [isVerified, setIsVerified]       = useState(center.isVerified ?? false);
  const [commissionRate, setCommission]   = useState(center.commissionRate ?? 15);

  return (
    <ModalShell title="Verification Status" icon={ShieldCheck} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Center info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200/60">
          <FlaskConical className="w-8 h-8 text-secondary flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-base-content">{center.name}</p>
            <p className="text-xs text-base-content/40">{center.registrationDetails?.licenseNumber}</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-base-300/50 bg-base-200/30">
          <div>
            <p className="text-sm font-bold text-base-content">KYC Verification</p>
            <p className="text-xs text-base-content/45 mt-0.5">Approve facility to go live on platform</p>
          </div>
          <button type="button" onClick={() => setIsVerified(!isVerified)}
            className={`relative w-12 h-6 rounded-full transition-colors ${isVerified ? 'bg-success' : 'bg-base-300'}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isVerified ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {/* Commission */}
        <div>
          <label className="text-xs font-semibold text-base-content/55 uppercase tracking-wider block mb-2">
            Platform Commission Rate: <strong className="text-secondary">{commissionRate}%</strong>
          </label>
          <input
            type="range" min={0} max={50} step={0.5}
            value={commissionRate} onChange={(e) => setCommission(Number(e.target.value))}
            className="w-full accent-secondary h-1.5 cursor-pointer"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border-2 border-base-300 text-base-content/60 text-sm font-bold hover:bg-base-200 transition-all">
            Cancel
          </button>
          <button onClick={() => onConfirm(center._id, isVerified, commissionRate)} disabled={loading}
            className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed
              ${isVerified ? 'bg-success text-success-content hover:brightness-110' : 'bg-warning text-warning-content hover:brightness-110'}`}>
            {loading ? 'Saving…' : isVerified ? '✓ Approve & Verify' : '⏳ Set to Pending'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Delete Confirm
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({ center, onConfirm, onClose, loading }) {
  const [typed, setTyped] = useState('');
  const confirmed = typed === center.name;

  return (
    <ModalShell title="Delete Center" icon={Trash2} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-error/8 border border-error/20 text-xs text-error">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>This will permanently delete <strong>{center.name}</strong> and all associated records. This action cannot be undone.</span>
        </div>
        <div>
          <label className="block text-xs font-semibold text-base-content/55 mb-1.5 uppercase tracking-wider">
            Type the center name to confirm
          </label>
          <input
            type="text" value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder={center.name}
            className="input-field w-full text-sm h-10"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border-2 border-base-300 text-base-content/60 text-sm font-bold hover:bg-base-200 transition-all">
            Cancel
          </button>
          <button onClick={() => onConfirm(center._id)} disabled={!confirmed || loading}
            className="flex-1 h-10 rounded-xl bg-error text-error-content text-sm font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {loading ? 'Deleting…' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({ icon: Icon, label, value, accent, delay }) {
  const map = {
    secondary: 'bg-secondary/10 text-secondary',
    success:   'bg-success/10 text-success',
    warning:   'bg-warning/10 text-warning',
    error:     'bg-error/10 text-error',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
      className="glass-card p-5 flex items-center gap-4"
    >
      <div className={`p-3 rounded-xl ${map[accent] ?? map.secondary}`}>
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <div>
        <p className="text-xl font-black tabular-nums text-base-content" style={{ fontFamily: 'var(--font-family-montserrat,sans-serif)' }}>
          {value ?? '—'}
        </p>
        <p className="text-[11px] text-base-content/45 uppercase tracking-widest font-medium mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENTER CARD (grid)
// ─────────────────────────────────────────────────────────────────────────────

const CenterCard = memo(function CenterCard({ center, onView, onEdit, onVerify, onDelete, index }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="glass-card p-5 flex flex-col gap-4 group relative"
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        {center.logo
          ? <img src={center.logo} alt={center.name} className="w-12 h-12 rounded-xl object-cover border border-secondary/20 flex-shrink-0" />
          : <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0 border border-secondary/20">
              <FlaskConical className="w-6 h-6 text-secondary" />
            </div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-base-content truncate leading-tight">{center.name}</p>
          <p className="text-xs text-base-content/40 truncate mt-0.5">
            <MapPin className="inline w-3 h-3 mr-0.5" />{center.address?.city}, {center.address?.pincode}
          </p>
        </div>

        {/* Context menu */}
        <div ref={menuRef} className="relative flex-shrink-0">
          <button onClick={() => setMenu(!menu)}
            className="p-1.5 rounded-lg text-base-content/35 hover:text-base-content hover:bg-base-200 transition-all">
            <MoreVertical className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{   opacity: 0, scale: 0.92, y: -4  }}
                className="absolute right-0 top-8 z-20 bg-base-100 border border-base-300/60 rounded-xl shadow-xl py-1 w-40"
              >
                {[
                  { label: 'View Details', icon: Eye,        fn: () => { onView(center);   setMenu(false); } },
                  { label: 'Edit',         icon: Pencil,     fn: () => { onEdit(center);   setMenu(false); } },
                  { label: 'Verify',       icon: ShieldCheck,fn: () => { onVerify(center); setMenu(false); } },
                  { label: 'Delete',       icon: Trash2,     fn: () => { onDelete(center); setMenu(false); }, danger: true },
                ].map(({ label, icon: Ic, fn, danger }) => (
                  <button key={label} onClick={fn}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors hover:bg-base-200
                      ${danger ? 'text-error hover:bg-error/10' : 'text-base-content/70'}`}>
                    <Ic className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border
          ${center.isVerified ? 'bg-success/10 text-success border-success/25' : 'bg-warning/10 text-warning border-warning/25'}`}>
          {center.isVerified ? <BadgeCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {center.isVerified ? 'Verified' : 'Pending'}
        </span>
        {center.isActive && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-secondary/10 text-secondary border-secondary/25">
            <Zap className="w-3 h-3" /> Active
          </span>
        )}
        {center.isEmergencyReady && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-error/10 text-error border-error/25">
            🚨 24/7
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-2 border-t border-base-300/30 text-xs text-base-content/45">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-warning" />
          {center.rating?.toFixed(1) ?? '0.0'}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {center.reviewCount ?? 0} reviews
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Percent className="w-3 h-3 text-secondary" />
          {center.commissionRate ?? 15}%
        </span>
      </div>

      {/* Specialties preview */}
      {center.specialties?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {center.specialties.slice(0, 3).map((s) => (
            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/8 text-secondary">{s}</span>
          ))}
          {center.specialties.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] text-base-content/40">+{center.specialties.length - 3} more</span>
          )}
        </div>
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON CARD
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 skeleton rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-12 rounded-full" />
      </div>
      <div className="flex gap-4 pt-2 border-t border-base-300/30">
        <div className="skeleton h-3 w-12 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-3 w-10 rounded ml-auto" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

const Pagination = memo(function Pagination({ page, pages, total, limit, onPage }) {
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-base-300/40">
      <p className="text-xs text-base-content/40">
        Showing <strong className="text-base-content">{from}–{to}</strong> of <strong className="text-base-content">{total}</strong>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-2 rounded-lg border border-base-300 text-base-content/50 hover:bg-base-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onPage(n)}
            className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-semibold transition-all
              ${n === page ? 'bg-secondary text-secondary-content shadow-sm' : 'border border-base-300 text-base-content/55 hover:bg-base-200'}`}>
            {n}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === pages}
          className="p-2 rounded-lg border border-base-300 text-base-content/50 hover:bg-base-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function DiagnosticCenterManagement() {
  const {
    items, pagination, loading, error, page, setPage,
    modal, openModal, closeModal,
    handleSearch, handleOnboard, handleUpdate, handleVerify, handleDelete,
    refetch,
  } = useDiagnosticCenters();

  const searchRef = useRef(null);

  // Derived stats from current page data
  const verified   = useMemo(() => items.filter((c) => c.isVerified).length,       [items]);
  const active     = useMemo(() => items.filter((c) => c.isActive).length,          [items]);
  const emergency  = useMemo(() => items.filter((c) => c.isEmergencyReady).length,  [items]);

  return (
    <div className="min-h-screen bg-base-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-screen-xl mx-auto">

        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 mb-7"
        >
          <div className="flex items-center gap-3.5">
            {/* Distinctive icon cluster */}
            <div className="relative">
              <div className="p-3 rounded-2xl bg-secondary/10 border border-secondary/25">
                <Microscope className="w-7 h-7 text-secondary" strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                <FlaskConical className="w-3 h-3 text-secondary-content" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-base-content leading-tight"
                style={{ fontFamily: 'var(--font-family-montserrat,sans-serif)' }}>
                Diagnostic Centers
              </h1>
              <p className="text-sm text-base-content/40 mt-0.5">
                Manage, verify & onboard pathology and imaging facilities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button onClick={refetch} disabled={loading} aria-label="Refresh"
              className="p-2.5 rounded-xl border border-base-300 text-base-content/50 hover:text-base-content hover:bg-base-200 transition-all disabled:opacity-40">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => openModal('onboard')}
              className="flex items-center gap-2 px-5 h-10 rounded-xl bg-secondary text-secondary-content text-sm font-bold hover:brightness-110 transition-all shadow-sm">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Onboard Center
            </button>
          </div>
        </motion.div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Building2}  label="Total Listed"   value={pagination.total} accent="secondary" delay={0.06} />
          <StatCard icon={BadgeCheck} label="Verified"       value={verified}          accent="success"   delay={0.1}  />
          <StatCard icon={Activity}   label="Active"         value={active}            accent="warning"   delay={0.14} />
          <StatCard icon={Zap}        label="24/7 Emergency" value={emergency}         accent="error"     delay={0.18} />
        </div>

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex gap-3 mb-5"
        >
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/35 pointer-events-none" />
            <input
              ref={searchRef} type="search"
              placeholder="Search by name, city, specialty…"
              onChange={(e) => handleSearch(e.target.value)}
              aria-label="Search diagnostic centers"
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-base-300 bg-base-200/60 text-sm text-base-content placeholder:text-base-content/35 outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all"
            />
          </div>
        </motion.div>

        {/* ── Error ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 p-3 mb-5 rounded-xl bg-error/8 border border-error/20 text-sm text-error"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </motion.div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div className="w-20 h-20 rounded-3xl bg-secondary/8 border border-secondary/15 flex items-center justify-center">
              <Microscope className="w-10 h-10 text-secondary/40" strokeWidth={1} />
            </div>
            <p className="text-base-content/35 text-sm">No diagnostic centers found</p>
            <button onClick={() => openModal('onboard')}
              className="flex items-center gap-2 px-5 h-9 rounded-xl bg-secondary/10 border border-secondary/20 text-secondary text-sm font-bold hover:bg-secondary/20 transition-all">
              <Plus className="w-4 h-4" /> Onboard First Center
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((center, i) => (
              <CenterCard
                key={center._id}
                center={center}
                index={i}
                onView={(c)   => openModal('view',   c)}
                onEdit={(c)   => openModal('edit',   c)}
                onVerify={(c) => openModal('verify', c)}
                onDelete={(c) => openModal('delete', c)}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          limit={12}
          onPage={setPage}
        />
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal.type === 'onboard' && (
          <ModalShell key="onboard" title="Onboard Diagnostic Center" icon={Plus} onClose={closeModal} wide>
            <DiagnosticForm
              initial={{ ...EMPTY_FORM }}
              isNew
              onSubmit={handleOnboard}
              onCancel={closeModal}
              loading={loading}
            />
          </ModalShell>
        )}
        {modal.type === 'edit' && modal.data && (
          <ModalShell key="edit" title="Edit Center" icon={Pencil} onClose={closeModal} wide>
            <DiagnosticForm
              initial={flattenDoc(modal.data)}
              isNew={false}
              onSubmit={(form) => handleUpdate(modal.data._id, form)}
              onCancel={closeModal}
              loading={loading}
            />
          </ModalShell>
        )}
        {modal.type === 'view' && modal.data && (
          <ViewModal key="view" center={modal.data} onClose={closeModal} />
        )}
        {modal.type === 'verify' && modal.data && (
          <VerifyModal key="verify" center={modal.data}
            onConfirm={handleVerify} onClose={closeModal} loading={loading} />
        )}
        {modal.type === 'delete' && modal.data && (
          <DeleteModal key="delete" center={modal.data}
            onConfirm={handleDelete} onClose={closeModal} loading={loading} />
        )}
      </AnimatePresence>
    </div>
  );
}