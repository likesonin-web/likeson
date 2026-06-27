'use client';

/**
 * hooks/useMentions.js
 * Drives the @mention autocomplete in MessageComposer / NoteComposer.
 * Mentionable users = assignable agents directory (admin/superadmin/finance).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAgents, selectAgents } from '../store/slices/supportSlice';
import { ROLE_LABELS } from '../lib/supportconstants';

const MENTION_TRIGGER = /@([a-zA-Z0-9_]*)$/;

export default function useMentions() {
  const dispatch = useDispatch();
  const { items: agents, loading } = useSelector(selectAgents);
  const [query, setQuery] = useState(null); // null = inactive, '' = just typed '@'
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!agents.length) dispatch(fetchAgents());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return agents
      .filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q))
      .slice(0, 6);
  }, [agents, query]);

  /** Call on every textarea change with (text, caretIndex) */
  const detectMention = useCallback((text, caretIndex) => {
    const upToCaret = text.slice(0, caretIndex);
    const match = upToCaret.match(MENTION_TRIGGER);
    if (match) {
      setQuery(match[1]);
      setActiveIndex(0);
    } else {
      setQuery(null);
    }
  }, []);

  const closeMentions = useCallback(() => setQuery(null), []);

  const moveActive = useCallback(
    (delta) => {
      setActiveIndex((prev) => {
        const next = prev + delta;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
    },
    [suggestions.length]
  );

  return {
    isActive: query !== null,
    suggestions,
    activeIndex,
    loading,
    detectMention,
    closeMentions,
    moveActive,
    roleLabel: (role) => ROLE_LABELS[role] || role,
  };
}
