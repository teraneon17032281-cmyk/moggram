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
import { usePreferences } from '../contexts/PreferencesContext';
import { ApiError, errorMessage } from '../services/apiClient';
import { savePending } from '../services/pendingVerification';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const { language, setLanguage } = usePreferences();
  const russian = language === 'ru';
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
      const message = errorMessage(e);
      setFormError(russian && message === 'Something went wrong. Please try again.' ? 'Что-то пошло не так. Попробуйте ещё раз.' : message);
    }
  };

  return (
    <AuthLayout
      featured
      title={russian ? 'Войти в MogGram' : 'Sign in to MogGram'}
      subtitle={russian ? 'Продолжи общаться с университетским сообществом.' : 'Continue to your campus community.'}
      footer={<>
        {russian ? 'Впервые в MogGram? ' : 'New to MogGram? '}
        <Link to="/register" className="font-medium text-brand hover:text-brand-hover">{russian ? 'Создать аккаунт' : 'Create an account'}</Link>
      </>}
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setLanguage(russian ? 'en' : 'ru')}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
          aria-label={russian ? 'Switch sign-in language to English' : 'Переключить язык входа на русский'}
        >
          {russian ? 'English' : 'Русский'}
        </button>
      </div>
      {success ? (
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 size={32} className="text-emerald-400" />
          <p className="mt-3 font-medium">{russian ? 'Вход выполнен' : 'Signed in'}</p>
          <p className="mt-1 text-sm text-muted">{russian ? 'Переходим к ленте…' : 'Taking you to your dashboard…'}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <Input label={russian ? 'Электронная почта' : 'Email'} type="email" autoComplete="email" placeholder="student@iuca.kg" error={russian && errors.email?.message === 'Enter your email' ? 'Введите электронную почту' : russian && errors.email?.message === 'Enter a valid email address' ? 'Введите корректный адрес электронной почты' : errors.email?.message} {...register('email')} />
          <Input label={russian ? 'Пароль' : 'Password'} type="password" autoComplete="current-password" placeholder={russian ? 'Твой пароль' : 'Your password'} error={russian && errors.password?.message === 'Enter your password' ? 'Введите пароль' : errors.password?.message} {...register('password')} />
          <div className="flex items-center justify-between">
            <Checkbox label={russian ? 'Запомнить меня' : 'Remember me'} {...register('remember')} />
            <Link to="/forgot-password" className="text-sm font-medium text-brand hover:text-brand-hover">{russian ? 'Забыл пароль?' : 'Forgot password?'}</Link>
          </div>
          <Button type="submit" loading={isSubmitting} className="group">
            {isSubmitting
              ? (russian ? 'Входим…' : 'Signing in…')
              : <>{russian ? 'Войти' : 'Sign in'} <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" /></>}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
