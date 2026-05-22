import express from 'express';
import axios   from 'axios';

import {
  // Models
  Booking,
  Ride,
  RideTracking,
  OutPatientRecord,
  UserSubscription,
  DoctorProfile,
  Hospital,

  // Auth
  protect,
  authorize,

  // Discovery
  getHospitals,
  getDoctorsByHospital,
  checkHospitalOrDoctorAvailability,
  getLabs,
  getLabWithTests,

  // Transport
  resolveKmRate,
  resolveTransportFare,
  autoAssignCareAssistant,

  // Consultation + follow-up
  checkFollowUpEligibility,
  checkSubscriptionConsultation,
  resolveConsultationFee,

  // Mode check
  checkConsultationModeAllowed,

  // Subscription usage
  incrementSubscriptionUsage,
  queueSubscriptionUsage,
  flushAndRecord,
  recoverSubscriptionUsageOnCancel,

  // Care assistant
  checkSubscriptionCareAssistant,
  resolveCareAssistantFee,

  // Diagnostics helper
  checkSubscriptionDiagnostics,

  // Fare
  buildFareBreakdown,
  buildRidePayload,

  // OP
  generateOpNumber,

  // Payment
  createRazorpayOrder,
  processWalletPayment,

  // Refund + misc
  computeRefundAmount,
  resolveServiceComponents,
  hashOtp,
  genOtp,
  haversineKm,
  createNotification,
  CUSTOMER_BOOKING_TYPES,
  verifyRazorpaySignature,

  // Canonical route
  calculateCanonicalRoute,
  SubscriptionPlan,

  // Email (existing helper kept for backward-compat)
  sendBookingConfirmationEmail,
} from './bookingRouterShared.js';

import PlatformPricingConfig from '../models/PlatformPricingConfig.js';

// ✉️ EMAIL — sendEmail util + all templates
import sendEmail from '../utils/sendEmail.js';
import {
  otpTemplate,
  welcomeTemplate,
  transactionalTemplate,
  buildOrderEmailHtml,
  buildStatusUpdateEmail,
  buildDeliveryOtpEmail,
  buildRefundEmail,
  buildInvoiceHtml,
} from '../utils/emailTemplates.js';

// ─────────────────────────────────────────────────────────────────────────────
// ✉️ HELPER: resolve recipient email(s) for a booking
//   Returns { customerEmail, doctorEmail, hospitalEmail }
//   Each is null when not available — callers guard before sending.
// ─────────────────────────────────────────────────────────────────────────────
import User from '../models/User.js';

const resolveBookingEmails = async (booking) => {
  try {
    const [customerDoc, doctorDoc, hospitalDoc] = await Promise.all([
      booking.customer
        ? User.findById(booking.customer).select('email name').lean()
        : null,
      booking.doctor
        ? DoctorProfile.findById(booking.doctor)
            .populate('user', 'email name')
            .select('user')
            .lean()
        : null,
      booking.hospital
        ? Hospital.findById(booking.hospital).select('contact name').lean()
        : null,
    ]);

    return {
      customerEmail:  customerDoc?.email      ?? null,
      customerName:   customerDoc?.name       ?? 'Valued Customer',
      doctorEmail:    doctorDoc?.user?.email  ?? null,
      doctorName:     doctorDoc?.user?.name   ?? 'Doctor',
      hospitalEmail:  hospitalDoc?.contact?.email ?? null,
      hospitalName:   hospitalDoc?.name       ?? 'Hospital',
    };
  } catch (e) {
    console.error('[resolveBookingEmails]', e.message);
    return { customerEmail: null, doctorEmail: null, hospitalEmail: null };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✉️ HELPER: send booking-created email to customer + doctor + hospital
// ─────────────────────────────────────────────────────────────────────────────
const sendBookingCreatedEmails = async ({ booking, orderItems = [], billing, storeName, actionLink }) => {
  try {
    const {
      customerEmail, customerName,
      doctorEmail, doctorName,
      hospitalEmail, hospitalName,
    } = await resolveBookingEmails(booking);

    const fb = billing || booking.fareBreakdown || {};

    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    // Build rich order items from fareBreakdown fields
    const resolvedItems = orderItems.length ? orderItems : [
      fb.consultationFee  > 0 && { name: 'Consultation Fee',        qty: 1, price: fmt(fb.consultationFee)  },
      fb.careAssistantFee > 0 && { name: 'Care Assistant',          qty: 1, price: fmt(fb.careAssistantFee) },
      fb.transportFee     > 0 && { name: 'Transport',               qty: 1, price: fmt(fb.transportFee)     },
      fb.diagnosticFee    > 0 && { name: 'Diagnostic Tests',        qty: 1, price: fmt(fb.diagnosticFee)    },
      fb.homeCollectionFee > 0 && { name: 'Home Collection Fee',    qty: 1, price: fmt(fb.homeCollectionFee)},
      fb.discount         > 0 && { name: 'Subscription Discount',   qty: 1, price: `-${fmt(fb.discount)}`   },
      fb.couponDiscount   > 0 && { name: 'Coupon Discount',         qty: 1, price: `-${fmt(fb.couponDiscount)}` },
      fb.taxes            > 0 && { name: `GST / Taxes`,             qty: 1, price: fmt(fb.taxes)            },
    ].filter(Boolean);

    const paymentStatus = booking.paymentStatus ?? 'unpaid';
    const paymentMethod = booking.payments?.[0]?.gateway ?? 'Pending';
    const isPaid        = paymentStatus === 'paid';

    const billingPayload = {
      subtotal:    fmt((fb.totalAmount || 0) - (fb.taxes || 0)),
      tax:         fmt(fb.taxes),
      discount:    fmt((fb.discount || 0) + (fb.couponDiscount || 0)),
      total:       fmt(fb.totalAmount),
      amountPaid:  fmt(fb.amountPaid),
      amountDue:   fmt(Math.max(0, (fb.totalAmount || 0) - (fb.amountPaid || 0))),
      currency:    fb.currency || 'INR',
      paymentStatus: isPaid ? 'PAID ✅' : 'UNPAID ⏳',
      paymentMethod: paymentMethod,
    };

    const scheduledStr = booking.scheduledAt
      ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    // Build GST breakdown note
    const gstNote = [
      fb.consultationFee  > 0 ? `Consultation: 0% GST (exempt)`           : null,
      fb.transportFee     > 0 ? `Transport: 5% GST`                       : null,
      fb.careAssistantFee > 0 ? `Care Assistant: 18% GST`                 : null,
      fb.diagnosticFee    > 0 ? `Diagnostics: 5% GST`                     : null,
    ].filter(Boolean).join(' · ');

    const headerNote = `
      Booking <strong>#${booking.bookingCode}</strong> confirmed for 
      <strong>${scheduledStr}</strong>.<br>
      Payment Status: <strong style="color:${isPaid ? '#15803d' : '#dc2626'}">${billingPayload.paymentStatus}</strong>
      ${isPaid ? '' : ` — Amount Due: <strong>${billingPayload.amountDue}</strong>`}
    `;

    const sharedPayload = {
      userName:    customerName,
      order:       { orderId: booking.bookingCode },
      orderItems:  resolvedItems,
      billing:     billingPayload,
      storeName:   storeName || 'Likeson Healthcare',
      actionLink:  actionLink || `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      statusLabel: isPaid ? 'Booking Confirmed & Paid!' : 'Booking Confirmed — Payment Pending',
      statusIcon:  isPaid ? '✅' : '⏳',
      statusColor: isPaid ? '#15803d' : '#d97706',
      statusBg:    isPaid ? '#f0fdf4' : '#fffbeb',
      statusBorder:isPaid ? '#bbf7d0' : '#fde68a',
      headerNote,
    };

    // Customer — full breakdown
    if (customerEmail) {
      const customerHtml = buildOrderEmailHtml(sharedPayload);

      // Append GST + payment instructions block
      const gstBlock = `
        <div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#64748b;">
          <p style="margin:0 0 6px;font-weight:700;color:#374151;">GST Breakdown</p>
          <p style="margin:0;">${gstNote || 'GST included in total above'}</p>
        </div>
        ${!isPaid ? `
        <div style="margin:16px 0;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">
          <p style="margin:0 0 6px;font-weight:700;">Payment Instructions</p>
          <p style="margin:0;">
            Amount Due: <strong>${billingPayload.amountDue}</strong><br>
            ${paymentMethod === 'Cash'
              ? 'Pay cash at the time of service to the assigned provider.'
              : paymentMethod === 'Wallet'
              ? 'Deducted from your Likeson wallet.'
              : 'Complete payment via Razorpay — UPI, Card, or Net Banking accepted.'
            }
          </p>
        </div>` : ''}
      `;

      sendEmail({
        email:   customerEmail,
        subject: `Booking ${isPaid ? 'Confirmed & Paid' : 'Confirmed — Payment Pending'} — #${booking.bookingCode} | Likeson Healthcare`,
        html:    customerHtml + gstBlock,
      }).catch(e => console.error('[email] customer booking-created:', e.message));
    }

    // Doctor
    if (doctorEmail) {
      sendEmail({
        email:   doctorEmail,
        subject: `New Appointment — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: 'NEW APPOINTMENT',
          title:  `New booking from ${customerName}`,
          body: `
            Booking <strong>#${booking.bookingCode}</strong> scheduled for 
            <strong>${scheduledStr}</strong>.<br><br>
            Patient: <strong>${booking.patientInfo?.name ?? customerName}</strong><br>
            Type: <strong>${booking.bookingType?.replace(/_/g, ' ')}</strong><br>
            Consultation Fee: <strong>${fmt(fb.consultationFee)}</strong><br>
            Payment: <strong>${billingPayload.paymentStatus}</strong>
          `,
          buttonText: 'View Appointment',
          buttonLink: `${process.env.FRONTEND_URL}/doctor/bookings/${booking._id}`,
        }),
      }).catch(e => console.error('[email] doctor booking-created:', e.message));
    }

    // Hospital
    if (hospitalEmail) {
      sendEmail({
        email:   hospitalEmail,
        subject: `New Patient Booking — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: 'NEW PATIENT BOOKING',
          title:  `Booking #${booking.bookingCode} received`,
          body: `
            Customer: <strong>${customerName}</strong><br>
            Scheduled: <strong>${scheduledStr}</strong><br>
            Doctor: <strong>${doctorName}</strong><br>
            Service: <strong>${booking.bookingType?.replace(/_/g, ' ')}</strong><br><br>
            Total: <strong>${fmt(fb.totalAmount)}</strong> · 
            GST: <strong>${fmt(fb.taxes)}</strong><br>
            Payment: <strong>${billingPayload.paymentStatus}</strong>
          `,
          buttonText: 'View Booking',
          buttonLink: `${process.env.FRONTEND_URL}/hospital/bookings/${booking._id}`,
        }),
      }).catch(e => console.error('[email] hospital booking-created:', e.message));
    }
  } catch (e) {
    console.error('[sendBookingCreatedEmails]', e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✉️ HELPER: send payment confirmed email
// ─────────────────────────────────────────────────────────────────────────────
const sendPaymentConfirmedEmails = async ({ booking, paymentMethod = 'Razorpay' }) => {
  try {
    const { customerEmail, customerName, doctorEmail, hospitalEmail } =
      await resolveBookingEmails(booking);

    const fb  = booking.fareBreakdown || {};
    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    const scheduledStr = booking.scheduledAt
      ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    const body = `
      Payment of <strong>${fmt(fb.totalAmount)}</strong> received via 
      <strong>${paymentMethod}</strong> for booking <strong>#${booking.bookingCode}</strong>.<br><br>

      <table width="100%" cellpadding="0" cellspacing="0" 
             style="font-size:13px;color:#374151;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:5px 0;color:#6b7280;">Scheduled At</td>
          <td style="text-align:right;font-weight:600;">${scheduledStr}</td>
        </tr>
        ${fb.consultationFee  > 0 ? `<tr><td style="padding:5px 0;color:#6b7280;">Consultation Fee</td><td style="text-align:right;">${fmt(fb.consultationFee)}</td></tr>` : ''}
        ${fb.careAssistantFee > 0 ? `<tr><td style="padding:5px 0;color:#6b7280;">Care Assistant</td><td style="text-align:right;">${fmt(fb.careAssistantFee)}</td></tr>` : ''}
        ${fb.transportFee     > 0 ? `<tr><td style="padding:5px 0;color:#6b7280;">Transport</td><td style="text-align:right;">${fmt(fb.transportFee)}</td></tr>` : ''}
        ${fb.diagnosticFee    > 0 ? `<tr><td style="padding:5px 0;color:#6b7280;">Diagnostic Tests</td><td style="text-align:right;">${fmt(fb.diagnosticFee)}</td></tr>` : ''}
        ${fb.homeCollectionFee> 0 ? `<tr><td style="padding:5px 0;color:#6b7280;">Home Collection</td><td style="text-align:right;">${fmt(fb.homeCollectionFee)}</td></tr>` : ''}
        ${(fb.discount || 0) + (fb.couponDiscount || 0) > 0 ? `<tr><td style="padding:5px 0;color:#059669;">Discounts</td><td style="text-align:right;color:#059669;">−${fmt((fb.discount||0)+(fb.couponDiscount||0))}</td></tr>` : ''}
        ${fb.taxes            > 0 ? `<tr><td style="padding:5px 0;color:#6b7280;">GST / Taxes</td><td style="text-align:right;">${fmt(fb.taxes)}</td></tr>` : ''}
        <tr style="border-top:2px solid #e2e8f0;">
          <td style="padding:8px 0;font-weight:800;font-size:14px;">Total Paid</td>
          <td style="text-align:right;font-weight:800;font-size:14px;color:#4f46e5;">${fmt(fb.totalAmount)}</td>
        </tr>
      </table>

      <div style="margin-top:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;
                  border-radius:8px;font-size:12px;color:#15803d;">
        ✅ Payment confirmed via <strong>${paymentMethod}</strong>. 
        Your booking is fully confirmed.
      </div>

      <div style="margin-top:10px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;
                  border-radius:8px;font-size:11px;color:#64748b;">
        <strong>GST Notes:</strong> Consultation 0% · Transport 5% · Care Assistant 18% · Diagnostics 5%
      </div>
    `;

    if (customerEmail) {
      sendEmail({
        email:   customerEmail,
        subject: `Payment Confirmed — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: 'PAYMENT CONFIRMED',
          title:  'Your payment was received!',
          body,
          buttonText: 'View Booking',
          buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
        }),
      }).catch(e => console.error('[email] customer payment-confirmed:', e.message));
    }

    if (hospitalEmail) {
      sendEmail({
        email:   hospitalEmail,
        subject: `Payment Received — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: 'PAYMENT RECEIVED',
          title:  `Payment for Booking #${booking.bookingCode}`,
          body,
          buttonText: 'View Booking',
          buttonLink: `${process.env.FRONTEND_URL}/hospital/bookings/${booking._id}`,
        }),
      }).catch(e => console.error('[email] hospital payment-confirmed:', e.message));
    }
  } catch (e) {
    console.error('[sendPaymentConfirmedEmails]', e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✉️ HELPER: send status update email
// ─────────────────────────────────────────────────────────────────────────────
const sendStatusUpdateEmails = async ({ booking, newStatus, orderItems = [], billing, storeName }) => {
  try {
    const { customerEmail, customerName, doctorEmail, hospitalEmail, hospitalName } =
      await resolveBookingEmails(booking);

    const html = buildStatusUpdateEmail({
      userName:   customerName,
      order:      { orderId: booking.bookingCode },
      orderItems,
      billing,
      storeName,
      actionLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
      newStatus,
    });

    if (customerEmail) {
      sendEmail({
        email:   customerEmail,
        subject: `Booking Update — ${newStatus} | #${booking.bookingCode} | Likeson Healthcare`,
        html,
      }).catch(e => console.error('[email] customer status-update:', e.message));
    }

    // Notify doctor on key statuses
    if (doctorEmail && ['Confirmed', 'Cancelled'].includes(newStatus)) {
      sendEmail({
        email:   doctorEmail,
        subject: `Booking ${newStatus} — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: `BOOKING ${newStatus.toUpperCase()}`,
          title:  `Booking #${booking.bookingCode} is now ${newStatus}`,
          body:   `Status changed to <strong>${newStatus}</strong>. Patient: ${booking.patientInfo?.name ?? customerName}.`,
          buttonText: 'View Details',
          buttonLink: `${process.env.FRONTEND_URL}/doctor/bookings/${booking._id}`,
        }),
      }).catch(e => console.error('[email] doctor status-update:', e.message));
    }

    // Notify hospital on key statuses
    if (hospitalEmail && ['Confirmed', 'Cancelled', 'Delivered'].includes(newStatus)) {
      sendEmail({
        email:   hospitalEmail,
        subject: `Booking ${newStatus} — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: `BOOKING ${newStatus.toUpperCase()}`,
          title:  `Booking #${booking.bookingCode} is now ${newStatus}`,
          body:   `Status updated to <strong>${newStatus}</strong> for booking <strong>#${booking.bookingCode}</strong>.`,
          buttonText: 'View Details',
          buttonLink: `${process.env.FRONTEND_URL}/hospital/bookings/${booking._id}`,
        }),
      }).catch(e => console.error('[email] hospital status-update:', e.message));
    }
  } catch (e) {
    console.error('[sendStatusUpdateEmails]', e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✉️ HELPER: send cancellation + refund emails
// ─────────────────────────────────────────────────────────────────────────────
const sendCancellationEmails = async ({ booking, refundAmount, refundPercent }) => {
  try {
    const { customerEmail, customerName, doctorEmail, hospitalEmail } =
      await resolveBookingEmails(booking);

    // Status email to customer
    if (customerEmail) {
      sendEmail({
        email:   customerEmail,
        subject: `Booking Cancelled — #${booking.bookingCode} | Likeson Healthcare`,
        html:    buildStatusUpdateEmail({
          userName:   customerName,
          order:      { orderId: booking.bookingCode },
          actionLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
          newStatus:  'Cancelled',
        }),
      }).catch(e => console.error('[email] customer cancel:', e.message));

      // Separate refund email if applicable
      if (refundAmount > 0) {
        sendEmail({
          email:   customerEmail,
          subject: `Refund Initiated — #${booking.bookingCode} | Likeson Healthcare`,
          html:    buildRefundEmail({
            userName:     customerName,
            order:        { orderId: booking.bookingCode },
            refundAmount,
            refundMethod: booking.payments?.[0]?.gateway === 'Wallet' ? 'Wallet' : 'Original_Source',
            actionLink:   `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
          }),
        }).catch(e => console.error('[email] customer refund:', e.message));
      }
    }

    // Notify doctor
    if (doctorEmail) {
      sendEmail({
        email:   doctorEmail,
        subject: `Booking Cancelled — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: 'BOOKING CANCELLED',
          title:  `Booking #${booking.bookingCode} has been cancelled`,
          body:   `The patient has cancelled booking <strong>#${booking.bookingCode}</strong>. No further action needed.`,
          buttonText: 'View Schedule',
          buttonLink: `${process.env.FRONTEND_URL}/doctor/schedule`,
        }),
      }).catch(e => console.error('[email] doctor cancel:', e.message));
    }

    // Notify hospital
    if (hospitalEmail) {
      sendEmail({
        email:   hospitalEmail,
        subject: `Booking Cancelled — #${booking.bookingCode} | Likeson Healthcare`,
        html:    transactionalTemplate({
          header: 'BOOKING CANCELLED',
          title:  `Booking #${booking.bookingCode} cancelled`,
          body:   `Booking <strong>#${booking.bookingCode}</strong> was cancelled by the patient.${refundAmount > 0 ? ` Refund of <strong>₹${refundAmount}</strong> initiated.` : ''}`,
          buttonText: 'View Bookings',
          buttonLink: `${process.env.FRONTEND_URL}/hospital/bookings`,
        }),
      }).catch(e => console.error('[email] hospital cancel:', e.message));
    }
  } catch (e) {
    console.error('[sendCancellationEmails]', e.message);
  }
};

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/hospitals', protect, async (req, res) => {
  try {
    const { city, hospitalType } = req.query;
    const hospitals = await getHospitals({ city, hospitalType });
    res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hospitals/:hospitalId/doctors', protect, async (req, res) => {
  try {
    const doctors = await getDoctorsByHospital(req.params.hospitalId);
    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

router.get('/hospitals/:hospitalId/availability', protect, async (req, res) => {
  try {
    const { scheduledAt } = req.query;
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt required' });
    const result = await checkHospitalOrDoctorAvailability({
      hospitalId:  req.params.hospitalId,
      scheduledAt: new Date(scheduledAt),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/doctors/:doctorId/availability', protect, async (req, res) => {
  try {
    const { scheduledAt, hospitalId } = req.query;
    if (!scheduledAt)
      return res.status(400).json({ success: false, message: 'scheduledAt required' });
    const result = await checkHospitalOrDoctorAvailability({
      hospitalId,
      doctorId:    req.params.doctorId,
      scheduledAt: new Date(scheduledAt),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/labs', protect, async (req, res) => {
  try {
    const { city, labType, homeCollection } = req.query;
    const labs = await getLabs({ city, labType, homeCollection: homeCollection === 'true' });
    res.json({ success: true, count: labs.length, data: labs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/labs/:labId', protect, async (req, res) => {
  try {
    const lab = await getLabWithTests(req.params.labId);
    res.json({ success: true, data: lab });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

router.get('/booking-options/:type', protect, (req, res) => {
  const { type } = req.params;
  if (!CUSTOMER_BOOKING_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid booking type. Allowed: ${CUSTOMER_BOOKING_TYPES.join(', ')}`,
    });
  }
  const components = resolveServiceComponents(type);
  res.json({ success: true, data: { bookingType: type, components } });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /transport/estimate
// ─────────────────────────────────────────────────────────────────────────────

router.get('/transport/estimate', protect, async (req, res) => {
  try {
    const {
      pickupLng, pickupLat, dropoffLng, dropoffLat,
      includeReturn  = 'false',
      waitingMinutes = '0',
      bookingType    = 'patient_transport',
    } = req.query;

    if (!pickupLng || !pickupLat || !dropoffLng || !dropoffLat) {
      return res.status(400).json({
        success: false,
        message: 'pickupLng, pickupLat, dropoffLng, dropoffLat required',
      });
    }

    const pickupCoords  = [parseFloat(pickupLng),  parseFloat(pickupLat)];
    const dropoffCoords = [parseFloat(dropoffLng), parseFloat(dropoffLat)];

    const { ratePerKm, source } = await resolveKmRate(req.user._id);

    const fareResult = resolveTransportFare({
      bookingType,
      pickupCoords, dropoffCoords, ratePerKm,
      includeReturn:  includeReturn === 'true',
      waitingMinutes: parseInt(waitingMinutes, 10),
    });

    res.json({
      success: true,
      data: { ...fareResult, kmRateSource: source, ratePerKm },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /consultation-check
// ─────────────────────────────────────────────────────────────────────────────

router.get('/consultation-check', protect, authorize('customer'), async (req, res) => {
  try {
    const { consultationType = 'inPerson' } = req.query;
    const [consultResult, caResult, diagResult] = await Promise.all([
      checkSubscriptionConsultation(req.user._id, consultationType),
      checkSubscriptionCareAssistant(req.user._id),
      checkSubscriptionDiagnostics(req.user._id),
    ]);

    const config = await PlatformPricingConfig.getGlobal();
    let careAssistantCustomFee = null;
    if (caResult.allowed && caResult.planType === 'custom' && caResult.sub?.plan) {
      const plan = await SubscriptionPlan.findById(caResult.sub.plan)
        .select('planType customOptions').lean();
      if (plan?.planType === 'custom') {
        const caOpt = plan.customOptions?.find(o => o.optionKey === 'careAssistant');
        if (caOpt) {
          const tierIndex   = caOpt.careAssistantTierIndex ?? 0;
          const customTiers = config?.customPlanOptions?.careAssistant?.pricingTiers ?? [];
          const tier        = customTiers[tierIndex] ?? customTiers[0];
          careAssistantCustomFee = tier?.chargeToUser ?? caOpt.unitPrice ?? null;
        }
      }
    }

    return res.json({
      success: true,
      data: {
        allowed:           consultResult.allowed,
        isFree:            consultResult.isFree,
        remaining:         consultResult.remaining,
        reason:            consultResult.reason,
        consultationFree:  consultResult.isFree,
        consultationQuota: consultResult.reason,
        careAssistantFree:      caResult.isFree,
        careAssistantQuota:     caResult.reason,
        careAssistantAllowed:   caResult.allowed,
        careAssistantRemaining: caResult.remaining,
        isCustomPlan:           caResult.planType === 'custom',
        careAssistantCustomFee,
        diagnosticsDiscountPercent: diagResult.discountPercent  ?? 0,
        homeSampleCollectionFree:   diagResult.homeSampleCollection ?? false,
        kmRateSource: null,
        ratePerKm:    null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/follow-up/check', protect, async (req, res) => {
  try {
    const { doctorId, hospitalId } = req.query;
    if (!doctorId)
      return res.status(400).json({ success: false, message: 'doctorId required' });
    const result = await checkFollowUpEligibility({
      customerId: req.user._id, doctorId, hospitalId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — FULL CARE RIDE
// ═════════════════════════════════════════════════════════════════════════════

router.post('/full-care-ride', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      hospitalId, doctorId, scheduledAt,
      consultationType  = 'inPerson',
      patientInfo, patientLocation, destinationLocation,
      includeReturnHome = false,
      slotId, documents = [],
      paymentMethod = 'Razorpay',
      couponCode, coinsToRedeem = 0,
    } = req.body;

    if (!hospitalId || !doctorId || !scheduledAt || !patientInfo || !patientLocation) {
      return res.status(400).json({
        success: false,
        message: 'hospitalId, doctorId, scheduledAt, patientInfo, patientLocation required',
      });
    }
    if (!patientLocation?.coordinates?.length) {
      return res.status(400).json({ success: false, message: 'patientLocation.coordinates [lng, lat] required' });
    }

    const scheduledDate = new Date(scheduledAt);

    const avail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
    if (!avail.available)
      return res.status(400).json({ success: false, message: avail.reason });

    const modeCheck = await checkConsultationModeAllowed(req.user._id, consultationType);
    if (!modeCheck.allowed)
      return res.status(403).json({ success: false, message: modeCheck.reason });

    const hospital = await Hospital.findById(hospitalId)
      .select('location address name managementModel consultationPricing')
      .lean();
    if (!hospital)
      return res.status(404).json({ success: false, message: 'Hospital not found' });

    const hospCoords = destinationLocation?.coordinates || hospital.location?.coordinates;
    if (!hospCoords?.length)
      return res.status(400).json({ success: false, message: 'Hospital location unavailable. Provide destinationLocation.' });

    const subCheck                = await checkSubscriptionConsultation(req.user._id, consultationType);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId, consultationType,
    });

    const { ratePerKm, source: kmRateSource } = await resolveKmRate(req.user._id);
    const pickupCoords  = patientLocation.coordinates;
    const dropoffCoords = hospCoords;

    const transportCalc = resolveTransportFare({
      bookingType:   'full_care_ride',
      pickupCoords, dropoffCoords, ratePerKm,
      includeReturn: includeReturnHome,
    });

    const careAssistant = await autoAssignCareAssistant({
      patientCoords: pickupCoords,
      city: patientLocation.city || hospital.address?.city || 'Vijayawada',
    });
    if (!careAssistant)
      return res.status(503).json({ success: false, message: 'No care assistant available at this time.' });

    const config = await PlatformPricingConfig.getGlobal();

    const careResult = await resolveCareAssistantFee({
      userId:        req.user._id,
      durationHours: 4,
      config,
    });

    const fareBreakdown = buildFareBreakdown({
      consultationFee,
      careAssistantFee:  careResult.fee,
      transportFee:      transportCalc.totalTransportFee,
      taxPercent:        config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType:     'full_care_ride',
      customer:        req.user._id,
      patientInfo,
      doctor:          doctorId,
      hospital:        hospitalId,
      careAssistant:   careAssistant._id,
      consultationType,
      scheduledAt:     scheduledDate,
      slotId:          slotId || null,
      patientLocation: {
        type: 'Point', coordinates: pickupCoords,
        address: patientLocation.address, city: patientLocation.city, pincode: patientLocation.pincode,
      },
      destinationLocation: {
        type: 'Point', coordinates: dropoffCoords,
        address: destinationLocation?.address || hospital.address?.line1,
        city:    destinationLocation?.city    || hospital.address?.city,
      },
      documents,
      fareBreakdown,
      pricingSource: pricingSource === 'hospital' ? 'hospital' : pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus:  'unpaid',
      payments:       [],
      couponCode:     couponCode || undefined,
      coinsRedeemed:  coinsToRedeem,
      status:         'pending',
      createdBy:      req.user._id,
      subscriptionUsagePending:    [],
      confirmedSubscriptionUsage:  [],
      careAssistantSnapshot: {
        name:     careAssistant.fullName,
        photoUrl: careAssistant.photoUrl,
        phone:    careAssistant.phone,
      },
    });

    if (isCoveredBySubscription && subCheck.sub) {
      await queueSubscriptionUsage(booking._id, subCheck.sub._id, 'consultationsUsed');
    }
    if ((careResult.isCoveredBySubscription || careResult.quotaTracked) && careResult.sub) {
      await queueSubscriptionUsage(booking._id, careResult.sub._id, 'careAssistantVisitsUsed');
    }

    // ── Payment handling ───────────────────────────────────────────────────
    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus               = 'paid';
      booking.payments                    = [wp];
      booking.fareBreakdown.walletApplied = fareBreakdown.totalAmount;
      booking.fareBreakdown.amountPaid    = 0;
      await booking.save();
      await flushAndRecord(booking);
      // ✉️ Payment confirmed via Wallet
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' });
    }

    if (fareBreakdown.totalAmount === 0 && paymentMethod === 'Razorpay') {
      booking.paymentStatus = 'paid';
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Free (₹0)' });
    }

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    // Build rides
    const { distanceKm: outDistKm, durationMin: outDurMin, polyline: outPolyline } =
      await calculateCanonicalRoute(pickupCoords, dropoffCoords);

    const outboundRide = await Ride.create({
      ...buildRidePayload({
        bookingId:         booking._id,
        rideType:          'patient',
        vehicleClass:      'four_wheeler',
        pickupCoords,
        pickupAddress:     patientLocation.address,
        pickupCity:        patientLocation.city,
        dropoffCoords,
        dropoffAddress:    destinationLocation?.address || hospital.address?.line1,
        dropoffCity:       destinationLocation?.city    || hospital.address?.city,
        scheduledPickupAt: scheduledDate,
        isReturnRide:      false,
        createdBy:         req.user._id,
      }),
      estimatedDistanceKm:  outDistKm,
      estimatedDurationMin: outDurMin,
    });

    const outTracking = await RideTracking.create({
      ride: outboundRide._id, booking: booking._id, expectedRoutePolyline: outPolyline,
    });
    await Ride.findByIdAndUpdate(outboundRide._id, { $set: { trackingId: outTracking._id } });

    let returnRide = null, retDistKm = null, retDurMin = null, retPolyline = null;

    if (includeReturnHome) {
      const retRoute = await calculateCanonicalRoute(dropoffCoords, pickupCoords);
      retDistKm   = retRoute.distanceKm;
      retDurMin   = retRoute.durationMin;
      retPolyline = retRoute.polyline;

      returnRide = await Ride.create({
        ...buildRidePayload({
          bookingId:         booking._id,
          rideType:          'patient',
          vehicleClass:      'four_wheeler',
          pickupCoords:      dropoffCoords,
          pickupAddress:     destinationLocation?.address || hospital.address?.line1,
          pickupCity:        destinationLocation?.city    || hospital.address?.city,
          dropoffCoords:     pickupCoords,
          dropoffAddress:    patientLocation.address,
          dropoffCity:       patientLocation.city,
          scheduledPickupAt: scheduledDate,
          isReturnRide:      true,
          createdBy:         req.user._id,
        }),
        estimatedDistanceKm:  retDistKm,
        estimatedDurationMin: retDurMin,
      });

      const retTracking = await RideTracking.create({
        ride: returnRide._id, booking: booking._id, expectedRoutePolyline: retPolyline,
      });
      await Ride.findByIdAndUpdate(returnRide._id, { $set: { trackingId: retTracking._id } });
    }

    booking.primaryRide = outboundRide._id;
    booking.rides       = [outboundRide._id];
    if (returnRide) { booking.returnRide = returnRide._id; booking.rides.push(returnRide._id); }
    await booking.save();

    const followUpValidDays = hospital.managementModel === 'hospital-manager'
      ? (hospital.consultationPricing?.followUpValidDays ?? 7) : 7;
    const opNumber = await generateOpNumber(hospitalId);

    await OutPatientRecord.create({
      opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
      patient: req.user._id, patientName: patientInfo.name,
      doctor: doctorId, hospital: hospitalId,
      consultationType: 'in_person', scheduledAt: scheduledDate,
      status: 'scheduled', consultationFee, feeSource: pricingSource,
      isCoveredBySubscription, isFollowUp: false,
      followUpExpiry: new Date(Date.now() + followUpValidDays * 24 * 60 * 60 * 1000),
      followUpFee: hospital.managementModel === 'hospital-manager'
        ? (hospital.consultationPricing?.followUpFee ?? 0) : 0,
      createdBy: req.user._id,
    });

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(
        fareBreakdown.totalAmount, booking.bookingCode,
        { customerId: req.user._id.toString() }
      );
    }

    await createNotification({
      recipient: req.user._id, title: 'Booking Confirmed',
      body:      `Your full care ride (${booking.bookingCode}) is confirmed for ${scheduledDate.toLocaleString('en-IN')}.`,
      type: 'BOOKING', bookingId: booking._id,
    });

    // ✉️ Booking created emails (customer + doctor + hospital)
    sendBookingCreatedEmails({
      booking,
      billing: fareBreakdown,
    });

    // Keep existing helper for OP email attachment
    const [doctorUser, hospitalDoc] = await Promise.all([
      doctorId   ? DoctorProfile.findById(doctorId).populate('user', 'name').select('user').lean() : null,
      hospitalId ? Hospital.findById(hospitalId).select('name').lean() : null,
    ]).catch(e => { console.error('[full-care-ride] lookup failed:', e.message); return [null, null]; });

    sendBookingConfirmationEmail({
      user:                   req.user._id,
      booking, consultationFee, isCoveredBySubscription, opNumber,
      doctorName:   doctorUser?.user?.name || null,
      hospitalName: hospitalDoc?.name      || null,
      scheduledAt:  scheduledDate,
    }).catch(e => console.error('[full-care-ride] email failed:', e.message));

    return res.status(201).json({
      success: true,
      message: 'Full care ride booked successfully',
      data: {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        status:      booking.status,
        scheduledAt: booking.scheduledAt,
        fareBreakdown,
        subscriptionCoverage: {
          consultationFree:   isCoveredBySubscription,
          careAssistantFree:  careResult.isCoveredBySubscription,
          consultationQuota:  subCheck.reason,
          careAssistantQuota: careResult.subQuotaInfo?.reason,
        },
        transportSummary: {
          distanceKm: outDistKm, ratePerKm, kmRateSource,
          outboundFare:   transportCalc.outbound.totalFare,
          returnFare:     transportCalc.returnLeg?.totalFare ?? null,
          includeReturn:  includeReturnHome,
          totalTransport: transportCalc.totalTransportFee,
        },
        mapRoutes: {
          outbound: { polyline: outPolyline, distanceKm: outDistKm, durationMin: outDurMin, pickupCoords, dropoffCoords, currentTarget: 'pickup' },
          return:   includeReturnHome ? { polyline: retPolyline, distanceKm: retDistKm, durationMin: retDurMin, pickupCoords: dropoffCoords, dropoffCoords: pickupCoords } : null,
        },
        careAssistantAssigned: { id: careAssistant._id, name: careAssistant.fullName, phone: careAssistant.phone, photoUrl: careAssistant.photoUrl },
        rides:  { outbound: outboundRide._id, return: returnRide?._id ?? null },
        opNumber, razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /full-care-ride]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DOCTOR CONSULTATION
// ═════════════════════════════════════════════════════════════════════════════

router.post('/doctor-consultation', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      hospitalId, doctorId, scheduledAt,
      consultationType = 'inPerson',
      patientInfo, slotId, documents = [],
      paymentMethod = 'Razorpay', couponCode, coinsToRedeem = 0,
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const scheduledDate = new Date(scheduledAt);

    const avail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const modeCheck = await checkConsultationModeAllowed(req.user._id, consultationType);
    if (!modeCheck.allowed)
      return res.status(403).json({ success: false, message: modeCheck.reason });

    const subCheck                = await checkSubscriptionConsultation(req.user._id, consultationType);
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId, consultationType,
    });

    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType: 'doctor_consultation',
      customer:    req.user._id,
      patientInfo, doctor: doctorId, hospital: hospitalId || null,
      consultationType, scheduledAt: scheduledDate, slotId: slotId || null,
      documents, fareBreakdown,
      pricingSource: pricingSource === 'hospital' ? 'hospital' : pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus: 'unpaid', payments: [],
      couponCode: couponCode || undefined, coinsRedeemed: coinsToRedeem,
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
    });

    if (isCoveredBySubscription && subCheck.sub) {
      await queueSubscriptionUsage(booking._id, subCheck.sub._id, 'consultationsUsed');
    }

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' }); // ✉️
    }

    if (fareBreakdown.totalAmount === 0 && paymentMethod === 'Razorpay') {
      booking.paymentStatus = 'paid';
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Free (₹0)' }); // ✉️
    }

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    const opNumber = await generateOpNumber(hospitalId);
    await OutPatientRecord.create({
      opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
      patient: req.user._id, patientName: patientInfo.name,
      doctor: doctorId, hospital: hospitalId || null,
      consultationType: 'in_person', scheduledAt: scheduledDate,
      status: 'scheduled', consultationFee, feeSource: pricingSource,
      isCoveredBySubscription, isFollowUp: false,
      followUpExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: req.user._id,
    });

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    await createNotification({
      recipient: req.user._id, title: 'Appointment Confirmed',
      body: `Your appointment (${booking.bookingCode}) is confirmed.`,
      type: 'BOOKING', bookingId: booking._id,
    });

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    const [doctorUser, hospitalDoc] = await Promise.all([
      doctorId   ? DoctorProfile.findById(doctorId).populate('user', 'name').select('user').lean() : null,
      hospitalId ? Hospital.findById(hospitalId).select('name').lean() : null,
    ]).catch(() => [null, null]);

    sendBookingConfirmationEmail({
      user: req.user._id, booking, consultationFee, isCoveredBySubscription, opNumber,
      doctorName: doctorUser?.user?.name || null, hospitalName: hospitalDoc?.name || null, scheduledAt: scheduledDate,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        opNumber, fareBreakdown,
        subscriptionCoverage: { consultationFree: isCoveredBySubscription, quotaInfo: subCheck.reason },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /doctor-consultation]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DOCTOR ONLINE (video)
// ═════════════════════════════════════════════════════════════════════════════

router.post('/doctor-online', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      doctorId, scheduledAt, patientInfo,
      documents = [], paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const modeCheck = await checkConsultationModeAllowed(req.user._id, 'video');
    if (!modeCheck.allowed)
      return res.status(403).json({ success: false, message: modeCheck.reason });

    const subCheck                = await checkSubscriptionConsultation(req.user._id, 'video');
    const isCoveredBySubscription = subCheck.allowed && subCheck.isFree;

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0,
      isCoveredBySubscription, doctorId, hospitalId: null, consultationType: 'video',
    });

    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType: 'doctor_online',
      customer:    req.user._id,
      patientInfo, doctor: doctorId, consultationType: 'video',
      scheduledAt: scheduledDate,
      documents, fareBreakdown,
      pricingSource: pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus: 'unpaid', payments: [],
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
    });

    if (isCoveredBySubscription && subCheck.sub) {
      await queueSubscriptionUsage(booking._id, subCheck.sub._id, 'consultationsUsed');
    }

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' }); // ✉️
    }

    if (fareBreakdown.totalAmount === 0 && paymentMethod === 'Razorpay') {
      booking.paymentStatus = 'paid';
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Free (₹0)' }); // ✉️
    }

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    const doctorUser = await DoctorProfile.findById(doctorId)
      .populate('user', 'name').select('user').lean().catch(() => null);

    sendBookingConfirmationEmail({
      user: req.user._id, booking, consultationFee, isCoveredBySubscription,
      opNumber: null, doctorName: doctorUser?.user?.name || null, hospitalName: null, scheduledAt: scheduledDate,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode, fareBreakdown,
        subscriptionCoverage: { consultationFree: isCoveredBySubscription, quotaInfo: subCheck.reason },
        razorpayOrder,
        note: 'Meeting link will be sent on booking confirmation.',
      },
    });
  } catch (err) {
    console.error('[POST /doctor-online]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — PATIENT TRANSPORT
// ═════════════════════════════════════════════════════════════════════════════

router.post('/patient-transport', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      patientInfo, patientLocation, destinationLocation, scheduledAt,
      includeReturn    = false,
      waitingMinutes   = 0,
      vehicleClass     = 'four_wheeler',
      addConsultation  = false,
      hospitalId, doctorId,
      consultationType = 'inPerson',
      slotId,
      paymentMethod = 'Razorpay', couponCode, coinsToRedeem = 0,
    } = req.body;

    if (!patientInfo || !patientLocation?.coordinates || !destinationLocation?.coordinates || !scheduledAt)
      return res.status(400).json({ success: false, message: 'patientInfo, patientLocation.coordinates, destinationLocation.coordinates, scheduledAt required' });

    const scheduledDate        = new Date(scheduledAt);
    const pickupCoords         = patientLocation.coordinates;
    const dropoffCoords        = destinationLocation.coordinates;
    const parsedWaitingMinutes = parseInt(waitingMinutes, 10) || 0;

    const { ratePerKm, source: kmRateSource } = await resolveKmRate(req.user._id);

    const config             = await PlatformPricingConfig.getGlobal();
    const freeWaitingMinutes = config?.transport?.waitingFreeMinutes     ?? 5;
    const waitingRatePerMin  = config?.transport?.waitingChargePerMinute ?? 2;

    const transportCalc = resolveTransportFare({
      bookingType: 'patient_transport',
      pickupCoords, dropoffCoords, ratePerKm,
      includeReturn, waitingMinutes: parsedWaitingMinutes,
      freeWaitingMinutes, waitingRatePerMin,
    });

    let consultationFee    = 0, consultationSource = null, opNumber = null;
    let isCoveredBySub     = false, subRef = null;

    if (addConsultation) {
      if (!doctorId)
        return res.status(400).json({ success: false, message: 'doctorId required when addConsultation=true' });

      const consultationAvail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
      if (!consultationAvail.available)
        return res.status(400).json({ success: false, message: consultationAvail.reason });

      const modeCheck = await checkConsultationModeAllowed(req.user._id, consultationType);
      if (!modeCheck.allowed)
        return res.status(403).json({ success: false, message: modeCheck.reason });

      const subCheck  = await checkSubscriptionConsultation(req.user._id, consultationType);
      isCoveredBySub  = subCheck.allowed && subCheck.isFree;
      subRef          = subCheck.sub;

      const feeResult = await resolveConsultationFee({
        isFollowUp: false, followUpFee: 0,
        isCoveredBySubscription: isCoveredBySub, doctorId, hospitalId, consultationType,
      });
      consultationFee    = feeResult.fee;
      consultationSource = feeResult.source;
    }

    const fareBreakdown = buildFareBreakdown({
      consultationFee,
      transportFee: transportCalc.totalTransportFee,
      taxPercent:   config?.tax?.transportGstPercent ?? 5,
    });

    const booking = await Booking.create({
      bookingType:     'patient_transport',
      customer:        req.user._id,
      patientInfo,
      doctor:          addConsultation ? doctorId   : null,
      hospital:        addConsultation ? hospitalId : null,
      consultationType: addConsultation ? consultationType : null,
      scheduledAt:     scheduledDate, slotId: slotId || null,
      patientLocation: { type: 'Point', coordinates: pickupCoords, address: patientLocation.address, city: patientLocation.city, pincode: patientLocation.pincode },
      destinationLocation: { type: 'Point', coordinates: dropoffCoords, address: destinationLocation.address, city: destinationLocation.city },
      fareBreakdown,
      pricingSource: addConsultation ? (consultationSource === 'hospital' ? 'hospital' : 'doctor') : 'platform',
      paymentStatus: 'unpaid', payments: [],
      couponCode: couponCode || undefined, coinsRedeemed: coinsToRedeem,
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
    });

    if (addConsultation && isCoveredBySub && subRef && consultationFee === 0) {
      await queueSubscriptionUsage(booking._id, subRef._id, 'consultationsUsed');
    }

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' }); // ✉️
    }

    if (fareBreakdown.totalAmount === 0 && paymentMethod === 'Razorpay') {
      booking.paymentStatus = 'paid';
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Free (₹0)' }); // ✉️
    }

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    const { distanceKm: outDistKm, durationMin: outDurMin, polyline: outPolyline } =
      await calculateCanonicalRoute(pickupCoords, dropoffCoords);

    const outboundRide = await Ride.create({
      ...buildRidePayload({
        bookingId: booking._id, rideType: 'patient', vehicleClass,
        pickupCoords, pickupAddress: patientLocation.address, pickupCity: patientLocation.city,
        dropoffCoords, dropoffAddress: destinationLocation.address, dropoffCity: destinationLocation.city,
        scheduledPickupAt: scheduledDate, isReturnRide: false, createdBy: req.user._id,
      }),
      estimatedDistanceKm: outDistKm, estimatedDurationMin: outDurMin,
    });

    const outTracking = await RideTracking.create({ ride: outboundRide._id, booking: booking._id, expectedRoutePolyline: outPolyline });
    await Ride.findByIdAndUpdate(outboundRide._id, { $set: { trackingId: outTracking._id } });

    let returnRide = null, retDistKm = null, retDurMin = null, retPolyline = null;

    if (includeReturn) {
      const retRoute = await calculateCanonicalRoute(dropoffCoords, pickupCoords);
      retDistKm   = retRoute.distanceKm;
      retDurMin   = retRoute.durationMin;
      retPolyline = retRoute.polyline;

      returnRide = await Ride.create({
        ...buildRidePayload({
          bookingId: booking._id, rideType: 'patient', vehicleClass,
          pickupCoords: dropoffCoords, pickupAddress: destinationLocation.address, pickupCity: destinationLocation.city,
          dropoffCoords: pickupCoords, dropoffAddress: patientLocation.address, dropoffCity: patientLocation.city,
          scheduledPickupAt: scheduledDate, isReturnRide: true, createdBy: req.user._id,
        }),
        estimatedDistanceKm: retDistKm, estimatedDurationMin: retDurMin,
      });

      const retTracking = await RideTracking.create({ ride: returnRide._id, booking: booking._id, expectedRoutePolyline: retPolyline });
      await Ride.findByIdAndUpdate(returnRide._id, { $set: { trackingId: retTracking._id } });
    }

    booking.primaryRide = outboundRide._id;
    booking.rides       = [outboundRide._id];
    if (returnRide) { booking.returnRide = returnRide._id; booking.rides.push(returnRide._id); }
    await booking.save();

    if (addConsultation) {
      opNumber = await generateOpNumber(hospitalId);
      await OutPatientRecord.create({
        opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
        patient: req.user._id, patientName: patientInfo.name,
        doctor: doctorId, hospital: hospitalId || null,
        consultationType: 'in_person', scheduledAt: scheduledDate,
        status: 'scheduled', consultationFee, feeSource: consultationSource,
        isCoveredBySubscription: consultationFee === 0 && isCoveredBySub,
        isFollowUp: false, followUpExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: req.user._id,
      });
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode, fareBreakdown,
        transportSummary: { distanceKm: outDistKm, ratePerKm, kmRateSource, outboundFare: transportCalc.outbound.totalFare, returnFare: transportCalc.returnLeg?.totalFare ?? null, includeReturn, totalTransport: transportCalc.totalTransportFee },
        mapRoutes: {
          outbound: { polyline: outPolyline, distanceKm: outDistKm, durationMin: outDurMin, pickupCoords, dropoffCoords, currentTarget: 'pickup' },
          return:   includeReturn ? { polyline: retPolyline, distanceKm: retDistKm, durationMin: retDurMin, pickupCoords: dropoffCoords, dropoffCoords: pickupCoords } : null,
        },
        consultationAdded: addConsultation,
        subscriptionCoverage: addConsultation ? { consultationFree: isCoveredBySub && consultationFee === 0 } : null,
        opNumber: opNumber || null,
        rides: { outbound: outboundRide._id, return: returnRide?._id ?? null },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /patient-transport]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — PHYSIOTHERAPIST
// ═════════════════════════════════════════════════════════════════════════════

router.post('/physiotherapist', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      doctorId, scheduledAt, patientInfo,
      visitType = 'inPerson', slotId, documents = [],
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const { fee: consultationFee, source: pricingSource } = await resolveConsultationFee({
      isFollowUp: false, followUpFee: 0, isCoveredBySubscription: false,
      doctorId, hospitalId: null,
      consultationType: visitType === 'homeVisit' ? 'homeVisit' : 'inPerson',
    });

    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType: 'physiotherapist', customer: req.user._id,
      patientInfo, doctor: doctorId, consultationType: visitType,
      scheduledAt: scheduledDate, slotId: slotId || null, documents, fareBreakdown,
      pricingSource: pricingSource === 'doctor' ? 'doctor' : 'platform',
      paymentStatus: 'unpaid', payments: [],
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
    });

  if (paymentMethod === 'Wallet' && fareBreakdown.totalAmount > 0) {
  const wp = await processWalletPayment({
    userId: req.user._id, amount: fareBreakdown.totalAmount,
    bookingId: booking._id, bookingCode: booking.bookingCode,
  });
  booking.paymentStatus = 'paid';
  booking.payments = [wp];
  await booking.save();
  await flushAndRecord(booking);
  sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' });
}

if (fareBreakdown.totalAmount === 0 && paymentMethod === 'Razorpay') {
  booking.paymentStatus = 'paid';
  await booking.save();
  await flushAndRecord(booking);
  sendPaymentConfirmedEmails({ booking, paymentMethod: 'Free (₹0)' });
}
    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    await createNotification({
      recipient: req.user._id, title: 'Physiotherapy Appointment Confirmed',
      body: `Your physiotherapy appointment (${booking.bookingCode}) is confirmed.`,
      type: 'BOOKING', bookingId: booking._id,
    });

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    return res.status(201).json({
      success: true,
      data: { bookingId: booking._id, bookingCode: booking.bookingCode, visitType, fareBreakdown, razorpayOrder },
    });
  } catch (err) {
    console.error('[POST /physiotherapist]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — FOLLOW-UP
// ═════════════════════════════════════════════════════════════════════════════

router.post('/follow-up', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      doctorId, hospitalId, scheduledAt, patientInfo,
      consultationType = 'inPerson', slotId,
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!doctorId || !scheduledAt || !patientInfo)
      return res.status(400).json({ success: false, message: 'doctorId, scheduledAt, patientInfo required' });

    const followUpCheck = await checkFollowUpEligibility({ customerId: req.user._id, doctorId, hospitalId });
    if (!followUpCheck.isEligible)
      return res.status(400).json({ success: false, message: followUpCheck.reason });

    const scheduledDate = new Date(scheduledAt);
    const avail = await checkHospitalOrDoctorAvailability({ hospitalId, doctorId, scheduledAt: scheduledDate });
    if (!avail.available) return res.status(400).json({ success: false, message: avail.reason });

    const { fee: consultationFee } = await resolveConsultationFee({
      isFollowUp: true, followUpFee: followUpCheck.followUpFee,
      isCoveredBySubscription: false, doctorId, hospitalId, consultationType,
    });

    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      consultationFee, taxPercent: config?.tax?.consultationGstPercent ?? 0,
    });

    const booking = await Booking.create({
      bookingType: 'follow_up', customer: req.user._id,
      patientInfo, doctor: doctorId, hospital: hospitalId || null,
      consultationType, scheduledAt: scheduledDate, slotId: slotId || null,
      followUpParentBooking: followUpCheck.parentOp, followUpDiscountPercent: 0,
      fareBreakdown, pricingSource: 'doctor',
      paymentStatus: 'unpaid', payments: [],
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
    });

   if (paymentMethod === 'Wallet' && fareBreakdown.totalAmount > 0) {
  const wp = await processWalletPayment({
    userId: req.user._id, amount: fareBreakdown.totalAmount,
    bookingId: booking._id, bookingCode: booking.bookingCode,
  });
  booking.paymentStatus = 'paid';
  booking.payments = [wp];
  await booking.save();
  await flushAndRecord(booking);
  sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' });
}

if (fareBreakdown.totalAmount === 0 && paymentMethod === 'Razorpay') {
  booking.paymentStatus = 'paid';
  await booking.save();
  await flushAndRecord(booking);
  sendPaymentConfirmedEmails({ booking, paymentMethod: 'Free (₹0)' });
}

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    const opNumber = await generateOpNumber(hospitalId);
    await OutPatientRecord.create({
      opNumber, booking: booking._id, bookingNumber: booking.bookingCode,
      patient: req.user._id, patientName: patientInfo.name,
      doctor: doctorId, hospital: hospitalId || null,
      consultationType: 'follow_up', scheduledAt: scheduledDate,
      status: 'scheduled', consultationFee, feeSource: 'follow_up',
      isCoveredBySubscription: false, isFollowUp: true,
      parentOp: followUpCheck.parentOp, followUpExpiry: null, followUpFee: 0,
      createdBy: req.user._id,
    });

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode, opNumber, fareBreakdown,
        followUpDetails: {
          parentOpNumber: followUpCheck.parentOpNumber, expiryWas: followUpCheck.followUpExpiry,
          daysWereLeft: followUpCheck.daysRemaining, followUpFee: consultationFee,
          note: 'Follow-up fee charged by hospital/doctor policy. Subscription quota not consumed.',
        },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /follow-up]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DIAGNOSTIC CENTER
// ═════════════════════════════════════════════════════════════════════════════

router.post('/diagnostic-center', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      labId, tests = [], packages = [], scheduledAt,
      patientInfo, reportDeliveryMode = 'Digital (App)',
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!labId || !scheduledAt || !patientInfo || (!tests.length && !packages.length))
      return res.status(400).json({ success: false, message: 'labId, scheduledAt, patientInfo, and tests or packages required' });

    const lab = await getLabWithTests(labId);

    let diagnosticFee = 0;
    const testNames = [], packageNames = [];

    for (const testId of tests) {
      const t = lab.labTests.find(lt => lt._id.toString() === testId.toString());
      if (t) { diagnosticFee += t.discountedPrice ?? t.mrpPrice; testNames.push(t.testName); }
    }
    for (const pkgId of packages) {
      const p = lab.labPackages.find(lp => lp._id.toString() === pkgId.toString());
      if (p) { diagnosticFee += p.mrpPrice; packageNames.push(p.packageName); }
    }

    const diagSub         = await checkSubscriptionDiagnostics(req.user._id);
    const discountPercent = diagSub.discountPercent;
    const discount        = discountPercent ? +(diagnosticFee * discountPercent / 100).toFixed(2) : 0;

    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      diagnosticFee, discount, taxPercent: config?.tax?.diagnosticsGstPercent ?? 5,
    });

    const booking = await Booking.create({
      bookingType: 'diagnostic_center', customer: req.user._id,
      patientInfo, scheduledAt: new Date(scheduledAt),
      diagnosticDetails: { labPartner: labId, tests, testNames, packages, packageNames, reportDeliveryMode },
      fareBreakdown, pricingSource: 'platform',
      paymentStatus: 'unpaid', payments: [],
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' }); // ✉️
    }

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode,
        fareBreakdown, testNames, packageNames,
        diagnosticDiscount: { percent: discountPercent, amount: discount },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /diagnostic-center]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — DIAGNOSTIC HOME
// ═════════════════════════════════════════════════════════════════════════════

router.post('/diagnostic-home', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      labId, tests = [], packages = [], scheduledAt,
      patientInfo, patientLocation, reportDeliveryMode = 'Digital (App)',
      paymentMethod = 'Razorpay',
    } = req.body;

    if (!labId || !scheduledAt || !patientInfo || !patientLocation?.coordinates)
      return res.status(400).json({ success: false, message: 'labId, scheduledAt, patientInfo, patientLocation.coordinates required' });

    const lab = await getLabWithTests(labId);
    if (!['Home Collection', 'Both'].includes(lab.sampleCollectionMode))
      return res.status(400).json({ success: false, message: 'This lab does not offer home collection' });

    let diagnosticFee = 0;
    const testNames = [], packageNames = [];

    for (const testId of tests) {
      const t = lab.labTests.find(lt => lt._id.toString() === testId.toString());
      if (t && t.homeCollectionAvailable) { diagnosticFee += t.discountedPrice ?? t.mrpPrice; testNames.push(t.testName); }
    }
    for (const pkgId of packages) {
      const p = lab.labPackages.find(lp => lp._id.toString() === pkgId.toString());
      if (p) { diagnosticFee += p.mrpPrice; packageNames.push(p.packageName); }
    }

    const homeCollectionFee = lab.homeCollectionFee ?? 0;

    const diagSub                       = await checkSubscriptionDiagnostics(req.user._id);
    const discountPercent               = diagSub.discountPercent;
    const discount                      = discountPercent ? +(diagnosticFee * discountPercent / 100).toFixed(2) : 0;
    const hasHomeSampleCollectionInPlan = diagSub.homeSampleCollection;
    const effectiveHomeCollectionFee    = hasHomeSampleCollectionInPlan ? 0 : homeCollectionFee;

    const config        = await PlatformPricingConfig.getGlobal();
    const fareBreakdown = buildFareBreakdown({
      diagnosticFee, homeCollectionFee: effectiveHomeCollectionFee,
      discount, taxPercent: config?.tax?.diagnosticsGstPercent ?? 5,
    });

    const scheduledDate = new Date(scheduledAt);

    const booking = await Booking.create({
      bookingType: 'diagnostic_home', customer: req.user._id,
      patientInfo, scheduledAt: scheduledDate,
      patientLocation: { type: 'Point', coordinates: patientLocation.coordinates, address: patientLocation.address, city: patientLocation.city, pincode: patientLocation.pincode },
      diagnosticDetails: { labPartner: labId, tests, testNames, packages, packageNames, reportDeliveryMode },
      fareBreakdown, pricingSource: 'platform',
      paymentStatus: 'unpaid', payments: [],
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
    });

    if (paymentMethod === 'Wallet') {
      const wp = await processWalletPayment({
        userId: req.user._id, amount: fareBreakdown.totalAmount,
        bookingId: booking._id, bookingCode: booking.bookingCode,
      });
      booking.paymentStatus = 'paid'; booking.payments = [wp];
      await booking.save();
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' }); // ✉️
    }

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    const labCoords = lab.registeredAddress?.location?.coordinates || [80.648, 16.506];
    const { distanceKm: techDistKm, durationMin: techDurMin, polyline: techPolyline } =
      await calculateCanonicalRoute(labCoords, patientLocation.coordinates);

    const techRide = await Ride.create({
      ...buildRidePayload({
        bookingId: booking._id, rideType: 'diagnostic_tech', vehicleClass: 'two_wheeler',
        pickupCoords: labCoords, pickupAddress: lab.registeredAddress?.line1, pickupCity: lab.registeredAddress?.city,
        dropoffCoords: patientLocation.coordinates, dropoffAddress: patientLocation.address, dropoffCity: patientLocation.city,
        scheduledPickupAt: scheduledDate, createdBy: req.user._id,
      }),
      estimatedDistanceKm: techDistKm, estimatedDurationMin: techDurMin,
    });

    const techTracking = await RideTracking.create({ ride: techRide._id, booking: booking._id, expectedRoutePolyline: techPolyline });
    await Ride.findByIdAndUpdate(techRide._id, { $set: { trackingId: techTracking._id } });

    booking.primaryRide = techRide._id;
    booking.rides       = [techRide._id];
    await booking.save();

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode, fareBreakdown, testNames, packageNames,
        homeCollectionFeeWaived: hasHomeSampleCollectionInPlan,
        diagnosticDiscount: { percent: discountPercent, amount: discount },
        mapRoute: { polyline: techPolyline, distanceKm: techDistKm, durationMin: techDurMin, pickupCoords: labCoords, dropoffCoords: patientLocation.coordinates, currentTarget: 'pickup' },
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /diagnostic-home]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — CARE ASSISTANT ONLY
// ═════════════════════════════════════════════════════════════════════════════

router.post('/care-assistant', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      patientInfo, patientLocation, scheduledAt,
      durationHours = 4, paymentMethod = 'Razorpay',
    } = req.body;

    if (!patientInfo || !patientLocation?.coordinates || !scheduledAt)
      return res.status(400).json({ success: false, message: 'patientInfo, patientLocation.coordinates, scheduledAt required' });

    const careAssistant = await autoAssignCareAssistant({
      patientCoords: patientLocation.coordinates,
      city:          patientLocation.city || 'Vijayawada',
    });
    if (!careAssistant)
      return res.status(503).json({ success: false, message: 'No care assistant available. Please try again shortly.' });

    const config = await PlatformPricingConfig.getGlobal();

    const careResult = await resolveCareAssistantFee({
      userId:        req.user._id,
      durationHours: parseInt(durationHours, 10) || 4,
      config,
    });

    const fareBreakdown = buildFareBreakdown({
      careAssistantFee: careResult.fee,
      taxPercent:       config?.tax?.careAssistantGstPercent ?? 18,
    });

    const booking = await Booking.create({
      bookingType:   'care_assistant',
      customer:      req.user._id,
      patientInfo,
      careAssistant: careAssistant._id,
      scheduledAt:   new Date(scheduledAt),
      patientLocation: { type: 'Point', coordinates: patientLocation.coordinates, address: patientLocation.address, city: patientLocation.city },
      fareBreakdown,
      pricingSource: careResult.source === 'subscription' ? 'subscription' : 'platform',
      paymentStatus: 'unpaid', payments: [],
      status: 'pending', createdBy: req.user._id,
      subscriptionUsagePending: [], confirmedSubscriptionUsage: [],
      careAssistantSnapshot: { name: careAssistant.fullName, photoUrl: careAssistant.photoUrl, phone: careAssistant.phone },
    });

    if ((careResult.isCoveredBySubscription || careResult.quotaTracked) && careResult.sub) {
      await queueSubscriptionUsage(booking._id, careResult.sub._id, 'careAssistantVisitsUsed');
    }

    if (paymentMethod === 'Wallet') {
  if (fareBreakdown.totalAmount > 0) {
    const wp = await processWalletPayment({
      userId: req.user._id, amount: fareBreakdown.totalAmount,
      bookingId: booking._id, bookingCode: booking.bookingCode,
    });
    booking.paymentStatus = 'paid'; booking.payments = [wp];
  } else {
    booking.paymentStatus = 'paid';
  }
  await booking.save();
  await flushAndRecord(booking);
  sendPaymentConfirmedEmails({ booking, paymentMethod: 'Wallet' });
}

    if (fareBreakdown.totalAmount === 0 && paymentMethod === 'Razorpay') {
      booking.paymentStatus = 'paid';
      await booking.save();
      await flushAndRecord(booking);
      sendPaymentConfirmedEmails({ booking, paymentMethod: 'Free (₹0)' }); // ✉️
    }

    if (paymentMethod === 'Cash') {
      booking.paymentStatus = 'pending_cash';
      await booking.save();
    }

    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay' && fareBreakdown.totalAmount > 0) {
      razorpayOrder = await createRazorpayOrder(fareBreakdown.totalAmount, booking.bookingCode);
    }

    // ✉️ Booking created emails
    sendBookingCreatedEmails({ booking, billing: fareBreakdown });

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking._id, bookingCode: booking.bookingCode, fareBreakdown,
        subscriptionCoverage: {
          careAssistantFree:  careResult.isCoveredBySubscription,
          quotaInfo:          careResult.subQuotaInfo?.reason,
          visitsRemaining:    careResult.subQuotaInfo?.remaining,
        },
        careAssistantAssigned: { id: careAssistant._id, name: careAssistant.fullName, phone: careAssistant.phone, photoUrl: careAssistant.photoUrl },
        durationHours: parseInt(durationHours, 10) || 4,
        pricingSource: careResult.source,
        pricingTier:   careResult.tier?.label ?? 'Standard',
        razorpayOrder,
      },
    });
  } catch (err) {
    console.error('[POST /care-assistant]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /verify-payment  — Razorpay webhook
// ─────────────────────────────────────────────────────────────────────────────

router.post('/verify-payment', protect, async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ success: false, message: 'bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature required' });

    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid)
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });

    const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.paymentStatus === 'paid') {
      console.log(`[verify-payment] ⚠️ already paid — skip duplicate for booking:${bookingId}`);
      return res.json({ success: true, message: 'Already verified', data: { bookingId, paymentStatus: 'paid' } });
    }

    booking.paymentStatus = 'paid';
    booking.payments.push({
      gateway:       'Razorpay',
      transactionId: razorpay_payment_id,
      orderId:       razorpay_order_id,
      paymentMode:   'Other',
      amount:        booking.fareBreakdown.totalAmount,
      status:        'success',
      paidAt:        new Date(),
    });
    booking.fareBreakdown.amountPaid = booking.fareBreakdown.totalAmount;
    booking.updatedBy = req.user._id;
    await booking.save();

    await flushAndRecord(booking);
    console.log(`[verify-payment] ✅ payment verified + usage flushed for booking:${bookingId}`);

    // ✉️ Payment confirmed via Razorpay
    sendPaymentConfirmedEmails({ booking, paymentMethod: 'Razorpay' });

    // ✉️ Status update to Confirmed
    sendStatusUpdateEmails({ booking, newStatus: 'Confirmed' });

    return res.json({
      success: true,
      message: 'Payment verified',
      data: { bookingId, paymentStatus: 'paid' },
    });
  } catch (err) {
    console.error('[POST /verify-payment]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /confirm-cash-payment  — admin confirms cash collected
// ─────────────────────────────────────────────────────────────────────────────

router.post('/confirm-cash-payment', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { bookingId, amountCollected } = req.body;
    if (!bookingId)
      return res.status(400).json({ success: false, message: 'bookingId required' });

    const booking = await Booking.findOne({ _id: bookingId, paymentStatus: 'pending_cash' });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found or not in pending_cash status' });

    if (booking.paymentStatus === 'paid') {
      console.log(`[confirm-cash-payment] ⚠️ already confirmed for booking:${bookingId}`);
      return res.json({ success: true, message: 'Already confirmed', data: { bookingId } });
    }

    booking.paymentStatus = 'paid';
    booking.payments.push({
      gateway:       'Cash',
      transactionId: `CASH-${Date.now()}`,
      paymentMode:   'Cash',
      amount:        amountCollected ?? booking.fareBreakdown.totalAmount,
      status:        'success',
      paidAt:        new Date(),
    });
    booking.fareBreakdown.amountPaid = amountCollected ?? booking.fareBreakdown.totalAmount;
    booking.updatedBy = req.user._id;
    await booking.save();

    await flushAndRecord(booking);
    console.log(`[confirm-cash-payment] ✅ cash confirmed + usage flushed for booking:${bookingId}`);

    // ✉️ Cash payment confirmed → customer notified
    sendPaymentConfirmedEmails({ booking, paymentMethod: 'Cash' });

    // ✉️ Status update to Confirmed
    sendStatusUpdateEmails({ booking, newStatus: 'Confirmed' });

    return res.json({
      success: true,
      message: 'Cash payment confirmed. Subscription usage flushed.',
      data: { bookingId },
    });
  } catch (err) {
    console.error('[POST /confirm-cash-payment]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

router.get('/my-bookings', protect, authorize('customer'), async (req, res) => {
  try {
    const { status, bookingType, page = '1', limit = '10' } = req.query;
    const filter = { customer: req.user._id };
    if (status)      filter.status      = status;
    if (bookingType) filter.bookingType = bookingType;

    const skip  = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Booking.countDocuments(filter);

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('doctor',        'user specialization profilePhotoUrl')
      .populate('hospital',      'name address')
      .populate('careAssistant', 'fullName photoUrl phone')
      .populate('primaryRide',   'status rideCode scheduledPickupAt driverSnapshot vehicleSnapshot')
      .select('-internalNotes -__v -subscriptionUsagePending -confirmedSubscriptionUsage')
      .lean();

    res.json({ success: true, total, page: parseInt(page, 10), limit: parseInt(limit, 10), data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/my-bookings/:bookingId', protect, authorize('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id })
      .populate('doctor',        'user specialization profilePhotoUrl registrationNumber')
      .populate('hospital',      'name address contact location')
      .populate('careAssistant', 'fullName photoUrl phone specializations')
      .populate('rides',         'status rideCode driverSnapshot scheduledPickupAt liveLocation estimatedDistanceKm estimatedDurationMin trackingId pickup dropoff')
      .populate('diagnosticDetails.labPartner', 'labName registeredAddress')
      .select('-internalNotes -__v -subscriptionUsagePending -confirmedSubscriptionUsage')
      .lean();

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    let mapRoute = null;
    if (booking.primaryRide?.trackingId) {
      const trackingDoc = await RideTracking.findById(booking.primaryRide.trackingId)
        .select('expectedRoutePolyline currentEtaMinutes totalDistanceKm')
        .lean();
      if (trackingDoc) {
        mapRoute = {
          polyline:          trackingDoc.expectedRoutePolyline,
          currentEtaMinutes: trackingDoc.currentEtaMinutes,
          totalDistanceKm:   trackingDoc.totalDistanceKm,
          pickupCoords:      booking.primaryRide.pickup?.coordinates,
          dropoffCoords:     booking.primaryRide.dropoff?.coordinates,
        };
      }
    }

    res.json({ success: true, data: { ...booking, mapRoute } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /my-bookings/:bookingId/cancel
// ─────────────────────────────────────────────────────────────────────────────

router.post('/my-bookings/:bookingId/cancel', protect, authorize('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!['pending', 'confirmed', 'pending_cash'].includes(booking.status))
      return res.status(400).json({ success: false, message: `Cannot cancel booking in status: ${booking.status}` });

    let refundPercent = 0, refundAmount = 0;
    if (['paid', 'partially_paid'].includes(booking.paymentStatus)) {
      ({ refundPercent, refundAmount } = await computeRefundAmount(booking));
    }

    const recoveryResult = await recoverSubscriptionUsageOnCancel(booking);

    booking.status       = 'cancelled';
    booking.cancellation = {
      cancelledBy:       'customer',
      cancelledByUserId: req.user._id,
      reason:            req.body.reason || 'Customer cancelled',
      refundEligible:    refundAmount > 0,
      refundPercent,
      cancelledAt:       new Date(),
    };
    booking.fareBreakdown.refundAmount = refundAmount;
    booking.updatedBy = req.user._id;
    await booking.save();

    if (booking.rides?.length) {
      await Ride.updateMany(
        { _id: { $in: booking.rides }, status: { $in: ['requested', 'searching', 'driver_assigned'] } },
        {
          $set: {
            status: 'cancelled',
            cancellation: { cancelledBy: 'customer', cancelledByUserId: req.user._id, cancelledAt: new Date() },
          },
        }
      );
    }

    await createNotification({
      recipient: req.user._id,
      title:     'Booking Cancelled',
      body:      `Booking ${booking.bookingCode} cancelled. Refund: ₹${refundAmount} (${refundPercent}%)`,
      type:      'BOOKING',
      bookingId: booking._id,
    });

    // ✉️ Cancellation + refund emails to customer, doctor, hospital
    sendCancellationEmails({ booking, refundAmount, refundPercent });

    console.log(`[cancel] ✅ booking:${booking._id} cancelled. recovery:`, recoveryResult);

    return res.json({
      success: true,
      message: 'Booking cancelled',
      data: {
        refundPercent,
        refundAmount,
        status: 'cancelled',
        subscriptionRecovery: recoveryResult,
      },
    });
  } catch (err) {
    console.error('[POST /my-bookings/:bookingId/cancel]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/my-bookings/:bookingId/rate', protect, authorize('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id });
    if (!booking)                       return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'completed') return res.status(400).json({ success: false, message: 'Can only rate completed bookings' });
    if (booking.isRated)                return res.status(400).json({ success: false, message: 'Already rated' });

    const {
      overallRating, overallComment,
      doctorRating, doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating, driverComment, labRating, labComment,
    } = req.body;

    if (!overallRating || overallRating < 1 || overallRating > 5)
      return res.status(400).json({ success: false, message: 'overallRating (1-5) required' });

    booking.rating = {
      overallRating, overallComment, doctorRating, doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating, driverComment, labRating, labComment,
      ratedAt: new Date(), isPublic: true,
    };
    booking.isRated   = true;
    booking.updatedBy = req.user._id;
    await booking.save();

    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /my-bookings/:bookingId/op-download
router.get('/my-bookings/:bookingId/op-download', protect, authorize('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user._id })
      .select('bookingCode customer').lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const op = await OutPatientRecord.findOne({ booking: req.params.bookingId }).lean();
    if (!op) return res.status(404).json({ success: false, message: 'No OP record for booking' });

    const { generateOpHtml, buildOpZipBuffer } = await import('../utils/opDocumentGenerator.js');
    const { default: UserModel }               = await import('../models/User.js');

    const [patient, doctor, hospital, followUps] = await Promise.all([
      UserModel.findById(op.patient).select('name email phone').lean(),
      op.doctor   ? DoctorProfile.findById(op.doctor).populate('user', 'name').lean() : null,
      op.hospital ? Hospital.findById(op.hospital).lean() : null,
      OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean(),
    ]);

    const html  = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zip   = await buildOpZipBuffer(html, op.opNumber);
    const fname = `${op.opNumber.replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(zip);
  } catch (err) {
    console.error('[GET /my-bookings/:bookingId/op-download]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /platform-pricing
router.get('/platform-pricing', async (req, res) => {
  try {
    const config = await PlatformPricingConfig.findOne({ configName: 'global', isActive: true })
      .select('careAssistant.pricingTiers');
    if (!config) return res.status(404).json({ success: false, message: 'Platform pricing configuration not found.' });
    res.json({ success: true, data: config.careAssistant.pricingTiers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /subscription-benefits/consultations
// ═════════════════════════════════════════════════════════════════════════════

router.get('/subscription-benefits/consultations', protect, authorize('customer'), async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      user:       req.user._id,
      status:     { $in: ['Active', 'Trial'] },
      expiryDate: { $gt: new Date() },
    }).populate('plan', 'name planType consultations customOptions fixedTier').lean();

    if (!sub)
      return res.status(404).json({ success: false, message: 'No active subscription found.' });

    let perMonth = sub.limits?.consultationsPerMonth ?? 0;

    if (perMonth === 0 && sub.plan) {
      if (sub.plan.planType === 'custom' && Array.isArray(sub.plan.customOptions)) {
        const consultOpt = sub.plan.customOptions.find(o => o.optionKey === 'consultations');
        if (consultOpt?.quantity > 0) perMonth = consultOpt.quantity;
      } else {
        perMonth = sub.plan.consultations?.freePerMonth ?? 0;
      }
    }

    const now   = new Date();
    const usage = sub.usageHistory?.find(
      u => u.month === now.getMonth() + 1 && u.year === now.getFullYear()
    );
    const used      = usage?.consultationsUsed ?? 0;
    const unlimited = perMonth === -1;
    const remaining = unlimited ? null : Math.max(0, perMonth - used);
    const percentUsed = unlimited
      ? null
      : perMonth === 0 ? 100 : Math.min(100, Math.round((used / perMonth) * 100));

    const modes = sub.plan?.consultations?.modes ?? { inPerson: true, video: false, home: false };
    const specialNote = sub.plan?.consultations?.specialNote ?? null;

    return res.json({
      success: true,
      data: {
        planName:    sub.planName,
        planType:    sub.planType,
        fixedTier:   sub.fixedTier ?? null,
        status:      sub.status,
        expiryDate:  sub.expiryDate,
        consultations: {
          perMonth, unlimited, used, remaining, percentUsed, modes, specialNote,
        },
      },
    });
  } catch (err) {
    console.error('[GET /subscription-benefits/consultations]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /subscription-benefits/care-assistant
// ═════════════════════════════════════════════════════════════════════════════

router.get('/subscription-benefits/care-assistant', protect, authorize('customer'), async (req, res) => {
  try {
    const sub = await UserSubscription.findOne({
      user:       req.user._id,
      status:     { $in: ['Active', 'Trial'] },
      expiryDate: { $gt: new Date() },
    }).populate('plan', 'name planType careAssistant customOptions fixedTier').lean();

    if (!sub)
      return res.status(404).json({ success: false, message: 'No active subscription found.' });

    let visitsPerMonth = sub.limits?.careAssistantVisitsPerMonth ?? null;

    if (visitsPerMonth == null && sub.plan) {
      if (sub.plan.planType === 'custom' && Array.isArray(sub.plan.customOptions)) {
        const caOpt = sub.plan.customOptions.find(o => o.optionKey === 'careAssistant');
        if (caOpt?.quantity > 0) visitsPerMonth = caOpt.quantity;
      } else if (sub.plan.careAssistant?.visitsPerMonth != null) {
        visitsPerMonth = sub.plan.careAssistant.visitsPerMonth;
      } else if (sub.plan.careAssistant?.included === true) {
        visitsPerMonth = 1;
      }
    }

    if (visitsPerMonth == null)
      return res.json({
        success: true,
        data: {
          planName:      sub.planName,
          planType:      sub.planType,
          included:      false,
          message:       'Care assistant not included in your plan.',
          careAssistant: null,
        },
      });

    const now   = new Date();
    const usage = sub.usageHistory?.find(
      u => u.month === now.getMonth() + 1 && u.year === now.getFullYear()
    );
    const used      = usage?.careAssistantVisitsUsed ?? 0;
    const unlimited = visitsPerMonth === -1;
    const remaining = unlimited ? null : Math.max(0, visitsPerMonth - used);
    const percentUsed = unlimited
      ? null
      : visitsPerMonth === 0 ? 100 : Math.min(100, Math.round((used / visitsPerMonth) * 100));

    let activeTier  = null;
    let allTiers    = [];
    const config    = await PlatformPricingConfig.getGlobal();

    if (sub.planType === 'custom') {
      activeTier = sub.limits?.careAssistantTierIndex != null
        ? {
            tierIndex:         sub.limits.careAssistantTierIndex,
            label:             sub.limits.careAssistantTierLabel       ?? 'Custom Tier',
            chargeToUser:      sub.limits.careAssistantChargePerVisit  ?? null,
            payoutToAssistant: null,
            source:            'snapshotted',
          }
        : null;

      const customTiers = config?.customPlanOptions?.careAssistant?.pricingTiers ?? [];
      allTiers = customTiers.map((t, idx) => ({
        tierIndex:    idx,
        label:        t.label,
        minHours:     t.minHours,
        maxHours:     t.maxHours ?? null,
        chargeToUser: t.chargeToUser,
        isActive:     t.isActive ?? true,
        isSelected:   idx === (sub.limits?.careAssistantTierIndex ?? 0),
      }));

    } else {
      const platformTiers = config?.careAssistant?.pricingTiers ?? [];
      allTiers = platformTiers
        .filter(t => t.isActive)
        .map((t, idx) => ({
          tierIndex:    idx,
          label:        t.label,
          minHours:     t.minHours,
          maxHours:     t.maxHours ?? null,
          chargeToUser: t.chargeToUser,
          isActive:     true,
        }));

      const serviceType = sub.plan?.careAssistant?.serviceType ?? 'Standard';
      activeTier = {
        label:        serviceType === 'Dedicated' ? 'Dedicated Assistant' : 'Standard (Platform Rates Apply)',
        serviceType,
        chargeToUser: serviceType === 'Dedicated'
          ? config?.careAssistant?.dedicatedMonthlyCharge ?? null
          : null,
        source:       'fixed_plan',
        note:         serviceType === 'Dedicated'
          ? 'Dedicated assistant — flat monthly charge applies'
          : 'Per-visit charge from duration-based platform tiers above',
      };
    }

    const platformConfig = {
      punctualityBonusPerVisit: config?.careAssistant?.punctualityBonusPerVisit ?? null,
      overtimeRatePerHour:      config?.careAssistant?.overtimeRatePerHour      ?? null,
      noShowPenalty:            config?.careAssistant?.noShowPenalty             ?? null,
    };

    return res.json({
      success: true,
      data: {
        planName:   sub.planName,
        planType:   sub.planType,
        fixedTier:  sub.fixedTier ?? null,
        status:     sub.status,
        expiryDate: sub.expiryDate,
        included:   true,
        careAssistant: {
          visitsPerMonth, unlimited, used, remaining, percentUsed,
          isDedicated:  sub.plan?.careAssistant?.isDedicated ?? false,
          activeTier, allTiers, platformConfig,
        },
      },
    });
  } catch (err) {
    console.error('[GET /subscription-benefits/care-assistant]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;