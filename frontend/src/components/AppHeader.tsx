import { useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Home, LogOut, Mail, Plus, Search, Settings, UserRound } from 'lucide-react';
import Logo from './ui/Logo';
import Button from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { preferencesService } from '../services/preferencesService';

const sideLink = ({ isActive }: { isActive: boolean }) => `group relative flex h-12 items-center gap-4 overflow-hidden rounded-xl px-3 text-[16px] font-semibold transition-all duration-200 ${isActive ? 'bg-gradient-to-r from-brand/15 to-brand/5 text-ink ring-1 ring-inset ring-brand/20 shadow-[0_8px_24px_rgba(10,20,34,0.12)]' : 'text-muted hover:bg-white/[0.045] hover:text-ink'}`;

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, showOnlineStatus } = usePreferences();

  useEffect(() => {
    if (!user) return;
    const sendPresence = () => {
      void preferencesService.updatePresence(showOnlineStatus && document.visibilityState === 'visible').catch(() => undefined);
    };
    sendPresence();
    const timer = window.setInterval(sendPresence, 30_000);
    document.addEventListener('visibilitychange', sendPresence);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sendPresence);
    };
  }, [user?.id, showOnlineStatus]);
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/[0.08] bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
      </header>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/90 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(10,20,34,0.22)] backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex h-[62px] max-w-lg items-center justify-around">
          <NavLink aria-label={t('feed')} title={t('feed')} to="/" end className={({ isActive }) => `grid h-11 w-11 place-items-center rounded-2xl transition ${isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-card hover:text-ink'}`}><Home size={21} strokeWidth={2.2} /></NavLink>
          <NavLink aria-label={t('searchPeople')} title={t('searchPeople')} to="/search" className={({ isActive }) => `grid h-11 w-11 place-items-center rounded-2xl transition ${isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-card hover:text-ink'}`}><Search size={21} strokeWidth={2.2} /></NavLink>
          <Link aria-label={t('writePost')} title={t('writePost')} to="/#post-composer" className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-[#10243a] shadow-lg shadow-brand/20 transition hover:scale-105"><Plus size={23} strokeWidth={2.4} /></Link>
          <NavLink aria-label={t('messages')} title={t('messages')} to="/messages" className={({ isActive }) => `grid h-11 w-11 place-items-center rounded-2xl transition ${isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-card hover:text-ink'}`}><Mail size={21} strokeWidth={2.2} /></NavLink>
          <NavLink aria-label={t('profile')} title={t('profile')} to="/profile" className={({ isActive }) => `grid h-11 w-11 place-items-center rounded-2xl transition ${isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-card hover:text-ink'}`}><UserRound size={21} strokeWidth={2.2} /></NavLink>
          <NavLink aria-label={t('settings')} title={t('settings')} to="/settings" className={({ isActive }) => `grid h-11 w-11 place-items-center rounded-2xl transition ${isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-card hover:text-ink'}`}><Settings size={20} strokeWidth={2.2} /></NavLink>
        </div>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-bg px-5 py-6 shadow-[18px_0_60px_rgba(10,20,34,0.10)] backdrop-blur-xl lg:flex">
        <Logo size={34} />
        <nav aria-label="Main navigation" className="mt-9 space-y-1.5">
          <NavLink to="/" end className={sideLink}><Home size={23} strokeWidth={2.2} className="transition group-hover:scale-105" />{t('feed')}</NavLink>
          <NavLink to="/search" className={sideLink}><Search size={23} strokeWidth={2.2} className="transition group-hover:scale-105" />{t('searchPeople')}</NavLink>
          <NavLink to="/messages" className={sideLink}><Mail size={23} strokeWidth={2.2} className="transition group-hover:scale-105" />{t('messages')}</NavLink>
          <NavLink to="/profile" className={sideLink}><UserRound size={23} strokeWidth={2.2} className="transition group-hover:scale-105" />{t('profile')}</NavLink>
          <NavLink to="/settings" className={sideLink}><Settings size={23} strokeWidth={2.2} className="transition group-hover:rotate-12" />{t('settings')}</NavLink>
          <Link to="/#post-composer" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-[#64a9ff] px-4 text-sm font-bold text-[#10243a] shadow-lg shadow-brand/20 transition hover:-translate-y-0.5 hover:shadow-brand/30">
            <Plus size={21} strokeWidth={2.3} />{t('writePost')}
          </Link>
        </nav>

        <div className="mt-auto border-t border-line pt-4">
          {user && (
            <Link to="/profile" className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.035] px-2.5 py-2.5 transition hover:border-brand/20 hover:bg-white/[0.06]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-sm font-semibold text-ink ring-2 ring-brand/20 ring-offset-2 ring-offset-card" aria-hidden="true">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.fullName.charAt(0).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{user.fullName}</span><span className="block truncate text-xs text-muted">@{user.username}</span></span>
            </Link>
          )}
          <Button variant="secondary" onClick={() => void handleLogout()} className="!h-10 !w-full !justify-start !px-3">
            <LogOut size={16} /><span>{t('logout')}</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
