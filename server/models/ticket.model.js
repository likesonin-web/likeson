// models/TicketAuditLog

import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TICKET_STATUSES = [
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER',
  'WAITING_FOR_PARTNER', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED',
];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const TICKET_DEPARTMENTS = [
  'GENERAL_SUPPORT', 'FINANCE', 'KYC_VERIFICATION', 'TECHNICAL_SUPPORT',
  'PARTNER_OPERATIONS', 'COMPLAINTS', 'BILLING', 'SUBSCRIPTIONS',
  'REFUNDS', 'ACCOUNT_SECURITY',
];

export const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'FILE', 'SYSTEM', 'INTERNAL_NOTE', 'MENTION', 'ATTACHMENT'];

export const CUSTOMER_ROLE = 'customer';
export const PARTNER_ROLES = ['doctor','hospital','transportpartner','driver','solodriverpartner','pharmacy','care_assistant','lab_partner','blood_bank'];
export const ADMIN_ROLES   = ['admin', 'superadmin', 'finance'];

export const SLA_HOURS = { LOW: 48, MEDIUM: 24, HIGH: 6, CRITICAL: 2 };

// ─── TicketCounter ────────────────────────────────────────────────────────────

const ticketCounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const TicketCounter = mongoose.model('TicketCounter', ticketCounterSchema);

export async function generateTicketNumber() {
  const counter = await TicketCounter.findByIdAndUpdate(
    'ticket',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `LSN-TKT-${String(counter.seq).padStart(6, '0')}`;
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

const ticketSchema = new Schema(
  {
    ticketNumber:        { type: String, unique: true, index: true },
    subject:             { type: String, required: true, trim: true, maxlength: 500 },
    description:         { type: String, required: true, maxlength: 5000 },
    department:          { type: String, enum: TICKET_DEPARTMENTS, required: true },
    priority:            { type: String, enum: TICKET_PRIORITIES, default: 'MEDIUM' },
    status:              { type: String, enum: TICKET_STATUSES, default: 'OPEN', index: true },

    customer:            { type: Schema.Types.ObjectId, ref: 'User', index: true },
    partner:             { type: Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy:           { type: Schema.Types.ObjectId, ref: 'User', required: true },

    assignedAdmins:      [{ type: Schema.Types.ObjectId, ref: 'User' }],
    assignedFinanceUsers:[{ type: Schema.Types.ObjectId, ref: 'User' }],
    watchers:            [{ type: Schema.Types.ObjectId, ref: 'User' }],
    tags:                [String],

    lastMessageAt:       { type: Date },
    lastMessageBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    firstResponseAt:     { type: Date },
    resolvedAt:          { type: Date },
    closedAt:            { type: Date },
    reopenedCount:       { type: Number, default: 0 },

    slaDeadline:         { type: Date },
    isEscalated:         { type: Boolean, default: false },
    escalatedAt:         { type: Date },
    escalatedBy:         { type: Schema.Types.ObjectId, ref: 'User' },

    isDeleted:           { type: Boolean, default: false },
    deletedBy:           { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt:           { type: Date },

    metadata:            { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ticketSchema.index({ priority: 1 });
ticketSchema.index({ department: 1 });
ticketSchema.index({ customer: 1, status: 1 });
ticketSchema.index({ partner: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ assignedAdmins: 1, status: 1 });
ticketSchema.index({ status: 1, priority: 1, department: 1 });
ticketSchema.index({ ticketNumber: 'text', subject: 'text', description: 'text' });

export const Ticket = mongoose.model('Ticket', ticketSchema);

// ─── TicketMessage ────────────────────────────────────────────────────────────

const ticketMessageSchema = new Schema(
  {
    ticket:      { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    sender:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole:  { type: String, required: true },
    message:     { type: String, required: true, maxlength: 5000 },
    messageType: { type: String, enum: MESSAGE_TYPES, default: 'TEXT' },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'TicketAttachment' }],
    mentions:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
    replyTo:     { type: Schema.Types.ObjectId, ref: 'TicketMessage' },

    isEdited:    { type: Boolean, default: false },
    editedAt:    { type: Date },

    isDeleted:   { type: Boolean, default: false },
    deletedBy:   { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt:   { type: Date },
    deleteReason:{ type: String },

    readBy:      [{ user: Schema.Types.ObjectId, readAt: Date }],
    deliveredTo: [{ user: Schema.Types.ObjectId, deliveredAt: Date }],
  },
  { timestamps: true }
);

ticketMessageSchema.index({ ticket: 1, createdAt: 1 });
ticketMessageSchema.index({ sender: 1 });
ticketMessageSchema.index({ message: 'text' });

export const TicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);

// ─── TicketAttachment ─────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg','image/png','image/gif','image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
];

const ticketAttachmentSchema = new Schema(
  {
    ticket:          { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    message:         { type: Schema.Types.ObjectId, ref: 'TicketMessage' },
    uploadedBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName:        { type: String, required: true },
    originalName:    { type: String, required: true },
    fileType:        { type: String },
    mimeType:        { type: String, enum: ALLOWED_MIME_TYPES },
    fileSize:        { type: Number, max: 10 * 1024 * 1024 },
    imageKitFileId:  { type: String },
    imageKitUrl:     { type: String, required: true },
    thumbnailUrl:    { type: String },
  },
  { timestamps: true }
);

export const TicketAttachment = mongoose.model('TicketAttachment', ticketAttachmentSchema);

// ─── TicketParticipant ────────────────────────────────────────────────────────

const ticketParticipantSchema = new Schema(
  {
    ticket:        { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    user:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:          { type: String, required: true },
    joinedAt:      { type: Date, default: Date.now },
    lastSeenAt:    { type: Date },
    unreadCount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

ticketParticipantSchema.index({ ticket: 1, user: 1 }, { unique: true });

export const TicketParticipant = mongoose.model('TicketParticipant', ticketParticipantSchema);

// ─── TicketInternalNote ───────────────────────────────────────────────────────

const ticketInternalNoteSchema = new Schema(
  {
    ticket:      { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    author:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note:        { type: String, required: true, maxlength: 5000 },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'TicketAttachment' }],
    mentions:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export const TicketInternalNote = mongoose.model('TicketInternalNote', ticketInternalNoteSchema);

// ─── TicketAssignment ─────────────────────────────────────────────────────────

const ticketAssignmentSchema = new Schema(
  {
    ticket:      { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    assignedBy:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt:  { type: Date, default: Date.now },
    reason:      { type: String },
    type:        { type: String, enum: ['ASSIGN', 'TRANSFER', 'UNASSIGN'], default: 'ASSIGN' },
  },
  { timestamps: true }
);

export const TicketAssignment = mongoose.model('TicketAssignment', ticketAssignmentSchema);

// ─── TicketActivity ───────────────────────────────────────────────────────────

const ticketActivitySchema = new Schema(
  {
    ticket:     { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    actor:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole:  { type: String, required: true },
    action:     { type: String, required: true },
    metadata:   { type: Schema.Types.Mixed, default: {} },
    createdAt:  { type: Date, default: Date.now, immutable: true },
  }
);

ticketActivitySchema.index({ ticket: 1, createdAt: 1 });

export const TicketActivity = mongoose.model('TicketActivity', ticketActivitySchema);

// ─── TicketRating ─────────────────────────────────────────────────────────────

const ticketRatingSchema = new Schema(
  {
    ticket:    { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
    ratedBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating:    { type: Number, min: 1, max: 5, required: true },
    review:    { type: String, maxlength: 1000 },
    ratedAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const TicketRating = mongoose.model('TicketRating', ticketRatingSchema);

// ─── TicketAuditLog ───────────────────────────────────────────────────────────

const ticketAuditLogSchema = new Schema(
  {
    ticket:     { type: Schema.Types.ObjectId, ref: 'Ticket', index: true },
    actor:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole:  { type: String, required: true },
    action:     { type: String, required: true },
    ip:         { type: String },
    userAgent:  { type: String },
    oldValue:   { type: Schema.Types.Mixed },
    newValue:   { type: Schema.Types.Mixed },
    createdAt:  { type: Date, default: Date.now, immutable: true },
  }
);

ticketAuditLogSchema.index({ actor: 1, createdAt: -1 });

export const TicketAuditLog = mongoose.model('TicketAuditLog', ticketAuditLogSchema);