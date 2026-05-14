import { Resend } from 'resend';
import juice from 'juice';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * @desc    Core Email Sender Utility for Likeson.in (Powered by Resend)
 * @param   {{ email: string, subject: string, html: string }} options
 * @returns {Promise<object>} Resend response
 */
const sendEmail = async (options) => {
  // 1. Inline CSS for maximum email client compatibility
  const htmlWithInlinedStyles = juice(options.html);

  // 2. Prepare the sender identity
  // Note: Resend usually requires a verified domain (e.g., hello@likeson.in)
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName = process.env.FROM_NAME || 'Likeson Healthcare';

  // 3. Send via Resend
  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: options.email,
      subject: options.subject,
      html: htmlWithInlinedStyles,
    });

    if (error) {
      throw error;
    }

    console.log(`✅ Email sent to ${options.email} | ID: ${data.id}`);
    return data;
  } catch (error) {
    const message = error.message || 'Unknown Resend error';
    console.error(`❌ Email Send Error: ${message}`);
    throw new Error(`Email delivery failed: ${message}`);
  }
};

export default sendEmail;