import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Check, CheckCheck, Forward, ImagePlus, MessageCircle, MessageCircleMore, Mic, Reply, Search, Send, Smile, Sparkles, Square, UserRound, X } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import Alert from '../components/ui/Alert';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { errorMessage } from '../services/apiClient';
import { messageService } from '../services/messageService';
import { userService } from '../services/userService';
import type { CampusProfile, DirectMessage } from '../types';

const MESSAGE_EMOJIS = ['😀', '😂', '🥹', '😍', '😮', '😢', '🔥', '❤️', '👍', '👎', '🎉', '🙏'];

export default function MessagesPage() {
  const [params] = useSearchParams();
  const recipient = (params.get('to') ?? '').replace(/^@/, '').trim();
  const { user } = useAuth();
  const { language } = usePreferences();
  const { refresh: refreshNotifications } = useNotifications();
  const russian = language === 'ru';
  const [profile, setProfile] = useState<CampusProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof messageService.getConversations>>>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState('');
  const [recording, setRecording] = useState(false);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [emojiPicker, setEmojiPicker] = useState<'composer' | string | null>(null);
  const [forwarding, setForwarding] = useState<DirectMessage | null>(null);
  const [forwardTarget, setForwardTarget] = useState('');
  const [forwardLoading, setForwardLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLInputElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const previousConversationRef = useRef('');
  const lastMessageIdForScrollRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderTimer = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!recipient) { setMessages([]); setProfile(null); return; }
    setLoading(true); setError('');
    try {
      const [conversation, person] = await Promise.all([messageService.getConversation(recipient), userService.getProfile(recipient)]);
      setMessages(conversation); setProfile(person);
      await refreshNotifications();
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [recipient, refreshNotifications]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!recipient || loading) return;
    const conversationChanged = previousConversationRef.current !== recipient;
    const latestMessageId = messages.length ? messages[messages.length - 1].id : null;
    const hasNewLastMessage = latestMessageId !== lastMessageIdForScrollRef.current;
    previousConversationRef.current = recipient;
    lastMessageIdForScrollRef.current = latestMessageId;
    if (conversationChanged || (hasNewLastMessage && shouldStickToBottomRef.current)) {
      const container = messageScrollRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [recipient, messages, loading]);
  useEffect(() => {
    if (!recipient) return;
    let active = true;
    const refreshMessages = () => {
      messageService.getConversation(recipient)
        .then((items) => { if (active) setMessages(items); })
        .catch(() => undefined);
    };
    const timer = window.setInterval(refreshMessages, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [recipient]);

  useEffect(() => {
    let active = true;
    const refreshConversations = () => {
      messageService.getConversations()
        .then((items) => { if (active) setConversations(items); })
        .catch((err) => { if (active) setError(errorMessage(err)); })
        .finally(() => { if (active) setConversationsLoading(false); });
    };
    setConversationsLoading(true);
    refreshConversations();
    const timer = window.setInterval(refreshConversations, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [recipient]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recorderTimer.current !== null) window.clearTimeout(recorderTimer.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!attachment) { setAttachmentPreview(''); return; }
    const url = URL.createObjectURL(attachment);
    setAttachmentPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!recipient || (!content.trim() && !attachment)) return;
    setSending(true); setError('');
    try { const created = await messageService.send(recipient, content, attachment, replyTo?.id); setMessages((current) => [...current, created]); setContent(''); setAttachment(null); setReplyTo(null); setEmojiPicker(null); }
    catch (err) { setError(errorMessage(err)); }
    finally { setSending(false); }
  };

  const chooseEmoji = (emoji: string) => {
    if (emojiPicker === 'composer') {
      const input = messageInput.current;
      const start = input?.selectionStart ?? content.length;
      const end = input?.selectionEnd ?? content.length;
      const next = `${content.slice(0, start)}${emoji}${content.slice(end)}`;
      setContent(next);
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(start + emoji.length, start + emoji.length);
      });
    } else if (emojiPicker) {
      void reactToMessage(emojiPicker, emoji);
    }
    setEmojiPicker(null);
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    setError('');
    try {
      const reactions = await messageService.toggleReaction(messageId, emoji);
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reactions } : message));
    } catch (err) { setError(errorMessage(err)); }
  };

  const openForward = async (message: DirectMessage) => {
    setError(''); setForwarding(message); setForwardTarget(''); setForwardLoading(true);
    try { setConversations(await messageService.getConversations()); }
    catch (err) { setError(errorMessage(err)); setForwarding(null); }
    finally { setForwardLoading(false); }
  };

  const forwardMessage = async () => {
    if (!forwarding || !forwardTarget) return;
    setForwardLoading(true); setError('');
    try {
      await messageService.forward(forwarding.id, forwardTarget);
      setNotice(russian ? 'Сообщение переслано.' : 'Message forwarded.');
      setForwarding(null); setForwardTarget('');
      window.setTimeout(() => setNotice(''), 3000);
    } catch (err) { setError(errorMessage(err)); }
    finally { setForwardLoading(false); }
  };

  const startReply = (message: DirectMessage) => {
    setReplyTo(message); setEmojiPicker(null);
    requestAnimationFrame(() => messageInput.current?.focus());
  };

  const startVoiceRecording = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(russian ? 'Запись голосовых не поддерживается этим браузером.' : 'Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const voice = new File([new Blob(chunks, { type })], `voice-${Date.now()}.${extension}`, { type });
        if (recorderTimer.current !== null) window.clearTimeout(recorderTimer.current);
        stream.getTracks().forEach((track) => track.stop());
        if (mountedRef.current) { setAttachment(voice); setRecording(false); }
      };
      recorderRef.current = recorder;
      recorder.start(); setRecording(true);
      recorderTimer.current = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 120_000);
    } catch {
      setError(russian ? 'Не удалось получить доступ к микрофону. Разреши его в настройках браузера.' : 'Could not access the microphone. Allow it in your browser settings.');
    }
  };

  const onlineLabel = profile?.isOnline === undefined ? (russian ? 'Личные сообщения' : 'Direct messages') : profile.isOnline ? (russian ? 'В сети' : 'Online') : (russian ? 'Не в сети' : 'Offline');

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <AppHeader />
      <main className={`mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-9 ${recipient ? 'lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden lg:py-4' : ''}`}>
        <header className={`mb-6 flex items-end justify-between gap-4 ${recipient ? 'lg:mb-4 lg:shrink-0' : ''}`}>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">MogGram · IUCA</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{russian ? 'Сообщения' : 'Messages'}</h1><p className="mt-1 text-sm text-muted">{russian ? 'Личные разговоры с сообществом' : 'Private conversations with your community'}</p></div>
          <Link to="/search" className="hidden items-center gap-2 rounded-full border border-brand/20 bg-brand/[0.08] px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/[0.14] sm:inline-flex"><Search size={16} />{russian ? 'Найти человека' : 'Find someone'}</Link>
        </header>

        {!recipient && <section className="mb-4 space-y-2 lg:hidden" aria-label={russian ? 'Список переписок' : 'Conversation list'}>
          {error && <Alert variant="error">{error}</Alert>}
          {conversationsLoading ? <p className="py-10 text-center text-sm text-muted">{russian ? 'Загружаем сообщения…' : 'Loading messages…'}</p> : conversations.length ? conversations.map((conversation) => {
            const last = conversation.lastMessage;
            const fromMe = last.senderUsername === user?.username || last.senderId === user?.id;
            const excerpt = last.content || (last.attachmentType === 'image' ? (russian ? 'Фото' : 'Photo') : last.attachmentType === 'audio' ? (russian ? 'Голосовое сообщение' : 'Voice message') : (russian ? 'Вложение' : 'Attachment'));
            return <Link key={conversation.username} to={`/messages?to=${encodeURIComponent(conversation.username)}`} className="flex items-center gap-3 rounded-2xl border border-line/80 bg-card/70 px-3.5 py-3 transition active:scale-[0.99] hover:border-brand/30 hover:bg-card">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/15 bg-surface text-base font-semibold text-ink">{conversation.avatarUrl ? <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" /> : conversation.fullName.charAt(0).toUpperCase()}<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${conversation.isOnline ? 'bg-emerald-400' : 'bg-slate-400/70'}`} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{conversation.fullName}</span><span className="mt-1 block truncate text-[13px] text-muted">{fromMe && <span className="text-ink/70">{russian ? 'Вы: ' : 'You: '}</span>}{excerpt}</span></span>
              <span className="shrink-0 self-start pt-0.5 text-[10px] text-muted">{new Date(last.createdAt).toLocaleTimeString(russian ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </Link>;
          }) : <div className="rounded-2xl border border-dashed border-line bg-card/40 px-5 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><MessageCircleMore size={22} /></span><p className="mt-3 text-sm font-semibold">{russian ? 'Пока нет переписок' : 'No conversations yet'}</p><p className="mt-1 text-xs text-muted">{russian ? 'Найди человека и напиши ему — переписка появится здесь.' : 'Find someone and send a message to start a conversation.'}</p><Link to="/search" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-[#10243a]"><Search size={15} />{russian ? 'Найти людей' : 'Find people'}</Link></div>}
        </section>}

        <section className={`relative grid overflow-hidden rounded-[28px] border border-line bg-card/75 shadow-2xl shadow-slate-950/[0.12] md:grid-cols-[280px_minmax(0,1fr)] ${recipient ? 'lg:min-h-0 lg:flex-1 grid max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:h-[100dvh] max-lg:w-full max-lg:!min-h-0 max-lg:!rounded-none max-lg:!border-0 max-lg:!bg-bg max-lg:!shadow-none' : 'hidden lg:grid'}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-brand/[0.08] blur-3xl" />
          <aside className={`relative border-b border-line/80 bg-gradient-to-b from-surface/75 via-card/60 to-card/40 p-4 md:border-b-0 md:border-r md:p-5 ${recipient ? 'hidden md:block' : ''}`}>
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{russian ? 'Твои разговоры' : 'Your conversations'}</p><h2 className="mt-1 font-display text-lg font-bold">{russian ? 'Входящие' : 'Inbox'}</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl border border-brand/20 bg-brand/10 text-brand"><MessageCircleMore size={19} /></span></div>
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{russian ? 'Переписки' : 'Conversations'}</h3><button type="button" onClick={() => void messageService.getConversations().then(setConversations).catch((err) => setError(errorMessage(err)))} className="text-xs font-semibold text-brand hover:underline">{russian ? 'Обновить' : 'Refresh'}</button></div>
              {conversationsLoading && conversations.length === 0 ? <p className="py-5 text-center text-xs text-muted">{russian ? 'Загружаем…' : 'Loading…'}</p> : conversations.length ? <div className="max-h-[52vh] space-y-1 overflow-y-auto">
                {conversations.map((conversation) => {
                  const last = conversation.lastMessage;
                  const fromMe = last.senderUsername === user?.username || last.senderId === user?.id;
                  const excerpt = last.content || (last.attachmentType === 'image' ? (russian ? 'Фото' : 'Photo') : last.attachmentType === 'audio' ? (russian ? 'Голосовое сообщение' : 'Voice message') : (russian ? 'Вложение' : 'Attachment'));
                  return <Link key={conversation.username} to={'/messages?to=' + encodeURIComponent(conversation.username)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-brand/[0.08]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/15 bg-surface text-sm font-semibold">{conversation.avatarUrl ? <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" /> : conversation.fullName.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{conversation.fullName}</span><span className="mt-0.5 block truncate text-[11px] text-muted">{fromMe && (russian ? 'Вы: ' : 'You: ')}{excerpt}</span></span>
                    <span className="shrink-0 text-[10px] text-muted">{new Date(last.createdAt).toLocaleTimeString(russian ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  </Link>;
                })}
              </div> : <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">{russian ? 'Пока переписок нет. Найди человека и напиши ему.' : 'No conversations yet. Find someone and send a message.'}</p>}
            </div>
            <div className="mt-5 rounded-2xl border border-line/70 bg-card/45 p-4"><div className="flex items-center gap-2 text-brand"><Sparkles size={15} /><span className="text-xs font-semibold">{russian ? 'Твоё пространство' : 'Your space'}</span></div><p className="mt-2 text-xs leading-5 text-muted">{russian ? 'Сообщения доступны только участникам переписки.' : 'Messages are visible only to the people in the conversation.'}</p></div>
          </aside>

          <div className={`relative flex min-h-[540px] flex-col ${recipient ? 'lg:min-h-0 max-lg:h-[100dvh] max-lg:!min-h-0 max-lg:overflow-hidden' : 'hidden lg:flex'}`}>
            {recipient ? <>
              <header className="flex items-center justify-between gap-3 border-b border-line/80 bg-gradient-to-r from-card/80 via-card/60 to-brand/[0.035] px-3 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 sm:py-4">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3"><Link to="/messages" aria-label={russian ? 'Назад к сообщениям' : 'Back to messages'} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-brand/10 hover:text-brand md:hidden"><ArrowLeft size={20} /></Link><span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/20 to-violet-500/10 text-brand shadow-inner sm:h-12 sm:w-12">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={20} />}{profile?.isOnline && <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />}</span><div className="min-w-0"><p className="flex items-center gap-1.5 truncate text-sm font-bold">{profile?.fullName ?? `@${recipient}`}{profile?.isVerified && <BadgeCheck size={15} className="shrink-0 text-brand" />}</p><p className="mt-0.5 truncate text-xs text-muted">@{recipient}</p></div></div>
                <div className="flex items-center gap-2"><span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium sm:inline-flex ${profile?.isOnline ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-500' : 'border-line bg-surface/50 text-muted'}`}><span className={`h-1.5 w-1.5 rounded-full ${profile?.isOnline ? 'bg-emerald-400' : 'bg-muted/60'}`} />{onlineLabel}</span><Link to={`/users/${encodeURIComponent(recipient)}`} aria-label={russian ? 'Открыть профиль' : 'Open profile'} className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-card/70 text-muted transition hover:border-brand/25 hover:text-brand"><UserRound size={16} /></Link></div>
              </header>

              <div ref={messageScrollRef} onScroll={() => { const container = messageScrollRef.current; if (container) shouldStickToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 120; }} className="flex min-h-0 flex-1 flex-col gap-4 overscroll-contain overflow-y-auto bg-[radial-gradient(ellipse_at_50%_0%,rgba(83,169,255,0.055),transparent_60%)] p-4 sm:p-6">
                <div className="my-1 flex justify-center"><span className="rounded-full border border-line/70 bg-card/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{russian ? 'Начало переписки' : 'Conversation'}</span></div>
                {error && <Alert variant="error">{error}</Alert>}
                {loading && <p className="py-8 text-center text-sm text-muted">{russian ? 'Загружаем переписку…' : 'Loading conversation…'}</p>}
                {!loading && messages.length === 0 && !error && <div className="m-auto max-w-sm rounded-3xl border border-dashed border-line/80 bg-card/55 px-6 py-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><MessageCircle size={21} /></span><p className="mt-4 text-sm font-semibold">{russian ? 'Здесь будет ваш разговор' : 'Your conversation starts here'}</p><p className="mt-1 text-xs leading-5 text-muted">{russian ? 'Напиши первое сообщение — собеседник увидит его здесь.' : 'Send the first message and it will appear here.'}</p></div>}
                {notice && <Alert variant="success">{notice}</Alert>}
                {messages.map((message) => {
                  const mine = message.senderId === user?.id;
                  return <div key={message.id} className={`group relative flex w-fit max-w-[88%] flex-col ${mine ? 'ml-auto items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${mine ? 'rounded-br-md bg-gradient-to-br from-brand to-[#6ab4ff] text-[#10243a] shadow-brand/10' : 'rounded-bl-md border border-line/80 bg-card/90 text-ink'}`}>
                      {message.replyTo && <div className={`mb-2 border-l-2 pl-2 text-xs leading-5 ${mine ? 'border-[#10243a]/40 text-[#10243a]/70' : 'border-brand/60 text-muted'}`}><b>{message.replyTo.senderName}</b><p className="truncate">{message.replyTo.content}</p></div>}
                      {message.attachmentUrl && message.attachmentType === 'image' && <img src={message.attachmentUrl} alt={message.attachmentName ?? (russian ? 'Фото' : 'Photo')} className="mb-2 max-h-72 max-w-full rounded-xl object-cover" />}
                      {message.attachmentUrl && message.attachmentType === 'audio' && <audio controls src={message.attachmentUrl} className="mb-2 max-w-full" />}
                      {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                      <div className={`mt-1.5 flex items-center gap-1 text-[10px] ${mine ? 'text-[#10243a]/65' : 'text-muted'}`}><time>{new Date(message.createdAt).toLocaleString(russian ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</time>{mine && (message.isRead ? <CheckCheck size={13} aria-label={russian ? 'Прочитано' : 'Read'} /> : <Check size={13} aria-label={russian ? 'Отправлено' : 'Sent'} />)}</div>
                    </div>
                    {!!message.reactions?.length && <div className="mt-1 flex flex-wrap gap-1">{message.reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => void reactToMessage(message.id, reaction.emoji)} aria-label={`${reaction.emoji} ${reaction.count}`} aria-pressed={reaction.reactedByMe} className={`rounded-full border px-2 py-0.5 text-xs ${reaction.reactedByMe ? 'border-brand/50 bg-brand/15' : 'border-line bg-card/80'}`}>{reaction.emoji} {reaction.count}</button>)}</div>}
                    <div className="mt-1 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button type="button" onClick={() => setEmojiPicker(emojiPicker === message.id ? null : message.id)} aria-label={russian ? 'Поставить реакцию' : 'Add reaction'} title={russian ? 'Реакция' : 'React'} className="rounded-lg p-1.5 text-muted hover:bg-brand/10 hover:text-brand"><Smile size={15} /></button>
                      <button type="button" onClick={() => startReply(message)} aria-label={russian ? 'Ответить на сообщение' : 'Reply to message'} title={russian ? 'Ответить' : 'Reply'} className="rounded-lg p-1.5 text-muted hover:bg-brand/10 hover:text-brand"><Reply size={15} /></button>
                      <button type="button" onClick={() => void openForward(message)} aria-label={russian ? 'Переслать сообщение' : 'Forward message'} title={russian ? 'Переслать' : 'Forward'} className="rounded-lg p-1.5 text-muted hover:bg-brand/10 hover:text-brand"><Forward size={15} /></button>
                    </div>
                    {emojiPicker === message.id && <div className={`absolute top-full z-20 mt-1 flex max-w-[min(90vw,320px)] flex-wrap gap-1 rounded-2xl border border-line bg-card p-2 shadow-xl ${mine ? 'right-0' : 'left-0'}`}>{MESSAGE_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => chooseEmoji(emoji)} aria-label={`${russian ? 'Реакция' : 'React'} ${emoji}`} className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-surface">{emoji}</button>)}</div>}
                  </div>;
                })}
                
              </div>

              <form onSubmit={send} className="shrink-0 border-t border-line/80 bg-card/90 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4">
                {replyTo && <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-brand bg-brand/[0.06] px-3 py-2"><span className="min-w-0 flex-1 text-xs"><b className="block text-brand">{russian ? `Ответ ${replyTo.senderName}` : `Reply to ${replyTo.senderName}`}</b><span className="block truncate text-muted">{replyTo.content || (replyTo.attachmentType === 'image' ? (russian ? 'Фото' : 'Photo') : russian ? 'Голосовое сообщение' : 'Voice message')}</span></span><button type="button" onClick={() => setReplyTo(null)} aria-label={russian ? 'Отменить ответ' : 'Cancel reply'} className="rounded-lg p-1.5 text-muted hover:bg-card hover:text-ink"><X size={15} /></button></div>}
                {attachment && <div className="mb-2 flex items-center gap-3 rounded-xl border border-brand/15 bg-brand/[0.06] p-2.5"><div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-card text-brand">{attachment.type.startsWith('image/') ? <img src={attachmentPreview} alt="" className="h-full w-full object-cover" /> : <Mic size={18} />}</div><span className="min-w-0 flex-1 truncate text-xs font-medium">{attachment.name}</span>{attachment.type.startsWith('audio/') && <audio controls src={attachmentPreview} className="h-8 max-w-[150px]" />}<button type="button" onClick={() => setAttachment(null)} aria-label={russian ? 'Убрать вложение' : 'Remove attachment'} className="rounded-lg p-2 text-muted hover:bg-card hover:text-ink"><X size={15} /></button></div>}
                <input ref={imageInput} type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file && !file.type.startsWith('image/')) { setError(russian ? 'Можно прикрепить только изображение.' : 'Only image files can be attached.'); event.currentTarget.value = ''; return; } if (file && file.size > 10 * 1024 * 1024) { setError(russian ? 'Фото должно быть не больше 10 МБ.' : 'Photos must be 10 MB or smaller.'); event.currentTarget.value = ''; return; } if (file) { setError(''); setAttachment(file); } event.currentTarget.value = ''; }} />
                {emojiPicker === 'composer' && <div className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-line bg-bg p-2 shadow-lg">{MESSAGE_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => chooseEmoji(emoji)} aria-label={`${russian ? 'Вставить эмодзи' : 'Insert emoji'} ${emoji}`} className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-surface">{emoji}</button>)}</div>}
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg/55 p-1.5 pl-2 transition focus-within:border-brand/35 focus-within:ring-2 focus-within:ring-brand/10"><button type="button" onClick={() => imageInput.current?.click()} disabled={sending || recording} aria-label={russian ? 'Прикрепить фото' : 'Attach a photo'} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-brand/10 hover:text-brand disabled:opacity-40"><ImagePlus size={18} /></button><button type="button" onClick={() => recording ? recorderRef.current?.stop() : void startVoiceRecording()} disabled={sending || (!!attachment && !recording)} aria-label={recording ? (russian ? 'Остановить запись' : 'Stop recording') : (russian ? 'Записать голосовое' : 'Record voice message')} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${recording ? 'animate-pulse bg-rose-500/15 text-rose-500' : 'text-muted hover:bg-brand/10 hover:text-brand'} disabled:opacity-40`}>{recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</button><button type="button" onClick={() => setEmojiPicker(emojiPicker === 'composer' ? null : 'composer')} disabled={sending || recording} aria-label={russian ? 'Добавить эмодзи' : 'Add emoji'} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-brand/10 hover:text-brand disabled:opacity-40"><Smile size={18} /></button><input ref={messageInput} value={content} onChange={(event) => setContent(event.target.value)} disabled={sending || recording} maxLength={2000} placeholder={recording ? (russian ? 'Идёт запись… нажми квадрат, чтобы завершить' : 'Recording… tap the square to finish') : (russian ? 'Напиши сообщение…' : 'Write a message…')} className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm outline-none placeholder:text-muted" /><span className="hidden text-[10px] text-muted sm:inline">{content.length}/2000</span><button type="submit" disabled={(!content.trim() && !attachment) || sending || recording} aria-label={russian ? 'Отправить' : 'Send'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-[#6ab4ff] text-[#10243a] shadow-md shadow-brand/15 transition hover:-translate-y-0.5 disabled:opacity-40"><Send size={16} /></button></div>
              </form>
            </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><span className="relative grid h-24 w-24 place-items-center rounded-[30px] border border-brand/20 bg-gradient-to-br from-brand/20 via-brand/10 to-violet-500/10 text-brand shadow-xl shadow-brand/10"><MessageCircleMore size={38} /><span className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full border border-card bg-brand text-white shadow-lg"><Sparkles size={15} /></span></span><h2 className="mt-7 font-display text-2xl font-bold tracking-tight">{russian ? 'Твой круг общения' : 'Your conversations'}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted">{russian ? 'Начни личный разговор с одногруппником или найди нового знакомого в сообществе IUCA.' : 'Start a private conversation with a classmate or meet someone new in the IUCA community.'}</p><Link to="/search" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-[#6ab4ff] px-5 py-3 text-sm font-bold text-[#10243a] shadow-lg shadow-brand/20 transition hover:-translate-y-0.5"><Search size={16} />{russian ? 'Найти людей' : 'Find people'}<ArrowUpRight size={15} /></Link><div className="mt-8 flex items-center gap-2 text-xs text-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{russian ? 'Личные сообщения MogGram' : 'MogGram direct messages'}</div></div>}
          </div>
        </section>
        {forwarding && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !forwardLoading) setForwarding(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="forward-title" className="w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><h2 id="forward-title" className="font-display text-lg font-bold">{russian ? 'Переслать сообщение' : 'Forward message'}</h2><p className="mt-1 line-clamp-2 text-sm text-muted">{forwarding.content || (forwarding.attachmentType === 'image' ? (russian ? 'Фото' : 'Photo') : russian ? 'Голосовое сообщение' : 'Voice message')}</p></div><button type="button" onClick={() => setForwarding(null)} disabled={forwardLoading} aria-label={russian ? 'Закрыть' : 'Close'} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-ink"><X size={17} /></button></div>
            <p className="mb-2 mt-5 text-xs font-semibold text-muted">{russian ? 'Выбери переписку' : 'Choose a conversation'}</p>
            {error && <div className="mb-2"><Alert variant="error">{error}</Alert></div>}
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {forwardLoading && conversations.length === 0 ? <p className="py-6 text-center text-sm text-muted">{russian ? 'Загружаем переписки…' : 'Loading conversations…'}</p> : conversations.length ? conversations.map((conversation) => <button key={conversation.username} type="button" onClick={() => setForwardTarget(conversation.username)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${forwardTarget === conversation.username ? 'border-brand/50 bg-brand/10' : 'border-transparent hover:bg-surface'}`}><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-surface text-sm font-semibold">{conversation.avatarUrl ? <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" /> : conversation.fullName.charAt(0).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{conversation.fullName}</span><span className="block truncate text-xs text-muted">@{conversation.username}</span></span></button>) : <p className="py-6 text-center text-sm text-muted">{russian ? 'Нет доступных переписок.' : 'No conversations available.'}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setForwarding(null)} disabled={forwardLoading} className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:bg-surface">{russian ? 'Отмена' : 'Cancel'}</button><button type="button" onClick={() => void forwardMessage()} disabled={!forwardTarget || forwardLoading} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-[#10243a] disabled:opacity-40"><Forward size={15} />{russian ? 'Переслать' : 'Forward'}</button></div>
          </section>
        </div>}
      </main>
    </div>
  );
}
