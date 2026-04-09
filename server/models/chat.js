import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const CHAT_ROLES = [
  'superadmin', 'admin', 'doctor', 'transportpartner',
  'driver', 'lab partner', 'finance', 'pharmacy', 'care assistant'
];

const PARTICIPANT_PERMISSIONS = ['member', 'mentor', 'host'];

// ─────────────────────────────────────────────
// 1. ATTACHMENT SCHEMA (Reusable Sub-document)
// ─────────────────────────────────────────────

const attachmentSchema = new Schema({
  url:        { type: String, required: true },
  publicId:   { type: String }, // e.g. ImageKit  
  fileName:   { type: String },
  fileSize:   { type: Number }, // bytes
  mimeType:   { type: String }, // e.g. 'image/png', 'application/pdf'
  type: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', 'other'],
    default: 'other'
  }
}, { _id: true, timestamps: false });

// ─────────────────────────────────────────────
// 2. REACTION SCHEMA (Reusable Sub-document)
// ─────────────────────────────────────────────

const reactionSchema = new Schema({
  emoji:  { type: String, required: true },  // e.g. '👍', '❤️'
  user:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reactedAt: { type: Date, default: Date.now }
}, { _id: false });

// ─────────────────────────────────────────────
// 3. MESSAGE MODEL
// ─────────────────────────────────────────────

const messageSchema = new Schema({
  conversation: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  senderRole: {
    type: String,
    enum: CHAT_ROLES,
    required: true
  },

  // ── Content ──
  body:        { type: String, default: '' },         // plain text / markdown
  attachments: { type: [attachmentSchema], default: [] },
  
  // ── Reply / Thread ──
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Inline quoted snapshot so the UI doesn't need an extra fetch
  replySnapshot: {
    senderName: String,
    body:       String,
    attachmentType: String  // e.g. 'image'
  },

  // ── Forwarding ──
  isForwarded:        { type: Boolean, default: false },
  originalMessage:    { type: Schema.Types.ObjectId, ref: 'Message', default: null },

  // ── Type Flags ──
  messageType: {
    type: String,
    enum: ['text', 'attachment', 'system', 'poll', 'call_log'],
    default: 'text'
  },
  // System message e.g. "Alice added Bob to the group"
  systemEvent: {
    type: String,
    enum: [
      'member_added', 'member_removed', 'group_created',
      'group_renamed', 'group_avatar_changed', 'call_started',
      'call_ended', null
    ],
    default: null
  },

  // ── Read Receipts ──
  readBy: [{
    user:   { type: Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],

  // ── Reactions ──
  reactions: { type: [reactionSchema], default: [] },

  // ── Moderation ──
  isDeleted:      { type: Boolean, default: false },
  deletedAt:      { type: Date },
  deletedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
  deleteType: {
    type: String,
    enum: ['for_me', 'for_everyone', null],
    default: null
  },

  isEdited:       { type: Boolean, default: false },
  editHistory: [{
    body:     String,
    editedAt: { type: Date, default: Date.now }
  }],

  isPinned:       { type: Boolean, default: false },
  pinnedAt:       { type: Date },
  pinnedBy:       { type: Schema.Types.ObjectId, ref: 'User' }

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, conversation: 1 });

// ─────────────────────────────────────────────
// 4. CONVERSATION MODEL
// ─────────────────────────────────────────────

const participantSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {                            // user's app role
    type: String,
    enum: CHAT_ROLES
  },
  permission: {                      // chat permission level
    type: String,
    enum: PARTICIPANT_PERMISSIONS,
    default: 'member'
  },

  // ── Per-participant state ──
  joinedAt:         { type: Date, default: Date.now },
  leftAt:           { type: Date, default: null },
  isActive:         { type: Boolean, default: true },

  // Mute
  isMuted:          { type: Boolean, default: false },
  mutedUntil:       { type: Date, default: null },

  // Notification preference
  notificationMode: {
    type: String,
    enum: ['all', 'mentions', 'none'],
    default: 'all'
  },

  // Last message the participant has seen
  lastSeenMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

  // Nickname inside this group
  nickname: { type: String, default: null }

}, { _id: false });

// ─────────────────────────────────────────────

const conversationSchema = new Schema({

  // ── Type ──
  type: {
    type: String,
    enum: ['direct', 'group', 'department_channel'],
    default: 'direct'
  },

  // ── Direct Chat ──
  // For type='direct', store the two users for fast lookup
  directParticipants: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // ── Group / Channel Details ──
  name:         { type: String, trim: true },      // group name
  description:  { type: String, default: '' },
  avatar:       { type: String, default: '' },     // group avatar URL
  avatarPublicId: { type: String },

  // Department channel (optional: restrict by role)
  department: {
    type: String,
    enum: [...CHAT_ROLES, null],
    default: null
  },

  // ── Participants ──
  participants: { type: [participantSchema], default: [] },

  // ── Roles allowed to join (for department_channel) ──
  allowedRoles: [{
    type: String,
    enum: CHAT_ROLES
  }],

  // ── Last Message Snapshot (for conversation list UI) ──
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastMessageAt: { type: Date, default: null },
  lastMessagePreview: { type: String, default: '' }, // truncated body or 'Attachment'

  // ── Pinned Messages ──
  pinnedMessages: [{
    type: Schema.Types.ObjectId,
    ref: 'Message'
  }],

  // ── Settings ──
  isArchived:        { type: Boolean, default: false },
  archivedAt:        { type: Date },
  isReadOnly:        { type: Boolean, default: false },  // only hosts can send
  allowMemberInvite: { type: Boolean, default: false },  // members can invite others
  allowReactions:    { type: Boolean, default: true },
  allowReplies:      { type: Boolean, default: true },
  
  maxParticipants:   { type: Number, default: 500 },

  // ── Admins / Ownership ──
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

  // ── Encryption (future-proof) ──
  isEncrypted: { type: Boolean, default: false }

}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

// Fast lookup for direct chats between two users
conversationSchema.index({ directParticipants: 1, type: 1 });
// Sort conversations by last activity
conversationSchema.index({ lastMessageAt: -1 });
// Find all conversations a user is in
conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 });
// Department channels
conversationSchema.index({ department: 1, type: 1 });

// ── Virtual: unread count helper (computed at query time via aggregation) ──
// This is a placeholder — real unread counts should use aggregation pipelines
conversationSchema.virtual('participantCount').get(function () {
  return this.participants.filter(p => p.isActive).length;
});

// ─────────────────────────────────────────────
// 5. CALL LOG MODEL (Optional but referenced)
// ─────────────────────────────────────────────

const callLogSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  initiatedBy:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{
    user:        { type: Schema.Types.ObjectId, ref: 'User' },
    joinedAt:    Date,
    leftAt:      Date,
    durationSec: Number
  }],
  callType: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'ongoing', 'ended', 'missed', 'declined'],
    default: 'initiated'
  },
  startedAt: { type: Date, default: Date.now },
  endedAt:   { type: Date },
  totalDurationSec: { type: Number, default: 0 }
}, { timestamps: true });

callLogSchema.index({ conversation: 1, startedAt: -1 });

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

export const Message      = mongoose.model('Message',      messageSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
export const CallLog      = mongoose.model('CallLog',      callLogSchema);