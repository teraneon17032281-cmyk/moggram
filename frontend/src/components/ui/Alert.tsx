import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const variants = {
  error: { cls: 'border-red-500/25 bg-red-500/[0.06] text-red-300', Icon: AlertCircle },
  success: { cls: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300', Icon: CheckCircle2 },
  info: { cls: 'border-line bg-card text-muted', Icon: Info },
};

export default function Alert({ variant = 'info', children }: { variant?: keyof typeof variants; children: ReactNode }) {
  const { cls, Icon } = variants[variant];
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-5 ${cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
