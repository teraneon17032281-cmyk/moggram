import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../components/auth/AuthLayout';
import PasswordStrength from '../components/auth/PasswordStrength';
import Input from '../components/ui/Input';
import Checkbox from '../components/ui/Checkbox';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Splash from '../components/ui/Splash';
import { registerSchema, type RegisterValues } from '../schemas/auth';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { ApiError, errorMessage } from '../services/apiClient';
import { savePending } from '../services/pendingVerification';

/** API field name -> form field name */
const FIELD_MAP: Record<string, keyof RegisterValues> = {
  full_name: 'fullName',
  email: 'email',
  username: 'username',
  password: 'password',
};

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');

  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', username: '', password: '', confirmPassword: '', terms: false },
  });

  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (v: RegisterValues) => {
    setFormError('');
    try {
      const delivery = await authService.register(v);
      savePending({ email: delivery.email, resendAvailableAt: Date.now() + delivery.resendAfter * 1000 });
      navigate('/verify-email', { state: { sent: true } });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'email_delivery_failed') {
        // The account exists but the server could not send the email. Do not claim a code was sent.
        savePending({ email: v.email.trim().toLowerCase(), resendAvailableAt: 0 });
        navigate('/verify-email', { state: { error: 'Your account was created, but the server could not send the code. Request a new one below.' } });
        return;
      }
      if (e instanceof ApiError) {
        let mapped = false;
        for (const [key, message] of Object.entries(e.fieldErrors)) {
          const field = FIELD_MAP[key];
          if (field) {
            setError(field, { message });
            mapped = true;
          }
        }
        if (mapped) return;
      }
      setFormError(errorMessage(e));
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join MogGram. We will email you a 6-digit code to confirm your address."
      footer={<>
        Already have an account? <Link to="/login" className="font-medium text-brand hover:text-brand-hover">Sign in</Link>
      </>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <Input label="Full name" autoComplete="name" placeholder="Alex Morgan" error={errors.fullName?.message} {...register('fullName')} />
        <Input label="Email" type="email" autoComplete="email" placeholder="student@iuca.kg" hint="Use your university email address ending in @iuca.kg." error={errors.email?.message} {...register('email')} />
        <Input label="Username" autoComplete="username" placeholder="alex.morgan" error={errors.username?.message} hint="3–20 characters: letters, numbers, dots, underscores." {...register('username')} />
        <div>
          <Input label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register('password')} />
          <PasswordStrength password={watch('password')} />
        </div>
        <Input label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Checkbox
          label={<>I agree to the <Link to="/terms" target="_blank" className="text-brand hover:text-brand-hover">Terms</Link> and <Link to="/privacy" target="_blank" className="text-brand hover:text-brand-hover">Privacy Policy</Link>.</>}
          error={errors.terms?.message}
          {...register('terms')}
        />
        <Button type="submit" loading={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</Button>
      </form>
    </AuthLayout>
  );
}
