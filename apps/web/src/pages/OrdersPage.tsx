import { FormEvent, useState } from 'react';
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
import PayOrderModal from '../components/PayOrderModal';
import ApproveOrderModal from '../components/ApproveOrderModal';
import ReceiveOrderModal from '../components/ReceiveOrderModal';
import OrderDetailModal from '../components/OrderDetailModal';
import {
  useFacilities,
  useOrderMutations,
  useOrders,
  useProducts,
  useSuppliers,
} from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatDateTime } from '../utils/format';

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
  const { create, reject, cancel } = useOrderMutations();

  // ---- State Chi tiết đơn (cửa sổ) ----
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  // ---- State Thanh toán (form đầy đủ + ảnh minh chứng) ----
  const [orderToPay, setOrderToPay] = useState<PurchaseOrderData | null>(null);

  // ---- State Duyệt đơn ----
  const [orderToApprove, setOrderToApprove] = useState<PurchaseOrderData | null>(null);

  // ---- State Nhận hàng ----
  const [orderToReceive, setOrderToReceive] = useState<PurchaseOrderData | null>(null);

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
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn-act btn-act--gray" onClick={() => setDetailOrderId(o.id)}>
            Chi tiết
          </button>

          {/* In đơn gửi NCC — chỉ đơn đã duyệt trở đi (khớp PRINTABLE_STATUSES ở backend). */}
          {can('orders', 'print') && ['APPROVED', 'RECEIVED', 'PAID'].includes(o.status) && (
            <button
              type="button"
              className="btn-act btn-act--blue"
              title="Mở bản in đơn hàng để gửi nhà cung cấp"
              onClick={() => window.open(`/orders/${o.id}/print`, '_blank')}
            >
              In đơn
            </button>
          )}

          {can('orders', 'approve') && o.status === 'PENDING' && (
            <>
              <button type="button" className="btn-act btn-act--green" onClick={() => setOrderToApprove(o)}>
                Duyệt
              </button>
              <button
                type="button"
                className="btn-act btn-act--red"
                disabled={reject.isPending}
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
              >
                Từ chối
              </button>
            </>
          )}

          {can('orders', 'approve') && o.status === 'APPROVED' && (
            <button type="button" className="btn-act btn-act--teal" onClick={() => setOrderToReceive(o)}>
              Nhận hàng
            </button>
          )}

          {can('orders', 'approve') && o.status === 'RECEIVED' && (
            <button type="button" className="btn-act btn-act--green" onClick={() => setOrderToPay(o)}>
              Thanh toán
            </button>
          )}

          {((o.status === 'PENDING' && can('orders', 'edit')) ||
            (o.status === 'APPROVED' && currentUser?.role === 'ADMIN')) && (
            <button
              type="button"
              className="btn-act btn-act--gray"
              disabled={cancel.isPending}
              onClick={async () => {
                if (window.confirm(`Bạn có chắc muốn huỷ đơn hàng ${o.orderCode}?`)) {
                  try {
                    await cancel.mutateAsync(o.id);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Huỷ đơn thất bại');
                  }
                }
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
              <option value="RECEIVED">Đã nhận hàng</option>
              <option value="PAID">Đã thanh toán</option>
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
        onRowClick={(o) => setDetailOrderId(o.id)}
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

      <ApproveOrderModal
        order={orderToApprove}
        open={!!orderToApprove}
        onClose={() => setOrderToApprove(null)}
      />

      <ReceiveOrderModal
        order={orderToReceive}
        open={!!orderToReceive}
        onClose={() => setOrderToReceive(null)}
      />

      <PayOrderModal order={orderToPay} open={!!orderToPay} onClose={() => setOrderToPay(null)} />

      <OrderDetailModal
        orderId={detailOrderId ?? ''}
        open={!!detailOrderId}
        onClose={() => setDetailOrderId(null)}
      />
    </section>
  );
}
