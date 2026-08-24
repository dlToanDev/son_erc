// PeriodCalculator — mốc kỳ, kỳ trước, % thay đổi.
// Port nguyên công thức từ logic.js demo (đã kiểm thử).

import { toDate, iso, monthEnd, type DateInput } from './date-utils';

export type RangeKey = '1m' | '3m' | '6m' | '12m';
export type GroupBy = 'day' | 'month';

export interface PeriodBounds {
  from: string;
  to: string;
  groupBy: GroupBy;
}

export function periodBounds(range: RangeKey, anchor: DateInput = new Date()): PeriodBounds {
  const date = toDate(anchor);
  const end = monthEnd(date);
  let months = 1;
  let groupBy: GroupBy = 'day';
  if (range === '3m') {
    months = 3;
    groupBy = 'month';
  }
  if (range === '6m') {
    months = 6;
    groupBy = 'month';
  }
  if (range === '12m') {
    months = 12;
    groupBy = 'month';
  }
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1));
  return { from: iso(start), to: iso(end), groupBy };
}

export function previousPeriodBounds(from: DateInput, to: DateInput): { from: string; to: string } {
  const start = toDate(from);
  const end = toDate(to);
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (durationDays - 1) * 86400000);
  return { from: iso(prevStart), to: iso(prevEnd) };
}

/** % thay đổi (làm tròn 1 chữ số). null khi kỳ trước = 0. */
export function percentChange(current: number, previous: number): number | null {
  current = Number(current || 0);
  previous = Number(previous || 0);
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const PeriodCalculator = {
  periodBounds,
  previousPeriodBounds,
  percentChange,
};
