// E2E Phase 5 — vòng đời tài chính: Phiếu nhập → Công nợ → Thanh toán → Void.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

describe('Finance (e2e, DB thật đã seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let supplierId: string;
  let facilityId: string;
  const prisma = new PrismaClient();
  const suffix = `${process.pid}${Math.floor(Math.random() * 10000)}`;

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });
  const server = () => app.getHttpServer();

  /** Tạo phiếu nhập DRAFT chuẩn: 10×100k + 2.5×200k − 50k giảm + 30k VAT = 1.480.000 */
  const createDraft = (overrides: Record<string, unknown> = {}) =>
    request(server())
      .post('/api/v1/receipts')
      .set(asStaff())
      .send({
        supplierId,
        facilityId,
        receiptDate: '2026-08-20',
        dueDate: '2026-09-20',
        discountAmount: 50000,
        taxAmount: 30000,
        items: [
          { itemName: 'Hàng A', unit: 'Kg', quantity: 10, unitPrice: 100000 },
          { itemName: 'Hàng B', unit: 'Thùng', quantity: 2.5, unitPrice: 200000 },
        ],
        ...overrides,
      });

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

  describe('Phiếu nhập DRAFT → CONFIRMED', () => {
    it('staff tạo DRAFT nhiều dòng, tổng tiền đúng công thức (SL thập phân + giảm giá + VAT)', async () => {
      const res = await createDraft().expect(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.subtotal).toBe(10 * 100000 + 2.5 * 200000); // 1.500.000
      expect(res.body.grandTotal).toBe(1500000 - 50000 + 30000); // 1.480.000
      expect(res.body.payableId).toBeNull();
    });

    it('confirm → CONFIRMED + sinh Payable đúng grandTotal + audit (1 transaction)', async () => {
      const draft = (await createDraft().expect(201)).body;

      const res = await request(server())
        .post(`/api/v1/receipts/${draft.id}/confirm`)
        .set(asStaff())
        .expect(201);

      expect(res.body.receipt.status).toBe('CONFIRMED');
      expect(res.body.payable.totalAmount).toBe(1480000);
      expect(res.body.payable.status).toBe('UNPAID');
      expect(res.body.payable.invoiceCode).toBe(draft.receiptCode); // không có số HĐ NCC

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'CONFIRM_RECEIPT', entityId: draft.id },
      });
      expect(audit).toBeTruthy();
    });

    it('confirm lần 2 → 409, không sinh thêm payable', async () => {
      const draft = (await createDraft().expect(201)).body;
      await request(server()).post(`/api/v1/receipts/${draft.id}/confirm`).set(asStaff()).expect(201);

      const before = await prisma.payable.count();
      await request(server()).post(`/api/v1/receipts/${draft.id}/confirm`).set(asStaff()).expect(409);
      expect(await prisma.payable.count()).toBe(before);
    });

    it('supplierInvoiceCode được dùng làm invoiceCode của payable', async () => {
      const code = `NCC-HD-${suffix}`;
      const draft = (await createDraft({ supplierInvoiceCode: code }).expect(201)).body;
      const res = await request(server())
        .post(`/api/v1/receipts/${draft.id}/confirm`)
        .set(asStaff())
        .expect(201);
      expect(res.body.payable.invoiceCode).toBe(code);
    });
  });

  describe('Công nợ: UNPAID → PARTIAL → PAID (runtime) + chặn trả vượt + void hoàn số dư', () => {
    let payableId: string;

    beforeAll(async () => {
      const draft = (await createDraft().expect(201)).body;
      const confirmed = await request(server())
        .post(`/api/v1/receipts/${draft.id}/confirm`)
        .set(asStaff())
        .expect(201);
      payableId = confirmed.body.payable.id; // 1.480.000
    });

    const getPayable = async () =>
      (await request(server()).get(`/api/v1/payables/${payableId}`).set(asStaff()).expect(200)).body;

    it('ban đầu UNPAID, balance = totalAmount', async () => {
      const p = await getPayable();
      expect(p.status).toBe('UNPAID');
      expect(p.balance).toBe(1480000);
    });

    it('trả một phần 480.000 → PARTIAL, balance 1.000.000', async () => {
      await request(server())
        .post('/api/v1/payments')
        .set(asStaff())
        .send({ payableId, amount: 480000, paymentDate: '2026-08-21', paymentMethod: 'CASH' })
        .expect(201);

      const p = await getPayable();
      expect(p.status).toBe('PARTIAL');
      expect(p.paid).toBe(480000);
      expect(p.balance).toBe(1000000);
    });

    it('trả vượt số dư → 400, không tạo giao dịch', async () => {
      const before = await prisma.payment.count({ where: { payableId } });
      await request(server())
        .post('/api/v1/payments')
        .set(asStaff())
        .send({ payableId, amount: 1000001, paymentDate: '2026-08-21' })
        .expect(400);
      expect(await prisma.payment.count({ where: { payableId } })).toBe(before);
    });

    it('trả nốt 1.000.000 → PAID, balance 0', async () => {
      await request(server())
        .post('/api/v1/payments')
        .set(asStaff())
        .send({ payableId, amount: 1000000, paymentDate: '2026-08-21', transactionCode: `TX${suffix}` })
        .expect(201);

      const p = await getPayable();
      expect(p.status).toBe('PAID');
      expect(p.balance).toBe(0);
      // Đã PAID → trả thêm bị chặn
      await request(server())
        .post('/api/v1/payments')
        .set(asStaff())
        .send({ payableId, amount: 1, paymentDate: '2026-08-21' })
        .expect(400);
    });

    it('VOID thanh toán 480k → soft-void, hoàn số dư, quay lại PARTIAL + audit', async () => {
      const p = await getPayable();
      const target = p.payments.find(
        (pm: { amount: number; status: string }) => pm.amount === 480000 && pm.status === 'ACTIVE',
      );

      await request(server()).post(`/api/v1/payments/${target.id}/void`).set(asStaff()).expect(201);

      const after = await getPayable();
      expect(after.status).toBe('PARTIAL'); // 1tr ACTIVE còn lại
      expect(after.balance).toBe(480000); // hoàn đúng số dư
      expect(after.paid).toBe(1000000);

      // Soft-void: bản ghi VẪN CÒN trong DB với status CANCELLED (không xoá cứng).
      const dbPayment = await prisma.payment.findUnique({ where: { id: target.id } });
      expect(dbPayment).toBeTruthy();
      expect(dbPayment?.status).toBe('CANCELLED');
      expect(dbPayment?.cancelledBy).toBeTruthy();

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'VOID_PAYMENT', entityId: target.id },
      });
      expect(audit).toBeTruthy();

      // Void lần 2 → 409
      await request(server()).post(`/api/v1/payments/${target.id}/void`).set(asStaff()).expect(409);
    });
  });

  describe('OVERDUE theo dueDate', () => {
    it('phiếu quá hạn → confirm → payable OVERDUE ngay', async () => {
      const draft = (
        await createDraft({ receiptDate: '2026-01-05', dueDate: '2026-01-25' }).expect(201)
      ).body;
      const confirmed = await request(server())
        .post(`/api/v1/receipts/${draft.id}/confirm`)
        .set(asStaff())
        .expect(201);

      const p = (
        await request(server())
          .get(`/api/v1/payables/${confirmed.body.payable.id}`)
          .set(asStaff())
          .expect(200)
      ).body;
      expect(p.status).toBe('OVERDUE'); // hôm nay 2026-08-21 > 2026-01-25

      // Lọc theo trạng thái runtime hoạt động
      const overdueList = (
        await request(server()).get('/api/v1/payables?status=OVERDUE').set(asStaff()).expect(200)
      ).body;
      expect(overdueList.some((x: { id: string }) => x.id === p.id)).toBe(true);
    });
  });

  describe('Phân quyền', () => {
    it('user chỉ có payables.view: xem được nhưng POST payment → 403', async () => {
      // Tạo user quyền hạn chế
      const email = `viewer${suffix}@debtflow.local`;
      const user = await request(server())
        .post('/api/v1/users')
        .set(asAdmin())
        .send({ name: 'Viewer', email, password: 'view123', role: 'STAFF' })
        .expect(201);
      await request(server())
        .put(`/api/v1/users/${user.body.id}/permissions`)
        .set(asAdmin())
        .send({ permissions: [{ module: 'payables', action: 'view', allowed: true }] })
        .expect(200);

      const token = (
        await request(server())
          .post('/api/v1/auth/login')
          .send({ email, password: 'view123' })
          .expect(201)
      ).body.accessToken;

      await request(server())
        .get('/api/v1/payables')
        .set({ Authorization: `Bearer ${token}` })
        .expect(200);

      const anyPayable = await prisma.payable.findFirst();
      await request(server())
        .post('/api/v1/payments')
        .set({ Authorization: `Bearer ${token}` })
        .send({ payableId: anyPayable!.id, amount: 1, paymentDate: '2026-08-21' })
        .expect(403);

      await request(server())
        .get('/api/v1/receipts')
        .set({ Authorization: `Bearer ${token}` })
        .expect(403); // không có receipts.view
    });
  });
});
