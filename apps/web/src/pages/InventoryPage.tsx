import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { InventoryReportRow, IssueData, ShortageInfo } from '@debtflow/shared';
import {
  BarChart3,
  Building2,
  Calendar,
  Clock,
  Eye,
  FileText,
  Package,
  Pencil,
  Trash2,
  User,
} from 'lucide-react';
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
  const [quickFacilityId, setQuickFacilityId] = useState<string>('');
  const [quickFrom, setQuickFrom] = useState(monthStart());
  const [quickTo, setQuickTo] = useState(today());
  const [quickCounts, setQuickCounts] = useState<Record<string, string>>({});
  const [quickNote, setQuickNote] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const { data: quickReport } = useInventoryReport(quickFrom, quickTo, quickFacilityId || undefined);
  const activeReport = quickCountOpen ? (quickReport ?? report) : report;

  // Tự động đồng bộ số lượng tồn hệ thống khi đổi cơ sở hoặc khoảng thời gian trong modal kiểm kê
  useEffect(() => {
    if (quickCountOpen && activeReport?.rows) {
      const initial: Record<string, string> = {};
      activeReport.rows.forEach((r) => {
        initial[r.key] = String(r.closingQty);
      });
      setQuickCounts(initial);
    }
  }, [quickCountOpen, activeReport]);

  const openQuickCount = () => {
    // Mặc định chọn cơ sở đang được lọc ở thanh Header bên ngoài (nếu có 1 cơ sở), ngược lại mới là tất cả
    const defaultFac = selectedFacilityIds.length === 1 ? selectedFacilityIds[0] : '';
    setQuickFacilityId(defaultFac);
    setQuickFrom(from);
    setQuickTo(to);
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


      
      if (!quickFacilityId) {
          // If no specific facility selected, error out or choose one?
          // The API expects ONE facilityId. Wait. 
          // If we allow "Tất cả cơ sở", we can't create an issue for "all facilities". We have to create issues for each facility, or we force the user to pick one?
          alert('Vui lòng chọn 1 cơ sở cụ thể để tạo phiếu xuất.');
          setQuickSubmitting(false);
          return;
      }

      await create.mutateAsync({
        facilityId: quickFacilityId,
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
            <div className="btn-group-responsive">
              <button
                type="button"
                className="btn-primary"
                onClick={openQuickCount}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  fontWeight: 700,
                }}
              >
                Nhập Tồn còn lại (Tự tính Xuất)
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
            <table className="data-table table-sticky-first desktop-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Mặt hàng</th>
                  <th rowSpan={2} style={{ textAlign: 'center' }}>ĐVT</th>
                  <th rowSpan={2} style={{ textAlign: 'right' }}>Bảng giá</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>Tồn đầu</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>Nhập</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>Xuất</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>Tồn cuối</th>
                </tr>
                <tr>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>SL</th>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>TT</th>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>SL</th>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>TT</th>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>SL</th>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>TT</th>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>SL</th>
                  <th style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>TT</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !report && (
                  <tr><td colSpan={11} className="table-empty">Đang tải…</td></tr>
                )}
                {(!isLoading || report) && !report?.rows.length && (
                  <tr><td colSpan={11} className="table-empty">Không có chuyển động kho trong kỳ</td></tr>
                )}
                {report?.rows.map((row) => (
                  <tr key={row.key} className="clickable" onClick={() => setCardItem(row)}>
                    <td>
                      <div>{row.itemName}</div>
                      {row.supplierName && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginTop: '1px' }}>({row.supplierName})</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.unit}</td>
                    <td style={{ textAlign: 'right' }}>{row.avgPrice.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{row.openingQty}</td>
                    <td style={{ textAlign: 'right' }}>{row.openingVal.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{row.receivedQty}</td>
                    <td style={{ textAlign: 'right' }}>{row.receivedVal.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{row.issuedQty}</td>
                    <td style={{ textAlign: 'right' }}>{row.issuedVal.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}><strong>{row.closingQty}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{row.closingVal.toLocaleString()}</strong></td>
                  </tr>
                ))}
                {report && report.rows.length > 0 && (
                  <tr className="order-total-row">
                    <td colSpan={3}>Tổng cộng</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.openingQty}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.openingVal.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.receivedQty}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.receivedVal.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.issuedQty}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.issuedVal.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.closingQty}</td>
                    <td style={{ textAlign: 'right' }}>{report.totals.closingVal.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* View dạng Card siêu mượt & đẹp mắt dành riêng cho Mobile */}
            <div className="mobile-card-list">
              {isLoading && !report && (
                <div className="table-empty">Đang tải dữ liệu báo cáo kho…</div>
              )}
              {(!isLoading || report) && !report?.rows.length && (
                <div className="table-empty">Không có chuyển động kho trong kỳ</div>
              )}
              {report?.rows.map((row) => (
                <div key={row.key} className="mobile-card clickable" onClick={() => setCardItem(row)} style={{ padding: '0.9rem 1rem' }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', lineHeight: 1.3 }}>{row.itemName}</div>
                      {row.supplierName && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginTop: '1px' }}>({row.supplierName})</div>
                      )}
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>ĐVT: <strong>{row.unit}</strong></span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                        {row.avgPrice.toLocaleString()}đ / {row.unit}
                      </span>
                    </div>
                  </div>

                  {/* 4 Stats Grid Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    {/* Tồn đầu */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Tồn đầu kỳ</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginTop: '1px' }}>{row.openingQty} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{row.unit}</span></div>
                      <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>{row.openingVal.toLocaleString()}đ</div>
                    </div>

                    {/* Nhập */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Nhập trong kỳ</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#15803d', marginTop: '1px' }}>+{row.receivedQty} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#166534' }}>{row.unit}</span></div>
                      <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>+{row.receivedVal.toLocaleString()}đ</div>
                    </div>

                    {/* Xuất */}
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>Xuất trong kỳ</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#dc2626', marginTop: '1px' }}>-{row.issuedQty} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#991b1b' }}>{row.unit}</span></div>
                      <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>-{row.issuedVal.toLocaleString()}đ</div>
                    </div>

                    {/* Tồn cuối */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600 }}>Tồn cuối kỳ</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1d4ed8', marginTop: '1px' }}>{row.closingQty} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1e40af' }}>{row.unit}</span></div>
                      <div style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 700 }}>{row.closingVal.toLocaleString()}đ</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Thẻ tổng cộng toàn kho */}
              {report && report.rows.length > 0 && (
                <div style={{ background: '#1e293b', color: '#fff', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BarChart3 size={16} color="#94a3b8" /> TỔNG CỘNG TOÀN KHO
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.07)', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Tồn đầu:</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{report.totals.openingQty} món</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{report.totals.openingVal.toLocaleString()}đ</div>
                    </div>
                    <div style={{ background: 'rgba(34, 197, 94, 0.12)', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#86efac' }}>Tổng Nhập:</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4ade80' }}>+{report.totals.receivedQty} món</div>
                      <div style={{ fontSize: '0.75rem', color: '#86efac' }}>+{report.totals.receivedVal.toLocaleString()}đ</div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>Tổng Xuất:</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f87171' }}>-{report.totals.issuedQty} món</div>
                      <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>-{report.totals.issuedVal.toLocaleString()}đ</div>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(96, 165, 250, 0.4)', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>Tồn cuối:</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#60a5fa' }}>{report.totals.closingQty} món</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd' }}>{report.totals.closingVal.toLocaleString()}đ</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="placeholder">Bấm vào từng dòng để xem thẻ kho.</p>
        </>
      )}

      {tab === 'issues' && (
        <div className="table-wrap">
          <table className="data-table desktop-table">
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

          {/* View dạng Card dành riêng cho Mobile khi xem Danh sách phiếu xuất */}
          <div className="mobile-card-list">
            {!issues.length && (
              <div className="table-empty">Chưa có phiếu xuất kho nào</div>
            )}
            {issues.map((issue: IssueData) => (
              <div key={issue.id} className="mobile-card clickable" onClick={() => setSelectedIssueDetail(issue)}>
                <div className="card-row card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--df-primary)', fontSize: '1rem' }}>{issue.issueCode}</strong>
                  {issue.status === 'ACTIVE' ? (
                    <span className="badge badge-success">Hiệu lực</span>
                  ) : (
                    <span className="badge badge-muted">Đã huỷ</span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div><span style={{ color: '#64748b' }}>Ngày xuất:</span> <strong>{formatDateTime(issue.issueDate)}</strong></div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '0.15rem' }}>Danh sách xuất:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingLeft: '0.5rem' }}>
                      {issue.items.map((it, idx) => (
                        <span key={idx} style={{ fontSize: '0.83rem' }}>
                          • <strong>{it.itemName}</strong> × <strong style={{ color: '#16a34a' }}>{it.quantity}</strong> {it.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                  {issue.note && <div><span style={{ color: '#64748b' }}>Ghi chú:</span> {issue.note}</div>}
                </div>
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn-action-view" onClick={() => setSelectedIssueDetail(issue)}>
                    <Eye size={13} />
                    <span>Chi tiết</span>
                  </button>
                  {issue.status === 'ACTIVE' && can('inventory', 'edit') && (
                    <>
                      <button type="button" className="btn-action-edit" onClick={() => openEditIssue(issue)}>
                        <Pencil size={13} />
                        <span>Sửa</span>
                      </button>
                      <button type="button" className="btn-action-delete" onClick={() => setIssueToCancel(issue)} disabled={cancel.isPending}>
                        <Trash2 size={13} />
                        <span>Hủy</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
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
                  <td data-label="Ngày">{e.date}</td>
                  <td data-label="Chứng từ">{e.code}</td>
                  <td data-label="Loại">
                    {e.type === 'NHAP' ? (
                      <span className="badge badge-success">Nhập</span>
                    ) : (
                      <span className="badge badge-warning">Xuất</span>
                    )}
                  </td>
                  <td data-label="SL" style={{ textAlign: 'right' }}>
                    {e.type === 'NHAP' ? '+' : '−'}
                    {e.quantity}
                  </td>
                  <td data-label="Tồn" style={{ textAlign: 'right' }}>{e.balance}</td>
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
        <form onSubmit={onSubmitIssue} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div className="modal-filter-box">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                Ngày xuất kho *
              </span>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', color: '#0f172a', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                Ghi chú xuất kho
              </span>
              <input
                type="text"
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                placeholder="Nhập ghi chú (nếu có)..."
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', color: '#0f172a', width: '100%' }}
              />
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              DANH SÁCH MẶT HÀNG XUẤT KHO:
            </span>
            {lines.map((line, i) => {
              const row = availableRows.find(
                (r) => r.itemName === line.itemName && r.unit === line.unit,
              );
              return (
                <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <select
                    value={row?.key ?? ''}
                    onChange={(e) => pickItem(i, e.target.value)}
                    style={{ flex: '2 1 180px', minHeight: '40px', padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    <option value="">— Chọn mặt hàng —</option>
                    {availableRows.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.itemName} ({r.unit}) — Tồn: {r.closingQty}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    placeholder="Số lượng"
                    value={line.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    style={{ flex: '1 1 100px', minHeight: '40px', padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    style={{ color: '#dc2626', border: '1px solid #fecaca', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                  >
                    Xoá
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setLines((prev) => [...prev, { itemName: '', unit: '', quantity: '' }])}
              style={{ alignSelf: 'flex-start', color: '#2563eb', fontWeight: 700 }}
            >
              + Thêm mặt hàng
            </button>
          </div>

          {shortages.length > 0 && (
            <div className="form-error">
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
          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setIssueOpen(false)}>
              Huỷ bỏ
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={create.isPending}
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', padding: '0.55rem 1.35rem', fontWeight: 700 }}
            >
              {create.isPending ? 'Đang tạo phiếu xuất…' : 'Xác nhận Xuất kho'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Kiểm Kê Tồn Thực Tế & Tự Động Tính Phiếu Xuất */}
      <Modal
        title="Kiểm kê Tồn thực tế & Tự động tạo Phiếu xuất"
        open={quickCountOpen}
        onClose={() => setQuickCountOpen(false)}
        size="xl"
      >
        <form onSubmit={handleQuickCountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.85rem 1.1rem', borderRadius: '10px', fontSize: '0.88rem', color: '#1e40af', lineHeight: 1.5 }}>
            <strong>Hướng dẫn:</strong> Đang xem tồn kho của <strong>{quickFacilityId ? (activeFacilities.find((f) => f.id === quickFacilityId)?.name || 'Cơ sở') : 'Tất cả cơ sở'}</strong>. Bạn chỉ cần <strong>nhập số lượng còn lại thực tế</strong> của từng mặt hàng tại cơ sở đã chọn.
            Hệ thống sẽ <strong>tự động tính toán lượng Xuất = (Tồn hệ thống - Tồn còn lại)</strong> và khởi tạo phiếu xuất kho ngay lập tức!
          </div>

          <div className="modal-filter-box">
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              CHỌN CƠ SỞ:
            </span>
            <select
              value={quickFacilityId}
              onChange={(e) => {
                setQuickFacilityId(e.target.value);
              }}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '0.92rem', fontWeight: 700, color: '#1e40af', background: '#fff' }}
            >
              <option value="">Tất cả cơ sở</option>
              {activeFacilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Chọn Khoảng thời gian Đợt xuất kho (Từ ngày ... đến ngày ...) */}
          <div className="modal-filter-box">
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              ĐỢT KIỂM KÊ & XUẤT KHO:
            </span>

            <div className="modal-filter-date-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>Từ ngày:</span>
                <input
                  type="date"
                  value={quickFrom}
                  onChange={(e) => {
                    setQuickFrom(e.target.value);
                    setQuickNote(`Xuất kho đợt từ ngày ${e.target.value} đến ngày ${quickTo}`);
                  }}
                  style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '0.92rem', fontWeight: 700, color: '#1e40af', background: '#fff' }}
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
                  style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '0.92rem', fontWeight: 700, color: '#1e40af', background: '#fff' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              DANH SÁCH MẶT HÀNG TỒN KHO ({activeReport?.rows.length ?? 0} MẶT HÀNG):
            </span>
          </div>

          <div className="table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {/* Desktop Table View */}
            <table className="data-table desktop-table">
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

            {/* Mobile Card List View cho Modal Kiểm Kê */}
            <div className="mobile-card-list">
              {!report?.rows.length ? (
                <div className="table-empty">Không có sản phẩm nào trong kỳ báo cáo kho</div>
              ) : (
                report.rows.map((row, idx) => {
                  const rawVal = quickCounts[row.key];
                  const remainVal = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : row.closingQty;
                  const issueQty = Math.max(0, row.closingQty - remainVal);
                  const isExcess = remainVal > row.closingQty;

                  return (
                    <div
                      key={row.key}
                      className="mobile-card"
                      style={{
                        background: issueQty > 0 ? '#f0fdf4' : '#ffffff',
                        border: issueQty > 0 ? '1.5px solid #86efac' : '1px solid var(--df-border)',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        borderRadius: '12px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{idx + 1}. {row.itemName}</strong>
                          <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.4rem' }}>({row.unit})</span>
                        </div>
                        <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 700, background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                          Tồn hệ thống: {row.closingQty}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                          Nhập số lượng tồn còn lại thực tế:
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={rawVal ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuickCounts((prev) => ({ ...prev, [row.key]: val }));
                          }}
                          placeholder={`Mặc định: ${row.closingQty}`}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            textAlign: 'center',
                            color: issueQty > 0 ? '#15803d' : '#0f172a',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {issueQty > 0 ? (
                        <div style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #86efac', textAlign: 'center', fontSize: '0.92rem' }}>
                          Tự động tạo xuất: <strong>{issueQty}</strong> {row.unit}
                        </div>
                      ) : isExcess ? (
                        <div style={{ color: '#c2410c', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center', background: '#fff7ed', padding: '0.4rem', borderRadius: '6px' }}>
                          Tồn thực tế lớn hơn hệ thống (+{remainVal - row.closingQty})
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
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
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', padding: '0.55rem 1.35rem', fontWeight: 700 }}
            >
              {quickSubmitting ? 'Đang tạo phiếu xuất…' : 'Xác nhận & Tự động tạo Phiếu xuất'}
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
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>
                  <FileText size={14} color="#64748b" style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Mã phiếu xuất:
                </span>
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
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>
                  <Building2 size={14} color="#64748b" style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Cơ sở kho:
                </span>
                <strong style={{ color: '#0f172a' }}>{selectedIssueDetail.facilityName || 'Cơ sở'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>
                  <Calendar size={14} color="#64748b" style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Ngày xuất kho:
                </span>
                <strong style={{ color: '#0f172a' }}>{formatDateTime(selectedIssueDetail.issueDate)}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>
                  <User size={14} color="#64748b" style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Người lập phiếu:
                </span>
                <strong style={{ color: '#0f172a' }}>{selectedIssueDetail.createdBy || 'Admin'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>
                  <Clock size={14} color="#64748b" style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Thời gian khởi tạo:
                </span>
                <strong style={{ color: '#475569', fontSize: '0.85rem' }}>{formatDateTime(selectedIssueDetail.createdAt)}</strong>
              </div>

              <div style={{ gridColumn: 'span 2', background: '#fff', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.82rem' }}>📝 Ghi chú xuất kho:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedIssueDetail.note || 'Không có ghi chú.'}</span>
              </div>
            </div>

            {/* Danh sách mặt hàng xuất & Đối chiếu Tồn ban đầu, Xuất, Tồn còn lại */}
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <Package size={16} color="#1e293b" /> CHI TIẾT MẶT HÀNG & ĐỐI CHIẾU TỒN KHO ({selectedIssueDetail.items.length} DÒNG):
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
                          <td data-label="STT" style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td data-label="Mặt hàng"><strong>{it.itemName}</strong></td>
                          <td data-label="ĐVT" style={{ textAlign: 'center' }}>{it.unit}</td>
                          <td data-label="Tồn ban đầu" style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {initialStock}
                          </td>
                          <td data-label="Số lượng xuất" style={{ textAlign: 'right', fontWeight: 700, color: '#15803d', fontSize: '1.05rem', background: '#f0fdf4' }}>
                            {it.quantity}
                          </td>
                          <td data-label="Tồn còn lại" style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af', background: '#eff6ff' }}>
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
                          <td data-label="STT" style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td data-label="Mặt hàng"><strong style={{ fontSize: '0.95rem' }}>{it.itemName}</strong></td>
                          <td data-label="ĐVT" style={{ textAlign: 'center' }}>{it.unit}</td>
                          <td data-label="Tồn ban đầu" style={{ textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '1rem' }}>
                            {it.initialStock}
                          </td>
                          <td data-label="Tồn còn lại thực tế" style={{ textAlign: 'center' }}>
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
                          <td data-label="Số lượng xuất" style={{ textAlign: 'right' }}>
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
                          <td data-label="Thao tác" style={{ textAlign: 'center' }}>
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
