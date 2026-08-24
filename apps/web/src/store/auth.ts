import { create } from 'zustand';
import type { AuthUser } from '@debtflow/shared';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  /** true khi đã thử khôi phục phiên (refresh) lúc khởi động. */
  initialized: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setInitialized: () => void;
  clear: () => void;
  /** Kiểm tra quyền phía UI (server vẫn là nguồn chân lý). */
  can: (module: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  initialized: false,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setInitialized: () => set({ initialized: true }),
  clear: () => set({ user: null, accessToken: null }),
  can: (module, action) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.permissions.some(
      (p) => p.module === module && p.action === action && p.allowed,
    );
  },
}));
