import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PurchaseOrderData } from '@debtflow/shared';
import {
  Plus,
  Trash2,
  ShoppingCart,
  Calendar,
  Building2,
  Truck,
  FileText,
} from 'lucide-react';
import DataTable, { Column } from '../components/DataTable';
import UnifiedFacilitySelect from '../components/UnifiedFacilitySelect';
import Modal from '../components/Modal';
import OrderStatusBadge from '../components/OrderStatusBadge';
import {
  useFacilities,
  useOrderMutations,
  useOrders,
  useProducts,
  useSuppliers,
} from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

interface DraftLine {
  productId: string;
  quantity: string;
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const currentUser = useAuthStore((s) => s.user);

  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: facilities = [] } = useFacilities();
  const activeFacilities = facilities.filter((f) => f.status === 'ACTIVE');
  const facilityQueryParam =
    selectedFacilityIds.length === 0 || selectedFacilityIds.length === activeFacilities.length
      ? undefined
      : selectedFacilityIds.join(',');

  const { data: orders = [], isLoading, isError } = useOrders(
    facilityQueryParam,
    statusFilter || undefined,
  );
  const { create, approve, reject, cancel } = useOrderMutations();

  // ---- State Duyệt đơn ----
  const [orderToApprove, setOrderToApprove] = useState<PurchaseOrderData | null>(null);

  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [approvalDueDate, setApprovalDueDate] = useState('');

  useEffect(() => {
    if (orderToApprove) {
      setApprovalDueDate(defaultDueDate);
    }
  }, [orderToApprove, defaultDueDate]);

  // ---- Form tạo đơn ----
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ supplierId: '', facilityId: '', expectedDate: '', note: '' });
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', quantity: '' }]);
  const [error, setError] = useState('');

  const { data: suppliers = [] } = useSuppliers();
  const activeSuppliers = suppliers.filter((s) => s.status === 'ACTIVE');
  const { data: products = [] } = useProducts(form.supplierId);
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');

  const openCreate = () => {
    setForm({ supplierId: '', facilityId: '', expectedDate: '', note: '' });
    setLines([{ productId: '', quantity: '' }]);
    setError('');
    setModalOpen(true);
  };

  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    if (!items.length) {
      setError('Đơn hàng phải có ít nhất 1 mặt hàng hợp lệ (vui lòng chọn mặt hàng và nhập số lượng > 0)');
      return;
    }

    try {
      const created = await create.mutateAsync({
        supplierId: form.supplierId,
        facilityId: form.facilityId,
        ...(form.expectedDate ? { expectedDate: form.expectedDate } : {}),
        ...(form.note ? { note: form.note.trim() } : {}),
        items,
      });
      setModalOpen(false);
      navigate(`/orders/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo đơn hàng');
    }
  };

  const columns: Column<PurchaseOrderData>[] = [
    {
      key: 'code',
      header: 'Mã đơn hàng',
      render: (o) => <strong style={{ color: 'var(--df-primary-bright)' }}>{o.orderCode}</strong>,
    },
    { key: 'supplier', header: 'Nhà cung cấp', render: (o) => o.supplierName },
    { key: 'facility', header: 'Cơ sở nhận', render: (o) => o.facilityName },
    { key: 'items', header: 'Số mặt hàng', align: 'center', render: (o) => <span className="badge badge-muted">{o.items.length} món</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', render: (o) => <OrderStatusBadge status={o.status} /> },
    { key: 'created', header: 'Ngày tạo đơn', align: 'center', render: (o) => formatDateTime(o.createdAt) },
    {
      key: 'reviewedAt',
      header: 'Thời gian duyệt',
      align: 'center',
      render: (o) => (o.reviewedAt ? formatDateTime(o.reviewedAt) : '—'),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (o) => (
        <div
          style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          {(currentUser?.role === 'ADMIN' || o.status === 'PENDING') && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate(`/orders/${o.id}`)}
              style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}
            >
              Chi tiết
            </button>
          )}
          {can('orders', 'approve') && o.status === 'PENDING' && (
            <>
              <button
                type="button"
                onClick={() => setOrderToApprove(o)}
                style={{
                  border: '1px solid #bbf7d0',
                  background: '#f0fdf4',
                  color: '#15803d',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Duyệt
              </button>
              <button
                type="button"
                onClick={async () => {
                  const reason = window.prompt('Nhập lý do từ chối đơn hàng (nếu có):', 'Từ chối đơn đặt hàng');
                  if (reason !== null) {
                    try {
                      await reject.mutateAsync({ id: o.id, reason: reason || 'Từ chối đơn' });
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Từ chối đơn hàng thất bại');
                    }
                  }
                }}
                disabled={reject.isPending}
                style={{
                  border: '1px solid #fca5a5',
                  background: '#fef2f2',
                  color: '#dc2626',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Từ chối
              </button>
            </>
          )}

          {((o.status === 'PENDING' && can('orders', 'edit')) || (o.status === 'APPROVED' && currentUser?.role === 'ADMIN')) && (
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(`Bạn có chắc muốn huỷ đơn hàng ${o.orderCode}?`)) {
                  try {
                    await cancel.mutateAsync(o.id);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Huỷ đơn thất bại');
                  }
                }
              }}
              disabled={cancel.isPending}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#64748b',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Huỷ
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShoppingCart size={24} color="var(--df-primary)" />
          <h2>Quản lý đặt hàng</h2>
        </div>
        <div className="page-actions">
          <div className="orders-filter-bar">
            <UnifiedFacilitySelect
              facilities={facilities}
              selectedIds={selectedFacilityIds}
              onChange={setSelectedFacilityIds}
            />
            <select
              className="search-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="CANCELLED">Đã huỷ</option>
            </select>
          </div>
          {can('orders', 'edit') && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={18} />
              <span>Tạo đơn đặt hàng mới</span>
            </button>
          )}
        </div>
      </header>

      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(o) => o.id}
        loading={isLoading}
        error={isError}
        onRowClick={(o) => {
          if (currentUser?.role === 'ADMIN' || o.status === 'PENDING') {
            navigate(`/orders/${o.id}`);
          }
        }}
      />

      <Modal title="Tạo đơn đặt hàng mới" open={modalOpen} onClose={() => setModalOpen(false)} size="xl">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Thông tin chung trong Form Card */}
          <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Thông tin đơn hàng
            </h4>
            <div className="form-grid">
              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Building2 size={15} color="var(--df-primary)" />
                  <span>Cơ sở nhập hàng *</span>
                </div>
                <select
                  value={form.facilityId}
                  onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
                  required
                >
                  <option value="">— Chọn cơ sở tiếp nhận —</option>
                  {facilities
                    .filter((f) => f.status === 'ACTIVE')
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Truck size={15} color="var(--df-primary)" />
                  <span>Nhà cung cấp *</span>
                </div>
                <select
                  value={form.supplierId}
                  onChange={(e) => {
                    setForm({ ...form, supplierId: e.target.value });
                    setLines([{ productId: '', quantity: '' }]);
                  }}
                  required
                >
                  <option value="">— Chọn nhà cung cấp —</option>
                  {activeSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} color="var(--df-primary)" />
                  <span>Ngày dự kiến nhận hàng</span>
                </div>
                <input
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                />
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={15} color="var(--df-primary)" />
                  <span>Ghi chú đơn hàng</span>
                </div>
                <input
                  placeholder="Ghi chú đính kèm nếu có..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Danh sách mặt hàng đặt */}
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                2. Danh sách mặt hàng ({lines.length})
              </h4>
              {!form.supplierId && (
                <div style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600, background: '#fef2f2', padding: '0.4rem 0.65rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  ⚠️ Vui lòng chọn Nhà cung cấp trước khi chọn mặt hàng
                </div>
              )}
            </div>

            {/* Các dòng hàng */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    background: '#f8fafc',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    Sản phẩm #{i + 1}
                  </div>
                  <select
                    value={line.productId}
                    onChange={(e) => setLine(i, { productId: e.target.value })}
                    disabled={!form.supplierId}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#fff',
                      width: '100%',
                      minHeight: '44px',
                    }}
                  >
                    <option value="">— Chọn sản phẩm / mặt hàng —</option>
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit})
                      </option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      placeholder="Nhập số lượng đặt..."
                      value={line.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      disabled={!form.supplierId}
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        background: '#fff',
                        flex: '1 1 0',
                        minHeight: '44px',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={lines.length === 1}
                      style={{
                        border: '1px solid #fecaca',
                        background: lines.length === 1 ? '#f1f5f9' : '#fef2f2',
                        color: lines.length === 1 ? '#cbd5e1' : '#dc2626',
                        padding: '0 0.85rem',
                        minHeight: '44px',
                        cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Xóa dòng này"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => setLines((prev) => [...prev, { productId: '', quantity: '' }])}
              disabled={!form.supplierId}
              style={{ marginTop: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Plus size={15} />
              <span>Thêm dòng hàng tiếp theo</span>
            </button>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Đang khởi tạo đơn…' : 'Xác nhận tạo đơn hàng'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Duyệt Đơn Hàng với đầy đủ thông tin chi tiết */}
      <Modal
        title={orderToApprove ? `Duyệt đơn đặt hàng #${orderToApprove.orderCode}` : 'Duyệt đơn đặt hàng'}
        open={!!orderToApprove}
        onClose={() => setOrderToApprove(null)}
        size="lg"
      >
        {orderToApprove && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* Thẻ Thông tin tổng quan */}
            <div
              style={{
                background: '#f8fafc',
                padding: '1rem 1.2rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.8rem 1.5rem',
                fontSize: '0.88rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>👤 Tài khoản người đặt:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{orderToApprove.createdByName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>⏰ Ngày giờ tạo đơn:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{formatDateTime(orderToApprove.createdAt)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>🏭 Nhà cung cấp:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{orderToApprove.supplierName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>🏢 Cơ sở nhận hàng:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{orderToApprove.facilityName}</strong>
              </div>
              {orderToApprove.expectedDate && (
                <div>
                  <span style={{ color: '#64748b' }}>📅 Dự kiến nhận hàng:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{orderToApprove.expectedDate.slice(0, 10)}</strong>
                </div>
              )}
              {orderToApprove.note && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b' }}>📝 Ghi chú:</span>{' '}
                  <span>{orderToApprove.note}</span>
                </div>
              )}
            </div>

            {/* Bảng chi tiết mặt hàng & số lượng */}
            <div>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: '#334155' }}>
                DANH SÁCH MẶT HÀNG ĐẶT ({orderToApprove.items.length})
              </h4>
              <div className="table-wrap">
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Tên mặt hàng</th>
                      <th style={{ textAlign: 'center' }}>ĐVT</th>
                      <th style={{ textAlign: 'center' }}>Số lượng</th>
                      <th style={{ textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderToApprove.items.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Tên mặt hàng">{item.name}</td>
                        <td data-label="ĐVT" style={{ textAlign: 'center' }}>{item.unit}</td>
                        <td data-label="Số lượng" style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                        <td data-label="Đơn giá" style={{ textAlign: 'right' }}>{formatMoney(item.unitPrice)}</td>
                        <td data-label="Thành tiền" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatMoney(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chọn Ngày / Hạn thanh toán tiền khi Quản lý duyệt */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '0.85rem 1.2rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#92400e', display: 'block' }}>
                  📅 NGÀY / HẠN THANH TOÁN TIỀN (QUẢN LÝ DUYỆT):
                </span>
                <span style={{ fontSize: '0.78rem', color: '#b45309' }}>
                  Hạn chót thanh toán công nợ sẽ được tính từ ngày này
                </span>
              </div>
              <input
                type="date"
                value={approvalDueDate}
                onChange={(e) => setApprovalDueDate(e.target.value)}
                required
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #d97706',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#78350f',
                  background: '#fff',
                }}
              />
            </div>

            {/* Tổng giá trị đơn hàng */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '0.85rem 1.2rem',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e40af' }}>
                TỔNG GIÁ TRỊ DUYỆT ĐƠN HÀNG:
              </span>
              <strong style={{ fontSize: '1.25rem', color: '#1e3a8a' }}>
                {formatMoney(orderToApprove.total)}
              </strong>
            </div>

            {/* Form actions */}
            <div className="form-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setOrderToApprove(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={approve.isPending}
                onClick={async () => {
                  try {
                    await approve.mutateAsync({ id: orderToApprove.id, dueDate: approvalDueDate });
                    setOrderToApprove(null);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Duyệt đơn hàng thất bại');
                  }
                }}
              >
                {approve.isPending ? 'Đang duyệt…' : '✓ Xác nhận duyệt đơn hàng'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
