import { CalendarClock } from 'lucide-react';
import { usePayablesAging } from '../hooks/queries';
import { formatMoney } from '../utils/format';

const CASHFLOW_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  overdue: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  week1: { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c' },
  week2: { bg: '#fefce8', border: '#fef08a', color: '#a16207' },
  month: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  later: { bg: '#f8fafc', border: '#e2e8f0', color: '#475569' },
};

export default function AgingPage() {
  const { data, isLoading, isError } = usePayablesAging();

  return (
    <section className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <CalendarClock size={24} color="var(--df-primary)" />
          <h2>Tuổi nợ &amp; Dòng tiền</h2>
        </div>
        {data && (
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Tính đến {data.asOf}
          </span>
        )}
      </header>

      {isLoading && <div style={{ padding: '1.5rem' }}>Đang tải…</div>}
      {isError && <div className="form-error">Không tải được dữ liệu công nợ.</div>}

      {data && (
        <>
          {/* Dự báo dòng tiền phải trả */}
          <h3 style={{ fontSize: '0.95rem', color: '#334155', margin: '0.5rem 0 0.75rem' }}>
            💸 Dòng tiền phải trả sắp tới
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.75rem',
            }}
          >
            {data.cashflow.map((c) => {
              const s = CASHFLOW_STYLE[c.key] ?? CASHFLOW_STYLE.later;
              return (
                <div
                  key={c.key}
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    borderRadius: '12px',
                    padding: '0.9rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                    {formatMoney(c.amount)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                    {c.count} khoản
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tuổi nợ theo NCC */}
          <h3 style={{ fontSize: '0.95rem', color: '#334155', margin: '0 0 0.75rem' }}>
            📊 Tuổi nợ theo nhà cung cấp
          </h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Nhà cung cấp</th>
                  <th style={{ textAlign: 'right' }}>Chưa đến hạn</th>
                  <th style={{ textAlign: 'right' }}>Quá hạn 1–30</th>
                  <th style={{ textAlign: 'right' }}>31–60</th>
                  <th style={{ textAlign: 'right' }}>61–90</th>
                  <th style={{ textAlign: 'right' }}>&gt;90</th>
                  <th style={{ textAlign: 'right' }}>Tổng nợ</th>
                </tr>
              </thead>
              <tbody>
                {data.aging.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                      Không có công nợ đang tồn.
                    </td>
                  </tr>
                )}
                {data.aging.rows.map((r) => (
                  <tr key={r.supplierId}>
                    <td data-label="Nhà cung cấp"><strong>{r.supplierName}</strong></td>
                    <td data-label="Chưa đến hạn" style={{ textAlign: 'right' }}>{formatMoney(r.current)}</td>
                    <td data-label="Quá hạn 1–30" style={{ textAlign: 'right', color: r.d1_30 ? '#c2410c' : undefined }}>{formatMoney(r.d1_30)}</td>
                    <td data-label="31–60" style={{ textAlign: 'right', color: r.d31_60 ? '#c2410c' : undefined }}>{formatMoney(r.d31_60)}</td>
                    <td data-label="61–90" style={{ textAlign: 'right', color: r.d61_90 ? '#b91c1c' : undefined }}>{formatMoney(r.d61_90)}</td>
                    <td data-label=">90" style={{ textAlign: 'right', color: r.d90plus ? '#b91c1c' : undefined, fontWeight: r.d90plus ? 700 : undefined }}>{formatMoney(r.d90plus)}</td>
                    <td data-label="Tổng nợ" style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              {data.aging.rows.length > 0 && (
                <tfoot>
                  <tr className="order-total-row">
                    <td>Tổng cộng</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(data.aging.totals.current)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(data.aging.totals.d1_30)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(data.aging.totals.d31_60)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(data.aging.totals.d61_90)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(data.aging.totals.d90plus)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatMoney(data.aging.totals.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </section>
  );
}
