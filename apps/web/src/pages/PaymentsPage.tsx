import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PaymentData } from '@debtflow/shared';
import {
  CreditCard,
  Search,
  Filter,
  Building,
  Image as ImageIcon,
  Eye,
  Trash2,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import DataTable, { Column } from '../components/DataTable';
import UnifiedDateFilter from '../components/UnifiedDateFilter';
import Modal from '../components/Modal';
import { usePaymentMutations, usePayments, useSuppliers } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

type TimePreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';

function isDateInFilter(
  dateStr: string | null | undefined,
  preset: TimePreset,
  fromDate?: string,
  toDate?: string,
): boolean {
  if (!dateStr) return false;
  if (preset === 'ALL') return true;

  const d = new Date(dateStr);
  const now = new Date();

  if (preset === 'CUSTOM') {
    if (fromDate && d < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && d > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  }

  if (preset === 'TODAY') {
    return d.toDateString() === now.toDateString();
  }
  if (preset === 'WEEK') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }
  if (preset === 'MONTH') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (preset === 'QUARTER') {
    const curQuarter = Math.floor(now.getMonth() / 3);
    const itemQuarter = Math.floor(d.getMonth() / 3);
    return curQuarter === itemQuarter && d.getFullYear() === now.getFullYear();
  }
  if (preset === 'YEAR') {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

export default function PaymentsPage() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const { data: payments = [], isLoading, isError } = usePayments();
  const { data: suppliers = [] } = useSuppliers();
  const { void: voidPayment } = usePaymentMutations();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [timePreset, setTimePreset] = useState<TimePreset>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal States
  const [selectedPayment, setSelectedPayment] = useState<PaymentData | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [paymentToVoid, setPaymentToVoid] = useState<PaymentData | null>(null);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInvoice = p.invoiceCode?.toLowerCase().includes(q);
        const matchSupplier = p.supplierName?.toLowerCase().includes(q);
        const matchTxCode = p.transactionCode?.toLowerCase().includes(q);
        const matchNote = p.note?.toLowerCase().includes(q);
        const matchAmount = p.amount.toString().includes(q);
        if (!matchInvoice && !matchSupplier && !matchTxCode && !matchNote && !matchAmount) {
          return false;
        }
      }

      // 2. Supplier Filter
      if (supplierFilter && p.supplierName !== supplierFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter && p.status !== statusFilter) {
        return false;
      }

      // 4. Date Preset Filter
      return isDateInFilter(p.paymentDate, timePreset, fromDate, toDate);
    });
  }, [payments, searchQuery, supplierFilter, statusFilter, timePreset, fromDate, toDate]);

  // Total summary of filtered active payments
  const totalActiveAmount = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === 'ACTIVE')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  const handleVoidConfirm = async () => {
    if (!paymentToVoid) return;
    try {
      await voidPayment.mutateAsync(paymentToVoid.id);
      setPaymentToVoid(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hủy thanh toán thất bại');
    }
  };

  const columns: Column<PaymentData>[] = [
    { key: 'date', header: 'Ngày thanh toán', render: (p) => formatDateTime(p.paymentDate) },
    {
      key: 'invoice',
      header: 'Hoá đơn',
      render: (p) => <strong style={{ color: 'var(--df-primary)' }}>{p.invoiceCode}</strong>,
    },
    { key: 'supplier', header: 'Nhà cung cấp', render: (p) => <strong>{p.supplierName}</strong> },
    {
      key: 'amount',
      header: 'Số tiền thanh toán',
      align: 'right',
      render: (p) => (
        <strong style={{ color: p.status === 'ACTIVE' ? '#16a34a' : '#94a3b8', fontSize: '0.95rem' }}>
          {formatMoney(p.amount)}
        </strong>
      ),
    },
    { key: 'method', header: 'Phương thức', render: (p) => p.paymentMethod ?? '—' },
    { key: 'tx', header: 'Mã GD', render: (p) => p.transactionCode ?? '—' },
    {
      key: 'proof',
      header: 'Minh chứng',
      align: 'center',
      render: (p) =>
        p.proofUrl ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewProofUrl(p.proofUrl);
            }}
            style={{
              fontSize: '0.78rem',
              padding: '0.2rem 0.55rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              borderRadius: '6px',
            }}
          >
            <ImageIcon size={14} />
            <span>Xem bill</span>
          </button>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (p) =>
        p.status === 'ACTIVE' ? (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle size={12} />
            <span>Hiệu lực</span>
          </span>
        ) : (
          <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <XCircle size={12} />
            <span>Đã huỷ</span>
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (p) => (
        <div
          className="btn-action-group"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nút Xem chi tiết */}
          <button
            type="button"
            className="btn-action-view"
            onClick={() => setSelectedPayment(p)}
            title="Xem chi tiết giao dịch thanh toán"
          >
            <Eye size={13} />
            <span>Chi tiết</span>
          </button>

          {/* Nút Hủy thanh toán */}
          {p.status === 'ACTIVE' && can('payables', 'pay') && (
            <button
              type="button"
              className="btn-action-delete"
              onClick={() => setPaymentToVoid(p)}
              disabled={voidPayment.isPending}
              title="Hủy giao dịch thanh toán này"
            >
              <Trash2 size={13} />
              <span>Hủy</span>
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
          <CreditCard size={24} color="var(--df-primary)" />
          <h2>Lịch sử thanh toán</h2>
        </div>

        {/* Thống kê nhanh số tiền */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}>
          <span style={{ color: '#166534', fontWeight: 600 }}>Tổng tiền thanh toán (Hiệu lực): </span>
          <strong style={{ color: '#15803d', fontSize: '1.05rem' }}>{formatMoney(totalActiveAmount)}</strong>
        </div>
      </header>

      {/* Thanh Bộ Lọc Thông Minh */}
      <div
        className="filter-bar"
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '0.85rem 1.1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Ô Tìm kiếm */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
          <Search
            size={16}
            color="#94a3b8"
            style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo mã HĐ, NCC, mã GD, số tiền..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        {/* Lọc theo Nhà cung cấp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Building size={16} color="#64748b" />
          <select
            className="search-input"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            style={{ fontSize: '0.85rem', minWidth: '160px' }}
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Lọc theo Trạng thái */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={16} color="#64748b" />
          <select
            className="search-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hiệu lực</option>
            <option value="VOIDED">Đã huỷ</option>
          </select>
        </div>

        <UnifiedDateFilter
          from={fromDate}
          to={toDate}
          onChange={(f, t) => {
            setFromDate(f);
            setToDate(t);
            setTimePreset('CUSTOM');
          }}
        />
      </div>

      {/* Bảng Danh sách Thanh toán */}
      <DataTable
        columns={columns}
        rows={filteredPayments}
        rowKey={(p) => p.id}
        loading={isLoading}
        error={isError}
        onRowClick={(p) => setSelectedPayment(p)}
      />

      {/* Modal Xem Chi Tiết Giao Dịch Thanh Toán (Nâng cấp Đầy đủ & Sắc nét) */}
      <Modal
        title="Chi tiết giao dịch thanh toán"
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        size="lg"
      >
        {selectedPayment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. Banner Thống Kê Số Tiền & Trạng Thái */}
            <div
              style={{
                background: selectedPayment.status === 'ACTIVE' ? '#f0fdf4' : '#f8fafc',
                border: selectedPayment.status === 'ACTIVE' ? '2px solid #86efac' : '1px solid #cbd5e1',
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
                <div style={{ fontSize: '1.65rem', fontWeight: 800, color: selectedPayment.status === 'ACTIVE' ? '#15803d' : '#64748b', marginTop: '2px' }}>
                  {formatMoney(selectedPayment.amount)}
                </div>
              </div>

              <div>
                {selectedPayment.status === 'ACTIVE' ? (
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
                <strong style={{ color: 'var(--df-primary)', fontSize: '1.05rem' }}>{selectedPayment.invoiceCode}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>🏢 Nhà cung cấp đối tác:</span>
                <strong style={{ color: '#0f172a', fontSize: '1.05rem' }}>{selectedPayment.supplierName}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📅 Ngày giờ thực hiện thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{formatDateTime(selectedPayment.paymentDate)}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>💳 Phương thức thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                  {selectedPayment.paymentMethod === 'BANK_TRANSFER'
                    ? 'Chuyển khoản Ngân hàng (VietQR)'
                    : selectedPayment.paymentMethod === 'CASH'
                    ? 'Tiền mặt'
                    : selectedPayment.paymentMethod ?? 'Chuyển khoản'}
                </strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>🔖 Mã giao dịch Ngân hàng (Tx):</span>
                <code style={{ background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '6px', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                  {selectedPayment.transactionCode || '— (Không có mã GD)'}
                </code>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>👤 Người ghi nhận thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{selectedPayment.createdBy || 'Hệ thống Admin'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>⏰ Thời gian ghi nhận hệ thống:</span>
                <strong style={{ color: '#475569', fontSize: '0.88rem' }}>{formatDateTime(selectedPayment.createdAt)}</strong>
              </div>

              {selectedPayment.cancelledAt && (
                <div>
                  <span style={{ color: '#dc2626', display: 'block', fontSize: '0.82rem' }}>🚫 Thời gian hủy giao dịch:</span>
                  <strong style={{ color: '#dc2626', fontSize: '0.88rem' }}>
                    {formatDateTime(selectedPayment.cancelledAt)} {selectedPayment.cancelledBy ? `(bởi ${selectedPayment.cancelledBy})` : ''}
                  </strong>
                </div>
              )}

              <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📝 Ghi chú thanh toán:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedPayment.note || 'Không có ghi chú thêm.'}</span>
              </div>
            </div>

            {/* 3. Thẻ Preview Ảnh Minh Chứng Chuyển Khoản (Bill / Ủy nhiệm chi) */}
            {selectedPayment.proofUrl && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ImageIcon size={16} color="var(--df-primary)" />
                    <span>ẢNH MINH CHỨNG CHUYỂN KHOẢN (BILL / ỦY NHIỆM CHI)</span>
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setPreviewProofUrl(selectedPayment.proofUrl)}
                    style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}
                  >
                    🔍 Xem phóng to
                  </button>
                </div>
                <div
                  onClick={() => setPreviewProofUrl(selectedPayment.proofUrl)}
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
                    src={selectedPayment.proofUrl}
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

            {/* 4. Nút bấm thao tác chuyển hướng */}
            <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const payId = selectedPayment.payableId;
                  setSelectedPayment(null);
                  navigate(`/payables/${payId}`);
                }}
                style={{ fontSize: '0.88rem', padding: '0.45rem 0.9rem' }}
              >
                🔗 Xem chi tiết Công nợ hoá đơn này
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSelectedPayment(null)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Preview Ảnh Minh Chứng Full Size */}
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
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            />
            <button type="button" className="btn-ghost" onClick={() => setPreviewProofUrl(null)}>
              Đóng
            </button>
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
              Bạn có chắc chắn muốn <strong>hủy giao dịch thanh toán số tiền {formatMoney(paymentToVoid.amount)}</strong> cho hoá đơn <strong>{paymentToVoid.invoiceCode}</strong>?
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', color: '#991b1b' }}>
              💡 Sau khi hủy, số tiền này sẽ được hoàn trả lại vào số nợ còn thiếu của công nợ hoá đơn tương ứng.
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setPaymentToVoid(null)}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleVoidConfirm}
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
