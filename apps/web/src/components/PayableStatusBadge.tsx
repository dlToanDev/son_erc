import type { PayableStatusRuntime } from '@debtflow/shared';

const CONFIG: Record<PayableStatusRuntime, { label: string; cls: string }> = {
  UNPAID: { label: 'Chưa trả', cls: 'badge-muted' },
  PARTIAL: { label: 'Trả một phần', cls: 'badge-warning' },
  PAID: { label: 'Đã trả đủ', cls: 'badge-success' },
  OVERDUE: { label: 'Quá hạn', cls: 'badge-danger' },
};

export default function PayableStatusBadge({ status }: { status: PayableStatusRuntime }) {
  const { label, cls } = CONFIG[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
