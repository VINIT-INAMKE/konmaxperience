import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FoodCostController } from './food-cost.controller';
import { FoodCostService } from './food-cost.service';

/**
 * RUN-03 — theoretical vs actual food cost.
 *
 * Self-contained: `PrismaModule` and `NodeModule` are both `@Global()`, so the
 * only edge this module needs is the one it declares. `FoodCostService` is
 * exported because the daily close and the morning brief are the two obvious
 * next readers of the same numbers.
 */
@Module({
  imports: [PrismaModule],
  controllers: [FoodCostController],
  providers: [FoodCostService],
  exports: [FoodCostService],
})
export class FoodCostModule {}
