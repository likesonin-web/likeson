/**
 * useParticipantMap.js
 * Zero-duplicate participant management using stable Map().
 * Core fix for VideoSDK participant duplication bug.
 */

import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * @returns {object} participant map utilities
 */
export function useParticipantMap() {
  // Map<participantId: string, participantObject>
  const participantMapRef = useRef(new Map());
  const [, forceUpdate]   = useState(0);

  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  /** Add or update participant — never duplicate */
  const upsertParticipant = useCallback((participant) => {
    if (!participant?.id) return;
    participantMapRef.current.set(participant.id, participant);
    rerender();
  }, [rerender]);

  /** Remove participant by ID */
  const removeParticipant = useCallback((participantId) => {
    if (!participantId) return;
    participantMapRef.current.delete(participantId);
    rerender();
  }, [rerender]);

  /** Check existence */
  const hasParticipant = useCallback((participantId) => {
    return participantMapRef.current.has(participantId);
  }, []);

  /** Clear all */
  const clearParticipants = useCallback(() => {
    participantMapRef.current.clear();
    rerender();
  }, [rerender]);

  /** Stable memoized array — only changes when map changes */
  const participantList = useMemo(
    () => Array.from(participantMapRef.current.values()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participantMapRef.current.size]
  );

  return {
    participantList,
    participantCount: participantMapRef.current.size,
    upsertParticipant,
    removeParticipant,
    hasParticipant,
    clearParticipants,
    getParticipant: (id) => participantMapRef.current.get(id),
  };
}