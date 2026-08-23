import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import express from 'express';
import { ReviewStatus } from '@prisma/client';
import { CustomerGuard } from '../customer-auth/guards/customer.guard';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import {
  REVIEW_STATUS_ALL,
  ReviewsService,
  type ReviewStatusFilter,
} from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

/** Request shape after the staff auth guard has attached the user. */
type AuthedRequest = express.Request & { user?: { id?: string } };

const staffId = (req: express.Request): string | null =>
  (req as AuthedRequest).user?.id ?? null;

/**
 * `?status=` on the staff queue. Absent means the default (`pending`); `all`
 * means no filter. Validated here rather than with `@Query(new ParseEnumPipe)`
 * so `all` stays a legal value and a typo answers `400` with the legal set.
 */
function parseStatusFilter(raw?: string): ReviewStatusFilter | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (raw === REVIEW_STATUS_ALL) return REVIEW_STATUS_ALL;
  if ((Object.values(ReviewStatus) as string[]).includes(raw)) {
    return raw as ReviewStatus;
  }
  throw new BadRequestException(
    `Invalid status: ${raw}. Allowed: ${Object.values(ReviewStatus).join(', ')}, ${REVIEW_STATUS_ALL}`,
  );
}

/**
 * Storefront review surface. `@Public()` bypasses the global `JwtAuthGuard` so
 * `CustomerGuard` (which rejects a staff token) is the only authority here —
 * the same arrangement `CustomerOrdersController` and `CustomerLoyaltyController`
 * use. The customer id comes from the token, never from the body.
 *
 * The write is throttled harder than the reads: posting a review is a
 * one-per-delivered-line act, so ten a minute is already generous, while the
 * two lists are polled by the account page.
 */
@Controller('customer/reviews')
@UseGuards(CustomerGuard)
@Public()
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class CustomerReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** The customer's own reviews, including the ones still awaiting moderation. */
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async mine(@Req() req: any) {
    const customerId: string = req.user.customerId;
    return this.reviews.listForCustomer(customerId);
  }

  /** ACCT-02 — delivered/attended lines this customer has not reviewed yet. */
  @Get('pending')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async pending(@Req() req: any) {
    const customerId: string = req.user.customerId;
    return this.reviews.pendingForCustomer(customerId);
  }

  /** REV-01 — `400` not delivered · `403` other customer · `409` already reviewed. */
  @Post()
  async create(@Req() req: any, @Body() dto: CreateReviewDto) {
    const customerId: string = req.user.customerId;
    return this.reviews.create(customerId, dto);
  }
}

/** REV-02 — the staff moderation queue (`MANAGE_OPS` throughout). */
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_OPS)
  async list(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviews.listForModeration(
      parseStatusFilter(status),
      cursor,
      limit ? Number(limit) : undefined,
    );
  }

  /** Publishes the review, recomputes the product rollup and fires `review.published`. */
  @Patch(':id/publish')
  @RequiresPermission(Permission.MANAGE_OPS)
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateReviewDto,
    @Req() req: express.Request,
  ) {
    return this.reviews.moderate(
      id,
      ReviewStatus.published,
      staffId(req),
      dto?.note,
    );
  }

  /** Un-publishes: the row leaves the product page and the rollup drops it. */
  @Patch(':id/hide')
  @RequiresPermission(Permission.MANAGE_OPS)
  async hide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateReviewDto,
    @Req() req: express.Request,
  ) {
    return this.reviews.moderate(
      id,
      ReviewStatus.hidden,
      staffId(req),
      dto?.note,
    );
  }
}

/**
 * Public product reviews. The path rides on the catalog surface (API appendix
 * §A) but the handler lives here so `CatalogService` never grows a `Review`
 * query — `ReviewsService` stays the only reader of the moderation status.
 *
 * `CatalogController` declares no `catalog/products/:id` route, so this adds a
 * path rather than shadowing one.
 */
@Controller('catalog/products')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get(':id/reviews')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviews.listPublic(
      id,
      cursor,
      limit ? Number(limit) : undefined,
    );
  }
}
