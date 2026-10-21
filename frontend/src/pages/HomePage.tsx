import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, RefreshCw, Search } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import PostCard from '../components/feed/PostCard';
import PostComposer from '../components/feed/PostComposer';
import { useAuth } from '../contexts/AuthContext';
import { feedService } from '../services/feedService';
import { errorMessage } from '../services/apiClient';
import type { Post } from '../types';
import { usePreferences } from '../contexts/PreferencesContext';

const topics = ['#Учёба', '#Экзамены', '#Студенты', '#События'];

export default function HomePage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<'new' | 'popular' | 'random'>('new');
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const postsRef = useRef<Post[]>([]);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [postError, setPostError] = useState('');
  const { t } = usePreferences();

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setFeedError('');
    try { setPosts(await feedService.getFeed(sort)); }
    catch (error) { setFeedError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [sort]);

  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { void loadFeed(); }, [loadFeed]);
  useEffect(() => { feedScrollRef.current?.scrollTo({ top: 0 }); }, [sort]);
  useEffect(() => {
    if (sort !== 'new') { setNewPostsAvailable(false); return; }
    const checkForNewPosts = async () => {
      try {
        const latest = await feedService.getFeed('new');
        const visibleIds = new Set(postsRef.current.map((post) => post.id));
        if (latest.some((post) => !visibleIds.has(post.id))) setNewPostsAvailable(true);
      } catch { /* Keep the current feed visible if a background refresh fails. */ }
    };
    const interval = window.setInterval(() => { void checkForNewPosts(); }, 30000);
    return () => window.clearInterval(interval);
  }, [sort]);
  if (!user) return null;

  const publish = async (content: string, anonymous: boolean, linkUrl?: string, image?: File) => {
    setPostError(''); setSubmitting(true);
    try {
      const post = await feedService.createPost(content, anonymous, linkUrl, image);
      if (sort === 'new') setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
      else await loadFeed();
    } catch (error) { setPostError(errorMessage(error)); throw error; }
    finally { setSubmitting(false); }
  };

  return (
    <div className="h-[100dvh] overflow-hidden lg:pl-60">
      <AppHeader />
      <main className="mx-auto grid h-[calc(100dvh-3.5rem-62px-env(safe-area-inset-bottom))] min-h-0 max-w-[1440px] grid-cols-1 grid-rows-[minmax(0,1fr)] gap-0 px-0 sm:px-5 lg:h-[100dvh] 2xl:grid-cols-[minmax(0,760px)_280px] 2xl:gap-10">
        <section className="flex min-h-0 min-w-0 flex-col border-line lg:border-x" aria-label="Community feed">
          <div className="z-10 flex h-[68px] shrink-0 items-center justify-between border-b border-line bg-bg px-5">
            <div><h1 className="font-display text-lg font-bold tracking-tight text-ink">{t('feed')}</h1><p className="hidden text-[11px] text-muted sm:block">{t('community')} <span className="mx-1 text-brand/70">·</span> IUCA</p></div>
            <Link to="/search" className="hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs text-muted transition hover:border-brand/30 hover:text-ink md:flex"><Search size={16} /><span>{t('searchPeople')} · @iuca.kg</span></Link>
          </div>
          <div className="shrink-0 border-b border-line bg-bg px-4 sm:px-5"><PostComposer user={user} submitting={submitting} error={postError} onSubmit={publish} variant="feed" /></div>
          {newPostsAvailable && sort === 'new' && <div className="flex shrink-0 justify-center border-b border-line py-2"><button type="button" onClick={() => { setNewPostsAvailable(false); void loadFeed(); feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand/20">{t('newPosts')}</button></div>}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-3 sm:px-5"><div role="tablist" aria-label={t('feedSort')} className="flex min-w-0 gap-1 overflow-x-auto">{(['new', 'popular', 'random'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={sort === value} onClick={() => setSort(value)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 ${sort === value ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-muted hover:bg-card hover:text-ink'}`}>{t(value === 'new' ? 'feedNew' : value === 'popular' ? 'feedPopular' : 'feedRandom')}</button>)}</div><button onClick={() => void loadFeed()} aria-label={t('refresh')} title={t('refresh')} className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-card hover:text-ink" type="button"><RefreshCw size={15} /><span className="hidden sm:inline">{t('refresh')}</span></button></div>
          <div ref={feedScrollRef} className="min-h-0 flex-1 overscroll-contain overflow-y-auto">
            {feedError && <div className="px-5 pt-4"><Alert variant="error">{feedError}</Alert></div>}
            {loading ? <div className="px-5 py-12 text-center text-sm text-muted" role="status">{t('loadingFeed')}</div> : feedError ? <div className="px-5 py-10 text-center"><p className="text-sm text-muted">{t('feedUnavailable')}</p><Button variant="secondary" onClick={() => void loadFeed()} className="mx-auto mt-4 !w-auto">{t('tryAgain')}</Button></div> : posts.length === 0 ? <div className="px-5 py-12 text-center"><p className="font-medium">{t('quietFeed')}</p><p className="mt-1 text-sm text-muted">{t('firstPost')}</p></div> : <div>{posts.map((post) => <PostCard key={post.id} post={post} variant="desktop-feed" />)}</div>}
          </div>
        </section>
        <aside className="hidden space-y-4 py-5 2xl:block">
          <section className="glass-panel rounded-2xl p-4"><div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand" /><h2 className="text-sm font-bold tracking-tight">{t('topics')}</h2></div><p className="mt-1 text-xs leading-5 text-muted">{t('topicsHint')}</p><div className="mt-4 flex flex-wrap gap-2">{topics.map((topic) => <span key={topic} className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-ink transition hover:border-brand/30 hover:bg-brand/10">{topic}</span>)}</div></section>
          <section className="glass-panel rounded-2xl p-4"><h2 className="text-sm font-bold tracking-tight">{t('campusCommunity')}</h2><p className="mt-2 text-xs leading-5 text-muted">{t('campusCommunityHint')}</p><div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs"><span className="text-muted">{t('universityEmail')}</span><span className="font-medium text-brand">@iuca.kg</span></div></section>
          <Link to="/settings" className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-muted hover:bg-card hover:text-ink">{t('manageSettings')} <ArrowUpRight size={15} /></Link>
        </aside>
      </main>
    </div>
  );
}
