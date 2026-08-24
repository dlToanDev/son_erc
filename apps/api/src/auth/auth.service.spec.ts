import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  const jwt = new JwtService({});

  const makeUser = async (overrides: Record<string, unknown> = {}) => ({
    id: 'usr-1',
    name: 'Test User',
    email: 'test@debtflow.local',
    passwordHash: await bcrypt.hash('secret123', 4),
    role: 'STAFF' as const,
    status: 'ACTIVE' as const,
    permissions: [{ module: 'suppliers', action: 'view', allowed: true }],
    ...overrides,
  });

  const makePrisma = (user: unknown) =>
    ({
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    }) as unknown as PrismaService;

  it('login thành công trả accessToken + user không có password_hash', async () => {
    const user = await makeUser();
    const prisma = makePrisma(user);
    const service = new AuthService(prisma, jwt);

    const result = await service.login('test@debtflow.local', 'secret123');

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe('test@debtflow.local');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.permissions).toEqual([
      { module: 'suppliers', action: 'view', allowed: true },
    ]);
    // Ghi audit LOGIN
    expect((prisma.auditLog.create as jest.Mock).mock.calls[0][0].data.action).toBe('LOGIN');
  });

  it('login sai mật khẩu → UnauthorizedException', async () => {
    const service = new AuthService(makePrisma(await makeUser()), jwt);
    await expect(service.login('test@debtflow.local', 'wrong-pass')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('login user INACTIVE → UnauthorizedException', async () => {
    const service = new AuthService(makePrisma(await makeUser({ status: 'INACTIVE' })), jwt);
    await expect(service.login('test@debtflow.local', 'secret123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('login email không tồn tại → UnauthorizedException (thông báo chung)', async () => {
    const service = new AuthService(makePrisma(null), jwt);
    await expect(service.login('ghost@debtflow.local', 'secret123')).rejects.toThrow(
      'Email hoặc mật khẩu không đúng',
    );
  });

  it('refresh với token access (sai type) → UnauthorizedException', async () => {
    const user = await makeUser();
    const prisma = makePrisma(user);
    const service = new AuthService(prisma, jwt);

    const { accessToken } = await service.login('test@debtflow.local', 'secret123');
    await expect(service.refresh(accessToken)).rejects.toThrow(UnauthorizedException);
  });

  it('refresh với refresh token hợp lệ → cấp access mới', async () => {
    const user = await makeUser();
    const service = new AuthService(makePrisma(user), jwt);

    const { refreshToken } = await service.login('test@debtflow.local', 'secret123');
    const result = await service.refresh(refreshToken);
    expect(result.accessToken).toBeTruthy();
    expect(result.user.id).toBe('usr-1');
  });

  it('refresh token rác → UnauthorizedException', async () => {
    const service = new AuthService(makePrisma(await makeUser()), jwt);
    await expect(service.refresh('not-a-jwt')).rejects.toThrow('Phiên đăng nhập hết hạn');
  });
});
