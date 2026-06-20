'use client';

import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectToken } from '@/store/slices/userSlice';

// Import the default export from your new ChatProvider file.
import ChatProvider from '@/providers/ChatProvider';

interface AuthSocketBridgeProps {
  children: React.ReactNode;
  showStatusBadge?: boolean;
}

export default function AuthSocketBridge({
  children,
  showStatusBadge = true, // Retained to prevent errors if parent components still pass this prop
}: AuthSocketBridgeProps) {
  const rawToken = useSelector(selectToken);

  // Safely validate the token: ensures it is a non-empty string
  const token = useMemo(() => {
    return typeof rawToken === 'string' && rawToken.trim() !== '' 
      ? rawToken 
      : null;
  }, [rawToken]);

  // Always wrap children in the ChatProvider! 
  // If token is null, ChatProvider will simply not connect the socket, 
  // but it WILL still provide the Context so useChatSocket() doesn't crash.
  return (
    <ChatProvider token={token}>
      {children}
    </ChatProvider>
  );
}