import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twilio client once at module load
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Normalize any Indian phone number to E.164 format (+91XXXXXXXXXX).
 * Handles: '9949654248', '09949654248', '+919949654248', '919949654248'
 * DEFAULT_COUNTRY_CODE can be overridden via TWILIO_DEFAULT_COUNTRY env var.
 */
const DEFAULT_COUNTRY_CODE = process.env.TWILIO_DEFAULT_COUNTRY_CODE || '91';

const toE164 = (raw) => {
  // Strip all non-digit characters except leading +
  const digits = raw.replace(/[^\d]/g, '');

  // Already full with country code: 919949654248 (12 digits for India)
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  // Has leading 0: 09949654248 → strip and prepend country code
  if (digits.startsWith('0') && digits.length === 11) {
    return `+${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }

  // Raw 10-digit number: 9949654248
  if (digits.length === 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  // Already has + prefix and looks correct, return as-is
  if (raw.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }

  // Unknown format — return as-is and let Twilio report the error clearly
  return raw;
};

/**
 * @desc    Send a plain SMS via Twilio
 * @param   {{ to: string, message: string }} options
 *          to      — recipient phone (any format — auto-normalized to E.164)
 *          message — plain text SMS body
 * @returns {Promise<object>} Twilio message resource
 *
 * @example
 *   await sendSms({ to: '9949654248', message: otpSms({ otpCode: '482910' }) });
 *   await sendSms({ to: '+919949654248', message: otpSms({ otpCode: '482910' }) });
 */
const sendSms = async ({ to, message }) => {
  const normalized = toE164(to);
if (process.env.TWILIO_TRIAL_MODE === 'true') {
    console.log(`⚠️  [SMS SKIPPED — TRIAL MODE] Would send to ${normalized}`);
    return { skipped: true, reason: 'trial_mode' };
  }
  try {
    const response = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   normalized,
      body: message,
    });

    console.log(`✅ SMS sent to ${normalized} | SID: ${response.sid} | Status: ${response.status}`);
    return response;
  } catch (error) {
    const msg = error?.message || 'Unknown Twilio error';
    console.error(`❌ SMS Send Error to ${normalized} (raw: ${to}): ${msg}`);
    throw new Error(`SMS delivery failed: ${msg}`);
  }
};

export default sendSms;