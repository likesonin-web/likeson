'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { QrCode, Banknote, CheckCircle, ArrowRight, RefreshCw, DollarSign, Plus, Navigation } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  generatePayAtServiceLink, fetchPayAtServiceStatus,
  markCollectedByPartner, markServiceComplete,
  selectPayAtServiceSession, selectPayAtServiceLoading,
} from '@/store/slices/payAtServiceSlice';
import {
  adminRequestCareRide, fetchAdminCareRideNearby,
  selectCareRideNearby, selectLoading,
  adminProcessRefund, selectAdminRefundLoading,
} from '@/store/slices/operationsSlice';
import {
  currency, statusBadge, fmt, Spinner, FieldNote, REFUND_REASONS, CallButton,
} from './shared';

/* ─── PAY-AT-SERVICE ───────────────────────────────────────────────────────── */
export function PayAtServicePanel({ booking, dispatch }) {
  const bookingId = booking._id;
  const session   = useSelector(selectPayAtServiceSession(bookingId));
  const loading   = useSelector(selectPayAtServiceLoading);

  const [cashAmount, setCashAmount] = useState(booking?.fareBreakdown?.totalAmount ?? '');
  const [cashMethod, setCashMethod] = useState('cash');
  const [cashNote,   setCashNote]   = useState('');

  const paymentDone = ['paid', 'pay_at_service_paid', 'refunded'].includes(booking?.paymentStatus) || session?.paid;

  useEffect(() => {
    if (!bookingId) return;
    dispatch(fetchPayAtServiceStatus({ bookingId }));
    let interval;
    if (session?.shortUrl && !session?.paid && !paymentDone) {
      interval = setInterval(() => dispatch(fetchPayAtServiceStatus({ bookingId })), 8000);
    }
    return () => interval && clearInterval(interval);
  }, [bookingId, session?.shortUrl, session?.paid, paymentDone, dispatch]);

  const amount    = session?.amount ?? booking?.fareBreakdown?.totalAmount ?? 0;
  const shortUrl  = session?.shortUrl ?? booking?.payAtService?.shortUrl ?? null;
  const expiresAt = session?.expiresAt ?? booking?.payAtService?.expiresAt ?? null;
  const isPaid    = session?.paid ?? paymentDone;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const canComplete = (session?.canMarkComplete ?? isPaid) && booking?.status !== 'completed';

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-base-300 bg-base-200 p-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">Amount Due</p>
          <p className="text-sm font-bold text-success m-0 mt-0.5">{currency(amount)}</p>
          <FieldNote text="Total fare from fareBreakdown" />
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">Payment Status</p>
          <div className="mt-1">{statusBadge(booking?.paymentStatus ?? 'unpaid')}</div>
        </div>
      </div>

      {isPaid ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success flex items-center gap-2">
          <CheckCircle size={14} />
          <div>
            <p className="font-bold m-0">Payment Received</p>
            {session?.paidAt && <p className="m-0 opacity-70 mt-0.5">Paid at {fmt(session.paidAt)}</p>}
          </div>
        </div>
      ) : (
        <>
          {shortUrl && !isExpired && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2">
              <p className="font-bold m-0 text-xs flex items-center gap-1.5 text-base-content"><QrCode size={12} /> Payment Link Active</p>
              <p className="m-0 text-base-content/60 break-all font-mono text-[10px]">{shortUrl}</p>
              {expiresAt && <p className="m-0 text-base-content/40 text-[10px]">Expires: {fmt(expiresAt)}</p>}
              <FieldNote text="Share this link with the patient. It auto-polls every 8 seconds." />
              <div className="flex gap-2 mt-1">
                <a href={shortUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-primary flex-1 gap-1">
                  <ArrowRight size={9} /> Open Link
                </a>
                <button onClick={() => dispatch(fetchPayAtServiceStatus({ bookingId }))} disabled={loading?.fetchStatus} className="btn btn-xs flex-1 gap-1 bg-base-300 text-base-content">
                  {loading?.fetchStatus ? <Spinner size={9} /> : <RefreshCw size={9} />} Check Status
                </button>
              </div>
            </div>
          )}

          {(!shortUrl || isExpired) && (
            <div>
              <FieldNote text="Generates a Razorpay payment link + QR. Patient can scan/click to pay." />
              <button disabled={loading?.generateLink} onClick={() => dispatch(generatePayAtServiceLink({ bookingId }))} className="btn btn-primary w-full gap-2 mt-1">
                {loading?.generateLink ? <Spinner size={12} /> : <QrCode size={12} />}
                {isExpired ? 'Regenerate QR / Link' : 'Generate QR / Payment Link'}
              </button>
            </div>
          )}

          <div className="divider text-[10px] text-base-content/35 m-0">OR record cash / manual payment</div>

          <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-2">
            <FieldNote text="Use when patient pays cash on-site. Recorded against booking." />
            <div className="flex gap-2">
              <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Amount collected" className="input-field text-xs flex-1" />
              <select value={cashMethod} onChange={(e) => setCashMethod(e.target.value)} className="input-field text-xs w-28">
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <input value={cashNote} onChange={(e) => setCashNote(e.target.value)} placeholder="Note (optional)" className="input-field text-xs" />
            <button disabled={loading?.markCollected || !cashAmount} onClick={() => dispatch(markCollectedByPartner({ bookingId, amount: Number(cashAmount), method: cashMethod, note: cashNote || undefined }))} className="btn btn-sm gap-1.5 bg-base-300 text-base-content">
              {loading?.markCollected ? <Spinner size={10} /> : <Banknote size={10} />} Mark Collected
            </button>
          </div>
        </>
      )}

      <div>
        <FieldNote text="Mark service as complete after payment confirmed. Notifies all parties." />
        <button
          disabled={!canComplete || loading?.markComplete || booking?.status === 'completed'}
          onClick={() => dispatch(markServiceComplete({ bookingId }))}
          className="btn btn-success w-full gap-2 mt-1"
        >
          {loading?.markComplete ? <Spinner size={12} /> : <CheckCircle size={12} />}
          {booking?.status === 'completed' ? 'Service Already Completed' : 'Mark Service Complete'}
        </button>
      </div>
    </div>
  );
}

/* ─── REFUND PANEL ─────────────────────────────────────────────────────────── */
export function RefundPanel({ booking, dispatch }) {
  const loading = useSelector(selectAdminRefundLoading);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const alreadyRefunded = ['refunded', 'refund_pending'].includes(booking?.status) || booking?.paymentStatus === 'refunded';

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-content/80">
        <p className="font-bold m-0 mb-1">Amount paid: {currency(booking?.fareBreakdown?.amountPaid)}</p>
        <p className="m-0 opacity-75">Leave amount blank to refund full paid amount. Razorpay refund initiated automatically.</p>
      </div>

      {alreadyRefunded && (
        <div className="rounded-xl border border-info/30 bg-info/10 p-3 text-xs text-info">
          <p className="font-bold m-0">Already refunded: {currency(booking?.fareBreakdown?.refundAmount)}</p>
          <p className="m-0 opacity-75 mt-0.5">Additional refund can still be processed if needed.</p>
        </div>
      )}

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">Refund Amount (₹)</label>
        <FieldNote text={`Max refundable: ${currency(booking?.fareBreakdown?.amountPaid)}. Blank = full refund.`} />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max: ${booking?.fareBreakdown?.amountPaid ?? 0}`}
          className="input-field text-xs mt-1"
        />
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">
          Reason <span className="text-error">*</span>
        </label>
        <FieldNote text="Required for audit. Sent to Razorpay as refund note." />
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field text-xs mt-1">
          <option value="">Select reason…</option>
          {REFUND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <button disabled={loading || !reason} onClick={() => dispatch(adminProcessRefund({ bookingId: booking._id, refundAmount: amount ? parseFloat(amount) : undefined, reason }))} className="btn btn-warning w-full gap-2">
        {loading ? <Spinner size={12} /> : <DollarSign size={12} />}
        {loading ? 'Processing refund…' : 'Initiate Refund'}
      </button>
    </div>
  );
}

/* ─── CARE RIDE PANEL ──────────────────────────────────────────────────────── */
export function CareRidePanel({ booking, dispatch }) {
  const careRideNearby  = useSelector(selectCareRideNearby);
  const careRideLoading = useSelector(selectLoading('adminRequestCareRide'));
  const nearbyLoading   = useSelector(selectLoading('fetchAdminCareRideNearby'));

  const [form, setForm] = useState({
    requesterType: 'care_assistant', careAssistantId: '',
    pickupLat: '', pickupLng: '', pickupAddress: '',
    dropLat: '', dropLng: '', dropAddress: '',
  });
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => dispatch(adminRequestCareRide({
    bookingId:           booking._id,
    customerId:          booking.customer?._id ?? booking.customer,
    requesterType:       form.requesterType,
    careAssistantId:     form.careAssistantId || undefined,
    pickupLocation:      { coordinates: [parseFloat(form.pickupLng), parseFloat(form.pickupLat)], address: form.pickupAddress },
    destinationLocation: { coordinates: [parseFloat(form.dropLng),   parseFloat(form.dropLat)],   address: form.dropAddress },
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-base-300 bg-base-200/60 p-3 text-[10px] text-base-content/50">
        Creates a care ride request. Use when patient needs transport during a full-care booking. Admin-side override for care_assistant or customer requester.
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[{k:'pickupLat',ph:'Pickup Lat'},{k:'pickupLng',ph:'Pickup Lng'},{k:'dropLat',ph:'Drop Lat'},{k:'dropLng',ph:'Drop Lng'}].map(({k,ph}) => (
          <div key={k}>
            <FieldNote text={ph} />
            <input value={form[k]} onChange={(e) => upd(k, e.target.value)} placeholder={ph} className="input-field text-xs mt-0.5" />
          </div>
        ))}
      </div>

      <input value={form.pickupAddress} onChange={(e) => upd('pickupAddress', e.target.value)} placeholder="Pickup address" className="input-field text-xs" />
      <input value={form.dropAddress}   onChange={(e) => upd('dropAddress',   e.target.value)} placeholder="Drop address"   className="input-field text-xs" />

      <div className="flex gap-2">
        <select value={form.requesterType} onChange={(e) => upd('requesterType', e.target.value)} className="input-field text-xs flex-1">
          <option value="care_assistant">Care Assistant</option>
          <option value="customer">Customer</option>
        </select>
        {form.requesterType === 'care_assistant' && (
          <input value={form.careAssistantId} onChange={(e) => upd('careAssistantId', e.target.value)} placeholder="Care Asst. ID" className="input-field text-xs flex-1" />
        )}
      </div>

      <div className="flex gap-2">
        <button disabled={careRideLoading} onClick={submit} className="btn btn-primary btn-sm flex-1 gap-1.5">
          {careRideLoading ? <Spinner size={10} /> : <Plus size={10} />} Create Care Ride
        </button>
        <button disabled={nearbyLoading} onClick={() => dispatch(fetchAdminCareRideNearby({ bookingId: booking._id }))} className="btn btn-sm flex-1 gap-1.5 bg-base-300 text-base-content">
          {nearbyLoading ? <Spinner size={10} /> : <Navigation size={10} />} Find Nearby
        </button>
      </div>

      <AnimatePresence>
        {careRideNearby && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-base-300 bg-base-200 p-3 text-xs text-base-content">
            <p className="font-bold m-0 mb-1">Nearby Results</p>
            <p className="m-0 text-base-content/60 mb-2">
              {(careRideNearby.soloDrivers ?? careRideNearby.nearbyDrivers ?? []).length} solo drivers · {(careRideNearby.nearbyTPs ?? careRideNearby.transportPartners ?? []).length} TPs nearby
            </p>
            {(careRideNearby.soloDrivers ?? careRideNearby.nearbyDrivers ?? careRideNearby.agencyDrivers ?? []).slice(0, 5).map((d, i) => (
              <div key={d._id ?? d.driverId ?? i} className="flex items-center justify-between mt-2 py-1.5 border-t border-base-300/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{d.name ?? d.legalName}</span>
                  {d.phone && <CallButton phone={d.phone} label="" size="xs" />}
                </div>
                <span className="text-[10px] text-primary shrink-0">{d.distanceKm} km</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
