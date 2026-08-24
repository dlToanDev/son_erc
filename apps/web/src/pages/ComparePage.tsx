import { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Scale, FileText, PieChart as PieChartIcon, BarChart2 } from 'lucide-react';
import { useCompare, useFacilities } from '../hooks/queries';
import { formatMoney } from '../utils/format';
import UnifiedFacilitySelect from '../components/UnifiedFacilitySelect';
import UnifiedDateFilter from '../components/UnifiedDateFilter';
import PieChart from '../components/PieChart';

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const monthEnd = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
const prevMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 15));

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return <span style={{ color: '#94a3b8', fontWeight: 600 }}>—</span>;
  const isUp = change > 0;
  const isZero = change === 0;

  if (isZero) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.2rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '6px',
          fontSize: '0.82rem',
          fontWeight: 700,
          background: '#f1f5f9',
          color: '#475569',
        }}
      >
        0%
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.65rem',
        borderRadius: '6px',
        fontSize: '0.85rem',
        fontWeight: 700,
        background: isUp ? '#fef2f2' : '#f0fdf4',
        color: isUp ? '#dc2626' : '#16a34a',
        border: `1px solid ${isUp ? '#fca5a5' : '#86efac'}`,
      }}
    >
      {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {isUp ? `+${change}%` : `${change}%`}
    </span>
  );
}

// Side-by-side Comparative Bar Chart (SVG)
function ComparisonBarChart({ rows }: { rows: Array<{ itemName: string; unit: string; costA: number; costB: number }> }) {
  const topRows = useMemo(() => {
    return [...rows].sort((a, b) => Math.max(b.costA, b.costB) - Math.max(a.costA, a.costB)).slice(0, 8);
  }, [rows]);

  if (!topRows.length) return null;
  const maxVal = Math.max(...topRows.flatMap((r) => [r.costA, r.costB]), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {topRows.map((r) => {
        const pctA = Math.round((r.costA / maxVal) * 100);
        const pctB = Math.round((r.costB / maxVal) * 100);
        const diff = r.costB - r.costA;

        return (
          <div key={`${r.itemName}|${r.unit}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600 }}>
              <span style={{ color: '#1e293b' }}>
                {r.itemName} <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>({r.unit})</span>
              </span>
              <span style={{ fontSize: '0.82rem', color: diff > 0 ? '#dc2626' : diff < 0 ? '#16a34a' : '#64748b' }}>
                {diff > 0 ? `Tăng +${formatMoney(diff)}` : diff < 0 ? `Giảm ${formatMoney(Math.abs(diff))}` : 'Không đổi'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {/* Bar A */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ width: 45, fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>Kỳ A</span>
                <div style={{ flex: 1, background: '#f1f5f9', height: 14, borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      width: `${Math.max(pctA, 1)}%`,
                      height: '100%',
                      background: '#3b82f6',
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ width: 110, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                  {formatMoney(r.costA)}
                </span>
              </div>
              {/* Bar B */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ width: 45, fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>Kỳ B</span>
                <div style={{ flex: 1, background: '#f1f5f9', height: 14, borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      width: `${Math.max(pctB, 1)}%`,
                      height: '100%',
                      background: diff > 0 ? '#ef4444' : '#10b981',
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ width: 110, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: diff > 0 ? '#dc2626' : '#047857' }}>
                  {formatMoney(r.costB)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Side-by-side Dual Pie/Donut Chart Section
function ComparisonPieCharts({ rows }: { rows: Array<{ itemName: string; unit: string; costA: number; costB: number }> }) {
  const pieDataA = useMemo(() => {
    return rows
      .filter((r) => r.costA > 0)
      .map((r) => ({ label: `${r.itemName} (${r.unit})`, value: r.costA }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const pieDataB = useMemo(() => {
    return rows
      .filter((r) => r.costB > 0)
      .map((r) => ({ label: `${r.itemName} (${r.unit})`, value: r.costB }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.25rem' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e40af', textAlign: 'center' }}>
          🔵 Cơ cấu chi phí Kỳ A (Gốc)
        </h4>
        {pieDataA.length > 0 ? (
          <PieChart data={pieDataA} size={200} formatValue={formatMoney} />
        ) : (
          <p className="placeholder" style={{ textAlign: 'center', padding: '2rem 0' }}>Không có dữ liệu chi phí Kỳ A</p>
        )}
      </div>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem 1.25rem' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#166534', textAlign: 'center' }}>
          🟢 Cơ cấu chi phí Kỳ B (So sánh)
        </h4>
        {pieDataB.length > 0 ? (
          <PieChart data={pieDataB} size={200} formatValue={formatMoney} />
        ) : (
          <p className="placeholder" style={{ textAlign: 'center', padding: '2rem 0' }}>Không có dữ liệu chi phí Kỳ B</p>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const { data: facilities = [] } = useFacilities();
  const activeFacilities = facilities.filter((f) => f.status === 'ACTIVE');
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [fromA, setFromA] = useState(iso(monthStart(prevMonth)));
  const [toA, setToA] = useState(iso(monthEnd(prevMonth)));
  const [fromB, setFromB] = useState(iso(monthStart(today)));
  const [toB, setToB] = useState(iso(monthEnd(today)));

  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  const facilityQueryParam =
    selectedFacilityIds.length === 0 || selectedFacilityIds.length === activeFacilities.length
      ? undefined
      : selectedFacilityIds.join(',');

  const { data, isLoading } = useCompare({ fromA, toA, fromB, toB }, facilityQueryParam);

  // Tính toán chỉ số tổng quan
  const stats = useMemo(() => {
    if (!data) return null;
    const costA = data.totals.costA;
    const costB = data.totals.costB;
    const diffCost = costB - costA;
    const pctChange = data.totals.change;

    let maxIncreaseItem = null;
    let maxDecreaseItem = null;
    for (const r of data.rows) {
      const diff = r.costB - r.costA;
      if (diff > 0 && (!maxIncreaseItem || diff > (maxIncreaseItem.costB - maxIncreaseItem.costA))) {
        maxIncreaseItem = r;
      }
      if (diff < 0 && (!maxDecreaseItem || diff < (maxDecreaseItem.costB - maxDecreaseItem.costA))) {
        maxDecreaseItem = r;
      }
    }

    return {
      costA,
      costB,
      diffCost,
      pctChange,
      maxIncreaseItem,
      maxDecreaseItem,
    };
  }, [data]);

  return (
    <section className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Scale size={24} color="var(--df-primary)" />
          <h2>So sánh chi phí giữa 2 kỳ</h2>
        </div>
        <UnifiedFacilitySelect
          facilities={facilities}
          selectedIds={selectedFacilityIds}
          onChange={setSelectedFacilityIds}
        />
      </header>

      {/* Điều khiển khoảng thời gian 2 kỳ (Hàng ngang song song) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <fieldset style={{ border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.85rem 1rem', background: '#eff6ff' }}>
          <legend style={{ padding: '0 0.5rem', fontWeight: 700, color: '#1e40af', fontSize: '0.9rem' }}>
            🔵 Kỳ A (Kỳ Gốc làm chuẩn)
          </legend>
          <UnifiedDateFilter from={fromA} to={toA} onChange={(f, t) => { setFromA(f); setToA(t); }} />
        </fieldset>
        <fieldset style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.85rem 1rem', background: '#f0fdf4' }}>
          <legend style={{ padding: '0 0.5rem', fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>
            🟢 Kỳ B (Kỳ So sánh)
          </legend>
          <UnifiedDateFilter from={fromB} to={toB} onChange={(f, t) => { setFromB(f); setToB(t); }} />
        </fieldset>
      </div>

      {/* KPI Cards Tóm tắt */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>TỔNG CHI PHÍ KỲ A (GỐC)</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginTop: '0.3rem' }}>
              {formatMoney(stats.costA)}
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📅 Từ {fromA} ➔ {toA}</span>
          </div>

          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>TỔNG CHI PHÍ KỲ B (SO SÁNH)</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stats.diffCost > 0 ? '#dc2626' : '#047857', marginTop: '0.3rem' }}>
              {formatMoney(stats.costB)}
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📅 Từ {fromB} ➔ {toB}</span>
          </div>

          <div
            style={{
              background: stats.diffCost > 0 ? '#fff5f5' : '#f0fdf4',
              border: `1px solid ${stats.diffCost > 0 ? '#fca5a5' : '#86efac'}`,
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: stats.diffCost > 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
              CHÊNH LỆCH CHI PHÍ (KỲ B VS KỲ A)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: stats.diffCost > 0 ? '#dc2626' : '#16a34a' }}>
                {stats.diffCost > 0 ? `+${formatMoney(stats.diffCost)}` : formatMoney(stats.diffCost)}
              </span>
              <ChangeBadge change={stats.pctChange} />
            </div>
            <span style={{ fontSize: '0.8rem', color: stats.diffCost > 0 ? '#991b1b' : '#166534', fontWeight: 600 }}>
              {stats.diffCost > 0 ? 'Chi phí nhập hàng Kỳ B cao hơn Kỳ A' : stats.diffCost < 0 ? 'Chi phí nhập hàng Kỳ B tiết kiệm hơn Kỳ A' : 'Chi phí nhập hàng 2 kỳ bằng nhau'}
            </span>
          </div>
        </div>
      )}

      {/* Khung Biểu đồ So sánh Trực quan (Bánh tròn / Cột) */}
      {data && data.rows.length > 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={20} color="var(--df-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Phân tích biểu đồ so sánh chi phí
              </h3>
            </div>

            {/* Nút chuyển đổi dạng biểu đồ (Bánh tròn / Cột) */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <button
                type="button"
                onClick={() => setChartType('pie')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: chartType === 'pie' ? '#fff' : 'transparent',
                  color: chartType === 'pie' ? 'var(--df-primary)' : '#64748b',
                  boxShadow: chartType === 'pie' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <PieChartIcon size={15} />
                <span>Biểu đồ Bánh Tròn (Pie Chart)</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: chartType === 'bar' ? '#fff' : 'transparent',
                  color: chartType === 'bar' ? 'var(--df-primary)' : '#64748b',
                  boxShadow: chartType === 'bar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <BarChart2 size={15} />
                <span>Biểu đồ Cột (Bar Chart)</span>
              </button>
            </div>
          </div>

          {chartType === 'pie' ? (
            <ComparisonPieCharts rows={data.rows} />
          ) : (
            <ComparisonBarChart rows={data.rows} />
          )}
        </div>
      )}

      {/* Bảng dữ liệu chi tiết */}
      <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ fontSize: '0.92rem' }}>Mặt hàng</th>
              <th rowSpan={2} style={{ fontSize: '0.92rem', textAlign: 'center' }}>ĐVT</th>
              <th colSpan={2} style={{ textAlign: 'center', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: '0.92rem', color: '#1e40af' }}>
                Kỳ A (Gốc)
              </th>
              <th colSpan={2} style={{ textAlign: 'center', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', fontSize: '0.92rem', color: '#166534' }}>
                Kỳ B (So sánh)
              </th>
              <th rowSpan={2} style={{ textAlign: 'right', fontSize: '0.92rem' }}>Biến động chi phí B vs A</th>
            </tr>
            <tr>
              <th style={{ textAlign: 'right', background: '#eff6ff' }}>SL</th>
              <th style={{ textAlign: 'right', background: '#eff6ff' }}>Chi phí</th>
              <th style={{ textAlign: 'right', background: '#f0fdf4' }}>SL</th>
              <th style={{ textAlign: 'right', background: '#f0fdf4' }}>Chi phí</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !data && (
              <tr><td colSpan={7} className="table-empty">Đang tính toán so sánh dữ liệu…</td></tr>
            )}
            {(!isLoading || data) && !data?.rows.length && (
              <tr><td colSpan={7} className="table-empty">Không tìm thấy dữ liệu phát sinh ở cả 2 kỳ</td></tr>
            )}
            {data?.rows.map((r) => {
              const diff = r.costB - r.costA;
              return (
                <tr key={`${r.itemName}|${r.unit}`}>
                  <td><strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{r.itemName}</strong></td>
                  <td style={{ textAlign: 'center' }}>{r.unit}</td>
                  <td style={{ textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>{r.quantityA}</td>
                  <td style={{ textAlign: 'right', color: '#1d4ed8', fontWeight: 700 }}>{formatMoney(r.costA)}</td>
                  <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{r.quantityB}</td>
                  <td style={{ textAlign: 'right', color: diff > 0 ? '#dc2626' : '#047857', fontWeight: 700 }}>
                    {formatMoney(r.costB)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ChangeBadge change={r.costChange} />
                  </td>
                </tr>
              );
            })}
            {data && data.rows.length > 0 && (
              <tr style={{ background: '#f8fafc', borderTop: '2.5px solid #0f172a', borderBottom: '2.5px solid #0f172a' }}>
                <td colSpan={2} style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', padding: '0.9rem' }}>
                  TỔNG CỘNG SO SÁNH 2 KỲ
                </td>
                <td colSpan={2} style={{ textAlign: 'right', fontSize: '1.15rem', fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', padding: '0.9rem' }}>
                  {formatMoney(data.totals.costA)}
                </td>
                <td colSpan={2} style={{ textAlign: 'right', fontSize: '1.15rem', fontWeight: 800, color: stats && stats.diffCost > 0 ? '#dc2626' : '#047857', background: '#f0fdf4', padding: '0.9rem' }}>
                  {formatMoney(data.totals.costB)}
                </td>
                <td style={{ textAlign: 'right', padding: '0.9rem' }}>
                  <ChangeBadge change={data.totals.change} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Báo cáo Phân tích Chi tiết ở cuối trang */}
      {stats && data && data.rows.length > 0 && (
        <div
          style={{
            background: stats.diffCost > 0 ? '#fff5f5' : '#f0fdf4',
            border: `1.5px solid ${stats.diffCost > 0 ? '#fca5a5' : '#86efac'}`,
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <FileText size={20} color={stats.diffCost > 0 ? '#dc2626' : '#16a34a'} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: stats.diffCost > 0 ? '#991b1b' : '#14532d' }}>
              BÁO CÁO PHÂN TÍCH BIẾN ĐỘNG CHI PHÍ HỆ THỐNG
            </h3>
          </div>

          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.95rem', lineHeight: '1.5', color: '#1e293b' }}>
            Trong khoảng thời gian Kỳ B (<strong>{fromB} ➔ {toB}</strong>) so với Kỳ A (<strong>{fromA} ➔ {toA}</strong>), tổng chi phí nhập hàng{' '}
            {stats.diffCost > 0 ? (
              <span style={{ color: '#dc2626', fontWeight: 800 }}>
                TĂNG THÊM {formatMoney(stats.diffCost)} (+{stats.pctChange}%)
              </span>
            ) : stats.diffCost < 0 ? (
              <span style={{ color: '#16a34a', fontWeight: 800 }}>
                TIẾT KIỆM ĐƯỢC {formatMoney(Math.abs(stats.diffCost))} ({stats.pctChange}%)
              </span>
            ) : (
              <span style={{ color: '#475569', fontWeight: 800 }}>GIỮ NGUYÊN KHÔNG ĐỔI</span>
            )}
            .
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', fontSize: '0.9rem', color: '#334155' }}>
            {stats.maxIncreaseItem && (
              <div>
                🔴 <strong>Mặt hàng tăng chi phí mạnh nhất:</strong>{' '}
                <span style={{ fontWeight: 700, color: '#dc2626' }}>{stats.maxIncreaseItem.itemName}</span> (Tăng +
                {formatMoney(stats.maxIncreaseItem.costB - stats.maxIncreaseItem.costA)}, tương ứng +
                {stats.maxIncreaseItem.costChange}%)
              </div>
            )}
            {stats.maxDecreaseItem && (
              <div>
                🟢 <strong>Mặt hàng giảm chi phí nhiều nhất:</strong>{' '}
                <span style={{ fontWeight: 700, color: '#16a34a' }}>{stats.maxDecreaseItem.itemName}</span> (Cắt giảm{' '}
                {formatMoney(Math.abs(stats.maxDecreaseItem.costB - stats.maxDecreaseItem.costA))}, tương ứng{' '}
                {stats.maxDecreaseItem.costChange}%)
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
