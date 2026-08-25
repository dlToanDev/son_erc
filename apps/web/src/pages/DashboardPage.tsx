import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, TrendingUp, DollarSign, Clock, CheckCircle2, ShieldAlert, Award, FileSpreadsheet } from 'lucide-react';
import UnifiedFacilitySelect from '../components/UnifiedFacilitySelect';
import UnifiedDateFilter from '../components/UnifiedDateFilter';
import PieChart from '../components/PieChart';
import { useCompare, useDashboard, useFacilities, useStats } from '../hooks/queries';
import { formatMoney } from '../utils/format';

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => `${todayStr().slice(0, 7)}-01`;

export default function DashboardPage() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);

  const { data: facilities = [] } = useFacilities();
  const activeFacilities = facilities.filter((f) => f.status === 'ACTIVE');
  const facilityQueryParam =
    selectedFacilityIds.length === 0 || selectedFacilityIds.length === activeFacilities.length
      ? undefined
      : selectedFacilityIds.join(',');

  // Tính khoảng ngày kỳ trước tương ứng để so sánh biến động sản lượng
  const { prevFrom, prevTo } = useMemo(() => {
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const durationMs = Math.max(86400000, toDateObj.getTime() - fromDateObj.getTime());

    const prevToObj = new Date(fromDateObj.getTime() - 86400000);
    const prevFromObj = new Date(prevToObj.getTime() - durationMs);

    return {
      prevFrom: prevFromObj.toISOString().slice(0, 10),
      prevTo: prevToObj.toISOString().slice(0, 10),
    };
  }, [fromDate, toDate]);

  // Query dữ liệu
  const { data: dashboardData, isLoading: loadingDash } = useDashboard('1m', facilityQueryParam);
  const { data: statsData, isLoading: loadingStats } = useStats('1m', facilityQueryParam, fromDate, toDate);
  const { data: compareData, isLoading: loadingCompare } = useCompare(
    { fromA: prevFrom, toA: prevTo, fromB: fromDate, toB: toDate },
    facilityQueryParam,
  );

  // 1. Dữ liệu Biểu đồ hình tròn 3 cơ sở & Cơ sở chi tiêu nhiều nhất
  const { pieChartData, topFacility, totalFacilityPurchase } = useMemo(() => {
    if (!dashboardData?.facilityComparison) {
      return { pieChartData: [], topFacility: null, totalFacilityPurchase: 0 };
    }
    const list = dashboardData.facilityComparison;
    const total = list.reduce((sum, f) => sum + f.purchase, 0);

    const pie = list.map((f) => ({
      label: f.facilityName,
      value: f.purchase,
    }));

    const top = list.length > 0 ? list[0] : null;

    return {
      pieChartData: pie,
      topFacility: top,
      totalFacilityPurchase: total,
    };
  }, [dashboardData]);

  // 2. Danh sách các sản phẩm vượt quá so với kỳ trước kèm %
  const exceededItems = useMemo(() => {
    if (!compareData?.rows) return [];
    return compareData.rows
      .filter((r) => {
        // Lọc các mặt hàng có sản lượng nhập B > A hoặc chi phí B > A và có % tăng trưởng > 0
        const qtyDiff = r.quantityB - r.quantityA;
        const costDiff = r.costB - r.costA;
        return (qtyDiff > 0 || costDiff > 0) && (r.costChange ?? 0) > 0;
      })
      .sort((a, b) => (b.costChange ?? 0) - (a.costChange ?? 0));
  }, [compareData]);

  // 3. Tính tổng số tiền & số hóa đơn nợ đến hạn trong tuần này
  const upcomingThisWeekStats = useMemo(() => {
    if (!dashboardData?.debtAlerts) return { total: 0, count: 0 };
    const nowMs = new Date().getTime();
    const sevenDaysMs = 7 * 86400000;

    const list = dashboardData.debtAlerts.filter((a) => {
      if (!a.dueDate) return false;
      const dueMs = new Date(a.dueDate).getTime();
      const diffMs = dueMs - nowMs;
      // Công nợ đến hạn trong 7 ngày tới
      return diffMs >= -86400000 && diffMs <= sevenDaysMs;
    });

    const total = list.reduce((sum, a) => sum + a.balance, 0);
    return { total, count: list.length };
  }, [dashboardData]);

  const isInitialLoading = !dashboardData && (loadingDash || loadingStats || loadingCompare);

  return (
    <section className="page">
      {/* 1. Thanh tiêu đề & Bộ lọc Cơ sở + Bộ lọc Ngày tháng năm */}
      <header className="page-header">
        <h2>Dashboard - Tổng quan hệ thống</h2>
        <div className="page-actions" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
          <UnifiedFacilitySelect
            facilities={facilities}
            selectedIds={selectedFacilityIds}
            onChange={setSelectedFacilityIds}
          />
          <UnifiedDateFilter
            from={fromDate}
            to={toDate}
            onChange={(f, t) => {
              setFromDate(f);
              setToDate(t);
            }}
          />
        </div>
      </header>

      {isInitialLoading && <p className="placeholder">Đang tổng hợp dữ liệu dashboard…</p>}

      {dashboardData && statsData && (
        <>
          {/* 2. NỘI DUNG 1: 5 Thẻ KPI Tổng tiền, Nợ quá hạn, Nợ đến hạn tuần này, Đã trả, Còn nợ */}
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">TỔNG TIỀN MUA HÀNG (KỲ)</span>
                <DollarSign size={20} color="#2563eb" />
              </div>
              <span className="stat-value" style={{ color: '#1e293b' }}>
                {formatMoney(statsData.totals.cost)}
              </span>
              <span className="kpi-change kpi-flat">
                📅 Kỳ từ {fromDate} ➔ {toDate}
              </span>
            </div>

            <div
              className="stat-card"
              onClick={() => navigate('/payables?status=OVERDUE')}
              style={{
                borderLeft: '4px solid #dc2626',
                background: '#fff5f5',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              title="Click để chuyển sang trang Công nợ & tự động lọc Nợ quá hạn"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label" style={{ color: '#991b1b', fontWeight: 700 }}>NỢ QUÁ HẠN (CẢNH BÁO)</span>
                <AlertTriangle size={20} color="#dc2626" />
              </div>
              <span className="stat-value text-danger" style={{ fontWeight: 800 }}>
                {formatMoney(dashboardData.kpis.outstandingDebt.overdueAmount)}
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                <span className="kpi-change text-danger" style={{ fontWeight: 700 }}>
                  ⚠ Cần thanh toán ngay
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#dc2626', textDecoration: 'underline' }}>
                  Lọc quá hạn ➔
                </span>
              </div>
            </div>

            <div
              className="stat-card"
              onClick={() => navigate('/payables?status=UPCOMING')}
              style={{
                borderLeft: '4px solid #d97706',
                background: '#fffbeb',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              title="Click để chuyển sang trang Công nợ & tự động chọn lọc Nợ đến hạn"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label" style={{ color: '#92400e', fontWeight: 700 }}>NỢ ĐẾN HẠN TUẦN NÀY</span>
                <Clock size={20} color="#d97706" />
              </div>
              <span className="stat-value" style={{ color: '#b45309', fontWeight: 800 }}>
                {formatMoney(upcomingThisWeekStats.total)}
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                <span className="kpi-change" style={{ color: '#b45309', fontWeight: 700 }}>
                  ⏳ {upcomingThisWeekStats.count} hóa đơn sắp đến hạn
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309', textDecoration: 'underline' }}>
                  Lọc nợ tuần ➔
                </span>
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">SỐ TIỀN ĐÃ THANH TOÁN</span>
                <CheckCircle2 size={20} color="#16a34a" />
              </div>
              <span className="stat-value" style={{ color: '#16a34a' }}>
                {formatMoney(dashboardData.kpis.totalPaid.value)}
              </span>
              <span className="kpi-change kpi-up">✓ Đã chi trả nợ NCC</span>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">TỔNG CÔNG NỢ CÒN NỢ</span>
                <Clock size={20} color="#64748b" />
              </div>
              <span className="stat-value" style={{ color: '#334155' }}>
                {formatMoney(dashboardData.kpis.outstandingDebt.value)}
              </span>
              <span className="kpi-change kpi-flat">Công nợ tồn lũy kế</span>
            </div>
          </div>

          {/* 3. NỘI DUNG 2 & 3: Thống kê số tiền ở mỗi cơ sở & Biểu đồ hình tròn so sánh 3 cơ sở */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', margin: '1.5rem 0' }}>
            {/* Biểu đồ hình tròn so sánh cơ sở */}
            <div className="panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <TrendingUp size={20} color="var(--df-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  Biểu đồ so sánh tỷ trọng chi phí giữa các cơ sở
                </h3>
              </div>

              {pieChartData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <PieChart data={pieChartData} formatValue={formatMoney} size={210} />
                  {topFacility && (
                    <div
                      style={{
                        marginTop: '1rem',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#1e40af',
                        width: '100%',
                      }}
                    >
                      <Award size={18} color="#1d4ed8" />
                      <span>
                        🏆 <strong>{topFacility.facilityName}</strong> là cơ sở nhập mua nhiều nhất (
                        <strong>{formatMoney(topFacility.purchase)}</strong>
                        {totalFacilityPurchase > 0 && (
                          <span> - {Math.round((topFacility.purchase / totalFacilityPurchase) * 100)}% tổng số</span>
                        )}
                        )
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="placeholder">Chưa có dữ liệu cơ sở.</p>
              )}
            </div>

            {/* Thống kê chi tiết số tiền ở mỗi cơ sở */}
            <div className="panel">
              <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem', fontWeight: 700 }}>
                Thống kê chi tiết số tiền mua hàng ở mỗi cơ sở
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {dashboardData.facilityComparison.map((f) => {
                  const pct = totalFacilityPurchase > 0 ? Math.round((f.purchase / totalFacilityPurchase) * 100) : 0;
                  return (
                    <div
                      key={f.facilityId}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{f.facilityName}</strong>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--df-primary)' }}>
                          {formatMoney(f.purchase)} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="facility-bar-track" style={{ height: '8px', background: '#e2e8f0' }}>
                        <div
                          className="facility-bar-fill"
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'var(--df-primary)',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. NỘI DUNG 5: Ô THÔNG BÁO CẢNH BÁO SẢN PHẨM VƯỢT QUÁ SO VỚI KỲ TRƯỚC KÈM % */}
          <div
            className="panel"
            style={{
              background: exceededItems.length > 0 ? '#fff8f8' : '#f0fdf4',
              border: `1.5px solid ${exceededItems.length > 0 ? '#fca5a5' : '#86efac'}`,
              marginBottom: '1.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <ShieldAlert size={24} color={exceededItems.length > 0 ? '#dc2626' : '#16a34a'} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: exceededItems.length > 0 ? '#991b1b' : '#14532d' }}>
                    CẢNH BÁO MẶT HÀNG NHẬP VƯỢT MỨC SO VỚI KỲ TRƯỚC
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                    Kỳ này ({fromDate} ➔ {toDate}) so với kỳ trước ({prevFrom} ➔ {prevTo})
                  </span>
                </div>
              </div>
              {exceededItems.length > 0 && (
                <span
                  style={{
                    background: '#fef2f2',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                  }}
                >
                  ⚠ {exceededItems.length} mặt hàng tăng bất thường
                </span>
              )}
            </div>

            {exceededItems.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table table-sticky-first" style={{ background: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#fff1f2' }}>
                      <th style={{ color: '#991b1b' }}>Tên mặt hàng &amp; ĐVT</th>
                      <th style={{ textAlign: 'right', color: '#475569' }}>Kỳ trước nhập</th>
                      <th style={{ textAlign: 'right', color: '#991b1b' }}>Kỳ này nhập</th>
                      <th style={{ textAlign: 'right', color: '#991b1b' }}>Số lượng &amp; tiền tăng vượt</th>
                      <th style={{ textAlign: 'center', color: '#991b1b' }}>Tỷ lệ vượt %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceededItems.slice(0, 8).map((item) => {
                      const qtyDiff = item.quantityB - item.quantityA;
                      const costDiff = item.costB - item.costA;

                      return (
                        <tr key={`${item.itemName}|${item.unit}`}>
                          <td data-label="Tên mặt hàng">
                            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{item.itemName}</strong>{' '}
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({item.unit})</span>
                          </td>
                          <td data-label="Kỳ trước nhập" style={{ textAlign: 'right', color: '#64748b' }}>
                            <div>{item.quantityA} {item.unit}</div>
                            <div style={{ fontSize: '0.78rem' }}>{formatMoney(item.costA)}</div>
                          </td>
                          <td data-label="Kỳ này nhập" style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                            <div style={{ fontSize: '1rem' }}>{item.quantityB} {item.unit}</div>
                            <div style={{ fontSize: '0.8rem' }}>{formatMoney(item.costB)}</div>
                          </td>
                          <td data-label="Tăng vượt" style={{ textAlign: 'right', color: '#991b1b', fontWeight: 800 }}>
                            <div>+{qtyDiff} {item.unit}</div>
                            <div style={{ fontSize: '0.8rem', color: '#dc2626' }}>+{formatMoney(costDiff)}</div>
                          </td>
                          <td data-label="Tỷ lệ vượt %" style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1.5px solid #fca5a5',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '8px',
                                fontSize: '0.88rem',
                                fontWeight: 900,
                              }}
                            >
                              ▲ +{item.costChange}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#15803d', fontWeight: 600 }}>
                ✓ Không có mặt hàng nào bị nhập vượt mức bất thường so với kỳ trước. Các chỉ số nhập kho đều ổn định!
              </p>
            )}
          </div>

          {/* 5. NỘI DUNG 4: BẢNG THỐNG KÊ ĐỢT NÀY CƠ SỞ ĐÃ NHẬP BAO NHIÊU CÁI VÀ NHỮNG CÁI GÌ */}
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} color="var(--df-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  Thống kê sản lượng nhập kho đợt này (Kỳ {fromDate} ➔ {toDate})
                </h3>
              </div>
              <Link to="/stats" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--df-primary)', textDecoration: 'none' }}>
                Xem tất cả báo cáo ➔
              </Link>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mặt hàng</th>
                    <th style={{ textAlign: 'center' }}>ĐVT</th>
                    <th style={{ textAlign: 'right' }}>Sản lượng nhập đợt này</th>
                    <th style={{ textAlign: 'right' }}>Tổng tiền chi trả (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {!statsData.rows.length && (
                    <tr>
                      <td colSpan={4} className="table-empty">Không có dữ liệu nhập hàng trong kỳ này</td>
                    </tr>
                  )}
                  {statsData.rows.map((r) => (
                    <tr key={`${r.itemName}|${r.unit}`}>
                      <td data-label="Mặt hàng"><strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{r.itemName}</strong></td>
                      <td data-label="ĐVT" style={{ textAlign: 'center' }}>{r.unit}</td>
                      <td data-label="Sản lượng nhập" style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.02rem', color: '#15803d' }}>
                        {r.quantity} {r.unit}
                      </td>
                      <td data-label="Tổng tiền chi trả" style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.02rem', color: '#1d4ed8' }}>
                        {formatMoney(r.cost)}
                      </td>
                    </tr>
                  ))}
                  {statsData.rows.length > 0 && (
                    <tr style={{ background: '#f0fdf4', borderTop: '2px solid #22c55e', borderBottom: '2.5px solid #22c55e' }}>
                      <td colSpan={2} style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d', padding: '0.85rem' }}>
                        TỔNG CỘNG SẢN LƯỢNG KỲ NÀY
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '1.15rem', fontWeight: 800, color: '#15803d', padding: '0.85rem', background: '#dcfce7' }}>
                        {statsData.totals.quantity} cái/thùng
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '1.2rem', fontWeight: 800, color: '#1d4ed8', padding: '0.85rem', background: '#eff6ff' }}>
                        {formatMoney(statsData.totals.cost)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
