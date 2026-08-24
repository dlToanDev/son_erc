import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CompareData,
  DashboardData,
  DebtAlert,
  DebtAlertCounts,
  RangeValue,
  StatsData,
} from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  daysDifference,
  invoiceBalance,
  invoiceStatus,
  percentChange,
  periodBounds,
  previousPeriodBounds,
  purchaseTotals,
} from '../domain';

const RANGES: RangeValue[] = ['1m', '3m', '6m', '12m'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** [from, to] dạng YYYY-MM-DD → điều kiện Prisma [00:00 from, 00:00 to+1) UTC. */
const dateRange = (from: string, to: string) => ({
  gte: new Date(`${from}T00:00:00.000Z`),
  lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86400000),
});

interface ReceiptForStats {
  receiptDate: Date;
  facilityId: string;
  discountAmount: unknown;
  taxAmount: unknown;
  items: { itemName: string; unit: string; quantity: unknown; unitPrice: unknown }[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Dashboard ----------

  async dashboard(range: RangeValue, facilityId?: string): Promise<DashboardData> {
    if (!RANGES.includes(range)) {
      throw new BadRequestException(`range phải là ${RANGES.join('/')}`);
    }
    const period = periodBounds(range);
    const prev = previousPeriodBounds(period.from, period.to);

    const [current, previous] = await Promise.all([
      this.loadReceipts(period.from, period.to, facilityId),
      this.loadReceipts(prev.from, prev.to, facilityId),
    ]);

    const grandOf = (r: ReceiptForStats) =>
      purchaseTotals(
        r.items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
        Number(r.discountAmount),
        Number(r.taxAmount),
      ).grandTotal;

    const totalPurchase = current.reduce((s, r) => s + grandOf(r), 0);
    const prevPurchase = previous.reduce((s, r) => s + grandOf(r), 0);

    // Thanh toán ACTIVE trong kỳ / kỳ trước.
    const [paidNow, paidPrev] = await Promise.all([
      this.sumPayments(period.from, period.to),
      this.sumPayments(prev.from, prev.to),
    ]);

    // Công nợ hiện tại (runtime) + quá hạn.
    const payables = await this.prisma.payable.findMany({
      include: {
        payments: { select: { amount: true, status: true } },
        supplier: { select: { name: true } },
      },
    });
    let outstanding = 0;
    let overdueAmount = 0;
    for (const p of payables) {
      const total = Number(p.totalAmount);
      const pays = p.payments.map((pm) => ({ amount: Number(pm.amount), status: pm.status }));
      const balance = invoiceBalance(total, pays);
      outstanding += balance;
      if (balance > 0 && p.dueDate && invoiceStatus(total, pays, p.dueDate) === 'OVERDUE') {
        overdueAmount += balance;
      }
    }

    // Series biểu đồ: nhóm theo ngày (1m) hoặc tháng.
    const buckets = new Map<string, number>();
    for (const r of current) {
      const day = r.receiptDate.toISOString().slice(0, 10);
      const label = period.groupBy === 'day' ? day : day.slice(0, 7);
      buckets.set(label, (buckets.get(label) ?? 0) + grandOf(r));
    }
    const series = [...buckets.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // So sánh giữa các cơ sở (trong kỳ, không áp facility filter).
    const allCurrent = facilityId
      ? await this.loadReceipts(period.from, period.to)
      : current;
    const facilities = await this.prisma.facility.findMany({ select: { id: true, name: true } });
    const byFacility = new Map<string, number>();
    for (const r of allCurrent) {
      byFacility.set(r.facilityId, (byFacility.get(r.facilityId) ?? 0) + grandOf(r));
    }
    const facilityComparison = facilities
      .map((f) => ({ facilityId: f.id, facilityName: f.name, purchase: byFacility.get(f.id) ?? 0 }))
      .sort((a, b) => b.purchase - a.purchase);

    // Cảnh báo dùng vượt tháng: tháng hiện tại so tháng trước.
    const thisMonth = periodBounds('1m');
    const lastMonth = previousPeriodBounds(thisMonth.from, thisMonth.to);
    const [curMonthReceipts, prevMonthReceipts] = await Promise.all([
      this.loadReceipts(thisMonth.from, thisMonth.to, facilityId),
      this.loadReceipts(lastMonth.from, lastMonth.to, facilityId),
    ]);
    const curMonth = curMonthReceipts.reduce((s, r) => s + grandOf(r), 0);
    const prevMonth = prevMonthReceipts.reduce((s, r) => s + grandOf(r), 0);

    return {
      period,
      previousPeriod: prev,
      kpis: {
        totalPurchase: {
          value: totalPurchase,
          previous: prevPurchase,
          change: percentChange(totalPurchase, prevPurchase),
        },
        totalPaid: { value: paidNow, previous: paidPrev, change: percentChange(paidNow, paidPrev) },
        receiptCount: {
          value: current.length,
          previous: previous.length,
          change: percentChange(current.length, previous.length),
        },
        outstandingDebt: { value: outstanding, overdueAmount },
      },
      series,
      facilityComparison,
      monthAlert: {
        current: curMonth,
        previous: prevMonth,
        change: percentChange(curMonth, prevMonth),
        exceeded: prevMonth > 0 && curMonth > prevMonth,
      },
      debtAlerts: await this.buildDebtAlerts(),
    };
  }

  // ---------- Debt alerts (badge sidebar + dashboard) ----------

  async debtAlertCounts(): Promise<DebtAlertCounts> {
    const alerts = await this.buildDebtAlerts();
    return {
      overdueCount: alerts.filter((a) => a.level === 'OVERDUE').length,
      upcomingCount: alerts.filter((a) => a.level !== 'OVERDUE').length,
    };
  }

  /** Phân loại theo ngưỡng settings: OVERDUE / CRITICAL / WARNING. */
  private async buildDebtAlerts(): Promise<DebtAlert[]> {
    const settings = await this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    const payables = await this.prisma.payable.findMany({
      where: { dueDate: { not: null } },
      include: {
        payments: { select: { amount: true, status: true } },
        supplier: { select: { name: true } },
      },
    });

    const today = new Date();
    const alerts: DebtAlert[] = [];
    for (const p of payables) {
      const total = Number(p.totalAmount);
      const pays = p.payments.map((pm) => ({ amount: Number(pm.amount), status: pm.status }));
      const balance = invoiceBalance(total, pays);
      if (balance <= 0) continue;

      const status = invoiceStatus(total, pays, p.dueDate!, today);
      const daysLeft = daysDifference(today, p.dueDate!);

      let level: DebtAlert['level'] | null = null;
      if (status === 'OVERDUE') level = 'OVERDUE';
      else if (daysLeft <= settings.criticalWarningDays) level = 'CRITICAL';
      else if (daysLeft <= settings.warningDays) level = 'WARNING';
      if (!level) continue;

      alerts.push({
        payableId: p.id,
        invoiceCode: p.invoiceCode,
        supplierName: p.supplier.name,
        dueDate: p.dueDate!.toISOString(),
        balance,
        level,
      });
    }
    // OVERDUE trước, rồi theo hạn gần nhất.
    const rank = { OVERDUE: 0, CRITICAL: 1, WARNING: 2 };
    return alerts.sort((a, b) => rank[a.level] - rank[b.level] || a.dueDate.localeCompare(b.dueDate));
  }

  // ---------- Stats ----------

  /** Sản lượng & chi phí theo mặt hàng trong kỳ (lọc cơ sở & từ ngày -> đến ngày). */
  async stats(range: RangeValue, facilityId?: string, from?: string, to?: string): Promise<StatsData> {
    let period: { from: string; to: string };
    if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
      period = { from, to };
    } else {
      // Nhất quán với dashboard(): range sai → 400 (không âm thầm fallback).
      if (!RANGES.includes(range)) {
        throw new BadRequestException(`range phải là ${RANGES.join('/')}`);
      }
      period = periodBounds(range);
    }
    const rows = await this.aggregateItems(period.from, period.to, facilityId);
    return {
      period: { from: period.from, to: period.to, groupBy: 'day' },
      rows,
      totals: rows.reduce(
        (t, r) => ({ quantity: t.quantity + r.quantity, cost: t.cost + r.cost }),
        { quantity: 0, cost: 0 },
      ),
    };
  }

  // ---------- Compare ----------

  /** Đối chiếu chi phí nhập 2 kỳ tuỳ chọn. */
  async compare(
    fromA: string,
    toA: string,
    fromB: string,
    toB: string,
    facilityId?: string,
  ): Promise<CompareData> {
    for (const d of [fromA, toA, fromB, toB]) {
      if (!DATE_RE.test(d ?? '')) {
        throw new BadRequestException('fromA/toA/fromB/toB phải theo định dạng YYYY-MM-DD');
      }
    }
    const [rowsA, rowsB] = await Promise.all([
      this.aggregateItems(fromA, toA, facilityId),
      this.aggregateItems(fromB, toB, facilityId),
    ]);

    const keys = new Map<string, { itemName: string; unit: string }>();
    for (const r of [...rowsA, ...rowsB]) {
      keys.set(`${r.itemName}|${r.unit}`, { itemName: r.itemName, unit: r.unit });
    }
    const find = (rows: typeof rowsA, k: { itemName: string; unit: string }) =>
      rows.find((r) => r.itemName === k.itemName && r.unit === k.unit);

    const rows = [...keys.values()]
      .map((k) => {
        const a = find(rowsA, k);
        const b = find(rowsB, k);
        return {
          itemName: k.itemName,
          unit: k.unit,
          quantityA: a?.quantity ?? 0,
          costA: a?.cost ?? 0,
          quantityB: b?.quantity ?? 0,
          costB: b?.cost ?? 0,
          costChange: percentChange(b?.cost ?? 0, a?.cost ?? 0),
        };
      })
      .sort((x, y) => y.costB - x.costB);

    const costA = rows.reduce((s, r) => s + r.costA, 0);
    const costB = rows.reduce((s, r) => s + r.costB, 0);
    return {
      periodA: { from: fromA, to: toA },
      periodB: { from: fromB, to: toB },
      rows,
      totals: { costA, costB, change: percentChange(costB, costA) },
    };
  }

  // ---------- Helpers ----------

  private loadReceipts(from: string, to: string, facilityId?: string): Promise<ReceiptForStats[]> {
    const ids = facilityId ? facilityId.split(',').filter(Boolean) : [];
    const facilityWhere = ids.length === 1 ? ids[0] : ids.length > 1 ? { in: ids } : undefined;

    return this.prisma.purchaseReceipt.findMany({
      where: {
        status: 'CONFIRMED',
        facilityId: facilityWhere,
        receiptDate: dateRange(from, to),
      },
      select: {
        receiptDate: true,
        facilityId: true,
        discountAmount: true,
        taxAmount: true,
        items: { select: { itemName: true, unit: true, quantity: true, unitPrice: true } },
      },
    });
  }

  private async sumPayments(from: string, to: string): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: { status: 'ACTIVE', paymentDate: dateRange(from, to) },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /** Gom SL & chi phí theo mặt hàng từ receipt_items CONFIRMED trong kỳ. */
  private async aggregateItems(from: string, to: string, facilityId?: string) {
    const ids = facilityId ? facilityId.split(',').filter(Boolean) : [];
    const facilityWhere = ids.length === 1 ? ids[0] : ids.length > 1 ? { in: ids } : undefined;

    const receipts = await this.prisma.purchaseReceipt.findMany({
      where: {
        status: 'CONFIRMED',
        facilityId: facilityWhere,
        receiptDate: dateRange(from, to),
      },
      select: {
        items: { select: { itemName: true, unit: true, quantity: true, unitPrice: true } },
      },
    });
    const map = new Map<string, { itemName: string; unit: string; quantity: number; cost: number }>();
    for (const r of receipts) {
      for (const i of r.items) {
        const key = `${i.itemName.trim().toLocaleLowerCase('vi-VN')}|${i.unit.trim().toLocaleLowerCase('vi-VN')}`;
        const row = map.get(key) ?? { itemName: i.itemName, unit: i.unit, quantity: 0, cost: 0 };
        row.quantity += Number(i.quantity);
        row.cost += Number(i.quantity) * Number(i.unitPrice);
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }
}
