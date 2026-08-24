import type { OrderStatusValue } from '@debtflow/shared';

const CONFIG: Record<OrderStatusValue, { label: string; cls: string }> = {
  PENDING: { label: 'Chờ duyệt', cls: 'badge-warning' },
  APPROVED: { label: 'Đã duyệt', cls: 'badge-success' },
  REJECTED: { label: 'Từ chối', cls: 'badge-danger' },
  CANCELLED: { label: 'Đã huỷ', cls: 'badge-muted' },
};

export default function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  const { label, cls } = CONFIG[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
