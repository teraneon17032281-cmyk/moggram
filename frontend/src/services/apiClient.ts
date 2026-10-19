/**
 * Thin HTTP client for the Django API.
 *
 * Base URL comes from VITE_API_BASE_URL.
 * In production, leave it empty to use the same domain.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

type ApiMethod = 'GET' | 'POST' | 'DELETE';

async function ensureCsrf(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, {
    method: 'GET',
    credentials: 'include',
  });
}

async function request<T>(
  method: ApiMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  if (method !== 'GET') {
    await ensureCsrf();
  }

  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Ошибка сервера: ${response.status}`);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),

  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, body),

  delete: <T>(path: string) =>
    request<T>('DELETE', path),
};

export function apiError(error: unknown): string {
  return error instanceof Error ? error.message : 'Произошла ошибка';
}
