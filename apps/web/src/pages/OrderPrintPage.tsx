import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useOrderPrint } from '../hooks/queries';
import { formatMoney } from '../utils/format';

/** Ngày theo vi-VN, không kèm giờ — bản in gửi NCC chỉ cần ngày. */
const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString('vi-VN') : '—';

/** Số lượng: bỏ số 0 thừa (12.500 → 12,5). */
const formatQty = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);

/**
 * Trang in đơn đặt hàng gửi NCC — route /orders/:id/print, mở ở tab riêng.
 * Nằm NGOÀI Layout (không sidebar/header) để bản in sạch; tự bật hộp thoại in
 * khi dữ liệu về, người dùng chọn "Lưu thành PDF" hoặc in ra giấy.
 */
export default function OrderPrintPage() {
  const { id = '' } = useParams();
  const { data: order, isLoading, isError, error } = useOrderPrint(id);
  const printed = useRef(false);

  useEffect(() => {
    // Chỉ bật hộp thoại in MỘT lần, sau khi nội dung đã render xong.
    if (!order || printed.current) return;
    printed.current = true;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [order]);

  if (isLoading) {
    return <main className="print-page">Đang tải dữ liệu đơn hàng…</main>;
  }
  if (isError || !order) {
    const message = error instanceof Error ? error.message : 'Không tải được đơn hàng';
    return (
      <main className="print-page">
        <p className="print-error">{message}</p>
        <p className="print-hint">
          Bạn cần quyền “In đơn gửi NCC” và đơn phải ở trạng thái đã duyệt trở đi.
        </p>
      </main>
    );
  }

  return (
    <main className="print-page">
      {/* Thanh công cụ — ẩn khi in */}
      <div className="print-toolbar no-print">
        <button type="button" className="btn primary" onClick={() => window.print()}>
          In / Lưu PDF
        </button>
        <button type="button" className="btn" onClick={() => window.close()}>
          Đóng
        </button>
      </div>

      <article className="print-sheet">
        <header className="print-head">
          <h1>ĐƠN ĐẶT HÀNG</h1>
          <p className="print-code">Số: {order.orderCode}</p>
          <p className="print-date">Ngày: {formatDate(order.reviewedAt ?? order.createdAt)}</p>
        </header>

        <section className="print-parties">
          <div>
            <h2>Kính gửi</h2>
            <p className="print-strong">{order.supplier.name}</p>
            {order.supplier.address && <p>{order.supplier.address}</p>}
            {order.supplier.taxCode && <p>MST: {order.supplier.taxCode}</p>}
            {order.supplier.phone && <p>Điện thoại: {order.supplier.phone}</p>}
            {order.supplier.contactPerson && <p>Người liên hệ: {order.supplier.contactPerson}</p>}
          </div>
          <div>
            <h2>Giao đến</h2>
            <p className="print-strong">{order.facility.name}</p>
            {order.facility.address && <p>{order.facility.address}</p>}
            <p>Ngày giao dự kiến: {formatDate(order.expectedDate)}</p>
          </div>
        </section>

        <table className="print-table">
          <thead>
            <tr>
              <th className="col-no">TT</th>
              <th>Mặt hàng</th>
              <th className="col-unit">ĐVT</th>
              <th className="col-num">Số lượng</th>
              <th className="col-num">Đơn giá</th>
              <th className="col-num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id}>
                <td className="col-no">{index + 1}</td>
                <td>{item.name}</td>
                <td className="col-unit">{item.unit}</td>
                <td className="col-num">{formatQty(item.quantity)}</td>
                <td className="col-num">{formatMoney(item.unitPrice)}</td>
                <td className="col-num">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="print-total-label">
                TỔNG CỘNG
              </td>
              <td className="col-num print-total">{formatMoney(order.total)}</td>
            </tr>
          </tfoot>
        </table>

        {order.note && (
          <p className="print-note">
            <strong>Ghi chú:</strong> {order.note}
          </p>
        )}

        <section className="print-signatures">
          <div>
            <p className="print-strong">NGƯỜI ĐẶT HÀNG</p>
            <p className="print-sign-hint">(ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p className="print-strong">XÁC NHẬN NHÀ CUNG CẤP</p>
            <p className="print-sign-hint">(ký, ghi rõ họ tên)</p>
          </div>
        </section>
      </article>
    </main>
  );
}
