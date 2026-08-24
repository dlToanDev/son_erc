import { useState } from 'react';
import { useFacilities, useStats } from '../hooks/queries';
import { downloadCsv } from '../utils/csv';
import { formatMoney } from '../utils/format';
import UnifiedFacilitySelect from '../components/UnifiedFacilitySelect';
import UnifiedDateFilter from '../components/UnifiedDateFilter';

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => `${todayStr().slice(0, 7)}-01`;

export default function StatsPage() {
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const { data: facilities = [] } = useFacilities();
  const activeFacilities = facilities.filter((f) => f.status === 'ACTIVE');
  const facilityQueryParam =
    selectedFacilityIds.length === 0 || selectedFacilityIds.length === activeFacilities.length
      ? undefined
      : selectedFacilityIds.join(',');

  const { data, isLoading } = useStats('1m', facilityQueryParam, fromDate, toDate);

  const exportCsv = () => {
    if (!data) return;
    const facilityName = selectedFacilityIds.length > 0
      ? selectedFacilityIds.map((id) => activeFacilities.find((f) => f.id === id)?.name).filter(Boolean).join(', ')
      : 'Tất cả cơ sở';
    downloadCsv(
      `thong-ke-${data.period.from}-${data.period.to}.csv`,
      ['Mặt hàng', 'ĐVT', 'Sản lượng', 'Chi phí (VND)'],
      [
        ...data.rows.map((r) => [r.itemName, r.unit, r.quantity, r.cost]),
        ['TỔNG CỘNG', facilityName, data.totals.quantity, data.totals.cost],
      ],
    );
  };

  return (
    <section className="page">
      <header className="page-header">
        <h2>Thống kê</h2>
        <div className="page-actions">
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
          <button className="btn-primary" onClick={exportCsv} disabled={!data?.rows.length}>
            ⭳ Xuất CSV
          </button>
        </div>
      </header>

      {data && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)',
          }}
        >
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e40af' }}>
            📊 THỐNG KÊ SẢN LƯỢNG & CHI PHÍ NHẬP HÀNG
          </span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '0.35rem 0.85rem', borderRadius: '8px', border: '1px solid #93c5fd' }}>
            📅 Kỳ báo cáo: {data.period.from} ➔ {data.period.to}
          </span>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table table-sticky-first">
          <thead>
            <tr>
              <th style={{ fontSize: '0.95rem' }}>Mặt hàng</th>
              <th style={{ fontSize: '0.95rem', textAlign: 'center' }}>ĐVT</th>
              <th style={{ fontSize: '0.95rem', textAlign: 'right' }}>Sản lượng nhập</th>
              <th style={{ fontSize: '0.95rem', textAlign: 'right' }}>Tổng chi phí nhập (VND)</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !data && (
              <tr><td colSpan={4} className="table-empty">Đang tải dữ liệu thống kê…</td></tr>
            )}
            {(!isLoading || data) && !data?.rows.length && (
              <tr><td colSpan={4} className="table-empty">Không có dữ liệu nhập hàng trong kỳ được chọn</td></tr>
            )}
            {data?.rows.map((r) => (
              <tr key={`${r.itemName}|${r.unit}`}>
                <td><strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{r.itemName}</strong></td>
                <td style={{ textAlign: 'center' }}>{r.unit}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: '#15803d' }}>{r.quantity}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: '#1e40af' }}>{formatMoney(r.cost)}</td>
              </tr>
            ))}
            {data && data.rows.length > 0 && (
              <tr style={{ background: '#f0fdf4', borderTop: '2.5px solid #22c55e', borderBottom: '2.5px solid #22c55e' }}>
                <td colSpan={2} style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d', padding: '1rem' }}>
                  TỔNG CỘNG THỐNG KÊ KỲ NÀY
                </td>
                <td style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: 800, color: '#15803d', padding: '1rem', background: '#dcfce7' }}>
                  {data.totals.quantity}
                </td>
                <td style={{ textAlign: 'right', fontSize: '1.3rem', fontWeight: 800, color: '#1d4ed8', padding: '1rem', background: '#eff6ff' }}>
                  {formatMoney(data.totals.cost)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
