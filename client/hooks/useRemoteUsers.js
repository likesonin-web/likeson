'use client';
import { useState, useEffect, useRef } from 'react';

export function useRemoteUsers(clientRef) {
  const [remoteUsers, setRemoteUsers] = useState({});

  useEffect(() => {
    // Poll until client is ready — handles the ref timing problem
    let client = null;
    let pollTimer = null;
    let registered = false;

    const handleUserPublished = async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers(prev => {
        const existing = prev[user.uid] || {};
        const updated  = { ...existing, user };
        if (mediaType === 'audio') updated.audioTrack = user.audioTrack;
        if (mediaType === 'video') updated.videoTrack = user.videoTrack;
        return { ...prev, [user.uid]: updated };
      });
      if (mediaType === 'audio') {
        try { user.audioTrack?.play(); } catch {}
      }
    };

    const handleUserUnpublished = (user, mediaType) => {
      setRemoteUsers(prev => {
        const existing = prev[user.uid];
        if (!existing) return prev;
        const updated = { ...existing };
        if (mediaType === 'audio') updated.audioTrack = null;
        if (mediaType === 'video') updated.videoTrack = null;
        return { ...prev, [user.uid]: updated };
      });
    };

    const handleUserLeft = (user) => {
      setRemoteUsers(prev => {
        const next = { ...prev };
        delete next[user.uid];
        return next;
      });
    };

    const register = (c) => {
      if (registered) return;
      client = c;
      registered = true;

      // Seed any already-joined remote users
      if (c.remoteUsers?.length) {
        const seed = {};
        c.remoteUsers.forEach(u => { seed[u.uid] = { user: u, audioTrack: u.audioTrack, videoTrack: u.videoTrack }; });
        setRemoteUsers(seed);
      }

      c.on('user-published',   handleUserPublished);
      c.on('user-unpublished', handleUserUnpublished);
      c.on('user-left',        handleUserLeft);
    };

    const tryRegister = () => {
      // clientRef can be a ref object {current} or a direct client
      const c = clientRef?.current ?? clientRef;
      if (c && typeof c.on === 'function') {
        register(c);
      } else {
        pollTimer = setTimeout(tryRegister, 100);
      }
    };

    tryRegister();

    return () => {
      clearTimeout(pollTimer);
      if (client) {
        client.off('user-published',   handleUserPublished);
        client.off('user-unpublished', handleUserUnpublished);
        client.off('user-left',        handleUserLeft);
      }
    };
  // Empty deps — runs once, polls until clientRef.current is ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return remoteUsers;
}