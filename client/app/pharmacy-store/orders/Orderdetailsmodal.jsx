'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OrderDetailsModal.jsx  —  Pharmacy Admin
 * ───────────────────────────────────────────────────────────────────────────
 *
 * COMPLETE INTERNAL-DELIVERY LIFECYCLE + RETURN FLOW
 *
 * FIXES APPLIED:
 *  ✅ returnEvidence images displayed in ReturnAcceptSection
 *  ✅ cancellation block fully surfaced (returnReason, selectedRefundMethod,
 *     returnDecision, bankDetails, pickupConditionNotes, refundStatus…)
 *  ✅ Admin Notes: preset-option chips + custom free-text fallback
 *  ✅ statusHistory rendered as a timeline
 *  ✅ deliveryOtp block (expiresAt, verified, sentAt) shown in status section
 *  ✅ internalPartner / pickupPartner populated-object safety
 *  ✅ All billing & payment fields from model surfaced
 *  ✅ orderId always the human-readable string — never MongoDB _id
 *  ✅ clearSuccess / clearError always receive a plain STRING key
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useState, memo, useEffect } from 'react';
import { useDispatch, useSelector }                from 'react-redux';
import { motion, AnimatePresence }                 from 'framer-motion';
import {
  X, Loader, CheckCircle, AlertCircle, User, MapPin, Pill,
  DollarSign, FileText, CheckCircle2, XCircle, Clock, CreditCard,
  Package, Truck, StickyNote, UserCheck, RotateCcw, ShieldCheck,
  ChevronDown, ChevronUp, ExternalLink, Hash, Download, KeyRound,
  History, Image as ImageIcon, AlertTriangle, Info, RefreshCcw,
  Banknote, Phone, Mail, Calendar, Tag, Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  verifyPrescription,
  updateOrderStatus,
  processRefund,
  addOrderNote,
  assignDeliveryPartner,
  acceptReturn,
  verifyPickup,
  confirmOrder,
  clearSuccess,
  clearError,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const formatDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const formatDateShort = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const fmt = (n) => `₹${(n ?? 0).toFixed(2)}`;

/** Safely extract a display name from a populated or raw ObjectId field */
const resolvePartnerName = (field) => {
  if (!field) return 'N/A';
  if (typeof field === 'object' && field !== null) {
    return field.name ?? field.email ?? field._id ?? String(field);
  }
  return String(field);
};

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — CLIENT-SIDE INVOICE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

const generateInvoice = (order) => {
  if (!order) return;

  const addr    = order.delivery?.address ?? {};
  const billing = order.billing           ?? {};
  const payment = order.payment           ?? {};
  const items   = order.items             ?? [];

  const itemRows = items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${i + 1}</td>
      <td>
        <strong>${item.name ?? 'N/A'}</strong>
        ${item.brandName   ? `<br/><small>${item.brandName}</small>` : ''}
        ${item.genericName ? `<br/><em style="color:#6b7280;font-size:11px">${item.genericName}</em>` : ''}
      </td>
      <td class="c">${item.quantity ?? 1}</td>
      <td class="r">₹${(item.pricePerUnit ?? 0).toFixed(2)}</td>
      <td class="c">${item.gstPercentage ?? 0}%</td>
      <td class="r">₹${(item.taxAmount ?? 0).toFixed(2)}</td>
      <td class="r"><strong>₹${(item.totalPrice ?? 0).toFixed(2)}</strong></td>
    </tr>`).join('');

  const summaryRows = [
    { label: 'Subtotal',         val: billing.subTotal },
    { label: 'GST / Tax',        val: billing.gstAmount,       skip: (billing.gstAmount       ?? 0) === 0 },
    { label: 'Delivery Charges', val: billing.deliveryCharges, skip: (billing.deliveryCharges ?? 0) === 0 },
    { label: 'Platform Fee',     val: billing.platformFee,     skip: (billing.platformFee     ?? 0) === 0 },
  ].filter((r) => !r.skip).map((r) =>
    `<tr><td>${r.label}</td><td class="r">₹${(r.val ?? 0).toFixed(2)}</td></tr>`).join('');

  const discountRow = (billing.discountAmount ?? 0) > 0
    ? `<tr class="disc"><td>Discount${billing.promoCode ? ` (${billing.promoCode})` : ''}</td><td class="r">−₹${billing.discountAmount.toFixed(2)}</td></tr>` : '';
  const walletRow = (billing.walletAmountUsed ?? 0) > 0
    ? `<tr class="disc"><td>Wallet Applied</td><td class="r">−₹${billing.walletAmountUsed.toFixed(2)}</td></tr>` : '';

  const statusColor  = { Delivered: '#16a34a', Placed: '#2563eb', Confirmed: '#7c3aed', Processing: '#d97706', 'Out-for-Delivery': '#0891b2', Cancelled: '#dc2626' }[order.delivery?.status] ?? '#6b7280';
  const paymentColor = { Paid: '#16a34a', Pending: '#d97706', Failed: '#dc2626', Refunded: '#0891b2', Partially_Refunded: '#0891b2' }[payment.status] ?? '#6b7280';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Invoice — ${order.orderId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;font-size:13px;line-height:1.6;background:#fff}
  .page{max-width:800px;margin:0 auto;padding:40px 40px 60px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #0ea5e9;margin-bottom:24px}
  .brand{font-size:24px;font-weight:900;color:#0ea5e9;letter-spacing:-0.5px}
  .brand-sub{font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
  .inv-title{text-align:right}.inv-title h1{font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#111}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:800;text-transform:uppercase;color:#fff}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px}
  .box h3{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#0ea5e9;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0}
  .box p{font-size:12px;color:#374151;margin-bottom:2px}
  .box strong{color:#111}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}
  thead tr{background:#0ea5e9;color:#fff}
  thead th{padding:9px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
  th.c,td.c{text-align:center}th.r,td.r{text-align:right}
  tbody tr.even{background:#f8fafc}
  tbody td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tbody td small{font-size:10px;color:#6b7280}
  .sum-wrap{display:flex;justify-content:flex-end;margin-bottom:24px}
  .sum{width:280px;font-size:12.5px}.sum td{padding:5px 10px;border:none}
  .sum td.r{text-align:right}.sum tr.disc td{color:#16a34a;font-weight:700}
  .sum .tot td{font-size:14px;font-weight:900;color:#0ea5e9;border-top:2px solid #0ea5e9;padding-top:8px}
  .rx{padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin-bottom:20px;font-size:11.5px;color:#92400e}
  .foot{border-top:1px solid #e2e8f0;padding-top:14px;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af}
  .foot .ty{font-size:14px;font-weight:800;color:#0ea5e9}
  @media print{body{background:#fff!important}.page{padding:20px}}
</style></head><body><div class="page">
  <div class="hdr">
    <div>
      <div class="brand">Likeson Healthcare</div>
      <div class="brand-sub">Licensed Pharmacy &amp; Wellness</div>
    </div>
    <div class="inv-title">
      <h1>Invoice</h1>
      <div style="font-family:monospace;font-size:11px;color:#6b7280;margin-top:3px">${order.orderId}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:2px">Date: ${formatDateShort(order.createdAt)}</div>
      <div style="margin-top:6px;display:flex;gap:5px;justify-content:flex-end">
        <span class="badge" style="background:${statusColor}">${order.delivery?.status ?? 'N/A'}</span>
        <span class="badge" style="background:${paymentColor}">${payment.status ?? 'N/A'}</span>
      </div>
    </div>
  </div>
  <div class="grid2">
    <div class="box"><h3>Bill To</h3>
      <p><strong>${addr.fullName ?? order.customer?.name ?? 'N/A'}</strong></p>
      <p>${addr.line1 ?? ''}</p>
      ${addr.landmark ? `<p>${addr.landmark}</p>` : ''}
      <p>${[addr.city, addr.state].filter(Boolean).join(', ')}${addr.pincode ? ' — ' + addr.pincode : ''}</p>
      ${addr.phone ? `<p>📞 ${addr.phone}</p>` : ''}
      ${order.customer?.email ? `<p>✉ ${order.customer.email}</p>` : ''}
    </div>
    <div class="box"><h3>Order Details</h3>
      <p><strong>Order ID:</strong> <span style="font-family:monospace;font-size:11px">${order.orderId}</span></p>
      <p><strong>Date:</strong> ${formatDateShort(order.createdAt)}</p>
      <p><strong>Payment:</strong> ${payment.method ?? 'N/A'}</p>
      ${order.delivery?.deliveredAt ? `<p><strong>Delivered:</strong> ${formatDateShort(order.delivery.deliveredAt)}</p>` : ''}
      ${billing.promoCode ? `<p><strong>Coupon:</strong> ${billing.promoCode}</p>` : ''}
    </div>
  </div>
  <h3 style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#374151;margin-bottom:8px">Ordered Items</h3>
  <table>
    <thead><tr>
      <th style="width:28px">#</th><th>Medicine</th>
      <th class="c" style="width:55px">Qty</th>
      <th class="r" style="width:85px">Unit Price</th>
      <th class="c" style="width:55px">GST</th>
      <th class="r" style="width:75px">Tax</th>
      <th class="r" style="width:95px">Total</th>
    </tr></thead>
    <tbody>${itemRows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px">No items</td></tr>'}</tbody>
  </table>
  <div class="sum-wrap"><table class="sum"><tbody>
    ${summaryRows}${discountRow}${walletRow}
    <tr class="tot"><td><strong>Total Payable</strong></td><td class="r"><strong>${fmt(billing.totalPayable)}</strong></td></tr>
  </tbody></table></div>
  ${order.prescription?.isRequired ? `
  <div class="rx">
    <strong>📋 Prescription Required — Verification: ${order.prescription?.verificationStatus ?? 'Pending'}</strong>
    ${order.prescription?.verificationNotes ? ` — ${order.prescription.verificationNotes}` : ''}
  </div>` : ''}
  <div class="foot">
    <div><div class="ty">Thank you for choosing Likeson!</div><div style="margin-top:3px">For queries, contact your nearest Likeson Healthcare store.</div></div>
    <div style="text-align:right"><div>Computer-generated invoice. No signature required.</div><div style="margin-top:3px;font-size:10px">Generated: ${formatDate(new Date().toISOString())}</div></div>
  </div>
</div></body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { toast.error('Pop-up blocked — allow pop-ups for this site.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
};

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — INVOICE BUTTON
// ═══════════════════════════════════════════════════════════════════════════

const InvoiceButton = memo(({ order }) => {
  const [busy, setBusy] = useState(false);

  const handle = useCallback(() => {
    if (!order) return;
    setBusy(true);
    try {
      generateInvoice(order);
      toast.success('Invoice opened — use "Save as PDF" in the print dialog.');
    } catch {
      toast.error('Invoice generation failed.');
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  }, [order]);

  return (
    <button onClick={handle} disabled={busy || !order}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      title="Download Invoice (PDF)">
      {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {busy ? 'Generating…' : 'Invoice'}
    </button>
  );
});
InvoiceButton.displayName = 'InvoiceButton';

// ═══════════════════════════════════════════════════════════════════════════
// § 4 — SHARED UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

const Section = memo(({ title, icon: Icon, iconColor = 'text-primary', children, collapsible = false, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-base-100 border border-base-300 rounded-xl overflow-hidden">
      <button type="button" onClick={() => collapsible && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-4 border-b border-base-300 bg-base-200/60 ${collapsible ? 'cursor-pointer hover:bg-base-200' : 'cursor-default'}`}>
        <h3 className="text-sm font-bold text-base-content flex items-center gap-2 uppercase tracking-wider">
          <Icon className={`w-4 h-4 ${iconColor}`} />{title}
        </h3>
        {collapsible && (open
          ? <ChevronUp   className="w-4 h-4 text-base-content/40" />
          : <ChevronDown className="w-4 h-4 text-base-content/40" />)}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
Section.displayName = 'Section';

const InfoRow = ({ label, value, mono = false, breakAll = false, children }) => (
  <div className="flex flex-col gap-0.5">
    <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">{label}</p>
    {children ? children : (
      <p className={`text-sm font-semibold text-base-content ${mono ? 'font-mono' : ''} ${breakAll ? 'break-all' : ''}`}>
        {value ?? 'N/A'}
      </p>
    )}
  </div>
);

const OkBanner = ({ show, msg }) => (
  <AnimatePresence>
    {show && (
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="mt-3 flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span className="font-semibold">{msg}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

/** Badge pill */
const StatusBadge = ({ status }) => {
  const map = {
    Placed:             'badge-primary',
    Confirmed:          'badge-secondary',
    Processing:         'badge-warning',
    'Out-for-Delivery': 'badge-info',
    Delivered:          'badge-success',
    Cancelled:          'badge-error',
    Return_Requested:   'badge-warning',
    Return_Accepted:    'badge-info',
    Return_Rejected:    'badge-error',
    Pickup_Assigned:    'badge-info',
    Pickup_Done:        'badge-success',
    Returned:           'badge-ghost',
  };
  return <span className={`badge ${map[status] ?? 'badge-ghost'} badge-sm font-bold`}>{status ?? 'N/A'}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════
// § 5 — CONFIRM ORDER SECTION  (Step 1 — status === 'Placed')
// ═══════════════════════════════════════════════════════════════════════════

const ConfirmOrderSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.orderConfirm);
  const success  = useSelector((s) => s.pharmacyStore?.success?.orderConfirm);

  const [deliveryType,    setDeliveryType]    = useState('Internal');
  const [internalPartner, setInternalPartner] = useState('');
  const [extName,         setExtName]         = useState('');
  const [extAgency,       setExtAgency]       = useState('');
  const [extPhone,        setExtPhone]        = useState('');

  const handleConfirm = useCallback(() => {
    if (deliveryType === 'Internal' && !internalPartner.trim()) {
      toast.error('Enter a driver User ID — paste your own to self-assign');
      return;
    }
    if (deliveryType === 'Third-Party' && (!extName.trim() || !extAgency.trim())) {
      toast.error('Partner name and agency name are required');
      return;
    }
    dispatch(confirmOrder({
      orderId: order.orderId,
      deliveryType,
      ...(deliveryType === 'Internal' && { internalPartner: internalPartner.trim() }),
      ...(deliveryType === 'Third-Party' && {
        externalPartner: { name: extName.trim(), agencyName: extAgency.trim(), phone: extPhone.trim() },
      }),
    }));
  }, [deliveryType, internalPartner, extName, extAgency, extPhone, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => dispatch(clearSuccess('orderConfirm')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  if (order?.delivery?.status !== 'Placed') return null;

  return (
    <Section title="Step 1 — Confirm Order" icon={ShieldCheck} iconColor="text-success">
      <div className="mb-4 p-3 bg-info/10 border border-info/30 rounded-lg text-sm leading-relaxed">
        <p className="font-bold text-info mb-1">📦 Want to deliver this order yourself?</p>
        <p className="text-base-content/70">
          Keep <strong>Internal</strong> selected, then paste <strong>your own MongoDB User ID</strong>{' '}
          in the field below.
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-base-content mb-1.5">Delivery Type</label>
          <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}
            className="input-field w-full text-sm" disabled={loading}>
            <option value="Internal">Internal (Store Driver / Self-Assign)</option>
            <option value="Third-Party">Third-Party Logistics</option>
          </select>
        </div>
        {deliveryType === 'Internal' && (
          <div>
            <label className="block text-xs font-semibold text-base-content mb-1.5">
              Driver User ID <span className="text-error">*</span>
              <span className="ml-1 font-normal text-base-content/50 text-xs">(paste your own ID to self-deliver)</span>
            </label>
            <input type="text" value={internalPartner}
              onChange={(e) => setInternalPartner(e.target.value)}
              placeholder="e.g. 64f3a2b1c5e4d70012ab3456"
              className="input-field w-full text-sm font-mono" disabled={loading} />
            <p className="text-xs text-base-content/40 mt-1">Admin Panel → Your Profile → Account Settings → User ID</p>
          </div>
        )}
        {deliveryType === 'Third-Party' && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-base-content mb-1.5">Partner Name <span className="text-error">*</span></label>
              <input type="text" value={extName} onChange={(e) => setExtName(e.target.value)}
                placeholder="Courier person's name" className="input-field w-full text-sm" disabled={loading} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-base-content mb-1.5">Agency Name <span className="text-error">*</span></label>
              <input type="text" value={extAgency} onChange={(e) => setExtAgency(e.target.value)}
                placeholder="e.g. Delhivery, Dunzo" className="input-field w-full text-sm" disabled={loading} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-base-content mb-1.5">Phone (optional)</label>
              <input type="text" value={extPhone} onChange={(e) => setExtPhone(e.target.value)}
                className="input-field w-full text-sm" disabled={loading} />
            </div>
          </div>
        )}
        <button onClick={handleConfirm} disabled={loading}
          className="btn-success w-full flex items-center justify-center gap-2 text-sm">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {loading ? 'Confirming…' : 'Confirm Order & Assign Driver'}
        </button>
      </div>
      <OkBanner show={success} msg="Order confirmed! You are now assigned as the driver." />
    </Section>
  );
});
ConfirmOrderSection.displayName = 'ConfirmOrderSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 6 — PRESCRIPTION SECTION
// ═══════════════════════════════════════════════════════════════════════════

const PrescriptionSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.prescription);
  const success  = useSelector((s) => s.pharmacyStore?.success?.prescription);

  const [notes,          setNotes]          = useState('');
  const [rejectReason,   setRejectReason]   = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const vs         = order?.prescription?.verificationStatus ?? 'Not_Uploaded';
  const isApproved = vs === 'Approved';
  const isRejected = vs === 'Rejected';
  const isPending  = vs === 'Pending';

  const handleApprove = useCallback(() => {
    if (!notes.trim()) { toast.error('Add verification notes before approving'); return; }
    dispatch(verifyPrescription({ orderId: order.orderId, isVerified: true, verificationNotes: notes.trim() }));
  }, [notes, order.orderId, dispatch]);

  const handleReject = useCallback(() => {
    if (!rejectReason.trim()) { toast.error('Provide a rejection reason'); return; }
    dispatch(verifyPrescription({ orderId: order.orderId, isVerified: false, rejectionReason: rejectReason.trim() }));
  }, [rejectReason, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      setNotes(''); setRejectReason(''); setShowRejectForm(false);
      const t = setTimeout(() => dispatch(clearSuccess('prescription')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  if (!order?.prescription?.isRequired) return null;

  const bannerCls = isApproved ? 'bg-success/10 border-success/30 text-success'
    : isRejected ? 'bg-error/10 border-error/30 text-error'
    : isPending  ? 'bg-warning/10 border-warning/30 text-warning'
    : 'bg-base-200 border-base-300 text-base-content/50';

  return (
    <Section title="Prescription Verification" icon={FileText}>
      <div className={`flex items-center gap-3 p-3 rounded-lg border mb-4 ${bannerCls}`}>
        {isApproved && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
        {isRejected && <XCircle      className="w-4 h-4 flex-shrink-0" />}
        {isPending  && <Clock        className="w-4 h-4 flex-shrink-0" />}
        {!isApproved && !isRejected && !isPending && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">
            {isApproved ? 'Approved' : isRejected ? 'Rejected' : isPending ? 'Pending Verification' : 'Not Uploaded'}
          </p>
          {order.prescription?.verificationNotes && (
            <p className="text-xs opacity-80 mt-0.5">{order.prescription.verificationNotes}</p>
          )}
          {order.prescription?.rejectionReason && (
            <p className="text-xs opacity-80 mt-0.5">Reason: {order.prescription.rejectionReason}</p>
          )}
          {order.prescription?.verifiedAt && (
            <p className="text-xs opacity-60 mt-0.5">Verified: {formatDate(order.prescription.verifiedAt)}</p>
          )}
          {order.prescription?.verifiedBy && (
            <p className="text-xs opacity-60 mt-0.5">
              By: {resolvePartnerName(order.prescription.verifiedBy)}
            </p>
          )}
        </div>
      </div>

      {order.prescription?.imageUrl && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wide mb-2">Prescription Image</p>
          <a href={order.prescription.imageUrl} target="_blank" rel="noopener noreferrer" className="block relative group">
            <img src={order.prescription.imageUrl} alt="Prescription"
              className="max-h-52 rounded-lg border border-base-300 object-contain w-full bg-base-200" />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <ExternalLink className="w-6 h-6 text-white" />
            </div>
          </a>
        </div>
      )}

      {!isApproved && order.prescription?.imageUrl && (
        <div className="space-y-3 border-t border-base-300 pt-4">
          {!showRejectForm ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-base-content mb-1.5">
                  Verification Notes <span className="text-error">*</span>
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes about prescription validity…"
                  className="input-field w-full h-20 resize-none text-sm" disabled={loading} />
              </div>
              <div className="flex gap-3">
                <button onClick={handleApprove} disabled={loading || !notes.trim()}
                  className="btn-success flex-1 flex items-center justify-center gap-2 text-sm">
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {loading ? 'Approving…' : 'Approve'}
                </button>
                <button onClick={() => setShowRejectForm(true)} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border-2 border-error text-error hover:bg-error hover:text-white transition-colors font-bold uppercase">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-base-content mb-1.5">
                  Rejection Reason <span className="text-error">*</span>
                </label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why is the prescription invalid?"
                  className="input-field w-full h-20 resize-none text-sm" disabled={loading} />
              </div>
              <div className="flex gap-3">
                <button onClick={handleReject} disabled={loading || !rejectReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg bg-error text-white hover:brightness-110 transition-all font-bold uppercase">
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {loading ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
                <button onClick={() => { setShowRejectForm(false); setRejectReason(''); }} disabled={loading}
                  className="flex-1 flex items-center justify-center text-sm py-2.5 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <OkBanner show={success} msg={isApproved ? 'Prescription approved!' : 'Prescription rejected.'} />
    </Section>
  );
});
PrescriptionSection.displayName = 'PrescriptionSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 7 — ASSIGN DRIVER SECTION (re-assign)
// ═══════════════════════════════════════════════════════════════════════════

const AssignDriverSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.driverAssign);
  const success  = useSelector((s) => s.pharmacyStore?.success?.driverAssign);

  const [partnerId, setPartnerId] = useState('');

  const handleAssign = useCallback(() => {
    if (!partnerId.trim()) { toast.error('Enter the driver User ID'); return; }
    dispatch(assignDeliveryPartner({ orderId: order.orderId, deliveryPartnerId: partnerId.trim() }));
  }, [partnerId, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      setPartnerId('');
      const t = setTimeout(() => dispatch(clearSuccess('driverAssign')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  const isVisible =
    order?.delivery?.deliveryType === 'Internal' &&
    ['Confirmed', 'Processing', 'Out-for-Delivery'].includes(order?.delivery?.status);
  if (!isVisible) return null;

  return (
    <Section title="Re-assign Delivery Partner" icon={UserCheck}>
      {order?.delivery?.internalPartner && (
        <div className="mb-3 p-3 bg-base-200 rounded-lg text-xs text-base-content/70">
          <span className="font-semibold">Currently assigned: </span>
          <span className="font-mono">{resolvePartnerName(order.delivery.internalPartner)}</span>
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-base-content mb-1.5">
            New Driver User ID <span className="text-error">*</span>
            <span className="ml-1 font-normal text-base-content/50 text-xs">(paste your own ID to self-assign)</span>
          </label>
          <input type="text" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
            placeholder="e.g. 64f3a2b1c5e4d70012ab3456"
            className="input-field w-full text-sm font-mono" disabled={loading} />
        </div>
        <button onClick={handleAssign} disabled={loading || !partnerId.trim()}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2.5">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
          {loading ? 'Assigning…' : 'Assign Driver'}
        </button>
      </div>
      <OkBanner show={success} msg="Delivery partner re-assigned!" />
    </Section>
  );
});
AssignDriverSection.displayName = 'AssignDriverSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 8 — DELIVERY OTP SECTION  (Step 4 — Doorstep)
// ═══════════════════════════════════════════════════════════════════════════

const DeliveryOtpSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.orderStatus);
  const success  = useSelector((s) => s.pharmacyStore?.success?.orderStatus);

  const [otp, setOtp] = useState('');

  const handleVerify = useCallback(() => {
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error('OTP must be exactly 6 digits');
      return;
    }
    dispatch(updateOrderStatus({
      orderId: order.orderId,
      status:  'Delivered',
      note:    `Delivery OTP verified at doorstep: ${otp.trim()}`,
    }));
  }, [otp, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      setOtp('');
      const t = setTimeout(() => dispatch(clearSuccess('orderStatus')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  if (order?.delivery?.status !== 'Out-for-Delivery') return null;

  const otpInfo = order?.deliveryOtp;

  return (
    <Section title="Step 4 — Doorstep OTP Verification" icon={KeyRound} iconColor="text-warning">
      <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm leading-relaxed">
        <p className="font-bold text-warning mb-1">🔑 At the customer's door</p>
        <p className="text-base-content/70">
          Ask the customer for the <strong>6-digit OTP</strong> sent to their email.
          Enter it below and click <strong>"Verify OTP & Mark Delivered"</strong>.
        </p>
        {otpInfo && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-base-content/50">
            {otpInfo.sentAt    && <span>Sent: {formatDate(otpInfo.sentAt)}</span>}
            {otpInfo.expiresAt && <span>Expires: {formatDate(otpInfo.expiresAt)}</span>}
            <span>Verified: {otpInfo.verified ? '✅ Yes' : '❌ No'}</span>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-base-content mb-1.5">
            Customer OTP <span className="text-error">*</span>
          </label>
          <input type="text" maxLength={6} inputMode="numeric" value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="• • • • • •"
            className="input-field w-full text-center text-2xl font-mono tracking-[0.6em] font-bold"
            disabled={loading} />
        </div>
        <button onClick={handleVerify} disabled={loading || otp.length !== 6}
          className="btn-success w-full flex items-center justify-center gap-2 text-sm">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {loading ? 'Verifying OTP…' : 'Verify OTP & Mark Delivered ✓'}
        </button>
      </div>
      <OkBanner show={success} msg="OTP verified! Order is now Delivered 🎉" />
    </Section>
  );
});
DeliveryOtpSection.displayName = 'DeliveryOtpSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 9 — ORDER STATUS SECTION (manual transitions)
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_TRANSITIONS = {
  Placed:             ['Confirmed', 'Cancelled'],
  Confirmed:          ['Processing', 'Cancelled'],
  Processing:         ['Out-for-Delivery', 'Cancelled'],
  'Out-for-Delivery': ['Cancelled'],
  Delivered:          ['Return_Requested'],
  Return_Requested:   ['Return_Accepted', 'Return_Rejected'],
  Return_Accepted:    ['Pickup_Assigned'],
  Pickup_Assigned:    ['Pickup_Done'],
  Pickup_Done:        ['Returned'],
  Cancelled:          [],
  Return_Rejected:    [],
  Returned:           [],
};

const OrderStatusSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.orderStatus);
  const success  = useSelector((s) => s.pharmacyStore?.success?.orderStatus);

  const [newStatus,        setNewStatus]        = useState('');
  const [note,             setNote]             = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [showForm,         setShowForm]         = useState(false);

  const current = order?.delivery?.status ?? 'Placed';
  const allowed = STATUS_TRANSITIONS[current] ?? [];

  const handleUpdate = useCallback(() => {
    if (!newStatus || newStatus === current) { toast.error('Select a different status'); return; }
    dispatch(updateOrderStatus({
      orderId: order.orderId,
      status:  newStatus,
      ...(note.trim()      && { note: note.trim() }),
      ...(estimatedArrival && newStatus === 'Out-for-Delivery' && { estimatedArrival }),
    }));
  }, [newStatus, current, note, estimatedArrival, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      setNewStatus(''); setNote(''); setEstimatedArrival(''); setShowForm(false);
      const t = setTimeout(() => dispatch(clearSuccess('orderStatus')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  // Status history timeline
  const history = order?.delivery?.statusHistory ?? [];

  return (
    <Section title="Order Status & History" icon={Package}>
      {/* Current status */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Current</p>
          <StatusBadge status={current} />
        </div>
        {order?.delivery?.deliveredAt && (
          <p className="text-xs text-base-content/50">Delivered: {formatDate(order.delivery.deliveredAt)}</p>
        )}
        {order?.delivery?.estimatedArrival && (
          <p className="text-xs text-base-content/50">ETA: {formatDate(order.delivery.estimatedArrival)}</p>
        )}
      </div>

      {/* Delivery partner info */}
      {order?.delivery?.deliveryType === 'Internal' && order?.delivery?.internalPartner && (
        <div className="mb-3 p-3 bg-base-200 rounded-lg text-xs flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-base-content/50" />
          <span className="text-base-content/50">Driver:</span>
          <span className="font-semibold font-mono">{resolvePartnerName(order.delivery.internalPartner)}</span>
        </div>
      )}
      {order?.delivery?.deliveryType === 'Third-Party' && order?.delivery?.externalPartner?.name && (
        <div className="mb-3 p-3 bg-base-200 rounded-lg text-xs flex flex-wrap items-center gap-3">
          <Truck className="w-3.5 h-3.5 text-base-content/50" />
          <span><span className="text-base-content/50">Partner: </span><span className="font-semibold">{order.delivery.externalPartner.name}</span></span>
          {order.delivery.externalPartner.agencyName && (
            <span><span className="text-base-content/50">Agency: </span><span className="font-semibold">{order.delivery.externalPartner.agencyName}</span></span>
          )}
          {order.delivery.externalPartner.phone && (
            <span><span className="text-base-content/50">Phone: </span><span className="font-semibold">{order.delivery.externalPartner.phone}</span></span>
          )}
        </div>
      )}

      {/* Timeline */}
      {history.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Status Timeline
          </p>
          <div className="relative pl-4">
            <div className="absolute left-1.5 top-0 bottom-0 w-px bg-base-300" />
            {[...history].reverse().map((h, i) => (
              <div key={i} className="relative mb-2 last:mb-0">
                <div className="absolute -left-[11px] top-1.5 w-2 h-2 rounded-full bg-primary border-2 border-base-100" />
                <div className="pl-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={h.status} />
                    <span className="text-xs text-base-content/40">{formatDate(h.timestamp)}</span>
                  </div>
                  {h.note && <p className="text-xs text-base-content/50 mt-0.5 italic">{h.note}</p>}
                  {h.changedBy && (
                    <p className="text-xs text-base-content/40">by {resolvePartnerName(h.changedBy)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update controls */}
      {allowed.length > 0 && !showForm && (
        <button onClick={() => setShowForm(true)} disabled={loading}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2.5">
          <Truck className="w-4 h-4" /> Update Status
        </button>
      )}

      {allowed.length > 0 && showForm && (
        <div className="space-y-3 pt-2 border-t border-base-300">
          <div>
            <label className="block text-xs font-semibold text-base-content mb-1.5">
              New Status <span className="text-error">*</span>
            </label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              className="input-field w-full text-sm" disabled={loading}>
              <option value="">— Select Status —</option>
              {allowed.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {newStatus === 'Out-for-Delivery' && (
            <div>
              <label className="block text-xs font-semibold text-base-content mb-1.5">Estimated Arrival (optional)</label>
              <input type="datetime-local" value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
                className="input-field w-full text-sm" disabled={loading} />
              <p className="text-xs text-base-content/40 mt-1">
                ℹ️ Moving to Out-for-Delivery emails a 6-digit OTP to the customer.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-base-content mb-1.5">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this status change…"
              className="input-field w-full h-16 resize-none text-sm" disabled={loading} />
          </div>

          <div className="flex gap-3">
            <button onClick={handleUpdate} disabled={loading || !newStatus || newStatus === current}
              className="btn-primary-cta flex-1 flex items-center justify-center gap-2 text-sm">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {loading ? 'Updating…' : 'Confirm Update'}
            </button>
            <button onClick={() => { setShowForm(false); setNewStatus(''); setNote(''); }} disabled={loading}
              className="flex-1 flex items-center justify-center text-sm py-2.5 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {allowed.length === 0 && (
        <p className="text-xs text-base-content/50 italic">No further status transitions available.</p>
      )}

      <OkBanner show={success} msg="Order status updated successfully!" />
    </Section>
  );
});
OrderStatusSection.displayName = 'OrderStatusSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 10 — RETURN DETAILS + ACCEPT SECTION
// ─────────────────────────────────────────────────────────────────────────
// Shows full cancellation/return data from the model including:
//   returnReason, returnEvidence images, selectedRefundMethod,
//   returnDecision, bankDetails, pickupCondition, refundStatus, etc.
// Accept panel appears only when status === 'Return_Requested'
// ═══════════════════════════════════════════════════════════════════════════

const ReturnAcceptSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.returnAccept);
  const success  = useSelector((s) => s.pharmacyStore?.success?.returnAccept);

  const [pickupPartner,   setPickupPartner]   = useState('');
  const [pickupEstimated, setPickupEstimated] = useState('');

  const handleAccept = useCallback(() => {
    if (!pickupPartner.trim()) { toast.error('Enter the pickup driver User ID'); return; }
    dispatch(acceptReturn({
      orderId:       order.orderId,
      pickupPartner: pickupPartner.trim(),
      ...(pickupEstimated && { pickupEstimatedAt: pickupEstimated }),
    }));
  }, [pickupPartner, pickupEstimated, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      setPickupPartner('');
      const t = setTimeout(() => dispatch(clearSuccess('returnAccept')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  const cancel = order?.cancellation;
  const isReturnRelated = cancel?.isReturnRequested || [
    'Return_Requested', 'Return_Accepted', 'Return_Rejected',
    'Pickup_Assigned', 'Pickup_Done', 'Returned',
  ].includes(order?.delivery?.status);

  if (!isReturnRelated) return null;

  const decisionColor = {
    Pending:  'bg-warning/10 border-warning/30 text-warning',
    Accepted: 'bg-success/10 border-success/30 text-success',
    Rejected: 'bg-error/10 border-error/30 text-error',
  }[cancel?.returnDecision] ?? 'bg-base-200 border-base-300 text-base-content/60';

  const refundStatusColor = {
    None:        'badge-ghost',
    Requested:   'badge-warning',
    'In-Progress': 'badge-info',
    Processed:   'badge-success',
    Failed:      'badge-error',
  }[cancel?.refundStatus] ?? 'badge-ghost';

  return (
    <Section title="Return & Refund Details" icon={RotateCcw} iconColor="text-warning">

      {/* Return summary */}
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Return Reason"     value={cancel?.returnReason} />
          <InfoRow label="Return Decision">
            <span className={`badge badge-sm font-bold ${decisionColor} border`}>{cancel?.returnDecision ?? 'Pending'}</span>
          </InfoRow>
          <InfoRow label="Requested At"      value={formatDate(cancel?.returnRequestedAt)} />
          {cancel?.selectedRefundMethod && (
            <InfoRow label="Customer's Refund Choice" value={cancel.selectedRefundMethod.replace(/_/g, ' ')} />
          )}
          {cancel?.refundMethod && cancel.refundMethod !== 'None' && (
            <InfoRow label="Approved Refund Method" value={cancel.refundMethod.replace(/_/g, ' ')} />
          )}
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Refund Status</p>
            <span className={`badge ${refundStatusColor} badge-sm font-bold w-fit`}>{cancel?.refundStatus ?? 'None'}</span>
          </div>
          {(cancel?.refundAmount ?? 0) > 0 && (
            <InfoRow label="Refund Amount" value={fmt(cancel.refundAmount)} />
          )}
          {cancel?.refundInitiatedAt && (
            <InfoRow label="Refund Initiated" value={formatDate(cancel.refundInitiatedAt)} />
          )}
          {cancel?.refundedAt && (
            <InfoRow label="Refunded At" value={formatDate(cancel.refundedAt)} />
          )}
          {cancel?.adminRefundNote && (
            <div className="col-span-2"><InfoRow label="Admin Refund Note" value={cancel.adminRefundNote} /></div>
          )}
        </div>

        {/* Customer bank details (if bank transfer chosen) */}
        {cancel?.bankDetails?.accountNumber && (
          <div className="p-3 bg-base-200 rounded-lg space-y-1">
            <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5" /> Customer Bank Details
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {cancel.bankDetails.accountHolderName && <div><span className="text-base-content/50">Name: </span><span className="font-semibold">{cancel.bankDetails.accountHolderName}</span></div>}
              {cancel.bankDetails.accountNumber     && <div><span className="text-base-content/50">Account: </span><span className="font-mono font-semibold">{cancel.bankDetails.accountNumber}</span></div>}
              {cancel.bankDetails.ifscCode          && <div><span className="text-base-content/50">IFSC: </span><span className="font-mono font-semibold">{cancel.bankDetails.ifscCode}</span></div>}
              {cancel.bankDetails.bankName          && <div><span className="text-base-content/50">Bank: </span><span className="font-semibold">{cancel.bankDetails.bankName}</span></div>}
              {cancel.bankDetails.branchName        && <div><span className="text-base-content/50">Branch: </span><span className="font-semibold">{cancel.bankDetails.branchName}</span></div>}
            </div>
          </div>
        )}

        {/* Pickup condition info (post-verify) */}
        {cancel?.pickupConditionNotes && (
          <div className="p-3 bg-base-200 rounded-lg text-xs space-y-1">
            <p className="font-bold text-base-content/60 uppercase tracking-wide mb-1">Pickup Inspection</p>
            <div className="flex items-center gap-2">
              {cancel.pickupConditionGood === true  && <span className="badge badge-success badge-xs">Good Condition</span>}
              {cancel.pickupConditionGood === false && <span className="badge badge-error badge-xs">Poor Condition</span>}
              {cancel.pickupVerifiedAt && <span className="text-base-content/40">Verified: {formatDate(cancel.pickupVerifiedAt)}</span>}
              {cancel.pickupVerifiedBy && <span className="text-base-content/40">by {resolvePartnerName(cancel.pickupVerifiedBy)}</span>}
            </div>
            <p className="text-base-content/60 italic">{cancel.pickupConditionNotes}</p>
          </div>
        )}

        {/* Return decision info */}
        {cancel?.returnDecisionNote && (
          <div className={`p-3 rounded-lg border text-xs ${decisionColor}`}>
            <p className="font-bold mb-1">Decision Note</p>
            <p>{cancel.returnDecisionNote}</p>
            {cancel.returnDecisionAt && <p className="opacity-70 mt-1">{formatDate(cancel.returnDecisionAt)}</p>}
          </div>
        )}

        {/* Return evidence images */}
        {Array.isArray(cancel?.returnEvidence) && cancel.returnEvidence.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Return Evidence ({cancel.returnEvidence.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {cancel.returnEvidence.map((ev, i) => (
                <a key={ev._id ?? i} href={ev.url} target="_blank" rel="noopener noreferrer"
                  className="block relative group rounded-lg overflow-hidden border border-base-300 bg-base-200 aspect-square">
                  {ev.mediaType === 'image' ? (
                    <img src={ev.url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <video src={ev.url} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute bottom-1 right-1 badge badge-xs badge-ghost backdrop-blur-sm">
                    {ev.mediaType}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pickup partner info */}
      {order?.delivery?.pickupPartner && (
        <div className="mb-3 p-3 bg-base-200 rounded-lg text-xs flex items-center gap-2">
          <UserCheck className="w-3.5 h-3.5 text-base-content/50" />
          <span className="text-base-content/50">Pickup Driver:</span>
          <span className="font-mono font-semibold">{resolvePartnerName(order.delivery.pickupPartner)}</span>
          {order.delivery.pickupEstimatedAt && (
            <span className="text-base-content/40 ml-auto">ETA: {formatDate(order.delivery.pickupEstimatedAt)}</span>
          )}
        </div>
      )}

      {/* Accept form — only for Return_Requested */}
      {order?.delivery?.status === 'Return_Requested' && (
        <div className="border-t border-base-300 pt-4 space-y-3">
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-xs font-semibold">
            Customer has requested a return. Assign a pickup driver to collect the medicines.
          </div>
          <div>
            <label className="block text-xs font-semibold text-base-content mb-1.5">
              Pickup Driver User ID <span className="text-error">*</span>
              <span className="ml-1 font-normal text-base-content/50 text-xs">(paste your own ID to self-pickup)</span>
            </label>
            <input type="text" value={pickupPartner} onChange={(e) => setPickupPartner(e.target.value)}
              placeholder="e.g. 64f3a2b1c5e4d70012ab3456"
              className="input-field w-full text-sm font-mono" disabled={loading} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-base-content mb-1.5">Pickup ETA (optional)</label>
            <input type="datetime-local" value={pickupEstimated}
              onChange={(e) => setPickupEstimated(e.target.value)}
              className="input-field w-full text-sm" disabled={loading} />
          </div>
          <button onClick={handleAccept} disabled={loading || !pickupPartner.trim()}
            className="w-full flex items-center justify-center gap-2 text-sm py-3 rounded-lg font-bold uppercase tracking-wider bg-warning text-white hover:brightness-110 transition-all disabled:opacity-50">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {loading ? 'Accepting…' : 'Accept Return & Assign Pickup Driver'}
          </button>
          <OkBanner show={success} msg="Return accepted! Pickup driver assigned." />
        </div>
      )}
    </Section>
  );
});
ReturnAcceptSection.displayName = 'ReturnAcceptSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 11 — PICKUP VERIFY SECTION  (status === 'Pickup_Done')
// ═══════════════════════════════════════════════════════════════════════════

const PickupVerifySection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.pickupVerify);
  const success  = useSelector((s) => s.pharmacyStore?.success?.pickupVerify);

  const [good,         setGood]         = useState(true);
  const [notes,        setNotes]        = useState('');
  const [refundMethod, setRefundMethod] = useState('Original_Source');
  const [bank,         setBank]         = useState({
    accountNumber: '', ifscCode: '', accountHolderName: '', bankName: '',
  });

  const handleVerify = useCallback(() => {
    if (good && refundMethod === 'Bank_Transfer') {
      if (!bank.accountNumber.trim() || !bank.ifscCode.trim()) {
        toast.error('Account number and IFSC are required for bank transfer'); return;
      }
    }
    dispatch(verifyPickup({
      orderId:              order.orderId,
      pickupConditionGood:  good,
      pickupConditionNotes: notes.trim(),
      ...(good && { refundMethod }),
      ...(good && refundMethod === 'Bank_Transfer' && { bankDetails: bank }),
    }));
  }, [good, notes, refundMethod, bank, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => dispatch(clearSuccess('pickupVerify')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  if (order?.delivery?.status !== 'Pickup_Done') return null;

  return (
    <Section title="Verify Returned Items" icon={Package} iconColor="text-info">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-base-content mb-2">Item Condition</label>
          <div className="flex gap-3">
            {[
              { val: true,  label: '✓ Good Condition', active: 'bg-success/15 border-success text-success' },
              { val: false, label: '✗ Poor Condition',  active: 'bg-error/15 border-error text-error'      },
            ].map((opt) => (
              <button key={String(opt.val)} onClick={() => setGood(opt.val)} disabled={loading}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${good === opt.val ? opt.active : 'border-base-300 text-base-content/60 hover:border-base-400'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-base-content mb-1.5">Condition Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the item condition…"
            className="input-field w-full h-16 resize-none text-sm" disabled={loading} />
        </div>

        {good && (
          <div className="space-y-2 border-t border-base-300 pt-3">
            <div>
              <label className="block text-xs font-semibold text-base-content mb-1.5">Refund Method</label>
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}
                className="input-field w-full text-sm" disabled={loading}>
                <option value="Original_Source">Original Payment Source</option>
                <option value="Wallet">Store Wallet</option>
                <option value="Bank_Transfer">Bank Transfer</option>
              </select>
            </div>
            {refundMethod === 'Bank_Transfer' && (
              <div className="space-y-2 pl-3 border-l-2 border-primary/30">
                {[
                  { label: 'Account Holder Name', key: 'accountHolderName' },
                  { label: 'Account Number *',    key: 'accountNumber' },
                  { label: 'IFSC Code *',         key: 'ifscCode' },
                  { label: 'Bank Name',           key: 'bankName' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-base-content mb-1">{label}</label>
                    <input type="text" value={bank[key]}
                      onChange={(e) => setBank((b) => ({ ...b, [key]: e.target.value }))}
                      className="input-field w-full text-sm" disabled={loading} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={handleVerify} disabled={loading}
          className={`w-full flex items-center justify-center gap-2 text-sm py-3 rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${good ? 'btn-success' : 'bg-error text-white hover:brightness-110'}`}>
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {loading ? 'Verifying…' : good ? 'Approve & Initiate Refund' : 'Reject — Poor Condition'}
        </button>
      </div>
      <OkBanner show={success} msg={good ? 'Pickup verified — refund initiated!' : 'Return rejected (poor condition).'} />
    </Section>
  );
});
PickupVerifySection.displayName = 'PickupVerifySection';

// ═══════════════════════════════════════════════════════════════════════════
// § 12 — PAYMENT & RAZORPAY REFUND SECTION
// ═══════════════════════════════════════════════════════════════════════════

const PaymentSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.refund);
  const success  = useSelector((s) => s.pharmacyStore?.success?.refund);

  const [showForm,     setShowForm]     = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const payStatus = order?.payment?.status;
  const canRefund = payStatus === 'Paid' && !!order?.payment?.razorpayPaymentId;

  useEffect(() => {
    if (showForm) setRefundAmount(order?.billing?.totalPayable?.toFixed(2) ?? '');
  }, [showForm, order?.billing?.totalPayable]);

  const handleRefund = useCallback(() => {
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0)                        { toast.error('Enter a valid refund amount'); return; }
    if (amount > (order?.billing?.totalPayable ?? 0))  { toast.error(`Max: ${fmt(order?.billing?.totalPayable)}`); return; }
    if (!refundReason.trim())                          { toast.error('Provide a refund reason'); return; }
    dispatch(processRefund({ orderId: order.orderId, amount, reason: refundReason.trim() }));
  }, [refundAmount, refundReason, order.orderId, order?.billing?.totalPayable, dispatch]);

  useEffect(() => {
    if (success) {
      setShowForm(false); setRefundAmount(''); setRefundReason('');
      const t = setTimeout(() => dispatch(clearSuccess('refund')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  const badgeCls = {
    Pending:            'badge-warning',
    Paid:               'badge-success',
    Failed:             'badge-error',
    Refunded:           'badge-info',
    Partially_Refunded: 'badge-info',
  }[payStatus] ?? 'badge-ghost';

  return (
    <Section title="Payment Information" icon={CreditCard}>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <InfoRow label="Method" value={order?.payment?.method} />
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Status</p>
          <span className={`badge ${badgeCls} badge-sm font-bold w-fit`}>{payStatus ?? 'N/A'}</span>
        </div>
        {order?.payment?.razorpayOrderId   && <div className="col-span-2"><InfoRow label="Razorpay Order ID"   value={order.payment.razorpayOrderId}   mono breakAll /></div>}
        {order?.payment?.razorpayPaymentId && <div className="col-span-2"><InfoRow label="Razorpay Payment ID" value={order.payment.razorpayPaymentId} mono breakAll /></div>}
        {order?.payment?.paidAt            && <div className="col-span-2"><InfoRow label="Paid At" value={formatDate(order.payment.paidAt)} /></div>}
        {(order?.payment?.refundAmount ?? 0) > 0 && (
          <div className="col-span-2"><InfoRow label="Amount Refunded" value={fmt(order.payment.refundAmount)} /></div>
        )}
      </div>

      {canRefund && (
        <div className="border-t border-base-300 pt-4 space-y-3">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} disabled={loading}
              className="btn-primary-cta w-full flex items-center justify-center gap-2 text-sm">
              <DollarSign className="w-4 h-4" /> Initiate Razorpay Refund
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-base-content mb-1.5">
                  Refund Amount (₹) <span className="text-error">*</span>
                </label>
                <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                  max={order?.billing?.totalPayable} step="0.01" min="0.01"
                  className="input-field w-full text-sm" disabled={loading} />
                <p className="text-xs text-base-content/50 mt-1">Max: {fmt(order?.billing?.totalPayable)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-base-content mb-1.5">
                  Reason <span className="text-error">*</span>
                </label>
                <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Why is this refund being processed?"
                  className="input-field w-full h-16 resize-none text-sm" disabled={loading} />
              </div>
              <div className="flex gap-3">
                <button onClick={handleRefund} disabled={loading || !refundReason.trim()}
                  className="btn-success flex-1 flex items-center justify-center gap-2 text-sm">
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                  {loading ? 'Processing…' : 'Process Refund'}
                </button>
                <button onClick={() => { setShowForm(false); setRefundAmount(''); setRefundReason(''); }} disabled={loading}
                  className="flex-1 flex items-center justify-center text-sm py-2.5 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!canRefund && (
        <p className="text-xs text-base-content/50 italic border-t border-base-300 pt-3">
          Refunds available only for <strong>Paid</strong> orders with a Razorpay Payment ID.
        </p>
      )}

      <OkBanner show={success} msg="Refund initiated successfully!" />
    </Section>
  );
});
PaymentSection.displayName = 'PaymentSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 13 — ADMIN NOTES SECTION
// ─────────────────────────────────────────────────────────────────────────
// ✅ FIXED: Notes now support preset-option chips + custom free-text fallback.
//    Preset options are real, contextual notes relevant to pharmacy ops.
//    Selecting a preset fills the textarea; user can edit before submitting.
//    "Custom" chip clears the textarea for free-text entry.
// ═══════════════════════════════════════════════════════════════════════════

/** Preset note templates categorised for pharmacy admin use */
const NOTE_PRESETS = [
  {
    group: 'Prescription',
    items: [
      'Prescription verified by pharmacist — original valid.',
      'Prescription image unclear — customer asked to re-upload.',
      'Prescription valid but quantity exceeds prescribed dosage — flagged.',
      'Controlled substance — prescription double-checked with licence number.',
    ],
  },
  {
    group: 'Delivery',
    items: [
      'Customer not available at delivery address — rescheduled.',
      'Partial delivery done — remaining items to be dispatched tomorrow.',
      'Delivery delayed due to heavy rain — customer informed via call.',
      'Door locked — left notice; customer to call for re-delivery.',
      'Temperature-sensitive medicines packed with ice pack.',
    ],
  },
  {
    group: 'Payment',
    items: [
      'COD collected in full — cash deposited at store.',
      'Razorpay refund initiated manually — awaiting bank settlement.',
      'Wallet refund credited — customer notified.',
      'Partial refund processed for returned items only.',
    ],
  },
  {
    group: 'Return / Quality',
    items: [
      'Returned medicines inspected — all seals intact.',
      'Returned medicines rejected — packaging damaged / seals broken.',
      'Stock quarantined pending supplier recall verification.',
      'Missing medicine confirmed — replacement to be dispatched.',
    ],
  },
  {
    group: 'General',
    items: [
      'Customer called — issue resolved.',
      'Escalated to store manager for review.',
      'Order flagged for quality audit.',
      'Follow-up scheduled for next business day.',
    ],
  },
];

const AdminNoteSection = memo(({ order }) => {
  const dispatch = useDispatch();
  const loading  = useSelector((s) => s.pharmacyStore?.loading?.orderNote);
  const success  = useSelector((s) => s.pharmacyStore?.success?.orderNote);

  const [note,           setNote]           = useState('');
  const [activePreset,   setActivePreset]   = useState(null); // string or null
  const [openGroup,      setOpenGroup]      = useState(null); // group label or null

  const handlePresetClick = useCallback((text) => {
    if (activePreset === text) {
      // toggle off
      setActivePreset(null);
      setNote('');
    } else {
      setActivePreset(text);
      setNote(text);
    }
  }, [activePreset]);

  const handleCustom = useCallback(() => {
    setActivePreset(null);
    setNote('');
  }, []);

  const handleAdd = useCallback(() => {
    if (!note.trim()) { toast.error('Note cannot be empty'); return; }
    dispatch(addOrderNote({ orderId: order.orderId, note: note.trim() }));
  }, [note, order.orderId, dispatch]);

  useEffect(() => {
    if (success) {
      setNote('');
      setActivePreset(null);
      const t = setTimeout(() => dispatch(clearSuccess('orderNote')), 2500);
      return () => clearTimeout(t);
    }
  }, [success, dispatch]);

  return (
    <Section title="Internal Admin Notes" icon={StickyNote} collapsible defaultOpen={false}>
      {/* Existing notes */}
      {Array.isArray(order?.adminNotes) && order.adminNotes.length > 0 && (
        <div className="mb-4 space-y-2 max-h-44 overflow-y-auto">
          {order.adminNotes.map((n, i) => (
            <div key={i} className="p-3 bg-base-200 rounded-lg">
              <p className="text-xs font-mono text-base-content/70 whitespace-pre-wrap">{n.text}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-base-content/40">{formatDate(n.addedAt)}</p>
                {n.addedBy && (
                  <p className="text-xs text-base-content/40">· by {resolvePartnerName(n.addedBy)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preset chips */}
      <div className="mb-3 space-y-2">
        <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">Quick Templates</p>

        {NOTE_PRESETS.map((group) => (
          <div key={group.group}>
            <button
              type="button"
              onClick={() => setOpenGroup(openGroup === group.group ? null : group.group)}
              className="flex items-center gap-1.5 text-xs font-bold text-base-content/60 hover:text-base-content transition-colors mb-1 uppercase tracking-wider">
              {openGroup === group.group
                ? <ChevronUp className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />}
              {group.group}
            </button>
            <AnimatePresence>
              {openGroup === group.group && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                  className="overflow-hidden flex flex-wrap gap-1.5 pl-2">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handlePresetClick(item)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium leading-tight text-left ${
                        activePreset === item
                          ? 'bg-primary/15 border-primary text-primary'
                          : 'border-base-300 text-base-content/60 hover:border-primary/50 hover:text-base-content'
                      }`}>
                      {item}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Custom option */}
        <button
          type="button"
          onClick={handleCustom}
          className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
            activePreset === null && note === ''
              ? 'bg-base-200 border-base-400 text-base-content'
              : 'border-base-300 text-base-content/50 hover:border-base-400'
          }`}>
          ✏️ Custom note…
        </button>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); if (activePreset && e.target.value !== activePreset) setActivePreset(null); }}
          placeholder="Type a note or pick a template above…"
          className="input-field w-full h-20 resize-none text-sm"
          disabled={loading} />
        <button onClick={handleAdd} disabled={loading || !note.trim()}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2.5">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
          {loading ? 'Adding…' : 'Add Note'}
        </button>
      </div>

      <OkBanner show={success} msg="Note added successfully!" />
    </Section>
  );
});
AdminNoteSection.displayName = 'AdminNoteSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 14 — CUSTOMER FEEDBACK SECTION (read-only)
// ═══════════════════════════════════════════════════════════════════════════

const CustomerFeedbackSection = memo(({ order }) => {
  const fb = order?.customerFeedback;
  if (!fb?.rating && !fb?.comment) return null;

  return (
    <Section title="Customer Feedback" icon={Star} iconColor="text-warning" collapsible defaultOpen={false}>
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={`w-5 h-5 ${s <= (fb.rating ?? 0) ? 'text-warning fill-warning' : 'text-base-300'}`} />
          ))}
        </div>
        <span className="text-sm font-bold text-base-content">{fb.rating}/5</span>
        {fb.createdAt && <span className="text-xs text-base-content/40 ml-auto">{formatDate(fb.createdAt)}</span>}
      </div>
      {fb.comment && (
        <p className="mt-3 text-sm text-base-content/70 bg-base-200 rounded-lg p-3 italic">"{fb.comment}"</p>
      )}
    </Section>
  );
});
CustomerFeedbackSection.displayName = 'CustomerFeedbackSection';

// ═══════════════════════════════════════════════════════════════════════════
// § 15 — MAIN EXPORT: ORDER DETAILS MODAL
// ═══════════════════════════════════════════════════════════════════════════

export default memo(function OrderDetailsModal({ isOpen, onClose }) {
  const dispatch       = useDispatch();
  const currentOrder   = useSelector((s) => s.pharmacyStore?.currentOrder   ?? null);
  const loadingDetails = useSelector((s) => s.pharmacyStore?.loading?.orderDetails);
  const errorDetails   = useSelector((s) => s.pharmacyStore?.errors?.orderDetails);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div key="modal-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        aria-label={`Order details ${currentOrder?.orderId ?? ''}`}>

        <motion.div key="modal-panel"
          initial={{ scale: 0.96, opacity: 0, y: 20 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{ scale: 0.96, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden"
          onClick={(e) => e.stopPropagation()}>

          {/* ── Sticky header ── */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 bg-base-100 border-b border-base-300">
            <div className="flex items-center gap-3 min-w-0">
              <Hash className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-base-content truncate leading-tight">
                  {currentOrder?.orderId ?? 'Loading…'}
                </h2>
                {currentOrder?.delivery?.status && (
                  <StatusBadge status={currentOrder.delivery.status} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {currentOrder && <InvoiceButton order={currentOrder} />}
              <button onClick={onClose}
                className="p-2 hover:bg-base-200 rounded-lg transition-colors"
                aria-label="Close modal">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-72px)]">

            {/* Error banner */}
            <AnimatePresence>
              {errorDetails && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-start gap-3 p-4 bg-error/10 border border-error/30 rounded-xl text-error"
                  role="alert">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">Failed to load order</p>
                    <p className="text-xs opacity-80">{errorDetails?.message ?? 'An error occurred'}</p>
                  </div>
                  <button onClick={() => dispatch(clearError('orderDetails'))}
                    className="text-error/60 hover:text-error flex-shrink-0" aria-label="Dismiss">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading skeleton */}
            {loadingDetails && !currentOrder && (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-24 rounded-xl" />
                ))}
              </div>
            )}

            {/* ── Order content ── */}
            {currentOrder && (
              <>
                {/* ── Customer ── */}
                <Section title="Customer" icon={User}>
                  <div className="flex items-center gap-4 mb-4">
                    {currentOrder.customer?.avatar && (
                      <img src={currentOrder.customer.avatar} alt={currentOrder.customer.name}
                        className="w-12 h-12 rounded-full border border-base-300 object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-base-content truncate">
                        {currentOrder.customer?.name ?? 'N/A'}
                      </p>
                      {currentOrder.customer?.isCurrentlyBlocked && (
                        <span className="badge badge-error badge-xs">Blocked</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-base-content/40 flex-shrink-0" />
                      <InfoRow label="Phone" value={currentOrder.customer?.phone} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-base-content/40 flex-shrink-0" />
                      <InfoRow label="Email" value={currentOrder.customer?.email} breakAll />
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-base-content/40 flex-shrink-0" />
                      <InfoRow label="Order Date" value={formatDate(currentOrder.createdAt)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-base-content/40 flex-shrink-0" />
                      <InfoRow label="Order ID" value={currentOrder.orderId} mono />
                    </div>
                  </div>
                </Section>

                {/* ── Delivery Address ── */}
                {currentOrder.delivery?.address && (
                  <Section title="Delivery Address" icon={MapPin}>
                    <div className="space-y-1 text-sm">
                      <p className="font-bold text-base-content">{currentOrder.delivery.address?.fullName ?? 'N/A'}</p>
                      <p className="text-base-content/70">{currentOrder.delivery.address?.line1}</p>
                      {currentOrder.delivery.address?.landmark && (
                        <p className="text-xs text-base-content/60">Landmark: {currentOrder.delivery.address.landmark}</p>
                      )}
                      <p className="text-base-content/70">
                        {currentOrder.delivery.address?.city}, {currentOrder.delivery.address?.state} — {currentOrder.delivery.address?.pincode}
                      </p>
                      {currentOrder.delivery.address?.phone && (
                        <p className="text-xs text-base-content/60">Phone: {currentOrder.delivery.address.phone}</p>
                      )}
                    </div>
                  </Section>
                )}

                {/* ── Items ── */}
                {(currentOrder.items?.length ?? 0) > 0 && (
                  <Section title={`Items (${currentOrder.items.length})`} icon={Pill} collapsible>
                    <div className="space-y-3">
                      {currentOrder.items.map((item, idx) => (
                        <div key={item._id ?? idx} className="flex items-start gap-3 pb-3 border-b border-base-300 last:border-0 last:pb-0">
                          {item.medicineImage && (
                            <img src={item.medicineImage} alt={item.name}
                              className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-base-300 bg-base-200" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-base-content truncate">{item.name}</p>
                            {item.brandName   && <p className="text-xs text-base-content/50">{item.brandName}</p>}
                            {item.genericName && <p className="text-xs text-base-content/40 italic">{item.genericName}</p>}
                            {item.hsnCode     && <p className="text-xs text-base-content/30">HSN: {item.hsnCode}</p>}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="badge badge-info badge-sm">Qty: {item.quantity}</span>
                              <span className="text-xs text-base-content/50">{fmt(item.pricePerUnit)} each</span>
                              {(item.gstPercentage ?? 0) > 0 && (
                                <span className="text-xs text-base-content/40">GST {item.gstPercentage}%</span>
                              )}
                              {item.isPrescriptionRequired && (
                                <span className="badge badge-warning badge-xs">Rx Required</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-base-content">{fmt(item.totalPrice)}</p>
                            {(item.taxAmount ?? 0) > 0 && (
                              <p className="text-xs text-base-content/40">+{fmt(item.taxAmount)} tax</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Billing ── */}
                {currentOrder.billing && (
                  <Section title="Billing Summary" icon={DollarSign}>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: 'Subtotal',         val: currentOrder.billing.subTotal },
                        { label: 'GST',              val: currentOrder.billing.gstAmount },
                        { label: 'Delivery Charges', val: currentOrder.billing.deliveryCharges },
                        { label: 'Platform Fee',     val: currentOrder.billing.platformFee },
                      ].filter((r) => (r.val ?? 0) > 0).map(({ label, val }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-base-content/60">{label}</span>
                          <span className="font-semibold">{fmt(val)}</span>
                        </div>
                      ))}
                      {(currentOrder.billing.discountAmount ?? 0) > 0 && (
                        <div className="flex justify-between text-success">
                          <span>Discount{currentOrder.billing.promoCode ? ` (${currentOrder.billing.promoCode})` : ''}</span>
                          <span className="font-semibold">−{fmt(currentOrder.billing.discountAmount)}</span>
                        </div>
                      )}
                      {(currentOrder.billing.walletAmountUsed ?? 0) > 0 && (
                        <div className="flex justify-between text-info">
                          <span>Wallet Applied</span>
                          <span className="font-semibold">−{fmt(currentOrder.billing.walletAmountUsed)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-base-300 pt-2">
                        <span className="font-bold text-base-content">Total Payable</span>
                        <span className="font-bold text-primary text-base">{fmt(currentOrder.billing.totalPayable)}</span>
                      </div>
                    </div>
                  </Section>
                )}

                {/*
                 * ── ACTION SECTIONS (lifecycle order) ──────────────────────
                 * All sections rendered unconditionally — each self-guards.
                 */}
                <ConfirmOrderSection order={currentOrder} />
                <PrescriptionSection order={currentOrder} />
                <AssignDriverSection order={currentOrder} />
                <DeliveryOtpSection  order={currentOrder} />
                <OrderStatusSection  order={currentOrder} />
                <ReturnAcceptSection order={currentOrder} />
                <PickupVerifySection order={currentOrder} />
                <PaymentSection      order={currentOrder} />
                <CustomerFeedbackSection order={currentOrder} />
                <AdminNoteSection    order={currentOrder} />
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});