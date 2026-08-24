import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  headerAlign?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: boolean;
  emptyText?: string;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  error,
  emptyText = 'Chưa có dữ liệu',
}: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      {/* Table view dành cho Desktop / Laptop */}
      <table className="data-table desktop-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.headerAlign ?? 'center', width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="table-empty" style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: '#64748b' }}>
                  <Loader2 size={20} className="animate-spin" color="var(--df-primary)" />
                  <span>Đang tải dữ liệu…</span>
                </div>
              </td>
            </tr>
          )}
          {(!loading || rows.length > 0) && error && (
            <tr>
              <td colSpan={columns.length} className="table-empty text-danger">
                Không tải được dữ liệu — thử tải lại trang
              </td>
            </tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyText}
              </td>
            </tr>
          )}
          {(!loading || rows.length > 0) &&
            !error &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'clickable' : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'left', width: col.width }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {/* Card List view dành cho Điện thoại (Mobile Native Feel) */}
      <div className="mobile-card-list">
        {loading && rows.length === 0 && (
          <div className="table-empty" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
          </div>
        )}
        {(!loading || rows.length > 0) && error && (
          <div className="table-empty text-danger" style={{ padding: '1.5rem', textAlign: 'center' }}>
            Không tải được dữ liệu — thử tải lại trang
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="table-empty" style={{ padding: '1.5rem', textAlign: 'center' }}>
            {emptyText}
          </div>
        )}
        {(!loading || rows.length > 0) &&
          !error &&
          rows.map((row) => {
            const actionCol = columns.find((c) => c.header === 'Thao tác' || c.header === '');
            const otherCols = columns.filter((c) => c !== actionCol);

            return (
              <div
                key={rowKey(row)}
                className={`mobile-card ${onRowClick ? 'clickable' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {otherCols.map((col, idx) => (
                  <div key={col.key} className={idx === 0 ? "card-row card-header-row" : "card-row"}>
                    <span className="card-label">{col.header}</span>
                    <span className="card-value">{col.render(row)}</span>
                  </div>
                ))}
                {actionCol && (
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    {actionCol.render(row)}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
