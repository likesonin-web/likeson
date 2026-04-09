/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SMS TEMPLATES — LIKESON HEALTHCARE
 * Plain-text SMS messages compatible with all telecom providers.
 * Character limits: Standard SMS = 160 chars; Unicode = 70 chars.
 * DLT-registered template format for Indian telecom compliance.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Trims whitespace and collapses internal newlines for clean SMS output.
 * @param {string} text
 * @returns {string}
 */
const formatSms = (text) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');

// ─── 1. OTP SMS ───────────────────────────────────────────────────────────────
// Triggered on: Login, Registration, Phone Verification

/**
 * @param {{ otpCode: string, purpose?: string }} props
 * purpose examples: 'login', 'registration', 'password reset'
 */
export const otpSms = ({ otpCode, purpose = 'verification' }) =>
  formatSms(`
    Your Likeson.in OTP for ${purpose} is ${otpCode}.
    Valid for 10 minutes. Do NOT share this with anyone.
    -Team Likeson Healthcare
  `);

// ─── 2. Welcome SMS ───────────────────────────────────────────────────────────
// Triggered on: Successful registration for any role

/**
 * @param {{ name: string, role: string }} props
 */
export const welcomeSms = ({ name, role = 'customer' }) => {
  const roleMessages = {
    customer:         'Book rides, medicines, doctors & diagnostics — all in one place.',
    doctor:           'Your profile is live. Patients can now book consultations with you.',
    driver:           'You can now accept patient ride requests on the platform.',
    'care assistant': 'You are now listed. Accept care requests and start earning.',
    pharmacy:         'Your pharmacy is onboarded. Start fulfilling medicine orders.',
    transportpartner: 'Your transport fleet is registered. Manage drivers from your dashboard.',
    'lab partner':    'Your lab is onboarded. Expect diagnostic booking requests shortly.',
    admin:            'Admin access granted. Manage the Likeson platform from your dashboard.',
  };

  const msg = roleMessages[role] || 'Your account is ready.';

  return formatSms(`
    Welcome to Likeson.in, ${name}!
    ${msg}
    Need help? Call or WhatsApp: support@likeson.in
    -Likeson Healthcare
  `);
};

// ─── 3. Order Placed SMS ──────────────────────────────────────────────────────
// Triggered on: New pharmacy order created

/**
 * @param {{ userName: string, orderId: string, totalAmount: number }} props
 */
export const orderPlacedSms = ({ userName, orderId, totalAmount }) =>
  formatSms(`
    Hi ${userName}, your order #${orderId} has been placed successfully!
    Amount: Rs.${(totalAmount || 0).toFixed(2)}
    Track your order at likeson.in/orders
    -Likeson Healthcare
  `);

// ─── 4. Order Status Update SMS ───────────────────────────────────────────────
// Triggered on: Any order status change

/**
 * @param {{ userName: string, orderId: string, newStatus: string }} props
 */
export const orderStatusSms = ({ userName, orderId, newStatus }) => {
  const statusMessages = {
    Confirmed:          `Your order #${orderId} is confirmed and being prepared.`,
    Processing:         `Your order #${orderId} is being processed at the pharmacy.`,
    'Out-for-Delivery': `Great news! Your order #${orderId} is out for delivery.`,
    Delivered:          `Your order #${orderId} has been delivered. Thank you for choosing Likeson!`,
    Cancelled:          `Your order #${orderId} has been cancelled. Refund (if any) will be processed in 5-7 business days.`,
    Return_Requested:   `Return request for order #${orderId} has been received. We will review it shortly.`,
    Return_Accepted:    `Your return for order #${orderId} is accepted. Pickup will be arranged soon.`,
    Return_Rejected:    `Your return request for order #${orderId} was not approved. Contact support for details.`,
    Pickup_Assigned:    `A pickup partner has been assigned for your return order #${orderId}.`,
    Pickup_Done:        `Pickup for order #${orderId} is complete. Refund will be processed shortly.`,
    Returned:           `Order #${orderId} has been returned successfully. Refund initiated.`,
  };

  const msg =
    statusMessages[newStatus] ||
    `Your order #${orderId} status has been updated to: ${newStatus}.`;

  return formatSms(`
    Hi ${userName},
    ${msg}
    View details: likeson.in/orders
    -Likeson Healthcare
  `);
};

// ─── 5. Delivery OTP SMS ──────────────────────────────────────────────────────
// Triggered on: Driver is near delivery location

/**
 * @param {{ userName: string, orderId: string, otpCode: string }} props
 */
export const deliveryOtpSms = ({ userName, orderId, otpCode }) =>
  formatSms(`
    Hi ${userName}, your delivery for order #${orderId} is arriving!
    Share OTP ${otpCode} with the delivery partner to confirm receipt.
    Valid for 30 minutes. Do NOT share with anyone else.
    -Likeson Healthcare
  `);

// ─── 6. Refund Initiated SMS ──────────────────────────────────────────────────
// Triggered on: Refund processing confirmed

/**
 * @param {{ userName: string, orderId: string, refundAmount: number, refundMethod: string }} props
 */
export const refundSms = ({ userName, orderId, refundAmount, refundMethod }) => {
  const methodLabel = {
    Wallet:          'Likeson Wallet (Instant)',
    Online:          'Original Payment Method (3-7 days)',
    Bank_Transfer:   'Bank Transfer (3-7 business days)',
    Custom_Bank:     'Bank Account on file (3-7 business days)',
    Original_Source: 'Original Payment Method (3-7 days)',
  }[refundMethod] || refundMethod;

  return formatSms(`
    Hi ${userName}, refund of Rs.${(refundAmount || 0).toFixed(2)} for order #${orderId} has been initiated.
    Method: ${methodLabel}
    For queries: support@likeson.in
    -Likeson Healthcare
  `);
};

// ─── 7. Care Ride Booking Confirmation SMS ────────────────────────────────────
// Triggered on: Care ride booked successfully

/**
 * @param {{ userName: string, rideId: string, scheduledAt: string, pickupAddress: string }} props
 */
export const rideBookedSms = ({ userName, rideId, scheduledAt, pickupAddress }) =>
  formatSms(`
    Hi ${userName}, your care ride #${rideId} is confirmed!
    Scheduled: ${scheduledAt}
    Pickup: ${pickupAddress}
    Track live at likeson.in/rides
    -Likeson Healthcare
  `);

// ─── 8. Driver Assigned SMS ───────────────────────────────────────────────────
// Triggered on: Driver accepts the care ride request

/**
 * @param {{ userName: string, rideId: string, driverName: string, vehicleNumber: string, driverPhone: string }} props
 */
export const driverAssignedSms = ({ userName, rideId, driverName, vehicleNumber, driverPhone }) =>
  formatSms(`
    Hi ${userName}, a driver has been assigned for your ride #${rideId}.
    Driver: ${driverName} | Vehicle: ${vehicleNumber}
    Contact: ${driverPhone}
    Track live: likeson.in/rides
    -Likeson Healthcare
  `);

// ─── 9. Ride Started SMS ──────────────────────────────────────────────────────
// Triggered on: Driver starts the journey

/**
 * @param {{ userName: string, rideId: string, driverName: string }} props
 */
export const rideStartedSms = ({ userName, rideId, driverName }) =>
  formatSms(`
    Hi ${userName}, your care ride #${rideId} has started.
    Driver ${driverName} is on the way to your pickup location.
    Track live: likeson.in/rides
    -Likeson Healthcare
  `);

// ─── 10. Ride Completed SMS ───────────────────────────────────────────────────
// Triggered on: Ride marked as completed

/**
 * @param {{ userName: string, rideId: string, totalFare: number }} props
 */
export const rideCompletedSms = ({ userName, rideId, totalFare }) =>
  formatSms(`
    Hi ${userName}, your care ride #${rideId} is completed.
    Fare: Rs.${(totalFare || 0).toFixed(2)}
    Thank you for trusting Likeson for your healthcare journey!
    -Likeson Healthcare
  `);

// ─── 11. Ride Cancelled SMS ───────────────────────────────────────────────────
// Triggered on: Ride cancelled by user or system

/**
 * @param {{ userName: string, rideId: string, refundNote?: string }} props
 */
export const rideCancelledSms = ({ userName, rideId, refundNote = '' }) =>
  formatSms(`
    Hi ${userName}, your care ride #${rideId} has been cancelled.
    ${refundNote ? refundNote : 'Refund (if applicable) will be processed in 5-7 business days.'}
    Need help? Contact support@likeson.in
    -Likeson Healthcare
  `);

// ─── 12. Care Assistant Assigned SMS ─────────────────────────────────────────
// Triggered on: Care assistant assigned to a service request

/**
 * @param {{ userName: string, requestId: string, assistantName: string, assistantPhone: string }} props
 */
export const careAssistantAssignedSms = ({ userName, requestId, assistantName, assistantPhone }) =>
  formatSms(`
    Hi ${userName}, a care assistant has been assigned for your request #${requestId}.
    Assistant: ${assistantName}
    Contact: ${assistantPhone}
    They will guide you throughout your visit.
    -Likeson Healthcare
  `);

// ─── 13. Doctor Appointment Confirmation SMS ──────────────────────────────────
// Triggered on: Doctor appointment booked

/**
 * @param {{ userName: string, appointmentId: string, doctorName: string, scheduledAt: string, mode: string }} props
 * mode: 'In-Person' | 'Video' | 'Home Visit'
 */
export const appointmentConfirmedSms = ({ userName, appointmentId, doctorName, scheduledAt, mode = 'In-Person' }) =>
  formatSms(`
    Hi ${userName}, your appointment #${appointmentId} is confirmed.
    Doctor: Dr. ${doctorName} | Mode: ${mode}
    Scheduled: ${scheduledAt}
    View details: likeson.in/appointments
    -Likeson Healthcare
  `);

// ─── 14. Appointment Reminder SMS ────────────────────────────────────────────
// Triggered on: 1 hour / 24 hours before appointment

/**
 * @param {{ userName: string, doctorName: string, scheduledAt: string, mode: string }} props
 */
export const appointmentReminderSms = ({ userName, doctorName, scheduledAt, mode = 'In-Person' }) =>
  formatSms(`
    Reminder: Hi ${userName}, your appointment with Dr. ${doctorName} is coming up!
    Mode: ${mode} | Time: ${scheduledAt}
    Please be ready on time.
    -Likeson Healthcare
  `);

// ─── 15. Appointment Cancelled SMS ───────────────────────────────────────────
// Triggered on: Doctor appointment cancelled

/**
 * @param {{ userName: string, appointmentId: string, reason?: string }} props
 */
export const appointmentCancelledSms = ({ userName, appointmentId, reason = '' }) =>
  formatSms(`
    Hi ${userName}, your appointment #${appointmentId} has been cancelled.
    ${reason ? `Reason: ${reason}` : ''}
    To reschedule, visit likeson.in/appointments
    -Likeson Healthcare
  `);

// ─── 16. Diagnostic Booking Confirmation SMS ─────────────────────────────────
// Triggered on: Lab/diagnostic test booked

/**
 * @param {{ userName: string, bookingId: string, testName: string, scheduledAt: string, collectionType: string }} props
 * collectionType: 'Home Collection' | 'Lab Visit'
 */
export const diagnosticBookedSms = ({ userName, bookingId, testName, scheduledAt, collectionType = 'Home Collection' }) =>
  formatSms(`
    Hi ${userName}, your diagnostic test is booked! Booking ID: #${bookingId}
    Test: ${testName} | Type: ${collectionType}
    Scheduled: ${scheduledAt}
    -Likeson Healthcare
  `);

// ─── 17. Diagnostic Report Ready SMS ─────────────────────────────────────────
// Triggered on: Lab uploads report to patient dashboard

/**
 * @param {{ userName: string, bookingId: string, testName: string }} props
 */
export const diagnosticReportReadySms = ({ userName, bookingId, testName }) =>
  formatSms(`
    Hi ${userName}, your ${testName} report for booking #${bookingId} is ready.
    View & download: likeson.in/diagnostics
    Share with your doctor directly from the app.
    -Likeson Healthcare
  `);

// ─── 18. Prescription Ready SMS ───────────────────────────────────────────────
// Triggered on: Doctor issues e-prescription after consultation

/**
 * @param {{ userName: string, doctorName: string }} props
 */
export const prescriptionReadySms = ({ userName, doctorName }) =>
  formatSms(`
    Hi ${userName}, Dr. ${doctorName} has issued your e-prescription.
    View & order medicines directly: likeson.in/prescriptions
    -Likeson Healthcare
  `);

// ─── 19. Medicine Refill Reminder SMS ────────────────────────────────────────
// Triggered on: Auto-refill scheduler or manual trigger by support team

/**
 * @param {{ userName: string, medicineName: string }} props
 */
export const refillReminderSms = ({ userName, medicineName }) =>
  formatSms(`
    Hi ${userName}, it's time to refill your ${medicineName}.
    Order now to avoid missing your dose: likeson.in/pharmacy
    -Likeson Healthcare
  `);

// ─── 20. Subscription Plan Activated SMS ─────────────────────────────────────
// Triggered on: User subscribes to a care plan

/**
 * @param {{ userName: string, planName: string, validUntil: string }} props
 */
export const subscriptionActivatedSms = ({ userName, planName, validUntil }) =>
  formatSms(`
    Hi ${userName}, your ${planName} plan on Likeson.in is now active!
    Valid until: ${validUntil}
    Enjoy priority bookings, discounts & unlimited support.
    -Likeson Healthcare
  `);

// ─── 21. Subscription Renewal Reminder SMS ───────────────────────────────────
// Triggered on: 3 days before plan expiry

/**
 * @param {{ userName: string, planName: string, expiryDate: string }} props
 */
export const subscriptionRenewalSms = ({ userName, planName, expiryDate }) =>
  formatSms(`
    Hi ${userName}, your ${planName} plan expires on ${expiryDate}.
    Renew now to continue enjoying uninterrupted care: likeson.in/plans
    -Likeson Healthcare
  `);

// ─── 22. New Driver Request SMS ───────────────────────────────────────────────
// Triggered on: New ride request sent to nearby drivers

/**
 * @param {{ driverName: string, rideId: string, patientName: string, pickupAddress: string }} props
 */
export const newRideRequestToDriverSms = ({ driverName, rideId, patientName, pickupAddress }) =>
  formatSms(`
    Hi ${driverName}, new ride request #${rideId}!
    Patient: ${patientName}
    Pickup: ${pickupAddress}
    Accept from your Likeson Driver app now.
    -Likeson Healthcare
  `);

// ─── 23. New Care Request SMS (for Care Assistants) ──────────────────────────
// Triggered on: New care request assigned to an available assistant

/**
 * @param {{ assistantName: string, requestId: string, patientName: string, location: string, scheduledAt: string }} props
 */
export const newCareRequestToAssistantSms = ({ assistantName, requestId, patientName, location, scheduledAt }) =>
  formatSms(`
    Hi ${assistantName}, new care request #${requestId}!
    Patient: ${patientName} | Location: ${location}
    Scheduled: ${scheduledAt}
    Accept from your Likeson app now.
    -Likeson Healthcare
  `);

// ─── 24. New Order Notification (for Pharmacy) ────────────────────────────────
// Triggered on: New medicine order received by partner pharmacy

/**
 * @param {{ pharmacyName: string, orderId: string, itemCount: number }} props
 */
export const newOrderToPharmacySms = ({ pharmacyName, orderId, itemCount }) =>
  formatSms(`
    Hi ${pharmacyName}, you have a new order #${orderId} on Likeson.in!
    Items: ${itemCount}
    Log in to your pharmacy dashboard to process and dispatch.
    -Likeson Healthcare
  `);

// ─── 25. Account Blocked SMS ─────────────────────────────────────────────────
// Triggered on: Admin blocks a user account

/**
 * @param {{ name: string, reason?: string, unblockAt?: string }} props
 */
export const accountBlockedSms = ({ name, reason = 'policy violation', unblockAt }) =>
  formatSms(`
    Hi ${name}, your Likeson.in account has been temporarily suspended.
    Reason: ${reason}
    ${unblockAt ? `Expected unblock: ${unblockAt}` : ''}
    For queries: support@likeson.in
    -Likeson Healthcare
  `);

// ─── 26. Account Unblocked SMS ───────────────────────────────────────────────
// Triggered on: Admin unblocks a user account

/**
 * @param {{ name: string }} props
 */
export const accountUnblockedSms = ({ name }) =>
  formatSms(`
    Hi ${name}, your Likeson.in account has been restored and is fully active.
    You can now log in and access all services.
    -Likeson Healthcare
  `);

// ─── 27. Password Reset OTP SMS ───────────────────────────────────────────────
// Triggered on: User requests password reset via forgot-password flow

/**
 * @param {{ name: string, otpCode: string }} props
 */
export const passwordResetOtpSms = ({ name, otpCode }) =>
  formatSms(`
    Hi ${name}, your Likeson.in password reset OTP is ${otpCode}.
    Valid for 15 minutes. If you did not request this, contact us immediately.
    -Likeson Healthcare
  `);

// ─── 28. Password Changed Confirmation SMS ────────────────────────────────────
// Triggered on: Password successfully changed (reset-password or change-password)

/**
 * @param {{ name: string, changedAt: string }} props
 */
export const passwordChangedSms = ({ name, changedAt }) =>
  formatSms(`
    Hi ${name}, your Likeson.in account password was changed on ${changedAt}.
    If this was not you, secure your account immediately at likeson.in/security
    -Likeson Healthcare
  `);

// ─── 29. Login Alert SMS ─────────────────────────────────────────────────────
// Triggered on: Login from a new device or unrecognised IP

/**
 * @param {{ name: string, deviceName: string, ipAddress: string }} props
 */
export const newLoginAlertSms = ({ name, deviceName, ipAddress }) =>
  formatSms(`
    Hi ${name}, a new login was detected on your Likeson.in account.
    Device: ${deviceName} | IP: ${ipAddress}
    Not you? Secure your account at likeson.in/security
    -Likeson Healthcare
  `);

// ─── 30. Payment Failed SMS ───────────────────────────────────────────────────
// Triggered on: Payment gateway returns failure

/**
 * @param {{ userName: string, amount: number, serviceType: string }} props
 * serviceType: 'order', 'ride', 'subscription', 'diagnostic'
 */
export const paymentFailedSms = ({ userName, amount, serviceType = 'service' }) =>
  formatSms(`
    Hi ${userName}, your payment of Rs.${(amount || 0).toFixed(2)} for your ${serviceType} on Likeson.in has failed.
    Please retry or use a different payment method: likeson.in/payments
    -Likeson Healthcare
  `);

// ─── 31. Payment Successful SMS ───────────────────────────────────────────────
// Triggered on: Successful payment confirmation from gateway

/**
 * @param {{ userName: string, amount: number, referenceId: string, serviceType: string }} props
 */
export const paymentSuccessfulSms = ({ userName, amount, referenceId, serviceType = 'service' }) =>
  formatSms(`
    Hi ${userName}, payment of Rs.${(amount || 0).toFixed(2)} for your ${serviceType} is confirmed.
    Reference ID: ${referenceId}
    Thank you for using Likeson.in
    -Likeson Healthcare
  `);

// ─── Summary of all SMS template keys ────────────────────────────────────────
// Useful for DLT registration reference or internal documentation.

export const SMS_TEMPLATE_KEYS = {
  OTP:                        'otpSms',
  WELCOME:                    'welcomeSms',
  ORDER_PLACED:               'orderPlacedSms',
  ORDER_STATUS:               'orderStatusSms',
  DELIVERY_OTP:               'deliveryOtpSms',
  REFUND:                     'refundSms',
  RIDE_BOOKED:                'rideBookedSms',
  DRIVER_ASSIGNED:            'driverAssignedSms',
  RIDE_STARTED:               'rideStartedSms',
  RIDE_COMPLETED:             'rideCompletedSms',
  RIDE_CANCELLED:             'rideCancelledSms',
  CARE_ASSISTANT_ASSIGNED:    'careAssistantAssignedSms',
  APPOINTMENT_CONFIRMED:      'appointmentConfirmedSms',
  APPOINTMENT_REMINDER:       'appointmentReminderSms',
  APPOINTMENT_CANCELLED:      'appointmentCancelledSms',
  DIAGNOSTIC_BOOKED:          'diagnosticBookedSms',
  DIAGNOSTIC_REPORT_READY:    'diagnosticReportReadySms',
  PRESCRIPTION_READY:         'prescriptionReadySms',
  REFILL_REMINDER:            'refillReminderSms',
  SUBSCRIPTION_ACTIVATED:     'subscriptionActivatedSms',
  SUBSCRIPTION_RENEWAL:       'subscriptionRenewalSms',
  DRIVER_NEW_RIDE_REQUEST:    'newRideRequestToDriverSms',
  ASSISTANT_NEW_CARE_REQUEST: 'newCareRequestToAssistantSms',
  PHARMACY_NEW_ORDER:         'newOrderToPharmacySms',
  ACCOUNT_BLOCKED:            'accountBlockedSms',
  ACCOUNT_UNBLOCKED:          'accountUnblockedSms',
  PASSWORD_RESET_OTP:         'passwordResetOtpSms',
  PASSWORD_CHANGED:           'passwordChangedSms',       // ← NEW
  NEW_LOGIN_ALERT:            'newLoginAlertSms',
  PAYMENT_FAILED:             'paymentFailedSms',
  PAYMENT_SUCCESSFUL:         'paymentSuccessfulSms',
};