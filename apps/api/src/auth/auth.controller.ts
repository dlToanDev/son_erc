import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthResult, AuthUser } from '@debtflow/shared';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { REFRESH_COOKIE, RequestUser } from './jwt.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Đăng nhập — rate-limit 5 lần/phút chống brute-force. */
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    const { refreshToken, ...result } = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  /** Cấp access token mới từ refresh cookie (httpOnly). */
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? '';
    const { refreshToken, ...result } = await this.auth.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  /** Đăng xuất — xoá refresh cookie. */
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { ok: true };
  }

  /** Thông tin user hiện tại. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.auth.me(user.id);
  }

  private setRefreshCookie(res: Response, token: string): void {
    // ~7 ngày, khớp JWT_REFRESH_TTL; httpOnly + sameSite chặn XSS/CSRF cơ bản.
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
