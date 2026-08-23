import { Module } from '@nestjs/common';
import {
  CustomerReviewsController,
  PublicReviewsController,
  ReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SettingsModule } from '../settings/settings.module';

/**
 * REV-01 / REV-02.
 *
 * `PrismaModule` and `AuditModule` are `@Global()`, and `EventEmitterModule` is
 * registered `forRoot()` in `AppModule`, so `SettingsModule` (for
 * `SystemSetting['reviews'].auto_publish_min_rating`) is the only import.
 *
 * Three controllers, one service: the storefront surface behind `CustomerGuard`,
 * the staff moderation queue behind `MANAGE_OPS`, and the unauthenticated
 * product-page list. `ReviewsService` is exported so a later phase's account or
 * product screen can read reviews without re-implementing the status filter.
 */
@Module({
  imports: [SettingsModule],
  controllers: [
    CustomerReviewsController,
    ReviewsController,
    PublicReviewsController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
