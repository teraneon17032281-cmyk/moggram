import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Heart, MessageCircle, Repeat2, UserRoundCheck, UserRoundPlus } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import PostCard from '../components/feed/PostCard';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { errorMessage } from '../services/apiClient';
import { feedService } from '../services/feedService';
import { userService } from '../services/userService';
import type { CampusProfile, CommentActivity, Post } from '../types';

type PublicProfileTab = 'posts' | 'reposts' | 'liked' | 'comments';

export default function PublicProfilePage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { language } = usePreferences();
  const russian = language === 'ru';
  const [profile, setProfile] = useState<CampusProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [commentedPosts, setCommentedPosts] = useState<CommentActivity[]>([]);
  const [activeTab, setActiveTab] = useState<PublicProfileTab>('posts');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true); setError('');
    try {
      const person = await userService.getProfile(username);
      const [entriesResult, repostResult, likedResult, commentedResult] = await Promise.allSettled([
        feedService.getUserPosts(username),
        person.showReposts ? feedService.getUserReposts(username) : Promise.resolve([]),
        person.showLikedPosts ? feedService.getUserLikedPosts(username) : Promise.resolve([]),
        person.showCommentedPosts ? feedService.getUserCommentedPosts(username) : Promise.resolve([]),
      ]);
      if (entriesResult.status === 'rejected') throw entriesResult.reason;
      setProfile(person); setPosts(entriesResult.value);
      setReposts(repostResult.status === 'fulfilled' ? repostResult.value : []);
      setLikedPosts(likedResult.status === 'fulfilled' ? likedResult.value : []);
      setCommentedPosts(commentedResult.status === 'fulfilled' ? commentedResult.value : []);
      const failedList = repostResult.status === 'rejected' ? repostResult.reason : likedResult.status === 'rejected' ? likedResult.reason : commentedResult.status === 'rejected' ? commentedResult.reason : null;
      setListError(failedList ? errorMessage(failedList) : '');
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [username]);

  useEffect(() => { if (currentUser?.username === username) navigate('/profile', { replace: true }); else void load(); }, [currentUser?.username, load, navigate, username]);

  const toggleFollow = async () => {
    if (!profile) return;
    setWorking(true); setError('');
    try {
      const result = await userService.toggleFollow(profile.username);
      setProfile((current) => current ? { ...current, isFollowing: result.following, followersCount: result.followersCount } : current);
    } catch (err) { setError(errorMessage(err)); }
    finally { setWorking(false); }
  };

  const selectedPosts = activeTab === 'posts' ? posts : activeTab === 'reposts' ? reposts : activeTab === 'liked' ? likedPosts : commentedPosts.map((activity) => activity.post);

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-7 sm:px-6 lg:py-10">
        <Link to="/search" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} />{russian ? 'К поиску' : 'Back to search'}</Link>
        {error && <Alert variant="error">{error}</Alert>}
        {loading ? <div className="rounded-2xl border border-line bg-card px-5 py-12 text-center text-sm text-muted">{russian ? 'Загружаем профиль…' : 'Loading profile…'}</div> : !profile ? <div className="rounded-2xl border border-line bg-card px-5 py-12 text-center text-sm text-muted">{russian ? 'Профиль не найден.' : 'Profile not found.'}</div> : <>
          <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-card via-card to-surface/50 p-6 shadow-lg shadow-slate-950/[0.06] sm:p-8">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-brand/20 via-brand/5 to-violet-400/10" />
            <div className="relative flex flex-wrap items-end gap-4 pt-8">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-card bg-surface text-2xl font-bold ring-2 ring-brand/20">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : profile.fullName.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1 pb-1"><h1 className="flex items-center gap-2 truncate font-display text-2xl font-bold tracking-tight">{profile.fullName}{profile.isVerified && <BadgeCheck size={19} className="shrink-0 text-brand" />}</h1><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"><span>@{profile.username} · IUCA</span>{profile.isOnline !== undefined && <span className={`inline-flex items-center gap-1.5 text-xs ${profile.isOnline ? 'text-emerald-500' : 'text-muted'}`}><span className={`h-1.5 w-1.5 rounded-full ${profile.isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />{profile.isOnline ? (russian ? 'В сети' : 'Online') : (russian ? 'Не в сети' : 'Offline')}</span>}</p></div>
              <div className="flex gap-2">
                <Button variant={profile.isFollowing ? 'secondary' : 'primary'} onClick={() => void toggleFollow()} loading={working} className="!w-auto !px-4">{profile.isFollowing ? <><UserRoundCheck size={16} />{russian ? 'Вы подписаны' : 'Following'}</> : <><UserRoundPlus size={16} />{russian ? 'Подписаться' : 'Follow'}</>}</Button>
                <Link to={`/messages?to=${encodeURIComponent(profile.username)}`} aria-label={russian ? 'Написать сообщение' : 'Send a message'} className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-card/80 text-muted transition hover:border-brand/30 hover:text-brand"><MessageCircle size={18} /></Link>
              </div>
            </div>
            {profile.bio && <p className="relative mt-5 text-sm leading-6 text-muted">{profile.bio}</p>}
            <div className="relative mt-6 flex gap-6 border-t border-line/70 pt-4 text-sm"><span><b>{profile.postCount}</b> <small className="text-muted">{russian ? 'публикаций' : 'posts'}</small></span><span><b>{profile.followersCount}</b> <small className="text-muted">{russian ? 'подписчиков' : 'followers'}</small></span><span><b>{profile.followingCount}</b> <small className="text-muted">{russian ? 'подписок' : 'following'}</small></span></div>
          </section>
          <section>
            <div className="mb-3 flex gap-2 overflow-x-auto border-b border-line">
              <button type="button" onClick={() => setActiveTab('posts')} aria-pressed={activeTab === 'posts'} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${activeTab === 'posts' ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{russian ? 'Публикации' : 'Posts'}</button>
              {profile.showReposts && <button type="button" onClick={() => setActiveTab('reposts')} aria-pressed={activeTab === 'reposts'} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${activeTab === 'reposts' ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}><Repeat2 size={16} />{russian ? 'Репосты' : 'Reposts'}</button>}
              {profile.showLikedPosts && <button type="button" onClick={() => setActiveTab('liked')} aria-pressed={activeTab === 'liked'} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${activeTab === 'liked' ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}><Heart size={16} />{russian ? 'Понравившиеся' : 'Liked'}</button>}
              {profile.showCommentedPosts && <button type="button" onClick={() => setActiveTab('comments')} aria-pressed={activeTab === 'comments'} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${activeTab === 'comments' ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}><MessageCircle size={16} />{russian ? 'Комментарии' : 'Comments'}</button>}
            </div>
            {listError && <Alert variant="error">{listError}</Alert>}
            {selectedPosts.length ? activeTab === 'comments' ? <div className="space-y-4">{commentedPosts.map(({ post, comment }) => <article key={comment.id} className="space-y-2"><div className="rounded-2xl border border-line bg-card/70 p-4"><p className="mb-1 text-xs font-medium text-muted">{russian ? 'Комментарий' : 'Comment'}</p><p className="text-sm text-ink">{comment.content}</p></div><PostCard post={post} /></article>)}</div> : <div className="space-y-3">{selectedPosts.map((post) => <PostCard key={`${activeTab}-${post.id}`} post={post} />)}</div> : <p className="rounded-2xl border border-dashed border-line bg-card/50 px-5 py-10 text-center text-sm text-muted">{russian ? 'Здесь пока нет публикаций.' : 'Nothing to show here yet.'}</p>}
          </section>
        </>}
        {error && !loading && <Button variant="secondary" onClick={() => void load()} className="mx-auto !w-auto">{russian ? 'Повторить' : 'Try again'}</Button>}
      </main>
    </div>
  );
}
