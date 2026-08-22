import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit authenticated requests per principal (staff `user.id` or customer
 * `user.customerId` as set by JwtStrategy.validate) and anonymous requests per
 * client IP, preferring Cloudflare's `cf-connecting-ip` header.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const principalId: string | undefined =
      req.user?.id ?? req.user?.userId ?? req.user?.customerId;
    if (principalId) return `user:${principalId}`;

    const header = req.headers?.['cf-connecting-ip'];
    const cfIp = Array.isArray(header) ? header[0] : header;
    return cfIp ?? req.ip ?? 'unknown';
  }
}
