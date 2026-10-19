import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import Alert from '../components/ui/Alert';
import Splash from '../components/ui/Splash';
import { loginSchema, type LoginValues } from '../schemas/auth';
import { useAuth } from '../contexts/AuthContext';
import { ApiError, errorMessage } from '../services/apiClient';
import { savePending } from '../services/pendingVerification';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const submitted = useRef(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  if (loading) return <Splash />;
  if (user && !submitted.current) return <Navigate to="/" replace />;

  const onSubmit = async (v: LoginValues) => {
    setFormError('');
    submitted.current = true;
    try {
      await login(v.email, v.password, v.remember);
      setSuccess(true);
      setTimeout(() => navigate(from, { replace: true }), 800);
    } catch (e) {
      submitted.current = false;
      if (e instanceof ApiError && e.code === 'email_not_verified') {
        savePending({ email: v.email.trim().toLowerCase(), resendAvailableAt: 0 });
        navigate('/verify-email', { state: { fromLogin: true } });
        return;
      }
      setFormError(errorMessage(e));
    }
  };

  return (
    <AuthLayout
      featured
      title="Sign in to MogGram"
      subtitle="Continue to your campus community."
      footer={<>
        New to MogGram? <Link to="/register" className="font-medium text-brand hover:text-brand-hover">Create an account</Link>
      </>}
    >
      {success ? (
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 size={32} className="text-emerald-400" />
          <p className="mt-3 font-medium">Signed in</p>
          <p className="mt-1 text-sm text-muted">Taking you to your dashboard…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <Input label="Email" type="email" autoComplete="email" placeholder="student@iuca.kg" error={errors.email?.message} {...register('email')} />
          <Input label="Password" type="password" autoComplete="current-password" placeholder="Your password" error={errors.password?.message} {...register('password')} />
          <div className="flex items-center justify-between">
            <Checkbox label="Remember me" {...register('remember')} />
            <Link to="/forgot-password" className="text-sm font-medium text-brand hover:text-brand-hover">Forgot password?</Link>
          </div>
          <Button type="submit" loading={isSubmitting} className="group">
            {isSubmitting ? 'Signing in…' : <>Sign in <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" /></>}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
