'use client';
import { useSelector } from 'react-redux';
import { selectRtStatus } from '@/store/slices/consultationSlice';
import { getStatusLabel, getStatusBadgeClass } from '../../utils/consultationStatus';

export function ConsultationStatusBadge() {
  const status = useSelector(selectRtStatus);
  if (!status) return null;

  return (
    <span className={`badge ${getStatusBadgeClass(status)}`}>
      {status === 'active' && (
        <span className="status-dot status-dot-success" />
      )}
      {getStatusLabel(status)}
    </span>
  );
}
