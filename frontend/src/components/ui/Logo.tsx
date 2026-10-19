import type { MouseEventHandler } from 'react';
import { Link } from 'react-router-dom';
import { usePreferences } from '../../contexts/PreferencesContext';

export default function Logo({ to = '/', size = 26, onClick }: { to?: string; size?: number; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  const { theme } = usePreferences();
  const markColor = theme === 'light' ? '#2563eb' : '#f5f7fa';
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label="MogGram home"
      className="inline-flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <svg aria-hidden="true" className="shrink-0" width={size} height={size} viewBox="0 0 100 100" fill={markColor}>
        <path d="M12 6 50 37 88 6v29L75 45V29L44 55v33H33V61L50 48 22 25v63H12V6Z" />
        <path d="M44 66h25v-8h-10l11-11h18v41H44V66Z" />
      </svg>
      <span className="text-[15px] font-medium tracking-tight text-ink">MogGram</span>
    </Link>
  );
}
