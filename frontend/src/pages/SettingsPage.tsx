import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, LogOut } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { usePreferences, type Language, type Theme } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { preferencesService, type NotificationPreferences } from '../services/preferencesService';

const NOTICE_KEY = 'moggram.notifications';
const initialNotifications = (): NotificationPreferences => {
  try {
    const value = JSON.parse(localStorage.getItem(NOTICE_KEY) ?? 'null') as Partial<NotificationPreferences> | null;
    return { emailUpdates: value?.emailUpdates ?? true, mentionsAndReplies: value?.mentionsAndReplies ?? true };
  } catch {
    return { emailUpdates: true, mentionsAndReplies: true };
  }
};

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface/50 p-4">
      <span><span className="block text-sm font-medium text-ink">{label}</span><span className="mt-1 block text-xs leading-5 text-muted">{hint}</span></span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 shrink-0 accent-brand" />
    </label>
  );
}

export default function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { theme, language, setTheme, setLanguage, showOnlineStatus, setShowOnlineStatus, showOwnAnonymousPosts, setShowOwnAnonymousPosts, showOwnReposts, setShowOwnReposts, showOwnLikedPosts, setShowOwnLikedPosts, showOwnCommentedPosts, setShowOwnCommentedPosts, t } = usePreferences();
  const [notifications, setNotifications] = useState<NotificationPreferences>(initialNotifications);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'syncError' | ''>('');

  const updateTheme = (value: Theme) => { setTheme(value); setStatus(''); };
  const updateLanguage = (value: Language) => { setLanguage(value); setStatus(''); };

  const save = async () => {
    setSaving(true);
    setStatus('');
    localStorage.setItem(NOTICE_KEY, JSON.stringify(notifications));
    try {
      await preferencesService.save({ theme, language, notifications, showOnlineStatus, showOwnAnonymousPosts, showOwnReposts, showOwnLikedPosts, showOwnCommentedPosts });
      setStatus('saved');
    } catch {
      setStatus('syncError');
    } finally {
      setSaving(false);
    }
  };

  const updateNotice = (key: keyof NotificationPreferences) => setNotifications((value) => ({ ...value, [key]: !value[key] }));
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} />{t('backToFeed')}</Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">MogGram</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{t('settings')}</h1>
        </div>

        <section className="space-y-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <div><h2 className="font-semibold">{t('appearance')}</h2><p className="mt-1 text-sm text-muted">{t('appearanceHint')}</p></div>
          <div className="grid grid-cols-2 gap-3">
            {(['dark', 'light'] as Theme[]).map((value) => (
              <button key={value} type="button" aria-pressed={theme === value} onClick={() => updateTheme(value)} className={`flex items-center justify-between rounded-xl border p-4 text-sm font-medium transition ${theme === value ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface/50 text-muted hover:text-ink'}`}>
                {t(value)}{theme === value && <Check size={16} className="text-brand" />}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <div><h2 className="font-semibold">{t('language')}</h2><p className="mt-1 text-sm text-muted">{t('languageHint')}</p></div>
          <div className="grid grid-cols-2 gap-3">
            {(['en', 'ru'] as Language[]).map((value) => (
              <button key={value} type="button" aria-pressed={language === value} onClick={() => updateLanguage(value)} className={`flex items-center justify-between rounded-xl border p-4 text-sm font-medium transition ${language === value ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface/50 text-muted hover:text-ink'}`}>
                {value === 'en' ? t('english') : t('russian')}{language === value && <Check size={16} className="text-brand" />}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <div className="mb-4"><h2 className="font-semibold">{t('notifications')}</h2><p className="mt-1 text-sm text-muted">{t('notificationsHint')}</p></div>
          <Toggle checked={notifications.emailUpdates} onChange={() => updateNotice('emailUpdates')} label={t('emailNotifications')} hint={t('emailNotificationsHint')} />
          <Toggle checked={notifications.mentionsAndReplies} onChange={() => updateNotice('mentionsAndReplies')} label={t('mentions')} hint={t('mentionsHint')} />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <div><h2 className="font-semibold">{language === 'ru' ? 'Статус активности' : 'Activity status'}</h2><p className="mt-1 text-sm text-muted">{language === 'ru' ? 'Решай, смогут ли друзья и подписчики видеть, когда ты в сети.' : 'Choose whether friends and followers can see when you are online.'}</p></div>
          <Toggle checked={showOnlineStatus} onChange={() => { setShowOnlineStatus(!showOnlineStatus); setStatus(''); }} label={language === 'ru' ? 'Показывать, что я в сети' : 'Show when I’m online'} hint={showOnlineStatus ? (language === 'ru' ? 'Статус виден друзьям и подписчикам.' : 'Your status is visible to friends and followers.') : (language === 'ru' ? 'Твой онлайн-статус скрыт от других.' : 'Your online status is hidden from others.')} />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <div><h2 className="font-semibold">{language === 'ru' ? 'Анонимные публикации' : 'Anonymous posts'}</h2><p className="mt-1 text-sm text-muted">{language === 'ru' ? 'Выбери, показывать ли твои анонимные записи в твоём профиле.' : 'Choose whether your anonymous posts appear on your profile.'}</p></div>
          <Toggle checked={showOwnAnonymousPosts} onChange={() => { setShowOwnAnonymousPosts(!showOwnAnonymousPosts); setStatus(''); }} label={language === 'ru' ? 'Показывать мои анонимные посты в профиле' : 'Show my anonymous posts on my profile'} hint={showOwnAnonymousPosts ? (language === 'ru' ? 'Они будут видны только тебе в профиле.' : 'They will appear only to you on your profile.') : (language === 'ru' ? 'По умолчанию они скрыты.' : 'They are hidden by default.')} />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <div><h2 className="font-semibold">{language === 'ru' ? 'Видимость профиля' : 'Profile visibility'}</h2><p className="mt-1 text-sm text-muted">{language === 'ru' ? 'По умолчанию эти списки видишь только ты.' : 'These lists are private to you by default.'}</p></div>
          <Toggle checked={showOwnReposts} onChange={() => { setShowOwnReposts(!showOwnReposts); setStatus(''); }} label={language === 'ru' ? 'Показывать мои репосты в профиле' : 'Show my reposts on my profile'} hint={showOwnReposts ? (language === 'ru' ? 'Репосты смогут видеть посетители профиля.' : 'Profile visitors can see your reposts.') : (language === 'ru' ? 'Репосты скрыты от посетителей профиля.' : 'Your reposts are hidden from profile visitors.')} />
          <Toggle checked={showOwnLikedPosts} onChange={() => { setShowOwnLikedPosts(!showOwnLikedPosts); setStatus(''); }} label={language === 'ru' ? 'Показывать понравившиеся посты в профиле' : 'Show liked posts on my profile'} hint={showOwnLikedPosts ? (language === 'ru' ? 'Понравившиеся записи смогут видеть посетители профиля.' : 'Profile visitors can see posts you liked.') : (language === 'ru' ? 'Понравившиеся записи скрыты от посетителей профиля.' : 'Posts you liked are hidden from profile visitors.')} />
          <Toggle checked={showOwnCommentedPosts} onChange={() => { setShowOwnCommentedPosts(!showOwnCommentedPosts); setStatus(''); }} label={language === 'ru' ? 'Показывать мои комментарии в профиле' : 'Show my comments on my profile'} hint={showOwnCommentedPosts ? (language === 'ru' ? 'Посетители профиля увидят публикации, которые ты комментировал, и твои комментарии.' : 'Profile visitors can see posts you commented on and your comments.') : (language === 'ru' ? 'Твои комментарии скрыты от посетителей профиля.' : 'Your comments are hidden from profile visitors.')} />
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h2 className="font-semibold">{t('security')}</h2>
          <p className="mt-1 text-sm text-muted">{t('securityHint')}</p>
          <Link to="/forgot-password" className="mt-4 inline-flex rounded-lg border border-line px-4 py-2.5 text-sm text-ink hover:bg-surface">{t('resetPassword')}</Link>
        </section>

        {status && <Alert variant={status === 'saved' ? 'success' : 'info'}>{status === 'saved' ? t('saved') : t('syncError')}</Alert>}
        <Button onClick={() => void save()} loading={saving}>{saving ? '…' : t('save')}</Button>

        <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <Button variant="secondary" onClick={() => void handleLogout()} className="!h-11 !w-full !justify-center !border-red-500/30 !text-red-400 hover:!bg-red-500/10">
            <LogOut size={17} /><span>{language === 'ru' ? 'Выйти из аккаунта' : 'Log out'}</span>
          </Button>
        </section>
      </main>
    </div>
  );
}
