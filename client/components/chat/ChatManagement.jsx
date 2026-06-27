'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageCircle } from 'lucide-react';
import {
  useChat,
  useConversationMessages,
  useConversationMessagesLoading,
  useConversationHasMore,
  useConversationTyping,
  useConversationPinned,
  useConversationUploadProgress,
} from '@/hooks/useChat';
import { useChatPermissions } from '@/hooks/useChatPermissions';
import ConversationSidebar from './ConversationSidebar';
import ChatWindow from './ChatWindow';
import EmptyState from './EmptyState';
import NewConversationModal from './NewConversationModal';
import GroupInfoModal from './GroupInfoModal';
import PinnedMessagesModal from './PinnedMessagesModal';
import MediaGalleryModal from './MediaGalleryModal';
import ForwardModal from './ForwardModal';
import IncomingCallModal from './IncomingCallModal';
import CallModal from './CallModal';
import CallHistoryModal from './CallHistoryModal';

export default function ChatManagement({ directoryUsers = [], activeId }) {
  const chat = useChat();
  const router = useRouter();
  const {
    conversations, conversationsLoading, activeConversationId, activeConversation,
    currentUser, incomingCall, activeCall, callHistory,
  } = chat;

  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  // Sync URL → Redux on mount/change
  useEffect(() => {
    if (!activeId) return;
    chat.selectConversation(activeId);
    setMobileView('chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState(null);

  const messages = useConversationMessages(activeConversationId);
  const msgsLoading = useConversationMessagesLoading(activeConversationId);
  const hasMore = useConversationHasMore(activeConversationId);
  const typingUsers = useConversationTyping(activeConversationId);
  const pinned = useConversationPinned(activeConversationId);
  const uploadProgress = useConversationUploadProgress(activeConversationId);

  const permissions = useChatPermissions(activeConversation, currentUser);

  const handleSelectConversation = useCallback(
    (id) => {
      router.push(`/chat/${id}`);
    },
    [router],
  );

  const handleBack = useCallback(() => {
    chat.closeConversation();
    setMobileView('list');
    router.push('/chat');
  }, [chat, router]);

  const handleLoadMore = useCallback(() => {
    if (!messages.length) return;
    chat.loadMoreMessages(activeConversationId, messages[0]._id);
  }, [chat, activeConversationId, messages]);

  const handleJumpToMessage = useCallback((messageId) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleStartDirect = useCallback(
    async (userId) => {
      const convo = await chat.startDM(userId);
      handleSelectConversation(convo._id);
      setNewChatOpen(false);
    },
    [chat, handleSelectConversation],
  );

  const handleStartGroup = useCallback(
    async (payload) => {
      const convo = await chat.startGroup(payload);
      handleSelectConversation(convo._id);
      setNewChatOpen(false);
    },
    [chat, handleSelectConversation],
  );

  const handleCall = useCallback(
    (type) => {
      if (!activeConversationId) return;
      chat.initiateCall(activeConversationId, type).catch(() => {});
    },
    [chat, activeConversationId],
  );

  // Find the conversation for an active/incoming call (may differ from active convo)
  const activeCallConversation = useMemo(
    () =>
      conversations.find(
        (c) => c._id === (activeCall?.conversationId || incomingCall?.conversationId),
      ) || activeConversation,
    [conversations, activeCall, incomingCall, activeConversation],
  );

  // Get the other participant for blocking
  const otherParticipant = useMemo(() => {
    if (!activeConversation || !currentUser) return null;
    return activeConversation.participants?.find(
      (p) => (p.user?._id || p.user)?.toString() !== currentUser._id?.toString(),
    );
  }, [activeConversation, currentUser]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-base-100">
      <div className="grid h-full md:grid-cols-[360px_1fr]">
        {/* Sidebar */}
        <div className={`h-full border-r border-base-300 ${mobileView === 'chat' ? 'hidden md:block' : 'block'}`}>
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            currentUser={currentUser}
            onSelect={handleSelectConversation}
            onNewChat={() => setNewChatOpen(true)}
            onOpenCallHistory={() => setCallHistoryOpen(true)}
            loading={conversationsLoading}
          />
        </div>

        {/* Chat panel */}
        <div className={`h-full ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              currentUser={currentUser}
              permissions={permissions}
              messages={messages}
              hasMore={hasMore}
              loadingMore={msgsLoading}
              typingUserIds={typingUsers}
              uploadProgress={uploadProgress}
              pinnedMessages={pinned}
              onLoadMore={handleLoadMore}
              onSendMessage={chat.sendMessage}
              onSendMedia={chat.sendMedia}
              onTyping={chat.sendTyping}
              onEditMessage={chat.editMessage}
              onDeleteMessage={chat.deleteMessage}
              onReactMessage={chat.reactToMessage}
              onPinMessage={chat.pinMessage}
              onMarkRead={chat.markAsRead}
              onBack={handleBack}
              onCall={() => handleCall('audio')}
              onVideoCall={() => handleCall('video')}
              onOpenInfo={() => {
                if (activeConversation.type === 'group') setGroupInfoOpen(true);
              }}
              onMute={(mute) => chat.muteConversation(activeConversationId, mute)}
              onArchive={() => chat.archiveConversation(activeConversationId, true)}
              onClear={() => chat.clearConversation(activeConversationId)}
              onBlock={() => {
                if (otherParticipant?.user?._id) {
                  chat.blockUser(otherParticipant.user._id);
                }
              }}
              onOpenPinned={() => setPinnedOpen(true)}
              onOpenMedia={() => setMediaOpen(true)}
              onOpenForwardPicker={(msg) => setForwardTarget(msg)}
              onJumpToMessage={handleJumpToMessage}
            />
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Select a conversation"
              subtitle="Choose a chat from the list, or start a new one."
            />
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <NewConversationModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        users={directoryUsers.filter((u) => u._id !== currentUser._id)}
        onStartDirect={handleStartDirect}
        onStartGroup={handleStartGroup}
      />

      {activeConversation?.type === 'group' && (
        <GroupInfoModal
          open={groupInfoOpen}
          onClose={() => setGroupInfoOpen(false)}
          conversation={activeConversation}
          currentUser={currentUser}
          permissions={permissions}
          onUpdateGroup={(payload) => chat.updateGroup(activeConversationId, payload)}
          onRemoveMember={(memberId) => chat.removeGroupMember(activeConversationId, memberId)}
          onToggleAdmin={(memberId, isAdmin) => chat.toggleAdmin(activeConversationId, memberId, isAdmin)}
          onLeaveGroup={async () => {
            await chat.removeGroupMember(activeConversationId, currentUser._id);
            setGroupInfoOpen(false);
            handleBack();
          }}
          onOpenAddMembers={() => { setGroupInfoOpen(false); setNewChatOpen(true); }}
          onOpenMedia={() => { setGroupInfoOpen(false); setMediaOpen(true); }}
        />
      )}

      <PinnedMessagesModal
        open={pinnedOpen}
        onClose={() => setPinnedOpen(false)}
        messages={pinned}
        canUnpin={permissions.canPinMessage}
        onUnpin={(messageId) => chat.pinMessage(messageId, activeConversationId, false)}
        onJump={handleJumpToMessage}
      />

      <MediaGalleryModal
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        conversationId={activeConversationId}
        loadMedia={chat.loadMedia}
      />

      <ForwardModal
        open={Boolean(forwardTarget)}
        onClose={() => setForwardTarget(null)}
        conversations={conversations}
        currentUserId={currentUser._id}
        message={forwardTarget}
        onForward={chat.forwardMessage}
      />

      <CallHistoryModal
        open={callHistoryOpen}
        onClose={() => setCallHistoryOpen(false)}
        calls={callHistory}
        currentUserId={currentUser._id}
        loadCallHistory={chat.loadCallHistory}
      />

      {/* Incoming call notification */}
      <IncomingCallModal
        call={incomingCall}
        onAccept={() => incomingCall?.callId && chat.joinCall(incomingCall.callId)}
        onDecline={() => incomingCall?.callId && chat.declineCall(incomingCall.callId)}
      />

      {/* Active call fullscreen */}
      {activeCall && (
        <CallModal
          call={activeCall}
          conversation={activeCallConversation}
          currentUser={currentUser}
          onEnd={() => chat.endCall(activeCall.callId)}
          onMuteStateChange={chat.sendMuteState}
          onRenewToken={chat.renewCallToken}
        />
      )}
    </div>
  );
}
