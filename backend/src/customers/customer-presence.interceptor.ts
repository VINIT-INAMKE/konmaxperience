import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CustomerPresenceService } from './customer-presence.service';

/**
 * The three fields this interceptor reads off an Express request: what
 * `JwtStrategy.validate` attaches for a storefront token, plus the route the
 * dispatcher matched. Declared structurally rather than as an
 * `extends Request`, because Express types `route` as required `any`.
 */
interface CustomerRequest {
  user?: { type?: string; customerId?: string };
  route?: { path?: string };
  path?: string;
}

/** `UsageEvent.path` is `String?`; keep it inside a sane column width. */
const MAX_PATH = 256;

/**
 * Global interceptor that keeps `Customer.last_seen_at` current.
 *
 * Registered as an `APP_INTERCEPTOR` in `AppModule` rather than in `main.ts`,
 * because it needs injection (`main.ts` is a P5a no-touch file, decision 9) and
 * because guards run **before** interceptors — so by the time this runs,
 * `CustomerGuard` (or the global `JwtAuthGuard`) has already put the decoded
 * token on `req.user`. A staff request, an unauthenticated one and a
 * non-HTTP context all fall straight through.
 *
 * The interceptor does no work of its own: it hands the id to
 * `CustomerPresenceService`, which throttles and swallows everything, then
 * returns the untouched handler stream.
 */
@Injectable()
export class CustomerPresenceInterceptor implements NestInterceptor {
  constructor(private readonly presence: CustomerPresenceService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<CustomerRequest>();
      const user = req.user;
      if (user?.type === 'customer' && user.customerId) {
        // The route *pattern* (`/customer/orders/:id`), not the concrete URL,
        // so the usage roll-up groups by screen instead of by order id.
        const path = (req.route?.path ?? req.path ?? null)?.slice(0, MAX_PATH);
        this.presence.touch(user.customerId, path);
      }
    }
    return next.handle();
  }
}
