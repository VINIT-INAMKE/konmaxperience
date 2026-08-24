import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrderChannel } from '@prisma/client';
import { CustomerGuard } from '../customer-auth/guards/customer.guard';
import { Public } from '../common/decorators/public.decorator';
import { CustomerOrdersService } from '../customer-orders/customer-orders.service';
import { CouponsService } from '../promotions/coupons.service';
import { ValidateCouponDto } from '../promotions/dto/validate-coupon.dto';
import { CartPricingService } from './cart-pricing.service';
import {
  CheckoutService,
  toQuoteResponse,
  type QuoteResponse,
  type ServiceabilityResponse,
} from './checkout.service';
import { QuoteCheckoutDto } from './dto/quote-checkout.dto';
import { ServiceabilityDto } from './dto/serviceability.dto';

/** The customer JWT payload `CustomerGuard` puts on the request. */
interface CustomerRequest {
  user: { customerId: string };
}

/**
 * The two storefront routes that need a *server-priced* cart.
 *
 * Both live here rather than on `CustomerOrdersController` (cart CRUD) or
 * `CouponsController` (staff CRUD) because both answers are derived from the
 * same re-pricing pass, and neither may ever trust a client-sent price
 * (`CHK-01`). Coupon validation in particular is server-only by `PROMO-02`.
 *
 * Guard stack mirrors `CustomerOrdersController` exactly: `@Public()` switches
 * off the global staff `JwtAuthGuard`, leaving `CustomerGuard` — which rejects
 * a staff token — as the only authority.
 */
@Controller('customer')
@UseGuards(CustomerGuard)
@Public()
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly carts: CustomerOrdersService,
    private readonly coupons: CouponsService,
    private readonly pricing: CartPricingService,
  ) {}

  /**
   * `CHK-02`. The cart comes from Redis, never from the body, so a client can
   * only ever quote its own cart.
   */
  @Post('checkout/quote')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async quote(
    @Req() req: CustomerRequest,
    @Body() dto: QuoteCheckoutDto,
  ): Promise<QuoteResponse> {
    const customerId = req.user.customerId;
    const cart = await this.carts.getCart(customerId);
    return toQuoteResponse(
      await this.checkout.quote(customerId, cart?.items ?? [], dto),
    );
  }

  /**
   * The address step's pre-check. Like `quote`, the cart comes from Redis and
   * never from the body — the pincode is the only thing the client gets to say,
   * because it is the only thing it knows that the server does not.
   */
  @Post('checkout/serviceability')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async serviceability(
    @Req() req: CustomerRequest,
    @Body() dto: ServiceabilityDto,
  ): Promise<ServiceabilityResponse> {
    const customerId = req.user.customerId;
    const cart = await this.carts.getCart(customerId);
    return this.checkout.checkServiceability(cart?.items ?? [], dto);
  }

  /**
   * `PROMO-02` — "will this code work?" answered against the real cart, before
   * the customer commits to a quote. Tighter throttle than the quote itself:
   * this is the endpoint a code-guesser would hammer.
   *
   * An ineligible code raises the human message from `CouponsService.evaluate`
   * as a `400`; there is no `{ valid: false }` branch.
   */
  @Post('coupons/validate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async validateCoupon(
    @Req() req: CustomerRequest,
    @Body() dto: ValidateCouponDto,
  ) {
    const customerId = req.user.customerId;
    const cart = await this.carts.getCart(customerId);
    const priced = await this.pricing.price(
      cart?.items ?? [],
      dto.channel ?? OrderChannel.delivery,
    );
    return this.coupons.validate(dto.code, {
      customerId,
      lines: priced.lines,
      subtotal: priced.subtotal,
      hasShipped: priced.has_shipped,
    });
  }
}
