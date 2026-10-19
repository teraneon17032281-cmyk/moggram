import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import CodeInput from '../components/auth/CodeInput';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { emailOnlySchema, isValidCode, CODE_LENGTH, type EmailOnlyValues } from '../schemas/auth';
import { authService } from '../services/authService';
import { ApiError, errorMessage } from '../services/apiClient';
import { clearPending, loadPending, savePending } from '../services/pendingVerification';
import { useAuth } from '../contexts/AuthContext';

interface LocationState {
  sent?: boolean; // the server confirmed the code was sent (registration)
  fromLogin?: boolean; // login was refused because the email is not verified
  error?: string;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const backToLogin = (
  <Link to="/login" className="font-medium text-brand hover:text-brand-hover">Back to sign in</Link>
);

export default function VerifyEmailPage() {
  const state = (useLocation().state as LocationState | null) ?? {};
  const [email, setEmail] = useState<string | null>(() => loadPending()?.email ?? null);

  if (!email) return <EmailStep onDone={setEmail} />;
  return <CodeStep email={email} state={state} onChangeEmail={() => { clearPending(); setEmail(null); }} />;
}

/** Shown when we do not know which email to verify (e.g. a fresh tab). Makes no request. */
function EmailStep({ onDone }: { onDone: (email: string) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });
  return (
    <AuthLayout title="Verify your email" subtitle="Enter the email you signed up with." footer={backToLogin}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((v) => {
          const email = v.email.trim().toLowerCase();
          savePending({ email, resendAvailableAt: 0 });
          onDone(email);
        })}
      >
        <Input label="Email" type="email" autoComplete="email" placeholder="student@iuca.kg" error={errors.email?.message} {...register('email')} />
        <Button type="submit">Continue</Button>
      </form>
    </AuthLayout>
  );
}

type Notice = { variant: 'info' | 'success'; text: string };

function CodeStep({ email, state, onChangeEmail }: { email: string; state: LocationState; onChangeEmail: () => void }) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [inputError, setInputError] = useState('');
  const [error, setError] = useState(state.error ?? '');
  const [notice, setNotice] = useState<Notice | null>(
    state.fromLogin ? { variant: 'info', text: "Your email isn't verified yet. Enter the code from your email, or request a new one." } : null,
  );
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);
  const [resendAt, setResendAt] = useState(() => loadPending()?.resendAvailableAt ?? 0);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= resendAt) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [resendAt]);

  const startCooldown = (seconds: number) => {
    const at = Date.now() + seconds * 1000;
    setResendAt(at);
    setNow(Date.now());
    savePending({ email, resendAvailableAt: at });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice(null);
    if (!isValidCode(code)) {
      setInputError(`Enter the ${CODE_LENGTH}-digit code`);
      return;
    }
    setInputError('');
    setVerifying(true);
    try {
      await authService.verifyEmail(email, code);
      clearPending();
      const user = await refreshUser();
      if (user) {
        navigate('/', { replace: true });
        return;
      }
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice(null);
    setResending(true);
    try {
      const delivery = await authService.resendCode(email);
      startCooldown(delivery.resendAfter);
      setCode('');
      setNotice({ variant: 'success', text: `A new code was sent to ${delivery.email}.` });
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError && err.retryAfter) startCooldown(err.retryAfter);
    } finally {
      setResending(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Email verified" subtitle="Your address is confirmed. You can sign in now.">
        <div className="space-y-4 text-center">
          <BadgeCheck size={32} className="mx-auto text-emerald-400" />
          <Button type="button" onClick={() => navigate('/login', { replace: true })}>Sign in</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={state.sent ? `We sent a ${CODE_LENGTH}-digit code. Enter it below.` : `Enter the ${CODE_LENGTH}-digit code from your email.`}
      footer={backToLogin}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2.5 text-sm">
          <span className="truncate text-ink">{email}</span>
          <button type="button" onClick={onChangeEmail} className="ml-3 shrink-0 text-[13px] text-brand transition-colors hover:text-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
            Change
          </button>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant={notice.variant}>{notice.text}</Alert>}
        <CodeInput value={code} onChange={(v) => { setCode(v); setInputError(''); }} error={inputError} disabled={verifying} />
        <Button type="submit" loading={verifying}>{verifying ? 'Verifying…' : 'Verify email'}</Button>
        <Button type="button" variant="secondary" onClick={resend} loading={resending} disabled={remaining > 0}>
          {remaining > 0 ? `Resend code in ${formatTime(remaining)}` : 'Resend code'}
        </Button>
      </form>
    </AuthLayout>
  );
}
