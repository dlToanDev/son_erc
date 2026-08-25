import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Truck,
  Package,
  ShoppingCart,
  CreditCard,
  Receipt,
  Warehouse,
  BarChart3,
  GitCompare,
  ShieldAlert,
  Users,
  Settings,
  LogOut,
  User as UserIcon,
  Menu,
  X,
} from 'lucide-react';
import { logout } from '../api/auth';
import { useDebtAlertCounts, usePendingCount } from '../hooks/queries';
import { useAuthStore } from '../store/auth';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: [string, string];
  showPending?: boolean;
  showDebtAlerts?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: ['dashboard', 'view'] },
  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck, permission: ['suppliers', 'view'] },
  { to: '/products', label: 'Mặt hàng', icon: Package, permission: ['products', 'view'] },
  { to: '/orders', label: 'Đặt hàng', icon: ShoppingCart, permission: ['orders', 'view'], showPending: true },
  { to: '/payables', label: 'Công nợ', icon: CreditCard, permission: ['payables', 'view'], showDebtAlerts: true },
  { to: '/payments', label: 'Thanh toán', icon: Receipt, permission: ['payments', 'view'] },
  { to: '/inventory', label: 'Kho NXT', icon: Warehouse, permission: ['inventory', 'view'] },
  { to: '/stats', label: 'Thống kê', icon: BarChart3, permission: ['reports', 'view'] },
  { to: '/compare', label: 'So sánh kỳ', icon: GitCompare, permission: ['reports', 'view'] },
  { to: '/audit', label: 'Audit Log', icon: ShieldAlert, permission: ['audit', 'view'] },
  { to: '/users', label: 'Người dùng', icon: Users, permission: ['users', 'view'] },
  { to: '/settings', label: 'Cài đặt', icon: Settings, permission: ['settings', 'edit'] },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clear, can } = useAuthStore();
  const { data: pending } = usePendingCount(user?.role === 'ADMIN');
  const { data: debtAlerts } = useDebtAlertCounts();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  };

  if (!user) return null;

  // Kiểm tra quyền truy cập route hiện tại
  const currentItem = NAV_ITEMS.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
  );

  const hasAccess = !currentItem?.permission || can(...currentItem.permission);
  const isFetching = useIsFetching();

  return (
    <div className="app-shell">
      {isFetching > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            zIndex: 9999,
            background: 'linear-gradient(90deg, #22c55e, #3b82f6, #a855f7, #22c55e)',
            backgroundSize: '200% 100%',
            animation: 'df-loading-bar 1.2s infinite linear',
          }}
        />
      )}

      {/* Header cho điện thoại / Tablet */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img
            src="/logo.jpeg"
            alt="Garden Chay Logo"
            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#4ade80' }}>Garden Chay</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>Quản lý Công nợ</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.35rem' }}
          aria-label="Toggle Mobile Menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Phủ nền tối khi mở menu mobile */}
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img
              src="/logo.jpeg"
              alt="Garden Chay Logo"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 10px rgba(74, 222, 128, 0.4))',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#4ade80', letterSpacing: '-0.01em', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                Garden Chay
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.6)', letterSpacing: '0.01em' }}>
                Quản lý Công nợ
              </span>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.filter((item) => !item.permission || can(...item.permission)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} style={{ opacity: 0.9 }} />
                  <span>{item.label}</span>
                </div>
                <div>
                  {item.showPending && user?.role === 'ADMIN' && (pending?.count ?? 0) > 0 && (
                    <span className="badge badge-warning" style={{ borderRadius: '10px' }}>
                      {pending!.count}
                    </span>
                  )}
                  {item.showDebtAlerts && (debtAlerts?.overdueCount ?? 0) > 0 && (
                    <span className="badge badge-danger" style={{ borderRadius: '10px', marginLeft: '0.25rem' }}>
                      {debtAlerts!.overdueCount}
                    </span>
                  )}
                </div>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UserIcon size={14} />
              </div>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </span>
            </div>
            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#fff' }}>
              {user.role}
            </span>
          </div>
          <button className="btn-ghost" onClick={onLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%' }}>
            <LogOut size={15} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
      <main className="app-main">
        {hasAccess ? <Outlet /> : <div style={{ background: '#ffffff', minHeight: '100vh', width: '100%' }} />}
      </main>

      {/* Thanh điều hướng đáy màn hình cho Điện thoại (Mobile Bottom Nav Dock) */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'mobile-nav-item active' : 'mobile-nav-item')}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/orders" className={({ isActive }) => (isActive ? 'mobile-nav-item active' : 'mobile-nav-item')}>
          <div style={{ position: 'relative' }}>
            <ShoppingCart size={20} />
            {user?.role === 'ADMIN' && (pending?.count ?? 0) > 0 && (
              <span className="mobile-nav-badge">{pending!.count}</span>
            )}
          </div>
          <span>Đặt hàng</span>
        </NavLink>

        <NavLink to="/payables" className={({ isActive }) => (isActive ? 'mobile-nav-item active' : 'mobile-nav-item')}>
          <div style={{ position: 'relative' }}>
            <CreditCard size={20} />
            {(debtAlerts?.overdueCount ?? 0) > 0 && (
              <span className="mobile-nav-badge danger">{debtAlerts!.overdueCount}</span>
            )}
          </div>
          <span>Công nợ</span>
        </NavLink>

        <NavLink to="/inventory" className={({ isActive }) => (isActive ? 'mobile-nav-item active' : 'mobile-nav-item')}>
          <Warehouse size={20} />
          <span>Kho NXT</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`mobile-nav-item ${mobileOpen ? 'active' : ''}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
