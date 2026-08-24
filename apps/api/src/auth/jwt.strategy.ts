import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants, JwtPayload, RequestUser } from './jwt.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.accessSecret(),
    });
  }

  validate(payload: JwtPayload): RequestUser {
    // Chỉ chấp nhận access token ở Bearer header — refresh token không dùng được thay thế.
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
