// app/chat/page.jsx
// Mount under your app router. Requires Redux store + ChatProvider wrapping at layout level.

import ChatLayout from '@/components/chat/ChatLayout';

export const metadata = {
  title: 'Messages',
};

export default function ChatPage() {
  return <ChatLayout />;
}