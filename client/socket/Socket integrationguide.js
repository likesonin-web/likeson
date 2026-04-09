/**
 * ════════════════════════════════════════════════════════════════════
 * SOCKET INTEGRATION GUIDE — How to wire SocketProvider into your app
 * ════════════════════════════════════════════════════════════════════
 *
 * FILES TO CREATE / PLACE:
 *   src/providers/SocketProvider.jsx   ← the provider + context
 *   src/hooks/useSocketChat.js         ← convenience hook
 *   src/components/chat/TypingIndicator.jsx
 *
 * ────────────────────────────────────────────────────────────────────
 * STEP 1: Wrap your layout with <SocketProvider>
 * ────────────────────────────────────────────────────────────────────
 */

// app/layout.jsx  (Next.js App Router)
// OR  pages/_app.jsx  (Next.js Pages Router)

import { SocketProvider } from '@/providers/SocketProvider';
import { Provider } from 'react-redux';
import store from '@/store';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Provider store={store}>
          <SocketProvider>  {/* ← add this around your entire app */}
            {children}
          </SocketProvider>
        </Provider>
      </body>
    </html>
  );
}

/**
 * ────────────────────────────────────────────────────────────────────
 * STEP 2: Update ChatManagement.jsx
 * Replace the big comment block about socket wiring with one hook call
 * ────────────────────────────────────────────────────────────────────
 */

// BEFORE (in ChatManagement.jsx):
//   // Place this in your socket provider (e.g. SocketProvider.jsx) ...
//   // socket.on('new_message', ...
//   // ...long comment block...

// AFTER — just add this one import and one line:
import { useSocketChat } from '@/hooks/useSocketChat';

export default function ChatManagement() {
  const dispatch    = useDispatch();
  const currentUser = useSelector(state => state.user?.user);
  // ... other selectors ...

  // ↓ This single line replaces the entire comment block
  const { typingUsers, onlineUsers, isConnected } = useSocketChat();

  // Now typingUsers and onlineUsers are available for your UI
  // ...rest of component unchanged...
}

/**
 * ────────────────────────────────────────────────────────────────────
 * STEP 3: Add typing indicator to ChatWindow
 * ────────────────────────────────────────────────────────────────────
 */

// In ChatWindow component, add:
import TypingIndicator from '@/components/chat/TypingIndicator';
import { useSocketChat } from '@/hooks/useSocketChat';

function ChatWindow({ conv, dispatch, currentUser, onOpenSettings }) {
  // Add this line:
  const { typingInActive } = useSocketChat();

  // ... existing code ...

  return (
    // ... existing JSX ...
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3">
      {/* ... existing message list ... */}

      {/* ADD THIS: typing indicator just before the scroll anchor */}
      <TypingIndicator
        typingUserIds={typingInActive}
        participants={conv?.participants || []}
      />
      <div ref={msgEndRef} />
    </div>
    // ...
  );
}

/**
 * ────────────────────────────────────────────────────────────────────
 * STEP 4: Wire typing emit in MessageInput
 * ────────────────────────────────────────────────────────────────────
 */

// In MessageInput component, add:
import { useSocketChat } from '@/hooks/useSocketChat';

function MessageInput({ convId, dispatch, ... }) {
  // Add this line:
  const { emitTypingInActive, emitStopTypingInActive } = useSocketChat();

  // Update textarea (add onChange/onBlur/onKeyDown):
  return (
    <textarea
      value={text}
      onChange={e => {
        setText(e.target.value);
        emitTypingInActive();          // ← ADD THIS
      }}
      onBlur={emitStopTypingInActive}  // ← ADD THIS
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          emitStopTypingInActive();    // ← ADD THIS (stop typing on send)
          handleSend();
        }
      }}
    />
  );
}

/**
 * ────────────────────────────────────────────────────────────────────
 * STEP 5: Emit socket events after API calls succeed
 * Add these to the relevant places in ChatManagement or MessageBubble
 * ────────────────────────────────────────────────────────────────────
 */

// Get socket helpers at top of component:
const {
  emitNewMessage,
  emitMessageEdited,
  emitMessageDeleted,
  emitReactionToggled,
  emitMessagePinned,
  emitCallInitiated,
  emitCallEnded,
  emitMemberAdded,
  emitMemberRemoved,
  emitMemberLeft,
  emitConversationUpdated,
} = useSocketChat();

// ── After sendMessage succeeds (in sendMessage.fulfilled extraReducer) ──
// The chatSlice already handles Redux state. Add socket emit in your component:
dispatch(sendMessage({ ... })).unwrap().then(({ message }) => {
  emitNewMessage(message);  // ← broadcasts to all other participants
});

// ── After editMessage succeeds ──
dispatch(editMessage({ ... })).unwrap().then((updatedMsg) => {
  emitMessageEdited(updatedMsg.conversation, updatedMsg);
});

// ── After deleteMessage succeeds ──
dispatch(deleteMessage({ messageId, deleteType: 'for_everyone', conversationId }))
  .unwrap()
  .then(() => {
    emitMessageDeleted(conversationId, messageId, 'for_everyone');
  });

// ── After reactToMessage succeeds ──
dispatch(reactToMessage({ messageId, emoji, conversationId }))
  .unwrap()
  .then(({ reactions }) => {
    emitReactionToggled(conversationId, messageId, reactions);
  });

// ── After initiateCall succeeds ──
dispatch(initiateCall({ conversationId, callType }))
  .unwrap()
  .then((call) => {
    emitCallInitiated(conversationId, call._id, callType, currentUser);
  });

// ── After endCall succeeds ──
dispatch(endCall(callId)).unwrap().then((call) => {
  emitCallEnded(call.conversation, callId, call.totalDurationSec);
});

// ── After addParticipants succeeds ──
dispatch(addParticipants({ conversationId, userIds }))
  .unwrap()
  .then(() => {
    newUsers.forEach(u => emitMemberAdded(conversationId, u));
  });

// ── After removeParticipant succeeds ──
dispatch(removeParticipant({ conversationId, userId }))
  .unwrap()
  .then(() => {
    emitMemberRemoved(conversationId, userId);
  });

// ── After leaveConversation succeeds ──
dispatch(leaveConversation(conversationId))
  .unwrap()
  .then(() => {
    emitMemberLeft(conversationId, currentUser._id);
  });

// ── After updateConversation succeeds ──
dispatch(updateConversation({ conversationId, formData }))
  .unwrap()
  .then((updatedConv) => {
    emitConversationUpdated(conversationId, updatedConv);
  });

/**
 * ────────────────────────────────────────────────────────────────────
 * STEP 6: Show online presence in the conversations sidebar
 * ────────────────────────────────────────────────────────────────────
 */

// In ConvSidebar or ChatWindow header, access onlineUsers:
const { onlineUsers } = useSocketChat();

// Then use it:
const isOnline = onlineUsers.has(partner?._id) || partner?.isOnline;

// <div className={`w-2.5 h-2.5 rounded-full border-2 border-base-100 ${isOnline ? 'bg-success' : 'bg-base-300'}`} />

/**
 * ────────────────────────────────────────────────────────────────────
 * ENV VARIABLE NEEDED
 * ────────────────────────────────────────────────────────────────────
 *
 * .env.local:
 *   NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
 *   # or same as your API URL if socket runs on same server:
 *   NEXT_PUBLIC_API_URL=http://localhost:5000
 *
 * ────────────────────────────────────────────────────────────────────
 * SERVER SIDE (Express + socket.js):
 * ────────────────────────────────────────────────────────────────────
 *
 * In server.js / app.js, attach io to app so routes can use it:
 *
 *   import { setupSocket } from './socket.js';
 *
 *   const server = http.createServer(app);
 *   const io     = setupSocket(server);
 *   app.set('io', io);
 *
 * Then in any Express route handler:
 *
 *   router.post('/conversations/:id/messages', async (req, res) => {
 *     const message = await Message.create({ ... });
 *     // Push to room in real-time from server side:
 *     req.app.get('io').emitToConversation(req.params.id, 'message_received', message);
 *     res.status(201).json({ success: true, data: message });
 *   });
 */