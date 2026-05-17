import { queueEmail } from '../config/queues/email.queue.js';

// Routers call these — NEVER call sendEmail() directly from a route
export const sendOtpEmail       = (recipient, payload) => queueEmail({ type: 'OTP',            recipient, payload });
export const sendRideAccepted   = (recipient, payload) => queueEmail({ type: 'RIDE_ACCEPTED',   recipient, payload });
export const sendDriverArriving = (recipient, payload) => queueEmail({ type: 'DRIVER_ARRIVING', recipient, payload });
export const sendInvoiceEmail   = (recipient, payload) => queueEmail({ type: 'INVOICE',         recipient, payload });
export const sendWelcomeEmail   = (recipient, payload) => queueEmail({ type: 'WELCOME',         recipient, payload });