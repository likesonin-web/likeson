import mongoose from 'mongoose';
const { Schema } = mongoose;

const ROUTE_VERSION_REASONS = ['INITIAL', 'DESTINATION_CHANGE', 'CA_MISSED_JOINPOINT', 'DRIVER_REPLACED', 'ADMIN_RECALC', 'TRAFFIC_REROUTE'];

const routeVersionSchema = new Schema(
  {
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },

    versionNumber: { type: Number, required: true },

    stops: [{ type: Schema.Types.ObjectId, ref: 'RideStop' }], // ordered snapshot for fast read

    polyline: String,
    totalDistanceKm: Number,
    totalDurationMin: Number,

    generatedReason: { type: String, enum: ROUTE_VERSION_REASONS, required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = routing engine

    isActive: { type: Boolean, default: false, index: true }, // exactly one true per ride
    supersededAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

routeVersionSchema.index({ ride: 1, versionNumber: 1 }, { unique: true });
// partial unique index — enforces "only one active version per ride" at the DB level
routeVersionSchema.index({ ride: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.model('RouteVersion', routeVersionSchema);