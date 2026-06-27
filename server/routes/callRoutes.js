import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { protect } from '../middleware/authMiddleware.js';
import * as callService from '../services/chat/callService.js';

const router = Router();
router.use(protect);

// ── Initiate / history (scoped to a conversation) ───────────────────────────

router.post(
  '/conversations/:conversationId/calls',
  asyncHandler(async (req, res) => {
    const { type, targetUserIds } = req.body;
    const result = await callService.initiateCall(req.user._id, req.params.conversationId, { type, targetUserIds });
    res.status(201).json({ success: true, data: result });
  })
);

router.get(
  '/conversations/:conversationId/calls',
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await callService.listCallHistory(req.user._id, req.params.conversationId, {
      page: Number(page) || 1, limit: Number(limit) || 30,
    });
    res.status(200).json({ success: true, ...result });
  })
);

// ── Per-call actions ──────────────────────────────────────────────────────────

router.get(
  '/calls/:id',
  asyncHandler(async (req, res) => {
    const call = await callService.getCallById(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: call });
  })
);

router.post(
  '/calls/:id/accept',
  asyncHandler(async (req, res) => {
    const result = await callService.acceptCall(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: result });
  })
);

router.post(
  '/calls/:id/join',
  asyncHandler(async (req, res) => {
    const result = await callService.joinCall(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: result });
  })
);

router.post(
  '/calls/:id/decline',
  asyncHandler(async (req, res) => {
    const call = await callService.declineCall(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: call });
  })
);

router.post(
  '/calls/:id/cancel',
  asyncHandler(async (req, res) => {
    const call = await callService.cancelCall(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: call });
  })
);

router.post(
  '/calls/:id/leave',
  asyncHandler(async (req, res) => {
    const call = await callService.leaveCall(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: call });
  })
);

router.post(
  '/calls/:id/end',
  asyncHandler(async (req, res) => {
    const call = await callService.endCall(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: call });
  })
);

router.post(
  '/calls/:id/recording/start',
  asyncHandler(async (req, res) => {
    const call = await callService.startRecording(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: call });
  })
);

router.post(
  '/calls/:id/recording/stop',
  asyncHandler(async (req, res) => {
    const call = await callService.stopRecording(req.user._id, req.params.id);
    res.status(200).json({ success: true, data: call });
  })
);

export default router;