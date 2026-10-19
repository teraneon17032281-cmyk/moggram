import { useId } from 'react';
import { CODE_LENGTH } from '../../schemas/auth';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export default function CodeInput({ value, onChange, error, disabled }: Props) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        Verification code
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        autoFocus
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-msg` : undefined}
        className={`h-12 w-full rounded-lg border bg-card pl-[0.4em] text-center font-mono text-xl tracking-[0.4em] text-ink outline-none transition-colors duration-150 placeholder:text-muted/50 focus:ring-[3px] disabled:opacity-50 ${
          error ? 'border-red-500/60 focus:ring-red-500/15' : 'border-line hover:border-[#6A7F9F] focus:border-brand focus:ring-brand/15'
        }`}
      />
      {error && (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
