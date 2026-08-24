import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CustomerAuthController } from './customer-auth.controller';
import { EventsController } from '../events/events.controller';
import { CatalogController } from '../catalog/catalog.controller';

/**
 * A guard-wiring regression test, not a behaviour test.
 *
 * NestJS runs the **global** guards before the route-level ones, and the global
 * `PermissionsGuard` returns `false` for `user.type === 'customer'` on any route
 * not marked `@Public()`. So a customer route guarded only by
 * `@UseGuards(CustomerGuard)` answers `403` to its own logged-in customer.
 *
 * Six routes shipped that way and were reproduced answering `403` against a
 * running server before this file existed. Because the failure is invisible in
 * the source — the decorator that is *missing* is the bug — a future refactor
 * could silently re-break the whole account surface. These assertions read the
 * metadata straight off the handler so it cannot.
 *
 * `@Public()` is not a hole: it switches off the global staff stack only.
 * `CustomerGuard.handleRequest` still rejects a missing or staff token with
 * `401`, which the runtime probe confirmed for the anonymous case.
 */

const isPublic = (handler: unknown): unknown =>
  Reflect.getMetadata(IS_PUBLIC_KEY, handler as object);

const requiredPermission = (handler: unknown): unknown =>
  Reflect.getMetadata(REQUIRED_PERMISSION_KEY, handler as object);

describe('customer route guard wiring (P5b gap 1 & 2)', () => {
  describe('CustomerAuthController — the four session routes', () => {
    it.each([
      ['getProfile', CustomerAuthController.prototype.getProfile],
      ['updateProfile', CustomerAuthController.prototype.updateProfile],
      ['logout', CustomerAuthController.prototype.logout],
      ['pusherAuth', CustomerAuthController.prototype.pusherAuth],
    ])('%s is @Public() so PermissionsGuard cannot 403 it', (_name, handler) => {
      expect(isPublic(handler)).toBe(true);
    });

    it('leaves the two already-public OTP routes public', () => {
      expect(isPublic(CustomerAuthController.prototype.sendOtp)).toBe(true);
      expect(isPublic(CustomerAuthController.prototype.verifyOtp)).toBe(true);
    });

    it('marks no customer-auth route with a staff permission', () => {
      for (const handler of [
        CustomerAuthController.prototype.getProfile,
        CustomerAuthController.prototype.updateProfile,
        CustomerAuthController.prototype.logout,
        CustomerAuthController.prototype.pusherAuth,
      ]) {
        expect(requiredPermission(handler)).toBeUndefined();
      }
    });
  });

  describe('EventsController — the two customer booking routes', () => {
    it.each([
      ['checkout', EventsController.prototype.checkout],
      ['confirmBooking', EventsController.prototype.confirmBooking],
    ])('%s is @Public() so a customer can book an experience', (_n, handler) => {
      expect(isPublic(handler)).toBe(true);
    });

    it('keeps the staff attendance route behind a permission, not @Public()', () => {
      expect(
        isPublic(EventsController.prototype.markAttendance),
      ).toBeUndefined();
      expect(requiredPermission(EventsController.prototype.markAttendance)).toBe(
        Permission.MANAGE_OPS,
      );
    });
  });

  describe('CatalogController — availability', () => {
    it('makes the per-product route public like its batch sibling', () => {
      expect(isPublic(CatalogController.prototype.availability)).toBe(true);
      expect(isPublic(CatalogController.prototype.allAvailability)).toBe(true);
    });

    it('leaves the staff channel-modifier route non-public', () => {
      expect(
        isPublic(CatalogController.prototype.findModifiers),
      ).toBeUndefined();
    });
  });
});
