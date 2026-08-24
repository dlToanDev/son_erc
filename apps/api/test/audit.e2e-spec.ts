// E2E Phase 8 — Audit log: phân trang, lọc, truy vết đủ hành động.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

describe('Audit logs (e2e, DB thật đã seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  const prisma = new PrismaClient();
  const suffix = `${process.pid}${Math.floor(Math.random() * 10000)}`;

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asStaff = () => ({ Authorization: `Bearer ${staffToken}` });
  const server = () => app.getHttpServer();

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('mọi hành động thay đổi đều truy vết được: tạo NCC → có audit CREATE_SUPPLIER kèm tên user', async () => {
    await request(server())
      .post('/api/v1/suppliers')
      .set(asAdmin())
      .send({ code: `AUD${suffix}`, name: 'NCC audit test' })
      .expect(201);

    const res = await request(server())
      .get('/api/v1/audit-logs?action=CREATE_SUPPLIER&pageSize=5')
      .set(asAdmin())
      .expect(200);

    const entry = res.body.data.find((e: { detail: string }) => e.detail?.includes(`AUD${suffix}`));
    expect(entry).toBeDefined();
    expect(entry.userName).toBe('Quản trị viên');
    expect(entry.entityType).toBe('SUPPLIER');
  });

  it('phân trang: total đúng, pageSize được tôn trọng, trang sau không trùng trang trước', async () => {
    const expected = await prisma.auditLog.count();
    const page1 = await request(server())
      .get('/api/v1/audit-logs?page=1&pageSize=5')
      .set(asAdmin())
      .expect(200);
    expect(page1.body.total).toBe(expected);
    expect(page1.body.data.length).toBeLessThanOrEqual(5);

    const page2 = await request(server())
      .get('/api/v1/audit-logs?page=2&pageSize=5')
      .set(asAdmin())
      .expect(200);
    const ids1 = new Set(page1.body.data.map((e: { id: string }) => e.id));
    for (const e of page2.body.data) {
      expect(ids1.has(e.id)).toBe(false);
    }
  });

  it('sắp xếp mới nhất trước (time desc)', async () => {
    const res = await request(server())
      .get('/api/v1/audit-logs?pageSize=20')
      .set(asAdmin())
      .expect(200);
    const times = res.body.data.map((e: { time: string }) => e.time);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('lọc action=LOGIN chỉ trả LOGIN; lọc entityType hoạt động', async () => {
    const res = await request(server())
      .get('/api/v1/audit-logs?action=LOGIN&pageSize=50')
      .set(asAdmin())
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const e of res.body.data) expect(e.action).toBe('LOGIN');

    const byType = await request(server())
      .get('/api/v1/audit-logs?entityType=AUTH&pageSize=50')
      .set(asAdmin())
      .expect(200);
    for (const e of byType.body.data) expect(e.entityType).toBe('AUTH');
  });

  it('staff (có audit.view từ seed) → 200; user không có audit.view → 403', async () => {
    await request(server()).get('/api/v1/audit-logs').set(asStaff()).expect(200);

    const email = `noaudit${suffix}@debtflow.local`;
    const user = await request(server())
      .post('/api/v1/users')
      .set(asAdmin())
      .send({ name: 'NoAudit', email, password: 'noaud123', role: 'STAFF' })
      .expect(201);
    await request(server())
      .put(`/api/v1/users/${user.body.id}/permissions`)
      .set(asAdmin())
      .send({ permissions: [{ module: 'dashboard', action: 'view', allowed: true }] })
      .expect(200);
    const token = (
      await request(server()).post('/api/v1/auth/login').send({ email, password: 'noaud123' })
    ).body.accessToken;
    await request(server())
      .get('/api/v1/audit-logs')
      .set({ Authorization: `Bearer ${token}` })
      .expect(403);
  });

  it('from/to sai định dạng → 400; pageSize bị chặn trần 100', async () => {
    await request(server()).get('/api/v1/audit-logs?from=hom-qua').set(asAdmin()).expect(400);
    const res = await request(server())
      .get('/api/v1/audit-logs?pageSize=9999')
      .set(asAdmin())
      .expect(200);
    expect(res.body.pageSize).toBe(100);
  });
});
