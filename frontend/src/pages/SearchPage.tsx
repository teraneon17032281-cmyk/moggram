import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, MessageCircle, Search, UserRoundPlus, UserRoundCheck } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import Alert from '../components/ui/Alert';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { errorMessage } from '../services/apiClient';
import { userService } from '../services/userService';
import type { CampusProfile } from '../types';

const popularTopics = ['#Учёба', '#Экзамены', '#Студенты', '#WebDev', '#События'];

export default function SearchPage() {
  const { user: currentUser } = useAuth();
  const { language } = usePreferences();
  const russian = language === 'ru';
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<CampusProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workingUser, setWorkingUser] = useState('');

  useEffect(() => {
    const value = query.trim();
    if (!value) { setUsers([]); setError(''); setLoading(false); return; }
    let alive = true;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const result = await userService.search(value);
        if (alive) setUsers(result.filter((person) => person.id !== currentUser?.id));
      } catch (err) {
        if (alive) setError(errorMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, currentUser?.id]);

  const toggleFollow = async (person: CampusProfile) => {
    setWorkingUser(person.username);
    try {
      const result = await userService.toggleFollow(person.username);
      setUsers((current) => current.map((item) => item.username === person.username ? { ...item, isFollowing: result.following, followersCount: result.followersCount } : item));
    } catch (err) { setError(errorMessage(err)); }
    finally { setWorkingUser(''); }
  };

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-7 sm:px-6 lg:py-10">
        <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">MogGram · IUCA</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{russian ? 'Найти людей' : 'Find people'}</h1><p className="mt-2 text-sm text-muted">{russian ? 'Ищи студентов по имени или имени пользователя.' : 'Search students by name or username.'}</p></header>
        <label className="flex items-center gap-3 rounded-2xl border border-line bg-card/80 px-4 py-4 shadow-lg shadow-slate-950/[0.06]"><Search size={19} className="text-brand" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={russian ? 'Имя или @username' : 'Name or @username'} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" /></label>
        {error && <Alert variant="error">{error}</Alert>}
        {query.trim() ? <section className="space-y-3" aria-live="polite">
          {loading && <p className="py-6 text-center text-sm text-muted">{russian ? 'Ищем студентов…' : 'Searching students…'}</p>}
          {!loading && !error && users.length === 0 && <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">{russian ? 'Никого не нашли. Проверь имя или никнейм.' : 'No students found. Check the name or username.'}</p>}
          {users.map((person) => <article key={person.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card/75 p-4 shadow-sm">
            <Link to={`/users/${encodeURIComponent(person.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-surface text-lg font-semibold ring-2 ring-brand/15 ring-offset-2 ring-offset-card">{person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : person.fullName.charAt(0).toUpperCase()}{person.isOnline !== undefined && <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card ${person.isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />}</span>
              <span className="min-w-0"><span className="flex items-center gap-1.5 font-semibold text-ink">{person.fullName}{person.isVerified && <BadgeCheck size={15} className="text-brand" />}</span><span className="mt-0.5 block truncate text-sm text-muted">@{person.username} · {person.followersCount} {russian ? 'подписчиков' : 'followers'}{person.isOnline === true && <span className="ml-2 inline-flex items-center gap-1.5 text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{russian ? 'в сети' : 'online'}</span>}</span></span>
            </Link>
            <div className="flex gap-2">
              <button type="button" onClick={() => void toggleFollow(person)} disabled={workingUser === person.username} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${person.isFollowing ? 'border-line bg-surface/50 text-ink hover:border-rose-300/40' : 'border-brand/25 bg-brand/10 text-brand hover:bg-brand/15'} disabled:opacity-50`}>{person.isFollowing ? <UserRoundCheck size={15} /> : <UserRoundPlus size={15} />}{person.isFollowing ? (russian ? 'Вы подписаны' : 'Following') : (russian ? 'Подписаться' : 'Follow')}</button>
              <Link to={`/messages?to=${encodeURIComponent(person.username)}`} aria-label={russian ? `Написать ${person.fullName}` : `Message ${person.fullName}`} className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-card text-muted transition hover:border-brand/30 hover:text-brand"><MessageCircle size={17} /></Link>
            </div>
          </article>)}
        </section> : <section className="rounded-2xl border border-line bg-card/60 p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">{russian ? 'Популярные темы' : 'Popular topics'}</h2><p className="mt-1 text-sm text-muted">{russian ? 'Выбери тему, о которой говорят в IUCA.' : 'Explore topics students are discussing at IUCA.'}</p></div><Search size={20} className="text-brand" /></div><div className="mt-5 flex flex-wrap gap-2">{popularTopics.map((topic) => <span key={topic} className="rounded-full border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink">{topic}</span>)}</div></section>}
      </main>
    </div>
  );
}
