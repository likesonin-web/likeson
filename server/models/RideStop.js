import mongoose from 'mongoose';
const { Schema } = mongoose;

const RIDE_STOP_TYPES = ['PATIENT_PICKUP', 'CARE_ASSISTANT_JOIN', 'HOSPITAL', 'PHARMACY', 'LAB', 'BLOOD_BANK', 'CUSTOM'];
const RIDE_STOP_STATUSES = ['PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED', 'MISSED'];

const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    address: String, label: String,
  },
  { _id: false }
);

const rideStopSchema = new Schema(
  {
    ride:    { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    routeVersion: { type: Number, required: true, default: 1, index: true }, // which RouteVersion this belongs to
    sequence:     { type: Number, required: true },

    stopType: { type: String, enum: RIDE_STOP_TYPES, required: true, index: true },
    location: { type: geoPointSchema, required: true },

    // generic — links to RideParticipant when stop concerns a person (CA join, escort, etc.)
    participant: { type: Schema.Types.ObjectId, ref: 'RideParticipant', default: null },

    status: { type: String, enum: RIDE_STOP_STATUSES, default: 'PENDING', index: true },

    arrival:   { expectedAt: Date, actualAt: Date },
    departure: { expectedAt: Date, actualAt: Date },
    waiting:   { startedAt: Date, endedAt: Date, minutes: { type: Number, default: 0 } },

    otp: {
      code:        { type: String, select: false },
      generatedAt: Date,
      verifiedAt:  Date,
    },

    isActive: { type: Boolean, default: true, index: true }, // false once superseded by new route version

    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// one active sequence per ride per version — prevents duplicate/clashing stop order
rideStopSchema.index({ ride: 1, routeVersion: 1, sequence: 1 }, { unique: true });
rideStopSchema.index({ ride: 1, status: 1 });
rideStopSchema.index({ booking: 1 });
rideStopSchema.index({ location: '2dsphere' });

export default mongoose.model('RideStop', rideStopSchema);