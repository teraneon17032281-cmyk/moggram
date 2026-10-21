import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Image as ImageIcon, Link as LinkIcon, Send, Smile, UserRound, UserRoundX, X } from 'lucide-react';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import type { User } from '../../types';
import { usePreferences } from '../../contexts/PreferencesContext';

interface Props {
  user: User;
  submitting: boolean;
  error: string;
  onSubmit: (content: string, anonymous: boolean, linkUrl?: string, image?: File) => Promise<void>;
  variant?: 'card' | 'timeline' | 'feed';
}

const emojis = ['😀', '😂', '🥹', '😍', '🔥', '🎉', '❤️', '👍', '✨', '🌿', '📚', '🤔', '😎', '🙌', '💙', '☕'];

export default function PostComposer({ user, submitting, error, onSubmit, variant = 'card' }: Props) {
  const [content, setContent] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [image, setImage] = useState<File | undefined>();
  const [imagePreview, setImagePreview] = useState('');
  const [imageError, setImageError] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { t, language } = usePreferences();
  const russian = language === 'ru';
  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);
  const formStyle = variant === 'feed'
    ? 'relative overflow-visible border-0 bg-bg py-4 shadow-none ring-0 sm:py-5'
    : variant === 'timeline'
    ? 'relative overflow-visible border-0 border-b border-line bg-transparent p-4 shadow-none ring-0 sm:p-5'
    : 'relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-card via-card/95 to-surface/60 p-4 shadow-xl shadow-slate-950/10 ring-1 ring-white/[0.035] sm:p-5';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    try {
      await onSubmit(content, anonymous, linkUrl.trim() || undefined, image);
      setContent(''); setAnonymous(false); setLinkUrl(''); setImage(undefined); setImagePreview(''); setImageError(''); setLinkOpen(false); setEmojiOpen(false);
    } catch {
      // Keep the draft so it can be retried after a server error.
    }
  };

  const addEmoji = (emoji: string) => {
    const field = textareaRef.current;
    if (!field) { setContent((value) => `${value}${emoji}`); return; }
    const start = field.selectionStart;
    const end = field.selectionEnd;
    setContent((value) => `${value.slice(0, start)}${emoji}${value.slice(end)}`);
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + emoji.length, start + emoji.length); });
    setEmojiOpen(false);
  };

  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImageError(russian ? 'Выбери файл изображения.' : 'Choose an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setImageError(russian ? 'Размер фото не должен превышать 10 МБ.' : 'The photo must be 10 MB or smaller.'); return; }
    setImageError('');
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <form id={variant === 'timeline' ? 'post-composer-modern' : 'post-composer'} onSubmit={submit} className={formStyle}>
      <div aria-hidden="true" className={variant === 'timeline' ? 'hidden' : 'pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-brand/10 blur-3xl'} />
      <div className="relative">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-semibold text-ink ring-2 ring-brand/20 ring-offset-2 ring-offset-card" aria-hidden="true">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.fullName.charAt(0).toUpperCase()}
          </div>
          <div><p className="text-sm font-semibold text-ink">{t('writePost')}</p><p className="text-xs text-muted">{t('composerHint')}</p></div>
        </div>
        {(error || imageError) && <div className="mb-3"><Alert variant="error">{error || imageError}</Alert></div>}
        <label className="sr-only" htmlFor="post-content">Your post</label>
        <textarea ref={textareaRef} id="post-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} rows={variant === 'feed' ? 2 : 3} placeholder={t('postPlaceholder')} className={`w-full resize-y text-sm leading-6 text-ink outline-none placeholder:text-muted/70 focus:ring-0 ${variant === 'feed' ? 'min-h-20 border-0 bg-transparent px-0 py-2' : 'rounded-xl border border-line bg-surface/80 px-4 py-3 focus:border-brand focus:ring-2 focus:ring-brand/20'}`} />

        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(event) => chooseImage(event.target.files?.[0])} aria-label={russian ? 'Выбрать фото' : 'Choose a photo'} />
        {imagePreview && <div className="relative mt-2 inline-block"><img src={imagePreview} alt={russian ? 'Предпросмотр фото' : 'Photo preview'} className="max-h-56 max-w-full rounded-2xl border border-line object-cover" /><button type="button" onClick={() => { setImage(undefined); setImagePreview(''); if (fileRef.current) fileRef.current.value = ''; }} aria-label={russian ? 'Удалить фото' : 'Remove photo'} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"><X size={15} /></button></div>}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} aria-label={russian ? 'Прикрепить фото' : 'Attach a photo'} className={`grid h-9 w-9 place-items-center rounded-lg transition ${image ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-brand/10 hover:text-brand'}`}><ImageIcon size={18} /></button>
            <div className="relative">
              <button type="button" onClick={() => { setEmojiOpen((value) => !value); setLinkOpen(false); }} aria-label={russian ? 'Добавить эмодзи' : 'Add emoji'} aria-expanded={emojiOpen} className={`grid h-9 w-9 place-items-center rounded-lg transition ${emojiOpen ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-brand/10 hover:text-brand'}`}><Smile size={18} /></button>
              {emojiOpen && <div className="absolute bottom-11 left-0 z-30 grid w-56 grid-cols-8 gap-1 rounded-2xl border border-line bg-card p-2 shadow-2xl shadow-slate-950/30">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => addEmoji(emoji)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-surface" aria-label={`${russian ? 'Добавить' : 'Add'} ${emoji}`}>{emoji}</button>)}</div>}
            </div>
            <button type="button" onClick={() => { setLinkOpen((value) => !value); setEmojiOpen(false); }} aria-label={russian ? 'Прикрепить ссылку' : 'Attach a link'} aria-expanded={linkOpen} className={`grid h-9 w-9 place-items-center rounded-lg transition ${linkOpen || linkUrl ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-brand/10 hover:text-brand'}`}><LinkIcon size={18} /></button>
            <button
              type="button"
              role="switch"
              aria-checked={anonymous}
              aria-label={t('anonymous')}
              onClick={() => setAnonymous((value) => !value)}
              className={`ml-1 inline-flex h-10 items-center gap-2.5 rounded-full border px-3 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${anonymous ? 'border-brand/35 bg-brand/[0.12] text-brand shadow-sm shadow-brand/10' : 'border-line bg-surface/55 text-muted hover:border-brand/25 hover:text-ink'}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${anonymous ? 'bg-brand/15' : 'bg-card/80'}`}>
                {anonymous ? <UserRoundX size={15} /> : <UserRound size={15} />}
              </span>
              <span className="text-left leading-tight">
                <span className="block text-[11px] font-semibold">{anonymous ? (russian ? 'Анонимно' : 'Anonymous') : (russian ? 'От своего имени' : 'As myself')}</span>
                <span className={`mt-0.5 block text-[9px] ${anonymous ? 'text-brand/75' : 'text-muted'}`}>{anonymous ? (russian ? 'Имя скрыто' : 'Name hidden') : (russian ? 'Имя видно' : 'Name visible')}</span>
              </span>
              <span aria-hidden="true" className={`ml-1 flex h-[18px] w-8 shrink-0 items-center rounded-full p-[2px] transition-colors ${anonymous ? 'bg-brand' : 'bg-line'}`}>
                <span className={`h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${anonymous ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </span>
            </button>
          </div>
          <div className="flex items-center justify-end gap-3"><span className="text-xs text-muted">{content.length}/500</span><Button type="submit" loading={submitting} disabled={!content.trim() && !image} className="!w-auto">{submitting ? t('publishing') : <>{t('publish')} <Send size={15} /></>}</Button></div>
        </div>

        {linkOpen && <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface/60 p-2.5"><LinkIcon size={16} className="shrink-0 text-brand" /><input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder={russian ? 'Вставь ссылку https://…' : 'Paste a link https://…'} className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted" /><button type="button" onClick={() => { setLinkUrl(''); setLinkOpen(false); }} aria-label={russian ? 'Убрать ссылку' : 'Remove link'} className="rounded-md p-1 text-muted hover:bg-card hover:text-ink"><X size={15} /></button></div>}
        {!linkOpen && linkUrl && <button type="button" onClick={() => setLinkOpen(true)} className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand"><LinkIcon size={14} /><span className="truncate">{linkUrl}</span></button>}
      </div>
    </form>
  );
}
