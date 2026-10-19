import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
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
              {people.map((person) => (
                <Link key={person.id} to={`/users/${encodeURIComponent(person.username)}`} onClick={onClose} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-surface">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/15 bg-surface text-sm font-semibold text-ink">
                    {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : person.fullName.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{person.fullName}</span>
                    <span className="block truncate text-xs text-muted">@{person.username}</span>
                  </span>
                  {person.isFollowing && <span className="shrink-0 rounded-full border border-brand/20 bg-brand/[0.08] px-2.5 py-1 text-[10px] font-medium text-brand">{russian ? 'Подписан' : 'Following'}</span>}
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted">{russian ? 'Список пока пуст.' : 'This list is empty.'}</p>
          )}
        </div>
      </section>
    </div>
  );
}
