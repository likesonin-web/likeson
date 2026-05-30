'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Printer, Send, FlaskConical, Pill } from 'lucide-react';
import { usePrescription }  from '../../hooks/usePrescription';
import { VitalsSection }    from './SidebarPanels';
import { MedicineRow }      from './SidebarPanels';
import { LabTestRow }       from './SidebarPanels';
import { useSelector }      from 'react-redux';
import { selectConsultation } from '@/store/slices/consultationSlice';

export function PrescriptionPanel({ consultationId }) {
  const consultation = useSelector(selectConsultation);
  const {
    form, isSubmitting,
    updateField, updateVital,
    addMedicine, updateMedicine, removeMedicine,
    addLabTest,  updateLabTest,  removeLabTest,
    submit,
  } = usePrescription(consultationId);

  const patient = consultation?.patient;

  return (
    <div className="rx-panel overflow-y-auto flex-1">
      {/* Header: patient + doctor snapshot */}
      <div className="rx-header-grid mb-2">
        <div>
          <p className="rx-label">Patient</p>
          <p className="rx-value font-bold">{patient?.name || '—'}</p>
          <p className="rx-value">{patient?.phone || ''}</p>
        </div>
        <div className="text-right">
          <p className="rx-label">Consultation ID</p>
          <p className="rx-value font-mono text-xs">{consultationId?.slice(-8)}</p>
        </div>
      </div>

      {/* Vitals */}
      <VitalsSection vitals={form.vitals} onChange={updateVital} />

      {/* Chief Complaint */}
      <div className="mt-3">
        <p className="rx-section-title">Chief Complaint</p>
        <textarea
          value={form.chiefComplaints?.join('\n') || ''}
          onChange={(e) => updateField('chiefComplaints', e.target.value.split('\n'))}
          placeholder="Enter chief complaints…"
          className="rx-textarea"
          rows={2}
          aria-label="Chief complaints"
        />
      </div>

      {/* Diagnosis */}
      <div className="mt-3">
        <p className="rx-section-title">Diagnosis</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="rx-label">Diagnosis</label>
            <input
              value={form.diagnosis}
              onChange={(e) => updateField('diagnosis', e.target.value)}
              placeholder="e.g. Type 2 Diabetes Mellitus"
              className="rx-input"
            />
          </div>
          <div className="w-28">
            <label className="rx-label">ICD-10</label>
            <input
              value={form.diagnosisCode}
              onChange={(e) => updateField('diagnosisCode', e.target.value)}
              placeholder="E11"
              className="rx-input"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="rx-label">Clinical Findings</label>
          <textarea
            value={form.clinicalFindings}
            onChange={(e) => updateField('clinicalFindings', e.target.value)}
            placeholder="Clinical findings…"
            className="rx-textarea"
            rows={2}
            aria-label="Clinical findings"
          />
        </div>
      </div>

      {/* Medicines */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="rx-section-title mb-0">Medicines</p>
          <button type="button" onClick={addMedicine} className="rx-add-btn">
            <Plus size={12} /> Add
          </button>
        </div>
        <AnimatePresence initial={false}>
          {form.medicines.map((med, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{   opacity: 0, height: 0 }}
              className="mb-2 overflow-hidden"
            >
              <MedicineRow
                medicine={med}
                index={i}
                onChange={updateMedicine}
                onRemove={removeMedicine}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {form.medicines.length === 0 && (
          <div className="flex items-center justify-center py-4 border border-dashed border-base-300 rounded-lg">
            <span className="text-xs text-base-content/30 flex items-center gap-1.5">
              <Pill size={14} /> No medicines added
            </span>
          </div>
        )}
      </div>

      {/* Lab Tests */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="rx-section-title mb-0">Lab Tests</p>
          <button type="button" onClick={addLabTest} className="rx-add-btn">
            <Plus size={12} /> Add
          </button>
        </div>
        <AnimatePresence initial={false}>
          {form.labTests.map((test, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{   opacity: 0, height: 0 }}
              className="mb-2 overflow-hidden"
            >
              <LabTestRow
                test={test}
                index={i}
                onChange={updateLabTest}
                onRemove={removeLabTest}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {form.labTests.length === 0 && (
          <div className="flex items-center justify-center py-4 border border-dashed border-base-300 rounded-lg">
            <span className="text-xs text-base-content/30 flex items-center gap-1.5">
              <FlaskConical size={14} /> No lab tests ordered
            </span>
          </div>
        )}
      </div>

      {/* Advice + Follow-up */}
      <div className="mt-3 grid grid-cols-1 gap-2">
        <div>
          <label className="rx-label" htmlFor="rx-advice">Advice / Instructions</label>
          <textarea
            id="rx-advice"
            value={form.advice}
            onChange={(e) => updateField('advice', e.target.value)}
            placeholder="Diet, lifestyle, precautions…"
            className="rx-textarea"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="rx-label" htmlFor="rx-followup-date">Follow-up Date</label>
            <input
              id="rx-followup-date"
              type="date"
              value={form.followUpDate}
              onChange={(e) => updateField('followUpDate', e.target.value)}
              className="rx-input"
            />
          </div>
          <div>
            <label className="rx-label" htmlFor="rx-followup-inst">Follow-up Note</label>
            <input
              id="rx-followup-inst"
              value={form.followUpInstructions}
              onChange={(e) => updateField('followUpInstructions', e.target.value)}
              placeholder="Review after 1 week"
              className="rx-input"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-base-300">
        <button
          onClick={submit}
          disabled={isSubmitting || !form.diagnosis}
          className="btn btn-primary flex-1 gap-2"
          aria-label="Issue prescription"
        >
          {isSubmitting
            ? <span className="loading loading-sm" />
            : <><Send size={14} /> Issue Prescription</>
          }
        </button>
        <button
          onClick={() => window.print()}
          className="btn btn-ghost border border-base-300 gap-2"
          aria-label="Print prescription"
        >
          <Printer size={14} />
          <span className="hidden sm:inline">Print</span>
        </button>
      </div>
    </div>
  );
}
