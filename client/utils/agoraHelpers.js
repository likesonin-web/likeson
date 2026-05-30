/**
 * agoraHelpers.js
 * Utility functions for Agora RTC integration
 */

/**
 * Map Agora network quality level (1-6) to UI label
 * 1 = excellent, 2 = good, 3 = poor, 4 = bad, 5 = very bad, 6 = disconnected
 */
export const getNetworkQualityLabel = (level) => {
  switch (level) {
    case 1: return 'Excellent';
    case 2: return 'Good';
    case 3: return 'Fair';
    case 4: return 'Poor';
    case 5: return 'Very Poor';
    case 6: return 'Disconnected';
    default: return 'Unknown';
  }
};

/**
 * Map Agora network quality level to CSS class suffix
 */
export const getNetworkQualityClass = (level) => {
  if (level <= 2) return 'good';
  if (level <= 4) return 'fair';
  return 'poor';
};

/**
 * Number of active bars for network quality indicator (out of 4)
 */
export const getActiveBars = (level) => {
  if (level === 1) return 4;
  if (level === 2) return 3;
  if (level === 3) return 2;
  if (level <= 5) return 1;
  return 0;
};

/**
 * Generate a stable numeric UID from a MongoDB ObjectId string
 * Mirrors the server-side logic in consultationRouter.js
 */
export const uidFromObjectId = (objectId) => {
  if (!objectId) return Math.floor(Math.random() * 100000);
  const rawHex = String(objectId).slice(-8);
  return parseInt(rawHex, 16) % 2_000_000_000;
};

/**
 * Get screen share UID from a regular UID
 */
export const getScreenShareUid = (uid) => uid + 100_000;

/**
 * Determine if a remote user is a screen share track (uid > 100_000)
 */
export const isScreenShareUser = (uid) => uid > 100_000;

/**
 * Format call duration in MM:SS or HH:MM:SS
 */
export const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Detect device type from user agent
 */
export const detectDeviceType = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
};

/**
 * Detect browser name
 */
export const detectBrowser = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Other';
};

/**
 * Check if browser supports screen sharing
 */
export const supportsScreenShare = () => {
  return typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';
};

/**
 * Get camera/mic permission status
 */
export const getMediaPermissions = async () => {
  try {
    const cam = await navigator.permissions.query({ name: 'camera' });
    const mic = await navigator.permissions.query({ name: 'microphone' });
    return { camera: cam.state, microphone: mic.state };
  } catch {
    return { camera: 'unknown', microphone: 'unknown' };
  }
};
