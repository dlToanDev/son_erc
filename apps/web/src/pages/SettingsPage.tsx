import { FormEvent, useEffect, useState } from 'react';
import type { Facility } from '@debtflow/shared';
import DataTable, { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import {
  useFacilities,
  useFacilityMutations,
  useLatestBackup,
  useRestoreLatestBackup,
  useSettings,
  useSettingsMutation,
  useUsers,
  useUserMutations,
} from '../hooks/queries';
import type { UserWithPermissions } from '../api/masterData';
import { useAuthStore } from '../store/auth';
import { formatDateTime } from '../utils/format';
import { getUnits, saveUnits } from '../utils/units';

const EMPTY_USER_FORM = { name: '', email: '', password: '', role: 'STAFF' as 'ADMIN' | 'STAFF' };

export default function SettingsPage() {
  // ---- Facilities ----
  const { data: facilities = [], isLoading: isLoadingFacilities } = useFacilities();
  const { create: createFacility, update: updateFacility } = useFacilityMutations();
  const [facilityModalOpen, setFacilityModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [facilityForm, setFacilityForm] = useState({ code: '', name: '', address: '' });
  const [facilityError, setFacilityError] = useState('');

  const openCreateFacility = () => {
    setEditingFacility(null);
    setFacilityForm({ code: '', name: '', address: '' });
    setFacilityError('');
    setFacilityModalOpen(true);
  };

  const openEditFacility = (f: Facility) => {
    setEditingFacility(f);
    setFacilityForm({ code: f.code, name: f.name, address: f.address ?? '' });
    setFacilityError('');
    setFacilityModalOpen(true);
  };

  const onSubmitFacility = async (e: FormEvent) => {
    e.preventDefault();
    setFacilityError('');
    try {
      if (editingFacility) {
        await updateFacility.mutateAsync({
          id: editingFacility.id,
          name: facilityForm.name,
          address: facilityForm.address,
        });
      } else {
        await createFacility.mutateAsync(facilityForm);
      }
      setFacilityModalOpen(false);
    } catch (err) {
      setFacilityError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  const facilityColumns: Column<Facility>[] = [
    { key: 'code', header: 'Mã', render: (f) => f.code },
    {
      key: 'name',
      header: 'Tên cơ sở',
      render: (f) => (
        <>
          {f.name}
          {f.status === 'INACTIVE' && <span className="badge badge-muted">Ẩn</span>}
        </>
      ),
    },
    { key: 'address', header: 'Địa chỉ', render: (f) => f.address ?? '—' },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (f) => (
        <div className="btn-action-group">
          <button type="button" className="btn-action-edit" onClick={() => openEditFacility(f)}>
            Sửa
          </button>
          <button
            type="button"
            className={f.status === 'ACTIVE' ? 'btn-action-toggle-hide' : 'btn-action-toggle-show'}
            onClick={() =>
              updateFacility.mutate({
                id: f.id,
                status: f.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
              })
            }
          >
            {f.status === 'ACTIVE' ? 'Ẩn' : 'Hiện'}
          </button>
        </div>
      ),
    },
  ];

  // ---- Users / Staff Accounts ----
  const currentUser = useAuthStore((s) => s.user);
  const { data: users = [], isLoading: isLoadingUsers } = useUsers();
  const { create: createUser, update: updateUser } = useUserMutations();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithPermissions | null>(null);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [userError, setUserError] = useState('');

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm(EMPTY_USER_FORM);
    setUserError('');
    setUserModalOpen(true);
  };

  const openEditUser = (u: UserWithPermissions) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email, password: '', role: u.role });
    setUserError('');
    setUserModalOpen(true);
  };

  const onSubmitUser = async (e: FormEvent) => {
    e.preventDefault();
    setUserError('');
    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          id: editingUser.id,
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          ...(userForm.password ? { password: userForm.password } : {}),
        });
      } else {
        await createUser.mutateAsync(userForm);
      }
      setUserModalOpen(false);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  const userColumns: Column<UserWithPermissions>[] = [
    { key: 'name', header: 'Tên nhân viên', render: (u) => u.name },
    { key: 'email', header: 'Email / Tài khoản', render: (u) => u.email },
    {
      key: 'role',
      header: 'Vai trò',
      render: (u) => (
        <span className={`badge ${u.role === 'ADMIN' ? 'badge-primary' : ''}`}>{u.role}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (u) =>
        u.status === 'ACTIVE' ? (
          <span className="badge badge-success">Hoạt động</span>
        ) : (
          <span className="badge badge-muted">Khoá</span>
        ),
    },
    { key: 'last', header: 'Đăng nhập cuối', render: (u) => formatDateTime(u.lastLoginAt) },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (u) => (
        <div className="btn-action-group">
          <button type="button" className="btn-action-edit" onClick={() => openEditUser(u)}>
            Sửa
          </button>
          {u.id !== currentUser?.id && (
            <button
              type="button"
              className={u.status === 'ACTIVE' ? 'btn-action-toggle-hide' : 'btn-action-toggle-show'}
              onClick={() =>
                updateUser.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
              }
            >
              {u.status === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
            </button>
          )}
        </div>
      ),
    },
  ];

  // ---- Units ("Thùng", "Hộp", ...) ----
  const [units, setUnits] = useState<string[]>(getUnits());
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [unitError, setUnitError] = useState('');

  const openAddUnit = () => {
    setNewUnitName('');
    setUnitError('');
    setUnitModalOpen(true);
  };

  const handleAddUnit = (e: FormEvent) => {
    e.preventDefault();
    setUnitError('');
    const name = newUnitName.trim();
    if (!name) return;
    if (units.some((u) => u.toLowerCase() === name.toLowerCase())) {
      setUnitError('Đơn vị tính này đã có trong danh sách!');
      return;
    }
    const nextUnits = [...units, name];
    setUnits(nextUnits);
    saveUnits(nextUnits);
    setUnitModalOpen(false);
  };

  const handleDeleteUnit = (unitToDelete: string) => {
    const nextUnits = units.filter((u) => u !== unitToDelete);
    setUnits(nextUnits);
    saveUnits(nextUnits);
  };

  // ---- System Settings ----
  const { data: settings } = useSettings();
  const settingsMutation = useSettingsMutation();
  const [config, setConfig] = useState({ warningDays: 7, criticalWarningDays: 3, currency: 'VND' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setConfig({
        warningDays: settings.warningDays,
        criticalWarningDays: settings.criticalWarningDays,
        currency: settings.currency || 'VND',
      });
    }
  }, [settings]);

  const onSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    await settingsMutation.mutateAsync(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ---- Khôi phục dữ liệu (Vùng nguy hiểm) ----
  const RESTORE_PHRASE = 'KHOI PHUC';
  const isAdmin = currentUser?.role === 'ADMIN';
  const { data: latestBackup } = useLatestBackup();
  const restoreMutation = useRestoreLatestBackup();
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoreError, setRestoreError] = useState('');

  const openRestore = () => {
    setRestoreConfirm('');
    setRestoreError('');
    setRestoreModalOpen(true);
  };

  const onConfirmRestore = async (e: FormEvent) => {
    e.preventDefault();
    setRestoreError('');
    try {
      const res = await restoreMutation.mutateAsync(restoreConfirm);
      alert(`Đã khôi phục dữ liệu về bản: ${res.restoredFrom}\nTrang sẽ tải lại.`);
      window.location.reload();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Khôi phục thất bại');
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <h2>Cài đặt hệ thống</h2>
      </header>

      {/* 1. Facility Management */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>1. Danh sách Cơ sở / Chi nhánh</h3>
          <button className="btn-primary" onClick={openCreateFacility}>
            + Thêm cơ sở
          </button>
        </div>
        <DataTable columns={facilityColumns} rows={facilities} rowKey={(f) => f.id} loading={isLoadingFacilities} />
      </div>

      {/* 2. Employee Accounts Management */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>2. Quản lý Tài khoản Nhân viên</h3>
          <button className="btn-primary" onClick={openCreateUser}>
            + Thêm tài khoản nhân viên
          </button>
        </div>
        <DataTable columns={userColumns} rows={users} rowKey={(u) => u.id} loading={isLoadingUsers} />
      </div>

      {/* 3. Units Management */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>3. Danh mục Đơn vị tính (ĐVT)</h3>
          <button className="btn-primary" onClick={openAddUnit}>
            + Thêm đơn vị tính
          </button>
        </div>
        <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', padding: '1.25rem' }}>
          {units.map((u) => (
            <span
              key={u}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '0.4rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              {u}
              {units.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteUnit(u)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '0 2px',
                  }}
                  title={`Xóa đơn vị ${u}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Settings Form */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3>4. Cảnh báo công nợ & Tiền tệ</h3>
        <form className="settings-form" onSubmit={onSaveSettings}>
          <label>
            Cảnh báo trước hạn (ngày)
            <input
              type="number"
              min="0"
              value={config.warningDays}
              onChange={(e) => setConfig({ ...config, warningDays: Number(e.target.value) })}
            />
          </label>
          <label>
            Cảnh báo khẩn (ngày)
            <input
              type="number"
              min="0"
              value={config.criticalWarningDays}
              onChange={(e) => setConfig({ ...config, criticalWarningDays: Number(e.target.value) })}
            />
          </label>
          <label>
            Đơn vị tiền
            <input
              value={config.currency}
              onChange={(e) => setConfig({ ...config, currency: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={settingsMutation.isPending}>
              Lưu cấu hình
            </button>
            {saved && <span className="badge badge-success">Đã lưu</span>}
          </div>
        </form>
      </div>

      {/* 5. Vùng nguy hiểm — Khôi phục dữ liệu */}
      {isAdmin && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ color: '#b91c1c' }}>5. Vùng nguy hiểm</h3>
          <div
            className="panel"
            style={{ border: '1px solid #fecaca', background: '#fef2f2', padding: '1.25rem' }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>
              Khôi phục dữ liệu về bản backup gần nhất
            </div>
            <div style={{ fontSize: '0.9rem', color: '#7f1d1d', marginBottom: '0.75rem' }}>
              {latestBackup ? (
                <>
                  Bản gần nhất: <strong>{formatDateTime(latestBackup.createdAt)}</strong>. Khi khôi
                  phục, <strong>toàn bộ dữ liệu tạo sau thời điểm này sẽ mất</strong>.
                </>
              ) : (
                <>Chưa có bản backup nào để khôi phục.</>
              )}
            </div>
            <button
              type="button"
              className="btn-danger"
              onClick={openRestore}
              disabled={!latestBackup}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: latestBackup ? 'pointer' : 'not-allowed',
                opacity: latestBackup ? 1 : 0.5,
              }}
            >
              Khôi phục dữ liệu về bản gần nhất
            </button>
          </div>
        </div>
      )}

      {/* Modal Facility */}
      <Modal
        title={editingFacility ? `Sửa cơ sở ${editingFacility.code}` : 'Thêm cơ sở mới'}
        open={facilityModalOpen}
        onClose={() => setFacilityModalOpen(false)}
      >
        <form className="form-grid" onSubmit={onSubmitFacility}>
          <label>
            Mã cơ sở *
            <input
              value={facilityForm.code}
              onChange={(e) => setFacilityForm({ ...facilityForm, code: e.target.value })}
              required
              disabled={!!editingFacility}
            />
          </label>
          <label>
            Tên *
            <input
              value={facilityForm.name}
              onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
              required
            />
          </label>
          <label className="span-2">
            Địa chỉ
            <input
              value={facilityForm.address}
              onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })}
            />
          </label>
          {facilityError && <div className="form-error span-2">{facilityError}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setFacilityModalOpen(false)}>
              Huỷ
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createFacility.isPending || updateFacility.isPending}
            >
              Lưu
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal User / Staff Account */}
      <Modal
        title={editingUser ? `Sửa tài khoản ${editingUser.email}` : 'Thêm tài khoản nhân viên mới'}
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
      >
        <form className="form-grid" onSubmit={onSubmitUser}>
          <label className="span-2">
            Họ tên nhân viên *
            <input
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              required
            />
          </label>
          <label className="span-2">
            Email / Tên đăng nhập *
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              required
            />
          </label>
          <label>
            {editingUser ? 'Mật khẩu mới (bỏ trống nếu giữ)' : 'Mật khẩu *'}
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              required={!editingUser}
              minLength={6}
            />
          </label>
          <label>
            Vai trò
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'ADMIN' | 'STAFF' })}
              disabled={editingUser?.id === currentUser?.id}
            >
              <option value="STAFF">STAFF (Nhân viên)</option>
              <option value="ADMIN">ADMIN (Quản trị)</option>
            </select>
          </label>
          {userError && <div className="form-error span-2">{userError}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setUserModalOpen(false)}>
              Huỷ
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createUser.isPending || updateUser.isPending}
            >
              Lưu tài khoản
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Add Unit */}
      <Modal
        title="Thêm đơn vị tính mới"
        open={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
      >
        <form className="form-grid" onSubmit={handleAddUnit}>
          <label className="span-2">
            Tên đơn vị tính mới *
            <input
              placeholder="VD: Thùng, Hộp, Chai, Lon, Bao..."
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              required
              autoFocus
            />
          </label>
          {unitError && <div className="form-error span-2">{unitError}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setUnitModalOpen(false)}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary">
              Thêm đơn vị
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal xác nhận khôi phục dữ liệu */}
      <Modal
        title="⚠️ Khôi phục dữ liệu về bản gần nhất"
        open={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
      >
        <form className="form-grid" onSubmit={onConfirmRestore}>
          <div className="span-2" style={{ color: '#7f1d1d', lineHeight: 1.6 }}>
            {latestBackup && (
              <p style={{ margin: '0 0 0.5rem' }}>
                Sẽ đưa dữ liệu về bản backup lúc{' '}
                <strong>{formatDateTime(latestBackup.createdAt)}</strong>.
              </p>
            )}
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Toàn bộ dữ liệu tạo sau thời điểm đó sẽ bị mất và KHÔNG khôi phục lại được.</strong>
            </p>
            <p style={{ margin: 0 }}>
              Gõ đúng <code>{RESTORE_PHRASE}</code> để xác nhận:
            </p>
          </div>
          <label className="span-2">
            <input
              value={restoreConfirm}
              onChange={(e) => setRestoreConfirm(e.target.value)}
              placeholder={RESTORE_PHRASE}
              autoFocus
            />
          </label>
          {restoreError && <div className="form-error span-2">{restoreError}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setRestoreModalOpen(false)}>
              Huỷ
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={restoreConfirm !== RESTORE_PHRASE || restoreMutation.isPending}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontWeight: 700,
                opacity: restoreConfirm !== RESTORE_PHRASE || restoreMutation.isPending ? 0.5 : 1,
              }}
            >
              {restoreMutation.isPending ? 'Đang khôi phục...' : 'Khôi phục ngay'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
