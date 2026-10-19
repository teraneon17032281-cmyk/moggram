import type { ReactNode } from 'react';
import Logo from '../ui/Logo';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Larger, more expressive heading block (used on the sign-in screen). */
  featured?: boolean;
}

export default function AuthLayout({ title, subtitle, children, footer, featured = false }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden px-5 pb-10 pt-8 sm:pt-[11vh]">
      {featured && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[440px] opacity-[0.07] [background-image:radial-gradient(#F5F7FA_1px,transparent_1px)] [background-size:22px_22px] [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
      )}
      <main className="relative w-full max-w-[380px]">
        <Logo />
        {featured && <span aria-hidden="true" className="mt-10 block h-0.5 w-6 rounded-full bg-brand" />}
        <h1
          className={
            featured
              ? 'mt-4 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.035em] sm:text-[32px]'
              : 'mt-9 font-display text-xl font-semibold tracking-tight'
          }
        >
          {title}
        </h1>
        {subtitle && <p className={featured ? 'mt-2.5 text-[15px] leading-snug text-muted' : 'mt-1.5 text-sm text-muted'}>{subtitle}</p>}
        <div className={featured ? 'mt-8' : 'mt-6'}>{children}</div>
        {footer && <div className="mt-6 border-t border-line pt-5 text-[13px] text-muted">{footer}</div>}
      </main>
    </div>
  );
}
