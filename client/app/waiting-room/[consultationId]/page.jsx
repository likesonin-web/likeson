'use client';
import { useEffect }         from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector }       from 'react-redux';
import { selectUser }        from '@/store/slices/userSlice';
import { PatientWaitingRoom } from '@/components/waiting-room/PatientWaitingRoom';
import { isDoctor }          from '@/utils/roleHelpers';

export default function WaitingRoomPage() {
  const params         = useParams();
  const router         = useRouter();
  const consultationId = params.consultationId;
  const user           = useSelector(selectUser);

  useEffect(() => {
    if (!user) return;
    // Doctors never go to waiting room — redirect to doctor room
    if (isDoctor(user.role)) {
      router.replace(`/doctor/consultation/room/${consultationId}`);
    }
  }, [user, consultationId, router]);

  return <PatientWaitingRoom consultationId={consultationId} />;
}
