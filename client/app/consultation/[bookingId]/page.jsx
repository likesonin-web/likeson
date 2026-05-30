'use client';
import { useEffect }         from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConsultationByBooking,
  selectConsultation,
  selectConsultationLoading,
  selectConsultationError,
} from '@/store/slices/consultationSlice';
import { selectUser } from '@/store/slices/userSlice';
import { isPreRoom, isInRoom, isTerminal } from '@/utils/consultationStatus';
import { isDoctor } from '@/utils/roleHelpers';

export default function PatientBookingEntryPage() {
  const params       = useParams();
  const router       = useRouter();
  const dispatch     = useDispatch();
  const bookingId    = params.bookingId;

  const consultation = useSelector(selectConsultation);
  const loading      = useSelector(selectConsultationLoading);
  const error        = useSelector(selectConsultationError);
  const user         = useSelector(selectUser);

  useEffect(() => {
    if (bookingId) dispatch(fetchConsultationByBooking(bookingId));
  }, [bookingId, dispatch]);

  useEffect(() => {
    if (!consultation || !user) return;

    // Role guard — doctor should use doctor route
    if (isDoctor(user.role)) {
      router.replace(`/doctor/consultation/${bookingId}`);
      return;
    }

    const { status, _id } = consultation;

    // Route based on status
    if (isPreRoom(status)) {
      router.replace(`/waiting-room/${_id}`);
      return;
    }
    if (isInRoom(status)) {
      router.replace(`/consultation/room/${_id}`);
      return;
    }
    // Terminal — stay on this page (summary rendered below)
  }, [consultation, user, bookingId, router]);

  if (loading.fetch) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-lg" aria-label="Loading consultation" />
          <p className="text-sm text-base-content/60">Loading your consultation…</p>
        </div>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-sm w-full text-center flex flex-col gap-4">
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto">
            <span className="text-error text-xl">✕</span>
          </div>
          <h2 className="font-montserrat font-bold text-lg text-base-content">
            No consultation found
          </h2>
          <p className="text-sm text-base-content/60">
            {error || 'We could not find a consultation for this booking.'}
          </p>
          <button onClick={() => router.back()} className="btn btn-primary btn-sm">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Terminal status — show summary
  if (isTerminal(consultation.status)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-sm w-full text-center flex flex-col gap-4">
          <h2 className="font-montserrat font-bold text-xl text-base-content">
            Consultation {consultation.status}
          </h2>
          <p className="text-sm text-base-content/60">
            {consultation.status === 'completed'
              ? `Duration: ${consultation.actualDurationMinutes ?? 0} minutes`
              : `Reason: ${consultation.cancellationReason || 'No reason provided'}`}
          </p>
          {consultation.status === 'completed' && consultation.feedback?.patientRating && (
            <p className="text-sm text-success font-semibold">
              Feedback submitted ✓
            </p>
          )}
          <button onClick={() => router.push('/')} className="btn btn-primary btn-sm">
            Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="loading loading-lg" aria-label="Redirecting" />
    </div>
  );
}
