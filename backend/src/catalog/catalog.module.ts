import { Module } from '@nestjs/common';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CatalogController } from './catalog.controller';
import { CatalogCacheService } from './catalog-cache.service';
import { CatalogService } from './catalog.service';

/**
 * `CustomerAuthModule` is imported for its exported `RedisService` — the single
 * ioredis connection the app owns. Providing `RedisService` locally would open
 * a second connection to the same Upstash instance.
 */
@Module({
  imports: [CustomerAuthModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogCacheService],
  exports: [CatalogService, CatalogCacheService],
})
export class CatalogModule {}
