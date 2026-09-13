import { FormEvent, useEffect, useState } from 'react';
import type { PurchaseOrderData } from '@debtflow/shared';
import { QrCode } from 'lucide-react';
import Modal from './Modal';
import { useOrderMutations, useSupplier } from '../hooks/queries';
import { formatMoney } from '../utils/format';

interface Props {
  order: PurchaseOrderData | null;
  open: boolean;
  onClose: () => void;
  onPaid?: () => void;
}

/**
 * Form thanh toán TRỌN cả đơn (RECEIVED → PAID) — kèm phương thức, mã GD,
 * ảnh minh chứng (bill/ủy nhiệm chi) và thông tin chuyển khoản NCC.
 */
export default function PayOrderModal({ order, open, onClose, onPaid }: Props) {
  const { pay } = useOrderMutations();
  const { data: supplier } = useSupplier(order?.supplierId ?? '');

  const [showQr, setShowQr] = useState(true);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'BANK_TRANSFER',
    transactionCode: '',
    proofUrl: '',
    note: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'BANK_TRANSFER',
        transactionCode: '',
        proofUrl: '',
        note: '',
      });
      setShowQr(true);
      setError('');
    }
  }, [open]);

  if (!order) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await pay.mutateAsync({
        id: order.id,
        paymentDate: form.paymentDate,
        ...(form.paymentMethod ? { paymentMethod: form.paymentMethod } : {}),
        ...(form.transactionCode ? { transactionCode: form.transactionCode } : {}),
        ...(form.proofUrl ? { proofUrl: form.proofUrl } : {}),
        ...(form.note ? { note: form.note } : {}),
      });
      onClose();
      onPaid?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thanh toán thất bại');
    }
  };

  return (
    <>
      <Modal title={`Thanh toán đơn #${order.orderCode}`} open={open} onClose={onClose} size="lg">
        <form className="form-grid" onSubmit={onSubmit}>
          {/* Banner thông tin đơn */}
          <div
            className="span-2"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '0.85rem 1.1rem',
              borderRadius: '10px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.6rem 1.2rem',
              fontSize: '0.88rem',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>🏢 Nhà cung cấp:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{order.supplierName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>📄 Mã đơn:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{order.orderCode}</strong>
            </div>
            {order.resultPayableCode && (
              <div>
                <span style={{ color: '#64748b' }}>🧾 Công nợ:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{order.resultPayableCode}</strong>
              </div>
            )}
            <div>
              <span style={{ color: '#64748b' }}>💰 Số tiền phải trả:</span>{' '}
              <strong style={{ color: '#2563eb', fontSize: '1rem' }}>{formatMoney(order.total)}</strong>
            </div>
          </div>

          {/* Thông tin chuyển khoản NCC & VietQR */}
          {(supplier?.bankAccountNo || supplier?.qrCodeUrl) && (
            <div
              className="span-2"
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                padding: '1.1rem 1.25rem',
                borderRadius: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <QrCode size={20} color="#16a34a" />
                  <span>THÔNG TIN CHUYỂN KHOẢN & VIETQR</span>
                </span>
                {supplier.qrCodeUrl && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowQr(!showQr)}
                    style={{ fontSize: '0.8rem', color: '#166534', padding: '0.2rem 0.55rem' }}
                  >
                    {showQr ? 'Ẩn mã QR' : 'Hiện mã QR'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {supplier.qrCodeUrl && showQr && (
                  <div
                    onClick={() => setPreviewProofUrl(supplier.qrCodeUrl!)}
                    style={{ cursor: 'pointer', background: '#fff', padding: '6px', borderRadius: '10px', border: '2px solid #4ade80' }}
                    title="Bấm để xem phóng to mã VietQR"
                  >
                    <img src={supplier.qrCodeUrl} alt="VietQR NCC" style={{ width: '180px', height: '180px', objectFit: 'contain', display: 'block' }} />
                  </div>
                )}
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', color: '#14532d', flex: 1 }}>
                  {supplier.bankName && (
                    <div>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Ngân hàng:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{supplier.bankName}</strong>
                    </div>
                  )}
                  {supplier.bankAccountNo && (
                    <div style={{ background: '#fff', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ color: '#15803d', fontSize: '0.82rem', display: 'block' }}>Số tài khoản:</span>
                      <strong style={{ fontSize: '1.15rem', color: '#1e40af', letterSpacing: '0.04em' }}>{supplier.bankAccountNo}</strong>
                    </div>
                  )}
                  {supplier.bankAccountName && (
                    <div>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Chủ tài khoản:</span>{' '}
                      <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>{supplier.bankAccountName}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Số tiền (trọn đơn, chỉ hiển thị) + ngày */}
          <label>
            Số tiền thanh toán (trọn đơn)
            <input
              type="text"
              value={formatMoney(order.total)}
              readOnly
              style={{ fontSize: '1.05rem', fontWeight: 700, color: '#15803d', background: '#f0fdf4' }}
            />
          </label>
          <label>
            Ngày thanh toán *
            <input
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              required
            />
          </label>

          <label>
            Phương thức thanh toán
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
              <option value="CASH">Tiền mặt</option>
              <option value="CARD">Thẻ / Ví điện tử</option>
            </select>
          </label>
          <label>
            Mã giao dịch ngân hàng
            <input
              placeholder="Nhập mã GD chuyển khoản..."
              value={form.transactionCode}
              onChange={(e) => setForm({ ...form, transactionCode: e.target.value })}
            />
          </label>

          {/* Ảnh minh chứng */}
          <label className="span-2">
            Tải ảnh minh chứng đã thanh toán (Bill / Ủy nhiệm chi)
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.3rem' }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setForm((prev) => ({ ...prev, proofUrl: reader.result as string }));
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ fontSize: '0.85rem' }}
              />
              {form.proofUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img
                    src={form.proofUrl}
                    alt="Proof Preview"
                    onClick={() => setPreviewProofUrl(form.proofUrl)}
                    style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setForm({ ...form, proofUrl: '' })}
                    style={{ fontSize: '0.75rem', color: '#dc2626', padding: '0.15rem 0.4rem' }}
                  >
                    Xoá ảnh
                  </button>
                </div>
              )}
            </div>
          </label>

          <label className="span-2">
            Ghi chú thanh toán
            <input
              placeholder="Ghi chú thêm nếu có..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>

          {error && <div className="form-error span-2">{error}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary" disabled={pay.isPending}>
              {pay.isPending ? 'Đang ghi nhận…' : '✓ Xác nhận thanh toán'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Ảnh minh chứng" open={!!previewProofUrl} onClose={() => setPreviewProofUrl(null)} size="md">
        {previewProofUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <img src={previewProofUrl} alt="Minh chứng" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <button type="button" className="btn-ghost" onClick={() => setPreviewProofUrl(null)}>
              Đóng
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
