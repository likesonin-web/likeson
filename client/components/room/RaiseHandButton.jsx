'use client';
import { Hand } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useConsultation } from '@/providers/ConsultationSocketProvider';

export function RaiseHandButton({ consultationId }) {
  const [raised, setRaised] = useState(false);
  const { emitRaiseHand, emitLowerHand } = useConsultation();

  const toggle = useCallback(() => {
    if (raised) {
      emitLowerHand({ consultationId });
    } else {
      emitRaiseHand({ consultationId });
    }
    setRaised((v) => !v);
  }, [raised, consultationId, emitRaiseHand, emitLowerHand]);

  return (
    <button
      onClick={toggle}
      className={`btn btn-circle ${raised ? 'bg-warning/10 text-warning border border-warning/40' : 'btn-ghost border border-base-300'}`}
      aria-label={raised ? 'Lower hand' : 'Raise hand'}
      aria-pressed={raised}
    >
      <Hand size={18} />
    </button>
  );
}
