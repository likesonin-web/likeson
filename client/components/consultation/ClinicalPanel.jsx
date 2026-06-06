'use client';

/**
 * ClinicalPanel.jsx — TAILWIND REFACTOR & SCHEMA ALIGNMENT
 *
 * NEW & ENHANCED:
 * 1. Fully utilizes Tailwind utility classes and global.css components.
 * 2. Mapped perfectly to Consultation and EPrescription schemas.
 * 3. Every single field includes a descriptive, small note label.
 * 4. Strictly uses a responsive 1-column (mobile) to 2-column (desktop) grid layout.
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronDown, ChevronUp, FileText,
  Pill, Plus, Trash2, Save, Stethoscope,
  Activity, ClipboardList, Upload, Eye,
  AlertCircle, ExternalLink, ShieldCheck
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  saveVitals, saveNotes, issuePrescription, fetchPrescriptions,
  saveReferral, fetchReferral,
  selectVitals, selectNotes, selectPrescriptions, selectReferral,
  selectLoading,
} from '@/store/slices/consultationSlice';
import { useConsultation } from '@/context/ConsultationProvider';
import toast from 'react-hot-toast';

// ── Role guard ────────────────────────────────────────────────────────────────

const useClinicalAccess = () => {
  const { userRole } = useConsultation();
  const allowed = ['doctor', 'admin', 'superadmin'];
  return allowed.includes(userRole);
};

// ── Shared UI Components ──────────────────────────────────────────────────────

const FormGroup = memo(({ label, note, children, className = '' }) => (
  <div className={`flex flex-col ${className}`}>
    <label className="text-xs font-bold font-poppins text-base-content/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
      {label}
    </label>
    {children}
    {note && <span className="text-[0.65rem] text-base-content/50 mt-1 font-medium leading-tight">{note}</span>}
  </div>
));
FormGroup.displayName = 'FormGroup';

const Section = memo(({ title, icon: Icon, children, defaultOpen = true, badge }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-base-100 border border-base-300 rounded-[var(--r-box)] mb-4 overflow-hidden shadow-sm transition-colors duration-200">
      <button
        className="w-full flex items-center justify-between p-4 bg-base-200/40 hover:bg-base-200/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary inset-0"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 font-montserrat font-bold text-base-content text-sm">
          <Icon size={16} className="text-primary" aria-hidden="true" />
          <span>{title}</span>
          {badge && (
            <span className="badge badge-primary badge-sm shadow-sm">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-base-content/50" /> : <ChevronDown size={16} className="text-base-content/50" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-base-300 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
Section.displayName = 'Section';

// ── Vitals Form ───────────────────────────────────────────────────────────────

const VitalsForm = memo(({ consultationId }) => {
  const dispatch = useDispatch();
  const existing = useSelector(selectVitals);
  const loading  = useSelector(selectLoading('clinical'));

  const [vitals, setVitals] = useState({
    bloodPressureSystolic:  existing?.bloodPressureSystolic  ?? '',
    bloodPressureDiastolic: existing?.bloodPressureDiastolic ?? '',
    pulseRate:              existing?.pulseRate              ?? '',
    temperatureC:           existing?.temperatureC           ?? '',
    spO2:                   existing?.spO2                   ?? '',
    respiratoryRate:        existing?.respiratoryRate        ?? '',
    weightKg:               existing?.weightKg               ?? '',
    heightCm:               existing?.heightCm               ?? '',
    bloodGlucose:           existing?.bloodGlucose           ?? '',
  });

  const update = (key, val) => setVitals((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    const payload = Object.fromEntries(
      Object.entries(vitals)
        .filter(([, v]) => v !== '' && v !== null)
        .map(([k, v]) => [k, Number(v)])
    );
    await dispatch(saveVitals({ consultationId, vitals: payload }));
  };

  const fields = [
    { key: 'bloodPressureSystolic',  label: 'BP Systolic (mmHg)',   note: 'Top number (e.g. 120)', placeholder: '120' },
    { key: 'bloodPressureDiastolic', label: 'BP Diastolic (mmHg)',  note: 'Bottom number (e.g. 80)', placeholder: '80'  },
    { key: 'pulseRate',              label: 'Pulse Rate (bpm)',     note: 'Heartbeats per minute', placeholder: '72'  },
    { key: 'temperatureC',           label: 'Temperature (°C)',     note: 'Core body temperature', placeholder: '37.0'},
    { key: 'spO2',                   label: 'SpO₂ (%)',             note: 'Blood oxygen saturation', placeholder: '98'  },
    { key: 'respiratoryRate',        label: 'Resp. Rate (/min)',    note: 'Breaths per minute', placeholder: '16'  },
    { key: 'weightKg',               label: 'Weight (kg)',          note: 'Current body weight', placeholder: '70'  },
    { key: 'heightCm',               label: 'Height (cm)',          note: 'Total body height', placeholder: '170' },
    { key: 'bloodGlucose',           label: 'Blood Glucose (mg/dL)',note: 'Random or fasting sugar', placeholder: '90'  },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(({ key, label, note, placeholder }) => (
          <FormGroup key={key} label={label} note={note}>
            <input
              type="number"
              className="input-field"
              placeholder={placeholder}
              value={vitals[key]}
              onChange={(e) => update(key, e.target.value)}
              aria-label={label}
            />
          </FormGroup>
        ))}
      </div>
      <button className="btn btn-primary btn-sm mt-5 gap-1.5 shadow-sm" onClick={handleSave} disabled={loading}>
        {loading ? <span className="loading loading-xs loading-spinner" /> : <Save size={14} />}
        Save Vitals
      </button>
    </div>
  );
});
VitalsForm.displayName = 'VitalsForm';

// ── SOAP Notes (incorporates ClinicalNotes schema) ────────────────────────────

const SOAPNotes = memo(({ consultationId }) => {
  const dispatch = useDispatch();
  const existing = useSelector(selectNotes);
  const loading  = useSelector(selectLoading('clinical'));

  const [notes, setNotes] = useState({
    chiefComplaint:  existing?.chiefComplaint  ?? '',
    subjective:      existing?.subjective      ?? '',
    objective:       existing?.objective       ?? '',
    assessment:      existing?.assessment      ?? '',
    plan:            existing?.plan            ?? '',
    lifestyleAdvice: existing?.lifestyleAdvice ?? '',
    dietAdvice:      existing?.dietAdvice      ?? '',
    followUpInDays:  existing?.followUpInDays  ?? '',
    followUpNote:    existing?.followUpNote    ?? '',
    privateNotes:    existing?.privateNotes    ?? '',
  });

  const update = (key) => (e) => setNotes((p) => ({ ...p, [key]: e.target.value }));

  const handleSave = async () => {
    await dispatch(saveNotes({ consultationId, notes }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormGroup label="Chief Complaint" note="Primary reason for the patient's visit today.">
          <textarea className="input-field min-h-[80px]" value={notes.chiefComplaint} onChange={update('chiefComplaint')} placeholder="e.g. Headache for 3 days..." />
        </FormGroup>
        <FormGroup label="S — Subjective" note="Patient's history, reported symptoms, and feelings.">
          <textarea className="input-field min-h-[80px]" value={notes.subjective} onChange={update('subjective')} />
        </FormGroup>
        <FormGroup label="O — Objective" note="Physical exam findings, vitals, and virtual observations.">
          <textarea className="input-field min-h-[80px]" value={notes.objective} onChange={update('objective')} />
        </FormGroup>
        <FormGroup label="A — Assessment" note="Medical diagnosis, differential diagnosis, or condition.">
          <textarea className="input-field min-h-[80px]" value={notes.assessment} onChange={update('assessment')} />
        </FormGroup>
        <FormGroup label="P — Plan" note="Treatment plan, medications ordered, and next steps.">
          <textarea className="input-field min-h-[80px]" value={notes.plan} onChange={update('plan')} />
        </FormGroup>
        <FormGroup label="Lifestyle Advice" note="Exercise, sleep, or habit recommendations.">
          <textarea className="input-field min-h-[80px]" value={notes.lifestyleAdvice} onChange={update('lifestyleAdvice')} />
        </FormGroup>
        <FormGroup label="Diet Advice" note="Specific dietary restrictions or nutritional goals.">
          <textarea className="input-field min-h-[80px]" value={notes.dietAdvice} onChange={update('dietAdvice')} />
        </FormGroup>
        <FormGroup label="Internal Private Notes" note="Confidential notes visible only to the doctor and admin.">
          <textarea className="input-field min-h-[80px] bg-warning/5 border-warning/30" value={notes.privateNotes} onChange={update('privateNotes')} placeholder="Internal reminders, hunches..." />
        </FormGroup>
        <FormGroup label="Follow-up in Days" note="Number of days until the next recommended visit.">
          <input type="number" className="input-field" value={notes.followUpInDays} onChange={update('followUpInDays')} placeholder="e.g. 7" />
        </FormGroup>
        <FormGroup label="Follow-up Note" note="Specific reason or focus for the follow-up appointment.">
          <input type="text" className="input-field" value={notes.followUpNote} onChange={update('followUpNote')} placeholder="e.g. Check blood pressure" />
        </FormGroup>
      </div>

      <button className="btn btn-primary btn-sm mt-2 gap-1.5 shadow-sm" onClick={handleSave} disabled={loading}>
        {loading ? <span className="loading loading-xs loading-spinner" /> : <Save size={14} />}
        Save Clinical Notes
      </button>
    </div>
  );
});
SOAPNotes.displayName = 'SOAPNotes';

// ── E-Prescription — Medicine Row ─────────────────────────────────────────────

const emptyMed = () => ({
  medicineName: '', genericName: '', brandName: '', dosage: '', form: 'Tablet',
  frequency: 'OD', durationDays: '', timing: 'After Food', route: 'Oral',
  quantity: '', refillsAllowed: 0, instructions: '', isSubstitutable: true,
});

const FREQUENCIES = ['OD','BD','TDS','QID','SOS','HS','AC','PC','STAT','Weekly','Monthly','As Directed'];
const TIMINGS     = ['Before Food','After Food','With Food','Empty Stomach','Bedtime','As Directed'];
const ROUTES      = ['Oral','Topical','IV','IM','Inhalation','Sublingual','Rectal','Other'];
const FORMS       = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Other'];

const MedicineRow = memo(({ med, index, onChange, onRemove }) => {
  const update = (key, val) => onChange(index, { ...med, [key]: val });

  return (
    <div className="relative bg-base-200/50 border border-base-300 p-4 rounded-[var(--r-box)] mb-4">
      <div className="absolute top-3 right-3">
        <button className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/20" onClick={() => onRemove(index)} aria-label="Remove medicine">
          <Trash2 size={14} />
        </button>
      </div>
      
      <h4 className="text-sm font-bold text-base-content mb-3 font-montserrat">Medicine #{index + 1}</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormGroup label="Medicine Name *" note="Exact prescribed name">
          <input className="input-field" placeholder="e.g. Paracetamol 500mg" value={med.medicineName} onChange={(e) => update('medicineName', e.target.value)} />
        </FormGroup>
        <FormGroup label="Generic Name" note="Active pharmaceutical ingredient">
          <input className="input-field" placeholder="e.g. Acetaminophen" value={med.genericName} onChange={(e) => update('genericName', e.target.value)} />
        </FormGroup>
        <FormGroup label="Brand Name" note="Specific brand requested">
          <input className="input-field" placeholder="e.g. Tylenol" value={med.brandName} onChange={(e) => update('brandName', e.target.value)} />
        </FormGroup>
        <FormGroup label="Dosage *" note="Amount per intake">
          <input className="input-field" placeholder="e.g. 500mg" value={med.dosage} onChange={(e) => update('dosage', e.target.value)} />
        </FormGroup>
        <FormGroup label="Form" note="Physical form of medicine">
          <select className="input-field" value={med.form} onChange={(e) => update('form', e.target.value)}>
            {FORMS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Frequency" note="How often to take">
          <select className="input-field" value={med.frequency} onChange={(e) => update('frequency', e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Duration" note="Total days to take">
          <input type="number" className="input-field" placeholder="e.g. 7" value={med.durationDays} onChange={(e) => update('durationDays', e.target.value)} />
        </FormGroup>
        <FormGroup label="Timing" note="Relation to meals">
          <select className="input-field" value={med.timing} onChange={(e) => update('timing', e.target.value)}>
            {TIMINGS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Route" note="Method of administration">
          <select className="input-field" value={med.route} onChange={(e) => update('route', e.target.value)}>
            {ROUTES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Total Qty" note="Total units to dispense">
          <input type="number" className="input-field" placeholder="e.g. 21" value={med.quantity} onChange={(e) => update('quantity', e.target.value)} />
        </FormGroup>
        <FormGroup label="Refills" note="Allowed repeat purchases">
          <input type="number" className="input-field" placeholder="0" min={0} value={med.refillsAllowed} onChange={(e) => update('refillsAllowed', Number(e.target.value))} />
        </FormGroup>
        <FormGroup label="Instructions" note="Special usage directions for patient">
          <input className="input-field" placeholder="e.g. Take with plenty of water" value={med.instructions} onChange={(e) => update('instructions', e.target.value)} />
        </FormGroup>
        <FormGroup label="Generic Substitution" note="Allow pharmacy to substitute brand">
          <div className="flex items-center gap-2 h-10 px-3 bg-base-100 rounded-[var(--r-field)] border border-base-300">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={med.isSubstitutable} onChange={(e) => update('isSubstitutable', e.target.checked)} id={`subst-${index}`} />
            <label htmlFor={`subst-${index}`} className="text-sm font-semibold cursor-pointer text-base-content/80">Allow Generic Alternative</label>
          </div>
        </FormGroup>
      </div>
    </div>
  );
});
MedicineRow.displayName = 'MedicineRow';

// ── E-Prescription Form (manual + upload) ─────────────────────────────────────

const PrescriptionForm = memo(({ consultationId }) => {
  const dispatch      = useDispatch();
  const prescriptions = useSelector(selectPrescriptions);
  const loading       = useSelector(selectLoading('clinical'));

  // Manual fields
  const [medicines,        setMedicines]        = useState([emptyMed()]);
  const [diagnosis,        setDiagnosis]        = useState('');
  const [diagnosisCode,    setDiagnosisCode]    = useState('');
  const [chiefComplaints,  setChiefComplaints]  = useState('');
  const [clinicalFindings, setClinicalFindings] = useState('');
  const [advice,           setAdvice]           = useState('');
  const [referralNote,     setReferralNote]     = useState('');
  
  const [labTests,     setLabTests]     = useState([]);
  const [labName,      setLabName]      = useState('');
  const [labCode,      setLabCode]      = useState('');
  const [labUrgency,   setLabUrgency]   = useState('routine');
  const [labInst,      setLabInst]      = useState('');
  
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpInst, setFollowUpInst] = useState('');

  // Upload mode
  const [uploadMode, setUploadMode]   = useState(false);
  const [rxFile,     setRxFile]       = useState(null);
  const [uploading,  setUploading]    = useState(false);
  const fileRef                       = useRef(null);

  const addMed    = () => setMedicines((p) => [...p, emptyMed()]);
  const removeMed = (i) => setMedicines((p) => p.filter((_, idx) => idx !== i));
  const updateMed = (i, med) => setMedicines((p) => p.map((m, idx) => idx === i ? med : m));

  const addLabTest = () => {
    if (!labName.trim()) return;
    setLabTests((p) => [...p, { testName: labName.trim(), testCode: labCode.trim(), urgency: labUrgency, instructions: labInst.trim() }]);
    setLabName(''); setLabCode(''); setLabInst('');
  };
  const removeLabTest = (i) => setLabTests((p) => p.filter((_, idx) => idx !== i));

  // Issue manual Rx
  const handleIssue = async () => {
    const validMeds = medicines.filter((m) => m.medicineName && m.dosage);
    if (!validMeds.length && !diagnosis) {
      toast.error('Add at least one medicine or diagnosis to issue Rx.');
      return;
    }
    await dispatch(issuePrescription({
      consultationId,
      data: {
        diagnosis,
        diagnosisCode,
        chiefComplaints: chiefComplaints ? chiefComplaints.split(',').map(c=>c.trim()) : [],
        clinicalFindings,
        advice,
        referralNote,
        followUpDate: followUpDate || undefined,
        followUpInstructions: followUpInst,
        medicines: validMeds.map((m) => ({
          ...m,
          durationDays: m.durationDays ? Number(m.durationDays) : undefined,
          quantity: m.quantity ? Number(m.quantity) : undefined,
        })),
        labTests,
        isUploaded: false,
      },
    }));
    dispatch(fetchPrescriptions(consultationId));
    // Reset
    setMedicines([emptyMed()]);
    setDiagnosis(''); setDiagnosisCode(''); setChiefComplaints(''); setClinicalFindings('');
    setAdvice(''); setReferralNote(''); setLabTests([]); setFollowUpDate(''); setFollowUpInst('');
  };

  // Upload scanned Rx
  const handleUpload = async () => {
    if (!rxFile) { toast.error('Please select a file first.'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('prescriptionFile', rxFile);
      formData.append('isUploaded', 'true');
      formData.append('diagnosis', diagnosis || '');
      await dispatch(issuePrescription({ consultationId, data: formData }));
      dispatch(fetchPrescriptions(consultationId));
      setRxFile(null);
      toast.success('Scanned prescription uploaded successfully.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Issued prescriptions list */}
      {prescriptions.length > 0 && (
        <div className="bg-success/5 border border-success/30 p-4 rounded-[var(--r-box)]">
          <p className="text-sm font-bold text-success mb-2 font-montserrat">Issued Prescriptions</p>
          <div className="space-y-2">
            {prescriptions.map((rx) => (
              <div key={rx._id ?? rx.rxNumber} className="flex items-center justify-between bg-base-100 p-2 rounded-[var(--r-field)] border border-base-300 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="badge badge-primary font-mono text-xs">{rx.rxNumber}</span>
                  <span className="text-xs font-semibold text-base-content/70 capitalize px-2 border-l border-base-300">
                    {rx.isUploaded ? '📎 Uploaded' : '✏️ Digital'} • {rx.status}
                  </span>
                </div>
                {rx.uploadedFileUrl && (
                  <a href={rx.uploadedFileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline btn-primary gap-1">
                    <ExternalLink size={12} /> View
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex bg-base-200 p-1 rounded-[var(--r-field)]">
        <button className={`flex-1 py-1.5 text-xs font-bold rounded-[calc(var(--r-field)-4px)] transition-all ${!uploadMode ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'}`} onClick={() => setUploadMode(false)}>
          ✏️ Digital E-Prescription
        </button>
        <button className={`flex-1 py-1.5 text-xs font-bold rounded-[calc(var(--r-field)-4px)] transition-all flex items-center justify-center gap-1.5 ${uploadMode ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'}`} onClick={() => setUploadMode(true)}>
          <Upload size={14} /> Upload Scanned Rx
        </button>
      </div>

      {/* ── UPLOAD MODE ── */}
      {uploadMode ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-base-100 border border-base-300 p-4 rounded-[var(--r-box)]">
          <FormGroup label="Primary Diagnosis (Optional)" note="For record-keeping purposes.">
            <input className="input-field" placeholder="e.g. Viral Fever" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </FormGroup>
          <FormGroup label="Prescription File" note="Upload clear photo or PDF of handwritten prescription.">
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => setRxFile(e.target.files?.[0] ?? null)} />
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors p-3 rounded-[var(--r-box)] cursor-pointer text-center" onClick={() => fileRef.current?.click()}>
              {rxFile ? (
                <span className="text-sm font-bold text-primary flex items-center gap-2"><ShieldCheck size={18}/> {rxFile.name}</span>
              ) : (
                <>
                  <Upload size={20} className="text-primary mb-1 opacity-80" />
                  <span className="text-xs font-semibold text-base-content">Select PDF/Image</span>
                </>
              )}
            </div>
          </FormGroup>
          <div className="col-span-1 sm:col-span-2">
            <button className="btn btn-success w-full gap-2 shadow-sm" onClick={handleUpload} disabled={uploading || !rxFile}>
              {uploading ? <span className="loading loading-sm loading-spinner" /> : <Upload size={16} />}
              Upload & Finalize Prescription
            </button>
          </div>
        </div>
      ) : (
        /* ── MANUAL MODE ── */
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-primary font-montserrat uppercase tracking-widest border-b border-base-300 pb-1">1. Clinical Context</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormGroup label="Diagnosis *" note="Primary condition identified.">
                <input className="input-field" placeholder="e.g. Acute Bronchitis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
              </FormGroup>
              <FormGroup label="ICD-10 Code" note="Standard medical billing code.">
                <input className="input-field font-mono" placeholder="e.g. J20.9" value={diagnosisCode} onChange={(e) => setDiagnosisCode(e.target.value)} />
              </FormGroup>
              <FormGroup label="Chief Complaints" note="Comma-separated list of patient symptoms.">
                <input className="input-field" placeholder="e.g. Cough, Fever, Fatigue" value={chiefComplaints} onChange={(e) => setChiefComplaints(e.target.value)} />
              </FormGroup>
              <FormGroup label="Clinical Findings" note="Brief objective findings to attach to prescription.">
                <textarea className="input-field min-h-[60px]" placeholder="e.g. Mild wheezing in lower lobes..." value={clinicalFindings} onChange={(e) => setClinicalFindings(e.target.value)} />
              </FormGroup>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-base-300 pb-1">
              <h3 className="text-sm font-bold text-primary font-montserrat uppercase tracking-widest">2. Medications</h3>
              <button className="btn btn-outline btn-primary btn-xs" onClick={addMed}>
                <Plus size={12} /> Add Medicine
              </button>
            </div>
            <div className="space-y-4">
              {medicines.map((med, i) => (
                <MedicineRow key={i} med={med} index={i} onChange={updateMed} onRemove={removeMed} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-primary font-montserrat uppercase tracking-widest border-b border-base-300 pb-1">3. Lab & Diagnostics</h3>
            {labTests.length > 0 && (
              <div className="space-y-2 mb-3">
                {labTests.map((lt, i) => (
                  <div key={i} className="flex items-center justify-between bg-base-200 px-3 py-2 rounded-[var(--r-field)] text-sm border border-base-300">
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{lt.testName} {lt.testCode && <span className="text-xs font-mono font-normal opacity-70">({lt.testCode})</span>}</span>
                      <span className="badge badge-neutral badge-xs uppercase">{lt.urgency}</span>
                      {lt.instructions && <span className="text-xs opacity-70 border-l border-base-300 pl-2">{lt.instructions}</span>}
                    </div>
                    <button className="text-error hover:bg-error/10 p-1 rounded" onClick={() => removeLabTest(i)}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-base-200/50 p-4 rounded-[var(--r-box)] border border-base-300">
              <FormGroup label="Test Name" note="e.g. Complete Blood Count">
                <input className="input-field" value={labName} onChange={(e) => setLabName(e.target.value)} />
              </FormGroup>
              <FormGroup label="Code (Opt)" note="e.g. LOINC code">
                <input className="input-field" value={labCode} onChange={(e) => setLabCode(e.target.value)} />
              </FormGroup>
              <FormGroup label="Urgency" note="Priority level">
                <select className="input-field" value={labUrgency} onChange={(e) => setLabUrgency(e.target.value)}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT</option>
                </select>
              </FormGroup>
              <FormGroup label="Instructions" note="Special prep (e.g. Fasting)">
                <div className="flex gap-2">
                  <input className="input-field w-full" value={labInst} onChange={(e) => setLabInst(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLabTest()} />
                  <button className="btn btn-secondary px-3 rounded-[var(--r-field)]" onClick={addLabTest}><Plus size={16}/></button>
                </div>
              </FormGroup>
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-sm font-bold text-primary font-montserrat uppercase tracking-widest border-b border-base-300 pb-1">4. Instructions & Follow-up</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <FormGroup label="General Advice" note="Dietary, lifestyle, or general precautions.">
                <textarea className="input-field min-h-[60px]" placeholder="e.g. Drink plenty of warm fluids..." value={advice} onChange={(e) => setAdvice(e.target.value)} />
              </FormGroup>
              <FormGroup label="Referral Note" note="If referring to another specialist, provide details here.">
                <input className="input-field" placeholder="e.g. Refer to Pulmonologist for further evaluation" value={referralNote} onChange={(e) => setReferralNote(e.target.value)} />
              </FormGroup>
               <FormGroup label="Follow-up Date" note="When should the patient return?">
                <input type="date" className="input-field" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
              </FormGroup>
              <FormGroup label="Follow-up Instructions" note="What should the patient do before next visit?">
                <input className="input-field" placeholder="e.g. Bring lab reports" value={followUpInst} onChange={(e) => setFollowUpInst(e.target.value)} />
              </FormGroup>
            </div>
          </div>

          <button className="btn btn-success btn-lg w-full gap-2 shadow-success font-bold tracking-wide" onClick={handleIssue} disabled={loading}>
            {loading ? <span className="loading loading-spinner" /> : <Pill size={18} />}
            Generate Digital E-Prescription
          </button>
        </div>
      )}
    </div>
  );
});
PrescriptionForm.displayName = 'PrescriptionForm';

// ── Main Clinical Panel ───────────────────────────────────────────────────────

const ClinicalPanel = memo(({ onClose }) => {
  const { consultationId } = useConsultation();
  const hasAccess = useClinicalAccess();
  const prescriptions = useSelector(selectPrescriptions);
  if (!hasAccess) {
    return (
      <div className="flex flex-col h-full bg-base-100 border-l border-base-300 w-full sm:w-96 md:w-[28rem] lg:w-[34rem] shadow-depth-lg" role="complementary">
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-100/90 backdrop-blur-soft z-10 shrink-0">
          <h2 className="font-montserrat text-lg font-bold text-base-content tracking-tight flex items-center gap-2">
            <Stethoscope size={20} className="text-primary"/> Clinical
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm"><X size={18} /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-70">
          <AlertCircle size={40} className="text-warning mb-4" />
          <p className="font-poppins font-semibold text-base-content">Access Restricted</p>
          <p className="text-sm mt-1">This panel contains sensitive medical data and is restricted to the attending doctor and administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-base-100 border-l border-base-300 w-full sm:w-96 md:w-[32rem] lg:w-[38rem] shadow-depth-lg" role="complementary" aria-label="Clinical panel">
      
      <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-100/90 backdrop-blur-soft z-10 shrink-0">
        <h2 className="font-montserrat text-lg font-bold text-base-content tracking-tight flex items-center gap-2">
          <Stethoscope size={20} className="text-primary" aria-hidden="true" />
          Clinical Workspace
        </h2>
        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content hover:bg-base-200" aria-label="Close clinical panel">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-base-200/30">

        <Section title="Vitals & Measurements" icon={Activity} defaultOpen>
          <VitalsForm consultationId={consultationId} />
        </Section>

        <Section title="SOAP & Clinical Notes" icon={ClipboardList} defaultOpen={false}>
          <SOAPNotes consultationId={consultationId} />
        </Section>

        <Section title="E-Prescription & Orders" icon={Pill} defaultOpen={false} badge={prescriptions.length > 0 ? `${prescriptions.length} Issued` : null}>
          <PrescriptionForm consultationId={consultationId} />
        </Section>

      </div>
    </div>
  );
});
ClinicalPanel.displayName = 'ClinicalPanel';

export default ClinicalPanel;