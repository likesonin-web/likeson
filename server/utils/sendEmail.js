import sgMail from '@sendgrid/mail';
import juice from 'juice';
import dotenv from 'dotenv';

dotenv.config();

// Initialize SendGrid with API key once at module load
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * @desc    Core Email Sender Utility for Likeson.in
 * @param   {{ email: string, subject: string, html: string }} options
 * @returns {Promise<object>} SendGrid response
 */
const sendEmail = async (options) => {
  // 1. Inline CSS for maximum email client compatibility
  //    Ensures templates render correctly in Gmail, Outlook, Apple Mail, etc.
  const htmlWithInlinedStyles = juice(options.html);

  // 2. Build mail payload
  const msg = {
    to:      options.email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name:  process.env.FROM_NAME || 'Likeson Healthcare',
    },
    subject: options.subject,
    html:    htmlWithInlinedStyles,
  };

  // 3. Send via SendGrid
  try {
    const [response] = await sgMail.send(msg);
    console.log(`✅ Email sent to ${options.email} | Status: ${response.statusCode}`);
    return response;
  } catch (error) {
    const message =
      error.response?.body?.errors?.[0]?.message || error.message;
    console.error(`❌ Email Send Error: ${message}`);
    throw new Error(`Email delivery failed: ${message}`);
  }
};

export default sendEmail;