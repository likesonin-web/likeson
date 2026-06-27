import mongoose from 'mongoose';
const { Schema } = mongoose;

const ASSIGNMENT_TYPES = ['DRIVER', 'CARE_ASSISTANT', 'VEHICLE', 'PARTICIPANT'];
const ASSIGNMENT_ACTIONS = ['ASSIGNED', 'ACCEPTED', 'REPLACED', 'REMOVED'];

const assignmentHistorySchema = new Schema(
  {
    ride:    { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    assignmentType: { type: String, enum: ASSIGNMENT_TYPES, required: true, index: true },

    // polymorphic — Driver / SoloDriverPartner / CareAssistantProfile / Vehicle / RideParticipant
    entityRefModel: { type: String, required: true },
    entityRefId:    { type: Schema.Types.ObjectId, refPath: 'entityRefModel', required: true },

    action: { type: String, enum: ASSIGNMENT_ACTIONS, required: true },

    previousAssignmentId: { type: Schema.Types.ObjectId, ref: 'AssignmentHistory', default: null },

    performedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = system
    reason: { type: String },

    effectiveAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // append-only, no updates ever
);

assignmentHistorySchema.index({ ride: 1, assignmentType: 1, createdAt: -1 });
assignmentHistorySchema.index({ booking: 1 });
assignmentHistorySchema.index({ entityRefId: 1, assignmentType: 1 });

export default mongoose.model('AssignmentHistory', assignmentHistorySchema);