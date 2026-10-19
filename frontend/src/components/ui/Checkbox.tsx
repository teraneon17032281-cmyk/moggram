import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, Props>(({ label, error, id, ...rest }, ref) => {
  const auto = useId();
  const cbId = id ?? auto;
  return (
    <div>
      <label htmlFor={cbId} className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-5 text-muted">
        <span className="relative mt-0.5 flex h-4 w-4 shrink-0">
          <input
            ref={ref}
            id={cbId}
            type="checkbox"
            className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[4px] border border-[#7A8DA9] bg-card transition-colors checked:border-brand checked:bg-brand hover:border-[#9AABC4] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            {...rest}
          />
          <Check size={12} strokeWidth={3.5} className="pointer-events-none absolute left-[2px] top-[2px] text-bg opacity-0 peer-checked:opacity-100" />
        </span>
        <span>{label}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
});
Checkbox.displayName = 'Checkbox';
export default Checkbox;
