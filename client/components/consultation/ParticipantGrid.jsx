// FILE: components/consultation/ParticipantGrid.jsx (NEW)
import { useMemo } from 'react';

export default function ParticipantGrid({ participants, screenSharingUserId, localVideoRef, remoteVideoRefs }) {
  const isScreenSharing = !!screenSharingUserId;
  const connectedPeers  = Object.values(participants).filter(p => p.connectionStatus === 'connected');

  const gridClass = useMemo(() => {
    if (isScreenSharing) return 'grid-cols-1'; // screen share = full width, others in strip
    const count = connectedPeers.length + 1; // +1 for local
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  }, [isScreenSharing, connectedPeers.length]);

  if (isScreenSharing) {
    return (
      <div className="flex flex-col h-full gap-2">
        {/* Main screen share view */}
        <div className="flex-1 bg-gray-900 rounded-2xl overflow-hidden relative">
          <div ref={el => { if (remoteVideoRefs) remoteVideoRefs.current[screenSharingUserId + '_screen'] = el; }}
               className="w-full h-full" />
          <div className="absolute bottom-3 left-3 bg-black/60 rounded-lg px-2 py-1 text-white text-xs">
            🖥️ {participants[screenSharingUserId]?.name || 'Screen Share'}
          </div>
        </div>
        {/* Participant strip */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ maxHeight: '140px' }}>
          <ParticipantCard local videoRef={localVideoRef} label="You" size="sm" />
          {connectedPeers.map(p => (
            <ParticipantCard
              key={p.userId}
              participant={p}
              videoRef={el => { if (remoteVideoRefs) remoteVideoRefs.current[p.userId] = el; }}
              size="sm"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid ${gridClass} gap-2 h-full`}>
      <ParticipantCard local videoRef={localVideoRef} label="You" />
      {connectedPeers.map(p => (
        <ParticipantCard
          key={p.userId}
          participant={p}
          videoRef={el => { if (remoteVideoRefs) remoteVideoRefs.current[p.userId] = el; }}
        />
      ))}
    </div>
  );
}

function ParticipantCard({ participant, local, videoRef, label, size = 'md' }) {
  const name  = label || participant?.name || 'Unknown';
  const muted = participant?.isMutedByHost;
  const cam   = local ? true : participant?.cameraEnabled;

  const sizeClass = size === 'sm'
    ? 'w-32 h-28 flex-shrink-0'
    : 'w-full h-full min-h-[120px]';

  return (
    <div className={`${sizeClass} relative bg-gray-800 rounded-2xl overflow-hidden`}>
      <div ref={videoRef} className="w-full h-full" />
      {!cam && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-14 h-14 rounded-full bg-gray-600 flex items-center justify-center text-2xl text-white font-bold">
            {name[0]?.toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full truncate max-w-[80%]">{name}</span>
        {muted && (
          <span className="bg-red-500/80 rounded-full p-1">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3.707 2.293L2.293 3.707l18 18 1.414-1.414zM12 1a4 4 0 014 4v.586l-2-2V5a2 2 0 00-4 0v4.586l-5.293-5.293A4 4 0 0112 1zM8 9.414V11a4 4 0 008 0v-.586L8 9.414zM4 12.5a.5.5 0 01.5-.5H6a.5.5 0 010 1H5v5h14v-5h-1a.5.5 0 010-1h1.5a.5.5 0 01.5.5V19a.5.5 0 01-.5.5H3.5A.5.5 0 013 19v-6.5z"/>
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}