// E2E Master data (Phase 3) — cần DATABASE_URL trỏ tới DB đã seed.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { invoiceBalance } from '../src/domain';

describe('Master data (e2e, DB thật đã seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  const suffix = `${process.pid}${Math.floor(Math.random() * 10000)}`;

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const server = app.getHttpServer();
    adminToken = (
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@debtflow.local', password: 'admin123' })
    ).body.accessToken;
    staffToken = (
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'staff@debtflow.local', password: 'staff123' })
    ).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---- Facilities ----
  describe('Facilities', () => {
    it('GET /facilities — staff đọc được (mọi user đăng nhập)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set(asStaff())
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /facilities — staff không có settings.edit → 403', () => {
      return request(app.getHttpServer())
        .post('/api/v1/facilities')
        .set(asStaff())
        .send({ code: `X${suffix}`, name: 'Không được tạo' })
        .expect(403);
    });

    it('POST + PATCH /facilities — admin tạo và ẩn được', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/facilities')
        .set(asAdmin())
        .send({ code: `CS-T${suffix}`, name: 'Cơ sở test', address: 'Test' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/facilities/${created.body.id}`)
        .set(asAdmin())
        .send({ status: 'INACTIVE' })
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('INACTIVE'));
    });

    it('POST /facilities trùng mã → 409', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/facilities')
        .set(asAdmin())
        .send({ code: 'CS1', name: 'Trùng mã' })
        .expect(409);
    });
  });

  // ---- Suppliers ----
  describe('Suppliers', () => {
    let supplierId: string;

    it('GET /suppliers — staff có suppliers.view → 200 kèm tổng công nợ khớp domain', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/suppliers')
        .set(asStaff())
        .expect(200);
      const ncc1 = res.body.find((s: { code: string }) => s.code === 'NCC001');
      expect(ncc1).toBeDefined();

      // Tính expected trực tiếp từ DB bằng domain logic (không hardcode —
      // các suite e2e khác có thể đã tạo thêm payables cho NCC001).
      const prisma = new PrismaClient();
      try {
        const payables = await prisma.payable.findMany({
          where: { supplierId: ncc1.id },
          include: { payments: { select: { amount: true, status: true } } },
        });
        let expectedInvoiced = 0;
        let expectedBalance = 0;
        for (const p of payables) {
          const total = Number(p.totalAmount);
          expectedInvoiced += total;
          expectedBalance += invoiceBalance(
            total,
            p.payments.map((pm) => ({ amount: Number(pm.amount), status: pm.status })),
          );
        }
        expect(ncc1.totalInvoiced).toBe(expectedInvoiced);
        expect(ncc1.balance).toBe(expectedBalance);
        expect(ncc1.totalPaid).toBe(expectedInvoiced - expectedBalance);
        expect(ncc1.totalInvoiced).toBeGreaterThanOrEqual(12960000); // ít nhất từ seed
      } finally {
        await prisma.$disconnect();
      }
    });

    it('POST /suppliers — staff có suppliers.edit → tạo được', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/suppliers')
        .set(asStaff())
        .send({ code: `NCC-T${suffix}`, name: 'NCC test staff' })
        .expect(201);
      supplierId = res.body.id;
    });

    it('GET /suppliers/:id — chi tiết kèm totals', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/suppliers/${supplierId}`)
        .set(asStaff())
        .expect(200);
      expect(res.body.balance).toBe(0);
    });

    it('PATCH /suppliers/:id — ẩn NCC', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/suppliers/${supplierId}`)
        .set(asStaff())
        .send({ status: 'INACTIVE' })
        .expect(200);
    });

    it('tìm kiếm ?search hoạt động', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/suppliers?search=An Phú')
        .set(asStaff())
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].code).toBe('NCC001');
    });

    // ---- Products ----
    it('GET products — staff có products.view → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/suppliers/${supplierId}/products`)
        .set(asStaff())
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('POST products — staff KHÔNG có products.edit → 403', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/suppliers/${supplierId}/products`)
        .set(asStaff())
        .send({ name: 'Hàng test', unit: 'Cái', price: 1000 })
        .expect(403);
    });

    it('POST + PATCH products — admin tạo/sửa được', async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/suppliers/${supplierId}/products`)
        .set(asAdmin())
        .send({ name: 'Hàng test', unit: 'Cái', price: 15000.5 })
        .expect(201);
      expect(created.body.price).toBe(15000.5);

      await request(app.getHttpServer())
        .patch(`/api/v1/suppliers/${supplierId}/products/${created.body.id}`)
        .set(asAdmin())
        .send({ price: 20000, status: 'INACTIVE' })
        .expect(200)
        .expect((res) => {
          expect(res.body.price).toBe(20000);
          expect(res.body.status).toBe('INACTIVE');
        });
    });
  });

  // ---- Users ----
  describe('Users', () => {
    let newUserId: string;

    it('GET /users — staff không có users.view → 403', () => {
      return request(app.getHttpServer()).get('/api/v1/users').set(asStaff()).expect(403);
    });

    it('GET /users — admin → 200, không lộ passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set(asAdmin())
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('POST /users — admin tạo user mới', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(asAdmin())
        .send({
          name: 'User Test',
          email: `test${suffix}@debtflow.local`,
          password: 'test123',
          role: 'STAFF',
        })
        .expect(201);
      newUserId = res.body.id;
    });

    it('PUT /users/:id/permissions — cấp quyền và quyền có hiệu lực ngay', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/users/${newUserId}/permissions`)
        .set(asAdmin())
        .send({ permissions: [{ module: 'suppliers', action: 'view', allowed: true }] })
        .expect(200);

      // User mới đăng nhập và dùng được quyền vừa cấp.
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `test${suffix}@debtflow.local`, password: 'test123' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/suppliers')
        .set({ Authorization: `Bearer ${login.body.accessToken}` })
        .expect(200);

      // Nhưng không có users.view.
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set({ Authorization: `Bearer ${login.body.accessToken}` })
        .expect(403);
    });

    it('PATCH /users/:id — khoá user', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/users/${newUserId}`)
        .set(asAdmin())
        .send({ status: 'INACTIVE' })
        .expect(200);
    });

    it('admin không thể tự khoá chính mình → 403', async () => {
      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(asAdmin())
        .expect(200);
      return request(app.getHttpServer())
        .patch(`/api/v1/users/${me.body.id}`)
        .set(asAdmin())
        .send({ status: 'INACTIVE' })
        .expect(403);
    });
  });

  // ---- Settings ----
  describe('Settings', () => {
    it('GET /settings — staff đọc được', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings')
        .set(asStaff())
        .expect(200);
      expect(res.body).toHaveProperty('warningDays');
    });

    it('PUT /settings — staff không có settings.edit → 403', () => {
      return request(app.getHttpServer())
        .put('/api/v1/settings')
        .set(asStaff())
        .send({ warningDays: 10 })
        .expect(403);
    });

    it('PUT /settings — admin cập nhật được', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/settings')
        .set(asAdmin())
        .send({ warningDays: 10, criticalWarningDays: 5 })
        .expect(200)
        .expect((res) => {
          expect(res.body.warningDays).toBe(10);
          expect(res.body.criticalWarningDays).toBe(5);
        });
      // Trả lại default cho các test khác.
      await request(app.getHttpServer())
        .put('/api/v1/settings')
        .set(asAdmin())
        .send({ warningDays: 7, criticalWarningDays: 3 })
        .expect(200);
    });
  });
});
