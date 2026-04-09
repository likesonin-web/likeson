import mongoose from "mongoose";
const { Schema } = mongoose;

 

 
const rideSchema = new Schema({
  // Linkage to the master booking
  booking: { 
    type: Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true,
    index: true 
  },
  
  // Leg Identification (Crucial for multi-ride bookings)
  legSequence: { 
    type: Number, 
    default: 1, 
    comment: "1 for Home-Hosp, 2 for Hosp-Lab, 3 for Hosp-Home" 
  },
  legType: {
    type: String,
    enum: ['Pickup-to-Hospital', 'Hospital-to-Lab', 'Lab-to-Hospital', 'Hospital-to-Home', 'Custom-Leg'],
    required: true
  },

  // Participants
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  careAssistant: { type: Schema.Types.ObjectId, ref: 'CareAssistantProfile' }, // Assistant requesting the ride
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  transportPartner: { type: Schema.Types.ObjectId, ref: 'TransportPartner', required: true },

  // Dynamic Routing
  pickupLocation: {
    address: { type: String, required: true },
    coordinates: {
      type: { type: String, default: 'Point' },
      coordinates: [Number] 
    }
  },
  dropLocation: {
    address: { type: String, required: true },
    coordinates: {
      type: { type: String, default: 'Point' },
      coordinates: [Number]
    }
  },

  // Status & Security
  status: {
    type: String,
    enum: ['Assigned', 'Accepted', 'En-Route', 'Arrived', 'Started', 'Completed', 'Cancelled'],
    default: 'Assigned'
  },
  startOTP: { type: String, required: true },
  endOTP: { type: String, required: true },

  // Real-time Telemetry
  liveLocation: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  
  // Ride Evidence (Requested: Billing & Logistics)
  images: {
    pickupPhoto: String,
    dropPhoto: String,
    tollReceipts: [String]
  },

  // Logistics Metrics
  startTime: Date,
  endTime: Date,
  distanceKm: { type: Number, default: 0 },
  waitingTimeMinutes: { type: Number, default: 0 } // Important if driver waits during tests

}, { timestamps: true });

rideSchema.index({ liveLocation: "2dsphere" });

const Ride = mongoose.model('Ride', rideSchema);
 
export default Ride;