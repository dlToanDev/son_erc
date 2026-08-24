// Tiện ích ngày — port nguyên từ logic.js demo (xử lý theo UTC, cắt tới ngày).

export type DateInput = Date | string;

export function toDate(value: DateInput): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthEnd(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function daysDifference(from: DateInput, to: DateInput): number {
  return Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 86400000);
}
