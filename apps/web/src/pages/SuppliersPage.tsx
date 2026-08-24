import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SupplierWithTotals } from '@debtflow/shared';
import DataTable, { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import UnifiedFacilitySelect from '../components/UnifiedFacilitySelect';
import UnifiedDateFilter from '../components/UnifiedDateFilter';
import { useFacilities, useSupplierMutations, useSuppliers } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney } from '../utils/format';

const EMPTY_FORM = {
  code: '',
  name: '',
  phone: '',
  email: '',
  taxCode: '',
  contactPerson: '',
  address: '',
  bankName: '',
  bankAccountNo: '',
  bankAccountName: '',
  qrCodeUrl: '',
  note: '',
};

export default function SuppliersPage() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const [search, setSearch] = useState('');
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: facilities = [] } = useFacilities();
  const { data: suppliers = [], isLoading, isError } = useSuppliers(search || undefined);
  const { create, update } = useSupplierMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierWithTotals | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (s: SupplierWithTotals) => {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      phone: s.phone ?? '',
      email: s.email ?? '',
      taxCode: s.taxCode ?? '',
      contactPerson: s.contactPerson ?? '',
      address: s.address ?? '',
      bankName: s.bankName ?? '',
      bankAccountNo: s.bankAccountNo ?? '',
      bankAccountName: s.bankAccountName ?? '',
      qrCodeUrl: s.qrCodeUrl ?? '',
      note: s.note ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
      } else {
        await create.mutateAsync(body as { code: string; name: string });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  const toggleStatus = (s: SupplierWithTotals) =>
    update.mutate({ id: s.id, status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });

  const columns: Column<SupplierWithTotals>[] = [
    { key: 'code', header: 'Mã', render: (s) => s.code },
    {
      key: 'name',
      header: 'Tên nhà cung cấp',
      render: (s) => (
        <>
          {s.name}
          {s.status === 'INACTIVE' && <span className="badge badge-muted">Ẩn</span>}
        </>
      ),
    },
    { key: 'phone', header: 'Điện thoại', render: (s) => s.phone ?? '—' },
    {
      key: 'invoiced',
      header: 'Tổng phát sinh',
      align: 'right',
      render: (s) => formatMoney(s.totalInvoiced),
    },
    {
      key: 'balance',
      header: 'Còn nợ',
      align: 'right',
      render: (s) => (
        <span className={s.balance > 0 ? 'text-danger' : undefined}>{formatMoney(s.balance)}</span>
      ),
    },
    {
      key: 'overdue',
      header: 'Quá hạn',
      align: 'center',
      render: (s) =>
        s.overdueCount > 0 ? <span className="badge badge-danger">{s.overdueCount}</span> : '—',
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (s) => (
        <div className="btn-action-group" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-action-view"
            onClick={() => navigate(`/suppliers/${s.id}`)}
          >
            Chi tiết
          </button>
          {can('suppliers', 'edit') && (
            <>
              <button type="button" className="btn-action-edit" onClick={() => openEdit(s)}>
                Sửa
              </button>
              <button
                type="button"
                className={s.status === 'ACTIVE' ? 'btn-action-toggle-hide' : 'btn-action-toggle-show'}
                onClick={() => toggleStatus(s)}
              >
                {s.status === 'ACTIVE' ? 'Ẩn' : 'Hiện'}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="page">
      <header className="page-header">
        <h2>Nhà cung cấp</h2>
        <div className="page-actions" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
          <UnifiedFacilitySelect
            facilities={facilities}
            selectedIds={selectedFacilityIds}
            onChange={setSelectedFacilityIds}
          />
          <UnifiedDateFilter
            from={fromDate}
            to={toDate}
            onChange={(f, t) => {
              setFromDate(f);
              setToDate(t);
            }}
          />
          <input
            className="search-input"
            placeholder="Tìm theo tên, mã, SĐT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {can('suppliers', 'edit') && (
            <button className="btn-primary" onClick={openCreate}>
              + Thêm NCC
            </button>
          )}
        </div>
      </header>

      <DataTable
        columns={columns}
        rows={suppliers}
        rowKey={(s) => s.id}
        loading={isLoading}
        error={isError}
        onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
      />

      <Modal
        title={editing ? `Sửa NCC ${editing.code}` : 'Thêm nhà cung cấp'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Mã NCC *
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              disabled={!!editing}
            />
          </label>
          <label>
            Tên *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Điện thoại
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Mã số thuế
            <input
              value={form.taxCode}
              onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
            />
          </label>
          <label>
            Người liên hệ
            <input
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            />
          </label>
          <label className="span-2">
            Địa chỉ
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>

          <label>
            Tên ngân hàng
            <input
              placeholder="Ví dụ: Vietcombank, Techcombank..."
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            />
          </label>
          <label>
            Số tài khoản
            <input
              placeholder="Số TK ngân hàng..."
              value={form.bankAccountNo}
              onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })}
            />
          </label>
          <label className="span-2">
            Tên chủ tài khoản
            <input
              placeholder="Tên chủ tài khoản ngân hàng..."
              value={form.bankAccountName}
              onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
            />
          </label>
          <label className="span-2">
            Ảnh mã QR thanh toán (VietQR)
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.3rem' }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setForm((prev) => ({ ...prev, qrCodeUrl: reader.result as string }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ fontSize: '0.85rem' }}
              />
              {form.qrCodeUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img
                    src={form.qrCodeUrl}
                    alt="VietQR"
                    style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setForm({ ...form, qrCodeUrl: '' })}
                    style={{ fontSize: '0.75rem', color: '#dc2626', padding: '0.15rem 0.4rem' }}
                  >
                    Xoá QR
                  </button>
                </div>
              )}
            </div>
          </label>

          <label className="span-2">
            Ghi chú
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          {error && <div className="form-error span-2">{error}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>
              Lưu
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
