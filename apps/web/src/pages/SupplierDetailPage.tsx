import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PaymentData } from '@debtflow/shared';
import {
  ArrowLeft,
  Building,
  QrCode,
  CreditCard,
  PieChart as PieChartIcon,
  CheckSquare,
  Square,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import ProductsPanel from '../components/ProductsPanel';
import PayableStatusBadge from '../components/PayableStatusBadge';
import OrderStatusBadge from '../components/OrderStatusBadge';
import Modal from '../components/Modal';
import { useFacilities, useOrders, usePayables, usePayments, useReceipts, useSupplier, useSupplierMutations } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

const TABS = ['Mặt hàng', 'Đơn hàng & Phiếu nhập', 'Công nợ', 'Lịch sử thanh toán'] as const;

type TimePreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
type CompPeriod = 'PREV_PERIOD' | 'PREV_MONTH' | 'PREV_QUARTER' | 'PREV_YEAR' | 'CUSTOM';

/** Kiểm tra ngày thuộc khoảng lọc thời gian */
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
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }

  if (preset === 'WEEK') {
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
    return d >= oneWeekAgo && d <= now;
  }

  if (preset === 'MONTH') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  if (preset === 'QUARTER') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const dateQuarter = Math.floor(d.getMonth() / 3);
    return dateQuarter === currentQuarter && d.getFullYear() === now.getFullYear();
  }

  if (preset === 'YEAR') {
    return d.getFullYear() === now.getFullYear();
  }

  return true;
}

/** Tính khoảng thời gian Kỳ 2 / Kỳ So Sánh */
function getCompPeriodRange(
  compPreset: CompPeriod,
  primaryPreset: TimePreset,
  primaryFromDate?: string,
  primaryToDate?: string,
  compFromDate?: string,
  compToDate?: string,
): { prevFrom: Date; prevTo: Date } {
  const now = new Date();

  if (compPreset === 'CUSTOM' && compFromDate && compToDate) {
    return {
      prevFrom: new Date(`${compFromDate}T00:00:00`),
      prevTo: new Date(`${compToDate}T23:59:59`),
    };
  }

  if (compPreset === 'PREV_MONTH') {
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { prevFrom, prevTo };
  }

  if (compPreset === 'PREV_QUARTER') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const prevYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevFrom = new Date(prevYear, prevQuarter * 3, 1);
    const prevTo = new Date(prevYear, (prevQuarter + 1) * 3, 0, 23, 59, 59);
    return { prevFrom, prevTo };
  }

  if (compPreset === 'PREV_YEAR') {
    const prevYear = now.getFullYear() - 1;
    return {
      prevFrom: new Date(prevYear, 0, 1),
      prevTo: new Date(prevYear, 11, 31, 23, 59, 59),
    };
  }

  // Tự động theo Kỳ 1 (Primary Preset)
  if (primaryPreset === 'TODAY') {
    const y = new Date(now.getTime() - 86400000);
    return {
      prevFrom: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0),
      prevTo: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59),
    };
  }
  if (primaryPreset === 'WEEK') {
    const prevTo = new Date(now.getTime() - 7 * 86400000);
    const prevFrom = new Date(now.getTime() - 14 * 86400000);
    return { prevFrom, prevTo };
  }
  if (primaryPreset === 'MONTH') {
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { prevFrom, prevTo };
  }
  if (primaryPreset === 'QUARTER') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const prevYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevFrom = new Date(prevYear, prevQuarter * 3, 1);
    const prevTo = new Date(prevYear, (prevQuarter + 1) * 3, 0, 23, 59, 59);
    return { prevFrom, prevTo };
  }
  if (primaryPreset === 'YEAR') {
    const prevYear = now.getFullYear() - 1;
    return {
      prevFrom: new Date(prevYear, 0, 1),
      prevTo: new Date(prevYear, 11, 31, 23, 59, 59),
    };
  }
  if (primaryPreset === 'CUSTOM' && primaryFromDate && primaryToDate) {
    const f = new Date(`${primaryFromDate}T00:00:00`);
    const t = new Date(`${primaryToDate}T23:59:59`);
    const duration = t.getTime() - f.getTime();
    const prevTo = new Date(f.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - Math.max(duration, 86400000));
    return { prevFrom, prevTo };
  }

  // Fallback default: Tháng trước
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { prevFrom, prevTo };
}

export default function SupplierDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { data: supplier, isLoading: isLoadingSupplier } = useSupplier(id);
  const { data: facilities = [] } = useFacilities();
  const { update: updateSupplier } = useSupplierMutations();

  const [tab, setTab] = useState<(typeof TABS)[number]>('Mặt hàng');

  // Primary Period State (Kỳ 1)
  const [timePreset, setTimePreset] = useState<TimePreset>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Comparison Period State (Kỳ 2 / Kỳ So Sánh)
  const [compPreset, setCompPreset] = useState<CompPeriod>('PREV_PERIOD');
  const [compFromDate, setCompFromDate] = useState('');
  const [compToDate, setCompToDate] = useState('');

  // Selected Facilities tickbox state (Empty array means ALL facilities)
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);

  // Modal edit QR & Bank state
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    qrCodeUrl: '',
  });

  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentData | null>(null);

  // Fetch orders, receipts, payables, payments for this supplier
  const { data: orders = [] } = useOrders();
  const { data: receipts = [] } = useReceipts({ supplierId: id });
  const { data: payables = [] } = usePayables({ supplierId: id });
  const { data: payments = [] } = usePayments({ supplierId: id });

  // Filter orders for this supplier
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.supplierId !== id) return false;
      if (selectedFacilityIds.length > 0 && !selectedFacilityIds.includes(o.facilityId)) {
        return false;
      }
      return isDateInFilter(o.createdAt, timePreset, fromDate, toDate);
    });
  }, [orders, id, selectedFacilityIds, timePreset, fromDate, toDate]);

  // Toggle Facility Tickbox
  const toggleFacility = (facId: string) => {
    if (selectedFacilityIds.includes(facId)) {
      setSelectedFacilityIds(selectedFacilityIds.filter((f) => f !== facId));
    } else {
      setSelectedFacilityIds([...selectedFacilityIds, facId]);
    }
  };

  const selectAllFacilities = () => {
    setSelectedFacilityIds([]);
  };

  // Filtered data for Primary Period (Kỳ 1)
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (selectedFacilityIds.length > 0 && !selectedFacilityIds.includes(r.facilityId)) {
        return false;
      }
      return isDateInFilter(r.receiptDate, timePreset, fromDate, toDate);
    });
  }, [receipts, selectedFacilityIds, timePreset, fromDate, toDate]);

  const filteredPayables = useMemo(() => {
    return payables.filter((p) => {
      return isDateInFilter(p.invoiceDate, timePreset, fromDate, toDate);
    });
  }, [payables, timePreset, fromDate, toDate]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      return isDateInFilter(p.paymentDate, timePreset, fromDate, toDate);
    });
  }, [payments, timePreset, fromDate, toDate]);

  // Filtered Totals for Primary Period (Kỳ 1)
  const currentPeriodTotal = useMemo(
    () => filteredReceipts.reduce((sum, r) => sum + r.grandTotal, 0),
    [filteredReceipts],
  );

  const filteredPaid = useMemo(
    () => filteredPayments.filter((p) => p.status === 'ACTIVE').reduce((sum, p) => sum + p.amount, 0),
    [filteredPayments],
  );

  // Receipts for Comparison Period (Kỳ 2 / Kỳ So Sánh)
  const compPeriodTotal = useMemo(() => {
    const { prevFrom, prevTo } = getCompPeriodRange(
      compPreset,
      timePreset,
      fromDate,
      toDate,
      compFromDate,
      compToDate,
    );
    return receipts
      .filter((r) => {
        if (selectedFacilityIds.length > 0 && !selectedFacilityIds.includes(r.facilityId)) {
          return false;
        }
        if (!r.receiptDate) return false;
        const d = new Date(r.receiptDate);
        return d >= prevFrom && d <= prevTo;
      })
      .reduce((sum, r) => sum + r.grandTotal, 0);
  }, [receipts, selectedFacilityIds, compPreset, timePreset, fromDate, toDate, compFromDate, compToDate]);

  // 2-Color Comparison Donut Slices (🔵 Kỳ 1 #2563eb vs 🟠 Kỳ 2 #f59e0b)
  const comparisonDonutData = useMemo(() => {
    const grandSum = currentPeriodTotal + compPeriodTotal || 1;
    const currentPct = (currentPeriodTotal / grandSum) * 100;
    const compPct = (compPeriodTotal / grandSum) * 100;

    const currentStroke = `${currentPct} ${100 - currentPct}`;
    const compStroke = `${compPct} ${100 - compPct}`;
    const compOffset = -currentPct;

    // Delta comparison
    const diff = currentPeriodTotal - compPeriodTotal;
    const growthRate =
      compPeriodTotal > 0
        ? ((diff / compPeriodTotal) * 100).toFixed(1)
        : currentPeriodTotal > 0
          ? '+100'
          : '0';

    return {
      currentPeriodTotal,
      compPeriodTotal,
      currentPct,
      compPct,
      currentStroke,
      compStroke,
      compOffset,
      diff,
      growthRate,
    };
  }, [currentPeriodTotal, compPeriodTotal]);

  const openEditBank = () => {
    if (supplier) {
      setBankForm({
        bankName: supplier.bankName ?? '',
        bankAccountNo: supplier.bankAccountNo ?? '',
        bankAccountName: supplier.bankAccountName ?? '',
        qrCodeUrl: supplier.qrCodeUrl ?? '',
      });
      setBankModalOpen(true);
    }
  };

  const onSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    try {
      await updateSupplier.mutateAsync({ id: supplier.id, ...bankForm });
      setBankModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  if (isLoadingSupplier) return <section className="page">Đang tải dữ liệu nhà cung cấp…</section>;
  if (!supplier) return <section className="page">Không tìm thấy nhà cung cấp.</section>;

  return (
    <section className="page">
      {/* Header & Back button */}
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
            <h2 style={{ margin: 0 }}>
              {supplier.code} — {supplier.name}
            </h2>
            {supplier.status === 'INACTIVE' && <span className="badge badge-muted">Ẩn</span>}
          </div>
        </div>

        {/* Thanh Lọc Thời Gian & Chọn Cơ Sở (List + Checkbox) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
          {/* Dropdown Chọn Cơ Sở Dạng List + Tickbox */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setFacilityDropdownOpen(!facilityDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#fff',
                border: '1px solid #cbd5e1',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <Building size={16} color="var(--df-primary)" />
              <span>
                {selectedFacilityIds.length === 0
                  ? `Tất cả cơ sở (${facilities.length})`
                  : `Đã chọn ${selectedFacilityIds.length}/${facilities.length} cơ sở`}
              </span>
            </button>

            {/* Menu List Tickbox chọn cơ sở */}
            {facilityDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  left: 0,
                  zIndex: 50,
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  padding: '0.6rem 0.8rem',
                  minWidth: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div
                  onClick={selectAllFacilities}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.3rem 0.4rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: selectedFacilityIds.length === 0 ? 700 : 500,
                    background: selectedFacilityIds.length === 0 ? '#eff6ff' : 'transparent',
                    color: selectedFacilityIds.length === 0 ? '#1d4ed8' : '#334155',
                  }}
                >
                  {selectedFacilityIds.length === 0 ? (
                    <CheckSquare size={16} color="#1d4ed8" />
                  ) : (
                    <Square size={16} color="#94a3b8" />
                  )}
                  <span>Tất cả các cơ sở</span>
                </div>
                <div style={{ height: '1px', background: '#e2e8f0', margin: '0.2rem 0' }} />
                {facilities.map((f) => {
                  const isChecked = selectedFacilityIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleFacility(f.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.3rem 0.4rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: isChecked ? 600 : 400,
                        background: isChecked ? '#f0fdf4' : 'transparent',
                        color: isChecked ? '#15803d' : '#334155',
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare size={16} color="#16a34a" />
                      ) : (
                        <Square size={16} color="#94a3b8" />
                      )}
                      <span>{f.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Thẻ Thống Kê Tổng Quan Theo Bộ Lọc */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <span className="stat-label">Tổng phát sinh Kỳ này</span>
          <span className="stat-value">{formatMoney(currentPeriodTotal)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Đã thanh toán Kỳ này</span>
          <span className="stat-value" style={{ color: '#16a34a' }}>
            {formatMoney(filteredPaid)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Còn nợ hiện tại</span>
          <span className={`stat-value ${supplier.balance > 0 ? 'text-danger' : ''}`}>
            {formatMoney(supplier.balance)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Hoá đơn quá hạn</span>
          <span className="stat-value">{supplier.overdueCount}</span>
        </div>
      </div>

      {/* Khối Thông Tin NCC & Ngân Hàng VietQR (To, Rõ Ràng & Sắc Nét) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.15fr',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Thông tin liên hệ đầy đủ */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.4rem 1.6rem',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.02rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Building size={20} color="var(--df-primary)" />
                <span>THÔNG TIN LIÊN HỆ & PHÁP LÝ NHÀ CUNG CẤP</span>
              </h4>
              <button
                type="button"
                className="btn-action-edit"
                onClick={openEditBank}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
              >
                ⚙️ Cập nhật
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.8rem 1.6rem',
                fontSize: '0.92rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Mã nhà cung cấp:</span>{' '}
                <strong style={{ color: '#1e40af', fontSize: '0.95rem' }}>{supplier.code}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Tên doanh nghiệp:</span>{' '}
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{supplier.name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Số điện thoại:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{supplier.phone ?? '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Email:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{supplier.email ?? '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Mã số thuế:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{supplier.taxCode ?? '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Người đại diện:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{supplier.contactPerson ?? '—'}</strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b' }}>Địa chỉ kho / VP:</span>{' '}
                <strong style={{ color: '#334155' }}>{supplier.address ?? '—'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Thẻ Tài Khoản Ngân Hàng & VietQR (Ảnh To & Rõ Ràng) */}
        <div
          style={{
            background: supplier.qrCodeUrl || supplier.bankAccountNo ? '#f0fdf4' : '#f8fafc',
            border: supplier.qrCodeUrl || supplier.bankAccountNo ? '1px solid #86efac' : '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.4rem 1.6rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: supplier.qrCodeUrl || supplier.bankAccountNo ? '#15803d' : '#334155', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <QrCode size={20} color={supplier.qrCodeUrl || supplier.bankAccountNo ? '#16a34a' : '#64748b'} />
                <span>THÔNG TIN THANH TOÁN STK & VIETQR</span>
              </h4>
            </div>

            {supplier.qrCodeUrl || supplier.bankAccountNo ? (
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {supplier.qrCodeUrl && (
                  <div
                    onClick={() => setPreviewProofUrl(supplier.qrCodeUrl!)}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      background: '#fff',
                      padding: '6px',
                      borderRadius: '10px',
                      border: '2px solid #4ade80',
                      boxShadow: '0 4px 10px rgba(22, 163, 74, 0.15)',
                    }}
                    title="Bấm để xem phóng to mã VietQR"
                  >
                    <img
                      src={supplier.qrCodeUrl}
                      alt="VietQR NCC"
                      style={{
                        width: '175px',
                        height: '175px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px' }}>
                      🔍 Phóng to
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#14532d', flex: 1 }}>
                  {supplier.bankName && (
                    <div>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Ngân hàng:</span>{' '}
                      <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{supplier.bankName}</strong>
                    </div>
                  )}
                  {supplier.bankAccountNo && (
                    <div style={{ background: '#fff', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ color: '#15803d', fontSize: '0.85rem', display: 'block' }}>Số tài khoản:</span>
                      <strong style={{ fontSize: '1.3rem', color: '#1e40af', letterSpacing: '0.05em' }}>
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
                </div>
              </div>
            ) : (
              <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: '#64748b' }}>
                  Chưa cài đặt STK ngân hàng hoặc mã VietQR cho Nhà cung cấp này.
                </p>
                <button type="button" className="btn-action-edit" onClick={openEditBank} style={{ fontSize: '0.88rem', padding: '0.4rem 0.9rem' }}>
                  + Thêm STK & Mã QR Ngân hàng
                </button>
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: supplier.qrCodeUrl || supplier.bankAccountNo ? '#15803d' : '#94a3b8', marginTop: '0.75rem', fontWeight: 500 }}>
            💡 Dùng App ngân hàng quét mã VietQR trên để thực hiện chuyển khoản thanh toán
          </div>
        </div>
      </div>

      {/* Khối Biểu Đồ Tròn (Donut Chart) Có Ô Chọn 2 Kỳ So Sánh Trực Tiếp Bên Trong Box */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Header Khối Biểu Đồ kèm Các Ô Chọn Cơ Sở & 2 Kỳ So Sánh Trực Tiếp Đồng Bộ Nút */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.85rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <PieChartIcon size={18} color="var(--df-primary)" />
            <span>BIỂU ĐỒ TRÒN SO SÁNH GIAO DỊCH 2 KỲ & CƠ SỞ</span>
          </h4>

          {/* Các Bộ Chọn Trực Tiếp Ngay Trong Khối Biểu Đồ - Chuẩn Hoá Đồng Bộ Nút Bấm */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* 1. Chọn Cơ sở */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setFacilityDropdownOpen(!facilityDropdownOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  padding: '0 0.8rem',
                  height: '36px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <Building size={15} color="var(--df-primary)" />
                <span>
                  {selectedFacilityIds.length === 0
                    ? `Tất cả cơ sở (${facilities.length})`
                    : `Đã tick ${selectedFacilityIds.length}/${facilities.length} cơ sở`}
                </span>
              </button>

              {/* Menu List Tickbox chọn cơ sở */}
              {facilityDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    zIndex: 50,
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    padding: '0.6rem 0.8rem',
                    minWidth: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div
                    onClick={selectAllFacilities}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.3rem 0.4rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: selectedFacilityIds.length === 0 ? 700 : 500,
                      background: selectedFacilityIds.length === 0 ? '#eff6ff' : 'transparent',
                      color: selectedFacilityIds.length === 0 ? '#1d4ed8' : '#334155',
                    }}
                  >
                    {selectedFacilityIds.length === 0 ? (
                      <CheckSquare size={16} color="#1d4ed8" />
                    ) : (
                      <Square size={16} color="#94a3b8" />
                    )}
                    <span>Tất cả các cơ sở</span>
                  </div>
                  <div style={{ height: '1px', background: '#e2e8f0', margin: '0.2rem 0' }} />
                  {facilities.map((f) => {
                    const isChecked = selectedFacilityIds.includes(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleFacility(f.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.3rem 0.4rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: isChecked ? 600 : 400,
                          background: isChecked ? '#f0fdf4' : 'transparent',
                          color: isChecked ? '#15803d' : '#334155',
                        }}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} color="#16a34a" />
                        ) : (
                          <Square size={16} color="#94a3b8" />
                        )}
                        <span>{f.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Chọn Kỳ 1 (🔵) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0 0.8rem', height: '36px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>🔵 Kỳ 1:</span>
              <select
                className="search-input"
                value={timePreset}
                onChange={(e) => setTimePreset(e.target.value as TimePreset)}
                style={{ fontSize: '0.82rem', border: 'none', background: 'transparent', fontWeight: 600, color: '#1e40af', padding: 0 }}
              >
                <option value="ALL">Tất cả thời gian</option>
                <option value="TODAY">Hôm nay</option>
                <option value="WEEK">Tuần này</option>
                <option value="MONTH">Tháng này</option>
                <option value="QUARTER">Quý này</option>
                <option value="YEAR">Năm nay</option>
                <option value="CUSTOM">📅 Tùy chọn ngày</option>
              </select>
              {timePreset === 'CUSTOM' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: '0.2rem' }}>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '0.15rem 0.3rem', border: '1px solid #93c5fd', borderRadius: '4px', background: '#fff' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#1e40af' }}>-</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '0.15rem 0.3rem', border: '1px solid #93c5fd', borderRadius: '4px', background: '#fff' }}
                  />
                </div>
              )}
            </div>

            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>VS</span>

            {/* 3. Chọn Kỳ 2 (🟠) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#fff7ed', border: '1px solid #fed7aa', padding: '0 0.8rem', height: '36px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c2410c', whiteSpace: 'nowrap' }}>🟠 Kỳ 2:</span>
              <select
                className="search-input"
                value={compPreset}
                onChange={(e) => setCompPreset(e.target.value as CompPeriod)}
                style={{ fontSize: '0.82rem', border: 'none', background: 'transparent', fontWeight: 600, color: '#c2410c', padding: 0 }}
              >
                <option value="PREV_PERIOD">Kỳ liền trước (Tự động)</option>
                <option value="PREV_MONTH">Tháng trước</option>
                <option value="PREV_QUARTER">Quý trước</option>
                <option value="PREV_YEAR">Năm trước</option>
                <option value="CUSTOM">📅 Tùy chọn ngày</option>
              </select>
              {compPreset === 'CUSTOM' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: '0.2rem' }}>
                  <input
                    type="date"
                    value={compFromDate}
                    onChange={(e) => setCompFromDate(e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '0.15rem 0.3rem', border: '1px solid #fdba74', borderRadius: '4px', background: '#fff' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#c2410c' }}>-</span>
                  <input
                    type="date"
                    value={compToDate}
                    onChange={(e) => setCompToDate(e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '0.15rem 0.3rem', border: '1px solid #fdba74', borderRadius: '4px', background: '#fff' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem', alignItems: 'center' }}>
          {/* Biểu Đồ Donut Lớn 260px 2 Màu So Sánh (🔵 Kỳ 1 vs 🟠 Kỳ 2) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem' }}>
            <div style={{ position: 'relative', width: '250px', height: '250px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {/* 🔵 Kỳ 1 (Blue) */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="3.8"
                  strokeDasharray={comparisonDonutData.currentStroke}
                  strokeDashoffset="0"
                  style={{ transition: 'all 0.5s ease' }}
                />
                {/* 🟠 Kỳ 2 (Amber/Orange) */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="3.8"
                  strokeDasharray={comparisonDonutData.compStroke}
                  strokeDashoffset={comparisonDonutData.compOffset}
                  style={{ transition: 'all 0.5s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TỔNG PHÁT SINH 2 KỲ</span>
                <strong style={{ fontSize: '1.15rem', color: '#0f172a', marginTop: '2px' }}>
                  {formatMoney(currentPeriodTotal + compPeriodTotal)}
                </strong>
              </div>
            </div>

            {/* Chú thích 2 Màu So Sánh Kỳ 1 vs Kỳ 2 */}
            <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '340px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', background: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2563eb' }} />
                  <span style={{ color: '#1e40af', fontWeight: 700, fontSize: '0.82rem' }}>🔵 Kỳ 1</span>
                </div>
                <strong style={{ fontSize: '0.95rem', color: '#1e40af' }}>{formatMoney(currentPeriodTotal)}</strong>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Tỷ trọng: {comparisonDonutData.currentPct.toFixed(1)}%</span>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', background: '#fff7ed', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} />
                  <span style={{ color: '#c2410c', fontWeight: 700, fontSize: '0.82rem' }}>🟠 Kỳ 2</span>
                </div>
                <strong style={{ fontSize: '0.95rem', color: '#c2410c' }}>{formatMoney(compPeriodTotal)}</strong>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Tỷ trọng: {comparisonDonutData.compPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Bảng Số Liệu Thống Kê Tổng Quan 2 Kỳ */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem 1.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              📊 THỐNG KÊ CHI TIẾT & BIẾN ĐỘNG
            </h5>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Phát sinh Kỳ 1 (🔵):</span>
                <strong style={{ fontSize: '0.95rem', color: '#2563eb' }}>{formatMoney(currentPeriodTotal)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Phát sinh Kỳ 2 (🟠):</span>
                <strong style={{ fontSize: '0.95rem', color: '#d97706' }}>{formatMoney(compPeriodTotal)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Biến động tăng/giảm:</span>
                {comparisonDonutData.diff > 0 ? (
                  <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <TrendingUp size={16} />
                    <span>+{formatMoney(comparisonDonutData.diff)} (+{comparisonDonutData.growthRate}%)</span>
                  </span>
                ) : comparisonDonutData.diff < 0 ? (
                  <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <TrendingDown size={16} />
                    <span>{formatMoney(comparisonDonutData.diff)} ({comparisonDonutData.growthRate}%)</span>
                  </span>
                ) : (
                  <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Minus size={16} />
                    <span>Không thay đổi</span>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Cơ sở được tính toán:</span>
                <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                  {selectedFacilityIds.length === 0 ? `Tất cả (${facilities.length} cơ sở)` : `${selectedFacilityIds.length}/${facilities.length} cơ sở`}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={t === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Tab 1: Mặt hàng */}
        {tab === 'Mặt hàng' && <ProductsPanel supplierId={supplier.id} />}

        {/* Tab 2: Đơn hàng & Phiếu nhập (Giống 100% Trang Quản lý đặt hàng) */}
        {tab === 'Đơn hàng & Phiếu nhập' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn hàng</th>
                  <th>Cơ sở nhận</th>
                  <th style={{ textAlign: 'center' }}>Số mặt hàng</th>
                  {currentUser?.role === 'ADMIN' && <th style={{ textAlign: 'right' }}>Tổng tiền</th>}
                  <th style={{ textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Ngày tạo đơn</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser?.role === 'ADMIN' ? 7 : 6} className="table-empty">
                      Không có đơn hàng / phiếu nhập trong thời gian và cơ sở đã chọn
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="clickable" onClick={() => {
                      if (currentUser?.role === 'ADMIN' || o.status === 'PENDING') {
                        navigate(`/orders/${o.id}`);
                      }
                    }}>
                      <td data-label="Mã đơn hàng">
                        <strong style={{ color: 'var(--df-primary)' }}>{o.orderCode}</strong>
                      </td>
                      <td data-label="Cơ sở nhận">{o.facilityName}</td>
                      <td data-label="Số mặt hàng" style={{ textAlign: 'center' }}>
                        <span className="badge badge-muted">{o.items.length} món</span>
                      </td>
                      {currentUser?.role === 'ADMIN' && (
                        <td data-label="Tổng tiền" style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {formatMoney(o.total)}
                        </td>
                      )}
                      <td data-label="Trạng thái" style={{ textAlign: 'center' }}>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td data-label="Ngày tạo đơn" style={{ textAlign: 'center' }}>{formatDateTime(o.createdAt)}</td>
                      <td data-label="Thao tác" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        {(currentUser?.role === 'ADMIN' || o.status === 'PENDING') && (
                          <button
                            type="button"
                            className="btn-action-view"
                            onClick={() => navigate(`/orders/${o.id}`)}
                          >
                            Chi tiết
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Công nợ */}
        {tab === 'Công nợ' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Số hoá đơn</th>
                  <th>Ngày HĐ</th>
                  <th>Đến hạn</th>
                  <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                  <th style={{ textAlign: 'right' }}>Còn lại</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayables.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      Không có công nợ trong thời gian đã chọn
                    </td>
                  </tr>
                ) : (
                  filteredPayables.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => navigate(`/payables/${p.id}`)}>
                      <td data-label="Số hoá đơn"><strong style={{ color: 'var(--df-primary)' }}>{p.invoiceCode}</strong></td>
                      <td data-label="Ngày HĐ">{formatDateTime(p.invoiceDate)}</td>
                      <td data-label="Đến hạn">{formatDateTime(p.dueDate)}</td>
                      <td data-label="Tổng tiền" style={{ textAlign: 'right' }}>{formatMoney(p.totalAmount)}</td>
                      <td data-label="Còn lại" style={{ textAlign: 'right' }}>
                        <strong className={p.balance > 0 ? 'text-danger' : undefined}>
                          {formatMoney(p.balance)}
                        </strong>
                      </td>
                      <td data-label="Trạng thái"><PayableStatusBadge status={p.status} /></td>
                      <td data-label="Thao tác" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
                            <span>Thanh toán</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Lịch sử thanh toán */}
        {tab === 'Lịch sử thanh toán' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày thanh toán</th>
                  <th>Mã hoá đơn</th>
                  <th style={{ textAlign: 'right' }}>Số tiền thanh toán</th>
                  <th>Phương thức</th>
                  <th>Mã GD</th>
                  <th style={{ textAlign: 'center' }}>Minh chứng</th>
                  <th style={{ textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      Chưa có lịch sử thanh toán trong thời gian đã chọn
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((pm) => (
                    <tr key={pm.id} className="clickable" onClick={() => setSelectedPaymentDetail(pm)}>
                      <td data-label="Ngày thanh toán">{formatDateTime(pm.paymentDate)}</td>
                      <td data-label="Mã hoá đơn"><strong style={{ color: 'var(--df-primary)' }}>{pm.invoiceCode}</strong></td>
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
                        <button
                          type="button"
                          className="btn-action-view"
                          onClick={() => setSelectedPaymentDetail(pm)}
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Xem Chi Tiết Giao Dịch Thanh Toán trong Chi tiết NCC (Nâng cấp Đầy đủ) */}
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
                <strong style={{ color: 'var(--df-primary)', fontSize: '1.05rem' }}>{selectedPaymentDetail.invoiceCode}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>🏢 Nhà cung cấp đối tác:</span>
                <strong style={{ color: '#0f172a', fontSize: '1.05rem' }}>{selectedPaymentDetail.supplierName || supplier.name}</strong>
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

            {/* 4. Nút bấm thao tác chuyển hướng */}
            <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const payId = selectedPaymentDetail.payableId;
                  setSelectedPaymentDetail(null);
                  navigate(`/payables/${payId}`);
                }}
                style={{ fontSize: '0.88rem', padding: '0.45rem 0.9rem' }}
              >
                🔗 Xem chi tiết Công nợ hoá đơn này
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSelectedPaymentDetail(null)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Cập Nhật Ngân Hàng & Mã VietQR */}
      <Modal
        title={`Cập nhật STK & VietQR — ${supplier.name}`}
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        size="md"
      >
        <form className="form-grid" onSubmit={onSaveBank}>
          <label>
            Tên ngân hàng
            <input
              placeholder="Ví dụ: Vietcombank, Techcombank..."
              value={bankForm.bankName}
              onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
            />
          </label>
          <label>
            Số tài khoản
            <input
              placeholder="Số TK ngân hàng..."
              value={bankForm.bankAccountNo}
              onChange={(e) => setBankForm({ ...bankForm, bankAccountNo: e.target.value })}
            />
          </label>
          <label className="span-2">
            Tên chủ tài khoản
            <input
              placeholder="Tên chủ tài khoản ngân hàng..."
              value={bankForm.bankAccountName}
              onChange={(e) => setBankForm({ ...bankForm, bankAccountName: e.target.value })}
            />
          </label>
          <label className="span-2">
            Ảnh mã QR thanh toán (VietQR)
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.3rem' }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setBankForm((prev) => ({ ...prev, qrCodeUrl: reader.result as string }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ fontSize: '0.85rem' }}
              />
              {bankForm.qrCodeUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img
                    src={bankForm.qrCodeUrl}
                    alt="VietQR"
                    style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setBankForm({ ...bankForm, qrCodeUrl: '' })}
                    style={{ fontSize: '0.75rem', color: '#dc2626', padding: '0.15rem 0.4rem' }}
                  >
                    Xoá QR
                  </button>
                </div>
              )}
            </div>
          </label>

          <div className="form-actions span-2" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setBankModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Lưu thay đổi
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
    </section>
  );
}
