import { FormEvent, useMemo, useState } from 'react';
import type { InventoryReportRow, IssueData, ShortageInfo } from '@debtflow/shared';
import { Calculator, Eye, Pencil, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { checkIssue } from '../api/inventory';
import {
  useFacilities,
  useInventoryReport,
  useIssueMutations,
  useIssues,
  useStockCard,
} from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatDateTime } from '../utils/format';
import UnifiedFacilitySelect from '../components/UnifiedFacilitySelect';
import UnifiedDateFilter from '../components/UnifiedDateFilter';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

interface DraftLine {
  itemName: string;
  unit: string;
  quantity: string;
}

export default function InventoryPage() {
  const can = useAuthStore((s) => s.can);
  const { data: facilities = [] } = useFacilities();
  const activeFacilities = facilities.filter((f) => f.status === 'ACTIVE');

  const [tab, setTab] = useState<'report' | 'issues'>('report');
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const facilityQueryParam =
    selectedFacilityIds.length === 0 || selectedFacilityIds.length === activeFacilities.length
      ? undefined
      : selectedFacilityIds.join(',');

  const selectedFacility = selectedFacilityIds[0] || activeFacilities[0]?.id || '';
  const { data: report, isLoading } = useInventoryReport(from, to, facilityQueryParam);
  const { data: issues = [] } = useIssues({ facilityId: facilityQueryParam });
  const { create, cancel } = useIssueMutations();

  // ---- Thẻ kho ----
  const [cardItem, setCardItem] = useState<InventoryReportRow | null>(null);
  const { data: card } = useStockCard(
    cardItem
      ? { facilityId: selectedFacility, itemName: cardItem.itemName, unit: cardItem.unit, from, to }
      : null,
  );

  // ---- Lập phiếu xuất ----
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(today());
  const [issueNote, setIssueNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ itemName: '', unit: '', quantity: '' }]);
  const [shortages, setShortages] = useState<ShortageInfo[]>([]);
  const [error, setError] = useState('');
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<IssueData | null>(null);
  const [issueToCancel, setIssueToCancel] = useState<IssueData | null>(null);
  const [issueToEdit, setIssueToEdit] = useState<IssueData | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editItems, setEditItems] = useState<{ itemName: string; unit: string; initialStock: number; remainingStock: string }[]>([]);

  const openEditIssue = (issue: IssueData) => {
    setIssueToEdit(issue);
    setEditDate(issue.issueDate.slice(0, 10));
    setEditNote(issue.note ?? '');

    const mapped = issue.items.map((it) => {
      const key = `${it.itemName.trim().toLowerCase()}|${(it.unit || '').trim().toLowerCase()}`;
      const currentClosing = stockMap.get(key) ?? 0;
      const initialStock = currentClosing + (issue.status === 'ACTIVE' ? it.quantity : 0);
      const currentRemaining = currentClosing;
      return {
        itemName: it.itemName,
        unit: it.unit,
        initialStock,
        remainingStock: String(currentRemaining),
      };
    });

    setEditItems(mapped);
  };

  const { update } = useIssueMutations();

  // ---- Kiểm kê Tồn còn lại (Tự động tính Xuất) ----
  const [quickCountOpen, setQuickCountOpen] = useState(false);
  const [quickFrom, setQuickFrom] = useState(monthStart());
  const [quickTo, setQuickTo] = useState(today());
  const [quickCounts, setQuickCounts] = useState<Record<string, string>>({});
  const [quickNote, setQuickNote] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const { data: quickReport } = useInventoryReport(quickFrom, quickTo, selectedFacility || undefined);
  const activeReport = quickCountOpen ? (quickReport ?? report) : report;

  const openQuickCount = () => {
    setQuickFrom(from);
    setQuickTo(to);
    const initial: Record<string, string> = {};
    (report?.rows ?? []).forEach((r) => {
      initial[r.key] = String(r.closingQty);
    });
    setQuickCounts(initial);
    setQuickNote(`Xuất kho đợt từ ngày ${from} đến ngày ${to}`);
    setQuickCountOpen(true);
  };

  const handleQuickCountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setQuickSubmitting(true);
    try {
      const itemsToIssue: { itemName: string; unit: string; quantity: number }[] = [];
      (activeReport?.rows ?? []).forEach((r) => {
        const remainingInput = quickCounts[r.key];
        const remainingQty = remainingInput !== undefined && remainingInput !== '' ? Number(remainingInput) : r.closingQty;
        const issueQty = Math.max(0, r.closingQty - remainingQty);
        if (issueQty > 0) {
          itemsToIssue.push({
            itemName: r.itemName,
            unit: r.unit,
            quantity: issueQty,
          });
        }
      });

      if (itemsToIssue.length === 0) {
        alert('Không có mặt hàng nào có số lượng xuất (Tồn thực tế = Tồn hệ thống).');
        setQuickSubmitting(false);
        return;
      }

      await create.mutateAsync({
        facilityId: selectedFacility,
        issueDate: quickTo,
        note: quickNote || `Xuất kho đợt từ ngày ${quickFrom} đến ngày ${quickTo}`,
        items: itemsToIssue,
      });

      setQuickCountOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Tự động tạo phiếu xuất thất bại');
    } finally {
      setQuickSubmitting(false);
    }
  };

  // Tồn khả dụng hiện tại (đến hôm nay) để chọn mặt hàng.
  const availableRows = useMemo(
    () => (report?.rows ?? []).filter((r) => r.closingQty > 0),
    [report],
  );

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickItem = (i: number, key: string) => {
    const row = availableRows.find((r) => r.key === key);
    if (row) setLine(i, { itemName: row.itemName, unit: row.unit });
  };

  const openIssue = () => {
    setIssueDate(today());
    setIssueNote('');
    setLines([{ itemName: '', unit: '', quantity: '' }]);
    setShortages([]);
    setError('');
    setIssueOpen(true);
  };

  const buildItems = () =>
    lines
      .filter((l) => l.itemName && Number(l.quantity) > 0)
      .map((l) => ({ itemName: l.itemName, unit: l.unit, quantity: Number(l.quantity) }));

  const onSubmitIssue = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setShortages([]);
    const items = buildItems();
    if (!items.length) {
      setError('Phiếu xuất phải có ít nhất 1 dòng hợp lệ');
      return;
    }
    try {
      // CHẶN TRÊN UI: kiểm tra tồn trước, hiện thiếu hụt rõ ràng.
      const check = await checkIssue({ facilityId: selectedFacility, issueDate, items });
      if (!check.ok) {
        setShortages(check.shortages);
        return;
      }
      // Server vẫn kiểm lại lần cuối trong transaction.
      await create.mutateAsync({
        facilityId: selectedFacility,
        issueDate,
        ...(issueNote ? { note: issueNote } : {}),
        items,
      });
      setIssueOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lập phiếu thất bại');
    }
  };

  // Stock lookup map for 3 stock columns calculation
  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    (report?.rows ?? []).forEach((r) => {
      map.set(`${r.itemName.trim().toLowerCase()}|${(r.unit || '').trim().toLowerCase()}`, r.closingQty);
    });
    return map;
  }, [report]);

  return (
    <section className="page">
      <header className="page-header">
        <h2>Kho Nhập–Xuất–Tồn</h2>
        <div className="page-actions">
          <UnifiedFacilitySelect
            facilities={facilities}
            selectedIds={selectedFacilityIds}
            onChange={setSelectedFacilityIds}
          />
          <UnifiedDateFilter
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
          />
          {can('inventory', 'edit') && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={openQuickCount}
                style={{
                  background: '#2563eb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                }}
              >
                <Calculator size={16} />
                <span>⚡ Nhập Tồn còn lại (Tự tính Xuất)</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={openIssue}
                style={{ border: '1px solid #cbd5e1', background: '#fff' }}
              >
                + Lập phiếu xuất thủ công
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="tabs">
        <button className={tab === 'report' ? 'tab active' : 'tab'} onClick={() => setTab('report')}>
          Báo cáo NXT
        </button>
        <button className={tab === 'issues' ? 'tab active' : 'tab'} onClick={() => setTab('issues')}>
          Phiếu xuất ({issues.length})
        </button>
      </div>

      {tab === 'report' && (
        <>
          <div className="table-wrap">
            <table className="data-table table-sticky-first">
              <thead>
                <tr>
                  <th>Mặt hàng</th>
                  <th>ĐVT</th>
                  <th style={{ textAlign: 'right' }}>Tồn đầu</th>
                  <th style={{ textAlign: 'right' }}>Nhập</th>
                  <th style={{ textAlign: 'right' }}>Xuất</th>
                  <th style={{ textAlign: 'right' }}>Tồn cuối</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !report && (
                  <tr><td colSpan={6} className="table-empty">Đang tải…</td></tr>
                )}
                {(!isLoading || report) && !report?.rows.length && (
                  <tr><td colSpan={6} className="table-empty">Không có chuyển động kho trong kỳ</td></tr>
                )}
                {report?.rows.map((row) => (
                  <tr key={row.key} className="clickable" onClick={() => setCardItem(row)}>
                    <td>{row.itemName}</td>
                    <td>{row.unit}</td>
                    <td style={{ textAlign: 'right' }}>{row.openingQty}</td>
                    <td style={{ textAlign: 'right' }}>{row.receivedQty}</td>
                    <td style={{ textAlign: 'right' }}>{row.issuedQty}</td>
                    <td style={{ textAlign: 'right' }}><strong>{row.closingQty}</strong></td>
                  </tr>
                ))}
                {report && report.rows.length > 0 && (
                  <tr className="order-total-row">
                    <td colSpan={2}>Tổng cộng</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.openingQty}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.receivedQty}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.issuedQty}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.closingQty}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="placeholder">Bấm vào từng dòng để xem thẻ kho.</p>
        </>
      )}

      {tab === 'issues' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã phiếu xuất</th>
                <th>Ngày xuất kho</th>
                <th>Danh sách mặt hàng xuất</th>
                <th>Ghi chú kho</th>
                <th style={{ textAlign: 'center' }}>Trạng thái</th>
                <th style={{ textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!issues.length && (
                <tr><td colSpan={6} className="table-empty">Chưa có phiếu xuất kho nào</td></tr>
              )}
              {issues.map((issue: IssueData) => (
                <tr key={issue.id} className="clickable" onClick={() => setSelectedIssueDetail(issue)}>
                  <td><strong style={{ color: 'var(--df-primary)', fontSize: '0.95rem' }}>{issue.issueCode}</strong></td>
                  <td>{formatDateTime(issue.issueDate)}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {issue.items.map((it, idx) => (
                        <span key={idx} style={{ fontSize: '0.85rem' }}>
                          • <strong>{it.itemName}</strong> × <strong style={{ color: '#16a34a' }}>{it.quantity}</strong> {it.unit}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{issue.note ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {issue.status === 'ACTIVE' ? (
                      <span className="badge badge-success">Hiệu lực</span>
                    ) : (
                      <span className="badge badge-muted">Đã huỷ</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <div className="btn-action-group">
                      <button
                        type="button"
                        className="btn-action-view"
                        onClick={() => setSelectedIssueDetail(issue)}
                      >
                        <Eye size={13} />
                        <span>Chi tiết</span>
                      </button>
                      {issue.status === 'ACTIVE' && can('inventory', 'edit') && (
                        <>
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => openEditIssue(issue)}
                          >
                            <Pencil size={13} />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => setIssueToCancel(issue)}
                            disabled={cancel.isPending}
                          >
                            <Trash2 size={13} />
                            <span>Hủy</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Thẻ kho */}
      <Modal
        title={card ? `Thẻ kho — ${card.itemName} (${card.unit})` : 'Thẻ kho'}
        open={!!cardItem}
        onClose={() => setCardItem(null)}
      >
        {card && (
          <div className="table-wrap">
          <table className="data-table table-sticky-first">
            <thead>
              <tr>
                <th>Ngày</th><th>Chứng từ</th><th>Loại</th>
                <th style={{ textAlign: 'right' }}>SL</th>
                <th style={{ textAlign: 'right' }}>Tồn</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4}>Tồn đầu kỳ ({from})</td>
                <td style={{ textAlign: 'right' }}><strong>{card.openingQty}</strong></td>
              </tr>
              {card.entries.map((e, i) => (
                <tr key={i}>
                  <td>{e.date}</td>
                  <td>{e.code}</td>
                  <td>
                    {e.type === 'NHAP' ? (
                      <span className="badge badge-success">Nhập</span>
                    ) : (
                      <span className="badge badge-warning">Xuất</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {e.type === 'NHAP' ? '+' : '−'}
                    {e.quantity}
                  </td>
                  <td style={{ textAlign: 'right' }}>{e.balance}</td>
                </tr>
              ))}
              <tr className="order-total-row">
                <td colSpan={4}>Tồn cuối kỳ ({to})</td>
                <td style={{ textAlign: 'right' }}><strong>{card.closingQty}</strong></td>
              </tr>
            </tbody>
          </table>
          </div>
        )}
      </Modal>

      {/* Lập phiếu xuất */}
      <Modal title="Lập phiếu xuất kho" open={issueOpen} onClose={() => setIssueOpen(false)}>
        <form className="form-grid" onSubmit={onSubmitIssue}>
          <label>
            Ngày xuất *
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          </label>
          <label>
            Ghi chú
            <input value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
          </label>

          <div className="span-2">
            <strong>Mặt hàng xuất</strong> (tồn khả dụng trong kỳ đang xem)
            {lines.map((line, i) => {
              const row = availableRows.find(
                (r) => r.itemName === line.itemName && r.unit === line.unit,
              );
              return (
                <div key={i} className="order-line">
                  <select
                    value={row?.key ?? ''}
                    onChange={(e) => pickItem(i, e.target.value)}
                  >
                    <option value="">— Chọn mặt hàng —</option>
                    {availableRows.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.itemName} ({r.unit}) — tồn {r.closingQty}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    placeholder="SL"
                    value={line.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                  />
                  <span className="order-line-price">{row ? `tồn ${row.closingQty}` : '—'}</span>
                  <span
                    className={
                      row && Number(line.quantity) > row.closingQty
                        ? 'order-line-total text-danger'
                        : 'order-line-total'
                    }
                  >
                    {row && Number(line.quantity) > row.closingQty ? 'VƯỢT TỒN' : ''}
                  </span>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                  >
                    Xoá
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="btn-link"
              onClick={() => setLines((prev) => [...prev, { itemName: '', unit: '', quantity: '' }])}
            >
              + Thêm dòng
            </button>
          </div>

          {shortages.length > 0 && (
            <div className="form-error span-2">
              Xuất vượt tồn khả dụng:
              <ul style={{ margin: '0.25rem 0 0 1rem' }}>
                {shortages.map((s) => (
                  <li key={s.key}>
                    {s.itemName} ({s.unit}): cần {s.requestedQty}, khả dụng {s.availableQty}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <div className="form-error span-2">{error}</div>}
          <div className="form-actions span-2">
            <button type="button" className="btn-ghost" onClick={() => setIssueOpen(false)}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              Xuất kho
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Kiểm Kê Tồn Thực Tế & Tự Động Tính Phiếu Xuất */}
      <Modal
        title="⚡ Kiểm kê Tồn thực tế & Tự động tạo Phiếu xuất"
        open={quickCountOpen}
        onClose={() => setQuickCountOpen(false)}
        size="xl"
      >
        <form onSubmit={handleQuickCountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.85rem 1.1rem', borderRadius: '10px', fontSize: '0.88rem', color: '#1e40af', lineHeight: 1.5 }}>
            💡 <strong>Hướng dẫn:</strong> Thay vì viết phiếu xuất từng dòng, bạn chỉ cần <strong>nhập số lượng còn lại thực tế</strong> của từng mặt hàng tại cửa hàng/cơ sở đang chọn (<em>{activeFacilities.find((f) => f.id === selectedFacility)?.name || 'Cơ sở'}</em>).
            Hệ thống sẽ <strong>tự động tính toán lượng Xuất = (Tồn hệ thống - Tồn còn lại)</strong> và khởi tạo phiếu xuất kho ngay lập tức!
          </div>

          {/* Chọn Khoảng thời gian Đợt xuất kho (Từ ngày ... đến ngày ...) */}
          <div
            style={{
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'center',
              background: '#f8fafc',
              padding: '0.85rem 1.1rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
            }}
          >
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              📅 ĐỢT KIỂM KÊ & XUẤT KHO:
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>Từ ngày:</span>
              <input
                type="date"
                value={quickFrom}
                onChange={(e) => {
                  setQuickFrom(e.target.value);
                  setQuickNote(`Xuất kho đợt từ ngày ${e.target.value} đến ngày ${quickTo}`);
                }}
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.92rem', fontWeight: 700, color: '#1e40af', background: '#fff' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>Đến ngày:</span>
              <input
                type="date"
                value={quickTo}
                onChange={(e) => {
                  setQuickTo(e.target.value);
                  setQuickNote(`Xuất kho đợt từ ngày ${quickFrom} đến ngày ${e.target.value}`);
                }}
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.92rem', fontWeight: 700, color: '#1e40af', background: '#fff' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              📦 DANH SÁCH MẶT HÀNG TỒN KHO ({report?.rows.length ?? 0} MẶT HÀNG):
            </span>
          </div>

          <div className="table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                  <th>Mặt hàng</th>
                  <th style={{ textAlign: 'center' }}>ĐVT</th>
                  <th style={{ textAlign: 'right' }}>Tồn kho hệ thống</th>
                  <th style={{ textAlign: 'center', width: '180px' }}>Số còn lại thực tế (Nhập vào)</th>
                  <th style={{ textAlign: 'right', width: '160px' }}>Số lượng XUẤT (Tự tính)</th>
                </tr>
              </thead>
              <tbody>
                {!report?.rows.length ? (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      Không có sản phẩm nào trong kỳ báo cáo kho
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, idx) => {
                    const rawVal = quickCounts[row.key];
                    const remainVal = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : row.closingQty;
                    const issueQty = Math.max(0, row.closingQty - remainVal);
                    const isExcess = remainVal > row.closingQty;

                    return (
                      <tr key={row.key} style={{ background: issueQty > 0 ? '#f0fdf4' : isExcess ? '#fff7ed' : undefined }}>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td>
                          <strong>{row.itemName}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>{row.unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                          {row.closingQty}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={rawVal ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQuickCounts((prev) => ({ ...prev, [row.key]: val }));
                            }}
                            placeholder={String(row.closingQty)}
                            style={{
                              width: '120px',
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '1rem',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '6px',
                              border: issueQty > 0 ? '2px solid #22c55e' : '1px solid #cbd5e1',
                              background: issueQty > 0 ? '#fff' : '#f8fafc',
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {issueQty > 0 ? (
                            <strong style={{ color: '#15803d', fontSize: '1.05rem', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #86efac' }}>
                              Xuất {issueQty}
                            </strong>
                          ) : isExcess ? (
                            <span style={{ color: '#c2410c', fontSize: '0.8rem', fontWeight: 600 }}>
                              Tồn thực tế lớn hơn hệ thống (+{remainVal - row.closingQty})
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <label>
            Ghi chú đợt kiểm kê / tự động xuất kho
            <input
              type="text"
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Ví dụ: Xuất kho tự động theo số lượng tồn còn lại ca tối..."
              style={{ fontSize: '0.9rem' }}
            />
          </label>

          {/* Dynamic Summary Cards */}
          {(() => {
            let totalItemTypesCount = 0;
            let totalQtyCount = 0;
            (report?.rows ?? []).forEach((r) => {
              const rawVal = quickCounts[r.key];
              const remainVal = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : r.closingQty;
              const issueQty = Math.max(0, r.closingQty - remainVal);
              if (issueQty > 0) {
                totalItemTypesCount++;
                totalQtyCount += issueQty;
              }
            });

            return (
              <div
                style={{
                  background: totalItemTypesCount > 0 ? '#f0fdf4' : '#f8fafc',
                  border: totalItemTypesCount > 0 ? '1px solid #86efac' : '1px solid #e2e8f0',
                  padding: '0.85rem 1.2rem',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.82rem', color: '#475569', display: 'block' }}>TỔNG CỘNG XUẤT TỰ ĐỘNG TẠO</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: totalItemTypesCount > 0 ? '#15803d' : '#64748b' }}>
                    Phát sinh xuất: <strong>{totalItemTypesCount} mặt hàng</strong>
                  </span>
                </div>
                <strong style={{ fontSize: '1.4rem', color: totalItemTypesCount > 0 ? '#16a34a' : '#94a3b8' }}>
                  Tổng xuất: {totalQtyCount} sản phẩm
                </strong>
              </div>
            );
          })()}

          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setQuickCountOpen(false)}>
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={quickSubmitting}
              style={{ background: '#2563eb', padding: '0.5rem 1.25rem' }}
            >
              {quickSubmitting ? 'Đang tạo phiếu xuất…' : '⚡ Xác nhận & Tự động tạo Phiếu xuất'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Xem Chi Tiết Phiếu Xuất Kho */}
      <Modal
        title={`Chi tiết Phiếu xuất kho #${selectedIssueDetail?.issueCode ?? ''}`}
        open={!!selectedIssueDetail}
        onClose={() => setSelectedIssueDetail(null)}
        size="xl"
      >
        {selectedIssueDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.8rem 1.2rem',
                fontSize: '0.9rem',
                background: '#f8fafc',
                padding: '1rem 1.2rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📄 Mã phiếu xuất:</span>
                <strong style={{ color: 'var(--df-primary)', fontSize: '1.05rem' }}>{selectedIssueDetail.issueCode}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>Trạng thái phiếu:</span>
                {selectedIssueDetail.status === 'ACTIVE' ? (
                  <span className="badge badge-success">Hiệu lực</span>
                ) : (
                  <span className="badge badge-muted">Đã huỷ</span>
                )}
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>🏢 Cơ sở kho:</span>
                <strong style={{ color: '#0f172a' }}>{selectedIssueDetail.facilityName || 'Cơ sở'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📅 Ngày xuất kho:</span>
                <strong style={{ color: '#0f172a' }}>{formatDateTime(selectedIssueDetail.issueDate)}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>👤 Người lập phiếu:</span>
                <strong style={{ color: '#0f172a' }}>{selectedIssueDetail.createdBy || 'Admin'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>⏰ Thời gian khởi tạo:</span>
                <strong style={{ color: '#475569', fontSize: '0.85rem' }}>{formatDateTime(selectedIssueDetail.createdAt)}</strong>
              </div>

              <div style={{ gridColumn: 'span 2', background: '#fff', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📝 Ghi chú xuất kho:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedIssueDetail.note || 'Không có ghi chú.'}</span>
              </div>
            </div>

            {/* Danh sách mặt hàng xuất & Đối chiếu Tồn ban đầu, Xuất, Tồn còn lại */}
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>
                📦 CHI TIẾT MẶT HÀNG & ĐỐI CHIẾU TỒN KHO ({selectedIssueDetail.items.length} DÒNG):
              </span>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                      <th>Mặt hàng</th>
                      <th style={{ textAlign: 'center' }}>ĐVT</th>
                      <th style={{ textAlign: 'right' }}>Tồn ban đầu (Trước xuất)</th>
                      <th style={{ textAlign: 'right' }}>Số lượng xuất</th>
                      <th style={{ textAlign: 'right' }}>Tồn còn lại (Sau xuất)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIssueDetail.items.map((it, idx) => {
                      const key = `${it.itemName.trim().toLowerCase()}|${(it.unit || '').trim().toLowerCase()}`;
                      const currentClosing = stockMap.get(key) ?? 0;
                      const isCurrentActive = selectedIssueDetail.status === 'ACTIVE';
                      const initialStock = currentClosing + (isCurrentActive ? it.quantity : 0);
                      const remainingStock = isCurrentActive ? currentClosing : initialStock;

                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td><strong>{it.itemName}</strong></td>
                          <td style={{ textAlign: 'center' }}>{it.unit}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {initialStock}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d', fontSize: '1.05rem', background: '#f0fdf4' }}>
                            {it.quantity}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af', background: '#eff6ff' }}>
                            {remainingStock}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
              {selectedIssueDetail.status === 'ACTIVE' && can('inventory', 'edit') && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const issue = selectedIssueDetail;
                    setSelectedIssueDetail(null);
                    openEditIssue(issue);
                  }}
                  style={{ background: '#d97706', border: 'none' }}
                >
                  ✏️ Chỉnh sửa phiếu xuất này
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={() => setSelectedIssueDetail(null)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Sửa Phiếu Xuất Kho */}
      <Modal
        title={`Chỉnh sửa Phiếu xuất kho #${issueToEdit?.issueCode ?? ''}`}
        open={!!issueToEdit}
        onClose={() => setIssueToEdit(null)}
        size="xl"
      >
        {issueToEdit && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const itemsToUpdate = editItems
                  .map((it) => {
                    const remainVal = Number(it.remainingStock) || 0;
                    const issueQty = Math.max(0, it.initialStock - remainVal);
                    return {
                      itemName: it.itemName,
                      unit: it.unit,
                      quantity: issueQty,
                    };
                  })
                  .filter((it) => it.quantity > 0);

                if (itemsToUpdate.length === 0) {
                  alert('Không có mặt hàng nào có số lượng xuất.');
                  return;
                }

                await update.mutateAsync({
                  id: issueToEdit.id,
                  issueDate: editDate,
                  note: editNote,
                  items: itemsToUpdate,
                });
                setIssueToEdit(null);
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Cập nhật thất bại');
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}
          >
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.9rem 1.1rem', borderRadius: '10px', fontSize: '0.88rem', color: '#1e40af', lineHeight: 1.5 }}>
              💡 <strong>Hướng dẫn:</strong> Ô nhập liệu bên dưới là <strong>SỐ LƯỢNG TỒN CÒN LẠI THỰC TẾ</strong> của từng sản phẩm.
              Bạn chỉ cần chỉnh sửa con số tồn còn lại thực tế, hệ thống sẽ <strong>tự động tính lại lượng Xuất = (Tồn ban đầu - Tồn còn lại)</strong>!
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                Ngày xuất kho *
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  style={{ fontSize: '0.95rem', fontWeight: 600 }}
                />
              </label>

              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                Ghi chú xuất kho
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Ghi chú phiếu xuất..."
                  style={{ fontSize: '0.95rem' }}
                />
              </label>
            </div>

            {/* Bảng Mặt Hàng Xuất & Đối Chiếu 3 Con Số Tồn Kho */}
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>
                📦 ĐỐI CHIẾU & CHỈNH SỬA TỒN KHO CÒN LẠI ({editItems.length} MẶT HÀNG):
              </span>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                      <th>Mặt hàng</th>
                      <th style={{ textAlign: 'center' }}>ĐVT</th>
                      <th style={{ textAlign: 'right' }}>Tồn ban đầu (Trước xuất)</th>
                      <th style={{ textAlign: 'center', width: '180px' }}>Số TỒN CÒN LẠI thực tế (Sửa tại đây)</th>
                      <th style={{ textAlign: 'right', width: '160px' }}>Số lượng XUẤT (Tự tính)</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editItems.map((it, idx) => {
                      const remainVal = Number(it.remainingStock) || 0;
                      const calculatedIssueQty = Math.max(0, it.initialStock - remainVal);
                      const isExcess = remainVal > it.initialStock;

                      return (
                        <tr key={idx} style={{ background: calculatedIssueQty > 0 ? '#f0fdf4' : isExcess ? '#fff7ed' : undefined }}>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td><strong style={{ fontSize: '0.95rem' }}>{it.itemName}</strong></td>
                          <td style={{ textAlign: 'center' }}>{it.unit}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '1rem' }}>
                            {it.initialStock}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.remainingStock}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, remainingStock: val } : item))
                                );
                              }}
                              style={{
                                width: '120px',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '1.15rem',
                                color: '#1d4ed8',
                                background: '#eff6ff',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '8px',
                                border: '2px solid #3b82f6',
                                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.15)',
                              }}
                              required
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {calculatedIssueQty > 0 ? (
                              <strong style={{ color: '#15803d', fontSize: '1.1rem', background: '#dcfce7', padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid #86efac' }}>
                                Xuất {calculatedIssueQty}
                              </strong>
                            ) : isExcess ? (
                              <span style={{ color: '#c2410c', fontSize: '0.78rem', fontWeight: 600 }}>
                                Tồn thực tế lớn hơn (+{remainVal - it.initialStock})
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-action-delete"
                              onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                              disabled={editItems.length === 1}
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setIssueToEdit(null)}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn-primary" disabled={update.isPending} style={{ background: '#2563eb', padding: '0.5rem 1.25rem' }}>
                {update.isPending ? 'Đang lưu…' : '💾 Lưu thay đổi phiếu xuất'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Xác Nhận Hủy Phiếu Xuất Kho */}
      <Modal
        title="⚠️ Xác nhận Hủy phiếu xuất kho"
        open={!!issueToCancel}
        onClose={() => setIssueToCancel(null)}
        size="sm"
      >
        {issueToCancel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn <strong>hủy Phiếu xuất kho #{issueToCancel.issueCode}</strong> (gồm {issueToCancel.items.length} mặt hàng)?
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', color: '#991b1b' }}>
              💡 Sau khi hủy phiếu xuất, toàn bộ số lượng hàng trong phiếu sẽ <strong>tự động hoàn trả lại vào tồn kho khả dụng</strong> của cơ sở này.
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setIssueToCancel(null)}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  try {
                    await cancel.mutateAsync(issueToCancel.id);
                    setIssueToCancel(null);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Hủy phiếu xuất thất bại');
                  }
                }}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? 'Đang hủy…' : 'Xác nhận Hủy phiếu xuất'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
