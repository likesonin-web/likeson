import mongoose from 'mongoose';
const { Schema } = mongoose;

const SOS_TRIGGER_ROLES = ['PATIENT', 'DRIVER', 'CARE_ASSISTANT', 'ADMIN', 'FAMILY'];
const SOS_TYPES = ['MEDICAL', 'SAFETY', 'VEHICLE_BREAKDOWN', 'ACCIDENT', 'PATIENT_CONDITION', 'OTHER'];
const NOTIFY_PARTIES = ['ADMIN', 'DRIVER', 'CARE_ASSISTANT', 'CUSTOMER', 'EMERGENCY_CONTACT', 'HOSPITAL'];

const sosEventSchema = new Schema(
  {
    ride:    { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    triggeredByRole:   { type: String, enum: SOS_TRIGGER_ROLES, required: true },
    triggeredByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    sosType: { type: String, enum: SOS_TYPES, required: true, index: true },
    description: String,

    // immutable snapshot at trigger time — frozen, never updated after insert
    snapshot: {
      coordinates: [Number],
      driver: { type: Schema.Types.ObjectId, ref: 'Driver' },
      careAssistant: { type: Schema.Types.ObjectId, ref: 'CareAssistantProfile' },
      rideStatus: String,
      capturedAt: { type: Date, default: Date.now },
    },

    notifiedParties: [{
      party: { type: String, enum: NOTIFY_PARTIES },
      notifiedAt: Date,
      channel: String,
    }],

    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: String,
  },
  { timestamps: { createdAt: true, updatedAt: true } } // updatedAt only moves on resolution fields
);

sosEventSchema.index({ ride: 1, isResolved: 1 });
sosEventSchema.index({ booking: 1 });
sosEventSchema.index({ sosType: 1, createdAt: -1 });

export default mongoose.model('SosEvent', sosEventSchema);