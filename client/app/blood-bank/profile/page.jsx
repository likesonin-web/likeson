'use client';

import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Phone, Mail, Globe, MapPin, Clock, ShieldCheck,
  FileText, CreditCard, Activity, Upload, Plus, Edit3, Check,
  X, ChevronRight, ChevronDown, AlertCircle, Star, Droplets,
  Award, Banknote, History, Eye, EyeOff, Camera, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Info, RefreshCw,
  PhoneCall, User, Hash, Landmark, Smartphone, Wifi, WifiOff,
  CalendarDays, Lock, Unlock, BadgeCheck, TrendingUp, Package,
  Layers, Truck, Siren, FlaskConical, Stethoscope,
} from 'lucide-react';

import {
  fetchMyBank,
  updateMyBank,
  uploadLogo,
  updateLicense,
  updateAccreditation,
  updateBankDetails,
  fetchStatusLog,
} from '@/store/slices/bloodbankSlice';

// ── tiny helpers ──────────────────────────────────────────────────────────────

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const StatusPill = ({ status }) => {
  const map = {
    active:       { cls: 'badge-success',  icon: CheckCircle2,  label: 'Active'       },
    pending:      { cls: 'badge-warning',  icon: AlertTriangle, label: 'Pending'      },
    under_review: { cls: 'badge-info',     icon: Info,          label: 'Under Review' },
    suspended:    { cls: 'badge-error',    icon: XCircle,       label: 'Suspended'    },
    revoked:      { cls: 'badge-error',    icon: X,             label: 'Revoked'      },
    deactivated:  { cls: 'badge-warning',  icon: AlertCircle,   label: 'Deactivated'  },
  };
  const { cls, icon: Icon, label } = map[status] || map.pending;
  return (
    <span className={`badge ${cls} gap-1.5`}>
      <Icon size={11} />
      {label}
    </span>
  );
};

const FieldNote = ({ children }) => (
  <p className="text-base-content/50 text-xs mt-0.5 font-normal">{children}</p>
);

const SectionCard = ({ title, icon: Icon, color = 'primary', children, action, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-lg bg-${color}/10 flex items-center justify-center text-${color} flex-shrink-0`}>
            <Icon size={16} />
          </span>
          <span className="font-montserrat font-bold text-base text-base-content">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <ChevronDown
            size={16}
            className={`text-base-content/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-base-300">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const InfoRow = ({ label, value, note, icon: Icon, mono = false }) => (
  <div className="flex flex-col gap-0.5 py-2.5 border-b border-base-300/60 last:border-0">
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-primary/60 flex-shrink-0" />}
      <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">{label}</span>
    </div>
    <span className={`text-sm font-medium text-base-content mt-0.5 ${mono ? 'font-mono' : ''}`}>
      {value || <span className="text-base-content/30 italic text-xs">Not provided</span>}
    </span>
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

const InputField = ({ label, note, ...props }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">{label}</label>
    <input className="input-field text-sm" {...props} />
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

const SelectField = ({ label, note, options = [], ...props }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">{label}</label>
    <select className="input-field text-sm" {...props}>
      <option value="">Select…</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

// ── toast helper (simple internal) ───────────────────────────────────────────
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  return { toasts, success: (m) => add(m, 'success'), error: (m) => add(m, 'error') };
};

const ToastStack = ({ toasts }) => (
  <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-depth text-sm font-semibold pointer-events-auto
            ${t.type === 'success' ? 'bg-success text-success-content' : 'bg-error text-error-content'}`}
        >
          {t.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {t.msg}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileAndDocs() {
  const dispatch = useDispatch();
  const { myBank, statusLog, loading } = useSelector(s => s.bloodBank);
  const toast = useToast();

  // active tab
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    dispatch(fetchMyBank());
    dispatch(fetchStatusLog());
  }, [dispatch]);

  if (loading && !myBank) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-md" />
          <p className="text-base-content/50 text-sm font-medium">Loading blood bank profile…</p>
        </div>
      </div>
    );
  }

  if (!myBank) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card p-10 text-center max-w-sm">
          <Droplets size={48} className="mx-auto text-primary/30 mb-4" />
          <h3 className="font-montserrat font-bold text-lg mb-2">No Profile Found</h3>
          <p className="text-base-content/50 text-sm">Create your blood bank profile to get started.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile',      label: 'Profile',      icon: Building2  },
    { id: 'licenses',     label: 'Licenses',     icon: FileText   },
    { id: 'accreditations', label: 'Accreditations', icon: Award  },
    { id: 'bank-details', label: 'Bank Details',  icon: Banknote   },
    { id: 'status-log',  label: 'Status Log',   icon: History    },
  ];

  return (
    <div data-theme="lab" className="min-h-screen bg-base-200">
      <ToastStack toasts={toast.toasts} />

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-base-100 border-b border-base-300">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/8 pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full bg-accent/5 blur-2xl" />

        <div className=" px-2 py-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Logo */}
            <LogoUpload bank={myBank} dispatch={dispatch} toast={toast} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-montserrat font-black text-2xl text-base-content leading-tight truncate">
                  {myBank.name}
                </h1>
                <StatusPill status={myBank.status} />
                {myBank.isVerified && (
                  <span className="badge badge-primary gap-1"><BadgeCheck size={11} />Verified</span>
                )}
                {myBank.isFeatured && (
                  <span className="badge badge-accent gap-1"><Star size={11} />Featured</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/50">
                <span className="flex items-center gap-1"><Hash size={11} />{myBank.bankCode || '—'}</span>
                <span className="flex items-center gap-1"><MapPin size={11} />{myBank.address?.city}, {myBank.address?.state}</span>
                <span className="flex items-center gap-1"><Layers size={11} capitalize />{myBank.bankType?.replace('_', ' ')}</span>
                {myBank.isEmergency24x7 && (
                  <span className="flex items-center gap-1 text-error"><Siren size={11} />24×7 Emergency</span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              {[
                { label: 'Rating', val: myBank.rating?.averageRating?.toFixed(1) || '—', icon: Star, color: 'accent' },
                { label: 'Collected', val: myBank.stats?.totalUnitsCollected ?? 0, icon: Droplets, color: 'primary' },
                { label: 'Issued', val: myBank.stats?.totalUnitsIssued ?? 0, icon: TrendingUp, color: 'success' },
              ].map(s => (
                <div key={s.label} className="stat-card min-w-[90px] text-center py-3 px-4">
                  <div className="stat-card-value text-lg">{s.val}</div>
                  <div className="stat-card-label text-[10px]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200
                  ${tab === t.id
                    ? 'bg-primary text-primary-content shadow-primary'
                    : 'text-base-content/60 hover:bg-primary/10 hover:text-primary'
                  }`}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className=" px-2 py-6 max-w-5xl">
        <AnimatePresence mode="wait">
          {tab === 'profile'        && <ProfileTab      key="profile"  bank={myBank} dispatch={dispatch} toast={toast} />}
          {tab === 'licenses'       && <LicensesTab     key="lic"      bank={myBank} dispatch={dispatch} toast={toast} />}
          {tab === 'accreditations' && <AccreditationsTab key="acc"    bank={myBank} dispatch={dispatch} toast={toast} />}
          {tab === 'bank-details'   && <BankDetailsTab  key="bank"     bank={myBank} dispatch={dispatch} toast={toast} />}
          {tab === 'status-log'     && <StatusLogTab    key="log"      statusLog={statusLog} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGO UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

function LogoUpload({ bank, dispatch, toast }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef();

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('logo', file);
    const res = await dispatch(uploadLogo(fd));
    setUploading(false);
    if (res.error) toast.error('Upload failed');
    else toast.success('Logo updated!');
  };

  return (
    <div className="relative flex-shrink-0 group cursor-pointer" onClick={() => ref.current?.click()}>
      <div className="w-20 h-20 rounded-2xl border-2 border-base-300 overflow-hidden bg-base-200 flex items-center justify-center">
        {bank.logoUrl
          ? <img src={bank.logoUrl} alt="logo" className="w-full h-full object-cover" />
          : <Droplets size={32} className="text-primary/40" />
        }
        <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={20} className="text-white" />}
        </div>
      </div>
      <input type="file" ref={ref} className="hidden" accept="image/*" onChange={handle} />
      <span className='text-[8px]'>Click to change logo</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────

function ProfileTab({ bank, dispatch, toast }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const startEdit = () => {
    setForm({
      name:          bank.name || '',
      description:   bank.description || '',
      'contact.phone':         bank.contact?.phone || '',
      'contact.email':         bank.contact?.email || '',
      'contact.emergencyPhone':bank.contact?.emergencyPhone || '',
      'contact.website':       bank.contact?.website || '',
      'address.line1':         bank.address?.line1 || '',
      'address.line2':         bank.address?.line2 || '',
      'address.landmark':      bank.address?.landmark || '',
      'address.city':          bank.address?.city || '',
      'address.state':         bank.address?.state || '',
      'address.pincode':       bank.address?.pincode || '',
      googleMapsUrl:           bank.googleMapsUrl || '',
      isEmergency24x7:         bank.isEmergency24x7,
      offersDelivery:          bank.offersDelivery,
      offersCrossMatch:        bank.offersCrossMatch,
      offersComponentSeparation: bank.offersComponentSeparation,
      acceptsDonations:        bank.acceptsDonations,
      deliveryRadiusKm:        bank.deliveryRadiusKm || 0,
    });
    setEditing(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    // flatten dotted keys into nested
    const payload = {
      name:        form.name,
      description: form.description,
      googleMapsUrl: form.googleMapsUrl,
      isEmergency24x7: form.isEmergency24x7,
      offersDelivery: form.offersDelivery,
      offersCrossMatch: form.offersCrossMatch,
      offersComponentSeparation: form.offersComponentSeparation,
      acceptsDonations: form.acceptsDonations,
      deliveryRadiusKm: form.deliveryRadiusKm,
      contact: {
        phone:          form['contact.phone'],
        email:          form['contact.email'],
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
    };
    const res = await dispatch(updateMyBank(payload));
    setSaving(false);
    if (res.error) toast.error('Save failed');
    else { toast.success('Profile saved!'); setEditing(false); }
  };

  const BLOOD_COMPONENTS = ['Whole Blood','PRBC','FFP','Platelets','Cryoprecipitate','Plasma','Single Donor Platelets','Leukoreduced PRBC','Irradiated PRBC','Washed PRBC'];
  const BLOOD_GROUPS     = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  return (
    <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">

      {/* ── Basic Info ── */}
      <SectionCard title="Basic Information" icon={Building2} action={
        !editing
          ? <button onClick={startEdit} className="btn btn-outline btn-sm gap-1.5"><Edit3 size={13}/>Edit</button>
          : <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm"><X size={14}/></button>
              <button onClick={save} disabled={saving} className="btn btn-primary btn-sm gap-1.5">
                {saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}Save
              </button>
            </div>
      }>
        {!editing ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Blood Bank Name"    value={bank.name}        note="Official registered name of the blood bank" icon={Building2} />
            <InfoRow label="Bank Code"          value={bank.bankCode}    note="Auto-generated unique identifier"           icon={Hash} mono />
            <InfoRow label="Slug / URL Handle"  value={bank.slug}        note="Used in public profile URL: /blood-banks/slug/:slug" icon={Globe} mono />
            <InfoRow label="Bank Type"          value={bank.bankType?.replace('_',' ')} note="Standalone, hospital-embedded, or mobile unit" icon={Layers} />
            <InfoRow label="Description" value={bank.description} note="Short description shown on public listing" icon={Info} />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Blood Bank Name" note="Official registered name" value={form.name} onChange={e=>set('name',e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Description</label>
              <textarea
                className="input-field text-sm resize-none"
                rows={3}
                value={form.description}
                onChange={e=>set('description',e.target.value)}
                placeholder="Short description for public listing…"
              />
              <FieldNote>Max 1000 characters. Shown on public search results.</FieldNote>
            </div>
            <InputField label="Google Maps URL" note="Paste full Google Maps link for directions" value={form.googleMapsUrl} onChange={e=>set('googleMapsUrl',e.target.value)} />
            <InputField label="Delivery Radius (km)" note="Max distance for blood delivery; 0 = no delivery" type="number" min={0} value={form.deliveryRadiusKm} onChange={e=>set('deliveryRadiusKm',+e.target.value)} />
          </div>
        )}
      </SectionCard>

      {/* ── Contact ── */}
      <SectionCard title="Contact Details" icon={Phone} color="secondary">
        {!editing ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Primary Phone"   value={bank.contact?.phone}          note="Main contact number for patients & staff"   icon={Phone} />
            <InfoRow label="Emergency Phone" value={bank.contact?.emergencyPhone} note="24×7 emergency hotline (if different)"       icon={PhoneCall} />
            <InfoRow label="Email"           value={bank.contact?.email}          note="Official contact email for inquiries"        icon={Mail} />
            <InfoRow label="Website"         value={bank.contact?.website}        note="Official website URL (include https://)"     icon={Globe} />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Primary Phone"   note="Indian mobile or landline"    value={form['contact.phone']}          onChange={e=>set('contact.phone',e.target.value)} />
            <InputField label="Emergency Phone" note="Visible on emergency listings" value={form['contact.emergencyPhone']}  onChange={e=>set('contact.emergencyPhone',e.target.value)} />
            <InputField label="Email"           note="Used for customer notifications" type="email" value={form['contact.email']} onChange={e=>set('contact.email',e.target.value)} />
            <InputField label="Website"         note="Optional — include https://"  value={form['contact.website']}        onChange={e=>set('contact.website',e.target.value)} />
          </div>
        )}
      </SectionCard>

      {/* ── Address ── */}
      <SectionCard title="Address & Location" icon={MapPin} color="accent">
        {!editing ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Address Line 1" value={bank.address?.line1}    note="Building / door number / street name" icon={MapPin} />
            <InfoRow label="Address Line 2" value={bank.address?.line2}    note="Colony / area (optional)" />
            <InfoRow label="Landmark"       value={bank.address?.landmark} note="Nearby landmark for navigation" />
            <InfoRow label="City"           value={bank.address?.city}     note="City where the bank is located" />
            <InfoRow label="State"          value={bank.address?.state}    note="State (default: Andhra Pradesh)" />
            <InfoRow label="PIN Code"       value={bank.address?.pincode}  note="6-digit postal code" icon={Hash} mono />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Address Line 1" note="Door no., building, street name" value={form['address.line1']}    onChange={e=>set('address.line1',e.target.value)} />
            <InputField label="Address Line 2" note="Colony or area (optional)"       value={form['address.line2']}    onChange={e=>set('address.line2',e.target.value)} />
            <InputField label="Landmark"       note="Helps patients find you faster"  value={form['address.landmark']} onChange={e=>set('address.landmark',e.target.value)} />
            <InputField label="City"           note="City name"                       value={form['address.city']}     onChange={e=>set('address.city',e.target.value)} />
            <InputField label="State"          note="State name"                      value={form['address.state']}    onChange={e=>set('address.state',e.target.value)} />
            <InputField label="PIN Code"       note="6-digit Indian postal code"      value={form['address.pincode']}  onChange={e=>set('address.pincode',e.target.value)} maxLength={6} />
          </div>
        )}
      </SectionCard>

      {/* ── Services ── */}
      <SectionCard title="Services & Capabilities" icon={FlaskConical} color="success">
        <div className="mt-3">
          {/* Blood Groups */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">Blood Groups Available</p>
            <FieldNote>Blood groups this bank currently stocks and can supply</FieldNote>
            <div className="flex flex-wrap gap-2 mt-2">
              {BLOOD_GROUPS.map(g => (
                <span key={g} className={`badge text-xs ${bank.bloodGroupsAvailable?.includes(g) ? 'badge-primary' : 'bg-base-300 text-base-content/40'}`}>
                  <Droplets size={10} className="mr-1" />{g}
                </span>
              ))}
            </div>
          </div>
          {/* Components */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">Blood Components Handled</p>
            <FieldNote>Components this bank can prepare and supply</FieldNote>
            <div className="flex flex-wrap gap-2 mt-2">
              {BLOOD_COMPONENTS.map(c => (
                <span key={c} className={`badge badge-sm text-xs ${bank.componentsHandled?.includes(c) ? 'badge-secondary' : 'bg-base-300 text-base-content/40'}`}>
                  {c}
                </span>
              ))}
            </div>
          </div>
          {/* Feature flags */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { key:'isEmergency24x7',         label:'24×7 Emergency',          note:'Available round the clock', icon:Siren },
              { key:'acceptsDonations',         label:'Accepts Donations',        note:'Walk-in donor registration', icon:Droplets },
              { key:'offersDelivery',           label:'Offers Delivery',          note:'Delivers blood to hospitals', icon:Truck },
              { key:'offersCrossMatch',         label:'Cross-Match',              note:'Pre-transfusion compatibility', icon:Stethoscope },
              { key:'offersComponentSeparation',label:'Component Separation',     note:'Apheresis / fractionation', icon:FlaskConical },
              { key:'offersEmergencySupply',    label:'Emergency Supply',         note:'Priority for emergencies', icon:Activity },
              { key:'hasApheresisFacility',     label:'Apheresis Facility',       note:'Platelet / plasma apheresis', icon:Package },
              { key:'hasMobileUnit',            label:'Mobile Unit',              note:'Has a mobile blood bank van', icon:Truck },
            ].map(f => (
              <div key={f.key} className={`flex items-start gap-2 p-3 rounded-lg border ${bank[f.key] ? 'bg-success/5 border-success/20' : 'bg-base-200 border-base-300'}`}>
                <f.icon size={14} className={bank[f.key] ? 'text-success mt-0.5' : 'text-base-content/30 mt-0.5'} />
                <div>
                  <p className={`text-xs font-semibold ${bank[f.key] ? 'text-success' : 'text-base-content/40'}`}>{f.label}</p>
                  <FieldNote>{f.note}</FieldNote>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Onboarding ── */}
      <SectionCard title="Onboarding Progress" icon={Activity} color="info" defaultOpen={false}>
        <div className="mt-4">
          <div className="progress-bar mb-2">
            <div className="progress-bar-fill" style={{ width: `${(bank.onboarding?.step || 1) * 20}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-content/50">Step {bank.onboarding?.step || 1} of 5</span>
            {bank.onboarding?.isComplete
              ? <span className="badge badge-success gap-1"><CheckCircle2 size={11}/>Complete</span>
              : <span className="badge badge-warning gap-1"><AlertTriangle size={11}/>Incomplete</span>
            }
          </div>
          <FieldNote>Complete all onboarding steps to activate your profile for public listings</FieldNote>
        </div>
      </SectionCard>

    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LICENSES TAB
// ─────────────────────────────────────────────────────────────────────────────

const LICENSE_TYPES = [
  { value:'Drugs_Cosmetics_Act',   label:'Drugs & Cosmetics Act' },
  { value:'State_Drug_Controller', label:'State Drug Controller' },
  { value:'NACO_Registration',     label:'NACO Registration'     },
  { value:'FSSAI',                 label:'FSSAI'                 },
  { value:'Other',                 label:'Other'                 },
];

function LicensesTab({ bank, dispatch, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState({});
  const [filePreview, setFilePreview] = useState(null);
  const fileRef = useRef();

  const blankForm = () => ({ licenseType:'', licenseNumber:'', issuedBy:'', issuedOn:'', validUntil:'' });

  const openAdd  = ()    => { setEditId(null); setForm(blankForm()); setFilePreview(null); setShowForm(true); };
  const openEdit = (lic) => {
    setEditId(lic._id);
    setForm({ licenseType: lic.licenseType, licenseNumber: lic.licenseNumber, issuedBy: lic.issuedBy || '', issuedOn: lic.issuedOn?.slice(0,10) || '', validUntil: lic.validUntil?.slice(0,10) || '' });
    setFilePreview(lic.documentUrl || null);
    setShowForm(true);
  };

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFilePreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!form.licenseType || !form.licenseNumber) return toast.error('License type and number required');
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k,v]) => v && fd.append(k,v));
    if (editId) fd.append('licenseId', editId);
    if (fileRef.current?.files?.[0]) fd.append('document', fileRef.current.files[0]);
    const res = await dispatch(updateLicense(fd));
    setSaving(false);
    if (res.error) toast.error('Save failed');
    else { toast.success(editId ? 'License updated!' : 'License added!'); setShowForm(false); }
  };

  const licenses = bank.licenses || [];

  return (
    <motion.div key="lic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
      <SectionCard title={`Licenses (${licenses.length})`} icon={FileText} action={
        <button onClick={openAdd} className="btn btn-primary btn-sm gap-1.5"><Plus size={13}/>Add License</button>
      }>
        {licenses.length === 0 ? (
          <div className="mt-6 text-center py-10">
            <FileText size={40} className="mx-auto text-base-content/20 mb-3" />
            <p className="text-sm text-base-content/40">No licenses added yet.</p>
            <FieldNote>Add at least one license (e.g., Drugs & Cosmetics Act) to activate your profile</FieldNote>
            <button onClick={openAdd} className="btn btn-primary btn-sm mt-4 gap-1.5"><Plus size={13}/>Add First License</button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {licenses.map((lic, i) => <LicenseCard key={lic._id || i} lic={lic} onEdit={() => openEdit(lic)} />)}
          </div>
        )}
      </SectionCard>

      {/* compliance note */}
      <div className="alert alert-info">
        <Info size={16} className="text-info flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">License Requirements (India)</p>
          <p className="text-xs mt-0.5 text-base-content/60">Blood banks must hold a valid license under the Drugs &amp; Cosmetics Act 1940. NACO registration is mandatory for all blood banks operating in India. All licenses are reviewed by admin before activation.</p>
        </div>
      </div>

      {/* Add / Edit form modal */}
      <AnimatePresence>
        {showForm && (
          <LicenseForm
            form={form} set={set} editId={editId} saving={saving}
            fileRef={fileRef} filePreview={filePreview} handleFile={handleFile}
            onSave={save} onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function LicenseCard({ lic, onEdit }) {
  const expired = lic.validUntil && new Date(lic.validUntil) < new Date();
  const expiring = lic.validUntil && !expired && (new Date(lic.validUntil) - new Date()) < 30*24*3600*1000;
  return (
    <motion.div initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} className={`card p-4 border ${expired ? 'border-error/30 bg-error/5' : expiring ? 'border-warning/30 bg-warning/5' : 'border-base-300'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="badge badge-primary badge-sm">{lic.licenseType?.replace(/_/g,' ')}</span>
            {lic.isVerified
              ? <span className="badge badge-success badge-sm gap-1"><BadgeCheck size={10}/>Verified</span>
              : <span className="badge badge-warning badge-sm gap-1"><AlertTriangle size={10}/>Pending Verification</span>}
            {expired  && <span className="badge badge-error badge-sm gap-1"><XCircle size={10}/>Expired</span>}
            {expiring && <span className="badge badge-warning badge-sm gap-1"><AlertTriangle size={10}/>Expiring Soon</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs">
            <InfoRow label="License No."  value={lic.licenseNumber} note="Unique license identifier" mono />
            <InfoRow label="Issued By"    value={lic.issuedBy}      note="Issuing authority" />
            <InfoRow label="Issued On"    value={fmt(lic.issuedOn)} note="Date of issue" icon={CalendarDays} />
            <InfoRow label="Valid Until"  value={fmt(lic.validUntil)} note="Expiry date — renew before this" icon={CalendarDays} />
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={onEdit} className="btn btn-ghost btn-xs gap-1"><Edit3 size={12}/>Edit</button>
          {lic.documentUrl && (
            <a href={lic.documentUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs gap-1">
              <Eye size={12}/>View
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LicenseForm({ form, set, editId, saving, fileRef, filePreview, handleFile, onSave, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }}
        className="card w-full max-w-lg bg-base-100 p-6 shadow-depth-lg"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-montserrat font-bold text-lg">{editId ? 'Edit License' : 'Add License'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm"><X size={16}/></button>
        </div>
        <div className="flex flex-col gap-4">
          <SelectField label="License Type" note="Select the governing act or body" options={LICENSE_TYPES} value={form.licenseType} onChange={e=>set('licenseType',e.target.value)} />
          <InputField  label="License Number" note="Exact number as on the certificate" value={form.licenseNumber} onChange={e=>set('licenseNumber',e.target.value)} />
          <InputField  label="Issued By" note="Name of issuing authority" value={form.issuedBy} onChange={e=>set('issuedBy',e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Issued On"   note="Date of issue"   type="date" value={form.issuedOn}   onChange={e=>set('issuedOn',e.target.value)} />
            <InputField label="Valid Until" note="Expiry date"     type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} />
          </div>
          {/* File upload */}
          <div>
            <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Upload Document</label>
            <FieldNote>PDF or image of the license certificate (max 10 MB)</FieldNote>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-2 border-2 border-dashed border-base-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {filePreview
                ? <img src={filePreview} alt="preview" className="mx-auto max-h-24 object-contain rounded" />
                : <><Upload size={24} className="mx-auto text-base-content/30 mb-2" /><p className="text-xs text-base-content/40">Click to upload</p></>
              }
              <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFile} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={onSave} disabled={saving} className="btn btn-primary btn-sm gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
            {editId ? 'Update' : 'Add License'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCREDITATIONS TAB
// ─────────────────────────────────────────────────────────────────────────────

const ACCRED_BODIES = [
  { value:'NABH',                label:'NABH'                 },
  { value:'NABL',                label:'NABL'                 },
  { value:'NACO',                label:'NACO'                 },
  { value:'State_Drug_Controller',label:'State Drug Controller'},
  { value:'ISO',                 label:'ISO'                  },
  { value:'Other',               label:'Other'                },
];

function AccreditationsTab({ bank, dispatch, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState({});
  const [filePreview, setFilePreview] = useState(null);
  const fileRef = useRef();

  const blank = () => ({ body:'', certificateNo:'', issuedOn:'', validUntil:'' });
  const openAdd  = ()    => { setEditId(null); setForm(blank()); setFilePreview(null); setShowForm(true); };
  const openEdit = (acc) => {
    setEditId(acc._id);
    setForm({ body: acc.body, certificateNo: acc.certificateNo || '', issuedOn: acc.issuedOn?.slice(0,10) || '', validUntil: acc.validUntil?.slice(0,10) || '' });
    setFilePreview(acc.documentUrl || null);
    setShowForm(true);
  };
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const save = async () => {
    if (!form.body) return toast.error('Accreditation body required');
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k,v]) => v && fd.append(k,v));
    if (editId) fd.append('accreditationId', editId);
    if (fileRef.current?.files?.[0]) fd.append('document', fileRef.current.files[0]);
    const res = await dispatch(updateAccreditation(fd));
    setSaving(false);
    if (res.error) toast.error('Save failed');
    else { toast.success(editId ? 'Updated!' : 'Added!'); setShowForm(false); }
  };

  const accs = bank.accreditations || [];

  return (
    <motion.div key="acc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
      <SectionCard title={`Accreditations (${accs.length})`} icon={Award} action={
        <button onClick={openAdd} className="btn btn-primary btn-sm gap-1.5"><Plus size={13}/>Add</button>
      }>
        {accs.length === 0 ? (
          <div className="mt-6 text-center py-10">
            <Award size={40} className="mx-auto text-base-content/20 mb-3" />
            <p className="text-sm text-base-content/40">No accreditations added yet.</p>
            <FieldNote>Accreditations like NABH, NABL, NACO increase patient trust and listing priority</FieldNote>
            <button onClick={openAdd} className="btn btn-primary btn-sm mt-4 gap-1.5"><Plus size={13}/>Add Accreditation</button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {accs.map((acc, i) => (
              <motion.div key={acc._id || i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="badge badge-accent">{acc.body?.replace(/_/g,' ')}</span>
                      {acc.isVerified
                        ? <span className="badge badge-success badge-sm gap-1"><BadgeCheck size={10}/>Verified</span>
                        : <span className="badge badge-warning badge-sm gap-1"><AlertTriangle size={10}/>Pending</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                      <InfoRow label="Certificate No." value={acc.certificateNo} note="Unique certificate number" mono />
                      <InfoRow label="Issued On"       value={fmt(acc.issuedOn)} note="Issue date" icon={CalendarDays} />
                      <InfoRow label="Valid Until"     value={fmt(acc.validUntil)} note="Expiry date" icon={CalendarDays} />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(acc)} className="btn btn-ghost btn-xs gap-1"><Edit3 size={12}/>Edit</button>
                    {acc.documentUrl && <a href={acc.documentUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs gap-1"><Eye size={12}/>View</a>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }}
              className="card w-full max-w-lg bg-base-100 p-6 shadow-depth-lg"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-montserrat font-bold text-lg">{editId ? 'Edit Accreditation' : 'Add Accreditation'}</h3>
                <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-circle btn-sm"><X size={16}/></button>
              </div>
              <div className="flex flex-col gap-4">
                <SelectField label="Accreditation Body" note="The organisation that issued this accreditation" options={ACCRED_BODIES} value={form.body} onChange={e=>set('body',e.target.value)} />
                <InputField  label="Certificate Number" note="Exact certificate number from the document" value={form.certificateNo} onChange={e=>set('certificateNo',e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Issued On"   note="Date of issue"  type="date" value={form.issuedOn}   onChange={e=>set('issuedOn',e.target.value)} />
                  <InputField label="Valid Until" note="Expiry date"    type="date" value={form.validUntil} onChange={e=>set('validUntil',e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Upload Document</label>
                  <FieldNote>PDF or image of the accreditation certificate (max 10 MB)</FieldNote>
                  <div onClick={() => fileRef.current?.click()} className="mt-2 border-2 border-dashed border-base-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    {filePreview
                      ? <img src={filePreview} alt="preview" className="mx-auto max-h-24 object-contain rounded" />
                      : <><Upload size={24} className="mx-auto text-base-content/30 mb-2" /><p className="text-xs text-base-content/40">Click to upload</p></>
                    }
                    <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={e => { const f=e.target.files?.[0]; if(f) setFilePreview(URL.createObjectURL(f)); }} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button onClick={save} disabled={saving} className="btn btn-primary btn-sm gap-1.5">
                  {saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
                  {editId ? 'Update' : 'Add'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BANK DETAILS TAB
// ─────────────────────────────────────────────────────────────────────────────

function BankDetailsTab({ bank, dispatch, toast }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [showAcc, setShowAcc] = useState(false);
  const [form, setForm]       = useState({});

  const startEdit = () => {
    setForm({
      accountHolderName: bank.bankDetails?.accountHolderName || '',
      accountNumber:     '',
      ifscCode:          bank.bankDetails?.ifscCode          || '',
      bankName:          bank.bankDetails?.bankName          || '',
      upiId:             bank.bankDetails?.upiId             || '',
    });
    setEditing(true);
  };

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    const res = await dispatch(updateBankDetails(form));
    setSaving(false);
    if (res.error) toast.error('Save failed');
    else { toast.success('Bank details saved! Pending admin verification.'); setEditing(false); }
  };

  const bd = bank.bankDetails || {};

  return (
    <motion.div key="bank" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
      <SectionCard title="Settlement Bank Account" icon={Banknote} action={
        !editing
          ? <button onClick={startEdit} className="btn btn-outline btn-sm gap-1.5"><Edit3 size={13}/>Edit</button>
          : <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm"><X size={14}/></button>
              <button onClick={save} disabled={saving} className="btn btn-primary btn-sm gap-1.5">
                {saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}Save
              </button>
            </div>
      }>
        {/* Verification status banner */}
        <div className={`mt-4 flex items-center gap-3 p-3 rounded-lg ${bd.isVerified ? 'bg-success/10 border border-success/30' : 'bg-warning/10 border border-warning/30'}`}>
          {bd.isVerified
            ? <><CheckCircle2 size={16} className="text-success flex-shrink-0"/><div><p className="text-xs font-semibold text-success">Bank Account Verified</p><FieldNote>Account verified by admin. Settlements are active.</FieldNote></div></>
            : <><AlertTriangle size={16} className="text-warning flex-shrink-0"/><div><p className="text-xs font-semibold text-warning">Pending Admin Verification</p><FieldNote>Account details submitted. Admin will verify before settlements begin.</FieldNote></div></>
          }
        </div>

        {!editing ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Account Holder Name" value={bd.accountHolderName} note="Name as registered with the bank" icon={User} />
            <InfoRow label="Account Number" value={bd.accountLast4 ? `••••••••${bd.accountLast4}` : '—'} note="Last 4 digits shown for security" icon={CreditCard} />
            <InfoRow label="IFSC Code" value={bd.ifscCode} note="11-character bank branch code" icon={Hash} mono />
            <InfoRow label="Bank Name" value={bd.bankName} note="Full name of your bank" icon={Landmark} />
            <InfoRow label="UPI ID" value={bd.upiId} note="UPI ID for direct settlements (optional)" icon={Smartphone} />
            <InfoRow label="Verified At" value={fmt(bd.verifiedAt)} note="Date when admin verified this account" icon={CalendarDays} />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="alert alert-warning">
              <AlertTriangle size={15} className="text-warning flex-shrink-0" />
              <p className="text-xs">Changing bank details will reset verification status. Admin must re-verify before settlements resume.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Account Holder Name" note="Exactly as printed on bank passbook" value={form.accountHolderName} onChange={e=>set('accountHolderName',e.target.value)} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Account Number</label>
                <div className="relative">
                  <input
                    type={showAcc ? 'text' : 'password'}
                    className="input-field text-sm pr-10"
                    value={form.accountNumber}
                    onChange={e=>set('accountNumber',e.target.value)}
                    placeholder="Enter full account number"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAcc(!showAcc)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-primary"
                  >
                    {showAcc ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
                <FieldNote>Only last 4 digits stored visible; full number encrypted</FieldNote>
              </div>
              <InputField label="IFSC Code" note="Format: ABCD0123456 — find on cheque leaf" value={form.ifscCode} onChange={e=>set('ifscCode',e.target.value.toUpperCase())} maxLength={11} />
              <InputField label="Bank Name" note="e.g. State Bank of India, HDFC Bank" value={form.bankName} onChange={e=>set('bankName',e.target.value)} />
              <InputField label="UPI ID" note="Optional — e.g. name@upi for instant settlements" value={form.upiId} onChange={e=>set('upiId',e.target.value)} />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Settlement Cycle Info */}
      <SectionCard title="Settlement Configuration" icon={RefreshCw} defaultOpen={false}>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Settlement Cycle" value={bank.settlementCycle || 'monthly'} note="Frequency of payouts to your bank account" icon={CalendarDays} />
          <InfoRow label="Platform Fee %"   value={`${bank.platformFeePercent ?? 0}%`} note="Platform commission on each transaction" icon={TrendingUp} />
        </div>
        <FieldNote>Settlement cycle and platform fee are set by admin. Contact support to change.</FieldNote>
      </SectionCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS LOG TAB
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  active:       { bg: 'bg-success/10',  border: 'border-success/30', text: 'text-success',  icon: CheckCircle2  },
  pending:      { bg: 'bg-warning/10',  border: 'border-warning/30', text: 'text-warning',  icon: AlertTriangle },
  under_review: { bg: 'bg-info/10',     border: 'border-info/30',    text: 'text-info',     icon: Info          },
  suspended:    { bg: 'bg-error/10',    border: 'border-error/30',   text: 'text-error',    icon: XCircle       },
  revoked:      { bg: 'bg-error/10',    border: 'border-error/30',   text: 'text-error',    icon: Lock          },
  deactivated:  { bg: 'bg-warning/10',  border: 'border-warning/30', text: 'text-warning',  icon: WifiOff       },
};

function StatusLogTab({ statusLog }) {
  const entries = [...(statusLog || [])].reverse();

  return (
    <motion.div key="log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
      <SectionCard title={`Status History (${entries.length} events)`} icon={History}>
        {entries.length === 0 ? (
          <div className="mt-6 text-center py-10">
            <History size={40} className="mx-auto text-base-content/20 mb-3" />
            <p className="text-sm text-base-content/40">No status changes recorded yet.</p>
            <FieldNote>Status changes appear here when admin reviews or updates your blood bank account</FieldNote>
          </div>
        ) : (
          <div className="mt-4 relative">
            {/* timeline line */}
            <div className="absolute left-[1.35rem] top-0 bottom-0 w-px bg-base-300" />

            <div className="flex flex-col gap-0">
              {entries.map((entry, i) => {
                const toConf   = STATUS_COLORS[entry.toStatus]   || STATUS_COLORS.pending;
                const fromConf = STATUS_COLORS[entry.fromStatus] || STATUS_COLORS.pending;
                const Icon     = toConf.icon;
                return (
                  <motion.div
                    key={entry._id || i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-4 pb-5"
                  >
                    {/* dot */}
                    <div className={`relative z-10 flex-shrink-0 w-[1.75rem] h-[1.75rem] rounded-full border-2 ${toConf.bg} ${toConf.border} flex items-center justify-center mt-0.5`}>
                      <Icon size={12} className={toConf.text} />
                    </div>

                    {/* card */}
                    <div className={`flex-1 card p-4 border ${toConf.border} ${toConf.bg}`}>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {entry.fromStatus && (
                          <>
                            <span className={`badge badge-sm ${fromConf.text} bg-transparent border`} style={{borderColor:'currentColor'}}>
                              {entry.fromStatus?.replace('_',' ')}
                            </span>
                            <ChevronRight size={12} className="text-base-content/30" />
                          </>
                        )}
                        <span className={`badge badge-sm ${toConf.text} bg-transparent border`} style={{borderColor:'currentColor'}}>
                          {entry.toStatus?.replace('_',' ')}
                        </span>
                      </div>

                      {entry.reason && (
                        <p className="text-xs text-base-content/60 mt-1 italic">"{entry.reason}"</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-base-content/40">
                        <span className="flex items-center gap-1"><CalendarDays size={11}/>{fmt(entry.changedAt)}</span>
                        {entry.changedBy && <span className="flex items-center gap-1"><User size={11}/>Changed by admin</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* origin dot */}
              <div className="flex gap-4">
                <div className="relative z-10 flex-shrink-0 w-[1.75rem] h-[1.75rem] rounded-full border-2 bg-base-300 border-base-300 flex items-center justify-center">
                  <Building2 size={12} className="text-base-content/40" />
                </div>
                <div className="flex-1 py-1">
                  <p className="text-xs text-base-content/30 italic">Blood bank registered</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Current status note */}
      <div className="alert alert-info">
        <Info size={16} className="text-info flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">About Status Changes</p>
          <p className="text-xs mt-0.5 text-base-content/60">Status changes are made by admin only. A newly registered blood bank starts as <strong>pending</strong>, moves to <strong>under_review</strong> when admin begins verification, and becomes <strong>active</strong> once all documents and licenses are approved.</p>
        </div>
      </div>
    </motion.div>
  );
}