import mongoose from 'mongoose';
const { Schema } = mongoose;

const geoPointSchema = new Schema(
  { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number], address: String },
  { _id: false }
);

const destinationChangeAuditSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    ride:    { type: Schema.Types.ObjectId, ref: 'Ride', index: true },

    oldDestination: { type: geoPointSchema, required: true },
    newDestination: { type: geoPointSchema, required: true },

    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // admin-role enforced at service layer
    reason:    { type: String, required: true },

    routeVersion: { type: Schema.Types.ObjectId, ref: 'RouteVersion', default: null },

    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

destinationChangeAuditSchema.index({ booking: 1, changedAt: -1 });

export default mongoose.model('DestinationChangeAudit', destinationChangeAuditSchema);