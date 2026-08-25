import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { useOrder, useOrderMutations, useProducts } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const currentUser = useAuthStore((s) => s.user);
  const { data: order, isLoading, isError, error: queryError } = useOrder(id);
  const { approve, reject, cancel, update } = useOrderMutations();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [approveInfo, setApproveInfo] = useState<{ receiptCode: string; total: number } | null>(
    null,
  );

  // State Chỉnh sửa đơn hàng
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ expectedDate: '', note: '' });
  const [editLines, setEditLines] = useState<{ productId: string; quantity: string }[]>([]);
  const { data: products = [] } = useProducts(order?.supplierId ?? '');
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');

  if (isLoading) return <section className="page">Đang tải…</section>;
  if (isError || !order || (order.status === 'APPROVED' && currentUser?.role !== 'ADMIN')) {
    const errorMsg =
      queryError instanceof Error
        ? queryError.message
        : order?.status === 'APPROVED' && currentUser?.role !== 'ADMIN'
        ? 'Đơn hàng đã được Admin duyệt. Nhân viên không có quyền xem chi tiết đơn hàng đã duyệt.'
        : 'Không tìm thấy đơn hàng hoặc không có quyền xem.';

    return (
      <section className="page">
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '560px', margin: '2rem auto' }}>
          <h3 style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '1.15rem' }}>⚠️ Không có quyền truy cập đơn hàng</h3>
          <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '0.92rem', lineHeight: 1.5 }}>
            {errorMsg}
          </p>
          <button className="btn-primary" onClick={() => navigate('/orders')}>
            Quay lại danh sách Đặt hàng
          </button>
        </div>
      </section>
    );
  }

  const onApprove = async () => {
    setError('');
    try {
      const result = await approve.mutateAsync(order.id);
      setApproveInfo({
        receiptCode: result.receipt.receiptCode,
        total: result.payable.totalAmount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt thất bại');
    }
  };

  const onReject = async () => {
    setError('');
    try {
      await reject.mutateAsync({ id: order.id, reason });
      setRejectOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Từ chối thất bại');
    }
  };

  const onCancel = async () => {
    setError('');
    try {
      await cancel.mutateAsync(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Huỷ thất bại');
    }
  };

  const openEdit = () => {
    if (!order) return;
    setEditForm({
      expectedDate: order.expectedDate ? order.expectedDate.slice(0, 10) : '',
      note: order.note || '',
    });
    setEditLines(
      order.items.map((i) => ({
        productId: i.productId || '',
        quantity: String(i.quantity),
      })),
    );
    setError('');
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!order) return;
    setError('');
    const validItems = editLines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));

    if (!validItems.length) {
      setError('Đơn hàng phải có ít nhất 1 mặt hàng hợp lệ (số lượng > 0)');
      return;
    }

    try {
      await update.mutateAsync({
        id: order.id,
        body: {
          expectedDate: editForm.expectedDate || undefined,
          note: editForm.note || undefined,
          items: validItems,
        },
      });
      setEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi cập nhật đơn hàng');
    }
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              marginBottom: '0.5rem',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowLeft size={16} color="#475569" />
            <span>Quay lại</span>
          </button>
          <h2>
            {order.orderCode} <OrderStatusBadge status={order.status} />
          </h2>
        </div>
        <div className="page-actions">
          {order.status === 'PENDING' && can('orders', 'approve') && (
            <>
              <button className="btn-primary" onClick={onApprove} disabled={approve.isPending}>
                {approve.isPending ? 'Đang duyệt…' : '✓ Duyệt đơn'}
              </button>
              <button className="btn-ghost" onClick={() => setRejectOpen(true)}>
                Từ chối
              </button>
            </>
          )}

          {((order.status === 'PENDING' && can('orders', 'edit')) || (order.status === 'APPROVED' && currentUser?.role === 'ADMIN')) && (
            <>
              <button
                className="btn-ghost"
                onClick={openEdit}
                style={{ color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
              >
                ✏️ Chỉnh sửa đơn {order.status === 'APPROVED' ? '(Admin)' : ''}
              </button>
              <button className="btn-ghost" onClick={onCancel} disabled={cancel.isPending}>
                {order.status === 'APPROVED' ? 'Huỷ đơn (Quyền Admin)' : 'Huỷ đơn'}
              </button>
            </>
          )}
        </div>
      </header>

      {error && <div className="form-error">{error}</div>}
      {approveInfo && (
        <div className="approve-banner">
          Đã duyệt — sinh phiếu nhập <strong>{approveInfo.receiptCode}</strong> và công nợ{' '}
          <strong>{formatMoney(approveInfo.total)}</strong> trong 1 transaction.
        </div>
      )}
      {!approveInfo && order.status === 'APPROVED' && (order.resultReceiptId || order.resultPayableId) && (
        <div className="approve-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            ✓ <strong>Đơn hàng đã được duyệt!</strong>
            {order.resultPayableCode && <span> — Công nợ: <strong>{order.resultPayableCode}</strong></span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {order.resultPayableId && can('payables', 'view') && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => navigate(`/payables/${order.resultPayableId}`)}
                style={{ fontSize: '0.82rem', padding: '0.25rem 0.65rem', background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 600 }}
              >
                Xem công nợ →
              </button>
            )}
          </div>
        </div>
      )}

      <div className="supplier-info">
        <span>NCC: <strong>{order.supplierName}</strong></span>
        <span>Cơ sở: {order.facilityName}</span>
        <span>Người tạo: {order.createdByName ?? order.createdBy}</span>
        <span>Ngày tạo: {formatDateTime(order.createdAt)}</span>
        {order.expectedDate && <span>Dự kiến nhận: {formatDateTime(order.expectedDate)}</span>}
        {order.reviewedAt && <span>Xử lý lúc: {formatDateTime(order.reviewedAt)}</span>}
        {order.rejectReason && (
          <span className="text-danger">Lý do từ chối: {order.rejectReason}</span>
        )}
        {order.note && <span>Ghi chú: {order.note}</span>}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mặt hàng</th>
              <th style={{ textAlign: 'center' }}>ĐVT</th>
              <th style={{ textAlign: 'right' }}>Số lượng</th>
              {currentUser?.role === 'ADMIN' && <th style={{ textAlign: 'right' }}>Đơn giá</th>}
              {currentUser?.role === 'ADMIN' && <th style={{ textAlign: 'right' }}>Thành tiền</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td data-label="Mặt hàng">{item.name}</td>
                <td data-label="ĐVT" style={{ textAlign: 'center' }}>{item.unit}</td>
                <td data-label="Số lượng" style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                {currentUser?.role === 'ADMIN' && (
                  <td data-label="Đơn giá" style={{ textAlign: 'right' }}>{formatMoney(item.unitPrice)}</td>
                )}
                {currentUser?.role === 'ADMIN' && (
                  <td data-label="Thành tiền" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatMoney(item.unitPrice * item.quantity)}
                  </td>
                )}
              </tr>
            ))}
            {currentUser?.role === 'ADMIN' && (
              <tr className="order-total-row">
                <td colSpan={4}>Tổng cộng</td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{formatMoney(order.total)}</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Từ chối đơn hàng" open={rejectOpen} onClose={() => setRejectOpen(false)}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          Lý do từ chối *
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--df-border)' }}
          />
        </label>
        <div className="form-actions">
          <button className="btn-ghost" onClick={() => setRejectOpen(false)}>
            Đóng
          </button>
          <button
            className="btn-primary"
            onClick={onReject}
            disabled={reason.trim().length < 3 || reject.isPending}
          >
            Xác nhận từ chối
          </button>
        </div>
      </Modal>

      <Modal title={`Chỉnh sửa đơn hàng ${order.orderCode}`} open={editOpen} onClose={() => setEditOpen(false)} size="xl">
        {order.status === 'APPROVED' && (
          <div style={{ padding: '0.75rem 1rem', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', color: '#854d0e', fontSize: '0.88rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>ℹ️</span>
            <span><strong>Lưu ý:</strong> Đơn hàng đã duyệt. Khi bạn thay đổi số lượng, số tiền công nợ phát sinh liên quan sẽ được hệ thống tự động tính toán & cập nhật lại tương ứng.</span>
          </div>
        )}

        <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
            Thông tin chung
          </h4>
          <div className="responsive-form-grid">
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
              Ngày dự kiến nhận
              <input
                type="date"
                value={editForm.expectedDate}
                onChange={(e) => setEditForm({ ...editForm, expectedDate: e.target.value })}
                style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#fff' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
              Ghi chú đơn hàng
              <input
                type="text"
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                placeholder="Ghi chú đơn hàng..."
                style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#fff' }}
              />
            </label>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
              Danh sách mặt hàng ({editLines.length})
            </h4>
          </div>

          <div className="order-edit-header">
            <div>MẶT HÀNG</div>
            <div style={{ textAlign: 'right' }}>SỐ LƯỢNG</div>
            <div style={{ textAlign: 'center' }}>ĐVT</div>
            <div></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '0.2rem' }}>
            {editLines.map((line, idx) => {
              const prod = activeProducts.find((p) => p.id === line.productId);
              return (
                <div key={idx} className="order-edit-row">
                  <select
                    value={line.productId}
                    onChange={(e) =>
                      setEditLines(editLines.map((l, i) => (i === idx ? { ...l, productId: e.target.value } : l)))
                    }
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#fff' }}
                  >
                    <option value="">-- Chọn mặt hàng --</option>
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatMoney(p.price)}/{p.unit}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Số lượng"
                    value={line.quantity}
                    onChange={(e) =>
                      setEditLines(editLines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))
                    }
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'right', fontWeight: 600, background: '#fff' }}
                  />

                  <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#475569', background: '#e2e8f0', padding: '0.35rem 0.5rem', borderRadius: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prod?.unit || '—'}
                  </div>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setEditLines(editLines.filter((_, i) => i !== idx))}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', color: '#ef4444', background: '#fee2e2', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                    title="Xóa dòng này"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditLines([...editLines, { productId: '', quantity: '' }])}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--df-primary)', fontWeight: 600 }}
            >
              <Plus size={16} /> Thêm dòng sản phẩm
            </button>

            {currentUser?.role === 'ADMIN' && (
              <div style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                Tổng tiền ước tính:{' '}
                <strong style={{ fontSize: '1.1rem', color: '#16a34a' }}>
                  {formatMoney(
                    editLines.reduce((sum, l) => {
                      const p = activeProducts.find((item) => item.id === l.productId);
                      return sum + (p ? p.price * (Number(l.quantity) || 0) : 0);
                    }, 0),
                  )}
                </strong>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '1.25rem' }}>
          <button className="btn-ghost" onClick={() => setEditOpen(false)}>
            Hủy
          </button>
          <button className="btn-primary" onClick={onSaveEdit} disabled={update.isPending}>
            {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
