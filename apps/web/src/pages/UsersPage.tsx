import { FormEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PERMISSION_MODULES, type PermissionEntry } from '@debtflow/shared';
import { Shield, CheckSquare, Square, Sparkles } from 'lucide-react';
import DataTable, { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import { useUserMutations, useUsers } from '../hooks/queries';
import type { UserWithPermissions } from '../api/masterData';
import { useAuthStore } from '../store/auth';
import { formatDateTime } from '../utils/format';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'STAFF' as 'ADMIN' | 'STAFF' };

const MODULE_CONFIG: Record<string, { label: string; desc: string }> = {
  dashboard: { label: 'Tổng quan / Dashboard', desc: 'Xem KPI, doanh số & cảnh báo công nợ' },
  suppliers: { label: 'Nhà cung cấp', desc: 'Quản lý thông tin & danh mục nhà cung cấp' },
  products: { label: 'Danh mục Sản phẩm', desc: 'Quản lý danh sách mặt hàng & đơn giá' },
  orders: { label: 'Đơn đặt hàng', desc: 'Tạo mua hàng & duyệt đơn đặt hàng' },
  payables: { label: 'Công nợ nhà cung cấp', desc: 'Theo dõi hoá đơn & thực hiện chi trả' },
  payments: { label: 'Nhật ký Chi tiền', desc: 'Xem phiếu chi & lịch sử thanh toán' },
  inventory: { label: 'Kho Nhập – Xuất – Tồn', desc: 'Báo cáo kho NXT & tạo phiếu xuất' },
  reports: { label: 'Báo cáo & Thống kê', desc: 'Báo cáo chi phí, sản lượng & so sánh' },
  audit: { label: 'Audit Log / Nhật ký', desc: 'Tra cứu lịch sử thao tác người dùng' },
  users: { label: 'Tài khoản & Phân quyền', desc: 'Tạo tài khoản & cấu hình quyền hạn' },
  settings: { label: 'Cấu hình Hệ thống', desc: 'Chỉnh sửa cảnh báo & tham số chung' },
};

// label: tên quyền · desc: nội dung dấu "i" giải thích cho người cấp quyền hiểu.
const ACTION_CONFIG: Record<string, { label: string; desc: string; color: string; bg: string; border: string }> = {
  view: {
    label: 'Xem dữ liệu',
    desc: 'Cho phép mở và xem dữ liệu của chức năng này (chỉ đọc).',
    color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
  },
  edit: {
    label: 'Thêm / Sửa / Tạo mới',
    desc: 'Cho phép thêm mới, chỉnh sửa và xoá/huỷ (tuỳ chức năng).',
    color: '#166534', bg: '#f0fdf4', border: '#bbf7d0',
  },
  approve: {
    label: 'Duyệt đơn hàng',
    desc: 'Cho phép duyệt / từ chối / nhận hàng / xác nhận thanh toán đơn.',
    color: '#854d0e', bg: '#fefce8', border: '#fef08a',
  },
  pay: {
    label: 'Thanh toán công nợ',
    desc: 'Cho phép ghi nhận thanh toán cho công nợ nhà cung cấp.',
    color: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff',
  },
  viewPrice: {
    label: 'Xem tiền',
    desc: 'Cho phép nhân viên NHÌN THẤY đơn giá & số tiền trong đơn hàng. Bỏ tick = ẩn giá với nhân viên (chỉ thấy mặt hàng & số lượng).',
    color: '#9a3412', bg: '#fff7ed', border: '#fed7aa',
  },
};

/** Dấu "i" — di chuột (hoặc bấm trên điện thoại) hiện hộp hướng dẫn. */
function InfoTip({ text, active, color }: { text: string; active: boolean; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = 260;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
    setPos({ top: r.bottom + 8, left });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pos) hide();
        else show();
      }}
      aria-label={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        border: `1.5px solid ${active ? color : '#cbd5e1'}`,
        color: active ? color : '#94a3b8',
        fontSize: '0.72rem',
        fontWeight: 700,
        fontStyle: 'italic',
        lineHeight: 1,
        cursor: 'help',
      }}
    >
      i
      {pos &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: 260,
              zIndex: 10001,
              background: '#0f172a',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 500,
              fontStyle: 'normal',
              lineHeight: 1.5,
              padding: '0.6rem 0.75rem',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  );
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: users = [], isLoading, isError } = useUsers();
  const { create, update, setPermissions } = useUserMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserWithPermissions | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const [permUser, setPermUser] = useState<UserWithPermissions | null>(null);
  const [permDraft, setPermDraft] = useState<Set<string>>(new Set());

  // ---- User form ----
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (u: UserWithPermissions) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: form.name,
          email: form.email,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await create.mutateAsync(form);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  // ---- Permission matrix ----
  const permKey = (m: string, a: string) => `${m}.${a}`;

  const openPermissions = (u: UserWithPermissions) => {
    setPermUser(u);
    setPermDraft(
      new Set(u.permissions.filter((p) => p.allowed).map((p) => permKey(p.module, p.action))),
    );
  };

  const togglePerm = (m: string, a: string) => {
    const key = permKey(m, a);
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModuleAll = (module: string, actions: string[]) => {
    const allChecked = actions.every((a) => permDraft.has(permKey(module, a)));
    setPermDraft((prev) => {
      const next = new Set(prev);
      actions.forEach((a) => {
        const key = permKey(module, a);
        if (allChecked) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const selectAllPerms = () => {
    const all = new Set<string>();
    PERMISSION_MODULES.forEach(({ module, actions }) => {
      actions.forEach((action) => all.add(permKey(module, action)));
    });
    setPermDraft(all);
  };

  const deselectAllPerms = () => {
    setPermDraft(new Set());
  };

  const selectStaffDefaultPerms = () => {
    const staffPerms = new Set<string>([
      'orders.view',
      'orders.edit',
    ]);
    setPermDraft(staffPerms);
  };

  const savePermissions = async () => {
    if (!permUser) return;
    const permissions: PermissionEntry[] = PERMISSION_MODULES.flatMap(({ module, actions }) =>
      actions.map((action) => ({
        module,
        action,
        allowed: permDraft.has(permKey(module, action)),
      })),
    );
    await setPermissions.mutateAsync({ id: permUser.id, permissions });
    setPermUser(null);
  };

  const columns: Column<UserWithPermissions>[] = [
    { key: 'name', header: 'Tên người dùng', render: (u) => <strong style={{ color: '#0f172a' }}>{u.name}</strong> },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'role',
      header: 'Vai trò',
      render: (u) => <span className={`badge ${u.role === 'ADMIN' ? 'badge-primary' : 'badge-muted'}`}>{u.role}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (u) =>
        u.status === 'ACTIVE' ? (
          <span className="badge badge-success">✓ Hoạt động</span>
        ) : (
          <span className="badge badge-muted">Đã khoá</span>
        ),
    },
    { key: 'last', header: 'Đăng nhập cuối', render: (u) => formatDateTime(u.lastLoginAt) },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (u) => (
        <div className="btn-action-group">
          <button type="button" className="btn-action-edit" onClick={() => openEdit(u)}>
            Sửa
          </button>
          {u.role === 'STAFF' && (
            <button
              type="button"
              className="btn-action-view"
              onClick={() => openPermissions(u)}
              style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
            >
              <Shield size={14} style={{ marginRight: 3 }} /> Phân quyền
            </button>
          )}
          {u.id !== currentUser?.id && (
            <button
              type="button"
              className={u.status === 'ACTIVE' ? 'btn-action-toggle-hide' : 'btn-action-toggle-show'}
              onClick={() =>
                update.mutate({
                  id: u.id,
                  status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                })
              }
            >
              {u.status === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
            </button>
          )}
        </div>
      ),
    },
  ];

  const totalKeys = PERMISSION_MODULES.reduce((sum, item) => sum + item.actions.length, 0);

  return (
    <section className="page">
      <header className="page-header">
        <h2>Quản lý tài khoản người dùng</h2>
        {currentUser?.role === 'ADMIN' && (
          <button className="btn-primary" onClick={openCreate}>
            + Tạo tài khoản mới
          </button>
        )}
      </header>

      <DataTable columns={columns} rows={users} rowKey={(u) => u.id} loading={isLoading} error={isError} />

      {/* Modal Tạo / Sửa User */}
      <Modal
        title={editing ? `Sửa người dùng — ${editing.name}` : 'Tạo người dùng mới'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="form-group span-2">
            <span>Họ và tên *</span>
            <input
              type="text"
              required
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="form-group span-2">
            <span>Email đăng nhập *</span>
            <input
              type="email"
              required
              className="form-input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="form-group span-2">
            <span>Mật khẩu {editing ? '(để trống nếu không đổi)' : '*'}</span>
            <input
              type="password"
              required={!editing}
              className="form-input"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="form-group span-2">
            <span>Vai trò hệ thống</span>
            <select
              className="form-input"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'ADMIN' | 'STAFF' }))}
            >
              <option value="STAFF">STAFF (Nhân viên)</option>
              <option value="ADMIN">ADMIN (Quản trị viên)</option>
            </select>
          </label>
          {error && <div className="form-error span-2">{error}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>
              Lưu tài khoản
            </button>
          </div>
        </form>
      </Modal>

      {/* Ma trận phân quyền cao cấp */}
      <Modal
        title={permUser ? `Thiết lập phân quyền chi tiết — ${permUser.name}` : ''}
        open={!!permUser}
        onClose={() => setPermUser(null)}
        size="xl"
      >
        {permUser && (
          <div>
            {/* Thẻ thông tin người dùng */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
                gap: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: 'var(--df-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {permUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                    {permUser.name} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>({permUser.email})</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                    <span>Vai trò: <strong>{permUser.role}</strong></span>
                    <span>•</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>
                      Đã cấp {permDraft.size} / {totalKeys} quyền hạn
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút thao tác nhanh */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={selectAllPerms}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    cursor: 'pointer',
                  }}
                >
                  <CheckSquare size={13} style={{ marginRight: 3, verticalAlign: '-2px' }} /> Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={selectStaffDefaultPerms}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                    color: '#166534',
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={13} style={{ marginRight: 3, verticalAlign: '-2px' }} /> Mặc định Staff
                </button>
                <button
                  type="button"
                  onClick={deselectAllPerms}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  <Square size={13} style={{ marginRight: 3, verticalAlign: '-2px' }} /> Bỏ chọn hết
                </button>
              </div>
            </div>

            {/* Bảng Ma trận Phân quyền */}
            <div className="table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="data-table table-sticky-first">
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>Tất cả</th>
                    <th style={{ minWidth: '220px' }}>Chức năng / Module</th>
                    <th>Quyền hạn chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map(({ module, actions }) => {
                    const cfg = MODULE_CONFIG[module] || { label: module, desc: '' };
                    const allRowChecked = actions.every((a) => permDraft.has(permKey(module, a)));
                    const someRowChecked = actions.some((a) => permDraft.has(permKey(module, a)));

                    return (
                      <tr
                        key={module}
                        style={{
                          background: someRowChecked ? '#fafafa' : '#fff',
                        }}
                      >
                        {/* Checkbox tích tất cả của dòng */}
                        <td data-label="Tất cả" style={{ textAlign: 'center', background: someRowChecked ? '#f0fdf4' : 'transparent' }}>
                          <input
                            type="checkbox"
                            checked={allRowChecked}
                            onChange={() => toggleModuleAll(module, actions)}
                            style={{ width: '17px', height: '17px', accentColor: 'var(--df-primary)', cursor: 'pointer' }}
                            title="Tích/Bỏ chọn tất cả quyền của module này"
                          />
                        </td>

                        {/* Tên Module & Mô tả */}
                        <td data-label="Chức năng">
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                              {cfg.label}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{cfg.desc}</div>
                          </div>
                        </td>

                        {/* Các Quyền hạn chi tiết */}
                        <td data-label="Quyền hạn">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            {actions.map((action) => {
                              const key = permKey(module, action);
                              const checked = permDraft.has(key);
                              const actCfg = ACTION_CONFIG[action] || {
                                label: action,
                                color: '#334155',
                                bg: '#f1f5f9',
                                border: '#cbd5e1',
                              };

                              return (
                                <label
                                  key={action}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    userSelect: 'none',
                                    background: checked ? actCfg.bg : '#f8fafc',
                                    color: checked ? actCfg.color : '#94a3b8',
                                    border: `1.5px solid ${checked ? actCfg.border : '#e2e8f0'}`,
                                    boxShadow: checked ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePerm(module, action)}
                                    style={{ width: '15px', height: '15px', accentColor: actCfg.color, cursor: 'pointer' }}
                                  />
                                  <span>{actCfg.label}</span>
                                  <InfoTip text={actCfg.desc} active={checked} color={actCfg.color} />
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Thao tác nút bấm Modal */}
            <div className="form-actions" style={{ marginTop: '1.25rem' }}>
              <button type="button" className="btn-ghost" onClick={() => setPermUser(null)}>
                Huỷ bỏ
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={savePermissions}
                disabled={setPermissions.isPending}
                style={{ padding: '0.6rem 1.5rem', fontWeight: 700 }}
              >
                {setPermissions.isPending ? 'Đang lưu…' : '✓ Lưu phân quyền tài khoản'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
