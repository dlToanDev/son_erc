import type { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PurchaseOrderData, SupplierProduct } from '@debtflow/shared';
import type { UpdateOrderInput } from '../api/orders';
import { formatMoney } from '../utils/format';

/** Dòng mặt hàng đang soạn (giá trị input dạng chuỗi). */
export interface EditLine {
  key: string;
  productId: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

let _seq = 0;
const nextKey = () => `new-${++_seq}`;

/** Dựng danh sách dòng từ đơn hàng (giữ snapshot tên/ĐVT). */
export function orderToLines(order: PurchaseOrderData): EditLine[] {
  return order.items.map((it) => ({
    key: it.id || nextKey(),
    productId: it.productId || '',
    name: it.name,
    unit: it.unit,
    quantity: String(it.quantity),
    unitPrice: String(it.unitPrice),
  }));
}

/** Dòng thêm mới rỗng. */
export function emptyLine(): EditLine {
  return { key: nextKey(), productId: '', name: '', unit: '', quantity: '', unitPrice: '' };
}

/** Còn ít nhất 1 dòng hợp lệ (có mặt hàng + số lượng > 0). */
export function hasValidLine(lines: EditLine[]): boolean {
  return lines.some((l) => l.productId && Number(l.quantity) > 0);
}

/** Tổng tiền theo các dòng đang nhập. */
export function linesTotal(lines: EditLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
}

/** So với đơn gốc: có thêm/bớt dòng, đổi số lượng hoặc đơn giá không. */
export function linesChanged(order: PurchaseOrderData, lines: EditLine[]): boolean {
  const norm = (arr: { productId: string; quantity: number; unitPrice: number }[]) =>
    JSON.stringify(
      arr
        .map((x) => `${x.productId}|${x.quantity}|${x.unitPrice}`)
        .sort(),
    );
  const now = norm(
    lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
  );
  const orig = norm(
    order.items.map((it) => ({ productId: it.productId || '', quantity: it.quantity, unitPrice: it.unitPrice })),
  );
  return now !== orig;
}

/** Body gửi updateOrder: lọc dòng hợp lệ, kèm đơn giá khi Admin. */
export function linesUpdateBody(lines: EditLine[], isAdmin: boolean): UpdateOrderInput {
  return {
    items: lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        ...(isAdmin && l.unitPrice !== '' && Number(l.unitPrice) >= 0
          ? { unitPrice: Number(l.unitPrice) }
          : {}),
      })),
  };
}

interface Props {
  lines: EditLine[];
  setLines: Dispatch<SetStateAction<EditLine[]>>;
  /** Danh mục mặt hàng ACTIVE của NCC đơn (để chọn khi thêm dòng). */
  products: SupplierProduct[];
  /** Admin: được thêm/bớt dòng + sửa số lượng + sửa đơn giá. */
  editable: boolean;
  /** Hiển thị cột đơn giá + thành tiền. */
  showPrice: boolean;
}

/** Bảng mặt hàng — Admin thêm/bớt/sửa số lượng & đơn giá; non-admin xem read-only. */
export default function OrderItemsEditor({ lines, setLines, products, editable, showPrice }: Props) {
  const patch = (key: string, p: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const selectProduct = (key: string, productId: string) => {
    const prod = products.find((x) => x.id === productId);
    patch(key, {
      productId,
      name: prod?.name ?? '',
      unit: prod?.unit ?? '',
      unitPrice: prod ? String(prod.price) : '',
    });
  };

  // ---- Read-only (non-admin) ----
  if (!editable) {
    return (
      <div className="table-wrap">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Tên mặt hàng</th>
              <th style={{ textAlign: 'center' }}>ĐVT</th>
              <th style={{ textAlign: 'center' }}>Số lượng</th>
              {showPrice && <th style={{ textAlign: 'right' }}>Đơn giá</th>}
              {showPrice && <th style={{ textAlign: 'right' }}>Thành tiền</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const price = Number(l.unitPrice) || 0;
              const qty = Number(l.quantity) || 0;
              return (
                <tr key={l.key}>
                  <td data-label="Tên mặt hàng">{l.name}</td>
                  <td data-label="ĐVT" style={{ textAlign: 'center' }}>{l.unit}</td>
                  <td data-label="Số lượng" style={{ textAlign: 'center', fontWeight: 600 }}>{l.quantity}</td>
                  {showPrice && (
                    <td data-label="Đơn giá" style={{ textAlign: 'right' }}>{formatMoney(price)}</td>
                  )}
                  {showPrice && (
                    <td data-label="Thành tiền" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatMoney(price * qty)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ---- Editable (Admin) ----
  return (
    <div
      className={`order-edit${showPrice ? '' : ' order-edit--np'}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
    >
      <div className="order-edit-header">
        <div>MẶT HÀNG</div>
        <div style={{ textAlign: 'right' }}>SỐ LƯỢNG</div>
        {showPrice && <div style={{ textAlign: 'right' }}>ĐƠN GIÁ</div>}
        <div style={{ textAlign: 'center' }}>ĐVT</div>
        <div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '0.2rem' }}>
        {lines.map((line) => (
          <div key={line.key} className="order-edit-row">
            <select
              value={line.productId}
              onChange={(e) => selectProduct(line.key, e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#fff' }}
            >
              <option value="">-- Chọn mặt hàng --</option>
              {/* Giữ mặt hàng cũ dù đã ẩn khỏi danh mục */}
              {line.productId && !products.some((p) => p.id === line.productId) && (
                <option value={line.productId}>{line.name} (đã ẩn)</option>
              )}
              {products.map((p) => (
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
              onChange={(e) => patch(line.key, { quantity: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'right', fontWeight: 600, background: '#fff' }}
            />

            {showPrice && (
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Đơn giá"
                value={line.unitPrice}
                onChange={(e) => patch(line.key, { unitPrice: e.target.value })}
                title="Sửa đơn giá (áp cho đơn này + cập nhật danh mục NCC)"
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #fbbf24', fontSize: '0.9rem', textAlign: 'right', fontWeight: 600, background: '#fffbeb' }}
              />
            )}

            <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#475569', background: '#e2e8f0', padding: '0.35rem 0.5rem', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {line.unit || '—'}
            </div>

            <button
              type="button"
              onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', color: '#ef4444', background: '#fee2e2', borderRadius: 6, border: 'none', cursor: 'pointer' }}
              title="Xóa dòng này"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-ghost"
        onClick={() => setLines((prev) => [...prev, emptyLine()])}
        style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--df-primary)', fontWeight: 600 }}
      >
        <Plus size={16} /> Thêm dòng sản phẩm
      </button>
    </div>
  );
}
