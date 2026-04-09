import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Delivery-receipt sub-schema ───────────────────────────────────────────────
const deliveryReceiptSchema = new Schema(
  {
    user:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt: { type: Date, default: null },
    readAt:      { type: Date, default: null },
  },
  { _id: false }
);

// ── Reaction sub-schema ────────────────────────────────────────────────────────
const reactionSchema = new Schema(
  {
    user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji:     { type: String, required: true, trim: true },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Attachment sub-schema ──────────────────────────────────────────────────────
const attachmentSchema = new Schema(
  {
    url:          { type: String, required: true },
    originalName: { type: String, default: null },
    mimeType:     { type: String, default: null },
    size:         { type: Number, default: 0 },
    thumbnailUrl: { type: String, default: null },
    duration:     { type: Number, default: null },
    width:        { type: Number, default: null },
    height:       { type: Number, default: null },
  },
  { _id: true }
);

// ── Location sub-schema ────────────────────────────────────────────────────────
const locationSchema = new Schema(
  {
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null },
    address:   { type: String, default: null },
  },
  { _id: false }
);

// ── Giphy sticker sub-schema ───────────────────────────────────────────────────
// Stores the data returned by the Giphy API so the GIF can be rendered
// client-side without re-fetching.  Only populated when type === 'sticker'.
const stickerSchema = new Schema(
  {
    // Giphy unique identifier (e.g. "xT9IgG50Fb7Mi0prBC")
    giphyId:    { type: String, required: true, trim: true },

    // Full-resolution GIF URL (Giphy CDN)
    giphyUrl:   { type: String, required: true },

    // Downsized / preview URL for thumbnail display
    previewUrl: { type: String, default: null },

    // Sticker title / alt-text from Giphy metadata
    title:      { type: String, default: null, trim: true },

    // Original dimensions from Giphy (used for layout / aspect-ratio)
    width:      { type: Number, default: null },
    height:     { type: Number, default: null },

    // Rating from Giphy (g, pg, pg-13, r) — useful for content filtering
    rating:     {
      type:    String,
      enum:    [null, 'g', 'pg', 'pg-13', 'r'],
      default: null,
    },
  },
  { _id: false }
);

// ── Main schema ────────────────────────────────────────────────────────────────
const messageSchema = new Schema(
  {
    // ── Thread ────────────────────────────────────────────────────────────────
    conversation: {
      type:     Schema.Types.ObjectId,
      ref:      'Conversation',
      required: true,
      index:    true,
    },

    sender: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    // ── Content type ──────────────────────────────────────────────────────────
    type: {
      type:     String,
      required: true,
      enum: [
        'text',
        'image',
        'video',
        'audio',
        'file',
        'location',
        'contact',
        'sticker',   // Giphy GIF sticker — see `sticker` field below
        'system',
        'call',
      ],
      default: 'text',
    },

    // ── Body ─────────────────────────────────────────────────────────────────
    content: {
      type:    String,
      default: '',
      trim:    true,
    },

    attachments: { type: [attachmentSchema], default: [] },

    // ── Giphy sticker payload ─────────────────────────────────────────────────
    // Only written when type === 'sticker'.  Stores all Giphy metadata needed
    // to render the GIF without a second API call on the client.
    sticker: {
      type:    stickerSchema,
      default: null,
    },

    // ── Location pin ──────────────────────────────────────────────────────────
    location: {
      type:    locationSchema,
      default: null,
    },

    // Contact card
    contact: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      name:   { type: String, default: null },
      phone:  { type: String, default: null },
    },

    // ── Threading / reply ─────────────────────────────────────────────────────
    replyTo: {
      type:    Schema.Types.ObjectId,
      ref:     'Message',
      default: null,
    },

    forwardedFrom: {
      messageId:      { type: Schema.Types.ObjectId, ref: 'Message',      default: null },
      conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
      senderId:       { type: Schema.Types.ObjectId, ref: 'User',         default: null },
    },

    // ── Delivery & read receipts ───────────────────────────────────────────────
    receipts: { type: [deliveryReceiptSchema], default: [] },

    // ── Reactions ─────────────────────────────────────────────────────────────
    reactions: { type: [reactionSchema], default: [] },

    // ── Edit history ──────────────────────────────────────────────────────────
    isEdited:    { type: Boolean, default: false },
    editHistory: [
      {
        content:  { type: String },
        editedAt: { type: Date, default: Date.now },
        _id:      false,
      },
    ],

    // ── Deletion ─────────────────────────────────────────────────────────────
    isDeleted:   { type: Boolean, default: false },
    deletedAt:   { type: Date,    default: null },
    deletedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deleteScope: {
      type:    String,
      enum:    ['deleted_for_sender', 'deleted_for_everyone'],
      default: null,
    },

    // ── Pin ───────────────────────────────────────────────────────────────────
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date,    default: null },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Star (per-user bookmarks) ─────────────────────────────────────────────
    starredBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // ── Mentions ─────────────────────────────────────────────────────────────
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // ── Scheduling ───────────────────────────────────────────────────────────
    isScheduled: { type: Boolean, default: false },
    scheduledAt: { type: Date,    default: null },
    deliveredAt: { type: Date,    default: null },

    // ── System message metadata ───────────────────────────────────────────────
    systemEvent: {
      event: {
        type: String,
        enum: [
          null,
          'group_created', 'member_added',   'member_removed',
          'member_left',   'admin_promoted',  'admin_demoted',
          'group_renamed', 'avatar_changed',  'call_started',
          'call_ended',    'call_missed',
        ],
        default: null,
      },
      affectedUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      meta:         { type: Schema.Types.Mixed,    default: null },
    },

    // ── Call summary (type === 'call') ────────────────────────────────────────
    call: {
      status:   { type: String, enum: [null, 'missed', 'answered', 'declined'], default: null },
      duration: { type: Number, default: 0 },
      callType: { type: String, enum: [null, 'audio', 'video'],                 default: null },
    },

    // ── TTL / auto-expiry (disappearing messages) ─────────────────────────────
    expiresAt: { type: Date, default: null, index: { expireAfterSeconds: 0, sparse: true } },

    // ── Encryption ───────────────────────────────────────────────────────────
    isEncrypted:     { type: Boolean, default: false },
    encryptionKeyId: { type: String,  default: null },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

messageSchema.virtual('reactionCount').get(function () {
  return this.reactions.length;
});

messageSchema.virtual('readBy').get(function () {
  return this.receipts.filter(r => r.readAt).map(r => r.user);
});

messageSchema.virtual('deliveredTo').get(function () {
  return this.receipts.filter(r => r.deliveredAt || r.readAt).map(r => r.user);
});

// ── Post-save: update Conversation.lastMessage + totalMessages ────────────────
messageSchema.post('save', async function (doc) {
  if (doc.isDeleted || doc.isScheduled) return;

  try {
    const { default: Conversation } = await import('./Conversation.js');

    // For stickers, use the Giphy title as a fallback content preview
    const contentPreview =
      doc.type === 'sticker'
        ? (doc.sticker?.title || 'Sticker')
        : (doc.content || '').slice(0, 100);

    await Conversation.findByIdAndUpdate(doc.conversation, {
      $set: {
        'lastMessage.messageId': doc._id,
        'lastMessage.senderId':  doc.sender,
        'lastMessage.content':   contentPreview,
        'lastMessage.type':      doc.type,
        'lastMessage.sentAt':    doc.createdAt,
      },
      $inc: { totalMessages: 1 },
    });
  } catch (err) {
    console.error('[Message post-save] failed to update Conversation:', err.message);
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, isPinned: 1 });
messageSchema.index({ mentions: 1 });
messageSchema.index(
  { isScheduled: 1, scheduledAt: 1 },
  { partialFilterExpression: { isScheduled: true } }
);
messageSchema.index({ isDeleted: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;