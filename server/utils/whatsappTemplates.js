/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHATSAPP TEMPLATES — LIKESON HEALTHCARE
 * Rich-text WhatsApp messages using SUPPORTED formatting only:
 *   *bold*  _italic_  ~strikethrough~
 *
 * ⚠️  Backtick monospace (```code```) is NOT supported by Twilio WhatsApp
 *     sandbox or WhatsApp Business API — it causes error 63015.
 *     All OTPs and IDs use *bold* instead.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── Helper ───────────────────────────────────────────────────────────────────

const formatWa = (text) =>
  text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');

// ─── Brand Header / Footer ────────────────────────────────────────────────────

const HEADER  = `🏥 *LIKESON HEALTHCARE*\n_Your Trusted Health Partner_`;
const FOOTER  = `\n\n📞 Support: support@likeson.in\n🌐 likeson.in`;
const DIVIDER = `\n━━━━━━━━━━━━━━━━━━━━━━`;

// ─── 1. OTP ───────────────────────────────────────────────────────────────────
// Used by: dispatchOtp (verification, login OTP)
// Validity: 10 minutes

export const otpWa = ({ otpCode, purpose = 'verification' }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🔐 *OTP for ${purpose}*

Your one-time password is: *${otpCode}*

⏱ Valid for *10 minutes*
🚫 Do NOT share this with anyone — Likeson staff will never ask for your OTP.
${FOOTER}
  `);

// ─── 2. Welcome ───────────────────────────────────────────────────────────────
// Used by: dispatchWelcome (after signup)

export const welcomeWa = ({ name, role = 'customer' }) => {
  const roleMessages = {
    customer:         '✅ Book rides, medicines, doctors & diagnostics — all from one app.',
    doctor:           '✅ Your doctor profile is live. Patients can now book consultations with you.',
    driver:           '✅ You can now accept patient ride requests from your Likeson Driver app.',
    'care assistant': '✅ You are listed as a care assistant. Accept care requests and start earning.',
    pharmacy:         '✅ Your pharmacy is onboarded. Start fulfilling medicine orders from your dashboard.',
    transportpartner: '✅ Your transport fleet is registered. Manage drivers from your partner dashboard.',
    'lab partner':    '✅ Your lab is onboarded. Expect diagnostic booking requests shortly.',
    admin:            '✅ Admin access granted. Manage the Likeson platform from your dashboard.',
  };

  const msg = roleMessages[role] || '✅ Your account is ready.';

  return formatWa(`
${HEADER}
${DIVIDER}

👋 *Welcome, ${name}!*

${msg}

🚀 Get started: likeson.in/dashboard
${FOOTER}
  `);
};

// ─── 3. Order Placed ──────────────────────────────────────────────────────────

export const orderPlacedWa = ({ userName, orderId, totalAmount, itemCount, estimatedDelivery }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🛒 *Order Placed Successfully!*

Hi *${userName}*, your order has been received.

📦 *Order ID:* #${orderId}
💊 *Items:* ${itemCount}
💰 *Total:* ₹${(totalAmount || 0).toFixed(2)}
${estimatedDelivery ? `🕐 *Est. Delivery:* ${estimatedDelivery}` : ''}

Track your order 👉 likeson.in/orders
${FOOTER}
  `);

// ─── 4. Order Status Update ───────────────────────────────────────────────────

export const orderStatusWa = ({ userName, orderId, newStatus }) => {
  const statusConfig = {
    Confirmed:          { icon: '✅', label: 'Order Confirmed',         note: 'Your order is confirmed and being prepared at the pharmacy.' },
    Processing:         { icon: '⚙️', label: 'Order Processing',        note: 'The pharmacy is currently packing your medicines.' },
    'Out-for-Delivery': { icon: '🛵', label: 'Out for Delivery',        note: 'Your order is on the way! Please keep your phone handy.' },
    Delivered:          { icon: '🎉', label: 'Order Delivered',         note: 'Your medicines have been delivered. Stay healthy!' },
    Cancelled:          { icon: '❌', label: 'Order Cancelled',         note: 'Your order has been cancelled. Refund (if any) will be processed in 5–7 business days.' },
    Return_Requested:   { icon: '🔄', label: 'Return Requested',        note: 'We have received your return request and are reviewing it.' },
    Return_Accepted:    { icon: '📦', label: 'Return Accepted',         note: 'Your return is approved. A pickup partner will be assigned shortly.' },
    Return_Rejected:    { icon: '⛔', label: 'Return Rejected',         note: 'Your return request was not approved. Contact support for assistance.' },
    Pickup_Assigned:    { icon: '🏍️', label: 'Pickup Partner Assigned', note: 'A pickup partner has been assigned for your return.' },
    Pickup_Done:        { icon: '✔️', label: 'Pickup Completed',        note: 'Your return pickup is done. Refund will be initiated shortly.' },
    Returned:           { icon: '↩️', label: 'Order Returned',          note: 'Your order has been returned and the refund process has begun.' },
  };

  const cfg = statusConfig[newStatus] || {
    icon:  '📋',
    label: `Status: ${newStatus}`,
    note:  'Your order status has been updated.',
  };

  return formatWa(`
${HEADER}
${DIVIDER}

${cfg.icon} *${cfg.label}*

Hi *${userName}*,
${cfg.note}

📦 *Order ID:* #${orderId}

View details 👉 likeson.in/orders
${FOOTER}
  `);
};

// ─── 5. Delivery OTP ──────────────────────────────────────────────────────────

export const deliveryOtpWa = ({ userName, orderId, otpCode }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🛵 *Your Delivery is Arriving!*

Hi *${userName}*, your order *#${orderId}* is almost at your doorstep.

Share this OTP with the delivery partner: *${otpCode}*

⏱ Valid for *30 minutes*
🚫 Share *only* with your Likeson delivery partner.
${FOOTER}
  `);

// ─── 6. Refund Initiated ──────────────────────────────────────────────────────

export const refundWa = ({ userName, orderId, refundAmount, refundMethod }) => {
  const methodLabel = {
    Wallet:          '💰 Likeson Wallet (Instant)',
    Online:          '💳 Original Payment Method (3–7 days)',
    Bank_Transfer:   '🏦 Bank Transfer (3–7 business days)',
    Custom_Bank:     '🏦 Bank Account on File (3–7 business days)',
    Original_Source: '💳 Original Payment Method (3–7 days)',
  }[refundMethod] || refundMethod;

  return formatWa(`
${HEADER}
${DIVIDER}

💸 *Refund Initiated!*

Hi *${userName}*, your refund has been processed.

📦 *Order ID:* #${orderId}
💰 *Refund Amount:* ₹${(refundAmount || 0).toFixed(2)}
🏧 *Method:* ${methodLabel}

For queries 👉 support@likeson.in
${FOOTER}
  `);
};

// ─── 7. Care Ride Booked ──────────────────────────────────────────────────────

export const rideBookedWa = ({ userName, rideId, scheduledAt, pickupAddress, dropAddress, hasAssistant = false }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🚗 *Care Ride Confirmed!*

Hi *${userName}*, your ride has been booked successfully.

🎫 *Ride ID:* #${rideId}
📅 *Scheduled:* ${scheduledAt}
📍 *Pickup:* ${pickupAddress}
🏥 *Drop:* ${dropAddress}
🧑‍⚕️ *Care Assistant:* ${hasAssistant ? 'Yes, included' : 'Not requested'}

Track your ride 👉 likeson.in/rides
${FOOTER}
  `);

// ─── 8. Driver Assigned ───────────────────────────────────────────────────────

export const driverAssignedWa = ({ userName, rideId, driverName, vehicleNumber, driverPhone, vehicleType = 'Car' }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🚗 *Driver Assigned!*

Hi *${userName}*, a driver is on the way for your ride *#${rideId}*.

👤 *Driver:* ${driverName}
🚘 *Vehicle:* ${vehicleType} — *${vehicleNumber}*
📞 *Contact:* ${driverPhone}

Track live 👉 likeson.in/rides
${FOOTER}
  `);

// ─── 9. Ride Started ──────────────────────────────────────────────────────────

export const rideStartedWa = ({ userName, rideId, driverName, eta }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🟢 *Ride Started!*

Hi *${userName}*, your care ride *#${rideId}* has begun.

🧑‍✈️ *Driver:* ${driverName} is heading to your pickup location.
${eta ? `⏱ *ETA:* ${eta}` : ''}

Please be ready at your pickup point.

Track live 👉 likeson.in/rides
${FOOTER}
  `);

// ─── 10. Ride Completed ───────────────────────────────────────────────────────

export const rideCompletedWa = ({ userName, rideId, totalFare, distance }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🎉 *Ride Completed!*

Hi *${userName}*, your care ride has been successfully completed.

🎫 *Ride ID:* #${rideId}
${distance ? `📏 *Distance:* ${distance}` : ''}
💰 *Fare:* ₹${(totalFare || 0).toFixed(2)}

Thank you for trusting Likeson for your healthcare journey! 🙏
${FOOTER}
  `);

// ─── 11. Ride Cancelled ───────────────────────────────────────────────────────

export const rideCancelledWa = ({ userName, rideId, reason, refundNote }) =>
  formatWa(`
${HEADER}
${DIVIDER}

❌ *Ride Cancelled*

Hi *${userName}*, your care ride *#${rideId}* has been cancelled.
${reason ? `\n📝 *Reason:* ${reason}` : ''}
${refundNote ? `\n💰 ${refundNote}` : '\n💰 Refund (if applicable) will be processed in 5–7 business days.'}

To rebook 👉 likeson.in/rides
${FOOTER}
  `);

// ─── 12. Care Assistant Assigned ─────────────────────────────────────────────

export const careAssistantAssignedWa = ({ userName, requestId, assistantName, assistantPhone, scheduledAt }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🧑‍⚕️ *Care Assistant Assigned!*

Hi *${userName}*, a care assistant has been assigned for your request *#${requestId}*.

👤 *Assistant:* ${assistantName}
📞 *Contact:* ${assistantPhone}
📅 *Scheduled:* ${scheduledAt}

Your assistant will guide you throughout your visit and ensure you reach home safely.
${FOOTER}
  `);

// ─── 13. Doctor Appointment Confirmed ────────────────────────────────────────

export const appointmentConfirmedWa = ({ userName, appointmentId, doctorName, specialization, scheduledAt, mode = 'In-Person', location }) =>
  formatWa(`
${HEADER}
${DIVIDER}

📅 *Appointment Confirmed!*

Hi *${userName}*, your doctor appointment is booked.

🎫 *Appointment ID:* #${appointmentId}
👨‍⚕️ *Doctor:* Dr. ${doctorName}${specialization ? ` _(${specialization})_` : ''}
🗓 *Date & Time:* ${scheduledAt}
📋 *Mode:* ${mode}
${location ? `📍 *Location:* ${location}` : ''}

Manage appointments 👉 likeson.in/appointments
${FOOTER}
  `);

// ─── 14. Appointment Reminder ─────────────────────────────────────────────────

export const appointmentReminderWa = ({ userName, doctorName, scheduledAt, mode = 'In-Person', appointmentId }) =>
  formatWa(`
${HEADER}
${DIVIDER}

⏰ *Appointment Reminder!*

Hi *${userName}*, don't forget your upcoming appointment.

👨‍⚕️ *Doctor:* Dr. ${doctorName}
🗓 *Time:* ${scheduledAt}
📋 *Mode:* ${mode}
🎫 *ID:* #${appointmentId}

Please be on time. Carry any previous prescriptions or reports if available.
${FOOTER}
  `);

// ─── 15. Appointment Cancelled ───────────────────────────────────────────────

export const appointmentCancelledWa = ({ userName, appointmentId, doctorName, reason }) =>
  formatWa(`
${HEADER}
${DIVIDER}

❌ *Appointment Cancelled*

Hi *${userName}*, your appointment with Dr. *${doctorName}* (*#${appointmentId}*) has been cancelled.
${reason ? `\n📝 *Reason:* ${reason}` : ''}

Reschedule anytime 👉 likeson.in/appointments
${FOOTER}
  `);

// ─── 16. Diagnostic Test Booked ──────────────────────────────────────────────

export const diagnosticBookedWa = ({ userName, bookingId, testName, scheduledAt, collectionType = 'Home Collection', labName }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🔬 *Diagnostic Test Booked!*

Hi *${userName}*, your test has been scheduled.

🎫 *Booking ID:* #${bookingId}
🧪 *Test:* ${testName}
📋 *Type:* ${collectionType}
🗓 *Scheduled:* ${scheduledAt}
${labName ? `🏥 *Lab:* ${labName}` : ''}

${collectionType === 'Home Collection' ? '🏠 Our phlebotomist will visit you at your registered address.' : '📍 Please arrive 10 minutes before your scheduled time.'}

View booking 👉 likeson.in/diagnostics
${FOOTER}
  `);

// ─── 17. Diagnostic Report Ready ─────────────────────────────────────────────

export const diagnosticReportReadyWa = ({ userName, bookingId, testName, reportUrl }) =>
  formatWa(`
${HEADER}
${DIVIDER}

📊 *Your Report is Ready!*

Hi *${userName}*, your *${testName}* report for booking *#${bookingId}* is now available.

📥 ${reportUrl ? `Download Report: ${reportUrl}` : 'View & download: likeson.in/diagnostics'}

💡 You can share this report directly with your doctor from the Likeson app.
${FOOTER}
  `);

// ─── 18. Prescription Ready ───────────────────────────────────────────────────

export const prescriptionReadyWa = ({ userName, doctorName, prescriptionId }) =>
  formatWa(`
${HEADER}
${DIVIDER}

📋 *E-Prescription Ready!*

Hi *${userName}*, Dr. *${doctorName}* has issued your prescription.

🎫 *Prescription ID:* #${prescriptionId}

💊 Order your medicines directly from the prescription:
👉 likeson.in/prescriptions
${FOOTER}
  `);

// ─── 19. Medicine Refill Reminder ────────────────────────────────────────────

export const refillReminderWa = ({ userName, medicineName, daysLeft }) =>
  formatWa(`
${HEADER}
${DIVIDER}

💊 *Medicine Refill Reminder*

Hi *${userName}*, it's time to refill your medication.

🔴 *Medicine:* ${medicineName}
${daysLeft !== undefined ? `📅 *Estimated stock left:* ~${daysLeft} day(s)` : ''}

Don't miss a dose! Order now:
👉 likeson.in/pharmacy
${FOOTER}
  `);

// ─── 20. Subscription Activated ───────────────────────────────────────────────

export const subscriptionActivatedWa = ({ userName, planName, validUntil, features = [] }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🎉 *Subscription Activated!*

Hi *${userName}*, your *${planName}* plan is now active.

📅 *Valid Until:* ${validUntil}

✨ *Your Benefits:*
${features.length > 0 ? features.map((f) => `  • ${f}`).join('\n') : '  • Priority bookings\n  • Exclusive discounts\n  • 24x7 support'}

Manage your plan 👉 likeson.in/plans
${FOOTER}
  `);

// ─── 21. Subscription Renewal Reminder ───────────────────────────────────────

export const subscriptionRenewalWa = ({ userName, planName, expiryDate, renewalAmount }) =>
  formatWa(`
${HEADER}
${DIVIDER}

⚠️ *Plan Expiring Soon!*

Hi *${userName}*, your *${planName}* plan expires on *${expiryDate}*.

💰 *Renewal Amount:* ₹${(renewalAmount || 0).toFixed(2)}/month

Renew now to avoid interruption in your care services:
👉 likeson.in/plans
${FOOTER}
  `);

// ─── 22. New Ride Request (to Driver) ────────────────────────────────────────

export const newRideRequestToDriverWa = ({ driverName, rideId, patientName, pickupAddress, dropAddress, scheduledAt, fare }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🔔 *New Ride Request!*

Hi *${driverName}*, a new care ride has been assigned to you.

🎫 *Ride ID:* #${rideId}
🧑‍🦳 *Patient:* ${patientName}
📍 *Pickup:* ${pickupAddress}
🏥 *Drop:* ${dropAddress}
📅 *Scheduled:* ${scheduledAt}
${fare ? `💰 *Fare:* ₹${fare.toFixed(2)}` : ''}

Accept from your Likeson Driver app now.
${FOOTER}
  `);

// ─── 23. New Care Request (to Assistant) ─────────────────────────────────────

export const newCareRequestToAssistantWa = ({ assistantName, requestId, patientName, location, scheduledAt, serviceType = 'Hospital Visit' }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🔔 *New Care Request!*

Hi *${assistantName}*, a patient needs your support.

🎫 *Request ID:* #${requestId}
🧑‍🦳 *Patient:* ${patientName}
📋 *Service:* ${serviceType}
📍 *Location:* ${location}
📅 *Scheduled:* ${scheduledAt}

Accept from your Likeson app now.
${FOOTER}
  `);

// ─── 24. New Order (to Pharmacy) ─────────────────────────────────────────────

export const newOrderToPharmacyWa = ({ pharmacyName, orderId, itemCount, totalAmount, deliveryType = 'Home Delivery' }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🔔 *New Medicine Order!*

Hi *${pharmacyName}*, you have a new order on Likeson.in.

📦 *Order ID:* #${orderId}
💊 *Items:* ${itemCount}
💰 *Order Value:* ₹${(totalAmount || 0).toFixed(2)}
🚚 *Type:* ${deliveryType}

Log in to your pharmacy dashboard to process and dispatch:
👉 likeson.in/pharmacy/dashboard
${FOOTER}
  `);

// ─── 25. Invoice ─────────────────────────────────────────────────────────────

export const invoiceWa = ({ userName, orderId, totalAmount, invoiceUrl, invoiceDate }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🧾 *Invoice for Order #${orderId}*

Hi *${userName}*, here is your payment summary.

📅 *Invoice Date:* ${invoiceDate}
💰 *Amount Paid:* ₹${(totalAmount || 0).toFixed(2)}

${invoiceUrl ? `📥 *Download Invoice:* ${invoiceUrl}` : '📥 View Invoice: likeson.in/orders'}

_This is a computer-generated invoice. No physical signature required._
${FOOTER}
  `);

// ─── 26. Account Blocked ─────────────────────────────────────────────────────
// Used by: admin/suspend route — SMS + WhatsApp only (no email)

export const accountBlockedWa = ({ name, reason = 'policy violation', unblockAt }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🚫 *Account Suspended*

Hi *${name}*, your Likeson.in account has been temporarily suspended.

📝 *Reason:* ${reason}
${unblockAt ? `📅 *Expected Unblock:* ${unblockAt}` : ''}

For assistance, contact us at support@likeson.in
${FOOTER}
  `);

// ─── 27. Account Unblocked ────────────────────────────────────────────────────
// Used by: admin/unblock route — SMS + WhatsApp only (no email)

export const accountUnblockedWa = ({ name }) =>
  formatWa(`
${HEADER}
${DIVIDER}

✅ *Account Restored!*

Hi *${name}*, your Likeson.in account is fully active again.

You can now log in and access all services without any restrictions.

👉 likeson.in/login
${FOOTER}
  `);

// ─── 28. Password Reset OTP ───────────────────────────────────────────────────
// Used by: dispatchPasswordResetOtp (forgot-password flow)
// Validity: 15 minutes — matches otpExpires = Date.now() + 15 * 60_000 in route

export const passwordResetOtpWa = ({ name, otpCode }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🔑 *Password Reset OTP*

Hi *${name}*, your password reset code is: *${otpCode}*

⏱ Valid for *15 minutes*
🚫 If you did not request this, contact support@likeson.in immediately.
${FOOTER}
  `);

// ─── 29. Password Changed Confirmation ───────────────────────────────────────
// Used by: dispatchPasswordChanged (reset-password and change-password flows)
// Sent after password is successfully changed — security confirmation.

export const passwordChangedWa = ({ name, changedAt }) =>
  formatWa(`
${HEADER}
${DIVIDER}

🔒 *Password Changed Successfully*

Hi *${name}*, your Likeson.in account password was updated on *${changedAt}*.

✅ Your account is now secured with the new password.

⚠️ *Wasn't you?* Contact us immediately:
👉 likeson.in/security
📞 support@likeson.in
${FOOTER}
  `);

// ─── 30. New Login Alert ──────────────────────────────────────────────────────
// Used by: dispatchLoginAlert — SMS + WhatsApp only (no email)

export const newLoginAlertWa = ({ name, deviceName, ipAddress, loginTime }) =>
  formatWa(`
${HEADER}
${DIVIDER}

⚠️ *New Login Detected*

Hi *${name}*, a new login was detected on your Likeson.in account.

💻 *Device:* ${deviceName}
🌐 *IP Address:* ${ipAddress}
🕐 *Time:* ${loginTime}

Not you? Secure your account immediately:
👉 likeson.in/security
${FOOTER}
  `);

// ─── 31. Payment Failed ───────────────────────────────────────────────────────

export const paymentFailedWa = ({ userName, amount, serviceType = 'service', reason }) =>
  formatWa(`
${HEADER}
${DIVIDER}

❌ *Payment Failed*

Hi *${userName}*, your payment could not be processed.

💰 *Amount:* ₹${(amount || 0).toFixed(2)}
📋 *Service:* ${serviceType}
${reason ? `📝 *Reason:* ${reason}` : ''}

Please retry with a different payment method:
👉 likeson.in/payments
${FOOTER}
  `);

// ─── 32. Payment Successful ───────────────────────────────────────────────────

export const paymentSuccessfulWa = ({ userName, amount, referenceId, serviceType = 'service', paidAt }) =>
  formatWa(`
${HEADER}
${DIVIDER}

✅ *Payment Successful!*

Hi *${userName}*, your payment has been confirmed.

💰 *Amount Paid:* ₹${(amount || 0).toFixed(2)}
📋 *Service:* ${serviceType}
🔖 *Reference ID:* ${referenceId}
🕐 *Paid At:* ${paidAt}

Thank you for using Likeson Healthcare! 🙏
${FOOTER}
  `);

// ─── Template key map ─────────────────────────────────────────────────────────

export const WA_TEMPLATE_KEYS = {
  OTP:                        'otpWa',
  WELCOME:                    'welcomeWa',
  ORDER_PLACED:               'orderPlacedWa',
  ORDER_STATUS:               'orderStatusWa',
  DELIVERY_OTP:               'deliveryOtpWa',
  REFUND:                     'refundWa',
  RIDE_BOOKED:                'rideBookedWa',
  DRIVER_ASSIGNED:            'driverAssignedWa',
  RIDE_STARTED:               'rideStartedWa',
  RIDE_COMPLETED:             'rideCompletedWa',
  RIDE_CANCELLED:             'rideCancelledWa',
  CARE_ASSISTANT_ASSIGNED:    'careAssistantAssignedWa',
  APPOINTMENT_CONFIRMED:      'appointmentConfirmedWa',
  APPOINTMENT_REMINDER:       'appointmentReminderWa',
  APPOINTMENT_CANCELLED:      'appointmentCancelledWa',
  DIAGNOSTIC_BOOKED:          'diagnosticBookedWa',
  DIAGNOSTIC_REPORT_READY:    'diagnosticReportReadyWa',
  PRESCRIPTION_READY:         'prescriptionReadyWa',
  REFILL_REMINDER:            'refillReminderWa',
  SUBSCRIPTION_ACTIVATED:     'subscriptionActivatedWa',
  SUBSCRIPTION_RENEWAL:       'subscriptionRenewalWa',
  DRIVER_NEW_RIDE_REQUEST:    'newRideRequestToDriverWa',
  ASSISTANT_NEW_CARE_REQUEST: 'newCareRequestToAssistantWa',
  PHARMACY_NEW_ORDER:         'newOrderToPharmacyWa',
  INVOICE:                    'invoiceWa',
  ACCOUNT_BLOCKED:            'accountBlockedWa',
  ACCOUNT_UNBLOCKED:          'accountUnblockedWa',
  PASSWORD_RESET_OTP:         'passwordResetOtpWa',
  PASSWORD_CHANGED:           'passwordChangedWa',        // ← NEW
  NEW_LOGIN_ALERT:            'newLoginAlertWa',
  PAYMENT_FAILED:             'paymentFailedWa',
  PAYMENT_SUCCESSFUL:         'paymentSuccessfulWa',
};