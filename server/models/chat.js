import mongoose from 'mongoose';

const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────

const participantSchema = new Schema(
  {
    user:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:       { type: String },
    joinedAt:   { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: null },
    isAdmin:    { type: Boolean, default: false },
    isMuted:    { type: Boolean, default: false },
    mutedUntil: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
    isDeleted:  { type: Boolean, default: false },
    notifyOn:   { type: String, enum: ['all', 'mentions', 'none'], default: 'all' },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     ['direct', 'group', 'support', 'order', 'service'],
      required: true,
      index:    true,
    },
    participants: { type: [participantSchema], default: [] },

    name:        { type: String, trim: true },
    description: { type: String },
    avatar:      { type: String },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User' },

    refModel: {
      type: String,
      enum: ['Order', 'Booking', 'LabTest', 'BloodRequest', 'PharmacyOrder', null],
    },
    refId: { type: Schema.Types.ObjectId, refPath: 'refModel', default: null },

    lastMessage: {
      _id:    { type: Schema.Types.ObjectId },
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      text:   { type: String },
      type:   { type: String },
      sentAt: { type: Date },
    },

    activeCall: {
      callId:    { type: Schema.Types.ObjectId, ref: 'Call' },
      startedAt: { type: Date },
      type:      { type: String, enum: ['audio', 'video'] },
    },

    isBlocked:  { type: Boolean, default: false },
    blockedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isPinned:   { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

conversationSchema.index({ 'participants.user': 1, updatedAt: -1 });
conversationSchema.index({ refModel: 1, refId: 1 });
conversationSchema.index(
  { type: 1, 'participants.user': 1 },
  { partialFilterExpression: { type: 'direct' } }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);


// ─────────────────────────────────────────────────────────────────────────────
// 2. MESSAGE
// ─────────────────────────────────────────────────────────────────────────────

const reactionSchema = new Schema(
  {
    user:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
    at:    { type: Date, default: Date.now },
  },
  { _id: false }
);

const deliveryReceiptSchema = new Schema(
  {
    user:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt: { type: Date, default: null },
    readAt:      { type: Date, default: null },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
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
    },

    type: {
      type:    String,
      enum:    [
        'text', 'image', 'video', 'audio', 'file',
        'location', 'contact', 'sticker', 'call_log', 'system', 'order_card',
      ],
      default: 'text',
    },

    text: { type: String, trim: true },

    media: {
      url:       { type: String },
      thumbnail: { type: String },
      mimeType:  { type: String },
      size:      { type: Number },
      duration:  { type: Number },
      width:     { type: Number },
      height:    { type: Number },
      fileName:  { type: String },
    },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
      address:     { type: String },
    },

    cardPayload: { type: Schema.Types.Mixed },

    replyTo:      { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    forwardedFrom: {
      message:      { type: Schema.Types.ObjectId, ref: 'Message' },
      conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    },

    receipts:  { type: [deliveryReceiptSchema], default: [] },
    reactions: { type: [reactionSchema], default: [] },

    isEdited:    { type: Boolean, default: false },
    editedAt:    { type: Date },
    editHistory: [{ text: String, editedAt: Date }],

    isDeleted:     { type: Boolean, default: false },
    deletedAt:     { type: Date },
    deletedFor:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedForAll: { type: Boolean, default: false },

    isSilent: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },

    callLog: {
      callId:    { type: Schema.Types.ObjectId, ref: 'Call' },
      callType:  { type: String, enum: ['audio', 'video'] },
      status:    { type: String, enum: ['answered', 'missed', 'declined', 'cancelled'] },
      duration:  { type: Number },
      initiator: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
// Full-text search on message text
messageSchema.index({ text: 'text' });

// ── FIX 1: post('save') — use new Date() not this.createdAt for updatedAt
//    this.createdAt is wrong on edit — edited messages should bump updatedAt to NOW
messageSchema.post('save', async function () {
  if (this.isDeleted || this.deletedForAll || this.type === 'system') return;
  const now = new Date();
  await Conversation.findByIdAndUpdate(this.conversation, {
    lastMessage: {
      _id:    this._id,
      sender: this.sender,
      text:   this.type === 'text' ? this.text : `[${this.type}]`,
      type:   this.type,
      sentAt: this.createdAt, // sentAt stays original creation time
    },
    updatedAt: now, // ← FIX: use now, not this.createdAt
  });
});

export const Message = mongoose.model('Message', messageSchema);


// ─────────────────────────────────────────────────────────────────────────────
// 3. CALL
// ─────────────────────────────────────────────────────────────────────────────

const callParticipantSchema = new Schema(
  {
    user:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uid:             { type: Number, required: true },
    token:           { type: String, select: false },
    joinedAt:        { type: Date },
    leftAt:          { type: Date },
    duration:        { type: Number, default: 0 },
    isMuted:         { type: Boolean, default: false },
    isCamOff:        { type: Boolean, default: false },
    isScreenSharing: { type: Boolean, default: false },
  },
  { _id: false }
);

const callSchema = new Schema(
  {
    conversation: {
      type:     Schema.Types.ObjectId,
      ref:      'Conversation',
      required: true,
      index:    true,
    },
    initiator: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    type: {
      type:     String,
      enum:     ['audio', 'video'],
      required: true,
    },

    channelName: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    agoraRecordingResourceId: { type: String },
    agoraRecordingSid:        { type: String },
    recordingUrls:            [{ type: String }],

    status: {
      type:    String,
      enum:    ['ringing', 'ongoing', 'ended', 'missed', 'declined', 'cancelled', 'failed'],
      default: 'ringing',
      index:   true,
    },

    participants:    { type: [callParticipantSchema], default: [] },
    startedAt:       { type: Date },
    endedAt:         { type: Date },
    duration:        { type: Number, default: 0 },
    endedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
    endReason:       { type: String, enum: ['normal', 'timeout', 'error', 'network'] },
    isGroupCall:     { type: Boolean, default: false },
    maxParticipants: { type: Number, default: 2 },
    isRecorded:      { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

callSchema.index({ initiator: 1, createdAt: -1 });
callSchema.index({ status: 1, createdAt: -1 });

// ── FIX 2: pre('save') duration calc — correct, no change needed
callSchema.pre('save', function () {
  if (this.isModified('status') && this.status === 'ended' && this.startedAt && this.endedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
});

// ── FIX 3: post('save') — Mongoose post hooks DO NOT have isModified()
//    Must track status change differently — use _statusChanged flag set in pre hook
callSchema.pre('save', function () {
  // Track whether status changed to a terminal state for post hook
  if (this.isModified('status')) {
    this._statusChangedTo = this.status;
  }
});

callSchema.post('save', async function () {
  const terminalStates = ['ended', 'missed', 'declined', 'cancelled'];
  // Use _statusChangedTo flag set in pre hook — isModified() not available in post
  if (!this._statusChangedTo || !terminalStates.includes(this._statusChangedTo)) return;

  const statusMap = {
    ended:     'answered',
    missed:    'missed',
    declined:  'declined',
    cancelled: 'cancelled',
  };

  try {
    await Message.create({
      conversation: this.conversation,
      sender:       this.initiator,
      type:         'call_log',
      isSilent:     true,
      callLog: {
        callId:    this._id,
        callType:  this.type,
        status:    statusMap[this._statusChangedTo] || 'missed',
        duration:  this.duration,
        initiator: this.initiator,
      },
    });
  } catch (err) {
    // Don't throw — call log failure shouldn't break the call end flow
    console.error('[Call.post] call_log message creation failed:', err.message);
  }

  // Clear activeCall from conversation
  await Conversation.findByIdAndUpdate(this.conversation, {
    $unset: { activeCall: 1 },
  });

  // Reset flag
  this._statusChangedTo = null;
});

export const Call = mongoose.model('Call', callSchema);


// ─────────────────────────────────────────────────────────────────────────────
// 4. MESSAGE STATUS
// ─────────────────────────────────────────────────────────────────────────────

const messageStatusSchema = new Schema(
  {
    message:      { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt:  { type: Date, default: null },
    readAt:       { type: Date, default: null },
  },
  { timestamps: false }
);

messageStatusSchema.index({ message: 1, user: 1 }, { unique: true });
messageStatusSchema.index({ conversation: 1, user: 1, readAt: 1 });

export const MessageStatus = mongoose.model('MessageStatus', messageStatusSchema);


// ─────────────────────────────────────────────────────────────────────────────
// 5. BLOCKED USERS
// ─────────────────────────────────────────────────────────────────────────────

const userBlockSchema = new Schema(
  {
    blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
userBlockSchema.index({ blocked: 1 });

export const UserBlock = mongoose.model('UserBlock', userBlockSchema);