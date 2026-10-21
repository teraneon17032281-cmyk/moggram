import { Bell, Heart, MessageCircle, Repeat2, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useNotifications } from '../contexts/NotificationsContext';
import { usePreferences } from '../contexts/PreferencesContext';
import type { NotificationItem } from '../services/notificationService';

function notificationText(item:NotificationItem,russian:boolean) {
  const who=item.actorName||(russian?'Пользователь':'Someone');
  const verb={like:russian?'оценил(а) твою публикацию':'liked your post',repost:russian?'репостнул(а) твою публикацию':'reposted your post',comment:russian?'ответил(а) на твою публикацию':'commented on your post',follow:russian?'подписался(ась) на тебя':'started following you',message:russian?'отправил(а) тебе сообщение':'sent you a message'};
  return <><strong className="font-semibold text-ink">{who}</strong> {verb[item.kind]}</>;
}

export default function NotificationsPage() {
  const {language}=usePreferences();
  const russian=language==='ru';
  const {items,unreadCount,markRead}=useNotifications();
  const open=async(item:NotificationItem)=>{if(!item.isRead)await markRead([item.id]);};
  return <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
    <AppHeader/>
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">MogGram · IUCA</p><h1 className="mt-2 font-display text-3xl font-bold">{russian?'Уведомления':'Notifications'}</h1><p className="mt-1 text-sm text-muted">{russian?'Лайки, комментарии, подписки и сообщения':'Likes, comments, follows, and messages'}</p></div>
        {unreadCount>0&&<button type="button" onClick={()=>void markRead()} className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted hover:bg-card hover:text-ink">{russian?'Прочитать всё':'Mark all read'}</button>}
      </header>
      <section className="overflow-hidden rounded-3xl border border-line bg-card/70">
        {items.length?items.map(item=>{
          const Icon=item.kind==='like'?Heart:item.kind==='repost'?Repeat2:item.kind==='comment'?MessageCircle:item.kind==='follow'?UserRound:Bell;
          const href=item.kind==='message'?'/messages?to='+encodeURIComponent(item.actorUsername):item.kind==='follow'?'/users/'+encodeURIComponent(item.actorUsername):'/';
          const rowClass='flex items-center gap-3 border-b border-line/70 px-4 py-4 transition last:border-0 hover:bg-white/[0.04] '+(item.isRead?'':'bg-brand/[0.07]');
          return <Link key={item.id} to={href} onClick={()=>void open(item)} className={rowClass}>
            {item.avatarUrl?<img src={item.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover"/>:<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><Icon size={19}/></span>}
            <span className="min-w-0 flex-1 text-sm text-muted">{notificationText(item,russian)}<span className="mt-1 block text-xs text-muted/80">{new Date(item.createdAt).toLocaleString(russian?'ru-RU':'en-US',{dateStyle:'medium',timeStyle:'short'})}</span></span>
            {!item.isRead&&<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label={russian?'Не прочитано':'Unread'}/>}
          </Link>;
        }):<div className="px-6 py-16 text-center"><Bell className="mx-auto text-muted" size={30}/><p className="mt-3 font-semibold">{russian?'Пока уведомлений нет':'No notifications yet'}</p><p className="mt-1 text-sm text-muted">{russian?'Здесь появятся лайки, ответы, подписки и новые сообщения.':'Likes, replies, follows, and messages will appear here.'}</p></div>}
      </section>
    </main>
  </div>;
}
