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

export default function PatientRoomPage() {
  const params         = useParams();
  const router         = useRouter();
  const dispatch       = useDispatch();
  const consultationId = params.consultationId;

  const consultation = useSelector(selectConsultation);
  const loading      = useSelector(selectConsultationLoading);
  const user         = useSelector(selectUser);

  // FIX: same as doctor page — fetch so Redux has consultation (with bookingId)
  // before useConsultationRoom's Step 2 effect fires.
  useEffect(() => {
    if (consultationId) dispatch(fetchConsultationById(consultationId));
  }, [consultationId, dispatch]);

  useEffect(() => {
    if (!user) return;
    if (isDoctor(user.role)) {
      router.replace(`/doctor/consultation/room/${consultationId}`);
    }
  }, [user, consultationId, router]);

  // Wait until fetch done AND consultation matches current consultationId.
  const isReady = !loading.fetch && consultation && String(consultation._id) === String(consultationId);

  if (!isReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center" data-theme="customer">
        <div className="loading loading-lg" aria-label="Loading room" />
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden" data-theme="customer">
      <ConsultationRoom role="customer" consultationId={consultationId} />
    </div>
  );
}
