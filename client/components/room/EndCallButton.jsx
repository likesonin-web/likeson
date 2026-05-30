'use client';
import { PhoneOff } from 'lucide-react';

export function EndCallButton({ onClick, role }) {
  const isHost = role === 'doctor' || role === 'admin';
  return (
    <button
      onClick={onClick}
      className="btn btn-circle bg-error text-error-content border-error hover:brightness-110 shadow-sm"
      aria-label={isHost ? 'End consultation' : 'Leave consultation'}
    >
      <PhoneOff size={18} />
    </button>
  );
}
