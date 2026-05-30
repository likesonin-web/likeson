'use client';

/**
 * agoraRtcService.js
 * Thin stateless wrapper around agora-rtc-sdk-ng.
 * Used by useAgoraConsultation. No singleton state.
 * Each component gets its own AgoraRTC.createClient() instance.
 */

let AgoraRTC = null;

/**
 * Lazy-load AgoraRTC (browser only).
 * Call once on component mount inside useEffect.
 */
export async function loadAgoraRTC() {
  if (AgoraRTC) return AgoraRTC;
  const mod = await import('agora-rtc-sdk-ng');
  AgoraRTC = mod.default;
  AgoraRTC.setLogLevel(2);
  return AgoraRTC;
}

/**
 * Check if current browser supports WebRTC / Agora.
 */
export function isAgoraSupported() {
  try {
    return !!(
      typeof window !== 'undefined' &&
      window.RTCPeerConnection &&
      navigator?.mediaDevices?.getUserMedia
    );
  } catch {
    return false;
  }
}

/**
 * Map Agora quality score (0-6) to human label.
 * 0 = unknown, 1 = excellent, ..., 6 = disconnected
 */
export function qualityLabel(score) {
  const map = ['Unknown', 'Excellent', 'Good', 'Fair', 'Poor', 'Bad', 'Disconnected'];
  return map[score] ?? 'Unknown';
}

/**
 * Map score to traffic-light color token.
 */
export function qualityColor(score) {
  if (score <= 0) return 'text-base-content/30';
  if (score <= 2) return 'text-success';
  if (score <= 4) return 'text-warning';
  return 'text-error';
}

export default { loadAgoraRTC, isAgoraSupported, qualityLabel, qualityColor };