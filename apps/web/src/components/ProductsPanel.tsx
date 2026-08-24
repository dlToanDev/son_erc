import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { SupplierProduct } from '@debtflow/shared';
import DataTable, { Column } from './DataTable';
import Modal from './Modal';
import { useProductMutations, useProducts, useSuppliers, keys } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney } from '../utils/format';
import { getUnits } from '../utils/units';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { createProduct, listProducts } from '../api/masterData';

const EMPTY_FORM = { name: '', unit: '', price: '', note: '' };

/** Bảng mặt hàng của 1 NCC hoặc tất cả NCC — dùng ở tab Chi tiết NCC và trang Mặt hàng. */
export default function ProductsPanel({ supplierId }: { supplierId: string }) {
  const can = useAuthStore((s) => s.can);
  const qc = useQueryClient();

  const isAllMode = supplierId === 'ALL' || !supplierId;

  const { data: singleProducts = [], isLoading: isSingleLoading } = useProducts(
    isAllMode ? '' : supplierId,
  );
  const { data: suppliers = [] } = useSuppliers();
  const activeSuppliers = suppliers.filter((s) => s.status === 'ACTIVE');

  // Multi-supplier queries for ALL mode
  const multiQueries = useQueries({
    queries: activeSuppliers.map((s) => ({
      queryKey: keys.products(s.id),
      queryFn: () => listProducts(s.id),
      enabled: isAllMode,
    })),
  });

  const isLoading = isAllMode
    ? multiQueries.some((q) => q.isLoading)
    : isSingleLoading;

  const rawProducts: SupplierProduct[] = useMemo(() => {
    if (isAllMode) {
      return multiQueries.flatMap((q) => q.data ?? []);
    }
    return singleProducts;
  }, [isAllMode, multiQueries, singleProducts]);

  const defaultSupplierId = isAllMode ? (activeSuppliers[0]?.id ?? '') : supplierId;
  const { update, remove } = useProductMutations(defaultSupplierId);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierProduct | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(defaultSupplierId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableUnits = getUnits();
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers],
  );

  // Real-time Filtering logic
  const filteredProducts = useMemo(() => {
    return rawProducts.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sup = supplierMap.get(p.supplierId);
        const matchName = p.name.toLowerCase().includes(q);
        const matchNote = p.note ? p.note.toLowerCase().includes(q) : false;
        const matchUnit = p.unit.toLowerCase().includes(q);
        const matchSup = sup
          ? sup.name.toLowerCase().includes(q) || sup.code.toLowerCase().includes(q)
          : false;
        if (!matchName && !matchNote && !matchUnit && !matchSup) return false;
      }
      if (unitFilter && p.unit !== unitFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      return true;
    });
  }, [rawProducts, searchQuery, unitFilter, statusFilter, supplierMap]);

  const handleDelete = async (p: SupplierProduct) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá mặt hàng "${p.name}"?`)) {
      try {
        await remove.mutateAsync(p.id);
        qc.invalidateQueries({ queryKey: keys.products(p.supplierId) });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Xoá mặt hàng thất bại');
      }
    }
  };

  useEffect(() => {
    setSelectedSupplierId(defaultSupplierId);
  }, [defaultSupplierId]);

  const openCreate = () => {
    setEditing(null);
    setSelectedSupplierId(defaultSupplierId);
    setForm(EMPTY_FORM);
    setIsCustomUnit(false);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: SupplierProduct) => {
    setEditing(p);
    setSelectedSupplierId(p.supplierId || defaultSupplierId);
    setForm({ name: p.name, unit: p.unit, price: String(p.price), note: p.note ?? '' });
    setIsCustomUnit(!availableUnits.includes(p.unit));
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const targetSupplierId = selectedSupplierId || defaultSupplierId;
    const body = {
      name: form.name,
      unit: form.unit,
      price: Number(form.price),
      ...(form.note ? { note: form.note } : {}),
    };

    try {
      if (editing) {
        await update.mutateAsync({ productId: editing.id, ...body });
        qc.invalidateQueries({ queryKey: keys.products(editing.supplierId) });
      } else {
        await createProduct(targetSupplierId, body);
        qc.invalidateQueries({ queryKey: keys.products(targetSupplierId) });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<SupplierProduct>[] = [
    {
      key: 'name',
      header: 'Tên mặt hàng',
      width: '25%',
      render: (p) => (
        <>
          {p.name}
          {p.status === 'INACTIVE' && <span className="badge badge-muted">Ẩn</span>}
        </>
      ),
    },
    { key: 'unit', header: 'ĐVT', align: 'center', width: '80px', render: (p) => p.unit },
    { key: 'price', header: 'Đơn giá', align: 'right', width: '130px', render: (p) => formatMoney(p.price) },
    {
      key: 'supplier',
      header: 'Nhà cung cấp',
      width: '22%',
      render: (p) => {
        const sup = supplierMap.get(p.supplierId);
        return sup ? sup.name : '—';
      },
    },
    { key: 'note', header: 'Ghi chú', width: '25%', render: (p) => p.note ?? '—' },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      width: '155px',
      render: (p) =>
        can('products', 'edit') && (
          <div className="btn-action-group">
            <button
              type="button"
              className="btn-action-edit"
              onClick={() => openEdit(p)}
              title="Sửa mặt hàng"
            >
              Sửa
            </button>
            <button
              type="button"
              className={p.status === 'ACTIVE' ? 'btn-action-toggle-hide' : 'btn-action-toggle-show'}
              onClick={() => {
                update.mutate({
                  productId: p.id,
                  status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                });
                qc.invalidateQueries({ queryKey: keys.products(p.supplierId) });
              }}
              title={p.status === 'ACTIVE' ? 'Ẩn mặt hàng' : 'Hiện mặt hàng'}
            >
              {p.status === 'ACTIVE' ? 'Ẩn' : 'Hiện'}
            </button>
            <button
              type="button"
              className="btn-action-delete"
              onClick={() => handleDelete(p)}
              disabled={remove.isPending}
              title="Xoá mặt hàng"
            >
              Xoá
            </button>
          </div>
        ),
    },
  ];

  const hasActiveFilters = Boolean(searchQuery || unitFilter || statusFilter);

  return (
    <div>
      {/* Thanh Tìm kiếm & Bộ lọc */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.65rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          background: '#f8fafc',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Tìm theo tên mặt hàng, NCC, ghi chú..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ minWidth: '240px', flex: '1 1 240px', background: '#fff' }}
          />

          <select
            className="search-input"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            style={{ minWidth: '130px', background: '#fff' }}
          >
            <option value="">Tất cả ĐVT</option>
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            className="search-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: '150px', background: '#fff' }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Ẩn</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSearchQuery('');
                setUnitFilter('');
                setStatusFilter('');
              }}
              style={{ fontSize: '0.82rem', padding: '0.35rem 0.6rem' }}
            >
              ✕ Xóa lọc
            </button>
          )}
        </div>

        {can('products', 'edit') && (
          <button className="btn-primary" onClick={openCreate}>
            + Thêm mặt hàng
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filteredProducts}
        rowKey={(p) => p.id}
        loading={isLoading}
        emptyText={hasActiveFilters ? 'Không tìm thấy mặt hàng phù hợp với bộ lọc' : 'Chưa có mặt hàng nào'}
      />

      <Modal
        title={editing ? `Sửa "${editing.name}"` : 'Thêm mặt hàng'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="span-2">
            Nhà cung cấp *
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              required
              disabled={!!editing}
            >
              {activeSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Tên mặt hàng *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Đơn vị tính *
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
              <select
                value={isCustomUnit ? '__CUSTOM__' : form.unit}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__CUSTOM__') {
                    setIsCustomUnit(true);
                    setForm({ ...form, unit: '' });
                  } else {
                    setIsCustomUnit(false);
                    setForm({ ...form, unit: val });
                  }
                }}
                required={!isCustomUnit}
              >
                <option value="">— Chọn đơn vị tính —</option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Nhập đơn vị khác...</option>
              </select>

              {isCustomUnit && (
                <input
                  type="text"
                  placeholder="Nhập đơn vị tính mới (ví dụ: Cuộn, Mét, Kg...)"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                  autoFocus
                />
              )}
            </div>
          </label>
          <label>
            Đơn giá *
            <input
              type="number"
              min="0"
              step="1000"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
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
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || update.isPending}
            >
              Lưu
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
