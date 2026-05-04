import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─── IMMUTABLE: append-only; no update allowed via API ───────────────────────
const hospitalInstructionSchema = new Schema(
  {
    instruction:   { type: String, required: true, trim: true, maxlength: 1000 },
    issuedByName:  { type: String, trim: true },   // snapshot — doctor may leave platform
    issuedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    issuedAt:      { type: Date, default: Date.now },
    category: {
      type: String,
      enum: ['diet', 'mobility', 'medication', 'wound_care', 'general', 'emergency'],
      default: 'general',
    },
  },
  { _id: true }
);

// ─── VITALS LOG ──────────────────────────────────────────────────────────────
const vitalsEntrySchema = new Schema(
  {
    recordedAt:    { type: Date, default: Date.now },
    recordedBy:    { type: Schema.Types.ObjectId, ref: 'User' },

    bloodPressure: { type: String, trim: true },   // "120/80 mmHg"
    pulseRate:     { type: Number },               // bpm
    temperature:   { type: Number },               // °C
    spO2:          { type: Number, min: 0, max: 100 }, // %
    bloodSugar:    { type: Number },               // mg/dL
    weightKg:      { type: Number },
    heightCm:      { type: Number },
    respiratoryRate: { type: Number },             // breaths/min
    notes:         { type: String, maxlength: 300 },
  },
  { _id: true }
);

// ─── FOOD LOG ────────────────────────────────────────────────────────────────
const foodEntrySchema = new Schema(
  {
    mealTime:      { type: Date, default: Date.now },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack', 'supplement', 'fluid'],
      required: true,
    },
    description:   { type: String, trim: true, maxlength: 300 },
    quantityMl:    { type: Number },               // for fluids
    status: {
      type: String,
      enum: ['consumed', 'partial', 'refused', 'vomited'],
      default: 'consumed',
    },
    refusalReason: { type: String, trim: true, maxlength: 200 },
    recordedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
    notes:         { type: String, maxlength: 200 },
  },
  { _id: true }
);

// ─── MEDICINE ADMINISTRATION LOG ─────────────────────────────────────────────
const medicineAdminSchema = new Schema(
  {
    scheduledAt:   { type: Date, required: true },
    administeredAt:{ type: Date },

    // Ref + snapshot — safe if medicine renamed or removed from catalog
    medicine:      { type: Schema.Types.ObjectId, ref: 'Medicine', default: null },
    medicineName:  { type: String, required: true, trim: true },  // snapshot
    dosage:        { type: String, trim: true },   // "500mg", "10ml"
    route: {
      type: String,
      enum: ['oral', 'iv', 'im', 'topical', 'inhalation', 'rectal', 'sublingual', 'other'],
      default: 'oral',
    },

    status: {
      type: String,
      enum: ['scheduled', 'given', 'missed', 'refused', 'held'],
      default: 'scheduled',
    },
    missedReason:  { type: String, trim: true, maxlength: 200 },
    administeredBy:{ type: Schema.Types.ObjectId, ref: 'User' },
    notes:         { type: String, maxlength: 300 },
  },
  { _id: true }
);

// ─── CARE NOTES (mutable, actor-tagged) ──────────────────────────────────────
const careNoteSchema = new Schema(
  {
    note:        { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      enum: ['general', 'behavior', 'pain', 'mobility', 'hygiene', 'emotional', 'alert'],
      default: 'general',
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    recordedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    recordedAt:  { type: Date, default: Date.now },
    isResolved:  { type: Boolean, default: false },
    resolvedAt:  { type: Date },
    resolvedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

// ─── MAIN SCHEMA ─────────────────────────────────────────────────────────────
const patientCareRecordSchema = new Schema(
  {
    // ── Linkage ──────────────────────────────────────────────────────────────
    booking: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },
    patient: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    patientName:  { type: String, trim: true }, // snapshot
    careAssistant: {
      type:     Schema.Types.ObjectId,
      ref:      'CareAssistantProfile',
      required: true,
      index:    true,
    },

    // ── Source OP record (doctor's prescription chain) ────────────────────────
    /**
     * Link to OutPatientRecord for prescription context.
     * Care assistant reads prescriptionUrl + followUpExpiry from here.
     * Does NOT duplicate prescription — only references it.
     */
    outPatientRecord: {
      type:    Schema.Types.ObjectId,
      ref:     'OutPatientRecord',
      default: null,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['active', 'discharged', 'transferred', 'on_hold'],
      default: 'active',
      index:   true,
    },
    assignedAt:    { type: Date, default: Date.now },
    dischargedAt:  { type: Date },
    dischargeNotes:{ type: String, maxlength: 1000 },

    // ── IMMUTABLE: Hospital Instructions ─────────────────────────────────────
    /**
     * Production rule: NEVER update existing entries.
     * API layer: only push new entries. No PUT/PATCH on existing _id.
     * Expose via virtual for reads. Direct array hidden from API response.
     */
    hospitalInstructions: {
      type:   [hospitalInstructionSchema],
      default: [],
      select: false,  // hidden from default API response; use virtual
    },

    // ── Vitals Log (capped at 500 per record) ─────────────────────────────────
    vitalsLog: {
      type:   [vitalsEntrySchema],
      default: [],
    },

    // ── Food Log (capped at 200 per record) ───────────────────────────────────
    foodLog: {
      type:   [foodEntrySchema],
      default: [],
    },

    // ── Medicine Administration Log ───────────────────────────────────────────
    medicineLog: {
      type:   [medicineAdminSchema],
      default: [],
    },

    // ── Care Notes ────────────────────────────────────────────────────────────
    careNotes: {
      type:   [careNoteSchema],
      default: [],
    },

    // ── Quick Snapshot (for care assistant dashboard header) ──────────────────
    /**
     * Denormalised from CustomerProfile.snapshot.
     * Copy at record creation. Care assistant updates vitals here too.
     * Source of truth for emergency card shown at top of care view.
     */
    patientSnapshot: {
      bloodGroup:        { type: String },
      allergies:         [{ type: String }],
      chronicConditions: [{ type: String }],
      primaryLanguage:   { type: String, default: 'English' },
      emergencyContact: {
        name:     { type: String },
        phone:    { type: String },
        relation: { type: String },
      },
    },

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

// ─── VIRTUALS ─────────────────────────────────────────────────────────────────

// Expose hospital instructions read-only (select:false on raw field)
patientCareRecordSchema.virtual('instructions').get(function () {
  return this.hospitalInstructions ?? [];
});

patientCareRecordSchema.virtual('latestVitals').get(function () {
  if (!this.vitalsLog?.length) return null;
  return this.vitalsLog[this.vitalsLog.length - 1];
});

patientCareRecordSchema.virtual('openAlerts').get(function () {
  return (this.careNotes ?? []).filter(n => n.severity === 'critical' && !n.isResolved);
});

patientCareRecordSchema.virtual('todaysMissedMeds').get(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (this.medicineLog ?? []).filter(
    m => m.status === 'missed' && m.scheduledAt >= today
  );
});

// ─── PRE-SAVE ─────────────────────────────────────────────────────────────────

patientCareRecordSchema.pre('save', function () {
  // Cap arrays to avoid unbounded growth
  if (this.vitalsLog?.length > 500) {
    this.vitalsLog = this.vitalsLog.slice(-500);
  }
  if (this.foodLog?.length > 200) {
    this.foodLog = this.foodLog.slice(-200);
  }
  if (this.medicineLog?.length > 500) {
    this.medicineLog = this.medicineLog.slice(-500);
  }
  if (this.careNotes?.length > 300) {
    this.careNotes = this.careNotes.slice(-300);
  }

  // Stamp dischargedAt
  if (this.isModified('status') && this.status === 'discharged' && !this.dischargedAt) {
    this.dischargedAt = new Date();
  }
});

// ─── INDEXES ──────────────────────────────────────────────────────────────────

patientCareRecordSchema.index({ patient: 1, status: 1 });
patientCareRecordSchema.index({ careAssistant: 1, status: 1 });
patientCareRecordSchema.index({ booking: 1 }, { unique: true }); // one record per booking
patientCareRecordSchema.index({ 'careNotes.severity': 1, 'careNotes.isResolved': 1 });
patientCareRecordSchema.index({ createdAt: -1 });

const PatientCareRecord = mongoose.model('PatientCareRecord', patientCareRecordSchema);
export default PatientCareRecord;