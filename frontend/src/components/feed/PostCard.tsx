import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  GraduationCap,
  Heart,
  Link as LinkIcon,
  MessageCircle,
  Pencil,
  Repeat2,
  Trash2,
} from 'lucide-react';
import type { Post, PostComment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { feedService } from '../../services/feedService';

function Avatar({
  src,
  name,
  size = 'h-10 w-10',
}: {
  src?: string | null;
  name: string;
  size?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-sm font-semibold text-ink ring-2 ring-brand/15 ring-offset-2 ring-offset-bg`}
      aria-hidden="true"
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export default function PostCard({
  post,
  variant = 'card',
}: {
  post: Post;
  variant?: 'card' | 'timeline' | 'desktop-feed';
}) {
  const { user } = useAuth();
  const { t, language } = usePreferences();

  const anonymous = post.isAnonymous || !post.author;
  const displayName = anonymous ? t('anonymousUser') : post.author!.fullName;
  const authorHref = !anonymous
    ? `/users/${encodeURIComponent(post.author!.username)}`
    : undefined;
  const isOwner = Boolean(
    user && post.author && user.username === post.author.username,
  );

  const date = new Date(post.createdAt);
  const [liked, setLiked] = useState(post.likedByMe ?? false);
  const [likes, setLikes] = useState(post.likeCount ?? 0);
  const [reposts, setReposts] = useState(post.repostCount ?? 0);
  const [reposted, setReposted] = useState(post.repostedByMe === true);
  const [commentsCount, setCommentsCount] = useState(post.commentCount ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deleted, setDeleted] = useState(false);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content);
  const [linkUrl, setLinkUrl] = useState(post.linkUrl ?? '');
  const [draftContent, setDraftContent] = useState(post.content);
  const [draftLinkUrl, setDraftLinkUrl] = useState(post.linkUrl ?? '');

  const toggleLike = async () => {
    setActionError('');
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikes((count) => Math.max(0, count + (wasLiked ? -1 : 1)));
    setBusy(true);

    try {
      const result = await feedService.toggleLike(post.id);
      setLiked(result.liked);
      setLikes(result.likeCount);
    } catch {
      setLiked(wasLiked);
      setLikes((count) => Math.max(0, count + (wasLiked ? 1 : -1)));
      setActionError(t('actionUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  const toggleComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    setActionError('');

    if (!opening || commentsLoaded) return;

    try {
      setComments(await feedService.getComments(post.id));
      setCommentsLoaded(true);
    } catch {
      setActionError(t('commentsUnavailable'));
    }
  };

  const toggleRepost = async () => {
    setActionError('');
    if (busy) return;

    const wasReposted = reposted;
    setReposted(!wasReposted);
    setReposts((value) => Math.max(0, value + (wasReposted ? -1 : 1)));
    setBusy(true);

    try {
      const result = await feedService.toggleRepost(post.id);
      setReposted(result.reposted);
      setReposts(result.repostCount);
    } catch {
      setReposted(wasReposted);
      setReposts((value) => Math.max(0, value + (wasReposted ? 1 : -1)));
      setActionError(t('actionUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    const commentContent = commentText.trim();
    if (!commentContent) return;

    setActionError('');
    setBusy(true);

    try {
      const comment = await feedService.addComment(post.id, commentContent);
      setComments((current) => [...current, comment]);
      setCommentsCount((value) => value + 1);
      setCommentText('');
      setCommentsLoaded(true);
    } catch {
      setActionError(t('commentsUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  const savePost = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setActionError('');
    setBusy(true);

    try {
      const updated = await feedService.updatePost(
        post.id,
        draftContent,
        draftLinkUrl,
      );
      setContent(updated.content);
      setLinkUrl(updated.linkUrl ?? '');
      setEditing(false);
    } catch {
      setActionError(t('actionUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  const cancelEditing = () => {
    setDraftContent(content);
    setDraftLinkUrl(linkUrl);
    setEditing(false);
    setActionError('');
  };

  const deletePost = async () => {
    if (busy || !window.confirm('Удалить эту публикацию?')) return;

    setActionError('');
    setBusy(true);

    try {
      await feedService.deletePost(post.id);
      setDeleted(true);
    } catch {
      setActionError(t('actionUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  const dateLocale = language === 'ru' ? 'ru-RU' : 'en-US';

  const articleStyle =
    variant === 'desktop-feed'
      ? 'group mx-0 my-0 rounded-none border-0 border-b border-line bg-transparent px-5 py-5 shadow-none ring-0 transition-colors hover:bg-white/[0.025]'
      : variant === 'timeline'
        ? 'group mx-0 my-0 rounded-none border-0 border-b border-line bg-transparent px-5 py-5 shadow-none ring-0 transition-colors hover:bg-white/[0.025]'
        : 'group mx-3 my-3 rounded-2xl border border-line/70 bg-gradient-to-br from-card via-card to-surface/40 px-4 py-4 shadow-md shadow-slate-950/[0.07] ring-1 ring-white/[0.025] transition duration-200 hover:-translate-y-px hover:border-brand/25 hover:shadow-xl hover:shadow-slate-950/10 sm:mx-4 sm:px-5 sm:py-5';

  const safeLink = (() => {
    if (!linkUrl) return null;

    try {
      const url = new URL(linkUrl);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
    } catch {
      return null;
    }
  })();

  if (deleted) return null;

  return (
    <article className={articleStyle}>
      <div className="flex items-start gap-3">
        {authorHref ? (
          <Link
            to={authorHref}
            aria-label={`${t('profile')}: ${displayName}`}
            className="rounded-full transition hover:opacity-80"
          >
            <Avatar
              src={post.author?.avatarUrl}
              name={displayName}
              size="h-10 w-10 sm:h-11 sm:w-11"
            />
          </Link>
        ) : (
          <Avatar
            src={anonymous ? '/avatars/default.svg' : post.author?.avatarUrl}
            name={displayName}
            size="h-10 w-10 sm:h-11 sm:w-11"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {authorHref ? (
              <Link
                to={authorHref}
                className="inline-flex min-w-0 items-center gap-1.5 text-left transition hover:text-brand"
              >
                <span className="truncate text-sm font-semibold text-ink hover:text-brand">
                  {displayName}
                </span>
                {post.author?.isVerified && <BadgeCheck size={15} className="shrink-0 text-brand" aria-label="Verified account" />}
                {post.author?.isTeacher && <GraduationCap size={16} className="shrink-0 text-emerald-400" aria-label={language === 'ru' ? 'Преподаватель' : 'Teacher'} />}
                <span className="truncate text-xs text-muted">
                  @{post.author!.username}
                </span>
              </Link>
            ) : (
              <>
                <p className="truncate text-sm font-semibold text-ink">
                  {displayName}
                </p>
                {!anonymous && post.author?.isVerified && <BadgeCheck size={15} className="shrink-0 text-brand" aria-label="Verified account" />}
                {!anonymous && post.author?.isTeacher && <GraduationCap size={16} className="shrink-0 text-emerald-400" aria-label={language === 'ru' ? 'Преподаватель' : 'Teacher'} />}
                {!anonymous && (
                  <span className="truncate text-xs text-muted">
                    @{post.author!.username}
                  </span>
                )}
              </>
            )}

            <span className="text-xs text-muted">
              ·{' '}
              {Number.isNaN(date.getTime())
                ? ''
                : date.toLocaleString(dateLocale, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
            </span>
          </div>

          {anonymous && (
            <p className="mt-0.5 text-xs text-muted">
              {t('postedAnonymously')}
            </p>
          )}

          {editing ? (
            <form onSubmit={savePost} className="mt-3 space-y-3">
              <textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                maxLength={5000}
                rows={4}
                placeholder="Текст публикации"
                className="w-full resize-y rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
              <input
                value={draftLinkUrl}
                onChange={(event) => setDraftLinkUrl(event.target.value)}
                maxLength={500}
                placeholder="Ссылка (необязательно)"
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {language === 'ru' ? 'Сохранить' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={busy}
                  className="rounded-full border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
                >
                  {language === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {content && (
                <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-ink/95">
                  {content}
                </p>
              )}

              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt=""
                  loading="lazy"
                  className="mt-4 max-h-[520px] w-full rounded-2xl border border-white/10 object-cover shadow-xl shadow-slate-950/20"
                />
              )}

              {safeLink && (
                <a
                  href={safeLink.toString()}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-brand/15 bg-brand/[0.06] px-3 py-2 text-sm text-brand transition hover:border-brand/35 hover:bg-brand/10"
                >
                  <LinkIcon size={15} className="shrink-0" />
                  <span className="truncate">
                    {safeLink.hostname}
                    {safeLink.pathname !== '/' ? safeLink.pathname : ''}
                  </span>
                </a>
              )}
            </>
          )}

          <div className="mt-3 flex max-w-[560px] items-center justify-between border-t border-line/50 pt-2 text-xs text-muted">
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={busy}
              aria-label={`${t('like')} (${likes})`}
              aria-pressed={liked}
              className={`group inline-flex items-center gap-2 rounded-full px-2.5 py-2 transition disabled:opacity-50 ${
                liked
                  ? 'bg-rose-400/10 text-rose-400'
                  : 'hover:bg-rose-400/10 hover:text-rose-400'
              }`}
            >
              <Heart
                size={17}
                className={`transition group-hover:scale-110 ${
                  liked ? 'fill-current' : ''
                }`}
              />
              {likes}
            </button>

            <button
              type="button"
              onClick={() => void toggleComments()}
              aria-label={`${t('comment')} (${commentsCount})`}
              aria-expanded={commentsOpen}
              className="group inline-flex items-center gap-2 rounded-full px-2.5 py-2 transition hover:bg-brand/10 hover:text-brand"
            >
              <MessageCircle
                size={17}
                className="transition group-hover:scale-110"
              />
              {commentsCount}
            </button>

            <button
              type="button"
              onClick={() => void toggleRepost()}
              disabled={busy}
              aria-label={`${reposted ? (language === 'ru' ? 'Убрать репост' : 'Undo repost') : t('repost')} (${reposts})`}
              aria-pressed={reposted}
              className={`group inline-flex items-center gap-2 rounded-full px-2.5 py-2 transition disabled:opacity-50 ${
                reposted
                  ? 'bg-emerald-400/10 text-emerald-400'
                  : 'hover:bg-emerald-400/10 hover:text-emerald-400'
              }`}
            >
              <Repeat2
                size={17}
                className="transition group-hover:scale-110"
              />
              {reposts}
            </button>


          </div>
        </div>

        {isOwner && (
          <div className="flex shrink-0 items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setDraftContent(content);
                  setDraftLinkUrl(linkUrl);
                  setEditing(true);
                  setActionError('');
                }}
                disabled={busy}
                aria-label="Редактировать публикацию"
                title="Редактировать публикацию"
                className="rounded-full p-2 text-muted transition hover:bg-brand/10 hover:text-brand disabled:opacity-50"
              >
                <Pencil size={17} />
              </button>
            )}

            <button
              type="button"
              onClick={() => void deletePost()}
              disabled={busy}
              aria-label="Удалить публикацию"
              title="Удалить публикацию"
              className="rounded-full p-2 text-muted transition hover:bg-rose-400/10 hover:text-rose-400 disabled:opacity-50"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <p role="status" className="mt-2 pl-14 text-xs text-rose-300">
          {actionError}
        </p>
      )}

      {commentsOpen && (
        <div className="mt-3 border-t border-line pt-3 sm:ml-14">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5 py-2">
              <Avatar
                src={comment.author.avatarUrl}
                name={comment.author.fullName}
                size="h-8 w-8"
              />
              <div className="min-w-0 rounded-xl bg-card px-3 py-2">
                <p className="text-xs font-semibold text-ink">
                  {comment.author.fullName}{' '}
                  <span className="font-normal text-muted">
                    @{comment.author.username}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}

          {commentsLoaded && comments.length === 0 && (
            <p className="py-2 text-xs text-muted">{t('noComments')}</p>
          )}

          <form onSubmit={addComment} className="mt-2 flex items-center gap-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={t('commentPlaceholder')}
              maxLength={1000}
              className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || busy}
              className="rounded-full px-3 py-2 text-xs font-semibold text-brand hover:bg-card disabled:opacity-40"
            >
              {t('reply')}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
