'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { MicOff, Monitor } from 'lucide-react';
import { selectRtParticipants, selectRtScreenSharing } from '@/store/slices/consultationSlice';

function VideoTile({ track, isMicOn = true, isCamOn = true, name = '', isLocal = false, isSmall = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!track || !ref.current) return;
    if (isCamOn) {
      track.play(ref.current);
    } else {
      track.stop();
    }
    return () => { try { track.stop(); } catch {} };
  }, [track, isCamOn]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gray-900 w-full h-full flex items-center justify-center ${isSmall ? 'min-h-[80px]' : 'min-h-[120px]'}`}>
      <div ref={ref} className="w-full h-full absolute inset-0" style={{ display: isCamOn && track ? 'block' : 'none' }} />
      {(!isCamOn || !track) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className={`rounded-full bg-gray-600 flex items-center justify-center font-bold text-white ${isSmall ? 'w-10 h-10 text-base' : 'w-16 h-16 text-2xl'}`}>
            {(name || '?')[0]?.toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full truncate max-w-[70%] flex items-center gap-1">
          {!isMicOn && <MicOff size={10} className="text-red-400 flex-shrink-0" />}
          {name}
          {isLocal && <span className="ml-1 opacity-60">(You)</span>}
        </span>
      </div>
    </div>
  );
}

function RemoteTile({ user, name, isSmall = false }) {
  const ref = useRef(null);
  const rtParticipants = useSelector(selectRtParticipants);
  const participantData = Object.values(rtParticipants).find(
    p => String(p.agoraUid) === String(user.uid) || String(p.userId) === String(user.uid)
  );
  const isMicOn = !participantData?.isMutedByHost;

  useEffect(() => {
    if (!user.videoTrack || !ref.current) return;
    user.videoTrack.play(ref.current);
    return () => { try { user.videoTrack.stop(); } catch {} };
  }, [user.videoTrack]);

  const hasVideo = !!user.videoTrack;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gray-900 w-full h-full flex items-center justify-center ${isSmall ? 'min-h-[80px]' : 'min-h-[120px]'}`}>
      <div ref={ref} className="w-full h-full absolute inset-0" style={{ display: hasVideo ? 'block' : 'none' }} />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className={`rounded-full bg-gray-600 flex items-center justify-center font-bold text-white ${isSmall ? 'w-10 h-10 text-base' : 'w-16 h-16 text-2xl'}`}>
            {(name || '?')[0]?.toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full truncate max-w-[70%] flex items-center gap-1">
          {!isMicOn && <MicOff size={10} className="text-red-400 flex-shrink-0" />}
          {name}
        </span>
      </div>
    </div>
  );
}

function ScreenShareTile({ track }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!track || !ref.current) return;
    track.play(ref.current, { fit: 'contain' });
    return () => { try { track.stop(); } catch {} };
  }, [track]);

  return (
    <div className="relative w-full h-full rounded-2xl bg-black overflow-hidden flex items-center justify-center">
      <div ref={ref} className="w-full h-full" style={{ aspectRatio: 'auto' }} />
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
        <Monitor size={12} /> Screen Share
      </div>
    </div>
  );
}

export function VideoGrid({ localTracks, remoteUsers, localName, doctorName, patientName, role }) {
  const rtScreenSharing = useSelector(selectRtScreenSharing);
  const [mobileHideParticipants, setMobileHideParticipants] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const remoteArr = Object.values(remoteUsers || {});

  // Separate screen share tracks from camera tracks
  // Screen share UIDs are > 100_000 (from agoraHelpers: getScreenShareUid = uid + 100_000)
  const screenShareUser = remoteArr.find(u => u.uid > 100000 && u.videoTrack);
  const cameraUsers = remoteArr.filter(u => u.uid <= 100000);

  const isScreenSharing = !!screenShareUser;
  const totalParticipants = cameraUsers.length + 1; // +1 for local

  // ── SCREEN SHARE LAYOUT ──
  if (isScreenSharing) {
    const participantStrip = (
      <div className={`flex ${isMobile ? 'flex-row overflow-x-auto gap-2' : 'flex-col gap-2 overflow-y-auto'}`}
        style={isMobile ? {} : { width: 180, minWidth: 180, maxWidth: 180 }}>
        <div style={isMobile ? { width: 120, minWidth: 120, height: 90 } : { height: 120 }}>
          <VideoTile
            track={localTracks.localVideoTrack}
            isMicOn={localTracks.isMicOn}
            isCamOn={localTracks.isCamOn}
            name={localName}
            isLocal
            isSmall
          />
        </div>
        {cameraUsers.map(u => (
          <div key={u.uid} style={isMobile ? { width: 120, minWidth: 120, height: 90 } : { height: 120 }}>
            <RemoteTile user={u} name={u.uid <= 100000 ? (role === 'doctor' ? patientName : doctorName) : ''} isSmall />
          </div>
        ))}
      </div>
    );

    if (isMobile) {
      return (
        <div className="flex flex-col w-full h-full gap-2">
          <div className="flex-1 min-h-0">
            <ScreenShareTile track={screenShareUser.videoTrack} />
          </div>
          {!mobileHideParticipants && (
            <div className="flex-shrink-0" style={{ height: 100 }}>
              {participantStrip}
            </div>
          )}
          <button
            onClick={() => setMobileHideParticipants(v => !v)}
            className="absolute bottom-20 right-3 z-20 bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1"
          >
            {mobileHideParticipants ? 'Show' : 'Hide'} cameras
          </button>
        </div>
      );
    }

    return (
      <div className="flex w-full h-full gap-2">
        <div className="flex-1 min-w-0 h-full">
          <ScreenShareTile track={screenShareUser.videoTrack} />
        </div>
        {participantStrip}
      </div>
    );
  }

  // ── NORMAL VIDEO GRID ──
  const gridClass = (() => {
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  })();

  return (
    <div className={`grid ${gridClass} gap-2 w-full h-full`}>
      <VideoTile
        track={localTracks.localVideoTrack}
        isMicOn={localTracks.isMicOn}
        isCamOn={localTracks.isCamOn}
        name={localName}
        isLocal
      />
      {cameraUsers.map(u => (
        <RemoteTile
          key={u.uid}
          user={u}
          name={role === 'doctor' ? patientName : doctorName}
        />
      ))}
    </div>
  );
}