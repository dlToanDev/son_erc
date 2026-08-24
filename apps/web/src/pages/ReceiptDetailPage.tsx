import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useReceipt, useReceiptMutations } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

export default function ReceiptDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const { data: receipt, isLoading } = useReceipt(id);
  const { confirm } = useReceiptMutations();
  const [error, setError] = useState('');
  const [confirmedInfo, setConfirmedInfo] = useState<{ invoiceCode: string; total: number } | null>(
    null,
  );

  if (isLoading) return <section className="page"><p className="placeholder">Đang tải phiếu nhập…</p></section>;
  if (!receipt) return <section className="page"><p className="placeholder">Không tìm thấy phiếu nhập.</p></section>;

  const onConfirm = async () => {
    setError('');
    try {
      const result = await confirm.mutateAsync(receipt.id);
      setConfirmedInfo({
        invoiceCode: result.payable.invoiceCode,
        total: result.payable.totalAmount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận thất bại');
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Mã phiếu: {receipt.receiptCode}</h2>
            {receipt.status === 'CONFIRMED' ? (
              <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>✓ Đã xác nhận</span>
            ) : (
              <span className="badge badge-warning" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>⚡ Nháp</span>
            )}
          </div>
        </div>

        {receipt.status === 'DRAFT' && can('receipts', 'edit') && (
          <button className="btn-primary" onClick={onConfirm} disabled={confirm.isPending}>
            {confirm.isPending ? 'Đang xác nhận…' : '✓ Xác nhận → Sinh công nợ'}
          </button>
        )}
      </header>

      {error && <div className="form-error">{error}</div>}
      {confirmedInfo && (
        <div className="approve-banner">
          🎉 Đã xác nhận phiếu thành công — Công nợ đã được khởi tạo với mã <strong>{confirmedInfo.invoiceCode}</strong> số tiền{' '}
          <strong>{formatMoney(confirmedInfo.total)}</strong>.
        </div>
      )}

      {/* Khối thông tin chung dạng Grid 3 cột chuẩn hóa đơn */}
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
            Nhà cung cấp
          </span>
          <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{receipt.supplierName}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
            Cơ sở tiếp nhận
          </span>
          <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{receipt.facilityName}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
            Ngày nhập hàng
          </span>
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{formatDateTime(receipt.receiptDate)}</span>
        </div>
        {receipt.dueDate && (
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
              Hạn thanh toán
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#dc2626' }}>{formatDateTime(receipt.dueDate)}</span>
          </div>
        )}
        {receipt.supplierInvoiceCode && (
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
              Số hóa đơn NCC
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{receipt.supplierInvoiceCode}</span>
          </div>
        )}
        {receipt.note && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
              Ghi chú phiếu nhập
            </span>
            <span style={{ fontSize: '0.92rem', color: '#334155' }}>{receipt.note}</span>
          </div>
        )}
      </div>

      {/* Bảng danh sách hàng hóa định dạng Excel */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>STT</th>
              <th style={{ textAlign: 'left' }}>Tên mặt hàng / Sản phẩm</th>
              <th style={{ textAlign: 'center' }}>ĐVT</th>
              <th style={{ textAlign: 'right' }}>Số lượng</th>
              <th style={{ textAlign: 'right' }}>Đơn giá</th>
              <th style={{ textAlign: 'right' }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ textAlign: 'left', color: '#64748b', width: '50px' }}>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{item.itemName}</td>
                <td style={{ textAlign: 'center' }}>{item.unit}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(item.unitPrice)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                  {formatMoney(item.quantity * item.unitPrice)}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                Tạm tính tiền hàng:
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(receipt.subtotal)}</td>
            </tr>
            {receipt.discountAmount > 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                  Chiết khấu / Giảm giá:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                  −{formatMoney(receipt.discountAmount)}
                </td>
              </tr>
            )}
            {receipt.taxAmount > 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                  Thuế VAT:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>+{formatMoney(receipt.taxAmount)}</td>
              </tr>
            )}
            <tr className="order-total-row">
              <td colSpan={5} style={{ textAlign: 'right', fontSize: '1rem', fontWeight: 800 }}>
                TỔNG CỘNG THANH TOÁN:
              </td>
              <td style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 800, color: 'var(--df-primary)' }}>
                {formatMoney(receipt.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {receipt.payableId && (
        <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
          <Link className="btn-link" to={`/payables/${receipt.payableId}`} style={{ fontSize: '0.95rem' }}>
            → Chuyển đến hồ sơ công nợ của phiếu này
          </Link>
        </div>
      )}
    </section>
  );
}
