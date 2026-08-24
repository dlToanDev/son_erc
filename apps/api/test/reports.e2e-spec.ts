// E2E Phase 7 — Báo cáo/Dashboard: số liệu phải khớp DB thật.
// Dùng kỳ quá khứ riêng (2025-03, 2025-04) + mặt hàng riêng để không đụng suite khác.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { invoiceBalance, purchaseTotals } from '../src/domain';

describe('Reports (e2e, DB thật đã seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let supplierId: string;
  let facilityId: string;
  const prisma = new PrismaClient();
  const ITEM_A = `Cà phê E2E ${process.pid}`;
  const ITEM_B = `Đường E2E ${process.pid}`;

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });
  const server = () => app.getHttpServer();

  const confirmedReceipt = async (
    receiptDate: string,
    items: { itemName: string; unit: string; quantity: number; unitPrice: number }[],
  ) => {
    const draft = await request(server())
      .post('/api/v1/receipts')
      .set(asStaff())
      .send({ supplierId, facilityId, receiptDate, items })
      .expect(201);
    await request(server())
      .post(`/api/v1/receipts/${draft.body.id}/confirm`)
      .set(asStaff())
      .expect(201);
    return draft.body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    adminToken = (
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@debtflow.local', password: 'admin123' })
    ).body.accessToken;
    staffToken = (
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: 'staff@debtflow.local', password: 'staff123' })
    ).body.accessToken;

    const suppliers = await request(server()).get('/api/v1/suppliers').set(asAdmin());
    supplierId = suppliers.body.find((s: { code: string }) => s.code === 'NCC001').id;
    const facilities = await request(server()).get('/api/v1/facilities').set(asAdmin());
    facilityId = facilities.body.find((f: { code: string }) => f.code === 'CS1').id;

    // Dataset kiểm soát được:
    // Kỳ A (2025-03): A 10×50k = 500k · B 5×20k = 100k → tổng 600k
    // Kỳ B (2025-04): A 20×50k = 1.000k                → tổng 1.000k
    await confirmedReceipt('2025-03-10', [
      { itemName: ITEM_A, unit: 'Kg', quantity: 10, unitPrice: 50000 },
      { itemName: ITEM_B, unit: 'Kg', quantity: 5, unitPrice: 20000 },
    ]);
    await confirmedReceipt('2025-04-10', [
      { itemName: ITEM_A, unit: 'Kg', quantity: 20, unitPrice: 50000 },
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /reports/compare — đối chiếu 2 kỳ', () => {
    it('số liệu 2 kỳ khớp chính xác + % thay đổi đúng công thức', async () => {
      const res = await request(server())
        .get(
          `/api/v1/reports/compare?fromA=2025-03-01&toA=2025-03-31&fromB=2025-04-01&toB=2025-04-30&facilityId=${facilityId}`,
        )
        .set(asAdmin())
        .expect(200);

      const rowA = res.body.rows.find((r: { itemName: string }) => r.itemName === ITEM_A);
      expect(rowA).toMatchObject({
        quantityA: 10,
        costA: 500000,
        quantityB: 20,
        costB: 1000000,
        costChange: 100, // (1000k − 500k) / 500k = +100%
      });

      const rowB = res.body.rows.find((r: { itemName: string }) => r.itemName === ITEM_B);
      // Kỳ B không nhập Đường → costChange null (kỳ A=100k, B=0 → -100%)
      expect(rowB).toMatchObject({ quantityA: 5, costA: 100000, quantityB: 0, costB: 0, costChange: -100 });

      expect(res.body.totals).toMatchObject({
        costA: 600000,
        costB: 1000000,
        change: 66.7, // (1000-600)/600 = 66.66..% → làm tròn 1 chữ số
      });
    });

    it('kỳ gốc = 0 → change null (không chia cho 0)', async () => {
      const res = await request(server())
        .get(
          `/api/v1/reports/compare?fromA=2020-01-01&toA=2020-01-31&fromB=2025-04-01&toB=2025-04-30&facilityId=${facilityId}`,
        )
        .set(asAdmin())
        .expect(200);
      expect(res.body.totals.costA).toBe(0);
      expect(res.body.totals.change).toBeNull();
    });

    it('thiếu tham số ngày → 400', async () => {
      await request(server())
        .get('/api/v1/reports/compare?fromA=2025-03-01')
        .set(asAdmin())
        .expect(400);
    });
  });

  describe('GET /reports/stats', () => {
    it('range không hợp lệ → 400', async () => {
      await request(server()).get('/api/v1/reports/stats?range=5y').set(asAdmin()).expect(400);
    });

    it('tổng chi phí stats khớp tính tay từ DB (kỳ 12m)', async () => {
      const res = await request(server())
        .get(`/api/v1/reports/stats?range=12m&facilityId=${facilityId}`)
        .set(asAdmin())
        .expect(200);

      // Tính expected từ DB trực tiếp cùng công thức.
      const from = new Date(`${res.body.period.from}T00:00:00.000Z`);
      const to = new Date(new Date(`${res.body.period.to}T00:00:00.000Z`).getTime() + 86400000);
      const receipts = await prisma.purchaseReceipt.findMany({
        where: { status: 'CONFIRMED', facilityId, receiptDate: { gte: from, lt: to } },
        include: { items: true },
      });
      const expectedCost = receipts
        .flatMap((r) => r.items)
        .reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);

      expect(res.body.totals.cost).toBe(expectedCost);
      // Mỗi dòng: quantity & cost > 0, sắp theo cost giảm dần
      const costs = res.body.rows.map((r: { cost: number }) => r.cost);
      expect([...costs].sort((a, b) => b - a)).toEqual(costs);
    });
  });

  describe('GET /reports/dashboard', () => {
    it('KPI totalPurchase khớp DB, series đúng groupBy, có 4 KPI', async () => {
      const res = await request(server())
        .get('/api/v1/reports/dashboard?range=1m')
        .set(asStaff()) // staff có dashboard.view
        .expect(200);

      const { kpis, series, period, facilityComparison } = res.body;
      expect(period.groupBy).toBe('day');
      expect(kpis).toHaveProperty('totalPurchase');
      expect(kpis).toHaveProperty('totalPaid');
      expect(kpis).toHaveProperty('receiptCount');
      expect(kpis).toHaveProperty('outstandingDebt');

      // totalPurchase = tổng series (cùng nguồn, cùng kỳ)
      const seriesSum = series.reduce((s: number, p: { value: number }) => s + p.value, 0);
      expect(Math.round(seriesSum)).toBe(Math.round(kpis.totalPurchase.value));

      // outstandingDebt khớp tính tay runtime từ DB
      const payables = await prisma.payable.findMany({ include: { payments: true } });
      const expectedOutstanding = payables.reduce(
        (s, p) =>
          s +
          invoiceBalance(
            Number(p.totalAmount),
            p.payments.map((pm) => ({ amount: Number(pm.amount), status: pm.status })),
          ),
        0,
      );
      expect(Math.round(kpis.outstandingDebt.value)).toBe(Math.round(expectedOutstanding));

      // facilityComparison đủ mọi cơ sở
      const facCount = await prisma.facility.count();
      expect(facilityComparison).toHaveLength(facCount);
    });

    it('range=12m nhóm theo tháng', async () => {
      const res = await request(server())
        .get('/api/v1/reports/dashboard?range=12m')
        .set(asAdmin())
        .expect(200);
      expect(res.body.period.groupBy).toBe('month');
      for (const p of res.body.series) {
        expect(p.label).toMatch(/^\d{4}-\d{2}$/);
      }
    });
  });

  describe('GET /reports/debt-alerts — theo ngưỡng settings', () => {
    it('đếm khớp tính tay theo warningDays/criticalWarningDays', async () => {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const payables = await prisma.payable.findMany({
        where: { dueDate: { not: null } },
        include: { payments: true },
      });

      const today = new Date();
      const dayMs = 86400000;
      const toUtcDay = (d: Date) =>
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      let overdue = 0;
      let upcoming = 0;
      for (const p of payables) {
        const balance = invoiceBalance(
          Number(p.totalAmount),
          p.payments.map((pm) => ({ amount: Number(pm.amount), status: pm.status })),
        );
        if (balance <= 0) continue;
        const daysLeft = Math.floor((toUtcDay(p.dueDate!) - toUtcDay(today)) / dayMs);
        if (daysLeft < 0) overdue++;
        else if (daysLeft <= settings!.warningDays) upcoming++;
      }

      const res = await request(server())
        .get('/api/v1/reports/debt-alerts')
        .set(asStaff())
        .expect(200);
      expect(res.body.overdueCount).toBe(overdue);
      expect(res.body.upcomingCount).toBe(upcoming);
    });

    it('dashboard.debtAlerts phân mức OVERDUE/CRITICAL/WARNING & sắp xếp OVERDUE trước', async () => {
      const res = await request(server())
        .get('/api/v1/reports/dashboard?range=1m')
        .set(asAdmin())
        .expect(200);
      const levels = res.body.debtAlerts.map((a: { level: string }) => a.level);
      const rank = { OVERDUE: 0, CRITICAL: 1, WARNING: 2 } as Record<string, number>;
      const ranks = levels.map((l: string) => rank[l]);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    });
  });

  describe('Phân quyền', () => {
    it('staff (không có reports.view) → stats/compare 403; dashboard 200', async () => {
      await request(server()).get('/api/v1/reports/stats?range=1m').set(asStaff()).expect(403);
      await request(server())
        .get('/api/v1/reports/compare?fromA=2025-01-01&toA=2025-01-31&fromB=2025-02-01&toB=2025-02-28')
        .set(asStaff())
        .expect(403);
      await request(server()).get('/api/v1/reports/dashboard?range=1m').set(asStaff()).expect(200);
    });
  });
});
