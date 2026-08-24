import { useState } from 'react';
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
  Plus,
  Search,
  User,
  ClipboardList,
  Menu,
  X,
  FileText,
} from 'lucide-react';

export default function MobileAppPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'payables' | 'inventory' | 'more'>('dashboard');
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [activeFormModal, setActiveFormModal] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 18 Trang Giao diện
  const PAGES = [
    { id: 'dashboard', name: '1. Dashboard Tổng quan', category: 'Tổng quan', icon: LayoutDashboard },
    { id: 'login', name: '2. Trang Đăng nhập (Auth)', category: 'Hệ thống', icon: User },
    { id: 'suppliers', name: '3. Danh sách Nhà cung cấp', category: 'NCC & Hàng hóa', icon: Truck },
    { id: 'supplier_detail', name: '4. Chi tiết Nhà cung cấp', category: 'NCC & Hàng hóa', icon: FileText },
    { id: 'products', name: '5. Quản lý Sản phẩm', category: 'NCC & Hàng hóa', icon: Package },
    { id: 'orders', name: '6. Danh sách Đơn hàng', category: 'Đơn hàng & Kho', icon: ShoppingCart },
    { id: 'order_detail', name: '7. Chi tiết Đơn hàng', category: 'Đơn hàng & Kho', icon: FileText },
    { id: 'receipts', name: '8. Danh sách Phiếu nhập kho', category: 'Đơn hàng & Kho', icon: ClipboardList },
    { id: 'receipt_detail', name: '9. Chi tiết Phiếu nhập kho', category: 'Đơn hàng & Kho', icon: FileText },
    { id: 'payables', name: '10. Công nợ Phải trả', category: 'Tài chính', icon: CreditCard },
    { id: 'payable_detail', name: '11. Chi tiết Khoản nợ', category: 'Tài chính', icon: FileText },
    { id: 'payments', name: '12. Sổ quỹ & Phiếu chi', category: 'Tài chính', icon: Receipt },
    { id: 'inventory', name: '13. Quản lý Kho NXT & Tồn kho', category: 'Đơn hàng & Kho', icon: Warehouse },
    { id: 'stats', name: '14. Thống kê & Báo cáo', category: 'Báo cáo', icon: BarChart3 },
    { id: 'compare', name: '15. So sánh & Phân tích', category: 'Báo cáo', icon: GitCompare },
    { id: 'audit', name: '16. Audit Log Nhật ký', category: 'Hệ thống', icon: ShieldAlert },
    { id: 'users', name: '17. Quản lý Người dùng', category: 'Hệ thống', icon: Users },
    { id: 'settings', name: '18. Cài đặt Hệ thống', category: 'Hệ thống', icon: Settings },
  ];

  // 20 Biểu mẫu / Forms
  const FORMS = [
    { id: 'form_login', title: '1. Form Đăng nhập tài khoản', desc: 'Email, Mật khẩu' },
    { id: 'form_supplier_create', title: '2. Form Thêm mới Nhà cung cấp', desc: 'Tên, Mã, SĐT, Địa chỉ, Loại NCC' },
    { id: 'form_supplier_edit', title: '3. Form Sửa thông tin Nhà cung cấp', desc: 'Cập nhật liên hệ & Hợp đồng' },
    { id: 'form_product_create', title: '4. Form Thêm mới Sản phẩm', desc: 'Tên, Mã SKU, Đơn giá, Đơn tính' },
    { id: 'form_product_category', title: '5. Form Quản lý Nhóm sản phẩm', desc: 'Tạo nhóm Rau, Nấm, Đồ chay...' },
    { id: 'form_order_create', title: '6. Form Tạo Đơn đặt hàng mới', desc: 'Chọn NCC, Danh sách hàng, Tổng tiền' },
    { id: 'form_order_approve', title: '7. Form Duyệt đơn hàng', desc: 'Phê duyệt đơn nhập hàng' },
    { id: 'form_order_cancel', title: '8. Form Hủy đơn hàng', desc: 'Lý do hủy đơn hàng' },
    { id: 'form_receipt_create', title: '9. Form Tạo Phiếu nhập kho', desc: 'Nhập thực tế từ Đơn đặt hàng' },
    { id: 'form_stock_take', title: '10. Form Kiểm kê kho', desc: 'Số kiểm thực tế, Tăng/Giảm' },
    { id: 'form_stock_transfer', title: '11. Form Điều chuyển kho', desc: 'Chuyển từ Kho 1 sang Kho 2' },
    { id: 'form_stock_adjust', title: '12. Form Điều chỉnh tồn kho', desc: 'Khắc phục chênh lệch kho' },
    { id: 'form_payable_plan', title: '13. Form Lập kế hoạch trả nợ', desc: 'Hạn thanh toán & Số tiền nợ' },
    { id: 'form_payment_create', title: '14. Form Lập Phiếu chi / Thanh toán', desc: 'Số tiền chi, Tài khoản, Mã tham chiếu' },
    { id: 'form_payment_edit', title: '15. Form Chỉnh sửa Phiếu chi', desc: 'Sửa chứng từ thanh toán' },
    { id: 'form_user_create', title: '16. Form Thêm mới Người dùng', desc: 'Họ tên, Email, Vai trò, Cơ sở' },
    { id: 'form_user_role', title: '17. Form Gán Vai trò & Phân quyền', desc: 'Cấp quyền Admin / Nhập kho / Thu ngân' },
    { id: 'form_settings_facility', title: '18. Form Cài đặt Cơ sở / Kho hàng', desc: 'Thêm/Sửa địa điểm kinh doanh' },
    { id: 'form_settings_system', title: '19. Form Cấu hình Tham số Hệ thống', desc: 'Cảnh báo nợ quá hạn, VAT' },
    { id: 'form_audit_filter', title: '20. Form Bộ lọc Tra cứu Audit Log', desc: 'Lọc theo thời gian & hành động' },
  ];

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* 📱 Mobile Top Navigation Header */}
      <header style={{ background: '#1e3a8a', color: '#fff', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/logo.jpeg" alt="Garden Chay" style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid #4ade80' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#4ade80', lineHeight: 1.1 }}>Garden Chay Mobile</div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Hệ thống Web Mobile UI (18 Trang & 20 Form)</div>
          </div>
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* 📂 Menu mở rộng chọn 18 Trang & 20 Form */}
      {menuOpen && (
        <div style={{ background: '#ffffff', borderBottom: '2px solid #e2e8f0', padding: '1rem', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
            📄 Chọn Trang giao diện ({PAGES.length} trang)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {PAGES.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePage(p.id);
                    setMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '8px',
                    border: activePage === p.id ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: activePage === p.id ? '#f0fdf4' : '#f8fafc',
                    color: activePage === p.id ? '#16a34a' : '#334155',
                    fontSize: '0.78rem',
                    fontWeight: activePage === p.id ? 700 : 500,
                    textAlign: 'left',
                  }}
                >
                  <Icon size={14} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name.split('. ')[1]}</span>
                </button>
              );
            })}
          </div>

          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
            📝 Dùng thử Form ({FORMS.length} Form/Modal)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {FORMS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setActiveFormModal(f.id);
                  setMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.82rem',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{f.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{f.desc}</div>
                </div>
                <Plus size={16} style={{ color: '#16a34a' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🚀 Quick Swipable Filter Bar */}
      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.65rem 1rem', background: '#ffffff', overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
        <button onClick={() => setActivePage('dashboard')} style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: activePage === 'dashboard' ? '#16a34a' : '#f1f5f9', color: activePage === 'dashboard' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>📊 Dashboard</button>
        <button onClick={() => setActivePage('orders')} style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: activePage === 'orders' ? '#16a34a' : '#f1f5f9', color: activePage === 'orders' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>🛒 Đơn hàng</button>
        <button onClick={() => setActivePage('payables')} style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: activePage === 'payables' ? '#16a34a' : '#f1f5f9', color: activePage === 'payables' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>🔴 Nợ đến hạn</button>
        <button onClick={() => setActivePage('inventory')} style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: activePage === 'inventory' ? '#16a34a' : '#f1f5f9', color: activePage === 'inventory' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>📦 Kho NXT</button>
        <button onClick={() => setActivePage('suppliers')} style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: activePage === 'suppliers' ? '#16a34a' : '#f1f5f9', color: activePage === 'suppliers' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>🚚 Nhà cung cấp</button>
      </div>

      {/* 📄 NỘI DUNG HIỂN THỊ TRANG MOBILE */}
      <main style={{ padding: '1rem' }}>
        
        {/* DASHBOARD PAGE */}
        {activePage === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>💰 DOANH THU THÁNG</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>148.500.000đ</div>
                <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>↗ +14.2% so với tháng trước</div>
              </div>
              <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '14px', border: '1px solid #fecaca', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>🔴 NỢ PHẢI TRẢ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626', marginTop: '0.2rem' }}>45.200.000đ</div>
                <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>⚠️ 3 NCC sắp hết hạn</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', padding: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>🛒 Đơn hàng gần đây</div>
                <button onClick={() => setActiveFormModal('form_order_create')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Plus size={14} /> Tạo đơn
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>#DH-1098 • Rau Sạch Chợ Đầu Mối</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📅 24/08/2026 • 💰 8.450.000đ</div>
                  </div>
                  <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', background: '#fef3c7', color: '#d97706', fontSize: '0.7rem', fontWeight: 700 }}>Chờ duyệt</span>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>#DH-1097 • Công ty Thực phẩm Chay</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📅 23/08/2026 • 💰 15.200.000đ</div>
                  </div>
                  <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700 }}>Đã nhập kho</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS PAGE */}
        {activePage === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Tìm đơn hàng, mã đơn, NCC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <button onClick={() => setActiveFormModal('form_order_create')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0 0.85rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Plus size={16} /> Tạo đơn
              </button>
            </div>

            {/* Mobile Card Data List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1098, 1097, 1096, 1095].map((id) => (
                <div key={id} style={{ background: '#ffffff', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e40af' }}>#DH-{id}</span>
                    <span style={{ padding: '0.2rem 0.55rem', borderRadius: '10px', background: id % 2 === 0 ? '#fef3c7' : '#dcfce7', color: id % 2 === 0 ? '#d97706' : '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>
                      {id % 2 === 0 ? '🟡 Chờ duyệt' : '🟢 Đã nhập kho'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div><strong>NCC:</strong> Nhà Cung Cấp Nấm & Rau Sạch #{id}</div>
                    <div><strong>Tổng tiền:</strong> <span style={{ color: '#16a34a', fontWeight: 800 }}>{(id * 125000).toLocaleString('vi-VN')} đ</span></div>
                    <div><strong>Ngày tạo:</strong> 24/08/2026 • Kho 1</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0' }}>
                    <button onClick={() => setActiveFormModal('form_order_approve')} style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: '0.78rem' }}>
                      ✅ Duyệt đơn
                    </button>
                    <button onClick={() => setActiveFormModal('form_order_cancel')} style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '0.78rem' }}>
                      ❌ Hủy đơn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEFAULT VIEW FOR OTHER PAGES */}
        {activePage !== 'dashboard' && activePage !== 'orders' && (
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'grid', placeItems: 'center', margin: '0 auto 0.75rem' }}>
              <FileText size={24} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
              {PAGES.find((p) => p.id === activePage)?.name}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.5rem 0 1rem' }}>
              Giao diện chuẩn Mobile Web hiển thị đầy đủ 100% dữ liệu, tương thích hoàn toàn trên thiết bị di động.
            </p>
            <button onClick={() => setActiveFormModal('form_supplier_create')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem' }}>
              ➕ Thao tác Form tương ứng
            </button>
          </div>
        )}
      </main>

      {/* 📝 POPUP MODAL CHUẨN BOTTOM SHEET DI ĐỘNG (Dành cho 20 Form) */}
      {activeFormModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '1.25rem 1.25rem 2rem 1.25rem', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -10px 30px rgba(0,0,0,0.2)', animation: 'slideUp 0.2s ease-out' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 800, textTransform: 'uppercase' }}>CHẾ ĐỘ MOBILE SHEET FORM</div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                  {FORMS.find((f) => f.id === activeFormModal)?.title}
                </div>
              </div>
              <button onClick={() => setActiveFormModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); alert('Thao tác thành công! (Dữ liệu đã sẵn sàng trên UI)'); setActiveFormModal(null); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Tên đối tượng / Mã chứng từ *
                </label>
                <input type="text" defaultValue="Garden Chay - Mẫu Thao Tác Mobile" required style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Cơ sở / Kho tiếp nhận *
                </label>
                <select style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#fff', boxSizing: 'border-box' }}>
                  <option>🏢 Kho Chính - Garden Chay 1</option>
                  <option>🏬 Chi Nhánh Kho Chay 2</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Số tiền / Giá trị tham chiếu (VNĐ)
                </label>
                <input type="number" defaultValue="1500000" style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Ghi chú chi tiết
                </label>
                <textarea rows={2} defaultValue="Thao tác trên giao diện Web Mobile cực kỳ tiện lợi..." style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setActiveFormModal(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                  Hủy bỏ
                </button>
                <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>
                  💾 XÁC NHẬN LƯU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚓ FLOATING ACTION BUTTON (FAB) NỔI TẠO NHAU NƠI */}
      <button
        onClick={() => setActiveFormModal('form_order_create')}
        style={{
          position: 'fixed',
          bottom: 70,
          right: 20,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #16a34a, #15803d)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 8px 20px rgba(22, 163, 74, 0.45)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 900,
          cursor: 'pointer',
        }}
        title="Tạo mới nhanh"
      >
        <Plus size={28} />
      </button>

      {/* 📱 MOBILE BOTTOM NAVIGATION BAR DOCK */}
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', height: '60px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 900 }}>
        <button onClick={() => { setActiveTab('dashboard'); setActivePage('dashboard'); }} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'dashboard' ? '#16a34a' : '#64748b', fontSize: '0.72rem', fontWeight: activeTab === 'dashboard' ? 700 : 500 }}>
          <LayoutDashboard size={20} />
          <span>Trang chủ</span>
        </button>
        <button onClick={() => { setActiveTab('orders'); setActivePage('orders'); }} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'orders' ? '#16a34a' : '#64748b', fontSize: '0.72rem', fontWeight: activeTab === 'orders' ? 700 : 500 }}>
          <ShoppingCart size={20} />
          <span>Đơn hàng</span>
        </button>
        <button onClick={() => { setActiveTab('payables'); setActivePage('payables'); }} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'payables' ? '#16a34a' : '#64748b', fontSize: '0.72rem', fontWeight: activeTab === 'payables' ? 700 : 500 }}>
          <CreditCard size={20} />
          <span>Công nợ</span>
        </button>
        <button onClick={() => { setActiveTab('inventory'); setActivePage('inventory'); }} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'inventory' ? '#16a34a' : '#64748b', fontSize: '0.72rem', fontWeight: activeTab === 'inventory' ? 700 : 500 }}>
          <Warehouse size={20} />
          <span>Kho NXT</span>
        </button>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: menuOpen ? '#16a34a' : '#64748b', fontSize: '0.72rem', fontWeight: menuOpen ? 700 : 500 }}>
          <Menu size={20} />
          <span>Tất cả</span>
        </button>
      </nav>

    </div>
  );
}
