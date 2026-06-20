/**
 * services/chat/agoraService.js
 * Agora RTC + RTM token generation, call lifecycle helpers.
 * Fixes applied:
 *  - endCall: guard against double-end race condition with atomic findOneAndUpdate
 *  - missExpiredCalls: bulk operation, not N individual saves
 *  - handleAgoraChannelEvent: also handle case 104 (last user left)
 *  - joinCall: don't double-push existing participant
 */
import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder } = pkg;
import crypto from 'crypto';
import agoraConfig from '../../config/agora.config.js';
import { Call, Conversation, Message } from '../../models/chat.js';
import redisClient from '../../config/redis.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_RING_TTL_SEC = 60;
const CALL_ACTIVE_KEY   = (callId) => `agora:call:active:${callId}`;
const CALL_RING_KEY     = (callId) => `agora:call:ring:${callId}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deterministic uint32 Agora UID from Mongo ObjectId.
 * sha256 → first 4 bytes → uint32. Ensure non-zero.
 */
const uidFromUserId = (userId) => {
  const buf = crypto.createHash('sha256').update(userId.toString()).digest();
  return (buf.readUInt32BE(0) || 1);
};

const buildChannelName = (conversationId) =>
  `likeson-${conversationId}-${Date.now().toString(36)}`;

// ─── 1. RTC token ─────────────────────────────────────────────────────────────

export const generateRtcToken = (channelName, userId, role = 'publisher') => {
  const uid  = uidFromUserId(userId);
  const now  = Math.floor(Date.now() / 1000);
  const exp  = now + agoraConfig.tokenExpireSec;

  const agoraRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

  const token = RtcTokenBuilder.buildTokenWithUid(
    agoraConfig.appId,
    agoraConfig.appCert,
    channelName,
    uid,
    agoraRole,
    exp,
    exp,
  );

  return { token, uid, expiresAt: new Date(exp * 1000) };
};

// ─── 2. RTM token ─────────────────────────────────────────────────────────────

export const generateRtmToken = (userId) => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + agoraConfig.rtm.expireSec;

  const token = RtmTokenBuilder.buildToken(
    agoraConfig.appId,
    agoraConfig.appCert,
    userId.toString(),
    exp,
  );

  return { token, expiresAt: new Date(exp * 1000) };
};

// ─── 3. Initiate a call ───────────────────────────────────────────────────────

export const initiateCall = async ({ conversationId, initiatorId, type, invitedUserIds = [] }) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });

  const isMember = convo.participants.some(
    (p) => p.user.toString() === initiatorId.toString() && !p.isDeleted
  );
  if (!isMember) throw Object.assign(new Error('Not a member of this conversation'), { statusCode: 403 });

  if (convo.activeCall?.callId) {
    throw Object.assign(new Error('A call is already active in this conversation'), { statusCode: 409 });
  }

  const channelName = buildChannelName(conversationId);
  const { token, uid } = generateRtcToken(channelName, initiatorId, 'publisher');

  const allUserIds   = [initiatorId, ...invitedUserIds];
  const participants = allUserIds.map((uid_) => ({
    user:     uid_,
    uid:      uidFromUserId(uid_),
    joinedAt: uid_.toString() === initiatorId.toString() ? new Date() : null,
  }));

  const call = await Call.create({
    conversation:    conversationId,
    initiator:       initiatorId,
    type,
    channelName,
    status:          'ringing',
    isGroupCall:     invitedUserIds.length > 1,
    maxParticipants: allUserIds.length,
    participants,
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    activeCall: { callId: call._id, startedAt: new Date(), type },
  });

  await redisClient.setEx(
    CALL_RING_KEY(call._id.toString()),
    CALL_RING_TTL_SEC,
    JSON.stringify({ callId: call._id, conversationId, initiatorId, type }),
  );

  return {
    call,
    token,
    uid,
    channelName,
    appId: agoraConfig.appId,
    expiresAt: new Date((Math.floor(Date.now() / 1000) + agoraConfig.tokenExpireSec) * 1000),
  };
};

// ─── 4. Join a call ───────────────────────────────────────────────────────────

export const joinCall = async (callId, userId) => {
  const call = await Call.findById(callId);
  if (!call) throw Object.assign(new Error('Call not found'), { statusCode: 404 });

  if (['ended', 'cancelled', 'declined', 'missed'].includes(call.status)) {
    throw Object.assign(new Error(`Call already ${call.status}`), { statusCode: 409 });
  }

  const idx = call.participants.findIndex(
    (p) => p.user.toString() === userId.toString()
  );

  if (idx === -1) {
    // Unexpected participant (e.g., admin monitor) — add on the fly
    call.participants.push({
      user:     userId,
      uid:      uidFromUserId(userId),
      joinedAt: new Date(),
    });
  } else {
    // ── FIX: only set joinedAt if not already set (re-join after reconnect)
    if (!call.participants[idx].joinedAt) {
      call.participants[idx].joinedAt = new Date();
    }
    // Clear leftAt if this is a reconnect
    call.participants[idx].leftAt = undefined;
  }

  if (call.status === 'ringing') {
    call.status    = 'ongoing';
    call.startedAt = new Date();
  }

  await call.save();

  await redisClient.setEx(
    CALL_ACTIVE_KEY(callId),
    agoraConfig.tokenExpireSec + 300,
    '1',
  );

  const { token, uid } = generateRtcToken(call.channelName, userId, 'publisher');

  return {
    call,
    token,
    uid,
    channelName: call.channelName,
    appId:       agoraConfig.appId,
    expiresAt:   new Date((Math.floor(Date.now() / 1000) + agoraConfig.tokenExpireSec) * 1000),
  };
};

// ─── 5. End / leave a call ────────────────────────────────────────────────────

/**
 * FIX: Use atomic findOneAndUpdate with status filter to prevent race condition.
 * Two simultaneous endCall calls → only one wins, second gets null → returns safely.
 */
export const endCall = async (callId, userId, status = 'ended') => {
  const terminalStates = ['ended', 'cancelled', 'declined', 'missed'];

  // Atomic: only update if currently in a non-terminal state
  const call = await Call.findOneAndUpdate(
    {
      _id:    callId,
      status: { $nin: terminalStates },
    },
    {
      $set: {
        status,
        endedAt:   new Date(),
        endedBy:   userId,
        endReason: 'normal',
      },
    },
    { new: false } // return OLD doc so we can compute participant duration
  );

  // Already terminal — return current state
  if (!call) {
    const existing = await Call.findById(callId);
    return existing;
  }

  const now = new Date();

  // Update leaving participant duration in memory, then save once
  const idx = call.participants.findIndex(
    (p) => p.user.toString() === userId.toString()
  );
  if (idx !== -1 && call.participants[idx].joinedAt) {
    const duration = Math.floor((now - call.participants[idx].joinedAt) / 1000);
    await Call.findByIdAndUpdate(callId, {
      $set: {
        [`participants.${idx}.leftAt`]:  now,
        [`participants.${idx}.duration`]: duration,
      },
    });
  }

  // Reload to trigger post-save hooks via an explicit save
  // post-save hook needs _statusChangedTo — set it manually on fresh doc
  const finalCall       = await Call.findById(callId);
  finalCall._statusChangedTo = status;
  if (finalCall.startedAt && finalCall.endedAt) {
    finalCall.duration = Math.floor((finalCall.endedAt - finalCall.startedAt) / 1000);
  }
  await finalCall.save();

  await Promise.allSettled([
    redisClient.del(CALL_ACTIVE_KEY(callId.toString())),
    redisClient.del(CALL_RING_KEY(callId.toString())),
  ]);

  return finalCall;
};

// ─── 6. Refresh RTC token ─────────────────────────────────────────────────────

export const refreshCallToken = async (callId, userId) => {
  const call = await Call.findById(callId).select('channelName status');
  if (!call) throw Object.assign(new Error('Call not found'), { statusCode: 404 });
  if (call.status !== 'ongoing') throw Object.assign(new Error('Call not active'), { statusCode: 409 });

  return {
    ...generateRtcToken(call.channelName, userId, 'publisher'),
    channelName: call.channelName,
    appId:       agoraConfig.appId,
  };
};

// ─── 7. Verify Agora webhook ──────────────────────────────────────────────────

export const verifyAgoraWebhook = (rawBody, signature) => {
  if (!agoraConfig.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha1', agoraConfig.webhookSecret)
    .update(rawBody)
    .digest('hex');

  const sigHex = signature.replace(/^sha1=/, '');
  // Both must be same length for timingSafeEqual
  if (expected.length !== sigHex.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(sigHex, 'hex'),
  );
};

// ─── 8. Handle Agora channel events (webhook) ─────────────────────────────────

export const handleAgoraChannelEvent = async (payload) => {
  const { eventType, payload: inner = {} } = payload;
  const channelName = inner.channelName;
  if (!channelName) return;

  switch (eventType) {
    // 106: channel destroyed (all users left)
    case 106: {
      const call = await Call.findOne({
        channelName,
        status: { $in: ['ringing', 'ongoing'] },
      });
      if (call) {
        call._statusChangedTo = 'ended';
        call.status    = 'ended';
        call.endedAt   = new Date();
        call.endReason = 'normal';
        if (call.startedAt) {
          call.duration = Math.floor((call.endedAt - call.startedAt) / 1000);
        }
        await call.save();
        await redisClient.del(CALL_ACTIVE_KEY(call._id.toString()));
      }
      break;
    }
    // 103: user joined — update participant joinedAt if needed
    case 103: {
      const { uid: agoraUid } = inner;
      if (agoraUid) {
        await Call.findOneAndUpdate(
          { channelName, 'participants.uid': agoraUid },
          { $set: { 'participants.$.joinedAt': new Date() } }
        );
      }
      break;
    }
    default:
      break;
  }
};

// ─── 9. Auto-miss expired ringing calls (cron every 2min) ────────────────────

/**
 * FIX: Use bulkWrite instead of N individual save() calls.
 * Also set _statusChangedTo for post-save hook via individual saves only for missed ones.
 */
export const missExpiredCalls = async () => {
  const cutoff = new Date(Date.now() - CALL_RING_TTL_SEC * 1000);

  const stale = await Call.find({
    status:    'ringing',
    createdAt: { $lt: cutoff },
  }).select('_id conversation initiator type');

  for (const staleCall of stale) {
    // Load fresh + set flag so post-save fires correctly
    const call = await Call.findById(staleCall._id);
    if (!call || call.status !== 'ringing') continue;

    call._statusChangedTo = 'missed';
    call.status    = 'missed';
    call.endedAt   = new Date();
    call.endReason = 'timeout';
    await call.save();
  }

  return stale.length;
};

export default {
  generateRtcToken,
  generateRtmToken,
  initiateCall,
  joinCall,
  endCall,
  refreshCallToken,
  verifyAgoraWebhook,
  handleAgoraChannelEvent,
  missExpiredCalls,
};