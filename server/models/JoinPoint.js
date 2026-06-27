import mongoose from 'mongoose';
const { Schema } = mongoose;

const geoPointSchema = new Schema(
  { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
  { _id: false }
);

const JOIN_POINT_STATUSES = ['CREATED', 'LOCKED', 'ARRIVED', 'SKIPPED', 'MISSED', 'COMPLETED'];
const JOIN_MODES = ['IN_VEHICLE_BEFORE_PATIENT', 'IN_VEHICLE_AFTER_PATIENT', 'DIRECT_HOSPITAL', 'REPLACED', 'NOT_JOINED'];

const joinPointSchema = new Schema(
  {
    ride:    { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    // generic participant — not hardcoded to CareAssistantProfile, future-proof
    participant: { type: Schema.Types.ObjectId, ref: 'RideParticipant', required: true, index: true },

    rideStop: { type: Schema.Types.ObjectId, ref: 'RideStop', default: null },

    location: { type: geoPointSchema, required: true }, // write-once after CREATED

    calculatedBy: { type: String, enum: ['routing_engine', 'admin_override'], default: 'routing_engine' },
    calculationMeta: {
      distanceFromParticipantKm: Number,
      distanceFromDriverKm: Number,
      etaMinutes: Number,
      routingEngineVersion: String,
    },

    status: { type: String, enum: JOIN_POINT_STATUSES, default: 'CREATED', index: true },

    // which attempt is this — 1st (before patient), 2nd (after patient pickup), etc.
    attemptNumber: { type: Number, required: true, default: 1, min: 1 },

    joinMode: { type: String, enum: JOIN_MODES, default: null },

    waitingConfig: {
      maxWaitMinutes: { type: Number, default: 10 },
      startedAt: { type: Date },
      endedAt: { type: Date },
    },

    lockedAt: Date,
    arrivedAt: Date,
    skippedAt: Date,
    missedAt: Date,
    completedAt: Date,

    // chain pointer — recalculation creates a NEW JoinPoint, never mutates an old one
    supersededBy: { type: Schema.Types.ObjectId, ref: 'JoinPoint', default: null },
    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

joinPointSchema.pre('validate', function () {
  if (this.isModified('location') && !this.isNew && this.status !== 'CREATED') {
    throw new Error('JoinPoint.location is immutable once locked — create a new JoinPoint instead');
  }
});

joinPointSchema.index({ ride: 1, attemptNumber: 1 });
joinPointSchema.index({ ride: 1, status: 1 });
joinPointSchema.index({ participant: 1, status: 1 });
joinPointSchema.index({ location: '2dsphere' });

export default mongoose.model('JoinPoint', joinPointSchema);