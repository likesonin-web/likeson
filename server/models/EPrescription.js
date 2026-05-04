import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
const { Schema } = mongoose;

const generateRxNumber = customAlphabet('0123456789', 8);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const prescribedMedicineSchema = new Schema(
  {
    // Ref + snapshot (production safe — medicine may be renamed/delisted)
    medicine:     { type: Schema.Types.ObjectId, ref: 'Medicine', default: null },
    medicineName: { type: String, required: true, trim: true },   // snapshot
    genericName:  { type: String, trim: true },                   // snapshot
    brandName:    { type: String, trim: true },                   // snapshot
    dosage:       { type: String, required: true, trim: true },   // "500mg"
    form:         { type: String, trim: true },                   // "Tablet", "Syrup"

    frequency: {
      type: String,
      enum: ['OD', 'BD', 'TDS', 'QID', 'SOS', 'HS', 'AC', 'PC', 'STAT', 'Weekly', 'Monthly', 'As Directed'],
      required: true,
    },
    durationDays: { type: Number, min: 1 },                       // null = ongoing
    timing: {
      type: String,
      enum: ['Before Food', 'After Food', 'With Food', 'Empty Stomach', 'Bedtime', 'As Directed'],
      default: 'After Food',
    },
    route: {
      type: String,
      enum: ['Oral', 'Topical', 'IV', 'IM', 'Inhalation', 'Sublingual', 'Rectal', 'Other'],
      default: 'Oral',
    },
    quantity:     { type: Number },                               // total units dispensed
    refillsAllowed:{ type: Number, default: 0, min: 0 },
    instructions: { type: String, trim: true, maxlength: 300 },  // "Apply thin layer"
    isSubstitutable: { type: Boolean, default: true },            // allow generic substitution
  },
  { _id: true }
);

const doctorSnapshotSchema = new Schema(
  {
    userId:             { type: Schema.Types.ObjectId, ref: 'User' },
    doctorProfileId:    { type: Schema.Types.ObjectId, ref: 'DoctorProfile' },
    name:               { type: String, required: true },
    registrationNumber: { type: String },
    registrationCouncil:{ type: String },
    specialization:     { type: String },
    qualifications:     { type: String },   // "MBBS, MD"
    phone:              { type: String },
    email:              { type: String },
    signatureUrl:       { type: String },   // doctor's digital signature image
  },
  { _id: false }
);

const hospitalSnapshotSchema = new Schema(
  {
    hospitalId:  { type: Schema.Types.ObjectId, ref: 'Hospital' },
    name:        { type: String },
    address:     { type: String },
    phone:       { type: String },
    email:       { type: String },
    logo:        { type: String },
    licenseNo:   { type: String },
  },
  { _id: false }
);

const patientSnapshotSchema = new Schema(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User' },
    name:        { type: String, required: true },
    age:         { type: Number },
    gender:      { type: String },
    phone:       { type: String },
    bloodGroup:  { type: String },
    weight:      { type: String },
    allergies:   [{ type: String }],
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const ePrescriptionSchema = new Schema(
  {
    // ── Identifier ────────────────────────────────────────────────────────────
    rxNumber: {
      type:   String,
      unique: true,
      index:  true,
      // Format: RX-YYYYMMDD-XXXXXXXX
    },

    // ── Linkage ───────────────────────────────────────────────────────────────
    booking: {
      type:  Schema.Types.ObjectId,
      ref:   'Booking',
      index: true,
    },
    outPatientRecord: {
      type:  Schema.Types.ObjectId,
      ref:   'OutPatientRecord',
      index: true,
    },
    patientCareRecord: {
      type:    Schema.Types.ObjectId,
      ref:     'PatientCareRecord',
      default: null,
    },

    // ── Snapshots (immutable at prescription time) ────────────────────────────
    doctor:   { type: doctorSnapshotSchema,   required: true },
    hospital: { type: hospitalSnapshotSchema, default: null },
    patient:  { type: patientSnapshotSchema,  required: true },

    // ── Clinical Context ──────────────────────────────────────────────────────
    diagnosis:       { type: String, trim: true, maxlength: 500 },
    diagnosisCode:   { type: String, trim: true },  // ICD-10
    chiefComplaints: [{ type: String, trim: true }],
    clinicalFindings:{ type: String, trim: true, maxlength: 1000 },
    advice:          { type: String, trim: true, maxlength: 1000 }, // lifestyle / diet advice
    referralNote:    { type: String, trim: true, maxlength: 500 },  // refer to specialist

    // ── Vitals at Consultation ────────────────────────────────────────────────
    vitals: {
      bloodPressure: { type: String },
      pulseRate:     { type: Number },
      temperature:   { type: Number },
      spO2:          { type: Number },
      bloodSugar:    { type: Number },
      weightKg:      { type: Number },
      heightCm:      { type: Number },
    },

    // ── Prescribed Medicines ──────────────────────────────────────────────────
    medicines: {
      type:     [prescribedMedicineSchema],
      default:  [],
      validate: [v => v.length <= 20, 'Max 20 medicines per prescription'],
    },

    // ── Lab Tests Ordered ─────────────────────────────────────────────────────
    labTests: [
      {
        testName:    { type: String, required: true, trim: true },
        testCode:    { type: String, trim: true },
        urgency:     { type: String, enum: ['routine', 'urgent', 'stat'], default: 'routine' },
        instructions:{ type: String, trim: true },
      },
    ],

    // ── Follow-Up ─────────────────────────────────────────────────────────────
    followUpDate:         { type: Date },
    followUpInstructions: { type: String, trim: true, maxlength: 300 },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['draft', 'issued', 'dispensed', 'cancelled', 'expired'],
      default: 'issued',
      index:   true,
    },
    issuedAt:    { type: Date, default: Date.now },
    expiresAt:   { type: Date },   // auto: issuedAt + 30 days (pre-save)
    cancelledAt: { type: Date },
    cancelReason:{ type: String },

    // ── Digital Verification ──────────────────────────────────────────────────
    /**
     * QR code URL points to: GET /api/prescriptions/verify/:rxNumber
     * Verifier sees: rxNumber, doctor name + reg no, issued date, patient name
     * Does NOT expose medicine list publicly.
     */
    qrCodeUrl:   { type: String },
    isDigitallySigned: { type: Boolean, default: false },

    // ── Dispensing Tracker ────────────────────────────────────────────────────
    dispensedAt:  { type: Date },
    dispensedBy:  { type: Schema.Types.ObjectId, ref: 'User' },  // pharmacist
    pharmacyStore:{ type: Schema.Types.ObjectId, ref: 'PharmacyStore', default: null },
    pharmacyOrderRef: { type: Schema.Types.ObjectId, ref: 'PharmacyOrder', default: null },

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

ePrescriptionSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

ePrescriptionSchema.virtual('isDispensed').get(function () {
  return this.status === 'dispensed';
});

ePrescriptionSchema.virtual('medicineCount').get(function () {
  return this.medicines?.length ?? 0;
});

// ─── Pre-save ──────────────────────────────────────────────────────────────────

ePrescriptionSchema.pre('save', async function () {
  // Generate RX number
  if (this.isNew && !this.rxNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let num, exists;
    do {
      num    = `RX-${date}-${generateRxNumber()}`;
      exists = await mongoose.model('EPrescription').exists({ rxNumber: num });
    } while (exists);
    this.rxNumber = num;
  }

  // Auto-expire: 30 days from issue
  if (this.isNew && !this.expiresAt) {
    const exp = new Date(this.issuedAt || Date.now());
    exp.setDate(exp.getDate() + 30);
    this.expiresAt = exp;
  }

  // Sync status on dispense
  if (this.isModified('dispensedAt') && this.dispensedAt && this.status === 'issued') {
    this.status = 'dispensed';
  }

  // Sync status on expiry check
  if (
    !this.isModified('status') &&
    this.status === 'issued' &&
    this.expiresAt &&
    new Date() > this.expiresAt
  ) {
    this.status = 'expired';
  }
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

ePrescriptionSchema.index({ 'patient.userId': 1, issuedAt: -1 });
ePrescriptionSchema.index({ 'doctor.doctorProfileId': 1, issuedAt: -1 });
ePrescriptionSchema.index({ status: 1, expiresAt: 1 });
ePrescriptionSchema.index({ outPatientRecord: 1 });
ePrescriptionSchema.index({ createdAt: -1 });

const EPrescription = mongoose.model('EPrescription', ePrescriptionSchema);
export default EPrescription;