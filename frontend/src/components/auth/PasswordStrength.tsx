import { passwordScore } from '../../schemas/auth';

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400'];

export default function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  if (!password) return null;
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= score ? COLORS[score] : 'bg-line'}`} />
        ))}
      </div>
      <p className="w-12 text-right text-xs text-muted">{LABELS[score]}</p>
    </div>
  );
}
