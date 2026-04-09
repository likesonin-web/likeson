import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID.trim(),
  process.env.TWILIO_AUTH_TOKEN.trim()
);

const DEFAULT_COUNTRY_CODE = process.env.TWILIO_DEFAULT_COUNTRY_CODE?.trim() || '91';

const toE164 = (raw) => {
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');

  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11)  return `+${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  if (digits.length === 10)                             return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  if (raw.startsWith('+') && digits.length >= 10)       return `+${digits}`;

  return raw;
};

const sendWhatsapp = async ({ to, message, contentSid, contentVariables, mediaUrl }) => {
  const normalized = toE164(to);
  const fromNumber = process.env.TWILIO_WHATAPPS_PHONE.trim();

  console.log(`📤 WhatsApp | FROM: whatsapp:${fromNumber} | TO: whatsapp:${normalized}`);

  try {
    let payload;

    if (contentSid) {
      // ── Approved template message (production) ──────────────────────────
      payload = {
        from:             `whatsapp:${fromNumber}`,
        to:               `whatsapp:${normalized}`,
        contentSid,
        ...(contentVariables && { contentVariables }),
      };
    } else {
      // ── Free-form / sandbox message ─────────────────────────────────────
      payload = {
        from: `whatsapp:${fromNumber}`,
        to:   `whatsapp:${normalized}`,
        body: message,
      };

      if (Array.isArray(mediaUrl) && mediaUrl.length > 0) {
        payload.mediaUrl = mediaUrl;
      }
    }

    const response = await client.messages.create(payload);

    console.log(`✅ WhatsApp sent to ${normalized} | SID: ${response.sid} | Status: ${response.status}`);

    // Check real delivery status after 5s
    setTimeout(async () => {
      try {
        const msg = await client.messages(response.sid).fetch();
        if (msg.errorCode) {
          console.error(`❌ WhatsApp delivery FAILED | SID: ${response.sid} | ErrorCode: ${msg.errorCode} | ${msg.errorMessage}`);
        } else {
          console.log(`📬 WhatsApp delivery status | SID: ${response.sid} | Status: ${msg.status}`);
        }
      } catch (e) {
        console.warn(`⚠️  Could not fetch WhatsApp status for ${response.sid}:`, e.message);
      }
    }, 5000);

    return response;

  } catch (error) {
    console.error(`❌ WhatsApp Send Error to ${normalized} (raw: ${to})`);
    console.error(`   Code: ${error.code} | Status: ${error.status}`);
    console.error(`   Message: ${error.message}`);
    throw new Error(`WhatsApp delivery failed: ${error.message}`);
  }
};

export default sendWhatsapp;