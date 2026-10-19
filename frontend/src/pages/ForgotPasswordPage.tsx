import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { emailOnlySchema, type EmailOnlyValues } from '../schemas/auth';
import { authService } from '../services/authService';
import { errorMessage } from '../services/apiClient';

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });

  const back = (
    <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover">
      <ArrowLeft size={15} /> Back to sign in
    </Link>
  );

  const onSubmit = async (v: EmailOnlyValues) => {
    setError('');
    try {
      await authService.requestPasswordReset(v.email);
      setSentTo(v.email);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we will send reset instructions." footer={back}>
      {sentTo ? (
        <div className="space-y-4 text-center">
          <MailCheck size={32} className="mx-auto text-brand" />
          <p className="font-medium">Check your inbox</p>
          <p className="text-sm text-muted">If an account exists for <span className="text-ink">{sentTo}</span>, reset instructions are on their way.</p>
          <Button variant="secondary" type="button" onClick={() => setSentTo(null)}>Use a different email</Button>
        </div>
      ) : (
        <form noValidate className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {error && <Alert variant="error">{error}</Alert>}
          <Input label="Email" type="email" autoComplete="email" placeholder="student@iuca.kg" error={errors.email?.message} {...register('email')} />
          <Button type="submit" loading={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset instructions'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
