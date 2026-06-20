/**
 * components/chat/ConversationInfo.jsx
 * Right-side info panel: participants, settings, media gallery, role permissions.
 */
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Users,
  Bell,
  BellOff,
  Archive,
  Trash2,
  Shield,
  Crown,
  UserMinus,
  UserPlus,
  Lock,
  Image,
  Search,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Phone,
  Video,
  Pin,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "@/store/slices/userSlice";
import { selectUserPresence } from "@/store/slices/chatSlice";

// Role capabilities
const ROLE_CAPS = {
  superadmin:       { canCall: true,  canAdmin: true,  canDelete: true,  canAddMembers: true,  canViewMedia: true },
  admin:            { canCall: true,  canAdmin: true,  canDelete: true,  canAddMembers: true,  canViewMedia: true },
  doctor:           { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: true,  canViewMedia: true },
  hospital:         { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: true,  canViewMedia: true },
  customer:         { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: true },
  pharmacy:         { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: true },
  lab_partner:      { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: true },
  blood_bank:       { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: true },
  driver:           { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: false },
  solodriverpartner:{ canCall: true,  canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: false },
  transportpartner: { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: false },
  care_assistant:   { canCall: true,  canAdmin: false, canDelete: false, canAddMembers: true,  canViewMedia: true },
  finance:          { canCall: false, canAdmin: false, canDelete: false, canAddMembers: false, canViewMedia: true },
};

function SectionHeader({ title, expanded, onToggle }) {
  return (
    <button 
      className="flex items-center justify-between w-full p-4 font-poppins font-semibold text-sm text-base-content hover:bg-base-200 transition-colors" 
      onClick={onToggle}
    >
      <span>{title}</span>
      <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
        <ChevronDown size={16} />
      </motion.div>
    </button>
  );
}

function ParticipantRow({
  participant,
  currentUserId,
  currentUserIsAdmin,
  caps,
  onToggleAdmin,
  onRemove,
  onBlock,
  onDM,
}) {
  const [menu, setMenu] = useState(false);
  const user = participant.user || {};
  const userId = user._id || user;
  const name = user.name || "User";
  const isMe = userId === currentUserId;
  const isAdmin = participant.isAdmin;
  const presence = useSelector(selectUserPresence(userId));

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-base-200 transition-colors group">
      <div className="relative w-10 h-10 rounded-full flex-shrink-0 bg-base-300">
        {user.avatar ? (
          <img src={user.avatar} alt={name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
            {name[0]?.toUpperCase()}
          </div>
        )}
        {presence?.isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-base-100" />}
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm font-semibold text-base-content truncate">
          {name} {isMe && <span className="text-base-content/50 font-normal ml-1">(You)</span>}
        </span>
        <span className="text-xs text-base-content/60 capitalize truncate">{user.role || participant.role}</span>
      </div>

      <div className="flex items-center">
        {isAdmin && (
          <span className="text-warning" title="Group admin">
            <Crown size={14} />
          </span>
        )}
      </div>

      {!isMe && (
        <div className="relative">
          <button
            className="p-1 rounded-field text-base-content/60 hover:text-base-content hover:bg-base-300 transition-colors"
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal size={16} />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                className="absolute right-0 top-full mt-1 w-40 bg-base-100 shadow-depth rounded-box z-50 border border-base-200 overflow-hidden py-1"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <button 
                  className="w-full text-left px-4 py-2 text-sm font-poppins text-base-content hover:bg-base-200 transition-colors" 
                  onClick={() => { onDM(userId); setMenu(false); }}
                >
                  Message
                </button>
                {currentUserIsAdmin && (
                  <button
                    className="w-full text-left px-4 py-2 text-sm font-poppins text-base-content hover:bg-base-200 transition-colors"
                    onClick={() => { onToggleAdmin(userId, !isAdmin); setMenu(false); }}
                  >
                    {isAdmin ? "Remove Admin" : "Make Admin"}
                  </button>
                )}
                {currentUserIsAdmin && (
                  <button
                    className="w-full text-left px-4 py-2 text-sm font-poppins text-error hover:bg-error/10 transition-colors"
                    onClick={() => { onRemove(userId); setMenu(false); }}
                  >
                    Remove
                  </button>
                )}
                {caps.canAdmin && (
                  <button
                    className="w-full text-left px-4 py-2 text-sm font-poppins text-error hover:bg-error/10 transition-colors"
                    onClick={() => { onBlock(userId); setMenu(false); }}
                  >
                    Block User
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MediaGallery({ media, onLoad }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) { onLoad(); setLoaded(true); }
  }, []);

  const images = media.filter((m) => m.type === "image");

  if (!images.length) {
    return <p className="text-center text-sm text-base-content/50 py-6">No media shared yet.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {images.slice(0, 9).map((m) => (
        <a key={m._id} href={m.media?.url} target="_blank" rel="noopener noreferrer">
          <img
            src={m.media?.thumbnail || m.media?.url}
            alt="Shared media"
            className="w-full aspect-square object-cover rounded-field hover:opacity-90 transition-opacity bg-base-300"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}

export default function ConversationInfo({
  conversation,
  media,
  onClose,
  onArchive,
  onMute,
  onClear,
  onBlock,
  onRemoveMember,
  onToggleAdmin,
  onAddMembers,
  onDM,
  onInitiateCall,
  onSearch,
  onLoadMedia,
}) {
  const currentUser = useSelector(selectCurrentUser);
  const currentUserId = currentUser?._id;
  const role = currentUser?.role || "customer";
  const caps = ROLE_CAPS[role] || ROLE_CAPS.customer;

  const [sections, setSections] = useState({
    members: true,
    media: false,
    settings: true,
  });

  const toggle = (s) => setSections((prev) => ({ ...prev, [s]: !prev[s] }));

  if (!conversation) return null;

  const isGroup = conversation.type !== "direct";
  const participants = conversation.participants?.filter((p) => !p.isDeleted) || [];
  const me = participants.find((p) => (p.user?._id || p.user) === currentUserId);
  const iAmAdmin = me?.isAdmin || caps.canAdmin;

  const otherUser = !isGroup
    ? participants.find((p) => (p.user?._id || p.user) !== currentUserId)?.user
    : null;

  const isMuted = me?.isMuted;
  const title = isGroup ? conversation.name : otherUser?.name || "Chat";
  const subtitle = isGroup
    ? `${participants.length} member${participants.length !== 1 ? "s" : ""}`
    : otherUser?.role || "";

  return (
    <motion.div
      className="flex flex-col w-full h-full bg-base-100 font-poppins text-base-content"
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-base-300 flex-shrink-0">
        <h3 className="font-montserrat text-lg font-bold">Details</h3>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center p-6 border-b border-base-300 text-center flex-shrink-0">
        <div className="w-24 h-24 rounded-full mb-4 relative shadow-sm">
          {(isGroup ? conversation.avatar : otherUser?.avatar) ? (
            <img
              src={isGroup ? conversation.avatar : otherUser?.avatar}
              alt={title}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold">
              {isGroup ? <Users size={32} /> : title[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <h4 className="font-montserrat text-xl font-bold text-base-content mb-1">{title}</h4>
        {subtitle && <p className="text-sm text-base-content/60 mb-2 capitalize">{subtitle}</p>}
        {conversation.description && (
          <p className="text-sm text-base-content/80 max-w-xs mb-4">{conversation.description}</p>
        )}

{/* Quick actions */}
        <div className="flex items-center justify-center gap-6 mt-2">
          <button
            className="flex flex-col items-center gap-2 text-sm text-base-content/70 hover:text-primary transition-colors"
            onClick={() => onSearch()}
            title="Search messages"
          >
            <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center group-hover:bg-primary/10">
              <Search size={18} />
            </div>
            <span>Search</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Members section */}
        {isGroup && (
          <div className="border-b border-base-300 last:border-0">
            <SectionHeader
              title={`Members (${participants.length})`}
              expanded={sections.members}
              onToggle={() => toggle("members")}
            />
            <AnimatePresence>
              {sections.members && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {participants.map((p) => (
                    <ParticipantRow
                      key={p.user?._id || p.user}
                      participant={p}
                      currentUserId={currentUserId}
                      currentUserIsAdmin={iAmAdmin}
                      caps={caps}
                      onToggleAdmin={(uid, isAdmin) =>
                        onToggleAdmin(conversation._id, uid, isAdmin)
                      }
                      onRemove={(uid) => onRemoveMember(conversation._id, uid)}
                      onBlock={onBlock}
                      onDM={onDM}
                    />
                  ))}
                  {iAmAdmin && (
                    <button
                      className="flex items-center gap-2 w-full p-4 text-sm font-medium text-primary hover:bg-base-200 transition-colors"
                      onClick={() => onAddMembers(conversation._id)}
                    >
                      <UserPlus size={16} /> Add Members
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Media section */}
        {caps.canViewMedia && (
          <div className="border-b border-base-300 last:border-0">
            <SectionHeader
              title="Shared Media"
              expanded={sections.media}
              onToggle={() => toggle("media")}
            />
            <AnimatePresence>
              {sections.media && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <MediaGallery
                    media={media || []}
                    onLoad={() => onLoadMedia(conversation._id)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Settings section */}
        <div className="border-b border-base-300 last:border-0">
          <SectionHeader
            title="Settings"
            expanded={sections.settings}
            onToggle={() => toggle("settings")}
          />
          <AnimatePresence>
            {sections.settings && (
              <motion.div
                className="p-2 flex flex-col gap-1 overflow-hidden"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <button
                  className="flex items-center gap-3 w-full p-3 text-sm font-medium text-base-content rounded-field hover:bg-base-200 transition-colors"
                  onClick={() => onMute(conversation._id, !isMuted)}
                >
                  {isMuted ? <Bell size={16} /> : <BellOff size={16} />}
                  <span>{isMuted ? "Unmute notifications" : "Mute notifications"}</span>
                </button>

                <button
                  className="flex items-center gap-3 w-full p-3 text-sm font-medium text-base-content rounded-field hover:bg-base-200 transition-colors"
                  onClick={() => onArchive(conversation._id)}
                >
                  <Archive size={16} />
                  <span>Archive conversation</span>
                </button>

                <button
                  className="flex items-center gap-3 w-full p-3 text-sm font-medium text-error rounded-field hover:bg-error/10 transition-colors"
                  onClick={() => onClear(conversation._id)}
                >
                  <Trash2 size={16} />
                  <span>Clear chat history</span>
                </button>

                {!isGroup && (
                  <button
                    className="flex items-center gap-3 w-full p-3 text-sm font-medium text-error rounded-field hover:bg-error/10 transition-colors"
                    onClick={() => {
                      const otherId = otherUser?._id || otherUser;
                      if (otherId) onBlock(otherId);
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>Block user</span>
                  </button>
                )}

                {caps.canAdmin && (
                  <div className="flex items-center gap-3 w-full p-3 text-sm font-medium text-base-content/60 rounded-field cursor-default">
                    <Shield size={16} />
                    <span>Admin controls enabled</span>
                  </div>
                )}

                {conversation.type !== "direct" && conversation.refModel && (
                  <div className="flex items-center gap-3 w-full p-3 text-sm font-medium text-base-content/60 rounded-field cursor-default">
                    <ExternalLink size={16} />
                    <span>Linked to {conversation.refModel} #{conversation.refId?.toString().slice(-6)}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}