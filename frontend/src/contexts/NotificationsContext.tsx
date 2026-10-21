import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { notificationService, type NotificationItem } from '../services/notificationService';
import { messageService } from '../services/messageService';

interface NotificationsValue {
  items: NotificationItem[];
  unreadCount: number;
  unreadMessages: number;
  refresh: () => Promise<void>;
  markRead: (ids?: number[]) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [notifications, conversations] = await Promise.allSettled([
      notificationService.get(),
      messageService.getConversations(),
    ]);

    // Keep the messages badge independent from activity notifications. A
    // notifications API failure must not hide unread conversations.
    if (notifications.status === 'fulfilled') {
      setItems(notifications.value.items.filter((item) => item.kind !== 'message'));
      setUnreadCount(notifications.value.unreadCount);
    }
    if (conversations.status === 'fulfilled') {
      setUnreadMessages(conversations.value.reduce((total, item) => total + item.unreadCount, 0));
    }
  }, [user?.id]);

  useEffect(() => {
    setItems([]);
    setUnreadCount(0);
    setUnreadMessages(0);
    if (!user || loading) return;

    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);
    return () => window.clearInterval(timer);
  }, [user?.id, loading, refresh]);

  const markRead = useCallback(async (ids?: number[]) => {
    await notificationService.markRead(ids);
    setItems((current) =>
      current.map((item) => (!ids || ids.includes(item.id) ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((count) =>
      ids
        ? Math.max(
            0,
            count - items.filter((item) => ids.includes(item.id) && !item.isRead).length,
          )
        : 0,
    );
  }, [items]);

  const value = useMemo(
    () => ({ items, unreadCount, unreadMessages, refresh, markRead }),
    [items, unreadCount, unreadMessages, refresh, markRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return context;
}
