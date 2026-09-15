import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import OrderStatusBadge from './OrderStatusBadge';
import ApproveOrderModal from './ApproveOrderModal';
import ReceiveOrderModal from './ReceiveOrderModal';
import PayOrderModal from './PayOrderModal';
import { useOrder, useOrderMutations, useProducts } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

interface Props {
  orderId: string;
  open: boolean;
  onClose: () => void;
}

/** Cửa sổ chi tiết đơn hàng — xem + mọi thao tác (duyệt/nhận/thanh toán/sửa/xóa). */
export default function OrderDetailModal({ orderId, open, onClose }: Props) {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  // Xem tiền: Admin luôn thấy; nhân viên chỉ thấy nếu được cấp quyền orders.viewPrice.
  const canSeeMoney = isAdmin || can('orders', 'viewPrice');
  const { data: order, isLoading, isError, error: queryError } = useOrder(orderId);
  // Chỉ in được đơn đã duyệt trở đi (khớp PRINTABLE_STATUSES ở backend).
  const canPrint =
    can('orders', 'print') && !!order && ['APPROVED', 'RECEIVED', 'PAID'].includes(order.status);
  const { reject, cancel, update, remove } = useOrderMutations();

  const [error, setError] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  // Xóa đơn (Admin) — cảnh báo kỹ + tick xác nhận
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAck, setDeleteAck] = useState(false);

  // Chỉnh sửa đơn hàng
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ expectedDate: '', note: '' });
  const [editLines, setEditLines] = useState<{ productId: string; quantity: string; unitPrice: string }[]>([]);
  const { data: products = [] } = useProducts(order?.supplierId ?? '');
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');

  // Reset trạng thái tạm khi đổi đơn hoặc đóng/mở cửa sổ (tránh sót lý do từ chối / lỗi cũ).
  useEffect(() => {
    setError('');
    setReason('');
    setApproveOpen(false);
    setReceiveOpen(false);
    setPayOpen(false);
    setRejectOpen(false);
    setDeleteOpen(false);
    setDeleteAck(false);
    setEditOpen(false);
  }, [orderId, open]);

  const title = order ? `Đơn hàng ${order.orderCode}` : 'Chi tiết đơn hàng';

  const onReject = async () => {
    if (!order) return;
    setError('');
    try {
      await reject.mutateAsync({ id: order.id, reason });
      setRejectOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Từ chối thất bại');
    }
  };

  const onCancel = async () => {
    if (!order) return;
    setError('');
    try {
      await cancel.mutateAsync(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Huỷ thất bại');
    }
  };

  const openDelete = () => {
    setDeleteAck(false);
    setError('');
    setDeleteOpen(true);
  };

  const onDelete = async () => {
    if (!order) return;
    setError('');
    try {
      await remove.mutateAsync(order.id);
      setDeleteOpen(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa đơn thất bại');
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
        unitPrice: String(i.unitPrice),
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
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        ...(isAdmin && l.unitPrice !== '' && Number(l.unitPrice) >= 0
          ? { unitPrice: Number(l.unitPrice) }
          : {}),
      }));

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
    <Modal title={title} open={open} onClose={onClose} size="xl">
      {isLoading && <div style={{ padding: '1.5rem' }}>Đang tải…</div>}

      {!isLoading && (isError || !order) && (
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
          <h3 style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '1.1rem' }}>
            ⚠️ Không truy cập được đơn hàng
          </h3>
          <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5 }}>
            {queryError instanceof Error
              ? queryError.message
              : 'Không tìm thấy đơn hàng hoặc không có quyền xem.'}
          </p>
        </div>
      )}

      {!isLoading && order && !isError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ fontSize: '1.05rem' }}>{order.orderCode}</strong>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {order.status === 'PENDING' && can('orders', 'approve') && (
                <>
                  <button className="btn-primary" onClick={() => setApproveOpen(true)}>
                    ✓ Duyệt đơn
                  </button>
                  <button className="btn-ghost" onClick={() => setRejectOpen(true)}>
                    Từ chối
                  </button>
                </>
              )}
              {order.status === 'APPROVED' && can('orders', 'approve') && (
                <button className="btn-primary" onClick={() => setReceiveOpen(true)}>
                  📦 Nhận hàng
                </button>
              )}
              {order.status === 'RECEIVED' && can('orders', 'approve') && (
                <button className="btn-primary" onClick={() => setPayOpen(true)}>
                  💵 Đã thanh toán
                </button>
              )}
              {((order.status === 'PENDING' && can('orders', 'edit')) ||
                ((order.status === 'APPROVED' || order.status === 'RECEIVED') && isAdmin)) && (
                <button
                  className="btn-ghost"
                  onClick={openEdit}
                  style={{ color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
                >
                  ✏️ Chỉnh sửa đơn {order.status !== 'PENDING' ? '(Admin)' : ''}
                </button>
              )}
              {((order.status === 'PENDING' && can('orders', 'edit')) ||
                (order.status === 'APPROVED' && isAdmin)) && (
                <button className="btn-ghost" onClick={onCancel} disabled={cancel.isPending}>
                  {order.status === 'APPROVED' ? 'Huỷ đơn (Quyền Admin)' : 'Huỷ đơn'}
                </button>
              )}
              {canPrint && (
                <button
                  className="btn-ghost"
                  onClick={() => window.open(`/orders/${order.id}/print`, '_blank')}
                  title="Mở bản in đơn hàng để gửi nhà cung cấp"
                >
                  🖨 In đơn gửi NCC
                </button>
              )}
              {isAdmin && (
                <button
                  className="btn-ghost"
                  onClick={openDelete}
                  disabled={remove.isPending}
                  style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}
                >
                  🗑 Xóa đơn (Admin)
                </button>
              )}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          {(order.status === 'RECEIVED' || order.status === 'PAID') &&
            (order.resultReceiptId || order.resultPayableId) && (
              <div className="approve-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  ✓ <strong>{order.status === 'PAID' ? 'Đơn hàng đã thanh toán!' : 'Đã nhận hàng — phát sinh công nợ!'}</strong>
                  {order.resultPayableCode && (
                    <span> — Công nợ: <strong>{order.resultPayableCode}</strong></span>
                  )}
                </div>
                {order.resultPayableId && can('payables', 'view') && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      onClose();
                      navigate(`/payables/${order.resultPayableId}`);
                    }}
                    style={{ fontSize: '0.82rem', padding: '0.25rem 0.65rem', background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 600 }}
                  >
                    Xem công nợ →
                  </button>
                )}
              </div>
            )}

          <div className="supplier-info">
            <span>NCC: <strong>{order.supplierName}</strong></span>
            <span>Cơ sở: {order.facilityName}</span>
            <span>Người tạo: {order.createdByName ?? order.createdBy}</span>
            <span>Ngày tạo: {formatDateTime(order.createdAt)}</span>
            {order.expectedDate && <span>Dự kiến nhận: {formatDateTime(order.expectedDate)}</span>}
            {order.reviewedAt && <span>Duyệt lúc: {formatDateTime(order.reviewedAt)}</span>}
            {order.receivedAt && <span>Nhận hàng lúc: {formatDateTime(order.receivedAt)}</span>}
            {order.paidAt && <span>Thanh toán lúc: {formatDateTime(order.paidAt)}</span>}
            {order.rejectReason && <span className="text-danger">Lý do từ chối: {order.rejectReason}</span>}
            {order.note && <span>Ghi chú: {order.note}</span>}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mặt hàng</th>
                  <th style={{ textAlign: 'center' }}>ĐVT</th>
                  <th style={{ textAlign: 'right' }}>Số lượng</th>
                  {canSeeMoney && <th style={{ textAlign: 'right' }}>Đơn giá</th>}
                  {canSeeMoney && <th style={{ textAlign: 'right' }}>Thành tiền</th>}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Mặt hàng">{item.name}</td>
                    <td data-label="ĐVT" style={{ textAlign: 'center' }}>{item.unit}</td>
                    <td data-label="Số lượng" style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                    {canSeeMoney && (
                      <td data-label="Đơn giá" style={{ textAlign: 'right' }}>{formatMoney(item.unitPrice)}</td>
                    )}
                    {canSeeMoney && (
                      <td data-label="Thành tiền" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatMoney(item.unitPrice * item.quantity)}
                      </td>
                    )}
                  </tr>
                ))}
                {canSeeMoney && (
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
        </div>
      )}

      {/* ---- Modal con ---- */}
      <ApproveOrderModal order={order ?? null} open={approveOpen} onClose={() => setApproveOpen(false)} />
      <ReceiveOrderModal order={order ?? null} open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      <PayOrderModal order={order ?? null} open={payOpen} onClose={() => setPayOpen(false)} />

      {order && (
        <>
          <Modal title={`Xóa đơn hàng ${order.orderCode}`} open={deleteOpen} onClose={() => setDeleteOpen(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.9rem', lineHeight: 1.55 }}>
                <strong style={{ display: 'block', marginBottom: '0.4rem' }}>⚠️ Bạn sắp xóa đơn hàng này!</strong>
                Mã đơn <strong>{order.orderCode}</strong> — trạng thái <strong>{order.status}</strong>
                {canSeeMoney && <> — tổng tiền <strong>{formatMoney(order.total)}</strong></>}.
                {order.resultPayableId && (
                  <div style={{ marginTop: '0.5rem' }}>
                    Đơn này đã phát sinh <strong>công nợ {order.resultPayableCode ?? ''}</strong>. Xóa đơn sẽ
                    đồng thời loại bỏ <strong>công nợ, phiếu nhập và các khoản thanh toán liên quan</strong> khỏi
                    báo cáo, thống kê và sổ kho.
                  </div>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  Đơn sau khi xóa <strong>sẽ không hiển thị lại</strong> trong hệ thống.
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteAck}
                  onChange={(e) => setDeleteAck(e.target.checked)}
                  style={{ marginTop: '0.15rem' }}
                />
                <span>Tôi hiểu và xác nhận xóa đơn hàng này.</span>
              </label>

              <div className="form-actions">
                <button className="btn-ghost" onClick={() => setDeleteOpen(false)}>
                  Đóng
                </button>
                <button
                  className="btn-primary"
                  onClick={onDelete}
                  disabled={!deleteAck || remove.isPending}
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                >
                  {remove.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          </Modal>

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
            {isAdmin && (
              <div style={{ padding: '0.75rem 1rem', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', color: '#854d0e', fontSize: '0.88rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>ℹ️</span>
                <span>
                  <strong>Lưu ý:</strong> Sửa <strong>đơn giá</strong> sẽ áp cho đơn này và{' '}
                  <strong>cập nhật giá trong danh mục NCC</strong> (đơn mới sau này lấy giá mới).
                  {order.status === 'RECEIVED' && ' Đơn đã nhận hàng: công nợ sẽ tự cập nhật theo giá/số lượng mới.'}
                </span>
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

            <div className={`order-edit${isAdmin ? '' : ' order-edit--np'}`} style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Danh sách mặt hàng ({editLines.length})
                </h4>
              </div>

              <div className="order-edit-header">
                <div>MẶT HÀNG</div>
                <div style={{ textAlign: 'right' }}>SỐ LƯỢNG</div>
                {isAdmin && <div style={{ textAlign: 'right' }}>ĐƠN GIÁ</div>}
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
                        onChange={(e) => {
                          const newId = e.target.value;
                          const p = activeProducts.find((x) => x.id === newId);
                          setEditLines(
                            editLines.map((l, i) =>
                              i === idx ? { ...l, productId: newId, unitPrice: p ? String(p.price) : '' } : l,
                            ),
                          );
                        }}
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

                      {isAdmin && (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Đơn giá"
                          value={line.unitPrice}
                          onChange={(e) =>
                            setEditLines(editLines.map((l, i) => (i === idx ? { ...l, unitPrice: e.target.value } : l)))
                          }
                          title="Sửa đơn giá (áp cho đơn này + cập nhật danh mục NCC)"
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #fbbf24', fontSize: '0.9rem', textAlign: 'right', fontWeight: 600, background: '#fffbeb' }}
                        />
                      )}

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
                  onClick={() => setEditLines([...editLines, { productId: '', quantity: '', unitPrice: '' }])}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--df-primary)', fontWeight: 600 }}
                >
                  <Plus size={16} /> Thêm dòng sản phẩm
                </button>

                {isAdmin && (
                  <div style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                    Tổng tiền ước tính:{' '}
                    <strong style={{ fontSize: '1.1rem', color: '#16a34a' }}>
                      {formatMoney(
                        editLines.reduce((sum, l) => {
                          const p = activeProducts.find((item) => item.id === l.productId);
                          const price = l.unitPrice !== '' ? Number(l.unitPrice) : p ? Number(p.price) : 0;
                          return sum + price * (Number(l.quantity) || 0);
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
        </>
      )}
    </Modal>
  );
}
