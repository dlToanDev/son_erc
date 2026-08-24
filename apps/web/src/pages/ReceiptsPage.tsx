import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReceiptData } from '@debtflow/shared';
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  Building2,
  Truck,
  Calendar,
  FileText,
  Filter,
} from 'lucide-react';
import DataTable, { Column } from '../components/DataTable';
import UnifiedFacilitySelect from '../components/UnifiedFacilitySelect';
import Modal from '../components/Modal';
import { useFacilities, useReceiptMutations, useReceipts, useSuppliers } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDateTime } from '../utils/format';

interface DraftLine {
  itemName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_LINE: DraftLine = { itemName: '', unit: '', quantity: '', unitPrice: '' };

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);

  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: facilities = [] } = useFacilities();
  const activeFacilities = facilities.filter((f) => f.status === 'ACTIVE');
  const facilityQueryParam =
    selectedFacilityIds.length === 0 || selectedFacilityIds.length === activeFacilities.length
      ? undefined
      : selectedFacilityIds.join(',');

  const { data: receipts = [], isLoading, isError } = useReceipts({
    facilityId: facilityQueryParam,
    status: statusFilter || undefined,
  });
  const { data: suppliers = [] } = useSuppliers();
  const { create } = useReceiptMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    supplierId: '',
    facilityId: '',
    supplierInvoiceCode: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    discountAmount: '',
    taxAmount: '',
    note: '',
  });
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [error, setError] = useState('');

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(l.unitPrice || 0),
    0,
  );
  const grandTotal = subtotal - Number(form.discountAmount || 0) + Number(form.taxAmount || 0);

  const openCreate = () => {
    setForm({
      supplierId: '',
      facilityId: '',
      supplierInvoiceCode: '',
      receiptDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      discountAmount: '',
      taxAmount: '',
      note: '',
    });
    setLines([{ ...EMPTY_LINE }]);
    setError('');
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const items = lines
      .filter((l) => l.itemName && Number(l.quantity) > 0)
      .map((l) => ({
        itemName: l.itemName,
        unit: l.unit || 'Cái',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice || 0),
      }));
    if (!items.length) {
      setError('Phiếu nhập phải có ít nhất 1 dòng mặt hàng hợp lệ (vui lòng điền tên hàng và số lượng > 0)');
      return;
    }
    try {
      const created = await create.mutateAsync({
        supplierId: form.supplierId,
        facilityId: form.facilityId,
        receiptDate: form.receiptDate,
        ...(form.supplierInvoiceCode ? { supplierInvoiceCode: form.supplierInvoiceCode } : {}),
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        ...(form.discountAmount ? { discountAmount: Number(form.discountAmount) } : {}),
        ...(form.taxAmount ? { taxAmount: Number(form.taxAmount) } : {}),
        ...(form.note ? { note: form.note } : {}),
        items,
      });
      setModalOpen(false);
      navigate(`/receipts/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo phiếu nhập');
    }
  };

  const columns: Column<ReceiptData>[] = [
    {
      key: 'code',
      header: 'Mã phiếu nhập',
      render: (r) => <strong style={{ color: 'var(--df-primary-bright)' }}>{r.receiptCode}</strong>,
    },
    { key: 'supplier', header: 'Nhà cung cấp', render: (r) => r.supplierName },
    { key: 'facility', header: 'Cơ sở nhận', render: (r) => r.facilityName },
    {
      key: 'date',
      header: 'Ngày nhập',
      render: (r) => formatDateTime(r.receiptDate).split(' ')[1] ?? formatDateTime(r.receiptDate),
    },
    {
      key: 'total',
      header: 'Tổng tiền thanh toán',
      align: 'right',
      render: (r) => <strong style={{ color: '#0f172a' }}>{formatMoney(r.grandTotal)}</strong>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (r) =>
        r.status === 'CONFIRMED' ? (
          <span className="badge badge-success">✓ Đã xác nhận</span>
        ) : (
          <span className="badge badge-warning">⚡ Nháp</span>
        ),
    },
  ];

  return (
    <section className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <FileSpreadsheet size={24} color="var(--df-primary)" />
          <h2>Quản lý phiếu nhập kho</h2>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={16} color="#64748b" />
            <UnifiedFacilitySelect
              facilities={facilities}
              selectedIds={selectedFacilityIds}
              onChange={setSelectedFacilityIds}
            />
            <select
              className="search-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="CONFIRMED">Đã xác nhận</option>
            </select>
          </div>
          {can('receipts', 'edit') && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={18} />
              <span>Tạo phiếu nhập mới</span>
            </button>
          )}
        </div>
      </header>

      <DataTable
        columns={columns}
        rows={receipts}
        rowKey={(r) => r.id}
        loading={isLoading}
        error={isError}
        onRowClick={(r) => navigate(`/receipts/${r.id}`)}
      />

      <Modal title="Lập phiếu nhập kho mới (Dạng nháp)" open={modalOpen} onClose={() => setModalOpen(false)} size="xl">
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Thông tin chung */}
          <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Thông tin chung phiếu nhập
            </h4>
            <div className="form-grid">
              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Truck size={15} color="var(--df-primary)" />
                  <span>Nhà cung cấp *</span>
                </div>
                <select
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                  required
                >
                  <option value="">— Chọn nhà cung cấp —</option>
                  {suppliers
                    .filter((s) => s.status === 'ACTIVE')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Building2 size={15} color="var(--df-primary)" />
                  <span>Cơ sở nhập kho *</span>
                </div>
                <select
                  value={form.facilityId}
                  onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
                  required
                >
                  <option value="">— Chọn cơ sở —</option>
                  {facilities
                    .filter((f) => f.status === 'ACTIVE')
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={15} color="var(--df-primary)" />
                  <span>Số hóa đơn nhà cung cấp</span>
                </div>
                <input
                  value={form.supplierInvoiceCode}
                  onChange={(e) => setForm({ ...form, supplierInvoiceCode: e.target.value })}
                  placeholder="Mã HD trên phiếu NCC (nếu có)"
                />
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} color="var(--df-primary)" />
                  <span>Ngày nhập thực tế *</span>
                </div>
                <input
                  type="date"
                  value={form.receiptDate}
                  onChange={(e) => setForm({ ...form, receiptDate: e.target.value })}
                  required
                />
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={15} color="#dc2626" />
                  <span>Hạn thanh toán công nợ</span>
                </div>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </label>

              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={15} color="var(--df-primary)" />
                  <span>Ghi chú phiếu</span>
                </div>
                <input
                  placeholder="Ghi chú đính kèm..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Chi tiết mặt hàng nhập */}
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Danh sách mặt hàng nhập kho ({lines.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {lines.map((line, i) => {
                const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 0.8fr 1fr 1.2fr 1.2fr auto',
                      gap: '0.6rem',
                      alignItems: 'center',
                      background: '#f8fafc',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <input
                      placeholder="Tên mặt hàng / sản phẩm *"
                      value={line.itemName}
                      onChange={(e) => setLine(i, { itemName: e.target.value })}
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                    <input
                      placeholder="ĐVT (Kg, Cái...)"
                      value={line.unit}
                      onChange={(e) => setLine(i, { unit: e.target.value })}
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      placeholder="Số lượng *"
                      value={line.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Đơn giá nhập"
                      value={line.unitPrice}
                      onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />

                    <div style={{ textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: 'var(--df-primary)' }}>
                      {lineTotal > 0 ? formatMoney(lineTotal) : '—'}
                    </div>

                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={lines.length === 1}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: lines.length === 1 ? '#cbd5e1' : '#dc2626',
                        padding: '0.35rem',
                        cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                        borderRadius: '4px',
                      }}
                      title="Xóa dòng này"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
              style={{ marginTop: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Plus size={15} />
              <span>Thêm dòng mặt hàng mới</span>
            </button>
          </div>

          {/* Chiết khấu & Thuế */}
          <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              3. Điều chỉnh tài chính
            </h4>
            <div className="form-grid">
              <label>
                <span>Chiết khấu / Giảm giá (VNĐ)</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                />
              </label>
              <label>
                <span>Thuế VAT bổ sung (VNĐ)</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={form.taxAmount}
                  onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Khối tổng kết tài chính */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e40af, #2563eb)',
              color: '#fff',
              padding: '1.15rem 1.5rem',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '0.85rem', opacity: 0.9, display: 'block' }}>TẠM TÍNH HÀNG: {formatMoney(subtotal)}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>TỔNG CỘNG THANH TOÁN (SAU CHIẾT KHẨU & VAT)</span>
            </div>
            <strong style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatMoney(grandTotal)}</strong>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Đang tạo phiếu…' : 'Lưu phiếu nhập nháp'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
