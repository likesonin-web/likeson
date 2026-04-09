import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Participant sub-schema ─────────────────────────────────────────────────────
// Tracks per-member state: mute, last-read pointer, role inside the conversation.
const participantSchema = new Schema(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // Role inside THIS conversation (not the global user role)
    conversationRole: {
      type:    String,
      enum:    ['owner', 'admin', 'member'],
      default: 'member',
    },

    // Pointer to the last Message _id the participant has acknowledged.
    // Used to compute unread counts without storing per-user flags on messages.
    lastReadMessage: {
      type: Schema.Types.ObjectId,
      ref:  'Message',
      default: null,
    },

    // Soft-delete: participant left but history is preserved
    leftAt:  { type: Date, default: null },
    isActive:{ type: Boolean, default: true },

    // Notification preferences per conversation
    isMuted:   { type: Boolean, default: false },
    mutedUntil:{ type: Date,   default: null },

    // When was this participant added (differs from conversation.createdAt for late joiners)
    joinedAt: { type: Date, default: Date.now },

    // Who added them
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true }
);

// ── Main schema ────────────────────────────────────────────────────────────────
const conversationSchema = new Schema(
  {
    // ── Type ──────────────────────────────────────────────────────────────────
    type: {
      type:     String,
      required: true,
      enum: [
        'direct',        // 1-to-1 private DM
        'group',         // Named group chat (multi-user)
        'department',    // Dept-wide channel (role-scoped, e.g. all doctors)
        'broadcast',     // Admin → many (recipients can't reply to the thread)
        'support',       // Customer ↔ internal-team ticket thread
      ],
      default: 'direct',
    },

    // ── Identity ──────────────────────────────────────────────────────────────
    // Only relevant for group / department / broadcast conversations
    name:        { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    avatar:      { type: String, default: null },

    // ── Participants ──────────────────────────────────────────────────────────
    participants: {
      type:     [participantSchema],
      default:  [],
      validate: {
        validator: function (arr) {
          // Direct chat must have exactly 2 participants.
          if (this.type === 'direct') return arr.length === 2;
          // All other types need at least 1.
          return arr.length >= 1;
        },
        message: 'Direct conversations require exactly 2 participants.',
      },
    },

    // ── Department link ───────────────────────────────────────────────────────
    // When type === 'department', restrict membership to users with this role.
    departmentRole: {
      type: String,
      enum: [
        null, 'superadmin', 'admin', 'doctor', 'transportpartner',
        'driver', 'lab partner', 'customer', 'finance',
        'pharmacy', 'care assistant',
      ],
      default: null,
    },

    // ── Latest message snapshot ───────────────────────────────────────────────
    // Denormalized for fast conversation-list rendering (avoids extra lookups).
    lastMessage: {
      messageId:  { type: Schema.Types.ObjectId, ref: 'Message', default: null },
      senderId:   { type: Schema.Types.ObjectId, ref: 'User',    default: null },
      content:    { type: String, default: null },    // plain-text preview (truncated)
      type:       { type: String, default: 'text' },  // mirrors Message.type
      sentAt:     { type: Date,   default: null },
    },

    // ── Counts (maintained via post-save hooks on Message) ────────────────────
    totalMessages: { type: Number, default: 0 },

    // ── Settings ──────────────────────────────────────────────────────────────
    isArchived:      { type: Boolean, default: false },
    archivedAt:      { type: Date,    default: null },
    archivedBy:      { type: Schema.Types.ObjectId, ref: 'User', default: null },

    isPinned:        { type: Boolean, default: false },

    // Allow participants to send messages? (admins can lock a group)
    isReadOnly:      { type: Boolean, default: false },

    // End-to-end encryption key identifier (store the key ID, not the key itself)
    encryptionKeyId: { type: String, default: null },

    // ── Soft-delete ───────────────────────────────────────────────────────────
    isDeleted:  { type: Boolean, default: false },
    deletedAt:  { type: Date,    default: null },
    deletedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

/** Active (non-left) participants */
conversationSchema.virtual('activeParticipants').get(function () {
  return this.participants.filter(p => p.isActive && !p.leftAt);
});

/** Quick participant count */
conversationSchema.virtual('participantCount').get(function () {
  return this.participants.filter(p => p.isActive).length;
});

// ── Pre-save: guard direct-chat uniqueness ────────────────────────────────────
// Prevents duplicate DM threads between the same two users.
conversationSchema.pre('save', async function () {
  if (this.isNew && this.type === 'direct') {
    const ids = this.participants.map(p => p.user.toString()).sort();
    this._directKey = ids.join('_'); // used externally to check before creating
  }
   
});

// ── Indexes ───────────────────────────────────────────────────────────────────

// Fast lookup of all conversations a user belongs to
conversationSchema.index({ 'participants.user': 1 });

// Ensure only one direct thread per user pair
conversationSchema.index(
  { type: 1, 'participants.user': 1 },
  { partialFilterExpression: { type: 'direct' } }
);

conversationSchema.index({ type: 1, departmentRole: 1 });
conversationSchema.index({ 'lastMessage.sentAt': -1 });   // sort conversation list by recency
conversationSchema.index({ isDeleted: 1, isArchived: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;