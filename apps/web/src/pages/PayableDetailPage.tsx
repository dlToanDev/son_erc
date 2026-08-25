import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PaymentData } from '@debtflow/shared';
import { ArrowLeft, QrCode, Image as ImageIcon, Eye, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import PayableStatusBadge from '../components/PayableStatusBadge';
import { usePayable, usePaymentMutations, useSupplier } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

export default function PayableDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const { data: payable, isLoading } = usePayable(id);
  const { data: supplier } = useSupplier(payable?.supplierId ?? '');
  const { create, void: voidPayment } = usePaymentMutations();

  const [payOpen, setPayOpen] = useState(false);
  const [showQr, setShowQr] = useState(true);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentData | null>(null);
  const [paymentToVoid, setPaymentToVoid] = useState<PaymentData | null>(null);
  const [form, setForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'BANK_TRANSFER',
    transactionCode: '',
    proofUrl: '',
    note: '',
    nextDueDate: '',
  });
  const [payType, setPayType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [error, setError] = useState('');

  if (isLoading) return <section className="page">Đang tải…</section>;
  if (!payable) return <section className="page">Không tìm thấy công nợ.</section>;

  const openPay = () => {
    setPayType('FULL');
    setForm({
      amount: String(payable.balance),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'BANK_TRANSFER',
      transactionCode: '',
      proofUrl: '',
      note: '',
      nextDueDate: '',
    });
    setShowQr(true);
    setError('');
    setPayOpen(true);
  };

  const onPay = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = Number(form.amount);
    const isPartial = payType === 'PARTIAL' || amt < payable.balance;

    if (isPartial && !form.nextDueDate) {
      setError('Vui lòng chọn Ngày hẹn thanh toán đợt tiếp theo khi trả một phần!');
      return;
    }

    try {
      await create.mutateAsync({
        payableId: payable.id,
        amount: amt,
        paymentDate: form.paymentDate,
        ...(form.paymentMethod ? { paymentMethod: form.paymentMethod } : {}),
        ...(form.transactionCode ? { transactionCode: form.transactionCode } : {}),
        ...(form.proofUrl ? { proofUrl: form.proofUrl } : {}),
        ...(form.note ? { note: form.note } : {}),
        ...(isPartial && form.nextDueDate ? { nextDueDate: form.nextDueDate } : {}),
      });
      setPayOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thanh toán thất bại');
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
            {payable.invoiceCode} <PayableStatusBadge status={payable.status} />
          </h2>
        </div>
        {payable.balance > 0 && can('payables', 'pay') && (
          <button className="btn-primary" onClick={openPay}>
            + Tạo thanh toán
          </button>
        )}
      </header>

      {error && <div className="form-error">{error}</div>}

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Tổng tiền</span>
          <span className="stat-value">{formatMoney(payable.totalAmount)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Đã trả</span>
          <span className="stat-value">{formatMoney(payable.paid)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Còn lại</span>
          <span className={`stat-value ${payable.balance > 0 ? 'text-danger' : ''}`}>
            {formatMoney(payable.balance)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Đến hạn</span>
          <span className="stat-value">{formatDateTime(payable.dueDate)}</span>
        </div>
      </div>

      <div className="supplier-info">
        <span>NCC: <strong>{payable.supplierName}</strong></span>
        <span>Ngày HĐ: {formatDateTime(payable.invoiceDate)}</span>
        {payable.receiptCode && <span>Phiếu nhập: {payable.receiptCode}</span>}
        {payable.description && <span>{payable.description}</span>}
      </div>

      <h3>Lịch sử thanh toán</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ngày thanh toán</th>
              <th style={{ textAlign: 'right' }}>Số tiền thanh toán</th>
              <th>Phương thức</th>
              <th>Mã GD</th>
              <th style={{ textAlign: 'center' }}>Minh chứng</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
              <th style={{ textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {payable.payments.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  Chưa có thanh toán
                </td>
              </tr>
            )}
            {payable.payments.map((pm) => (
              <tr key={pm.id} className="clickable" onClick={() => setSelectedPaymentDetail(pm as any)}>
                <td data-label="Ngày thanh toán">{formatDateTime(pm.paymentDate)}</td>
                <td data-label="Số tiền" style={{ textAlign: 'right', fontWeight: 700, color: pm.status === 'ACTIVE' ? '#16a34a' : '#94a3b8' }}>
                  {formatMoney(pm.amount)}
                </td>
                <td data-label="Phương thức">{pm.paymentMethod ?? '—'}</td>
                <td data-label="Mã GD">{pm.transactionCode ?? '—'}</td>
                <td data-label="Minh chứng" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  {pm.proofUrl ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setPreviewProofUrl(pm.proofUrl)}
                      style={{ fontSize: '0.78rem', padding: '0.15rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#2563eb' }}
                    >
                      <ImageIcon size={14} />
                      <span>Xem bill</span>
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td data-label="Trạng thái" style={{ textAlign: 'center' }}>
                  {pm.status === 'ACTIVE' ? (
                    <span className="badge badge-success">Hiệu lực</span>
                  ) : (
                    <span className="badge badge-muted">Đã huỷ</span>
                  )}
                </td>
                <td data-label="Thao tác" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <div className="btn-action-group">
                    <button
                      type="button"
                      className="btn-action-view"
                      onClick={() => setSelectedPaymentDetail(pm as any)}
                    >
                      <Eye size={13} />
                      <span>Chi tiết</span>
                    </button>
                    {pm.status === 'ACTIVE' && can('payables', 'pay') && (
                      <button
                        type="button"
                        className="btn-action-delete"
                        onClick={() => setPaymentToVoid(pm as any)}
                        disabled={voidPayment.isPending}
                      >
                        <Trash2 size={13} />
                        <span>Hủy</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={`Tạo thanh toán hoá đơn #${payable.invoiceCode}`} open={payOpen} onClose={() => setPayOpen(false)} size="lg">
        <form className="form-grid" onSubmit={onPay}>
          {/* Banner thông tin nhà cung cấp & Hạn thanh toán */}
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
              <strong style={{ color: '#0f172a' }}>{payable.supplierName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>📄 Số hoá đơn:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{payable.invoiceCode}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>⏰ Hạn thanh toán:</span>{' '}
              <strong style={{ color: '#dc2626' }}>{formatDateTime(payable.dueDate)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>💰 Nợ còn lại:</span>{' '}
              <strong style={{ color: '#2563eb', fontSize: '1rem' }}>{formatMoney(payable.balance)}</strong>
            </div>
          </div>

          {/* Thẻ Ngân Hàng & VietQR chuyển khoản (nếu có setup) */}
          {(supplier?.bankAccountNo || supplier?.qrCodeUrl) && (
            <div
              className="span-2"
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                padding: '1.1rem 1.25rem',
                borderRadius: '12px',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <QrCode size={20} color="#16a34a" />
                  <span>THÔNG TIN CHUYỂN KHOẢN NGÂN HÀNG & VIETQR</span>
                </span>
                {supplier.qrCodeUrl && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowQr(!showQr)}
                    style={{ fontSize: '0.8rem', color: '#166534', padding: '0.2rem 0.55rem' }}
                  >
                    {showQr ? 'Ẩn mã QR' : 'Hiện mã QR thanh toán'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {supplier.qrCodeUrl && showQr && (
                  <div
                    onClick={() => setPreviewProofUrl(supplier.qrCodeUrl!)}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      background: '#fff',
                      padding: '6px',
                      borderRadius: '10px',
                      border: '2px solid #4ade80',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)',
                    }}
                    title="Bấm để xem phóng to mã VietQR"
                  >
                    <img
                      src={supplier.qrCodeUrl}
                      alt="VietQR NCC"
                      style={{
                        width: '200px',
                        height: '200px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px' }}>
                      🔍 Phóng to
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', color: '#14532d', flex: 1 }}>
                  {supplier.bankName && (
                    <div>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Ngân hàng:</span>{' '}
                      <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{supplier.bankName}</strong>
                    </div>
                  )}
                  {supplier.bankAccountNo && (
                    <div style={{ background: '#fff', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ color: '#15803d', fontSize: '0.82rem', display: 'block' }}>Số tài khoản:</span>
                      <strong style={{ fontSize: '1.25rem', color: '#1e40af', letterSpacing: '0.04em' }}>
                        {supplier.bankAccountNo}
                      </strong>
                    </div>
                  )}
                  {supplier.bankAccountName && (
                    <div>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Chủ tài khoản:</span>{' '}
                      <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>{supplier.bankAccountName}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '0.2rem', fontWeight: 500 }}>
                    💡 Quét mã VietQR trên hoặc sao chép STK để thực hiện chuyển khoản
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chọn Hình thức Thanh toán (Toàn bộ / 1 Phần) */}
          <div
            className="span-2"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background: '#f8fafc',
              padding: '0.85rem 1.1rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
              💰 BẤM CHỌN HÌNH THỨC THANH TOÁN:
            </span>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.92rem', fontWeight: payType === 'FULL' ? 700 : 500, color: payType === 'FULL' ? '#15803d' : '#475569' }}>
                <input
                  type="radio"
                  name="payType"
                  value="FULL"
                  checked={payType === 'FULL'}
                  onChange={() => {
                    setPayType('FULL');
                    setForm((prev) => ({ ...prev, amount: String(payable.balance) }));
                  }}
                  style={{ accentColor: '#16a34a', width: '16px', height: '16px' }}
                />
                <span>Thanh toán TOÀN BỘ (<strong style={{ color: '#15803d' }}>{formatMoney(payable.balance)}</strong>)</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.92rem', fontWeight: payType === 'PARTIAL' ? 700 : 500, color: payType === 'PARTIAL' ? '#1d4ed8' : '#475569' }}>
                <input
                  type="radio"
                  name="payType"
                  value="PARTIAL"
                  checked={payType === 'PARTIAL'}
                  onChange={() => {
                    setPayType('PARTIAL');
                  }}
                  style={{ accentColor: '#2563eb', width: '16px', height: '16px' }}
                />
                <span>Thanh toán 1 PHẦN (Nhập số tiền khác)</span>
              </label>
            </div>
          </div>

          <label>
            Số tiền thanh toán (VND) *
            <input
              type="number"
              min="0.01"
              max={payable.balance}
              step="any"
              value={form.amount}
              onChange={(e) => {
                setPayType('PARTIAL');
                setForm({ ...form, amount: e.target.value });
              }}
              required
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: payType === 'FULL' ? '#15803d' : '#1d4ed8',
                background: payType === 'FULL' ? '#f0fdf4' : '#fff',
              }}
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

          {(payType === 'PARTIAL' || Number(form.amount) < payable.balance) && (
            <label className="span-2" style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', padding: '0.85rem 1rem', borderRadius: '10px' }}>
              <span style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.92rem', display: 'block' }}>
                📅 NGÀY HẸN THANH TOÁN ĐỢT TIẾP THEO (BẮT BUỘC KHI TRẢ 1 PHẦN) *
              </span>
              <input
                type="date"
                required
                value={form.nextDueDate}
                onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
                style={{ fontSize: '0.98rem', fontWeight: 700, color: '#1d4ed8', marginTop: '0.35rem', background: '#fff' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#2563eb', marginTop: '0.2rem', display: 'block', fontWeight: 600 }}>
                💡 Ngày hẹn này sẽ tự động cập nhật hạn công nợ mới để hệ thống theo dõi &amp; lọc chính xác.
              </span>
            </label>
          )}

          <label>
            Phương thức thanh toán
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
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

          {/* Tải ảnh minh chứng / Bill chuyển khoản */}
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
                    reader.onloadend = () => {
                      setForm((prev) => ({ ...prev, proofUrl: reader.result as string }));
                    };
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
                    style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
            <button type="button" className="btn-ghost" onClick={() => setPayOpen(false)}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Đang ghi nhận…' : 'Xác nhận thanh toán'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Preview Ảnh Minh Chứng */}
      <Modal
        title="Ảnh minh chứng thanh toán"
        open={!!previewProofUrl}
        onClose={() => setPreviewProofUrl(null)}
        size="md"
      >
        {previewProofUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <img
              src={previewProofUrl}
              alt="Ảnh minh chứng"
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
            <button type="button" className="btn-ghost" onClick={() => setPreviewProofUrl(null)}>
              Đóng
            </button>
          </div>
        )}
      </Modal>

      {/* Modal Xem Chi Tiết Giao Dịch Thanh Toán (Nâng cấp Đầy đủ & Sắc nét) */}
      <Modal
        title="Chi tiết giao dịch thanh toán"
        open={!!selectedPaymentDetail}
        onClose={() => setSelectedPaymentDetail(null)}
        size="lg"
      >
        {selectedPaymentDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. Banner Thống Kê Số Tiền & Trạng Thái */}
            <div
              style={{
                background: selectedPaymentDetail.status === 'ACTIVE' ? '#f0fdf4' : '#f8fafc',
                border: selectedPaymentDetail.status === 'ACTIVE' ? '2px solid #86efac' : '1px solid #cbd5e1',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>
                  SỐ TIỀN ĐÃ THANH TOÁN
                </span>
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: selectedPaymentDetail.status === 'ACTIVE' ? '#15803d' : '#64748b', marginTop: '2px' }}>
                  {formatMoney(selectedPaymentDetail.amount)}
                </div>
              </div>

              <div>
                {selectedPaymentDetail.status === 'ACTIVE' ? (
                  <span className="badge badge-success" style={{ fontSize: '0.88rem', padding: '0.4rem 0.85rem' }}>
                    ✓ Giao dịch Hiệu lực
                  </span>
                ) : (
                  <span className="badge badge-muted" style={{ fontSize: '0.88rem', padding: '0.4rem 0.85rem' }}>
                    ✕ Giao dịch Đã huỷ
                  </span>
                )}
              </div>
            </div>

            {/* 2. Grid Các Thông Tin Chi Tiết Giao Dịch */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem 1.5rem',
                fontSize: '0.9rem',
                background: '#fff',
                padding: '1.1rem 1.3rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📄 Mã hoá đơn thanh toán:</span>
                <strong style={{ color: 'var(--df-primary)', fontSize: '1.05rem' }}>{selectedPaymentDetail.invoiceCode || payable.invoiceCode}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>🏢 Nhà cung cấp đối tác:</span>
                <strong style={{ color: '#0f172a', fontSize: '1.05rem' }}>{selectedPaymentDetail.supplierName || payable.supplierName}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📅 Ngày giờ thực hiện thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{formatDateTime(selectedPaymentDetail.paymentDate)}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>💳 Phương thức thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                  {selectedPaymentDetail.paymentMethod === 'BANK_TRANSFER'
                    ? 'Chuyển khoản Ngân hàng (VietQR)'
                    : selectedPaymentDetail.paymentMethod === 'CASH'
                    ? 'Tiền mặt'
                    : selectedPaymentDetail.paymentMethod ?? 'Chuyển khoản'}
                </strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>🔖 Mã giao dịch Ngân hàng (Tx):</span>
                <code style={{ background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '6px', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                  {selectedPaymentDetail.transactionCode || '— (Không có mã GD)'}
                </code>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>👤 Người ghi nhận thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{selectedPaymentDetail.createdBy || 'Hệ thống Admin'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>⏰ Thời gian ghi nhận hệ thống:</span>
                <strong style={{ color: '#475569', fontSize: '0.88rem' }}>{formatDateTime(selectedPaymentDetail.createdAt)}</strong>
              </div>

              {selectedPaymentDetail.cancelledAt && (
                <div>
                  <span style={{ color: '#dc2626', display: 'block', fontSize: '0.82rem' }}>🚫 Thời gian hủy giao dịch:</span>
                  <strong style={{ color: '#dc2626', fontSize: '0.88rem' }}>
                    {formatDateTime(selectedPaymentDetail.cancelledAt)} {selectedPaymentDetail.cancelledBy ? `(bởi ${selectedPaymentDetail.cancelledBy})` : ''}
                  </strong>
                </div>
              )}

              <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📝 Ghi chú thanh toán:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedPaymentDetail.note || 'Không có ghi chú thêm.'}</span>
              </div>
            </div>

            {/* 3. Thẻ Preview Ảnh Minh Chứng Chuyển Khoản (Bill / Ủy nhiệm chi) */}
            {selectedPaymentDetail.proofUrl && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>ẢNH MINH CHỨNG CHUYỂN KHOẢN (BILL / ỦY NHIỆM CHI)</span>
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setPreviewProofUrl(selectedPaymentDetail.proofUrl)}
                    style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}
                  >
                    🔍 Xem phóng to
                  </button>
                </div>
                <div
                  onClick={() => setPreviewProofUrl(selectedPaymentDetail.proofUrl)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    background: '#fff',
                    padding: '8px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  }}
                >
                  <img
                    src={selectedPaymentDetail.proofUrl}
                    alt="Minh chứng"
                    style={{
                      maxHeight: '260px',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>
            )}

            {/* 4. Nút bấm thao tác */}
            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn-ghost" onClick={() => setSelectedPaymentDetail(null)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Xác Nhận Hủy Thanh Toán (Void Payment) */}
      <Modal
        title="⚠️ Xác nhận Hủy giao dịch thanh toán"
        open={!!paymentToVoid}
        onClose={() => setPaymentToVoid(null)}
        size="sm"
      >
        {paymentToVoid && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn <strong>hủy giao dịch thanh toán số tiền {formatMoney(paymentToVoid.amount)}</strong> cho hoá đơn <strong>{payable.invoiceCode}</strong>?
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', color: '#991b1b' }}>
              💡 Sau khi hủy, số tiền này sẽ được hoàn trả lại vào dư nợ của công nợ hoá đơn này.
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setPaymentToVoid(null)}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  try {
                    await voidPayment.mutateAsync(paymentToVoid.id);
                    setPaymentToVoid(null);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Hủy thất bại');
                  }
                }}
                disabled={voidPayment.isPending}
              >
                {voidPayment.isPending ? 'Đang hủy…' : 'Xác nhận Hủy giao dịch'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
