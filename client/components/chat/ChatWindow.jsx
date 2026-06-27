'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pin, MessageCircle } from 'lucide-react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import SearchPanel from './SearchPanel';
import EmptyState from './EmptyState';

export default function ChatWindow({
  conversation, currentUser, permissions, messages, hasMore, loadingMore,
  typingUserIds, uploadProgress, onLoadMore, onSendMessage, onSendMedia, onTyping,
  onEditMessage, onDeleteMessage, onReactMessage, onPinMessage, onMarkRead,
  onBack, onCall, onVideoCall, onOpenInfo, onMute, onArchive, onClear, onBlock,
  pinnedMessages, onOpenPinned, onOpenForwardPicker, onJumpToMessage,
  onOpenMedia,
}) {
  const [replyTo,     setReplyTo]     = useState(null);
  const [editing,     setEditing]     = useState(null);
  const [searchOpen,  setSearchOpen]  = useState(false);

  // BUG FIX #4 – reset local state when switching conversations
  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
    setSearchOpen(false);
  }, [conversation?._id]);

  // BUG FIX #5 – guard against undefined _id before calling onMarkRead
  useEffect(() => {
    if (!conversation?._id) return;
    onMarkRead?.(conversation._id);
  }, [conversation?._id, onMarkRead]);

  const typingNames = (typingUserIds || [])
    .map((uid) =>
      conversation.participants
        ?.find((p) => (p.user?._id || p.user)?.toString() === uid)
        ?.user?.name
    )
    .filter(Boolean);

  const handleSend = useCallback(
    (text) => {
      if (editing) {
        onEditMessage(editing._id, conversation._id, text);
        setEditing(null);
        return;
      }
      onSendMessage(conversation._id, {
        type:    'text',
        text,
        replyTo: replyTo?._id || undefined,
      });
      setReplyTo(null);
    },
    [editing, replyTo, conversation._id, onSendMessage, onEditMessage],
  );

  if (!permissions.isParticipant) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No access"
        subtitle="You're not a member of this conversation."
      />
    );
  }

  return (
    // BUG FIX #6 – the outer div must be `h-full flex flex-col overflow-hidden`
    // so MessageList (flex-1 min-h-0) can scroll, and MessageInput (shrink-0)
    // stays pinned to the bottom without needing `position:fixed`.
    <div className="flex flex-col h-full overflow-hidden">
      <ChatHeader
        conversation={conversation}
        currentUser={currentUser}
        permissions={permissions}
        typingNames={typingNames}
        onBack={onBack}
        onCall={onCall}
        onVideoCall={onVideoCall}
        onSearch={() => setSearchOpen((v) => !v)}
        onOpenInfo={onOpenInfo}
        onMute={onMute}
        onArchive={onArchive}
        onClear={onClear}
        onBlock={onBlock}
        onOpenMedia={onOpenMedia}
        onOpenPinned={onOpenPinned}
      />

      {/* Pinned messages banner */}
      {pinnedMessages?.length > 0 && (
        <button
          type="button"
          onClick={onOpenPinned}
          className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/30 text-xs text-left shrink-0 hover:bg-warning/15 transition-colors"
        >
          <Pin className="w-3.5 h-3.5 text-warning shrink-0" />
          <span className="truncate flex-1 text-base-content/70">
            {pinnedMessages.length} pinned · {pinnedMessages[pinnedMessages.length - 1]?.text || `[${pinnedMessages[pinnedMessages.length - 1]?.type}]`}
          </span>
        </button>
      )}

      {/* BUG FIX #7 – SearchPanel and MessageList both need to fill the
          remaining space (flex-1 min-h-0) so the input doesn't get pushed off */}
      {searchOpen ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SearchPanel
            conversationId={conversation._id}
            onClose={() => setSearchOpen(false)}
            onJump={onJumpToMessage}
          />
        </div>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={currentUser?._id}
          permissions={permissions}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={onLoadMore}
          typingNames={typingNames}
          onReply={setReplyTo}
          onEdit={setEditing}
          onDelete={(msg, scope) => onDeleteMessage(msg._id, conversation._id, scope)}
          onReact={(msg, emoji) => onReactMessage(msg._id, conversation._id, emoji)}
          onPin={(msg) => onPinMessage(msg._id, conversation._id, !msg.isPinned)}
          onForward={(msg) => onOpenForwardPicker(msg)}
        />
      )}

      <MessageInput
        disabled={!permissions.canSendMessage}
        disabledReason={
          permissions.isBlocked
            ? 'This conversation is blocked.'
            : !permissions.isParticipant
              ? 'You are not a member of this conversation.'
              : undefined
        }
        replyTo={replyTo}
        editingMessage={editing}
        uploadProgress={uploadProgress}
        onSend={handleSend}
        onSendMedia={(file) => onSendMedia(conversation._id, file)}
        onTyping={(isTyping) => onTyping(conversation._id, isTyping)}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
      />
    </div>
  );
}
