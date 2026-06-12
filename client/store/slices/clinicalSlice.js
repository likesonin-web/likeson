/**
 * clinicalSlice.js — Likeson.in
 * Redux Toolkit slice for /api/v1/clinical routes.
 * Sections:
 *   A — Prescriptions
 *   B — OP Records
 *   C — Care Assistant: Bookings
 *   D — Care Assistant: Care Records
 *   D2 — Care Record Uploads (file + standalone)
 *   E — Admin
 *   F — Doctor Dashboard
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

const BASE = '/clinical';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pending   = (state, key)         => { state.loading[key] = true;  state.errors[key] = null; };
const rejected  = (state, action, key) => { state.loading[key] = false; state.errors[key] = action.payload; };
const fulfilled = (state, key)         => { state.loading[key] = false; state.errors[key] = null; };

/**
 * Build FormData from a plain object.
 * Handles: File[] under key "files", arrays serialised as JSON, primitives as strings.
 * Usage: toFormData({ files: [File, File], mealType: 'lunch', images: [...urls] })
 */
const toFormData = (obj) => {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === 'files') {
      // FileList or File[]
      const list = Array.isArray(v) ? v : Array.from(v);
      list.forEach((f) => fd.append('files', f));
    } else if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof File))) {
      fd.append(k, JSON.stringify(v));
    } else {
      fd.append(k, v);
    }
  });
  return fd;
};

const multipartCfg = { headers: { 'Content-Type': 'multipart/form-data' } };


// ═══════════════════════════════════════════════════════════════════════════════
//  A — PRESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const createPrescription = createAsyncThunk(
  'clinical/createPrescription',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/prescriptions`, body);
      toast.success('Prescription created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create prescription.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchPrescriptions = createAsyncThunk(
  'clinical/fetchPrescriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/prescriptions`, { params });
      return data; // { total, page, data[] }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch prescriptions.');
    }
  }
);

// NOTE: must hit /verify/:rxNumber BEFORE /:id — router already ordered correctly
export const verifyPrescription = createAsyncThunk(
  'clinical/verifyPrescription',
  async (rxNumber, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/prescriptions/verify/${rxNumber}`);
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Prescription not found.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchPrescriptionById = createAsyncThunk(
  'clinical/fetchPrescriptionById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/prescriptions/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch prescription.');
    }
  }
);

export const downloadPrescriptionPdf = createAsyncThunk(
  'clinical/downloadPrescriptionPdf',
  async (id, { rejectWithValue }) => {
    try {
      const res = await API.get(`${BASE}/prescriptions/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      return id;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to download PDF.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const cancelPrescription = createAsyncThunk(
  'clinical/cancelPrescription',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/prescriptions/${id}/cancel`, { reason });
      toast.success('Prescription cancelled.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to cancel prescription.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
//  B — OP RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchOPRecords = createAsyncThunk(
  'clinical/fetchOPRecords',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/op-records`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch OP records.');
    }
  }
);

export const fetchOPRecordById = createAsyncThunk(
  'clinical/fetchOPRecordById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/op-records/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch OP record.');
    }
  }
);

export const completeOPRecord = createAsyncThunk(
  'clinical/completeOPRecord',
  async ({ id, doctorNotes, diagnosisCode, reasonForVisit }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/op-records/${id}/complete`, {
        doctorNotes, diagnosisCode, reasonForVisit,
      });
      toast.success('Consultation marked as completed.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to complete OP record.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updateOPStatus = createAsyncThunk(
  'clinical/updateOPStatus',
  async ({ id, status, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/op-records/${id}/status`, { status, reason });
      toast.success(`OP status updated to ${status}.`);
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update OP status.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
//  C — CARE ASSISTANT: BOOKINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchCABookings = createAsyncThunk(
  'clinical/fetchCABookings',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/bookings`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch bookings.');
    }
  }
);

export const fetchCAPendingBookings = createAsyncThunk(
  'clinical/fetchCAPendingBookings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/bookings/pending`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch pending bookings.');
    }
  }
);

export const fetchCABookingById = createAsyncThunk(
  'clinical/fetchCABookingById',
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/bookings/${bookingId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch booking detail.');
    }
  }
);

export const acceptCABooking = createAsyncThunk(
  'clinical/acceptCABooking',
  async ({ bookingId, patientSnapshot }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/care/bookings/${bookingId}/accept`, { patientSnapshot });
      toast.success('Booking accepted! Care record created.');
      return { bookingId, careRecord: data.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to accept booking.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const rejectCABooking = createAsyncThunk(
  'clinical/rejectCABooking',
  async ({ bookingId, reason }, { rejectWithValue }) => {
    try {
      await API.post(`${BASE}/care/bookings/${bookingId}/reject`, { reason });
      toast.success('Booking rejected.');
      return bookingId;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reject booking.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
//  D — CARE ASSISTANT: CARE RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve active care record by bookingId or patientId.
 * CA app calls this on mount — sets activeCareRecord in state.
 * Params: { bookingId } | { patientId }
 */
export const fetchActiveCareRecord = createAsyncThunk(
  'clinical/fetchActiveCareRecord',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/records/active`, { params });
      return data.record;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'No active care record found.');
    }
  }
);

export const fetchCareRecords = createAsyncThunk(
  'clinical/fetchCareRecords',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/records`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch care records.');
    }
  }
);

export const fetchCareRecordById = createAsyncThunk(
  'clinical/fetchCareRecordById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/records/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch care record.');
    }
  }
);

/**
 * Log vitals — supports file uploads (oximeter/monitor photos).
 * Pass files: File[] for multipart upload, or omit for JSON-only.
 *
 * @param {object} payload
 * @param {string} payload.id              — care record _id
 * @param {File[]} [payload.files]         — optional evidence images
 * @param {string} [payload.caption]       — image caption
 * @param {string} [payload.bloodPressure]
 * @param {number} [payload.pulseRate]
 * @param {number} [payload.temperature]
 * @param {number} [payload.spO2]
 * @param {number} [payload.bloodSugar]
 * @param {number} [payload.weightKg]
 * @param {number} [payload.heightCm]
 * @param {number} [payload.respiratoryRate]
 * @param {string} [payload.notes]
 * @param {object[]} [payload.evidenceImages] — pre-hosted URL objects (no files)
 */
export const logVitals = createAsyncThunk(
  'clinical/logVitals',
  async ({ id, files, ...rest }, { rejectWithValue }) => {
    try {
      let res;
      if (files?.length) {
        res = await API.post(
          `${BASE}/care/records/${id}/vitals`,
          toFormData({ files, ...rest }),
          multipartCfg,
        );
      } else {
        res = await API.post(`${BASE}/care/records/${id}/vitals`, rest);
      }
      toast.success('Vitals recorded.');
      return { id, entry: res.data.latest };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log vitals.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Log food entry — supports meal plate photo upload.
 *
 * @param {object} payload
 * @param {string} payload.id
 * @param {File[]} [payload.files]
 * @param {string} payload.mealType
 * @param {string} [payload.description]
 * @param {number} [payload.quantityMl]
 * @param {string} [payload.status]        — consumed|partial|refused|vomited
 * @param {string} [payload.refusalReason]
 * @param {string} [payload.notes]
 * @param {string} [payload.caption]
 * @param {object[]} [payload.images]      — pre-hosted URL objects
 */
export const logFood = createAsyncThunk(
  'clinical/logFood',
  async ({ id, files, ...rest }, { rejectWithValue }) => {
    try {
      let res;
      if (files?.length) {
        res = await API.post(
          `${BASE}/care/records/${id}/food`,
          toFormData({ files, ...rest }),
          multipartCfg,
        );
      } else {
        res = await API.post(`${BASE}/care/records/${id}/food`, rest);
      }
      toast.success('Food entry logged.');
      return { id, entry: res.data.entry };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log food entry.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Log medicine administration — supports pill/strip photo upload.
 *
 * @param {object} payload
 * @param {string} payload.id
 * @param {File[]} [payload.files]
 * @param {string} payload.medicineName
 * @param {string} payload.scheduledAt    — ISO date string
 * @param {string} [payload.dosage]
 * @param {string} [payload.route]        — oral|iv|im|topical|...
 * @param {string} [payload.status]       — given|missed|refused|held
 * @param {string} [payload.administeredAt]
 * @param {string} [payload.missedReason]
 * @param {string} [payload.notes]
 * @param {string} [payload.caption]
 * @param {object[]} [payload.pillImages] — pre-hosted URL objects
 */
export const logMedicine = createAsyncThunk(
  'clinical/logMedicine',
  async ({ id, files, ...rest }, { rejectWithValue }) => {
    try {
      let res;
      if (files?.length) {
        res = await API.post(
          `${BASE}/care/records/${id}/medicine-log`,
          toFormData({ files, ...rest }),
          multipartCfg,
        );
      } else {
        res = await API.post(`${BASE}/care/records/${id}/medicine-log`, rest);
      }
      toast.success('Medicine administration logged.');
      return { id, entry: res.data.entry };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log medicine.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Add care note — supports wound/observation photo upload.
 *
 * @param {object} payload
 * @param {string} payload.id
 * @param {string} payload.note
 * @param {string} [payload.category]          — general|behavior|pain|mobility|hygiene|emotional|alert
 * @param {string} [payload.severity]          — low|medium|high|critical
 * @param {File[]} [payload.files]             — observation photos
 * @param {string} [payload.caption]
 * @param {object[]} [payload.observationImages] — pre-hosted URL objects
 */
export const addCareNote = createAsyncThunk(
  'clinical/addCareNote',
  async ({ id, files, ...rest }, { rejectWithValue }) => {
    try {
      let res;
      if (files?.length) {
        res = await API.post(
          `${BASE}/care/records/${id}/notes`,
          toFormData({ files, ...rest }),
          multipartCfg,
        );
      } else {
        res = await API.post(`${BASE}/care/records/${id}/notes`, rest);
      }
      toast.success('Care note added.');
      return { id, note: res.data.note };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to add care note.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const resolveCareNote = createAsyncThunk(
  'clinical/resolveCareNote',
  async ({ id, noteId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/care/records/${id}/notes/${noteId}/resolve`);
      toast.success('Note resolved.');
      return { id, note: data.note };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resolve note.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Add hospital instruction — supports prescription scan attachment upload.
 *
 * @param {object} payload
 * @param {string} payload.id
 * @param {string} payload.instruction
 * @param {string} [payload.category]      — diet|mobility|medication|wound_care|general|emergency
 * @param {File[]} [payload.files]
 * @param {string} [payload.caption]
 * @param {object[]} [payload.attachments] — pre-hosted URL objects
 */
export const addInstruction = createAsyncThunk(
  'clinical/addInstruction',
  async ({ id, files, ...rest }, { rejectWithValue }) => {
    try {
      let res;
      if (files?.length) {
        res = await API.post(
          `${BASE}/care/records/${id}/instructions`,
          toFormData({ files, ...rest }),
          multipartCfg,
        );
      } else {
        res = await API.post(`${BASE}/care/records/${id}/instructions`, rest);
      }
      toast.success('Instruction added.');
      return { id, instruction: res.data.instruction };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to add instruction.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchInstructions = createAsyncThunk(
  'clinical/fetchInstructions',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/records/${id}/instructions`);
      return { id, instructions: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch instructions.');
    }
  }
);

export const dischargePatient = createAsyncThunk(
  'clinical/dischargePatient',
  async ({ id, dischargeNotes }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/care/records/${id}/discharge`, { dischargeNotes });
      toast.success('Patient discharged successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to discharge patient.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updateCareRecordStatus = createAsyncThunk(
  'clinical/updateCareRecordStatus',
  async ({ id, status, dischargeNotes }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/care/records/${id}/status`, { status, dischargeNotes });
      toast.success(`Care record status set to ${status}.`);
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update care record status.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
//  D2 — CARE RECORD UPLOADS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Push image(s) to an EXISTING log entry (positional S3 upload via backend).
 * Use when CA wants to add more photos to an already-created vitals/food/etc entry.
 *
 * @param {object} payload
 * @param {File[]} payload.files             — required
 * @param {string} [payload.recordId]        — care record _id
 * @param {string} [payload.bookingId]       — alt: resolves to active record
 * @param {'vitals'|'food'|'medicine'|'care_note'|'instruction'} payload.logType
 * @param {string} payload.entryId           — _id of subdoc entry to attach to
 * @param {string} [payload.caption]
 */
export const uploadToLogEntry = createAsyncThunk(
  'clinical/uploadToLogEntry',
  async ({ files, ...rest }, { rejectWithValue }) => {
    try {
      if (!files?.length) throw new Error('No files provided.');
      const { data } = await API.post(
        `${BASE}/care/records/upload`,
        toFormData({ files, standalone: 'false', ...rest }),
        multipartCfg,
      );
      toast.success('Images attached to entry.');
      return data; // { success, uploaded[], message }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Upload standalone document (prescription scan, lab report, KYC doc, discharge summary).
 * Syncs to Booking.documents + CustomerProfile.medicalTimeline (best-effort).
 *
 * @param {object} payload
 * @param {File[]} payload.files
 * @param {string} [payload.recordId]
 * @param {string} [payload.bookingId]
 * @param {'prescription'|'lab_report'|'discharge_summary'|'kyc'|'other'} [payload.docType]
 * @param {string} [payload.caption]
 */
export const uploadStandaloneDoc = createAsyncThunk(
  'clinical/uploadStandaloneDoc',
  async ({ files, ...rest }, { rejectWithValue }) => {
    try {
      if (!files?.length) throw new Error('No files provided.');
      const { data } = await API.post(
        `${BASE}/care/records/upload`,
        toFormData({ files, standalone: 'true', ...rest }),
        multipartCfg,
      );
      toast.success('Document uploaded successfully.');
      return data; // { success, uploaded[], message }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
//  E — ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

export const adminFetchPrescriptions = createAsyncThunk(
  'clinical/adminFetchPrescriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/prescriptions`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Admin: failed to fetch prescriptions.');
    }
  }
);

export const adminFetchOPRecords = createAsyncThunk(
  'clinical/adminFetchOPRecords',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/op-records`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Admin: failed to fetch OP records.');
    }
  }
);

export const adminFetchCareRecords = createAsyncThunk(
  'clinical/adminFetchCareRecords',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/care-records`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Admin: failed to fetch care records.');
    }
  }
);

export const adminFetchCareRecordById = createAsyncThunk(
  'clinical/adminFetchCareRecordById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/care-records/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Admin: failed to fetch care record.');
    }
  }
);

export const adminAssignCareAssistant = createAsyncThunk(
  'clinical/adminAssignCareAssistant',
  async ({ bookingId, careAssistantProfileId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/admin/bookings/${bookingId}/assign-ca`, {
        careAssistantProfileId,
      });
      toast.success('Care assistant reassigned.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reassign care assistant.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
//  F — DOCTOR DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchDoctorAppointments = createAsyncThunk(
  'clinical/fetchDoctorAppointments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/doctor/appointments`, { params });
      return data; // { total, page, data[] }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch appointments.');
    }
  }
);

// Reuses isAnyStaff route — doctor role check enforced server-side
export const fetchDoctorAppointmentById = createAsyncThunk(
  'clinical/fetchDoctorAppointmentById',
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/bookings/${bookingId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch appointment detail.');
    }
  }
);

export const fetchDoctorTodayAppointments = createAsyncThunk(
  'clinical/fetchDoctorTodayAppointments',
  async (_, { rejectWithValue }) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await API.get(`${BASE}/doctor/appointments`, {
        params: { from: today, to: today, limit: 100 },
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch today's appointments.");
    }
  }
);

export const fetchDoctorAvailability = createAsyncThunk(
  'clinical/fetchDoctorAvailability',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/doctor/availability`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch availability.');
    }
  }
);

export const updateDoctorAvailability = createAsyncThunk(
  'clinical/updateDoctorAvailability',
  async ({ weeklyAvailability, consultationTypes }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/doctor/availability`, {
        weeklyAvailability, consultationTypes,
      });
      toast.success('Availability updated.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update availability.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchDoctorEarnings = createAsyncThunk(
  'clinical/fetchDoctorEarnings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/doctor/earnings`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch earnings.');
    }
  }
);

export const fetchDoctorTransactions = createAsyncThunk(
  'clinical/fetchDoctorTransactions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/doctor/transactions`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch transactions.');
    }
  }
);

export const fetchDoctorInvoice = createAsyncThunk(
  'clinical/fetchDoctorInvoice',
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/doctor/invoices/${bookingId}`);
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch invoice.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
//  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // A — Prescriptions
  prescriptions:        [],
  prescriptionsTotal:   0,
  prescriptionsPage:    1,
  selectedPrescription: null,
  verifiedRx:           null,

  // B — OP Records
  opRecords:      [],
  opRecordsTotal: 0,
  opRecordsPage:  1,
  selectedOP:     null,

  // C — CA Bookings
  caBookings:        [],
  caBookingsTotal:   0,
  caBookingsPage:    1,
  caPendingBookings: [],
  selectedCABooking: null,

  // D — Care Records
  careRecords:        [],
  careRecordsTotal:   0,
  careRecordsPage:    1,
  activeCareRecord:   null,  // resolved by fetchActiveCareRecord (mount)
  selectedCareRecord: null,  // resolved by fetchCareRecordById (detail view)
  instructions:       {},    // { [recordId]: [] }

  // D2 — Uploads
  lastUploadedDocs: [], // most recent uploadStandaloneDoc result

  // E — Admin
  adminPrescriptions:      [],
  adminPrescriptionsTotal: 0,
  adminOPRecords:          [],
  adminOPRecordsTotal:     0,
  adminCareRecords:        [],
  adminCareRecordsTotal:   0,
  adminSelectedCareRecord: null,

  // F — Doctor Dashboard
  doctorAppointments:        [],
  doctorAppointmentsTotal:   0,
  doctorAppointmentsPage:    1,
  doctorTodayAppointments:   [],
  doctorTodayTotal:          0,
  selectedDoctorAppointment: null,
  doctorAvailability:        null,
  doctorEarnings:            null,
  doctorTransactions:        [],
  doctorTransactionsTotal:   0,
  doctorInvoice:             null,

  // Loading / Error maps
  loading: {},
  errors:  {},
};


// ═══════════════════════════════════════════════════════════════════════════════
//  SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const clinicalSlice = createSlice({
  name: 'clinical',
  initialState,

  reducers: {
    clearSelectedPrescription:      (s) => { s.selectedPrescription      = null; },
    clearVerifiedRx:                (s) => { s.verifiedRx                = null; },
    clearSelectedOP:                (s) => { s.selectedOP                = null; },
    clearSelectedCABooking:         (s) => { s.selectedCABooking         = null; },
    clearActiveCareRecord:          (s) => { s.activeCareRecord          = null; },
    clearSelectedCareRecord:        (s) => { s.selectedCareRecord        = null; },
    clearSelectedDoctorAppointment: (s) => { s.selectedDoctorAppointment = null; },
    clearClinicalErrors:            (s) => { s.errors                    = {};   },
    resetClinical:                  ()  => initialState,

    // Optimistic patch: update a single vitals entry's image list after uploadToLogEntry
    appendImagesToVitalsEntry: (s, { payload: { entryId, images } }) => {
      if (!s.selectedCareRecord?.vitalsLog) return;
      const entry = s.selectedCareRecord.vitalsLog.find((e) => e._id === entryId);
      if (entry) entry.evidenceImages = [...(entry.evidenceImages || []), ...images];
    },
    appendImagesToFoodEntry: (s, { payload: { entryId, images } }) => {
      if (!s.selectedCareRecord?.foodLog) return;
      const entry = s.selectedCareRecord.foodLog.find((e) => e._id === entryId);
      if (entry) entry.images = [...(entry.images || []), ...images];
    },
    appendImagesToMedEntry: (s, { payload: { entryId, images } }) => {
      if (!s.selectedCareRecord?.medicineLog) return;
      const entry = s.selectedCareRecord.medicineLog.find((e) => e._id === entryId);
      if (entry) entry.pillImages = [...(entry.pillImages || []), ...images];
    },
    appendImagesToNoteEntry: (s, { payload: { entryId, images } }) => {
      if (!s.selectedCareRecord?.careNotes) return;
      const entry = s.selectedCareRecord.careNotes.find((e) => e._id === entryId);
      if (entry) entry.observationImages = [...(entry.observationImages || []), ...images];
    },
  },

  extraReducers: (builder) => {

    // ── A. PRESCRIPTIONS ─────────────────────────────────────────────────────
    builder
      .addCase(createPrescription.pending,   (s)    => pending(s, 'createPrescription'))
      .addCase(createPrescription.rejected,  (s, a) => rejected(s, a, 'createPrescription'))
      .addCase(createPrescription.fulfilled, (s, { payload }) => {
        fulfilled(s, 'createPrescription');
        s.prescriptions.unshift(payload);
        s.selectedPrescription = payload;
      });

    builder
      .addCase(fetchPrescriptions.pending,   (s)    => pending(s, 'fetchPrescriptions'))
      .addCase(fetchPrescriptions.rejected,  (s, a) => rejected(s, a, 'fetchPrescriptions'))
      .addCase(fetchPrescriptions.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchPrescriptions');
        s.prescriptions      = payload.data;
        s.prescriptionsTotal = payload.total;
        s.prescriptionsPage  = payload.page;
      });

    builder
      .addCase(verifyPrescription.pending,   (s)    => pending(s, 'verifyPrescription'))
      .addCase(verifyPrescription.rejected,  (s, a) => rejected(s, a, 'verifyPrescription'))
      .addCase(verifyPrescription.fulfilled, (s, { payload }) => {
        fulfilled(s, 'verifyPrescription');
        s.verifiedRx = payload;
      });

    builder
      .addCase(fetchPrescriptionById.pending,   (s)    => pending(s, 'fetchPrescriptionById'))
      .addCase(fetchPrescriptionById.rejected,  (s, a) => rejected(s, a, 'fetchPrescriptionById'))
      .addCase(fetchPrescriptionById.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchPrescriptionById');
        s.selectedPrescription = payload;
      });

    builder
      .addCase(downloadPrescriptionPdf.pending,   (s)    => pending(s, 'downloadPrescriptionPdf'))
      .addCase(downloadPrescriptionPdf.rejected,  (s, a) => rejected(s, a, 'downloadPrescriptionPdf'))
      .addCase(downloadPrescriptionPdf.fulfilled, (s)    => fulfilled(s, 'downloadPrescriptionPdf'));

    builder
      .addCase(cancelPrescription.pending,   (s)    => pending(s, 'cancelPrescription'))
      .addCase(cancelPrescription.rejected,  (s, a) => rejected(s, a, 'cancelPrescription'))
      .addCase(cancelPrescription.fulfilled, (s, { payload }) => {
        fulfilled(s, 'cancelPrescription');
        const idx = s.prescriptions.findIndex((p) => p._id === payload._id);
        if (idx !== -1) s.prescriptions[idx] = payload;
        if (s.selectedPrescription?._id === payload._id) s.selectedPrescription = payload;
      });


    // ── B. OP RECORDS ────────────────────────────────────────────────────────
    builder
      .addCase(fetchOPRecords.pending,   (s)    => pending(s, 'fetchOPRecords'))
      .addCase(fetchOPRecords.rejected,  (s, a) => rejected(s, a, 'fetchOPRecords'))
      .addCase(fetchOPRecords.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchOPRecords');
        s.opRecords      = payload.data;
        s.opRecordsTotal = payload.total;
        s.opRecordsPage  = payload.page;
      });

    builder
      .addCase(fetchOPRecordById.pending,   (s)    => pending(s, 'fetchOPRecordById'))
      .addCase(fetchOPRecordById.rejected,  (s, a) => rejected(s, a, 'fetchOPRecordById'))
      .addCase(fetchOPRecordById.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchOPRecordById');
        s.selectedOP = payload;
      });

    builder
      .addCase(completeOPRecord.pending,   (s)    => pending(s, 'completeOPRecord'))
      .addCase(completeOPRecord.rejected,  (s, a) => rejected(s, a, 'completeOPRecord'))
      .addCase(completeOPRecord.fulfilled, (s, { payload }) => {
        fulfilled(s, 'completeOPRecord');
        const idx = s.opRecords.findIndex((o) => o._id === payload._id);
        if (idx !== -1) s.opRecords[idx] = payload;
        if (s.selectedOP?._id === payload._id) s.selectedOP = payload;
      });

    builder
      .addCase(updateOPStatus.pending,   (s)    => pending(s, 'updateOPStatus'))
      .addCase(updateOPStatus.rejected,  (s, a) => rejected(s, a, 'updateOPStatus'))
      .addCase(updateOPStatus.fulfilled, (s, { payload }) => {
        fulfilled(s, 'updateOPStatus');
        const idx = s.opRecords.findIndex((o) => o._id === payload._id);
        if (idx !== -1) s.opRecords[idx] = payload;
        if (s.selectedOP?._id === payload._id) s.selectedOP = payload;
      });


    // ── C. CA: BOOKINGS ──────────────────────────────────────────────────────
    builder
      .addCase(fetchCABookings.pending,   (s)    => pending(s, 'fetchCABookings'))
      .addCase(fetchCABookings.rejected,  (s, a) => rejected(s, a, 'fetchCABookings'))
      .addCase(fetchCABookings.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchCABookings');
        s.caBookings      = payload.data;
        s.caBookingsTotal = payload.total;
        s.caBookingsPage  = payload.page;
      });

    builder
      .addCase(fetchCAPendingBookings.pending,   (s)    => pending(s, 'fetchCAPendingBookings'))
      .addCase(fetchCAPendingBookings.rejected,  (s, a) => rejected(s, a, 'fetchCAPendingBookings'))
      .addCase(fetchCAPendingBookings.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchCAPendingBookings');
        s.caPendingBookings = payload;
      });

    builder
      .addCase(fetchCABookingById.pending,   (s)    => pending(s, 'fetchCABookingById'))
      .addCase(fetchCABookingById.rejected,  (s, a) => rejected(s, a, 'fetchCABookingById'))
      .addCase(fetchCABookingById.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchCABookingById');
        s.selectedCABooking = payload;
      });

    builder
      .addCase(acceptCABooking.pending,   (s)    => pending(s, 'acceptCABooking'))
      .addCase(acceptCABooking.rejected,  (s, a) => rejected(s, a, 'acceptCABooking'))
      .addCase(acceptCABooking.fulfilled, (s, { payload }) => {
        fulfilled(s, 'acceptCABooking');
        s.caPendingBookings = s.caPendingBookings.filter((b) => b._id !== payload.bookingId);
        const idx = s.caBookings.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) s.caBookings[idx].status = 'in_progress';
        s.careRecords.unshift(payload.careRecord);
        // Also populate activeCareRecord immediately so CA can start logging
        s.activeCareRecord = payload.careRecord;
      });

    builder
      .addCase(rejectCABooking.pending,   (s)    => pending(s, 'rejectCABooking'))
      .addCase(rejectCABooking.rejected,  (s, a) => rejected(s, a, 'rejectCABooking'))
      .addCase(rejectCABooking.fulfilled, (s, { payload: bookingId }) => {
        fulfilled(s, 'rejectCABooking');
        s.caPendingBookings = s.caPendingBookings.filter((b) => b._id !== bookingId);
        s.caBookings        = s.caBookings.filter((b) => b._id !== bookingId);
      });


    // ── D. CARE RECORDS ──────────────────────────────────────────────────────
    builder
      .addCase(fetchActiveCareRecord.pending,   (s)    => pending(s, 'fetchActiveCareRecord'))
      .addCase(fetchActiveCareRecord.rejected,  (s, a) => rejected(s, a, 'fetchActiveCareRecord'))
      .addCase(fetchActiveCareRecord.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchActiveCareRecord');
        s.activeCareRecord = payload;
      });

    builder
      .addCase(fetchCareRecords.pending,   (s)    => pending(s, 'fetchCareRecords'))
      .addCase(fetchCareRecords.rejected,  (s, a) => rejected(s, a, 'fetchCareRecords'))
      .addCase(fetchCareRecords.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchCareRecords');
        s.careRecords      = payload.data;
        s.careRecordsTotal = payload.total;
        s.careRecordsPage  = payload.page;
      });

    builder
      .addCase(fetchCareRecordById.pending,   (s)    => pending(s, 'fetchCareRecordById'))
      .addCase(fetchCareRecordById.rejected,  (s, a) => rejected(s, a, 'fetchCareRecordById'))
      .addCase(fetchCareRecordById.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchCareRecordById');
        s.selectedCareRecord = payload;
      });

    builder
      .addCase(logVitals.pending,   (s)    => pending(s, 'logVitals'))
      .addCase(logVitals.rejected,  (s, a) => rejected(s, a, 'logVitals'))
      .addCase(logVitals.fulfilled, (s, { payload }) => {
        fulfilled(s, 'logVitals');
        if (s.selectedCareRecord?._id === payload.id) {
          s.selectedCareRecord.vitalsLog.push(payload.entry);
        }
        if (s.activeCareRecord?._id === payload.id) {
          s.activeCareRecord.vitalsLog = s.activeCareRecord.vitalsLog ?? [];
          s.activeCareRecord.vitalsLog.push(payload.entry);
        }
      });

    builder
      .addCase(logFood.pending,   (s)    => pending(s, 'logFood'))
      .addCase(logFood.rejected,  (s, a) => rejected(s, a, 'logFood'))
      .addCase(logFood.fulfilled, (s, { payload }) => {
        fulfilled(s, 'logFood');
        if (s.selectedCareRecord?._id === payload.id) {
          s.selectedCareRecord.foodLog.push(payload.entry);
        }
        if (s.activeCareRecord?._id === payload.id) {
          s.activeCareRecord.foodLog = s.activeCareRecord.foodLog ?? [];
          s.activeCareRecord.foodLog.push(payload.entry);
        }
      });

    builder
      .addCase(logMedicine.pending,   (s)    => pending(s, 'logMedicine'))
      .addCase(logMedicine.rejected,  (s, a) => rejected(s, a, 'logMedicine'))
      .addCase(logMedicine.fulfilled, (s, { payload }) => {
        fulfilled(s, 'logMedicine');
        if (s.selectedCareRecord?._id === payload.id) {
          s.selectedCareRecord.medicineLog.push(payload.entry);
        }
        if (s.activeCareRecord?._id === payload.id) {
          s.activeCareRecord.medicineLog = s.activeCareRecord.medicineLog ?? [];
          s.activeCareRecord.medicineLog.push(payload.entry);
        }
      });

    builder
      .addCase(addCareNote.pending,   (s)    => pending(s, 'addCareNote'))
      .addCase(addCareNote.rejected,  (s, a) => rejected(s, a, 'addCareNote'))
      .addCase(addCareNote.fulfilled, (s, { payload }) => {
        fulfilled(s, 'addCareNote');
        if (s.selectedCareRecord?._id === payload.id) {
          s.selectedCareRecord.careNotes.push(payload.note);
        }
        if (s.activeCareRecord?._id === payload.id) {
          s.activeCareRecord.careNotes = s.activeCareRecord.careNotes ?? [];
          s.activeCareRecord.careNotes.push(payload.note);
        }
      });

    builder
      .addCase(resolveCareNote.pending,   (s)    => pending(s, 'resolveCareNote'))
      .addCase(resolveCareNote.rejected,  (s, a) => rejected(s, a, 'resolveCareNote'))
      .addCase(resolveCareNote.fulfilled, (s, { payload }) => {
        fulfilled(s, 'resolveCareNote');
        // Patch in both selected and active
        for (const rec of [s.selectedCareRecord, s.activeCareRecord]) {
          if (rec?._id === payload.id) {
            const note = rec.careNotes?.find((n) => n._id === payload.note._id);
            if (note) {
              note.isResolved = true;
              note.resolvedAt = payload.note.resolvedAt;
              note.resolvedBy = payload.note.resolvedBy;
            }
          }
        }
      });

    builder
      .addCase(addInstruction.pending,   (s)    => pending(s, 'addInstruction'))
      .addCase(addInstruction.rejected,  (s, a) => rejected(s, a, 'addInstruction'))
      .addCase(addInstruction.fulfilled, (s, { payload }) => {
        fulfilled(s, 'addInstruction');
        if (!s.instructions[payload.id]) s.instructions[payload.id] = [];
        s.instructions[payload.id].push(payload.instruction);
      });

    builder
      .addCase(fetchInstructions.pending,   (s)    => pending(s, 'fetchInstructions'))
      .addCase(fetchInstructions.rejected,  (s, a) => rejected(s, a, 'fetchInstructions'))
      .addCase(fetchInstructions.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchInstructions');
        s.instructions[payload.id] = payload.instructions;
      });

    builder
      .addCase(dischargePatient.pending,   (s)    => pending(s, 'dischargePatient'))
      .addCase(dischargePatient.rejected,  (s, a) => rejected(s, a, 'dischargePatient'))
      .addCase(dischargePatient.fulfilled, (s, { payload }) => {
        fulfilled(s, 'dischargePatient');
        const idx = s.careRecords.findIndex((r) => r._id === payload._id);
        if (idx !== -1) s.careRecords[idx] = payload;
        if (s.selectedCareRecord?._id === payload._id) s.selectedCareRecord = payload;
        // Clear activeCareRecord — patient is gone
        if (s.activeCareRecord?._id === payload._id) s.activeCareRecord = null;
      });

    builder
      .addCase(updateCareRecordStatus.pending,   (s)    => pending(s, 'updateCareRecordStatus'))
      .addCase(updateCareRecordStatus.rejected,  (s, a) => rejected(s, a, 'updateCareRecordStatus'))
      .addCase(updateCareRecordStatus.fulfilled, (s, { payload }) => {
        fulfilled(s, 'updateCareRecordStatus');
        const idx = s.careRecords.findIndex((r) => r._id === payload._id);
        if (idx !== -1) s.careRecords[idx] = payload;
        if (s.selectedCareRecord?._id === payload._id) s.selectedCareRecord = payload;
        if (s.activeCareRecord?._id   === payload._id) s.activeCareRecord   = payload;
        const aidx = s.adminCareRecords.findIndex((r) => r._id === payload._id);
        if (aidx !== -1) s.adminCareRecords[aidx] = payload;
      });


    // ── D2. UPLOADS ──────────────────────────────────────────────────────────
    builder
      .addCase(uploadToLogEntry.pending,   (s)    => pending(s, 'uploadToLogEntry'))
      .addCase(uploadToLogEntry.rejected,  (s, a) => rejected(s, a, 'uploadToLogEntry'))
      .addCase(uploadToLogEntry.fulfilled, (s)    => fulfilled(s, 'uploadToLogEntry'));
      // Optimistic image patching done via appendImages* sync actions above

    builder
      .addCase(uploadStandaloneDoc.pending,   (s)    => pending(s, 'uploadStandaloneDoc'))
      .addCase(uploadStandaloneDoc.rejected,  (s, a) => rejected(s, a, 'uploadStandaloneDoc'))
      .addCase(uploadStandaloneDoc.fulfilled, (s, { payload }) => {
        fulfilled(s, 'uploadStandaloneDoc');
        s.lastUploadedDocs = payload.uploaded || [];
      });


    // ── E. ADMIN ─────────────────────────────────────────────────────────────
    builder
      .addCase(adminFetchPrescriptions.pending,   (s)    => pending(s, 'adminFetchPrescriptions'))
      .addCase(adminFetchPrescriptions.rejected,  (s, a) => rejected(s, a, 'adminFetchPrescriptions'))
      .addCase(adminFetchPrescriptions.fulfilled, (s, { payload }) => {
        fulfilled(s, 'adminFetchPrescriptions');
        s.adminPrescriptions      = payload.data;
        s.adminPrescriptionsTotal = payload.total;
      });

    builder
      .addCase(adminFetchOPRecords.pending,   (s)    => pending(s, 'adminFetchOPRecords'))
      .addCase(adminFetchOPRecords.rejected,  (s, a) => rejected(s, a, 'adminFetchOPRecords'))
      .addCase(adminFetchOPRecords.fulfilled, (s, { payload }) => {
        fulfilled(s, 'adminFetchOPRecords');
        s.adminOPRecords      = payload.data;
        s.adminOPRecordsTotal = payload.total;
      });

    builder
      .addCase(adminFetchCareRecords.pending,   (s)    => pending(s, 'adminFetchCareRecords'))
      .addCase(adminFetchCareRecords.rejected,  (s, a) => rejected(s, a, 'adminFetchCareRecords'))
      .addCase(adminFetchCareRecords.fulfilled, (s, { payload }) => {
        fulfilled(s, 'adminFetchCareRecords');
        s.adminCareRecords      = payload.data;
        s.adminCareRecordsTotal = payload.total;
      });

    builder
      .addCase(adminFetchCareRecordById.pending,   (s)    => pending(s, 'adminFetchCareRecordById'))
      .addCase(adminFetchCareRecordById.rejected,  (s, a) => rejected(s, a, 'adminFetchCareRecordById'))
      .addCase(adminFetchCareRecordById.fulfilled, (s, { payload }) => {
        fulfilled(s, 'adminFetchCareRecordById');
        s.adminSelectedCareRecord = payload;
      });

    builder
      .addCase(adminAssignCareAssistant.pending,   (s)    => pending(s, 'adminAssignCareAssistant'))
      .addCase(adminAssignCareAssistant.rejected,  (s, a) => rejected(s, a, 'adminAssignCareAssistant'))
      .addCase(adminAssignCareAssistant.fulfilled, (s, { payload }) => {
        fulfilled(s, 'adminAssignCareAssistant');
        const idx = s.caBookings.findIndex((b) => b._id === payload._id);
        if (idx !== -1) s.caBookings[idx] = payload;
      });


    // ── F. DOCTOR DASHBOARD ──────────────────────────────────────────────────
    builder
      .addCase(fetchDoctorAppointments.pending,   (s)    => pending(s, 'fetchDoctorAppointments'))
      .addCase(fetchDoctorAppointments.rejected,  (s, a) => rejected(s, a, 'fetchDoctorAppointments'))
      .addCase(fetchDoctorAppointments.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchDoctorAppointments');
        s.doctorAppointments      = payload.data;
        s.doctorAppointmentsTotal = payload.total;
        s.doctorAppointmentsPage  = payload.page;
      });

    builder
      .addCase(fetchDoctorAppointmentById.pending,   (s)    => pending(s, 'fetchDoctorAppointmentById'))
      .addCase(fetchDoctorAppointmentById.rejected,  (s, a) => rejected(s, a, 'fetchDoctorAppointmentById'))
      .addCase(fetchDoctorAppointmentById.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchDoctorAppointmentById');
        s.selectedDoctorAppointment = payload;
      });

    builder
      .addCase(fetchDoctorTodayAppointments.pending,   (s)    => pending(s, 'fetchDoctorTodayAppointments'))
      .addCase(fetchDoctorTodayAppointments.rejected,  (s, a) => rejected(s, a, 'fetchDoctorTodayAppointments'))
      .addCase(fetchDoctorTodayAppointments.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchDoctorTodayAppointments');
        s.doctorTodayAppointments = payload.data;
        s.doctorTodayTotal        = payload.total;
      });

    builder
      .addCase(fetchDoctorAvailability.pending,   (s)    => pending(s, 'fetchDoctorAvailability'))
      .addCase(fetchDoctorAvailability.rejected,  (s, a) => rejected(s, a, 'fetchDoctorAvailability'))
      .addCase(fetchDoctorAvailability.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchDoctorAvailability');
        s.doctorAvailability = payload;
      });

    builder
      .addCase(updateDoctorAvailability.pending,   (s)    => pending(s, 'updateDoctorAvailability'))
      .addCase(updateDoctorAvailability.rejected,  (s, a) => rejected(s, a, 'updateDoctorAvailability'))
      .addCase(updateDoctorAvailability.fulfilled, (s, { payload }) => {
        fulfilled(s, 'updateDoctorAvailability');
        s.doctorAvailability = payload;
      });

    builder
      .addCase(fetchDoctorEarnings.pending,   (s)    => pending(s, 'fetchDoctorEarnings'))
      .addCase(fetchDoctorEarnings.rejected,  (s, a) => rejected(s, a, 'fetchDoctorEarnings'))
      .addCase(fetchDoctorEarnings.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchDoctorEarnings');
        s.doctorEarnings = payload;
      });

    builder
      .addCase(fetchDoctorTransactions.pending,   (s)    => pending(s, 'fetchDoctorTransactions'))
      .addCase(fetchDoctorTransactions.rejected,  (s, a) => rejected(s, a, 'fetchDoctorTransactions'))
      .addCase(fetchDoctorTransactions.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchDoctorTransactions');
        s.doctorTransactions      = payload.data;
        s.doctorTransactionsTotal = payload.total;
      });

    builder
      .addCase(fetchDoctorInvoice.pending,   (s)    => pending(s, 'fetchDoctorInvoice'))
      .addCase(fetchDoctorInvoice.rejected,  (s, a) => rejected(s, a, 'fetchDoctorInvoice'))
      .addCase(fetchDoctorInvoice.fulfilled, (s, { payload }) => {
        fulfilled(s, 'fetchDoctorInvoice');
        s.doctorInvoice = payload;
      });
  },
});


// ─── Actions ──────────────────────────────────────────────────────────────────
export const {
  clearSelectedPrescription,
  clearVerifiedRx,
  clearSelectedOP,
  clearSelectedCABooking,
  clearActiveCareRecord,
  clearSelectedCareRecord,
  clearSelectedDoctorAppointment,
  clearClinicalErrors,
  resetClinical,
  appendImagesToVitalsEntry,
  appendImagesToFoodEntry,
  appendImagesToMedEntry,
  appendImagesToNoteEntry,
} = clinicalSlice.actions;


// ─── Selectors ────────────────────────────────────────────────────────────────

// A — Prescriptions
export const selectPrescriptions        = (s) => s.clinical.prescriptions;
export const selectPrescriptionsTotal   = (s) => s.clinical.prescriptionsTotal;
export const selectSelectedPrescription = (s) => s.clinical.selectedPrescription;
export const selectVerifiedRx           = (s) => s.clinical.verifiedRx;

// B — OP Records
export const selectOPRecords      = (s) => s.clinical.opRecords;
export const selectOPRecordsTotal = (s) => s.clinical.opRecordsTotal;
export const selectSelectedOP     = (s) => s.clinical.selectedOP;

// C — CA Bookings
export const selectCABookings        = (s) => s.clinical.caBookings;
export const selectCABookingsTotal   = (s) => s.clinical.caBookingsTotal;
export const selectCAPendingBookings = (s) => s.clinical.caPendingBookings;
export const selectSelectedCABooking = (s) => s.clinical.selectedCABooking;
export const selectCAPendingCount    = (s) => s.clinical.caPendingBookings.length;

// D — Care Records
export const selectCareRecords        = (s) => s.clinical.careRecords;
export const selectCareRecordsTotal   = (s) => s.clinical.careRecordsTotal;
export const selectActiveCareRecord   = (s) => s.clinical.activeCareRecord;
export const selectSelectedCareRecord = (s) => s.clinical.selectedCareRecord;
export const selectInstructionsFor    = (id) => (s) => s.clinical.instructions[id] || [];
export const selectLastUploadedDocs   = (s) => s.clinical.lastUploadedDocs;

// E — Admin
export const selectAdminPrescriptions      = (s) => s.clinical.adminPrescriptions;
export const selectAdminPrescriptionsTotal = (s) => s.clinical.adminPrescriptionsTotal;
export const selectAdminOPRecords          = (s) => s.clinical.adminOPRecords;
export const selectAdminOPRecordsTotal     = (s) => s.clinical.adminOPRecordsTotal;
export const selectAdminCareRecords        = (s) => s.clinical.adminCareRecords;
export const selectAdminCareRecordsTotal   = (s) => s.clinical.adminCareRecordsTotal;
export const selectAdminSelectedCareRecord = (s) => s.clinical.adminSelectedCareRecord;

// F — Doctor Dashboard
export const selectDoctorAppointments        = (s) => s.clinical.doctorAppointments;
export const selectDoctorAppointmentsTotal   = (s) => s.clinical.doctorAppointmentsTotal;
export const selectDoctorAppointmentsPage    = (s) => s.clinical.doctorAppointmentsPage;
export const selectDoctorTodayAppointments   = (s) => s.clinical.doctorTodayAppointments;
export const selectDoctorTodayTotal          = (s) => s.clinical.doctorTodayTotal;
export const selectSelectedDoctorAppointment = (s) => s.clinical.selectedDoctorAppointment;
export const selectDoctorAvailability        = (s) => s.clinical.doctorAvailability;
export const selectDoctorEarnings            = (s) => s.clinical.doctorEarnings;
export const selectDoctorTransactions        = (s) => s.clinical.doctorTransactions;
export const selectDoctorTransactionsTotal   = (s) => s.clinical.doctorTransactionsTotal;
export const selectDoctorInvoice             = (s) => s.clinical.doctorInvoice;

// Derived care record helpers — work on both active and selected
export const selectLatestVitals = (s) => {
  const rec = s.clinical.selectedCareRecord ?? s.clinical.activeCareRecord;
  if (!rec?.vitalsLog?.length) return null;
  return rec.vitalsLog[rec.vitalsLog.length - 1];
};
export const selectOpenAlerts = (s) => {
  const rec = s.clinical.selectedCareRecord ?? s.clinical.activeCareRecord;
  return (rec?.careNotes || []).filter((n) => n.severity === 'critical' && !n.isResolved);
};
export const selectTodaysMissedMeds = (s) => {
  const rec = s.clinical.selectedCareRecord ?? s.clinical.activeCareRecord;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (rec?.medicineLog || []).filter(
    (m) => m.status === 'missed' && new Date(m.scheduledAt) >= today
  );
};

// Loading / Error
export const selectClinicalLoading = (key) => (s) => !!s.clinical.loading[key];
export const selectClinicalError   = (key) => (s) => s.clinical.errors[key] || null;

export default clinicalSlice.reducer;