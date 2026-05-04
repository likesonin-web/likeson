/**
 * OutPatientRecord Model — Likeson.in
 *
 * Generated for every doctor_consultation booking.
 * OP Number format: OP-<YYYYMMDD>-<HOSPCODE>-<SEQ>
 *
 * Tracks:
 *  - Follow-up eligibility window (followUpExpiry)
 *  - Consultation fee & source
 *  - Whether covered by subscription
 *  - Parent OP (for follow-up chain)
 *  - Doctor notes & prescription
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

const outPatientRecordSchema = new Schema(
  {
    // ── OP Identifier ─────────────────────────────────────────────────────────
    opNumber: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
      // Format: OP-20260427-VIJAYA-0001
    },

    // ── Linkage ───────────────────────────────────────────────────────────────
    booking: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      index:    true,
    },
    // AFTER
bookingNumber: {
  type: String,
  trim: true,
  index: true,   // just a regular index for query performance, no unique constraint
  validate: {
    validator: function (v) {
      return v == null || v.length > 0;
    },
    message: 'bookingNumber cannot be empty string',
  },
},

    // ── Patient ───────────────────────────────────────────────────────────────
    patient: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    patientName: { type: String, trim: true },

    // ── Doctor & Hospital ─────────────────────────────────────────────────────
    doctor: {
      type:     Schema.Types.ObjectId,
      ref:      'DoctorProfile',
      required: true,
      index:    true,
    },
    hospital: {
      type:  Schema.Types.ObjectId,
      ref:   'Hospital',
      default: null,
      index: true,
    },

    // ── Consultation Details ──────────────────────────────────────────────────
    consultationType: {
      type: String,
      enum: ['in_person', 'video', 'home_visit', 'follow_up'],
      required: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    startedAt:   { type: Date },
    completedAt: { type: Date },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
      index:   true,
    },

    // ── Billing ───────────────────────────────────────────────────────────────
    consultationFee: { type: Number, default: 0 },
    feeSource: {
      type:    String,
      enum:    ['hospital', 'doctor', 'subscription', 'follow_up', 'default'],
      default: 'default',
    },
    isCoveredBySubscription: { type: Boolean, default: false },

    // ── Follow-Up Chain ───────────────────────────────────────────────────────
    /**
     * isFollowUp: true = this OP is a follow-up of parentOp
     * parentOp:  reference to the original consultation OP
     * followUpExpiry: date until follow-up can be booked FREE for this OP
     * followUpFee: reduced fee if follow-up is within window
     */
    isFollowUp: { type: Boolean, default: false, index: true },
    parentOp: {
      type:    Schema.Types.ObjectId,
      ref:     'OutPatientRecord',
      default: null,
    },
    followUpExpiry: {
      type:    Date,
      default: null,
      index:   true,
      comment: 'Until this date, a follow-up can be booked at followUpFee (often 0)',
    },
    followUpFee: {
      type:    Number,
      default: 0,
      comment: 'Fee charged if patient books follow-up within followUpExpiry window',
    },

    // ── Clinical Notes ────────────────────────────────────────────────────────
    reasonForVisit:  { type: String, maxlength: 500 },
    doctorNotes:     { type: String, maxlength: 3000 },
    prescriptionUrl: { type: String },
    diagnosisCode:   { type: String }, // ICD-10 optional

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

// ── Virtuals ──────────────────────────────────────────────────────────────────
outPatientRecordSchema.virtual('isFollowUpEligible').get(function () {
  if (!this.followUpExpiry) return false;
  return new Date() < this.followUpExpiry;
});

outPatientRecordSchema.virtual('daysUntilFollowUpExpiry').get(function () {
  if (!this.followUpExpiry) return 0;
  return Math.max(
    Math.ceil((this.followUpExpiry - new Date()) / (1000 * 60 * 60 * 24)),
    0
  );
});

// ── Indexes ───────────────────────────────────────────────────────────────────
outPatientRecordSchema.index({ patient: 1, doctor: 1, status: 1 });
outPatientRecordSchema.index({ patient: 1, doctor: 1, followUpExpiry: 1 });
outPatientRecordSchema.index({ hospital: 1, scheduledAt: -1 });
outPatientRecordSchema.index({ doctor: 1, scheduledAt: -1 });
outPatientRecordSchema.index({ createdAt: -1 });

const OutPatientRecord = mongoose.model('OutPatientRecord', outPatientRecordSchema);
export default OutPatientRecord;