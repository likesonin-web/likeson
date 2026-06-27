'use client';

/**
 * hooks/useSupportSocket.js
 * Thin re-export so feature code imports from `hooks/` rather than reaching
 * into the provider directly — keeps the import surface consistent with the
 * rest of the custom-hooks layer.
 */
import { useSupportSocketContext } from '../providers/SocketProvider';

export default function useSupportSocket() {
  return useSupportSocketContext();
}
