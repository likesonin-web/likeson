'use client';
import { motion } from 'framer-motion';
import { X, Users, Clock, FileText, Paperclip, StickyNote } from 'lucide-react';
import { ParticipantsPanel } from './ParticipantsPanel';
import { WaitingRoomPanel }  from './WaitingRoomPanel';
import { PrescriptionPanel } from './PrescriptionPanel';
import { AttachmentsPanel, DoctorNotesPanel } from './SidebarPanels';
import { isDoctor, canPrescribe, canSeeDoctorNotes } from '../../utils/roleHelpers';
import { useSelector } from 'react-redux';
import { selectRtWaitingQueue } from '@/store/slices/consultationSlice';

const TABS = {
  participants: { label: 'People',     icon: Users,     roles: ['all'] },
  waiting:      { label: 'Waiting',    icon: Clock,     roles: ['doctor', 'admin', 'superadmin'] },
  prescription: { label: 'Rx',         icon: FileText,  roles: ['doctor'] },
  attachments:  { label: 'Files',      icon: Paperclip, roles: ['all'] },
  notes:        { label: 'Notes',      icon: StickyNote, roles: ['doctor', 'admin', 'superadmin'] },
};

export function ConsultationSidebar({
  role,
  consultationId,
  activeTab,
  onTabChange,
  onClose,
  onKickRequest,
  userId,
}) {
  const waitingQueue   = useSelector(selectRtWaitingQueue);
  const waitingCount   = Object.values(waitingQueue).filter(
    (e) => e.waitingRoomStatus === 'waiting'
  ).length;

  const visibleTabs = Object.entries(TABS).filter(([key, tab]) =>
    tab.roles.includes('all') || tab.roles.includes(role)
  );

  return (
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{   x: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className="consultation-sidebar"
      aria-label="Consultation sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
        <h2 className="font-montserrat font-bold text-sm text-base-content">
          Session Details
        </h2>
        <button
          onClick={onClose}
          className="btn btn-xs btn-circle btn-ghost"
          aria-label="Close sidebar"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-base-300 shrink-0 overflow-x-auto scrollbar-thin">
        {visibleTabs.map(([key, tab]) => {
          const Icon      = tab.icon;
          const isActive  = activeTab === key;
          const showBadge = key === 'waiting' && waitingCount > 0;

          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors relative flex-1 justify-center ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-base-content/50 hover:text-base-content'
              }`}
              aria-label={tab.label}
              aria-selected={isActive}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {showBadge && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-warning text-warning-content text-xs flex items-center justify-center font-bold">
                  {waitingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'participants' && (
          <ParticipantsPanel
            consultationId={consultationId}
            viewerRole={role}
            onKickRequest={onKickRequest}
          />
        )}
        {activeTab === 'waiting' && isDoctor(role) && (
          <WaitingRoomPanel consultationId={consultationId} />
        )}
        {activeTab === 'prescription' && canPrescribe(role) && (
          <PrescriptionPanel consultationId={consultationId} />
        )}
        {activeTab === 'attachments' && (
          <AttachmentsPanel consultationId={consultationId} userId={userId} />
        )}
        {activeTab === 'notes' && canSeeDoctorNotes(role) && (
          <DoctorNotesPanel consultationId={consultationId} />
        )}
      </div>
    </motion.aside>
  );
}
