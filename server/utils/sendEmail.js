import { Resend } from 'resend';
import juice from 'juice';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = `${process.env.FROM_NAME || 'Likeson Healthcare'} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`;

const timeout = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Email timeout after 10s')), ms)
  );

const sendEmail = async (options, attempt = 1) => {
  const MAX_ATTEMPTS = 5;
  const html = juice(options.html || '');

  try {
    const { data, error } = await Promise.race([
      resend.emails.send({
        from: FROM,
        to: options.email,
        subject: options.subject,
        html,
        attachments: options.attachments || [],
      }),
      timeout(10_000),
    ]);

    if (error) throw new Error(error.message || 'Resend API error');

    console.log(`✅ Email sent to ${options.email} | ID: ${data.id}`);
    return data;
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 16_000); // exp backoff
      console.warn(`[sendEmail] attempt ${attempt} failed, retry in ${delay}ms:`, err.message);
      await new Promise(r => setTimeout(r, delay));
      return sendEmail(options, attempt + 1);
    }
    console.error(`[sendEmail] all ${MAX_ATTEMPTS} attempts failed:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
};

export default sendEmail;