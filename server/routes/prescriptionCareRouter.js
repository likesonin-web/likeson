/**
 * prescriptionCareRouter.js
 * Likeson.in
 *
 * Covers:
 *  DOCTOR      — create / view / cancel prescriptions, OP records
 *  HOSPITAL    — view OPs + prescriptions under hospital
 *  CARE ASST   — bookings list, accept/reject, care record CRUD
 *  ADMIN/SUPER — full override access
 *
 * Mount at: /api/v1/clinical
 *
 * No separate controllers — all logic inline.
 */

import express from 'express';
import mongoose from 'mongoose';

import { protect, authorize }         from '../middleware/authMiddleware.js';
import EPrescription                   from '../models/EPrescription.js';
import OutPatientRecord                from '../models/OutPatientRecord.js';
import PatientCareRecord               from '../models/PatientCareRecord.js';
import Booking                         from '../models/Booking.js';
import DoctorProfile                   from '../models/DoctorProfile.js';
import CareAssistantProfile            from '../models/CareAssistantProfile.js';
import User                            from '../models/User.js';
import generateEPrescriptionPdf        from '../utils/generateEPrescriptionPdf.js';

const router = express.Router();

// ─── Role middleware shortcuts ────────────────────────────────────────────────
const isDoctor        = [protect, authorize('doctor')];
const isHospital      = [protect, authorize('hospital')];
const isCareAssistant = [protect, authorize('care_assistant')];
const isAdmin         = [protect, authorize('admin', 'superadmin')];
const isDoctorOrAdmin = [protect, authorize('doctor', 'admin', 'superadmin')];
const isAnyStaff      = [protect, authorize('doctor','hospital','care_assistant','admin','superadmin')];

// ─── Tiny async wrapper ───────────────────────────────────────────────────────
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION A — PRESCRIPTIONS (DOCTOR)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /clinical/prescriptions
 * Doctor creates a new ePrescription.
 * Body mirrors EPrescription schema (medicines[], labTests[], vitals, etc.)
 */
router.post('/prescriptions', ...isDoctor, wrap(async (req, res) => {
  const doctorProfile = await DoctorProfile.findOne({ user: req.user._id })
    .select('_id registrationNumber registrationCouncil specialization')
    .populate('user', 'name phone email')
    .lean();

  if (!doctorProfile) {
    return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
  }

  const {
    booking, outPatientRecord, patientCareRecord,
    patient, hospital,
    diagnosis, diagnosisCode, chiefComplaints, clinicalFindings,
    advice, referralNote, vitals,
    medicines, labTests,
    followUpDate, followUpInstructions,
  } = req.body;

  // Patient snapshot is REQUIRED
  if (!patient?.name) {
    return res.status(400).json({ success: false, message: 'patient.name is required.' });
  }
  if (!medicines?.length && !labTests?.length) {
    return res.status(400).json({ success: false, message: 'Prescription must have at least one medicine or lab test.' });
  }

  const doctorSnap = {
    userId:              req.user._id,
    doctorProfileId:     doctorProfile._id,
    name:                doctorProfile.user.name,
    registrationNumber:  doctorProfile.registrationNumber,
    registrationCouncil: doctorProfile.registrationCouncil,
    specialization:      doctorProfile.specialization,
    phone:               doctorProfile.user.phone,
    email:               doctorProfile.user.email,
  };

  const rx = await EPrescription.create({
    booking, outPatientRecord, patientCareRecord,
    doctor:   doctorSnap,
    hospital: hospital || null,
    patient,
    diagnosis, diagnosisCode,
    chiefComplaints: chiefComplaints || [],
    clinicalFindings, advice, referralNote,
    vitals: vitals || {},
    medicines: medicines || [],
    labTests:  labTests  || [],
    followUpDate, followUpInstructions,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: rx });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/prescriptions
 * Doctor — own prescriptions.
 * Admin  — all (no filter applied unless query params passed).
 * Query: status, patientId, from, to, page, limit
 */
router.get('/prescriptions', ...isAnyStaff, wrap(async (req, res) => {
  const { status, patientId, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    filter['doctor.doctorProfileId'] = dp._id;
  }

  if (req.user.role === 'hospital') {
    // hospital manager sees prescriptions issued at their hospital
    const Hospital = mongoose.model('Hospital');
    const hosp = await Hospital.findOne({ managedBy: req.user._id }).select('_id name').lean();
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospital not found.' });
    filter['hospital.hospitalId'] = hosp._id;
  }

  if (status)    filter.status               = status;
  if (patientId) filter['patient.userId']    = patientId;
  if (from || to) {
    filter.issuedAt = {};
    if (from) filter.issuedAt.$gte = new Date(from);
    if (to)   filter.issuedAt.$lte = new Date(to);
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    EPrescription.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    EPrescription.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/prescriptions/verify/:rxNumber
 * PUBLIC — verify prescription (shows only safe fields, no medicine list)
 */
router.get('/prescriptions/verify/:rxNumber', wrap(async (req, res) => {
  const rx = await EPrescription.findOne({ rxNumber: req.params.rxNumber })
    .select('rxNumber doctor patient issuedAt expiresAt status isDigitallySigned')
    .lean();

  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  res.json({
    success: true,
    data: {
      rxNumber:         rx.rxNumber,
      doctorName:       rx.doctor?.name,
      registrationNo:   rx.doctor?.registrationNumber,
      patientName:      rx.patient?.name,
      issuedAt:         rx.issuedAt,
      expiresAt:        rx.expiresAt,
      status:           rx.status,
      isDigitallySigned:rx.isDigitallySigned,
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/prescriptions/:id
 * Doctor sees own. Admin sees all. Care-assistant sees if linked via patientCareRecord.
 */
router.get('/prescriptions/:id', ...isAnyStaff, wrap(async (req, res) => {
  const rx = await EPrescription.findById(req.params.id).lean();
  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  // Ownership check for doctor
  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (rx.doctor?.doctorProfileId?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  // Care assistant: only if prescription is linked to their care record
  if (req.user.role === 'care_assistant') {
    const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const pcr = await PatientCareRecord.findById(rx.patientCareRecord).select('careAssistant').lean();
    if (!pcr || pcr.careAssistant?.toString() !== cap?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  res.json({ success: true, data: rx });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/prescriptions/:id/pdf
 * Download prescription as PDF.
 * Doctor (own) | Admin | Care assistant (linked)
 */
router.get('/prescriptions/:id/pdf', ...isAnyStaff, wrap(async (req, res) => {
  const rx = await EPrescription.findById(req.params.id).lean();
  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  // Same ownership checks as above
  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (rx.doctor?.doctorProfileId?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  const pdfBuffer = await generateEPrescriptionPdf(rx);

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="${rx.rxNumber}.pdf"`,
    'Content-Length':      pdfBuffer.length,
  });
  res.send(pdfBuffer);
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /clinical/prescriptions/:id/cancel
 * Doctor cancels own prescription. Admin can cancel any.
 */
router.patch('/prescriptions/:id/cancel', ...isDoctorOrAdmin, wrap(async (req, res) => {
  const rx = await EPrescription.findById(req.params.id);
  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (rx.doctor?.doctorProfileId?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  if (['cancelled', 'expired', 'dispensed'].includes(rx.status)) {
    return res.status(400).json({ success: false, message: `Cannot cancel a ${rx.status} prescription.` });
  }

  rx.status      = 'cancelled';
  rx.cancelledAt = new Date();
  rx.cancelReason= req.body.reason || 'Cancelled by doctor';
  rx.updatedBy   = req.user._id;
  await rx.save();

  res.json({ success: true, message: 'Prescription cancelled.', data: rx });
}));


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION B — OUT-PATIENT RECORDS (DOCTOR + HOSPITAL)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /clinical/op-records
 * Doctor — own consultations.
 * Hospital — all OPs under their hospital.
 * Admin — all.
 * Query: status, patientId, from, to, page, limit
 */
router.get('/op-records', ...isAnyStaff, wrap(async (req, res) => {
  const { status, patientId, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    filter.doctor = dp._id;
  }

  if (req.user.role === 'hospital') {
    const Hospital = mongoose.model('Hospital');
    const hosp = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospital not found.' });
    filter.hospital = hosp._id;
  }

  if (status)    filter.status  = status;
  if (patientId) filter.patient = patientId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    OutPatientRecord.find(filter)
      .sort({ scheduledAt: -1 })
      .skip(skip).limit(Number(limit))
      .populate('patient', 'name phone')
      .lean(),
    OutPatientRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/op-records/:id
 */
router.get('/op-records/:id', ...isAnyStaff, wrap(async (req, res) => {
  const op = await OutPatientRecord.findById(req.params.id)
    .populate('patient', 'name phone email')
    .populate('doctor')
    .lean();

  if (!op) return res.status(404).json({ success: false, message: 'OP Record not found.' });

  // Doctor ownership
  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (op.doctor?._id?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  // Fetch linked prescriptions for convenience
  const prescriptions = await EPrescription.find({ outPatientRecord: op._id })
    .select('rxNumber status issuedAt medicines.medicineName expiresAt')
    .lean();

  res.json({ success: true, data: { ...op, prescriptions } });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /clinical/op-records/:id/complete
 * Doctor marks OP as completed, adds notes + optional diagnosis.
 * Body: { doctorNotes, diagnosisCode, reasonForVisit }
 */
router.patch('/op-records/:id/complete', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  const op = await OutPatientRecord.findById(req.params.id);
  if (!op) return res.status(404).json({ success: false, message: 'OP Record not found.' });
  if (op.doctor.toString() !== dp._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  if (op.status === 'completed') {
    return res.status(400).json({ success: false, message: 'Already completed.' });
  }

  const { doctorNotes, diagnosisCode, reasonForVisit } = req.body;

  op.status       = 'completed';
  op.completedAt  = new Date();
  if (doctorNotes)    op.doctorNotes    = doctorNotes;
  if (diagnosisCode)  op.diagnosisCode  = diagnosisCode;
  if (reasonForVisit) op.reasonForVisit = reasonForVisit;
  op.startedAt    = op.startedAt || new Date();
  op.updatedBy    = req.user._id;
  await op.save();

  res.json({ success: true, message: 'Consultation completed.', data: op });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /clinical/op-records/:id/status
 * Hospital manager or Admin — force status change (reschedule / cancel / no_show).
 * Body: { status, reason }
 */
router.patch('/op-records/:id/status',
  protect, authorize('hospital', 'admin', 'superadmin'),
  wrap(async (req, res) => {
    const { status, reason } = req.body;
    const ALLOWED = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${ALLOWED.join(', ')}` });
    }

    const op = await OutPatientRecord.findById(req.params.id);
    if (!op) return res.status(404).json({ success: false, message: 'OP Record not found.' });

    if (req.user.role === 'hospital') {
      const Hospital = mongoose.model('Hospital');
      const hosp = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
      if (op.hospital?.toString() !== hosp?._id?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    op.status    = status;
    op.updatedBy = req.user._id;
    if (reason) op.doctorNotes = (op.doctorNotes ? op.doctorNotes + '\n' : '') + `[${status}] ${reason}`;
    await op.save();

    res.json({ success: true, message: `OP status updated to ${status}.`, data: op });
  })
);


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION C — CARE ASSISTANT: BOOKINGS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /clinical/care/bookings
 * Care assistant sees bookings assigned to them.
 * Query: status, bookingType, from, to, page, limit
 */
router.get('/care/bookings', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });

  const { status, bookingType, from, to, page = 1, limit = 20 } = req.query;

  const filter = { careAssistant: cap._id };
  if (status)      filter.status      = status;
  if (bookingType) filter.bookingType = bookingType;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    Booking.find(filter)
      .sort({ scheduledAt: -1 })
      .skip(skip).limit(Number(limit))
      .populate('customer', 'name phone')
      .select('-internalNotes -statusLog')
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/care/bookings/pending
 * Care assistant — NEW bookings awaiting acceptance (status: confirmed, not yet active).
 * These are bookings assigned to this CA that have no PatientCareRecord yet.
 */
router.get('/care/bookings/pending', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });

  // Bookings assigned but no care record = pending acceptance
  const assignedBookings = await Booking.find({
    careAssistant: cap._id,
    status: { $in: ['confirmed', 'pending'] },
  }).select('_id').lean();

  const bookingIds = assignedBookings.map((b) => b._id);

  // Filter out those that already have a care record
  const existingRecords = await PatientCareRecord.find({
    booking: { $in: bookingIds },
  }).select('booking').lean();

  const alreadyAccepted = new Set(existingRecords.map((r) => r.booking.toString()));
  const pendingIds = bookingIds.filter((id) => !alreadyAccepted.has(id.toString()));

  const data = await Booking.find({ _id: { $in: pendingIds } })
    .sort({ scheduledAt: 1 })
    .populate('customer', 'name phone')
    .select('-internalNotes -statusLog')
    .lean();

  res.json({ success: true, count: data.length, data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/care/bookings/:bookingId
 * Care assistant — full booking detail.
 */
router.get('/care/bookings/:bookingId', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();

  const booking = await Booking.findOne({
    _id: req.params.bookingId,
    careAssistant: cap._id,
  })
    .populate('customer', 'name phone email')
    .populate('doctor')
    .lean();

  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you.' });

  // Attach linked care record if exists
  const careRecord = await PatientCareRecord.findOne({ booking: booking._id })
    .select('status assignedAt latestVitals openAlerts todaysMissedMeds')
    .lean();

  // Attach OP record if exists
  const opRecord = await OutPatientRecord.findOne({ booking: booking._id })
    .select('opNumber prescriptionUrl diagnosisCode doctorNotes followUpExpiry')
    .lean();

  res.json({ success: true, data: { ...booking, careRecord: careRecord || null, opRecord: opRecord || null } });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clinical/care/bookings/:bookingId/accept
 * Care assistant accepts a booking → creates PatientCareRecord.
 * Body: optional patientSnapshot override
 */
router.post('/care/bookings/:bookingId/accept', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });

  const booking = await Booking.findOne({
    _id:           req.params.bookingId,
    careAssistant: cap._id,
    status:        { $in: ['confirmed', 'pending'] },
  });

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found, not assigned to you, or not in acceptable state.' });
  }

  // Prevent duplicate records
  const existing = await PatientCareRecord.findOne({ booking: booking._id });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Care record already exists for this booking.', data: existing });
  }

  // Pull patient snapshot from booking
  const pi = booking.patientInfo || {};
  const patientSnapshot = req.body.patientSnapshot || {
    bloodGroup:  pi.bloodGroup || null,
    allergies:   [],
    chronicConditions: [],
    primaryLanguage: 'English',
    emergencyContact: {},
  };

  // Find linked OP record if any
  const opRecord = await OutPatientRecord.findOne({ booking: booking._id }).select('_id').lean();

  const careRecord = await PatientCareRecord.create({
    booking:          booking._id,
    patient:          booking.customer,
    patientName:      pi.name,
    careAssistant:    cap._id,
    outPatientRecord: opRecord?._id || null,
    status:           'active',
    assignedAt:       new Date(),
    patientSnapshot,
    createdBy: req.user._id,
  });

  // Move booking to in_progress
  booking.status    = 'in_progress';
  booking.updatedBy = req.user._id;
  await booking.save();

  // Update CA profile status
  await CareAssistantProfile.findByIdAndUpdate(cap._id, {
    status:            'On-Task',
    currentActiveTask: booking._id,
  });

  res.status(201).json({ success: true, message: 'Booking accepted. Care record created.', data: careRecord });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clinical/care/bookings/:bookingId/reject
 * Care assistant rejects (declines) a booking.
 * Body: { reason }
 * Note: Admin should reassign the booking after this.
 */
router.post('/care/bookings/:bookingId/reject', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();

  const booking = await Booking.findOne({
    _id:           req.params.bookingId,
    careAssistant: cap._id,
    status:        { $in: ['confirmed', 'pending'] },
  });

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found or cannot be rejected.' });
  }

  // Unassign care assistant from booking
  booking.careAssistant          = null;
  booking.careAssistantSnapshot  = null;
  booking.status                 = 'confirmed'; // back to confirmed so admin can reassign
  booking.updatedBy              = req.user._id;
  await booking.save();

  res.json({ success: true, message: 'Booking rejected. Admin will reassign.', reason: req.body.reason || null });
}));


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION D — CARE ASSISTANT: PATIENT CARE RECORD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper: load care record and verify ownership by care assistant.
 */
const loadOwnCareRecord = async (recordId, capId) => {
  const record = await PatientCareRecord.findById(recordId);
  if (!record) return { error: 'Care record not found.' };
  if (record.careAssistant.toString() !== capId.toString()) {
    return { error: 'Access denied.', forbidden: true };
  }
  return { record };
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/care/records
 * Care assistant — all their care records.
 * Query: status, page, limit
 */
router.get('/care/records', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { careAssistant: cap._id };
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    PatientCareRecord.find(filter)
      .sort({ assignedAt: -1 })
      .skip(skip).limit(Number(limit))
      .populate('patient', 'name phone')
      .select('-hospitalInstructions -vitalsLog -foodLog -medicineLog -careNotes')
      .lean(),
    PatientCareRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/care/records/:id
 * Full care record detail for care assistant.
 */
router.get('/care/records/:id', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  // Populate linked prescription for care context
  const prescriptions = await EPrescription.find({ patientCareRecord: record._id })
    .select('rxNumber medicines labTests status issuedAt expiresAt advice')
    .lean();

  const opRecord = record.outPatientRecord
    ? await OutPatientRecord.findById(record.outPatientRecord)
        .select('opNumber prescriptionUrl diagnosisCode doctorNotes followUpExpiry')
        .lean()
    : null;

  // Manually include hospitalInstructions (select:false in schema)
  const full = await PatientCareRecord.findById(record._id).select('+hospitalInstructions').lean();

  res.json({ success: true, data: { ...full, prescriptions, opRecord } });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clinical/care/records/:id/vitals
 * Push a new vitals entry.
 * Body: { bloodPressure, pulseRate, temperature, spO2, bloodSugar, weightKg, heightCm, respiratoryRate, notes }
 */
router.post('/care/records/:id/vitals', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  if (record.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Care record is not active.' });
  }

  const { bloodPressure, pulseRate, temperature, spO2, bloodSugar, weightKg, heightCm, respiratoryRate, notes, evidenceImages } = req.body;

  record.vitalsLog.push({
    recordedAt: new Date(),
    recordedBy: req.user._id,
    bloodPressure, pulseRate, temperature, spO2,
    bloodSugar, weightKg, heightCm, respiratoryRate,
    notes,
    evidenceImages: evidenceImages || [],
  });
  record.updatedBy = req.user._id;
  await record.save();

  res.status(201).json({
    success: true,
    message: 'Vitals recorded.',
    latest: record.vitalsLog[record.vitalsLog.length - 1],
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clinical/care/records/:id/food
 * Log a meal/fluid entry.
 * Body: { mealType, description, quantityMl, status, refusalReason, notes, images }
 */
router.post('/care/records/:id/food', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  const { mealType, description, quantityMl, status, refusalReason, notes, images } = req.body;

  if (!mealType) return res.status(400).json({ success: false, message: 'mealType is required.' });

  record.foodLog.push({
    mealTime:  new Date(),
    mealType,
    description,
    quantityMl,
    status:        status || 'consumed',
    refusalReason,
    recordedBy:    req.user._id,
    notes,
    images: images || [],
  });
  record.updatedBy = req.user._id;
  await record.save();

  res.status(201).json({
    success: true,
    message: 'Food entry logged.',
    entry: record.foodLog[record.foodLog.length - 1],
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clinical/care/records/:id/medicine-log
 * Log a medicine administration event.
 * Body: { medicineName, dosage, route, status, scheduledAt, administeredAt, missedReason, notes, pillImages }
 */
router.post('/care/records/:id/medicine-log', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  const {
    medicine, medicineName, dosage, route,
    status, scheduledAt, administeredAt,
    missedReason, notes, pillImages,
  } = req.body;

  if (!medicineName) return res.status(400).json({ success: false, message: 'medicineName is required.' });
  if (!scheduledAt)  return res.status(400).json({ success: false, message: 'scheduledAt is required.' });

  record.medicineLog.push({
    scheduledAt:    new Date(scheduledAt),
    administeredAt: administeredAt ? new Date(administeredAt) : (status === 'given' ? new Date() : undefined),
    medicine:       medicine || null,
    medicineName,
    dosage,
    route:          route || 'oral',
    status:         status || 'given',
    missedReason,
    administeredBy: req.user._id,
    notes,
    pillImages: pillImages || [],
  });
  record.updatedBy = req.user._id;
  await record.save();

  res.status(201).json({
    success: true,
    message: 'Medicine log entry recorded.',
    entry: record.medicineLog[record.medicineLog.length - 1],
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clinical/care/records/:id/notes
 * Add a care note.
 * Body: { note, category, severity, observationImages }
 */
router.post('/care/records/:id/notes', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  const { note, category, severity, observationImages } = req.body;
  if (!note) return res.status(400).json({ success: false, message: 'note text is required.' });

  record.careNotes.push({
    note,
    category:          category  || 'general',
    severity:          severity  || 'low',
    recordedBy:        req.user._id,
    recordedAt:        new Date(),
    observationImages: observationImages || [],
  });
  record.updatedBy = req.user._id;
  await record.save();

  res.status(201).json({
    success: true,
    message: 'Care note added.',
    note: record.careNotes[record.careNotes.length - 1],
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /clinical/care/records/:id/notes/:noteId/resolve
 * Mark a care note as resolved.
 */
router.patch('/care/records/:id/notes/:noteId/resolve', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  const noteEntry = record.careNotes.id(req.params.noteId);
  if (!noteEntry) return res.status(404).json({ success: false, message: 'Note not found.' });
  if (noteEntry.isResolved) return res.status(400).json({ success: false, message: 'Already resolved.' });

  noteEntry.isResolved = true;
  noteEntry.resolvedAt = new Date();
  noteEntry.resolvedBy = req.user._id;
  record.updatedBy     = req.user._id;
  await record.save();

  res.json({ success: true, message: 'Note resolved.', note: noteEntry });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clinical/care/records/:id/instructions
 * APPEND-ONLY hospital instruction.
 * Body: { instruction, category, attachments }
 */
router.post('/care/records/:id/instructions',
  protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'),
  wrap(async (req, res) => {
    const { instruction, category, attachments } = req.body;
    if (!instruction) return res.status(400).json({ success: false, message: 'instruction text is required.' });

    // Care assistant: ownership check. Doctor/admin: skip.
    let record;
    if (req.user.role === 'care_assistant') {
      const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      const result = await loadOwnCareRecord(req.params.id, cap._id);
      if (result.error) return res.status(result.forbidden ? 403 : 404).json({ success: false, message: result.error });
      record = result.record;
    } else {
      record = await PatientCareRecord.findById(req.params.id).select('+hospitalInstructions');
      if (!record) return res.status(404).json({ success: false, message: 'Care record not found.' });
    }

    // Re-fetch with hospitalInstructions (select:false)
    const fullRecord = await PatientCareRecord.findById(record._id).select('+hospitalInstructions');

    fullRecord.hospitalInstructions.push({
      instruction,
      issuedByName: req.user.name,
      issuedBy:     req.user._id,
      issuedAt:     new Date(),
      category:     category || 'general',
      attachments:  attachments || [],
    });
    fullRecord.updatedBy = req.user._id;
    await fullRecord.save();

    const added = fullRecord.hospitalInstructions[fullRecord.hospitalInstructions.length - 1];
    res.status(201).json({ success: true, message: 'Instruction appended.', instruction: added });
  })
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/care/records/:id/instructions
 * Read hospital instructions for a care record.
 * Care assistant (own) | Doctor | Admin
 */
router.get('/care/records/:id/instructions',
  protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'),
  wrap(async (req, res) => {
    const full = await PatientCareRecord.findById(req.params.id).select('+hospitalInstructions').lean();
    if (!full) return res.status(404).json({ success: false, message: 'Care record not found.' });

    if (req.user.role === 'care_assistant') {
      const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (full.careAssistant.toString() !== cap._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    res.json({ success: true, data: full.hospitalInstructions || [] });
  })
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /clinical/care/records/:id/discharge
 * Care assistant discharges a patient.
 * Body: { dischargeNotes }
 */
router.patch('/care/records/:id/discharge', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  if (record.status === 'discharged') {
    return res.status(400).json({ success: false, message: 'Already discharged.' });
  }

  record.status         = 'discharged';
  record.dischargeNotes = req.body.dischargeNotes || '';
  record.updatedBy      = req.user._id;
  await record.save(); // pre-save stamps dischargedAt

  // Mark booking as completed
  await Booking.findByIdAndUpdate(record.booking, {
    status:      'completed',
    completedAt: new Date(),
    updatedBy:   req.user._id,
  });

  // Free up CA
  await CareAssistantProfile.findByIdAndUpdate(cap._id, {
    status:            'Available',
    currentActiveTask: null,
  });

  res.json({ success: true, message: 'Patient discharged.', data: record });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /clinical/care/records/:id/status
 * Admin only — override care record status (on_hold, transferred, etc.)
 * Body: { status, dischargeNotes }
 */
router.patch('/care/records/:id/status', ...isAdmin, wrap(async (req, res) => {
  const { status, dischargeNotes } = req.body;
  const ALLOWED = ['active', 'discharged', 'transferred', 'on_hold'];
  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of: ${ALLOWED.join(', ')}` });
  }

  const record = await PatientCareRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Care record not found.' });

  record.status         = status;
  record.updatedBy      = req.user._id;
  if (dischargeNotes) record.dischargeNotes = dischargeNotes;
  await record.save();

  res.json({ success: true, message: `Care record status set to ${status}.`, data: record });
}));


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION E — ADMIN OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /clinical/admin/prescriptions
 * Admin — all prescriptions with full filters.
 */
router.get('/admin/prescriptions', ...isAdmin, wrap(async (req, res) => {
  const { status, doctorId, patientId, hospitalId, from, to, page = 1, limit = 30 } = req.query;
  const filter = {};

  if (status)     filter.status                      = status;
  if (doctorId)   filter['doctor.doctorProfileId']   = doctorId;
  if (patientId)  filter['patient.userId']            = patientId;
  if (hospitalId) filter['hospital.hospitalId']       = hospitalId;
  if (from || to) {
    filter.issuedAt = {};
    if (from) filter.issuedAt.$gte = new Date(from);
    if (to)   filter.issuedAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    EPrescription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    EPrescription.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/admin/op-records
 * Admin — all OP records.
 */
router.get('/admin/op-records', ...isAdmin, wrap(async (req, res) => {
  const { status, doctorId, hospitalId, patientId, from, to, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status)     filter.status   = status;
  if (doctorId)   filter.doctor   = doctorId;
  if (hospitalId) filter.hospital = hospitalId;
  if (patientId)  filter.patient  = patientId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    OutPatientRecord.find(filter).sort({ scheduledAt: -1 }).skip(skip).limit(Number(limit))
      .populate('patient', 'name phone')
      .lean(),
    OutPatientRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/admin/care-records
 * Admin — all care records.
 */
router.get('/admin/care-records', ...isAdmin, wrap(async (req, res) => {
  const { status, careAssistantId, patientId, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status)          filter.status        = status;
  if (careAssistantId) filter.careAssistant = careAssistantId;
  if (patientId)       filter.patient       = patientId;

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    PatientCareRecord.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
      .populate('patient', 'name phone')
      .populate('careAssistant', 'fullName phone')
      .lean(),
    PatientCareRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /clinical/admin/bookings/:bookingId/assign-ca
 * Admin reassigns a care assistant to a booking.
 * Body: { careAssistantProfileId }
 */
router.patch('/admin/bookings/:bookingId/assign-ca', ...isAdmin, wrap(async (req, res) => {
  const { careAssistantProfileId } = req.body;
  if (!careAssistantProfileId) {
    return res.status(400).json({ success: false, message: 'careAssistantProfileId is required.' });
  }

  const cap = await CareAssistantProfile.findById(careAssistantProfileId)
    .select('_id fullName phone user')
    .lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant not found.' });

  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  booking.careAssistant = cap._id;
  booking.careAssistantSnapshot = {
    name:     cap.fullName,
    phone:    cap.phone,
    photoUrl: null,
  };
  booking.updatedBy = req.user._id;
  await booking.save();

  res.json({ success: true, message: 'Care assistant reassigned.', data: booking });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/admin/care-records/:id
 * Admin — full care record with instructions.
 */
router.get('/admin/care-records/:id', ...isAdmin, wrap(async (req, res) => {
  const record = await PatientCareRecord.findById(req.params.id)
    .select('+hospitalInstructions')
    .populate('patient', 'name phone email')
    .populate('careAssistant', 'fullName phone')
    .lean();
  if (!record) return res.status(404).json({ success: false, message: 'Care record not found.' });

  const prescriptions = await EPrescription.find({ patientCareRecord: record._id }).lean();
  res.json({ success: true, data: { ...record, prescriptions } });
}));

// ─────────────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION F — DOCTOR DASHBOARD & PRACTICE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /clinical/doctor/appointments
 * List all bookings assigned to the logged-in doctor.
 */
router.get('/doctor/appointments', ...isDoctor, wrap(async (req, res) => {
  const { status, from, to, page = 1, limit = 20 } = req.query;
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  
  const filter = { doctor: dp._id };
  if (status) filter.status = status;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    Booking.find(filter)
      .sort({ scheduledAt: -1 })
      .skip(skip).limit(Number(limit))
      .populate('customer', 'name phone profilePhotoUrl')
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/doctor/availability
 * Get current weekly slots and availability.
 */
router.get('/doctor/availability', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id })
    .select('weeklyAvailability consultationTypes')
    .lean();
    
  res.json({ success: true, data: dp });
}));

/**
 * PATCH /clinical/doctor/availability
 * Update weekly slots or consultation types.
 */
router.patch('/doctor/availability', ...isDoctor, wrap(async (req, res) => {
  const { weeklyAvailability, consultationTypes } = req.body;
  
  const dp = await DoctorProfile.findOne({ user: req.user._id });
  if (weeklyAvailability) dp.weeklyAvailability = weeklyAvailability;
  if (consultationTypes)  dp.consultationTypes = consultationTypes;
  
  dp.updatedBy = req.user._id;
  await dp.save();
  
  res.json({ success: true, message: 'Availability updated successfully.', data: dp.weeklyAvailability });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/doctor/earnings
 * Summary of total earnings, pending settlements, and stats.
 */
router.get('/doctor/earnings', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id })
    .select('stats bankDetails settlementCycle')
    .lean();

  res.json({ 
    success: true, 
    data: {
      summary: dp.stats,
      settlement: {
        cycle: dp.settlementCycle,
        bankLast4: dp.bankDetails?.accountLast4,
        isVerified: dp.bankDetails?.isBankVerified
      }
    } 
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/doctor/transactions
 * List all payments/payouts related to this doctor.
 * (Assumes a Transaction model exists in your system)
 */
router.get('/doctor/transactions', ...isDoctor, wrap(async (req, res) => {
  const Transaction = mongoose.model('Transaction'); // Ensure this model exists
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = { doctorProfile: dp._id };
  
  const [data, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Transaction.countDocuments(filter)
  ]);

  res.json({ success: true, total, data });
}));

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clinical/doctor/invoices/:bookingId
 * Generate or retrieve an invoice for a specific completed booking.
 */
router.get('/doctor/invoices/:bookingId', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  
  const booking = await Booking.findOne({ 
    _id: req.params.bookingId, 
    doctor: dp._id,
    status: 'completed'
  }).populate('customer', 'name email phone address');

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Completed booking not found.' });
  }

  // Logic to return fare breakdown as an "invoice" object
  res.json({
    success: true,
    data: {
      invoiceNumber: `INV-${booking.bookingCode}`,
      date: booking.completedAt,
      customer: booking.customer,
      items: [
        { 
          description: `${booking.bookingType.replace('_', ' ')} Fee`, 
          amount: booking.fareBreakdown.consultationFee 
        }
      ],
      totals: booking.fareBreakdown
    }
  });
}));
/**
 * Global error handler for this router.
 */
router.use((err, req, res, _next) => {
  console.error('[ClinicalRouter Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default router;