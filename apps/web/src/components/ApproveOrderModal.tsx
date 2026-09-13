import { useEffect, useState } from 'react';
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
import { formatMoney } from '../utils/format';

interface Props {
  order: PurchaseOrderData | null;
  open: boolean;
  onClose: () => void;
}

/** Cửa sổ Duyệt đơn — Admin có thể thêm/bớt mặt hàng & sửa đơn giá trước khi duyệt. */
export default function ApproveOrderModal({ order, open, onClose }: Props) {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const can = useAuthStore((s) => s.can);
  const canSeeMoney = isAdmin || can('orders', 'viewPrice');
  const { approve, update } = useOrderMutations();
  const { data: products = [] } = useProducts(order?.supplierId ?? '');
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');

  const [lines, setLines] = useState<EditLine[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && order) {
      setLines(orderToLines(order));
      setError('');
    }
  }, [open, order?.id]);

  const doApprove = async () => {
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
      await approve.mutateAsync(order.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt đơn hàng thất bại');
    }
  };

  return (
    <Modal
      title={order ? `Duyệt đơn — #${order.orderCode}` : 'Duyệt đơn'}
      open={open}
      onClose={onClose}
      size="lg"
    >
      {order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ fontSize: '0.88rem', color: '#475569' }}>
            🏭 NCC: <strong>{order.supplierName}</strong> · 🏢 {order.facilityName} · 👤{' '}
            {order.createdByName || '—'}
          </div>
          <div>
            <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: '#334155' }}>
              DANH SÁCH MẶT HÀNG ({lines.length})
              {isAdmin && (
                <span style={{ fontWeight: 400, color: '#b45309' }}> — có thể thêm/bớt & sửa đơn giá</span>
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
                TỔNG GIÁ TRỊ ĐƠN HÀNG:
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
              disabled={approve.isPending || update.isPending}
              onClick={doApprove}
            >
              {approve.isPending || update.isPending ? 'Đang xử lý…' : '✓ Xác nhận duyệt đơn'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
