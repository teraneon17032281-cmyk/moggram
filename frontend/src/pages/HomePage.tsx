import { useCallback, useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [postError, setPostError] = useState('');
  const { t } = usePreferences();

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setFeedError('');
    try { setPosts(await feedService.getFeed()); }
    catch (error) { setFeedError(errorMessage(error)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadFeed(); }, [loadFeed]);
  if (!user) return null;

  const publish = async (content: string, anonymous: boolean, linkUrl?: string, image?: File) => {
    setPostError(''); setSubmitting(true);
    try {
      const post = await feedService.createPost(content, anonymous, linkUrl, image);
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
    } catch (error) { setPostError(errorMessage(error)); throw error; }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <AppHeader />
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-0 px-0 sm:px-5 2xl:grid-cols-[minmax(0,760px)_280px] 2xl:gap-10">
        <section className="min-w-0 border-line lg:border-x" aria-label="Community feed">
          <div className="sticky top-14 z-10 flex h-[68px] items-center justify-between border-b border-line bg-bg px-5 lg:top-0">
            <div><h1 className="font-display text-lg font-bold tracking-tight text-ink">{t('feed')}</h1><p className="hidden text-[11px] text-muted sm:block">{t('community')} <span className="mx-1 text-brand/70">·</span> IUCA</p></div>
            <Link to="/search" className="hidden items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs text-muted transition hover:border-brand/30 hover:text-ink md:flex"><Search size={16} /><span>{t('searchPeople')} · @iuca.kg</span></Link>
          </div>
          <div className="border-b border-line bg-bg px-4 sm:px-5"><PostComposer user={user} submitting={submitting} error={postError} onSubmit={publish} variant="feed" /></div>
          <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="text-sm font-semibold text-ink">{t('latest')}</h2><button onClick={() => void loadFeed()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-card hover:text-ink" type="button"><RefreshCw size={15} /> {t('refresh')}</button></div>
          {feedError && <div className="px-5 pt-4"><Alert variant="error">{feedError}</Alert></div>}
          {loading ? <div className="px-5 py-12 text-center text-sm text-muted" role="status">{t('loadingFeed')}</div> : feedError ? <div className="px-5 py-10 text-center"><p className="text-sm text-muted">{t('feedUnavailable')}</p><Button variant="secondary" onClick={() => void loadFeed()} className="mx-auto mt-4 !w-auto">{t('tryAgain')}</Button></div> : posts.length === 0 ? <div className="px-5 py-12 text-center"><p className="font-medium">{t('quietFeed')}</p><p className="mt-1 text-sm text-muted">{t('firstPost')}</p></div> : <div>{posts.map((post) => <PostCard key={post.id} post={post} variant="desktop-feed" />)}</div>}
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
