import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PayableData } from '@debtflow/shared';
import DataTable, { Column } from '../components/DataTable';
import PayableStatusBadge from '../components/PayableStatusBadge';
import Modal from '../components/Modal';
import { usePayables, useSuppliers } from '../hooks/queries';
import { formatMoney, formatDateTime } from '../utils/format';
import { CreditCard, CheckCircle2, Clock, AlertTriangle, Eye } from 'lucide-react';

export default function PayablesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') ?? '';
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [selectedPayable, setSelectedPayable] = useState<PayableData | null>(null);

  const { data: suppliers = [] } = useSuppliers();
  const activeSuppliers = suppliers.filter((s) => s.status === 'ACTIVE');
  const { data: allPayables = [], isLoading, isError } = usePayables({});

  // Step 1: Filter payables by selected Supplier
  const supplierPayables = useMemo(() => {
    if (!supplierFilter) return allPayables;
    return allPayables.filter((p) => p.supplierId === supplierFilter);
  }, [allPayables, supplierFilter]);

  // Step 2: Calculations for 3 Stat Cards based on selected Supplier
  const stats = useMemo(() => {
    let paidTotal = 0;
    let paidCount = 0;
    let upcomingTotal = 0;
    let upcomingCount = 0;
    let overdueTotal = 0;
    let overdueCount = 0;

    for (const p of supplierPayables) {
      if (p.status === 'PAID') {
        paidTotal += p.totalAmount;
        paidCount++;
      } else if (p.status === 'OVERDUE') {
        overdueTotal += p.balance;
        overdueCount++;
      } else {
        upcomingTotal += p.balance;
        upcomingCount++;
      }
    }

    return { paidTotal, paidCount, upcomingTotal, upcomingCount, overdueTotal, overdueCount };
  }, [supplierPayables]);

  // Step 3: Filter rows by Status
  const payables = useMemo(() => {
    if (!statusFilter) return supplierPayables;

    if (statusFilter === 'UNPAID_ANY') {
      // Chưa trả = Chưa thanh toán hoặc chưa thanh toán xong (balance > 0)
      return supplierPayables.filter((p) => p.balance > 0 || p.status === 'UNPAID' || p.status === 'PARTIAL' || p.status === 'OVERDUE');
    }

    if (statusFilter === 'PARTIAL') {
      // Trả 1 phần = Chỉ hóa đơn đã trả 1 phần
      return supplierPayables.filter((p) => p.status === 'PARTIAL');
    }

    if (statusFilter === 'UPCOMING') {
      // Sắp đến hạn = Hóa đơn còn nợ có hạn chót trong vòng 7 ngày (tuần này)
      const nowMs = new Date().getTime();
      const sevenDaysMs = 7 * 86400000;
      return supplierPayables.filter((p) => {
        if (!p.dueDate || p.status === 'PAID') return false;
        const dueMs = new Date(p.dueDate).getTime();
        const diffMs = dueMs - nowMs;
        return diffMs >= -86400000 && diffMs <= sevenDaysMs;
      });
    }

    if (statusFilter === 'OVERDUE') {
      return supplierPayables.filter((p) => p.status === 'OVERDUE');
    }

    if (statusFilter === 'PAID') {
      return supplierPayables.filter((p) => p.status === 'PAID');
    }

    return supplierPayables.filter((p) => p.status === statusFilter);
  }, [supplierPayables, statusFilter]);

  const columns: Column<PayableData>[] = [
    { key: 'code', header: 'Số hoá đơn', render: (p) => <strong style={{ color: 'var(--df-primary)' }}>{p.invoiceCode}</strong> },
    { key: 'supplier', header: 'Nhà cung cấp', render: (p) => p.supplierName },
    { key: 'invoiceDate', header: 'Ngày HĐ', align: 'center', render: (p) => formatDateTime(p.invoiceDate) },
    { key: 'dueDate', header: 'Đến hạn', align: 'center', render: (p) => formatDateTime(p.dueDate) },
    { key: 'total', header: 'Tổng tiền', align: 'right', render: (p) => formatMoney(p.totalAmount) },
    { key: 'paid', header: 'Đã trả', align: 'right', render: (p) => <span style={{ color: '#16a34a' }}>{formatMoney(p.paid)}</span> },
    {
      key: 'balance',
      header: 'Còn lại',
      align: 'right',
      render: (p) => (
        <strong className={p.balance > 0 ? 'text-danger' : undefined}>{formatMoney(p.balance)}</strong>
      ),
    },
    { key: 'status', header: 'Trạng thái', align: 'center', render: (p) => <PayableStatusBadge status={p.status} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      render: (p) => (
        <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setSelectedPayable(p)}
            style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Eye size={14} />
            <span>Chi tiết</span>
          </button>
          {p.balance > 0 && (
            <button
              type="button"
              onClick={() => navigate(`/payables/${p.id}`)}
              style={{
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <CreditCard size={14} />
              <span>Thanh toán ngay</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="page">
      <header className="page-header">
        <h2>Công nợ phải trả</h2>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {/* Lọc Nhà cung cấp */}
          <select
            className="search-input"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">Tất cả nhà cung cấp ({activeSuppliers.length})</option>
            {activeSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>

          {/* Lọc Trạng thái */}
          <select
            className="search-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái công nợ</option>
            <option value="UNPAID_ANY">Chưa trả (Chưa trả hoặc chưa hoàn tất)</option>
            <option value="PARTIAL">Trả 1 phần (Chỉ hoá đơn trả 1 phần)</option>
            <option value="UPCOMING">Sắp đến hạn (Trong vòng 7 ngày / tuần này)</option>
            <option value="OVERDUE">Quá hạn (Đã quá hạn chót thanh toán)</option>
            <option value="PAID">Đã trả đủ (Đã thanh toán 100%)</option>
          </select>
        </div>
      </header>

      {/* 3 Thẻ thống kê nổi bật */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* Card 1: Đã thanh toán */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'PAID' ? '' : 'PAID')}
          style={{
            background: statusFilter === 'PAID' ? '#f0fdf4' : '#fff',
            border: statusFilter === 'PAID' ? '2px solid #22c55e' : '1px solid #e2e8f0',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>✅ ĐÃ THANH TOÁN</span>
            <CheckCircle2 size={20} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534' }}>
            {formatMoney(stats.paidTotal)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '0.2rem' }}>
            {stats.paidCount} hoá đơn đã trả đủ 100%
          </div>
        </div>

        {/* Card 2: Sắp đến hạn */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'UPCOMING' ? '' : 'UPCOMING')}
          style={{
            background: statusFilter === 'UPCOMING' ? '#fffbeb' : '#fff',
            border: statusFilter === 'UPCOMING' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 600 }}>⏳ SẮP ĐẾN HẠN</span>
            <Clock size={20} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#92400e' }}>
            {formatMoney(stats.upcomingTotal)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.2rem' }}>
            {stats.upcomingCount} hoá đơn trong hạn thanh toán
          </div>
        </div>

        {/* Card 3: Quá hạn */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? '' : 'OVERDUE')}
          style={{
            background: statusFilter === 'OVERDUE' ? '#fef2f2' : '#fff',
            border: statusFilter === 'OVERDUE' ? '2px solid #ef4444' : '1px solid #e2e8f0',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>🚨 QUÁ HẠN</span>
            <AlertTriangle size={20} color="#dc2626" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b' }}>
            {formatMoney(stats.overdueTotal)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '0.2rem' }}>
            {stats.overdueCount} hoá đơn đã vượt quá hạn
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={payables}
        rowKey={(p) => p.id}
        loading={isLoading}
        error={isError}
        onRowClick={(p) => navigate(`/payables/${p.id}`)}
      />

      {/* Modal Chi tiết Công nợ & Nhập hàng */}
      <Modal
        title={selectedPayable ? `Chi tiết nhập hàng #${selectedPayable.invoiceCode}` : 'Chi tiết công nợ'}
        open={!!selectedPayable}
        onClose={() => setSelectedPayable(null)}
        size="lg"
      >
        {selectedPayable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* Thông tin hoá đơn */}
            <div
              style={{
                background: '#f8fafc',
                padding: '1rem 1.2rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem 1.5rem',
                fontSize: '0.88rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>🏢 Nhà cung cấp:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{selectedPayable.supplierName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>📄 Mã hoá đơn:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{selectedPayable.invoiceCode}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>📅 Ngày lập hoá đơn:</span>{' '}
                <strong>{formatDateTime(selectedPayable.invoiceDate)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>⏰ Hạn thanh toán:</span>{' '}
                <strong>{formatDateTime(selectedPayable.dueDate)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>📌 Trạng thái:</span>{' '}
                <PayableStatusBadge status={selectedPayable.status} />
              </div>
              <div>
                <span style={{ color: '#64748b' }}>💰 Đã thanh toán:</span>{' '}
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatMoney(selectedPayable.paid)}</span>
              </div>
            </div>

            {/* Bảng chi tiết mặt hàng nhập */}
            <div>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: '#334155' }}>
                DANH SÁCH MẶT HÀNG NHẬP ({(selectedPayable.items ?? []).length})
              </h4>
              <div className="table-wrap">
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Tên mặt hàng</th>
                      <th style={{ textAlign: 'center' }}>ĐVT</th>
                      <th style={{ textAlign: 'center' }}>Số lượng</th>
                      <th style={{ textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPayable.items ?? []).length > 0 ? (
                      (selectedPayable.items ?? []).map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td data-label="Tên mặt hàng">{item.itemName}</td>
                          <td data-label="ĐVT" style={{ textAlign: 'center' }}>{item.unit}</td>
                          <td data-label="Số lượng" style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                          <td data-label="Đơn giá" style={{ textAlign: 'right' }}>{formatMoney(item.unitPrice)}</td>
                          <td data-label="Thành tiền" style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatMoney(item.quantity * item.unitPrice)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                          Thông tin chi tiết mặt hàng theo hoá đơn
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tổng số tiền & Nợ còn lại */}
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
              <div>
                <span style={{ fontSize: '0.85rem', color: '#475569', display: 'block' }}>Tổng tiền hoá đơn: {formatMoney(selectedPayable.totalAmount)}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e40af' }}>NỢ CÒN LẠI PHẢI TRẢ:</span>
              </div>
              <strong style={{ fontSize: '1.35rem', color: '#dc2626' }}>
                {formatMoney(selectedPayable.balance)}
              </strong>
            </div>

            {/* Modal Actions */}
            <div className="form-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedPayable(null)}
              >
                Quay lại
              </button>
              {selectedPayable.balance > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const payId = selectedPayable.id;
                    setSelectedPayable(null);
                    navigate(`/payables/${payId}`);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <CreditCard size={16} />
                  <span>Thanh toán ngay</span>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
