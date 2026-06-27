'use client';

import { useMemo } from 'react';
import { getChatPermissions } from '@/lib/chatPermissions';

/** Memoized wrapper around getChatPermissions() for use inside components. */
export function useChatPermissions(conversation, currentUser) {
  return useMemo(() => getChatPermissions(conversation, currentUser), [conversation, currentUser]);
}

export default useChatPermissions;
