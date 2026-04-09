 

const BASE_URL = process.env.FRONTEND_URL || 'https://likeson.in';

export const BRAND = {
  small_icon: 'ic_stat_likeson',
  large_icon: `https://ik.imagekit.io/zxxzgk3iq/ChatGPT%20Image%20Feb%202,%202026,%2005_21_49%20PM.png?updatedAt=1770278792983`,
  chrome_web_icon: `https://ik.imagekit.io/zxxzgk3iq/ChatGPT%20Image%20Feb%202,%202026,%2005_21_49%20PM.png?updatedAt=1770278792983`,
  chrome_web_image: `https://ik.imagekit.io/zxxzgk3iq/ChatGPT%20Image%20Feb%202,%202026,%2005_21_49%20PM.png?updatedAt=1770278792983`,
  android_channel_id: 'likeson_default',
  android_accent_color: 'FF2563EB',
  ios_sound: 'default',
  android_sound: 'default',
};

// ─── Template factory helpers ─────────────────────────────────────────────────

const loc = (en) => ({ en });

// ─── AUTH TEMPLATES ───────────────────────────────────────────────────────────

export const auth = {
  welcome: (data) => ({
    ...BRAND,
    headings:    loc('Welcome to Likeson Healthcare 👋'),
    contents:    loc(`Hi ${data.name}, your account is ready. We're here when you need us.`),
    url:         `${BASE_URL}/dashboard`,
    custom_data: { type: 'auth.welcome', userId: data.userId },
  }),

  verifyReminder: (data) => ({
    ...BRAND,
    headings:    loc('Please verify your email'),
    contents:    loc(`${data.name}, your verification link is waiting. Tap to complete setup.`),
    url:         `${BASE_URL}/verify`,
    custom_data: { type: 'auth.verify_reminder' },
  }),

  passwordChanged: (data) => ({
    ...BRAND,
    headings:    loc('Password Updated'),
    contents:    loc(`${data.name}, your Likeson password was just changed. Not you? Contact us.`),
    url:         `${BASE_URL}/security`,
    custom_data: { type: 'auth.password_changed' },
    ios_sound:   'warning.wav',
  }),
};

// ─── BOOKING TEMPLATES ────────────────────────────────────────────────────────

export const booking = {
  confirmed: (data) => ({
    ...BRAND,
    headings:    loc('Booking Confirmed ✅'),
    contents:    loc(`Your ${data.service} is confirmed for ${data.date}. We've got you covered.`),
    url:         `${BASE_URL}/bookings/${data.bookingId}`,
    custom_data: { type: 'booking.confirmed', bookingId: data.bookingId },
    buttons: [
      { id: 'view_booking', text: 'View Booking' },
      { id: 'call_support', text: 'Call Support' },
    ],
  }),

  reminder: (data) => ({
    ...BRAND,
    headings:    loc(`Reminder: ${data.service} in 1 hour`),
    contents:    loc(`${data.name}, your appointment is at ${data.eta}. Please be ready.`),
    url:         `${BASE_URL}/bookings/${data.bookingId}`,
    custom_data: { type: 'booking.reminder', bookingId: data.bookingId },
  }),

  cancelled: (data) => ({
    ...BRAND,
    headings:    loc('Booking Cancelled'),
    contents:    loc(`Your ${data.service} booking was cancelled. Reason: ${data.reason}`),
    url:         `${BASE_URL}/bookings/${data.bookingId}`,
    custom_data: { type: 'booking.cancelled', bookingId: data.bookingId },
    ios_sound:   'cancel.wav',
  }),

  completed: (data) => ({
    ...BRAND,
    headings:    loc('Service Completed 🙏'),
    contents:    loc(`How was your ${data.service}? Tap to leave a quick review.`),
    url:         `${BASE_URL}/bookings/${data.bookingId}/review`,
    custom_data: { type: 'booking.completed', bookingId: data.bookingId },
    buttons: [
      { id: 'leave_review', text: '⭐ Rate Now' },
      { id: 'dismiss',      text: 'Later' },
    ],
  }),
};

// ─── AMBULANCE / EMERGENCY TEMPLATES ─────────────────────────────────────────

export const ambulance = {
  dispatched: (data) => ({
    ...BRAND,
    headings:    loc('🚑 Ambulance On the Way!'),
    contents:    loc(`${data.driverName} is coming in ${data.vehicleNo}. ETA: ${data.eta} min.`),
    url:         `${BASE_URL}/track/${data.bookingId}`,
    custom_data: {
      type:      'ambulance.dispatched',
      bookingId: data.bookingId,
      driverName: data.driverName,
      vehicleNo:  data.vehicleNo,
      eta:        data.eta,
    },
    priority:    10,
    ttl:         300,
    buttons: [
      { id: 'track_live', text: '📍 Track Live' },
      { id: 'call_driver', text: '📞 Call Driver' },
    ],
  }),

  arrived: (data) => ({
    ...BRAND,
    headings:    loc('🚑 Ambulance Has Arrived'),
    contents:    loc('Your ambulance is outside. Please come down immediately.'),
    url:         `${BASE_URL}/track/${data.bookingId}`,
    custom_data: { type: 'ambulance.arrived', bookingId: data.bookingId },
    priority:    10,
    ttl:         120,
    ios_sound:   'emergency.wav',
    android_sound: 'emergency',
  }),

  newJobAlert: (data) => ({
    ...BRAND,
    headings:    loc('🚨 New Emergency Job'),
    contents:    loc(`Emergency pickup near ${data.location}. Accept within 60 seconds.`),
    url:         `${BASE_URL}/driver/jobs/${data.jobId}`,
    custom_data: { type: 'ambulance.new_job', jobId: data.jobId },
    priority:    10,
    ttl:         60,
    buttons: [
      { id: 'accept_job', text: '✅ Accept' },
      { id: 'decline_job', text: '❌ Decline' },
    ],
  }),
};

// ─── HOME CARE TEMPLATES ──────────────────────────────────────────────────────

export const care = {
  caregiverAssigned: (data) => ({
    ...BRAND,
    headings:    loc('Your Caregiver is Assigned 👩‍⚕️'),
    contents:    loc(`${data.caregiverName} will handle your ${data.service}. Tap to view profile.`),
    url:         `${BASE_URL}/bookings/${data.bookingId}`,
    custom_data: { type: 'care.caregiver_assigned', bookingId: data.bookingId },
  }),

  enRoute: (data) => ({
    ...BRAND,
    headings:    loc('Caregiver is on the way 🏃'),
    contents:    loc(`${data.caregiverName} is ${data.eta} minutes away. Please be available.`),
    url:         `${BASE_URL}/track/${data.bookingId}`,
    custom_data: { type: 'care.en_route', bookingId: data.bookingId },
  }),

  medicationReminder: (data) => ({
    ...BRAND,
    headings:    loc('💊 Medication Reminder'),
    contents:    loc(`Time to take ${data.medicationName} — scheduled for ${data.time}.`),
    url:         `${BASE_URL}/health/medications`,
    custom_data: { type: 'care.medication_reminder' },
    buttons: [
      { id: 'mark_taken',  text: '✅ Taken' },
      { id: 'snooze_30',   text: '⏰ Remind in 30m' },
    ],
  }),
};

// ─── BILLING TEMPLATES ────────────────────────────────────────────────────────

export const billing = {
  paymentSuccess: (data) => ({
    ...BRAND,
    headings:    loc('Payment Received ✅'),
    contents:    loc(`₹${data.amount} received. Thank you, ${data.name}! View your invoice.`),
    url:         `${BASE_URL}/billing/${data.invoiceId}`,
    custom_data: { type: 'billing.payment_success', invoiceId: data.invoiceId },
  }),

  paymentFailed: (data) => ({
    ...BRAND,
    headings:    loc('Payment Failed ❌'),
    contents:    loc(`Your payment of ₹${data.amount} could not be processed. Please retry.`),
    url:         `${BASE_URL}/billing/${data.invoiceId}`,
    custom_data: { type: 'billing.payment_failed', invoiceId: data.invoiceId },
    buttons: [
      { id: 'retry_payment', text: '🔄 Retry Payment' },
    ],
  }),

  invoiceReady: (data) => ({
    ...BRAND,
    headings:    loc('Invoice Ready 📄'),
    contents:    loc(`Your invoice of ₹${data.amount} is ready. Tap to view and download.`),
    url:         `${BASE_URL}/billing/${data.invoiceId}`,
    custom_data: { type: 'billing.invoice_ready', invoiceId: data.invoiceId },
  }),
};

// ─── ADMIN / SYSTEM TEMPLATES ─────────────────────────────────────────────────

export const admin = {
  accountSuspended: (data) => ({
    ...BRAND,
    headings:    loc('Account Suspended'),
    contents:    loc(`${data.name}, your account has been suspended. Reason: ${data.reason}`),
    url:         `${BASE_URL}/support`,
    custom_data: { type: 'admin.account_suspended' },
  }),

  roleChanged: (data) => ({
    ...BRAND,
    headings:    loc('Account Role Updated'),
    contents:    loc(`${data.name}, your role has been updated to ${data.newRole}. Tap to learn more.`),
    url:         `${BASE_URL}/profile`,
    custom_data: { type: 'admin.role_changed', newRole: data.newRole },
  }),

  broadcast: (data) => ({
    ...BRAND,
    headings:    loc(data.title),
    contents:    loc(data.body),
    url:         data.url ?? BASE_URL,
    custom_data: { type: 'admin.broadcast' },
  }),
};

export default {
  auth,
  booking,
  ambulance,
  care,
  billing,
  admin,
};