'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import EmptyState from './EmptyState';
import IncomingCallModal from './ChatWidgets';
import { useChat } from '@/hooks/useChat';

export default function ChatLayout() {
  const {
    activeConversationId,
    activeConversation,
    incomingCall,
    selectConversation,
    closeConversation,
  } = useChat();

  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // When convo selected on mobile → show chat panel
  useEffect(() => {
    if (activeConversationId) setMobilePanelOpen(true);
  }, [activeConversationId]);

  const handleBack = () => {
    setMobilePanelOpen(false);
    closeConversation();
  };

  return (
    <div className="chat-layout">
      {/* Desktop: side-by-side. Mobile: stacked with slide */}

      {/* Left Panel - Conversation List */}
      <AnimatePresence initial={false}>
        {(!mobilePanelOpen || !activeConversationId) && (
          <motion.aside
            key="sidebar"
            className="chat-sidebar"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <ConversationList onSelect={() => setMobilePanelOpen(true)} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Right Panel - Chat Window */}
      <main className="chat-main">
        <AnimatePresence mode="wait">
          {activeConversationId && activeConversation ? (
            <motion.div
              key={activeConversationId}
              className="chat-main-inner"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <ChatWindow
                conversation={activeConversation}
                onBack={handleBack}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="chat-main-inner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Incoming call overlay */}
      <AnimatePresence>
        {incomingCall && <IncomingCallModal key="call" />}
      </AnimatePresence>
    </div>
  );
}