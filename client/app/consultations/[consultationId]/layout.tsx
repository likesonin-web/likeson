'use client';
import { ReactNode } from 'react';
import { ConsultationSocketProvider } from '@/provider/ConsultationSocketProvider';
import { useSelector } from 'react-redux';

interface Props {
  children: ReactNode;
  params: { consultationId: string };
}

interface RootState {
  auth: { token: string | null };
}


interface ConsultationSocketProviderProps {
  children: ReactNode;
  token: string;
  consultationId: string;
  autoJoin?: boolean;
  autoRequestState?: boolean;
  // Add '?' to make these optional
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

// Inner component handles hook usage
function ConsultationLayoutInner({
  children,
  consultationId,
}: {
  children: ReactNode;
  consultationId: string;
}) {
  const token = useSelector((state: RootState) => state.auth.token);

  return (
   <ConsultationSocketProvider
  token={token ?? ''}
  consultationId={consultationId}
  autoJoin={false}
  onConnect={() => console.log('Connected')}
  onDisconnect={() => console.log('Disconnected')}
  onError={(err: RootState) => console.error(err)}
>
  {children}
</ConsultationSocketProvider>
  );
}

export default function ConsultationLayout({ children, params }: Props) {
  return (
    <ConsultationLayoutInner consultationId={params.consultationId}>
      {children}
    </ConsultationLayoutInner>
  );
}