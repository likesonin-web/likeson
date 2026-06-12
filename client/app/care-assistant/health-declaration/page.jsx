'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, ShieldCheck, AlertTriangle, CheckCircle2,
  Loader2, ClipboardList, Info, ChevronRight, Activity
} from 'lucide-react';
import {
  updateHealthDeclaration,
  selectProfile, selectLoading, selectErrorKey,
} from '@/store/slices/careAssistantSlice';
import BackButton from '../../../components/BackButton';

const DECLARATIONS = [
  { id: 'noInfectious',  label: 'I have no known infectious or communicable diseases.' },
  { id: 'physicallyFit', label: 'I am physically capable of assisting patients with mobility and daily activities.' },
  { id: 'noSubstance',   label: 'I do not use any substances that may impair my ability to work.' },
  { id: 'mentalHealth',  label: 'I am in a stable mental and emotional state to provide care.' },
  { id: 'vaccinated',    label: 'I have received recommended vaccinations (COVID-19, Hepatitis B, etc.).' },
  { id: 'noAllergies',   label: 'I have no unmanaged allergies that could affect patient care.' },
];

export default function FitnessDeclarationPage() {
  const dispatch  = useDispatch();
  const profile   = useSelector(selectProfile);
  const loading   = useSelector(selectLoading);
  const error     = useSelector(selectErrorKey('health'));

  const existing = profile?.healthDeclaration;

  const [isMedicallyFit,     setIsMedicallyFit]     = useState(existing?.isMedicallyFit ?? null);
  const [conditions,         setConditions]          = useState('');
  const [checkedDeclarations, setCheckedDeclarations] = useState({});
  const [saved,              setSaved]               = useState(false);
  const [step,               setStep]                = useState(existing?.isMedicallyFit !== undefined ? 2 : 1);

  const allChecked = DECLARATIONS.every((d) => checkedDeclarations[d.id]);

  const handleCheck = (id) =>
    setCheckedDeclarations((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async () => {
    if (isMedicallyFit === null) return;
    const result = await dispatch(updateHealthDeclaration({
      isMedicallyFit,
      anyKnownConditions: conditions || undefined,
    }));
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-8 pb-6"
      >

        <div className="flex items-center gap-3 mb-1">
          <BackButton   />
          <div className="p-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--success), transparent 85%)' }}>
            <Heart size={22} style={{ color: 'var(--success)' }} />
          </div>
          <h1 className="text-2xl font-extrabold font-montserrat" style={{ color: 'var(--base-content)' }}>
            Health & Fitness Declaration
          </h1>
        </div>
        <p className="text-sm ml-12" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
          Required before you can accept care bookings
        </p>
      </motion.div>

      <div className="px-6 pb-10 max-w-2xl mx-auto space-y-5">

        {/* Existing status banner */}
        {existing?.isMedicallyFit !== undefined && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card p-4 flex items-center gap-4"
            style={{
              background: existing.isMedicallyFit
                ? 'color-mix(in srgb, var(--success), transparent 90%)'
                : 'color-mix(in srgb, var(--warning), transparent 90%)',
              border: `1px solid ${existing.isMedicallyFit ? 'color-mix(in srgb, var(--success), transparent 70%)' : 'color-mix(in srgb, var(--warning), transparent 70%)'}`,
            }}
          >
            {existing.isMedicallyFit
              ? <ShieldCheck size={22} style={{ color: 'var(--success)' }} />
              : <AlertTriangle size={22} style={{ color: 'var(--warning)' }} />}
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>
                {existing.isMedicallyFit ? 'Declared Medically Fit' : 'Declared Unfit / Conditions Present'}
              </p>
              {existing.declaredAt && (
                <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                  Last updated: {new Date(existing.declaredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 1 — Fit or Not */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold"
              style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}>1</span>
            <h2 className="font-extrabold text-base font-montserrat" style={{ color: 'var(--base-content)' }}>
              Overall Health Status
            </h2>
          </div>

          <p className="text-sm mb-5" style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>
            Do you declare yourself medically and physically fit to provide care services to patients?
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[{ val: true, label: 'Yes, I am Fit', icon: ShieldCheck, color: 'var(--success)' },
              { val: false, label: 'No / Conditions Present', icon: AlertTriangle, color: 'var(--warning)' }].map(({ val, label, icon: Icon, color }) => (
              <button
                key={String(val)}
                onClick={() => { setIsMedicallyFit(val); setStep(2); }}
                className="flex flex-col items-center gap-3 py-5 rounded-2xl border-2 transition-all font-semibold text-sm"
                style={{
                  borderColor: isMedicallyFit === val ? color : 'var(--base-300)',
                  background: isMedicallyFit === val
                    ? `color-mix(in srgb, ${color}, transparent 88%)`
                    : 'var(--base-200)',
                  color: isMedicallyFit === val ? color : 'var(--base-content)',
                  transform: isMedicallyFit === val ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                <Icon size={28} style={{ color }} />
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Step 2 — Declarations */}
        <AnimatePresence>
          {step >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <div className="flex items-center gap-2 mb-5">
                <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold"
                  style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}>2</span>
                <h2 className="font-extrabold text-base font-montserrat" style={{ color: 'var(--base-content)' }}>
                  Self-Declaration Checklist
                </h2>
              </div>

              <div className="space-y-3">
                {DECLARATIONS.map((d, i) => (
                  <motion.label
                    key={d.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-all"
                    style={{
                      background: checkedDeclarations[d.id]
                        ? 'color-mix(in srgb, var(--success), transparent 90%)'
                        : 'var(--base-200)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!checkedDeclarations[d.id]}
                      onChange={() => handleCheck(d.id)}
                      className="mt-0.5 w-4 h-4 accent-success cursor-pointer"
                      style={{ accentColor: 'var(--success)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--base-content)' }}>{d.label}</span>
                  </motion.label>
                ))}
              </div>

              {!allChecked && (
                <p className="mt-3 text-xs flex items-center gap-1.5"
                  style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                  <Info size={12} /> Please confirm all declarations above
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3 — Conditions */}
        <AnimatePresence>
          {step >= 2 && isMedicallyFit === false && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold"
                  style={{ background: 'var(--warning)', color: 'var(--warning-content)' }}>3</span>
                <h2 className="font-extrabold text-base font-montserrat" style={{ color: 'var(--base-content)' }}>
                  Known Conditions (Optional)
                </h2>
              </div>
              <textarea
                rows={4}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Briefly describe any conditions that may affect your work…"
                className="input-field w-full resize-none text-sm"
                style={{ fontFamily: 'var(--font-family-poppins)' }}
              />
              <p className="text-xs mt-2 flex items-center gap-1.5"
                style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                <ShieldCheck size={12} /> This information is confidential and only visible to admins
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <AnimatePresence>
          {step >= 2 && isMedicallyFit !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {error && (
                <div className="alert alert-error mb-4">
                  <AlertTriangle size={16} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading.health || (isMedicallyFit && !allChecked)}
                className="btn-primary-cta w-full flex items-center justify-center gap-2"
              >
                {loading.health
                  ? <Loader2 size={18} className="animate-spin" />
                  : saved
                  ? <><CheckCircle2 size={18} /> Declaration Saved!</>
                  : <><ClipboardList size={18} /> Submit Declaration</>}
              </button>

              {isMedicallyFit && !allChecked && (
                <p className="text-center text-xs mt-2"
                  style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                  Check all declarations to proceed
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Box */}
        <div className="card p-4 flex gap-3"
          style={{ background: 'color-mix(in srgb, var(--info), transparent 92%)', border: '1px solid color-mix(in srgb, var(--info), transparent 75%)' }}>
          <Info size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--info)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--base-content)' }}>
            This declaration is required by Likeson Healthcare to ensure patient safety. False declarations may result in account suspension. This must be renewed every 6 months.
          </p>
        </div>
      </div>
    </div>
  );
}