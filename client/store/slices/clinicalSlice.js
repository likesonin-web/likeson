/**
 * clinicalSlice.js
 * Likeson.in — Redux Toolkit slice
 * Covers ALL routes in prescriptionCareRouter.js
 *
 * Mount: store.js → import clinicalReducer from './slices/clinicalSlice'
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─── Base path ────────────────────────────────────────────────────────────────
const BASE = '/clinical';

// ─── Thunk factory helpers ────────────────────────────────────────────────────
const pending  = (state, key)        => { state.loading[key] = true;  state.errors[key] = null; };
const rejected = (state, action, key) => {
  state.loading[key] = false;
  state.errors[key]  = action.payload;
};
const fulfilled = (state, key) => { state.loading[key] = false; state.errors[key] = null; };


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION A — PRESCRIPTIONS
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
      const msg = err.response?.data?.message || 'Failed to fetch prescriptions.';
      return rejectWithValue(msg);
    }
  }
);

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
      const msg = err.response?.data?.message || 'Failed to fetch prescription.';
      return rejectWithValue(msg);
    }
  }
);

/**
 * downloadPrescriptionPdf
 * Opens PDF in a new tab via blob URL.
 */
export const downloadPrescriptionPdf = createAsyncThunk(
  'clinical/downloadPrescriptionPdf',
  async (id, { rejectWithValue }) => {
    try {
      const response = await API.get(`${BASE}/prescriptions/${id}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' })
      );
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
//  SECTION B — OP RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchOPRecords = createAsyncThunk(
  'clinical/fetchOPRecords',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/op-records`, { params });
      return data; // { total, page, data[] }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch OP records.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Failed to fetch OP record.';
      return rejectWithValue(msg);
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
//  SECTION C — CARE ASSISTANT: BOOKINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchCABookings = createAsyncThunk(
  'clinical/fetchCABookings',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/bookings`, { params });
      return data; // { total, page, data[] }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch bookings.';
      return rejectWithValue(msg);
    }
  }
);

export const fetchCAPendingBookings = createAsyncThunk(
  'clinical/fetchCAPendingBookings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/bookings/pending`);
      return data.data; // []
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch pending bookings.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Failed to fetch booking detail.';
      return rejectWithValue(msg);
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
//  SECTION D — CARE ASSISTANT: CARE RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchCareRecords = createAsyncThunk(
  'clinical/fetchCareRecords',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/care/records`, { params });
      return data; // { total, page, data[] }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch care records.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Failed to fetch care record.';
      return rejectWithValue(msg);
    }
  }
);

export const logVitals = createAsyncThunk(
  'clinical/logVitals',
  async ({ id, ...vitalsBody }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/care/records/${id}/vitals`, vitalsBody);
      toast.success('Vitals recorded.');
      return { id, entry: data.latest };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log vitals.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const logFood = createAsyncThunk(
  'clinical/logFood',
  async ({ id, ...foodBody }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/care/records/${id}/food`, foodBody);
      toast.success('Food entry logged.');
      return { id, entry: data.entry };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log food entry.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const logMedicine = createAsyncThunk(
  'clinical/logMedicine',
  async ({ id, ...medBody }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/care/records/${id}/medicine-log`, medBody);
      toast.success('Medicine administration logged.');
      return { id, entry: data.entry };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log medicine.';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const addCareNote = createAsyncThunk(
  'clinical/addCareNote',
  async ({ id, note, category, severity, observationImages }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/care/records/${id}/notes`, {
        note, category, severity, observationImages,
      });
      toast.success('Care note added.');
      return { id, note: data.note };
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

export const addInstruction = createAsyncThunk(
  'clinical/addInstruction',
  async ({ id, instruction, category, attachments }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/care/records/${id}/instructions`, {
        instruction, category, attachments,
      });
      toast.success('Instruction added.');
      return { id, instruction: data.instruction };
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
      const msg = err.response?.data?.message || 'Failed to fetch instructions.';
      return rejectWithValue(msg);
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
//  SECTION E — ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

export const adminFetchPrescriptions = createAsyncThunk(
  'clinical/adminFetchPrescriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/prescriptions`, { params });
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Admin: failed to fetch prescriptions.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Admin: failed to fetch OP records.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Admin: failed to fetch care records.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Admin: failed to fetch care record.';
      return rejectWithValue(msg);
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


// ═══════════════════════════════════════════════════════════════════════════
//  SECTION F — DOCTOR DASHBOARD (NEW — add to existing thunks)
// ═══════════════════════════════════════════════════════════════════════════

export const fetchDoctorAppointments = createAsyncThunk(
  'clinical/fetchDoctorAppointments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/doctor/appointments`, { params });
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch appointments.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Failed to fetch availability.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Failed to fetch earnings.';
      return rejectWithValue(msg);
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
      const msg = err.response?.data?.message || 'Failed to fetch transactions.';
      return rejectWithValue(msg);
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
  // ── Prescriptions ──────────────────────────────────────────────────────────
  prescriptions:        [],
  prescriptionsTotal:   0,
  prescriptionsPage:    1,
  selectedPrescription: null,
  verifiedRx:           null,

  // ── OP Records ─────────────────────────────────────────────────────────────
  opRecords:      [],
  opRecordsTotal: 0,
  opRecordsPage:  1,
  selectedOP:     null,

  // ── CA: Bookings ───────────────────────────────────────────────────────────
  caBookings:        [],
  caBookingsTotal:   0,
  caBookingsPage:    1,
  caPendingBookings: [],
  selectedCABooking: null,

  // ── CA: Care Records ───────────────────────────────────────────────────────
  careRecords:        [],
  careRecordsTotal:   0,
  careRecordsPage:    1,
  selectedCareRecord: null,
  // Instructions are stored per record id
  instructions: {},   // { [recordId]: [] }

  // ── Admin ──────────────────────────────────────────────────────────────────
  adminPrescriptions:      [],
  adminPrescriptionsTotal: 0,
  adminOPRecords:          [],
  adminOPRecordsTotal:     0,
  adminCareRecords:        [],
  adminCareRecordsTotal:   0,
  adminSelectedCareRecord: null,

  doctorAppointments:      [],
doctorAppointmentsTotal: 0,
doctorAppointmentsPage:  1,
doctorAvailability:      null,
doctorEarnings:          null,
doctorTransactions:      [],
doctorTransactionsTotal: 0,
doctorInvoice:           null,

  // ── Loading / Error maps ───────────────────────────────────────────────────
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
    clearSelectedPrescription: (state) => { state.selectedPrescription = null; },
    clearVerifiedRx:           (state) => { state.verifiedRx           = null; },
    clearSelectedOP:           (state) => { state.selectedOP           = null; },
    clearSelectedCABooking:    (state) => { state.selectedCABooking    = null; },
    clearSelectedCareRecord:   (state) => { state.selectedCareRecord   = null; },
    clearClinicalErrors:       (state) => { state.errors               = {};   },
    resetClinical:             ()      => initialState,
  },

  extraReducers: (builder) => {

    // ── A. PRESCRIPTIONS ─────────────────────────────────────────────────────

    // createPrescription
    builder
      .addCase(createPrescription.pending,   (state) => pending(state, 'createPrescription'))
      .addCase(createPrescription.rejected,  (state, a) => rejected(state, a, 'createPrescription'))
      .addCase(createPrescription.fulfilled, (state, { payload }) => {
        fulfilled(state, 'createPrescription');
        state.prescriptions.unshift(payload);
        state.selectedPrescription = payload;
      });

    // fetchPrescriptions
    builder
      .addCase(fetchPrescriptions.pending,   (state) => pending(state, 'fetchPrescriptions'))
      .addCase(fetchPrescriptions.rejected,  (state, a) => rejected(state, a, 'fetchPrescriptions'))
      .addCase(fetchPrescriptions.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchPrescriptions');
        state.prescriptions      = payload.data;
        state.prescriptionsTotal = payload.total;
        state.prescriptionsPage  = payload.page;
      });

    // verifyPrescription
    builder
      .addCase(verifyPrescription.pending,   (state) => pending(state, 'verifyPrescription'))
      .addCase(verifyPrescription.rejected,  (state, a) => rejected(state, a, 'verifyPrescription'))
      .addCase(verifyPrescription.fulfilled, (state, { payload }) => {
        fulfilled(state, 'verifyPrescription');
        state.verifiedRx = payload;
      });

    // fetchPrescriptionById
    builder
      .addCase(fetchPrescriptionById.pending,   (state) => pending(state, 'fetchPrescriptionById'))
      .addCase(fetchPrescriptionById.rejected,  (state, a) => rejected(state, a, 'fetchPrescriptionById'))
      .addCase(fetchPrescriptionById.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchPrescriptionById');
        state.selectedPrescription = payload;
      });

    // downloadPrescriptionPdf
    builder
      .addCase(downloadPrescriptionPdf.pending,   (state) => pending(state, 'downloadPrescriptionPdf'))
      .addCase(downloadPrescriptionPdf.rejected,  (state, a) => rejected(state, a, 'downloadPrescriptionPdf'))
      .addCase(downloadPrescriptionPdf.fulfilled, (state) => fulfilled(state, 'downloadPrescriptionPdf'));

    // cancelPrescription
    builder
      .addCase(cancelPrescription.pending,   (state) => pending(state, 'cancelPrescription'))
      .addCase(cancelPrescription.rejected,  (state, a) => rejected(state, a, 'cancelPrescription'))
      .addCase(cancelPrescription.fulfilled, (state, { payload }) => {
        fulfilled(state, 'cancelPrescription');
        // Update in list
        const idx = state.prescriptions.findIndex((p) => p._id === payload._id);
        if (idx !== -1) state.prescriptions[idx] = payload;
        if (state.selectedPrescription?._id === payload._id) state.selectedPrescription = payload;
      });


    // ── B. OP RECORDS ────────────────────────────────────────────────────────

    builder
      .addCase(fetchOPRecords.pending,   (state) => pending(state, 'fetchOPRecords'))
      .addCase(fetchOPRecords.rejected,  (state, a) => rejected(state, a, 'fetchOPRecords'))
      .addCase(fetchOPRecords.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchOPRecords');
        state.opRecords      = payload.data;
        state.opRecordsTotal = payload.total;
        state.opRecordsPage  = payload.page;
      });

    builder
      .addCase(fetchOPRecordById.pending,   (state) => pending(state, 'fetchOPRecordById'))
      .addCase(fetchOPRecordById.rejected,  (state, a) => rejected(state, a, 'fetchOPRecordById'))
      .addCase(fetchOPRecordById.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchOPRecordById');
        state.selectedOP = payload;
      });

    builder
      .addCase(completeOPRecord.pending,   (state) => pending(state, 'completeOPRecord'))
      .addCase(completeOPRecord.rejected,  (state, a) => rejected(state, a, 'completeOPRecord'))
      .addCase(completeOPRecord.fulfilled, (state, { payload }) => {
        fulfilled(state, 'completeOPRecord');
        const idx = state.opRecords.findIndex((o) => o._id === payload._id);
        if (idx !== -1) state.opRecords[idx] = payload;
        if (state.selectedOP?._id === payload._id) state.selectedOP = payload;
      });

    builder
      .addCase(updateOPStatus.pending,   (state) => pending(state, 'updateOPStatus'))
      .addCase(updateOPStatus.rejected,  (state, a) => rejected(state, a, 'updateOPStatus'))
      .addCase(updateOPStatus.fulfilled, (state, { payload }) => {
        fulfilled(state, 'updateOPStatus');
        const idx = state.opRecords.findIndex((o) => o._id === payload._id);
        if (idx !== -1) state.opRecords[idx] = payload;
        if (state.selectedOP?._id === payload._id) state.selectedOP = payload;
      });


    // ── C. CA: BOOKINGS ──────────────────────────────────────────────────────

    builder
      .addCase(fetchCABookings.pending,   (state) => pending(state, 'fetchCABookings'))
      .addCase(fetchCABookings.rejected,  (state, a) => rejected(state, a, 'fetchCABookings'))
      .addCase(fetchCABookings.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchCABookings');
        state.caBookings      = payload.data;
        state.caBookingsTotal = payload.total;
        state.caBookingsPage  = payload.page;
      });

    builder
      .addCase(fetchCAPendingBookings.pending,   (state) => pending(state, 'fetchCAPendingBookings'))
      .addCase(fetchCAPendingBookings.rejected,  (state, a) => rejected(state, a, 'fetchCAPendingBookings'))
      .addCase(fetchCAPendingBookings.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchCAPendingBookings');
        state.caPendingBookings = payload;
      });

    builder
      .addCase(fetchCABookingById.pending,   (state) => pending(state, 'fetchCABookingById'))
      .addCase(fetchCABookingById.rejected,  (state, a) => rejected(state, a, 'fetchCABookingById'))
      .addCase(fetchCABookingById.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchCABookingById');
        state.selectedCABooking = payload;
      });

    builder
      .addCase(acceptCABooking.pending,   (state) => pending(state, 'acceptCABooking'))
      .addCase(acceptCABooking.rejected,  (state, a) => rejected(state, a, 'acceptCABooking'))
      .addCase(acceptCABooking.fulfilled, (state, { payload }) => {
        fulfilled(state, 'acceptCABooking');
        // Remove from pending list
        state.caPendingBookings = state.caPendingBookings.filter(
          (b) => b._id !== payload.bookingId
        );
        // Update in main bookings list if present
        const idx = state.caBookings.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.caBookings[idx].status = 'in_progress';
        // Push new care record into list
        state.careRecords.unshift(payload.careRecord);
      });

    builder
      .addCase(rejectCABooking.pending,   (state) => pending(state, 'rejectCABooking'))
      .addCase(rejectCABooking.rejected,  (state, a) => rejected(state, a, 'rejectCABooking'))
      .addCase(rejectCABooking.fulfilled, (state, { payload: bookingId }) => {
        fulfilled(state, 'rejectCABooking');
        state.caPendingBookings = state.caPendingBookings.filter((b) => b._id !== bookingId);
        state.caBookings        = state.caBookings.filter((b) => b._id !== bookingId);
      });


    // ── D. CA: CARE RECORDS ──────────────────────────────────────────────────

    builder
      .addCase(fetchCareRecords.pending,   (state) => pending(state, 'fetchCareRecords'))
      .addCase(fetchCareRecords.rejected,  (state, a) => rejected(state, a, 'fetchCareRecords'))
      .addCase(fetchCareRecords.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchCareRecords');
        state.careRecords      = payload.data;
        state.careRecordsTotal = payload.total;
        state.careRecordsPage  = payload.page;
      });

    builder
      .addCase(fetchCareRecordById.pending,   (state) => pending(state, 'fetchCareRecordById'))
      .addCase(fetchCareRecordById.rejected,  (state, a) => rejected(state, a, 'fetchCareRecordById'))
      .addCase(fetchCareRecordById.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchCareRecordById');
        state.selectedCareRecord = payload;
      });

    builder
      .addCase(logVitals.pending,   (state) => pending(state, 'logVitals'))
      .addCase(logVitals.rejected,  (state, a) => rejected(state, a, 'logVitals'))
      .addCase(logVitals.fulfilled, (state, { payload }) => {
        fulfilled(state, 'logVitals');
        if (state.selectedCareRecord?._id === payload.id) {
          state.selectedCareRecord.vitalsLog.push(payload.entry);
        }
      });

    builder
      .addCase(logFood.pending,   (state) => pending(state, 'logFood'))
      .addCase(logFood.rejected,  (state, a) => rejected(state, a, 'logFood'))
      .addCase(logFood.fulfilled, (state, { payload }) => {
        fulfilled(state, 'logFood');
        if (state.selectedCareRecord?._id === payload.id) {
          state.selectedCareRecord.foodLog.push(payload.entry);
        }
      });

    builder
      .addCase(logMedicine.pending,   (state) => pending(state, 'logMedicine'))
      .addCase(logMedicine.rejected,  (state, a) => rejected(state, a, 'logMedicine'))
      .addCase(logMedicine.fulfilled, (state, { payload }) => {
        fulfilled(state, 'logMedicine');
        if (state.selectedCareRecord?._id === payload.id) {
          state.selectedCareRecord.medicineLog.push(payload.entry);
        }
      });

    builder
      .addCase(addCareNote.pending,   (state) => pending(state, 'addCareNote'))
      .addCase(addCareNote.rejected,  (state, a) => rejected(state, a, 'addCareNote'))
      .addCase(addCareNote.fulfilled, (state, { payload }) => {
        fulfilled(state, 'addCareNote');
        if (state.selectedCareRecord?._id === payload.id) {
          state.selectedCareRecord.careNotes.push(payload.note);
        }
      });

    builder
      .addCase(resolveCareNote.pending,   (state) => pending(state, 'resolveCareNote'))
      .addCase(resolveCareNote.rejected,  (state, a) => rejected(state, a, 'resolveCareNote'))
      .addCase(resolveCareNote.fulfilled, (state, { payload }) => {
        fulfilled(state, 'resolveCareNote');
        if (state.selectedCareRecord?._id === payload.id) {
          const note = state.selectedCareRecord.careNotes.find(
            (n) => n._id === payload.note._id
          );
          if (note) {
            note.isResolved = true;
            note.resolvedAt = payload.note.resolvedAt;
          }
        }
      });

    builder
      .addCase(addInstruction.pending,   (state) => pending(state, 'addInstruction'))
      .addCase(addInstruction.rejected,  (state, a) => rejected(state, a, 'addInstruction'))
      .addCase(addInstruction.fulfilled, (state, { payload }) => {
        fulfilled(state, 'addInstruction');
        if (!state.instructions[payload.id]) state.instructions[payload.id] = [];
        state.instructions[payload.id].push(payload.instruction);
      });

    builder
      .addCase(fetchInstructions.pending,   (state) => pending(state, 'fetchInstructions'))
      .addCase(fetchInstructions.rejected,  (state, a) => rejected(state, a, 'fetchInstructions'))
      .addCase(fetchInstructions.fulfilled, (state, { payload }) => {
        fulfilled(state, 'fetchInstructions');
        state.instructions[payload.id] = payload.instructions;
      });

    builder
      .addCase(dischargePatient.pending,   (state) => pending(state, 'dischargePatient'))
      .addCase(dischargePatient.rejected,  (state, a) => rejected(state, a, 'dischargePatient'))
      .addCase(dischargePatient.fulfilled, (state, { payload }) => {
        fulfilled(state, 'dischargePatient');
        // Update in list
        const idx = state.careRecords.findIndex((r) => r._id === payload._id);
        if (idx !== -1) state.careRecords[idx] = payload;
        if (state.selectedCareRecord?._id === payload._id) state.selectedCareRecord = payload;
      });

    builder
      .addCase(updateCareRecordStatus.pending,   (state) => pending(state, 'updateCareRecordStatus'))
      .addCase(updateCareRecordStatus.rejected,  (state, a) => rejected(state, a, 'updateCareRecordStatus'))
      .addCase(updateCareRecordStatus.fulfilled, (state, { payload }) => {
        fulfilled(state, 'updateCareRecordStatus');
        const idx = state.careRecords.findIndex((r) => r._id === payload._id);
        if (idx !== -1) state.careRecords[idx] = payload;
        if (state.selectedCareRecord?._id === payload._id) state.selectedCareRecord = payload;
        // Admin list too
        const aidx = state.adminCareRecords.findIndex((r) => r._id === payload._id);
        if (aidx !== -1) state.adminCareRecords[aidx] = payload;
      });


    // ── E. ADMIN ─────────────────────────────────────────────────────────────

    builder
      .addCase(adminFetchPrescriptions.pending,   (state) => pending(state, 'adminFetchPrescriptions'))
      .addCase(adminFetchPrescriptions.rejected,  (state, a) => rejected(state, a, 'adminFetchPrescriptions'))
      .addCase(adminFetchPrescriptions.fulfilled, (state, { payload }) => {
        fulfilled(state, 'adminFetchPrescriptions');
        state.adminPrescriptions      = payload.data;
        state.adminPrescriptionsTotal = payload.total;
      });

    builder
      .addCase(adminFetchOPRecords.pending,   (state) => pending(state, 'adminFetchOPRecords'))
      .addCase(adminFetchOPRecords.rejected,  (state, a) => rejected(state, a, 'adminFetchOPRecords'))
      .addCase(adminFetchOPRecords.fulfilled, (state, { payload }) => {
        fulfilled(state, 'adminFetchOPRecords');
        state.adminOPRecords      = payload.data;
        state.adminOPRecordsTotal = payload.total;
      });

    builder
      .addCase(adminFetchCareRecords.pending,   (state) => pending(state, 'adminFetchCareRecords'))
      .addCase(adminFetchCareRecords.rejected,  (state, a) => rejected(state, a, 'adminFetchCareRecords'))
      .addCase(adminFetchCareRecords.fulfilled, (state, { payload }) => {
        fulfilled(state, 'adminFetchCareRecords');
        state.adminCareRecords      = payload.data;
        state.adminCareRecordsTotal = payload.total;
      });

    builder
      .addCase(adminFetchCareRecordById.pending,   (state) => pending(state, 'adminFetchCareRecordById'))
      .addCase(adminFetchCareRecordById.rejected,  (state, a) => rejected(state, a, 'adminFetchCareRecordById'))
      .addCase(adminFetchCareRecordById.fulfilled, (state, { payload }) => {
        fulfilled(state, 'adminFetchCareRecordById');
        state.adminSelectedCareRecord = payload;
      });

    builder
      .addCase(adminAssignCareAssistant.pending,   (state) => pending(state, 'adminAssignCareAssistant'))
      .addCase(adminAssignCareAssistant.rejected,  (state, a) => rejected(state, a, 'adminAssignCareAssistant'))
      .addCase(adminAssignCareAssistant.fulfilled, (state, { payload }) => {
        fulfilled(state, 'adminAssignCareAssistant');
        // Update booking in any list it appears in
        const idx = state.caBookings.findIndex((b) => b._id === payload._id);
        if (idx !== -1) state.caBookings[idx] = payload;
      });

      // ── F. DOCTOR DASHBOARD ──────────────────────────────────────────────────

builder
  .addCase(fetchDoctorAppointments.pending,   (state) => pending(state, 'fetchDoctorAppointments'))
  .addCase(fetchDoctorAppointments.rejected,  (state, a) => rejected(state, a, 'fetchDoctorAppointments'))
  .addCase(fetchDoctorAppointments.fulfilled, (state, { payload }) => {
    fulfilled(state, 'fetchDoctorAppointments');
    state.doctorAppointments      = payload.data;
    state.doctorAppointmentsTotal = payload.total;
    state.doctorAppointmentsPage  = payload.page;
  });

builder
  .addCase(fetchDoctorAvailability.pending,   (state) => pending(state, 'fetchDoctorAvailability'))
  .addCase(fetchDoctorAvailability.rejected,  (state, a) => rejected(state, a, 'fetchDoctorAvailability'))
  .addCase(fetchDoctorAvailability.fulfilled, (state, { payload }) => {
    fulfilled(state, 'fetchDoctorAvailability');
    state.doctorAvailability = payload;
  });

builder
  .addCase(updateDoctorAvailability.pending,   (state) => pending(state, 'updateDoctorAvailability'))
  .addCase(updateDoctorAvailability.rejected,  (state, a) => rejected(state, a, 'updateDoctorAvailability'))
  .addCase(updateDoctorAvailability.fulfilled, (state, { payload }) => {
    fulfilled(state, 'updateDoctorAvailability');
    state.doctorAvailability = payload;
  });

builder
  .addCase(fetchDoctorEarnings.pending,   (state) => pending(state, 'fetchDoctorEarnings'))
  .addCase(fetchDoctorEarnings.rejected,  (state, a) => rejected(state, a, 'fetchDoctorEarnings'))
  .addCase(fetchDoctorEarnings.fulfilled, (state, { payload }) => {
    fulfilled(state, 'fetchDoctorEarnings');
    state.doctorEarnings = payload;
  });

builder
  .addCase(fetchDoctorTransactions.pending,   (state) => pending(state, 'fetchDoctorTransactions'))
  .addCase(fetchDoctorTransactions.rejected,  (state, a) => rejected(state, a, 'fetchDoctorTransactions'))
  .addCase(fetchDoctorTransactions.fulfilled, (state, { payload }) => {
    fulfilled(state, 'fetchDoctorTransactions');
    state.doctorTransactions      = payload.data;
    state.doctorTransactionsTotal = payload.total;
  });

builder
  .addCase(fetchDoctorInvoice.pending,   (state) => pending(state, 'fetchDoctorInvoice'))
  .addCase(fetchDoctorInvoice.rejected,  (state, a) => rejected(state, a, 'fetchDoctorInvoice'))
  .addCase(fetchDoctorInvoice.fulfilled, (state, { payload }) => {
    fulfilled(state, 'fetchDoctorInvoice');
    state.doctorInvoice = payload;
  });
  },
});

// ─── Actions ──────────────────────────────────────────────────────────────────
export const {
  clearSelectedPrescription,
  clearVerifiedRx,
  clearSelectedOP,
  clearSelectedCABooking,
  clearSelectedCareRecord,
  clearClinicalErrors,
  resetClinical,
} = clinicalSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

// Prescriptions
export const selectPrescriptions        = (s) => s.clinical.prescriptions;
export const selectPrescriptionsTotal   = (s) => s.clinical.prescriptionsTotal;
export const selectSelectedPrescription = (s) => s.clinical.selectedPrescription;
export const selectVerifiedRx           = (s) => s.clinical.verifiedRx;

// OP Records
export const selectOPRecords      = (s) => s.clinical.opRecords;
export const selectOPRecordsTotal = (s) => s.clinical.opRecordsTotal;
export const selectSelectedOP     = (s) => s.clinical.selectedOP;

// CA Bookings
export const selectCABookings        = (s) => s.clinical.caBookings;
export const selectCABookingsTotal   = (s) => s.clinical.caBookingsTotal;
export const selectCAPendingBookings = (s) => s.clinical.caPendingBookings;
export const selectSelectedCABooking = (s) => s.clinical.selectedCABooking;
export const selectCAPendingCount    = (s) => s.clinical.caPendingBookings.length;

// Care Records
export const selectCareRecords        = (s) => s.clinical.careRecords;
export const selectCareRecordsTotal   = (s) => s.clinical.careRecordsTotal;
export const selectSelectedCareRecord = (s) => s.clinical.selectedCareRecord;
export const selectInstructionsFor    = (id) => (s) => s.clinical.instructions[id] || [];


// Doctor Dashboard
export const selectDoctorAppointments      = (s) => s.clinical.doctorAppointments;
export const selectDoctorAppointmentsTotal = (s) => s.clinical.doctorAppointmentsTotal;
export const selectDoctorAvailability      = (s) => s.clinical.doctorAvailability;
export const selectDoctorEarnings          = (s) => s.clinical.doctorEarnings;
export const selectDoctorTransactions      = (s) => s.clinical.doctorTransactions;
export const selectDoctorTransactionsTotal = (s) => s.clinical.doctorTransactionsTotal;
export const selectDoctorInvoice           = (s) => s.clinical.doctorInvoice;

// Active care record helpers (derived)
export const selectLatestVitals = (s) => {
  const rec = s.clinical.selectedCareRecord;
  if (!rec?.vitalsLog?.length) return null;
  return rec.vitalsLog[rec.vitalsLog.length - 1];
};
export const selectOpenAlerts = (s) =>
  (s.clinical.selectedCareRecord?.careNotes || []).filter(
    (n) => n.severity === 'critical' && !n.isResolved
  );
export const selectTodaysMissedMeds = (s) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (s.clinical.selectedCareRecord?.medicineLog || []).filter(
    (m) => m.status === 'missed' && new Date(m.scheduledAt) >= today
  );
};

// Admin
export const selectAdminPrescriptions      = (s) => s.clinical.adminPrescriptions;
export const selectAdminPrescriptionsTotal = (s) => s.clinical.adminPrescriptionsTotal;
export const selectAdminOPRecords          = (s) => s.clinical.adminOPRecords;
export const selectAdminOPRecordsTotal     = (s) => s.clinical.adminOPRecordsTotal;
export const selectAdminCareRecords        = (s) => s.clinical.adminCareRecords;
export const selectAdminCareRecordsTotal   = (s) => s.clinical.adminCareRecordsTotal;
export const selectAdminSelectedCareRecord = (s) => s.clinical.adminSelectedCareRecord;

// Loading / Error
export const selectClinicalLoading = (key) => (s) => !!s.clinical.loading[key];
export const selectClinicalError   = (key) => (s) => s.clinical.errors[key] || null;

export default clinicalSlice.reducer;