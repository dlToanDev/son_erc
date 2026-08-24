// Client HTTP: gắn Bearer token, tự refresh 1 lần khi 401 rồi retry.

import type { AuthResult } from '@debtflow/shared';
import { useAuthStore } from '../store/auth';

const BASE_URL = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' });
}

/** Gọi POST /auth/refresh bằng httpOnly cookie; cập nhật store nếu thành công. */
export async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return false;
  const data = (await res.json()) as AuthResult;
  useAuthStore.getState().setAuth(data.user, data.accessToken);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);

  // Access token hết hạn → refresh 1 lần rồi retry.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, options);
    } else {
      useAuthStore.getState().clear();
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      /* giữ statusText */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const apiPut = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });
