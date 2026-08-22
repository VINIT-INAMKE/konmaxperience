import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../types/auth';

// Custom extractor: tries Bearer header, then access_token (staff), then customer_token (customer)
// Two separate cookies allow both sessions to coexist in the same browser
function extractJwtFromHeaderOrCookie(req: Request): string | null {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;

  // Staff cookie (ops routes)
  if (req?.cookies?.access_token) {
    return req.cookies.access_token;
  }
  // Customer cookie (public routes)
  if (req?.cookies?.customer_token) {
    return req.cookies.customer_token;
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
    // Only access tokens are valid bearer credentials. Refresh tokens (and any
    // legacy token issued before token_use existed) are rejected outright.
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (payload.type === 'customer') {
      return { customerId: payload.customerId, type: 'customer' };
    }
    return { id: payload.userId, roleCode: payload.roleCode, type: 'staff' };
  }
}
