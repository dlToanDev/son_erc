import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { login } from '../api/auth';
import { useAuthStore } from '../store/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      setAuth(result.user, result.accessToken);
      // Điều hướng theo vai trò sau đăng nhập.
      navigate(result.user.role === 'ADMIN' ? '/' : '/orders', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <img
            src="/logo.jpeg"
            alt="Garden Chay Logo"
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3.5px solid #16a34a',
              boxShadow: '0 6px 18px rgba(22, 163, 74, 0.35)',
            }}
          />
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#15803d', fontWeight: 900, textAlign: 'center', letterSpacing: '-0.02em' }}>
            Garden Chay
          </h1>
          <div
            style={{
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#ffffff',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              fontSize: '0.92rem',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)',
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}
          >
            QUẢN LÝ MUA HÀNG &amp; CÔNG NỢ
          </div>
        </div>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@congty.vn"
            autoComplete="username"
            required
          />
        </label>

        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            minLength={6}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Loader2 size={18} className="animate-spin" /> Đang đăng nhập...
            </span>
          ) : (
            'Đăng nhập'
          )}
        </button>
      </form>
    </main>
  );
}
