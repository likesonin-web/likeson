'use client';
import { useEffect }         from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConsultationById,
  selectConsultation,
  selectConsultationLoading,
} from '@/store/slices/consultationSlice';
import { selectUser } from '@/store/slices/userSlice';
import { ConsultationRoom } from '@/components/room/ConsultationRoom';
import { isDoctor } from '@/utils/roleHelpers';

export default function DoctorRoomPage() {
  const params         = useParams();
  const router         = useRouter();
  const dispatch       = useDispatch();
  const consultationId = params.consultationId;

  const consultation = useSelector(selectConsultation);
  const loading      = useSelector(selectConsultationLoading);
  const user         = useSelector(selectUser);

  // FIX: always fetch so Redux has consultation (with bookingId) before
  // useConsultationRoom's Step 2 effect fires. Without this, bookingId is
  // undefined and the socket room join is silently skipped → Agora never joins.
  useEffect(() => {
    if (consultationId) dispatch(fetchConsultationById(consultationId));
  }, [consultationId, dispatch]);

  useEffect(() => {
    if (!user) return;
    if (!isDoctor(user.role)) {
      router.replace(`/consultation/room/${consultationId}`);
    }
  }, [user, consultationId, router]);

  // Wait until both fetch is done AND consultation matches current ID.
  // Prevents stale consultation from a previous booking leaking bookingId.
  const isReady = !loading.fetch && consultation && String(consultation._id) === String(consultationId);

  if (!isReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center" data-theme="doctor">
        <div className="loading loading-lg" aria-label="Loading room" />
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden" data-theme="doctor">
      <ConsultationRoom role="doctor" consultationId={consultationId} />
    </div>
  );
}
