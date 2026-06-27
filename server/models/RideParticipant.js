import mongoose from 'mongoose';
const { Schema } = mongoose;

const PARTICIPANT_ROLES = ['CARE_ASSISTANT', 'NURSE', 'TECHNICIAN', 'ESCORT', 'FAMILY', 'EQUIPMENT_HANDLER', 'DOCTOR'];
const PARTICIPANT_STATUSES = ['PENDING', 'EN_ROUTE', 'AT_JOIN_POINT', 'IN_VEHICLE', 'AT_HOSPITAL', 'DEPARTED', 'REPLACED'];
const JOIN_MODES = ['IN_VEHICLE_BEFORE_PATIENT', 'IN_VEHICLE_AFTER_PATIENT', 'DIRECT_HOSPITAL', 'REPLACED', 'NOT_JOINED'];

const rideParticipantSchema = new Schema(
  {
    ride:    { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    role: { type: String, enum: PARTICIPANT_ROLES, required: true, index: true },

    // polymorphic — CareAssistantProfile today, anything tomorrow, zero schema change
    refModel: { type: String, enum: ['CareAssistantProfile', 'User', null], default: null },
    refId:    { type: Schema.Types.ObjectId, refPath: 'refModel', default: null },

    joinMode: { type: String, enum: JOIN_MODES, default: 'NOT_JOINED' },
    status:   { type: String, enum: PARTICIPANT_STATUSES, default: 'PENDING', index: true },

    joinedAt: Date,
    departedAt: Date,

    isReplacement: { type: Boolean, default: false },
    replacesParticipant: { type: Schema.Types.ObjectId, ref: 'RideParticipant', default: null },
    replacementReason: String,

    // immutable snapshot at assignment time — survives if the underlying profile changes later
    snapshot: { name: String, phone: String, photoUrl: String },

    isActive: { type: Boolean, default: true, index: true }, // false once replaced

    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

rideParticipantSchema.index({ ride: 1, role: 1, isActive: 1 });
rideParticipantSchema.index({ booking: 1 });
rideParticipantSchema.index({ refId: 1, status: 1 });

export default mongoose.model('RideParticipant', rideParticipantSchema);