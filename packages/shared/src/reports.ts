// Types báo cáo / dashboard dùng chung FE + BE (Phase 7).

export type RangeValue = '1m' | '3m' | '6m' | '12m';

export interface PeriodInfo {
  from: string;
  to: string;
  groupBy: 'day' | 'month';
}

export interface KpiValue {
  value: number;
  previous: number;
  /** % thay đổi so kỳ trước — null khi kỳ trước = 0. */
  change: number | null;
}

export interface ChartPoint {
  label: string; // 'YYYY-MM-DD' (day) hoặc 'YYYY-MM' (month)
  value: number;
}

export interface FacilityComparison {
  facilityId: string;
  facilityName: string;
  purchase: number; // chi phí nhập trong kỳ
}

export type DebtAlertLevel = 'OVERDUE' | 'CRITICAL' | 'WARNING';

export interface DebtAlert {
  payableId: string;
  invoiceCode: string;
  supplierName: string;
  dueDate: string;
  balance: number;
  level: DebtAlertLevel;
}

export interface DashboardData {
  period: PeriodInfo;
  previousPeriod: { from: string; to: string };
  kpis: {
    totalPurchase: KpiValue; // chi phí nhập kỳ
    totalPaid: KpiValue; // đã thanh toán kỳ
    receiptCount: KpiValue; // số phiếu nhập kỳ
    outstandingDebt: { value: number; overdueAmount: number }; // hiện tại (runtime)
  };
  series: ChartPoint[]; // chi phí nhập theo ngày/tháng
  facilityComparison: FacilityComparison[];
  /** Cảnh báo dùng vượt tháng: chi tháng này so tháng trước. */
  monthAlert: { current: number; previous: number; change: number | null; exceeded: boolean };
  debtAlerts: DebtAlert[];
}

export interface StatsRow {
  itemName: string;
  unit: string;
  quantity: number; // sản lượng
  cost: number; // chi phí (SL × đơn giá, chưa gồm giảm giá/VAT cấp phiếu)
}

export interface StatsData {
  period: PeriodInfo;
  rows: StatsRow[];
  totals: { quantity: number; cost: number };
}

export interface CompareRow {
  itemName: string;
  unit: string;
  quantityA: number;
  costA: number;
  quantityB: number;
  costB: number;
  /** % thay đổi chi phí B so với A — null khi A = 0. */
  costChange: number | null;
}

export interface CompareData {
  periodA: { from: string; to: string };
  periodB: { from: string; to: string };
  rows: CompareRow[];
  totals: { costA: number; costB: number; change: number | null };
}

export interface DebtAlertCounts {
  overdueCount: number;
  upcomingCount: number; // WARNING + CRITICAL
}
