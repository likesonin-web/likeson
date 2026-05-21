'use client';
/**
 * ConsultationSidebar.jsx
 * Left panel: patient info, booking info, prescription upload, doctor notes.
 */

import React, { memo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  User, FileText, Clock, CreditCard, Hash,
  Upload, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { uploadPrescription } from '@/store/slices/consultationSlice'; // adjust path
import { selectConsultationLoaders } from '@/store/slices/consultationSlice';
import { SIDEBAR_TABS } from '@/utils/constants';

/**
 * @param {object} props
 * @param {object}  props.booking       - full booking object
 * @param {object}  props.joinDetails
 * @param {string}  props.bookingId
 */
export const ConsultationSidebar = memo(function ConsultationSidebar({
  booking,
  joinDetails,
  bookingId,
}) {
  const dispatch = useDispatch();
  const loaders  = useSelector(selectConsultationLoaders);

  const [activeTab,       setActiveTab]       = useState(SIDEBAR_TABS.PATIENT);
  const [prescriptionUrl, setPrescriptionUrl] = useState('');
  const [doctorNotes,     setDoctorNotes]     = useState('');
  const [expandedSection, setExpandedSection] = useState('patient');

  const patient     = booking?.patientInfo;
  const oc          = booking?.onlineConsultation;
  const opRecord    = booking?.outPatientRecord;
  const fare        = booking?.fareBreakdown;

  const handleUploadPrescription = useCallback(async () => {
    if (!prescriptionUrl.trim() || !bookingId) return;
    try {
      await dispatch(uploadPrescription({ bookingId, prescriptionUrl: prescriptionUrl.trim() })).unwrap();
      setPrescriptionUrl('');
    } catch (_) {}
  }, [prescriptionUrl, bookingId, dispatch]);

  const Section = ({ id, title, icon: Icon, children }) => {
    const isOpen = expandedSection === id;
    return (
      <div className="border border-base-300 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandedSection(isOpen ? null : id)}
          className="w-full flex items-center justify-between px-4 py-3 bg-base-200 hover:bg-base-300/50 transition-colors text-left"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
            <Icon size={14} className="text-primary" />
            {title}
          </div>
          {isOpen ? <ChevronUp size={14} className="text-base-content/40" /> : <ChevronDown size={14} className="text-base-content/40" />}
        </button>
        {isOpen && (
          <div className="px-4 py-3 bg-base-100 space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  };

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-base-content/50 shrink-0">{label}</span>
      <span className="text-xs font-medium text-base-content text-right">{value || '—'}</span>
    </div>
  );

  return (
    <aside className="flex flex-col h-full overflow-y-auto scrollbar-thin gap-3 p-3" aria-label="Consultation sidebar">

      {/* Patient info */}
      <Section id="patient" title="Patient" icon={User}>
        <InfoRow label="Name"       value={patient?.name} />
        <InfoRow label="Age"        value={patient?.age ? `${patient.age} yrs` : null} />
        <InfoRow label="Gender"     value={patient?.gender} />
        <InfoRow label="Blood Group" value={patient?.bloodGroup} />
        <InfoRow label="Phone"      value={patient?.phone} />
        <InfoRow label="Weight"     value={patient?.weight ? `${patient.weight} kg` : null} />
      </Section>

      {/* Booking info */}
      <Section id="booking" title="Booking" icon={Hash}>
        <InfoRow label="Code"       value={booking?.bookingCode} />
        <InfoRow label="Status"     value={booking?.status} />
        <InfoRow label="Duration"   value={joinDetails?.allowedDurationMinutes ? `${joinDetails.allowedDurationMinutes} min` : null} />
        <InfoRow label="OP Number"  value={opRecord?.opNumber} />
        {fare && (
          <InfoRow label="Amount"   value={`₹${fare.totalAmount}`} />
        )}
      </Section>

      {/* Prescription */}
      <Section id="prescription" title="Prescription" icon={FileText}>
        {oc?.prescriptionUploaded ? (
          <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <AlertCircle size={12} className="text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Prescription uploaded</span>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="url"
              value={prescriptionUrl}
              onChange={(e) => setPrescriptionUrl(e.target.value)}
              placeholder="Paste prescription URL..."
              className="input-field text-xs py-1.5"
            />
            <button
              onClick={handleUploadPrescription}
              disabled={!prescriptionUrl.trim() || loaders.isActionLoading}
              className="btn btn-primary w-full btn-sm gap-1.5"
            >
              <Upload size={12} />
              Upload Prescription
            </button>
          </div>
        )}
      </Section>

      {/* Doctor Notes (local only — not persisted via this panel) */}
      <Section id="notes" title="Quick Notes" icon={FileText}>
        <textarea
          value={doctorNotes}
          onChange={(e) => setDoctorNotes(e.target.value)}
          placeholder="Private clinical notes (not shared with patient)..."
          rows={5}
          className="input-field resize-none text-xs"
          maxLength={3000}
        />
        <p className="text-[10px] text-base-content/30 text-right">{doctorNotes.length}/3000</p>
        <p className="text-[10px] text-amber-400/70">Notes saved locally — add to summary on end.</p>
      </Section>

    </aside>
  );
});

export default ConsultationSidebar;