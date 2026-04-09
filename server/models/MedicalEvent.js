import mongoose from "mongoose";

const { Schema } = mongoose;
const medicalEventSchema = new Schema({
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  patient: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  // Care Assistant Journey & Logistics Log
  careLog: {
    actualPickupTime: Date,
    actualDropTime: Date,
    
    // Patient Care Tracking
    mealTracking: {
      hasEaten: { type: Boolean, default: false },
      foodDetails: String, // e.g., "Liquid diet / Light breakfast"
      mealTime: Date,
      mealPhotoUrl: String // Evidence of patient eating/meal
    },
    
    // Journey Milestones
    stopsCompleted: [{
      location: String,
      arrivalTime: Date,
      departureTime: Date,
      note: String
    }],

    // Real-time Evidence Uploads
    activityPhotos: [String], // General photos of the patient/journey
    assistantNotes: String
  },

  // Doctor's Clinical Documentation
  doctorConsultation: {
    doctorId: { type: Schema.Types.ObjectId, ref: 'DoctorProfile' },
    symptoms: String,
    diagnosis: String,
    
    // Prescriptions & Tests
    ePrescription: [{
      medicineName: String,
      dosage: String,
      frequency: String, // e.g., "1-0-1"
      instruction: String // e.g., "After Food"
    }],
    specialRecommendedTests: [{
      testName: String,
      reason: String,
      isUrgent: { type: Boolean, default: false }
    }],
    followUpInstructions: String
  },

  // Execution Evidence & Billing (Multi-Type)
  records: {
    billingType: { type: String, enum: ['OPD', 'Pharmacy', 'Diagnostics', 'Transportation'] },
    billingImages: [String], // Photos of hospital/pharmacy bills
    prescriptionImages: [String], // Photos of physical doctor prescriptions
    labReportImages: [String], // Photos of physical test results
    otherDocuments: [String] // Insurance claims or ID proofs
  },

  // Summary & Status
  finalConclusion: String,
  isEventClosed: { type: Boolean, default: false }
}, { timestamps: true });

const MedicalEvent = mongoose.model('MedicalEvent', medicalEventSchema);
export default MedicalEvent;