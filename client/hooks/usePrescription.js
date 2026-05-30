'use client';
import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  issuePrescription,
  fetchPrescriptions,
  selectPrescriptions,
  selectConsultationLoading,
} from '@/store/slices/consultationSlice';

/**
 * usePrescription
 * Manages prescription form state and submission.
 */
export function usePrescription(consultationId) {
  const dispatch      = useDispatch();
  const prescriptions = useSelector(selectPrescriptions);
  const loading       = useSelector(selectConsultationLoading);

  const [form, setForm] = useState({
    diagnosis:        '',
    diagnosisCode:    '',
    chiefComplaints:  [],
    clinicalFindings: '',
    medicines:        [],
    labTests:         [],
    followUpDate:     '',
    followUpInstructions: '',
    advice:           '',
    referralNote:     '',
    vitals: {
      bloodPressure: '',
      pulseRate:     '',
      temperature:   '',
      spO2:          '',
      bloodSugar:    '',
      weightKg:      '',
      heightCm:      '',
    },
  });

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateVital = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      vitals: { ...prev.vitals, [key]: value },
    }));
  }, []);

  const addMedicine = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      medicines: [
        ...prev.medicines,
        {
          medicineName: '',
          dosage:       '',
          frequency:    'BD',
          durationDays: 5,
          timing:       'After Food',
          route:        'Oral',
          instructions: '',
        },
      ],
    }));
  }, []);

  const updateMedicine = useCallback((idx, field, value) => {
    setForm((prev) => {
      const next = [...prev.medicines];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, medicines: next };
    });
  }, []);

  const removeMedicine = useCallback((idx) => {
    setForm((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== idx),
    }));
  }, []);

  const addLabTest = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      labTests: [
        ...prev.labTests,
        { testName: '', urgency: 'routine', instructions: '' },
      ],
    }));
  }, []);

  const updateLabTest = useCallback((idx, field, value) => {
    setForm((prev) => {
      const next = [...prev.labTests];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, labTests: next };
    });
  }, []);

  const removeLabTest = useCallback((idx) => {
    setForm((prev) => ({
      ...prev,
      labTests: prev.labTests.filter((_, i) => i !== idx),
    }));
  }, []);

  const submit = useCallback(async () => {
    await dispatch(issuePrescription({ id: consultationId, ...form }));
  }, [dispatch, consultationId, form]);

  const load = useCallback(() => {
    dispatch(fetchPrescriptions(consultationId));
  }, [dispatch, consultationId]);

  return {
    form,
    prescriptions,
    isSubmitting: loading.prescription,
    updateField,
    updateVital,
    addMedicine,
    updateMedicine,
    removeMedicine,
    addLabTest,
    updateLabTest,
    removeLabTest,
    submit,
    load,
  };
}
