import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Heart, MessageCircle, Repeat2, UserRound, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { usePreferences } from './PreferencesContext';
import { notificationService, type NotificationItem } from '../services/notificationService';

interface ToastItem extends NotificationItem { toastId:number; }
interface NotificationsValue { items:NotificationItem[]; unreadCount:number; unreadMessages:number; refresh:()=>Promise<void>; markRead:(ids?:number[])=>Promise<void>; dismissToast:(id:number)=>void; }
const NotificationsContext = createContext<NotificationsValue|null>(null);

function actionText(item:NotificationItem, russian:boolean) {
  const name = item.actorName || (russian ? 'Пользователь' : 'Someone');
  const actions = { like:russian?'оценил(а) твою публикацию':'liked your post', repost:russian?'репостнул(а) твою публикацию':'reposted your post', comment:russian?'ответил(а) на твою публикацию':'commented on your post', follow:russian?'подписался(ась) на тебя':'started following you', message:russian?'отправил(а) тебе сообщение':'sent you a message' };
  return <><strong className="font-semibold text-ink">{name}</strong> {actions[item.kind]}.</>;
}

function Toast({ item, close, russian }:{item:ToastItem;close:()=>void;russian:boolean}) {
  const Icon = item.kind==='like'?Heart:item.kind==='repost'?Repeat2:item.kind==='comment'?MessageCircle:item.kind==='follow'?UserRound:Bell;
  useEffect(()=>{const timer=window.setTimeout(close,5500);return()=>window.clearTimeout(timer);},[close]);
  const href = item.kind==='message'?'/messages?to='+encodeURIComponent(item.actorUsername):item.kind==='follow'?'/users/'+encodeURIComponent(item.actorUsername):'/';
  return <div className="pointer-events-auto flex w-[min(22rem,calc(100vw-1.5rem))] items-start gap-3 rounded-2xl border border-line bg-card/95 p-3.5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
    {item.avatarUrl?<img src={item.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover"/>:<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><Icon size={18}/></span>}
    <Link to={href} className="min-w-0 flex-1 text-sm leading-5 text-muted" onClick={close}>{actionText(item,russian)}</Link>
    <button type="button" onClick={close} aria-label={russian?'Закрыть уведомление':'Close notification'} className="rounded-lg p-1 text-muted hover:bg-white/10 hover:text-ink"><X size={16}/></button>
  </div>;
}

export function NotificationsProvider({children}:{children:ReactNode}) {
  const {user,loading}=useAuth();
  const {language}=usePreferences();
  const russian=language==='ru';
  const [items,setItems]=useState<NotificationItem[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [unreadMessages,setUnreadMessages]=useState(0);
  const [toasts,setToasts]=useState<ToastItem[]>([]);
  const seen=useRef<Set<number>|null>(null);
  const nextToast=useRef(1);

  const refresh=useCallback(async()=>{
    if(!user)return;
    const snapshot=await notificationService.get();
    const ids=new Set(snapshot.items.map(item=>item.id));
    if(seen.current){
      const fresh=snapshot.items.filter(item=>!seen.current!.has(item.id));
      if(fresh.length)setToasts(current=>[...fresh.slice(0,3).map(item=>({...item,toastId:nextToast.current++})),...current].slice(0,3));
    }
    seen.current=ids;setItems(snapshot.items);setUnreadCount(snapshot.unreadCount);setUnreadMessages(snapshot.unreadMessages);
  },[user?.id]);

  useEffect(()=>{
    seen.current=null;setItems([]);setUnreadCount(0);setUnreadMessages(0);setToasts([]);
    if(!user||loading)return;
    let active=true;
    const poll=()=>{void notificationService.get().then(snapshot=>{
      if(!active)return;
      const ids=new Set(snapshot.items.map(item=>item.id));
      if(seen.current){
        const fresh=snapshot.items.filter(item=>!seen.current!.has(item.id));
        if(fresh.length)setToasts(current=>[...fresh.slice(0,3).map(item=>({...item,toastId:nextToast.current++})),...current].slice(0,3));
      }
      seen.current=ids;setItems(snapshot.items);setUnreadCount(snapshot.unreadCount);setUnreadMessages(snapshot.unreadMessages);
    }).catch(()=>undefined);};
    poll();const timer=window.setInterval(poll,12000);
    return()=>{active=false;window.clearInterval(timer);};
  },[user?.id,loading]);

  const markRead=useCallback(async(ids?:number[])=>{
    await notificationService.markRead(ids);
    setItems(current=>current.map(item=>!ids||ids.includes(item.id)?{...item,isRead:true}:item));
    setUnreadCount(count=>ids?Math.max(0,count-items.filter(item=>ids.includes(item.id)&&!item.isRead).length):0);
  },[items]);
  const dismissToast=useCallback((id:number)=>setToasts(current=>current.filter(item=>item.toastId!==id)),[]);
  const value=useMemo(()=>({items,unreadCount,unreadMessages,refresh,markRead,dismissToast}),[items,unreadCount,unreadMessages,refresh,markRead,dismissToast]);
  return <NotificationsContext.Provider value={value}>{children}
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-3 lg:inset-x-auto lg:bottom-5 lg:right-5 lg:items-end lg:px-0">
      {toasts.map(item=><Toast key={item.toastId} item={item} russian={russian} close={()=>dismissToast(item.toastId)}/>)}
    </div>
  </NotificationsContext.Provider>;
}
export function useNotifications(){const context=useContext(NotificationsContext);if(!context)throw new Error('useNotifications must be used inside <NotificationsProvider>');return context;}
