import { passwordScore } from '../../schemas/auth';
import type { Language } from '../../contexts/PreferencesContext';

const LABELS: Record<Language, string[]> = {
  en: ['', 'Weak', 'Fair', 'Good', 'Strong'],
  ru: ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный'],
};
const COLORS = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400'];

export default function PasswordStrength({ password, language = 'en' }: { password: string; language?: Language }) {
  const score = passwordScore(password);
  if (!password) return null;
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= score ? COLORS[score] : 'bg-line'}`} />
        ))}
      </div>
      <p className="w-16 text-right text-xs text-muted">{LABELS[language][score]}</p>
    </div>
  );
}
