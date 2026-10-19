import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import PasswordStrength from '../components/auth/PasswordStrength';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { newPasswordSchema, type NewPasswordValues } from '../schemas/auth';
import { authService } from '../services/authService';
import { ApiError, errorMessage } from '../services/apiClient';

/** Opened from the link in the reset email: /reset-password?uid=...&token=... */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, watch, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const back = (
    <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover">
      <ArrowLeft size={15} /> Back to sign in
    </Link>
  );

  const onSubmit = async (v: NewPasswordValues) => {
    setError('');
    try {
      await authService.confirmPasswordReset(uid, token, v.password);
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.password) {
        setFieldError('password', { message: e.fieldErrors.password });
        return;
      }
      setError(errorMessage(e));
    }
  };

  if (!uid || !token) {
    return (
      <AuthLayout title="Link is not valid" subtitle="Open the link from the email exactly as it was sent, or request a new one." footer={back}>
        <Link to="/forgot-password"><Button type="button">Request a new link</Button></Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick a password you have not used before." footer={back}>
      {done ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 size={32} className="mx-auto text-brand" />
          <p className="font-medium">Password updated</p>
          <p className="text-sm text-muted">You can now sign in with your new password.</p>
          <Link to="/login"><Button type="button">Sign in</Button></Link>
        </div>
      ) : (
        <form noValidate className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {error && <Alert variant="error">{error}</Alert>}
          <div>
            <Input label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register('password')} />
            <PasswordStrength password={watch('password')} />
          </div>
          <Input label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <Button type="submit" loading={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save new password'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
