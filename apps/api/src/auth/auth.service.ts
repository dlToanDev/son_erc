import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { AuthResult, AuthUser } from '@debtflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { jwtConstants, JwtPayload } from './jwt.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Đăng nhập: so bcrypt, cập nhật lastLoginAt, ghi audit LOGIN. */
  async login(email: string, password: string): Promise<AuthResult & { refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { permissions: true },
    });

    // Thông báo chung — không lộ email tồn tại hay không.
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const matched = await bcrypt.compare(password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entityType: 'AUTH', entityId: user.id, detail: 'Đăng nhập hệ thống' },
    });

    return {
      accessToken: this.signAccess(user.id, user.email, user.role),
      refreshToken: this.signRefresh(user.id, user.email, user.role),
      user: this.toAuthUser(user),
    };
  }

  /** Refresh: verify refresh token → cấp access mới + xoay refresh mới. */
  async refresh(refreshToken: string): Promise<AuthResult & { refreshToken: string }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: jwtConstants.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập hết hạn');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { permissions: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không còn hiệu lực');
    }

    return {
      accessToken: this.signAccess(user.id, user.email, user.role),
      refreshToken: this.signRefresh(user.id, user.email, user.role),
      user: this.toAuthUser(user),
    };
  }

  /** Thông tin user hiện tại (kèm permissions) — không bao giờ trả password_hash. */
  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { permissions: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản không còn hiệu lực');
    }
    return this.toAuthUser(user);
  }

  private signAccess(sub: string, email: string, role: 'ADMIN' | 'STAFF'): string {
    const payload: JwtPayload = { sub, email, role, type: 'access' };
    return this.jwt.sign(payload, {
      secret: jwtConstants.accessSecret(),
      expiresIn: jwtConstants.accessTtl(),
    });
  }

  private signRefresh(sub: string, email: string, role: 'ADMIN' | 'STAFF'): string {
    const payload: JwtPayload = { sub, email, role, type: 'refresh' };
    return this.jwt.sign(payload, {
      secret: jwtConstants.refreshSecret(),
      expiresIn: jwtConstants.refreshTtl(),
    });
  }

  private toAuthUser(user: {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'STAFF';
    permissions: { module: string; action: string; allowed: boolean }[];
  }): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions.map((p) => ({
        module: p.module,
        action: p.action,
        allowed: p.allowed,
      })),
    };
  }
}
