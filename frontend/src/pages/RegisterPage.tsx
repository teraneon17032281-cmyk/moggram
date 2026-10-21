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
import { usePreferences } from '../contexts/PreferencesContext';
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

const RU_ERRORS: Record<string, string> = {
  'Enter your email': 'Введите электронную почту',
  'Enter a valid email address': 'Введите корректный адрес электронной почты',
  'Use your university email ending in @iuca.kg': 'Используйте университетскую почту с адресом @iuca.kg',
  'Enter your password': 'Введите пароль',
  'Enter your full name': 'Введите имя и фамилию',
  'Name is too long': 'Имя слишком длинное',
  'Username needs at least 3 characters': 'Имя пользователя должно содержать минимум 3 символа',
  'Username can be at most 20 characters': 'Имя пользователя должно содержать не более 20 символов',
  'Use only letters, numbers, dots and underscores': 'Используйте только латинские буквы, цифры, точки и подчёркивания',
  'Use at least 8 characters': 'Используйте не менее 8 символов',
  'Add a lowercase letter': 'Добавьте строчную латинскую букву',
  'Add an uppercase letter': 'Добавьте заглавную латинскую букву',
  'Add a number': 'Добавьте цифру',
  'Confirm your password': 'Повторите пароль',
  'Accept the Terms and Privacy Policy to continue': 'Примите условия и политику конфиденциальности',
  'Passwords do not match': 'Пароли не совпадают',
};

function translateError(message: string, russian: boolean): string {
  return russian ? (RU_ERRORS[message] ?? message) : message;
}

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const { language, setLanguage } = usePreferences();
  const russian = language === 'ru';
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
        navigate('/verify-email', { state: { error: russian
          ? 'Аккаунт создан, но сервер не смог отправить код. Запросите новый код ниже.'
          : 'Your account was created, but the server could not send the code. Request a new one below.' } });
        return;
      }
      if (e instanceof ApiError) {
        let mapped = false;
        for (const [key, message] of Object.entries(e.fieldErrors)) {
          const field = FIELD_MAP[key];
          if (field) {
            setError(field, { message: translateError(message, russian) });
            mapped = true;
          }
        }
        if (mapped) return;
      }
      const message = errorMessage(e);
      setFormError(russian && message === 'Something went wrong. Please try again.' ? 'Что-то пошло не так. Попробуйте ещё раз.' : message);
    }
  };

  return (
    <AuthLayout
      title={russian ? 'Создать аккаунт' : 'Create your account'}
      subtitle={russian
        ? 'Присоединяйся к MogGram. Мы отправим на почту 6-значный код для подтверждения адреса.'
        : 'Join MogGram. We will email you a 6-digit code to confirm your address.'}
      footer={<>
        {russian ? 'Уже есть аккаунт? ' : 'Already have an account? '}
        <Link to="/login" className="font-medium text-brand hover:text-brand-hover">{russian ? 'Войти' : 'Sign in'}</Link>
      </>}
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setLanguage(russian ? 'en' : 'ru')}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
          aria-label={russian ? 'Switch registration language to English' : 'Переключить язык регистрации на русский'}
        >
          {russian ? 'English' : 'Русский'}
        </button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        <Input label={russian ? 'Имя и фамилия' : 'Full name'} autoComplete="name" placeholder={russian ? 'Иван Иванов' : 'Alex Morgan'} error={translateError(errors.fullName?.message ?? '', russian) || undefined} {...register('fullName')} />
        <Input label={russian ? 'Электронная почта' : 'Email'} type="email" autoComplete="email" placeholder="student@iuca.kg" hint={russian ? 'Используй университетскую почту с адресом @iuca.kg.' : 'Use your university email address ending in @iuca.kg.'} error={translateError(errors.email?.message ?? '', russian) || undefined} {...register('email')} />
        <Input label={russian ? 'Имя пользователя' : 'Username'} autoComplete="username" placeholder="alex.morgan" error={translateError(errors.username?.message ?? '', russian) || undefined} hint={russian ? 'От 3 до 20 символов: латинские буквы, цифры, точки и подчёркивания.' : '3–20 characters: letters, numbers, dots, underscores.'} {...register('username')} />
        <div>
          <Input label={russian ? 'Пароль' : 'Password'} type="password" autoComplete="new-password" placeholder={russian ? 'Не менее 8 символов' : 'At least 8 characters'} error={translateError(errors.password?.message ?? '', russian) || undefined} {...register('password')} />
          <PasswordStrength password={watch('password')} language={language} />
        </div>
        <Input label={russian ? 'Повтори пароль' : 'Confirm password'} type="password" autoComplete="new-password" placeholder={russian ? 'Введи пароль ещё раз' : 'Repeat your password'} error={translateError(errors.confirmPassword?.message ?? '', russian) || undefined} {...register('confirmPassword')} />
        <Checkbox
          label={russian
            ? <>Я принимаю <Link to="/terms" target="_blank" className="text-brand hover:text-brand-hover">Условия использования</Link> и <Link to="/privacy" target="_blank" className="text-brand hover:text-brand-hover">Политику конфиденциальности</Link>.</>
            : <>I agree to the <Link to="/terms" target="_blank" className="text-brand hover:text-brand-hover">Terms</Link> and <Link to="/privacy" target="_blank" className="text-brand hover:text-brand-hover">Privacy Policy</Link>.</>}
          error={translateError(errors.terms?.message ?? '', russian) || undefined}
          {...register('terms')}
        />
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? (russian ? 'Создаём аккаунт…' : 'Creating account…') : (russian ? 'Создать аккаунт' : 'Create account')}
        </Button>
      </form>
    </AuthLayout>
  );
}
