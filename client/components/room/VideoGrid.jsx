'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { LocalVideoTile }  from './LocalVideoTile';
import { RemoteVideoTile } from './RemoteVideoTile';
import { isScreenShareUser } from '../../utils/agoraHelpers';

// Grid classes keyed by total tile count
const GRID_CLASSES = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2',
  4: 'grid-cols-2',
  5: 'grid-cols-2 lg:grid-cols-3',
  6: 'grid-cols-2 lg:grid-cols-3',
};
const getGrid = (n) => GRID_CLASSES[Math.min(n, 6)] || 'grid-cols-3 lg:grid-cols-4';

export function VideoGrid({ localTracks, remoteUsers, localName, role }) {
  const remoteList    = Object.entries(remoteUsers);
  const screenShare   = remoteList.find(([uid]) => isScreenShareUser(Number(uid)));
  const regularUsers  = remoteList.filter(([uid]) => !isScreenShareUser(Number(uid)));
  const totalTiles    = 1 + regularUsers.length;

  /* ── Screen share layout ─────────────────────────────────────── */
  if (screenShare) {
    const [screenUid, screenData] = screenShare;
    return (
      <div className="flex flex-col h-full gap-2 p-2">
        {/* Main area — screen */}
        <motion.div
          className="flex-1 min-h-0 relative bg-base-300 rounded-2xl overflow-hidden"
          layout
        >
          <RemoteVideoTile
            uid={Number(screenUid)}
            videoTrack={screenData.videoTrack}
            audioTrack={screenData.audioTrack}
            className="w-full h-full"
            label="Screen Share"
          />
          <div className="absolute top-3 left-3 badge badge-info badge-sm gap-1">
            <span>🖥</span> Screen Share
          </div>
        </motion.div>

        {/* Participant strip */}
        <div
          className="flex gap-2 shrink-0 overflow-x-auto pb-1"
          style={{ height: '120px' }}
        >
          <AnimatePresence>
            <motion.div
              key="local"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-40 h-full shrink-0"
            >
              <LocalVideoTile
                videoTrack={localTracks.localVideoTrack}
                isMicOn={localTracks.isMicOn}
                isCamOn={localTracks.isCamOn}
                name={localName}
                className="w-full h-full rounded-xl"
              />
            </motion.div>

            {regularUsers.map(([uid, data]) => (
              <motion.div
                key={uid}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-40 h-full shrink-0"
              >
                <RemoteVideoTile
                  uid={Number(uid)}
                  videoTrack={data.videoTrack}
                  audioTrack={data.audioTrack}
                  className="w-full h-full rounded-xl"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  /* ── Normal grid layout ──────────────────────────────────────── */
  return (
    <div className={`grid ${getGrid(totalTiles)} gap-2 p-2 h-full`}>
      <AnimatePresence>
        <motion.div
          key="local"
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-[120px]"
        >
          <LocalVideoTile
            videoTrack={localTracks.localVideoTrack}
            isMicOn={localTracks.isMicOn}
            isCamOn={localTracks.isCamOn}
            name={localName}
            className="w-full h-full rounded-2xl"
          />
        </motion.div>

        {regularUsers.map(([uid, data]) => (
          <motion.div
            key={uid}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="min-h-[120px]"
          >
            <RemoteVideoTile
              uid={Number(uid)}
              videoTrack={data.videoTrack}
              audioTrack={data.audioTrack}
              className="w-full h-full rounded-2xl"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}