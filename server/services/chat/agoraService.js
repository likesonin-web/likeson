import crypto from 'crypto';
import agoraPkg from 'agora-access-token';
import { Conversation, Call } from '../../models/chat.js';

const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } = agoraPkg;

const APP_ID          = process.env.AGORAIO_APP_ID;
const APP_CERTIFICATE = process.env.AGORAIO_APP_CERT;
const TOKEN_TTL       = parseInt(process.env.AGORA_TOKEN_EXPIRE_SEC, 10) || 3600;
const WEBHOOK_SECRET  = process.env.AGORA_WEBHOOK_SECRET;

export const isAgoraConfigured = () => Boolean(APP_ID && APP_CERTIFICATE);

const assertConfigured = () => {
  if (!isAgoraConfigured()) {
    throw Object.assign(new Error('Agora not configured: set AGORAIO_APP_ID / AGORAIO_APP_CERT'), {
      statusCode: 500,
    });
  }
};

/**
 * BUG FIX (UID_CONFLICT) — old deriveUid was purely deterministic:
 * last-8-hex of MongoId mod 2147483647. Two users sharing the same
 * 8-hex suffix (common when IDs are auto-incremented or created close
 * together) produce the same uid → Agora rejects the second joiner with
 * UID_CONFLICT.
 *
 * New approach:
 *  1. Try the deterministic hash first (stable for token refresh, rejoin).
 *  2. If it collides with a uid already on the Call doc, increment until clear.
 *  3. Caller always passes existingUids so we never guess.
 */
export const deriveUid = (userId, existingUids = []) => {
  const hex = userId.toString().slice(-8);
  let uid   = (parseInt(hex, 16) % 2_147_483_647) || 1;

  // Walk forward until no collision (wraps at max int32)
  while (existingUids.includes(uid)) {
    uid = (uid % 2_147_483_646) + 1;
  }
  return uid;
};

export const buildRtcToken = (channelName, uid, { publisher = true } = {}) => {
  assertConfigured();
  const role     = publisher ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireAt = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  return RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, expireAt);
};

export const buildRtmToken = (userId) => {
  assertConfigured();
  const expireAt = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  return RtmTokenBuilder.buildToken(APP_ID, APP_CERTIFICATE, userId.toString(), RtmRole.Rtm_User, expireAt);
};

export const generateRtmToken = async (userId) => {
  const token = buildRtmToken(userId);
  return { token, expiresAt: new Date(Date.now() + TOKEN_TTL * 1000) };
};

/**
 * initiateCall — atomic guard against double-initiate in same conversation.
 * findOneAndUpdate only succeeds if activeCall is unset; second concurrent
 * caller gets null back and we throw 409.
 */
export const initiateCall = async ({ conversationId, initiatorId, type = 'audio', invitedUserIds = [] }) => {
  assertConfigured();
  if (!['audio', 'video'].includes(type)) {
    throw Object.assign(new Error('type must be audio or video'), { statusCode: 400 });
  }

  const channelName = `call_${conversationId}_${Date.now()}`;

  // BUG FIX — no existing participants yet, so existingUids = []
  const uid        = deriveUid(initiatorId, []);
  const isGroupCall = invitedUserIds.length > 1;

  const call = await Call.create({
    conversation:    conversationId,
    initiator:       initiatorId,
    type,
    channelName,
    status:          'ringing',
    isGroupCall,
    maxParticipants: isGroupCall ? Math.max(invitedUserIds.length + 1, 2) : 2,
    participants:    [{ user: initiatorId, uid, joinedAt: new Date() }],
  });

  // Atomic claim: only set activeCall if not already set (no read-then-write race)
  const claimed = await Conversation.findOneAndUpdate(
    { _id: conversationId, activeCall: { $exists: false } },
    { $set: { activeCall: { callId: call._id, startedAt: new Date(), type } } },
    { new: true },
  );

  if (!claimed) {
    // Someone else claimed first — roll back the call we just created
    await Call.findByIdAndUpdate(call._id, { status: 'failed', endReason: 'error' });
    throw Object.assign(new Error('A call is already active in this conversation'), { statusCode: 409 });
  }

  const token     = buildRtcToken(channelName, uid, { publisher: true });
  const expiresAt = new Date(Date.now() + TOKEN_TTL * 1000);

  return { call, channelName, token, uid, appId: APP_ID, expiresAt };
};

/**
 * joinCall — validates call is still joinable before minting token.
 *
 * BUG FIX (UID_CONFLICT):
 *  - Rejoining user → reuse their STORED uid (never rederive — rederive
 *    can collide if another user happened to land on the same hash value
 *    and was already assigned that uid).
 *  - New user → pass all existing uids to deriveUid so it walks past
 *    any hash collision automatically.
 */
export const joinCall = async (callId, userId) => {
  assertConfigured();
  const call = await Call.findById(callId);
  if (!call) throw Object.assign(new Error('Call not found'), { statusCode: 404 });

  if (!['ringing', 'ongoing'].includes(call.status)) {
    throw Object.assign(new Error(`Cannot join call with status "${call.status}"`), { statusCode: 409 });
  }

  const existingIdx = call.participants.findIndex(
    (p) => p.user.toString() === userId.toString(),
  );

  let uid;

  if (existingIdx !== -1) {
    // BUG FIX — reuse stored uid; rederiving risks a different value if
    // the existingUids set has changed since the participant first joined.
    uid = call.participants[existingIdx].uid;
    call.participants[existingIdx].joinedAt =
      call.participants[existingIdx].joinedAt || new Date();
    call.participants[existingIdx].leftAt = null;
  } else {
    if (call.participants.length >= call.maxParticipants) {
      throw Object.assign(new Error('Call is full'), { statusCode: 409 });
    }
    // BUG FIX — pass existing uids so deriveUid avoids all collisions
    const existingUids = call.participants.map((p) => p.uid);
    uid = deriveUid(userId, existingUids);
    call.participants.push({ user: userId, uid, joinedAt: new Date() });
  }

  if (call.status === 'ringing') {
    call.status    = 'ongoing';
    call.startedAt = call.startedAt || new Date();
  }

  await call.save();

  const token     = buildRtcToken(call.channelName, uid, { publisher: true });
  const expiresAt = new Date(Date.now() + TOKEN_TTL * 1000);

  return { call, channelName: call.channelName, token, uid, appId: APP_ID, expiresAt };
};

/**
 * endCall — idempotent. Calling on an already-terminal call returns it as-is
 * instead of throwing, so a double "hang up" tap from a flaky client doesn't
 * crash the socket handler.
 */
export const endCall = async (callId, userId, status = 'ended') => {
  const TERMINAL = ['ended', 'missed', 'declined', 'cancelled', 'failed'];
  if (!TERMINAL.includes(status)) {
    throw Object.assign(new Error('Invalid end status'), { statusCode: 400 });
  }

  const call = await Call.findById(callId);
  if (!call) throw Object.assign(new Error('Call not found'), { statusCode: 404 });

  if (TERMINAL.includes(call.status)) {
    return call; // already ended — idempotent no-op
  }

  const pIdx = call.participants.findIndex((p) => p.user.toString() === userId.toString());
  if (pIdx !== -1 && !call.participants[pIdx].leftAt) {
    call.participants[pIdx].leftAt   = new Date();
    call.participants[pIdx].duration = Math.floor(
      (call.participants[pIdx].leftAt - call.participants[pIdx].joinedAt) / 1000,
    );
  }

  call.status    = status;
  call.endedAt   = new Date();
  call.endedBy   = userId;
  call.endReason = status === 'ended' ? 'normal' : call.endReason;

  await call.save(); // triggers pre/post hooks: duration + call_log message + activeCall cleanup

  return call;
};

/**
 * refreshCallToken — BUG FIX: reuse stored uid, same reason as joinCall.
 */
export const refreshCallToken = async (callId, userId) => {
  assertConfigured();
  const call = await Call.findById(callId).select('channelName status participants');
  if (!call) throw Object.assign(new Error('Call not found'), { statusCode: 404 });
  if (!['ringing', 'ongoing'].includes(call.status)) {
    throw Object.assign(new Error('Call is not active'), { statusCode: 409 });
  }

  const participant = call.participants.find(
    (p) => p.user.toString() === userId.toString(),
  );
  if (!participant) throw Object.assign(new Error('Not a participant'), { statusCode: 403 });

  // BUG FIX — use stored uid, not rederived uid
  const uid       = participant.uid;
  const token     = buildRtcToken(call.channelName, uid, { publisher: true });
  const expiresAt = new Date(Date.now() + TOKEN_TTL * 1000);

  return { callId, channelName: call.channelName, token, uid, appId: APP_ID, expiresAt };
};

/**
 * verifyAgoraWebhook — timing-safe HMAC-SHA1 compare against raw body.
 */
export const verifyAgoraWebhook = (rawBody, signature) => {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac('sha1', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/**
 * handleAgoraChannelEvent — channel lifecycle events from Agora (user left,
 * channel destroyed, etc). Used to reconcile stale 'ongoing' calls where the
 * client never sent call_end (app killed, network drop).
 */
export const handleAgoraChannelEvent = async (payload) => {
  const eventType   = payload?.eventType;
  const channelName = payload?.payload?.channelName;
  if (!channelName) return;

  // eventType 2 = channel destroyed (Agora's "all users left") — see Agora docs
  if (eventType === 2) {
    const call = await Call.findOne({ channelName, status: { $in: ['ringing', 'ongoing'] } });
    if (call) {
      call.status    = call.status === 'ringing' ? 'missed' : 'ended';
      call.endedAt   = new Date();
      call.endReason = 'timeout';
      await call.save();
    }
  }
};

export default {
  isAgoraConfigured,
  deriveUid,
  buildRtcToken,
  buildRtmToken,
  generateRtmToken,
  initiateCall,
  joinCall,
  endCall,
  refreshCallToken,
  verifyAgoraWebhook,
  handleAgoraChannelEvent,
};
