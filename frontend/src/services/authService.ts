/**
 * Auth requests to the Django API. The contract is described in README.md.
 *
 * Emails are sent by the backend only. This file never sends email, never generates
 * or stores a verification code, and reports "code sent" only when the server says so.
 */
import type { User } from '../types';
import type { RegisterValues } from '../schemas/auth';
import { api, apiError } from './apiClient';

interface ApiUser {
  id: string | number;
  full_name: string;
  email: string;
  username: string;
  is_verified?: boolean;
  is_teacher?: boolean;
  avatar_url?: string | null;
  followers_count?: number;
  following_count?: number;
}

interface CodeDeliveryResponse {
  email?: string;
  code_sent?: boolean;
  expires_in?: number;
  resend_after?: number;
}

export interface CodeDelivery {
  email: string;
  expiresIn: number; // seconds
  resendAfter: number; // seconds until the next resend is allowed
}

const toUser = (u: ApiUser): User => ({ id: String(u.id), fullName: u.full_name, email: u.email, username: u.username, isVerified: u.is_verified === true, isTeacher: u.is_teacher === true, avatarUrl: u.avatar_url ?? null, followersCount: u.followers_count ?? 0, followingCount: u.following_count ?? 0 });

/** Only a response with `code_sent: true` counts as a confirmed delivery. */
function confirmedDelivery(data: CodeDeliveryResponse | null, fallbackEmail: string): CodeDelivery {
  if (!data || data.code_sent !== true) throw apiError('delivery_not_confirmed', 200);
  return { email: data.email ?? fallbackEmail, expiresIn: data.expires_in ?? 600, resendAfter: data.resend_after ?? 60 };
}

const normalize = (email: string) => email.trim().toLowerCase();

export const authService = {
  /** POST /api/auth/register/ — creates an unverified account; the server emails the code. */
  async register(values: RegisterValues): Promise<CodeDelivery> {
    const email = normalize(values.email);
    const data = await api.post<CodeDeliveryResponse>('/api/auth/register/', {
      full_name: values.fullName.trim(),
      email,
      username: values.username.trim(),
      password: values.password,
    });
    return confirmedDelivery(data, email);
  },

  /** POST /api/auth/verify-email/ — the server checks the code. */
  async verifyEmail(email: string, code: string): Promise<void> {
    const data = await api.post<{ verified?: boolean }>('/api/auth/verify-email/', { email: normalize(email), code });
    if (!data || data.verified !== true) throw apiError('invalid_response');
  },

  /** POST /api/auth/resend-code/ */
  async resendCode(emailInput: string): Promise<CodeDelivery> {
    const email = normalize(emailInput);
    const data = await api.post<CodeDeliveryResponse>('/api/auth/resend-code/', { email });
    return confirmedDelivery(data, email);
  },

  /** POST /api/auth/login/ — 403 `email_not_verified` for unverified accounts. */
  async login(email: string, password: string, remember: boolean): Promise<User> {
    const data = await api.post<{ user: ApiUser }>('/api/auth/login/', { email: normalize(email), password, remember });
    if (!data?.user) throw apiError('invalid_response');
    return toUser(data.user);
  },

  /** GET /api/auth/me/ — restores the session after a page refresh. */
  async getCurrentUser(): Promise<User | null> {
    try {
      const data = await api.get<{ user: ApiUser }>('/api/auth/me/');
      return data?.user ? toUser(data.user) : null;
    } catch {
      return null; // 401, or server unreachable: treat as signed out
    }
  },

  /** POST /api/auth/logout/ */
  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout/');
    } catch {
      /* local state is cleared by the caller regardless */
    }
  },

  /** POST /api/auth/password-reset/ — the server emails reset instructions. */
  async requestPasswordReset(email: string): Promise<void> {
    const data = await api.post<{ accepted?: boolean }>('/api/auth/password-reset/', { email: normalize(email) });
    if (!data || data.accepted !== true) throw apiError('delivery_not_confirmed', 200);
  },

  /** POST /api/auth/password-reset/confirm/ — sets a new password using uid+token from the email link. */
  async confirmPasswordReset(uid: string, token: string, password: string): Promise<void> {
    const data = await api.post<{ reset?: boolean }>('/api/auth/password-reset/confirm/', { uid, token, password });
    if (!data || data.reset !== true) throw apiError('invalid_response');
  },
};
