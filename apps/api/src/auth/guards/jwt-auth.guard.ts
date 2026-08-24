import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Xác thực access token (Bearer). Trả 401 nếu thiếu/hết hạn/sai. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
