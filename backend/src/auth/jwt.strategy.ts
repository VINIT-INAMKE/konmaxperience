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

  // Only userId and roleCode in token -- permissions resolved from cache per request
  async validate(payload: JwtPayload) {
    return { id: payload.userId, roleCode: payload.roleCode };
  }
}
