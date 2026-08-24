// InvoiceCalculator — công nợ: số dư & trạng thái tính runtime.
// Port nguyên công thức từ logic.js demo (đã kiểm thử).

import { toDate, type DateInput } from './date-utils';

export type PayableStatusValue = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface PaymentLike {
  amount: number;
  status?: 'ACTIVE' | 'CANCELLED';
}

function activePayments(payments: PaymentLike[] = []): PaymentLike[] {
  return payments.filter((p) => (p.status || 'ACTIVE') === 'ACTIVE');
}

/** Số dư còn lại = tổng hoá đơn − tổng thanh toán ACTIVE (không âm). */
export function invoiceBalance(totalAmount: number, payments: PaymentLike[] = []): number {
  const paid = activePayments(payments).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return Math.max(0, Number(totalAmount || 0) - paid);
}

/** Trạng thái công nợ: PAID / OVERDUE / PARTIAL / UNPAID (tính theo ngày). */
export function invoiceStatus(
  totalAmount: number,
  payments: PaymentLike[] = [],
  dueDate: DateInput,
  today: DateInput = new Date(),
): PayableStatusValue {
  const balance = invoiceBalance(totalAmount, payments);
  if (balance <= 0) return 'PAID';
  const paid = Number(totalAmount || 0) - balance;
  const due = toDate(dueDate);
  const now = toDate(today);
  if (due < now) return 'OVERDUE';
  return paid > 0 ? 'PARTIAL' : 'UNPAID';
}

export const InvoiceCalculator = {
  invoiceBalance,
  invoiceStatus,
};
