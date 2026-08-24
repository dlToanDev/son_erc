// E2E Phase 6 — Kho NXT: chặn xuất vượt tồn, cancel hoàn tồn, báo cáo khớp số học.
// Dùng mặt hàng riêng "Gạo E2E" tại CS2 để không đụng dữ liệu suite khác.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

describe('Inventory (e2e, DB thật đã seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let supplierId: string;
  let facilityId: string;
  const prisma = new PrismaClient();
  const ITEM = `Gạo E2E ${process.pid}`;
  const UNIT = 'Kg';

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });
  const server = () => app.getHttpServer();

  /** Nhập kho qua phiếu nhập CONFIRMED. */
  const stockIn = async (quantity: number, receiptDate: string, confirm = true) => {
    const draft = await request(server())
      .post('/api/v1/receipts')
      .set(asStaff())
      .send({
        supplierId,
        facilityId,
        receiptDate,
        items: [{ itemName: ITEM, unit: UNIT, quantity, unitPrice: 10000 }],
      })
      .expect(201);
    if (confirm) {
      await request(server())
        .post(`/api/v1/receipts/${draft.body.id}/confirm`)
        .set(asStaff())
        .expect(201);
    }
    return draft.body;
  };

  const issueOut = (quantity: number, issueDate: string) =>
    request(server())
      .post('/api/v1/inventory/issues')
      .set(asStaff())
      .send({
        facilityId,
        issueDate,
        items: [{ itemName: ITEM, unit: UNIT, quantity }],
      });

  const getReportRow = async (from: string, to: string) => {
    const res = await request(server())
      .get(`/api/v1/inventory/report?facilityId=${facilityId}&from=${from}&to=${to}`)
      .set(asStaff())
      .expect(200);
    return res.body.rows.find(
      (r: { itemName: string; unit: string }) => r.itemName === ITEM && r.unit === UNIT,
    );
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
    supplierId = suppliers.body.find((s: { code: string }) => s.code === 'NCC002').id;
    const facilities = await request(server()).get('/api/v1/facilities').set(asAdmin());
    facilityId = facilities.body.find((f: { code: string }) => f.code === 'CS2').id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Chặn xuất vượt tồn (bất biến canIssue)', () => {
    it('nhập 20kg (10/6 + 10/7) — xuất 25kg → 400; xuất đúng 20kg → OK', async () => {
      await stockIn(10, '2026-06-10');
      await stockIn(10, '2026-07-10');

      // Vượt tồn → 400 kèm thông tin thiếu hụt
      const blocked = await issueOut(25, '2026-08-01').expect(400);
      expect(blocked.body.message).toContain('vượt tồn');
      expect(blocked.body.message).toContain('khả dụng 20');

      // POST /inventory/check trả shortages chi tiết (FE dùng chặn UI)
      const check = await request(server())
        .post('/api/v1/inventory/check')
        .set(asStaff())
        .send({
          facilityId,
          issueDate: '2026-08-01',
          items: [{ itemName: ITEM, unit: UNIT, quantity: 25 }],
        })
        .expect(201);
      expect(check.body.ok).toBe(false);
      expect(check.body.shortages[0].availableQty).toBe(20);

      // Xuất đúng bằng tồn → thành công
      const ok = await issueOut(20, '2026-08-01').expect(201);
      expect(ok.body.issueCode).toMatch(/^PX-\d{4}-\d{3}$/);

      // Giờ tồn = 0 → xuất thêm 0.001 cũng bị chặn
      await issueOut(0.001, '2026-08-02').expect(400);
    });

    it('không thể xuất TRƯỚC ngày có hàng (tồn tính đến issueDate)', async () => {
      // Tồn chỉ có từ 10/6 — xuất ngày 01/06 → 400
      await issueOut(1, '2026-06-01').expect(400);
    });

    it('phiếu nhập DRAFT không được tính vào tồn', async () => {
      await stockIn(100, '2026-08-05', false); // DRAFT, không confirm
      await issueOut(1, '2026-08-10').expect(400); // tồn vẫn 0
    });
  });

  describe('Cancel hoàn tồn (soft-void)', () => {
    it('huỷ phiếu xuất → tồn hoàn lại, xuất lại được; bản ghi vẫn còn CANCELLED', async () => {
      // Tồn hiện tại = 0 (đã xuất hết 20). Nhập thêm 5.
      await stockIn(5, '2026-08-10');
      const issue = (await issueOut(5, '2026-08-11').expect(201)).body;

      // Hết tồn
      await issueOut(1, '2026-08-12').expect(400);

      // Huỷ phiếu → hoàn tồn
      await request(server())
        .post(`/api/v1/inventory/issues/${issue.id}/cancel`)
        .set(asStaff())
        .expect(201)
        .expect((res) => expect(res.body.status).toBe('CANCELLED'));

      // Soft-void: bản ghi vẫn còn trong DB
      const db = await prisma.inventoryIssue.findUnique({ where: { id: issue.id } });
      expect(db?.status).toBe('CANCELLED');
      expect(db?.cancelledBy).toBeTruthy();

      // Audit
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'CANCEL_ISSUE', entityId: issue.id },
      });
      expect(audit).toBeTruthy();

      // Xuất lại được 5 — chứng minh tồn đã hoàn đúng
      await issueOut(5, '2026-08-12').expect(201);

      // Huỷ lần 2 → 409
      await request(server())
        .post(`/api/v1/inventory/issues/${issue.id}/cancel`)
        .set(asStaff())
        .expect(409);
    });
  });

  describe('Báo cáo NXT: Tồn cuối = Tồn đầu + Nhập − Xuất', () => {
    // Dữ liệu tích luỹ đến đây (CONFIRMED/ACTIVE):
    // Nhập: 10 (10/6), 10 (10/7), 5 (10/8) · Xuất: 20 (01/8), 5 (12/8)
    it('kỳ tháng 8: tồn đầu 20, nhập 5, xuất 25, tồn cuối 0', async () => {
      const row = await getReportRow('2026-08-01', '2026-08-31');
      expect(row).toMatchObject({
        openingQty: 20,
        receivedQty: 5,
        issuedQty: 25,
        closingQty: 0,
      });
    });

    it('kỳ tháng 7: tồn đầu 10, nhập 10, xuất 0, tồn cuối 20', async () => {
      const row = await getReportRow('2026-07-01', '2026-07-31');
      expect(row).toMatchObject({
        openingQty: 10,
        receivedQty: 10,
        issuedQty: 0,
        closingQty: 20,
      });
    });

    it('thẻ kho khớp chuyển động + tồn luỹ kế', async () => {
      const res = await request(server())
        .get(
          `/api/v1/inventory/card?facilityId=${facilityId}&itemName=${encodeURIComponent(ITEM)}&unit=${UNIT}&from=2026-08-01&to=2026-08-31`,
        )
        .set(asStaff())
        .expect(200);

      expect(res.body.openingQty).toBe(20);
      expect(res.body.closingQty).toBe(0);
      // Chuyển động tháng 8: xuất 20 (01/8), nhập 5 (10/8), xuất 5 (12/8)
      const seq = res.body.entries.map((e: { type: string; quantity: number; balance: number }) => [
        e.type,
        e.quantity,
        e.balance,
      ]);
      expect(seq).toEqual([
        ['XUAT', 20, 0],
        ['NHAP', 5, 5],
        ['XUAT', 5, 0],
      ]);
    });
  });

  describe('Phân quyền', () => {
    it('user không có inventory.* → 403 cả view lẫn edit', async () => {
      const email = `noinv${process.pid}@debtflow.local`;
      const user = await request(server())
        .post('/api/v1/users')
        .set(asAdmin())
        .send({ name: 'NoInv', email, password: 'noinv123', role: 'STAFF' })
        .expect(201);
      await request(server())
        .put(`/api/v1/users/${user.body.id}/permissions`)
        .set(asAdmin())
        .send({ permissions: [{ module: 'dashboard', action: 'view', allowed: true }] })
        .expect(200);

      const token = (
        await request(server())
          .post('/api/v1/auth/login')
          .send({ email, password: 'noinv123' })
          .expect(201)
      ).body.accessToken;

      await request(server())
        .get(`/api/v1/inventory/report?from=2026-08-01&to=2026-08-31`)
        .set({ Authorization: `Bearer ${token}` })
        .expect(403);
      await request(server())
        .post('/api/v1/inventory/issues')
        .set({ Authorization: `Bearer ${token}` })
        .send({ facilityId, issueDate: '2026-08-15', items: [{ itemName: ITEM, unit: UNIT, quantity: 1 }] })
        .expect(403);
    });
  });
});
