// webhooks/razorpayxWebhook.js
import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Payout from '../models/Payout.js';
import PartnerLedger from '../models/PartnerLedger.js';
import WebhookLog from '../models/WebhookLog.js';
import { getProfileModel } from '../utils/profileResolver.js';

const router = express.Router();

// WebhookLog model — append only
const webhookLogSchema = new mongoose.Schema({
  eventId:     { type: String, unique: true, required: true }, // RazorpayX event ID
  event:       { type: String, required: true },
  payload:     { type: mongoose.Schema.Types.Mixed },
  status:      { type: String, enum: ['received', 'processed', 'failed', 'dead_letter'], default: 'received' },
  error:       { type: String },
  processedAt: { type: Date },
  retryCount:  { type: Number, default: 0 },
}, { timestamps: true });

// ─── POST /webhooks/razorpayx ───────────────────────────────────────────────
router.post(
  '/razorpayx',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const rawBody  = req.body; // Buffer
    const signature = req.headers['x-razorpay-signature'];

    // 1. VERIFY SIGNATURE — before ANY processing
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAYX_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expectedSig))) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody.toString());
    const eventId = payload.id; // RazorpayX unique event ID

    // 2. REPLAY / DUPLICATE GUARD — eventId unique in WebhookLog
    const existing = await WebhookLog.findOne({ eventId }).lean();
    if (existing) {
      // Already processed (or in-flight). Ack and bail.
      return res.status(200).json({ success: true, message: 'duplicate_ignored' });
    }

    // 3. LOG RECEIPT immediately — before processing
    let logDoc;
    try {
      logDoc = await WebhookLog.create({
        eventId,
        event:   payload.event,
        payload,
        status:  'received',
      });
    } catch (e) {
      if (e.code === 11000) {
        // Race: another instance created it. Ack.
        return res.status(200).json({ success: true, message: 'concurrent_duplicate_ignored' });
      }
      throw e;
    }

    // 4. ACK IMMEDIATELY — Razorpay expects 200 within 5s
    res.status(200).json({ success: true });

    // 5. PROCESS ASYNC (don't await on response path)
    setImmediate(async () => {
      try {
        await processWebhookEvent(payload);
        await WebhookLog.updateOne({ _id: logDoc._id }, { status: 'processed', processedAt: new Date() });
      } catch (err) {
        const retryCount = (logDoc.retryCount || 0) + 1;
        const status     = retryCount >= 3 ? 'dead_letter' : 'failed';
        await WebhookLog.updateOne({ _id: logDoc._id }, {
          status,
          error:      err.message,
          retryCount,
        });
        console.error('[WEBHOOK PROCESSING FAILED]', eventId, err.message);
        // In prod: enqueue to BullMQ for retry
      }
    });
  }
);

async function processWebhookEvent(payload) {
  const event    = payload.event;
  const rxPayout = payload.payload?.payout?.entity;
  if (!rxPayout) return; // unknown event shape

  const payout = await Payout.findOne({ 'razorpayx.razorpayPayoutId': rxPayout.id });
  if (!payout) {
    console.warn('[WEBHOOK] No payout for razorpayId:', rxPayout.id);
    return;
  }

  // Idempotent: skip if already in terminal state matching this event
  const terminalMap = { 'payout.processed': 'paid', 'payout.failed': 'failed', 'payout.reversed': 'reversed' };
  if (payout.status === terminalMap[event]) return; // already handled

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Record webhook event on payout
    payout.razorpayx.status = rxPayout.status;
    payout.webhookEventIds.push({ eventId: payload.id, event, payload });

    if (event === 'payout.processed') {
      payout.status            = 'paid';
      payout.confirmedAt       = new Date();
      payout.razorpayx.utr     = rxPayout.utr;
      payout.isReconciled      = true;
      payout.reconciledAt      = new Date();

      // Ledger: debit entry
      await PartnerLedger.create([{
        partnerUserId:     payout.partnerUserId,
        partnerType:       payout.partnerType,
        payoutId:          payout._id,
        amountPaise:       -payout.payoutAmount,
        balanceAfterPaise: 0, // compute from profile in prod
        type:              'payout',
        description:       `Payout ${payout.payoutCode} processed. UTR: ${rxPayout.utr}`,
        metadata:          { utr: rxPayout.utr },
      }], { session });

      // Sweep earnings
      await getProfileModel(payout.partnerType).updateOne(
        { user: payout.partnerUserId },
        {
          $inc: { 'earnings.totalPaidPaise': payout.payoutAmount, 'earnings.pendingPayoutPaise': -payout.payoutAmount },
          $set: { 'earnings.lastPayoutAt': new Date() }
        },
        { session }
      );

    } else if (event === 'payout.failed') {
      payout.status                  = 'failed';
      payout.razorpayx.failureReason = rxPayout.failure_reason;

      // Reverse pendingPayout credit
      await getProfileModel(payout.partnerType).updateOne(
        { user: payout.partnerUserId },
        { $inc: { 'earnings.pendingPayoutPaise': -payout.payoutAmount } },
        { session }
      );

    } else if (event === 'payout.reversed') {
      payout.status = 'reversed';

      // Reverse the paid sweep
      await getProfileModel(payout.partnerType).updateOne(
        { user: payout.partnerUserId },
        { $inc: { 'earnings.totalPaidPaise': -payout.payoutAmount, 'earnings.pendingPayoutPaise': payout.payoutAmount } },
        { session }
      );

      // Ledger: reversal entry
      await PartnerLedger.create([{
        partnerUserId:     payout.partnerUserId,
        partnerType:       payout.partnerType,
        payoutId:          payout._id,
        amountPaise:       payout.payoutAmount, // credit back
        balanceAfterPaise: 0,
        type:              'reversal',
        description:       `Payout ${payout.payoutCode} reversed by bank`,
      }], { session });
    }

    await payout.save({ session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export default router;
export const WebhookLog = mongoose.model('WebhookLog', new mongoose.Schema({
  eventId:     { type: String, unique: true, required: true },
  event:       String,
  payload:     mongoose.Schema.Types.Mixed,
  status:      { type: String, enum: ['received','processed','failed','dead_letter'], default: 'received' },
  error:       String,
  processedAt: Date,
  retryCount:  { type: Number, default: 0 },
}, { timestamps: true }));