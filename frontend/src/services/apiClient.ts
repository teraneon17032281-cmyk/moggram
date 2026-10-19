/**
 * Thin HTTP client for the Django API.
 *
 * Base URL comes from VITE_API_BASE_URL.
 * Uses Django session cookies and CSRF protection.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const UNAVAILABLE = `Can't reach the server. Sending real emails requires the Django API to be running and configured (${API_BASE_URL}).`;
const UNEXPECTED = `The server returned an unexpected response. Check that the Django API is running and that VITE_API_BASE_URL points to it (${API_BASE_URL}).`;

const MESSAGES: Record<string, string> = {
  network_error: UNAVAILABLE,
  invalid_response: UNEXPECTED,
  delivery_not_confirmed: 'The server did not confirm that the email was sent, so no code was sent. Check the Django email settings and try again.',
  email_delivery_failed: "The server couldn't send the email. Check the backend email settings, then request a new code.",
  invalid_code: 'That code is incorrect. Check the email and try again.',
  code_expired: 'This code has expired. Request a new one.',
  too_many_attempts: 'Too many incorrect attempts. Request a new code or try again later.',
  resend_too_soon: 'Please wait before requesting another code.',
  account_not_found: "We couldn't find an account for this email.",
  already_verified: 'This email is already verified. You can sign in.',
  invalid_credentials: 'Incorrect email or password.',
  email_not_verified: 'Your email is not verified yet.',
  validation_error: 'Please check the highlighted fields.',
  invalid_token: 'This reset link is invalid or has expired. Request a new one.',
};

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string>;
  retryAfter?: number;

  constructor(
    message: string,
    opts: {
      status: number;
      code: string;
      fieldErrors?: Record<string, string>;
      retryAfter?: number;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.retryAfter = opts.retryAfter;
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
}

export function apiError(code: string, status = 0): ApiError {
  return new ApiError(MESSAGES[code] ?? 'Something went wrong. Try again.', {
    status,
    code,
  });
}

function getCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function fieldErrors(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};

  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === 'string') out[key] = first;
    }
  }

  return out;
}

async function ensureCsrf(): Promise<void> {
  if (!getCookie('csrftoken')) {
    await request('GET', '/api/auth/csrf/');
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  if (method !== 'GET') await ensureCsrf();

  const headers: Record<string, string> = { Accept: 'application/json' };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (method !== 'GET') {
    const token = getCookie('csrftoken');
    if (token) headers['X-CSRFToken'] = token;
  }

  let res: Response;

  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      headers,
      credentials: 'include',
      body:
        body === undefined
          ? undefined
          : isFormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw apiError('network_error');
  }

  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw apiError('invalid_response', res.status);
    }
  }

  if (!res.ok) {
    const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const code = typeof d.code === 'string' ? d.code : `http_${res.status}`;
    const message =
      MESSAGES[code] ??
      (typeof d.message === 'string'
        ? d.message
        : res.status >= 500
          ? 'Server error. Try again later.'
          : 'Something went wrong. Try again.');

    throw new ApiError(message, {
      status: res.status,
      code,
      fieldErrors: fieldErrors(d.errors),
      retryAfter: typeof d.retry_after === 'number' ? d.retry_after : undefined,
    });
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),

  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, body ?? {}),

  delete: <T>(path: string) =>
    request<T>('DELETE', path),
};
