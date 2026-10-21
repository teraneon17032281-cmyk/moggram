import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRoundCheck, UserRoundPlus, X } from 'lucide-react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { errorMessage } from '../../services/apiClient';
import { userService } from '../../services/userService';
import type { CampusProfile } from '../../types';

export default function FollowListModal({
  username,
  relation,
  onClose,
}: {
  username: string;
  relation: 'followers' | 'following';
  onClose: () => void;
}) {
  const { language } = usePreferences();
  const russian = language === 'ru';
  const [people, setPeople] = useState<CampusProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [workingUsernames, setWorkingUsernames] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    userService.getFollowList(username, relation)
      .then((items) => { if (active) setPeople(items); })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username, relation]);

  const togglePersonFollow = async (person: CampusProfile) => {
    setActionError('');
    setWorkingUsernames((current) => new Set(current).add(person.username));
    try {
      const result = await userService.toggleFollow(person.username);
      setPeople((current) => current.map((item) => item.id === person.id ? { ...item, isFollowing: result.following } : item));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setWorkingUsernames((current) => {
        const next = new Set(current);
        next.delete(person.username);
        return next;
      });
    }
  };

  const title = relation === 'followers'
    ? (russian ? 'Подписчики' : 'Followers')
    : (russian ? 'Подписки' : 'Following');

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-list-title"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="follow-list-title" className="font-display text-lg font-bold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted">@{username}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={russian ? 'Закрыть' : 'Close'} className="rounded-xl p-2 text-muted hover:bg-surface hover:text-ink">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[65vh] min-h-24 overflow-y-auto p-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">{russian ? 'Загружаем…' : 'Loading…'}</p>
          ) : error ? (
            <p role="alert" className="py-8 text-center text-sm text-rose-400">{error}</p>
          ) : people.length ? (
            <div className="space-y-1">
              {actionError && <p role="alert" className="mx-2 mb-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{actionError}</p>}
              {people.map((person) => {
                const working = workingUsernames.has(person.username);
                return (
                  <div key={person.id} className="flex items-center gap-2 rounded-2xl px-2 py-2 transition hover:bg-surface">
                    <Link to={`/users/${encodeURIComponent(person.username)}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3 py-0.5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/15 bg-surface text-sm font-semibold text-ink">
                        {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : person.fullName.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{person.fullName}</span>
                        <span className="block truncate text-xs text-muted">@{person.username}</span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      disabled={working}
                      aria-pressed={person.isFollowing}
                      onClick={() => void togglePersonFollow(person)}
                      className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-60 sm:px-3 ${person.isFollowing ? 'border-line bg-surface/70 text-muted hover:border-rose-400/40 hover:text-rose-300' : 'border-brand/25 bg-brand/10 text-brand hover:bg-brand/15'}`}
                    >
                      {person.isFollowing ? <UserRoundCheck size={14} /> : <UserRoundPlus size={14} />}
                      <span>{working ? (russian ? 'Сохраняем…' : 'Saving…') : person.isFollowing ? (russian ? 'Вы подписаны' : 'Following') : (russian ? 'Подписаться' : 'Follow')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted">{russian ? 'Список пока пуст.' : 'This list is empty.'}</p>
          )}
        </div>
      </section>
    </div>
  );
}
