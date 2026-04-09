import mongoose from 'mongoose';
const { Schema } = mongoose;

const meetingSchema = new Schema({
  roomName: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true 
  },
  title: { type: String, required: true },
  description: { type: String },
  host: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  participants: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date },
    role: { type: String, enum: ['moderator', 'participant'], default: 'participant' }
  }],
  status: { 
    type: String, 
    enum: ['scheduled', 'active', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  actualDuration: { type: Number },
  
  // New Field: Explicitly stored Join URL (optional but helpful for deep linking)
  joinUrl: { type: String },

  config: {
    isLocked: { type: Boolean, default: false },
    password: { type: String, select: false },
    jwtToken: { type: String, select: false }, 
  },
  meetingType: { 
    type: String, 
    enum: ['consultation', 'internal', 'support'], 
    default: 'consultation' 
  },
  relatedId: { type: Schema.Types.ObjectId }, 
  relatedType: { type: String }
}, { 
  timestamps: true,
  toJSON: { virtuals: true }, // Ensure virtuals are sent to frontend
  toObject: { virtuals: true }
});

/**
 * VIRTUAL PROPERTY: Dynamic Join Link
 * This ensures the URL always reflects the correct domain from your .env
 */
meetingSchema.virtual('dynamicJoinUrl').get(function() {
  const domain = process.env.JITSI_DOMAIN || 'meet.jit.si';
  // If you store a JWT in the meeting doc, we append it
  const tokenPart = this.config?.jwtToken ? `?jwt=${this.config.jwtToken}` : '';
  return `https://${domain}/${this.roomName}${tokenPart}`;
});

// Middleware to auto-generate Room Name AND Join URL
meetingSchema.pre('validate', async function() {
  if (!this.roomName) {
    this.roomName = `likeson-room-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
  
  // If joinUrl isn't manually set, generate the default public one
  if (!this.joinUrl) {
    const domain = process.env.JITSI_DOMAIN || 'meet.jit.si';
    this.joinUrl = `https://${domain}/${this.roomName}`;
  }
 
});

const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;