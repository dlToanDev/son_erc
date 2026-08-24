import type { AuthResult, AuthUser } from '@debtflow/shared';
import { apiGet, apiPost } from './client';

export const login = (email: string, password: string) =>
  apiPost<AuthResult>('/auth/login', { email, password });

export const logout = () => apiPost<{ ok: true }>('/auth/logout');

export const getMe = () => apiGet<AuthUser>('/auth/me');
