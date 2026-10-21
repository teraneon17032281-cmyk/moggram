import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { notificationService, type NotificationItem } from '../services/notificationService';

interface NotificationsValue { items:NotificationItem[]; unreadCount:number; unreadMessages:number; refresh:()=>Promise<void>; markRead:(ids?:number[])=>Promise<void>; }
const NotificationsContext = createContext<NotificationsValue|null>(null);

export function NotificationsProvider({children}:{children:ReactNode}) {
  const {user,loading}=useAuth();
  const [items,setItems]=useState<NotificationItem[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [unreadMessages,setUnreadMessages]=useState(0);

  const refresh=useCallback(async()=>{
    if(!user)return;
    const snapshot=await notificationService.get();
    setItems(snapshot.items);setUnreadCount(snapshot.unreadCount);setUnreadMessages(snapshot.unreadMessages);
  },[user?.id]);

  useEffect(()=>{
    setItems([]);setUnreadCount(0);setUnreadMessages(0);
    if(!user||loading)return;
    let active=true;
    const poll=()=>{void notificationService.get().then(snapshot=>{
      if(!active)return;
      setItems(snapshot.items);setUnreadCount(snapshot.unreadCount);setUnreadMessages(snapshot.unreadMessages);
    }).catch(()=>undefined);};
    poll();const timer=window.setInterval(poll,12000);
    return()=>{active=false;window.clearInterval(timer);};
  },[user?.id,loading]);

  const markRead=useCallback(async(ids?:number[])=>{
    await notificationService.markRead(ids);
    setItems(current=>current.map(item=>!ids||ids.includes(item.id)?{...item,isRead:true}:item));
    setUnreadCount(count=>ids?Math.max(0,count-items.filter(item=>ids.includes(item.id)&&!item.isRead).length):0);
  },[items]);
  const value=useMemo(()=>({items,unreadCount,unreadMessages,refresh,markRead}),[items,unreadCount,unreadMessages,refresh,markRead]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(){const context=useContext(NotificationsContext);if(!context)throw new Error('useNotifications must be used inside <NotificationsProvider>');return context;}
