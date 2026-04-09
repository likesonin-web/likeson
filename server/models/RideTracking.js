import mongoose from 'mongoose';
const { Schema } = mongoose;

const rideTrackingSchema = new Schema({
  ride: { 
    type: Schema.Types.ObjectId, 
    ref: 'Ride', 
    required: true, 
    unique: true // One tracking document per ride leg
  },
  
  // Real-time Coordinates (Optimized for performance)
  currentLocation: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [longitude, latitude]
  },
  
  // Breadcrumbs for drawing the route on the map
  path: [{
    lat: Number,
    lng: Number,
    speed: Number,
    heading: Number, // Direction of the vehicle
    timestamp: { type: Date, default: Date.now }
  }],

  // Telemetry Data
  metrics: {
    remainingDistanceMeter: Number,
    remainingDurationSecond: Number,
    lastUpdateAt: Date
  }
}, { timestamps: true });

// Geo-index for "Find nearest vehicle" or proximity alerts
rideTrackingSchema.index({ currentLocation: "2dsphere" });

const RideTracking = mongoose.model('RideTracking', rideTrackingSchema);
export default RideTracking;