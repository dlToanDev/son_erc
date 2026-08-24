// E2E Đặt hàng → Duyệt (Phase 4) — cần DATABASE_URL trỏ tới DB đã seed.
// Trọng tâm: duyệt NGUYÊN TỬ trong 1 transaction + rollback thật khi lỗi giữa chừng.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

describe('Orders (e2e, DB thật đã seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let supplierId: string;
  let facilityId: string;
  let productIds: string[];
  // Giá gốc 2 mặt hàng đầu (đọc từ danh mục seed) — dùng kiểm chứng snapshot.
  let price0: number;
  let price1: number;
  const prisma = new PrismaClient();

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });
  const server = () => app.getHttpServer();

  const createOrder = async (token: Record<string, string>) => {
    const res = await request(server())
      .post('/api/v1/orders')
      .set(token)
      .send({
        supplierId,
        facilityId,
        note: 'Đơn e2e',
        items: [
          { productId: productIds[0], quantity: 10 },
          { productId: productIds[1], quantity: 2.5 },
        ],
      })
      .expect(201);
    return res.body;
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

    // Lấy master data từ seed.
    const suppliers = await request(server()).get('/api/v1/suppliers').set(asAdmin());
    const ncc1 = suppliers.body.find((s: { code: string }) => s.code === 'NCC001');
    supplierId = ncc1.id;
    const facilities = await request(server()).get('/api/v1/facilities').set(asAdmin());
    facilityId = facilities.body.find((f: { code: string }) => f.code === 'CS1').id;
    const products = await request(server())
      .get(`/api/v1/suppliers/${supplierId}/products`)
      .set(asAdmin());
    // Seed-agnostic: lấy 2 mặt hàng đầu của NCC + giá thực tế từ danh mục.
    // Trọng tâm test là giá đơn được snapshot server-side từ danh mục
    // (client không set giá) — không phụ thuộc tên/giá cụ thể của seed.
    productIds = [products.body[0].id, products.body[1].id];
    price0 = products.body[0].price;
    price1 = products.body[1].price;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Tạo đơn — giá snapshot server-side', () => {
    it('staff tạo đơn: giá lấy từ danh mục, không tin client', async () => {
      const order = await createOrder(asStaff());
      expect(order.status).toBe('PENDING');
      expect(order.orderCode).toMatch(/^DH-\d{4}-\d{3}$/);
      // Giá snapshot server-side lấy đúng từ danh mục (không tin client).
      expect(order.items[0].unitPrice).toBe(price0);
      expect(order.items[1].unitPrice).toBe(price1);
      expect(order.total).toBe(10 * price0 + 2.5 * price1);
    });

    it('sửa giá danh mục KHÔNG đổi giá đơn đã tạo (snapshot)', async () => {
      const order = await createOrder(asStaff());
      // Admin đổi giá mặt hàng
      await request(server())
        .patch(`/api/v1/suppliers/${supplierId}/products/${productIds[0]}`)
        .set(asAdmin())
        .send({ price: 999999 })
        .expect(200);

      const after = await request(server())
        .get(`/api/v1/orders/${order.id}`)
        .set(asStaff())
        .expect(200);
      expect(after.body.items[0].unitPrice).toBe(price0); // vẫn giá cũ

      // Trả lại giá gốc
      await request(server())
        .patch(`/api/v1/suppliers/${supplierId}/products/${productIds[0]}`)
        .set(asAdmin())
        .send({ price: price0 })
        .expect(200);
    });

    it('mặt hàng không thuộc NCC → 400', async () => {
      await request(server())
        .post('/api/v1/orders')
        .set(asStaff())
        .send({ supplierId, facilityId, items: [{ productId: 'khong-ton-tai', quantity: 1 }] })
        .expect(400);
    });
  });

  describe('Duyệt đơn — NGUYÊN TỬ trong 1 transaction', () => {
    it('admin duyệt: sinh Receipt CONFIRMED + Payable + cập nhật order + audit', async () => {
      const order = await createOrder(asStaff());

      const res = await request(server())
        .post(`/api/v1/orders/${order.id}/approve`)
        .set(asAdmin())
        .expect(201);

      const { order: updated, receipt, payable } = res.body;
      expect(updated.status).toBe('APPROVED');
      expect(updated.resultReceiptId).toBe(receipt.id);
      expect(updated.resultPayableId).toBe(payable.id);
      expect(receipt.status).toBe('CONFIRMED');
      expect(payable.totalAmount).toBe(order.total);
      expect(payable.invoiceCode).toBe(receipt.receiptCode);

      // Kiểm tra DB thật
      const dbReceipt = await prisma.purchaseReceipt.findUnique({
        where: { id: receipt.id },
        include: { items: true },
      });
      expect(dbReceipt?.status).toBe('CONFIRMED');
      expect(dbReceipt?.items).toHaveLength(2);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'APPROVE_ORDER', entityId: order.id },
      });
      expect(audit).toBeTruthy();
    });

    it('duyệt lần 2 → 409, không sinh thêm receipt/payable', async () => {
      const order = await createOrder(asStaff());
      await request(server()).post(`/api/v1/orders/${order.id}/approve`).set(asAdmin()).expect(201);

      const receiptsBefore = await prisma.purchaseReceipt.count();
      const payablesBefore = await prisma.payable.count();

      await request(server()).post(`/api/v1/orders/${order.id}/approve`).set(asAdmin()).expect(409);

      expect(await prisma.purchaseReceipt.count()).toBe(receiptsBefore);
      expect(await prisma.payable.count()).toBe(payablesBefore);
    });

    it('ROLLBACK THẬT: lỗi giữa transaction → order vẫn PENDING, không để lại receipt rác', async () => {
      const order = await createOrder(asStaff());

      // Dự đoán receiptCode tiếp theo và chiếm trước invoiceCode đó ở bảng payables
      // → bước tạo Payable trong transaction sẽ nổ P2002 SAU KHI receipt đã được tạo.
      const year = new Date().getFullYear();
      const count = await prisma.purchaseReceipt.count({
        where: { receiptCode: { startsWith: `PN-${year}-` } },
      });
      const predictedCode = `PN-${year}-${String(count + 1).padStart(3, '0')}`;

      const blocker = await prisma.payable.create({
        data: {
          invoiceCode: predictedCode, // chiếm chỗ
          supplierId,
          invoiceDate: new Date(),
          totalAmount: 1,
          createdBy: 'e2e-blocker',
        },
      });

      const receiptsBefore = await prisma.purchaseReceipt.count();

      // Duyệt phải thất bại (409 do P2002 được map thành Conflict)
      await request(server()).post(`/api/v1/orders/${order.id}/approve`).set(asAdmin()).expect(409);

      // ROLLBACK: order vẫn PENDING, receipt tạo giữa chừng đã bị huỷ theo transaction.
      const after = await prisma.purchaseOrder.findUnique({ where: { id: order.id } });
      expect(after?.status).toBe('PENDING');
      expect(after?.resultReceiptId).toBeNull();
      expect(await prisma.purchaseReceipt.count()).toBe(receiptsBefore);
      expect(
        await prisma.purchaseReceipt.findUnique({ where: { receiptCode: predictedCode } }),
      ).toBeNull();

      // Dọn blocker, rồi duyệt lại thành công — chứng minh hệ thống hồi phục sạch.
      await prisma.payable.delete({ where: { id: blocker.id } });
      await request(server()).post(`/api/v1/orders/${order.id}/approve`).set(asAdmin()).expect(201);
    });

    it('staff (không có orders.approve) duyệt → 403', async () => {
      const order = await createOrder(asStaff());
      await request(server()).post(`/api/v1/orders/${order.id}/approve`).set(asStaff()).expect(403);
      // Dọn: huỷ đơn để không ảnh hưởng pending-count các test sau.
      await request(server()).post(`/api/v1/orders/${order.id}/cancel`).set(asStaff()).expect(201);
    });
  });

  describe('Từ chối / Huỷ + state machine', () => {
    it('reject cần lý do, chuyển REJECTED + audit', async () => {
      const order = await createOrder(asStaff());

      await request(server())
        .post(`/api/v1/orders/${order.id}/reject`)
        .set(asAdmin())
        .send({})
        .expect(400); // thiếu lý do

      await request(server())
        .post(`/api/v1/orders/${order.id}/reject`)
        .set(asAdmin())
        .send({ reason: 'Giá chưa hợp lý' })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('REJECTED');
          expect(res.body.rejectReason).toBe('Giá chưa hợp lý');
        });

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'REJECT_ORDER', entityId: order.id },
      });
      expect(audit).toBeTruthy();
    });

    it('staff huỷ đơn PENDING của mình → CANCELLED + audit; huỷ lại → 409', async () => {
      const order = await createOrder(asStaff());
      await request(server())
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set(asStaff())
        .expect(201)
        .expect((res) => expect(res.body.status).toBe('CANCELLED'));

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'CANCEL_ORDER', entityId: order.id },
      });
      expect(audit).toBeTruthy();

      await request(server()).post(`/api/v1/orders/${order.id}/cancel`).set(asStaff()).expect(409);
    });

    it('duyệt đơn đã CANCELLED → 409', async () => {
      const order = await createOrder(asStaff());
      await request(server()).post(`/api/v1/orders/${order.id}/cancel`).set(asStaff()).expect(201);
      await request(server()).post(`/api/v1/orders/${order.id}/approve`).set(asAdmin()).expect(409);
    });
  });

  describe('List & pending count', () => {
    it('lọc theo cơ sở + trạng thái', async () => {
      const res = await request(server())
        .get(`/api/v1/orders?facilityId=${facilityId}&status=PENDING`)
        .set(asStaff())
        .expect(200);
      for (const o of res.body) {
        expect(o.facilityId).toBe(facilityId);
        expect(o.status).toBe('PENDING');
      }
    });

    it('GET /orders/pending-count khớp số thật', async () => {
      const expected = await prisma.purchaseOrder.count({ where: { status: 'PENDING' } });
      const res = await request(server())
        .get('/api/v1/orders/pending-count')
        .set(asAdmin())
        .expect(200);
      expect(res.body.count).toBe(expected);
    });
  });
});
