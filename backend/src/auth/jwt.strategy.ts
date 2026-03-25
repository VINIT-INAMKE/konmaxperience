import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../types/auth';

// Custom extractor: tries Bearer header first, then access_token cookie
function extractJwtFromHeaderOrCookie(req: Request): string | null {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;

  if (req?.cookies?.access_token) {
    return req.cookies.access_token;
  }
  if (req?.cookies?.customer_access_token) {
    return req.cookies.customer_access_token;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractJwtFromHeaderOrCookie,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'customer') {
      return { customerId: payload.customerId, type: 'customer' };
    }
    return { id: payload.userId, roleCode: payload.roleCode, type: 'staff' };
  }
}
