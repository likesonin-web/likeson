'use client';

/**
 * hooks/useNotifications.js
 * Thin convenience wrapper around the EXISTING notificationSlice — the
 * Support module does NOT own notification state, it only reads/dispatches
 * into the slice that already exists app-wide.
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  selectAllNotifications,
  selectUnreadCount,
  selectNotificationLoading,
} from '../store/slices/notificationSlice';

export default function useNotifications({ autoFetch = true } = {}) {
  const dispatch = useDispatch();
  const items = useSelector(selectAllNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectNotificationLoading);

  useEffect(() => {
    if (autoFetch) {
      dispatch(fetchUnreadCount());
      dispatch(fetchNotifications({ limit: 20 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  return {
    items,
    unreadCount,
    loading,
    refresh: () => dispatch(fetchNotifications({ limit: 20 })),
    markRead: (id) => dispatch(markAsRead(id)),
    markAllRead: () => dispatch(markAllAsRead()),
    remove: (id) => dispatch(deleteNotification(id)),
  };
}
