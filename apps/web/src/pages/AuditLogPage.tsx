import { useState } from 'react';
import { useAuditLogs } from '../hooks/queries';
import { formatDateTime } from '../utils/format';
import UnifiedDateFilter from '../components/UnifiedDateFilter';

const ACTIONS = [
  'LOGIN',
  'CREATE_ORDER',
  'APPROVE_ORDER',
  'REJECT_ORDER',
  'CANCEL_ORDER',
  'CREATE_RECEIPT',
  'CONFIRM_RECEIPT',
  'CREATE_PAYMENT',
  'VOID_PAYMENT',
  'CREATE_ISSUE',
  'CANCEL_ISSUE',
  'CREATE_SUPPLIER',
  'UPDATE_SUPPLIER',
  'CREATE_PRODUCT',
  'UPDATE_PRODUCT',
  'CREATE_FACILITY',
  'UPDATE_FACILITY',
  'CREATE_USER',
  'UPDATE_USER',
  'SET_PERMISSIONS',
  'UPDATE_SETTINGS',
];

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, isError } = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    ...(action ? { action } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <section className="page">
      <header className="page-header">
        <h2>Audit Log</h2>
        <div className="page-actions">
          <select
            className="search-input"
            value={action}
            onChange={(e) => resetPage(setAction)(e.target.value)}
          >
            <option value="">Tất cả hành động</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <UnifiedDateFilter
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setPage(1);
            }}
          />
        </div>
      </header>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người dùng</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="table-empty">Đang tải…</td></tr>
            )}
            {isError && (
              <tr><td colSpan={5} className="table-empty text-danger">Không tải được dữ liệu</td></tr>
            )}
            {!isLoading && !isError && !data?.data.length && (
              <tr><td colSpan={5} className="table-empty">Không có bản ghi</td></tr>
            )}
            {data?.data.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.time)}</td>
                <td>{e.userName ?? e.userId ?? 'Hệ thống'}</td>
                <td><span className="badge badge-primary">{e.action}</span></td>
                <td>{e.entityType}</td>
                <td>{e.detail ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="pagination">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Trước
          </button>
          <span>
            Trang {page}/{totalPages} · {data.total} bản ghi
          </span>
          <button
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Sau →
          </button>
        </div>
      )}
    </section>
  );
}
