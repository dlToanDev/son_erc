// E2E Auth + RBAC — cần DATABASE_URL trỏ tới DB đã seed (admin/staff mặc định).
import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../src/auth/guards/permission.guard';
import { RequirePermission } from '../src/auth/decorators/require-permission.decorator';

// Controller thử nghiệm quyền — mô phỏng endpoint nghiệp vụ của Phase 3+.
@Controller('rbac-demo')
@UseGuards(JwtAuthGuard, PermissionGuard)
class RbacDemoController {
  /** STAFF seed CÓ quyền suppliers.view */
  @Get('suppliers-view')
  @RequirePermission('suppliers', 'view')
  suppliersView() {
    return { ok: true };
  }

  /** STAFF seed KHÔNG có quyền users.edit */
  @Get('users-edit')
  @RequirePermission('users', 'edit')
  usersEdit() {
    return { ok: true };
  }
}

describe('Auth + RBAC (e2e, DB thật đã seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RbacDemoController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login admin đúng mật khẩu → 201 + accessToken + refresh cookie, không lộ hash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@debtflow.local', password: 'admin123' })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe('ADMIN');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refresh = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refresh).toContain('HttpOnly');
    refreshCookie = refresh!;
    adminToken = res.body.accessToken;
  });

  it('POST /auth/login sai mật khẩu → 401', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@debtflow.local', password: 'wrong-password' })
      .expect(401);
  });

  it('POST /auth/login body không hợp lệ (DTO) → 400', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);
  });

  it('GET /auth/me không token → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('GET /auth/me với access token → 200 + permissions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.email).toBe('admin@debtflow.local');
    expect(res.body).toHaveProperty('permissions');
  });

  it('POST /auth/refresh với cookie hợp lệ → access token mới', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(201);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('POST /auth/refresh không cookie → 401', () => {
    return request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('refresh token KHÔNG dùng được làm access token (Bearer) → 401', async () => {
    const raw = refreshCookie.split(';')[0].split('=')[1];
    return request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${raw}`)
      .expect(401);
  });

  describe('PermissionGuard (RBAC)', () => {
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'staff@debtflow.local', password: 'staff123' })
        .expect(201);
      staffToken = res.body.accessToken;
    });

    it('chưa đăng nhập → 401', () => {
      return request(app.getHttpServer()).get('/api/v1/rbac-demo/suppliers-view').expect(401);
    });

    it('STAFF có quyền suppliers.view → 200', () => {
      return request(app.getHttpServer())
        .get('/api/v1/rbac-demo/suppliers-view')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });

    it('STAFF thiếu quyền users.edit → 403', () => {
      return request(app.getHttpServer())
        .get('/api/v1/rbac-demo/users-edit')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('ADMIN toàn quyền (users.edit) → 200', () => {
      return request(app.getHttpServer())
        .get('/api/v1/rbac-demo/users-edit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
