import { useEffect, useMemo, useState } from 'react';
import type { PurchaseOrderData } from '@debtflow/shared';
import Modal from './Modal';
import OrderItemsEditor, {
  type EditLine,
  orderToLines,
  linesChanged,
  linesTotal,
  linesUpdateBody,
  hasValidLine,
} from './OrderItemsEditor';
import { useOrderMutations, useProducts } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

interface Props {
  order: PurchaseOrderData | null;
  open: boolean;
  onClose: () => void;
}

/** Cửa sổ Nhận hàng — sinh phiếu nhập + công nợ. Admin có thể thêm/bớt mặt hàng & sửa đơn giá. */
export default function ReceiveOrderModal({ order, open, onClose }: Props) {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const can = useAuthStore((s) => s.can);
  const canSeeMoney = isAdmin || can('orders', 'viewPrice');
  const { receive, update } = useOrderMutations();
  const { data: products = [] } = useProducts(order?.supplierId ?? '');
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');

  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [lines, setLines] = useState<EditLine[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && order) {
      setLines(orderToLines(order));
      setDueDate(defaultDueDate);
      setError('');
    }
  }, [open, order?.id]);

  const doReceive = async () => {
    if (!order) return;
    setError('');
    if (!hasValidLine(lines)) {
      setError('Đơn phải có ít nhất 1 mặt hàng hợp lệ (số lượng > 0)');
      return;
    }
    try {
      if (isAdmin && linesChanged(order, lines)) {
        await update.mutateAsync({ id: order.id, body: linesUpdateBody(lines, true) });
      }
      await receive.mutateAsync({ id: order.id, dueDate });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nhận hàng thất bại');
    }
  };

  return (
    <Modal
      title={order ? `Nhận hàng — đơn #${order.orderCode}` : 'Nhận hàng'}
      open={open}
      onClose={onClose}
      size="lg"
    >
      {order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
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
              <strong style={{ color: '#0f172a' }}>{order.createdByName || '—'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>⏰ Ngày giờ tạo đơn:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{formatDateTime(order.createdAt)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>🏭 Nhà cung cấp:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{order.supplierName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>🏢 Cơ sở nhận hàng:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{order.facilityName}</strong>
            </div>
            {order.expectedDate && (
              <div>
                <span style={{ color: '#64748b' }}>📅 Dự kiến nhận hàng:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{order.expectedDate.slice(0, 10)}</strong>
              </div>
            )}
            {order.note && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b' }}>📝 Ghi chú:</span> <span>{order.note}</span>
              </div>
            )}
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: '#334155' }}>
              DANH SÁCH MẶT HÀNG ({lines.length})
              {isAdmin && (
                <span style={{ fontWeight: 400, color: '#b45309' }}>
                  {' '}
                  — có thể thêm/bớt (NCC giao thiếu/thừa) & sửa đơn giá
                </span>
              )}
            </h4>
            <OrderItemsEditor
              lines={lines}
              setLines={setLines}
              products={activeProducts}
              editable={isAdmin}
              showPrice={canSeeMoney}
            />
          </div>

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
                📅 HẠN THANH TOÁN CÔNG NỢ:
              </span>
              <span style={{ fontSize: '0.78rem', color: '#b45309' }}>
                Hạn chót thanh toán công nợ sẽ được tính từ ngày này
              </span>
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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

          {canSeeMoney && (
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
                TỔNG GIÁ TRỊ CÔNG NỢ PHÁT SINH:
              </span>
              <strong style={{ fontSize: '1.25rem', color: '#1e3a8a' }}>{formatMoney(linesTotal(lines))}</strong>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Hủy bỏ
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={receive.isPending || update.isPending}
              onClick={doReceive}
            >
              {receive.isPending || update.isPending ? 'Đang xử lý…' : '✓ Xác nhận nhận hàng'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
