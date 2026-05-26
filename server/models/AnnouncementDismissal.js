// models/AnnouncementDismissal.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const announcementDismissalSchema = new Schema({
  announcement:      { type: Schema.Types.ObjectId, ref: 'Announcement', required: true },
  user:              { type: Schema.Types.ObjectId, ref: 'User' },
  deviceFingerprint: { type: String },
  ipAddress:         { type: String },
  createdAt:         { type: Date, default: Date.now },
});

announcementDismissalSchema.index(
  { announcement: 1, user: 1 },
  { unique: true, sparse: true }
);
announcementDismissalSchema.index(
  { announcement: 1, deviceFingerprint: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model('AnnouncementDismissal', announcementDismissalSchema);