import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Camera, Heart, MessageCircle, Pencil, Repeat2, Save, X } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import PostCard from '../components/feed/PostCard';
import FollowListModal from '../components/profile/FollowListModal';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { feedService } from '../services/feedService';
import { errorMessage } from '../services/apiClient';
import { userService } from '../services/userService';
import type { CommentActivity, Post } from '../types';

type ProfileTab = 'posts' | 'reposts' | 'liked' | 'comments';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { t, language, showOwnAnonymousPosts } = usePreferences();
  const [posts, setPosts] = useState<Post[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [commentedPosts, setCommentedPosts] = useState<CommentActivity[]>([]);
  const [listErrors, setListErrors] = useState<Partial<Record<'reposts' | 'liked' | 'comments', string>>>({});
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ownResult, repostResult, likedResult, commentedResult] = await Promise.allSettled([feedService.getMyPosts(), feedService.getMyReposts(), feedService.getMyLikedPosts(), feedService.getMyCommentedPosts()]);
      if (ownResult.status === 'rejected') throw ownResult.reason;
      const ownPosts = ownResult.value;
      setPosts(ownPosts.filter((post) => post.isAnonymous || post.author?.id === user?.id));
      setRepostedPosts(repostResult.status === 'fulfilled' ? repostResult.value : []);
      setLikedPosts(likedResult.status === 'fulfilled' ? likedResult.value : []);
      setCommentedPosts(commentedResult.status === 'fulfilled' ? commentedResult.value : []);
      setListErrors({
        ...(repostResult.status === 'rejected' ? { reposts: errorMessage(repostResult.reason) } : {}),
        ...(likedResult.status === 'rejected' ? { liked: errorMessage(likedResult.reason) } : {}),
        ...(commentedResult.status === 'rejected' ? { comments: errorMessage(commentedResult.reason) } : {}),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!user) return;
    void userService.getMyProfile().then((profile) => {
      setProfileBio(profile.bio ?? '');
      setProfileAvatar(profile.avatarUrl ?? null);
    }).catch(() => undefined);
  }, [user?.id]);
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(''); return; }
    const preview = URL.createObjectURL(avatarFile);
    setAvatarPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [avatarFile]);
  if (!user) return null;
  const visiblePosts = posts.filter((post) => !post.isAnonymous || showOwnAnonymousPosts);
  const selectedPosts = activeTab === 'posts' ? visiblePosts : activeTab === 'reposts' ? repostedPosts : activeTab === 'liked' ? likedPosts : commentedPosts.map((activity) => activity.post);
  const selectedError = activeTab === 'posts' ? '' : listErrors[activeTab];

  const startEditing = () => {
    setEditName(user.fullName); setEditUsername(user.username); setEditBio(profileBio);
    setAvatarFile(null); setAvatarPreview(''); setEditing(true); setError('');
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true); setError('');
    try {
      const updated = await userService.updateMyProfile({ fullName: editName, username: editUsername, bio: editBio, avatar: avatarFile });
      setProfileBio(updated.bio ?? editBio); setProfileAvatar(updated.avatarUrl ?? profileAvatar);
      await refreshUser(); setAvatarFile(null); setEditing(false);
    } catch (err) { setError(errorMessage(err)); }
    finally { setSavingProfile(false); }
  };

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} />{t('backToFeed')}</Link>
        <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-card via-card to-surface/50 p-6 shadow-lg shadow-slate-950/[0.06] sm:p-8">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brand/20 via-brand/5 to-violet-400/10" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-surface text-lg font-semibold ring-2 ring-brand/20" aria-hidden="true">{profileAvatar || user.avatarUrl ? <img src={profileAvatar || user.avatarUrl || ''} alt="" className="h-full w-full object-cover" /> : user.fullName.charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <h1 className="flex min-w-0 flex-wrap items-center gap-x-2 font-display text-2xl font-bold tracking-tight"><span className="break-words">{user.fullName}</span>{user.isVerified && <BadgeCheck size={19} className="shrink-0 text-brand" />}</h1>
              <p className="text-sm text-muted">@{user.username}</p>
            </div>
            <div className="flex gap-2"><button type="button" onClick={startEditing} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card/70 px-3 text-xs font-semibold text-muted transition hover:border-brand/30 hover:text-brand"><Pencil size={14} />{language === 'ru' ? 'Редактировать' : 'Edit profile'}</button><Link to="/messages" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card/70 px-3 text-xs font-semibold text-muted transition hover:border-brand/30 hover:text-brand"><MessageCircle size={15} /><span className="hidden sm:inline">{language === 'ru' ? 'Сообщения' : 'Messages'}</span></Link></div>
          </div>
          <p className="relative mt-4 whitespace-pre-wrap text-sm text-muted">{profileBio || t('profileIntro')}</p>
          <div className="relative mt-5 flex flex-wrap gap-6 border-t border-line/70 pt-4 text-sm"><span><b>{visiblePosts.length}</b> <small className="text-muted">{language === 'ru' ? 'публикаций' : 'posts'}</small></span><button type="button" onClick={() => setFollowList('followers')} className="text-left transition hover:text-brand" aria-label={language === 'ru' ? 'Посмотреть подписчиков' : 'View followers'}><b>{user.followersCount ?? 0}</b> <small className="text-muted">{language === 'ru' ? 'подписчиков' : 'followers'}</small></button><button type="button" onClick={() => setFollowList('following')} className="text-left transition hover:text-brand" aria-label={language === 'ru' ? 'Посмотреть подписки' : 'View following'}><b>{user.followingCount ?? 0}</b> <small className="text-muted">{language === 'ru' ? 'подписок' : 'following'}</small></button></div>
        </section>
        {editing && <form onSubmit={(event) => void saveProfile(event)} className="space-y-4 rounded-3xl border border-line bg-card p-5 shadow-xl shadow-slate-950/[0.08] sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">{language === 'ru' ? 'Настроить профиль' : 'Customize profile'}</h2><p className="mt-1 text-xs text-muted">{language === 'ru' ? 'Обнови имя, ник, фото и описание.' : 'Update your name, username, photo and bio.'}</p></div><button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(''); setEditing(false); }} aria-label={language === 'ru' ? 'Закрыть' : 'Close'} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-ink"><X size={17} /></button></div>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface/40 p-4"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-surface text-lg font-semibold text-ink ring-2 ring-brand/25">{avatarPreview || profileAvatar || user.avatarUrl ? <img src={avatarPreview || profileAvatar || user.avatarUrl || ''} alt="" className="h-full w-full object-cover" /> : user.fullName.charAt(0).toUpperCase()}</div><div><input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { setError(language === 'ru' ? 'Аватар должен быть не больше 5 МБ.' : 'Avatar must be 5 MB or smaller.'); event.currentTarget.value = ''; return; } setError(''); setAvatarFile(file); }} /><button type="button" onClick={() => avatarInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/15"><Camera size={15} />{language === 'ru' ? 'Загрузить аватар' : 'Upload avatar'}</button><p className="mt-1.5 text-[10px] text-muted">PNG, JPG, WEBP · {language === 'ru' ? 'до 5 МБ' : 'up to 5 MB'}</p></div></div>
          <label className="block text-xs font-semibold text-muted">{language === 'ru' ? 'Имя' : 'Name'}<input required maxLength={80} value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-bg/60 px-3 text-sm text-ink outline-none focus:border-brand" /></label>
          <label className="block text-xs font-semibold text-muted">{language === 'ru' ? 'Никнейм' : 'Username'}<div className="mt-1.5 flex h-11 items-center rounded-xl border border-line bg-bg/60 px-3 focus-within:border-brand"><span className="text-sm text-muted">@</span><input required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]+" value={editUsername} onChange={(event) => setEditUsername(event.target.value)} className="min-w-0 flex-1 bg-transparent pl-1 text-sm text-ink outline-none" /></div></label>
          <label className="block text-xs font-semibold text-muted">Bio<textarea maxLength={160} rows={3} value={editBio} onChange={(event) => setEditBio(event.target.value)} placeholder={language === 'ru' ? 'Расскажи немного о себе…' : 'Tell people a little about yourself…'} className="mt-1.5 w-full resize-y rounded-xl border border-line bg-bg/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand" /></label>
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" loading={savingProfile} className="!w-auto"><Save size={15} />{language === 'ru' ? 'Сохранить профиль' : 'Save profile'}</Button>
        </form>}
        <div>
          <div className="mb-3 flex gap-2 overflow-x-auto border-b border-line">
            {([
              { id: 'posts' as const, label: language === 'ru' ? 'Публикации' : 'Posts', count: visiblePosts.length, Icon: MessageCircle },
              { id: 'reposts' as const, label: language === 'ru' ? 'Репосты' : 'Reposts', count: repostedPosts.length, Icon: Repeat2 },
              { id: 'liked' as const, label: language === 'ru' ? 'Понравившиеся' : 'Liked', count: likedPosts.length, Icon: Heart },
              { id: 'comments' as const, label: language === 'ru' ? 'Комментарии' : 'Comments', count: commentedPosts.length, Icon: MessageCircle },
            ]).map(({ id, label, count, Icon }) => <button key={id} type="button" onClick={() => setActiveTab(id)} aria-pressed={activeTab === id} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${activeTab === id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}><Icon size={16} />{label}<span className="text-xs text-muted">{count}</span></button>)}
          </div>
          {activeTab === 'posts' && showOwnAnonymousPosts && <p className="mb-4 text-xs text-muted">{t('anonymousPrivate')}</p>}
          {error && <Alert variant="error">{error}</Alert>}
          {selectedError && <Alert variant="error">{selectedError}</Alert>}
          {loading ? (
            <div className="rounded-2xl border border-line bg-card px-5 py-12 text-center text-sm text-muted" role="status">{t('loadingFeed')}</div>
          ) : error ? (
            <Button variant="secondary" onClick={() => void load()} className="mx-auto mt-4 !w-auto">{t('tryAgain')}</Button>
          ) : selectedPosts.length ? (
            activeTab === 'comments' ? <div className="space-y-4">{commentedPosts.map(({ post, comment }) => <article key={comment.id} className="space-y-2"><div className="rounded-2xl border border-line bg-card/70 p-4"><p className="mb-1 text-xs font-medium text-muted">{language === 'ru' ? 'Твой комментарий' : 'Your comment'}</p><p className="text-sm text-ink">{comment.content}</p></div><PostCard post={post} /></article>)}</div> : <div className="space-y-4">{selectedPosts.map((post) => <PostCard key={`${activeTab}-${post.id}`} post={post} />)}</div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-card/50 px-5 py-12 text-center text-sm text-muted">{t('noPosts')}</div>
          )}
        </div>
      {followList && <FollowListModal username={user.username} relation={followList} onClose={() => setFollowList(null)} />}
      </main>
    </div>
  );
}
