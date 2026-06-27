/**
 * routes/support/upload.routes.js
 * ImageKit upload for support ticket attachments.
 * Uses existing ImageKit credentials from env.
 */

import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import ImageKit from 'imagekit';
import rateLimit from 'express-rate-limit';

import { protect } from '../../middleware/authMiddleware.js'; // adjust path
import { Ticket, TicketAttachment } from '../../models/ticket.model.js';
import { isValidObjectId, canAccessTicket, logActivity } from '../../utils/helpers.js';

const router = express.Router();

// ─── ImageKit Client ──────────────────────────────────────────────────────────

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ─── Multer (memory storage) ──────────────────────────────────────────────────

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

const BLOCKED_EXTENSIONS = /\.(exe|sh|bat|cmd|msi|dll|js|php|py|rb|pl|vbs|scr|com|jar)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error('File type not allowed'));
    if (BLOCKED_EXTENSIONS.test(file.originalname)) return cb(new Error('Executable files not allowed'));
    cb(null, true);
  },
});

const uploadLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many uploads' });

// ─── Folder resolver ──────────────────────────────────────────────────────────

function resolveFolder(context) {
  const map = {
    message:        '/support/attachments/',
    internal_note:  '/support/internal-notes/',
    ticket:         '/support/tickets/',
  };
  return map[context] || '/support/attachments/';
}

// ─── POST /upload/tickets/:ticketId ───────────────────────────────────────────

router.post('/tickets/:ticketId', protect, uploadLimit, upload.single('file'), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { context = 'message' } = req.body; // 'message' | 'internal_note' | 'ticket'

    if (!isValidObjectId(ticketId)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const ticket = await Ticket.findOne({ _id: ticketId, isDeleted: false }).lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, req.user)) return res.status(403).json({ success: false, message: 'Access denied' });

    const folder = resolveFolder(context);
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${ext}`;

    const ikResponse = await imagekit.upload({
      file:     req.file.buffer,
      fileName: fileName,
      folder:   folder,
      useUniqueFileName: false,
      tags:     [`ticket:${ticketId}`, `uploader:${req.user._id}`, `role:${req.user.role}`],
    });

    const isImage = req.file.mimetype.startsWith('image/');

    const attachment = await TicketAttachment.create({
      ticket:         ticketId,
      uploadedBy:     req.user._id,
      fileName:       ikResponse.name,
      originalName:   req.file.originalname,
      fileType:       ext,
      mimeType:       req.file.mimetype,
      fileSize:       req.file.size,
      imageKitFileId: ikResponse.fileId,
      imageKitUrl:    ikResponse.url,
      thumbnailUrl:   isImage ? ikResponse.thumbnailUrl || ikResponse.url : null,
    });

    await logActivity(ticketId, req.user, 'ATTACHMENT_UPLOADED', {
      attachmentId: attachment._id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    req.io?.to(`ticket:${ticketId}`).emit('attachment:uploaded', {
      ticketId,
      attachment: { _id: attachment._id, imageKitUrl: attachment.imageKitUrl, originalName: attachment.originalName, fileType: attachment.fileType },
    });

    return res.status(201).json({ success: true, data: attachment });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Max 10MB.' });
    }
    if (err.message?.includes('not allowed') || err.message?.includes('not allowed')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('[POST /upload/tickets/:ticketId]', err);
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ─── GET /upload/tickets/:ticketId/attachments ────────────────────────────────

router.get('/tickets/:ticketId/attachments', protect, async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!isValidObjectId(ticketId)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });

    const ticket = await Ticket.findOne({ _id: ticketId, isDeleted: false }).lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (!canAccessTicket(ticket, req.user)) return res.status(403).json({ success: false, message: 'Access denied' });

    const attachments = await TicketAttachment.find({ ticket: ticketId })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name email avatar role')
      .lean();

    return res.json({ success: true, data: attachments });
  } catch (err) {
    console.error('[GET /upload/tickets/:ticketId/attachments]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /upload/attachments/:attachmentId — SuperAdmin only ───────────────

router.delete('/attachments/:attachmentId', protect, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    if (!isValidObjectId(attachmentId)) return res.status(400).json({ success: false, message: 'Invalid attachment ID' });

    const attachment = await TicketAttachment.findById(attachmentId);
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found' });

    // Only uploader or superadmin can delete
    if (req.user.role !== 'superadmin' && attachment.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this attachment' });
    }

    // Delete from ImageKit
    if (attachment.imageKitFileId) {
      try {
        await imagekit.deleteFile(attachment.imageKitFileId);
      } catch (e) {
        console.warn('[upload] ImageKit delete failed:', e.message);
      }
    }

    await TicketAttachment.deleteOne({ _id: attachmentId });

    return res.json({ success: true, message: 'Attachment deleted' });
  } catch (err) {
    console.error('[DELETE /upload/attachments/:attachmentId]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /upload/imagekit-auth — ImageKit client-side auth token ──────────────

router.get('/imagekit-auth', protect, (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    return res.json({ success: true, data: authParams });
  } catch (err) {
    console.error('[GET /upload/imagekit-auth]', err);
    return res.status(500).json({ success: false, message: 'Auth token generation failed' });
  }
});

export default router;
