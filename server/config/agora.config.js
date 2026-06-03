// config/agora.config.js
// Central Agora config — imported by token service + webhook verifier

const agoraConfig = {
  appId:      process.env.AGORAIO_APP_ID,
  appCert:    process.env.AGORAIO_APP_CERT?.trim(),   // trim — cert sometimes has trailing space
  tokenExpireSec: parseInt(process.env.AGORA_TOKEN_EXPIRE_SEC || '3600', 10),
  webhookSecret:  process.env.AGORA_WEBHOOK_SECRET,

  // Role constants (maps to agora-token RtcRole)
  roles: {
    PUBLISHER:   1,   // doctor / patient who can publish AV
    SUBSCRIBER:  2,   // observer / interpreter (view only)
  },

  // RTM token also uses appId + appCert (same keys, different builder)
  rtm: {
    expireSec: parseInt(process.env.AGORA_TOKEN_EXPIRE_SEC || '3600', 10),
  },

  // Cloud Recording — NOT used (AWS S3 direct). Kept as stub if needed later.
  recording: {
    enabled:       false,
    s3Bucket:      process.env.AWS_BUCKET_NAME,
    s3Region:      process.env.AWS_REGION,
    s3Folder:      process.env.AWS_RECORDING_FOLDER || 'consultations/recordings',
    s3AccessKey:   process.env.AWS_ACCESS_KEY_ID,
    s3SecretKey:   process.env.AWS_SECRET_ACCESS_KEY,
  },
};

// ── Guard — fail fast at boot if critical vars missing ────────────────────────
const REQUIRED = ['appId', 'appCert'];
for (const key of REQUIRED) {
  if (!agoraConfig[key]) {
    throw new Error(
      `[agora.config] Missing required env var: ${
        key === 'appId' ? 'AGORAIO_APP_ID' : 'AGORAIO_APP_CERT'
      }`
    );
  }
}

export default agoraConfig;