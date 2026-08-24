import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { tryRefresh } from '../api/client';
import { useAuthStore } from '../store/auth';

/**
 * Route guard: khôi phục phiên từ refresh cookie khi mới mở app;
 * chưa đăng nhập → chuyển về /login.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initialized, setInitialized } = useAuthStore();

  useEffect(() => {
    if (!initialized && !user) {
      tryRefresh().finally(() => setInitialized());
    }
  }, [initialized, user, setInitialized]);

  if (!initialized && !user) {
    return <main className="boot-screen">Đang tải…</main>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
